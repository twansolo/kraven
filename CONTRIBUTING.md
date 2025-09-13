# 🤝 Contributing to Kraven

Thank you for your interest in contributing to Kraven! This document provides guidelines and information for contributors.

## 🎯 Ways to Contribute

### 🐛 **Bug Reports**
- Use the [issue tracker](https://github.com/yourusername/kraven/issues)
- Search existing issues before creating new ones
- Include steps to reproduce, expected vs actual behavior
- Add relevant system information (OS, Node.js version, etc.)

### 💡 **Feature Requests**
- Start with [GitHub Discussions](https://github.com/yourusername/kraven/discussions)
- Describe the problem you're trying to solve
- Explain why this feature would be valuable
- Consider implementation complexity and scope

### 🔧 **Code Contributions**
- Fork the repository
- Create a feature branch (`git checkout -b feature/amazing-feature`)
- Make your changes with tests
- Follow the coding standards
- Submit a pull request

## 🛠️ **Development Setup**

### Prerequisites
- Node.js 16+ and npm
- Git
- TypeScript knowledge
- GitHub account

### Local Setup
```bash
# Clone your fork
git clone https://github.com/yourusername/kraven.git
cd kraven

# Install dependencies
npm install

# Build the project
npm run build

# Link for global testing
npm link

# Run tests (when available)
npm test
```

### Project Structure
```
kraven/
├── src/                 # TypeScript source code
│   ├── types/          # Type definitions
│   ├── services/       # Core services (GitHub API, analyzer)
│   ├── cli.ts          # CLI interface
│   └── kraven.ts       # Main application logic
├── docs/               # GitHub Pages web interface
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   └── index.html     # Main web page
├── dist/              # Compiled JavaScript (generated)
└── examples.md        # Usage examples
```

## 📝 **Coding Standards**

### TypeScript
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow existing code style and patterns

### Code Style
```typescript
// Good
interface RepositoryAnalysis {
  repository: GitHubRepository;
  abandonmentScore: number;
  revivalPotential: number;
}

// Use async/await over promises
async function analyzeRepository(repo: GitHubRepository): Promise<RepositoryAnalysis> {
  const analysis = await this.performAnalysis(repo);
  return analysis;
}
```

### Commit Messages
Follow conventional commits:
```
feat: add new search filter for repository size
fix: resolve rate limiting issue in GitHub API client
docs: update installation instructions
style: improve responsive design for mobile devices
refactor: extract analysis logic into separate service
test: add unit tests for repository analyzer
```

## 🧪 **Testing Guidelines**

### Test Structure (Future)
- Unit tests for core logic
- Integration tests for GitHub API
- E2E tests for CLI commands
- Visual regression tests for web interface

### Test Commands
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:e2e      # End-to-end tests
npm run test:watch    # Watch mode for development
```

## 🌐 **Web Interface Contributions**

### Frontend Guidelines
- Maintain responsive design (mobile-first)
- Follow existing dark theme and color scheme
- Ensure accessibility (ARIA labels, keyboard navigation)
- Test across different browsers and devices
- Optimize for performance (minimize API calls)

### CSS/JavaScript
- Use vanilla JavaScript (no frameworks)
- Follow existing naming conventions
- Add comments for complex logic
- Ensure cross-browser compatibility

## 📚 **Documentation**

### What to Document
- New features and their usage
- API changes and breaking changes
- Configuration options
- Troubleshooting guides
- Examples and tutorials

### Documentation Style
- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Update relevant README sections
- Maintain consistency with existing docs

## 🚀 **Pull Request Process**

### Before Submitting
1. **Test thoroughly** - Ensure your changes work as expected
2. **Update documentation** - Add/update relevant docs
3. **Check code style** - Follow project conventions
4. **Rebase if needed** - Keep a clean commit history
5. **Write good description** - Explain what and why

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process
1. **Automated checks** must pass (linting, building)
2. **Manual review** by maintainers
3. **Testing** in different environments
4. **Approval** and merge by maintainers

## 🏷️ **Issue Labels**

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested
- `wontfix` - This will not be worked on

## 🎖️ **Recognition**

Contributors will be:
- Listed in the README contributors section
- Mentioned in release notes for significant contributions
- Given credit in commit messages and PR descriptions
- Invited to join the core team for exceptional contributions

## 📞 **Getting Help**

- **GitHub Discussions**: For questions and ideas
- **Issues**: For bugs and feature requests
- **Email**: For security issues or private matters
- **Discord/Slack**: Community chat (if available)

## 📋 **Code of Conduct**

### Our Standards
- **Be respectful** and inclusive
- **Be constructive** in feedback
- **Be patient** with newcomers
- **Be collaborative** and helpful
- **Be professional** in all interactions

### Enforcement
Violations of the code of conduct may result in:
1. Warning and guidance
2. Temporary ban from project spaces
3. Permanent ban for severe or repeated violations

## 🎯 **Contribution Ideas**

### For Beginners
- Fix typos in documentation
- Add examples to README
- Improve error messages
- Add unit tests for existing functions
- Update dependencies

### For Experienced Developers
- Implement new search filters
- Add machine learning scoring
- Create browser extension
- Build API service
- Optimize performance

### For Designers
- Improve web interface UI/UX
- Create project logo and branding
- Design mobile app mockups
- Improve accessibility
- Create promotional materials

## 🙏 **Thank You**

Every contribution, no matter how small, helps make Kraven better for everyone. Thank you for taking the time to contribute to this project!

---

*Happy contributing! 🕷️*
