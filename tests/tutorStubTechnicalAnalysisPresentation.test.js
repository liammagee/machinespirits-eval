import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubTechnicalAnalysisLines } from '../services/tutorStubTechnicalAnalysisPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({ cyan: '<cyan>', dim: '<dim>', reset: '<reset>' });

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('technical-analysis projection preserves dense diagnostic branches and immutable line output', () => {
  const input = {
    turn: {
      turn: 4,
      learner: 'The seal and ledger support the same inference.',
      classification: {
        turn: {
          summary: 'The learner joined two public clues.',
          request_type: 'evidence_synthesis',
          discourse_move: 'supported_inference',
          epistemic_stance: 'testing',
          evidence_use: 'integrated',
          agency: 'leading',
          learning_pace: 'accelerating',
          reasoning_span: 'multi_step',
          scores: {
            conceptual_engagement: { score: 4 },
            epistemic_readiness: { score: 5 },
          },
        },
        overall: {
          summary: 'The inquiry is converging.',
          trajectory: 'productive',
          current_state: 'assembling the proof',
          next_best_tutor_move: 'Invite the final warrant.',
        },
        parseError: 'classifier used its recovered payload',
      },
      comprehension: {
        beforeTutor: { features: { pressure: 0.2, unresolvedTerms: ['assay'], explainedTerms: ['ledger'] } },
      },
      dagFactDropout: {
        configuredRate: 0.25,
        seed: 91,
        eligibleCount: 3,
        droppedNow: [{ premiseId: 'p2' }],
        repairedNow: [{ premiseId: 'p1' }],
        activeDropped: [{ premiseId: 'p2' }],
      },
      tutorLearnerDagModel: {
        metrics: { groundedCount: 3, voicedDerivedCount: 2, hypothesisCount: 1, missingPremiseCount: 1 },
        assessment: { bestPathCoverage: 0.75, bottleneck: 'p4' },
        learnerRecord: {
          grounded: [{ fact: ['signed_by', 'ledger', 'mayor'] }],
          hypotheses: [{ surface: 'The seal may authenticate the entry.' }],
          answerCandidates: [{ premise: 'candidate-1' }],
        },
      },
      tutorLearnerDagUpdate: {
        preflight: {
          computedBeforeModelCall: true,
          eligiblePublicPremiseIds: ['p1', 'p2'],
          possibleNextDerivations: ['d1'],
          authority: { commitsProgress: false },
          contentSha256: 'abc123',
        },
        accepted: { adopt: ['p1'], derive: ['d1'], retract: ['old'], hypothesis: 'h1', assertAnswer: 'suspect-a' },
        rejected: [{ reason: 'private clue' }],
        extractor: { parseError: 'one row ignored' },
        advance: { pace: 'fast', supportedMoveCount: 2, multiPremise: true, multiStep: true, strength: 0.8 },
      },
      responseConfigurationAudit: {
        visible_axis_count: 5,
        axis_count: 6,
        realization_rate: 0.833,
        transcript_visible: true,
        axes: { register: { visible: true }, scene: { visible: false } },
      },
      tutorLeakAudit: { ok: false, leaks: [{ type: 'answer', reason: 'Named the hidden conclusion.' }] },
      tutorResponseRepaired: true,
      tutorDeterministicFallback: false,
      tutorGuardAccounting: {
        repairsApplied: [{ triggeredBy: [{ guard: 'answer_secrecy' }, { guard: 'question_support' }] }],
      },
      tutorDag: {
        turn: 4,
        leavesReleased: 2,
        leavesTotal: 3,
        derivable: true,
        rootLabel: 'the verdict',
        nextRelease: { premise: 'p3', turn: 5, via: 'authored' },
        edges: [{ fromLabel: 'the seal', toLabel: 'the verdict', rule: 'modus ponens' }],
        leaves: [{ released: true, premise: 'p1', scheduledTurn: 2, via: 'authored', fact: 'signed ledger' }],
      },
      humanDiscourseFrame: {
        mode: 'defeasible',
        scaffoldState: { branch: { label: 'Seal branch' }, localQuestion: 'What does the seal warrant?' },
        sideArc: { detected: true, type: 'terminology' },
        proofDebt: {
          status: 'managed',
          counts: { open: 1 },
          elision: { applied: true, count: 2, reason: 'commonsense bridges' },
        },
        generousInference: {
          applied: true,
          kind: 'elliptical_answer',
          confidence: 0.9,
          reason: 'the local question fixes the referent',
          resolvedMeaning: 'The seal authenticates the ledger.',
          tutorInstruction: 'Carry the learner-owned inference forward.',
        },
        questionSupport: {
          schema: 'v1',
          answerability: 'public',
          modality: 'open_question',
          adaptiveMultipleChoice: false,
          adaptiveChoiceCoolingDown: false,
          reason: 'the evidence is public',
        },
        warrantPremiseAudit: {
          counts: {
            explicitWarrants: 1,
            impliedWarrants: 2,
            missingWarrants: 0,
            suppressedPremises: 1,
            commonSenseBridges: 2,
          },
        },
      },
      tutorQuestionSupportAudit: { ok: false, issues: ['too broad'] },
      tutorHumanScaffoldAudit: { ok: true, similarity: 0.12 },
      dialogueClosure: {
        frame: { phase: 'eligible', basis: 'proof', strictGrounded: true, authoredDagSatisfied: true },
        lifecycle: { phase: 'awaiting_checkin' },
        audit: { ok: true, closesDialogue: true, invitesCheckIn: true, issues: [] },
      },
    },
    turnIdentifier: 'fixture:t004',
    registerSelection: {
      engagement_stance: 'precise',
      selected_register: 'precise',
      confidence: 0.82,
      temperature: 0.7,
      request_type: 'evidence_synthesis',
      action_family: 'test_warrant',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'plain_language',
      scene_immersion: 'inside_archive',
      actorial_part: 'adversarial_teacher',
      actorial_part_label: 'adversarial teacher',
      actorial_performance: { id: 'press_then_release', label: 'press then release', contract: 'test one warrant' },
      actorial_part_selection: {
        distribution: [
          { part: 'adversarial_teacher', probability: 0.65 },
          { part: 'scene_partner', probability: 0.35 },
        ],
        reason: 'the learner offered a testable chain',
        selection_method: 'sample',
        probability: 0.65,
        random: { decision: { draw: 0.42 } },
      },
      legacy_selected_register: 'challenge',
      reviewer_signal: 'supported chain',
      register_reason: 'Test the warrant without taking over.',
      policy: 'field',
      primary_policy: 'field',
      policy_composition: {
        policy_stack: 'field+trajectory',
        overlay_threshold: 0.6,
        activated_overlay: 'trajectory',
        overlay_evaluations: [
          {
            policy: 'trajectory',
            signal_strength: 0.8,
            selected_register: 'precise',
            threshold_met: true,
            differs_from_primary: false,
            reasons: ['momentum rising'],
          },
        ],
      },
      expected_dag_move: 'Test the final warrant.',
      expected_field_move: 'Increase learner ownership.',
      expected_progress_marker: 'The learner states the warrant.',
      field_policy: {
        features: { field: { relation: 'productive', delta: 0.2 }, dag: { progressScore: 0.7, bottleneck: 'p4' } },
      },
      trajectory_policy: {
        trajectory: {
          field: { slope: 0.1 },
          dag: { slope: 0.2 },
          risk: { slope: -0.1 },
          flags: { accelerating: true, stalled: false },
        },
      },
      dynamical_system_policy: {
        state_vector: { momentum: 0.8, risk: 0.2 },
        attractors: { precise: 0.9, warm: 0.3 },
        corpus_empirical: { enabled: true, corrections: { precise: 0.2, playful: -0.1 } },
      },
      state_policy: {
        features: {
          dag: { bottleneck: 'p4', bestPathCoverage: 0.75, missingPremiseCount: 1 },
          scores: { learnerSurface: 0.8 },
        },
      },
      efficacy: {
        label: 'positive_progress',
        progressScore: 0.8,
        mismatch: 'aligned',
        field: { delta: 0.2 },
        summary: 'the move helped',
      },
    },
    previousEfficacy: {
      selected_register: 'warm',
      label: 'neutral',
      progressScore: 0.1,
      mismatch: 'flat',
      field: { delta: 0 },
      summary: 'no clear change',
    },
    distribution: 'precise 65%, scene partner 35%',
    tracePath: 'traces/fixture.jsonl',
    field: {
      rows: [
        {
          learnerMastery: 0.2,
          learnerRisk: 0.5,
          tutorAlignment: 0.4,
          jointMomentum: 0.2,
          speed: 0.5,
          bottleneck: 'p2',
        },
        {
          learnerMastery: 0.6,
          learnerRisk: 0.3,
          tutorAlignment: 0.7,
          jointMomentum: 0.65,
          speed: 0.8,
          bottleneck: 'p4',
          learnerAdvance: { accelerated: true, supportedMoveCount: 2 },
        },
      ],
      summary: { final: { bottleneck: 'p4' } },
    },
    classifierEnabled: true,
    learnerDagEnabled: true,
    registerEnabled: true,
    registerTemperature: 1,
    tutorDagEnabled: true,
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubTechnicalAnalysisLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '6acc1bb4396fee000cb4f8eaed83c5dbe33f12d0bafe0ee27a4b4609d70db006');
  assert.match(output, /DAG preflight: beforeModel=true; publicPremises=2/u);
  assert.match(output, /grounded public record:[\s\S]*signed_by\(ledger, mayor\)/u);
  assert.match(output, /actorial-part selection: sample; selected probability 0\.65; seeded draw 0\.42/u);
  assert.match(output, /trajectory overlay: strength=0\.8/u);
  assert.match(output, /corpus prior: corrections=precise=0\.2, playful=-0\.1/u);
  assert.match(
    output,
    /response revision: model rewrite; triggered by answer secrecy and asking only from information already available/u,
  );
  assert.match(output, /tutor DAG ><reset> turn 4: 2\/3 proof leaves released/u);
  assert.match(output, /generous inference: applied; kind=elliptical_answer/u);
  assert.match(output, /dialogue closure: frame=eligible; basis=proof; lifecycle=awaiting_checkin/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before);
});

test('technical-analysis projection preserves empty and sparse fallback contracts', () => {
  assert.deepEqual(projectTutorStubTechnicalAnalysisLines({ colors: COLORS }), [
    '<cyan>analysis ><reset> no completed turns yet',
    '<dim>  enter a learner turn first, then use /analysis to inspect the stored classifier, learner-DAG, register, and tutor-DAG data<reset>\n',
  ]);

  const output = terminalBytes(
    projectTutorStubTechnicalAnalysisLines({
      turn: { turn: 2, turnId: 'run:t002', learner: 'Again?' },
      classifierEnabled: true,
      learnerDagEnabled: true,
      registerEnabled: true,
      tutorDagEnabled: true,
      colors: COLORS,
    }),
  );
  assert.match(output, /id run:t002/u);
  assert.match(output, /classifier: no classifier output stored for this turn/u);
  assert.match(output, /learner-DAG: no learner-DAG model stored for this turn/u);
  assert.match(output, /selected register: none stored for this turn/u);
  assert.match(output, /tutor DAG: no snapshot stored for this turn/u);
  assert.doesNotMatch(output, /field state:|trace:/u);
});

test('the debug-report runtime retains live preparation and terminal ownership around the technical projector', async () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubTechnicalAnalysisPresentation.js'),
    'utf8',
  );
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubDebugReportRuntime.js'), 'utf8');
  const printSlice = runtimeSource.slice(
    runtimeSource.indexOf('function printCurrentTurnTechnicalAnalysis'),
    runtimeSource.indexOf('function printLightweightDialogueField'),
  );

  assert.match(cliSource, /createTutorStubDebugReportRuntime/u);
  assert.match(runtimeSource, /from '\.\/tutorStubTechnicalAnalysisPresentation\.js';/u);
  assert.match(printSlice, /normalizeStoredRegisterSelection/u);
  assert.match(printSlice, /normalizeStoredRegisterEfficacy/u);
  assert.match(printSlice, /buildLightweightDialogueField/u);
  assert.match(printSlice, /traceDisplayPath/u);
  assert.match(printSlice, /formatEngagementStanceDistribution/u);
  assert.match(printSlice, /projectTutorStubTechnicalAnalysisLines/u);
  assert.match(printSlice, /for \(const line of lines\) writeLine\(line\)/u);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-technical-analysis-presentation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--run-seed',
        '314159',
        '--no-color',
      ],
      initialInput: 'The assay still confuses me.\n',
      followupInputs: [{ afterPlainIncludes: 'tutor >', text: '/analysis technical\n' }],
      stopWhen: (plain) => /analysis technical >[\s\S]*? {2}trace: [^\n]+\n\n/u.test(plain),
      timeoutMs: 20_000,
      env: {
        NO_COLOR: '1',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    const block = result.plain.match(
      /analysis technical > current completed turn 1; id [^\n]+\n[\s\S]*? {2}trace: [^\n]+\n\n/u,
    )?.[0];
    const normalized = block
      ?.replace(/id [^\n]+:t001/u, 'id <run>:t001')
      .replace(/ {2}trace: [^\n]+\.jsonl/u, '  trace: <trace>.jsonl');
    assert.equal(Buffer.byteLength(normalized), 2756);
    assert.equal(sha256(normalized), '323aa92b35cd3e144111afe4b848bd9844819671548e4a45511740e0e498f12d');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
