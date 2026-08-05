function matchesTextFilter(values, patterns) {
  if (!patterns || patterns.length === 0) return true;
  const haystack = (values || []).map((value) => String(value || '').toLowerCase());
  return patterns.some((pattern) => haystack.some((value) => value.includes(pattern.toLowerCase())));
}

function filterRunsForDeletion(runs, filters, expandRunId) {
  const {
    runIds = [],
    dryRunOnly = false,
    descriptionContains = null,
    profileFilters = [],
    scenarioFilters = [],
    statusFilter = null,
    beforeDate = null,
  } = filters;

  const wantedRunIds = new Set(runIds.map((id) => expandRunId(id)));

  return runs.filter((run) => {
    if (wantedRunIds.size > 0 && !wantedRunIds.has(run.id)) return false;
    if (dryRunOnly && !run.metadata?.dryRun) return false;
    if (statusFilter && run.status !== statusFilter) return false;
    if (descriptionContains) {
      const desc = String(run.description || '').toLowerCase();
      if (!desc.includes(descriptionContains.toLowerCase())) return false;
    }

    const allProfiles = [
      ...new Set([...(run.profileNames || []), ...(run.metadata?.profileNames || []).filter(Boolean)]),
    ];
    if (!matchesTextFilter(allProfiles, profileFilters)) return false;

    const scenarioIds = [...new Set((run.metadata?.scenarioIds || []).filter(Boolean))];
    if (!matchesTextFilter(scenarioIds, scenarioFilters)) return false;

    if (beforeDate) {
      const createdAt = run.createdAt ? new Date(run.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime()) || createdAt >= beforeDate) return false;
    }

    return true;
  });
}

function renderDeleteRunsPreview(runs) {
  return runs
    .map((run) => {
      const mode = run.metadata?.dryRun ? 'mock' : 'live';
      const profiles = (run.profileNames || run.metadata?.profileNames || []).slice(0, 2).join(',') || '--';
      const scenarios = (run.metadata?.scenarioIds || []).slice(0, 2).join(',') || '--';
      return `${run.id}  ${mode.padEnd(4)}  ${String(run.status || '--').padEnd(9)}  profiles=${profiles}  scenarios=${scenarios}  desc="${run.description || ''}"`;
    })
    .join('\n');
}

export async function runDeleteRunsCommand(context) {
  const { getFlag, getCsvOption, getOption, expandRunId, evaluationStore } = context;

  const force = getFlag('force');
  const runIds = getCsvOption('run-id');
  const dryRunOnly = getFlag('dry-run-runs');
  const descriptionContains = getOption('description', null);
  const profileFilters = getCsvOption('profile');
  const scenarioFilters = getCsvOption('scenario');
  const statusFilter = getOption('status', null);
  const beforeRaw = getOption('before', null);
  const beforeDate = beforeRaw ? new Date(beforeRaw) : null;

  if (beforeRaw && Number.isNaN(beforeDate?.getTime?.())) {
    console.error('Error: --before must be a valid date in YYYY-MM-DD format');
    process.exit(1);
  }

  const hasFilter =
    runIds.length > 0 ||
    dryRunOnly ||
    Boolean(descriptionContains) ||
    profileFilters.length > 0 ||
    scenarioFilters.length > 0 ||
    Boolean(statusFilter) ||
    Boolean(beforeRaw);

  if (!hasFilter) {
    console.error(
      'Error: delete-runs requires at least one filter (--run-id, --dry-run-runs, --description, --profile, --scenario, --status, or --before)',
    );
    process.exit(1);
  }

  let runs = evaluationStore.listRuns({ limit: null, status: statusFilter });
  runs = filterRunsForDeletion(
    runs,
    {
      runIds,
      dryRunOnly,
      descriptionContains,
      profileFilters,
      scenarioFilters,
      statusFilter,
      beforeDate,
    },
    expandRunId,
  );

  if (runs.length === 0) {
    console.log('\nNo runs matched the delete filters.\n');
    return;
  }

  runs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  console.log(`\nMatched ${runs.length} run(s) for deletion:\n`);
  console.log(renderDeleteRunsPreview(runs));
  console.log('');

  if (!force) {
    console.log('Dry run only. Re-run with --force to actually delete these runs.\n');
    return;
  }

  let deletedRuns = 0;
  let deletedResults = 0;
  let deletedInteractionEvals = 0;
  let deletedAuditRows = 0;

  for (const run of runs) {
    const summary = evaluationStore.deleteRun(run.id);
    deletedRuns += summary?.deletedRuns || 0;
    deletedResults += summary?.deletedResults || 0;
    deletedInteractionEvals += summary?.deletedInteractionEvals || 0;
    deletedAuditRows += summary?.deletedAuditRows || 0;
  }

  console.log(
    `Deleted ${deletedRuns} run(s), ${deletedResults} evaluation row(s), ${deletedInteractionEvals} interaction eval(s), ${deletedAuditRows} audit row(s).\n`,
  );
}
