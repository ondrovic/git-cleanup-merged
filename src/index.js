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
  }

  // Helper method for minimum spinner visibility
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: "utf8",
        stdio: options.silent ? "pipe" : "inherit",
        ...options,
      });
      return result.trim();
    } catch (error) {
      if (!options.silent) {
        throw error;
      }
      return null;
    }
  }

  async checkDependencies() {
    this.spinner.updateMessage("Checking dependencies...");
    this.spinner.start();

    // Check if we're in a git repository
    if (
      (await this.execCommand("git rev-parse --git-dir", { silent: true })) ===
      null
    ) {
      this.spinner.error("Not in a git repository");
      process.exit(1);
    }
    await this.sleep(300); // Minimum spinner time

    // Only check GitHub CLI dependencies if not in untracked-only or count-only mode
    if (!this.untrackedOnly && !this.countOnly) {
      this.spinner.updateMessage("Checking GitHub CLI...");
      // Check for GitHub CLI
      if ((await this.execCommand("gh --version", { silent: true })) === null) {
        this.spinner.error(
          "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
        );
        process.exit(1);
      }
      await this.sleep(200);

      this.spinner.updateMessage("Verifying GitHub authentication...");
      // Check GitHub CLI authentication
      if (
        (await this.execCommand("gh auth status", { silent: true })) === null
      ) {
        this.spinner.error(
          "GitHub CLI is not authenticated. Run: gh auth login",
        );
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
      this.currentBranch = await this.execCommand("git branch --show-current", {
        silent: true,
      });
      await this.sleep(200); // Let the spinner show
      this.spinner.success(`Current branch: ${this.currentBranch}`);
    } catch {
      this.spinner.error("Failed to get current branch");
      process.exit(1);
    }
  }

  async getLocalBranches() {
    try {
      const branches = await this.execCommand(
        'git for-each-ref --format="%(refname:short)" refs/heads/',
        { silent: true },
      );

      return branches
        .split("\n")
        .filter((branch) => branch.trim() !== "")
        .filter(
          (branch) =>
            !["main", "master", this.currentBranch].includes(branch.trim()),
        )
        .map((branch) => branch.trim());
    } catch {
      this.spinner.error("Failed to get local branches");
      return [];
    }
  }

  async getTrackedBranches() {
    try {
      // Get all local branches with their upstream tracking information
      const branches = await this.execCommand(
        'git for-each-ref --format="%(refname:short) %(upstream:short)" refs/heads/',
        { silent: true },
      );

      const trackedBranches = [];

      const branchLines = branches
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.trim());

      for (const line of branchLines) {
        // Use regex to split on one or more whitespace characters
        const parts = line.split(/\s+/);
        const branchName = parts[0];
        const upstream = parts.slice(1).join(" "); // Join remaining parts in case upstream contains spaces

        // Skip main, master, and current branch
        if (["main", "master", this.currentBranch].includes(branchName)) {
          continue;
        }

        // If upstream is not empty, the branch is tracking a remote branch
        if (upstream && upstream.trim() !== "") {
          trackedBranches.push(branchName);
        }
      }

      return trackedBranches;
    } catch {
      this.spinner.error("Failed to get tracked branches");
      return [];
    }
  }

  async getUntrackedBranches() {
    try {
      // Get all local branches with their upstream tracking information
      const branches = await this.execCommand(
        'git for-each-ref --format="%(refname:short) %(upstream:short)" refs/heads/',
        { silent: true },
      );

      const untrackedBranches = [];

      const branchLines = branches
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.trim());

      for (const line of branchLines) {
        // Use regex to split on one or more whitespace characters
        const parts = line.split(/\s+/);
        const branchName = parts[0];
        const upstream = parts.slice(1).join(" "); // Join remaining parts in case upstream contains spaces

        // Skip main, master, and current branch
        if (["main", "master", this.currentBranch].includes(branchName)) {
          continue;
        }

        // If upstream is empty, the branch is not tracking any remote branch
        if (!upstream || upstream.trim() === "") {
          untrackedBranches.push(branchName);
        }
      }

      return untrackedBranches;
    } catch {
      this.spinner.error("Failed to get untracked branches");
      return [];
    }
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
      const result = await this.execCommand(
        `gh pr view "${branch}" --json state --jq .state`,
        { silent: true },
      );
      return result;
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

    // Process each branch
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      this.spinner.updateMessage(
        `Checking branch ${i + 1}/${branches.length}: ${branch}`,
      );

      const prStatus = await this.getPRStatus(branch);

      // Only call debug if verbose is enabled to avoid stopping spinner
      if (this.verbose) {
        this.spinner.debug(
          `Checking branch ${branch} -> PR state: ${prStatus || "unknown"}`,
          this.verbose,
        );
        // Restart spinner after debug output
        this.spinner.updateMessage(
          `Checking branch ${i + 1}/${branches.length}: ${branch}`,
        );
        this.spinner.start();
      }

      let icon, label;
      switch (prStatus) {
        case "MERGED":
          icon = "✅";
          label = "Merged";
          this.branchesToDelete.push(branch);
          break;
        case "CLOSED":
          icon = "🔒";
          label = "Closed";
          this.branchesToDelete.push(branch);
          break;
        case "OPEN":
          icon = "⏳";
          label = "Open";
          break;
        default:
          icon = "❌";
          label = "No PR";
          break;
      }

      this.prResults.push({ branch, icon, label });

      // Add a small delay so we can see the spinner working
      await this.sleep(300);
    }

    this.spinner.success(
      `Finished checking ${branches.length} tracked branches`,
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

    // List branches without icons since the spinner methods handle them
    this.branchesToDelete.forEach((branch) => {
      this.spinner.log(`  ${branch}`, colors.red);
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

      let deletedCount = 0;
      let failedBranches = [];

      for (let i = 0; i < this.branchesToDelete.length; i++) {
        const branch = this.branchesToDelete[i];
        this.spinner.updateMessage(
          `Deleting branch ${i + 1}/${this.branchesToDelete.length}: ${branch}`,
        );
        this.spinner.start();

        try {
          await this.execCommand(`git branch -d "${branch}"`, { silent: true });
          deletedCount++;
          // Stop spinner before printing confirmation to avoid overlap
          this.spinner.stop();
          this.spinner.log(`✅ Deleted branch ${branch}`, colors.green);
          // Brief pause to show progress
          await this.sleep(200);
        } catch {
          failedBranches.push(branch);
          // Stop spinner before printing error to avoid overlap
          this.spinner.stop();
          this.spinner.log(`❌ Failed to delete branch ${branch}`, colors.red);
          await this.sleep(200);
        }
      }

      // Final status
      if (failedBranches.length === 0) {
        this.spinner.success(`Successfully deleted ${deletedCount} branches`);
      } else {
        this.spinner.warning(
          `Deleted ${deletedCount} branches, ${failedBranches.length} failed`,
        );
        failedBranches.forEach((branch) => {
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
      this.parseArguments();
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
