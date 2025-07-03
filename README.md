# Git Cleanup Merged

[![CI](https://github.com/ondrovic/git-cleanup-merged/actions/workflows/ci.yml/badge.svg)](https://github.com/ondrovic/git-cleanup-merged/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ondrovic/git-cleanup-merged/graph/badge.svg?token=x3cYga3d2E)](https://codecov.io/gh/ondrovic/git-cleanup-merged)

A Node.js command-line tool that automatically identifies and deletes local Git branches that have been merged via GitHub Pull Requests.

---

## 🧪 Testing & Quality Assurance

- [![CI](https://github.com/ondrovic/git-cleanup-merged/actions/workflows/ci.yml/badge.svg)](https://github.com/ondrovic/git-cleanup-merged/actions/workflows/ci.yml) **CI runs on all pull requests and on push to `main`/`master` only** via GitHub Actions (tests Node.js 18.x, 20.x)
  - This avoids duplicate runs for feature branches and is the recommended best practice for open source projects.
- [![codecov](https://codecov.io/gh/ondrovic/git-cleanup-merged/graph/badge.svg?token=x3cYga3d2E)](https://codecov.io/gh/ondrovic/git-cleanup-merged) **Live coverage tracking** via Codecov
- 🚦 **Branch coverage threshold:** CI will fail if branch coverage drops below 75%
- 📝 **JUnit test results and coverage are uploaded to Codecov for every CI run**
- 🧪 **Run tests locally:**
  ```bash
  npm test
  npm run test:coverage
  ```
- 📈 **Check coverage report:**
  After running `npm run test:coverage`, open `coverage/lcov-report/index.html` in your browser for a detailed report.
- 🔍 **Code quality:** ESLint and Prettier configured for consistent code style

---

## ✨ Features

- 🔍 **Smart Detection**: Automatically checks GitHub PR status for all local branches
- ✅ **Safe Deletion**: Only deletes branches with merged PRs
- 🔒 **Protection**: Never deletes `main`, `master`, or your current branch
- 👀 **Preview Mode**: Dry-run option to see what would be deleted
- 📂 **Directory Support**: Operate on any git repo by passing a directory as the first argument
- 🎨 **Colorful Output**: Clear visual indicators with icons and colors
- 📊 **Status Overview**: Shows comprehensive branch status table
- ⚡ **Interactive Spinner**: Real-time progress updates with animated spinner
- 🛡️ **Comprehensive Testing**: 100% test coverage with 76 test cases and live coverage tracking
- 🎯 **Code Quality**: ESLint and Prettier for consistent code style

## Prerequisites

Before installing, make sure you have:

- **Node.js** (version 18 or higher - tested on 18.x and 20.x)
- **Git** installed and configured
- **GitHub CLI** (`gh`) installed and authenticated
- Active internet connection for GitHub API calls

### Installing GitHub CLI

If you don't have GitHub CLI installed:

**macOS (Homebrew):**

```bash
brew install gh
```

**Windows (Chocolatey):**

```bash
choco install gh
```

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

**Authenticate GitHub CLI:**

```bash
gh auth login
```

## Installation

### Option 1: Global Installation via NPM

```bash
# Install globally from npm (if published)
npm install -g git-cleanup-merged

# Or install globally from GitHub
npm install -g https://github.com/ondro/git-cleanup-merged.git
```

### Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/ondro/git-cleanup-merged.git
cd git-cleanup-merged

# Install dependencies
npm install

# Make executable (Unix/macOS/Linux)
chmod +x index.js

# Create symlink for global access (optional)
npm link
```

### Option 3: Direct Download

```bash
# Download the script directly
curl -o git-cleanup-merged https://raw.githubusercontent.com/ondro/git-cleanup-merged/main/index.js
chmod +x git-cleanup-merged

# Move to your PATH
sudo mv git-cleanup-merged /usr/local/bin/
```

### Option 4: Using npx (No Installation)

```bash
# Run directly without installing
npx git-cleanup-merged

# Or from GitHub
npx https://github.com/ondro/git-cleanup-merged.git
```

## Usage

### Basic Usage

> **Note:** At the start of every run, the tool will display the name of the repository directory being scanned (e.g. 'git-local-branch-cleanup' or 'ollama-git-commit'), so you always know which directory is being operated on.

```bash
# Clean up merged branches (with confirmation)
git-cleanup-merged

# Clean up merged branches in a different directory
git-cleanup-merged ../path/to/repo

# Preview what would be deleted (dry run)
git-cleanup-merged --dry-run

# Show detailed processing information
git-cleanup-merged --verbose

# Combine options
git-cleanup-merged ../path/to/repo --dry-run --verbose
```

### Command Line Options

| Option        | Short | Description                                                                          |
| ------------- | ----- | ------------------------------------------------------------------------------------ |
| `[DIRECTORY]` |       | Path to a git repository to operate on. Defaults to the current directory if omitted |
| `--dry-run`   | `-n`  | Show what would be deleted without actually deleting                                 |
| `--verbose`   | `-v`  | Show detailed information during processing                                          |
| `--help`      | `-h`  | Show help message                                                                    |

### Example Output

```
⠋ Checking dependencies...
✅ Dependencies checked
✅ Current branch: main
⠸ Checking branch 3/5: feature/user-authentication
✅ Finished checking 5 branches

────────────────────────────────────────────────────────────
Branch                                   Icon   Status
────────────────────────────────────────────────────────────
feature/user-authentication              ✅     Merged
bugfix/header-layout                     ✅     Merged
feature/dark-mode                        ⏳     Open
hotfix/critical-bug                      ❌     No PR
────────────────────────────────────────────────────────────

❌ The following branches have merged PRs and will be deleted:
  feature/user-authentication
  bugfix/header-layout

Proceed with deletion? (y/N): y

⠋ Deleting branch 1/2: feature/user-authentication
⠙ Deleting branch 2/2: bugfix/header-layout
✅ Successfully deleted 2 branches
```

## How It Works

1. **Dependency Check**: Verifies you're in a Git repository and GitHub CLI is installed/authenticated
2. **Current Branch Detection**: Identifies and protects your current working branch
3. **Branch Discovery**: Lists all local branches (excluding `main`, `master`, current branch)
4. **PR Status Check**: Queries GitHub API for each branch's PR status with progress indication
5. **Results Display**: Shows a comprehensive status table with clear visual indicators
6. **Safe Deletion**: Only deletes branches with merged PRs (with user confirmation)

## Branch Status Indicators

| Icon | Status | Description                                            |
| ---- | ------ | ------------------------------------------------------ |
| ✅   | Merged | PR has been merged - branch is safe to delete          |
| ⏳   | Open   | PR is still open - branch will be preserved            |
| ❌   | No PR  | No PR found for this branch - branch will be preserved |

## Safety Features

- **Protected Branches**: Never touches `main`, `master`, or your current branch
- **Confirmation Required**: Always asks before deleting (unless in dry-run mode)
- **GitHub Verification**: Only deletes branches with confirmed merged PRs
- **Error Handling**: Graceful failure handling with informative messages
- **Progress Feedback**: Real-time spinner shows current operation status

## Troubleshooting

### Common Issues

**"Not in a git repository"**

- Make sure you're running the command from within a Git repository

**"GitHub CLI (gh) is not installed"**

- Install GitHub CLI following the prerequisites section above

**"GitHub CLI is not authenticated"**

- Run `gh auth login` and follow the authentication process

**"Failed to get current branch"**

- Ensure you're in a valid Git repository with at least one commit

**Branch names appearing garbled in terminal**

- This was a known issue with the spinner display that has been fixed in recent versions

### Debug Mode

For troubleshooting, use verbose mode to see detailed processing:

```bash
git-cleanup-merged --verbose --dry-run
```

## Development

### Project Structure

```
git-cleanup-merged/
├── __tests__/              # Test files
│   ├── index.test.js       # Main functionality tests
│   ├── spinner.test.js     # Spinner component tests
│   └── utils.test.js       # Utility function tests
├── coverage/               # Coverage reports (generated)

├── src/
│   ├── bin.js              # CLI entry point
│   ├── index.js            # Main GitCleanupTool class
│   └── utils/
│       ├── index.js        # Utility functions
│       └── spinner.js      # Spinner component
├── package.json
├── package-lock.json
├── eslint.config.mjs      # ESLint configuration
├── .prettierrc            # Prettier configuration
└── README.md
```

### Key Components

- **GitCleanupTool**: Main class that orchestrates the cleanup process
- **Spinner**: Enhanced spinner class with proper terminal handling and testability
- **CLI Entry Point**: Separate `bin.js` file for clean CLI execution
- **Test Suite**: Comprehensive tests covering all functionality and edge cases

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both `--dry-run` and actual deletion
5. Submit a pull request

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Run linting with auto-fix
npm run lint -- --fix

# Format code
npm run format
```

## License

MIT License - see LICENSE file for details.

## 📋 Changelog

### v1.2.1

- 🔧 **Node.js Compatibility**: Updated to require Node.js 18+ for ESLint 9.x compatibility
- 🧪 **CI Updates**: Removed Node.js 16.x from CI matrix (reached end-of-life)
- 📦 **Dependencies**: Updated to use modern ESLint flat config format
- 🚦 **Workflow Optimization**: CI now only runs on pull requests and on push to `main`/`master` to avoid duplicate runs for feature branches

### v1.2.0

- 🎯 **100% Test Coverage**: Achieved complete test coverage across all code paths
- 🧪 **Enhanced Test Suite**: Added 76 comprehensive test cases covering all functionality
- 🔧 **Code Quality**: Added ESLint and Prettier for consistent code style
- 🏗️ **Architecture Improvements**: Separated CLI entry point for better testability
- 🐛 **Bug Fixes**: Fixed spinner component and improved error handling
- 📊 **Coverage Thresholds**: Set minimum 75% branch coverage requirement

### v1.1.0

- Fixed spinner display issue where branch names would merge together
- Improved terminal output clearing with proper ANSI escape sequences
- Enhanced progress indicators during branch checking and deletion
- Added directory argument support for operating on different repositories

### v1.0.0

- Initial release
- Basic branch cleanup functionality
- GitHub PR integration
- Dry-run mode
- Verbose logging
- Interactive spinner with progress feedback

## 🤝 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/ondro/git-cleanup-merged/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/ondro/git-cleanup-merged/discussions)
- 📧 **Contact**: ondrovic@gmail.com
- 📚 **Documentation**: This README contains comprehensive usage examples and troubleshooting

---

**⚠️ Important**: Always run with `--dry-run` first to preview changes before actual deletion. This tool is designed to be safe, but you should always verify the branches it wants to delete.
