export const REALIZATION_VERIFIER_VERSION = 'adaptation-realization-verifier.v1.2';

const TEMPLATES = Object.freeze({
  observe_no_intervention:
    "You have already named a workable next move. I won't add another hint; carry out that move in your own words.",
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
  lower_cognitive_load:
    'Let’s reduce the load to one piece. Ignore the whole apparatus for a moment: which single concept can you still track?',
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
  name_the_disagreement:
    'Let’s name the disagreement before solving it: which relation is actually in dispute, and what would count as evidence for your reading?',
  acknowledge_and_redirect:
    'I hear the shutdown signal. Let’s lower the load: name just one small part you can still locate, and we will work from there.',
  repair_misrecognition:
    'I misread your question. You are asking about the other relation, not the one I answered; restate the corrected question in your words so we track it together.',
  mirror_and_extend:
    'That is a more advanced framing. Let me mirror it and extend one step: what follows if we take your distinction seriously?',
  withhold_answer:
    'I am not going to give the answer yet. Make one small attempt first: what move would you try, and why?',
});

const CONTEXTUAL_TEMPLATES = Object.freeze({
  observe_no_intervention: {
    productive_progress:
      'You have already chosen the route. I will stay out for this step; continue with that comparison in your own terms.',
    default:
      'You have a learner-owned next move on the table. I will not add another scaffold; continue with that move in your own terms.',
  },
  diagnose_with_discriminating_question: {
    false_mastery:
      "I need to test the 'makes sense' claim, not repeat the whole setup: what part can you defend with evidence, and what part are you only accepting because I framed it?",
    low_confidence:
      'Let’s separate confidence from content: what claim would you defend if correctness were not at stake, and where exactly would you want a check?',
    missing_prerequisite:
      'We have already separated the broad possibilities once. Name the smallest missing piece now: a concept, a relation, or a step you cannot justify yet?',
    task_misread:
      'Let’s make the task-reading issue explicit: what do you think the prompt is asking you to produce, and what phrase in it supports that?',
    notation_overload:
      'Let’s isolate notation rather than restart: which symbol or written move blocks you, and what role do you think it is playing?',
    default:
      'Let’s refine the diagnosis instead of restarting it: what changed after your last answer, and which uncertainty is still actually live?',
  },
  elicit_prediction: {
    answer_seeking:
      'Before any answer is supplied, make the smallest prediction you can: if your current route is right, what should the next step preserve?',
    tutor_misread:
      'Before I continue, predict what should stay fixed if I have now understood your question correctly.',
    default:
      'Do not make a fresh generic prediction; revise the last one: what would it preserve, and what would count against it?',
  },
  ask_strategy_choice: {
    answer_seeking:
      'I already asked for a choice and the answer-request came back. I will not supply the answer; choose one bounded test of your route and say why it is enough.',
    low_confidence:
      'Choose a move that tests confidence rather than replaces your plan: evidence check, task wording, or representation switch? Say why.',
    default:
      'Refine the choice rather than reopening all options: which one move follows from what you just learned, and why?',
  },
  contrast_models: {
    boundary_case:
      'Now make the boundary explicit: what does your model predict in this edge case, and what would the competing model predict differently?',
    metaphor_overextension:
      'Test the metaphor instead of repeating it: what would the mirror model predict, and what would break if recognition is selective uptake rather than full reflection?',
    default: 'Use the contrast to move forward: what prediction separates your model from the competing one now?',
  },
  name_the_disagreement: {
    metaphor_overextension:
      'We have named the relation; now locate the exact disputed claim: does recognition require complete reflection, or only accountable uptake? What evidence would decide that?',
    substantive_objection:
      'State the disagreement as a testable relation, not a slogan: what claim is in dispute, and what evidence would force you to revise it?',
    default:
      'Do not rename the whole disagreement; sharpen it: which relation remains disputed after your last answer, and what would count as evidence?',
  },
  acknowledge_and_redirect: {
    affective_shutdown:
      'The shutdown is still the main signal. We will not restart the diagnosis: point to one word, symbol, or idea you can still hold onto.',
    default:
      'Let’s keep the load low and use what you just named: what is the next smallest part you can still work with?',
  },
  withhold_answer: {
    answer_seeking:
      'I am still not giving the answer. Make one bounded attempt first: choose a testable next move, and I will help you inspect it.',
    default: 'I will keep the answer withheld for one more move: what small attempt can you make before we check it?',
  },
  repair_misrecognition: {
    tutor_misread:
      'I misread the target. Let’s repair that directly: restate the exact question you are asking, and name the relation I wrongly substituted for it.',
    default:
      'Let’s repair my reading before continuing: what question should I answer instead of the one I drifted toward?',
  },
  mirror_and_extend: {
    sophistication_upgrade:
      'That is the more advanced frame. Extend it one step: if your textual/interpretive distinction is right, what follows for the argument?',
    default:
      'Keep the advanced frame and push it one step further: what follows if we take your distinction seriously?',
  },
});

function textForAction(actionType) {
  return TEMPLATES[actionType] || 'What is the next task-relevant move you can justify in your own words?';
}

const RESISTANCE_REQUEST_EVIDENCE_TEMPLATES = Object.freeze({
  boredom:
    'Make this live with one concrete test case: what evidence from that case justifies your next step in your own words?',
  frustration:
    'Make it one small try, not the whole sequence: what evidence justifies that step, and where does it still feel stuck?',
  irrelevance:
    'Connect the proof to the task: what would this step help decide, and what evidence justifies taking it?',
  question_flood:
    'Collapse the flood to one main question: what single question does your next step answer, and what evidence supports it?',
  rote_parroting:
    'Do not repeat the formula. Make a prediction in your own words, then give the evidence for why it should hold.',
});

const MISSING_EVIDENCE_FOLLOWUPS = Object.freeze({
  'learner-authored rationale': 'give the reason in your own words and point to the evidence that justifies it',
  'renewed content-bearing work': 'make one content-bearing move instead of only describing the work',
  'learner-owned test case': 'use one concrete test case and say what it shows',
  'renewed attempt after affective repair': 'try the step again after lowering the load',
  'smaller learner-owned move': 'make one smaller move you can own',
  'learner-owned relevance test': 'state how this step would matter for the task',
  'task reorientation': 'restate what the task is asking this step to decide',
  'collapsed question set': 'collapse the question flood to one main question',
  'state-disambiguating response': 'name which uncertainty is still live',
  'learner-authored prediction': 'make a prediction before repeating the formula',
  'non-formulaic learner rationale': 'explain the reason without just repeating the formula words',
  'learner-authored choice': 'choose one route and say why',
});

const MISSING_EVIDENCE_AXIS_FOLLOWUPS = Object.freeze({
  proof_rationale: 'Give only the proof reason now: what evidence justifies the step in your own words?',
  relevance: 'Answer only the relevance part now: what does this step help decide for the actual task?',
  smaller_move: 'Make only the smallest executable move now: what one step can you try and own?',
  prediction: 'Make only the prediction now: what do you expect will hold or break if the case changes?',
  collapsed_question: 'Collapse the question set now: what single question does your next step answer?',
  test_case: 'Use only one concrete test case now: what does that case show?',
  learner_choice: 'Choose only one route now and say why that route is enough to test.',
  evidence: 'Add only the missing evidence in your own words.',
});

function dominantHypothesis(stateBelief) {
  return stateBelief?.hypotheses?.[0]?.id || 'unknown';
}

function hasRecentSameAction(actionType, interventionLedger = []) {
  return interventionLedger
    .filter((record) => record?.status === 'closed')
    .slice(-3)
    .some((record) => record.action_type === actionType);
}

function contextualRealizationEnabled(config = {}) {
  return config.realizationContext === true || config.realization_context === true;
}

function contextualTextForAction(actionType, stateBelief, interventionLedger = [], config = {}) {
  if (!contextualRealizationEnabled(config)) return textForAction(actionType);
  const variants = CONTEXTUAL_TEMPLATES[actionType];
  if (!variants) return textForAction(actionType);
  const dominant = dominantHypothesis(stateBelief);
  const repeated = hasRecentSameAction(actionType, interventionLedger);
  if (!repeated) return textForAction(actionType);
  return variants[dominant] || variants.default || textForAction(actionType);
}

function resistanceSignalForAction(selectedAction, stateBelief) {
  return (
    selectedAction?.adaptation_policy_layer?.learner_resistance?.observed_signal ||
    stateBelief?.policy_signals?.learner_resistance?.observed_signal ||
    null
  );
}

function requestEvidenceTextForAction(selectedAction, stateBelief, interventionLedger = [], config = {}) {
  const signal = resistanceSignalForAction(selectedAction, stateBelief);
  if (signal && RESISTANCE_REQUEST_EVIDENCE_TEMPLATES[signal]) {
    return RESISTANCE_REQUEST_EVIDENCE_TEMPLATES[signal];
  }
  return contextualTextForAction('request_evidence', stateBelief, interventionLedger, config);
}

export function realizeTutorUtterance({ selectedAction, stateBelief, interventionLedger = [], config = {} } = {}) {
  const text =
    selectedAction?.action_type === 'request_evidence'
      ? requestEvidenceTextForAction(selectedAction, stateBelief, interventionLedger, config)
      : contextualTextForAction(selectedAction?.action_type, stateBelief, interventionLedger, config);
  return {
    version: REALIZATION_VERIFIER_VERSION,
    action_type: selectedAction?.action_type || null,
    text,
  };
}

function typedStagedFollowupEnabled(config = {}) {
  return config.typedStagedFollowup === true || config.typed_staged_followup === true;
}

export function realizeStagedFollowup({ pendingIntervention, config = {} } = {}) {
  const missing = pendingIntervention?.staged_closure?.missing_required_evidence || [];
  const axes = pendingIntervention?.staged_closure?.missing_evidence_axes || [];
  const axisPrompt = typedStagedFollowupEnabled(config)
    ? axes.map((axis) => MISSING_EVIDENCE_AXIS_FOLLOWUPS[axis]).find(Boolean)
    : null;
  if (axisPrompt) {
    return {
      version: REALIZATION_VERIFIER_VERSION,
      action_type: pendingIntervention?.action_type || null,
      text: axisPrompt,
      missing_required_evidence: missing,
      missing_evidence_axes: axes,
    };
  }
  const targets = missing.map((label) => MISSING_EVIDENCE_FOLLOWUPS[label] || label).slice(0, 2);
  const prompt = targets.length
    ? `One part is still missing: ${targets.join(' and ')}. What is your answer to that missing piece?`
    : 'One part is still missing. What evidence can you add in your own words?';
  return {
    version: REALIZATION_VERIFIER_VERSION,
    action_type: pendingIntervention?.action_type || null,
    text: prompt,
    missing_required_evidence: missing,
    missing_evidence_axes: axes,
  };
}

function forbiddenMoveDetected(text = '') {
  return /\b(the answer is|therefore the correct answer|so the solution is|you should simply|just write)\b/iu.test(
    text,
  );
}

function decisiveStepEmbedded(text = '') {
  return /\b(isn'?t it because|which means you should|so you can see that)\b/iu.test(text);
}

function actionConsistent(actionType, text = '') {
  const lower = text.toLowerCase();
  switch (actionType) {
    case 'observe_no_intervention':
      return /won'?t add|will not add|stay out|carry out|continue with/u.test(lower) && /own/u.test(lower);
    case 'diagnose_with_discriminating_question':
      return (
        /\?/u.test(text) &&
        /possibil|missing|notation|task|confidence|diagnos|defend|evidence|uncertainty|symbol/u.test(lower)
      );
    case 'request_evidence':
      return /evidence|justif|why|because|own words/u.test(lower) && /\?/u.test(text);
    case 'ask_strategy_choice':
      return /choose|strategy|rather|next move|bounded test|one move/u.test(lower) && /\?/u.test(text);
    case 'elicit_prediction':
      return /predict|expect/u.test(lower) && /\?/u.test(text);
    case 'reanchor_goal':
      return /task goal|goal|task/u.test(lower);
    case 'minimal_hint':
    case 'fade_hint':
      return /hint|cue|small/u.test(lower);
    case 'lower_cognitive_load':
      return /reduce the load|one piece|single concept|whole apparatus/u.test(lower) && /\?/u.test(text);
    case 'explain_principle':
    case 'model_worked_example':
      return /principle|example|apply|transfer/u.test(lower);
    case 'name_the_disagreement':
      return /disagreement|dispute|relation|evidence/u.test(lower) && /\?/u.test(text);
    case 'acknowledge_and_redirect':
      return /hear|shutdown|lower the load|small part|work from there|still the main signal|hold onto/u.test(lower);
    case 'repair_misrecognition':
      return /misread|asking about|not the one|corrected question/u.test(lower);
    case 'mirror_and_extend':
      return /advanced|mirror|extend|follows/u.test(lower) && /\?/u.test(text);
    case 'withhold_answer':
      return (
        /not going to give the answer|answer withheld|not giving the answer|attempt first|bounded attempt|what move/u.test(
          lower,
        ) && /\?/u.test(text)
      );
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
    premature_validation_detected:
      /\b(correct|right)\b/iu.test(tutorText) && !/what|why|which|how|\?/iu.test(tutorText),
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
