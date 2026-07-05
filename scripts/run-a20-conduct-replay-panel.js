#!/usr/bin/env node
/**
 * Run the first A20 conduct-policy fixtures as mock episode replays.
 *
 * This is a zero-cost local panel. It preserves each source prefix and checks
 * whether the live turn selects the fixture's expected conduct move.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_FIXTURES = 'exports/dramatic-derivation/a20-conduct-policy/first-policy-fixtures.json';
const FALLBACK_FIXTURES = 'tests/fixtures/a20-conduct-policy-fixtures.json';
const DEFAULT_OUT = 'exports/dramatic-derivation/a20-conduct-policy/replay-panel-report';
const EPISODE_OUT = 'exports/dramatic-derivation/episodes';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function resolveFixturePath() {
  const requested = arg('fixtures', null);
  if (requested) return path.resolve(ROOT, requested);
  const preferred = path.resolve(ROOT, DEFAULT_FIXTURES);
  return existsSync(preferred) ? preferred : path.resolve(ROOT, FALLBACK_FIXTURES);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function dirnameFromResultPath(resultPath) {
  return path.dirname(path.resolve(ROOT, resultPath));
}

function loopDirForLabel(label) {
  return path.resolve(ROOT, 'exports/dramatic-derivation/loop', label);
}

function sourceForFixture(fixture) {
  const trigger = fixture.trigger;
  if (fixture.fixtureId === 'a20-fixture-002-hidden-hurts-candidate') {
    const hiddenLabel = trigger.evidence?.hiddenLabel;
    if (!hiddenLabel) throw new Error(`${fixture.fixtureId} missing evidence.hiddenLabel`);
    return loopDirForLabel(hiddenLabel);
  }
  return dirnameFromResultPath(trigger.source);
}

function labelForFixture(fixture) {
  return `a20-panel-${fixture.fixtureId.replace(/^a20-fixture-\d+-/u, '').replace(/[^a-z0-9]+/giu, '-')}`;
}

function buildEpisodeArgs(fixture) {
  const trigger = fixture.trigger;
  const args = [
    'scripts/run-derivation-episode.js',
    '--from',
    sourceForFixture(fixture),
    '--turn',
    String(trigger.turn),
    '--window',
    '4',
    '--conduct-policy-enforce',
    'on',
    '--label',
    labelForFixture(fixture),
    '--out',
    EPISODE_OUT,
  ];
  if (trigger.triggerType === 'valid_alternative_route_candidate') {
    args.push('--conduct-trigger', JSON.stringify(trigger));
  }
  return args;
}

function liveDecision(diagnosis, turn) {
  return (diagnosis.conductPolicyReport?.decisions || []).find((decision) => decision.turn === turn) || null;
}

function evaluateEpisode(fixture) {
  const label = labelForFixture(fixture);
  const diagnosisPath = path.resolve(ROOT, EPISODE_OUT, label, 'diagnosis.json');
  const diagnosis = readJson(diagnosisPath);
  const trigger = fixture.trigger;
  const decision = liveDecision(diagnosis, trigger.turn);
  const prefixOk = diagnosis.episode?.prefixIntegrity?.ok === true;
  const selectedOk = decision?.selectedMoveFamily === trigger.expectedMoveFamily;
  const complianceOk = decision?.complianceOk === true;
  const noForbiddenRelease = trigger.expectedMoveFamily === 'ask_diagnostic' ? !decision?.realizedRelease : true;
  return {
    fixtureId: fixture.fixtureId,
    episodeLabel: label,
    source: diagnosis.episode?.source || null,
    firstLiveTurn: trigger.turn,
    window: diagnosis.episode?.window ?? null,
    verdict: diagnosis.verdict,
    turnsPlayed: diagnosis.turnsPlayed,
    prefixOk,
    selectedMoveFamily: decision?.selectedMoveFamily || null,
    expectedMoveFamily: trigger.expectedMoveFamily,
    reasonCode: decision?.reasonCode || null,
    complianceOk,
    realizedMove: decision?.realizedMove || null,
    realizedRelease: decision?.realizedRelease || null,
    noForbiddenRelease,
    pass: prefixOk && selectedOk && complianceOk && noForbiddenRelease,
  };
}

function cell(value) {
  if (value == null || value === '') return ' ';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# A20 Conduct-Policy Replay Panel');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(
    'Zero-cost mock episode panel. These are prefix-controlled debugging artifacts, not held-out paid evidence.',
  );
  lines.push('');
  lines.push(`- Fixtures: \`${report.fixturePath}\``);
  lines.push(`- Passed: ${report.passed}/${report.fixtureCount}`);
  lines.push('');
  lines.push(
    '| fixture | episode | source | turn | expected | selected | compliance | prefix | release | verdict | pass |',
  );
  lines.push('|---|---|---|---:|---|---|---|---|---|---|---|');
  for (const row of report.results) {
    lines.push(
      `| ${cell(row.fixtureId)} | \`${cell(row.episodeLabel)}\` | ${cell(row.source?.label)} | ${cell(row.firstLiveTurn)} | ` +
        `${cell(row.expectedMoveFamily)} | ${cell(row.selectedMoveFamily)} | ${row.complianceOk ? 'pass' : 'FAIL'} | ` +
        `${row.prefixOk ? 'pass' : 'FAIL'} | ${cell(row.realizedRelease || 'none')} | ${cell(row.verdict)} | ` +
        `${row.pass ? 'pass' : 'FAIL'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const fixturePath = resolveFixturePath();
  const fixtures = readJson(fixturePath).fixtures || [];
  const selected = fixtures.filter((fixture) =>
    ['a20-fixture-001-dependency-repair-reference', 'a20-fixture-002-hidden-hurts-candidate'].includes(
      fixture.fixtureId,
    ),
  );
  for (const fixture of selected) {
    const args = buildEpisodeArgs(fixture);
    console.log(`\n$ node ${args.join(' ')}`);
    const proc = spawnSync(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    });
    if (proc.stdout) process.stdout.write(proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    if (proc.status !== 0) process.exit(proc.status || 1);
  }

  const results = selected.map(evaluateEpisode);
  const report = {
    schema: 'dramatic-derivation.a20-conduct-policy.replay-panel.v0',
    generatedAt: new Date().toISOString(),
    fixturePath: path.relative(ROOT, fixturePath),
    fixtureCount: selected.length,
    passed: results.filter((row) => row.pass).length,
    results,
  };
  const outStem = path.resolve(ROOT, arg('out', DEFAULT_OUT));
  mkdirSync(path.dirname(outStem), { recursive: true });
  writeFileSync(`${outStem}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${outStem}.md`, renderMarkdown(report));
  console.log(`\nreplay panel written: ${path.relative(ROOT, `${outStem}.json`)}`);
  console.log(`replay report:        ${path.relative(ROOT, `${outStem}.md`)}`);
  console.log(`passed: ${report.passed}/${report.fixtureCount}`);
  if (report.passed !== report.fixtureCount) process.exitCode = 1;
}

main();
