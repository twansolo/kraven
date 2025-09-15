import { GitHubService } from './services/github';
import { RepositoryAnalyzer } from './services/analyzer';
import { MLPredictor, EnhancedRepositoryAnalysis, PredictionConfig } from './services/ml-predictor';
import { SearchFilters, HuntResults, RepositoryAnalysis } from './types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from multiple locations
function loadEnvironmentVariables() {
  // First try current working directory
  dotenv.config();
  
  // If no GITHUB_TOKEN found, try the kraven installation directory
  if (!process.env.GITHUB_TOKEN) {
    // This file is compiled to dist/kraven.js, so we need to go up to the project root
    // __dirname points to dist/ folder, so go up one level to get project root
    const kravenDir = path.join(__dirname, '..');
    const kravenEnvPath = path.join(kravenDir, '.env');
    
    if (fs.existsSync(kravenEnvPath)) {
      dotenv.config({ path: kravenEnvPath });
    }
  }
}

// Load environment variables
loadEnvironmentVariables();

export class KravenHunter {
  public githubService: GitHubService; // Make public for fork analyzer access
  private analyzer: RepositoryAnalyzer;
  private mlPredictor: MLPredictor;

  constructor(githubToken?: string) {
    this.githubService = new GitHubService(githubToken || process.env.GITHUB_TOKEN);
    this.analyzer = new RepositoryAnalyzer(this.githubService);
    this.mlPredictor = new MLPredictor();
  }

  /**
   * Hunt for abandoned repositories
   */
  async hunt(
    filters: SearchFilters, 
    maxResults = 10, 
    useML = false, 
    mlConfig?: PredictionConfig
  ): Promise<HuntResults> {
    const startTime = Date.now();
    
    // Search repositories (use enhanced search for private repo support)
    const searchResponse = await this.githubService.searchRepositoriesEnhanced(filters, 1, Math.min(maxResults * 2, 100));
    
    // Analyze repositories (limit to maxResults)
    const repositoriesToAnalyze = searchResponse.items.slice(0, maxResults);
    const analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[] = [];
    
    for (const repo of repositoriesToAnalyze) {
      try {
        let analysis: RepositoryAnalysis | EnhancedRepositoryAnalysis;
        
        if (useML && this.mlPredictor.isMLAvailable()) {
          // Use ML-enhanced analysis
          const baseAnalysis = await this.analyzer.analyzeRepository(repo);
          analysis = await this.mlPredictor.enhanceAnalysis(repo, baseAnalysis, mlConfig);
        } else {
          // Use standard rule-based analysis
          analysis = await this.analyzer.analyzeRepository(repo);
          (analysis as EnhancedRepositoryAnalysis).scoringMethod = 'rule-based';
        }
        
        analyses.push(analysis);
        
        // Add small delay to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        console.warn(`Failed to analyze ${repo.full_name}:`, error instanceof Error ? error.message : error);
      }
    }
    
    // Sort by revival potential (prioritize ML predictions if available)
    analyses.sort((a, b) => {
      const aScore = (a as EnhancedRepositoryAnalysis).mlPrediction ? 
        (a as EnhancedRepositoryAnalysis).mlPrediction!.revival_success_probability * 100 : 
        a.revivalPotential;
      const bScore = (b as EnhancedRepositoryAnalysis).mlPrediction ? 
        (b as EnhancedRepositoryAnalysis).mlPrediction!.revival_success_probability * 100 : 
        b.revivalPotential;
      return bScore - aScore;
    });
    
    const executionTime = Date.now() - startTime;
    
    return {
      query: this.buildQueryString(filters),
      filters,
      totalFound: searchResponse.total_count,
      analyzed: analyses,
      executionTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze a specific repository with optional ML enhancement
   */
  async analyzeRepository(
    fullName: string, 
    useML = false, 
    mlConfig?: PredictionConfig
  ): Promise<RepositoryAnalysis | EnhancedRepositoryAnalysis> {
    const [owner, repo] = fullName.split('/');
    
    if (!owner || !repo) {
      throw new Error('Repository must be in format "owner/repo"');
    }
    
    const repository = await this.githubService.getRepository(owner, repo);
    
    if (useML && this.mlPredictor.isMLAvailable()) {
      // Use ML-enhanced analysis
      const baseAnalysis = await this.analyzer.analyzeRepository(repository);
      return await this.mlPredictor.enhanceAnalysis(repository, baseAnalysis, mlConfig);
    } else {
      // Use standard rule-based analysis
      const analysis = await this.analyzer.analyzeRepository(repository);
      return {
        ...analysis,
        scoringMethod: 'rule-based'
      } as EnhancedRepositoryAnalysis;
    }
  }

  /**
   * Check if ML models are available
   */
  isMLAvailable(): boolean {
    return this.mlPredictor.isMLAvailable();
  }

  /**
   * Get ML model information
   */
  getMLModelInfo(): { [key: string]: any } {
    return this.mlPredictor.getModelInfo();
  }

  /**
   * Check GitHub API rate limit
   */
  async checkRateLimit() {
    return await this.githubService.getRateLimit();
  }

  /**
   * Build a human-readable query string
   */
  private buildQueryString(filters: SearchFilters): string {
    const parts: string[] = [];
    
    if (filters.language) parts.push(`language:${filters.language}`);
    if (filters.category) parts.push(`category:${filters.category}`);
    if (filters.minStars) parts.push(`stars:>=${filters.minStars}`);
    if (filters.maxStars) parts.push(`stars:<=${filters.maxStars}`);
    if (filters.pushedBefore) parts.push(`pushed:<${filters.pushedBefore}`);
    if (filters.pushedAfter) parts.push(`pushed:>${filters.pushedAfter}`);
    
    return parts.join(' ');
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
