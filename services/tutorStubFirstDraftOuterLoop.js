import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { loadTutorStubFirstDraftCampaign, validateTutorStubFirstDraftCampaign } from './tutorStubFirstDraftCampaign.js';

export const TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA = 'machinespirits.tutor-stub.first-draft-outer-loop.v1';

const REQUIRED_STATES = Object.freeze({
  awaiting_working_screen: { terminalScope: 'none', outcome: 'pending' },
  working_predeclared: { terminalScope: 'none', outcome: 'pending' },
  working_running: { terminalScope: 'none', outcome: 'pending' },
  working_passed: { terminalScope: 'none', outcome: 'pending' },
  acceptance_predeclared: { terminalScope: 'none', outcome: 'pending' },
  hard_cell_running: { terminalScope: 'none', outcome: 'pending' },
  remaining_cells_running: { terminalScope: 'none', outcome: 'pending' },
  accepted: { terminalScope: 'loop', outcome: 'success' },
  stagnated: { terminalScope: 'loop', outcome: 'no_progress' },
  blocked_infrastructure: { terminalScope: 'loop', outcome: 'infrastructure' },
  retired_after_acceptance_failure: { terminalScope: 'version', outcome: 'acceptance_failure' },
});

const REQUIRED_TRANSITIONS = Object.freeze([
  ['awaiting_working_screen', 'working_predeclared'],
  ['working_predeclared', 'working_running'],
  ['working_running', 'working_predeclared'],
  ['working_running', 'working_passed'],
  ['working_running', 'stagnated'],
  ['working_running', 'blocked_infrastructure'],
  ['working_passed', 'acceptance_predeclared'],
  ['acceptance_predeclared', 'hard_cell_running'],
  ['acceptance_predeclared', 'blocked_infrastructure'],
  ['hard_cell_running', 'remaining_cells_running'],
  ['hard_cell_running', 'retired_after_acceptance_failure'],
  ['hard_cell_running', 'blocked_infrastructure'],
  ['remaining_cells_running', 'accepted'],
  ['remaining_cells_running', 'retired_after_acceptance_failure'],
  ['remaining_cells_running', 'blocked_infrastructure'],
  ['retired_after_acceptance_failure', 'working_predeclared'],
]);

const REQUIRED_REVIEW_RESPONSIBILITIES = Object.freeze([
  'observe_evidence',
  'select_single_bounded_change',
  'generate_original_candidate',
  'deterministic_audit',
  'semantic_recognition_review',
  'verify_gates',
  'record_provenance',
]);

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function absolute(root, value) {
  const normalized = requiredString(value, 'path');
  return path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
}

function expect(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function validateStateMachine(manifest) {
  const states = manifest.state_machine?.states || {};
  for (const [id, requirement] of Object.entries(REQUIRED_STATES)) {
    const state = states[id];
    if (!state) throw new Error(`state machine is missing ${id}`);
    expect(state.terminal_scope, requirement.terminalScope, `${id} terminal scope`);
    expect(state.outcome, requirement.outcome, `${id} outcome`);
  }

  const currentState = requiredString(manifest.current?.state, 'current state');
  if (!states[currentState]) throw new Error(`current state is not declared: ${currentState}`);

  const transitions = Array.isArray(manifest.state_machine?.transitions) ? manifest.state_machine.transitions : [];
  const pairs = new Set();
  for (const transition of transitions) {
    const from = requiredString(transition.from, 'transition from');
    const to = requiredString(transition.to, 'transition to');
    if (!states[from] || !states[to]) throw new Error(`transition references an unknown state: ${from} -> ${to}`);
    requiredString(transition.when, `${from} -> ${to} condition`);
    const key = `${from}|${to}`;
    if (pairs.has(key)) throw new Error(`duplicate transition ${from} -> ${to}`);
    pairs.add(key);
  }
  for (const [from, to] of REQUIRED_TRANSITIONS) {
    if (!pairs.has(`${from}|${to}`)) throw new Error(`state machine is missing transition ${from} -> ${to}`);
  }

  const advance = transitions.find(
    (transition) => transition.from === 'retired_after_acceptance_failure' && transition.to === 'working_predeclared',
  );
  expect(advance?.version_action, 'increment_by_one', 'retired-version transition action');

  return { states, transitions, currentState };
}

function validateVersioning(manifest) {
  const currentVersion = integer(manifest.current?.campaign_version, 'current campaign version', { minimum: 1 });
  expect(manifest.current?.label, `V${currentVersion}`, 'current version label');
  expect(manifest.versioning?.current, currentVersion, 'versioning current');
  expect(manifest.versioning?.next, currentVersion + 1, 'versioning next');
  expect(manifest.versioning?.increment, 1, 'version increment');
  expect(manifest.versioning?.unbounded, true, 'unbounded version progression');
  expect(manifest.versioning?.acceptance_version_immutable_after_first_paid_call, true, 'acceptance immutability');
  expect(manifest.versioning?.tuning_after_observation_retires_entire_version, true, 'version retirement rule');

  const examples = Array.isArray(manifest.versioning?.examples) ? manifest.versioning.examples : [];
  if (examples.length < 3) throw new Error('versioning must show at least three Vn -> Vn+1 examples');
  for (const example of examples) {
    const from = integer(example.from, 'version example from', { minimum: 1 });
    const to = integer(example.to, 'version example to', { minimum: 1 });
    if (to !== from + 1) throw new Error(`version example must increment by one: V${from} -> V${to}`);
  }
  return currentVersion;
}

function validateReviewRoles(manifest) {
  const roles = Array.isArray(manifest.inner_review_roles) ? manifest.inner_review_roles : [];
  if (!roles.length) throw new Error('inner review roles are required');
  const ids = new Set();
  const responsibilities = new Set();
  for (const role of roles) {
    const id = requiredString(role.id, 'inner review role id');
    if (ids.has(id)) throw new Error(`duplicate inner review role ${id}`);
    ids.add(id);
    requiredString(role.authority, `${id} authority`);
    const owned = Array.isArray(role.responsibilities) ? role.responsibilities : [];
    if (!owned.length) throw new Error(`${id} must own at least one responsibility`);
    for (const responsibility of owned) responsibilities.add(requiredString(responsibility, `${id} responsibility`));
  }
  for (const responsibility of REQUIRED_REVIEW_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      throw new Error(`inner review roles do not assign ${responsibility}`);
    }
  }
  return roles;
}

function validateSeedLedger(manifest) {
  expect(manifest.seed_rules?.global_ledger_required, true, 'global seed ledger requirement');
  expect(manifest.seed_rules?.same_seed_retry_only_before_any_candidate_or_result, true, 'same-seed retry rule');
  expect(manifest.seed_rules?.tuning_retires_active_unstarted_and_reserve_seeds, true, 'seed retirement rule');
  expect(manifest.seed_rules?.fresh_acceptance_seeds_predeclared_before_paid_calls, true, 'seed predeclaration rule');

  const ledger = manifest.seed_ledger || {};
  const development = Array.isArray(ledger.development) ? ledger.development : [];
  if (!development.length) throw new Error('development seed ledger is empty');
  const historical = Array.isArray(ledger.historical) ? ledger.historical : [];
  const heldOut = Array.isArray(ledger.held_out?.entries) ? ledger.held_out.entries : [];
  const reserves = Array.isArray(ledger.reserve?.entries) ? ledger.reserve.entries : [];
  const seen = new Set();
  for (const entry of [...historical, ...development, ...heldOut, ...reserves]) {
    const seed = integer(entry.seed, 'seed ledger entry', { minimum: 1 });
    if (seen.has(seed)) throw new Error(`seed appears more than once in the ledger: ${seed}`);
    seen.add(seed);
    requiredString(entry.status, `seed ${seed} status`);
  }
  for (const entry of development) {
    expect(entry.status, 'reusable_non_held_out_development', `development seed ${entry.seed} status`);
  }

  if (manifest.current?.state === 'working_predeclared') {
    expect(manifest.current?.acceptance_config, null, 'acceptance config before working-screen pass');
    expect(ledger.held_out?.status, 'not_predeclared', 'held-out seed status before working-screen pass');
    expect(ledger.reserve?.status, 'not_predeclared', 'reserve seed status before working-screen pass');
    if (heldOut.length || reserves.length) {
      throw new Error('V24 held-out and reserve seeds must remain empty until acceptance is predeclared');
    }
  }
  return { development, historical, heldOut, reserves };
}

function validateWorkingScreen(manifest, { root }) {
  const configPath = absolute(root, manifest.current?.working_screen_config);
  if (!fs.existsSync(configPath)) throw new Error(`working screen config is missing: ${configPath}`);
  const loaded = loadTutorStubFirstDraftCampaign(configPath, { root });
  const validation = validateTutorStubFirstDraftCampaign({ config: loaded.config, root });
  if (validation.kind !== 'working_screen') throw new Error('outer loop working config is not a working screen');

  const config = loaded.config;
  expect(config.id, manifest.current?.working_screen_id, 'working screen id');
  expect(config.held_out, false, 'working screen held-out flag');
  expect(config.fixed_configuration?.original_only, true, 'working screen original-only mode');
  expect(config.fixed_configuration?.draws_per_turn, 1, 'working screen draws per turn');
  expect(config.fixed_configuration?.concurrency, 1, 'working screen concurrency');
  expect(config.gates_per_cell?.required_turns, 4, 'working screen required turns');
  expect(config.gates_per_cell?.required_originals_accepted, 4, 'working screen required originals');
  expect(config.gates_per_cell?.minimum_mean_configuration_realization, 1, 'working screen configuration realization');
  expect(config.gates_per_cell?.configuration_realization_enforcement, 'gate', 'configuration realization enforcement');
  expect(config.gates_per_cell?.maximum_safety_failures, 0, 'working screen safety failures');
  expect(config.gates_per_cell?.maximum_fallbacks, 0, 'working screen fallbacks');
  expect(config.gates_per_cell?.require_transcript_specific_uptake, true, 'working screen uptake gate');
  if (config.matrix.length !== 1) throw new Error('V3 working screen must contain exactly one focused cell');

  const cell = config.matrix[0];
  const ledgerEntry = (manifest.seed_ledger?.development || []).find(
    (entry) => Number(entry.seed) === Number(cell.development_seed),
  );
  if (!ledgerEntry) throw new Error(`working seed ${cell.development_seed} is absent from the outer-loop ledger`);
  expect(ledgerEntry.cell, cell.id, `working seed ${cell.development_seed} cell binding`);

  return {
    configPath,
    id: config.id,
    cell: cell.id,
    turns: cell.turns.map(Number),
    developmentSeed: Number(cell.development_seed),
    gates: {
      requiredOriginalsAccepted: 4,
      requiredTurns: 4,
      minimumMeanConfigurationRealization: 1,
      maximumSafetyFailures: 0,
      maximumFallbacks: 0,
      requireTranscriptSpecificUptake: true,
    },
  };
}

export function loadTutorStubFirstDraftOuterLoop(manifestPath, { root = process.cwd() } = {}) {
  const resolvedPath = absolute(root, manifestPath);
  const manifest = YAML.parse(fs.readFileSync(resolvedPath, 'utf8')) || {};
  return { manifest, manifestPath: resolvedPath, root: path.resolve(root) };
}

export function validateTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  expect(manifest?.schema, TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA, 'outer-loop schema');
  const id = requiredString(manifest.id, 'outer-loop id');
  const currentVersion = validateVersioning(manifest);
  const state = validateStateMachine(manifest);
  const workingIteration = integer(manifest.current?.working_iteration, 'working iteration', { minimum: 1 });
  if (state.currentState === 'working_predeclared' && workingIteration > 1) {
    expect(manifest.current?.last_observation?.version, currentVersion, 'last working observation version');
    expect(
      manifest.current?.last_observation?.working_iteration,
      workingIteration - 1,
      'last working observation iteration',
    );
    if (typeof manifest.current?.last_observation?.comparison?.measurable_improvement !== 'boolean') {
      throw new Error('last working observation must record whether improvement was measurable');
    }
    integer(
      manifest.current?.last_observation?.comparison?.consecutive_without_improvement,
      'consecutive working iterations without improvement',
    );
  }
  const roles = validateReviewRoles(manifest);
  const seeds = validateSeedLedger(manifest);
  const workingScreen = validateWorkingScreen(manifest, { root });

  expect(manifest.stop_policy?.stagnation?.maximum_consecutive_iterations_without_improvement, 2, 'stagnation limit');
  expect(manifest.stop_policy?.stagnation?.terminal_state, 'stagnated', 'stagnation terminal state');
  expect(manifest.stop_policy?.success?.terminal_state, 'accepted', 'success terminal state');
  expect(
    manifest.stop_policy?.infrastructure?.terminal_state,
    'blocked_infrastructure',
    'infrastructure terminal state',
  );
  expect(
    manifest.stop_policy?.acceptance_failure?.terminal_state,
    'retired_after_acceptance_failure',
    'acceptance-failure state',
  );
  if (
    !(manifest.stop_policy?.stagnation?.measurable_improvement_order || []).includes(
      'higher mean configuration realization',
    )
  ) {
    throw new Error('stagnation policy must count higher mean configuration realization as improvement');
  }

  return {
    schema: TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA,
    id,
    valid: true,
    currentVersion,
    currentState: state.currentState,
    workingIteration,
    terminalScope: state.states[state.currentState].terminal_scope,
    outcome: state.states[state.currentState].outcome,
    acceptancePredeclared: Boolean(manifest.current.acceptance_config),
    roles: roles.map((role) => role.id),
    seedCounts: {
      historical: seeds.historical.length,
      development: seeds.development.length,
      heldOut: seeds.heldOut.length,
      reserve: seeds.reserves.length,
    },
    workingScreen,
  };
}

export function summarizeTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root });
  const states = manifest.state_machine.states;
  const next = manifest.state_machine.transitions
    .filter((transition) => transition.from === validation.currentState)
    .map((transition) => ({
      state: transition.to,
      terminalScope: states[transition.to].terminal_scope,
      when: transition.when,
      versionAction: transition.version_action || 'none',
    }));
  return {
    ...validation,
    generatedAt: new Date().toISOString(),
    makesModelCalls: false,
    label: manifest.current.label,
    workingIteration: Number(manifest.current.working_iteration || 1),
    heldOutMatrixStatus: manifest.seed_ledger.held_out.status,
    reserveSeedStatus: manifest.seed_ledger.reserve.status,
    developmentSeeds: manifest.seed_ledger.development.map((entry) => ({
      seed: Number(entry.seed),
      cell: entry.cell,
      status: entry.status,
    })),
    next,
  };
}
