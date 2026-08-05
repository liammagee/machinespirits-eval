export const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_runs',
      description: 'List recent evaluation runs. Returns run IDs, statuses, scores, and descriptions.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max runs to return (default 20)' },
          status: { type: 'string', description: 'Filter by status: running, completed, failed' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_run_report',
      description:
        'Generate a full text report for a run including rankings, dimension breakdown, scenario performance, and ANOVA.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_transcript',
      description: 'Get dialogue transcripts for a run, optionally filtered to a single scenario.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
          scenarioId: { type: 'string', description: 'Optional scenario ID to filter' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_anova',
      description:
        'Run a 2x2x2 three-way ANOVA on factorial cell data for a given run. Requires factor-tagged results.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_evaluation',
      description: 'Start a new evaluation run. Can specify scenarios, profiles, cluster filters, and replications.',
      parameters: {
        type: 'object',
        properties: {
          scenarios: {
            type: 'array',
            items: { type: 'string' },
            description: 'Scenario IDs to run (omit for all)',
          },
          profiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Profile names to test (omit for default factorial)',
          },
          cluster: {
            type: 'string',
            description:
              'Scenario cluster filter: single-turn, multi-turn, or category names (core, mood, benchmark, recognition, multi_turn). Comma-separated for multiple.',
          },
          runs: { type: 'number', description: 'Replications per cell (default 1)' },
          description: { type: 'string', description: 'Description for this run' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quick_test',
      description: 'Run a quick single-scenario test with one profile.',
      parameters: {
        type: 'object',
        properties: {
          scenarioId: { type: 'string', description: 'Scenario ID (default: new_user_first_visit)' },
          profile: { type: 'string', description: 'Profile name (default: budget)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cleanup_stale',
      description: 'Find and optionally complete stale runs stuck in "running" state.',
      parameters: {
        type: 'object',
        properties: {
          olderThanMinutes: { type: 'number', description: 'Staleness threshold (default 30)' },
          force: { type: 'boolean', description: 'Actually complete them (default false = dry run)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_options',
      description: 'List available scenarios, configurations, and profiles.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_results',
      description: 'Export full results for a run as JSON (run metadata, stats, scenario stats, individual results).',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_run',
      description: 'Mark an incomplete run as completed with whatever results exist.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'revert_run',
      description: 'Revert a completed/failed run back to "running" status.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_run_status',
      description: 'Get detailed status of a run including per-profile stats and scenario breakdown.',
      parameters: {
        type: 'object',
        properties: {
          runId: { type: 'string', description: 'The evaluation run ID' },
        },
        required: ['runId'],
      },
    },
  },
];

function truncate(str, maxLen = 4000) {
  if (typeof str !== 'string') str = JSON.stringify(str, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, ${str.length - maxLen} chars omitted)`;
}

export async function executeChatTool(name, params, context) {
  const { evaluationStore, evaluationRunner, anovaStats } = context;
  switch (name) {
    case 'list_runs': {
      const runs = evaluationStore.listRuns({
        limit: params.limit || 20,
        status: params.status || null,
      });
      return JSON.stringify(runs, null, 2);
    }
    case 'get_run_report': {
      const report = evaluationRunner.generateReport(params.runId);
      return truncate(report);
    }
    case 'get_transcript': {
      const results = evaluationStore.getResults(params.runId, {
        scenarioId: params.scenarioId || null,
      });
      if (results.length === 0) return 'No results found for this run.';

      const lines = [];
      for (const r of results) {
        lines.push(
          `--- ${r.scenarioName || r.scenarioId} | ${r.profileName} | score=${r.tutorFirstTurnScore?.toFixed(1) ?? '--'} ---`,
        );
        let printed = false;
        if (r.dialogueId) {
          const dialogue = evaluationStore.loadDialogueLog(r.dialogueId);
          if (dialogue) {
            for (const entry of dialogue.dialogueTrace || []) {
              lines.push(`[${(entry.role || 'unknown').toUpperCase()}] ${entry.content || ''}`);
            }
            printed = true;
          }
        }
        if (!printed && r.suggestions?.length > 0) {
          lines.push('Suggestions:');
          for (const s of r.suggestions) {
            lines.push(`  • ${typeof s === 'string' ? s : s.text || s.message || JSON.stringify(s)}`);
          }
        }
        if (r.evaluationReasoning) lines.push(`Judge: ${r.evaluationReasoning}`);
        lines.push('');
      }
      return truncate(lines.join('\n'));
    }
    case 'run_anova': {
      const scoreTypes = [
        { column: 'tutor_first_turn_score', label: 'Tutor First-Turn Score' },
        { column: 'base_score', label: 'Base Score' },
        { column: 'recognition_score', label: 'Recognition Score' },
      ];
      const parts = [];
      for (const { column, label } of scoreTypes) {
        const cellData = evaluationStore.getFactorialCellData(params.runId, { scoreColumn: column });
        const totalSamples = Object.values(cellData).reduce((s, arr) => s + arr.length, 0);
        if (totalSamples === 0) continue;
        if (totalSamples <= 8) {
          parts.push(`${label}: Only ${totalSamples} samples — need > 8 for ANOVA.`);
          continue;
        }
        const result = anovaStats.runThreeWayANOVA(cellData);
        parts.push(anovaStats.formatANOVAReport(result, { scoreLabel: label }));
      }
      return parts.length > 0 ? parts.join('\n') : 'No factorial cell data found for this run.';
    }
    case 'run_evaluation': {
      const scenarios = params.scenarios?.length > 0 ? params.scenarios : 'all';
      let configurations = 'factorial';
      if (params.profiles?.length > 0) {
        configurations = params.profiles.map((name) => ({
          provider: null,
          model: null,
          profileName: name,
          label: name,
        }));
      }
      const result = await evaluationRunner.runEvaluation({
        scenarios,
        configurations,
        runsPerConfig: params.runs || 1,
        description: params.description || 'Chat-initiated evaluation',
        scenarioFilter: params.cluster || null,
      });
      return JSON.stringify(result, null, 2);
    }
    case 'quick_test': {
      const config = { profileName: params.profile || 'budget' };
      const result = await evaluationRunner.quickTest(config, {
        scenarioId: params.scenarioId || 'new_user_first_visit',
      });
      return truncate(JSON.stringify(result, null, 2));
    }
    case 'cleanup_stale': {
      const result = evaluationStore.autoCompleteStaleRuns({
        olderThanMinutes: params.olderThanMinutes || 30,
        dryRun: !params.force,
      });
      return JSON.stringify(result, null, 2);
    }
    case 'list_options': {
      const opts = evaluationRunner.listOptions();
      return truncate(
        JSON.stringify(
          {
            scenarios: opts.scenarios.map((s) => ({ id: s.id, name: s.name, isMultiTurn: s.isMultiTurn })),
            profiles: opts.profiles?.map((p) => ({ name: p.name, description: p.description })),
          },
          null,
          2,
        ),
      );
    }
    case 'export_results': {
      const data = evaluationStore.exportToJson(params.runId);
      return truncate(JSON.stringify(data, null, 2));
    }
    case 'complete_run': {
      const result = evaluationStore.completeRun(params.runId);
      return JSON.stringify(result, null, 2);
    }
    case 'revert_run': {
      const run = evaluationStore.getRun(params.runId);
      if (!run) return `Run not found: ${params.runId}`;
      if (run.status === 'running') return `Run ${params.runId} is already running.`;
      evaluationStore.updateRun(params.runId, { status: 'running' });
      return `Reverted run ${params.runId} from '${run.status}' to 'running'.`;
    }
    case 'get_run_status': {
      const runData = evaluationRunner.getRunResults(params.runId);
      return truncate(
        JSON.stringify(
          {
            run: runData.run,
            stats: runData.stats,
            resultCount: runData.results.length,
          },
          null,
          2,
        ),
      );
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
