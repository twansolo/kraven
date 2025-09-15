import { GitHubService } from './services/github';
import { RepositoryAnalyzer } from './services/analyzer';
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

  constructor(githubToken?: string) {
    this.githubService = new GitHubService(githubToken || process.env.GITHUB_TOKEN);
    this.analyzer = new RepositoryAnalyzer(this.githubService);
  }

  /**
   * Hunt for abandoned repositories
   */
  async hunt(filters: SearchFilters, maxResults = 10): Promise<HuntResults> {
    const startTime = Date.now();
    
    // Search repositories
    const searchResponse = await this.githubService.searchRepositories(filters, 1, Math.min(maxResults * 2, 100));
    
    // Analyze repositories (limit to maxResults)
    const repositoriesToAnalyze = searchResponse.items.slice(0, maxResults);
    const analyses: RepositoryAnalysis[] = [];
    
    for (const repo of repositoriesToAnalyze) {
      try {
        const analysis = await this.analyzer.analyzeRepository(repo);
        analyses.push(analysis);
        
        // Add small delay to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        console.warn(`Failed to analyze ${repo.full_name}:`, error instanceof Error ? error.message : error);
      }
    }
    
    // Sort by revival potential (descending)
    analyses.sort((a, b) => b.revivalPotential - a.revivalPotential);
    
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
   * Analyze a specific repository
   */
  async analyzeRepository(fullName: string): Promise<RepositoryAnalysis> {
    const [owner, repo] = fullName.split('/');
    
    if (!owner || !repo) {
      throw new Error('Repository must be in format "owner/repo"');
    }
    
    const repository = await this.githubService.getRepository(owner, repo);
    return await this.analyzer.analyzeRepository(repository);
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
