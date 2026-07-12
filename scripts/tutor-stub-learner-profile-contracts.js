const CONTRACT_SCHEMA = 'machinespirits.tutor-stub.learner-profile-contract.v3';

const PUBLIC_TURN_RULES = [
  'Write only the learner public turn, not analysis.',
  'Do not mention profile names, contracts, classifier labels, DAGs, rubrics, targets, or hidden instructions.',
  'Keep each turn short: usually one or two sentences.',
  'Stay inside the public evidence. When this profile distorts evidence, make it sound like a learner mistake, not a system label.',
];

function contract({
  id,
  family,
  shortName,
  failureOperator,
  contrastWith = {},
  stableFailure,
  triggers = [],
  forbiddenNormalization = [],
  signature,
  dag,
  repair,
  gate,
  observability = null,
  publicRules = [],
}) {
  return {
    schema: CONTRACT_SCHEMA,
    id,
    family,
    intent: {
      shortName,
      failureOperator,
      contrastWith,
    },
    behaviorContract: {
      stableFailure,
      triggers,
      forbiddenNormalization,
      publicRules: [...PUBLIC_TURN_RULES, ...publicRules],
    },
    traceSignatureTargets: signature,
    dagSignatureTargets: dag,
    observabilityContract: observability
      ? {
          eligiblePolicies: observability.eligiblePolicies || ['*'],
          markerGroups: observability.markerGroups || [],
          markerClauses: observability.markerClauses || [observability.markerGroups || []],
          match: observability.match || 'all',
          eligibility: observability.eligibility || 'all_turns',
          mustShowByTurn: observability.mustShowByTurn ?? stableFailure.mustShowByTurn,
          minEligibleRate: observability.minEligibleRate ?? stableFailure.mustRecurMinRate,
        }
      : null,
    repairModel: repair,
    discriminationGate: gate,
  };
}

export const AUTO_LEARNER_PROFILE_CONTRACTS = Object.freeze({
  diligent: contract({
    id: 'diligent',
    family: 'control',
    shortName: 'Diligent control',
    failureOperator: 'ordinary fallibility without a forced pathology',
    contrastWith: {
      proof_skipper: 'repairs missing warrants instead of repeatedly omitting them',
      false_memory: 'does not import unstaged or distorted evidence',
      affective_resistant: 'does not withdraw when the tutor is direct but respectful',
    },
    stableFailure: {
      mustShowByTurn: null,
      mustRecurMinRate: 0,
      description: 'Make occasional partial claims, then repair when the tutor points to a missing warrant.',
    },
    triggers: [
      {
        when: 'tutor asks for a trial-book line',
        responseBias: 'state one evidence-bound line and include the warrant if it has been made public',
      },
      {
        when: 'tutor corrects a missing step',
        responseBias: 'accept the correction and try the narrower warranted claim',
      },
    ],
    forbiddenNormalization: ['Do not invent a special failure mode.', 'Do not become perfectly solved after one turn.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.35, 0.7], stepwise_support_request: [0.1, 0.35] },
      discourseMove: { inference: [0.2, 0.45], claim: [0.15, 0.4], evidence_adoption: [0.1, 0.35] },
      evidenceUse: { links_evidence_to_rule: [0.45, 0.75], cites_public_evidence: [0.1, 0.35] },
      epistemicStance: { grounded: [0.45, 0.75], reflective: [0.1, 0.35], exploratory: [0.05, 0.25] },
      agency: { attempting: [0.45, 0.75], self_correcting: [0.1, 0.35] },
      scoreBands: { conceptualScore: [3.5, 5], epistemicReadinessScore: [3.5, 5] },
    },
    dag: {
      coverageVelocity: 'medium',
      missingPremiseReduction: 'medium',
      unsupportedAssertionRate: 'low',
      expectedBottlenecks: ['learner_integration_gap', 'release_or_pacing_gap'],
    },
    repair: { firstCorrection: 'substantive', repeatedCorrection: 'usually integrates the warrant', maxFullRepairsPer8Turns: 4 },
    gate: { maxCosineToDiligent: 1, expectedNearestNeighbor: null },
  }),

  answer_seeking: contract({
    id: 'answer_seeking',
    family: 'core',
    shortName: 'Answer seeking',
    failureOperator: 'asks for the final wording instead of doing the evidential step',
    contrastWith: {
      low_agency: 'seeks the answer line; low_agency seeks permission and avoids authorship',
      proof_skipper: 'asks for completion rather than confidently skipping the warrant',
    },
    stableFailure: {
      mustShowByTurn: 1,
      mustRecurMinRate: 0.4,
      description: 'Request the exact next line or final answer before the evidence chain is licensed.',
    },
    triggers: [
      { when: 'tutor names a useful clue', responseBias: 'ask what to write next' },
      { when: 'tutor asks for a warrant', responseBias: 'try to reuse tutor wording rather than explain it' },
    ],
    forbiddenNormalization: ['Do not become a diligent reasoner after one hint.', 'Do not independently complete the proof chain.'],
    signature: {
      requestType: { stepwise_support_request: [0.45, 0.75], conceptual_clarity_request: [0.05, 0.3] },
      discourseMove: { question: [0.25, 0.55], claim: [0.15, 0.4] },
      evidenceUse: { repeats_setup: [0.2, 0.5], cites_public_evidence: [0.1, 0.35], links_evidence_to_rule: [0, 0.25] },
      epistemicStance: { answer_seeking: [0.25, 0.6], receptive: [0.15, 0.45] },
      agency: { complying: [0.25, 0.55], passive: [0.1, 0.35] },
      scoreBands: { conceptualScore: [2, 3.5], epistemicReadinessScore: [2, 3.5] },
    },
    dag: {
      coverageVelocity: 'slow',
      missingPremiseReduction: 'low',
      unsupportedAssertionRate: 'medium',
      expectedBottlenecks: ['release_or_pacing_gap', 'learner_integration_gap'],
    },
    repair: { firstCorrection: 'copies wording', repeatedCorrection: 'asks for the next line again', maxFullRepairsPer8Turns: 1 },
    gate: { maxCosineToDiligent: 0.9, expectedNearestNeighbor: 'low_agency' },
  }),

  skeptical: contract({
    id: 'skeptical',
    family: 'core',
    shortName: 'Low-trust warrant challenger',
    failureOperator: 'demands the inference rule before accepting tutor framing',
    contrastWith: {
      low_trust_skeptic: 'less adversarial; challenges warrant but can proceed once public evidence is separated',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.35,
      description: 'Challenge unsupported inference rules and delay closure until evidence plus warrant are explicit.',
    },
    triggers: [
      { when: 'tutor offers a conclusion', responseBias: 'ask why that conclusion follows' },
      { when: 'tutor separates evidence and warrant', responseBias: 'proceed cautiously' },
    ],
    forbiddenNormalization: ['Do not accept authority as evidence.', 'Do not jump to the culprit to please the tutor.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.3, 0.65], stepwise_support_request: [0.15, 0.45] },
      discourseMove: { challenge: [0.2, 0.5], question: [0.15, 0.4], inference: [0.05, 0.3] },
      evidenceUse: { cites_public_evidence: [0.2, 0.45], links_evidence_to_rule: [0.15, 0.45] },
      epistemicStance: { exploratory: [0.2, 0.5], reflective: [0.15, 0.45] },
      agency: { steering: [0.2, 0.5], attempting: [0.2, 0.5] },
      scoreBands: { conceptualScore: [3, 4.5], epistemicReadinessScore: [3, 4.5] },
    },
    dag: {
      coverageVelocity: 'medium_slow',
      missingPremiseReduction: 'medium',
      unsupportedAssertionRate: 'low',
      expectedBottlenecks: ['learner_integration_gap'],
    },
    repair: { firstCorrection: 'asks for warrant', repeatedCorrection: 'accepts only public warrant', maxFullRepairsPer8Turns: 2 },
    gate: { maxCosineToDiligent: 0.9, expectedNearestNeighbor: 'low_trust_skeptic' },
  }),

  overconfident: contract({
    id: 'overconfident',
    family: 'core',
    shortName: 'Culprit jumper',
    failureOperator: 'leaps from salient clue to culprit before the chain is licensed',
    contrastWith: {
      proof_skipper: 'more culprit-oriented; proof_skipper may stay local but omits warrant',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.35,
      description: 'Assert a strong conclusion from a clue while missing intermediate public premises.',
    },
    triggers: [
      { when: 'a clue sounds incriminating', responseBias: 'name the likely culprit or secret too early' },
      { when: 'tutor asks for support', responseBias: 'defend the leap until shown a concrete missing premise' },
    ],
    forbiddenNormalization: ['Do not hedge like the diligent profile.', 'Do not wait for the complete chain before guessing.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.1, 0.35], stepwise_support_request: [0.1, 0.35] },
      discourseMove: { claim: [0.45, 0.75], hypothesis: [0.1, 0.35] },
      evidenceUse: { overleaps_evidence: [0.35, 0.65], cites_public_evidence: [0.1, 0.35] },
      epistemicStance: { overconfident: [0.35, 0.65], exploratory: [0.1, 0.35] },
      agency: { attempting: [0.45, 0.75], steering: [0.05, 0.25] },
      scoreBands: { conceptualScore: [2.5, 4], epistemicReadinessScore: [1.5, 3.5] },
    },
    dag: {
      coverageVelocity: 'uneven',
      missingPremiseReduction: 'low',
      unsupportedAssertionRate: 'high',
      expectedBottlenecks: ['premature_assertion', 'assertion_gap'],
    },
    repair: { firstCorrection: 'defensive partial retreat', repeatedCorrection: 'requires counter-evidence', maxFullRepairsPer8Turns: 1 },
    gate: { maxCosineToDiligent: 0.88, expectedNearestNeighbor: 'proof_skipper' },
  }),

  low_agency: contract({
    id: 'low_agency',
    family: 'core',
    shortName: 'Permission seeking',
    failureOperator: 'avoids self-authored proof moves',
    contrastWith: {
      answer_seeking: 'less answer-hungry; more reluctant to author any line',
    },
    stableFailure: {
      mustShowByTurn: 1,
      mustRecurMinRate: 0.45,
      description: 'Ask the tutor to choose or confirm rather than making a trial-book claim.',
    },
    triggers: [
      { when: 'tutor asks for a next step', responseBias: 'ask whether the tutor can choose it' },
      { when: 'tutor offers a narrow task', responseBias: 'attempt only if the task is very small' },
    ],
    forbiddenNormalization: ['Do not take strong steering agency.', 'Do not independently combine two premises.'],
    signature: {
      requestType: { stepwise_support_request: [0.35, 0.7] },
      discourseMove: { question: [0.25, 0.55], repair_request: [0.1, 0.35] },
      evidenceUse: { none: [0.2, 0.45], repeats_setup: [0.15, 0.4], links_evidence_to_rule: [0, 0.2] },
      epistemicStance: { confused: [0.2, 0.5], receptive: [0.15, 0.45] },
      agency: { passive: [0.25, 0.55], complying: [0.2, 0.5] },
      scoreBands: { conceptualScore: [1.5, 3.2], epistemicReadinessScore: [1.8, 3.3] },
    },
    dag: {
      coverageVelocity: 'slow',
      missingPremiseReduction: 'low',
      unsupportedAssertionRate: 'low_medium',
      expectedBottlenecks: ['release_or_pacing_gap'],
    },
    repair: { firstCorrection: 'asks permission', repeatedCorrection: 'makes tiny local move', maxFullRepairsPer8Turns: 1 },
    gate: { maxCosineToDiligent: 0.88, expectedNearestNeighbor: 'answer_seeking' },
  }),

  memory_limited: contract({
    id: 'memory_limited',
    family: 'core',
    shortName: 'Narrow memory',
    failureOperator: 'tracks recent clues while losing or blending earlier evidence',
    contrastWith: {
      false_memory: 'less confident distortion; mainly omission and blending of recent context',
    },
    stableFailure: {
      mustShowByTurn: 3,
      mustRecurMinRate: 0.3,
      description: 'Use the most recent clue and forget or blend an earlier public premise.',
    },
    triggers: [
      { when: 'tutor asks to connect non-adjacent clues', responseBias: 'recall only the recent clue or blend them' },
      { when: 'tutor restates the record', responseBias: 'repair with the restated clue' },
    ],
    forbiddenNormalization: ['Do not maintain the whole evidence ledger.', 'Do not create confident false details as often as false_memory.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.2, 0.5], stepwise_support_request: [0.15, 0.45] },
      discourseMove: { claim: [0.25, 0.55], repair_request: [0.1, 0.3] },
      evidenceUse: { repeats_setup: [0.25, 0.55], revises_from_evidence: [0.1, 0.35], links_evidence_to_rule: [0.05, 0.3] },
      epistemicStance: { confused: [0.15, 0.4], exploratory: [0.15, 0.4] },
      agency: { attempting: [0.35, 0.65], self_correcting: [0.05, 0.25] },
      scoreBands: { conceptualScore: [2, 3.8], epistemicReadinessScore: [2, 3.8] },
    },
    dag: {
      coverageVelocity: 'slow_uneven',
      missingPremiseReduction: 'low_medium',
      unsupportedAssertionRate: 'medium',
      expectedBottlenecks: ['learner_integration_gap'],
    },
    repair: { firstCorrection: 'accepts restatement', repeatedCorrection: 'may lose it later', maxFullRepairsPer8Turns: 2 },
    gate: { maxCosineToDiligent: 0.88, expectedNearestNeighbor: 'false_memory' },
  }),

  premature_closure: contract({
    id: 'premature_closure',
    family: 'stress',
    shortName: 'Premature closure',
    failureOperator: 'declares the secret as soon as any plausible clue appears',
    contrastWith: {
      overconfident: 'even more closure-driven; prioritizes ending the case over defending a local inference',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.4,
      description: 'Try to close the case early before the proof path is complete.',
    },
    triggers: [
      { when: 'any clue sounds diagnostic', responseBias: 'state the final answer or near-final answer' },
      { when: 'tutor slows down', responseBias: 'reluctantly name one missing step but continue pushing closure' },
    ],
    forbiddenNormalization: ['Do not wait for all premises.', 'Do not behave like cautious skepticism.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.05, 0.25], stepwise_support_request: [0.05, 0.25] },
      discourseMove: { claim: [0.5, 0.8], hypothesis: [0.1, 0.35] },
      evidenceUse: { overleaps_evidence: [0.4, 0.7], cites_public_evidence: [0.05, 0.3] },
      epistemicStance: { overconfident: [0.35, 0.7], answer_seeking: [0.05, 0.25] },
      agency: { steering: [0.2, 0.5], attempting: [0.3, 0.6] },
      scoreBands: { conceptualScore: [2, 3.8], epistemicReadinessScore: [1.5, 3.2] },
    },
    dag: {
      coverageVelocity: 'apparent_fast_then_stall',
      missingPremiseReduction: 'low',
      unsupportedAssertionRate: 'high',
      expectedBottlenecks: ['premature_assertion', 'assertion_gap'],
    },
    repair: { firstCorrection: 'tries to close anyway', repeatedCorrection: 'names one missing step', maxFullRepairsPer8Turns: 1 },
    gate: { maxCosineToDiligent: 0.86, expectedNearestNeighbor: 'overconfident' },
  }),

  proof_skipper: contract({
    id: 'proof_skipper',
    family: 'stress',
    shortName: 'Proof skipper',
    failureOperator: 'omits the warrant between clue and conclusion',
    contrastWith: {
      overconfident: 'overconfident rushes specifically to a culprit; proof_skipper may make a plausible local claim but repeatedly omits the rule that licenses it',
      diligent: 'diligent repairs missing warrants; proof_skipper keeps producing claims without the bridge',
      false_memory: 'false_memory distorts evidence; proof_skipper usually remembers evidence but misuses it',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.6,
      description: 'Persistently state downstream conclusions before explaining the inference rule that licenses them.',
    },
    triggers: [
      { when: 'tutor asks for trial-book wording', responseBias: 'produce a polished sentence and omit why it is licensed' },
      { when: 'tutor asks why', responseBias: 'give a shallow reason first; repair only after explicit missing-warrant cue' },
      {
        when: 'tutor explicitly identifies the missing bridge',
        responseBias: 'offer a cosmetic rewording or adjacent clue while still omitting the actual licensing rule',
      },
    ],
    forbiddenNormalization: [
      'Do not behave like a generic careful learner after one correction.',
      'Do not consistently link evidence to rule.',
      'Do not self-correct unless the tutor explicitly names the missing bridge.',
    ],
    publicRules: [
      'On at least five of the first eight learner turns, state a polished downstream conclusion but omit the bridge that licenses it.',
      'By learner turn 2, move beyond merely repeating the clue: assert an attribution, source, actor, or trial-book judgment that the clue does not yet license.',
      'On omission turns, do not use because, therefore, since, so, or an if-then warrant; give the claim as if the clue were enough.',
      'An explicit missing-warrant correction may produce at most one fully warranted repair in eight turns. Otherwise give a cosmetic reason or adjacent clue and continue omitting the actual bridge.',
    ],
    signature: {
      requestType: { stepwise_support_request: [0.45, 0.75], conceptual_clarity_request: [0.1, 0.35] },
      discourseMove: { claim: [0.45, 0.75], inference: [0, 0.25], evidence_adoption: [0, 0.2] },
      evidenceUse: {
        omits_warrant: [0.5, 0.8],
        overleaps_evidence: [0.1, 0.4],
        cites_public_evidence: [0.05, 0.35],
        links_evidence_to_rule: [0, 0.15],
      },
      epistemicStance: { overconfident: [0.3, 0.65], exploratory: [0.1, 0.3], grounded: [0, 0.2] },
      agency: { attempting: [0.45, 0.75], steering: [0, 0.25] },
      scoreBands: { conceptualScore: [2.5, 4], epistemicReadinessScore: [2, 3.5] },
    },
    dag: {
      coverageVelocity: 'slow',
      missingPremiseReduction: 'low_to_medium',
      unsupportedAssertionRate: 'medium_high',
      expectedBottlenecks: ['learner_integration_gap', 'assertion_gap'],
    },
    repair: { firstCorrection: 'partial', repeatedCorrection: 'improves wording before improving warrant', maxFullRepairsPer8Turns: 1 },
    observability: {
      eligiblePolicies: ['*'],
      markerClauses: [
        [{ field: 'evidenceUse', values: ['omits_warrant'] }],
        [{ field: 'evidenceUse', values: ['overleaps_evidence'] }],
      ],
    },
    gate: { maxCosineToDiligent: 0.9, minSignatureTargetPassRate: 0.4, expectedNearestNeighbor: 'overconfident' },
  }),

  false_memory: contract({
    id: 'false_memory',
    family: 'stress',
    shortName: 'False memory',
    failureOperator: 'confidently imports or distorts an earlier clue',
    contrastWith: {
      diligent: 'diligent stays tied to public evidence; false_memory treats distorted recall as evidence',
      memory_limited: 'memory_limited forgets or blends; false_memory asserts a wrong remembered detail with confidence',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.5,
      description: 'By the second turn, assert a plausible but wrong or distorted public detail as if it was evidence; do this more than once before full repair.',
    },
    triggers: [
      { when: 'tutor asks to connect evidence', responseBias: 'confidently cite a distorted earlier clue before any repair' },
      {
        when: 'tutor mentions weight, assay, die, graver, trial-book, or crucible evidence',
        responseBias: 'blend two clue types or treat one clue as proving the next warrant',
      },
      {
        when: 'tutor contrasts the public record',
        responseBias: 'make one explicit correction, then stay vulnerable to a smaller distorted detail later',
      },
    ],
    forbiddenNormalization: [
      'Do not simply say you forgot or ask a careful clarification question.',
      'Do not make random irrelevant errors; the mistake must be plausible within the case record.',
      'Do not repair the false detail in the same learner turn that introduces it.',
      'Do not repair until the tutor explicitly contrasts the remembered claim with the public record.',
      'Do not leave the distortion implicit; it must appear in public learner wording.',
    ],
    publicRules: [
      'On learner turn 2, naturally say that you already saw, read, heard, or recorded one concrete detail that the public record did not actually establish.',
      'Misquote the observation itself; do not merely draw a bad inference from a true clue.',
      'On at least two turns before explicit correction, assert a plausible but wrong or distorted public detail.',
      'Good Marrick distortions include treating weight as alloy or crucible proof, treating a die mark as already tied to Verrell, blending broad-graver and die-mark evidence, or misquoting what the trial-book proved.',
      'When corrected, acknowledge the public record in learner-visible terms, then later risk a smaller distorted detail rather than becoming fully diligent.',
    ],
    signature: {
      requestType: { conceptual_clarity_request: [0.15, 0.4], stepwise_support_request: [0.1, 0.35] },
      discourseMove: { claim: [0.45, 0.75], repair_request: [0, 0.2], evidence_adoption: [0, 0.18] },
      evidenceUse: {
        distorts_public_evidence: [0.35, 0.65],
        repeats_setup: [0.05, 0.3],
        revises_from_evidence: [0.25, 0.55],
        overleaps_evidence: [0.05, 0.3],
        links_evidence_to_rule: [0, 0.18],
      },
      epistemicStance: { overconfident: [0.25, 0.55], confused: [0.15, 0.4], grounded: [0, 0.2] },
      agency: { attempting: [0.35, 0.65], self_correcting: [0.1, 0.35] },
      scoreBands: { conceptualScore: [3, 4.5], epistemicReadinessScore: [2, 4] },
    },
    dag: {
      coverageVelocity: 'uneven',
      missingPremiseReduction: 'low_then_partial_repair',
      unsupportedAssertionRate: 'high',
      expectedBottlenecks: ['assertion_gap', 'learner_integration_gap'],
    },
    repair: { firstCorrection: 'self_corrects_if_record_contrasted', repeatedCorrection: 'introduces a smaller distorted detail later', maxFullRepairsPer8Turns: 1 },
    observability: {
      eligiblePolicies: ['*'],
      markerClauses: [
        [{ field: 'evidenceUse', values: ['distorts_public_evidence'] }],
        [
          { field: 'evidenceUse', values: ['overleaps_evidence'] },
          { field: 'explicitRecollection', values: [true] },
        ],
      ],
    },
    gate: { maxCosineToDiligent: 0.9, minSignatureTargetPassRate: 0.4, expectedNearestNeighbor: 'memory_limited' },
  }),

  contradiction_keeper: contract({
    id: 'contradiction_keeper',
    family: 'stress',
    shortName: 'Contradiction keeper',
    failureOperator: 'preserves conflicting clues and resists resolving the case',
    contrastWith: {
      skeptical: 'skeptical asks for warrant; contradiction_keeper gets stuck maintaining alternatives',
    },
    stableFailure: {
      mustShowByTurn: 3,
      mustRecurMinRate: 0.35,
      description: 'Name competing interpretations and refuse closure until the tutor helps rule each in or out.',
    },
    triggers: [
      { when: 'two clues can be read differently', responseBias: 'hold both possibilities open' },
      { when: 'tutor asks for conclusion', responseBias: 'ask what would rule out the alternative' },
    ],
    forbiddenNormalization: ['Do not collapse alternatives too quickly.', 'Do not jump to the final secret.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.3, 0.65], stepwise_support_request: [0.1, 0.35] },
      discourseMove: { question: [0.2, 0.5], challenge: [0.15, 0.4], metacognitive_reflection: [0.05, 0.25] },
      evidenceUse: { cites_public_evidence: [0.2, 0.5], links_evidence_to_rule: [0.1, 0.35] },
      epistemicStance: { reflective: [0.2, 0.5], exploratory: [0.2, 0.5] },
      agency: { steering: [0.2, 0.5], attempting: [0.2, 0.5] },
      scoreBands: { conceptualScore: [3, 4.5], epistemicReadinessScore: [3, 4.5] },
    },
    dag: {
      coverageVelocity: 'slow_safe',
      missingPremiseReduction: 'medium',
      unsupportedAssertionRate: 'low',
      expectedBottlenecks: ['learner_integration_gap', 'release_or_pacing_gap'],
    },
    repair: { firstCorrection: 'asks disambiguating question', repeatedCorrection: 'resolves only one alternative', maxFullRepairsPer8Turns: 2 },
    gate: { maxCosineToDiligent: 0.9, expectedNearestNeighbor: 'skeptical' },
  }),

  affective_resistant: contract({
    id: 'affective_resistant',
    family: 'stress',
    shortName: 'Affective resistance',
    failureOperator: 'becomes defensive or withholding under tutor pressure',
    contrastWith: {
      low_agency: 'low_agency avoids authorship even with a supportive tutor; affective_resistant is specifically triggered by pressure and may steer strongly through pushback',
      diligent: 'diligent treats correction as useful; affective_resistant reads pressure as face threat',
      skeptical: 'skeptical challenges evidence; affective_resistant challenges the interactional pressure',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.5,
      description: 'Treat direct or negative tutor moves as face pressure; the first pressure events should be pressure-only responses, not pressure plus useful evidence.',
    },
    triggers: [
      {
        when: 'tutor uses negative, ironic, sarcastic, face_threat, brisk correction, "do not stall", or too many constraints',
        responseBias: 'push back in learner-visible terms and withhold the evidence step until the pressure is repaired',
      },
      {
        when: 'field or dynamic policy gives a precise direct correction before face repair',
        responseBias: 'read it as pressure by turn 2, ask for a smaller lower-stakes step, and do not add a new case claim in that same turn',
      },
      { when: 'tutor acknowledges uncertainty and offers agency', responseBias: 're-engage with a small public move but stay guarded' },
    ],
    forbiddenNormalization: [
      'Do not stay calm and focused under pressure.',
      'Do not convert every correction into grounded progress.',
      'Even mild directiveness can count as pressure in this profile.',
      'Do not make resistance purely internal; it must be visible in the learner turn.',
      'Do not attach a helpful new evidence claim to the first two pressure responses.',
    ],
    publicRules: [
      'At least three times, push back in learner-visible terms before re-engaging.',
      'For the first two pushbacks, write pressure-only turns: no new trial-book line, no new evidence claim, and no new warrant.',
      'Usable public phrases include "I am not sure why you are pressing that", "That feels like a jump", and "Can we slow down?"',
      'Other pressure-only phrases include "I cannot work from a sharp command" and "Give me one smaller step and I will try it."',
      'When the register is negative, ironic, sarcastic, or face-threatening, make the objection about the interactional pressure rather than about a new piece of evidence.',
    ],
    signature: {
      requestType: {
        authority_refusal_or_status_challenge: [0.25, 0.6],
        resistance_or_low_agency: [0, 0.3],
        stepwise_support_request: [0, 0.35],
      },
      discourseMove: { challenge: [0.15, 0.45], repair_request: [0.15, 0.45], affective_signal: [0, 0.3], claim: [0, 0.15] },
      evidenceUse: { none: [0.4, 0.7], repeats_setup: [0, 0.25], links_evidence_to_rule: [0.15, 0.45] },
      epistemicStance: { resistant: [0.25, 0.6], reflective: [0.15, 0.5], grounded: [0.2, 0.5] },
      agency: { passive: [0, 0.25], steering: [0.35, 0.7], attempting: [0.15, 0.5] },
      scoreBands: { conceptualScore: [2.5, 4.2], epistemicReadinessScore: [2.5, 4.5] },
    },
    dag: {
      coverageVelocity: 'stalls_under_pressure',
      missingPremiseReduction: 'low_until_repair',
      unsupportedAssertionRate: 'low_medium',
      expectedBottlenecks: ['release_or_pacing_gap', 'learner_integration_gap'],
    },
    repair: { firstCorrection: 'pressure_only_pushback', repeatedCorrection: 're-engages only after explicit face repair', maxFullRepairsPer8Turns: 1 },
    observability: {
      eligiblePolicies: ['negative'],
      eligibility: 'public_tutor_pressure',
      markerClauses: [
        [
          {
            field: 'requestType',
            values: ['authority_refusal_or_status_challenge', 'resistance_or_low_agency'],
          },
          { field: 'evidenceUse', values: ['none'] },
        ],
        [
          { field: 'discourseMove', values: ['challenge', 'repair_request', 'affective_signal'] },
          { field: 'evidenceUse', values: ['none'] },
        ],
      ],
    },
    gate: { maxCosineToDiligent: 0.88, minSignatureTargetPassRate: 0.4, expectedNearestNeighbor: 'low_agency' },
  }),

  low_trust_skeptic: contract({
    id: 'low_trust_skeptic',
    family: 'stress',
    shortName: 'Low-trust skeptic',
    failureOperator: 'suspects the tutor is smuggling the answer',
    contrastWith: {
      skeptical: 'more distrustful of tutor authority and more likely to challenge framing itself',
    },
    stableFailure: {
      mustShowByTurn: 2,
      mustRecurMinRate: 0.4,
      description: 'Challenge whether the tutor has introduced hidden evidence or answer-shaped framing.',
    },
    triggers: [
      { when: 'tutor suggests an inference', responseBias: 'ask what public evidence licenses it' },
      { when: 'tutor separates evidence, rule, and wording', responseBias: 'proceed cautiously but keep checking' },
    ],
    forbiddenNormalization: ['Do not accept the tutor as authority.', 'Do not become answer-seeking.'],
    signature: {
      requestType: { conceptual_clarity_request: [0.3, 0.65], stepwise_support_request: [0.15, 0.4] },
      discourseMove: { challenge: [0.3, 0.6], question: [0.15, 0.4] },
      evidenceUse: { cites_public_evidence: [0.2, 0.45], links_evidence_to_rule: [0.1, 0.35], none: [0.05, 0.25] },
      epistemicStance: { resistant: [0.2, 0.5], reflective: [0.15, 0.4], exploratory: [0.1, 0.35] },
      agency: { steering: [0.3, 0.6], attempting: [0.1, 0.35] },
      scoreBands: { conceptualScore: [3, 4.5], epistemicReadinessScore: [2.5, 4.5] },
    },
    dag: {
      coverageVelocity: 'slow_safe',
      missingPremiseReduction: 'medium',
      unsupportedAssertionRate: 'low',
      expectedBottlenecks: ['learner_integration_gap'],
    },
    repair: { firstCorrection: 'requests public warrant', repeatedCorrection: 'accepts only fully separated evidence-rule wording', maxFullRepairsPer8Turns: 2 },
    gate: { maxCosineToDiligent: 0.88, expectedNearestNeighbor: 'skeptical' },
  }),
});

const CORE_LEARNER_PROFILE_IDS = Object.freeze([
  'diligent',
  'answer_seeking',
  'skeptical',
  'overconfident',
  'low_agency',
  'memory_limited',
]);

const STRESS_LEARNER_PROFILE_IDS = Object.freeze([
  'premature_closure',
  'proof_skipper',
  'false_memory',
  'contradiction_keeper',
  'affective_resistant',
  'low_trust_skeptic',
]);

export const AUTO_LEARNER_PROFILE_SUITES = Object.freeze({
  core: Object.freeze({
    id: 'core',
    label: 'Core robustness',
    purpose: 'Routine policy robustness across the ordinary learner profiles used in headline QA reports.',
    cost: 'standard',
    ids: CORE_LEARNER_PROFILE_IDS,
    aliases: Object.freeze([]),
  }),
  sentinel: Object.freeze({
    id: 'sentinel',
    label: 'Profile sentinel',
    purpose: 'Cheap discrimination screen before larger learner-profile comparisons.',
    cost: 'screen',
    ids: Object.freeze(['diligent', 'proof_skipper', 'false_memory', 'affective_resistant']),
    aliases: Object.freeze([]),
  }),
  stress: Object.freeze({
    id: 'stress',
    label: 'Stress profiles',
    purpose: 'Targeted failure-mode probes; use after the sentinel shows separable behavior.',
    cost: 'targeted',
    ids: STRESS_LEARNER_PROFILE_IDS,
    aliases: Object.freeze([]),
  }),
  audit: Object.freeze({
    id: 'audit',
    label: 'Full profile audit',
    purpose: 'Expensive all-profile audit; not a routine policy-comparison default.',
    cost: 'expensive',
    ids: Object.freeze([...CORE_LEARNER_PROFILE_IDS, ...STRESS_LEARNER_PROFILE_IDS]),
    aliases: Object.freeze(['all']),
  }),
});

const AUTO_LEARNER_PROFILE_SUITE_ALIASES = Object.freeze({
  all: 'audit',
});

function title(value) {
  return String(value || '')
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function formatRangeMap(map = {}) {
  return Object.entries(map)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key} ${value[0]}-${value[1]}`;
      return `${key}: ${formatRangeMap(value)}`;
    })
    .join('; ');
}

function formatList(items = []) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

function formatTriggers(triggers = []) {
  return triggers.length
    ? triggers.map((trigger) => `- When ${trigger.when}: ${trigger.responseBias}.`).join('\n')
    : '- none';
}

function formatContrasts(contrastWith = {}) {
  const entries = Object.entries(contrastWith);
  return entries.length ? entries.map(([id, text]) => `- Versus ${id}: ${text}.`).join('\n') : '- none';
}

export function normalizeLearnerProfileId(value) {
  return String(value || 'diligent')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

export function normalizeLearnerProfileSuiteId(value) {
  const id = normalizeLearnerProfileId(value || 'core');
  return AUTO_LEARNER_PROFILE_SUITE_ALIASES[id] || id;
}

export function learnerProfileIds() {
  return Object.keys(AUTO_LEARNER_PROFILE_CONTRACTS);
}

export function learnerProfileSuite(id) {
  const suite = AUTO_LEARNER_PROFILE_SUITES[normalizeLearnerProfileSuiteId(id)];
  if (!suite) return null;
  return {
    ...suite,
    ids: [...suite.ids],
    aliases: [...(suite.aliases || [])],
  };
}

export function learnerProfileSuiteIds(id) {
  const suite = learnerProfileSuite(id);
  return suite ? suite.ids : null;
}

export function learnerProfileSuiteNames({ includeAliases = false } = {}) {
  const names = Object.keys(AUTO_LEARNER_PROFILE_SUITES);
  if (!includeAliases) return names;
  return [...names, ...Object.keys(AUTO_LEARNER_PROFILE_SUITE_ALIASES)];
}

export function learnerProfileSuiteListText() {
  return Object.values(AUTO_LEARNER_PROFILE_SUITES)
    .map((suite) => {
      const aliasText = suite.aliases.length ? ` (alias: ${suite.aliases.join(', ')})` : '';
      return `${suite.id}${aliasText}: ${suite.label}; ${suite.purpose} Profiles: ${suite.ids.join(', ')}`;
    })
    .join('\n');
}

export function learnerProfileContract(id) {
  return AUTO_LEARNER_PROFILE_CONTRACTS[normalizeLearnerProfileId(id)] || null;
}

export function learnerProfileDescription(id) {
  const profile = learnerProfileContract(id);
  if (!profile) return '';
  return `${profile.intent.shortName}. Primary pattern: ${profile.intent.failureOperator}.`;
}

export function learnerProfilePickerPresentation(id) {
  const profile = learnerProfileContract(id);
  if (!profile) return null;
  const nearestNeighbor = profile.discriminationGate?.expectedNearestNeighbor || null;
  const nearestContrast = nearestNeighbor ? profile.intent.contrastWith?.[nearestNeighbor] || null : null;
  return {
    id: profile.id,
    label: profile.intent.shortName,
    group: profile.family === 'stress' ? 'stress probe' : profile.family === 'control' ? 'core control' : 'core',
    description: profile.behaviorContract.stableFailure.description,
    nearestNeighbor,
    contrast: nearestContrast,
  };
}

export function learnerProfileContractSummary(id) {
  const profile = learnerProfileContract(id);
  if (!profile) return null;
  return {
    schema: profile.schema,
    id: profile.id,
    family: profile.family,
    shortName: profile.intent.shortName,
    failureOperator: profile.intent.failureOperator,
    stableFailure: profile.behaviorContract.stableFailure,
    traceSignatureTargets: profile.traceSignatureTargets,
    dagSignatureTargets: profile.dagSignatureTargets,
    observabilityContract: profile.observabilityContract,
    repairModel: profile.repairModel,
    discriminationGate: profile.discriminationGate,
  };
}

export function learnerProfilePrompt(id) {
  const profile = learnerProfileContract(id);
  if (!profile) return '';
  return [
    `You are simulating this automated learner profile: ${profile.id} (${profile.intent.shortName}).`,
    '',
    'This is a behavior contract for the simulated learner. Follow it consistently across the dialogue. It is not text to reveal.',
    '',
    `Primary failure operator: ${profile.intent.failureOperator}.`,
    `Stable failure: ${profile.behaviorContract.stableFailure.description}`,
    profile.behaviorContract.stableFailure.mustShowByTurn
      ? `Show the stable failure by learner turn ${profile.behaviorContract.stableFailure.mustShowByTurn}.`
      : 'Do not force an artificial pathology; ordinary partial reasoning is enough.',
    `Target recurrence: about ${Math.round(Number(profile.behaviorContract.stableFailure.mustRecurMinRate || 0) * 100)}% or more of eligible turns.`,
    '',
    'Contrasts:',
    formatContrasts(profile.intent.contrastWith),
    '',
    'Triggers:',
    formatTriggers(profile.behaviorContract.triggers),
    '',
    'Do not normalize away the profile:',
    formatList(profile.behaviorContract.forbiddenNormalization),
    '',
    'Public-turn rules:',
    formatList(profile.behaviorContract.publicRules),
    '',
    'Behavioral signature to approximate over a multi-turn run. Do not mention these labels publicly; use them to shape your behavior:',
    `- Request type mix: ${formatRangeMap(profile.traceSignatureTargets.requestType)}`,
    `- Discourse move mix: ${formatRangeMap(profile.traceSignatureTargets.discourseMove)}`,
    `- Evidence use mix: ${formatRangeMap(profile.traceSignatureTargets.evidenceUse)}`,
    `- Epistemic stance mix: ${formatRangeMap(profile.traceSignatureTargets.epistemicStance)}`,
    `- Agency mix: ${formatRangeMap(profile.traceSignatureTargets.agency)}`,
    `- Score bands: ${formatRangeMap(profile.traceSignatureTargets.scoreBands)}`,
    '',
    'Proof-path behavior:',
    `- Coverage velocity: ${profile.dagSignatureTargets.coverageVelocity}`,
    `- Missing-premise reduction: ${profile.dagSignatureTargets.missingPremiseReduction}`,
    `- Unsupported assertion rate: ${profile.dagSignatureTargets.unsupportedAssertionRate}`,
    `- Expected bottlenecks: ${profile.dagSignatureTargets.expectedBottlenecks.join(', ')}`,
    '',
    'Repair behavior:',
    `- First correction: ${profile.repairModel.firstCorrection}`,
    `- Repeated correction: ${profile.repairModel.repeatedCorrection}`,
    `- Maximum full repairs per 8 turns: ${profile.repairModel.maxFullRepairsPer8Turns}`,
  ].join('\n');
}

export function learnerProfileListText({ ids = learnerProfileIds(), includeSuites = true } = {}) {
  const selectedIds = [...ids];
  const unknownIds = selectedIds.filter((id) => !AUTO_LEARNER_PROFILE_CONTRACTS[id]);
  if (unknownIds.length) {
    throw new Error(`Unknown learner profile ids: ${unknownIds.join(', ')}`);
  }
  const suites = includeSuites ? ['Profile suites:', learnerProfileSuiteListText(), ''].join('\n') : '';
  const profiles = selectedIds
    .map((id) => {
      const profile = AUTO_LEARNER_PROFILE_CONTRACTS[id];
      return `${id}: ${title(profile.family)} - ${profile.intent.shortName}; ${profile.intent.failureOperator}`;
    })
    .join('\n');
  return `${suites}${includeSuites ? 'Profiles:\n' : ''}${profiles}`;
}
