import { GitHubRepository, RepositoryAnalysis, DependencyAnalysis } from '../types';
import { GitHubService } from './github';
import { DependencyAnalyzer } from './dependency-analyzer';

export class RepositoryAnalyzer {
  private dependencyAnalyzer: DependencyAnalyzer;

  constructor(private githubService: GitHubService) {
    this.dependencyAnalyzer = new DependencyAnalyzer(githubService);
  }

  /**
   * Analyze a repository for abandonment and revival potential
   */
  async analyzeRepository(repo: GitHubRepository): Promise<RepositoryAnalysis> {
    const [owner, name] = repo.full_name.split('/');
    
    // Get additional data for analysis
    const [issues, commits] = await Promise.allSettled([
      this.githubService.getRepositoryIssues(owner, name, 'all'),
      this.githubService.getRepositoryCommits(owner, name)
    ]);

    const issuesData = issues.status === 'fulfilled' ? issues.value : [];
    const commitsData = commits.status === 'fulfilled' ? commits.value : [];

    // Calculate metrics
    const lastCommitAge = this.calculateLastCommitAge(repo.pushed_at);
    const abandonmentScore = this.calculateAbandonmentScore(repo, issuesData, commitsData);
    
    // Perform dependency analysis
    const dependencyAnalysis = await this.dependencyAnalyzer.analyzeDependencies(owner, name);
    const dependencyHealth = dependencyAnalysis.dependencyHealth;
    
    const revivalPotential = this.calculateRevivalPotential(repo, issuesData, dependencyHealth);
    const issueResponseTime = this.calculateIssueResponseTime(issuesData);
    const communityEngagement = this.calculateCommunityEngagement(repo, issuesData);
    const technicalComplexity = this.assessTechnicalComplexity(repo);
    const marketRelevance = this.assessMarketRelevance(repo);

    // Generate insights
    const reasons = this.generateAbandonmentReasons(repo, lastCommitAge, issuesData);
    const recommendations = this.generateRecommendations(repo, abandonmentScore, revivalPotential);

    return {
      repository: repo,
      abandonmentScore,
      revivalPotential,
      lastCommitAge,
      issueResponseTime,
      dependencyHealth,
      dependencyAnalysis,
      communityEngagement,
      technicalComplexity,
      marketRelevance,
      reasons,
      recommendations
    };
  }

  /**
   * Calculate how many days since last commit
   */
  private calculateLastCommitAge(pushedAt: string): number {
    const lastPush = new Date(pushedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastPush.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate abandonment score (0-100, higher = more abandoned)
   */
  private calculateAbandonmentScore(repo: GitHubRepository, issues: any[], commits: any[]): number {
    let score = 0;

    // Age factor (0-40 points)
    const daysSinceLastCommit = this.calculateLastCommitAge(repo.pushed_at);
    if (daysSinceLastCommit > 365) score += 40;
    else if (daysSinceLastCommit > 180) score += 30;
    else if (daysSinceLastCommit > 90) score += 20;
    else if (daysSinceLastCommit > 30) score += 10;

    // Issue response factor (0-30 points)
    const openIssues = issues.filter(issue => issue.state === 'open');
    const recentOpenIssues = openIssues.filter(issue => {
      const issueAge = this.calculateLastCommitAge(issue.created_at);
      return issueAge > 30; // Issues open for more than 30 days
    });
    
    if (openIssues.length > 0) {
      const unresponsiveRatio = recentOpenIssues.length / openIssues.length;
      score += Math.round(unresponsiveRatio * 30);
    }

    // Commit frequency factor (0-20 points)
    const recentCommits = commits.filter(commit => {
      const commitAge = this.calculateLastCommitAge(commit.commit.author.date);
      return commitAge <= 365;
    });
    
    if (recentCommits.length === 0) score += 20;
    else if (recentCommits.length < 5) score += 15;
    else if (recentCommits.length < 10) score += 10;

    // Archive status (0-10 points)
    if (repo.archived) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Calculate revival potential score (0-100, higher = better candidate)
   */
  private calculateRevivalPotential(repo: GitHubRepository, issues: any[], dependencyHealth?: string): number {
    let score = 0;

    // Community interest (0-30 points)
    const starsWeight = Math.min(repo.stargazers_count / 10, 20);
    const forksWeight = Math.min(repo.forks_count / 5, 10);
    score += starsWeight + forksWeight;

    // Active user base (0-25 points)
    const recentIssues = issues.filter(issue => {
      const issueAge = this.calculateLastCommitAge(issue.created_at);
      return issueAge <= 365;
    });
    
    if (recentIssues.length > 10) score += 25;
    else if (recentIssues.length > 5) score += 20;
    else if (recentIssues.length > 2) score += 15;
    else if (recentIssues.length > 0) score += 10;

    // Project maturity (0-20 points)
    const projectAge = this.calculateLastCommitAge(repo.created_at);
    if (projectAge > 365 && projectAge < 1825) score += 20; // 1-5 years old
    else if (projectAge > 180) score += 15;
    else if (projectAge > 90) score += 10;

    // Documentation and structure (0-15 points)
    if (repo.description && repo.description.length > 20) score += 5;
    if (repo.topics && repo.topics.length > 0) score += 5;
    if (repo.license) score += 5;

    // Size and complexity (0-10 points)
    if (repo.size > 100 && repo.size < 10000) score += 10; // Not too small, not too large
    else if (repo.size > 50) score += 5;

    // Dependency health bonus/penalty (0-10 points)
    if (dependencyHealth) {
      switch (dependencyHealth) {
        case 'excellent': score += 10; break;
        case 'good': score += 5; break;
        case 'fair': break; // neutral
        case 'poor': score -= 5; break;
        case 'critical': score -= 10; break;
      }
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate average issue response time in days
   */
  private calculateIssueResponseTime(issues: any[]): number {
    const closedIssues = issues.filter(issue => issue.state === 'closed' && issue.closed_at);
    
    if (closedIssues.length === 0) return -1;

    const responseTimes = closedIssues.map(issue => {
      const created = new Date(issue.created_at);
      const closed = new Date(issue.closed_at);
      return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    });

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  /**
   * Calculate community engagement score (0-100)
   */
  private calculateCommunityEngagement(repo: GitHubRepository, issues: any[]): number {
    let score = 0;

    // Stars to forks ratio
    const engagement = repo.forks_count > 0 ? repo.stargazers_count / repo.forks_count : repo.stargazers_count;
    score += Math.min(engagement / 2, 30);

    // Issue activity
    const recentIssues = issues.filter(issue => {
      const issueAge = this.calculateLastCommitAge(issue.created_at);
      return issueAge <= 365;
    });
    score += Math.min(recentIssues.length * 2, 30);

    // Watchers
    score += Math.min(repo.watchers_count, 20);

    // Open issues (shows active user base)
    score += Math.min(repo.open_issues_count, 20);

    return Math.min(score, 100);
  }

  /**
   * Assess technical complexity
   */
  private assessTechnicalComplexity(repo: GitHubRepository): 'low' | 'medium' | 'high' {
    // Simple heuristics based on size and language
    if (repo.size < 1000) return 'low';
    if (repo.size < 10000) return 'medium';
    return 'high';
  }

  /**
   * Assess market relevance (0-100)
   */
  private assessMarketRelevance(repo: GitHubRepository): number {
    let score = 50; // Base score

    // Language popularity (simplified)
    const popularLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
    if (repo.language && popularLanguages.includes(repo.language.toLowerCase())) {
      score += 20;
    }

    // Recent activity indicates ongoing relevance
    const daysSinceUpdate = this.calculateLastCommitAge(repo.updated_at);
    if (daysSinceUpdate < 30) score += 20;
    else if (daysSinceUpdate < 90) score += 10;
    else if (daysSinceUpdate > 730) score -= 20;

    // Topics indicate modern practices
    if (repo.topics && repo.topics.length > 2) score += 10;

    return Math.max(0, Math.min(score, 100));
  }


  /**
   * Generate reasons for abandonment classification
   */
  private generateAbandonmentReasons(repo: GitHubRepository, lastCommitAge: number, issues: any[]): string[] {
    const reasons: string[] = [];

    if (lastCommitAge > 365) {
      reasons.push(`No commits in ${Math.round(lastCommitAge / 365 * 10) / 10} years`);
    } else if (lastCommitAge > 180) {
      reasons.push(`No commits in ${Math.round(lastCommitAge / 30)} months`);
    }

    const openIssues = issues.filter(issue => issue.state === 'open');
    if (openIssues.length > 10) {
      reasons.push(`${openIssues.length} unresolved issues`);
    }

    if (repo.archived) {
      reasons.push('Repository is archived');
    }

    const recentIssues = issues.filter(issue => {
      const issueAge = this.calculateLastCommitAge(issue.created_at);
      return issueAge <= 90 && issue.state === 'open';
    });

    if (recentIssues.length > 5) {
      reasons.push('Recent issues remain unaddressed');
    }

    return reasons;
  }

  /**
   * Generate recommendations for revival
   */
  private generateRecommendations(repo: GitHubRepository, abandonmentScore: number, revivalPotential: number): string[] {
    const recommendations: string[] = [];

    if (revivalPotential > 70) {
      recommendations.push('High revival potential - strong community interest');
    }

    if (repo.stargazers_count > 100) {
      recommendations.push('Established user base - consider reaching out to community');
    }

    if (abandonmentScore > 70 && revivalPotential > 50) {
      recommendations.push('Clear abandonment with good potential - ideal for takeover');
    }

    if (repo.forks_count > 10) {
      recommendations.push('Multiple forks exist - check for active alternatives');
    }

    if (!repo.license) {
      recommendations.push('No license specified - clarify licensing before revival');
    }

    if (repo.open_issues_count > 20) {
      recommendations.push('Many open issues - good starting point for contributions');
    }

    return recommendations;
  }
}
