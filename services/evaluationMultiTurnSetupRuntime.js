/**
 * Prepare the mutable and immutable state consumed by the multi-turn loop.
 */
export function createEvaluationMultiTurnSetupRuntime(dependencies = {}) {
  const {
    chalk,
    collectPromptVersions,
    computeConfigHash,
    contentResolver,
    createEvaluationMultiTurnTranscriptRuntime,
    dialogueEngine,
    evalConfigLoader,
    fs,
    loadFormalInterior,
    path,
    resolveConfigModels,
    resolveEvalProfile,
    transcriptsDir: TRANSCRIPTS_DIR,
  } = dependencies;

  function prepareMultiTurnEvaluation(state) {
    let { fullScenario } = state;
    const {
      checkpointState,
      config,
      dryRun,
      explicitLearnerId,
      explicitThreadNegotiationResolution,
      judgeCli,
      judgeCliModel,
      judgeOverride,
      log,
      outputSize,
      runId,
      runNum,
      scenario,
      showMessages,
      skipRubricEval,
      superegoStrategy,
      transcriptMode,
    } = state;

    // 1. Resolve config (models, profile) — same as single-turn
    const resolvedConfig = resolveConfigModels(config);
    const profileResolution = resolveEvalProfile(resolvedConfig.profileName);
    const { useDialogue, maxRounds } = profileResolution;
    // Preserve original eval-cell name for id-director dispatch (see single-turn
    // resolution at line ~2562 for full rationale).
    resolvedConfig.evalCellProfileName = resolvedConfig.profileName;
    resolvedConfig.profileName = profileResolution.resolvedProfileName;

    // P1c Provenance: snapshot the fully-resolved config
    const configHash = computeConfigHash(resolvedConfig);

    // P2 Provenance: prompt version metadata
    const promptVersions = collectPromptVersions(config.profileName, resolvedConfig);
    const activeTutorRubricVersion = evalConfigLoader.loadRubric()?.version || null;

    // 2. Build curriculum context — same as single-turn
    const curriculumContext = contentResolver.isConfigured()
      ? contentResolver.buildCurriculumContext(contentResolver.resolveScenarioContent(fullScenario))
      : null;

    // 3. Generate dialogue ID for the session (or restore from checkpoint)
    const dialogueId =
      checkpointState?.dialogueId || `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dialogueEngine.setCurrentDialogueId(dialogueId);

    // Resolve learnerId for Writing Pad persistence across turns (and, if explicit,
    // across runs — A7 Longitudinal). Precedence: checkpoint > explicit (--learner-id)
    // > synthetic per-dialogue ID.
    const learnerId =
      checkpointState?.learnerId ||
      explicitLearnerId ||
      `eval-learner-${dialogueId}-${scenario.id.replace(/[^a-zA-Z0-9]/g, '')}`;
    if (checkpointState) {
      log(
        `[evaluationRunner] Resuming from checkpoint: turn ${checkpointState.lastCompletedTurn + 1} (dialogueId=${dialogueId})`,
        'info',
      );
    } else if (explicitLearnerId) {
      log(`[evaluationRunner] Reusing learnerId for Writing Pad (cross-session): ${learnerId}`, 'info');
    } else {
      log(`[evaluationRunner] Generated learnerId for Writing Pad: ${learnerId}`, 'info');
    }

    // Set up transcript file for incremental writing (tail -f friendly)
    let transcriptPath = null;
    if (transcriptMode) {
      const effectiveRunId = runId || 'live';
      const transcriptDir = path.join(TRANSCRIPTS_DIR, effectiveRunId);
      if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });
      const safeName = `${config.profileName}--${scenario.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      transcriptPath = path.join(transcriptDir, `${safeName}.txt`);
      // Write header
      const totalTurnCount = 1 + (fullScenario.turns || []).length;
      const header = `\n${(fullScenario.name || scenario.id).toUpperCase()} (${totalTurnCount}-turn)\n${config.profileName}\n${'─'.repeat(40)}\n\n`;
      fs.writeFileSync(transcriptPath, header);
      log(`[evaluationRunner] Transcript: ${transcriptPath}`, 'info');
    }

    // Initialize state variables — restore from checkpoint if resuming
    const cs = checkpointState; // alias for brevity

    // Deep-clone turns to prevent mutation of shared scenario objects across profiles.
    // On resume, restore the checkpointed turns (which include LLM-generated learner mutations).
    const turns = cs?.turns || JSON.parse(JSON.stringify(fullScenario.turns || []));
    const turnResults = cs?.turnResults || [];
    const totalLatencyMs = cs?.totalLatencyMs || 0;
    const totalInputTokens = cs?.totalInputTokens || 0;
    const totalOutputTokens = cs?.totalOutputTokens || 0;
    const totalApiCalls = cs?.totalApiCalls || 0;
    const totalCost = cs?.totalCost || 0;
    const totalDeliberationRounds = cs?.totalDeliberationRounds || 0;

    const conversationHistory = cs?.conversationHistory || [];
    const previousSuggestion = cs?.previousSuggestion || null;
    const consolidatedTrace = cs?.consolidatedTrace || [];
    const priorSuperegoAssessments = cs?.priorSuperegoAssessments || []; // Cross-turn superego memory

    // Helper: append new trace entries to transcript file and optionally console.
    // Always prints live chat-style lines for public-facing messages (User/Assistant).
    // --transcript mode additionally writes play-format to file + compact console lines.
    // On resume, skip entries already flushed in the previous session.
    const isEgoSuperegoLearner = resolvedConfig.learnerArchitecture?.includes('ego_superego');
    let isLLMLearner = isEgoSuperegoLearner;
    const { flushTranscript } = createEvaluationMultiTurnTranscriptRuntime({
      config,
      consolidatedTrace,
      initialTraceIndex: cs ? consolidatedTrace.length : 0,
      runNum,
      scenario,
      transcriptMode,
      transcriptPath,
    });
    // Check profile-level feature flags
    const rawProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[config.profileName];

    // Apply CLI model override to rawProfile so prompt rewriter calls use the correct model.
    // Without this, --model/--ego-model only affects tutor-core's generateSuggestions,
    // while promptRewriter functions (self-reflection, profiling, etc.) still use the YAML model.
    if (config.modelOverride || config.egoModelOverride) {
      const overrideModel = config.egoModelOverride || config.modelOverride;
      try {
        const r = evalConfigLoader.resolveModel(overrideModel);
        if (rawProfile?.ego) {
          rawProfile.ego = { ...rawProfile.ego, provider: r.provider, model: r.model };
        }
        // Also update top-level model for functions that read config.model
        if (rawProfile) rawProfile.model = r.model;
      } catch {
        /* leave rawProfile as-is if resolution fails */
      }
    }
    if (config.modelOverride || config.superegoModelOverride) {
      const overrideModel = config.superegoModelOverride || config.modelOverride;
      try {
        const r = evalConfigLoader.resolveModel(overrideModel);
        if (rawProfile?.superego) {
          rawProfile.superego = { ...rawProfile.superego, provider: r.provider, model: r.model };
        }
      } catch {
        /* leave rawProfile as-is if resolution fails */
      }
    }

    const dialecticalNegotiation = rawProfile?.dialectical_negotiation ?? false;
    // A5: CLI --thread-negotiation-resolution OR's with an optional static per-cell
    // default (rawProfile.thread_negotiation_resolution) — lets the SAME cell run
    // with threading on or off across different invocations (needed for the A5
    // three-arm design, which reuses cell_40 for both the threaded and unthreaded
    // arms) without registering a duplicate cell. Precedence mirrors learnerId
    // above: checkpoint (resume-safety, so a kill mid-dialogue can't silently
    // flip a session's arm to "threading off") > explicit CLI flag > per-cell
    // YAML default. Nullish (not ||) coalescing on the checkpoint value: a
    // checkpointed `false` (e.g. arm-2/arm-3's off-arms) must be honored as-is,
    // not treated as "unset" and re-derived.
    const threadNegotiationResolution =
      cs?.threadNegotiationResolution ??
      (explicitThreadNegotiationResolution || (rawProfile?.thread_negotiation_resolution ?? false));
    const promptRewritingEnabled = rawProfile?.prompt_rewriting?.enabled ?? false;
    const promptRewritingStrategy = rawProfile?.prompt_rewriting?.strategy ?? 'template';
    const superegoDispositionRewriting = rawProfile?.superego_disposition_rewriting ?? false;
    const quantitativeDispositionEnabled = rawProfile?.prompt_rewriting?.quantitative_disposition ?? false;
    const promptErosionEnabled = rawProfile?.prompt_rewriting?.prompt_erosion?.enabled ?? false;
    const intersubjectiveEnabled = rawProfile?.prompt_rewriting?.intersubjective ?? false;
    const otherEgoProfilingEnabled = rawProfile?.other_ego_profiling?.enabled ?? false;
    const otherEgoBidirectional = rawProfile?.other_ego_profiling?.bidirectional ?? false;
    const strategyPlanningEnabled = rawProfile?.other_ego_profiling?.strategy_planning ?? false;
    const conversationMode = rawProfile?.conversation_mode ?? 'single-prompt';
    const internalHistory = rawProfile?.internal_history ?? null;

    // In messages mode, ALL learners are LLM-generated (unified uses single-agent path,
    // ego_superego uses deliberation chain). In single-prompt mode, only ego_superego
    // learners are LLM-generated; unified learners use YAML turn messages.
    isLLMLearner = isEgoSuperegoLearner || conversationMode === 'messages';

    const sharedTurnOptions = {
      skipRubricEval,
      outputSize,
      superegoStrategy,
      judgeOverride,
      judgeCli,
      judgeCliModel,
      useDialogue,
      maxRounds,
      log,
      scenarioId: scenario.id,
      learnerId,
      dialecticalNegotiation,
      threadNegotiationResolution,
      dryRun,
      conversationMode,
      showMessages,
    };
    const sessionEvolution = cs?.sessionEvolution ?? null;
    const superegoEvolution = cs?.superegoEvolution ?? null;
    const behavioralOverrides = cs?.behavioralOverrides ?? null; // Parsed quantitative params from superego self-reflection
    const tutorProfileOfLearner = cs?.tutorProfileOfLearner ?? null; // Other-ego: tutor's mental model of learner
    const learnerProfileOfTutor = cs?.learnerProfileOfTutor ?? null; // Other-ego: learner's mental model of tutor
    const strategyPlan = cs?.strategyPlan ?? null; // Other-ego: ego's explicit strategy plan

    // Per-dialogue rejection budget: limits total superego rejections across all turns
    // to prevent worst-case cascade (e.g., 3 rejections × 5 turns = 15 total)
    const rejectionBudget = rawProfile?.dialogue?.rejection_budget ?? null; // null = unlimited (backwards-compatible)
    const totalRejections = cs?.totalRejections ?? 0;

    // 4. Loop through turns (initial turn 0 + follow-up turns)
    const totalTurnCount = 1 + turns.length;
    const startTurnIdx = cs ? cs.lastCompletedTurn + 1 : 0;
    if (cs) {
      log(
        `[evaluationRunner] Checkpoint: resuming from turn ${startTurnIdx}/${totalTurnCount - 1} (${turnResults.length} turns already completed)`,
        'info',
      );
    }

    // Print live chat System context at dialogue start (shows the learner scenario)
    if (startTurnIdx === 0) {
      const systemText = fullScenario.learner_context || fullScenario.description || '';
      if (systemText) {
        const truncated = systemText.length > 300 ? systemText.substring(0, 297) + '...' : systemText;
        console.log('\n' + chalk.dim('─'.repeat(60)));
        console.log(chalk.gray.bold('System'.padEnd(11)) + chalk.dim(truncated.replace(/\n/g, '\n' + ' '.repeat(11))));
      }
    }

    // De-substitution diagnostic (notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md):
    // load the formal interior once; the content condition (blocking-element
    // release) is tracked cumulatively across tutor turns — once met it stays met.
    const desubEnabled = fullScenario.desubstitution_diagnostic === true;
    const desubInterior = desubEnabled ? loadFormalInterior(fullScenario) : null;
    // Iteration 1 (tutor-visible key): Stage 2 found the release floor absolute
    // (0/60 — tutors cannot cite a token they are never shown). Surface the
    // withheld premise in the tutor-visible learner context as course material.
    if (desubEnabled) {
      const blocking = desubInterior.blocking_element;
      fullScenario = {
        ...fullScenario,
        learner_context: [
          fullScenario.learner_context || '',
          '### Course Reference Sheet (instructor copy)',
          `- The lecture's withheld premise ${blocking.id}: "${blocking.content}"`,
          `- Pedagogical note: this learner will not move until you actually supply this premise's content in the dialogue. When you do, quote its code ${blocking.id} verbatim alongside the substance (e.g. "${blocking.release_phrases[0]}") — the code is part of the course material, not jargon to smooth away.`,
        ].join('\n'),
      };
    }
    const desubContentConditionMet = false;
    const desubTutorWork = 0;
    const desubContentEvidence = null;

    return {
      activeTutorRubricVersion,
      behavioralOverrides,
      configHash,
      consolidatedTrace,
      conversationHistory,
      conversationMode,
      curriculumContext,
      desubContentConditionMet,
      desubContentEvidence,
      desubEnabled,
      desubInterior,
      desubTutorWork,
      dialogueId,
      flushTranscript,
      fullScenario,
      internalHistory,
      intersubjectiveEnabled,
      isEgoSuperegoLearner,
      isLLMLearner,
      learnerId,
      learnerProfileOfTutor,
      otherEgoBidirectional,
      otherEgoProfilingEnabled,
      previousSuggestion,
      priorSuperegoAssessments,
      promptErosionEnabled,
      promptRewritingEnabled,
      promptRewritingStrategy,
      promptVersions,
      quantitativeDispositionEnabled,
      rawProfile,
      rejectionBudget,
      resolvedConfig,
      sessionEvolution,
      sharedTurnOptions,
      startTurnIdx,
      strategyPlan,
      strategyPlanningEnabled,
      superegoDispositionRewriting,
      superegoEvolution,
      threadNegotiationResolution,
      totalApiCalls,
      totalCost,
      totalDeliberationRounds,
      totalInputTokens,
      totalLatencyMs,
      totalOutputTokens,
      totalRejections,
      totalTurnCount,
      transcriptPath,
      turnResults,
      turns,
      tutorProfileOfLearner,
    };
  }

  return { prepareMultiTurnEvaluation };
}
