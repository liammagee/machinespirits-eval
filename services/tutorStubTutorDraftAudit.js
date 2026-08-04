/**
 * Owns the complete tutor-draft audit battery and its trace events. The caller
 * retains delivery policy, repair sequencing, and fallback selection.
 */
export function createTutorStubTutorDraftAudit(dependencies = {}) {
  const {
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
  } = dependencies;

  return function bindTutorStubTutorDraftAudit(context = {}) {
    const {
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
    } = context;

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

    return { auditTutorDraft };
  };
}
