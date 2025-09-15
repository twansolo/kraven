export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  description: string | null;
  html_url: string;
  clone_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  archived: boolean;
  disabled: boolean;
  license: {
    key: string;
    name: string;
  } | null;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface RepositoryAnalysis {
  repository: GitHubRepository;
  abandonmentScore: number;
  revivalPotential: number;
  lastCommitAge: number; // days
  issueResponseTime: number; // average days
  dependencyHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';
  dependencyAnalysis?: DependencyAnalysis;
  communityEngagement: number; // 0-100
  technicalComplexity: 'low' | 'medium' | 'high';
  marketRelevance: number; // 0-100
  reasons: string[];
  recommendations: string[];
}

export interface SearchFilters {
  language?: string;
  category?: ProjectCategory;
  minStars?: number;
  maxStars?: number;
  pushedBefore?: string; // ISO date
  pushedAfter?: string; // ISO date
  hasIssues?: boolean;
  archived?: boolean;
  includePrivate?: boolean; // Include private repositories (requires appropriate token scope)
  sort?: 'stars' | 'updated' | 'created';
  order?: 'asc' | 'desc';
}

export type ProjectCategory = 
  | 'cli-tool'
  | 'build-tool' 
  | 'dev-tool'
  | 'testing'
  | 'linter'
  | 'framework'
  | 'library'
  | 'plugin';

export interface HuntResults {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  analyzed: RepositoryAnalysis[];
  executionTime: number;
  timestamp: string;
}

// Dependency analysis types
export interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities: Vulnerability[];
  securityScore: number; // 0-100
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface Vulnerability {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  patchedVersions?: string;
  vulnerableVersions: string;
  source: 'npm' | 'github' | 'snyk';
}

export interface DependencyAnalysis {
  totalDependencies: number;
  outdatedDependencies: number;
  vulnerableDependencies: number;
  criticalVulnerabilities: number;
  dependencyHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';
  healthScore: number; // 0-100
  dependencies: DependencyInfo[];
  recommendations: string[];
  lastUpdated?: Date;
}

// Fork analysis types
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

// ML-related types
export interface MLPrediction {
  abandonment_probability: number; // 0-1
  revival_success_probability: number; // 0-1
  estimated_effort_days: number;
  community_adoption_likelihood: number; // 0-1
  confidence_score: number; // 0-1
  key_factors: string[];
  recommendations: string[];
}

export interface EnhancedRepositoryAnalysis extends RepositoryAnalysis {
  mlPrediction?: MLPrediction;
  mlConfidence?: number;
  scoringMethod: 'rule-based' | 'ml-enhanced' | 'hybrid';
  predictionFactors?: string[];
}

export interface PredictionConfig {
  useMLScoring: boolean;
  confidenceThreshold: number; // 0-1, minimum confidence to use ML predictions
  fallbackToRuleBase: boolean; // Use rule-based scoring if ML confidence is low
  modelVersion?: string;
}

export interface TrainingDataPoint {
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
  
  labels: {
    is_abandoned: boolean;
    revival_success_probability: number; // 0-1
    estimated_revival_effort_days: number;
    community_adoption_likelihood: number; // 0-1
  };
  
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

export interface KravenConfig {
  githubToken?: string;
  defaultFilters: SearchFilters;
  outputFormat: 'json' | 'table' | 'markdown';
  maxResults: number;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  dependencyAnalysis?: boolean;
  forkAnalysis?: boolean;
  mlEnhanced?: boolean;
  mlConfig?: PredictionConfig;
}
