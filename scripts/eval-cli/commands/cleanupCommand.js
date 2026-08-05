export async function runCleanupCommand(context) {
  const { getFlag, getOption, evaluationStore } = context;

  const force = getFlag('force');
  const threshold = parseInt(getOption('older-than', '30'), 10);

  console.log(`\nScanning for stale runs (running > ${threshold} minutes)...`);

  // Dry-run by default; require --force to actually complete
  const dryRun = !force;
  if (dryRun) console.log('  (dry run — pass --force to actually complete stale runs)\n');

  const result = evaluationStore.autoCompleteStaleRuns({
    olderThanMinutes: threshold,
    dryRun,
  });

  if (result.found === 0) {
    console.log('No stale runs found.');
  } else if (dryRun) {
    console.log(`Found ${result.found} stale run(s):\n`);
    for (const run of result.runs) {
      console.log(`  ${run.id}  age=${run.ageMinutes}m  results=${run.resultsFound}  desc="${run.description || ''}"`);
    }
    console.log('\nRe-run with --force to mark these as completed.');
  } else {
    console.log(`Processed ${result.completed} stale run(s):\n`);
    for (const run of result.runs) {
      const status = run.status || (run.alreadyCompleted ? 'already completed' : 'unknown');
      const partial = run.wasPartial ? ` (partial: ${run.completionRate}%)` : '';
      console.log(`  ${run.runId}  → ${status}${partial}  results=${run.resultsFound || '--'}`);
    }
  }

  console.log('');
}
