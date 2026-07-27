#!/usr/bin/env node
/**
 * Score showcase transcripts against a tutor rubric.
 *
 * The showcase reports two kinds of number already: cost (calls, wall clock,
 * tokens) and conduct (audits, guard coverage, repairs, fallbacks). Neither says
 * whether the tutoring was any good. `config/evaluation-rubric.yaml` — the same
 * live v2.2 instrument the eval pipeline uses on cells — answers that, and it
 * reaches a showcase transcript without any database round trip:
 * `evaluateSuggestion`'s `context.prebuiltTranscript` takes a plain public
 * transcript string, which is exactly what a showcase run already holds.
 * `--rubric-version` swaps in a versioned rubric from `config/rubrics/` instead;
 * each version writes its own artefact and the page keeps them apart, because
 * versions measure different things on different scales and a mean across two of
 * them would be a number with no instrument behind it.
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
 *   --rubric-version <v>
 *                   score with config/rubrics/v<v>/evaluation-rubric.yaml instead
 *                   of the active config/evaluation-rubric.yaml
 *   --out <path>    output basename (default <run-dir>/rubric-v<rubric version>)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { evaluateSuggestion } from '../services/rubricEvaluator.js';
import evalConfigLoader, { clearRubricPathOverride, setRubricPathOverride } from '../services/evalConfigLoader.js';
import { refreshTutorStubShowcaseHtml } from '../services/tutorStubShowcaseHtml.js';
import { SHOWCASE_OVERLAY_ARTIFACTS } from '../services/tutorStubShowcaseScoreOverlay.js';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    judge: { type: 'string', default: 'claude-code.sonnet' },
    turns: { type: 'string', default: 'first,last' },
    'dry-run': { type: 'boolean', default: false },
    'rubric-version': { type: 'string' },
    out: { type: 'string' },
  },
});

const RUBRICS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'rubrics');

/**
 * `config/rubrics/v<version>/evaluation-rubric.yaml`, the layout
 * `eval-cli evaluate --rubric-version` already uses. Deliberately not that
 * command's `resolveRubricPaths`, which requires all five instruments to be
 * present in the directory: this pass scores tutor turns and loads nothing else,
 * so demanding a learner or dialogue rubric it will never open would reject a
 * version that is complete for the only thing being asked of it.
 */
function resolveTutorRubricPath(version) {
  const target = path.join(RUBRICS_DIR, `v${version}`, 'evaluation-rubric.yaml');
  if (!fs.existsSync(target)) throw new Error(`no tutor rubric for version ${version}: ${target}`);
  return target;
}

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

  // One override, set before anything reads a rubric. `loadRubric` is the single
  // door: the dimension list below, the prompt the judge is given, and the
  // weighted aggregate all go through it, so setting the path here is enough to
  // move the whole pass onto another version. The judge model is the deliberate
  // exception — it stays whatever `--judge` says, so a rubric file's own fallback
  // model cannot quietly answer for a sonnet-class one.
  if (args['rubric-version']) setRubricPathOverride(resolveTutorRubricPath(args['rubric-version']));

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

  // Named for the rubric that produced it, not for whichever version was current
  // when this script was written. A v3.0 pass therefore cannot land on top of the
  // v2.2 artefact, which is the one way two versions could end up merged.
  const defaultOutBase = path.join(runDir, `rubric-v${rubricVersion}`);
  const outBase = args.out ? path.resolve(args.out) : defaultOutBase;
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
    // `n/a` and `—` are different facts. v3.0's content_accuracy may be declared
    // not-applicable by the judge, in which case the weighted score renormalizes
    // onto the remaining dimensions — a deliberate verdict, not a missing one.
    // Rendering both as a dash would hide which turns rest on one dimension.
    const cells = dimensionKeys.map((key) => {
      const entry = row.scores?.[key];
      if (entry?.not_applicable === true) return 'n/a';
      const value = entry?.score;
      return Number.isFinite(value) ? String(value) : '—';
    });
    md.push(`| ${row.dialogueId} | ${row.turnLabel} | ${cells.join(' | ')} |`);
  }
  md.push('');
  fs.writeFileSync(`${outBase}.md`, `${md.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`scores: ${path.relative(process.cwd(), `${outBase}.md`)}`);
  console.log(`details: ${path.relative(process.cwd(), `${outBase}.json`)}`);

  // Same reasoning as the PR-benchmark pass: the page predates the scoring, so
  // it is re-rendered here against whichever artefacts are now beside it.
  //
  // The page reads a fixed set of filenames, so an artefact can be written and
  // still never appear — either because it went somewhere else, or because no
  // overlay slot is registered for a rubric version the page has never been
  // taught about. Both are said out loud: a pass that silently fails to show up
  // is indistinguishable from one nobody paid for.
  const artifactName = `${path.basename(outBase)}.json`;
  const registered = Object.values(SHOWCASE_OVERLAY_ARTIFACTS).includes(artifactName);
  const refreshed = refreshTutorStubShowcaseHtml({ report, runDir });
  if (!refreshed) console.log('transcripts.html: not present, nothing to refresh');
  else if (outBase !== defaultOutBase) {
    console.log('transcripts.html: refreshed, but --out is outside the run dir so this pass is not on the page');
  } else if (!registered) {
    console.log(
      `transcripts.html: refreshed, but no overlay slot is registered for ${artifactName}, ` +
        'so this pass is not on the page (add it to SHOWCASE_OVERLAY_ARTIFACTS)',
    );
  } else console.log(`transcripts: ${path.relative(process.cwd(), refreshed)}`);
}

// The override is module-level state on the config loader, so it is cleared on
// every exit path. Nothing else runs in this process today, but a script that
// leaves a rubric override set is exactly the shape of bug that later makes one
// pass silently score under another version's rubric.
main()
  .finally(clearRubricPathOverride)
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
