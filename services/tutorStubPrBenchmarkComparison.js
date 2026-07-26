import crypto from 'node:crypto';

import {
  auditTutorPrBenchmarkCandidate,
  publicTutorPrBenchmarkPlan,
  runTutorPrBenchmark,
  TUTOR_PR_BENCHMARK_REPORT_SCHEMA,
} from './tutorStubPrBenchmark.js';

export const TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-reaudit.v1';
export const TUTOR_PR_BENCHMARK_BASE_HEAD_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-base-head.v1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function positiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function aggregateClusters(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    for (const cluster of selector(row) || []) counts.set(cluster, Number(counts.get(cluster) || 0) + 1);
  }
  return counts;
}

function clusterDeltas(rows, beforeSelector, afterSelector) {
  const before = aggregateClusters(rows, beforeSelector);
  const after = aggregateClusters(rows, afterSelector);
  return [...new Set([...before.keys(), ...after.keys()])]
    .map((cluster) => ({
      cluster,
      before: Number(before.get(cluster) || 0),
      after: Number(after.get(cluster) || 0),
      delta: Number(after.get(cluster) || 0) - Number(before.get(cluster) || 0),
    }))
    .filter((row) => row.before !== row.after)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.cluster.localeCompare(right.cluster));
}

function comparableSourceJobs(sourceReport, plan) {
  if (sourceReport?.schema !== TUTOR_PR_BENCHMARK_REPORT_SCHEMA) {
    throw new Error(`source report schema must be ${TUTOR_PR_BENCHMARK_REPORT_SCHEMA}`);
  }
  const source = new Map((sourceReport.jobs || []).map((job) => [job.id, job]));
  const expectedIds = plan.jobs.map((job) => job.id);
  const extraIds = [...source.keys()].filter((id) => !expectedIds.includes(id));
  if (extraIds.length > 0) throw new Error(`source report has unexpected jobs: ${extraIds.join(', ')}`);
  return new Map(
    expectedIds.map((id) => {
      const job = source.get(id);
      if (!job || !['pass', 'fail'].includes(job.status) || typeof job.candidate !== 'string') {
        throw new Error(`source report job ${id} has no completed candidate`);
      }
      return [id, job];
    }),
  );
}

export async function reauditTutorPrBenchmarkReport({
  sourceReport,
  plan,
  root,
  sourcePath = null,
  sourceSha256 = null,
  metadata = {},
  auditCandidate = auditTutorPrBenchmarkCandidate,
  now = () => new Date(),
} = {}) {
  if (plan?.status !== 'ready') throw new Error('same-response re-audit requires a ready benchmark plan');
  const sourceJobs = comparableSourceJobs(sourceReport, plan);
  const startedAt = now().toISOString();
  const current = await runTutorPrBenchmark({
    plan,
    root,
    generateCandidate: async ({ job }) => {
      const saved = sourceJobs.get(job.id);
      return {
        text: saved.candidate,
        provider: saved.provider || job.model.provider,
        model: saved.model || job.model.model,
        effort: saved.effort || job.model.effort,
        latencyMs: 0,
        tokenUsageAvailable: false,
      };
    },
    auditCandidate,
    metadata: { mode: 'same_response_reaudit', modelCalls: 0 },
    now,
  });
  const rows = current.jobs.map((after) => {
    const before = sourceJobs.get(after.id);
    const beforePass = before.status === 'pass';
    const afterPass = after.status === 'pass';
    const beforeSafety = before.audit?.safetyFailure === true;
    const afterSafety = after.audit?.safetyFailure === true;
    return {
      id: after.id,
      caseId: after.caseId,
      modelId: after.modelId,
      candidateSha256: sha256(before.candidate),
      before: {
        pass: beforePass,
        safetyFailure: beforeSafety,
        failureClusters: before.failureClusters || before.audit?.failureClusters || [],
        hardFailureClusters: before.hardFailureClusters || before.audit?.hardFailureClusters || [],
      },
      after: {
        pass: afterPass,
        safetyFailure: afterSafety,
        failureClusters: after.failureClusters || after.audit?.failureClusters || [],
        hardFailureClusters: after.hardFailureClusters || after.audit?.hardFailureClusters || [],
      },
      improved: !beforePass && afterPass,
      regressed: beforePass && !afterPass,
      safetyIntroduced: !beforeSafety && afterSafety,
      safetyCleared: beforeSafety && !afterSafety,
      audit: after.audit,
    };
  });
  const summary = {
    candidates: rows.length,
    improved: rows.filter((row) => row.improved).length,
    regressed: rows.filter((row) => row.regressed).length,
    unchangedPass: rows.filter((row) => row.before.pass && row.after.pass).length,
    unchangedFail: rows.filter((row) => !row.before.pass && !row.after.pass).length,
    safetyIntroduced: rows.filter((row) => row.safetyIntroduced).length,
    safetyCleared: rows.filter((row) => row.safetyCleared).length,
  };
  const status = summary.regressed > 0 || summary.safetyIntroduced > 0 ? 'fail' : 'pass';
  return {
    schema: TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA,
    mode: 'same_response_reaudit',
    status,
    startedAt,
    completedAt: now().toISOString(),
    metadata: {
      ...metadata,
      modelCalls: 0,
      sourcePath,
      sourceGitSha: sourceReport.metadata?.gitSha || null,
      sourceReportSha256: sourceSha256 || sha256(`${JSON.stringify(sourceReport)}\n`),
    },
    plan: publicTutorPrBenchmarkPlan(plan),
    summary,
    hardFailureClusterDeltas: clusterDeltas(
      rows,
      (row) => row.before.hardFailureClusters,
      (row) => row.after.hardFailureClusters,
    ),
    failureClusterDeltas: clusterDeltas(
      rows,
      (row) => row.before.failureClusters,
      (row) => row.after.failureClusters,
    ),
    rows,
  };
}

function planFingerprint(plan) {
  return {
    preset: plan.preset,
    configSha256: plan.configSha256,
    models: plan.models,
    cases: plan.cases.map((row) => ({
      id: row.id,
      fixture: row.fixture,
      fixtureSha256: row.fixtureSha256,
      fixtureCaseId: row.fixtureCaseId,
      worldId: row.worldId,
      turn: row.turn,
    })),
    jobs: plan.jobs,
  };
}

export function assertEquivalentTutorPrBenchmarkPlans(basePlan, headPlan) {
  const base = planFingerprint(basePlan);
  const head = planFingerprint(headPlan);
  if (JSON.stringify(base) !== JSON.stringify(head)) {
    throw new Error(
      'base and head benchmark plans differ; comparison requires identical config, models, cases, and fixtures',
    );
  }
  return { fingerprint: sha256(JSON.stringify(base)), plan: base };
}

export function buildTutorPrBenchmarkBaseHeadPlan({ benchmarkPlan, draws = 1, maxCalls = null } = {}) {
  positiveInt(draws, 'draws');
  const plannedCalls = benchmarkPlan.jobs.length * draws * 2;
  const budget = maxCalls === null ? plannedCalls : positiveInt(maxCalls, 'maxCalls');
  const pairs = [];
  for (let draw = 1; draw <= draws; draw += 1) {
    benchmarkPlan.jobs.forEach((job, jobIndex) => {
      pairs.push({
        id: `d${String(draw).padStart(2, '0')}__${job.id}`,
        draw,
        job,
        order: (draw + jobIndex) % 2 === 1 ? ['base', 'head'] : ['head', 'base'],
      });
    });
  }
  return {
    draws,
    plannedCalls,
    maxCalls: budget,
    status: plannedCalls > budget ? 'budget_exhausted' : 'ready',
    pairs,
  };
}

export function summarizeTutorPrBenchmarkBaseHead({
  baseRef,
  headRef,
  baseSha,
  headSha,
  benchmarkPlan,
  comparisonPlan,
  planFingerprint: fingerprint,
  pairs,
  startedAt,
  completedAt,
  metadata = {},
} = {}) {
  if (comparisonPlan.status === 'budget_exhausted') {
    return {
      schema: TUTOR_PR_BENCHMARK_BASE_HEAD_SCHEMA,
      status: 'budget_exhausted',
      startedAt,
      completedAt,
      metadata,
      refs: { base: { ref: baseRef, sha: baseSha }, head: { ref: headRef, sha: headSha } },
      benchmarkPlan,
      comparisonPlan: {
        ...comparisonPlan,
        pairs: comparisonPlan.pairs.map(({ id, draw, job, order }) => ({ id, draw, job, order })),
      },
      summary: {
        pairs: 0,
        headWins: 0,
        baseWins: 0,
        ties: 0,
        bothPass: 0,
        bothFail: 0,
        basePasses: 0,
        headPasses: 0,
        safetyIntroduced: 0,
        safetyCleared: 0,
        calls: 0,
      },
      pairs: [],
    };
  }
  const rows = pairs.map((pair) => {
    const basePass = pair.base.status === 'pass';
    const headPass = pair.head.status === 'pass';
    const baseSafety = pair.base.audit?.safetyFailure === true;
    const headSafety = pair.head.audit?.safetyFailure === true;
    return {
      id: pair.id,
      draw: pair.draw,
      jobId: pair.job.id,
      caseId: pair.job.caseId,
      modelId: pair.job.modelId,
      order: pair.order,
      base: pair.base,
      head: pair.head,
      headWin: !basePass && headPass,
      baseWin: basePass && !headPass,
      tie: basePass === headPass,
      safetyIntroduced: !baseSafety && headSafety,
      safetyCleared: baseSafety && !headSafety,
    };
  });
  const blocked = rows.some((row) => row.base.status === 'blocked' || row.head.status === 'blocked');
  const summary = {
    pairs: rows.length,
    headWins: rows.filter((row) => row.headWin).length,
    baseWins: rows.filter((row) => row.baseWin).length,
    ties: rows.filter((row) => row.tie).length,
    bothPass: rows.filter((row) => row.base.status === 'pass' && row.head.status === 'pass').length,
    bothFail: rows.filter((row) => row.base.status === 'fail' && row.head.status === 'fail').length,
    basePasses: rows.filter((row) => row.base.status === 'pass').length,
    headPasses: rows.filter((row) => row.head.status === 'pass').length,
    safetyIntroduced: rows.filter((row) => row.safetyIntroduced).length,
    safetyCleared: rows.filter((row) => row.safetyCleared).length,
    calls: rows.reduce((count, row) => count + Number(row.base.called === true) + Number(row.head.called === true), 0),
  };
  const outcome = blocked
    ? 'incomplete'
    : summary.safetyIntroduced > 0 || summary.baseWins > summary.headWins
      ? 'regressed'
      : summary.headWins > summary.baseWins
        ? 'improved'
        : 'no_change';
  return {
    schema: TUTOR_PR_BENCHMARK_BASE_HEAD_SCHEMA,
    status: blocked ? 'blocked' : outcome === 'regressed' ? 'fail' : 'pass',
    outcome,
    startedAt,
    completedAt,
    metadata: {
      ...metadata,
      diagnosticOnly: true,
      unseededGeneration: true,
      retriesPerJob: 0,
      planFingerprint: fingerprint,
    },
    refs: { base: { ref: baseRef, sha: baseSha }, head: { ref: headRef, sha: headSha } },
    benchmarkPlan,
    comparisonPlan: {
      draws: comparisonPlan.draws,
      plannedCalls: comparisonPlan.plannedCalls,
      maxCalls: comparisonPlan.maxCalls,
    },
    summary,
    hardFailureClusterDeltas: clusterDeltas(
      rows,
      (row) => row.base.hardFailureClusters || row.base.audit?.hardFailureClusters || [],
      (row) => row.head.hardFailureClusters || row.head.audit?.hardFailureClusters || [],
    ),
    pairs: rows,
  };
}

export function renderTutorPrBenchmarkComparisonMarkdown(report) {
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  if (report.schema === TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA) {
    const lines = [
      '# Tutor PR benchmark same-response re-audit',
      '',
      `- Status: **${report.status}**`,
      '- Model calls: **0**',
      `- Source commit: \`${report.metadata.sourceGitSha || 'unknown'}\``,
      `- Improved / regressed: ${report.summary.improved} / ${report.summary.regressed}`,
      `- Safety introduced / cleared: ${report.summary.safetyIntroduced} / ${report.summary.safetyCleared}`,
      '',
      '| Case | Model | Before | After | Change |',
      '| --- | --- | --- | --- | --- |',
    ];
    for (const row of report.rows) {
      const change = row.safetyIntroduced
        ? 'safety introduced'
        : row.regressed
          ? 'regressed'
          : row.improved
            ? 'improved'
            : 'unchanged';
      lines.push(
        `| ${cell(row.caseId)} | ${cell(row.modelId)} | ${row.before.pass ? 'pass' : 'fail'} | ${row.after.pass ? 'pass' : 'fail'} | ${change} |`,
      );
    }
    lines.push('', 'Exact saved candidate text was re-audited under current code; no model was called.', '');
    return lines.join('\n');
  }
  const lines = [
    '# Tutor PR benchmark base/head comparison',
    '',
    `- Status: **${report.status}**`,
    `- Outcome: **${report.outcome || 'incomplete'}**`,
    `- Base: \`${report.refs.base.ref}\` at \`${report.refs.base.sha || 'unknown'}\``,
    `- Head: \`${report.refs.head.ref}\` at \`${report.refs.head.sha || 'unknown'}\``,
    `- Calls: ${report.summary.calls}/${report.comparisonPlan.maxCalls}`,
    `- Head wins / base wins / ties: ${report.summary.headWins} / ${report.summary.baseWins} / ${report.summary.ties}`,
    `- Absolute passes, base / head: ${report.summary.basePasses} / ${report.summary.headPasses}`,
    '',
    '| Draw | Case | Model | Order | Base | Head |',
    '| ---: | --- | --- | --- | --- | --- |',
  ];
  for (const row of report.pairs) {
    lines.push(
      `| ${row.draw} | ${cell(row.caseId)} | ${cell(row.modelId)} | ${row.order.join(' then ')} | ${row.base.status} | ${row.head.status} |`,
    );
  }
  lines.push(
    '',
    'This is a bounded, interleaved diagnostic. CLI generation is not seeded, so paired scheduling reduces order bias but does not make outputs counterfactually identical.',
    '',
  );
  return lines.join('\n');
}
