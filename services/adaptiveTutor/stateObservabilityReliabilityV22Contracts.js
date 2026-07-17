import path from 'node:path';

import { hashCanonicalJson, hashFile } from '../experimentRunArtifacts.js';

function aggregateFileHash(paths, repoRoot) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({
      path: file,
      sha256: hashFile(path.resolve(repoRoot, file)),
    })),
  );
}

export function adaptiveStateObservabilityReliabilityV22StaticExecutionContract({
  benchmarkConfig,
  benchmarkConfigPath,
  reliabilityConfig,
  reliabilityConfigPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!benchmarkConfig || !benchmarkConfigPath || !reliabilityConfig || !reliabilityConfigPath) {
    throw new Error('stateObservabilityReliabilityV22Contracts: both configs and paths are required');
  }
  return {
    runner: aggregateFileHash(
      [
        'scripts/execute-adaptive-state-observability-reliability-v22.js',
        'services/adaptiveTutor/stateObservabilityReliabilityV22.js',
        'services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js',
        'services/adaptiveTutor/stateObservabilityReliabilityV22Contracts.js',
        'services/adaptiveTutor/stateObservabilityPreflight.js',
        'services/adaptiveTutor/stateBenchmarkStage1Executor.js',
        'services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js',
        'services/adaptiveTutor/stateBenchmarkCliRealizer.js',
        'services/adaptiveTutor/stateBenchmarkPublicSurface.js',
        'services/adaptiveTutor/stateBenchmarkStage1Contracts.js',
        'services/cliProviderBridge.js',
        'services/evalConfigLoader.js',
      ],
      repoRoot,
    ),
    analyzer: aggregateFileHash(
      [
        'services/tutorStubPublicLearnerAnalysis.js',
        'services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js',
        'services/adaptiveTutor/stateBenchmarkPublicSurface.js',
      ],
      repoRoot,
    ),
    policy: hashCanonicalJson({
      stage: 's1_observability_reliability_gate',
      draw_blocks: reliabilityConfig.design.draw_blocks,
      cases: reliabilityConfig.design.total_cases,
      pass_contract: reliabilityConfig.pass_contract,
      execution_contract: reliabilityConfig.execution_contract,
    }),
    profile: hashCanonicalJson({
      claim_eligible: false,
      no_memory: true,
      no_register: true,
      providers_yaml_sha256: hashFile(path.resolve(repoRoot, 'config/providers.yaml')),
    }),
    prompt: hashCanonicalJson({
      realizer: benchmarkConfig.realizer_contract,
      analyzer: benchmarkConfig.paid_execution_contract.public_turn_analyzer,
    }),
    world: aggregateFileHash(
      benchmarkConfig.critical_path.worlds.map((row) => row.source),
      repoRoot,
    ),
    config: hashCanonicalJson({
      benchmark: hashFile(path.resolve(benchmarkConfigPath)),
      reliability: hashFile(path.resolve(reliabilityConfigPath)),
    }),
    benchmark_config: hashFile(path.resolve(benchmarkConfigPath)),
    reliability_config: hashFile(path.resolve(reliabilityConfigPath)),
  };
}
