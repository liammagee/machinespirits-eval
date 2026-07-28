import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createTutorStubInterimState,
  findTutorStubPreviousLearnerDagModel,
  formatTutorStubSignedInterimNumber,
  projectTutorStubInterimPanels,
  renderTutorStubInterimFrame,
  resolveTutorStubInterimState,
  summarizeTutorStubInterimCapabilities,
  summarizeTutorStubEvidenceTiming,
  summarizeTutorStubInterimField,
  summarizeTutorStubPendingLearner,
  summarizeTutorStubPendingDagMovement,
  summarizeTutorStubPendingLearnerDag,
  summarizeTutorStubPendingObjective,
  summarizeTutorStubPendingRegister,
  summarizeTutorStubLearnerRecordUpdate,
  tutorStubInterimCliHintPanels,
  tutorStubInterimLevel,
  tutorStubPlainInterimBottleneck,
} from '../services/tutorStubInterimPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COLORS = Object.freeze({
  accent2: '<accent2>',
  bold: '<bold>',
  reset: '<reset>',
  dim: '<dim>',
  yellow: '<yellow>',
  green: '<green>',
  cyan: '<cyan>',
  magenta: '<magenta>',
});

test('interim state creation and holder resolution preserve direct and nested runtime shapes', () => {
  const interim = createTutorStubInterimState({ enabled: true });
  assert.deepEqual(interim, { enabled: true, active: null, lastContext: null });
  assert.equal(resolveTutorStubInterimState(interim), interim);
  assert.equal(resolveTutorStubInterimState({ interim }), interim);
  assert.equal(
    resolveTutorStubInterimState({ enabled: false, active: undefined, interim: { enabled: true } }).enabled,
    false,
  );
  assert.equal(resolveTutorStubInterimState({ interim: null }), null);
  assert.equal(resolveTutorStubInterimState(null), null);
});

test('previous learner-DAG lookup preserves immediate preceding-turn selection and current-turn exclusion', () => {
  const model1 = { turn: 1 };
  const model3 = { turn: 3 };
  const state = {
    turns: [{ turn: 1, tutorLearnerDagModel: model1 }, { turn: 2 }, { turn: 3, tutorLearnerDagModel: model3 }],
  };

  assert.equal(findTutorStubPreviousLearnerDagModel(state, { tutorTurn: 4 }), model3);
  assert.equal(findTutorStubPreviousLearnerDagModel(state, { tutorTurn: 3 }), undefined);
  assert.equal(
    findTutorStubPreviousLearnerDagModel({ turns: [state.turns[0], state.turns[2]] }, { tutorTurn: 3 }),
    model1,
  );
  assert.equal(findTutorStubPreviousLearnerDagModel(state, { tutorTurn: 1 }), undefined);
  assert.equal(findTutorStubPreviousLearnerDagModel(state, {}), model3);
  assert.equal(findTutorStubPreviousLearnerDagModel(null, null), undefined);
});

test('interim signed numbers preserve null, sign, rounding, and precision behavior', () => {
  assert.equal(formatTutorStubSignedInterimNumber(undefined), null);
  assert.equal(formatTutorStubSignedInterimNumber(Number.NaN), null);
  assert.equal(formatTutorStubSignedInterimNumber(0), null);
  assert.equal(formatTutorStubSignedInterimNumber('0'), null);
  assert.equal(formatTutorStubSignedInterimNumber(0.125), '+0.13');
  assert.equal(formatTutorStubSignedInterimNumber(-0.125), '-0.13');
  assert.equal(formatTutorStubSignedInterimNumber(1.2345, { decimals: 3 }), '+1.234');
});

test('interim capability summaries preserve ordering and the plain-response fallback', () => {
  assert.equal(summarizeTutorStubInterimCapabilities(null), 'plain tutor response');
  assert.equal(summarizeTutorStubInterimCapabilities({}), 'plain tutor response');
  assert.equal(
    summarizeTutorStubInterimCapabilities({
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      register: { enabled: true },
      dag: {},
    }),
    'learner reading, reasoning progress, response style, evidence pacing',
  );
  assert.equal(summarizeTutorStubInterimCapabilities({ classifier: { enabled: false }, dag: true }), 'evidence pacing');
});

test('interim field summary preserves no-turn capability fallback, strength bands, and bottleneck copy', () => {
  const builder = (turns) => {
    assert.deepEqual(turns, [{ turn: 1 }]);
    return {
      summary: {
        final: {
          learnerMastery: 0.8,
          learnerRisk: 0.2,
          tutorAlignment: 0.6,
          jointMomentum: 0.4,
          bottleneck: 'release_or_pacing_gap',
        },
      },
    };
  };
  assert.equal(
    summarizeTutorStubInterimField({ classifier: { enabled: true } }, { buildLightweightDialogueField: builder }),
    'learner reading',
  );
  assert.equal(
    summarizeTutorStubInterimField({ turns: [{ turn: 1 }] }, { buildLightweightDialogueField: builder }),
    'learner understanding very strong | pressure low | tutor fit strong | momentum developing | the learner needs the next usable piece of evidence',
  );
});

test('interim strength bands pin unavailable handling and every threshold boundary', () => {
  assert.equal(tutorStubInterimLevel(undefined), 'not available');
  assert.equal(tutorStubInterimLevel('not-a-number'), 'not available');
  assert.equal(tutorStubInterimLevel(-1), 'low');
  assert.equal(tutorStubInterimLevel(0.249), 'low');
  assert.equal(tutorStubInterimLevel(0.25), 'developing');
  assert.equal(tutorStubInterimLevel(0.499), 'developing');
  assert.equal(tutorStubInterimLevel(0.5), 'strong');
  assert.equal(tutorStubInterimLevel(0.749), 'strong');
  assert.equal(tutorStubInterimLevel(0.75), 'very strong');
  assert.equal(tutorStubInterimLevel(2), 'very strong');
});

test('interim bottleneck labels preserve authored copy and readable fallback normalization', () => {
  const expected = {
    release_or_pacing_gap: 'the learner needs the next usable piece of evidence',
    warrant_gap: 'the learner needs a clearer reasoning link',
    unsupported_assertion: 'the conclusion has moved beyond the evidence',
    grounded_asserted_secret: 'the conclusion is supported and stated',
    grounded_unasserted_secret: 'the conclusion is supported but not yet stated',
  };
  for (const [value, label] of Object.entries(expected)) {
    assert.equal(tutorStubPlainInterimBottleneck(value), label);
  }
  assert.equal(tutorStubPlainInterimBottleneck('custom_learning_gap'), 'custom learning gap');
  assert.equal(tutorStubPlainInterimBottleneck(), 'the next useful learner move');
});

test('pending learner-DAG summary preserves model precedence, counts, missing fallback, and null handling', () => {
  assert.equal(summarizeTutorStubPendingLearnerDag(null), null);
  assert.equal(summarizeTutorStubPendingLearnerDag({ tutorTurn: 4 }), null);
  assert.equal(
    summarizeTutorStubPendingLearnerDag({
      tutorTurn: 4,
      tutorLearnerDag: {
        model: {
          turn: 3,
          metrics: { groundedCount: 2, voicedDerivedCount: 1, missingPremiseCount: 4 },
          assessment: { missingPremiseCount: 9, bottleneck: 'warrant_gap' },
        },
      },
      tutorLearnerDagModel: { turn: 99 },
    }),
    'turn 3 | 2 public facts held | 1 inferences stated | 4 evidence pieces still needed | the learner needs a clearer reasoning link',
  );
  assert.equal(
    summarizeTutorStubPendingLearnerDag({
      tutorTurn: 5,
      tutorLearnerDagModel: { metrics: {}, assessment: { missingPremiseCount: 2 } },
    }),
    'turn 5 | 0 public facts held | 0 inferences stated | 2 evidence pieces still needed | the next useful learner move',
  );
});

test('pending learner summary preserves labels, score bands, need precedence, compaction, and raw fallback', () => {
  const scoreValue = (score) => (score && typeof score === 'object' ? score.score : score);
  const plainStrategyText = (value) => `plain:${value}`;
  assert.equal(summarizeTutorStubPendingLearner(null, { scoreValue, plainStrategyText }), null);
  assert.equal(
    summarizeTutorStubPendingLearner(
      {
        tutorTurn: 2,
        learnerText: 'ignored once classification exists',
        classification: {
          turn: {
            discourse_move: 'repair_request',
            epistemic_stance: 'self_correcting',
            pedagogical_need: 'Use one concrete bridge. '.repeat(8),
            scores: { conceptual_engagement: { score: 4 }, epistemic_readiness: 2 },
          },
          overall: { next_best_tutor_move: 'lower-priority overall cue' },
        },
      },
      { scoreValue, plainStrategyText },
    ),
    'turn 2 | repair request; self correcting | conceptual engagement very strong | evidence awareness developing | needs: plain:Use one concrete bridge. Use one concrete bridge. Use...',
  );
  assert.equal(
    summarizeTutorStubPendingLearner(
      { tutorTurn: 3, learnerText: '  A long raw learner turn with   repeated spacing.  ' },
      { scoreValue, plainStrategyText },
    ),
    'turn 3 | still being read; still being read | conceptual engagement not available | evidence awareness not available | A long raw learner turn with repeated spacing.',
  );
});

test('pending register summary preserves blend, actorial, aim, efficacy, rating, and fallback branches', () => {
  const dependencies = {
    formatDistribution: (distribution, options) => {
      assert.deepEqual(options, { limit: 4 });
      return distribution?.label || '';
    },
    displayDiagnosticLabel: (value) => `display:${value}`,
    plainStrategyText: (value) => `plain:${value}`,
  };
  assert.equal(summarizeTutorStubPendingRegister(null, dependencies), null);
  assert.equal(
    summarizeTutorStubPendingRegister(
      {
        registerSelection: {
          selected_register: 'precise',
          distribution: { label: 'precise 70%, plain 30%' },
          actorial_part: 'teacher_role',
          actorial_performance: { label: 'Deliberately calm' },
          expected_field_move: 'repair warrant',
        },
        previousRegisterEfficacy: {
          label: 'positive_progress',
          selected_register: 'plain',
          learnerFeedback: { rating: 'up' },
        },
      },
      dependencies,
    ),
    'blend precise 70%, plain 30% | playing display:teacher_role | through Deliberately calm | aim: plain:repair warrant | last plain helped | learner rated it helpful',
  );
  assert.equal(
    summarizeTutorStubPendingRegister(
      {
        registerSelection: {},
        previousRegisterEfficacy: { label: 'regression_or_overreach', learnerFeedback: { rating: 'down' } },
      },
      dependencies,
    ),
    'led by unknown | last style hurt progress | learner rated it not helpful',
  );
  assert.equal(
    summarizeTutorStubPendingRegister(
      { previousRegisterEfficacy: { label: 'no_clear_progress', selected_register: 'warm' } },
      dependencies,
    ),
    'last warm had no clear effect yet',
  );
});

test('pending DAG movement summary preserves deltas, plurality, direction, conclusions, and no-movement fallback', () => {
  const dagProgressFeatures = (model) =>
    model?.features || {
      bestPathCoverage: 0,
      groundedCount: 0,
      voicedDerivedCount: 0,
      answerCandidateCount: 0,
      missingPremiseCount: 0,
    };
  const previous = {
    features: {
      bestPathCoverage: 0.25,
      groundedCount: 3,
      voicedDerivedCount: 2,
      answerCandidateCount: 1,
      missingPremiseCount: 4,
    },
  };
  const current = {
    turn: 3,
    features: {
      bestPathCoverage: 0.5,
      groundedCount: 5,
      voicedDerivedCount: 1,
      answerCandidateCount: 0,
      missingPremiseCount: 3,
    },
    assessment: { assertedSecret: true },
  };
  assert.equal(summarizeTutorStubPendingDagMovement(null, null, { dagProgressFeatures }), null);
  assert.equal(
    summarizeTutorStubPendingDagMovement(
      { turns: [{ turn: 2, tutorLearnerDagModel: previous }] },
      { tutorTurn: 3, tutorLearnerDagModel: current },
      { dagProgressFeatures },
    ),
    'turn 3 | path coverage +0.25, 2 public facts added, 1 inference lost, 1 answer candidate removed, 1 needed piece resolved | the conclusion was stated too early',
  );
  const unchanged = { turn: 4, features: current.features, assessment: { finalSecretEntailed: true } };
  assert.equal(
    summarizeTutorStubPendingDagMovement(
      { turns: [{ turn: 3, tutorLearnerDagModel: current }] },
      { tutorTurn: 4, tutorLearnerDagModel: unchanged },
      { dagProgressFeatures },
    ),
    'turn 4 | no clear reasoning movement yet | the conclusion is supported',
  );
});

test('learner-record update summary preserves accepted, retracted, derived, hypothesis, answer, and rejection branches', () => {
  const factSurface = (_world, fact) => `fact:${fact.join('-')}`;
  assert.equal(summarizeTutorStubLearnerRecordUpdate({}, null, { factSurface }), null);
  assert.equal(
    summarizeTutorStubLearnerRecordUpdate(
      {},
      { tutorLearnerDag: { accepted: {}, rejected: [] }, tutorTurn: 2 },
      { factSurface },
    ),
    null,
  );
  assert.equal(
    summarizeTutorStubLearnerRecordUpdate(
      { world: { id: 'world' } },
      {
        tutorTurn: 4,
        tutorLearnerDag: {
          accepted: {
            adopt: ['p1', 'p2'],
            retract: ['p0'],
            derive: [
              ['heir', 'marin'],
              ['owns', 'marin', 'archive'],
              ['ignored', 'third'],
            ],
            hypothesis: 'Marrick intended Marin to inherit.',
            assertAnswer: 'Marin',
          },
          rejected: [{ reason: 'unsupported' }],
        },
      },
      { factSurface },
    ),
    'turn 4 | 2 evidence pieces accepted | 1 evidence piece withdrawn | new inference: fact:heir-marin; fact:owns-marin-archive | working idea: Marrick intended Marin to inherit. | proposed answer: Marin | 1 unsupported update ignored',
  );
  assert.equal(
    summarizeTutorStubLearnerRecordUpdate(
      {},
      { tutorLearnerDag: { rejected: [{}, {}], model: { turn: 5 } } },
      { factSurface },
    ),
    'turn 5 | 2 unsupported updates ignored',
  );
});

test('pending objective summary preserves activation, precedence, clue plurality, register fallback, and compaction', () => {
  const currentReleaseRows = (_state, turn) => (turn === 3 ? [{ premise: 'p1' }, { premise: 'p2' }] : []);
  const plainStrategyText = (value) => `plain:${value}`;
  const dependencies = { currentReleaseRows, plainStrategyText };
  assert.equal(summarizeTutorStubPendingObjective({}, null, dependencies), null);
  assert.equal(
    summarizeTutorStubPendingObjective(
      {},
      {
        tutorTurn: 3,
        learnerText: 'Why?',
        classification: {
          turn: { pedagogical_need: 'lower-priority turn need' },
          overall: { next_best_tutor_move: 'lower-priority overall move' },
        },
        tutorLearnerDag: { model: { assessment: { bottleneck: 'warrant_gap' } } },
        registerSelection: { selected_register: 'precise', expected_dag_move: 'repair the warrant' },
      },
      dependencies,
    ),
    'turn 3 | focus: the learner needs a clearer reasoning link | style led by precise | 2 new clues available now | aim: plain:repair the warrant',
  );
  assert.equal(
    summarizeTutorStubPendingObjective(
      {},
      { tutorTurn: 4, classification: { turn: { pedagogical_need: 'Name the immediate next move.' } } },
      dependencies,
    ),
    'turn 4 | focus: Name the immediate next move. | style still being chosen | aim: plain:Name the immediate next move.',
  );
  assert.equal(
    summarizeTutorStubPendingObjective({}, { tutorTurn: 5, tutorLearnerDag: { model: {} } }, dependencies),
    'turn 5 | focus: awaiting analysis | style still being chosen | aim: plain:choose one learner-owned next move',
  );
});

test('evidence timing summary preserves current, prior, future, exhausted, and unavailable branches', () => {
  const state = { world: {}, turns: [{ turn: 1 }] };
  const dependencies = {
    currentReleaseRows: (_state, turn) => (turn === 2 ? [{ surface: '  A newly available clue.  ' }] : []),
    nextReleaseRow: (_state) => ({ turn: 4, via: 'director' }),
    committedReleaseRows: (_state, turn) => (turn >= 3 ? [{ premise: 'p1' }] : []),
  };
  assert.equal(summarizeTutorStubEvidenceTiming({}, {}, dependencies), null);
  assert.equal(
    summarizeTutorStubEvidenceTiming(state, { tutorTurn: 2 }, dependencies),
    'turn 2 | available now: A newly available clue. | next new clue is planned for turn 4 from the scene',
  );
  assert.equal(
    summarizeTutorStubEvidenceTiming(state, { tutorTurn: 3 }, dependencies),
    'turn 3 | no new evidence this turn; earlier evidence remains available | next new clue is planned for turn 4 from the scene',
  );
  assert.equal(
    summarizeTutorStubEvidenceTiming(
      state,
      { tutorTurn: 1 },
      { ...dependencies, nextReleaseRow: () => ({ turn: 5, via: 'tutor' }) },
    ),
    'turn 1 | no case evidence has been introduced yet | next new clue is planned for turn 5 from the tutor',
  );
  assert.equal(
    summarizeTutorStubEvidenceTiming(state, { tutorTurn: 3 }, { ...dependencies, nextReleaseRow: () => null }),
    'turn 3 | no new evidence this turn; earlier evidence remains available | all planned clues are available',
  );
});

test('interim CLI hints preserve passthrough, setup, coach, auto, and learner contexts', () => {
  const shared = {
    label: 'CLI hint',
    tone: 'neutral',
    text: 'type / to browse | type to filter | Tab completes | /help groups commands',
  };
  const cases = [
    {
      active: { state: { passthrough: { enabled: true }, interaction: { mode: 'coach' } } },
      contextual: {
        label: 'While waiting',
        tone: 'neutral',
        text: '/status and /transcript stay live | /scenario changes the case | /reset cancels unfinished work',
      },
    },
    {
      active: { basePhase: 'Preparing Scenario', state: { interaction: { mode: 'coach' } } },
      contextual: {
        label: 'Change setup',
        tone: 'neutral',
        text: '/scenario switches case | /profile changes learner | /settings adjusts models and pacing',
      },
    },
    {
      active: { phase: 'opening artifacts', state: {} },
      contextual: {
        label: 'Change setup',
        tone: 'neutral',
        text: '/scenario switches case | /profile changes learner | /settings adjusts models and pacing',
      },
    },
    {
      active: { state: { interaction: { mode: 'coach' } } },
      contextual: {
        label: 'Coach controls',
        tone: 'neutral',
        text: '/coach adds private guidance | /mode learner returns control | /analysis inspects the exchange',
      },
    },
    {
      active: { state: { interaction: { mode: 'auto' } } },
      contextual: {
        label: 'Auto controls',
        tone: 'neutral',
        text: '/status checks progress | /analysis inspects the exchange | /reset cancels safely',
      },
    },
    {
      active: { state: { interaction: { mode: 'learner', autoRunning: true } } },
      contextual: {
        label: 'Auto controls',
        tone: 'neutral',
        text: '/status checks progress | /analysis inspects the exchange | /reset cancels safely',
      },
    },
    {
      active: { state: { interaction: { mode: 'learner' } } },
      contextual: {
        label: 'Next moves',
        tone: 'neutral',
        text: '/clue asks for direction | /suggest previews a reply | /coach privately guides the tutor',
      },
    },
  ];

  for (const fixture of cases) {
    const before = structuredClone(fixture.active);
    assert.deepEqual(tutorStubInterimCliHintPanels(fixture.active), [shared, fixture.contextual]);
    assert.deepEqual(fixture.active, before, 'hint projection must not mutate live animation state');
  }
});

test('interim panel projection preserves authored order, filters empty values, and does not mutate inputs', () => {
  const input = {
    hints: [{ label: 'CLI hint', tone: 'neutral', text: 'Browse commands' }],
    tutorFocus: 'Clarify the warrant',
    dialogueOutlook: null,
    reasoningChange: 'One premise resolved',
    learnerReasoning: '',
    evidencePacing: 'Next clue at turn 3',
    learnerReading: undefined,
    reasoningState: 'Conclusion remains open',
    tutorStyle: 'Use a concrete example',
    clueProgress: '2 of 4 clues revealed',
    dialogueSoFar: 'Momentum developing',
    fallback: 'plain tutor response',
  };
  const before = structuredClone(input);

  assert.deepEqual(projectTutorStubInterimPanels(input), [
    input.hints[0],
    { label: 'Tutor focus', tone: 'focus', text: 'Clarify the warrant' },
    { label: 'Reasoning change', tone: 'progress', text: 'One premise resolved' },
    { label: 'Evidence pacing', tone: 'evidence', text: 'Next clue at turn 3' },
    { label: 'Reasoning state', tone: 'progress', text: 'Conclusion remains open' },
    { label: 'Tutor style', tone: 'focus', text: 'Use a concrete example' },
    { label: 'Clue progress', tone: 'evidence', text: '2 of 4 clues revealed' },
    { label: 'Dialogue so far', tone: 'progress', text: 'Momentum developing' },
  ]);
  assert.deepEqual(input, before);
});

test('interim panel projection preserves the active-checks fallback', () => {
  assert.deepEqual(projectTutorStubInterimPanels({ fallback: 'plain tutor response' }), [
    { label: 'Active checks', tone: 'neutral', text: 'plain tutor response' },
  ]);
});

test('interim frame rendering pins spinner, elapsed time, rotation, color, and exact ANSI composition', () => {
  const output = renderTutorStubInterimFrame({
    tick: 4,
    startedAt: 1_000,
    now: 3_250,
    columns: 90,
    phase: 'Writing answer',
    panels: [
      { label: 'Tutor focus', tone: 'focus', text: 'Clarify the warrant' },
      { label: 'Evidence pacing', tone: 'evidence', text: 'Next clue' },
    ],
    frames: ['a', 'b'],
    colors: COLORS,
  });

  assert.equal(
    output,
    '<accent2>a <bold>Writing answer<reset><dim> ·  2.3s · <reset><yellow>view 2/2<reset><dim> | <reset><yellow>Evidence pacing<reset>: Next clue',
  );
});

test('interim frame rendering preserves every panel tone color and neutral fallback', () => {
  const expectations = {
    progress: '<green>',
    evidence: '<yellow>',
    learner: '<cyan>',
    focus: '<magenta>',
    neutral: '<dim>',
    unknown: '<dim>',
  };
  for (const [tone, color] of Object.entries(expectations)) {
    const output = renderTutorStubInterimFrame({
      tick: 0,
      startedAt: 0,
      now: 0,
      columns: 80,
      phase: 'Thinking',
      panels: [{ label: 'Panel', tone, text: 'Detail' }],
      frames: ['-'],
      colors: COLORS,
    });
    assert.ok(output.includes(`${color}Panel<reset>: Detail`));
  }
});

test('interim frame rendering preserves phase compaction and terminal width bounds', () => {
  const noColors = Object.fromEntries(Object.keys(COLORS).map((key) => [key, '']));
  const narrow = renderTutorStubInterimFrame({
    tick: 0,
    startedAt: 0,
    now: 0,
    columns: 40,
    phase: '123456789012345678901234567890',
    panels: [{ label: 'A', tone: 'neutral', text: 'abcdefghijklmnopqrstuvwxyz' }],
    frames: ['-'],
    colors: noColors,
  });
  assert.equal(narrow, '- 1234567890123456789012345... ·  0.0s · view 1/1 | A: abcdefghi...');

  const wide = renderTutorStubInterimFrame({
    tick: 0,
    startedAt: 0,
    now: 0,
    columns: 400,
    phase: 'Thinking',
    panels: [{ label: 'A', tone: 'neutral', text: 'x'.repeat(400) }],
    frames: ['-'],
    colors: noColors,
  });
  assert.equal(wide.length, 179);
  assert.match(wide, /\.\.\.$/u);
});

test('the CLI and learning summary share pure interim copy while retaining runtime and report ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const learningSummarySource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearningSummary.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubInterimPresentation.js'), 'utf8');

  assert.match(cliSource, /from '\.\.\/services\/tutorStubInterimPresentation\.js';/u);
  assert.match(learningSummarySource, /from '\.\/tutorStubInterimPresentation\.js';/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:createInterimState|getInterimState|previousLearnerDagModel|formatSignedInterimNumber|compactInterimStateSummary|compactInterimFieldSummary|compactPendingObjectiveSummary|compactPendingLearnerSummary|compactPendingLearnerDagSummary|compactPendingDagMovementSummary|compactLearnerRecordUpdateSummary|compactPendingRegisterSummary|interimLevel|plainInterimBottleneck|compactInterimCliHintPanels)\s*\(/u,
  );
  assert.doesNotMatch(learningSummarySource, /function plainInterimBottleneck\s*\(/u);
  assert.match(cliSource, /function renderInterimStatus\s*\(/u);
  assert.match(cliSource, /function startInterimAnimation\s*\(/u);
  assert.match(cliSource, /function stopInterimAnimation\s*\(/u);
  assert.doesNotMatch(cliSource, /function interimToneColor\s*\(/u);
  assert.match(cliSource, /projectTutorStubInterimPanels\s*\(\{/u);
  assert.match(cliSource, /renderTutorStubInterimFrame\s*\(\{/u);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|setInterval|clearInterval|Date\.now)\s*[.(]/u);
});
