import { GitHubService } from './github';
import { DependencyAnalysis } from '../types';
import { PythonAnalyzer } from './language-analyzers/python-analyzer';
import { RustAnalyzer } from './language-analyzers/rust-analyzer';
import { GoAnalyzer } from './language-analyzers/go-analyzer';
import { JavaAnalyzer } from './language-analyzers/java-analyzer';
import axios from 'axios';

export interface LanguageSupport {
  language: string;
  dependencyFiles: string[];
  analyzer: any;
  enabled: boolean;
}

export interface MultiLanguageAnalysis {
  detectedLanguages: string[];
  primaryLanguage: string;
  dependencyFiles: { [language: string]: string[] };
  analyses: { [language: string]: DependencyAnalysis };
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  overallScore: number;
  recommendations: string[];
  crossLanguageInsights: string[];
}

export class MultiLanguageAnalyzer {
  private languageSupport: Map<string, LanguageSupport> = new Map();

  constructor(private githubService: GitHubService) {
    this.initializeLanguageSupport();
  }

  /**
   * Initialize supported languages and their analyzers
   */
  private initializeLanguageSupport(): void {
    // JavaScript/TypeScript (existing npm analyzer)
    this.languageSupport.set('javascript', {
      language: 'javascript',
      dependencyFiles: ['package.json', 'package-lock.json', 'yarn.lock'],
      analyzer: null, // Will use existing DependencyAnalyzer
      enabled: true
    });

    this.languageSupport.set('typescript', {
      language: 'typescript',
      dependencyFiles: ['package.json', 'package-lock.json', 'yarn.lock'],
      analyzer: null, // Will use existing DependencyAnalyzer
      enabled: true
    });

    // Python
    this.languageSupport.set('python', {
      language: 'python',
      dependencyFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'Pipfile.lock'],
      analyzer: new PythonAnalyzer(),
      enabled: true
    });

    // Rust
    this.languageSupport.set('rust', {
      language: 'rust',
      dependencyFiles: ['Cargo.toml', 'Cargo.lock'],
      analyzer: new RustAnalyzer(),
      enabled: true
    });

    // Go
    this.languageSupport.set('go', {
      language: 'go',
      dependencyFiles: ['go.mod', 'go.sum'],
      analyzer: new GoAnalyzer(),
      enabled: true
    });

    // Java
    this.languageSupport.set('java', {
      language: 'java',
      dependencyFiles: ['pom.xml', 'build.gradle', 'gradle.properties', 'build.gradle.kts'],
      analyzer: new JavaAnalyzer(),
      enabled: true
    });
  }

  /**
   * Analyze dependencies for multiple languages in a repository
   */
  async analyzeRepository(owner: string, repo: string): Promise<MultiLanguageAnalysis> {
    try {
      // Detect languages and dependency files
      const detectedLanguages = await this.detectRepositoryLanguages(owner, repo);
      const dependencyFiles = await this.findDependencyFiles(owner, repo);
      
      // Determine primary language
      const primaryLanguage = await this.determinePrimaryLanguage(owner, repo, detectedLanguages);
      
      // Analyze dependencies for each detected language
      const analyses: { [language: string]: DependencyAnalysis } = {};
      
      for (const [language, files] of Object.entries(dependencyFiles)) {
        if (files.length > 0 && this.languageSupport.has(language)) {
          const analysis = await this.analyzeLanguageDependencies(owner, repo, language, files);
          if (analysis) {
            analyses[language] = analysis;
          }
        }
      }
      
      // Calculate overall health and insights
      const overallHealth = this.calculateOverallHealth(analyses);
      const overallScore = this.calculateOverallScore(analyses);
      const recommendations = this.generateMultiLanguageRecommendations(analyses, detectedLanguages);
      const crossLanguageInsights = this.generateCrossLanguageInsights(analyses, detectedLanguages);
      
      return {
        detectedLanguages,
        primaryLanguage,
        dependencyFiles,
        analyses,
        overallHealth,
        overallScore,
        recommendations,
        crossLanguageInsights
      };
      
    } catch (error) {
      console.warn(`Multi-language analysis failed for ${owner}/${repo}:`, error);
      return this.createEmptyAnalysis();
    }
  }

  /**
   * Detect languages used in repository
   */
  private async detectRepositoryLanguages(owner: string, repo: string): Promise<string[]> {
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-MultiLang/1.0.0'
        }
      });
      
      return Object.keys(response.data).map(lang => lang.toLowerCase());
    } catch (error) {
      return [];
    }
  }

  /**
   * Find dependency files for all supported languages
   */
  private async findDependencyFiles(owner: string, repo: string): Promise<{ [language: string]: string[] }> {
    const dependencyFiles: { [language: string]: string[] } = {};
    
    // Initialize arrays for all languages
    this.languageSupport.forEach((support, language) => {
      dependencyFiles[language] = [];
    });
    
    // Check for each dependency file type
    for (const [language, support] of this.languageSupport) {
      for (const fileName of support.dependencyFiles) {
        try {
          const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Kraven-MultiLang/1.0.0'
            }
          });
          
          if (response.data && response.data.content) {
            dependencyFiles[language].push(fileName);
          }
        } catch (error) {
          // File doesn't exist, continue
        }
        
        // Small delay to avoid rate limiting
        await this.delay(100);
      }
    }
    
    return dependencyFiles;
  }

  /**
   * Determine primary language of repository
   */
  private async determinePrimaryLanguage(owner: string, repo: string, detectedLanguages: string[]): Promise<string> {
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-MultiLang/1.0.0'
        }
      });
      
      // Find language with most bytes
      let maxBytes = 0;
      let primaryLanguage = 'unknown';
      
      Object.entries(response.data).forEach(([language, bytes]) => {
        if (typeof bytes === 'number' && bytes > maxBytes) {
          maxBytes = bytes;
          primaryLanguage = language.toLowerCase();
        }
      });
      
      return primaryLanguage;
    } catch (error) {
      return detectedLanguages[0] || 'unknown';
    }
  }

  /**
   * Analyze dependencies for a specific language
   */
  private async analyzeLanguageDependencies(
    owner: string,
    repo: string,
    language: string,
    files: string[]
  ): Promise<DependencyAnalysis | null> {
    
    const support = this.languageSupport.get(language);
    if (!support || !support.analyzer) {
      return null;
    }
    
    try {
      // Get the first available dependency file
      const primaryFile = files[0];
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${primaryFile}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Kraven-MultiLang/1.0.0'
        }
      });
      
      if (!response.data.content) return null;
      
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      
      // Use language-specific analyzer
      switch (language) {
        case 'python':
          return await support.analyzer.analyzePythonDependencies(content, primaryFile);
        case 'rust':
          return await support.analyzer.analyzeRustDependencies(content);
        case 'go':
          return await support.analyzer.analyzeGoDependencies(content);
        case 'java':
          return await support.analyzer.analyzeJavaDependencies(content, primaryFile);
        default:
          return null;
      }
      
    } catch (error) {
      console.warn(`Failed to analyze ${language} dependencies:`, error);
      return null;
    }
  }

  /**
   * Calculate overall health across all languages
   */
  private calculateOverallHealth(analyses: { [language: string]: DependencyAnalysis }): MultiLanguageAnalysis['overallHealth'] {
    const healthScores = Object.values(analyses).map(analysis => analysis.healthScore);
    
    if (healthScores.length === 0) return 'excellent';
    
    const avgScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
    const hasCritical = Object.values(analyses).some(analysis => analysis.dependencyHealth === 'critical');
    
    if (hasCritical) return 'critical';
    if (avgScore >= 80) return 'excellent';
    if (avgScore >= 65) return 'good';
    if (avgScore >= 45) return 'fair';
    return 'poor';
  }

  /**
   * Calculate overall score across all languages
   */
  private calculateOverallScore(analyses: { [language: string]: DependencyAnalysis }): number {
    const healthScores = Object.values(analyses).map(analysis => analysis.healthScore);
    
    if (healthScores.length === 0) return 100;
    
    return Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length);
  }

  /**
   * Generate multi-language recommendations
   */
  private generateMultiLanguageRecommendations(
    analyses: { [language: string]: DependencyAnalysis },
    detectedLanguages: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    const totalLanguages = Object.keys(analyses).length;
    const criticalLanguages = Object.entries(analyses).filter(([_, analysis]) => 
      analysis.dependencyHealth === 'critical'
    );
    
    if (criticalLanguages.length > 0) {
      recommendations.push(`🚨 CRITICAL: ${criticalLanguages.length} language(s) have critical vulnerabilities`);
      criticalLanguages.forEach(([lang, _]) => {
        recommendations.push(`  - ${lang.charAt(0).toUpperCase() + lang.slice(1)} ecosystem needs immediate attention`);
      });
    }
    
    if (totalLanguages > 1) {
      recommendations.push(`🌍 Multi-language project detected (${totalLanguages} languages) - coordinate updates carefully`);
    }
    
    // Language-specific insights
    if (analyses.python && analyses.javascript) {
      recommendations.push('🔗 Python + JavaScript project - ensure consistent security practices across both ecosystems');
    }
    
    if (analyses.rust && (analyses.javascript || analyses.python)) {
      recommendations.push('⚡ Rust + high-level language - excellent performance + productivity combination');
    }
    
    if (analyses.java && analyses.go) {
      recommendations.push('☕ Java + Go - consider migration opportunities for better performance');
    }
    
    return recommendations;
  }

  /**
   * Generate cross-language insights
   */
  private generateCrossLanguageInsights(
    analyses: { [language: string]: DependencyAnalysis },
    detectedLanguages: string[]
  ): string[] {
    const insights: string[] = [];
    
    const languageHealthScores = Object.entries(analyses).map(([lang, analysis]) => ({
      language: lang,
      score: analysis.healthScore
    }));
    
    // Find best and worst language ecosystems
    languageHealthScores.sort((a, b) => b.score - a.score);
    
    if (languageHealthScores.length > 1) {
      const best = languageHealthScores[0];
      const worst = languageHealthScores[languageHealthScores.length - 1];
      
      if (best.score - worst.score > 30) {
        insights.push(`${best.language} ecosystem is much healthier (${best.score}) than ${worst.language} (${worst.score})`);
      }
    }
    
    // Polyglot project insights
    if (detectedLanguages.length > 2) {
      insights.push(`Polyglot project with ${detectedLanguages.length} languages - complexity may impact maintainability`);
    }
    
    // Technology stack insights
    if (detectedLanguages.includes('rust') && detectedLanguages.includes('javascript')) {
      insights.push('Modern tech stack: Rust for performance + JavaScript for flexibility');
    }
    
    if (detectedLanguages.includes('python') && detectedLanguages.includes('javascript')) {
      insights.push('Full-stack project: Python backend + JavaScript frontend likely');
    }
    
    return insights;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.languageSupport.keys());
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.languageSupport.has(language.toLowerCase());
  }

  /**
   * Get dependency file types for a language
   */
  getDependencyFiles(language: string): string[] {
    const support = this.languageSupport.get(language.toLowerCase());
    return support ? support.dependencyFiles : [];
  }

  /**
   * Helper methods
   */
  private createEmptyAnalysis(): MultiLanguageAnalysis {
    return {
      detectedLanguages: [],
      primaryLanguage: 'unknown',
      dependencyFiles: {},
      analyses: {},
      overallHealth: 'excellent',
      overallScore: 100,
      recommendations: ['No dependency files found'],
      crossLanguageInsights: []
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
