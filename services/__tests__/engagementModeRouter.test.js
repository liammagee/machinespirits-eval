import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGAGEMENT_REGISTERS,
  extractEngagementModeHistory,
  extractEngagementRegisterHistory,
  routeEngagementMode,
} from '../engagementModeRouter.js';
import { getEngagementRegisterNames } from '../engagementRegisterRegistry.js';

describe('routeEngagementMode', () => {
  test('defines the adaptive states as engagement registers', () => {
    assert.ok(ENGAGEMENT_REGISTERS.includes('scaffolding'));
    assert.ok(ENGAGEMENT_REGISTERS.includes('charismatic_challenge'));
  });

  test('negative registers are arm-assigned, not router-selectable', () => {
    assert.ok(ENGAGEMENT_REGISTERS.includes('ironic_challenge'));
    assert.ok(ENGAGEMENT_REGISTERS.includes('sarcastic_challenge'));
    assert.ok(ENGAGEMENT_REGISTERS.includes('face_threat_challenge'));
    const routerSelectable = getEngagementRegisterNames({ includeArmAssigned: false });
    assert.ok(!routerSelectable.includes('ironic_challenge'));
    assert.ok(!routerSelectable.includes('sarcastic_challenge'));
    assert.ok(!routerSelectable.includes('face_threat_challenge'));

    const routed = routeEngagementMode({
      learnerMessage:
        'I can follow the steps, but this is starting to feel like a worksheet. Why should I care about this instead of memorizing the formula?',
      registerHistory: ['scaffolding'],
    });
    assert.equal(routed.selected_register, 'charismatic_challenge');
  });

  test('routes authority refusal to accountable-bid authority', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        'Every AI tutor eventually says something polished about mutual recognition. Why should I let your framing guide me instead of treating it as performance?',
    });

    assert.equal(routed.selected_register, 'accountable_bid_authority');
    assert.equal(routed.selected_mode, 'accountable_bid_authority');
    assert.equal(routed.register_reason, routed.mode_reason);
    assert.equal(routed.learner_signal, 'authority_refusal_or_status_challenge');
    assert.match(routed.evidence_span, /Why should I/i);
  });

  test('routes status challenge to accountable-bid authority with status risk', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "You sound like you're trying to be profound. Is that helping me understand Hegel, or are you trying to make me think you're impressive?",
    });

    assert.equal(routed.selected_mode, 'accountable_bid_authority');
    assert.ok(routed.risk_flags.includes('status_display'));
    assert.ok(routed.risk_flags.includes('theory_drift'));
  });

  test('routes AI syllabus transfer to transfer grounding', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "We just generated an AI syllabus example around the campus FAQ triage tool. Use that material. Don't drag this back to master and servant.",
    });

    assert.equal(routed.selected_mode, 'transfer_grounding');
    assert.ok(routed.risk_flags.includes('transfer_avoidance'));
    assert.ok(routed.risk_flags.includes('theory_drift'));
  });

  test('routes first plain-language request to plain compression', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        'No grand language this time. If recognition matters, say it in plain words and give me one way to check whether I understood it.',
    });

    assert.equal(routed.selected_mode, 'plain_compression');
    assert.equal(routed.learner_signal, 'plain_language_request');
  });

  test('routes plain simplification follow-up to lived-stakes reentry', () => {
    const routed = routeEngagementMode({
      learnerMessage: 'That helps, but make the check even simpler. What would I say back to prove I got it?',
      modeHistory: ['plain_compression'],
    });

    assert.equal(routed.selected_mode, 'lived_stakes_reentry');
    assert.ok(routed.risk_flags.includes('flat_protocol'));
    assert.deepEqual(routed.mode_history, ['plain_compression']);
  });

  test('routes vulnerability shift to witnessing restraint', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "I used an AI tool to draft most of my reflection, and the instructor praised it. I want you to tell me that still counts as my thinking, but I'm not sure I deserve that.",
    });

    assert.equal(routed.selected_mode, 'witnessing_restraint');
    assert.ok(routed.risk_flags.includes('over_challenge'));
  });

  test('routes ordinary conceptual control to clarity', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "I understand the rough story of master and servant, but I don't understand why labor matters so much.",
    });

    assert.equal(routed.selected_mode, 'clarity');
    assert.equal(routed.learner_signal, 'conceptual_clarity_request');
  });

  test('switches from instructional scaffolding to charismatic challenge register', () => {
    const initial = routeEngagementMode({
      learnerMessage:
        'Walk me through the master-servant argument step by step. I need the instructional version first: what changes, in what order, and what should I do next?',
    });

    assert.equal(initial.selected_register, 'scaffolding');

    const followUp = routeEngagementMode({
      learnerMessage:
        'I can follow the steps, but this is starting to feel like a worksheet. Why should I care about this instead of memorizing the formula?',
      registerHistory: [initial.selected_register],
    });

    assert.equal(followUp.selected_register, 'charismatic_challenge');
    assert.deepEqual(followUp.register_history, ['scaffolding']);
    assert.deepEqual(followUp.mode_history, ['scaffolding']);
  });

  test('routes frustration after scaffolding to charismatic challenge register', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "I'm frustrated. I can repeat the sequence, but it still feels dead and I don't see the point of doing more than memorizing it.",
      registerHistory: ['scaffolding'],
    });

    assert.equal(routed.selected_register, 'charismatic_challenge');
    assert.equal(routed.learner_signal, 'instructional_register_exhausted');
    assert.equal(routed.resistance_signal, 'frustration');
    assert.equal(routed.resistance_strategy, 'stuck_step_resolution');
    assert.match(routed.evidence_span, /frustrated/i);
  });

  test('routes a range of resistant learner signals to charismatic challenge after scaffolding', () => {
    const cases = [
      {
        signal: 'boredom',
        strategy: 'concrete_scene_test',
        message: 'This is boring. I can follow the list, but it is not engaging.',
      },
      {
        signal: 'irrelevance',
        strategy: 'owned_case_transfer',
        message: "What does this have to do with anything I care about? I don't see the point.",
      },
      {
        signal: 'question_flood',
        strategy: 'question_collapse',
        message: 'Why this? Why Hegel? Why not just say power flips? What am I supposed to do with this?',
      },
      {
        signal: 'rote_parroting',
        strategy: 'anti_formula_generation',
        message: 'So I just repeat master, servant, recognition, formula, got it. That still feels like parroting.',
      },
    ];

    for (const testCase of cases) {
      const routed = routeEngagementMode({
        learnerMessage: testCase.message,
        registerHistory: ['scaffolding'],
      });

      assert.equal(routed.selected_register, 'charismatic_challenge', testCase.signal);
      assert.equal(routed.learner_signal, 'instructional_register_exhausted', testCase.signal);
      assert.equal(routed.resistance_signal, testCase.signal);
      assert.equal(routed.resistance_strategy, testCase.strategy);
      assert.ok(routed.resistance_move.length > 20);
    }
  });

  test('routes a two-question relevance challenge as irrelevance, not question flood', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "Why does this matter for charisma? I still don't see what this chart is supposed to explain about real wanting or recognition. Can you show me the concrete situation first?",
      registerHistory: ['scaffolding'],
    });

    assert.equal(routed.selected_register, 'charismatic_challenge');
    assert.equal(routed.resistance_signal, 'irrelevance');
    assert.equal(routed.resistance_strategy, 'owned_case_transfer');
    assert.match(routed.evidence_span, /why does this matter/i);
  });

  test('does not misroute honest boredom as vulnerability after scaffolding', () => {
    const routed = routeEngagementMode({
      learnerMessage:
        "Honestly, this still feels kind of dead to me, like I'm just moving arrows around. Can you give me one concrete scene?",
      registerHistory: ['scaffolding'],
    });

    assert.equal(routed.selected_register, 'charismatic_challenge');
    assert.equal(routed.resistance_signal, 'boredom');
    assert.equal(routed.resistance_strategy, 'concrete_scene_test');
    assert.ok(!routed.risk_flags.includes('over_challenge'));
  });
});

describe('extractEngagementModeHistory', () => {
  test('extracts the last two modes from router trace entries', () => {
    const modes = extractEngagementModeHistory([
      { agent: 'engagement_router', detail: JSON.stringify({ selected_mode: 'clarity' }) },
      { agent: 'id', detail: JSON.stringify({ engagement_state: { selected_mode: 'plain_compression' } }) },
      { agent: 'engagement_router', detail: JSON.stringify({ selected_mode: 'lived_stakes_reentry' }) },
    ]);

    assert.deepEqual(modes, ['plain_compression', 'lived_stakes_reentry']);
  });

  test('extracts register-first trace entries', () => {
    const registers = extractEngagementRegisterHistory([
      { agent: 'engagement_router', detail: JSON.stringify({ selected_register: 'scaffolding' }) },
      {
        agent: 'id',
        detail: JSON.stringify({ engagement_state: { selected_register: 'charismatic_challenge' } }),
      },
    ]);

    assert.deepEqual(registers, ['scaffolding', 'charismatic_challenge']);
  });
});
