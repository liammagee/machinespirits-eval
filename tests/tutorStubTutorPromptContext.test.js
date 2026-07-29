import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubDialogueClosureContext,
  projectTutorStubHumanDiscourseContext,
  projectTutorStubLearnerDagModelContext,
} from '../services/tutorStubTutorPromptContext.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function fullLearnerDagFixture() {
  return {
    result: {
      model: {
        metrics: {
          groundedCount: 3,
          voicedDerivedCount: 2,
          hypothesisCount: 2,
          answerCandidateCount: 1,
          missingPremiseCount: 4,
        },
        assessment: {
          bestPathCoverage: 0.625,
          bottleneck: 'unreleased bridge',
        },
        learnerRecord: {
          grounded: [
            { surface: '  Brass  key\tfits  ' },
            { surface: 'Ledger row matches' },
            { surface: 'derived inference' },
          ],
          hypotheses: [{ text: 'Ada used the key' }, { text: 'Bram staged it' }],
          answerCandidates: [{ surface: 'Ada' }],
        },
        memoryReliability: {
          activeDroppedCount: 2,
        },
      },
    },
    options: {
      releasedEvidence: [
        { surface: 'Brass key fits' },
        { surface: 'not matched' },
        { surface: 'Ledger row   matches' },
      ],
    },
  };
}

function fullHumanDiscourseFixture() {
  return {
    frame: {
      mode: 'defeasible_human_scaffold',
      scaffoldState: {
        branch: { label: 'the maker seal' },
        localQuestion: 'What does the clipped seal establish?',
        warrantFrame: 'Connect the clipped seal to the public registry entry.',
        joinReminder: 'Keep access separate from authorship.',
        releaseState: {
          dueNow: [
            {
              via: 'director',
              surface:
                'The clerk places the brass key beside the copied registry row and points to the clipped maker seal under the lamp.',
            },
            {
              via: 'tutor',
              surface:
                'A deliberately overlong exhibit description repeats the public scene boundary until it exceeds the projector limit without adding any hidden fact or answer.',
            },
          ],
          latestReleased: { surface: 'This fallback must not render while due evidence exists.' },
        },
      },
      sideArc: {
        detected: true,
        type: 'clarification',
        returnTarget: { afterSideArc: 'return to the clipped seal' },
      },
      discoursePlane: {
        plane: 'inquiry',
        freeze_clue_release: false,
      },
      proofDebt: {
        status: 'open_proof_debt',
        counts: { open: 4, harmful: 1 },
        open: [
          'the learner has not connected custody to access',
          { surface: 'the seal is public', warrantNeeded: 'connect it to the registry', reason: 'bridge remains open' },
          { surface: 'the key fits', reason: 'fit does not prove use' },
          { surface: 'the fourth row is beyond the display limit' },
        ],
        elision: {
          applied: true,
          count: 2,
          tutorInstruction: 'Carry the ordinary custody bridge silently.',
        },
      },
      warrantPremiseAudit: {
        premises: {
          suppressedOrPrivate: [
            { surface: 'private inventory note', reason: 'not public' },
            { surface: 'unstaged witness recollection', warrantNeeded: 'release it first' },
          ],
          illicitHidden: [
            { surface: 'answer-key identity', reason: 'concealed conclusion' },
            { surface: 'fourth hidden row beyond the display limit' },
          ],
        },
      },
      stepCompression: {
        enabled: true,
        policy: 'accept ordinary public bridges',
        maxExplicitDemandsPerTurn: 2,
      },
      generousInference: {
        applied: true,
        resolvedMeaning: 'The clipped seal matches the registry row.',
        tutorInstruction: 'Credit the match and advance to custody.',
      },
      conversationalCompletion: {
        resolved: true,
        status: 'accepted',
        acceptedMeaning: 'The learner has answered the seal question.',
        instruction: 'Do not reopen the seal question.',
      },
      questionSupport: {
        answerability: 'direction_only_until_evidence_is_public',
        modality: 'bounded_choice',
        reason: 'The witness recollection is not public yet.',
        tutorInstruction: 'Ask only what the public seal changes.',
      },
    },
    options: {
      includeQuestionSupport: true,
      includeDefaultResponseShape: true,
    },
  };
}

test('tutor prompt projections retain their empty compatibility boundaries', () => {
  assert.equal(projectTutorStubLearnerDagModelContext(null), '');
  assert.equal(projectTutorStubLearnerDagModelContext(undefined), '');
  assert.equal(projectTutorStubHumanDiscourseContext(null), '');
  assert.equal(projectTutorStubHumanDiscourseContext({ mode: 'strict_dag' }), '');
  assert.equal(projectTutorStubDialogueClosureContext(null), '');
  assert.equal(projectTutorStubDialogueClosureContext({ enabled: false, mandatory: true }), '');
  assert.equal(projectTutorStubDialogueClosureContext({ enabled: true }), '');
});

test('redacted learner-DAG context is byte-exact and leaves its nested inputs untouched', () => {
  const { result, options } = fullLearnerDagFixture();
  const frozenResult = deepFreeze(result);
  const frozenOptions = deepFreeze(options);
  const before = structuredClone({ result: frozenResult, options: frozenOptions });
  const context = projectTutorStubLearnerDagModelContext(frozenResult, frozenOptions);

  assert.deepEqual(
    { bytes: Buffer.byteLength(context), sha256: sha256(context) },
    { bytes: 874, sha256: '3e441ff0cc5c3dd05d17c2d287f8d2093337ba56c130da9bbfa79f80822e2838' },
  );
  assert.deepEqual({ result: frozenResult, options: frozenOptions }, before);
  assert.match(context, /2 released public evidence items currently learner-grounded/u);
  assert.match(context, /1 additional public or derived fact currently grounded/u);
  assert.match(context, /Memory reliability: 2 previously accumulated/u);
  assert.match(context, /Learner hypotheses:\n- Ada used the key\n- Bram staged it/u);
  assert.match(context, /Answer candidates[^\n]+:\n- Ada/u);
});

test('redacted learner-DAG context preserves unavailable and empty fallbacks', () => {
  const context = projectTutorStubLearnerDagModelContext({ learnerRecord: {} });

  assert.match(context, /Best-path coverage: unavailable/u);
  assert.match(context, /Bottleneck: unavailable/u);
  assert.match(context, /Counts: grounded=0, voiced=0, hypotheses=0, answerCandidates=0, missing=0/u);
  assert.match(context, /Grounding status:\n- no released public evidence is currently learner-grounded/u);
  assert.match(context, /Learner hypotheses:\n- none/u);
  assert.match(context, /Answer candidates[^\n]+:\n- none/u);
  assert.doesNotMatch(context, /Memory reliability:/u);
});

test('full human-discourse context is byte-exact, bounded, and immutable', () => {
  const { frame, options } = fullHumanDiscourseFixture();
  const frozenFrame = deepFreeze(frame);
  const frozenOptions = deepFreeze(options);
  const before = structuredClone({ frame: frozenFrame, options: frozenOptions });
  const context = projectTutorStubHumanDiscourseContext(frozenFrame, frozenOptions);

  assert.deepEqual(
    { bytes: Buffer.byteLength(context), sha256: sha256(context) },
    { bytes: 3659, sha256: 'a04c05dcf36fd46f6fb6cabb4e1bdcec384f227f46f7af8acf4fca84c78260ce' },
  );
  assert.deepEqual({ frame: frozenFrame, options: frozenOptions }, before);
  assert.match(context, /Evidence available now: scene evidence:/u);
  assert.match(context, /Contextual answer resolution: APPLIED/u);
  assert.match(context, /Conversational completion: accepted/u);
  assert.match(context, /Open proof debt:[\s\S]*the key fits — fit does not prove use/u);
  assert.doesNotMatch(context, /fourth row is beyond/u);
  assert.match(context, /Hidden\/private premise risk:[\s\S]*answer-key identity — concealed conclusion/u);
  assert.doesNotMatch(context, /fourth hidden row beyond/u);
  assert.match(context, /This epistemic-affordance rule overrides/u);
});

test('human-discourse options suppress question support and default response shape only', () => {
  const { frame } = fullHumanDiscourseFixture();
  const context = projectTutorStubHumanDiscourseContext(frame, {
    includeQuestionSupport: false,
    includeDefaultResponseShape: false,
  });

  assert.doesNotMatch(context, /Question support:/u);
  assert.doesNotMatch(context, /Authoritative question rule:/u);
  assert.doesNotMatch(context, /Default response shape:/u);
  assert.match(context, /Contextual answer resolution: APPLIED/u);
  assert.match(context, /Never mention scaffold state/u);
});

test('instructional-repair context freezes inquiry movement with optional response shape', () => {
  const frame = {
    mode: 'defeasible_human_scaffold',
    discoursePlane: { plane: 'instructional_meta', freeze_clue_release: true },
    sideArc: { detected: true, type: 'comprehension_repair' },
  };
  const expected = [
    '[Tutor-only human discourse scaffold]',
    'Mode: defeasible_human_scaffold; strict DAG remains the audit, but the learner-facing scaffold is active.',
    'Discourse plane: instructional repair. The learner is asking about the explanation itself, not contributing a proposition to the inquiry. Keep the learner-DAG and clue release frozen for this turn.',
    'Side arc: comprehension_repair. Repair the explanation completely before any later return to the inquiry.',
    'The public inquiry question remains paused. Do not quote it, restate it, or ask any other question in this turn.',
    'Response shape: directly acknowledge the wording problem, restate the immediately preceding tutor point in plain words, and optionally end with one declarative invitation to unpack another phrase.',
    'Never mention scaffold state, proof debt, side arcs, DAGs, premise ids, rule ids, hidden facts, or release schedules.',
    '[End tutor-only human discourse scaffold]',
  ].join('\n');

  assert.equal(projectTutorStubHumanDiscourseContext(frame), expected);
  assert.equal(
    projectTutorStubHumanDiscourseContext(frame, { includeDefaultResponseShape: false }),
    expected
      .split('\n')
      .filter((line) => !line.startsWith('Response shape:'))
      .join('\n'),
  );
});

test('dialogue-closure context pins final check-in, mandatory, and available branches', () => {
  assert.equal(
    projectTutorStubDialogueClosureContext({
      enabled: true,
      mandatory: true,
      available: true,
      phase: 'final_checkin_response',
    }),
    [
      '[Tutor-only dialogue closure]',
      'Phase: one final learner check-in after the case reached closure.',
      'Answer only the learner’s check-in from the public transcript. Do not introduce new evidence or restart the proof sequence.',
      'End with an explicit statement that the case, book, or inquiry is closed and complete.',
      'Do not ask any further question. This is the terminal tutor turn.',
      '[End tutor-only dialogue closure]',
    ].join('\n'),
  );

  const mandatory = projectTutorStubDialogueClosureContext({
    enabled: true,
    mandatory: true,
    available: true,
    basis: 'grounded conclusion',
    allowCheckIn: true,
  });
  assert.match(mandatory, /Closure basis: grounded conclusion/u);
  assert.match(mandatory, /You may end with one optional check-in/u);
  assert.match(
    projectTutorStubDialogueClosureContext({
      enabled: true,
      mandatory: true,
      basis: 'grounded conclusion',
      allowCheckIn: false,
    }),
    /Do not ask a follow-up question; end the dialogue now\./u,
  );

  const available = projectTutorStubDialogueClosureContext({
    enabled: true,
    mandatory: false,
    available: true,
    allowCheckIn: true,
  });
  assert.match(available, /authored proof DAG is now fully public/u);
  assert.match(available, /After closing, you may ask one optional final check-in/u);
  assert.match(
    projectTutorStubDialogueClosureContext({
      enabled: true,
      mandatory: false,
      available: true,
      allowCheckIn: false,
    }),
    /If you close, do not ask a follow-up question\./u,
  );
});

test('the CLI retains state construction and wrappers while the tutor-turn pipeline owns prompt assembly', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTutorPromptContext.js'), 'utf8');
  const pipelineSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTutorTurnPipeline.js'), 'utf8');
  const learnerDagWrapper = cliSource.slice(
    cliSource.indexOf('function tutorLearnerDagModelContext'),
    cliSource.indexOf('function humanDiscourseTutorContext'),
  );
  const humanDiscourseWrapper = cliSource.slice(
    cliSource.indexOf('function humanDiscourseTutorContext'),
    cliSource.indexOf('function dialogueClosureTutorContext'),
  );
  const closureWrapper = cliSource.slice(
    cliSource.indexOf('function dialogueClosureTutorContext'),
    cliSource.indexOf('function createLearnerDagState'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubTutorPromptContext\.js';/u);
  assert.match(learnerDagWrapper, /projectTutorStubLearnerDagModelContext/u);
  assert.match(humanDiscourseWrapper, /projectTutorStubHumanDiscourseContext/u);
  assert.match(closureWrapper, /projectTutorStubDialogueClosureContext/u);
  assert.match(cliSource, /function tutorPromptSurfaceKey/u);
  assert.match(cliSource, /function createLearnerDagState/u);
  assert.match(cliSource, /function buildHumanDiscourseFrame/u);
  assert.match(cliSource, /function dagTurnContext/u);
  assert.match(cliSource, /createTutorStubTutorTurnPipeline/u);
  assert.match(pipelineSource, /return async function callTutor/u);
  assert.match(cliSource, /learnerDag: tutorLearnerDagModelContext/u);
  assert.match(cliSource, /humanDiscourse: humanDiscourseTutorContext/u);
  assert.match(cliSource, /dialogueClosure: dialogueClosureTutorContext/u);
  assert.doesNotMatch(cliSource, /\[Tutor-only redacted learner-DAG model\]/u);
  assert.doesNotMatch(cliSource, /\[Tutor-only human discourse scaffold\]/u);
  assert.doesNotMatch(cliSource, /\[Tutor-only dialogue closure\]/u);
  assert.doesNotMatch(serviceSource, /(?:from|import\()[^\n]*scripts\//u);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
  assert.doesNotMatch(pipelineSource, /(?:from|import\()[^\n]*scripts\//u);
});
