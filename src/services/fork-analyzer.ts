import { GitHubService } from './github';
import { RepositoryAnalyzer } from './analyzer';
import { GitHubRepository, RepositoryAnalysis } from '../types';

export interface ForkInfo {
  repository: GitHubRepository;
  analysis: RepositoryAnalysis;
  activityScore: number; // 0-100
  divergenceFromOriginal: number; // commits ahead
  lastActivityDays: number;
  hasRecentCommits: boolean;
  hasRecentReleases: boolean;
  maintainerResponsiveness: number; // 0-100
  forkRank: number; // 1-based ranking
}

export interface ForkComparison {
  original: GitHubRepository;
  totalForks: number;
  analyzedForks: number;
  activeForks: ForkInfo[];
  topRecommendations: ForkInfo[];
  insights: string[];
  bestForRevival?: ForkInfo;
  bestForContribution?: ForkInfo;
  mostDiverged?: ForkInfo;
  executionTime: number;
  timestamp: string;
}

export interface ForkAnalysisOptions {
  maxForks?: number; // Maximum forks to analyze (default: 20)
  minStars?: number; // Minimum stars to consider (default: 1)
  minActivity?: number; // Minimum days since last activity (default: 365)
  includeOriginal?: boolean; // Include original repo in comparison (default: true)
  sortBy?: 'activity' | 'stars' | 'divergence' | 'health';
}

export class ForkAnalyzer {
  private repositoryAnalyzer: RepositoryAnalyzer;

  constructor(private githubService: GitHubService) {
    this.repositoryAnalyzer = new RepositoryAnalyzer(githubService);
  }

  /**
   * Analyze forks of a repository
   */
  async analyzeForks(
    owner: string, 
    repo: string, 
    options: ForkAnalysisOptions = {}
  ): Promise<ForkComparison> {
    const startTime = Date.now();
    
    const {
      maxForks = 20,
      minStars = 1,
      minActivity = 365,
      includeOriginal = true,
      sortBy = 'activity'
    } = options;

    try {
      // Get the original repository
      const originalRepo = await this.githubService.getRepository(owner, repo);
      
      // Get all forks
      const allForks = await this.getAllForks(owner, repo, maxForks * 2); // Get extra to filter
      
      // Filter forks based on criteria
      const filteredForks = this.filterForks(allForks, minStars, minActivity);
      
      // Limit to maxForks for analysis
      const forksToAnalyze = filteredForks.slice(0, maxForks);
      
      // Analyze each fork
      const forkAnalyses: ForkInfo[] = [];
      
      // Analyze original repo if requested
      if (includeOriginal) {
        const originalAnalysis = await this.analyzeFork(originalRepo, originalRepo, true);
        if (originalAnalysis) {
          forkAnalyses.push(originalAnalysis);
        }
      }
      
      // Analyze forks in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < forksToAnalyze.length; i += batchSize) {
        const batch = forksToAnalyze.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (fork) => {
          try {
            return await this.analyzeFork(fork, originalRepo, false);
          } catch (error) {
            console.warn(`Failed to analyze fork ${fork.full_name}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            forkAnalyses.push(result.value);
          }
        });
        
        // Small delay between batches
        await this.delay(500);
      }
      
      // Sort and rank forks
      const sortedForks = this.sortForks(forkAnalyses, sortBy);
      const rankedForks = this.rankForks(sortedForks);
      
      // Generate insights and recommendations
      const insights = this.generateForkInsights(rankedForks, originalRepo);
      const recommendations = this.generateForkRecommendations(rankedForks);
      
      const executionTime = Date.now() - startTime;
      
      return {
        original: originalRepo,
        totalForks: allForks.length,
        analyzedForks: forkAnalyses.length,
        activeForks: rankedForks.filter(f => f.activityScore > 30),
        topRecommendations: recommendations.slice(0, 5),
        insights,
        bestForRevival: recommendations.find(f => f.analysis.revivalPotential > 60),
        bestForContribution: recommendations.find(f => f.maintainerResponsiveness > 70),
        mostDiverged: rankedForks.reduce((max, fork) => 
          fork.divergenceFromOriginal > (max?.divergenceFromOriginal || 0) ? fork : max, 
          rankedForks[0]
        ),
        executionTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Fork analysis failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get all forks of a repository
   */
  private async getAllForks(owner: string, repo: string, maxForks: number): Promise<GitHubRepository[]> {
    const forks: GitHubRepository[] = [];
    let page = 1;
    const perPage = 30;
    
    while (forks.length < maxForks) {
      try {
        const response = await this.githubService.searchRepositories(
          { 
            // Use search API to get forks with more control
            language: undefined,
            minStars: 0 
          }, 
          page, 
          Math.min(perPage, maxForks - forks.length)
        );
        
        // Alternative: Use forks API endpoint directly
        const forksResponse = await this.getForksDirect(owner, repo, page, perPage);
        
        if (forksResponse.length === 0) break;
        
        forks.push(...forksResponse);
        page++;
        
        // Avoid rate limiting
        await this.delay(200);
        
      } catch (error) {
        console.warn(`Failed to fetch forks page ${page}:`, error);
        break;
      }
    }
    
    return forks.slice(0, maxForks);
  }

  /**
   * Get forks directly using GitHub forks API
   */
  private async getForksDirect(owner: string, repo: string, page: number, perPage: number): Promise<GitHubRepository[]> {
    try {
      // This would use a direct API call to /repos/{owner}/{repo}/forks
      // For now, we'll simulate with a search
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks?page=${page}&per_page=${perPage}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-Hunter/1.0.0',
          // Add authorization if available
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn('Direct forks API failed, using fallback');
      return [];
    }
  }

  /**
   * Filter forks based on criteria
   */
  private filterForks(forks: GitHubRepository[], minStars: number, minActivityDays: number): GitHubRepository[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minActivityDays);
    
    return forks.filter(fork => {
      // Filter by minimum stars
      if (fork.stargazers_count < minStars) return false;
      
      // Filter by recent activity
      const lastPush = new Date(fork.pushed_at);
      if (lastPush < cutoffDate) return false;
      
      // Filter out archived or disabled repos
      if (fork.archived || fork.disabled) return false;
      
      return true;
    });
  }

  /**
   * Analyze a single fork
   */
  private async analyzeFork(
    fork: GitHubRepository, 
    original: GitHubRepository, 
    isOriginal: boolean
  ): Promise<ForkInfo | null> {
    try {
      // Get full repository analysis
      const analysis = await this.repositoryAnalyzer.analyzeRepository(fork);
      
      // Calculate fork-specific metrics
      const activityScore = this.calculateActivityScore(fork);
      const divergenceFromOriginal = await this.calculateDivergence(fork, original);
      const lastActivityDays = this.calculateDaysSince(fork.pushed_at);
      const hasRecentCommits = lastActivityDays < 30;
      const hasRecentReleases = await this.checkRecentReleases(fork);
      const maintainerResponsiveness = await this.calculateMaintainerResponsiveness(fork);
      
      return {
        repository: fork,
        analysis,
        activityScore,
        divergenceFromOriginal,
        lastActivityDays,
        hasRecentCommits,
        hasRecentReleases,
        maintainerResponsiveness,
        forkRank: 0 // Will be set during ranking
      };
      
    } catch (error) {
      console.warn(`Failed to analyze fork ${fork.full_name}:`, error);
      return null;
    }
  }

  /**
   * Calculate activity score for a fork
   */
  private calculateActivityScore(repo: GitHubRepository): number {
    let score = 0;
    
    // Recent activity (0-40 points)
    const daysSinceLastPush = this.calculateDaysSince(repo.pushed_at);
    if (daysSinceLastPush < 7) score += 40;
    else if (daysSinceLastPush < 30) score += 30;
    else if (daysSinceLastPush < 90) score += 20;
    else if (daysSinceLastPush < 180) score += 10;
    
    // Community engagement (0-30 points)
    score += Math.min(repo.stargazers_count / 2, 20);
    score += Math.min(repo.forks_count, 10);
    
    // Issues and maintenance (0-20 points)
    const issueActivity = Math.min(repo.open_issues_count / 5, 10);
    score += issueActivity;
    
    // Size indicates development (0-10 points)
    if (repo.size > 1000) score += 10;
    else if (repo.size > 100) score += 5;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate divergence from original repository
   */
  private async calculateDivergence(fork: GitHubRepository, original: GitHubRepository): Promise<number> {
    try {
      // This is a simplified calculation
      // In a real implementation, you'd compare commit histories
      
      // Use repository size and last update as proxies
      const sizeDifference = Math.abs(fork.size - original.size);
      const timeDifference = Math.abs(
        new Date(fork.pushed_at).getTime() - new Date(original.pushed_at).getTime()
      );
      
      // Convert to a rough "commits ahead" estimate
      const estimatedDivergence = Math.floor(sizeDifference / 100) + Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 7));
      
      return Math.max(0, estimatedDivergence);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check for recent releases
   */
  private async checkRecentReleases(repo: GitHubRepository): Promise<boolean> {
    try {
      // This would check the releases API
      // For now, we'll use a simple heuristic based on tags or recent activity
      
      const daysSinceUpdate = this.calculateDaysSince(repo.updated_at);
      return daysSinceUpdate < 90; // Assume recent activity indicates releases
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate maintainer responsiveness
   */
  private async calculateMaintainerResponsiveness(repo: GitHubRepository): Promise<number> {
    try {
      // This would analyze issue response times and PR merge rates
      // For now, we'll use a heuristic based on activity patterns
      
      const daysSinceUpdate = this.calculateDaysSince(repo.updated_at);
      const openIssuesRatio = repo.open_issues_count / Math.max(repo.stargazers_count / 10, 1);
      
      let score = 50; // Base score
      
      // Recent activity indicates responsiveness
      if (daysSinceUpdate < 7) score += 30;
      else if (daysSinceUpdate < 30) score += 20;
      else if (daysSinceUpdate < 90) score += 10;
      else if (daysSinceUpdate > 365) score -= 30;
      
      // Lower open issues ratio indicates better maintenance
      if (openIssuesRatio < 0.1) score += 20;
      else if (openIssuesRatio < 0.5) score += 10;
      else if (openIssuesRatio > 2) score -= 20;
      
      return Math.max(0, Math.min(score, 100));
    } catch (error) {
      return 50; // Default score
    }
  }

  /**
   * Sort forks by specified criteria
   */
  private sortForks(forks: ForkInfo[], sortBy: string): ForkInfo[] {
    return forks.sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return b.activityScore - a.activityScore;
        case 'stars':
          return b.repository.stargazers_count - a.repository.stargazers_count;
        case 'divergence':
          return b.divergenceFromOriginal - a.divergenceFromOriginal;
        case 'health':
          return b.analysis.revivalPotential - a.analysis.revivalPotential;
        default:
          return b.activityScore - a.activityScore;
      }
    });
  }

  /**
   * Rank forks and assign positions
   */
  private rankForks(forks: ForkInfo[]): ForkInfo[] {
    return forks.map((fork, index) => ({
      ...fork,
      forkRank: index + 1
    }));
  }

  /**
   * Generate insights about the fork ecosystem
   */
  private generateForkInsights(forks: ForkInfo[], original: GitHubRepository): string[] {
    const insights: string[] = [];
    
    if (forks.length === 0) {
      insights.push('No active forks found - original repository may be the only option');
      return insights;
    }
    
    const activeForks = forks.filter(f => f.activityScore > 30);
    const recentlyActiveForks = forks.filter(f => f.lastActivityDays < 30);
    const highlyDivergedForks = forks.filter(f => f.divergenceFromOriginal > 50);
    
    insights.push(`Found ${activeForks.length} active forks out of ${forks.length} analyzed`);
    
    if (recentlyActiveForks.length > 0) {
      insights.push(`${recentlyActiveForks.length} forks have commits within the last 30 days`);
    }
    
    if (highlyDivergedForks.length > 0) {
      insights.push(`${highlyDivergedForks.length} forks have significantly diverged from original`);
    }
    
    const bestFork = forks[0];
    if (bestFork && bestFork.activityScore > 60) {
      insights.push(`Top fork "${bestFork.repository.full_name}" shows strong activity (${bestFork.activityScore}/100)`);
    }
    
    const avgDependencyHealth = forks
      .map(f => f.analysis.dependencyAnalysis?.healthScore || 50)
      .reduce((sum, score) => sum + score, 0) / forks.length;
    
    if (avgDependencyHealth < 40) {
      insights.push('Most forks have poor dependency health - consider modernization');
    } else if (avgDependencyHealth > 80) {
      insights.push('Forks generally maintain good dependency health');
    }
    
    return insights;
  }

  /**
   * Generate fork recommendations
   */
  private generateForkRecommendations(forks: ForkInfo[]): ForkInfo[] {
    // Sort by a combination of activity, health, and responsiveness
    return forks.sort((a, b) => {
      const scoreA = (a.activityScore * 0.4) + (a.analysis.revivalPotential * 0.3) + (a.maintainerResponsiveness * 0.3);
      const scoreB = (b.activityScore * 0.4) + (b.analysis.revivalPotential * 0.3) + (b.maintainerResponsiveness * 0.3);
      return scoreB - scoreA;
    });
  }

  /**
   * Helper methods
   */
  private calculateDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
