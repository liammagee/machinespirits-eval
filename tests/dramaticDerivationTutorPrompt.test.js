import assert from 'node:assert/strict';
import test from 'node:test';

import { RHETORICAL_FIGURES } from '../services/dramaticDerivation/rhetoricalMovePolicy.js';
import {
  buildTutorSystemPrompt,
  buildTutorTurnPrompt,
  RELEASE_LATITUDE,
} from '../services/dramaticDerivation/tutorPrompt.js';

const WORLD = {
  question: 'Who owns the lamp?',
  secret: { surface: 'Ada owns the lamp.' },
  rules: [
    {
      id: 'r_named',
      gloss: 'The named person owns it.',
      if: [['named', '?x']],
      then: [['owns', '?x']],
    },
  ],
  premises: [{ id: 'p_note', surface: 'The note names Ada.', fact: ['named', 'ada'] }],
  releaseSchedule: [{ turn: 2, premise: 'p_note', via: 'tutor' }],
  slope: { aporia_window: 3 },
  turnCap: 6,
};

test('base tutor system prompt preserves the complete fixed contract', () => {
  const prompt = buildTutorSystemPrompt({
    world: WORLD,
    script: '  Teach by asking.  ',
    publicSpeechLines: ['PUBLIC SPEECH'],
    publicRegisterPolicyLines: ['REGISTER POLICY'],
  });

  assert.deepEqual(prompt.split('\n'), [
    'Teach by asking.',
    '',
    '---',
    '',
    '# Harness appendix (fixed — the drama beneath the role)',
    '',
    'The public question: Who owns the lamp?',
    'The concealed truth you are staging toward (NEVER state, confirm, or deny it): Ada owns the lamp.',
    '',
    'The rules of evidence the learner already knows:',
    '1. The named person owns it.',
    '   formally: (named ?x) => (owns ?x)',
    '',
    'The full premise ledger (concealed until released; never voice an unreleased one):',
    '- p_note: The note names Ada.',
    '  (formally: named ada)',
    '',
    'The fixed release schedule (the harness enforces it; you are told your cues):',
    '- turn 2: p_note (via tutor)',
    'PUBLIC SPEECH',
    'REGISTER POLICY',
    '',
    `Declare your move each turn: figure ∈ {${RHETORICAL_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {orient, release, consolidate, test, counter_mirror, stage_recognition}.`,
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}}',
  ]);
});

test('active tutor system features retain section order and response fields', () => {
  const prompt = buildTutorSystemPrompt({
    world: WORLD,
    script: 'Teach.',
    dials: { recognition: 3, charisma: 2 },
    options: {
      actsMode: true,
      reconstruct: true,
      confront: true,
      repairClause: true,
      releaseAuthority: true,
      pacingGuard: true,
      visibleGuard: true,
      proofDebtGuard: true,
      plot: true,
      throughline: true,
      rhetoricalPolicy: true,
      didacticMode: true,
      fieldPlanner: true,
      castLayer: true,
      castReinvention: true,
      ownershipProof: true,
      ownershipTransferGate: true,
      strategyLedger: true,
      strategyLedgerV2: true,
      lemmaLayer: { bind: true },
    },
  });

  const ordered = [
    'YOURS TO KEEP OR BEND',
    '# The acts, and the bounded learner',
    "# Your reconstruction of the learner's theory",
    '# The confrontation obligation',
    '# The repair clause',
    '# The proof-debt guard',
    '# The act plot',
    '# The throughline',
    '# The rhetorical move policy',
    '# Didactic mode',
    '# Runtime field planner',
    '# Cast layer',
    '# Learner ownership proof',
    '# Register',
    'Reply with ONLY a JSON object:',
    '# The lemma map',
    '("plot" belongs to act-opening turns ONLY',
    '("throughline" belongs to the FIRST turn',
    '("scene_commitment" belongs to scene-opening turns ONLY',
    '(v2 trialling: your scene strategy is an EXPERIMENT',
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const next = prompt.indexOf(marker);
    assert.ok(next > cursor, `${marker} should follow the previous section`);
    cursor = next;
  }
  assert.match(prompt, /SOLVENCY GUARD/u);
  assert.match(prompt, /PAGE GUARD/u);
  assert.match(prompt, /"release"/u);
  assert.match(prompt, /"theory"/u);
  assert.match(prompt, /"plot"/u);
  assert.match(prompt, /"throughline"/u);
  assert.match(prompt, /"scene_commitment"/u);
  assert.match(prompt, /"strategy_review"/u);
  assert.match(prompt, /"active_lemma"/u);
  assert.match(prompt, /intent ∈ \{[^}]*confront[^}]*restore/u);
});

test('secondary system branches preserve unguarded authority, unbound lemma, and plan-mode contracts', () => {
  const prompt = buildTutorSystemPrompt({
    world: WORLD,
    script: 'Teach.',
    dials: { recognition: 9, charisma: -1 },
    options: {
      releaseAuthority: true,
      castLayer: true,
      ownershipProof: true,
      strategyLedger: true,
      strategyLedgerPlanMode: true,
      lemmaLayer: { bind: false },
    },
  });

  assert.doesNotMatch(prompt, /SOLVENCY GUARD|PAGE GUARD/u);
  assert.doesNotMatch(prompt, /tutor reinvention is active|transfer gate appears/u);
  assert.match(prompt, /It is information about where the proof stands/u);
  assert.match(prompt, /Plan mode: between scenes your own second voice takes stock/u);
  assert.match(prompt, /"reorientation"/u);
});

function turnInput(overrides = {}) {
  return {
    actsMode: false,
    world: WORLD,
    view: {
      turn: 3,
      ledger: [{ turn: 2, premiseId: 'p_note' }],
      acts: { index: 2, turnsThisAct: 1, startTurn: 3, brief: 'Slow the room.' },
    },
    task: 'ASK NOW',
    boardText: '- named ada',
    hypothesesText: '- [turn 2] Ada may own it.',
    decayLines: ['DECAY', ''],
    forcedNote: 'FORCED',
    fullTranscriptText: 'FULL TRANSCRIPT',
    transcriptText: 'TAIL',
    stagePrologueLines: ['PROLOGUE'],
    publicRegisterLines: ['REGISTER'],
    registerRouterBlock: 'ROUTER',
    sceneTempoLines: ['TEMPO'],
    sceneRecognitionNeedLines: ['RECOGNITION'],
    castLayerSection: ['CAST'],
    actDidacticFallbackSection: ['ACT DIDACTIC'],
    didacticModeSection: ['DIDACTIC'],
    fieldReportSection: ['FIELD REPORT'],
    fieldPlannerSection: ['FIELD PLANNER'],
    learnerTransformationSection: ['OWNERSHIP'],
    visibleConsolidationLines: ['CONSOLIDATE'],
    throughlineSection: ['THROUGHLINE'],
    plotSection: ['PLOT'],
    strategyLedgerSection: ['STRATEGY'],
    rhetoricalPolicySection: ['RHETORIC'],
    proofDebtSection: ['PROOF DEBT'],
    tutorLearnerDagModelSection: ['DAG MODEL'],
    proxyDagPacingSection: ['DAG PACE'],
    discursiveReleaseSection: ['DISCURSIVE'],
    ...overrides,
  };
}

test('non-acts tutor turn prompt preserves every derived section in order', () => {
  const prompt = buildTutorTurnPrompt(turnInput());
  assert.deepEqual(prompt.split('\n'), [
    'Turn 3 of 6.',
    'Evidence on stage so far: p_note.',
    'PROLOGUE',
    '',
    'ROUTER',
    'TEMPO',
    'RECOGNITION',
    'CAST',
    '',
    "The learner's grounded board:",
    '- named ada',
    '',
    "The learner's hypotheses:",
    '- [turn 2] Ada may own it.',
    '',
    'DECAY',
    '',
    'The last lines spoken:',
    'TAIL',
    'REGISTER',
    '',
    'CONSOLIDATE',
    'DIDACTIC',
    'FIELD REPORT',
    'FIELD PLANNER',
    'OWNERSHIP',
    'STRATEGY',
    '',
    'FORCED',
    '',
    'RHETORIC',
    'DISCURSIVE',
    'PROOF DEBT',
    'DAG MODEL',
    'DAG PACE',
    '',
    'ASK NOW',
  ]);
});

test('acts tutor turn prompt preserves bounded-memory framing and policy order', () => {
  const input = turnInput({
    actsMode: true,
    view: {
      turn: 4,
      ledger: [
        { turn: 2, premiseId: 'p_old' },
        { turn: 3, premiseId: 'p_new' },
      ],
      acts: { index: 2, turnsThisAct: 1, startTurn: 3, brief: 'Slow the room.' },
    },
  });
  const prompt = buildTutorTurnPrompt(input);

  assert.deepEqual(prompt.split('\n'), [
    'Turn 4 of 6. Act 2, turn 2 of the act.',
    "The director's brief for this act: Slow the room.",
    'Evidence on stage so far: p_old, p_new.',
    'Released THIS act (still before the learner): p_new.',
    "Released in EARLIER acts (out of the learner's view — alive only if kept on their board, or re-staged by you): p_old.",
    'PROLOGUE',
    '',
    'The dialogue so far (you remember all of it; the learner sees only this act):',
    'FULL TRANSCRIPT',
    'REGISTER',
    '',
    'ROUTER',
    'TEMPO',
    'RECOGNITION',
    'CAST',
    'ACT DIDACTIC',
    'DIDACTIC',
    'FIELD REPORT',
    'FIELD PLANNER',
    'OWNERSHIP',
    '',
    'CONSOLIDATE',
    'THROUGHLINE',
    'PLOT',
    'STRATEGY',
    'RHETORIC',
    'PROOF DEBT',
    'DAG MODEL',
    'DAG PACE',
    '',
    'ASK NOW',
  ]);
});

test('empty turn projections preserve absence branches and release latitude', () => {
  const empty = turnInput({
    view: { turn: 1, ledger: [], acts: { index: 1, turnsThisAct: 0, startTurn: 1, brief: null } },
    stagePrologueLines: [],
    publicRegisterLines: [],
    registerRouterBlock: null,
    sceneTempoLines: [],
    sceneRecognitionNeedLines: [],
    castLayerSection: [],
    visibleConsolidationLines: [],
    proofDebtSection: [],
    forcedNote: null,
  });
  const nonActs = buildTutorTurnPrompt(empty);
  const acts = buildTutorTurnPrompt({ ...empty, actsMode: true });

  assert.match(nonActs, /Evidence on stage so far: none\./u);
  assert.doesNotMatch(nonActs, /ROUTER|CONSOLIDATE|FORCED|PROOF DEBT/u);
  assert.match(acts, /Released THIS act \(still before the learner\): none\./u);
  assert.match(acts, /Released in EARLIER acts .*: none\./u);
  assert.equal(RELEASE_LATITUDE, 2);
});
