export async function runRejudgeCommand(context) {
  const {
    expandRunId,
    args,
    evaluationStore,
    getFlag,
    getOption,
    setAllRubricOverrides,
    resolveRubricPaths,
    evaluationRunner,
    clearAllRubricOverrides,
  } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'rejudge'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js rejudge <runId> [--judge <model> | --judge-cli <claude|gemini|codex> [--model <model>] [--effort <level>]] [--rubric-version <ver>] [--scenario <id>] [--source-judge <label>] [--limit <N>] [--verbose] [--overwrite] [--skip-learner] [--skip-deliberation]',
    );
    console.error('');
    console.error('By default, creates new rows (preserves history for inter-judge reliability).');
    console.error('Use --overwrite to replace existing scores instead.');
    console.error('Use --skip-learner to skip learner + dialogue + holistic scoring (tutor-only rejudge).');
    console.error('Use --skip-deliberation to skip deliberation scoring.');
    process.exit(1);
  }

  // Restore env overrides from run metadata
  {
    const runData = evaluationStore.getRun(runId);
    const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
    if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
      process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
      console.log(`[rejudge] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
    }
    if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
      process.env.EVAL_CONTENT_PATH = meta.contentPath;
      console.log(`[rejudge] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
    }
  }

  const verbose = getFlag('verbose');
  const overwrite = getFlag('overwrite');
  const skipLearner = getFlag('skip-learner');
  const skipDeliberation = getFlag('skip-deliberation');
  const judgeOverride = getOption('judge') || null;
  const judgeCli = getOption('judge-cli') || null;
  const judgeCliModel = getOption('model') || null;
  const judgeCliEffort = getOption('effort') || null;
  const scenarioFilter = getOption('scenario') || null;
  const limitStr = getOption('limit') || null;
  const limit = limitStr ? parseInt(limitStr, 10) : null;
  const sourceJudge = getOption('source-judge') || null;
  const rubricVersionOpt = getOption('rubric-version') || null;

  if (judgeOverride && judgeCli) {
    console.error('Error: rejudge accepts either --judge or --judge-cli, not both');
    process.exit(1);
  }
  if (judgeCli && !['claude', 'gemini', 'codex'].includes(judgeCli.toLowerCase())) {
    console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
    process.exit(1);
  }

  const rejudgeStartTime = new Date();
  console.log(`\nRejudging run: ${runId}`);
  console.log(
    `  Started:   ${rejudgeStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  );
  if (judgeOverride) console.log(`  Judge override: ${judgeOverride}`);
  if (judgeCli) {
    console.log(
      `  Judge CLI: ${judgeCli}${judgeCliModel ? ` (${judgeCliModel})` : ''}${judgeCliEffort ? ` @ ${judgeCliEffort} effort` : ''}`,
    );
  }
  if (scenarioFilter) console.log(`  Scenario filter: ${scenarioFilter}`);
  if (sourceJudge) console.log(`  Source judge: ${sourceJudge}`);
  if (rubricVersionOpt) console.log(`  Rubric version: v${rubricVersionOpt}`);
  if (limit) console.log(`  Limit: ${limit} records`);
  console.log(`  Mode: ${overwrite ? 'overwrite (replace existing)' : 'preserve history (add new rows)'}`);
  if (skipLearner) console.log('  Skipping: learner + dialogue + holistic scoring');
  if (skipDeliberation) console.log('  Skipping: deliberation scoring');
  console.log('');

  if (rubricVersionOpt) setAllRubricOverrides(resolveRubricPaths(rubricVersionOpt));
  let summary;
  try {
    summary = await evaluationRunner.rejudgeRun(runId, {
      judgeOverride,
      judgeCli,
      judgeCliModel,
      judgeCliEffort,
      verbose,
      scenarioFilter,
      overwrite,
      skipLearner,
      skipDeliberation,
      limit,
      sourceJudge,
    });
  } finally {
    if (rubricVersionOpt) clearAllRubricOverrides();
  }

  const rejudgeEndTime = new Date();
  console.log('\n' + '='.repeat(60));
  console.log('  REJUDGE SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Run:       ${summary.runId}`);
  console.log(`  Finished:  ${rejudgeEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  console.log(`  Duration:  ${((rejudgeEndTime - rejudgeStartTime) / 1000 / 60).toFixed(1)} min`);
  console.log(`  Total:     ${summary.total}`);
  console.log(`  Succeeded: ${summary.succeeded}`);
  console.log(`  Failed:    ${summary.failed}`);
  console.log(`  Old avg:   ${summary.oldAvgScore?.toFixed(2) ?? 'N/A'}`);
  console.log(`  New avg:   ${summary.newAvgScore?.toFixed(2) ?? 'N/A'}`);
  if (summary.scoreDelta != null) {
    const sign = summary.scoreDelta >= 0 ? '+' : '';
    console.log(`  Delta:     ${sign}${summary.scoreDelta.toFixed(2)}`);
  }
  if (summary.usage && summary.usage.calls > 0) {
    console.log(`  API calls: ${summary.usage.calls}`);
    console.log(
      `  Tokens:    ${summary.usage.inputTokens.toLocaleString()} in / ${summary.usage.outputTokens.toLocaleString()} out (${(summary.usage.inputTokens + summary.usage.outputTokens).toLocaleString()} total)`,
    );
    if (summary.usage.cost > 0) {
      console.log(`  Cost:      $${summary.usage.cost.toFixed(4)}`);
    }
  }
  console.log('');
}
