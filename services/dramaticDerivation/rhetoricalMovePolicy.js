/**
 * Scene/exchange bookkeeping and a shallow rhetorical move policy.
 *
 * The policy is deliberately small: it maps visible proof/dialogue pressure to
 * a distribution over the existing tutor figures. It is not a taxonomy of
 * situations, and it does not authorize new evidence. The stochastic path is a
 * deterministic seeded sampler over that distribution, so paid probes remain
 * reproducible.
 */

export const RHETORICAL_POLICY_SCHEMA = 'dramatic-derivation.rhetorical-policy.v0';
export const SCENE_SCHEMA = 'dramatic-derivation.scene.v0';

const SCENE_DEFAULTS = Object.freeze({
  maxExchanges: 4,
  maxPhaticExchanges: 2,
  closeOnDDecrease: true,
  closeOnConfusion: true,
});

const POLICY_DEFAULTS = Object.freeze({
  mode: 'deterministic',
  seed: 1,
  temperature: 1,
});

const EXCHANGE_TYPES = new Set([
  'substantive',
  'phatic_ack',
  'confusion',
  'repair_request',
  'resistance',
  'hypothesis',
  'assertion',
]);

export const RHETORICAL_FIGURES = Object.freeze(['erotema', 'analogia', 'exemplum', 'anaphora', 'aposiopesis']);

function parseConfig(raw, defaults, label) {
  if (raw === true || raw === undefined || raw === null) return { ...defaults };
  if (raw === false || raw === 'off') return null;
  let cfg = raw;
  if (typeof cfg === 'string') {
    if (!cfg.trim() || cfg.trim() === 'on') return { ...defaults };
    if (cfg.trim() === 'off') return null;
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`${label} config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error(`${label} config must be a JSON object`);
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in defaults)) {
      throw new Error(`${label} config: unknown key "${key}" (known: ${Object.keys(defaults).join(', ')})`);
    }
  }
  return { ...defaults, ...cfg };
}

export function normalizeSceneConfig(raw = true) {
  const cfg = parseConfig(raw, SCENE_DEFAULTS, 'scene-mode');
  if (!cfg) return null;
  for (const name of ['maxExchanges', 'maxPhaticExchanges']) {
    if (!Number.isInteger(cfg[name]) || cfg[name] < 1) {
      throw new Error(`scene-mode config: ${name} must be an integer >= 1`);
    }
  }
  return {
    ...cfg,
    closeOnDDecrease: Boolean(cfg.closeOnDDecrease),
    closeOnConfusion: Boolean(cfg.closeOnConfusion),
  };
}

export function normalizeRhetoricalPolicyConfig(raw = true) {
  const cfg = parseConfig(raw, POLICY_DEFAULTS, 'rhetorical-policy');
  if (!cfg) return null;
  if (!['deterministic', 'sample'].includes(cfg.mode)) {
    throw new Error(`rhetorical-policy config: mode must be "deterministic" or "sample"`);
  }
  if (!Number.isFinite(Number(cfg.seed))) {
    throw new Error('rhetorical-policy config: seed must be numeric');
  }
  if (!Number.isFinite(Number(cfg.temperature)) || Number(cfg.temperature) <= 0) {
    throw new Error('rhetorical-policy config: temperature must be a positive number');
  }
  return { ...cfg, seed: Number(cfg.seed), temperature: Number(cfg.temperature) };
}

function norm(text) {
  return String(text || '').toLowerCase();
}

function countWords(text) {
  return String(text || '').split(/\s+/u).filter(Boolean).length;
}

export function classifyLearnerExchange({
  dialogue = '',
  adopt = [],
  retract = [],
  deriveOutcomes = [],
  hypothesis = null,
  asserts = null,
  dBefore = null,
  dAfter = null,
  groundedBefore = null,
  groundedAfter = null,
} = {}) {
  const text = norm(dialogue);
  const formalActions =
    (adopt || []).length +
    (retract || []).length +
    (deriveOutcomes || []).filter((o) => o.status === 'voiced').length +
    (asserts ? 1 : 0);
  const dDelta = typeof dBefore === 'number' && typeof dAfter === 'number' ? dBefore - dAfter : 0;
  const boardDelta =
    typeof groundedBefore === 'number' && typeof groundedAfter === 'number' ? groundedAfter - groundedBefore : 0;
  let type = 'substantive';
  if (asserts) type = 'assertion';
  else if (hypothesis) type = 'hypothesis';
  else if (/\b(no|sorry|lost|confus|don't get|do not get|wait|unclear|what do you mean)\b/u.test(text)) {
    type = /\b(again|back|remind|lost|forgot|slipped|where did)\b/u.test(text) ? 'repair_request' : 'confusion';
  } else if (/\b(but|surely|rather|instead|can't be|cannot be|doesn't follow|does not follow)\b/u.test(text)) {
    type = 'resistance';
  } else if (!formalActions && countWords(text) <= 8 && /\b(yes|i see|got it|okay|ok|right|mm|hm|understood)\b/u.test(text)) {
    type = 'phatic_ack';
  } else if (!formalActions && !dDelta && !boardDelta && countWords(text) <= 12) {
    type = 'phatic_ack';
  }
  if (!EXCHANGE_TYPES.has(type)) type = 'substantive';
  return {
    type,
    formalActions,
    dDelta,
    boardDelta,
    countsForProgress: formalActions > 0 || dDelta > 0 || boardDelta > 0 || type === 'hypothesis' || type === 'assertion',
    phatic: type === 'phatic_ack',
  };
}

export function openScene({ index, turn, dNow, targetPremise = null, targetFact = null, goal = null, reason = 'opening' }) {
  return {
    schema: SCENE_SCHEMA,
    index,
    startTurn: turn,
    endTurn: null,
    openedBy: reason,
    goal: goal || 'Orient the next local proof obligation without forcing the answer.',
    targetPremise,
    targetFact,
    dStart: dNow,
    dEnd: null,
    status: null,
    closeReason: null,
    exchanges: [],
    counts: {
      phatic: 0,
      substantive: 0,
      confusion: 0,
      repairRequest: 0,
      assertion: 0,
    },
  };
}

export function sceneView(scene) {
  if (!scene) return null;
  return {
    schema: scene.schema,
    index: scene.index,
    startTurn: scene.startTurn,
    goal: scene.goal,
    targetPremise: scene.targetPremise,
    targetFact: scene.targetFact,
    exchangesSoFar: scene.exchanges.length,
    phaticSoFar: scene.counts.phatic,
  };
}

export function sceneMeta(scene) {
  const view = sceneView(scene);
  if (!view) return null;
  return {
    index: view.index,
    startTurn: view.startTurn,
    goal: view.goal,
    targetPremise: view.targetPremise,
  };
}

export function updateScene(scene, exchange, { turn, dNow, forced = false, endedBy = null, config = SCENE_DEFAULTS } = {}) {
  if (!scene) return { scene: null, closed: null };
  const row = {
    turn,
    ordinal: scene.exchanges.length + 1,
    type: exchange.type,
    formalActions: exchange.formalActions,
    dDelta: exchange.dDelta,
    boardDelta: exchange.boardDelta,
    countsForProgress: exchange.countsForProgress,
  };
  scene.exchanges.push(row);
  if (exchange.phatic) scene.counts.phatic += 1;
  if (exchange.type === 'substantive' || exchange.countsForProgress) scene.counts.substantive += 1;
  if (exchange.type === 'confusion') scene.counts.confusion += 1;
  if (exchange.type === 'repair_request') scene.counts.repairRequest += 1;
  if (exchange.type === 'assertion') scene.counts.assertion += 1;

  let status = null;
  let closeReason = null;
  if (endedBy) {
    status = endedBy === 'grounded_anagnorisis' ? 'progressed' : 'failed';
    closeReason = `run ended: ${endedBy}`;
  } else if (forced) {
    status = 'progressed';
    closeReason = 'recognition forced';
  } else if (config.closeOnDDecrease && exchange.dDelta > 0) {
    status = 'progressed';
    closeReason = 'D decreased';
  } else if (config.closeOnConfusion && (exchange.type === 'confusion' || exchange.type === 'repair_request')) {
    status = exchange.type === 'repair_request' ? 'needs_repair' : 'clarified';
    closeReason = exchange.type;
  } else if (scene.counts.phatic >= config.maxPhaticExchanges) {
    status = 'drift_guard';
    closeReason = `phatic budget ${config.maxPhaticExchanges} reached`;
  } else if (scene.exchanges.length >= config.maxExchanges) {
    status = 'budget';
    closeReason = `exchange budget ${config.maxExchanges} reached`;
  }

  if (!status) return { scene, closed: null };
  scene.endTurn = turn;
  scene.dEnd = dNow;
  scene.status = status;
  scene.closeReason = closeReason;
  return { scene: null, closed: { ...scene, exchanges: scene.exchanges.map((e) => ({ ...e })) } };
}

function hashUnit(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function normalizeDistribution(rows, temperature = 1) {
  const weighted = rows.map((row) => ({
    ...row,
    score: Math.max(0.001, Number(row.score) || 0.001),
  }));
  const adjusted = weighted.map((row) => ({ ...row, weight: Math.pow(row.score, 1 / temperature) }));
  const total = adjusted.reduce((sum, row) => sum + row.weight, 0) || 1;
  return adjusted
    .map(({ score, ...row }) => ({ ...row, weight: +(row.weight / total).toFixed(3) }))
    .sort((a, b) => b.weight - a.weight || a.figure.localeCompare(b.figure));
}

function choose(distribution, { mode, seed, turn, worldId }) {
  if (mode !== 'sample') return distribution[0];
  const r = hashUnit(`${seed}:${worldId}:${turn}`);
  let acc = 0;
  for (const row of distribution) {
    acc += row.weight;
    if (r <= acc) return row;
  }
  return distribution[distribution.length - 1];
}

function lastLearnerLine(transcript = []) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i].role === 'learner') return transcript[i];
  }
  return null;
}

function add(scores, key, score, rationale) {
  const current = scores.get(key) || { key, score: 0, rationales: [] };
  current.score += score;
  if (rationale) current.rationales.push(rationale);
  scores.set(key, current);
}

function keyOf(figure, intent, targetPremise, stance) {
  return JSON.stringify({ figure, intent, targetPremise: targetPremise || null, stance });
}

function rowFromKey(entry) {
  return { ...JSON.parse(entry.key), score: entry.score, rationale: entry.rationales.slice(0, 2).join('; ') };
}

export function recommendRhetoricalMove(world, view, context = {}, config = true) {
  const cfg = normalizeRhetoricalPolicyConfig(config);
  if (!cfg) return null;
  const scores = new Map();
  const targetFromContext = context.topProofDebt?.premiseId || context.cuePremise || context.lastReleasePremise || null;
  const lastLearner = lastLearnerLine(view.transcript);
  const exchangeType = lastLearner?.meta?.exchange?.type || null;
  const lastPoint = view.trajectory?.[view.trajectory.length - 1] || null;
  const prevPoint = view.trajectory && view.trajectory.length > 1 ? view.trajectory[view.trajectory.length - 2] : null;
  const plateau = Boolean(lastPoint && prevPoint && lastPoint.D === prevPoint.D);
  const frontier = view.inference?.frontier || [];
  const stalledFrontier = frontier.find((item) => item.age >= 2 && !item.targetedByLast2);

  add(scores, keyOf('erotema', 'test', targetFromContext, 'ask'), 0.18, 'default guided-discovery pressure');
  add(scores, keyOf('analogia', 'consolidate', targetFromContext, 'transfer'), 0.12, 'make the local shape portable');

  if (context.topProofDebt) {
    add(scores, keyOf('anaphora', 'restore', context.topProofDebt.premiseId, 'proof_debt_repair'), 0.55, 'repair a staged proof debt before new work');
    add(scores, keyOf('erotema', 'restore', context.topProofDebt.premiseId, 'read_back'), 0.18, 'ask for the missing exhibit before restaging');
  }
  if (context.forced) {
    add(scores, keyOf('aposiopesis', 'stage_recognition', targetFromContext, 'near_recognition'), 0.52, 'the board forces the answer; let the learner finish it');
    add(scores, keyOf('erotema', 'stage_recognition', targetFromContext, 'last_question'), 0.22, 'one final question can stage recognition');
  }
  if (context.releaseCue || context.playableCount > 0) {
    add(scores, keyOf('exemplum', 'release', context.cuePremise, 'concrete_exhibit'), 0.42, 'fresh evidence wants concrete seating');
    add(scores, keyOf('analogia', 'release', context.cuePremise, 'bridge_exhibit'), 0.2, 'bridge the new exhibit to prior ground');
  }
  if (exchangeType === 'phatic_ack') {
    add(scores, keyOf('erotema', 'test', targetFromContext, 'uptake_check'), 0.35, 'phatic uptake needs a small check, not a lecture');
    add(scores, keyOf('anaphora', 'consolidate', targetFromContext, 'recap'), 0.18, 'repeat the live chain briefly');
  }
  if (exchangeType === 'confusion' || exchangeType === 'repair_request') {
    add(scores, keyOf('anaphora', exchangeType === 'repair_request' ? 'restore' : 'consolidate', targetFromContext, 'phatic_repair'), 0.42, 'confusion asks for continuity repair');
    add(scores, keyOf('analogia', 'orient', targetFromContext, 'lower_load'), 0.18, 'a smaller parallel can lower load');
  }
  if (exchangeType === 'resistance') {
    add(scores, keyOf('erotema', 'counter_mirror', targetFromContext, 'contrast'), 0.34, 'resistance should be tested against the record');
    add(scores, keyOf('exemplum', 'counter_mirror', targetFromContext, 'counterexample'), 0.24, 'a concrete counter-case can separate routes');
  }
  if (stalledFrontier) {
    const target = stalledFrontier.groundPremiseIds?.[0] || targetFromContext;
    add(scores, keyOf('erotema', 'consolidate', target, 'stalled_join'), 0.36, 'ask the learner to put waiting grounds together');
    add(scores, keyOf('anaphora', 'consolidate', target, 'walk_conjuncts'), 0.26, 'repeat the conjuncts without supplying the conclusion');
  }
  if (plateau && !context.forced) {
    add(scores, keyOf('exemplum', 'orient', targetFromContext, 'unstick'), 0.2, 'the D curve is flat; make one obligation concrete');
  }

  const distribution = normalizeDistribution([...scores.values()].map(rowFromKey), cfg.temperature);
  const selected = choose(distribution, { ...cfg, turn: view.turn, worldId: world.id });
  return {
    schema: RHETORICAL_POLICY_SCHEMA,
    mode: cfg.mode,
    seed: cfg.seed,
    temperature: cfg.temperature,
    turn: view.turn,
    selected,
    distribution,
  };
}

export function renderRhetoricalPolicy(policy) {
  if (!policy) return [];
  return [
    '',
    'RHETORICAL MOVE POLICY (advisory, no new evidence):',
    `- selected ${policy.selected.figure} / ${policy.selected.intent} / ${policy.selected.stance}${
      policy.selected.targetPremise ? ` targeting ${policy.selected.targetPremise}` : ''
    }`,
    `- rationale: ${policy.selected.rationale || 'highest-weight visible fit'}`,
    `- distribution: ${policy.distribution
      .slice(0, 4)
      .map((row) => `${row.figure}:${row.intent}:${row.weight}`)
      .join(', ')}`,
    policy.mode === 'sample'
      ? '- this run is sampling from the distribution with a fixed seed; record the sampled choice, do not hide it'
      : '- this run uses the highest-weight choice deterministically',
    'Use it as a disciplined hunch. You may override it when the record demands, but your move metadata should make the reason visible.',
  ];
}
