export async function runPlayCommandHandler(context) {
  const { getOption, theme, runPlayCommand } = context;

  const humanSide = getOption('as') || 'tutor';
  const humanRole = getOption('role') || 'ego';
  const scenarioId = getOption('scenario') || null;
  const profileName = getOption('profile') || null;

  if (!['tutor', 'learner'].includes(humanSide)) {
    console.error(theme.error(`Invalid --as value: ${humanSide}. Use 'tutor' or 'learner'.`));
    process.exit(1);
  }
  if (!['ego', 'superego', 'both'].includes(humanRole)) {
    console.error(theme.error(`Invalid --role value: ${humanRole}. Use 'ego', 'superego', or 'both'.`));
    process.exit(1);
  }

  await runPlayCommand({ humanSide, humanRole, scenarioId, profileName });
}
