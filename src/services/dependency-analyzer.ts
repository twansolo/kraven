import { GitHubService } from './github';
import { MultiLanguageAnalyzer, MultiLanguageAnalysis } from './multi-language-analyzer';
import axios from 'axios';

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

export interface PackageFile {
  type: 'package.json' | 'requirements.txt' | 'Cargo.toml' | 'go.mod' | 'pom.xml';
  content: string;
  path: string;
}

export class DependencyAnalyzer {
  private npmRegistryUrl = 'https://registry.npmjs.org';
  private githubAdvisoryUrl = 'https://api.github.com/advisories';
  private multiLanguageAnalyzer: MultiLanguageAnalyzer;

  constructor(private githubService: GitHubService) {
    this.multiLanguageAnalyzer = new MultiLanguageAnalyzer(githubService);
  }

  /**
   * Analyze dependencies for a repository (supports multiple languages)
   */
  async analyzeDependencies(owner: string, repo: string, useMultiLanguage = true): Promise<DependencyAnalysis> {
    // Try multi-language analysis first
    if (useMultiLanguage) {
      try {
        const multiLangAnalysis = await this.multiLanguageAnalyzer.analyzeRepository(owner, repo);
        
        // If we found multiple languages, return combined analysis
        if (Object.keys(multiLangAnalysis.analyses).length > 0) {
          return this.convertMultiLanguageAnalysis(multiLangAnalysis);
        }
      } catch (error) {
        console.warn(`Multi-language analysis failed for ${owner}/${repo}, falling back to JavaScript:`, error);
      }
    }
    
    // Fall back to original JavaScript/npm analysis
    try {
      // Get package files from the repository
      const packageFiles = await this.getPackageFiles(owner, repo);
      
      if (packageFiles.length === 0) {
        return this.createEmptyAnalysis('No dependency files found');
      }

      // For now, focus on package.json (most common)
      const packageJson = packageFiles.find(f => f.type === 'package.json');
      
      if (!packageJson) {
        return this.createEmptyAnalysis('No package.json found');
      }

      return await this.analyzePackageJson(packageJson.content);
      
    } catch (error) {
      console.warn(`Dependency analysis failed for ${owner}/${repo}:`, error);
      return this.createEmptyAnalysis('Analysis failed');
    }
  }

  /**
   * Get package/dependency files from repository
   */
  private async getPackageFiles(owner: string, repo: string): Promise<PackageFile[]> {
    const files: PackageFile[] = [];
    
    // Common dependency files to check
    const dependencyFiles = [
      { name: 'package.json', type: 'package.json' as const },
      { name: 'requirements.txt', type: 'requirements.txt' as const },
      { name: 'Cargo.toml', type: 'Cargo.toml' as const },
      { name: 'go.mod', type: 'go.mod' as const },
      { name: 'pom.xml', type: 'pom.xml' as const }
    ];

    for (const file of dependencyFiles) {
      try {
        const response = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.name}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Kraven-Hunter/1.0.0'
            }
          }
        );

        if (response.data.content) {
          const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
          files.push({
            type: file.type,
            content,
            path: file.name
          });
        }
      } catch (error) {
        // File doesn't exist, continue
        continue;
      }
    }

    return files;
  }

  /**
   * Analyze package.json dependencies
   */
  private async analyzePackageJson(content: string): Promise<DependencyAnalysis> {
    try {
      const packageData = JSON.parse(content);
      const dependencies: DependencyInfo[] = [];

      // Analyze regular dependencies
      if (packageData.dependencies) {
        const depAnalysis = await this.analyzeDependencyGroup(
          packageData.dependencies, 
          'dependency'
        );
        dependencies.push(...depAnalysis);
      }

      // Analyze dev dependencies
      if (packageData.devDependencies) {
        const devDepAnalysis = await this.analyzeDependencyGroup(
          packageData.devDependencies, 
          'devDependency'
        );
        dependencies.push(...devDepAnalysis);
      }

      // Analyze peer dependencies
      if (packageData.peerDependencies) {
        const peerDepAnalysis = await this.analyzeDependencyGroup(
          packageData.peerDependencies, 
          'peerDependency'
        );
        dependencies.push(...peerDepAnalysis);
      }

      return this.calculateDependencyHealth(dependencies);
      
    } catch (error) {
      return this.createEmptyAnalysis('Invalid package.json format');
    }
  }

  /**
   * Analyze a group of dependencies
   */
  private async analyzeDependencyGroup(
    deps: Record<string, string>, 
    type: DependencyInfo['type']
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    // Limit concurrent requests to avoid rate limiting
    const chunks = this.chunkArray(Object.entries(deps), 5);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async ([name, version]) => {
        return await this.analyzeSingleDependency(name, version, type);
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          dependencies.push(result.value);
        }
      });
      
      // Small delay between chunks
      await this.delay(200);
    }
    
    return dependencies;
  }

  /**
   * Analyze a single dependency
   */
  private async analyzeSingleDependency(
    name: string, 
    currentVersion: string, 
    type: DependencyInfo['type']
  ): Promise<DependencyInfo | null> {
    try {
      // Get package info from npm registry
      const packageInfo = await this.getNpmPackageInfo(name);
      
      if (!packageInfo) {
        return null;
      }

      const latestVersion = packageInfo['dist-tags']?.latest;
      const isOutdated = latestVersion ? this.isVersionOutdated(currentVersion, latestVersion) : false;
      
      // Check for vulnerabilities
      const vulnerabilities = await this.checkVulnerabilities(name, currentVersion);
      
      // Calculate security score
      const securityScore = this.calculateSecurityScore(vulnerabilities);

      return {
        name,
        currentVersion: this.cleanVersion(currentVersion),
        latestVersion,
        isOutdated,
        vulnerabilities,
        securityScore,
        type
      };
      
    } catch (error) {
      console.warn(`Failed to analyze dependency ${name}:`, error);
      return null;
    }
  }

  /**
   * Get package information from npm registry
   */
  private async getNpmPackageInfo(packageName: string): Promise<any> {
    try {
      const response = await axios.get(`${this.npmRegistryUrl}/${packageName}`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for known vulnerabilities
   */
  private async checkVulnerabilities(packageName: string, version: string): Promise<Vulnerability[]> {
    // This is a simplified implementation
    // In production, you'd integrate with:
    // - GitHub Security Advisories API
    // - npm audit API
    // - Snyk API
    // - OSV.dev API
    
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // Check GitHub Security Advisories (simplified)
      const response = await axios.get(
        `https://api.github.com/advisories?ecosystem=npm&package=${packageName}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Kraven-Hunter/1.0.0'
          },
          timeout: 5000
        }
      );

      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((advisory: any) => {
          if (this.isVersionVulnerable(version, advisory.vulnerable_versions)) {
            vulnerabilities.push({
              severity: this.mapSeverity(advisory.severity),
              title: advisory.summary,
              description: advisory.description || advisory.summary,
              patchedVersions: advisory.patched_versions,
              vulnerableVersions: advisory.vulnerable_versions,
              source: 'github'
            });
          }
        });
      }
    } catch (error) {
      // Silently fail - vulnerability checking is best effort
    }

    return vulnerabilities;
  }

  /**
   * Calculate overall dependency health
   */
  private calculateDependencyHealth(dependencies: DependencyInfo[]): DependencyAnalysis {
    const totalDependencies = dependencies.length;
    const outdatedDependencies = dependencies.filter(d => d.isOutdated).length;
    const vulnerableDependencies = dependencies.filter(d => d.vulnerabilities.length > 0).length;
    const criticalVulnerabilities = dependencies.reduce((sum, d) => 
      sum + d.vulnerabilities.filter(v => v.severity === 'critical').length, 0
    );

    // Calculate health score (0-100)
    let healthScore = 100;
    
    if (totalDependencies > 0) {
      // Penalize for outdated dependencies (up to -30 points)
      const outdatedRatio = outdatedDependencies / totalDependencies;
      healthScore -= Math.round(outdatedRatio * 30);
      
      // Penalize for vulnerabilities (up to -50 points)
      const vulnerableRatio = vulnerableDependencies / totalDependencies;
      healthScore -= Math.round(vulnerableRatio * 30);
      
      // Extra penalty for critical vulnerabilities (up to -20 points)
      if (criticalVulnerabilities > 0) {
        healthScore -= Math.min(criticalVulnerabilities * 10, 20);
      }
    }

    healthScore = Math.max(0, healthScore);

    // Determine health category
    let dependencyHealth: DependencyAnalysis['dependencyHealth'];
    if (criticalVulnerabilities > 0) {
      dependencyHealth = 'critical';
    } else if (healthScore >= 80) {
      dependencyHealth = 'excellent';
    } else if (healthScore >= 60) {
      dependencyHealth = 'good';
    } else if (healthScore >= 40) {
      dependencyHealth = 'fair';
    } else {
      dependencyHealth = 'poor';
    }

    // Generate recommendations
    const recommendations = this.generateDependencyRecommendations(
      dependencies,
      outdatedDependencies,
      vulnerableDependencies,
      criticalVulnerabilities
    );

    return {
      totalDependencies,
      outdatedDependencies,
      vulnerableDependencies,
      criticalVulnerabilities,
      dependencyHealth,
      healthScore,
      dependencies,
      recommendations,
      lastUpdated: new Date()
    };
  }

  /**
   * Generate dependency recommendations
   */
  private generateDependencyRecommendations(
    dependencies: DependencyInfo[],
    outdatedCount: number,
    vulnerableCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(`🚨 URGENT: ${criticalCount} critical security vulnerabilities found`);
    }

    if (vulnerableCount > 0) {
      recommendations.push(`⚠️ ${vulnerableCount} dependencies have known vulnerabilities`);
    }

    if (outdatedCount > 0) {
      const percentage = Math.round((outdatedCount / dependencies.length) * 100);
      recommendations.push(`📦 ${percentage}% of dependencies are outdated (${outdatedCount}/${dependencies.length})`);
    }

    if (dependencies.length > 100) {
      recommendations.push('📊 Large number of dependencies - consider reducing bundle size');
    }

    if (outdatedCount === 0 && vulnerableCount === 0) {
      recommendations.push('✅ All dependencies are up-to-date and secure');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private createEmptyAnalysis(reason: string): DependencyAnalysis {
    return {
      totalDependencies: 0,
      outdatedDependencies: 0,
      vulnerableDependencies: 0,
      criticalVulnerabilities: 0,
      dependencyHealth: 'unknown',
      healthScore: 0,
      dependencies: [],
      recommendations: [reason],
      lastUpdated: new Date()
    };
  }

  private isVersionOutdated(current: string, latest: string): boolean {
    // Simplified version comparison
    // In production, use a proper semver library
    const cleanCurrent = this.cleanVersion(current);
    const cleanLatest = this.cleanVersion(latest);
    
    return cleanCurrent !== cleanLatest && !cleanCurrent.includes('latest');
  }

  private cleanVersion(version: string): string {
    return version.replace(/[^0-9.]/g, '');
  }

  private isVersionVulnerable(version: string, vulnerableRange: string): boolean {
    // Simplified vulnerability check
    // In production, use proper semver range checking
    return true; // Placeholder
  }

  private mapSeverity(severity: string): Vulnerability['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': case 'medium': return 'moderate';
      case 'low': return 'low';
      default: return 'moderate';
    }
  }

  private calculateSecurityScore(vulnerabilities: Vulnerability[]): number {
    if (vulnerabilities.length === 0) return 100;
    
    let score = 100;
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'moderate': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });
    
    return Math.max(0, score);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Convert multi-language analysis to standard DependencyAnalysis
   */
  private convertMultiLanguageAnalysis(multiLangAnalysis: MultiLanguageAnalysis): DependencyAnalysis {
    // Combine all dependencies from all languages
    const allDependencies: DependencyInfo[] = [];
    let totalDeps = 0;
    let outdatedDeps = 0;
    let vulnerableDeps = 0;
    let criticalVulns = 0;
    
    Object.values(multiLangAnalysis.analyses).forEach(analysis => {
      allDependencies.push(...analysis.dependencies);
      totalDeps += analysis.totalDependencies;
      outdatedDeps += analysis.outdatedDependencies;
      vulnerableDeps += analysis.vulnerableDependencies;
      criticalVulns += analysis.criticalVulnerabilities;
    });
    
    // Enhanced recommendations combining all languages
    const enhancedRecommendations = [
      ...multiLangAnalysis.recommendations,
      ...multiLangAnalysis.crossLanguageInsights,
      `🌍 Multi-language project: ${multiLangAnalysis.detectedLanguages.join(', ')}`,
      `📊 Primary language: ${multiLangAnalysis.primaryLanguage}`
    ];
    
    return {
      totalDependencies: totalDeps,
      outdatedDependencies: outdatedDeps,
      vulnerableDependencies: vulnerableDeps,
      criticalVulnerabilities: criticalVulns,
      dependencyHealth: multiLangAnalysis.overallHealth,
      healthScore: multiLangAnalysis.overallScore,
      dependencies: allDependencies,
      recommendations: enhancedRecommendations,
      lastUpdated: new Date()
    };
  }

  /**
   * Get supported languages for multi-language analysis
   */
  getSupportedLanguages(): string[] {
    return this.multiLanguageAnalyzer.getSupportedLanguages();
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.multiLanguageAnalyzer.isLanguageSupported(language);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
