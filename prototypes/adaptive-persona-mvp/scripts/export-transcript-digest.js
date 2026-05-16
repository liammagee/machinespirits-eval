#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

const input = argValue('input');
if (!input) {
  throw new Error('Usage: export-transcript-digest.js --input report.json [--out dir] [--baseline static_codex] [--target controller_reflexive_psychodynamic_codex]');
}

const baselineCondition = argValue('baseline') || 'static_codex';
const targetCondition = argValue('target') || 'controller_reflexive_psychodynamic_codex';
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const reports = Array.isArray(report.reports) ? report.reports : [report];
const outDir = path.resolve(argValue('out') || path.dirname(input));
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(outDir, `transcript-digest-${stamp}.md`);
fs.writeFileSync(outPath, renderDigest({ report, reports, baselineCondition, targetCondition }));
console.log(`Wrote ${outPath}`);

function renderDigest({ report, reports, baselineCondition, targetCondition }) {
  const lines = [
    '# Adaptive Tutor Transcript Digest',
    '',
    `Source: \`${path.resolve(input)}\``,
    `Generated: ${new Date().toISOString()}`,
    `Baseline/control: \`${baselineCondition}\``,
    `Target: \`${targetCondition}\``,
    '',
    'The source JSON captures full transcripts at:',
    '',
    '`reports[].results[].conditions[condition].original.transcript`',
    '`reports[].results[].conditions[condition].counterfactual.transcript`',
    '',
  ];

  if (report.statistics) {
    lines.push('## Aggregate Statistics', '');
    for (const [metric, stat] of Object.entries(report.statistics)) {
      const s = stat.summary || {};
      lines.push(`- ${metric}: n=${s.n}, meanDiff=${format(s.meanDiff)}, CI=${format(s.bootstrap95Ci?.[0])}..${format(s.bootstrap95Ci?.[1])}, p=${format(s.permutationP)}`);
    }
    lines.push('');
  }

  for (const run of reports) {
    const repeatLabel = run.repeat == null ? 'single' : `repeat ${run.repeat + 1}`;
    lines.push(`## ${repeatLabel}`, '');
    for (const scenario of run.results || []) {
      lines.push(`### ${scenario.scenarioId}`, '');
      for (const branchName of ['original', 'counterfactual']) {
        const baseline = scenario.conditions?.[baselineCondition]?.[branchName];
        const target = scenario.conditions?.[targetCondition]?.[branchName];
        if (!baseline || !target) continue;
        lines.push(`#### ${branchName}`, '');
        lines.push(metricLine('Control', baseline));
        lines.push(metricLine('Target', target));
        lines.push('');
        lines.push('**Control Transcript**', '');
        appendTranscript(lines, baseline.transcript);
        lines.push('');
        lines.push('**Target Transcript**', '');
        appendTranscript(lines, target.transcript);
        lines.push('');
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function metricLine(label, branch) {
  return [
    `- ${label}:`,
    `MVP=${format(branch.blindJudge?.weighted_score)},`,
    `parent=${format(branch.parentDialogueJudge?.weighted_score)},`,
    `outcome=${branch.outcomeTask?.success ? 'success' : 'fail'}`,
    `(${branch.blindJudge?.verdict || 'no verdict'})`,
  ].join(' ');
}

function appendTranscript(lines, transcript = []) {
  for (const turn of transcript) {
    lines.push(`> ${turn.role}: ${String(turn.content || '').replaceAll('\n', ' ')}`);
  }
}

function format(value) {
  return typeof value === 'number' ? Number(value.toFixed(3)).toString() : 'n/a';
}
