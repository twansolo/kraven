import { GitHubService } from './github';
import { RepositoryAnalyzer } from './analyzer';
import { GitHubRepository, RepositoryAnalysis } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface TrainingDataPoint {
  // Repository features
  features: {
    // Basic metrics
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    size: number;
    watchers_count: number;
    
    // Time-based features
    age_days: number;
    days_since_last_commit: number;
    days_since_last_release: number;
    
    // Activity patterns
    commits_last_30_days: number;
    commits_last_90_days: number;
    commits_last_365_days: number;
    issues_opened_last_30_days: number;
    issues_closed_last_30_days: number;
    
    // Community metrics
    contributor_count: number;
    unique_contributors_last_year: number;
    issue_response_time_avg: number;
    pr_merge_rate: number;
    
    // Technical indicators
    has_tests: boolean;
    has_ci: boolean;
    has_documentation: boolean;
    has_license: boolean;
    has_contributing_guide: boolean;
    
    // Language and ecosystem
    language_popularity_score: number;
    ecosystem_health_score: number;
    
    // Dependency health
    dependency_count: number;
    outdated_dependency_ratio: number;
    vulnerable_dependency_count: number;
    critical_vulnerability_count: number;
    
    // Social signals
    mentioned_in_awesome_lists: boolean;
    stackoverflow_mentions: number;
    reddit_mentions: number;
    blog_post_mentions: number;
  };
  
  // Labels (what we're trying to predict)
  labels: {
    is_abandoned: boolean;
    revival_success_probability: number; // 0-1
    estimated_revival_effort_days: number;
    community_adoption_likelihood: number; // 0-1
  };
  
  // Metadata
  repository: GitHubRepository;
  analysis_date: string;
  revival_outcome?: 'successful' | 'failed' | 'ongoing' | 'unknown';
}

export interface MLModel {
  type: 'abandonment' | 'revival_success' | 'effort_estimation' | 'community_adoption';
  algorithm: 'linear_regression' | 'random_forest' | 'neural_network' | 'gradient_boosting';
  accuracy: number;
  features: string[];
  weights?: number[];
  model_data: any;
  trained_at: string;
  training_samples: number;
}

export interface MLPrediction {
  abandonment_probability: number; // 0-1
  revival_success_probability: number; // 0-1
  estimated_effort_days: number;
  community_adoption_likelihood: number; // 0-1
  confidence_score: number; // 0-1
  key_factors: string[];
  recommendations: string[];
}

export class MLTrainer {
  private trainingData: TrainingDataPoint[] = [];
  private models: Map<string, MLModel> = new Map();
  private dataPath: string;

  constructor(
    private githubService: GitHubService,
    private analyzer: RepositoryAnalyzer
  ) {
    this.dataPath = path.join(__dirname, '../../data');
    this.ensureDataDirectory();
    this.loadExistingData();
  }

  /**
   * Collect training data from known repositories
   */
  async collectTrainingData(repositories: string[], batchSize = 10): Promise<void> {
    console.log(`🤖 Collecting training data from ${repositories.length} repositories...`);
    
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(repositories.length / batchSize)}...`);
      
      const batchPromises = batch.map(async (repoFullName) => {
        try {
          const [owner, repo] = repoFullName.split('/');
          if (!owner || !repo) return null;
          
          return await this.collectRepositoryData(owner, repo);
        } catch (error) {
          console.warn(`Failed to collect data for ${repoFullName}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          this.trainingData.push(result.value);
        }
      });
      
      // Save progress periodically
      if (i % (batchSize * 5) === 0) {
        await this.saveTrainingData();
      }
      
      // Rate limiting delay
      await this.delay(1000);
    }
    
    await this.saveTrainingData();
    console.log(`✅ Collected ${this.trainingData.length} training samples`);
  }

  /**
   * Collect comprehensive data for a single repository
   */
  private async collectRepositoryData(owner: string, repo: string): Promise<TrainingDataPoint | null> {
    try {
      // Get repository data
      const repository = await this.githubService.getRepository(owner, repo);
      const analysis = await this.analyzer.analyzeRepository(repository);
      
      // Get additional data for ML features
      const [commits, issues, releases, contributors] = await Promise.allSettled([
        this.githubService.getRepositoryCommits(owner, repo),
        this.githubService.getRepositoryIssues(owner, repo, 'all'),
        this.getRepositoryReleases(owner, repo),
        this.getRepositoryContributors(owner, repo)
      ]);
      
      const commitsData = commits.status === 'fulfilled' ? commits.value : [];
      const issuesData = issues.status === 'fulfilled' ? issues.value : [];
      const releasesData = releases.status === 'fulfilled' ? releases.value : [];
      const contributorsData = contributors.status === 'fulfilled' ? contributors.value : [];
      
      // Extract features
      const features = await this.extractFeatures(
        repository, 
        analysis, 
        commitsData, 
        issuesData, 
        releasesData, 
        contributorsData
      );
      
      // Determine labels (this would be enhanced with real data)
      const labels = this.determineLabels(repository, analysis);
      
      return {
        features,
        labels,
        repository,
        analysis_date: new Date().toISOString(),
        revival_outcome: 'unknown' // Would be updated based on tracking
      };
      
    } catch (error) {
      console.warn(`Failed to collect data for ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Extract ML features from repository data
   */
  private async extractFeatures(
    repo: GitHubRepository,
    analysis: RepositoryAnalysis,
    commits: any[],
    issues: any[],
    releases: any[],
    contributors: any[]
  ): Promise<TrainingDataPoint['features']> {
    const now = new Date();
    const repoCreated = new Date(repo.created_at);
    const lastPush = new Date(repo.pushed_at);
    
    // Calculate time-based metrics
    const ageDays = Math.floor((now.getTime() - repoCreated.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastCommit = Math.floor((now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate activity patterns
    const commits30Days = this.countRecentItems(commits, 30, 'commit.author.date');
    const commits90Days = this.countRecentItems(commits, 90, 'commit.author.date');
    const commits365Days = this.countRecentItems(commits, 365, 'commit.author.date');
    
    const issuesOpened30Days = this.countRecentItems(issues.filter(i => i.state === 'open'), 30, 'created_at');
    const issuesClosed30Days = this.countRecentItems(issues.filter(i => i.state === 'closed'), 30, 'closed_at');
    
    // Technical indicators
    const hasTests = await this.checkForTests(repo.owner.login, repo.name);
    const hasCI = await this.checkForCI(repo.owner.login, repo.name);
    const hasDocumentation = await this.checkForDocumentation(repo.owner.login, repo.name);
    
    // Language popularity (simplified scoring)
    const languagePopularityScore = this.getLanguagePopularityScore(repo.language);
    
    // Social signals (would be enhanced with real APIs)
    const socialSignals = await this.getSocialSignals(repo.full_name);
    
    return {
      // Basic metrics
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      size: repo.size,
      watchers_count: repo.watchers_count,
      
      // Time-based features
      age_days: ageDays,
      days_since_last_commit: daysSinceLastCommit,
      days_since_last_release: releases.length > 0 ? this.daysSince(releases[0].published_at) : -1,
      
      // Activity patterns
      commits_last_30_days: commits30Days,
      commits_last_90_days: commits90Days,
      commits_last_365_days: commits365Days,
      issues_opened_last_30_days: issuesOpened30Days,
      issues_closed_last_30_days: issuesClosed30Days,
      
      // Community metrics
      contributor_count: contributors.length,
      unique_contributors_last_year: this.getUniqueContributors(commits, 365),
      issue_response_time_avg: analysis.issueResponseTime,
      pr_merge_rate: this.calculatePRMergeRate(issues),
      
      // Technical indicators
      has_tests: hasTests,
      has_ci: hasCI,
      has_documentation: hasDocumentation,
      has_license: !!repo.license,
      has_contributing_guide: await this.checkForContributingGuide(repo.owner.login, repo.name),
      
      // Language and ecosystem
      language_popularity_score: languagePopularityScore,
      ecosystem_health_score: this.getEcosystemHealthScore(repo.language),
      
      // Dependency health
      dependency_count: analysis.dependencyAnalysis?.totalDependencies || 0,
      outdated_dependency_ratio: analysis.dependencyAnalysis ? 
        analysis.dependencyAnalysis.outdatedDependencies / Math.max(analysis.dependencyAnalysis.totalDependencies, 1) : 0,
      vulnerable_dependency_count: analysis.dependencyAnalysis?.vulnerableDependencies || 0,
      critical_vulnerability_count: analysis.dependencyAnalysis?.criticalVulnerabilities || 0,
      
      // Social signals
      mentioned_in_awesome_lists: socialSignals.awesomeListMentions > 0,
      stackoverflow_mentions: socialSignals.stackoverflowMentions,
      reddit_mentions: socialSignals.redditMentions,
      blog_post_mentions: socialSignals.blogPostMentions
    };
  }

  /**
   * Determine training labels based on repository state
   */
  private determineLabels(repo: GitHubRepository, analysis: RepositoryAnalysis): TrainingDataPoint['labels'] {
    // This is simplified - in reality, you'd have historical data about revival outcomes
    const daysSinceLastCommit = analysis.lastCommitAge;
    const hasRecentActivity = daysSinceLastCommit < 90;
    const hasOpenIssues = repo.open_issues_count > 0;
    const hasCommunityInterest = repo.stargazers_count > 50;
    
    // Simplified abandonment classification
    const isAbandoned = daysSinceLastCommit > 365 && repo.open_issues_count > 5;
    
    // Estimate revival success probability based on current metrics
    let revivalSuccessProbability = 0.5; // Base probability
    
    if (hasCommunityInterest) revivalSuccessProbability += 0.2;
    if (repo.forks_count > 10) revivalSuccessProbability += 0.1;
    if (analysis.dependencyAnalysis?.healthScore && analysis.dependencyAnalysis.healthScore > 70) revivalSuccessProbability += 0.1;
    if (repo.license) revivalSuccessProbability += 0.05;
    if (daysSinceLastCommit > 730) revivalSuccessProbability -= 0.2;
    if (analysis.dependencyAnalysis?.criticalVulnerabilities && analysis.dependencyAnalysis.criticalVulnerabilities > 0) revivalSuccessProbability -= 0.15;
    
    revivalSuccessProbability = Math.max(0, Math.min(1, revivalSuccessProbability));
    
    // Estimate effort based on complexity and technical debt
    const baseEffort = 30; // days
    let effortMultiplier = 1;
    
    if (analysis.technicalComplexity === 'high') effortMultiplier += 0.5;
    if (analysis.dependencyAnalysis?.outdatedDependencies && analysis.dependencyAnalysis.outdatedDependencies > 10) effortMultiplier += 0.3;
    if (analysis.dependencyAnalysis?.criticalVulnerabilities && analysis.dependencyAnalysis.criticalVulnerabilities > 0) effortMultiplier += 0.4;
    
    const estimatedEffortDays = Math.round(baseEffort * effortMultiplier);
    
    // Community adoption likelihood
    const communityAdoptionLikelihood = Math.min(1, (repo.stargazers_count + repo.forks_count) / 1000);
    
    return {
      is_abandoned: isAbandoned,
      revival_success_probability: revivalSuccessProbability,
      estimated_revival_effort_days: estimatedEffortDays,
      community_adoption_likelihood: communityAdoptionLikelihood
    };
  }

  /**
   * Train ML models on collected data
   */
  async trainModels(): Promise<void> {
    if (this.trainingData.length < 10) {
      throw new Error('Need at least 10 training samples to train models');
    }
    
    console.log(`🧠 Training ML models on ${this.trainingData.length} samples...`);
    
    // Train abandonment prediction model
    await this.trainAbandonmentModel();
    
    // Train revival success model
    await this.trainRevivalSuccessModel();
    
    // Train effort estimation model
    await this.trainEffortEstimationModel();
    
    // Train community adoption model
    await this.trainCommunityAdoptionModel();
    
    // Save all models
    await this.saveModels();
    
    console.log('✅ All ML models trained and saved');
  }

  /**
   * Train abandonment prediction model
   */
  private async trainAbandonmentModel(): Promise<void> {
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const labels = this.trainingData.map(d => d.labels.is_abandoned ? 1 : 0);
    
    // Use simple logistic regression for now
    const model = await this.trainLogisticRegression(features, labels);
    
    this.models.set('abandonment', {
      type: 'abandonment',
      algorithm: 'linear_regression',
      accuracy: model.accuracy,
      features: this.getFeatureNames(),
      weights: model.weights,
      model_data: model,
      trained_at: new Date().toISOString(),
      training_samples: this.trainingData.length
    });
  }

  /**
   * Train revival success prediction model
   */
  private async trainRevivalSuccessModel(): Promise<void> {
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const labels = this.trainingData.map(d => d.labels.revival_success_probability);
    
    const model = await this.trainLinearRegression(features, labels);
    
    this.models.set('revival_success', {
      type: 'revival_success',
      algorithm: 'linear_regression',
      accuracy: model.accuracy,
      features: this.getFeatureNames(),
      weights: model.weights,
      model_data: model,
      trained_at: new Date().toISOString(),
      training_samples: this.trainingData.length
    });
  }

  /**
   * Train effort estimation model
   */
  private async trainEffortEstimationModel(): Promise<void> {
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const labels = this.trainingData.map(d => d.labels.estimated_revival_effort_days);
    
    const model = await this.trainLinearRegression(features, labels);
    
    this.models.set('effort_estimation', {
      type: 'effort_estimation',
      algorithm: 'linear_regression',
      accuracy: model.accuracy,
      features: this.getFeatureNames(),
      weights: model.weights,
      model_data: model,
      trained_at: new Date().toISOString(),
      training_samples: this.trainingData.length
    });
  }

  /**
   * Train community adoption model
   */
  private async trainCommunityAdoptionModel(): Promise<void> {
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const labels = this.trainingData.map(d => d.labels.community_adoption_likelihood);
    
    const model = await this.trainLinearRegression(features, labels);
    
    this.models.set('community_adoption', {
      type: 'community_adoption',
      algorithm: 'linear_regression',
      accuracy: model.accuracy,
      features: this.getFeatureNames(),
      weights: model.weights,
      model_data: model,
      trained_at: new Date().toISOString(),
      training_samples: this.trainingData.length
    });
  }

  /**
   * Simple linear regression implementation
   */
  private async trainLinearRegression(features: number[][], labels: number[]): Promise<any> {
    // This is a simplified implementation
    // In production, you'd use a proper ML library like TensorFlow.js
    
    if (features.length === 0 || features[0].length === 0) {
      throw new Error('No features provided for training');
    }
    
    const numFeatures = features[0].length;
    const weights = new Array(numFeatures).fill(0);
    const learningRate = 0.01;
    const epochs = 1000;
    
    // Simple gradient descent
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (let i = 0; i < features.length; i++) {
        const prediction = this.predict(features[i], weights);
        const error = labels[i] - prediction;
        totalError += error * error;
        
        // Update weights
        for (let j = 0; j < weights.length; j++) {
          weights[j] += learningRate * error * features[i][j];
        }
      }
      
      // Early stopping if converged
      if (totalError < 0.001) break;
    }
    
    // Calculate accuracy (simplified)
    let correctPredictions = 0;
    for (let i = 0; i < features.length; i++) {
      const prediction = this.predict(features[i], weights);
      const error = Math.abs(labels[i] - prediction);
      if (error < 0.1) correctPredictions++;
    }
    
    const accuracy = correctPredictions / features.length;
    
    return {
      weights,
      accuracy,
      type: 'linear_regression'
    };
  }

  /**
   * Simple logistic regression for binary classification
   */
  private async trainLogisticRegression(features: number[][], labels: number[]): Promise<any> {
    // Simplified logistic regression implementation
    const model = await this.trainLinearRegression(features, labels);
    
    return {
      ...model,
      type: 'logistic_regression'
    };
  }

  /**
   * Make prediction using trained model
   */
  private predict(features: number[], weights: number[]): number {
    let sum = 0;
    for (let i = 0; i < features.length; i++) {
      sum += features[i] * weights[i];
    }
    return sum;
  }

  /**
   * Convert features object to array for ML
   */
  private featuresToArray(features: TrainingDataPoint['features']): number[] {
    return [
      features.stargazers_count,
      features.forks_count,
      features.open_issues_count,
      Math.log(features.size + 1), // Log transform for size
      features.watchers_count,
      features.age_days,
      features.days_since_last_commit,
      features.days_since_last_release,
      features.commits_last_30_days,
      features.commits_last_90_days,
      features.commits_last_365_days,
      features.issues_opened_last_30_days,
      features.issues_closed_last_30_days,
      features.contributor_count,
      features.unique_contributors_last_year,
      features.issue_response_time_avg,
      features.pr_merge_rate,
      features.has_tests ? 1 : 0,
      features.has_ci ? 1 : 0,
      features.has_documentation ? 1 : 0,
      features.has_license ? 1 : 0,
      features.has_contributing_guide ? 1 : 0,
      features.language_popularity_score,
      features.ecosystem_health_score,
      features.dependency_count,
      features.outdated_dependency_ratio,
      features.vulnerable_dependency_count,
      features.critical_vulnerability_count,
      features.mentioned_in_awesome_lists ? 1 : 0,
      features.stackoverflow_mentions,
      features.reddit_mentions,
      features.blog_post_mentions
    ];
  }

  /**
   * Get feature names for model interpretation
   */
  private getFeatureNames(): string[] {
    return [
      'stargazers_count', 'forks_count', 'open_issues_count', 'log_size', 'watchers_count',
      'age_days', 'days_since_last_commit', 'days_since_last_release',
      'commits_last_30_days', 'commits_last_90_days', 'commits_last_365_days',
      'issues_opened_last_30_days', 'issues_closed_last_30_days',
      'contributor_count', 'unique_contributors_last_year', 'issue_response_time_avg', 'pr_merge_rate',
      'has_tests', 'has_ci', 'has_documentation', 'has_license', 'has_contributing_guide',
      'language_popularity_score', 'ecosystem_health_score',
      'dependency_count', 'outdated_dependency_ratio', 'vulnerable_dependency_count', 'critical_vulnerability_count',
      'mentioned_in_awesome_lists', 'stackoverflow_mentions', 'reddit_mentions', 'blog_post_mentions'
    ];
  }

  /**
   * Helper methods for data collection
   */
  private async getRepositoryReleases(owner: string, repo: string): Promise<any[]> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-ML-Trainer/1.0.0'
        }
      });
      return response.ok ? await response.json() : [];
    } catch (error) {
      return [];
    }
  }

  private async getRepositoryContributors(owner: string, repo: string): Promise<any[]> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-ML-Trainer/1.0.0'
        }
      });
      return response.ok ? await response.json() : [];
    } catch (error) {
      return [];
    }
  }

  private countRecentItems(items: any[], days: number, dateField: string): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return items.filter(item => {
      const itemDate = this.getNestedProperty(item, dateField);
      return itemDate && new Date(itemDate) > cutoff;
    }).length;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private daysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getUniqueContributors(commits: any[], days: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const contributors = new Set();
    commits.forEach(commit => {
      const commitDate = new Date(commit.commit?.author?.date);
      if (commitDate > cutoff && commit.author?.login) {
        contributors.add(commit.author.login);
      }
    });
    
    return contributors.size;
  }

  private calculatePRMergeRate(issues: any[]): number {
    const pullRequests = issues.filter(issue => issue.pull_request);
    const mergedPRs = pullRequests.filter(pr => pr.state === 'closed' && pr.merged_at);
    
    return pullRequests.length > 0 ? mergedPRs.length / pullRequests.length : 0;
  }

  private getLanguagePopularityScore(language: string | null): number {
    const popularityScores: Record<string, number> = {
      'javascript': 95,
      'typescript': 90,
      'python': 92,
      'java': 85,
      'go': 80,
      'rust': 75,
      'cpp': 70,
      'csharp': 75,
      'php': 65,
      'ruby': 60,
      'swift': 70,
      'kotlin': 65
    };
    
    return language ? popularityScores[language.toLowerCase()] || 50 : 50;
  }

  private getEcosystemHealthScore(language: string | null): number {
    // Simplified ecosystem health scoring
    const ecosystemScores: Record<string, number> = {
      'javascript': 85,
      'typescript': 90,
      'python': 88,
      'java': 80,
      'go': 85,
      'rust': 88,
      'cpp': 70,
      'csharp': 75,
      'php': 65,
      'ruby': 70
    };
    
    return language ? ecosystemScores[language.toLowerCase()] || 60 : 60;
  }

  private async checkForTests(owner: string, repo: string): Promise<boolean> {
    // Check for common test directories and files
    const testPaths = ['test/', 'tests/', '__tests__/', 'spec/', '*.test.js', '*.spec.js'];
    
    try {
      for (const testPath of testPaths) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${testPath}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-ML-Trainer/1.0.0'
          }
        });
        
        if (response.ok) return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async checkForCI(owner: string, repo: string): Promise<boolean> {
    // Check for CI configuration files
    const ciPaths = ['.github/workflows/', '.travis.yml', '.circleci/', 'azure-pipelines.yml'];
    
    try {
      for (const ciPath of ciPaths) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${ciPath}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-ML-Trainer/1.0.0'
          }
        });
        
        if (response.ok) return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async checkForDocumentation(owner: string, repo: string): Promise<boolean> {
    // Check for documentation files
    const docPaths = ['docs/', 'documentation/', 'wiki/', 'README.md'];
    
    try {
      for (const docPath of docPaths) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${docPath}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-ML-Trainer/1.0.0'
          }
        });
        
        if (response.ok) return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async checkForContributingGuide(owner: string, repo: string): Promise<boolean> {
    const contributingPaths = ['CONTRIBUTING.md', 'CONTRIBUTING.rst', '.github/CONTRIBUTING.md'];
    
    try {
      for (const path of contributingPaths) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-ML-Trainer/1.0.0'
          }
        });
        
        if (response.ok) return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async getSocialSignals(repoFullName: string): Promise<{
    awesomeListMentions: number;
    stackoverflowMentions: number;
    redditMentions: number;
    blogPostMentions: number;
  }> {
    // This would integrate with various APIs to get social mention data
    // For now, return placeholder data
    return {
      awesomeListMentions: Math.floor(Math.random() * 5),
      stackoverflowMentions: Math.floor(Math.random() * 20),
      redditMentions: Math.floor(Math.random() * 10),
      blogPostMentions: Math.floor(Math.random() * 15)
    };
  }

  /**
   * Data persistence methods
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private async loadExistingData(): Promise<void> {
    const dataFile = path.join(this.dataPath, 'training-data.json');
    
    try {
      if (fs.existsSync(dataFile)) {
        const data = fs.readFileSync(dataFile, 'utf-8');
        this.trainingData = JSON.parse(data);
        console.log(`📚 Loaded ${this.trainingData.length} existing training samples`);
      }
    } catch (error) {
      console.warn('Failed to load existing training data:', error);
      this.trainingData = [];
    }
  }

  private async saveTrainingData(): Promise<void> {
    const dataFile = path.join(this.dataPath, 'training-data.json');
    
    try {
      fs.writeFileSync(dataFile, JSON.stringify(this.trainingData, null, 2));
      console.log(`💾 Saved ${this.trainingData.length} training samples`);
    } catch (error) {
      console.error('Failed to save training data:', error);
    }
  }

  private async saveModels(): Promise<void> {
    const modelsFile = path.join(this.dataPath, 'ml-models.json');
    
    try {
      const modelsData = Object.fromEntries(this.models);
      fs.writeFileSync(modelsFile, JSON.stringify(modelsData, null, 2));
      console.log(`🧠 Saved ${this.models.size} trained models`);
    } catch (error) {
      console.error('Failed to save models:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
