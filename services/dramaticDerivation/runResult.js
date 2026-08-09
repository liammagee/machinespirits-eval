import { factKey, proofTree } from './chainer.js';
import { buildLearnerDag } from './learnerDag.js';
import { summarizeLearnerTransformationDurability } from './learnerTransformation.js';

export function resolveDramaVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn }) {
  if (endedBy === 'grounded_anagnorisis') return 'grounded_anagnorisis';
  if (endedBy === 'leak') return 'leak';
  if (firstForcedTurn !== null && assertedGroundedTurn === null) return 'unstaged_recognition';
  if (events.some((event) => event.type === 'mirror')) return 'mirror';
  if (endedBy === 'aporia' || endedBy === 'disengagement') return endedBy;
  if (events.some((event) => event.type === 'aporia')) return 'aporia';
  if (events.some((event) => event.type === 'disengagement')) return 'disengagement';
  if (events.some((event) => event.type === 'lucky_leap')) return 'lucky_leap_only';
  return 'cap_reached';
}

function buildAvailability(firstAvailable, voicedLedger) {
  return [...firstAvailable.values()]
    .map(({ fact, turn }) => {
      const voicedEntry = voicedLedger.find((entry) => factKey(entry.fact) === factKey(fact));
      return { fact, firstAvailable: turn, firstVoiced: voicedEntry ? voicedEntry.turn : null };
    })
    .sort((a, b) => a.firstAvailable - b.firstAvailable || factKey(a.fact).localeCompare(factKey(b.fact)));
}

function buildLemmaResult({ lemmaRun, lemmaConfig, lemmaDag }) {
  if (!lemmaRun) return null;
  return {
    config: { ...lemmaConfig },
    nodes: lemmaDag.nodes.map((node) => ({
      label: node.label,
      isGoal: node.isGoal,
      support: [...node.support],
    })),
    clearedAt: Object.fromEntries(lemmaRun.clearedAt),
    groundedFinal: lemmaDag.nodes.filter((node) => lemmaRun.grounded.has(node.key)).map((node) => node.label),
    choices: lemmaRun.choices,
    departures: lemmaRun.departures,
    blocks: lemmaRun.blocks,
    passthroughs: lemmaRun.passthroughs,
    regressions: lemmaRun.regressions,
    frontierCoverage: {
      openings: lemmaRun.openings,
      multiFrontierOpenings: lemmaRun.multiFrontierOpenings,
      tutorChoices: lemmaRun.tutorChoices,
    },
  };
}

function buildStrategyLedgerResult({ ledgerState, learnerLedgerActive, learnerLedgerRows }) {
  if (!ledgerState && !learnerLedgerActive) return null;
  return {
    ...(ledgerState
      ? {
          config: {
            maxBlockTurns: ledgerState.config.maxBlockTurns,
            registerPalette: ledgerState.config.registerPalette,
            ...(ledgerState.config.trialling
              ? {
                  trialling: true,
                  stancePalette: ledgerState.config.stancePalette,
                  releaseIntent: ledgerState.config.releaseIntent,
                }
              : {}),
          },
          blocks: ledgerState.blockRows,
          budgetFinal: {
            context: ledgerState.budget.context,
            currentProofNeutralTutorTurns: ledgerState.budget.currentProofNeutralTutorTurns,
            currentProofNeutralLearnerTurns: ledgerState.budget.currentProofNeutralLearnerTurns,
          },
          ...(ledgerState.config.trialling ? { history: ledgerState.history } : {}),
          ...(ledgerState.config.planMode ? { stocktakes: ledgerState.stocktakes } : {}),
        }
      : {}),
    rows: [...(ledgerState?.rows || []), ...learnerLedgerRows],
  };
}

function buildCorruptionResult(corruption, grounded, premiseIdForKey) {
  if (!corruption) return null;
  return {
    config: corruption.config,
    ledger: corruption.ledger,
    decayedAtEnd: [...grounded.entries()]
      .filter(([, entry]) => entry.decayed)
      .map(([key, entry]) => ({
        premiseId: premiseIdForKey(key),
        fact: entry.fact,
        sinceTurn: entry.decayTurn,
      })),
  };
}

function buildPolicyResultFields(runState) {
  const {
    sceneRows,
    lemmaRun,
    lemmaConfig,
    lemmaDag,
    mirrorRefusalState,
    registerRouterState,
    sceneConfig,
    directorCadence,
    publicRegisterPlan,
    registerRows,
    actState,
    ledgerState,
    learnerLedgerActive,
    learnerLedgerRows,
  } = runState;
  const lemmaLayer = buildLemmaResult({ lemmaRun, lemmaConfig, lemmaDag });
  const strategyLedger = buildStrategyLedgerResult({ ledgerState, learnerLedgerActive, learnerLedgerRows });
  return {
    ...(sceneRows.length ? { scenes: sceneRows } : {}),
    ...(lemmaLayer ? { lemmaLayer } : {}),
    ...(mirrorRefusalState.record ? { mirrorRefusal: mirrorRefusalState.record } : {}),
    ...(registerRouterState
      ? {
          registerRouter: {
            decisions: registerRouterState.decisions,
            shifts: registerRouterState.decisions.filter((decision) => decision.register !== 'didactic').length,
          },
        }
      : {}),
    ...(sceneConfig ? { directorCadence } : {}),
    ...(publicRegisterPlan !== 'default' ? { publicRegister: publicRegisterPlan } : {}),
    ...(registerRows.length ? { publicRegisters: registerRows } : {}),
    ...(actState ? { acts: actState.history } : {}),
    ...(strategyLedger ? { strategyLedger } : {}),
  };
}

function buildPedagogicalResultFields(runState, learnerTransformationDurability) {
  const {
    reconstructionRows,
    plotRows,
    plotAuditRows,
    throughlineRows,
    proofDebtRows,
    didacticModeRows,
    castLayerRows,
    learnerTransformationRows,
    learnerTransformationPostRows,
  } = runState;
  return {
    ...(reconstructionRows.length ? { reconstruction: reconstructionRows } : {}),
    ...(plotRows.length || plotAuditRows.length || throughlineRows.length
      ? {
          plot: {
            plots: plotRows,
            audits: plotAuditRows,
            ...(throughlineRows.length ? { throughlines: throughlineRows } : {}),
          },
        }
      : {}),
    ...(proofDebtRows.length ? { proofDebt: proofDebtRows } : {}),
    ...(didacticModeRows.length ? { didacticMode: didacticModeRows } : {}),
    ...(castLayerRows.length ? { castLayer: castLayerRows } : {}),
    ...(learnerTransformationRows.length ? { learnerTransformation: learnerTransformationRows } : {}),
    ...(learnerTransformationPostRows.length ? { learnerTransformationPost: learnerTransformationPostRows } : {}),
    ...(learnerTransformationDurability ? { learnerTransformationDurability } : {}),
  };
}

function buildOperationalResultFields(runState, premiseIdForKey) {
  const {
    tutorLearnerDagRows,
    proxyDagPacingRows,
    fieldPlannerRows,
    fieldReportRows,
    logicSnapshots,
    corruption,
    grounded,
  } = runState;
  const corruptionResult = buildCorruptionResult(corruption, grounded, premiseIdForKey);
  return {
    ...(tutorLearnerDagRows.length ? { tutorLearnerDagModel: tutorLearnerDagRows } : {}),
    ...(proxyDagPacingRows.length ? { proxyDagPacing: proxyDagPacingRows } : {}),
    ...(fieldPlannerRows.length ? { fieldPlanner: fieldPlannerRows } : {}),
    ...(fieldReportRows.length ? { fieldReportContext: fieldReportRows } : {}),
    ...(logicSnapshots.length ? { logicSnapshots } : {}),
    ...(corruptionResult ? { corruption: corruptionResult } : {}),
  };
}

/**
 * Project the completed mutable run state into the stable public result.
 * Optional feature fields remain absent, rather than null, when their
 * corresponding run-level mechanism did not participate.
 */
export function buildDramaRunResult({
  runState,
  world,
  turn,
  endedBy,
  firstForcedTurn,
  assertedGroundedTurn,
  stagePrologue,
  validGroundedFacts,
  frontierFinal,
  premiseIdForKey,
}) {
  const {
    events,
    trajectory,
    transcript,
    ledger,
    learnerDagSnapshots,
    voicedLedger,
    overreaches,
    mischanneled,
    firstAvailable,
    learnerTransformationPostRows,
  } = runState;
  const verdict = resolveDramaVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn });
  const proof = assertedGroundedTurn !== null ? proofTree(validGroundedFacts, world.rules, world.secret.fact) : null;
  const availability = buildAvailability(firstAvailable, voicedLedger);
  const learnerDag = buildLearnerDag(learnerDagSnapshots, world);
  const learnerTransformationDurability = learnerTransformationPostRows.length
    ? summarizeLearnerTransformationDurability({
        rows: learnerTransformationPostRows,
        releaseTurns: ledger.map((entry) => entry.turn),
        finalTurn: assertedGroundedTurn ?? turn,
      })
    : null;

  return {
    worldId: world.id,
    verdict,
    events,
    trajectory,
    transcript,
    ledger,
    ...(stagePrologue ? { stagePrologue } : {}),
    firstForcedTurn,
    assertedGroundedTurn,
    turnsPlayed: turn,
    proof,
    learnerDag,
    inference: {
      voiced: voicedLedger,
      overreaches,
      mischanneled,
      availability,
      frontierFinal,
    },
    ...buildPolicyResultFields(runState),
    ...buildPedagogicalResultFields(runState, learnerTransformationDurability),
    ...buildOperationalResultFields(runState, premiseIdForKey),
  };
}
