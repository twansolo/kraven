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
