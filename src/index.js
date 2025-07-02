#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const clearTerminal = require('./utils');

// Colors for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Enhanced spinner with consistent logging
class Spinner {
    constructor(message = 'Loading...') {
        this.message = message;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.current = 0;
        this.interval = null;
        this.isSpinning = false;
    }

    start() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        process.stdout.write('\x1b[?25l'); // Hide cursor
        
        this.interval = setInterval(() => {
            // Clear the entire line before writing new content
            process.stdout.write(`\r\x1b[K${colors.blue}${this.frames[this.current]} ${this.message}${colors.reset}`);
            this.current = (this.current + 1) % this.frames.length;
        }, 100);
    }

    stop() {
        if (!this.isSpinning) return;
        
        this.isSpinning = false;
        clearInterval(this.interval);
        process.stdout.write('\r\x1b[K'); // Clear line
        process.stdout.write('\x1b[?25h'); // Show cursor
    }

    updateMessage(message) {
        this.message = message;
    }

    // Logging methods that handle spinner state
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

    // Log without stopping spinner (for static output)
    log(message, color = '') {
        console.log(`${color}${message}${colors.reset}`);
    }
}

class GitCleanupTool {
    constructor() {
        this.dryRun = false;
        this.verbose = false;
        this.branchesToDelete = [];
        this.prResults = [];
        this.currentBranch = '';
        this.spinner = new Spinner();
    }

    // Helper method for minimum spinner visibility
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async execCommand(command, options = {}) {
        try {
            const result = execSync(command, { 
                encoding: 'utf8', 
                stdio: options.silent ? 'pipe' : 'inherit',
                ...options 
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
        this.spinner.updateMessage('Checking dependencies...');
        this.spinner.start();
        
        // Check if we're in a git repository
        try {
            await this.execCommand('git rev-parse --git-dir', { silent: true });
            await this.sleep(300); // Minimum spinner time
        } catch (error) {
            this.spinner.error('Not in a git repository');
            process.exit(1);
        }

        this.spinner.updateMessage('Checking GitHub CLI...');
        // Check for GitHub CLI
        try {
            await this.execCommand('gh --version', { silent: true });
            await this.sleep(200);
        } catch (error) {
            this.spinner.error('GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/');
            process.exit(1);
        }

        this.spinner.updateMessage('Verifying GitHub authentication...');
        // Check GitHub CLI authentication
        try {
            await this.execCommand('gh auth status', { silent: true });
            await this.sleep(200);
        } catch (error) {
            this.spinner.error('GitHub CLI is not authenticated. Run: gh auth login');
            process.exit(1);
        }

        this.spinner.success('Dependencies checked');
    }

    async getCurrentBranch() {
        this.spinner.updateMessage('Getting current branch...');
        this.spinner.start();
        
        try {
            this.currentBranch = await this.execCommand('git branch --show-current', { silent: true });
            await this.sleep(200); // Let the spinner show
            this.spinner.success(`Current branch: ${this.currentBranch}`);
        } catch (error) {
            this.spinner.error('Failed to get current branch');
            process.exit(1);
        }
    }

    async getLocalBranches() {
        try {
            const branches = await this.execCommand(
                'git for-each-ref --format="%(refname:short)" refs/heads/',
                { silent: true }
            );
            
            return branches
                .split('\n')
                .filter(branch => branch.trim() !== '')
                .filter(branch => !['main', 'master', this.currentBranch].includes(branch.trim()))
                .map(branch => branch.trim());
        } catch (error) {
            this.spinner.error('Failed to get local branches');
            return [];
        }
    }

    async getPRStatus(branch) {
        try {
            const result = await this.execCommand(
                `gh pr view "${branch}" --json state --jq .state`,
                { silent: true }
            );
            return result;
        } catch (error) {
            return null;
        }
    }

    async checkBranches() {
        this.spinner.updateMessage('Fetching local branches...');
        this.spinner.start();
        
        const branches = await this.getLocalBranches();
        
        if (branches.length === 0) {
            this.spinner.warning('No local branches to check.');
            return;
        }

        this.spinner.updateMessage(`Checking ${branches.length} branches against GitHub...`);

        // Process each branch
        for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            this.spinner.updateMessage(`Checking branch ${i + 1}/${branches.length}: ${branch}`);
            
            const prStatus = await this.getPRStatus(branch);
            
            // Only call debug if verbose is enabled to avoid stopping spinner
            if (this.verbose) {
                this.spinner.debug(`Checking branch ${branch} -> PR state: ${prStatus || 'unknown'}`, this.verbose);
                // Restart spinner after debug output
                this.spinner.updateMessage(`Checking branch ${i + 1}/${branches.length}: ${branch}`);
                this.spinner.start();
            }

            let icon, label;
            switch (prStatus) {
                case 'MERGED':
                    icon = '✅';
                    label = 'Merged';
                    this.branchesToDelete.push(branch);
                    break;
                case 'OPEN':
                    icon = '⏳';
                    label = 'Open';
                    break;
                default:
                    icon = '❌';
                    label = 'No PR';
                    break;
            }

            this.prResults.push({ branch, icon, label });
            
            // Add a small delay so we can see the spinner working
            await this.sleep(300);
        }

        this.spinner.success(`Finished checking ${branches.length} branches`);
        console.log(''); // Empty line for spacing
    }

    displayResults() {
        this.spinner.log('─'.repeat(60));
        this.spinner.log(`${'Branch'.padEnd(40)} ${'Icon'.padEnd(6)} ${'Status'.padEnd(10)}`);
        this.spinner.log('─'.repeat(60));
        
        this.prResults.forEach(({ branch, icon, label }) => {
            this.spinner.log(`${branch.padEnd(40)} ${icon.padEnd(6)} ${label.padEnd(10)}`);
        });
        
        this.spinner.log('─'.repeat(60));
    }

    async deleteBranches() {
        if (this.branchesToDelete.length === 0) {
            this.spinner.warning('No branches with merged PRs found.');
            return;
        }

        console.log(''); // Empty line for spacing
        if (this.dryRun) {
            this.spinner.warning('DRY RUN — branches eligible for deletion:');
        } else {
            this.spinner.error('The following branches have merged PRs and will be deleted:');
        }

        // List branches without icons since the spinner methods handle them
        this.branchesToDelete.forEach(branch => {
            this.spinner.log(`  ${branch}`, colors.red);
        });

        if (this.dryRun) {
            this.spinner.info('Run without --dry-run to actually delete them.');
            return;
        }

        const confirmed = await this.askConfirmation('Proceed with deletion? (y/N): ');
        
        if (confirmed) {
            console.log(''); // Empty line for spacing
            
            let deletedCount = 0;
            let failedBranches = [];
            
            for (let i = 0; i < this.branchesToDelete.length; i++) {
                const branch = this.branchesToDelete[i];
                this.spinner.updateMessage(`Deleting branch ${i + 1}/${this.branchesToDelete.length}: ${branch}`);
                this.spinner.start();
                
                try {
                    await this.execCommand(`git branch -d "${branch}"`, { silent: true });
                    deletedCount++;
                    // Brief pause to show progress (and let user see the spinner!)
                    await this.sleep(400);
                } catch (error) {
                    failedBranches.push(branch);
                }
            }
            
            // Final status
            if (failedBranches.length === 0) {
                this.spinner.success(`Successfully deleted ${deletedCount} branches`);
            } else {
                this.spinner.warning(`Deleted ${deletedCount} branches, ${failedBranches.length} failed`);
                failedBranches.forEach(branch => {
                    this.spinner.log(`  Failed: ${branch}`, colors.red);
                });
            }
        } else {
            this.spinner.info('Cancelled.');
        }
    }

    async askConfirmation(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }

    showHelp() {
        console.log(`
${colors.bold}git-cleanup-merged${colors.reset} - Clean up merged Git branches

${colors.bold}USAGE:${colors.reset}
    git-cleanup-merged [OPTIONS]

${colors.bold}OPTIONS:${colors.reset}
    -n, --dry-run     Show what would be deleted without actually deleting
    -v, --verbose     Show detailed information during processing
    -h, --help        Show this help message

${colors.bold}DESCRIPTION:${colors.reset}
    This tool checks your local Git branches against GitHub PRs to find
    branches that have been merged and are safe to delete locally.

${colors.bold}REQUIREMENTS:${colors.reset}
    - Git repository
    - GitHub CLI (gh) installed and authenticated
    - Internet connection to check GitHub PR status

${colors.bold}EXAMPLES:${colors.reset}
    git-cleanup-merged                    # Clean up merged branches
    git-cleanup-merged --dry-run          # Preview what would be deleted
    git-cleanup-merged --verbose          # Show detailed processing info
        `);
    }

    parseArguments() {
        const args = process.argv.slice(2);
        
        for (const arg of args) {
            switch (arg) {
                case '--dry-run':
                case '-n':
                    this.dryRun = true;
                    break;
                case '--verbose':
                case '-v':
                    this.verbose = true;
                    break;
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
                default:
                    this.spinner.error(`Unknown option: ${arg}`);
                    this.spinner.info('Use --help for usage information.');
                    process.exit(1);
            }
        }
    }

    async run() {
        clearTerminal();
        try {
            this.parseArguments();
            await this.checkDependencies();
            await this.getCurrentBranch();
            await this.checkBranches();
            this.displayResults();
            await this.deleteBranches();
        } catch (error) {
            this.spinner.error(`An error occurred: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run the tool
if (require.main === module) {
    const tool = new GitCleanupTool();
    tool.run();
}

module.exports = GitCleanupTool;