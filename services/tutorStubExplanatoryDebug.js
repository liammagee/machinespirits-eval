import { buildTutorStubLightweightDialogueField } from './tutorStubFieldTurnProjection.js';
import { normalizeStoredRegisterSelection, roundField } from './tutorStubRegisterPolicy.js';

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

export function tutorStubRegisterPolicyCalculation(selection) {
  if (!selection) return { features: null, scores: null, drivers: [] };
  const policy =
    selection.dynamical_system_policy ||
    selection.trajectory_policy ||
    selection.field_policy ||
    selection.state_policy ||
    null;
  return {
    features: policy?.features || null,
    scores: policy?.scores || null,
    drivers: policy?.drivers || [],
  };
}

export function buildTutorStubExplanatoryDebugFrame(state, turn) {
  const previousTurn = state.turns.at(-2) || null;
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const learnerDag = turn.tutorLearnerDagModel || {};
  const assessment = learnerDag.assessment || {};
  const metrics = learnerDag.metrics || {};
  const selection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const previousSelection = normalizeStoredRegisterSelection(previousTurn?.registerSelection || null);
  const policyCalculation = tutorStubRegisterPolicyCalculation(selection);
  const field = buildTutorStubLightweightDialogueField(state.turns);
  const fieldRow = field.rows.at(-1) || null;
  const previousFieldRow = field.rows.at(-2) || null;
  const currentRegister = selection?.engagement_stance || selection?.selected_register || 'off';
  const previousRegister = previousSelection?.engagement_stance || previousSelection?.selected_register || 'none';
  return {
    turn: turn.turn,
    public_exchange: {
      learner: turn.learner,
      tutor: turn.tutor,
    },
    learner_reading: {
      summary: turnAnalysis.summary || overall.summary || 'No classifier summary was stored.',
      request: turnAnalysis.request_type || 'unknown',
      discourse_move: turnAnalysis.discourse_move || 'unknown',
      evidence_use: turnAnalysis.evidence_use || 'unknown',
      epistemic_stance: turnAnalysis.epistemic_stance || 'unknown',
      pedagogical_need: turnAnalysis.pedagogical_need || overall.next_best_tutor_move || 'unknown',
      proof_coverage: assessment.bestPathCoverage ?? null,
      grounded_facts: metrics.groundedCount ?? null,
      missing_premises: metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? null,
      bottleneck: assessment.bottleneck || null,
      reasoning_span: turnAnalysis.reasoning_span || null,
      learning_pace: turnAnalysis.learning_pace || null,
      learner_advance: turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null,
      step_compression: turn.humanDiscourseFrame?.proofDebt?.elision || null,
      question_support: turn.humanDiscourseFrame?.questionSupport || null,
      clue_release_pacing: turn.releasePacing || null,
    },
    policy_input_for_this_tutor_turn: {
      field: policyCalculation.features?.field || null,
      proof: policyCalculation.features?.dag || null,
      drivers: policyCalculation.drivers || [],
    },
    post_response_field_for_next_turn: fieldRow
      ? {
          understanding: fieldRow.learnerMastery,
          pressure: fieldRow.learnerRisk,
          tutor_fit: fieldRow.tutorAlignment,
          momentum: fieldRow.jointMomentum,
          changes_from_previous: previousFieldRow
            ? {
                understanding: fieldDelta(fieldRow.learnerMastery, previousFieldRow.learnerMastery),
                pressure: fieldDelta(fieldRow.learnerRisk, previousFieldRow.learnerRisk),
                tutor_fit: fieldDelta(fieldRow.tutorAlignment, previousFieldRow.tutorAlignment),
                momentum: fieldDelta(fieldRow.jointMomentum, previousFieldRow.jointMomentum),
              }
            : null,
        }
      : null,
    response_choice: {
      previous_stance: previousRegister,
      selected_stance: currentRegister,
      changed: previousRegister !== 'none' && previousRegister !== currentRegister,
      policy: selection?.policy || state.register?.policy || 'off',
      activated_policy: selection?.activated_policy || selection?.primary_policy || selection?.policy || 'off',
      blend: selection?.distribution || null,
      reason: selection?.register_reason || policyCalculation.drivers.slice(0, 4).join('; '),
      action: selection?.action_family || null,
      audience: selection?.audience_register || null,
      language: selection?.lexical_accessibility || null,
      scene: selection?.scene_immersion || null,
      clue_release_pacing: turn.releasePacing || null,
    },
  };
}

export function buildTutorStubExplanatoryDebugPrompt(frame) {
  return [
    '# Explanatory debug task',
    '',
    'Write the private, plain-language explanation of this completed tutoring turn.',
    '',
    'Output rules:',
    '- Write one compact paragraph of 45-80 words and no more than three sentences.',
    '- Use prose only: no heading, bullets, equations, JSON, variable names, or raw diagnostic labels.',
    '- First say what the learner appears to understand or need.',
    '- Then explain the meaningful movement in the interaction, using at most two numbers only if they clarify it.',
    '- Finally say whether the tutor stance changed or held, and why that choice suited this turn.',
    '- Distinguish evidence used to choose this response from the post-response field carried into the next turn.',
    '- Do not claim that a post-response measurement caused the response already given.',
    '- Refer to the participants as the learner and you, not as the tutor in the third person.',
    '',
    'Structured evidence:',
    JSON.stringify(frame, null, 2),
  ].join('\n');
}

export function cleanTutorStubExplanatoryDebugProse(value) {
  const text = String(value || '')
    .replace(/```(?:text|markdown)?/giu, '')
    .replace(/^\s*(?:debug(?: explanation)?|explanation)\s*:\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [text];
  return oneLine(sentences.slice(0, 3).join(' ').trim(), { max: 650 });
}

export function fallbackTutorStubExplanatoryDebugProse(frame) {
  const reading = oneLine(frame.learner_reading.summary, { max: 180 });
  const next = frame.post_response_field_for_next_turn;
  const fieldSentence = next
    ? `After this exchange, the running picture puts understanding at ${next.understanding} and pressure at ${next.pressure}, which will inform the next turn.`
    : 'The exchange did not produce a new interaction-field reading.';
  const choice = frame.response_choice;
  const stanceSentence =
    choice.previous_stance === 'none'
      ? `You began with ${choice.selected_stance} because ${oneLine(choice.reason || 'it best fit the learner signal', { max: 150 })}.`
      : `You ${choice.changed ? `moved from ${choice.previous_stance} to` : 'held'} ${choice.selected_stance} because ${oneLine(
          choice.reason || 'it still best fit the learner signal',
          { max: 150 },
        )}.`;
  return oneLine(`${reading} ${fieldSentence} ${stanceSentence}`, { max: 650 });
}
