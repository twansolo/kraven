#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { KravenHunter } from './kraven';
import { SearchFilters, ProjectCategory, ForkAnalysisOptions, PredictionConfig } from './types';
import { ForkAnalyzer } from './services/fork-analyzer';
import { MLTrainer } from './services/ml-trainer';
import { MLPredictor } from './services/ml-predictor';

// Load environment variables from multiple locations
function loadEnvironmentVariables() {
  // Suppress dotenv output for clean JSON
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Temporarily suppress console output
  console.log = () => {};
  console.error = () => {};
  
  try {
    // First try current working directory
    dotenv.config({ debug: false });
    
    // If no GITHUB_TOKEN found, try the kraven installation directory
    if (!process.env.GITHUB_TOKEN) {
      // This file is compiled to dist/cli.js, so we need to go up to the project root
      // __dirname points to dist/ folder, so go up one level to get project root
      const kravenDir = path.join(__dirname, '..');
      const kravenEnvPath = path.join(kravenDir, '.env');
      
      if (fs.existsSync(kravenEnvPath)) {
        dotenv.config({ path: kravenEnvPath, debug: false });
      }
    }
  } finally {
    // Restore console output
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
}

// Load environment variables
loadEnvironmentVariables();

const program = new Command();

program
  .name('kraven')
  .description('🕷️ Hunt abandoned GitHub repositories ripe for revival')
  .version('1.0.0');

// Hunt command
program
  .command('hunt')
  .description('Search for abandoned repositories')
  .option('-l, --language <language>', 'Programming language (e.g., typescript, javascript)')
  .option('-c, --category <category>', 'Project category (cli-tool, build-tool, dev-tool, etc.)')
  .option('--min-stars <number>', 'Minimum star count', parseInt)
  .option('--max-stars <number>', 'Maximum star count', parseInt)
  .option('--pushed-before <date>', 'Last push before date (YYYY-MM-DD)')
  .option('--pushed-after <date>', 'Last push after date (YYYY-MM-DD)')
  .option('--sort <field>', 'Sort by: stars, updated, created', 'stars')
  .option('--order <direction>', 'Sort order: asc, desc', 'desc')
  .option('--limit <number>', 'Maximum results to analyze', parseInt, 10)
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .option('--skip-dependencies', 'Skip dependency analysis (faster but less detailed)', false)
  .option('--ml-enhanced', 'Use machine learning enhanced scoring (requires trained models)', false)
  .option('--ml-confidence <threshold>', 'ML confidence threshold (0.1-1.0)', parseFloat, 0.7)
  .action(async (options) => {
    // Only show spinner for non-JSON output to keep JSON clean
    const spinner = options.output === 'json' ? null : ora('🕷️ Kraven is hunting...').start();
    
    try {
      const filters: SearchFilters = {
        language: options.language,
        category: options.category as ProjectCategory,
        minStars: options.minStars,
        maxStars: options.maxStars,
        pushedBefore: options.pushedBefore,
        pushedAfter: options.pushedAfter,
        sort: options.sort,
        order: options.order
      };

      const kraven = new KravenHunter();
      
      // Configure ML settings
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: options.mlConfidence || 0.7,
        fallbackToRuleBase: true
      };
      
      const results = await kraven.hunt(filters, options.limit, options.mlEnhanced, mlConfig);
      
      if (spinner) spinner.stop();
      
      if (options.output === 'json') {
        // For JSON output, only output the JSON (no other messages)
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.green(`\n🎯 Found ${results.totalFound} repositories, analyzed ${results.analyzed.length}\n`));
        
        if (options.output === 'markdown') {
          printMarkdownResults(results.analyzed);
        } else {
          printTableResults(results.analyzed);
        }
      }
      
    } catch (error) {
      if (spinner) spinner.stop();
      console.error(chalk.red('❌ Hunt failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <repository>')
  .description('Analyze a specific repository (format: owner/repo)')
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .option('--ml-enhanced', 'Use machine learning enhanced analysis', false)
  .option('--ml-confidence <threshold>', 'ML confidence threshold (0.1-1.0)', parseFloat, 0.7)
  .action(async (repository, options) => {
    const spinner = ora(`🔍 Analyzing ${repository}...`).start();
    
    try {
      const kraven = new KravenHunter();
      
      // Configure ML settings
      const mlConfig: PredictionConfig = {
        useMLScoring: options.mlEnhanced,
        confidenceThreshold: options.mlConfidence || 0.7,
        fallbackToRuleBase: true
      };
      
      const analysis = await kraven.analyzeRepository(repository, options.mlEnhanced, mlConfig);
      
      spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify(analysis, null, 2));
      } else if (options.output === 'markdown') {
        printMarkdownAnalysis(analysis);
      } else {
        printTableAnalysis(analysis);
      }
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Analysis failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Fork analysis command
program
  .command('forks <repository>')
  .description('Analyze forks of an abandoned repository (format: owner/repo)')
  .option('--max-forks <number>', 'Maximum forks to analyze', parseInt, 20)
  .option('--min-stars <number>', 'Minimum stars to consider', parseInt, 1)
  .option('--min-activity <days>', 'Maximum days since last activity', parseInt, 365)
  .option('--sort <field>', 'Sort by: activity, stars, divergence, health', 'activity')
  .option('--output <format>', 'Output format: table, json, markdown', 'table')
  .action(async (repository, options) => {
    const spinner = options.output === 'json' ? null : ora(`🍴 Analyzing forks of ${repository}...`).start();
    
    try {
      const [owner, repo] = repository.split('/');
      
      if (!owner || !repo) {
        throw new Error('Repository must be in format "owner/repo"');
      }

      const kraven = new KravenHunter();
      const githubService = (kraven as any).githubService; // Access private property
      const forkAnalyzer = new ForkAnalyzer(githubService);
      
      const analysisOptions: ForkAnalysisOptions = {
        maxForks: options.maxForks,
        minStars: options.minStars,
        minActivity: options.minActivity,
        sortBy: options.sort,
        includeOriginal: true
      };
      
      const forkComparison = await forkAnalyzer.analyzeForks(owner, repo, analysisOptions);
      
      if (spinner) spinner.stop();
      
      if (options.output === 'json') {
        console.log(JSON.stringify(forkComparison, null, 2));
      } else if (options.output === 'markdown') {
        printMarkdownForkAnalysis(forkComparison);
      } else {
        printTableForkAnalysis(forkComparison);
      }
      
    } catch (error) {
      if (spinner) spinner.stop();
      console.error(chalk.red('❌ Fork analysis failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ML Training command
program
  .command('train')
  .description('Train ML models for enhanced scoring')
  .option('--repositories <file>', 'File containing repository list (one per line)')
  .option('--sample-size <number>', 'Number of repositories to sample for training', parseInt, 100)
  .option('--popular-repos', 'Include popular repositories in training data', false)
  .action(async (options) => {
    const spinner = ora('🤖 Preparing ML training...').start();
    
    try {
      const kraven = new KravenHunter();
      const githubService = kraven.githubService;
      const analyzer = new (await import('./services/analyzer')).RepositoryAnalyzer(githubService);
      const trainer = new MLTrainer(githubService, analyzer);
      
      let repositories: string[] = [];
      
      if (options.repositories) {
        // Load from file
        const fileContent = fs.readFileSync(options.repositories, 'utf-8');
        repositories = fileContent.split('\n').filter(line => line.trim());
      } else {
        // Generate sample repositories
        spinner.text = '🔍 Discovering repositories for training...';
        const sampleSize = parseInt(options.sampleSize) || 100;
        repositories = await generateTrainingRepositories(githubService, sampleSize, options.popularRepos);
      }
      
      spinner.text = `📚 Collecting training data from ${repositories.length} repositories...`;
      await trainer.collectTrainingData(repositories);
      
      spinner.text = '🧠 Training ML models...';
      await trainer.trainModels();
      
      spinner.stop();
      console.log(chalk.green('✅ ML models trained successfully!'));
      console.log(chalk.blue('🎯 Enhanced scoring is now available for analysis'));
      console.log(chalk.yellow('\n💡 Usage:'));
      console.log('  kraven hunt --ml-enhanced --language typescript');
      console.log('  kraven analyze owner/repo --ml-enhanced');
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ ML training failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Languages command
program
  .command('languages')
  .description('Show supported programming languages for analysis')
  .action(async () => {
    try {
      const kraven = new KravenHunter();
      const githubService = kraven.githubService;
      const { DependencyAnalyzer } = await import('./services/dependency-analyzer');
      const dependencyAnalyzer = new DependencyAnalyzer(githubService);
      
      const supportedLanguages = dependencyAnalyzer.getSupportedLanguages();
      
      console.log(chalk.blue('🌍 Supported Programming Languages:\n'));
      
      const languageInfo = {
        'javascript': { icon: '🟨', files: ['package.json'], registry: 'npm' },
        'typescript': { icon: '🔷', files: ['package.json'], registry: 'npm' },
        'python': { icon: '🐍', files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'], registry: 'PyPI' },
        'rust': { icon: '🦀', files: ['Cargo.toml', 'Cargo.lock'], registry: 'crates.io' },
        'go': { icon: '🐹', files: ['go.mod', 'go.sum'], registry: 'pkg.go.dev' },
        'java': { icon: '☕', files: ['pom.xml', 'build.gradle'], registry: 'Maven Central' }
      };
      
      supportedLanguages.forEach(language => {
        const info = languageInfo[language as keyof typeof languageInfo];
        if (info) {
          console.log(`${info.icon} ${chalk.bold(language.charAt(0).toUpperCase() + language.slice(1))}`);
          console.log(`   Files: ${info.files.join(', ')}`);
          console.log(`   Registry: ${info.registry}`);
          console.log('');
        }
      });
      
      console.log(chalk.yellow('💡 Usage:'));
      console.log('  kraven hunt --language python --ml-enhanced');
      console.log('  kraven analyze owner/rust-repo --ml-enhanced');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to show language info:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ML Info command
program
  .command('ml-info')
  .description('Show ML model information and status')
  .action(async () => {
    try {
      const predictor = new MLPredictor();
      
      if (predictor.isMLAvailable()) {
        console.log(chalk.green('🧠 ML Models Status: Available'));
        console.log(chalk.blue('\n📊 Model Information:'));
        
        const modelInfo = predictor.getModelInfo();
        Object.entries(modelInfo).forEach(([modelName, info]) => {
          console.log(`\n${chalk.bold(modelName.toUpperCase())}:`);
          console.log(`  Algorithm: ${info.algorithm}`);
          console.log(`  Accuracy: ${Math.round(info.accuracy * 100)}%`);
          console.log(`  Training Samples: ${info.training_samples}`);
          console.log(`  Trained: ${new Date(info.trained_at).toLocaleDateString()}`);
        });
        
        console.log(chalk.yellow('\n💡 Usage Examples:'));
        console.log('  kraven hunt --ml-enhanced --confidence 0.8');
        console.log('  kraven analyze microsoft/typescript --ml-enhanced');
      } else {
        console.log(chalk.yellow('🤖 ML Models Status: Not Available'));
        console.log(chalk.blue('\n💡 To enable ML-enhanced scoring:'));
        console.log('  1. Run: kraven train --sample-size 200');
        console.log('  2. Wait for training to complete');
        console.log('  3. Use: kraven hunt --ml-enhanced');
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check ML status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Rate limit command
program
  .command('rate-limit')
  .description('Check GitHub API rate limit status')
  .action(async () => {
    try {
      const kraven = new KravenHunter();
      const rateLimit = await kraven.checkRateLimit();
      
      console.log(chalk.blue('📊 GitHub API Rate Limit Status:'));
      console.log(`Remaining: ${rateLimit.rate.remaining}/${rateLimit.rate.limit}`);
      console.log(`Resets at: ${new Date(rateLimit.rate.reset * 1000).toLocaleString()}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check rate limit:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function printTableResults(analyses: any[]) {
  if (analyses.length === 0) {
    console.log(chalk.yellow('No repositories found matching criteria.'));
    return;
  }

  console.log(chalk.bold('Repository'.padEnd(30)) + 
              chalk.bold('Stars'.padEnd(8)) + 
              chalk.bold('Abandon'.padEnd(10)) + 
              chalk.bold('Revival'.padEnd(10)) + 
              chalk.bold('ML'.padEnd(8)) + 
              chalk.bold('Deps'.padEnd(8)) + 
              chalk.bold('Last Commit'.padEnd(12)) + 
              chalk.bold('Status'));
  
  console.log('─'.repeat(95));
  
  analyses.forEach(analysis => {
    const repo = analysis.repository;
    const name = repo.full_name.length > 28 ? repo.full_name.substring(0, 25) + '...' : repo.full_name;
    const stars = repo.stargazers_count.toString();
    const abandon = `${analysis.abandonmentScore}%`;
    const revival = `${analysis.revivalPotential}%`;
    const lastCommit = `${analysis.lastCommitAge}d ago`;
    
    // ML indicator
    let mlIndicator = '❓';
    if (analysis.mlPrediction) {
      const confidence = Math.round(analysis.mlPrediction.confidence_score * 100);
      if (confidence > 80) mlIndicator = chalk.green('🧠');
      else if (confidence > 60) mlIndicator = chalk.yellow('🤖');
      else mlIndicator = chalk.gray('🔮');
    } else {
      mlIndicator = chalk.gray('❓');
    }
    
    // Dependency health indicator
    let depsIndicator = '❓';
    if (analysis.dependencyAnalysis) {
      switch (analysis.dependencyHealth) {
        case 'excellent': depsIndicator = chalk.green('✅'); break;
        case 'good': depsIndicator = chalk.green('👍'); break;
        case 'fair': depsIndicator = chalk.yellow('⚠️'); break;
        case 'poor': depsIndicator = chalk.red('👎'); break;
        case 'critical': depsIndicator = chalk.red('🚨'); break;
        default: depsIndicator = chalk.gray('❓'); break;
      }
    } else {
      depsIndicator = chalk.gray('❓');
    }
    
    let status = '';
    // Use ML predictions if available and confident
    if (analysis.mlPrediction && analysis.mlPrediction.confidence_score > 0.7) {
      const mlRevival = analysis.mlPrediction.revival_success_probability * 100;
      const mlAbandonment = analysis.mlPrediction.abandonment_probability * 100;
      
      if (mlAbandonment > 70 && mlRevival > 60) {
        status = chalk.green('🎯 PRIME');
      } else if (mlAbandonment > 50 && mlRevival > 40) {
        status = chalk.yellow('⚠️  MAYBE');
      } else {
        status = chalk.red('❌ SKIP');
      }
    } else {
      // Fall back to rule-based
      if (analysis.abandonmentScore > 70 && analysis.revivalPotential > 60) {
        status = chalk.green('🎯 PRIME');
      } else if (analysis.abandonmentScore > 50 && analysis.revivalPotential > 40) {
        status = chalk.yellow('⚠️  MAYBE');
      } else {
        status = chalk.red('❌ SKIP');
      }
    }
    
    console.log(
      name.padEnd(30) +
      stars.padEnd(8) +
      abandon.padEnd(10) +
      revival.padEnd(10) +
      (mlIndicator + '   ').substring(0, 8) +
      (depsIndicator + '   ').substring(0, 8) +
      lastCommit.padEnd(12) +
      status
    );
  });
}

function printMarkdownResults(analyses: any[]) {
  console.log('# 🕷️ Kraven Hunt Results\n');
  
  analyses.forEach(analysis => {
    const repo = analysis.repository;
    console.log(`## [${repo.full_name}](${repo.html_url})\n`);
    console.log(`**Description:** ${repo.description || 'No description'}\n`);
    console.log(`**Language:** ${repo.language || 'Unknown'} | **Stars:** ${repo.stargazers_count} | **Forks:** ${repo.forks_count}\n`);
    console.log(`**Abandonment Score:** ${analysis.abandonmentScore}% | **Revival Potential:** ${analysis.revivalPotential}%\n`);
    console.log(`**Last Commit:** ${analysis.lastCommitAge} days ago\n`);
    
    if (analysis.reasons.length > 0) {
      console.log('**Abandonment Indicators:**');
      analysis.reasons.forEach((reason: string) => console.log(`- ${reason}`));
      console.log('');
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('**Revival Recommendations:**');
      analysis.recommendations.forEach((rec: string) => console.log(`- ${rec}`));
      console.log('');
    }
    
    console.log('---\n');
  });
}

function printTableAnalysis(analysis: any) {
  const repo = analysis.repository;
  
  console.log(chalk.blue.bold(`\n📊 Analysis: ${repo.full_name}\n`));
  
  console.log(chalk.bold('Basic Information:'));
  console.log(`URL: ${repo.html_url}`);
  console.log(`Description: ${repo.description || 'No description'}`);
  console.log(`Language: ${repo.language || 'Unknown'}`);
  console.log(`Created: ${new Date(repo.created_at).toLocaleDateString()}`);
  console.log(`Last Push: ${new Date(repo.pushed_at).toLocaleDateString()}`);
  
  console.log(chalk.bold('\nMetrics:'));
  console.log(`Stars: ${repo.stargazers_count}`);
  console.log(`Forks: ${repo.forks_count}`);
  console.log(`Open Issues: ${repo.open_issues_count}`);
  console.log(`Size: ${repo.size} KB`);
  
  console.log(chalk.bold('\nScores:'));
  console.log(`Abandonment Score: ${analysis.abandonmentScore}%`);
  console.log(`Revival Potential: ${analysis.revivalPotential}%`);
  console.log(`Community Engagement: ${analysis.communityEngagement}%`);
  console.log(`Market Relevance: ${analysis.marketRelevance}%`);
  console.log(`Dependency Health: ${analysis.dependencyHealth}`);
  
  // Show ML predictions if available
  if (analysis.mlPrediction) {
    console.log(chalk.bold('\n🤖 ML Predictions:'));
    console.log(`Abandonment Probability: ${Math.round(analysis.mlPrediction.abandonment_probability * 100)}%`);
    console.log(`Revival Success Probability: ${Math.round(analysis.mlPrediction.revival_success_probability * 100)}%`);
    console.log(`Estimated Effort: ${analysis.mlPrediction.estimated_effort_days} days`);
    console.log(`Community Adoption Likelihood: ${Math.round(analysis.mlPrediction.community_adoption_likelihood * 100)}%`);
    console.log(`ML Confidence: ${Math.round(analysis.mlPrediction.confidence_score * 100)}%`);
    console.log(`Scoring Method: ${analysis.scoringMethod}`);
  }
  
  console.log(chalk.bold('\nTiming:'));
  console.log(`Last Commit: ${analysis.lastCommitAge} days ago`);
  console.log(`Avg Issue Response: ${analysis.issueResponseTime > 0 ? `${Math.round(analysis.issueResponseTime)} days` : 'Unknown'}`);
  
  console.log(chalk.bold('\nAssessment:'));
  console.log(`Technical Complexity: ${analysis.technicalComplexity}`);
  console.log(`Dependency Health: ${analysis.dependencyHealth}`);

  // Show detailed dependency information if available
  if (analysis.dependencyAnalysis && analysis.dependencyAnalysis.totalDependencies > 0) {
    console.log(chalk.bold('\nDependency Details:'));
    const deps = analysis.dependencyAnalysis;
    console.log(`Total Dependencies: ${deps.totalDependencies}`);
    console.log(`Outdated: ${deps.outdatedDependencies} (${Math.round((deps.outdatedDependencies / deps.totalDependencies) * 100)}%)`);
    console.log(`With Vulnerabilities: ${deps.vulnerableDependencies}`);
    console.log(`Critical Vulnerabilities: ${deps.criticalVulnerabilities}`);
    console.log(`Health Score: ${deps.healthScore}/100`);
    
    if (deps.recommendations.length > 0) {
      console.log(chalk.bold('\nDependency Recommendations:'));
      deps.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
    }
  }
  
  if (analysis.reasons.length > 0) {
    console.log(chalk.bold('\nAbandonment Indicators:'));
    analysis.reasons.forEach((reason: string) => console.log(`• ${reason}`));
  }
  
  if (analysis.recommendations.length > 0) {
    console.log(chalk.bold('\nRevival Recommendations:'));
    analysis.recommendations.forEach((rec: string) => console.log(`• ${rec}`));
  }
}

function printMarkdownAnalysis(analysis: any) {
  const repo = analysis.repository;
  
  console.log(`# 🕷️ Repository Analysis: ${repo.full_name}\n`);
  console.log(`[View on GitHub](${repo.html_url})\n`);
  console.log(`**Description:** ${repo.description || 'No description'}\n`);
  
  console.log('## 📊 Metrics\n');
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Stars | ${repo.stargazers_count} |`);
  console.log(`| Forks | ${repo.forks_count} |`);
  console.log(`| Open Issues | ${repo.open_issues_count} |`);
  console.log(`| Language | ${repo.language || 'Unknown'} |`);
  console.log(`| Size | ${repo.size} KB |`);
  console.log(`| Last Commit | ${analysis.lastCommitAge} days ago |\n`);
  
  console.log('## 🎯 Scores\n');
  console.log(`| Score | Value |`);
  console.log(`|-------|-------|`);
  console.log(`| Abandonment Score | ${analysis.abandonmentScore}% |`);
  console.log(`| Revival Potential | ${analysis.revivalPotential}% |`);
  console.log(`| Community Engagement | ${analysis.communityEngagement}% |`);
  console.log(`| Market Relevance | ${analysis.marketRelevance}% |\n`);
  
  if (analysis.reasons.length > 0) {
    console.log('## ⚠️ Abandonment Indicators\n');
    analysis.reasons.forEach((reason: string) => console.log(`- ${reason}`));
    console.log('');
  }
  
  if (analysis.recommendations.length > 0) {
    console.log('## 💡 Revival Recommendations\n');
    analysis.recommendations.forEach((rec: string) => console.log(`- ${rec}`));
    console.log('');
  }
}

function printTableForkAnalysis(forkComparison: any) {
  const { original, totalForks, analyzedForks, activeForks, topRecommendations, insights } = forkComparison;
  
  console.log(chalk.blue.bold(`\n🍴 Fork Analysis: ${original.full_name}\n`));
  
  console.log(chalk.bold('Overview:'));
  console.log(`Total Forks: ${totalForks}`);
  console.log(`Analyzed: ${analyzedForks}`);
  console.log(`Active: ${activeForks.length}`);
  console.log(`Execution Time: ${Math.round(forkComparison.executionTime / 1000)}s\n`);
  
  if (insights.length > 0) {
    console.log(chalk.bold('Insights:'));
    insights.forEach((insight: string) => console.log(`• ${insight}`));
    console.log('');
  }
  
  if (topRecommendations.length === 0) {
    console.log(chalk.yellow('No active forks found matching criteria.'));
    return;
  }
  
  console.log(chalk.bold('Top Fork Recommendations:\n'));
  
  console.log(chalk.bold('Rank'.padEnd(6)) + 
              chalk.bold('Repository'.padEnd(35)) + 
              chalk.bold('Stars'.padEnd(8)) + 
              chalk.bold('Activity'.padEnd(10)) + 
              chalk.bold('Health'.padEnd(10)) + 
              chalk.bold('Last Active'.padEnd(15)) + 
              chalk.bold('Status'));
  
  console.log('─'.repeat(110));
  
  topRecommendations.slice(0, 10).forEach((fork: any, index: number) => {
    const repo = fork.repository;
    const name = repo.full_name.length > 33 ? repo.full_name.substring(0, 30) + '...' : repo.full_name;
    const stars = repo.stargazers_count.toString();
    const activity = `${fork.activityScore}%`;
    const health = fork.analysis.dependencyHealth;
    const lastActive = `${fork.lastActivityDays}d ago`;
    
    // Health indicator
    let healthIndicator = '❓';
    switch (health) {
      case 'excellent': healthIndicator = chalk.green('✅'); break;
      case 'good': healthIndicator = chalk.green('👍'); break;
      case 'fair': healthIndicator = chalk.yellow('⚠️'); break;
      case 'poor': healthIndicator = chalk.red('👎'); break;
      case 'critical': healthIndicator = chalk.red('🚨'); break;
      default: healthIndicator = chalk.gray('❓'); break;
    }
    
    // Status based on overall score
    let status = '';
    const overallScore = (fork.activityScore * 0.4) + (fork.analysis.revivalPotential * 0.3) + (fork.maintainerResponsiveness * 0.3);
    if (overallScore > 80) {
      status = chalk.green('🌟 EXCELLENT');
    } else if (overallScore > 60) {
      status = chalk.green('🎯 GOOD');
    } else if (overallScore > 40) {
      status = chalk.yellow('⚠️ FAIR');
    } else {
      status = chalk.red('❌ POOR');
    }
    
    console.log(
      `#${fork.forkRank}`.padEnd(6) +
      name.padEnd(35) +
      stars.padEnd(8) +
      activity.padEnd(10) +
      (healthIndicator + '     ').substring(0, 10) +
      lastActive.padEnd(15) +
      status
    );
  });
  
  // Show special recommendations
  if (forkComparison.bestForRevival) {
    console.log(chalk.bold('\n🚀 Best for Revival:'));
    const best = forkComparison.bestForRevival;
    console.log(`${best.repository.full_name} - Revival potential: ${best.analysis.revivalPotential}%`);
  }
  
  if (forkComparison.bestForContribution) {
    console.log(chalk.bold('\n🤝 Best for Contribution:'));
    const best = forkComparison.bestForContribution;
    console.log(`${best.repository.full_name} - Maintainer responsiveness: ${best.maintainerResponsiveness}%`);
  }
  
  if (forkComparison.mostDiverged) {
    console.log(chalk.bold('\n🔀 Most Diverged:'));
    const diverged = forkComparison.mostDiverged;
    console.log(`${diverged.repository.full_name} - ${diverged.divergenceFromOriginal} commits ahead`);
  }
}

function printMarkdownForkAnalysis(forkComparison: any) {
  const { original, totalForks, analyzedForks, activeForks, topRecommendations, insights } = forkComparison;
  
  console.log(`# 🍴 Fork Analysis: ${original.full_name}\n`);
  console.log(`[Original Repository](${original.html_url})\n`);
  
  console.log('## 📊 Overview\n');
  console.log(`- **Total Forks**: ${totalForks}`);
  console.log(`- **Analyzed**: ${analyzedForks}`);
  console.log(`- **Active**: ${activeForks.length}`);
  console.log(`- **Execution Time**: ${Math.round(forkComparison.executionTime / 1000)}s\n`);
  
  if (insights.length > 0) {
    console.log('## 💡 Insights\n');
    insights.forEach((insight: string) => console.log(`- ${insight}`));
    console.log('');
  }
  
  if (topRecommendations.length > 0) {
    console.log('## 🏆 Top Fork Recommendations\n');
    console.log('| Rank | Repository | Stars | Activity | Health | Last Active | Revival Potential |');
    console.log('|------|------------|-------|----------|--------|-------------|-------------------|');
    
    topRecommendations.slice(0, 10).forEach((fork: any) => {
      const repo = fork.repository;
      console.log(`| #${fork.forkRank} | [${repo.full_name}](${repo.html_url}) | ${repo.stargazers_count} | ${fork.activityScore}% | ${fork.analysis.dependencyHealth} | ${fork.lastActivityDays}d ago | ${fork.analysis.revivalPotential}% |`);
    });
    console.log('');
  }
  
  // Special recommendations
  if (forkComparison.bestForRevival) {
    console.log('## 🚀 Best for Revival\n');
    const best = forkComparison.bestForRevival;
    console.log(`**[${best.repository.full_name}](${best.repository.html_url})**`);
    console.log(`- Revival Potential: ${best.analysis.revivalPotential}%`);
    console.log(`- Activity Score: ${best.activityScore}%`);
    console.log(`- Dependency Health: ${best.analysis.dependencyHealth}\n`);
  }
  
  if (forkComparison.bestForContribution) {
    console.log('## 🤝 Best for Contribution\n');
    const best = forkComparison.bestForContribution;
    console.log(`**[${best.repository.full_name}](${best.repository.html_url})**`);
    console.log(`- Maintainer Responsiveness: ${best.maintainerResponsiveness}%`);
    console.log(`- Activity Score: ${best.activityScore}%`);
    console.log(`- Last Active: ${best.lastActivityDays} days ago\n`);
  }
}

/**
 * Generate training repositories for ML
 */
async function generateTrainingRepositories(githubService: any, sampleSize: number, includePopular: boolean): Promise<string[]> {
  const repositories: string[] = [];
  
  // Sample from different languages (without categories to avoid search issues)
  const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
  const reposPerLanguage = Math.ceil(Number(sampleSize) / languages.length);
  
  console.log(`🔍 Searching for ${reposPerLanguage} repositories per language (${sampleSize} total)...`);
  
  for (const language of languages) {
    try {
      console.log(`  Searching ${language} repositories...`);
      
      const searchResponse = await githubService.searchRepositories({
        language,
        minStars: includePopular ? 50 : 10,
        maxStars: includePopular ? undefined : 5000,
        pushedBefore: '2023-01-01' // Focus on potentially abandoned projects
      }, 1, Math.min(30, reposPerLanguage));
      
      console.log(`  Found ${searchResponse.items.length} ${language} repositories`);
      
      searchResponse.items.forEach((repo: any) => {
        if (repositories.length < sampleSize && !repositories.includes(repo.full_name)) {
          repositories.push(repo.full_name);
        }
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.warn(`Failed to sample ${language} repositories:`, error instanceof Error ? error.message : error);
    }
  }
  
  // If we still don't have enough, try some popular abandoned projects
  if (repositories.length < sampleSize) {
    console.log(`🎯 Adding known abandoned projects to reach sample size...`);
    
    const knownAbandoned = [
      'bower/bower',
      'angular/angular.js',
      'jquery/jquery-ui',
      'atom/atom',
      'meteor/meteor',
      'strongloop/express',
      'jashkenas/backbone',
      'documentcloud/backbone',
      'moment/moment',
      'chalk/chalk',
      'yargs/yargs',
      'gulpjs/gulp',
      'gruntjs/grunt',
      'browserify/browserify',
      'requirejs/requirejs',
      'component/component',
      'yeoman/yeoman',
      'necolas/normalize.css',
      'daneden/animate.css',
      'less/less.js',
      'stylus/stylus'
    ];
    
    knownAbandoned.forEach(repo => {
      if (repositories.length < sampleSize && !repositories.includes(repo)) {
        repositories.push(repo);
      }
    });
  }
  
  console.log(`✅ Generated ${repositories.length} repositories for training`);
  return repositories.slice(0, sampleSize);
}

program.parse();
