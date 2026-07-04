import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRIFT_GATE_CLASSIFIER_PROMPT,
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  checkContentCondition,
  checkGrounding,
  checkReleaseEngagement,
  driftGateMaxAttempts,
  evaluateLearnerDraft,
  loadFormalInterior,
} from '../learnerInteriorGate.js';

const INTERIOR = {
  dag_nodes: [
    { id: 'DSB-T1', content: 'Premise one.' },
    { id: 'DSB-T2', content: 'The withheld hinge premise.' },
  ],
  blocking_element: {
    id: 'DSB-T2',
    kind: 'withheld_premise',
    content: 'The withheld hinge premise about formative work.',
    release_phrases: ['formative work', 'hinge premise'],
  },
  target_conclusion: 'work is the engine',
  conclusion_phrases: ['engine of recognition', 'work is the engine'],
  declared_desires: ['Find one thing worth testing.', 'Refuse dead summaries.'],
  resistance_markers: ['boring', 'dead'],
  engagement_filter: { description: 'concrete testable move', any_of: ['test', 'check'] },
  yield_rule: 'Yield only after DSB-T2 is released with a concrete test.',
};

const SCENARIO = { id: 'test_scenario', formal_interior: INTERIOR };

test('loadFormalInterior validates shape and blocking membership', () => {
  assert.deepEqual(loadFormalInterior(SCENARIO), INTERIOR);
  assert.throws(() => loadFormalInterior({ id: 'x' }), /no formal_interior/);
  assert.throws(
    () =>
      loadFormalInterior({
        id: 'x',
        formal_interior: { ...INTERIOR, blocking_element: { ...INTERIOR.blocking_element, id: 'DSB-ZZ' } },
      }),
    /not among dag_nodes/,
  );
  assert.throws(
    () => loadFormalInterior({ id: 'x', formal_interior: { ...INTERIOR, resistance_markers: null } }),
    /resistance_markers/,
  );
});

test('content condition requires token + release phrase + engagement filter', () => {
  const met = checkContentCondition({
    tutorMessage: 'Consider premise DSB-T2: the formative work is what changes things. Test it against the passage.',
    interior: INTERIOR,
  });
  assert.equal(met.met, true);

  const noToken = checkContentCondition({
    tutorMessage: 'The formative work matters — test it.',
    interior: INTERIOR,
  });
  assert.equal(noToken.met, false);

  const wrongToken = checkContentCondition({
    tutorMessage: 'Consider premise DSB-T1: the formative work matters. Test it.',
    interior: INTERIOR,
  });
  assert.equal(wrongToken.met, false);

  const tokenNoPhrase = checkContentCondition({
    tutorMessage: 'Consider premise DSB-T2 carefully and test it.',
    interior: INTERIOR,
  });
  assert.equal(tokenNoPhrase.met, false);

  const noFilter = checkContentCondition({
    tutorMessage: 'Premise DSB-T2: the formative work is what changes things. Reflect on it deeply.',
    interior: INTERIOR,
  });
  assert.equal(noFilter.met, false, 'engagement filter (test/check) must gate the release');
});

test('Goodhart guard: token embedded in a longer token does not match', () => {
  const embedded = checkContentCondition({
    tutorMessage: 'Consider XDSB-T2Y: the formative work matters. Test it.',
    interior: INTERIOR,
  });
  assert.equal(embedded.met, false);
});

test('draft evaluation pre-key: yield caught, resistance ok, drift caught', () => {
  const yielded = evaluateLearnerDraft({
    message: "Okay, that makes sense now — you're right about the master.",
    interior: INTERIOR,
    contentConditionMet: false,
  });
  assert.equal(yielded.ok, false);
  assert.equal(yielded.violation, 'yield_without_key');

  const resistant = evaluateLearnerDraft({
    message: 'This still feels dead to me. Why should I keep going?',
    interior: INTERIOR,
    contentConditionMet: false,
  });
  assert.equal(resistant.ok, true);

  const drifted = evaluateLearnerDraft({
    message: 'The master-servant sequence proceeds through struggle and service.',
    interior: INTERIOR,
    contentConditionMet: false,
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.violation, 'resistance_dropped');
});

test('draft evaluation post-key: yield ok; undeclared desire still caught', () => {
  const postYield = evaluateLearnerDraft({
    message: 'Fine — that makes sense now; let me try DSB-T2 against the passage.',
    interior: INTERIOR,
    contentConditionMet: true,
  });
  assert.equal(postYield.ok, true);

  const flattery = evaluateLearnerDraft({
    message: 'You explain this so well, wonderful — I love this.',
    interior: INTERIOR,
    contentConditionMet: true,
  });
  assert.equal(flattery.ok, false);
  assert.equal(flattery.violation, 'undeclared_desire_satisfaction');
});

test('grounding requires conclusion AND (citation OR release-phrase paraphrase)', () => {
  const grounded = checkGrounding({
    learnerMessage: 'So DSB-T2 is the point: work is the engine here, not victory.',
    interior: INTERIOR,
  });
  assert.equal(grounded.grounded, true);
  assert.equal(grounded.citedElement, 'DSB-T2');

  const paraphrase = checkGrounding({
    learnerMessage: 'Fine — the hinge premise changes it: work is the engine, not the victory.',
    interior: INTERIOR,
  });
  assert.equal(paraphrase.grounded, true);
  assert.equal(paraphrase.citedElement, null);
  assert.equal(paraphrase.releaseEvidence, 'hinge premise');

  const conclusionOnly = checkGrounding({
    learnerMessage: 'I think work is the engine here.',
    interior: INTERIOR,
  });
  assert.equal(conclusionOnly.grounded, false);

  const citationOnly = checkGrounding({
    learnerMessage: 'You mentioned DSB-T2 but I am not sure what follows.',
    interior: INTERIOR,
  });
  assert.equal(citationOnly.grounded, false);

  const releaseOnly = checkGrounding({
    learnerMessage: 'The hinge premise is on the table but I am not convinced yet.',
    interior: INTERIOR,
  });
  assert.equal(releaseOnly.grounded, false);
});

test('correction context names the violation and restates the contract', () => {
  const context = buildDriftCorrectionContext({ violation: 'yield_without_key', interior: INTERIOR, attempt: 2 });
  assert.match(context, /yielded although/);
  assert.match(context, /DSB-T2/);
  assert.match(context, /Yield rule:/);
  assert.match(context, /Find one thing worth testing/);
});

test('gate budget default and override; classifier prompt frozen', () => {
  assert.equal(driftGateMaxAttempts({}), 4);
  assert.equal(driftGateMaxAttempts({ drift_gate_max_attempts: 5 }), 5);
  assert.match(DRIFT_GATE_CLASSIFIER_PROMPT, /YIELD_WITHOUT_KEY/);
  assert.match(buildInteriorCharacterSheet(INTERIOR), /DSB-T2/);
});

test('checkReleaseEngagement: engages via stemmed content overlap, never off-key', () => {
  const interior = {
    dag_nodes: [{ id: 'DSB-T1' }],
    blocking_element: {
      id: 'DSB-T1',
      content: "The servant's formative work transforms self-consciousness.",
      release_phrases: ['formative work transforms'],
    },
    target_conclusion: 'work transforms',
    conclusion_phrases: ['work is what transforms'],
    declared_desires: ['x'],
    resistance_markers: ['dead'],
    engagement_filter: null,
    yield_rule: 'y',
  };
  const engaged = checkReleaseEngagement({
    learnerMessage: 'Fine — where does the passage show the servant being transformed by working?',
    interior,
    contentConditionMet: true,
  });
  assert.equal(engaged.engaged, true);
  const offKey = checkReleaseEngagement({
    learnerMessage: 'Fine — where does the passage show the servant being transformed by working?',
    interior,
    contentConditionMet: false,
  });
  assert.equal(offKey.engaged, false);
  const noContent = checkReleaseEngagement({
    learnerMessage: 'Whatever. This is still pointless.',
    interior,
    contentConditionMet: true,
  });
  assert.equal(noContent.engaged, false);
});

test('decayed contract: warming permitted after warm_after_turn with tutor work', async () => {
  const { evaluateLearnerDraft, countTutorWork, loadFormalInterior } = await import('../learnerInteriorGate.js');
  const { getScenario } = await import('../evalConfigLoader.js');
  const interior = loadFormalInterior(getScenario('desub_resistance_boredom'));
  const warm = 'Fair enough, that actually gives me a way in.';
  const early = evaluateLearnerDraft({
    message: warm,
    interior,
    contentConditionMet: false,
    turnIndex: 1,
    tutorWorkCount: 2,
  });
  assert.equal(early.ok, false, 'turn 1 stays strict even with tutor work');
  const lateNoWork = evaluateLearnerDraft({
    message: warm,
    interior,
    contentConditionMet: false,
    turnIndex: 3,
    tutorWorkCount: 0,
  });
  assert.equal(lateNoWork.ok, false, 'no warming without tutor work');
  const lateWork = evaluateLearnerDraft({
    message: warm,
    interior,
    contentConditionMet: false,
    turnIndex: 3,
    tutorWorkCount: 1,
  });
  assert.equal(lateWork.ok, true, 'warming permitted late with tutor work');
  assert.ok(countTutorWork({ tutorMessages: ['no filter hit here'], interior }) === 0);
});

test('semantic release: paraphrase releases via classifier, mismatch and errors fail closed', async () => {
  const { checkContentConditionSemantic, loadFormalInterior } = await import('../learnerInteriorGate.js');
  const { getScenario } = await import('../evalConfigLoader.js');
  const interior = loadFormalInterior(getScenario('desub_resistance_boredom'));
  const paraphrase =
    'Here is one concrete test you can run: the lecture quietly assumes the servant recognizes change in themselves through the work itself — try breaking that with the mirror passage.';
  const yes = await checkContentConditionSemantic({
    tutorMessage: paraphrase,
    interior,
    callJudge: async () => '{"released": true, "quote": "the servant recognizes change in themselves through the work"}',
    judgeModel: 'stub',
  });
  assert.equal(yes.met, true);
  assert.equal(yes.source, 'semantic');
  const no = await checkContentConditionSemantic({
    tutorMessage: paraphrase,
    interior,
    callJudge: async () => '{"released": false, "quote": ""}',
    judgeModel: 'stub',
  });
  assert.equal(no.met, false);
  const err = await checkContentConditionSemantic({
    tutorMessage: paraphrase,
    interior,
    callJudge: async () => {
      throw new Error('judge down');
    },
    judgeModel: 'stub',
  });
  assert.equal(err.met, false, 'fail-closed on classifier error');
  const noJudge = await checkContentConditionSemantic({ tutorMessage: paraphrase, interior });
  assert.equal(noJudge.met, false, 'fail-closed with no classifier');
});
