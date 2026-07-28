import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubTurnAnalysisLines } from '../services/tutorStubTurnAnalysisPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  cyan: '<cyan>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('turn-analysis projection preserves the complete learner-facing presentation contract', () => {
  const input = {
    turn: {
      turn: 7,
      learner: 'The broken seal   and the signed ledger fit together.',
      classification: {
        turn: {
          summary: 'The learner connected two public clues.',
          pedagogical_need: 'Ask for the learner-owned public move.',
        },
        overall: {
          summary: 'The inquiry is converging.',
          next_best_tutor_move: 'Invite the final warrant.',
        },
      },
      learnerAdvance: { accelerated: true, adoptedPremiseCount: 2, derivedFactCount: 1 },
      releasePacing: {
        signal: { direction: 'accelerate', reason: 'The learner supplied a warranted chain.' },
        effectiveSpeed: 1.5,
        releasedNow: ['clue-a', 'clue-b'],
      },
      humanDiscourseFrame: {
        generousInference: {
          applied: true,
          resolvedMeaning: 'The learner meant that the seal authenticates the ledger.',
        },
        proofDebt: { elision: { applied: true, count: 2 } },
        questionSupport: { modality: 'stage_then_ask' },
      },
      dialogueClosure: { lifecycle: { phase: 'awaiting_checkin' } },
      comprehension: { beforeTutor: { features: { pressure: 0.8, unresolvedTerms: ['assay', 'provenance'] } } },
      dagFactDropout: { droppedNow: ['p1'], activeDropped: ['p1'] },
      responseConfigurationAudit: { visible_axis_count: 4, axis_count: 5 },
      tutorResponseRepaired: true,
      tutorGuardAccounting: {
        repairsApplied: [{ triggeredBy: [{ guard: 'question_support' }, { guard: 'repetition' }] }],
      },
    },
    registerSelection: {
      policy_composition: {
        overlay_policies: ['trajectory', 'field'],
        activated_overlay: 'trajectory',
      },
      dynamical_system_policy: {
        state_vector: { learner_acceleration: 0.9, evidence_gap: 0.7, momentum: 0.6, stagnation: 0.15 },
      },
      action_family: 'clarify_distinction',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'plain_language',
      scene_immersion: 'inside_the_archive',
      actorial_part_label: 'adversarial_schoolmaster',
      actorial_performance: { label: 'rapid_evidence_handoff', contract: 'press, then return agency' },
      actorial_part_selection: { reason: 'The learner is ready for a firmer evidential challenge.' },
      expected_field_move: 'Convert the learner-DAG into a learner-owned public move.',
      expected_dag_move: 'Add the public premise without coercion pressure.',
    },
    previousEfficacy: {
      label: 'positive_progress',
      selected_register: 'warm_socratic',
      learnerFeedback: { rating: 'up' },
    },
    policy: 'continuous_dynamical_system',
    distribution: 'precise 55%, warm 30%, playful 15%',
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubTurnAnalysisLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '5df0f1ac62bc7df230a87229d2a6a89e366057cb56b764eff9c3e2207057937b');
  assert.match(output, /analysis ><reset> turn 7/u);
  assert.match(output, /learning pace: accelerating: 2 public premise\(s\) and 1 supported inference\(s\)/u);
  assert.match(output, /clue pace: .*2 new clues entered this turn\./u);
  assert.match(output, /question support: new evidence was stated before the learner was asked to interpret it/u);
  assert.match(output, /why this approach was chosen:[\s\S]*learner supplied several warranted steps/u);
  assert.match(
    output,
    /tutor’s immediate aim: Convert the learner’s reasoning into a response in the learner’s own words\./u,
  );
  assert.match(output, /response check: The first draft needed revision/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before);
});

test('turn-analysis projection preserves empty and sparse fallbacks without inventing state', () => {
  assert.deepEqual(projectTutorStubTurnAnalysisLines({ colors: COLORS }), [
    '<cyan>analysis ><reset> no completed turns yet',
    '<dim>  enter a learner turn first, then use /analysis; add "technical" for debugging evidence<reset>\n',
  ]);

  const lines = projectTutorStubTurnAnalysisLines({
    turn: {
      turn: 2,
      learner: 'Please say that more plainly.',
      classification: { turn: { pedagogical_need: 'Restate the public premise.' } },
      releasePacing: { signal: { direction: 'steady' } },
      humanDiscourseFrame: { questionSupport: { modality: 'custom', reason: 'a stored support reason' } },
      dialogueClosure: { lifecycle: { phase: 'closed' } },
      comprehension: { beforeTutor: { features: { pressure: 1, unresolvedTerms: [] } } },
      dagFactDropout: { repairedNow: ['p2'] },
    },
    policy: 'off',
    colors: COLORS,
  });
  const output = terminalBytes(lines);

  assert.match(output, /plain reading: No plain-language reading is available\./u);
  assert.match(output, /question support: a stored support reason/u);
  assert.match(output, /dialogue ending: the tutor has explicitly closed the inquiry/u);
  assert.match(output, /wording gap: the learner recently asked for plainer wording/u);
  assert.match(output, /memory recovery: 1 dropped evidence item\(s\) were re-adopted/u);
  assert.match(output, /teaching approach: off/u);
  assert.match(output, /tutor’s immediate aim: Restate the piece of public evidence\./u);
  assert.doesNotMatch(output, /clue pace:|style blend:|why this approach was chosen:/u);
});

test('turn-analysis projection retains question-support wording and prior-efficacy outcomes', () => {
  const supportReadings = {
    open_question: 'the next question was answerable from public evidence',
    embedded_directional_hint:
      'the missing direction was put into the discourse because the exact evidence was not public yet',
    bounded_directional_choice: 'a small public-safe choice replaced an impossible open recall question',
    stage_then_ask: 'new evidence was stated before the learner was asked to interpret it',
    stage_then_bounded_choice: 'new evidence was stated first, then narrowed to a small interpretive choice',
    embedded_public_hint: 'an already-public clue was restated and narrowed before asking',
    bounded_public_choice: 'an already-public clue was narrowed to a small interpretive choice',
  };

  for (const [modality, expected] of Object.entries(supportReadings)) {
    const output = terminalBytes(
      projectTutorStubTurnAnalysisLines({
        turn: {
          turn: 1,
          humanDiscourseFrame: { questionSupport: { modality } },
        },
        registerSelection: { reviewer_signal: 'hold the current line' },
        previousEfficacy: {
          label: 'regression_or_overreach',
          selected_register: 'face_threat',
          learnerFeedback: { rating: 'down' },
        },
      }),
    );
    assert.match(output, new RegExp(`question support: ${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u'));
    assert.match(output, /last teaching style result: face threat: was followed by regression or overreach/u);
    assert.match(output, /your rating of that reply: not helpful;/u);
    assert.match(output, /why: hold the current line/u);
  }

  const neutral = terminalBytes(
    projectTutorStubTurnAnalysisLines({
      turn: { turn: 1 },
      previousEfficacy: { label: 'neutral', selected_register: 'plain' },
    }),
  );
  assert.match(neutral, /plain: did not yet produce clear reasoning progress/u);
});

test('the real CLI keeps normalization, technical dispatch, and terminal ownership around the projector', async () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTurnAnalysisPresentation.js'), 'utf8');
  const printSlice = cliSource.slice(
    cliSource.indexOf('function printCurrentTurnAnalysis'),
    cliSource.indexOf('function debugNumber'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubTurnAnalysisPresentation\.js';/u);
  assert.match(printSlice, /if \(technical\) return printCurrentTurnTechnicalAnalysis\(state\)/u);
  assert.match(printSlice, /normalizeStoredRegisterSelection/u);
  assert.match(printSlice, /normalizeStoredRegisterEfficacy/u);
  assert.match(printSlice, /formatEngagementStanceDistribution/u);
  assert.match(printSlice, /projectTutorStubTurnAnalysisLines/u);
  assert.match(printSlice, /for \(const line of lines\) console\.log\(line\)/u);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-analysis-presentation-'));
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
      followupInputs: [{ afterPlainIncludes: 'tutor >', text: '/analysis\n' }],
      stopWhen: (plain) => plain.includes('technical details: /analysis technical (or /a technical)'),
      timeoutMs: 20_000,
      env: {
        NO_COLOR: '1',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    const block = result.plain.match(
      /analysis > turn 1\n[\s\S]*?technical details: \/analysis technical \(or \/a technical\)\n\n/u,
    )?.[0];
    assert.equal(Buffer.byteLength(block), 1093);
    assert.equal(sha256(block), 'a379dd60b84a554b4e79a4ad00bcf2d294aaa2a9751112f50148f4b14ad303b9');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
