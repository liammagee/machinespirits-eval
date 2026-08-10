/**
 * Integrity primitives for the adaptive-warrant mechanism study.
 *
 * This module deliberately has no dependency on the study CLI. It gives the
 * runner, resume path, freeze path, and annotation scorer one small set of
 * pure contracts to share without importing a side-effectful command module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import {
  EXPERIMENT_RUN_PLAN_FILE,
  EXPERIMENT_RUN_SEAL_FILE,
  hashCanonicalJson,
  hashFile,
  verifyExperimentRun,
} from './experimentRunArtifacts.js';

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ADAPTIVE_WARRANT_STUDY_PLAN_IDENTITY_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-study-plan-identity.v1';
export const ADAPTIVE_WARRANT_STUDY_ENVIRONMENT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-study-environment.v1';
export const ADAPTIVE_WARRANT_STUDY_CLI_CONTRACT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-study-cli-contract.v2';
export const ADAPTIVE_WARRANT_STUDY_CLI_GUARD_ENV_KEY =
  'MACHINESPIRITS_ADAPTIVE_WARRANT_STUDY_CLI_CONTRACT_BASE64';
export const ADAPTIVE_WARRANT_STUDY_DOTENV_FILE = 'config/adaptive-warrant-study.env';
export const ADAPTIVE_WARRANT_STABLE_DECISION_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-stable-decision.v1';
export const ADAPTIVE_WARRANT_STABLE_DECISION_COMPARISON_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-stable-decision-comparison.v1';
export const ADAPTIVE_WARRANT_CHILD_EVIDENCE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-child-evidence-verification.v1';

const PLAN_CONFIG_VOLATILE_KEYS = new Set(['dryRun']);
const PLAN_TOP_LEVEL_VOLATILE_KEYS = new Set(['createdAt', 'studyId', 'launchAuthorization']);

/**
 * Environment variables whose values can silently change the tutor, prompts,
 * policy overlays, learner, reasoning settings, or the required Codex auth
 * route despite an unchanged CLI command. Unrelated provider credentials are
 * intentionally preserved; OpenAI/Codex API-route variables are not.
 */
export const ADAPTIVE_WARRANT_STUDY_STRIPPED_ENV_KEYS = Object.freeze([
  'CLAUDE_CODE_EFFORT',
  'CLAUDE_EFFORT',
  'CLI_PROVIDER_CODEX_EFFORT',
  'CLI_PROVIDER_CLAUDE_EFFORT',
  'CLI_PROVIDER_EFFORT',
  'CODEX_API_KEY',
  'CODEX_REASONING_EFFORT',
  'DOTENV_CONFIG_OVERRIDE',
  'DOTENV_CONFIG_PATH',
  'EVAL_CONTENT_PATH',
  'EVAL_SCENARIOS_FILE',
  'LEARNER_AGENT_PROFILE',
  'LEARNER_PROFILE',
  'NODE_OPTIONS',
  'NODE_PATH',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_ORGANIZATION',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
]);

const ADAPTIVE_WARRANT_FORBIDDEN_CODEX_API_ROUTE_KEYS = Object.freeze([
  'CODEX_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
]);
const CODEX_PLATFORM_PACKAGE_BY_TARGET = Object.freeze({
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
});
const ADAPTIVE_WARRANT_STUDY_DOTENV_ABSOLUTE = path.resolve(MODULE_ROOT, ADAPTIVE_WARRANT_STUDY_DOTENV_FILE);

/**
 * These values are repeated in the environment so `dotenv/config` in the
 * grandchild tutor process cannot re-enable a local experimental seam. Values
 * that vary by study cell (world, models, learner profile, seed, gate mode)
 * remain absent here and must come from the frozen command.
 */
export const ADAPTIVE_WARRANT_STUDY_ENV_OVERRIDES = Object.freeze({
  DOTENV_CONFIG_PATH: ADAPTIVE_WARRANT_STUDY_DOTENV_ABSOLUTE,
  TUTOR_STUB_ALL_MODELS: '',
  TUTOR_STUB_ARTIFACT_ARCHIVE: 'off',
  TUTOR_STUB_DAG_FACT_DROPOUT: '0',
  TUTOR_STUB_FIELD_VIZ: '0',
  TUTOR_STUB_HUMAN_SUBJECT_CLASS: 'owner_operator',
  TUTOR_STUB_INTERIM_ANIMATION: '0',
  TUTOR_STUB_LEARNER_ANALYSIS_EVIDENCE_USE_RUBRIC: 'v2_bridge_voiced',
  TUTOR_STUB_LIGHT_ADAPTATION: '0',
  TUTOR_STUB_MEMORY_SUMMARY: '1',
  TUTOR_STUB_MIXED_LEARNER: '0',
  TUTOR_STUB_MIXED_TUTOR_PREFETCH_POLICY: 'always',
  TUTOR_STUB_MULTIPLE_CHOICE: '0',
  TUTOR_STUB_OPENING: '1',
  TUTOR_STUB_OPENING_REALIZER: 'model',
  TUTOR_STUB_POINT_OF_ACTION_ARM: '',
  TUTOR_STUB_POINT_OF_ACTION_OPPORTUNITY_PROTOCOL: 'off',
  TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR: 'off',
  TUTOR_STUB_REGISTER_POLICY: 'dynamic',
  TUTOR_STUB_RELEASE_SPEED: '1',
  TUTOR_STUB_SPEAKER_ADVISORY_BLOCKS: '',
  TUTOR_STUB_STREAM: '0',
  TUTOR_STUB_TRAINING_REUSE: 'on',
  TUTOR_STUB_TUNING: 'off',
  TUTOR_STUB_TUTOR: 'dramatic-detective',
  TUTOR_STUB_TYPED_ACTIONS: '0',
});

const STABLE_WARRANT_DECISION_FIELDS = Object.freeze([
  'schema',
  'mode',
  'turn',
  'strategy_in_force',
  'prior_delivered_action_family',
  'pre_gate_proposed_action_family',
  'strategy_since_turn',
  'learner_signal',
  'dag_total',
  'dag_growth',
  'prior_turn_outcome',
  'turns_since_dag_growth',
  'trouble_turns',
  'complaint_turns',
  'deference_sustained',
  'action_contract',
  'public_obligation',
  'public_obligation_before',
  'inquiry_completion',
  'bounded_inquiry_scope',
  'input_snapshot',
  'input_digest',
  'divergence',
  'decision_kind',
  'revision_warranted',
  'commitment_transition_warranted',
  'current_candidate_override_required',
  'register_revision_warranted',
  'warrant_basis',
  'policy',
  'obligation_directive',
  'override',
]);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function cloneJson(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function assertEmptyAdaptiveWarrantStudyDotenv(filePath = ADAPTIVE_WARRANT_STUDY_DOTENV_ABSOLUTE) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`adaptive-warrant study dotenv source not found: ${absolute}`);
  }
  const activeLines = fs
    .readFileSync(absolute, 'utf8')
    .split(/\r?\n/u)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'));
  if (activeLines.length) {
    throw new Error(
      `adaptive-warrant study dotenv source must contain no assignments; active lines: ${activeLines
        .map(({ number }) => number)
        .join(', ')}`,
    );
  }
  return {
    absolute,
    relative: normalizeWorkspacePath(absolute, MODULE_ROOT),
    sha256: hashFile(absolute),
    active_line_count: 0,
  };
}

function posixPath(value) {
  return String(value).split(path.sep).join('/');
}

function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeWorkspacePath(value, workspaceRoot) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !workspaceRoot || !isWithin(workspaceRoot, value)) {
    return value;
  }
  return `{workspace}/${posixPath(path.relative(workspaceRoot, value))}`;
}

function normalizePlanValue(value, { workspaceRoot, studyRoot } = {}) {
  if (Array.isArray(value)) return value.map((row) => normalizePlanValue(row, { workspaceRoot, studyRoot }));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, row]) => [key, normalizePlanValue(row, { workspaceRoot, studyRoot })]),
    );
  }
  if (typeof value !== 'string' || !path.isAbsolute(value)) return value;
  if (studyRoot && isWithin(studyRoot, value)) {
    return `{study_root}/${posixPath(path.relative(studyRoot, value))}`;
  }
  return normalizeWorkspacePath(value, workspaceRoot);
}

function inferStudyRoot(jobs) {
  const roots = (jobs || [])
    .map((job) => job?.jobDir)
    .filter((jobDir) => typeof jobDir === 'string' && jobDir.trim())
    .map((jobDir) => path.dirname(path.dirname(path.resolve(jobDir))));
  if (!roots.length) return null;
  return roots.every((root) => root === roots[0]) ? roots[0] : null;
}

function normalizedJobCommand(job, plan, { workspaceRoot, studyRoot, ignoreDryRun }) {
  const command = Array.isArray(job?.command) ? [...job.command] : [];
  const normalized = [];
  for (let index = 0; index < command.length; index += 1) {
    const token = String(command[index]);
    if (ignoreDryRun && token === '--dry-run') continue;
    if (token === '--trace-dir' && index + 1 < command.length) {
      normalized.push(token, '{job_dir}');
      index += 1;
      continue;
    }
    if (token === '--parent-run-id' && index + 1 < command.length) {
      normalized.push(token, '{study_id}');
      index += 1;
      continue;
    }
    if (job?.jobDir && path.isAbsolute(token) && isWithin(job.jobDir, token)) {
      normalized.push(`{job_dir}/${posixPath(path.relative(job.jobDir, token))}`);
      continue;
    }
    if (token === String(plan?.studyId || '')) {
      normalized.push('{study_id}');
      continue;
    }
    normalized.push(normalizePlanValue(token, { workspaceRoot, studyRoot }));
  }
  return normalized;
}

function canonicalPlanConfig(config, { workspaceRoot, studyRoot, ignoreDryRun }) {
  return Object.fromEntries(
    Object.entries(requireObject(config, 'plan.config'))
      .filter(([key]) => !(ignoreDryRun && PLAN_CONFIG_VOLATILE_KEYS.has(key)))
      .map(([key, value]) => [key, normalizePlanValue(value, { workspaceRoot, studyRoot })]),
  );
}

/**
 * Return the immutable, root-independent execution identity of a study plan.
 * Array order is retained, so changing job order changes the digest. The
 * caller may ignore only the dry/live transport bit when comparing an approved
 * dry-run contract to a live plan; resume validation should keep the default.
 */
export function canonicalAdaptiveWarrantStudyPlan(plan, { workspaceRoot = MODULE_ROOT, ignoreDryRun = false } = {}) {
  requireObject(plan, 'plan');
  if (!Array.isArray(plan.jobs)) throw new Error('plan.jobs must be an array');
  const studyRoot = inferStudyRoot(plan.jobs);
  const stableTopLevel = Object.fromEntries(
    Object.entries(plan)
      .filter(([key]) => !PLAN_TOP_LEVEL_VOLATILE_KEYS.has(key) && !['config', 'jobs', 'provenance'].includes(key))
      .map(([key, value]) => [key, normalizePlanValue(value, { workspaceRoot, studyRoot })]),
  );
  return {
    schema: ADAPTIVE_WARRANT_STUDY_PLAN_IDENTITY_SCHEMA,
    plan: stableTopLevel,
    source_provenance_sha256: plan.provenance?.combinedSha256 || null,
    config: canonicalPlanConfig(plan.config, { workspaceRoot, studyRoot, ignoreDryRun }),
    jobs: plan.jobs.map((job, index) => ({
      ordinal: Number.isFinite(Number(job?.ordinal)) ? Number(job.ordinal) : index + 1,
      id: job?.id || null,
      run_index: job?.runIndex ?? null,
      seed: job?.seed ?? null,
      world: job?.world ?? null,
      profile: job?.profile ?? null,
      condition: job?.condition ?? null,
      warrant_gate_mode: job?.warrantGateMode ?? null,
      horizon: job?.horizon ?? null,
      mechanism_validation: job?.mechanismValidation === true,
      expected_git_sha: job?.expectedGitSha ?? null,
      expected_git_dirty: typeof job?.expectedGitDirty === 'boolean' ? job.expectedGitDirty : null,
      expected_child_policy_sha256: job?.expectedChildPolicySha256 ?? null,
      command: normalizedJobCommand(job, plan, { workspaceRoot, studyRoot, ignoreDryRun }),
    })),
  };
}

export function fingerprintAdaptiveWarrantStudyPlan(plan, options = {}) {
  const canonical = canonicalAdaptiveWarrantStudyPlan(plan, options);
  return {
    schema: ADAPTIVE_WARRANT_STUDY_PLAN_IDENTITY_SCHEMA,
    sha256: hashCanonicalJson(canonical),
    canonical,
  };
}

export function compareAdaptiveWarrantStudyPlans(expected, observed, options = {}) {
  const left = fingerprintAdaptiveWarrantStudyPlan(expected, options);
  const right = fingerprintAdaptiveWarrantStudyPlan(observed, options);
  return {
    schema: ADAPTIVE_WARRANT_STUDY_PLAN_IDENTITY_SCHEMA,
    ok: left.sha256 === right.sha256,
    expected_sha256: left.sha256,
    observed_sha256: right.sha256,
  };
}

/**
 * Build the environment passed to the auto-eval child. All inherited
 * TUTOR_STUB_* settings are removed before the frozen defaults are installed;
 * Node injection hooks and OpenAI/Codex API-route overrides are also removed.
 * HOME and CODEX_HOME survive so the frozen Codex CLI can use its existing
 * ChatGPT-account login. Unrelated provider credentials survive unchanged.
 */
export function buildAdaptiveWarrantStudyEnvironment(baseEnvironment = process.env) {
  requireObject(baseEnvironment, 'baseEnvironment');
  assertEmptyAdaptiveWarrantStudyDotenv();
  const environment = { ...baseEnvironment };
  for (const key of Object.keys(environment)) {
    if (key.startsWith('TUTOR_STUB_') || ADAPTIVE_WARRANT_STUDY_STRIPPED_ENV_KEYS.includes(key)) {
      delete environment[key];
    }
  }
  Object.assign(environment, ADAPTIVE_WARRANT_STUDY_ENV_OVERRIDES);
  return environment;
}

function meaningfulCliOutput(result) {
  const lines = [String(result?.stdout || ''), String(result?.stderr || '')]
    .join('\n')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^WARNING: proceeding, even though we could not create PATH aliases:/u.test(line));
  return lines.join(' ').replace(/\s+/gu, ' ').trim();
}

function resolveExecutablePath(executable, environment) {
  const requested = String(executable || '').trim();
  if (!requested) throw new Error('Codex executable is required');
  const candidates =
    path.isAbsolute(requested) || requested.includes(path.sep)
      ? [path.resolve(requested)]
      : String(environment.PATH || '')
          .split(path.delimiter)
          .filter(Boolean)
          .map((directory) => path.resolve(directory, requested));
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Continue through the frozen PATH without invoking a shell.
    }
  }
  throw new Error(`Codex executable not found on PATH: ${requested}`);
}

function codexTargetTriple(platform = process.platform, arch = process.arch) {
  return (
    {
      'linux:x64': 'x86_64-unknown-linux-musl',
      'android:x64': 'x86_64-unknown-linux-musl',
      'linux:arm64': 'aarch64-unknown-linux-musl',
      'android:arm64': 'aarch64-unknown-linux-musl',
      'darwin:x64': 'x86_64-apple-darwin',
      'darwin:arm64': 'aarch64-apple-darwin',
      'win32:x64': 'x86_64-pc-windows-msvc',
      'win32:arm64': 'aarch64-pc-windows-msvc',
    }[`${platform}:${arch}`] || null
  );
}

function officialCodexPackageForEntrypoint(entrypointRealpath) {
  const binDirectory = path.dirname(entrypointRealpath);
  if (path.basename(binDirectory) !== 'bin') return null;
  const packageRoot = path.dirname(binDirectory);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
  if (packageJson?.name !== '@openai/codex') return null;
  const declaredEntrypoint = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.codex;
  if (!String(declaredEntrypoint || '').trim()) {
    throw new Error(`Official @openai/codex package has no codex bin entry: ${packageJsonPath}`);
  }
  const declaredPath = path.resolve(packageRoot, declaredEntrypoint);
  let declaredRealpath;
  try {
    declaredRealpath = fs.realpathSync(declaredPath);
  } catch {
    throw new Error(`Official @openai/codex bin entry does not exist: ${declaredPath}`);
  }
  if (declaredRealpath !== entrypointRealpath) {
    throw new Error(
      `Invoked Codex entrypoint does not match the official @openai/codex bin entry: ${entrypointRealpath}`,
    );
  }
  return {
    packageRoot,
    packageJsonPath,
    packageVersion: String(packageJson.version || ''),
  };
}

function executableFileFingerprint(resolvedPath, label) {
  let realpath;
  try {
    fs.accessSync(resolvedPath, fs.constants.X_OK);
    if (!fs.statSync(resolvedPath).isFile()) throw new Error('not a file');
    realpath = fs.realpathSync(resolvedPath);
  } catch (error) {
    throw new Error(`${label} is not an executable file: ${resolvedPath} (${error.message})`);
  }
  return {
    resolved_path: resolvedPath,
    realpath,
    sha256: hashFile(realpath),
  };
}

/**
 * Resolve the two-stage official npm launcher exactly as @openai/codex does:
 * bin/codex.js delegates to the target-specific optional package's native
 * vendor binary, falling back to a vendor directory in the main package.
 * Standalone/Homebrew native installations use the direct-executable path.
 */
function fingerprintCodexExecutableChain(resolvedPath) {
  const entrypoint = executableFileFingerprint(resolvedPath, 'Codex entrypoint');
  const officialPackage = officialCodexPackageForEntrypoint(entrypoint.realpath);
  if (!officialPackage) {
    return {
      entrypoint: { ...entrypoint, kind: 'direct_executable' },
      delegated: {
        ...entrypoint,
        resolution: 'direct_executable',
        same_as_entrypoint: true,
        target_triple: null,
        platform_package: null,
      },
    };
  }

  const targetTriple = codexTargetTriple();
  const platformPackage = targetTriple ? CODEX_PLATFORM_PACKAGE_BY_TARGET[targetTriple] : null;
  if (!targetTriple || !platformPackage) {
    throw new Error(`Official @openai/codex wrapper has no native target for ${process.platform}/${process.arch}`);
  }

  let vendorRoot;
  let resolution;
  try {
    const requireFromEntrypoint = createRequire(entrypoint.realpath);
    const platformPackageJson = requireFromEntrypoint.resolve(`${platformPackage}/package.json`);
    vendorRoot = path.join(path.dirname(platformPackageJson), 'vendor');
    resolution = 'official_platform_package';
  } catch {
    vendorRoot = path.join(officialPackage.packageRoot, 'vendor');
    resolution = 'official_package_vendor_fallback';
  }
  const delegatedPath = path.join(
    vendorRoot,
    targetTriple,
    'bin',
    process.platform === 'win32' ? 'codex.exe' : 'codex',
  );
  const delegated = executableFileFingerprint(delegatedPath, 'Delegated native Codex executable');
  return {
    entrypoint: {
      ...entrypoint,
      kind: 'official_node_entrypoint',
      package_name: '@openai/codex',
      package_version: officialPackage.packageVersion,
      package_json_path: officialPackage.packageJsonPath,
      package_json_sha256: hashFile(officialPackage.packageJsonPath),
    },
    delegated: {
      ...delegated,
      resolution,
      same_as_entrypoint: delegated.realpath === entrypoint.realpath,
      target_triple: targetTriple,
      platform_package: platformPackage,
    },
  };
}

function runCliProbe(executable, args, environment, spawn = spawnSync) {
  const result = spawn(executable, args, {
    encoding: 'utf8',
    env: environment,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result?.error) throw new Error(`Codex CLI probe failed: ${result.error.message}`);
  const output = meaningfulCliOutput(result);
  if (result?.status !== 0) {
    throw new Error(`Codex CLI probe ${args.join(' ')} exited ${result?.status ?? 'without status'}: ${output}`);
  }
  return { output, status: result.status };
}

/**
 * Fingerprint the exact local Codex entrypoint and its delegated native binary,
 * then verify the stored login route. Both probes are local CLI metadata
 * operations; neither submits a prompt nor invokes a model. API-key and
 * custom-base-url environments fail before any subprocess is started.
 */
export function collectAdaptiveWarrantStudyCliContract({
  environment = process.env,
  executable = 'codex',
  spawn = spawnSync,
} = {}) {
  requireObject(environment, 'environment');
  const forbiddenRouteKeys = ADAPTIVE_WARRANT_FORBIDDEN_CODEX_API_ROUTE_KEYS.filter((key) =>
    String(environment[key] || '').trim(),
  );
  if (forbiddenRouteKeys.length) {
    throw new Error(
      `Codex ChatGPT-account route rejected API-key/custom-base-url environment: ${forbiddenRouteKeys.join(', ')}`,
    );
  }
  const probeEnvironment = buildAdaptiveWarrantStudyEnvironment(environment);
  const resolvedPath = resolveExecutablePath(executable, probeEnvironment);
  const chainBeforeProbe = fingerprintCodexExecutableChain(resolvedPath);
  const versionProbe = runCliProbe(chainBeforeProbe.entrypoint.realpath, ['--version'], probeEnvironment, spawn);
  const versionMatch = versionProbe.output.match(/\bcodex(?:-cli)?\s+([^\s]+)/iu);
  if (!versionMatch) throw new Error(`Codex CLI version could not be parsed: ${versionProbe.output || '(empty)'}`);
  const authProbe = runCliProbe(chainBeforeProbe.entrypoint.realpath, ['login', 'status'], probeEnvironment, spawn);
  if (!/^Logged in using ChatGPT\b/iu.test(authProbe.output)) {
    throw new Error(`Codex CLI is not authenticated through ChatGPT-account login: ${authProbe.output || '(empty)'}`);
  }
  if (/\b(?:API key|custom base URL)\b/iu.test(authProbe.output)) {
    throw new Error(`Codex CLI reported a forbidden API route: ${authProbe.output}`);
  }
  const chainAfterProbe = fingerprintCodexExecutableChain(resolvedPath);
  if (hashCanonicalJson(chainBeforeProbe) !== hashCanonicalJson(chainAfterProbe)) {
    throw new Error('Codex entrypoint or delegated native executable changed during local CLI probes');
  }
  const contract = {
    schema: ADAPTIVE_WARRANT_STUDY_CLI_CONTRACT_SCHEMA,
    executable: {
      requested: String(executable),
      ...chainAfterProbe.entrypoint,
    },
    delegated_executable: chainAfterProbe.delegated,
    version: versionMatch[1],
    version_output: versionProbe.output,
    auth: {
      probe: ['login', 'status'],
      route: 'chatgpt_account',
      verified: true,
      output: authProbe.output,
    },
    model_calls: 0,
  };
  return { ...contract, sha256: hashCanonicalJson(contract) };
}

function validatedCliContractSha256(cliContract) {
  if (cliContract === null || cliContract === undefined) return null;
  requireObject(cliContract, 'cliContract');
  const sha256Pattern = /^[a-f0-9]{64}$/u;
  if (
    cliContract.schema !== ADAPTIVE_WARRANT_STUDY_CLI_CONTRACT_SCHEMA ||
    cliContract.auth?.route !== 'chatgpt_account' ||
    cliContract.auth?.verified !== true ||
    cliContract.model_calls !== 0 ||
    !sha256Pattern.test(String(cliContract.executable?.sha256 || '')) ||
    !sha256Pattern.test(String(cliContract.delegated_executable?.sha256 || '')) ||
    !String(cliContract.executable?.realpath || '').trim() ||
    !String(cliContract.delegated_executable?.realpath || '').trim()
  ) {
    throw new Error('cliContract is not a verified no-model ChatGPT-account executable-chain contract');
  }
  const payload = { ...cloneJson(cliContract) };
  delete payload.sha256;
  const expected = hashCanonicalJson(payload);
  if (cliContract.sha256 !== expected) throw new Error('cliContract sha256 does not match its contents');
  return expected;
}

/**
 * Carry the already-authorized executable-chain contract into each study
 * child. The value contains paths and hashes only; it is not a credential and
 * is deliberately withheld from the eventual Codex subprocess environment.
 */
export function adaptiveWarrantStudyCliGuardEnvironment(cliContract) {
  if (cliContract === null || cliContract === undefined) return {};
  validatedCliContractSha256(cliContract);
  return {
    [ADAPTIVE_WARRANT_STUDY_CLI_GUARD_ENV_KEY]: Buffer.from(JSON.stringify(cliContract), 'utf8').toString('base64'),
  };
}

/**
 * Re-hash the invoked wrapper, delegated native executable, and official
 * package metadata immediately before an adaptive-warrant Codex call. This
 * closes the longer parent-preflight-to-model-call mutation window while
 * remaining a local, zero-model filesystem check.
 */
export function verifyAdaptiveWarrantStudyCliInvocation({
  environment = process.env,
  executable = 'codex',
} = {}) {
  const encoded = String(environment?.[ADAPTIVE_WARRANT_STUDY_CLI_GUARD_ENV_KEY] || '').trim();
  if (!encoded) return { enabled: false, cli_contract_sha256: null };

  let cliContract;
  try {
    cliContract = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`adaptive-warrant Codex executable guard is invalid: ${error.message}`);
  }
  const contractSha256 = validatedCliContractSha256(cliContract);
  const resolvedPath = resolveExecutablePath(executable, environment);
  const observed = fingerprintCodexExecutableChain(resolvedPath);
  const { requested: _requested, ...expectedEntrypoint } = cliContract.executable;
  const expected = {
    entrypoint: expectedEntrypoint,
    delegated: cliContract.delegated_executable,
  };
  if (hashCanonicalJson(observed) !== hashCanonicalJson(expected)) {
    throw new Error('adaptive-warrant Codex executable guard detected wrapper/native/package drift');
  }
  return {
    enabled: true,
    cli_contract_sha256: contractSha256,
    entrypoint_sha256: observed.entrypoint.sha256,
    delegated_executable_sha256: observed.delegated.sha256,
  };
}

export function adaptiveWarrantStudyEnvironmentContract({ cliContract = null } = {}) {
  const stripSet = {
    prefixes: ['TUTOR_STUB_'],
    keys: [...ADAPTIVE_WARRANT_STUDY_STRIPPED_ENV_KEYS].sort(),
  };
  const dotenvSource = assertEmptyAdaptiveWarrantStudyDotenv();
  const overrides = {
    ...ADAPTIVE_WARRANT_STUDY_ENV_OVERRIDES,
    DOTENV_CONFIG_PATH: dotenvSource.relative,
  };
  const cliContractSha256 = validatedCliContractSha256(cliContract);
  const contract = {
    schema: ADAPTIVE_WARRANT_STUDY_ENVIRONMENT_SCHEMA,
    strip_prefixes: stripSet.prefixes,
    strip_keys: stripSet.keys,
    stripped_set_sha256: hashCanonicalJson(stripSet),
    overrides,
    overrides_sha256: hashCanonicalJson(overrides),
    dotenv_source: {
      path: dotenvSource.relative,
      sha256: dotenvSource.sha256,
      active_line_count: dotenvSource.active_line_count,
    },
    cli_contract_sha256: cliContractSha256,
    required_auth_route: 'chatgpt_account',
    preservation_rule:
      'HOME and CODEX_HOME login state plus environment entries outside the strip set; OpenAI/Codex API routes are excluded',
  };
  return { ...contract, sha256: hashCanonicalJson(contract) };
}

/**
 * Project every stable field emitted by tutorStubWarrantGate v4-v5. Derived
 * replay-only presentation fields (for example `verdict` and
 * `actual_selection`) are intentionally outside this boundary.
 */
export function projectStableAdaptiveWarrantDecision(decision) {
  requireObject(decision, 'decision');
  return {
    projection_schema: ADAPTIVE_WARRANT_STABLE_DECISION_SCHEMA,
    ...Object.fromEntries(STABLE_WARRANT_DECISION_FIELDS.map((field) => [field, cloneJson(decision[field])])),
  };
}

function jsonPointerSegment(value) {
  return String(value).replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function jsonDifferences(left, right, pointer = '') {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return [pointer || '/'];
    const differences = left.length === right.length ? [] : [`${pointer}/length`];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      if (index >= left.length || index >= right.length) {
        differences.push(`${pointer}/${index}`);
      } else {
        differences.push(...jsonDifferences(left[index], right[index], `${pointer}/${index}`));
      }
    }
    return differences;
  }
  const leftObject = left && typeof left === 'object';
  const rightObject = right && typeof right === 'object';
  if (leftObject || rightObject) {
    if (!leftObject || !rightObject) return [pointer || '/'];
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap((key) => {
      const childPointer = `${pointer}/${jsonPointerSegment(key)}`;
      if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) return [childPointer];
      return jsonDifferences(left[key], right[key], childPointer);
    });
  }
  return [pointer || '/'];
}

export function compareStableAdaptiveWarrantDecisions(expected, observed) {
  const left = projectStableAdaptiveWarrantDecision(expected);
  const right = projectStableAdaptiveWarrantDecision(observed);
  const mismatches = [...new Set(jsonDifferences(left, right))];
  return {
    schema: ADAPTIVE_WARRANT_STABLE_DECISION_COMPARISON_SCHEMA,
    ok: mismatches.length === 0,
    expected_sha256: hashCanonicalJson(left),
    observed_sha256: hashCanonicalJson(right),
    mismatches,
    expected: left,
    observed: right,
  };
}

/**
 * Resolve the non-JavaScript resources that materially determine a study's
 * model route and named tutor prompt.
 */
export function collectAdaptiveWarrantStudyRuntimeResourcePaths({
  repoRoot = MODULE_ROOT,
  tutor = 'dramatic-detective',
  tutorRegistryPath = 'config/tutor-instances.yaml',
  providersPath = 'config/providers.yaml',
  studyDotenvPath = ADAPTIVE_WARRANT_STUDY_DOTENV_FILE,
} = {}) {
  const root = path.resolve(repoRoot);
  const registryAbsolute = path.resolve(root, tutorRegistryPath);
  const providersAbsolute = path.resolve(root, providersPath);
  const studyDotenvAbsolute = path.resolve(root, studyDotenvPath);
  if (!fs.existsSync(registryAbsolute)) throw new Error(`tutor instance registry not found: ${registryAbsolute}`);
  if (!fs.existsSync(providersAbsolute)) throw new Error(`provider config not found: ${providersAbsolute}`);
  if (!fs.existsSync(studyDotenvAbsolute)) {
    throw new Error(`adaptive-warrant study dotenv source not found: ${studyDotenvAbsolute}`);
  }
  const registry = YAML.parse(fs.readFileSync(registryAbsolute, 'utf8')) || {};
  const tutorId = String(tutor || registry.default || '')
    .trim()
    .replace(/@v\d+$/u, '');
  const instance = registry.instances?.[tutorId];
  if (!instance) throw new Error(`tutor instance not found in registry: ${tutorId || '(missing)'}`);
  if (!String(instance.role_prompt || '').trim()) throw new Error(`tutor instance ${tutorId} has no role_prompt`);
  const promptAbsolute = path.isAbsolute(instance.role_prompt)
    ? path.resolve(instance.role_prompt)
    : path.resolve(root, instance.role_prompt);
  if (!fs.existsSync(promptAbsolute)) throw new Error(`tutor role prompt not found: ${promptAbsolute}`);
  return [...new Set([registryAbsolute, promptAbsolute, providersAbsolute, studyDotenvAbsolute])]
    .map((resource) => (isWithin(root, resource) ? posixPath(path.relative(root, resource)) : resource))
    .sort();
}

/**
 * Verify one auto-eval child as sealed evidence before the outer study trusts
 * its summary or trace. Expected run and parent IDs close the directory-swap
 * and cross-study-reuse cases in addition to ordinary checksum verification.
 */
export function verifyAdaptiveWarrantStudyChildEvidence({
  runDir,
  expectedRunId = null,
  expectedParentRunId = null,
  expectedStatus = 'complete',
  expectedGitSha = null,
  expectedGitDirty = null,
  expectedPolicySha256 = null,
  completeness = true,
} = {}) {
  if (!String(runDir || '').trim()) throw new Error('runDir is required');
  const absolute = path.resolve(runDir);
  const verification = verifyExperimentRun(absolute, { completeness });
  const errors = [...verification.errors];
  if (expectedRunId && verification.plan?.runId !== expectedRunId) {
    errors.push(`child run id ${verification.plan?.runId || '(missing)'} does not match ${expectedRunId}`);
  }
  if (expectedParentRunId && verification.plan?.lineage?.parentRunId !== expectedParentRunId) {
    errors.push(
      `child parent run id ${verification.plan?.lineage?.parentRunId || '(missing)'} does not match ${expectedParentRunId}`,
    );
  }
  if (expectedStatus && verification.seal?.status !== expectedStatus) {
    errors.push(`child seal status ${verification.seal?.status || '(missing)'} does not match ${expectedStatus}`);
  }
  if (expectedGitSha && verification.plan?.provenance?.git?.sha !== expectedGitSha) {
    errors.push(
      `child git sha ${verification.plan?.provenance?.git?.sha || '(missing)'} does not match ${expectedGitSha}`,
    );
  }
  if (typeof expectedGitDirty === 'boolean' && verification.plan?.provenance?.git?.dirty !== expectedGitDirty) {
    errors.push(
      `child git dirty state ${String(verification.plan?.provenance?.git?.dirty ?? '(missing)')} does not match ${String(expectedGitDirty)}`,
    );
  }
  if (expectedPolicySha256 && verification.plan?.hashes?.policy !== expectedPolicySha256) {
    errors.push(
      `child policy sha256 ${verification.plan?.hashes?.policy || '(missing)'} does not match ${expectedPolicySha256}`,
    );
  }
  const planPath = path.join(absolute, EXPERIMENT_RUN_PLAN_FILE);
  const sealPath = path.join(absolute, EXPERIMENT_RUN_SEAL_FILE);
  return {
    schema: ADAPTIVE_WARRANT_CHILD_EVIDENCE_SCHEMA,
    ok: errors.length === 0,
    run_dir: absolute,
    run_id: verification.plan?.runId || null,
    parent_run_id: verification.plan?.lineage?.parentRunId || null,
    status: verification.seal?.status || null,
    plan_sha256: fs.existsSync(planPath) ? hashFile(planPath) : null,
    seal_sha256: fs.existsSync(sealPath) ? hashFile(sealPath) : null,
    artifacts: (verification.seal?.artifactInventory || []).map((artifact) => ({ ...artifact })),
    event_count: verification.eventCount,
    errors: [...new Set(errors)],
    warnings: verification.warnings,
  };
}

export function assertAdaptiveWarrantStudyChildEvidence(options = {}) {
  const verification = verifyAdaptiveWarrantStudyChildEvidence(options);
  if (!verification.ok) {
    throw new Error(`Adaptive-warrant child evidence verification failed:\n- ${verification.errors.join('\n- ')}`);
  }
  return verification;
}
