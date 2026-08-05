export async function runRevertCommand(context) {
  const { expandRunId, args, evaluationStore } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'revert'));
  if (!runId) {
    console.error('Usage: eval-cli.js revert <runId>');
    process.exit(1);
  }

  const run = evaluationStore.getRun(runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    process.exit(1);
  }

  if (run.status === 'running') {
    console.log(`Run ${runId} is already in 'running' state.`);
    return;
  }

  console.log(`Reverting run ${runId} from '${run.status}' → 'running'...`);
  evaluationStore.updateRun(runId, { status: 'running' });
  console.log('Done.');
}
