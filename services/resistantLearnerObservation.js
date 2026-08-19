import crypto from 'node:crypto';

export const RESISTANT_LEARNER_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-observation.v1';

export const RESISTANT_LEARNER_OBSERVATION_TYPES = Object.freeze([
  'bored_effort_withholding',
  'frame_jurisdiction_dispute',
  'frame_jurisdiction_refusal',
]);

const BORED_EXPLICIT_PATTERNS = Object.freeze([
  /\b(?:bored|boring|dull|deadening|not interested)\b/iu,
  /\b(?:do not|don't) care\b/iu,
]);

const BORED_FLAT_PATTERNS = Object.freeze([
  /^\s*(?:fine|sure|right|okay|ok|whatever|as you like|if you say so)(?:\b|[.,!])/iu,
  /(?:^|[.!?]\s+)(?:fine|sure|right|okay|ok|whatever|as you like|if you say so)[.!]?\s*$/iu,
  /\b(?:are we done|can we (?:skip|finish|move on)|what(?:'s| is) left)\b/iu,
]);

const SUBSTANTIVE_EXPANSION_PATTERNS = Object.freeze([
  /\b(?:because|therefore|thus|hence)\b/iu,
  /\b(?:which|that|this)\s+(?:means|shows|proves|establishes)\b/iu,
  /\bso\s+(?:we|i)\s+(?:can|should|know|conclude)\b/iu,
  /\bif\b.{0,100}\bthen\b/iu,
]);

const ADJACENT_HOOK_PATTERNS = Object.freeze([
  /\?/u,
  /\b(?:answer|attend to|check|choose|compare|examine|identify|mark|name|record|say|state|test|write)\b/iu,
]);

const PERMISSION_SEEKING_PATTERNS = Object.freeze([
  /\b(?:is it (?:okay|ok)|may i|am i allowed|do you want me to|should i)\b/iu,
  /\bif that is what you (?:want|mean)\b/iu,
]);

const FRAME_JURISDICTION_PATTERNS = Object.freeze([
  /\bi (?:do not|don't) accept (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?)\b/iu,
  /\bi (?:do not|don't) accept (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi (?:do not|don't) accept your (?:fixing|setting|defining|choosing) (?:the |this |that )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi (?:do not|don't) concede (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi reject (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi reject (?:the )?jurisdiction of (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi dispute (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi dispute (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\byou (?:do not|don't) get to (?:set|define|decide|choose|fix) (?:the |this |my |our )?(?:frame|question|exercise|rules?|test|task)\b/iu,
  /\byou (?:do not|don't) get to (?:set|define|decide|choose|fix|make|declare|treat|impose)\b.{0,120}\b(?:as\s+)?(?:the\s+)?(?:governing|controlling|decisive)\s+(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\byou (?:do not|don't) get to (?:set|define|decide|choose|fix|make|declare|treat|impose|install)\b.{0,120}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bwho (?:says|gave you the right to) (?:set|define|decide|choose) (?:the |this |my |our )?(?:frame|question|exercise|rules?|test|task)\b/iu,
  /\bwhy should i (?:accept|answer|play along with|submit to) (?:the |this |your )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bbut not under (?:the |this |that |your |a )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi (?:will not|won't)\b.{0,80}\bunder (?:the |this |that |your |a )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
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

function wordCount(text) {
  return String(text || '').match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length || 0;
}

function hasAdjacentHook(tutorText) {
  const text = String(tutorText || '').trim();
  return Boolean(text && ADJACENT_HOOK_PATTERNS.some((pattern) => pattern.test(text)));
}

function minimalFlatCompliance(text, flatEvidence) {
  if (!flatEvidence || wordCount(text) > 18) return false;
  if (SUBSTANTIVE_EXPANSION_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (/\?/u.test(text) && !BORED_FLAT_PATTERNS[2].test(text)) return false;
  return true;
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

export function observeResistantLearnerTurn({ learnerText = '', classification = null, tutorText = '' } = {}) {
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
  const explicitBoredEvidence = firstEvidence(text, BORED_EXPLICIT_PATTERNS);
  const flatBoredEvidence = firstEvidence(text, BORED_FLAT_PATTERNS);
  const boredEvidence = explicitBoredEvidence || flatBoredEvidence;
  if (boredEvidence) {
    const carriesContent = contentBearing(classification);
    const minimalFlatReply = minimalFlatCompliance(text, flatBoredEvidence);
    const adjacentHookPresent = hasAdjacentHook(tutorText);
    const defeatReasons = [];
    if (permissionEvidence) defeatReasons.push('permission_seeking');
    if (carriesContent && !minimalFlatReply) defeatReasons.push('content_bearing_contribution');
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
          compliance: minimalFlatReply && adjacentHookPresent ? 'adjacent_hook_only' : 'letter_only_or_clock_watching',
          permission_seeking: false,
          content_bearing: carriesContent,
          minimal_flat_reply: minimalFlatReply,
          adjacent_hook_present: adjacentHookPresent,
          unprompted_expansion: false,
          classifier_request_type: turn.request_type || null,
        }),
      );
    }
  }

  const frameEvidence = firstEvidence(text, FRAME_JURISDICTION_PATTERNS);
  if (frameEvidence) {
    const turn = classifierTurn(classification);
    const carriesContent = contentBearing(classification);
    observations.push(
      observation('frame_jurisdiction_dispute', frameEvidence, text, {
        target: 'inquiry_frame_or_tutor_standing',
        jurisdictional: true,
        content_bearing: carriesContent,
        classifier_request_type: turn.request_type || null,
        classifier_discourse_move: turn.discourse_move || null,
      }),
    );
    if (!carriesContent) {
      observations.push(
        observation('frame_jurisdiction_refusal', frameEvidence, text, {
          target: 'inquiry_frame_or_tutor_standing',
          jurisdictional: true,
          local_test_or_evidence_withheld: true,
          content_bearing: false,
          classifier_request_type: turn.request_type || null,
          classifier_discourse_move: turn.discourse_move || null,
        }),
      );
    }
  }

  const hasBoredObservation = observations.some((row) => row.type === 'bored_effort_withholding');
  const hasFrameObservation = observations.some((row) => row.type.startsWith('frame_jurisdiction_'));

  return {
    schema: RESISTANT_LEARNER_OBSERVATION_SCHEMA,
    observations,
    defeated,
    ambiguous: hasBoredObservation && hasFrameObservation,
  };
}

export function resistantLearnerObservationMarkers(input = {}) {
  const result = observeResistantLearnerTurn(input);
  return {
    boredWithholding: result.observations.some((row) => row.type === 'bored_effort_withholding'),
    frameJurisdictionDispute: result.observations.some((row) => row.type === 'frame_jurisdiction_dispute'),
    frameJurisdictionRefusal: result.observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
  };
}
