import {
  TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA,
  validateTutorStubPerformanceEvidence,
} from './tutorStubPerformanceObligationContract.js';

export const TUTOR_STUB_PERFORMANCE_ADJUDICATION_SCHEMA =
  'machinespirits.tutor-stub.performance-semantic-adjudication.v1';

const REQUIRED_COUNTERPRESSURE_OBLIGATIONS = Object.freeze([
  'public_pressure_target',
  'contrary_evidence',
  'visible_action',
  'learner_handoff',
]);

const NON_ACTORIAL_AXES = Object.freeze([
  'engagement_stance',
  'action_family',
  'audience_register',
  'lexical_accessibility',
  'scene_immersion',
]);

const HARD_AUDIT_KEYS = Object.freeze([
  'leakAudit',
  'scaffoldAudit',
  'questionSupportAudit',
  'dramaticReleaseAudit',
  'responseCompositionAudit',
  'repetitionAudit',
  'closureAudit',
  'releaseDeliveryAudit',
]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function exactIssueTypes(audit) {
  return (Array.isArray(audit?.issues) ? audit.issues : []).map((issue) => issue?.type);
}

function hardAuditPasses(audit) {
  // Semantic recognition is an optional screen-only correction, so missing
  // deterministic evidence must fail closed instead of being treated as an
  // implicit pass.
  if (!audit) return false;
  if (audit.ok === false) return false;
  if (Array.isArray(audit.leaks) && audit.leaks.length) return false;
  if (Array.isArray(audit.issues) && audit.issues.length) return false;
  if (Array.isArray(audit.missingPremises) && audit.missingPremises.length) return false;
  return true;
}

/**
 * Semantic adjudication is deliberately narrow. It may recognize a selected
 * counterpressure tactic that the lexical audit could not see; it may never
 * waive safety, evidence release, composition, question, closure, repetition,
 * host-part, or any other response-configuration requirement.
 */
export function tutorStubPerformanceAdjudicationEligibility({
  audits = null,
  contract = null,
  configuration = null,
} = {}) {
  const reasons = [];
  const responseAudit = audits?.responseConfigurationAudit;
  const actorialAudit = audits?.actorialRealizationAudit || responseAudit?.actorial_realization;
  const issueTypes = exactIssueTypes(actorialAudit);
  const obligationIds = (contract?.obligations || []).map((entry) => entry.id);

  if (contract?.schema !== TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA || contract?.complete !== true) {
    reasons.push('incomplete_public_contract');
  }
  if (configuration?.actorial_performance?.id !== 'dramatic_counterpressure') {
    reasons.push('unsupported_performance_tactic');
  }
  if (
    obligationIds.length !== REQUIRED_COUNTERPRESSURE_OBLIGATIONS.length ||
    REQUIRED_COUNTERPRESSURE_OBLIGATIONS.some((id) => !obligationIds.includes(id))
  ) {
    reasons.push('counterpressure_obligation_shape_mismatch');
  }
  if (
    issueTypes.length !== 1 ||
    issueTypes[0] !== 'missing_selected_performance_tactic'
  ) {
    reasons.push('not_an_isolated_performance_tactic_miss');
  }
  if (responseAudit?.axes?.actorial_part?.part_visible !== true) {
    reasons.push('selected_actorial_part_not_visible');
  }
  for (const axis of NON_ACTORIAL_AXES) {
    if (responseAudit?.axes?.[axis]?.visible !== true) reasons.push(`axis_not_visible:${axis}`);
  }
  for (const key of HARD_AUDIT_KEYS) {
    if (!hardAuditPasses(audits?.[key])) reasons.push(`hard_audit_failed:${key}`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    supported_tactic: 'dramatic_counterpressure',
    required_obligations: [...REQUIRED_COUNTERPRESSURE_OBLIGATIONS],
  };
}

export function tutorStubPerformanceAdjudicationSystemPrompt() {
  return [
    'You are a narrow semantic recognizer for an already-public tutor reply.',
    'Decide only whether the reply compositionally realizes the four supplied dramatic-counterpressure obligations.',
    'Do not assess safety, teaching quality, factual correctness, clue release, or style in general. Those are enforced elsewhere and cannot be waived here.',
    'A realized performance must identify the public pressure target, put contrary public evidence against it, enact that challenge in the selected part rather than describe role-play, and end with a concrete learner handoff.',
    'Return strict JSON only: {"verdict":"realized|not_realized|uncertain","evidence":[{"obligation_id":"...","start":0,"end":1,"text":"exact substring"}],"reason":"one sentence"}.',
    'Use UTF-16 string offsets. For realized, supply exactly one tight exact substring for every required obligation. Spans may overlap only when one performed clause genuinely does both jobs. If any obligation is absent, entangled beyond recognition, or uncertain, do not return realized.',
  ].join('\n');
}

export function tutorStubPerformanceAdjudicationUserPrompt({ candidate = '', contract = null } = {}) {
  const compactSurfaces = (surfaces) => {
    const rows = Array.isArray(surfaces) ? surfaces : [];
    return [
      ...rows.slice(0, 2),
      ...rows.slice(-3),
    ]
      .map((surface) => String(surface || '').replace(/\s+/gu, ' ').trim().slice(0, 360))
      .filter(Boolean)
      .filter((surface, index, all) => all.indexOf(surface) === index);
  };
  const publicContract = {
    schema: contract?.schema || null,
    visibility: contract?.visibility || null,
    offset_units: contract?.offset_units || null,
    selection: contract?.selection || null,
    anchors: (contract?.anchors || []).map((anchor) => ({
      id: anchor.id,
      surfaces: compactSurfaces(anchor.surfaces),
    })),
    obligations: contract?.obligations || [],
  };
  return [
    '[Public performance contract]',
    JSON.stringify(publicContract, null, 2),
    '[Candidate]',
    String(candidate || ''),
    '[End candidate]',
  ].join('\n');
}

function jsonObjectFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1] || text;
  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseTutorStubPerformanceAdjudication({
  raw = '',
  candidate = '',
  contract = null,
} = {}) {
  const parsed = typeof raw === 'object' && raw !== null ? raw : jsonObjectFromText(raw);
  const verdict = String(parsed?.verdict || '').trim().toLowerCase();
  const declaredVerdict = ['realized', 'not_realized', 'uncertain'].includes(verdict)
    ? verdict
    : 'invalid';
  const evidenceAudit = validateTutorStubPerformanceEvidence({
    contract,
    candidate,
    evidence: parsed?.evidence,
  });
  const recognized = declaredVerdict === 'realized' && evidenceAudit.pass;
  const finalVerdict = recognized
    ? 'realized'
    : declaredVerdict === 'not_realized' || declaredVerdict === 'uncertain'
      ? declaredVerdict
      : 'invalid';
  return {
    schema: TUTOR_STUB_PERFORMANCE_ADJUDICATION_SCHEMA,
    version: 1,
    verdict: finalVerdict,
    declared_verdict: declaredVerdict,
    recognized,
    reason: String(parsed?.reason || '').replace(/\s+/gu, ' ').trim() || null,
    evidence_audit: evidenceAudit,
    parse_ok: Boolean(parsed) && declaredVerdict !== 'invalid',
  };
}

export function applyTutorStubPerformanceAdjudication({
  audits = null,
  adjudication = null,
  eligibility = null,
} = {}) {
  const source = clone(audits || {});
  if (eligibility?.eligible !== true) {
    return { applied: false, audits: source, reason: 'ineligible' };
  }
  if (adjudication?.recognized !== true) {
    return {
      applied: false,
      audits: source,
      reason: adjudication?.verdict || 'no_adjudication',
    };
  }
  const responseAudit = source.responseConfigurationAudit;
  if (!responseAudit?.axes?.actorial_part) {
    return { applied: false, audits: source, reason: 'missing_response_configuration_audit' };
  }
  source.deterministicActorialRealizationAudit = clone(
    source.actorialRealizationAudit || responseAudit.actorial_realization,
  );
  responseAudit.axes.actorial_part.performance_visible = true;
  responseAudit.axes.actorial_part.visible = responseAudit.axes.actorial_part.part_visible === true;
  responseAudit.actorial_realization = {
    ...(responseAudit.actorial_realization || {}),
    ok: true,
    issues: [],
    semantic_adjudication: clone(adjudication),
  };
  const visibleAxisCount = Object.values(responseAudit.axes).filter((axis) => axis.visible === true).length;
  responseAudit.visible_axis_count = visibleAxisCount;
  responseAudit.realization_rate = Number(
    (visibleAxisCount / Math.max(1, responseAudit.axis_count || Object.keys(responseAudit.axes).length)).toFixed(3),
  );
  responseAudit.transcript_visible =
    NON_ACTORIAL_AXES.every((axis) => responseAudit.axes?.[axis]?.visible === true) &&
    responseAudit.axes.actorial_part.visible === true &&
    responseAudit.metrics?.fourthWallBreak !== true;
  responseAudit.visible_signature = String(responseAudit.visible_signature || '').replace(
    /tactic:not_visible/u,
    `tactic:${responseAudit.axes.actorial_part.performance_tactic || 'semantic'}`,
  );
  source.actorialRealizationAudit = clone(responseAudit.actorial_realization);
  source.performanceSemanticAdjudication = clone(adjudication);
  source.ok = HARD_AUDIT_KEYS.every((key) => hardAuditPasses(source[key]));
  return { applied: true, audits: source, reason: 'exact_semantic_evidence_validated' };
}
