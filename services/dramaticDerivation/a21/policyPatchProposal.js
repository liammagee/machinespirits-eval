export const A21_POLICY_PATCH_PROPOSAL_SCHEMA = 'dramatic-derivation.a21.policy-patch-proposal.v0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function topAction(analysis) {
  const topId = analysis?.topActionIds?.[0] || null;
  return (analysis?.actionSummaries || []).find((row) => row.actionId === topId) || null;
}

function actionSummary(analysis, actionId) {
  return (analysis?.actionSummaries || []).find((row) => row.actionId === actionId) || null;
}

function hasReleaseBeatsDiagnosticEvidence(analysis) {
  const release = actionSummary(analysis, 'B_RELEASE_P_POINT');
  const diagnostic = actionSummary(analysis, 'A_DIAG_CONFLICT');
  return Boolean(
    analysis?.decisionCategory === 'release_beats_diagnostic' &&
    analysis?.topActionIds?.includes('B_RELEASE_P_POINT') &&
    release &&
    diagnostic &&
    Number(release.meanReward) > Number(diagnostic.meanReward),
  );
}

function targetPremise(fixture) {
  return fixture?.releaseContext?.targetPremise || 'p_point';
}

function triggerTurn(fixture) {
  return Number(fixture?.trigger?.turn || 0);
}

function releaseAuthorizedNow(fixture, target) {
  const turn = triggerTurn(fixture);
  const hidden = fixture?.releaseContext?.hiddenObserved || {};
  const failed = fixture?.releaseContext?.failedObserved || {};
  const safeTurns = [...(hidden.safeTurns || []), ...(failed.safeTurns || [])].map(Number);
  return (
    (hidden.targetPremise === target && Number(hidden.scheduledTurn) === turn) ||
    (failed.targetPremise === target && Number(failed.scheduledTurn) === turn) ||
    safeTurns.includes(turn)
  );
}

function forbiddenPhrases(fixture) {
  return (
    fixture?.nonLeakConstraints?.forbiddenKeys || ['secret', 'proofPath', 'rawBoard', 'hiddenBoard', 'D arithmetic']
  );
}

export function buildA21PolicyPatchProposal({ analysis, fixture }) {
  if (!analysis || typeof analysis !== 'object') throw new Error('a21.policyPatchProposal: analysis is required');
  if (!fixture || typeof fixture !== 'object') throw new Error('a21.policyPatchProposal: fixture is required');

  const target = targetPremise(fixture);
  const supported = hasReleaseBeatsDiagnosticEvidence(analysis);
  const release = actionSummary(analysis, 'B_RELEASE_P_POINT');
  const diagnostic = actionSummary(analysis, 'A_DIAG_CONFLICT');
  const repair = actionSummary(analysis, 'C_RESTAGE_P_POINT');
  const consolidation = actionSummary(analysis, 'D_CONSOLIDATE_THEN_RELEASE');
  const top = topAction(analysis);

  return {
    schema: A21_POLICY_PATCH_PROPOSAL_SCHEMA,
    policy_patch_id: 'a21_hethel_release_after_diagnostic_budget',
    status: supported ? 'proposed_only' : 'blocked_by_microbench',
    promoted: false,
    runtime_behavior_changed: false,
    generatedAt: new Date().toISOString(),
    source: {
      analysisSchema: analysis.schema,
      fixtureId: analysis.fixtureId || fixture.fixtureId,
      fixtureHash: analysis.fixtureHash || fixture.fixtureHash,
      decisionCategory: analysis.decisionCategory,
      topActionIds: [...(analysis.topActionIds || [])],
      bestMeanReward: analysis.bestMeanReward,
      observedHiddenActionFamily: fixture?.observedAtTrigger?.hiddenAction?.actionFamily || null,
      observedFailedActionFamily: fixture?.observedAtTrigger?.failedAction?.actionFamily || null,
    },
    evidence: {
      topAction: top
        ? {
            actionId: top.actionId,
            moveFamily: top.moveFamily,
            meanReward: top.meanReward,
            meanDDelta: top.meanDDelta,
            releaseOnScheduleRate: top.releaseOnScheduleRate,
            aporiaRate: top.aporiaRate,
            nonLeakPassRate: top.nonLeakPassRate,
            generatorComplianceRate: top.generatorComplianceRate,
          }
        : null,
      diagnosticComparator: diagnostic
        ? {
            actionId: diagnostic.actionId,
            meanReward: diagnostic.meanReward,
            aporiaRate: diagnostic.aporiaRate,
            delayedReleaseRate: diagnostic.delayedReleaseRate,
          }
        : null,
      repairComparator: repair
        ? {
            actionId: repair.actionId,
            meanReward: repair.meanReward,
            delayedReleaseRate: repair.delayedReleaseRate,
            targetDependencyOwnedRate: repair.targetDependencyOwnedRate,
          }
        : null,
      consolidationComparator: consolidation
        ? {
            actionId: consolidation.actionId,
            meanReward: consolidation.meanReward,
            delayedReleaseRate: consolidation.delayedReleaseRate,
          }
        : null,
    },
    applies_when: {
      world_class: 'hethel_like_mirror_dead_predicate',
      worldId: fixture.worldId || null,
      triggerTurn: triggerTurn(fixture),
      triggerLabel: fixture?.trigger?.primaryLabel || null,
      secondaryLabels: [...(fixture?.trigger?.secondaryLabels || [])],
      visible_hidden_conflict:
        fixture?.observedAtTrigger?.failedAction?.conductReasonCode === 'visible_hidden_conflict',
      diagnostic_budget_exhausted: {
        diagnosticHistoryCountAtLeast: 2,
        repeatedWithoutNewEvidenceAtLeast: 1,
        actualCount: fixture?.publicLearnerState?.diagnosticHistory?.count ?? null,
        actualRepeatedWithoutNewEvidence:
          fixture?.publicLearnerState?.diagnosticHistory?.repeatedWithoutNewEvidence ?? null,
      },
      proofDebt_live: [target],
      current_release_target: target,
      release_authorized_now: releaseAuthorizedNow(fixture, target),
      learner_engagement_not_disengaged: fixture?.publicLearnerState?.engagement !== 'disengaged',
      evidence_not_yet_seen: { [target]: fixture?.publicLearnerState?.evidenceSeen?.[target] !== true },
      dependency_not_yet_owned: { [target]: fixture?.publicLearnerState?.dependencyOwned?.[target] !== true },
    },
    prefer: {
      actionId: 'B_RELEASE_P_POINT',
      moveFamily: 'release_next_evidence',
      release: [target],
      tutor_instruction:
        'Give the learner the next public piece and ask them to use that piece, rather than asking a further diagnostic about the already-discussed record.',
      rationale:
        'In the frozen Hethel trigger fixture, release reduces proof distance and avoids aporia, while the repeated diagnostic is locally compliant but progress-starving.',
    },
    block: [
      'repeated_ask_diagnostic_without_new_evidence',
      'consolidate_subproof_if_it_holds_current_authorized_release',
      'repair_dependency_if_it_restages_unseen_current_release_instead_of_releasing_it',
    ],
    diagnostic_budget: {
      maxVisibleHiddenConflictDiagnosticsBeforeRelease: 2,
      noFurtherDiagnosticWhenRepeatedWithoutNewEvidenceAtLeast: 1,
      resetOnlyAfterNewPublicEvidenceRelease: true,
    },
    release_conditions: {
      releaseOnlyPublicPremise: target,
      requireCurrentAuthorizedRelease: true,
      requireLearnerNotDisengaged: true,
      doNotSupplyHiddenRelationOrAnswer: true,
      doNotExposeDArithmetic: true,
    },
    non_leak_constraints: {
      forbiddenPhrases: forbiddenPhrases(fixture),
      tutorFacingFields: fixture?.nonLeakConstraints?.tutorFacingFields || [],
    },
    expected_transition: {
      [`evidenceSeen.${target}`]: true,
      [`transitionFlags.learnerCanUse${target === 'p_point' ? 'PPoint' : 'Target'}`]: true,
      [`dependencyOwned.${target}`]: 'not_required_same_turn',
      D: release?.meanDDelta < 0 ? 'decrease_by_at_least_1_in_local_fixture' : 'remain_solvable',
      engagement: 'remain_engaged_or_strained',
      releaseTiming: 'on_schedule',
    },
    known_failure_modes: [
      'released_evidence_not_taken_up_by_learner',
      'tutor_leaks_hidden_relation_or_answer_while_releasing_public_piece',
      'patch_fires_when_release_is_not_current_authorized',
      'patch_masks_a_needed_dependency_repair_in_a_non_hethel_world',
      'finite_state_simulator_overvalues_release_relative_to_real_dialogue',
      'hidden_proofDebt_baseline_already_solves_without_incremental_value',
    ],
    replay_gate: {
      phase: 9,
      requiredBeforeFreshPaidRun: true,
      candidateArms: {
        S0: 'hidden + proofDebt',
        S1: 'hidden + proofDebt + a21_hethel_release_after_diagnostic_budget',
      },
      pass_if: [
        'S1 matches or beats S0 on final grounding',
        'S1 final D is 0',
        'S1 does not fail by aporia or disengagement',
        'S1 improves the targeted local transition over the failed diagnostic action',
        'S1 does not leak',
        'S1 does not delay the required release relative to S0',
      ],
      kill_if: ['replay_final_D_gt_0', 'aporia_or_disengagement', 'leak', 'delayed_required_release'],
    },
    implementation_boundary: {
      generatedByScriptOnly: true,
      runtimeFlagAdded: false,
      selectorDefaultsChanged: false,
      conductPolicyChanged: false,
      freshPaidRunAuthorized: false,
    },
  };
}

export function buildA21ReplayConductTrigger(proposal, { turn = null } = {}) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error('a21.policyPatchProposal: proposal is required');
  }
  if (proposal.policy_patch_id !== 'a21_hethel_release_after_diagnostic_budget') {
    throw new Error(`a21.policyPatchProposal: unsupported patch ${JSON.stringify(proposal.policy_patch_id)}`);
  }
  if (
    proposal.status !== 'proposed_only' ||
    proposal.promoted !== false ||
    proposal.runtime_behavior_changed !== false
  ) {
    throw new Error('a21.policyPatchProposal: only proposed-only, non-promoted patches can be replayed');
  }
  const target = proposal.applies_when?.current_release_target || proposal.prefer?.release?.[0] || 'p_point';
  const triggerTurn = Number(turn ?? proposal.applies_when?.triggerTurn);
  if (!Number.isFinite(triggerTurn)) {
    throw new Error('a21.policyPatchProposal: replay trigger turn is required');
  }
  return {
    id: proposal.policy_patch_id,
    policyPatchId: proposal.policy_patch_id,
    a21PolicyPatch: true,
    triggerType: 'a21_release_after_diagnostic_budget',
    turn: triggerTurn,
    premiseId: target,
    targetPremise: target,
    releaseCandidate: target,
    hiddenCertifiedRelease: true,
    expectedMoveFamily: proposal.prefer?.moveFamily || 'release_next_evidence',
    blockedActions: [...(proposal.block || [])],
    localUptakeExpectation: 'learner uses the newly released public exhibit before another diagnostic loop',
    evidence: {
      releaseCandidate: target,
      intervention: {
        reason: proposal.prefer?.rationale || 'A21 proposed patch prefers release over repeated diagnostic',
      },
      a21: {
        fixtureHash: proposal.source?.fixtureHash || null,
        decisionCategory: proposal.source?.decisionCategory || null,
        bestMeanReward: proposal.source?.bestMeanReward ?? null,
      },
    },
  };
}

export function proposalKeepsRuntimeClosed(proposal) {
  return (
    proposal?.status === 'proposed_only' && proposal?.promoted === false && proposal?.runtime_behavior_changed === false
  );
}

export function cloneA21PolicyPatchProposal(proposal) {
  return clone(proposal);
}
