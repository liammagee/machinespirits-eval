import crypto from 'node:crypto';

export const RESISTANT_LEARNER_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-observation.v1';

export const RESISTANT_LEARNER_OBSERVATION_TYPES = Object.freeze([
  'bored_effort_withholding',
  'frame_jurisdiction_dispute',
]);

const BORED_EXPLICIT_PATTERNS = Object.freeze([
  /\b(?:bored|boring|dull|deadening|not interested)\b/iu,
  /\b(?:do not|don't) care\b/iu,
]);

const BORED_FLAT_PATTERNS = Object.freeze([
  /^\s*(?:fine|sure|right|okay|ok|whatever|as you like|if you say so)(?:\b|[.,!])/iu,
  /\b(?:are we done|can we (?:skip|finish|move on)|what(?:'s| is) left)\b/iu,
]);

const PERMISSION_SEEKING_PATTERNS = Object.freeze([
  /\b(?:is it (?:okay|ok)|may i|am i allowed|do you want me to|should i)\b/iu,
  /\bif that is what you (?:want|mean)\b/iu,
]);

const FRAME_JURISDICTION_PATTERNS = Object.freeze([
  /\bi (?:do not|don't) accept (?:the |this |your )?(?:premise|frame|framing|question|exercise|rules?)\b/iu,
  /\bi reject (?:the |this |your )?(?:premise|frame|framing|question|exercise|rules?)\b/iu,
  /\byou (?:do not|don't) get to (?:set|define|decide|choose) (?:the |this |my |our )?(?:frame|question|exercise|rules?|test|task)\b/iu,
  /\bwho (?:says|gave you the right to) (?:set|define|decide|choose) (?:the |this |my |our )?(?:frame|question|exercise|rules?|test|task)\b/iu,
  /\bwhy should i (?:accept|answer|play along with|submit to) (?:the |this |your )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\byour (?:test|question|exercise|task) assumes (?:the |that |this )/iu,
  /\bthe question is (?:loaded|rigged|not yours to ask)\b/iu,
  /\bthat is not your call\b/iu,
]);

const CONTENT_BEARING_MOVES = Object.freeze(
  new Set(['hypothesis', 'inference', 'evidence_adoption', 'metacognitive_reflection']),
);
const CONTENT_BEARING_EVIDENCE = Object.freeze(
  new Set(['cites_public_evidence', 'links_evidence_to_rule', 'revises_from_evidence']),
);

function sourceHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function firstEvidence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function classifierTurn(classification) {
  return classification?.turn || classification || {};
}

function contentBearing(classification) {
  const turn = classifierTurn(classification);
  return CONTENT_BEARING_MOVES.has(turn.discourse_move) || CONTENT_BEARING_EVIDENCE.has(turn.evidence_use);
}

function observation(type, evidenceSpan, text, features) {
  return {
    schema: RESISTANT_LEARNER_OBSERVATION_SCHEMA,
    type,
    evidence_span: evidenceSpan,
    source_text_sha256: sourceHash(text),
    features,
  };
}

export function observeResistantLearnerTurn({ learnerText = '', classification = null } = {}) {
  const text = String(learnerText || '').trim();
  const observations = [];
  const defeated = [];
  if (!text) {
    return {
      schema: RESISTANT_LEARNER_OBSERVATION_SCHEMA,
      observations,
      defeated,
      ambiguous: false,
    };
  }

  const permissionEvidence = firstEvidence(text, PERMISSION_SEEKING_PATTERNS);
  const boredEvidence = firstEvidence(text, BORED_EXPLICIT_PATTERNS) || firstEvidence(text, BORED_FLAT_PATTERNS);
  if (boredEvidence) {
    const defeatReasons = [];
    if (permissionEvidence) defeatReasons.push('permission_seeking');
    if (contentBearing(classification)) defeatReasons.push('content_bearing_contribution');
    if (defeatReasons.length) {
      defeated.push({
        type: 'bored_effort_withholding',
        evidence_span: boredEvidence,
        reasons: defeatReasons,
      });
    } else {
      const turn = classifierTurn(classification);
      observations.push(
        observation('bored_effort_withholding', boredEvidence, text, {
          effort: 'withheld',
          compliance: 'letter_only_or_clock_watching',
          permission_seeking: false,
          content_bearing: false,
          classifier_request_type: turn.request_type || null,
        }),
      );
    }
  }

  const frameEvidence = firstEvidence(text, FRAME_JURISDICTION_PATTERNS);
  if (frameEvidence) {
    const turn = classifierTurn(classification);
    observations.push(
      observation('frame_jurisdiction_dispute', frameEvidence, text, {
        target: 'inquiry_frame_or_tutor_standing',
        jurisdictional: true,
        classifier_request_type: turn.request_type || null,
        classifier_discourse_move: turn.discourse_move || null,
      }),
    );
  }

  return {
    schema: RESISTANT_LEARNER_OBSERVATION_SCHEMA,
    observations,
    defeated,
    ambiguous: observations.length > 1,
  };
}

export function resistantLearnerObservationMarkers(input = {}) {
  const result = observeResistantLearnerTurn(input);
  return {
    boredWithholding: result.observations.some((row) => row.type === 'bored_effort_withholding'),
    frameJurisdictionDispute: result.observations.some((row) => row.type === 'frame_jurisdiction_dispute'),
  };
}
