/**
 * Kraven Web Application
 */
class KravenApp {
    constructor() {
        this.githubAPI = new GitHubAPI();
        this.analyzer = new RepositoryAnalyzer(this.githubAPI);
        this.forkAnalyzer = new ForkAnalyzer(this.githubAPI);
        this.currentResults = [];
        this.currentForkResults = null;
        this.currentDeepResults = null;
        this.isSearching = false;
        this.activeTab = 'hunt';
        this.charts = {};
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    initializeApp() {
        this.bindEvents();
        this.initializeTabs();
        this.updateRateLimitDisplay();
        this.setDefaultDates();
        
        // Check for GitHub token in localStorage
        const savedToken = localStorage.getItem('kraven_github_token');
        if (savedToken) {
            document.getElementById('githubToken').value = savedToken;
            document.getElementById('forkGithubToken').value = savedToken;
            document.getElementById('deepGithubToken').value = savedToken;
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

        // GitHub token inputs
        document.getElementById('githubToken').addEventListener('input', (e) => {
            this.handleTokenInput(e.target.value.trim());
        });

        document.getElementById('forkGithubToken').addEventListener('input', (e) => {
            this.handleTokenInput(e.target.value.trim());
        });

        document.getElementById('deepGithubToken').addEventListener('input', (e) => {
            this.handleTokenInput(e.target.value.trim());
        });

        // Fork analysis form
        document.getElementById('forkAnalysisForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.performForkAnalysis();
        });

        // Deep analysis form
        document.getElementById('deepAnalysisForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.performDeepAnalysis();
        });

        // Clear buttons
        document.getElementById('clearForkBtn').addEventListener('click', () => {
            this.clearForkForm();
        });

        document.getElementById('clearDeepBtn').addEventListener('click', () => {
            this.clearDeepForm();
        });

        // Export buttons
        document.getElementById('exportForkJson').addEventListener('click', () => {
            this.exportForkResults();
        });

        document.getElementById('exportDeepJson').addEventListener('click', () => {
            this.exportDeepResults();
        });

        // Sort buttons
        document.getElementById('sortForkResults').addEventListener('click', () => {
            this.sortForkResults();
        });
    }

    /**
     * Handle token input across all forms
     */
    handleTokenInput(token) {
        if (token) {
            this.githubAPI.setToken(token);
            localStorage.setItem('kraven_github_token', token);
            
            // Sync across all token inputs
            document.getElementById('githubToken').value = token;
            document.getElementById('forkGithubToken').value = token;
            document.getElementById('deepGithubToken').value = token;
        } else {
            this.githubAPI.setToken(null);
            localStorage.removeItem('kraven_github_token');
        }
        this.updateRateLimitDisplay();
    }

    /**
     * Initialize tab functionality
     */
    initializeTabs() {
        const tabs = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
                
                this.activeTab = targetTab;
                this.hideAllResults();
            });
        });
    }

    /**
     * Hide all result sections
     */
    hideAllResults() {
        document.getElementById('results').classList.add('hidden');
        document.getElementById('forkResults').classList.add('hidden');
        document.getElementById('deepResults').classList.add('hidden');
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
                ${analysis.dependencyHealth ? `
                    <div class="metric">
                        <i class="fas fa-shield-alt"></i>
                        <span class="dependency-health-${analysis.dependencyHealth}">
                            ${this.getDependencyHealthIcon(analysis.dependencyHealth)} ${analysis.dependencyHealth}
                        </span>
                    </div>
                ` : ''}
            </div>

            ${analysis.dependencyAnalysis ? `
                <div class="dependency-overview">
                    <h4><i class="fas fa-cube"></i> Dependency Analysis</h4>
                    <div class="dependency-stats">
                        <div class="dependency-stat">
                            <span class="dependency-stat-number">${analysis.dependencyAnalysis.totalDependencies}</span>
                            <span class="dependency-stat-label">Total</span>
                        </div>
                        <div class="dependency-stat">
                            <span class="dependency-stat-number">${analysis.dependencyAnalysis.outdatedDependencies}</span>
                            <span class="dependency-stat-label">Outdated</span>
                        </div>
                        <div class="dependency-stat">
                            <span class="dependency-stat-number">${analysis.dependencyAnalysis.vulnerableDependencies}</span>
                            <span class="dependency-stat-label">Vulnerable</span>
                        </div>
                        <div class="dependency-stat">
                            <span class="dependency-stat-number">${analysis.dependencyAnalysis.healthScore}/100</span>
                            <span class="dependency-stat-label">Health Score</span>
                        </div>
                    </div>
                    ${analysis.dependencyAnalysis.criticalVulnerabilities > 0 ? `
                        <div class="vulnerability-alert">
                            <h4><i class="fas fa-exclamation-triangle"></i> Critical Vulnerabilities</h4>
                            <p>${analysis.dependencyAnalysis.criticalVulnerabilities} critical security vulnerabilities found. Immediate attention required.</p>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

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
     * Perform fork analysis
     */
    async performForkAnalysis() {
        if (this.isSearching) return;

        this.isSearching = true;
        this.showLoading('🍴 Analyzing repository forks...');
        this.hideAllResults();

        try {
            // Get form data
            const formData = new FormData(document.getElementById('forkAnalysisForm'));
            const repository = formData.get('repository');
            const [owner, repo] = repository.split('/');
            
            if (!owner || !repo) {
                throw new Error('Repository must be in format "owner/repo"');
            }

            const options = {
                maxForks: parseInt(formData.get('maxForks')) || 20,
                minStars: parseInt(formData.get('minForkStars')) || 1,
                minActivity: parseInt(formData.get('minActivity')) || 365,
                sortBy: formData.get('sortBy') || 'activity',
                includeOriginal: true
            };

            // Update GitHub token if provided
            const token = formData.get('forkGithubToken');
            if (token) {
                this.githubAPI.setToken(token);
            }

            // Perform fork analysis
            this.updateLoadingMessage('Fetching repository forks...');
            this.currentForkResults = await this.forkAnalyzer.analyzeForks(owner, repo, options);

            this.displayForkResults();
            this.updateRateLimitDisplay();

        } catch (error) {
            console.error('Fork analysis failed:', error);
            this.showError(`Fork analysis failed: ${error.message}`);
        } finally {
            this.hideLoading();
            this.isSearching = false;
        }
    }

    /**
     * Display fork analysis results
     */
    displayForkResults() {
        const forkResultsSection = document.getElementById('forkResults');
        const forkResultsContainer = document.getElementById('forkResultsContainer');
        const forkResultsCount = document.getElementById('forkResultsCount');

        // Update results count
        const results = this.currentForkResults;
        forkResultsCount.textContent = `${results.totalForks} total forks, ${results.analyzedForks} analyzed, ${results.activeForks.length} active`;

        // Display overview
        this.displayForkOverview(results);
        
        // Display insights
        this.displayForkInsights(results);
        
        // Display recommendations
        this.displayForkRecommendations(results);

        // Clear previous results
        forkResultsContainer.innerHTML = '';

        // Display each fork
        results.topRecommendations.forEach((forkInfo, index) => {
            const forkCard = this.createForkCard(forkInfo, index + 1);
            forkResultsContainer.appendChild(forkCard);
        });

        // Create charts
        this.createForkCharts(results);

        // Show results section
        forkResultsSection.classList.remove('hidden');
    }

    /**
     * Display fork overview statistics
     */
    displayForkOverview(results) {
        const overviewElement = document.getElementById('forkOverview');
        
        overviewElement.innerHTML = `
            <h3><i class="fas fa-chart-bar"></i> Fork Ecosystem Overview</h3>
            <div class="fork-stats-grid">
                <div class="fork-stat-card">
                    <span class="fork-stat-number">${results.totalForks}</span>
                    <span class="fork-stat-label">Total Forks</span>
                </div>
                <div class="fork-stat-card">
                    <span class="fork-stat-number">${results.analyzedForks}</span>
                    <span class="fork-stat-label">Analyzed</span>
                </div>
                <div class="fork-stat-card">
                    <span class="fork-stat-number">${results.activeForks.length}</span>
                    <span class="fork-stat-label">Active Forks</span>
                </div>
                <div class="fork-stat-card">
                    <span class="fork-stat-number">${Math.round(results.executionTime / 1000)}s</span>
                    <span class="fork-stat-label">Analysis Time</span>
                </div>
            </div>
        `;
    }

    /**
     * Display fork insights
     */
    displayForkInsights(results) {
        const insightsElement = document.getElementById('forkInsights');
        
        if (results.insights.length > 0) {
            insightsElement.innerHTML = `
                <h3><i class="fas fa-lightbulb"></i> Key Insights</h3>
                <ul>
                    ${results.insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            `;
            insightsElement.classList.remove('hidden');
        } else {
            insightsElement.classList.add('hidden');
        }
    }

    /**
     * Display fork recommendations
     */
    displayForkRecommendations(results) {
        const recommendationsElement = document.getElementById('forkRecommendations');
        
        const hasRecommendations = results.bestForRevival || results.bestForContribution || results.mostDiverged;
        
        if (hasRecommendations) {
            let content = '<h3><i class="fas fa-star"></i> Special Recommendations</h3><div class="recommendation-grid">';
            
            if (results.bestForRevival) {
                const fork = results.bestForRevival;
                content += `
                    <div class="recommendation-card">
                        <div class="recommendation-title">
                            <i class="fas fa-rocket"></i> Best for Revival
                        </div>
                        <div class="recommendation-repo">
                            <a href="${fork.repository.html_url}" target="_blank">${fork.repository.full_name}</a>
                        </div>
                        <div class="recommendation-metrics">
                            <span>Revival: ${fork.analysis.revivalPotential}%</span>
                            <span>Activity: ${fork.activityScore}%</span>
                            <span>Health: ${fork.analysis.dependencyHealth || 'Unknown'}</span>
                        </div>
                    </div>
                `;
            }
            
            if (results.bestForContribution) {
                const fork = results.bestForContribution;
                content += `
                    <div class="recommendation-card">
                        <div class="recommendation-title">
                            <i class="fas fa-hands-helping"></i> Best for Contribution
                        </div>
                        <div class="recommendation-repo">
                            <a href="${fork.repository.html_url}" target="_blank">${fork.repository.full_name}</a>
                        </div>
                        <div class="recommendation-metrics">
                            <span>Responsiveness: ${fork.maintainerResponsiveness}%</span>
                            <span>Activity: ${fork.activityScore}%</span>
                            <span>Last Active: ${fork.lastActivityDays}d ago</span>
                        </div>
                    </div>
                `;
            }
            
            if (results.mostDiverged) {
                const fork = results.mostDiverged;
                content += `
                    <div class="recommendation-card">
                        <div class="recommendation-title">
                            <i class="fas fa-code-branch"></i> Most Diverged
                        </div>
                        <div class="recommendation-repo">
                            <a href="${fork.repository.html_url}" target="_blank">${fork.repository.full_name}</a>
                        </div>
                        <div class="recommendation-metrics">
                            <span>Divergence: ${fork.divergenceFromOriginal} commits</span>
                            <span>Stars: ${fork.repository.stargazers_count}</span>
                            <span>Activity: ${fork.activityScore}%</span>
                        </div>
                    </div>
                `;
            }
            
            content += '</div>';
            recommendationsElement.innerHTML = content;
            recommendationsElement.classList.remove('hidden');
        } else {
            recommendationsElement.classList.add('hidden');
        }
    }

    /**
     * Create fork card element
     */
    createForkCard(forkInfo, rank) {
        const repo = forkInfo.repository;
        const analysis = forkInfo.analysis;
        const card = document.createElement('div');
        card.className = 'fork-card';

        // Determine status
        let status = 'poor';
        let statusText = '❌ POOR';
        const overallScore = (forkInfo.activityScore * 0.4) + (analysis.revivalPotential * 0.3) + (forkInfo.maintainerResponsiveness * 0.3);
        
        if (overallScore > 80) {
            status = 'excellent';
            statusText = '🌟 EXCELLENT';
        } else if (overallScore > 60) {
            status = 'good';
            statusText = '🎯 GOOD';
        } else if (overallScore > 40) {
            status = 'fair';
            statusText = '⚠️ FAIR';
        }

        // Health indicator
        let healthIndicator = 'unknown';
        let healthIcon = '❓';
        if (analysis.dependencyHealth) {
            healthIndicator = analysis.dependencyHealth;
            switch (analysis.dependencyHealth) {
                case 'excellent': healthIcon = '✅'; break;
                case 'good': healthIcon = '👍'; break;
                case 'fair': healthIcon = '⚠️'; break;
                case 'poor': healthIcon = '👎'; break;
                case 'critical': healthIcon = '🚨'; break;
            }
        }

        card.innerHTML = `
            <div class="fork-rank">#${rank}</div>
            
            <div class="fork-header">
                <h3 class="fork-title">
                    <a href="${repo.html_url}" target="_blank" rel="noopener">
                        ${repo.full_name}
                    </a>
                </h3>
                <span class="fork-status status-${status}">${statusText}</span>
            </div>

            <p class="repo-description">
                ${repo.description || 'No description available'}
            </p>

            <div class="fork-metrics-grid">
                <div class="fork-metric">
                    <div class="fork-metric-value">${repo.stargazers_count.toLocaleString()}</div>
                    <div class="fork-metric-label">Stars</div>
                </div>
                <div class="fork-metric">
                    <div class="fork-metric-value">${forkInfo.activityScore}%</div>
                    <div class="fork-metric-label">Activity</div>
                </div>
                <div class="fork-metric">
                    <div class="fork-metric-value">${analysis.revivalPotential}%</div>
                    <div class="fork-metric-label">Revival Potential</div>
                </div>
                <div class="fork-metric">
                    <div class="fork-metric-value">${forkInfo.maintainerResponsiveness}%</div>
                    <div class="fork-metric-label">Responsiveness</div>
                </div>
                <div class="fork-metric">
                    <div class="fork-metric-value">${forkInfo.lastActivityDays}d</div>
                    <div class="fork-metric-label">Last Active</div>
                </div>
                <div class="fork-metric">
                    <div class="fork-metric-value">
                        <span class="fork-health-indicator health-${healthIndicator}">
                            ${healthIcon} ${analysis.dependencyHealth || 'Unknown'}
                        </span>
                    </div>
                    <div class="fork-metric-label">Dependency Health</div>
                </div>
            </div>

            <div class="repo-metrics">
                <div class="metric">
                    <i class="fas fa-code"></i>
                    <span>${repo.language || 'Unknown'}</span>
                </div>
                <div class="metric">
                    <i class="fas fa-code-branch"></i>
                    <span>${forkInfo.divergenceFromOriginal} commits ahead</span>
                </div>
                <div class="metric">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${repo.open_issues_count} open issues</span>
                </div>
                <div class="metric">
                    <i class="fas fa-users"></i>
                    <span>${repo.forks_count} forks</span>
                </div>
            </div>

            ${analysis.reasons && analysis.reasons.length > 0 ? `
                <div class="repo-reasons">
                    <h4><i class="fas fa-exclamation-triangle"></i> Analysis Notes:</h4>
                    <ul>
                        ${analysis.reasons.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${analysis.recommendations && analysis.recommendations.length > 0 ? `
                <div class="repo-recommendations">
                    <h4><i class="fas fa-lightbulb"></i> Recommendations:</h4>
                    <ul>
                        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;

        return card;
    }

    /**
     * Create charts for fork analysis
     */
    createForkCharts(results) {
        // Add charts section if it doesn't exist
        let chartsSection = document.getElementById('forkCharts');
        if (!chartsSection) {
            chartsSection = document.createElement('div');
            chartsSection.id = 'forkCharts';
            chartsSection.className = 'charts-grid';
            
            // Insert before the fork results container
            const container = document.getElementById('forkResultsContainer');
            container.parentNode.insertBefore(chartsSection, container);
        }

        // Clear existing charts
        chartsSection.innerHTML = '';

        // Activity Distribution Chart
        this.createActivityChart(chartsSection, results);
        
        // Health Distribution Chart  
        this.createHealthChart(chartsSection, results);
    }

    /**
     * Create activity distribution chart
     */
    createActivityChart(container, results) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        
        chartContainer.innerHTML = `
            <div class="chart-title">
                <i class="fas fa-chart-bar"></i> Fork Activity Distribution
            </div>
            <div class="chart-wrapper">
                <canvas id="activityChart"></canvas>
            </div>
        `;
        
        container.appendChild(chartContainer);

        const ctx = document.getElementById('activityChart').getContext('2d');
        
        // Prepare data
        const activityRanges = ['0-25%', '26-50%', '51-75%', '76-100%'];
        const activityCounts = [0, 0, 0, 0];
        
        results.topRecommendations.forEach(fork => {
            const score = fork.activityScore;
            if (score <= 25) activityCounts[0]++;
            else if (score <= 50) activityCounts[1]++;
            else if (score <= 75) activityCounts[2]++;
            else activityCounts[3]++;
        });

        this.charts.activityChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: activityRanges,
                datasets: [{
                    data: activityCounts,
                    backgroundColor: [
                        '#e74c3c',
                        '#f39c12',
                        '#27ae60',
                        '#2ecc71'
                    ],
                    borderColor: '#1a1a1a',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed} forks`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create dependency health chart
     */
    createHealthChart(container, results) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        
        chartContainer.innerHTML = `
            <div class="chart-title">
                <i class="fas fa-shield-alt"></i> Dependency Health Distribution
            </div>
            <div class="chart-wrapper">
                <canvas id="healthChart"></canvas>
            </div>
        `;
        
        container.appendChild(chartContainer);

        const ctx = document.getElementById('healthChart').getContext('2d');
        
        // Prepare data
        const healthCategories = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical', 'Unknown'];
        const healthCounts = [0, 0, 0, 0, 0, 0];
        
        results.topRecommendations.forEach(fork => {
            const health = fork.analysis.dependencyHealth;
            switch (health) {
                case 'excellent': healthCounts[0]++; break;
                case 'good': healthCounts[1]++; break;
                case 'fair': healthCounts[2]++; break;
                case 'poor': healthCounts[3]++; break;
                case 'critical': healthCounts[4]++; break;
                default: healthCounts[5]++; break;
            }
        });

        this.charts.healthChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: healthCategories,
                datasets: [{
                    label: 'Number of Forks',
                    data: healthCounts,
                    backgroundColor: [
                        '#2ecc71',
                        '#27ae60',
                        '#f39c12',
                        '#e74c3c',
                        '#c0392b',
                        '#95a5a6'
                    ],
                    borderColor: '#1a1a1a',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#ffffff',
                            stepSize: 1
                        },
                        grid: {
                            color: '#333'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: '#333'
                        }
                    }
                }
            }
        });
    }

    /**
     * Clear fork form
     */
    clearForkForm() {
        document.getElementById('forkAnalysisForm').reset();
        document.getElementById('maxForks').value = '20';
        document.getElementById('minForkStars').value = '1';
        document.getElementById('minActivity').value = '365';
        this.hideAllResults();
    }

    /**
     * Clear deep analysis form
     */
    clearDeepForm() {
        document.getElementById('deepAnalysisForm').reset();
        this.hideAllResults();
    }

    /**
     * Export fork results as JSON
     */
    exportForkResults() {
        if (!this.currentForkResults) {
            alert('No fork analysis results to export');
            return;
        }

        const dataStr = JSON.stringify(this.currentForkResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `kraven-fork-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    /**
     * Export deep analysis results as JSON
     */
    exportDeepResults() {
        if (!this.currentDeepResults) {
            alert('No deep analysis results to export');
            return;
        }

        const dataStr = JSON.stringify(this.currentDeepResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `kraven-deep-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    /**
     * Sort fork results
     */
    sortForkResults() {
        if (!this.currentForkResults || this.currentForkResults.topRecommendations.length === 0) {
            return;
        }

        // Toggle sort order
        const isCurrentlyByActivity = this.currentForkResults.topRecommendations[0].activityScore >= 
                                     this.currentForkResults.topRecommendations[this.currentForkResults.topRecommendations.length - 1].activityScore;
        
        if (isCurrentlyByActivity) {
            this.currentForkResults.topRecommendations.sort((a, b) => b.analysis.revivalPotential - a.analysis.revivalPotential);
        } else {
            this.currentForkResults.topRecommendations.sort((a, b) => b.activityScore - a.activityScore);
        }

        this.displayForkResults();
    }

    /**
     * Perform deep analysis (placeholder)
     */
    async performDeepAnalysis() {
        // This would be implemented to perform comprehensive repository analysis
        // including dependency analysis, fork analysis, and detailed metrics
        this.showError('Deep analysis feature coming soon!');
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
     * Show loading with custom message
     */
    showLoading(message = '🕷️ Kraven is working...') {
        document.getElementById('loading').classList.remove('hidden');
        this.updateLoadingMessage(message);
        
        // Update button states based on active tab
        if (this.activeTab === 'hunt') {
            document.getElementById('searchBtn').disabled = true;
            document.getElementById('searchBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hunting...';
        } else if (this.activeTab === 'forks') {
            document.getElementById('analyzeForkBtn').disabled = true;
            document.getElementById('analyzeForkBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        } else if (this.activeTab === 'analyze') {
            document.getElementById('deepAnalyzeBtn').disabled = true;
            document.getElementById('deepAnalyzeBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        }
    }

    /**
     * Hide loading and restore buttons
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        
        // Restore button states
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('searchBtn').innerHTML = '<i class="fas fa-spider"></i> Start Hunting';
        
        document.getElementById('analyzeForkBtn').disabled = false;
        document.getElementById('analyzeForkBtn').innerHTML = '<i class="fas fa-code-branch"></i> Analyze Forks';
        
        document.getElementById('deepAnalyzeBtn').disabled = false;
        document.getElementById('deepAnalyzeBtn').innerHTML = '<i class="fas fa-microscope"></i> Deep Analyze';
    }

    /**
     * Get dependency health icon
     */
    getDependencyHealthIcon(health) {
        switch (health) {
            case 'excellent': return '✅';
            case 'good': return '👍';
            case 'fair': return '⚠️';
            case 'poor': return '👎';
            case 'critical': return '🚨';
            default: return '❓';
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

.dependency-health-excellent {
    color: var(--success-color);
}

.dependency-health-good {
    color: var(--success-color);
}

.dependency-health-fair {
    color: var(--warning-color);
}

.dependency-health-poor {
    color: var(--accent-color);
}

.dependency-health-critical {
    color: var(--accent-color);
    font-weight: bold;
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
