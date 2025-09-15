/**
 * GitHub API Client for Kraven Web Interface
 */
class GitHubAPI {
    constructor(token = null) {
        this.baseURL = 'https://api.github.com';
        this.token = token;
        this.rateLimit = { remaining: 60, limit: 60, reset: null };
    }

    /**
     * Set GitHub token for authenticated requests
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * Make authenticated request to GitHub API
     */
    async makeRequest(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                url.searchParams.append(key, params[key]);
            }
        });

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-Web/1.0.0'
        };

        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        try {
            const response = await fetch(url, { headers });
            
            // Update rate limit info
            this.updateRateLimit(response);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API request failed:', error);
            throw error;
        }
    }

    /**
     * Update rate limit information from response headers
     */
    updateRateLimit(response) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const limit = response.headers.get('X-RateLimit-Limit');
        const reset = response.headers.get('X-RateLimit-Reset');

        if (remaining !== null) {
            this.rateLimit = {
                remaining: parseInt(remaining),
                limit: parseInt(limit),
                reset: new Date(parseInt(reset) * 1000)
            };
        }
    }

    /**
     * Get current rate limit status
     */
    async getRateLimit() {
        try {
            await this.makeRequest('/rate_limit');
            return this.rateLimit;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
            return this.rateLimit;
        }
    }

    /**
     * Search repositories with filters
     */
    async searchRepositories(filters, page = 1, perPage = 30) {
        const query = this.buildSearchQuery(filters);
        
        const params = {
            q: query,
            sort: filters.sort || 'stars',
            order: filters.order || 'desc',
            page,
            per_page: Math.min(perPage, 100)
        };

        return await this.makeRequest('/search/repositories', params);
    }

    /**
     * Get detailed repository information
     */
    async getRepository(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}`);
    }

    /**
     * Get repository issues
     */
    async getRepositoryIssues(owner, repo, state = 'open') {
        const params = { state, per_page: 100 };
        return await this.makeRequest(`/repos/${owner}/${repo}/issues`, params);
    }

    /**
     * Get repository commits
     */
    async getRepositoryCommits(owner, repo, since = null) {
        const params = { per_page: 100 };
        if (since) params.since = since;
        return await this.makeRequest(`/repos/${owner}/${repo}/commits`, params);
    }

    /**
     * Build GitHub search query from filters
     */
    buildSearchQuery(filters) {
        const queryParts = [];

        // Language filter
        if (filters.language) {
            queryParts.push(`language:${filters.language}`);
        }

        // Stars filter
        if (filters.minStars || filters.maxStars) {
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

        // Category-based keywords
        if (filters.category) {
            const categoryKeywords = this.getCategoryKeywords(filters.category);
            queryParts.push(`(${categoryKeywords.map(k => `"${k}"`).join(' OR ')})`);
        }

        // Default filters for better results
        queryParts.push('archived:false'); // Exclude archived repos by default
        queryParts.push('is:public'); // Only public repos

        return queryParts.join(' ');
    }

    /**
     * Get search keywords for project categories
     */
    getCategoryKeywords(category) {
        const keywords = {
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
}

/**
 * Repository Analyzer for client-side analysis
 */
class RepositoryAnalyzer {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
    }

    /**
     * Analyze a repository for abandonment and revival potential
     */
    async analyzeRepository(repo) {
        const [owner, name] = repo.full_name.split('/');
        
        try {
            // Get additional data for analysis (with error handling)
            let issues = [];
            let commits = [];
            
            try {
                issues = await this.githubAPI.getRepositoryIssues(owner, name, 'all');
            } catch (error) {
                console.warn(`Failed to fetch issues for ${repo.full_name}:`, error.message);
            }
            
            try {
                commits = await this.githubAPI.getRepositoryCommits(owner, name);
            } catch (error) {
                console.warn(`Failed to fetch commits for ${repo.full_name}:`, error.message);
            }

            // Calculate metrics
            const lastCommitAge = this.calculateLastCommitAge(repo.pushed_at);
            const abandonmentScore = this.calculateAbandonmentScore(repo, issues, commits);
            const revivalPotential = this.calculateRevivalPotential(repo, issues);
            const issueResponseTime = this.calculateIssueResponseTime(issues);
            const communityEngagement = this.calculateCommunityEngagement(repo, issues);
            const technicalComplexity = this.assessTechnicalComplexity(repo);
            const marketRelevance = this.assessMarketRelevance(repo);

            // Generate insights
            const reasons = this.generateAbandonmentReasons(repo, lastCommitAge, issues);
            const recommendations = this.generateRecommendations(repo, abandonmentScore, revivalPotential);

            return {
                repository: repo,
                abandonmentScore,
                revivalPotential,
                lastCommitAge,
                issueResponseTime,
                communityEngagement,
                technicalComplexity,
                marketRelevance,
                reasons,
                recommendations
            };
        } catch (error) {
            console.error(`Analysis failed for ${repo.full_name}:`, error);
            // Return basic analysis if detailed analysis fails
            return {
                repository: repo,
                abandonmentScore: this.calculateBasicAbandonmentScore(repo),
                revivalPotential: this.calculateBasicRevivalPotential(repo),
                lastCommitAge: this.calculateLastCommitAge(repo.pushed_at),
                issueResponseTime: -1,
                communityEngagement: Math.min(repo.stargazers_count / 10, 100),
                technicalComplexity: this.assessTechnicalComplexity(repo),
                marketRelevance: this.assessMarketRelevance(repo),
                reasons: [`Last updated ${this.calculateLastCommitAge(repo.pushed_at)} days ago`],
                recommendations: ['Limited analysis available - check repository manually']
            };
        }
    }

    /**
     * Calculate how many days since last commit
     */
    calculateLastCommitAge(pushedAt) {
        const lastPush = new Date(pushedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastPush.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Calculate abandonment score (0-100, higher = more abandoned)
     */
    calculateAbandonmentScore(repo, issues, commits) {
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
            return issueAge > 30;
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
     * Calculate basic abandonment score when detailed data is unavailable
     */
    calculateBasicAbandonmentScore(repo) {
        let score = 0;
        const daysSinceLastCommit = this.calculateLastCommitAge(repo.pushed_at);
        
        if (daysSinceLastCommit > 365) score += 60;
        else if (daysSinceLastCommit > 180) score += 40;
        else if (daysSinceLastCommit > 90) score += 25;
        else if (daysSinceLastCommit > 30) score += 10;

        if (repo.archived) score += 20;
        if (repo.open_issues_count > 20) score += 20;

        return Math.min(score, 100);
    }

    /**
     * Calculate revival potential score (0-100, higher = better candidate)
     */
    calculateRevivalPotential(repo, issues) {
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
        if (projectAge > 365 && projectAge < 1825) score += 20;
        else if (projectAge > 180) score += 15;
        else if (projectAge > 90) score += 10;

        // Documentation and structure (0-15 points)
        if (repo.description && repo.description.length > 20) score += 5;
        if (repo.topics && repo.topics.length > 0) score += 5;
        if (repo.license) score += 5;

        // Size and complexity (0-10 points)
        if (repo.size > 100 && repo.size < 10000) score += 10;
        else if (repo.size > 50) score += 5;

        return Math.min(score, 100);
    }

    /**
     * Calculate basic revival potential when detailed data is unavailable
     */
    calculateBasicRevivalPotential(repo) {
        let score = 0;

        // Stars and forks
        score += Math.min(repo.stargazers_count / 10, 30);
        score += Math.min(repo.forks_count / 5, 15);

        // Project age
        const projectAge = this.calculateLastCommitAge(repo.created_at);
        if (projectAge > 365 && projectAge < 1825) score += 25;
        else if (projectAge > 180) score += 15;

        // Basic indicators
        if (repo.description && repo.description.length > 20) score += 10;
        if (repo.license) score += 10;
        if (repo.open_issues_count > 5) score += 10;

        return Math.min(score, 100);
    }

    /**
     * Calculate average issue response time in days
     */
    calculateIssueResponseTime(issues) {
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
    calculateCommunityEngagement(repo, issues) {
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

        // Watchers and open issues
        score += Math.min(repo.watchers_count, 20);
        score += Math.min(repo.open_issues_count, 20);

        return Math.min(score, 100);
    }

    /**
     * Assess technical complexity
     */
    assessTechnicalComplexity(repo) {
        if (repo.size < 1000) return 'low';
        if (repo.size < 10000) return 'medium';
        return 'high';
    }

    /**
     * Assess market relevance (0-100)
     */
    assessMarketRelevance(repo) {
        let score = 50; // Base score

        // Language popularity
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
    generateAbandonmentReasons(repo, lastCommitAge, issues) {
        const reasons = [];

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
    generateRecommendations(repo, abandonmentScore, revivalPotential) {
        const recommendations = [];

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
