import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import yaml from 'yaml';
import {
  buildIterationPlan,
  DEFAULT_ANALYZER_VERSION,
  DEFAULT_CRITICS,
  evaluateRunGate,
  loadRepairInputsByDrama,
  parseArgs,
  readFinalPublicLearnerTurn,
  repairInputsForItem,
  renderMarkdown,
  runLoop,
  SEMANTIC_ANALYZER_VERSION,
  summaryPaths,
  validatePreparedSummary,
  validateResumePreflight,
  writableSummaryPaths,
  workflowIdentity,
  workflowStages,
} from '../scripts/run-poetics-adaptation-loop.js';
import {
  insertPoeticsTutorAdaptationOnce,
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

function gateArgs(runId, analyzerVersion = DEFAULT_ANALYZER_VERSION) {
  return {
    runId,
    analyzerVersion,
    targetOnly: ['D42'],
    targetArms: ['routine', 'none', 'peripeteia-only'],
    minCritics: 4,
    recognitionVoteCut: 3,
    originVoteCut: 3,
    actionVoteCut: 3,
    controlMaxRecognitionVotes: 1,
  };
}

function writeCompleteTargetSpec(root) {
  const targetSpec = path.join(root, 'complete-anchor-set.yaml');
  fs.writeFileSync(
    targetSpec,
    yaml.stringify({
      meta: {
        clean_anchor_set: {
          status: 'complete',
          required_core: ['D50', 'D53'],
          qualified_third_anchor: 'D55',
          claim_gate_ready: true,
        },
      },
    }),
    'utf8',
  );
  return targetSpec;
}

function writeStructurallyCompleteSemanticPacket(root) {
  return writeSemanticPacket(root, ['plan-fixture-item']);
}

function writeSemanticPacket(root, itemIds) {
  const packetPath = path.join(root, 'semantic-adjudications.json');
  const intentionalIndeterminate = (judgeId, runId) => ({
    judge_id: judgeId,
    independent_run_id: runId,
    label: 'indeterminate',
    confidence: 'high',
    rationale: 'Plan-wiring fixture only; no adjudication is executed.',
    evidence: [],
  });
  fs.writeFileSync(
    packetPath,
    `${JSON.stringify({
      schema: 'machinespirits.poetics.semantic-change-adjudication-packet.v1',
      items: Object.fromEntries(
        itemIds.map((itemId) => [
          itemId,
          {
            tutor_judgments: [
              intentionalIndeterminate('mock-tutor-a', 'mock-tutor-run-a'),
              intentionalIndeterminate('mock-tutor-b', 'mock-tutor-run-b'),
            ],
            learner_judgments: [
              intentionalIndeterminate('mock-learner-a', 'mock-learner-run-a'),
              intentionalIndeterminate('mock-learner-b', 'mock-learner-run-b'),
            ],
          },
        ]),
      ),
    })}\n`,
    'utf8',
  );
  return packetPath;
}

function seedPreparedBatches(db, batchIds, targets = ['D50', 'D53', 'D55']) {
  const itemIds = [];
  for (const batchId of batchIds) {
    upsertPoeticsRun(db, {
      id: batchId,
      sourceRoot: `config/poetics-calibration/${batchId}`,
      batchId,
      generator: 'mock',
      metadata: {},
    });
    for (const dramaId of targets) {
      for (const arm of ['routine', 'none', 'peripeteia-only']) {
        const itemId = `${batchId}:target-r01:${arm}:${dramaId}`;
        itemIds.push(itemId);
        upsertPoeticsItem(db, {
          id: itemId,
          runId: batchId,
          unitId: 'target-r01',
          repeat: 'r01',
          arm,
          tid: dramaId,
          dramaId,
          discipline: 'fixture',
          condition: arm,
          metadata: {},
        });
      }
    }
  }
  return itemIds;
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
  it('blocks the claim loop while the registered clean-anchor set lacks a third anchor', () => {
    assert.throws(
      () => parseArgs(['--batch-prefix', 'loop-test', '--run-stamp', '20260527T110000Z', '--dry-run']),
      /clean anchor set is incomplete.*cannot use a reduced denominator/,
    );
  });

  it('builds a bounded production command for clean adaptation targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-plan-'));
    const args = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260527T120000Z',
      '--target-spec',
      writeCompleteTargetSpec(root),
      '--target-only',
      'D50,D53,D55',
      '--prepare-semantic',
      '--max-iterations',
      '2',
      '--required-passes',
      '1',
      '--dry-run',
    ]);
    const plan = buildIterationPlan(args, 1);

    assert.equal(plan.batchId, 'loop-test-20260527T120000Z-i01');
    assert.ok(plan.commands.production.includes('--target-only'));
    assert.ok(plan.commands.production.includes('D50,D53,D55'));
    assert.ok(!plan.commands.production.includes('D42,D50,D53'));
    assert.ok(plan.commands.production.includes('--target-adaptation-arms'));
    assert.ok(plan.commands.production.includes('routine,none,peripeteia-only'));
    assert.ok(plan.commands.production.includes('--only'));
    assert.ok(plan.commands.production.includes('target-r01'));
    assert.ok(plan.commands.production.includes('--structure-critic'));
    assert.ok(plan.commands.production.includes('rules'));
    assert.deepEqual(workflowStages(args), ['production', 'ingest']);
  });

  it('does not allow a complete anchor set to run without an explicit semantic stage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-v4-block-'));
    assert.throws(
      () =>
        parseArgs([
          '--batch-prefix',
          'loop-test',
          '--run-stamp',
          '20260527T121500Z',
          '--target-spec',
          writeCompleteTargetSpec(root),
          '--target-only',
          'D50,D53,D55',
          '--dry-run',
        ]),
      /require exactly one staged mode/,
    );
  });

  it('does not accept semantic judgments until preparation has produced transcripts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-premature-packet-'));
    assert.throws(
      () =>
        parseArgs([
          '--batch-prefix',
          'loop-test',
          '--run-stamp',
          '20260527T121600Z',
          '--target-spec',
          writeCompleteTargetSpec(root),
          '--target-only',
          'D50,D53,D55',
          '--prepare-semantic',
          '--semantic-adjudications',
          writeStructurallyCompleteSemanticPacket(root),
          '--dry-run',
        ]),
      /cannot accept judgments before the transcripts exist/,
    );
  });

  it('requires a semantic packet when resuming prepared batches', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-resume-no-packet-'));
    assert.throws(
      () =>
        parseArgs([
          '--batch-prefix',
          'loop-test',
          '--run-stamp',
          '20260527T121700Z',
          '--target-spec',
          writeCompleteTargetSpec(root),
          '--target-only',
          'D50,D53,D55',
          '--resume-prepared',
          '--dry-run',
        ]),
      /requires --semantic-adjudications and semantic v5/,
    );
  });

  it('requires the complete matched routine/none/peripeteia arm set', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-arm-set-'));
    assert.throws(
      () =>
        parseArgs([
          '--batch-prefix',
          'loop-test',
          '--run-stamp',
          '20260527T121800Z',
          '--target-spec',
          writeCompleteTargetSpec(root),
          '--target-only',
          'D50,D53,D55',
          '--target-arms',
          'peripeteia-only',
          '--prepare-semantic',
          '--dry-run',
        ]),
      /must match the registered matched arm set/,
    );
  });

  it('rejects a duplicate target that silently omits the registered third anchor', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-duplicate-target-'));
    assert.throws(
      () =>
        parseArgs([
          '--batch-prefix',
          'loop-test',
          '--run-stamp',
          '20260527T121900Z',
          '--target-spec',
          writeCompleteTargetSpec(root),
          '--target-only',
          'D50,D50,D53',
          '--prepare-semantic',
          '--dry-run',
        ]),
      /must match the registered clean anchor set: D50,D53,D55/,
    );
  });

  it('forwards --effort to the production batch as --claude-effort', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-effort-'));
    const args = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T120000Z',
      '--target-spec',
      writeCompleteTargetSpec(root),
      '--target-only',
      'D50,D53,D55',
      '--prepare-semantic',
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

  it('wires an explicit semantic packet to v5 analysis and reporting', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-semantic-plan-'));
    const packetPath = writeStructurallyCompleteSemanticPacket(root);
    const args = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T130000Z',
      '--target-spec',
      writeCompleteTargetSpec(root),
      '--target-only',
      'D50,D53,D55',
      '--max-iterations',
      '1',
      '--required-passes',
      '1',
      '--resume-prepared',
      '--semantic-adjudications',
      packetPath,
      '--dry-run',
    ]);
    const plan = buildIterationPlan(args, 1);

    assert.equal(args.analyzerVersion, SEMANTIC_ANALYZER_VERSION);
    const packetIndex = plan.commands.adaptation.indexOf('--semantic-adjudications');
    assert.equal(plan.commands.adaptation[packetIndex + 1], packetPath);
    const reportVersionIndex = plan.commands.report.indexOf('--analyzer-version');
    assert.equal(plan.commands.report[reportVersionIndex + 1], SEMANTIC_ANALYZER_VERSION);
    assert.deepEqual(workflowStages(args), ['adaptation', 'report']);
  });

  it('reports prepared batches as awaiting adjudication without a false gate verdict', () => {
    const markdown = renderMarkdown({
      generatedAt: '2026-08-27T00:00:00.000Z',
      status: 'awaiting_semantic_adjudication',
      requiredPasses: 2,
      passes: 0,
      config: {
        workflowStage: 'prepare_semantic',
        targetOnly: ['D50', 'D53', 'D55'],
        targetArms: ['routine', 'none', 'peripeteia-only'],
        critics: DEFAULT_CRITICS,
        controlMaxRecognitionVotes: 1,
        recognitionVoteCut: 3,
        actionVoteCut: 3,
        originVoteCut: 3,
        originHardGate: false,
      },
      iterations: [
        {
          iteration: 1,
          batchId: 'loop-test-prepared-i01',
          gate: null,
          stageError: null,
        },
      ],
    });

    assert.match(markdown, /Passes: not evaluated; awaiting independent semantic adjudication/);
    assert.match(markdown, /\| 1 \| loop-test-prepared-i01 \| not evaluated \| not evaluated \| none \|/);
  });

  it('preserves stage-specific summaries and rejects prepare/resume configuration drift', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-stage-provenance-'));
    const targetSpec = writeCompleteTargetSpec(root);
    const packetPath = writeStructurallyCompleteSemanticPacket(root);
    const reportPrefix = path.join(root, 'loop-status');
    const common = [
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T140000Z',
      '--target-spec',
      targetSpec,
      '--target-only',
      'D50,D53,D55',
      '--max-iterations',
      '2',
      '--required-passes',
      '1',
      '--report-prefix',
      reportPrefix,
    ];
    const prepareArgs = parseArgs([...common, '--prepare-semantic']);
    const resumeArgs = parseArgs([...common, '--resume-prepared', '--semantic-adjudications', packetPath]);
    const preparePaths = summaryPaths(prepareArgs);
    const resumePaths = summaryPaths(resumeArgs);
    assert.notEqual(preparePaths.jsonPath, resumePaths.jsonPath);
    assert.match(preparePaths.jsonPath, /-prepare-semantic\.json$/);
    assert.match(resumePaths.jsonPath, /-resume-prepared\.json$/);

    fs.writeFileSync(
      preparePaths.jsonPath,
      `${JSON.stringify({
        status: 'awaiting_semantic_adjudication',
        config: { workflowIdentity: workflowIdentity(prepareArgs) },
        iterations: [{ batchId: 'loop-test-20260529T140000Z-i01' }, { batchId: 'loop-test-20260529T140000Z-i02' }],
      })}\n`,
      'utf8',
    );
    assert.equal(validatePreparedSummary(resumeArgs).summary.status, 'awaiting_semantic_adjudication');
    assert.throws(() => runLoop(prepareArgs), /prepared semantic summary already exists; use a new run stamp/);

    fs.writeFileSync(resumePaths.jsonPath, '{"status":"failed"}\n', 'utf8');
    assert.match(writableSummaryPaths(resumeArgs).jsonPath, /-resume-prepared-attempt-02\.json$/);

    const driftedResume = parseArgs([
      ...common,
      '--recognition-vote-cut',
      '2',
      '--resume-prepared',
      '--semantic-adjudications',
      packetPath,
    ]);
    assert.throws(() => validatePreparedSummary(driftedResume), /configuration drift: recognitionVoteCut/);
  });

  it('preflights semantic packet coverage across every prepared batch before any v5 write', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-global-packet-preflight-'));
    const dbPath = path.join(root, 'poetics.db');
    const targetSpec = writeCompleteTargetSpec(root);
    const reportPrefix = path.join(root, 'loop-status');
    const batchIds = ['loop-test-20260529T150000Z-i01', 'loop-test-20260529T150000Z-i02'];
    const db = openPoeticsStore(dbPath);
    const itemIds = seedPreparedBatches(db, batchIds);
    db.close();
    const packetPath = writeSemanticPacket(root, itemIds.slice(0, -1));
    const common = [
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T150000Z',
      '--target-spec',
      targetSpec,
      '--target-only',
      'D50,D53,D55',
      '--max-iterations',
      '2',
      '--required-passes',
      '1',
      '--report-prefix',
      reportPrefix,
      '--db',
      dbPath,
    ];
    const prepareArgs = parseArgs([...common, '--prepare-semantic']);
    const resumeArgs = parseArgs([...common, '--resume-prepared', '--semantic-adjudications', packetPath]);
    const preparePaths = summaryPaths(prepareArgs);
    fs.writeFileSync(
      preparePaths.jsonPath,
      `${JSON.stringify({
        status: 'awaiting_semantic_adjudication',
        config: { workflowIdentity: workflowIdentity(prepareArgs) },
        iterations: batchIds.map((batchId) => ({ batchId })),
      })}\n`,
      'utf8',
    );

    assert.throws(() => runLoop(resumeArgs), /packet coverage is incomplete across prepared batches/);
    const verifyDb = openPoeticsStore(dbPath);
    try {
      const count = verifyDb
        .prepare('SELECT COUNT(*) AS count FROM poetics_tutor_adaptations WHERE analyzer_version = ?')
        .get(SEMANTIC_ANALYZER_VERSION).count;
      assert.equal(count, 0);
    } finally {
      verifyDb.close();
    }
  });

  it('resumes after completed analysis by rerunning only reports, while rejecting partial v5 coverage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-analysis-recovery-'));
    const dbPath = path.join(root, 'poetics.db');
    const targetSpec = writeCompleteTargetSpec(root);
    const batchIds = ['loop-test-20260529T160000Z-i01', 'loop-test-20260529T160000Z-i02'];
    const db = openPoeticsStore(dbPath);
    const itemIds = seedPreparedBatches(db, batchIds);
    const packetPath = writeSemanticPacket(root, itemIds);
    const packetSha256 = createHash('sha256').update(fs.readFileSync(packetPath)).digest('hex');
    const resumeArgs = parseArgs([
      '--batch-prefix',
      'loop-test',
      '--run-stamp',
      '20260529T160000Z',
      '--target-spec',
      targetSpec,
      '--target-only',
      'D50,D53,D55',
      '--max-iterations',
      '2',
      '--required-passes',
      '1',
      '--db',
      dbPath,
      '--resume-prepared',
      '--semantic-adjudications',
      packetPath,
    ]);
    const provenance = {
      semantic_adjudication_provenance: {
        packet_schema: 'machinespirits.poetics.semantic-change-adjudication-packet.v1',
        packet_sha256: packetSha256,
        create_once: true,
        historical_recompute_allowed: false,
      },
      peripeteia: {
        tutor_adaptive_mechanism_measurement: { status: 'determinate', value: true },
        tutor_representation_change_measurement: { status: 'determinate', value: false },
        learner_actional_change_measurement: { status: 'determinate', value: true },
        learner_representation_change_measurement: { status: 'determinate', value: false },
      },
    };
    for (const itemId of itemIds.filter((id) => id.startsWith(`${batchIds[0]}:`))) {
      insertPoeticsTutorAdaptationOnce(db, {
        itemId,
        analyzerVersion: SEMANTIC_ANALYZER_VERSION,
        learnerSelfReframe: null,
        tutorStrategyShift: false,
        tutorContingentAdaptation: null,
        sharedSalientTerms: [],
        metadata: provenance,
      });
    }
    const preparedSummary = { iterations: batchIds.map((batchId) => ({ batchId })) };
    const preflight = validateResumePreflight(db, resumeArgs, preparedSummary);
    assert.equal(preflight.batchStates[batchIds[0]].analysisCompleted, true);
    assert.equal(preflight.batchStates[batchIds[1]].analysisCompleted, false);
    assert.deepEqual(workflowStages(resumeArgs, preflight.batchStates[batchIds[0]]), ['report']);
    assert.deepEqual(workflowStages(resumeArgs, preflight.batchStates[batchIds[1]]), ['adaptation', 'report']);

    const completedItemId = itemIds.find((id) => id.startsWith(`${batchIds[0]}:`));
    db.prepare('UPDATE poetics_tutor_adaptations SET metadata = ? WHERE item_id = ? AND analyzer_version = ?').run(
      JSON.stringify({ semantic_adjudication_provenance: provenance.semantic_adjudication_provenance }),
      completedItemId,
      SEMANTIC_ANALYZER_VERSION,
    );
    assert.throws(() => validateResumePreflight(db, resumeArgs, preparedSummary), /malformed semantic v5 persistence/);
    db.prepare('UPDATE poetics_tutor_adaptations SET metadata = ? WHERE item_id = ? AND analyzer_version = ?').run(
      JSON.stringify(provenance),
      completedItemId,
      SEMANTIC_ANALYZER_VERSION,
    );

    insertPoeticsTutorAdaptationOnce(db, {
      itemId: itemIds.find((id) => id.startsWith(`${batchIds[1]}:`)),
      analyzerVersion: SEMANTIC_ANALYZER_VERSION,
      learnerSelfReframe: null,
      tutorStrategyShift: false,
      tutorContingentAdaptation: null,
      sharedSalientTerms: [],
      metadata: provenance,
    });
    assert.throws(
      () => validateResumePreflight(db, resumeArgs, preparedSummary),
      /partial semantic v5 persistence.*no new analysis was started/,
    );
    db.close();
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

  it('keeps semantic judge ambiguity indeterminate instead of collapsing it to mechanism absence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-indeterminate-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-indeterminate';
      seedRun(db, runId);
      const peripeteiaId = `${runId}:target-r01:peripeteia-only:T01`;
      insertPoeticsTutorAdaptationOnce(db, {
        itemId: peripeteiaId,
        analyzerVersion: SEMANTIC_ANALYZER_VERSION,
        learnerSelfReframe: true,
        tutorStrategyShift: false,
        tutorContingentAdaptation: false,
        tutorAdaptationScore: null,
        sharedSalientTerms: [],
        metadata: {
          branch_validity: { valid: true, learner_reversal_event_used: true },
          peripeteia: {
            instrumented_pressure: true,
            private_mechanism_declared: true,
            tutor_adaptive_mechanism: null,
            tutor_strategy_reversal: null,
            tutor_adaptive_mechanism_measurement: {
              status: 'measurement_indeterminate',
              value: null,
              reasons: ['semantic_label_disagreement'],
            },
            tutor_representation_change_measurement: {
              status: 'measurement_indeterminate',
              value: null,
              reasons: ['semantic_label_disagreement'],
            },
            learner_actional_change_measurement: {
              status: 'measurement_indeterminate',
              value: null,
              reasons: ['semantic_label_disagreement'],
            },
            learner_representation_change_measurement: {
              status: 'measurement_indeterminate',
              value: null,
              reasons: ['semantic_label_disagreement'],
            },
          },
        },
      });

      const legacyGate = evaluateRunGate(db, gateArgs(runId));
      assert.equal(legacyGate.pass, true, 'the historical v4 row remains unchanged');

      const gate = evaluateRunGate(db, gateArgs(runId, SEMANTIC_ANALYZER_VERSION));
      const peripeteia = gate.items.find((item) => item.arm === 'peripeteia-only');
      assert.equal(gate.pass, false);
      assert.deepEqual(peripeteia.failures, [
        'learner_measurement_indeterminate',
        'mechanism_measurement_indeterminate',
      ]);
      assert.equal(peripeteia.adaptationGate.tutorAdaptiveMechanism, null);
      assert.equal(peripeteia.adaptationGate.tutorRepresentationChangeStatus, 'measurement_indeterminate');
      assert.equal(peripeteia.adaptationGate.learnerActionalChange, null);
      assert.equal(peripeteia.adaptationGate.learnerRepresentationChangeStatus, 'measurement_indeterminate');
    } finally {
      db.close();
    }
  });

  it('treats a v5 row with missing semantic measurements as indeterminate, never as legacy fallback', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-missing-v5-measurement-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-missing-v5-measurement';
      seedRun(db, runId);
      const peripeteiaId = `${runId}:target-r01:peripeteia-only:T01`;
      insertPoeticsTutorAdaptationOnce(db, {
        itemId: peripeteiaId,
        analyzerVersion: SEMANTIC_ANALYZER_VERSION,
        learnerSelfReframe: true,
        tutorStrategyShift: true,
        tutorContingentAdaptation: true,
        tutorAdaptationScore: 90,
        sharedSalientTerms: [],
        metadata: {
          branch_validity: { valid: true, learner_reversal_event_used: true },
          peripeteia: {
            instrumented_pressure: true,
            private_mechanism_declared: true,
            tutor_adaptive_mechanism: true,
            tutor_strategy_reversal: true,
          },
        },
      });

      const gate = evaluateRunGate(db, gateArgs(runId, SEMANTIC_ANALYZER_VERSION));
      const peripeteia = gate.items.find((item) => item.arm === 'peripeteia-only');
      assert.equal(gate.pass, false);
      assert.deepEqual(peripeteia.failures, [
        'learner_measurement_indeterminate',
        'mechanism_measurement_indeterminate',
      ]);
      assert.equal(peripeteia.adaptationGate.tutorAdaptiveMechanism, null);
      assert.equal(peripeteia.adaptationGate.tutorAdaptiveMechanismStatus, 'measurement_indeterminate');
      assert.equal(peripeteia.adaptationGate.learnerActionalChangeStatus, 'measurement_indeterminate');
    } finally {
      db.close();
    }
  });

  it('marks mixed scorer protocols indeterminate instead of pooling incompatible votes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-loop-mixed-protocols-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      const runId = 'loop-mixed-protocols';
      seedRun(db, runId);
      const itemId = `${runId}:target-r01:peripeteia-only:T01`;
      const critic = DEFAULT_CRITICS[0];
      const stored = db
        .prepare('SELECT metadata FROM poetics_scores WHERE item_id = ? AND critic_model = ?')
        .get(itemId, critic);
      const metadata = JSON.parse(stored.metadata);
      metadata.mechanism_measurement_protocol_version =
        'poetics-phase2-mechanism-measurement-v2-semantic-authoritative';
      metadata.learner_action_measurement_protocol_version =
        'poetics-phase2-learner-action-measurement-v1-semantic-authoritative';
      db.prepare('UPDATE poetics_scores SET metadata = ? WHERE item_id = ? AND critic_model = ?').run(
        JSON.stringify(metadata),
        itemId,
        critic,
      );

      const gate = evaluateRunGate(db, gateArgs(runId));
      const peripeteia = gate.items.find((item) => item.arm === 'peripeteia-only');
      assert.equal(gate.pass, false);
      assert.deepEqual(peripeteia.failures, [
        'learner_measurement_indeterminate',
        'mechanism_measurement_indeterminate',
      ]);
      assert.equal(peripeteia.actionalVotes, null);
      assert.equal(peripeteia.tutorMechanismVotes, null);
      assert.equal(peripeteia.adaptationGate.learnerScorePanel.status, 'measurement_indeterminate');
      assert.equal(peripeteia.adaptationGate.tutorScorePanel.status, 'measurement_indeterminate');
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
