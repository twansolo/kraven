import { GitHubRepository, RepositoryAnalysis } from '../types';
import { MLModel, MLPrediction, TrainingDataPoint } from './ml-trainer';
import * as fs from 'fs';
import * as path from 'path';

export interface PredictionConfig {
  useMLScoring: boolean;
  confidenceThreshold: number; // 0-1, minimum confidence to use ML predictions
  fallbackToRuleBase: boolean; // Use rule-based scoring if ML confidence is low
  modelVersion?: string;
}

export interface EnhancedRepositoryAnalysis extends RepositoryAnalysis {
  mlPrediction?: MLPrediction;
  mlConfidence?: number;
  scoringMethod: 'rule-based' | 'ml-enhanced' | 'hybrid';
  predictionFactors?: string[];
}

export class MLPredictor {
  private models: Map<string, MLModel> = new Map();
  private isModelsLoaded = false;
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
    this.loadModels();
  }

  /**
   * Get ML-enhanced predictions for a repository
   */
  async predict(
    repository: GitHubRepository, 
    analysis: RepositoryAnalysis,
    config: PredictionConfig = { useMLScoring: true, confidenceThreshold: 0.7, fallbackToRuleBase: true }
  ): Promise<MLPrediction | null> {
    
    if (!config.useMLScoring || !this.isModelsLoaded) {
      return null;
    }

    try {
      // Extract features from repository and analysis
      const features = await this.extractPredictionFeatures(repository, analysis);
      
      // Make predictions using trained models
      const abandonmentPrediction = this.predictAbandonment(features);
      const revivalSuccessPrediction = this.predictRevivalSuccess(features);
      const effortPrediction = this.predictEffort(features);
      const adoptionPrediction = this.predictCommunityAdoption(features);
      
      // Calculate overall confidence
      const confidence = this.calculateConfidence([
        abandonmentPrediction.confidence,
        revivalSuccessPrediction.confidence,
        effortPrediction.confidence,
        adoptionPrediction.confidence
      ]);
      
      // If confidence is too low, return null to fall back to rule-based
      if (confidence < config.confidenceThreshold) {
        return null;
      }
      
      // Generate key factors and recommendations
      const keyFactors = this.identifyKeyFactors(features, [
        abandonmentPrediction,
        revivalSuccessPrediction,
        effortPrediction,
        adoptionPrediction
      ]);
      
      const recommendations = this.generateMLRecommendations(
        abandonmentPrediction.value,
        revivalSuccessPrediction.value,
        effortPrediction.value,
        adoptionPrediction.value,
        keyFactors
      );
      
      return {
        abandonment_probability: abandonmentPrediction.value,
        revival_success_probability: revivalSuccessPrediction.value,
        estimated_effort_days: Math.round(effortPrediction.value),
        community_adoption_likelihood: adoptionPrediction.value,
        confidence_score: confidence,
        key_factors: keyFactors,
        recommendations
      };
      
    } catch (error) {
      console.warn('ML prediction failed:', error);
      return null;
    }
  }

  /**
   * Enhance existing analysis with ML predictions
   */
  async enhanceAnalysis(
    repository: GitHubRepository,
    analysis: RepositoryAnalysis,
    config?: PredictionConfig
  ): Promise<EnhancedRepositoryAnalysis> {
    
    const mlPrediction = await this.predict(repository, analysis, config);
    
    if (!mlPrediction) {
      return {
        ...analysis,
        scoringMethod: 'rule-based'
      };
    }
    
    // Combine ML predictions with rule-based analysis
    const enhancedAnalysis = this.combineMLWithRuleBased(analysis, mlPrediction);
    
    return {
      ...enhancedAnalysis,
      mlPrediction,
      mlConfidence: mlPrediction.confidence_score,
      scoringMethod: mlPrediction.confidence_score > 0.8 ? 'ml-enhanced' : 'hybrid',
      predictionFactors: mlPrediction.key_factors
    };
  }

  /**
   * Make abandonment prediction
   */
  private predictAbandonment(features: number[]): { value: number; confidence: number } {
    const model = this.models.get('abandonment');
    
    if (!model || !model.weights) {
      return { value: 0.5, confidence: 0.1 };
    }
    
    const rawPrediction = this.makePrediction(features, model.weights);
    const probability = this.sigmoid(rawPrediction); // Convert to probability
    
    return {
      value: probability,
      confidence: model.accuracy || 0.5
    };
  }

  /**
   * Make revival success prediction
   */
  private predictRevivalSuccess(features: number[]): { value: number; confidence: number } {
    const model = this.models.get('revival_success');
    
    if (!model || !model.weights) {
      return { value: 0.5, confidence: 0.1 };
    }
    
    const prediction = this.makePrediction(features, model.weights);
    const clampedPrediction = Math.max(0, Math.min(1, prediction));
    
    return {
      value: clampedPrediction,
      confidence: model.accuracy || 0.5
    };
  }

  /**
   * Make effort estimation prediction
   */
  private predictEffort(features: number[]): { value: number; confidence: number } {
    const model = this.models.get('effort_estimation');
    
    if (!model || !model.weights) {
      return { value: 30, confidence: 0.1 }; // Default 30 days
    }
    
    const prediction = this.makePrediction(features, model.weights);
    const clampedPrediction = Math.max(1, Math.min(365, prediction)); // 1-365 days
    
    return {
      value: clampedPrediction,
      confidence: model.accuracy || 0.5
    };
  }

  /**
   * Make community adoption prediction
   */
  private predictCommunityAdoption(features: number[]): { value: number; confidence: number } {
    const model = this.models.get('community_adoption');
    
    if (!model || !model.weights) {
      return { value: 0.5, confidence: 0.1 };
    }
    
    const prediction = this.makePrediction(features, model.weights);
    const clampedPrediction = Math.max(0, Math.min(1, prediction));
    
    return {
      value: clampedPrediction,
      confidence: model.accuracy || 0.5
    };
  }

  /**
   * Make prediction using linear model
   */
  private makePrediction(features: number[], weights: number[]): number {
    if (features.length !== weights.length) {
      throw new Error('Feature and weight dimensions must match');
    }
    
    let sum = 0;
    for (let i = 0; i < features.length; i++) {
      sum += features[i] * weights[i];
    }
    
    return sum;
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Calculate overall confidence from individual predictions
   */
  private calculateConfidence(confidences: number[]): number {
    // Use harmonic mean to be conservative
    const validConfidences = confidences.filter(c => c > 0);
    if (validConfidences.length === 0) return 0;
    
    const harmonicMean = validConfidences.length / validConfidences.reduce((sum, c) => sum + (1/c), 0);
    return Math.min(1, harmonicMean);
  }

  /**
   * Identify key factors driving predictions
   */
  private identifyKeyFactors(features: number[], predictions: any[]): string[] {
    const factors: string[] = [];
    const featureNames = this.getFeatureNames();
    
    // Simple feature importance based on magnitude
    const featureImportance = features.map((value, index) => ({
      name: featureNames[index],
      value,
      importance: Math.abs(value)
    }));
    
    // Sort by importance and take top factors
    featureImportance.sort((a, b) => b.importance - a.importance);
    
    const topFactors = featureImportance.slice(0, 5);
    
    topFactors.forEach(factor => {
      if (factor.name === 'days_since_last_commit' && factor.value > 365) {
        factors.push('Long period without commits');
      } else if (factor.name === 'stargazers_count' && factor.value > 1000) {
        factors.push('Strong community interest');
      } else if (factor.name === 'critical_vulnerability_count' && factor.value > 0) {
        factors.push('Critical security vulnerabilities');
      } else if (factor.name === 'commits_last_30_days' && factor.value > 5) {
        factors.push('Recent development activity');
      } else if (factor.name === 'contributor_count' && factor.value > 10) {
        factors.push('Active contributor community');
      }
    });
    
    return factors.length > 0 ? factors : ['Multiple contributing factors'];
  }

  /**
   * Generate ML-based recommendations
   */
  private generateMLRecommendations(
    abandonmentProb: number,
    revivalSuccessProb: number,
    effortDays: number,
    adoptionLikelihood: number,
    keyFactors: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (abandonmentProb > 0.8 && revivalSuccessProb > 0.7) {
      recommendations.push('🎯 PRIME CANDIDATE: High abandonment with excellent revival potential');
    }
    
    if (effortDays < 14 && revivalSuccessProb > 0.6) {
      recommendations.push('⚡ QUICK WIN: Low effort with good success probability');
    }
    
    if (adoptionLikelihood > 0.8) {
      recommendations.push('👥 COMMUNITY READY: High likelihood of community adoption');
    }
    
    if (abandonmentProb > 0.9) {
      recommendations.push('🚨 DEFINITELY ABANDONED: Clear abandonment signals detected');
    }
    
    if (effortDays > 90) {
      recommendations.push('⚠️ HIGH EFFORT: Significant time investment required');
    }
    
    if (revivalSuccessProb < 0.3) {
      recommendations.push('❌ LOW SUCCESS CHANCE: Consider alternative projects');
    }
    
    // Factor-based recommendations
    if (keyFactors.includes('Critical security vulnerabilities')) {
      recommendations.push('🛡️ SECURITY FOCUS: Address vulnerabilities first');
    }
    
    if (keyFactors.includes('Strong community interest')) {
      recommendations.push('💪 LEVERAGE COMMUNITY: Engage existing user base');
    }
    
    return recommendations;
  }

  /**
   * Combine ML predictions with rule-based analysis
   */
  private combineMLWithRuleBased(
    analysis: RepositoryAnalysis, 
    mlPrediction: MLPrediction
  ): RepositoryAnalysis {
    
    // Weight ML predictions based on confidence
    const mlWeight = mlPrediction.confidence_score;
    const ruleWeight = 1 - mlWeight;
    
    // Combine abandonment scores
    const mlAbandonmentScore = mlPrediction.abandonment_probability * 100;
    const combinedAbandonmentScore = Math.round(
      (mlAbandonmentScore * mlWeight) + (analysis.abandonmentScore * ruleWeight)
    );
    
    // Combine revival potential scores
    const mlRevivalScore = mlPrediction.revival_success_probability * 100;
    const combinedRevivalScore = Math.round(
      (mlRevivalScore * mlWeight) + (analysis.revivalPotential * ruleWeight)
    );
    
    // Enhance recommendations with ML insights
    const enhancedRecommendations = [
      ...analysis.recommendations,
      ...mlPrediction.recommendations
    ];
    
    // Add ML-specific reasons
    const enhancedReasons = [
      ...analysis.reasons,
      `ML confidence: ${Math.round(mlPrediction.confidence_score * 100)}%`,
      `Estimated effort: ${mlPrediction.estimated_effort_days} days`
    ];
    
    return {
      ...analysis,
      abandonmentScore: combinedAbandonmentScore,
      revivalPotential: combinedRevivalScore,
      recommendations: enhancedRecommendations,
      reasons: enhancedReasons
    };
  }

  /**
   * Extract features for prediction (same as training)
   */
  private async extractPredictionFeatures(
    repo: GitHubRepository, 
    analysis: RepositoryAnalysis
  ): Promise<number[]> {
    
    // This mirrors the feature extraction in MLTrainer
    // In a real implementation, you'd want to share this logic
    
    const now = new Date();
    const repoCreated = new Date(repo.created_at);
    const lastPush = new Date(repo.pushed_at);
    
    const ageDays = Math.floor((now.getTime() - repoCreated.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastCommit = Math.floor((now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24));
    
    // Simplified feature extraction (would be enhanced with real data)
    return [
      repo.stargazers_count,
      repo.forks_count,
      repo.open_issues_count,
      Math.log(repo.size + 1),
      repo.watchers_count,
      ageDays,
      daysSinceLastCommit,
      -1, // days_since_last_release (unknown)
      0, // commits_last_30_days (would need API call)
      0, // commits_last_90_days
      0, // commits_last_365_days
      0, // issues_opened_last_30_days
      0, // issues_closed_last_30_days
      0, // contributor_count (would need API call)
      0, // unique_contributors_last_year
      analysis.issueResponseTime,
      0.5, // pr_merge_rate (estimated)
      0, // has_tests (would need API call)
      0, // has_ci
      1, // has_documentation (assume true if has description)
      repo.license ? 1 : 0,
      0, // has_contributing_guide
      this.getLanguagePopularityScore(repo.language),
      this.getEcosystemHealthScore(repo.language),
      analysis.dependencyAnalysis?.totalDependencies || 0,
      analysis.dependencyAnalysis ? 
        analysis.dependencyAnalysis.outdatedDependencies / Math.max(analysis.dependencyAnalysis.totalDependencies, 1) : 0,
      analysis.dependencyAnalysis?.vulnerableDependencies || 0,
      analysis.dependencyAnalysis?.criticalVulnerabilities || 0,
      0, // mentioned_in_awesome_lists (would need API call)
      0, // stackoverflow_mentions
      0, // reddit_mentions
      0  // blog_post_mentions
    ];
  }

  /**
   * Load trained models from disk
   */
  private async loadModels(): Promise<void> {
    const modelsFile = path.join(this.dataPath, 'ml-models.json');
    
    try {
      if (fs.existsSync(modelsFile)) {
        const modelsData = JSON.parse(fs.readFileSync(modelsFile, 'utf-8'));
        
        Object.entries(modelsData).forEach(([key, modelData]) => {
          this.models.set(key, modelData as MLModel);
        });
        
        this.isModelsLoaded = this.models.size > 0;
        console.log(`🧠 Loaded ${this.models.size} ML models`);
      } else {
        console.log('📚 No trained models found - using rule-based scoring only');
        this.isModelsLoaded = false;
      }
    } catch (error) {
      console.warn('Failed to load ML models:', error);
      this.isModelsLoaded = false;
    }
  }

  /**
   * Check if ML models are available
   */
  isMLAvailable(): boolean {
    return this.isModelsLoaded && this.models.size >= 2; // Need at least abandonment and revival models
  }

  /**
   * Get model information for debugging
   */
  getModelInfo(): { [key: string]: any } {
    const info: { [key: string]: any } = {};
    
    this.models.forEach((model, key) => {
      info[key] = {
        type: model.type,
        algorithm: model.algorithm,
        accuracy: model.accuracy,
        trained_at: model.trained_at,
        training_samples: model.training_samples
      };
    });
    
    return info;
  }

  /**
   * Helper methods
   */
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
}
