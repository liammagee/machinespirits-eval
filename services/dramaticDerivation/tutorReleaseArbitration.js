import { pacingGuardDecision } from './pacing.js';
import { visibleGuardDecision } from './visiblePacing.js';

/**
 * Tolerant frontier-claim matcher for the lemma instrument. "default" is
 * handled by callers because it represents explicit delegation, not a claim.
 */
export function matchFrontierClaim(frontier, claimed) {
  if (!claimed) return null;
  const normalize = (value) => value.toLowerCase().replace(/\s+/g, '');
  const predicateOf = (value) => value.split('(')[0];
  let match =
    frontier.find((entry) => entry.label === claimed) ||
    frontier.find((entry) => normalize(entry.label) === normalize(claimed)) ||
    null;
  if (!match) {
    const predicateMatches = frontier.filter(
      (entry) => normalize(predicateOf(entry.label)) === normalize(predicateOf(claimed)),
    );
    if (predicateMatches.length === 1) match = predicateMatches[0];
  }
  return match;
}

function claimedRelease(output) {
  return typeof output.release === 'string' && output.release.trim() ? output.release.trim() : null;
}

function hiddenPacingGuard({
  enabled,
  runtimeMonitor,
  world,
  view,
  playable,
  validClaim,
  forcedPlay,
  releaseLatitude,
}) {
  if (!enabled) return null;
  const input = {
    ledger: view.ledger,
    turn: view.turn,
    playable,
    validClaim,
    forcedPlay,
  };
  return runtimeMonitor
    ? runtimeMonitor.hiddenPacingDecision(input)
    : pacingGuardDecision(world, view.ledger, {
        turn: view.turn,
        playable,
        validClaim,
        forcedPlay,
        latitude: releaseLatitude,
      });
}

function visiblePacingGuard({ enabled, world, view, playable, validClaim, forcedPlay }) {
  return enabled
    ? visibleGuardDecision(world, view, {
        turn: view.turn,
        playable,
        validClaim,
        forcedPlay,
      })
    : null;
}

function visiblePushState(hiddenGuard, visibleGuard, turn) {
  const visiblePush = Boolean(
    visibleGuard?.forcedSafe && visibleGuard.forcedBy === 'visible_stall' && typeof visibleGuard.played === 'string',
  );
  const hiddenSafeTurns = visiblePush ? hiddenGuard?.safeTurns?.[visibleGuard.played] || [] : [];
  const hiddenSafeAtCurrentTurn = hiddenSafeTurns.includes(turn);
  const hiddenForcedDifferent = Boolean(
    hiddenGuard?.forcedSafe && hiddenGuard.played && visibleGuard?.played && hiddenGuard.played !== visibleGuard.played,
  );
  const accepted = visiblePush && hiddenSafeAtCurrentTurn && !hiddenForcedDifferent;
  return { visiblePush, hiddenSafeAtCurrentTurn, hiddenForcedDifferent, accepted };
}

function visiblePushReason({ accepted, visiblePush, hiddenSafeAtCurrentTurn, visibleGuard, turn }) {
  let reason = 'visible probe ignored: only visible_stall forced-safe pushes can override hidden';
  if (accepted) {
    reason = `${visibleGuard.played} visible-stall push accepted: hidden guard also marks t${turn} safe`;
  } else if (visiblePush && hiddenSafeAtCurrentTurn) {
    reason = 'visible-stall push rejected: hidden guard has a different forced-safe release';
  } else if (visiblePush) {
    reason = `${visibleGuard.played} visible-stall push rejected: hidden guard does not mark t${turn} safe`;
  }
  return reason;
}

function visiblePushArbitration({ enabled, hiddenGuard, visibleGuard, turn }) {
  if (!enabled) return { activeGuard: hiddenGuard || visibleGuard, hybridGuard: null };
  const state = visiblePushState(hiddenGuard, visibleGuard, turn);
  return {
    activeGuard: state.accepted ? visibleGuard : hiddenGuard,
    hybridGuard: {
      mode: 'hidden_default_visible_stall_probe',
      accepted: state.accepted,
      played: state.accepted ? visibleGuard.played : hiddenGuard?.played || null,
      visibleCandidate: visibleGuard?.played || visibleGuard?.candidate || null,
      hiddenCandidate: hiddenGuard?.played || hiddenGuard?.candidate || null,
      hiddenSafeAtCurrentTurn: Boolean(state.hiddenSafeAtCurrentTurn),
      hiddenForcedDifferent: state.hiddenForcedDifferent,
      reason: visiblePushReason({ ...state, visibleGuard, turn }),
    },
  };
}

function visibleConsolidationArbitration({ enabled, hiddenGuard, visibleGuard, visibleConsolidation, activeGuard }) {
  if (!enabled) return { activeGuard, consolidationGuard: null };
  const visibleHold = Boolean(visibleGuard?.blocked);
  const hiddenForced = Boolean(hiddenGuard?.forcedSafe);
  const held = visibleHold && !hiddenForced;
  let reason = 'visible consolidation advisory only; hidden guard remains release authority';
  if (held) {
    reason = 'visible hold accepted: prior exhibit is not yet taken up and hidden is not forcing a release';
  } else if (visibleGuard?.forcedSafe && visibleGuard.forcedBy === 'visible_stall') {
    reason = 'visible stall push ignored: v4 never accelerates release';
  } else if (hiddenForced && visibleHold) {
    reason = 'visible hold ignored: hidden guard is forcing a release';
  }
  return {
    activeGuard: held ? visibleGuard : hiddenGuard,
    consolidationGuard: {
      mode: 'hidden_default_visible_hold_consolidation',
      held,
      played: held ? null : hiddenGuard?.played || null,
      visibleCandidate: visibleGuard?.candidate || null,
      hiddenCandidate: hiddenGuard?.played || hiddenGuard?.candidate || null,
      hiddenForced,
      visibleStalling: Boolean(visibleGuard?.visibleFeatures?.stalling),
      visiblePushIgnored: Boolean(visibleGuard?.forcedSafe && visibleGuard.forcedBy === 'visible_stall'),
      promptAdvisory: visibleConsolidation?.lines || [],
      reason,
    },
  };
}

function arbitratePacingGuards(context) {
  const hiddenGuard = hiddenPacingGuard(context);
  const visibleGuard = visiblePacingGuard({
    ...context,
    enabled: context.visibleGuardEnabled,
  });
  const pushed = visiblePushArbitration({
    enabled: context.visiblePushProbeGuard,
    hiddenGuard,
    visibleGuard,
    turn: context.view.turn,
  });
  const consolidated = visibleConsolidationArbitration({
    enabled: context.visibleConsolidationGuard,
    hiddenGuard,
    visibleGuard,
    visibleConsolidation: context.visibleConsolidation,
    activeGuard: pushed.activeGuard,
  });
  return {
    hiddenGuard,
    visibleGuard,
    activeGuard: consolidated.activeGuard,
    hybridGuard: pushed.hybridGuard,
    consolidationGuard: consolidated.consolidationGuard,
  };
}

function proofClosingFallback({ pacingGuard, visibleGuard, validClaim, activeGuard, pacingRows, turn }) {
  if (!pacingGuard || visibleGuard || validClaim || activeGuard?.played) return null;
  return (
    pacingRows
      .filter(
        (row) =>
          row.current?.safe === true && Number.isFinite(row.current.forcedTurn) && row.current.forcedTurn <= turn,
      )
      .sort((a, b) => a.turn - b.turn)[0] || null
  );
}

function applyProofClosingFallback({ activeGuard, hiddenGuard, fallback, pacingRows, turn }) {
  if (!fallback) return activeGuard;
  return {
    ...(hiddenGuard || {}),
    played: fallback.premise,
    blocked: false,
    forcedSafe: true,
    forcedBy: 'proof_closing_candidate',
    candidate: null,
    candidateSolvency: null,
    playedSolvency: fallback.current,
    safeTurns: hiddenGuard?.safeTurns || Object.fromEntries(pacingRows.map((row) => [row.premise, row.safeTurns])),
    alternative: fallback.premise,
    reason: `${fallback.premise} closes the proof at t${turn}`,
  };
}

function lemmaChoice(output, lemmaInfo, view) {
  const opening = Boolean(view.scene && view.scene.startTurn === view.turn);
  if (!opening || !lemmaInfo.frontier.length) return null;
  const claimed = typeof output.active_lemma === 'string' ? output.active_lemma.trim() : null;
  const delegated = Boolean(claimed && claimed.toLowerCase() === 'default');
  const matched = delegated ? null : matchFrontierClaim(lemmaInfo.frontier, claimed);
  const selected = matched || lemmaInfo.frontier[0];
  let selectedBy = 'fallback';
  if (matched) selectedBy = output._lemmaRetried ? 'tutor_retry' : 'tutor';
  else if (delegated) selectedBy = 'delegate';
  else if (lemmaInfo.frontier.length === 1) selectedBy = 'auto';
  const refusal = output._lemmaRefused;
  return {
    key: selected.key,
    label: selected.label,
    by: selectedBy,
    raw: claimed ?? null,
    ...(output._lemmaRetried ? { firstRaw: output._lemmaFirstRaw ?? null, retried: true } : {}),
    ...(refusal
      ? {
          refused: true,
          refusalPriorPick: refusal.priorPick,
          refusalTrigger: refusal.trigger || 'regression',
          regressionsCited: refusal.regressions,
          ...(refusal.stallSpan != null ? { stallSpanCited: refusal.stallSpan } : {}),
          refusalAuthor: refusal.author || 'harness',
          ...(refusal.author === 'model'
            ? {
                refusalAuthored: Boolean(refusal.authored),
                refusalText: refusal.refusalText ?? null,
              }
            : {}),
          refusalOutcome: matched ? (matched.label === refusal.priorPick ? 'defended' : 'switched') : 'unresolved',
          defense:
            typeof output.strategy_defense === 'string' && output.strategy_defense.trim()
              ? output.strategy_defense.trim()
              : null,
        }
      : {}),
  };
}

function applyLemmaBinding({ output, view, candidatePlayed, activeGuard, forcedPlay }) {
  const lemmaInfo = view.lemmaLayer || null;
  if (!lemmaInfo?.config?.bind) return { candidatePlayed, lemmaMeta: null, lemmaGate: null };
  const lemmaMeta = {};
  const choice = lemmaChoice(output, lemmaInfo, view);
  if (choice) lemmaMeta.choice = choice;
  const activeKey = choice?.key || lemmaInfo.activeKey || null;
  const activeNode = activeKey ? lemmaInfo.frontier.find((entry) => entry.key === activeKey) || null : null;
  const outsideSupport =
    candidatePlayed &&
    lemmaInfo.proofPremiseIds.includes(candidatePlayed) &&
    activeNode &&
    !activeNode.support.includes(candidatePlayed);
  if (!outsideSupport) return { candidatePlayed, lemmaMeta, lemmaGate: null };

  const harnessForced = Boolean(activeGuard?.forcedSafe || (forcedPlay && candidatePlayed === forcedPlay.premise));
  const departureReason =
    typeof output.lemma_departure === 'string' && output.lemma_departure.trim() ? output.lemma_departure.trim() : null;
  if (harnessForced) {
    lemmaMeta.forcedPassthrough = {
      premise: candidatePlayed,
      by: activeGuard?.forcedSafe ? 'guard' : 'hold_limit',
    };
    return { candidatePlayed, lemmaMeta, lemmaGate: null };
  }
  if (departureReason) {
    lemmaMeta.departure = { premise: candidatePlayed, reason: departureReason };
    return { candidatePlayed, lemmaMeta, lemmaGate: null };
  }
  const lemmaGate = {
    held: true,
    premise: candidatePlayed,
    reason: `${candidatePlayed} is outside the active lemma ${activeNode.label} and carries no lemma_departure`,
  };
  lemmaMeta.blocked = { premise: candidatePlayed };
  return { candidatePlayed: null, lemmaMeta, lemmaGate };
}

function candidateSolvency(activeGuard, candidatePlayed) {
  if (activeGuard?.candidate === candidatePlayed) return activeGuard.candidateSolvency;
  return activeGuard?.played === candidatePlayed ? activeGuard.playedSolvency : null;
}

function buildDiscursiveReleaseGate({
  candidatePlayed,
  candidateSchedule,
  candidateOffset,
  highDiscursiveStrain,
  proofControlForcesRelease,
  discursiveCalibrationState,
  auditPublicReleaseContent,
  output,
}) {
  if (!highDiscursiveStrain || !candidatePlayed || candidateOffset >= 0 || proofControlForcesRelease) return null;
  const publicContentAudit = auditPublicReleaseContent(candidatePlayed, output.dialogue);
  const shared = {
    candidate: candidatePlayed,
    scheduledTurn: candidateSchedule.turn,
    offset: candidateOffset,
    posture: discursiveCalibrationState.publicPosture || null,
    pressure: discursiveCalibrationState.advisory?.pressure || null,
    publicContentAudit,
  };
  return publicContentAudit?.voiced
    ? {
        held: false,
        ...shared,
        publicContentOverride: true,
        reason: `${candidatePlayed} registered despite high public strain: public line voiced the exhibit content before the scheduled turn`,
      }
    : {
        held: true,
        ...shared,
        reason: `${candidatePlayed} held: high public strain suppresses discretionary early release until scheduled turn ${candidateSchedule.turn}`,
      };
}

function hiddenGuardReport(hiddenGuard) {
  if (!hiddenGuard) return null;
  return {
    blocked: hiddenGuard.blocked,
    forcedSafe: hiddenGuard.forcedSafe,
    forcedBy: hiddenGuard.forcedBy || null,
    candidate: hiddenGuard.candidate || null,
    alternative: hiddenGuard.alternative || null,
    alternativeTurn: hiddenGuard.alternativeTurn || null,
    reason: hiddenGuard.reason || null,
    candidateSolvency: hiddenGuard.candidateSolvency || null,
    playedSolvency: hiddenGuard.playedSolvency || null,
    safeTurns: hiddenGuard.safeTurns,
    runtimeMonitor: hiddenGuard.runtimeMonitor || null,
  };
}

function visibleGuardReport(visibleGuard) {
  if (!visibleGuard) return null;
  return {
    blocked: visibleGuard.blocked,
    forcedSafe: visibleGuard.forcedSafe,
    forcedBy: visibleGuard.forcedBy || null,
    candidate: visibleGuard.candidate || null,
    reason: visibleGuard.reason || null,
    visibleFeatures: visibleGuard.visibleFeatures || null,
  };
}

function releaseWasOverridden({ forced, claimed, activeGuard, played, discursiveReleaseGate }) {
  return Boolean(
    (forced && claimed !== forced) ||
    (activeGuard?.forcedSafe && claimed !== activeGuard.played) ||
    (activeGuard?.blocked && (!played || claimed !== played)) ||
    discursiveReleaseGate?.held,
  );
}

function releaseDecisionReport({
  view,
  playable,
  claimed,
  validClaim,
  forced,
  played,
  schedule,
  releaseReason,
  activeGuard,
  hiddenGuard,
  visibleGuard,
  hybridGuard,
  consolidationGuard,
  discursiveReleaseGate,
  lemmaGate,
}) {
  const hiddenGuardForReport = hiddenGuard && !visibleGuard ? activeGuard || hiddenGuard : hiddenGuard;
  const pacingGuard = hiddenGuardReport(hiddenGuardForReport);
  const visibleGuardDetails = visibleGuardReport(visibleGuard);
  return {
    turn: view.turn,
    windowSize: playable.length,
    claimed,
    invalidClaim: Boolean(claimed && !validClaim),
    forced,
    overridden: releaseWasOverridden({ forced, claimed, activeGuard, played, discursiveReleaseGate }),
    played,
    scheduledTurn: schedule ? schedule.turn : null,
    offset: schedule ? view.turn - schedule.turn : null,
    reason: releaseReason,
    ...(pacingGuard ? { pacingGuard } : {}),
    ...(visibleGuardDetails ? { visibleGuard: visibleGuardDetails } : {}),
    ...(hybridGuard ? { hybridGuard } : {}),
    ...(consolidationGuard ? { consolidationGuard } : {}),
    ...(discursiveReleaseGate ? { discursiveReleaseGate } : {}),
    ...(lemmaGate ? { lemmaGate } : {}),
  };
}

function resolveActiveGuard(context, validClaim) {
  const guards = arbitratePacingGuards({ ...context, validClaim });
  const fallback = proofClosingFallback({
    pacingGuard: context.enabled,
    visibleGuard: guards.visibleGuard,
    validClaim,
    activeGuard: guards.activeGuard,
    pacingRows: context.pacingRows,
    turn: context.view.turn,
  });
  return {
    ...guards,
    activeGuard: applyProofClosingFallback({
      activeGuard: guards.activeGuard,
      hiddenGuard: guards.hiddenGuard,
      fallback,
      pacingRows: context.pacingRows,
      turn: context.view.turn,
    }),
  };
}

function resolveReleaseCandidate({
  output,
  world,
  view,
  forcedPlay,
  guards,
  validClaim,
  topProofDebt,
  forcedNote,
  finalEntitlement,
  highDiscursiveStrain,
  discursiveCalibrationState,
  auditPublicReleaseContent,
}) {
  const initialCandidate = guards.activeGuard
    ? guards.activeGuard.played
    : forcedPlay
      ? forcedPlay.premise
      : validClaim;
  const lemma = applyLemmaBinding({
    output,
    view,
    candidatePlayed: initialCandidate,
    activeGuard: guards.activeGuard,
    forcedPlay,
  });
  const candidatePlayed = lemma.candidatePlayed;
  const candidateSchedule = candidatePlayed
    ? world.releaseSchedule.find((entry) => entry.premise === candidatePlayed)
    : null;
  const candidateOffset = candidateSchedule ? view.turn - candidateSchedule.turn : null;
  const solvency = candidateSolvency(guards.activeGuard, candidatePlayed);
  const closesProofNow =
    solvency?.safe === true && Number.isFinite(solvency.forcedTurn) && solvency.forcedTurn <= view.turn;
  const proofControlForcesRelease = Boolean(
    forcedPlay?.premise === candidatePlayed ||
    guards.activeGuard?.forcedSafe ||
    closesProofNow ||
    topProofDebt ||
    forcedNote ||
    finalEntitlement?.canAssertFinal,
  );
  const discursiveReleaseGate = buildDiscursiveReleaseGate({
    candidatePlayed,
    candidateSchedule,
    candidateOffset,
    highDiscursiveStrain,
    proofControlForcesRelease,
    discursiveCalibrationState,
    auditPublicReleaseContent,
    output,
  });
  return {
    lemma,
    discursiveReleaseGate,
    played: discursiveReleaseGate?.held ? null : candidatePlayed,
  };
}

function hasLemmaMetadata(lemmaMeta) {
  return Boolean(
    lemmaMeta && (lemmaMeta.choice || lemmaMeta.departure || lemmaMeta.blocked || lemmaMeta.forcedPassthrough),
  );
}

/**
 * Resolve the tutor's formal release channel once, on the draft. All prompt
 * construction and model calls stay with llmRoles; this owner receives only
 * the already-computed turn context and returns the immutable release bits
 * that ride any later superego revision.
 */
export function resolveTutorRelease(context) {
  const {
    output,
    world,
    view,
    releaseAuthority,
    scheduledEntry,
    playable,
    forcedPlay,
    pacingGuard,
    runtimeMonitor,
    visibleGuard,
    visiblePushProbeGuard,
    visibleConsolidationGuard,
    visibleConsolidation,
    pacingRows,
    topProofDebt,
    forcedNote,
    finalEntitlement,
    highDiscursiveStrain,
    discursiveCalibrationState,
    auditPublicReleaseContent,
    releaseLatitude,
  } = context;
  if (!releaseAuthority) return { release: scheduledEntry ? scheduledEntry.premise : null };
  const claimed = claimedRelease(output);
  const validClaim = claimed && playable.some((entry) => entry.premise === claimed) ? claimed : null;
  const guards = resolveActiveGuard(
    {
      enabled: pacingGuard,
      runtimeMonitor,
      world,
      view,
      playable,
      validClaim,
      forcedPlay,
      releaseLatitude,
      visibleGuardEnabled: visibleGuard || visiblePushProbeGuard || visibleConsolidationGuard,
      visiblePushProbeGuard,
      visibleConsolidationGuard,
      visibleConsolidation,
      pacingRows,
    },
    validClaim,
  );
  const candidate = resolveReleaseCandidate({
    output,
    world,
    view,
    forcedPlay,
    guards,
    validClaim,
    topProofDebt,
    forcedNote,
    finalEntitlement,
    highDiscursiveStrain,
    discursiveCalibrationState,
    auditPublicReleaseContent,
  });
  const statedReason =
    typeof output.release_reason === 'string' && output.release_reason.trim() ? output.release_reason.trim() : null;
  const schedule = candidate.played ? world.releaseSchedule.find((entry) => entry.premise === candidate.played) : null;
  const releaseReason =
    candidate.discursiveReleaseGate?.reason ||
    statedReason ||
    (candidate.played && guards.activeGuard?.reason ? guards.activeGuard.reason : null);
  const forced = forcedPlay && candidate.played === forcedPlay.premise ? forcedPlay.premise : null;
  const releaseDecision = releaseDecisionReport({
    view,
    playable,
    claimed,
    validClaim,
    forced,
    played: candidate.played,
    schedule,
    releaseReason,
    activeGuard: guards.activeGuard,
    hiddenGuard: guards.hiddenGuard,
    visibleGuard: guards.visibleGuard,
    hybridGuard: guards.hybridGuard,
    consolidationGuard: guards.consolidationGuard,
    discursiveReleaseGate: candidate.discursiveReleaseGate,
    lemmaGate: candidate.lemma.lemmaGate,
  });
  return {
    release: candidate.played,
    ...(releaseReason ? { releaseReason } : {}),
    releaseDecision,
    ...(hasLemmaMetadata(candidate.lemma.lemmaMeta) ? { lemma: candidate.lemma.lemmaMeta } : {}),
  };
}
