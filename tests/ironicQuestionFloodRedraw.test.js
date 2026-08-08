/**
 * Guards for the ironic question-flood second draw.
 *
 * Two things have to hold for three rows to mean anything. The draw must ask
 * for what the first draw asked for, so a difference between the counts is
 * sampling — that is pinned by comparing this plan's generation and scoring
 * against the parent grid's rather than against a copy. And the reading must be
 * fixed before the run, so a 2/3 cannot be talked into a 3/3 afterwards — that
 * is pinned by testing the decision rule at every count it can return.
 */

import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';

import {
  buildIronicQuestionFloodRedrawPlan,
  IRONIC_QUESTION_FLOOD_REDRAW,
  readRedrawVerdict,
  validateIronicQuestionFloodRedrawPlan,
} from '../services/ironicQuestionFloodRedraw.js';
import { NEGATIVE_REGISTER_EFFECT_GRID } from '../services/negativeRegisterEffectGrid.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The frozen plan. A change here is a change to what was authorized, so it
 * fails the test rather than passing quietly under a new hash.
 */
const FROZEN_PLAN_SHA = 'b980609c49b8a758abd122c4a07c2106873d2cd89cd529c2532ab9f943db9947';

test('the plan is three rows of one cell, and its hash is the frozen one', () => {
  const plan = buildIronicQuestionFloodRedrawPlan();
  assert.equal(plan.plannedRows, 3);
  assert.equal(plan.jobs.length, 3);
  assert.deepEqual(new Set(plan.jobs.map((job) => job.profile)).size, 1);
  assert.deepEqual(new Set(plan.jobs.map((job) => job.scenario)).size, 1);
  assert.match(plan.jobs[0].profile, /^cell_196_/);
  assert.match(plan.jobs[0].scenario, /question_flood$/);
  assert.equal(plan.planSha256, FROZEN_PLAN_SHA);
  assert.equal(validateIronicQuestionFloodRedrawPlan(plan).ok, true);
});

test('the draw asks for exactly what the first draw asked for', () => {
  const plan = buildIronicQuestionFloodRedrawPlan();
  assert.deepEqual(plan.generation, { ...NEGATIVE_REGISTER_EFFECT_GRID.generation });
  assert.deepEqual(plan.scoring, { ...NEGATIVE_REGISTER_EFFECT_GRID.scoring });
  assert.equal(plan.scenarioSource, NEGATIVE_REGISTER_EFFECT_GRID.scenarioSource);
});

test('a generation or scoring change against the prior draw fails the plan', () => {
  const plan = buildIronicQuestionFloodRedrawPlan();
  const swappedSeat = validateIronicQuestionFloodRedrawPlan({
    ...plan,
    generation: { ...plan.generation, tutorModel: 'openrouter.nemotron' },
  });
  assert.equal(swappedSeat.ok, false);
  assert.ok(swappedSeat.errors.some((error) => error.includes('generation.tutorModel')));

  const swappedJudge = validateIronicQuestionFloodRedrawPlan({
    ...plan,
    scoring: { ...plan.scoring, registerJudge: 'openrouter.gpt-mini' },
  });
  assert.equal(swappedJudge.ok, false);
  assert.ok(swappedJudge.errors.some((error) => error.includes('scoring.registerJudge')));
});

test('the gate is the plain one for this register, on the adopting turn', () => {
  assert.equal(IRONIC_QUESTION_FLOOD_REDRAW.gate, 'ironic');
  assert.equal(IRONIC_QUESTION_FLOOD_REDRAW.fold, 'resistance_turn');
});

test('the verdict is read from the frozen rule at every count it can return', () => {
  assert.equal(readRedrawVerdict({ held: 0, n: 3 }).verdict, 'THREAD_CLOSES');
  assert.equal(readRedrawVerdict({ held: 1, n: 3 }).verdict, 'THREAD_CLOSES');
  assert.equal(readRedrawVerdict({ held: 2, n: 3 }).verdict, 'INCONCLUSIVE');
  assert.equal(readRedrawVerdict({ held: 3, n: 3 }).verdict, 'CLEARS_FOR_DESIGN');
});

test('a short draw is incomplete rather than read as a low count', () => {
  const short = readRedrawVerdict({ held: 0, n: 2 });
  assert.equal(short.verdict, 'INCOMPLETE');
  assert.match(short.reading, /expected 3 rows, found 2/);
});

test('the launcher licenses no claim and locks the paid launch by default', () => {
  assert.equal(IRONIC_QUESTION_FLOOD_REDRAW.decisionRule.claimsLicensed.startsWith('none'), true);
  const source = fs.readFileSync(path.join(ROOT, 'scripts/run-ironic-question-flood-redraw.js'), 'utf8');
  assert.match(source, /locked_pending_explicit_user_approval/);
  assert.match(source, /--launch-approved also requires --expected-sha/);
});
