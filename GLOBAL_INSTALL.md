# 🌍 Kraven Global Installation Guide

## ✅ Installation Complete!

Kraven is now installed globally and available as the `kraven` command from any directory on your system.

## 🚀 Usage Examples

### From Any Directory

```bash
# Hunt for abandoned TypeScript projects from your home directory
cd ~
kraven hunt --language typescript --min-stars 100 --limit 5

# Analyze a repository from any location
cd /path/to/any/directory
kraven analyze facebook/create-react-app

# Check rate limits from anywhere
kraven rate-limit
```

### Quick Commands

```bash
# Find prime revival candidates
kraven hunt --language javascript --min-stars 500 --pushed-before 2022-01-01

# Search for CLI tools specifically  
kraven hunt --category cli-tool --min-stars 100 --max-stars 1000

# Export results to JSON
kraven hunt --language typescript --output json > ~/abandoned-repos.json

# Generate markdown report
kraven analyze owner/repo --output markdown > ~/analysis.md
```

## 📁 Configuration

The global `kraven` command automatically loads your GitHub token from multiple locations:

1. **Current directory** - Checks for `.env` in the current working directory first
2. **Kraven installation** - Automatically falls back to `C:\Users\ejord\Developer\kraven\.env`

### ✅ Global Token (Recommended - Already Working!)
Your token in `C:\Users\ejord\Developer\kraven\.env` is automatically loaded from any directory:
```bash
# Works from anywhere - token automatically loaded
cd C:\
kraven hunt --language typescript

cd ~/Documents  
kraven analyze facebook/react

# Your token is always found automatically! 🎉
```

### Option: Project-specific tokens
You can also create local `.env` files to override the global token:
```bash
cd ~/my-project
echo "GITHUB_TOKEN=different_token_here" > .env
kraven hunt --language typescript  # Uses local token
```

## 🛠️ Management Commands

### Update Kraven
```bash
cd C:\Users\ejord\Developer\kraven
git pull  # if you have it in version control
npm run build
# No need to run npm link again - it's already linked
```

### Uninstall Global Command
```bash
npm unlink kraven
# or
npm uninstall -g kraven
```

### Reinstall Global Command
```bash
cd C:\Users\ejord\Developer\kraven
npm link
```

### Check Installation
```bash
# Verify global installation
kraven --version
kraven --help

# Check which kraven is being used
where kraven  # On Windows
which kraven  # On Linux/Mac
```

## 🔧 Troubleshooting

### Command Not Found
If `kraven` command is not found:
1. Restart your terminal
2. Check if npm's global bin directory is in your PATH
3. Re-run `npm link` from the kraven directory

### Environment Variables Not Loading
The dotenv messages you see are normal. They indicate:
- `injecting env (0) from .env` - Looking for .env file (0 variables loaded if no token)
- The tips are just suggestions from the dotenv library

### Permission Issues
If you get permission errors:
1. Run PowerShell as Administrator
2. Or use `npm config set prefix` to change the global directory

## 🎯 Pro Tips

### Create Aliases (Optional)
Add these to your PowerShell profile for even faster access:

```powershell
# Add to $PROFILE (Microsoft.PowerShell_profile.ps1)
function kh { kraven hunt $args }
function ka { kraven analyze $args }
function kr { kraven rate-limit }

# Usage:
# kh --language typescript --min-stars 100
# ka facebook/react
# kr
```

### Batch Processing
```bash
# Hunt and save results
kraven hunt --language javascript --output json > js-abandoned.json
kraven hunt --language typescript --output json > ts-abandoned.json

# Analyze multiple repos
kraven analyze facebook/react --output markdown > react-analysis.md
kraven analyze vuejs/vue --output markdown > vue-analysis.md
```

### Integration with Other Tools
```bash
# Combine with jq for JSON processing
kraven hunt --language typescript --output json | jq '.analyzed[0].repository.full_name'

# Use with grep for filtering
kraven hunt --language javascript | grep "PRIME"
```

## 🏆 You're Ready to Hunt!

Kraven is now globally installed and ready to help you discover amazing abandoned projects to revive. Start hunting from any directory on your system! 🕷️

### Next Steps:
1. Add your GitHub token to get 5000 requests/hour
2. Start with broad searches and narrow down
3. Use the analyze command for detailed repository insights
4. Export results for further processing

Happy hunting! 🎯
