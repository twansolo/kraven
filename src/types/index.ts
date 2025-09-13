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
  dependencyHealth: 'good' | 'outdated' | 'vulnerable' | 'unknown';
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

export interface KravenConfig {
  githubToken?: string;
  defaultFilters: SearchFilters;
  outputFormat: 'json' | 'table' | 'markdown';
  maxResults: number;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
}
