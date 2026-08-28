import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildIterationPlan,
  DEFAULT_CRITICS,
  evaluateRunGate,
  loadRepairInputsByDrama,
  parseArgs,
  readFinalPublicLearnerTurn,
  repairInputsForItem,
} from '../scripts/run-poetics-adaptation-loop.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsRun,
  upsertPoeticsScore,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

const PUBLIC_TEXT_FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/hamartia-repair-public-text-v1.json', import.meta.url), 'utf8'),
);
const RELATIVE_PUBLIC_TRANSCRIPT = 'tests/fixtures/hamartia-repair-public-transcript-v1.txt';

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

function addItem(
  db,
  runId,
  { arm, tid, qualityStatus = 'ok', qualityWarnings = [], samplePath = null, metadata = {} },
) {
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
    samplePath: samplePath || `sample/${arm}/${tid}.txt`,
    fullTranscriptPath: `transcripts/${arm}/${tid}.full.md`,
    keyPath: `key-${arm}.yaml`,
    qualityStatus,
    qualityWarnings,
    metadata,
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

  it('forwards --effort to the production batch as --claude-effort', () => {
    const args = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T120000Z',
      '--generator',
      'claude',
      '--effort',
      'medium',
      '--generation-concurrency',
      '4',
      '--max-iterations',
      '1',
      '--required-passes',
      '1',
      '--dry-run',
    ]);
    const plan = buildIterationPlan(args, 1);
    const idx = plan.commands.production.indexOf('--claude-effort');
    assert.ok(idx >= 0, '--claude-effort present in the production command');
    assert.equal(plan.commands.production[idx + 1], 'medium');
    const ci = plan.commands.production.indexOf('--generation-concurrency');
    assert.equal(plan.commands.production[ci + 1], '4');
  });

  it('prefers exact registered repair inputs before generic metadata and preserves fallbacks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-repair-inputs-'));
    const targetSpec = path.join(root, 'targets.yaml');
    fs.writeFileSync(
      targetSpec,
      [
        'dramas:',
        '  - id: D42',
        '    hamartia: exact registered hamartia',
        '    corrected_rule: exact registered correction',
        '    learner_start_state: generic registered learner state',
        '    lesson_objective: generic registered lesson objective',
        '  - id: D43',
        '    learner_start_state: fallback learner state',
        '    lesson_objective: fallback lesson objective',
      ].join('\n'),
      'utf8',
    );

    const repairInputsByDrama = loadRepairInputsByDrama(targetSpec);
    const exact = repairInputsForItem(
      {
        dramaId: 'D42',
        metadata: {
          keyItem: {
            learner_start_state: 'generic item learner state',
            lesson_objective: 'generic item lesson objective',
          },
        },
      },
      { repairInputsByDrama },
    );
    assert.deepEqual(exact.hamartia, { value: 'exact registered hamartia', source: 'target_spec.hamartia' });
    assert.deepEqual(exact.correctedRule, {
      value: 'exact registered correction',
      source: 'target_spec.corrected_rule',
    });

    const fallback = repairInputsForItem({ dramaId: 'D43', metadata: {} }, { repairInputsByDrama });
    assert.deepEqual(fallback.hamartia, {
      value: 'fallback learner state',
      source: 'target_spec.learner_start_state',
    });
    assert.deepEqual(fallback.correctedRule, {
      value: 'fallback lesson objective',
      source: 'target_spec.lesson_objective',
    });
  });

  it('reads repo-relative public samples and distinguishes missing or unlabelled transcripts', () => {
    const relative = readFinalPublicLearnerTurn(RELATIVE_PUBLIC_TRANSCRIPT);
    assert.equal(relative.status, 'ok');
    assert.equal(relative.turn.turnNumber, 2);

    const missing = readFinalPublicLearnerTurn('tests/fixtures/does-not-exist.txt');
    assert.deepEqual(missing, { status: 'file_not_found', turn: null });

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-public-read-'));
    const unlabelled = path.join(root, 'unlabelled.txt');
    fs.writeFileSync(unlabelled, 'A transcript without a ROLE-labelled learner turn.', 'utf8');
    assert.deepEqual(readFinalPublicLearnerTurn(unlabelled), {
      status: 'no_public_learner_turn',
      turn: null,
    });
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
      assert.ok(gate.items.every((item) => item.hamartiaRepair?.definition === PUBLIC_TEXT_FIXTURE.definition));
      assert.ok(gate.items.every((item) => item.hamartiaRepair?.disposition === 'indeterminate'));
      assert.ok(gate.items.every((item) => item.hamartiaRepair?.source.publicTextStatus === 'file_not_found'));
    } finally {
      db.close();
    }
  });

  it('emits the frozen tri-state public repair block without changing the adaptation gate', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-repair-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-repair';
      seedRun(db, runId);
      const fixtureByCategory = Object.fromEntries(
        ['positive', 'negative', 'ambiguous'].map((category) => [
          category,
          PUBLIC_TEXT_FIXTURE.cases.find((fixture) => fixture.category === category),
        ]),
      );
      const casesByArm = {
        'peripeteia-only': fixtureByCategory.positive,
        routine: fixtureByCategory.negative,
        none: fixtureByCategory.ambiguous,
      };

      for (const [arm, fixture] of Object.entries(casesByArm)) {
        const samplePath = arm === 'peripeteia-only' ? RELATIVE_PUBLIC_TRANSCRIPT : path.join(root, `${arm}.txt`);
        if (path.isAbsolute(samplePath)) {
          fs.writeFileSync(
            samplePath,
            [
              'LEARNER: "opening public turn"',
              '',
              'TUTOR: "test the old check against the object"',
              '',
              `LEARNER: ${fixture.publicText}`,
            ].join('\n'),
            'utf8',
          );
        }
        const itemId = `${runId}:target-r01:${arm}:T01`;
        db.prepare('UPDATE poetics_items SET sample_path = ?, metadata = ? WHERE id = ?').run(
          samplePath,
          JSON.stringify({
            keyItem: {
              curriculum_script_notes: {
                script_lowering: { learner_start_state: fixture.hamartia },
                curriculum: { lesson_objective: fixture.correctedRule },
              },
            },
          }),
          itemId,
        );
      }

      const gate = evaluateRunGate(db, gateArgs(runId));
      assert.equal(gate.pass, true, 'repair is descriptive and must not alter the existing gate');
      assert.deepEqual(gate.failureCounts, {});

      for (const [arm, fixture] of Object.entries(casesByArm)) {
        const item = gate.items.find((candidate) => candidate.arm === arm);
        assert.equal(item.hamartiaRepair.definition, PUBLIC_TEXT_FIXTURE.definition, arm);
        assert.equal(item.hamartiaRepair.disposition, fixture.expectedDisposition, arm);
        assert.equal(item.hamartiaRepair.source.learnerTurnNumber, 2, arm);
        assert.equal(item.hamartiaRepair.source.publicTextStatus, 'ok', arm);
        assert.equal(item.hamartiaRepair.source.hamartia?.includes('script_lowering'), true, arm);
        assert.equal(item.hamartiaRepair.source.correctedRule?.includes('lesson_objective'), true, arm);
      }
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

  it('reports origin ambiguity as a diagnostic without gating, unless --origin-hard-gate (D1)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-origin-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-origin';
      seedRun(db, runId);
      // Recognition still holds 4/4, but the origin is ORGANIC (peripeteia_induced = 0
      // < cut): the critic-unreachable case the old origin gate failed on. Everything
      // else (recognition, actional, mechanism, branch) stays passing, so origin is
      // the only thing under test.
      const peripeteiaId = `${runId}:target-r01:peripeteia-only:T01`;
      for (const critic of DEFAULT_CRITICS) {
        addScore(db, peripeteiaId, critic, {
          formClass: 'recognition',
          origin: 'organic',
          actional: 75,
          mechanism: 75,
        });
      }

      // Default: origin is a reported diagnostic, not a gate -> the run still passes.
      const gate = evaluateRunGate(db, gateArgs(runId));
      const peri = gate.items.find((item) => item.arm === 'peripeteia-only');
      assert.equal(peri.originInducedVotes, 0);
      assert.equal(peri.originAmbiguous, true);
      assert.ok(!peri.failures.includes('organic_or_ambiguous_recognition'));
      assert.equal(gate.pass, true);

      // Opt-in --origin-hard-gate restores the old strict behavior.
      const strict = evaluateRunGate(db, { ...gateArgs(runId), originHardGate: true });
      const periStrict = strict.items.find((item) => item.arm === 'peripeteia-only');
      assert.ok(periStrict.failures.includes('organic_or_ambiguous_recognition'));
      assert.equal(strict.pass, false);
    } finally {
      db.close();
    }
  });
});
