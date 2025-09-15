import { DependencyInfo, Vulnerability, DependencyAnalysis } from '../../types';
import axios from 'axios';

export interface PythonPackageInfo {
  name: string;
  version: string;
  summary?: string;
  author?: string;
  license?: string;
  requires_dist?: string[];
  home_page?: string;
  download_url?: string;
  classifiers?: string[];
}

export interface PyPIPackageData {
  info: PythonPackageInfo;
  releases: { [version: string]: any[] };
  vulnerabilities?: any[];
}

export class PythonAnalyzer {
  private pypiUrl = 'https://pypi.org/pypi';
  private osvUrl = 'https://osv.dev/v1/query';

  /**
   * Analyze Python dependencies from various file formats
   */
  async analyzePythonDependencies(fileContent: string, fileType: string): Promise<DependencyAnalysis> {
    let dependencies: DependencyInfo[] = [];

    switch (fileType) {
      case 'requirements.txt':
        dependencies = await this.parseRequirementsTxt(fileContent);
        break;
      case 'setup.py':
        dependencies = await this.parseSetupPy(fileContent);
        break;
      case 'pyproject.toml':
        dependencies = await this.parsePyprojectToml(fileContent);
        break;
      case 'Pipfile':
        dependencies = await this.parsePipfile(fileContent);
        break;
      default:
        throw new Error(`Unsupported Python dependency file type: ${fileType}`);
    }

    return this.calculateDependencyHealth(dependencies);
  }

  /**
   * Parse requirements.txt format
   */
  private async parseRequirementsTxt(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const lines = content.split('\n').filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.trim().startsWith('-')
    );

    for (const line of lines) {
      const dependency = await this.parseRequirementLine(line.trim());
      if (dependency) {
        dependencies.push(dependency);
      }
    }

    return dependencies;
  }

  /**
   * Parse a single requirement line
   */
  private async parseRequirementLine(line: string): Promise<DependencyInfo | null> {
    // Handle various requirement formats:
    // package==1.0.0
    // package>=1.0.0
    // package~=1.0.0
    // package[extra]==1.0.0
    // git+https://github.com/user/repo.git
    
    if (line.includes('git+') || line.includes('http')) {
      return null; // Skip VCS dependencies for now
    }

    // Extract package name and version
    const match = line.match(/^([a-zA-Z0-9\-_.]+)(?:\[.*?\])?(?:[><=~!]+(.+?))?(?:\s|$)/);
    if (!match) return null;

    const packageName = match[1];
    const versionSpec = match[2] || 'latest';

    return await this.analyzePythonPackage(packageName, versionSpec);
  }

  /**
   * Parse setup.py (simplified)
   */
  private async parseSetupPy(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    // Extract install_requires and setup_requires
    const installRequires = this.extractSetupPyDependencies(content, 'install_requires');
    const setupRequires = this.extractSetupPyDependencies(content, 'setup_requires');
    
    const allRequires = [...installRequires, ...setupRequires];
    
    for (const req of allRequires) {
      const dependency = await this.parseRequirementLine(req);
      if (dependency) {
        dependencies.push(dependency);
      }
    }

    return dependencies;
  }

  /**
   * Parse pyproject.toml (simplified)
   */
  private async parsePyprojectToml(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    try {
      // Simple TOML parsing for dependencies section
      const dependenciesMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
      if (dependenciesMatch) {
        const depsSection = dependenciesMatch[1];
        const lines = depsSection.split('\n').filter(line => 
          line.includes('=') && !line.trim().startsWith('#')
        );
        
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9\-_.]+)\s*=\s*"([^"]+)"/);
          if (match) {
            const packageName = match[1];
            const version = match[2];
            
            if (packageName !== 'python') { // Skip Python version spec
              const dependency = await this.analyzePythonPackage(packageName, version);
              if (dependency) {
                dependencies.push(dependency);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse pyproject.toml:', error);
    }

    return dependencies;
  }

  /**
   * Parse Pipfile (simplified)
   */
  private async parsePipfile(content: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    try {
      // Simple parsing for [packages] section
      const packagesMatch = content.match(/\[packages\]([\s\S]*?)(?:\[|$)/);
      if (packagesMatch) {
        const packagesSection = packagesMatch[1];
        const lines = packagesSection.split('\n').filter(line => 
          line.includes('=') && !line.trim().startsWith('#')
        );
        
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9\-_.]+)\s*=\s*"([^"]+)"/);
          if (match) {
            const packageName = match[1];
            const version = match[2];
            
            const dependency = await this.analyzePythonPackage(packageName, version);
            if (dependency) {
              dependencies.push(dependency);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse Pipfile:', error);
    }

    return dependencies;
  }

  /**
   * Analyze a single Python package
   */
  private async analyzePythonPackage(packageName: string, versionSpec: string): Promise<DependencyInfo | null> {
    try {
      // Get package info from PyPI
      const packageInfo = await this.getPyPIPackageInfo(packageName);
      if (!packageInfo) return null;

      const latestVersion = Object.keys(packageInfo.releases).sort().pop();
      const currentVersion = this.extractVersionFromSpec(versionSpec);
      const isOutdated = latestVersion ? this.isVersionOutdated(currentVersion, latestVersion) : false;
      
      // Check for vulnerabilities
      const vulnerabilities = await this.checkPythonVulnerabilities(packageName, currentVersion);
      
      // Calculate security score
      const securityScore = this.calculateSecurityScore(vulnerabilities);

      return {
        name: packageName,
        currentVersion,
        latestVersion,
        isOutdated,
        vulnerabilities,
        securityScore,
        type: 'dependency'
      };
      
    } catch (error) {
      console.warn(`Failed to analyze Python package ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Get package information from PyPI
   */
  private async getPyPIPackageInfo(packageName: string): Promise<PyPIPackageData | null> {
    try {
      const response = await axios.get(`${this.pypiUrl}/${packageName}/json`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for Python vulnerabilities using OSV.dev
   */
  private async checkPythonVulnerabilities(packageName: string, version: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      const response = await axios.post(this.osvUrl, {
        package: {
          name: packageName,
          ecosystem: 'PyPI'
        },
        version
      }, {
        timeout: 5000
      });

      if (response.data.vulns) {
        response.data.vulns.forEach((vuln: any) => {
          vulnerabilities.push({
            severity: this.mapSeverity(vuln.database_specific?.severity || 'moderate'),
            title: vuln.summary || vuln.id,
            description: vuln.details || vuln.summary || 'No description available',
            patchedVersions: vuln.affected?.[0]?.ranges?.[0]?.events?.find((e: any) => e.fixed)?.fixed,
            vulnerableVersions: vuln.affected?.[0]?.versions?.join(', ') || version,
            source: 'github'
          });
        });
      }
    } catch (error) {
      // Silently fail - vulnerability checking is best effort
    }

    return vulnerabilities;
  }

  /**
   * Extract dependencies from setup.py
   */
  private extractSetupPyDependencies(content: string, field: string): string[] {
    const dependencies: string[] = [];
    
    try {
      // Look for install_requires or setup_requires
      const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, 's');
      const match = content.match(regex);
      
      if (match) {
        const depsString = match[1];
        // Extract quoted strings
        const depMatches = depsString.match(/"([^"]+)"|'([^']+)'/g);
        
        if (depMatches) {
          depMatches.forEach(dep => {
            const cleanDep = dep.replace(/['"]/g, '').trim();
            if (cleanDep) {
              dependencies.push(cleanDep);
            }
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to extract ${field} from setup.py:`, error);
    }

    return dependencies;
  }

  /**
   * Calculate overall dependency health for Python
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
        healthScore -= Math.min(criticalVulnerabilities * 10, 30);
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
    const recommendations = this.generatePythonRecommendations(
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
   * Generate Python-specific recommendations
   */
  private generatePythonRecommendations(
    dependencies: DependencyInfo[],
    outdatedCount: number,
    vulnerableCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(`🚨 URGENT: ${criticalCount} critical security vulnerabilities in Python packages`);
    }

    if (vulnerableCount > 0) {
      recommendations.push(`⚠️ ${vulnerableCount} Python packages have known vulnerabilities`);
    }

    if (outdatedCount > 0) {
      const percentage = Math.round((outdatedCount / dependencies.length) * 100);
      recommendations.push(`📦 ${percentage}% of Python packages are outdated (${outdatedCount}/${dependencies.length})`);
    }

    if (dependencies.length > 50) {
      recommendations.push('📊 Large number of Python dependencies - consider virtual environments');
    }

    // Python-specific recommendations
    if (dependencies.some(d => d.name === 'django' && d.isOutdated)) {
      recommendations.push('🌐 Django framework is outdated - check for security updates');
    }

    if (dependencies.some(d => d.name === 'flask' && d.isOutdated)) {
      recommendations.push('🍶 Flask framework is outdated - update for security fixes');
    }

    if (dependencies.some(d => d.name === 'requests' && d.vulnerabilities.length > 0)) {
      recommendations.push('🌐 Requests library has vulnerabilities - critical for web security');
    }

    if (outdatedCount === 0 && vulnerableCount === 0) {
      recommendations.push('✅ All Python packages are up-to-date and secure');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private extractVersionFromSpec(versionSpec: string): string {
    // Extract actual version from specs like ">=1.0.0", "==1.2.3", "~=1.0"
    const match = versionSpec.match(/[\d.]+/);
    return match ? match[0] : versionSpec;
  }

  private isVersionOutdated(current: string, latest: string): boolean {
    // Simplified version comparison for Python
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

  private mapSeverity(severity: string): Vulnerability['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical': case 'high': return 'critical';
      case 'important': case 'moderate': case 'medium': return 'high';
      case 'low': case 'minor': return 'moderate';
      default: return 'low';
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
}
