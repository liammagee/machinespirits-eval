/**
 * Yoked delivery-swap seam in the id-director runner adapter (edged-register
 * outcome study, arm B — draft note
 * notes/2026-08-16-edged-register-calibration-draft.md).
 *
 * Arm B keeps the whole authoring machinery of arm A — router, register arm,
 * id-director, register-free content plan — and swaps only the delivery
 * register the render pass reads, back to the router's own selection. The
 * seam is gated by factors.yoked_delivery_swap and lives only in
 * generateIdDirectedSuggestion. Verifies:
 *   1. applyYokedDeliverySwap swaps the selection fields, marks the swap,
 *      preserves the assignment record and the resistance evidence, and
 *      passes non-arm states through by reference.
 *   2. countPriorEdgeMoments counts experiment-arm route entries across the
 *      trace-like shapes extractEngagementRegisterHistory accepts.
 *   3. End to end on a frustration-signal message (deterministic router path
 *      to charismatic, then the arm to ironic): the id and the content plan
 *      run under the ASSIGNED edged state, the render pass carries the warm
 *      (charismatic) manner block, and the route entry, delivery_swap entry,
 *      and idConstruction fields record assigned vs delivered without mixing
 *      them up.
 *   4. First-edge accounting: edge_moment_index counts prior experiment-arm
 *      route entries in consolidatedTrace; first_edge_moment flips off on
 *      the second edge.
 *   5. Arm A regression (two-pass on, swap off): edged manner delivered, no
 *      swap entry, delivery fields still recorded, metadata.engagementState
 *      and the route entry never carry the edge annotation.
 *   6. No edge: a neutral message under both factors leaves the row
 *      unswapped and unannotated.
 *
 * Uses __setDeps / __resetDeps, same as the other id-director tests.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { generateIdDirectedSuggestion, applyYokedDeliverySwap, countPriorEdgeMoments, __setDeps, __resetDeps } =
  await import('../idDirectorEngine.js');
const { getTutorProfile } = await import('../evalConfigLoader.js');

// Cell 101 is the minimal id-director cell; the router, arm, and study
// factors are added per test so the seam is isolated from cell wiring.
const BASE_CELL = 'cell_101_id_director_charisma';

// "frustrated" and "fed up" hit the frustration resistance patterns and
// nothing else (no irrelevance/rote lexicon, fewer than three question
// marks). Frustration prefers charismatic, so the router's choice — and with
// it the arm firing — is deterministic.
const RESISTANT_CONTEXT = {
  learnerContext: 'LEARNER: I am so frustrated with this step. I have tried it twice and I am fed up.',
  curriculumContext: '',
  simulationsContext: '',
  messageHistory: [],
};

// No resistance patterns, one question mark: the router stays off the
// resistance branch, so the arm never fires and there is no edge moment.
const NEUTRAL_CONTEXT = {
  learnerContext: 'LEARNER: Can you show me one more worked case with the same setup?',
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
  '1. Stake: the stuck step is a claim about the method; treat it as testable.\n' +
  '2. Hand back: one forced-choice reconstruction of the step.\n' +
  '3. Ask: which branch the learner commits to.';
const MANNER_HEADER = 'How to write this turn';

function armProfile(extraFactors = {}) {
  const profile = getTutorProfile(BASE_CELL);
  return {
    ...profile,
    factors: {
      ...profile.factors,
      engagement_mode_router: true,
      engagement_register_arm: 'ironic_challenge', // resolves to canonical 'ironic'
      two_pass_register_payload: true,
      ...extraFactors,
    },
  };
}

/** Script every seat and record what each call received. */
function scriptedDeps() {
  const calls = [];
  __setDeps({
    tutorConfig: { getProviderConfig: () => ({ isConfigured: true, apiKey: 'test', models: {} }) },
    callAI: async (agentConfig, systemPrompt, userPrompt, role) => {
      calls.push({ role, systemPrompt, userPrompt });
      if (role === 'tutor_id') return { text: ID_OUTPUT, inputTokens: 10, outputTokens: 20 };
      if (role === 'tutor_ego_plan') return { text: PLAN_TEXT, inputTokens: 5, outputTokens: 7 };
      return { text: 'Rebuild the step both ways. Which branch do you commit to?', inputTokens: 3, outputTokens: 4 };
    },
  });
  return calls;
}

afterEach(() => __resetDeps());

// Hand-built to the field convention applyEngagementRegisterArm writes.
const ARM_STATE = Object.freeze({
  selected_register: 'ironic',
  selected_mode: 'ironic',
  legacy_selected_register: 'ironic_challenge',
  router_selected_register: 'charismatic',
  router_selected_mode: 'charismatic',
  legacy_router_selected_register: 'charismatic_challenge',
  assigned_register_arm: 'ironic',
  register_assignment_source: 'experiment_arm',
  resistance_signal: 'frustration',
  learner_signal: 'boredom_or_compliance_challenge',
  register_reason: 'Resistant precondition.',
});

describe('applyYokedDeliverySwap', () => {
  test('swaps delivery back to the router register and marks the swap', () => {
    const out = applyYokedDeliverySwap(ARM_STATE);
    assert.equal(out.selected_register, 'charismatic');
    assert.equal(out.selected_mode, 'charismatic');
    assert.equal(out.legacy_selected_register, 'charismatic_challenge');
    assert.equal(out.register_assignment_source, 'yoked_delivery_swap');
    assert.equal(out.delivery_swapped, true);
    assert.equal(out.replaced_delivery_register, 'ironic');
    assert.equal(out.assigned_register_arm, 'ironic', 'the assignment record survives the swap');
    assert.equal(out.resistance_signal, 'frustration', 'resistance evidence survives the swap');
    assert.equal(out.register_valence, 'positive');
    assert.equal(out.router_selectable, true);
    assert.match(out.register_reason, /yoked delivery swap/i);
    assert.equal(ARM_STATE.selected_register, 'ironic', 'input state is not mutated');
  });

  test('non-arm states pass through by reference', () => {
    const routed = { selected_register: 'charismatic', register_reason: 'routed' };
    assert.equal(applyYokedDeliverySwap(routed), routed);
    assert.equal(applyYokedDeliverySwap(null), null);
  });
});

const routeEntry = (source, selected) => ({
  agent: 'engagement_router',
  action: 'route',
  detail: JSON.stringify({ register_assignment_source: source, selected_register: selected }),
});

describe('countPriorEdgeMoments', () => {
  test('counts only experiment-arm route entries', () => {
    const entries = [
      routeEntry('experiment_arm', 'ironic'),
      routeEntry(undefined, 'precise'), // plain router turn: no source field
      { agent: 'ego', action: 'execute', detail: 'not json' },
      { agent: 'engagement_router', action: 'delivery_swap', detail: routeEntry('yoked_delivery_swap', 'x').detail },
      routeEntry('yoked_delivery_swap', 'charismatic'), // defensive: a swapped route entry still marks an edge
    ];
    assert.equal(countPriorEdgeMoments(entries), 2);
  });

  test('accepts the same trace-like shapes as the register-history reader', () => {
    const entries = [routeEntry('experiment_arm', 'ironic')];
    assert.equal(countPriorEdgeMoments({ dialogueTrace: entries }), 1);
    assert.equal(countPriorEdgeMoments({ consolidatedTrace: entries }), 1);
    assert.equal(countPriorEdgeMoments({ turns: [{ internalDeliberation: entries }] }), 1);
    assert.equal(countPriorEdgeMoments(null), 0);
    assert.equal(countPriorEdgeMoments([{ agent: 'engagement_router', action: 'route', detail: '{broken' }]), 0);
  });
});

describe('yoked delivery swap in generateIdDirectedSuggestion', () => {
  test('arm B: id and plan run under the assigned edged state, render is warm', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      RESISTANT_CONTEXT,
      { profileName: BASE_CELL },
      armProfile({ yoked_delivery_swap: true }),
    );

    assert.equal(result.success, true);
    assert.deepEqual(
      calls.map((c) => c.role),
      ['tutor_id', 'tutor_ego_plan', 'tutor_ego'],
    );

    // The assigned state: router chose charismatic, the arm made it ironic.
    const st = result.metadata.engagementState;
    assert.equal(st.router_selected_register, 'charismatic');
    assert.equal(st.selected_register, 'ironic');
    assert.equal(st.register_assignment_source, 'experiment_arm');
    assert.equal(st.resistance_signal, 'frustration');
    assert.equal(result.metadata.yokedDeliverySwap, true);

    // The id authored under the ASSIGNED edged state, not the delivery state.
    assert.ok(calls[0].userPrompt.includes('"register_assignment_source": "experiment_arm"'));
    assert.ok(calls[0].userPrompt.includes('"selected_register": "ironic"'));

    // Plan pass stays register-free; render pass carries the WARM manner.
    assert.ok(!calls[1].systemPrompt.includes(MANNER_HEADER), 'plan pass never sees a manner block');
    const render = calls[2].systemPrompt;
    assert.ok(render.includes(PLAN_TEXT), 'render pass ships the fixed plan');
    assert.ok(render.includes(`${MANNER_HEADER} (charismatic)`), 'render manner is the router register');
    assert.ok(!render.includes(`${MANNER_HEADER} (ironic)`), 'the edged manner is not delivered');

    const idc = result.metadata.idConstruction;
    assert.equal(idc.two_pass_register_payload, true);
    assert.equal(idc.yoked_delivery_swap, true);
    assert.equal(idc.delivery_register, 'charismatic');
    assert.equal(idc.delivery_swapped, true);
    assert.equal(idc.replaced_delivery_register, 'ironic');
    assert.equal(idc.register_assignment_source, 'yoked_delivery_swap');
    assert.equal(idc.edge_moment, true);
    assert.equal(idc.edge_moment_index, 0);
    assert.equal(idc.first_edge_moment, true);

    // Route entry records what was assigned; delivery_swap what was delivered.
    const actions = result.dialogueTrace.map((t) => `${t.agent}/${t.action}`);
    const routeAt = actions.indexOf('engagement_router/route');
    const swapAt = actions.indexOf('engagement_router/delivery_swap');
    assert.ok(routeAt >= 0 && swapAt > routeAt, `order wrong: ${actions}`);
    const routeDetail = JSON.parse(result.dialogueTrace[routeAt].detail);
    assert.equal(routeDetail.selected_register, 'ironic');
    assert.equal(routeDetail.register_assignment_source, 'experiment_arm');
    assert.equal(routeDetail.edge_moment, undefined, 'the route entry is never edge-annotated');
    const swapDetail = JSON.parse(result.dialogueTrace[swapAt].detail);
    assert.equal(swapDetail.selected_register, 'charismatic');
    assert.equal(swapDetail.delivery_swapped, true);
    assert.equal(swapDetail.first_edge_moment, true);

    const planDetail = JSON.parse(result.dialogueTrace[actions.indexOf('ego/plan')].detail);
    assert.equal(planDetail.delivery_register, 'charismatic', 'plan entry names the delivered register');
  });

  test('a prior experiment-arm route entry makes this the second edge', async () => {
    scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      RESISTANT_CONTEXT,
      { profileName: BASE_CELL },
      armProfile({ yoked_delivery_swap: true }),
      { consolidatedTrace: [routeEntry('experiment_arm', 'ironic')] },
    );

    const idc = result.metadata.idConstruction;
    assert.equal(idc.edge_moment, true);
    assert.equal(idc.edge_moment_index, 1);
    assert.equal(idc.first_edge_moment, false);
  });

  test('arm A regression: swap off delivers the edged manner and records the same edge fields', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(RESISTANT_CONTEXT, { profileName: BASE_CELL }, armProfile());

    assert.equal(result.metadata.yokedDeliverySwap, false);
    const render = calls[2].systemPrompt;
    assert.ok(render.includes(`${MANNER_HEADER} (ironic)`), 'arm A delivers the assigned edged manner');

    const idc = result.metadata.idConstruction;
    assert.equal(idc.yoked_delivery_swap, false);
    assert.equal(idc.delivery_swapped, false);
    assert.equal(idc.replaced_delivery_register, null);
    assert.equal(idc.delivery_register, 'ironic');
    assert.equal(idc.register_assignment_source, 'experiment_arm');
    assert.equal(idc.edge_moment, true);
    assert.equal(idc.edge_moment_index, 0);
    assert.equal(idc.first_edge_moment, true);

    const actions = result.dialogueTrace.map((t) => `${t.agent}/${t.action}`);
    assert.ok(!actions.includes('engagement_router/delivery_swap'), 'no swap entry in arm A');
    // The edge annotation lives on the delivery copy only.
    assert.equal(result.metadata.engagementState.edge_moment, undefined);
  });

  test('no edge: a neutral message under both factors stays unswapped and unannotated', async () => {
    scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      NEUTRAL_CONTEXT,
      { profileName: BASE_CELL },
      armProfile({ yoked_delivery_swap: true }),
    );

    const st = result.metadata.engagementState;
    assert.notEqual(st.register_assignment_source, 'experiment_arm', 'the arm must not fire on a neutral message');

    const idc = result.metadata.idConstruction;
    assert.equal(idc.delivery_swapped, false);
    assert.equal(idc.edge_moment, false);
    assert.equal(idc.edge_moment_index, null);
    assert.equal(idc.first_edge_moment, false);
    assert.equal(idc.delivery_register, st.selected_register, 'delivery follows the router untouched');
    assert.ok(!result.dialogueTrace.some((t) => t.action === 'delivery_swap'));
  });
});

// ── Shipped-configuration checks ──────────────────────────────────────────
//
// Everything above builds its own factors on top of a minimal cell, and every
// one of those hand-built states carries register_assignment_source:
// 'experiment_arm'. That is the assigned-arm path. Cells 207 and 208 take the
// other one — they widen the router's menu instead of overriding its choice —
// and the whole main block of 2026-08-17 ran with the swap inert because
// nothing here drove the shipped YAML (draft note §3.10).
//
// So these read config/tutor-agents.yaml and nothing else: no factor is
// injected, no state is hand-built. If a factor is dropped from a cell, or
// the gate goes back to reading the stamp, they fail.

const ARM_A_CELL = 'cell_207_id_director_edged_register_two_pass_adaptive_edged';
const ARM_B_CELL = 'cell_208_id_director_edged_register_yoked_warm_delivery';

// "boring" and "worksheet" are boredom patterns and nothing else: no
// frustration, irrelevance, rote or question-flood lexicon, no transfer,
// authority, vulnerability, plain or scaffolding pattern, fewer than three
// question marks. Boredom prefers sarcastic, which the widened menu admits,
// so the router's own choice is edged and deterministic.
const BOREDOM_CONTEXT = {
  learnerContext: 'LEARNER: This is boring. It is just a worksheet.',
  curriculumContext: '',
  simulationsContext: '',
  messageHistory: [],
};

describe('shipped edged-register outcome-study cells', () => {
  test('cell 208 as shipped swaps delivery to warm at the edge moment', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      BOREDOM_CONTEXT,
      { profileName: ARM_B_CELL },
      getTutorProfile(ARM_B_CELL),
    );

    assert.equal(result.success, true);
    assert.equal(result.metadata.yokedDeliverySwap, true, 'the shipped cell must carry factors.yoked_delivery_swap');

    // The widened-menu path, stated so a later reading of this test knows
    // which one it is exercising: the ROUTER picked the edged register and
    // nothing stamped the state.
    const st = result.metadata.engagementState;
    assert.equal(st.selected_register, 'sarcastic');
    assert.equal(st.router_selected_register, 'sarcastic', 'the router itself chose the edge');
    assert.equal(st.register_assignment_source, undefined, 'the widened-menu path writes no assignment stamp');
    assert.equal(st.resistance_signal, 'boredom');

    // The swap fires anyway, and delivers the register the un-widened menu
    // would have chosen for this same signal.
    const idc = result.metadata.idConstruction;
    assert.equal(idc.delivery_swapped, true, 'THE CHECK THAT WAS MISSING: the shipped cell must swap delivery');
    assert.equal(idc.delivery_register, 'charismatic');
    assert.equal(idc.replaced_delivery_register, 'sarcastic');
    assert.equal(idc.register_assignment_source, 'yoked_delivery_swap');
    assert.equal(idc.edge_moment, true);
    assert.equal(idc.edge_moment_index, 0);
    assert.equal(idc.first_edge_moment, true);

    // The id and the plan ran under the edged state; only the render is warm.
    assert.ok(calls[0].userPrompt.includes('"selected_register": "sarcastic"'), 'the id authors under the edge');
    assert.ok(!calls[1].systemPrompt.includes(MANNER_HEADER), 'plan pass never sees a manner block');
    const render = calls[2].systemPrompt;
    assert.ok(render.includes(`${MANNER_HEADER} (charismatic)`), 'render manner is warm');
    assert.ok(!render.includes(`${MANNER_HEADER} (sarcastic)`), 'the edged manner is not delivered');

    const swapEntry = result.dialogueTrace.find((t) => t.action === 'delivery_swap');
    assert.ok(swapEntry, 'the swap is recorded in the trace');
    assert.equal(JSON.parse(swapEntry.detail).selected_register, 'charismatic');
  });

  test('cell 207 as shipped marks the edge and delivers it', async () => {
    const calls = scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      BOREDOM_CONTEXT,
      { profileName: ARM_A_CELL },
      getTutorProfile(ARM_A_CELL),
    );

    assert.equal(result.metadata.yokedDeliverySwap, false);
    assert.ok(calls[2].systemPrompt.includes(`${MANNER_HEADER} (sarcastic)`), 'arm A delivers the edged manner');

    const idc = result.metadata.idConstruction;
    assert.equal(idc.delivery_swapped, false);
    assert.equal(idc.delivery_register, 'sarcastic');
    assert.equal(idc.edge_moment, true, 'the edge is marked on the widened-menu path too');
    assert.equal(idc.first_edge_moment, true);
    assert.ok(!result.dialogueTrace.some((t) => t.action === 'delivery_swap'));
  });

  test('the shipped arms differ in delivered manner and in nothing else', async () => {
    const armA = scriptedDeps();
    await generateIdDirectedSuggestion(BOREDOM_CONTEXT, { profileName: ARM_A_CELL }, getTutorProfile(ARM_A_CELL));
    __resetDeps();
    const armB = scriptedDeps();
    await generateIdDirectedSuggestion(BOREDOM_CONTEXT, { profileName: ARM_B_CELL }, getTutorProfile(ARM_B_CELL));

    // Same authoring machinery: the id seat and the register-free plan pass
    // see identical bytes. This is what makes the pair yoked.
    assert.equal(armA[0].systemPrompt, armB[0].systemPrompt);
    assert.equal(armA[0].userPrompt, armB[0].userPrompt);
    assert.equal(armA[1].systemPrompt, armB[1].systemPrompt);

    // And they are not twins: the render pass differs, which is the whole
    // contrast. Cell 208 ran as an exact copy of 207 for 390 turns because
    // nothing asserted this.
    assert.notEqual(armA[2].systemPrompt, armB[2].systemPrompt, 'arm B must not deliver arm A byte for byte');
    assert.ok(armA[2].systemPrompt.includes(`${MANNER_HEADER} (sarcastic)`));
    assert.ok(armB[2].systemPrompt.includes(`${MANNER_HEADER} (charismatic)`));
  });

  test('cell 208 leaves a non-edge turn alone', async () => {
    scriptedDeps();
    const result = await generateIdDirectedSuggestion(
      NEUTRAL_CONTEXT,
      { profileName: ARM_B_CELL },
      getTutorProfile(ARM_B_CELL),
    );

    const st = result.metadata.engagementState;
    assert.ok(
      !['ironic', 'sarcastic'].includes(st.selected_register),
      `a neutral message must not route to an edged register (got ${st.selected_register})`,
    );
    const idc = result.metadata.idConstruction;
    assert.equal(idc.delivery_swapped, false);
    assert.equal(idc.edge_moment, false);
    assert.equal(idc.delivery_register, st.selected_register, 'delivery follows the router untouched');
  });
});
