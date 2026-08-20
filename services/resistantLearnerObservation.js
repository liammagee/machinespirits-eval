import crypto from 'node:crypto';

export const RESISTANT_LEARNER_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-observation.v1';
export const FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE = 'TUTOR_STUB_FRAME_DEFIANT_ADHERENCE_EXHAUSTED';
export const FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE = 'TUTOR_STUB_FRAME_REFUSER_ADHERENCE_EXHAUSTED';

export function classifyFrameDefiantAdherenceExhaustion({ profile, repairAttempts } = {}) {
  if (profile !== 'frame_defiant') {
    throw new Error('frame-defiant adherence exhaustion classification requires profile frame_defiant');
  }
  if (!Number.isInteger(repairAttempts) || repairAttempts < 0) {
    throw new Error('frame-defiant adherence exhaustion classification requires non-negative repairAttempts');
  }
  return {
    code: FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
    profile,
    repairAttempts,
    disposition: 'technical_failure_no_public_candidate',
    publishPublicCandidate: false,
  };
}

export function classifyFrameRefuserAdherenceExhaustion({ profile, repairAttempts } = {}) {
  if (profile !== 'frame_refuser') {
    throw new Error('frame-refuser adherence exhaustion classification requires profile frame_refuser');
  }
  if (!Number.isInteger(repairAttempts) || repairAttempts < 0) {
    throw new Error('frame-refuser adherence exhaustion classification requires non-negative repairAttempts');
  }
  return {
    code: FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
    profile,
    repairAttempts,
    disposition: 'technical_failure_no_public_candidate',
    publishPublicCandidate: false,
  };
}

export const RESISTANT_LEARNER_OBSERVATION_SEMANTICS = Object.freeze({
  legacyV1: 'legacy_v1',
  prospectiveV2: 'prospective_v2',
  prospectiveV3: 'prospective_v3',
  prospectiveV4: 'prospective_v4',
  prospectiveV5: 'prospective_v5',
  prospectiveV6: 'prospective_v6',
  prospectiveV7: 'prospective_v7',
});

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

const FRAME_JURISDICTION_PATTERNS_V1 = Object.freeze([
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

const FRAME_JURISDICTION_PATTERNS_V2 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V1,
  /\bi (?:do not|don't) accept (?:your|the tutor['’]s|their) right to (?:fix|set|define|choose|dictate)\b.{0,120}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi (?:do not|don't) accept that (?:you|the tutor|they) (?:get|gets) to (?:fix|set|define|choose|dictate)\b.{0,120}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi (?:do not|don't) accept that\b.{0,100}\b(?:verdict|accusation) (?:fixes|sets|defines|chooses|dictates)\b.{0,100}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi reject your (?:demand|question)\b.{0,120}\b(?:frame|framing|governing (?:frame|question|test))\b/iu,
  /\bi reject your standing to (?:set|fix|define|choose|dictate)\b.{0,120}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
  /\bi reject\b.{0,80}\btest as (?:your |the )?governing (?:frame|question|test)\b/iu,
  /\byou (?:do not|don't) get to dictate\b.{0,120}\b(?:premise|frame|framing|question|exercise|rules?|test|task)\b/iu,
]);

const FRAME_INQUIRY_NOUN =
  '(?:premise|frame|framing|question|exercise|rules?|test|task|criterion|standard|inquiry|challenge|claim|comparison|issue|matter|scope|agenda|problem|verdict)';
const FRAME_INQUIRY_NOUN_V4 =
  '(?:premise|frame|framing|question|exercise|rules?|test|task|criterion|standard|inquiry|challenge|claim|comparison|issue|matter|scope|agenda|problem|verdict|correction|joining|limit)';
const FRAME_AUTHORITY_NOUN = '(?:authority|standing|right)';
const FRAME_SETTING_VERB = '(?:set|fix|define|choose|dictate|govern|control)';
const FRAME_INQUIRY_MODIFIER =
  '(?:a|an|the|this|that|these|those|your|our|my|its|even|only|whole|wider|narrow|bounded|assigned|proposed|governing|controlling|current|present|initial|which|what|one)';

// V3 is deliberately additive. V1 and V2 keep their byte-stable pattern sets
// and dispatch; only a registration explicitly bound to prospective_v3 can
// select these broader, domain-independent jurisdiction forms.
const FRAME_JURISDICTION_PATTERNS_V3 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V2,
  new RegExp(
    String.raw`\bi (?:reject|deny|do not grant|don't grant) (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_NOUN} to ${FRAME_SETTING_VERB}(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi (?:do not|don't) grant\b[^.!?;]{0,120}\b${FRAME_INQUIRY_NOUN}\b[^.!?;]{0,80}\b${FRAME_AUTHORITY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:your|the|this|that) (?:claim|premise|assertion) that\b.{0,120}\b(?:should|must|may|can|will) ${FRAME_SETTING_VERB}(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\b(?:you|the tutor|they) (?:have|has) no ${FRAME_AUTHORITY_NOUN} to ${FRAME_SETTING_VERB}(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
]);

// V4 is another additive observer version. It composes the frozen V3 patterns
// with the grammatical forms missed in the incomplete V3 execution: authority
// can be attributed to a named or possessive test, or rejected through
// declare/make/leave constructions whose complement is the governing inquiry.
// Accepted authority, physical placement, and merits-only objections are
// filtered separately below so this expansion does not turn ordinary dispute
// into jurisdiction refusal.
const FRAME_JURISDICTION_PATTERNS_V4 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V3,
  new RegExp(
    String.raw`\bi reject (?:the |this |that |your )?(?:[\p{L}\p{N}_-]+['’]s )?(?:proposed )?${FRAME_INQUIRY_NOUN}(?:['’]s)? (?:authority|standing|right)\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:the |this |that |your )?(?:[\p{L}\p{N}_-]+['’]s )(?:proposed )?${FRAME_INQUIRY_NOUN}\b[^.!?;]{0,200}\b(?:(?:under|within|beneath) (?:the |this |that |your |its |their )?(?:governing |controlling )?${FRAME_INQUIRY_NOUN}|(?:as|to be) (?:the )?(?:governing|controlling|decisive) ${FRAME_INQUIRY_NOUN})\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:your |the |this |that )?(?:[\p{L}\p{N}’'_-]+\s+){0,5}(?:question|test|criterion|standard|inquiry|frame|correction|comparison|joining|limit)(?:['’]s)? (?:proposed )?(?:authority|standing|right)\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:the )?(?:authority|standing|right) of\b[^.!?;]{0,120}\b(?:as|to be) (?:the )?(?:governing|controlling|decisive) ${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_NOUN} over(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi (?:reject|deny) (?:your|the tutor['’]s|their|(?:the )?[\p{L}\p{N}_-]+['’]s) ${FRAME_AUTHORITY_NOUN} to (?:set|fix|define|choose|dictate)(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}(?:\s+[\p{L}\p{N}_-]+){0,2}\s+${FRAME_INQUIRY_NOUN_V4}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\b(?:the )?[\p{L}\p{N}_-]+ (?:have|has) no ${FRAME_AUTHORITY_NOUN} to (?:set|fix|define|choose|dictate)(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}(?:\s+[\p{L}\p{N}_-]+){0,2}\s+${FRAME_INQUIRY_NOUN_V4}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_NOUN} to (?:declare|make|leave)\b[^.!?;]{0,120}\b(?:as\s+)?(?:the\s+)?(?:governing|controlling|decisive|open)\b[^.!?;]{0,80}\b${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_NOUN} to (?:declare|make|leave)\b[^.!?;]{0,120}\b(?:govern|control|set|define)\b(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\bi reject\b[^.!?;]{0,120}\b(?:as\s+)?(?:the\s+)?(?:governing|controlling|decisive) ${FRAME_INQUIRY_NOUN}\b`,
    'iu',
  ),
]);

// V5 is confirmation-specific and additive. It preserves V1-V4 dispatch while
// covering a frozen production miss in which the learner denies authority to a
// proposed reading of a named record rather than denying authority to the
// inquiry noun directly.
const FRAME_JURISDICTION_PATTERNS_V5 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V4,
  /\bi (?:do not|don't) grant (?:your|the tutor['’]s|their) (?:proposed )?(?:reading|interpretation|account) of\b[^.!?;]{0,140}\b(?:authority|standing|right)\b/iu,
]);

// V6 is additive and confirmation-specific. It covers the frozen V3 live
// failure in which authority is denied to a bounded inquiry object rather than
// directly to the tutor: "your choice of object authority" and "your proposed
// assay or its blank record authority". The inquiry-noun lookahead keeps the
// construction scoped to the registered frame/test domain.
const FRAME_AUTHORITY_OBJECT_NOUN_V6 =
  '(?:premise|frame|framing|question|exercise|rules?|test|task|criterion|standard|inquiry|challenge|claim|comparison|issue|matter|scope|agenda|problem|verdict|assay|record|object|evidence|result|sample)';
const FRAME_AUTHORITY_OBJECT_TARGET_V6 = String.raw`(?:(?:choice|selection|reading|interpretation|account|proposal) of (?:a |an |the |this |that |your |our |its |my )?(?:[\p{L}\p{N}_-]+\s+){0,3}${FRAME_AUTHORITY_OBJECT_NOUN_V6}|(?:proposed )?(?:[\p{L}\p{N}_-]+\s+){0,3}${FRAME_AUTHORITY_OBJECT_NOUN_V6}(?: or its (?:[\p{L}\p{N}_-]+\s+){0,3}${FRAME_AUTHORITY_OBJECT_NOUN_V6})?)`;
const FRAME_AUTHORITY_OBJECT_CAUSAL_CONNECTOR_V6 = String.raw`(?:\bbecause\b|\bsince\b|\bgiven that\b|:)`;

const FRAME_JURISDICTION_PATTERNS_V6 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V5,
  new RegExp(
    String.raw`\bi (?:do not|don't) grant (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_OBJECT_TARGET_V6}\s+${FRAME_AUTHORITY_NOUN}\b`,
    'iu',
  ),
]);

// V7 is additive and confirmation-specific. It covers three frozen V4 live
// misses compositionally: authority attributed to a domain object may be
// denied the right to set a bounded inquiry, and an inquiry antecedent may be
// followed by a clause-scoped rejection of "its" authority. Requiring the
// authority-to-setting construction or the explicit inquiry antecedent keeps
// personnel, physical-placement, and administrative uses out of scope.
const FRAME_JURISDICTION_PATTERNS_V7 = Object.freeze([
  ...FRAME_JURISDICTION_PATTERNS_V6,
  new RegExp(
    String.raw`\bi (?:do not|don't) grant (?:the )?(?:[\p{L}\p{N}_-]+['’]s )(?:[\p{L}\p{N}_-]+\s+){0,3}${FRAME_AUTHORITY_NOUN} to ${FRAME_SETTING_VERB}(?:\s+${FRAME_INQUIRY_MODIFIER}){0,4}\s+${FRAME_INQUIRY_NOUN_V4}\b`,
    'iu',
  ),
  new RegExp(
    String.raw`\b(?:that|this|it) is (?:the )?(?:your|this|that|(?:[\p{L}\p{N}_-]+['’]s)) (?:[\p{L}\p{N}_-]+\s+){0,2}${FRAME_INQUIRY_NOUN_V4},? not mine\b[^.!?]{0,120}\bi (?:reject|deny|do not accept|don't accept) its ${FRAME_AUTHORITY_NOUN}\b`,
    'iu',
  ),
]);

const FRAME_AUTHORITY_OBJECT_MERITS_ONLY_PATTERNS_V6 = Object.freeze([
  new RegExp(
    String.raw`\bi (?:do not|don't) grant (?:your|the tutor['’]s|their) ${FRAME_AUTHORITY_OBJECT_TARGET_V6}\s+${FRAME_AUTHORITY_NOUN}\b[^.!?;]{0,40}${FRAME_AUTHORITY_OBJECT_CAUSAL_CONNECTOR_V6}(?=[^.!?;]{0,180}\b(?:assay|balance|calculation|clamp|denominator|evidence|fixture|formula|instrument|measurement|method|object|procedure|reading|record|result|sample|screw|sensor|test)\b)(?=[^.!?;]{0,180}\b(?:bad|biased|broke|broken|contaminated|failed|fails|false|incomplete|incorrect|invalid|loose|miscalibrated|missing|slipped|slips|unstable|unfit|unreliable|wrong)\b)[^.!?;]{0,180}`,
    'iu',
  ),
]);

const FRAME_AUTHORITY_OBJECT_EXPLICIT_FRAME_RATIONALE_PATTERNS_V6 = Object.freeze([
  new RegExp(
    String.raw`${FRAME_AUTHORITY_OBJECT_CAUSAL_CONNECTOR_V6}[^.!?;]{0,180}\b(?:governing|controlling|decisive)\b[^.!?;]{0,80}\b(?:frame|test|question|criterion|standard|inquiry|premise)\b`,
    'iu',
  ),
]);

const FRAME_ACCEPTED_AUTHORITY_PATTERNS_V4 = Object.freeze([
  /\bi (?:accept|acknowledge|recognize|grant) (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi (?:do not|don't) (?:dispute|reject|deny) (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
  /\bi am not (?:disputing|rejecting|denying) (?:your|the tutor['’]s|their) (?:authority|standing|right)\b/iu,
]);

const FRAME_MERITS_ONLY_PATTERNS_V4 = Object.freeze([
  /\bi reject\b[^.!?;]{0,120}\bbecause\b[^.!?;]{0,120}\b(?:calculation|denominator|evidence|formula|measurement|result|sample|source)\b[^.!?;]{0,80}\b(?:bad|biased|false|incomplete|incorrect|invalid|missing|unreliable|wrong)\b/iu,
  /\bi reject\b[^.!?;]{0,160}\bnot because\b[^.!?;]{0,80}\b(?:authority|standing|right)\b/iu,
  /\bi reject\b[^.!?;]{0,240}\bbecause\b[^.!?;]{0,120}\b(?:clamp|fixture|instrument|procedure|sample|screw|sensor)\b[^.!?;]{0,80}\b(?:broke|broken|contaminated|failed|fails|loose|miscalibrated|slipped|slips|unstable)\b/iu,
]);

const FRAME_EXPLICIT_REFRAME_PATTERNS = Object.freeze([
  /\blet us (?:first )?agree\b.{0,140}\b(?:matter|premise|frame|question|record|evidence|test|tested)\b/iu,
  /\blet us (?:instead |first )?(?:ask|begin|start)\b.{0,140}\b(?:matter|premise|frame|question|record|evidence|test)\b/iu,
]);

const FRAME_BOUNDED_LOCAL_TEST_PATTERNS = Object.freeze([
  /\blet us (?:first )?(?:examine|test|compare|check)\b.{0,160}/iu,
  /\bwhat public (?:matter|record|evidence|clue|feature)\b.{0,100}\b(?:examine|test|compare|check)\b/iu,
  /\bi will (?:first )?(?:examine|test|compare|check)\b.{0,160}/iu,
  /\bi will consider\b.{0,100}\b(?:claim|distinction|evidence|feature|question|record|test)\b/iu,
  /\bif you (?:propose|offer|name)\b.{0,100}\b(?:bounded|local)\b.{0,100}\b(?:claim|distinction|feature|test)\b/iu,
]);

const FRAME_EXPLICIT_WITHHOLDING_PATTERNS = Object.freeze([
  /\bi (?:will not|won't|do not|don't|refuse to|decline to) (?:answer|cite|compare|contribute|engage|enter|examine|inspect|name|offer|participate|perform|proceed|provide|supply|take|test)\b/iu,
  /\bi (?:withhold|am withholding)\b.{0,100}\b(?:answer|evidence|test|participation|contribution)\b/iu,
]);

const FRAME_EXPLICIT_REFRAME_PATTERNS_V3 = Object.freeze([
  ...FRAME_EXPLICIT_REFRAME_PATTERNS,
  /\b(?:instead|alternatively),? (?:let us|we can|i propose)\b.{0,140}\b(?:ask|frame|treat|test|examine|compare|evaluate)\b/iu,
  /\bi (?:propose|offer) (?:a |an |one )?(?:different|alternative|narrower|bounded|local)\b.{0,120}\b(?:premise|frame|question|test|criterion|standard|inquiry|claim|comparison|issue|matter)\b/iu,
]);

const FRAME_BOUNDED_LOCAL_TEST_PATTERNS_V3 = Object.freeze([
  ...FRAME_BOUNDED_LOCAL_TEST_PATTERNS,
  /\b(?:i will|i'll|i can|let me|we can|let us) (?:first |still |only )?(?:answer|judge|weigh|assess|decide|determine|evaluate|examine|test|compare|consider)\b.{0,160}\b(?:bounded|local|narrow|specific|public|available|stated|limited|single|one|point|claim|question|test|criterion|standard|comparison|issue|matter|evidence|record|feature|distinction)\b/iu,
  /\b(?:one|a) (?:bounded|local|narrow|specific) (?:claim|question|test|criterion|standard|comparison|issue|matter|feature|distinction)\b.{0,120}\b(?:can|could|may|will) (?:still )?(?:be )?(?:answered|judged|weighed|assessed|decided|determined|evaluated|examined|tested|compared|considered)\b/iu,
]);

const FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V3 = Object.freeze([
  ...FRAME_EXPLICIT_WITHHOLDING_PATTERNS,
  /\bi (?:will not|won't|do not|don't|refuse to|decline to) (?:judge|weigh|assess|decide|determine|license|evaluate)\b/iu,
  /\bi (?:am not|will not be|won't be|remain unwilling to) (?:answering|judging|weighing|assessing|deciding|determining|licensing|evaluating|engaging|entering|examining|participating|proceeding|testing|contributing)\b/iu,
  /\bi (?:am not going to|have no intention of) (?:answer|judge|weigh|assess|decide|determine|license|evaluate|engage|enter|examine|participate|proceed|test|contribute)\b/iu,
  /\bi have no intention of (?:answering|judging|weighing|assessing|deciding|determining|licensing|evaluating|engaging|entering|examining|participating|proceeding|testing|contributing)\b/iu,
  /\bi (?:withhold|am withholding|will withhold)\b.{0,100}\b(?:answer|judgment|assessment|decision|determination|evaluation|evidence|test|participation|contribution)\b/iu,
]);

const FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V4 = Object.freeze([
  ...FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V3,
  /\bi (?:will not|won't|do not|don't|refuse to|decline to) (?:challenge|keep|propose|record)\b/iu,
  /\band (?:will not|won't|do not|don't|refuse to|decline to) (?:answer|challenge|compare|keep|propose|record|supply)\b/iu,
]);

const FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V6 = Object.freeze([
  ...FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V4,
  /\bi (?:will )?neither\b[^.!?;]{0,120}\b(?:answer|challenge|compare|contribute|engage|enter|examine|inspect|judge|offer|participate|proceed|provide|record|supply|test|weigh)\b[^.!?;]{0,120}\bnor\b[^.!?;]{0,80}\b(?:answer|challenge|compare|contribute|engage|enter|examine|inspect|judge|offer|participate|proceed|provide|record|supply|test|weigh|evidence)\b/iu,
]);

const FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V7 = Object.freeze([
  ...FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V6,
  /\bi (?:will not|won't|do not|don't|refuse to|decline to) permit\b[^.!?;]{0,180}\b(?:answer|examination|examine|inspection|inspect|test|testing)\b/iu,
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

function conditionalBoundedParticipationNegated(text, evidence) {
  if (!evidence || !/\bif you (?:propose|offer|name)\b/iu.test(evidence)) return false;
  const evidenceIndex = text.indexOf(evidence);
  if (evidenceIndex < 0) return false;
  const followingClause = `${evidence}${text.slice(evidenceIndex + evidence.length).split(/[.!?;]/u, 1)[0] || ''}`;
  const affirmativeParticipation =
    /\bi (?:will|can) (?!not\b)(?:answer|assess|consider|decide|determine|evaluate|examine|judge|test|weigh)\b/iu.test(
      followingClause,
    );
  const negatedParticipation =
    /\bi (?:will not|won't|do not|don't|cannot|can't|refuse to|decline to) (?:answer|assess|consider|decide|determine|evaluate|examine|judge|test|weigh)\b/iu.test(
      followingClause,
    );
  return negatedParticipation && !affirmativeParticipation;
}

export function classifyFrameJurisdictionParticipation({
  learnerText = '',
  classification = null,
  semantics = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2,
} = {}) {
  const text = String(learnerText || '').trim();
  const participation = [];
  const prospectiveV3 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const prospectiveV4 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  const prospectiveV5 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5;
  const prospectiveV6 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6;
  const prospectiveV7 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7;
  const expandedProspective = prospectiveV3 || prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7;
  const explicitReframe = firstEvidence(
    text,
    expandedProspective ? FRAME_EXPLICIT_REFRAME_PATTERNS_V3 : FRAME_EXPLICIT_REFRAME_PATTERNS,
  );
  const boundedLocalTestCandidate = firstEvidence(
    text,
    expandedProspective ? FRAME_BOUNDED_LOCAL_TEST_PATTERNS_V3 : FRAME_BOUNDED_LOCAL_TEST_PATTERNS,
  );
  const boundedLocalTest =
    (prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7) &&
    conditionalBoundedParticipationNegated(text, boundedLocalTestCandidate)
      ? null
      : boundedLocalTestCandidate;
  const carriesContent = contentBearing(classification);
  if (explicitReframe) participation.push({ kind: 'explicit_reframe', evidence_span: explicitReframe });
  if (boundedLocalTest) participation.push({ kind: 'bounded_local_test', evidence_span: boundedLocalTest });
  if (carriesContent) participation.push({ kind: 'content_bearing_contribution', evidence_span: null });
  const explicitWithholding = firstEvidence(
    text,
    prospectiveV7
      ? FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V7
      : prospectiveV6
        ? FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V6
        : prospectiveV4 || prospectiveV5
          ? FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V4
          : prospectiveV3
            ? FRAME_EXPLICIT_WITHHOLDING_PATTERNS_V3
            : FRAME_EXPLICIT_WITHHOLDING_PATTERNS,
  );
  return {
    contract_licensed_participation: participation.length > 0,
    participation,
    explicit_withholding: Boolean(explicitWithholding),
    explicit_withholding_evidence: explicitWithholding,
    content_bearing: carriesContent,
  };
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

export function observeResistantLearnerTurn({
  learnerText = '',
  classification = null,
  tutorText = '',
  semantics = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2,
} = {}) {
  if (!Object.values(RESISTANT_LEARNER_OBSERVATION_SEMANTICS).includes(semantics)) {
    throw new Error(`unsupported resistant-learner observation semantics: ${semantics}`);
  }
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

  const legacySemantics = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.legacyV1;
  const prospectiveV3 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const prospectiveV4 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  const prospectiveV5 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5;
  const prospectiveV6 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6;
  const prospectiveV7 = semantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7;
  const acceptedAuthority =
    prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7
      ? firstEvidence(text, FRAME_ACCEPTED_AUTHORITY_PATTERNS_V4)
      : null;
  const meritsOnly =
    prospectiveV4 || prospectiveV5 || prospectiveV6 || prospectiveV7
      ? firstEvidence(text, FRAME_MERITS_ONLY_PATTERNS_V4)
      : null;
  const framePatterns = legacySemantics
    ? FRAME_JURISDICTION_PATTERNS_V1
    : prospectiveV7
      ? FRAME_JURISDICTION_PATTERNS_V7
      : prospectiveV6
        ? FRAME_JURISDICTION_PATTERNS_V6
        : prospectiveV5
          ? FRAME_JURISDICTION_PATTERNS_V5
          : prospectiveV4
            ? FRAME_JURISDICTION_PATTERNS_V4
            : prospectiveV3
              ? FRAME_JURISDICTION_PATTERNS_V3
              : FRAME_JURISDICTION_PATTERNS_V2;
  const candidateFrameEvidence = firstEvidence(text, framePatterns);
  const v6AuthorityObjectMeritsOnly =
    prospectiveV6 || prospectiveV7 ? firstEvidence(text, FRAME_AUTHORITY_OBJECT_MERITS_ONLY_PATTERNS_V6) : null;
  const v6AuthorityObjectExplicitFrameRationale =
    prospectiveV6 || prospectiveV7
      ? firstEvidence(text, FRAME_AUTHORITY_OBJECT_EXPLICIT_FRAME_RATIONALE_PATTERNS_V6)
      : null;
  const explicitJurisdictionCandidate = Boolean(
    candidateFrameEvidence &&
    (/\b(?:authority|standing|right|governing|controlling|decisive)\b/iu.test(candidateFrameEvidence) ||
      /\b(?:under|within|beneath)\b[^.!?;]{0,80}\b(?:frame|question|test|criterion|standard|inquiry)\b/iu.test(
        candidateFrameEvidence,
      )),
  );
  const acceptedIndex = acceptedAuthority ? text.indexOf(acceptedAuthority) : -1;
  const candidateIndex = candidateFrameEvidence ? text.indexOf(candidateFrameEvidence) : -1;
  const acceptedAuthorityContainsCandidate =
    acceptedIndex >= 0 && candidateIndex >= acceptedIndex && candidateIndex < acceptedIndex + acceptedAuthority.length;
  const frameEvidence =
    (meritsOnly && !explicitJurisdictionCandidate) ||
    ((prospectiveV6 || prospectiveV7) &&
      candidateFrameEvidence &&
      v6AuthorityObjectMeritsOnly &&
      !v6AuthorityObjectExplicitFrameRationale) ||
    acceptedAuthorityContainsCandidate
      ? null
      : candidateFrameEvidence;
  if (frameEvidence) {
    const turn = classifierTurn(classification);
    const frameSemantics = legacySemantics
      ? {
          contract_licensed_participation: false,
          participation: [],
          explicit_withholding: false,
          explicit_withholding_evidence: null,
          content_bearing: contentBearing(classification),
        }
      : classifyFrameJurisdictionParticipation({ learnerText: text, classification, semantics });
    const disputeFeatures = legacySemantics
      ? {
          target: 'inquiry_frame_or_tutor_standing',
          jurisdictional: true,
          content_bearing: frameSemantics.content_bearing,
          classifier_request_type: turn.request_type || null,
          classifier_discourse_move: turn.discourse_move || null,
        }
      : {
          target: 'inquiry_frame_or_tutor_standing',
          jurisdictional: true,
          content_bearing: frameSemantics.content_bearing,
          contract_licensed_participation: frameSemantics.contract_licensed_participation,
          participation_kinds: frameSemantics.participation.map((row) => row.kind),
          participation_evidence: frameSemantics.participation,
          explicit_withholding: frameSemantics.explicit_withholding,
          explicit_withholding_evidence: frameSemantics.explicit_withholding_evidence,
          classifier_request_type: turn.request_type || null,
          classifier_discourse_move: turn.discourse_move || null,
        };
    observations.push(observation('frame_jurisdiction_dispute', frameEvidence, text, disputeFeatures));
    if (
      (legacySemantics && !frameSemantics.content_bearing) ||
      (!legacySemantics && frameSemantics.explicit_withholding && !frameSemantics.contract_licensed_participation)
    ) {
      const refusalFeatures = legacySemantics
        ? {
            target: 'inquiry_frame_or_tutor_standing',
            jurisdictional: true,
            local_test_or_evidence_withheld: true,
            content_bearing: false,
            classifier_request_type: turn.request_type || null,
            classifier_discourse_move: turn.discourse_move || null,
          }
        : {
            target: 'inquiry_frame_or_tutor_standing',
            jurisdictional: true,
            local_test_or_evidence_withheld: true,
            content_bearing: frameSemantics.content_bearing,
            contract_licensed_participation: false,
            participation_kinds: [],
            explicit_withholding: true,
            explicit_withholding_evidence: frameSemantics.explicit_withholding_evidence,
            classifier_request_type: turn.request_type || null,
            classifier_discourse_move: turn.discourse_move || null,
          };
      observations.push(observation('frame_jurisdiction_refusal', frameEvidence, text, refusalFeatures));
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
  const frameDispute = result.observations.find((row) => row.type === 'frame_jurisdiction_dispute');
  return {
    boredWithholding: result.observations.some((row) => row.type === 'bored_effort_withholding'),
    frameJurisdictionDispute: Boolean(frameDispute),
    frameJurisdictionParticipation: frameDispute?.features?.contract_licensed_participation === true,
    frameJurisdictionRefusal: result.observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
  };
}
