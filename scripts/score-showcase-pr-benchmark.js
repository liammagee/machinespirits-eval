#!/usr/bin/env node
/**
 * Score showcase transcripts against the PR-benchmark turn rubric.
 *
 * `config/tutor-pr-benchmark-rubric.yaml` is a different instrument from the
 * v2.2 tutor rubric `scripts/score-showcase-rubric.js` uses: seven axes, labels
 * pass/fail/unsure rather than 0–100, and a unit of one frozen tutor candidate
 * against a case criterion and a set of authored turn obligations. A showcase
 * turn has no criterion and no obligations, so four of its axes cannot be asked
 * here. They are reported as unavailable, with the reason, rather than passed.
 *
 * Three transfer: `safety` and `learner_uptake` in full, `handoff` with its two
 * contract-dependent fail clauses withheld. Every turn in every dialogue is
 * scored, since the value of a pass/fail instrument is the rate across a
 * dialogue rather than a reading of one moment.
 *
 * The prompt carries the rubric's own anchors, exclusions and label definitions
 * verbatim. It does not carry the proof DAG, the release plan, the scaffold or
 * the guard verdicts: the instrumented arm is never scored on its own internal
 * artefacts, and the bare arm has no such artefacts to be scored against.
 *
 * What this does NOT establish: the showcase is free-running, so each arm has
 * its own learner answering its own tutor. A gap between arms is a difference
 * between two dialogues, not an effect of instrumentation. Nothing produced here
 * is a paper claim.
 *
 *   node scripts/score-showcase-pr-benchmark.js <report.json | run-dir> [options]
 *
 *   --judge <ref>   judge model (default claude-code.sonnet; a sonnet-class
 *                   judge is required on this instrument, and only claude-code
 *                   refs are supported because it is the one raw-prompt judge
 *                   path the rubric evaluator exports)
 *   --rubric <path> rubric YAML (default config/tutor-pr-benchmark-rubric.yaml)
 *   --dry-run       build every prompt, call nothing, report the plan
 *   --out <path>    output basename (default <run-dir>/rubric-pr-benchmark-1.0)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callClaudeCodeJudge, getAvailableJudge } from '../services/rubricEvaluator.js';
import { loadTutorPrBenchmarkRubric } from '../services/tutorPrBenchmarkRubric.js';
import {
  SHOWCASE_PR_BENCHMARK_SCHEMA,
  buildShowcasePrBenchmarkPrompt,
  parseShowcasePrBenchmarkVerdict,
  showcaseMachineSafetyLabel,
  showcasePrBenchmarkAxes,
  showcasePriorTurns,
  showcaseTransferableVerdict,
  summarizeShowcasePrBenchmarkRows,
} from '../services/showcasePrBenchmarkScoring.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    judge: { type: 'string', default: 'claude-code.sonnet' },
    rubric: { type: 'string', default: 'config/tutor-pr-benchmark-rubric.yaml' },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});

function resolveReportPath(input) {
  if (!input) throw new Error('usage: node scripts/score-showcase-pr-benchmark.js <report.json | run-dir>');
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
 * Only the claude-code bridge is reachable: `callJudgeModel` is private to the
 * rubric evaluator and `callClaudeCodeJudge` is the one raw-prompt path it
 * exports. Fail here with the reason rather than silently scoring on whatever
 * the rubric config's default judge happens to be.
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

function labelCell(entry) {
  if (!entry) return '—';
  return entry.label;
}

async function main() {
  const reportPath = resolveReportPath(positionals[0]);
  const runDir = path.dirname(reportPath);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const loaded = loadTutorPrBenchmarkRubric(path.resolve(REPO_ROOT, args.rubric));
  const { rubric } = loaded;
  const { inForce, unavailable } = showcasePrBenchmarkAxes(rubric);
  const axisIds = inForce.map((entry) => entry.axisId);

  const jobs = [];
  for (const result of report.results || []) {
    const dialogue = result.dialogue;
    for (const turn of dialogue?.turns || []) {
      jobs.push({
        result,
        turn,
        prompt: buildShowcasePrBenchmarkPrompt({
          rubric,
          axes: inForce,
          scenario: { id: result.scenarioId, label: result.scenarioLabel, summary: result.scenarioSummary },
          priorTurns: showcasePriorTurns(dialogue, turn.index),
          learnerText: turn.learner?.text || '',
          candidateText: turn.tutor?.text || '',
        }),
      });
    }
  }

  console.log(`showcase PR-benchmark scoring: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`rubric: ${rubric.id} v${rubric.version} (${rubric.status}) · judge: ${args.judge}`);
  console.log(`axes asked: ${axisIds.join(', ')}`);
  console.log(`axes unavailable: ${unavailable.map((entry) => entry.axisId).join(', ')}`);
  console.log(
    `dialogues: ${(report.results || []).length} · judge calls: ${jobs.length}${args['dry-run'] ? ' (dry run — nothing will be called)' : ''}`,
  );
  console.log('');

  if (args['dry-run']) {
    for (const job of jobs) {
      console.log(
        `  ${job.result.id} turn ${job.turn.index}: ${job.prompt.length} chars of prompt, ` +
          `${(job.turn.tutor?.text || '').length} chars of candidate`,
      );
    }
    console.log(`\nfirst prompt:\n\n${jobs[0]?.prompt || '(no turns)'}\n`);
    console.log('nothing called. drop --dry-run to score.');
    return;
  }

  const judge = resolveJudge(args.judge);

  const rows = [];
  for (const [index, job] of jobs.entries()) {
    const { result, turn } = job;
    process.stdout.write(`  [${index + 1}/${jobs.length}] ${result.id} turn ${turn.index} … `);
    const row = {
      dialogueId: result.id,
      scenarioId: result.scenarioId,
      armId: result.armId,
      baseline: Boolean(result.baseline),
      modelId: result.modelId,
      turnIndex: turn.index,
      turnCount: result.dialogue?.turnCount ?? null,
      success: false,
      axes: null,
      transferableVerdict: null,
      machineSafetyLabel: showcaseMachineSafetyLabel(turn),
      judgeModel: `${judge.provider}/${judge.model}`,
      error: null,
    };
    try {
      const text = await callClaudeCodeJudge(job.prompt, { model: judge.model });
      row.axes = parseShowcasePrBenchmarkVerdict(text, axisIds);
      row.transferableVerdict = showcaseTransferableVerdict(row.axes);
      row.success = true;
      console.log(axisIds.map((axisId) => `${axisId}=${row.axes[axisId].label}`).join(' '));
    } catch (error) {
      row.error = error.message;
      console.log(`failed: ${error.message}`);
    }
    rows.push(row);
  }

  const summary = summarizeShowcasePrBenchmarkRows(rows, axisIds);
  const outBase = args.out ? path.resolve(args.out) : path.join(runDir, 'rubric-pr-benchmark-1.0');
  const payload = {
    schema: SHOWCASE_PR_BENCHMARK_SCHEMA,
    reportPath: path.relative(process.cwd(), reportPath),
    rubric: {
      id: rubric.id,
      version: rubric.version,
      status: rubric.status,
      path: path.relative(REPO_ROOT, loaded.rubricPath),
      sha256: loaded.sha256,
      unit: rubric.unit,
    },
    judge: args.judge,
    axesAsked: inForce.map((entry) => ({
      axisId: entry.axisId,
      title: entry.axis.title,
      scope: entry.scope,
      reason: entry.reason,
      clausesInForce: entry.clausesInForce || null,
      clausesVoid: entry.clausesVoid || null,
    })),
    axesUnavailable: unavailable,
    // Restated in the artefact so a reader who opens the JSON alone meets both
    // limitations before the labels.
    limitations: [
      "The rubric's unit is a frozen turn with a case criterion and authored obligations. A showcase turn has " +
        'none of those, so four axes were withheld rather than asked. An unavailable axis is not a passed axis.',
      'Free-running showcase: each arm has its own learner answering its own tutor, so a gap between arms is a ' +
        'difference between two dialogues, not an effect of instrumentation.',
    ],
    summary,
    rows,
  };
  fs.writeFileSync(`${outBase}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const md = [];
  md.push(`# Showcase PR-benchmark labels — ${rubric.id} v${rubric.version}`);
  md.push('');
  md.push(`Report: \`${path.relative(process.cwd(), reportPath)}\`  `);
  md.push(`Rubric: \`${path.relative(REPO_ROOT, loaded.rubricPath)}\` (${rubric.status})  `);
  md.push(`Judge: \`${args.judge}\``);
  md.push('');
  md.push(`**Four of seven axes were not asked.** ${payload.limitations[0]}`);
  md.push('');
  md.push(`**Not a controlled comparison.** ${payload.limitations[1]}`);
  md.push('');
  md.push('## Axes asked');
  md.push('');
  md.push('| Axis | Scope | Why |');
  md.push('|---|---|---|');
  for (const entry of payload.axesAsked) md.push(`| ${entry.axisId} | ${entry.scope} | ${entry.reason} |`);
  md.push('');
  const handoff = payload.axesAsked.find((entry) => entry.scope === 'partial');
  if (handoff) {
    md.push(`\`${handoff.axisId}\` in force: ${handoff.clausesInForce.join('; ')}.`);
    md.push('');
    md.push(`\`${handoff.axisId}\` void: ${handoff.clausesVoid.join('; ')}.`);
    md.push('');
  }
  md.push('## Axes not asked');
  md.push('');
  md.push('| Axis | Why not |');
  md.push('|---|---|');
  for (const entry of unavailable) md.push(`| ${entry.axisId} | ${entry.reason} |`);
  md.push('');
  md.push('## Per-arm label counts');
  md.push('');
  md.push(`| Arm | Turns scored | ${axisIds.map((axisId) => `${axisId} (pass/fail/unsure)`).join(' | ')} |`);
  md.push(`|---|---:|${axisIds.map(() => '---:').join('|')}|`);
  for (const arm of summary) {
    const cells = axisIds.map((axisId) => {
      const counts = arm.axes[axisId];
      return `${counts.pass}/${counts.fail}/${counts.unsure}`;
    });
    md.push(`| ${arm.armId} | ${arm.turnsScored} | ${cells.join(' | ')} |`);
  }
  md.push('');
  md.push('## Verdict over the axes in force');
  md.push('');
  md.push('Not the rubric’s `overall_delivery`, which is a composite over the full hard set against a case criterion.');
  md.push('');
  md.push('| Arm | pass | fail | unsure | leak audit pass/fail |');
  md.push('|---|---:|---:|---:|---:|');
  for (const arm of summary) {
    md.push(
      `| ${arm.armId} | ${arm.transferableVerdict.pass} | ${arm.transferableVerdict.fail} | ` +
        `${arm.transferableVerdict.unsure} | ${arm.machineSafety.pass}/${arm.machineSafety.fail} |`,
    );
  }
  md.push('');
  md.push('## Per turn');
  md.push('');
  md.push(`| Dialogue | Turn | ${axisIds.join(' | ')} | in-force verdict | leak audit |`);
  md.push(`|---|---:|${axisIds.map(() => '---').join('|')}|---|---|`);
  for (const row of rows) {
    const cells = axisIds.map((axisId) => labelCell(row.axes?.[axisId]));
    md.push(
      `| ${row.dialogueId} | ${row.turnIndex} | ${cells.join(' | ')} | ` +
        `${row.transferableVerdict || (row.error ? 'error' : '—')} | ${row.machineSafetyLabel || '—'} |`,
    );
  }
  md.push('');
  fs.writeFileSync(`${outBase}.md`, `${md.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`labels: ${path.relative(process.cwd(), `${outBase}.md`)}`);
  console.log(`details: ${path.relative(process.cwd(), `${outBase}.json`)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
