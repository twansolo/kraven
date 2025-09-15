import { GitHubService } from './github';
import { RepositoryAnalyzer } from './analyzer';
import { GitHubRepository, RepositoryAnalysis, EnhancedRepositoryAnalysis, PredictionConfig } from '../types';

export interface OrganizationInfo {
  login: string;
  name: string;
  type: 'Organization' | 'User';
  description?: string;
  company?: string;
  location?: string;
  email?: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  avatar_url: string;
  html_url: string;
}

export interface OrganizationScanFilters {
  includePrivate?: boolean; // Include private repos (requires appropriate token)
  minStars?: number; // Only analyze repos with minimum stars
  maxStars?: number; // Only analyze repos with maximum stars
  languages?: string[]; // Filter by specific languages
  excludeArchived?: boolean; // Exclude archived repositories
  excludeForks?: boolean; // Exclude forked repositories
  pushedBefore?: string; // Only repos last updated before date
  pushedAfter?: string; // Only repos last updated after date
  sortBy?: 'updated' | 'created' | 'pushed' | 'full_name' | 'stars';
  order?: 'asc' | 'desc';
}

export interface OrganizationScanResults {
  organization: OrganizationInfo;
  totalRepositories: number;
  scannedRepositories: number;
  repositoryAnalyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[];
  abandonedProjects: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[];
  primeRevivalCandidates: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[];
  healthSummary: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
  };
  languageBreakdown: { [language: string]: number };
  insights: string[];
  recommendations: string[];
  executionTime: number;
  timestamp: string;
}

export class OrganizationScanner {
  constructor(
    private githubService: GitHubService,
    private analyzer: RepositoryAnalyzer
  ) {}

  /**
   * Scan all repositories for an organization or user
   */
  async scanOrganization(
    orgOrUser: string,
    filters: OrganizationScanFilters = {},
    useML = false,
    mlConfig?: PredictionConfig,
    maxRepos = 50
  ): Promise<OrganizationScanResults> {
    const startTime = Date.now();
    
    console.log(`🔍 Scanning ${orgOrUser} repositories...`);
    
    try {
      // Get organization/user information
      const orgInfo = await this.getOrganizationInfo(orgOrUser);
      console.log(`📊 Found ${orgInfo.type}: ${orgInfo.name || orgInfo.login} (${orgInfo.public_repos} public repos)`);
      
      // Get all repositories
      const allRepositories = await this.getAllRepositories(orgOrUser, filters, maxRepos);
      console.log(`📚 Retrieved ${allRepositories.length} repositories for analysis`);
      
      // Filter repositories based on criteria
      const filteredRepositories = this.filterRepositories(allRepositories, filters);
      console.log(`🎯 Analyzing ${filteredRepositories.length} repositories after filtering`);
      
      // Analyze repositories in batches
      const analyses = await this.batchAnalyzeRepositories(
        filteredRepositories,
        useML,
        mlConfig
      );
      
      // Generate insights and recommendations
      const results = this.generateScanResults(
        orgInfo,
        allRepositories.length,
        analyses,
        Date.now() - startTime
      );
      
      return results;
      
    } catch (error) {
      throw new Error(`Organization scan failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get organization or user information using GitHubService
   */
  private async getOrganizationInfo(orgOrUser: string): Promise<OrganizationInfo> {
    try {
      // Try as organization first using axios (like GitHubService)
      const orgResponse = await this.githubService.api.get(`/orgs/${orgOrUser}`);
      return { ...orgResponse.data, type: 'Organization' };
    } catch (orgError) {
      try {
        // Try as user if organization fails
        const userResponse = await this.githubService.api.get(`/users/${orgOrUser}`);
        return { ...userResponse.data, type: 'User' };
      } catch (userError) {
        throw new Error(`Organization or user '${orgOrUser}' not found`);
      }
    }
  }

  /**
   * Get all repositories for an organization or user using GitHubService
   */
  private async getAllRepositories(
    orgOrUser: string,
    filters: OrganizationScanFilters,
    maxRepos: number
  ): Promise<GitHubRepository[]> {
    const repositories: GitHubRepository[] = [];
    let page = 1;
    const perPage = 30; // Smaller page size for better rate limiting
    
    while (repositories.length < maxRepos) {
      try {
        let pageRepos: GitHubRepository[] = [];
        
        // Try organization endpoint first
        try {
          const orgResponse = await this.githubService.api.get(`/orgs/${orgOrUser}/repos`, {
            params: {
              page,
              per_page: perPage,
              sort: filters.sortBy || 'updated',
              direction: filters.order || 'desc',
              type: 'public' // Explicitly request public repos
            }
          });
          pageRepos = orgResponse.data;
        } catch (orgError) {
          // Try user endpoint if organization fails
          try {
            const userResponse = await this.githubService.api.get(`/users/${orgOrUser}/repos`, {
              params: {
                page,
                per_page: perPage,
                sort: filters.sortBy || 'updated',
                direction: filters.order || 'desc',
                type: 'public' // Explicitly request public repos
              }
            });
            pageRepos = userResponse.data;
          } catch (userError) {
            console.error(`Failed to fetch repositories for ${orgOrUser} on page ${page}`);
            throw userError;
          }
        }
        
        if (pageRepos.length === 0) {
          break; // No more repositories
        }
        
        repositories.push(...pageRepos);
        page++;
        
        // Rate limiting
        await this.delay(300);
        
        // GitHub API pagination limit
        if (page > 10) {
          break; // Max 300 repos (10 pages * 30 per page)
        }
        
      } catch (error) {
        console.warn(`Failed to fetch repositories page ${page} for ${orgOrUser}`);
        break;
      }
    }
    return repositories.slice(0, maxRepos);
  }


  /**
   * Filter repositories based on criteria
   */
  private filterRepositories(
    repositories: GitHubRepository[],
    filters: OrganizationScanFilters
  ): GitHubRepository[] {
    return repositories.filter(repo => {
      // Exclude archived if requested
      if (filters.excludeArchived && repo.archived) return false;
      
      // Exclude forks if requested (fork property may not exist in our interface)
      if (filters.excludeForks && (repo as any).fork) return false;
      
      // Filter by stars
      if (filters.minStars && repo.stargazers_count < filters.minStars) return false;
      if (filters.maxStars && repo.stargazers_count > filters.maxStars) return false;
      
      // Filter by language
      if (filters.languages && filters.languages.length > 0) {
        if (!repo.language || !filters.languages.includes(repo.language.toLowerCase())) {
          return false;
        }
      }
      
      // Filter by push dates
      if (filters.pushedBefore) {
        const pushedDate = new Date(repo.pushed_at);
        const beforeDate = new Date(filters.pushedBefore);
        if (pushedDate > beforeDate) return false;
      }
      
      if (filters.pushedAfter) {
        const pushedDate = new Date(repo.pushed_at);
        const afterDate = new Date(filters.pushedAfter);
        if (pushedDate < afterDate) return false;
      }
      
      return true;
    });
  }

  /**
   * Analyze repositories in batches to avoid rate limiting
   */
  private async batchAnalyzeRepositories(
    repositories: GitHubRepository[],
    useML: boolean,
    mlConfig?: PredictionConfig
  ): Promise<(RepositoryAnalysis | EnhancedRepositoryAnalysis)[]> {
    const analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[] = [];
    const batchSize = 5; // Analyze 5 repos at a time
    
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      console.log(`📊 Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(repositories.length / batchSize)} (${batch.length} repos)`);
      
      const batchPromises = batch.map(async (repo) => {
        try {
          let analysis: RepositoryAnalysis | EnhancedRepositoryAnalysis;
          
          if (useML) {
            // This would use ML-enhanced analysis when available
            analysis = await this.analyzer.analyzeRepository(repo);
            (analysis as EnhancedRepositoryAnalysis).scoringMethod = 'rule-based'; // For now
          } else {
            analysis = await this.analyzer.analyzeRepository(repo);
            (analysis as EnhancedRepositoryAnalysis).scoringMethod = 'rule-based';
          }
          
          return analysis;
        } catch (error) {
          console.warn(`Failed to analyze ${repo.full_name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          analyses.push(result.value);
        }
      });
      
      // Rate limiting between batches
      await this.delay(1000);
    }
    
    return analyses;
  }

  /**
   * Generate comprehensive scan results
   */
  private generateScanResults(
    orgInfo: OrganizationInfo,
    totalRepos: number,
    analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    executionTime: number
  ): OrganizationScanResults {
    
    // Categorize repositories
    const abandonedProjects = analyses.filter(analysis => 
      analysis.abandonmentScore > 70
    );
    
    const primeRevivalCandidates = analyses.filter(analysis => 
      analysis.abandonmentScore > 70 && analysis.revivalPotential > 60
    );
    
    // Calculate health summary
    const healthSummary = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0
    };
    
    analyses.forEach(analysis => {
      switch (analysis.dependencyHealth) {
        case 'excellent': healthSummary.excellent++; break;
        case 'good': healthSummary.good++; break;
        case 'fair': healthSummary.fair++; break;
        case 'poor': healthSummary.poor++; break;
        case 'critical': healthSummary.critical++; break;
      }
    });
    
    // Language breakdown
    const languageBreakdown: { [language: string]: number } = {};
    analyses.forEach(analysis => {
      const language = analysis.repository.language || 'Unknown';
      languageBreakdown[language] = (languageBreakdown[language] || 0) + 1;
    });
    
    // Generate insights
    const insights = this.generateInsightsList(orgInfo, analyses, abandonedProjects, primeRevivalCandidates);
    
    // Generate recommendations
    const recommendations = this.generateOrganizationRecommendations(orgInfo, analyses, abandonedProjects, healthSummary);
    
    return {
      organization: orgInfo,
      totalRepositories: totalRepos,
      scannedRepositories: analyses.length,
      repositoryAnalyses: analyses,
      abandonedProjects,
      primeRevivalCandidates,
      healthSummary,
      languageBreakdown,
      insights,
      recommendations,
      executionTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate organization-specific insights list
   */
  private generateInsightsList(
    orgInfo: OrganizationInfo,
    analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    abandonedProjects: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    primeRevivalCandidates: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[]
  ): string[] {
    const insights: string[] = [];
    
    // Handle case where no repositories were analyzed
    if (analyses.length === 0) {
      insights.push(`⚠️ No repositories were analyzed - this could be due to filtering criteria or API access issues`);
      return insights;
    }
    
    const abandonmentRate = (abandonedProjects.length / analyses.length) * 100;
    const revivalRate = (primeRevivalCandidates.length / analyses.length) * 100;
    
    insights.push(`📊 ${orgInfo.type} has ${Math.round(abandonmentRate)}% abandonment rate across scanned repositories`);
    
    if (primeRevivalCandidates.length > 0) {
      insights.push(`🎯 Found ${primeRevivalCandidates.length} prime revival candidates (${Math.round(revivalRate)}% of total)`);
    }
    
    if (abandonmentRate > 50) {
      insights.push(`⚠️ High abandonment rate suggests need for better project lifecycle management`);
    } else if (abandonmentRate < 20) {
      insights.push(`✅ Low abandonment rate indicates good project maintenance practices`);
    }
    
    // Language insights
    const languages = Object.keys(analyses.reduce((acc, analysis) => {
      const lang = analysis.repository.language || 'Unknown';
      acc[lang] = true;
      return acc;
    }, {} as { [key: string]: boolean }));
    
    if (languages.length > 5) {
      insights.push(`🌍 Diverse technology stack with ${languages.length} programming languages`);
    }
    
    // Star distribution insights
    const totalStars = analyses.reduce((sum, analysis) => sum + analysis.repository.stargazers_count, 0);
    const avgStars = totalStars / analyses.length;
    
    if (avgStars > 1000) {
      insights.push(`⭐ High-profile ${orgInfo.type.toLowerCase()} with average ${Math.round(avgStars)} stars per repository`);
    }
    
    // Dependency health insights
    const criticalProjects = analyses.filter(a => a.dependencyHealth === 'critical').length;
    if (criticalProjects > 0) {
      insights.push(`🚨 ${criticalProjects} repositories have critical security vulnerabilities`);
    }
    
    return insights;
  }

  /**
   * Generate organization-specific recommendations
   */
  private generateOrganizationRecommendations(
    orgInfo: OrganizationInfo,
    analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    abandonedProjects: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    healthSummary: OrganizationScanResults['healthSummary']
  ): string[] {
    const recommendations: string[] = [];
    
    // Security recommendations
    if (healthSummary.critical > 0) {
      recommendations.push(`🚨 URGENT: Address ${healthSummary.critical} repositories with critical vulnerabilities`);
    }
    
    if (healthSummary.poor + healthSummary.critical > analyses.length * 0.3) {
      recommendations.push(`🛡️ Consider organization-wide dependency audit and security review`);
    }
    
    // Abandonment recommendations
    if (abandonedProjects.length > 0) {
      recommendations.push(`📋 Create maintenance plan for ${abandonedProjects.length} potentially abandoned repositories`);
    }
    
    const highValueAbandoned = abandonedProjects.filter(p => p.repository.stargazers_count > 100);
    if (highValueAbandoned.length > 0) {
      recommendations.push(`💎 ${highValueAbandoned.length} high-value repositories may need immediate attention`);
    }
    
    // Resource allocation recommendations
    if (orgInfo.type === 'Organization') {
      const activeProjects = analyses.filter(a => a.abandonmentScore < 30).length;
      const abandonedCount = abandonedProjects.length;
      
      if (abandonedCount > activeProjects) {
        recommendations.push(`⚖️ Consider consolidating projects - more abandoned (${abandonedCount}) than active (${activeProjects})`);
      }
    }
    
    // Language-specific recommendations
    const jsProjects = analyses.filter(a => a.repository.language === 'JavaScript').length;
    const tsProjects = analyses.filter(a => a.repository.language === 'TypeScript').length;
    
    if (jsProjects > tsProjects * 2) {
      recommendations.push(`🔷 Consider migrating JavaScript projects to TypeScript for better maintainability`);
    }
    
    return recommendations;
  }

  /**
   * Scan multiple organizations/users
   */
  async scanMultipleOrganizations(
    orgList: string[],
    filters: OrganizationScanFilters = {},
    useML = false,
    mlConfig?: PredictionConfig
  ): Promise<OrganizationScanResults[]> {
    const results: OrganizationScanResults[] = [];
    
    for (const org of orgList) {
      try {
        console.log(`\n🔍 Scanning ${org}...`);
        const result = await this.scanOrganization(org, filters, useML, mlConfig);
        results.push(result);
        
        // Delay between organizations to be respectful
        await this.delay(2000);
        
      } catch (error) {
        console.warn(`Failed to scan ${org}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Generate comparative report across multiple organizations
   */
  generateComparativeReport(results: OrganizationScanResults[]): {
    totalOrganizations: number;
    totalRepositories: number;
    averageAbandonmentRate: number;
    bestMaintainedOrg: string;
    mostAbandonedOrg: string;
    languageDistribution: { [language: string]: number };
    securityOverview: { [health: string]: number };
    recommendations: string[];
  } {
    const totalRepos = results.reduce((sum, result) => sum + result.scannedRepositories, 0);
    const totalAbandoned = results.reduce((sum, result) => sum + result.abandonedProjects.length, 0);
    
    const avgAbandonmentRate = (totalAbandoned / totalRepos) * 100;
    
    // Find best and worst maintained organizations
    const orgAbandonmentRates = results.map(result => ({
      org: result.organization.login,
      rate: (result.abandonedProjects.length / result.scannedRepositories) * 100
    }));
    
    orgAbandonmentRates.sort((a, b) => a.rate - b.rate);
    
    const bestMaintained = orgAbandonmentRates[0]?.org || 'Unknown';
    const mostAbandoned = orgAbandonmentRates[orgAbandonmentRates.length - 1]?.org || 'Unknown';
    
    // Aggregate language distribution
    const languageDistribution: { [language: string]: number } = {};
    results.forEach(result => {
      Object.entries(result.languageBreakdown).forEach(([lang, count]) => {
        languageDistribution[lang] = (languageDistribution[lang] || 0) + count;
      });
    });
    
    // Aggregate security overview
    const securityOverview: { [health: string]: number } = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0
    };
    
    results.forEach(result => {
      Object.entries(result.healthSummary).forEach(([health, count]) => {
        securityOverview[health] += count;
      });
    });
    
    // Generate comparative recommendations
    const recommendations: string[] = [];
    
    if (avgAbandonmentRate > 40) {
      recommendations.push(`🚨 High overall abandonment rate (${Math.round(avgAbandonmentRate)}%) across organizations`);
    }
    
    recommendations.push(`🏆 Best maintained: ${bestMaintained} organization`);
    recommendations.push(`⚠️ Needs attention: ${mostAbandoned} organization`);
    
    if (securityOverview.critical > 0) {
      recommendations.push(`🛡️ ${securityOverview.critical} repositories across all organizations have critical vulnerabilities`);
    }
    
    return {
      totalOrganizations: results.length,
      totalRepositories: totalRepos,
      averageAbandonmentRate: avgAbandonmentRate,
      bestMaintainedOrg: bestMaintained,
      mostAbandonedOrg: mostAbandoned,
      languageDistribution,
      securityOverview,
      recommendations
    };
  }

  /**
   * Helper methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
