import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadAuditRows } from '../scripts/audit-poetics-disagreements.js';
import {
  getBlindItem,
  getItem,
  endingShapeDiagnosticsForScores,
  originDiagnosticsForScores,
  listItems,
  listRuns,
  parseTranscriptPreview,
  renderBrowserHtml,
  saveBrowserLabel,
  saveBrowserReviewFlag,
} from '../scripts/browse-poetics-scripts.js';
import { buildPoeticsReport, renderCsv, renderMarkdown } from '../scripts/report-poetics-sidecar.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsReviewFlag,
  upsertPoeticsRun,
  upsertPoeticsScore,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

function withDb(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-report-browser-'));
  const db = openPoeticsStore(path.join(root, 'poetics.db'));
  try {
    seed(db);
    return fn(db);
  } finally {
    db.close();
  }
}

function seed(db) {
  upsertPoeticsRun(db, {
    id: 'poetics-test-run',
    sourceRoot: 'config/poetics-calibration/poetics-test-run',
    batchId: 'poetics-test-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsRun(db, {
    id: 'poetics-second-run',
    sourceRoot: 'config/poetics-calibration/poetics-second-run',
    batchId: 'poetics-second-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsRun(db, {
    id: 'poetics-failure-run',
    sourceRoot: 'config/poetics-calibration/poetics-failure-run',
    batchId: 'poetics-failure-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-test-run:target-r01:none:T01',
    runId: 'poetics-test-run',
    unitId: 'target-r01',
    repeat: 'r01',
    arm: 'none',
    tid: 'T01',
    dramaId: 'D1',
    discipline: 'statistics',
    condition: 'base',
    intendedLean: 'flat',
    metadata: {
      keyItem: {
        evaluation_role: 'low_organic_reversal_replacement',
        baseline_control_class: 'low_organic_reversal',
        organic_reversal_risk: 'low',
        baseline_control_note: 'clean routine prefix candidate',
      },
    },
  });
  upsertPoeticsItem(db, {
    id: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    runId: 'poetics-test-run',
    unitId: 'control-r01-d25-hard-trap',
    repeat: 'r01',
    arm: 'default',
    tid: 'T02',
    dramaId: 'D25',
    discipline: 'medicine',
    condition: 'base',
    intendedLean: 'hard_trap',
    controlFamily: 'd25-hard-trap',
    controlRole: 'hard_trap_control',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-test-run:control-r01-d26-hard-trap:default:T04',
    runId: 'poetics-test-run',
    unitId: 'control-r01-d26-hard-trap',
    repeat: 'r01',
    arm: 'default',
    tid: 'T04',
    dramaId: 'D26',
    discipline: 'chemistry',
    condition: 'base',
    intendedLean: 'hard_trap',
    controlFamily: 'd26-hard-trap',
    controlRole: 'hard_trap_control',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-second-run:target-r01:reframe:T03',
    runId: 'poetics-second-run',
    unitId: 'target-r01',
    repeat: 'r01',
    arm: 'reframe',
    tid: 'T03',
    dramaId: 'D3',
    discipline: 'history',
    condition: 'recognition',
    intendedLean: 'recognition',
    metadata: {
      keyItem: {
        evaluation_role: 'organic_reversal_boundary',
        baseline_control_class: 'organic_reversal',
        organic_reversal_risk: 'high',
        baseline_control_note: 'natural role turn',
      },
    },
  });
  upsertPoeticsItem(db, {
    id: 'poetics-failure-run:target-r01:peripeteia-only:T04',
    runId: 'poetics-failure-run',
    unitId: 'target-r01',
    repeat: 'r01',
    arm: 'peripeteia-only',
    tid: 'T04',
    dramaId: 'D4',
    discipline: 'biology',
    condition: 'recognition',
    intendedLean: 'recognition',
    metadata: {},
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:target-r01:none:T01',
    criticModel: 'qwen/qwen3.5-plus-02-15',
    scoreFile: 'scores/target-r01-none-qwen.json',
    formClass: 'flat',
    recontextualization: 0,
    statedInsight: 0,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'qwen/qwen3.5-plus-02-15',
    scoreFile: 'scores/control-r01-d25-qwen.json',
    formClass: 'trap',
    recontextualization: 0,
    statedInsight: 75,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'deepseek/deepseek-v4-pro',
    scoreFile: 'scores/control-r01-d25-deepseek.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 75,
    recoheredEarlier: 'the learner re-reads the earlier demand',
    statedInsightEvidence: 'Oh, I get it',
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'google/gemini-3.5-flash',
    scoreFile: 'scores/control-r01-d25-gemini.json',
    formClass: 'trap',
    recontextualization: 0,
    statedInsight: 75,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'anthropic/claude-sonnet-4.6',
    scoreFile: 'scores/control-r01-d25-sonnet.json',
    formClass: 'trap',
    recontextualization: 0,
    statedInsight: 75,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'qwen/qwen3.7-max',
    scoreFile: 'scores/target-r01-reframe-qwen37.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 25,
    recoheredEarlier: 'I was using the area as if it were the whole map',
    metadata: {
      role_symmetric_scores: {
        learner_self_reframe: {
          score100: 75,
          evidence: 'I was using the area as if it were the whole map',
          source: 'recontextualization_axis',
        },
        learner_actional_breakthrough: {
          score100: 90,
          evidence: 'I can test it against the smaller example.',
          source: 'actional_breakthrough_axis',
        },
        tutor_contingent_adaptation: {
          score100: 80,
          evidence: 'Use that revised map frame to test the next claim.',
          justification: 'The tutor changes the task around the learner revised frame.',
          source: 'tutor_contingent_adaptation_axis',
        },
        tutor_strategy_reversal: {
          score100: 80,
          evidence: 'Let us switch route: test the map claim with a smaller example.',
          justification: 'The tutor changes route after learner resistance.',
          triggerLearnerTurn: 2,
          source: 'tutor_strategy_reversal_axis',
        },
        tutor_adaptive_mechanism_quality: {
          score100: 85,
          evidence: 'The smaller example becomes a precise test.',
          justification: 'The mechanism is fitted to the map error and directly usable.',
          triggerLearnerTurn: 2,
          source: 'adaptive_mechanism_quality_axis',
        },
      },
    },
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'deepseek/deepseek-v4-pro',
    scoreFile: 'scores/target-r01-reframe-deepseek.json',
    formClass: 'flat',
    recontextualization: 50,
    statedInsight: 25,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'google/gemini-3.5-flash',
    scoreFile: 'scores/target-r01-reframe-gemini.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 25,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'anthropic/claude-sonnet-4.6',
    scoreFile: 'scores/target-r01-reframe-sonnet.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 25,
  });
  upsertPoeticsTutorAdaptation(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    analyzerVersion: 'tutor-adaptation-v4',
    sourceTracePath: 'config/poetics-calibration/poetics-second-run/target-r01/deliberation/reframe/T03.json',
    learnerSelfReframe: true,
    learnerReframeScore: 1,
    tutorPreTurn: 2,
    tutorPostTurn: 3,
    tutorStrategyBefore: 'mechanism_explanation',
    tutorStrategyAfter: 'application_task',
    tutorStrategyShift: true,
    preTutorPivotOverlap: 0.08,
    postTutorPivotOverlap: 0.32,
    uptakeDelta: 0.24,
    sharedSalientTerms: ['projection', 'area', 'scale'],
    tutorContingentAdaptation: true,
    tutorAdaptationScore: 72,
    evidence: 'post tutor takes up the revised map frame',
    metadata: {
      peripeteia: {
        learner_reversal_pressure: true,
        tutor_strategy_reversal: true,
        tutor_peripeteia_score: 68,
        trigger_type: 'resistance',
        learner_outcome_after_reversal: 'recognition',
        evidence: 'pressure learner: But the map still feels wrong.\npost tutor: Let us switch route.',
      },
      branch_validity: {
        tutor_adaptation_policy: 'uptake+peripeteia',
        requires_learner_reversal_event: true,
        learner_reversal_event_used: true,
        requires_learner_reframe_event: true,
        learner_reframe_event_used: true,
        valid: true,
      },
    },
  });
  for (const critic of [
    'qwen/qwen3.7-max',
    'google/gemini-3.5-flash',
    'deepseek/deepseek-v4-pro',
    'anthropic/claude-sonnet-4.6',
  ]) {
    upsertPoeticsScore(db, {
      itemId: 'poetics-failure-run:target-r01:peripeteia-only:T04',
      criticModel: critic,
      scoreFile: `scores/failure-${critic.replaceAll('/', '-')}.json`,
      formClass: 'flat',
      recontextualization: 50,
      statedInsight: 25,
      metadata: {
        tutor_adaptive_mechanism: 25,
        tutor_contingent_adaptation: 0,
      },
    });
  }
  upsertPoeticsTutorAdaptation(db, {
    itemId: 'poetics-failure-run:target-r01:peripeteia-only:T04',
    analyzerVersion: 'tutor-adaptation-v4',
    learnerSelfReframe: false,
    tutorContingentAdaptation: false,
    tutorAdaptationScore: 0,
    metadata: {
      peripeteia: {
        learner_reversal_pressure: true,
        instrumented_pressure: true,
        private_mechanism_declared: false,
        tutor_strategy_reversal: false,
        tutor_adaptive_mechanism: false,
        tutor_peripeteia_score: 20,
      },
      branch_validity: {
        tutor_adaptation_policy: 'peripeteia-only',
        requires_learner_reversal_event: true,
        learner_reversal_event_used: true,
        requires_learner_reframe_event: false,
        learner_reframe_event_used: false,
        valid: true,
      },
    },
  });
  upsertPoeticsReviewFlag(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    flaggerId: 'codex',
    flagType: 'human_review',
    priority: 'normal',
    reason: 'critic disagreement needs human perspective',
    metadata: {},
  });
}

describe('poetics sidecar report and browser', () => {
  it('parses public scripts into theatrical preview blocks', () => {
    const blocks = parseTranscriptPreview(`STAGE: [A card is turned over.]

TUTOR: [sets two strips beside the diagram]

"Sort the motion sentence away from the force label."

LEARNER: "The arrow names who acts on the cart. [moves the motion strip aside] The rolling sentence is separate."`);
    assert.equal(blocks.length, 3);
    assert.deepEqual(
      blocks.map((block) => [block.speaker, block.type]),
      [
        ['STAGE', 'stage'],
        ['TUTOR', 'tutor'],
        ['LEARNER', 'learner'],
      ],
    );
    assert.equal(blocks[0].blocking, 'A card is turned over.');
    assert.equal(blocks[1].blocking, 'sets two strips beside the diagram');
    assert.match(blocks[1].speech, /Sort the motion sentence/);
    assert.match(blocks[2].speech, /The arrow names who acts/);
  });

  it('renders target, control, and disagreement summaries from sidecar tables', () =>
    withDb((db) => {
      const report = buildPoeticsReport(db, { runId: 'poetics-test-run' });
      assert.equal(report.runs.length, 1);
      assert.equal(report.runs[0].itemCount, 3);
      assert.equal(report.runs[0].scoreCount, 5);
      assert.equal(report.runs[0].disagreements.length, 1);
      assert.equal(report.runs[0].consensusByItem.find((row) => row.tid === 'T02').claimStatus, 'negative');
      assert.equal(report.runs[0].consensusByItem.find((row) => row.tid === 'T04').claimStatus, 'insufficient');
      assert.match(renderMarkdown(report), /Critic Disagreements/);
      assert.match(renderMarkdown(report), /Consensus Adjudication/);
      assert.match(renderMarkdown(report), /insufficient=2/);
      assert.match(renderMarkdown(report), /hard_trap_control/);
      assert.match(renderMarkdown(report), /Tutor Adaptation/);
      assert.match(renderMarkdown(report), /Baseline Risk/);
      assert.match(renderMarkdown(report), /low_organic_reversal_replacement/);
      assert.ok(renderCsv(report).includes('deepseek/deepseek-v4-pro'));
      assert.ok(renderCsv(report).includes('tutor_adaptation_score'));
      assert.ok(renderCsv(report).includes('organic_reversal_risk'));

      const adaptiveReport = buildPoeticsReport(db, { runId: 'poetics-second-run' });
      assert.equal(adaptiveReport.runs[0].consensusByItem[0].claimStatus, 'claimable');
      assert.match(renderMarkdown(adaptiveReport), /organic_reversal_boundary/);
      assert.match(renderMarkdown(adaptiveReport), /Instrumented pressure/);
      assert.match(renderMarkdown(adaptiveReport), /Peripeteia tutor adaptation/);
      assert.match(renderMarkdown(adaptiveReport), /Adaptive mechanism quality/);
      assert.match(renderMarkdown(adaptiveReport), /Mean peripeteia score/);
      assert.match(renderMarkdown(adaptiveReport), /Branch valid/);
      assert.match(renderMarkdown(adaptiveReport), /Actional breakthrough/);
      assert.ok(renderCsv(adaptiveReport).includes('instrumented_pressure'));
      assert.ok(renderCsv(adaptiveReport).includes('private_mechanism_declared'));
      assert.ok(renderCsv(adaptiveReport).includes('actional_breakthrough'));
      assert.ok(renderCsv(adaptiveReport).includes('adaptive_mechanism_quality'));
      assert.ok(renderCsv(adaptiveReport).includes('branch_valid'));
      assert.ok(renderCsv(adaptiveReport).includes('tutor_peripeteia_score'));
      assert.ok(renderCsv(adaptiveReport).includes('68'));
    }));

  it('lists runs and retrieves script details for the browser API layer', () =>
    withDb((db) => {
      const runs = listRuns(db);
      const run = runs.find((entry) => entry.id === 'poetics-test-run');
      assert.equal(run.itemCount, 3);
      assert.equal(run.reviewFlagCount, 1);

      const hardTraps = listItems(db, { runId: 'poetics-test-run', role: 'hard_trap_control' });
      assert.equal(hardTraps.length, 2);
      const d25 = hardTraps.find((item) => item.dramaId === 'D25');
      const d26 = hardTraps.find((item) => item.dramaId === 'D26');
      assert.match(d25.createdAt, /^\d{4}-\d{2}-\d{2}/);
      assert.equal(d25.criticForms.length, 4);
      assert.equal(d25.consensus.claimStatus, 'negative');
      assert.equal(d25.reviewFlagCount, 1);
      assert.equal(d26.consensus.claimStatus, 'insufficient');

      const failures = listItems(db, { runId: 'poetics-failure-run', queue: 'adaptation-failures' });
      assert.equal(failures.length, 1);
      assert.equal(failures[0].arm, 'peripeteia-only');
      assert.equal(failures[0].consensus.claimStatus, 'negative');

      const detail = getItem(db, 'poetics-test-run:control-r01-d25-hard-trap:default:T02');
      assert.equal(detail.item.controlRole, 'hard_trap_control');
      assert.match(detail.item.createdAt, /^\d{4}-\d{2}-\d{2}/);
      assert.equal(detail.scores.length, 4);
      assert.equal(detail.reviewFlags.length, 1);

      const adaptiveItems = listItems(db, { runId: 'poetics-second-run' });
      assert.equal(adaptiveItems[0].tutorAdaptationScore, 72);
      assert.equal(adaptiveItems[0].actionalBreakthroughCount, 1);
      assert.equal(adaptiveItems[0].adaptiveMechanismQualityCount, 1);
      assert.equal(adaptiveItems[0].endingShapeCount, 1);
      assert.equal(adaptiveItems[0].peripeteiaTutorAdaptation, true);
      assert.equal(adaptiveItems[0].peripeteiaScore, 68);
      assert.equal(adaptiveItems[0].learnerSelfReframe, true);
      assert.equal(adaptiveItems[0].tutorContingentAdaptation, true);
      assert.equal(adaptiveItems[0].consensus.claimStatus, 'claimable');

      const adaptiveDetail = getItem(db, 'poetics-second-run:target-r01:reframe:T03');
      assert.equal(adaptiveDetail.consensus.consensusClass, 'recognition');
      assert.equal(adaptiveDetail.tutorAdaptation.tutor_adaptation_score, 72);
      assert.deepEqual(adaptiveDetail.tutorAdaptation.shared_salient_terms, ['projection', 'area', 'scale']);
      const qwenScore = adaptiveDetail.scores.find((score) => score.critic_model === 'qwen/qwen3.7-max');
      assert.equal(qwenScore.roleScores.learnerSelfReframeScore, 75);
      assert.equal(qwenScore.roleScores.learnerActionalBreakthroughScore, 90);
      assert.equal(qwenScore.roleScores.tutorContingentAdaptationScore, 80);
      assert.equal(qwenScore.roleScores.tutorStrategyReversalScore, 80);
      assert.equal(qwenScore.roleScores.tutorAdaptiveMechanismQualityScore, 85);
      assert.equal(qwenScore.recognitionOrigin.class, 'peripeteia_induced');
      assert.match(qwenScore.roleScores.tutorContingentAdaptationEvidence, /revised map frame/);
      assert.match(qwenScore.roleScores.tutorAdaptiveMechanismQualityEvidence, /smaller example/);
      assert.equal(adaptiveDetail.tutorAdaptation.metadata.peripeteia.tutor_strategy_reversal, true);
      assert.equal(adaptiveDetail.tutorAdaptation.metadata.branch_validity.valid, true);
      assert.equal(adaptiveDetail.endingShapeDiagnostics.totalCritics, 4);
      assert.equal(adaptiveDetail.endingShapeDiagnostics.tutorAdaptiveMoveVotes, 1);
      assert.equal(adaptiveDetail.endingShapeDiagnostics.learnerPerformanceVotes, 1);
      assert.equal(adaptiveDetail.endingShapeDiagnostics.learnerReorientationVotes, 3);
      assert.equal(adaptiveDetail.endingShapeDiagnostics.completeEndingShapeVotes, 1);
      assert.ok(
        adaptiveDetail.endingShapeDiagnostics.disagreementFlags.some((flag) =>
          flag.includes('complete ending shape'),
        ),
      );
    }));

  it('renders browser-side origin helpers without server-only references', () => {
    const html = renderBrowserHtml();
    assert.match(html, /const formatTimestamp = /);
    assert.match(html, /script ' \+ formatTimestamp\(item\.createdAt\)/);
    assert.match(
      html,
      /const ORIGIN_CLASSES = \["none","organic","peripeteia_induced","false_closure","ambiguous"\];/,
    );
    assert.match(html, /const scoreOrigin = /);
    assert.doesNotMatch(html, /recognitionOriginForScoreRow\(s\)/);
  });

  it('builds ending-shape diagnostics from role-symmetric score rows', () => {
    const diagnostics = endingShapeDiagnosticsForScores([
      {
        critic_model: 'critic-a',
        form_class: 'recognition',
        recontextualization: 75,
        metadata: {
          actional_breakthrough: 75,
          tutor_adaptive_mechanism: 75,
          adaptive_mechanism_quality: 75,
          actional_breakthrough_evidence: 'learner performs the new test',
          tutor_reversal_evidence: 'tutor switches device',
        },
      },
      {
        critic_model: 'critic-b',
        form_class: 'flat',
        recontextualization: 0,
        metadata: {
          actional_breakthrough: 75,
          tutor_adaptive_mechanism: 0,
        },
      },
    ]);
    assert.equal(diagnostics.totalCritics, 2);
    assert.equal(diagnostics.learnerPerformanceVotes, 2);
    assert.equal(diagnostics.learnerReorientationVotes, 1);
    assert.equal(diagnostics.tutorAdaptiveMoveVotes, 1);
    assert.equal(diagnostics.completeEndingShapeVotes, 1);
    assert.ok(diagnostics.disagreementFlags.some((flag) => flag.includes('learner reorientation')));
  });

  it('builds recognition-origin diagnostics from role-symmetric score rows', () => {
    const diagnostics = originDiagnosticsForScores([
      {
        critic_model: 'critic-a',
        form_class: 'recognition',
        recontextualization: 75,
        metadata: {
          role_symmetric_scores: {
            learner_self_reframe: { score100: 75, evidence: 'I was reading the whole map wrong' },
            learner_actional_breakthrough: { score100: 75, evidence: 'I test the smaller map first' },
            tutor_adaptive_mechanism: { score100: 75, evidence: 'Switch route: use a smaller map' },
          },
        },
      },
      {
        critic_model: 'critic-b',
        form_class: 'recognition',
        recontextualization: 75,
        metadata: {
          role_symmetric_scores: {
            learner_self_reframe: { score100: 75, evidence: 'I was reading the whole map wrong' },
            learner_actional_breakthrough: { score100: 25 },
            tutor_adaptive_mechanism: { score100: 25 },
          },
        },
      },
      {
        critic_model: 'critic-c',
        form_class: 'trap',
        recontextualization: 50,
        statedInsight: 75,
        metadata: {},
      },
    ]);
    assert.equal(diagnostics.totalCritics, 3);
    assert.equal(diagnostics.counts.peripeteia_induced, 1);
    assert.equal(diagnostics.counts.organic, 1);
    assert.equal(diagnostics.counts.false_closure, 1);
    assert.ok(diagnostics.disagreementFlags.some((flag) => flag.includes('origin disagreement')));
  });

  it('supports blind browser labels without exposing critic scores', () =>
    withDb((db) => {
      const blindItems = listItems(db, { runId: 'poetics-test-run', blind: true });
      assert.equal(blindItems.length, 3);
      assert.ok(blindItems[0].blindId);
      assert.match(blindItems[0].createdAt, /^\d{4}-\d{2}-\d{2}/);
      assert.equal(blindItems[0].criticForms, undefined);
      assert.equal(blindItems[0].tutorAdaptationScore, undefined);

      const saved = saveBrowserLabel(db, {
        itemId: 'poetics-test-run:target-r01:none:T01',
        labellerId: 'reader-a',
        formClass: 'flat',
        rationale: 'no public recohering',
      });
      assert.equal(saved.label.form_class, 'flat');
      assert.equal(saved.label.perspective, 'human-browser');

      const blindDetail = getBlindItem(db, 'poetics-test-run:target-r01:none:T01', { labellerId: 'reader-a' });
      assert.equal(blindDetail.scores, undefined);
      assert.equal(blindDetail.reviewFlags, undefined);
      assert.equal(blindDetail.label.form_class, 'flat');
    }));

  it('persists review flags and serves them as a blind review queue', () =>
    withDb((db) => {
      const flagged = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'review',
        blind: true,
      });
      assert.equal(flagged.length, 1);
      assert.equal(flagged[0].id, 'poetics-test-run:control-r01-d25-hard-trap:default:T02');
      assert.equal(flagged[0].criticForms, undefined);
      assert.equal(flagged[0].reviewFlagCount, 1);

      const saved = saveBrowserReviewFlag(db, {
        itemId: 'poetics-second-run:target-r01:reframe:T03',
        flaggerId: 'codex',
        reason: 'second disagreement for comparison',
      });
      assert.equal(saved.reviewFlags.length, 1);

      const queue = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'review',
        blind: true,
      });
      assert.equal(queue.length, 2);
    }));

  it('builds a blind cross-run disagreement queue', () =>
    withDb((db) => {
      const queue = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'disagreements',
        blind: true,
      });
      assert.equal(queue.length, 2);
      assert.deepEqual(queue.map((item) => item.runId).sort(), ['poetics-second-run', 'poetics-test-run']);
      assert.equal(queue[0].criticForms, undefined);

      saveBrowserLabel(db, {
        itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
        labellerId: 'reader-a',
        formClass: 'trap',
      });
      const remaining = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'disagreements',
        unlabelled: true,
        blind: true,
      });
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, 'poetics-second-run:target-r01:reframe:T03');
    }));

  it('surfaces focal-critic disagreement cases for qualitative audit', () =>
    withDb((db) => {
      const rows = loadAuditRows(db, {
        runId: 'poetics-test-run',
        critic: 'deepseek/deepseek-v4-pro',
        onlyDisagreements: true,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].item.drama_id, 'D25');
      assert.equal(rows[0].scores.find((score) => score.critic === 'deepseek/deepseek-v4-pro').form, 'recognition');
    }));
});
