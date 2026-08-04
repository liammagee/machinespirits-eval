export function createTutorStubTutorCommitteeRuntime(dependencies = {}) {
  const {
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
  } = dependencies;

  return function bindTutorStubTutorCommitteeRuntime({
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
  }) {
    // Program-2 Phase 5 committee first draft
    // (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §2): at warrant_skip
    // moments in the committee arm, the local mini writes the reply, the
    // frontier composes the turn around the mini's question span verbatim, and
    // the fail-closed battery decides which text becomes the first draft. The
    // chosen draft then passes through the standard guard/repair pipeline.
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
        guardCallId: nextTutorGuardCallId(),
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
          speakerPrivilegeAudit,
        },
      });
      // Phase 5b fallback resolution
      // (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §2): under
      // policy v2 the fallback text must pass the same one-question + cue
      // battery — greedy first, then up to two resamples at the frozen
      // sampled temperature, then the cue-preserving trim. Policy v1 ships
      // the greedy reply unchecked (the Phase 5 behavior).
      async function resolveCommitteeFallbackEnvelope({
        spanResult = null,
        composedText = null,
        composerError = null,
        battery = null,
      } = {}) {
        const fallback = { policy: state.committee.fallbackPolicy || 'v1', resolution: 'v1_unchecked', resamples: 0 };
        let deliveredText = miniText;
        if (fallback.policy === 'cue_blind') {
          const ledger = resolveCueBlindCommitteeDelivery({
            miniText,
            spanResult,
            composedText,
            composerError,
            battery,
          });
          fallback.resolution = ledger.fallbackUsed ? 'original_greedy_mini' : 'composer_accepted';
          fallback.failureReason = ledger.failureReason;
          deliveredText = ledger.deliveredText;
          moment.enforcementLedger = ledger;
        } else if (fallback.policy === 'v2') {
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
        spanInterface: state.committee.spanInterface || 'v1',
        span: null,
        spanSentenceCount: 0,
        spanCarriedStatement: false,
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
        const cueBlind = state.committee.fallbackPolicy === 'cue_blind';
        const spanResult = cueBlind
          ? state.committee.spanInterface === 'v2'
            ? extractCuePreservingCommitteeSpanV2(miniText)
            : extractCommitteeSpanV1(miniText)
          : null;
        const spanSelection = cueBlind ? null : selectCommitteeCompositionQuestion(miniText);
        moment.spanSentenceCount = cueBlind ? spanResult.questionCount : spanSelection.questions.length;
        moment.spanCarriedStatement = cueBlind ? spanResult.carriedStatement : false;
        moment.spanSelection = cueBlind ? spanResult : spanSelection;
        const eligible = cueBlind ? spanResult.status === 'ok' : spanSelection.eligible;
        if (!eligible) {
          moment.source = cueBlind
            ? 'fallback_no_span'
            : spanSelection.questions.length
              ? 'fallback_question_lacks_cue'
              : 'fallback_no_span';
          chosen = await resolveCommitteeFallbackEnvelope({ spanResult });
        } else {
          const span = cueBlind ? spanResult.span : spanSelection.selected;
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
            const leakAudit = cueBlind
              ? auditTutorResponseLeak({
                  text: composer.text,
                  world,
                  tutorTurn,
                  learnerText,
                  state,
                  publicPremiseIds: speakerPublicPremiseIds,
                })
              : null;
            const battery = cueBlind
              ? runCueBlindCommitteeBattery({
                  composedText: composer.text,
                  span,
                  publicEvidenceSafe: leakAudit.ok,
                  noNewPremise: leakAudit.ok,
                })
              : runCommitteeBattery({ composedText: composer.text, span });
            moment.battery = battery;
            moment.compositionEvidenceAudit = leakAudit
              ? { ok: leakAudit.ok, leakCount: leakAudit.leaks.length, basis: 'tutor_response_leak_audit' }
              : null;
            if (battery.pass) {
              moment.source = 'composed';
              if (cueBlind) {
                moment.enforcementLedger = resolveCueBlindCommitteeDelivery({
                  miniText,
                  spanResult,
                  composedText: composer.text,
                  battery,
                });
                moment.fallback = {
                  policy: 'cue_blind',
                  resolution: 'composer_accepted',
                  resamples: 0,
                  failureReason: null,
                };
              }
              chosen = composer;
              chosen.guardRole = roleBase;
            } else {
              moment.source =
                battery.failedCheck === 'span_contained'
                  ? 'fallback_span_lost'
                  : battery.failedCheck === 'exactly_one_question'
                    ? 'fallback_multi_question'
                    : 'fallback_empty';
              chosen = await resolveCommitteeFallbackEnvelope({ spanResult, composedText: composer.text, battery });
            }
          } catch (err) {
            moment.composerError = String(err?.message || err).slice(0, 300);
            moment.source = 'fallback_error';
            chosen = await resolveCommitteeFallbackEnvelope({ spanResult, composerError: moment.composerError });
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

    return { invokeCommitteeFirstDraft };
  };
}
