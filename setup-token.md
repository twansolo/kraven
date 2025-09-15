# 🔑 GitHub Authentication Setup for Kraven

Kraven supports both **Personal Access Tokens (PAT)** and **OAuth tokens** for GitHub authentication.

## Authentication Methods

### 🔹 Personal Access Token (Recommended for Individual Use)
Best for personal projects and individual developers.

### 🔹 OAuth Token (Recommended for Enterprise/Apps)
Best for GitHub Apps, enterprise environments, and OAuth-based workflows.

---

## Method 1: Personal Access Token Setup

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

---

## Method 2: OAuth Token Setup

### When to Use OAuth Tokens

- **GitHub Apps**: Your application uses GitHub App authentication
- **Enterprise Environments**: Your organization uses OAuth-based authentication
- **CI/CD Pipelines**: Automated workflows with OAuth token management
- **Third-party Integration**: Integration with OAuth-based systems

### 1. Environment Variable Setup

#### Option A: Dedicated OAuth Token Variable
```bash
# Create or update your .env file
echo "GITHUB_OAUTH_TOKEN=your_oauth_token_here" >> .env
```

#### Option B: Generic Token with Type Specification
```bash
# Create or update your .env file
echo "GITHUB_TOKEN=your_oauth_token_here" >> .env
echo "GITHUB_TOKEN_TYPE=oauth" >> .env
```

### 2. Command Line Usage

#### Using OAuth Token via CLI
```bash
# Method 1: Specify OAuth token directly
kraven hunt --oauth-token "your_oauth_token_here" --language typescript

# Method 2: Specify token with type
kraven hunt --token "your_oauth_token_here" --token-type oauth --language typescript

# Method 3: Use environment variables (no CLI flags needed)
export GITHUB_OAUTH_TOKEN="your_oauth_token_here"
kraven hunt --language typescript
```

### 3. OAuth Token Examples

#### Hunt with OAuth Token
```bash
# Search using OAuth authentication
kraven hunt --oauth-token "gho_xxxxxxxxxxxxxxxxxxxx" --language javascript --include-private

# Organization scan with OAuth
kraven scan myorg --oauth-token "your_oauth_token" --include-private --max-repos 30
```

#### Rate Limit Check with OAuth
```bash
# Verify OAuth token is working
kraven rate-limit --oauth-token "your_oauth_token"
```

### 4. OAuth Token Auto-Detection

Kraven automatically detects OAuth tokens based on:
- **Token prefix**: Tokens starting with `gho_` are treated as OAuth
- **Token length**: Very long tokens (>100 characters) are treated as OAuth
- **Explicit type**: When `GITHUB_TOKEN_TYPE=oauth` is set

### 5. GitHub App Integration

For GitHub Apps, you can use installation access tokens:

```bash
# Example with GitHub App installation token
export GITHUB_OAUTH_TOKEN="ghs_xxxxxxxxxxxxxxxxxxxx"
kraven scan organization --include-private
```

---

## Authentication Comparison

| Feature | Personal Access Token | OAuth Token |
|---------|----------------------|-------------|
| **Setup Complexity** | Simple | Moderate |
| **Best For** | Individual developers | Apps & Enterprise |
| **Token Format** | `ghp_*`, `ghs_*`, `ghr_*` | `gho_*`, JWT-style |
| **Expiration** | User-defined | App-managed |
| **Rate Limits** | 5,000/hour | 5,000/hour |
| **Private Repos** | ✅ With `repo` scope | ✅ With appropriate permissions |
| **GitHub Apps** | ❌ Not applicable | ✅ Full support |

---

## Environment Variable Priority

Kraven checks for authentication in this order:

1. **Command-line options** (`--oauth-token`, `--token`)
2. **GITHUB_OAUTH_TOKEN** environment variable
3. **GITHUB_TOKEN** with `GITHUB_TOKEN_TYPE=oauth`
4. **GITHUB_TOKEN** (treated as PAT)

---

## Troubleshooting OAuth Tokens

### OAuth Token Not Working?
1. **Check token format**: OAuth tokens usually start with `gho_` or are very long
2. **Verify permissions**: Ensure the OAuth token has required scopes
3. **Test authentication**: Run `kraven rate-limit --oauth-token "your_token"`
4. **Check expiration**: OAuth tokens may expire based on app configuration

### Common OAuth Issues
```bash
# Issue: Token treated as PAT instead of OAuth
# Solution: Explicitly specify token type
kraven hunt --token "your_token" --token-type oauth

# Issue: Permission denied for private repos
# Solution: Verify OAuth app has proper permissions
kraven hunt --oauth-token "your_token" --include-private

# Issue: Rate limiting problems
# Solution: Check token is properly authenticated
kraven rate-limit --oauth-token "your_token"
```

### GitHub App Token Example
```bash
# For GitHub App installation tokens
export GITHUB_OAUTH_TOKEN="v1.1f699f..."  # Installation access token
kraven scan myorg --include-private --max-repos 50
```

---

Once set up, you can run unlimited searches and analyses with Kraven using either authentication method! 🕷️
