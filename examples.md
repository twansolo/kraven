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

## Interpreting Results

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
