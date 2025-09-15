import { GitHubService } from './github';
import { RepositoryAnalyzer } from './analyzer';
import { GitHubRepository, RepositoryAnalysis, TrainingDataPoint, MLModel } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface ImprovedTrainingConfig {
  useRealOutcomes: boolean; // Use curated real revival outcomes
  featureScaling: boolean; // Normalize features
  validationSplit: number; // Percentage for validation (0.2 = 20%)
  algorithmType: 'linear' | 'logistic' | 'ensemble';
  minAccuracy: number; // Minimum accuracy to save model
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  featureImportance: { [feature: string]: number };
}

export class ImprovedMLTrainer {
  private trainingData: TrainingDataPoint[] = [];
  private validationData: TrainingDataPoint[] = [];
  private models: Map<string, MLModel> = new Map();
  private dataPath: string;
  private curatedOutcomes: Map<string, any> = new Map();

  constructor(
    private githubService: GitHubService,
    private analyzer: RepositoryAnalyzer
  ) {
    this.dataPath = path.join(__dirname, '../../data');
    this.ensureDataDirectory();
    this.loadCuratedOutcomes();
    this.loadExistingData();
  }

  /**
   * Train improved ML models with better data quality
   */
  async trainImprovedModels(config: ImprovedTrainingConfig): Promise<ModelPerformance[]> {
    console.log('🧠 Starting improved ML training...');
    
    if (this.trainingData.length < 20) {
      throw new Error('Need at least 20 high-quality training samples');
    }

    // Split data into training and validation
    this.splitTrainingData(config.validationSplit);
    
    // Scale features if requested
    if (config.featureScaling) {
      this.scaleFeatures();
    }

    const performances: ModelPerformance[] = [];

    // Train each model with improved algorithms
    const modelTypes = ['abandonment', 'revival_success', 'effort_estimation'];
    
    for (const modelType of modelTypes) {
      console.log(`🎯 Training ${modelType} model...`);
      
      const performance = await this.trainImprovedModel(
        modelType as any, 
        config.algorithmType,
        config.minAccuracy
      );
      
      if (performance.accuracy >= config.minAccuracy) {
        console.log(`✅ ${modelType} model trained with ${Math.round(performance.accuracy * 100)}% accuracy`);
        performances.push(performance);
      } else {
        console.log(`❌ ${modelType} model accuracy too low (${Math.round(performance.accuracy * 100)}%), not saving`);
      }
    }

    await this.saveModels();
    return performances;
  }

  /**
   * Load curated revival outcomes for better training labels
   */
  private loadCuratedOutcomes(): void {
    // This would be a curated dataset of known revival outcomes
    // For now, we'll create some example data based on known successful/failed revivals
    
    const knownOutcomes = {
      // Successful revivals
      'bower/bower': { 
        revival_outcome: 'failed', // Bower was not successfully revived
        abandonment_confirmed: true,
        revival_attempts: 3,
        community_interest: 'high'
      },
      'angular/angular.js': { 
        revival_outcome: 'successful', // Angular 2+ was the revival
        abandonment_confirmed: true,
        revival_attempts: 1,
        community_interest: 'high'
      },
      'atom/atom': { 
        revival_outcome: 'failed', // Atom was discontinued
        abandonment_confirmed: true,
        revival_attempts: 2,
        community_interest: 'medium'
      },
      'meteor/meteor': { 
        revival_outcome: 'ongoing', // Still being maintained
        abandonment_confirmed: false,
        revival_attempts: 0,
        community_interest: 'medium'
      },
      'facebook/react': { 
        revival_outcome: 'successful', // Very active
        abandonment_confirmed: false,
        revival_attempts: 0,
        community_interest: 'very_high'
      },
      'microsoft/typescript': { 
        revival_outcome: 'successful', // Very active
        abandonment_confirmed: false,
        revival_attempts: 0,
        community_interest: 'very_high'
      },
      'jquery/jquery': { 
        revival_outcome: 'ongoing', // Still maintained but declining
        abandonment_confirmed: false,
        revival_attempts: 0,
        community_interest: 'medium'
      },
      'moment/moment': { 
        revival_outcome: 'failed', // Deprecated in favor of alternatives
        abandonment_confirmed: true,
        revival_attempts: 1,
        community_interest: 'low'
      }
    };

    Object.entries(knownOutcomes).forEach(([repo, outcome]) => {
      this.curatedOutcomes.set(repo, outcome);
    });

    console.log(`📚 Loaded ${this.curatedOutcomes.size} curated revival outcomes`);
  }

  /**
   * Improve training labels using curated data
   */
  private improveTrainingLabels(): void {
    this.trainingData.forEach(dataPoint => {
      const repoName = dataPoint.repository.full_name;
      const curatedOutcome = this.curatedOutcomes.get(repoName);
      
      if (curatedOutcome) {
        // Use real outcome data
        dataPoint.revival_outcome = curatedOutcome.revival_outcome;
        
        // Improve labels based on real outcomes
        switch (curatedOutcome.revival_outcome) {
          case 'successful':
            dataPoint.labels.is_abandoned = false;
            dataPoint.labels.revival_success_probability = 0.9;
            dataPoint.labels.community_adoption_likelihood = 0.8;
            break;
          case 'failed':
            dataPoint.labels.is_abandoned = true;
            dataPoint.labels.revival_success_probability = 0.1;
            dataPoint.labels.community_adoption_likelihood = 0.2;
            break;
          case 'ongoing':
            dataPoint.labels.is_abandoned = false;
            dataPoint.labels.revival_success_probability = 0.7;
            dataPoint.labels.community_adoption_likelihood = 0.6;
            break;
        }
        
        // Adjust effort based on community interest
        switch (curatedOutcome.community_interest) {
          case 'very_high':
            dataPoint.labels.estimated_revival_effort_days *= 0.5; // Easier with community
            break;
          case 'high':
            dataPoint.labels.estimated_revival_effort_days *= 0.7;
            break;
          case 'medium':
            dataPoint.labels.estimated_revival_effort_days *= 1.0;
            break;
          case 'low':
            dataPoint.labels.estimated_revival_effort_days *= 1.5;
            break;
        }
      }
    });
    
    console.log('📊 Improved training labels using curated outcomes');
  }

  /**
   * Split data into training and validation sets
   */
  private splitTrainingData(validationSplit: number): void {
    // Shuffle data
    const shuffled = [...this.trainingData].sort(() => Math.random() - 0.5);
    
    const validationSize = Math.floor(shuffled.length * validationSplit);
    this.validationData = shuffled.slice(0, validationSize);
    this.trainingData = shuffled.slice(validationSize);
    
    console.log(`📊 Split data: ${this.trainingData.length} training, ${this.validationData.length} validation`);
  }

  /**
   * Scale features to improve training
   */
  private scaleFeatures(): void {
    console.log('📏 Scaling features for better training...');
    
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const numFeatures = features[0].length;
    
    // Calculate mean and std for each feature
    const means = new Array(numFeatures).fill(0);
    const stds = new Array(numFeatures).fill(1);
    
    // Calculate means
    for (let i = 0; i < numFeatures; i++) {
      means[i] = features.reduce((sum, feature) => sum + feature[i], 0) / features.length;
    }
    
    // Calculate standard deviations
    for (let i = 0; i < numFeatures; i++) {
      const variance = features.reduce((sum, feature) => 
        sum + Math.pow(feature[i] - means[i], 2), 0
      ) / features.length;
      stds[i] = Math.sqrt(variance) || 1; // Avoid division by zero
    }
    
    // Apply scaling to all data points
    [...this.trainingData, ...this.validationData].forEach(dataPoint => {
      const originalFeatures = this.featuresToArray(dataPoint.features);
      const scaledFeatures = originalFeatures.map((value, i) => (value - means[i]) / stds[i]);
      
      // Update the features (this is simplified - would need proper feature object update)
      // For now, we'll store scaling parameters for prediction time
    });
    
    // Store scaling parameters for use during prediction
    fs.writeFileSync(
      path.join(this.dataPath, 'feature-scaling.json'),
      JSON.stringify({ means, stds }, null, 2)
    );
  }

  /**
   * Train a single model with improved algorithms
   */
  private async trainImprovedModel(
    modelType: 'abandonment' | 'revival_success' | 'effort_estimation',
    algorithm: 'linear' | 'logistic' | 'ensemble',
    minAccuracy: number
  ): Promise<ModelPerformance> {
    
    const features = this.trainingData.map(d => this.featuresToArray(d.features));
    const labels = this.getLabelsForModel(modelType);
    
    const validationFeatures = this.validationData.map(d => this.featuresToArray(d.features));
    const validationLabels = this.getValidationLabelsForModel(modelType);
    
    let model: any;
    let performance: ModelPerformance;
    
    switch (algorithm) {
      case 'logistic':
        model = await this.trainLogisticRegression(features, labels);
        performance = this.evaluateModel(model, validationFeatures, validationLabels, modelType);
        break;
      case 'ensemble':
        model = await this.trainEnsembleModel(features, labels);
        performance = this.evaluateModel(model, validationFeatures, validationLabels, modelType);
        break;
      default:
        model = await this.trainImprovedLinearRegression(features, labels);
        performance = this.evaluateModel(model, validationFeatures, validationLabels, modelType);
    }
    
    // Save model if accuracy is acceptable
    if (performance.accuracy >= minAccuracy) {
      this.models.set(modelType, {
        type: modelType,
        algorithm: algorithm === 'linear' ? 'linear_regression' : algorithm as any,
        accuracy: performance.accuracy,
        features: this.getFeatureNames(),
        weights: model.weights,
        model_data: model,
        trained_at: new Date().toISOString(),
        training_samples: this.trainingData.length
      });
    }
    
    return performance;
  }

  /**
   * Improved linear regression with regularization
   */
  private async trainImprovedLinearRegression(features: number[][], labels: number[]): Promise<any> {
    if (features.length === 0 || features[0].length === 0) {
      throw new Error('No features provided for training');
    }
    
    const numFeatures = features[0].length;
    let weights = new Array(numFeatures).fill(0);
    const learningRate = 0.001; // Lower learning rate
    const epochs = 5000; // More epochs
    const regularization = 0.01; // L2 regularization
    
    let bestWeights = [...weights];
    let bestLoss = Infinity;
    let patience = 0;
    const maxPatience = 100;
    
    // Improved gradient descent with early stopping
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      const gradients = new Array(numFeatures).fill(0);
      
      // Calculate gradients
      for (let i = 0; i < features.length; i++) {
        const prediction = this.predict(features[i], weights);
        const error = labels[i] - prediction;
        totalLoss += error * error;
        
        // Accumulate gradients
        for (let j = 0; j < weights.length; j++) {
          gradients[j] += error * features[i][j];
        }
      }
      
      // Update weights with regularization
      for (let j = 0; j < weights.length; j++) {
        const gradient = gradients[j] / features.length;
        const regularizationTerm = regularization * weights[j];
        weights[j] += learningRate * (gradient - regularizationTerm);
      }
      
      // Early stopping
      const avgLoss = totalLoss / features.length;
      if (avgLoss < bestLoss) {
        bestLoss = avgLoss;
        bestWeights = [...weights];
        patience = 0;
      } else {
        patience++;
        if (patience > maxPatience) {
          console.log(`  Early stopping at epoch ${epoch}`);
          break;
        }
      }
      
      // Log progress
      if (epoch % 1000 === 0) {
        console.log(`  Epoch ${epoch}: Loss = ${avgLoss.toFixed(6)}`);
      }
    }
    
    return {
      weights: bestWeights,
      loss: bestLoss,
      type: 'improved_linear_regression'
    };
  }

  /**
   * Evaluate model performance on validation data
   */
  private evaluateModel(
    model: any, 
    validationFeatures: number[][], 
    validationLabels: number[],
    modelType: string
  ): ModelPerformance {
    
    if (validationFeatures.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        confusionMatrix: [[0, 0], [0, 0]],
        featureImportance: {}
      };
    }

    const predictions = validationFeatures.map(features => 
      this.predict(features, model.weights)
    );
    
    // Calculate metrics based on model type
    if (modelType === 'abandonment') {
      // Binary classification metrics
      return this.calculateBinaryMetrics(predictions, validationLabels);
    } else {
      // Regression metrics
      return this.calculateRegressionMetrics(predictions, validationLabels);
    }
  }

  /**
   * Calculate binary classification metrics
   */
  private calculateBinaryMetrics(predictions: number[], labels: number[]): ModelPerformance {
    const threshold = 0.5;
    let tp = 0, fp = 0, tn = 0, fn = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i] > threshold ? 1 : 0;
      const actual = labels[i] > threshold ? 1 : 0;
      
      if (predicted === 1 && actual === 1) tp++;
      else if (predicted === 1 && actual === 0) fp++;
      else if (predicted === 0 && actual === 0) tn++;
      else if (predicted === 0 && actual === 1) fn++;
    }
    
    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    return {
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: [[tn, fp], [fn, tp]],
      featureImportance: this.calculateFeatureImportance()
    };
  }

  /**
   * Calculate regression metrics
   */
  private calculateRegressionMetrics(predictions: number[], labels: number[]): ModelPerformance {
    const n = predictions.length;
    let mse = 0;
    let mae = 0;
    
    for (let i = 0; i < n; i++) {
      const error = predictions[i] - labels[i];
      mse += error * error;
      mae += Math.abs(error);
    }
    
    mse /= n;
    mae /= n;
    
    // Calculate R-squared
    const labelMean = labels.reduce((sum, label) => sum + label, 0) / n;
    let totalVariance = 0;
    for (let i = 0; i < n; i++) {
      totalVariance += Math.pow(labels[i] - labelMean, 2);
    }
    
    const rSquared = 1 - (mse * n) / totalVariance;
    const accuracy = Math.max(0, rSquared); // Use R-squared as accuracy measure
    
    return {
      accuracy,
      precision: 1 - mae, // Simplified precision based on MAE
      recall: accuracy,
      f1Score: accuracy,
      confusionMatrix: [[0, 0], [0, 0]], // Not applicable for regression
      featureImportance: this.calculateFeatureImportance()
    };
  }

  /**
   * Calculate feature importance (simplified)
   */
  private calculateFeatureImportance(): { [feature: string]: number } {
    const featureNames = this.getFeatureNames();
    const importance: { [feature: string]: number } = {};
    
    // Simple feature importance based on variance
    featureNames.forEach((name, index) => {
      const values = this.trainingData.map(d => this.featuresToArray(d.features)[index]);
      const variance = this.calculateVariance(values);
      importance[name] = variance;
    });
    
    return importance;
  }

  /**
   * Calculate variance for feature importance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Get labels for specific model type
   */
  private getLabelsForModel(modelType: string): number[] {
    return this.trainingData.map(d => {
      switch (modelType) {
        case 'abandonment':
          return d.labels.is_abandoned ? 1 : 0;
        case 'revival_success':
          return d.labels.revival_success_probability;
        case 'effort_estimation':
          return d.labels.estimated_revival_effort_days;
        default:
          return 0;
      }
    });
  }

  /**
   * Get validation labels for specific model type
   */
  private getValidationLabelsForModel(modelType: string): number[] {
    return this.validationData.map(d => {
      switch (modelType) {
        case 'abandonment':
          return d.labels.is_abandoned ? 1 : 0;
        case 'revival_success':
          return d.labels.revival_success_probability;
        case 'effort_estimation':
          return d.labels.estimated_revival_effort_days;
        default:
          return 0;
      }
    });
  }

  /**
   * Create training report
   */
  async generateTrainingReport(performances: ModelPerformance[]): Promise<void> {
    const report = {
      training_date: new Date().toISOString(),
      total_samples: this.trainingData.length + this.validationData.length,
      training_samples: this.trainingData.length,
      validation_samples: this.validationData.length,
      model_performances: performances,
      feature_names: this.getFeatureNames(),
      recommendations: this.generateTrainingRecommendations(performances)
    };
    
    fs.writeFileSync(
      path.join(this.dataPath, 'training-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('📋 Training report saved to data/training-report.json');
  }

  /**
   * Generate recommendations for improving training
   */
  private generateTrainingRecommendations(performances: ModelPerformance[]): string[] {
    const recommendations: string[] = [];
    
    const avgAccuracy = performances.reduce((sum, p) => sum + p.accuracy, 0) / performances.length;
    
    if (avgAccuracy < 0.6) {
      recommendations.push('🔄 Consider collecting more diverse training data');
      recommendations.push('📊 Try different algorithms (ensemble methods)');
      recommendations.push('🎯 Improve feature engineering');
    }
    
    if (avgAccuracy < 0.4) {
      recommendations.push('⚠️ Current models may not be reliable - use rule-based scoring');
    }
    
    if (this.trainingData.length < 100) {
      recommendations.push('📈 Collect more training samples for better accuracy');
    }
    
    if (performances.some(p => p.accuracy > 0.8)) {
      recommendations.push('✅ Some models show good performance - consider using ML-enhanced mode');
    }
    
    return recommendations;
  }

  /**
   * Helper methods (reuse from original trainer)
   */
  private featuresToArray(features: TrainingDataPoint['features']): number[] {
    return [
      Math.log(features.stargazers_count + 1), // Log transform for better scaling
      Math.log(features.forks_count + 1),
      Math.log(features.open_issues_count + 1),
      Math.log(features.size + 1),
      Math.log(features.watchers_count + 1),
      features.age_days / 365, // Normalize to years
      features.days_since_last_commit / 365,
      features.days_since_last_release / 365,
      features.commits_last_30_days,
      features.commits_last_90_days,
      features.commits_last_365_days,
      features.issues_opened_last_30_days,
      features.issues_closed_last_30_days,
      features.contributor_count,
      features.unique_contributors_last_year,
      features.issue_response_time_avg / 30, // Normalize to months
      features.pr_merge_rate,
      features.has_tests ? 1 : 0,
      features.has_ci ? 1 : 0,
      features.has_documentation ? 1 : 0,
      features.has_license ? 1 : 0,
      features.has_contributing_guide ? 1 : 0,
      features.language_popularity_score / 100,
      features.ecosystem_health_score / 100,
      Math.log(features.dependency_count + 1),
      features.outdated_dependency_ratio,
      features.vulnerable_dependency_count,
      features.critical_vulnerability_count,
      features.mentioned_in_awesome_lists ? 1 : 0,
      Math.log(features.stackoverflow_mentions + 1),
      Math.log(features.reddit_mentions + 1),
      Math.log(features.blog_post_mentions + 1)
    ];
  }

  private getFeatureNames(): string[] {
    return [
      'log_stargazers_count', 'log_forks_count', 'log_open_issues_count', 'log_size', 'log_watchers_count',
      'age_years', 'years_since_last_commit', 'years_since_last_release',
      'commits_last_30_days', 'commits_last_90_days', 'commits_last_365_days',
      'issues_opened_last_30_days', 'issues_closed_last_30_days',
      'contributor_count', 'unique_contributors_last_year', 'issue_response_months', 'pr_merge_rate',
      'has_tests', 'has_ci', 'has_documentation', 'has_license', 'has_contributing_guide',
      'language_popularity_norm', 'ecosystem_health_norm',
      'log_dependency_count', 'outdated_dependency_ratio', 'vulnerable_dependency_count', 'critical_vulnerability_count',
      'mentioned_in_awesome_lists', 'log_stackoverflow_mentions', 'log_reddit_mentions', 'log_blog_post_mentions'
    ];
  }

  private predict(features: number[], weights: number[]): number {
    if (features.length !== weights.length) {
      throw new Error('Feature and weight dimensions must match');
    }
    
    let sum = 0;
    for (let i = 0; i < features.length; i++) {
      sum += features[i] * weights[i];
    }
    
    return sum;
  }

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
        
        // Improve labels using curated outcomes
        this.improveTrainingLabels();
        
        console.log(`📚 Loaded ${this.trainingData.length} training samples with improved labels`);
      }
    } catch (error) {
      console.warn('Failed to load existing training data:', error);
      this.trainingData = [];
    }
  }

  private async saveModels(): Promise<void> {
    const modelsFile = path.join(this.dataPath, 'improved-ml-models.json');
    
    try {
      const modelsData = Object.fromEntries(this.models);
      fs.writeFileSync(modelsFile, JSON.stringify(modelsData, null, 2));
      console.log(`🧠 Saved ${this.models.size} improved ML models`);
    } catch (error) {
      console.error('Failed to save models:', error);
    }
  }
}
