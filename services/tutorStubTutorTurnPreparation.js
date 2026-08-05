/**
 * The measured advisory blocks the pipeline can gate out of the speaking
 * prompt. Ids match the A/B feature registry; blocks outside this list are
 * never gated.
 */
export const TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS = Object.freeze([
  'context_continuity',
  'evidence_window',
  'learner_classifier',
  'learner_dag',
  'human_scaffold',
  'first_draft_contract',
  // Control arm, not instrumentation: the A/B bench's fixed generic plan
  // (length-and-shape control for the contract), live so outcome contrasts
  // can run it as a version. Off by default; `all` includes it by
  // construction and the trace stamp shows it either way.
  'empty_plan',
]);

/**
 * Builds the public replay, speaking contract, advisory stack, privilege audit,
 * and guard inputs for one tutor turn. It owns prompt preparation while the
 * pipeline owns candidate sequencing and delivery.
 */
export function createTutorStubTutorTurnPreparation(dependencies = {}) {
  const {
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
    emptyPlanAdvisory,
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
  } = dependencies;

  return function prepareTutorStubTutorTurn({
    cardAfterLearner = false,
    cardFinalSlot = false,
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
    speakerAdvisoryBlocks = null,
    state,
    systemPrompt,
    trace,
    tutorFeedback,
    tutorLearnerDagModel,
    world,
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
      cardFinalSlot || cardAfterLearner ? null : state?.mannerSwitch?.card || null,
      // Keep the executable contract nearest the learner line so later analysis
      // advisories cannot bury the actual speaking task. The empty-plan control
      // (the contract's length-and-shape control) occupies the same slot: an
      // outcome-contrast arm requests exactly one of the two. Request-only, so
      // the un-gated legacy path (speakerAdvisoryBlocks === null) never ships
      // a control block into a real dialogue.
      speakerAdvisoryBlocks?.has('empty_plan') ? (emptyPlanAdvisory ?? null) : null,
      withSpeakerBlock('first_draft_contract', firstDraftContractAdvisory),
      cardFinalSlot && !cardAfterLearner ? state?.mannerSwitch?.card || null : null,
    ]
      .filter(Boolean)
      .map((text) => sanitizeTutorStubSpeakerAdvisory({ world: dag ? world : null, tutorTurn, text }));
    const promptParts = [
      ...speakerAdvisoryParts,
      learnerPrompt,
      // Phase S revisit (P1's reading-order finding): the card as the very
      // last thing the model reads, after the learner's line.
      cardAfterLearner ? state?.mannerSwitch?.card || null : null,
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
    return {
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
    };
  };
}
