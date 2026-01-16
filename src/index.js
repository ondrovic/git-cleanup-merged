#!/usr/bin/env node

const { execSync } = require("child_process");
const readline = require("readline");
const clearTerminal = require("./utils");
const Spinner = require("./utils/spinner");
const path = require("path");

// Colors for terminal output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class GitCleanupTool {
  constructor() {
    this.dryRun = false;
    this.verbose = false;
    this.untrackedOnly = false;
    this.countOnly = false;
    this.branchesToDelete = [];
    this.prResults = [];
    this.currentBranch = "";
    this.spinner = new Spinner();
    this.version = require("../package.json").version;
  }

  // Helper method for minimum spinner visibility
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execCommand(command, options = {}) {
    try {
      const timeout = options.timeout || 30000; // Default 30s timeout
      const result = execSync(command, {
        encoding: "utf8",
        stdio: options.silent ? "pipe" : "inherit",
        timeout: timeout,
        ...options,
      });
      return result.trim();
    } catch (error) {
      if (!options.silent) {
        throw error;
      }
      // If it's a timeout, return a specific error or indicator
      if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
        return "__TIMEOUT__";
      }
      return null;
    }
  }

  async checkDependencies() {
    this.spinner.updateMessage("Checking dependencies...");
    this.spinner.start();

    // Check if we're in a git repository
    const gitDirResult = await this.execCommand("git rev-parse --git-dir", {
      silent: true,
    });
    if (gitDirResult === null || gitDirResult === "__TIMEOUT__") {
      if (gitDirResult === "__TIMEOUT__") {
        this.spinner.error("Git repository check timed out");
      } else {
        this.spinner.error("Not in a git repository");
      }
      process.exit(1);
    }
    await this.sleep(300); // Minimum spinner time

    // Only check GitHub CLI dependencies if not in untracked-only or count-only mode
    if (!this.untrackedOnly && !this.countOnly) {
      this.spinner.updateMessage("Checking GitHub CLI...");
      // Check for GitHub CLI
      const ghVersionResult = await this.execCommand("gh --version", {
        silent: true,
      });
      if (ghVersionResult === null || ghVersionResult === "__TIMEOUT__") {
        if (ghVersionResult === "__TIMEOUT__") {
          this.spinner.error(
            "GitHub CLI check timed out. Please check your connection.",
          );
        } else {
          this.spinner.error(
            "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
          );
        }
        process.exit(1);
      }
      await this.sleep(200);

      this.spinner.updateMessage("Verifying GitHub authentication...");
      // Check GitHub CLI authentication
      const authStatusResult = await this.execCommand("gh auth status", {
        silent: true,
      });
      if (authStatusResult === null || authStatusResult === "__TIMEOUT__") {
        if (authStatusResult === "__TIMEOUT__") {
          this.spinner.error(
            "GitHub authentication check timed out. Please check your connection.",
          );
        } else {
          this.spinner.error(
            "GitHub CLI is not authenticated. Run: gh auth login",
          );
        }
        process.exit(1);
      }
      await this.sleep(200);
    }

    this.spinner.success("Dependencies checked");
  }

  async getCurrentBranch() {
    this.spinner.updateMessage("Getting current branch...");
    this.spinner.start();

    try {
      const branchResult = await this.execCommand("git branch --show-current", {
        silent: true,
      });
      // Check if command failed or timed out
      if (branchResult === null || branchResult === "__TIMEOUT__") {
        if (branchResult === "__TIMEOUT__") {
          this.spinner.error("Failed to get current branch (timeout)");
        } else {
          this.spinner.error("Failed to get current branch");
        }
        process.exit(1);
      }
      this.currentBranch = branchResult;
      await this.sleep(200); // Let the spinner show
      this.spinner.success(`Current branch: ${this.currentBranch}`);
    } catch {
      this.spinner.error("Failed to get current branch");
      process.exit(1);
    }
  }

  async getBranches(mode = "all") {
    try {
      // Get all local branches with their upstream tracking information
      const branches = await this.execCommand(
        'git for-each-ref --format="%(refname:short) %(upstream:short)" refs/heads/',
        { silent: true },
      );

      // Check if execCommand returned null or timed out (command failed)
      if (branches === null || branches === "__TIMEOUT__") {
        if (branches === "__TIMEOUT__") {
          this.spinner.error(`Failed to get ${mode} branches (timeout)`);
        } else {
          this.spinner.error(`Failed to get ${mode} branches`);
        }
        return [];
      }

      const result = [];
      const branchLines = branches
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.trim());

      for (const line of branchLines) {
        const parts = line.split(/\s+/);
        const branchName = parts[0];
        const upstream = parts.slice(1).join(" ");

        if (["main", "master", this.currentBranch].includes(branchName)) {
          continue;
        }

        const isTracked = upstream && upstream.trim() !== "";

        if (mode === "tracked" && isTracked) {
          result.push(branchName);
        } else if (mode === "untracked" && !isTracked) {
          result.push(branchName);
        } else if (mode === "all") {
          result.push(branchName);
        }
      }

      return result;
    } catch {
      this.spinner.error(`Failed to get ${mode} branches`);
      return [];
    }
  }

  async getLocalBranches() {
    return this.getBranches("all");
  }

  async getTrackedBranches() {
    return this.getBranches("tracked");
  }

  async getUntrackedBranches() {
    return this.getBranches("untracked");
  }

  async countBranches() {
    this.spinner.updateMessage("Counting branches...");
    this.spinner.start();

    const trackedBranches = await this.getTrackedBranches();
    const untrackedBranches = await this.getUntrackedBranches();
    const total = trackedBranches.length + untrackedBranches.length;

    await this.sleep(300); // Minimum spinner time
    this.spinner.success("Branch count complete");

    console.log("");
    console.log(`${colors.bold}📊 Branch Count Summary${colors.reset}`);
    console.log(`  Total branches: ${total}`);
    console.log(`  Tracked: ${trackedBranches.length}`);
    console.log(`  Untracked: ${untrackedBranches.length}`);
  }

  async getPRStatus(branch) {
    try {
      return await this.execCommand(
          `gh pr view "${branch}" --json state --jq .state`,
          {silent: true, timeout: 10000}, // 10s timeout for PR status
      );
    } catch {
      return null;
    }
  }

  async checkBranches() {
    this.spinner.updateMessage("Fetching tracked branches...");
    this.spinner.start();

    const branches = await this.getTrackedBranches();

    if (branches.length === 0) {
      this.spinner.warning("No tracked branches found to check.");
      this.spinner.info(
        "You might want to use --untracked-only to see local-only branches.",
      );
      return;
    }

    this.spinner.updateMessage(
      `Checking ${branches.length} tracked branches against GitHub...`,
    );
    this.spinner.start(); // Ensure spinner is running before workers start
    await this.sleep(150); // Give spinner time to display initial message

    // Limit concurrency to avoid hitting GitHub API rate limits
    const CONCURRENCY_LIMIT = 5;
    // Use Map to store results by branch name to preserve input order
    const resultsMap = new Map();
    const totalBranches = branches.length;
    
    // Atomic counter for branch index tracking
    let nextIndex = 0;
    
    // Function to get next branch index atomically
    const getNextBranchIndex = () => {
      if (nextIndex >= totalBranches) {
        return null;
      }
      return nextIndex++;
    };
    
    // Synchronized array for branches to delete to avoid race conditions
    const branchesToDeleteSync = [];
    const addBranchToDelete = (branch) => {
      branchesToDeleteSync.push(branch);
    };
    
    const processBranch = async (branchIndex) => {
      const branch = branches[branchIndex];
      
      // Update the spinner message as we start checking this branch
      this.spinner.updateMessage(
        `Checking branch ${branchIndex + 1}/${branches.length}: ${branch}`,
      );
      this.spinner.start();
      
      const prStatus = await this.getPRStatus(branch);
      
      if (this.verbose) {
        this.spinner.debug(
          `Checking branch ${branchIndex + 1}/${branches.length}: ${branch} -> PR state: ${prStatus || "unknown"}`,
          this.verbose,
        );
        // Restart spinner after debug output stops it
        this.spinner.updateMessage(
          `Checking branch ${branchIndex + 1}/${branches.length}: ${branch}`,
        );
        this.spinner.start();
      }
      
      let icon, label;
      switch (prStatus) {
        case "MERGED":
          icon = "✅";
          label = "Merged";
          addBranchToDelete(branch);
          break;
        case "CLOSED":
          icon = "🔒";
          label = "Closed";
          addBranchToDelete(branch);
          break;
        case "OPEN":
          icon = "⏳";
          label = "Open";
          break;
        case "__TIMEOUT__":
          icon = "❓";
          label = "Timeout";
          break;
        default:
          icon = "❌";
          label = "No PR";
          break;
      }
      
      resultsMap.set(branch, { branch, icon, label });
    };
    
    const fluidWorker = async () => {
      while (true) {
        const branchIndex = getNextBranchIndex();
        if (branchIndex === null) {
          break; // No more branches to process
        }
        try {
          await processBranch(branchIndex);
        } catch (error) {
          // Handle errors gracefully - one failed branch shouldn't stop the entire operation
          const branch = branches[branchIndex];
          // Store error result for this branch
          resultsMap.set(branch, {
            branch,
            icon: "⚠️",
            label: "Error",
          });
          // Log error if verbose mode is enabled
          if (this.verbose) {
            this.spinner.debug(
              `Error checking '${branch}': ${error.message}`,
              this.verbose,
            );
          }
        }
      }
    };

    const workers = Array(Math.min(CONCURRENCY_LIMIT, totalBranches))
      .fill(null)
      .map(() => fluidWorker());

    // Wait for all concurrent workers to finish
    await Promise.all(workers);

    // Reconstruct results array in the original input order
    this.prResults = branches.map((branch) => resultsMap.get(branch));
    
    // Copy synchronized branches to delete array after all workers complete
    this.branchesToDelete = branchesToDeleteSync;

    this.spinner.success(
      `Finished checking ${totalBranches} tracked branches`,
    );
    console.log(""); // Empty line for spacing
  }

  async checkUntrackedBranches() {
    this.spinner.updateMessage("Fetching untracked local branches...");
    this.spinner.start();

    const untrackedBranches = await this.getUntrackedBranches();

    if (untrackedBranches.length === 0) {
      this.spinner.warning("No untracked local branches found.");
      return;
    }

    this.spinner.updateMessage(
      `Found ${untrackedBranches.length} untracked local branches...`,
    );

    // Process each untracked branch
    for (let i = 0; i < untrackedBranches.length; i++) {
      const branch = untrackedBranches[i];
      this.spinner.updateMessage(
        `Processing untracked branch ${i + 1}/${untrackedBranches.length}: ${branch}`,
      );

      // Only call debug if verbose is enabled to avoid stopping spinner
      if (this.verbose) {
        this.spinner.debug(
          `Processing untracked branch ${branch}`,
          this.verbose,
        );
        // Restart spinner after debug output
        this.spinner.updateMessage(
          `Processing untracked branch ${i + 1}/${untrackedBranches.length}: ${branch}`,
        );
        this.spinner.start();
      }

      const icon = "🏷️";
      const label = "Untracked";
      this.branchesToDelete.push(branch);

      this.prResults.push({ branch, icon, label });

      // Add a small delay so we can see the spinner working
      await this.sleep(300);
    }

    this.spinner.success(
      `Finished processing ${untrackedBranches.length} untracked branches`,
    );
    console.log(""); // Empty line for spacing
  }

  displayResults() {
    this.spinner.log("─".repeat(60));
    this.spinner.log(
      `${"Branch".padEnd(40)} ${"Icon".padEnd(6)} ${"Status".padEnd(10)}`,
    );
    this.spinner.log("─".repeat(60));

    this.prResults.forEach(({ branch, icon, label }) => {
      this.spinner.log(
        `${branch.padEnd(40)} ${icon.padEnd(6)} ${label.padEnd(10)}`,
      );
    });

    this.spinner.log("─".repeat(60));
  }

  async deleteBranches() {
    if (this.branchesToDelete.length === 0) {
      if (this.untrackedOnly) {
        this.spinner.warning("No untracked local branches found.");
      } else {
        this.spinner.warning("No branches with merged or closed PRs found.");
      }
      return;
    }

    console.log(""); // Empty line for spacing
    if (this.dryRun) {
      this.spinner.warning("DRY RUN — branches eligible for deletion:");
    } else {
      if (this.untrackedOnly) {
        this.spinner.error(
          "The following untracked local branches will be deleted:",
        );
      } else {
        this.spinner.error(
          "The following branches have merged or closed PRs and will be deleted:",
        );
      }
    }

    // List branches with icons for better clarity
    this.branchesToDelete.forEach((branch) => {
      const result = this.prResults.find((r) => r.branch === branch);
      const icon = result ? result.icon : "🗑️";
      this.spinner.log(`  ${icon} ${branch}`, colors.red);
    });

    if (this.dryRun) {
      if (this.untrackedOnly) {
        this.spinner.info(
          "Run without --dry-run to actually delete untracked branches.",
        );
      } else {
        this.spinner.info("Run without --dry-run to actually delete them.");
      }
      return;
    }

    const confirmationMessage = this.untrackedOnly
      ? "Proceed with deletion of untracked branches? (y/N): "
      : "Proceed with deletion? (y/N): ";

    const confirmed = await this.askConfirmation(confirmationMessage);

    if (confirmed) {
      console.log(""); // Empty line for spacing

      // Concurrency limit for deletion as well
      const DELETE_CONCURRENCY = 3;
      let deletedCount = 0;
      const failedBranchesSync = [];
      const branchesToDeleteCopy = [...this.branchesToDelete];
      const totalToDelete = this.branchesToDelete.length;
      // Use atomic counter to avoid race conditions with concurrent workers
      // The counter object ensures the increment operation is atomic
      const deletionCounter = { value: 0 };
      const getNextDeletionProgress = () => {
        // Increment and return in a single synchronous operation
        return ++deletionCounter.value;
      };
      
      // Atomic function to get next branch index to avoid race conditions
      let nextDeleteIndex = 0;
      const getNextDeleteBranch = () => {
        if (nextDeleteIndex >= branchesToDeleteCopy.length) {
          return null;
        }
        return branchesToDeleteCopy[nextDeleteIndex++];
      };
      
      // Synchronized function to add failed branch
      const addFailedBranch = (branch) => {
        failedBranchesSync.push(branch);
      };
      
      // Synchronized function to increment deleted count
      const incrementDeletedCount = () => {
        deletedCount++;
      };

      const deletionWorker = async () => {
        while (true) {
          const branch = getNextDeleteBranch();
          if (branch === null) {
            break; // No more branches to process
          }
          const currentProgress = getNextDeletionProgress();
          
          this.spinner.updateMessage(
            `Deleting branch ${currentProgress}/${totalToDelete}: ${branch}`,
          );
          this.spinner.start();

          try {
            const result = await this.execCommand(`git branch -d "${branch}"`, {
              silent: true,
            });
            // Check if the command failed (returns null or "__TIMEOUT__" instead of throwing)
            if (result === "__TIMEOUT__") {
              addFailedBranch(branch);
              this.spinner.stop();
              this.spinner.log(
                `❌ Failed to delete branch ${branch} (timeout)`,
                colors.red,
              );
            } else if (result === null) {
              // Command failed (non-timeout error)
              addFailedBranch(branch);
              this.spinner.stop();
              this.spinner.log(
                `❌ Failed to delete branch ${branch}`,
                colors.red,
              );
            } else {
              // Success - result is a non-empty string
              incrementDeletedCount();
              this.spinner.stop();
              this.spinner.log(`✅ Deleted branch ${branch}`, colors.green);
            }
          } catch {
            addFailedBranch(branch);
            this.spinner.stop();
            this.spinner.log(
              `❌ Failed to delete branch ${branch}`,
              colors.red,
            );
          }
          await this.sleep(50);
        }
      };

      const workers = Array(Math.min(DELETE_CONCURRENCY, totalToDelete))
        .fill(null)
        .map(() => deletionWorker());

      await Promise.all(workers);

      // Final status
      if (failedBranchesSync.length === 0) {
        this.spinner.success(`Successfully deleted ${deletedCount} branches`);
      } else {
        this.spinner.warning(
          `Deleted ${deletedCount} branches, ${failedBranchesSync.length} failed`,
        );
        failedBranchesSync.forEach((branch) => {
          this.spinner.log(`  Failed: ${branch}`, colors.red);
        });
      }
    } else {
      this.spinner.info("Cancelled.");
    }
  }

  async askConfirmation(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      });
    });
  }

  showHelp() {
    console.log(`
${colors.bold}git-cleanup-merged${colors.reset} - Clean up merged Git branches

${colors.bold}USAGE:${colors.reset}
    git-cleanup-merged [DIRECTORY] [OPTIONS]

${colors.bold}DIRECTORY (optional):${colors.reset}
    Path to a git repository to operate on. Defaults to the current directory if omitted.

${colors.bold}OPTIONS:${colors.reset}
    -n, --dry-run         Show what would be deleted without actually deleting
    -v, --verbose         Show detailed information during processing
    -u, --untracked-only  Only process untracked local branches (no remote tracking branch)
    -c, --count           Display branch count summary and exit (no deletion)
    -V, --version         Show version information
    -h, --help            Show this help message

${colors.bold}DESCRIPTION:${colors.reset}
    This tool checks your local Git branches against GitHub PRs to find
    branches that have been merged and are safe to delete locally.
    
    When using --untracked-only, it will only process local branches that
    don't have a corresponding remote tracking branch.

${colors.bold}REQUIREMENTS:${colors.reset}
    - Git repository
    - GitHub CLI (gh) installed and authenticated (only for normal mode)
    - Internet connection to check GitHub PR status (only for normal mode)

${colors.bold}EXAMPLES:${colors.reset}
    git-cleanup-merged                    # Clean up merged branches in current directory
    git-cleanup-merged ../my/repo         # Clean up merged branches in another repo
    git-cleanup-merged --dry-run          # Preview what would be deleted
    git-cleanup-merged --verbose          # Show detailed processing info
    git-cleanup-merged --untracked-only   # Clean up untracked local branches only
    git-cleanup-merged -u                 # Same as --untracked-only
    git-cleanup-merged --untracked-only --dry-run  # Preview untracked branches
    git-cleanup-merged -u -n              # Same as above with shorthand
    git-cleanup-merged --count            # Display branch count summary
    git-cleanup-merged -c                 # Same as --count
        `);
  }

  parseArguments() {
    const args = process.argv.slice(2);
    // Check for a directory as the first positional argument (not a flag)
    if (args[0] && !args[0].startsWith("-")) {
      try {
        process.chdir(args[0]);
      } catch {
        this.spinner.error(`Failed to change directory to: ${args[0]}`);
        process.exit(1);
      }
      args.shift();
    }
    for (const arg of args) {
      switch (arg) {
        case "--dry-run":
        case "-n":
          this.dryRun = true;
          break;
        case "--verbose":
        case "-v":
          this.verbose = true;
          break;
        case "--untracked-only":
        case "-u":
          this.untrackedOnly = true;
          break;
        case "--count":
        case "-c":
          this.countOnly = true;
          break;
        case "--version":
        case "-V":
          console.log(this.version);
          return 0;
        case "--help":
        case "-h":
          this.showHelp();
          return 0;
        default:
          this.spinner.error(`Unknown option: ${arg}`);
          this.spinner.info("Use --help for usage information.");
          process.exit(1);
      }
    }
  }

  async run() {
    clearTerminal();
    // Display just the directory name being scanned
    this.spinner.log(
      `📂 Scanning repository: ${path.basename(process.cwd())}`,
      "\x1b[34m",
    );
    try {
      const parseResult = this.parseArguments();
      // If parseArguments returns 0, it means --version or --help was requested
      // Exit early without executing the main cleanup logic
      if (parseResult === 0) {
        return;
      }
      await this.checkDependencies();
      await this.getCurrentBranch();

      // Handle count-only mode and exit early
      if (this.countOnly) {
        await this.countBranches();
        return;
      }

      if (this.untrackedOnly) {
        await this.checkUntrackedBranches();
      } else {
        await this.checkBranches();
      }

      this.displayResults();
      await this.deleteBranches();
    } catch (error) {
      this.spinner.error(`An error occurred: ${error.message}`);
      process.exit(1);
    }
  }
}

module.exports = GitCleanupTool;
