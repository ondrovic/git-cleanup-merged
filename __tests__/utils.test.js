const { execSync } = require("child_process");
const clearTerminal = require("../src/utils");

jest.mock("child_process");

describe("clearTerminal", () => {
  let originalPlatform;

  beforeEach(() => {
    originalPlatform = process.platform;
    // Mock process.stdout.write to prevent it from actually writing to the console during tests
    jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore the original platform and mocks
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
    jest.restoreAllMocks();
  });

  it("should use cls command on win32 platform", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    clearTerminal();
    expect(execSync).toHaveBeenCalledWith("cls", { stdio: "inherit" });
  });

  it("should use escape codes on win32 when cls fails", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    // Simulate execSync throwing an error
    execSync.mockImplementation(() => {
      throw new Error("command failed");
    });
    clearTerminal();
    // Expect the fallback escape codes to be used
    expect(process.stdout.write).toHaveBeenCalledWith("\x1B[2J\x1B[0f\x1B[3J");
  });

  it("should use escape codes on non-win32 platforms (e.g., linux)", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });
    clearTerminal();
    // No call to execSync should be made
    expect(execSync).not.toHaveBeenCalled();
    // Expect the escape codes to be used
    expect(process.stdout.write).toHaveBeenCalledWith("\x1B[2J\x1B[0f\x1B[3J");
  });
});
