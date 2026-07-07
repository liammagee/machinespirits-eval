import fs from 'node:fs';

export const A21_ACTION_SET_SCHEMA = 'dramatic-derivation.a21.action-set.v0';
export const A21_ACTION_EXECUTION_SCHEMA = 'dramatic-derivation.a21.action-execution.v0';

export const A21_HETHEL_FIXTURE_ID = 'hethel-trigger-fixture';

export const A21_MOVE_FAMILIES = Object.freeze([
  'ask_diagnostic',
  'release_next_evidence',
  'repair_dependency',
  'consolidate_subproof',
  'invite_final_assertion',
  'block_assertion',
]);

const HETHEL_ACTIONS = Object.freeze([
  Object.freeze({
    actionId: 'A_DIAG_CONFLICT',
    moveFamily: 'ask_diagnostic',
    description: 'Ask the learner to name the public conflict or dead-predicate mismatch.',
    tutorInstruction:
      'Ask one short public diagnostic about what the learner thinks the current sign licenses. Do not release a new exhibit.',
    releaseDirectives: Object.freeze({
      releaseNow: Object.freeze([]),
      hold: Object.freeze(['p_point']),
      noLeak: Object.freeze(['secret solution', 'raw proof path', 'D arithmetic', 'hidden board state']),
    }),
    expectedStateChange: Object.freeze({
      diagnosticHistory: Object.freeze({ count: '+1' }),
      evidenceSeen: Object.freeze({ p_point: false }),
    }),
    knownRisks: Object.freeze([
      'May repeat the A20 maintenance pattern after diagnostic budget exhaustion.',
      'May increase frustration without decreasing proof distance.',
    ]),
    opportunityCost: Object.freeze({
      consumesTurn: true,
      delaysRelease: Object.freeze(['p_point']),
      mayIncreaseFrustration: true,
      mayLeak: false,
    }),
  }),
  Object.freeze({
    actionId: 'B_RELEASE_P_POINT',
    moveFamily: 'release_next_evidence',
    description: 'Release p_point now and ask the learner to use it in the next relation.',
    tutorInstruction:
      'Release the next public point now. Ask the learner to work only from that newly staged public piece.',
    releaseDirectives: Object.freeze({
      releaseNow: Object.freeze(['p_point']),
      hold: Object.freeze([]),
      noLeak: Object.freeze(['secret solution', 'raw proof path', 'D arithmetic', 'hidden board state']),
    }),
    expectedStateChange: Object.freeze({
      evidenceSeen: Object.freeze({ p_point: true }),
      proofProgress: Object.freeze({ D: 'decrease_or_remain_solvable' }),
    }),
    knownRisks: Object.freeze([
      'May advance before the dependency is owned.',
      'May leak if the tutor supplies the hidden relation rather than the public exhibit.',
    ]),
    opportunityCost: Object.freeze({
      consumesTurn: true,
      delaysRelease: Object.freeze([]),
      mayIncreaseFrustration: false,
      mayLeak: true,
    }),
  }),
  Object.freeze({
    actionId: 'C_RESTAGE_P_POINT',
    moveFamily: 'repair_dependency',
    description: 'Restage p_point as a dependency repair without changing the release schedule.',
    tutorInstruction:
      'Restage the already public point in plain language and ask the learner to put it in their own words.',
    releaseDirectives: Object.freeze({
      releaseNow: Object.freeze([]),
      hold: Object.freeze(['p_point']),
      noLeak: Object.freeze(['secret solution', 'raw proof path', 'D arithmetic', 'hidden board state']),
    }),
    expectedStateChange: Object.freeze({
      dependencyOwned: Object.freeze({ p_point: true }),
      dependencyEchoedOnly: Object.freeze({ p_point: false }),
    }),
    knownRisks: Object.freeze([
      'May be only a dressed-up consolidation move if p_point has not actually been seen.',
      'May delay release when release is already authorized.',
    ]),
    opportunityCost: Object.freeze({
      consumesTurn: true,
      delaysRelease: Object.freeze(['p_point']),
      mayIncreaseFrustration: false,
      mayLeak: false,
    }),
  }),
  Object.freeze({
    actionId: 'D_CONSOLIDATE_THEN_RELEASE',
    moveFamily: 'consolidate_subproof',
    description: 'Consolidate the current subproof, then authorize release only if consolidation succeeds.',
    tutorInstruction:
      'Ask the learner to restate the current dependency chain, then keep the next public point queued.',
    releaseDirectives: Object.freeze({
      releaseNow: Object.freeze([]),
      hold: Object.freeze(['p_point']),
      noLeak: Object.freeze(['secret solution', 'raw proof path', 'D arithmetic', 'hidden board state']),
    }),
    expectedStateChange: Object.freeze({
      confidence: 'increase_if_predecessor_owned',
    }),
    knownRisks: Object.freeze([
      'May become another maintenance move that delays proof advance.',
      'May not repair the target dependency unless the predecessor is already owned.',
    ]),
    opportunityCost: Object.freeze({
      consumesTurn: true,
      delaysRelease: Object.freeze(['p_point']),
      mayIncreaseFrustration: true,
      mayLeak: false,
    }),
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`a21.actionSet: ${label} must be an object`);
  }
  return value;
}

function validateAction(action) {
  requireObject(action, 'action');
  if (!action.actionId) throw new Error('a21.actionSet: action.actionId is required');
  if (!A21_MOVE_FAMILIES.includes(action.moveFamily)) {
    throw new Error(`a21.actionSet: unsupported move family ${JSON.stringify(action.moveFamily)}`);
  }
  if (!action.description || !action.tutorInstruction) {
    throw new Error(`a21.actionSet: ${action.actionId} needs description and tutorInstruction`);
  }
  requireObject(action.releaseDirectives, `${action.actionId}.releaseDirectives`);
  for (const key of ['releaseNow', 'hold', 'noLeak']) {
    if (!Array.isArray(action.releaseDirectives[key])) {
      throw new Error(`a21.actionSet: ${action.actionId}.releaseDirectives.${key} must be an array`);
    }
  }
  requireObject(action.opportunityCost, `${action.actionId}.opportunityCost`);
  return action;
}

export function defaultHethelActionSet({ fixtureId = A21_HETHEL_FIXTURE_ID } = {}) {
  return {
    schema: A21_ACTION_SET_SCHEMA,
    fixtureId,
    status: 'frozen_initial_candidate_set',
    winnerActionId: null,
    actions: clone(HETHEL_ACTIONS),
  };
}

export function validateA21ActionSet(actionSet, { expectedCount = 4 } = {}) {
  requireObject(actionSet, 'actionSet');
  if (actionSet.schema !== A21_ACTION_SET_SCHEMA) {
    throw new Error(`a21.actionSet: unsupported schema ${JSON.stringify(actionSet.schema)}`);
  }
  if (actionSet.winnerActionId) {
    throw new Error('a21.actionSet: fixture action set must not encode a winner');
  }
  if (!Array.isArray(actionSet.actions) || actionSet.actions.length !== expectedCount) {
    throw new Error(`a21.actionSet: expected exactly ${expectedCount} candidate actions`);
  }
  const seen = new Set();
  for (const action of actionSet.actions) {
    validateAction(action);
    if (seen.has(action.actionId)) throw new Error(`a21.actionSet: duplicate action ${action.actionId}`);
    seen.add(action.actionId);
  }
  return actionSet;
}

export function loadActionSet(source = A21_HETHEL_FIXTURE_ID) {
  if (source && typeof source === 'object') {
    return validateA21ActionSet(clone(source));
  }
  if (typeof source === 'string' && source.endsWith('.json')) {
    return validateA21ActionSet(JSON.parse(fs.readFileSync(source, 'utf8')));
  }
  if (typeof source === 'string' && /hethel/i.test(source)) {
    return validateA21ActionSet(defaultHethelActionSet({ fixtureId: source }));
  }
  throw new Error(`a21.actionSet: unknown action-set source ${JSON.stringify(source)}`);
}

export function getA21Action(actionSet, actionId) {
  const loaded = validateA21ActionSet(actionSet);
  const action = loaded.actions.find((candidate) => candidate.actionId === actionId);
  if (!action) throw new Error(`a21.actionSet: unknown action ${JSON.stringify(actionId)}`);
  return clone(action);
}

export function executeA21Action(action, { assignmentProbability = null, trialId = null, turn = null } = {}) {
  const selected = clone(validateAction(action));
  const releaseInfo = {
    releaseNow: [...selected.releaseDirectives.releaseNow],
    hold: [...selected.releaseDirectives.hold],
    noLeak: [...selected.releaseDirectives.noLeak],
    turn,
    authorizedNow: true,
  };
  return {
    schema: A21_ACTION_EXECUTION_SCHEMA,
    trialId,
    actionId: selected.actionId,
    moveFamily: selected.moveFamily,
    tutorText: selected.tutorInstruction,
    releaseInfo,
    actionLog: {
      actionId: selected.actionId,
      moveFamily: selected.moveFamily,
      assignmentProbability,
    },
  };
}
