import { observeResistantLearnerTurn } from './resistantLearnerObservation.js';

export const RESISTANT_LEARNER_AXIS_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-axis-observation.v1';

export const RESISTANT_LEARNER_AXIS_DEFINITIONS = Object.freeze([
  Object.freeze({ axis: 'effort_investment', marker: 'effortWithholding', observedState: 'withheld' }),
  Object.freeze({
    axis: 'learner_authorship',
    marker: 'tutorChoiceDeference',
    observedState: 'deferred_to_tutor',
  }),
  Object.freeze({
    axis: 'evidential_orientation',
    marker: 'evidentialWarrantChallenge',
    observedState: 'warrant_challenged',
  }),
  Object.freeze({
    axis: 'epistemic_trust',
    marker: 'authorityEpistemicDistrust',
    observedState: 'authority_distrusted',
  }),
  Object.freeze({
    axis: 'frame_legitimacy',
    marker: 'frameJurisdictionDispute',
    observedState: 'jurisdiction_disputed',
  }),
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

const ADDITIONAL_FRAME_JURISDICTION_PATTERNS = Object.freeze([
  /\bi (?:will not|won't|do not|don't) accept\b.{0,120}\b(?:authority|standing|governing (?:frame|question|test)|frame you have not established)\b/iu,
  /\bi (?:do not|don't) accept\b.{0,120}\b(?:your framing|your frame|as authority)\b/iu,
  /\bnot under (?:your|the tutor['’]s) authority\b/iu,
  /\b(?:do not|don't|will not|won't) grant (?:it|that|this|your .{0,40}) authority\b/iu,
  /\byou (?:do not|don't) get to (?:make|require)\b.{0,140}\b(?:the measure of|decide|settle|answer|governing (?:link|measure|question|test))\b/iu,
  /\b(?:first )?establish why\b.{0,100}\b(?:standing|authority|govern|measure)\b/iu,
]);

function firstEvidence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function axis(state = 'not_observed', evidenceSpan = null) {
  return { state, evidence_span: evidenceSpan };
}

export function observeResistantLearnerAxes({ learnerText = '', classification = null, tutorText = '' } = {}) {
  const text = String(learnerText || '').trim();
  const registered = observeResistantLearnerTurn({ learnerText: text, classification, tutorText });
  const effortEvidence =
    registered.observations.find((row) => row.type === 'bored_effort_withholding')?.evidence_span || null;
  const registeredFrameEvidence =
    registered.observations.find((row) => row.type === 'frame_jurisdiction_dispute')?.evidence_span || null;
  const tutorChoiceEvidence = firstEvidence(text, TUTOR_CHOICE_DEFERENCE_PATTERNS);
  const warrantChallengeEvidence = /\?/u.test(text) ? firstEvidence(text, EVIDENTIAL_WARRANT_CHALLENGE_PATTERNS) : null;
  const authorityDistrustEvidence = firstEvidence(text, AUTHORITY_EPISTEMIC_DISTRUST_PATTERNS);
  const frameEvidence = registeredFrameEvidence || firstEvidence(text, ADDITIONAL_FRAME_JURISDICTION_PATTERNS);

  const axes = {
    effort_investment: effortEvidence ? axis('withheld', effortEvidence) : axis(),
    learner_authorship: tutorChoiceEvidence ? axis('deferred_to_tutor', tutorChoiceEvidence) : axis(),
    evidential_orientation: warrantChallengeEvidence ? axis('warrant_challenged', warrantChallengeEvidence) : axis(),
    epistemic_trust: authorityDistrustEvidence ? axis('authority_distrusted', authorityDistrustEvidence) : axis(),
    frame_legitimacy: frameEvidence ? axis('jurisdiction_disputed', frameEvidence) : axis(),
  };

  return {
    schema: RESISTANT_LEARNER_AXIS_OBSERVATION_SCHEMA,
    authority: 'calibration_only',
    changes_registered_observation: false,
    axes,
  };
}

export function resistantLearnerAxisMarkers(input = {}) {
  const result = observeResistantLearnerAxes(input);
  return {
    effortWithholding: result.axes.effort_investment.state === 'withheld',
    tutorChoiceDeference: result.axes.learner_authorship.state === 'deferred_to_tutor',
    evidentialWarrantChallenge: result.axes.evidential_orientation.state === 'warrant_challenged',
    authorityEpistemicDistrust: result.axes.epistemic_trust.state === 'authority_distrusted',
    frameJurisdictionDispute: result.axes.frame_legitimacy.state === 'jurisdiction_disputed',
  };
}
