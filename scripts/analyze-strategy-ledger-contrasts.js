#!/usr/bin/env node
/**
 * Phase-3 contrast analysis for the Strategy Ledger pilot
 * (STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md). Reads matrix run artifacts
 * (result.json per arm) and computes the pre-registered endpoints and
 * guardrails, entirely programmatically — no LLM anywhere.
 *
 *   E1 (persistence)         ledger        vs baseline
 *   E2 (register decision)   ledger-palette vs ledger
 *   E3 (learner mirror)      ledger-learner vs ledger
 *
 * Usage:
 *   node scripts/analyze-strategy-ledger-contrasts.js \
 *     --runs exports/dramatic-derivation/matrix/ledger-phase3-bitterwell \
 *     --runs exports/dramatic-derivation/matrix/ledger-phase3-ravensmark \
 *     [--out exports/dramatic-derivation/strategy-ledger]
 *
 * Frozen before the paid matrix ran (pre-registration discipline); any
 * later analytic change is post-hoc and must be labeled as such.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_SCHEMA = 'dramatic-derivation.strategy-ledger-phase3.v0';
const DESIGNS = {
  phase3: {
    arms: ['baseline', 'ledger', 'ledger-palette', 'ledger-learner'],
    armPattern: /^(baseline|ledger-palette|ledger-learner|ledger)-r(\d+)$/,
    contrasts: [
      { id: 'E1', name: 'persistence', treat: 'ledger', control: 'baseline' },
      { id: 'E2', name: 'register-as-decision', treat: 'ledger-palette', control: 'ledger' },
      { id: 'E3', name: 'learner-mirror', treat: 'ledger-learner', control: 'ledger' },
    ],
    endpoints: {
      E1: [
        ['modeFlapRate', 'lower'],
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
      ],
      E2: [
        ['modeFlapRate', 'lower'],
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
      ],
      E3: [
        ['timeToRecognition', 'lower'],
        ['voicedCount', 'higher'],
        ['overreachCount', 'lower'],
        ['hypothesisCount', 'higher'],
      ],
    },
  },
  // STRATEGY-LEDGER-V2-PREREGISTRATION.md — frozen before the paid matrix.
  v2: {
    arms: ['baseline', 'ledger-v1', 'trialling', 'trialling-learner'],
    armPattern: /^(baseline|ledger-v1|trialling-learner|trialling)-r(\d+)$/,
    contrasts: [
      { id: 'V2a', name: 'trialling', treat: 'trialling', control: 'ledger-v1' },
      { id: 'V2b', name: 'ledger-under-binding', treat: 'ledger-v1', control: 'baseline' },
      { id: 'V2c', name: 'learner-mirror-staged', treat: 'trialling-learner', control: 'trialling' },
    ],
    endpoints: {
      V2a: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['repairLatency', 'lower'],
        ['aporiaLike', 'lower'],
      ],
      V2b: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['repairLatency', 'lower'],
        ['aporiaLike', 'lower'],
      ],
      V2c: [
        ['timeToRecognition', 'lower'],
        ['voicedCount', 'higher'],
        ['overreachCount', 'lower'],
        ['hypothesisCount', 'higher'],
      ],
    },
  },
  // PLAN-MODE-STOCKTAKE-PREREGISTRATION.md — added before the freeze.
  'plan-mode': {
    arms: ['baseline', 'plan-mode'],
    armPattern: /^(baseline|plan-mode)-r(\d+)$/,
    contrasts: [{ id: 'PM', name: 'plan-mode-stocktake', treat: 'plan-mode', control: 'baseline' }],
    endpoints: {
      PM: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['repairLatency', 'lower'],
        ['aporiaLike', 'lower'],
      ],
    },
  },

  // LEMMA-LAYER-PREREGISTRATION.md — frozen at the contrast-launch commit.
  // Promotion rides on LB alone; LD is the stall-watcher redundancy
  // prediction (display ~ baseline expected) and LX the binding-net-of-
  // information read — both descriptive.
  lemma: {
    arms: ['baseline', 'lemma-display', 'lemma-bound'],
    armPattern: /^(baseline|lemma-display|lemma-bound)-r(\d+)$/,
    contrasts: [
      { id: 'LB', name: 'lemma-bound-vs-baseline (promotion)', treat: 'lemma-bound', control: 'baseline' },
      {
        id: 'LD',
        name: 'lemma-display-vs-baseline (redundancy prediction)',
        treat: 'lemma-display',
        control: 'baseline',
      },
      {
        id: 'LX',
        name: 'bound-vs-display (binding net of information)',
        treat: 'lemma-bound',
        control: 'lemma-display',
      },
    ],
    endpoints: {
      LB: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['aporiaLike', 'lower'],
        ['repairLatency', 'lower'],
      ],
      LD: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['aporiaLike', 'lower'],
        ['repairLatency', 'lower'],
      ],
      LX: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['aporiaLike', 'lower'],
        ['repairLatency', 'lower'],
      ],
    },
  },

  // REGISTER-ROUTER-CONTRAST-PREREGISTRATION.md — frozen at its launch
  // commit. Two arms; promotion on RR.
  'register-router': {
    arms: ['baseline', 'register-router'],
    armPattern: /^(baseline|register-router)-r(\d+)$/,
    contrasts: [
      { id: 'RR', name: 'register-router-vs-baseline (promotion)', treat: 'register-router', control: 'baseline' },
    ],
    endpoints: {
      RR: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['aporiaLike', 'lower'],
        ['repairLatency', 'lower'],
      ],
    },
  },

  // LEMMA-DISPLAY-CONFIRMATORY-PREREGISTRATION.md — frozen at its launch
  // commit. Two arms; promotion on LDC.
  'lemma-display': {
    arms: ['baseline', 'lemma-display'],
    armPattern: /^(baseline|lemma-display)-r(\d+)$/,
    contrasts: [
      { id: 'LDC', name: 'lemma-display-confirmatory (promotion)', treat: 'lemma-display', control: 'baseline' },
    ],
    endpoints: {
      LDC: [
        ['timeToRecognition', 'lower'],
        ['grounded', 'higher'],
        ['aporiaLike', 'lower'],
        ['repairLatency', 'lower'],
      ],
    },
  },
};
let DESIGN = DESIGNS.phase3;
let ARMS = DESIGN.arms;
let CONTRASTS = DESIGN.contrasts;

function parseArgs(argv) {
  const opts = { runs: [], out: path.join(ROOT, 'exports/dramatic-derivation/strategy-ledger'), design: 'phase3' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--runs') opts.runs.push(path.resolve(ROOT, argv[++i]));
    else if (argv[i] === '--out') opts.out = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--design') opts.design = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!opts.help && !opts.runs.length) throw new Error('at least one --runs <matrix dir> is required');
  return opts;
}

function armOf(label) {
  const m = label.match(DESIGN.armPattern);
  return m ? { arm: m[1], repeat: Number(m[2]) } : null;
}

// --- per-run endpoint extraction -------------------------------------------

function modeFlapRate(result) {
  const rows = result.didacticMode || [];
  if (rows.length < 2) return rows.length ? 0 : null;
  let flips = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].recommendedMode !== rows[i - 1].recommendedMode) flips += 1;
  }
  return flips / (rows.length - 1);
}

const NEGATIVE_STANCES = new Set(['ironic_challenge', 'sarcastic_challenge', 'face_threat_challenge']);

// Pre-registered T* imputation is CAP+1 ("imputed cap+1 when absent"), not
// turnsPlayed+1 — a stall-stopped run ends early and must not impute better
// than a grounded-at-cap run. Conformance fix applied pre-matrix (H0 phase);
// world caps pinned here because result.json does not carry turn_cap.
const WORLD_CAPS = {
  world_000_smoke: 14,
  world_003_bitterwell: 20,
  world_009_ravensmark: 24,
  world_005_marrick: 28,
  world_006_hethel: 26,
  world_010_hethel_resistant: 26,
  world_019_marrick_resistant: 28,
};
function turnCapFor(result) {
  return WORLD_CAPS[result.worldId] ?? result.turnsPlayed;
}

// v2: mean turns from each decay slip to its first repair/re-adoption
// (cap-end imputed when never repaired); null when the decay condition is off.
function repairLatency(result) {
  const rows = result.corruption?.ledger || [];
  if (!rows.length) return null;
  const decays = rows.filter((e) => e.type === 'decay');
  if (!decays.length) return null;
  const latencies = decays.map((d) => {
    const repair = rows.find((e) => e.type === 'repair' && e.premiseId === d.premiseId && e.turn >= d.turn);
    return (repair ? repair.turn : turnCapFor(result) + 1) - d.turn;
  });
  return latencies.reduce((a, b) => a + b, 0) / latencies.length;
}

// v2: of the openings whose PREVIOUS scene visibly failed (exit condition not
// cleared, or an unfaithful negative stance), how often did the review say
// switch or adjust? null when no such openings exist.
function switchAfterFailure(result) {
  const history = result.strategyLedger?.history || [];
  let failures = 0;
  let answered = 0;
  for (let i = 0; i < history.length; i += 1) {
    const prev = history[i];
    const failed =
      prev.outcome?.exitConditionCleared === false ||
      (NEGATIVE_STANCES.has(prev.strategy?.stance) && prev.fidelity?.label !== 'faithful');
    if (!failed || !prev.review) continue;
    failures += 1;
    if (prev.review.decision === 'switch' || prev.review.decision === 'adjust') answered += 1;
  }
  return failures ? answered / failures : null;
}

function extractRun(world, label, dir) {
  const resultPath = path.join(dir, 'result.json');
  if (!fs.existsSync(resultPath)) return null;
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const cap = result.trajectory.length ? Math.max(...result.trajectory.map((t) => t.turn)) : 0;
  const turnCap = result.turnsPlayed >= cap ? result.turnsPlayed : cap;
  const events = result.events || [];
  const count = (type) => events.filter((e) => e.type === type).length;
  const sceneOpenings = count('scene_open');
  const rows = result.strategyLedger?.rows || [];
  const tutorSceneRows = rows.filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  const learnerSceneRows = rows.filter((r) => r.agent === 'learner' && r.scope === 'scene');
  const registerClauses = tutorSceneRows
    .filter((r) => r.audit)
    .flatMap((r) => r.audit.clauses.filter((c) => c.clause.startsWith('register ')));
  return {
    world,
    label,
    ...armOf(label),
    verdict: result.verdict,
    grounded: result.verdict === 'grounded_anagnorisis' ? 1 : 0,
    timeToRecognition: result.assertedGroundedTurn ?? turnCapFor(result) + 1,
    turnsPlayed: result.turnsPlayed,
    turnCapSeen: turnCap,
    modeFlapRate: modeFlapRate(result),
    dAuc: result.trajectory.length ? result.trajectory.reduce((s, t) => s + t.D, 0) / result.trajectory.length : null,
    voicedCount: result.inference?.voiced?.length ?? 0,
    overreachCount: result.inference?.overreaches?.length ?? 0,
    hypothesisCount: (result.transcript || []).filter((l) => l.role === 'learner' && l.meta?.hypothesis).length,
    leaks: count('leak'),
    aporiaLike: ['aporia', 'disengagement'].includes(result.verdict) ? 1 : 0,
    releasesOnRecord: result.ledger.length,
    sceneOpenings,
    strategyCommits: count('strategy_commit'),
    strategyAudits: count('strategy_audit'),
    learnerIntents: count('learner_intent'),
    learnerCarries: count('learner_carry'),
    commitCoverage: sceneOpenings ? count('strategy_commit') / sceneOpenings : null,
    intentCoverage: sceneOpenings ? count('learner_intent') / sceneOpenings : null,
    registerSwitches: (result.publicRegisters || []).filter((r) => r.scope === 'scene' && r.register !== 'modern')
      .length,
    registerDriftClauses: registerClauses.filter((c) => c.verdict === 'drift').length,
    // --- v2 endpoints (null-safe on phase3/v1 artifacts) ---
    repairLatency: repairLatency(result),
    decayCount: (result.corruption?.ledger || []).filter((e) => e.type === 'decay').length,
    repairCount: (result.corruption?.ledger || []).filter((e) => e.type === 'repair').length,
    guardOverrides: (result.transcript || []).filter(
      (l) =>
        l.role === 'tutor' &&
        l.meta?.releaseDecision?.pacingGuard?.blocked === true &&
        l.meta.releaseDecision.played &&
        l.meta.releaseDecision.played === l.meta.releaseDecision.pacingGuard.candidate,
    ).length,
    invalidStanceViolations: (result.strategyLedger?.history || []).filter(
      (h) => h.fidelity?.label === 'invalid_person_attack',
    ).length,
    reviewEvents: count('strategy_review'),
    // --- lemma-layer endpoints (null-safe on non-lemma artifacts) ---
    lemmaChoices: result.lemmaLayer?.choices?.length ?? null,
    lemmaDepartures: result.lemmaLayer?.departures?.length ?? null,
    lemmaBlocks: result.lemmaLayer?.blocks?.length ?? null,
    lemmaPassthroughs: result.lemmaLayer?.passthroughs?.length ?? null,
    lemmaRegressions: result.lemmaLayer?.regressions?.length ?? null,
    // an untagged out-of-support release that REACHED the stage would be a
    // block row and a same-turn ledger row for the same premise — engine-
    // impossible by construction; the guardrail verifies exactly that.
    lemmaUntaggedOnStage: result.lemmaLayer
      ? result.lemmaLayer.blocks.filter((b) =>
          (result.ledger || []).some((row) => row.premiseId === b.premise && row.turn === b.turn),
        ).length
      : null,
    lemmaFrontierCoverage: result.lemmaLayer
      ? result.lemmaLayer.frontierCoverage.multiFrontierOpenings
        ? result.lemmaLayer.frontierCoverage.tutorChoices / result.lemmaLayer.frontierCoverage.multiFrontierOpenings
        : null
      : null,
    // --- register-router endpoints (null-safe on non-router artifacts) ---
    routerShifts: result.registerRouter?.shifts ?? null,
    routerDecisions: result.registerRouter?.decisions?.length ?? null,
    // audit-trail integrity: every non-didactic decision must carry its DAG
    // evidence — repair cites a regressed chain, confront cites the partner.
    routerUnevidencedFires: result.registerRouter
      ? result.registerRouter.decisions.filter(
          (d) =>
            d.register !== 'didactic' &&
            !(d.register === 'repair' ? (d.regressedChains || []).length > 0 : d.partnerDerivable === true),
        ).length
      : null,
    routerShiftEventMismatch: result.registerRouter
      ? Math.abs(
          (result.events || []).filter((e) => e.type === 'register_shift').length -
            result.registerRouter.decisions.filter((d) => d.register !== 'didactic').length,
        )
      : null,
    stocktakes: result.strategyLedger?.stocktakes?.length ?? null,
    correctionsDemanded: (result.strategyLedger?.stocktakes || []).filter((st) => st.correction).length,
    correctionsAnswered: (result.strategyLedger?.stocktakes || []).filter((st) => st.correction && st.reorientation)
      .length,
    stocktakeCoverage:
      result.strategyLedger?.stocktakes != null && sceneOpenings > 1
        ? Math.min(1, result.strategyLedger.stocktakes.length / Math.max(1, sceneOpenings - 1))
        : null,
    reviewCoverage: sceneOpenings > 1 ? Math.min(1, count('strategy_review') / Math.max(1, sceneOpenings - 1)) : null,
    switchAfterFailure: switchAfterFailure(result),
    negativeStanceScenes: (result.strategyLedger?.history || []).filter((h) => NEGATIVE_STANCES.has(h.strategy?.stance))
      .length,
    faithfulNegativeScenes: (result.strategyLedger?.history || []).filter(
      (h) => NEGATIVE_STANCES.has(h.strategy?.stance) && h.fidelity?.label === 'faithful',
    ).length,
    runFaithful: (result.strategyLedger?.history || [])
      .filter((h) => NEGATIVE_STANCES.has(h.strategy?.stance))
      .every((h) => h.fidelity?.label === 'faithful'),
    blockRows: result.strategyLedger?.blocks?.length ?? null,
    blocksCleared: result.strategyLedger?.blocks?.filter((b) => b.status === 'cleared').length ?? null,
    auditKept: tutorSceneRows
      .filter((r) => r.audit)
      .reduce((s, r) => s + r.audit.clauses.filter((c) => c.verdict === 'kept').length, 0),
    auditDrift: tutorSceneRows
      .filter((r) => r.audit)
      .reduce((s, r) => s + r.audit.clauses.filter((c) => c.verdict === 'drift').length, 0),
    learnerIntentRows: learnerSceneRows.length,
  };
}

// --- small stats -------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));

function mannWhitneyU(a, b) {
  if (!a.length || !b.length) return null;
  let u = 0;
  for (const x of a) for (const y of b) u += x > y ? 1 : x === y ? 0.5 : 0;
  return { u, uMax: a.length * b.length };
}

function pooledSd(a, b) {
  const all = [...a, ...b];
  return sd(all);
}

function contrastEndpoint(runs, contrast, key, { direction }) {
  const treat = runs
    .filter((r) => r.arm === contrast.treat)
    .map((r) => r[key])
    .filter((v) => v !== null);
  const control = runs
    .filter((r) => r.arm === contrast.control)
    .map((r) => r[key])
    .filter((v) => v !== null);
  const delta = treat.length && control.length ? mean(treat) - mean(control) : null;
  const sdPool = pooledSd(treat, control);
  const perWorldDirections = [];
  for (const world of [...new Set(runs.map((r) => r.world))]) {
    const t = runs
      .filter((r) => r.world === world && r.arm === contrast.treat)
      .map((r) => r[key])
      .filter((v) => v !== null);
    const c = runs
      .filter((r) => r.world === world && r.arm === contrast.control)
      .map((r) => r[key])
      .filter((v) => v !== null);
    if (t.length && c.length) perWorldDirections.push(Math.sign(mean(t) - mean(c)));
  }
  const consistent =
    perWorldDirections.length >= 2 && perWorldDirections.every((d) => d === perWorldDirections[0] && d !== 0);
  const bigEnough = delta !== null && sdPool ? Math.abs(delta) >= 0.5 * sdPool : false;
  // "better" respects the pre-registered direction (lower or higher is better)
  const improves = delta === null ? null : direction === 'lower' ? delta < 0 : delta > 0;
  return {
    endpoint: key,
    direction,
    treatMean: mean(treat),
    controlMean: mean(control),
    treatSd: sd(treat),
    controlSd: sd(control),
    delta,
    pooledSd: sdPool,
    mannWhitney: mannWhitneyU(treat, control),
    perWorldDirections,
    signal: Boolean(consistent && bigEnough),
    improves,
    n: { treat: treat.length, control: control.length },
  };
}

// --- main --------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('see file header for usage');
    return;
  }
  if (!DESIGNS[opts.design])
    throw new Error(`unknown --design ${opts.design} (known: ${Object.keys(DESIGNS).join(', ')})`);
  DESIGN = DESIGNS[opts.design];
  ARMS = DESIGN.arms;
  CONTRASTS = DESIGN.contrasts;
  const runs = [];
  for (const matrixDir of opts.runs) {
    const world = path.basename(matrixDir).replace(/^ledger-(phase3|v2b-confirm|v2|plan-mode)-/, '');
    for (const entry of fs.readdirSync(matrixDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'logs') continue;
      const parsed = armOf(entry.name);
      if (!parsed) continue;
      const run = extractRun(world, entry.name, path.join(matrixDir, entry.name));
      if (run) runs.push(run);
    }
  }
  if (!runs.length) throw new Error('no runs found under the given --runs directories');

  const worlds = [...new Set(runs.map((r) => r.world))];
  const armCounts = Object.fromEntries(ARMS.map((a) => [a, runs.filter((r) => r.arm === a).length]));

  // guardrails
  const guardrails = [];
  const g = (id, ok, detail) => guardrails.push({ id, ok: Boolean(ok), detail });
  g(
    'leaks',
    runs.every((r) => r.leaks === 0),
    `${runs.filter((r) => r.leaks > 0).length} run(s) with leak events`,
  );
  for (const world of worlds) {
    const base = runs.filter((r) => r.world === world && r.arm === 'baseline');
    const baseAporia = base.reduce((s, r) => s + r.aporiaLike, 0);
    for (const arm of ARMS.filter((a) => a !== 'baseline')) {
      const armRuns = runs.filter((r) => r.world === world && r.arm === arm);
      if (!armRuns.length) continue; // staged-out arm (e.g. D2 before it earns its runs)
      const armAporia = armRuns.reduce((s, r) => s + r.aporiaLike, 0);
      g(
        `aporia-${world}-${arm}`,
        armAporia <= baseAporia + 1,
        `${world}/${arm}: aporia-like verdicts ${armAporia} vs baseline ${baseAporia}`,
      );
      const baseRel = mean(base.map((r) => r.releasesOnRecord));
      const armRel = mean(armRuns.map((r) => r.releasesOnRecord));
      g(
        `releases-${world}-${arm}`,
        armRel !== null && baseRel !== null && armRel >= baseRel - 0.5,
        `${world}/${arm}: mean releases ${fmt(armRel)} vs baseline ${fmt(baseRel)}`,
      );
    }
  }
  const ledgerArms = runs.filter((r) => r.arm !== 'baseline');
  if (opts.design === 'lemma' || opts.design === 'lemma-display') {
    g(
      'guard-overrides',
      runs.every((r) => r.guardOverrides === 0),
      `${runs.filter((r) => r.guardOverrides > 0).length} run(s) with pacing-guard overrides`,
    );
    const bound = runs.filter((r) => r.arm === 'lemma-bound');
    g(
      'untagged-departures',
      bound.every((r) => (r.lemmaUntaggedOnStage ?? 0) === 0),
      `${bound.filter((r) => (r.lemmaUntaggedOnStage ?? 0) > 0).length} bound run(s) with an untagged out-of-support release on stage`,
    );
    const covs = bound.map((r) => r.lemmaFrontierCoverage).filter((v) => v !== null);
    g(
      'frontier-choice-coverage',
      !covs.length || mean(covs) >= 0.8,
      `mean frontier-choice coverage ${fmt(mean(covs))} on multi-frontier openings`,
    );
    g(
      'display-unbound',
      runs
        .filter((r) => r.arm === 'lemma-display')
        .every((r) => (r.lemmaChoices ?? 0) === 0 && (r.lemmaBlocks ?? 0) === 0 && (r.lemmaDepartures ?? 0) === 0),
      'display arm carries no binding events',
    );
  } else if (opts.design === 'register-router') {
    g(
      'guard-overrides',
      runs.every((r) => r.guardOverrides === 0),
      `${runs.filter((r) => r.guardOverrides > 0).length} run(s) with pacing-guard overrides`,
    );
    const router = runs.filter((r) => r.arm === 'register-router');
    g(
      'router-fires-evidenced',
      router.every((r) => (r.routerUnevidencedFires ?? 0) === 0),
      `${router.filter((r) => (r.routerUnevidencedFires ?? 0) > 0).length} router run(s) with an unevidenced fire`,
    );
    g(
      'router-events-consistent',
      router.every((r) => (r.routerShiftEventMismatch ?? 0) === 0),
      `${router.filter((r) => (r.routerShiftEventMismatch ?? 0) > 0).length} router run(s) with event/decision mismatch`,
    );
    g(
      'router-decisions-logged',
      router.every((r) => (r.routerDecisions ?? 0) > 0),
      'every router run logs per-turn decisions',
    );
  } else if (opts.design !== 'plan-mode') {
    const coverage = ledgerArms.map((r) => r.commitCoverage).filter((v) => v !== null);
    g(
      'commit-coverage',
      coverage.length && mean(coverage) >= 0.8,
      `mean commitment coverage ${fmt(mean(coverage))} across ledger arms`,
    );
  } else {
    const stCov = runs
      .filter((r) => r.arm === 'plan-mode')
      .map((r) => r.stocktakeCoverage)
      .filter((v) => v !== null);
    g(
      'stocktake-coverage',
      stCov.length && mean(stCov) >= 0.8,
      `mean stock-take coverage ${fmt(mean(stCov))} of eligible openings`,
    );
  }
  const learnerArm = opts.design === 'v2' ? 'trialling-learner' : 'ledger-learner';
  const intentCov = runs
    .filter((r) => r.arm === learnerArm)
    .map((r) => r.intentCoverage)
    .filter((v) => v !== null);
  if (runs.some((r) => r.arm === learnerArm)) {
    g(
      'intent-coverage',
      intentCov.length && mean(intentCov) >= 0.8,
      `mean learner intent coverage ${fmt(mean(intentCov))} in ${learnerArm}`,
    );
  }
  if (opts.design === 'v2') {
    g(
      'guard-overrides',
      runs.every((r) => r.guardOverrides === 0),
      `${runs.filter((r) => r.guardOverrides > 0).length} run(s) with pacing-guard overrides`,
    );
    g(
      'invalid-person-attack',
      runs.every((r) => r.invalidStanceViolations === 0),
      `${runs.filter((r) => r.invalidStanceViolations > 0).length} run(s) with invalid corrosive violations`,
    );
    const triallingRuns = runs.filter((r) => r.arm === 'trialling' || r.arm === 'trialling-learner');
    if (triallingRuns.length) {
      const reviewCov = triallingRuns.map((r) => r.reviewCoverage).filter((v) => v !== null);
      g(
        'review-coverage',
        reviewCov.length && mean(reviewCov) >= 0.8,
        `mean review coverage ${fmt(mean(reviewCov))} on openings-with-history`,
      );
    }
  }

  // contrasts (endpoint tables live on the DESIGN — frozen per pre-registration)
  const ENDPOINTS = DESIGN.endpoints;
  const contrasts = CONTRASTS.map((c) => ({
    ...c,
    endpoints: ENDPOINTS[c.id].map(([key, direction]) => contrastEndpoint(runs, c, key, { direction })),
  }));

  // v2 estimands: the assigned-arm C2 endpoints re-computed on the
  // faithful-arm subset (runs whose negative-stance scenes were all
  // faithful; runs without negative-stance scenes qualify).
  const faithfulArm =
    opts.design === 'v2'
      ? (() => {
          const treat = runs.filter((r) => r.arm === 'trialling' && r.runFaithful);
          const all = runs.filter((r) => r.arm === 'trialling');
          const keys = ['timeToRecognition', 'grounded', 'repairLatency', 'aporiaLike'];
          const row = (set) =>
            Object.fromEntries(keys.map((k) => [k, mean(set.map((r) => r[k]).filter((v) => v !== null))]));
          return {
            assignedRuns: all.length,
            faithfulRuns: treat.length,
            assigned: row(all),
            faithful: row(treat),
          };
        })()
      : null;

  // descriptives
  const descriptives = {
    registerSwitchesByArm: Object.fromEntries(
      ARMS.map((a) => [a, mean(runs.filter((r) => r.arm === a).map((r) => r.registerSwitches))]),
    ),
    dAucByArm: Object.fromEntries(ARMS.map((a) => [a, mean(runs.filter((r) => r.arm === a).map((r) => r.dAuc))])),
    auditKeptDrift: Object.fromEntries(
      ARMS.filter((a) => a !== 'baseline').map((a) => [
        a,
        {
          kept: runs.filter((r) => r.arm === a).reduce((s, r) => s + r.auditKept, 0),
          drift: runs.filter((r) => r.arm === a).reduce((s, r) => s + r.auditDrift, 0),
        },
      ]),
    ),
    blocks: Object.fromEntries(
      ARMS.filter((a) => a !== 'baseline').map((a) => [
        a,
        {
          rows: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.blockRows || 0), 0),
          cleared: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.blocksCleared || 0), 0),
        },
      ]),
    ),
    ...(opts.design === 'plan-mode'
      ? {
          stocktake: {
            total: runs.reduce((s2, r) => s2 + (r.stocktakes || 0), 0),
            correctionsDemanded: runs.reduce((s2, r) => s2 + (r.correctionsDemanded || 0), 0),
            correctionsAnswered: runs.reduce((s2, r) => s2 + (r.correctionsAnswered || 0), 0),
          },
        }
      : {}),
    ...(opts.design === 'v2'
      ? {
          decayRepair: Object.fromEntries(
            ARMS.map((a) => [
              a,
              {
                decays: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.decayCount || 0), 0),
                repairs: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.repairCount || 0), 0),
              },
            ]),
          ),
          switchAfterFailure: mean(
            runs
              .filter((r) => r.arm === 'trialling' || r.arm === 'trialling-learner')
              .map((r) => r.switchAfterFailure)
              .filter((v) => v !== null),
          ),
          negativeStance: {
            scenes: runs.reduce((s, r) => s + (r.negativeStanceScenes || 0), 0),
            faithful: runs.reduce((s, r) => s + (r.faithfulNegativeScenes || 0), 0),
          },
        }
      : {}),
  };

  const report = {
    schema: REPORT_SCHEMA,
    preRegistration: 'STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md',
    worlds,
    armCounts,
    runs,
    guardrails,
    contrasts,
    descriptives,
    ...(faithfulArm ? { faithfulArm } : {}),
  };

  const lines = [
    opts.design === 'plan-mode'
      ? '# Plan-Mode Stock-Take — pre-registered contrast (binding conditions)'
      : opts.design === 'v2'
        ? '# Strategy Ledger v2 — pre-registered pilot contrasts (binding conditions)'
        : '# Strategy Ledger Phase 3 — pre-registered pilot contrasts',
    '',
    `Worlds: ${worlds.join(', ')}. Arm counts: ${ARMS.map((a) => `${a}=${armCounts[a]}`).join(', ')}.`,
    'All endpoints programmatic (no LLM judge). Pilot tier: signals are directional, not significance claims.',
    '',
    '## Guardrails',
    '',
    '| guardrail | ok | detail |',
    '|---|---|---|',
    ...guardrails.map((x) => `| ${x.id} | ${x.ok ? 'PASS' : 'FAIL'} | ${x.detail} |`),
    '',
    '## Contrasts',
    '',
  ];
  for (const c of contrasts) {
    lines.push(`### ${c.id} — ${c.name} (${c.treat} vs ${c.control})`, '');
    lines.push(
      '| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |',
    );
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const e of c.endpoints) {
      lines.push(
        `| ${e.endpoint} | ${e.direction} | ${fmt(e.treatMean)}±${fmt(e.treatSd)} (n=${e.n.treat}) | ${fmt(e.controlMean)}±${fmt(e.controlSd)} (n=${e.n.control}) | ${fmt(e.delta)} | ${fmt(e.pooledSd)} | ${e.mannWhitney ? `${e.mannWhitney.u}/${e.mannWhitney.uMax}` : '—'} | ${e.perWorldDirections.join(',') || '—'} | ${e.signal ? (e.improves ? 'YES (improves)' : 'YES (worsens)') : 'no'} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Descriptives',
    '',
    `Register switches/run by arm: ${JSON.stringify(descriptives.registerSwitchesByArm)}`,
    `D-AUC by arm: ${Object.entries(descriptives.dAucByArm)
      .map(([a, v]) => `${a}=${fmt(v)}`)
      .join(', ')}`,
    `Audit kept/drift: ${JSON.stringify(descriptives.auditKeptDrift)}`,
    `Blocks (rows/cleared): ${JSON.stringify(descriptives.blocks)}`,
    '',
  );
  fs.mkdirSync(opts.out, { recursive: true });
  if (faithfulArm) {
    lines.push(
      '## v2 estimands: assigned-arm vs faithful-arm (trialling)',
      '',
      `Assigned runs: ${faithfulArm.assignedRuns}; faithful-arm runs: ${faithfulArm.faithfulRuns}.`,
      `Assigned means: ${JSON.stringify(faithfulArm.assigned)}`,
      `Faithful means: ${JSON.stringify(faithfulArm.faithful)}`,
      '',
    );
  }
  const stem =
    opts.design === 'plan-mode'
      ? 'plan-mode-contrast-report'
      : opts.design === 'v2'
        ? 'v2-contrasts-report'
        : 'phase3-contrasts-report';
  fs.writeFileSync(path.join(opts.out, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(opts.out, `${stem}.md`), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  console.log(`\nreport at ${path.relative(ROOT, opts.out)}/${stem}.{json,md}`);
}

main();
