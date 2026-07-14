export const TUTOR_STUB_CHARACTER_ADAPTATION_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.character-adaptation-audit.v1';

const META_PERFORMANCE_PATTERN =
  /\b(?:let(?:[’']s| us)\s+role-play|i(?:[’']ll| will)\s+(?:be|play|take the part)|speaking as|in the role of|back to (?:us|the case)|another piece of information)\b/iu;
const TOKEN_STOP_WORDS = new Set(
  'about after again also and are because before being between could does from had has have her him his into its just more not one only other our out over same she should some than that the their them then there these they this those through too under very was were what when where which while who will with would your'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function contentTokens(value) {
  return new Set(
    (oneLine(value).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [])
      .map((token) => token.replace(/[’']/gu, ''))
      .filter((token) => !TOKEN_STOP_WORDS.has(token)),
  );
}

function sentenceRows(value) {
  return oneLine(value)
    .split(/(?<=[.!?])\s+|(?<=[.!?][”"'’])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clueBearingSentenceCount(text, surface) {
  const clueTokens = contentTokens(surface);
  if (!clueTokens.size) return 0;
  const threshold = Math.max(3, Math.ceil(clueTokens.size * 0.45));
  return sentenceRows(text).filter((sentence) => {
    const sentenceTokens = contentTokens(sentence);
    let overlap = 0;
    for (const token of clueTokens) if (sentenceTokens.has(token)) overlap += 1;
    return overlap >= threshold;
  }).length;
}

export function auditTutorStubCharacterAdaptationTurns(turnRecords = []) {
  const rows = (Array.isArray(turnRecords) ? turnRecords : []).filter(Boolean);
  const clueReleaseRows = rows.filter((turn) => turn.dramaticRelease?.frame?.active === true);
  const duplicateRows = [];
  for (const turn of clueReleaseRows) {
    const repeatedEntries = (turn.dramaticRelease?.frame?.entries || [])
      .map((entry) => ({
        premise: entry.premise || null,
        surface: oneLine(entry.surface),
        bearingSentenceCount: clueBearingSentenceCount(turn.tutor, entry.surface),
      }))
      .filter((entry) => entry.bearingSentenceCount > 1);
    if (repeatedEntries.length) duplicateRows.push({ turn: turn.turn, entries: repeatedEntries });
  }

  const hostPartCounts = {};
  for (const turn of rows) {
    const configuration = turn.responseConfiguration || turn.registerSelection?.response_configuration || {};
    const part = configuration.actorial_host_part || configuration.actorial_part;
    if (part) hostPartCounts[part] = (hostPartCounts[part] || 0) + 1;
  }
  const hostVisibleTurns = rows.filter(
    (turn) => turn.responseConfigurationAudit?.axes?.actorial_part?.visible === true,
  ).length;
  const metaPerformanceRows = rows.filter((turn) => META_PERFORMANCE_PATTERN.test(oneLine(turn.tutor)));
  const stageDirectionRows = clueReleaseRows.filter(
    (turn) => turn.dramaticRelease?.audit?.roleStageDirection === true,
  );
  const sourceReplacementRows = rows.filter((turn) => {
    const configuration = turn.responseConfiguration || turn.registerSelection?.response_configuration || {};
    return configuration.actorial_part === 'authored_source';
  });

  return {
    schema: TUTOR_STUB_CHARACTER_ADAPTATION_AUDIT_SCHEMA,
    turns: rows.length,
    clueReleaseTurns: clueReleaseRows.length,
    hostVisibleTurns,
    hostVisibilityRate: rows.length ? Number((hostVisibleTurns / rows.length).toFixed(3)) : null,
    distinctHostParts: Object.keys(hostPartCounts).length,
    hostPartCounts,
    metaPerformanceTurns: metaPerformanceRows.length,
    metaPerformanceTurnIds: metaPerformanceRows.map((turn) => turn.turnId || turn.turn),
    roleStageDirectionTurns: stageDirectionRows.length,
    roleStageDirectionTurnIds: stageDirectionRows.map((turn) => turn.turnId || turn.turn),
    sourceReplacementTurns: sourceReplacementRows.length,
    sourceReplacementTurnIds: sourceReplacementRows.map((turn) => turn.turnId || turn.turn),
    duplicateClueDeliveryTurns: duplicateRows.length,
    duplicateClueDeliveries: duplicateRows,
  };
}
