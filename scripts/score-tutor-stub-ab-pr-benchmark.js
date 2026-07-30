#!/usr/bin/env node
/**
 * Score instrumentation A/B candidates against the PR-benchmark turn rubric.
 *
 * The A/B bench counts broken rules with a deterministic checker. This adds the
 * second instrument on the same candidates already sitting on disk: rubric 3.0's
 * turn-acceptance measure, which is `config/tutor-pr-benchmark-rubric.yaml`
 * asked of a judge model. No candidate is regenerated, so the two instruments
 * grade the exact same text.
 *
 * All seven axes are asked. The showcase scorer has to withhold four of them
 * because a free-running turn has no criterion and no authored contract; a
 * frozen A/B turn has both, which is what the rubric was written for.
 *
 * The authored obligations reach the judge for every candidate alike, including
 * the ones whose tutor was told nothing. That is the same fixed yardstick the
 * deterministic checker already applies. The judge is not told which version of
 * the tutor wrote a turn.
 *
 *   node scripts/score-tutor-stub-ab-pr-benchmark.js <report.json | run-dir> [more...] [options]
 *
 *   --judge <ref>       judge model (default claude-code.sonnet; a Sonnet-class
 *                       judge is required on this instrument, and only
 *                       claude-code refs reach a raw-prompt judge path)
 *   --rubric <path>     rubric YAML (default config/tutor-pr-benchmark-rubric.yaml)
 *   --models <ids>      comma-separated speaking models to score (default all)
 *   --arms <ids>        comma-separated versions of the tutor to score (default all)
 *   --turns N           score only the first N turns of each scenario
 *   --concurrency N     judge calls in flight (default 4)
 *   --dry-run           build every prompt, call nothing, report the plan
 *   --out <path>        output basename (default <first-run-dir>/rubric-pr-benchmark-1.0)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callClaudeCodeJudge, getAvailableJudge } from '../services/rubricEvaluator.js';
import { loadTutorPrBenchmarkRubric } from '../services/tutorPrBenchmarkRubric.js';
import {
  AB_PR_BENCHMARK_SCHEMA,
  abFrozenPublicPrefix,
  abHardAxisVerdict,
  abPrBenchmarkAxes,
  abTurnObligations,
  buildAbPrBenchmarkPrompt,
  parseAbPrBenchmarkVerdict,
  summarizeAbPrBenchmarkRows,
} from '../services/tutorStubAbPrBenchmarkScoring.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    judge: { type: 'string', default: 'claude-code.sonnet' },
    rubric: { type: 'string', default: 'config/tutor-pr-benchmark-rubric.yaml' },
    models: { type: 'string' },
    arms: { type: 'string' },
    turns: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});

function resolveReportPath(input) {
  const target = path.resolve(input);
  if (!fs.existsSync(target)) throw new Error(`no such report or run directory: ${target}`);
  if (fs.statSync(target).isDirectory()) {
    const candidate = path.join(target, 'report.json');
    if (!fs.existsSync(candidate)) throw new Error(`no report.json in ${target}`);
    return candidate;
  }
  return target;
}

/**
 * Only the claude-code bridge is reachable: the rubric evaluator keeps its
 * general judge call private and exports one raw-prompt path. Fail with the
 * reason rather than silently scoring on some other judge.
 */
function resolveJudge(ref) {
  const resolved = getAvailableJudge({ judgeOverride: { model: ref } });
  if (resolved.provider !== 'claude-code') {
    throw new Error(
      `--judge ${ref} resolves to provider ${resolved.provider}; this script only supports claude-code refs ` +
        '(for example claude-code.sonnet)',
    );
  }
  return resolved;
}

function csv(value) {
  if (!value) return null;
  return new Set(
    String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

/**
 * Reload the frozen fixture a report was built from and index its bundles by
 * case id. The report records the fixture's hash; a mismatch means the fixture
 * moved under the report, and the obligations we would show the judge are no
 * longer the ones the candidate was written against.
 */
function loadScenarioBundles(scenario) {
  const fixturePath = path.resolve(REPO_ROOT, scenario.fixture);
  const source = fs.readFileSync(fixturePath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');
  if (scenario.fixtureSha256 && sha256 !== scenario.fixtureSha256) {
    throw new Error(
      `fixture ${scenario.fixture} has changed since the run: report recorded ${scenario.fixtureSha256}, file is ${sha256}`,
    );
  }
  const bundles = new Map();
  for (const row of JSON.parse(source).cases || []) {
    if (row?.bundle?.turnId) bundles.set(row.bundle.turnId, row.bundle);
  }
  return bundles;
}

/** Run `worker` over `items` with at most `limit` in flight, preserving order. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function buildJobs({ reportPath, rubric, inForce, modelFilter, armFilter, turnLimit }) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const runDir = path.dirname(reportPath);
  const scenarios = new Map((report.plan?.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const bundlesByScenario = new Map();
  const keptTurns = new Map();
  const jobs = [];

  for (const result of report.results || []) {
    // `status` is the deterministic checker's own verdict on the candidate
    // (`pass`/`fail`), so it must not filter here — a candidate that broke rules
    // is exactly one the judge should also read. Rows that never reached a model
    // (`blocked`, `budget_exhausted`) have no candidate and are skipped.
    if (!result.called || !String(result.candidate || '').trim()) continue;
    if (modelFilter && !modelFilter.has(result.modelId)) continue;
    if (armFilter && !armFilter.has(result.armId)) continue;
    const scenario = scenarios.get(result.scenarioId);
    if (!scenario) throw new Error(`report ${reportPath} has no plan entry for scenario ${result.scenarioId}`);

    if (turnLimit) {
      if (!keptTurns.has(result.scenarioId)) {
        keptTurns.set(
          result.scenarioId,
          new Set((scenario.turns || []).slice(0, turnLimit).map((turn) => turn.caseId)),
        );
      }
      if (!keptTurns.get(result.scenarioId).has(result.caseId)) continue;
    }

    if (!bundlesByScenario.has(result.scenarioId))
      bundlesByScenario.set(result.scenarioId, loadScenarioBundles(scenario));
    const bundle = bundlesByScenario.get(result.scenarioId).get(result.caseId);
    if (!bundle) throw new Error(`fixture ${scenario.fixture} has no frozen turn ${result.caseId}`);

    jobs.push({
      runDir: path.relative(process.cwd(), runDir),
      resultId: result.id,
      scenarioId: result.scenarioId,
      caseId: result.caseId,
      turn: result.turn,
      armId: result.armId,
      modelId: result.modelId,
      brokenRules: (result.failureClusters || []).length,
      candidateChars: (result.candidate || '').length,
      prompt: buildAbPrBenchmarkPrompt({
        rubric,
        axes: inForce,
        scenario,
        publicPrefix: abFrozenPublicPrefix(bundle),
        obligations: abTurnObligations(bundle),
        learnerText: result.learnerText || bundle.learnerText || '',
        candidateText: result.candidate || '',
      }),
    });
  }
  return jobs;
}

async function main() {
  if (!positionals.length) {
    throw new Error('usage: node scripts/score-tutor-stub-ab-pr-benchmark.js <report.json | run-dir> [more...]');
  }
  const reportPaths = positionals.map(resolveReportPath);
  const loaded = loadTutorPrBenchmarkRubric(path.resolve(REPO_ROOT, args.rubric));
  const { rubric } = loaded;
  const { inForce, unavailable } = abPrBenchmarkAxes(rubric);
  const axisIds = inForce.map((entry) => entry.axisId);
  const turnLimit = args.turns ? Number.parseInt(args.turns, 10) : null;
  const concurrency = Math.max(1, Number.parseInt(args.concurrency, 10) || 1);

  const jobs = reportPaths.flatMap((reportPath) =>
    buildJobs({
      reportPath,
      rubric,
      inForce,
      modelFilter: csv(args.models),
      armFilter: csv(args.arms),
      turnLimit,
    }),
  );

  console.log(`A/B PR-benchmark scoring: ${reportPaths.length} report(s)`);
  console.log(`rubric: ${rubric.id} v${rubric.version} (${rubric.status}) · judge: ${args.judge}`);
  console.log(`axes asked: ${axisIds.join(', ')}`);
  console.log(`axes unavailable: ${unavailable.length ? unavailable.map((entry) => entry.axisId).join(', ') : 'none'}`);
  console.log(
    `judge calls: ${jobs.length}${args['dry-run'] ? ' (dry run — nothing will be called)' : ` at concurrency ${concurrency}`}`,
  );
  console.log('');

  if (args['dry-run']) {
    for (const job of jobs) {
      console.log(
        `  ${job.modelId} ${job.armId} turn ${job.turn}: ${job.prompt.length} chars of prompt, ` +
          `${job.candidateChars} chars of candidate, ${job.brokenRules} broken rules`,
      );
    }
    console.log(`\nfirst prompt:\n\n${jobs[0]?.prompt || '(no turns)'}\n`);
    console.log('nothing called. drop --dry-run to score.');
    return;
  }

  const judge = resolveJudge(args.judge);
  let done = 0;
  const rows = await mapWithConcurrency(jobs, concurrency, async (job) => {
    const row = {
      runDir: job.runDir,
      resultId: job.resultId,
      scenarioId: job.scenarioId,
      caseId: job.caseId,
      turn: job.turn,
      armId: job.armId,
      modelId: job.modelId,
      brokenRules: job.brokenRules,
      success: false,
      axes: null,
      hardAxisVerdict: null,
      judgeModel: `${judge.provider}/${judge.model}`,
      error: null,
    };
    try {
      const text = await callClaudeCodeJudge(job.prompt, { model: judge.model });
      row.axes = parseAbPrBenchmarkVerdict(text, axisIds);
      row.hardAxisVerdict = abHardAxisVerdict(row.axes, rubric);
      row.success = true;
    } catch (error) {
      row.error = error.message;
    }
    done += 1;
    const verdict = row.success
      ? `overall=${row.axes.overall_delivery?.label} hard=${row.hardAxisVerdict}`
      : `failed: ${row.error}`;
    console.log(`  [${done}/${jobs.length}] ${job.modelId} ${job.armId} ${job.scenarioId} t${job.turn}: ${verdict}`);
    return row;
  });

  const summary = summarizeAbPrBenchmarkRows(rows, axisIds);
  const outBase = args.out
    ? path.resolve(args.out)
    : path.join(path.dirname(reportPaths[0]), 'rubric-pr-benchmark-1.0');
  const payload = {
    schema: AB_PR_BENCHMARK_SCHEMA,
    reportPaths: reportPaths.map((reportPath) => path.relative(process.cwd(), reportPath)),
    rubric: {
      id: rubric.id,
      version: rubric.version,
      status: rubric.status,
      path: path.relative(REPO_ROOT, loaded.rubricPath),
      sha256: loaded.sha256,
      unit: rubric.unit,
    },
    judge: args.judge,
    axesAsked: inForce.map((entry) => ({ axisId: entry.axisId, title: entry.axis.title, reason: entry.reason })),
    axesUnavailable: unavailable,
    limitations: [
      'The authored obligations reach the judge for every candidate, including candidates whose tutor was shown ' +
        'none of them. That is a fixed yardstick, the same one the deterministic checker applies, not information ' +
        'the tutor had.',
      "Turns after the first in each scenario are counterfactual: the tutor's own earlier reply was discarded and " +
        'the recorded transcript put back.',
      'One judge. Rubric 3.0 asks for two judges and two repeated scores per item before these labels carry weight.',
    ],
    summary,
    rows,
  };
  fs.writeFileSync(`${outBase}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const md = [`# A/B PR-benchmark labels — ${rubric.id} v${rubric.version}`, ''];
  md.push(`Reports: ${payload.reportPaths.map((entry) => `\`${entry}\``).join(', ')}  `);
  md.push(`Rubric: \`${payload.rubric.path}\` (${rubric.status})  `);
  md.push(`Judge: \`${args.judge}\``);
  md.push('');
  md.push('All seven axes are in force: the frozen turn carries a case criterion and its authored obligations.');
  md.push('');
  md.push(
    `| speaker | version | turns | overall pass | overall fail | overall unsure | hard-axis pass | broken rules |`,
  );
  md.push(`|---|---|---|---|---|---|---|---|`);
  for (const entry of summary) {
    const overall = entry.axes.overall_delivery || { pass: 0, fail: 0, unsure: 0 };
    md.push(
      `| ${entry.modelId} | ${entry.armId} | ${entry.turnsScored} | ${overall.pass} | ${overall.fail} | ` +
        `${overall.unsure} | ${entry.hardAxisVerdict.pass} | ${entry.brokenRules} |`,
    );
  }
  md.push('');
  md.push('## Per-axis pass counts');
  md.push('');
  md.push(`| speaker | version | ${axisIds.join(' | ')} |`);
  md.push(`|---|---|${axisIds.map(() => '---').join('|')}|`);
  for (const entry of summary) {
    md.push(
      `| ${entry.modelId} | ${entry.armId} | ` +
        `${axisIds.map((axisId) => `${entry.axes[axisId].pass}/${entry.axes[axisId].scored}`).join(' | ')} |`,
    );
  }
  md.push('');
  md.push('## Limitations');
  md.push('');
  for (const limitation of payload.limitations) md.push(`- ${limitation}`);
  md.push('');
  fs.writeFileSync(`${outBase}.md`, `${md.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`labels:  ${path.relative(process.cwd(), `${outBase}.json`)}`);
  console.log(`report:  ${path.relative(process.cwd(), `${outBase}.md`)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
