import assert from 'node:assert/strict';
import test from 'node:test';

import { tutorStrategyLedgerPromptLines } from '../services/dramaticDerivation/tutorStrategyLedgerPrompt.js';

const DIDACTIC_MODES =
  'minimal_presence, teach_back, concrete_example, analogy_bridge, contrast_case, slow_recap, purpose_bridge, decompose_subtask, repair_vocabulary';

test('off state emits no strategy-ledger prompt lines', () => {
  assert.deepEqual(tutorStrategyLedgerPromptLines(), []);
  assert.deepEqual(
    tutorStrategyLedgerPromptLines({
      strategyLedger: false,
      sceneCommitmentAudit: { clauses: null },
      view: null,
    }),
    [],
  );
});

test('sealed-scene audit and mechanism history retain their binding order and wording', () => {
  const lines = tutorStrategyLedgerPromptLines({
    strategyLedger: true,
    sceneCommitmentAudit: {
      sceneIndex: 2,
      clauses: [
        { verdict: 'kept', clause: 'hold the line', evidence: 'turn 4' },
        { verdict: 'drifted', clause: 'invite a test', evidence: null },
      ],
      summary: 'one clause drifted',
    },
    trialling: true,
    sceneOpening: true,
    ledgerInfo: {
      history: [
        {
          sceneIndex: 2,
          strategy: {
            stance: 'sarcastic',
            didacticDefault: 'teach_back',
            releasePosture: 'hold',
            releaseIntent: ['p2', 'p3'],
          },
          fidelity: { label: 'faithful' },
          outcome: { exitConditionCleared: false, pressingExchanges: 2, intendedPlayed: 1 },
          audit: { summary: 'one drift' },
          review: { decision: 'adjust' },
        },
        {
          sceneIndex: 1,
          strategy: {},
          fidelity: null,
          outcome: { exitConditionCleared: null, pressingExchanges: 0, intendedPlayed: null },
          audit: null,
          review: null,
        },
      ],
    },
    view: {},
  });

  assert.deepEqual(lines, [
    '',
    'THE AUDIT of your scene 2 commitment (deterministic, clause by clause):',
    '- [kept] hold the line — turn 4',
    '- [drifted] invite a test',
    'Summary: one clause drifted.',
    'THE AUDIT BINDS: the commitment you now make must answer every drifted clause — carry it forward, revise it, or change course with a stated reason.',
    '',
    'YOUR MECHANISM HISTORY (what you tried, whether it was really tried, how it landed):',
    '- scene 2 [stance sarcastic, didactic teach_back, releases hold, intended p2+p3] -> fidelity faithful; exit NOT cleared; 2 pressing exchange(s); 1/2 intended played; one drift; you chose: adjust',
    '- scene 1 [no strategy] -> no outcome recorded',
    'REVIEW THE RECORD and decide in "strategy_review": persist (same strategy), adjust (same mechanism, new settings), or switch (a different mechanism) — with a one-line reason.',
    'Outcomes only count for a mechanism that was actually deployed (fidelity: faithful); warm-in-costume trials teach you nothing.',
  ]);
});

test('plan mode renders the stock-take and orientation instead of an opening commitment', () => {
  const lines = tutorStrategyLedgerPromptLines({
    strategyLedger: true,
    planMode: true,
    sceneOpening: true,
    stocktakeNote: {
      sceneIndex: 3,
      assessment: 'the route outran the learner',
      correction: 'rebuild from the public board',
    },
    ledgerBridgeState: {
      orientation: 'Move slowly from what the learner can already warrant.',
      commitment: { register: 'period' },
    },
    view: { scene: { index: 4 } },
    activeRegisterName: 'modern',
  });

  assert.deepEqual(lines, [
    '',
    'STOCK-TAKE on scene 3 (your own second voice, between scenes — course, not conformance):',
    '- assessment: the route outran the learner',
    '- CORRECTION DEMANDED: rebuild from the public board',
    'Answer it in "reorientation": your revised WORKING ORIENTATION (2-4 sentences) when a correction is demanded or you yourself judge the course has failed; null keeps your current orientation.',
    '',
    'YOUR WORKING ORIENTATION (yours alone; revised at your last stock-take — no one grades you against it):',
    'Move slowly from what the learner can already warrant.',
  ]);
});

test('plan mode preserves the no-correction line when assessment and orientation are absent', () => {
  assert.deepEqual(
    tutorStrategyLedgerPromptLines({
      strategyLedger: true,
      planMode: true,
      stocktakeNote: { sceneIndex: 1 },
      view: {},
    }),
    [
      '',
      'STOCK-TAKE on scene 1 (your own second voice, between scenes — course, not conformance):',
      '- no correction demanded — the course holds.',
      'Answer it in "reorientation": your revised WORKING ORIENTATION (2-4 sentences) when a correction is demanded or you yourself judge the course has failed; null keeps your current orientation.',
    ],
  );
});

test('scene opening renders the base strategy commitment with the active register fallback', () => {
  const lines = tutorStrategyLedgerPromptLines({
    strategyLedger: true,
    sceneOpening: true,
    ledgerInfo: { config: {} },
    view: { scene: { index: 5 } },
    activeRegisterName: 'modern',
  });

  assert.deepEqual(lines, [
    '',
    'THIS TURN OPENS SCENE 5 — COMMIT YOUR SCENE STRATEGY in "scene_commitment", alongside your dialogue:',
    '- register: choose from [modern] — the harness holds your choice for the whole scene.',
    `- didactic_default: your explanatory mode of first resort this scene (${DIDACTIC_MODES}).`,
    '- release_posture: eager (play exhibits on their cue), hold (never ahead of schedule), consolidate (at most one release this scene).',
    '- recognition_budget: how many phatic/uptake exchanges this scene can afford (0-4).',
    '- exit_condition: what the learner will visibly do when this scene has worked.',
    'Conduct only: the release calendar and proof-control obligations outrank this everywhere they speak.',
  ]);
});

test('trial opening renders palette-bound stance fidelity and release intent', () => {
  const lines = tutorStrategyLedgerPromptLines({
    strategyLedger: true,
    trialling: true,
    releaseAuthority: true,
    sceneOpening: true,
    ledgerInfo: {
      config: {
        registerPalette: ['period', 'modern'],
        stancePalette: ['sarcastic', 'plain'],
        releaseIntent: true,
      },
    },
    view: { scene: { index: 2 } },
    activeRegisterName: 'modern',
  });

  assert.equal(
    lines[2],
    '- register: choose from [period, modern] — the harness holds your choice for the whole scene.',
  );
  assert.deepEqual(lines.slice(8), [
    '- stance: choose your interpersonal stance for this scene from the palette (or null to stay plain):',
    '  · sarcastic (negative valence) — cues that MUST be visible in your lines: "wonderful", "conveniently", "apparently", "nice trick"',
    '  · plain (positive valence)',
    '  A stance counts only when its cues are visible — an assigned stance without visible cues is treatment noncompliance, not style.',
    '- release_intent: name the exhibit ids (up to 4, from your window) you INTEND to play this scene. Advisory to each turn; the pacing guard and hold limits rule as ever.',
  ]);
});

test('standing commitment preserves every optional field and its trial departure rule', () => {
  const context = {
    strategyLedger: true,
    trialling: true,
    sceneOpening: false,
    ledgerBridgeState: {
      sceneIndex: 7,
      commitment: {
        register: 'period',
        stance: 'sarcastic',
        didacticDefault: 'contrast_case',
        releasePosture: 'consolidate',
        releaseIntent: ['p4'],
        recognitionBudget: 0,
        exitCondition: 'the learner states the contrast',
      },
    },
    view: {},
  };
  const lines = tutorStrategyLedgerPromptLines(context);

  assert.deepEqual(lines, [
    '',
    'YOUR SCENE COMMITMENT (scene 7, standing since its opening):',
    '- register: period (held by the harness)',
    '- stance: sarcastic — keep its cues visible: "wonderful", "conveniently", "apparently", "nice trick"',
    '- didactic default: contrast_case',
    '- release posture: consolidate',
    '- release intent: p4 (guards rule)',
    '- recognition budget: 0',
    '- exit: the learner states the contrast',
    'It GUIDES rather than binds: depart when the learner warrants it and declare it in "departure" — declared departures adjudicate as justified deviation, undeclared drift as drift.',
  ]);
  assert.equal(
    tutorStrategyLedgerPromptLines({ ...context, trialling: false }).at(-1),
    'Play under it; the audit at the scene close distinguishes kept from drift.',
  );
});

test('lemma frontier, didactic hold, and exhausted budget remain last and ordered', () => {
  const lines = tutorStrategyLedgerPromptLines({
    strategyLedger: true,
    sceneOpening: false,
    ledgerInfo: { budget: { exhausted: true } },
    heldDidacticNote: 'DIDACTIC HOLD: keep teach_back.',
    view: {
      turn: 4,
      scene: { startTurn: 4 },
      lemmaLayer: {
        config: { bind: true },
        tutorLines: ['ACTIVE LEMMA: blankFrom', 'Stay inside its support.'],
        frontier: [
          { label: 'blankFrom', supportRemaining: ['p2', 'p3'] },
          { label: 'sameInk', supportRemaining: [] },
        ],
      },
    },
  });

  assert.deepEqual(lines, [
    '',
    'ACTIVE LEMMA: blankFrom',
    'Stay inside its support.',
    '',
    'FRONTIER CHOICE (this turn opens a scene): pick the scene\'s ACTIVE lemma in "active_lemma" — the predicate name alone suffices (e.g. "blankFrom"). One of:',
    '- "blankFrom" (unplayed support: p2, p3)',
    '- "sameInk" (unplayed support: none — grounds from the played board)',
    '',
    'DIDACTIC HOLD: keep teach_back.',
    '',
    'OPPORTUNITY BUDGET EXHAUSTED: proof-neutral turns have run past the block budget — return to the proof obligation this turn (advisory; hard obligations already outrank).',
  ]);
});
