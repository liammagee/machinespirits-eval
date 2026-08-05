export async function runQuickCommand(context) {
  const { getOption, getFlag, evalConfigLoader, evaluationRunner } = context;

  const scenarioId = getOption('scenario', 'new_user_first_visit');
  const profile = getOption('profile', 'budget');
  const verbose = getFlag('verbose');
  const dryRun = getFlag('dry-run');
  const evalSettingsQt = evalConfigLoader.getEvalSettings();
  const skipRubricEval = dryRun ? false : getFlag('skip-rubric') || !evalSettingsQt.useAIJudge;
  const config = { profileName: profile };

  console.log(`\nRunning quick test (profile: ${profile}, scenario: ${scenarioId}${dryRun ? ', dry-run' : ''})...\n`);
  const result = await evaluationRunner.quickTest(config, {
    scenarioId,
    verbose,
    skipRubricEval,
    dryRun,
  });
  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));
}
