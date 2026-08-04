import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { renderTutorStubCliHelp } from '../services/tutorStubCliHelp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP_FIXTURE = Object.freeze({
  STUB: Object.freeze({
    tutor: 'fixture-tutor@v9',
    tuning: 'fixture-tuning',
    model: 'fixture.tutor-model',
    classifierModel: 'fixture.classifier-model',
    learnerRecordModel: 'fixture.reasoning-model',
    registerPolicy: 'fixture-register-policy',
    registerOverlayThreshold: 0.37,
    registerTemperature: 1.23,
    lightAdaptationThreshold: 7,
    trainingReuse: 'fixture-training-reuse',
    dagFactDropout: 0.42,
    dagFactDropoutSeed: 8128,
    releaseSpeed: 1.71,
    runSeed: 4096,
    world: 'fixture-world',
    dagMode: 'fixture-dag-mode',
    topic: 'fixture-topic',
    autoLearnerModel: 'fixture.learner-model',
    autoTurns: 13,
    autoSafetyTurns: 21,
    traceDir: 'fixture-traces',
    settingsFile: 'fixture-settings.json',
    cliTheme: 'fixture-theme',
    motion: 'fixture-motion',
    voiceModel: 'fixture-voice-model',
    voiceName: 'fixture-voice-name',
    cliEffort: 'fixture-effort',
    temperature: 0.19,
    maxTokens: 2345,
    historyTurns: 17,
  }),
  PROGRAM2_COMMITTEE_DEFAULTS: Object.freeze({
    miniModel: 'fixture-mini-model',
    ollamaUrl: 'http://fixture-ollama.invalid',
  }),
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE: 0.11,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE: 2.22,
  MIN_TUTOR_STUB_RELEASE_SPEED: 0.33,
  MAX_TUTOR_STUB_RELEASE_SPEED: 3.44,
  MAX_TUTOR_STUB_MODEL_CALL_BUDGET: 55,
  TUTOR_STUB_CLI_THEME_IDS: Object.freeze(['fixture-light', 'fixture-dark']),
  TUTOR_STUB_CLI_MOTION_IDS: Object.freeze(['fixture-still', 'fixture-moving']),
  DEFAULT_INTERACTIVE_DEMO_TURNS: 66,
  TUTOR_STUB_VOICE_MODELS: Object.freeze(['fixture-voice-a', 'fixture-voice-b']),
});

test('launch help projection is byte-stable and uses every supplied runtime default', () => {
  const before = structuredClone(HELP_FIXTURE);
  const help = renderTutorStubCliHelp(HELP_FIXTURE);

  assert.equal(
    createHash('sha256').update(help).digest('hex'),
    '425a02d354cc5a0c7ee31714efaa4026b1b62e4ae65d53241f7cff09fa65d1b1',
  );
  assert.match(help, /^Usage:\n {2}npm run tutor:stub -- \[options\]/u);
  assert.match(help, /fixture-tutor@v9/u);
  assert.match(help, /fixture-mini-model/u);
  assert.match(help, /fixture-register-policy/u);
  assert.match(help, /fixture-light, fixture-dark/u);
  assert.match(help, /fixture-still, fixture-moving/u);
  assert.match(help, /fixture-voice-a or fixture-voice-b/u);
  assert.match(help, /always \(default\) or analysis_only\n$/u);
  assert.deepEqual(HELP_FIXTURE, before, 'help projection must not mutate defaults or catalogs');
});

test('the CLI delegates launch help effects to the public presentation runtime', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubCliHelp.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubPublicPresentationRuntime.js'), 'utf8');

  assert.match(cliSource, /createTutorStubPublicPresentationRuntime/u);
  assert.doesNotMatch(cliSource, /from '\.\.\/services\/tutorStubCliHelp\.js';/u);
  assert.match(runtimeSource, /from '\.\/tutorStubCliHelp\.js';/u);
  assert.match(runtimeSource, /writeLine\(\s*renderTutorStubCliHelp\(\{/u);
  assert.doesNotMatch(cliSource, /console\.log\(`Usage:/u);
  assert.match(serviceSource, /return `Usage:/u);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|setInterval|clearInterval|Date\.now)\s*[.(]/u);
});
