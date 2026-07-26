import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubDialogueSettingsLines } from '../services/tutorStubDialogueSettingsPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({ cyan: '<cyan>', dim: '<dim>', reset: '<reset>' });

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function defaultSettingsFixture() {
  return {
    allRolesOverrideRef: null,
    classifierCombined: false,
    modelRoles: [
      {
        role: 'tutor',
        label: 'Tutor voice',
        modelRef: 'codex.gpt-5.6-terra',
        resolved: { provider: 'codex', model: 'gpt-5.6-terra' },
        combinedOwner: false,
        active: true,
      },
      {
        role: 'classifier',
        label: 'Learner interpretation',
        modelRef: 'codex.gpt-5.6-sol',
        resolved: { provider: 'codex', model: 'gpt-5.6-sol' },
        combinedOwner: false,
        active: true,
      },
      {
        role: 'reasoning',
        label: 'Learner reasoning tracker',
        modelRef: 'codex.gpt-5.6-sol',
        resolved: { provider: 'codex', model: 'gpt-5.6-sol' },
        combinedOwner: false,
        active: false,
      },
      {
        role: 'learner',
        label: 'Learner voice',
        modelRef: 'codex.gpt-5.6-terra',
        resolved: { provider: 'codex', model: 'gpt-5.6-terra' },
        combinedOwner: false,
        active: true,
      },
    ],
    tutorEffort: 'medium',
    appearance: { themeLabel: 'Nocturne', requestedMotion: 'auto', motion: 'off' },
    committee: { enabled: true, miniModel: 'program2-sft-instruct-v2', fallbackPolicy: 'v2' },
    publicMessageCount: 0,
    teaching: {
      policyLabel: 'model-reviewed adaptive choice',
      policyStackId: 'dynamic',
      overlays: [],
      overlayThreshold: 0.7,
      styleRange: 0.15,
      temperatureSelection: {
        applied: false,
        scope: 'saved_but_not_used_by_policy',
        scopeLabel: 'saved but not used by policy',
      },
      randomPerformance: { enabled: false, axes: ['style', 'character'] },
      lightAdaptation: { enabled: true, threshold: 2 },
      directedPerformance: { register: null, character: null },
    },
    dropout: { rate: 0, activeCount: 0, adoptedCount: 0 },
    releasePacing: { baseSpeed: 1, effectiveSpeed: 1, direction: 'steady' },
    rememberedSettings: { enabled: false, status: 'disabled' },
  };
}

function candidateReuseLines() {
  return [
    '<dim>  training reuse: training candidate; requested on; owner operator; source repository default<reset>',
    '<dim>  candidate means eligible for later review, not automatically approved or exported for training<reset>',
  ];
}

test('default settings projection pins all 23 lines, exact bytes, and input immutability', () => {
  const input = { settings: defaultSettingsFixture(), trainingReuseLines: candidateReuseLines(), colors: COLORS };
  const before = structuredClone(input);
  const lines = projectTutorStubDialogueSettingsLines(input);
  const output = terminalBytes(lines);

  assert.equal(lines.length, 23);
  assert.equal(sha256(output), 'de1e3f6c7b7553acac4ccbc4835ad3c30d723914a1d065f91f7c8e2e19d3494e');
  assert.match(output, /one model for all roles: off — roles selected separately/u);
  assert.match(output, /style range is saved but not used by this approach/u);
  assert.match(output, /training reuse: training candidate/u);
  assert.match(output, /settings forget<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before, 'projection must not mutate its input');
});

test('alternate settings projection covers combined roles, directed axes, disabled controls, and loaded memory', () => {
  const settings = defaultSettingsFixture();
  Object.assign(settings, {
    allRolesOverrideRef: 'openai.mini',
    classifierCombined: true,
    tutorEffort: null,
    appearance: { themeLabel: 'Parchment', requestedMotion: 'full', motion: 'full' },
    committee: { enabled: false, miniModel: null, fallbackPolicy: null },
    publicMessageCount: 7,
    dropout: { rate: 0.25, activeCount: 2, adoptedCount: 4 },
    releasePacing: { baseSpeed: 0.75, effectiveSpeed: 0.5, direction: 'slower' },
    rememberedSettings: { enabled: true, status: 'loaded' },
  });
  settings.modelRoles[0].combinedOwner = true;
  settings.modelRoles[1].active = false;
  settings.modelRoles[2].active = false;
  settings.modelRoles[3].active = false;
  Object.assign(settings.teaching, {
    policyLabel: 'adaptive weighted choice',
    policyStackId: 'dynamical_system+state+field',
    overlays: ['state', 'field'],
    overlayThreshold: 0.8,
    styleRange: 0.55,
    temperatureSelection: {
      applied: false,
      scope: 'bypassed_by_explicit_directive',
      scopeLabel: 'bypassed by explicit directive',
    },
    randomPerformance: { enabled: true, axes: [] },
    lightAdaptation: { enabled: false, threshold: 3 },
    directedPerformance: { register: 'precise', character: 'adversarial_teacher' },
  });
  const output = terminalBytes(
    projectTutorStubDialogueSettingsLines({
      settings,
      trainingReuseLines: [
        '<dim>  training reuse: do not train; requested off; owner operator; source cli opt out<reset>',
        '<dim>  this source and derived descendants must remain outside training corpora<reset>',
      ],
      colors: COLORS,
    }),
  );

  assert.equal(sha256(output), 'b23a724d900ee66d3d6ddd3f2a5cb3910b64e625534472eea20958655523437b');
  assert.match(output, /active; also performs learner interpretation/u);
  assert.match(output, /inactive; combined into reasoning tracker/u);
  assert.match(output, /frontier-only responses/u);
  assert.match(output, /bypassed on axes controlled by/u);
  assert.match(output, /armed; both axes explicitly directed/u);
  assert.match(output, /directed performance: style precise; character adversarial_teacher/u);
  assert.match(output, /reuse these settings next time: yes; loaded/u);
});

test('active style range and random single-axis wording remain explicit', () => {
  const settings = defaultSettingsFixture();
  settings.teaching.temperatureSelection = {
    applied: true,
    scope: 'engagement_stance_and_actorial_part',
    scopeLabel: 'engagement stance and actorial part',
  };
  settings.teaching.randomPerformance = { enabled: true, axes: ['character'] };
  const output = terminalBytes(
    projectTutorStubDialogueSettingsLines({ settings, trainingReuseLines: candidateReuseLines(), colors: COLORS }),
  );

  assert.match(output, /style range is active for engagement stance and actorial part/u);
  assert.match(output, /random performance: on — character ignore assessment/u);
});

test('real default and configured /settings commands preserve exact no-model terminal blocks', () => {
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
  const variants = [
    {
      name: 'default',
      args: [],
      bytes: 2131,
      hash: '8b1e655838355028d7562d4b3cc135ab41567b286e51c78fdddc4fccb453c03a',
    },
    {
      name: 'configured',
      args: [
        '--no-committee',
        '--no-light-adaptation',
        '--no-training-reuse',
        '--register-policy',
        'dynamical_system+state',
        '--register-temperature',
        '0.55',
        '--dag-fact-dropout',
        '0.25',
        '--release-speed',
        '1.5',
        '--theme',
        'parchment',
        '--motion',
        'full',
      ],
      bytes: 1960,
      hash: '62ee02afda20311a0b6ac1af068e8373dd7bb5a3ffdb5e94448047ce0d2b543c',
    },
  ];

  for (const variant of variants) {
    const result = spawnSync(process.execPath, [...commonArgs, ...variant.args], {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/settings\n/quit\n',
      timeout: 15_000,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });
    const matches = [...result.stdout.matchAll(/settings >[\s\S]*?\n\n/gu)];
    const block = matches.at(-1)?.[0] || '';

    assert.equal(result.status, 0, `${variant.name}: ${result.stderr}`);
    assert.equal(block.split('\n').length - 2, 23, variant.name);
    assert.equal(Buffer.byteLength(block), variant.bytes, variant.name);
    assert.equal(sha256(block), variant.hash, variant.name);
  }
});

test('the CLI retains settings state derivation, helper calls, command ownership, and terminal writes', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubDialogueSettingsPresentation.js'),
    'utf8',
  );
  const settingsSlice = cliSource.slice(
    cliSource.indexOf('function trainingReuseStatusLines'),
    cliSource.indexOf('function printModelChoices'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubDialogueSettingsPresentation\.js';/u);
  assert.match(settingsSlice, /state\.trainingReuse/u);
  assert.match(settingsSlice, /tutorStubTrainingReuseLabel/u);
  assert.match(settingsSlice, /displayDiagnosticLabel/u);
  assert.match(settingsSlice, /explicitPerformanceDirectiveValue/u);
  assert.match(settingsSlice, /performanceTemperatureScope/u);
  assert.match(settingsSlice, /liveModelRoleSnapshot/u);
  assert.match(settingsSlice, /tutorStubPublicMessagesForSpeaker/u);
  assert.match(settingsSlice, /plainPolicyLabel/u);
  assert.match(settingsSlice, /tutorStubRegisterPolicyStackId/u);
  assert.match(settingsSlice, /tutorStubDagFactDropoutSnapshot/u);
  assert.match(settingsSlice, /tutorStubReleasePacingSnapshot/u);
  assert.match(settingsSlice, /projectTutorStubTrainingReuseStatusLines/u);
  assert.match(settingsSlice, /projectTutorStubDialogueSettingsLines/u);
  assert.match(settingsSlice, /console\.log\(line\)/u);
  assert.doesNotMatch(settingsSlice, /one model for all roles/u);
  assert.doesNotMatch(settingsSlice, /advanced overrides/u);
  assert.match(cliSource, /printDialogueSettings\(\)/u);
  assert.match(serviceSource, /export function projectTutorStubDialogueSettingsLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
