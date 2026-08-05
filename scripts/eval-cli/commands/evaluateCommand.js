import { createEvaluateMultiTurnResult } from './evaluateMultiTurnRuntime.js';
import { createEvaluateOneResult } from './evaluateSingleResult.js';
import { createEvaluateJudge } from './evaluateJudge.js';
import { createEvaluateHolisticDialogues } from './evaluateHolisticDialogues.js';
import { isMultiTurnResult, printEvaluateSummary } from './evaluatePresentation.js';
import { runEvaluateReview } from './evaluateReview.js';

export async function runEvaluateCommand(context) {
  const {
    LOGS_DIR,
    args,
    buildBatchedLearnerPrompt,
    buildBatchedPerTurnTutorPrompt,
    buildDialogueFullTranscript,
    buildDialoguePublicTranscript,
    buildDialogueQualityPrompt,
    buildEvaluationPrompt,
    buildLearnerDeliberationPrompt,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    buildPerTurnTutorEvaluationPrompt,
    buildTutorDeliberationPrompt,
    buildTutorHolisticEvaluationPrompt,
    calculateBaseScore,
    calculateDeliberationScore,
    calculateDialogueQualityScore,
    calculateLearnerOverallScore,
    calculateOverallScore,
    calculateRecognitionScore,
    calculateTutorHolisticScore,
    callSelectedCliJudgeText,
    clearAllRubricOverrides,
    createHash,
    evaluationRunner,
    evaluationStore,
    expandRunId,
    extractLearnerTurnsFromTrace,
    fs,
    getFlag,
    getOption,
    getScenario,
    hasTutorSuperego,
    path,
    resolveDefaultCliJudgeModelOverride,
    resolveEvaluationScenarioAndDialogueLog,
    resolveRubricPaths,
    setAllRubricOverrides,
  } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'evaluate'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js evaluate <runId> [--scenario <id>] [--profile <name>] [--judge-cli <claude|gemini|codex>] [--model <model>] [--effort <level>] [--judge <judge>] [--force] [--multiturn-only] [--restore-turn0] [--tutor-only] [--skip-deliberation] [--follow] [--review] [--refresh <ms>] [--rubric-version <ver>] [--parallelism N] [--verbose]',
    );
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const force = getFlag('force');
  const follow = getFlag('follow');
  const review = getFlag('review');
  const multiturnOnly = getFlag('multiturn-only');
  const restoreTurn0 = getFlag('restore-turn0');
  const tutorOnly = getFlag('tutor-only');
  const skipDeliberation = getFlag('skip-deliberation');
  const refreshMs = parseInt(getOption('refresh', '5000'), 10);
  const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
  const profileFilter = getOption('profile') || getOption('profiles') || null;
  const modelOverride = getOption('model') || null;
  const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
  const judgeCliEffort = getOption('effort') || null;
  const judgeFilter = getOption('judge') || null;
  const rubricVersionOpt = getOption('rubric-version') || null;
  const parsedParallelism = parseInt(getOption('parallelism', '1'), 10);
  const parallelism = Number.isFinite(parsedParallelism) && parsedParallelism > 0 ? parsedParallelism : 1;

  if (!['claude', 'gemini', 'codex'].includes(judgeCli)) {
    console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
    process.exit(1);
  }

  // Resolve effective judge model: CLI --model > YAML config > default
  // YAML claude_code_judge.model is only relevant for Claude CLI — skip for Gemini/Codex
  const effectiveJudgeModel = modelOverride || resolveDefaultCliJudgeModelOverride(judgeCli);
  const judgeModelLabel = evaluationRunner.getCliJudgeModelLabel(judgeCli, effectiveJudgeModel, judgeCliEffort);

  // Restore env overrides from run metadata (e.g. EVAL_SCENARIOS_FILE for domain generalizability runs)
  {
    const runData = evaluationStore.getRun(runId);
    const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
    if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
      process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
      console.log(`[evaluate] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
    }
    if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
      process.env.EVAL_CONTENT_PATH = meta.contentPath;
      console.log(`[evaluate] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
    }
  }

  // Helper: evaluate a single result via claude CLI
  const evaluateOneResult = createEvaluateOneResult({
    LOGS_DIR,
    buildEvaluationPrompt,
    calculateBaseScore,
    calculateOverallScore,
    calculateRecognitionScore,
    callSelectedCliJudgeText,
    effectiveJudgeModel,
    evaluationStore,
    fs,
    getScenario,
    judgeCli,
    judgeCliEffort,
    judgeModelLabel,
    multiturnOnly,
    path,
    restoreTurn0,
    verbose,
  });

  // Helper: call CLI judge (claude or gemini) and parse JSON response
  const callClaudeJudge = createEvaluateJudge({
    callSelectedCliJudgeText,
    effectiveJudgeModel,
    judgeCli,
    judgeCliEffort,
  });

  // Helper: evaluate a multi-turn result with per-turn tutor + learner scoring
  const evaluateMultiTurnResult = createEvaluateMultiTurnResult({
    LOGS_DIR,
    buildBatchedLearnerPrompt,
    buildBatchedPerTurnTutorPrompt,
    buildDialogueFullTranscript,
    buildDialoguePublicTranscript,
    buildDialogueQualityPrompt,
    buildLearnerDeliberationPrompt,
    buildLearnerEvaluationPrompt,
    buildLearnerHolisticEvaluationPrompt,
    buildPerTurnTutorEvaluationPrompt,
    buildTutorDeliberationPrompt,
    buildTutorHolisticEvaluationPrompt,
    calculateBaseScore,
    calculateDeliberationScore,
    calculateDialogueQualityScore,
    calculateLearnerOverallScore,
    calculateOverallScore,
    calculateRecognitionScore,
    calculateTutorHolisticScore,
    callClaudeJudge,
    createHash,
    evaluationStore,
    extractLearnerTurnsFromTrace,
    fs,
    hasTutorSuperego,
    judgeModelLabel,
    path,
    resolveEvaluationScenarioAndDialogueLog,
    skipDeliberation,
    tutorOnly,
    verbose,
  });

  // Helper: run dialogue quality scoring for a multi-turn result

  // Helper: determine if a result is multi-turn

  // Helper: print summary

  // Helper: run holistic dialogue evaluation for multi-turn dialogues
  const evaluateHolisticDialogues = createEvaluateHolisticDialogues({
    LOGS_DIR,
    buildEvaluationPrompt,
    calculateBaseScore,
    calculateOverallScore,
    calculateRecognitionScore,
    callClaudeJudge,
    fs,
    getScenario,
    judgeModelLabel,
    path,
    verbose,
  });

  // ── Review mode: show stored reasoning without re-evaluating ──
  if (review) {
    runEvaluateReview({ evaluationStore, profileFilter, runId, scenarioFilter, verbose });
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const scores = [];

  if (follow) {
    // ── Follow mode: poll for new unevaluated results ──
    // Show initial status
    const initialResults = evaluationStore.getResults(runId, {
      scenarioId: scenarioFilter,
      profileName: profileFilter,
    });
    const initialTotal = initialResults.filter((r) => r.success).length;
    const initialUnevaluated = initialResults.filter((r) => r.baseScore == null && r.success).length;
    const initialEvaluated = initialTotal - initialUnevaluated;

    console.log(`\nFollowing run: ${runId}`);
    console.log(`  Already scored: ${initialEvaluated}/${initialTotal}`);
    console.log(`  Need scoring: ${initialUnevaluated}`);
    if (modelOverride) console.log(`  Model: ${modelOverride}`);
    console.log(`  Polling every ${refreshMs}ms for new results...`);
    console.log('');

    const processedIds = new Set();
    let _evalCounter = 0;
    let interrupted = false;

    // SIGINT handler: print summary so far and exit
    const sigintHandler = () => {
      interrupted = true;
      console.log('\n\nInterrupted by user.');
      printEvaluateSummary(succeeded, failed, succeeded + failed, scores);
      process.exit(0);
    };
    process.on('SIGINT', sigintHandler);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (!interrupted) {
      // Fetch results that have a suggestion but no rubric evaluation
      const results = evaluationStore.getResults(runId, {
        scenarioId: scenarioFilter,
        profileName: profileFilter,
      });

      const unevaluated = results.filter((r) => r.baseScore == null && r.success && !processedIds.has(r.id));

      // Total results available so far (for progress display)
      const totalResults = results.filter((r) => r.success).length;
      const alreadyEvaluated = results.filter((r) => r.baseScore != null && r.success).length;

      // Process each new unevaluated result (work-stealing queue)
      const batchSize = unevaluated.length;
      // Mark all as processed upfront to avoid re-fetching in next poll
      for (const result of unevaluated) processedIds.add(result.id);
      let batchNext = 0;
      const batchWorkerCount = Math.min(parallelism, batchSize);
      const batchWorkers = Array.from({ length: batchWorkerCount }, async () => {
        while (batchNext < batchSize && !interrupted) {
          const bi = batchNext++;
          const result = unevaluated[bi];
          _evalCounter++;
          const tag = `[${bi + 1}/${batchSize}] (${alreadyEvaluated + bi + 1}/${totalResults} scored)`;

          try {
            const score = isMultiTurnResult(result)
              ? await evaluateMultiTurnResult(result, tag)
              : await evaluateOneResult(result, tag);
            if (score != null) {
              scores.push(score);
              succeeded++;
            } else {
              failed++;
            }
          } catch (err) {
            failed++;
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            const profileName = result.profileName || `${result.provider}/${result.model}`;
            console.log(`${tag} ${result.scenarioId} / ${profileName} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }
        }
      });
      await Promise.all(batchWorkers);

      // Check if run is done and no unevaluated results remain
      const run = evaluationStore.getRun(runId);
      const runStatus = run?.status || 'unknown';

      if (runStatus !== 'running' && unevaluated.length === 0) {
        // Re-check one more time to avoid race condition
        const finalResults = evaluationStore.getResults(runId, {
          scenarioId: scenarioFilter,
          profileName: profileFilter,
        });
        const finalUnevaluated = finalResults.filter(
          (r) => r.baseScore == null && r.success && !processedIds.has(r.id),
        );
        if (finalUnevaluated.length === 0) {
          console.log(`\nRun ${runStatus}. All results evaluated.`);
          break;
        }
      }

      // Status line while waiting
      const evaluatedCount = results.filter((r) => r.baseScore != null).length;
      console.log(
        `Waiting for new results... (${evaluatedCount} evaluated of ${totalResults} total, run ${runStatus})`,
      );

      await sleep(refreshMs);
    }

    process.removeListener('SIGINT', sigintHandler);
    printEvaluateSummary(succeeded, failed, succeeded + failed, scores);

    // Legacy holistic dialogue evaluation (only for --multiturn-only / --restore-turn0 paths)
    if (multiturnOnly || restoreTurn0) {
      const allResults = evaluationStore
        .getResults(runId, {
          scenarioId: scenarioFilter,
          profileName: profileFilter,
        })
        .filter((r) => r.success && r.baseScore != null);
      await evaluateHolisticDialogues(allResults);
    }
  } else {
    // ── One-shot mode (existing behavior) ──

    // Load results for this run
    const results = evaluationStore.getResults(runId, {
      scenarioId: scenarioFilter,
      profileName: profileFilter,
    });

    if (results.length === 0) {
      console.error(`No results found for run: ${runId}`);
      process.exit(1);
    }

    // Filter to unevaluated results unless --force
    // Use baseScore == null to detect skip-rubric results (tutorFirstTurnScore=100 but no rubric dims)
    let toEvaluate = force ? results : results.filter((r) => r.baseScore == null && r.success);

    // --judge: only process rows from a specific judge model
    if (judgeFilter) {
      const before = toEvaluate.length;
      toEvaluate = toEvaluate.filter((r) => r.judgeModel === judgeFilter);
      if (before !== toEvaluate.length) {
        console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toEvaluate.length} rows`);
      }
    }

    // --restore-turn0: only target damaged rows (multi-turn with holistic already set = overwritten by previous --force)
    if (restoreTurn0) {
      const before = toEvaluate.length;
      toEvaluate = toEvaluate.filter(
        (r) => Array.isArray(r.suggestions) && r.suggestions.length > 1 && r.tutorLastTurnScore != null,
      );
      console.log(
        `  --restore-turn0: filtered ${before} → ${toEvaluate.length} damaged rows (multi-turn with holistic already set)`,
      );
    }

    // --multiturn-only: only re-score rows with multiple suggestions (actual multi-turn)
    if (multiturnOnly) {
      const before = toEvaluate.length;
      toEvaluate = toEvaluate.filter((r) => Array.isArray(r.suggestions) && r.suggestions.length > 1);
      if (before !== toEvaluate.length) {
        console.log(`  --multiturn-only: filtered ${before} → ${toEvaluate.length} rows with >1 turn`);
      }
    }

    // Safeguard: warn if --force would overwrite rows from multiple judges without --judge
    if (force && !judgeFilter) {
      const judges = [...new Set(toEvaluate.map((r) => r.judgeModel).filter(Boolean))];
      if (judges.length > 1) {
        console.error(`\n⚠  SAFETY: --force targets rows from ${judges.length} different judges: ${judges.join(', ')}`);
        console.error('  This will overwrite ALL of them with the current judge (Opus).');
        console.error('  Use --judge <model> to scope to a single judge. Aborting.\n');
        process.exit(1);
      }
    }

    // ── Rubric version override: clone rows into derived run ──
    let effectiveRunId = runId;
    if (rubricVersionOpt) {
      const _rubricPaths = resolveRubricPaths(rubricVersionOpt);
      console.log(
        `\n  --rubric-version ${rubricVersionOpt}: scoring with versioned rubrics from config/rubrics/v${rubricVersionOpt}/`,
      );

      // Clone source rows into derived run (idempotent)
      const { derivedRunId, clonedIds } = evaluationStore.cloneRowsForRubricVersion(
        runId,
        toEvaluate,
        rubricVersionOpt,
      );
      effectiveRunId = derivedRunId;
      if (clonedIds.length > 0) {
        console.log(`  Cloned ${clonedIds.length} row(s) into derived run: ${derivedRunId}`);
      } else {
        console.log(`  Derived run already exists: ${derivedRunId} (reusing cloned rows)`);
      }

      // Re-fetch from derived run so scoring writes to the clones
      const derivedResults = evaluationStore.getResults(derivedRunId, {
        scenarioId: scenarioFilter,
        profileName: profileFilter,
      });
      // Always force-evaluate cloned rows (they have NULL scores)
      toEvaluate = derivedResults.filter((r) => r.success);
    }

    if (toEvaluate.length === 0) {
      console.log(
        'All results already have rubric scores. Use --review to inspect reasoning, or --force to re-evaluate.',
      );
      return;
    }

    const singleTurn = toEvaluate.filter((r) => !isMultiTurnResult(r));
    const multiTurn = toEvaluate.filter((r) => isMultiTurnResult(r));

    const evalStartTime = new Date();
    console.log(`\nEvaluating ${toEvaluate.length} result(s) for run: ${effectiveRunId}`);
    console.log(
      `  Started:     ${evalStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
    );
    if (singleTurn.length > 0) console.log(`  Single-turn: ${singleTurn.length}`);
    if (multiTurn.length > 0) console.log(`  Multi-turn:  ${multiTurn.length} (per-turn scoring)`);
    if (tutorOnly) console.log('  --tutor-only: skipping learner + dialogue scoring');
    if (skipDeliberation) console.log('  --skip-deliberation: skipping deliberation quality scoring');
    if (rubricVersionOpt) console.log(`  Rubric version: v${rubricVersionOpt}`);
    if (modelOverride) console.log(`  Model: ${modelOverride}`);
    if (judgeCliEffort) console.log(`  Judge effort: ${judgeCliEffort}`);
    console.log('');

    // ── Set rubric overrides if --rubric-version was specified ──
    if (rubricVersionOpt) {
      setAllRubricOverrides(resolveRubricPaths(rubricVersionOpt));
    }

    try {
      // ── Score single-turn + multi-turn results via work-stealing queue ──
      const toProcess = [...singleTurn.map((r) => ({ r, mt: false })), ...multiTurn.map((r) => ({ r, mt: true }))];
      let nextIndex = 0;
      const workerCount = Math.min(parallelism, toProcess.length);
      if (parallelism > 1) console.log(`  Parallelism: ${workerCount} workers\n`);
      const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < toProcess.length) {
          const i = nextIndex++;
          const { r, mt } = toProcess[i];
          const tag = `[${i + 1}/${toProcess.length}]`;
          try {
            const score = mt ? await evaluateMultiTurnResult(r, tag) : await evaluateOneResult(r, tag);
            if (score != null) {
              scores.push(score);
              succeeded++;
            } else {
              failed++;
            }
          } catch (err) {
            failed++;
            const profileName = r.profileName || `${r.provider}/${r.model}`;
            const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
            console.log(`${tag} ${r.scenarioId} / ${profileName} ... FAIL: ${msg}`);
            if (verbose) console.error(err);
          }
        }
      });
      await Promise.all(workers);

      printEvaluateSummary(succeeded, failed, toEvaluate.length, scores, evalStartTime);

      // Legacy holistic dialogue evaluation for any remaining multi-turn results
      // (kept for backward compat with evaluate --multiturn-only path)
      if (multiturnOnly || restoreTurn0) {
        await evaluateHolisticDialogues(toEvaluate.filter((r) => r.success));
      }

      // Mark derived run as complete
      if (rubricVersionOpt) {
        evaluationStore.completeRun(effectiveRunId);
        console.log(`\nDerived run ${effectiveRunId} marked complete.`);
      }
    } finally {
      // Always clear overrides, even on error
      if (rubricVersionOpt) {
        clearAllRubricOverrides();
      }
    }
  }
  return;
}
