import { createTutorStubTutorAttemptRuntime } from './tutorStubTutorAttemptRuntime.js';
import { createTutorStubTutorCommitteeRuntime } from './tutorStubTutorCommitteeRuntime.js';
import { createTutorStubTutorDeliveryRuntime } from './tutorStubTutorDeliveryRuntime.js';
import { createTutorStubTutorDraftAudit } from './tutorStubTutorDraftAudit.js';
import { createTutorStubTutorTurnPreparation } from './tutorStubTutorTurnPreparation.js';

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

      const hostPartRepair = repairTutorStubMissingActorialPart({
        text: response.text,
        deliveryDecision: audits.deliveryDecision,
        responseConfiguration: speakingResponseConfiguration,
        responseComposition: audits.responseCompositionAudit?.segments,
      });
      if (hostPartRepair.changed) {
        const hostPartResponse = {
          ...response,
          text: hostPartRepair.text,
        };
        const hostPartAttempt = attempts.length;
        const hostPartAudits = withTutorDeliveryDecision(
          auditTutorDraft(hostPartResponse, {
            role: `${roleBase}_actorial_part_repair`,
            attempt: hostPartAttempt,
          }),
          { role: `${roleBase}_actorial_part_repair`, attempt: hostPartAttempt },
        );
        const hostPartRepairSpans = exactTutorRepairSpans(response.text, hostPartResponse.text);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'actorial_part_repair_candidate',
            attempt: hostPartAttempt,
            response: hostPartResponse,
            audits: hostPartAudits,
            repairedSpans: hostPartRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'mechanical_actorial_part_repair',
          fromAttempt: 0,
          toAttempt: hostPartAttempt,
          triggeredBy: tutorStubGuardIssueRows(audits),
          guardedSpans: attempts[0].guardedSpans,
          repairedSpans: hostPartRepairSpans,
          cue: hostPartRepair.cue,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_mechanical_repair',
          role: `${roleBase}_actorial_part_repair`,
          turn: tutorTurn,
          attempt: hostPartAttempt,
          repairKind: 'missing_actorial_host_part',
          accepted: hostPartAudits.deliveryOk,
          cue: hostPartRepair.cue,
          text: hostPartRepair.text,
        });
        if (hostPartAudits.deliveryOk) {
          attachTutorDraftAudits(hostPartResponse, hostPartAudits);
          hostPartResponse.repaired = true;
          hostPartResponse.mechanicalRepair = true;
          if (hostPartResponse.bufferedStream) hostPartResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: hostPartResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'actorial_part_repair_candidate',
            finalAudits: hostPartAudits,
            outcome: 'guarded_actorial_part_repair_accepted',
          });
        }
      }

      const firstRepairTriggers = tutorStubGuardIssueRows(audits);
      const firstPreservedUptake = preservableTutorUptake(audits);
      const firstRepairUptake =
        firstPreservedUptake ||
        deterministicTutorStubTurnProgressionUptake({
          contract: firstDraftContract?.progression || null,
          recentTutorTexts,
          variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
          learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
          defaultUptake: deterministicTutorStubLearnerUptake({
            learnerText,
            classification,
            actionFamily: responseCompositionFrame.selected_action_family || null,
            recentTutorTexts,
            world,
          }),
        });
      // Keep recovery materially smaller than the normal speaking prompt while
      // sanitizing every retained contract at the current release boundary.
      // The former raw reconstruction leaked private IDs/future facts; reusing
      // every safe speaking advisory avoided that leak but made late-turn repair
      // calls unnecessarily large and prone to CLI timeouts.
      const simplifiedRecoveryConfiguration = buildTutorStubSimplifiedRecoveryConfiguration(
        speakingResponseConfiguration,
        { closureRequired: dialogueClosureFrame?.mandatory === true },
      );
      const minimalRecoveryPrompt = tutorStubSimplifiedRecoveryPrompt({
        configuration: simplifiedRecoveryConfiguration,
        firstDraftContract,
      });
      const publicRecoveryMachinePacket = [
        dag && world && !instructionalMetaRepair ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
        firstDraftHumanDiscourseAdvisory,
        instructionalMetaRestatementAdvisory,
        comprehensionAdvisory,
        directorGuidanceAdvisory,
        coachAdvisory,
        tutorFeedbackAdvisory,
        // The manner card is the turn's conduct instruction; the retry that
        // repairs wording must not silently change conduct at the pressured
        // turns that collide with deliveries (observed: every t2 demand).
        state?.mannerSwitch?.card || null,
      ]
        .filter(Boolean)
        .map((text) =>
          sanitizeTutorStubSpeakerAdvisory({
            world: dag ? world : null,
            tutorTurn,
            text,
          }),
        )
        .filter(Boolean);
      const publicRecoveryPacket = [...publicRecoveryMachinePacket, learnerPrompt];
      const recoveryPrompt = tutorResponseRecoveryPrompt({
        publicPacket: publicRecoveryPacket,
        hardIssues: audits.deliveryDecision?.hardIssues || [],
        leakAudit: audits.leakAudit,
        scaffoldAudit: audits.scaffoldAudit,
        questionSupportAudit: audits.questionSupportAudit,
        dramaticReleaseAudit: audits.dramaticReleaseAudit,
        actorialRealizationAudit: audits.actorialRealizationAudit,
        responseConfigurationAudit: audits.responseConfigurationAudit,
        responseConfiguration: simplifiedRecoveryConfiguration,
        responseCompositionAudit: audits.responseCompositionAudit,
        liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
        liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
        repetitionAudit: audits.repetitionAudit,
        closureAudit: audits.closureAudit,
        dialogueClosureFrame,
        minimalRecoveryPrompt,
      });
      const recoveryControlPrompt = tutorResponseRecoveryPrompt({
        publicPacket: [],
        hardIssues: audits.deliveryDecision?.hardIssues || [],
        leakAudit: audits.leakAudit,
        scaffoldAudit: audits.scaffoldAudit,
        questionSupportAudit: audits.questionSupportAudit,
        dramaticReleaseAudit: audits.dramaticReleaseAudit,
        actorialRealizationAudit: audits.actorialRealizationAudit,
        responseConfigurationAudit: audits.responseConfigurationAudit,
        responseConfiguration: simplifiedRecoveryConfiguration,
        responseCompositionAudit: audits.responseCompositionAudit,
        liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
        liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
        repetitionAudit: audits.repetitionAudit,
        closureAudit: audits.closureAudit,
        dialogueClosureFrame,
        minimalRecoveryPrompt,
      });
      const recoveryPrivilegeAdvisory = [recoveryControlPrompt, ...publicRecoveryMachinePacket]
        .filter(Boolean)
        .join('\n\n');
      const simplifiedRecoveryResponse = await invokeTutorAttempt({
        attemptUserPrompt: recoveryPrompt,
        role: `${roleBase}_recovery`,
        streamMode: canStreamTutor ? 'buffered' : 'none',
        repairAttempt: 1,
        systemPromptOverride: systemPrompt,
        instructionTextsOverride: [systemPrompt, ...publicRecoveryMachinePacket],
        privilegeAdvisoryOverride: recoveryPrivilegeAdvisory,
      });
      const recoveryCandidate = {
        schema: 'machinespirits.tutor-stub.guard-recovery.v1',
        ok: Boolean(String(simplifiedRecoveryResponse.text || '').trim()),
        parseMode: 'single_plain_text',
        text: String(simplifiedRecoveryResponse.text || '').trim(),
        error: String(simplifiedRecoveryResponse.text || '').trim() ? null : 'empty simplified recovery candidate',
      };
      appendTraceEvent(trace, {
        type: 'tutor_response_recovery_candidate',
        role: `${roleBase}_recovery`,
        turn: tutorTurn,
        modelCallCount: 1,
        parse: {
          schema: recoveryCandidate.schema,
          ok: recoveryCandidate.ok,
          mode: recoveryCandidate.parseMode,
          error: recoveryCandidate.error,
        },
        recoveryTransition: simplifiedRecoveryConfiguration.recovery_transition,
        failedHardChecks: audits.deliveryDecision?.hardIssues || [],
        candidate: { kind: 'plain_recovery_candidate', text: recoveryCandidate.text },
      });

      response = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        recoveryCandidate.text,
        'plain_recovery_candidate',
      );
      const plainRecoveryDraftAudits = auditTutorDraft(response, {
        role: `${roleBase}_plain_recovery`,
        attempt: 1,
        auditConfiguration: simplifiedRecoveryConfiguration,
      });
      audits = withTutorDeliveryDecision(plainRecoveryDraftAudits, {
        allowActorialAdvisory:
          styleGuardsAdvisory ||
          tutorStubPlainRecoveryAllowsActorialAdvisory({
            loopMode: state?.loopMode,
            learnerRequestedPlainStyle,
          }),
        advisoryReason: styleGuardsAdvisory
          ? 'style-guards-advisory experiment: actorial misses recorded, never vetoing delivery'
          : learnerRequestedPlainStyle
            ? 'explicit learner style request outranks optional actorial realization'
            : 'diagnostic collection preserves a safe plain recovery while recording optional actorial misses',
        role: `${roleBase}_plain_recovery`,
        attempt: 1,
      });
      const plainRecoveryResponse = response;
      const plainRecoveryAudits = audits;
      const modelRepairSpans = exactTutorRepairSpans(attempts[0].candidate.text, response.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'plain_recovery_candidate',
          attempt: 1,
          response,
          audits,
          repairedSpans: modelRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'model_plain_recovery',
        fromAttempt: 0,
        toAttempt: 1,
        triggeredBy: firstRepairTriggers,
        guardedSpans: attempts[0].guardedSpans,
        repairedSpans: modelRepairSpans,
        generatedInSameModelCall: false,
        recoveryTransition: simplifiedRecoveryConfiguration.recovery_transition,
      });
      if (audits.deliveryOk) {
        attachTutorDraftAudits(response, audits);
        response.repaired = true;
        response.plainRecovery = true;
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
          finalSource: 'plain_recovery_candidate',
          finalAudits: audits,
          outcome: 'guarded_plain_recovery_accepted',
        });
      }

      const recoveryCompositionIssues = (plainRecoveryAudits?.responseCompositionAudit?.issues || []).filter((issue) =>
        ['missing_learner_uptake', 'generic_learner_uptake', 'learner_selected_test_not_acknowledged'].includes(
          issue.type,
        ),
      );
      const recoveryDevelopment = String(
        plainRecoveryAudits?.responseCompositionAudit?.segments?.development || '',
      ).trim();
      if (firstRepairUptake && recoveryCompositionIssues.length && recoveryDevelopment) {
        const compositionRepairAttempt = attempts.length;
        const compositionRepairText = composeTutorStubGuardUptakeDevelopment({
          uptake: firstRepairUptake,
          development: recoveryDevelopment,
        });
        const compositionResponse = tutorResponseFromSimplifiedRecovery(
          simplifiedRecoveryResponse,
          compositionRepairText,
          'composition_repair_candidate',
        );
        const compositionDraftAudits = auditTutorDraft(compositionResponse, {
          role: `${roleBase}_composition_repair`,
          attempt: compositionRepairAttempt,
          auditConfiguration: simplifiedRecoveryConfiguration,
        });
        const compositionAudits = withTutorDeliveryDecision(compositionDraftAudits, {
          allowActorialAdvisory: tutorStubPlainRecoveryAllowsActorialAdvisory({
            loopMode: state?.loopMode,
            learnerRequestedPlainStyle,
          }),
          advisoryReason:
            'the mechanically recomposed recovery preserves the selected host part and passes every hard response check; only the optional performance tactic remains below the visibility threshold',
          role: `${roleBase}_composition_repair`,
          attempt: compositionRepairAttempt,
        });
        const compositionRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, compositionRepairText);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'composition_repair_candidate',
            attempt: compositionRepairAttempt,
            response: compositionResponse,
            audits: compositionAudits,
            repairedSpans: compositionRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'mechanical_composition_repair',
          fromAttempt: 1,
          toAttempt: compositionRepairAttempt,
          triggeredBy: recoveryCompositionIssues.map((issue) => ({ guard: 'response_composition', ...issue })),
          guardedSpans: attempts[1].guardedSpans,
          repairedSpans: compositionRepairSpans,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_mechanical_repair',
          role: `${roleBase}_composition_repair`,
          turn: tutorTurn,
          attempt: compositionRepairAttempt,
          repairKind: 'learner_uptake_plus_policy_development',
          accepted: compositionAudits.deliveryOk,
          text: compositionRepairText,
        });
        if (compositionAudits.deliveryOk) {
          attachTutorDraftAudits(compositionResponse, compositionAudits);
          compositionResponse.repaired = true;
          compositionResponse.mechanicalRepair = true;
          if (compositionResponse.bufferedStream) compositionResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: compositionResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'composition_repair_candidate',
            finalAudits: compositionAudits,
            outcome: 'guarded_composition_repair_accepted',
          });
        }
      }

      const clarificationRepair = repairTutorStubMissingClarificationInvitation({
        text: plainRecoveryResponse.text,
        deliveryDecision: plainRecoveryAudits.deliveryDecision,
      });
      if (clarificationRepair.changed) {
        const clarificationAttempt = attempts.length;
        const clarificationResponse = tutorResponseFromSimplifiedRecovery(
          simplifiedRecoveryResponse,
          clarificationRepair.text,
          'question_support_repair_candidate',
        );
        const clarificationAudits = withTutorDeliveryDecision(
          auditTutorDraft(clarificationResponse, {
            role: `${roleBase}_question_support_repair`,
            attempt: clarificationAttempt,
            auditConfiguration: simplifiedRecoveryConfiguration,
          }),
          { role: `${roleBase}_question_support_repair`, attempt: clarificationAttempt },
        );
        const clarificationRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, clarificationRepair.text);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'question_support_repair_candidate',
            attempt: clarificationAttempt,
            response: clarificationResponse,
            audits: clarificationAudits,
            repairedSpans: clarificationRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'mechanical_clarification_invitation',
          fromAttempt: 1,
          toAttempt: clarificationAttempt,
          triggeredBy: tutorStubGuardIssueRows(plainRecoveryAudits),
          guardedSpans: attempts[1].guardedSpans,
          repairedSpans: clarificationRepairSpans,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_mechanical_repair',
          role: `${roleBase}_question_support_repair`,
          turn: tutorTurn,
          attempt: clarificationAttempt,
          repairKind: 'missing_clarification_invitation',
          accepted: clarificationAudits.deliveryOk,
          text: clarificationRepair.text,
        });
        if (clarificationAudits.deliveryOk) {
          attachTutorDraftAudits(clarificationResponse, clarificationAudits);
          clarificationResponse.repaired = true;
          clarificationResponse.mechanicalRepair = true;
          if (clarificationResponse.bufferedStream) clarificationResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: clarificationResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'question_support_repair_candidate',
            finalAudits: clarificationAudits,
            outcome: 'guarded_question_support_repair_accepted',
          });
        }
      }

      const openRecallRepair = repairTutorStubUnanswerableOpenRecall({
        text: plainRecoveryResponse.text,
        deliveryDecision: plainRecoveryAudits.deliveryDecision,
      });
      if (openRecallRepair.changed) {
        const openRecallAttempt = attempts.length;
        const openRecallResponse = tutorResponseFromSimplifiedRecovery(
          simplifiedRecoveryResponse,
          openRecallRepair.text,
          'question_support_repair_candidate',
        );
        const openRecallAudits = withTutorDeliveryDecision(
          auditTutorDraft(openRecallResponse, {
            role: `${roleBase}_question_support_repair`,
            attempt: openRecallAttempt,
            auditConfiguration: simplifiedRecoveryConfiguration,
          }),
          { role: `${roleBase}_question_support_repair`, attempt: openRecallAttempt },
        );
        const openRecallRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, openRecallRepair.text);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'question_support_repair_candidate',
            attempt: openRecallAttempt,
            response: openRecallResponse,
            audits: openRecallAudits,
            repairedSpans: openRecallRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'mechanical_unanswerable_open_recall_removal',
          fromAttempt: 1,
          toAttempt: openRecallAttempt,
          triggeredBy: tutorStubGuardIssueRows(plainRecoveryAudits),
          guardedSpans: attempts[1].guardedSpans,
          repairedSpans: openRecallRepairSpans,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_mechanical_repair',
          role: `${roleBase}_question_support_repair`,
          turn: tutorTurn,
          attempt: openRecallAttempt,
          repairKind: 'unanswerable_open_recall_removal',
          accepted: openRecallAudits.deliveryOk,
          text: openRecallRepair.text,
        });
        if (openRecallAudits.deliveryOk) {
          attachTutorDraftAudits(openRecallResponse, openRecallAudits);
          openRecallResponse.repaired = true;
          openRecallResponse.mechanicalRepair = true;
          if (openRecallResponse.bufferedStream) openRecallResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: openRecallResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'question_support_repair_candidate',
            finalAudits: openRecallAudits,
            outcome: 'guarded_question_support_repair_accepted',
          });
        }
      }

      const sourceVoiceRepairBases = [
        {
          kind: 'plain_recovery_candidate',
          attempt: 1,
          response: plainRecoveryResponse,
          audits: plainRecoveryAudits,
          auditConfiguration: simplifiedRecoveryConfiguration,
        },
      ];
      for (const base of sourceVoiceRepairBases) {
        const mechanical = repairTutorStubThirdPersonSourceLeadIn({
          text: base.response.text,
          dramaticReleaseFrame,
          responseConfiguration: simplifiedRecoveryConfiguration,
        });
        if (!mechanical.changed) continue;
        const sourceRepairAttempt = attempts.length;
        const sourceResponse = tutorResponseFromSimplifiedRecovery(
          simplifiedRecoveryResponse,
          mechanical.text,
          'source_voice_repair_candidate',
        );
        const sourceAudits = withTutorDeliveryDecision(
          auditTutorDraft(sourceResponse, {
            role: `${roleBase}_source_voice_repair`,
            attempt: sourceRepairAttempt,
            auditConfiguration: base.auditConfiguration,
          }),
          { role: `${roleBase}_source_voice_repair`, attempt: sourceRepairAttempt },
        );
        const sourceRepairSpans = exactTutorRepairSpans(base.response.text, mechanical.text);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'source_voice_repair_candidate',
            attempt: sourceRepairAttempt,
            response: sourceResponse,
            audits: sourceAudits,
            repairedSpans: sourceRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'mechanical_source_voice_repair',
          fromAttempt: base.attempt,
          toAttempt: sourceRepairAttempt,
          triggeredBy: tutorStubGuardIssueRows(base.audits),
          guardedSpans: attempts.find((attempt) => attempt.attempt === base.attempt)?.guardedSpans || [],
          repairedSpans: sourceRepairSpans,
          replacements: mechanical.replacements,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_mechanical_repair',
          role: `${roleBase}_source_voice_repair`,
          turn: tutorTurn,
          attempt: sourceRepairAttempt,
          repairKind: 'third_person_source_lead_in',
          basedOn: base.kind,
          accepted: sourceAudits.deliveryOk,
          replacements: mechanical.replacements,
          text: mechanical.text,
        });
        response = sourceResponse;
        audits = sourceAudits;
        if (sourceAudits.deliveryOk) {
          attachTutorDraftAudits(sourceResponse, sourceAudits);
          sourceResponse.repaired = true;
          sourceResponse.mechanicalRepair = true;
          if (sourceResponse.bufferedStream) sourceResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: sourceResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'source_voice_repair_candidate',
            finalAudits: sourceAudits,
            outcome: 'guarded_source_voice_repair_accepted',
          });
        }
      }

      // Self-correction pass — the last rung before the terminal safety text.
      //
      // The deterministic fallback is allowed to publish while the disposition
      // catalog downgrades a conversational-integrity finding to an advisory. The
      // finding is the same one that killed every model draft on this turn, so the
      // learner receives a turn that quietly changed course and is never told. One
      // more attempt is offered here, with a brief whose addressee is the learner
      // rather than the guard. Nothing about it is templated: the model may
      // disclose the near-miss in the register of the scene, or simply answer
      // well and say nothing. Only two things are checked that no other guard
      // covers — that a disclosed near-miss corresponds to a draft the tutor
      // actually produced, and that the apparatus is never named.
      const priorDisclosure = detectTutorStubSelfCorrectionDisclosure(recentTutorTexts.at(-1) || '');
      const disclosableCorrection = priorDisclosure.disclosed
        ? { disclosable: false, reason: 'the previous published turn already disclosed a self-correction' }
        : tutorStubDisclosableGuardCorrection({ audits, attempts });
      if (!disclosableCorrection.disclosable && disclosableCorrection.survivedFindings?.length) {
        // Declining costs a rung, so say so in the trace. Without this the skip
        // and the ordinary "nothing here to disclose" case look identical, and
        // the next run cannot be checked against the six turns that motivated it.
        appendTraceEvent(trace, {
          type: 'tutor_response_self_correction_pass_skipped',
          role: `${roleBase}_self_correction`,
          turn: tutorTurn,
          attempt: attempts.length,
          reason: disclosableCorrection.reason,
          survivedFindings: disclosableCorrection.survivedFindings,
          waivedFindings: disclosableCorrection.findings,
        });
      }
      if (disclosableCorrection.disclosable) {
        const disclosureAttempt = attempts.length;
        const priorDisclosureAttempt = attempts.at(-1);
        const disclosureBrief = tutorStubSelfCorrectionDisclosurePrompt({
          correction: disclosableCorrection,
          learnerText,
          turnProgressionContract: firstDraftContract?.progression || null,
          minimalRecoveryPrompt,
        });
        const disclosureUserPrompt = [
          tutorResponseRecoveryPrompt({
            publicPacket: publicRecoveryPacket,
            hardIssues: audits.deliveryDecision?.hardIssues || [],
            leakAudit: audits.leakAudit,
            scaffoldAudit: audits.scaffoldAudit,
            questionSupportAudit: audits.questionSupportAudit,
            dramaticReleaseAudit: audits.dramaticReleaseAudit,
            actorialRealizationAudit: audits.actorialRealizationAudit,
            responseConfigurationAudit: audits.responseConfigurationAudit,
            responseConfiguration: simplifiedRecoveryConfiguration,
            responseCompositionAudit: audits.responseCompositionAudit,
            liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
            liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
            repetitionAudit: audits.repetitionAudit,
            closureAudit: audits.closureAudit,
            dialogueClosureFrame,
            minimalRecoveryPrompt,
          }),
          disclosureBrief,
        ]
          .filter(Boolean)
          .join('\n\n');
        let disclosureModelResponse = null;
        try {
          disclosureModelResponse = await invokeTutorAttempt({
            attemptUserPrompt: disclosureUserPrompt,
            role: `${roleBase}_self_correction`,
            streamMode: canStreamTutor ? 'buffered' : 'none',
            repairAttempt: disclosureAttempt,
            systemPromptOverride: systemPrompt,
            instructionTextsOverride: [systemPrompt, ...publicRecoveryMachinePacket],
            privilegeAdvisoryOverride: recoveryPrivilegeAdvisory,
          });
        } catch (disclosureError) {
          // The safety text below is still reachable. A failed extra call must
          // never cost the turn that would otherwise have shipped.
          appendTraceEvent(trace, {
            type: 'tutor_response_self_correction_pass_unavailable',
            role: `${roleBase}_self_correction`,
            turn: tutorTurn,
            attempt: disclosureAttempt,
            error: disclosureError?.message || String(disclosureError),
          });
        }
        const disclosureText = String(disclosureModelResponse?.text || '').trim();
        if (disclosureText) {
          const disclosureResponse = tutorResponseFromSimplifiedRecovery(
            disclosureModelResponse,
            disclosureText,
            'self_correction_candidate',
          );
          const disclosureDraftAudits = auditTutorDraft(disclosureResponse, {
            role: `${roleBase}_self_correction`,
            attempt: disclosureAttempt,
            auditConfiguration: simplifiedRecoveryConfiguration,
          });
          disclosureDraftAudits.selfCorrectionDisclosureAudit = auditTutorStubSelfCorrectionDisclosure({
            text: disclosureText,
            priorAttemptTexts: attempts.map((entry) => entry?.candidate?.text || '').filter(Boolean),
          });
          const disclosureAudits = withTutorDeliveryDecision(disclosureDraftAudits, {
            role: `${roleBase}_self_correction`,
            attempt: disclosureAttempt,
          });
          const disclosed = disclosureDraftAudits.selfCorrectionDisclosureAudit.disclosed;
          const disclosureRepairSpans = exactTutorRepairSpans(priorDisclosureAttempt.candidate.text, disclosureText);
          attempts.push(
            tutorGuardAttemptEnvelope({
              kind: 'self_correction_candidate',
              attempt: disclosureAttempt,
              response: disclosureResponse,
              audits: disclosureAudits,
              repairedSpans: disclosureRepairSpans,
            }),
          );
          repairsApplied.push({
            kind: 'model_self_correction_pass',
            fromAttempt: priorDisclosureAttempt.attempt,
            toAttempt: disclosureAttempt,
            triggeredBy: disclosableCorrection.findings,
            guardedSpans: priorDisclosureAttempt.guardedSpans,
            repairedSpans: disclosureRepairSpans,
            disclosedNearMiss: disclosed,
          });
          appendTraceEvent(trace, {
            type: 'tutor_response_self_correction_pass',
            role: `${roleBase}_self_correction`,
            turn: tutorTurn,
            attempt: disclosureAttempt,
            waivedFindings: disclosableCorrection.findings,
            nearMiss: disclosableCorrection.nearMiss,
            disclosed,
            marker: disclosureDraftAudits.selfCorrectionDisclosureAudit.marker,
            disclosureIssues: disclosureDraftAudits.selfCorrectionDisclosureAudit.issues,
            accepted: disclosureAudits.deliveryOk,
            text: disclosureText,
          });
          if (disclosureAudits.deliveryOk) {
            attachTutorDraftAudits(disclosureResponse, disclosureAudits);
            disclosureResponse.repaired = true;
            disclosureResponse.selfCorrectionPass = true;
            disclosureResponse.disclosedSelfCorrection = disclosed;
            if (disclosureResponse.bufferedStream) disclosureResponse.guardedStreamReplay = true;
            return attachTutorGuardAccounting({
              response: disclosureResponse,
              state,
              trace,
              tutorTurn,
              role: roleBase,
              guards,
              attempts,
              repairsApplied,
              finalSource: 'self_correction_candidate',
              outcome: disclosed ? 'guarded_self_correction_disclosed' : 'guarded_self_correction_pass_accepted',
              finalAudits: disclosureAudits,
            });
          }
        }
      }

      // Untangling 1 (card: harness-untangling-clue-insertion): when every
      // remaining hard issue is the release family and a model draft exists,
      // keep the draft and append the due clue's rendered sentences instead
      // of replacing the whole reply. Env-gated via dependencies.clueInsertion;
      // the wholesale fallback remains for every other failure family and as
      // the audit-fail fallback for the composition itself.
      if (
        dependencies.clueInsertion &&
        response?.text &&
        (audits.deliveryDecision?.hardIssues || []).length > 0 &&
        audits.deliveryDecision.hardIssues.every(
          (issue) =>
            issue.guard === 'dramatic_release' ||
            issue.guard === 'release_delivery' ||
            // The exact-quotation rule (the due source must appear once,
            // host-rendered) lives under the alignment guard but is a
            // clue-delivery failure — appending the rendered source is its
            // literal repair.
            (issue.guard === 'live_source_action_alignment_v1' && String(issue.type || '').startsWith('due_source_')),
        )
      ) {
        // Use the release FRAME's entries — the same objects the contract
        // rendered — so enacted-role sources produce the exact expected form.
        const dueRowsRaw = dramaticReleaseFrame?.entries?.length
          ? dramaticReleaseFrame.entries
          : currentReleaseRows(state, tutorTurn) || [];
        // Normalize presentation-nested mode/role to the top-level shape the
        // renderer and referent compiler read.
        const dueRows = dueRowsRaw.map((entry) =>
          entry?.presentation?.mode && !entry?.mode
            ? { ...entry, mode: entry.presentation.mode, role: entry.presentation.role ?? entry.role }
            : entry,
        );
        const clueSentences = dueRows
          .map((entry, index) => dependencies.renderTutorStubDueSource(entry, index)?.text || '')
          .filter(Boolean);
        if (clueSentences.length) {
          // Span replacement: swap the draft's paraphrase sentences for the
          // exact renderings (append only where the draft never touched the
          // clue) — blind appending double-delivers and the duplicate guard
          // rightly rejects it.
          const insertionResponse = {
            ...response,
            text: dependencies.composeClueSpanReplacement({
              text: String(response.text).trim(),
              entries: dueRows,
              renderedTexts: dueRows.map(
                (entry, index) => dependencies.renderTutorStubDueSource(entry, index)?.text || '',
              ),
            }),
          };
          const insertionAttempt = attempts.length;
          const insertionAudits = withTutorDeliveryDecision(
            auditTutorDraft(insertionResponse, { role: `${roleBase}_clue_insertion`, attempt: insertionAttempt }),
            { role: `${roleBase}_clue_insertion`, attempt: insertionAttempt },
          );
          appendTraceEvent(trace, {
            type: 'tutor_clue_insertion',
            role: roleBase,
            turn: tutorTurn,
            attempt: insertionAttempt,
            accepted: insertionAudits.deliveryOk,
            clueSentences: clueSentences.length,
            failedHard: insertionAudits.deliveryOk
              ? []
              : (insertionAudits.deliveryDecision?.hardIssues || []).map((issue) => ({
                  guard: issue.guard,
                  type: issue.type,
                })),
            composedText: insertionAudits.deliveryOk ? null : insertionResponse.text,
            boundaries: insertionAudits.deliveryOk
              ? null
              : (insertionAudits.liveSourceActionAlignmentAudit?.pre_source_boundaries || []).map((b) => ({
                  source: b.source,
                  ok: b.alignment_ok,
                  host: b.audited_host_text,
                  required: (b.sources || []).flatMap((s2) => (s2.required || []).map((r) => r.label)),
                })),
          });
          if (insertionAudits.deliveryOk) {
            attachTutorDraftAudits(insertionResponse, insertionAudits);
            insertionResponse.repaired = true;
            insertionResponse.clueInserted = true;
            if (insertionResponse.bufferedStream) insertionResponse.guardedStreamReplay = true;
            return attachTutorGuardAccounting({
              response: insertionResponse,
              state,
              trace,
              tutorTurn,
              role: roleBase,
              guards,
              attempts,
              repairsApplied,
              finalSource: 'clue_insertion',
              outcome: 'clue_inserted_draft_delivered',
              finalAudits: insertionAudits,
            });
          }
        }
      }

      const closureFallbackSelected = Boolean(
        closureGuardEnabled && (dialogueClosureFrame.mandatory || audits.closureAudit.closesDialogue),
      );
      const fallbackContext = {
        support: humanDiscourseFrame?.questionSupport || null,
        world,
        learnerText,
        dueEvidence: currentReleaseRows(state, tutorTurn),
        latestEvidence: humanDiscourseFrame?.scaffoldState?.releaseState?.latestReleased || null,
        recentTutorTexts,
      };
      const fallbackRequiresSpecificUptake =
        closureFallbackSelected ||
        (audits?.responseCompositionAudit?.issues || []).some(
          (issue) => issue.type === 'learner_selected_test_not_acknowledged',
        ) ||
        tutorStubLearnerSelectedToolMarkPath(learnerText);
      const deterministicFallbackUptake = deterministicTutorStubTurnProgressionUptake({
        contract: firstDraftContract?.progression || null,
        recentTutorTexts,
        variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
        learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
        // Mandatory closure must be tied to the compiled learner focus. A
        // generic epistemic transition can otherwise share a normalized token
        // with the learner surface and falsely look specific enough.
        defaultUptake: closureFallbackSelected
          ? ''
          : deterministicTutorStubLearnerUptake({
              learnerText,
              classification,
              actionFamily: responseCompositionFrame.selected_action_family || null,
              recentTutorTexts,
              world,
            }),
      });
      const candidateFallbackUptake = fallbackRequiresSpecificUptake
        ? deterministicFallbackUptake
        : preservableTutorUptake(audits) || firstRepairUptake || deterministicFallbackUptake;
      const fallbackUptakeCandidate =
        firstDraftContract?.opening?.writable_entry_requested === true &&
        !/^Write:\s*[“"]/u.test(candidateFallbackUptake)
          ? deterministicTutorStubWritableEntryUptake({ firstDraftContract })
          : candidateFallbackUptake;
      const fallbackUptakePreparation = prepareTutorStubDueClueUptake({
        uptake: fallbackUptakeCandidate,
        frame: dramaticReleaseFrame,
      });
      const fallbackUptake = fallbackUptakePreparation.text;
      if (fallbackUptakePreparation.replaced) {
        appendTraceEvent(trace, {
          type: 'fallback_uptake_due_clue_deduplicated',
          turn: tutorTurn,
          repeatedPremises: fallbackUptakePreparation.repeatedPremises,
          publicTranscriptChanged: false,
        });
      }
      // Question support and live progression can coexist with the human
      // scaffold. Their compiled contract must select the fallback; the older
      // generous-inference text does not realize bounded choices or declarative
      // handoff ownership.
      const configuredContinuationFallbackRequired = Boolean(
        questionSupportGuardEnabled ||
        actorialRealizationGuardEnabled ||
        firstDraftContract?.progression?.complete === true,
      );
      const baseFallbackText = instructionalMetaRepair
        ? deterministicTutorStubConfiguredContinuationFallback({
            uptake: fallbackUptake,
            responseConfiguration: simplifiedRecoveryConfiguration,
            support: null,
            world,
            learnerText,
            turnProgressionContract: firstDraftContract?.progression || null,
            recentTutorTexts,
            variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
          })
        : closureFallbackSelected
          ? deterministicTutorStubClosureResponse(dialogueClosureFrame, {
              responseConfiguration: simplifiedRecoveryConfiguration,
              focusHandoff: deterministicTutorStubTurnProgressionHandoff({
                contract: firstDraftContract?.progression || null,
                publicObject: worldLedgerTerm(world),
              }),
            })
          : dramaticReleaseGuardEnabled
            ? deterministicTutorStubDramaticReleaseFallback({
                frame: dramaticReleaseFrame,
                support: humanDiscourseFrame?.questionSupport || null,
                uptake: fallbackUptake,
                responseConfiguration: simplifiedRecoveryConfiguration,
                variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
                avoidQuestion: humanDiscourseFrame?.conversationalCompletion?.sourceTutorQuestion || '',
                turnProgressionContract: firstDraftContract?.progression || null,
                sourceAccessibilityContract: firstDraftContract?.evidence?.source_accessibility || null,
                world,
              })
            : configuredContinuationFallbackRequired
              ? deterministicTutorStubConfiguredContinuationFallback({
                  uptake: fallbackUptake,
                  responseConfiguration: simplifiedRecoveryConfiguration,
                  support: humanDiscourseFrame?.questionSupport || null,
                  world,
                  learnerText,
                  turnProgressionContract: firstDraftContract?.progression || null,
                  recentTutorTexts,
                  variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
                })
              : scaffoldGuardEnabled
                ? deterministicGenerousInferenceFallback(fallbackContext)
                : deterministicTutorStubContextualFallback(fallbackContext);
      const fallbackText =
        dramaticReleaseGuardEnabled || instructionalMetaRepair
          ? baseFallbackText
          : ensureFallbackComposition(baseFallbackText, fallbackUptake);
      const fallbackClosureAudit = closureGuardEnabled
        ? auditTutorStubDialogueClosureResponse({ text: fallbackText, frame: dialogueClosureFrame })
        : audits.closureAudit;
      const fallbackQuestionSupportAudit = questionSupportGuardEnabled
        ? auditTutorStubQuestionSupportResponse({
            text: fallbackText,
            support: humanDiscourseFrame.questionSupport,
          })
        : audits.questionSupportAudit;
      const fallback = {
        text: fallbackText,
        provider: resolved.provider,
        model: resolved.model,
        latencyMs: response.latencyMs || 0,
        usage: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
        effort: response.effort || response.reasoningEffort || cliEffort || null,
        reasoningEffort: response.reasoningEffort || response.effort || cliEffort || null,
        leakAudit: audits.leakAudit,
        scaffoldAudit: audits.scaffoldAudit,
        questionSupportAudit: fallbackQuestionSupportAudit,
        dramaticReleaseAudit: audits.dramaticReleaseAudit,
        actorialRealizationAudit: audits.actorialRealizationAudit,
        responseCompositionAudit: audits.responseCompositionAudit,
        repetitionAudit: audits.repetitionAudit,
        closureAudit: fallbackClosureAudit,
        repaired: true,
        deterministicFallback: true,
        deterministicClosure: closureFallbackSelected,
        tokenUsageAvailable: response.tokenUsageAvailable,
        promptSnapshot: response.promptSnapshot || null,
      };
      if (canStreamTutor) {
        fallback.guardedStreamReplay = true;
      }
      const fallbackAttempt = attempts.length;
      const priorAttempt = attempts.at(-1);
      const fallbackDraftAudits = auditTutorDraft(fallback, {
        role: `${roleBase}_fallback`,
        attempt: fallbackAttempt,
        auditConfiguration: simplifiedRecoveryConfiguration,
      });
      const fallbackAudits = withTutorDeliveryDecision(fallbackDraftAudits, {
        allowActorialAdvisory: tutorStubActorialPerformanceMayBeAdvisory(
          fallbackDraftAudits.actorialRealizationAudit,
          fallbackDraftAudits.responseConfigurationAudit,
        ),
        advisoryReason:
          'the deterministic fallback is the terminal safety text — known conversational-integrity, dramatic-form, and optional actorial-realization findings on it are recorded as advisories instead of killing the dialogue; evidence, clue-transaction and closure boundaries remain hard',
        role: `${roleBase}_fallback`,
        attempt: fallbackAttempt,
        terminalFallback: true,
      });
      attachTutorDraftAudits(fallback, fallbackAudits);
      const fallbackRepairSpans = exactTutorRepairSpans(priorAttempt.candidate.text, fallbackText);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'deterministic_fallback',
          attempt: fallbackAttempt,
          response: fallback,
          audits: fallbackAudits,
          repairedSpans: fallbackRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'deterministic_fallback',
        fromAttempt: priorAttempt.attempt,
        toAttempt: fallbackAttempt,
        triggeredBy: tutorStubGuardIssueRows(audits),
        guardedSpans: priorAttempt.guardedSpans,
        repairedSpans: fallbackRepairSpans,
      });
      if (!fallbackAudits.deliveryOk) {
        const rejectedIssues = tutorStubGuardIssueRows(fallbackAudits);
        const exhaustedAccounting = buildTutorGuardAccounting({
          response: fallback,
          state,
          tutorTurn,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'rejected_deterministic_fallback',
          finalAudits: fallbackAudits,
          outcome: 'guard_exhausted_without_public_delivery',
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_fallback_rejected',
          role: roleBase,
          turn: tutorTurn,
          issues: rejectedIssues,
          text: fallbackText,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_guard_exhausted',
          role: roleBase,
          turn: tutorTurn,
          accounting: exhaustedAccounting,
          publicDelivery: null,
        });
        const terminalFailure = {
          schema: 'machinespirits.tutor-stub.terminal-fallback-failure.v1',
          turn: tutorTurn,
          attemptCount: attempts.length,
          hardIssues: fallbackAudits.deliveryDecision?.hardIssues || [],
          rejectedFallbackText: fallbackText,
          tracePath: trace?.filePath || null,
        };
        const error = new Error(
          tutorStubTerminalFallbackFailureMessage(fallbackAudits.deliveryDecision, {
            candidateText: fallbackText,
            attemptCount: attempts.length,
            tracePath: trace?.filePath || null,
          }),
        );
        error.code = 'TUTOR_FALLBACK_AUDIT_FAILED';
        error.tutorGuardAccounting = exhaustedAccounting;
        error.tutorFallbackFailure = terminalFailure;
        throw error;
      }
      appendTraceEvent(trace, {
        type: 'tutor_response_fallback',
        role: roleBase,
        turn: tutorTurn,
        leaks: audits.leakAudit.leaks,
        scaffoldIssues: audits.scaffoldAudit.issues,
        questionSupportIssues: audits.questionSupportAudit.issues,
        dramaticReleaseIssues: audits.dramaticReleaseAudit.issues,
        actorialRealizationIssues: audits.actorialRealizationAudit.issues,
        responseCompositionIssues: audits.responseCompositionAudit.issues,
        liveTurnProgressionIssues: audits.liveTurnProgressionAudit.issues,
        liveSourceActionAlignmentIssues: audits.liveSourceActionAlignmentAudit.issues,
        repetitionIssues: audits.repetitionAudit.issues,
        closureIssues: audits.closureAudit.issues,
        text: fallbackText,
      });
      return attachTutorGuardAccounting({
        response: fallback,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'deterministic_fallback',
        finalAudits: fallbackAudits,
        outcome: 'guarded_deterministic_fallback',
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
