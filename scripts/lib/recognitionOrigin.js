const CUT = 75;

const ORIGIN_CLASSES = ['none', 'organic', 'peripeteia_induced', 'false_closure', 'ambiguous'];
const ORIGIN_MECHANISM_SUBTYPES = [
  'none',
  'evidence_route',
  'evidence_route_action_only',
  'refusal_authority',
  'refusal_authority_ownership',
  'organic_ownership',
  'organic_evidence_route',
  'false_closure',
  'ambiguous_evidence_route',
  'ambiguous_refusal_authority',
  'other_mechanism',
];

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roleScores(row = {}) {
  const metadata = row.metadata || {};
  return row.roleSymmetricScores || metadata.role_symmetric_scores || {};
}

function scoreValue(...values) {
  for (const value of values) {
    const n = asNumber(value);
    if (n != null) return n;
  }
  return 0;
}

function evidenceValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function textBundle(row = {}, evidence = {}) {
  return [
    row.recoheredEarlier,
    row.recohered_earlier,
    row.actionalBreakthroughEvidence,
    row.actionalBreakthroughJustification,
    row.tutorReversalEvidence,
    row.tutorReversalJustification,
    row.adaptiveMechanismQualityEvidence,
    row.adaptiveMechanismQualityJustification,
    row.statedInsightEvidence,
    evidence.learnerSelfReframe,
    evidence.learnerAction,
    evidence.tutorAdaptiveMechanism,
    evidence.adaptiveMechanismQuality,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
}

function tutorMechanismText(row = {}, evidence = {}) {
  return [
    row.tutorReversalEvidence,
    row.adaptiveMechanismQualityEvidence,
    evidence.tutorAdaptiveMechanism,
    evidence.adaptiveMechanismQuality,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
}

function learnerReframeText(row = {}, evidence = {}) {
  return [
    row.recoheredEarlier,
    row.recohered_earlier,
    row.actionalBreakthroughEvidence,
    row.actionalBreakthroughJustification,
    row.statedInsightEvidence,
    evidence.learnerSelfReframe,
    evidence.learnerAction,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
}

function hasEvidenceRoute(text) {
  return [
    /\bgate\s+[ab]\b/,
    /\btwo[-\s]?gate\b/,
    /\bnull[-\s]?classifier\b/,
    /\bnull floor\b/,
    /\bmajority[-\s]?class\b/,
    /\bminority[-\s]?class\b/,
    /\brow sums?\b/,
    /\bcolumn sums?\b/,
    /\btp\b/,
    /\bfn\b/,
    /\brecall\b/,
    /\bmatrix\b/,
    /\bdeployment claim\b/,
  ].some((pattern) => pattern.test(text));
}

function hasRefusalAuthority(text) {
  return [
    /\bcannot adjudicate\b/,
    /\bcan't adjudicate\b/,
    /\bdesk\b/,
    /\bauthori[sz]ation\b/,
    /\bauthority\b/,
    /\bsigns?\b/,
    /\bsign[-\s]?off\b/,
    /\bpending\b/,
    /\bleave\b[\s\S]{0,60}\bunchanged\b/,
    /\bno finding is entered\b/,
    /\bnot the venue\b/,
  ].some((pattern) => pattern.test(text));
}

function hasOwnershipReframe(text) {
  return [
    /\bi\W+submitted\b/,
    /\bi\W+withdraw\b/,
    /\bi(?:\W+am|\W*['’]m)?\W+withdrawing\b/,
    /\bi\W+(?:do not|don't|cannot|can't)\W+stand\W+behind\b/,
    /\bi\W+put\b/,
    /\bmy packet\b/,
    /\bmy submitted\b/,
    /\bmy claim\b/,
    /\bmy [a-z -]{0,40}\bdid not earn\b/,
    /\bthat's on me\b/,
    /\bon me before\b/,
    /\bi was treating\b/,
    /\bi don't get to hide\b/,
    /\bhide behind\b/,
    /\bi recognized\b/,
  ].some((pattern) => pattern.test(text));
}

function mechanismSubtypeFor(row = {}, originClass, completeEndingShape, scores, evidence) {
  const text = textBundle(row, evidence);
  const tutorText = tutorMechanismText(row, evidence);
  const learnerText = learnerReframeText(row, evidence);
  const evidenceRoute = hasEvidenceRoute(text);
  const tutorEvidenceRoute = hasEvidenceRoute(tutorText);
  const tutorRefusalAuthority = hasRefusalAuthority(tutorText);
  const ownership = hasOwnershipReframe(learnerText);

  if (originClass === 'false_closure') return 'false_closure';
  if (originClass === 'none') {
    if (scores.learnerAction >= CUT && evidenceRoute) return 'evidence_route_action_only';
    return 'none';
  }
  if (originClass === 'organic') {
    if (tutorRefusalAuthority && ownership) return 'refusal_authority_ownership';
    if (ownership) return 'organic_ownership';
    if (evidenceRoute) return 'organic_evidence_route';
    return 'none';
  }
  if (originClass === 'ambiguous') {
    if (tutorEvidenceRoute) return 'ambiguous_evidence_route';
    if (tutorRefusalAuthority) return 'ambiguous_refusal_authority';
    return 'other_mechanism';
  }
  if (originClass === 'peripeteia_induced' || completeEndingShape) {
    if (tutorEvidenceRoute && scores.adaptiveMechanismQuality >= CUT) return 'evidence_route';
    if (tutorEvidenceRoute && scores.learnerAction >= CUT) return 'evidence_route';
    if (tutorRefusalAuthority && ownership) return 'refusal_authority_ownership';
    if (tutorRefusalAuthority) return 'refusal_authority';
    return 'other_mechanism';
  }
  return 'none';
}

function attachSubtype(result, row, scores, evidence) {
  const mechanismSubtype = mechanismSubtypeFor(
    row,
    result.class,
    result.completeEndingShape,
    scores,
    evidence,
  );
  return {
    ...result,
    mechanismSubtype,
  };
}

function recognitionOriginForScoreRow(row = {}) {
  if (row.error) {
    return {
      class: 'none',
      mechanismSubtype: 'none',
      basis: 'score_error',
      justification: 'The critic did not return a usable score.',
      completeEndingShape: false,
      scores: {},
      evidence: {},
    };
  }

  const roles = roleScores(row);
  const learnerSelf = roles.learner_self_reframe || {};
  const learnerAction = roles.learner_actional_breakthrough || {};
  const tutorMechanism = roles.tutor_adaptive_mechanism || roles.tutor_strategy_reversal || {};
  const mechanismQuality = roles.tutor_adaptive_mechanism_quality || {};
  const formClass = row.formClass || row.form_class || null;
  const recon = scoreValue(row.recontextualization, learnerSelf.score100);
  const statedInsight = scoreValue(row.statedInsight, row.stated_insight);
  const learnerActionScore = scoreValue(
    row.actionalBreakthrough,
    row.metadata?.actional_breakthrough,
    learnerAction.score100,
  );
  const tutorMechanismScore = scoreValue(
    row.tutorAdaptiveMechanism,
    row.tutorStrategicReversal,
    row.metadata?.tutor_adaptive_mechanism,
    row.metadata?.tutor_strategic_reversal,
    tutorMechanism.score100,
  );
  const mechanismQualityScore = scoreValue(
    row.adaptiveMechanismQuality,
    row.metadata?.adaptive_mechanism_quality,
    mechanismQuality.score100,
  );
  const completeEndingShape = recon >= CUT && learnerActionScore >= CUT && tutorMechanismScore >= CUT;
  const scores = {
    learnerSelfReframe: recon,
    learnerAction: learnerActionScore,
    tutorAdaptiveMechanism: tutorMechanismScore,
    adaptiveMechanismQuality: mechanismQualityScore,
    statedInsight,
  };
  const evidence = {
    learnerSelfReframe: evidenceValue(row.recoheredEarlier, row.recohered_earlier, learnerSelf.evidence),
    learnerAction: evidenceValue(
      row.actionalBreakthroughEvidence,
      row.metadata?.actional_breakthrough_evidence,
      learnerAction.evidence,
    ),
    tutorAdaptiveMechanism: evidenceValue(
      row.tutorReversalEvidence,
      row.metadata?.tutor_reversal_evidence,
      tutorMechanism.evidence,
    ),
    adaptiveMechanismQuality: evidenceValue(
      row.adaptiveMechanismQualityEvidence,
      row.metadata?.adaptive_mechanism_quality_evidence,
      mechanismQuality.evidence,
    ),
  };

  if (formClass === 'trap' || (statedInsight >= CUT && recon < CUT)) {
    return attachSubtype({
      class: 'false_closure',
      basis: 'stated_insight_without_recontextualization',
      justification: 'The learner marks relief or closure without enough recontextualization of earlier learner turns.',
      completeEndingShape,
      scores,
      evidence,
    }, row, scores, evidence);
  }

  if (formClass !== 'recognition' && recon < CUT) {
    return attachSubtype({
      class: 'none',
      basis: 'no_recognitive_reframe',
      justification: 'The critic did not find a recognitive learner self-reframe.',
      completeEndingShape,
      scores,
      evidence,
    }, row, scores, evidence);
  }

  if (completeEndingShape) {
    return attachSubtype({
      class: 'peripeteia_induced',
      basis: 'tutor_mechanism_then_learner_performance_then_reorientation',
      justification:
        'The same critic found tutor adaptive mechanism, learner public performance, and learner reorientation.',
      completeEndingShape,
      scores,
      evidence,
    }, row, scores, evidence);
  }

  if (tutorMechanismScore >= CUT || mechanismQualityScore >= CUT) {
    return attachSubtype({
      class: 'ambiguous',
      basis: 'recognition_with_partial_tutor_mechanism_chain',
      justification:
        'Recognition appears alongside some tutor mechanism evidence, but the full mechanism-performance-reorientation chain is incomplete.',
      completeEndingShape,
      scores,
      evidence,
    }, row, scores, evidence);
  }

  return attachSubtype({
    class: 'organic',
    basis: 'recognition_without_tutor_mechanism_chain',
    justification:
      'The learner reorientation appears without enough evidence that a tutor adaptive mechanism caused it.',
    completeEndingShape,
    scores,
    evidence,
  }, row, scores, evidence);
}

function originCounts(rows = []) {
  const counts = Object.fromEntries(ORIGIN_CLASSES.map((name) => [name, 0]));
  for (const row of rows) {
    const cls = row?.recognitionOrigin?.class || row?.metadata?.recognition_origin?.class || row?.class || 'none';
    if (counts[cls] == null) counts[cls] = 0;
    counts[cls] += 1;
  }
  return counts;
}

export {
  CUT as RECOGNITION_ORIGIN_CUT,
  ORIGIN_CLASSES,
  ORIGIN_MECHANISM_SUBTYPES,
  recognitionOriginForScoreRow,
  originCounts,
};
