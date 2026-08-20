import crypto from 'node:crypto';

export const RESISTANT_LEARNER_OBSERVATION_SCHEMA = 'machinespirits.resistant-learner-observation.v1';
export const FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE = 'TUTOR_STUB_FRAME_DEFIANT_ADHERENCE_EXHAUSTED';

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

export const RESISTANT_LEARNER_OBSERVATION_SEMANTICS = Object.freeze({
  legacyV1: 'legacy_v1',
  prospectiveV2: 'prospective_v2',
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

export function classifyFrameJurisdictionParticipation({ learnerText = '', classification = null } = {}) {
  const text = String(learnerText || '').trim();
  const participation = [];
  const explicitReframe = firstEvidence(text, FRAME_EXPLICIT_REFRAME_PATTERNS);
  const boundedLocalTest = firstEvidence(text, FRAME_BOUNDED_LOCAL_TEST_PATTERNS);
  const carriesContent = contentBearing(classification);
  if (explicitReframe) participation.push({ kind: 'explicit_reframe', evidence_span: explicitReframe });
  if (boundedLocalTest) participation.push({ kind: 'bounded_local_test', evidence_span: boundedLocalTest });
  if (carriesContent) participation.push({ kind: 'content_bearing_contribution', evidence_span: null });
  const explicitWithholding = firstEvidence(text, FRAME_EXPLICIT_WITHHOLDING_PATTERNS);
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
  const frameEvidence = firstEvidence(
    text,
    legacySemantics ? FRAME_JURISDICTION_PATTERNS_V1 : FRAME_JURISDICTION_PATTERNS_V2,
  );
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
      : classifyFrameJurisdictionParticipation({ learnerText: text, classification });
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
