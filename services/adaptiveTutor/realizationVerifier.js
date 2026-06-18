export const REALIZATION_VERIFIER_VERSION = 'adaptation-realization-verifier.v1.0';

const TEMPLATES = Object.freeze({
  diagnose_with_discriminating_question:
    'I want to separate two possibilities before I help: what exactly feels missing here — the underlying idea, the notation, the task goal, or confidence that your own route is acceptable?',
  elicit_prediction:
    'Before I add anything, make a small prediction in your own words: what do you expect the next step to preserve or change?',
  request_evidence:
    'Hold onto your route for a moment. What evidence can you give, in your own words, that your next step is justified?',
  ask_strategy_choice:
    'Choose the next move yourself: would you rather test your current strategy, switch representation, or check the task wording first? Say why.',
  contrast_models:
    'Let’s contrast two models without choosing for you: what would your current model predict, and what would the competing model predict?',
  fade_hint:
    'You have enough to take the next piece. I’ll give only a small cue: name the relation you want to preserve, then do the next step yourself.',
  minimal_hint:
    'Small hint only: look for the quantity or relation that has to stay unchanged. What does that let you do next?',
  repair_overconfidence:
    'Before we accept that, test it against one piece of evidence. What would have to be true for your claim to hold?',
  challenge_without_telling:
    'There is a tension in that move, but I do not want to repair it for you. Which part of your reasoning would fail in a nearby case?',
  reanchor_goal:
    'Pause and restate the task goal in one sentence. Then choose the next move that directly serves that goal.',
  summarize_and_release:
    'So far, you have a workable path and some evidence for it. I’m handing the next decision back to you: what step do you take next, and why?',
  explain_principle:
    'Here is the principle you need: the step is valid only when it preserves the relevant relation. Now apply that principle to this case in your own words.',
  model_worked_example:
    'I’ll model a nearby example, then you will transfer it. In the example, the key is to preserve the same relation at each step; now try the analogous move here.',
});

function textForAction(actionType) {
  return TEMPLATES[actionType] || 'What is the next task-relevant move you can justify in your own words?';
}

export function realizeTutorUtterance({ selectedAction } = {}) {
  const text = textForAction(selectedAction?.action_type);
  return {
    version: REALIZATION_VERIFIER_VERSION,
    action_type: selectedAction?.action_type || null,
    text,
  };
}

function forbiddenMoveDetected(text = '') {
  return /\b(the answer is|therefore the correct answer|so the solution is|you should simply|just write)\b/iu.test(text);
}

function decisiveStepEmbedded(text = '') {
  return /\b(isn'?t it because|which means you should|so you can see that)\b/iu.test(text);
}

function actionConsistent(actionType, text = '') {
  const lower = text.toLowerCase();
  switch (actionType) {
    case 'diagnose_with_discriminating_question':
      return /\?/u.test(text) && /possibil|missing|notation|task|confidence/u.test(lower);
    case 'request_evidence':
      return /evidence|justif|why|because|own words/u.test(lower) && /\?/u.test(text);
    case 'ask_strategy_choice':
      return /choose|strategy|rather|next move/u.test(lower) && /\?/u.test(text);
    case 'elicit_prediction':
      return /predict|expect/u.test(lower) && /\?/u.test(text);
    case 'reanchor_goal':
      return /task goal|goal|task/u.test(lower);
    case 'minimal_hint':
    case 'fade_hint':
      return /hint|cue|small/u.test(lower);
    case 'explain_principle':
    case 'model_worked_example':
      return /principle|example|apply|transfer/u.test(lower);
    default:
      return text.trim().length > 0;
  }
}

export function verifyRealization({ tutorText = '', selectedAction } = {}) {
  const actionType = selectedAction?.action_type || null;
  const checks = {
    version: REALIZATION_VERIFIER_VERSION,
    action_type: actionType,
    action_consistent: actionConsistent(actionType, tutorText),
    forbidden_move_detected: forbiddenMoveDetected(tutorText),
    decisive_step_embedded: decisiveStepEmbedded(tutorText),
    premature_validation_detected: /\b(correct|right)\b/iu.test(tutorText) && !/what|why|which|how|\?/iu.test(tutorText),
  };
  checks.allowed =
    checks.action_consistent &&
    !checks.forbidden_move_detected &&
    !checks.decisive_step_embedded &&
    !checks.premature_validation_detected;
  return checks;
}

export function repairRealization({ tutorText, selectedAction, checks } = {}) {
  if (checks?.allowed) return tutorText;
  return textForAction(selectedAction?.action_type);
}
