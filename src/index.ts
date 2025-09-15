import { KravenHunter } from './kraven';

export { KravenHunter } from './kraven';
export { GitHubService } from './services/github';
export { RepositoryAnalyzer } from './services/analyzer';
export { DependencyAnalyzer } from './services/dependency-analyzer';
export { ForkAnalyzer } from './services/fork-analyzer';
export { MLTrainer } from './services/ml-trainer';
export { MLPredictor } from './services/ml-predictor';
export * from './types';

// Re-export for convenience
export default KravenHunter;
