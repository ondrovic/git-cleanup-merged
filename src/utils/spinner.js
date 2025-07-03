const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class Spinner {
  constructor(message = "Loading...") {
    this.message = message;
    this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.current = 0;
    this.interval = null;
    this.isSpinning = false;
  }

  start() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    process.stdout.write("\x1b[?25l"); // Hide cursor
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r\x1b[K${colors.blue}${this.frames[this.current]} ${this.message}${colors.reset}`,
      );
      this.current = (this.current + 1) % this.frames.length;
    }, 100);
  }

  stop() {
    if (!this.isSpinning) return;
    this.isSpinning = false;
    clearInterval(this.interval);
    this.interval = null;
    process.stdout.write("\r\x1b[K"); // Clear line
    process.stdout.write("\x1b[?25h"); // Show cursor
  }

  updateMessage(message) {
    this.message = message;
  }

  success(message) {
    this.stop();
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
  }

  error(message) {
    this.stop();
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
  }

  warning(message) {
    this.stop();
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
  }

  info(message) {
    this.stop();
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
  }

  debug(message, verbose = false) {
    if (!verbose) return;
    this.stop();
    console.log(`${colors.blue}🔍 DEBUG: ${message}${colors.reset}`);
  }

  log(message, color = "") {
    console.log(`${color}${message}${colors.reset}`);
  }
}

module.exports = Spinner;
