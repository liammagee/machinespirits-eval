import { factKey } from './chainer.js';
import { detectPhaticRecognition } from './rhetoricalMovePolicy.js';
import { isPublicRegister } from './runState.js';
import { ledgerRow } from './strategyLedger.js';

function recordTutorView(runState, tutorView, turn, currentProofDebt) {
  if (tutorView.proxyDagPacing) runState.proxyDagPacingRows.push({ ...tutorView.proxyDagPacing });
  if (tutorView.tutorLearnerDagModel) runState.tutorLearnerDagRows.push({ ...tutorView.tutorLearnerDagModel });
  const debtAudit = runState.proofDebtGuardActive ? currentProofDebt(turn) : null;
  if (!debtAudit?.active) return;
  runState.proofDebtRows.push({
    turn,
    dNow: debtAudit.dNow,
    debts: debtAudit.debts.map(({ premiseId, sinceTurn, dIfRestored, deltaD, closesProof }) => ({
      premiseId,
      sinceTurn,
      dIfRestored,
      deltaD,
      closesProof,
    })),
  });
}

function recordFieldReport(runState, tutorView, turn) {
  if (!tutorView.fieldReportContext) return;
  const report = tutorView.fieldReportContext;
  runState.fieldReportRows.push({
    turn,
    schema: report.schema,
    scriptStage: report.scriptStage || null,
    jointAttractor: report.jointAttractor || null,
    metrics: report.metrics || null,
    nonLeakAuditOk: report.nonLeakAudit?.ok === true,
  });
}

function projectPlannerCandidate(candidate) {
  return {
    moveFamily: candidate.moveFamily || null,
    didacticMode: candidate.didacticMode || null,
    reasonCode: candidate.reasonCode || null,
    targetPremise: candidate.targetPremise || null,
    score: candidate.score ?? null,
    scoreBreakdown: candidate.scoreBreakdown || null,
    expectedMovement: candidate.expectedMovement || null,
    scriptFit: candidate.scriptFit || null,
    expectedLocalUptake: candidate.expectedLocalUptake || null,
  };
}

function projectPlannerDidacticMode(planner) {
  if (!planner.didacticMode) return null;
  return {
    recommendedMode: planner.didacticMode.recommendedMode || null,
    learningSignal: planner.didacticMode.learningSignal || null,
    currentObject: planner.didacticMode.currentObject || null,
  };
}

function projectPlannerConductDecision(planner) {
  if (!planner.conductDecision) return null;
  return {
    selectedMoveFamily: planner.conductDecision.selectedMoveFamily || null,
    reasonCode: planner.conductDecision.reasonCode || null,
    targetPremise: planner.conductDecision.targetPremise || null,
    nonLeakAuditOk: planner.conductDecision.nonLeakAudit?.ok === true,
  };
}

function projectTutorConductPolicy(tutorOut) {
  if (!tutorOut.conductPolicy) return null;
  return {
    selectedMoveFamily: tutorOut.conductPolicy.selectedMoveFamily || null,
    reasonCode: tutorOut.conductPolicy.reasonCode || null,
    enforcement: tutorOut.conductPolicy.enforcement || null,
  };
}

function recordFieldPlanner(runState, tutorView, tutorOut, turn) {
  const planner = tutorOut.fieldPlanner || tutorView.fieldPlanner;
  if (!planner) return null;
  const row = {
    turn,
    schema: planner.schema,
    selectedMoveFamily: planner.selectedMoveFamily || null,
    reasonCode: planner.reasonCode || null,
    rationale: planner.rationale || null,
    targetPremise: planner.targetPremise || null,
    targetSurface: planner.targetSurface || null,
    didacticMode: projectPlannerDidacticMode(planner),
    scriptStage: planner.scriptStage || null,
    jointAttractor: planner.jointAttractor || null,
    metrics: planner.metrics || null,
    projection: planner.projection || null,
    candidateMoves: (planner.candidateMoves || []).map(projectPlannerCandidate),
    expectedMovement: planner.expectedMovement || planner.projection?.selected?.expectedMovement || null,
    efficacyProbe: planner.efficacyProbe || null,
    conductDecision: projectPlannerConductDecision(planner),
    enforcementRequested: runState.fieldPlannerEnforceActive,
    realizedMove: tutorOut.move || null,
    realizedRelease: tutorOut.release || null,
    conductPolicy: projectTutorConductPolicy(tutorOut),
  };
  runState.fieldPlannerRows.push(row);
  return row;
}

function recordTutorRelease({ turn, tutorOut, applyRelease, releasedThisTurn }) {
  const tutorRelease = applyRelease(
    turn,
    tutorOut.release,
    'tutor',
    tutorOut.releaseDecision
      ? { reason: tutorOut.releaseReason || null, offset: tutorOut.releaseDecision.offset ?? null }
      : null,
  );
  if (tutorRelease) releasedThisTurn.push(tutorRelease);
  return tutorRelease;
}

function recordLemmaEffects(runState, tutorOut, turn, sceneState) {
  const lemmaRun = runState.lemmaRun;
  if (!lemmaRun || !tutorOut.lemma) return;
  const lemma = tutorOut.lemma;
  if (lemma.choice) {
    lemmaRun.active = {
      key: lemma.choice.key,
      label: lemma.choice.label,
      by: lemma.choice.by,
      sceneIndex: sceneState?.index ?? null,
      turn,
    };
    lemmaRun.choices.push({ turn, ...lemma.choice });
    if (['tutor', 'tutor_retry', 'delegate'].includes(lemma.choice.by) && lemmaRun.frontier.length > 1) {
      lemmaRun.tutorChoices += 1;
    }
    runState.events.push({ turn, type: 'lemma_choice', detail: `${lemma.choice.label} (${lemma.choice.by})` });
  }
  if (lemma.departure) {
    lemmaRun.departures.push({ turn, premise: lemma.departure.premise, reason: lemma.departure.reason });
    runState.events.push({
      turn,
      type: 'lemma_departure',
      detail: `${lemma.departure.premise}: ${lemma.departure.reason}`,
    });
  }
  if (lemma.blocked) {
    lemmaRun.blocks.push({ turn, premise: lemma.blocked.premise });
    runState.events.push({
      turn,
      type: 'lemma_block',
      detail: `${lemma.blocked.premise} held (untagged departure)`,
    });
  }
  if (lemma.forcedPassthrough) {
    lemmaRun.passthroughs.push({
      turn,
      premise: lemma.forcedPassthrough.premise,
      by: lemma.forcedPassthrough.by,
    });
    runState.events.push({
      turn,
      type: 'lemma_passthrough',
      detail: `${lemma.forcedPassthrough.premise} (${lemma.forcedPassthrough.by})`,
    });
  }
}

function appendTutorTranscript({ runState, tutorOut, tutorView, turn, sceneTempo, sceneMeta, publicRegister }) {
  const phaticRecognition = detectPhaticRecognition(tutorOut.dialogue || '', {
    role: 'tutor',
    tempo: sceneTempo,
  });
  runState.transcript.push({
    turn,
    role: 'tutor',
    text: tutorOut.dialogue || '',
    meta: {
      move: tutorOut.move || null,
      release: tutorOut.release || null,
      deliberation: tutorOut.deliberation || null,
      ...(tutorOut.releaseDecision ? { releaseDecision: tutorOut.releaseDecision } : {}),
      ...(tutorOut.releaseReason ? { releaseReason: tutorOut.releaseReason } : {}),
      ...(tutorOut.theory ? { theory: tutorOut.theory } : {}),
      ...(tutorOut.plot ? { plot: tutorOut.plot } : {}),
      ...(tutorOut.plotAudit ? { plotAudit: tutorOut.plotAudit } : {}),
      ...(tutorOut.throughline ? { throughline: tutorOut.throughline } : {}),
      ...(tutorOut.proofDebt ? { proofDebt: tutorOut.proofDebt } : {}),
      ...(tutorOut.conductPolicy ? { conductPolicy: tutorOut.conductPolicy } : {}),
      ...(tutorOut.rhetoricalPolicy ? { rhetoricalPolicy: tutorOut.rhetoricalPolicy } : {}),
      ...(tutorOut.discursiveCalibration ? { discursiveCalibration: tutorOut.discursiveCalibration } : {}),
      ...(tutorOut.didacticMode ? { didacticMode: tutorOut.didacticMode } : {}),
      ...(tutorOut.fieldPlanner || tutorView.fieldPlanner
        ? { fieldPlanner: tutorOut.fieldPlanner || tutorView.fieldPlanner }
        : {}),
      ...(tutorOut.learnerTransformation ? { learnerTransformation: tutorOut.learnerTransformation } : {}),
      ...(tutorOut.castState ? { castState: tutorOut.castState } : {}),
      ...(tutorOut.tutorReinvention ? { tutorReinvention: tutorOut.tutorReinvention } : {}),
      ...(phaticRecognition.length ? { phaticRecognition } : {}),
      ...(sceneMeta ? { scene: sceneMeta } : {}),
      ...(tutorView.proxyDagPacing ? { proxyDagPacing: tutorView.proxyDagPacing } : {}),
      publicRegister,
    },
  });
}

function recordDidacticMode(runState, tutorOut, turn) {
  const mode = tutorOut.didacticMode;
  if (!mode) return;
  runState.didacticModeRows.push({
    turn,
    ...(runState.actState ? { act: runState.actState.index } : {}),
    schema: mode.schema,
    publicOnly: mode.publicOnly,
    mayOverrideProofControl: mode.mayOverrideProofControl,
    currentObject: mode.currentObject || null,
    learningSignal: mode.learningSignal || null,
    recommendedMode: mode.recommendedMode || null,
    scope: mode.scope || null,
    exitCondition: mode.exitCondition || null,
    ...(mode.opportunityCost
      ? {
          opportunityCost: {
            maxProofNeutralTurns: mode.opportunityCost.maxProofNeutralTurns,
            failureAction: mode.opportunityCost.failureAction,
            proofObligationPreserved: mode.opportunityCost.proofObligationPreserved === true,
          },
        }
      : {}),
    evidence: Array.isArray(mode.evidence) ? mode.evidence.slice(0, 4) : [],
    inputAuditOk: mode.inputAudit?.ok === true,
    nonLeakAuditOk: mode.nonLeakAudit?.ok === true,
  });
}

function recordCastState(runState, tutorOut, turn) {
  const castState = tutorOut.castState;
  if (!castState) return;
  runState.castLayerRows.push({
    turn,
    ...(runState.actState ? { act: runState.actState.index } : {}),
    schema: castState.schema,
    publicOnly: castState.publicOnly === true,
    mayOverrideProofControl: castState.mayOverrideProofControl === true,
    tutorRole: castState.tutor?.stableRole || null,
    tutorStance: castState.tutor?.currentStance || null,
    learnerRole: castState.learner?.stableRole || null,
    learnerPosture: castState.learner?.currentPosture || null,
    relationTrust: castState.relation?.currentTrust || null,
    reinvention: castState.reinvention
      ? {
          schema: castState.reinvention.schema,
          active: castState.reinvention.active === true,
          trigger: castState.reinvention.trigger || null,
          fromStance: castState.reinvention.fromStance || null,
          toStance: castState.reinvention.toStance || null,
          mayOverrideProofControl: castState.reinvention.mayOverrideProofControl === true,
        }
      : null,
    inputAuditOk: castState.inputAudit?.ok === true,
    nonLeakAuditOk: castState.nonLeakAudit?.ok === true,
  });
}

function strategyCommitmentDetail(commitment) {
  return (
    [
      commitment.register ? `register ${commitment.register}` : null,
      commitment.stance ? `stance ${commitment.stance}` : null,
      commitment.didacticDefault ? `didactic ${commitment.didacticDefault}` : null,
      commitment.releasePosture ? `releases ${commitment.releasePosture}` : null,
      commitment.releaseIntent ? `intends ${commitment.releaseIntent.join('+')}` : null,
      commitment.recognitionBudget !== null && commitment.recognitionBudget !== undefined
        ? `recognition budget ${commitment.recognitionBudget}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'committed'
  );
}

function applySceneCommitment({ runState, tutorOut, turn, sceneState, publicRegister }) {
  const ledgerState = runState.ledgerState;
  if (!ledgerState || !tutorOut.sceneCommitment || !sceneState) return publicRegister;
  const commitment = tutorOut.sceneCommitment;
  ledgerState.appliedCommitment = { sceneIndex: sceneState.index, ...commitment };
  ledgerState.rows.push(
    ledgerRow({
      agent: 'tutor',
      scope: 'scene',
      commitment: {
        register: commitment.register || null,
        didacticDefault: commitment.didacticDefault || null,
        releasePosture: commitment.releasePosture || null,
        recognitionBudget: commitment.recognitionBudget ?? null,
        ...(commitment.stance ? { stance: commitment.stance } : {}),
        ...(commitment.releaseIntent ? { releaseIntent: [...commitment.releaseIntent] } : {}),
      },
      committedTurn: turn,
      expires: `scene_${sceneState.index}_close`,
      rationale: commitment.rationale || null,
      exitCondition: commitment.exitCondition || null,
    }),
  );
  runState.events.push({
    turn,
    type: 'strategy_commit',
    detail: `scene ${sceneState.index}: ${strategyCommitmentDetail(commitment)}`,
  });
  if (!commitment.register || !isPublicRegister(commitment.register) || commitment.register === publicRegister) {
    return publicRegister;
  }
  runState.registerRows.push({ turn, register: commitment.register, scope: 'scene', scene: sceneState.index });
  return commitment.register;
}

function recordStrategyAudit(runState, tutorOut, turn) {
  const ledgerState = runState.ledgerState;
  if (!ledgerState || !tutorOut.sceneCommitmentAudit) return;
  const audit = tutorOut.sceneCommitmentAudit;
  const row = [...ledgerState.rows]
    .reverse()
    .find(
      (candidate) =>
        candidate.agent === 'tutor' &&
        candidate.scope === 'scene' &&
        candidate.expires === `scene_${audit.sceneIndex}_close` &&
        !candidate.audit,
    );
  if (row) row.audit = { clauses: audit.clauses, summary: audit.summary };
  const historyEntry = ledgerState.history.find((entry) => entry.sceneIndex === audit.sceneIndex && !entry.audit);
  if (historyEntry) historyEntry.audit = { summary: audit.summary };
  runState.events.push({
    turn,
    type: 'strategy_audit',
    detail: `scene ${audit.sceneIndex} commitment audited: ${audit.summary}`,
  });
}

function recordStrategyFollowups(runState, tutorOut, turn) {
  const ledgerState = runState.ledgerState;
  if (!ledgerState) return;
  if (ledgerState.config.trialling && tutorOut.strategyReview) {
    const pending = [...ledgerState.history].reverse().find((entry) => !entry.review);
    if (pending) pending.review = { ...tutorOut.strategyReview, turn };
    runState.events.push({
      turn,
      type: 'strategy_review',
      detail: `${tutorOut.strategyReview.decision}${tutorOut.strategyReview.reason ? `: ${tutorOut.strategyReview.reason}` : ''}`,
    });
  }
  if (ledgerState.config.planMode && tutorOut.stocktake) {
    ledgerState.stocktakes.push({ turn, ...tutorOut.stocktake });
    runState.events.push({
      turn,
      type: 'stocktake',
      detail: `scene ${tutorOut.stocktake.sceneIndex}: ${
        tutorOut.stocktake.correction
          ? `correction demanded${tutorOut.stocktake.reorientation ? '; reoriented' : '; unanswered'}`
          : 'course holds'
      }`,
    });
  }
  if (ledgerState.config.trialling && tutorOut.departure) {
    ledgerState.departuresThisScene += 1;
    runState.events.push({ turn, type: 'strategy_departure', detail: tutorOut.departure });
  }
  if (
    ledgerState.block &&
    !ledgerState.block.heldMode &&
    tutorOut.didacticMode?.recommendedMode &&
    tutorOut.didacticMode.recommendedMode !== 'minimal_presence'
  ) {
    ledgerState.block.heldMode = tutorOut.didacticMode.recommendedMode;
    ledgerState.block.exitCondition = tutorOut.didacticMode.exitCondition || null;
  }
}

function recordTutorTransformation(runState, tutorOut, turn, learnerTransformationRow) {
  if (!tutorOut.learnerTransformation) return;
  runState.learnerTransformationRows.push(
    learnerTransformationRow(tutorOut.learnerTransformation, turn, runState.actState?.index, 'pre_tutor'),
  );
}

function recordReconstruction(runState, tutorOut, turn, premiseIdForKey) {
  if (!tutorOut.theory) return;
  const held = [];
  const missing = [];
  for (const [key, premiseId] of runState.releasedIdByKey) {
    const entry = runState.grounded.get(key);
    if (entry && entry.valid && !entry.decayed) held.push(premiseId);
    else missing.push(premiseId);
  }
  const mistaken = [];
  for (const entry of runState.grounded.values()) {
    if (!entry.mutatedFalse) continue;
    const premiseId = premiseIdForKey(entry.mutationOf);
    if (premiseId && !mistaken.includes(premiseId)) mistaken.push(premiseId);
  }
  runState.reconstructionRows.push({ turn, believed: tutorOut.theory, truth: { held, missing, mistaken } });
}

function recordPlotPlanning(runState, tutorOut, turn, plotAuditDetail) {
  if (tutorOut.plot) {
    runState.plotRows.push({ ...tutorOut.plot });
    runState.events.push({ turn, type: 'plot', detail: `act ${tutorOut.plot.act} plot committed` });
  }
  if (tutorOut.plotAudit) {
    runState.plotAuditRows.push({ turn, ...tutorOut.plotAudit });
    runState.events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(tutorOut.plotAudit) });
  }
  if (tutorOut.throughline) {
    runState.throughlineRows.push({ ...tutorOut.throughline });
    const revised = tutorOut.throughline.trigger === 'voluntary' || tutorOut.throughline.trigger === 'audit_bound';
    runState.events.push({
      turn,
      type: 'throughline',
      detail: `throughline ${revised ? 'revised' : 'committed'} (${tutorOut.throughline.trigger})`,
    });
  }
}

function collectRepairTargets(tutorOut) {
  const intent = String(tutorOut.move?.intent || '')
    .toLowerCase()
    .trim();
  const targets = [];
  if (tutorOut.move?.targetPremise && intent !== 'confront') targets.push(tutorOut.move.targetPremise);
  if (intent === 'restore' && Array.isArray(tutorOut.proofDebt?.targets)) targets.push(...tutorOut.proofDebt.targets);
  return [...new Set(targets)];
}

function applyTutorRepairs(runState, world, tutorOut, turn, premiseIdForKey) {
  for (const targetPremise of collectRepairTargets(tutorOut)) {
    if (!runState.corruption) break;
    const premise = world.premiseById.get(targetPremise);
    const entry = premise ? runState.grounded.get(factKey(premise.fact)) : null;
    if (!entry?.decayed) continue;
    entry.decayed = false;
    entry.regroundedTurn = turn;
    const repairedId = premiseIdForKey(factKey(premise.fact));
    runState.corruption.ledger.push({ turn, type: 'repair', premiseId: repairedId, via: 'tutor' });
    runState.events.push({ turn, type: 'repair', detail: `${repairedId} restored by the tutor` });
  }
}

/** Invoke the tutor and apply only tutor-owned effects for one turn. */
export async function runTutorTransition({
  runState,
  world,
  turn,
  role,
  buildView,
  currentProofDebt,
  applyRelease,
  releasedThisTurn,
  sceneState,
  sceneMeta,
  sceneTempo,
  publicRegister,
  premiseIdForKey,
  plotAuditDetail,
  learnerTransformationRow,
}) {
  const tutorView = buildView(turn, 'tutor');
  recordTutorView(runState, tutorView, turn, currentProofDebt);
  const tutorOut = (await role(tutorView)) || {};
  recordFieldReport(runState, tutorView, turn);
  const fieldPlannerRow = recordFieldPlanner(runState, tutorView, tutorOut, turn);
  const tutorRelease = recordTutorRelease({ turn, tutorOut, applyRelease, releasedThisTurn });
  recordLemmaEffects(runState, tutorOut, turn, sceneState);
  appendTutorTranscript({ runState, tutorOut, tutorView, turn, sceneTempo, sceneMeta, publicRegister });
  recordDidacticMode(runState, tutorOut, turn);
  recordCastState(runState, tutorOut, turn);
  const nextPublicRegister = applySceneCommitment({ runState, tutorOut, turn, sceneState, publicRegister });
  recordStrategyAudit(runState, tutorOut, turn);
  recordStrategyFollowups(runState, tutorOut, turn);
  recordTutorTransformation(runState, tutorOut, turn, learnerTransformationRow);
  recordReconstruction(runState, tutorOut, turn, premiseIdForKey);
  recordPlotPlanning(runState, tutorOut, turn, plotAuditDetail);
  applyTutorRepairs(runState, world, tutorOut, turn, premiseIdForKey);
  return { tutorView, tutorOut, tutorRelease, fieldPlannerRow, publicRegister: nextPublicRegister };
}
