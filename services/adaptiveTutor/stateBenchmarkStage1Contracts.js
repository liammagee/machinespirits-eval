import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { hashCanonicalJson, hashFile } from '../experimentRunArtifacts.js';
import { adaptiveStateLearnerKernel } from './learnerKernels/index.js';

const S1_RUNNER = 'scripts/execute-adaptive-state-benchmark-v2-s1.js';

function aggregateFileHash(paths, repoRoot) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({
      path: file,
      sha256: hashFile(path.resolve(repoRoot, file)),
    })),
  );
}

/**
 * Freeze the exact source/config surface that a passing observability preflight
 * is allowed to authorize for a later full S1 retry.
 */
export function adaptiveStateStage1StaticExecutionContract({
  config,
  configPath,
  repoRoot = path.resolve('.'),
} = {}) {
  if (!config || !configPath) {
    throw new Error('stateBenchmarkStage1Contracts: config and configPath are required');
  }
  return {
    hashes: {
      runner: aggregateFileHash(
        [
          S1_RUNNER,
          'services/adaptiveTutor/stateBenchmarkStage1Contracts.js',
          'services/adaptiveTutor/stateObservabilityPreflight.js',
          'services/adaptiveTutor/stateObservabilityPreflightLineage.js',
          'services/adaptiveTutor/stateObservabilityPreflightContracts.js',
          'services/adaptiveTutor/stateObservabilityReliabilityV22.js',
          'services/adaptiveTutor/stateObservabilityReliabilityV22Lineage.js',
          'services/adaptiveTutor/stateObservabilityReliabilityV22Contracts.js',
          'services/adaptiveTutor/stateBenchmarkStage1Executor.js',
          'services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js',
          'services/adaptiveTutor/stateBenchmarkCliRealizer.js',
          'services/adaptiveTutor/stateBenchmarkPublicSurface.js',
          'services/cliProviderBridge.js',
          'services/evalConfigLoader.js',
          'services/adaptiveTutor/stateBenchmarkV2.js',
        ],
        repoRoot,
      ),
      analyzer: aggregateFileHash(
        [
          'services/adaptiveTutor/stateBenchmarkStage1Analysis.js',
          'services/adaptiveTutor/stateBenchmarkStage0Analysis.js',
          'services/adaptiveTutor/stateBenchmarkPublicSurface.js',
          'services/tutorStubPublicLearnerAnalysis.js',
          'services/adaptiveTutor/tutorStubStateAdapter.js',
          'services/tutorStubFieldTrajectory.js',
        ],
        repoRoot,
      ),
      policy: aggregateFileHash(
        config.critical_path.latent_generators.flatMap(
          (row) => adaptiveStateLearnerKernel(row.id).metadata.source_files,
        ),
        repoRoot,
      ),
      profile: hashCanonicalJson({
        complexity_cap: config.complexity_cap,
        providers_yaml_sha256: hashFile(path.resolve(repoRoot, 'config/providers.yaml')),
        observability_reliability_v22_config_sha256: hashFile(
          path.resolve(repoRoot, 'config/adaptive-state-observability-reliability-v2.2.yaml'),
        ),
        eval_config_loader_sha256: hashFile(path.resolve(repoRoot, 'services/evalConfigLoader.js')),
      }),
      prompt: hashCanonicalJson({
        realizer: config.realizer_contract,
        analyzer: config.paid_execution_contract.public_turn_analyzer,
      }),
      world: aggregateFileHash(config.critical_path.worlds.map((row) => row.source), repoRoot),
      config: hashFile(path.resolve(configPath)),
    },
    call_contract: {
      scored_cli_dispatches: 336,
      excluded_technical_canary_cli_dispatches: 3,
      execution_order: 'serial_dialogues_and_turns',
      semantic_rerolls: 0,
      backend_request_count: 'unknown',
    },
  };
}

export function cliFingerprint(command, { repoRoot = path.resolve('.') } = {}) {
  let version;
  try {
    version = execFileSync(command, ['--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
  } catch (error) {
    throw new Error(`Cannot freeze ${command} CLI version: ${error.message}`);
  }
  const executable = execFileSync('/usr/bin/which', [command], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
  return {
    version,
    executable_realpath: fs.realpathSync(executable),
  };
}
