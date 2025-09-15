# 🔑 GitHub Token Setup for Kraven

## Quick Setup Steps

### 1. Create GitHub Personal Access Token

1. **Go to GitHub Settings**: https://github.com/settings/tokens
2. **Click "Generate new token"** → **"Generate new token (classic)"**
3. **Token Name**: `Kraven Hunter` (or any name you prefer)
4. **Expiration**: Select `90 days` (recommended)
5. **Scopes**: Choose based on your needs:
   - **For public repositories only**: Check `public_repo`
   - **For private repositories**: Check `repo` (full repository access)
6. **Click "Generate token"**
7. **Copy the token** (you won't be able to see it again!)

### 2. Create .env File

Create a new file called `.env` in the `kraven` directory with this content:

```env
# GitHub Personal Access Token for Kraven
# This increases your rate limit from 60 to 5000 requests per hour
GITHUB_TOKEN=your_actual_token_here
```

**Important**: Replace `your_actual_token_here` with the token you copied from GitHub.

### 3. Test Your Setup

Run this command to verify your token is working:

```bash
npm run dev -- rate-limit
```

**Expected output with token**:
```
📊 GitHub API Rate Limit Status:
Remaining: X/5000
```

**Without token**:
```
📊 GitHub API Rate Limit Status:
Remaining: X/60
```

## Benefits of Using a Token

| Feature | Without Token | With `public_repo` | With `repo` |
|---------|---------------|-------------------|-------------|
| **Rate Limit** | 60 requests/hour | 5,000 requests/hour | 5,000 requests/hour |
| **Search Results** | Limited | Full public access | Full access |
| **Reliability** | May hit limits quickly | Stable for heavy usage | Stable for heavy usage |
| **Private Repos** | No access | No access | ✅ Full access |
| **Organization Private Repos** | No access | No access | ✅ Full access |

## Security Notes

- ✅ The `.env` file is automatically ignored by git (won't be committed)
- ✅ Use minimal required permissions (`public_repo` for public repos, `repo` for private)
- ✅ Token can be revoked anytime at https://github.com/settings/tokens
- ⚠️ Never share your token or commit it to version control
- ⚠️ `repo` scope grants full repository access - use only when needed for private repos

## Troubleshooting

### Token Not Working?
1. Check the `.env` file is in the correct directory (`kraven/.env`)
2. Ensure no spaces around the `=` sign
3. Verify the token hasn't expired
4. Make sure you selected the correct scope:
   - `public_repo` for public repositories
   - `repo` for private repository access

### Still Getting Rate Limited?
1. Check if the token is being loaded: `npm run dev -- rate-limit`
2. Restart your terminal after creating the `.env` file
3. Verify the token format (should start with `ghp_` or similar)

## Example .env File

```env
# GitHub Personal Access Token for Kraven
GITHUB_TOKEN=ghp_1234567890abcdef1234567890abcdef12345678
```

## Using Private Repository Features

Once you have a token with `repo` scope, you can scan private repositories:

### Hunt Private Repositories
```bash
kraven hunt --language typescript --include-private
```

### Scan Organization Private Repositories
```bash
kraven scan your-org --include-private --max-repos 20
```

### Scan Multiple Organizations (including private repos)
```bash
kraven scan-multi "org1,org2,org3" --include-private
```

**Note**: Private repository access only works for repositories you have access to (owned by you or organizations you're a member of).

Once set up, you can run unlimited searches and analyses with Kraven! 🕷️
