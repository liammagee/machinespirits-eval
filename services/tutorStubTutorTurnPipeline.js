import { createTutorStubTutorAttemptRuntime } from './tutorStubTutorAttemptRuntime.js';
import { createTutorStubTutorCommitteeRuntime } from './tutorStubTutorCommitteeRuntime.js';
import { createTutorStubTutorDeliveryRuntime } from './tutorStubTutorDeliveryRuntime.js';
import { createTutorStubTutorDraftAudit } from './tutorStubTutorDraftAudit.js';
import { createTutorStubTutorRepairRuntime } from './tutorStubTutorRepairRuntime.js';
import { createTutorStubTutorTerminalRuntime } from './tutorStubTutorTerminalRuntime.js';
import { createTutorStubTutorTurnPreparation } from './tutorStubTutorTurnPreparation.js';
import { TUTOR_STUB_AB_GENERIC_PLAN } from './tutorStubAbArms.js';

export { TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS } from './tutorStubTutorTurnPreparation.js';

export function createTutorStubTutorTurnPipeline(dependencies = {}) {
  // Opt-in experiment (2026-07-30): style guards fail open. When true,
  // actorial part/tactic misses are advisory for every draft, so the model's
  // own reply ships unless a content or safety guard rejects it. Leak,
  // release-delivery, progression, and closure guards keep their catalog
  // dispositions — the flag reaches only the two allowActorialAdvisory
  // decisions below. The CLI resolves it from TUTOR_STUB_STYLE_GUARDS_ADVISORY
  // (this service stays env-free). Motivated by gate-3 d1, where 26 of 40
  // turns shipped the deterministic fallback liturgy and the register-free
  // templates erased the character the guards were enforcing.
  const styleGuardsAdvisory = dependencies.styleGuardsAdvisory === true;
  // Guard boundary policy (catalog v6): 'strict' is the delivery contract;
  // 'shadow_advisory' demotes the progression/repetition families to recorded
  // advisories while leaks, releases, learner-misreads, and closure stay hard.
  // The CLI resolves TUTOR_STUB_GUARD_POLICY; this service stays env-free, and
  // every delivery decision records the policy it was made under.
  const guardBoundaryPolicy = dependencies.guardBoundaryPolicy === 'shadow_advisory' ? 'shadow_advisory' : 'strict';
  const {
    PROGRAM2_COMMITTEE_SCHEMA,
    appendTraceEvent,
    attachTutorGuardAccounting,
    auditTutorResponseLeak,
    auditTutorStubDialogueClosureResponse,
    auditTutorStubDramaticReleaseResponse,
    auditTutorStubGenerousInferenceResponse,
    auditTutorStubLiveSourceActionAlignmentV1,
    auditTutorStubLiveTurnProgressionV1,
    auditTutorStubPrompt,
    auditTutorStubQuestionSupportResponse,
    auditTutorStubReleaseDelivery,
    auditTutorStubRepetitionResponse,
    auditTutorStubResponseComposition,
    auditTutorStubResponseConfiguration,
    auditTutorStubSelfCorrectionDisclosure,
    auditTutorStubSpeakerPrivilege,
    buildCommitteeCompositionBlock,
    buildTutorGuardAccounting,
    buildTutorStubDramaticReleaseFrame,
    buildTutorStubFirstDraftContract,
    buildTutorStubResponseCompositionFrame,
    buildTutorStubSimplifiedRecoveryConfiguration,
    callAI,
    callAIWithCliBridge,
    classifierTutorContext,
    committedReleaseRows,
    committeeFallbackBatteryPass,
    committeeMiniGenerate,
    compileTutorStubPerformanceObligationContract,
    composeTutorStubFallbackWithUptake,
    composeTutorStubGuardUptakeDevelopment,
    createConsoleTokenSink,
    currentReleaseRows,
    dagTurnContext,
    detectTutorStubSelfCorrectionDisclosure,
    deterministicGenerousInferenceFallback,
    deterministicTutorStubClosureResponse,
    deterministicTutorStubConfiguredContinuationFallback,
    deterministicTutorStubContextualFallback,
    deterministicTutorStubDramaticReleaseFallback,
    deterministicTutorStubLearnerUptake,
    deterministicTutorStubTurnProgressionHandoff,
    deterministicTutorStubTurnProgressionUptake,
    deterministicTutorStubWritableEntryUptake,
    exactTutorRepairSpans,
    formatTutorStubResponseComposition,
    humanDiscourseTutorContext,
    isCliProvider,
    jsonClone,
    prepareTutorStubDueClueUptake,
    providerSupportsStreaming,
    reconcileTutorStubPointOfActionHandoffEligibility,
    recoverTutorStubDuplicateInstructionLines,
    recoverTutorStubSpeakerPrompt,
    repairTutorStubMissingActorialPart,
    repairTutorStubMissingClarificationInvitation,
    repairTutorStubThirdPersonSourceLeadIn,
    repairTutorStubUnanswerableOpenRecall,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    resolveTutorStubPublicCounterpressure,
    runCommitteeBattery,
    sanitizeTutorStubSpeakerAdvisory,
    selectCommitteeCompositionQuestion,
    // Which measured advisory blocks reach the speaking prompt (a Set of ids
    // from the A/B feature registry), or null for all. The caller resolves the
    // env override; the pipeline only honours it, in both the normal assembly
    // and the privilege-recovery rebuild below.
    speakerAdvisoryBlocks = null,
    snapshotTutorStubPublicPremiseIds,
    stateRunDebugId,
    streamAI,
    trimCommitteeFallback,
    tutorCoachGuidanceContext,
    tutorGuardAttemptEnvelope,
    tutorLearnerDagModelContext,
    tutorMessageContext,
    tutorResponseRecoveryPrompt,
    tutorStubActorialPerformanceMayBeAdvisory,
    tutorStubComprehensionPrompt,
    tutorStubDirectorGuidancePrompt,
    tutorStubDisclosableGuardCorrection,
    tutorStubFirstDraftContractPrompt,
    tutorStubGuardDeliveryDecision,
    tutorStubGuardIssueRows,
    tutorStubLearnerRequestedPlainStyle,
    tutorStubLearnerSelectedToolMarkPath,
    tutorStubLiveResponseConfigurationSurface,
    tutorStubPlainRecoveryAllowsActorialAdvisory,
    tutorStubPointOfActionPrompt,
    tutorStubPointOfActionTargetText,
    tutorStubSelfCorrectionDisclosurePrompt,
    tutorStubSimplifiedRecoveryPrompt,
    tutorStubSubstantiveLearnerEcho,
    tutorStubTerminalFallbackFailureMessage,
    tutorStubTuningTurnAdvisory,
    tutorStubTurnFeedbackPrompt,
    worldLedgerTerm,
  } = dependencies;

  const bindTutorAttemptRuntime = createTutorStubTutorAttemptRuntime({
    appendTraceEvent,
    auditTutorStubPrompt,
    auditTutorStubSpeakerPrivilege,
    callAI,
    callAIWithCliBridge,
    createConsoleTokenSink,
    isCliProvider,
    jsonClone,
    recoverTutorStubDuplicateInstructionLines,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    streamAI,
  });
  const bindTutorCommitteeRuntime = createTutorStubTutorCommitteeRuntime({
    PROGRAM2_COMMITTEE_SCHEMA,
    appendTraceEvent,
    buildCommitteeCompositionBlock,
    committeeFallbackBatteryPass,
    committeeMiniGenerate,
    jsonClone,
    reserveTutorStubMeteredModelCall,
    runCommitteeBattery,
    selectCommitteeCompositionQuestion,
    trimCommitteeFallback,
    tutorStubPointOfActionTargetText,
  });
  const bindTutorDeliveryRuntime = createTutorStubTutorDeliveryRuntime({
    appendTraceEvent,
    auditTutorResponseLeak,
    auditTutorStubDramaticReleaseResponse,
    auditTutorStubReleaseDelivery,
    auditTutorStubRepetitionResponse,
    auditTutorStubResponseComposition,
    composeTutorStubFallbackWithUptake,
    corruptReliefTurn: dependencies.corruptReliefTurn,
    formatTutorStubResponseComposition,
    tutorStubGuardDeliveryDecision,
    tutorStubGuardIssueRows,
  });
  const runTutorRepairLadder = createTutorStubTutorRepairRuntime({
    appendTraceEvent,
    attachTutorGuardAccounting,
    auditTutorStubSelfCorrectionDisclosure,
    buildTutorStubSimplifiedRecoveryConfiguration,
    composeTutorStubGuardUptakeDevelopment,
    dagTurnContext,
    detectTutorStubSelfCorrectionDisclosure,
    deterministicTutorStubLearnerUptake,
    deterministicTutorStubTurnProgressionUptake,
    exactTutorRepairSpans,
    repairTutorStubMissingActorialPart,
    repairTutorStubMissingClarificationInvitation,
    repairTutorStubThirdPersonSourceLeadIn,
    repairTutorStubUnanswerableOpenRecall,
    sanitizeTutorStubSpeakerAdvisory,
    stateRunDebugId,
    styleGuardsAdvisory,
    tutorGuardAttemptEnvelope,
    tutorResponseRecoveryPrompt,
    tutorStubDisclosableGuardCorrection,
    tutorStubGuardIssueRows,
    tutorStubPlainRecoveryAllowsActorialAdvisory,
    tutorStubSelfCorrectionDisclosurePrompt,
    tutorStubSimplifiedRecoveryPrompt,
    tutorStubSubstantiveLearnerEcho,
  });
  const runTutorTerminalDelivery = createTutorStubTutorTerminalRuntime({
    appendTraceEvent,
    attachTutorGuardAccounting,
    auditTutorStubDialogueClosureResponse,
    auditTutorStubQuestionSupportResponse,
    buildTutorGuardAccounting,
    clueInsertion: dependencies.clueInsertion,
    composeClueSpanReplacement: dependencies.composeClueSpanReplacement,
    currentReleaseRows,
    deterministicGenerousInferenceFallback,
    deterministicTutorStubClosureResponse,
    deterministicTutorStubConfiguredContinuationFallback,
    deterministicTutorStubContextualFallback,
    deterministicTutorStubDramaticReleaseFallback,
    deterministicTutorStubLearnerUptake,
    deterministicTutorStubTurnProgressionHandoff,
    deterministicTutorStubTurnProgressionUptake,
    deterministicTutorStubWritableEntryUptake,
    exactTutorRepairSpans,
    prepareTutorStubDueClueUptake,
    renderTutorStubDueSource: dependencies.renderTutorStubDueSource,
    stateRunDebugId,
    tutorGuardAttemptEnvelope,
    tutorStubActorialPerformanceMayBeAdvisory,
    tutorStubGuardIssueRows,
    tutorStubLearnerSelectedToolMarkPath,
    tutorStubSubstantiveLearnerEcho,
    tutorStubTerminalFallbackFailureMessage,
    worldLedgerTerm,
  });
  const prepareTutorTurn = createTutorStubTutorTurnPreparation({
    appendTraceEvent,
    auditTutorStubSpeakerPrivilege,
    buildTutorStubDramaticReleaseFrame,
    buildTutorStubFirstDraftContract,
    buildTutorStubResponseCompositionFrame,
    classifierTutorContext,
    committedReleaseRows,
    compileTutorStubPerformanceObligationContract,
    currentReleaseRows,
    dagTurnContext,
    emptyPlanAdvisory: TUTOR_STUB_AB_GENERIC_PLAN,
    humanDiscourseTutorContext,
    reconcileTutorStubPointOfActionHandoffEligibility,
    recoverTutorStubSpeakerPrompt,
    resolveTutorStubPublicCounterpressure,
    sanitizeTutorStubSpeakerAdvisory,
    snapshotTutorStubPublicPremiseIds,
    tutorCoachGuidanceContext,
    tutorLearnerDagModelContext,
    tutorMessageContext,
    tutorStubComprehensionPrompt,
    tutorStubDirectorGuidancePrompt,
    tutorStubFirstDraftContractPrompt,
    tutorStubPointOfActionPrompt,
    tutorStubTuningTurnAdvisory,
    tutorStubTurnFeedbackPrompt,
  });
  const bindTutorDraftAudit = createTutorStubTutorDraftAudit({
    appendTraceEvent,
    auditTutorResponseLeak,
    auditTutorStubDialogueClosureResponse,
    auditTutorStubDramaticReleaseResponse,
    auditTutorStubGenerousInferenceResponse,
    auditTutorStubLiveSourceActionAlignmentV1,
    auditTutorStubLiveTurnProgressionV1,
    auditTutorStubQuestionSupportResponse,
    auditTutorStubReleaseDelivery,
    auditTutorStubRepetitionResponse,
    auditTutorStubResponseComposition,
    auditTutorStubResponseConfiguration,
    formatTutorStubResponseComposition,
    jsonClone,
    tutorStubLiveResponseConfigurationSurface,
  });

  return async function callTutor({
    learnerText,
    history,
    state = null,
    systemPrompt,
    resolved,
    temperature,
    maxTokens,
    historyTurns,
    world,
    dag,
    classification,
    tutorLearnerDagModel,
    registerSelection,
    humanDiscourseFrame = null,
    dialogueClosureFrame = null,
    trace = null,
    stream = null,
    cliEffort = null,
    roleBase = 'tutor_stub_tutor',
    learnerMessages = null,
    tutorFeedback = null,
    feedbackAdaptationPlan = null,
    deferStreamOutput = false,
    passthrough = false,
    signal = null,
  }) {
    const {
      coachAdvisory,
      comprehensionAdvisory,
      context,
      directorGuidanceAdvisory,
      dramaticReleaseFrame,
      effectiveSpeakerInstructionTexts,
      effectiveSpeakerSystemPrompt,
      effectiveSpeakerUserPrompt,
      firstDraftHumanDiscourseAdvisory,
      firstDraftContract,
      instructionalMetaRepair,
      instructionalMetaRestatementAdvisory,
      learnerPrompt,
      messageContext,
      performanceObligationContract,
      recentTutorTexts,
      responseCompositionFrame,
      responseConfiguration,
      speakerPrivilegeAudit,
      speakerPublicPremiseIds,
      speakingResponseConfiguration,
      tutorFeedbackAdvisory,
      tutorTurn,
    } = prepareTutorTurn({
      cardAfterLearner: dependencies.cardAfterLearner,
      cardFinalSlot: dependencies.cardFinalSlot,
      classification,
      dag,
      dialogueClosureFrame,
      feedbackAdaptationPlan,
      history,
      humanDiscourseFrame,
      learnerMessages,
      learnerText,
      passthrough,
      registerSelection,
      speakerAdvisoryBlocks,
      state,
      systemPrompt,
      trace,
      tutorFeedback,
      tutorLearnerDagModel,
      world,
    });
    const leakGuardEnabled = Boolean(!passthrough && dag && world);
    const scaffoldGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.generousInference?.applied);
    const questionSupportGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.questionSupport?.guardRequired);
    const dramaticReleaseGuardEnabled = Boolean(!passthrough && dramaticReleaseFrame.active);
    const actorialRealizationGuardEnabled = Boolean(
      !passthrough && responseConfiguration?.actorial_part && responseConfiguration?.actorial_performance,
    );
    const responseCompositionGuardEnabled = Boolean(!passthrough && responseCompositionFrame.active);
    const repetitionGuardEnabled = Boolean(!passthrough && recentTutorTexts.length > 0);
    const closureGuardEnabled = Boolean(
      dialogueClosureFrame?.enabled && (dialogueClosureFrame.mandatory || dialogueClosureFrame.available),
    );
    const responseGuardEnabled =
      leakGuardEnabled ||
      scaffoldGuardEnabled ||
      questionSupportGuardEnabled ||
      dramaticReleaseGuardEnabled ||
      actorialRealizationGuardEnabled ||
      responseCompositionGuardEnabled ||
      repetitionGuardEnabled ||
      closureGuardEnabled;
    const guards = {
      enabled: responseGuardEnabled,
      leak: leakGuardEnabled,
      humanScaffold: scaffoldGuardEnabled,
      questionSupport: questionSupportGuardEnabled,
      dramaticRelease: dramaticReleaseGuardEnabled,
      actorialRealization: actorialRealizationGuardEnabled,
      responseComposition: responseCompositionGuardEnabled,
      repetition: repetitionGuardEnabled,
      dialogueClosure: closureGuardEnabled,
    };
    const canStreamTutor = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
    const tutorStreamMode = canStreamTutor ? (responseGuardEnabled || deferStreamOutput ? 'buffered' : 'live') : 'none';
    const { invokeTutorAttempt, nextTutorGuardCallId } = bindTutorAttemptRuntime({
      actorialRealizationGuardEnabled,
      cliEffort,
      closureGuardEnabled,
      dag,
      effectiveSpeakerInstructionTexts,
      effectiveSpeakerSystemPrompt,
      firstDraftContract,
      historyTurns,
      leakGuardEnabled,
      maxTokens,
      messageContext,
      messages: context,
      passthrough,
      questionSupportGuardEnabled,
      repetitionGuardEnabled,
      resolved,
      responseCompositionGuardEnabled,
      scaffoldGuardEnabled,
      signal,
      speakerPrivilegeAudit,
      stream,
      systemPrompt,
      temperature,
      trace,
      tutorTurn,
      world,
    });
    const { invokeCommitteeFirstDraft } = bindTutorCommitteeRuntime({
      context,
      effectiveSpeakerInstructionTexts,
      effectiveSpeakerSystemPrompt,
      effectiveSpeakerUserPrompt,
      firstDraftContract,
      invokeTutorAttempt,
      maxTokens,
      nextTutorGuardCallId,
      roleBase,
      speakerPrivilegeAudit,
      state,
      trace,
      tutorStreamMode,
      tutorTurn,
    });

    const { auditTutorDraft } = bindTutorDraftAudit({
      actorialRealizationGuardEnabled,
      closureGuardEnabled,
      dialogueClosureFrame,
      dramaticReleaseFrame,
      dramaticReleaseGuardEnabled,
      firstDraftContract,
      humanDiscourseFrame,
      leakGuardEnabled,
      learnerText,
      performanceObligationContract,
      questionSupportGuardEnabled,
      recentTutorTexts,
      repetitionGuardEnabled,
      responseCompositionFrame,
      responseCompositionGuardEnabled,
      responseConfiguration,
      scaffoldGuardEnabled,
      speakerPublicPremiseIds,
      speakingResponseConfiguration,
      state,
      trace,
      tutorTurn,
      world,
    });
    const {
      attachTutorDraftAudits,
      ensureFallbackComposition,
      preservableTutorUptake,
      tutorResponseFromSimplifiedRecovery,
      withTutorDeliveryDecision,
    } = bindTutorDeliveryRuntime({
      boundaryPolicy: guardBoundaryPolicy,
      dramaticReleaseFrame,
      firstDraftContract,
      leakGuardEnabled,
      learnerText,
      recentTutorTexts,
      responseCompositionFrame,
      speakerPublicPremiseIds,
      state,
      trace,
      tutorTurn,
      world,
    });

    if (firstDraftContract) {
      appendTraceEvent(trace, {
        type: 'tutor_first_draft_contract',
        turn: tutorTurn,
        contract: firstDraftContract,
        publicTranscriptChanged: false,
      });
    }

    try {
      const attempts = [];
      const repairsApplied = [];
      const committeeMomentActive = Boolean(
        !passthrough && state?.committee?.enabled && state?.pointOfAction?.current?.assigned_trigger === 'warrant_skip',
      );
      let response = committeeMomentActive
        ? await invokeCommitteeFirstDraft()
        : await invokeTutorAttempt({
            attemptUserPrompt: effectiveSpeakerUserPrompt,
            role: roleBase,
            streamMode: tutorStreamMode,
            repairAttempt: 0,
          });

      if (passthrough) {
        response.passthrough = true;
        return response;
      }
      if (!responseGuardEnabled) {
        attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response }));
        return attachTutorGuardAccounting({
          response,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'original_candidate',
          outcome: 'unguarded_original',
        });
      }

      const learnerRequestedPlainStyle = tutorStubLearnerRequestedPlainStyle(learnerText, classification);
      const originalDraftAudits = auditTutorDraft(response, { role: roleBase, attempt: 0 });
      let audits = withTutorDeliveryDecision(originalDraftAudits, {
        allowActorialAdvisory:
          styleGuardsAdvisory ||
          learnerRequestedPlainStyle ||
          tutorStubActorialPerformanceMayBeAdvisory(
            originalDraftAudits.actorialRealizationAudit,
            originalDraftAudits.responseConfigurationAudit,
          ),
        advisoryReason: styleGuardsAdvisory
          ? 'style-guards-advisory experiment: actorial misses recorded, never vetoing delivery'
          : learnerRequestedPlainStyle
            ? 'explicit learner style request outranks optional actorial realization'
            : 'the selected host part and every hard response check are visible; only the optional performance tactic remains below the deterministic threshold',
        role: roleBase,
        attempt: 0,
      });
      attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response, audits }));
      if (audits.deliveryOk) {
        attachTutorDraftAudits(response, audits);
        if (response.bufferedStream) {
          response.guardedStreamReplay = true;
        }
        return attachTutorGuardAccounting({
          response,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'original_candidate',
          finalAudits: audits,
          outcome: audits.ok ? 'guarded_original_accepted' : 'guarded_original_accepted_with_advisory',
        });
      }

      const repairResult = await runTutorRepairLadder({
        response,
        audits,
        attempts,
        repairsApplied,
        auditTutorDraft,
        attachTutorDraftAudits,
        withTutorDeliveryDecision,
        preservableTutorUptake,
        tutorResponseFromSimplifiedRecovery,
        invokeTutorAttempt,
        roleBase,
        state,
        trace,
        tutorTurn,
        guards,
        canStreamTutor,
        learnerText,
        learnerRequestedPlainStyle,
        classification,
        responseCompositionFrame,
        recentTutorTexts,
        world,
        speakingResponseConfiguration,
        firstDraftContract,
        dialogueClosureFrame,
        dag,
        instructionalMetaRepair,
        tutorLearnerDagModel,
        firstDraftHumanDiscourseAdvisory,
        instructionalMetaRestatementAdvisory,
        comprehensionAdvisory,
        directorGuidanceAdvisory,
        coachAdvisory,
        tutorFeedbackAdvisory,
        learnerPrompt,
        systemPrompt,
        dramaticReleaseFrame,
      });
      if (repairResult.accepted) {
        return repairResult.response;
      }
      response = repairResult.response;
      audits = repairResult.audits;
      const { firstRepairUptake, simplifiedRecoveryConfiguration } = repairResult;

      return runTutorTerminalDelivery({
        response,
        audits,
        attempts,
        repairsApplied,
        firstRepairUptake,
        simplifiedRecoveryConfiguration,
        auditTutorDraft,
        attachTutorDraftAudits,
        withTutorDeliveryDecision,
        preservableTutorUptake,
        ensureFallbackComposition,
        roleBase,
        state,
        trace,
        tutorTurn,
        guards,
        canStreamTutor,
        dramaticReleaseFrame,
        closureGuardEnabled,
        dialogueClosureFrame,
        humanDiscourseFrame,
        world,
        learnerText,
        recentTutorTexts,
        firstDraftContract,
        classification,
        responseCompositionFrame,
        questionSupportGuardEnabled,
        actorialRealizationGuardEnabled,
        instructionalMetaRepair,
        dramaticReleaseGuardEnabled,
        scaffoldGuardEnabled,
        resolved,
        cliEffort,
      });
    } catch (err) {
      appendTraceEvent(trace, {
        type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
        role: roleBase,
        turn: tutorTurn,
        provider: resolved.provider,
        model: resolved.model,
        error: err.message,
        ...(err?.tutorFallbackFailure ? { terminalFailure: err.tutorFallbackFailure } : {}),
      });
      throw err;
    }
  };
}
