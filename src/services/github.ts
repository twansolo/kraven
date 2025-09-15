import axios, { AxiosInstance } from 'axios';
import { GitHubRepository, GitHubSearchResponse, SearchFilters } from '../types';

export class GitHubService {
  public api: AxiosInstance; // Make public for organization scanner
  private readonly baseURL = 'https://api.github.com';

  constructor(token?: string) {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Kraven-Hunter/1.0.0',
        ...(token && { 'Authorization': `token ${token}` })
      }
    });
  }

  /**
   * Search for repositories based on filters
   */
  async searchRepositories(filters: SearchFilters, page = 1, perPage = 30): Promise<GitHubSearchResponse> {
    const query = this.buildSearchQuery(filters);
    
    try {
      const response = await this.api.get('/search/repositories', {
        params: {
          q: query,
          sort: filters.sort || 'stars',
          order: filters.order || 'desc',
          page,
          per_page: perPage
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`GitHub API Error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get detailed repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const response = await this.api.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch repository: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get repository issues
   */
  async getRepositoryIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    try {
      const response = await this.api.get(`/repos/${owner}/${repo}/issues`, {
        params: { state, per_page: 100 }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch issues: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get repository commits
   */
  async getRepositoryCommits(owner: string, repo: string, since?: string) {
    try {
      const response = await this.api.get(`/repos/${owner}/${repo}/commits`, {
        params: { 
          per_page: 100,
          ...(since && { since })
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch commits: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build GitHub search query from filters
   */
  private buildSearchQuery(filters: SearchFilters): string {
    const queryParts: string[] = [];

    // Language filter
    if (filters.language) {
      queryParts.push(`language:${filters.language}`);
    }

    // Stars filter
    if (filters.minStars !== undefined || filters.maxStars !== undefined) {
      const min = filters.minStars || 0;
      const max = filters.maxStars || '*';
      queryParts.push(`stars:${min}..${max}`);
    }

    // Push date filters
    if (filters.pushedBefore) {
      queryParts.push(`pushed:<${filters.pushedBefore}`);
    }
    if (filters.pushedAfter) {
      queryParts.push(`pushed:>${filters.pushedAfter}`);
    }

    // Issues filter
    if (filters.hasIssues !== undefined) {
      queryParts.push(`has:issues`);
    }

    // Archived filter
    if (filters.archived !== undefined) {
      queryParts.push(`archived:${filters.archived}`);
    }

    // Category-based keywords
    if (filters.category) {
      const categoryKeywords = this.getCategoryKeywords(filters.category);
      queryParts.push(`(${categoryKeywords.map(k => `"${k}"`).join(' OR ')})`);
    }

    return queryParts.join(' ');
  }

  /**
   * Get search keywords for project categories
   */
  private getCategoryKeywords(category: string): string[] {
    const keywords: Record<string, string[]> = {
      'cli-tool': ['cli tool', 'command line', 'terminal', 'console'],
      'build-tool': ['build tool', 'bundler', 'webpack', 'rollup', 'vite', 'parcel'],
      'dev-tool': ['developer tool', 'development', 'devtools'],
      'testing': ['testing framework', 'test runner', 'jest', 'mocha', 'cypress'],
      'linter': ['linter', 'eslint', 'tslint', 'prettier', 'code quality'],
      'framework': ['framework', 'library framework'],
      'library': ['library', 'utility library'],
      'plugin': ['plugin', 'extension']
    };

    return keywords[category] || [];
  }

  /**
   * Check API rate limit
   */
  async getRateLimit() {
    try {
      const response = await this.api.get('/rate_limit');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to check rate limit: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}
