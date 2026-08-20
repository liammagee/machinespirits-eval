import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';
import { fileURLToPath } from 'node:url';

import { projectTutorStubSessionStatusLines } from '../services/tutorStubSessionStatusPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUDY_STATUS = 'scripts/report-tutor-stub-study-status.js';
const COLORS = Object.freeze({
  bold: '<bold>',
  brightCyan: '<bright-cyan>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fixtureTreeSnapshot(root) {
  const rows = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(entryPath);
        rows.push({ path: path.relative(root, entryPath), bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  }
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

function writeProviderTrap(binDir, providerLog) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/bin/sh\nprintf provider-invoked >> ${JSON.stringify(providerLog)}\nexit 99\n`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function normalStatusFixture() {
  return {
    surface: 'normal',
    modeLabel: '<bright-green><bold>LEARNER<reset>',
    turn: 1,
    learner: { id: 'diligent', name: 'Diligent control', suggestion: 'off' },
    tutor: { ref: 'dramatic-detective@v1' },
    model: { ref: 'codex.terra', provider: 'codex', model: 'terra' },
    modelRouting: {
      allRolesOverrideRef: null,
      classifierRef: 'codex.sol',
      reasoningRef: 'codex.sol',
      learnerRef: 'codex.terra',
    },
    committee: { enabled: true, miniModel: 'program2-sft-instruct-v2', fallbackPolicy: 'v2' },
    voice: { enabled: false, model: 'realtime-mini', voice: 'marin' },
    teaching: {
      approachLabel: 'model-reviewed adaptive choice',
      policyId: 'dynamic',
      styleRange: 0.15,
      dropoutRate: 0,
      baseSpeed: 1,
      effectiveSpeed: 1,
    },
    randomPerformance: { enabled: false, axes: ['style', 'character'] },
    lightAdaptation: { enabled: true, threshold: 2 },
    directedPerformance: { register: null, character: null },
    directorRequest: null,
    conversation: { closureLabel: 'open', coachPending: 0, coachUsed: 0 },
    autoHandoff: { pending: null, running: false },
    turnFeedback: { enabled: true, label: 'not requested' },
    responseDetails: { enabled: true },
    tuning: { mode: 'off', stableVersion: 1, canaryVersion: null, sessionCandidateCount: 0 },
    appearance: { themeLabel: 'Nocturne', motion: 'off', requestedMotion: 'auto', colorMode: 'none' },
    explanatoryDebug: { enabled: false, format: 'plain' },
  };
}

test('zero-call study status explains a six-unit technical stop without mutating its fixture', () => {
  const fixture = path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-study-status', 'technical-stop');
  const source = fs.readFileSync(path.join(ROOT, STUDY_STATUS), 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-study-status-provider-trap-'));
  const binDir = path.join(tmp, 'bin');
  const providerLog = path.join(tmp, 'provider-calls.txt');
  fs.mkdirSync(binDir, { recursive: true });
  writeProviderTrap(binDir, providerLog);
  const before = fixtureTreeSnapshot(fixture);
  const run = (extra = []) =>
    spawnSync(process.execPath, [STUDY_STATUS, fixture, ...extra], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
        OPENAI_API_KEY: 'must-not-be-used',
        OPENROUTER_API_KEY: 'must-not-be-used',
      },
    });

  try {
    const human = run();
    assert.equal(human.status, 0, human.stderr);
    assert.match(human.stdout, /^State: BLOCKED$/mu);
    assert.match(human.stdout, /^Model activity: not verifiable /mu);
    assert.match(human.stdout, /^Units: 2 complete \/ 0 active \/ 1 failed \/ 3 missing$/mu);
    assert.match(human.stdout, /^Turns: 23 completed \/ 48 planned$/mu);
    assert.match(
      human.stdout,
      /^Calls: 104 reserved \/ 104 completed \/ 0 failed \/ 288 hard ceiling \(184 remaining\)$/mu,
    );
    assert.match(human.stdout, /^ {2}unit-3: failed; turns 7\/8; calls 48 reserved, 48 completed/mu);
    assert.match(human.stdout, /1 profile-repair requests in unit-3/u);
    assert.match(human.stdout, /0 provider-call failures; 1 local budget\/runtime stops in unit-3/u);
    assert.match(human.stdout, /^Registered verdict: none found in artifact root\.$/mu);
    assert.match(human.stdout, /recovery or continuation remains unresolved/u);
    assert.match(human.stdout, /^Human decision required: yes$/mu);
    assert.match(human.stdout, /ignored an incomplete trailing JSONL fragment/u);

    const machine = run(['--json']);
    assert.equal(machine.status, 0, machine.stderr);
    const status = JSON.parse(machine.stdout);
    assert.deepEqual(status.unitCounts, { complete: 2, active: 0, failed: 1, missing: 3 });
    assert.deepEqual(status.turns, { completed: 23, planned: 48 });
    assert.deepEqual(status.calls, {
      reserved: 104,
      completed: 104,
      failed: 0,
      hardCeiling: 288,
      remaining: 184,
    });
    assert.equal(status.units.find((unit) => unit.id === 'unit-3').turnsCompleted, 7);
    assert.equal(status.repairsOrRecovery.profileRepairRequests, 1);
    assert.equal(status.repairsOrRecovery.adherenceExhaustions, 1);
    assert.equal(status.failures.providerCallFailures, 0);
    assert.equal(status.failures.localBudgetOrRuntimeStops, 1);
    assert.equal(status.seal.state, 'unsealed');
    assert.equal(status.registeredVerdict.found, false);
    assert.equal(status.modelActivity.state, 'not verifiable');
    assert.equal(status.humanDecisionRequired, true);

    assert.deepEqual(fixtureTreeSnapshot(fixture), before, 'status reads must preserve every fixture byte');
    assert.equal(fs.existsSync(providerLog), false, 'status must not invoke the provider trap');
    assert.doesNotMatch(source, /\b(?:callAI|streamAI|fetch|spawn|execFile)\s*\(/u);
    assert.doesNotMatch(source, /fs\.(?:write|append|mkdir|rm|rename|link|open)/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('passthrough status projection pins all six lines, exact bytes, and input immutability', () => {
  const status = {
    surface: 'passthrough',
    turn: 3,
    model: { ref: 'codex.example', provider: 'codex', model: 'example' },
    setup: 'world_x — A Test',
    publicMessageCount: 4,
    appearance: { themeLabel: 'Nocturne', motion: 'off', colorMode: 'none' },
    voice: { enabled: false, model: 'realtime-mini', voice: 'marin' },
  };
  const before = structuredClone(status);
  const lines = projectTutorStubSessionStatusLines({ status, colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(lines.length, 6);
  assert.equal(sha256(output), 'f058a810392029aa3d95221811d12a9b4fb3832be645b30b28694555457f22e8');
  assert.match(output, /speaker model: codex\.example → codex\/example/u);
  assert.match(output, /one speaker call per turn.*summaries off<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(status, before, 'passthrough projection must not mutate its input');
});

test('normal status projection pins all eighteen default lines and exact bytes', () => {
  const status = normalStatusFixture();
  const before = structuredClone(status);
  const lines = projectTutorStubSessionStatusLines({ status, colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(lines.length, 18);
  assert.equal(sha256(output), '8ef81cc46cd43d0079a6762a84d5d236596a3f17dde23b7113eaf734c69b7790');
  assert.match(output, /model routing: interpretation codex\.sol · reasoning codex\.sol/u);
  assert.match(output, /light adaptation: on — seeded style \+ character shift after 2 consecutive/u);
  assert.match(output, /appearance: Nocturne · off motion \(auto selected\) · none/u);
  assert.match(output, /explanations: off .*\/help<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(status, before, 'normal projection must not mutate its input');
});

test('alternate normal status pins directed, disabled, running, canary, and technical branches', () => {
  const status = normalStatusFixture();
  Object.assign(status, {
    modeLabel: '<bright-yellow><bold>COACH<reset>',
    turn: 7,
    modelRouting: { allRolesOverrideRef: 'openai.mini' },
    committee: { enabled: false },
    voice: { enabled: true, model: 'realtime-pro', voice: 'cedar' },
    randomPerformance: { enabled: true, axes: [] },
    lightAdaptation: { enabled: false, threshold: 3 },
    directedPerformance: { register: 'socratic', character: 'schoolmaster' },
    directorRequest: { text: 'Ask for a concrete example.', effectiveFromTurn: 6 },
    conversation: { closureLabel: 'provisional closure', coachPending: 2, coachUsed: 3 },
    autoHandoff: { pending: null, running: true },
    turnFeedback: { enabled: false, label: null },
    responseDetails: { enabled: false },
    tuning: { mode: 'canary', stableVersion: 4, canaryVersion: 5, sessionCandidateCount: 2 },
    appearance: { themeLabel: 'Paper', motion: 'on', requestedMotion: 'on', colorMode: 'ansi' },
    explanatoryDebug: { enabled: true, format: 'technical' },
  });
  const output = terminalBytes(projectTutorStubSessionStatusLines({ status, colors: COLORS }));

  assert.equal(sha256(output), '71a2dbaa43eaa35d9675413214a6467df0181b35fe485990c33938d21cad0225');
  assert.match(output, /one model for all roles \(openai\.mini\)/u);
  assert.match(output, /frontier-only responses/u);
  assert.match(output, /armed; both axes explicitly directed/u);
  assert.match(output, /auto handoff: running/u);
  assert.match(output, /stable v4 · canary v5 · 2 session candidates/u);
  assert.match(output, /explanations: on \(technical details\)/u);
  assert.doesNotMatch(output, /selected\)/u);
});

test('queued auto handoff and random axes preserve grounded, singular, and plural wording', () => {
  const status = normalStatusFixture();
  status.randomPerformance = { enabled: true, axes: ['style', 'character'] };
  status.autoHandoff = { pending: { afterTurn: 8, requestedTurns: null }, running: false };
  let output = terminalBytes(projectTutorStubSessionStatusLines({ status, colors: COLORS }));

  assert.match(output, /assessment-independent style \+ character/u);
  assert.match(output, /queued after tutor turn 8 · until grounded/u);

  status.autoHandoff.pending.requestedTurns = 1;
  output = terminalBytes(projectTutorStubSessionStatusLines({ status, colors: COLORS }));
  assert.match(output, /queued after tutor turn 8 · 1 turn · \/auto<reset>/u);

  status.autoHandoff.pending.requestedTurns = 3;
  output = terminalBytes(projectTutorStubSessionStatusLines({ status, colors: COLORS }));
  assert.match(output, /queued after tutor turn 8 · 3 turns · \/auto<reset>/u);
});

test('real normal and passthrough /status commands preserve exact no-model terminal blocks', () => {
  const commonArgs = [
    'scripts/tutor-stub.js',
    '--no-opening',
    '--no-closeout-report',
    '--no-interim-animation',
    '--no-stream',
    '--no-trace',
    '--no-remember-settings',
    '--world',
    'world_005_marrick',
  ];
  const run = (passthrough) =>
    spawnSync(process.execPath, passthrough ? [...commonArgs, '--passthrough'] : commonArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/status\n/quit\n',
      timeout: 15_000,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });
  const normalResult = run(false);
  const passthroughResult = run(true);
  const normal = normalResult.stdout.match(/session status >[\s\S]*?\n\n/u)?.[0] || '';
  const passthrough = passthroughResult.stdout.match(/session status >[\s\S]*?\n\n/u)?.[0] || '';

  assert.equal(normalResult.status, 0, normalResult.stderr);
  assert.equal(Buffer.byteLength(normal), 1346);
  assert.equal(sha256(normal), '49b25a1d28e2a5062179c34adb1b7f8083192f44ca90a4c7e2401b01653bbea4');
  assert.equal(passthroughResult.status, 0, passthroughResult.stderr);
  assert.equal(Buffer.byteLength(passthrough), 406);
  assert.equal(sha256(passthrough), '8756733576dddd064fd719af5324cf0d13735932f01100af9f0d1d14bc704e00');
});

test('the CLI retains status state derivation, helper calls, slash dispatch, and terminal ownership', () => {
  const cliSource = readTutorStubApplicationSource();
  const compositionSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveApplicationComposition.js'),
    'utf8',
  );
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubSessionStatusPresentation.js'), 'utf8');
  const commandSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubCommandRuntime.js'), 'utf8');
  const controllerSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveSessionController.js'),
    'utf8',
  );
  const statusSlice = controllerSource.slice(
    controllerSource.indexOf('function printInteractiveStatus'),
    controllerSource.indexOf('function queueCoachGuidance'),
  );

  assert.match(cliSource, /createTutorStubInteractiveApplicationComposition/u);
  assert.match(compositionSource, /from '\.\/tutorStubSessionStatusPresentation\.js';/u);
  assert.match(compositionSource, /createTutorStubInteractiveSessionController/u);
  assert.match(statusSlice, /state\.passthrough\?\.enabled/u);
  assert.match(statusSlice, /tutorStubDagFactDropoutSnapshot/u);
  assert.match(statusSlice, /tutorStubReleasePacingSnapshot/u);
  assert.match(statusSlice, /mixedLearnerProfilePresentation/u);
  assert.match(statusSlice, /explicitPerformanceDirectiveValue/u);
  assert.match(statusSlice, /liveModelRoleRef/u);
  assert.match(statusSlice, /plainPolicyLabel/u);
  assert.match(statusSlice, /oneLine\(directorDirection\.text/u);
  assert.match(statusSlice, /tutorStubTurnFeedbackEnvelope/u);
  assert.match(statusSlice, /projectTutorStubSessionStatusLines/u);
  assert.match(statusSlice, /console\.log\(line\)/u);
  assert.match(commandSource, /if \(trimmed === '\/status'\)[\s\S]{0,120}printInteractiveStatus\(\)/u);
  assert.doesNotMatch(statusSlice, /one speaker call per turn/u);
  assert.doesNotMatch(statusSlice, /commands remain live while models work/u);
  assert.match(serviceSource, /export function projectTutorStubSessionStatusLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
