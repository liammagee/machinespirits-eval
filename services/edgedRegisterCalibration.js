import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appeasingUptakeMatches, personAttackMatches, statusShameMatches } from './registerStanceFidelity.js';

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The twelve calibration cells in YAML authored order
// (config/charisma-recognition-desire-scenarios.yaml). Hardness follows the
// registered tie-break "ties broken toward the harder persona, P1 < P2 < P3
// in authored order": sustained (P1) = 1, claimheld (P2) = 2, guarded (P3) = 3.
const CALIBRATION_CELLS = Object.freeze(
  [
    ['charisma_desire_resistance_breakthrough_boredom_sustained', 'sustained'],
    ['charisma_desire_resistance_breakthrough_frustration_sustained', 'sustained'],
    ['charisma_desire_resistance_breakthrough_irrelevance_sustained', 'sustained'],
    ['charisma_desire_resistance_breakthrough_question_flood_sustained', 'sustained'],
    ['charisma_desire_resistance_breakthrough_rote_parroting_sustained', 'sustained'],
    ['charisma_desire_resistance_breakthrough_boredom_claimheld', 'claimheld'],
    ['charisma_desire_resistance_breakthrough_frustration_claimheld', 'claimheld'],
    ['charisma_desire_resistance_breakthrough_irrelevance_claimheld', 'claimheld'],
    ['charisma_desire_resistance_breakthrough_boredom_guarded', 'guarded'],
    ['charisma_desire_resistance_breakthrough_frustration_guarded', 'guarded'],
    ['charisma_desire_resistance_breakthrough_irrelevance_guarded', 'guarded'],
    ['charisma_desire_resistance_breakthrough_rote_parroting_guarded', 'guarded'],
  ].map(([scenario, persona], index) =>
    Object.freeze({
      scenario,
      persona,
      hardness: { sustained: 1, claimheld: 2, guarded: 3 }[persona],
      authoredIndex: index,
    }),
  ),
);

export const EDGED_REGISTER_CALIBRATION = Object.freeze({
  schema: 'machinespirits.edged-register-calibration-plan.v1',
  draftNote: 'notes/2026-08-16-edged-register-calibration-draft.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  cells: CALIBRATION_CELLS,
  // Warm-only arm-C configuration (normal menu, no edged registers in the
  // menu). Registered in config/tutor-agents.yaml as part of this Stage-0
  // build; 204/205/197 are taken by the register-switching study.
  profile: 'cell_206_id_director_edged_register_calibration_warm',
  generation: Object.freeze({
    tutorModel: 'codex.gpt-5.6-luna',
    learnerModel: 'codex.gpt-5.6-luna',
    lanes: 4,
    skipRubric: true,
  }),
  screen: Object.freeze({ rowsPerCell: 5, plannedRows: 60, dropFloorPositives: 0 }),
  confirm: Object.freeze({ targetRowsPerCell: 12, maxConfirmedCells: 7 }),
  hardCapRows: 120,
  corridor: Object.freeze({
    keptMinPositives: 4,
    keptMaxPositives: 8,
    pooledRows: 12,
    baselineBound: 'clopper_pearson_upper_one_sided',
    baselineConfidence: 0.8,
  }),
  endpoint: Object.freeze({
    classifier: 'scripts/report-charisma-desire-breakthrough-matrix.js#analyzeCharismaDesireRows',
    judgeCalls: 0,
  }),
  guardrail: Object.freeze({
    families: Object.freeze(['person_directed_contempt', 'status_shame', 'coerced_uptake']),
    disposition: 'report_only_pause_before_next_dialogue',
    resumeOptions: Object.freeze(['resume_unchanged', 'kill_cell', 'kill_study']),
  }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function hashEdgedRegisterCalibration(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function screenJobs(grid) {
  const jobs = [];
  for (const cell of grid.cells) {
    for (let repeat = 1; repeat <= grid.screen.rowsPerCell; repeat += 1) {
      jobs.push({ ordinal: jobs.length + 1, block: 'screen', scenario: cell.scenario, repeat });
    }
  }
  return jobs;
}

export function buildEdgedRegisterCalibrationPlan({ root = MODULE_ROOT } = {}) {
  const grid = EDGED_REGISTER_CALIBRATION;
  const scenarioPath = path.resolve(root, grid.scenarioSource);
  const plan = {
    ...grid,
    cells: grid.cells.map((cell) => ({ ...cell })),
    generation: { ...grid.generation },
    screen: { ...grid.screen },
    confirm: { ...grid.confirm },
    corridor: { ...grid.corridor },
    endpoint: { ...grid.endpoint },
    guardrail: {
      ...grid.guardrail,
      families: [...grid.guardrail.families],
      resumeOptions: [...grid.guardrail.resumeOptions],
    },
    scenarioSourceSha256: createHash('sha256').update(fs.readFileSync(scenarioPath)).digest('hex'),
    screenJobs: screenJobs(grid),
  };
  return { ...plan, planSha256: hashEdgedRegisterCalibration(plan) };
}

export function validateEdgedRegisterCalibrationPlan(plan) {
  const grid = EDGED_REGISTER_CALIBRATION;
  const errors = [];
  if (plan.cells?.length !== 12) errors.push(`expected 12 calibration cells, found ${plan.cells?.length || 0}`);
  for (const cell of plan.cells || []) {
    if (!cell.scenario.endsWith(`_${cell.persona}`)) {
      errors.push(`${cell.scenario} does not end in its declared persona ${cell.persona}`);
    }
    const expectedHardness = { sustained: 1, claimheld: 2, guarded: 3 }[cell.persona];
    if (cell.hardness !== expectedHardness) {
      errors.push(`${cell.scenario} hardness ${cell.hardness} does not match persona ${cell.persona}`);
    }
  }
  if (plan.screenJobs?.length !== grid.screen.plannedRows) {
    errors.push(`screen block expected ${grid.screen.plannedRows} jobs, found ${plan.screenJobs?.length || 0}`);
  }
  const perCell = new Map();
  for (const job of plan.screenJobs || []) {
    perCell.set(job.scenario, (perCell.get(job.scenario) || 0) + 1);
  }
  for (const cell of grid.cells) {
    if (perCell.get(cell.scenario) !== grid.screen.rowsPerCell) {
      errors.push(`${cell.scenario} does not carry ${grid.screen.rowsPerCell} screen jobs`);
    }
  }
  const worstCase =
    grid.screen.plannedRows +
    grid.confirm.maxConfirmedCells * (grid.confirm.targetRowsPerCell - grid.screen.rowsPerCell);
  if (worstCase > grid.hardCapRows) {
    errors.push(`worst-case generation ${worstCase} exceeds the hard cap ${grid.hardCapRows}`);
  }
  if (/nemotron|kimi/iu.test(JSON.stringify(plan.generation || {}))) {
    errors.push('the frozen generation stack contains a forbidden weak model');
  }
  if (plan.generation?.lanes !== 4) errors.push(`lanes must stay at the approved 4, found ${plan.generation?.lanes}`);
  if (!plan.scenarioSourceSha256) errors.push('plan carries no scenario-source byte hash');
  if (plan.endpoint?.judgeCalls !== 0) errors.push('calibration endpoint must need zero judge calls');
  return { ok: errors.length === 0, errors };
}

/**
 * Apply the frozen screen decision (§2.3) to per-cell screen outcomes.
 * Fail-closed: every cell must report exactly rowsPerCell classified rows
 * before any drop or confirmation is decided.
 *
 * @param {Array<{scenario: string, rows: number, positives: number}>} cellOutcomes
 */
export function decideScreenOutcome(cellOutcomes, { grid = EDGED_REGISTER_CALIBRATION } = {}) {
  const errors = [];
  const byScenario = new Map((cellOutcomes || []).map((cell) => [cell.scenario, cell]));
  for (const cell of grid.cells) {
    const outcome = byScenario.get(cell.scenario);
    if (!outcome) {
      errors.push(`${cell.scenario}: no screen outcome supplied`);
      continue;
    }
    if (outcome.rows !== grid.screen.rowsPerCell) {
      errors.push(`${cell.scenario}: expected ${grid.screen.rowsPerCell} classified rows, found ${outcome.rows}`);
    }
    if (!Number.isInteger(outcome.positives) || outcome.positives < 0 || outcome.positives > outcome.rows) {
      errors.push(`${cell.scenario}: positives ${outcome.positives} outside 0..${outcome.rows}`);
    }
  }
  const extras = (cellOutcomes || []).filter((cell) => !grid.cells.some((c) => c.scenario === cell.scenario));
  for (const extra of extras) errors.push(`${extra.scenario}: not a registered calibration cell`);
  if (errors.length) return { ok: false, errors, cells: [], confirmed: [] };

  const cells = grid.cells.map((cell) => {
    const outcome = byScenario.get(cell.scenario);
    const rate = outcome.positives / outcome.rows;
    return {
      scenario: cell.scenario,
      persona: cell.persona,
      hardness: cell.hardness,
      authoredIndex: cell.authoredIndex,
      rows: outcome.rows,
      positives: outcome.positives,
      rate,
      distanceFromHalf: Math.abs(rate - 0.5),
      verdict: null,
    };
  });

  const survivors = [];
  for (const cell of cells) {
    if (cell.positives === 0) cell.verdict = 'dropped_floor';
    else if (cell.positives === cell.rows) cell.verdict = 'dropped_ceiling';
    else survivors.push(cell);
  }

  // "the 7 whose screen rates sit closest to .50 are confirmed (ties broken
  // toward the harder persona, P1 < P2 < P3 in authored order)"; within the
  // same distance and hardness, authored order keeps the pick deterministic.
  const ranked = [...survivors].sort(
    (a, b) => a.distanceFromHalf - b.distanceFromHalf || b.hardness - a.hardness || a.authoredIndex - b.authoredIndex,
  );
  const confirmedSet = new Set(ranked.slice(0, grid.confirm.maxConfirmedCells).map((cell) => cell.scenario));
  for (const cell of survivors) {
    cell.verdict = confirmedSet.has(cell.scenario) ? 'confirmed' : 'screened_unconfirmed';
  }

  const byVerdict = (verdict) => cells.filter((cell) => cell.verdict === verdict).map((cell) => cell.scenario);
  return {
    ok: true,
    errors: [],
    cells,
    confirmed: byVerdict('confirmed'),
    droppedFloor: byVerdict('dropped_floor'),
    droppedCeiling: byVerdict('dropped_ceiling'),
    screenedUnconfirmed: byVerdict('screened_unconfirmed'),
  };
}

/** Confirm-block jobs: top each confirmed cell up to targetRowsPerCell (§2.3). */
export function confirmTopUpJobs(decision, { grid = EDGED_REGISTER_CALIBRATION, startOrdinal } = {}) {
  if (!decision?.ok) throw new Error('confirm jobs need a completed screen decision');
  if (!Number.isInteger(startOrdinal) || startOrdinal < 1) {
    throw new Error('confirm jobs need the next job ordinal after the screen block');
  }
  const jobs = [];
  const confirmed = decision.cells
    .filter((cell) => cell.verdict === 'confirmed')
    .sort((a, b) => a.authoredIndex - b.authoredIndex);
  for (const cell of confirmed) {
    for (let repeat = cell.rows + 1; repeat <= grid.confirm.targetRowsPerCell; repeat += 1) {
      jobs.push({ ordinal: startOrdinal + jobs.length, block: 'confirm', scenario: cell.scenario, repeat });
    }
  }
  return jobs;
}

/**
 * The 120-row budget cap (§2.7 rule 3) counts paid generation attempts, not
 * successes: an attempted dialogue spends the budget whether or not the row
 * lands. Deferred jobs are the registered "unrun cells recorded as unmeasured".
 */
export function applyRowCap(jobs, rowsAlreadyAttempted, hardCap = EDGED_REGISTER_CALIBRATION.hardCapRows) {
  if (!Number.isInteger(rowsAlreadyAttempted) || rowsAlreadyAttempted < 0) {
    throw new Error(`rowsAlreadyAttempted must be a non-negative integer, got ${rowsAlreadyAttempted}`);
  }
  const room = Math.max(0, hardCap - rowsAlreadyAttempted);
  return { runnable: jobs.slice(0, room), deferred: jobs.slice(room) };
}

function binomialCdfAtMost(successes, trials, p) {
  if (p <= 0) return 1;
  if (p >= 1) return successes >= trials ? 1 : 0;
  const logP = Math.log(p);
  const logQ = Math.log(1 - p);
  let logCoefficient = 0; // log C(trials, 0)
  let total = 0;
  for (let k = 0; k <= successes; k += 1) {
    if (k > 0) logCoefficient += Math.log(trials - k + 1) - Math.log(k);
    total += Math.exp(logCoefficient + k * logP + (trials - k) * logQ);
  }
  return Math.min(1, total);
}

/**
 * Exact one-sided Clopper-Pearson upper bound: the p where observing at most
 * `successes` of `trials` has probability alpha = 1 - confidence. Solved by
 * bisection on the binomial CDF, which is exact and needs no special
 * functions at calibration sample sizes.
 */
export function clopperPearsonUpperBound(successes, trials, confidence = 0.8) {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || trials < 1) {
    throw new Error(`clopperPearsonUpperBound needs integer successes and trials >= 1, got ${successes}/${trials}`);
  }
  if (successes < 0 || successes > trials) {
    throw new Error(`successes ${successes} outside 0..${trials}`);
  }
  if (!(confidence > 0 && confidence < 1)) {
    throw new Error(`confidence must sit strictly between 0 and 1, got ${confidence}`);
  }
  if (successes === trials) return 1;
  const alpha = 1 - confidence;
  let low = successes / trials;
  let high = 1;
  for (let iteration = 0; iteration < 200 && high - low > 1e-12; iteration += 1) {
    const mid = (low + high) / 2;
    if (binomialCdfAtMost(successes, trials, mid) > alpha) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Pooled kept-cell baseline for main-block powering (§2.4, leak G1). */
export function pooledKeptCellBaseline(
  keptCells,
  { confidence = EDGED_REGISTER_CALIBRATION.corridor.baselineConfidence } = {},
) {
  let successes = 0;
  let trials = 0;
  for (const cell of keptCells || []) {
    if (!Number.isInteger(cell?.positives) || !Number.isInteger(cell?.rows) || cell.rows < 1) {
      throw new Error(`kept cell ${cell?.scenario || '(unnamed)'} carries no integer positives/rows`);
    }
    successes += cell.positives;
    trials += cell.rows;
  }
  if (!trials) return { successes: 0, trials: 0, rate: null, upperBound: null, confidence };
  return {
    successes,
    trials,
    rate: successes / trials,
    upperBound: clopperPearsonUpperBound(successes, trials, confidence),
    confidence,
  };
}

/**
 * Report-only harm guardrail (§2.7 rule 2): the same three deterministic
 * families the stance gate composes, run here on every warm row where no
 * stance gate applies. Coerced uptake reads the learner's reply to the turn.
 */
export function harmGuardrailFindings({ tutorMessage = '', postLearnerMessage = '' } = {}) {
  const findings = [];
  for (const match of personAttackMatches(tutorMessage)) {
    findings.push({ family: 'person_directed_contempt', match });
  }
  for (const match of statusShameMatches(tutorMessage)) {
    findings.push({ family: 'status_shame', match });
  }
  for (const match of appeasingUptakeMatches(postLearnerMessage)) {
    findings.push({ family: 'coerced_uptake', match });
  }
  return findings;
}

export default {
  EDGED_REGISTER_CALIBRATION,
  applyRowCap,
  buildEdgedRegisterCalibrationPlan,
  clopperPearsonUpperBound,
  confirmTopUpJobs,
  decideScreenOutcome,
  harmGuardrailFindings,
  hashEdgedRegisterCalibration,
  pooledKeptCellBaseline,
  validateEdgedRegisterCalibrationPlan,
};
