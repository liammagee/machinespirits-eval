export function createTutorStubLearnerAnalysisRuntime({
  CLASSIFIER_SYSTEM_PROMPT,
  LEARNER_RECORD_SYSTEM_PROMPT,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  applyLearnerRecordUpdate,
  applyTutorStubComprehensionRequest,
  applyTutorStubConversationalCompletionSelection,
  applyTutorStubDagFactDropout,
  applyTutorStubLearnerAdvanceAssessment,
  appendTraceEvent,
  assertTutorStubTurnAttemptCurrent,
  buildLearnerDag,
  buildLearnerDagSnapshot,
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
  buildTutorStubLearnerAdvance,
  buildTutorStubPublicLearnerAnalysisPrompt,
  callPromptModel,
  classifierWorldContext,
  colors,
  committedReleaseRows,
  compactPublicTranscriptForPrompt,
  detectTutorStubComprehensionRequest,
  displayDiagnosticLabel,
  engagementStancePalettePromptRows,
  engagementStanceSelectionPolicyPrompt,
  evaluatePendingRegisterEfficacy,
  extractTutorStubPublicLearnerAnalysis,
  factSurface,
  factText,
  failedClassification,
  formatEngagementStanceDistribution,
  formatSignedInterimNumber,
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  humanDiscourseExtractionSchema,
  latestTutorMessage,
  learnerDagPreflightForTurn,
  learnerDagPromptSummary,
  learnerPublicEvidenceState,
  normalizeHumanDiscourseExtraction,
  normalizeResponseConfigurationSelection,
  parseClassifierJson,
  printAutomaticTechnicalDetails,
  printLine = console.log,
  printTurnDebugLine,
  printWithConcurrentTerminal,
  projectTutorStubDagMemoryReliability,
  projectTutorStubLearnerClassificationLines,
  projectTutorStubLearnerDagLines,
  projectTutorStubResponseConfigurationLines,
  publicReleaseLedger,
  registerHistoryPromptSummary,
  registerSelectionFromCombinedAnalysis,
  requestTypePromptRows,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  scoreValue,
  startInterimAnimation,
  stopInterimAnimation,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
  tutorStubReleasePacingSnapshot,
  tutorStubReleaseScheduleExhausted,
  tutorStubTurnFeedbackRegisterPrompt,
  updateReleasePacingForLearnerTurn,
}) {
  function buildLearnerClassifierPrompt({ learnerText, state }) {
    const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
      turn: state.turns.length + 1,
    });
    return [
      '# Task',
      '',
      'Classify the learner input before the tutor responds.',
      'Spell out exactly two headline judgments:',
      '1. What the learner has done in this turn.',
      '2. What the learner has done overall across the dialogue so far.',
      comprehensionContext || null,
      '',
      '# Public tutoring context',
      '',
      `Topic: ${state.topic}`,
      classifierWorldContext(state),
      '',
      '# Previous public transcript',
      '',
      compactPublicTranscriptForPrompt(state, state.historyTurns),
      '',
      '# Current learner turn',
      '',
      learnerText,
      '',
      '# Compact pedagogical discourse rubric',
      '',
      'Conceptual engagement score:',
      '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
      '',
      'Epistemic readiness score:',
      '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
      '',
      'Use these controlled labels where possible:',
      '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
      '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
      '- discourse_plane: object, instructional_meta, or mixed. Use instructional_meta when the learner is asking about the tutor’s wording, explanation, or terminology rather than making a claim about the subject matter. A request merely to slow clue pacing remains object-level scaffolding.',
      '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
      '- Use omits_warrant when the learner states a correct public clue and a conclusion but leaves out the bridge that licenses the conclusion. Do not call that links_evidence_to_rule merely because the bridge is easy to infer.',
      '- Use distorts_public_evidence only when the learner misstates, blends, or reassigns an already public clue. Use overleaps_evidence for a premature conclusion or missing warrant without distorted recall.',
      '- Precedence rule: choose distorts_public_evidence, not overleaps_evidence, when the learner says or implies that an earlier/public clue existed when it did not, changes what a public clue said, or blends two public clues into a false remembered detail. This remains true when the distortion also supports a premature conclusion.',
      '- Otherwise choose omits_warrant over links_evidence_to_rule when the bridge is absent; reserve overleaps_evidence for a claim that outruns the currently public evidence, especially a premature culprit or case-closing inference.',
      '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before classifying them. A reply such as "it will be the same" can fully answer a local single-referent question even though it does not repeat the noun.',
      '- Do not label a contextually complete short answer confused, passive, or evidence-free merely because it omits words already supplied by the preceding question. Preserve any genuinely missing warrant as a separate strict-audit issue.',
      '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
      '- agency: passive, complying, attempting, steering, self_correcting',
      '',
      '# Request type registry',
      '',
      'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the tutor engagement stance.',
      requestTypePromptRows(),
      '',
      '# JSON schema',
      '',
      JSON.stringify(
        {
          turn: {
            summary: 'plain-language sentence naming what the learner did in this turn',
            request_type: 'logical request type, not a tutor engagement stance',
            discourse_move: 'one controlled label',
            discourse_plane: 'object, instructional_meta, or mixed',
            evidence_use: 'one controlled label',
            epistemic_stance: 'one controlled label',
            affect: 'brief affect/energy label',
            agency: 'one controlled label',
            scores: {
              conceptual_engagement: { score: 1, reason: 'brief reason' },
              epistemic_readiness: { score: 1, reason: 'brief reason' },
            },
            pedagogical_need: 'what the tutor should attend to immediately',
          },
          overall: {
            summary: 'plain-language sentence naming what the learner has done overall',
            trajectory: 'how their participation is changing or not changing',
            recurring_pattern: 'dominant pattern across turns, or none yet',
            current_state: 'where the learner seems to be now',
            next_best_tutor_move: 'best immediate tutor move based on public evidence only',
          },
        },
        null,
        2,
      ),
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  async function classifyLearnerInput({ learnerText, state, signal = null }) {
    const startedAt = Date.now();
    try {
      const prompt = buildLearnerClassifierPrompt({ learnerText, state });
      const raw = await callPromptModel({
        prompt,
        resolved: state.classifier.resolved,
        systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
        role: 'tutor_stub_learner_classifier',
        maxTokens: 700,
        trace: state.trace,
        stream: state.stream,
        cliEffort: state.cliEffort,
        turn: state.turns.length + 1,
        signal,
      });
      const { parsed, parseError } = parseClassifierJson(raw.text);
      return {
        ...parsed,
        parseError,
        provider: raw.provider,
        model: raw.model,
        latencyMs: raw.latencyMs,
        usage: raw.usage,
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      return failedClassification({
        message: err.message,
        resolved: state.classifier.resolved,
        latencyMs: Date.now() - startedAt,
      });
    }
  }

  function printClassification(classification) {
    if (!classification) return;
    const turn = classification.turn || {};
    const overall = classification.overall || {};
    const presentation = {
      summary: turn.summary || 'No turn summary.',
      requestType: turn.request_type || 'unknown_request',
      discourseMove: turn.discourse_move || 'unknown',
      epistemicStance: turn.epistemic_stance || 'unknown',
      conceptual: scoreValue(turn.scores?.conceptual_engagement),
      readiness: scoreValue(turn.scores?.epistemic_readiness),
      learningPace: turn.learning_pace || '',
      reasoningSpan: turn.reasoning_span || '',
      overallSummary: overall.summary || 'No overall summary.',
      pedagogicalNeed: turn.pedagogical_need || overall.next_best_tutor_move || '',
      warning: classification.error || classification.parseError || '',
    };
    for (const line of projectTutorStubLearnerClassificationLines(presentation, { colors })) printLine(line);
  }

  const applyLearnerAdvanceAssessment = (classification, tutorLearnerDag) =>
    applyTutorStubLearnerAdvanceAssessment(classification, tutorLearnerDag, { scoreValue });

  async function classifyForTurn(learnerText, state, { signal = null } = {}) {
    if (!state.classifier.enabled) return null;
    startInterimAnimation(state, 'classifying learner');
    const classification = await classifyLearnerInput({ learnerText, state, signal });
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => printClassification(classification));
    return classification;
  }

  function ruleText(rule, index) {
    const left = (rule.if || []).map(factText).join(' + ');
    const right = (rule.then || []).map(factText).join(' + ');
    return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
  }

  function buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight = null }) {
    const staged = committedReleaseRows(state, tutorTurn);
    const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn });
    return [
      '# Task',
      '',
      'Extract a conservative public learner-record update from the current learner turn.',
      "This update feeds a tutor-side model of the learner DAG. It is not the learner's private state.",
      comprehensionContext || null,
      '',
      '# Public question',
      state.world.question,
      '',
      '# Public rules',
      ...state.world.rules.map(ruleText),
      '',
      dagPreflight ? '# Deterministic learner-DAG preflight — computed before this model call' : null,
      dagPreflight ? JSON.stringify(dagPreflight, null, 2) : null,
      dagPreflight
        ? 'This constrains possible updates but commits nothing. Extract only what the current learner turn actually expresses; deterministic validation follows this call.'
        : null,
      dagPreflight ? '' : null,
      '# Staged public evidence available at or before this turn',
      staged.length
        ? staged
            .map((row) =>
              [
                `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
                `  surface: ${row.surface}`,
                `  fact: ${JSON.stringify(row.fact)}`,
              ].join('\n'),
            )
            .join('\n')
        : '- none',
      '',
      '# Previous public transcript',
      compactPublicTranscriptForPrompt(state, state.historyTurns),
      '',
      '# Current learner turn',
      learnerText,
      '',
      '# Extraction rules',
      '',
      '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
      '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
      '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
      '- Single-step trial-book rule: if the learner states a warranted conclusion from staged evidence, include both the supporting staged premise ids in adopt and the conclusion fact in derive. Do not require a separate "add it to the book" utterance.',
      '- Multi-premise advance: one learner turn may explicitly use several staged premises and may voice several supported intermediate conclusions. Return every warranted adoption and derivation in the order voiced; do not stop after the first valid proof move.',
      '- A follow-up premise supplied by the learner counts only when it is public and derivable from staged/adopted evidence plus the public rules. Never promote an unstaged story fact merely because it would accelerate the proof.',
      '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply such as "the same" unambiguously answers a single-referent local question, treat the resolved content as learner-voiced; do not require the learner to repeat the noun or name.',
      '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
      '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
      '- human_discourse.proof_status: strict_proof, provisional_scaffold, side_arc, hidden_premise_risk, or unclear.',
      '- human_discourse.provisional_claims: claims the learner is allowed to hold provisionally before the strict proof is complete.',
      '- human_discourse.implied_warrants: inference rules the learner is using in ordinary language without spelling them out.',
      '- human_discourse.missing_warrants: warrants the learner needs before the claim counts as strict proof.',
      '- human_discourse.implied_public_premises: public assumptions suggested by the transcript but not yet stored as strict grounded premises.',
      '- human_discourse.suppressed_or_private_premises: premises the learner seems to rely on that are not public in the staged evidence.',
      '- human_discourse.common_sense_bridges: harmless everyday bridges that can be allowed provisionally but may need repair.',
      '- human_discourse.illicit_hidden_premises: any apparent use of hidden or unstaged story facts.',
      '- human_discourse.proof_debt_candidates: provisional leaps or missing warrants the tutor should keep visible for later repair.',
      '- human_discourse.side_arc: clarification, vocabulary, affective, trust, or off-path requests that should be answered briefly before returning to the proof path.',
      '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: record it as a side arc, but do not adopt premises, derive facts, or assert an answer from the request itself.',
      '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
      '',
      '# JSON schema',
      '',
      JSON.stringify(
        {
          adopt: ['premise_id'],
          retract: ['premise_id'],
          derive: [['predicate', 'arg1', 'arg2']],
          hypothesis: 'short hypothesis or null',
          assert_answer: 'candidate name or null',
          human_discourse: humanDiscourseExtractionSchema(),
          notes: 'brief reason for the extraction',
        },
        null,
        2,
      ),
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  function buildCombinedLearnerAnalysisPrompt({
    learnerText,
    state,
    tutorTurn,
    dagPreflight = null,
    tutorFeedback = null,
  }) {
    const { publicStagedEvidence } = learnerPublicEvidenceState(state, tutorTurn);
    return buildTutorStubPublicLearnerAnalysisPrompt({
      learnerText,
      topic: state.topic,
      world: state.world,
      tutorTurn,
      publicTranscript: compactPublicTranscriptForPrompt(state, state.historyTurns),
      currentTutorText: state.turns.length === 0 ? latestTutorMessage(state) : '',
      historyTurns: state.historyTurns,
      comprehensionContext: tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn }),
      learnerDagEnabled: Boolean(state.dag),
      registerPolicy: state.register?.policy || null,
      registerEnabled: Boolean(state.register?.enabled),
      registerPalette: state.register?.palette || [],
      registerContext: {
        requestTypeRegistryPrompt: requestTypePromptRows(),
        selectionPolicyPrompt: engagementStanceSelectionPolicyPrompt(state),
        palettePrompt: engagementStancePalettePromptRows(state.register?.palette || []),
        priorPublicLearnerDagPrompt: learnerDagPromptSummary(state.learnerDag.lastModel),
        historyPrompt: registerHistoryPromptSummary(state),
        feedbackPrompt: tutorStubTurnFeedbackRegisterPrompt(tutorFeedback),
      },
      publicStagedEvidence,
      dagPreflight,
      promptProfile: state.learnerAnalysisPromptProfile,
      evidenceUseRubric: state.learnerAnalysisEvidenceUseRubric,
    });
  }

  async function extractLearnerRecordUpdate({ learnerText, state, tutorTurn, dagPreflight = null, signal = null }) {
    const raw = await callPromptModel({
      prompt: buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight }),
      resolved: state.learnerDag.resolved,
      systemPrompt: LEARNER_RECORD_SYSTEM_PROMPT,
      role: 'tutor_stub_learner_record',
      maxTokens: 700,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      turn: tutorTurn,
      signal,
    });
    const { parsed, parseError } = parseClassifierJson(raw.text);
    return {
      ...parsed,
      parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
    };
  }

  async function extractCombinedLearnerAnalysis({
    learnerText,
    state,
    tutorTurn,
    role = 'tutor_stub_learner_analysis',
    stream = state.stream,
    dagPreflight = null,
    preflightSource = 'combined_learner_analysis',
    tutorFeedback = null,
    signal = null,
  }) {
    const effectiveDagPreflight =
      dagPreflight || learnerDagPreflightForTurn(state, tutorTurn, { traceSource: preflightSource });
    const prompt = buildCombinedLearnerAnalysisPrompt({
      learnerText,
      state,
      tutorTurn,
      dagPreflight: effectiveDagPreflight,
      tutorFeedback,
    });
    const raw = await extractTutorStubPublicLearnerAnalysis({
      learnerText,
      topic: state.topic,
      world: state.world,
      tutorTurn,
      prompt,
      dagPreflight: effectiveDagPreflight,
      callModel: callPromptModel,
      parseMode: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.INTERACTIVE,
      role,
      maxTokens: Math.max(2500, state.maxTokens || 0),
      modelCallOptions: {
        resolved: state.learnerDag.resolved,
        trace: state.trace,
        stream,
        cliEffort: state.cliEffort,
        signal,
      },
    });
    return { ...raw, dagPreflight: effectiveDagPreflight };
  }

  function classificationFromCombinedAnalysis(raw, state) {
    const parsed = raw?.parsed || {};
    const source =
      parsed.classification ||
      parsed.learner_classification ||
      parsed.classifier ||
      (parsed.turn && parsed.overall ? parsed : null);
    if (!source) {
      return failedClassification({
        message: 'Combined learner analysis did not include a classification object.',
        resolved: state.learnerDag.resolved,
        latencyMs: raw?.latencyMs || 0,
        usage: raw?.usage,
      });
    }
    return {
      ...source,
      parseError: raw.parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
      combined: true,
    };
  }

  function learnerRecordFromCombinedAnalysis(raw) {
    const parsed = raw?.parsed || {};
    const source = parsed.learner_record || parsed.learnerRecord || parsed.public_record || parsed.record || {};
    return {
      ...source,
      parseError: raw.parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
      combined: true,
    };
  }

  function emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight = null) {
    const record = state.learnerDag.record;
    const world = state.world;
    const previousModel = state.learnerDag.lastModel || state.turns?.at(-1)?.tutorLearnerDagModel || null;
    const dagFactDropout = applyTutorStubDagFactDropout({
      dropout: state.learnerDag.dropout,
      board: record.board,
      world,
      turn: tutorTurn,
    });
    const snapshot = buildLearnerDagSnapshot(world, {
      turn: tutorTurn,
      boardFacts: [...record.board.values()],
      validFacts: [...record.board.values()],
      voiced: record.voiced,
      hypotheses: record.hypotheses,
      ledger: publicReleaseLedger(state, tutorTurn),
      source: 'tutor_stub_tutor_learner_dag_model',
    });
    record.snapshots.push(snapshot);
    const learnerDag = buildLearnerDag(record.snapshots, world);
    const proxyDagMemory = buildLearnerProxyDagMemory({
      turn: tutorTurn,
      questionPattern: world.questionPattern,
      rules: world.rules,
      groundedFacts: [...record.board.values()],
      voiced: record.voiced,
      hypotheses: record.hypotheses,
      factSurface: (fact) => factSurface(world, fact),
    });
    const model = buildTutorLearnerDagModel({
      turn: tutorTurn,
      role: 'tutor',
      proxyDagMemory,
      assessment: learnerDag.assessment,
    });
    model.memoryReliability = projectTutorStubDagMemoryReliability(dagFactDropout);
    const advance = buildTutorStubLearnerAdvance({ beforeModel: previousModel, afterModel: model });
    model.learnerAdvance = advance;
    return { model, assessment: learnerDag.assessment, dagFactDropout, advance, preflight: dagPreflight };
  }

  function printTutorLearnerDagModel(result) {
    for (const line of projectTutorStubLearnerDagLines(result, { colors })) printLine(line);
  }

  async function buildTutorLearnerDagForTurn(
    learnerText,
    state,
    { dagPreflight = null, signal = null, isCurrent = null, classification = null } = {},
  ) {
    if (!state.learnerDag.enabled || !state.world) return null;
    const tutorTurn = state.turns.length + 1;
    startInterimAnimation(state, 'modeling learner DAG', { learnerText, tutorTurn });
    try {
      const extractedUpdate = await extractLearnerRecordUpdate({ learnerText, state, tutorTurn, dagPreflight, signal });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
      const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
        update: extractedUpdate,
        discoursePlane,
      });
      const result = applyLearnerRecordUpdate({
        update,
        state,
        tutorTurn,
        learnerText,
        ...learnerPublicEvidenceState(state, tutorTurn),
      });
      result.preflight = dagPreflight;
      state.learnerDag.lastModel = result.model;
      stopInterimAnimation(state);
      printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
      return result;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const empty = emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight);
      const result = {
        model: empty.model,
        assessment: empty.assessment,
        preflight: dagPreflight,
        advance: empty.advance,
        dagFactDropout: empty.dagFactDropout,
        accepted: {
          adopt: [],
          retract: [],
          derive: [],
          hypothesis: null,
          assertAnswer: null,
          humanDiscourse: normalizeHumanDiscourseExtraction(),
        },
        rejected: [],
        extractor: {
          error: err.message,
          provider: state.learnerDag.resolved.provider,
          model: state.learnerDag.resolved.model,
        },
      };
      state.learnerDag.lastModel = result.model;
      stopInterimAnimation(state);
      printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
      return result;
    }
  }

  function updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn, recordTrace = true }) {
    const request = detectTutorStubComprehensionRequest({
      text: learnerText,
      classification,
      source: 'learner_turn',
      turn: tutorTurn,
    });
    const previous = state.comprehension?.lastRequest || null;
    const duplicate = Boolean(
      request.detected &&
      previous &&
      Number(previous.turn) === Number(request.turn) &&
      previous.source === request.source &&
      previous.text === request.text,
    );
    if (request.detected) {
      if (duplicate) {
        if (request.requestType) previous.requestType = request.requestType;
      } else {
        applyTutorStubComprehensionRequest(state.comprehension, request);
      }
      if (recordTrace) {
        appendTraceEvent(state.trace, {
          type: 'comprehension_request',
          turn: tutorTurn,
          source: request.source,
          requestType: request.requestType,
          terms: request.terms,
          generic: request.generic,
          text: request.text,
          deduplicated: duplicate,
          advancesLearnerDag: false,
          state: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
        });
      }
    }
    return {
      request,
      snapshot: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
    };
  }

  function resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag }) {
    const conversationalCompletion = resolveTutorStubConversationalCompletion({
      mode: state?.dagMode || 'strict_dag',
      learnerText,
      previousTutorText: latestTutorMessage(state),
      classification,
      tutorLearnerDag,
    });
    if (tutorLearnerDag) tutorLearnerDag.conversationalCompletion = conversationalCompletion;
    return conversationalCompletion;
  }

  function tutorStubNewEvidenceAvailable(state) {
    return !tutorStubReleaseScheduleExhausted(tutorStubReleasePacingSnapshot(state?.releasePacing, state?.world));
  }

  function applyConversationalCompletionForLearnerTurn(state, registerSelection, conversationalCompletion) {
    const application = applyTutorStubConversationalCompletionSelection(registerSelection, conversationalCompletion, {
      newEvidenceAvailable: tutorStubNewEvidenceAvailable(state),
    });
    if (state.register?.enabled && application.selection) {
      if (state.register.history.at(-1)?.turn === application.selection.turn) {
        state.register.history[state.register.history.length - 1] = application.selection;
      }
      state.register.current = application.selection;
    }
    return application.selection;
  }

  function responseConfigurationPresentation(selection, previousEfficacy = null) {
    const partDistribution = selection?.actorial_part_selection?.distribution
      ? selection.actorial_part_selection.distribution
          .slice(0, 4)
          .map((row) => `${displayDiagnosticLabel(row.part)} ${Math.round(Number(row.probability || 0) * 100)}%`)
          .join(', ')
      : null;
    return {
      previousEfficacy,
      fieldDelta: previousEfficacy
        ? formatSignedInterimNumber(previousEfficacy.field?.delta, { decimals: 3 }) || '0'
        : '0',
      selection,
      distribution: selection ? formatEngagementStanceDistribution(selection.distribution) : '',
      partDistribution,
    };
  }

  function printResponseConfigurationSelection(selection, previousEfficacy = null) {
    for (const line of projectTutorStubResponseConfigurationLines(
      responseConfigurationPresentation(selection, previousEfficacy),
      { colors },
    )) {
      printLine(line);
    }
  }

  async function analyzeLearnerTurnCombined(
    learnerText,
    state,
    { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
  ) {
    const tutorTurn = state.turns.length + 1;
    const startedAt = Date.now();
    updateComprehensionForLearnerTurn({
      learnerText,
      state,
      classification: null,
      tutorTurn,
      recordTrace: false,
    });
    startInterimAnimation(state, 'analyzing learner', { learnerText, tutorTurn });
    let raw = precomputedRaw?.dagPreflight ? precomputedRaw : null;
    if (precomputedRaw && !precomputedRaw.dagPreflight) {
      appendTraceEvent(state.trace, {
        type: 'learner_dag_preflight_cache_rejected',
        turn: tutorTurn,
        reason: 'missing_pre_model_preflight',
      });
    }

    try {
      raw = raw || (await extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn, tutorFeedback, signal }));
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      const classification = classificationFromCombinedAnalysis(raw, state);
      const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
      const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
        update: learnerRecordFromCombinedAnalysis(raw),
        discoursePlane,
      });
      const tutorLearnerDag = applyLearnerRecordUpdate({
        update,
        state,
        tutorTurn,
        learnerText,
        ...learnerPublicEvidenceState(state, tutorTurn),
      });
      tutorLearnerDag.preflight = raw.dagPreflight || null;
      applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
      resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
      state.learnerDag.lastModel = tutorLearnerDag.model;
      updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
      updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
      const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
        state,
        tutorLearnerDag,
        classification,
        tutorFeedback,
      );
      let registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
        state,
        classification,
        tutorLearnerDag,
        raw,
        learnerText,
      });
      registerSelection = applyConversationalCompletionForLearnerTurn(
        state,
        registerSelection,
        tutorLearnerDag?.conversationalCompletion || null,
      );
      stopInterimAnimation(state);
      printAutomaticTechnicalDetails(state, () => {
        printClassification(classification);
        printTutorLearnerDagModel(tutorLearnerDag);
        printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
      });
      return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const classification = failedClassification({
        message: err.message,
        resolved: state.learnerDag.resolved,
        latencyMs: Date.now() - startedAt,
      });
      const empty = emptyTutorLearnerDagModel(state, tutorTurn, raw?.dagPreflight || null);
      const tutorLearnerDag = {
        model: empty.model,
        assessment: empty.assessment,
        preflight: raw?.dagPreflight || null,
        advance: empty.advance,
        dagFactDropout: empty.dagFactDropout,
        accepted: {
          adopt: [],
          retract: [],
          derive: [],
          hypothesis: null,
          assertAnswer: null,
          humanDiscourse: normalizeHumanDiscourseExtraction(),
        },
        rejected: [],
        extractor: {
          error: err.message,
          provider: state.learnerDag.resolved.provider,
          model: state.learnerDag.resolved.model,
        },
      };
      state.learnerDag.lastModel = tutorLearnerDag.model;
      resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
      updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
      updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
      const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
        state,
        tutorLearnerDag,
        classification,
        tutorFeedback,
      );
      let registerSelection = normalizeResponseConfigurationSelection(null, {
        state,
        classification,
        tutorLearnerDag,
        raw: null,
        learnerText,
      });
      registerSelection = applyConversationalCompletionForLearnerTurn(
        state,
        registerSelection,
        tutorLearnerDag?.conversationalCompletion || null,
      );
      stopInterimAnimation(state);
      printAutomaticTechnicalDetails(state, () => {
        printClassification(classification);
        printTutorLearnerDagModel(tutorLearnerDag);
        printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
      });
      return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
    }
  }

  async function analyzeLearnerTurn(
    learnerText,
    state,
    { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
  ) {
    printWithConcurrentTerminal(state, () => printTurnDebugLine(state, state.turns.length + 1));
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (state.classifier.enabled && state.learnerDag.enabled && state.world) {
      return await analyzeLearnerTurnCombined(learnerText, state, {
        precomputedRaw,
        signal,
        isCurrent,
        tutorFeedback,
      });
    }

    updateComprehensionForLearnerTurn({
      learnerText,
      state,
      classification: null,
      tutorTurn: state.turns.length + 1,
      recordTrace: false,
    });
    const dagPreflight = learnerDagPreflightForTurn(state, state.turns.length + 1, {
      traceSource: 'separate_classifier_and_learner_record',
    });
    const classification = await classifyForTurn(learnerText, state, { signal });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    updateComprehensionForLearnerTurn({
      learnerText,
      state,
      classification,
      tutorTurn: state.turns.length + 1,
    });
    const tutorLearnerDag = await buildTutorLearnerDagForTurn(learnerText, state, {
      dagPreflight,
      signal,
      isCurrent,
      classification,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
    resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
    updateReleasePacingForLearnerTurn({
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      tutorTurn: state.turns.length + 1,
    });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
      state,
      tutorLearnerDag,
      classification,
      tutorFeedback,
    );
    let registerSelection = normalizeResponseConfigurationSelection(null, {
      state,
      classification,
      tutorLearnerDag,
      raw: null,
      learnerText,
    });
    registerSelection = applyConversationalCompletionForLearnerTurn(
      state,
      registerSelection,
      tutorLearnerDag?.conversationalCompletion || null,
    );
    printAutomaticTechnicalDetails(state, () =>
      printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy),
    );
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  }

  return {
    analyzeLearnerTurn,
    applyConversationalCompletionForLearnerTurn,
    applyLearnerAdvanceAssessment,
    buildLearnerClassifierPrompt,
    buildTutorLearnerDagForTurn,
    classificationFromCombinedAnalysis,
    extractCombinedLearnerAnalysis,
    learnerRecordFromCombinedAnalysis,
    resolveConversationalCompletionForLearnerTurn,
    tutorStubNewEvidenceAvailable,
    updateComprehensionForLearnerTurn,
  };
}
