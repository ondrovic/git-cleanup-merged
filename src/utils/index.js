const { execSync } = require('child_process');

function clearTerminal() {
    // Clear screen and scroll-back buffer on all platforms
    if (process.platform === 'win32') {
        // Windows: Use cls command and clear scroll-back
        try {
            execSync('cls', { stdio: 'inherit' });
        } catch (error) {
            // Fallback for Windows
            process.stdout.write('\x1B[2J\x1B[0f\x1B[3J');
        }
    } else {
        // Unix-like systems (macOS, Linux): Clear screen and scroll-back
        process.stdout.write('\x1B[2J\x1B[0f\x1B[3J');
    }
        
    // Additional reset for cursor position
    process.stdout.write('\x1B[H');
}

module.exports = clearTerminal;