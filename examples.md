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
