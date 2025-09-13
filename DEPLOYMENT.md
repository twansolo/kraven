# 🚀 Kraven GitHub Pages Deployment Guide

## Quick Setup

### 1. Create GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `kraven` (or your preferred name)
3. **Description**: `🕷️ Hunt abandoned GitHub repositories ripe for revival`
4. **Visibility**: Public (required for GitHub Pages)
5. **Initialize**: Don't initialize (we already have files)
6. **Click "Create repository"**

### 2. Connect Local Repository to GitHub

```bash
# Add GitHub remote (replace 'twansolo' with your GitHub username)
git remote add origin https://github.com/twansolo/kraven.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. **Go to your repository** on GitHub
2. **Click "Settings"** tab
3. **Scroll to "Pages"** in the left sidebar
4. **Source**: Deploy from a branch
5. **Branch**: `main` (or `master`)
6. **Folder**: `/docs`
7. **Click "Save"**

### 4. Access Your Site

Your Kraven web interface will be available at:
```
https://twansolo.github.io/kraven/
```

## Configuration Steps

### Update Repository URLs

1. **Edit `docs/index.html`**:
   - Update footer links to point to your repository
   - Replace `twansolo` with your GitHub username

2. **Edit `docs/_config.yml`**:
   - Update `url` and `baseurl` with your GitHub username

### Custom Domain (Optional)

If you want a custom domain like `kraven.yourdomain.com`:

1. **Add CNAME file**:
   ```bash
   echo "kraven.yourdomain.com" > docs/CNAME
   ```

2. **Configure DNS**:
   - Add CNAME record: `kraven` → `twansolo.github.io`

3. **Update GitHub Pages settings**:
   - Go to Settings → Pages
   - Enter your custom domain
   - Enable "Enforce HTTPS"

## Features of the Web Interface

### 🔍 **Search Capabilities**
- **Language filtering**: JavaScript, TypeScript, Python, etc.
- **Category filtering**: CLI tools, build tools, frameworks, etc.
- **Star range filtering**: Find projects in specific popularity ranges
- **Date filtering**: Search by last update date
- **GitHub token support**: Higher rate limits (5000 vs 60 requests/hour)

### 📊 **Analysis Results**
- **Abandonment scoring**: 0-100% abandonment likelihood
- **Revival potential**: 0-100% revival feasibility
- **Community metrics**: Engagement and activity levels
- **Technical assessment**: Complexity and market relevance
- **Actionable insights**: Specific reasons and recommendations

### 🎯 **Status Classifications**
- **🎯 PRIME**: High abandonment + High revival potential
- **⚠️ MAYBE**: Moderate scores, worth investigating
- **❌ SKIP**: Low revival potential or still active

### 💾 **Export Features**
- **JSON export**: Download results for further analysis
- **Sorting options**: Sort by revival potential or other metrics
- **Responsive design**: Works on desktop, tablet, and mobile

## Customization Options

### Branding
- Update colors in `docs/css/style.css`
- Change the spider emoji and title
- Modify the hero section messaging

### Functionality
- Adjust analysis scoring in `docs/js/github-api.js`
- Add new search categories
- Implement additional export formats

### Analytics (Optional)
Add Google Analytics to track usage:

```html
<!-- Add to docs/index.html before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Maintenance

### Updating the Site
```bash
# Make changes to files in docs/
git add docs/
git commit -m "Update web interface"
git push origin main
```

Changes will be live within a few minutes.

### Monitoring
- **GitHub Pages status**: Repository Settings → Pages
- **Build logs**: Actions tab (if builds fail)
- **Analytics**: Google Analytics or GitHub Insights

## Troubleshooting

### Site Not Loading
1. Check GitHub Pages is enabled in Settings
2. Verify source is set to `/docs` folder
3. Ensure `index.html` exists in `docs/` directory
4. Check for build errors in Actions tab

### API Rate Limiting
1. Encourage users to add GitHub tokens
2. Consider implementing request caching
3. Add rate limit warnings in the UI

### CORS Issues
GitHub Pages serves static files, so no CORS issues with GitHub API.
All API calls are made client-side from the user's browser.

## Security Notes

- ✅ **Client-side only**: No server-side code, no security vulnerabilities
- ✅ **Token storage**: Tokens stored in localStorage (user's browser only)
- ✅ **No data collection**: No user data sent to external services
- ✅ **GitHub API**: Direct calls to GitHub's official API

## Success Metrics

Track these metrics to measure success:
- **Page views**: How many people visit the site
- **Search usage**: How many searches are performed
- **Token adoption**: How many users add GitHub tokens
- **Export usage**: How many people download results
- **Repository stars**: Growth of the Kraven project itself

## Next Steps

1. **Deploy the site** following the steps above
2. **Share the URL** with the developer community
3. **Gather feedback** and iterate on features
4. **Monitor usage** and optimize performance
5. **Add new features** based on user requests

Your Kraven web interface will help developers worldwide discover amazing abandoned projects to revive! 🕷️✨
