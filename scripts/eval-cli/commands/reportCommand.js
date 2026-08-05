export async function runReportCommand(context) {
  const { expandRunId, args, evaluationRunner } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'report'));
  if (!runId) {
    console.error('Usage: eval-cli.js report <runId>');
    process.exit(1);
  }
  const report = evaluationRunner.generateReport(runId);
  console.log(report);
}
