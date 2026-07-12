import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tutorStubDryRun(extraArgs = []) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--no-trace',
        '--world',
        'world_005_marrick',
        '--dag',
        '--tutor-learner-dag',
        ...extraArgs,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
}

function plainTerminalText(value) {
  // Build the ESC char dynamically so the ANSI-strip regex carries no
  // control-character escape in a literal (no-control-regex).
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '')
    .replace(ansi, '')
    .replace(/\r/gu, '');
}

test('tutor-stub dry run exposes human discourse trace schemas', () => {
  const config = tutorStubDryRun(['--dag-mode', 'defeasible-human-scaffold']);

  assert.equal(config.humanDiscourse.schema, 'machinespirits.tutor-stub.human-discourse-run-config.v1');
  assert.equal(config.humanDiscourse.dagMode, 'defeasible_human_scaffold');
  assert.equal(config.humanDiscourse.strictAuditDag, true);
  assert.equal(config.humanDiscourse.tutorLearnerDag, true);
  assert.equal(config.humanDiscourse.phase, 'phase_2_human_scaffold_prompting');
  assert.equal(config.humanDiscourse.scaffoldActive, true);
  assert.equal(config.humanDiscourse.behaviorChange, true);
  assert.equal(config.humanDiscourse.stepCompression.enabled, true);
  assert.equal(config.humanDiscourse.stepCompression.maxExplicitDemandsPerTurn, 1);
  assert.match(config.humanDiscourse.stepCompression.policy, /obvious public bridges/u);
  assert.deepEqual(config.humanDiscourse.traceFields, [
    'humanDiscourseFrame',
    'scaffoldState',
    'sideArc',
    'proofDebt',
    'warrantPremiseAudit',
    'generousInference',
    'questionSupport',
  ]);
  assert.equal(config.humanDiscoursePreviewFrame.mode, 'defeasible_human_scaffold');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldActive, true);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.status, 'projected_from_dramaturgy');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.activeAct.title, 'The Light Shillings');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.branch.id, 'mirror_pressure');
  assert.match(config.humanDiscoursePreviewFrame.scaffoldState.localQuestion, /town case/u);
  assert.equal(config.humanDiscoursePreviewFrame.stepCompression.enabled, true);
  assert.equal(config.humanDiscoursePreviewFrame.generousInference.applied, false);
  assert.equal(config.humanDiscoursePreviewFrame.questionSupport.answerability, 'publicly_answerable');
  assert.equal(config.cliEffort, 'medium');
  assert.deepEqual(config.dialogueClosure, {
    schema: 'machinespirits.tutor-stub.dialogue-closure.v1',
    enabled: true,
    phase: 'open',
    allowCheckIn: true,
    allowAuthoredDagClosure: true,
    reachedAtTurn: null,
    completedAtTurn: null,
    basis: null,
  });
  assert.match(config.systemPrompt, /Let human learners compress obvious reasoning/u);
  assert.match(config.systemPrompt, /Ask for an explicit missing bridge only when/u);
  assert.match(config.systemPrompt, /Treat learner questions as legitimate moves/u);
  assert.match(config.systemPrompt, /invite one concrete in-scene question/u);
  assert.match(config.systemPrompt, /never call either speaker "the tutor" or "the learner"/u);
  assert.match(config.systemPrompt, /learner may connect several already-public premises/u);
  assert.match(config.systemPrompt, /credit the whole chain/u);
  assert.equal(config.tutorLearnerDag.multiPremiseAdvance.enabled, true);
  assert.equal(config.tutorLearnerDag.multiPremiseAdvance.schema, 'machinespirits.tutor-stub.learner-advance.v1');
  assert.ok(config.tutorLearnerDag.multiPremiseAdvance.downstream.includes('register'));
});

test('tutor-stub DAG mode defaults to strict audit mode', () => {
  const config = tutorStubDryRun();

  assert.equal(config.humanDiscourse.dagMode, 'strict_dag');
  assert.equal(config.humanDiscourse.scaffoldActive, false);
  assert.equal(config.humanDiscourse.behaviorChange, false);
  assert.equal(config.humanDiscourse.stepCompression.enabled, false);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldActive, false);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.status, 'not_enabled_strict_dag');
});

test('automated dialogue closure stays tied to strict grounded stopping', () => {
  const config = tutorStubDryRun(['--auto-learner']);

  assert.equal(config.dialogueClosure.enabled, true);
  assert.equal(config.dialogueClosure.allowCheckIn, false);
  assert.equal(config.dialogueClosure.allowAuthoredDagClosure, false);
  assert.equal(config.autoLearner.stopOnGrounded, true);
});

test('mixed tutor-stub advertises profile expression beside Tab, suggest, and use', () => {
  const config = tutorStubDryRun(['--mixed-learner']);

  assert.equal(config.mixedLearner.enabled, true);
  assert.equal(config.mixedLearner.profileId, 'diligent');
  assert.deepEqual(config.mixedLearner.profilePresentation, {
    promptLabel: true,
    intendedPattern: true,
    visibleExpression: 'profile_signal',
    readyAnnouncement: 'once_per_profile',
    firstTutorOrdering: 'ready_profile_then_director_then_tutor',
    initialPicker: {
      enabled: true,
      defaultProfileId: 'diligent',
      keyboardMenu: true,
      navigation: ['up', 'down', 'enter'],
      nonTtyFallback: 'typed_profile_id',
    },
  });
  assert.match(config.mixedLearner.accept, /Tab/u);
  assert.equal(config.mixedLearner.inspect, '/suggest');
  // Model selection was removed from first-run setup (2026-07-12); it stays
  // changeable at runtime via /settings model.
  assert.deepEqual(config.mixedLearner.startupPrompts.order, ['learner_profile', 'dag_fact_dropout']);
  assert.equal(config.mixedLearner.startupPrompts.tutorModel.enabled, false);
  assert.equal(config.mixedLearner.startupPrompts.tutorModel.firstRunSelection, false);
  assert.equal(config.mixedLearner.startupPrompts.tutorModel.liveCommand, '/settings model <provider.alias>');
  assert.equal(config.mixedLearner.startupPrompts.engagementStanceTemperature.recommended, 0.85);
  assert.equal(config.mixedLearner.startupPrompts.dagFactDropout.recommended, 0);
  assert.deepEqual(config.scenarioPicker, {
    enabled: true,
    defaultScenarioId: 'world_005_marrick',
    selectedScenarioId: 'world_005_marrick',
    keyboardMenu: true,
    activeInThisTerminal: false,
    navigation: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'enter'],
    descriptionFields: ['question', 'setting', 'discipline'],
    nonTtyFallback: '--world',
    selection: null,
  });
});

test('fresh mixed session prints the ready profile card before the first tutor message', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-mixed-opening-'));
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
  const response = input.includes('# Mixed learner artifacts')
    ? JSON.stringify({
        move: 'ask_question',
        clue: 'Ask which assay record would distinguish the two hands.',
        answer: 'Which assay record would show whose hand worked the metal?',
        profile_signal: 'Requests a specific evidentiary basis before making a conclusion.'
      })
    : '{}';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);

  let stdout = '';
  let stderr = '';
  try {
    const child = spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'continuous_dynamical_system',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    await new Promise((resolve, reject) => {
      let browsedStressProfiles = false;
      let acceptedDefault = false;
      let acceptedTemperature = false;
      let acceptedDropout = false;
      let requestedExit = false;
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`mixed opening test timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }, 10_000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        const plain = plainTerminalText(stdout);
        if (!browsedStressProfiles && plain.includes('learner profile [diligent] >')) {
          browsedStressProfiles = true;
          child.stdin.write('stress\n');
        } else if (!acceptedDefault && plain.includes('learner profiles > specialist failure modes (6)')) {
          acceptedDefault = true;
          child.stdin.write('\n');
        } else if (!acceptedTemperature && plain.includes('stance temperature [0.85; recommended] >')) {
          acceptedTemperature = true;
          child.stdin.write('\n');
        } else if (!acceptedDropout && plain.includes('DAG fact dropout [0; recommended] >')) {
          acceptedDropout = true;
          child.stdin.write('\n');
        } else if (!requestedExit && plain.includes('tutor >')) {
          requestedExit = true;
          child.stdin.end('/quit\n');
        }
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`mixed opening exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      });
    });

    const plain = plainTerminalText(stdout);
    const pickerIndex = plain.indexOf('Pick a learner profile');
    const temperatureIndex = plain.indexOf('stance temperature [0.85; recommended] >');
    const dropoutIndex = plain.indexOf('DAG fact dropout [0; recommended] >');
    const readyIndex = plain.indexOf('mixed learner answer + clue ready');
    const profileIndex = plain.indexOf('profile > diligent — Diligent control');
    const directorIndex = plain.indexOf('director context >');
    const tutorIndex = plain.indexOf('tutor >');
    assert.ok(pickerIndex >= 0, plain);
    assert.match(plain, /learner profile \[diligent\] >/u);
    assert.match(plain, /learner profiles > specialist failure modes \(6\)/u);
    assert.match(plain, /proof_skipper: Stress - Proof skipper/u);
    assert.ok((plain.match(/learner profile \[diligent\] >/gu) || []).length >= 2, plain);
    // Model selection was removed from first-run setup (2026-07-12): profile
    // flows straight to the temperature/dropout tuning prompts.
    assert.doesNotMatch(plain, /tutor model \[/u);
    assert.ok(temperatureIndex > pickerIndex, plain);
    assert.ok(dropoutIndex > temperatureIndex, plain);
    assert.ok(readyIndex > dropoutIndex, plain);
    assert.ok(profileIndex > readyIndex, plain);
    assert.ok(directorIndex > profileIndex, plain);
    assert.ok(tutorIndex > directorIndex, plain);
    assert.equal((plain.match(/director context >/gu) || []).length, 1, plain);
    const directorPrelude = plain.slice(directorIndex, tutorIndex);
    assert.match(directorPrelude, /stage:/u);
    assert.match(directorPrelude, /tutor:/u);
    assert.match(directorPrelude, /learner:/u);
    assert.match(directorPrelude, /register:/u);
    assert.doesNotMatch(directorPrelude, /mixed learner answer \+ clue ready|profile > diligent/u);
    assert.match(plain, /drafted as: Requests a specific evidentiary basis before making a conclusion\./u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'fresh TTY scenario and profile pickers scroll with arrow keys and select with Enter',
  { skip: process.platform === 'win32', timeout: 10_000 },
  async () => {
    let terminalOutput = '';
    let scenarioNavigated = false;
    let profileNavigated = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 100,
        rows: 16,
        name: 'xterm-color',
        env: { ...process.env, TERM: 'xterm-color' },
      },
    );

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`TTY profile picker timed out\n${plainTerminalText(terminalOutput)}`));
      }, 8_000);
      terminal.onData((chunk) => {
        terminalOutput += chunk;
        const plain = plainTerminalText(terminalOutput);
        if (!scenarioNavigated && plain.includes('Pick a scenario') && plain.includes('question >')) {
          scenarioNavigated = true;
          terminal.write(`${'\x1b[B'.repeat(3)}\r`);
        } else if (!profileNavigated && plain.includes('Pick a learner profile') && plain.includes('diligent')) {
          profileNavigated = true;
          terminal.write(`${'\x1b[B'.repeat(9)}\r`);
        } else if (!requestedExit && plain.includes('DAG fact dropout [0; recommended] >')) {
          requestedExit = true;
          terminal.write('quit\r');
        }
      });
      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(timer);
        if (exitCode === 0) resolve();
        else reject(new Error(`TTY profile picker exited ${exitCode} (${signal})\n${terminalOutput}`));
      });
    });

    const plain = plainTerminalText(terminalOutput);
    assert.match(plain, /↑\/↓ scroll · Enter select/u);
    assert.match(plain, /highlighted scenario described below/u);
    assert.match(plain, /question > Whose hand struck the false shillings/u);
    assert.match(plain, /question > Whose hand felled the Hethel bridge span/u);
    assert.match(plain, /scenario > world_006_hethel — The Fallen Span/u);
    assert.match(plain, /world: world_006_hethel — The Fallen Span/u);
    assert.match(plain, /highlighted learner described below/u);
    assert.match(plain, /does > Make occasional partial claims, then repair/u);
    assert.match(plain, /does > Name competing interpretations and refuse closure/u);
    assert.match(plain, /edge > versus skeptical: skeptical asks for warrant/u);
    assert.match(plain, /↑ 2 more/u);
    assert.match(plain, /learner profile > contradiction_keeper — Contradiction keeper/u);
    // Model selection was removed from first-run setup (2026-07-12).
    assert.doesNotMatch(plain, /Pick a tutor model/u);
    assert.match(plain, /DAG fact dropout \[0; recommended\] >/u);
    assert.doesNotMatch(plain, /mixed learner answer \+ clue ready/u);
  },
);

test(
  'live TTY settings panel edits numeric settings with keyboard controls',
  { skip: process.platform === 'win32', timeout: 10_000 },
  async () => {
    let terminalOutput = '';
    let opened = false;
    let selectedTemperature = false;
    let adjustedTemperature = false;
    let closedPanel = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 100,
        rows: 20,
        name: 'xterm-color',
        env: { ...process.env, TERM: 'xterm-color' },
      },
    );

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`TTY settings picker timed out\n${plainTerminalText(terminalOutput)}`));
      }, 8_000);
      terminal.onData((chunk) => {
        terminalOutput += chunk;
        const plain = plainTerminalText(terminalOutput);
        if (!opened && plain.includes('learner >')) {
          opened = true;
          terminal.write('/settings\r');
        } else if (!selectedTemperature && plain.includes('Settings · choose what to change')) {
          selectedTemperature = true;
          terminal.write('\x1b[B\r');
        } else if (!adjustedTemperature && plain.includes('Engagement-stance temperature')) {
          adjustedTemperature = true;
          terminal.write('\x1b[C\r');
        } else if (!closedPanel && plain.includes('stance temp 0.85 → 0.9')) {
          closedPanel = true;
          terminal.write('\x1b[F\r');
        } else if (!requestedExit && plain.includes('settings closed')) {
          requestedExit = true;
          terminal.write('/quit\r');
        }
      });
      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(timer);
        if (exitCode === 0) resolve();
        else reject(new Error(`TTY settings picker exited ${exitCode} (${signal})\n${terminalOutput}`));
      });
    });

    const plain = plainTerminalText(terminalOutput);
    assert.match(plain, /Settings · choose what to change/u);
    assert.match(plain, /Tutor model\s+codex\.gpt-5\.6-terra/u);
    assert.match(plain, /State overlay\s+off/u);
    assert.match(plain, /↑\/↓ move · Enter edit or toggle · Esc finish/u);
    assert.match(plain, /range 0\.05–3 · ←\/→ 0\.05 · PgUp\/PgDn 0\.25 · R recommended 0\.85/u);
    assert.match(plain, /stance temp 0\.85 → 0\.9/u);
    assert.match(plain, /settings closed · type \/settings to reopen/u);
  },
);

test('tutor-stub dry run exposes configurable register temperature', () => {
  const config = tutorStubDryRun(['--register-policy', 'continuous_dynamical_system', '--register-temperature', '0.4']);

  assert.equal(config.registerSelection.temperature, 0.4);
  assert.equal(config.registerSelection.engagementStanceTemperature, 0.4);
  assert.equal(config.registerSelection.temperatureScope, 'engagement_stance_only');
  assert.equal(config.registerSelection.policy, 'continuous_dynamical_system');
});

test('mixed startup prompts preserve launch overrides while showing recommendations', () => {
  const config = tutorStubDryRun([
    '--mixed-learner',
    '--register-policy',
    'continuous_dynamical_system',
    '--register-temperature',
    '0.4',
    '--dag-fact-dropout',
    '0.15',
    '--dag-fact-dropout-seed',
    '7',
  ]);

  assert.deepEqual(config.mixedLearner.startupPrompts.order, [
    'learner_profile',
    'engagement_stance_temperature',
    'dag_fact_dropout',
  ]);
  assert.deepEqual(config.mixedLearner.startupPrompts.engagementStanceTemperature, {
    enabled: true,
    default: 0.4,
    recommended: 0.85,
    range: [0.05, 3],
  });
  assert.deepEqual(config.mixedLearner.startupPrompts.dagFactDropout, {
    enabled: true,
    default: 0.15,
    recommended: 0,
    range: [0, 1],
    seed: 7,
  });
});

test('tutor-stub dry run exposes seeded accumulated DAG-fact dropout', () => {
  const config = tutorStubDryRun(['--dag-fact-dropout', '0.15', '--dag-fact-dropout-seed', '7']);

  assert.deepEqual(config.dagFactDropout, {
    schema: 'machinespirits.tutor-stub.dag-fact-dropout.v1',
    rate: 0.15,
    seed: 7,
    enabled: true,
    graceTurns: 2,
    maxConcurrent: 2,
    eligibleFacts: 'adopted_public_premises_only',
    backgroundFactsImmune: true,
    visibility: 'conduct',
  });
});

test('tutor-stub dry run exposes independent response-configuration axes', () => {
  const config = tutorStubDryRun();

  assert.equal(config.responseConfiguration.primaryStanceField, 'engagement_stance');
  assert.equal(config.responseConfiguration.temperatureScope, 'engagement_stance_only');
  assert.deepEqual(config.responseConfiguration.independentAxes, [
    'engagement_stance',
    'action_family',
    'audience_register',
    'lexical_accessibility',
    'scene_immersion',
  ]);
  assert.equal(config.responseConfiguration.transcriptVisibilityAudit, true);
});

test('tutor-stub dry run exposes the non-DAG comprehension side-state', () => {
  const config = tutorStubDryRun();

  assert.deepEqual(config.comprehensionSideState, {
    enabled: true,
    schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
    sources: ['learner_turn', 'slash_explain'],
    advancesLearnerDag: false,
  });
});

test('tutor-stub changes register temperature through live settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-register-temp-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--register-policy',
        'continuous_dynamical_system',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '/settings\n/settings temp 1.0\n/settings temp\n/quit\n',
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /stance temp: 0\.85/u);
    assert.match(result.stdout, /stance temp 0\.85 → 1/u);
    assert.match(result.stdout, /stance temp: 1/u);
    assert.match(result.stdout, /lower sharpens the dominant engagement stance/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => fs.readFileSync(path.join(tmp, name), 'utf8'))
      .join('\n');
    assert.match(traces, /"type":"register_temperature_changed"/u);
    assert.match(traces, /"previous":0\.85,"temperature":1/u);
    assert.match(traces, /"scope":"engagement_stance_only"/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tutor-stub changes DAG-fact dropout through live settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-dag-dropout-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--tutor-learner-dag',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '/settings\n/settings dropout 0.15\n/settings dropout\n/quit\n',
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /DAG fact dropout: 0 \(off\)/u);
    assert.match(result.stdout, /DAG fact dropout 0 → 0\.15/u);
    assert.match(result.stdout, /DAG fact dropout: 0\.15 \(on\)/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => fs.readFileSync(path.join(tmp, name), 'utf8'))
      .join('\n');
    assert.match(traces, /"type":"dag_fact_dropout_changed"/u);
    assert.match(traces, /"previous":0,"rate":0\.15,"seed":1/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tutor-stub lists and changes the speaking tutor model through live settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-model-setting-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '/settings model\n/settings model codex.gpt-5.6-luna\n/settings\n/quit\n',
      },
    );

    assert.equal(result.status, 0);
    const plain = plainTerminalText(result.stdout);
    assert.match(plain, /tutor models > current codex\.gpt-5\.6-terra/u);
    assert.match(plain, /codex\.gpt-5\.6-luna/u);
    assert.match(plain, /tutor model codex\.gpt-5\.6-terra → codex\.gpt-5\.6-luna/u);
    assert.match(plain, /tutor model: codex\.gpt-5\.6-luna → codex\/gpt-5\.6-luna/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => fs.readFileSync(path.join(tmp, name), 'utf8'))
      .join('\n');
    assert.match(traces, /"type":"tutor_model_changed"/u);
    assert.match(traces, /"previousRef":"codex\.gpt-5\.6-terra","modelRef":"codex\.gpt-5\.6-luna"/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tutor-stub rejects register temperatures outside the documented range', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--dry-run', '--no-trace', '--register-temperature', '0'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--register-temperature must be between 0\.05 and 3/u);
});

test('tutor-stub rejects DAG-fact dropout outside the closed unit interval', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--dry-run', '--no-trace', '--dag-fact-dropout', '1.1'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--dag-fact-dropout must be between 0 and 1/u);
});

test('tutor-stub rejects unknown DAG discourse modes', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--dry-run', '--no-trace', '--world', 'world_005_marrick', '--dag-mode', 'guesswork'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown --dag-mode: guesswork/);
});

test('tutor-stub interactive help exposes clarification commands', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/help\n/id\n/clarify cupel\n/quit\n',
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\/clarify \[phrase\]/u);
  assert.match(result.stdout, /\/explain \[phrase\]/u);
  assert.match(result.stdout, /\/analysis \[technical\]/u);
  assert.match(result.stdout, /\/transcript \[no-open\]/u);
  assert.match(result.stdout, /raw, script, swimlane, analysis, prompt, and settings views/u);
  assert.match(result.stdout, /\/id/u);
  assert.match(result.stdout, /debug id >/u);
  assert.match(result.stdout, /paste the debug id into Codex/u);
  assert.match(result.stdout, /\/suggest.*profile expression/u);
  assert.match(result.stdout, /\/use.*profile expression/u);
  assert.match(result.stdout, /no tutor message is available yet/u);
});

test('tutor-stub /id exposes the local trace path for Codex debugging', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-debug-id-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      { cwd: ROOT, encoding: 'utf8', input: '/id\n/quit\n' },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /debug id >/u);
    assert.match(result.stdout, /run id:/u);
    assert.match(result.stdout, new RegExp(`trace: ${tmp.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`));
    assert.ok(fs.readdirSync(tmp).some((name) => name.endsWith('.jsonl')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resumed closing dialogue accepts one acknowledgement and terminates', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-dialogue-close-'));
  try {
    const fixturePath = path.join(tmp, '2026-07-10T00-00-00-000Z.jsonl');
    const fixtureEvent = {
      type: 'turn_complete',
      runId: 'fixture-close',
      seq: 1,
      turn: 25,
      turnId: 'fixture-close:t025',
      turnRecord: {
        turn: 25,
        turnId: 'fixture-close:t025',
        learner: 'she did it',
        tutor: 'The verdict is now licensed: Edony struck the false shillings. The dross and die both point to her.',
        tutorLearnerDagModel: {
          assessment: {
            finalSecretEntailed: false,
            assertedSecret: false,
            bottleneck: 'learner_integration_gap',
          },
          metrics: { missingPremiseCount: 1 },
        },
        tutorDag: { derivable: true, leavesReleased: 6, leavesTotal: 6 },
      },
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(fixtureEvent)}\n`);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--resume-last',
        '--no-opening',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--dag',
        '--tutor-learner-dag',
        '--dag-mode',
        'defeasible_human_scaffold',
      ],
      { cwd: ROOT, encoding: 'utf8', input: 'no thanks\n' },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /saved dialogue had already stated its verdict/u);
    assert.match(result.stdout, /verdict stands on the public evidence/u);
    assert.match(result.stdout, /inquiry is complete/u);
    assert.match(result.stdout, /dialogue_grounded_closure/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => fs.readFileSync(path.join(tmp, name), 'utf8'))
      .join('\n');
    assert.match(traces, /"type":"dialogue_closure_transition"/u);
    assert.match(traces, /"to":"closed"/u);
    assert.match(traces, /"type":"learning_summary_html"/u);
    assert.match(traces, /"reason":"dialogue_grounded_closure"/u);
    assert.match(traces, /"natural":true/u);
    const summaryFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-learning-summary.html'));
    assert.equal(summaryFiles.length, 1);
    const summaryHtml = fs.readFileSync(path.join(tmp, summaryFiles[0]), 'utf8');
    assert.match(summaryHtml, /Natural close/u);
    assert.match(summaryHtml, /The inquiry reached its natural conclusion/u);
    assert.match(summaryHtml, /no thanks/u);
    assert.match(summaryHtml, /verdict stands on the public evidence/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('mixed tutor-stub can list and switch learner profiles interactively', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/profile\n/profile list\n/profile example\n/profile diligent\n/profile\n/profile default\n/quit\n',
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /learner profiles > ordinary choices \(6\)/u);
  assert.match(result.stdout, /answer_seeking:/u);
  assert.match(result.stdout, /specialist profiles: \/profile list stress/u);
  assert.doesNotMatch(result.stdout, /premature_closure:/u);
  assert.match(result.stdout, /custom learner profile example >/u);
  assert.match(result.stdout, /struggles to connect them/u);
  assert.match(result.stdout, /observable pattern, its trigger, and the tutor support that permits progress/u);
  assert.match(result.stdout, /switched to diligent:/u);
  assert.match(result.stdout, /diligent: Diligent control/u);
  assert.doesNotMatch(result.stdout, /switched to custom profile/u);
  assert.equal((result.stdout.match(/switched to diligent:/gu) || []).length, 2);
});

test('mixed tutor-stub separates stress profiles from the ordinary interactive list', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/profile list stress\n/profile list all\n/profile list sentinel\n/quit\n',
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /learner profiles > specialist failure modes \(6\)/u);
  assert.match(result.stdout, /premature_closure:/u);
  assert.match(result.stdout, /learner profiles > complete v3 registry \(12\)/u);
  assert.match(result.stdout, /answer_seeking:/u);
  assert.match(result.stdout, /low_trust_skeptic:/u);
  assert.match(result.stdout, /unknown learner profile list: sentinel/u);
  assert.match(result.stdout, /use \/profile list, \/profile list stress, or \/profile list all/u);
});

test('auto-eval dry run forwards DAG discourse mode and register temperature to tutor-stub children', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-human-scaffold-auto-'));
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-auto-eval.js',
        '--runs',
        '1',
        '--policies',
        'continuous_dynamical_system',
        '--turns',
        '1',
        '--trace-dir',
        tmp,
        '--dag-mode',
        'human-scaffold',
        '--register-temperature',
        '0.4',
        '--dag-fact-dropout',
        '0.15',
        '--dag-fact-dropout-seed',
        '7',
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
        '--no-progress',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const summaryPath = fs
      .readdirSync(tmp)
      .filter((name) => /^auto-eval-.*\.json$/u.test(name))
      .map((name) => path.join(tmp, name))
      .at(0);
    assert.ok(summaryPath);
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.config.dagMode, 'human-scaffold');
    assert.equal(summary.config.registerTemperature, 0.4);
    assert.equal(summary.config.engagementStanceTemperature, 0.4);
    assert.equal(summary.config.temperatureScope, 'engagement_stance_only');
    assert.equal(summary.config.dagFactDropout, 0.15);
    assert.equal(summary.config.dagFactDropoutSeed, 7);
    assert.equal(summary.config.dagFactDropoutSemantics.visibility, 'conduct');
    assert.deepEqual(summary.config.responseConfiguration.independentAxes, [
      'engagement_stance',
      'action_family',
      'audience_register',
      'lexical_accessibility',
      'scene_immersion',
    ]);
    const command = summary.results[0].command;
    const modeIndex = command.indexOf('--dag-mode');
    assert.ok(modeIndex > 0);
    assert.equal(command[modeIndex + 1], 'human-scaffold');
    const temperatureIndex = command.indexOf('--register-temperature');
    assert.ok(temperatureIndex > 0);
    assert.equal(command[temperatureIndex + 1], '0.4');
    const dropoutIndex = command.indexOf('--dag-fact-dropout');
    assert.ok(dropoutIndex > 0);
    assert.equal(command[dropoutIndex + 1], '0.15');
    const dropoutSeedIndex = command.indexOf('--dag-fact-dropout-seed');
    assert.ok(dropoutSeedIndex > 0);
    assert.equal(command[dropoutSeedIndex + 1], '7');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
