import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNSAFE_DRAFT = 'Edony struck the false shillings, so write her name in the trial-book.';
const SAFE_REPAIR =
  'You’re right to ask what the public evidence licenses us to write. I tap the mint-yard register at its exact limit; “I have my finger on the exact line: Verrell alone draws the mint-yard crucible.” What does that establish—and no more?';
const META_THEATRICAL_DRAFT =
  "You’re right to ask what the public evidence licenses us to write. I'm going to give you another piece of information. Let's role-play it: I'll be the town assayer. Verrell alone draws the mint-yard crucible. Back to the case: what does this new clue support?";
const FLAT_CHARACTER_DRAFT =
  'You’re right to ask what the public evidence licenses us to write. Town assayer, opening the mint-yard register: “Verrell alone draws the mint-yard crucible.” What changes?';
const SAFE_UPTAKE_BROKEN_DEVELOPMENT =
  'You’re right to separate suspicion from proof. The next clue appears without a source or exhibit.';
const TERSE_UPTAKE_BROKEN_DEVELOPMENT = 'Exactly. The next clue appears without a source or exhibit.';
const PAIRED_RECOVERY = JSON.stringify({
  policy_repair: UNSAFE_DRAFT,
  plain_recovery: SAFE_REPAIR,
});
const PLAIN_STYLE_DRAFT =
  'Fair. I’ll keep this direct. “I have my finger on the exact line: Verrell alone draws the mint-yard crucible.” What does that public entry establish?';
const HOST_PART_ONLY_RECOVERY =
  'You’re right to ask what the public record supports, because that is the question here. I hold the mint-yard register before us: “I have my finger on the line: Verrell alone draws the mint-yard crucible.” What follows from this line?';
const HOST_PART_ONLY_RECOVERY_BATCH = JSON.stringify({
  policy_repair: HOST_PART_ONLY_RECOVERY,
  plain_recovery: HOST_PART_ONLY_RECOVERY,
});

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
  const response = process.env.TUTOR_GUARD_FAKE_MODE === 'performance-advisory' && repaired
    ? ${JSON.stringify(HOST_PART_ONLY_RECOVERY_BATCH)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'paired-plain' && repaired
    ? ${JSON.stringify(PAIRED_RECOVERY)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'soft-style'
      ? ${JSON.stringify(PLAIN_STYLE_DRAFT)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'preserve-uptake'
    ? ${JSON.stringify(SAFE_UPTAKE_BROKEN_DEVELOPMENT)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'terse-uptake'
      ? ${JSON.stringify(TERSE_UPTAKE_BROKEN_DEVELOPMENT)}
    : ['repair', 'meta-repair', 'tactic-repair'].includes(process.env.TUTOR_GUARD_FAKE_MODE) && repaired
      ? ${JSON.stringify(SAFE_REPAIR)}
      : process.env.TUTOR_GUARD_FAKE_MODE === 'meta-repair'
        ? ${JSON.stringify(META_THEATRICAL_DRAFT)}
        : process.env.TUTOR_GUARD_FAKE_MODE === 'tactic-repair'
          ? ${JSON.stringify(FLAT_CHARACTER_DRAFT)}
        : ${JSON.stringify(UNSAFE_DRAFT)};
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);

  const cliArgs = [
      'scripts/tutor-stub.js',
      '--model',
      'codex.gpt-5.6-terra',
      '--auto-learner-profile',
      'diligent',
      '--settings-file',
      path.join(tmp, 'settings.json'),
      '--world',
      'world_005_marrick',
      '--dag',
      '--no-classifier',
      '--no-register-selection',
      '--once',
      mode === 'terse-uptake'
        ? 'It does not prove Verrell did it; it only confirms the town suspects him.'
        : mode === 'soft-style'
          ? 'Drop the formality. Talk to me like an equal. Stop the detective novel.'
        : 'What should I write in the trial-book?',
      '--no-opening',
      '--no-stream',
      '--no-interim-animation',
      '--trace-dir',
      tmp,
    ];
  if (['tactic-repair', 'performance-advisory', 'soft-style'].includes(mode)) {
    cliArgs.splice(cliArgs.indexOf('--no-register-selection'), 1);
    cliArgs.push('--register-policy', 'random', '--register-palette', mode === 'soft-style' ? 'charismatic' : 'precise');
  }
  if (mode === 'soft-style') cliArgs.splice(cliArgs.indexOf('--dag'), 1);
  const result = spawnSync(
    process.execPath,
    cliArgs,
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
  return { events, stdout: result.stdout };
}

function assertExactRepairSpan(span, original, repaired) {
  assert.equal(original.slice(span.original.start, span.original.end), span.original.text);
  assert.equal(repaired.slice(span.repaired.start, span.repaired.end), span.repaired.text);
  assert.equal(span.offsetEncoding, 'utf16_code_units');
}

test('tutor guard accounting preserves the original candidate and exact accepted-repair spans', () => {
  const { events, stdout } = runGuardFixture('repair');
  const event = events.find((row) => row.type === 'tutor_response_guard_accounting');
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;
  const closeout = events.find((row) => row.type === 'closeout_report')?.report;
  assert.ok(event);

  const accounting = event.accounting;
  assert.doesNotMatch(JSON.stringify(accounting), /\[circular\]/u);
  assert.equal(accounting.schema, 'machinespirits.tutor-stub.guard-accounting.v1');
  assert.equal(accounting.policy, 'dynamic');
  assert.equal(accounting.profile, 'diligent');
  assert.equal(accounting.outcome, 'guarded_policy_repair_accepted');
  assert.equal(accounting.originalCandidate.candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts.length, 2);
  assert.equal(accounting.repairsApplied.length, 1);
  assert.equal(accounting.repairsApplied[0].kind, 'model_rewrite');
  assert.equal(accounting.generation.modelCallCount, 2);
  assert.ok(accounting.generation.originalCandidateLatencyMs >= 0);
  assert.ok(accounting.generation.totalModelLatencyMs >= accounting.generation.originalCandidateLatencyMs);

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
  assert.equal(accounting.finalDelivery.source, 'policy_repair_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.auditOk, true);

  assert.deepEqual(turn.tutorGuardAccounting, accounting);
  assert.equal(turn.tutor, SAFE_REPAIR);
  assert.equal(turn.tutorResponseRepaired, true);
  assert.equal(turn.tutorDeterministicFallback, false);
  assert.equal(closeout.guardAccounting.accountedTurns, 1);
  assert.equal(closeout.guardAccounting.modelRepairTurns, 1);
  assert.equal(closeout.guardAccounting.deterministicFallbackTurns, 0);
  assert.equal(closeout.guardAccounting.originalCandidateAcceptedTurns, 0);
  assert.equal(closeout.guardAccounting.meanTutorGenerationLatencyMs, turn.latencyMs);
  assert.deepEqual(closeout.guardAccounting.byPolicyProfile[0].policy, 'dynamic');
  assert.deepEqual(closeout.guardAccounting.byPolicyProfile[0].profile, 'diligent');
  assert.match(stdout, /response revised/u);
  assert.doesNotMatch(stdout, /leak-guard/u);
});

test('tutor guard accounting records the failed repair and final deterministic fallback envelope', () => {
  const { events, stdout } = runGuardFixture('fallback');
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
  assert.equal(accounting.generation.modelCallCount, 2, 'deterministic fallback adds no third model call');
  assert.equal(accounting.attempts[1].candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts[1].guardedSpans.length > 0, true);
  assert.equal(accounting.attempts[1].repairedSpans.length, 0);

  const fallbackText = accounting.finalDelivery.candidate.text;
  assert.match(fallbackText, /Verrell alone draws the mint-yard crucible/u);
  assert.doesNotMatch(
    fallbackText,
    /another piece of information|role-play|Back to (?:us|the case)|can't put a name|decisive act/iu,
  );
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
  assert.equal(closeout.finalTurn.leakOk, true);
  assert.match(stdout, /safe fallback used/u);
  assert.doesNotMatch(stdout, /leak-guard/u);
});

test('a dramatic fallback preserves safe learner uptake and replaces only development', () => {
  const { events } = runGuardFixture('preserve-uptake');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
  assert.equal(accounting.finalDelivery.source, 'deterministic_fallback');
  assert.match(accounting.finalDelivery.candidate.text, /^You’re right to separate suspicion from proof\. /u);
  assert.doesNotMatch(
    accounting.finalDelivery.candidate.text,
    /another piece of information|role-play|Back to (?:us|the case)/iu,
  );
  assert.doesNotMatch(accounting.finalDelivery.candidate.text, /That gives us a concrete contribution/u);
  assert.equal(turn.responseComposition.audit.ok, true);
  assert.equal(turn.responseComposition.uptake, 'You’re right to separate suspicion from proof.');
  assert.match(turn.responseComposition.development, /mint-yard crucible/iu);
  assert.equal(turn.responseComposition.frame.uptake.action_family, null);
});

test('a fallback replaces a terse generic acknowledgement with learner-specific uptake', () => {
  const { events } = runGuardFixture('terse-uptake');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;

  assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
  assert.match(
    accounting.finalDelivery.candidate.text,
    /^You’re right to separate suspicion from proof\./u,
  );
  assert.doesNotMatch(accounting.finalDelivery.candidate.text, /^Exactly\./u);
  assert.equal(accounting.finalDelivery.auditOk, true);
});

test('meta-theatrical clue narration is rejected and repaired into direct diegetic action', () => {
  const { events } = runGuardFixture('meta-repair');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.outcome, 'guarded_policy_repair_accepted');
  assert.equal(accounting.originalCandidate.candidate.text, META_THEATRICAL_DRAFT);
  assert.equal(
    accounting.originalCandidate.guardedSpans.some(
      (span) => span.guard === 'dramatic_release' && span.issueType === 'meta_dramatic_announcement',
    ),
    true,
  );
  assert.equal(accounting.finalDelivery.source, 'policy_repair_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.doesNotMatch(turn.tutor, /role-play|I(?:'|’)ll be|Back to (?:us|the case)/iu);
  assert.match(turn.tutor, /I tap the mint-yard register[\s\S]*“I have my finger on the exact line/u);
  assert.equal(turn.tutorDramaticReleaseAudit.ok, true);
});

test('a flat named character is rewritten until the selected stance tactic is visible', () => {
  const { events } = runGuardFixture('tactic-repair');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const actorAudits = events.filter((row) => row.type === 'tutor_actorial_realization_audit');

  assert.equal(accounting.guards.actorialRealization, true);
  assert.equal(accounting.originalCandidate.candidate.text, FLAT_CHARACTER_DRAFT);
  assert.equal(accounting.originalCandidate.audits.dramaticReleaseAudit.ok, false);
  assert.equal(accounting.originalCandidate.audits.actorialRealizationAudit.ok, false);
  assert.deepEqual(
    accounting.originalCandidate.audits.actorialRealizationAudit.issues.map((issue) => issue.type),
    ['missing_selected_actorial_part', 'missing_selected_performance_tactic'],
  );
  assert.equal(accounting.outcome, 'guarded_policy_repair_accepted');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.audits.actorialRealizationAudit.ok, true);
  assert.equal(actorAudits.length, 2);
  assert.equal(actorAudits[0].selectedPerformance.id, 'evidentiary_boundary');
});

test('a policy recovery keeps its visible host part when only the optional tactic misses', () => {
  const { events, stdout } = runGuardFixture('performance-advisory');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const advisory = events.find((row) => row.type === 'tutor_response_delivery_advisory');

  assert.equal(
    accounting.outcome,
    'guarded_policy_repair_accepted',
    JSON.stringify(accounting.attempts[1]?.audits),
  );
  assert.equal(accounting.finalDelivery.source, 'policy_repair_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, HOST_PART_ONLY_RECOVERY);
  assert.equal(accounting.finalDelivery.deterministicFallback, false);
  assert.equal(accounting.finalDelivery.audits.actorialRealizationAudit.ok, false);
  assert.deepEqual(
    accounting.finalDelivery.audits.actorialRealizationAudit.issues.map((issue) => issue.type),
    ['missing_selected_performance_tactic'],
  );
  assert.equal(accounting.finalDelivery.audits.deliveryOk, true);
  assert.equal(advisory.accepted, true);
  assert.match(advisory.reason, /optional performance tactic/u);
  assert.match(stdout, /response revised/u);
  assert.doesNotMatch(stdout, /safe fallback used/u);
});

test('one compact recovery call yields policy and plain candidates and can deliver the plain candidate', () => {
  const { events, stdout } = runGuardFixture('paired-plain');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const candidateEvent = events.find((row) => row.type === 'tutor_response_recovery_candidates');
  const modelCalls = events.filter(
    (row) => row.type === 'model_call' && /^tutor_stub_tutor(?:$|_)/u.test(row.role || ''),
  );

  assert.equal(modelCalls.length, 2, 'original plus one paired recovery model call');
  const recoveryPrompt = modelCalls[1].request.messages.at(-1).content;
  assert.match(recoveryPrompt, /\[Compact public recovery packet\]/u);
  assert.doesNotMatch(recoveryPrompt, new RegExp(UNSAFE_DRAFT.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.equal(candidateEvent.parse.ok, true);
  assert.deepEqual(
    candidateEvent.candidates.map((candidate) => candidate.kind),
    ['policy_repair_candidate', 'plain_recovery_candidate'],
  );
  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.attempts.length, 3);
  assert.deepEqual(
    accounting.attempts.map((attempt) => attempt.kind),
    ['original_candidate', 'policy_repair_candidate', 'plain_recovery_candidate'],
  );
  assert.equal(accounting.attempts[1].candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.attempts[1].audits.deliveryOk, false);
  assert.equal(accounting.attempts[2].candidate.text, SAFE_REPAIR);
  assert.equal(accounting.attempts[2].audits.deliveryOk, true);
  assert.equal(accounting.finalDelivery.source, 'plain_recovery_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.deterministicFallback, false);
  assert.deepEqual(
    accounting.repairsApplied.map((repair) => repair.kind),
    ['model_rewrite', 'model_plain_recovery'],
  );
  assert.equal(accounting.repairsApplied[1].generatedInSameModelCall, true);
  assert.match(stdout, /response revised/u);
  assert.doesNotMatch(stdout, /safe fallback used/u);
});

test('an explicit request for plain peer-level speech makes actorial realization advisory', () => {
  const { events } = runGuardFixture('soft-style');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const advisory = events.find((row) => row.type === 'tutor_response_delivery_advisory');
  const modelCalls = events.filter(
    (row) => row.type === 'model_call' && /^tutor_stub_tutor(?:$|_)/u.test(row.role || ''),
  );

  assert.equal(modelCalls.length, 1);
  assert.equal(accounting.outcome, 'guarded_original_accepted_with_advisory');
  assert.equal(accounting.attempts.length, 1);
  assert.equal(accounting.originalCandidate.audits.actorialRealizationAudit.ok, false);
  assert.equal(accounting.originalCandidate.audits.deliveryOk, true);
  assert.equal(accounting.finalDelivery.source, 'original_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, PLAIN_STYLE_DRAFT);
  assert.equal(accounting.finalDelivery.auditOk, true);
  assert.equal(advisory.accepted, true);
  assert.match(advisory.reason, /learner style request/u);
});
