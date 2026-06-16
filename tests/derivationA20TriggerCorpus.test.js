import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  A20_POLICY_FIXTURES_SCHEMA,
  analyzeArtifacts,
  collectTriggersFromResult,
  renderMarkdown,
  writeOutputs,
} from '../scripts/derivation-a20-trigger-corpus.js';

function tmpRoot() {
  return mkdtempSync(path.join(os.tmpdir(), 'a20-trigger-corpus-'));
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

function dependencyRepairResult() {
  return {
    worldId: 'world_004_withercombe',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 9,
    firstForcedTurn: 9,
    assertedGroundedTurn: 9,
    trajectory: [
      { turn: 5, D: 3 },
      { turn: 6, D: 2 },
      { turn: 9, D: 0 },
    ],
    corruption: {
      ledger: [
        { turn: 5, type: 'decay', premiseId: 'p_course', fact: ['fedBy', 'schoolWell', 'fontHouse'] },
        { turn: 6, type: 'repair', premiseId: 'p_course', via: 'tutor' },
      ],
    },
    transcript: [
      {
        turn: 6,
        role: 'tutor',
        text: "Put the sexton's line back before we go on.",
        meta: {
          move: { intent: 'restore', targetPremise: 'p_course', figure: 'erotema' },
          proofDebt: { active: true, target: 'p_course' },
        },
      },
      {
        turn: 6,
        role: 'learner',
        text: 'Right, the school well is fed by the font-house lead.',
        meta: { adopt: [['fedBy', 'schoolWell', 'fontHouse']] },
      },
    ],
  };
}

function assertionGapResult() {
  return {
    worldId: 'world_003_bitterwell',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 8,
    firstForcedTurn: 6,
    assertedGroundedTurn: 8,
    trajectory: [
      { turn: 6, D: 0, forced: true },
      { turn: 8, D: 0, forced: true },
    ],
    transcript: [
      {
        turn: 6,
        role: 'tutor',
        text: 'What is still missing from the record?',
        meta: { move: { intent: 'test', targetPremise: 'p_final' } },
      },
      {
        turn: 6,
        role: 'learner',
        text: 'I can see the shape, but I am not naming it yet.',
        meta: {},
      },
    ],
  };
}

function selectorSummary() {
  return {
    schema: 'test',
    comparisons: [
      {
        key: 'hethel-selector-v1\tr2',
        group: 'hethel-selector-v1',
        run: 2,
        worldId: 'world_006_hethel',
        classification: 'strict_v_positive',
        reasons: ['visible/selective-visible grounded while hidden and baseline did not'],
        selected: {
          label: 'hethel-selector-v1-selective-r2',
          arm: 'selective',
          selected: 'visible',
          gate: 'mirror_dead_predicate_visible',
          grounded: true,
          turns: 20,
          finalD: 0,
        },
        arms: {
          baseline: { label: 'hethel-selector-v1-baseline-r2', verdict: 'aporia', finalD: 5 },
          hidden: { label: 'hethel-selector-v1-hidden-r2', verdict: 'disengagement', finalD: 5 },
          visible: { label: 'hethel-selector-v1-visible-r2', verdict: 'grounded_anagnorisis', finalD: 0 },
        },
        firstSelectedGuardIntervention: {
          turn: 4,
          guard: 'visible',
          kind: 'block',
          premise: 'p_point',
          reason: 'p_point held: prior exhibit m_record not taken up on the page',
        },
        divergence: { turn: 4, kind: 'D', a: 5, b: 4 },
      },
    ],
  };
}

test('collectTriggersFromResult emits dependency repair and assertion-gap triggers', () => {
  const root = tmpRoot();
  try {
    const depFile = path.join(root, 'withercombe-debt-hidden-r1', 'result.json');
    const gapFile = path.join(root, 'bitterwell-gap-r1', 'result.json');
    writeJson(depFile, dependencyRepairResult());
    writeJson(gapFile, assertionGapResult());

    const dep = collectTriggersFromResult(depFile, dependencyRepairResult()).triggers;
    assert.equal(dep.length, 1);
    assert.equal(dep[0].triggerType, 'dependency_repair_needed');
    assert.equal(dep[0].expectedMoveFamily, 'repair_dependency');
    assert.equal(dep[0].actualMoveFamily, 'repair_dependency');
    assert.equal(dep[0].status, 'reference_success');
    assert.equal(dep[0].failureClass, null);

    const gap = collectTriggersFromResult(gapFile, assertionGapResult()).triggers;
    assert.equal(gap.length, 1);
    assert.equal(gap[0].triggerType, 'final_assertion_available_but_delayed');
    assert.equal(gap[0].expectedMoveFamily, 'invite_final_assertion');
    assert.equal(gap[0].failureClass, 'policy_failure');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('analyzeArtifacts chooses the first two A20 policy fixtures', () => {
  const root = tmpRoot();
  try {
    const loopRoot = path.join(root, 'loop');
    const depFile = path.join(loopRoot, 'withercombe-debt-hidden-r1', 'result.json');
    const gapFile = path.join(loopRoot, 'bitterwell-gap-r1', 'result.json');
    const selectorFile = path.join(root, 'selector-summary.json');
    writeJson(depFile, dependencyRepairResult());
    writeJson(gapFile, assertionGapResult());
    writeJson(selectorFile, selectorSummary());

    const summary = analyzeArtifacts({ roots: [loopRoot], selectorSummaryPath: selectorFile });
    assert.equal(summary.triggerCount, 3);
    assert.equal(summary.counts.byType.dependency_repair_needed, 1);
    assert.equal(summary.counts.byType.final_assertion_available_but_delayed, 1);
    assert.equal(summary.counts.byType.valid_alternative_route_candidate, 1);
    assert.deepEqual(
      summary.firstPolicyFixtures.map((fixture) => fixture.fixtureId),
      ['a20-fixture-001-dependency-repair-reference', 'a20-fixture-002-hidden-hurts-candidate'],
    );

    const md = renderMarkdown(summary);
    assert.match(md, /A20 Conduct-Policy Trigger Corpus/);
    assert.match(md, /First Policy Fixtures/);
    assert.match(md, /a20-fixture-002-hidden-hurts-candidate/);

    const outDir = path.join(root, 'out');
    const outputs = writeOutputs(summary, outDir);
    assert.equal(existsSync(outputs.jsonlPath), true);
    assert.equal(existsSync(outputs.summaryPath), true);
    assert.equal(existsSync(outputs.reportPath), true);
    assert.equal(existsSync(outputs.fixturesPath), true);
    assert.match(readFileSync(outputs.jsonlPath, 'utf8'), /dependency_repair_needed/);
    const frozen = JSON.parse(readFileSync(outputs.fixturesPath, 'utf8'));
    assert.equal(frozen.schema, A20_POLICY_FIXTURES_SCHEMA);
    assert.deepEqual(
      frozen.fixtures.map((fixture) => fixture.fixtureId),
      ['a20-fixture-001-dependency-repair-reference', 'a20-fixture-002-hidden-hurts-candidate'],
    );
    assert.equal(frozen.fixtures[1].trigger.triggerType, 'valid_alternative_route_candidate');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
