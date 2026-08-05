const FACTORIAL_2X2X2_PROFILES = [
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
];
const FACTORIAL_2X2X2_PROFILE_SET = new Set(FACTORIAL_2X2X2_PROFILES);

function validateCanonicalFactorialTutorEgoModels(
  { profileNames, modelOverride = null, egoModelOverride = null, allowModelMix = false },
  evalConfigLoader,
) {
  if (allowModelMix) return { ok: true, skipped: 'allow-model-mix' };
  if (!Array.isArray(profileNames) || profileNames.length < 2) return { ok: true, skipped: 'not-enough-profiles' };
  if (!profileNames.every((name) => FACTORIAL_2X2X2_PROFILE_SET.has(name))) {
    return { ok: true, skipped: 'non-canonical-profile-set' };
  }

  let overrideModel = null;
  let overrideSource = null;
  if (modelOverride) {
    const resolved = evalConfigLoader.resolveModel(modelOverride);
    overrideModel = resolved.model;
    overrideSource = '--model';
  } else if (egoModelOverride) {
    const resolved = evalConfigLoader.resolveModel(egoModelOverride);
    overrideModel = resolved.model;
    overrideSource = '--ego-model';
  }

  const rows = profileNames.map((profileName) => {
    const profile = evalConfigLoader.getTutorProfile(profileName);
    if (!profile?.ego?.provider || !profile?.ego?.model) {
      throw new Error(`Profile "${profileName}" is missing tutor ego provider/model.`);
    }

    return {
      profileName,
      model: overrideModel || profile.ego.resolvedModel || profile.ego.model,
      source: overrideSource || `${profile.ego.provider}.${profile.ego.model}`,
    };
  });

  const uniqueModels = [...new Set(rows.map((row) => row.model))];
  if (uniqueModels.length <= 1) return { ok: true, rows };

  return {
    ok: false,
    uniqueModels,
    rows,
  };
}

export async function runEvaluationCommand(context) {
  const { getFlag, getOption, args, evalConfigLoader, evaluationRunner, evaluationStore, anovaStats, fs } = context;

  const verbose = getFlag('verbose');
  const dryRun = getFlag('dry-run');
  // CLI --use-rubric forces rubric on; --skip-rubric forces off; otherwise use config default
  // --dry-run always enables rubric (mock judge has no cost)
  const evalSettings = evalConfigLoader.getEvalSettings();
  const skipRubricEval = dryRun
    ? false
    : getFlag('use-rubric')
      ? false
      : getFlag('skip-rubric') || !evalSettings.useAIJudge;
  const runsPerConfig = parseInt(getOption('runs', '1'), 10);
  const parallelism = parseInt(getOption('parallelism', '2'), 10);
  const description = getOption('description');
  // --max-cost: hard USD ceiling for adaptive-runner real-LLM calls.
  // Plumbs through runAdaptiveEvaluation only; standard runs ignore it.
  const maxCostRaw = getOption('max-cost');
  const maxCostUsd = maxCostRaw == null ? null : Number(maxCostRaw);
  if (maxCostRaw != null && !(maxCostUsd > 0)) {
    console.error(`Error: --max-cost must be a positive number (got '${maxCostRaw}').`);
    process.exit(1);
  }
  const clusterOpt = getOption('cluster');
  const scenarioOpt = getOption('scenario') || getOption('scenarios');
  const allProfiles = getFlag('all-profiles');
  const allowModelMix = getFlag('allow-model-mix');
  const modelOverride = getOption('model');
  const judgeOverride = getOption('judge');
  const judgeCli = getOption('judge-cli') || null;
  const judgeCliModel = getOption('judge-cli-model') || null;
  const tutorModelOverride = getOption('tutor-model');
  const egoModelOverride = getOption('ego-model');
  const superegoModelOverride = getOption('superego-model');
  const learnerModelOverride = getOption('learner-model');
  const learnerEgoModelOverride = getOption('learner-ego-model');
  const learnerSuperegoModelOverride = getOption('learner-superego-model');
  const transcriptMode = getFlag('transcript');
  const maxTokensOverride = getOption('max-tokens');
  // A7 Longitudinal: when supplied, ALL dialogues in this invocation share
  // the Writing Pad keyed by this ID. Omit for per-dialogue synthetic IDs.
  const learnerIdOpt = getOption('learner-id');
  // A5: carry the negotiated dialectical resolution into the delivered
  // suggestion across revision rounds (else discarded — see
  // threadNegotiationResolutionIntoSuggestions in tutorDialogueEngine.js).
  const threadNegotiationResolutionFlag = getFlag('thread-negotiation-resolution');
  // #3 cross-session memory: opt-in ego prompt extension supplied via a file
  // (a file avoids CLI quoting for the narrative); threads to runEvaluation's hook.
  const externalEgoExtensionFile = getOption('external-ego-extension-file');

  // --show-messages or --show-messages=full
  const showMessagesRaw = args.find((a) => a === '--show-messages' || a.startsWith('--show-messages='));
  const showMessages =
    showMessagesRaw === '--show-messages'
      ? true
      : showMessagesRaw?.startsWith('--show-messages=')
        ? showMessagesRaw.split('=')[1] || true
        : false;

  // --live: stream one-line display per API call in real time
  const liveApi = getFlag('live');

  // --cluster and --scenario are mutually exclusive
  if (clusterOpt && scenarioOpt) {
    console.error('Error: --cluster and --scenario are mutually exclusive.');
    process.exit(1);
  }
  if (judgeOverride && judgeCli) {
    console.error('Error: use either --judge or --judge-cli, not both.');
    process.exit(1);
  }
  if (judgeCli && !['claude', 'gemini', 'codex'].includes(judgeCli.toLowerCase())) {
    console.error(`Error: --judge-cli must be 'claude', 'gemini', or 'codex', got '${judgeCli}'`);
    process.exit(1);
  }

  const scenarios = scenarioOpt ? scenarioOpt.split(',').map((s) => s.trim()) : 'all';

  // Determine configurations: explicit --profile overrides everything,
  // --all-profiles loads every profile, default is the 8 factorial cells.
  const profileOpt = getOption('config') || getOption('profile') || getOption('profiles');
  let configurations;
  let isFactorial = false;
  let selectedProfileNames = [];

  if (profileOpt) {
    // Explicit profile selection (single or comma-separated)
    const profileNames = profileOpt.includes(',') ? profileOpt.split(',').map((s) => s.trim()) : [profileOpt];
    selectedProfileNames = profileNames;
    configurations = profileNames.map((name) => ({
      provider: null,
      model: null,
      profileName: name,
      label: name,
    }));
    // Check if the selection happens to be factorial cells
    isFactorial = profileNames.every((n) => n.startsWith('cell_'));
  } else if (allProfiles) {
    configurations = 'profiles';
  } else {
    // Default: 2×2×2 factorial design
    isFactorial = true;
    configurations = 'factorial';
    selectedProfileNames = [...FACTORIAL_2X2X2_PROFILES];
  }

  const shouldGuardFactorialModels =
    selectedProfileNames.length > 1 && selectedProfileNames.every((name) => FACTORIAL_2X2X2_PROFILE_SET.has(name));

  if (shouldGuardFactorialModels) {
    const yamlOverrides = evalConfigLoader.getTutorModelOverrides();
    const effectiveModelOverride = modelOverride || yamlOverrides.modelOverride || null;
    const effectiveEgoModelOverride = egoModelOverride || yamlOverrides.egoModelOverride || null;
    let modelGuard;

    try {
      modelGuard = validateCanonicalFactorialTutorEgoModels(
        {
          profileNames: selectedProfileNames,
          modelOverride: effectiveModelOverride,
          egoModelOverride: effectiveEgoModelOverride,
          allowModelMix,
        },
        evalConfigLoader,
      );
    } catch (err) {
      console.error('\nFactorial model consistency check failed.');
      console.error(`  ${err.message}`);
      process.exit(1);
    }

    if (!modelGuard.ok) {
      console.error('\nError: Canonical 2x2x2 factorial run has mixed tutor ego models.');
      console.error('This introduces a model confound across cells (e.g., 6/8 vs others).');
      console.error('\nDetected tutor ego models by profile:');
      for (const row of modelGuard.rows) {
        console.error(`  - ${row.profileName}: ${row.model} (source: ${row.source})`);
      }
      console.error('\nFix options:');
      console.error('  1) Align profile ego models in config/tutor-agents.yaml');
      console.error('  2) Run with --model <provider.alias> or --ego-model <provider.alias>');
      console.error('  3) Bypass explicitly with --allow-model-mix');
      process.exit(1);
    }
  }

  if (isFactorial) {
    const cellCount = 8;
    console.log('\n2x2x2 Factorial Design');
    console.log(`  Factor A: Recognition      (off / on)`);
    console.log(`  Factor B: Tutor arch.      (single / ego+superego)`);
    console.log(`  Factor C: Learner arch.    (unified / ego_superego)`);
    console.log(`  Cells: ${cellCount}  |  Runs/cell: ${runsPerConfig}  |  Per scenario: ${cellCount * runsPerConfig}`);
    if (modelOverride) {
      console.log(`  Model override: ${modelOverride}`);
    } else if (egoModelOverride || superegoModelOverride) {
      if (egoModelOverride) console.log(`  Ego model override: ${egoModelOverride}`);
      if (superegoModelOverride) console.log(`  Superego model override: ${superegoModelOverride}`);
    }
    if (judgeOverride) {
      console.log(`  Judge override: ${judgeOverride}`);
    } else if (judgeCli) {
      console.log(`  Judge CLI: ${judgeCli}${judgeCliModel ? ` (${judgeCliModel})` : ''}`);
    }
    if (learnerModelOverride) {
      console.log(`  Learner model override: ${learnerModelOverride}`);
    } else if (learnerEgoModelOverride || learnerSuperegoModelOverride) {
      if (learnerEgoModelOverride) console.log(`  Learner ego model override: ${learnerEgoModelOverride}`);
      if (learnerSuperegoModelOverride)
        console.log(`  Learner superego model override: ${learnerSuperegoModelOverride}`);
    }
    if (maxTokensOverride) console.log(`  Max tokens override: ${maxTokensOverride}`);
    console.log('');
  }

  if (clusterOpt) {
    console.log(`Cluster filter: ${clusterOpt}\n`);
  }
  const runStartTime = new Date();
  console.log(
    `Starting evaluation run at ${runStartTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})...\n`,
  );

  // Adaptive-cell dispatch: cells with `runner: adaptive` in
  // tutor-agents.yaml use a different scenario format and runner
  // (services/adaptiveTutor/), so they bypass evaluationRunner entirely.
  const allTutorAgents = evalConfigLoader.loadTutorAgents()?.profiles || {};
  const adaptiveProfiles = selectedProfileNames.filter((name) => allTutorAgents[name]?.runner === 'adaptive');
  if (adaptiveProfiles.length > 0 && adaptiveProfiles.length !== selectedProfileNames.length) {
    console.error(`Error: cannot mix adaptive-runner profiles with standard profiles in one run.`);
    console.error(`  adaptive: ${adaptiveProfiles.join(', ')}`);
    console.error(`  standard: ${selectedProfileNames.filter((n) => !adaptiveProfiles.includes(n)).join(', ')}`);
    process.exit(1);
  }
  if (adaptiveProfiles.length > 0) {
    const { runAdaptiveEvaluation } = await import('../services/adaptiveTutor/index.js');
    const summaries = [];
    let anyHalted = false;
    for (const profileName of adaptiveProfiles) {
      const evalProfile = allTutorAgents[profileName];
      const summary = await runAdaptiveEvaluation({
        profileName,
        evalProfile,
        scenarios,
        runsPerConfig,
        description: description || `Adaptive evaluation: ${profileName}`,
        dryRun,
        verbose,
        maxCostUsd,
      });
      summaries.push(summary);
      const haltTag = summary.halted ? ' [BUDGET HALT]' : '';
      const budgetTag = summary.budget
        ? ` budget=$${summary.budget.accumulatedUsd.toFixed(4)}/$${summary.budget.maxUsd.toFixed(2)} (${summary.budget.utilizationPct.toFixed(1)}%)`
        : '';
      console.log(
        `[adaptive] ${profileName}: runId=${summary.runId} persisted=${summary.persisted.length}/${summary.totalScenarios} llmMode=${summary.llmMode}${budgetTag}${haltTag}`,
      );
      if (summary.halted) {
        anyHalted = true;
        console.error(`[adaptive] halt reason: ${summary.haltReason || '(unknown)'}`);
        break;
      }
    }
    console.log('\nEvaluation complete.');
    process.exit(anyHalted ? 2 : 0);
  }

  const result = await evaluationRunner.runEvaluation({
    scenarios,
    configurations,
    runsPerConfig,
    parallelism,
    skipRubricEval,
    description:
      description || (dryRun ? 'Dry-run evaluation (mock data)' : isFactorial ? '2x2x2 Factorial Evaluation' : null),
    verbose,
    scenarioFilter: clusterOpt || null,
    modelOverride: modelOverride || null,
    judgeOverride: judgeOverride || null,
    judgeCli: judgeCli ? judgeCli.toLowerCase() : null,
    judgeCliModel: judgeCliModel || null,
    tutorModelOverride: tutorModelOverride || null,
    egoModelOverride: egoModelOverride || null,
    superegoModelOverride: superegoModelOverride || null,
    learnerModelOverride: learnerModelOverride || null,
    learnerEgoModelOverride: learnerEgoModelOverride || null,
    learnerSuperegoModelOverride: learnerSuperegoModelOverride || null,
    dryRun,
    transcriptMode,
    maxTokensOverride: maxTokensOverride ? parseInt(maxTokensOverride, 10) : null,
    showMessages,
    liveApi,
    learnerId: learnerIdOpt || null,
    threadNegotiationResolution: threadNegotiationResolutionFlag || false,
    externalEgoExtension:
      externalEgoExtensionFile && fs.existsSync(externalEgoExtensionFile)
        ? fs.readFileSync(externalEgoExtensionFile, 'utf8')
        : null,
  });
  // Extract unique model aliases used across all configs (ego + superego)
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

  console.log('\nEvaluation complete.');
  if (modelAliases.length > 0) {
    console.log(`Models: ${modelAliases.join(', ')}`);
  }

  // Token / cost / latency summary report
  if (result.runId) {
    const runResults = evaluationStore.getResults(result.runId);
    if (runResults.length > 0) {
      const runEndTime = new Date();
      console.log('\n' + '='.repeat(80));
      console.log('  TOKEN & COST SUMMARY');
      console.log('='.repeat(80));
      console.log(`  Finished:  ${runEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
      console.log(`  Duration:  ${((runEndTime - runStartTime) / 1000 / 60).toFixed(1)} min`);

      // Per-result breakdown
      const header = '  #  | Scenario                         | In Tok  | Out Tok | API  | Rounds | Latency   | Cost';
      const divider = '  ' + '-'.repeat(header.length - 2);
      console.log(header);
      console.log(divider);

      let totalIn = 0,
        totalOut = 0,
        totalApi = 0,
        totalRounds = 0,
        totalLatency = 0,
        totalCost = 0;

      runResults.forEach((r, i) => {
        const inTok = r.input_tokens || r.inputTokens || 0;
        const outTok = r.output_tokens || r.outputTokens || 0;
        const apiCalls = r.api_calls || r.apiCalls || 0;
        const rounds = r.dialogue_rounds || r.dialogueRounds || 0;
        const latMs = r.latency_ms || r.latencyMs || 0;
        const cost = r.cost || 0;

        totalIn += inTok;
        totalOut += outTok;
        totalApi += apiCalls;
        totalRounds += rounds;
        totalLatency += latMs;
        totalCost += cost;

        const scenLabel = (r.scenario_id || r.scenarioId || '').substring(0, 32).padEnd(32);
        const latStr = latMs >= 1000 ? `${(latMs / 1000).toFixed(1)}s` : `${latMs}ms`;
        const costStr = cost > 0 ? `$${cost.toFixed(4)}` : '-';
        console.log(
          `  ${String(i + 1).padStart(2)} | ${scenLabel} | ${String(inTok).padStart(7)} | ${String(outTok).padStart(7)} | ${String(apiCalls).padStart(4)} | ${String(rounds).padStart(6)} | ${latStr.padStart(9)} | ${costStr}`,
        );
      });

      console.log(divider);
      const totalLatStr = totalLatency >= 1000 ? `${(totalLatency / 1000).toFixed(1)}s` : `${totalLatency}ms`;
      const totalCostStr = totalCost > 0 ? `$${totalCost.toFixed(4)}` : '-';
      console.log(
        `  ${'TOTAL'.padStart(2)} | ${''.padEnd(32)} | ${String(totalIn).padStart(7)} | ${String(totalOut).padStart(7)} | ${String(totalApi).padStart(4)} | ${String(totalRounds).padStart(6)} | ${totalLatStr.padStart(9)} | ${totalCostStr}`,
      );

      // Per-token cost efficiency
      const totalTok = totalIn + totalOut;
      if (totalTok > 0) {
        const avgLatPerCall = totalApi > 0 ? (totalLatency / totalApi / 1000).toFixed(2) : '-';
        console.log(
          `\n  Tokens: ${totalTok.toLocaleString()} total (${totalIn.toLocaleString()} in + ${totalOut.toLocaleString()} out)`,
        );
        console.log(
          `  Avg latency/API call: ${avgLatPerCall}s  |  Results: ${runResults.length}  |  API calls: ${totalApi}`,
        );
        if (totalCost > 0) {
          console.log(`  Cost/1K tokens: $${((totalCost / totalTok) * 1000).toFixed(4)}`);
        }
      }
      console.log('='.repeat(80));
    }
  }

  console.log(JSON.stringify(result, null, 2));

  // Factorial post-analysis: print cell means and ANOVA for each score type
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
