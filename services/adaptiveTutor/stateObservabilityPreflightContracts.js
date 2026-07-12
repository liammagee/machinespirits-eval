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

export function adaptiveStateObservabilityPreflightStaticExecutionContract({
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!config || !configPath) {
    throw new Error('stateObservabilityPreflightContracts: config and configPath are required');
  }
  return {
    runner: aggregateFileHash(
      [
        'scripts/execute-adaptive-state-observability-preflight-v2.js',
        'services/adaptiveTutor/stateObservabilityPreflight.js',
        'services/adaptiveTutor/stateObservabilityPreflightLineage.js',
        'services/adaptiveTutor/stateObservabilityPreflightContracts.js',
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
      stage: 's1_observability_preflight',
      families: ['none', 'adopt', 'derive', 'retract'],
      pass: '24_of_24_exact_family_recovery',
    }),
    profile: hashCanonicalJson({
      claim_eligible: false,
      no_memory: true,
      no_register: true,
      providers_yaml_sha256: hashFile(path.resolve(repoRoot, 'config/providers.yaml')),
    }),
    prompt: hashCanonicalJson({
      realizer: config.realizer_contract,
      analyzer: config.paid_execution_contract.public_turn_analyzer,
    }),
    world: aggregateFileHash(config.critical_path.worlds.map((row) => row.source), repoRoot),
    config: hashFile(path.resolve(configPath)),
  };
}
