# 🕷️ Kraven Usage Examples

## Basic Hunting

### Search for abandoned TypeScript projects
```bash
kraven hunt --language typescript --min-stars 100 --pushed-before 2022-01-01
```

### Find abandoned CLI tools
```bash
kraven hunt --category cli-tool --min-stars 50 --max-stars 1000 --pushed-before 2023-01-01
```

### Search JavaScript build tools
```bash
kraven hunt --language javascript --category build-tool --min-stars 200
```

## Advanced Searches

### Find projects with active issues but no maintenance
```bash
kraven hunt --language typescript --min-stars 100 --pushed-before 2021-01-01 --limit 10
```

### Search for specific time ranges
```bash
kraven hunt --language javascript --pushed-after 2020-01-01 --pushed-before 2022-01-01
```

## Analysis Commands

### Analyze specific repository
```bash
kraven analyze facebook/create-react-app
kraven analyze microsoft/vscode
```

### Generate markdown report
```bash
kraven analyze owner/repo --output markdown > analysis.md
```

### Export JSON data
```bash
kraven hunt --language typescript --output json > results.json
```

## Fork Analysis Commands

### Analyze forks of abandoned repository
```bash
kraven forks bower/bower --max-forks 10 --min-stars 5
```

### Compare forks with different criteria
```bash
kraven forks angular/angular.js --max-forks 20 --sort activity
kraven forks jquery/jquery-ui --sort health --output markdown
```

### Find most active fork
```bash
kraven forks facebook/create-react-app --sort stars --max-forks 15
```

## Machine Learning Commands

### Train ML models for enhanced scoring
```bash
kraven train --sample-size 100 --popular-repos
```

### Train with custom repository list
```bash
kraven train --repositories my-repos.txt
```

### Check ML model status
```bash
kraven ml-info
```

### Use ML-enhanced hunting
```bash
kraven hunt --language typescript --ml-enhanced --ml-confidence 0.8
```

### ML-enhanced analysis
```bash
kraven analyze microsoft/typescript --ml-enhanced
```

## Organization & User Scanning

### Scan entire organization with tech debt analysis
```bash
kraven scan microsoft --max-repos 20 --min-stars 100
```

### Generate comprehensive tech debt report
```bash
kraven scan netflix --max-repos 50 --min-stars 200 --output markdown > netflix-tech-debt-report.md
```

### Scan user repositories
```bash
kraven scan torvalds --max-repos 10 --exclude-forks
```

### Focus on high-risk repositories
```bash
kraven scan uber --max-repos 30 --min-stars 50 --pushed-before 2022-01-01
```

### Multi-organization comparison
```bash
kraven scan-multi microsoft,google,facebook --max-repos 15
```

### Language-specific organization scan
```bash
kraven scan netflix --languages javascript,typescript --max-repos 25
```

## Private Repository Scanning

### Prerequisites for Private Repository Access

**⚠️ Important**: Private repository scanning requires a GitHub token with `repo` scope instead of just `public_repo`.

### Authentication Methods Supported

Kraven supports both **Personal Access Tokens (PAT)** and **OAuth tokens**:

- **Personal Access Token**: `--token` or `GITHUB_TOKEN` environment variable
- **OAuth Token**: `--oauth-token` or `GITHUB_OAUTH_TOKEN` environment variable

#### Update Your Token Scope
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Delete your existing "Kraven Hunter" token
3. Create a new token with **`repo`** scope (full repository access)
4. Update your `.env` file with the new token

#### Verify Private Access
```bash
# Check if your token has the right permissions
kraven rate-limit

# Test private repository access
kraven hunt --language javascript --include-private --limit 1
```

### Private Repository Hunt Commands

#### Hunt Private Repositories by Language
```bash
# Search your private TypeScript repositories
kraven hunt --language typescript --include-private --min-stars 1

# Find abandoned private JavaScript projects
kraven hunt --language javascript --include-private --pushed-before 2022-01-01
```

#### Hunt Private Projects by Category
```bash
# Find private CLI tools
kraven hunt --category cli-tool --include-private --limit 5

# Search private development tools
kraven hunt --category dev-tool --include-private --min-stars 0
```

#### Advanced Private Repository Searches
```bash
# Find recently abandoned private projects
kraven hunt --include-private --pushed-before 2023-06-01 --min-stars 0 --limit 10

# Search private repos with specific star range
kraven hunt --include-private --min-stars 1 --max-stars 50 --language python
```

### Private Organization Scanning

#### Scan Your Organization's Private Repositories
```bash
# Comprehensive private repo scan
kraven scan your-org --include-private --max-repos 20

# Focus on private repos with tech debt analysis
kraven scan your-company --include-private --max-repos 30 --min-stars 0
```

#### Private Repository Tech Debt Analysis
```bash
# Get detailed tech debt metrics for private repos
kraven scan your-org --include-private --output markdown > private-tech-debt-report.md

# Focus on high-risk private repositories
kraven scan your-org --include-private --pushed-before 2022-01-01 --max-repos 25
```

#### Multi-Organization Private Scanning
```bash
# Scan multiple organizations including private repos
kraven scan-multi "org1,org2,personal-account" --include-private --max-repos 15

# Compare private repo health across organizations
kraven scan-multi "company-a,company-b" --include-private --min-stars 0
```

### Private Repository Analysis

#### Analyze Specific Private Repositories
```bash
# Deep analysis of private repository
kraven analyze your-org/private-repo --ml-enhanced

# Generate private repo report
kraven analyze your-company/internal-tool --output markdown > private-analysis.md
```

#### Private Fork Analysis
```bash
# Analyze forks of private repository (if accessible)
kraven forks your-org/private-project --max-forks 10 --min-stars 0
```

### Private Repository Examples by Use Case

#### Internal Tool Maintenance
```bash
# Find abandoned internal tools
kraven scan your-org --include-private --category cli-tool --pushed-before 2022-01-01

# Assess internal development tools
kraven scan your-org --include-private --category dev-tool --max-repos 20
```

#### Security and Compliance Auditing
```bash
# Security-focused private repo scan
kraven scan your-org --include-private --output json > security-audit.json

# Compliance risk assessment
kraven scan your-org --include-private --max-repos 50 --output markdown
```

#### Team Productivity Analysis
```bash
# Analyze team repositories for tech debt
kraven scan your-team --include-private --languages javascript,typescript --max-repos 15

# Get productivity impact metrics
kraven scan your-org --include-private --min-stars 0 --exclude-forks
```

### Private Repository Best Practices

#### Planning Repository Revival
```bash
# Identify prime candidates for internal revival
kraven hunt --include-private --ml-enhanced --ml-confidence 0.7 --limit 10

# Focus on high-value private projects
kraven hunt --include-private --min-stars 5 --pushed-before 2023-01-01
```

#### Resource Planning
```bash
# Get time estimates for private repo maintenance
kraven scan your-org --include-private --max-repos 30 --output table

# Cost analysis for private repository maintenance
kraven scan your-org --include-private --output markdown > cost-analysis.md
```

### Security Notes for Private Repository Scanning

- **Token Security**: The `repo` scope grants full access to all your repositories
- **Access Scope**: Only scans private repositories you have access to
- **Rate Limits**: Same 5000 requests/hour limit applies
- **Audit Trail**: GitHub logs all API access for security monitoring

### Common Private Repository Scenarios

#### Startup/Small Company
```bash
# Scan all company repositories
kraven scan startup-company --include-private --max-repos 50 --min-stars 0

# Focus on critical internal tools
kraven scan startup-company --include-private --category cli-tool
```

#### Enterprise Organization
```bash
# Department-level analysis
kraven scan enterprise-dept --include-private --max-repos 100 --languages java,python

# Cross-team comparison
kraven scan-multi "team-a,team-b,team-c" --include-private --max-repos 20
```

#### Personal/Freelance Projects
```bash
# Personal project maintenance planning
kraven scan your-username --include-private --max-repos 25 --min-stars 0

# Client project analysis
kraven scan client-org --include-private --exclude-forks --max-repos 15
```

## OAuth Token Examples

### Using OAuth Tokens with CLI

#### Environment Variable Method
```bash
# Set OAuth token in environment
export GITHUB_OAUTH_TOKEN="gho_xxxxxxxxxxxxxxxxxxxx"

# Use all commands normally
kraven hunt --language typescript --include-private
kraven scan myorg --include-private --max-repos 20
```

#### Command Line Method
```bash
# Hunt with OAuth token
kraven hunt --oauth-token "gho_xxxxxxxxxxxxxxxxxxxx" --language javascript --include-private

# Organization scan with OAuth
kraven scan myorg --oauth-token "your_oauth_token" --include-private --max-repos 30

# Analysis with OAuth
kraven analyze myorg/private-repo --oauth-token "your_oauth_token" --ml-enhanced
```

#### Mixed Token Types
```bash
# Explicitly specify OAuth token type
kraven hunt --token "your_oauth_token" --token-type oauth --language python

# Auto-detection (tokens starting with gho_ are detected as OAuth)
kraven scan myorg --token "gho_xxxxxxxxxxxxxxxxxxxx" --include-private
```

### GitHub App Integration Examples

#### GitHub App Installation Tokens
```bash
# Use GitHub App installation access token
export GITHUB_OAUTH_TOKEN="v1.1f699f1a1e3ce4567890abcdef..."
kraven scan organization --include-private --max-repos 100

# Check rate limits with GitHub App token
kraven rate-limit --oauth-token "v1.1f699f1a1e3ce4567890abcdef..."
```

#### Enterprise GitHub App Usage
```bash
# Enterprise organization scan with GitHub App
kraven scan enterprise-org --oauth-token "ghs_xxxxxxxxxxxxxxxxxxxx" \
  --include-private --max-repos 50 --languages java,python

# Multi-organization enterprise scan
kraven scan-multi "team-a,team-b,team-c" \
  --oauth-token "your_github_app_token" --include-private
```

### CI/CD Pipeline Examples

#### GitHub Actions with OAuth
```bash
# In GitHub Actions workflow
export GITHUB_OAUTH_TOKEN="${{ secrets.GITHUB_TOKEN }}"
kraven scan ${{ github.repository_owner }} --include-private --output json > tech-debt-report.json
```

#### Enterprise CI/CD
```bash
# Jenkins/GitLab CI with OAuth token
kraven scan myorg --oauth-token "$OAUTH_TOKEN" \
  --include-private --output markdown > reports/tech-debt-$(date +%Y%m%d).md

# Automated compliance scanning
kraven scan-multi "org1,org2,org3" --oauth-token "$ENTERPRISE_TOKEN" \
  --include-private --min-stars 0 --output json > compliance-report.json
```

### OAuth Token Management

#### Environment Configuration
```bash
# Method 1: Dedicated OAuth variable
echo "GITHUB_OAUTH_TOKEN=gho_xxxxxxxxxxxxxxxxxxxx" >> .env

# Method 2: Generic token with type specification
echo "GITHUB_TOKEN=gho_xxxxxxxxxxxxxxxxxxxx" >> .env
echo "GITHUB_TOKEN_TYPE=oauth" >> .env

# Method 3: Mixed environment (PAT fallback)
echo "GITHUB_OAUTH_TOKEN=gho_xxxxxxxxxxxxxxxxxxxx" >> .env
echo "GITHUB_TOKEN=ghp_fallback_pat_token" >> .env
```

#### Token Verification
```bash
# Test OAuth token authentication
kraven rate-limit --oauth-token "your_oauth_token"

# Compare PAT vs OAuth rate limits
kraven rate-limit --token "your_pat_token" --token-type pat
kraven rate-limit --oauth-token "your_oauth_token"
```

### Advanced OAuth Use Cases

#### GitHub App with Custom Permissions
```bash
# Scan with specific GitHub App permissions
kraven hunt --oauth-token "ghs_installation_token" \
  --language typescript --include-private --ml-enhanced

# Organization-wide compliance audit
kraven scan enterprise --oauth-token "ghs_compliance_token" \
  --include-private --max-repos 200 --output markdown
```

#### OAuth Token Rotation
```bash
# Script for token rotation in enterprise environments
OLD_TOKEN="$GITHUB_OAUTH_TOKEN"
NEW_TOKEN="$(get_new_oauth_token)"

# Test new token
if kraven rate-limit --oauth-token "$NEW_TOKEN" >/dev/null 2>&1; then
    export GITHUB_OAUTH_TOKEN="$NEW_TOKEN"
    echo "Token rotated successfully"
else
    echo "New token validation failed, keeping old token"
fi
```

## Utility Commands

### Check API rate limits
```bash
kraven rate-limit
```

## Real-World Examples

### Hunt for abandoned React tools
```bash
kraven hunt --language javascript --min-stars 500 --pushed-before 2022-01-01 --limit 5
```

### Find TypeScript CLI utilities
```bash
kraven hunt --language typescript --category cli-tool --min-stars 100 --limit 10
```

### Search for build tools needing maintenance
```bash
kraven hunt --category build-tool --min-stars 200 --pushed-before 2023-01-01
```

## Tips for Success

1. **Start broad**: Use general searches first, then narrow down
2. **Check multiple categories**: Different project types have different abandonment patterns
3. **Look at forks**: Popular abandoned projects often have active forks
4. **Consider complexity**: Start with smaller projects for easier revival
5. **Check licensing**: Ensure you can legally fork and maintain the project

## Tech Debt Metrics Analysis

### Understanding Financial Impact
The organization scan now includes comprehensive tech debt cost analysis:

```bash
# Get detailed tech debt metrics
kraven scan myorg --max-repos 50 --output markdown
```

**Financial Metrics Included:**
- **Annual Cost**: Total yearly maintenance burden
- **Cost per Repository**: Monthly maintenance cost breakdown
- **Security Incident Risk**: Potential breach costs
- **Opportunity Cost**: Lost productivity value

### Time Investment Analysis
```bash
# Focus on time estimates for planning
kraven scan myorg --max-repos 30 --min-stars 100
```

**Time Metrics Included:**
- **Total Maintenance Hours**: Complete remediation time
- **Average per Repository**: Planning estimates per repo
- **Critical Issue Hours**: Immediate security fixes needed
- **Dependency Update Hours**: Library modernization time

### Security Risk Quantification
```bash
# Security-focused analysis
kraven scan myorg --max-repos 25 --exclude-forks --pushed-before 2022-01-01
```

**Security Metrics Included:**
- **Risk Score (0-100)**: Overall security posture
- **Critical Vulnerabilities**: High-priority CVEs estimated
- **Compliance Risk**: Regulatory impact assessment
- **Outdated Dependencies**: Security-relevant package count

### Business Impact Assessment
```bash
# Business stakeholder report
kraven scan myorg --output markdown > business-impact-report.md
```

**Business Metrics Included:**
- **Productivity Loss %**: Developer efficiency impact
- **Deployment Risk**: Production stability concerns
- **Talent Retention**: Developer satisfaction impact
- **Innovation Delay**: Feature development delays

## Interpreting Results

### Tech Debt Risk Levels

#### 🟢 Low Risk (0-30/100)
- **Annual Cost**: <$50,000
- **Maintenance**: <500 hours
- **Action**: Maintain current practices

#### 🟡 Medium Risk (31-60/100)
- **Annual Cost**: $50,000-$200,000
- **Maintenance**: 500-2,000 hours
- **Action**: Create remediation plan

#### 🟠 High Risk (61-80/100)
- **Annual Cost**: $200,000-$500,000
- **Maintenance**: 2,000-5,000 hours
- **Action**: Immediate attention required

#### 🔴 Critical Risk (81-100/100)
- **Annual Cost**: >$500,000
- **Maintenance**: >5,000 hours
- **Action**: Emergency response needed

### Abandonment Score (0-100%)
- **0-30%**: Active project
- **31-60%**: Showing signs of abandonment
- **61-80%**: Likely abandoned
- **81-100%**: Definitely abandoned

### Revival Potential (0-100%)
- **0-30%**: Poor candidate for revival
- **31-60%**: Moderate potential
- **61-80%**: Good candidate
- **81-100%**: Excellent revival opportunity

### Status Indicators
- **🎯 PRIME**: High abandonment + High revival potential
- **⚠️ MAYBE**: Moderate scores, investigate further
- **❌ SKIP**: Low revival potential or still active

### Fork Analysis Results
- **🌟 EXCELLENT**: Highly active fork with great potential
- **🎯 GOOD**: Active fork worth considering
- **⚠️ FAIR**: Moderate activity, may need investigation
- **❌ POOR**: Low activity, probably not worth pursuing

### Fork Health Indicators
- **✅ Excellent**: All dependencies up-to-date and secure
- **👍 Good**: Most dependencies current with minor issues
- **⚠️ Fair**: Some outdated dependencies, manageable
- **👎 Poor**: Many outdated dependencies
- **🚨 Critical**: Security vulnerabilities present

### ML Prediction Indicators
- **🧠 High Confidence**: ML predictions with >80% confidence
- **🤖 Medium Confidence**: ML predictions with 60-80% confidence
- **🔮 Low Confidence**: ML predictions with <60% confidence
- **❓ No ML**: Rule-based analysis only (no trained models)

### ML-Enhanced Features
- **Abandonment Probability**: AI-predicted likelihood of abandonment (0-100%)
- **Revival Success Probability**: AI-predicted success chance for revival (0-100%)
- **Estimated Effort**: AI-predicted days of work required (1-365 days)
- **Community Adoption**: AI-predicted likelihood of community acceptance (0-100%)
- **Key Factors**: Most important factors driving the prediction
- **Scoring Method**: rule-based, ml-enhanced, or hybrid
