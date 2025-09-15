import { DependencyInfo, Vulnerability, DependencyAnalysis } from '../../types';
import axios from 'axios';

export interface MavenArtifact {
  groupId: string;
  artifactId: string;
  version: string;
  packaging?: string;
  classifier?: string;
  scope?: string;
}

export interface MavenMetadata {
  groupId: string;
  artifactId: string;
  versioning: {
    latest: string;
    release: string;
    versions: string[];
    lastUpdated: string;
  };
}

export class JavaAnalyzer {
  private mavenCentralUrl = 'https://search.maven.org/solrsearch/select';
  private mavenMetadataUrl = 'https://repo1.maven.org/maven2';

  /**
   * Analyze Java dependencies from various build files
   */
  async analyzeJavaDependencies(fileContent: string, fileType: string): Promise<DependencyAnalysis> {
    let dependencies: DependencyInfo[] = [];

    switch (fileType) {
      case 'pom.xml':
        dependencies = await this.parsePomXml(fileContent);
        break;
      case 'build.gradle':
        dependencies = await this.parseBuildGradle(fileContent);
        break;
      case 'gradle.properties':
        dependencies = await this.parseGradleProperties(fileContent);
        break;
      default:
        throw new Error(`Unsupported Java dependency file type: ${fileType}`);
    }

    return this.calculateDependencyHealth(dependencies);
  }

  /**
   * Parse Maven pom.xml
   */
  private async parsePomXml(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    try {
      // Simple XML parsing for dependencies
      const dependencyMatches = content.match(/<dependency>([\s\S]*?)<\/dependency>/g);
      
      if (dependencyMatches) {
        for (const depMatch of dependencyMatches) {
          const groupIdMatch = depMatch.match(/<groupId>(.*?)<\/groupId>/);
          const artifactIdMatch = depMatch.match(/<artifactId>(.*?)<\/artifactId>/);
          const versionMatch = depMatch.match(/<version>(.*?)<\/version>/);
          const scopeMatch = depMatch.match(/<scope>(.*?)<\/scope>/);
          
          if (groupIdMatch && artifactIdMatch && versionMatch) {
            const groupId = groupIdMatch[1];
            const artifactId = artifactIdMatch[1];
            const version = versionMatch[1];
            const scope = scopeMatch?.[1] || 'compile';
            
            // Skip test dependencies for main analysis
            if (scope !== 'test') {
              const dependency = await this.analyzeMavenArtifact(groupId, artifactId, version);
              if (dependency) {
                dependencies.push(dependency);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse pom.xml:', error);
    }

    return dependencies;
  }

  /**
   * Parse Gradle build.gradle
   */
  private async parseBuildGradle(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    try {
      // Parse Gradle dependencies (simplified)
      const dependencyLines = content.split('\n').filter(line => 
        (line.includes('implementation') || line.includes('compile') || line.includes('api')) &&
        line.includes("'") || line.includes('"')
      );
      
      for (const line of dependencyLines) {
        // Handle formats like: implementation 'group:artifact:version'
        const match = line.match(/['"]([^:'"]+):([^:'"]+):([^:'"]+)['"]/);
        if (match) {
          const groupId = match[1];
          const artifactId = match[2];
          const version = match[3];
          
          const dependency = await this.analyzeMavenArtifact(groupId, artifactId, version);
          if (dependency) {
            dependencies.push(dependency);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse build.gradle:', error);
    }

    return dependencies;
  }

  /**
   * Parse Gradle properties (simplified)
   */
  private async parseGradleProperties(content: string): Promise<DependencyInfo[]> {
    // Gradle properties typically don't contain direct dependencies
    // but may contain version definitions
    return [];
  }

  /**
   * Analyze a single Maven artifact
   */
  private async analyzeMavenArtifact(
    groupId: string,
    artifactId: string,
    version: string
  ): Promise<DependencyInfo | null> {
    try {
      // Get artifact info from Maven Central
      const artifactInfo = await this.getMavenArtifactInfo(groupId, artifactId);
      if (!artifactInfo) return null;

      const latestVersion = artifactInfo.versioning.latest || artifactInfo.versioning.release;
      const isOutdated = this.isVersionOutdated(version, latestVersion);
      
      // Check for vulnerabilities
      const vulnerabilities = await this.checkJavaVulnerabilities(groupId, artifactId, version);
      
      // Calculate security score
      const securityScore = this.calculateSecurityScore(vulnerabilities);

      return {
        name: `${groupId}:${artifactId}`,
        currentVersion: version,
        latestVersion,
        isOutdated,
        vulnerabilities,
        securityScore,
        type: 'dependency'
      };
      
    } catch (error) {
      console.warn(`Failed to analyze Maven artifact ${groupId}:${artifactId}:`, error);
      return null;
    }
  }

  /**
   * Get Maven artifact information
   */
  private async getMavenArtifactInfo(groupId: string, artifactId: string): Promise<MavenMetadata | null> {
    try {
      const metadataUrl = `${this.mavenMetadataUrl}/${groupId.replace(/\./g, '/')}/${artifactId}/maven-metadata.xml`;
      const response = await axios.get(metadataUrl, {
        timeout: 5000
      });
      
      // Simple XML parsing for Maven metadata
      const versioningMatch = response.data.match(/<versioning>([\s\S]*?)<\/versioning>/);
      if (versioningMatch) {
        const versioning = versioningMatch[1];
        const latestMatch = versioning.match(/<latest>(.*?)<\/latest>/);
        const releaseMatch = versioning.match(/<release>(.*?)<\/release>/);
        const lastUpdatedMatch = versioning.match(/<lastUpdated>(.*?)<\/lastUpdated>/);
        
        return {
          groupId,
          artifactId,
          versioning: {
            latest: latestMatch?.[1] || '',
            release: releaseMatch?.[1] || '',
            versions: [], // Would need to parse <versions> section
            lastUpdated: lastUpdatedMatch?.[1] || ''
          }
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for Java vulnerabilities (simplified)
   */
  private async checkJavaVulnerabilities(groupId: string, artifactId: string, version: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // In a real implementation, you'd integrate with:
      // - OWASP Dependency Check
      // - Snyk API
      // - GitHub Security Advisories
      // - OSS Index by Sonatype
      
      // For now, we'll use a placeholder
      const response = await axios.get(`https://api.github.com/advisories?ecosystem=maven&package=${groupId}:${artifactId}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-Java-Analyzer/1.0.0'
        }
      });

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
      // No vulnerabilities found or API error - this is normal
    }

    return vulnerabilities;
  }

  /**
   * Calculate dependency health for Java
   */
  private calculateDependencyHealth(dependencies: DependencyInfo[]): DependencyAnalysis {
    const totalDependencies = dependencies.length;
    const outdatedDependencies = dependencies.filter(d => d.isOutdated).length;
    const vulnerableDependencies = dependencies.filter(d => d.vulnerabilities.length > 0).length;
    const criticalVulnerabilities = dependencies.reduce((sum, d) => 
      sum + d.vulnerabilities.filter(v => v.severity === 'critical').length, 0
    );

    // Calculate health score
    let healthScore = 100;
    
    if (totalDependencies > 0) {
      const outdatedRatio = outdatedDependencies / totalDependencies;
      const vulnerableRatio = vulnerableDependencies / totalDependencies;
      
      healthScore -= Math.round(outdatedRatio * 30);
      healthScore -= Math.round(vulnerableRatio * 40);
      
      if (criticalVulnerabilities > 0) {
        healthScore -= Math.min(criticalVulnerabilities * 15, 35);
      }
    }

    healthScore = Math.max(0, healthScore);

    // Determine health category
    let dependencyHealth: DependencyAnalysis['dependencyHealth'];
    if (criticalVulnerabilities > 0) {
      dependencyHealth = 'critical';
    } else if (healthScore >= 80) {
      dependencyHealth = 'excellent';
    } else if (healthScore >= 65) {
      dependencyHealth = 'good';
    } else if (healthScore >= 45) {
      dependencyHealth = 'fair';
    } else {
      dependencyHealth = 'poor';
    }

    // Generate Java-specific recommendations
    const recommendations = this.generateJavaRecommendations(
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
   * Generate Java-specific recommendations
   */
  private generateJavaRecommendations(
    dependencies: DependencyInfo[],
    outdatedCount: number,
    vulnerableCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(`🚨 URGENT: ${criticalCount} critical vulnerabilities in Java dependencies`);
    }

    if (vulnerableCount > 0) {
      recommendations.push(`⚠️ ${vulnerableCount} Java dependencies have known vulnerabilities`);
    }

    if (outdatedCount > 0) {
      const percentage = Math.round((outdatedCount / dependencies.length) * 100);
      recommendations.push(`📦 ${percentage}% of Java dependencies are outdated (${outdatedCount}/${dependencies.length})`);
    }

    // Java-specific recommendations
    if (dependencies.some(d => d.name.includes('spring') && d.isOutdated)) {
      recommendations.push('🌱 Spring Framework dependencies are outdated - update for security patches');
    }

    if (dependencies.some(d => d.name.includes('jackson') && d.vulnerabilities.length > 0)) {
      recommendations.push('📄 Jackson JSON library has vulnerabilities - critical for data security');
    }

    if (dependencies.some(d => d.name.includes('log4j') && d.vulnerabilities.length > 0)) {
      recommendations.push('📋 Log4j has vulnerabilities - extremely critical security issue');
    }

    if (dependencies.length > 50) {
      recommendations.push('📊 Large number of Java dependencies - consider dependency management and exclusions');
    }

    if (outdatedCount === 0 && vulnerableCount === 0) {
      recommendations.push('✅ All Java dependencies are up-to-date and secure');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private isVersionOutdated(current: string, latest: string): boolean {
    // Handle Maven version comparison
    const currentParts = current.split('.').map(part => {
      const num = parseInt(part);
      return isNaN(num) ? 0 : num;
    });
    const latestParts = latest.split('.').map(part => {
      const num = parseInt(part);
      return isNaN(num) ? 0 : num;
    });
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;
      
      if (currentPart < latestPart) return true;
      if (currentPart > latestPart) return false;
    }
    
    return false;
  }

  private isVersionVulnerable(version: string, vulnerableRange: string): boolean {
    // Simplified vulnerability check for Java
    // In production, use proper Maven version range parsing
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
        case 'critical': score -= 40; break;
        case 'high': score -= 25; break;
        case 'moderate': score -= 15; break;
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
