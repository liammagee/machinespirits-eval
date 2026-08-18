// Corridor selection for the edged-register calibration
// (notes/2026-08-16-edged-register-calibration-draft.md §2.4–§2.5).
//
// Pure logic only: the corridor rule (kept = pooled 4/12–8/12), the M-C1
// edge-eligibility screen (frozen edge-timing detector with the adaptive
// menu as counterfactual palette, ≥70% of rows with at least one
// edged-eligible resistance moment), the M-C2 endpoint-audit sample (first
// and last row by ordinal per kept cell) and its >20%-disagreement void
// rule, and the pooled upper-80%-bound baseline for main-block powering.
// The zero-call CLI wrapper is scripts/select-edged-register-corridor.js.

import { buildTutorStubEdgeTimingSelection } from './tutorStubEdgeTimingPolicy.js';
import { getRouterSelectableEngagementRegisterNames } from './engagementRegisterRegistry.js';
import { EDGED_REGISTER_CALIBRATION, pooledKeptCellBaseline } from './edgedRegisterCalibration.js';

/**
 * Arm A's register menu, used counterfactually over warm-arm transcripts:
 * the ordinary router-selectable registers with the cell-scoped edged
 * additions admitted. face_threat stays out by construction (simulated-only,
 * never router-selectable).
 */
export const ADAPTIVE_COUNTERFACTUAL_MENU = Object.freeze(
  getRouterSelectableEngagementRegisterNames(['ironic', 'sarcastic']),
);

/**
 * Edged-eligible resistance moments in one row's learner turns (§2.5 M-C1):
 * resistance-phase turns with no protected-affect and no comprehension-repair
 * suppression, where the counterfactual palette admits an edged register for
 * the detected signal (edge_eligible from the frozen policy overlay).
 *
 * @param {Array<{turnIndex: number, text: string}>} learnerTurns
 */
export function edgeEligibleMoments(learnerTurns, { menu = ADAPTIVE_COUNTERFACTUAL_MENU } = {}) {
  const state = { register: { palette: [...menu] } };
  const moments = [];
  for (const turn of learnerTurns || []) {
    const text = String(turn?.text || '');
    if (!text) continue;
    const { edge_timing: edgeTiming } = buildTutorStubEdgeTimingSelection({ state, learnerText: text });
    if (edgeTiming.edge_eligible === true) {
      moments.push({
        turnIndex: turn.turnIndex,
        resistanceSignal: edgeTiming.resistance_signal,
        selectedRegister: edgeTiming.selected_register,
      });
    }
  }
  return moments;
}

export function rowEdgeEligibility(learnerTurns, options = {}) {
  const moments = edgeEligibleMoments(learnerTurns, options);
  return { eligible: moments.length > 0, moments };
}

function integerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * The frozen corridor decision (§2.4) plus the M-C1 screen (§2.5) over
 * pooled screen+confirm rows. Fail-closed: every supplied cell must be a
 * registered calibration cell carrying exactly the pooled row count, and
 * every row must carry a boolean endpoint outcome and eligibility read.
 *
 * @param {Array<{scenario: string, rows: Array<{rowId: number|string, ordinal: number, positive: boolean, eligible: boolean}>}>} cellRows
 */
export function corridorDecision(cellRows, { grid = EDGED_REGISTER_CALIBRATION } = {}) {
  const errors = [];
  const registered = new Set(grid.cells.map((cell) => cell.scenario));
  const cells = [];
  for (const cell of cellRows || []) {
    if (!registered.has(cell.scenario)) {
      errors.push(`${cell.scenario}: not a registered calibration cell`);
      continue;
    }
    const rows = Array.isArray(cell.rows) ? cell.rows : [];
    if (rows.length !== grid.corridor.pooledRows) {
      errors.push(`${cell.scenario}: expected ${grid.corridor.pooledRows} pooled rows, found ${rows.length}`);
      continue;
    }
    for (const row of rows) {
      if (typeof row.positive !== 'boolean' || typeof row.eligible !== 'boolean' || !Number.isInteger(row.ordinal)) {
        errors.push(
          `${cell.scenario}: row ${row.rowId ?? '(unnamed)'} lacks a boolean outcome, eligibility, or ordinal`,
        );
      }
    }
    cells.push(cell);
  }
  if (errors.length) return { ok: false, errors, cells: [], kept: [], baseline: null, killStudy: false };

  const decided = cells.map((cell) => {
    const positives = cell.rows.filter((row) => row.positive).length;
    const eligibleRows = cell.rows.filter((row) => row.eligible).length;
    const rows = cell.rows.length;
    const inCorridor = integerInRange(positives, grid.corridor.keptMinPositives, grid.corridor.keptMaxPositives);
    // ≥70% as an exact integer comparison — no float threshold.
    const edgeEligible = eligibleRows * 10 >= rows * 7;
    let verdict;
    if (!inCorridor) {
      verdict = positives < grid.corridor.keptMinPositives ? 'outside_corridor_low' : 'outside_corridor_high';
    } else if (!edgeEligible) {
      verdict = 'excluded_edge_ineligible';
    } else {
      verdict = 'kept';
    }
    return { scenario: cell.scenario, rows, positives, eligibleRows, verdict };
  });

  const kept = decided.filter((cell) => cell.verdict === 'kept');
  const baseline = kept.length
    ? pooledKeptCellBaseline(
        kept.map((cell) => ({ scenario: cell.scenario, positives: cell.positives, rows: cell.rows })),
      )
    : null;
  return {
    ok: true,
    errors: [],
    cells: decided,
    kept: kept.map((cell) => cell.scenario),
    excludedEdgeIneligible: decided
      .filter((cell) => cell.verdict === 'excluded_edge_ineligible')
      .map((cell) => cell.scenario),
    outsideCorridor: decided.filter((cell) => cell.verdict.startsWith('outside_corridor')).map((cell) => cell.scenario),
    baseline,
    // §2.7 rule 1: no cell kept after §2.4 + §2.5 kills the study.
    killStudy: kept.length === 0,
  };
}

/**
 * M-C2 endpoint-audit sample (§2.5): the first and last row by ordinal from
 * every kept cell, carrying the classifier's verdict for the human reader.
 */
export function auditSample(cellRows, decision) {
  if (!decision?.ok) throw new Error('the audit sample needs a completed corridor decision');
  const keptSet = new Set(decision.kept);
  const sample = [];
  for (const cell of cellRows || []) {
    if (!keptSet.has(cell.scenario)) continue;
    const ordered = [...cell.rows].sort((a, b) => a.ordinal - b.ordinal);
    if (ordered.length < 2) throw new Error(`${cell.scenario}: kept cell has fewer than 2 rows to audit`);
    for (const [position, row] of [
      ['first', ordered[0]],
      ['last', ordered.at(-1)],
    ]) {
      sample.push({
        scenario: cell.scenario,
        rowId: row.rowId,
        ordinal: row.ordinal,
        position,
        classifierPositive: row.positive,
      });
    }
  }
  return sample;
}

/**
 * M-C2 verdict (§2.5): human readings against the classifier's binary
 * outcome. More than 20% disagreement voids the corridor estimates for
 * selection. Fail-closed: every sampled row needs exactly one reading.
 */
export function auditVerdict(sample, readings) {
  const errors = [];
  const byRowId = new Map();
  for (const reading of readings || []) {
    if (byRowId.has(reading.rowId)) errors.push(`row ${reading.rowId}: more than one reading supplied`);
    byRowId.set(reading.rowId, reading);
  }
  let disagreements = 0;
  for (const entry of sample || []) {
    const reading = byRowId.get(entry.rowId);
    if (!reading || typeof reading.humanPositive !== 'boolean') {
      errors.push(`row ${entry.rowId} (${entry.scenario}, ${entry.position}): no boolean human reading`);
      continue;
    }
    if (reading.humanPositive !== entry.classifierPositive) disagreements += 1;
  }
  const extras = (readings || []).filter((reading) => !(sample || []).some((entry) => entry.rowId === reading.rowId));
  for (const extra of extras) errors.push(`row ${extra.rowId}: reading outside the fixed sample`);
  if (errors.length) return { ok: false, errors, audited: 0, disagreements: 0, endpointVoid: false };

  const audited = sample.length;
  // "more than 20%" as an exact integer comparison.
  const endpointVoid = disagreements * 5 > audited;
  return {
    ok: true,
    errors: [],
    audited,
    disagreements,
    disagreementRate: audited ? disagreements / audited : 0,
    endpointVoid,
  };
}

export default {
  ADAPTIVE_COUNTERFACTUAL_MENU,
  auditSample,
  auditVerdict,
  corridorDecision,
  edgeEligibleMoments,
  rowEdgeEligibility,
};
