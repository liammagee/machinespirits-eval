import { analyzeSuperegoIncorporation } from './dialogueTraceAnalyzer.js';

export const FRAMING_TRAJECTORY_LABELS = Object.freeze(['reframe', 'restate']);

function textFromEgo(entry) {
  return (
    entry?.suggestions?.[0]?.message ||
    entry?.suggestion?.message ||
    entry?.detail ||
    entry?.reasoning ||
    entry?.contextSummary ||
    ''
  ).trim();
}

function textFromCheck(entry) {
  return (
    entry?.feedback ||
    entry?.verdict?.feedback ||
    entry?.verdict?.reasoning ||
    entry?.detail ||
    entry?.contextSummary ||
    ''
  ).trim();
}

function egoSuggestion(entry) {
  const suggestion = entry?.suggestions?.[0] || entry?.suggestion || {};
  return {
    type: suggestion.type || suggestion.action || null,
    title: suggestion.title || null,
    actionTarget: suggestion.actionTarget || suggestion.target || null,
  };
}

function isEgoResponse(entry) {
  return entry?.agent === 'ego' && ['generate', 'revise', 'revision'].includes(entry.action) && textFromEgo(entry);
}

function isSuperegoCheck(entry) {
  return entry?.agent === 'superego' && ['review', 'revise'].includes(entry.action);
}

function isLearnerUptake(entry) {
  return (
    entry?.action === 'turn_action' &&
    (entry?.agent === 'learner' || entry?.agent === 'user' || entry?.agent?.startsWith('learner'))
  );
}

function checkRequiresRevision(entry) {
  const approved = entry?.approved ?? entry?.verdict?.approved;
  const interventionType = entry?.interventionType || entry?.verdict?.interventionType || null;
  return entry?.action === 'revise' || approved === false || ['enhance', 'revise', 'reject'].includes(interventionType);
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/u)
      .filter(Boolean),
  );
}

export function lexicalDistance(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : 1 - intersection / union;
}

function compactEgoEntry(entry, traceIndex) {
  return {
    traceIndex,
    round: Number.isFinite(entry?.round) ? entry.round : null,
    turnIndex: Number.isFinite(entry?.turnIndex) ? entry.turnIndex : null,
    action: entry?.action || null,
    text: textFromEgo(entry),
    ...egoSuggestion(entry),
  };
}

/**
 * Extract superego-check -> next-ego candidate trajectories from one frozen trace.
 * The five-stage education vocabulary is used as a coding frame, not asserted as
 * a causal reconstruction of hidden learner state.
 */
export function extractFramingTrajectoryChecks(dialogueTrace, metadata = {}) {
  if (!Array.isArray(dialogueTrace)) return [];

  const dialogueProxy = analyzeSuperegoIncorporation(dialogueTrace);
  const checks = [];
  let ordinal = 0;

  for (let checkIndex = 0; checkIndex < dialogueTrace.length; checkIndex++) {
    const check = dialogueTrace[checkIndex];
    if (!isSuperegoCheck(check)) continue;
    ordinal++;

    let responseIndex = -1;
    for (let index = checkIndex - 1; index >= 0; index--) {
      if (isEgoResponse(dialogueTrace[index])) {
        responseIndex = index;
        break;
      }
    }

    let followupIndex = -1;
    let learnerUptakeBeforeFollowup = false;
    for (let index = checkIndex + 1; index < dialogueTrace.length; index++) {
      if (isLearnerUptake(dialogueTrace[index])) learnerUptakeBeforeFollowup = true;
      if (isEgoResponse(dialogueTrace[index])) {
        followupIndex = index;
        break;
      }
    }

    const response = responseIndex >= 0 ? compactEgoEntry(dialogueTrace[responseIndex], responseIndex) : null;
    const nextEgo = followupIndex >= 0 ? compactEgoEntry(dialogueTrace[followupIndex], followupIndex) : null;
    const approved = check?.approved ?? check?.verdict?.approved ?? null;
    const interventionType = check?.interventionType || check?.verdict?.interventionType || null;

    checks.push({
      checkId: `${metadata.dialogueId || 'unknown'}#check-${ordinal}`,
      dialogueId: metadata.dialogueId || null,
      runId: metadata.runId || null,
      profileName: metadata.profileName || null,
      scenarioId: metadata.scenarioId || null,
      sourceTraceSha256: metadata.sourceTraceSha256 || null,
      ordinal,
      requiresRevision: checkRequiresRevision(check),
      response,
      disciplinaryCheck: {
        traceIndex: checkIndex,
        round: Number.isFinite(check?.round) ? check.round : null,
        turnIndex: Number.isFinite(check?.turnIndex) ? check.turnIndex : null,
        action: check?.action || null,
        approved,
        interventionType,
        text: textFromCheck(check),
      },
      nextEgo,
      followupKind: nextEgo ? (learnerUptakeBeforeFollowup ? 'after_learner_uptake' : 'immediate') : 'none',
      lexicalDistance: response && nextEgo ? lexicalDistance(response.text, nextEgo.text) : null,
      immediateRevisionSignal:
        Boolean(nextEgo) && !learnerUptakeBeforeFollowup && ['revise', 'revision'].includes(nextEgo.action),
      dialogueIncorporationRate: dialogueProxy.incorporationRate,
      dbIncorporationRate: Number.isFinite(metadata.dbIncorporationRate) ? metadata.dbIncorporationRate : null,
      dimensionConvergence: Number.isFinite(metadata.dimensionConvergence) ? metadata.dimensionConvergence : null,
    });
  }

  return checks;
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

export function summarizeFramingTrajectoryCodes(checks, codingRows) {
  const byId = new Map(checks.map((check) => [check.checkId, check]));
  const seen = new Set();
  const rows = [];

  for (const coding of codingRows || []) {
    if (!byId.has(coding?.check_id)) throw new Error(`Unknown framing-trajectory check: ${coding?.check_id}`);
    if (seen.has(coding.check_id)) throw new Error(`Duplicate framing-trajectory code: ${coding.check_id}`);
    if (!FRAMING_TRAJECTORY_LABELS.includes(coding.label)) {
      throw new Error(`Invalid framing-trajectory label for ${coding.check_id}: ${coding.label}`);
    }
    if (!String(coding.rationale || '').trim()) throw new Error(`Missing rationale for ${coding.check_id}`);

    const check = byId.get(coding.check_id);
    if (!coding.source_trace_sha256 || coding.source_trace_sha256 !== check.sourceTraceSha256) {
      throw new Error(`Source trace hash mismatch for ${coding.check_id}`);
    }
    if (!check.requiresRevision || check.followupKind !== 'immediate' || !check.response || !check.nextEgo) {
      throw new Error(`Coded check is not an immediate revision-demanding trajectory: ${coding.check_id}`);
    }
    seen.add(coding.check_id);
    rows.push({ ...check, label: coding.label, rationale: coding.rationale.trim() });
  }

  const labels = {};
  const byProfile = {};
  const proxyMatrix = {
    proxy_positive_reframe: 0,
    proxy_positive_restate: 0,
    proxy_zero_reframe: 0,
    proxy_zero_restate: 0,
  };

  for (const row of rows) {
    increment(labels, row.label);
    if (!byProfile[row.profileName]) byProfile[row.profileName] = { total: 0, reframe: 0, restate: 0 };
    byProfile[row.profileName].total++;
    byProfile[row.profileName][row.label]++;

    const proxy = Number(row.dialogueIncorporationRate) > 0 ? 'proxy_positive' : 'proxy_zero';
    proxyMatrix[`${proxy}_${row.label}`]++;
  }

  const dimensionAvailable = rows.filter((row) => Number.isFinite(row.dimensionConvergence)).length;
  const dbIncorporationAvailable = rows.filter((row) => Number.isFinite(row.dbIncorporationRate)).length;
  const immediateRevisionMatches = rows.filter(
    (row) => row.immediateRevisionSignal === (row.label === 'reframe'),
  ).length;

  return {
    codedChecks: rows.length,
    labels,
    reframeRate: rows.length > 0 ? (labels.reframe || 0) / rows.length : null,
    byProfile,
    comparison: {
      dialogueProxyMatrix: proxyMatrix,
      immediateRevisionMatches,
      immediateRevisionAgreement: rows.length > 0 ? immediateRevisionMatches / rows.length : null,
      dbIncorporationAvailable,
      dbIncorporationMissing: rows.length - dbIncorporationAvailable,
      dimensionConvergenceAvailable: dimensionAvailable,
      dimensionConvergenceMissing: rows.length - dimensionAvailable,
    },
    rows,
  };
}

export default {
  FRAMING_TRAJECTORY_LABELS,
  lexicalDistance,
  extractFramingTrajectoryChecks,
  summarizeFramingTrajectoryCodes,
};
