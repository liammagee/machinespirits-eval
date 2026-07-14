import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  deterministicTutorStubLearnerUptake,
  formatTutorStubResponseComposition,
  tutorStubResponseCompositionPrompt,
} from '../services/tutorStubResponseComposition.js';

function traceFrame() {
  return buildTutorStubResponseCompositionFrame({
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
    classification: {
      turn: {
        summary: 'Correctly limits what the badge log establishes.',
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'grounded',
        pedagogical_need: 'Identify the additional required evidence.',
      },
    },
    tutorLearnerDag: {
      model: {
        assessment: {
          status: 'available',
          bottleneck: 'release_or_pacing_gap',
          bestPathCoverage: 0,
          missingPremiseCount: 3,
        },
        metrics: { groundedCount: 2 },
      },
      advance: { pace: 'advancing', supportedMoveCount: 1, adoptedPremiseCount: 1 },
    },
    registerSelection: {
      expected_dag_move: 'Move one missing public premise into the learner-owned record.',
      expected_field_move: 'Create a learner-owned public move.',
      response_configuration: {
        engagement_stance: 'charismatic',
        action_family: 'answer_accountably',
        audience_register: 'domain_apprentice',
        lexical_accessibility: 'standard',
        scene_immersion: 'immersive',
      },
    },
    dramaticReleaseFrame: { active: true },
    dialogueClosureFrame: { phase: 'open', mandatory: false },
  });
}

test('response composition maps the selected action to uptake and the DAG move to development', () => {
  const frame = traceFrame();
  assert.equal(frame.delivery.atomic_assistant_turn, true);
  assert.equal(frame.delivery.public_history_messages, 1);
  assert.equal(frame.action_target, 'uptake');
  assert.equal(frame.uptake.action_family, 'answer_accountably');
  assert.equal(frame.development.action_family, null);
  assert.equal(frame.development.kind, 'dramatic_clue_release');
  assert.match(frame.development.expected_dag_move, /missing public premise/u);
  assert.equal(frame.shared_realization.engagement_stance, 'charismatic');

  const prompt = tutorStubResponseCompositionPrompt(frame);
  assert.match(prompt, /one atomic assistant turn/u);
  assert.match(prompt, /answer_accountably/u);
  assert.match(prompt, /Correctly limits what the badge log establishes/u);
  assert.match(prompt, /Keep the response beat before the clue handoff/u);
  assert.doesNotMatch(prompt, /p_noon|p_crew/u);
});

test('a DAG-progression action is realized in development while uptake remains learner-responsive', () => {
  const frame = buildTutorStubResponseCompositionFrame({
    learnerText: 'I follow the first clue. What comes next?',
    classification: { turn: { summary: 'The learner is ready for the next public clue.' } },
    registerSelection: {
      expected_dag_move: 'Stage one missing public premise.',
      response_configuration: {
        engagement_stance: 'brisk',
        action_family: 'stage_next_step',
        audience_register: 'domain_apprentice',
        lexical_accessibility: 'standard',
        scene_immersion: 'immersive',
      },
    },
  });

  assert.equal(frame.action_target, 'development');
  assert.equal(frame.uptake.action_family, null);
  assert.equal(frame.development.action_family, 'stage_next_step');
  const prompt = tutorStubResponseCompositionPrompt(frame);
  assert.match(prompt, /2\. Develop:[\s\S]*stage_next_step/u);
  assert.doesNotMatch(prompt, /1\. Respond:[^\n]*stage_next_step/u);
});

test('a responsive model draft is segmented into uptake and development without changing its words', () => {
  const frame = traceFrame();
  const text =
    'Exactly—Dario’s presence keeps him in view, but it does not prove he touched the lunchbox. Step up to the front desk with me; I’m the clerk opening the visitor badge log: “Another noon entry—WF-11.” Back at the fridge, what does that change?';
  const audit = auditTutorStubResponseComposition({
    text,
    frame,
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
  });

  assert.equal(audit.ok, true);
  assert.match(audit.segments.uptake, /does not prove/u);
  assert.match(audit.segments.development, /front desk/u);
  assert.equal(formatTutorStubResponseComposition(audit), `${audit.segments.uptake}\n\n${audit.segments.development}`);
});

test('a clue rehearsal without learner uptake fails composition even when it develops the lesson', () => {
  const frame = traceFrame();
  const audit = auditTutorStubResponseComposition({
    text: 'I’m going to give you another piece of information now. Let’s role-play it with the front-desk clerk.',
    frame,
    learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.segments.method, 'development_only');
  assert.deepEqual(audit.issues.map((issue) => issue.type), ['missing_learner_uptake']);
});

test('the deterministic uptake is public, learner-specific, and action-aware', () => {
  assert.equal(
    deterministicTutorStubLearnerUptake({
      learnerText: "nothing - doesn't prove he did it, just confirms he's a suspect",
      classification: { turn: { request_type: 'authority_refusal_or_status_challenge' } },
      actionFamily: 'answer_accountably',
    }),
    'You’re right to separate suspicion from proof.',
  );
});
