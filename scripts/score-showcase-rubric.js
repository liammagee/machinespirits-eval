#!/usr/bin/env node
/**
 * Score showcase transcripts against the v2.2 tutor rubric.
 *
 * The showcase reports two kinds of number already: cost (calls, wall clock,
 * tokens) and conduct (audits, guard coverage, repairs, fallbacks). Neither says
 * whether the tutoring was any good. `config/evaluation-rubric.yaml` — the same
 * live v2.2 instrument the eval pipeline uses on cells — answers that, and it
 * reaches a showcase transcript without any database round trip:
 * `evaluateSuggestion`'s `context.prebuiltTranscript` takes a plain public
 * transcript string, which is exactly what a showcase run already holds.
 *
 * Two turns are scored per dialogue, mirroring the DB's canonical pair:
 * `tutor_first_turn_score` (Turn 0, the opening move) and
 * `tutor_last_turn_score` (the closing move). Both are judged with the whole
 * public transcript as context, so the last turn is scored as the end of that
 * particular dialogue rather than as a free-standing paragraph.
 *
 * What this does NOT establish: the showcase is free-running, so each arm has
 * its own learner answering its own tutor and the transcripts diverge after the
 * first exchange. A rubric gap between arms is a difference between two
 * dialogues, not an effect of instrumentation. The frozen A/B remains the
 * causal instrument. Nothing produced here is a paper claim.
 *
 * The script touches no database and writes only beside the report it was
 * given.
 *
 *   node scripts/score-showcase-rubric.js <report.json | run-dir> [options]
 *
 *   --judge <ref>   judge model (default claude-code.sonnet — the rubric's own
 *                   sonnet-class judge; gpt-mini-class judges are not reliable
 *                   on this instrument)
 *   --turns <spec>  first,last (default) | first | last | all
 *   --dry-run       build every prompt, call nothing, report the plan
 *   --out <path>    output basename (default <run-dir>/rubric-v2.2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { evaluateSuggestion } from '../services/rubricEvaluator.js';
import evalConfigLoader from '../services/evalConfigLoader.js';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    judge: { type: 'string', default: 'claude-code.sonnet' },
    turns: { type: 'string', default: 'first,last' },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});

function resolveReportPath(input) {
  if (!input) throw new Error('usage: node scripts/score-showcase-rubric.js <report.json | run-dir>');
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
 * The public transcript, and only the public transcript. Everything the
 * instrumented arm computes privately — the proof DAG, the release plan, the
 * scaffold, the guard verdicts — is deliberately excluded, so both arms are
 * judged on what a learner actually saw. Scoring the instrumented arm on its own
 * internal artefacts would be a closed loop.
 */
function publicTranscript(dialogue) {
  const lines = [];
  if (dialogue.openingText) lines.push(`Tutor (opening): ${dialogue.openingText}`, '');
  for (const turn of dialogue.turns || []) {
    lines.push(`Turn ${turn.index}`);
    lines.push(`Learner: ${turn.learner?.text || ''}`);
    lines.push(`Tutor: ${turn.tutor?.text || ''}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * Identical for every arm and every dialogue in a scenario. The judge must see
 * the same task description on both sides or the comparison measures the
 * framing rather than the tutoring.
 */
function scenarioFor(result) {
  return {
    name: result.scenarioLabel || result.scenarioId,
    description: result.scenarioSummary || '',
    expectedBehavior:
      'The tutor works with a learner on a short inquiry with a concealed conclusion. It should draw on the ' +
      'public record it has released, follow the learner’s actual reasoning, and let the learner reach the ' +
      'conclusion rather than announcing it.',
    learnerContext:
      'The learner is an automated diligent learner: it engages seriously with each tutor turn, reasons from ' +
      'what it has been shown, and does not have access to anything the tutor has not made public.',
    requiredElements: [],
    forbiddenElements: [],
  };
}

function turnTargets(dialogue, spec) {
  const turns = dialogue.turns || [];
  if (!turns.length) return [];
  const wanted = String(spec)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (wanted.includes('all')) return turns.map((turn, index) => ({ label: `turn_${turn.index}`, turn, index }));
  const picks = [];
  if (wanted.includes('first')) picks.push({ label: 'first', turn: turns[0], index: 0 });
  if (wanted.includes('last') && turns.length > 1) {
    picks.push({ label: 'last', turn: turns[turns.length - 1], index: turns.length - 1 });
  }
  if (!picks.length) throw new Error(`--turns ${spec} selected nothing; use first, last, first,last or all`);
  return picks;
}

function meanScore(rows) {
  const values = rows.map((row) => row.overallScore).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

async function main() {
  const reportPath = resolveReportPath(positionals[0]);
  const runDir = path.dirname(reportPath);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const rubric = evalConfigLoader.loadRubric();
  const rubricVersion = String(rubric?.version || 'unknown');
  const dimensionKeys = Object.keys(evalConfigLoader.getRubricDimensions());

  const jobs = [];
  for (const result of report.results || []) {
    if (!result.dialogue?.turns?.length) continue;
    const transcript = publicTranscript(result.dialogue);
    for (const target of turnTargets(result.dialogue, args.turns)) {
      jobs.push({ result, target, transcript });
    }
  }

  console.log(`showcase rubric scoring: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`rubric: v${rubricVersion} (${dimensionKeys.length} dimensions) · judge: ${args.judge}`);
  console.log(
    `dialogues: ${(report.results || []).length} · judge calls: ${jobs.length}${args['dry-run'] ? ' (dry run — nothing will be called)' : ''}`,
  );
  console.log('');

  if (args['dry-run']) {
    for (const job of jobs) {
      const turnText = job.target.turn.tutor?.text || '';
      console.log(
        `  ${job.result.id} ${job.target.label} (turn ${job.target.turn.index}): ` +
          `${turnText.length} chars scored against ${job.transcript.length} chars of transcript`,
      );
    }
    console.log('\nnothing called. drop --dry-run to score.');
    return;
  }

  const rows = [];
  for (const [index, job] of jobs.entries()) {
    const { result, target, transcript } = job;
    process.stdout.write(`  [${index + 1}/${jobs.length}] ${result.id} ${target.label} … `);
    const evaluation = await evaluateSuggestion(
      { turn: target.turn.index, tutor_response: target.turn.tutor?.text || '' },
      scenarioFor(result),
      { prebuiltTranscript: transcript },
      { judgeOverride: { model: args.judge } },
    );
    console.log(evaluation.success ? `${formatScore(evaluation.overallScore)}` : `failed: ${evaluation.error}`);
    rows.push({
      dialogueId: result.id,
      scenarioId: result.scenarioId,
      armId: result.armId,
      baseline: Boolean(result.baseline),
      modelId: result.modelId,
      turnLabel: target.label,
      turnIndex: target.turn.index,
      turnCount: result.dialogue.turnCount,
      success: evaluation.success,
      overallScore: evaluation.overallScore,
      scores: evaluation.scores,
      summary: evaluation.summary || null,
      judgeModel: evaluation.judgeModel,
      error: evaluation.error || null,
    });
  }

  const outBase = args.out ? path.resolve(args.out) : path.join(runDir, 'rubric-v2.2');
  const payload = {
    schema: 'machinespirits.tutor-stub.showcase-rubric.v1',
    reportPath: path.relative(process.cwd(), reportPath),
    rubricVersion,
    judge: args.judge,
    turns: args.turns,
    // Restated in the artefact so a reader who opens the JSON alone still meets
    // the limitation before the numbers.
    limitation:
      'Free-running showcase: each arm has its own learner answering its own tutor, so a gap between arms is a ' +
      'difference between two dialogues, not an effect of instrumentation.',
    rows,
  };
  fs.writeFileSync(`${outBase}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const byArm = new Map();
  for (const row of rows) {
    if (!byArm.has(row.armId)) byArm.set(row.armId, []);
    byArm.get(row.armId).push(row);
  }

  const md = [];
  md.push(`# Showcase rubric scores — v${rubricVersion}`);
  md.push('');
  md.push(`Report: \`${path.relative(process.cwd(), reportPath)}\`  `);
  md.push(`Judge: \`${args.judge}\`  `);
  md.push(`Turns scored: \`${args.turns}\``);
  md.push('');
  md.push('**Not a controlled comparison.** ' + payload.limitation);
  md.push('');
  md.push('| Dialogue | Arm | Turn | Turns in dialogue | Overall (0–100) |');
  md.push('|---|---|---|---:|---:|');
  for (const row of rows) {
    md.push(
      `| ${row.dialogueId} | ${row.armId} | ${row.turnLabel} (t${row.turnIndex}) | ${row.turnCount} | ${formatScore(row.overallScore)} |`,
    );
  }
  md.push('');
  md.push('## Per-arm means');
  md.push('');
  md.push('| Arm | First turn | Last turn | All scored |');
  md.push('|---|---:|---:|---:|');
  for (const [armId, armRows] of byArm) {
    md.push(
      `| ${armId} | ${formatScore(meanScore(armRows.filter((row) => row.turnLabel === 'first')))} | ` +
        `${formatScore(meanScore(armRows.filter((row) => row.turnLabel === 'last')))} | ` +
        `${formatScore(meanScore(armRows))} |`,
    );
  }
  md.push('');
  md.push('## Per-dimension');
  md.push('');
  md.push(`| Dialogue | Turn | ${dimensionKeys.join(' | ')} |`);
  md.push(`|---|---|${dimensionKeys.map(() => '---:').join('|')}|`);
  for (const row of rows) {
    const cells = dimensionKeys.map((key) => {
      const value = row.scores?.[key]?.score;
      return Number.isFinite(value) ? String(value) : '—';
    });
    md.push(`| ${row.dialogueId} | ${row.turnLabel} | ${cells.join(' | ')} |`);
  }
  md.push('');
  fs.writeFileSync(`${outBase}.md`, `${md.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`scores: ${path.relative(process.cwd(), `${outBase}.md`)}`);
  console.log(`details: ${path.relative(process.cwd(), `${outBase}.json`)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
