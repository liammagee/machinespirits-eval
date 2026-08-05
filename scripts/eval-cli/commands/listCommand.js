export async function runListCommand(context) {
  const { evaluationRunner } = context;

  const options = evaluationRunner.listOptions();

  // Factorial design — the default run mode
  if (options.profiles?.length) {
    const cellProfiles = options.profiles.filter((p) => p.name.startsWith('cell_'));
    const regularProfiles = options.profiles.filter((p) => !p.name.startsWith('cell_'));

    if (cellProfiles.length > 0) {
      console.log('\n2x2x2 Factorial Cells (default `run` configuration):');
      console.log('  A: Recognition  B: Tutor arch.  C: Learner arch.\n');
      for (const p of cellProfiles) {
        const arch = p.dialogueEnabled ? 'ego+superego' : 'single-agent';
        console.log(`  ${p.name.padEnd(32)} ${arch.padEnd(14)} ${p.description || ''}`);
      }
    }

    if (regularProfiles.length > 0) {
      console.log('\nOther Profiles (use --profile <name> or --all-profiles):');
      for (const p of regularProfiles) {
        const ego = p.egoProvider && p.egoModel ? ` [${p.egoProvider}/${p.egoModel}]` : '';
        const dialogue = p.dialogueEnabled ? ` (dialogue: ${p.maxRounds}r)` : ' (single)';
        console.log(`  ${p.name}${ego}${dialogue} - ${p.description || ''}`);
      }
    }
  }

  console.log('\nScenarios:');
  for (const s of options.scenarios) {
    const mt = s.isMultiTurn ? ` [${s.turnCount}T]` : '';
    console.log(`  ${s.id}${mt} - ${s.name || s.id}`);
  }

  console.log('\nProvider Configurations:');
  for (const c of options.configurations) {
    console.log(`  ${c.provider}/${c.model}`);
  }
}
