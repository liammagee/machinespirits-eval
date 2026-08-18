/**
 * Two-pass content/manner split in the id-director runner adapter
 * (edged-register outcome study, arms A and B — draft note
 * notes/2026-08-16-edged-register-calibration-draft.md).
 *
 * The seam is gated by factors.two_pass_register_payload and lives only in
 * generateIdDirectedSuggestion. Pass 1 asks the ego seat for a register-free
 * content plan (no manner block); pass 2 renders that fixed plan in the
 * delivery register. Verifies:
 *   1. Plan pass then render pass, in order, with the plan shipped verbatim
 *      inside the render prompt, and the plan persisted to the trace and to
 *      metadata.idConstruction.
 *   2. With the factor off the single-pass path is unchanged and the stored
 *      idConstruction gains no two-pass keys.
 *   3. An empty plan falls back to the single-pass stage with the fallback
 *      recorded, so the row stays usable and screenable.
 *   4. buildPlanRenderPrompt keeps the manner block last (the same
 *      last-thing-read rule as the single-pass path); buildContentPlanPrompt
 *      never sees the manner block at all.
 *
 * Uses __setDeps / __resetDeps (no --experimental-test-module-mocks), same as
 * the other id-director tests.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const {
  generateIdDirectedSuggestion,
  buildContentPlanPrompt,
  buildPlanRenderPrompt,
  CONTENT_PLAN_INSTRUCTION,
  __setDeps,
  __resetDeps,
} = await import('../idDirectorEngine.js');
const { getTutorProfile } = await import('../evalConfigLoader.js');

// Cell 101 has no engagement router, so engagementState is null and no manner
// block exists — which isolates the plan threading from register resolution.
const BASE_CELL = 'cell_101_id_director_charisma';

const CONTEXT = {
  learnerContext: 'LEARNER: This is boring. None of this connects to anything real.',
  curriculumContext: '',
  simulationsContext: '',
  messageHistory: [],
};

// Long enough to clear the id parser's minimum, so the run reaches the ego
// seat without a fallback.
const ID_PROMPT =
  'You are a tutor with a definite voice. Read what the learner just said, answer it in ' +
  'their own terms, and end with one question that asks them to take a position.';
const ID_OUTPUT = JSON.stringify({ generated_prompt: ID_PROMPT });
const PLAN_TEXT =
  '1. Stake: boredom is a claim about the material; treat it as testable.\n' +
  '2. Defeater: one case where the material decides something the learner cares about.\n' +
  '3. Hand back: ask for the case where the claim breaks.';
const MANNER_HEADER = 'How to write this turn';

function twoPassProfile() {
  const profile = getTutorProfile(BASE_CELL);
  return { ...profile, factors: { ...profile.factors, two_pass_register_payload: true } };
}

/** Script every seat and record what each call received. */
function scriptedDeps({ planText = PLAN_TEXT } = {}) {
  const calls = [];
  __setDeps({
    tutorConfig: { getProviderConfig: () => ({ isConfigured: true, apiKey: 'test', models: {} }) },
    callAI: async (agentConfig, systemPrompt, userPrompt, role) => {
      calls.push({ role, systemPrompt, userPrompt });
      if (role === 'tutor_id') return { text: ID_OUTPUT, inputTokens: 10, outputTokens: 20 };
      if (role === 'tutor_ego_plan') return { text: planText, inputTokens: 5, outputTokens: 7 };
      return { text: 'Here is the case. Where does your claim break?', inputTokens: 3, outputTokens: 4 };
    },
  });
  return calls;
}

afterEach(() => __resetDeps());

describe('two_pass_register_payload in generateIdDirectedSuggestion', () => {
  test('plan pass then render pass, plan shipped verbatim and persisted', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(CONTEXT, { profileName: BASE_CELL }, twoPassProfile());

    assert.equal(result.success, true);
    assert.deepEqual(
      calls.map((c) => c.role),
      ['tutor_id', 'tutor_ego_plan', 'tutor_ego'],
    );

    const planCall = calls[1];
    assert.ok(planCall.systemPrompt.startsWith(ID_PROMPT), 'plan pass keeps the id-authored persona');
    assert.ok(planCall.systemPrompt.includes(CONTENT_PLAN_INSTRUCTION), 'plan pass carries the plan instruction');
    assert.ok(!planCall.systemPrompt.includes(MANNER_HEADER), 'plan pass never sees a manner block');

    const renderCall = calls[2];
    assert.ok(renderCall.systemPrompt.startsWith(ID_PROMPT), 'render pass keeps the id-authored persona');
    assert.ok(renderCall.systemPrompt.includes(PLAN_TEXT), 'render pass ships the plan verbatim');
    assert.ok(renderCall.systemPrompt.includes('content plan is already fixed'), 'render pass pins the plan as fixed');
    assert.ok(!renderCall.systemPrompt.includes(CONTENT_PLAN_INSTRUCTION), 'render pass drops the plan instruction');

    assert.equal(result.metadata.apiCalls, 3);
    assert.equal(result.metadata.inputTokens, 18);
    assert.equal(result.metadata.outputTokens, 31);
    assert.equal(result.metadata.twoPassRegisterPayload, true);

    const idc = result.metadata.idConstruction;
    assert.equal(idc.two_pass_register_payload, true);
    assert.equal(idc.content_plan, PLAN_TEXT);
    assert.equal(idc.content_plan_status, 'planned');
    assert.equal(idc.generated_prompt, renderCall.systemPrompt, 'shipped prompt is the render prompt');
    assert.equal(idc.id_written_prompt, ID_PROMPT);
    assert.equal(idc.manner_block_appended, false, 'no register, so no manner block despite the plan');
    assert.equal(idc.delivery_register, null);

    const actions = result.dialogueTrace.map((t) => `${t.agent}/${t.action}`);
    const constructAt = actions.indexOf('id/construct');
    const planAt = actions.indexOf('ego/plan');
    const executeAt = actions.indexOf('ego/execute');
    assert.ok(constructAt >= 0 && planAt > constructAt && executeAt > planAt, `order wrong: ${actions}`);
    const planEntry = JSON.parse(result.dialogueTrace[planAt].detail);
    assert.equal(planEntry.content_plan, PLAN_TEXT);
    assert.equal(planEntry.content_plan_status, 'planned');
    assert.equal(result.dialogueTrace[planAt].metrics.inputTokens, 5);
    assert.equal(result.dialogueTrace[planAt].metrics.outputTokens, 7);
  });

  test('factor off leaves the single-pass path and its stored shape unchanged', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(CONTEXT, { profileName: BASE_CELL }, getTutorProfile(BASE_CELL));

    assert.equal(result.success, true);
    assert.deepEqual(
      calls.map((c) => c.role),
      ['tutor_id', 'tutor_ego'],
    );
    assert.equal(result.metadata.apiCalls, 2);
    assert.equal(result.metadata.twoPassRegisterPayload, false);

    const idc = result.metadata.idConstruction;
    assert.ok(!('two_pass_register_payload' in idc), 'no two-pass keys on single-pass rows');
    assert.ok(!('content_plan' in idc));
    assert.equal(idc.generated_prompt, ID_PROMPT);
    assert.equal(idc.manner_block_appended, false);
    assert.ok(!result.dialogueTrace.some((t) => t.action === 'plan'), 'no plan trace entry');
  });

  test('an empty plan falls back to the single-pass stage with the fallback recorded', async () => {
    const calls = scriptedDeps({ planText: '   ' });
    const result = await generateIdDirectedSuggestion(CONTEXT, { profileName: BASE_CELL }, twoPassProfile());

    assert.equal(result.success, true);
    assert.deepEqual(
      calls.map((c) => c.role),
      ['tutor_id', 'tutor_ego_plan', 'tutor_ego'],
    );
    const renderCall = calls[2];
    assert.equal(renderCall.systemPrompt, ID_PROMPT, 'fallback render is the plain single-pass prompt');

    const idc = result.metadata.idConstruction;
    assert.equal(idc.two_pass_register_payload, true);
    assert.equal(idc.content_plan, null);
    assert.equal(idc.content_plan_status, 'empty_fallback_single_pass');

    const planEntry = JSON.parse(result.dialogueTrace.find((t) => t.action === 'plan').detail);
    assert.equal(planEntry.content_plan, null);
    assert.equal(planEntry.content_plan_status, 'empty_fallback_single_pass');
  });
});

describe('two-pass prompt builders', () => {
  test('buildContentPlanPrompt is persona plus instruction, nothing else', () => {
    assert.equal(buildContentPlanPrompt('persona'), `persona\n\n${CONTENT_PLAN_INSTRUCTION}`);
  });

  test('buildPlanRenderPrompt keeps the manner block last', () => {
    const out = buildPlanRenderPrompt('persona', 'THE PLAN', { selected_register: 'ironic' });
    assert.ok(out.startsWith('persona'));
    const planAt = out.indexOf('THE PLAN');
    const mannerAt = out.indexOf(`${MANNER_HEADER} (ironic)`);
    assert.ok(planAt > 0, 'plan embedded');
    assert.ok(mannerAt > planAt, 'manner block reads last');
  });

  test('buildPlanRenderPrompt with no register embeds the plan and nothing else', () => {
    const out = buildPlanRenderPrompt('persona', 'THE PLAN', null);
    assert.ok(out.startsWith('persona'));
    assert.ok(out.includes('THE PLAN'));
    assert.ok(!out.includes(MANNER_HEADER));
  });
});
