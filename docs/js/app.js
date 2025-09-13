/**
 * Kraven Web Application
 */
class KravenApp {
    constructor() {
        this.githubAPI = new GitHubAPI();
        this.analyzer = new RepositoryAnalyzer(this.githubAPI);
        this.currentResults = [];
        this.isSearching = false;
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    initializeApp() {
        this.bindEvents();
        this.updateRateLimitDisplay();
        this.setDefaultDates();
        
        // Check for GitHub token in localStorage
        const savedToken = localStorage.getItem('kraven_github_token');
        if (savedToken) {
            document.getElementById('githubToken').value = savedToken;
            this.githubAPI.setToken(savedToken);
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search form
        document.getElementById('searchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.performSearch();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearForm();
        });

        // Export JSON button
        document.getElementById('exportJson').addEventListener('click', () => {
            this.exportResults();
        });

        // Sort results button
        document.getElementById('sortResults').addEventListener('click', () => {
            this.sortResults();
        });

        // GitHub token input
        document.getElementById('githubToken').addEventListener('input', (e) => {
            const token = e.target.value.trim();
            if (token) {
                this.githubAPI.setToken(token);
                localStorage.setItem('kraven_github_token', token);
            } else {
                this.githubAPI.setToken(null);
                localStorage.removeItem('kraven_github_token');
            }
            this.updateRateLimitDisplay();
        });
    }

    /**
     * Set default dates for better UX
     */
    setDefaultDates() {
        const pushedBeforeInput = document.getElementById('pushedBefore');
        // Default to 2 years ago
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        pushedBeforeInput.value = twoYearsAgo.toISOString().split('T')[0];
    }

    /**
     * Perform repository search
     */
    async performSearch() {
        if (this.isSearching) return;

        this.isSearching = true;
        this.showLoading();
        this.hideResults();

        try {
            // Get form data
            const formData = new FormData(document.getElementById('searchForm'));
            const filters = this.buildFilters(formData);

            // Update GitHub token if provided
            const token = formData.get('githubToken');
            if (token) {
                this.githubAPI.setToken(token);
            }

            // Search repositories
            const searchResponse = await this.githubAPI.searchRepositories(filters, 1, 30);
            
            // Analyze repositories (limit to first 10 for performance)
            const repositoriesToAnalyze = searchResponse.items.slice(0, 10);
            const analyses = [];

            for (let i = 0; i < repositoriesToAnalyze.length; i++) {
                const repo = repositoriesToAnalyze[i];
                
                try {
                    // Update loading message
                    this.updateLoadingMessage(`Analyzing ${repo.full_name} (${i + 1}/${repositoriesToAnalyze.length})`);
                    
                    const analysis = await this.analyzer.analyzeRepository(repo);
                    analyses.push(analysis);
                    
                    // Small delay to avoid rate limiting
                    await this.delay(200);
                } catch (error) {
                    console.warn(`Failed to analyze ${repo.full_name}:`, error);
                    // Add basic analysis even if detailed analysis fails
                    analyses.push({
                        repository: repo,
                        abandonmentScore: this.analyzer.calculateBasicAbandonmentScore(repo),
                        revivalPotential: this.analyzer.calculateBasicRevivalPotential(repo),
                        lastCommitAge: this.analyzer.calculateLastCommitAge(repo.pushed_at),
                        issueResponseTime: -1,
                        communityEngagement: Math.min(repo.stargazers_count / 10, 100),
                        technicalComplexity: this.analyzer.assessTechnicalComplexity(repo),
                        marketRelevance: this.analyzer.assessMarketRelevance(repo),
                        reasons: ['Limited analysis available'],
                        recommendations: ['Check repository manually for detailed assessment']
                    });
                }
            }

            // Sort by revival potential
            analyses.sort((a, b) => b.revivalPotential - a.revivalPotential);

            this.currentResults = {
                query: this.githubAPI.buildSearchQuery(filters),
                filters,
                totalFound: searchResponse.total_count,
                analyzed: analyses,
                timestamp: new Date().toISOString()
            };

            this.displayResults();
            this.updateRateLimitDisplay();

        } catch (error) {
            console.error('Search failed:', error);
            this.showError(`Search failed: ${error.message}`);
        } finally {
            this.hideLoading();
            this.isSearching = false;
        }
    }

    /**
     * Build filters object from form data
     */
    buildFilters(formData) {
        const filters = {};
        
        const language = formData.get('language');
        if (language) filters.language = language;
        
        const category = formData.get('category');
        if (category) filters.category = category;
        
        const minStars = formData.get('minStars');
        if (minStars) filters.minStars = parseInt(minStars);
        
        const maxStars = formData.get('maxStars');
        if (maxStars) filters.maxStars = parseInt(maxStars);
        
        const pushedBefore = formData.get('pushedBefore');
        if (pushedBefore) filters.pushedBefore = pushedBefore;

        return filters;
    }

    /**
     * Display search results
     */
    displayResults() {
        const resultsSection = document.getElementById('results');
        const resultsContainer = document.getElementById('resultsContainer');
        const resultsCount = document.getElementById('resultsCount');

        // Update results count
        resultsCount.textContent = `${this.currentResults.totalFound} repositories found, ${this.currentResults.analyzed.length} analyzed`;

        // Clear previous results
        resultsContainer.innerHTML = '';

        // Display each repository
        this.currentResults.analyzed.forEach(analysis => {
            const repoCard = this.createRepositoryCard(analysis);
            resultsContainer.appendChild(repoCard);
        });

        // Show results section
        resultsSection.classList.remove('hidden');
    }

    /**
     * Create repository card element
     */
    createRepositoryCard(analysis) {
        const repo = analysis.repository;
        const card = document.createElement('div');
        card.className = 'repo-card';

        // Determine status
        let status = 'skip';
        let statusText = '❌ SKIP';
        if (analysis.abandonmentScore > 70 && analysis.revivalPotential > 60) {
            status = 'prime';
            statusText = '🎯 PRIME';
        } else if (analysis.abandonmentScore > 50 && analysis.revivalPotential > 40) {
            status = 'maybe';
            statusText = '⚠️ MAYBE';
        }

        card.innerHTML = `
            <div class="repo-header">
                <h3 class="repo-title">
                    <a href="${repo.html_url}" target="_blank" rel="noopener">
                        ${repo.full_name}
                    </a>
                </h3>
                <span class="repo-status status-${status}">${statusText}</span>
            </div>

            <p class="repo-description">
                ${repo.description || 'No description available'}
            </p>

            <div class="repo-stats">
                <div class="stat">
                    <div class="stat-value">${repo.stargazers_count.toLocaleString()}</div>
                    <div class="stat-label">Stars</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${repo.forks_count.toLocaleString()}</div>
                    <div class="stat-label">Forks</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${repo.open_issues_count}</div>
                    <div class="stat-label">Issues</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${analysis.abandonmentScore}%</div>
                    <div class="stat-label">Abandonment</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${analysis.revivalPotential}%</div>
                    <div class="stat-label">Revival Potential</div>
                </div>
            </div>

            <div class="repo-metrics">
                <div class="metric">
                    <i class="fas fa-code"></i>
                    <span>${repo.language || 'Unknown'}</span>
                </div>
                <div class="metric">
                    <i class="fas fa-calendar"></i>
                    <span>${analysis.lastCommitAge} days ago</span>
                </div>
                <div class="metric">
                    <i class="fas fa-users"></i>
                    <span>${Math.round(analysis.communityEngagement)}% engagement</span>
                </div>
                <div class="metric">
                    <i class="fas fa-cogs"></i>
                    <span>${analysis.technicalComplexity} complexity</span>
                </div>
            </div>

            ${analysis.reasons.length > 0 ? `
                <div class="repo-reasons">
                    <h4><i class="fas fa-exclamation-triangle"></i> Abandonment Indicators:</h4>
                    <ul>
                        ${analysis.reasons.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${analysis.recommendations.length > 0 ? `
                <div class="repo-recommendations">
                    <h4><i class="fas fa-lightbulb"></i> Revival Recommendations:</h4>
                    <ul>
                        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;

        return card;
    }

    /**
     * Show loading state
     */
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('searchBtn').disabled = true;
        document.getElementById('searchBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hunting...';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('searchBtn').innerHTML = '<i class="fas fa-spider"></i> Start Hunting';
    }

    /**
     * Update loading message
     */
    updateLoadingMessage(message) {
        const loadingElement = document.querySelector('#loading p');
        if (loadingElement) {
            loadingElement.textContent = `🕷️ ${message}`;
        }
    }

    /**
     * Show results section
     */
    showResults() {
        document.getElementById('results').classList.remove('hidden');
    }

    /**
     * Hide results section
     */
    hideResults() {
        document.getElementById('results').classList.add('hidden');
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create error element if it doesn't exist
        let errorElement = document.getElementById('error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error';
            errorElement.className = 'error-message';
            document.querySelector('.search-section').appendChild(errorElement);
        }

        errorElement.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        errorElement.style.display = 'block';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 10000);
    }

    /**
     * Clear search form
     */
    clearForm() {
        document.getElementById('searchForm').reset();
        this.setDefaultDates();
        this.hideResults();
    }

    /**
     * Export results as JSON
     */
    exportResults() {
        if (!this.currentResults || this.currentResults.analyzed.length === 0) {
            alert('No results to export');
            return;
        }

        const dataStr = JSON.stringify(this.currentResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `kraven-results-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    /**
     * Sort results by revival potential
     */
    sortResults() {
        if (!this.currentResults || this.currentResults.analyzed.length === 0) {
            return;
        }

        // Toggle sort order
        const isCurrentlyDescending = this.currentResults.analyzed[0].revivalPotential >= 
                                     this.currentResults.analyzed[this.currentResults.analyzed.length - 1].revivalPotential;
        
        if (isCurrentlyDescending) {
            this.currentResults.analyzed.sort((a, b) => a.revivalPotential - b.revivalPotential);
        } else {
            this.currentResults.analyzed.sort((a, b) => b.revivalPotential - a.revivalPotential);
        }

        this.displayResults();
    }

    /**
     * Update rate limit display
     */
    async updateRateLimitDisplay() {
        try {
            const rateLimit = await this.githubAPI.getRateLimit();
            const rateLimitText = document.getElementById('rateLimitText');
            
            if (rateLimitText) {
                rateLimitText.textContent = `Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`;
                
                // Change color based on remaining requests
                const rateLimitInfo = document.getElementById('rateLimitInfo');
                if (rateLimit.remaining < 10) {
                    rateLimitInfo.style.color = '#e74c3c';
                } else if (rateLimit.remaining < 50) {
                    rateLimitInfo.style.color = '#f39c12';
                } else {
                    rateLimitInfo.style.color = '#27ae60';
                }
            }
        } catch (error) {
            console.warn('Failed to update rate limit display:', error);
        }
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Add CSS for error messages and additional styles
const additionalCSS = `
.error-message {
    background: var(--accent-color);
    color: white;
    padding: 15px;
    border-radius: 8px;
    margin: 20px 0;
    display: none;
}

.error-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.error-content button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    margin-left: auto;
    padding: 5px;
}

.repo-reasons,
.repo-recommendations {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--border-color);
}

.repo-reasons h4,
.repo-recommendations h4 {
    color: var(--primary-color);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
}

.repo-reasons ul,
.repo-recommendations ul {
    list-style: none;
    padding-left: 0;
}

.repo-reasons li,
.repo-recommendations li {
    padding: 5px 0;
    color: var(--muted-text);
    position: relative;
    padding-left: 20px;
}

.repo-reasons li:before {
    content: "⚠️";
    position: absolute;
    left: 0;
}

.repo-recommendations li:before {
    content: "💡";
    position: absolute;
    left: 0;
}
`;

// Add the additional CSS to the page
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KravenApp();
});
