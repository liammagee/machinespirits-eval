import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseTutorStubCliArguments } from '../services/tutorStubCliArguments.js';
import { createTutorStubLaunchApplicationContext } from '../services/tutorStubLaunchApplicationContext.js';
import { createTutorStubLaunchRuntime } from '../services/tutorStubLaunchRuntime.js';
import { createTutorStubTerminalHost } from '../services/tutorStubTerminalHost.js';

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

test('launch application context rejects contradictory committee flags before resolving a session', async () => {
  await assert.rejects(
    createTutorStubLaunchApplicationContext({
      args: { committee: true, 'no-committee': true },
      commandLineOptionProvided: () => false,
    }),
    /--committee and --no-committee cannot be used together/u,
  );
});

test('terminal host owns mutable readline lifecycle state without tutoring-policy dependencies', () => {
  const rl = { line: '', close() {}, on() {} };
  const concurrentTerminal = { close() {}, setPalette: () => false, show() {} };
  const state = { interaction: { mode: 'learner' }, interim: {} };
  const host = createTutorStubTerminalHost({
    C: { dim: '', reset: '' },
    ROOT: '/workspace',
    TUTOR_STUB_FEEDBACK_REASONS: [],
    autoLearnerProfile: 'diligent',
    autoLearnerResolved: { provider: 'codex' },
    automatedLearnerProfileId: () => 'diligent',
    createTutorStubConcurrentTerminal: () => concurrentTerminal,
    createTutorStubInteractiveInputPresentation: () => ({
      mixedLearnerCompletionForLine: () => null,
      mixedLearnerProfilePresentation: () => null,
      mixedLearnerPromptText: () => '> ',
      printMixedLearnerProfilePresentation() {},
      slashCommandCompletionForLine: () => ({ candidates: [], replacement: '' }),
      slashCommandPaletteForLine: () => [],
    }),
    createTutorStubLineSelection: () => ({ decorateLine() {} }),
    groupedWorldEntries: [],
    humanDirectedRegisterPalette: [],
    input: {},
    learnerProfileContract: () => null,
    learnerProfileIds: () => [],
    learnerProfileSpeakerLabel: () => 'Learner',
    listTutorStubCurriculumModules: () => [],
    listTutorStubLabs: () => [],
    loadTutorStubCurriculum: () => null,
    mixedLearnerEnabled: true,
    mixedLearnerGhostText: () => '',
    oneLine: (value) => value,
    output: {},
    readline: { createInterface: () => rl },
    renderMixedLearnerGhostText() {},
    state,
    tutorModelChoiceEntries: () => [],
    tutorStubCanonicalCommandToken: (value) => value,
    tutorStubCommandAvailable: () => true,
    tutorStubCommandSummary: () => '',
    tutorStubCommandTokens: () => [],
    tutorStubConfigurableActorialPartIds: () => [],
    tutorStubStaticCommandCompletions: [],
  });

  assert.equal(state.concurrentTerminal, concurrentTerminal);
  assert.equal(state.interim.concurrentTerminal, concurrentTerminal);
  assert.equal(host.mixedLearner.profileId, 'diligent');
  assert.equal(host.isProcessingTurn(), false);
  host.setProcessingTurn(true);
  host.setActiveLearnerTurn({ turnId: 'turn-1' });
  assert.equal(host.isProcessingTurn(), true);
  assert.deepEqual(host.getActiveLearnerTurn(), { turnId: 'turn-1' });
  assert.equal(host.nextPendingAutoRequestSequence(), 1);
  assert.equal(host.nextPendingAutoRequestSequence(), 2);
});

test('thin entrypoint delegates to an import-safe application host that binds bounded facades', async () => {
  const applicationHost = await import('../services/tutorStubCliApplicationHost.js');
  const entrypoint = fs.readFileSync(path.join(ROOT, 'scripts/tutor-stub.js'), 'utf8');
  const hostSource = fs.readFileSync(path.join(ROOT, 'services/tutorStubCliApplicationHost.js'), 'utf8');
  const facadePaths = [
    'services/tutorStubAutomatedLearnerGenerationRuntime.js',
    'services/tutorStubApplicationState.js',
    'services/tutorStubApplicationTraceContext.js',
    'services/tutorStubCliArguments.js',
    'services/tutorStubClarificationTranslationRuntime.js',
    'services/tutorStubDebugReportRuntime.js',
    'services/tutorStubCharacterControlController.js',
    'services/tutorStubFeedbackTuningController.js',
    'services/tutorStubInteractiveApplicationComposition.js',
    'services/tutorStubInteractiveLearnerRuntime.js',
    'services/tutorStubInteractiveAutomationController.js',
    'services/tutorStubInteractiveCommandComposition.js',
    'services/tutorStubInteractiveDialogueController.js',
    'services/tutorStubInteractiveDirectorController.js',
    'services/tutorStubInteractiveInputPresentation.js',
    'services/tutorStubInteractiveSessionController.js',
    'services/tutorStubInteractiveTurnController.js',
    'services/tutorStubLaunchRuntime.js',
    'services/tutorStubLaunchApplicationContext.js',
    'services/tutorStubLaunchPresentation.js',
    'services/tutorStubLaunchSummaryPresentation.js',
    'services/tutorStubLearnerDagState.js',
    'services/tutorStubLiveSettingsController.js',
    'services/tutorStubMixedLearnerController.js',
    'services/tutorStubNonInteractiveApplication.js',
    'services/tutorStubOpeningRuntime.js',
    'services/tutorStubPerformanceControlController.js',
    'services/tutorStubPromptTransport.js',
    'services/tutorStubPublicPresentationRuntime.js',
    'services/tutorStubRecoveryAccountingRuntime.js',
    'services/tutorStubScenarioController.js',
    'services/tutorStubSessionApplicationContext.js',
    'services/tutorStubSessionApplicationRuntime.js',
    'services/tutorStubTerminalHost.js',
    'services/tutorStubTypedActionPlanningRuntime.js',
  ];

  assert.equal(typeof applicationHost.runTutorStubCliApplicationHost, 'function');
  assert.match(entrypoint, /parseTutorStubCliArguments/u);
  assert.match(entrypoint, /runTutorStubCliApplicationHost/u);
  assert.match(hostSource, /createTutorStubLaunchRuntime/u);
  assert.match(hostSource, /createTutorStubLaunchApplicationContext/u);
  assert.match(hostSource, /runTutorStubLaunchPresentation/u);
  assert.match(hostSource, /createTutorStubApplicationTraceContext/u);
  assert.match(hostSource, /createTutorStubApplicationState/u);
  assert.match(hostSource, /createTutorStubSessionApplicationContext/u);
  assert.match(hostSource, /createTutorStubSessionApplicationRuntime/u);
  assert.match(hostSource, /runTutorStubNonInteractiveApplication/u);
  assert.match(hostSource, /createTutorStubInteractiveApplicationComposition/u);
  assert.match(hostSource, /createTutorStubInteractiveCommandComposition/u);
  assert.match(hostSource, /createTutorStubPromptTransport/u);
  assert.match(hostSource, /createTutorStubOpeningRuntime/u);
  assert.match(hostSource, /createTutorStubRecoveryAccountingRuntime/u);
  assert.match(hostSource, /createTutorStubClarificationTranslationRuntime/u);
  assert.match(hostSource, /createTutorStubAutomatedLearnerGenerationRuntime/u);
  assert.match(hostSource, /createTutorStubDebugReportRuntime/u);
  assert.match(hostSource, /createTutorStubScenarioController/u);
  assert.match(hostSource, /createTutorStubLaunchSummaryPresentation/u);
  assert.match(hostSource, /createTutorStubPublicPresentationRuntime/u);
  assert.match(hostSource, /createTutorStubTypedActionPlanningRuntime/u);
  assert.doesNotMatch(hostSource, /\bparseArgs\s*\(/u);
  assert.doesNotMatch(hostSource, /function prepareTutorStubLaunchConfiguration/u);
  assert.doesNotMatch(hostSource, /function pickInitialScenarioWithKeyboard/u);
  assert.doesNotMatch(hostSource, /function startMixedLearnerTutorPrefetch/u);
  assert.doesNotMatch(hostSource, /function runInitialMixedLearnerSetup/u);
  assert.doesNotMatch(hostSource, /function runInteractiveAutoMode/u);
  assert.doesNotMatch(hostSource, /function performInteractiveDialogueReset/u);
  assert.doesNotMatch(hostSource, /function handleProofDagCommand/u);
  assert.doesNotMatch(hostSource, /function mixedLearnerProfilePresentation/u);
  assert.doesNotMatch(hostSource, /function openLiveSettingsPanel/u);
  assert.doesNotMatch(hostSource, /function handleTutorFeedbackCommand/u);
  assert.doesNotMatch(hostSource, /function handleRandomPerformanceCommand/u);
  assert.doesNotMatch(hostSource, /function restateLatestTutorForCharacter/u);
  assert.doesNotMatch(hostSource, /function processLearnerLine/u);
  assert.doesNotMatch(hostSource, /async function callPromptModel/u);
  assert.doesNotMatch(hostSource, /async function buildTutorOpening/u);
  assert.doesNotMatch(hostSource, /function tutorResponseRecoveryPrompt/u);
  assert.doesNotMatch(hostSource, /async function generateTutorClarification/u);
  assert.doesNotMatch(hostSource, /function printTutorStubFeatureMap/u);
  assert.doesNotMatch(hostSource, /function printResponseDetails/u);
  assert.doesNotMatch(hostSource, /function printExplanatoryDebugTurn/u);
  assert.doesNotMatch(hostSource, /function printDialogueCloseout/u);
  assert.doesNotMatch(hostSource, /async function generateAutomatedLearnerTurn/u);
  assert.doesNotMatch(hostSource, /async function generateMixedLearnerArtifacts/u);
  assert.doesNotMatch(hostSource, /function planTypedAction/u);
  assert.doesNotMatch(hostSource, /function closePriorTypedAction/u);
  assert.doesNotMatch(hostSource, /terminal summary at the end:/u);
  assert.doesNotMatch(hostSource, /readline\.createInterface\(/u);
  assert.doesNotMatch(hostSource, /rl\.on\('line'/u);
  assert.doesNotMatch(hostSource, /const mixedLearner = \{/u);
  assert.doesNotMatch(hostSource, /const trace = createTraceState/u);
  assert.doesNotMatch(hostSource, /if \(args\['dry-run'\]\)/u);
  assert.doesNotMatch(hostSource, /createTutorStubTerminalHost/u);
  assert.doesNotMatch(hostSource, /createTutorStubInteractiveLearnerRuntime/u);
  assert.doesNotMatch(hostSource, /createTutorStubInteractiveAutomationController/u);
  assert.doesNotMatch(hostSource, /createTutorStubInteractiveDialogueController/u);
  assert.doesNotMatch(hostSource, /createTutorStubInteractiveSessionController/u);
  assert.doesNotMatch(hostSource, /createTutorStubInteractiveTurnController/u);
  assert.doesNotMatch(entrypoint, /createTutorStubLaunchRuntime/u);
  assert.ok(entrypoint.split('\n').length <= 2_000, 'the executable entrypoint remains below the 2,000-line target');
  assert.ok(hostSource.split('\n').length <= 2_700, 'the application host does not grow past the pre-extraction tail');
  for (const relativePath of facadePaths) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.ok(source.split('\n').length < 900, `${relativePath} must remain a bounded facade`);
  }
});
