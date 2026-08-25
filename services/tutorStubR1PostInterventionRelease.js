// The registered R1 instruments fix the frame-refuser voice at the trigger,
// then expressly permit their registered epistemic paths after the tutor's
// bounded test. Reapplying the legacy adherence gate after that intervention
// would pin every valid learner draw back to refusal and make either ladder
// structurally impossible, so the post-intervention turn is released instead.
//
// Registered bridge-step enforcement (merged design revision 3+): on the
// first post-trigger turn where the typed concession condition is MET, the
// released draft must still take the one bounded bridge step. One semantic
// adjudication, at most one repair, then a typed learner_noncompliance
// failure — never a silent rung-0. Scope is one episode per dialogue, so the
// window-max endpoint stays the learner's, not the harness's.
import { latestTutorStubMessage } from './tutorStubPublicHistory.js';
import { evaluateTutorStubRivalDagConcession } from './tutorStubRivalLearnerDag.js';
import { assertTutorStubTurnAttemptCurrent } from './tutorStubTurnAttempt.js';

export async function applyTutorStubR1PostInterventionRelease({
  state,
  resolved,
  profile,
  profileId,
  turnNumber,
  generated,
  precomputeFinalLearnerAnalysis,
  canPreclassify,
  adjudicateRivalDagBridgeStep,
  appendTraceEvent,
  generateAutomatedLearnerTurn,
  extractCombinedLearnerAnalysis,
  cliEffort = null,
  signal = null,
  isCurrent = null,
}) {
  let candidate = generated;
  let bridgeRepairs = 0;
  const bridgeEnforcement = state.resistanceActionRegisterStudy?.design?.rivalDagPersona?.concessionEnforcement || null;
  if (
    bridgeEnforcement?.check?.kind === 'semantic_bridge_step_adjudication' &&
    state.privateRivalLearnerDag &&
    state.rivalDagBridgeEnforcement?.consumed !== true &&
    candidate.text
  ) {
    if (typeof adjudicateRivalDagBridgeStep !== 'function') {
      throw new Error('registered bridge-step enforcement requires the semantic bridge-step adjudicator');
    }
    const concession = evaluateTutorStubRivalDagConcession({
      dag: state.privateRivalLearnerDag,
      history: state.history,
    });
    if (concession.eligible) {
      const node =
        state.privateRivalLearnerDag.openNodes.find((entry) => entry.id === concession.qualifyingNodeId) || null;
      const latestTutorText = latestTutorStubMessage(state);
      const maxBridgeRepairs = Number(bridgeEnforcement.repairsAllowedPerEpisode) || 0;
      let verdict = await adjudicateRivalDagBridgeStep({
        state,
        learnerText: candidate.text,
        turnNumber,
        nodeText: node?.task || '',
        latestTutorText,
        candidateKind: 'initial',
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      while (!verdict.taken && bridgeRepairs < maxBridgeRepairs) {
        appendTraceEvent(state.trace, {
          type: 'rival_dag_bridge_step_repair_requested',
          turn: turnNumber,
          attempt: bridgeRepairs + 1,
          nodeId: concession.qualifyingNodeId,
          draft: candidate.text,
        });
        const repaired = await generateAutomatedLearnerTurn({
          state,
          resolved,
          profile,
          turnNumber,
          adherenceFeedback: bridgeEnforcement.repairInstruction,
          stream: { enabled: false, interim: state.interim },
          cliEffort,
          signal,
        });
        assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
        if (repaired.text) candidate = repaired;
        bridgeRepairs += 1;
        verdict = await adjudicateRivalDagBridgeStep({
          state,
          learnerText: candidate.text,
          turnNumber,
          nodeText: node?.task || '',
          latestTutorText,
          candidateKind: `learner-repair-${bridgeRepairs}`,
          signal,
        });
        assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      }
      state.rivalDagBridgeEnforcement = {
        consumed: true,
        turn: turnNumber,
        taken: verdict.taken,
        nodeId: concession.qualifyingNodeId,
        repairAttempts: bridgeRepairs,
      };
      appendTraceEvent(state.trace, {
        type: 'rival_dag_bridge_step_enforcement',
        turn: turnNumber,
        nodeId: concession.qualifyingNodeId,
        scope: bridgeEnforcement.scope,
        taken: verdict.taken,
        quote: verdict.quote || null,
        repairAttempts: bridgeRepairs,
      });
      if (!verdict.taken) {
        appendTraceEvent(state.trace, {
          type: 'rival_dag_bridge_step_noncompliance_exhausted',
          turn: turnNumber,
          nodeId: concession.qualifyingNodeId,
          repairAttempts: bridgeRepairs,
          disposition: bridgeEnforcement.exhaustionDisposition,
        });
        const error = new Error(
          'registered face-B learner simulator refused the bounded bridge step after the allowed repair',
        );
        error.code = 'tutor_stub_learner_noncompliance';
        error.disposition = bridgeEnforcement.exhaustionDisposition;
        error.substantiveStudyFailure = true;
        error.recoverable = false;
        error.neverScoredAsRung0 = true;
        throw error;
      }
    }
  }
  const precomputedRaw =
    precomputeFinalLearnerAnalysis && canPreclassify && candidate.text
      ? await extractCombinedLearnerAnalysis({
          learnerText: candidate.text,
          state,
          tutorTurn: turnNumber,
          preflightSource: 'registered_final_learner_outcome',
          signal,
        })
      : null;
  if (precomputedRaw) assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  appendTraceEvent(state.trace, {
    type: 'auto_learner_profile_adherence_released_after_registered_intervention',
    turn: turnNumber,
    profile: profileId,
    personaContract: state.resistanceActionRegisterStudy?.design?.population?.profile || 'frame_refuser-r1-v1',
    voiceConstraintsRemainInPrompt: true,
    epistemicMovementReleased: true,
  });
  return { generated: candidate, precomputedRaw, repaired: bridgeRepairs > 0, passed: null };
}
