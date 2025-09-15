import { DependencyInfo, Vulnerability, DependencyAnalysis } from '../../types';
import axios from 'axios';

export interface CrateInfo {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  documentation?: string;
  downloads: number;
  created_at: string;
  updated_at: string;
}

export interface CargoToml {
  package?: {
    name: string;
    version: string;
    edition?: string;
    license?: string;
    description?: string;
  };
  dependencies?: { [name: string]: string | { version: string; features?: string[] } };
  'dev-dependencies'?: { [name: string]: string | { version: string } };
  'build-dependencies'?: { [name: string]: string | { version: string } };
}

export class RustAnalyzer {
  private cratesIoUrl = 'https://crates.io/api/v1';

  /**
   * Analyze Rust dependencies from Cargo.toml
   */
  async analyzeRustDependencies(cargoTomlContent: string): Promise<DependencyAnalysis> {
    try {
      const cargoToml = this.parseCargoToml(cargoTomlContent);
      const dependencies: DependencyInfo[] = [];

      // Analyze regular dependencies
      if (cargoToml.dependencies) {
        const normalizedDeps = this.normalizeDependencies(cargoToml.dependencies);
        const deps = await this.analyzeDependencyGroup(normalizedDeps, 'dependency');
        dependencies.push(...deps);
      }

      // Analyze dev dependencies
      if (cargoToml['dev-dependencies']) {
        const normalizedDeps = this.normalizeDependencies(cargoToml['dev-dependencies']);
        const devDeps = await this.analyzeDependencyGroup(normalizedDeps, 'devDependency');
        dependencies.push(...devDeps);
      }

      // Analyze build dependencies
      if (cargoToml['build-dependencies']) {
        const normalizedDeps = this.normalizeDependencies(cargoToml['build-dependencies']);
        const buildDeps = await this.analyzeDependencyGroup(normalizedDeps, 'dependency');
        dependencies.push(...buildDeps);
      }

      return this.calculateDependencyHealth(dependencies);
      
    } catch (error) {
      console.warn('Failed to analyze Rust dependencies:', error);
      return this.createEmptyAnalysis('Failed to parse Cargo.toml');
    }
  }

  /**
   * Parse Cargo.toml (simplified TOML parsing)
   */
  private parseCargoToml(content: string): CargoToml {
    const result: CargoToml = {};
    
    try {
      // Simple TOML parsing - in production, use a proper TOML parser
      const sections = content.split(/^\[/m);
      
      sections.forEach(section => {
        if (section.startsWith('dependencies]')) {
          result.dependencies = this.parseTomlDependencies(section);
        } else if (section.startsWith('dev-dependencies]')) {
          result['dev-dependencies'] = this.parseTomlDependencies(section);
        } else if (section.startsWith('build-dependencies]')) {
          result['build-dependencies'] = this.parseTomlDependencies(section);
        } else if (section.startsWith('package]')) {
          result.package = this.parseTomlPackage(section);
        }
      });
      
    } catch (error) {
      console.warn('Failed to parse Cargo.toml:', error);
    }

    return result;
  }

  /**
   * Parse TOML dependencies section
   */
  private parseTomlDependencies(section: string): { [name: string]: string } {
    const dependencies: { [name: string]: string } = {};
    
    const lines = section.split('\n').filter(line => 
      line.includes('=') && !line.trim().startsWith('#')
    );
    
    lines.forEach(line => {
      const match = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*"([^"]+)"/);
      if (match) {
        dependencies[match[1]] = match[2];
      } else {
        // Handle complex dependency specs like { version = "1.0", features = ["serde"] }
        const complexMatch = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*\{.*?version\s*=\s*"([^"]+)".*?\}/);
        if (complexMatch) {
          dependencies[complexMatch[1]] = complexMatch[2];
        }
      }
    });

    return dependencies;
  }

  /**
   * Parse TOML package section
   */
  private parseTomlPackage(section: string): CargoToml['package'] {
    const pkg: any = {};
    
    const lines = section.split('\n').filter(line => 
      line.includes('=') && !line.trim().startsWith('#')
    );
    
    lines.forEach(line => {
      const match = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*"([^"]+)"/);
      if (match) {
        const key = match[1] as keyof NonNullable<CargoToml['package']>;
        (pkg as any)[key] = match[2];
      }
    });

    return pkg;
  }

  /**
   * Analyze a group of Rust dependencies
   */
  private async analyzeDependencyGroup(
    deps: { [name: string]: string },
    type: DependencyInfo['type']
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    // Process in chunks to avoid rate limiting
    const entries = Object.entries(deps);
    const chunkSize = 5;
    
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async ([name, version]) => {
        return await this.analyzeRustCrate(name, version, type);
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          dependencies.push(result.value);
        }
      });
      
      // Rate limiting delay
      await this.delay(300);
    }
    
    return dependencies;
  }

  /**
   * Analyze a single Rust crate
   */
  private async analyzeRustCrate(
    crateName: string,
    versionSpec: string,
    type: DependencyInfo['type']
  ): Promise<DependencyInfo | null> {
    try {
      // Get crate info from crates.io
      const crateInfo = await this.getCrateInfo(crateName);
      if (!crateInfo) return null;

      const latestVersion = crateInfo.version;
      const currentVersion = this.extractVersionFromSpec(versionSpec);
      const isOutdated = this.isVersionOutdated(currentVersion, latestVersion);
      
      // Check for vulnerabilities via RustSec
      const vulnerabilities = await this.checkRustVulnerabilities(crateName, currentVersion);
      
      // Calculate security score
      const securityScore = this.calculateSecurityScore(vulnerabilities);

      return {
        name: crateName,
        currentVersion,
        latestVersion,
        isOutdated,
        vulnerabilities,
        securityScore,
        type
      };
      
    } catch (error) {
      console.warn(`Failed to analyze Rust crate ${crateName}:`, error);
      return null;
    }
  }

  /**
   * Get crate information from crates.io
   */
  private async getCrateInfo(crateName: string): Promise<CrateInfo | null> {
    try {
      const response = await axios.get(`${this.cratesIoUrl}/crates/${crateName}`, {
        timeout: 5000
      });
      
      if (response.data.crate) {
        return {
          name: response.data.crate.name,
          version: response.data.crate.newest_version,
          description: response.data.crate.description,
          license: response.data.crate.license,
          repository: response.data.crate.repository,
          homepage: response.data.crate.homepage,
          documentation: response.data.crate.documentation,
          downloads: response.data.crate.downloads,
          created_at: response.data.crate.created_at,
          updated_at: response.data.crate.updated_at
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for Rust vulnerabilities (simplified)
   */
  private async checkRustVulnerabilities(crateName: string, version: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // Check RustSec advisory database via GitHub API
      const response = await axios.get(`https://api.github.com/repos/RustSec/advisory-db/contents/crates/${crateName}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-Rust-Analyzer/1.0.0'
        }
      });

      if (response.data && Array.isArray(response.data)) {
        // Found potential advisories for this crate
        vulnerabilities.push({
          severity: 'moderate',
          title: `Security advisory found for ${crateName}`,
          description: 'Check RustSec advisory database for details',
          vulnerableVersions: version,
          source: 'github'
        });
      }
    } catch (error) {
      // No advisories found or API error - this is normal
    }

    return vulnerabilities;
  }

  /**
   * Calculate dependency health for Rust
   */
  private calculateDependencyHealth(dependencies: DependencyInfo[]): DependencyAnalysis {
    const totalDependencies = dependencies.length;
    const outdatedDependencies = dependencies.filter(d => d.isOutdated).length;
    const vulnerableDependencies = dependencies.filter(d => d.vulnerabilities.length > 0).length;
    const criticalVulnerabilities = dependencies.reduce((sum, d) => 
      sum + d.vulnerabilities.filter(v => v.severity === 'critical').length, 0
    );

    // Calculate health score (Rust is generally more stable)
    let healthScore = 100;
    
    if (totalDependencies > 0) {
      const outdatedRatio = outdatedDependencies / totalDependencies;
      const vulnerableRatio = vulnerableDependencies / totalDependencies;
      
      healthScore -= Math.round(outdatedRatio * 25);
      healthScore -= Math.round(vulnerableRatio * 35);
      
      if (criticalVulnerabilities > 0) {
        healthScore -= Math.min(criticalVulnerabilities * 15, 30);
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

    // Generate Rust-specific recommendations
    const recommendations = this.generateRustRecommendations(
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
   * Generate Rust-specific recommendations
   */
  private generateRustRecommendations(
    dependencies: DependencyInfo[],
    outdatedCount: number,
    vulnerableCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(`🚨 URGENT: ${criticalCount} critical vulnerabilities in Rust crates`);
    }

    if (vulnerableCount > 0) {
      recommendations.push(`⚠️ ${vulnerableCount} Rust crates have known vulnerabilities`);
    }

    if (outdatedCount > 0) {
      const percentage = Math.round((outdatedCount / dependencies.length) * 100);
      recommendations.push(`📦 ${percentage}% of Rust crates are outdated (${outdatedCount}/${dependencies.length})`);
    }

    // Rust-specific recommendations
    if (dependencies.some(d => d.name === 'serde' && d.isOutdated)) {
      recommendations.push('📄 Serde serialization library is outdated - update for performance improvements');
    }

    if (dependencies.some(d => d.name === 'tokio' && d.isOutdated)) {
      recommendations.push('⚡ Tokio async runtime is outdated - update for latest async features');
    }

    if (dependencies.some(d => d.name === 'reqwest' && d.vulnerabilities.length > 0)) {
      recommendations.push('🌐 Reqwest HTTP client has vulnerabilities - critical for security');
    }

    if (dependencies.length > 30) {
      recommendations.push('📊 Large number of Rust dependencies - consider feature flags to reduce bloat');
    }

    if (outdatedCount === 0 && vulnerableCount === 0) {
      recommendations.push('✅ All Rust crates are up-to-date and secure - excellent Rust hygiene!');
    }

    return recommendations;
  }

  /**
   * Normalize dependencies to simple string format
   */
  private normalizeDependencies(deps: { [name: string]: any }): { [name: string]: string } {
    const normalized: { [name: string]: string } = {};
    
    Object.entries(deps).forEach(([name, spec]) => {
      if (typeof spec === 'string') {
        normalized[name] = spec;
      } else if (typeof spec === 'object' && spec.version) {
        normalized[name] = spec.version;
      } else {
        normalized[name] = 'latest';
      }
    });
    
    return normalized;
  }

  /**
   * Helper methods
   */
  private extractVersionFromSpec(versionSpec: string): string {
    // Handle Rust version specs like "1.0", "^1.0.0", "~1.0", ">=1.0.0"
    const match = String(versionSpec).match(/[\d.]+/);
    return match ? match[0] : String(versionSpec);
  }

  private isVersionOutdated(current: string, latest: string): boolean {
    // Simplified semver comparison
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
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
        case 'critical': score -= 35; break;
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