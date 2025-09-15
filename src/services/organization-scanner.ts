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

export interface TechDebtMetrics {
  totalCostImpact: {
    estimatedAnnualCost: number; // USD per year
    maintenanceCostPerRepo: number; // USD per repo per month
    securityIncidentCost: number; // Potential cost of security breaches
    opportunityCost: number; // Lost productivity due to outdated dependencies
  };
  timeEstimates: {
    totalMaintenanceHours: number; // Hours needed to bring all repos up to date
    averageHoursPerRepo: number; // Average hours per repository
    criticalIssueHours: number; // Hours to fix critical security issues
    dependencyUpdateHours: number; // Hours to update all dependencies
  };
  securityRisk: {
    riskScore: number; // 0-100 overall security risk score
    criticalVulnerabilities: number; // Number of critical CVEs
    highVulnerabilities: number; // Number of high severity CVEs
    outdatedDependencies: number; // Number of severely outdated dependencies
    complianceRisk: 'low' | 'medium' | 'high' | 'critical'; // Regulatory compliance risk
  };
  businessImpact: {
    productivityLoss: number; // Percentage of lost developer productivity
    deploymentRisk: number; // Risk score for production deployments
    talentRetention: number; // Impact on developer satisfaction (0-100)
    innovationDelay: number; // Months of delayed feature development
  };
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
  techDebtMetrics: TechDebtMetrics; // New tech debt analysis
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
    
    // Calculate tech debt metrics first
    const techDebtMetrics = this.calculateTechDebtMetrics(analyses, abandonedProjects, healthSummary);
    
    // Generate insights (including tech debt insights)
    const insights = this.generateInsightsList(orgInfo, analyses, abandonedProjects, primeRevivalCandidates, techDebtMetrics);
    
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
      techDebtMetrics,
      insights,
      recommendations,
      executionTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate comprehensive tech debt metrics
   */
  private calculateTechDebtMetrics(
    analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    abandonedProjects: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    healthSummary: { excellent: number; good: number; fair: number; poor: number; critical: number }
  ): TechDebtMetrics {
    
    // Base hourly rates for calculations (industry averages)
    const DEVELOPER_HOURLY_RATE = 75; // USD per hour
    const SECURITY_SPECIALIST_RATE = 125; // USD per hour
    const DEVOPS_HOURLY_RATE = 85; // USD per hour
    
    // Calculate total stars and complexity indicators
    const totalStars = analyses.reduce((sum, analysis) => sum + analysis.repository.stargazers_count, 0);
    const avgStars = totalStars / analyses.length || 0;
    const highValueRepos = analyses.filter(a => a.repository.stargazers_count > 500).length;
    
    // Time Estimates
    const criticalRepos = healthSummary.critical;
    const poorRepos = healthSummary.poor;
    const fairRepos = healthSummary.fair;
    
    // Hours estimation based on repository health and complexity
    const criticalIssueHours = criticalRepos * 16; // 2 days per critical repo
    const dependencyUpdateHours = (poorRepos * 8) + (fairRepos * 4); // 1 day poor, half day fair
    const abandonedProjectHours = abandonedProjects.length * 12; // 1.5 days per abandoned project
    const totalMaintenanceHours = criticalIssueHours + dependencyUpdateHours + abandonedProjectHours;
    const averageHoursPerRepo = totalMaintenanceHours / analyses.length;
    
    // Cost Calculations
    const criticalSecurityCost = criticalRepos * SECURITY_SPECIALIST_RATE * 16;
    const dependencyUpdateCost = dependencyUpdateHours * DEVELOPER_HOURLY_RATE;
    const abandonedProjectCost = abandonedProjectHours * DEVELOPER_HOURLY_RATE;
    
    const monthlyMaintenanceCost = (poorRepos * 200) + (fairRepos * 100) + (criticalRepos * 500);
    const estimatedAnnualCost = monthlyMaintenanceCost * 12;
    const maintenanceCostPerRepo = monthlyMaintenanceCost / analyses.length;
    
    // Security incident cost estimation (based on industry data)
    const baseIncidentCost = 50000; // Base cost of security incident
    const reputationMultiplier = avgStars > 1000 ? 3 : avgStars > 100 ? 2 : 1;
    const securityIncidentCost = criticalRepos * baseIncidentCost * reputationMultiplier;
    
    // Opportunity cost (lost productivity)
    const productivityLossPercentage = Math.min(50, (poorRepos + criticalRepos) / analyses.length * 100);
    const opportunityCost = (analyses.length * DEVELOPER_HOURLY_RATE * 40 * 52) * (productivityLossPercentage / 100);
    
    // Security Risk Assessment
    const criticalVulnerabilities = criticalRepos * 2.5; // Estimate 2.5 critical CVEs per critical repo
    const highVulnerabilities = (poorRepos + criticalRepos) * 1.8; // High severity issues
    const outdatedDependencies = (poorRepos * 15) + (fairRepos * 8) + (criticalRepos * 25);
    
    // Risk score calculation (0-100)
    const securityRiskScore = Math.min(100, 
      (criticalRepos / analyses.length * 40) + 
      (poorRepos / analyses.length * 25) + 
      (abandonedProjects.length / analyses.length * 35)
    );
    
    // Compliance risk assessment
    let complianceRisk: 'low' | 'medium' | 'high' | 'critical';
    if (criticalRepos > analyses.length * 0.3) complianceRisk = 'critical';
    else if (criticalRepos > analyses.length * 0.15) complianceRisk = 'high';
    else if (poorRepos > analyses.length * 0.4) complianceRisk = 'medium';
    else complianceRisk = 'low';
    
    // Business Impact Calculations
    const productivityLoss = Math.min(50, (abandonedProjects.length / analyses.length) * 100);
    const deploymentRisk = Math.min(100, securityRiskScore * 0.8);
    const talentRetention = Math.max(0, 100 - (productivityLoss * 1.5)); // Higher tech debt = lower satisfaction
    const innovationDelay = Math.ceil((abandonedProjects.length / analyses.length) * 12); // Months
    
    return {
      totalCostImpact: {
        estimatedAnnualCost: Math.round(estimatedAnnualCost),
        maintenanceCostPerRepo: Math.round(maintenanceCostPerRepo),
        securityIncidentCost: Math.round(securityIncidentCost),
        opportunityCost: Math.round(opportunityCost)
      },
      timeEstimates: {
        totalMaintenanceHours: Math.round(totalMaintenanceHours),
        averageHoursPerRepo: Math.round(averageHoursPerRepo * 10) / 10, // One decimal place
        criticalIssueHours: Math.round(criticalIssueHours),
        dependencyUpdateHours: Math.round(dependencyUpdateHours)
      },
      securityRisk: {
        riskScore: Math.round(securityRiskScore),
        criticalVulnerabilities: Math.round(criticalVulnerabilities),
        highVulnerabilities: Math.round(highVulnerabilities),
        outdatedDependencies: Math.round(outdatedDependencies),
        complianceRisk
      },
      businessImpact: {
        productivityLoss: Math.round(productivityLoss),
        deploymentRisk: Math.round(deploymentRisk),
        talentRetention: Math.round(talentRetention),
        innovationDelay
      }
    };
  }

  /**
   * Generate organization-specific insights list
   */
  private generateInsightsList(
    orgInfo: OrganizationInfo,
    analyses: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    abandonedProjects: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    primeRevivalCandidates: (RepositoryAnalysis | EnhancedRepositoryAnalysis)[],
    techDebtMetrics: TechDebtMetrics
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
    
    // Tech debt financial insights
    if (techDebtMetrics.totalCostImpact.estimatedAnnualCost > 100000) {
      insights.push(`💰 High tech debt cost: $${(techDebtMetrics.totalCostImpact.estimatedAnnualCost / 1000).toFixed(0)}K annual maintenance burden`);
    }
    
    if (techDebtMetrics.timeEstimates.totalMaintenanceHours > 1000) {
      insights.push(`⏰ Significant time investment needed: ${Math.round(techDebtMetrics.timeEstimates.totalMaintenanceHours / 40)} developer-weeks to address tech debt`);
    }
    
    // Security risk insights
    if (techDebtMetrics.securityRisk.riskScore > 70) {
      insights.push(`🛡️ High security risk (${techDebtMetrics.securityRisk.riskScore}/100) - immediate attention required`);
    }
    
    if (techDebtMetrics.securityRisk.complianceRisk === 'critical' || techDebtMetrics.securityRisk.complianceRisk === 'high') {
      insights.push(`⚖️ ${techDebtMetrics.securityRisk.complianceRisk.toUpperCase()} compliance risk - regulatory concerns possible`);
    }
    
    // Business impact insights
    if (techDebtMetrics.businessImpact.productivityLoss > 20) {
      insights.push(`📉 Developer productivity reduced by ${techDebtMetrics.businessImpact.productivityLoss}% due to tech debt`);
    }
    
    if (techDebtMetrics.businessImpact.talentRetention < 70) {
      insights.push(`👥 Tech debt may impact talent retention (satisfaction score: ${techDebtMetrics.businessImpact.talentRetention}/100)`);
    }
    
    if (techDebtMetrics.businessImpact.innovationDelay > 6) {
      insights.push(`🚀 Innovation delayed by ~${techDebtMetrics.businessImpact.innovationDelay} months due to maintenance burden`);
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
