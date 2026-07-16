export const TUTOR_STUB_GUARD_RECOVERY_SCHEMA = 'machinespirits.tutor-stub.guard-recovery.v1';

const SIMPLIFIED_RECOVERY_PARTS = Object.freeze({
  scene_partner: {
    label: 'fellow investigator',
    contract: 'Work beside the learner through one concrete shared action on already-public evidence.',
  },
  examiner: {
    label: 'evidence examiner',
    contract: 'Inspect, compare, test, or point to one named public exhibit directly.',
  },
  record_keeper: {
    label: 'record keeper',
    contract: 'Open, read, mark, or close one named public record and keep its limit explicit.',
  },
  foreperson: {
    label: 'keeper of the final finding',
    contract: 'State the supported finding, close the public record, and ask no further question.',
  },
});

function responseConfigurationSignature(configuration = null) {
  return [
    configuration?.engagement_stance,
    configuration?.action_family,
    configuration?.audience_register,
    configuration?.lexical_accessibility,
    configuration?.scene_immersion,
    configuration?.actorial_part,
    configuration?.actorial_performance?.id,
  ]
    .filter(Boolean)
    .join('|');
}

function simplifiedRecoveryPart(configuration = null, { closureRequired = false } = {}) {
  if (closureRequired || configuration?.action_family === 'close_inquiry') return 'foreperson';
  if (['receive_vulnerability', 'reanchor_lived_stake'].includes(configuration?.action_family)) {
    return 'scene_partner';
  }
  if (['compress_sayback', 'reanchor_public_evidence'].includes(configuration?.action_family)) {
    return 'record_keeper';
  }
  if (configuration?.actorial_part === 'record_keeper') return 'record_keeper';
  return 'examiner';
}

/**
 * Derive a complete alternative recovery configuration rather than asking a
 * candidate to ignore axes that the strict auditor still requires. Safety,
 * evidence, action, question support, and closure remain unchanged; only the
 * realization strategy becomes deliberately plain, grounded, and unadorned.
 */
export function buildTutorStubSimplifiedRecoveryConfiguration(
  responseConfiguration = null,
  { closureRequired = false } = {},
) {
  const source = responseConfiguration || {};
  const part = simplifiedRecoveryPart(source, { closureRequired });
  const definition = SIMPLIFIED_RECOVERY_PARTS[part];
  const selectedSignature = responseConfigurationSignature(source);
  const configuration = {
    ...structuredClone(source),
    engagement_stance: 'plain',
    lexical_accessibility: 'plain',
    scene_immersion: 'grounded',
    actorial_part: part,
    actorial_part_label: definition.label,
    actorial_host_part: part,
    actorial_host_part_label: definition.label,
    actorial_part_selection: {
      ...(structuredClone(source.actorial_part_selection || {})),
      id: part,
      label: definition.label,
      contract: definition.contract,
      selection_method: 'simplified_recovery_configuration',
      recovery_override: true,
    },
    actorial_performance: {
      id: 'unadorned_report',
      label: 'unadorned report',
      contract: 'Use one direct action or spoken line, ordinary words, and no theatrical preface.',
      engagement_stance: 'plain',
      actorial_part: part,
      selection_method: 'simplified_recovery_configuration',
    },
    surface_budgets: {
      ...(structuredClone(source.surface_budgets || {})),
      max_average_sentence_words: Math.min(
        18,
        Number(source.surface_budgets?.max_average_sentence_words || 18),
      ),
    },
  };
  configuration.recovery_transition = {
    schema: 'machinespirits.tutor-stub.response-configuration-transition.v1',
    strategy: 'plain_grounded_unadorned',
    selected_signature: selectedSignature,
    delivered_signature: responseConfigurationSignature(configuration),
  };
  return configuration;
}

export function tutorStubSimplifiedRecoveryPrompt({ configuration = null, firstDraftContract = null } = {}) {
  const part = configuration?.actorial_part || 'examiner';
  const partCue = {
    scene_partner: 'Use one short first-person shared action beside a named public object and make room for the learner.',
    examiner: 'Use one short first-person action that holds, compares, tests, or points to a named public exhibit.',
    record_keeper: 'Use one short first-person action that opens, reads, marks, or closes a named public record.',
    foreperson: 'State the supported finding, close the named public record, and ask no question.',
  }[part];
  const evidence = firstDraftContract?.evidence?.cues || [];
  return [
    '[Tutor-only minimal recovery contract]',
    'Write a genuinely different replacement in two to four short sentences. Do not reuse the policy repair’s opening or sentence shape.',
    firstDraftContract?.learner_move
      ? `OPEN — Directly answer or credit this move without echoing it: ${firstDraftContract.learner_move}`
      : 'OPEN — Directly answer or credit the learner’s concrete move without generic praise.',
    firstDraftContract?.development?.instruction
      ? `ACT — ${firstDraftContract.development.instruction}`
      : null,
    `ENACT — ${partCue} Keep it direct and unadorned.`,
    evidence.length ? 'PUBLIC EVIDENCE — deliver each supplied line once and add nothing beyond it:' : null,
    ...evidence.map((row) => `- ${row}`),
    firstDraftContract?.ending?.instruction
      ? `END — ${firstDraftContract.ending.instruction}`
      : 'END — Use at most one concrete, answerable question.',
    'Use ordinary words, one relation per sentence, one continuous public voice, and no role label or stage direction.',
    '[End tutor-only minimal recovery contract]',
  ]
    .filter(Boolean)
    .join('\n');
}

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
