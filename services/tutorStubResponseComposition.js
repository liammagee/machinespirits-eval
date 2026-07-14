export const TUTOR_STUB_RESPONSE_COMPOSITION_SCHEMA = 'machinespirits.tutor-stub.response-composition.v1';
export const TUTOR_STUB_RESPONSE_COMPOSITION_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.response-composition-audit.v1';

const ACKNOWLEDGEMENT_PATTERN =
  /^(?:yes|right|exactly|fair|good|correct|almost|not quite|no\b|i (?:hear|see|agree|understand)|you(?:[’']re| are)|that(?:[’']s| is)|your\b)/iu;
const DEVELOPMENT_LEAD_PATTERN =
  /^(?:i(?:[’']m| am) (?:going to|bringing|showing|opening|putting)|i(?:[’']ll| will) (?:bring|show|open|put|read|take)|let(?:[’']s| us) (?:role-play|bring|look|open|put|step)|step (?:up|over)|now (?:we|i)|the next (?:clue|piece|exhibit|record)|here(?:[’']s| is) (?:the|another|our) next)/iu;
const DEVELOPMENT_BOUNDARY_PATTERN =
  /\b(?:i(?:[’']m| am) (?:going to|bringing|showing|opening|putting)|i(?:[’']ll| will) (?:bring|show|open|put|read|take)|let(?:[’']s| us) (?:role-play|bring|look|open|put|step)|step (?:up|over)|the next (?:clue|piece|exhibit|record)|here(?:[’']s| is) (?:the|another|our) next)\b/iu;
const LEARNER_RESPONSIVE_ACTION_FAMILIES = new Set([
  'answer_accountably',
  'receive_vulnerability',
  'challenge_resistance',
]);
const CONTENT_STOP_WORDS = new Set(
  'about after again also another because before being between could does doing from have into just more most much nothing only other over same should some such than that their them then there these they this those through under very what when where which while with would your youre'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function publicTokenSet(value) {
  return new Set(
    (oneLine(value).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [])
      .map((token) => token.replace(/[’']/gu, ''))
      .filter((token) => !CONTENT_STOP_WORDS.has(token)),
  );
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
} = {}) {
  const configuration = registerSelection?.response_configuration || registerSelection || {};
  const move = learnerMove(classification);
  const dag = learnerDagSnapshot(tutorLearnerDag);
  const closurePhase = dialogueClosureFrame?.phase || 'open';
  const actionFamily = configuration.action_family || registerSelection?.action_family || null;
  const actionTarget = LEARNER_RESPONSIVE_ACTION_FAMILIES.has(actionFamily) ? 'uptake' : 'development';
  return {
    schema: TUTOR_STUB_RESPONSE_COMPOSITION_SCHEMA,
    active: Boolean(oneLine(learnerText)),
    delivery: {
      atomic_assistant_turn: true,
      public_history_messages: 1,
      display_beats: 2,
    },
    learner_move: move,
    learner_dag: dag,
    selected_action_family: actionFamily,
    action_target: actionTarget,
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
        'Only after uptake, perform the selected next action: advance the public reasoning, stage the due clue, clarify, or close as the current state requires.',
    },
    shared_realization: {
      engagement_stance: configuration.engagement_stance || registerSelection?.engagement_stance || null,
      audience_register: configuration.audience_register || registerSelection?.audience_register || null,
      lexical_accessibility: configuration.lexical_accessibility || registerSelection?.lexical_accessibility || null,
      scene_immersion: configuration.scene_immersion || registerSelection?.scene_immersion || null,
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
  return [
    '[Tutor-only response composition]',
    'Write one atomic assistant turn with two visibly separated public beats. Put one blank line between them.',
    `1. Respond: directly take up the learner’s contribution before moving on.${
      uptake.action_family ? ` Realize the selected action family here: ${uptake.action_family}.` : ''
    }`,
    move.summary ? `Public learner move to take up: ${move.summary}` : null,
    move.pedagogical_need ? `Immediate public-facing need: ${move.pedagogical_need}` : null,
    learnerAdvance?.supported_move_count
      ? `The learner has already made ${learnerAdvance.supported_move_count} supported move${
          learnerAdvance.supported_move_count === 1 ? '' : 's'
        } in this turn. Credit them; do not ask for them again.`
      : null,
    `2. Develop: ${development.instruction}${
      development.action_family ? ` Realize the selected action family here: ${development.action_family}.` : ''
    }`,
    development.expected_dag_move ? `Private next-reasoning aim: ${development.expected_dag_move}` : null,
    development.expected_interaction_move
      ? `Private interaction aim: ${development.expected_interaction_move}`
      : null,
    development.clue_release_required
      ? 'A clue is due in the development beat. Keep the response beat before the clue handoff; do not let the release erase or replace it.'
      : null,
    development.kind === 'dialogue_closure'
      ? 'The development beat is a natural close, not another proof demand.'
      : null,
    'The selected engagement stance, audience level, language accessibility, and scene immersion govern both beats. Do not name either beat, this composition, or any private machinery in public speech.',
    'These two beats are one tutor turn and one public assistant message. Do not emit JSON, headings, labels, or commentary around them.',
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
      formatted: `${uptake}\n\n${development}`,
    };
  }

  const normalized = oneLine(source);
  if (DEVELOPMENT_LEAD_PATTERN.test(normalized)) {
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
        formatted: `${uptake}\n\n${development}`,
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
      formatted: `${uptake}\n\n${development}`,
    };
  }

  if (frame?.development?.kind === 'dialogue_closure' && !DEVELOPMENT_LEAD_PATTERN.test(normalized)) {
    return {
      uptake: normalized,
      development: normalized,
      method: 'compressed_closure',
      formatted: normalized,
    };
  }

  return DEVELOPMENT_LEAD_PATTERN.test(normalized)
    ? { uptake: '', development: normalized, method: 'development_only', formatted: normalized }
    : { uptake: normalized, development: '', method: 'uptake_only', formatted: normalized };
}

function uptakeRespondsToLearner(uptake, frame) {
  const surface = oneLine(uptake);
  if (!surface) return false;
  if (ACKNOWLEDGEMENT_PATTERN.test(surface)) return true;
  const uptakeTokens = publicTokenSet(surface);
  const learnerTokens = publicTokenSet(frame?.learner_text || '');
  const summaryTokens = publicTokenSet(frame?.learner_move?.summary || '');
  return [...new Set([...learnerTokens, ...summaryTokens])].some((token) => uptakeTokens.has(token));
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
  const segments = segmentTutorStubResponse({ text, frame: enrichedFrame });
  const issues = [];
  if (!segments.uptake) {
    issues.push({
      type: 'missing_learner_uptake',
      reason: 'advances the lesson before responding to the learner’s actual contribution',
    });
  } else if (!uptakeRespondsToLearner(segments.uptake, enrichedFrame)) {
    issues.push({
      type: 'generic_learner_uptake',
      reason: 'opens with a generic transition rather than visibly taking up the learner’s contribution',
    });
  }
  if (!segments.development) {
    issues.push({
      type: 'missing_tutor_development',
      reason: 'responds to the learner but does not develop, clarify, advance, or close the inquiry',
    });
  }
  return {
    schema: TUTOR_STUB_RESPONSE_COMPOSITION_AUDIT_SCHEMA,
    ok: issues.length === 0,
    active: true,
    atomic_assistant_turn: true,
    action_family: frame.selected_action_family || null,
    action_target: frame.action_target || null,
    development_kind: frame.development?.kind || null,
    expected_dag_move: frame.development?.expected_dag_move || null,
    issues,
    segments,
  };
}

export function deterministicTutorStubLearnerUptake({ learnerText = '', classification = null, actionFamily = null } = {}) {
  const text = oneLine(learnerText).toLowerCase();
  const requestType = classification?.turn?.request_type || null;
  if (/\b(?:doesn[’']?t|does not|didn[’']?t|did not)\s+prov|\bsuspect\b|\bnot enough\b/iu.test(text)) {
    return 'You’re right to separate suspicion from proof.';
  }
  if (/\b(?:boring|move (?:it|this) along|speed (?:it|this) up|faster)\b/iu.test(text)) {
    return 'Fair—we can move this along without pretending the missing evidence is already settled.';
  }
  if (/\b(?:what (?:is|does|are)|means?|don[’']?t understand|confus)/iu.test(text)) {
    return 'That needs a clear answer before we move on.';
  }
  if (/\?/u.test(learnerText) || ['conceptual_clarity_request', 'stepwise_support_request'].includes(requestType)) {
    return 'That is a fair question; I’ll answer it before we extend the case.';
  }
  if (requestType === 'authority_refusal_or_status_challenge' || actionFamily === 'answer_accountably') {
    return 'You’re right to ask what the evidence actually licenses.';
  }
  if (requestType === 'vulnerability_or_moral_exposure' || actionFamily === 'receive_vulnerability') {
    return 'I hear the concern, and it should shape how we proceed.';
  }
  if (requestType === 'resistance_or_low_agency' || actionFamily === 'challenge_resistance') {
    return 'Fair—the current route is not giving you enough to work with.';
  }
  if (requestType === 'answer_seeking_or_overreach') {
    return 'That is a possible conclusion, but the public evidence does not settle it yet.';
  }
  return 'That gives us a concrete contribution to carry forward.';
}

export function formatTutorStubResponseComposition(audit = null) {
  return audit?.segments?.formatted || '';
}
