export async function runResumeCommand(context) {
  const { expandRunId, args, getFlag, getOption, evaluationRunner, evaluationStore, anovaStats } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'resume'));
  if (!runId) {
    console.error('Usage: eval-cli.js resume <runId> [--parallelism N] [--verbose] [--force]');
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const force = getFlag('force');
  const parallelism = parseInt(getOption('parallelism', '2'), 10);

  const result = await evaluationRunner.resumeEvaluation({
    runId,
    parallelism,
    verbose,
    force,
  });

  if (result.alreadyComplete) {
    return;
  }

  // Extract unique model aliases (same as `run` command)
  const extractAlias = (raw) => {
    if (!raw) return null;
    const dotIdx = raw.indexOf('.');
    return dotIdx !== -1 ? raw.slice(dotIdx + 1) : raw;
  };
  const modelAliases = [
    ...new Set(
      (result.stats || [])
        .flatMap((s) => [extractAlias(s.egoModel || s.model), extractAlias(s.superegoModel)])
        .filter(Boolean),
    ),
  ];

  console.log('\nResume complete.');
  if (modelAliases.length > 0) {
    console.log(`Models: ${modelAliases.join(', ')}`);
  }
  console.log(`  Total tests (all): ${result.totalTests}`);
  console.log(`  Resumed tests: ${result.resumedTests}`);
  console.log(`  Successful (this run): ${result.successfulTests}`);
  console.log(JSON.stringify(result, null, 2));

  // Factorial post-analysis (same as `run` command)
  if (result.runId) {
    const scoreTypes = [
      { column: 'tutor_first_turn_score', label: 'Tutor First-Turn Score' },
      { column: 'base_score', label: 'Base Score' },
      { column: 'recognition_score', label: 'Recognition Score' },
    ];

    for (const { column, label } of scoreTypes) {
      const cellData = evaluationStore.getFactorialCellData(result.runId, { scoreColumn: column });
      const cellKeys = Object.keys(cellData);
      const totalSamples = cellKeys.reduce((sum, k) => sum + cellData[k].length, 0);

      if (totalSamples === 0) continue;

      console.log('\n' + '='.repeat(70));
      console.log(`  FACTORIAL ANALYSIS: ${label.toUpperCase()}`);
      console.log('='.repeat(70));

      for (const key of cellKeys.sort()) {
        const scores = cellData[key];
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const sd =
          scores.length > 1 ? Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (scores.length - 1)) : 0;
        const cellLabel = key.replace(
          /r(\d)_t(\d)_l(\d)/,
          (_, r, t, l) =>
            `Recog=${r === '1' ? 'Y' : 'N'}  Tutor=${t === '1' ? 'Multi' : 'Single'}  Learner=${l === '1' ? 'Psycho' : 'Unified'}`,
        );
        console.log(`  ${cellLabel.padEnd(52)} mean=${mean.toFixed(1)}  sd=${sd.toFixed(1)}  n=${scores.length}`);
      }

      if (totalSamples > 8) {
        const anovaResult = anovaStats.runThreeWayANOVA(cellData);
        console.log(anovaStats.formatANOVAReport(anovaResult, { scoreLabel: label }));
      } else {
        console.log(`\n  Need > 8 total samples for ANOVA (have ${totalSamples}). Increase --runs.`);
      }
    }
  }
}
