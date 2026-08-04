export function createTutorStubTutorRepairRuntime(dependencies = {}) {
  const {
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
    tutorGuardAttemptEnvelope,
    tutorResponseRecoveryPrompt,
    tutorStubDisclosableGuardCorrection,
    tutorStubPlainRecoveryAllowsActorialAdvisory,
    tutorStubSelfCorrectionDisclosurePrompt,
    tutorStubSimplifiedRecoveryPrompt,
    tutorStubSubstantiveLearnerEcho,
  } = dependencies;
  const styleGuardsAdvisory = dependencies.styleGuardsAdvisory === true;

  return async function runTutorRepairLadder({
    response: initialResponse,
    audits: initialAudits,
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
  }) {
    let response = initialResponse;
    let audits = initialAudits;
    const acceptedResponse = ({ candidate, finalSource, finalAudits, outcome }) => ({
      accepted: true,
      response: attachTutorGuardAccounting({
        response: candidate,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource,
        finalAudits,
        outcome,
      }),
    });

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
        triggeredBy: dependencies.tutorStubGuardIssueRows(audits),
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
        return acceptedResponse({
          candidate: hostPartResponse,
          finalSource: 'actorial_part_repair_candidate',
          finalAudits: hostPartAudits,
          outcome: 'guarded_actorial_part_repair_accepted',
        });
      }
    }

    const firstRepairTriggers = dependencies.tutorStubGuardIssueRows(audits);
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
      if (response.bufferedStream) response.guardedStreamReplay = true;
      return acceptedResponse({
        candidate: response,
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
        return acceptedResponse({
          candidate: compositionResponse,
          finalSource: 'composition_repair_candidate',
          finalAudits: compositionAudits,
          outcome: 'guarded_composition_repair_accepted',
        });
      }
    }

    const questionRepairs = [
      {
        kind: 'mechanical_clarification_invitation',
        repairKind: 'missing_clarification_invitation',
        repair: repairTutorStubMissingClarificationInvitation,
      },
      {
        kind: 'mechanical_unanswerable_open_recall_removal',
        repairKind: 'unanswerable_open_recall_removal',
        repair: repairTutorStubUnanswerableOpenRecall,
      },
    ];
    for (const repairStep of questionRepairs) {
      const mechanical = repairStep.repair({
        text: plainRecoveryResponse.text,
        deliveryDecision: plainRecoveryAudits.deliveryDecision,
      });
      if (!mechanical.changed) continue;
      const questionAttempt = attempts.length;
      const questionResponse = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        mechanical.text,
        'question_support_repair_candidate',
      );
      const questionAudits = withTutorDeliveryDecision(
        auditTutorDraft(questionResponse, {
          role: `${roleBase}_question_support_repair`,
          attempt: questionAttempt,
          auditConfiguration: simplifiedRecoveryConfiguration,
        }),
        { role: `${roleBase}_question_support_repair`, attempt: questionAttempt },
      );
      const questionRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, mechanical.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'question_support_repair_candidate',
          attempt: questionAttempt,
          response: questionResponse,
          audits: questionAudits,
          repairedSpans: questionRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: repairStep.kind,
        fromAttempt: 1,
        toAttempt: questionAttempt,
        triggeredBy: dependencies.tutorStubGuardIssueRows(plainRecoveryAudits),
        guardedSpans: attempts[1].guardedSpans,
        repairedSpans: questionRepairSpans,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_question_support_repair`,
        turn: tutorTurn,
        attempt: questionAttempt,
        repairKind: repairStep.repairKind,
        accepted: questionAudits.deliveryOk,
        text: mechanical.text,
      });
      if (questionAudits.deliveryOk) {
        attachTutorDraftAudits(questionResponse, questionAudits);
        questionResponse.repaired = true;
        questionResponse.mechanicalRepair = true;
        if (questionResponse.bufferedStream) questionResponse.guardedStreamReplay = true;
        return acceptedResponse({
          candidate: questionResponse,
          finalSource: 'question_support_repair_candidate',
          finalAudits: questionAudits,
          outcome: 'guarded_question_support_repair_accepted',
        });
      }
    }

    const mechanical = repairTutorStubThirdPersonSourceLeadIn({
      text: plainRecoveryResponse.text,
      dramaticReleaseFrame,
      responseConfiguration: simplifiedRecoveryConfiguration,
    });
    if (mechanical.changed) {
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
          auditConfiguration: simplifiedRecoveryConfiguration,
        }),
        { role: `${roleBase}_source_voice_repair`, attempt: sourceRepairAttempt },
      );
      const sourceRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, mechanical.text);
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
        fromAttempt: 1,
        toAttempt: sourceRepairAttempt,
        triggeredBy: dependencies.tutorStubGuardIssueRows(plainRecoveryAudits),
        guardedSpans: attempts[1].guardedSpans,
        repairedSpans: sourceRepairSpans,
        replacements: mechanical.replacements,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_source_voice_repair`,
        turn: tutorTurn,
        attempt: sourceRepairAttempt,
        repairKind: 'third_person_source_lead_in',
        basedOn: 'plain_recovery_candidate',
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
        return acceptedResponse({
          candidate: sourceResponse,
          finalSource: 'source_voice_repair_candidate',
          finalAudits: sourceAudits,
          outcome: 'guarded_source_voice_repair_accepted',
        });
      }
    }

    const priorDisclosure = detectTutorStubSelfCorrectionDisclosure(recentTutorTexts.at(-1) || '');
    const disclosableCorrection = priorDisclosure.disclosed
      ? { disclosable: false, reason: 'the previous published turn already disclosed a self-correction' }
      : tutorStubDisclosableGuardCorrection({ audits, attempts });
    if (!disclosableCorrection.disclosable && disclosableCorrection.survivedFindings?.length) {
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
          return acceptedResponse({
            candidate: disclosureResponse,
            finalSource: 'self_correction_candidate',
            finalAudits: disclosureAudits,
            outcome: disclosed ? 'guarded_self_correction_disclosed' : 'guarded_self_correction_pass_accepted',
          });
        }
      }
    }

    return {
      accepted: false,
      response,
      audits,
      firstRepairUptake,
      simplifiedRecoveryConfiguration,
    };
  };
}
