// Guards the corridor-selection layer of the edged-register calibration
// (notes/2026-08-16-edged-register-calibration-draft.md §2.4–§2.5): the
// adaptive counterfactual palette, the M-C1 edge-eligibility read over
// learner turns, the frozen kept/excluded corridor verdicts, the pooled
// baseline bound, the M-C2 first+last audit sample, and the >20%
// disagreement void rule. Pure logic — zero model calls, no DB.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EDGED_REGISTER_CALIBRATION as GRID } from '../services/edgedRegisterCalibration.js';
import {
  ADAPTIVE_COUNTERFACTUAL_MENU,
  auditSample,
  auditVerdict,
  corridorDecision,
  edgeEligibleMoments,
  rowEdgeEligibility,
} from '../services/edgedRegisterCorridor.js';
import { learnerTurnsFromDialogueLog } from '../scripts/select-edged-register-corridor.js';

const BORED = 'This is so boring, can we just skip to the answer?';
const FLOOD = 'Why? What is a numerator? Who invented this? When would I use it?';
const ASHAMED = 'This is boring and honestly I feel ashamed I still cannot do it.';
const REPAIR = 'This is boring. Also what does denominator mean in simpler words?';
const NEUTRAL = 'The denominator part, I think — can we slow down there?';

const turnsOf = (...texts) => texts.map((text, turnIndex) => ({ turnIndex, text }));

/** 12 pooled rows with the given counts of positives and eligible rows. */
const rowsOf = (positives, eligibleRows, { startOrdinal = 1 } = {}) =>
  Array.from({ length: GRID.corridor.pooledRows }, (_, index) => ({
    rowId: 100 + startOrdinal + index,
    ordinal: startOrdinal + index,
    positive: index < positives,
    eligible: index < eligibleRows,
  }));

const cellsWith = (overrides = {}) =>
  GRID.cells.slice(0, 7).map((cell, index) => ({
    scenario: cell.scenario,
    rows: rowsOf(...(overrides[cell.scenario] || [6, 12]), { startOrdinal: 1 + index * 12 }),
  }));

describe('adaptive counterfactual palette', () => {
  it('admits the edged registers and never face_threat', () => {
    assert.ok(ADAPTIVE_COUNTERFACTUAL_MENU.includes('ironic'));
    assert.ok(ADAPTIVE_COUNTERFACTUAL_MENU.includes('sarcastic'));
    assert.ok(!ADAPTIVE_COUNTERFACTUAL_MENU.includes('face_threat'));
  });
});

describe('M-C1 edge-eligibility read (§2.5)', () => {
  it('counts resistance moments the palette can answer with an edged register', () => {
    const moments = edgeEligibleMoments(turnsOf(NEUTRAL, BORED, FLOOD));
    assert.equal(moments.length, 2);
    assert.deepEqual(
      moments.map((moment) => moment.resistanceSignal),
      ['boredom', 'question_flood'],
    );
    assert.ok(moments.every((moment) => ['ironic', 'sarcastic'].includes(moment.selectedRegister)));
  });

  it('suppresses protected affect and comprehension repair', () => {
    assert.equal(rowEdgeEligibility(turnsOf(ASHAMED)).eligible, false);
    assert.equal(rowEdgeEligibility(turnsOf(REPAIR)).eligible, false);
    assert.equal(rowEdgeEligibility(turnsOf(NEUTRAL)).eligible, false);
    assert.equal(rowEdgeEligibility(turnsOf(NEUTRAL, BORED)).eligible, true);
  });

  it('is counterfactual on the palette: a warm-only menu yields no eligible moment', () => {
    assert.equal(edgeEligibleMoments(turnsOf(BORED), { menu: ['warm', 'plain'] }).length, 0);
  });

  it('reads learner turns out of a dialogue log shape', () => {
    const log = { turnResults: [{ learnerMessage: NEUTRAL }, { turnIndex: 1, learnerMessage: BORED }] };
    const turns = learnerTurnsFromDialogueLog(log);
    assert.deepEqual(turns, [
      { turnIndex: 0, text: NEUTRAL },
      { turnIndex: 1, text: BORED },
    ]);
  });
});

describe('corridor decision (§2.4 + §2.5)', () => {
  it('keeps pooled 4/12 through 8/12 and drops outside the corridor', () => {
    const [low, high, edgeLow, edgeHigh] = GRID.cells.map((cell) => cell.scenario);
    const decision = corridorDecision(
      cellsWith({ [low]: [3, 12], [high]: [9, 12], [edgeLow]: [4, 12], [edgeHigh]: [8, 12] }),
    );
    assert.equal(decision.ok, true);
    assert.ok(decision.outsideCorridor.includes(low));
    assert.ok(decision.outsideCorridor.includes(high));
    assert.ok(decision.kept.includes(edgeLow));
    assert.ok(decision.kept.includes(edgeHigh));
    assert.equal(decision.killStudy, false);
  });

  it('excludes a corridor-passing cell below 70% edge-eligible rows', () => {
    const target = GRID.cells[0].scenario;
    // 9/12 = 75% passes; 8/12 = 66.7% fails.
    const pass = corridorDecision(cellsWith({ [target]: [6, 9] }));
    assert.ok(pass.kept.includes(target));
    const fail = corridorDecision(cellsWith({ [target]: [6, 8] }));
    assert.deepEqual(fail.excludedEdgeIneligible, [target]);
    assert.ok(!fail.kept.includes(target));
  });

  it('reports the pooled upper-80%-bound baseline over kept cells only', () => {
    const excluded = GRID.cells[0].scenario;
    const decision = corridorDecision(cellsWith({ [excluded]: [3, 12] }));
    assert.equal(decision.baseline.trials, 6 * 12);
    assert.equal(decision.baseline.successes, 6 * 6);
    assert.ok(decision.baseline.upperBound > decision.baseline.rate);
  });

  it('kills the study when no cell survives (§2.7 rule 1)', () => {
    const overrides = Object.fromEntries(GRID.cells.slice(0, 7).map((cell) => [cell.scenario, [2, 12]]));
    const decision = corridorDecision(cellsWith(overrides));
    assert.deepEqual(decision.kept, []);
    assert.equal(decision.killStudy, true);
  });

  it('fails closed on short pools, unregistered cells, and unmeasured rows', () => {
    const short = cellsWith();
    short[0] = { ...short[0], rows: short[0].rows.slice(0, 11) };
    assert.equal(corridorDecision(short).ok, false);

    assert.equal(corridorDecision([{ scenario: 'not_a_cell', rows: rowsOf(6, 12) }]).ok, false);

    const unmeasured = cellsWith();
    unmeasured[0].rows[0] = { ...unmeasured[0].rows[0], positive: null };
    assert.equal(corridorDecision(unmeasured).ok, false);
  });
});

describe('M-C2 endpoint audit (§2.5)', () => {
  it('samples the first and last row by ordinal from each kept cell', () => {
    const cellRows = cellsWith();
    const decision = corridorDecision(cellRows);
    const sample = auditSample(cellRows, decision);
    assert.equal(sample.length, decision.kept.length * 2);
    const first = sample.find((entry) => entry.scenario === cellRows[0].scenario && entry.position === 'first');
    const last = sample.find((entry) => entry.scenario === cellRows[0].scenario && entry.position === 'last');
    assert.equal(first.ordinal, 1);
    assert.equal(last.ordinal, 12);
    assert.equal(typeof first.classifierPositive, 'boolean');
  });

  it('voids the corridor above 20% disagreement, holds at or below', () => {
    const cellRows = cellsWith();
    const sample = auditSample(cellRows, corridorDecision(cellRows)); // 14 rows
    const agree = sample.map((entry) => ({ rowId: entry.rowId, humanPositive: entry.classifierPositive }));

    const twoFlipped = agree.map((reading, index) =>
      index < 2 ? { ...reading, humanPositive: !reading.humanPositive } : reading,
    );
    const held = auditVerdict(sample, twoFlipped); // 2/14 = 14.3%
    assert.equal(held.ok, true);
    assert.equal(held.endpointVoid, false);

    const threeFlipped = agree.map((reading, index) =>
      index < 3 ? { ...reading, humanPositive: !reading.humanPositive } : reading,
    );
    const voided = auditVerdict(sample, threeFlipped); // 3/14 = 21.4%
    assert.equal(voided.endpointVoid, true);
  });

  it('fails closed on missing, non-boolean, or out-of-sample readings', () => {
    const cellRows = cellsWith();
    const sample = auditSample(cellRows, corridorDecision(cellRows));
    const readings = sample.map((entry) => ({ rowId: entry.rowId, humanPositive: entry.classifierPositive }));

    assert.equal(auditVerdict(sample, readings.slice(1)).ok, false);
    assert.equal(auditVerdict(sample, [{ ...readings[0], humanPositive: 'yes' }, ...readings.slice(1)]).ok, false);
    assert.equal(auditVerdict(sample, [...readings, { rowId: 999999, humanPositive: true }]).ok, false);
  });
});
