#!/usr/bin/env node
// Read a finished powered-run root and print the registered results in plain text.
// Pure computation: reads report.json under --run-root, writes nothing.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

function formatProportion(value) {
  return value === null || value === undefined ? 'n/a' : value.toFixed(3);
}

function formatInterval(interval) {
  if (!interval) return 'n/a';
  return `[${interval.lower.toFixed(3)}, ${interval.upper.toFixed(3)}]`;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export function renderPoweredRunReport(report) {
  if (report?.schema !== 'machinespirits.tutor-stub.resistant-learner-merged-powered-report.v1') {
    throw new Error('this reader requires a merged powered-run report');
  }
  const lines = [];
  lines.push(`run status: ${report.status}`);
  if (report.halt_reason) lines.push(`halt reason: ${report.halt_reason}`);
  if (report.execution) {
    lines.push(
      `execution: ${report.execution.complete_units} complete, ${report.execution.retained_substantive_units} retained, ` +
        `${report.execution.failed_units} failed, ${report.execution.missing_units} missing; ` +
        `attempts ${report.execution.model_attempts}/${report.execution.model_attempt_ceiling}`,
    );
  }
  for (const face of report.faces) {
    const statistics = face.statistics;
    const statistic = statistics.registered_statistic;
    lines.push('');
    lines.push(`${face.face_id} (${face.study}): ${face.status}`);
    lines.push(
      `  gates: execution ${statistics.completed_rows + face.retained_substantive_failures.count}/${statistics.planned_rows} accounted (${face.gates.execution_and_typed_failure_accounting ? 'pass' : 'FAIL'}), ` +
        `no prohibited delivery ${face.gates.runtime_safety_no_prohibited_delivery ? 'pass' : 'FAIL'}, ` +
        `panel backstop ${face.gates.endpoint_validity_backstop ? 'pass' : 'FAIL'}`,
    );
    lines.push(
      `  registered statistic (rung>=1 among determinate completed): ${statistic.numerator}/${statistic.denominator} = ` +
        `${formatProportion(statistic.proportion)} Wilson95 ${formatInterval(statistic.wilson_95_interval)}; ` +
        `practical floor ${statistic.practical_floor} ${statistic.practical_floor_met ? 'met' : 'NOT MET'}`,
    );
    lines.push(
      `  rungs among determinate: 0:${statistics.rung_counts['0']} 1:${statistics.rung_counts['1']} 2:${statistics.rung_counts['2']}; ` +
        `rung-2 rate ${formatProportion(statistics.rung_2_rate)}`,
    );
    lines.push(
      `  panel: mean pairwise exact agreement ${formatProportion(face.reader_agreement.endpoint_panel.mean_pairwise_exact_agreement)} ` +
        `(backstop ${face.reader_agreement.endpoint_panel.minimum_mean_pairwise_exact_agreement_backstop})`,
    );
    const retainedRows = (report.rows || []).filter(
      (row) => row.job.face_id === face.face_id && row.status === 'retained_substantive_failure',
    );
    lines.push(`  retained typed failures: ${face.retained_substantive_failures.count}`);
    for (const [code, count] of countBy(face.retained_substantive_failures.codes.map((value) => value || 'untyped'))) {
      lines.push(`    ${count}x ${code}`);
    }
    const byWorldRegister = countBy(
      retainedRows.map((row) => `${row.job.world || 'unknown-world'} / ${row.job.register || 'unknown-register'}`),
    );
    for (const [key, count] of byWorldRegister) lines.push(`    ${count}x at ${key}`);
    if (face.prohibited_case_ids.length) {
      lines.push(`  prohibited delivery cases: ${face.prohibited_case_ids.join(', ')}`);
    }
  }
  const [faceA, faceB] = report.faces;
  const pA = faceA?.statistics?.registered_statistic?.proportion;
  const pB = faceB?.statistics?.registered_statistic?.proportion;
  lines.push('');
  if (pA !== null && pA !== undefined && pB !== null && pB !== undefined) {
    lines.push(
      `descriptive face contrast (not pooled, not a registered test): faceA ${formatProportion(pA)} vs faceB ${formatProportion(pB)}; ` +
        `rung-2 rates ${formatProportion(faceA.statistics.rung_2_rate)} vs ${formatProportion(faceB.statistics.rung_2_rate)}`,
    );
  }
  lines.push('cross-face pooling allowed: no; calibration rows included: no');
  return lines.join('\n');
}

function main() {
  const { values } = parseArgs({
    options: { 'run-root': { type: 'string' } },
  });
  const runRoot = values['run-root'];
  if (!runRoot) {
    process.stderr.write('Usage: node scripts/report-resistant-learner-powered-run.js --run-root <dir>\n');
    process.exit(1);
  }
  const reportPath = path.join(runRoot, 'report.json');
  if (!fs.existsSync(reportPath)) {
    process.stdout.write(`no report yet at ${reportPath}\n`);
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  process.stdout.write(`${renderPoweredRunReport(report)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
