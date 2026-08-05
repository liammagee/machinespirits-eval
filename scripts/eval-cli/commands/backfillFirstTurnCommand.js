export async function runBackfillFirstTurnCommand(context) {
  const {
    args,
    buildEvaluationPrompt,
    calculateBaseScore,
    calculateOverallScore,
    calculateRecognitionScore,
    callSelectedCliJudgeText,
    evalConfigLoader,
    evaluationStore,
    expandRunId,
    getFlag,
    getOption,
    getScenario,
  } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'backfill-first-turn'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js backfill-first-turn <runId> [--scenario <id>] [--profile <name>] [--model <model>] [--judge <judge>] [--created-after <iso>] [--created-before <iso>] [--dry-run] [--verbose]',
    );
    console.error('  Rejudges suggestions[0] (turn 0) with NO dialogue context.');
    console.error('  Updates both overall_score and tutor_first_turn_score.');
    process.exit(1);
  }

  const verbose = getFlag('verbose');
  const dryRun = getFlag('dry-run');
  const scenarioFilter = getOption('scenario') || getOption('scenarios') || null;
  const profileFilter = getOption('profile') || getOption('profiles') || null;
  const modelOverride = getOption('model') || null;
  const judgeFilter = getOption('judge') || null;
  const createdAfter = getOption('created-after') || null;
  const createdBefore = getOption('created-before') || null;

  // Resolve effective judge model: CLI --model > YAML config > opus default
  const effectiveJudgeModel =
    modelOverride ||
    (() => {
      try {
        return evalConfigLoader.loadRubric()?.claude_code_judge?.model || null;
      } catch {
        return null;
      }
    })();
  const judgeModelLabel = effectiveJudgeModel ? `claude-code/${effectiveJudgeModel}` : 'claude-opus-4.6';

  // Restore env overrides from run metadata (e.g. domain generalizability runs)
  {
    const runData = evaluationStore.getRun(runId);
    const meta = typeof runData?.metadata === 'string' ? JSON.parse(runData.metadata) : runData?.metadata;
    if (meta?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
      process.env.EVAL_SCENARIOS_FILE = meta.scenariosFile;
      console.log(`[backfill-first-turn] Restored EVAL_SCENARIOS_FILE from run metadata: ${meta.scenariosFile}`);
    }
    if (meta?.contentPath && !process.env.EVAL_CONTENT_PATH) {
      process.env.EVAL_CONTENT_PATH = meta.contentPath;
      console.log(`[backfill-first-turn] Restored EVAL_CONTENT_PATH from run metadata: ${meta.contentPath}`);
    }
  }

  const results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter,
    profileName: profileFilter,
  });

  if (results.length === 0) {
    console.error(`No results found for run: ${runId}`);
    process.exit(1);
  }

  let toBackfill = results.filter((r) => r.success && Array.isArray(r.suggestions) && r.suggestions.length > 1);

  if (judgeFilter) {
    const before = toBackfill.length;
    toBackfill = toBackfill.filter((r) => r.judgeModel === judgeFilter);
    if (before !== toBackfill.length) {
      console.log(`  --judge ${judgeFilter}: filtered ${before} → ${toBackfill.length} rows`);
    }
  }

  if (createdAfter) {
    const before = toBackfill.length;
    toBackfill = toBackfill.filter((r) => typeof r.createdAt === 'string' && r.createdAt >= createdAfter);
    if (before !== toBackfill.length) {
      console.log(`  --created-after ${createdAfter}: filtered ${before} → ${toBackfill.length} rows`);
    }
  }

  if (createdBefore) {
    const before = toBackfill.length;
    toBackfill = toBackfill.filter((r) => typeof r.createdAt === 'string' && r.createdAt <= createdBefore);
    if (before !== toBackfill.length) {
      console.log(`  --created-before ${createdBefore}: filtered ${before} → ${toBackfill.length} rows`);
    }
  }

  if (toBackfill.length === 0) {
    console.log('No multi-turn rows found in scope. Nothing to backfill.');
    return;
  }

  console.log(`\nBackfilling first-turn scores for ${toBackfill.length} multi-turn row(s) in run: ${runId}`);
  console.log('  Mode: strict turn-0 rejudge (suggestions[0], no dialogue context)');
  if (dryRun) console.log('  Dry-run: no DB writes');
  if (modelOverride) console.log(`  Judge model override: ${modelOverride}`);
  console.log('');

  const judgeCli = (getOption('judge-cli') || 'claude').toLowerCase();
  let succeeded = 0;
  let failed = 0;
  let changed = 0;
  const deltas = [];

  for (let i = 0; i < toBackfill.length; i++) {
    const result = toBackfill[i];
    const tag = `[${i + 1}/${toBackfill.length}]`;
    const startTime = Date.now();
    const scenarioId = result.scenarioId;
    const profileName = result.profileName || `${result.provider}/${result.model}`;

    try {
      const scenario = getScenario(scenarioId);
      if (!scenario) {
        console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (scenario not found)`);
        failed++;
        continue;
      }

      const suggestion = result.suggestions?.[0];
      if (!suggestion) {
        console.log(`${tag} ${scenarioId} / ${profileName} ... SKIP (no turn-0 suggestion)`);
        failed++;
        continue;
      }

      // Intentionally no dialogue context: strict cold-start turn-0 evaluation.
      const prompt = buildEvaluationPrompt(
        suggestion,
        {
          name: scenario.name,
          description: scenario.description,
          expectedBehavior: scenario.expected_behavior,
          learnerContext: scenario.learner_context,
          requiredElements: scenario.required_elements,
          forbiddenElements: scenario.forbidden_elements,
        },
        { dialogueContext: null },
      );

      const stdout = await callSelectedCliJudgeText(
        judgeCli,
        effectiveJudgeModel,
        prompt,
        'eval-cli-backfill-first-turn',
      );

      let jsonStr = stdout.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      const parsed = JSON.parse(jsonStr);
      const dimensionMap = {
        relevance: 'relevance',
        specificity: 'specificity',
        pedagogical_soundness: 'pedagogical',
        pedagogical: 'pedagogical',
        personalization: 'personalization',
        actionability: 'actionability',
        tone: 'tone',
      };

      const normalizedScores = {};
      for (const [key, value] of Object.entries(parsed.scores || {})) {
        const normalizedKey = dimensionMap[key] || key;
        if (typeof value === 'object' && value !== null) {
          normalizedScores[normalizedKey] = { score: value.score, reasoning: value.reasoning };
        } else if (typeof value === 'number') {
          normalizedScores[normalizedKey] = { score: value, reasoning: null };
        }
      }

      const overallScore =
        Object.keys(normalizedScores).length > 0 ? calculateOverallScore(normalizedScores) : parsed.overall_score;
      const baseScore = calculateBaseScore(normalizedScores);
      const recognitionScore = calculateRecognitionScore(normalizedScores);
      const oldFirstTurn = result.tutorFirstTurnScore ?? result.overallScore ?? null;
      const delta = oldFirstTurn != null ? overallScore - oldFirstTurn : null;
      const judgeLatencyMs = Date.now() - startTime;

      const evaluation = {
        scores: normalizedScores,
        overallScore,
        tutorFirstTurnScore: overallScore,
        baseScore,
        recognitionScore,
        passesRequired: parsed.validation?.passes_required ?? true,
        passesForbidden: parsed.validation?.passes_forbidden ?? true,
        requiredMissing: parsed.validation?.required_missing || [],
        forbiddenFound: parsed.validation?.forbidden_found || [],
        summary: parsed.summary,
        judgeModel: judgeModelLabel,
        judgeLatencyMs,
      };

      if (!dryRun) {
        evaluationStore.updateResultScores(result.id, evaluation);
      }

      if (delta != null) {
        deltas.push(delta);
        if (Math.abs(delta) > 0.01) changed++;
      }

      succeeded++;
      const deltaLabel = delta == null ? '' : `  delta=${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
      console.log(`${tag} ${scenarioId} / ${profileName} ... first-turn=${overallScore.toFixed(1)}${deltaLabel}`);

      if (verbose && parsed.summary) {
        const truncSummary =
          parsed.summary.length > 250
            ? parsed.summary.slice(0, 250).replace(/\n/g, ' ') + '...'
            : parsed.summary.replace(/\n/g, ' ');
        console.log(`     Judge: ${truncSummary}`);
      }
    } catch (err) {
      failed++;
      const msg = err.stderr ? err.stderr.slice(0, 200) : err.message;
      console.log(`${tag} ${scenarioId} / ${profileName} ... FAIL: ${msg}`);
      if (verbose) console.error(err);
    }
  }

  const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  console.log('\n' + '='.repeat(60));
  console.log('  BACKFILL FIRST-TURN SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Run:        ${runId}`);
  console.log(`  Processed:  ${toBackfill.length}`);
  console.log(`  Succeeded:  ${succeeded}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Changed:    ${changed}`);
  if (avgDelta != null) {
    const sign = avgDelta >= 0 ? '+' : '';
    console.log(`  Avg delta:  ${sign}${avgDelta.toFixed(2)}`);
  }
  if (dryRun) {
    console.log('  Mode:       dry-run (no writes)');
  }
  console.log('');
  return;
}
