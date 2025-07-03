// Mock process.stdout before requiring the module
const mockStdout = {
  write: jest.fn(),
};

const mockProcess = {
  stdout: mockStdout,
  platform: "win32",
};

global.process = mockProcess;

// Mock console
const mockConsole = {
  log: jest.fn(),
};
global.console = mockConsole;

// Mock setInterval and clearInterval
const mockSetInterval = jest.fn();
const mockClearInterval = jest.fn();
global.setInterval = mockSetInterval;
global.clearInterval = mockClearInterval;

// Mock setTimeout
const mockSetTimeout = jest.fn((callback, delay) => {
  setTimeout(() => callback(), delay);
  return "timeout-id";
});
global.setTimeout = mockSetTimeout;

const Spinner = require("../src/utils/spinner");

let writeSpy, setIntervalSpy, clearIntervalSpy;

describe("Spinner class", () => {
  let spinner;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation((cb) => {
        // Save the callback for manual invocation
        setIntervalSpy._cb = cb;
        return "mock-interval-id";
      });
    clearIntervalSpy = jest
      .spyOn(global, "clearInterval")
      .mockImplementation(() => {});
    mockConsole.log.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    writeSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  describe("constructor", () => {
    it("should create spinner with default message", () => {
      spinner = new Spinner();
      expect(spinner.message).toBe("Loading...");
      expect(spinner.frames).toEqual([
        "⠋",
        "⠙",
        "⠹",
        "⠸",
        "⠼",
        "⠴",
        "⠦",
        "⠧",
        "⠇",
        "⠏",
      ]);
      expect(spinner.current).toBe(0);
      expect(spinner.interval).toBeNull();
      expect(spinner.isSpinning).toBe(false);
    });

    it("should create spinner with custom message", () => {
      spinner = new Spinner("Custom message");
      expect(spinner.message).toBe("Custom message");
    });
  });

  describe("start method", () => {
    beforeEach(() => {
      spinner = new Spinner("Test message");
    });

    it("should start spinning", () => {
      spinner.start();

      expect(spinner.isSpinning).toBe(true);
      expect(writeSpy).toHaveBeenCalledWith("\x1b[?25l"); // Hide cursor
      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it("should not start if already spinning", () => {
      spinner.isSpinning = true;
      spinner.start();

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("should set up interval with correct callback", () => {
      spinner.start();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      // Get the callback function
      const intervalCallback = setIntervalSpy.mock.calls[0][0];

      // Call the callback to test it
      intervalCallback();

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining("⠋ Test message"),
      );
    });

    it("should cycle through frames", () => {
      spinner.start();
      const intervalCallback = setIntervalSpy.mock.calls[0][0];

      // Call callback multiple times to test frame cycling
      intervalCallback(); // Should use frame 0
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("⠋"));

      intervalCallback(); // Should use frame 1
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("⠙"));

      // Test cycling back to first frame
      for (let i = 0; i < 10; i++) {
        intervalCallback();
      }
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("⠋"));
    });
  });

  describe("stop method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.interval = "mock-interval-id";
    });

    it("should stop spinning when active", () => {
      spinner.isSpinning = true;
      spinner.stop();

      expect(spinner.isSpinning).toBe(false);
      expect(clearIntervalSpy).toHaveBeenCalledWith("mock-interval-id");
      expect(spinner.interval).toBeNull();
      expect(writeSpy).toHaveBeenCalledWith("\r\x1b[K"); // Clear line
      expect(writeSpy).toHaveBeenCalledWith("\x1b[?25h"); // Show cursor
    });

    it("should not stop if not spinning", () => {
      spinner.isSpinning = false;
      spinner.stop();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe("updateMessage method", () => {
    beforeEach(() => {
      spinner = new Spinner("Old message");
    });

    it("should update the message", () => {
      spinner.updateMessage("New message");
      expect(spinner.message).toBe("New message");
    });
  });

  describe("success method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.stop = jest.fn();
    });

    it("should stop spinner and log success message", () => {
      spinner.success("Success message");

      expect(spinner.stop).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[32m✅ Success message\x1b[0m",
      );
    });
  });

  describe("error method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.stop = jest.fn();
    });

    it("should stop spinner and log error message", () => {
      spinner.error("Error message");

      expect(spinner.stop).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[31m❌ Error message\x1b[0m",
      );
    });
  });

  describe("warning method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.stop = jest.fn();
    });

    it("should stop spinner and log warning message", () => {
      spinner.warning("Warning message");

      expect(spinner.stop).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[33m⚠️  Warning message\x1b[0m",
      );
    });
  });

  describe("info method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.stop = jest.fn();
    });

    it("should stop spinner and log info message", () => {
      spinner.info("Info message");

      expect(spinner.stop).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[34mℹ️  Info message\x1b[0m",
      );
    });
  });

  describe("debug method", () => {
    beforeEach(() => {
      spinner = new Spinner();
      spinner.stop = jest.fn();
    });

    it("should not log when verbose is false", () => {
      spinner.debug("Debug message", false);

      expect(spinner.stop).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should stop spinner and log debug message when verbose is true", () => {
      spinner.debug("Debug message", true);

      expect(spinner.stop).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[34m🔍 DEBUG: Debug message\x1b[0m",
      );
    });

    it("should not log when verbose is undefined", () => {
      spinner.debug("Debug message");

      expect(spinner.stop).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe("log method", () => {
    beforeEach(() => {
      spinner = new Spinner();
    });

    it("should log message without color", () => {
      spinner.log("Test message");

      expect(mockConsole.log).toHaveBeenCalledWith("Test message\x1b[0m");
    });

    it("should log message with color", () => {
      spinner.log("Test message", "\x1b[32m");

      expect(mockConsole.log).toHaveBeenCalledWith(
        "\x1b[32mTest message\x1b[0m",
      );
    });
  });

  describe("integration tests", () => {
    beforeEach(() => {
      spinner = new Spinner("Integration test");
    });

    it("should handle start and stop cycle", () => {
      spinner.start();
      expect(spinner.isSpinning).toBe(true);
      expect(setIntervalSpy).toHaveBeenCalled();

      spinner.stop();
      expect(spinner.isSpinning).toBe(false);
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should handle multiple start calls", () => {
      spinner.start();
      spinner.start(); // Second call should be ignored

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple stop calls", () => {
      spinner.start();
      spinner.stop();
      spinner.stop(); // Second call should be ignored

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });
});
