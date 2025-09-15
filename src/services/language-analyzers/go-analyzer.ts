import { DependencyInfo, Vulnerability, DependencyAnalysis } from '../../types';
import axios from 'axios';

export interface GoModuleInfo {
  module: string;
  version: string;
  time?: string;
  origin?: {
    VCS: string;
    URL: string;
    Ref: string;
    Hash: string;
  };
}

export interface GoModule {
  path: string;
  version: string;
  replace?: {
    path: string;
    version: string;
  };
  indirect?: boolean;
}

export class GoAnalyzer {
  private goProxyUrl = 'https://proxy.golang.org';
  private pkgGoDevUrl = 'https://pkg.go.dev';

  /**
   * Analyze Go dependencies from go.mod
   */
  async analyzeGoDependencies(goModContent: string): Promise<DependencyAnalysis> {
    try {
      const goMod = this.parseGoMod(goModContent);
      const dependencies: DependencyInfo[] = [];

      // Analyze all dependencies
      for (const dep of goMod.require || []) {
        const dependency = await this.analyzeGoModule(dep.path, dep.version);
        if (dependency) {
          dependencies.push(dependency);
        }
      }

      return this.calculateDependencyHealth(dependencies);
      
    } catch (error) {
      console.warn('Failed to analyze Go dependencies:', error);
      return this.createEmptyAnalysis('Failed to parse go.mod');
    }
  }

  /**
   * Parse go.mod file
   */
  private parseGoMod(content: string): {
    module?: string;
    go?: string;
    require?: GoModule[];
    exclude?: GoModule[];
    replace?: { old: GoModule; new: GoModule }[];
  } {
    const result: any = {
      require: []
    };
    
    try {
      const lines = content.split('\n');
      let currentSection = '';
      let inRequireBlock = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('module ')) {
          result.module = trimmed.replace('module ', '');
        } else if (trimmed.startsWith('go ')) {
          result.go = trimmed.replace('go ', '');
        } else if (trimmed === 'require (') {
          inRequireBlock = true;
        } else if (trimmed === ')' && inRequireBlock) {
          inRequireBlock = false;
        } else if (inRequireBlock || trimmed.startsWith('require ')) {
          const requireMatch = trimmed.match(/^(?:require\s+)?([^\s]+)\s+([^\s]+)(?:\s+\/\/\s*(.*))?/);
          if (requireMatch) {
            result.require.push({
              path: requireMatch[1],
              version: requireMatch[2],
              indirect: requireMatch[3]?.includes('indirect') || false
            });
          }
        }
      }
      
    } catch (error) {
      console.warn('Failed to parse go.mod:', error);
    }

    return result;
  }

  /**
   * Analyze a single Go module
   */
  private async analyzeGoModule(
    modulePath: string,
    version: string
  ): Promise<DependencyInfo | null> {
    try {
      // Get module info from Go proxy
      const moduleInfo = await this.getGoModuleInfo(modulePath);
      if (!moduleInfo) return null;

      const latestVersion = await this.getLatestGoVersion(modulePath);
      const isOutdated = latestVersion ? this.isVersionOutdated(version, latestVersion) : false;
      
      // Check for vulnerabilities via Go vulnerability database
      const vulnerabilities = await this.checkGoVulnerabilities(modulePath, version);
      
      // Calculate security score
      const securityScore = this.calculateSecurityScore(vulnerabilities);

      return {
        name: modulePath,
        currentVersion: version,
        latestVersion: latestVersion || undefined,
        isOutdated,
        vulnerabilities,
        securityScore,
        type: 'dependency'
      };
      
    } catch (error) {
      console.warn(`Failed to analyze Go module ${modulePath}:`, error);
      return null;
    }
  }

  /**
   * Get Go module information from proxy
   */
  private async getGoModuleInfo(modulePath: string): Promise<GoModuleInfo | null> {
    try {
      const response = await axios.get(`${this.goProxyUrl}/${modulePath}/@latest`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get latest version of Go module
   */
  private async getLatestGoVersion(modulePath: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.goProxyUrl}/${modulePath}/@latest`, {
        timeout: 5000
      });
      return response.data.Version;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for Go vulnerabilities (simplified)
   */
  private async checkGoVulnerabilities(modulePath: string, version: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // In a real implementation, you'd use the Go vulnerability database
      // For now, we'll use a placeholder that could be enhanced with govulncheck
      
      // This is a simplified check - would need proper Go vuln DB integration
      const response = await axios.get(`https://api.github.com/repos/golang/vulndb/contents/data/osv/${modulePath.replace('/', '-')}.json`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-Go-Analyzer/1.0.0'
        }
      });

      if (response.data) {
        vulnerabilities.push({
          severity: 'moderate',
          title: `Potential vulnerability found for ${modulePath}`,
          description: 'Check Go vulnerability database for details',
          vulnerableVersions: version,
          source: 'github'
        });
      }
    } catch (error) {
      // No vulnerabilities found or API error - this is normal
    }

    return vulnerabilities;
  }

  /**
   * Calculate dependency health for Go
   */
  private calculateDependencyHealth(dependencies: DependencyInfo[]): DependencyAnalysis {
    const totalDependencies = dependencies.length;
    const outdatedDependencies = dependencies.filter(d => d.isOutdated).length;
    const vulnerableDependencies = dependencies.filter(d => d.vulnerabilities.length > 0).length;
    const criticalVulnerabilities = dependencies.reduce((sum, d) => 
      sum + d.vulnerabilities.filter(v => v.severity === 'critical').length, 0
    );

    // Calculate health score (Go modules are generally well-maintained)
    let healthScore = 100;
    
    if (totalDependencies > 0) {
      const outdatedRatio = outdatedDependencies / totalDependencies;
      const vulnerableRatio = vulnerableDependencies / totalDependencies;
      
      healthScore -= Math.round(outdatedRatio * 20); // Go is conservative with updates
      healthScore -= Math.round(vulnerableRatio * 40);
      
      if (criticalVulnerabilities > 0) {
        healthScore -= Math.min(criticalVulnerabilities * 20, 40);
      }
    }

    healthScore = Math.max(0, healthScore);

    // Determine health category
    let dependencyHealth: DependencyAnalysis['dependencyHealth'];
    if (criticalVulnerabilities > 0) {
      dependencyHealth = 'critical';
    } else if (healthScore >= 85) {
      dependencyHealth = 'excellent';
    } else if (healthScore >= 70) {
      dependencyHealth = 'good';
    } else if (healthScore >= 50) {
      dependencyHealth = 'fair';
    } else {
      dependencyHealth = 'poor';
    }

    // Generate Go-specific recommendations
    const recommendations = this.generateGoRecommendations(
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
   * Generate Go-specific recommendations
   */
  private generateGoRecommendations(
    dependencies: DependencyInfo[],
    outdatedCount: number,
    vulnerableCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(`🚨 URGENT: ${criticalCount} critical vulnerabilities in Go modules`);
    }

    if (vulnerableCount > 0) {
      recommendations.push(`⚠️ ${vulnerableCount} Go modules have known vulnerabilities`);
    }

    if (outdatedCount > 0) {
      const percentage = Math.round((outdatedCount / dependencies.length) * 100);
      recommendations.push(`📦 ${percentage}% of Go modules are outdated (${outdatedCount}/${dependencies.length})`);
    }

    // Go-specific recommendations
    if (dependencies.some(d => d.name.includes('gin-gonic/gin') && d.isOutdated)) {
      recommendations.push('🌐 Gin web framework is outdated - update for performance improvements');
    }

    if (dependencies.some(d => d.name.includes('gorilla/mux') && d.isOutdated)) {
      recommendations.push('🦍 Gorilla Mux router is outdated - consider updating or migrating to newer alternatives');
    }

    if (dependencies.some(d => d.name.includes('kubernetes') && d.isOutdated)) {
      recommendations.push('☸️ Kubernetes dependencies are outdated - critical for container security');
    }

    if (dependencies.length > 20) {
      recommendations.push('📊 Large number of Go modules - consider using go mod tidy to clean up');
    }

    if (outdatedCount === 0 && vulnerableCount === 0) {
      recommendations.push('✅ All Go modules are up-to-date and secure - excellent Go module hygiene!');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private isVersionOutdated(current: string, latest: string): boolean {
    // Go uses semantic versioning
    const currentVersion = current.replace(/^v/, '');
    const latestVersion = latest.replace(/^v/, '');
    
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;
      
      if (currentPart < latestPart) return true;
      if (currentPart > latestPart) return false;
    }
    
    return false;
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

  private createEmptyAnalysis(reason: string): DependencyAnalysis {
    return {
      totalDependencies: 0,
      outdatedDependencies: 0,
      vulnerableDependencies: 0,
      criticalVulnerabilities: 0,
      dependencyHealth: 'excellent',
      healthScore: 100,
      dependencies: [],
      recommendations: [reason],
      lastUpdated: new Date()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
