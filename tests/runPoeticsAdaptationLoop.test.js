import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildIterationPlan,
  DEFAULT_CRITICS,
  evaluateRunGate,
  parseArgs,
} from '../scripts/run-poetics-adaptation-loop.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsRun,
  upsertPoeticsScore,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

function modelSlug(model) {
  return String(model)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function gateArgs(runId) {
  return {
    runId,
    targetOnly: ['D42'],
    targetArms: ['routine', 'none', 'peripeteia-only'],
    minCritics: 4,
    recognitionVoteCut: 3,
    originVoteCut: 3,
    actionVoteCut: 3,
    controlMaxRecognitionVotes: 1,
  };
}

function scoreMetadata({ origin = 'none', actional = 0, mechanism = 0 } = {}) {
  return {
    recognition_origin: { class: origin },
    actional_breakthrough: actional,
    tutor_adaptive_mechanism: mechanism,
    adaptive_mechanism_quality: mechanism,
    role_symmetric_scores: {
      learner_actional_breakthrough: { score100: actional },
      tutor_adaptive_mechanism: { score100: mechanism },
      tutor_adaptive_mechanism_quality: { score100: mechanism },
    },
  };
}

function addItem(db, runId, { arm, tid, qualityStatus = 'ok', qualityWarnings = [] }) {
  const itemId = `${runId}:target-r01:${arm}:${tid}`;
  upsertPoeticsItem(db, {
    id: itemId,
    runId,
    unitId: 'target-r01',
    repeat: 'r01',
    arm,
    tid,
    dramaId: 'D42',
    discipline: 'music',
    condition: arm,
    intendedLean: arm === 'peripeteia-only' ? 'recognition' : 'flat',
    samplePath: `sample/${arm}/${tid}.txt`,
    fullTranscriptPath: `transcripts/${arm}/${tid}.full.md`,
    keyPath: `key-${arm}.yaml`,
    qualityStatus,
    qualityWarnings,
    metadata: {},
  });
  return itemId;
}

function addScore(
  db,
  itemId,
  critic,
  { formClass = 'flat', origin = 'none', actional = 0, mechanism = 0, error = null } = {},
) {
  upsertPoeticsScore(db, {
    itemId,
    criticModel: critic,
    scoreFile: `scores/${itemId}-${modelSlug(critic)}.json`,
    formClass: error ? null : formClass,
    recontextualization: formClass === 'recognition' ? 100 : 0,
    statedInsight: formClass === 'recognition' ? 100 : 0,
    errorMessage: error,
    flags: [],
    metadata: scoreMetadata({ origin, actional, mechanism }),
  });
}

function seedRun(db, runId, { routineForms = ['flat', 'flat', 'flat', 'flat'] } = {}) {
  upsertPoeticsRun(db, {
    id: runId,
    sourceRoot: `config/poetics-calibration/${runId}`,
    batchId: runId,
    generator: 'codex',
    metadata: {},
  });

  const routineId = addItem(db, runId, { arm: 'routine', tid: 'T01' });
  const noneId = addItem(db, runId, { arm: 'none', tid: 'T01' });
  const peripeteiaId = addItem(db, runId, { arm: 'peripeteia-only', tid: 'T01' });

  for (const [i, critic] of DEFAULT_CRITICS.entries()) {
    addScore(db, routineId, critic, {
      formClass: routineForms[i] || 'flat',
      origin: routineForms[i] === 'recognition' ? 'organic' : 'none',
    });
    addScore(db, noneId, critic, { formClass: 'flat', origin: 'none' });
    addScore(db, peripeteiaId, critic, {
      formClass: 'recognition',
      origin: 'peripeteia_induced',
      actional: 75,
      mechanism: 75,
    });
  }

  upsertPoeticsTutorAdaptation(db, {
    itemId: peripeteiaId,
    analyzerVersion: 'tutor-adaptation-v4',
    learnerSelfReframe: true,
    tutorStrategyShift: true,
    tutorContingentAdaptation: true,
    tutorAdaptationScore: 85,
    sharedSalientTerms: ['gate', 'test'],
    metadata: {
      branch_validity: {
        valid: true,
        learner_reversal_event_used: true,
      },
      peripeteia: {
        instrumented_pressure: true,
        private_mechanism_declared: true,
        tutor_adaptive_mechanism: true,
        tutor_strategy_reversal: true,
      },
    },
  });
}

describe('run-poetics-adaptation-loop', () => {
  it('builds a bounded production command for clean adaptation targets', () => {
    const args = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260527T120000Z',
      '--max-iterations',
      '2',
      '--required-passes',
      '1',
      '--dry-run',
    ]);
    const plan = buildIterationPlan(args, 1);

    assert.equal(plan.batchId, 'loop-test-20260527T120000Z-i01');
    assert.ok(plan.commands.production.includes('--target-only'));
    assert.ok(plan.commands.production.includes('D42,D50,D53'));
    assert.ok(plan.commands.production.includes('--target-adaptation-arms'));
    assert.ok(plan.commands.production.includes('routine,none,peripeteia-only'));
    assert.ok(plan.commands.production.includes('--only'));
    assert.ok(plan.commands.production.includes('target-r01'));
    assert.ok(plan.commands.production.includes('--structure-critic'));
    assert.ok(plan.commands.production.includes('rules'));
  });

  it('passes when controls stay negative and peripeteia induces branch-valid recognition', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-pass-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-pass';
      seedRun(db, runId);
      const gate = evaluateRunGate(db, gateArgs(runId));

      assert.equal(gate.pass, true);
      assert.equal(gate.passedItems, 3);
      assert.deepEqual(gate.failureCounts, {});
    } finally {
      db.close();
    }
  });

  it('fails fast when a low-organic control leaks recognition', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-fail-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-fail';
      seedRun(db, runId, { routineForms: ['recognition', 'recognition', 'recognition', 'flat'] });
      const gate = evaluateRunGate(db, gateArgs(runId));

      assert.equal(gate.pass, false);
      assert.equal(gate.failureCounts.control_leak, 1);
      const routine = gate.items.find((item) => item.arm === 'routine');
      assert.equal(routine.consensus.recognitionVotes, 3);
    } finally {
      db.close();
    }
  });

  it('classifies scorer errors as insufficient coverage, not control leakage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-error-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-error';
      seedRun(db, runId);
      const noneId = `${runId}:target-r01:none:T01`;
      addScore(db, noneId, DEFAULT_CRITICS[0], { error: 'No content in response' });

      const gate = evaluateRunGate(db, gateArgs(runId));

      assert.equal(gate.pass, false);
      assert.equal(gate.failureCounts.scorer_error, 1);
      assert.equal(gate.failureCounts.insufficient_scores, 1);
      assert.equal(gate.failureCounts.control_leak || 0, 0);
    } finally {
      db.close();
    }
  });
});
