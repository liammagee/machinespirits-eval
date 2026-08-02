/**
 * The measured advisory blocks the pipeline can gate out of the speaking
 * prompt. Ids match the A/B feature registry (`services/tutorStubAbArms.js`);
 * the caller resolves which subset is on and passes it as
 * `speakerAdvisoryBlocks`. Blocks outside this list are never gated.
 */
export const TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS = Object.freeze([
  'context_continuity',
  'evidence_window',
  'learner_classifier',
  'learner_dag',
  'human_scaffold',
  'first_draft_contract',
]);

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
    const messageContext = tutorMessageContext(state, history);
    const context = messageContext.messages;
    const recentTutorTexts = context
      .filter((message) => message.role === 'assistant')
      .map((message) => message.content);
    const tutorTurn = Math.floor(history.length / 2) + 1;
    // Freeze the speaking boundary once for the whole call. Release pacing is
    // transactional and can be rolled back or committed after generation; every
    // candidate in this call must nevertheless be judged against exactly the
    // evidence that appeared in the original speaking prompt.
    const speakerPublicPremiseIds = new Set(
      passthrough
        ? []
        : snapshotTutorStubPublicPremiseIds({
            committedEvidence: committedReleaseRows(state, tutorTurn),
            dueEvidence: currentReleaseRows(state, tutorTurn),
          }),
    );
    const tutorMemory = passthrough
      ? null
      : [
          '[Tutor context continuity]',
          `All ${messageContext.replayedMessageCount} previous public user/assistant messages are replayed in their original order for this model call.`,
          '[End tutor context continuity]',
        ].join('\n');
    const advisory = passthrough ? null : classifierTutorContext(classification);
    const learnerDagAdvisory = passthrough
      ? null
      : tutorLearnerDagModelContext(tutorLearnerDagModel, {
          releasedEvidence: dag && world ? committedReleaseRows(state, tutorTurn) : [],
        });
    const instructionalMetaRepair = Boolean(
      !passthrough && humanDiscourseFrame?.discoursePlane?.plane === 'instructional_meta',
    );
    const dramaticReleaseFrame = passthrough
      ? { active: false, entries: [] }
      : buildTutorStubDramaticReleaseFrame({
          dueEvidence: instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn),
          world: state.world,
        });
    const responseConfiguration = registerSelection?.response_configuration || registerSelection || null;
    const committedPublicEvidence = passthrough ? [] : committedReleaseRows(state, tutorTurn);
    const duePublicEvidence = passthrough || instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn);
    const publicCounterpressure = passthrough
      ? null
      : resolveTutorStubPublicCounterpressure({
          world,
          publicEvidence: committedPublicEvidence,
          dueEvidence: duePublicEvidence,
        });
    const performanceObligationContract = passthrough
      ? null
      : compileTutorStubPerformanceObligationContract({
          responseConfiguration,
          publicWorld: {
            visibility: 'public',
            title: world?.title,
            setting: world?.setting,
            question: world?.question || world?.publicQuestion,
            summary: world?.openingFrame?.situation || world?.openingSituation,
            temporal_frame: world?.presentation?.temporal_frame,
            narrative_diction: world?.presentation?.narrative_diction,
            ledger_term: world?.presentation?.ledger_term,
            public_objects: [world?.presentation?.ledger_term].filter(Boolean),
            audience_context: world?.audience?.context || null,
          },
          publicTurn: {
            visibility: 'public',
            learner_move: learnerText,
            pressure_target: publicCounterpressure?.pressureTarget || null,
            contrary_evidence: publicCounterpressure ? [publicCounterpressure.contraryEvidence] : [],
            public_evidence: committedPublicEvidence,
            due_evidence: duePublicEvidence,
          },
        });
    const speakingResponseConfiguration =
      performanceObligationContract?.tactic_applicability?.applicable === false
        ? {
            ...structuredClone(responseConfiguration || {}),
            actorial_performance: structuredClone(
              performanceObligationContract.selection?.actorial_performance ||
                responseConfiguration?.actorial_performance ||
                {},
            ),
            speaking_transition: structuredClone(performanceObligationContract.selection?.speaking_transition || null),
          }
        : responseConfiguration;
    const firstDraftHumanDiscourseAdvisory = passthrough
      ? null
      : humanDiscourseTutorContext(humanDiscourseFrame, {
          includeQuestionSupport: false,
          includeDefaultResponseShape: false,
        });
    const instructionalMetaRestatementAdvisory = instructionalMetaRepair
      ? [
          '[Tutor-only instructional repair target]',
          recentTutorTexts.length
            ? 'Restatement target: the immediately preceding public tutor message already present in replayed dialogue. Restate its meaning without copying its difficult wording.'
            : 'No preceding public tutor message is replayed. Explain the public task in plain words without repeating the inquiry question verbatim.',
          'Do not quote the public inquiry question and do not output a question mark. This turn repairs wording only.',
          '[End tutor-only instructional repair target]',
        ].join('\n')
      : null;
    const responseCompositionFrame = passthrough
      ? { active: false }
      : buildTutorStubResponseCompositionFrame({
          learnerText,
          classification,
          tutorLearnerDag: tutorLearnerDagModel,
          registerSelection,
          dramaticReleaseFrame,
          dialogueClosureFrame,
          conversationalCompletion: humanDiscourseFrame?.conversationalCompletion || null,
          publicFocusMapping: humanDiscourseFrame?.scaffoldState?.branch?.publicRelationMap || null,
          recentTutorTexts,
          discoursePlane: humanDiscourseFrame?.discoursePlane || null,
        });
    const firstDraftContract = passthrough
      ? null
      : buildTutorStubFirstDraftContract({
          learnerText,
          publicQuestion: world?.question || world?.publicQuestion || '',
          responseConfiguration: speakingResponseConfiguration,
          responseCompositionFrame,
          dramaticReleaseFrame,
          committedPublicEvidence,
          questionSupport: humanDiscourseFrame?.questionSupport || null,
          dialogueClosureFrame,
          performanceObligationContract,
          sourceAccessibilityPolicy: speakingResponseConfiguration?.source_accessibility_policy || 'direct_only',
          sourceAccessibilityOwner: 'post_source_sentence',
        });
    const assignedPointOfAction = state?.pointOfAction?.current || null;
    const eligiblePointOfAction = reconcileTutorStubPointOfActionHandoffEligibility(
      assignedPointOfAction,
      firstDraftContract?.progression || null,
    );
    if (eligiblePointOfAction !== assignedPointOfAction) {
      state.pointOfAction.current = eligiblePointOfAction;
      appendTraceEvent(trace, {
        type: 'point_of_action_handoff_suppression',
        turn: tutorTurn,
        pointOfAction: eligiblePointOfAction,
        publicTranscriptChanged: false,
      });
    }
    const firstDraftContractAdvisory = passthrough ? null : tutorStubFirstDraftContractPrompt(firstDraftContract);
    const comprehensionAdvisory = passthrough
      ? null
      : tutorStubComprehensionPrompt(state?.comprehension, { turn: tutorTurn });
    const directorGuidanceAdvisory = passthrough
      ? null
      : tutorStubDirectorGuidancePrompt(state?.directorGuidance, { tutorTurn });
    const coachAdvisory = passthrough ? null : tutorCoachGuidanceContext(state, { tutorTurn });
    const pointOfActionAdvisory = passthrough ? null : tutorStubPointOfActionPrompt(state?.pointOfAction?.current);
    const tuningAdvisory = passthrough ? null : tutorStubTuningTurnAdvisory(state?.tuning);
    const tutorFeedbackAdvisory = passthrough
      ? null
      : tutorStubTurnFeedbackPrompt(tutorFeedback, { adaptationPlan: feedbackAdaptationPlan });
    // The original speaking attempt receives one compiled performance contract.
    // Keep the detailed configuration/composition/release surfaces for audited
    // recovery, where a failed axis must be named precisely, instead of making
    // the first draft reconcile the same requirements several times.
    const effectiveSystemPrompt = systemPrompt;
    const learnerMessageCount = Array.isArray(learnerMessages) ? learnerMessages.length : 1;
    const learnerPrompt = passthrough
      ? learnerText
      : learnerMessageCount > 1
        ? `Learner says in ${learnerMessageCount} consecutive messages before your reply (treat them as one compound turn):\n${learnerText}`
        : `Learner says:\n${learnerText}`;
    // Only the six measured blocks are gated. The advisories below them —
    // comprehension, director, coach, point-of-action, tuning, feedback — have
    // never been through the A/B bench, so there is no reading to cut them on.
    const withSpeakerBlock = (id, text) =>
      speakerAdvisoryBlocks === null || speakerAdvisoryBlocks.has(id) ? text : null;
    const speakerAdvisoryParts = [
      withSpeakerBlock('context_continuity', tutorMemory),
      withSpeakerBlock(
        'evidence_window',
        dag && world && !instructionalMetaRepair ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
      ),
      withSpeakerBlock('learner_classifier', advisory),
      withSpeakerBlock('learner_dag', learnerDagAdvisory),
      withSpeakerBlock('human_scaffold', firstDraftHumanDiscourseAdvisory),
      instructionalMetaRestatementAdvisory,
      comprehensionAdvisory,
      directorGuidanceAdvisory,
      coachAdvisory,
      pointOfActionAdvisory,
      tuningAdvisory,
      tutorFeedbackAdvisory,
      // The manner switch's per-turn conduct card (tutorStubMannerSwitch.js):
      // present only while the CLI-owned switch holds the schoolmaster manner.
      // Permission-shaped; no guard anywhere checks that the manner was worn.
      // Phase S2d: with cardFinalSlot, the card moves BELOW the first-draft
      // contract — the last instruction before the learner's line — because
      // live drafts obeyed the contract over a licence positioned earlier.
      // Phase S revisit: with cardAfterLearner, the card leaves the advisory
      // block entirely and follows the learner's line (see promptParts).
      dependencies.cardFinalSlot || dependencies.cardAfterLearner ? null : state?.mannerSwitch?.card || null,
      // Keep the executable contract nearest the learner line so later analysis
      // advisories cannot bury the actual speaking task.
      withSpeakerBlock('first_draft_contract', firstDraftContractAdvisory),
      dependencies.cardFinalSlot && !dependencies.cardAfterLearner ? state?.mannerSwitch?.card || null : null,
    ]
      .filter(Boolean)
      .map((text) => sanitizeTutorStubSpeakerAdvisory({ world: dag ? world : null, tutorTurn, text }));
    const promptParts = [
      ...speakerAdvisoryParts,
      learnerPrompt,
      // Phase S revisit (P1's reading-order finding): the card as the very
      // last thing the model reads, after the learner's line.
      dependencies.cardAfterLearner ? state?.mannerSwitch?.card || null : null,
    ].filter(Boolean);
    const userPrompt = promptParts.join('\n\n');
    const machineAdvisoryParts = [...speakerAdvisoryParts].filter(Boolean);
    // Stamp the prompt shape on the turn. Without this a transcript cannot say
    // which blocks it was written under, and runs from either side of a default
    // change would pool silently.
    if (!passthrough && speakerAdvisoryBlocks !== null) {
      appendTraceEvent(trace, {
        type: 'tutor_speaker_advisory_blocks',
        turn: tutorTurn,
        enabled: [...speakerAdvisoryBlocks],
        omitted: TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.filter((id) => !speakerAdvisoryBlocks.has(id)),
      });
    }
    let effectiveSpeakerSystemPrompt = effectiveSystemPrompt;
    let effectiveSpeakerUserPrompt = userPrompt;
    let effectiveSpeakerInstructionTexts = [systemPrompt, ...machineAdvisoryParts].filter(Boolean);
    let speakerPrivilegeAudit = passthrough
      ? {
          schema: 'machinespirits.tutor-stub.speaker-privilege-audit.v1',
          ok: true,
          bypassed: true,
          reason: 'passthrough_uses_only_system_setup_public_history_and_latest_user_message',
        }
      : auditTutorStubSpeakerPrivilege({
          world: dag ? world : null,
          tutorTurn,
          systemPrompt: effectiveSystemPrompt,
          privateAdvisory: machineAdvisoryParts.join('\n\n'),
        });
    if (!speakerPrivilegeAudit.ok) {
      const blockedAudit = speakerPrivilegeAudit;
      appendTraceEvent(trace, {
        type: 'tutor_speaker_privilege_audit',
        turn: tutorTurn,
        audit: blockedAudit,
      });
      // Rebuilt from named parts, so it has to honour the same gate — otherwise
      // a leak recovery would quietly restore a block the run had switched off.
      const recovery = recoverTutorStubSpeakerPrompt({
        world: dag ? world : null,
        tutorTurn,
        baseSystemPrompt: systemPrompt,
        continuityPrompt: withSpeakerBlock('context_continuity', tutorMemory),
        publicEvidencePrompt: withSpeakerBlock(
          'evidence_window',
          dag && world ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
        ),
        firstDraftContractPrompt: withSpeakerBlock('first_draft_contract', firstDraftContractAdvisory),
        learnerPrompt,
        messageHistory: context,
      });
      appendTraceEvent(trace, {
        type: 'tutor_speaker_privilege_recovery',
        turn: tutorTurn,
        method: recovery.method,
        applied: recovery.applied,
        originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
        speakerPrivilegeAudit: recovery.speakerPrivilegeAudit,
        promptAudit: recovery.promptAudit,
      });
      if (!recovery.applied) {
        const error = new Error(
          `Speaking-tutor prompt crossed the private-planner boundary and public-only recovery failed: ${blockedAudit.issues
            .map((issue) => `${issue.code}:${issue.source}`)
            .join(', ')}`,
        );
        error.code = 'TUTOR_SPEAKER_PRIVILEGE_RECOVERY_FAILED';
        throw error;
      }
      effectiveSpeakerSystemPrompt = recovery.systemPrompt;
      effectiveSpeakerUserPrompt = recovery.userPrompt;
      effectiveSpeakerInstructionTexts = recovery.instructionTexts;
      speakerPrivilegeAudit = {
        ...recovery.speakerPrivilegeAudit,
        recovery: {
          applied: true,
          method: recovery.method,
          originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
        },
      };
    }
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
    let tutorModelCallSequence = 0;

    async function invokeTutorAttempt({
      attemptUserPrompt,
      role,
      streamMode = 'none',
      repairAttempt = 0,
      systemPromptOverride = null,
      instructionTextsOverride = null,
      privilegeAdvisoryOverride = null,
    }) {
      const startedAt = new Date().toISOString();
      const instructionTexts =
        instructionTextsOverride || (passthrough ? [systemPrompt] : effectiveSpeakerInstructionTexts);
      let attemptSystemPrompt = systemPromptOverride || effectiveSpeakerSystemPrompt;
      let effectiveAttemptUserPrompt = attemptUserPrompt;
      let effectiveInstructionTexts = instructionTexts;
      let attemptSpeakerPrivilegeAudit = speakerPrivilegeAudit;
      if (!passthrough && (systemPromptOverride || instructionTextsOverride)) {
        attemptSpeakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
          world: dag ? world : null,
          tutorTurn,
          systemPrompt: attemptSystemPrompt,
          privateAdvisory:
            privilegeAdvisoryOverride === null
              ? effectiveInstructionTexts.slice(1).join('\n\n')
              : privilegeAdvisoryOverride,
        });
        appendTraceEvent(trace, {
          type: 'tutor_speaker_privilege_audit',
          role,
          turn: tutorTurn,
          repairAttempt,
          audit: attemptSpeakerPrivilegeAudit,
        });
        if (!attemptSpeakerPrivilegeAudit.ok) {
          const error = new Error(
            `Tutor recovery prompt crossed the private-planner boundary: ${attemptSpeakerPrivilegeAudit.issues
              .map((issue) => `${issue.code}:${issue.source}`)
              .join(', ')}`,
          );
          error.code = 'TUTOR_RECOVERY_SPEAKER_PRIVILEGE_FAILED';
          error.speakerPrivilegeAudit = attemptSpeakerPrivilegeAudit;
          throw error;
        }
      }
      let promptAudit = passthrough
        ? {
            schema: 'machinespirits.tutor-stub.prompt-audit.v1',
            surface: 'tutor_turn_passthrough',
            ok: true,
            bypassed: true,
            reason: 'preserve_exact_system_history_and_user_payload',
            violations: [],
            duplicateInstructionLines: [],
          }
        : auditTutorStubPrompt({
            surface: 'tutor_turn',
            systemPrompt: attemptSystemPrompt,
            userPrompt: effectiveAttemptUserPrompt,
            messageHistory: context,
            instructionTexts: effectiveInstructionTexts,
          });
      const duplicateOnlyFailure =
        !passthrough &&
        !promptAudit.ok &&
        promptAudit.duplicateInstructionLines?.length > 0 &&
        promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
      if (duplicateOnlyFailure) {
        const originalAudit = promptAudit;
        const actualPromptRecovery = recoverTutorStubDuplicateInstructionLines({
          texts: [attemptSystemPrompt, effectiveAttemptUserPrompt],
          duplicateInstructionLines: originalAudit.duplicateInstructionLines,
        });
        const instructionRecovery = recoverTutorStubDuplicateInstructionLines({
          texts: effectiveInstructionTexts,
          duplicateInstructionLines: originalAudit.duplicateInstructionLines,
        });
        [attemptSystemPrompt, effectiveAttemptUserPrompt] = actualPromptRecovery.texts;
        effectiveInstructionTexts = instructionRecovery.texts;
        const recoveredAudit = auditTutorStubPrompt({
          surface: 'tutor_turn',
          systemPrompt: attemptSystemPrompt,
          userPrompt: effectiveAttemptUserPrompt,
          messageHistory: context,
          instructionTexts: effectiveInstructionTexts,
        });
        const recovery = {
          applied: actualPromptRecovery.applied && instructionRecovery.applied && recoveredAudit.ok,
          method: 'deduplicate_exact_instruction_lines',
          originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
          removedPromptLineCount: actualPromptRecovery.removedLines.length,
          removedInstructionLineCount: instructionRecovery.removedLines.length,
        };
        promptAudit = { ...recoveredAudit, recovery };
        appendTraceEvent(trace, {
          type: 'prompt_audit_recovery',
          role,
          turn: tutorTurn,
          repairAttempt,
          recovery,
          audit: promptAudit,
        });
      }
      if (!promptAudit.ok) {
        appendTraceEvent(trace, {
          type: 'prompt_audit_failed',
          role,
          turn: tutorTurn,
          repairAttempt,
          audit: promptAudit,
        });
        const error = new Error(
          `Tutor prompt audit failed: ${promptAudit.violations.map((violation) => violation.code).join(', ')}${
            promptAudit.duplicateInstructionLines?.length
              ? `; repeated instruction: ${promptAudit.duplicateInstructionLines[0].line}`
              : ''
          }`,
        );
        error.code = 'TUTOR_PROMPT_AUDIT_FAILED';
        error.promptAudit = promptAudit;
        throw error;
      }
      const request = {
        systemPrompt: attemptSystemPrompt,
        messages: [...context, { role: 'user', content: effectiveAttemptUserPrompt }],
        config: {
          temperature,
          maxTokens,
          historyTurns,
          leakGuard: leakGuardEnabled,
          scaffoldGuard: scaffoldGuardEnabled,
          questionSupportGuard: questionSupportGuardEnabled,
          actorialRealizationGuard: actorialRealizationGuardEnabled,
          responseCompositionGuard: responseCompositionGuardEnabled,
          repetitionGuard: repetitionGuardEnabled,
          closureGuard: closureGuardEnabled,
          repairAttempt,
          messageHistoryMode: messageContext.historyMode,
          availableMessageCount: messageContext.availableMessageCount,
          replayedMessageCount: messageContext.replayedMessageCount,
          replayedUserMessageCount: messageContext.userMessageCount,
          replayedAssistantMessageCount: messageContext.assistantMessageCount,
          contextActivatedBy: messageContext.activatedBy,
          firstDraftContractSchema: firstDraftContract?.schema || null,
          firstDraftCompatibilityDecisions: firstDraftContract?.compatibility?.decisions || [],
          passthrough,
          promptAudit,
          speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
        },
      };
      if (cliEffort) request.config.cliEffort = cliEffort;
      const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
      reserveProgram2ProviderBudget({ maxTokens, trace, role, turn: tutorTurn });
      reserveTutorStubMeteredModelCall({ trace, role, turn: tutorTurn });
      let response;
      if (isCliProvider(resolved.provider)) {
        const result = await callAIWithCliBridge(
          { provider: resolved.provider, model: resolved.model },
          attemptSystemPrompt,
          effectiveAttemptUserPrompt,
          role,
          { messageHistory: context, effort: cliEffort, signal },
        );
        response = {
          text: result.text,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          usage: {
            inputTokens: result.inputTokens || 0,
            outputTokens: result.outputTokens || 0,
            totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
            cost: result.cost || 0,
          },
          effort: result.effort || result.reasoningEffort || null,
          reasoningEffort: result.reasoningEffort || result.effort || null,
          tokenUsageAvailable: result.tokenUsageAvailable,
        };
      } else if (useStreamingApi) {
        const sink = streamMode === 'live' ? createConsoleTokenSink(role, stream?.interim) : null;
        let final = null;
        for await (const chunk of streamAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: attemptSystemPrompt,
          messages: request.messages,
          preset: 'socratic',
          config: { temperature, maxTokens },
        })) {
          if (chunk.type === 'text_delta') {
            if (sink) sink.write(chunk.content);
          } else if (chunk.type === 'done') {
            final = chunk;
          }
        }
        const streamed = sink ? sink.finish() : false;
        response = {
          text: final?.content || '',
          provider: final?.provider || resolved.provider,
          model: final?.model || resolved.model,
          latencyMs: final?.latencyMs || 0,
          usage: final?.usage || null,
          streamed,
          generatedWithStreaming: true,
          bufferedStream: streamMode === 'buffered',
        };
      } else {
        const result = await callAI({
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: attemptSystemPrompt,
          messages: request.messages,
          preset: 'socratic',
          config: { temperature, maxTokens },
        });
        response = {
          text: result.content,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          usage: result.usage,
        };
      }

      response.guardCallId = `${tutorTurn}:${++tutorModelCallSequence}`;
      response.guardRole = role;
      response.firstDraftContract = firstDraftContract ? jsonClone(firstDraftContract) : null;
      response.promptSnapshot = {
        systemPrompt: attemptSystemPrompt,
        userPrompt: effectiveAttemptUserPrompt,
        messageHistory: context,
        role,
        repairAttempt,
        config: request.config,
        promptAudit,
        speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
        firstDraftContract: response.firstDraftContract,
      };
      appendTraceEvent(trace, {
        type: 'model_call',
        role,
        turn: tutorTurn,
        startedAt,
        provider: response.provider,
        model: response.model,
        request,
        response: {
          text: response.text,
          latencyMs: response.latencyMs,
          usage: response.usage,
          tokenUsageAvailable: response.tokenUsageAvailable,
          streamed: Boolean(response.streamed),
          effort: response.effort || response.reasoningEffort || null,
        },
      });
      return response;
    }

    function auditTutorDraft(response, { role, attempt, auditConfiguration = speakingResponseConfiguration }) {
      let responseCompositionAudit = responseCompositionGuardEnabled
        ? auditTutorStubResponseComposition({
            text: response.text,
            frame: responseCompositionFrame,
            learnerText,
            firstDraftContract,
          })
        : { ok: true, active: false, issues: [], segments: null };
      const composedText = formatTutorStubResponseComposition(responseCompositionAudit);
      if (responseCompositionAudit.ok && composedText) {
        response.text = composedText;
        responseCompositionAudit = auditTutorStubResponseComposition({
          text: response.text,
          frame: responseCompositionFrame,
          learnerText,
          firstDraftContract,
        });
      }
      response.responseComposition = responseCompositionAudit.segments || null;
      response.responseCompositionFrame = responseCompositionFrame;
      response.responseCompositionAudit = responseCompositionAudit;
      const liveTurnProgressionAudit =
        firstDraftContract?.progression?.complete === true
          ? auditTutorStubLiveTurnProgressionV1({
              contract: firstDraftContract.progression,
              text: response.text,
              responseComposition: responseCompositionAudit,
              authoredSourceTexts: (firstDraftContract.evidence?.sources || []).map((source) => source?.text),
            })
          : {
              schema: 'machinespirits.tutor-stub.live-turn-progression-audit.v1',
              active: false,
              ok: true,
              scope: 'whole_response_terminal_boundary',
              slot_ownership_inferred: false,
              issues: [],
            };
      const liveSourceActionAlignmentAudit = firstDraftContract
        ? auditTutorStubLiveSourceActionAlignmentV1({
            text: response.text,
            firstDraftContract,
          })
        : {
            schema: 'machinespirits.tutor-stub.live-source-action-alignment-audit.v1',
            active: false,
            ok: true,
            scope: 'exact_source_occurrence_and_nearest_pre_source_host_boundary',
            slot_ownership_inferred: false,
            issues: [],
          };
      const leakAudit = leakGuardEnabled
        ? auditTutorResponseLeak({
            text: response.text,
            world,
            tutorTurn,
            learnerText,
            state,
            publicPremiseIds: speakerPublicPremiseIds,
          })
        : { ok: true, leaks: [] };
      const scaffoldAudit = scaffoldGuardEnabled
        ? auditTutorStubGenerousInferenceResponse({
            text: response.text,
            resolution: humanDiscourseFrame.generousInference,
          })
        : { ok: true, issues: [], similarity: 0 };
      const questionSupportAudit = questionSupportGuardEnabled
        ? auditTutorStubQuestionSupportResponse({
            text: response.text,
            support: humanDiscourseFrame.questionSupport,
          })
        : { ok: true, issues: [] };
      const dramaticReleaseAudit = dramaticReleaseGuardEnabled
        ? auditTutorStubDramaticReleaseResponse({
            text: response.text,
            frame: dramaticReleaseFrame,
            sourceAccessibilityAudit: liveSourceActionAlignmentAudit,
          })
        : { ok: true, active: false, issues: [] };
      const releaseDeliveryAudit = auditTutorStubReleaseDelivery({
        text: response.text,
        world,
        premiseIds: dramaticReleaseFrame.entries.map((entry) => entry.premise).filter(Boolean),
      });
      const liveConfigurationSurface = tutorStubLiveResponseConfigurationSurface({
        text: response.text,
        liveSourceActionAlignmentAudit,
      });
      const responseConfigurationAudit = actorialRealizationGuardEnabled
        ? auditTutorStubResponseConfiguration({
            text: liveConfigurationSurface.text,
            configuration: auditConfiguration,
            world,
            composition: response.responseComposition,
            performanceObligationContract,
          })
        : null;
      if (responseConfigurationAudit) {
        responseConfigurationAudit.live_source_axis_ownership = {
          active: liveConfigurationSurface.active,
          reason: liveConfigurationSurface.reason,
          excluded_spans: liveConfigurationSurface.excluded_spans,
        };
      }
      const actorialRealizationAudit = responseConfigurationAudit?.actorial_realization || {
        ok: true,
        issues: [],
        active: false,
      };
      response.deliveryResponseConfiguration = jsonClone(auditConfiguration || null);
      response.responseConfigurationTransition = jsonClone(
        auditConfiguration?.recovery_transition || auditConfiguration?.speaking_transition || null,
      );
      const repetitionAudit = repetitionGuardEnabled
        ? auditTutorStubRepetitionResponse({
            text: response.text,
            recentTutorTexts,
            // The closing act is licensed to work in the vocabulary already on the
            // table. A turn owed an exhibit is not: a real exhibit is new words
            // and carries itself past the floor.
            advance: { terminal: Boolean(dialogueClosureFrame?.mandatory) },
          })
        : { ok: true, issues: [], maxSimilarity: 0 };
      const closureAudit = closureGuardEnabled
        ? auditTutorStubDialogueClosureResponse({ text: response.text, frame: dialogueClosureFrame })
        : { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
      if (leakGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_response_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: leakAudit.ok,
          leaks: leakAudit.leaks,
          publicPremiseIds: [...speakerPublicPremiseIds],
          duePremiseIds: dramaticReleaseFrame.entries.map((entry) => entry.premise).filter(Boolean),
        });
      }
      if (scaffoldGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_human_scaffold_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: scaffoldAudit.ok,
          issues: scaffoldAudit.issues,
          similarity: scaffoldAudit.similarity,
          generousInference: humanDiscourseFrame.generousInference,
        });
      }
      if (questionSupportGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_question_support_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: questionSupportAudit.ok,
          issues: questionSupportAudit.issues,
          support: humanDiscourseFrame.questionSupport,
        });
      }
      if (dramaticReleaseGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_dramatic_release_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: dramaticReleaseAudit.ok,
          issues: dramaticReleaseAudit.issues,
          frame: dramaticReleaseFrame,
        });
      }
      if (actorialRealizationGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_actorial_realization_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: actorialRealizationAudit.ok,
          issues: actorialRealizationAudit.issues,
          selectedPart: auditConfiguration?.actorial_part,
          selectedPartLabel: auditConfiguration?.actorial_part_label,
          selectedPerformance: auditConfiguration?.actorial_performance,
          originallySelectedPart: responseConfiguration?.actorial_part,
          responseConfigurationTransition: response.responseConfigurationTransition,
          responseConfigurationAudit,
        });
      }
      if (responseCompositionGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_response_composition_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: responseCompositionAudit.ok,
          issues: responseCompositionAudit.issues,
          frame: responseCompositionFrame,
          segments: responseCompositionAudit.segments,
        });
      }
      if (firstDraftContract) {
        appendTraceEvent(trace, {
          type: 'tutor_live_turn_progression_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: liveTurnProgressionAudit.ok,
          active: liveTurnProgressionAudit.active,
          scope: liveTurnProgressionAudit.scope,
          slotOwnershipInferred: liveTurnProgressionAudit.slot_ownership_inferred,
          issues: liveTurnProgressionAudit.issues,
          audit: liveTurnProgressionAudit,
        });
        appendTraceEvent(trace, {
          type: 'tutor_live_source_action_alignment_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: liveSourceActionAlignmentAudit.ok,
          active: liveSourceActionAlignmentAudit.active,
          scope: liveSourceActionAlignmentAudit.scope,
          slotOwnershipInferred: liveSourceActionAlignmentAudit.slot_ownership_inferred,
          issues: liveSourceActionAlignmentAudit.issues,
          directAccessible: liveSourceActionAlignmentAudit.direct_accessible,
          compensationRequired: liveSourceActionAlignmentAudit.compensation_required,
          compensationContractReady: liveSourceActionAlignmentAudit.compensation_contract_ready,
          compensationVisible: liveSourceActionAlignmentAudit.compensation_visible,
          effectiveMode: liveSourceActionAlignmentAudit.effective_mode,
          sourceAccessibility: liveSourceActionAlignmentAudit.source_accessibility,
          audit: liveSourceActionAlignmentAudit,
        });
      }
      if (repetitionGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_repetition_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: repetitionAudit.ok,
          issues: repetitionAudit.issues,
          maxSimilarity: repetitionAudit.maxSimilarity,
          // Both channels, and the reason the second one stood down. Without the
          // skip reason a silent advance channel is indistinguishable from one
          // that never ran, which is exactly the ambiguity on the bare arm.
          novelty: repetitionAudit.novelty ?? null,
          advanceSkipped: repetitionAudit.advanceSkipped ?? null,
        });
      }
      if (closureGuardEnabled) {
        appendTraceEvent(trace, {
          type: 'tutor_dialogue_closure_audit',
          role,
          turn: tutorTurn,
          attempt,
          ok: closureAudit.ok,
          closesDialogue: closureAudit.closesDialogue,
          invitesCheckIn: closureAudit.invitesCheckIn,
          issues: closureAudit.issues,
          frame: dialogueClosureFrame,
        });
      }
      return {
        ok:
          leakAudit.ok &&
          scaffoldAudit.ok &&
          questionSupportAudit.ok &&
          dramaticReleaseAudit.ok &&
          releaseDeliveryAudit.ok &&
          actorialRealizationAudit.ok &&
          responseCompositionAudit.ok &&
          liveTurnProgressionAudit.ok &&
          liveSourceActionAlignmentAudit.ok &&
          repetitionAudit.ok &&
          closureAudit.ok,
        leakAudit,
        scaffoldAudit,
        questionSupportAudit,
        dramaticReleaseAudit,
        releaseDeliveryAudit,
        actorialRealizationAudit,
        responseConfigurationAudit,
        responseCompositionAudit,
        liveTurnProgressionAudit,
        liveSourceActionAlignmentAudit,
        repetitionAudit,
        closureAudit,
      };
    }

    function preservableTutorUptake(audits) {
      if (
        (audits?.liveTurnProgressionAudit?.issues || []).some((issue) => issue.type === 'learner_uptake_not_realized')
      ) {
        return '';
      }
      if (
        (audits?.responseCompositionAudit?.issues || []).some((issue) =>
          ['missing_learner_uptake', 'generic_learner_uptake', 'verbatim_learner_echo'].includes(issue.type),
        )
      ) {
        return '';
      }
      const uptake = String(audits?.responseCompositionAudit?.segments?.uptake || '').trim();
      if (!uptake) return '';
      if (
        /\?/u.test(uptake) ||
        /^(?:what|which|who|whose|where|when|why|how|can|could|do|does|did|is|are|was|were|have|has|had|may|might|shall|should|will|would)\b/iu.test(
          uptake,
        )
      ) {
        return '';
      }
      if (/^(?:correct|exactly(?: so)?|fair|good|just so|right|yes)[.!]?$/iu.test(uptake)) return '';
      // A safe opening is not worth preserving when it is the very repetition
      // that caused this draft to be rejected. Let the deterministic uptake
      // selector choose a fresh acknowledgement for the repair/fallback.
      if (!auditTutorStubRepetitionResponse({ text: uptake, recentTutorTexts }).ok) return '';
      if (dramaticReleaseFrame?.active) {
        const duePremiseIds = dramaticReleaseFrame.entries.map((entry) => entry?.premise).filter(Boolean);
        const uptakeDeliveryAudit = auditTutorStubReleaseDelivery({
          text: uptake,
          world,
          premiseIds: duePremiseIds,
        });
        if (uptakeDeliveryAudit.deliveredPremises.length) return '';
        const uptakeReleaseAudit = auditTutorStubDramaticReleaseResponse({ text: uptake, frame: dramaticReleaseFrame });
        if (
          uptakeReleaseAudit.entranceVisible ||
          uptakeReleaseAudit.enactmentVisible ||
          uptakeReleaseAudit.exhibitHandoffVisible
        ) {
          return '';
        }
      }
      if (!leakGuardEnabled) return uptake;
      const uptakeLeakAudit = auditTutorResponseLeak({
        text: uptake,
        world,
        tutorTurn,
        learnerText,
        state,
        publicPremiseIds: speakerPublicPremiseIds,
      });
      return uptakeLeakAudit.ok ? uptake : '';
    }

    function ensureFallbackComposition(text, uptake) {
      const candidate = composeTutorStubFallbackWithUptake({ text, uptake });
      const baseAudit = auditTutorStubResponseComposition({
        text: candidate,
        frame: responseCompositionFrame,
        learnerText,
        firstDraftContract,
      });
      return baseAudit.ok ? formatTutorStubResponseComposition(baseAudit) || candidate : candidate;
    }

    function withTutorDeliveryDecision(
      audits,
      { allowActorialAdvisory = false, advisoryReason = null, role, attempt, terminalFallback = false } = {},
    ) {
      const deliveryDecision = tutorStubGuardDeliveryDecision(tutorStubGuardIssueRows(audits), {
        allowActorialAdvisory,
        boundaryPolicy: guardBoundaryPolicy,
        terminalFallback,
      });
      // Q3 corrupt relief: at a deliberately-corrupted learner turn the
      // experiment needs the MODEL's repair, not the composer's template —
      // so every remaining hard issue is demoted to advisory for this one
      // turn. Issues (including leaks) stay fully traced, just not blocked.
      const corruptRelief =
        !deliveryDecision.ok &&
        typeof dependencies.corruptReliefTurn === 'function' &&
        dependencies.corruptReliefTurn(tutorTurn);
      if (corruptRelief) {
        appendTraceEvent(trace, {
          type: 'tutor_corrupt_relief',
          role,
          turn: tutorTurn,
          attempt,
          demotedHardIssues: deliveryDecision.hardIssues || [],
        });
      }
      const result = {
        ...audits,
        deliveryOk: corruptRelief ? true : deliveryDecision.ok,
        deliveryDecision: corruptRelief
          ? {
              ...deliveryDecision,
              ok: true,
              corruptRelief: true,
              advisoryIssues: [...(deliveryDecision.advisoryIssues || []), ...(deliveryDecision.hardIssues || [])],
              hardIssues: [],
            }
          : deliveryDecision,
      };
      if (deliveryDecision.ok && deliveryDecision.advisoryIssues.length) {
        appendTraceEvent(trace, {
          type: 'tutor_response_delivery_advisory',
          role,
          turn: tutorTurn,
          attempt,
          accepted: true,
          advisoryIssues: deliveryDecision.advisoryIssues,
          reason: advisoryReason || 'optional actorial realization did not outweigh the passing hard response checks',
        });
      }
      return result;
    }

    function attachTutorDraftAudits(response, audits) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.questionSupportAudit = audits.questionSupportAudit;
      response.dramaticReleaseAudit = audits.dramaticReleaseAudit;
      response.releaseDeliveryAudit = audits.releaseDeliveryAudit;
      response.actorialRealizationAudit = audits.actorialRealizationAudit;
      response.liveTurnProgressionAudit = audits.liveTurnProgressionAudit;
      response.liveSourceActionAlignmentAudit = audits.liveSourceActionAlignmentAudit;
      response.repetitionAudit = audits.repetitionAudit;
      response.closureAudit = audits.closureAudit;
      response.deliveryDecision = audits.deliveryDecision || null;
      return response;
    }

    function tutorResponseFromSimplifiedRecovery(recoveryResponse, text, candidateKind) {
      return {
        ...recoveryResponse,
        text,
        recoveryCandidateKind: candidateKind,
        recoveryStrategy: {
          schema: 'machinespirits.tutor-stub.guard-recovery.v1',
          parseMode: 'single_plain_text',
          parsed: Boolean(String(text || '').trim()),
          error: String(text || '').trim() ? null : 'empty simplified recovery candidate',
        },
      };
    }

    if (firstDraftContract) {
      appendTraceEvent(trace, {
        type: 'tutor_first_draft_contract',
        turn: tutorTurn,
        contract: firstDraftContract,
        publicTranscriptChanged: false,
      });
    }

    // Program-2 Phase 5 committee first draft
    // (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §2): at warrant_skip
    // moments in the committee arm, the local mini writes the reply, the
    // frontier composes the turn around the mini's question span verbatim, and
    // the fail-closed battery decides which text becomes the first draft. The
    // chosen draft then passes through the standard guard/repair pipeline
    // below, identical to every other arm.
    async function invokeCommitteeFirstDraft() {
      const momentTurn = state.pointOfAction.current;
      const activation = tutorStubPointOfActionTargetText('warrant_skip');
      const miniUserPrompt = `${effectiveSpeakerUserPrompt}\n\n${activation}`;
      const miniStartedAt = new Date().toISOString();
      let miniText = '';
      let miniLatencyMs = 0;
      let miniError = null;
      reserveTutorStubMeteredModelCall({ trace, role: `${roleBase}_committee_mini`, turn: tutorTurn });
      try {
        const mini = await committeeMiniGenerate({
          url: state.committee.ollamaUrl,
          model: state.committee.miniModel,
          systemPrompt: effectiveSpeakerSystemPrompt,
          messages: [...context, { role: 'user', content: miniUserPrompt }],
          numCtx: state.committee.numCtx,
          maxTokens,
          timeoutMs: state.committee.timeoutMs,
        });
        miniText = String(mini.text || '').trim();
        miniLatencyMs = mini.latencyMs;
      } catch (err) {
        miniError = String(err?.message || err).slice(0, 300);
      }
      appendTraceEvent(trace, {
        type: 'model_call',
        role: `${roleBase}_committee_mini`,
        turn: tutorTurn,
        startedAt: miniStartedAt,
        provider: 'ollama',
        model: state.committee.miniModel,
        request: {
          systemPrompt: effectiveSpeakerSystemPrompt,
          messages: [...context, { role: 'user', content: miniUserPrompt }],
          config: { temperature: 0, numCtx: state.committee.numCtx, maxTokens, think: false },
        },
        response: { text: miniText, latencyMs: miniLatencyMs, error: miniError },
      });
      const miniResponseEnvelope = (deliveredText = miniText) => ({
        text: deliveredText,
        provider: 'ollama',
        model: state.committee.miniModel,
        latencyMs: miniLatencyMs,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
        tokenUsageAvailable: false,
        guardCallId: `${tutorTurn}:${++tutorModelCallSequence}`,
        guardRole: roleBase,
        firstDraftContract: firstDraftContract ? jsonClone(firstDraftContract) : null,
        promptSnapshot: {
          systemPrompt: effectiveSpeakerSystemPrompt,
          userPrompt: miniUserPrompt,
          messageHistory: context,
          role: `${roleBase}_committee_mini`,
          repairAttempt: 0,
          config: { temperature: 0, maxTokens, committee: true },
          promptAudit: null,
          speakerPrivilegeAudit: speakerPrivilegeAudit,
        },
      });
      // Phase 5b fallback resolution
      // (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §2): under
      // policy v2 the fallback text must pass the same one-question + cue
      // battery — greedy first, then up to two resamples at the frozen
      // sampled temperature, then the cue-preserving trim. Policy v1 ships
      // the greedy reply unchecked (the Phase 5 behavior).
      async function resolveCommitteeFallbackEnvelope() {
        const fallback = { policy: state.committee.fallbackPolicy || 'v1', resolution: 'v1_unchecked', resamples: 0 };
        let deliveredText = miniText;
        if (fallback.policy === 'v2') {
          if (committeeFallbackBatteryPass(miniText)) {
            fallback.resolution = 'selected_greedy';
          } else {
            let selected = null;
            for (let attempt = 1; attempt <= 2 && !selected; attempt += 1) {
              fallback.resamples = attempt;
              reserveTutorStubMeteredModelCall({
                trace,
                role: `${roleBase}_committee_mini_resample`,
                turn: tutorTurn,
              });
              try {
                const resampleStartedAt = new Date().toISOString();
                const sample = await committeeMiniGenerate({
                  url: state.committee.ollamaUrl,
                  model: state.committee.miniModel,
                  systemPrompt: effectiveSpeakerSystemPrompt,
                  messages: [...context, { role: 'user', content: miniUserPrompt }],
                  numCtx: state.committee.numCtx,
                  maxTokens,
                  timeoutMs: state.committee.timeoutMs,
                  temperature: 0.35,
                });
                const sampleText = String(sample.text || '').trim();
                appendTraceEvent(trace, {
                  type: 'model_call',
                  role: `${roleBase}_committee_mini_resample`,
                  turn: tutorTurn,
                  startedAt: resampleStartedAt,
                  provider: 'ollama',
                  model: state.committee.miniModel,
                  request: { config: { temperature: 0.35, resample: attempt } },
                  response: { text: sampleText, latencyMs: sample.latencyMs },
                });
                if (committeeFallbackBatteryPass(sampleText)) selected = sampleText;
              } catch (err) {
                appendTraceEvent(trace, {
                  type: 'program2_committee_resample_error',
                  turn: tutorTurn,
                  attempt,
                  error: String(err?.message || err).slice(0, 200),
                });
                break;
              }
            }
            if (selected) {
              fallback.resolution = `selected_sampled_${fallback.resamples}`;
              deliveredText = selected;
            } else {
              const trimmed = trimCommitteeFallback(miniText);
              fallback.resolution = trimmed.changed ? 'trimmed' : 'unchanged';
              deliveredText = trimmed.text;
            }
          }
        }
        moment.fallback = fallback;
        moment.deliveredFallbackText = deliveredText === miniText ? null : deliveredText;
        return miniResponseEnvelope(deliveredText);
      }
      const moment = {
        schema: PROGRAM2_COMMITTEE_SCHEMA,
        turn: tutorTurn,
        trigger: momentTurn.assigned_trigger,
        miniModel: state.committee.miniModel,
        miniLatencyMs,
        miniError,
        miniText,
        span: null,
        spanSentenceCount: 0,
        composedText: null,
        composerLatencyMs: null,
        composerError: null,
        battery: null,
        source: null,
      };
      let chosen;
      if (miniError || !miniText) {
        moment.source = 'frontier_mini_unavailable';
        chosen = await invokeTutorAttempt({
          attemptUserPrompt: effectiveSpeakerUserPrompt,
          role: roleBase,
          streamMode: tutorStreamMode,
          repairAttempt: 0,
        });
      } else {
        const spanSelection = selectCommitteeCompositionQuestion(miniText);
        moment.spanSentenceCount = spanSelection.questions.length;
        moment.spanSelection = spanSelection;
        if (!spanSelection.eligible) {
          moment.source = spanSelection.questions.length ? 'fallback_question_lacks_cue' : 'fallback_no_span';
          chosen = await resolveCommitteeFallbackEnvelope();
        } else {
          const span = spanSelection.selected;
          moment.span = span;
          const compositionBlock = buildCommitteeCompositionBlock(span);
          try {
            const composer = await invokeTutorAttempt({
              attemptUserPrompt: `${effectiveSpeakerUserPrompt}\n\n${compositionBlock}`,
              role: `${roleBase}_committee_composer`,
              streamMode: 'none',
              repairAttempt: 0,
              instructionTextsOverride: [...effectiveSpeakerInstructionTexts, compositionBlock],
            });
            moment.composedText = composer.text;
            moment.composerLatencyMs = composer.latencyMs;
            const battery = runCommitteeBattery({ composedText: composer.text, span });
            moment.battery = battery;
            if (battery.pass) {
              moment.source = 'composed';
              chosen = composer;
              chosen.guardRole = roleBase;
            } else {
              moment.source =
                battery.failedCheck === 'span_contained'
                  ? 'fallback_span_lost'
                  : battery.failedCheck === 'exactly_one_question'
                    ? 'fallback_multi_question'
                    : 'fallback_empty';
              chosen = await resolveCommitteeFallbackEnvelope();
            }
          } catch (err) {
            moment.composerError = String(err?.message || err).slice(0, 300);
            moment.source = 'fallback_error';
            chosen = await resolveCommitteeFallbackEnvelope();
          }
        }
      }
      appendTraceEvent(trace, {
        type: 'program2_committee_moment',
        turn: tutorTurn,
        moment,
      });
      chosen.committeeMoment = moment;
      return chosen;
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
