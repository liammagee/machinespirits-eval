import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseTutorStubCliArguments } from '../services/tutorStubCliArguments.js';
import { createTutorStubLaunchRuntime } from '../services/tutorStubLaunchRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STUB = {
  tutor: 'dramatic-detective',
  tuning: 'off',
  allModels: '',
  model: 'codex.tutor',
  classifierModel: 'codex.classifier',
  learnerRecordModel: 'codex.learner-record',
  learnerAnalysisPromptProfile: 'baseline',
  learnerAnalysisEvidenceUseRubric: 'default',
  registerPolicy: 'dynamic',
  pointOfActionArm: '',
  registerOverlayThreshold: '0.5',
  registerTemperature: '0.2',
  lightAdaptation: false,
  lightAdaptationThreshold: '3',
  trainingReuse: 'on',
  humanSubjectClass: 'owner_operator',
  dagFactDropout: '0',
  dagFactDropoutSeed: '1',
  releaseSpeed: '1',
  typedActions: false,
  typedActionTaskId: 'task',
  typedActionKnowledgeComponent: 'kc',
  typedActionPrerequisites: 'one,two',
  typedActionItemDifficulty: '0.5',
  typedActionSupportLevel: '',
  topic: 'fractions',
  world: 'world_001_nocturne',
  dagMode: 'strict_dag',
  learner: 'curious',
  goal: 'one move',
  style: 'concise',
  autoLearnerModel: 'codex.learner',
  autoLearnerProfile: 'diligent',
  autoTurns: 'until-grounded',
  autoSafetyTurns: 80,
  mixedLearner: false,
  mixedTutorPrefetchPolicy: 'always',
  traceDir: '.traces',
  settingsFile: '.traces/settings.json',
  cliTheme: 'nocturne',
  motion: 'auto',
  fieldViz: false,
  multipleChoice: false,
  openingRealizer: 'model',
  voiceModel: 'gpt-realtime',
  voiceName: 'cedar',
  cliEffort: 'medium',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: 4,
};

test('CLI argument facade preserves explicit values, positionals, and semantic defaults', () => {
  const parsed = parseTutorStubCliArguments({
    argv: ['--world', 'world_005_marrick', '--committee', 'hello'],
    env: {},
    stub: STUB,
    committeeDefaults: { miniModel: 'ollama.mini', ollamaUrl: 'http://localhost:11434' },
  });

  assert.equal(parsed.values.world, 'world_005_marrick');
  assert.equal(parsed.values.committee, true);
  assert.equal(parsed.values.model, 'codex.tutor');
  assert.equal(parsed.values['auto-turns'], 'until-grounded');
  assert.deepEqual(parsed.positionals, ['hello']);
});

test('launch facade applies a default lab without overriding an explicit CLI option', () => {
  const args = {
    help: false,
    features: false,
    lab: '',
    recipe: '',
    resume: '',
    'resume-last': false,
    passthrough: false,
    'auto-learner': false,
    curriculum: '',
    once: '',
    'session-rpc': false,
    'labelling-game': false,
    'launch-mode': '',
    'list-labs': false,
    'list-worlds': false,
    'list-curriculum-modules': false,
    'list-tutors': false,
    'list-learner-profiles': false,
    'trace-dir': '.traces',
    model: 'explicit-model',
  };
  const resolveTutorStubLab = (id, options = null) => ({
    lab: { id },
    cliOptions: { lab: id, model: 'lab-model', world: 'lab-world' },
    options,
  });
  const runtime = createTutorStubLaunchRuntime({
    args,
    root: '/workspace',
    argv: ['--model', 'explicit-model'],
    env: { TUTOR_STUB_DEFAULT_LAB: 'mixed_drafting' },
    applyTutorStubRecipeOptions() {
      throw new Error('not expected');
    },
    latestTutorStubResumeSource() {
      throw new Error('not expected');
    },
    learnerProfileIds: () => [],
    normalizeTutorStubLaunchMode: (value) => value,
    normalizeTutorStubVoiceModel: (value) => value,
    normalizeTutorStubVoiceName: (value) => value,
    parseTutorStubRegisterPolicyStack: () => ({ primary: 'dynamic', overlays: [] }),
    plainSettingName: (value) => value,
    readTutorStubLastSettings() {
      throw new Error('not expected');
    },
    readTutorStubSessionRecipe() {
      throw new Error('not expected');
    },
    resolveTutorModelSelection: (value) => value,
    resolveTutorStubLab,
    resolveTutorStubResumeSource() {
      throw new Error('not expected');
    },
    resolveWorldRef: (value) => value,
    tutorStubRememberedPolicyStack: () => 'dynamic',
  });

  assert.equal(args.lab, 'mixed_drafting');
  assert.equal(args.model, 'explicit-model');
  assert.equal(args.world, 'lab-world');
  assert.equal(runtime.selectedLabResolution.lab.id, 'mixed_drafting');
  assert.equal(runtime.commandLineOptionProvided('model'), true);
  assert.equal(runtime.commandLineOptionProvided('world'), true);
});

test('entrypoint binds bounded facades instead of redeclaring their subsystems', () => {
  const entrypoint = fs.readFileSync(path.join(ROOT, 'scripts/tutor-stub.js'), 'utf8');
  const facadePaths = [
    'services/tutorStubCliArguments.js',
    'services/tutorStubCharacterControlController.js',
    'services/tutorStubFeedbackTuningController.js',
    'services/tutorStubInteractiveLearnerRuntime.js',
    'services/tutorStubInteractiveAutomationController.js',
    'services/tutorStubInteractiveDialogueController.js',
    'services/tutorStubInteractiveDirectorController.js',
    'services/tutorStubInteractiveInputPresentation.js',
    'services/tutorStubInteractiveSessionController.js',
    'services/tutorStubInteractiveTurnController.js',
    'services/tutorStubLaunchRuntime.js',
    'services/tutorStubLiveSettingsController.js',
    'services/tutorStubMixedLearnerController.js',
    'services/tutorStubPerformanceControlController.js',
    'services/tutorStubScenarioController.js',
  ];

  assert.match(entrypoint, /parseTutorStubCliArguments/u);
  assert.match(entrypoint, /createTutorStubLaunchRuntime/u);
  assert.match(entrypoint, /createTutorStubInteractiveLearnerRuntime/u);
  assert.match(entrypoint, /createTutorStubInteractiveAutomationController/u);
  assert.match(entrypoint, /createTutorStubInteractiveDialogueController/u);
  assert.match(entrypoint, /createTutorStubInteractiveInputPresentation/u);
  assert.match(entrypoint, /createTutorStubInteractiveSessionController/u);
  assert.match(entrypoint, /createTutorStubInteractiveTurnController/u);
  assert.match(entrypoint, /createTutorStubLiveSettingsController/u);
  assert.match(entrypoint, /createTutorStubMixedLearnerController/u);
  assert.match(entrypoint, /createTutorStubPerformanceControlController/u);
  assert.match(entrypoint, /createTutorStubScenarioController/u);
  assert.doesNotMatch(entrypoint, /\bparseArgs\s*\(/u);
  assert.doesNotMatch(entrypoint, /function prepareTutorStubLaunchConfiguration/u);
  assert.doesNotMatch(entrypoint, /function pickInitialScenarioWithKeyboard/u);
  assert.doesNotMatch(entrypoint, /function startMixedLearnerTutorPrefetch/u);
  assert.doesNotMatch(entrypoint, /function runInitialMixedLearnerSetup/u);
  assert.doesNotMatch(entrypoint, /function runInteractiveAutoMode/u);
  assert.doesNotMatch(entrypoint, /function performInteractiveDialogueReset/u);
  assert.doesNotMatch(entrypoint, /function handleProofDagCommand/u);
  assert.doesNotMatch(entrypoint, /function mixedLearnerProfilePresentation/u);
  assert.doesNotMatch(entrypoint, /function openLiveSettingsPanel/u);
  assert.doesNotMatch(entrypoint, /function handleTutorFeedbackCommand/u);
  assert.doesNotMatch(entrypoint, /function handleRandomPerformanceCommand/u);
  assert.doesNotMatch(entrypoint, /function restateLatestTutorForCharacter/u);
  assert.doesNotMatch(entrypoint, /function processLearnerLine/u);
  assert.ok(entrypoint.split('\n').length <= 8_400, 'cycle 11 keeps the entrypoint line-count ratchet');
  for (const relativePath of facadePaths) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.ok(source.split('\n').length < 900, `${relativePath} must remain a bounded facade`);
  }
});
