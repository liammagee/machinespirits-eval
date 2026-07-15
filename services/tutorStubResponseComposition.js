import { auditTutorStubConversationalCompletionResponse } from './tutorStubConversationalCompletion.js';

export const TUTOR_STUB_RESPONSE_COMPOSITION_SCHEMA = 'machinespirits.tutor-stub.response-composition.v1';
export const TUTOR_STUB_RESPONSE_COMPOSITION_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.response-composition-audit.v1';

const ACKNOWLEDGEMENT_PATTERN =
  /^(?:yes|right|exactly|precisely|just so|fair|good|correct|almost|too fast|not so fast|not quite|no\b|thou hast it\b|i (?:hear|see|agree|understand)|you(?:[’']re| are)|that(?:[’']s| is)|your\b)/iu;
const STOCK_TRANSITION_PATTERN =
  /^(?:(?:right—)?that gives us (?:a )?(?:concrete contribution|sound place) to (?:begin|carry forward)|right—that gives us a sound place to begin|i (?:keep|carry) your contribution\b)/iu;
const DEICTIC_UPTAKE_PATTERN =
  /^(?:i|we)\b[^.!?]{0,35}\b(?:accept|carry|enter|hold|keep|mark|note|record|take|write)\b[^.!?]{0,20}\b(?:it|that|this|those|these|your)\b/iu;
const DEICTIC_EVIDENCE_REFERENCE_PATTERN =
  /\b(?:these|those|your)\s+(?:answer|claim|distinction|marks?|observation|point|reading|words?)\b/iu;
const DIRECT_QUESTION_ANSWER_PATTERN =
  /^(?:(?:i|we)\s+(?:can|cannot|can[’']t|do|do not|don[’']t|will|will not|won[’']t|would|would not|wouldn[’']t)|the (?:useful|needed) (?:mark|match) (?:is|would))\b/iu;
const EVIDENTIARY_WITHHOLDING_UPTAKE_PATTERN =
  /\b(?:leave|keep)\b[^.!?]{0,35}\b(?:entry|line|record)\b[^.!?]{0,20}\b(?:blank|open|unentered|unwritten)\b|\b(?:do not|don[’']t|will not|won[’']t)\b[^.!?]{0,25}\b(?:enter|record|write)\b/iu;
const LEARNER_WITHHOLDS_JUDGMENT_PATTERN =
  /\b(?:before (?:entering|recording|writing)|cannot yet|can[’']t yet|hold|not until|wait for|will wait|without .* (?:cannot|can[’']t))\b/iu;
const LEARNER_PROPOSES_EXAMINATION_PATTERN =
  /\b(?:(?:i (?:would|will)|let us|we (?:should|will)|(?:can|could|may|shall|should|would) (?:i|we))\b[^.!?]{0,100}\b(?:assay|behold|compare|examine|inspect|look at|mark|press|see|test|weigh)|(?:have|get)\b[^.!?]{0,60}\b(?:assayed|compared|examined|inspected|tested|weighed))\b/iu;
const COMPLETED_MOVE_UPTAKE_PATTERN =
  /\b(?:completed (?:evidentiary )?(?:distinction|inference|step)|that inference stands|settles? the (?:point|question)|now established|has been established)\b/iu;
const LEARNER_CONDITIONAL_INFERENCE_PATTERN =
  /^if\b[^.!?]{0,180}\b(?:would|was|were|is|are|ties?|establish(?:es|ed)?)\b/iu;
const CONDITIONAL_DISMISSAL_UPTAKE_PATTERN =
  /\b(?:possible conclusion|public evidence (?:does not|doesn[’']t) settle it yet)\b/iu;
const CONDITIONAL_ACKNOWLEDGEMENT_PATTERN =
  /\b(?:if|assuming|on that condition|under that condition|given that condition)\b/iu;
const TOOL_MARK_PATH_PATTERN =
  /\b(?:maker[’']s mark|maker mark|die[- ]?mark|die[- ]?flaw|graver|tool[- ]?mark)\b/iu;
const TOOL_MARK_SELECTION_PATTERN =
  /\b(?:assay|compare|examine|find|inspect|look for|match|seek|test|watch for)\b[^.!?]{0,110}\b(?:maker[’']s mark|maker mark|die[- ]?mark|die[- ]?flaw|graver|tool[- ]?mark)\b|\b(?:maker[’']s mark|maker mark|die[- ]?mark|die[- ]?flaw|graver|tool[- ]?mark)\b[^.!?]{0,110}\b(?:assay|compare|examine|find|inspect|match(?:ed|es|ing)?|need(?:ed|s)?|seek|test|watch)\b|\b(?:before|first|until)\b[^.!?]{0,110}\b(?:maker[’']s mark|maker mark|die[- ]?mark|die[- ]?flaw|graver|tool[- ]?mark)\b/iu;
const TOOL_MARK_ACKNOWLEDGEMENT_PATTERN =
  /\b(?:maker[’']s mark|maker mark|die|flaw|graver|mark|nick|burr|stroke|tool)\b/iu;
const DEVELOPMENT_LEAD_PATTERN =
  /^(?:i(?:[’']m| am) (?:going to|bringing|showing|opening|putting)|i(?:[’']ll| will) (?:bring|show|open|put|read|take)|let(?:[’']s| us) (?:role-play|bring|look|open|put|step)|step (?:up|over)|now (?:we|i)|the next (?:clue|piece|exhibit|record)|here(?:[’']s| is) (?:the|another|our) next)/iu;
const DIRECT_SCENE_DEVELOPMENT_LEAD_PATTERN =
  /^(?:i (?:lay|set|place|slide|hold|open|unfold|read|point|tap|trace|circle|slap|snap|strike|test|weigh)\b|i\b[^.!?]{0,70}\b(?:across|against|along|atop|beside|beneath|into|onto|over|through|under)\b|[\p{Lu}][\p{L}\p{N}'’ -]{1,64},\s*[^.!?:“"']{1,120}:|[\p{Lu}][\p{L}\p{N}'’ -]{1,64}:\s*[“"'])/iu;
const DEVELOPMENT_BOUNDARY_PATTERN =
  /\b(?:i(?:[’']m| am) (?:going to|bringing|showing|opening|putting)|i(?:[’']ll| will) (?:bring|show|open|put|read|take)|let(?:[’']s| us) (?:role-play|bring|look|open|put|step)|step (?:up|over)|the next (?:clue|piece|exhibit|record)|here(?:[’']s| is) (?:the|another|our) next)\b/iu;
const SCENE_ACTION_PATTERN =
  /\bi\s+(?:flatten|lay|mark|open|place|set|slide|tap|underline|unfold)\b/iu;
const LEARNER_RESPONSIVE_ACTION_FAMILIES = new Set([
  'answer_accountably',
  'receive_vulnerability',
  'challenge_resistance',
]);
const CONTENT_STOP_WORDS = new Set(
  'about after again also another because before being between could did does doing from have into just more most much nothing only other over same should some such than that the their them then there these they this those through under very what when where which while with would your youre'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function tutorStubLearnerSelectedToolMarkPath(value = '') {
  const source = oneLine(value);
  return TOOL_MARK_PATH_PATTERN.test(source) && TOOL_MARK_SELECTION_PATTERN.test(source);
}

export function composeTutorStubFallbackWithUptake({ text = '', uptake = '' } = {}) {
  const opening = oneLine(uptake);
  let remainder = oneLine(text);
  if (!opening) return remainder;
  while (remainder === opening || remainder.startsWith(`${opening} `)) {
    remainder = remainder.slice(opening.length).trimStart();
  }
  return [opening, remainder].filter(Boolean).join(' ');
}

function developmentLeadVisible(value) {
  return DEVELOPMENT_LEAD_PATTERN.test(value) || DIRECT_SCENE_DEVELOPMENT_LEAD_PATTERN.test(value);
}

function publicTokenSet(value) {
  return new Set(
    (oneLine(value).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [])
      .map((token) => token.replace(/[’']s$/u, '').replace(/[’']/gu, ''))
      .filter((token) => !CONTENT_STOP_WORDS.has(token)),
  );
}

function substantiveLearnerEcho(uptake, learnerText) {
  const uptakeSurface = oneLine(uptake).toLowerCase().replace(/[.!?]+$/gu, '');
  const learnerSurface = oneLine(learnerText).toLowerCase().replace(/[.!?]+$/gu, '');
  const learnerTokens = publicTokenSet(learnerSurface);
  if (learnerTokens.size < 6) return false;
  if (learnerSurface.length >= 30 && uptakeSurface.includes(learnerSurface)) return true;
  const uptakeTokens = publicTokenSet(uptakeSurface);
  const overlap = [...learnerTokens].filter((token) => uptakeTokens.has(token)).length;
  const learnerCoverage = overlap / learnerTokens.size;
  const addedTokens = [...uptakeTokens].filter((token) => !learnerTokens.has(token)).length;
  return learnerCoverage >= 0.85 && addedTokens <= 4;
}

function learnerMove(classification = null) {
  const turn = classification?.turn || {};
  return {
    summary: oneLine(turn.summary) || null,
    request_type: turn.request_type || null,
    discourse_move: turn.discourse_move || null,
    evidence_use: turn.evidence_use || null,
    epistemic_stance: turn.epistemic_stance || null,
    pedagogical_need: oneLine(turn.pedagogical_need) || null,
  };
}

function learnerDagSnapshot(tutorLearnerDag = null) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || {};
  const assessment = model.assessment || {};
  const advance = tutorLearnerDag?.advance || model.learnerAdvance || null;
  return {
    status: assessment.status || null,
    bottleneck: assessment.bottleneck || null,
    best_path_coverage: Number.isFinite(Number(assessment.bestPathCoverage))
      ? Number(assessment.bestPathCoverage)
      : null,
    grounded_count: Number(model.metrics?.groundedCount || 0),
    missing_premise_count: Number(assessment.missingPremiseCount || 0),
    final_secret_entailed: assessment.finalSecretEntailed === true,
    asserted_secret: assessment.assertedSecret === true,
    learner_advance: advance
      ? {
          pace: advance.pace || null,
          accelerated: advance.accelerated === true,
          supported_move_count: Number(advance.supportedMoveCount || 0),
          adopted_premise_count: Number(advance.adoptedPremiseCount || 0),
          derived_fact_count: Number(advance.derivedFactCount || 0),
        }
      : null,
  };
}

export function buildTutorStubResponseCompositionFrame({
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  dramaticReleaseFrame = null,
  dialogueClosureFrame = null,
  conversationalCompletion = null,
  recentTutorTexts = [],
} = {}) {
  const configuration = registerSelection?.response_configuration || registerSelection || {};
  const move = learnerMove(classification);
  const dag = learnerDagSnapshot(tutorLearnerDag);
  const closurePhase = dialogueClosureFrame?.phase || 'open';
  const actionFamily = configuration.action_family || registerSelection?.action_family || null;
  const actionTarget = LEARNER_RESPONSIVE_ACTION_FAMILIES.has(actionFamily) ? 'uptake' : 'development';
  const completion = conversationalCompletion || tutorLearnerDag?.conversationalCompletion || null;
  const recentSceneActionCount = (Array.isArray(recentTutorTexts) ? recentTutorTexts : [])
    .slice(-4)
    .filter((text) => SCENE_ACTION_PATTERN.test(oneLine(text))).length;
  return {
    schema: TUTOR_STUB_RESPONSE_COMPOSITION_SCHEMA,
    active: Boolean(oneLine(learnerText)),
    delivery: {
      atomic_assistant_turn: true,
      public_history_messages: 1,
      internal_functions: 2,
      display_beats: 1,
      public_shape: 'continuous_performance',
    },
    learner_move: move,
    learner_dag: dag,
    selected_action_family: actionFamily,
    action_target: actionTarget,
    conversational_completion: completion,
    due_evidence_surfaces: (dramaticReleaseFrame?.entries || [])
      .map((entry) => oneLine(entry?.surface))
      .filter(Boolean),
    scene_action_budget: {
      recent_scene_action_count: recentSceneActionCount,
      saturated: recentSceneActionCount >= 2,
    },
    uptake: {
      required: true,
      action_family: actionTarget === 'uptake' ? actionFamily : null,
      instruction:
        'Respond to the learner’s actual contribution first: credit, answer, qualify, correct, or receive it without reopening an accepted reasoning step.',
    },
    development: {
      required: true,
      action_family: actionTarget === 'development' ? actionFamily : null,
      kind: dialogueClosureFrame?.mandatory
        ? 'dialogue_closure'
        : dramaticReleaseFrame?.active
          ? 'dramatic_clue_release'
          : 'pedagogical_continuation',
      expected_dag_move: registerSelection?.expected_dag_move || null,
      expected_interaction_move: registerSelection?.expected_field_move || null,
      clue_release_required: dramaticReleaseFrame?.active === true,
      closure_phase: closurePhase,
      instruction:
        `Without announcing a switch, continue through the selected part${configuration.actorial_part_label ? ` (${configuration.actorial_part_label})` : ''} and perform the next action: advance the public reasoning, stage the due clue, clarify, or close as the current state requires.`,
    },
    shared_realization: {
      engagement_stance: configuration.engagement_stance || registerSelection?.engagement_stance || null,
      audience_register: configuration.audience_register || registerSelection?.audience_register || null,
      lexical_accessibility: configuration.lexical_accessibility || registerSelection?.lexical_accessibility || null,
      scene_immersion: configuration.scene_immersion || registerSelection?.scene_immersion || null,
      actorial_part: configuration.actorial_part || registerSelection?.actorial_part || null,
      actorial_part_label: configuration.actorial_part_label || registerSelection?.actorial_part_label || null,
      evidence_enactment: configuration.evidence_enactment || null,
    },
  };
}

export function tutorStubResponseCompositionPrompt(frame = null) {
  if (!frame?.active) return '';
  const move = frame.learner_move || {};
  const dag = frame.learner_dag || {};
  const uptake = frame.uptake || {};
  const development = frame.development || {};
  const learnerAdvance = dag.learner_advance || null;
  const completion = frame.conversational_completion || null;
  return [
    '[Tutor-only response composition]',
    'Write one atomic assistant turn as one continuous public performance. It has two internal functions, but it must not look or sound like two stitched-together replies.',
    `1. Respond: directly take up the learner’s contribution.${
      uptake.action_family ? ` Realize the selected action family here: ${uptake.action_family}.` : ''
    }`,
    move.summary ? `Public learner move to take up: ${move.summary}` : null,
    move.pedagogical_need ? `Immediate public-facing need: ${move.pedagogical_need}` : null,
    learnerAdvance?.supported_move_count
      ? `The learner has already made ${learnerAdvance.supported_move_count} supported move${
          learnerAdvance.supported_move_count === 1 ? '' : 's'
        } in this turn. Credit them; do not ask for them again.`
      : null,
    completion?.resolved
      ? `Conversational completion: the learner has ${completion.status} the immediately preceding local question. Accepted meaning: ${completion.acceptedMeaning || completion.learnerSurface}. Credit or qualify that meaning once. Do not restate it as another test, ask for endorsement, or reopen it in safer words.`
      : null,
    `2. Continue: ${development.instruction}${
      development.action_family ? ` Realize the selected action family here: ${development.action_family}.` : ''
    }`,
    development.expected_dag_move ? `Private next-reasoning aim: ${development.expected_dag_move}` : null,
    development.expected_interaction_move
      ? `Private interaction aim: ${development.expected_interaction_move}`
      : null,
    development.clue_release_required
      ? 'A clue is due. Let the response flow directly into the clue performance; do not let the release erase the learner uptake or create an announced change of role.'
      : null,
    completion?.requiresNewPressure
      ? 'The continuation must create genuinely new pressure: stage the due public clue if one is supplied, or ask about a materially new implication. A paraphrase of the completed distinction is not forward movement.'
      : null,
    frame.scene_action_budget?.saturated
      ? 'Recent turns have already used repeated exhibit-handling gestures. Unless a new physical exhibit genuinely requires handling, express the selected character through judgment, address, rhythm, and word choice rather than another “I lay/slide/open/mark” gesture.'
      : null,
    development.kind === 'dialogue_closure'
      ? 'The development beat is a natural close, not another proof demand.'
      : null,
    `The selected engagement stance, audience level, language accessibility, and scene immersion govern the whole utterance. The actorial host part (${frame.shared_realization?.actorial_part_label || frame.shared_realization?.actorial_part || 'selected public part'}) carries the whole reply without a role label, stage direction, or change into a second tutor voice. If a clue source is supplied, enact that source inside the host's continuous reply; it does not replace the host. Do not name either function, this composition, or any private machinery in public speech.`,
    'Keep the public wording inside the scene. Do not call the reasoning a branch, premise, node, condition, rule, path, proof step, or DAG; name the actual coin, mark, tool, person, record, or action instead.',
    'Use one paragraph. Join uptake and continuation with ordinary sentence-level flow—not a blank line, arrow, heading, speaker label, or theatrical aside. Do not emit JSON or commentary around the reply.',
    '[End tutor-only response composition]',
  ]
    .filter(Boolean)
    .join('\n');
}

function firstSentenceBoundary(source) {
  const match = source.match(/^[\s\S]*?[.!?](?:[”"'’])?(?=\s|$)/u);
  return match ? match[0].length : -1;
}

export function segmentTutorStubResponse({ text = '', frame = null } = {}) {
  const source = String(text || '').trim();
  if (!source) return { uptake: '', development: '', method: 'empty', formatted: '' };

  const paragraphs = source
    .split(/\n\s*\n/gu)
    .map((part) => oneLine(part))
    .filter(Boolean);
  if (paragraphs.length >= 2) {
    const uptake = paragraphs[0];
    const development = paragraphs.slice(1).join(' ');
    return {
      uptake,
      development,
      method: 'authored_paragraphs',
      formatted: `${uptake} ${development}`,
    };
  }

  const normalized = oneLine(source);
  if (developmentLeadVisible(normalized)) {
    return { uptake: '', development: normalized, method: 'development_only', formatted: normalized };
  }
  const cue = frame?.development?.clue_release_required ? normalized.match(DEVELOPMENT_BOUNDARY_PATTERN) : null;
  if (cue && Number(cue.index) > 0) {
    const uptake = normalized.slice(0, cue.index).trim();
    const development = normalized.slice(cue.index).trim();
    if (uptake && development) {
      return {
        uptake,
        development,
        method: 'development_cue',
        formatted: `${uptake} ${development}`,
      };
    }
  }

  const boundary = firstSentenceBoundary(normalized);
  if (boundary > 0 && boundary < normalized.length) {
    const uptake = normalized.slice(0, boundary).trim();
    const development = normalized.slice(boundary).trim();
    return {
      uptake,
      development,
      method: 'first_sentence',
      formatted: `${uptake} ${development}`,
    };
  }

  if (frame?.development?.kind === 'dialogue_closure' && !developmentLeadVisible(normalized)) {
    return {
      uptake: normalized,
      development: normalized,
      method: 'compressed_closure',
      formatted: normalized,
    };
  }

  return developmentLeadVisible(normalized)
    ? { uptake: '', development: normalized, method: 'development_only', formatted: normalized }
    : { uptake: normalized, development: '', method: 'uptake_only', formatted: normalized };
}

function uptakeRespondsToLearner(uptake, frame) {
  const surface = oneLine(uptake);
  if (!surface) return false;
  if (STOCK_TRANSITION_PATTERN.test(surface)) return false;
  if (
    ACKNOWLEDGEMENT_PATTERN.test(surface) ||
    /\brightly entered\b/iu.test(surface) ||
    DEICTIC_UPTAKE_PATTERN.test(surface) ||
    DEICTIC_EVIDENCE_REFERENCE_PATTERN.test(surface) ||
    (/\?/u.test(String(frame?.learner_text || '')) && DIRECT_QUESTION_ANSWER_PATTERN.test(surface))
  )
    return true;
  const uptakeTokens = publicTokenSet(surface);
  const learnerTokens = publicTokenSet(frame?.learner_text || '');
  const summaryTokens = publicTokenSet(frame?.learner_move?.summary || '');
  return [...new Set([...learnerTokens, ...summaryTokens])].some((token) => uptakeTokens.has(token));
}

function fusedOpeningRespondsToLearner(uptake, frame, minimumOverlap = 3) {
  const surface = oneLine(uptake);
  if (!surface) return false;
  if (
    /\b(?:wise|right|rightly|fair|exactly|precisely|just so|good|your point|your question|you propose|you suggest)\b/iu.test(
      surface,
    ) ||
    DEICTIC_UPTAKE_PATTERN.test(surface) ||
    DEICTIC_EVIDENCE_REFERENCE_PATTERN.test(surface)
  ) {
    return true;
  }
  if (
    EVIDENTIARY_WITHHOLDING_UPTAKE_PATTERN.test(surface) &&
    LEARNER_WITHHOLDS_JUDGMENT_PATTERN.test(oneLine(frame?.learner_text || ''))
  ) {
    return true;
  }
  const learnerSurface = oneLine(frame?.learner_text || '');
  if (
    LEARNER_PROPOSES_EXAMINATION_PATTERN.test(learnerSurface) &&
    /\b(?:i|we)\b[^.!?]{0,90}\b(?:assay|compare|comparison|draw|examine|inspect|mark|press|rub|set|test|weigh)\b/iu.test(
      surface,
    ) &&
    [...publicTokenSet(learnerSurface)].some((token) => publicTokenSet(surface).has(token))
  ) {
    return true;
  }
  if (
    /\?/u.test(learnerSurface) &&
    /\b(?:account|book|custody|entry|evidence|ledger|log|record)\b/iu.test(learnerSurface) &&
    /\bi\b[^.!?]{0,45}\b(?:open|read|turn|unfold)\b[^.!?]{0,45}\b(?:account|book|entry|ledger|log|record)\b/iu.test(
      surface,
    )
  ) {
    return true;
  }
  const uptakeTokens = publicTokenSet(surface);
  const learnerTokens = new Set([
    ...publicTokenSet(frame?.learner_text || ''),
    ...publicTokenSet(frame?.learner_move?.summary || ''),
  ]);
  let overlap = 0;
  for (const token of learnerTokens) if (uptakeTokens.has(token)) overlap += 1;
  return overlap >= minimumOverlap;
}

export function auditTutorStubResponseComposition({ text = '', frame = null, learnerText = '' } = {}) {
  if (!frame?.active) {
    return {
      schema: TUTOR_STUB_RESPONSE_COMPOSITION_AUDIT_SCHEMA,
      ok: true,
      active: false,
      issues: [],
      segments: { uptake: '', development: '', method: 'inactive', formatted: oneLine(text) },
    };
  }
  const enrichedFrame = { ...frame, learner_text: learnerText };
  let segments = segmentTutorStubResponse({ text, frame: enrichedFrame });
  if (!segments.uptake && segments.development && segments.method === 'development_only') {
    const boundary = firstSentenceBoundary(segments.development);
    let fusedOpening = boundary > 0 ? segments.development.slice(0, boundary).trim() : '';
    let fused = fusedOpeningRespondsToLearner(fusedOpening, enrichedFrame);
    if (!fused && boundary > 0 && boundary < segments.development.length) {
      const remainder = segments.development.slice(boundary).trim();
      const secondBoundary = firstSentenceBoundary(remainder);
      const secondSentence = secondBoundary > 0 ? remainder.slice(0, secondBoundary).trim() : '';
      const twoSentenceOpening = [fusedOpening, secondSentence].filter(Boolean).join(' ');
      const secondSentenceResponsive =
        ACKNOWLEDGEMENT_PATTERN.test(secondSentence) ||
        /\b(?:ruled out|not yet|did not|didn[’']t|does not|doesn[’']t|(?:have|has|had|can|could|will|would) not|(?:haven|hasn|hadn|can|couldn|won|wouldn)[’']t|cannot|not enough|rather than)\b/iu.test(
          secondSentence,
        );
      if (
        secondSentence &&
        secondSentenceResponsive &&
        fusedOpeningRespondsToLearner(twoSentenceOpening, enrichedFrame, 2)
      ) {
        fusedOpening = twoSentenceOpening;
        fused = true;
      }
    }
    if (fused) {
      segments = {
        ...segments,
        uptake: fusedOpening,
        method: 'fused_opening',
        formatted: oneLine(text),
      };
    }
  }
  const issues = [];
  if (!segments.uptake) {
    issues.push({
      type: 'missing_learner_uptake',
      reason: 'advances the lesson before responding to the learner’s actual contribution',
    });
  } else if (segments.method !== 'fused_opening' && !uptakeRespondsToLearner(segments.uptake, enrichedFrame)) {
    issues.push({
      type: 'generic_learner_uptake',
      reason: 'opens with a generic transition rather than visibly taking up the learner’s contribution',
    });
  }
  if (segments.uptake && substantiveLearnerEcho(segments.uptake, learnerText)) {
    issues.push({
      type: 'verbatim_learner_echo',
      reason: 'repeats the learner’s substantive wording instead of crediting or developing it concisely',
    });
  }
  if (
    segments.uptake &&
    LEARNER_PROPOSES_EXAMINATION_PATTERN.test(oneLine(learnerText)) &&
    COMPLETED_MOVE_UPTAKE_PATTERN.test(segments.uptake)
  ) {
    issues.push({
      type: 'proposed_move_misread_as_completed',
      reason: 'describes the learner’s proposed examination as though its evidentiary result were already established',
    });
  }
  if (
    segments.uptake &&
    LEARNER_CONDITIONAL_INFERENCE_PATTERN.test(oneLine(learnerText)) &&
    CONDITIONAL_DISMISSAL_UPTAKE_PATTERN.test(segments.uptake) &&
    !CONDITIONAL_ACKNOWLEDGEMENT_PATTERN.test(segments.uptake)
  ) {
    issues.push({
      type: 'conditional_answer_misread_as_present_claim',
      reason: 'treats the learner’s conditional answer as though they had asserted that the condition already holds',
    });
  }
  if (
    segments.uptake &&
    tutorStubLearnerSelectedToolMarkPath(learnerText) &&
    !TOOL_MARK_ACKNOWLEDGEMENT_PATTERN.test(oneLine(text))
  ) {
    issues.push({
      type: 'learner_selected_test_not_acknowledged',
      reason: 'develops a different evidence path without carrying forward the learner’s selected tool-mark examination',
    });
  }
  if (!segments.development) {
    issues.push({
      type: 'missing_tutor_development',
      reason: 'responds to the learner but does not develop, clarify, advance, or close the inquiry',
    });
  }
  const completionAudit = auditTutorStubConversationalCompletionResponse({
    text,
    completion: frame.conversational_completion,
    learnerText,
    dueEvidenceSurfaces: frame.due_evidence_surfaces || [],
  });
  issues.push(...completionAudit.issues);
  return {
    schema: TUTOR_STUB_RESPONSE_COMPOSITION_AUDIT_SCHEMA,
    ok: issues.length === 0,
    active: true,
    atomic_assistant_turn: true,
    action_family: frame.selected_action_family || null,
    action_target: frame.action_target || null,
    development_kind: frame.development?.kind || null,
    expected_dag_move: frame.development?.expected_dag_move || null,
    conversational_completion: completionAudit,
    issues,
    segments,
  };
}

export function deterministicTutorStubLearnerUptake({
  learnerText = '',
  classification = null,
  actionFamily = null,
  recentTutorTexts = [],
  world = null,
} = {}) {
  const text = oneLine(learnerText).toLowerCase();
  const worldText = oneLine(
    `${world?.id || ''} ${world?.title || ''} ${world?.discipline || ''} ${world?.question || ''} ${world?.setting || ''}`,
  ).toLowerCase();
  const requestType = classification?.turn?.request_type || null;
  const discourseMove = classification?.turn?.discourse_move || null;
  const classificationText = oneLine(
    `${classification?.turn?.summary || ''} ${classification?.turn?.pedagogical_need || ''}`,
  ).toLowerCase();
  const recent = (Array.isArray(recentTutorTexts) ? recentTutorTexts : [])
    .slice(-10)
    .map((value) => oneLine(value).toLowerCase());
  const fresh = (...candidates) =>
    candidates.find((candidate) => !recent.some((previous) => previous.startsWith(oneLine(candidate).toLowerCase()))) ||
    candidates[0];
  const proposesToolMarkTest =
    /\b(?:compare|examine|find|inspect|look for|match(?:es|ed|ing)?|seek|trace)\b[^.!?]{0,70}\b(?:die|flaw|graver|maker[’']s mark|maker mark|tool-mark|tool mark)\b|\btest\b[^.!?]{0,20}\b(?:die|flaw|graver|maker[’']s mark|maker mark|tool-mark|tool mark)\b|\b(?:die|flaw|graver|maker[’']s mark|maker mark|tool-mark|tool mark)\b[^.!?]{0,50}\b(?:compare|examine|find|inspect|match(?:es|ed|ing)?|test|trace)\b/iu.test(
      text,
    );
  if (
    /\?/u.test(learnerText) &&
    /\b(?:light|lightness|weight)\b/iu.test(text) &&
    /\b(?:clip(?:ped|ping)?|metal)\b/iu.test(text)
  ) {
    return fresh(
      'Yes—start there: the balance and touchstone can distinguish clipped true coin from a newly struck blank made of poor metal.',
      'Yes—that is the first assay question: was true silver clipped away, or was a lighter debased coin struck anew?',
    );
  }
  if (
    /\b(?:leave|set|put)\b[^.!?]{0,45}\b(?:old\s+)?clipping\b[^.!?]{0,35}\b(?:aside|behind|out)\b/iu.test(text) &&
    /\b(?:die|mark|metal)\b/iu.test(text)
  ) {
    return fresh(
      'You have set the old clipping charge aside and kept the metal and die marks as the tests that can supply a specific link.',
      'Old clipping stays out of the trial-book; the metal and die marks must provide the specific link instead.',
    );
  }
  if (
    TOOL_MARK_PATH_PATTERN.test(text) &&
    /\b(?:graver|tool)\b[^.!?]{0,45}\b(?:struck|strike)\b/iu.test(text)
  ) {
    return fresh(
      'You have chosen a useful die-mark, but the graver cuts the die; it does not strike the shilling itself.',
      'Keep the repeated die-mark as your test, with one correction: it can identify a die-cutting tool, not the striking hand by itself.',
    );
  }
  if (
    TOOL_MARK_PATH_PATTERN.test(text) &&
    /\b(?:but|does not|doesn[’']t|not yet|unproved)\b/iu.test(text) &&
    /\b(?:hand|strike|striking|struck)\b/iu.test(text)
  ) {
    return fresh(
      'You have kept the graver tied to die-cutting without treating it as proof of the striking hand.',
      'That keeps the graver’s possible work on the die separate from proof of who struck the shillings.',
    );
  }
  if (
    proposesToolMarkTest &&
    /\b(?:before|could|must|need(?:ed|s)?|should|would)\b/iu.test(text) &&
    /\b(?:blank|crucible)\b/iu.test(`${text} ${classificationText}`)
  ) {
    return fresh(
      'You have named a coin-specific die-mark test, but it tests striking rather than which crucible supplied the blank.',
      'That die-mark test belongs to the striking path; the blank still needs its own crucible link.',
    );
  }
  if (
    /\b(?:doesn[’']?t|does not|didn[’']?t|did not)\s+prov|\bsuspect\b|\bnot (?:yet )?proof\b|\bnot enough\b/iu.test(
      text,
    )
  ) {
    return fresh('You’re right to separate suspicion from proof.', 'That keeps suspicion from hardening into a verdict.');
  }
  if (
    /\b(?:access|licen[cs]e|means|ownership)\b/iu.test(text) &&
    /\b(?:mistak(?:e|ing)|proof|prove)\b/iu.test(text)
  ) {
    return fresh(
      'You have separated access from proof that this hand made the coin.',
      'That correctly keeps possession or access from becoming proof of making.',
    );
  }
  if (
    /\b(?:access|control(?:led)?|drew|drawing|signed)\b/iu.test(text) &&
    /\bcrucible\b/iu.test(text) &&
    /\b(?:does not|doesn[’']t|not yet)\b[^.!?]{0,70}\b(?:show|prove)?\b[^.!?]{0,35}\b(?:struck|striking)\b/iu.test(text)
  ) {
    return fresh(
      /\bedony\b/iu.test(text)
        ? 'You have separated Edony’s control of the weir crucible from proof that she struck the coins.'
        : 'You have separated control of the crucible from proof that its keeper struck the coins.',
      'The crucible record identifies its keeper, not yet the hand that struck the shillings.',
    );
  }
  if (
    /\b(?:light|false) shillings?\b/iu.test(text) &&
    /\b(?:true|genuine) (?:coin|shillings?)\b/iu.test(text) &&
    /\b(?:balance|compare|differ|examin(?:e|ed|ing)?|touchstone|weigh)\b/iu.test(text)
  ) {
    return fresh(
      'You have chosen the coins themselves first: compare the light shilling with a true one by balance and touchstone.',
      'We begin with your coin-to-coin test—the light shilling against a true one, weighed and touched.',
    );
  }
  if (
    /\b(?:blank|coin|shilling)\b/iu.test(text) &&
    /\bcast\b/iu.test(text) &&
    /\bstruck\b/iu.test(text) &&
    /\b(?:neither|not|unshown|unproved)\b/iu.test(text)
  ) {
    return fresh(
      'You have left both hands unnamed: who cast the blank, and who struck it into coin.',
      'The trial-book still lacks two hands—the caster of the blank and the striker of the shilling.',
    );
  }
  if (
    /\bblank\b/iu.test(text) &&
    /\bcast\b[^.!?]{0,55}\b(?:from|at)\b[^.!?]{0,45}\bcrucible\b|\bcrucible\b[^.!?]{0,55}\bcast\b/iu.test(text) &&
    /\b(?:does not|doesn[’']t|not yet|without)\b[^.!?]{0,75}\b(?:hand|strike|striking|struck)\b/iu.test(text)
  ) {
    return fresh(
      'You have fixed the blank’s source at the weir-forge crucible while leaving its caster and striker to the remaining record.',
      'The blank now leads to the weir-forge crucible; that still does not name the hand that cast or struck it.',
    );
  }
  if (
    /\bcrucible\b/iu.test(text) &&
    /\b(?:die|graver|tool)\b/iu.test(text) &&
    /\b(?:graver|tool)\b[^.!?]{0,55}\band\b[^.!?]{0,55}\bcrucible\b[^.!?]{0,55}\b(?:assay|compare|examin(?:ation|e|ed|ing)?|inspect(?:ion|ed|ing)?|mark)\b|\bcrucible\b[^.!?]{0,55}\band\b[^.!?]{0,55}\b(?:die|graver|tool)\b[^.!?]{0,55}\b(?:assay|compare|examin(?:ation|e|ed|ing)?|inspect(?:ion|ed|ing)?|mark)\b/iu.test(
      text,
    )
  ) {
    return fresh(
      'You have selected both exhibits: I will test the crucible first and keep the graver beside it for its own comparison.',
      'Both choices stay on the bench: the crucible for the metal, and the graver for the mark it may have cut.',
    );
  }
  if (
    /\b(?:remain(?:s|ed)? unshown|not (?:yet )?shown|still unshown)\b/iu.test(text) &&
    /\b(?:coins?|shillings?)\b/iu.test(text) &&
    /\b(?:cast|crucible|marrick)\b/iu.test(text) &&
    /\b(?:hand|struck|striking|verrell)\b/iu.test(text)
  ) {
    return fresh(
      'You have kept both gaps open: these shillings are not yet tied to Marrick’s crucible, and no striking hand is proved.',
      'The trial-book still has two blanks: the source metal is unproved, and so is the hand that struck the coins.',
    );
  }
  if (
    LEARNER_CONDITIONAL_INFERENCE_PATTERN.test(text) &&
    /\b(?:blank|coin|shilling)\b/iu.test(text) &&
    /\bcrucible\b/iu.test(text) &&
    /\bcast\b/iu.test(text)
  ) {
    return fresh(
      'Yes—if that metal match is established, the blank’s casting is tied to the sole hand at that crucible.',
      'Under that condition, the casting inference follows; only the metal match itself remains to be tested.',
    );
  }
  if (/\b(?:boring|move (?:it|this) along|speed (?:it|this) up|faster)\b/iu.test(text)) {
    return fresh(
      'Fair—we can move this along without pretending the missing evidence is already settled.',
      'Agreed—we will quicken the evidence without skipping its limit.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    /\b(?:choose|decide|phrase|tell me|show me)\b/iu.test(text) &&
    /\b(?:enter|entry|examine|first|phrase|record|register|say|write)\b/iu.test(text)
  ) {
    const recordNoun = text.match(/\b(?:account|book|entry|ledger|log|record|register|roll)\b/iu)?.[0];
    return fresh(
      recordNoun
        ? 'I’ll choose the first concrete ' + recordNoun + ' entry for you before we extend the case.'
        : 'I’ll choose the first concrete point for you before we extend the case.',
      'I’ll answer that choice directly, then carry only the next public step.',
    );
  }
  if (
    /\b(?:alloy|metal|touchstone|weigh|weight)\b/iu.test(text) &&
    /\b(?:die|graver|tools?)\b/iu.test(text) &&
    /\b(?:assay|compare|examine|inspect|test)\b/iu.test(text)
  ) {
    return fresh(
      'Your plan keeps the blank’s metal test separate from the die’s tool-mark comparison.',
      'You have proposed both necessary examinations: assay the blank’s metal, then compare the die marks.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    (/\bwhat public matter\b/iu.test(text) ||
      /\bwhat\b[^?]{0,70}\b(?:enter|examine|inspect|test)\b[^?]{0,20}\bfirst\b/iu.test(text))
  ) {
    if (/\b(?:marrick|shilling|assay)\b/iu.test(worldText)) {
      return fresh(
        'Begin with the shillings themselves: record their weight, ring, and touchstone mark before any person’s name.',
        'First enter what the coins themselves show—their weight, ring, and metal—without naming a hand.',
      );
    }
    return fresh(
      'Begin with the public exhibit itself: record only what can be seen or tested before naming anyone.',
      'First enter the observable public evidence, leaving every person’s name open.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    /\b(?:can|could|may|shall|should|would)\s+(?:i|we)\b[^?]{0,70}\b(?:assay|begin|behold|compare|examine|inspect|look at|see|start|test|weigh)\b/iu.test(text)
  ) {
    return fresh(
      'Yes—begin with that public examination; it can establish what the exhibit shows without naming a hand.',
      'Yes—that is a sound first test, provided we record its result without turning it into a verdict.',
    );
  }
  if (
    LEARNER_PROPOSES_EXAMINATION_PATTERN.test(text) &&
    /\b(?:before|without)\b[^.!?]{0,55}\b(?:accus|conclud|hand|nam(?:e|ing)|verdict)\b/iu.test(text)
  ) {
    return fresh(
      'You have set the right order: examine the public exhibit before entering any hand.',
      'Your plan begins with the evidence itself and leaves every name open until the test speaks.',
    );
  }
  if (
    /\bclip(?:ped|ping)?\b/iu.test(text) &&
    /\b(?:debased|dross|made anew|newly|struck|true (?:coin|shillings?))\b/iu.test(text)
  ) {
    return fresh(
      'You have separated newly struck dross from clipped true coin.',
      'That correctly rules out clipping: this is newly made debased coin.',
    );
  }
  if (
    /\bcrucible\b/iu.test(text) &&
    (/\b(?:custody|control(?:led)?|holder|keeper)\b/iu.test(text) ||
      /\bwho\b[^.!?]{0,45}\b(?:drew|held|signed|used)\b/iu.test(text))
  ) {
    return fresh(
      'You have identified the remaining blank question: who alone controlled that source crucible.',
      'The source crucible is established; its sole custodian is the fact still missing.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    /\bcupell?(?:ed|ing)?\b/iu.test(text) &&
    /\b(?:alloy|composition|crucible|leavings|metal|residue|streak)\b/iu.test(text)
  ) {
    return fresh(
      'Cupelling is not the point by itself: the assay must show the same distinctive copper-and-lead composition; a look-alike streak alone is too weak.',
      'The leavings need a material comparison, not merely a similar-looking streak—their distinctive copper and lead must agree with the shilling.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    /\b(?:alloy|crucible|leavings|metal|residue|streak)\b/iu.test(text) &&
    /\b(?:link(?:s|ed)?|match(?:es|ed)?|same|show(?:s|ed)?|tie(?:s|d)?|trace(?:s|d)?|what|which)\b/iu.test(text)
  ) {
    return fresh(
      'The needed match is a distinctive agreement between the shilling’s metal and one crucible’s leavings—not merely that both are poor alloy.',
      'We would need the shilling’s streak and one crucible’s residue to share a distinctive composition that the other melts do not.',
    );
  }
  if (
    /\?/u.test(learnerText) &&
    /\b(?:die|flaw|graver|mark|tool)\b/iu.test(text) &&
    /\b(?:compare(?:s|d)?|link(?:s|ed)?|match(?:es|ed)?|show(?:s|ed)?|tie(?:s|d)?|trace(?:s|d)?|what|which)\b/iu.test(text)
  ) {
    return fresh(
      'The useful mark would be a repeated nick, burr, or crooked stroke on the coins that can be compared with one die-cutting tool.',
      'We would look for the same distinctive flaw across the struck faces, then test whether one graver could have cut it.',
    );
  }
  if (requestType === 'stepwise_support_request' && proposesToolMarkTest) {
    return fresh(
      'That is the right tool-mark test; I’ll keep it in view while the next public evidence enters.',
      'Your proposed die test stays open while this new evidence settles a different part of the coin’s making.',
    );
  }
  if (
    /\b(?:die|graver|tool)\b/iu.test(text) &&
    /\bfail(?:s|ed|ing)?\b[^.!?]{0,55}\b(?:connect|link|mark|match|tie)\b[^.!?]{0,55}\b(?:coin|shilling)s?\b/iu.test(
      text,
    )
  ) {
    return fresh(
      'You have kept both the graver and any die it cut unconnected from these shillings.',
      'That leaves the graver and its possible die-work publicly unlinked to these coins.',
    );
  }
  if (
    /\b(?:corvat|g17|incubator|larkin)\b/iu.test(text) &&
    /\b(?:exposure|likely|possible|risk|source)\b/iu.test(text) &&
    /\b(?:but|need|still|unproved|unshown|without|yet)\b/iu.test(text) &&
    /\b(?:booking|contact|custody|entered|inside|placement|placed|presence)\b/iu.test(text)
  ) {
    return fresh(
      'You have identified Larkin as a plausible G17 exposure source while keeping Corvat’s presence there unproved.',
      'You have separated Larkin’s G17 risk from the still-missing evidence that Corvat was placed inside it.',
    );
  }
  if (
    /\b(?:blanks?|coins?|shillings?)\b/iu.test(text) &&
    /\b(?:leave|leaves|left|keep|keeps|kept|remain|remains|remained)\b[^.!?]{0,65}\b(?:open|unassigned|unplaced|unproved|untraced)\b|\b(?:open|unassigned|unplaced|unproved|untraced)\b[^.!?]{0,65}\b(?:blanks?|coins?|shillings?)\b/iu.test(
      text,
    ) &&
    /\b(?:alloy|crucible|leavings|match|metal|residue|streak)\b/iu.test(text)
  ) {
    return fresh(
      'You have kept the blanks unplaced until the mint-yard leavings match their alloy.',
      'You have left the blanks unassigned while their metal still awaits a matching crucible residue.',
    );
  }
  if (/\b(?:but|cannot|can[’']t|missing|must|no|not|only|until|yet)\b/iu.test(text)) {
    if (/\b(?:die|flaw|graver|tool-mark|tool mark)\b/iu.test(text)) {
      return fresh(
        'You have kept the graver tied to its owner without pretending it has marked this coin.',
        'That leaves the tool publicly owned but its work on these shillings still unproved.',
      );
    }
    if (/\b(?:alloy|crucible|leavings|metal|residue|streak)\b/iu.test(text)) {
      return fresh(
        'You have kept the alloy link provisional until one crucible’s leavings answer it.',
        'That leaves the metal observed but its source crucible still unproved.',
        'The metal is now described, while the crucible that supplied it remains open.',
        'We can carry the alloy result without assigning it to any crucible yet.',
      );
    }
  }
  if (
    LEARNER_PROPOSES_EXAMINATION_PATTERN.test(text) &&
    /\b(?:alloy|crucible|leavings|metal|residue|streak)\b/iu.test(text)
  ) {
    return fresh(
      'Your proposed first test is clear: compare the coin’s metal with the crucible leavings.',
      'We will begin with your metal test and let its result determine what can follow.',
    );
  }
  if (
    !/\?/u.test(learnerText) &&
    /\b(?:alloy|crucible|leavings|metal|residue|streak)\b/iu.test(text) &&
    /\b(?:match(?:es|ed|ing)?|same|tie(?:s|d)?|trace-metal|trace metal)\b/iu.test(text)
  ) {
    return fresh(
      'That names the needed comparison: a distinctive trace-metal match between the blank and one crucible.',
      'You have specified what would make the metal probative—a distinctive match to one crucible’s leavings.',
      'The test is now concrete: the blank and the crucible must share a metal signature not found in the other melts.',
    );
  }
  if (
    /\blook about (?:the )?hall\b/iu.test(text) &&
    /\b(?:coins?|trial-book|witness)\b/iu.test(text)
  ) {
    return fresh(
      'We will begin with the first public coin or witness the hall can supply.',
      'Your search starts with what the hall can place openly before the trial-book.',
    );
  }
  if (/\bno proof\b/iu.test(text) && /\bassay\b/iu.test(text)) {
    return fresh(
      'Agreed—no name enters the trial-book before the assay has something to show.',
      'The trial-book stays nameless until the assay gives us a public mark.',
    );
  }
  const explicitComprehensionRequest =
    /\b(?:don[’']?t understand|confus(?:ed|ing|ion))\b/iu.test(text) ||
    (/\?/u.test(learnerText) && /\b(?:what (?:is|does|are)|what does [^?]{0,50} mean)\b/iu.test(text));
  if (explicitComprehensionRequest) {
    return fresh('That needs a clear answer before we move on.', 'Let me make that plain before the case advances.');
  }
  if (
    /\?/u.test(learnerText) ||
    (requestType === 'conceptual_clarity_request' && discourseMove === 'question')
  ) {
    return fresh(
      'That is a fair question; I’ll answer it before we extend the case.',
      'I’ll answer that directly before bringing in anything new.',
    );
  }
  if (discourseMove === 'evidence_adoption') {
    const adoptedRecord = text.match(
      /\b(?:badge log|call log|incident log|visitor log|version history|ledger|log|notebook|notice|record|report|swab)\b/iu,
    )?.[0];
    if (adoptedRecord) {
      return fresh(
        `You have kept the ${adoptedRecord} in the public record without claiming more than it shows.`,
        `Your ${adoptedRecord} entry now stays with us as evidence, not as a verdict.`,
      );
    }
  }
  if (requestType === 'stepwise_support_request') {
    if (proposesToolMarkTest) {
      return fresh(
        'That is the right tool-mark test; I’ll keep it in view while the next public evidence enters.',
        'Your proposed die test stays open while this new evidence settles a different part of the coin’s making.',
      );
    }
    if (/\b(?:but|cannot|can[’']t|missing|must|no|not|only|until|yet)\b/iu.test(text)) {
      if (/\b(?:die|flaw|graver|tool-mark|tool mark)\b/iu.test(text)) {
        return fresh(
          'You have kept the graver tied to its owner without pretending it has marked this coin.',
          'That leaves the tool publicly owned but its work on these shillings still unproved.',
        );
      }
      if (/\b(?:alloy|crucible|leavings|metal|residue|streak)\b/iu.test(text)) {
        return fresh(
          'You have kept the alloy link provisional until one crucible’s leavings answer it.',
          'That leaves the metal observed but its source crucible still unproved.',
          'The metal is now described, while the crucible that supplied it remains open.',
          'We can carry the alloy result without assigning it to any crucible yet.',
        );
      }
      return fresh(
        'I hear the limit; we will not claim more than you have shown.',
        'I’ll keep that restraint in the record and ask the next clue to earn more.',
        'I enter only that much; the next public fact must earn any stronger claim.',
        'We can carry that much forward without turning it into a verdict.',
      );
    }
    if (/\b(?:assay|compare|examine|inspect|test|touchstone|weigh)\b/iu.test(text)) {
      return fresh(
        'That is the right order: test the public evidence before naming a hand.',
        'Your proposed examination gives us the next concrete move without forcing a verdict.',
      );
    }
    if (['evidence_adoption', 'inference', 'metacognitive_reflection'].includes(discourseMove)) {
      return fresh(
        'I enter what you have established and leave the unanswered part open.',
        'That follows from what is public; the next evidence must build from it.',
      );
    }
    return fresh(
      'Your proposed move sets our next public check.',
      'We will test what you proposed against the next public evidence.',
    );
  }
  if (requestType === 'authority_refusal_or_status_challenge' || actionFamily === 'answer_accountably') {
    return fresh('You’re right to ask what the evidence actually licenses.', 'The record must answer that challenge, not my authority.');
  }
  if (requestType === 'vulnerability_or_moral_exposure' || actionFamily === 'receive_vulnerability') {
    return fresh('I hear the concern, and it should shape how we proceed.', 'That concern belongs in how we handle the next step.');
  }
  if (requestType === 'resistance_or_low_agency' || actionFamily === 'challenge_resistance') {
    return fresh('Fair—the current route is not giving you enough to work with.', 'Let’s lower the pressure and make the next move concrete.');
  }
  if (requestType === 'answer_seeking_or_overreach') {
    return fresh(
      'That is a possible conclusion, but the public evidence does not settle it yet.',
      'The conclusion is possible; the public record has not earned it yet.',
    );
  }
  return fresh(
    'I hear the point; the next public fact must answer it.',
    'I will carry that point forward without changing what you claimed.',
  );
}

function configuredFallbackObject({ world = null, learnerText = '', part = '' } = {}) {
  const source = oneLine(
    `${learnerText} ${world?.setting || ''} ${world?.openingFrame?.situation || ''} ${world?.question || ''}`,
  );
  const recordPattern =
    /\b(?:trial-book|visitor badge log|badge log|lost-property ledger|ledger|log|record|register|notebook|file)\b/iu;
  const exhibitPattern =
    /\b(?:shilling|coin|crucible|cupel|touchstone|balance|tool|sample|notice|report|photograph|photo|lunchbox)\b/iu;
  if (part === 'record_keeper') return source.match(recordPattern)?.[0] || 'record';
  return source.match(exhibitPattern)?.[0] || source.match(recordPattern)?.[0] || 'evidence before us';
}

function configuredFallbackHost({ part, object }) {
  return {
    scene_partner: `I set the ${object} between us so we can test the distinction together.`,
    examiner: `I set the ${object} under examination and mark the claim’s limit.`,
    record_keeper: `I enter that distinction in the ${object}.`,
    advocate: `I lay the ${object} against the town’s case; your limit is where it fails.`,
    skeptic: `Not so fast—I hold that claim against the ${object}.`,
    foreperson: `I keep that finding provisional in the ${object}.`,
  }[part] || `I set the ${object} under examination and mark the claim’s limit.`;
}

function configuredFallbackStance(stance) {
  return {
    plain: 'Keep only what the public evidence already shows.',
    precise: 'It supports the present step, not the conclusion beyond it.',
    brisk: 'Keep the live point and move to the next public check.',
    warm: 'We can carry that point forward without forcing the rest.',
    witnessing: 'Let the point stand without asking it to bear more.',
    charismatic: 'The room’s easy verdict breaks at that limit.',
    ironic: 'Apparently the neat conclusion still has a gap.',
    sarcastic: 'Conveniently, the easy conclusion skipped that gap.',
    face_threat: 'Stop at the weak link; the conclusion has not earned the rest.',
  }[stance] || 'Keep only what the public evidence already shows.';
}

function configuredFallbackHandoff({ support = null, actionFamily = null } = {}) {
  if (support?.clarificationInvitationRequired) {
    return 'Would you rather test that distinction against what is already public, hold it open for the next public fact, or ask me to clarify a word or connection?';
  }
  if (/bounded.*choice/u.test(String(support?.modality || ''))) {
    return 'Would you rather test that distinction against what is already public, or hold it open for the next public fact?';
  }
  if (support?.answerability === 'direction_only_until_evidence_is_public') {
    return 'Leave the stronger claim open until the next public fact arrives.';
  }
  if (actionFamily === 'close_inquiry') return 'That is enough to close the record without another demand.';
  return 'What does that let us carry forward?';
}

/**
 * Last-resort continuation for a non-release turn. Unlike the historical
 * question-support fallback, this does not rehearse the current clue, public
 * rule, or case question. It preserves learner uptake and realizes the
 * already-selected host and stance against a concrete public scene object.
 */
export function deterministicTutorStubConfiguredContinuationFallback({
  uptake = '',
  responseConfiguration = null,
  support = null,
  world = null,
  learnerText = '',
} = {}) {
  const stance = oneLine(responseConfiguration?.engagement_stance || 'plain');
  const part = oneLine(
    responseConfiguration?.actorial_host_part || responseConfiguration?.actorial_part || 'examiner',
  );
  const actionFamily = oneLine(responseConfiguration?.action_family || '');
  const object = configuredFallbackObject({ world, learnerText, part });
  const uptakeAlreadyPerformsRecordKeeper =
    part === 'record_keeper' &&
    (/(?:\b(?:i|we)\b[^.!?]{0,45}\b(?:enter|hold|keep|mark|note|record|write)\b[^.!?]{0,45}\b(?:book|ledger|log|record|trial-book)\b)/iu.test(
      uptake,
    ) ||
      /\b(?:i|we)\s+(?:enter|mark|note|record|write)\s+(?:that|this|it)\b/iu.test(uptake));
  return [
    oneLine(uptake),
    uptakeAlreadyPerformsRecordKeeper ? null : configuredFallbackHost({ part, object }),
    configuredFallbackStance(stance),
    configuredFallbackHandoff({ support, actionFamily }),
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatTutorStubResponseComposition(audit = null) {
  return audit?.segments?.formatted || '';
}
