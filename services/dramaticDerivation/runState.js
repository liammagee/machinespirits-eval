import { factKey } from './chainer.js';
import { normalizeDecayConfig, mulberry32 } from './corruption.js';
import { buildWorldIR } from './guardCompiler.js';
import { buildLemmaDag, normalizeLemmaConfig } from './lemmaLayer.js';
import { buildChainMap, buildRegionLexicons } from './messageClassifier.js';
import { deriveOpportunityCostBudget } from './opportunityCost.js';
import { normalizeRegisterRouterConfig } from './registerRouter.js';
import { normalizeSceneConfig } from './rhetoricalMovePolicy.js';
import { createRuntimeMonitor } from './runtimeMonitor.js';
import { normalizeStrategyLedgerConfig } from './strategyLedger.js';

const ACTS_DEFAULTS = Object.freeze({
  minActTurns: 3,
  maxActTurns: 8,
});

const DIRECTOR_CADENCES = new Set(['turn', 'scene', 'release']);
const PUBLIC_REGISTERS = new Set(['default', 'modern', 'period']);

export function isPublicRegister(value) {
  return PUBLIC_REGISTERS.has(value);
}

export function normalizeDirectorCadence(raw, { sceneMode = false } = {}) {
  if (raw == null || raw === '') return sceneMode ? 'scene' : 'turn';
  if (typeof raw !== 'string') {
    throw new Error(`director cadence must be one of turn, scene, release (got ${JSON.stringify(raw)})`);
  }
  const cadence = raw.trim().toLowerCase();
  if (!DIRECTOR_CADENCES.has(cadence)) {
    throw new Error(`director cadence must be one of turn, scene, release (got ${JSON.stringify(raw)})`);
  }
  return cadence;
}

function isDynamicPublicRegisterPlan(plan) {
  return Boolean(plan && typeof plan === 'object' && plan.mode === 'sample');
}

function staticPublicRegister(plan) {
  return PUBLIC_REGISTERS.has(plan)
    ? plan
    : isDynamicPublicRegisterPlan(plan)
      ? plan.base || plan.palette?.[0] || 'modern'
      : 'default';
}

function hashUnit(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function weightedRegisterPick(plan, key, previous = null) {
  const entries = plan.palette.map((register, i) => ({ register, weight: Number(plan.weights[i]) || 1 }));
  const pick = (choices, unit) => {
    const total = choices.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = unit * total;
    for (const entry of choices) {
      cursor -= entry.weight;
      if (cursor <= 0) return entry.register;
    }
    return choices[choices.length - 1].register;
  };
  let selected = pick(entries, hashUnit(key));
  if (previous && selected === previous && entries.length > 1) {
    selected = pick(
      entries.filter((entry) => entry.register !== previous),
      hashUnit(`${key}:alternate`),
    );
  }
  return selected;
}

export function normalizeStagePrologue(raw, world) {
  const field = (...names) => {
    for (const name of names) {
      if (typeof raw?.[name] === 'string' && raw[name].trim()) return raw[name].trim();
    }
    return '';
  };
  return {
    stageNotes:
      field('stageNotes', 'stage_notes') ||
      `[Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}]`,
    tutorCharacter:
      field('tutorCharacter', 'tutor_character') ||
      'The tutor enters as a careful guide who must let the learner make the decisive step.',
    learnerCharacter:
      field('learnerCharacter', 'learner_character') ||
      'The learner enters as curious, fallible, and entitled to test each claim before keeping it.',
    registerNote:
      field('registerNote', 'register_note') ||
      'Register should follow these characters and this world, never a generic period costume.',
  };
}

/**
 * Validate and default an acts config (stage v2). Accepts an object or a
 * JSON string (the CLI's `--acts '<json>'`). Unknown keys are rejected.
 */
export function normalizeActsConfig(raw) {
  let cfg = raw;
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`acts config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('acts config must be a JSON object, e.g. {"minActTurns":3,"maxActTurns":8}');
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in ACTS_DEFAULTS)) {
      throw new Error(`acts config: unknown key "${key}" (known: ${Object.keys(ACTS_DEFAULTS).join(', ')})`);
    }
  }
  const out = { ...ACTS_DEFAULTS, ...cfg };
  for (const name of ['minActTurns', 'maxActTurns']) {
    if (!Number.isInteger(out[name]) || out[name] < 1) {
      throw new Error(`acts config: ${name} must be an integer >= 1 (got ${JSON.stringify(out[name])})`);
    }
  }
  if (out.minActTurns > out.maxActTurns) {
    throw new Error(`acts config: minActTurns (${out.minActTurns}) must not exceed maxActTurns (${out.maxActTurns})`);
  }
  return out;
}

function createRegisterRouterState(world, registerRouterConfig) {
  if (!registerRouterConfig) return null;
  const dag = buildLemmaDag(world);
  if (!dag) throw new Error('register router: the authored proof path does not entail S');
  const varIndex = world.questionPattern.findIndex((token) => typeof token === 'string' && token.startsWith('?'));
  return {
    dag,
    lexicons: buildRegionLexicons(world, dag),
    chainOf: buildChainMap(dag),
    mirrorTerm: world.mirror ? String(world.mirror.fact[varIndex] ?? '').toLowerCase() : null,
    clearedAt: new Map(),
    decisions: [],
    cache: new Map(),
  };
}

function createStrategyLedgerState(strategyLedgerConfig) {
  if (!strategyLedgerConfig) return null;
  return {
    config: strategyLedgerConfig,
    block: null,
    blockIndex: 0,
    blockRows: [],
    blockedModes: [],
    budget: deriveOpportunityCostBudget({ scope: 'dialogue_block' }),
    appliedCommitment: null,
    rows: [],
    stocktakes: [],
    history: [],
    departuresThisScene: 0,
  };
}

function createLemmaRun(lemmaDag) {
  if (!lemmaDag) return null;
  return {
    grounded: new Set(),
    frontier: [],
    active: null,
    clearedAt: new Map(),
    choices: [],
    departures: [],
    blocks: [],
    passthroughs: [],
    regressions: [],
    openings: 0,
    multiFrontierOpenings: 0,
    tutorChoices: 0,
  };
}

function initializeGrounded(world) {
  const grounded = new Map();
  for (const fact of world.background) {
    grounded.set(factKey(fact), { fact, turn: 0, valid: true });
  }
  return grounded;
}

function normalizeOptional(raw, normalizer) {
  return raw ? normalizer(raw) : null;
}

function normalizeFieldConfiguration(options, acts) {
  const fieldPlannerActive = Boolean(options.fieldPlanner || options.fieldPlannerEnforce);
  const fieldPlannerEnforceActive = Boolean(options.fieldPlannerEnforce);
  if (fieldPlannerActive && acts) {
    throw new Error(
      'field planner currently requires non-acts mode; acts mode redacts learner-store state from the tutor view',
    );
  }
  const fieldReportContextActive = Boolean(options.fieldReportContext);
  if (fieldReportContextActive && acts) {
    throw new Error(
      'field report context currently requires non-acts mode; acts mode redacts learner-store state from the tutor view',
    );
  }
  return { fieldPlannerActive, fieldPlannerEnforceActive, fieldReportContextActive };
}

function normalizeStrategyConfiguration(options, sceneConfig) {
  const strategyLedgerConfig = normalizeOptional(options.strategyLedger, normalizeStrategyLedgerConfig);
  const learnerLedgerActive = Boolean(options.learnerLedger);
  if (strategyLedgerConfig && !sceneConfig) {
    throw new Error(
      'strategy ledger requires scene mode (blocks segment scene exchanges; commitments bind at scene boundaries)',
    );
  }
  if (learnerLedgerActive && !sceneConfig) {
    throw new Error('learner ledger requires scene mode (scene intents bind at scene boundaries)');
  }
  return { strategyLedgerConfig, learnerLedgerActive };
}

function normalizeLemmaConfiguration(world, options, sceneConfig) {
  const lemmaConfig = normalizeOptional(options.lemmaLayer, normalizeLemmaConfig);
  if (lemmaConfig && !sceneConfig) {
    throw new Error('lemma layer requires scene mode (the frontier choice is a scene-opening decision)');
  }
  const lemmaDag = lemmaConfig ? buildLemmaDag(world) : null;
  if (lemmaConfig && !lemmaDag) {
    throw new Error('lemma layer: the authored proof path does not entail S (plot lint should have caught this)');
  }
  return { lemmaConfig, lemmaDag };
}

function normalizePublicRegisterConfiguration(world, options) {
  const publicRegisterPlan = options.publicRegister || 'default';
  const dynamicPublicRegisterPlan = isDynamicPublicRegisterPlan(publicRegisterPlan) ? publicRegisterPlan : null;
  const registerRows = [];
  let publicRegisterForTurn = staticPublicRegister(publicRegisterPlan);
  if (dynamicPublicRegisterPlan) {
    publicRegisterForTurn = weightedRegisterPick(
      dynamicPublicRegisterPlan,
      `${dynamicPublicRegisterPlan.seed}:${world.id}:run`,
    );
    registerRows.push({ turn: 0, register: publicRegisterForTurn, scope: 'run', scene: null });
  }
  return { publicRegisterPlan, dynamicPublicRegisterPlan, registerRows, publicRegisterForTurn };
}

function normalizeLearnerMirrorRefusal(raw) {
  if (!raw) return null;
  return raw === true ? {} : raw;
}

function normalizeConductTriggerOverrides(options) {
  if (Array.isArray(options.conductTriggerOverrides)) return options.conductTriggerOverrides;
  return options.conductTriggerOverride ? [options.conductTriggerOverride] : [];
}

function createCorruption(decay) {
  return decay ? { config: decay, rng: mulberry32(decay.seed), ledger: [] } : null;
}

function createActState(acts) {
  return acts ? { index: 1, startTurn: 1, brief: '', history: [] } : null;
}

function createLogicState(world, enabled) {
  return enabled ? buildWorldIR(world) : null;
}

function createGuardMonitor(world, guardSpec) {
  return guardSpec ? createRuntimeMonitor(world, guardSpec) : null;
}

/**
 * Construct the complete mutable run-state contract. The engine may alias
 * reference-valued fields while it still owns the turn loop; later R5 slices
 * can pass this same object to named director/tutor/learner transitions.
 */
export function createDramaRunState({ world, options = {} }) {
  const opts = {
    stopOnStall: true,
    stopOnLeak: true,
    learnerProxyDag: false,
    proxyDagPacing: false,
    tutorLearnerDag: false,
    recognitionGrace: 3,
    maxTurns: Infinity,
    ...options,
  };
  const decay = normalizeOptional(options.decay, normalizeDecayConfig);
  const corruption = createCorruption(decay);
  const acts = normalizeOptional(options.acts, normalizeActsConfig);
  const sceneConfig = normalizeOptional(options.sceneMode, normalizeSceneConfig);
  const { fieldPlannerActive, fieldPlannerEnforceActive, fieldReportContextActive } = normalizeFieldConfiguration(
    options,
    acts,
  );
  const { strategyLedgerConfig, learnerLedgerActive } = normalizeStrategyConfiguration(options, sceneConfig);
  const { lemmaConfig, lemmaDag } = normalizeLemmaConfiguration(world, options, sceneConfig);
  const learnerMirrorRefusalConfig = normalizeLearnerMirrorRefusal(options.learnerMirrorRefusal);
  const registerRouterConfig = normalizeOptional(options.registerRouter, normalizeRegisterRouterConfig);
  const directorCadence = normalizeDirectorCadence(options.directorCadence, { sceneMode: Boolean(sceneConfig) });
  const { publicRegisterPlan, dynamicPublicRegisterPlan, registerRows, publicRegisterForTurn } =
    normalizePublicRegisterConfiguration(world, options);
  const proofDebtGuardActive = Boolean(options.proofDebtGuard);
  const conductPolicyActive = Boolean(options.conductPolicy || options.conductProgressPolicy);
  const conductPolicyEnforceActive = Boolean(options.conductPolicyEnforce);

  return {
    opts,
    decay,
    corruption,
    acts,
    sceneConfig,
    fieldPlannerActive,
    fieldPlannerEnforceActive,
    fieldReportContextActive,
    strategyLedgerConfig,
    learnerLedgerActive,
    lemmaConfig,
    lemmaDag,
    learnerMirrorRefusalConfig,
    mirrorRefusalState: { fired: false, record: null },
    registerRouterConfig,
    registerRouterState: createRegisterRouterState(world, registerRouterConfig),
    directorCadence,
    publicRegisterPlan,
    dynamicPublicRegisterPlan,
    initialPublicRegisterForTurn: publicRegisterForTurn,
    baseRegisterForRun: publicRegisterForTurn,
    registerRows,
    stagePrologueEnabled: Boolean(options.stagePrologue),
    runtimeMonitor: createGuardMonitor(world, options.guardSpec),
    proofDebtGuardActive,
    conductPolicyActive,
    conductPolicyEnforceActive,
    conductTriggerOverrides: normalizeConductTriggerOverrides(options),
    proofDebtViewActive: proofDebtGuardActive || conductPolicyActive || conductPolicyEnforceActive,
    logicProjectionActive: Boolean(options.logicProjection),
    worldIR: createLogicState(world, Boolean(options.logicProjection)),
    actState: createActState(acts),
    ledgerState: createStrategyLedgerState(strategyLedgerConfig),
    learnerLedgerRows: [],
    reconstructionRows: [],
    plotRows: [],
    plotAuditRows: [],
    throughlineRows: [],
    proofDebtRows: [],
    logicSnapshots: [],
    sceneRows: [],
    didacticModeRows: [],
    castLayerRows: [],
    learnerTransformationRows: [],
    learnerTransformationPostRows: [],
    proxyDagPacingRows: [],
    tutorLearnerDagRows: [],
    fieldPlannerRows: [],
    fieldReportRows: [],
    ledger: [],
    releasedKeys: new Set(),
    releasedFacts: [],
    releasedAtByKey: new Map(),
    backgroundKeys: new Set(world.background.map(factKey)),
    grounded: initializeGrounded(world),
    hypotheses: [],
    transcript: [],
    trajectory: [],
    learnerDagSnapshots: [],
    events: [],
    staging: { phase: null },
    lemmaRun: createLemmaRun(lemmaDag),
    voicedLedger: [],
    voicedKeys: new Set(),
    firstAvailable: new Map(),
    overreaches: [],
    mischanneled: [],
    premiseIdByKey: new Map([...world.premiseById.values()].map((premise) => [factKey(premise.fact), premise.id])),
    releasedIdByKey: new Map(),
    mutationPoolByPredPos: new Map(),
  };
}
