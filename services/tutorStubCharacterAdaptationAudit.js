import { auditTutorStubClueDeliveryMultiplicity } from './tutorStubDramaticRelease.js';

export const TUTOR_STUB_CHARACTER_ADAPTATION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.character-adaptation-audit.v1';

const META_PERFORMANCE_PATTERN =
  /\b(?:let(?:[’']s| us)\s+role-play|i(?:[’']ll| will)\s+(?:be|play|take the part)|speaking as|in the role of|back to (?:us|the case)|another piece of information)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function auditTutorStubCharacterAdaptationTurns(turnRecords = []) {
  const rows = (Array.isArray(turnRecords) ? turnRecords : []).filter(Boolean);
  const clueReleaseRows = rows.filter((turn) => turn.dramaticRelease?.frame?.active === true);
  const duplicateRows = [];
  for (const turn of clueReleaseRows) {
    const repeatedEntries = auditTutorStubClueDeliveryMultiplicity({
      text: turn.tutor,
      frame: turn.dramaticRelease?.frame,
    }).repeatedEntries;
    if (repeatedEntries.length) duplicateRows.push({ turn: turn.turn, entries: repeatedEntries });
  }

  const hostPartCounts = {};
  for (const turn of rows) {
    const configuration = turn.responseConfiguration || turn.registerSelection?.response_configuration || {};
    const part = configuration.actorial_host_part || configuration.actorial_part;
    if (part) hostPartCounts[part] = (hostPartCounts[part] || 0) + 1;
  }
  // Host-part visibility and performance-tactic visibility are distinct. A
  // record keeper can be unmistakably present even when the selected rhythm
  // (for example, rapid handoff) misses its surface threshold. Keep the broad
  // response-configuration realization rate responsible for that tactic.
  const hostVisibleTurns = rows.filter((turn) => {
    const axis = turn.responseConfigurationAudit?.axes?.actorial_part;
    return axis?.part_visible === true || (axis?.part_visible === undefined && axis?.visible === true);
  }).length;
  const performanceVisibleTurns = rows.filter((turn) => {
    const axis = turn.responseConfigurationAudit?.axes?.actorial_part;
    return axis?.performance_visible === true || (axis?.performance_visible === undefined && axis?.visible === true);
  }).length;
  const metaPerformanceRows = rows.filter((turn) => META_PERFORMANCE_PATTERN.test(oneLine(turn.tutor)));
  const stageDirectionRows = clueReleaseRows.filter((turn) => turn.dramaticRelease?.audit?.roleStageDirection === true);
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
    performanceVisibleTurns,
    performanceVisibilityRate: rows.length ? Number((performanceVisibleTurns / rows.length).toFixed(3)) : null,
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
