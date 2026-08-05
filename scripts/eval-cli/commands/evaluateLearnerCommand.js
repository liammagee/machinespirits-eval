import { createEvaluateLearnerDialogue } from './evaluateLearnerDialogue.js';

export async function runEvaluateLearnerCommand(context) {
  const {
    LOGS_DIR,
    args,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    calculateLearnerOverallScore,
    callSelectedCliJudgeText,
    evaluationRunner,
    evaluationStore,
    expandRunId,
    extractLearnerTurnsFromTrace,
    fs,
    getFlag,
    getOption,
    getScenario,
    path,
    resolveDefaultCliJudgeModelOverride,
  } = context;

  // ── Learner-side evaluation: score learner turns from multi-turn dialogues ──
  //
  // Data lives in evaluation_results (per-dialogue rows with dialogueId)
  // and logs/tutor-dialogues/*.json (full dialogue traces with learner turns).
  //
  // For each dialogue:
  //   1. Load the log file to get learner turn messages + deliberation traces
  //   2. Build a learner evaluation prompt per learner turn (truncated context)
  //   3. Build a holistic learner prompt over the full dialogue
  //   4. Call Claude as judge
  //   5. Store per-turn + holistic learner scores on the result row

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate-learner'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js evaluate-learner <runId> [--model <model>] [--judge <judge>] [--force] [--verbose] [--arch <architecture>] [--parallelism N]',
    );
    console.error('  Scores learner turns and holistic learner dialogue quality from logs using the learner rubric.');
    console.error('  Only works on multi-turn runs with learner turns (e.g., bilateral transformation).');
    console.error('  --arch filters by learner_architecture (e.g., ego_superego_recognition)');
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const force = getFlag('force');
  const modelOverride = getOption('model') || null;
  const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
  const judgeFilter = getOption('judge') || null;
  const profileFilter = getOption('profile') || getOption('profiles') || null;
  const archFilter = getOption('arch') || null;
  const parsedParallelism = parseInt(getOption('parallelism', '1'), 10);
  const parallelism = Number.isFinite(parsedParallelism) && parsedParallelism > 0 ? parsedParallelism : 1;

  if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
    console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
    process.exit(1);
  }

  // Resolve effective judge model: CLI --model > YAML config > default
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

  // Load results with dialogue IDs (multi-turn data)
  const allResults = evaluationStore.getResults(runId, { profileName: profileFilter });
  let dialogueResults = allResults.filter((r) => r.dialogueId && r.success);
  if (archFilter) {
    dialogueResults = dialogueResults.filter((r) => r.learnerArchitecture === archFilter);
  }
  if (judgeFilter) {
    const before = dialogueResults.length;
    dialogueResults = dialogueResults.filter((r) => r.judgeModel === judgeFilter);
    if (before !== dialogueResults.length) {
      console.log(`  --judge ${judgeFilter}: filtered ${before} → ${dialogueResults.length} rows`);
    }
  }

  if (dialogueResults.length === 0) {
    console.error(`No multi-turn dialogue results found for run: ${runId}`);
    console.error('This command only works on runs that produced dialogue log files.');
    process.exit(1);
  }

  // Filter to those needing learner evaluation.
  // Supports two paths:
  //   1) turn-level learner scoring (existing)
  //   2) holistic learner dialogue scoring (new)
  // This enables historical backfill of missing holistic scores without
  // re-scoring all learner turns.
  let partialCount = 0;
  let missingHolisticCount = 0;
  let echoedLearnerCount = 0;
  const PLACEHOLDER_LEARNER_SIGNATURE =
    'conceptual_progression=2,engagement_quality=2,learner_authenticity=3,metacognitive_awareness=3,revision_signals=4';

  const getLearnerScoreSignature = (scoreMap = {}) =>
    Object.keys(scoreMap)
      .sort()
      .map((k) => `${k}=${typeof scoreMap[k] === 'object' ? scoreMap[k].score : scoreMap[k]}`)
      .join(',');

  const isPromptExamplePlaceholder = (parsed) => {
    if (!parsed || typeof parsed !== 'object' || !parsed.scores || typeof parsed.scores !== 'object') {
      return false;
    }

    const signature = getLearnerScoreSignature(parsed.scores);
    const reasonings = Object.values(parsed.scores)
      .map((entry) => (typeof entry === 'object' && entry !== null ? String(entry.reasoning || '').toLowerCase() : ''))
      .filter(Boolean);
    const hasTemplateReasoning = reasonings.some((reasoning) => reasoning.includes('your assessment of'));
    const hasTemplateSummary = String(parsed.summary || '')
      .toLowerCase()
      .includes('brief overall assessment');
    const overall = Number(parsed.overall_score);
    const hasTemplateOverall = Number.isFinite(overall) && overall === 55;

    if (hasTemplateReasoning) return true;

    return signature === PLACEHOLDER_LEARNER_SIGNATURE && (hasTemplateSummary || hasTemplateOverall);
  };

  const hasEchoedLearnerScorePattern = (learnerScores) => {
    const turnEntries = Object.values(learnerScores || {});
    if (turnEntries.length < 2) return false;
    const signatures = turnEntries.map((turnScore) => getLearnerScoreSignature(turnScore.scores || {}));
    return signatures.every((signature) => signature === signatures[0]);
  };

  const toEvaluate = dialogueResults
    .map((r) => {
      if (force) {
        return { result: r, needsTurnEval: true, needsHolisticEval: true };
      }

      let hasCompleteTurnScores = r.learnerOverallScore != null && !!r.learnerScores;

      // If turn scores exist, verify expected turn count against dialogue log.
      if (hasCompleteTurnScores && r.dialogueId) {
        const logPath = path.join(LOGS_DIR, `${r.dialogueId}.json`);
        try {
          if (fs.existsSync(logPath)) {
            const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
            const trace = log.dialogueTrace || [];
            let expectedTurns = trace.filter(
              (t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action',
            ).length;
            if (expectedTurns === 0) {
              expectedTurns = trace.filter(
                (t) =>
                  (t.agent === 'learner_synthesis' && t.action === 'response') ||
                  (t.agent === 'learner' && t.action === 'final_output'),
              ).length;
            }
            const scoredTurns = Object.keys(r.learnerScores || {}).length;
            if (scoredTurns < expectedTurns) {
              hasCompleteTurnScores = false;
            }
          }
        } catch {
          // If log can't be read, preserve existing behavior and trust stored turn score completeness.
        }
      }

      const needsTurnEval = !hasCompleteTurnScores;
      let needsHolisticEval = r.learnerHolisticOverallScore == null;

      if (!needsTurnEval && hasEchoedLearnerScorePattern(r.learnerScores)) {
        echoedLearnerCount++;
        partialCount++;
        needsHolisticEval = true;
        return { result: r, needsTurnEval: true, needsHolisticEval };
      }

      if (r.learnerOverallScore != null && needsTurnEval) partialCount++;
      if (!needsTurnEval && needsHolisticEval) missingHolisticCount++;

      if (!needsTurnEval && !needsHolisticEval) return null;
      return { result: r, needsTurnEval, needsHolisticEval };
    })
    .filter(Boolean);

  if (partialCount > 0) {
    console.log(`Found ${partialCount} partially-scored dialogue(s) — will re-evaluate learner turns.`);
  }
  if (echoedLearnerCount > 0) {
    console.log(
      `Found ${echoedLearnerCount} dialogue(s) with echoed learner score patterns — will re-evaluate with robust CLI parsing.`,
    );
  }
  if (missingHolisticCount > 0) {
    console.log(`Found ${missingHolisticCount} dialogue(s) with missing learner holistic scores.`);
  }

  if (toEvaluate.length === 0) {
    console.log('All dialogue results already have learner turn + holistic scores. Use --force to re-evaluate.');
    return;
  }

  const learnerStartTime = new Date();
  console.log(`\nEvaluating learner turns for ${toEvaluate.length} dialogue(s) from run: ${runId}`);
  console.log(
    `  Started:     ${learnerStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  );
  if (modelOverride) console.log(`  Model: ${modelOverride}`);
  if (parallelism > 1) console.log(`  Parallelism: ${parallelism}`);
  console.log('');

  let succeeded = 0;
  let failed = 0;
  const allScores = [];
  const allHolisticScores = [];
  const learnerJudgeModel = judgeModelLabel;

  const callLearnerJudge = async (prompt) => {
    const attemptPrompts = [
      prompt,
      `${prompt}\n\nIMPORTANT RETRY DIRECTIVE: Your prior response appeared to copy the example template. Return ONLY fresh JSON scores for this specific learner transcript. Do NOT reuse example scores or example summary text.`,
    ];

    let lastError = null;
    for (let attempt = 0; attempt < attemptPrompts.length; attempt++) {
      try {
        const stdout = await callSelectedCliJudgeText(
          judgeCli,
          effectiveJudgeModel,
          attemptPrompts[attempt],
          'eval-cli-learner-evaluation',
        );

        const parsed = evaluationRunner.parseCliJudgeJsonResponse(stdout);

        if (!parsed?.scores || typeof parsed.scores !== 'object') {
          throw new Error('CLI judge response missing scores object');
        }

        if (isPromptExamplePlaceholder(parsed)) {
          throw new Error('CLI judge echoed prompt example scores');
        }

        return parsed;
      } catch (error) {
        lastError = error;
        if (attempt < attemptPrompts.length - 1) {
          continue;
        }
      }
    }

    throw lastError || new Error('CLI judge failed to return a valid learner evaluation payload');
  };

  const evaluateDialogue = createEvaluateLearnerDialogue({
    LOGS_DIR,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    calculateLearnerOverallScore,
    callLearnerJudge,
    evaluationStore,
    extractLearnerTurnsFromTrace,
    fs,
    getLearnerScoreSignature,
    getScenario,
    judgeCli,
    learnerJudgeModel,
    path,
    toEvaluate,
    verbose,
  });

  if (parallelism === 1 || toEvaluate.length === 1) {
    for (let i = 0; i < toEvaluate.length; i++) {
      const outcome = await evaluateDialogue(toEvaluate[i], i);
      if (outcome.ok) {
        allScores.push(outcome.score);
        if (outcome.holisticScore != null) allHolisticScores.push(outcome.holisticScore);
        succeeded++;
      } else {
        failed++;
      }
    }
  } else {
    let nextIndex = 0;
    const workerCount = Math.min(parallelism, toEvaluate.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < toEvaluate.length) {
        const i = nextIndex++;
        const outcome = await evaluateDialogue(toEvaluate[i], i);
        if (outcome.ok) {
          allScores.push(outcome.score);
          if (outcome.holisticScore != null) allHolisticScores.push(outcome.holisticScore);
          succeeded++;
        } else {
          failed++;
        }
      }
    });
    await Promise.all(workers);
  }

  // Summary
  const learnerEndTime = new Date();
  console.log('\n' + '='.repeat(50));
  console.log('  EVALUATE-LEARNER SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Finished:  ${learnerEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  console.log(`  Duration:  ${((learnerEndTime - learnerStartTime) / 1000 / 60).toFixed(1)} min`);
  console.log(`  Total dialogues:  ${toEvaluate.length}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  if (allScores.length > 0) {
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const sd =
      allScores.length > 1
        ? Math.sqrt(allScores.reduce((acc, s) => acc + (s - avg) ** 2, 0) / (allScores.length - 1))
        : 0;
    console.log(`  Avg learner score: ${avg.toFixed(1)} (SD=${sd.toFixed(1)})`);
  }
  if (allHolisticScores.length > 0) {
    const avgHolistic = allHolisticScores.reduce((a, b) => a + b, 0) / allHolisticScores.length;
    const sdHolistic =
      allHolisticScores.length > 1
        ? Math.sqrt(
            allHolisticScores.reduce((acc, s) => acc + (s - avgHolistic) ** 2, 0) / (allHolisticScores.length - 1),
          )
        : 0;
    console.log(`  Avg learner holistic: ${avgHolistic.toFixed(1)} (SD=${sdHolistic.toFixed(1)})`);
  }
  console.log('');
  return;
}
