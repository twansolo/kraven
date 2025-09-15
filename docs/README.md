# 🕷️ Kraven Web Interface

A clean, static HTML interface for Kraven - the abandoned GitHub project hunter.

## 🚀 Quick Start

### Option 1: Using Node.js (Recommended)
```bash
# From the docs directory
npx http-server . -p 8080 -c-1
```

### Option 2: Using Python
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

### Option 3: Using any other static server
Any static file server will work. Just serve the `docs` directory.

## 🌐 Access

Once the server is running, open your browser to:
```
http://localhost:8080
```

## ✨ Features

- **🔍 Project Hunt**: Search for abandoned repositories with advanced filters
- **🍴 Fork Analysis**: Compare and analyze repository forks with visual charts
- **📊 Visual Analytics**: Beautiful charts showing activity and dependency health
- **💾 Export Data**: Download results as JSON for further analysis
- **📱 Responsive Design**: Works on desktop, tablet, and mobile

## 🛠️ Development

The static site consists of:

- `index.html` - Main page with all functionality
- `css/style.css` - All styling and responsive design
- `js/app.js` - Main application logic and UI interactions
- `js/fork-analyzer.js` - Fork analysis functionality
- `js/github-api.js` - GitHub API wrapper

## 🔧 Configuration

### GitHub Token (Recommended)

For higher API rate limits (5000 requests/hour vs 60), create a GitHub personal access token:

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Create a new token with `public_repo` scope
3. Enter the token in any of the GitHub Token fields in the web interface

The token is stored locally in your browser and synced across all forms.

## 📊 Usage Examples

### Hunt for Abandoned Projects
1. Click "Hunt Projects" tab
2. Select language (e.g., TypeScript)
3. Set minimum stars (e.g., 100)
4. Set "Last Updated Before" to 2 years ago
5. Click "Start Hunting"

### Analyze Repository Forks
1. Click "Analyze Forks" tab
2. Enter repository (e.g., `bower/bower`)
3. Configure analysis settings
4. Click "Analyze Forks"
5. View beautiful charts and recommendations

## 🎨 Design

- **Dark Theme**: Developer-friendly dark interface
- **Modern UI**: Clean, professional design with smooth animations
- **Visual Charts**: Interactive charts using Chart.js
- **Responsive**: Adapts to all screen sizes
- **Accessible**: Keyboard navigation and screen reader friendly

## 🚀 Deployment

To deploy this static site:

1. **GitHub Pages**: Push to a `gh-pages` branch
2. **Netlify**: Drag and drop the `docs` folder
3. **Vercel**: Connect your GitHub repository
4. **Any CDN**: Upload files to any static hosting service

## 🔗 Related

- [Kraven CLI Tool](../README.md) - Command-line interface
- [npm Package](https://www.npmjs.com/package/kraven) - Install globally
- [GitHub Repository](https://github.com/twansolo/kraven) - Source code

---

Built with ❤️ for the open source community. No frameworks, no build steps, just clean HTML, CSS, and JavaScript.
