import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  buildSarcasmPreconditionGridPlan,
  SARCASM_PRECONDITION_GRID,
  summarizeSarcasmPreconditionGrid,
  validateSarcasmPreconditionGridPlan,
} from '../services/sarcasmPreconditionGrid.js';
import { followUpCommands, generationCommand } from '../scripts/run-sarcasm-precondition-grid.js';
import { stanceGateComponents, STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';
import { fisherExactTwoSided } from '../services/fisherExact.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIO_PATH = path.join(ROOT, 'config/charisma-recognition-desire-scenarios.yaml');

/**
 * @param {(scenario: string, repeat: number) => object} shape per-row overrides
 */
function analysesFor(shape) {
  const rows = [];
  for (const scenario of SARCASM_PRECONDITION_GRID.scenarios) {
    for (let repeat = 1; repeat <= SARCASM_PRECONDITION_GRID.repeats; repeat += 1) {
      const override = shape(scenario, repeat) || {};
      const stance = {
        applies: true,
        gateRegister: 'sarcastic_determinate',
        gateVersion: STANCE_GATE_VERSION,
        countsAsArmEvidence: false,
        countsAsExcludedNoncompliance: true,
        countsAsInvalidViolation: false,
        namedTargetClaim: { named: false },
        ...(override.stanceFidelity || {}),
      };
      rows.push({
        rowId: `${scenario}-${repeat}`,
        profileName: SARCASM_PRECONDITION_GRID.profiles[0],
        scenarioId: scenario,
        tutorV22Score: 60,
        tutorRubricVersion: '2.2',
        tutorJudgeModel: 'claude-code/claude-sonnet-5',
        registerRubricScore: 70,
        registerJudgeModel: 'claude-code.sonnet-5',
        positiveOutcome: true,
        ...override,
        stanceFidelity: stance,
      });
    }
  }
  return rows;
}

/** The precondition-supported shape: claimed rows name claims and hold the manner, plain rows do neither. */
function supportedAnalyses() {
  return analysesFor((scenario) => {
    const claimed = SARCASM_PRECONDITION_GRID.conditions[scenario] === 'claimed';
    return {
      stanceFidelity: {
        countsAsArmEvidence: claimed,
        countsAsExcludedNoncompliance: !claimed,
        namedTargetClaim: { named: claimed },
      },
    };
  });
}

describe('sarcasm precondition grid', () => {
  it('freezes a deterministic 1 x 4 x 4 plan with balanced conditions', () => {
    const first = buildSarcasmPreconditionGridPlan();
    const second = buildSarcasmPreconditionGridPlan();
    assert.equal(validateSarcasmPreconditionGridPlan(first).ok, true);
    assert.equal(first.plannedRows, 16);
    assert.equal(first.planSha256, second.planSha256);
    assert.equal(first.jobs.filter((job) => job.condition === 'plain').length, 8);
    assert.equal(first.jobs.filter((job) => job.condition === 'claimed').length, 8);
    // Each mood appears in both conditions: that pairing IS the design.
    for (const mood of ['boredom', 'frustration']) {
      const conditions = new Set(first.jobs.filter((job) => job.mood === mood).map((job) => job.condition));
      assert.deepEqual([...conditions].sort(), ['claimed', 'plain']);
    }
  });

  it('names its gate, version and fold in the plan', () => {
    const plan = buildSarcasmPreconditionGridPlan();
    assert.equal(plan.measurement.gateRegister, 'sarcastic_determinate');
    assert.equal(plan.measurement.gateVersion, STANCE_GATE_VERSION);
    assert.equal(plan.measurement.fold, 'adopting_turn');
  });

  it('holds the tutor fixed and varies only the learner scenario', () => {
    const plan = buildSarcasmPreconditionGridPlan();
    assert.equal(new Set(plan.jobs.map((job) => job.profile)).size, 1);
    const command = generationCommand().join(' ');
    assert.match(command, /cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified/);
    assert.match(command, /--runs 4/);
    assert.match(command, /--skip-rubric/);
    // Standing rule: never default the weak pairing.
    assert.doesNotMatch(command, /nemotron|kimi/);
  });

  it('routes scoring through tutor v2.2 and the sonnet-class register judge', () => {
    const commands = followUpCommands('eval-test').map((command) => command.join(' '));
    assert.match(commands[0], /evaluate eval-test --tutor-only/);
    assert.match(commands[0], /claude-sonnet-5/);
    assert.match(commands[1], /evaluate-register-rubric\.js eval-test --judge claude-code\.sonnet-5/);
    assert.match(commands[2], /--report-run eval-test/);
  });

  it('registers scenarios that exist in the scenario source and inherit their mood parent', () => {
    const scenarios = yaml.parse(fs.readFileSync(SCENARIO_PATH, 'utf8'))?.scenarios || {};
    for (const scenario of SARCASM_PRECONDITION_GRID.scenarios) {
      assert.ok(scenarios[scenario], `${scenario} missing from ${SARCASM_PRECONDITION_GRID.scenarioSource}`);
    }
    for (const [claimed, plain] of [
      ['charisma_desire_resistance_breakthrough_boredom_claimed', 'charisma_desire_resistance_breakthrough_boredom'],
      [
        'charisma_desire_resistance_breakthrough_frustration_claimed',
        'charisma_desire_resistance_breakthrough_frustration',
      ],
    ]) {
      // The pair must differ in the learner's supply of a claim and nothing
      // else, so persona and target signal are inherited, not restated anew.
      assert.equal(scenarios[claimed].extends, plain);
      assert.equal(scenarios[claimed].learner_persona, scenarios[plain].learner_persona);
      assert.equal(scenarios[claimed].resistance_signal_target, scenarios[plain].resistance_signal_target);
      assert.equal(scenarios[claimed].claim_bearing_resistance, true);
      assert.notEqual(scenarios[claimed].learner_context, scenarios[plain].learner_context);
    }
  });

  it("keeps the claim out of the other resistance targets' vocabulary", () => {
    const scenarios = yaml.parse(fs.readFileSync(SCENARIO_PATH, 'utf8'))?.scenarios || {};
    // A claim phrased as "it's just a formula" would make the message a
    // rote-parroting probe wearing a mood label, and the contrast would be
    // between resistance targets rather than between claim and no claim.
    for (const scenario of ['boredom_claimed', 'frustration_claimed'].map(
      (suffix) => `charisma_desire_resistance_breakthrough_${suffix}`,
    )) {
      const context = String(scenarios[scenario].learner_context || '').toLowerCase();
      for (const word of ['formula', 'parrot', 'memoriz', 'what does this have to do']) {
        assert.ok(!context.includes(word), `${scenario} learner_context leaks "${word}"`);
      }
    }
  });

  it('reports the supported shape as PRECONDITION_SUPPORTED with both conditions kept apart', () => {
    const report = summarizeSarcasmPreconditionGrid(supportedAnalyses());
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.verdict, 'PRECONDITION_SUPPORTED');
    const plain = report.byCondition.find((entry) => entry.condition === 'plain');
    const claimed = report.byCondition.find((entry) => entry.condition === 'claimed');
    assert.equal(plain.heldTheManner, 0);
    assert.equal(claimed.heldTheManner, 8);
    assert.equal(report.contrasts.primary.claimed, '8/8');
    assert.equal(report.contrasts.primary.plain, '0/8');
    assert.ok(report.contrasts.primary.p < 0.05);
    assert.equal(report.byScenario.length, 4);
  });

  it('refuses to read the primary contrast when the manipulation check fails', () => {
    // Claimed rows hold the manner but never actually named a claim: the
    // manipulation did not take, so the precondition was not tested.
    const report = summarizeSarcasmPreconditionGrid(
      analysesFor((scenario) => ({
        stanceFidelity: {
          countsAsArmEvidence: SARCASM_PRECONDITION_GRID.conditions[scenario] === 'claimed',
          countsAsExcludedNoncompliance: SARCASM_PRECONDITION_GRID.conditions[scenario] !== 'claimed',
          namedTargetClaim: { named: false },
        },
      })),
    );
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.verdict, 'MANIPULATION_FAILED_PRECONDITION_UNTESTED');
  });

  it('reports a refutation when claims land but the manner still does not', () => {
    const report = summarizeSarcasmPreconditionGrid(
      analysesFor((scenario) => ({
        stanceFidelity: {
          countsAsArmEvidence: false,
          countsAsExcludedNoncompliance: true,
          namedTargetClaim: { named: SARCASM_PRECONDITION_GRID.conditions[scenario] === 'claimed' },
        },
      })),
    );
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.verdict, 'PRECONDITION_REFUTED');
  });

  it('fails closed when rows mix stance gates', () => {
    const analyses = supportedAnalyses();
    analyses[0].stanceFidelity.gateRegister = 'sarcastic';
    const report = summarizeSarcasmPreconditionGrid(analyses);
    assert.equal(report.status, 'INCOMPLETE');
    assert.equal(report.verdict, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /mix stance gates/.test(error)));
  });

  it('carries the faithful count next to every part of the gate it came from', () => {
    // Naming the gate is not enough: the report also has to show how passing
    // splits against the gate's parts, so a count carried by the wrong part is
    // visible without anyone thinking to ask.
    const report = summarizeSarcasmPreconditionGrid(supportedAnalyses());
    assert.equal(report.componentContingency.gates.length, 1);
    const [gate] = report.componentContingency.gates;
    assert.equal(gate.gate, `sarcastic_determinate@${STANCE_GATE_VERSION}`);
    assert.deepEqual(
      gate.parts.map((part) => part.key),
      stanceGateComponents('sarcastic_determinate').map((part) => part.key),
    );
  });

  it('fails closed when a passing row lacked a part the gate calls necessary', () => {
    // The shape that reached a published number: a turn with no sarcastic
    // marker scored 75 and was counted as having held the sarcastic manner.
    const analyses = supportedAnalyses();
    analyses[0].stanceFidelity.passed = true;
    analyses[0].stanceFidelity.missing = ['register_marker'];
    const report = summarizeSarcasmPreconditionGrid(analyses);
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /counted faithful without register_marker/.test(error)));
  });

  it('fails closed when a row carries no named-claim component', () => {
    const analyses = supportedAnalyses();
    delete analyses[0].stanceFidelity.namedTargetClaim;
    const report = summarizeSarcasmPreconditionGrid(analyses);
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /named-target-claim component/.test(error)));
  });

  it('fails closed on missing rows, scores, judges and outcome verdicts', () => {
    assert.equal(summarizeSarcasmPreconditionGrid(supportedAnalyses().slice(0, 15)).status, 'INCOMPLETE');
    for (const mutate of [
      (rows) => (rows[0].tutorV22Score = null),
      (rows) => (rows[0].tutorRubricVersion = '2.1'),
      (rows) => (rows[0].tutorJudgeModel = 'openrouter/gpt-mini'),
      (rows) => (rows[0].registerRubricScore = null),
      (rows) => (rows[0].registerJudgeModel = 'openrouter.gpt-mini'),
      (rows) => (rows[0].positiveOutcome = null),
      (rows) => (rows[0].stanceFidelity.applies = false),
    ]) {
      const rows = supportedAnalyses();
      mutate(rows);
      assert.equal(summarizeSarcasmPreconditionGrid(rows).status, 'INCOMPLETE');
    }
  });

  it('keeps invalid person-attack violations separate from noncompliance exclusions', () => {
    const rows = supportedAnalyses();
    rows[0].stanceFidelity.countsAsArmEvidence = false;
    rows[0].stanceFidelity.countsAsInvalidViolation = true;
    rows[0].stanceFidelity.countsAsExcludedNoncompliance = false;
    const report = summarizeSarcasmPreconditionGrid(rows);
    const plain = report.byCondition.find((entry) => entry.condition === 'plain');
    assert.equal(plain.invalidViolations, 1);
    // The attack row leaves the exclusion count rather than being double-counted:
    // 7 of the 8 plain rows are still ordinary noncompliance.
    assert.equal(plain.excludedNoncompliance, 7);
    // The three categories partition the condition's rows.
    assert.equal(plain.heldTheManner + plain.excludedNoncompliance + plain.invalidViolations, plain.rows);
  });

  it('buckets by scenario, so a claimed row never lands in its plain parent', () => {
    // Both boredom scenarios share resistance_signal_target "boredom"; keying
    // the report on the target signal would silently pool the two conditions.
    const report = summarizeSarcasmPreconditionGrid(supportedAnalyses());
    const plainBoredom = report.byScenario.find(
      (entry) => entry.scenario === 'charisma_desire_resistance_breakthrough_boredom',
    );
    const claimedBoredom = report.byScenario.find(
      (entry) => entry.scenario === 'charisma_desire_resistance_breakthrough_boredom_claimed',
    );
    assert.equal(plainBoredom.rows, 4);
    assert.equal(claimedBoredom.rows, 4);
    assert.equal(plainBoredom.mood, claimedBoredom.mood);
    assert.notEqual(plainBoredom.condition, claimedBoredom.condition);
  });

  it('reproduces the pre-registered power figures', () => {
    // Stated in the note so a middling result cannot be re-read as a success.
    assert.ok(Math.abs(fisherExactTwoSided(5, 3, 0, 8) - 0.0256) < 0.001);
    assert.ok(fisherExactTwoSided(4, 4, 0, 8) > 0.05);
  });
});
