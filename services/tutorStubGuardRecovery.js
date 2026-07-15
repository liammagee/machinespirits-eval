export const TUTOR_STUB_GUARD_RECOVERY_SCHEMA = 'machinespirits.tutor-stub.guard-recovery.v1';

function candidateText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function jsonObjectText(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  if (fenced) return fenced[1].trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  return start >= 0 && end > start ? source.slice(start, end + 1) : source;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function mechanicalHostLeadIn(responseConfiguration = null) {
  const part = String(
    responseConfiguration?.actorial_host_part || responseConfiguration?.actorial_part || 'examiner',
  ).trim();
  return {
    scene_partner: 'I set the evidence between us',
    examiner: 'I hold the evidence before us',
    record_keeper: 'I mark the evidence in the open record',
    advocate: 'I put the strongest public case before us',
    skeptic: 'Not so fast—I hold the claim against the evidence',
    foreperson: 'I enter the evidence as a provisional finding',
  }[part] || 'I hold the evidence before us';
}

/**
 * Repairs only a public form error: a model has already put an authored source's
 * first-person words in quotation marks, but introduces them with a third-person
 * role label. The evidence inside the quotation is left byte-for-byte intact.
 */
export function repairTutorStubThirdPersonSourceLeadIn({
  text = '',
  dramaticReleaseFrame = null,
  responseConfiguration = null,
} = {}) {
  let repaired = String(text || '').trim();
  const replacements = [];
  for (const entry of dramaticReleaseFrame?.entries || []) {
    if (entry?.mode !== 'enacted_role' || !String(entry?.role || '').trim()) continue;
    const role = String(entry.role).trim();
    const pattern = new RegExp(
      `\\b(?:as\\s+)?(?:the|a|an)\\s+${escapeRegExp(role)}\\b[^:“”"\\n]{0,120}:\\s*(?=[“"])`,
      'iu',
    );
    const match = repaired.match(pattern);
    if (!match) continue;
    const replacement = `${mechanicalHostLeadIn(responseConfiguration)}: `;
    repaired = repaired.replace(pattern, replacement);
    replacements.push({ role, original: match[0], replacement });
  }
  return {
    schema: 'machinespirits.tutor-stub.guard-mechanical-repair.v1',
    changed: replacements.length > 0,
    text: repaired,
    replacements,
  };
}

export function parseTutorStubGuardRecoveryCandidates(value) {
  const raw = String(value || '').trim();
  try {
    const parsed = JSON.parse(jsonObjectText(raw));
    const policyRepair = candidateText(parsed?.policy_repair ?? parsed?.policyRepair);
    const plainRecovery = candidateText(parsed?.plain_recovery ?? parsed?.plainRecovery);
    if (policyRepair && plainRecovery) {
      return {
        schema: TUTOR_STUB_GUARD_RECOVERY_SCHEMA,
        ok: true,
        parseMode: 'paired_json',
        policyRepair,
        plainRecovery,
        error: null,
      };
    }
    throw new Error('paired recovery JSON must contain non-empty policy_repair and plain_recovery strings');
  } catch (error) {
    return {
      schema: TUTOR_STUB_GUARD_RECOVERY_SCHEMA,
      ok: false,
      parseMode: raw ? 'legacy_single_candidate' : 'empty',
      policyRepair: raw,
      plainRecovery: '',
      error: error.message,
    };
  }
}

export function tutorStubLearnerRequestedPlainStyle(learnerText = '', classification = null) {
  const publicRequest = String(learnerText || '');
  if (
    /\b(?:drop|lose|cut|stop|skip)\s+(?:the\s+)?formality\b|\bless formal\b|\b(?:talk|speak)\s+to\s+me\s+(?:like|as)\s+(?:an?\s+)?equal\b|\b(?:plain|ordinary|normal|direct)\s+(?:language|speech|conversation)\b|\b(?:stop|no)\s+(?:the\s+)?(?:role[- ]?play|roleplaying|theatre|theater|performance|detective novel|drama)\b|\b(?:do not|don[’']t|not)\b[^.!?]{0,50}\bdetective novel\b/iu.test(
      publicRequest,
    )
  ) {
    return true;
  }
  const turn = classification?.turn || {};
  if (turn.discourse_move !== 'repair_request') return false;
  return /\b(?:plain|direct|ordinary|peer[- ]level|equal|non[- ]theatrical|less formal)\b/iu.test(
    `${turn.summary || ''} ${turn.pedagogical_need || ''}`,
  );
}

export function tutorStubPlainRecoveryAllowsActorialAdvisory({
  loopMode = 'strict',
  learnerRequestedPlainStyle = false,
} = {}) {
  return learnerRequestedPlainStyle === true || String(loopMode || '').trim().toLowerCase() === 'diagnostic';
}

export function tutorStubGuardDeliveryDecision(issueRows = [], { allowActorialAdvisory = false } = {}) {
  const issues = Array.isArray(issueRows) ? issueRows : [];
  const advisoryIssues = allowActorialAdvisory
    ? issues.filter((issue) => issue?.guard === 'actorial_realization')
    : [];
  const advisorySet = new Set(advisoryIssues);
  const hardIssues = issues.filter((issue) => !advisorySet.has(issue));
  return {
    schema: 'machinespirits.tutor-stub.guard-delivery-decision.v1',
    ok: hardIssues.length === 0,
    allowActorialAdvisory: Boolean(allowActorialAdvisory),
    hardIssues,
    advisoryIssues,
  };
}
