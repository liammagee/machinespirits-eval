import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import {
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
} from './tutorStubJointPerformanceFirstDraft.js';
import { TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA } from './tutorStubCompactSpeakingPrompt.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { extractTutorStubFrozenTurn, refreshTutorStubFrozenFirstDraftRequest } from './tutorStubFrozenReplay.js';
import { measureTutorStubSurfaceSentenceAccessibility } from './tutorStubResponseConfiguration.js';
import {
  TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
  TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA,
  auditTutorStubSourceAccessibilityCompensation,
} from './tutorStubSourceAccessibilityContract.js';
import { aggregateTokenUsage, tokenUsageFields } from './tokenUsage.js';
import { summarizeTutorStubPromptSizeReports } from './tutorStubPromptSizeReport.js';

export const TUTOR_STUB_FIRST_DRAFT_CAMPAIGN_SCHEMA = 'machinespirits.tutor-stub.first-draft-campaign-plan.v1';
const CAMPAIGN_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V_SERIES_FIXTURE_SCHEMA = 'machinespirits.tutor-stub.v-series-source-fixtures.v1';
const DEFAULT_V_SERIES_FIXTURE_ROOT = path.join(CAMPAIGN_REPO_ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft');

export function aggregateTutorStubFirstDraftCampaignTokenUsage(cells = []) {
  const completed = (Array.isArray(cells) ? cells : [])
    .filter((cell) => Number(cell?.completedTurns || 0) > 0)
    .map((cell) => ({
      usage: cell.tokenUsage,
      tokenUsageAvailable: cell.tokenUsageAvailable,
    }));
  const tokenUsage = aggregateTokenUsage(completed);
  return {
    tokenUsage: tokenUsageFields(tokenUsage),
    tokenUsageAvailable: tokenUsage.tokenUsageAvailable,
  };
}

export function aggregateTutorStubFirstDraftCampaignPromptSize(cells = []) {
  const reports = (Array.isArray(cells) ? cells : []).flatMap((cell) =>
    Array.isArray(cell?.promptSizeReports) ? cell.promptSizeReports : [],
  );
  return summarizeTutorStubPromptSizeReports(reports);
}

export function acquireTutorStubFirstDraftCellClaim({
  outputDir,
  cellId,
  seed = null,
  configSha256 = null,
  sourceTraceSha256 = null,
  expectedInventory = [],
  pid = process.pid,
} = {}) {
  const claimPath = `${outputDir}.claim.json`;
  fs.mkdirSync(path.dirname(claimPath), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(claimPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`${cellId} already has an active or crash-preserved development claim: ${claimPath}`);
    }
    throw error;
  }
  const claim = {
    schema: 'machinespirits.tutor-stub.first-draft-cell-claim.v1',
    cellId,
    outputDir,
    seed,
    configSha256,
    sourceTraceSha256,
    expectedInventory,
    pid,
    acquiredAt: new Date().toISOString(),
    disposition: 'active_or_crash_preserved',
  };
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
  } finally {
    fs.closeSync(descriptor);
  }
  return { claimPath, claim };
}

export function releaseTutorStubFirstDraftCellClaim(claimPath) {
  fs.rmSync(claimPath, { force: true });
}

export function tutorStubFirstDraftInterruptedCellResult({ cell, reportPath, error } = {}) {
  let checkpoint = null;
  let parseError = null;
  if (reportPath && fs.existsSync(reportPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (checkpointError) {
      parseError = checkpointError instanceof Error ? checkpointError.message : String(checkpointError);
    }
  }
  const results = Array.isArray(checkpoint?.results) ? checkpoint.results : [];
  const drawsPerPrefix = Number(checkpoint?.drawsPerTurn || checkpoint?.plan?.drawsPerTurn || 1);
  const expectedInventory = cell.turns.flatMap((turn) =>
    Array.from({ length: drawsPerPrefix }, (_, index) => `${Number(turn)}:${index + 1}`),
  );
  const observed = new Set(results.map((row) => `${Number(row.turn)}:${Number(row.draw ?? 1)}`));
  return {
    id: cell.id,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    seedDisposition: results.length ? 'consumed_development_incomplete' : 'indeterminate_zero_output_claim_preserved',
    status: 'infrastructure_error',
    completedTurns: results.length,
    unstartedTurns: cell.turns.filter((turn) => !results.some((row) => Number(row.turn) === Number(turn))),
    unstartedDraws: expectedInventory.filter((key) => !observed.has(key)),
    error: error instanceof Error ? error.message : String(error),
    partialCheckpoint:
      reportPath && (checkpoint || parseError)
        ? {
            path: reportPath,
            schema: checkpoint?.schema || null,
            completedDraws: results.length,
            admissionState: checkpoint?.admissionState || null,
            parseError,
          }
        : null,
  };
}

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function rate(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${label} must be a number between 0 and 1`);
  }
  return parsed;
}

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function absolute(root, value) {
  const normalized = requiredString(value, 'path');
  return path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function vSeriesFixtureRoot() {
  const configured = String(process.env.TUTOR_STUB_V_SERIES_FIXTURE_ROOT || '').trim();
  return configured ? path.resolve(configured) : DEFAULT_V_SERIES_FIXTURE_ROOT;
}

function resolveVSeriesSourceFixture({ sourceTrace, sourceTraceSha256, turn = null } = {}) {
  const fixtureRoot = vSeriesFixtureRoot();
  const manifestPath = path.join(fixtureRoot, 'v-series-source-fixtures.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.schema !== V_SERIES_FIXTURE_SCHEMA || !Array.isArray(manifest.fixtures)) {
    throw new Error(`invalid V-series source fixture manifest: ${manifestPath}`);
  }
  const pathMatches = manifest.fixtures.filter(
    (entry) => path.resolve(entry.source_trace) === path.resolve(sourceTrace),
  );
  if (!pathMatches.length) return null;
  const entry = pathMatches.find((candidate) => candidate.source_trace_sha256 === sourceTraceSha256);
  if (!entry) throw new Error('source trace hash does not match the predeclaration');
  if (turn != null && Number(entry.turn) !== Number(turn)) {
    throw new Error(`V-series source fixture has no frozen turn ${turn}: ${sourceTrace}`);
  }
  const fixturePath = path.resolve(fixtureRoot, requiredString(entry.fixture, 'V-series source fixture path'));
  if (!fs.existsSync(fixturePath)) throw new Error(`V-series source fixture is missing: ${fixturePath}`);
  if (sha256File(fixturePath) !== entry.fixture_sha256) {
    throw new Error(`V-series source fixture hash does not match its manifest: ${fixturePath}`);
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (path.resolve(fixture.sourceTrace || '') !== path.resolve(sourceTrace)) {
    throw new Error(`V-series source fixture provenance does not match: ${fixturePath}`);
  }
  const sourceCase = (fixture.cases || []).find((candidate) => candidate.id === entry.case_id);
  if (
    !sourceCase?.bundle ||
    Number(sourceCase.turn) !== Number(entry.turn) ||
    path.resolve(sourceCase.bundle.sourceTrace || '') !== path.resolve(sourceTrace)
  ) {
    throw new Error(`V-series source fixture case does not match its manifest: ${fixturePath}`);
  }
  return {
    kind: 'repo_fixture',
    sourceTrace,
    sourceTraceSha256,
    fixturePath,
    turn: Number(entry.turn),
    bundle: structuredClone(sourceCase.bundle),
    priorTutorDeliverySources: structuredClone(entry.prior_tutor_delivery_sources || []),
  };
}

function resolveTutorStubFirstDraftFrozenSource({ root, cell, turn = null } = {}) {
  const sourceTrace = absolute(root, cell.source_trace);
  const sourceTraceSha256 = cell.source_trace_sha256 || null;
  const preferRepoFixture = String(process.env.TUTOR_STUB_V_SERIES_FIXTURE_ROOT || '').trim().length > 0;
  if (!preferRepoFixture && fs.existsSync(sourceTrace)) {
    if (sourceTraceSha256 && sha256File(sourceTrace) !== sourceTraceSha256) {
      throw new Error(`${cell.id} source trace hash does not match the predeclaration`);
    }
    return {
      kind: 'sealed_trace',
      sourceTrace,
      sourceTraceSha256,
      bundle: null,
      priorTutorDeliverySources: null,
    };
  }
  const fixture = resolveVSeriesSourceFixture({ sourceTrace, sourceTraceSha256, turn });
  if (fixture) return fixture;
  if (!fs.existsSync(sourceTrace)) throw new Error(`${cell.id} source trace is missing: ${sourceTrace}`);
  if (sourceTraceSha256 && sha256File(sourceTrace) !== sourceTraceSha256) {
    throw new Error(`${cell.id} source trace hash does not match the predeclaration`);
  }
  return {
    kind: 'sealed_trace',
    sourceTrace,
    sourceTraceSha256,
    bundle: null,
    priorTutorDeliverySources: null,
  };
}

export function loadTutorStubFirstDraftFrozenBundle({ root = process.cwd(), cell, turn } = {}) {
  const source = resolveTutorStubFirstDraftFrozenSource({ root, cell, turn });
  return source.bundle || extractTutorStubFrozenTurn({ tracePath: source.sourceTrace, turn });
}

function priorTutorDeliverySources(tracePath, targetTurn) {
  const rows = [];
  for (const line of fs.readFileSync(tracePath, 'utf8').split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event?.type === 'tutor_response_guard_accounting' && Number(event.turn) < Number(targetTurn)) {
      rows.push({
        turn: Number(event.turn),
        source: event?.accounting?.finalDelivery?.source || null,
      });
    }
  }
  return rows;
}

function worldForFrozenBundle(root, worldId) {
  const requestedWorldDir = path.join(root, 'config', 'drama-derivation');
  const worldDir = fs.existsSync(requestedWorldDir)
    ? requestedWorldDir
    : path.join(CAMPAIGN_REPO_ROOT, 'config', 'drama-derivation');
  const candidates = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => path.join(worldDir, name));
  const matches = candidates.filter((file) => loadWorld(file).id === worldId);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one world file for ${worldId}, found ${matches.length}`);
  }
  return loadWorld(matches[0]);
}

function refreshedCampaignBundle({ root, trace, bundle = null, turn, sourceAccessibilityPolicy = 'direct_only' }) {
  const extracted = bundle || extractTutorStubFrozenTurn({ tracePath: trace, turn });
  return refreshTutorStubFrozenFirstDraftRequest({
    bundle: extracted,
    world: worldForFrozenBundle(root, extracted.worldId),
    sourceAccessibilityPolicy,
  });
}

function sourceAccessibilityContract(bundle, composition = null) {
  const contract =
    bundle?.firstDraftContract?.evidence?.source_accessibility || composition?.sourceAccessibilityContract || null;
  return contract?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA ? contract : null;
}

function sourceSurfaceAccessibilityMetrics(bundle) {
  const configuration = bundle?.speakingResponseConfiguration || bundle?.selectedResponseConfiguration || {};
  const sources = bundle?.firstDraftContract?.evidence?.sources || [];
  return sources.map((source) => ({
    id: source?.id || null,
    mode: source?.mode || null,
    ...measureTutorStubSurfaceSentenceAccessibility({
      text: source?.text || source?.surface || '',
      audienceRegister: configuration.audience_register || null,
      lexicalAccessibility: configuration.lexical_accessibility || null,
    }),
  }));
}

export function tutorStubSourceSurfaceAccessibilityReady(metrics = [], expectedCount = 0, contract = null) {
  const expected = integer(expectedCount, 'expected source accessibility count');
  const exactInventory =
    Array.isArray(metrics) && metrics.length === expected && (!contract || Number(contract.source_count) === expected);
  if (!exactInventory) return false;
  if (!contract) return metrics.every((metric) => metric?.ok === true);
  if (contract.effective_mode === 'direct') {
    return (
      contract.ok === true && contract.direct_accessible === true && metrics.every((metric) => metric?.ok === true)
    );
  }
  if (contract.effective_mode === 'compensated') {
    return (
      contract.ok === true &&
      contract.direct_accessible === false &&
      contract.compensation_required === true &&
      contract.compensation_contract_ready === true
    );
  }
  return false;
}

export function tutorStubFirstDraftCampaignValidationArtifactPath({ artifactRoot, mode, iteration = 1 } = {}) {
  const root = requiredString(artifactRoot, 'campaign artifact root');
  const normalizedMode = requiredString(mode, 'campaign mode').toLowerCase();
  if (!['validate', 'development', 'acceptance'].includes(normalizedMode)) {
    throw new Error(`unsupported campaign mode for validation artifact: ${normalizedMode}`);
  }
  if (normalizedMode === 'development') {
    const workingIteration = integer(iteration, 'working iteration', { minimum: 1 });
    return path.join(root, `iteration-${workingIteration}`, 'campaign-validation.json');
  }
  return path.join(root, 'campaign-validation.json');
}

export function tutorStubFirstDraftUnexpectedIterationArtifacts(entries = []) {
  return entries.filter((entry) => String(entry || '') !== 'campaign-validation.json');
}

export function assertTutorStubFirstDraftDevelopmentIterationVacant(iterationRoot) {
  const root = requiredString(iterationRoot, 'development iteration root');
  if (!fs.existsSync(root)) return { vacant: true, existing: [] };
  const existing = fs.readdirSync(root).sort();
  if (existing.length) {
    throw new Error(`development iteration already has immutable artifacts at ${root}: ${existing.join(', ')}`);
  }
  return { vacant: true, existing: [] };
}

export function writeTutorStubFirstDraftJsonExclusive(filePath, value) {
  const target = requiredString(filePath, 'campaign artifact path');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`refusing to overwrite existing campaign artifact: ${target}`);
    }
    throw error;
  }
  return target;
}

function workingScreen(config) {
  return config?.schema === 'machinespirits.tutor-stub.first-draft-working-screen.v1';
}

function acceptanceCampaign(config) {
  return config?.schema === 'machinespirits.tutor-stub.first-draft-generalization-plan.v1';
}

export function loadTutorStubFirstDraftCampaign(configPath, { root = process.cwd() } = {}) {
  const resolvedPath = absolute(root, configPath);
  const config = YAML.parse(fs.readFileSync(resolvedPath, 'utf8')) || {};
  return { config, configPath: resolvedPath, root: path.resolve(root) };
}

function legacyFocusedTestInventory(command) {
  const inventory = [];
  const pattern = /(?:^|\s)((?:tests|services\/__tests__)\/[A-Za-z0-9._/-]+\.test\.js)(?=\s|$)/gu;
  for (const match of String(command || '').matchAll(pattern)) inventory.push(match[1]);
  return [...new Set(inventory)].sort();
}

export function tutorStubFirstDraftFocusedTestSuites(config, { root = process.cwd() } = {}) {
  const declared = config?.preflight?.focused_test_suites;
  if (declared == null) return [];
  if (!Array.isArray(declared) || declared.length === 0) {
    throw new Error('focused_test_suites must be a non-empty array');
  }
  const repoRoot = path.resolve(root);
  const suiteIds = new Set();
  const testFiles = new Set();
  const suites = declared.map((suite, index) => {
    if (!suite || typeof suite !== 'object' || Array.isArray(suite)) {
      throw new Error(`focused test suite ${index + 1} must be an object`);
    }
    const id = requiredString(suite.id, `focused test suite ${index + 1} id`);
    if (!/^[a-z0-9][a-z0-9_-]*$/u.test(id)) {
      throw new Error(`focused test suite id must use lowercase letters, digits, underscores, or hyphens: ${id}`);
    }
    if (suiteIds.has(id)) throw new Error(`duplicate focused test suite id ${id}`);
    suiteIds.add(id);
    if (!Array.isArray(suite.test_files) || suite.test_files.length === 0) {
      throw new Error(`${id} focused test suite must declare at least one test_file`);
    }
    const files = suite.test_files.map((value) => {
      const declaredPath = requiredString(value, `${id} focused test file`);
      if (path.isAbsolute(declaredPath)) {
        throw new Error(`${id} focused test file must be repo-relative: ${declaredPath}`);
      }
      const normalized = path.normalize(declaredPath);
      const resolved = path.resolve(repoRoot, normalized);
      const relative = path.relative(repoRoot, resolved);
      if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        throw new Error(`${id} focused test file escapes the repository: ${declaredPath}`);
      }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        throw new Error(`${id} focused test file is missing: ${declaredPath}`);
      }
      if (testFiles.has(normalized)) {
        throw new Error(`duplicate focused test file across suites: ${normalized}`);
      }
      testFiles.add(normalized);
      return normalized;
    });
    return { id, testFiles: files };
  });
  const legacyCommand = String(config?.preflight?.focused_tests || '').trim();
  if (legacyCommand) {
    const legacyInventory = legacyFocusedTestInventory(legacyCommand);
    const structuredInventory = [...testFiles].sort();
    if (legacyInventory.length === 0 || JSON.stringify(legacyInventory) !== JSON.stringify(structuredInventory)) {
      throw new Error(
        'focused_test_suites inventory must exactly match legacy focused_tests; refusing to shrink or change the deterministic gate',
      );
    }
  }
  return suites;
}

function validateWorkingScreen(config, { root }) {
  if (config.held_out !== false) throw new Error('working screen must declare held_out: false');
  const developmentCodexInstructionsFile = config.fixed_configuration?.development_codex_instructions_file || null;
  if (developmentCodexInstructionsFile) {
    if (developmentCodexInstructionsFile !== 'config/tutor-stub-codex-speaker-instructions.md') {
      throw new Error(
        'development Codex base override is restricted to config/tutor-stub-codex-speaker-instructions.md',
      );
    }
    if (!fs.existsSync(absolute(root, developmentCodexInstructionsFile))) {
      throw new Error('development Codex base override file is missing');
    }
  }
  const focusedTestSuites = tutorStubFirstDraftFocusedTestSuites(config, { root });
  if (
    config.fixed_configuration?.structured_generation === true &&
    config.fixed_configuration?.joint_performance_generation === true
  ) {
    throw new Error('working screen generation modes are mutually exclusive');
  }
  if (config.fixed_configuration?.structured_generation === true) {
    for (const gate of [
      'require_structured_output',
      'require_structured_slot_ownership',
      'require_exact_source_once',
    ]) {
      if (config.gates_per_cell?.[gate] !== true) {
        throw new Error(`structured working screen must declare gates_per_cell.${gate}: true`);
      }
    }
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    const expectedSchemas = {
      joint_performance_schema: TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
      joint_performance_composition_schema: TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
      joint_performance_audit_schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
    };
    for (const [field, expected] of Object.entries(expectedSchemas)) {
      if (config.fixed_configuration?.[field] !== expected) {
        throw new Error(`joint-performance working screen must declare fixed_configuration.${field}: ${expected}`);
      }
    }
    for (const gate of [
      'require_joint_performance_output',
      'require_joint_performance_ownership',
      'require_exact_host_source_occurrences',
    ]) {
      if (config.gates_per_cell?.[gate] !== true) {
        throw new Error(`joint-performance working screen must declare gates_per_cell.${gate}: true`);
      }
    }
  }
  if (config.fixed_configuration?.compact_speaker_prompt === true) {
    if (config.fixed_configuration?.joint_performance_generation !== true) {
      throw new Error('compact speaker prompt requires fixed_configuration.joint_performance_generation: true');
    }
    if (config.fixed_configuration?.compact_speaker_prompt_schema !== TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA) {
      throw new Error(
        `compact working screen must declare fixed_configuration.compact_speaker_prompt_schema: ${TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA}`,
      );
    }
    if (config.gates_per_cell?.require_compact_speaker_prompt !== true) {
      throw new Error('compact working screen must declare gates_per_cell.require_compact_speaker_prompt: true');
    }
  }
  const cells = Array.isArray(config.matrix) ? config.matrix : [];
  const sourceAccessibilityPolicy = config.fixed_configuration?.source_accessibility_policy || 'direct_only';
  if (!['direct_only', 'direct_or_compensated_v1'].includes(sourceAccessibilityPolicy)) {
    throw new Error(`unsupported source accessibility policy ${sourceAccessibilityPolicy}`);
  }
  if (config.id === 'first-draft-working-screens-v9' && sourceAccessibilityPolicy !== 'direct_or_compensated_v1') {
    throw new Error('first-draft-working-screens-v9 must use direct_or_compensated_v1');
  }
  const declaredSourceAccessibilitySchema = config.fixed_configuration?.source_accessibility_schema || null;
  if (
    declaredSourceAccessibilitySchema !== null &&
    declaredSourceAccessibilitySchema !== TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA
  ) {
    throw new Error('source accessibility schema does not match the runtime contract');
  }
  if (
    config.id === 'first-draft-working-screens-v9' &&
    declaredSourceAccessibilitySchema !== TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA
  ) {
    throw new Error('first-draft-working-screens-v9 must declare the source accessibility schema');
  }
  const structuralPreflight = [];
  const preflightBlockers = [];
  if (!cells.length) throw new Error('working screen matrix is empty');
  const ids = new Set();
  const seeds = new Set();
  const requiredTurns = integer(config.gates_per_cell?.required_turns, 'required turns', { minimum: 1 });
  const drawsPerPrefix = integer(
    config.gates_per_cell?.required_draws_per_prefix ?? config.fixed_configuration?.draws_per_turn ?? 1,
    'required draws per prefix',
    { minimum: 1 },
  );
  const requiredPrefixes = integer(config.gates_per_cell?.required_prefixes ?? requiredTurns, 'required prefixes', {
    minimum: 1,
  });
  if (requiredPrefixes * drawsPerPrefix !== requiredTurns) {
    throw new Error('required prefixes multiplied by draws per prefix must equal required turns');
  }
  if (Number(config.fixed_configuration?.draws_per_turn ?? 1) !== drawsPerPrefix) {
    throw new Error('fixed draws per turn must equal required draws per prefix');
  }
  const requiredAccepted = integer(config.gates_per_cell?.required_originals_accepted, 'required originals accepted', {
    minimum: 1,
  });
  if (requiredAccepted > requiredTurns) throw new Error('required originals exceeds required turns');
  for (const [field, label] of [
    ['maximum_safety_failures', 'maximum safety failures'],
    ['maximum_fallbacks', 'maximum fallbacks'],
    ['maximum_mechanical_repairs', 'maximum mechanical repairs'],
    ['maximum_model_rewrites', 'maximum model rewrites'],
    ['maximum_semantic_recognition_corrections', 'maximum semantic recognition corrections'],
    ['maximum_semantic_adjudicator_calls', 'maximum semantic adjudicator calls'],
    ['maximum_semantic_adjudicator_errors', 'maximum semantic adjudicator errors'],
    ['maximum_transport_normalizations', 'maximum transport normalizations'],
  ]) {
    if (config.gates_per_cell?.[field] != null) integer(config.gates_per_cell[field], label);
  }
  const adjudicationPolicy = config.fixed_configuration?.adjudication_policy || null;
  if (adjudicationPolicy) {
    if (!['deterministic_only', 'semantic_every_draw'].includes(adjudicationPolicy)) {
      throw new Error('working-screen adjudication policy must be deterministic_only or semantic_every_draw');
    }
    if (adjudicationPolicy === 'deterministic_only') {
      if (config.fixed_configuration?.semantic_adjudication === true) {
        throw new Error('deterministic-only working screen cannot enable semantic adjudication');
      }
      if (config.gates_per_cell?.require_deterministic_only_audit !== true) {
        throw new Error('deterministic-only working screen must gate deterministic-only audit');
      }
      if (Number(config.gates_per_cell?.maximum_semantic_adjudicator_calls) !== 0) {
        throw new Error('deterministic-only working screen must allow zero semantic adjudicator calls');
      }
    } else {
      if (config.fixed_configuration?.semantic_adjudication !== true) {
        throw new Error('semantic-every-draw working screen must enable semantic adjudication');
      }
      if (config.gates_per_cell?.require_successful_semantic_adjudication_per_draw !== true) {
        throw new Error('semantic-every-draw working screen must gate successful adjudication per draw');
      }
    }
  }
  if (
    config.gates_per_cell?.require_structural_target_activation === true &&
    config.execution?.require_exact_target_bundle_binding !== true
  ) {
    throw new Error('structural working screen must require exact target bundle binding');
  }
  if (
    config.gates_per_cell?.require_structural_target_activation === true &&
    config.gates_per_cell?.require_source_surface_accessibility !== true
  ) {
    throw new Error('structural working screen must gate source-surface accessibility');
  }
  for (const cell of cells) {
    const id = requiredString(cell.id, 'cell id');
    if (ids.has(id)) throw new Error(`duplicate cell id ${id}`);
    ids.add(id);
    const seed = integer(cell.development_seed, `${id} development seed`, { minimum: 1 });
    if (seeds.has(seed)) throw new Error(`duplicate development seed ${seed}`);
    seeds.add(seed);
    if (cell.seed_status !== 'reusable_non_held_out_development') {
      throw new Error(`${id} must label its seed reusable_non_held_out_development`);
    }
    const structuralTargets = cell.structural_targets || [];
    if (config.gates_per_cell?.require_structural_target_activation === true) {
      if (!structuralTargets.length) {
        throw new Error(`${id} must declare at least one structural target`);
      }
      const declaredActivations = Object.keys(cell.structural_activation || {});
      if (
        declaredActivations.length !== structuralTargets.length ||
        declaredActivations.some((target) => !structuralTargets.includes(target)) ||
        structuralTargets.some((target) => cell.structural_activation?.[target]?.required !== true)
      ) {
        throw new Error(`${id} structural activation declarations must exactly cover its required targets`);
      }
    }
    const turns = [...new Set((cell.turns || []).map(Number))];
    if (turns.length !== requiredPrefixes || turns.some((turn) => !Number.isInteger(turn) || turn < 1)) {
      throw new Error(`${id} must declare exactly ${requiredPrefixes} distinct positive prefixes`);
    }
    const targetTurn = cell.prefix_integrity
      ? integer(cell.prefix_integrity.target_turn, `${id} target turn`, { minimum: 1 })
      : null;
    const frozenSource = resolveTutorStubFirstDraftFrozenSource({ root, cell, turn: targetTurn });
    const trace = frozenSource.sourceTrace;
    if (cell.prefix_integrity) {
      if (!turns.includes(targetTurn)) throw new Error(`${id} target turn must be a declared prefix`);
      const requiredSource = requiredString(
        cell.prefix_integrity.required_prior_delivery_source,
        `${id} required prior delivery source`,
      );
      const observed =
        frozenSource.priorTutorDeliverySources || priorTutorDeliverySources(frozenSource.sourceTrace, targetTurn);
      const expectedTurns = (cell.prefix_integrity.verified_prior_turns || []).map(Number);
      if (JSON.stringify(observed.map((row) => row.turn)) !== JSON.stringify(expectedTurns)) {
        throw new Error(`${id} prior delivery turn inventory does not match the trace`);
      }
      if (observed.some((row) => row.source !== requiredSource)) {
        throw new Error(`${id} frozen prefix contains a prior non-original tutor delivery`);
      }
      if (config.execution?.require_exact_target_bundle_binding === true) {
        const bundle = refreshedCampaignBundle({
          root,
          trace,
          bundle: frozenSource.bundle,
          turn: targetTurn,
          sourceAccessibilityPolicy,
        });
        const binding = cell.prefix_integrity.target_bundle || {};
        for (const [field, actual, expected] of [
          ['turn_id', bundle.turnId, binding.turn_id],
          ['world', bundle.worldId, binding.world],
          ['learner_profile', bundle.learnerProfile, binding.learner_profile],
          ['request_model', bundle.request?.model, binding.request_model],
          ['request_effort', bundle.request?.effort, binding.request_effort],
        ]) {
          if (actual !== expected) {
            throw new Error(`${id} target bundle ${field} does not match the frozen trace`);
          }
        }
        const activation = cell.structural_activation || {};
        const targets = new Set(structuralTargets);
        const release = bundle.frames?.dramaticRelease || null;
        const releaseEntries = release?.active === true && Array.isArray(release.entries) ? release.entries : [];
        const sourceModes = releaseEntries.map((entry) => entry?.mode || 'presented_exhibit');
        const progression = bundle.firstDraftContract?.progression || null;
        const sourceAccessibility = sourceSurfaceAccessibilityMetrics(bundle);
        const accessibilityContract = sourceAccessibilityContract(bundle);
        const sourceAccessibilityReady = tutorStubSourceSurfaceAccessibilityReady(
          sourceAccessibility,
          releaseEntries.length,
          accessibilityContract,
        );
        if (targets.has('deterministic_host_source_renderer')) {
          if (!releaseEntries.length) {
            throw new Error(`${id} declares source rendering but its frozen turn has no active due source`);
          }
          const expectedModes = activation.deterministic_host_source_renderer?.expected_modes || [];
          if (!expectedModes.length || sourceModes.some((mode) => !expectedModes.includes(mode))) {
            throw new Error(`${id} source renderer modes do not match its structural activation declaration`);
          }
          if (
            activation.deterministic_host_source_renderer?.require_lexical_accessibility_axis === true &&
            !bundle.selectedResponseConfiguration?.lexical_accessibility
          ) {
            throw new Error(`${id} source accessibility gate has no selected lexical-accessibility axis`);
          }
          if (
            activation.deterministic_host_source_renderer?.require_lexical_accessibility_axis === true &&
            !bundle.selectedResponseConfiguration?.audience_register
          ) {
            throw new Error(`${id} source accessibility gate has no selected audience-register axis`);
          }
        }
        if (targets.has('typed_due_source_action_referent')) {
          const requiredReferent = (bundle.firstDraftContract?.evidence?.sources || []).some(
            (source) => source?.action_referents?.required === true,
          );
          if (!requiredReferent) {
            throw new Error(`${id} declares due-source action alignment but no source has a required action referent`);
          }
        }
        if (
          targets.has('handoff_contract_and_cross_slot_progression') &&
          (progression?.complete !== true || !progression?.handoff_contract?.mode)
        ) {
          throw new Error(`${id} declares handoff progression but its typed progression contract is inactive`);
        }
        if (
          targets.has('typed_turn_focus_relation') &&
          !(progression?.handoff_contract?.required_target_terms || []).length
        ) {
          throw new Error(`${id} declares turn focus but its typed target relation is empty`);
        }
        if (
          targets.has('shared_writable_request_classifier') &&
          progression?.learner_uptake?.mode !== 'writable_entry'
        ) {
          throw new Error(
            `${id} declares writable-request classification but the typed learner mode is not writable_entry`,
          );
        }
        if (targets.has('source_accessibility_compensation')) {
          const declaration = activation.source_accessibility_compensation || {};
          if (
            accessibilityContract?.compensation_required !== true ||
            accessibilityContract?.compensation_contract_ready !== true
          ) {
            throw new Error(`${id} declares source accessibility compensation but its typed contract is not ready`);
          }
          if (
            declaration.expected_effective_mode &&
            accessibilityContract.effective_mode !== declaration.expected_effective_mode
          ) {
            throw new Error(`${id} source accessibility effective mode does not match its declaration`);
          }
          if (declaration.expected_owner && accessibilityContract.owner !== declaration.expected_owner) {
            throw new Error(`${id} source accessibility owner does not match its declaration`);
          }
        }
        if (releaseEntries.length > 0 && config.gates_per_cell?.require_structural_target_activation === true) {
          if (!targets.has('deterministic_host_source_renderer')) {
            throw new Error(`${id} has a due source but does not declare the source renderer target`);
          }
          if (config.gates_per_cell?.require_source_surface_accessibility === true && !sourceAccessibilityReady) {
            const summary = sourceAccessibility
              .map(
                (metric) =>
                  `${metric.id || 'source'}=${metric.averageSentenceWords} words/sentence ` +
                  `(audience<=${metric.audienceMaximum}, lexical<=${metric.lexicalMaximum})`,
              )
              .join(', ');
            preflightBlockers.push({
              type: 'source_surface_accessibility',
              cellId: id,
              turn: targetTurn,
              reason: `${id} due source fails its selected accessibility budgets: ${summary}`,
              sources: sourceAccessibility,
              directAccessible: accessibilityContract?.direct_accessible ?? false,
              compensationRequired: accessibilityContract?.compensation_required ?? false,
              compensationContractReady: accessibilityContract?.compensation_contract_ready ?? false,
              compensationVisible: null,
              effectiveMode: accessibilityContract?.effective_mode || 'blocked',
              contractIssues: [...(accessibilityContract?.issues || [])],
            });
          }
          structuralPreflight.push({
            cellId: id,
            turn: targetTurn,
            sourceSurfaceAccessibility: sourceAccessibility,
            directAccessible:
              accessibilityContract?.direct_accessible ?? sourceAccessibility.every((metric) => metric?.ok === true),
            compensationRequired: accessibilityContract?.compensation_required ?? false,
            compensationContractReady: accessibilityContract?.compensation_contract_ready ?? false,
            // No candidate exists during preflight. Visibility is deliberately
            // unknown until the generated owner span clears the strict audit.
            compensationVisible: null,
            effectiveMode: accessibilityContract?.effective_mode || (sourceAccessibilityReady ? 'direct' : 'blocked'),
            owner: accessibilityContract?.owner || null,
            contractIssues: [...(accessibilityContract?.issues || [])],
            ok: sourceAccessibilityReady,
          });
        }
      }
    }
  }
  for (const fixture of config.preflight?.model_free_fixtures || []) {
    const fixturePath = absolute(root, fixture);
    if (!fs.existsSync(fixturePath)) throw new Error(`model-free fixture is missing: ${fixturePath}`);
  }
  const maxConcurrency = integer(config.fixed_configuration?.max_live_model_jobs ?? 1, 'maximum live model jobs', {
    minimum: 1,
  });
  if (maxConcurrency > 3) throw new Error('live model concurrency may not exceed three');
  if (config.execution) {
    const execution = config.execution;
    if (execution.hardest_cell_first !== true) throw new Error('development execution must run hardest cell first');
    const hardCell = requiredString(execution.hard_cell, 'development hard cell');
    const hardest = cells.find((cell) => Number(cell.priority) === 1);
    if (!hardest || hardest.id !== hardCell) throw new Error('development hard cell must be the priority 1 cell');
    if (execution.hard_cell_must_pass_before_remaining !== true) {
      throw new Error('development hard cell must pass before remaining cells');
    }
    if (execution.remaining_cells_execution !== 'concurrent') {
      throw new Error('remaining development cells must declare concurrent execution');
    }
    const remainingConcurrency = integer(
      execution.maximum_concurrent_remaining_cells,
      'maximum concurrent remaining cells',
      { minimum: 1 },
    );
    if (remainingConcurrency > 3 || remainingConcurrency > maxConcurrency) {
      throw new Error('remaining development concurrency may not exceed three or max_live_model_jobs');
    }
    for (const [field, label] of [
      ['one_job_per_cell', 'one job per development cell'],
      ['forbid_duplicate_active_or_completed_cells', 'duplicate development cell guard'],
      ['complete_all_cells_after_hard_cell_passes', 'complete all development cells'],
      ['stop_cell_when_gate_mathematically_impossible', 'mathematical impossibility stop'],
      ['preserve_unstarted_seeds_as_unconsumed', 'unstarted seed preservation'],
    ]) {
      if (execution[field] !== true) throw new Error(`${label} must be enabled`);
    }
    if (execution.require_clean_worktree != null && typeof execution.require_clean_worktree !== 'boolean') {
      throw new Error('development clean-worktree requirement must be boolean');
    }
    if (
      ['first-draft-working-screens-v7', 'first-draft-working-screens-v8', 'first-draft-working-screens-v9'].includes(
        config.id,
      ) &&
      execution.require_exact_target_bundle_binding !== true
    )
      throw new Error(`${config.id} must require exact target bundle binding`);
    if (
      ['first-draft-working-screens-v8', 'first-draft-working-screens-v9'].includes(config.id) &&
      execution.require_clean_worktree !== true
    ) {
      throw new Error(`${config.id} must require a clean worktree`);
    }
  }
  return {
    kind: 'working_screen',
    requiredTurns,
    requiredAccepted,
    requiredPrefixes,
    drawsPerPrefix,
    maxConcurrency,
    preflightReady: preflightBlockers.length === 0,
    preflightBlockers,
    structuralPreflight,
    focusedTestSuites,
  };
}

function validateAcceptance(config) {
  const cells = Array.isArray(config.matrix) ? config.matrix : [];
  if (!cells.length) throw new Error('acceptance matrix is empty');
  const strict = config.strict_delivery_gates_per_cell || {};
  const first = config.first_draft_gates || {};
  if (first.require_all_four_cells !== true) {
    throw new Error('acceptance must require all four cells');
  }
  if (cells.length !== 4) {
    throw new Error('acceptance matrix must declare exactly four cells');
  }
  integer(config.fixed_configuration?.turns, 'fixed turns', { minimum: 1 });
  integer(strict.final_delivery_audit_failures, 'final delivery audit failures');
  integer(strict.maximum_deterministic_fallback_turns, 'maximum deterministic fallback turns');
  integer(strict.error_count, 'error count');
  integer(strict.quarantine_count, 'quarantine count');
  integer(strict.meta_performance_turns, 'meta performance turns');
  integer(strict.role_stage_direction_turns, 'role stage direction turns');
  integer(strict.source_replacement_turns, 'source replacement turns');
  integer(strict.duplicate_clue_delivery_turns, 'duplicate clue delivery turns');
  rate(strict.minimum_host_visibility_rate, 'minimum host visibility rate');
  rate(strict.minimum_mean_configuration_realization, 'minimum mean configuration realization');
  integer(strict.minimum_distinct_host_parts, 'minimum distinct host parts', { minimum: 1 });
  rate(first.minimum_accounted_turn_rate, 'minimum accounted turn rate');
  rate(first.minimum_aggregate_original_candidate_acceptance_rate, 'minimum aggregate original acceptance rate');
  rate(first.minimum_cell_original_candidate_acceptance_rate, 'minimum cell original acceptance rate');
  rate(first.maximum_aggregate_model_rewrite_rate, 'maximum aggregate model rewrite rate');
  integer(first.maximum_model_rewrite_turns_per_cell, 'maximum model rewrite turns per cell');
  integer(first.maximum_total_deterministic_fallback_turns, 'maximum total deterministic fallback turns');
  const ids = new Set();
  const seeds = new Set();
  const priorities = new Set();
  for (const cell of cells) {
    const id = requiredString(cell.id, 'cell id');
    if (ids.has(id)) throw new Error(`duplicate cell id ${id}`);
    ids.add(id);
    const seed = integer(cell.seed, `${id} seed`, { minimum: 1 });
    if (seeds.has(seed)) throw new Error(`duplicate held-out seed ${seed}`);
    seeds.add(seed);
    if (cell.priority !== undefined && cell.priority !== null) {
      const priority = integer(cell.priority, `${id} priority`, { minimum: 1 });
      if (priorities.has(priority)) throw new Error(`duplicate acceptance priority ${priority}`);
      priorities.add(priority);
    }
    requiredString(cell.world, `${id} world`);
    requiredString(cell.learner_profile, `${id} learner profile`);
  }
  if (config.change_control?.hardest_cell_first === true) {
    const hardest = cells.find((cell) => Number(cell.priority) === 1) || (priorities.size === 0 ? cells[0] : null);
    if (!hardest) throw new Error('hardest-cell-first acceptance requires a priority 1 cell');
    if (hardest.learner_profile !== 'answer_seeking') {
      throw new Error('priority 1 must exercise the answer_seeking hard profile');
    }
  }
  requiredString(config.fixed_configuration?.register_palette, 'fixed register palette');
  integer(config.fixed_configuration?.safety_turns, 'fixed safety turns', { minimum: 1 });
  const maxConcurrency = integer(config.change_control?.maximum_concurrent_cells ?? 3, 'maximum concurrent cells', {
    minimum: 1,
  });
  if (maxConcurrency > 3) throw new Error('live model concurrency may not exceed three');
  return { kind: 'acceptance', maxConcurrency };
}

export function validateTutorStubFirstDraftCampaign({ config, root = process.cwd() } = {}) {
  requiredString(config?.id, 'campaign id');
  let details;
  if (workingScreen(config)) details = validateWorkingScreen(config, { root });
  else if (acceptanceCampaign(config)) details = validateAcceptance(config);
  else throw new Error(`unsupported first-draft campaign schema: ${config?.schema || 'missing'}`);
  return {
    schema: TUTOR_STUB_FIRST_DRAFT_CAMPAIGN_SCHEMA,
    id: config.id,
    valid: true,
    ...details,
  };
}

function replayCommand({ root, config, cell, turn, outputPath }) {
  const command = [
    process.execPath,
    path.join(root, 'scripts', 'replay-tutor-stub-frozen-turns.js'),
    '--trace',
    absolute(root, cell.source_trace),
    '--turns',
    String(turn),
    '--draws',
    String(config.fixed_configuration?.draws_per_turn || 1),
    '--concurrency',
    '1',
    '--development-seed',
    String(cell.development_seed),
    '--original-only',
    '--out',
    outputPath,
  ];
  if (config.fixed_configuration?.semantic_adjudication === true) {
    command.splice(command.length - 2, 0, '--semantic-adjudication');
  }
  if (config.fixed_configuration?.structured_generation === true) {
    command.splice(command.length - 2, 0, '--structured-generation');
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    command.splice(command.length - 2, 0, '--joint-performance-generation');
  }
  if (config.fixed_configuration?.compact_speaker_prompt === true) {
    command.splice(command.length - 2, 0, '--compact-speaker-prompt');
  }
  if (config.fixed_configuration?.source_accessibility_policy) {
    command.splice(
      command.length - 2,
      0,
      '--source-accessibility-policy',
      String(config.fixed_configuration.source_accessibility_policy),
    );
  }
  if (config.fixed_configuration?.development_codex_instructions_file) {
    command.splice(
      command.length - 2,
      0,
      '--development-codex-instructions-file',
      absolute(root, config.fixed_configuration.development_codex_instructions_file),
    );
  }
  if (
    config.execution?.stop_cell_when_gate_mathematically_impossible === true &&
    Number(config.fixed_configuration?.draws_per_turn || 1) > 1
  ) {
    command.splice(command.length - 2, 0, '--stop-on-first-rejection');
  }
  if (config.fixed_configuration?.adjudicator_model) {
    command.splice(command.length - 2, 0, '--adjudicator-model', String(config.fixed_configuration.adjudicator_model));
  }
  if (config.fixed_configuration?.adjudicator_effort) {
    command.splice(
      command.length - 2,
      0,
      '--adjudicator-effort',
      String(config.fixed_configuration.adjudicator_effort),
    );
  }
  return command;
}

function autoEvalCommand({ root, config, cell, outputDir }) {
  const fixed = config.fixed_configuration || {};
  return [
    process.execPath,
    path.join(root, 'scripts', 'run-tutor-stub-auto-eval.js'),
    '--runs',
    '1',
    '--run-seed',
    String(cell.seed),
    '--policies',
    String(fixed.policy),
    '--parallelism',
    '1',
    '--turns',
    String(fixed.turns),
    '--primary-horizon',
    String(fixed.turns),
    '--model',
    String(fixed.tutor_model),
    '--analysis-model',
    String(fixed.analysis_model),
    '--auto-learner-model',
    String(fixed.learner_model),
    '--auto-learner-profile-id',
    String(cell.learner_profile),
    '--world',
    String(cell.world),
    '--dag-mode',
    String(fixed.dag_mode),
    '--register-temperature',
    String(fixed.register_temperature),
    '--register-palette',
    String(fixed.register_palette),
    '--register-overlay-threshold',
    String(fixed.register_overlay_threshold),
    '--dag-fact-dropout',
    String(fixed.dag_fact_dropout),
    '--dag-fact-dropout-seed',
    String(fixed.dag_fact_dropout_seed),
    '--release-speed',
    String(fixed.release_speed),
    '--cli-effort',
    String(fixed.cli_effort),
    '--max-tokens',
    String(fixed.max_tokens),
    '--history-turns',
    String(fixed.history_turns),
    '--safety-turns',
    String(fixed.safety_turns),
    '--trace-dir',
    outputDir,
    '--keep-going',
    '--no-ledger',
    '--loop-mode',
    String(fixed.mode || 'strict'),
  ];
}

export function expandTutorStubFirstDraftCampaign({ config, root = process.cwd(), iteration = 1 } = {}) {
  const validation = validateTutorStubFirstDraftCampaign({ config, root });
  const cells = [...config.matrix].sort(
    (left, right) =>
      Number(left.priority || Number.MAX_SAFE_INTEGER) - Number(right.priority || Number.MAX_SAFE_INTEGER),
  );
  const artifactRoot = workingScreen(config)
    ? absolute(root, config.artifacts.root)
    : absolute(root, config.artifacts.live_root);
  const iterationRoot = workingScreen(config)
    ? path.join(artifactRoot, `iteration-${integer(iteration, 'iteration', { minimum: 1 })}`)
    : artifactRoot;
  return {
    ...validation,
    artifactRoot,
    iterationRoot,
    maxConcurrency: workingScreen(config)
      ? Math.min(3, Number(config.fixed_configuration?.max_live_model_jobs || 1))
      : validation.maxConcurrency,
    cells: cells.map((cell) => {
      const outputDir = path.join(iterationRoot, cell.id);
      if (workingScreen(config)) {
        return {
          id: cell.id,
          priority: Number(cell.priority || Number.MAX_SAFE_INTEGER),
          seed: Number(cell.development_seed),
          seedStatus: cell.seed_status,
          world: cell.world,
          learnerProfile: cell.learner_profile,
          sourceTrace: absolute(root, cell.source_trace),
          sourceTraceSha256: cell.source_trace_sha256 || null,
          targetBundle: cell.prefix_integrity?.target_bundle || null,
          structural_targets: [...(cell.structural_targets || [])],
          structural_activation: structuredClone(cell.structural_activation || {}),
          outputDir,
          turns: cell.turns.map(Number),
          commands: cell.turns.map((turn) => ({
            turn: Number(turn),
            outputPath: path.join(outputDir, `turn-${turn}.json`),
            argv: replayCommand({
              root,
              config,
              cell,
              turn,
              outputPath: path.join(outputDir, `turn-${turn}.json`),
            }),
          })),
        };
      }
      return {
        id: cell.id,
        priority: Number(cell.priority || Number.MAX_SAFE_INTEGER),
        seed: Number(cell.seed),
        seedStatus: 'unconsumed_held_out',
        world: cell.world,
        learnerProfile: cell.learner_profile,
        outputDir,
        argv: autoEvalCommand({ root, config, cell, outputDir }),
      };
    }),
  };
}

export function buildTutorStubFirstDraftCampaignValidationReport({ plan, config, configPath, frozen = null } = {}) {
  const jointPerformanceGeneration = config?.fixed_configuration?.joint_performance_generation === true;
  const compactSpeakerPrompt = config?.fixed_configuration?.compact_speaker_prompt === true;
  const developmentCodexInstructionsFile = config?.fixed_configuration?.development_codex_instructions_file || null;
  return {
    schema: 'machinespirits.tutor-stub.first-draft-campaign-validation.v1',
    generatedAt: new Date().toISOString(),
    configPath,
    campaignId: config?.id || null,
    kind: plan?.kind || null,
    // A preflight blocker does not invalidate an otherwise well-formed,
    // faithfully expanded predeclaration. Keep the two states independent.
    valid: plan?.valid === true,
    preflightReady: plan?.preflightReady !== false,
    preflightBlockers: plan?.preflightBlockers || [],
    structuralPreflight: plan?.structuralPreflight || [],
    focusedTestSuites: structuredClone(plan?.focusedTestSuites || []),
    oneCampaignLevelExpansion: true,
    makesModelCalls: false,
    frozen,
    maxConcurrency: plan?.maxConcurrency,
    speakerTransportMode: developmentCodexInstructionsFile
      ? 'codex_cli_development_base_override_non_equivalent'
      : 'frozen_model_transport',
    developmentCodexInstructionsFile,
    generationMode: jointPerformanceGeneration
      ? compactSpeakerPrompt
        ? 'joint_performance_v2_compact_no_source'
        : 'joint_performance_v2'
      : config?.fixed_configuration?.structured_generation === true
        ? 'structured_v1'
        : 'plain',
    ...(jointPerformanceGeneration
      ? {
          jointPerformanceSchema: config.fixed_configuration.joint_performance_schema,
          jointPerformanceCompositionSchema: config.fixed_configuration.joint_performance_composition_schema,
          jointPerformanceAuditSchema: config.fixed_configuration.joint_performance_audit_schema,
        }
      : {}),
    ...(compactSpeakerPrompt
      ? {
          compactSpeakerPrompt: true,
          compactSpeakerPromptSchema: config.fixed_configuration.compact_speaker_prompt_schema,
        }
      : {}),
    cells: (plan?.cells || []).map((cell) => ({
      id: cell.id,
      priority: cell.priority,
      seed: cell.seed,
      seedStatus: cell.seedStatus,
      world: cell.world,
      learnerProfile: cell.learnerProfile,
      sourceTrace: cell.sourceTrace || null,
      sourceTraceSha256: cell.sourceTraceSha256 || null,
      targetBundle: cell.targetBundle || null,
      outputDir: cell.outputDir,
      turns: cell.turns || null,
      structuralTargets: cell.structural_targets || [],
      structuralActivation: structuredClone(cell.structural_activation || {}),
      commands: cell.commands
        ? cell.commands.map((command) => ({
            turn: command.turn,
            outputPath: command.outputPath,
            argv: command.argv,
          }))
        : [{ argv: cell.argv }],
    })),
  };
}

export function applyTutorStubFirstDraftDevelopmentRuntimePreflight({ plan, frozen } = {}) {
  const blockers = [...(plan?.preflightBlockers || [])];
  if (frozen?.cleanWorktreeRequired === true && frozen?.worktreeClean !== true) {
    blockers.push({
      type: 'unclean_worktree',
      reason: 'development campaign requires a clean committed worktree',
      worktree: frozen.worktree || null,
    });
  }
  return {
    ...plan,
    preflightReady: plan?.preflightReady !== false && blockers.length === 0,
    preflightBlockers: blockers,
  };
}

export function buildTutorStubFirstDraftPreflightFailureResult({
  plan,
  config,
  configPath,
  iteration,
  frozen,
  validationArtifactPath = null,
  commandFailure = null,
} = {}) {
  const workingIteration = integer(iteration, 'working iteration', { minimum: 1 });
  const preserveUnstartedSeeds = config?.execution?.preserve_unstarted_seeds_as_unconsumed !== false;
  const seedDisposition = preserveUnstartedSeeds
    ? 'unconsumed_development_preflight_failure'
    : 'retired_development_preflight_failure';
  const cells = (plan?.cells || []).map((cell) => ({
    id: cell.id,
    priority: cell.priority,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    seedStatus: cell.seedStatus,
    sourceTrace: cell.sourceTrace,
    sourceTraceSha256: cell.sourceTraceSha256,
    targetBundle: structuredClone(cell.targetBundle || null),
    requestModel: cell.targetBundle?.request_model || null,
    requestEffort: cell.targetBundle?.request_effort || null,
    outputDir: cell.outputDir,
    turns: [...(cell.turns || [])],
    unstartedTurns: [...(cell.turns || [])],
    structuralTargets: [...(cell.structural_targets || [])],
    structuralActivation: structuredClone(cell.structural_activation || {}),
    commands: (cell.commands || []).map((command) => ({
      turn: command.turn,
      outputPath: command.outputPath,
      argv: command.argv,
    })),
    seedDisposition,
    completedTurns: 0,
    completedCandidates: 0,
    status: 'unstarted_after_preflight_failure',
  }));
  return {
    schema: 'machinespirits.tutor-stub.first-draft-working-screen-result.v1',
    generatedAt: new Date().toISOString(),
    campaignId: config?.id || null,
    heldOut: false,
    iteration: workingIteration,
    workingIteration,
    status: 'preflight_failed',
    frozen: {
      ...(frozen || {}),
      configPath,
    },
    validationArtifactPath,
    makesModelCalls: false,
    modelCalls: 0,
    candidates: 0,
    completedCandidates: 0,
    completedTurns: 0,
    originalAcceptance: 0,
    semanticRecognitionCorrections: 0,
    mechanicalRepairs: 0,
    modelRewrites: 0,
    deterministicFallbacks: 0,
    finalSafetyFailures: 0,
    preflightReady: false,
    preflightBlockers: plan?.preflightBlockers || [],
    commandFailure: commandFailure ? structuredClone(commandFailure) : null,
    preflightExecutionArtifactPath: commandFailure?.preflightExecutionArtifactPath || null,
    structuralPreflight: plan?.structuralPreflight || [],
    changeControl: structuredClone(config?.change_control || null),
    seedInventory: {
      policy: preserveUnstartedSeeds ? 'preserve_unstarted_as_unconsumed' : 'retire_on_preflight_failure',
      unconsumed: preserveUnstartedSeeds ? cells.map((cell) => cell.seed) : [],
      retired: preserveUnstartedSeeds ? [] : cells.map((cell) => cell.seed),
    },
    cells,
    claimBoundary: config?.claim_boundary || null,
  };
}

export function tutorStubFirstDraftDevelopmentExecutionPlan({ plan, config } = {}) {
  if (plan?.kind !== 'working_screen') throw new Error('development execution requires a working-screen plan');
  const cells = Array.isArray(plan.cells) ? plan.cells : [];
  if (!cells.length) throw new Error('development execution plan has no cells');
  const execution = config?.execution || {};
  const hardCellId = execution.hard_cell || cells[0].id;
  const hardCell = cells.find((cell) => cell.id === hardCellId);
  if (!hardCell) throw new Error(`development hard cell is absent from plan: ${hardCellId}`);
  const remainingCells = cells.filter((cell) => cell.id !== hardCellId);
  const remainingConcurrency = Math.min(
    3,
    Number(plan.maxConcurrency || 1),
    Number(execution.maximum_concurrent_remaining_cells || 1),
    Math.max(1, remainingCells.length),
  );
  return {
    hardCell,
    remainingCells,
    remainingConcurrency,
    preflightRuns: 1,
    hardCellMustPassBeforeRemaining: execution.hard_cell_must_pass_before_remaining === true,
    completeAllCellsAfterHardCellPasses: execution.complete_all_cells_after_hard_cell_passes === true,
    oneJobPerCell: execution.one_job_per_cell === true,
    forbidDuplicateActiveOrCompletedCells: execution.forbid_duplicate_active_or_completed_cells === true,
    stopCellWhenGateMathematicallyImpossible: execution.stop_cell_when_gate_mathematically_impossible !== false,
    preserveUnstartedSeedsAsUnconsumed: execution.preserve_unstarted_seeds_as_unconsumed === true,
    requireCleanWorktree: execution.require_clean_worktree === true,
  };
}

export function tutorStubFirstDraftGatePossibility({ accepted = 0, completed = 0, total = 4, required = 3 } = {}) {
  const remaining = Math.max(0, Number(total) - Number(completed));
  const maximumPossibleAccepted = Number(accepted) + remaining;
  return {
    accepted: Number(accepted),
    completed: Number(completed),
    remaining,
    required: Number(required),
    maximumPossibleAccepted,
    possible: maximumPossibleAccepted >= Number(required),
    passed: Number(completed) === Number(total) && Number(accepted) >= Number(required),
  };
}

export function tutorStubStrictOriginalCandidateAccepted(accounting = null) {
  return Boolean(
    accounting?.finalDelivery?.source === 'original_candidate' &&
    accounting?.originalCandidate?.audits?.actorialRealizationAudit?.ok === true,
  );
}

function exactTextOccurrences(text, needle) {
  const haystack = String(text || '');
  const target = String(needle || '');
  if (!target) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= haystack.length - target.length) {
    const index = haystack.indexOf(target, offset);
    if (index < 0) break;
    count += 1;
    offset = index + target.length;
  }
  return count;
}

function hostSourceOccurrenceMetric({ row, bundle, generationField = 'structuredGeneration' }) {
  const frame = bundle?.frames?.dramaticRelease || null;
  const active = frame?.active === true;
  const entries = active && Array.isArray(frame?.entries) ? frame.entries : [];
  const composition = row?.[generationField]?.composition || null;
  const sourceSpans = Array.isArray(composition?.spans)
    ? composition.spans.filter((span) => span?.kind === 'source')
    : [];
  const expectedOccurrenceCount = active ? entries.length : 0;
  const declaredSourceCount = Number(composition?.sourceCount);
  const sourceSpanCount = sourceSpans.length;
  const hostOwnedSourceSpanCount = sourceSpans.filter((span) => span?.owner === 'host').length;
  const actualOccurrenceCount = active
    ? entries.reduce((sum, entry) => sum + exactTextOccurrences(composition?.text, entry?.surface), 0)
    : sourceSpans.length;
  return {
    turn: Number(row?.turn),
    active,
    expectedOccurrenceCount,
    declaredSourceCount: Number.isFinite(declaredSourceCount) ? declaredSourceCount : null,
    sourceSpanCount,
    hostOwnedSourceSpanCount,
    actualOccurrenceCount,
    ok:
      composition !== null &&
      (!active || entries.length > 0) &&
      declaredSourceCount === expectedOccurrenceCount &&
      sourceSpanCount === expectedOccurrenceCount &&
      (generationField !== 'jointPerformanceGeneration' || hostOwnedSourceSpanCount === expectedOccurrenceCount) &&
      actualOccurrenceCount === expectedOccurrenceCount,
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalJson(child)]),
    );
  }
  return value;
}

function exactlyEqualJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function canonicalSourceAccessibilityAudit({ contract, composition }) {
  if (!contract || !composition) return null;
  const spans = Array.isArray(composition.spans) ? composition.spans : [];
  const sourceSpans = spans.filter((span) => span?.kind === 'source');
  const compensationSpan = spans.find((span) => span?.id === 'performance_response') || null;
  return auditTutorStubSourceAccessibilityCompensation({
    contract,
    text: composition.text || '',
    owner: contract.owner || null,
    sourceSpan: sourceSpans.length === 1 ? sourceSpans[0] : null,
    compensationSpan,
  });
}

function exactAccessibilityAuditSpans({ contract, composition }) {
  const text = String(composition?.text || '');
  const spans = Array.isArray(composition?.spans) ? composition.spans : [];
  const sourceSpans = spans.filter((span) => span?.kind === 'source');
  const expectedSources = Array.isArray(contract?.sources) ? contract.sources : [];
  const performanceResponse = spans.find((span) => span?.id === 'performance_response') || null;
  const exactSpan = (span) =>
    Number.isInteger(span?.start) &&
    Number.isInteger(span?.end) &&
    span.start >= 0 &&
    span.end > span.start &&
    span.end <= text.length &&
    text.slice(span.start, span.end) === span.text;
  const sourceSpansExact =
    sourceSpans.length === expectedSources.length &&
    sourceSpans.every(
      (span, index) => span.owner === 'host' && exactSpan(span) && span.text === expectedSources[index]?.text,
    );
  const performanceResponseExact =
    performanceResponse?.kind === 'host' && performanceResponse?.owner === 'model' && exactSpan(performanceResponse);
  return {
    ok: sourceSpansExact && performanceResponseExact,
    sourceSpansExact,
    performanceResponseExact,
    sourceSpanCount: sourceSpans.length,
    expectedSourceSpanCount: expectedSources.length,
  };
}

function sourceSurfaceAccessibilityMetric({ row, bundle, generationField = 'structuredGeneration' }) {
  const release = bundle?.frames?.dramaticRelease || null;
  const expectedSourceCount = release?.active === true && Array.isArray(release.entries) ? release.entries.length : 0;
  const composition = row?.[generationField]?.composition || null;
  const sources = Array.isArray(composition?.sources) ? composition.sources : [];
  const configuration = bundle?.speakingResponseConfiguration || bundle?.selectedResponseConfiguration || {};
  const contract = sourceAccessibilityContract(bundle, composition);
  const rowRecordedAudit = row?.audit?.audits?.sourceAccessibilityAudit || null;
  const compositionRecordedAudit = composition?.sourceAccessibilityAudit || null;
  const canonicalAudit = canonicalSourceAccessibilityAudit({ contract, composition });
  const canonicalAuditSpans = exactAccessibilityAuditSpans({ contract, composition });
  const metrics = sources.map((source) => ({
    id: source?.id || null,
    mode: source?.mode || null,
    ...measureTutorStubSurfaceSentenceAccessibility({
      text: source?.text || source?.surface || '',
      audienceRegister: configuration.audience_register || null,
      lexicalAccessibility: configuration.lexical_accessibility || null,
    }),
  }));
  const sourceBearing = expectedSourceCount > 0;
  const exactInventory =
    composition !== null &&
    sources.length === expectedSourceCount &&
    (!contract || Number(contract.source_count) === expectedSourceCount);
  const directAccessible = contract?.direct_accessible ?? metrics.every((metric) => metric.ok === true);
  const compensationRequired = contract?.compensation_required === true;
  const compensationContractReady = contract?.compensation_contract_ready === true;
  const effectiveMode =
    canonicalAudit?.effective_mode || contract?.effective_mode || (directAccessible ? 'direct' : 'blocked');
  const contractOwner = contract?.owner || null;
  const auditOwner = canonicalAudit?.owner || null;
  const candidateAuditRequired = sourceBearing && Boolean(contract);
  const canonicalAuditSchemaValid = canonicalAudit?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA;
  const rowRecordedAuditSchemaValid = rowRecordedAudit?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA;
  const compositionRecordedAuditSchemaValid =
    compositionRecordedAudit?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA;
  const rowRecordedAuditConsistent = canonicalAuditSchemaValid && exactlyEqualJson(rowRecordedAudit, canonicalAudit);
  const compositionRecordedAuditConsistent =
    canonicalAuditSchemaValid && exactlyEqualJson(compositionRecordedAudit, canonicalAudit);
  const recordedAuditsConsistent =
    rowRecordedAuditConsistent &&
    compositionRecordedAuditConsistent &&
    exactlyEqualJson(rowRecordedAudit, compositionRecordedAudit);
  const immutableContract = bundle?.firstDraftContract?.evidence?.source_accessibility || null;
  const compositionContractConsistent =
    !candidateAuditRequired ||
    (immutableContract?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_CONTRACT_SCHEMA &&
      exactlyEqualJson(composition?.sourceAccessibilityContract, immutableContract));
  const candidateAuditPassed =
    !candidateAuditRequired ||
    (canonicalAuditSchemaValid &&
      canonicalAuditSpans.ok === true &&
      rowRecordedAuditSchemaValid &&
      compositionRecordedAuditSchemaValid &&
      recordedAuditsConsistent &&
      compositionContractConsistent &&
      canonicalAudit?.ok === true &&
      canonicalAudit?.visible === true &&
      canonicalAudit?.effective_mode === contract?.effective_mode &&
      (!compensationRequired || canonicalAudit?.owner === contractOwner));
  const compensationVisible = compensationRequired
    ? canonicalAudit?.ok === true &&
      canonicalAudit?.visible === true &&
      canonicalAudit?.effective_mode === 'compensated' &&
      auditOwner === contractOwner
    : null;
  const effectiveAccessibility = contract
    ? contract.ok === true &&
      (contract.effective_mode === 'direct'
        ? directAccessible === true && metrics.every((metric) => metric.ok === true)
        : contract.effective_mode === 'compensated'
          ? compensationContractReady && compensationVisible === true
          : false)
    : !sourceBearing || metrics.every((metric) => metric.ok === true);
  return {
    turn: Number(row?.turn),
    draw: Number(row?.draw ?? 1),
    sourceBearing,
    expectedSourceCount,
    actualSourceCount: sources.length,
    audienceRegister: configuration.audience_register || null,
    lexicalAccessibility: configuration.lexical_accessibility || null,
    sources: metrics,
    policy: contract?.policy || 'direct_only',
    directAccessible,
    compensationRequired,
    compensationContractReady,
    compensationVisible,
    effectiveMode,
    contractOwner,
    candidateAuditOwner: auditOwner,
    candidateAuditRequired,
    candidateAuditPassed,
    canonicalAudit,
    canonicalAuditSpans,
    canonicalAuditSchemaValid,
    rowRecordedAudit,
    rowRecordedAuditSchemaValid,
    rowRecordedAuditConsistent,
    compositionRecordedAudit,
    compositionRecordedAuditSchemaValid,
    compositionRecordedAuditConsistent,
    recordedAuditsConsistent,
    compositionContractConsistent,
    contractIssues: [...(contract?.issues || [])],
    ok: exactInventory && (!sourceBearing || (effectiveAccessibility && candidateAuditPassed)),
  };
}

function structuralActivationMetric({ target, row, bundle, declaration = {}, generationField }) {
  const composition = row?.[generationField]?.composition || null;
  const release = bundle?.frames?.dramaticRelease || null;
  const releaseEntries = release?.active === true && Array.isArray(release.entries) ? release.entries : [];
  const sources = Array.isArray(composition?.sources) ? composition.sources : [];
  const progression = bundle?.firstDraftContract?.progression || null;
  const progressionAudit = row?.audit?.audits?.turnProgressionAudit || null;
  const ownershipAudit = row?.audit?.audits?.jointPerformanceAudit || null;
  if (target === 'deterministic_host_source_renderer') {
    const expectedModes = declaration?.expected_modes || [];
    const actualModes = sources.map((source) => source?.mode || null);
    const active = releaseEntries.length > 0 && sources.length === releaseEntries.length;
    const modeMatched =
      expectedModes.length > 0 &&
      actualModes.length === releaseEntries.length &&
      actualModes.every((mode) => expectedModes.includes(mode));
    const sourceAccessibilityRequired = declaration?.require_lexical_accessibility_axis === true;
    const sourceAccessibility = sourceSurfaceAccessibilityMetric({
      row,
      bundle,
      generationField,
    });
    const sourceAccessibilityVisible = !sourceAccessibilityRequired || sourceAccessibility.ok === true;
    return {
      target,
      active,
      visible: active && modeMatched && sourceAccessibilityVisible,
      expectedModes,
      actualModes,
      sourceAccessibilityRequired,
      sourceAccessibility,
      sourceAccessibilityVisible,
    };
  }
  if (target === 'typed_due_source_action_referent') {
    const alignment = ownershipAudit?.sourceActionAlignment || null;
    const axis = ownershipAudit?.axes?.source_action_alignment || null;
    return {
      target,
      active: alignment?.active === true,
      visible: alignment?.active === true && alignment?.ok === true && axis?.visible === true,
      requiredReferents: (alignment?.sources || []).flatMap((source) => source?.required || []),
    };
  }
  if (target === 'source_accessibility_compensation') {
    const metric = sourceSurfaceAccessibilityMetric({ row, bundle, generationField });
    const expectedMode = declaration?.expected_effective_mode || 'compensated';
    const expectedOwner = declaration?.expected_owner || 'performance_response';
    const modeMatched = metric.effectiveMode === expectedMode;
    const ownerMatched = metric.contractOwner === expectedOwner && metric.candidateAuditOwner === expectedOwner;
    return {
      target,
      active:
        metric.sourceBearing === true &&
        metric.compensationRequired === true &&
        metric.compensationContractReady === true,
      visible: metric.ok === true && metric.compensationVisible === true && modeMatched && ownerMatched,
      expectedMode,
      effectiveMode: metric.effectiveMode,
      expectedOwner,
      contractOwner: metric.contractOwner,
      candidateAuditOwner: metric.candidateAuditOwner,
      directAccessible: metric.directAccessible,
      compensationRequired: metric.compensationRequired,
      compensationContractReady: metric.compensationContractReady,
      compensationVisible: metric.compensationVisible,
      sourceAccessibility: metric,
    };
  }
  if (target === 'handoff_contract_and_cross_slot_progression') {
    return {
      target,
      active:
        progression?.complete === true &&
        Boolean(progression?.handoff_contract?.mode) &&
        progressionAudit?.active === true,
      visible: progressionAudit?.ok === true,
      mode: progression?.handoff_contract?.mode || null,
    };
  }
  if (target === 'typed_turn_focus_relation') {
    const terms = progression?.handoff_contract?.required_target_terms || [];
    return {
      target,
      active: terms.length > 0 && progressionAudit?.active === true,
      visible: progressionAudit?.ok === true && progressionAudit?.handoff?.target_coverage?.count > 0,
      requiredTerms: terms,
      targetCoverage: progressionAudit?.handoff?.target_coverage || null,
    };
  }
  if (target === 'shared_writable_request_classifier') {
    return {
      target,
      active:
        progression?.learner_uptake?.mode === 'writable_entry' &&
        progressionAudit?.learner_uptake?.mode === 'writable_entry',
      visible: progressionAudit?.learner_uptake?.visible === true,
      mode: progressionAudit?.learner_uptake?.mode || null,
    };
  }
  return { target, active: false, visible: false, unsupported: true };
}

export function tutorStubFirstDraftIterationStopping({
  current = null,
  previous = null,
  maximumConsecutiveWithoutImprovement = 2,
  requireWorkingScreenPass = false,
} = {}) {
  const maximum = integer(maximumConsecutiveWithoutImprovement, 'maximum consecutive iterations without improvement', {
    minimum: 1,
  });
  if (!previous) {
    return {
      measurableImprovement: null,
      consecutiveWithoutImprovement: 0,
      maximumConsecutiveWithoutImprovement: maximum,
      stop: false,
      reason: 'first_measured_iteration',
    };
  }
  const currentCompleted = Number(current?.completedTurns || 0);
  const previousCompleted = Number(previous?.completedTurns || 0);
  const currentAccepted = Number(current?.originalCandidatesAccepted || 0);
  const previousAccepted = Number(previous?.originalCandidatesAccepted || 0);
  const currentRate = currentCompleted ? currentAccepted / currentCompleted : 0;
  const previousRate = previousCompleted ? previousAccepted / previousCompleted : 0;
  const currentConfigurationRealization = Number(current?.meanConfigurationRealization);
  const previousConfigurationRealization = Number(previous?.meanConfigurationRealization);
  const comparableCompletion = currentCompleted >= previousCompleted;
  const configurationRealizationImproved =
    comparableCompletion &&
    Number.isFinite(currentConfigurationRealization) &&
    Number.isFinite(previousConfigurationRealization) &&
    currentConfigurationRealization > previousConfigurationRealization;
  const comparableAcceptanceRateImproved = currentCompleted === previousCompleted && currentRate > previousRate;
  const comparableAcceptedCountImproved = comparableCompletion && currentAccepted > previousAccepted;
  const improved =
    comparableAcceptanceRateImproved ||
    comparableAcceptedCountImproved ||
    configurationRealizationImproved ||
    (comparableCompletion && Number(current?.safetyFailures || 0) < Number(previous?.safetyFailures || 0)) ||
    (comparableCompletion &&
      Number(current?.deterministicFallbacks || 0) < Number(previous?.deterministicFallbacks || 0));
  const consecutive = improved ? 0 : Number(previous?.stopping?.consecutiveWithoutImprovement || 0) + 1;
  const requiredPassMissed = requireWorkingScreenPass && current?.workingScreenPassed !== true;
  return {
    measurableImprovement: improved,
    configurationRealizationImproved,
    comparableCompletion,
    semanticRecognitionCorrections: Number(current?.semanticRecognitionCorrections || 0),
    consecutiveWithoutImprovement: consecutive,
    maximumConsecutiveWithoutImprovement: maximum,
    stop: requiredPassMissed || consecutive >= maximum,
    reason: requiredPassMissed
      ? 'predeclared_final_frontier_attempt_failed'
      : consecutive >= maximum
        ? 'two_consecutive_iterations_without_measurable_improvement'
        : improved
          ? 'improved'
          : 'no_improvement',
  };
}

export function summarizeTutorStubWorkingScreen({ cell, reports = [], config } = {}) {
  const requiredTurns = Number(config.gates_per_cell.required_turns);
  const requiredAccepted = Number(config.gates_per_cell.required_originals_accepted);
  const resultEntries = reports.flatMap((report) => {
    const bundles = Array.isArray(report.bundles) ? report.bundles : [];
    return (report.results || []).map((row) => ({
      row,
      bundle:
        bundles.find((bundle) => bundle?.turnId && bundle.turnId === row?.turnId) ||
        bundles.find((bundle) => Number(bundle?.turn) === Number(row?.turn)) ||
        null,
    }));
  });
  const results = resultEntries.map((entry) => entry.row);
  const tokenUsage = aggregateTokenUsage(results);
  const promptSizeReports = results.map((row) => row.promptSizeReport).filter(Boolean);
  const promptSize = summarizeTutorStubPromptSizeReports(promptSizeReports);
  const drawsPerPrefix = Number(
    config.gates_per_cell.required_draws_per_prefix ?? config.fixed_configuration?.draws_per_turn ?? 1,
  );
  const expectedDrawKeys = new Set(
    cell.turns.flatMap((turn) => Array.from({ length: drawsPerPrefix }, (_, index) => `${Number(turn)}:${index + 1}`)),
  );
  const observedDrawKeys = results.map((row) => `${Number(row.turn)}:${Number(row.draw ?? 1)}`);
  const uniqueObservedDrawKeys = new Set(observedDrawKeys);
  const drawInventory = {
    expected: [...expectedDrawKeys].sort(),
    observed: [...observedDrawKeys].sort(),
    duplicateKeys: [
      ...new Set(observedDrawKeys.filter((key, index) => observedDrawKeys.indexOf(key) !== index)),
    ].sort(),
    missingKeys: [...expectedDrawKeys].filter((key) => !uniqueObservedDrawKeys.has(key)).sort(),
    unexpectedKeys: [...uniqueObservedDrawKeys].filter((key) => !expectedDrawKeys.has(key)).sort(),
    bindingFailures: [],
  };
  if (config.execution?.require_exact_target_bundle_binding === true) {
    const binding = cell.targetBundle || cell.prefix_integrity?.target_bundle || {};
    const expectedProfile = cell.learnerProfile || cell.learner_profile;
    const expectedSeed = Number(cell.seed ?? cell.development_seed);
    const expectedSourceTrace = path.resolve(cell.sourceTrace || cell.source_trace);
    for (const report of reports) {
      if (path.resolve(String(report?.sourceTrace || '')) !== expectedSourceTrace) {
        drawInventory.bindingFailures.push('report:source_trace');
      }
    }
    for (const row of results) {
      const key = `${Number(row.turn)}:${Number(row.draw ?? 1)}`;
      for (const [field, actual, expected] of [
        ['world_id', row.worldId, binding.world || cell.world],
        ['learner_profile', row.learnerProfile, binding.learner_profile || expectedProfile],
        ['development_seed', Number(row.developmentSeed), expectedSeed],
        ['turn_id', row.turnId, binding.turn_id],
      ]) {
        if (actual !== expected) drawInventory.bindingFailures.push(`${key}:${field}`);
      }
    }
    drawInventory.bindingFailures = [...new Set(drawInventory.bindingFailures)].sort();
  }
  drawInventory.ok =
    drawInventory.duplicateKeys.length === 0 &&
    drawInventory.missingKeys.length === 0 &&
    drawInventory.unexpectedKeys.length === 0 &&
    drawInventory.bindingFailures.length === 0 &&
    observedDrawKeys.length === expectedDrawKeys.size;
  const reportMetric = (field, fallback = 0) => {
    const summaries = reports.map((report) => report?.summary).filter(Boolean);
    return summaries.some((summary) => Number.isFinite(Number(summary?.[field])))
      ? summaries.reduce((sum, summary) => sum + Number(summary?.[field] || 0), 0)
      : fallback;
  };
  const strictlyAccepted = (audit) => audit?.ok === true && audit?.audits?.actorialRealizationAudit?.ok === true;
  const accepted = results.filter((row) => strictlyAccepted(row.audit)).length;
  const deterministicAccepted = results.filter((row) => strictlyAccepted(row.deterministicAudit || row.audit)).length;
  const semanticCorrections = results.filter(
    (row) =>
      row.deterministicAudit?.audits?.actorialRealizationAudit?.ok === false &&
      row.audit?.audits?.actorialRealizationAudit?.ok === true,
  ).length;
  const safetyFailures = results.filter((row) => row.audit?.safetyFailure).length;
  const transcriptSpecificUptakeFailures = results.filter(
    (row) => row.audit?.audits?.responseCompositionAudit?.ok === false,
  ).length;
  const originalLatencies = results.map((row) => Number(row.latencyMs || 0));
  const configurationRealizationRates = results.map((row) =>
    Number(row.audit?.audits?.responseConfigurationAudit?.realization_rate || 0),
  );
  const configurationRealizationTotal = configurationRealizationRates.reduce((sum, rate) => sum + rate, 0);
  const meanConfigurationRealization = results.length ? configurationRealizationTotal / results.length : null;
  const minimumConfigurationRealization = Number(config.gates_per_cell.minimum_mean_configuration_realization || 0);
  const configurationRealizationEnforcement =
    config.gates_per_cell.configuration_realization_enforcement === 'report_only' ? 'report_only' : 'gate';
  const configurationRealizationIsGate = configurationRealizationEnforcement === 'gate';
  const adjudicationRows = results.filter((row) => row.semanticAdjudication?.called === true);
  const successfulAdjudicationRows = results.filter(
    (row) =>
      row.semanticAdjudication?.called === true &&
      !row.semanticAdjudication?.error &&
      row.semanticAdjudication?.adjudication,
  );
  const structuredGenerationEnabled = config.fixed_configuration?.structured_generation === true;
  const jointPerformanceGenerationEnabled = config.fixed_configuration?.joint_performance_generation === true;
  const compactSpeakerPromptEnabled = config.fixed_configuration?.compact_speaker_prompt === true;
  const typedGenerationEnabled = structuredGenerationEnabled || jointPerformanceGenerationEnabled;
  const generationField = jointPerformanceGenerationEnabled ? 'jointPerformanceGeneration' : 'structuredGeneration';
  const ownershipAuditField = jointPerformanceGenerationEnabled
    ? 'jointPerformanceAudit'
    : 'structuredSlotOwnershipAudit';
  const validStructuredOutputs = results.filter(
    (row) => row?.[generationField]?.ok === true && row?.[generationField]?.composition !== null,
  ).length;
  const structuredSlotOwnershipPasses = results.filter(
    (row) => row.audit?.audits?.[ownershipAuditField]?.ok === true,
  ).length;
  const structuredSourceOccurrences = resultEntries.map((entry) =>
    hostSourceOccurrenceMetric({ ...entry, generationField }),
  );
  const exactSourceOccurrencePasses = structuredSourceOccurrences.filter((metric) => metric.ok).length;
  const sourceSurfaceAccessibilities = resultEntries.map((entry) =>
    sourceSurfaceAccessibilityMetric({ ...entry, generationField }),
  );
  const sourceSurfaceAccessibilityPasses = sourceSurfaceAccessibilities.filter((metric) => metric.ok).length;
  const compactSpeakerPrompts = resultEntries.map(({ row, bundle }) => {
    const prompt = bundle?.compactSpeakingPrompt || null;
    const authoredTokens = prompt?.promptSize?.authoredTotal?.estimatedTokens ?? null;
    return {
      turn: Number(row?.turn),
      draw: Number(row?.draw ?? 1),
      schema: prompt?.schema || null,
      mode: prompt?.mode || null,
      publicHistoryPreservedExactly: prompt?.publicHistoryPreservedExactly === true,
      v2OutputShapePreserved: prompt?.v2OutputShapePreserved === true,
      noNewEvidence: prompt?.noNewEvidence === true,
      authoredEstimatedTokens: authoredTokens,
      ok:
        prompt?.schema === TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA &&
        prompt?.publicHistoryPreservedExactly === true &&
        prompt?.v2OutputShapePreserved === true &&
        prompt?.noNewEvidence === true &&
        Number.isFinite(Number(authoredTokens)) &&
        Number(authoredTokens) <= Number(prompt?.maxEstimatedTokens || 2500),
    };
  });
  const compactSpeakerPromptPasses = compactSpeakerPrompts.filter((metric) => metric.ok).length;
  const transportNormalizations = resultEntries.flatMap(({ row }) =>
    (row?.[generationField]?.parsed?.transport_normalizations || []).map((normalization) => ({
      turn: row.turn,
      turnId: row.turnId || null,
      draw: row.draw || null,
      ...normalization,
    })),
  );
  const transportNormalizedOutputs = results.filter(
    (row) => row?.[generationField]?.parsed?.transport_normalizations?.length > 0,
  ).length;
  const mechanicalRepairs = reportMetric('mechanicalRepairs');
  const modelRewrites = reportMetric('modelRewrites');
  const deterministicFallbacks = reportMetric('deterministicFallbacks');
  const reportedTransportNormalizedOutputs = reportMetric('transportNormalizedOutputs', transportNormalizedOutputs);
  const reportedTransportNormalizationCount = reportMetric(
    'transportNormalizationCount',
    transportNormalizations.length,
  );
  const structuralTargets = cell.structural_targets || [];
  const structuralTargetActivations = structuralTargets
    .map((target) => ({
      target,
      draws: resultEntries.map(({ row, bundle }) => ({
        turn: Number(row?.turn),
        draw: Number(row?.draw ?? 1),
        ...structuralActivationMetric({
          target,
          row,
          bundle,
          declaration: cell.structural_activation?.[target] || {},
          generationField,
        }),
      })),
    }))
    .map((entry) => ({
      ...entry,
      activeDraws: entry.draws.filter((draw) => draw.active).length,
      visibleDraws: entry.draws.filter((draw) => draw.visible).length,
      ok:
        entry.draws.length === results.length &&
        entry.draws.length > 0 &&
        entry.draws.every((draw) => draw.active && draw.visible),
    }));
  const failureCounts = new Map();
  for (const row of results) {
    // Original-only screening rejects a candidate when semantic recognition
    // does not clear an advisory performance miss, even though strict delivery
    // could expose that advisory draft. Count the actual screen failures here,
    // not only strict-delivery hard failures, so the development report does
    // not hide a repeated first-draft generation problem.
    for (const cluster of row.audit?.failureClusters || []) {
      failureCounts.set(cluster, Number(failureCounts.get(cluster) || 0) + 1);
    }
  }
  const originalPossibility = tutorStubFirstDraftGatePossibility({
    accepted,
    completed: results.length,
    total: requiredTurns,
    required: requiredAccepted,
  });
  const configurationMaximumPossibleMean =
    (configurationRealizationTotal + Math.max(0, requiredTurns - results.length)) / requiredTurns;
  const configurationPossibility = {
    enforcement: configurationRealizationEnforcement,
    observedTotal: configurationRealizationTotal,
    completed: results.length,
    remaining: Math.max(0, requiredTurns - results.length),
    requiredMean: minimumConfigurationRealization,
    maximumPossibleMean: configurationMaximumPossibleMean,
    possible: configurationMaximumPossibleMean >= minimumConfigurationRealization,
    passed: results.length === requiredTurns && meanConfigurationRealization >= minimumConfigurationRealization,
  };
  const possibility = {
    ...originalPossibility,
    originalAcceptance: originalPossibility,
    configurationRealization: configurationPossibility,
    possible: originalPossibility.possible && (!configurationRealizationIsGate || configurationPossibility.possible),
  };
  const gates = {
    drawInventory: drawInventory.ok,
    originalsAccepted: results.length === requiredTurns && accepted >= requiredAccepted,
    configurationRealization: !configurationRealizationIsGate || configurationPossibility.passed,
    safety: safetyFailures <= Number(config.gates_per_cell.maximum_safety_failures || 0),
    mechanicalRepairs: mechanicalRepairs <= Number(config.gates_per_cell.maximum_mechanical_repairs ?? 0),
    modelRewrites: modelRewrites <= Number(config.gates_per_cell.maximum_model_rewrites ?? 0),
    fallbacks: deterministicFallbacks <= Number(config.gates_per_cell.maximum_fallbacks ?? 0),
    semanticRecognitionCorrections:
      semanticCorrections <= Number(config.gates_per_cell.maximum_semantic_recognition_corrections ?? 0),
    semanticAdjudicatorCalls:
      adjudicationRows.length <=
      Number(config.gates_per_cell.maximum_semantic_adjudicator_calls ?? Number.MAX_SAFE_INTEGER),
    semanticAdjudicatorErrors:
      results.filter((row) => row.semanticAdjudication?.error).length <=
      Number(config.gates_per_cell.maximum_semantic_adjudicator_errors ?? Number.MAX_SAFE_INTEGER),
    successfulSemanticAdjudicationPerDraw:
      config.gates_per_cell.require_successful_semantic_adjudication_per_draw !== true ||
      successfulAdjudicationRows.length === results.length,
    deterministicOnlyAudit:
      config.gates_per_cell.require_deterministic_only_audit !== true ||
      (adjudicationRows.length === 0 &&
        results.every((row) => row.semanticAdjudication?.called !== true && !row.semanticAdjudication?.adjudication)),
    transportNormalizations:
      reportedTransportNormalizationCount <= Number(config.gates_per_cell.maximum_transport_normalizations ?? 0),
    transcriptSpecificUptake:
      config.gates_per_cell.require_transcript_specific_uptake !== true || transcriptSpecificUptakeFailures === 0,
    structuredOutput:
      config.gates_per_cell.require_structured_output !== true ||
      (structuredGenerationEnabled && validStructuredOutputs === results.length),
    structuredSlotOwnership:
      config.gates_per_cell.require_structured_slot_ownership !== true ||
      (structuredGenerationEnabled && structuredSlotOwnershipPasses === results.length),
    exactSourceOnce:
      config.gates_per_cell.require_exact_source_once !== true ||
      (structuredGenerationEnabled && exactSourceOccurrencePasses === results.length),
    jointPerformanceOutput:
      config.gates_per_cell.require_joint_performance_output !== true ||
      (jointPerformanceGenerationEnabled && validStructuredOutputs === results.length),
    jointPerformanceOwnership:
      config.gates_per_cell.require_joint_performance_ownership !== true ||
      (jointPerformanceGenerationEnabled && structuredSlotOwnershipPasses === results.length),
    compactSpeakerPrompt:
      config.gates_per_cell.require_compact_speaker_prompt !== true ||
      (compactSpeakerPromptEnabled && compactSpeakerPromptPasses === results.length),
    exactHostSourceOccurrences:
      config.gates_per_cell.require_exact_host_source_occurrences !== true ||
      (jointPerformanceGenerationEnabled && exactSourceOccurrencePasses === results.length),
    sourceSurfaceAccessibility:
      config.gates_per_cell.require_source_surface_accessibility !== true ||
      (typedGenerationEnabled && sourceSurfaceAccessibilityPasses === results.length),
    structuralTargetActivation:
      config.gates_per_cell.require_structural_target_activation !== true ||
      (structuralTargetActivations.length === structuralTargets.length &&
        structuralTargetActivations.every((target) => target.ok)),
  };
  return {
    id: cell.id,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    completedTurns: results.length,
    unstartedTurns: cell.turns.filter((turn) => !results.some((row) => Number(row.turn) === Number(turn))),
    originalCandidatesAccepted: accepted,
    originalCandidateAcceptanceRate: results.length ? accepted / results.length : null,
    deterministicOriginalCandidatesAccepted: deterministicAccepted,
    semanticRecognitionCorrections: semanticCorrections,
    semanticAdjudicatorCalls: adjudicationRows.length,
    successfulSemanticAdjudications: successfulAdjudicationRows.length,
    semanticAdjudicatorErrors: results.filter((row) => row.semanticAdjudication?.error).length,
    mechanicalRepairs,
    modelRewrites,
    deterministicFallbacks,
    transportNormalizedOutputs: reportedTransportNormalizedOutputs,
    transportNormalizationCount: reportedTransportNormalizationCount,
    transportNormalizations,
    drawInventory,
    safetyFailures,
    transcriptSpecificUptakeFailures,
    structuredModelOutputs: structuredGenerationEnabled ? results.length : 0,
    validStructuredOutputs: structuredGenerationEnabled ? validStructuredOutputs : 0,
    structuredOutputFailures: structuredGenerationEnabled ? results.length - validStructuredOutputs : 0,
    structuredSlotOwnershipPasses: structuredGenerationEnabled ? structuredSlotOwnershipPasses : 0,
    structuredSlotOwnershipFailures: structuredGenerationEnabled ? results.length - structuredSlotOwnershipPasses : 0,
    exactSourceOccurrencePasses: structuredGenerationEnabled ? exactSourceOccurrencePasses : 0,
    exactSourceOccurrenceFailures: structuredGenerationEnabled ? results.length - exactSourceOccurrencePasses : 0,
    structuredSourceOccurrences: structuredGenerationEnabled ? structuredSourceOccurrences : [],
    jointPerformanceModelOutputs: jointPerformanceGenerationEnabled ? results.length : 0,
    validJointPerformanceOutputs: jointPerformanceGenerationEnabled ? validStructuredOutputs : 0,
    jointPerformanceOutputFailures: jointPerformanceGenerationEnabled ? results.length - validStructuredOutputs : 0,
    jointPerformanceOwnershipPasses: jointPerformanceGenerationEnabled ? structuredSlotOwnershipPasses : 0,
    jointPerformanceOwnershipFailures: jointPerformanceGenerationEnabled
      ? results.length - structuredSlotOwnershipPasses
      : 0,
    compactSpeakerPromptPasses: compactSpeakerPromptEnabled ? compactSpeakerPromptPasses : 0,
    compactSpeakerPromptFailures: compactSpeakerPromptEnabled ? results.length - compactSpeakerPromptPasses : 0,
    compactSpeakerPrompts: compactSpeakerPromptEnabled ? compactSpeakerPrompts : [],
    exactHostSourceOccurrencePasses: jointPerformanceGenerationEnabled ? exactSourceOccurrencePasses : 0,
    exactHostSourceOccurrenceFailures: jointPerformanceGenerationEnabled
      ? results.length - exactSourceOccurrencePasses
      : 0,
    hostSourceOccurrences: typedGenerationEnabled ? structuredSourceOccurrences : [],
    sourceSurfaceAccessibilityPasses: typedGenerationEnabled ? sourceSurfaceAccessibilityPasses : 0,
    sourceSurfaceAccessibilityFailures: typedGenerationEnabled ? results.length - sourceSurfaceAccessibilityPasses : 0,
    sourceSurfaceAccessibilities: typedGenerationEnabled ? sourceSurfaceAccessibilities : [],
    structuralTargetActivations,
    meanConfigurationRealization,
    configurationRealizationEnforcement,
    meanOriginalLatencyMs: originalLatencies.length
      ? originalLatencies.reduce((sum, latency) => sum + latency, 0) / originalLatencies.length
      : null,
    meanTotalTutorLatencyMs: originalLatencies.length
      ? results.reduce(
          (sum, row) => sum + Number(row.latencyMs || 0) + Number(row.semanticAdjudication?.latencyMs || 0),
          0,
        ) / originalLatencies.length
      : null,
    tokenUsage: tokenUsageFields(tokenUsage),
    tokenUsageAvailable: tokenUsage.tokenUsageAvailable,
    promptSize,
    promptSizeReports,
    meanSemanticAdjudicationLatencyMs: adjudicationRows.length
      ? adjudicationRows.reduce((sum, row) => sum + Number(row.semanticAdjudication?.latencyMs || 0), 0) /
        adjudicationRows.length
      : null,
    dominantFailureClusters: [...failureCounts.entries()]
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((left, right) => right.count - left.count || left.cluster.localeCompare(right.cluster)),
    possibility,
    gates,
    status: Object.values(gates).every(Boolean)
      ? 'pass'
      : results.length === requiredTurns || !possibility.possible
        ? 'fail'
        : 'pending',
  };
}

export function assessTutorStubAcceptanceCell(summary, config) {
  const rows = (summary.rows || []).filter((row) => row.status === 'ok');
  const sum = (reader) => rows.reduce((total, row) => total + Number(reader(row) || 0), 0);
  const turns = sum((row) => row.turnCount);
  const declaredTurns = integer(config.fixed_configuration?.turns, 'fixed turns', { minimum: 1 });
  const reportedGuardTurns = sum((row) => row.guardAccounting?.turns);
  const accountedTurns = sum((row) => row.guardAccounting?.accountedTurns);
  const accountedTurnRate = turns ? accountedTurns / turns : null;
  const deliveredOriginal = sum((row) => row.guardAccounting?.originalCandidateAcceptedTurns);
  const strictOriginal = sum((row) => row.guardAccounting?.strictOriginalCandidateAcceptedTurns);
  const hostVisible = sum((row) => row.characterAdaptation?.hostVisibleTurns);
  const realization = rows.reduce(
    (total, row) =>
      total + Number(row.responseConfigurationVisibility?.mean_realization_rate || 0) * Number(row.turnCount || 0),
    0,
  );
  const hostParts = new Set(
    rows.flatMap((row) => Object.keys(row.characterAdaptation?.hostPartCounts || row.actorialPartCounts || {})),
  );
  const observed = {
    turns,
    declaredTurns,
    reportedGuardTurns,
    accountedTurns,
    accountedTurnRate,
    originalCandidatesDelivered: deliveredOriginal,
    originalCandidateDeliveryRate: turns ? deliveredOriginal / turns : null,
    strictOriginalCandidatesAccepted: strictOriginal,
    strictOriginalCandidateAcceptanceRate: turns ? strictOriginal / turns : null,
    // Compatibility aliases now intentionally name the stricter first-draft
    // measurement rather than ordinary safe delivery of an original draft.
    originalCandidatesAccepted: strictOriginal,
    originalCandidateAcceptanceRate: turns ? strictOriginal / turns : null,
    mechanicalRepairs: sum((row) => row.guardAccounting?.mechanicalRepairTurns),
    modelRewrites: sum((row) => row.guardAccounting?.modelRepairTurns),
    deterministicFallbacks: sum((row) => row.guardAccounting?.deterministicFallbackTurns),
    finalSafetyFailures: sum((row) => row.guardAccounting?.finalDeliveryAuditFailures),
    errorCount: Number(summary.aggregates?.errorCount || 0) + sum((row) => row.errorCount),
    quarantineCount: sum((row) => row.diagnosticCollection?.quarantineCount),
    metaPerformanceTurns: sum((row) => row.characterAdaptation?.metaPerformanceTurns),
    roleStageDirectionTurns: sum((row) => row.characterAdaptation?.roleStageDirectionTurns),
    sourceReplacementTurns: sum((row) => row.characterAdaptation?.sourceReplacementTurns),
    duplicateClueDeliveryTurns: sum((row) => row.characterAdaptation?.duplicateClueDeliveryTurns),
    hostVisibilityRate: turns ? hostVisible / turns : null,
    meanConfigurationRealization: turns ? realization / turns : null,
    distinctHostParts: hostParts.size,
    meanOriginalLatencyMs: turns ? sum((row) => row.guardAccounting?.totalOriginalCandidateLatencyMs) / turns : null,
    meanTotalTutorLatencyMs: turns ? sum((row) => row.guardAccounting?.totalTutorGenerationLatencyMs) / turns : null,
  };
  const strict = config.strict_delivery_gates_per_cell || {};
  const first = config.first_draft_gates || {};
  const gates = {
    complete: rows.length === 1 && turns === declaredTurns,
    accountedTurns:
      reportedGuardTurns === turns &&
      accountedTurns <= turns &&
      accountedTurnRate >= rate(first.minimum_accounted_turn_rate, 'minimum accounted turn rate'),
    finalSafety: observed.finalSafetyFailures === Number(strict.final_delivery_audit_failures || 0),
    fallback: observed.deterministicFallbacks <= Number(strict.maximum_deterministic_fallback_turns || 0),
    errors: observed.errorCount === Number(strict.error_count || 0),
    quarantine: observed.quarantineCount === Number(strict.quarantine_count || 0),
    metaPerformance: observed.metaPerformanceTurns === Number(strict.meta_performance_turns || 0),
    roleStageDirection: observed.roleStageDirectionTurns === Number(strict.role_stage_direction_turns || 0),
    sourceReplacement: observed.sourceReplacementTurns === Number(strict.source_replacement_turns || 0),
    duplicateClue: observed.duplicateClueDeliveryTurns === Number(strict.duplicate_clue_delivery_turns || 0),
    hostVisibility: observed.hostVisibilityRate >= Number(strict.minimum_host_visibility_rate || 0),
    configurationRealization:
      observed.meanConfigurationRealization >= Number(strict.minimum_mean_configuration_realization || 0),
    hostVariation: observed.distinctHostParts >= Number(strict.minimum_distinct_host_parts || 0),
    originalAcceptance:
      observed.originalCandidateAcceptanceRate >= Number(first.minimum_cell_original_candidate_acceptance_rate || 0),
    modelRewrite:
      observed.modelRewrites <= Number(first.maximum_model_rewrite_turns_per_cell ?? Number.MAX_SAFE_INTEGER),
  };
  return { observed, gates, status: Object.values(gates).every(Boolean) ? 'pass' : 'fail' };
}
