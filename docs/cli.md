---
layout: default
title: "CLI Tool"
description: "Command-line interface for hunting abandoned GitHub projects"
---

# 🖥️ Kraven CLI Tool

The Kraven command-line interface provides powerful tools for discovering and analyzing abandoned GitHub repositories directly from your terminal.

## 🚀 Installation

### Global Installation
```bash
npm install -g kraven
```

### Direct Usage (No Installation)
```bash
npx kraven hunt --language typescript --min-stars 100
```

## 📖 Usage

### Basic Commands

#### Hunt for Projects
```bash
# Basic search
kraven hunt --language typescript --min-stars 100

# Advanced search with multiple filters
kraven hunt --language javascript --category cli-tool --min-stars 50 --max-stars 1000 --pushed-before 2022-01-01

# Export results to JSON
kraven hunt --language python --output json > results.json
```

#### Analyze Specific Repository
```bash
# Analyze a specific repository
kraven analyze facebook/react

# Generate markdown report
kraven analyze microsoft/vscode --output markdown > analysis.md
```

#### Check API Status
```bash
# Check GitHub API rate limit
kraven rate-limit
```

### Command Options

#### Hunt Command
```bash
kraven hunt [options]

Options:
  -l, --language <language>     Programming language (e.g., typescript, javascript)
  -c, --category <category>     Project category (cli-tool, build-tool, dev-tool, etc.)
  --min-stars <number>          Minimum star count
  --max-stars <number>          Maximum star count
  --pushed-before <date>        Last push before date (YYYY-MM-DD)
  --pushed-after <date>         Last push after date (YYYY-MM-DD)
  --sort <field>                Sort by: stars, updated, created
  --order <direction>           Sort order: asc, desc
  --limit <number>              Maximum results to analyze (default: 10)
  --output <format>             Output format: table, json, markdown
```

#### Analyze Command
```bash
kraven analyze <repository> [options]

Arguments:
  repository                    Repository in format "owner/repo"

Options:
  --output <format>             Output format: table, json, markdown
```

## 🔑 GitHub Token Setup

For higher rate limits (5000 vs 60 requests/hour), set up a GitHub token:

### 1. Create Token
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select `public_repo` scope
4. Copy the token

### 2. Configure Token
```bash
# Create .env file in your project directory
echo "GITHUB_TOKEN=your_token_here" > .env

# Or set environment variable
export GITHUB_TOKEN=your_token_here
```

## 📊 Output Formats

### Table Format (Default)
```
Repository                              Stars   Abandon   Revival   Last Commit    Status
──────────────────────────────────────────────────────────────────────────────────────────
facebook/react                         220k    0%        90%       2d ago         ❌ SKIP
vuejs/vue                              207k    65%       90%       338d ago       ⚠️  MAYBE
angular/angular                        93k     0%        85%       1d ago         ❌ SKIP
```

### JSON Format
```json
{
  "query": "language:typescript stars:>100",
  "totalFound": 1580,
  "analyzed": [
    {
      "repository": {
        "full_name": "microsoft/vscode",
        "stargazers_count": 160000,
        "description": "Visual Studio Code"
      },
      "abandonmentScore": 0,
      "revivalPotential": 95,
      "lastCommitAge": 1,
      "reasons": [],
      "recommendations": ["Active project - not abandoned"]
    }
  ]
}
```

### Markdown Format
```markdown
# 🕷️ Repository Analysis: microsoft/vscode

[View on GitHub](https://github.com/microsoft/vscode)

**Description:** Visual Studio Code

## 📊 Metrics
| Metric | Value |
|--------|-------|
| Stars | 160000 |
| Forks | 28000 |
| Open Issues | 5000 |
```

## 🎯 Examples

### Find Abandoned CLI Tools
```bash
kraven hunt --category cli-tool --min-stars 100 --pushed-before 2022-01-01
```

### Search TypeScript Projects
```bash
kraven hunt --language typescript --min-stars 500 --max-stars 5000
```

### Export Analysis Results
```bash
# Hunt and export to JSON
kraven hunt --language javascript --output json > js-projects.json

# Analyze specific repo and export to markdown
kraven analyze facebook/react --output markdown > react-analysis.md
```

### Batch Analysis
```bash
# Analyze multiple repositories
kraven analyze facebook/react --output json > react.json
kraven analyze vuejs/vue --output json > vue.json
kraven analyze angular/angular --output json > angular.json
```

## 🔧 Configuration

### Project-specific Configuration
Create a `.kravenrc.json` file in your project:

```json
{
  "defaultFilters": {
    "language": "typescript",
    "minStars": 100,
    "category": "cli-tool"
  },
  "outputFormat": "json",
  "maxResults": 20
}
```

### Global Configuration
```bash
# Set global defaults
kraven config set language typescript
kraven config set minStars 100
kraven config set outputFormat json
```

## 🚀 Advanced Usage

### Scripting and Automation
```bash
#!/bin/bash
# Hunt for abandoned projects and analyze top candidates

echo "Hunting for abandoned TypeScript CLI tools..."
kraven hunt --language typescript --category cli-tool --min-stars 100 --output json > results.json

echo "Analyzing top candidates..."
cat results.json | jq -r '.analyzed[] | select(.revivalPotential > 70) | .repository.full_name' | while read repo; do
  echo "Analyzing $repo..."
  kraven analyze "$repo" --output markdown > "analysis-$(echo $repo | tr '/' '-').md"
done
```

### Integration with Other Tools
```bash
# Combine with jq for JSON processing
kraven hunt --language typescript --output json | jq '.analyzed[0].repository.full_name'

# Use with grep for filtering
kraven hunt --language javascript | grep "PRIME"

# Pipe to file for later analysis
kraven hunt --language python --min-stars 1000 > python-projects.txt
```

## 🛠️ Development

### Building from Source
```bash
git clone https://github.com/twansolo/kraven.git
cd kraven
npm install
npm run build
npm link
```

### Running Tests
```bash
npm test
```

### Contributing
See [CONTRIBUTING.md]({{ site.github.repository_url }}/blob/main/CONTRIBUTING.md) for guidelines.

## 📚 Related

- [Web Interface]({{ '/' | relative_url }}) - Browser-based project hunting
- [Documentation]({{ '/docs/' | relative_url }}) - Complete documentation
- [Examples]({{ '/examples/' | relative_url }}) - Usage examples and tutorials
- [GitHub Repository]({{ site.github.repository_url }}) - Source code and issues
