const { execSync } = require("child_process");
const readline = require("readline");
const GitCleanupTool = require("../src/index");
const path = require("path");

// Mock all external dependencies
jest.mock("child_process");
jest.mock("readline");
jest.mock("../src/utils", () => jest.fn());

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
};
global.console = mockConsole;

// Mock process methods
const mockProcess = {
  stdout: {
    write: jest.fn(),
  },
  exit: jest.fn(),
  argv: ["node", "script.js"],
  platform: "win32",
};
global.process = mockProcess;

describe("GitCleanupTool", () => {
  let tool;
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset process.argv
    process.argv = ["node", "script.js"];

    // Mock spinner methods
    mockSpinner = {
      updateMessage: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    tool = new GitCleanupTool();
    tool.spinner = mockSpinner; // Replace spinner with mock after construction
    tool.sleep = jest.fn(() => Promise.resolve()); // Mock sleep to resolve immediately
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("sleep method", () => {
    it("should wait for specified milliseconds", async () => {
      const sleepPromise = tool.sleep(100);
      jest.advanceTimersByTime(100);
      await sleepPromise;
    });

    it("should actually use setTimeout", async () => {
      // Remove the mock to test the real setTimeout
      tool.sleep = GitCleanupTool.prototype.sleep;
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      const sleepPromise = tool.sleep(100);
      jest.advanceTimersByTime(100);
      await sleepPromise;

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      setTimeoutSpy.mockRestore();
    });
  });

  describe("execCommand method", () => {
    it("should execute command successfully", async () => {
      execSync.mockReturnValue("test output");

      const result = await tool.execCommand("test command");

      expect(execSync).toHaveBeenCalledWith("test command", {
        encoding: "utf8",
        stdio: "inherit",
        timeout: 30000,
      });
      expect(result).toBe("test output");
    });

    it("should execute command with silent option", async () => {
      execSync.mockReturnValue("test output");

      const result = await tool.execCommand("test command", { silent: true });

      expect(execSync).toHaveBeenCalledWith("test command", {
        encoding: "utf8",
        stdio: "pipe",
        silent: true,
        timeout: 30000,
      });
      expect(result).toBe("test output");
    });

    it("should return '__TIMEOUT__' when command times out with silent option", async () => {
      execSync.mockImplementation(() => {
        const err = new Error("Command timed out");
        err.code = "ETIMEDOUT";
        throw err;
      });

      const result = await tool.execCommand("test command", { silent: true });

      expect(result).toBe("__TIMEOUT__");
    });

    it("should return '__TIMEOUT__' when command is terminated with SIGTERM (timeout)", async () => {
      execSync.mockImplementation(() => {
        const err = new Error("Command terminated");
        err.signal = "SIGTERM";
        throw err;
      });

      const result = await tool.execCommand("test command", { silent: true });

      expect(result).toBe("__TIMEOUT__");
    });

    it("should return null when command fails with silent option (not a timeout)", async () => {
      execSync.mockImplementation(() => {
        throw new Error("Command failed");
      });

      const result = await tool.execCommand("test command", { silent: true });

      expect(result).toBeNull();
    });

    it("should support custom timeout in execCommand", async () => {
      execSync.mockReturnValue("ok");
      await tool.execCommand("cmd", { timeout: 5000 });
      expect(execSync).toHaveBeenCalledWith("cmd", expect.objectContaining({ timeout: 5000 }));
    });

    it("should throw error when command fails without silent option", async () => {
      execSync.mockImplementation(() => {
        throw new Error("Command failed");
      });

      await expect(tool.execCommand("test command")).rejects.toThrow(
        "Command failed",
      );
    });
  });

  describe("checkDependencies method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
    });

    it("should check dependencies successfully", async () => {
      tool.execCommand
        .mockResolvedValueOnce(".git") // git rev-parse --git-dir
        .mockResolvedValueOnce("gh version 2.0.0") // gh --version
        .mockResolvedValueOnce("authenticated"); // gh auth status

      await tool.checkDependencies();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Checking dependencies...",
      );
      expect(tool.spinner.start).toHaveBeenCalled();
      expect(tool.spinner.success).toHaveBeenCalledWith("Dependencies checked");
    });

    it("should exit when not in git repository", async () => {
      tool.execCommand.mockResolvedValueOnce(null); // git rev-parse --git-dir fails

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Not in a git repository",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when git repository check times out", async () => {
      tool.execCommand.mockResolvedValueOnce("__TIMEOUT__"); // git rev-parse --git-dir times out

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Git repository check timed out",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when GitHub CLI is not installed", async () => {
      tool.execCommand
        .mockResolvedValueOnce(".git") // git rev-parse --git-dir
        .mockResolvedValueOnce(null); // gh --version fails

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when GitHub CLI check times out", async () => {
      tool.execCommand
        .mockResolvedValueOnce(".git") // git rev-parse --git-dir
        .mockResolvedValueOnce("__TIMEOUT__"); // gh --version times out

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "GitHub CLI check timed out. Please check your connection.",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when GitHub CLI is not authenticated", async () => {
      tool.execCommand
        .mockResolvedValueOnce(".git") // git rev-parse --git-dir
        .mockResolvedValueOnce("gh version 2.0.0") // gh --version
        .mockResolvedValueOnce(null); // gh auth status fails

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "GitHub CLI is not authenticated. Run: gh auth login",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when GitHub authentication check times out", async () => {
      tool.execCommand
        .mockResolvedValueOnce(".git") // git rev-parse --git-dir
        .mockResolvedValueOnce("gh version 2.0.0") // gh --version
        .mockResolvedValueOnce("__TIMEOUT__"); // gh auth status times out

      await tool.checkDependencies();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "GitHub authentication check timed out. Please check your connection.",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should skip GitHub CLI checks in untracked-only mode", async () => {
      tool.untrackedOnly = true;
      tool.execCommand.mockResolvedValueOnce(".git"); // git rev-parse --git-dir

      await tool.checkDependencies();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Checking dependencies...",
      );
      expect(tool.spinner.success).toHaveBeenCalledWith("Dependencies checked");
      // Should not check GitHub CLI
      expect(tool.execCommand).not.toHaveBeenCalledWith("gh --version", {
        silent: true,
      });
      expect(tool.execCommand).not.toHaveBeenCalledWith("gh auth status", {
        silent: true,
      });
    });

    it("should skip GitHub CLI checks in count-only mode", async () => {
      tool.countOnly = true;
      tool.execCommand.mockResolvedValueOnce(".git"); // git rev-parse --git-dir

      await tool.checkDependencies();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Checking dependencies...",
      );
      expect(tool.spinner.success).toHaveBeenCalledWith("Dependencies checked");
      // Should not check GitHub CLI
      expect(tool.execCommand).not.toHaveBeenCalledWith("gh --version", {
        silent: true,
      });
      expect(tool.execCommand).not.toHaveBeenCalledWith("gh auth status", {
        silent: true,
      });
    });
  });

  describe("getCurrentBranch method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
    });

    it("should get current branch successfully", async () => {
      tool.execCommand.mockResolvedValue("main");

      await tool.getCurrentBranch();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Getting current branch...",
      );
      expect(tool.spinner.start).toHaveBeenCalled();
      expect(tool.currentBranch).toBe("main");
      expect(tool.spinner.success).toHaveBeenCalledWith("Current branch: main");
    });

    it("should exit when getting current branch fails", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed to get branch"));

      await tool.getCurrentBranch();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get current branch",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when getCurrentBranch returns null", async () => {
      tool.execCommand.mockResolvedValue(null);

      await tool.getCurrentBranch();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get current branch",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should exit when getCurrentBranch times out", async () => {
      tool.execCommand.mockResolvedValue("__TIMEOUT__");

      await tool.getCurrentBranch();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get current branch (timeout)",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("getLocalBranches method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
      tool.currentBranch = "main";
    });

    it("should get local branches successfully", async () => {
      tool.execCommand.mockResolvedValue("feature1 \nfeature2 \nmain \ndevelop ");

      const result = await tool.getLocalBranches();

      expect(tool.execCommand).toHaveBeenCalledWith(
        'git for-each-ref --format="%(refname:short) %(upstream:short)" refs/heads/',
        { silent: true },
      );
      expect(result).toEqual(["feature1", "feature2", "develop"]);
    });

    it("should filter out main, master, and current branch", async () => {
      tool.currentBranch = "develop";
      tool.execCommand.mockResolvedValue(
        "main\nmaster\ndevelop\nfeature1\nfeature2",
      );

      const result = await tool.getLocalBranches();

      expect(result).toEqual(["feature1", "feature2"]);
    });

    it("should return empty array when command fails", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getLocalBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get all branches",
      );
    });

    it("should return empty array when execCommand returns null", async () => {
      tool.execCommand.mockResolvedValue(null);

      const result = await tool.getLocalBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get all branches",
      );
    });

    it("should return empty array when execCommand times out", async () => {
      tool.execCommand.mockResolvedValue("__TIMEOUT__");

      const result = await tool.getLocalBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get all branches (timeout)",
      );
    });

    it("should handle empty branch list", async () => {
      tool.execCommand.mockResolvedValue("");

      const result = await tool.getLocalBranches();

      expect(result).toEqual([]);
    });

    it("should use default 'all' mode when no mode is provided to getBranches", async () => {
      tool.execCommand.mockResolvedValue("feature1 \nfeature2 \nmain \ndevelop ");

      // Call getBranches directly without arguments to test default value
      const result = await tool.getBranches();

      expect(result).toEqual(["feature1", "feature2", "develop"]);
    });
  });

  describe("getTrackedBranches method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
      tool.currentBranch = "main";
    });

    it("should get tracked branches successfully", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 origin/feature1\nfeature2 \nmain origin/main",
      ); // format: "branch upstream"

      const result = await tool.getTrackedBranches();

      expect(result).toEqual(["feature1"]);
    });

    it("should handle error", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getTrackedBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get tracked branches",
      );
      expect(result).toEqual([]);
    });

    it("should return empty array when execCommand returns null", async () => {
      tool.execCommand.mockResolvedValue(null);

      const result = await tool.getTrackedBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get tracked branches",
      );
    });

    it("should return empty array when execCommand times out for tracked branches", async () => {
      tool.execCommand.mockResolvedValue("__TIMEOUT__");

      const result = await tool.getTrackedBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get tracked branches (timeout)",
      );
    });

    it("should handle error in getUntrackedBranches mode", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getUntrackedBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get untracked branches",
      );
      expect(result).toEqual([]);
    });

    it("should return empty array when execCommand returns null for untracked branches", async () => {
      tool.execCommand.mockResolvedValue(null);

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get untracked branches",
      );
    });

    it("should return empty array when execCommand times out for untracked branches", async () => {
      tool.execCommand.mockResolvedValue("__TIMEOUT__");

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual([]);
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get untracked branches (timeout)",
      );
    });

    it("should handle error in getLocalBranches mode", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getLocalBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get all branches",
      );
      expect(result).toEqual([]);
    });

    it("should handle different remote names", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 upstream/feature1\nfeature2 \nmain origin/main",
      ); // format: "branch upstream"

      const result = await tool.getTrackedBranches();

      expect(result).toEqual(["feature1"]);
    });

    it("should handle empty upstream field", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 \nfeature2   \nmain origin/main",
      ); // format: "branch upstream" with whitespace

      const result = await tool.getTrackedBranches();

      expect(result).toEqual([]);
    });

    it("should handle multiple consecutive spaces between branch and upstream", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1    origin/feature1\nfeature2  upstream/feature2\nmain origin/main",
      ); // format: "branch    upstream" with multiple spaces

      const result = await tool.getTrackedBranches();

      expect(result).toEqual(["feature1", "feature2"]);
    });
  });

  describe("getUntrackedBranches method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
      tool.currentBranch = "main";
    });

    it("should get untracked branches successfully", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 \nfeature2 origin/feature2\nmain origin/main",
      ); // format: "branch upstream"

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual(["feature1"]);
    });

    it("should handle error", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getUntrackedBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to get untracked branches",
      );
      expect(result).toEqual([]);
    });

    it("should handle different remote names", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 \nfeature2 upstream/feature2\nmain origin/main",
      ); // format: "branch upstream"

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual(["feature1"]);
    });

    it("should handle empty upstream field", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1 \nfeature2   \nmain origin/main",
      ); // format: "branch upstream" with whitespace

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual(["feature1", "feature2"]);
    });

    it("should handle multiple consecutive spaces between branch and upstream", async () => {
      tool.execCommand.mockResolvedValueOnce(
        "feature1    \nfeature2  upstream/feature2\nmain origin/main",
      ); // format: "branch    upstream" with multiple spaces

      const result = await tool.getUntrackedBranches();

      expect(result).toEqual(["feature1"]);
    });
  });

  describe("countBranches method", () => {
    beforeEach(() => {
      tool.getTrackedBranches = jest.fn();
      tool.getUntrackedBranches = jest.fn();
      tool.sleep = jest.fn();
    });

    it("should count branches and display summary", async () => {
      tool.getTrackedBranches.mockResolvedValue(["feature1", "feature2"]);
      tool.getUntrackedBranches.mockResolvedValue(["local1"]);

      await tool.countBranches();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Counting branches...",
      );
      expect(tool.spinner.start).toHaveBeenCalled();
      expect(tool.spinner.success).toHaveBeenCalledWith("Branch count complete");
      expect(console.log).toHaveBeenCalled();
    });

    it("should handle zero branches", async () => {
      tool.getTrackedBranches.mockResolvedValue([]);
      tool.getUntrackedBranches.mockResolvedValue([]);

      await tool.countBranches();

      expect(tool.spinner.success).toHaveBeenCalledWith("Branch count complete");
    });

    it("should handle only tracked branches", async () => {
      tool.getTrackedBranches.mockResolvedValue(["feature1", "feature2", "feature3"]);
      tool.getUntrackedBranches.mockResolvedValue([]);

      await tool.countBranches();

      expect(tool.getTrackedBranches).toHaveBeenCalled();
      expect(tool.getUntrackedBranches).toHaveBeenCalled();
      expect(tool.spinner.success).toHaveBeenCalledWith("Branch count complete");
    });

    it("should handle only untracked branches", async () => {
      tool.getTrackedBranches.mockResolvedValue([]);
      tool.getUntrackedBranches.mockResolvedValue(["local1", "local2"]);

      await tool.countBranches();

      expect(tool.getTrackedBranches).toHaveBeenCalled();
      expect(tool.getUntrackedBranches).toHaveBeenCalled();
      expect(tool.spinner.success).toHaveBeenCalledWith("Branch count complete");
    });

    it("should call sleep for minimum spinner visibility", async () => {
      tool.getTrackedBranches.mockResolvedValue(["feature1"]);
      tool.getUntrackedBranches.mockResolvedValue(["local1"]);

      await tool.countBranches();

      expect(tool.sleep).toHaveBeenCalledWith(300);
    });
  });

  describe("getPRStatus method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
    });

    it("should get PR status successfully", async () => {
      tool.execCommand.mockResolvedValue("MERGED");

      const result = await tool.getPRStatus("feature1");

      expect(tool.execCommand).toHaveBeenCalledWith(
        'gh pr view "feature1" --json state --jq .state',
        { silent: true, timeout: 10000 },
      );
      expect(result).toBe("MERGED");
    });

    it("should return null when PR status check fails", async () => {
      tool.execCommand.mockRejectedValue(new Error("Failed"));

      const result = await tool.getPRStatus("feature1");

      expect(result).toBeNull();
    });
  });

  describe("checkBranches method", () => {
    beforeEach(() => {
      tool.getTrackedBranches = jest.fn();
      tool.getPRStatus = jest.fn();
      tool.sleep = jest.fn();
    });

    it("should check branches successfully", async () => {
      tool.getTrackedBranches.mockResolvedValue(["feature1", "feature2"]);
      tool.getPRStatus
        .mockResolvedValueOnce("MERGED")
        .mockResolvedValueOnce("OPEN");

      await tool.checkBranches();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Fetching tracked branches...",
      );
      expect(tool.spinner.start).toHaveBeenCalled();
      expect(tool.branchesToDelete).toEqual(["feature1"]);
      expect(tool.prResults).toHaveLength(2);
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Finished checking 2 tracked branches",
      );
    });

    it("should handle no branches to check", async () => {
      tool.getTrackedBranches.mockResolvedValue([]);

      await tool.checkBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "No tracked branches found to check.",
      );
      expect(tool.spinner.info).toHaveBeenCalledWith(
        "You might want to use --untracked-only to see local-only branches.",
      );
    });

    it("should handle verbose mode", async () => {
      tool.verbose = true;
      tool.getTrackedBranches.mockResolvedValue(["feature1"]);
      tool.getPRStatus.mockResolvedValue("MERGED");

      await tool.checkBranches();

      expect(tool.spinner.debug).toHaveBeenCalled();
    });

    it("should handle different PR statuses", async () => {
      tool.getTrackedBranches.mockResolvedValue([
        "merged",
        "closed",
        "open",
        "none",
        "timedout",
      ]);
      tool.getPRStatus
        .mockResolvedValueOnce("MERGED")
        .mockResolvedValueOnce("CLOSED")
        .mockResolvedValueOnce("OPEN")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("__TIMEOUT__");

      await tool.checkBranches();

      expect(tool.branchesToDelete).toEqual(["merged", "closed"]);
      expect(tool.prResults).toEqual([
        { branch: "merged", icon: "✅", label: "Merged" },
        { branch: "closed", icon: "🔒", label: "Closed" },
        { branch: "open", icon: "⏳", label: "Open" },
        { branch: "none", icon: "❌", label: "No PR" },
        { branch: "timedout", icon: "❓", label: "Timeout" },
      ]);
    });

    it("should handle unknown PR status", async () => {
      tool.getTrackedBranches.mockResolvedValue(["unknown-status"]);
      tool.getPRStatus.mockResolvedValue("DRAFT"); // Unknown status

      await tool.checkBranches();

      expect(tool.branchesToDelete).toEqual([]);
      expect(tool.prResults).toEqual([
        { branch: "unknown-status", icon: "❌", label: "No PR" },
      ]);
    });

    it("should show unknown status in debug output when verbose", async () => {
      tool.verbose = true;
      tool.getTrackedBranches.mockResolvedValue(["unknown-status"]);
      tool.getPRStatus.mockResolvedValue("DRAFT"); // Unknown status

      await tool.checkBranches();

      expect(tool.spinner.debug).toHaveBeenCalledWith(
        "Checking 'unknown-status' -> PR state: DRAFT",
        true,
      );
      expect(tool.branchesToDelete).toEqual([]);
      expect(tool.prResults).toEqual([
        { branch: "unknown-status", icon: "❌", label: "No PR" },
      ]);
    });

    it("should show 'unknown' in debug output when prStatus is null and verbose", async () => {
      tool.verbose = true;
      tool.getTrackedBranches.mockResolvedValue(["null-status"]);
      tool.getPRStatus.mockResolvedValue(null); // This will trigger the || "unknown" fallback

      await tool.checkBranches();

      expect(tool.spinner.debug).toHaveBeenCalledWith(
        "Checking 'null-status' -> PR state: unknown",
        true,
      );
      expect(tool.branchesToDelete).toEqual([]);
      expect(tool.prResults).toEqual([
        { branch: "null-status", icon: "❌", label: "No PR" },
      ]);
    });

    it("should handle multiple chunks of branches", async () => {
      // CONCURRENCY_LIMIT is 5
      const branches = ["b1", "b2", "b3", "b4", "b5", "b6"];
      tool.getTrackedBranches.mockResolvedValue(branches);
      tool.getPRStatus.mockResolvedValue("MERGED");

      await tool.checkBranches();

      expect(tool.branchesToDelete).toEqual(branches);
      expect(tool.prResults).toHaveLength(6);
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Finished checking 6 tracked branches",
      );
    });

    it("should continue processing other branches when one branch fails", async () => {
      const branches = ["b1", "b2", "b3"];
      tool.getTrackedBranches.mockResolvedValue(branches);
      // First branch throws an error, others succeed
      tool.getPRStatus
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("MERGED")
        .mockResolvedValueOnce("OPEN");

      await tool.checkBranches();

      // Should process all branches despite the error
      expect(tool.prResults).toHaveLength(3);
      // First branch should have error icon
      expect(tool.prResults[0]).toEqual({
        branch: "b1",
        icon: "⚠️",
        label: "Error",
      });
      // Other branches should be processed normally
      expect(tool.prResults[1]).toEqual({
        branch: "b2",
        icon: "✅",
        label: "Merged",
      });
      expect(tool.prResults[2]).toEqual({
        branch: "b3",
        icon: "⏳",
        label: "Open",
      });
      // Should still complete successfully
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Finished checking 3 tracked branches",
      );
    });

    it("should log error details in verbose mode when branch processing fails", async () => {
      tool.verbose = true;
      const branches = ["error-branch", "success-branch"];
      tool.getTrackedBranches.mockResolvedValue(branches);
      // First branch throws an error, second succeeds
      tool.getPRStatus
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce("MERGED");

      await tool.checkBranches();

      // Should log error in verbose mode
      expect(tool.spinner.debug).toHaveBeenCalledWith(
        "Error checking 'error-branch': Network timeout",
        true,
      );
      // Should still process all branches
      expect(tool.prResults).toHaveLength(2);
      expect(tool.prResults[0]).toEqual({
        branch: "error-branch",
        icon: "⚠️",
        label: "Error",
      });
    });
  });

  describe("checkUntrackedBranches method", () => {
    beforeEach(() => {
      tool.getUntrackedBranches = jest.fn();
      tool.sleep = jest.fn();
    });

    it("should check untracked branches successfully", async () => {
      tool.getUntrackedBranches.mockResolvedValue(["feature1", "feature2"]);

      await tool.checkUntrackedBranches();

      expect(tool.spinner.updateMessage).toHaveBeenCalledWith(
        "Fetching untracked local branches...",
      );
      expect(tool.spinner.start).toHaveBeenCalled();
      expect(tool.branchesToDelete).toEqual(["feature1", "feature2"]);
      expect(tool.prResults).toHaveLength(2);
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Finished processing 2 untracked branches",
      );
    });

    it("should handle no untracked branches", async () => {
      tool.getUntrackedBranches.mockResolvedValue([]);

      await tool.checkUntrackedBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "No untracked local branches found.",
      );
    });

    it("should handle verbose mode", async () => {
      tool.verbose = true;
      tool.getUntrackedBranches.mockResolvedValue(["feature1"]);

      await tool.checkUntrackedBranches();

      expect(tool.spinner.debug).toHaveBeenCalled();
    });
  });

  describe("displayResults method", () => {
    beforeEach(() => {
      tool.prResults = [
        { branch: "feature1", icon: "✅", label: "Merged" },
        { branch: "feature2", icon: "⏳", label: "Open" },
      ];
    });

    it("should display results correctly", () => {
      tool.displayResults();

      expect(tool.spinner.log).toHaveBeenCalledWith("─".repeat(60));
      expect(tool.spinner.log).toHaveBeenCalledWith(
        `${"Branch".padEnd(40)} ${"Icon".padEnd(6)} ${"Status".padEnd(10)}`,
      );
    });
  });

  describe("deleteBranches method", () => {
    beforeEach(() => {
      tool.execCommand = jest.fn();
      tool.askConfirmation = jest.fn();
      tool.sleep = jest.fn();
    });

    it("should handle no branches to delete", async () => {
      tool.branchesToDelete = [];

      await tool.deleteBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "No branches with merged or closed PRs found.",
      );
    });

    it("should handle no untracked branches to delete", async () => {
      tool.untrackedOnly = true;
      tool.branchesToDelete = [];

      await tool.deleteBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "No untracked local branches found.",
      );
    });

    it("should handle dry run mode", async () => {
      tool.dryRun = true;
      tool.branchesToDelete = ["feature1", "feature2"];

      await tool.deleteBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "DRY RUN — branches eligible for deletion:",
      );
      expect(tool.spinner.info).toHaveBeenCalledWith(
        "Run without --dry-run to actually delete them.",
      );
    });

    it("should delete branches when confirmed", async () => {
      tool.branchesToDelete = ["feature1", "feature2"];
      tool.askConfirmation.mockResolvedValue(true);
      tool.execCommand.mockResolvedValue("");

      await tool.deleteBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "The following branches have merged or closed PRs and will be deleted:",
      );
      expect(tool.askConfirmation).toHaveBeenCalledWith(
        "Proceed with deletion? (y/N): ",
      );
      expect(tool.execCommand).toHaveBeenCalledWith(
        'git branch -d "feature1"',
        { silent: true },
      );
      expect(tool.execCommand).toHaveBeenCalledWith(
        'git branch -d "feature2"',
        { silent: true },
      );
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Successfully deleted 2 branches",
      );
    });

    it("should handle failed branch deletions", async () => {
      tool.branchesToDelete = ["feature1", "feature2"];
      tool.askConfirmation.mockResolvedValue(true);
      tool.execCommand
        .mockResolvedValueOnce("") // feature1 succeeds
        .mockRejectedValueOnce(new Error("Failed")); // feature2 fails

      await tool.deleteBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "Deleted 1 branches, 1 failed",
      );
    });

    it("should use the branch icon from prResults", async () => {
      tool.branchesToDelete = ["feature1"];
      tool.prResults = [{ branch: "feature1", icon: "✅", label: "Merged" }];
      tool.askConfirmation.mockResolvedValue(false);

      await tool.deleteBranches();

      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("✅ feature1"),
        expect.anything(),
      );
    });

    it("should use a fallback icon if branch is not in prResults", async () => {
      tool.branchesToDelete = ["unknown-branch"];
      tool.prResults = [{ branch: "other-branch", icon: "✅", label: "Merged" }]; // Branch not in results
      tool.askConfirmation.mockResolvedValue(false);

      await tool.deleteBranches();

      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("🗑️ unknown-branch"),
        expect.anything(),
      );
    });

    it("should handle cancellation", async () => {
      tool.branchesToDelete = ["feature1"];
      tool.askConfirmation.mockResolvedValue(false);

      await tool.deleteBranches();

      expect(tool.spinner.info).toHaveBeenCalledWith("Cancelled.");
      expect(tool.execCommand).not.toHaveBeenCalled();
    });

    it("should handle untracked-only mode", async () => {
      tool.untrackedOnly = true;
      tool.branchesToDelete = ["feature1"];
      tool.askConfirmation.mockResolvedValue(true);
      tool.execCommand.mockResolvedValue("");

      await tool.deleteBranches();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "The following untracked local branches will be deleted:",
      );
      expect(tool.askConfirmation).toHaveBeenCalledWith(
        "Proceed with deletion of untracked branches? (y/N): ",
      );
    });

    it("should handle untracked-only dry run mode", async () => {
      tool.untrackedOnly = true;
      tool.dryRun = true;
      tool.branchesToDelete = ["feature1"];

      await tool.deleteBranches();

      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "DRY RUN — branches eligible for deletion:",
      );
      expect(tool.spinner.info).toHaveBeenCalledWith(
        "Run without --dry-run to actually delete untracked branches.",
      );
    });

    it("should handle multiple chunks of branches for deletion", async () => {
      // DELETE_CONCURRENCY is 3
      tool.branchesToDelete = ["b1", "b2", "b3", "b4"];
      tool.askConfirmation.mockResolvedValue(true);
      tool.execCommand.mockResolvedValue("");

      await tool.deleteBranches();

      expect(tool.execCommand).toHaveBeenCalledTimes(4);
      expect(tool.spinner.success).toHaveBeenCalledWith(
        "Successfully deleted 4 branches",
      );
    });

    it("should treat timeout as failure when deleting branches", async () => {
      tool.branchesToDelete = ["branch1", "branch2"];
      tool.askConfirmation.mockResolvedValue(true);
      // First branch times out, second succeeds
      tool.execCommand
        .mockResolvedValueOnce("__TIMEOUT__")
        .mockResolvedValueOnce("");

      await tool.deleteBranches();

      expect(tool.execCommand).toHaveBeenCalledTimes(2);
      // Should log timeout failure for first branch
      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to delete branch branch1 (timeout)"),
        expect.anything(),
      );
      // Should log success for second branch
      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("✅ Deleted branch branch2"),
        expect.anything(),
      );
      // Should show warning with 1 failed, 1 deleted
      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "Deleted 1 branches, 1 failed",
      );
    });

    it("should treat null return value as failure when deleting branches", async () => {
      tool.branchesToDelete = ["branch1", "branch2"];
      tool.askConfirmation.mockResolvedValue(true);
      // First branch fails (returns null), second succeeds
      tool.execCommand
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("");

      await tool.deleteBranches();

      expect(tool.execCommand).toHaveBeenCalledTimes(2);
      // Should log failure for first branch
      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to delete branch branch1"),
        expect.anything(),
      );
      // Should log success for second branch
      expect(tool.spinner.log).toHaveBeenCalledWith(
        expect.stringContaining("✅ Deleted branch branch2"),
        expect.anything(),
      );
      // Should show warning with 1 failed, 1 deleted
      expect(tool.spinner.warning).toHaveBeenCalledWith(
        "Deleted 1 branches, 1 failed",
      );
    });
  });

  describe("askConfirmation method", () => {
    it("should return true for yes answers", async () => {
      const mockRl = {
        question: jest.fn(),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const promise = tool.askConfirmation("Test question?");

      // Simulate user input
      const questionCallback = mockRl.question.mock.calls[0][1];
      questionCallback("y");

      const result = await promise;

      expect(result).toBe(true);
      expect(mockRl.close).toHaveBeenCalled();
    });

    it("should return true for YES answers", async () => {
      const mockRl = {
        question: jest.fn(),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const promise = tool.askConfirmation("Test question?");

      const questionCallback = mockRl.question.mock.calls[0][1];
      questionCallback("YES");

      const result = await promise;

      expect(result).toBe(true);
    });

    it("should return false for no answers", async () => {
      const mockRl = {
        question: jest.fn(),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const promise = tool.askConfirmation("Test question?");

      const questionCallback = mockRl.question.mock.calls[0][1];
      questionCallback("n");

      const result = await promise;

      expect(result).toBe(false);
    });
  });

  describe("showHelp method", () => {
    it("should display help information", () => {
      tool.showHelp();

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("parseArguments method", () => {
    beforeEach(() => {
      tool.showHelp = jest.fn();
      process.exit = jest.fn(); // Ensure it's a jest.fn, not a spy
      process.chdir = jest.fn();
    });

    it("should parse dry-run flag", () => {
      process.argv = ["node", "script.js", "--dry-run"];

      tool.parseArguments();

      expect(tool.dryRun).toBe(true);
    });

    it("should parse dry-run short flag", () => {
      process.argv = ["node", "script.js", "-n"];

      tool.parseArguments();

      expect(tool.dryRun).toBe(true);
    });

    it("should parse verbose flag", () => {
      process.argv = ["node", "script.js", "--verbose"];

      tool.parseArguments();

      expect(tool.verbose).toBe(true);
    });

    it("should parse verbose short flag", () => {
      process.argv = ["node", "script.js", "-v"];

      tool.parseArguments();

      expect(tool.verbose).toBe(true);
    });

    it("should parse untracked-only flag", () => {
      process.argv = ["node", "script.js", "--untracked-only"];

      tool.parseArguments();

      expect(tool.untrackedOnly).toBe(true);
    });

    it("should parse untracked-only flag with verbose", () => {
      process.argv = ["node", "script.js", "--untracked-only", "--verbose"];

      tool.parseArguments();

      expect(tool.untrackedOnly).toBe(true);
      expect(tool.verbose).toBe(true);
    });

    it("should parse count flag", () => {
      process.argv = ["node", "script.js", "--count"];

      tool.parseArguments();

      expect(tool.countOnly).toBe(true);
    });

    it("should parse count short flag", () => {
      process.argv = ["node", "script.js", "-c"];

      tool.parseArguments();

      expect(tool.countOnly).toBe(true);
    });

    it("should parse untracked-only short flag", () => {
      process.argv = ["node", "script.js", "-u"];

      tool.parseArguments();

      expect(tool.untrackedOnly).toBe(true);
    });

    it("should show version and return 0 for version flag", () => {
      process.argv = ["node", "script.js", "--version"];

      const result = tool.parseArguments();

      expect(console.log).toHaveBeenCalledWith(tool.version);
      expect(result).toBe(0);
    });

    it("should show version and return 0 for version short flag", () => {
      process.argv = ["node", "script.js", "-V"];

      const result = tool.parseArguments();

      expect(console.log).toHaveBeenCalledWith(tool.version);
      expect(result).toBe(0);
    });

    it("should show help and return undefined for help flag", () => {
      process.argv = ["node", "script.js", "--help"];

      const result = tool.parseArguments();

      expect(tool.showHelp).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should show help and return undefined for help short flag", () => {
      process.argv = ["node", "script.js", "-h"];

      const result = tool.parseArguments();

      expect(tool.showHelp).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should explicitly cover return for help", () => {
      process.argv = ["node", "script.js", "--help"];
      tool.showHelp = jest.fn();
      const result = tool.parseArguments();
      expect(tool.showHelp).toHaveBeenCalled();
      expect(result).toBe(0);
    });
    it("should explicitly cover return for -h", () => {
      process.argv = ["node", "script.js", "-h"];
      tool.showHelp = jest.fn();
      const result = tool.parseArguments();
      expect(tool.showHelp).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should handle unknown option", () => {
      process.argv = ["node", "script.js", "--unknown"];

      tool.parseArguments();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Unknown option: --unknown",
      );
      expect(tool.spinner.info).toHaveBeenCalledWith(
        "Use --help for usage information.",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should change directory if first argument is a directory", () => {
      process.argv = ["node", "script.js", "../some/dir", "--dry-run"];
      tool.parseArguments();
      expect(process.chdir).toHaveBeenCalledWith("../some/dir");
      expect(tool.dryRun).toBe(true);
    });

    it("should show error and exit if directory is invalid", () => {
      process.argv = ["node", "script.js", "/invalid/dir", "--dry-run"];
      process.chdir.mockImplementation(() => {
        throw new Error("fail");
      });
      tool.spinner.error = jest.fn();
      tool.parseArguments();
      expect(tool.spinner.error).toHaveBeenCalledWith(
        "Failed to change directory to: /invalid/dir",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should not call process.chdir if no directory argument is given", () => {
      process.argv = ["node", "script.js", "--dry-run"];
      tool.parseArguments();
      expect(process.chdir).not.toHaveBeenCalled();
      expect(tool.dryRun).toBe(true);
    });
  });

  describe("run method", () => {
    let originalCwd;
    beforeEach(() => {
      tool.parseArguments = jest.fn();
      tool.checkDependencies = jest.fn();
      tool.getCurrentBranch = jest.fn();
      tool.checkBranches = jest.fn();
      tool.displayResults = jest.fn();
      tool.deleteBranches = jest.fn();
      tool.spinner.log = jest.fn();
      originalCwd = process.cwd;
      process.cwd = jest.fn(() => "/mock/path");
    });

    afterEach(() => {
      process.cwd = originalCwd;
    });

    it("should run successfully", async () => {
      await tool.run();

      expect(tool.parseArguments).toHaveBeenCalled();
      expect(tool.checkDependencies).toHaveBeenCalled();
      expect(tool.getCurrentBranch).toHaveBeenCalled();
      expect(tool.checkBranches).toHaveBeenCalled();
      expect(tool.displayResults).toHaveBeenCalled();
      expect(tool.deleteBranches).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const error = new Error("Test error");
      tool.checkDependencies.mockRejectedValue(error);

      await tool.run();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "An error occurred: Test error",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should display the directory being scanned (default)", async () => {
      process.cwd = jest.fn(() => "/mock/path/to/repo");
      await tool.run();
      expect(tool.spinner.log).toHaveBeenCalledWith(
        `📂 Scanning repository: ${path.basename("/mock/path/to/repo")}`,
        "\x1b[34m",
      );
    });

    it("should display the directory being scanned (with directory argument)", async () => {
      process.cwd = jest.fn(() => "/another/path/ollama-git-commit");
      await tool.run();
      expect(tool.spinner.log).toHaveBeenCalledWith(
        `📂 Scanning repository: ${path.basename("/another/path/ollama-git-commit")}`,
        "\x1b[34m",
      );
    });

    it("should run in untracked-only mode", async () => {
      tool.untrackedOnly = true;
      tool.checkUntrackedBranches = jest.fn();

      await tool.run();

      expect(tool.checkUntrackedBranches).toHaveBeenCalled();
      expect(tool.checkBranches).not.toHaveBeenCalled();
    });

    it("should run in count-only mode and exit early", async () => {
      tool.countOnly = true;
      tool.countBranches = jest.fn();

      await tool.run();

      expect(tool.countBranches).toHaveBeenCalled();
      expect(tool.checkBranches).not.toHaveBeenCalled();
      expect(tool.displayResults).not.toHaveBeenCalled();
      expect(tool.deleteBranches).not.toHaveBeenCalled();
    });

    it("should exit early when parseArguments returns 0 (version flag)", async () => {
      tool.parseArguments.mockReturnValue(0);

      await tool.run();

      expect(tool.parseArguments).toHaveBeenCalled();
      expect(tool.checkDependencies).not.toHaveBeenCalled();
      expect(tool.getCurrentBranch).not.toHaveBeenCalled();
      expect(tool.checkBranches).not.toHaveBeenCalled();
      expect(tool.displayResults).not.toHaveBeenCalled();
      expect(tool.deleteBranches).not.toHaveBeenCalled();
    });

    it("should exit early when parseArguments returns 0 (help flag)", async () => {
      tool.parseArguments.mockReturnValue(0);

      await tool.run();

      expect(tool.parseArguments).toHaveBeenCalled();
      expect(tool.checkDependencies).not.toHaveBeenCalled();
      expect(tool.getCurrentBranch).not.toHaveBeenCalled();
      expect(tool.checkBranches).not.toHaveBeenCalled();
      expect(tool.displayResults).not.toHaveBeenCalled();
      expect(tool.deleteBranches).not.toHaveBeenCalled();
    });

    it("should handle errors from getCurrentBranch", async () => {
      const error = new Error("Branch error");
      tool.getCurrentBranch.mockRejectedValue(error);

      await tool.run();

      expect(tool.spinner.error).toHaveBeenCalledWith(
        "An error occurred: Branch error",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

// Test the main module execution
describe("Main module execution", () => {
  let originalRequireMain;

  beforeEach(() => {
    originalRequireMain = require.main;
    require.main = { filename: "test.js" };
  });

  afterEach(() => {
    require.main = originalRequireMain;
  });

  it("should not run when not main module", () => {
    const runSpy = jest.spyOn(GitCleanupTool.prototype, "run");

    // Re-require the module
    jest.resetModules();
    require("../src/index");

    expect(runSpy).not.toHaveBeenCalled();
  });
});
