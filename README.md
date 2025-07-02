# Git Cleanup Merged

A Node.js command-line tool that automatically identifies and deletes local Git branches that have been merged via GitHub Pull Requests.

## Features

- 🔍 **Smart Detection**: Automatically checks GitHub PR status for all local branches
- ✅ **Safe Deletion**: Only deletes branches with merged PRs
- 🔒 **Protection**: Never deletes `main`, `master`, or your current branch
- 👀 **Preview Mode**: Dry-run option to see what would be deleted
- 🎨 **Colorful Output**: Clear visual indicators with icons and colors
- 📊 **Status Overview**: Shows comprehensive branch status table
- ⚡ **Interactive Spinner**: Real-time progress updates with animated spinner

## Prerequisites

Before installing, make sure you have:

- **Node.js** (version 14 or higher)
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
npm install -g https://github.com/yourusername/git-cleanup-merged.git
```

### Option 2: Local Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/git-cleanup-merged.git
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
curl -o git-cleanup-merged https://raw.githubusercontent.com/yourusername/git-cleanup-merged/main/index.js
chmod +x git-cleanup-merged

# Move to your PATH  
sudo mv git-cleanup-merged /usr/local/bin/
```

### Option 4: Using npx (No Installation)

```bash
# Run directly without installing
npx git-cleanup-merged

# Or from GitHub
npx https://github.com/yourusername/git-cleanup-merged.git
```

## Usage

### Basic Usage

```bash
# Clean up merged branches (with confirmation)
git-cleanup-merged

# Preview what would be deleted (dry run)
git-cleanup-merged --dry-run

# Show detailed processing information
git-cleanup-merged --verbose

# Combine options
git-cleanup-merged --dry-run --verbose
```

### Command Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--dry-run` | `-n` | Show what would be deleted without actually deleting |
| `--verbose` | `-v` | Show detailed information during processing |
| `--help` | `-h` | Show help message |

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

| Icon | Status | Description |
|------|--------|-------------|
| ✅ | Merged | PR has been merged - branch is safe to delete |
| ⏳ | Open | PR is still open - branch will be preserved |
| ❌ | No PR | No PR found for this branch - branch will be preserved |

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
├── package-lock.json
├── package.json
├── README.md
└── src
    ├── index.js
    └── utils
        └── index.js
```

### Key Components

- **GitCleanupTool**: Main class that orchestrates the cleanup process
- **Spinner**: Enhanced spinner class with proper terminal handling
- **clearTerminal**: Utility function for terminal clearing

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both `--dry-run` and actual deletion
5. Submit a pull request

### Running Tests

```bash
npm test
```

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.1.0
- Fixed spinner display issue where branch names would merge together
- Improved terminal output clearing with proper ANSI escape sequences
- Enhanced progress indicators during branch checking and deletion

### v1.0.0
- Initial release
- Basic branch cleanup functionality
- GitHub PR integration
- Dry-run mode
- Verbose logging
- Interactive spinner with progress feedback

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/ondrovic/git-cleanup-merged/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/ondrovic/git-cleanup-merged/discussions)
- 📧 **Contact**: ondrovic@gmail.com

---

**⚠️ Important**: Always run with `--dry-run` first to preview changes before actual deletion. This tool is designed to be safe, but you should always verify the branches it wants to delete.
