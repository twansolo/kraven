/**
 * Fork Analyzer for Web Interface
 * Simplified version of the server-side fork analyzer
 */
class ForkAnalyzer {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
    }

    /**
     * Analyze forks of a repository (simplified web version)
     */
    async analyzeForks(owner, repo, options = {}) {
        const startTime = Date.now();
        
        const {
            maxForks = 20,
            minStars = 1,
            minActivity = 365,
            sortBy = 'activity',
            includeOriginal = true
        } = options;

        try {
            // Get the original repository
            const originalRepo = await this.githubAPI.getRepository(owner, repo);
            
            // Get forks (simplified - using search API)
            const allForks = await this.getAllForks(owner, repo, maxForks * 2);
            
            // Filter forks based on criteria
            const filteredForks = this.filterForks(allForks, minStars, minActivity);
            
            // Limit to maxForks for analysis
            const forksToAnalyze = filteredForks.slice(0, maxForks);
            
            // Analyze each fork (simplified analysis)
            const forkAnalyses = [];
            
            // Analyze original repo if requested
            if (includeOriginal) {
                const originalAnalysis = await this.analyzeFork(originalRepo, originalRepo, true);
                if (originalAnalysis) {
                    forkAnalyses.push(originalAnalysis);
                }
            }
            
            // Analyze forks
            for (let i = 0; i < forksToAnalyze.length; i++) {
                const fork = forksToAnalyze[i];
                
                try {
                    const analysis = await this.analyzeFork(fork, originalRepo, false);
                    if (analysis) {
                        forkAnalyses.push(analysis);
                    }
                    
                    // Small delay to avoid rate limiting
                    await this.delay(200);
                } catch (error) {
                    console.warn(`Failed to analyze fork ${fork.full_name}:`, error);
                }
            }
            
            // Sort and rank forks
            const sortedForks = this.sortForks(forkAnalyses, sortBy);
            const rankedForks = this.rankForks(sortedForks);
            
            // Generate insights and recommendations
            const insights = this.generateForkInsights(rankedForks, originalRepo);
            const recommendations = this.generateForkRecommendations(rankedForks);
            
            const executionTime = Date.now() - startTime;
            
            return {
                original: originalRepo,
                totalForks: allForks.length,
                analyzedForks: forkAnalyses.length,
                activeForks: rankedForks.filter(f => f.activityScore > 30),
                topRecommendations: recommendations.slice(0, 10),
                insights,
                bestForRevival: recommendations.find(f => f.analysis.revivalPotential > 60),
                bestForContribution: recommendations.find(f => f.maintainerResponsiveness > 70),
                mostDiverged: rankedForks.reduce((max, fork) => 
                    fork.divergenceFromOriginal > (max?.divergenceFromOriginal || 0) ? fork : max, 
                    rankedForks[0]
                ),
                executionTime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            throw new Error(`Fork analysis failed: ${error.message}`);
        }
    }

    /**
     * Get all forks of a repository (simplified)
     */
    async getAllForks(owner, repo, maxForks) {
        try {
            // Use GitHub search API to find forks
            const searchQuery = `fork:true ${repo} in:name`;
            const searchResponse = await this.githubAPI.searchRepositories({
                language: undefined,
                minStars: 0
            }, 1, Math.min(maxForks, 100));

            // Filter to actual forks of this repository
            const forks = searchResponse.items.filter(item => 
                item.fork && item.full_name.includes(repo)
            );

            return forks;
        } catch (error) {
            console.warn('Fork search failed, returning empty array:', error);
            return [];
        }
    }

    /**
     * Filter forks based on criteria
     */
    filterForks(forks, minStars, minActivityDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - minActivityDays);
        
        return forks.filter(fork => {
            // Filter by minimum stars
            if (fork.stargazers_count < minStars) return false;
            
            // Filter by recent activity
            const lastPush = new Date(fork.pushed_at);
            if (lastPush < cutoffDate) return false;
            
            // Filter out archived or disabled repos
            if (fork.archived || fork.disabled) return false;
            
            return true;
        });
    }

    /**
     * Analyze a single fork (simplified)
     */
    async analyzeFork(fork, original, isOriginal) {
        try {
            // Create a simplified repository analyzer
            const analyzer = new RepositoryAnalyzer(this.githubAPI);
            
            // Get basic analysis
            const analysis = await analyzer.analyzeRepository(fork);
            
            // Calculate fork-specific metrics
            const activityScore = this.calculateActivityScore(fork);
            const divergenceFromOriginal = this.calculateDivergence(fork, original);
            const lastActivityDays = this.calculateDaysSince(fork.pushed_at);
            const hasRecentCommits = lastActivityDays < 30;
            const hasRecentReleases = lastActivityDays < 90; // Simplified
            const maintainerResponsiveness = this.calculateMaintainerResponsiveness(fork);
            
            return {
                repository: fork,
                analysis,
                activityScore,
                divergenceFromOriginal,
                lastActivityDays,
                hasRecentCommits,
                hasRecentReleases,
                maintainerResponsiveness,
                forkRank: 0 // Will be set during ranking
            };
            
        } catch (error) {
            console.warn(`Failed to analyze fork ${fork.full_name}:`, error);
            return null;
        }
    }

    /**
     * Calculate activity score for a fork
     */
    calculateActivityScore(repo) {
        let score = 0;
        
        // Recent activity (0-40 points)
        const daysSinceLastPush = this.calculateDaysSince(repo.pushed_at);
        if (daysSinceLastPush < 7) score += 40;
        else if (daysSinceLastPush < 30) score += 30;
        else if (daysSinceLastPush < 90) score += 20;
        else if (daysSinceLastPush < 180) score += 10;
        
        // Community engagement (0-30 points)
        score += Math.min(repo.stargazers_count / 2, 20);
        score += Math.min(repo.forks_count, 10);
        
        // Issues and maintenance (0-20 points)
        const issueActivity = Math.min(repo.open_issues_count / 5, 10);
        score += issueActivity;
        
        // Size indicates development (0-10 points)
        if (repo.size > 1000) score += 10;
        else if (repo.size > 100) score += 5;
        
        return Math.min(score, 100);
    }

    /**
     * Calculate divergence from original repository (simplified)
     */
    calculateDivergence(fork, original) {
        // Simplified calculation based on size and time differences
        const sizeDifference = Math.abs(fork.size - original.size);
        const timeDifference = Math.abs(
            new Date(fork.pushed_at).getTime() - new Date(original.pushed_at).getTime()
        );
        
        // Convert to rough "commits ahead" estimate
        const estimatedDivergence = Math.floor(sizeDifference / 100) + 
                                  Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 7));
        
        return Math.max(0, estimatedDivergence);
    }

    /**
     * Calculate maintainer responsiveness (simplified)
     */
    calculateMaintainerResponsiveness(repo) {
        const daysSinceUpdate = this.calculateDaysSince(repo.updated_at);
        const openIssuesRatio = repo.open_issues_count / Math.max(repo.stargazers_count / 10, 1);
        
        let score = 50; // Base score
        
        // Recent activity indicates responsiveness
        if (daysSinceUpdate < 7) score += 30;
        else if (daysSinceUpdate < 30) score += 20;
        else if (daysSinceUpdate < 90) score += 10;
        else if (daysSinceUpdate > 365) score -= 30;
        
        // Lower open issues ratio indicates better maintenance
        if (openIssuesRatio < 0.1) score += 20;
        else if (openIssuesRatio < 0.5) score += 10;
        else if (openIssuesRatio > 2) score -= 20;
        
        return Math.max(0, Math.min(score, 100));
    }

    /**
     * Sort forks by specified criteria
     */
    sortForks(forks, sortBy) {
        return forks.sort((a, b) => {
            switch (sortBy) {
                case 'activity':
                    return b.activityScore - a.activityScore;
                case 'stars':
                    return b.repository.stargazers_count - a.repository.stargazers_count;
                case 'divergence':
                    return b.divergenceFromOriginal - a.divergenceFromOriginal;
                case 'health':
                    return b.analysis.revivalPotential - a.analysis.revivalPotential;
                default:
                    return b.activityScore - a.activityScore;
            }
        });
    }

    /**
     * Rank forks and assign positions
     */
    rankForks(forks) {
        return forks.map((fork, index) => ({
            ...fork,
            forkRank: index + 1
        }));
    }

    /**
     * Generate insights about the fork ecosystem
     */
    generateForkInsights(forks, original) {
        const insights = [];
        
        if (forks.length === 0) {
            insights.push('No active forks found - original repository may be the only option');
            return insights;
        }
        
        const activeForks = forks.filter(f => f.activityScore > 30);
        const recentlyActiveForks = forks.filter(f => f.lastActivityDays < 30);
        const highlyDivergedForks = forks.filter(f => f.divergenceFromOriginal > 50);
        
        insights.push(`Found ${activeForks.length} active forks out of ${forks.length} analyzed`);
        
        if (recentlyActiveForks.length > 0) {
            insights.push(`${recentlyActiveForks.length} forks have commits within the last 30 days`);
        }
        
        if (highlyDivergedForks.length > 0) {
            insights.push(`${highlyDivergedForks.length} forks have significantly diverged from original`);
        }
        
        const bestFork = forks[0];
        if (bestFork && bestFork.activityScore > 60) {
            insights.push(`Top fork "${bestFork.repository.full_name}" shows strong activity (${bestFork.activityScore}/100)`);
        }
        
        return insights;
    }

    /**
     * Generate fork recommendations
     */
    generateForkRecommendations(forks) {
        // Sort by a combination of activity, health, and responsiveness
        return forks.sort((a, b) => {
            const scoreA = (a.activityScore * 0.4) + (a.analysis.revivalPotential * 0.3) + (a.maintainerResponsiveness * 0.3);
            const scoreB = (b.activityScore * 0.4) + (b.analysis.revivalPotential * 0.3) + (b.maintainerResponsiveness * 0.3);
            return scoreB - scoreA;
        });
    }

    /**
     * Calculate days since a date
     */
    calculateDaysSince(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
