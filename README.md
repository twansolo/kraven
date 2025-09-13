# 🕷️ Kraven - The Abandoned Project Hunter

Kraven is a TypeScript CLI tool designed to hunt down abandoned GitHub repositories that are ripe for revival. It analyzes repositories to identify projects that:

- Have good potential but are no longer maintained
- Solve real problems that still exist today
- Have active user communities asking for updates
- Are technically feasible to revive and maintain

## 🎯 Features

- **Smart Repository Discovery**: Search GitHub using advanced filters
- **Abandonment Analysis**: Detect signs of project abandonment
- **Revival Potential Scoring**: Rank repositories by their revival potential
- **Detailed Reports**: Get comprehensive analysis of each repository
- **CLI Interface**: Easy-to-use command-line interface

## 🚀 Installation

```bash
npm install -g kraven
```

## 📖 Usage

### Basic Search
```bash
kraven hunt --language typescript --stars ">100"
```

### Advanced Search with Filters
```bash
kraven hunt --language javascript --category "cli-tool" --min-stars 50 --max-stars 1000
```

### Analyze Specific Repository
```bash
kraven analyze owner/repository-name
```

### Generate Report
```bash
kraven report --format json --output results.json
```

## 🔍 Search Categories

- `cli-tool` - Command-line interfaces and tools
- `build-tool` - Build systems and bundlers
- `dev-tool` - Developer utilities and helpers
- `testing` - Testing frameworks and utilities
- `linter` - Code quality and linting tools
- `framework` - Web frameworks and libraries

## 📊 Scoring Criteria

Kraven evaluates repositories based on:

- **Activity**: Last commit date, issue response time
- **Community**: Stars, forks, open issues, user engagement
- **Technical Health**: Dependencies, test coverage, documentation
- **Revival Feasibility**: Code complexity, maintainer availability
- **Market Relevance**: Current demand, technology relevance

## 🛠️ Development

```bash
# Clone and setup
git clone https://github.com/yourusername/kraven.git
cd kraven
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

---

*"With great power comes great responsibility... to revive abandoned code."* 🕷️
