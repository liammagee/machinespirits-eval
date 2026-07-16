export const TUTOR_STUB_GUARD_RECOVERY_SCHEMA = 'machinespirits.tutor-stub.guard-recovery.v1';

const RECOVERY_TOKEN_STOPWORDS = new Set(
  'about after again before could does from have into only that their there these this what when where which with would'.split(
    ' ',
  ),
);
const RECOVERY_HOST_ACTION_PATTERN =
  /^i\s+(?:compare|examine|hold|inspect|test|trace)\b/iu;

function candidateText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function recoveryTokens(value) {
  return new Set(
    (String(value || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [])
      .map((token) => token.replace(/[’']/gu, ''))
      .filter((token) => !RECOVERY_TOKEN_STOPWORDS.has(token)),
  );
}

function recoveryOverlap(left, right) {
  const leftTokens = recoveryTokens(left);
  const rightTokens = recoveryTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function recoverySentences(value) {
  return String(value || '').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [];
}

function recoveryDevelopmentWithoutRepeatedUptake(uptake, development) {
  const safeUptake = candidateText(uptake);
  const sentences = recoverySentences(development).map((sentence) => sentence.trim()).filter(Boolean);
  while (
    sentences.length &&
    recoveryOverlap(safeUptake, sentences[0]) >= 0.45 &&
    !RECOVERY_HOST_ACTION_PATTERN.test(sentences[0])
  ) {
    sentences.shift();
  }
  return sentences.join(' ').replace(/\s+([”"])/gu, '$1').trim();
}

/**
 * Recompose a safe uptake with a model-authored development without repeating
 * a near-identical acknowledgement that the recovery model placed at the
 * front of its development. Only overlapping leading sentences are removed;
 * the first genuinely new sentence and everything after it are preserved.
 */
export function composeTutorStubGuardUptakeDevelopment({ uptake = '', development = '' } = {}) {
  const safeUptake = candidateText(uptake);
  const distinctDevelopment = recoveryDevelopmentWithoutRepeatedUptake(safeUptake, development);
  return [safeUptake, distinctDevelopment].filter(Boolean).join(' ');
}

/** Append the clarification affordance only when it is the sole hard failure. */
export function repairTutorStubMissingClarificationInvitation({ text = '', deliveryDecision = null } = {}) {
  const hardIssues = Array.isArray(deliveryDecision?.hardIssues) ? deliveryDecision.hardIssues : [];
  const eligible =
    hardIssues.length > 0 &&
    hardIssues.every(
      (issue) =>
        issue?.guard === 'question_support' && issue?.type === 'missing_clarification_invitation',
    );
  if (!eligible) return { changed: false, text: candidateText(text) };
  const source = candidateText(text);
  if (
    /\b(?:ask me|you can ask)\b[^.!?]{0,70}\b(?:clarif|explain|unpack)\b|\b(?:word|link|connection)\b[^.!?]{0,55}\b(?:needs? opening|ask me|ask (?:it|that) plainly)\b|\bneeds? opening\b[^.!?]{0,45}\bask me plainly\b/iu.test(
      source,
    )
  ) {
    return { changed: false, text: source };
  }
  return {
    changed: true,
    text: `${source} You can ask me to unpack any word or connection.`.trim(),
  };
}

/** Remove an impossible recall question only when it is the sole hard failure. */
export function repairTutorStubUnanswerableOpenRecall({ text = '', deliveryDecision = null } = {}) {
  const hardIssues = Array.isArray(deliveryDecision?.hardIssues) ? deliveryDecision.hardIssues : [];
  const eligible =
    hardIssues.length > 0 &&
    hardIssues.every(
      (issue) => issue?.guard === 'question_support' && issue?.type === 'unanswerable_open_recall',
    );
  const source = candidateText(text);
  if (!eligible || !source) return { changed: false, text: source };
  const forbiddenQuestions = hardIssues.flatMap((issue) =>
    Array.isArray(issue?.excerpts) ? issue.excerpts.map((excerpt) => candidateText(excerpt)) : [],
  );
  if (!forbiddenQuestions.length) return { changed: false, text: source };
  const retained = recoverySentences(source).filter((sentence) => {
    const normalized = candidateText(sentence);
    return !forbiddenQuestions.some(
      (question) => normalized.includes(question) || question.includes(normalized),
    );
  });
  const repaired = retained.join(' ').trim();
  return {
    changed: Boolean(repaired && repaired !== source),
    text: repaired || source,
  };
}

/**
 * Add only a public host action when an otherwise deliverable draft misses the
 * selected actorial part. This runs before another model call, so a purely
 * stylistic miss cannot invite new evidence or alter the learner uptake.
 */
export function repairTutorStubMissingActorialPart({
  text = '',
  deliveryDecision = null,
  responseConfiguration = null,
  responseComposition = null,
} = {}) {
  const hardIssues = Array.isArray(deliveryDecision?.hardIssues) ? deliveryDecision.hardIssues : [];
  const eligible =
    hardIssues.length > 0 &&
    hardIssues.every(
      (issue) =>
        issue?.guard === 'actorial_realization' && issue?.type === 'missing_selected_actorial_part',
    );
  const source = candidateText(text);
  const uptake = candidateText(responseComposition?.uptake);
  const development = candidateText(responseComposition?.development);
  if (!eligible || !source || !uptake || !development) return { changed: false, text: source, cue: null };
  const part = String(responseConfiguration?.actorial_part || '').trim();
  const cue = {
    scene_partner: 'I make room beside the public record for you.',
    examiner: 'I hold the public evidence before us.',
    record_keeper: 'I mark that limit in the open record.',
    advocate: 'I put the public case before us, no further than the evidence can carry it.',
    skeptic: 'Not so fast—I hold the claim against the public record.',
    foreperson: 'I enter the supported finding in the open record.',
  }[part];
  if (!cue) return { changed: false, text: source, cue: null };
  const distinctDevelopment = recoveryDevelopmentWithoutRepeatedUptake(uptake, development);
  const repaired = [uptake, cue, distinctDevelopment].filter(Boolean).join(' ').trim();
  return {
    changed: repaired !== source,
    text: repaired,
    cue,
  };
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
    const roleStem = role.replace(
      /\s+(?:carrying|holding|presenting|reading|reciting|reporting|showing)\b.*$/iu,
      '',
    );
    const variants = [...new Set([role, roleStem].filter(Boolean))].sort(
      (left, right) => right.length - left.length,
    );
    let match = null;
    let matchedPattern = null;
    for (const variant of variants) {
      const pattern = new RegExp(
        `\\b(?:as\\s+)?(?:the|a|an)\\s+${escapeRegExp(variant)}\\b[^:“”"\\n]{0,120}:\\s*(?=[“"])`,
        'iu',
      );
      match = repaired.match(pattern);
      if (match) {
        matchedPattern = pattern;
        break;
      }
    }
    if (!match || !matchedPattern) continue;
    const replacement = `${mechanicalHostLeadIn(responseConfiguration)}: `;
    repaired = repaired.replace(matchedPattern, replacement);
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

/**
 * A model-authored policy recovery has already had one chance to realize the
 * complete response configuration. Keep the selected host part mandatory, but
 * do not replace an otherwise valid recovery with stock prose solely because
 * the optional performance tactic was not legible enough to the heuristic
 * auditor. The full configuration audit remains attached to the delivered turn
 * and therefore still lowers its measured realization rate.
 */
export function tutorStubActorialPerformanceMayBeAdvisory(
  actorialRealizationAudit = null,
  responseConfigurationAudit = null,
) {
  const issues = Array.isArray(actorialRealizationAudit?.issues)
    ? actorialRealizationAudit.issues
    : [];
  const axes = responseConfigurationAudit?.axes || {};
  const nonActorialAxesVisible = [
    'engagement_stance',
    'action_family',
    'audience_register',
    'lexical_accessibility',
    'scene_immersion',
  ].every((axis) => axes?.[axis]?.visible === true);
  return (
    nonActorialAxesVisible &&
    issues.length > 0 &&
    issues.every((issue) => issue?.type === 'missing_selected_performance_tactic')
  );
}

export function tutorStubPolicyRecoveryAllowsPerformanceAdvisory(
  actorialRealizationAudit = null,
  responseConfigurationAudit = null,
) {
  return tutorStubActorialPerformanceMayBeAdvisory(
    actorialRealizationAudit,
    responseConfigurationAudit,
  );
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
