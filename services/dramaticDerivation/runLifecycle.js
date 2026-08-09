import { normalizeStagePrologue } from './runState.js';

export function resolveDramaTurnLimit(world, opts) {
  return Math.min(world.turnCap, Number.isFinite(opts.maxTurns) ? opts.maxTurns : Infinity);
}

/**
 * Build the optional turn-zero staging line without exposing any state beyond
 * the same omniscient director instruments the legacy engine supplied.
 */
export async function createDramaStagePrologue({
  enabled,
  director,
  world,
  publicRegister,
  groundedFacts,
  inferenceFrontier,
}) {
  if (!enabled) return null;
  const view = {
    turn: 0,
    role: 'director',
    world,
    ledger: [],
    releasedFacts: [],
    transcript: [],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: groundedFacts, hypotheses: [] },
    inference: { frontier: inferenceFrontier, voiced: [], overreachCount: 0 },
    publicRegister,
  };
  const raw =
    typeof director.prologue === 'function' ? await director.prologue(view) : normalizeStagePrologue(null, world);
  const prologue = normalizeStagePrologue(raw, world);
  return {
    prologue,
    transcriptLine: {
      turn: 0,
      role: 'director',
      text: prologue.stageNotes,
      meta: {
        prologue,
        publicRegister,
      },
    },
  };
}

function sealOpenScene({ runState, sceneState, turn, endedBy }) {
  if (sceneState) {
    sceneState.endTurn = turn;
    sceneState.dEnd = runState.trajectory[runState.trajectory.length - 1]?.D ?? sceneState.dStart;
    sceneState.status = endedBy ? 'failed' : 'run_end';
    sceneState.closeReason = endedBy ? `run ended: ${endedBy}` : 'run ended before the scene budget closed';
    runState.sceneRows.push({ ...sceneState, exchanges: sceneState.exchanges.map((exchange) => ({ ...exchange })) });
  }
}

function sealOpenStrategyBlock({ ledgerState, turn, endedBy }) {
  if (ledgerState?.block) {
    const open = ledgerState.block;
    open.endTurn = turn;
    open.status = 'run_end';
    open.closeReason = endedBy ? `run ended: ${endedBy}` : 'run ended before the block cleared';
    ledgerState.blockRows.push({ ...open, clearance: open.clearance.map((entry) => ({ ...entry })) });
    ledgerState.block = null;
  }
}

function sealOpenAct({ actState, turn, didacticFallbackForAct }) {
  if (actState) {
    const didacticFallback = didacticFallbackForAct(actState.index, actState.startTurn, turn);
    actState.history.push({
      act: actState.index,
      turns: [actState.startTurn, turn],
      endedBy: 'run_end',
      brief: actState.brief,
      ...(didacticFallback ? { didacticFallback } : {}),
    });
  }
}

async function appendFinalPlotAudit({ runState, actState, tutor, turn, plotAuditDetail }) {
  if (actState && typeof tutor.finalAudit === 'function') {
    const finalAudit = await tutor.finalAudit({
      transcript: [...runState.transcript],
      ledger: [...runState.ledger],
      acts: actState.history.map((act) => ({ ...act })),
    });
    if (finalAudit) {
      runState.plotAuditRows.push({ turn, final: true, ...finalAudit });
      runState.events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(finalAudit, ' at run end') });
    }
  }
}

/** Seal open scene/block/act state after the formal turn loop stops. */
export async function finalizeDramaRunLifecycle({
  runState,
  sceneState,
  turn,
  endedBy,
  tutor,
  didacticFallbackForAct,
  plotAuditDetail,
}) {
  sealOpenScene({ runState, sceneState, turn, endedBy });
  sealOpenStrategyBlock({ ledgerState: runState.ledgerState, turn, endedBy });
  sealOpenAct({ actState: runState.actState, turn, didacticFallbackForAct });
  await appendFinalPlotAudit({ runState, actState: runState.actState, tutor, turn, plotAuditDetail });
}
