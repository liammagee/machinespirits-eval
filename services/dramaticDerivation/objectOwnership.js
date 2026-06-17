export const OBJECT_OWNERSHIP_SCHEMA = 'dramatic-derivation.object-ownership.v0';

export const OWNERSHIP_PROBE_FAMILIES = Object.freeze([
  'own_words',
  'use_in_path',
  'discriminate_wrong_route',
  'near_transfer',
  'recover_after_break',
  'purpose_link',
]);

const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
]);

function norm(text) {
  return String(text || '').toLowerCase();
}

function auditForbiddenKeys(value, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => leaks.push(...auditForbiddenKeys(item, [...path, String(index)])));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditObjectOwnershipPublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function cleanText(text, limit = 220) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function recentPublicLines(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanText(line.text, 600),
    }))
    .filter((line) => line.text);
}

function learnerTexts(input = {}) {
  const lines = recentPublicLines(input.transcript).filter((line) => line.role === 'learner');
  if (input.learnerText) lines.push({ role: 'learner', text: cleanText(input.learnerText, 600) });
  return lines.map((line) => line.text).filter(Boolean);
}

function phraseTokens(text) {
  return norm(text)
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .split(/\s+/u)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

const STOPWORDS = new Set([
  'and',
  'are',
  'but',
  'for',
  'from',
  'has',
  'have',
  'into',
  'not',
  'now',
  'only',
  'our',
  'that',
  'the',
  'then',
  'this',
  'with',
  'would',
]);

function objectKeywords(input = {}) {
  const explicit = Array.isArray(input.objectKeywords) ? input.objectKeywords : [];
  const raw = [
    input.currentObject,
    input.currentObjectLabel,
    input.objectLabel,
    input.publicObject,
    input.objectSurface,
    input.surface,
  ].filter(Boolean);
  const tokens = new Set();
  for (const item of explicit) {
    for (const token of phraseTokens(item)) tokens.add(token);
  }
  for (const item of raw) {
    for (const token of phraseTokens(item)) tokens.add(token);
  }
  return [...tokens].slice(0, 18);
}

function objectLabel(input = {}) {
  const raw = input.currentObject || input.currentObjectLabel || input.objectLabel || input.publicObject || input.objectId || null;
  const cleaned = cleanText(raw, 160);
  return cleaned || null;
}

function evidenceLine(text) {
  return cleanText(text, 200);
}

function textMentionsObject(text, keywords = []) {
  const lowered = norm(text);
  return keywords.some((token) => lowered.includes(token));
}

function hasPattern(text, pattern) {
  return pattern.test(norm(text));
}

function makeProbe(family, passed, evidence = [], weight = 1) {
  return {
    family,
    passed: Boolean(passed),
    weight,
    evidence: evidence.map(evidenceLine).filter(Boolean).slice(0, 3),
  };
}

function scoreProbeFamily(texts, keywords, input = {}) {
  const joined = texts.join('\n');
  const objectMentionTexts = texts.filter((text) => textMentionsObject(text, keywords));
  const ownWordsEvidence = objectMentionTexts.filter((text) =>
    hasPattern(text, /\b(i take it|i would say|in my words|so it means|what it gives me|i read it as|the point is)\b/u),
  );
  const echoEvidence = objectMentionTexts.filter((text) =>
    hasPattern(text, /\b(as you said|you said|just repeating|i can repeat|the words are)\b/u),
  );
  const useEvidence = objectMentionTexts.filter((text) =>
    hasPattern(text, /\b(so|therefore|because|which means|that means|then|it lets me|it gives me|it follows)\b/u),
  );
  const discriminateEvidence = texts.filter((text) =>
    textMentionsObject(text, keywords) &&
    hasPattern(text, /\b(not .* but|not yet|does not|is not|rather than|instead of|separate|keep .* apart|wrong)\b/u),
  );
  const transferEvidence = texts.filter((text) =>
    hasPattern(text, /\b(like|as with|same pattern|same shape|another case|parallel|as before)\b/u),
  );
  const recoveryEvidence = texts.filter((text) => {
    if (!textMentionsObject(text, keywords)) return false;
    return input.recoveryProbe || hasPattern(text, /\b(back to|return to|recover|again|still|earlier)\b/u);
  });
  const purposeEvidence = objectMentionTexts.filter((text) =>
    hasPattern(text, /\b(matters because|matters for|proves|shows why|needed because|without it|so the question|to answer)\b/u),
  );

  return {
    ownWordsEvidence,
    echoEvidence,
    probes: [
      makeProbe('own_words', ownWordsEvidence.length > 0 && echoEvidence.length === 0, ownWordsEvidence),
      makeProbe('use_in_path', useEvidence.length > 0, useEvidence),
      makeProbe('discriminate_wrong_route', discriminateEvidence.length > 0, discriminateEvidence),
      makeProbe('near_transfer', transferEvidence.length > 0 || input.transferObserved === true, transferEvidence),
      makeProbe('recover_after_break', recoveryEvidence.length > 0 || input.recoveryObserved === true, recoveryEvidence),
      makeProbe('purpose_link', purposeEvidence.length > 0, purposeEvidence),
    ],
    joined,
  };
}

function classifyOwnership(score, { echoOnly = false, usableText = false } = {}) {
  if (echoOnly) return 'echo_only';
  if (!usableText || score <= 0) return 'absent';
  if (score <= 1) return 'fragile';
  if (score <= 3) return 'emerging';
  if (score <= 5) return 'operational';
  return 'durable';
}

function rejectedState(inputAudit) {
  const state = {
    schema: OBJECT_OWNERSHIP_SCHEMA,
    publicOnly: true,
    authority: 'evaluation_only',
    mayOverrideProofControl: false,
    currentObject: null,
    ownershipLevel: 'unknown',
    score: 0,
    maxScore: OWNERSHIP_PROBE_FAMILIES.length,
    probes: OWNERSHIP_PROBE_FAMILIES.map((family) =>
      makeProbe(family, false, ['input rejected by public-only audit']),
    ),
    gaps: [...OWNERSHIP_PROBE_FAMILIES],
    evidence: ['input rejected by public-only audit'],
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditObjectOwnershipPublicInput(state),
  };
}

export function deriveObjectOwnershipState(input = {}) {
  const inputAudit = auditObjectOwnershipPublicInput(input);
  if (!inputAudit.ok) return rejectedState(inputAudit);

  const texts = learnerTexts(input);
  const keywords = objectKeywords(input);
  const label = objectLabel(input);
  const usableText = texts.length > 0 && keywords.length > 0;
  const scored = scoreProbeFamily(texts, keywords, input);
  const score = usableText ? scored.probes.reduce((sum, probe) => sum + (probe.passed ? probe.weight : 0), 0) : 0;
  const gaps = scored.probes.filter((probe) => !probe.passed).map((probe) => probe.family);
  const echoOnly = scored.echoEvidence.length > 0 && scored.ownWordsEvidence.length === 0;
  const evidence = scored.probes.flatMap((probe) => probe.evidence).slice(0, 6);
  const state = {
    schema: OBJECT_OWNERSHIP_SCHEMA,
    publicOnly: true,
    authority: 'evaluation_only',
    mayOverrideProofControl: false,
    currentObject: label,
    objectKeywords: keywords,
    ownershipLevel: classifyOwnership(score, { echoOnly, usableText }),
    score,
    maxScore: OWNERSHIP_PROBE_FAMILIES.length,
    probes: scored.probes,
    gaps,
    echoOnly,
    evidence: evidence.length ? evidence : ['no public learner ownership evidence detected'],
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditObjectOwnershipPublicInput(state),
  };
}

export function summarizeOwnershipStates(states = []) {
  const rows = (Array.isArray(states) ? states : []).filter(Boolean);
  const byLevel = {};
  const byGap = {};
  for (const row of rows) {
    byLevel[row.ownershipLevel || 'unknown'] = (byLevel[row.ownershipLevel || 'unknown'] || 0) + 1;
    for (const gap of row.gaps || []) byGap[gap] = (byGap[gap] || 0) + 1;
  }
  const meanScore = rows.length ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length : 0;
  return {
    schema: `${OBJECT_OWNERSHIP_SCHEMA}.summary`,
    count: rows.length,
    meanScore,
    byLevel,
    byGap,
    auditClean: rows.every((row) => row.inputAudit?.ok !== false && row.nonLeakAudit?.ok !== false),
  };
}
