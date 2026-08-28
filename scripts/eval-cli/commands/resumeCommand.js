// Adaptive-cell resume. Runs created by services/adaptiveTutor/ carry
// kind='adaptive_trap' and plan their work from their own scenario source, so
// the generic resume path (which rebuilds standard suggestion tests from the
// shared scenario catalogue) cannot reconstruct them. Mirrors the same
// dispatch the `run` command makes for adaptive profiles.
async function resumeAdaptiveRun({ runId, run, verbose, evalConfigLoader, evaluationStore }) {
  const { createAdaptiveEvaluationRunner } = await import('../../../services/adaptiveTutor/index.js');
  const { resumeAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore });

  const profileName = run.metadata?.profileName || run.metadata?.profileNames?.[0];
  const profiles = evalConfigLoader.loadTutorAgents()?.profiles || {};
  const evalProfile = profileName ? profiles[profileName] : null;
  if (!evalProfile) {
    console.error(`Error: run ${runId} names adaptive profile '${profileName}', which is not in tutor-agents.yaml.`);
    process.exit(1);
  }

  const summary = await resumeAdaptiveEvaluation({ runId, evalProfile, verbose });

  if (summary.alreadyComplete) {
    console.log(`[adaptive] ${runId}: every planned unit already has a row. Nothing to resume.`);
    return;
  }

  const budgetTag = summary.budget
    ? ` budget=$${summary.budget.accumulatedUsd.toFixed(4)}/$${summary.budget.maxUsd.toFixed(2)} (${summary.budget.utilizationPct.toFixed(1)}%)`
    : '';
  const haltTag = summary.halted ? ' [BUDGET HALT]' : '';
  console.log(
    `[adaptive] resume ${runId}: resumed=${summary.persisted.length}/${summary.resumedUnits} of ${summary.totalScenarios} planned llmMode=${summary.llmMode}${budgetTag}${haltTag}`,
  );
  if (summary.unresolvedUnitIds?.length) {
    console.error(`[adaptive] unresolved planned units: ${summary.unresolvedUnitIds.join(', ')}`);
  }
  if (summary.halted) {
    console.error(`[adaptive] halt reason: ${summary.haltReason || '(unknown)'}`);
    process.exit(2);
  }
  console.log('\nResume complete.');
}

export async function runResumeCommand(context) {
  const { expandRunId, args, getFlag, getOption, evaluationRunner, evaluationStore, evalConfigLoader, anovaStats } =
    context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'resume'));
  if (!runId) {
    console.error('Usage: eval-cli.js resume <runId> [--parallelism N] [--verbose] [--force]');
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const force = getFlag('force');
  const parallelism = parseInt(getOption('parallelism', '2'), 10);

  const existingRun = evaluationStore.getRun(runId);
  if (existingRun?.metadata?.kind === 'adaptive_trap') {
    await resumeAdaptiveRun({ runId, run: existingRun, verbose, evalConfigLoader, evaluationStore });
    return;
  }

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
