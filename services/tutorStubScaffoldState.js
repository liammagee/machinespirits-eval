export const TUTOR_STUB_SCAFFOLD_STATE_SCHEMA = 'machinespirits.tutor-stub.scaffold-state.v1';

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactReleaseRow(row = {}) {
  return {
    premise: row.premise || null,
    turn: row.turn ?? null,
    via: row.via || null,
    surface: oneLine(row.surface || '', { max: 220 }) || null,
  };
}

function compactFutureReleaseWindow(row = {}) {
  return {
    turn: row.turn ?? null,
    via: row.via || null,
  };
}

export function projectTutorStubScaffoldState({
  dagMode,
  tutorTurn,
  activeAct = null,
  branch,
  dueNow = [],
  released = [],
  nextRelease = null,
}) {
  const enabled = dagMode !== 'strict_dag';
  const modeNote =
    dagMode === 'defeasible_human_scaffold'
      ? 'Learner may make compressed local leaps; tutor carries obvious public bridges internally and surfaces proof debt only when it matters.'
      : dagMode === 'human_scaffold'
        ? 'Tutor frames one local warrant and permits ordinary-language reasoning while strict proof remains the audit.'
        : 'Strict audit mode; no scaffold adaptation.';
  return {
    schema: TUTOR_STUB_SCAFFOLD_STATE_SCHEMA,
    mode: dagMode,
    enabled,
    source: enabled ? 'dramaturgy_release_projection' : 'strict_dag_disabled',
    turn: tutorTurn,
    activeAct,
    branch,
    localQuestion: enabled ? branch.localQuestion : null,
    warrantFrame: enabled ? branch.warrantFrame : null,
    joinReminder: enabled ? branch.joinReminder : null,
    releaseState: {
      releasedCount: released.length,
      dueNow: dueNow.map(compactReleaseRow),
      latestReleased: released.at(-1) ? compactReleaseRow(released.at(-1)) : null,
      nextRelease: nextRelease ? compactFutureReleaseWindow(nextRelease) : null,
    },
    returnTarget: enabled
      ? {
          kind: dueNow.length
            ? 'current_release'
            : branch.id === 'world_conclusion_join'
              ? 'join_warrant'
              : 'local_branch_warrant',
          prompt: branch.localQuestion,
          afterSideArc: `Return to: ${branch.localQuestion}`,
        }
      : null,
    modeNote,
    status: enabled ? 'projected_from_dramaturgy' : 'not_enabled_strict_dag',
  };
}
