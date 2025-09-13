# 🔑 GitHub Token Setup for Kraven

## Quick Setup Steps

### 1. Create GitHub Personal Access Token

1. **Go to GitHub Settings**: https://github.com/settings/tokens
2. **Click "Generate new token"** → **"Generate new token (classic)"**
3. **Token Name**: `Kraven Hunter` (or any name you prefer)
4. **Expiration**: Select `90 days` (recommended)
5. **Scopes**: Check `public_repo` (allows access to public repositories)
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

| Feature | Without Token | With Token |
|---------|---------------|------------|
| **Rate Limit** | 60 requests/hour | 5,000 requests/hour |
| **Search Results** | Limited | Full access |
| **Reliability** | May hit limits quickly | Stable for heavy usage |
| **Private Repos** | No access | Access to your private repos |

## Security Notes

- ✅ The `.env` file is automatically ignored by git (won't be committed)
- ✅ Only requires `public_repo` scope (minimal permissions)
- ✅ Token can be revoked anytime at https://github.com/settings/tokens
- ⚠️ Never share your token or commit it to version control

## Troubleshooting

### Token Not Working?
1. Check the `.env` file is in the correct directory (`kraven/.env`)
2. Ensure no spaces around the `=` sign
3. Verify the token hasn't expired
4. Make sure you selected the `public_repo` scope

### Still Getting Rate Limited?
1. Check if the token is being loaded: `npm run dev -- rate-limit`
2. Restart your terminal after creating the `.env` file
3. Verify the token format (should start with `ghp_` or similar)

## Example .env File

```env
# GitHub Personal Access Token for Kraven
GITHUB_TOKEN=ghp_1234567890abcdef1234567890abcdef12345678
```

Once set up, you can run unlimited searches and analyses with Kraven! 🕷️
