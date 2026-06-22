#!/usr/bin/env node
/**
 * A20 conduct-policy fixture gate.
 *
 * Pure local check: reads frozen fixtures, runs each trigger through
 * selectConductMove, audits non-leak, and writes a compact report. No LLM
 * calls and no replay execution.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectConductMove } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_FIXTURES = 'exports/dramatic-derivation/a20-conduct-policy/first-policy-fixtures.json';
const FALLBACK_FIXTURES = 'tests/fixtures/a20-conduct-policy-fixtures.json';
const DEFAULT_OUT = 'exports/dramatic-derivation/a20-conduct-policy/fixture-gate-report';

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

function cell(value) {
  if (value == null || value === '') return ' ';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function evaluateFixture(fixture) {
  const trigger = fixture.trigger || fixture;
  const decision = selectConductMove(trigger);
  const expected = trigger.expectedMoveFamily;
  const selectedOk = !expected || decision.selectedMoveFamily === expected;
  const nonLeakOk = decision.nonLeakAudit?.ok === true;
  return {
    fixtureId: fixture.fixtureId || trigger.id,
    role: fixture.role || null,
    triggerId: trigger.id || null,
    worldId: trigger.worldId || null,
    turn: trigger.turn ?? null,
    expectedMoveFamily: expected || null,
    selectedMoveFamily: decision.selectedMoveFamily,
    reasonCode: decision.reasonCode,
    targetPremise: decision.targetPremise || null,
    selectedOk,
    nonLeakOk,
    pass: selectedOk && nonLeakOk,
    nonLeakAudit: decision.nonLeakAudit,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# A20 Conduct-Policy Fixture Gate');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`- Fixtures: \`${report.fixturePath}\``);
  lines.push(`- Fixture count: ${report.fixtureCount}`);
  lines.push(`- Passed: ${report.passed}/${report.fixtureCount}`);
  lines.push('');
  lines.push('| fixture | world | turn | expected | selected | reason | target | non-leak | pass |');
  lines.push('|---|---|---:|---|---|---|---|---|---|');
  for (const row of report.results) {
    lines.push(
      `| ${cell(row.fixtureId)} | ${cell(row.worldId)} | ${cell(row.turn)} | ${cell(row.expectedMoveFamily)} | ` +
        `${cell(row.selectedMoveFamily)} | ${cell(row.reasonCode)} | ${cell(row.targetPremise)} | ` +
        `${row.nonLeakOk ? 'pass' : 'FAIL'} | ${row.pass ? 'pass' : 'FAIL'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const fixturePath = resolveFixturePath();
  const outStem = path.resolve(ROOT, arg('out', DEFAULT_OUT));
  const data = readJson(fixturePath);
  const fixtures = data.fixtures || [];
  const results = fixtures.map(evaluateFixture);
  const report = {
    schema: 'dramatic-derivation.a20-conduct-policy.fixture-gate.v0',
    generatedAt: new Date().toISOString(),
    fixturePath: path.relative(ROOT, fixturePath),
    fixtureCount: fixtures.length,
    passed: results.filter((row) => row.pass).length,
    results,
  };
  mkdirSync(path.dirname(outStem), { recursive: true });
  writeFileSync(`${outStem}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${outStem}.md`, renderMarkdown(report));
  console.log(`fixture gate written: ${path.relative(ROOT, `${outStem}.json`)}`);
  console.log(`fixture report:       ${path.relative(ROOT, `${outStem}.md`)}`);
  console.log(`passed: ${report.passed}/${report.fixtureCount}`);
  if (report.passed !== report.fixtureCount) process.exitCode = 1;
}

main();
