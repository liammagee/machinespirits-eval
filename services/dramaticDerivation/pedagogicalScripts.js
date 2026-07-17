export const PEDAGOGICAL_SCRIPT_SCHEMA = 'machinespirits.derivation.pedagogical-script.v1';

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function freezeStage(stage) {
  return Object.freeze({
    id: stage.id,
    entryConditions: freezeArray(stage.entryConditions),
    exitConditions: freezeArray(stage.exitConditions),
    preferredMoves: freezeArray(stage.preferredMoves),
    antiPatterns: freezeArray(stage.antiPatterns),
    expectedFieldMovement: Object.freeze({ ...(stage.expectedFieldMovement || {}) }),
  });
}

function normalizeScript(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pedagogicalScripts: script must be an object');
  }
  if (!raw.id || typeof raw.id !== 'string') {
    throw new Error('pedagogicalScripts: script.id must be a non-empty string');
  }
  const stages = (raw.stages || []).map((stage) => {
    if (typeof stage === 'string') return freezeStage({ id: stage });
    if (!stage || typeof stage !== 'object' || !stage.id) {
      throw new Error(`pedagogicalScripts: invalid stage in ${raw.id}`);
    }
    return freezeStage(stage);
  });
  if (!stages.length) throw new Error(`pedagogicalScripts: script ${raw.id} must define stages`);
  const stageIds = stages.map((stage) => stage.id);
  return Object.freeze({
    schema: PEDAGOGICAL_SCRIPT_SCHEMA,
    id: raw.id,
    description: raw.description || '',
    stages: Object.freeze(stages),
    stageIds: freezeArray(stageIds),
    entryConditions: freezeArray(raw.entryConditions),
    exitConditions: freezeArray(raw.exitConditions),
    preferredMoves: freezeArray(raw.preferredMoves),
    antiPatterns: freezeArray(raw.antiPatterns),
    expectedFieldMovement: Object.freeze({ ...(raw.expectedFieldMovement || {}) }),
  });
}

export const DEFAULT_PEDAGOGICAL_SCRIPT = normalizeScript({
  id: 'prediction_failure_repair_generalisation_transfer',
  description:
    'Default guided-discovery arc: open a hypothesis space, let local failure become visible, repair the dependency, generalise the proof relation, then invite transfer or closure.',
  entryConditions: ['learner has a public question and an incomplete evidence board'],
  exitConditions: ['learner can state the target from public support or identify the remaining missing support'],
  preferredMoves: ['ask_diagnostic', 'consolidate_subproof', 'release_next_evidence', 'invite_final_assertion'],
  antiPatterns: ['release_uncertified_evidence', 'answer_for_learner', 'continue_after_public_closure'],
  expectedFieldMovement: {
    learner: 'mastery and evidence grounding rise without unsupported assertion',
    tutor: 'diagnostic uncertainty decreases as public evidence accumulates',
    discourse: 'shared vocabulary and commitments become more explicit',
    joint: 'trajectory risk falls while coupling and momentum remain stable',
  },
  stages: [
    {
      id: 'prediction',
      entryConditions: ['the learner has not yet committed to a supported local route'],
      exitConditions: ['the learner makes a testable hypothesis or a public premise is introduced'],
      preferredMoves: ['ask_diagnostic', 'release_next_evidence'],
      antiPatterns: ['invite_final_assertion', 'block_assertion'],
      expectedFieldMovement: {
        learner: 'engagement and productive uncertainty rise',
        discourse: 'open questions and concept introduction rise',
        joint: 'coupling begins without forcing closure',
      },
    },
    {
      id: 'failure',
      entryConditions: ['a misconception, unsupported leap, or high-risk drift is visible'],
      exitConditions: ['the learner can name the boundary of the wrong route'],
      preferredMoves: ['ask_scope_test', 'ask_diagnostic', 'repair_recognition_rupture'],
      antiPatterns: ['release_next_evidence', 'invite_final_assertion'],
      expectedFieldMovement: {
        learner: 'misconception risk falls and productive confusion stays usable',
        discourse: 'open questions become bounded rather than multiplying',
        joint: 'trajectory risk falls without collapsing rapport',
      },
    },
    {
      id: 'repair',
      entryConditions: ['a proof-critical dependency or local ownership gap is active'],
      exitConditions: ['the learner re-seats the dependency or can teach it back'],
      preferredMoves: ['repair_dependency', 'consolidate_subproof', 'decompose_subtask'],
      antiPatterns: ['release_next_evidence', 'invite_final_assertion'],
      expectedFieldMovement: {
        learner: 'evidence grounding and mastery rise on the current object',
        tutor: 'diagnostic confidence rises as the dependency is restored',
        joint: 'alignment rises and trajectory risk falls',
      },
    },
    {
      id: 'generalisation',
      entryConditions: ['local support is owned enough to connect across the proof route'],
      exitConditions: ['the learner can move from local support to the target relation'],
      preferredMoves: ['consolidate_subproof', 'purpose_bridge', 'invite_final_assertion'],
      antiPatterns: ['ask_diagnostic', 'repair_vocabulary'],
      expectedFieldMovement: {
        learner: 'mastery and commitment strength rise',
        discourse: 'explanatory structure becomes more explicit',
        joint: 'script progress and interaction momentum rise',
      },
    },
    {
      id: 'transfer',
      entryConditions: ['the public board can support closure or near-closure'],
      exitConditions: ['the learner asserts from support or carries the pattern to a new object'],
      preferredMoves: ['invite_final_assertion', 'minimal_presence', 'consolidate_subproof'],
      antiPatterns: ['release_next_evidence', 'ask_diagnostic'],
      expectedFieldMovement: {
        learner: 'ownership is expressed as supported assertion',
        discourse: 'commitment strength rises while open questions fall',
        joint: 'script progress reaches closure without a lucky leap',
      },
    },
  ],
});

const SCRIPT_REGISTRY = new Map([[DEFAULT_PEDAGOGICAL_SCRIPT.id, DEFAULT_PEDAGOGICAL_SCRIPT]]);

export function registerPedagogicalScript(script) {
  const normalized = normalizeScript(script);
  SCRIPT_REGISTRY.set(normalized.id, normalized);
  return normalized;
}

export function resolvePedagogicalScript(script = null) {
  if (!script) return DEFAULT_PEDAGOGICAL_SCRIPT;
  if (typeof script === 'string') return SCRIPT_REGISTRY.get(script) || DEFAULT_PEDAGOGICAL_SCRIPT;
  if (script.id && SCRIPT_REGISTRY.has(script.id)) return SCRIPT_REGISTRY.get(script.id);
  return normalizeScript(script);
}

export function pedagogicalScriptStageIds(script = DEFAULT_PEDAGOGICAL_SCRIPT) {
  return script.stageIds || (script.stages || []).map((stage) => (typeof stage === 'string' ? stage : stage.id));
}

export function pedagogicalScriptStageSpec(script, stageId) {
  return (script.stages || []).find((stage) => (typeof stage === 'string' ? stage : stage.id) === stageId) || null;
}

export function listPedagogicalScripts() {
  return [...SCRIPT_REGISTRY.values()].map((script) => ({
    id: script.id,
    description: script.description,
    stageIds: pedagogicalScriptStageIds(script),
  }));
}
