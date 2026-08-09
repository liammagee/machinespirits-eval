import { factKey, matchPattern } from './chainer.js';
import { projectWorldIRLogic } from './guardCompiler.js';
import { deriveOpportunityCostBudget } from './opportunityCost.js';
import { sceneView, updateScene } from './rhetoricalMovePolicy.js';
import { derivationDistance, detectStall } from './slope.js';
import { buildMechanismHistoryEntry, sceneStanceFidelity } from './strategyLedger.js';

function renderFact(fact) {
  return fact.join(' ');
}

function premiseIdForKey(runState, key) {
  return runState.releasedIdByKey.get(key) ?? runState.premiseIdByKey.get(key) ?? null;
}

function validGroundedFacts(runState) {
  return [...runState.grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);
}

function sceneSpan(closedScene) {
  return (row) => row.turn >= closedScene.startTurn && row.turn <= closedScene.endTurn;
}

function buildClosedSceneSummary(runState, world, closedScene) {
  const span = sceneSpan(closedScene);
  const learnerLines = runState.transcript.filter((entry) => entry.role === 'learner' && span(entry));
  return {
    index: closedScene.index,
    startTurn: closedScene.startTurn,
    endTurn: closedScene.endTurn,
    status: closedScene.status,
    closeReason: closedScene.closeReason,
    counts: { ...closedScene.counts },
    exchanges: closedScene.exchanges.map((exchange) => ({
      turn: exchange.turn,
      type: exchange.type,
      formalActions: exchange.formalActions,
    })),
    lastLearnerText: learnerLines.length ? learnerLines[learnerLines.length - 1].text : '',
    lastExchangeType: closedScene.exchanges.length
      ? closedScene.exchanges[closedScene.exchanges.length - 1].type
      : null,
    releases: runState.ledger.filter(span).map((entry) => ({ turn: entry.turn, premiseId: entry.premiseId })),
    scheduled: world.releaseSchedule
      .filter((entry) => entry.turn >= closedScene.startTurn && entry.turn <= closedScene.endTurn)
      .map((entry) => ({ turn: entry.turn, premise: entry.premise })),
    didacticModes: runState.didacticModeRows.filter(span).map((row) => row.recommendedMode),
    registerHeld: true,
    ...(runState.ledgerState?.config.trialling ? { departures: runState.ledgerState.departuresThisScene } : {}),
  };
}

function recordSceneStrategyOutcome(runState, closedScene, lastClosedSceneSummary, turn) {
  const { ledgerState, transcript, events } = runState;
  if (!ledgerState?.config.trialling || !ledgerState.appliedCommitment) return lastClosedSceneSummary;

  const span = sceneSpan(closedScene);
  const tutorLines = transcript
    .filter((entry) => entry.role === 'tutor' && span(entry))
    .map((entry) => entry.text || '');
  const learnerLines = transcript
    .filter((entry) => entry.role === 'learner' && span(entry))
    .map((entry) => entry.text || '');
  const fidelity = ledgerState.appliedCommitment.stance
    ? sceneStanceFidelity({ stance: ledgerState.appliedCommitment.stance, tutorLines, learnerLines })
    : null;
  const summary = fidelity
    ? { ...lastClosedSceneSummary, stanceFidelity: { label: fidelity.label } }
    : lastClosedSceneSummary;

  if (fidelity) {
    events.push({
      turn,
      type: 'stance_fidelity',
      detail: `scene ${closedScene.index} stance ${ledgerState.appliedCommitment.stance}: ${fidelity.label}`,
    });
  }
  const historyEntry = buildMechanismHistoryEntry({
    sceneRecord: summary,
    commitment: ledgerState.appliedCommitment,
    fidelity,
  });
  if (historyEntry) ledgerState.history.push(historyEntry);
  return summary;
}

function resetSceneStrategy(runState, closedScene, publicRegister, baseRegister, turn) {
  const { ledgerState, registerRows } = runState;
  if (!ledgerState) return publicRegister;
  let nextRegister = publicRegister;
  if (ledgerState.appliedCommitment?.register && publicRegister !== baseRegister) {
    nextRegister = baseRegister;
    registerRows.push({ turn, register: baseRegister, scope: 'scene_end', scene: closedScene.index });
  }
  ledgerState.appliedCommitment = null;
  ledgerState.budget = deriveOpportunityCostBudget({ scope: 'dialogue_block' });
  ledgerState.departuresThisScene = 0;
  return nextRegister;
}

function closeSceneForTurn({
  runState,
  world,
  turn,
  sceneState,
  sceneExchange,
  D,
  forced,
  endedBy,
  lastClosedSceneSummary,
  publicRegister,
  baseRegister,
}) {
  if (!runState.sceneConfig || !sceneState || !sceneExchange) {
    return { sceneState, closedScene: null, lastClosedSceneSummary, publicRegister };
  }

  const updated = updateScene(sceneState, sceneExchange, {
    turn,
    dNow: D,
    forced,
    endedBy,
    config: runState.sceneConfig,
  });
  if (!updated.closed) {
    return { sceneState: updated.scene, closedScene: null, lastClosedSceneSummary, publicRegister };
  }

  const closedScene = updated.closed;
  runState.sceneRows.push(closedScene);
  runState.events.push({
    turn,
    type: 'scene_close',
    detail: `scene ${closedScene.index} closed: ${closedScene.status} (${closedScene.closeReason})`,
  });

  let summary = lastClosedSceneSummary;
  if (runState.ledgerState || runState.learnerLedgerActive) {
    summary = buildClosedSceneSummary(runState, world, closedScene);
  }
  summary = recordSceneStrategyOutcome(runState, closedScene, summary, turn);
  const nextRegister = resetSceneStrategy(runState, closedScene, publicRegister, baseRegister, turn);

  return {
    sceneState: updated.scene,
    closedScene,
    lastClosedSceneSummary: summary,
    publicRegister: nextRegister,
  };
}

function recordStall(runState, world, turn, endedBy) {
  const firstReleaseTurn = runState.ledger.length > 0 ? runState.ledger[0].turn : Infinity;
  const stall = detectStall(runState.trajectory, world.slope.aporia_window, firstReleaseTurn);
  if (!stall || runState.events.some((event) => event.type === stall)) return endedBy;
  runState.events.push({
    turn,
    type: stall,
    detail: `no progress over ${world.slope.aporia_window} turns`,
  });
  return runState.opts.stopOnStall ? stall : endedBy;
}

function mutationPool(runState, world, predicate, position) {
  const staged = runState.corruption?.config.pool === 'staged';
  const poolKey = `${predicate}|${position}|${staged ? runState.releasedKeys.size : 'w'}`;
  if (runState.mutationPoolByPredPos.has(poolKey)) return runState.mutationPoolByPredPos.get(poolKey);

  const constants = new Set();
  const harvest = (fact) => {
    if (fact[0] === predicate && fact.length > position) constants.add(fact[position]);
  };
  for (const premise of world.premiseById.values()) {
    if (staged && !runState.releasedKeys.has(factKey(premise.fact))) continue;
    harvest(premise.fact);
  }
  for (const fact of world.background) harvest(fact);
  const sorted = [...constants].sort();
  runState.mutationPoolByPredPos.set(poolKey, sorted);
  return sorted;
}

function mutationCandidates(runState, world, fact) {
  const candidates = [];
  for (let position = 1; position < fact.length; position += 1) {
    for (const constant of mutationPool(runState, world, fact[0], position)) {
      if (constant === fact[position]) continue;
      const candidate = [...fact];
      candidate[position] = constant;
      const key = factKey(candidate);
      if (runState.grounded.has(key)) continue;
      if (runState.premiseIdByKey.has(key)) continue;
      if (runState.backgroundKeys.has(key)) continue;
      if (key === factKey(world.secret.fact)) continue;
      if (world.mirror && key === factKey(world.mirror.fact)) continue;
      if (matchPattern(world.questionPattern, candidate) !== null) continue;
      candidates.push(candidate);
    }
  }
  return candidates;
}

function eligibleDecayEntries(runState, turn) {
  const eligible = [];
  for (const [key, entry] of runState.grounded) {
    if (!entry.valid || entry.decayed) continue;
    if (!runState.releasedKeys.has(key)) continue;
    const since = entry.regroundedTurn ?? entry.turn;
    if (turn - since < runState.corruption.config.graceTurns) continue;
    eligible.push([key, entry]);
  }
  return eligible;
}

function recordDecayHit(runState, world, turn, key, entry) {
  entry.decayed = true;
  entry.decayTurn = turn;
  const premiseId = premiseIdForKey(runState, key);
  let falseForm = null;
  if (
    runState.corruption.config.mutateShare > 0 &&
    runState.corruption.rng() < runState.corruption.config.mutateShare
  ) {
    const candidates = mutationCandidates(runState, world, entry.fact);
    if (candidates.length) falseForm = candidates[Math.floor(runState.corruption.rng() * candidates.length)];
  }

  if (falseForm) {
    runState.grounded.set(factKey(falseForm), {
      fact: falseForm,
      turn,
      valid: false,
      mutatedFalse: true,
      mutationOf: key,
    });
    runState.corruption.ledger.push({
      turn,
      type: 'decay',
      mode: 'mutate',
      premiseId,
      fact: entry.fact,
      falseForm,
    });
    runState.events.push({
      turn,
      type: 'decay',
      detail: `${premiseId || renderFact(entry.fact)} slips — misremembered as "${renderFact(falseForm)}"`,
    });
  } else {
    runState.corruption.ledger.push({ turn, type: 'decay', premiseId, fact: entry.fact });
    runState.events.push({
      turn,
      type: 'decay',
      detail: `${premiseId || renderFact(entry.fact)} slips from the learner's board`,
    });
  }
  return premiseId || renderFact(entry.fact);
}

function applyDecay(runState, world, turn, endedBy) {
  const decayedNow = [];
  if (!runState.corruption || endedBy || turn < runState.corruption.config.startTurn) return decayedNow;

  const active = [...runState.grounded.values()].filter((entry) => entry.decayed).length;
  const hits = eligibleDecayEntries(runState, turn).filter(
    () => runState.corruption.rng() < runState.corruption.config.rate,
  );
  const capacity = Math.max(0, runState.corruption.config.maxConcurrent - active);
  for (const [key, entry] of hits.slice(0, capacity)) {
    decayedNow.push(recordDecayHit(runState, world, turn, key, entry));
  }
  return decayedNow;
}

function decayedPremiseIds(runState) {
  return [...runState.grounded.entries()]
    .filter(([, entry]) => entry.decayed)
    .map(([key]) => premiseIdForKey(runState, key))
    .filter(Boolean)
    .sort();
}

function recordLogicSnapshot(runState, world, turn, D, forced) {
  if (!runState.logicProjectionActive) return;
  const valid = validGroundedFacts(runState);
  const releasedPremiseIds = runState.ledger.map((entry) => entry.premiseId);
  const decayedIds = decayedPremiseIds(runState);
  const projection = projectWorldIRLogic(runState.worldIR, {
    groundedFacts: valid,
    voicedFacts: runState.voicedLedger.map((entry) => entry.fact),
    releasedPremiseIds,
    decayedPremiseIds: decayedIds,
  });
  runState.logicSnapshots.push({
    turn,
    trajectoryD: D,
    boardD: derivationDistance(world, valid),
    forced,
    groundedPremiseIds: valid
      .map((fact) => premiseIdForKey(runState, factKey(fact)))
      .filter(Boolean)
      .sort(),
    releasedPremiseIds,
    decayedPremiseIds: decayedIds,
    projection,
  });
}

function learnerTransformationStatus(state) {
  return {
    status: state.status || null,
    complete: state.complete === true,
    ownershipLevel: state.ownership?.ownershipLevel || null,
    missingFamilies: state.missingFamilies || [],
    lateOwnershipCheck: state.lateOwnershipCheck === true,
    mayOverrideProofControl: state.mayOverrideProofControl === true,
  };
}

function learnerDriftStatus(learnerOut) {
  if (!learnerOut.learnerDrift) return {};
  return {
    learnerDrift: {
      mode: learnerOut.learnerDrift.mode || null,
      pressure: learnerOut.learnerDrift.pressure || null,
      mayOverrideProofControl: learnerOut.learnerDrift.mayOverrideProofControl === true,
    },
  };
}

function learnerTransformationFields(tutorOut, postLearnerTransformation) {
  const fields = {};
  if (tutorOut.learnerTransformation) {
    fields.learnerTransformation = learnerTransformationStatus(tutorOut.learnerTransformation);
  }
  if (postLearnerTransformation) {
    fields.learnerTransformationPost = learnerTransformationStatus(postLearnerTransformation);
  }
  return fields;
}

function strategyLedgerStatus(runState, tutorOut) {
  const { ledgerState } = runState;
  if (!ledgerState) return null;
  return {
    block: ledgerState.block
      ? {
          index: ledgerState.block.index,
          type: ledgerState.block.type,
          heldMode: ledgerState.block.heldMode,
          turns: ledgerState.block.turns,
        }
      : null,
    ...(tutorOut.sceneCommitment
      ? {
          commitment: {
            register: tutorOut.sceneCommitment.register || null,
            didacticDefault: tutorOut.sceneCommitment.didacticDefault || null,
            releasePosture: tutorOut.sceneCommitment.releasePosture || null,
            recognitionBudget: tutorOut.sceneCommitment.recognitionBudget ?? null,
          },
        }
      : {}),
    ...(tutorOut.sceneCommitmentAudit
      ? {
          audit: {
            sceneIndex: tutorOut.sceneCommitmentAudit.sceneIndex,
            summary: tutorOut.sceneCommitmentAudit.summary,
          },
        }
      : {}),
  };
}

function strategyLedgerField(runState, tutorOut) {
  const strategyLedger = strategyLedgerStatus(runState, tutorOut);
  return strategyLedger ? { strategyLedger } : {};
}

function liveSceneStatus(runState, sceneState, closedScene, sceneTempo, sceneRecognitionNeed, sceneExchange) {
  if (!runState.sceneConfig) return {};
  return {
    exchange: sceneExchange,
    scene: sceneState ? sceneView(sceneState, sceneTempo, sceneRecognitionNeed) : null,
    closedScene: closedScene
      ? {
          index: closedScene.index,
          status: closedScene.status,
          closeReason: closedScene.closeReason,
          turns: [closedScene.startTurn, closedScene.endTurn],
        }
      : null,
  };
}

function corruptionStatus(runState, decayedNow, turn, F) {
  if (!runState.corruption) return {};
  return {
    decayedNow,
    repairedNow: runState.corruption.ledger
      .filter((entry) => entry.type === 'repair' && entry.turn === turn)
      .map((entry) => entry.premiseId),
    decayActive: [...runState.grounded.values()].filter((entry) => entry.decayed).length,
    F,
  };
}

function actStatus(runState) {
  return runState.actState ? { act: { index: runState.actState.index, startTurn: runState.actState.startTurn } } : {};
}

function learnerLedgerStatus(runState, learnerOut) {
  if (!runState.learnerLedgerActive || (!learnerOut.sceneIntent && !learnerOut.actCarry)) return {};
  return {
    learnerLedger: {
      ...(learnerOut.sceneIntent ? { intent: learnerOut.sceneIntent } : {}),
      ...(learnerOut.actCarry ? { carry: learnerOut.actCarry } : {}),
    },
  };
}

function didacticModeStatus(tutorOut) {
  if (!tutorOut.didacticMode) return {};
  return {
    didacticMode: {
      learningSignal: tutorOut.didacticMode.learningSignal || null,
      recommendedMode: tutorOut.didacticMode.recommendedMode || null,
      scope: tutorOut.didacticMode.scope || null,
      currentObject: tutorOut.didacticMode.currentObject || null,
    },
  };
}

function fieldPlannerStatus(fieldPlannerRow) {
  if (!fieldPlannerRow) return {};
  return {
    fieldPlanner: {
      selectedMoveFamily: fieldPlannerRow.selectedMoveFamily,
      reasonCode: fieldPlannerRow.reasonCode,
      targetPremise: fieldPlannerRow.targetPremise,
      didacticMode: fieldPlannerRow.didacticMode?.recommendedMode || null,
      efficacy: fieldPlannerRow.outcome?.efficacy || null,
      projectionAlignment: fieldPlannerRow.outcome?.projectionAlignment || null,
      selectedScore: fieldPlannerRow.projection?.selected?.score ?? null,
    },
  };
}

function castStatus(tutorOut) {
  if (!tutorOut.castState) return {};
  return {
    castState: {
      tutor: {
        role: tutorOut.castState.tutor?.stableRole || null,
        currentStance: tutorOut.castState.tutor?.currentStance || null,
      },
      learner: {
        role: tutorOut.castState.learner?.stableRole || null,
        posture: tutorOut.castState.learner?.currentPosture || null,
      },
      relation: { currentTrust: tutorOut.castState.relation?.currentTrust || null },
    },
  };
}

function tutorReinventionStatus(tutorOut) {
  if (!tutorOut.tutorReinvention) return {};
  return {
    tutorReinvention: {
      active: tutorOut.tutorReinvention.active === true,
      trigger: tutorOut.tutorReinvention.trigger || null,
      toStance: tutorOut.tutorReinvention.toStance || null,
      mayOverrideProofControl: tutorOut.tutorReinvention.mayOverrideProofControl === true,
    },
  };
}

function buildLiveTurnStatus({
  runState,
  world,
  turn,
  D,
  F,
  forced,
  endedBy,
  sceneState,
  closedScene,
  sceneExchange,
  sceneTempo,
  sceneRecognitionNeed,
  publicRegister,
  learnerOut,
  tutorOut,
  directorView,
  tutorView,
  releasedThisTurn,
  deriveOutcomes,
  postLearnerTransformation,
  fieldPlannerRow,
  decayedNow,
}) {
  return {
    turn,
    turnCap: world.turnCap,
    D,
    forced,
    lines: runState.transcript.filter((entry) => entry.turn === turn),
    released: [...releasedThisTurn],
    adopted: (learnerOut.adopt || []).length,
    retracted: (learnerOut.retract || []).length,
    derived: deriveOutcomes.filter((outcome) => outcome.status === 'voiced').length,
    overreached: deriveOutcomes.filter((outcome) => outcome.status === 'overreach').length,
    hypothesis: Boolean(learnerOut.hypothesis),
    asserted: Boolean(learnerOut.asserts),
    ...learnerDriftStatus(learnerOut),
    ...learnerTransformationFields(tutorOut, postLearnerTransformation),
    ...liveSceneStatus(runState, sceneState, closedScene, sceneTempo, sceneRecognitionNeed, sceneExchange),
    intervened: Boolean(tutorOut.deliberation?.intervened),
    phase: runState.staging.phase ? { ...runState.staging.phase } : null,
    events: runState.events.filter((event) => event.turn === turn).map(({ type, detail }) => ({ type, detail })),
    ...corruptionStatus(runState, decayedNow, turn, F),
    ...actStatus(runState),
    ...strategyLedgerField(runState, tutorOut),
    ...learnerLedgerStatus(runState, learnerOut),
    ...didacticModeStatus(tutorOut),
    ...fieldPlannerStatus(fieldPlannerRow),
    ...castStatus(tutorOut),
    ...tutorReinventionStatus(tutorOut),
    publicRegister,
    tutorLearnerDagModel: tutorView.tutorLearnerDagModel || null,
    proxyDagPacing: tutorView.proxyDagPacing || directorView.proxyDagPacing || null,
    endedBy,
  };
}

export function runPostTurnLifecycle({
  runState,
  world,
  turn,
  sceneState,
  sceneExchange,
  sceneTempo,
  sceneRecognitionNeed,
  lastClosedSceneSummary,
  publicRegister,
  baseRegister,
  endedBy,
  learnerOut,
  tutorOut,
  directorView,
  tutorView,
  releasedThisTurn,
  deriveOutcomes,
  postLearnerTransformation,
  fieldPlannerRow,
  D,
  F,
  forced,
}) {
  const sceneOutcome = closeSceneForTurn({
    runState,
    world,
    turn,
    sceneState,
    sceneExchange,
    D,
    forced,
    endedBy,
    lastClosedSceneSummary,
    publicRegister,
    baseRegister,
  });
  const nextEndedBy = recordStall(runState, world, turn, endedBy);
  const decayedNow = applyDecay(runState, world, turn, nextEndedBy);
  recordLogicSnapshot(runState, world, turn, D, forced);
  runState.opts.onTurn?.(
    buildLiveTurnStatus({
      runState,
      world,
      turn,
      D,
      F,
      forced,
      endedBy: nextEndedBy,
      sceneState: sceneOutcome.sceneState,
      closedScene: sceneOutcome.closedScene,
      sceneExchange,
      sceneTempo,
      sceneRecognitionNeed,
      publicRegister: sceneOutcome.publicRegister,
      learnerOut,
      tutorOut,
      directorView,
      tutorView,
      releasedThisTurn,
      deriveOutcomes,
      postLearnerTransformation,
      fieldPlannerRow,
      decayedNow,
    }),
  );
  return {
    sceneState: sceneOutcome.sceneState,
    closedScene: sceneOutcome.closedScene,
    lastClosedSceneSummary: sceneOutcome.lastClosedSceneSummary,
    publicRegister: sceneOutcome.publicRegister,
    endedBy: nextEndedBy,
    decayedNow,
  };
}
