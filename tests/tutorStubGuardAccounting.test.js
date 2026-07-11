import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNSAFE_DRAFT = 'Edony struck the false shillings, so write her name in the trial-book.';
const SAFE_REPAIR = 'Keep the verdict open. Which public mark on the coin can you state first?';

function readTraceEvents(traceDir) {
  const tracePath = fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(traceDir, name))
    .at(0);
  assert.ok(tracePath, 'expected one tutor-stub trace');
  return fs
    .readFileSync(tracePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runGuardFixture(mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `tutor-stub-guard-${mode}-`));
  const fakeCodex = path.join(tmp, 'codex');
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const repaired = input.includes('[Tutor-only repair instruction]');
  const response = process.env.TUTOR_GUARD_FAKE_MODE === 'repair' && repaired
    ? ${JSON.stringify(SAFE_REPAIR)}
    : ${JSON.stringify(UNSAFE_DRAFT)};
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--model',
      'codex.gpt-5.6-terra',
      '--world',
      'world_005_marrick',
      '--dag',
      '--no-classifier',
      '--no-register-selection',
      '--once',
      'What should I write in the trial-book?',
      '--no-opening',
      '--no-stream',
      '--no-interim-animation',
      '--trace-dir',
      tmp,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        TUTOR_GUARD_FAKE_MODE: mode,
      },
    },
  );
  if (result.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.fail(`tutor-stub exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  const events = readTraceEvents(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  return events;
}

function assertExactRepairSpan(span, original, repaired) {
  assert.equal(original.slice(span.original.start, span.original.end), span.original.text);
  assert.equal(repaired.slice(span.repaired.start, span.repaired.end), span.repaired.text);
  assert.equal(span.offsetEncoding, 'utf16_code_units');
}

test('tutor guard accounting preserves the original candidate and exact accepted-repair spans', () => {
  const events = runGuardFixture('repair');
  const event = events.find((row) => row.type === 'tutor_response_guard_accounting');
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;
  const closeout = events.find((row) => row.type === 'closeout_report')?.report;
  assert.ok(event);

  const accounting = event.accounting;
  assert.doesNotMatch(JSON.stringify(accounting), /\[circular\]/u);
  assert.equal(accounting.schema, 'machinespirits.tutor-stub.guard-accounting.v1');
  assert.equal(accounting.policy, 'dynamic');
  assert.equal(accounting.profile, 'diligent');
  assert.equal(accounting.outcome, 'guarded_model_repair_accepted');
  assert.equal(accounting.originalCandidate.candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts.length, 2);
  assert.equal(accounting.repairsApplied.length, 1);
  assert.equal(accounting.repairsApplied[0].kind, 'model_rewrite');

  const edonySpan = accounting.originalCandidate.guardedSpans.find(
    (span) => span.issueType === 'concealed_answer_name' && span.text === 'Edony',
  );
  assert.ok(edonySpan);
  assert.equal(UNSAFE_DRAFT.slice(edonySpan.start, edonySpan.end), edonySpan.text);
  assert.equal(edonySpan.offsetEncoding, 'utf16_code_units');

  const repairCandidate = accounting.attempts[1].candidate.text;
  assert.equal(repairCandidate, SAFE_REPAIR);
  assert.equal(accounting.attempts[1].repairedSpans.length, 1);
  assertExactRepairSpan(accounting.attempts[1].repairedSpans[0], UNSAFE_DRAFT, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.source, 'model_repair_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.auditOk, true);

  assert.deepEqual(turn.tutorGuardAccounting, accounting);
  assert.equal(turn.tutor, SAFE_REPAIR);
  assert.equal(turn.tutorResponseRepaired, true);
  assert.equal(turn.tutorDeterministicFallback, false);
  assert.equal(closeout.guardAccounting.accountedTurns, 1);
  assert.equal(closeout.guardAccounting.modelRepairTurns, 1);
  assert.equal(closeout.guardAccounting.deterministicFallbackTurns, 0);
  assert.deepEqual(closeout.guardAccounting.byPolicyProfile[0].policy, 'dynamic');
  assert.deepEqual(closeout.guardAccounting.byPolicyProfile[0].profile, 'diligent');
});

test('tutor guard accounting records the failed repair and final deterministic fallback envelope', () => {
  const events = runGuardFixture('fallback');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;
  const closeout = events.find((row) => row.type === 'closeout_report')?.report;
  assert.ok(accounting);
  assert.doesNotMatch(JSON.stringify(accounting), /\[circular\]/u);

  assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
  assert.equal(accounting.originalCandidate.candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts.length, 3);
  assert.deepEqual(
    accounting.repairsApplied.map((repair) => repair.kind),
    ['model_rewrite', 'deterministic_fallback'],
  );
  assert.equal(accounting.attempts[1].candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts[1].guardedSpans.length > 0, true);
  assert.equal(accounting.attempts[1].repairedSpans.length, 0);

  const fallbackText = accounting.finalDelivery.candidate.text;
  assert.match(fallbackText, /can't put a name or private conclusion/u);
  assert.equal(accounting.finalDelivery.source, 'deterministic_fallback');
  assert.equal(accounting.finalDelivery.deterministicFallback, true);
  assert.equal(accounting.finalDelivery.auditOk, true);
  assert.equal(accounting.attempts[2].repairedSpans.length, 1);
  assertExactRepairSpan(accounting.attempts[2].repairedSpans[0], UNSAFE_DRAFT, fallbackText);

  assert.deepEqual(turn.tutorGuardAccounting, accounting);
  assert.equal(turn.tutor, fallbackText);
  assert.equal(turn.tutorResponseRepaired, true);
  assert.equal(turn.tutorDeterministicFallback, true);
  assert.equal(closeout.guardAccounting.accountedTurns, 1);
  assert.equal(closeout.guardAccounting.modelRepairTurns, 1);
  assert.equal(closeout.guardAccounting.deterministicFallbackTurns, 1);
  assert.equal(closeout.guardAccounting.finalDeliveryAuditFailures, 0);
});
