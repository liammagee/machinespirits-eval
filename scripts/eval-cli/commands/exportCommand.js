import { formatTraceEntry } from '../tracePresentation.js';

export async function runExportCommand(context) {
  const { expandRunId, args, getOption, evaluationStore, getScenario, fs, LOGS_DIR, path, __dirname } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'export'));
  if (!runId) {
    console.error('Usage: eval-cli.js export <runId> [--scenario <id>] [--profile <name>] [--output <path>]');
    process.exit(1);
  }

  const scenarioFilter = getOption('scenario') || null;
  const profileFilter = getOption('profile') || null;
  const outputOption = getOption('output') || null;

  const results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter,
    profileName: profileFilter,
  });

  if (results.length === 0) {
    console.log(`\nNo results found for run: ${runId}`);
    return;
  }

  // Build output
  const lines = [];
  lines.push(`# Evaluation Export — Run ${runId}`);
  lines.push(`# ${results.length} result(s)`);
  if (scenarioFilter) lines.push(`# Scenario filter: ${scenarioFilter}`);
  if (profileFilter) lines.push(`# Profile filter: ${profileFilter}`);
  lines.push('');

  for (const result of results) {
    const scenario = getScenario(result.scenarioId);

    lines.push('='.repeat(80));
    lines.push(`Scenario: ${result.scenarioName || result.scenarioId}`);
    lines.push(`Profile:  ${result.profileName || `${result.provider}/${result.model}`}`);
    lines.push(`Provider: ${result.provider}  Model: ${result.model}`);
    if (result.egoModel || result.superegoModel) {
      lines.push(`Ego: ${result.egoModel || 'N/A'}  Superego: ${result.superegoModel || 'N/A'}`);
    }
    lines.push(
      `Score:    ${result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : 'NOT EVALUATED'}`,
    );
    lines.push('='.repeat(80));
    lines.push('');

    if (scenario) {
      if (scenario.learner_context) {
        lines.push('### Scenario Context');
        lines.push(scenario.learner_context.trim());
        lines.push('');
      }
      if (scenario.expected_behavior) {
        lines.push('### Expected Behavior');
        lines.push(scenario.expected_behavior);
        lines.push('');
      }
      if (scenario.required_elements?.length > 0) {
        lines.push('### Required Elements');
        for (const el of scenario.required_elements) lines.push(`- ${el}`);
        lines.push('');
      }
      if (scenario.forbidden_elements?.length > 0) {
        lines.push('### Forbidden Elements');
        for (const el of scenario.forbidden_elements) lines.push(`- ${el}`);
        lines.push('');
      }
    }

    // Tutor suggestion(s)
    if (result.suggestions?.length > 0) {
      lines.push('### Tutor Suggestion');
      for (const s of result.suggestions) {
        if (typeof s === 'string') {
          lines.push(s);
        } else {
          if (s.title) lines.push(`Title: ${s.title}`);
          if (s.message || s.text || s.content) lines.push(`Message: ${s.message || s.text || s.content}`);
          if (s.action) lines.push(`Action: ${s.action}${s.actionTarget ? ' → ' + s.actionTarget : ''}`);
          if (s.reasoning) lines.push(`Reasoning: ${s.reasoning}`);
        }
      }
      lines.push('');
    }

    // Dialogue trace
    if (result.dialogueId) {
      const files = fs.existsSync(LOGS_DIR)
        ? fs.readdirSync(LOGS_DIR).filter((f) => f.includes(result.dialogueId))
        : [];

      if (files.length > 0) {
        try {
          const dialogue = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8'));
          const trace = dialogue.dialogueTrace || [];
          if (trace.length > 0) {
            lines.push('### Dialogue Trace');
            for (const entry of trace) {
              lines.push(formatTraceEntry(entry));
            }
            lines.push('');
          }
        } catch (e) {
          // skip
        }
      }
    }

    if (result.errorMessage) {
      lines.push(`### Error`);
      lines.push(result.errorMessage);
      lines.push('');
    }

    lines.push('');
  }

  // Determine output path
  let outputPath = outputOption;
  if (!outputPath) {
    const exportsDir = path.resolve(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    let filename = `eval-${runId}`;
    if (scenarioFilter) filename += `-${scenarioFilter}`;
    if (profileFilter) filename += `-${profileFilter}`;
    filename += '.md';
    outputPath = path.join(exportsDir, filename);
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  console.log(`\nExported ${results.length} result(s) to: ${outputPath}`);
}
