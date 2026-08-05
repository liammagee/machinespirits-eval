export async function runEvaluateDialogueCommand(context) {
  const {
    LOGS_DIR,
    args,
    buildDialogueQualityPrompt,
    calculateDialogueQualityScore,
    callSelectedCliJudgeText,
    evaluationStore,
    expandRunId,
    fs,
    getFlag,
    getOption,
    getScenario,
    path,
    resolveDefaultCliJudgeModelOverride,
  } = context;

  // ── Dialogue-level evaluation: score multi-turn dialogues on three axes ──
  //
  // For each multi-turn row:
  //   1. tutor_first_turn_score (Turn 0) — already populated by 'evaluate'
  //   2. Read tutor_last_turn_score (already populated by per-turn scoring)
  //   3. Compute delta → tutor_development_score (arithmetic, no judge call)
  //   4. Run dialogue quality prompt → dialogue_quality_score (ONE judge call)
  //
  // Single-turn rows are skipped (NULL for all new columns).

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate-dialogue'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js evaluate-dialogue <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--judge <judge>] [--force] [--verbose]',
    );
    console.error('  Scores multi-turn dialogues: tutor last-turn, development delta, and dialogue quality.');
    console.error('  --scenario <id>  Filter to specific scenario(s) (comma-separated)');
    console.error('  --profile <name> Filter to specific profile(s) (comma-separated)');
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const force = getFlag('force');
  const modelOverride = getOption('model') || null;
  const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
  const judgeFilter = getOption('judge') || null;
  const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
  const profileFilter = getOption('profile') || getOption('profiles') || null;

  if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
    console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
    process.exit(1);
  }

  // Resolve judge model: CLI --model > YAML config > default
  // YAML claude_code_judge.model is only relevant for Claude CLI — skip for Gemini/Codex
  const effectiveJudgeModel = modelOverride || resolveDefaultCliJudgeModelOverride(judgeCli);
  const judgeModelLabel =
    judgeCli === 'gemini'
      ? `gemini-cli/${effectiveJudgeModel || 'auto'}`
      : judgeCli === 'codex'
        ? `codex-cli/${effectiveJudgeModel || 'auto'}`
        : effectiveJudgeModel
          ? `claude-code/${effectiveJudgeModel}`
          : 'claude-opus-4.6';

  // Restore env overrides from run metadata
  {
    const runData = evaluationStore.getRun(runId);
    const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
    if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
      process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
      console.log(`[evaluate-dialogue] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
    }
    if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
      process.env.EVAL_CONTENT_PATH = meta.contentPath;
      console.log(`[evaluate-dialogue] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
    }
  }

  // Load all results for this run (with optional filters)
  const results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter?.split(',')[0] || null,
    profileName: profileFilter?.split(',')[0] || null,
  });
  if (results.length === 0) {
    console.error(`No results found for run: ${runId}`);
    process.exit(1);
  }

  // Filter to multi-turn rows only (suggestions array with >1 entry,
  // OR messages-mode with >1 dialogue round)
  let toEvaluate = results.filter(
    (r) =>
      r.success &&
      ((Array.isArray(r.suggestions) && r.suggestions.length > 1) ||
        (r.conversationMode === 'messages' && r.dialogueRounds > 1)),
  );

  // Apply additional comma-separated scenario/profile filters
  if (scenarioFilter) {
    const scenarios = scenarioFilter.split(',').map((s) => s.trim());
    toEvaluate = toEvaluate.filter((r) => scenarios.includes(r.scenarioId));
  }
  if (profileFilter) {
    const profiles = profileFilter.split(',').map((p) => p.trim());
    toEvaluate = toEvaluate.filter((r) => profiles.includes(r.profileName));
  }

  if (toEvaluate.length === 0) {
    console.log('No multi-turn results found in this run. Nothing to evaluate.');
    return;
  }

  // --force: re-evaluate everything; otherwise only rows missing dialogue scores
  if (!force) {
    toEvaluate = toEvaluate.filter(
      (r) => r.tutorLastTurnScore == null || r.dialogueQualityScore == null || r.dialogueQualityInternalScore == null,
    );
  }

  // --judge: only process rows from a specific judge model
  if (judgeFilter) {
    const before = toEvaluate.length;
    toEvaluate = toEvaluate.filter((r) => r.judgeModel === judgeFilter);
    if (before !== toEvaluate.length) {
      console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toEvaluate.length} rows`);
    }
  }

  if (toEvaluate.length === 0) {
    console.log('All multi-turn results already have dialogue scores. Use --force to re-evaluate.');
    return;
  }

  const dialogueStartTime = new Date();
  console.log(`\nEvaluating ${toEvaluate.length} multi-turn dialogue(s) for run: ${runId}`);
  console.log(
    `  Started:   ${dialogueStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  );
  if (modelOverride) console.log(`  Model: ${modelOverride}`);
  console.log('');

  let succeeded = 0;
  let failed = 0;
  const lastTurnScores = [];
  const dialogueQualityScores = [];
  const dialogueQualityInternalScores = [];
  const developmentScores = [];

  for (let i = 0; i < toEvaluate.length; i++) {
    const result = toEvaluate[i];
    const tag = `[${i + 1}/${toEvaluate.length}]`;
    const scenarioId = result.scenarioId;
    const profileName = result.profileName || `${result.provider}/${result.model}`;

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
      failed++;
      continue;
    }

    // Load dialogue log for full transcript
    let dialogueLog = null;
    const dialogueId = result.dialogueId;
    if (dialogueId) {
      const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
      try {
        if (fs.existsSync(logPath)) {
          dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        }
      } catch (e) {
        if (verbose) console.log(`${tag}   could not load dialogue log: ${e.message}`);
      }
    }

    const dialogueTrace = dialogueLog?.dialogueTrace || [];
    const conversationHistory = (dialogueLog?.turnResults || []).map((t, idx) => ({
      turnIndex: idx,
      turnId: t.turnId,
      suggestion: t.suggestions?.[0],
      learnerAction: t.learnerAction,
      learnerMessage: t.learnerMessage,
    }));
    const _dialogueContext =
      dialogueTrace.length > 0 || conversationHistory.length > 0
        ? { consolidatedTrace: dialogueTrace, conversationHistory }
        : null;

    try {
      // ── Step A: Read tutor_last_turn_score (already populated by per-turn scoring) ──
      const tutorLastTurnScore = result.tutorLastTurnScore ?? null;
      const judgeModel = judgeModelLabel;

      if (tutorLastTurnScore != null) {
        lastTurnScores.push(tutorLastTurnScore);

        const devScore = result.tutorDevelopmentScore ?? null;
        if (devScore != null) developmentScores.push(devScore);

        const devLabel = devScore != null ? `Δ=${devScore >= 0 ? '+' : ''}${devScore.toFixed(1)}` : 'Δ=?';
        console.log(`${tag} ${scenarioId} / ${profileName} ... last-turn=${tutorLastTurnScore.toFixed(1)} ${devLabel}`);
      } else {
        console.log(
          `${tag} ${scenarioId} / ${profileName} ... last-turn=NULL (run 'evaluate' with per-turn scoring first)`,
        );
      }

      // ── Helper: call judge and parse JSON response ──
      async function callDialogueJudge(prompt) {
        const raw = await callSelectedCliJudgeText(
          judgeCli,
          effectiveJudgeModel,
          prompt,
          'eval-cli-dialogue-evaluation',
        );

        let jsonStr = raw.trim();
        const fm = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fm) {
          jsonStr = fm[1].trim();
        } else {
          const firstBrace = jsonStr.indexOf('{');
          const lastBrace = jsonStr.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
          }
        }

        const parsed = JSON.parse(jsonStr);
        const scores = {};
        for (const [key, value] of Object.entries(parsed.scores || {})) {
          if (typeof value === 'object' && value !== null) {
            scores[key] = { score: value.score, reasoning: value.reasoning };
          } else if (typeof value === 'number') {
            scores[key] = { score: value, reasoning: null };
          }
        }

        const overall = Object.keys(scores).length > 0 ? calculateDialogueQualityScore(scores) : parsed.overall_score;

        return { overall, scores, summary: parsed.summary || null };
      }

      const promptParams = {
        turns: conversationHistory,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        topic: scenario.topic || scenario.name,
        turnCount:
          result.suggestions?.length > 1
            ? result.suggestions.length
            : result.dialogueRounds || conversationHistory.length,
        learnerContext: dialogueLog?.learnerContext || null,
        transcriptArtifacts: dialogueLog?.transcripts || null,
      };

      // ── Step B: Score dialogue quality (PUBLIC transcript) → dialogue_quality_score ──
      try {
        if (verbose) console.log(`${tag} ${scenarioId} / ${profileName} ... scoring dialogue quality (public)`);

        const publicPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'public' });
        const publicResult = await callDialogueJudge(publicPrompt);

        evaluationStore.updateDialogueQualityScore(result.id, {
          dialogueQualityScore: publicResult.overall,
          dialogueQualityScores: publicResult.scores,
          dialogueQualitySummary: publicResult.summary,
          dialogueQualityJudgeModel: judgeModel,
        });
        dialogueQualityScores.push(publicResult.overall);

        console.log(
          `${tag} ${scenarioId} / ${profileName} ... dialogue-quality(public)=${publicResult.overall.toFixed(1)}`,
        );

        if (verbose && publicResult.summary) {
          const truncSummary =
            publicResult.summary.length > 300
              ? publicResult.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
              : publicResult.summary.replace(/\n/g, ' ');
          console.log(`     Public judge: ${truncSummary}`);
        }
      } catch (err) {
        const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
        console.log(`${tag} ${scenarioId} / ${profileName} ... dialogue-quality(public) FAIL: ${msg}`);
        if (verbose) console.error(err);
      }

      // ── Step C: Score dialogue quality (FULL transcript) → dialogue_quality_internal_score ──
      try {
        if (verbose) console.log(`${tag} ${scenarioId} / ${profileName} ... scoring dialogue quality (full)`);

        const fullPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'full' });
        const fullResult = await callDialogueJudge(fullPrompt);

        evaluationStore.updateDialogueQualityInternalScore(result.id, {
          dialogueQualityInternalScore: fullResult.overall,
          dialogueQualityInternalScores: fullResult.scores,
          dialogueQualityInternalSummary: fullResult.summary,
        });
        dialogueQualityInternalScores.push(fullResult.overall);

        console.log(
          `${tag} ${scenarioId} / ${profileName} ... dialogue-quality(full)=${fullResult.overall.toFixed(1)}`,
        );

        if (verbose && fullResult.summary) {
          const truncSummary =
            fullResult.summary.length > 300
              ? fullResult.summary.slice(0, 300).replace(/\n/g, ' ') + '...'
              : fullResult.summary.replace(/\n/g, ' ');
          console.log(`     Full judge: ${truncSummary}\n`);
        }
      } catch (err) {
        const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
        console.log(`${tag} ${scenarioId} / ${profileName} ... dialogue-quality(full) FAIL: ${msg}`);
        if (verbose) console.error(err);
      }

      succeeded++;
    } catch (err) {
      failed++;
      const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
      console.log(`${tag} ${scenarioId} / ${profileName} ... FAIL: ${msg}`);
      if (verbose) console.error(err);
    }
  }

  // Summary
  const dialogueEndTime = new Date();
  console.log('\n' + '='.repeat(50));
  console.log('  EVALUATE-DIALOGUE SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Finished:  ${dialogueEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  console.log(`  Duration:  ${((dialogueEndTime - dialogueStartTime) / 1000 / 60).toFixed(1)} min`);
  console.log(`  Total:     ${toEvaluate.length}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  if (lastTurnScores.length > 0) {
    const avgLast = lastTurnScores.reduce((a, b) => a + b, 0) / lastTurnScores.length;
    console.log(`  Avg tutor last-turn:   ${avgLast.toFixed(1)}`);
  }
  if (developmentScores.length > 0) {
    const avgDev = developmentScores.reduce((a, b) => a + b, 0) / developmentScores.length;
    console.log(`  Avg tutor development: ${avgDev >= 0 ? '+' : ''}${avgDev.toFixed(1)}`);
  }
  if (dialogueQualityScores.length > 0) {
    const avgDQ = dialogueQualityScores.reduce((a, b) => a + b, 0) / dialogueQualityScores.length;
    console.log(`  Avg dialogue quality (public):   ${avgDQ.toFixed(1)}`);
  }
  if (dialogueQualityInternalScores.length > 0) {
    const avgDQI = dialogueQualityInternalScores.reduce((a, b) => a + b, 0) / dialogueQualityInternalScores.length;
    console.log(`  Avg dialogue quality (full):     ${avgDQI.toFixed(1)}`);
  }
  console.log('');
  return;
}
