import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNSAFE_DRAFT = 'Edony struck the false shillings, so write her name in the trial-book.';
const EXACT_DUE_SOURCE =
  "“I state the verdict: The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand.”";
const SAFE_REPAIR = `Write: “The public evidence does not yet establish who struck the coins.” I call for Marrick’s ready verdict; I tap the mint-yard register at its exact limit; ${EXACT_DUE_SOURCE} What does that establish—and no more?`;
const DUPLICATE_CLUE_DRAFT =
  "Write: “The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day.” I tap the mint-yard register; “I can attest that the town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand.” What does that establish?";
const COMPLEMENTARY_WRITE_REPAIR = `Write: “The public evidence does not yet establish whose hand struck the false shillings passed at the Marrick fair.” I call for Marrick’s ready verdict; I tap the mint-yard register; ${EXACT_DUE_SOURCE} What does that establish—and no more?`;
const META_THEATRICAL_DRAFT =
  "You’re right to ask what the public evidence licenses us to write. I'm going to give you another piece of information. Let's role-play it: I'll be the town assayer. Verrell alone draws the mint-yard crucible. Back to the case: what does this new clue support?";
const FLAT_CHARACTER_DRAFT =
  'You’re right to ask what the public evidence licenses us to write. Town assayer, opening the mint-yard register: “Verrell alone draws the mint-yard crucible.” What changes?';
const SAFE_UPTAKE_BROKEN_DEVELOPMENT =
  'You’re right to separate suspicion from proof. The next clue appears without a source or exhibit.';
const TERSE_UPTAKE_BROKEN_DEVELOPMENT = 'Exactly. The next clue appears without a source or exhibit.';
const SINGLE_PLAIN_RECOVERY = SAFE_REPAIR;
const PLAIN_STYLE_DRAFT = `Fair—I’ll keep this direct and speak to you as an equal. I call for Marrick’s ready verdict; ${EXACT_DUE_SOURCE} What does that public entry establish?`;
const HOST_PART_ONLY_RECOVERY = `Write: “The public record does not yet establish who struck the coins.” I call for Marrick’s ready verdict; I hold the mint-yard register before us; ${EXACT_DUE_SOURCE} What follows from this line?`;

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
    ? ${JSON.stringify(HOST_PART_ONLY_RECOVERY)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'paired-plain' && repaired
    ? ${JSON.stringify(SINGLE_PLAIN_RECOVERY)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'soft-style'
      ? ${JSON.stringify(PLAIN_STYLE_DRAFT)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'preserve-uptake'
    ? ${JSON.stringify(SAFE_UPTAKE_BROKEN_DEVELOPMENT)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'terse-uptake'
      ? ${JSON.stringify(TERSE_UPTAKE_BROKEN_DEVELOPMENT)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'duplicate-repair' && repaired
      ? ${JSON.stringify(COMPLEMENTARY_WRITE_REPAIR)}
    : process.env.TUTOR_GUARD_FAKE_MODE === 'duplicate-repair'
      ? ${JSON.stringify(DUPLICATE_CLUE_DRAFT)}
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
    cliArgs.push(
      '--register-policy',
      'random',
      '--register-palette',
      mode === 'soft-style' ? 'charismatic' : 'precise',
    );
  }
  if (mode === 'soft-style') cliArgs.splice(cliArgs.indexOf('--dag'), 1);
  const result = spawnSync(process.execPath, cliArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
      CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      TUTOR_GUARD_FAKE_MODE: mode,
    },
  });
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
  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.originalCandidate.candidate.text, UNSAFE_DRAFT);
  assert.equal(accounting.originalCandidate.audits.liveTurnProgressionAudit.ok, false);
  assert.equal(accounting.originalCandidate.audits.liveSourceActionAlignmentAudit.ok, false);
  assert.ok(
    accounting.originalCandidate.audits.deliveryDecision.hardIssues.some(
      (issue) => issue.guard === 'live_turn_progression_v1',
    ),
  );
  assert.equal(accounting.attempts.length, 2);
  assert.equal(accounting.repairsApplied.length, 1);
  assert.equal(accounting.repairsApplied[0].kind, 'model_plain_recovery');
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
  assert.equal(accounting.attempts[1].audits.liveTurnProgressionAudit.ok, true);
  assert.equal(accounting.attempts[1].audits.liveSourceActionAlignmentAudit.ok, true);
  assertExactRepairSpan(accounting.attempts[1].repairedSpans[0], UNSAFE_DRAFT, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.source, 'plain_recovery_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.auditOk, true);
  const liveProgressionEvents = events.filter((row) => row.type === 'tutor_live_turn_progression_audit');
  const liveSourceEvents = events.filter((row) => row.type === 'tutor_live_source_action_alignment_audit');
  assert.deepEqual(
    liveProgressionEvents.map((row) => row.ok),
    [false, true],
  );
  assert.deepEqual(
    liveSourceEvents.map((row) => row.ok),
    [false, true],
  );
  assert.ok(liveProgressionEvents.every((row) => row.scope === 'whole_response_terminal_boundary'));
  assert.ok(
    liveSourceEvents.every((row) => row.scope === 'exact_source_occurrence_and_nearest_pre_source_host_boundary'),
  );
  assert.ok(liveSourceEvents.every((row) => row.compensationRequired === false));
  assert.ok(liveSourceEvents.every((row) => typeof row.directAccessible === 'boolean'));
  assert.ok(liveSourceEvents.every((row) => typeof row.compensationVisible === 'boolean'));
  assert.ok([...liveProgressionEvents, ...liveSourceEvents].every((row) => row.slotOwnershipInferred === false));

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
    ['model_plain_recovery', 'deterministic_fallback'],
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
  assert.equal(accounting.attempts[2].audits.liveTurnProgressionAudit.ok, true);
  assert.equal(accounting.attempts[2].audits.liveSourceActionAlignmentAudit.ok, true);
  assert.equal(accounting.attempts[2].audits.deliveryDecision.ok, true);
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

test('a dramatic fallback replaces non-answering uptake with a licensed writable entry', () => {
  const { events } = runGuardFixture('preserve-uptake');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
  assert.equal(accounting.finalDelivery.source, 'deterministic_fallback');
  assert.match(
    accounting.finalDelivery.candidate.text,
    /^Write: “The public evidence does not yet establish whose hand struck the false shillings passed at the Marrick fair\.” /u,
  );
  assert.doesNotMatch(
    accounting.finalDelivery.candidate.text,
    /another piece of information|role-play|Back to (?:us|the case)/iu,
  );
  assert.doesNotMatch(accounting.finalDelivery.candidate.text, /That gives us a concrete contribution/u);
  assert.equal(turn.responseComposition.audit.ok, true);
  assert.equal(
    turn.responseComposition.uptake,
    'Write: “The public evidence does not yet establish whose hand struck the false shillings passed at the Marrick fair.”',
  );
  assert.match(turn.responseComposition.development, /mint-yard crucible/iu);
  assert.equal(turn.responseComposition.frame.uptake.action_family, null);
});

test('a fallback replaces a terse generic acknowledgement with learner-specific uptake', () => {
  const { events } = runGuardFixture('terse-uptake');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;

  assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
  assert.match(accounting.finalDelivery.candidate.text, /^You’re right to separate suspicion from proof\./u);
  assert.doesNotMatch(accounting.finalDelivery.candidate.text, /^Exactly\./u);
  assert.equal(accounting.finalDelivery.auditOk, true);
});

test('meta-theatrical clue narration is rejected and repaired into direct diegetic action', () => {
  const { events } = runGuardFixture('meta-repair');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.originalCandidate.candidate.text, META_THEATRICAL_DRAFT);
  assert.equal(
    accounting.originalCandidate.guardedSpans.some(
      (span) => span.guard === 'dramatic_release' && span.issueType === 'meta_dramatic_announcement',
    ),
    true,
  );
  assert.equal(accounting.finalDelivery.source, 'plain_recovery_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.doesNotMatch(turn.tutor, /role-play|I(?:'|’)ll be|Back to (?:us|the case)/iu);
  assert.match(turn.tutor, /I call for Marrick’s ready verdict; I tap the mint-yard register at its exact limit/u);
  assert.equal(turn.tutor.split(EXACT_DUE_SOURCE).length - 1, 1);
  assert.equal(turn.tutorDramaticReleaseAudit.ok, true);
});

test('a duplicated due clue is rejected before delivery and repaired into a complementary Write entry', () => {
  const { events } = runGuardFixture('duplicate-repair');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.originalCandidate.candidate.text, DUPLICATE_CLUE_DRAFT);
  assert.equal(accounting.originalCandidate.audits.dramaticReleaseAudit.ok, false);
  assert.ok(
    accounting.originalCandidate.audits.dramaticReleaseAudit.issues.some(
      (issue) => issue.type === 'duplicate_clue_delivery',
    ),
  );
  assert.ok(
    accounting.originalCandidate.guardedSpans.some(
      (span) => span.guard === 'dramatic_release' && span.issueType === 'duplicate_clue_delivery',
    ),
  );
  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.finalDelivery.candidate.text, COMPLEMENTARY_WRITE_REPAIR);
  assert.equal(accounting.finalDelivery.auditOk, true);
  assert.equal(turn.tutor, COMPLEMENTARY_WRITE_REPAIR);
  assert.equal(turn.tutorDramaticReleaseAudit.clueDeliveryMultiplicity.ok, true);
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
  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.audits.actorialRealizationAudit.ok, true);
  assert.equal(actorAudits.length, 2);
  assert.equal(actorAudits[0].selectedPerformance.id, 'evidentiary_boundary');
});

test('simplified recovery uses its logged plain configuration rather than retrying the failed policy', () => {
  const { events, stdout } = runGuardFixture('performance-advisory');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const turn = events.find((row) => row.type === 'turn_complete')?.turnRecord;

  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.finalDelivery.source, 'plain_recovery_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, HOST_PART_ONLY_RECOVERY);
  assert.equal(accounting.finalDelivery.deterministicFallback, false);
  assert.equal(accounting.finalDelivery.audits.actorialRealizationAudit.ok, true);
  assert.equal(accounting.finalDelivery.audits.deliveryOk, true);
  assert.equal(accounting.finalDelivery.deliveryConfiguration.engagement_stance, 'plain');
  assert.equal(accounting.finalDelivery.deliveryConfiguration.actorial_performance.id, 'unadorned_report');
  assert.equal(turn.responseConfiguration.engagement_stance, 'precise');
  assert.equal(turn.deliveredResponseConfiguration.engagement_stance, 'plain');
  assert.deepEqual(turn.responseConfigurationAudit, accounting.finalDelivery.audits.responseConfigurationAudit);
  assert.equal(
    turn.responseConfigurationAudit.configuration_signature,
    [
      accounting.finalDelivery.deliveryConfiguration.engagement_stance,
      accounting.finalDelivery.deliveryConfiguration.action_family,
      accounting.finalDelivery.deliveryConfiguration.audience_register,
      accounting.finalDelivery.deliveryConfiguration.lexical_accessibility,
      accounting.finalDelivery.deliveryConfiguration.scene_immersion,
      accounting.finalDelivery.deliveryConfiguration.actorial_part,
      accounting.finalDelivery.deliveryConfiguration.actorial_performance.id,
    ].join('|'),
  );
  assert.notEqual(
    turn.selectedResponseConfigurationAudit.configuration_signature,
    turn.responseConfigurationAudit.configuration_signature,
  );
  assert.equal(accounting.repairsApplied[0].recoveryTransition.strategy, 'plain_grounded_unadorned');
  assert.match(stdout, /response revised/u);
  assert.doesNotMatch(stdout, /safe fallback used/u);
});

test('one compact recovery call requests and audits exactly one plain candidate', () => {
  const { events, stdout } = runGuardFixture('paired-plain');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const candidateEvent = events.find((row) => row.type === 'tutor_response_recovery_candidate');
  const modelCalls = events.filter(
    (row) => row.type === 'model_call' && /^tutor_stub_tutor(?:$|_)/u.test(row.role || ''),
  );

  assert.equal(modelCalls.length, 2, 'original plus one simplified recovery model call');
  const recoveryPrompt = modelCalls[1].request.messages.at(-1).content;
  assert.match(recoveryPrompt, /\[Compact public recovery packet\]/u);
  assert.match(recoveryPrompt, /Generate one genuinely different, plain replacement/u);
  assert.match(recoveryPrompt, /Return only the replacement tutor reply as ordinary text/u);
  assert.match(recoveryPrompt, /plain_grounded_unadorned/u);
  assert.doesNotMatch(recoveryPrompt, /policy_repair|plain_recovery|Return exactly one JSON object/u);
  assert.doesNotMatch(recoveryPrompt, new RegExp(UNSAFE_DRAFT.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  const failureBlock = recoveryPrompt.slice(recoveryPrompt.indexOf('[Response-check failures]'));
  assert.doesNotMatch(failureBlock, /actorial_realization/u);
  assert.match(failureBlock, /leak:/u);
  assert.equal(candidateEvent.parse.ok, true);
  assert.equal(candidateEvent.parse.mode, 'single_plain_text');
  assert.equal(candidateEvent.candidate.kind, 'plain_recovery_candidate');
  assert.equal(candidateEvent.candidate.text, SAFE_REPAIR);
  assert.equal(candidateEvent.recoveryTransition.strategy, 'plain_grounded_unadorned');
  assert.equal(accounting.outcome, 'guarded_plain_recovery_accepted');
  assert.equal(accounting.attempts.length, 2);
  assert.deepEqual(
    accounting.attempts.map((attempt) => attempt.kind),
    ['original_candidate', 'plain_recovery_candidate'],
  );
  assert.equal(accounting.attempts[1].candidate.text, SAFE_REPAIR);
  assert.equal(accounting.attempts[1].audits.deliveryOk, true);
  assert.equal(accounting.finalDelivery.source, 'plain_recovery_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, SAFE_REPAIR);
  assert.equal(accounting.finalDelivery.deterministicFallback, false);
  assert.deepEqual(
    accounting.repairsApplied.map((repair) => repair.kind),
    ['model_plain_recovery'],
  );
  assert.equal(accounting.repairsApplied[0].generatedInSameModelCall, false);
  assert.match(stdout, /response revised/u);
  assert.doesNotMatch(stdout, /safe fallback used/u);
});

test('an explicit request for plain peer-level speech accepts the applicable plain boundary', () => {
  const { events } = runGuardFixture('soft-style');
  const accounting = events.find((row) => row.type === 'tutor_response_guard_accounting')?.accounting;
  const advisory = events.find((row) => row.type === 'tutor_response_delivery_advisory');
  const modelCalls = events.filter(
    (row) => row.type === 'model_call' && /^tutor_stub_tutor(?:$|_)/u.test(row.role || ''),
  );

  assert.equal(modelCalls.length, 1);
  // The plain draft drops the selected optional performance tactic. Under the
  // guard-disposition catalog the explicit learner style request makes that an
  // advisory, not a repair trigger: one model call, accepted with advisory.
  assert.equal(accounting.outcome, 'guarded_original_accepted_with_advisory');
  assert.equal(accounting.attempts.length, 1);
  assert.equal(accounting.originalCandidate.audits.actorialRealizationAudit.ok, false);
  assert.equal(accounting.originalCandidate.audits.deliveryOk, true);
  assert.deepEqual(accounting.originalCandidate.audits.deliveryDecision.hardIssues, []);
  assert.deepEqual(
    accounting.originalCandidate.audits.deliveryDecision.advisoryIssues.map((issue) => `${issue.guard}:${issue.type}`),
    ['actorial_realization:missing_selected_performance_tactic'],
  );
  assert.equal(accounting.finalDelivery.source, 'original_candidate');
  assert.equal(accounting.finalDelivery.candidate.text, PLAIN_STYLE_DRAFT);
  assert.equal(accounting.finalDelivery.auditOk, true);
  assert.equal(advisory.accepted, true);
  assert.equal(advisory.attempt, 0);
  assert.equal(advisory.reason, 'explicit learner style request outranks optional actorial realization');
  assert.deepEqual(
    advisory.advisoryIssues.map((issue) => `${issue.guard}:${issue.type}`),
    ['actorial_realization:missing_selected_performance_tactic'],
  );
});
