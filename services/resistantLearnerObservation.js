import crypto from 'node:crypto';

export const RESISTANT_LEARNER_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-observation.v1';

export const RESISTANT_LEARNER_OBSERVATION_TYPES = Object.freeze([
  'bored_effort_withholding',
  'frame_jurisdiction_dispute',
]);

export const RESISTANT_LEARNER_AXIS_NAMES = Object.freeze([
  'effort_investment',
  'learner_authorship',
  'evidential_orientation',
  'epistemic_trust',
  'frame_legitimacy',
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

const TUTOR_CHOICE_DEFERENCE_PATTERNS = Object.freeze([
  /\b(?:is it (?:all right|okay|ok)|may i|am i allowed|do you want me to|would you like me to|should i|shall i)\b/iu,
  /\b(?:can|could|would|will) you (?:choose|pick|decide|tell me|have me)\b/iu,
  /\bwhat (?:would|do) you (?:want|have) me to\b/iu,
  /\bwhich\b.{0,80}\bwould you like me to\b/iu,
  /\bchoose (?:the )?(?:next|step|one|which)\b.{0,60}\bfor me\b/iu,
  /\bis (?:that|this) the (?:line|entry|claim|distinction|wording) you want\b/iu,
]);

const EVIDENTIAL_WARRANT_CHALLENGE_PATTERNS = Object.freeze([
  /\b(?:what|which)\b.{0,120}\b(?:evidence|test|mark|result|rule|warrant|observation|record)\b/iu,
  /\b(?:what|why|how)\b.{0,120}\b(?:show|support|establish|prove|connect|link|tie|follow|identify|count as|make .{0,40} enough)\b/iu,
  /\bwhat makes\b.{0,100}\b(?:follow|enough|establish|prove)\b/iu,
]);

const AUTHORITY_EPISTEMIC_DISTRUST_PATTERNS = Object.freeze([
  /\b(?:your|the tutor['’]s) (?:assumption|answer|claim)\b/iu,
  /\b(?:hidden evidence|smuggl(?:e|ed|ing)|answer-shaped framing)\b/iu,
  /\b(?:you are|you['’]re) (?:assuming|pushing me toward|steering me toward)\b/iu,
  /\b(?:the town|you) (?:merely|already) (?:assumes?|suspects?)\b/iu,
  /\brather than (?:merely )?(?:your|the town['’]s) (?:assumption|suspicion|verdict)\b/iu,
  /\bbeyond your framing\b/iu,
]);

const FRAME_JURISDICTION_PATTERNS = Object.freeze([
  /\bi (?:do not|don't) accept (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?)\b/iu,
  /\bi (?:do not|don't) accept (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi (?:do not|don't) accept your (?:fixing|setting|defining|choosing) (?:the |this |that )?(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi (?:do not|don't) concede (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi reject (?:the |this |that |your )?(?:premise|frame|framing|question|exercise|rules?)\b/iu,
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
  /\bi (?:will not|won't|do not|don't) accept\b.{0,120}\b(?:authority|standing|governing (?:frame|question|test)|frame you have not established)\b/iu,
  /\bi (?:do not|don't) accept\b.{0,120}\b(?:your framing|your frame|as authority)\b/iu,
  /\bnot under (?:your|the tutor['’]s) authority\b/iu,
  /\b(?:do not|don't|will not|won't) grant (?:it|that|this|your .{0,40}) authority\b/iu,
  /\byou (?:do not|don't) get to (?:make|require)\b.{0,140}\b(?:the measure of|decide|settle|answer|governing (?:link|measure|question|test))\b/iu,
  /\b(?:first )?establish why\b.{0,100}\b(?:standing|authority|govern|measure)\b/iu,
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

function axis(state = 'not_observed', evidenceSpan = null) {
  return { state, evidence_span: evidenceSpan };
}

function unobservedAxes() {
  return {
    effort_investment: axis(),
    learner_authorship: axis(),
    evidential_orientation: axis(),
    epistemic_trust: axis(),
    frame_legitimacy: axis(),
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
      axes: unobservedAxes(),
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
    observations.push(
      observation('frame_jurisdiction_dispute', frameEvidence, text, {
        target: 'inquiry_frame_or_tutor_standing',
        jurisdictional: true,
        classifier_request_type: turn.request_type || null,
        classifier_discourse_move: turn.discourse_move || null,
      }),
    );
  }
  const effortEvidence = observations.find((row) => row.type === 'bored_effort_withholding')?.evidence_span || null;
  const tutorChoiceEvidence = firstEvidence(text, TUTOR_CHOICE_DEFERENCE_PATTERNS);
  const warrantChallengeEvidence = /\?/u.test(text) ? firstEvidence(text, EVIDENTIAL_WARRANT_CHALLENGE_PATTERNS) : null;
  const authorityDistrustEvidence = firstEvidence(text, AUTHORITY_EPISTEMIC_DISTRUST_PATTERNS);
  const axes = {
    effort_investment: effortEvidence ? axis('withheld', effortEvidence) : axis(),
    learner_authorship: tutorChoiceEvidence ? axis('deferred_to_tutor', tutorChoiceEvidence) : axis(),
    evidential_orientation: warrantChallengeEvidence ? axis('warrant_challenged', warrantChallengeEvidence) : axis(),
    epistemic_trust: authorityDistrustEvidence ? axis('authority_distrusted', authorityDistrustEvidence) : axis(),
    frame_legitimacy: frameEvidence ? axis('jurisdiction_disputed', frameEvidence) : axis(),
  };

  return {
    schema: RESISTANT_LEARNER_OBSERVATION_SCHEMA,
    observations,
    defeated,
    ambiguous: observations.length > 1,
    axes,
  };
}

export function resistantLearnerObservationMarkers(input = {}) {
  const result = observeResistantLearnerTurn(input);
  return {
    boredWithholding: result.observations.some((row) => row.type === 'bored_effort_withholding'),
    effortWithholding: result.axes.effort_investment.state === 'withheld',
    tutorChoiceDeference: result.axes.learner_authorship.state === 'deferred_to_tutor',
    evidentialWarrantChallenge: result.axes.evidential_orientation.state === 'warrant_challenged',
    authorityEpistemicDistrust: result.axes.epistemic_trust.state === 'authority_distrusted',
    frameJurisdictionDispute: result.observations.some((row) => row.type === 'frame_jurisdiction_dispute'),
  };
}
