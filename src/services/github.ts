import axios, { AxiosInstance } from 'axios';
import { GitHubRepository, GitHubSearchResponse, SearchFilters } from '../types';

export interface GitHubAuthConfig {
  token?: string;
  oauthToken?: string;
  tokenType?: 'pat' | 'oauth';
}

export class GitHubService {
  public api: AxiosInstance; // Make public for organization scanner
  private readonly baseURL = 'https://api.github.com';
  private authConfig: GitHubAuthConfig;

  constructor(tokenOrConfig?: string | GitHubAuthConfig) {
    // Handle both legacy string token and new config object
    if (typeof tokenOrConfig === 'string') {
      // Don't assume PAT - let auto-detection work
      this.authConfig = { token: tokenOrConfig };
    } else {
      this.authConfig = tokenOrConfig || {};
    }

    // Determine the authorization header
    const authHeader = this.buildAuthHeader();

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Kraven-Hunter/1.0.0',
        ...authHeader
      }
    });
  }

  /**
   * Build the appropriate authorization header based on token type
   */
  private buildAuthHeader(): Record<string, string> {
    const { token, oauthToken, tokenType } = this.authConfig;
    
    if (oauthToken) {
      return { 'Authorization': `Bearer ${oauthToken}` };
    }
    
    if (token) {
      // Auto-detect token type if not specified
      const detectedType = tokenType || this.detectTokenType(token);
      
      if (detectedType === 'oauth') {
        return { 'Authorization': `Bearer ${token}` };
      } else {
        return { 'Authorization': `token ${token}` };
      }
    }
    
    return {};
  }

  /**
   * Auto-detect token type based on token format
   */
  private detectTokenType(token: string): 'pat' | 'oauth' {
    // GitHub OAuth tokens typically start with 'gho_' or are longer JWT-style tokens
    // GitHub App installation tokens start with 'ghs_' and should use Bearer
    // Personal Access Tokens typically start with 'ghp_', 'ghr_', etc.
    if (token.startsWith('gho_') || token.startsWith('v1.') || token.length > 100) {
      return 'oauth';
    }
    return 'pat';
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

    // Private repository filter - only works if authenticated
    if (filters.includePrivate) {
      queryParts.push(`is:private`);
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
   * Get authenticated user's repositories (includes private repos)
   */
  async getUserRepositories(
    visibility: 'all' | 'public' | 'private' = 'all',
    page = 1,
    perPage = 30
  ): Promise<GitHubRepository[]> {
    try {
      const response = await this.api.get('/user/repos', {
        params: {
          visibility,
          page,
          per_page: perPage,
          sort: 'updated',
          direction: 'desc'
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch user repositories: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if the current token has access to private repositories
   */
  async hasPrivateAccess(): Promise<boolean> {
    try {
      // Try to access user's private repos endpoint
      await this.api.get('/user/repos', {
        params: { visibility: 'private', per_page: 1 }
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return false;
      }
      // If it's another error, assume we have access but there might be other issues
      return true;
    }
  }

  /**
   * Enhanced search that can include private repositories
   */
  async searchRepositoriesEnhanced(filters: SearchFilters, page = 1, perPage = 30): Promise<GitHubSearchResponse> {
    // If includePrivate is requested, check if we have access
    if (filters.includePrivate) {
      const hasAccess = await this.hasPrivateAccess();
      if (!hasAccess) {
        throw new Error('Private repository access requires a GitHub token with "repo" scope. Current token only has "public_repo" scope.');
      }
    }

    // Use the regular search for now - GitHub search API will include private repos if token has proper scope
    return this.searchRepositories(filters, page, perPage);
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
