// Shared synthetic fixtures for tests/tutorStubRegisterPolicy.test.js.
//
// Label choices are deliberate: the default classification uses only labels
// that match NONE of the register-policy signal regexes (no 'complying',
// no 'answer_seeking', no 'step…' in the summary), so hand-derived golden
// scores in the test stay legible. Variants override one field at a time.

export const FULL_PALETTE = [
  'plain',
  'precise',
  'brisk',
  'warm',
  'witnessing',
  'charismatic',
  'ironic',
  'sarcastic',
  'face_threat',
];

export function classificationFixture(turnOverrides = {}) {
  return {
    turn: {
      summary: 'Learner links the assay residue to the rule.',
      request_type: 'unknown_request',
      discourse_move: 'inference',
      evidence_use: 'links_evidence_to_rule',
      epistemic_stance: 'exploratory',
      agency: 'attempting',
      affect: 'neutral',
      scores: {
        conceptual_engagement: { score: 3 },
        epistemic_readiness: { score: 4 },
      },
      ...turnOverrides,
    },
  };
}

// A weaker prior turn: every field-point dimension ranks strictly below the
// default fixture, giving a clean hand-computable field-progress delta.
export function weakClassificationFixture(turnOverrides = {}) {
  return classificationFixture({
    summary: 'Learner repeats the charge against Verrell.',
    discourse_move: 'question',
    evidence_use: 'repeats_setup',
    epistemic_stance: 'receptive',
    agency: 'complying',
    scores: {
      conceptual_engagement: { score: 2 },
      epistemic_readiness: { score: 2 },
    },
    ...turnOverrides,
  });
}

export function dagModelFixture({ turn = 1, assessment = {}, metrics = {}, learnerAdvance = null } = {}) {
  return {
    turn,
    assessment: {
      bottleneck: 'none',
      bestPathCoverage: 0.25,
      unsupportedAssertionCount: 0,
      missingPremiseCount: 2,
      finalSecretEntailed: false,
      assertedSecret: false,
      assertedMirror: false,
      ...assessment,
    },
    metrics: {
      groundedCount: 1,
      voicedDerivedCount: 0,
      candidateConclusionCount: 0,
      answerCandidateCount: 0,
      missingPremiseCount: 2,
      ...metrics,
    },
    learnerAdvance,
  };
}

export function tutorLearnerDagFixture(model = dagModelFixture(), extras = {}) {
  return { model, advance: null, accepted: null, ...extras };
}

export function stateFixture({
  palette = FULL_PALETTE,
  turns = [],
  history = [],
  temperature = 0.85,
  policy = 'dynamical_system',
} = {}) {
  return {
    turns,
    register: { enabled: true, policy, palette: [...palette], history, temperature },
  };
}

export function historicalTurnFixture({ turn, classification, model }) {
  return { turn, classification, tutorLearnerDagModel: model };
}

// DAG-model pair engineered so dagProgressScalar is (near-)identical while
// dagRiskScalar differs by exactly 5: missing +20 costs 20*0.15 = 3 on the
// progress scalar, which grounded +3 restores; on the risk scalar it adds
// 20*0.25 = 5. Varying only early-history turns between the two produces a
// riskRising trajectory without moving the field or DAG traces.
export function lowRiskDagModelFixture(turn) {
  return dagModelFixture({
    turn,
    assessment: { missingPremiseCount: 2, unsupportedAssertionCount: 1 },
    metrics: { missingPremiseCount: 2, groundedCount: 1 },
  });
}

export function highRiskDagModelFixture(turn) {
  return dagModelFixture({
    turn,
    assessment: { missingPremiseCount: 22, unsupportedAssertionCount: 1 },
    metrics: { missingPremiseCount: 22, groundedCount: 4 },
  });
}
