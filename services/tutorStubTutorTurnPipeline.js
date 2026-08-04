import { createTutorStubTutorAttemptRuntime } from './tutorStubTutorAttemptRuntime.js';
import { createTutorStubTutorCommitteeRuntime } from './tutorStubTutorCommitteeRuntime.js';
import { createTutorStubTutorDeliveryRuntime } from './tutorStubTutorDeliveryRuntime.js';
import { createTutorStubTutorDraftAudit } from './tutorStubTutorDraftAudit.js';
import { createTutorStubTutorRepairRuntime } from './tutorStubTutorRepairRuntime.js';
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
    extractCommitteeSpanV1,
    extractCuePreservingCommitteeSpanV2,
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
    resolveCueBlindCommitteeDelivery,
    resolveTutorStubPublicCounterpressure,
    runCommitteeBattery,
    runCueBlindCommitteeBattery,
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
    auditTutorResponseLeak,
    buildCommitteeCompositionBlock,
    committeeFallbackBatteryPass,
    committeeMiniGenerate,
    extractCommitteeSpanV1,
    extractCuePreservingCommitteeSpanV2,
    jsonClone,
    reserveTutorStubMeteredModelCall,
    resolveCueBlindCommitteeDelivery,
    runCommitteeBattery,
    runCueBlindCommitteeBattery,
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
      learnerText,
      maxTokens,
      nextTutorGuardCallId,
      roleBase,
      speakerPrivilegeAudit,
      speakerPublicPremiseIds,
      state,
      trace,
      tutorStreamMode,
      tutorTurn,
      world,
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
