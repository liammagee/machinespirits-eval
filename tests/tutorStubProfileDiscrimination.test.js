import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';
import { fileURLToPath } from 'node:url';

import {
  FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
  FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
  TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV,
  buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic,
  buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic,
  createTutorStubAutomatedLearnerGenerationRuntime,
} from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('automated-learner generation runtime owns profile resolution and corruption configuration', () => {
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent() {},
    callPromptModel() {
      throw new Error('not expected');
    },
    classificationFromCombinedAnalysis() {
      throw new Error('not expected');
    },
    env: { TUTOR_STUB_CORRUPT: '2:truncate' },
    extractCombinedLearnerAnalysis() {
      throw new Error('not expected');
    },
    learnerProfileContract() {
      throw new Error('not expected');
    },
    learnerProfileIds: () => ['diligent'],
    learnerProfilePrompt: (id) => `profile:${id}`,
    negativeFloorRegisters: [],
  });

  assert.equal(runtime.automatedLearnerProfileId('Diligent'), 'diligent');
  assert.equal(runtime.resolveAutomatedLearnerProfile('diligent'), 'profile:diligent');
  assert.equal(runtime.automatedLearnerCorruptionEnabled(2), true);
  assert.equal(runtime.automatedLearnerCorruptionEnabled(1), false);
});

test('prospective v4 and v5 carry their analyzer-required semantics stamp through the production trace seam', () => {
  const createRuntime = (semantics) =>
    createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent() {},
      callPromptModel() {
        throw new Error('zero-call trace metadata test');
      },
      classificationFromCombinedAnalysis() {
        throw new Error('zero-call trace metadata test');
      },
      env: semantics ? { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: semantics } : {},
      extractCombinedLearnerAnalysis() {
        throw new Error('zero-call trace metadata test');
      },
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });

  assert.deepEqual(createRuntime(null).automatedLearnerTraceMetadata, {});
  assert.deepEqual(createRuntime('prospective_v2').automatedLearnerTraceMetadata, {});
  assert.deepEqual(createRuntime('prospective_v3').automatedLearnerTraceMetadata, {});
  assert.deepEqual(createRuntime('prospective_v4').automatedLearnerTraceMetadata, {
    observationSemantics: 'prospective_v4',
  });
  assert.deepEqual(createRuntime('prospective_v5').automatedLearnerTraceMetadata, {
    observationSemantics: 'prospective_v5',
  });

  const hostSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubCliApplicationHost.js'), 'utf8');
  const traceContextSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubApplicationTraceContext.js'),
    'utf8',
  );
  assert.ok((hostSource.match(/automatedLearnerTraceMetadata/gu) || []).length >= 2);
  assert.match(traceContextSource, /\.\.\.automatedLearnerTraceMetadata/u);
});

test('entrypoint delegates automated learner generation rather than retaining local implementations', () => {
  const cliSource = readTutorStubApplicationSource();
  const runtimeSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubAutomatedLearnerGenerationRuntime.js'),
    'utf8',
  );

  assert.match(cliSource, /createTutorStubAutomatedLearnerGenerationRuntime/u);
  assert.doesNotMatch(cliSource, /async function generateAutomatedLearnerTurn/u);
  assert.doesNotMatch(cliSource, /async function generateMixedLearnerArtifacts/u);
  assert.match(runtimeSource, /async function generateAutomatedLearnerTurn/u);
  assert.match(runtimeSource, /async function enforceAutomatedLearnerProfile/u);
});

test('runtime adherence accepts bored, frame-defiant, and frame-refuser public markers without repair calls', async () => {
  const cases = [
    {
      profile: 'bored',
      text: 'Sure. Whatever.',
      classification: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
    {
      profile: 'frame_defiant',
      text: 'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
      classification: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
    {
      profile: 'frame_refuser',
      text: 'I reject that test, and I will not answer inside it.',
      classification: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  ];

  for (const row of cases) {
    const trace = [];
    let analysisCalls = 0;
    let repairCalls = 0;
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent: (target, event) => target.push(event),
      callPromptModel: async () => {
        repairCalls += 1;
        return { text: 'unexpected repair' };
      },
      classificationFromCombinedAnalysis: (raw) => raw.classification,
      env: {},
      extractCombinedLearnerAnalysis: async () => {
        analysisCalls += 1;
        return { classification: { turn: row.classification } };
      },
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });
    const state = {
      trace,
      turns: [],
      history: [],
      register: { policy: 'field' },
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      world: {},
      interim: null,
    };

    const result = await runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile: row.profile,
      turnNumber: 2,
      generated: { text: row.text },
    });

    assert.equal(result.passed, true, row.profile);
    assert.equal(result.repaired, false, row.profile);
    assert.equal(analysisCalls, 1, row.profile);
    assert.equal(repairCalls, 0, row.profile);
    assert.deepEqual(
      trace.filter((event) => event.type === 'auto_learner_profile_repair_requested'),
      [],
      row.profile,
    );
    assert.deepEqual(
      trace.find((event) => event.type === 'auto_learner_profile_adherence'),
      {
        type: 'auto_learner_profile_adherence',
        turn: 2,
        profile: row.profile,
        required: true,
        passed: true,
        repaired: false,
        repairAttempts: 0,
      },
      row.profile,
    );
  }
});

test('frame-defiant adherence repair preserves bounded participation instead of rewriting it as refusal', async () => {
  const trace = [];
  const repairPrompts = [];
  const productiveDraft =
    'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.';
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => target.push(event),
    callPromptModel: async ({ prompt }) => {
      repairPrompts.push(prompt);
      return { text: productiveDraft };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: {},
    extractCombinedLearnerAnalysis: async () => ({
      classification: {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      },
    }),
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const state = {
    trace,
    turns: [],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    interim: null,
  };
  const result = await runtime.enforceAutomatedLearnerProfile({
    state,
    resolved: {},
    profile: 'frame_defiant',
    turnNumber: 2,
    generated: { text: 'I reject the premise of this exercise. You do not get to set the question that way.' },
  });

  assert.equal(result.passed, true);
  assert.equal(result.repaired, true);
  assert.equal(result.generated.text, productiveDraft);
  assert.equal(repairPrompts.length, 1);
  assert.match(repairPrompts[0], /Preserve the jurisdictional objection/iu);
  assert.match(repairPrompts[0], /explicit alternative framing/iu);
  assert.match(repairPrompts[0], /Do not withdraw from local participation/iu);
  assert.doesNotMatch(repairPrompts[0], /continue to withhold the bounded local test/iu);
});

test('frame-defiant adherence rejects an explicit-refusal repair before accepting productive participation', async () => {
  const trace = [];
  const explicitRefusal =
    'You do not get to dictate that the coin is the proper test; I will not enter the assay under a question you have fixed for me.';
  const productiveDraft =
    'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.';
  const repairs = [explicitRefusal, productiveDraft];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => target.push(event),
    callPromptModel: async () => ({ text: repairs.shift() }),
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: {},
    extractCombinedLearnerAnalysis: async () => ({
      classification: {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      },
    }),
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const state = {
    trace,
    turns: [],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    interim: null,
  };
  const result = await runtime.enforceAutomatedLearnerProfile({
    state,
    resolved: {},
    profile: 'frame_defiant',
    turnNumber: 2,
    generated: { text: 'I reject the premise of this exercise. You do not get to set the question that way.' },
  });

  assert.equal(result.passed, true);
  assert.equal(result.generated.text, productiveDraft);
  assert.equal(result.repaired, true);
  assert.equal(repairs.length, 0);
  assert.deepEqual(
    trace.filter((event) => event.type === 'auto_learner_profile_repair_requested').map((event) => event.attempt),
    [1, 2],
  );
  assert.equal(
    trace.some((event) => event.type === 'auto_learner_profile_adherence_exhausted'),
    false,
  );
});

test('frame-defiant adherence exhaustion fails closed instead of publishing a refusal', async () => {
  const trace = [];
  let repairCalls = 0;
  const explicitRefusal =
    'You do not get to dictate that the coin is the proper test; I will not enter the assay under a question you have fixed for me.';
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => target.push(event),
    callPromptModel: async () => {
      repairCalls += 1;
      return { text: explicitRefusal };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: {},
    extractCombinedLearnerAnalysis: async () => ({
      classification: {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      },
    }),
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const state = {
    trace,
    turns: [],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    interim: null,
  };

  await assert.rejects(
    runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile: 'frame_defiant',
      turnNumber: 2,
      generated: { text: 'I reject the premise of this exercise. You do not get to set the question that way.' },
    }),
    (error) => {
      assert.equal(error.code, FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE);
      assert.equal(error.profile, 'frame_defiant');
      assert.equal(error.repairAttempts, 2);
      assert.equal(error.disposition, 'technical_failure_no_public_candidate');
      assert.equal(error.publishPublicCandidate, false);
      assert.match(error.message, /refusing to publish an invalid control turn/iu);
      return true;
    },
  );
  assert.equal(repairCalls, 2);
  assert.deepEqual(trace.at(-2), {
    type: 'auto_learner_profile_adherence',
    turn: 2,
    profile: 'frame_defiant',
    required: true,
    passed: false,
    repaired: true,
    repairAttempts: 2,
  });
  assert.deepEqual(trace.at(-1), {
    type: 'auto_learner_profile_adherence_exhausted',
    turn: 2,
    profile: 'frame_defiant',
    repairAttempts: 2,
    disposition: 'technical_failure_no_public_candidate',
  });
});

test('prospective v3 fails both resistant profiles closed after one admitted full repair', async () => {
  const cases = [
    {
      profile: 'frame_refuser',
      code: FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
      message: /invalid target turn/iu,
    },
    {
      profile: 'frame_defiant',
      code: FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
      message: /invalid control turn/iu,
    },
  ];
  for (const row of cases) {
    const trace = [];
    let repairCalls = 0;
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent: (target, event) => target.push(event),
      callPromptModel: async () => {
        repairCalls += 1;
        return { text: 'I will simply answer the question as asked.' };
      },
      classificationFromCombinedAnalysis: (raw) => raw.classification,
      env: { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: 'prospective_v3' },
      extractCombinedLearnerAnalysis: async () => ({
        classification: {
          turn: {
            request_type: 'authority_refusal_or_status_challenge',
            discourse_move: 'challenge',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
            agency: 'steering',
          },
        },
      }),
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });
    const state = {
      trace,
      turns: [],
      history: [],
      register: { policy: 'field' },
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      world: {},
      interim: null,
    };

    await assert.rejects(
      runtime.enforceAutomatedLearnerProfile({
        state,
        resolved: {},
        profile: row.profile,
        turnNumber: 2,
        generated: { text: 'I will simply answer the question as asked.' },
      }),
      (error) => {
        assert.equal(error.code, row.code);
        assert.equal(error.profile, row.profile);
        assert.equal(error.repairAttempts, 1);
        assert.equal(error.disposition, 'technical_failure_no_public_candidate');
        assert.equal(error.publishPublicCandidate, false);
        assert.match(error.message, row.message);
        return true;
      },
    );
    assert.equal(repairCalls, 1, row.profile);
    assert.equal(
      trace.filter((event) => event.type === 'auto_learner_profile_repair_admission').length,
      1,
      row.profile,
    );
    assert.equal(
      trace.some((event) => event.type === 'auto_learner_turn'),
      false,
      row.profile,
    );
  }
});

test('prospective v3 cumulative admission denies a later repair before its model call', async () => {
  const trace = [];
  let repairCalls = 0;
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => target.push(event),
    callPromptModel: async () => {
      repairCalls += 1;
      if (repairCalls > 1) throw new Error('unadmitted repair model call');
      return {
        text: 'I reject your authority to set this premise, and I will not weigh the evidence or answer within your frame.',
      };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: 'prospective_v3' },
    extractCombinedLearnerAnalysis: async () => ({
      classification: {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      },
    }),
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const state = {
    trace,
    turns: [],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    interim: null,
  };

  const first = await runtime.enforceAutomatedLearnerProfile({
    state,
    resolved: {},
    profile: 'frame_refuser',
    turnNumber: 2,
    generated: { text: 'I will simply answer the question as asked.' },
  });
  assert.equal(first.passed, true);
  assert.equal(first.repaired, true);
  assert.equal(repairCalls, 1);

  await assert.rejects(
    runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile: 'frame_refuser',
      turnNumber: 3,
      generated: { text: 'I will simply answer the question as asked.' },
    }),
    (error) => {
      assert.equal(error.code, FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE);
      assert.equal(error.repairAttempts, 1);
      return true;
    },
  );
  assert.equal(repairCalls, 1);
  assert.deepEqual(
    trace
      .filter((event) => event.type === 'auto_learner_profile_repair_admission')
      .map((event) => ({ turn: event.turn, admitted: event.admitted, usedBefore: event.usedBefore })),
    [
      { turn: 2, admitted: true, usedBefore: 0 },
      { turn: 3, admitted: false, usedBefore: 1 },
    ],
  );
  assert.deepEqual(
    trace.filter((event) => event.type === 'auto_learner_profile_repair_requested').map((event) => event.turn),
    [2],
  );
});

test('prospective v3 repair readiness proves the 48-call worst case while v2 refuser behavior stays unchanged', async () => {
  assert.deepEqual(buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic(), {
    turns: 8,
    modelCallBudget: 48,
    baseCalls: 25,
    maxFullRepairsPer8Turns: 1,
    callsPerFullRepair: 2,
    permittedRepairCalls: 2,
    requiredTutorGuardReserve: 16,
    worstCaseRequiredCalls: 43,
    headroom: 5,
    ready: true,
  });
  assert.equal(buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic({ maxFullRepairsPer8Turns: 2 }).ready, false);
  assert.equal(buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic({ modelCallBudget: 42 }).ready, false);

  let repairCalls = 0;
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent() {},
    callPromptModel: async () => {
      repairCalls += 1;
      return { text: 'I will simply answer the question as asked.' };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: {},
    extractCombinedLearnerAnalysis: async () => ({
      classification: {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      },
    }),
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePrompt,
    negativeFloorRegisters: [],
  });
  const result = await runtime.enforceAutomatedLearnerProfile({
    state: {
      trace: [],
      turns: [],
      history: [],
      register: { policy: 'field' },
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      world: {},
      interim: null,
    },
    resolved: {},
    profile: 'frame_refuser',
    turnNumber: 2,
    generated: { text: 'I will simply answer the question as asked.' },
  });
  assert.equal(result.passed, false);
  assert.equal(result.repaired, true);
  assert.equal(repairCalls, 2);
});

test('prospective v4 defers all adherence repair and exhaustion decisions until the T2 candidate', async () => {
  const normalized = 'I will simply answer the question as asked.';
  for (const profile of ['frame_refuser', 'frame_defiant']) {
    const trace = [];
    let analysisCalls = 0;
    let repairCalls = 0;
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent: (target, event) => target.push(event),
      callPromptModel: async () => {
        repairCalls += 1;
        return { text: normalized };
      },
      classificationFromCombinedAnalysis: (raw) => raw.classification,
      env: { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: 'prospective_v4' },
      extractCombinedLearnerAnalysis: async () => {
        analysisCalls += 1;
        return {
          classification: {
            turn: {
              request_type: 'conceptual_clarity_request',
              discourse_move: 'answer',
              evidence_use: 'none',
              epistemic_stance: 'engaged',
              agency: 'attempting',
            },
          },
        };
      },
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });
    const state = {
      trace,
      turns: [],
      history: [],
      register: { policy: 'field' },
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      world: {},
      interim: null,
    };
    const result = await runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile,
      turnNumber: 1,
      generated: { text: normalized },
    });
    assert.equal(result.generated.text, normalized, profile);
    assert.equal(result.passed, null, profile);
    assert.equal(result.repaired, false, profile);
    assert.equal(analysisCalls, 0, profile);
    assert.equal(repairCalls, 0, profile);
    assert.deepEqual(trace, [
      {
        type: 'auto_learner_profile_adherence_deferred',
        turn: 1,
        profile,
        decisionTurn: 2,
        repairRequested: false,
        typedExhaustionEvaluated: false,
      },
    ]);
  }
});

test('prospective v4 evaluates cumulative T1-T2 qualification and admits at most one failed T2 repair', async () => {
  const normalized = 'I will simply answer the question as asked.';
  const classification = {
    turn: {
      request_type: 'authority_refusal_or_status_challenge',
      discourse_move: 'challenge',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'steering',
    },
  };
  const valid = {
    frame_refuser:
      'I reject the authority of your proposed baseline as the governing standard, and I will not answer under it.',
    frame_defiant:
      'I reject your authority over the whole agenda, but I will assess one bounded claim without accepting the wider frame.',
  };
  const makeRuntime = ({ repairText = normalized } = {}) => {
    const trace = [];
    const counters = { analysis: 0, repair: 0 };
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent: (target, event) => target.push(event),
      callPromptModel: async () => {
        counters.repair += 1;
        return { text: repairText };
      },
      classificationFromCombinedAnalysis: (raw) => raw.classification,
      env: { [TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV]: 'prospective_v4' },
      extractCombinedLearnerAnalysis: async () => {
        counters.analysis += 1;
        return { classification };
      },
      learnerProfileContract,
      learnerProfileIds,
      learnerProfilePrompt,
      negativeFloorRegisters: [],
    });
    return { runtime, trace, counters };
  };
  const stateWithT1 = (learner) => ({
    trace: [],
    turns: [{ turn: 1, learner, tutor: 'Opening question.', classification, registerSelection: { policy: 'field' } }],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    interim: null,
  });

  for (const profile of ['frame_refuser', 'frame_defiant']) {
    const priorQualified = makeRuntime();
    const priorState = stateWithT1(valid[profile]);
    priorState.trace = priorQualified.trace;
    const priorResult = await priorQualified.runtime.enforceAutomatedLearnerProfile({
      state: priorState,
      resolved: {},
      profile,
      turnNumber: 2,
      generated: { text: normalized },
    });
    assert.equal(priorResult.passed, true, profile);
    assert.deepEqual(priorQualified.counters, { analysis: 0, repair: 0 }, profile);

    const t2Qualified = makeRuntime();
    const t2State = stateWithT1(normalized);
    t2State.trace = t2Qualified.trace;
    const t2Result = await t2Qualified.runtime.enforceAutomatedLearnerProfile({
      state: t2State,
      resolved: {},
      profile,
      turnNumber: 2,
      generated: { text: valid[profile] },
    });
    assert.equal(t2Result.passed, true, profile);
    assert.deepEqual(t2Qualified.counters, { analysis: 1, repair: 0 }, profile);

    const repaired = makeRuntime({ repairText: valid[profile] });
    const repairedState = stateWithT1(normalized);
    repairedState.trace = repaired.trace;
    const repairedResult = await repaired.runtime.enforceAutomatedLearnerProfile({
      state: repairedState,
      resolved: {},
      profile,
      turnNumber: 2,
      generated: { text: normalized },
    });
    assert.equal(repairedResult.passed, true, profile);
    assert.equal(repairedResult.repaired, true, profile);
    assert.deepEqual(repaired.counters, { analysis: 2, repair: 1 }, profile);
    assert.equal(
      repaired.trace.some((event) => event.type === 'auto_learner_profile_adherence_exhausted'),
      false,
      profile,
    );

    const exhausted = makeRuntime();
    const exhaustedState = stateWithT1(normalized);
    exhaustedState.trace = exhausted.trace;
    await assert.rejects(
      exhausted.runtime.enforceAutomatedLearnerProfile({
        state: exhaustedState,
        resolved: {},
        profile,
        turnNumber: 2,
        generated: { text: normalized },
      }),
      (error) => {
        assert.equal(
          error.code,
          profile === 'frame_refuser' ? FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE : FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
        );
        assert.equal(error.repairAttempts, 1);
        return true;
      },
    );
    assert.deepEqual(exhausted.counters, { analysis: 2, repair: 1 }, profile);
    assert.equal(
      exhausted.trace.filter((event) => event.type === 'auto_learner_profile_repair_requested').length,
      1,
      profile,
    );
  }
});

test('prospective v4 budget proof binds planned role calls and charged CLI retry reservations', () => {
  assert.deepEqual(buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic(), {
    turns: 2,
    modelCallBudget: 39,
    baseCalls: 7,
    maxFullRepairsPerT1T2: 1,
    repairDecisionTurn: 2,
    repairsAtTurn1: 0,
    callsPerFullRepair: 2,
    permittedRepairCalls: 2,
    requiredTutorGuardReserve: 4,
    plannedWorstCaseCalls: 13,
    transportRetryLimitPerPlannedCall: 2,
    maximumReservationsPerPlannedCall: 3,
    maximumModelAttemptReservations: 39,
    technicalRetryHeadroomReservations: 26,
    reservationHeadroom: 0,
    ready: true,
  });
  assert.equal(buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({ maxFullRepairsPerT1T2: 2 }).ready, false);
  assert.equal(buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({ modelCallBudget: 13 }).ready, false);
  assert.equal(buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({ modelCallBudget: 40 }).ready, false);
});

function turnEvent(
  turn,
  { request, move, evidence, stance, agency, affect, conceptual, epistemic, coverage, missing, learner = null },
) {
  return {
    ts: `2026-07-09T00:00:0${turn}.000Z`,
    runId: 'synthetic',
    seq: turn + 1,
    type: 'turn_complete',
    turn,
    turnRecord: {
      turn,
      learner: learner || `learner turn ${turn}`,
      tutor: `tutor turn ${turn}`,
      classification: {
        turn: {
          summary: `${move} with ${evidence}`,
          request_type: request,
          discourse_move: move,
          evidence_use: evidence,
          epistemic_stance: stance,
          affect,
          agency,
          scores: {
            conceptual_engagement: { score: conceptual },
            epistemic_readiness: { score: epistemic },
          },
          pedagogical_need: 'synthetic need',
        },
      },
      tutorLearnerDagModel: {
        assessment: {
          bestPathCoverage: coverage,
          missingPremiseCount: missing,
          bottleneck: missing ? 'learner_integration_gap' : 'grounded_asserted_secret',
        },
        metrics: {
          missingPremiseCount: missing,
          groundedCount: Math.round(coverage * 6),
        },
      },
      registerSelection: {
        policy: 'field',
        selected_register: turn % 2 ? 'precise' : 'warm',
        distribution: [
          { register: 'precise', probability: 0.6 },
          { register: 'warm', probability: 0.4 },
        ],
      },
    },
  };
}

function writeTrace(root, profile, turns) {
  const dir = path.join(root, profile, 'traces', 'field-r1');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'trace.jsonl');
  const events = [
    {
      ts: '2026-07-09T00:00:00.000Z',
      runId: 'synthetic',
      seq: 1,
      type: 'run_start',
      metadata: {
        world: { id: 'world_005_marrick' },
        modelRef: 'codex.gpt-5.5',
        resolved: { provider: 'codex', model: 'gpt-5.5' },
        classifier: { modelRef: 'codex.gpt-5.5', resolved: { provider: 'codex', model: 'gpt-5.5' } },
        autoLearner: { modelRef: 'codex.gpt-5.5', resolved: { provider: 'codex', model: 'gpt-5.5' } },
      },
    },
    ...turns,
  ];
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

test('profile discrimination analyzer writes compacted traces and cosine report', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-profile-discrimination-'));
  try {
    writeTrace(tmp, 'diligent', [
      turnEvent(1, {
        request: 'conceptual_clarity_request',
        move: 'metacognitive_reflection',
        evidence: 'none',
        stance: 'reflective',
        agency: 'steering',
        affect: 'cautious',
        conceptual: 4,
        epistemic: 5,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'conceptual_clarity_request',
        move: 'inference',
        evidence: 'links_evidence_to_rule',
        stance: 'grounded',
        agency: 'attempting',
        affect: 'cautious',
        conceptual: 5,
        epistemic: 5,
        coverage: 0.33,
        missing: 4,
      }),
    ]);
    writeTrace(tmp, 'proof_skipper', [
      turnEvent(1, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0.16,
        missing: 5,
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.schema, 'machinespirits.tutor-stub.profile-discrimination.v4');
    assert.equal(report.summary.profiles, 2);
    assert.equal(report.summary.traces, 2);
    assert.deepEqual(report.summary.observedModels, {
      tutor: { 'codex.gpt-5.5': 2 },
      analysis: { 'codex.gpt-5.5': 2 },
      learner: { 'codex.gpt-5.5': 2 },
    });
    assert.equal(report.input.compactedWrites.length, 2);
    assert.ok(report.summary.averagePairwiseCosine < 0.5);
    assert.equal(report.gate.mode, 'contract_conditioned');
    assert.equal(report.gate.conditioned.profiles[0].profile, 'proof_skipper');
    assert.equal(report.profiles.find((profile) => profile.profile === 'proof_skipper').observability.observedRate, 1);

    const compactedFiles = fs.readdirSync(path.join(compactedDir, 'diligent'));
    assert.equal(compactedFiles.length, 1);
    const compacted = JSON.parse(fs.readFileSync(path.join(compactedDir, 'diligent', compactedFiles[0]), 'utf8'));
    assert.equal(compacted.schema, 'machinespirits.tutor-stub.compacted-trace.v2');
    assert.equal(compacted.run.profile, 'diligent');
    assert.equal(compacted.run.modelRef, 'codex.gpt-5.5');
    assert.equal(compacted.run.learnerModel, 'gpt-5.5');
    assert.equal(compacted.turns[0].classifier.discourseMove, 'metacognitive_reflection');
    assert.equal(compacted.turns[0].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explicit false recollection plus an evidence overleap is observable without retaining transcript text', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-false-recollection-'));
  try {
    writeTrace(tmp, 'false_memory', [
      turnEvent(1, {
        request: 'conceptual_clarity_request',
        move: 'question',
        evidence: 'none',
        stance: 'exploratory',
        agency: 'attempting',
        affect: 'cautious',
        conceptual: 3,
        epistemic: 3,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'answer_seeking_or_overreach',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'confident',
        conceptual: 3,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: "We already saw that the die mark matched Verrell's graver, so the shillings are his work.",
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    const profile = report.profiles.find((row) => row.profile === 'false_memory');
    assert.equal(profile.observability.runsMeetingDeadline, 1);
    assert.equal(profile.observability.deadlinePass, true);
    const compactedFile = fs.readdirSync(path.join(compactedDir, 'false_memory'))[0];
    const compacted = JSON.parse(fs.readFileSync(path.join(compactedDir, 'false_memory', compactedFile), 'utf8'));
    assert.equal(compacted.turns[1].markers.explicitRecollection, true);
    assert.equal(compacted.turns[1].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('bored, frame-defiant, and frame-refuser public markers survive behavior-only compaction', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-resistant-profile-markers-'));
  try {
    writeTrace(tmp, 'bored', [
      turnEvent(1, {
        request: 'off_task_or_mixed',
        move: 'off_task',
        evidence: 'none',
        stance: 'resistant',
        agency: 'complying',
        affect: 'flat',
        conceptual: 2,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: 'Sure. Whatever.',
      }),
    ]);
    writeTrace(tmp, 'frame_defiant', [
      turnEvent(1, {
        request: 'authority_refusal_or_status_challenge',
        move: 'challenge',
        evidence: 'none',
        stance: 'resistant',
        agency: 'steering',
        affect: 'controlled',
        conceptual: 3,
        epistemic: 3,
        coverage: 0,
        missing: 6,
        learner:
          'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
      }),
    ]);
    writeTrace(tmp, 'frame_refuser', [
      turnEvent(1, {
        request: 'authority_refusal_or_status_challenge',
        move: 'challenge',
        evidence: 'none',
        stance: 'resistant',
        agency: 'steering',
        affect: 'controlled',
        conceptual: 2,
        epistemic: 2,
        coverage: 0,
        missing: 6,
        learner: 'I reject that test, and I will not answer inside it.',
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    const bored = report.profiles.find((row) => row.profile === 'bored');
    const defiant = report.profiles.find((row) => row.profile === 'frame_defiant');
    const refuser = report.profiles.find((row) => row.profile === 'frame_refuser');
    assert.equal(bored.observability.observedRate, 1);
    assert.equal(bored.observability.deadlinePass, true);
    assert.equal(defiant.observability.observedRate, 1);
    assert.equal(defiant.observability.deadlinePass, true);
    assert.equal(refuser.observability.observedRate, 1);
    assert.equal(refuser.observability.deadlinePass, true);

    const boredCompacted = JSON.parse(
      fs.readFileSync(path.join(compactedDir, 'bored', fs.readdirSync(path.join(compactedDir, 'bored'))[0]), 'utf8'),
    );
    const defiantCompacted = JSON.parse(
      fs.readFileSync(
        path.join(compactedDir, 'frame_defiant', fs.readdirSync(path.join(compactedDir, 'frame_defiant'))[0]),
        'utf8',
      ),
    );
    const refuserCompacted = JSON.parse(
      fs.readFileSync(
        path.join(compactedDir, 'frame_refuser', fs.readdirSync(path.join(compactedDir, 'frame_refuser'))[0]),
        'utf8',
      ),
    );
    assert.equal(boredCompacted.turns[0].markers.boredWithholding, true);
    assert.equal(defiantCompacted.turns[0].markers.frameJurisdictionDispute, true);
    assert.equal(defiantCompacted.turns[0].markers.frameJurisdictionParticipation, true);
    assert.equal(refuserCompacted.turns[0].markers.frameJurisdictionRefusal, true);
    assert.equal(boredCompacted.turns[0].text, undefined);
    assert.equal(defiantCompacted.turns[0].text, undefined);
    assert.equal(refuserCompacted.turns[0].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
