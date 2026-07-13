import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';

import {
  TUTOR_STUB_LAST_SETTINGS_SCHEMA,
  clearTutorStubLastSettings,
  readTutorStubLastSettings,
  writeTutorStubLastSettings,
} from '../services/tutorStubLastSettings.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sampleSettings(overrides = {}) {
  return {
    tutorModelRef: 'codex.gpt-5.6-luna',
    engagementStanceTemperature: 0.4,
    dagFactDropoutRate: 0.15,
    releaseSpeed: 1.4,
    registerPolicy: 'continuous_dynamical_system',
    registerOverlays: ['state'],
    registerOverlayThreshold: 0.8,
    ...overrides,
  };
}

function tutorStubDryRun(settingsFile, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--dry-run', '--no-trace', '--tutor-learner-dag', ...extraArgs],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        TUTOR_STUB_REMEMBER_SETTINGS: '1',
        TUTOR_STUB_SETTINGS_FILE: settingsFile,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('remembered tutor-stub settings round-trip atomically and can be forgotten', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-last-settings-'));
  const filePath = path.join(directory, 'nested', 'last-settings.json');
  try {
    assert.equal(readTutorStubLastSettings(filePath).status, 'missing');
    const written = writeTutorStubLastSettings(filePath, sampleSettings(), {
      now: () => new Date('2026-07-13T01:02:03.000Z'),
    });
    assert.equal(written.schema, TUTOR_STUB_LAST_SETTINGS_SCHEMA);
    assert.equal(written.updatedAt, '2026-07-13T01:02:03.000Z');
    const loaded = readTutorStubLastSettings(filePath);
    assert.equal(loaded.status, 'loaded');
    assert.deepEqual(loaded.settings, written);
    assert.equal(clearTutorStubLastSettings(filePath).existed, true);
    assert.equal(readTutorStubLastSettings(filePath).status, 'missing');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid remembered settings fail closed without throwing from the reader', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-invalid-settings-'));
  const filePath = path.join(directory, 'last-settings.json');
  try {
    fs.writeFileSync(filePath, '{not json}\n');
    const loaded = readTutorStubLastSettings(filePath);
    assert.equal(loaded.status, 'invalid');
    assert.equal(loaded.settings, null);
    assert.match(loaded.error, /JSON/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('interactive defaults restore the last settings while explicit launch flags win', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-default-settings-'));
  const filePath = path.join(directory, 'last-settings.json');
  try {
    writeTutorStubLastSettings(filePath, sampleSettings());
    const restored = tutorStubDryRun(filePath);
    assert.equal(restored.modelRef, 'codex.gpt-5.6-luna');
    assert.equal(restored.registerSelection.temperature, 0.4);
    assert.equal(restored.dagFactDropout.rate, 0.15);
    assert.equal(restored.releasePacing.baseSpeed, 1.4);
    assert.equal(restored.registerSelection.policy, 'continuous_dynamical_system+state');
    assert.equal(restored.registerSelection.overlayThreshold, 0.8);
    assert.equal(restored.rememberedSettings.status, 'loaded');
    assert.deepEqual(restored.rememberedSettings.appliedFields, [
      'tutor_model',
      'engagement_stance_temperature',
      'dag_fact_dropout',
      'clue_release_speed',
      'register_policy',
      'register_overlays',
      'register_overlay_threshold',
    ]);

    const compatiblePreset = tutorStubDryRun(filePath, ['--register-policy', 'continuous_dynamical_system']);
    assert.equal(compatiblePreset.registerSelection.policy, 'continuous_dynamical_system+state');
    assert.ok(compatiblePreset.rememberedSettings.appliedFields.includes('register_overlays'));
    assert.ok(compatiblePreset.rememberedSettings.skippedExplicitFields.includes('register_policy'));

    const explicit = tutorStubDryRun(filePath, [
      '--model',
      'codex.gpt-5.6-terra',
      '--register-temperature',
      '1.2',
      '--dag-fact-dropout',
      '0.3',
      '--release-speed',
      '1.2',
      '--register-policy',
      'field',
      '--register-overlay-threshold',
      '0.9',
    ]);
    assert.equal(explicit.modelRef, 'codex.gpt-5.6-terra');
    assert.equal(explicit.registerSelection.temperature, 1.2);
    assert.equal(explicit.dagFactDropout.rate, 0.3);
    assert.equal(explicit.releasePacing.baseSpeed, 1.2);
    assert.equal(explicit.registerSelection.policy, 'field');
    assert.equal(explicit.registerSelection.overlayThreshold, 0.9);
    assert.deepEqual(explicit.rememberedSettings.appliedFields, []);

    const allModels = tutorStubDryRun(filePath, ['--mixed-learner', '--all-models', 'codex.gpt-5.6-terra']);
    assert.equal(allModels.modelRef, 'codex.gpt-5.6-terra');
    assert.equal(allModels.classifier.modelRef, 'codex.gpt-5.6-terra');
    assert.equal(allModels.tutorLearnerDag.modelRef, 'codex.gpt-5.6-terra');
    assert.equal(allModels.mixedLearner.modelRef, 'codex.gpt-5.6-terra');
    assert.ok(allModels.rememberedSettings.skippedExplicitFields.includes('tutor_model'));

    const disabled = tutorStubDryRun(filePath, ['--no-remember-settings']);
    assert.equal(disabled.modelRef, 'codex.gpt-5.6-sol');
    assert.equal(disabled.rememberedSettings.enabled, false);

    const automated = tutorStubDryRun(filePath, ['--auto-learner']);
    assert.equal(automated.modelRef, 'codex.gpt-5.6-sol');
    assert.equal(automated.rememberedSettings.enabled, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('live settings changes are written for the next interactive session', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-save-settings-'));
  const filePath = path.join(directory, 'last-settings.json');
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input:
          '/settings model codex.gpt-5.6-luna\n/settings temp 0.55\n/settings dropout 0.2\n/settings release-speed 1.6\n/settings policy add state\n/settings policy threshold 0.75\n/quit\n',
        env: {
          ...process.env,
          TUTOR_STUB_REMEMBER_SETTINGS: '1',
          TUTOR_STUB_SETTINGS_FILE: filePath,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const loaded = readTutorStubLastSettings(filePath);
    assert.equal(loaded.status, 'loaded');
    assert.deepEqual(
      {
        tutorModelRef: loaded.settings.tutorModelRef,
        engagementStanceTemperature: loaded.settings.engagementStanceTemperature,
        dagFactDropoutRate: loaded.settings.dagFactDropoutRate,
        releaseSpeed: loaded.settings.releaseSpeed,
        registerPolicy: loaded.settings.registerPolicy,
        registerOverlays: loaded.settings.registerOverlays,
        registerOverlayThreshold: loaded.settings.registerOverlayThreshold,
      },
      sampleSettings({
        engagementStanceTemperature: 0.55,
        dagFactDropoutRate: 0.2,
        releaseSpeed: 1.6,
        registerPolicy: 'dynamic',
        registerOverlayThreshold: 0.75,
      }),
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'a real interactive TTY remembers settings by default without an opt-in flag',
  { skip: process.platform === 'win32', timeout: 10_000 },
  async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-tty-settings-'));
    const filePath = path.join(directory, 'last-settings.json');
    const env = {
      ...process.env,
      TERM: 'xterm-color',
      TUTOR_STUB_SETTINGS_FILE: filePath,
      TUTOR_STUB_SUMMARY_OPEN: '0',
    };
    delete env.TUTOR_STUB_REMEMBER_SETTINGS;
    let output = '';
    let changed = false;
    let requestedExit = false;
    try {
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--no-opening',
          '--no-closeout-report',
          '--no-interim-animation',
          '--no-stream',
          '--no-trace',
        ],
        { cwd: ROOT, cols: 100, rows: 20, name: 'xterm-color', env },
      );
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`TTY remembered-settings test timed out\n${output}`));
        }, 8_000);
        terminal.onData((chunk) => {
          output += chunk;
          if (!changed && output.includes('learner >')) {
            changed = true;
            terminal.write('/settings temp 0.5\r');
          } else if (!requestedExit && output.includes('teaching-style range 0.85')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`TTY remembered-settings test exited ${exitCode} (${signal})\n${output}`));
        });
      });
      const loaded = readTutorStubLastSettings(filePath);
      assert.equal(loaded.status, 'loaded');
      assert.equal(loaded.settings.engagementStanceTemperature, 0.5);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
