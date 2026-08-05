export function createTutorStubTutorTerminalRuntime(dependencies = {}) {
  const {
    appendTraceEvent,
    attachTutorGuardAccounting,
    auditTutorStubDialogueClosureResponse,
    auditTutorStubQuestionSupportResponse,
    buildTutorGuardAccounting,
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
    stateRunDebugId,
    tutorGuardAttemptEnvelope,
    tutorStubActorialPerformanceMayBeAdvisory,
    tutorStubGuardIssueRows,
    tutorStubLearnerSelectedToolMarkPath,
    tutorStubSubstantiveLearnerEcho,
    tutorStubTerminalFallbackFailureMessage,
    worldLedgerTerm,
  } = dependencies;

  return function runTutorTerminalDelivery({
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
  }) {
    // A release-only failure may preserve the model draft by replacing its
    // clue span with the exact rendered source. Every other failure family,
    // and any failed insertion audit, proceeds to the terminal fallback.
    if (
      dependencies.clueInsertion &&
      response?.text &&
      (audits.deliveryDecision?.hardIssues || []).length > 0 &&
      audits.deliveryDecision.hardIssues.every(
        (issue) =>
          issue.guard === 'dramatic_release' ||
          issue.guard === 'release_delivery' ||
          (issue.guard === 'live_source_action_alignment_v1' && String(issue.type || '').startsWith('due_source_')),
      )
    ) {
      const dueRowsRaw = dramaticReleaseFrame?.entries?.length
        ? dramaticReleaseFrame.entries
        : currentReleaseRows(state, tutorTurn) || [];
      const dueRows = dueRowsRaw.map((entry) =>
        entry?.presentation?.mode && !entry?.mode
          ? { ...entry, mode: entry.presentation.mode, role: entry.presentation.role ?? entry.role }
          : entry,
      );
      const clueSentences = dueRows
        .map((entry, index) => dependencies.renderTutorStubDueSource(entry, index)?.text || '')
        .filter(Boolean);
      if (clueSentences.length) {
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
            : (insertionAudits.liveSourceActionAlignmentAudit?.pre_source_boundaries || []).map((boundary) => ({
                source: boundary.source,
                ok: boundary.alignment_ok,
                host: boundary.audited_host_text,
                required: (boundary.sources || []).flatMap((source) =>
                  (source.required || []).map((requirement) => requirement.label),
                ),
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
      firstDraftContract?.opening?.writable_entry_requested === true && !/^Write:\s*[“"]/u.test(candidateFallbackUptake)
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
    if (canStreamTutor) fallback.guardedStreamReplay = true;
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
  };
}
