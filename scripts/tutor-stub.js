#!/usr/bin/env node

/**
 * Tiny editable AI tutor stub.
 *
 * This is deliberately much smaller than the full evaluation/chat stack:
 * - no server
 * - no DB writes
 * - no cell registry
 * - no rubric scoring
 *
 * Edit the STUB defaults or buildSystemPrompt() below, then run:
 *   npm run tutor:stub
 *   npm run tutor:stub -- --model openai.mini
 *   npm run tutor:stub -- --model openrouter.sonnet-5
 *   npm run tutor:stub -- --model claude-code.sonnet
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
import { getProviderConfig, resolveModel } from '../services/evalConfigLoader.js';
import { buildTutorDesireDag } from '../services/dramaticDerivation/beliefDesire.js';
import { closure, factKey, matchPattern } from '../services/dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getEngagementStanceNames,
  getRegisterOntologyVersion,
  getRequestTypeDefinitions,
  resolveEngagementStance,
} from '../services/engagementRegisterRegistry.js';
import { loadWorld, plotLint } from '../services/dramaticDerivation/world.js';
import {
  consumeMixedLearnerReadyAnnouncement,
  invalidateMixedLearnerCache,
  mixedLearnerAnalysisCacheKey,
  mixedLearnerSuggestionMove,
  parseMixedLearnerArtifacts,
  refreshMixedLearnerPrompt,
} from '../services/mixedLearnerArtifacts.js';
import {
  cleanTutorStubClarificationSpeech,
  cleanTutorStubStageSpeech,
} from '../services/tutorStubStageSpeech.js';
import {
  auditTutorStubGenerousInferenceResponse,
  resolveTutorStubGenerousInference,
} from '../services/tutorStubGenerousInference.js';
import { closeTruncatedTutorStubJson, normalizeTutorStubAnalysisEnvelope } from '../services/tutorStubJson.js';
import {
  advanceTutorStubDialogueClosure,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  createTutorStubDialogueClosureLifecycle,
  deterministicTutorStubClosureResponse,
  tutorStubClosureAcknowledgement,
  tutorStubLearnerDagGrounded,
} from '../services/tutorStubDialogueClosure.js';
import {
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  normalizeTutorStubEngagementStanceTemperature,
  temperTutorStubEngagementStanceScores,
} from '../services/tutorStubRegisterTemperature.js';
import {
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  tutorStubDagFactDropoutSnapshot,
} from '../services/tutorStubDagFactDropout.js';
import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  tutorStubComprehensionFeatures,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
} from '../services/tutorStubComprehensionState.js';
import {
  buildContinuousRegisterPolicyMetadata,
  buildContinuousEngagementStanceVector,
  continuousEngagementStanceInstruction,
} from '../services/tutorStubContinuousRegister.js';
import {
  auditTutorStubResponseConfiguration,
  buildTutorStubResponseConfiguration,
  summarizeTutorStubResponseConfigurationAudits,
  tutorStubResponseConfigurationPrompt,
} from '../services/tutorStubResponseConfiguration.js';
import {
  learnerProfileContract,
  learnerProfileDescription,
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePrompt,
} from './tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const NEGATIVE_FLOOR_REGISTERS = ['ironic', 'sarcastic', 'face_threat'];
const DAG_MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];
const HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA = 'machinespirits.tutor-stub.human-discourse-run-config.v1';
const HUMAN_DISCOURSE_FRAME_SCHEMA = 'machinespirits.tutor-stub.human-discourse-frame.v1';
const SCAFFOLD_STATE_SCHEMA = 'machinespirits.tutor-stub.scaffold-state.v1';
const SIDE_ARC_SCHEMA = 'machinespirits.tutor-stub.side-arc.v1';
const PROOF_DEBT_SCHEMA = 'machinespirits.tutor-stub.proof-debt-state.v1';
const WARRANT_PREMISE_AUDIT_SCHEMA = 'machinespirits.tutor-stub.warrant-premise-audit.v1';
const HUMAN_DISCOURSE_PHASE = 'phase_2_human_scaffold_prompting';

const STUB = {
  model: process.env.TUTOR_STUB_MODEL || 'codex.gpt-5.6-terra',
  classifierModel: process.env.TUTOR_STUB_CLASSIFIER_MODEL || 'codex.gpt-5.6-terra',
  learnerRecordModel:
    process.env.TUTOR_STUB_LEARNER_RECORD_MODEL || process.env.TUTOR_STUB_CLASSIFIER_MODEL || 'codex.gpt-5.6-terra',
  topic: process.env.TUTOR_STUB_TOPIC || 'fractions',
  world: process.env.TUTOR_STUB_WORLD || 'world_005_marrick',
  learner: 'A curious learner who may be partly right, partly confused, and unsure how to explain their thinking.',
  goal: 'Help the learner make one small conceptual move. Prefer questions and concrete examples over explanation dumps.',
  style: 'Calm, concise, Socratic, and specific. Do not perform the whole solution unless the learner is truly stuck.',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: Number.parseInt(process.env.TUTOR_STUB_HISTORY_TURNS || '4', 10),
  memorySummary: process.env.TUTOR_STUB_MEMORY_SUMMARY !== '0',
  traceDir: process.env.TUTOR_STUB_TRACE_DIR || '.tutor-stub-traces',
  stream: process.env.TUTOR_STUB_STREAM !== '0',
  interimAnimation: process.env.TUTOR_STUB_INTERIM_ANIMATION !== '0',
  cliEffort: process.env.TUTOR_STUB_CLI_EFFORT || '',
  registerPolicy: process.env.TUTOR_STUB_REGISTER_POLICY || 'dynamic',
  registerTemperature:
    process.env.TUTOR_STUB_REGISTER_TEMPERATURE || String(DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
  dagFactDropout:
    process.env.TUTOR_STUB_DAG_FACT_DROPOUT || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE),
  dagFactDropoutSeed:
    process.env.TUTOR_STUB_DAG_FACT_DROPOUT_SEED || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED),
  dagMode: process.env.TUTOR_STUB_DAG_MODE || 'strict_dag',
  multipleChoice: process.env.TUTOR_STUB_MULTIPLE_CHOICE === '1',
  opening: process.env.TUTOR_STUB_OPENING !== '0',
  closeoutReport: process.env.TUTOR_STUB_CLOSEOUT_REPORT !== '0',
  fieldViz: process.env.TUTOR_STUB_FIELD_VIZ === '1',
  autoLearnerModel: process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'codex.gpt-5.6-terra',
  autoTurns: process.env.TUTOR_STUB_AUTO_TURNS || 'until-grounded',
  autoSafetyTurns: Number.parseInt(process.env.TUTOR_STUB_AUTO_SAFETY_TURNS || '80', 10),
  autoLearnerProfile:
    process.env.TUTOR_STUB_AUTO_LEARNER_PROFILE ||
    'diligent',
  mixedLearner: process.env.TUTOR_STUB_MIXED_LEARNER === '1',
};

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
};

const FIELD_PROGRESS_THRESHOLD = 0.05;
const REGISTER_TEMPERATURE_POLICIES = new Set([
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
]);

const SLASH_COMMANDS = [
  '/analysis',
  '/a',
  '/field',
  '/f',
  '/viz',
  '/v',
  '/visualization',
  '/clarify',
  '/explain',
  '/c',
  '/report',
  '/r',
  '/settings',
  '/id',
  '/turn-id',
  '/debug-id',
  '/suggest',
  '/clue',
  '/hint',
  '/profile',
  '/use',
  '/accept',
  '/regen',
  '/clear',
  '/help',
  '/quit',
  '/exit',
];

const CUSTOM_LEARNER_PROFILE_EXAMPLE =
  'The learner can identify individual clues but struggles to connect them. When asked for a conclusion, they repeat the newest clue. They progress only when the tutor asks them to connect two specific public facts.';

const LEARNER_FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    omits_warrant: 0.15,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
    distorts_public_evidence: -0.35,
  },
  agency: {
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  },
  epistemic_stance: {
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  },
  discourse_move: {
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  },
};

const CLASSIFIER_SYSTEM_PROMPT = [
  'You are a compact pedagogical discourse classifier for an experimental tutor.',
  'Classify only what is visible in the public learner/tutor exchange.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, or private DAG state.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_RECORD_SYSTEM_PROMPT = [
  'You are a conservative public-record extractor for a tutor-side learner-DAG model.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer private mental states, unstaged evidence, concealed answers, proof paths, or release schedules beyond the staged list.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_ANALYSIS_SYSTEM_PROMPT = [
  'You are a compact up-front reviewer for an experimental tutor.',
  'Return a pedagogical discourse classification, a conservative public learner-record update, and, only when requested, a reviewer-chosen tutor engagement stance.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, proof paths, or unstaged evidence.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const AUTO_LEARNER_SYSTEM_PROMPT = [
  'You are an automated learner in an experimental tutoring dialogue.',
  'You see only the public transcript and the latest tutor message.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
  "The private learner-profile contract supplied below defines the experimental condition. It takes priority over generic helpfulness, smooth progress, and the tutor's request for a useful answer.",
  "Preserve the contract's failure operator and repair limits. Do not silently become a diligent learner after correction.",
  'Reply as the learner only. No role label, no analysis, no JSON.',
  'Keep the reply concise: usually one sentence, one question, or one warranted evidence claim.',
].join('\n');

const CLARIFIER_SYSTEM_PROMPT = [
  'You clarify wording inside a staged inquiry.',
  'Use only the public scene, public transcript, and latest tutor message supplied in the prompt.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, private DAG state, or unstaged evidence.',
  'Do not continue the lesson or answer the case question. Explain wording only.',
  'Speak directly inside the scene. Never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  'Keep the reply short and concrete. No JSON, no role label.',
].join('\n');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: STUB.model },
    'classifier-model': { type: 'string', default: STUB.classifierModel },
    'no-classifier': { type: 'boolean', default: false },
    'tutor-learner-dag': { type: 'boolean', default: false },
    'learner-record-model': { type: 'string', default: STUB.learnerRecordModel },
    'no-register-selection': { type: 'boolean', default: false },
    'register-palette': { type: 'string', default: 'all' },
    'register-policy': { type: 'string', default: STUB.registerPolicy },
    'register-temperature': { type: 'string', default: STUB.registerTemperature },
    'dag-fact-dropout': { type: 'string', default: STUB.dagFactDropout },
    'dag-fact-dropout-seed': { type: 'string', default: STUB.dagFactDropoutSeed },
    'register-empirical-prior': {
      type: 'string',
      default: process.env.TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR || '',
    },
    'safe-registers': { type: 'boolean', default: false },
    topic: { type: 'string', default: STUB.topic },
    world: { type: 'string', default: STUB.world },
    dag: { type: 'boolean', default: false },
    'dag-mode': { type: 'string', default: STUB.dagMode },
    'list-worlds': { type: 'boolean', default: false },
    learner: { type: 'string', default: STUB.learner },
    goal: { type: 'string', default: STUB.goal },
    style: { type: 'string', default: STUB.style },
    system: { type: 'string' },
    once: { type: 'string' },
    'auto-learner': { type: 'boolean', default: false },
    'auto-learner-model': { type: 'string', default: STUB.autoLearnerModel },
    'auto-learner-profile': { type: 'string', default: STUB.autoLearnerProfile },
    'auto-turns': { type: 'string', default: String(STUB.autoTurns) },
    'auto-safety-turns': { type: 'string', default: String(STUB.autoSafetyTurns) },
    'no-auto-stop-on-grounded': { type: 'boolean', default: false },
    'mixed-learner': { type: 'boolean', default: STUB.mixedLearner },
    'mixed-mode': { type: 'boolean', default: false },
    save: { type: 'string' },
    'trace-dir': { type: 'string', default: STUB.traceDir },
    'no-trace': { type: 'boolean', default: false },
    'resume-last': { type: 'boolean', default: false },
    'no-stream': { type: 'boolean', default: false },
    'no-interim-animation': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    'field-viz': { type: 'boolean', default: STUB.fieldViz },
    'multiple-choice': { type: 'boolean', default: STUB.multipleChoice },
    'no-opening': { type: 'boolean', default: false },
    'no-closeout-report': { type: 'boolean', default: false },
    'cli-effort': { type: 'string', default: STUB.cliEffort },
    temperature: { type: 'string', default: String(STUB.temperature) },
    'max-tokens': { type: 'string', default: String(STUB.maxTokens) },
    'history-turns': { type: 'string', default: String(STUB.historyTurns) },
    'show-prompt': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub -- [options]
  node scripts/tutor-stub.js [options] [first learner message]

Options:
  --model <ref>          provider alias from config/providers.yaml
                         examples: openai.mini, openrouter.sonnet-5,
                         codex.gpt-5.6-terra, claude-code.sonnet
  --classifier-model <ref>
                         learner-input classifier model (default: ${STUB.classifierModel})
  --no-classifier        skip the upfront learner-input classifier
  --tutor-learner-dag    build/print a redacted tutor-side model of the learner DAG
  --learner-record-model <ref>
                         model for --tutor-learner-dag; when the classifier is
                         also on, this single call returns both outputs
                         (default: ${STUB.learnerRecordModel})
  --no-register-selection
                         skip tutor-register selection from the combined
                         learner analysis
  --register-palette <all|safe|negative|non-simulated|csv>
                         tutor-register palette for selection (default: all);
                         all includes every register in the registry
  --register-policy <dynamic|state|field|trajectory|dynamical_system|empirical_dynamical_system|continuous_dynamical_system|continuous_empirical_dynamical_system|bland|random|negative>
                         dynamic lets the reviewer choose; field maps observed
                         field/DAG movement to a local probability distribution;
                         trajectory extends field with recent velocity, slope,
                         acceleration, and risk trends;
                         dynamical_system maps a continuous state/derivative
                         vector through theory priors plus empirical efficacy;
                         empirical_dynamical_system additionally loads
                         cross-run empirical priors when available;
                         continuous_* variants keep a nearest register label
                         but pass a weighted engagement-stance blend to the tutor;
                         state maps current classifier/DAG state to a local
                         probability distribution;
                         bland fixes a plain non-adaptive baseline register;
                         random samples uniformly from the active palette;
                         negative samples only ironic, sarcastic, face_threat
                         (default: ${STUB.registerPolicy})
  --safe-registers       limit tutor-register selection to router-selectable
                         safe registers
  --register-empirical-prior <path|auto|off>
                         JSON prior built by
                         scripts/build-tutor-stub-register-priors.js;
                         empirical_dynamical_system defaults to auto
  --register-temperature <n>
                         register-selection temperature; lower is sharper,
                         higher is broader (default: ${STUB.registerTemperature};
                         range: ${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})
  --dag-fact-dropout <n> probability in [0,1] that an eligible accumulated
                         learner-DAG premise drops after a learner turn
                         (default: ${STUB.dagFactDropout}; off at 0)
  --dag-fact-dropout-seed <n>
                         non-negative deterministic seed for fact dropout
                         (default: ${STUB.dagFactDropoutSeed})
  --world <id|path|none> detective-story world (default: ${STUB.world})
  --dag                  add hidden proof DAG + release schedule to tutor prompt;
                         also prints the tutor desire-DAG after each turn
  --dag-mode <strict_dag|human_scaffold|defeasible_human_scaffold>
                         label the proof-discourse mode for traces/reports.
                         Phase 1 records scaffold/debt/side-arc fields without
                         changing tutor behavior (default: ${STUB.dagMode})
  --list-worlds          list available detective-story worlds and exit
  --topic <text>         tutoring topic (default: ${STUB.topic})
  --learner <text>       learner sketch
  --goal <text>          tutor objective
  --style <text>         tutor style constraints
  --system <path>        replace generated system prompt with a file
  --once <text>          run one turn and exit
  --auto-learner         run unattended with an LLM learner
  --auto-learner-model <ref>
                         provider alias for the automated learner
                         (default: ${STUB.autoLearnerModel})
  --auto-learner-profile <id|text>
                         built-in profile id or custom learner behavior sketch
                         (default: diligent)
  --auto-turns <n|until-grounded>
                         maximum learner turns in --auto-learner mode, or
                         until-grounded to stop only at grounded closure
                         (default: ${STUB.autoTurns})
  --auto-safety-turns <n>
                         runaway guard used when --auto-turns until-grounded
                         (default: ${STUB.autoSafetyTurns})
  --no-auto-stop-on-grounded
                         keep running until --auto-turns even after the
                         learner-DAG reaches grounded asserted-secret closure
  --mixed-learner        manual interactive mode with a prefetched clue-answer
                         pair after each tutor response; the prompt, /suggest,
                         and /use show how the draft expresses its active profile;
                         use /clue, Tab, /suggest, /use, or /regen
  --mixed-mode           alias for --mixed-learner
  --save <path>          write transcript JSON on exit
  --trace-dir <path>     write JSONL model-call traces here
                         (default: ${STUB.traceDir})
  --no-trace             disable automatic local tracing
  --resume-last          resume the newest completed dialogue found in trace-dir
  --no-stream            disable token streaming for API-backed model calls
  --no-interim-animation disable the temporary state/field status animation
                         shown while model calls are waiting
  --no-memory-summary    disable compact state/field dialogue memory in prompts
  --field-viz            write/update lightweight field SVG + JSON artifacts
                         in trace-dir after each completed turn
  --multiple-choice      allow compact multiple-choice tutor prompts
                         (off by default)
  --no-opening           do not print the tutor's default opening prompt
  --no-closeout-report   do not print the compact dialogue closeout on exit
  --cli-effort <level>   effort for codex/claude-code CLI calls:
                         low, medium, high, xhigh, max, or config
  --temperature <n>      API temperature (default: ${STUB.temperature})
  --max-tokens <n>       response token cap for API providers (default: ${STUB.maxTokens})
  --history-turns <n>    raw recent turns kept in context, after compact memory
                         summary (default: ${STUB.historyTurns})
  --show-prompt          print the system prompt before starting
  --dry-run              print resolved config and first payload, but do not call a model
  --help                 show this message

Interactive commands:
  /analysis              explain the learner reading and selected policy plainly
  /analysis technical    show classifier, DAG, field, register, and trace evidence
  /a                     alias for /analysis
  /field                 show a lightweight interaction-field trajectory
  /f                     alias for /field
  /viz                   write a lightweight field SVG + JSON now
  /v                     alias for /viz
  /clarify [phrase]      explain a complex or unclear term from tutor dialogue
  /explain [phrase]      alias for /clarify
  /c [phrase]            alias for /clarify
  /report                show the compact dialogue closeout report
  /r                     alias for /report
  /settings              show live dialogue settings
  /settings temp <n>     change engagement-stance temperature for subsequent turns
  /settings dropout <n>  change accumulated DAG-fact dropout rate (0-1)
  /id                    show the last completed turn id and trace path
  /turn-id, /debug-id    aliases for /id
  /profile               show the active mixed learner profile
  /profile list          list built-in learner profile ids
  /profile example       show a copyable custom-profile example
  /profile <id>          switch profile and regenerate mixed artifacts
  /profile default       restore the command-line/default profile
  /profile custom <text> use a custom learner behavior sketch
  /clue, /hint           show the cached non-revealing learner clue
  /suggest               show the cached response and its profile expression
  /use                   show the profile expression, then submit the response
  /regen                 regenerate clue, answer, analysis, and tutor response
  /clear                 reset transcript and learner/register state
  /help                  show interactive commands
  /quit                  exit

Environment:
  OPENAI_API_KEY         required for openai.*
  OPENROUTER_API_KEY     required for openrouter.*
  TUTOR_STUB_MODEL       optional default model override
  TUTOR_STUB_CLASSIFIER_MODEL
                         optional default classifier model override
  TUTOR_STUB_LEARNER_RECORD_MODEL
                         optional default learner-record / combined-analysis model override
  TUTOR_STUB_TOPIC       optional default topic override
  TUTOR_STUB_WORLD       optional default detective-story world
  TUTOR_STUB_DAG_MODE    optional DAG discourse mode: strict_dag,
                         human_scaffold, or defeasible_human_scaffold
  TUTOR_STUB_TRACE_DIR   optional default trace directory
  TUTOR_STUB_STREAM=0    disable token streaming by default
  TUTOR_STUB_INTERIM_ANIMATION=0
                         disable interim state/field animation by default
  TUTOR_STUB_FIELD_VIZ=1 enable field visualization artifacts by default
  TUTOR_STUB_MULTIPLE_CHOICE=1
                         enable multiple-choice prompts by default
  TUTOR_STUB_OPENING=0   disable default tutor opening prompt
  TUTOR_STUB_CLOSEOUT_REPORT=0
                         disable default closeout report
  TUTOR_STUB_CLI_EFFORT  optional default CLI effort override
  TUTOR_STUB_REGISTER_POLICY
                         optional default register policy: dynamic, state,
                         field, trajectory, dynamical_system,
                         empirical_dynamical_system,
                         continuous_dynamical_system,
                         continuous_empirical_dynamical_system, bland, random,
                         or negative
  TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR
                         optional JSON prior path for empirical register mapping
  TUTOR_STUB_REGISTER_TEMPERATURE
                         optional default register-selection temperature
  TUTOR_STUB_AUTO_LEARNER_MODEL
                         optional default automated learner model
  TUTOR_STUB_AUTO_TURNS  optional default automated learner turn cap
  TUTOR_STUB_AUTO_SAFETY_TURNS
                         optional runaway guard for until-grounded mode
  TUTOR_STUB_AUTO_LEARNER_PROFILE
                         optional built-in id or custom automated learner profile
  TUTOR_STUB_MIXED_LEARNER=1
                         enable mixed manual/autocomplete learner mode
`);
}

function parseNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function assertSupportedModelRefs(refs) {
  for (const [label, ref] of Object.entries(refs)) {
    const normalized = String(ref || '')
      .trim()
      .toLowerCase();
    if (UNSUPPORTED_CODEX_MINI_REFS.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.6-terra for CLI-backed Codex, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

function parseAutoTurns(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (['0', 'none', 'unbounded', 'until-grounded', 'grounded'].includes(raw)) return null;
  return parsePositiveInt(value, '--auto-turns');
}

function resolveWorkspacePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function defaultRegisterEmpiricalPriorPath() {
  return path.join(ROOT, '.tutor-stub-auto-eval/register-empirical-priors.json');
}

function resolveRegisterEmpiricalPriorPath(value, { policy }) {
  const raw = String(value || '').trim();
  if (/^(off|none|false|0)$/iu.test(raw)) return null;
  if (raw && raw !== 'auto') return resolveWorkspacePath(raw);
  if (policy === 'empirical_dynamical_system' || policy === 'continuous_empirical_dynamical_system' || raw === 'auto') {
    return defaultRegisterEmpiricalPriorPath();
  }
  return null;
}

function loadRegisterEmpiricalPrior(value, { policy }) {
  const filePath = resolveRegisterEmpiricalPriorPath(value, { policy });
  if (!filePath) return { prior: null, filePath: null, status: 'off' };
  if (!fs.existsSync(filePath)) return { prior: null, filePath, status: 'missing' };
  const prior = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!/register-empirical-priors\.v1$/u.test(String(prior.schema || ''))) {
    throw new Error(`Invalid register empirical prior schema in ${filePath}: ${prior.schema || 'missing'}`);
  }
  return { prior, filePath, status: 'loaded' };
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function formatTurnDebugId(runId, turn) {
  const turnNumber = Number.parseInt(turn, 10);
  const normalizedRunId = String(runId || 'no-trace').trim() || 'no-trace';
  if (!Number.isFinite(turnNumber) || turnNumber < 1) return normalizedRunId;
  return `${normalizedRunId}:t${String(turnNumber).padStart(3, '0')}`;
}

function openingDebugId(runId) {
  return `${String(runId || 'no-trace').trim() || 'no-trace'}:opening`;
}

function factText(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [rel, ...args] = fact;
  return `${rel}(${args.join(', ')})`;
}

function splitSymbolWords(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function textTokens(text) {
  return new Set(splitSymbolWords(text));
}

function tokenRegex(token) {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
}

function textContainsToken(text, token) {
  return tokenRegex(token).test(String(text || ''));
}

function factMatches(a, b) {
  return factKey(a) === factKey(b);
}

function publicFactsAtTurn(world, tutorTurn) {
  if (!world) return [];
  const released = world.releaseSchedule
    .filter((entry) => entry.turn <= tutorTurn)
    .map((entry) => world.premiseById.get(entry.premise)?.fact)
    .filter(Boolean);
  return [...(world.background || []), ...released];
}

function entailedFactsAtTurn(world, tutorTurn) {
  return [...closure(publicFactsAtTurn(world, tutorTurn), world.rules || []).facts.values()];
}

function entailsFactAtTurn(world, tutorTurn, fact) {
  return entailedFactsAtTurn(world, tutorTurn).some((entailed) => factMatches(entailed, fact));
}

function answerTermForWorld(world) {
  const pattern = world?.questionPattern || [];
  const answerIndex = pattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  if (answerIndex < 0) return null;
  return world?.secret?.fact?.[answerIndex] || null;
}

function publicTextForTurn(world, tutorTurn, learnerText = '') {
  if (!world) return '';
  const releasedSurface = world.releaseSchedule
    .filter((entry) => entry.turn <= tutorTurn)
    .map((entry) => world.premiseById.get(entry.premise)?.surface || '')
    .join('\n');
  return [
    world.question,
    world.setting,
    world.learnerVoice,
    ...(world.rules || []).map((rule) => rule.gloss || ''),
    releasedSurface,
    learnerText,
  ].join('\n');
}

const PRIVATE_TOKEN_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'alone',
  'answer',
  'assay',
  'because',
  'before',
  'bench',
  'blank',
  'blanks',
  'came',
  'cast',
  'coin',
  'coins',
  'could',
  'down',
  'evidence',
  'false',
  'hand',
  'line',
  'make',
  'mark',
  'name',
  'only',
  'public',
  'rule',
  'says',
  'shilling',
  'shillings',
  'should',
  'single',
  'struck',
  'that',
  'their',
  'them',
  'these',
  'this',
  'trial',
  'turn',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText }) {
  const publicTokens = textTokens(publicTextForTurn(world, tutorTurn, learnerText));
  const rows = [];
  for (const premise of world?.premises || []) {
    const release = world.releaseSchedule.find((entry) => entry.premise === premise.id);
    if (!release || release.turn <= tutorTurn) continue;

    const factTokens = new Set(
      (premise.fact || [])
        .slice(1)
        .flatMap(splitSymbolWords)
        .filter((token) => token.length >= 4 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token)),
    );
    const surfaceTokens = new Set(
      splitSymbolWords(premise.surface).filter(
        (token) => token.length >= 5 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token),
      ),
    );
    const factMatches = [...factTokens].filter((token) => textContainsToken(text, token));
    const surfaceMatches = [...surfaceTokens].filter((token) => textContainsToken(text, token));
    const strongMatches = [...new Set([...factMatches, ...surfaceMatches])].sort();
    if (factMatches.length || surfaceMatches.length >= 2) {
      rows.push({
        premise: premise.id,
        scheduledTurn: release.turn,
        matches: strongMatches,
      });
    }
  }
  return rows;
}

function auditTutorResponseLeak({ text, world, tutorTurn, learnerText }) {
  if (!world) return { ok: true, leaks: [] };
  const leaks = [];
  const answerTerm = answerTermForWorld(world);
  const answerTokens = splitSymbolWords(answerTerm);
  const mentionsAnswer = answerTokens.some((token) => textContainsToken(text, token));
  const finalEntailed = entailsFactAtTurn(world, tutorTurn, world.secret.fact);

  if (mentionsAnswer && !finalEntailed) {
    leaks.push({
      type: 'concealed_answer_name',
      reason: `mentions ${answerTerm} before the public record entails the answer`,
      matches: answerTokens,
    });
  }

  if (mentionsAnswer) {
    const lower = String(text || '').toLowerCase();
    const intermediateChecks = [
      {
        fact: ['castBlankFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/cast/u, /blank/u],
        label: 'private_blank_conclusion',
      },
      {
        fact: ['cutDieFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/\bcut\b/u, /\bdie\b/u],
        label: 'private_die_conclusion',
      },
      {
        fact: world.secret.fact,
        words: [/\bstruck\b/u, /\bstrike\b/u, /\bcoiner\b/u, /\bcoined\b/u, /\bmade\b/u],
        label: 'private_final_conclusion',
      },
    ];
    for (const check of intermediateChecks) {
      if (check.words.some((pattern) => pattern.test(lower)) && !entailsFactAtTurn(world, tutorTurn, check.fact)) {
        leaks.push({
          type: check.label,
          reason: `states a conclusion about ${answerTerm} before that conclusion is derivable from released evidence`,
          fact: factText(check.fact),
        });
      }
    }
  }

  for (const row of unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText })) {
    leaks.push({
      type: 'unreleased_premise_content',
      reason: `uses content from ${row.premise} before its scheduled release at turn ${row.scheduledTurn}`,
      premise: row.premise,
      matches: row.matches,
    });
  }

  return {
    ok: leaks.length === 0,
    leaks,
    finalEntailed,
  };
}

function tutorResponseRepairPrompt({
  originalUserPrompt,
  unsafeDraft,
  leakAudit = null,
  scaffoldAudit = null,
  closureAudit = null,
  dialogueClosureFrame = null,
}) {
  const leakRows = (leakAudit?.leaks || [])
    .map((leak, index) => `${index + 1}. ${leak.type}: ${leak.reason}`)
    .join('\n');
  const scaffoldRows = (scaffoldAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  const closureRows = (closureAudit?.issues || [])
    .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.reason}`)
    .join('\n');
  return [
    originalUserPrompt,
    '',
    '[Tutor-only repair instruction]',
    'Your previous draft failed a learner-facing safety or scaffold check and must not be shown to the learner.',
    'Rewrite the tutor reply from scratch.',
    leakRows ? 'Use only public setup, already released evidence, and public rules.' : null,
    leakRows
      ? 'Do not name the concealed answer, any hidden actor, any unreleased object, or any intermediate conclusion involving them.'
      : null,
    leakRows ? 'Do not use predicate/function notation, premise ids, rule ids, or route labels.' : null,
    leakRows
      ? 'Do not use compressed technical labels such as "sole-caster", "blank-route", or "die-route"; translate them into ordinary evidence language.'
      : null,
    scaffoldRows
      ? 'The learner already answered the immediately preceding local question through unambiguous context. Accept that answer as complete for the spoken exchange.'
      : null,
    scaffoldRows
      ? 'Do not ask the same question again in new words. Do not demand the omitted noun, a name, a warrant, a premise, or a trial-book restatement for that same local step.'
      : null,
    scaffoldRows
      ? 'Acknowledge the completed move briefly and advance to a genuinely different public clue, contrast, implication, or learner choice.'
      : null,
    closureRows
      ? 'The response reached or stated the final verdict but failed to end the dialogue cleanly. Rewrite it as a natural closing act.'
      : null,
    closureRows
      ? 'Explicitly say that the case, book, or inquiry is closed. Do not reopen the proof or ask another evidentiary question.'
      : null,
    closureRows && dialogueClosureFrame?.allowCheckIn
      ? 'You may ask exactly one optional final check-in about whether a link should be revisited; ask no other question.'
      : null,
    closureRows && !dialogueClosureFrame?.allowCheckIn
      ? 'Do not ask any question. This is the terminal tutor turn.'
      : null,
    '',
    leakRows ? 'Leak audit:' : null,
    leakRows || null,
    scaffoldRows ? 'Human-scaffold audit:' : null,
    scaffoldRows || null,
    closureRows ? 'Dialogue-closure audit:' : null,
    closureRows || null,
    '',
    'Unsafe draft to replace:',
    unsafeDraft,
    '[End tutor-only repair instruction]',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function deterministicLeakFallback({ learnerText }) {
  const asksForChoice = /\b(choice|choose|which|what|next|write)\b/iu.test(learnerText || '');
  if (asksForChoice) {
    return [
      "I can't put a name or private conclusion in the trial-book yet.",
      'State the next warranted public claim in one line: what mark on the coin, metal, tool, hand, or record licenses it?',
    ].join(' ');
  }
  return [
    "I can't license that conclusion yet.",
    'Name the public evidence that would make the next step follow, or keep the verdict open.',
  ].join(' ');
}

function deterministicGenerousInferenceFallback() {
  return [
    'Yes—that answers this local question, so we can carry that step forward.',
    'What other public mark would you test next before reaching a verdict?',
  ].join(' ');
}

function buildTutorOpening(state) {
  const world = state.world;
  if (world) {
    return [
      `Before we write a name in the trial-book, keep the public question in view: ${world.question}`,
      'Start with one mark the evidence can actually bear: what public claim about the coin follows from the mark?',
    ].join(' ');
  }
  return [
    `Let's start ${state.topic ? `with ${state.topic}` : 'there'}.`,
    'Say your first idea, or name the one point you want to test first.',
  ].join(' ');
}

function ruleText(rule, index) {
  const left = (rule.if || []).map(factText).join(' + ');
  const right = (rule.then || []).map(factText).join(' + ');
  return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
}

function worldFiles() {
  return fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(WORLD_DIR, file));
}

function loadWorldSummaries() {
  return worldFiles().map((filePath) => {
    const world = loadWorld(filePath);
    return { filePath, world };
  });
}

function printWorlds() {
  for (const { filePath, world } of loadWorldSummaries()) {
    console.log(`${world.id.padEnd(38)} ${world.title}`);
    console.log(`  ${path.relative(ROOT, filePath)}`);
    console.log(`  ${world.question}`);
  }
}

function resolveWorldRef(ref) {
  if (!ref || ref === 'none' || ref === 'off' || ref === 'false') return null;

  const directPath = path.resolve(ROOT, ref);
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, world: loadWorld(directPath) };
  }

  const byFileName = path.join(WORLD_DIR, ref.endsWith('.yaml') ? ref : `${ref}.yaml`);
  if (fs.existsSync(byFileName)) {
    return { filePath: byFileName, world: loadWorld(byFileName) };
  }

  const needle = ref.toLowerCase();
  const matches = loadWorldSummaries().filter(({ filePath, world }) => {
    const stem = path.basename(filePath, '.yaml').toLowerCase();
    return (
      world.id.toLowerCase() === needle ||
      stem === needle ||
      stem.startsWith(`world-${needle}-`) ||
      stem.endsWith(`-${needle}`) ||
      world.title.toLowerCase().includes(needle)
    );
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Ambiguous --world "${ref}". Matches: ${matches.map((m) => m.world.id).join(', ')}`);
  }
  throw new Error(`Unknown --world "${ref}". Use --list-worlds to see available IDs.`);
}

function worldPublicPrompt(world) {
  if (!world) return [];
  return [
    '',
    '# Detective-story world',
    '',
    `World: ${world.id} — ${world.title}`,
    world.discipline ? `Discipline: ${world.discipline}` : null,
    `Public question: ${world.question}`,
    '',
    'Opening situation visible to the learner:',
    String(world.setting || '').trim(),
    '',
    'Learner role:',
    String(world.learnerVoice || '').trim(),
    '',
    'Your task in story mode:',
    '- Play the tutor/investigator guiding the learner through the case.',
    '- Treat the learner as the investigator; do not solve the case for them.',
    '- Keep the public question alive and ask for grounded inferences from evidence.',
    '- Treat a concrete learner question as a legitimate investigative move. When clarification is more useful than a guess, invite the investigator to ask what evidence, tool, or distinction needs explaining.',
    '- Stay inside the scene: address the investigator directly and never call either speaker "the tutor" or "the learner".',
  ].filter(Boolean);
}

function buildDirectorInitialContext(world) {
  if (!world) return null;
  return {
    stageNotes: [
      `Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}`,
      String(world.setting || '').trim(),
    ]
      .filter(Boolean)
      .join('\n'),
    tutorCharacter: 'The tutor enters as a patient dramaturg of evidence, careful not to outrun the learner.',
    learnerCharacter:
      String(world.learnerVoice || '').trim() ||
      'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
    registerNote:
      'The register should follow the public characters and scene pressure; do not add hidden evidence or proof machinery.',
  };
}

function printDirectorInitialContext(context) {
  if (!context) return;
  const printField = (label, text) => {
    const lines = String(text || '').split('\n');
    console.log(`${C.dim}  ${label}:${C.reset} ${lines[0] || ''}`);
    for (const line of lines.slice(1)) {
      console.log(`    ${line}`);
    }
  };
  console.log(`${C.cyan}director context >${C.reset}`);
  printField('stage', context.stageNotes);
  printField('tutor', context.tutorCharacter);
  printField('learner', context.learnerCharacter);
  printField('register', context.registerNote);
  console.log();
}

function worldDagPrompt(world) {
  if (!world) return [];
  const lint = plotLint(world);
  const tutorDag = buildTutorDesireDag(world);
  const premiseLedger = world.premises
    .map((premise) => {
      const scheduled = world.releaseSchedule.find((entry) => entry.premise === premise.id);
      const cue = scheduled ? `turn ${scheduled.turn} via ${scheduled.via}` : 'unscheduled';
      return `- ${premise.id} (${cue}): ${String(premise.surface || '').trim()}\n  fact: ${factText(premise.fact)}`;
    })
    .join('\n');
  const proofPaths = world.proofPaths
    .map((proofPath, index) => `- path ${index + 1}: ${proofPath.premises.join(' -> ')}`)
    .join('\n');
  const schedule = world.releaseSchedule
    .map((entry) => `- turn ${entry.turn}: ${entry.premise} via ${entry.via}`)
    .join('\n');

  return [
    '',
    '# Optional DAG machinery for the tutor',
    '',
    'You hold the concealed answer, the public rules, the hidden premise ledger, the authored proof path, and the release schedule.',
    'This is tutor-only control information. The learner must get evidence through staged releases, not through your authority.',
    '',
    `Concealed answer (never state, confirm, or deny directly): ${world.secret.surface || factText(world.secret.fact)}`,
    world.mirror ? `Tempting public near-miss: ${factText(world.mirror.fact)}` : null,
    `Plot lint: ${lint.ok ? 'ok' : `errors: ${lint.errors.join('; ')}`}`,
    `First scheduled entailment turn: ${lint.firstEntailedTurn ?? 'not entailed'}`,
    `Tutor desire-DAG leaves: ${(tutorDag.leaves || []).join(', ') || 'none'}`,
    '',
    'Public rules of evidence:',
    ...world.rules.map(ruleText),
    '',
    'Hidden premise ledger. Never voice an unreleased premise. When a premise is due, stage its surface as evidence:',
    premiseLedger,
    '',
    'Authored proof path(s):',
    proofPaths,
    '',
    'Release schedule:',
    schedule,
    '',
    'DAG conduct:',
    '- Work from released evidence and public rules only.',
    '- Treat every fact: line, predicate name, rule id, premise id, and proof-path id as private notation. Never write that notation to the learner.',
    '- Translate formal facts into ordinary trial-book language before speaking: say "the dross alloy came from the mint crucible", not "meltedAt(drossSilver, mintCrucible)".',
    "- Treat the trial-book as the learner's public reasoning record, not a second task. If the learner states a warranted inference from staged evidence, that one utterance counts as both the deduction and the trial-book entry.",
    '- Do not demand every obvious intermediate step from the learner. If an ordinary listener would supply the bridge from public evidence, carry it internally and keep the conversation moving.',
    '- Do not name the concealed answer, hidden answer-bearer, or any intermediate conclusion involving that bearer until the released public evidence derives that exact step.',
    '- Especially avoid statements of the form "<hidden person> cast/cut/struck/made..." unless the learner has already derived it from staged evidence.',
    "- Ask for an explicit missing bridge only when the learner's leap would close the case, contradict public evidence, rely on unstaged evidence, or name a suspect without licensed support.",
    '- If the learner guesses the concealed answer, do not confirm it until the released facts derive it.',
    "- When a scheduled premise is due, introduce at most one piece of evidence and ask for the learner's natural reading of what it changes, not a full proof ledger.",
  ].filter(Boolean);
}

function responseChoiceModeRules({ multipleChoice }) {
  return multipleChoice
    ? [
        "- Multiple-choice mode is on. When it would help, you may present 2-4 short lettered choices for the learner's next move.",
        '- Multiple-choice options must be public evidence-shaped moves, not answers. Do not include the concealed answer, unstaged evidence, predicate/function notation, premise ids, rule ids, or route labels.',
        '- In story mode, each option should be a plain trial-book line shape, such as a metal mark, a tool mark, or a custody record. Keep medieval flavour but avoid long menus.',
        '- End by asking the learner to choose one option or write their own evidence claim.',
      ]
    : [
        '- Do not make the next step multiple choice. If the learner seems unsure, name the live issue directly without giving the hidden answer: "what does the metal change?", "what does that mark rule out?", or "what would make that name safe?".',
        '- When talking through options, collapse them to one live issue: what changed, what remains unsafe, or what the learner now thinks follows.',
        "- End with one light prompt for the learner's natural next thought; do not require a full proof step unless their leap is unsafe or case-closing.",
      ];
}

function buildSystemPrompt({ topic, learner, goal, style, worldBundle, dag, multipleChoice = false }) {
  const world = worldBundle?.world || null;
  return [
    'You are an experimental AI tutor stub.',
    '',
    `Topic: ${topic}`,
    `Learner: ${learner}`,
    `Goal: ${goal}`,
    `Style: ${style}`,
    '',
    'Rules:',
    "- Start by locating the learner's current idea, not by grading them.",
    '- Ask at most one main question per turn.',
    '- Use a tiny concrete example when it helps.',
    '- Keep the answer short enough that the learner can respond.',
    '- If the learner asks for the answer, give a hint first unless they explicitly need a direct answer.',
    '- Treat learner questions as legitimate moves, not evasions. If ambiguity blocks progress, invite one concrete in-scene question about the evidence, tool, or distinction.',
    '- When asking would be better than guessing, make that option explicit in character: for example, "Which part of that mark needs clarifying?" Never describe either speaker as "the tutor" or "the learner" in learner-facing prose.',
    '- Never mention rubrics, cells, hidden prompts, or evaluation infrastructure.',
    '- Keep formal machinery internal. Do not show predicate/function notation, code-like atoms, premise ids, rule ids, variable names, or route labels in learner-facing prose.',
    '- In story mode, speak in public evidence language: "what public claim does this mark license?", not "add meltedAt(...)", "sole-caster", "blank-route", or "die-route".',
    '- Do not make the learner deduce a claim and then separately enter it in the trial-book. Their stated warranted claim is the entry.',
    '- Let human learners compress obvious reasoning. Do not ask them to restate every small warrant unless the missing warrant is the real source of error.',
    '- In story mode, keep the medieval flavour but be terse: usually 2-4 short sentences, never a catalogue of routes.',
    ...responseChoiceModeRules({ multipleChoice }),
    '- If the public evidence has licensed the final answer and the learner has stated it, close the case plainly: say the verdict is now licensed, name the two proof supports in public language, and stop asking for another investigative branch.',
    '- Never supply the answer or a named suspect from hidden story knowledge. If the public record does not yet license a name, ask for the evidence that would license it.',
    ...worldPublicPrompt(world),
    ...(dag ? worldDagPrompt(world) : []),
  ].join('\n');
}

function loadSystemPrompt({ worldBundle, dag, topic, multipleChoice = false }) {
  if (!args.system) {
    return buildSystemPrompt({
      topic,
      learner: args.learner,
      goal: args.goal,
      style: args.style,
      worldBundle,
      dag,
      multipleChoice,
    });
  }
  return fs.readFileSync(args.system, 'utf8');
}

function visibleResolvedModel(resolved, providerConfig) {
  return {
    provider: resolved.provider,
    model: resolved.model,
    configured: resolved.isConfigured,
    apiKeyEnv: providerConfig.api_key_env || null,
    baseUrl: providerConfig.base_url || null,
    cli: isCliProvider(resolved.provider),
  };
}

function metadataLine(meta) {
  const usage = meta.usage || {};
  const total = usage.totalTokens || 0;
  const cost = usage.cost ? `, $${Number(usage.cost).toFixed(6)}` : '';
  const effort = meta.effort || meta.reasoningEffort ? `, effort ${meta.effort || meta.reasoningEffort}` : '';
  const guard = meta.deterministicFallback ? ', leak-guard fallback' : meta.repaired ? ', leak-guard repaired' : '';
  const stream = meta.guardedStreamReplay ? ', guarded stream' : meta.streamed ? ', streamed' : '';
  const cache = meta.speculativeCacheHit ? ', smart-cache hit' : '';
  return `${meta.provider}/${meta.model}, ${meta.latencyMs || 0}ms, ${total} tokens${cost}${effort}${guard}${stream}${cache}`;
}

function usesFixedOpenAITemperature(resolved) {
  return resolved.provider === 'openai' && /^gpt-5(?:[.-]|$)/.test(resolved.model);
}

function effectiveTemperatureForModel(resolved, requestedTemperature) {
  if (usesFixedOpenAITemperature(resolved)) {
    return 1;
  }
  return requestedTemperature;
}

function normalizeRegisterPolicy(value) {
  const policy = String(value || 'dynamic')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
  if (
    policy === 'dynamic' ||
    policy === 'field' ||
    policy === 'trajectory' ||
    policy === 'dynamical_system' ||
    policy === 'empirical_dynamical_system' ||
    policy === 'continuous_dynamical_system' ||
    policy === 'continuous_empirical_dynamical_system' ||
    policy === 'state' ||
    policy === 'bland' ||
    policy === 'random' ||
    policy === 'negative'
  ) {
    return policy;
  }
  throw new Error(
    `Unknown --register-policy: ${value}. Expected dynamic, state, field, trajectory, dynamical_system, empirical_dynamical_system, continuous_dynamical_system, continuous_empirical_dynamical_system, bland, random, or negative.`,
  );
}

function normalizeDagMode(value) {
  const mode = String(value || 'strict_dag')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
  if (DAG_MODES.includes(mode)) return mode;
  throw new Error(`Unknown --dag-mode: ${value}. Expected ${DAG_MODES.join(', ')}.`);
}

function buildHumanDiscourseRunConfig({ dagMode, dagEnabled, tutorLearnerDagEnabled }) {
  const scaffoldActive = dagMode !== 'strict_dag';
  const stepCompression =
    dagMode === 'defeasible_human_scaffold'
      ? {
          enabled: true,
          policy:
            'accept obvious public bridges as implied proof debt; ask for explicit warrants only when the leap is unsafe, conflicting, or case-closing',
          maxExplicitDemandsPerTurn: 1,
        }
      : {
          enabled: false,
          policy:
            dagMode === 'human_scaffold'
              ? 'frame one local warrant without expanding the whole proof chain'
              : 'strict proof audit only',
          maxExplicitDemandsPerTurn: dagMode === 'human_scaffold' ? 1 : 0,
        };
  return {
    schema: HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA,
    dagMode,
    strictAuditDag: Boolean(dagEnabled),
    tutorLearnerDag: Boolean(tutorLearnerDagEnabled),
    phase: HUMAN_DISCOURSE_PHASE,
    scaffoldActive,
    stepCompression,
    scaffoldPolicy:
      dagMode === 'defeasible_human_scaffold'
        ? 'allow learner-owned compressed inference, keep implied proof debt internal, and only surface warrant gaps when they matter'
        : dagMode === 'human_scaffold'
          ? 'frame local human-facing warrants while strict DAG audit remains authoritative'
          : 'strict DAG audit only; no human-scaffold prompt adaptation',
    traceFields: [
      'humanDiscourseFrame',
      'scaffoldState',
      'sideArc',
      'proofDebt',
      'warrantPremiseAudit',
      'generousInference',
    ],
    behaviorChange: scaffoldActive,
  };
}

function buildRegisterPalette(mode) {
  const definitions = getEngagementStanceDefinitions();
  const allNames = Object.keys(definitions);
  const safeNames = getEngagementStanceNames({ includeArmAssigned: false });
  const value = String(mode || 'all')
    .trim()
    .toLowerCase();

  let names;
  if (!value || value === 'safe' || value === 'router' || value === 'positive') {
    names = safeNames;
  } else if (value === 'negative' || value === 'negative-floor') {
    names = NEGATIVE_FLOOR_REGISTERS;
  } else if (value === 'non-simulated') {
    names = allNames.filter((name) => definitions[name]?.simulated_only !== true);
  } else if (value === 'all' || value === 'simulated') {
    names = allNames;
  } else {
    names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const resolvedNames = names.map((name) => resolveEngagementStance(name)?.register || name);
  const unknown = names.filter((name, index) => !definitions[resolvedNames[index]]);
  if (unknown.length) {
    throw new Error(`Unknown --register-palette register(s): ${unknown.join(', ')}. Known: ${allNames.join(', ')}`);
  }

  return [...new Set(resolvedNames)];
}

function engagementStanceDefinitionSummary(name) {
  const def = getEngagementStanceDefinition(name) || {};
  return {
    register: name,
    valence: def.valence || 'unknown',
    router_selectable: def.router_selectable === true,
    simulated_only: def.simulated_only === true,
    reviewer_cues: def.reviewer_cues || def.trigger || null,
    stance_contract: String(def.stance_contract || '').trim(),
    required_moves: Array.isArray(def.required_moves) ? def.required_moves : [],
    risk_flags: Array.isArray(def.risk_flags) ? def.risk_flags : [],
    forbidden_phrases: Array.isArray(def.forbidden_phrases) ? def.forbidden_phrases : [],
    recognition_guardrail: String(def.recognition_guardrail || '').trim() || null,
  };
}

function engagementStancePalettePromptRows(palette) {
  return JSON.stringify(palette.map(engagementStanceDefinitionSummary), null, 2);
}

function requestTypePromptRows() {
  const definitions = getRequestTypeDefinitions();
  const rows = Object.entries(definitions).map(([requestType, definition]) => ({
    request_type: requestType,
    role: definition.role || 'logical_armature',
    description: definition.description || '',
    dag_use: definition.dag_use || '',
  }));
  return rows.length ? JSON.stringify(rows, null, 2) : 'No request-type registry is configured.';
}

function learnerDagPromptSummary(model) {
  if (!model) return 'No prior tutor-side learner-DAG model is available yet.';
  const record = model.learnerRecord || {};
  return JSON.stringify(
    {
      turn: model.turn ?? null,
      metrics: model.metrics || {},
      assessment: model.assessment || {},
      memoryReliability: model.memoryReliability || null,
      learnerRecord: {
        grounded: (record.grounded || []).slice(-8),
        voicedDerived: (record.voicedDerived || []).slice(-8),
        hypotheses: (record.hypotheses || []).slice(-5),
        answerCandidates: record.answerCandidates || [],
      },
    },
    null,
    2,
  );
}

function registerHistoryPromptSummary(state) {
  const history = state.register?.history || [];
  if (!history.length) return 'No prior tutor-register choices.';
  return history
    .slice(-6)
    .map((entry) => {
      const normalized = normalizeStoredRegisterSelection(entry);
      const efficacy = normalized?.efficacy
        ? `${normalized.efficacy.label} (score ${normalized.efficacy.progressScore}; ${normalized.efficacy.summary})`
        : 'pending next learner turn';
      return `Turn ${entry.turn}: ${normalized?.selected_register || 'unknown'} — ${entry.register_reason || 'no reason'}; efficacy: ${efficacy}`;
    })
    .join('\n');
}

function latestRegisterSelection(state) {
  return normalizeStoredRegisterSelection(state.register?.history?.at(-1) || null);
}

function normalizeStoredRegisterEfficacy(efficacy) {
  if (!efficacy) return null;
  const selection = normalizeStoredRegisterSelection({
    engagement_stance: efficacy.engagement_stance || efficacy.selected_register,
  });
  return {
    ...efficacy,
    engagement_stance: selection?.engagement_stance || efficacy.engagement_stance || efficacy.selected_register,
    selected_register: selection?.selected_register || efficacy.selected_register,
    legacy_selected_register: efficacy.legacy_selected_register || selection?.legacy_selected_register || null,
  };
}

function normalizeStoredRegisterSelection(selection) {
  if (!selection) return null;
  const rawRegister = String(
    selection.engagement_stance || selection.selected_register || selection.selected_mode || selection.register || '',
  ).trim();
  const resolved = resolveEngagementStance(rawRegister, { fallback: rawRegister || null });
  const selected = resolved?.register || rawRegister || null;
  const actionFamily = selection.action_family || resolved?.action_family || null;
  const requestType = selection.request_type || resolved?.request_type || selection.learner_signal || null;
  return {
    ...selection,
    register_ontology_version: selection.register_ontology_version || getRegisterOntologyVersion(),
    engagement_stance: selected,
    selected_register: selected,
    selected_mode: selected,
    legacy_selected_register:
      selection.legacy_selected_register ||
      resolved?.legacy_selected_register ||
      preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    action_family: actionFamily,
    request_type: requestType,
    efficacy: normalizeStoredRegisterEfficacy(selection.efficacy),
  };
}

function latestRegisterEfficacy(state) {
  const entry = [...(state.register?.history || [])].reverse().find((item) => item.efficacy);
  return normalizeStoredRegisterEfficacy(entry?.efficacy || null);
}

function latestFieldStateMismatch(state) {
  return latestRegisterEfficacy(state)?.mismatch || null;
}

function recentRegisterCount(state, registerName, { limit = 4 } = {}) {
  return (state.register?.history || [])
    .slice(-limit)
    .filter((entry) => normalizeStoredRegisterSelection(entry)?.selected_register === registerName).length;
}

function engagementStanceSelectionPolicyPrompt(state) {
  const policy = state.register?.policy || 'dynamic';
  const latest = latestRegisterSelection(state);
  const latestEfficacy = latest?.efficacy?.label || 'pending';
  const recentBrisk = recentRegisterCount(state, 'brisk');
  const lines =
    policy === 'random'
      ? [
          '- Engagement-stance policy: random. The runtime will sample a register locally from the active palette.',
          '- Do not choose or justify an engagement stance in the model output for this policy.',
        ]
      : policy === 'negative'
        ? [
            '- Engagement-stance policy: negative. The runtime will sample locally only from ironic, sarcastic, and face_threat.',
            '- Do not choose or justify an engagement stance in the model output for this policy.',
          ]
        : policy === 'bland'
          ? [
              '- Engagement-stance policy: bland. The runtime uses a fixed plain register as a non-adaptive baseline.',
              '- Do not choose or justify an engagement stance in the model output for this policy.',
            ]
          : policy === 'trajectory'
            ? [
                '- Engagement-stance policy: trajectory. The runtime maps recent learner-field and learner-DAG trajectory into a local engagement-stance distribution.',
                '- Do not choose or justify an engagement stance in the model output for this policy.',
              ]
            : policy === 'dynamical_system'
              ? [
                  '- Engagement-stance policy: dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence.',
                  '- Do not choose or justify an engagement stance in the model output for this policy.',
                ]
              : policy === 'empirical_dynamical_system'
                ? [
                    '- Engagement-stance policy: empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors.',
                    '- Do not choose or justify an engagement stance in the model output for this policy.',
                  ]
                : policy === 'continuous_dynamical_system'
                  ? [
                      '- Engagement-stance policy: continuous_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence into a weighted engagement-stance blend.',
                      '- Do not choose or justify an engagement stance in the model output for this policy.',
                    ]
                  : policy === 'continuous_empirical_dynamical_system'
                    ? [
                        '- Engagement-stance policy: continuous_empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors into a weighted engagement-stance blend.',
                        '- Do not choose or justify an engagement stance in the model output for this policy.',
                      ]
                    : [
                        '- Engagement-stance policy: dynamic. The up-front reviewer chooses the register; do not treat the learner request type as the register.',
                        '- Brisk pacing is available but must not be the default register.',
                        '- Penalize repeating the same register, especially brisk. A repeated register needs a concrete reviewer reason grounded in the current public turn.',
                        '- Use brisk only when tight pacing is the needed stance: explicit step-by-step request, visible procedural confusion about the immediate next evidence move, or a newly staged evidence item that needs one learner-owned inference.',
                        '- Do not choose brisk merely because the learner-DAG still has a release_or_pacing_gap, inference_gap, missing premise, or incomplete proof path.',
                        '- If the previous brisk choice produced no_clear_progress or regression_or_overreach, choose a non-brisk register unless the current learner explicitly asks for step-by-step help.',
                        '- Good dynamic alternatives: precise for a distinction/error in terms or accountable warrant; plain for compression/transfer; charismatic for resistant, rote, answer-seeking, or low-agency compliance; witnessing for affective exposure.',
                      ];
  if (latest) {
    lines.push(`- Last register: ${latest.selected_register}; observed efficacy: ${latestEfficacy}.`);
    if (latest.efficacy?.mismatch) {
      lines.push(
        `- Last field/state relation: ${latest.efficacy.mismatch}; field delta ${
          formatSignedInterimNumber(latest.efficacy.field?.delta, { decimals: 3 }) || '0'
        }, DAG progress ${latest.efficacy.dagProgress ? 'yes' : 'no'}.`,
      );
    }
  }
  if (policy === 'dynamic' && recentBrisk) {
    lines.push(`- Recent brisk count: ${recentBrisk} in the last four selections. Treat this as a repetition penalty.`);
  }
  if (policy === 'dynamic') {
    lines.push(
      '- If the last relation was field_without_dag, treat that as preparatory success: use plain or precise to convert the emerging learner move into one public evidence claim.',
    );
    lines.push(
      '- If the last relation was dag_without_field, the proof state moved but learner agency flattened: ask the learner to restate why the evidence matters in their own words before pushing another proof step.',
    );
  }
  return lines.join('\n');
}

function firstJsonObjectCandidate(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseClassifierJson(rawText) {
  const text = String(rawText || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const originalCandidates = [text, fenced, firstJsonObjectCandidate(text)].filter(Boolean);
  const candidates = originalCandidates.flatMap((candidate) => [candidate, closeTruncatedTutorStubJson(candidate)]).filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { parsed: normalizeTutorStubAnalysisEnvelope(parsed), parseError: null };
      }
    } catch (_) {
      // Try the next extraction strategy.
    }
  }

  return {
    parsed: {
      turn: {
        summary: 'Classifier returned non-JSON output.',
        request_type: 'off_task_or_mixed',
        discourse_move: 'unknown',
        evidence_use: 'unknown',
        epistemic_stance: 'unknown',
        affect: 'unknown',
        agency: 'unknown',
        scores: {},
        pedagogical_need: 'Inspect the raw classifier output before relying on this turn label.',
      },
      overall: {
        summary: 'No structured overall learner classification is available.',
        trajectory: 'unknown',
        recurring_pattern: 'unknown',
        current_state: 'unknown',
        next_best_tutor_move: 'Continue with a diagnostic question grounded in the learner input.',
      },
      raw: text,
    },
    parseError: 'Classifier output was not parseable JSON.',
  };
}

function classifierWorldContext(state) {
  if (!state.world) return 'No detective-story world is active.';
  return [
    `World: ${state.world.id} - ${state.world.title}`,
    state.world.discipline ? `Discipline: ${state.world.discipline}` : null,
    `Public question: ${state.world.question}`,
    `Opening situation: ${String(state.world.setting || '').trim()}`,
    `DAG mode: ${state.dag ? 'on, but hidden DAG state is intentionally withheld from this classifier' : 'off'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildLearnerClassifierPrompt({ learnerText, state }) {
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length + 1,
  });
  return [
    '# Task',
    '',
    'Classify the learner input before the tutor responds.',
    'Spell out exactly two headline judgments:',
    '1. What the learner has done in this turn.',
    '2. What the learner has done overall across the dialogue so far.',
    comprehensionContext || null,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Previous public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Conceptual engagement score:',
    '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
    '',
    'Epistemic readiness score:',
    '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
    '',
    'Use these controlled labels where possible:',
    '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
    '- Use omits_warrant when the learner states a correct public clue and a conclusion but leaves out the bridge that licenses the conclusion. Do not call that links_evidence_to_rule merely because the bridge is easy to infer.',
    '- Use distorts_public_evidence only when the learner misstates, blends, or reassigns an already public clue. Use overleaps_evidence for a premature conclusion or missing warrant without distorted recall.',
    '- Precedence rule: choose distorts_public_evidence, not overleaps_evidence, when the learner says or implies that an earlier/public clue existed when it did not, changes what a public clue said, or blends two public clues into a false remembered detail. This remains true when the distortion also supports a premature conclusion.',
    '- Otherwise choose omits_warrant over links_evidence_to_rule when the bridge is absent; reserve overleaps_evidence for a claim that outruns the currently public evidence, especially a premature culprit or case-closing inference.',
    '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before classifying them. A reply such as "it will be the same" can fully answer a local single-referent question even though it does not repeat the noun.',
    '- Do not label a contextually complete short answer confused, passive, or evidence-free merely because it omits words already supplied by the preceding question. Preserve any genuinely missing warrant as a separate strict-audit issue.',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    '# Request type registry',
    '',
    'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the tutor engagement stance.',
    requestTypePromptRows(),
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        turn: {
          summary: 'plain-language sentence naming what the learner did in this turn',
          request_type: 'logical request type, not a tutor engagement stance',
          discourse_move: 'one controlled label',
          evidence_use: 'one controlled label',
          epistemic_stance: 'one controlled label',
          affect: 'brief affect/energy label',
          agency: 'one controlled label',
          scores: {
            conceptual_engagement: { score: 1, reason: 'brief reason' },
            epistemic_readiness: { score: 1, reason: 'brief reason' },
          },
          pedagogical_need: 'what the tutor should attend to immediately',
        },
        overall: {
          summary: 'plain-language sentence naming what the learner has done overall',
          trajectory: 'how their participation is changing or not changing',
          recurring_pattern: 'dominant pattern across turns, or none yet',
          current_state: 'where the learner seems to be now',
          next_best_tutor_move: 'best immediate tutor move based on public evidence only',
        },
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function callPromptModel({
  prompt,
  resolved,
  systemPrompt,
  role,
  maxTokens = 700,
  trace = null,
  stream = null,
  cliEffort = null,
  turn = null,
  signal = null,
}) {
  const startedAt = new Date().toISOString();
  const shouldStream = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  try {
    let response;
    if (isCliProvider(resolved.provider)) {
      const onEvent =
        resolved.provider === 'codex'
          ? (event) => {
              const item = event?.item || {};
              appendTraceEvent(trace, {
                type: 'cli_stream_event',
                role,
                turn,
                eventType: event?.type || 'unknown',
                itemType: item?.type || null,
              });
              if (!stream?.enabled) return;
              const active = getInterimState(stream?.interim)?.active;
              if (!active) return;
              const phase =
                event?.type === 'thread.started'
                  ? 'starting Codex'
                  : event?.type === 'turn.started'
                    ? 'model working'
                    : event?.type === 'item.started' && item?.type
                      ? item.type.replaceAll('_', ' ')
                      : event?.type === 'item.completed' && item?.type === 'agent_message'
                        ? 'finalizing result'
                        : null;
              if (phase) active.phase = `${active.basePhase || active.phase} · ${phase}`;
            }
          : null;
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        systemPrompt,
        prompt,
        role,
        { messageHistory: [], effort: cliEffort, onEvent, signal },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
        streamedEvents: result.streamedEvents || 0,
        invalidStreamLines: result.invalidStreamLines || 0,
        outputSource: result.outputSource || null,
      };
    } else if (shouldStream) {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const sink = createConsoleTokenSink(role, stream?.interim);
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink.finish();
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
      };
    } else {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request: {
        systemPrompt,
        prompt,
        maxTokens,
        cliEffort,
      },
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
        streamedEvents: response.streamedEvents || 0,
        invalidStreamLines: response.invalidStreamLines || 0,
        outputSource: response.outputSource || null,
      },
    });
    return response;
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role,
      turn,
      startedAt,
      provider: resolved.provider,
      model: resolved.model,
      request: {
        systemPrompt,
        prompt,
        maxTokens,
      },
      error: err.message,
    });
    throw err;
  }
}

async function callClassifierModel({ prompt, resolved, trace = null, stream = null, cliEffort = null, turn = null }) {
  return await callPromptModel({
    prompt,
    resolved,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_classifier',
    maxTokens: 700,
    trace,
    stream,
    cliEffort,
    turn,
  });
}

function failedClassification({ message, resolved, latencyMs = 0, usage = null }) {
  return {
    error: message,
    turn: {
      summary: 'Classifier failed before the tutor turn.',
      request_type: 'off_task_or_mixed',
      discourse_move: 'unknown',
      evidence_use: 'unknown',
      epistemic_stance: 'unknown',
      affect: 'unknown',
      agency: 'unknown',
      scores: {},
      pedagogical_need: 'Proceed cautiously and use the learner input directly.',
    },
    overall: {
      summary: 'Overall classification is unavailable because the classifier failed.',
      trajectory: 'unknown',
      recurring_pattern: 'unknown',
      current_state: 'unknown',
      next_best_tutor_move: 'Ask a focused diagnostic question.',
    },
    provider: resolved?.provider || null,
    model: resolved?.model || null,
    latencyMs,
    usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
  };
}

async function classifyLearnerInput({ learnerText, state }) {
  const startedAt = Date.now();
  try {
    const prompt = buildLearnerClassifierPrompt({ learnerText, state });
    const raw = await callClassifierModel({
      prompt,
      resolved: state.classifier.resolved,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      turn: state.turns.length + 1,
    });
    const { parsed, parseError } = parseClassifierJson(raw.text);
    return {
      ...parsed,
      parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
    };
  } catch (err) {
    return failedClassification({
      message: err.message,
      resolved: state.classifier.resolved,
      latencyMs: Date.now() - startedAt,
    });
  }
}

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function printClassification(classification) {
  if (!classification) return;
  const conceptual = scoreValue(classification.turn?.scores?.conceptual_engagement);
  const readiness = scoreValue(classification.turn?.scores?.epistemic_readiness);
  const requestType = classification.turn?.request_type || 'unknown_request';
  const move = classification.turn?.discourse_move || 'unknown';
  const stance = classification.turn?.epistemic_stance || 'unknown';
  const need = classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || '';
  const errorPrefix =
    classification.error || classification.parseError ? `${C.red} learner-classifier warning${C.reset}` : '';

  console.log(`${C.cyan}learner classifier >${C.reset} ${classification.turn?.summary || 'No turn summary.'}`);
  console.log(
    `${C.dim}  request: ${requestType}; move: ${move}; stance: ${stance}; conceptual ${conceptual}/5, readiness ${readiness}/5${C.reset}`,
  );
  console.log(`${C.dim}  overall: ${classification.overall?.summary || 'No overall summary.'}${C.reset}`);
  if (need) console.log(`${C.dim}  tutor cue: ${need}${C.reset}`);
  if (errorPrefix)
    console.log(`${errorPrefix}${C.dim}: ${classification.error || classification.parseError}${C.reset}`);
}

const INTERIM_FRAMES = ['|', '/', '-', '\\'];

function clearStatusLine() {
  process.stdout.write('\r\x1b[2K');
}

function createInterimState({ enabled }) {
  return { enabled, active: null, lastContext: null };
}

function getInterimState(holder) {
  if (!holder) return null;
  if (
    Object.prototype.hasOwnProperty.call(holder, 'active') &&
    Object.prototype.hasOwnProperty.call(holder, 'enabled')
  ) {
    return holder;
  }
  return holder.interim || null;
}

function interimAnimationAvailable(interim) {
  return Boolean(interim?.enabled && output.isTTY);
}

function formatSignedInterimNumber(value, { decimals = 2 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return null;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(decimals)}`;
}

function compactInterimStateSummary(state) {
  const bits = [];
  if (state?.classifier?.enabled) bits.push('learner reading');
  if (state?.learnerDag?.enabled) bits.push('reasoning progress');
  if (state?.register?.enabled) bits.push('response style');
  if (state?.dag) bits.push('evidence pacing');
  return bits.length ? bits.join(', ') : 'plain tutor response';
}

function interimLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'not available';
  if (numeric < 0.25) return 'low';
  if (numeric < 0.5) return 'developing';
  if (numeric < 0.75) return 'strong';
  return 'very strong';
}

function plainInterimBottleneck(value) {
  const labels = {
    release_or_pacing_gap: 'the learner needs the next usable piece of evidence',
    warrant_gap: 'the learner needs a clearer reasoning link',
    unsupported_assertion: 'the conclusion has moved beyond the evidence',
    grounded_asserted_secret: 'the conclusion is supported and stated',
    grounded_unasserted_secret: 'the conclusion is supported but not yet stated',
  };
  return labels[value] || String(value || 'the next useful learner move').replaceAll('_', ' ');
}

function compactInterimFieldSummary(state) {
  if (!state?.turns?.length) return compactInterimStateSummary(state);
  const field = buildLightweightDialogueField(state.turns);
  const final = field.summary.final;
  const bottleneck = plainInterimBottleneck(final.bottleneck);
  return [
    `learner understanding ${interimLevel(final.learnerMastery)}`,
    `pressure ${interimLevel(final.learnerRisk)}`,
    `tutor fit ${interimLevel(final.tutorAlignment)}`,
    `momentum ${interimLevel(final.jointMomentum)}`,
    bottleneck,
  ].join(' | ');
}

function previousLearnerDagModel(state, context) {
  const currentTurn = Number(context?.tutorTurn || 0);
  return [...(state?.turns || [])].reverse().find((turn) => !currentTurn || Number(turn.turn || 0) < currentTurn)
    ?.tutorLearnerDagModel;
}

function compactPendingObjectiveSummary(state, context) {
  if (!context?.learnerText && !context?.classification && !context?.tutorLearnerDag?.model) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const assessment = context.tutorLearnerDag?.model?.assessment || {};
  const selection = context.registerSelection || {};
  const bottleneck = plainInterimBottleneck(assessment.bottleneck || turn.pedagogical_need || 'awaiting analysis');
  const register = selection.selected_register
    ? `style led by ${selection.selected_register}`
    : 'style still being chosen';
  const target =
    selection.expected_dag_move ||
    overall.next_best_tutor_move ||
    turn.pedagogical_need ||
    'choose one learner-owned next move';
  const due = currentReleaseRows(state, context.tutorTurn).map((row) => row.premise);
  return [
    `turn ${context.tutorTurn || '?'}`,
    `focus: ${oneLine(bottleneck, { max: 54 })}`,
    register,
    due.length ? `${due.length} new clue${due.length === 1 ? '' : 's'} available now` : null,
    `aim: ${oneLine(plainStrategyText(target), { max: 76 })}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

function compactPendingLearnerSummary(context) {
  if (!context?.learnerText && !context?.classification) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const scores = turn.scores || {};
  const move = String(turn.discourse_move || 'still being read').replaceAll('_', ' ');
  const stance = String(turn.epistemic_stance || 'still being read').replaceAll('_', ' ');
  const need = turn.pedagogical_need || overall.next_best_tutor_move || '';
  const bits = [
    `turn ${context.tutorTurn || '?'}`,
    `${move}; ${stance}`,
    `conceptual engagement ${interimLevel(Number(scoreValue(scores.conceptual_engagement)) / 5)}`,
    `evidence awareness ${interimLevel(Number(scoreValue(scores.epistemic_readiness)) / 5)}`,
  ];
  if (need) bits.push(`needs: ${oneLine(plainStrategyText(need), { max: 62 })}`);
  if (!context.classification && context.learnerText) bits.push(oneLine(context.learnerText, { max: 72 }));
  return bits.join(' | ');
}

function compactPendingLearnerDagSummary(context) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const missing = metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0;
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    `${metrics.groundedCount || 0} public facts held`,
    `${metrics.voicedDerivedCount || 0} inferences stated`,
    `${missing} evidence pieces still needed`,
    plainInterimBottleneck(assessment.bottleneck),
  ].join(' | ');
}

function compactPendingDagMovementSummary(state, context) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const previous = previousLearnerDagModel(state, context);
  const currentFeatures = dagProgressFeatures(model);
  const previousFeatures = dagProgressFeatures(previous);
  const coverageDelta = formatSignedInterimNumber(currentFeatures.bestPathCoverage - previousFeatures.bestPathCoverage);
  const groundedDelta = currentFeatures.groundedCount - previousFeatures.groundedCount;
  const voicedDelta = currentFeatures.voicedDerivedCount - previousFeatures.voicedDerivedCount;
  const answersDelta = currentFeatures.answerCandidateCount - previousFeatures.answerCandidateCount;
  const missingDelta = currentFeatures.missingPremiseCount - previousFeatures.missingPremiseCount;
  const deltas = [
    coverageDelta ? `path coverage ${coverageDelta}` : null,
    groundedDelta
      ? `${Math.abs(groundedDelta)} public fact${Math.abs(groundedDelta) === 1 ? '' : 's'} ${groundedDelta > 0 ? 'added' : 'lost'}`
      : null,
    voicedDelta
      ? `${Math.abs(voicedDelta)} inference${Math.abs(voicedDelta) === 1 ? '' : 's'} ${voicedDelta > 0 ? 'added' : 'lost'}`
      : null,
    answersDelta
      ? `${Math.abs(answersDelta)} answer candidate${Math.abs(answersDelta) === 1 ? '' : 's'} ${answersDelta > 0 ? 'added' : 'removed'}`
      : null,
    missingDelta
      ? `${Math.abs(missingDelta)} needed piece${Math.abs(missingDelta) === 1 ? '' : 's'} ${missingDelta < 0 ? 'resolved' : 'added'}`
      : null,
  ].filter(Boolean);
  const assessment = model.assessment || {};
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    deltas.length ? deltas.join(', ') : 'no clear reasoning movement yet',
    assessment.finalSecretEntailed
      ? 'the conclusion is supported'
      : assessment.assertedSecret
        ? 'the conclusion was stated too early'
        : 'the conclusion remains open',
  ].join(' | ');
}

function compactLearnerRecordUpdateSummary(state, context) {
  const result = context?.tutorLearnerDag;
  if (!result?.accepted && !result?.rejected?.length) return null;
  const accepted = result.accepted || {};
  const adopted = (accepted.adopt || []).join(',') || null;
  const retracted = (accepted.retract || []).join(',') || null;
  const derived = (accepted.derive || []).map((fact) => oneLine(factSurface(state.world, fact), { max: 34 }));
  const rejected = result.rejected?.length || 0;
  const bits = [
    `turn ${context.tutorTurn || result.model?.turn || '?'}`,
    adopted ? `${accepted.adopt.length} evidence piece${accepted.adopt.length === 1 ? '' : 's'} accepted` : null,
    retracted ? `${accepted.retract.length} evidence piece${accepted.retract.length === 1 ? '' : 's'} withdrawn` : null,
    derived.length ? `new inference: ${derived.slice(0, 2).join('; ')}` : null,
    accepted.hypothesis ? `working idea: ${oneLine(accepted.hypothesis, { max: 52 })}` : null,
    accepted.assertAnswer ? `proposed answer: ${accepted.assertAnswer}` : null,
    rejected ? `${rejected} unsupported update${rejected === 1 ? '' : 's'} ignored` : null,
  ].filter(Boolean);
  return bits.length > 1 ? bits.join(' | ') : null;
}

function compactPendingRegisterSummary(context) {
  const selection = context?.registerSelection;
  const efficacy = context?.previousRegisterEfficacy;
  if (!selection && !efficacy) return null;
  const bits = [];
  if (selection) {
    const blend = formatEngagementStanceDistribution(selection.distribution, { limit: 4 });
    bits.push(blend ? `blend ${blend}` : `led by ${selection.selected_register || 'unknown'}`);
    if (selection.expected_field_move)
      bits.push(`aim: ${oneLine(plainStrategyText(selection.expected_field_move), { max: 68 })}`);
  }
  if (efficacy) {
    const result =
      efficacy.label === 'positive_progress'
        ? 'helped'
        : efficacy.label === 'regression_or_overreach'
          ? 'hurt progress'
          : 'had no clear effect yet';
    bits.push(`last ${efficacy.selected_register || 'style'} ${result}`);
  }
  return bits.join(' | ');
}

function currentReleaseRows(state, tutorTurn) {
  const world = state?.world;
  if (!world || !Number.isFinite(Number(tutorTurn))) return [];
  return world.releaseSchedule
    .filter((entry) => Number(entry.turn) === Number(tutorTurn))
    .map((entry) => {
      const premise = world.premiseById.get(entry.premise);
      return {
        premise: entry.premise,
        via: entry.via || null,
        surface: String(premise?.surface || '').trim(),
      };
    });
}

function compactEvidenceTimingSummary(state, context) {
  const world = state?.world;
  const tutorTurn = Number(context?.tutorTurn || (state?.turns?.length || 0) + 1);
  if (!world || !Number.isFinite(tutorTurn)) return null;
  const dueNow = currentReleaseRows(state, tutorTurn);
  const next = world.releaseSchedule.find((entry) => entry.turn > tutorTurn) || null;
  const last = [...world.releaseSchedule].reverse().find((entry) => entry.turn <= tutorTurn) || null;
  const dueSummary = dueNow.length
    ? `available now: ${oneLine(dueNow[0].surface, { max: 78 })}`
    : last
      ? 'no new evidence this turn; earlier evidence remains available'
      : 'no case evidence has been introduced yet';
  const nextSummary = next
    ? `next new clue is planned for turn ${next.turn} from the ${next.via === 'director' ? 'scene' : 'tutor'}`
    : 'all planned clues are available';
  return `turn ${tutorTurn} | ${dueSummary} | ${nextSummary}`;
}

function compactPendingTutorDagSummary(state, context) {
  const snapshot =
    context?.tutorDagSnapshot || buildTutorDagSnapshot(state, context?.tutorTurn || state?.turns?.length + 1);
  if (!snapshot) return null;
  const next = snapshot.nextRelease
    ? `next clue planned for turn ${snapshot.nextRelease.turn}`
    : 'all planned clues are available';
  return `turn ${snapshot.turn} | ${snapshot.leavesReleased} of ${snapshot.leavesTotal} key clues revealed | ${next}`;
}

function compactPendingFieldSummary(state, context) {
  if (!context?.classification && !context?.tutorLearnerDag?.model) return null;
  const completedField = buildLightweightDialogueField(state?.turns || []);
  const previous = completedField.rows.at(-1) || null;
  const pendingTurn = {
    turn: context.tutorTurn || (state?.turns?.length || 0) + 1,
    learner: context.learnerText || '',
    classification: context.classification || null,
    tutorLearnerDagModel: context.tutorLearnerDag?.model || null,
    registerSelection: context.registerSelection || null,
    previousRegisterEfficacy: context.previousRegisterEfficacy || null,
    tutor: '',
    tutorDag:
      context.tutorDagSnapshot || buildTutorDagSnapshot(state, context.tutorTurn || (state?.turns?.length || 0) + 1),
  };
  const row = lightweightFieldTurn(pendingTurn, previous);
  return [
    `turn ${row.turn}`,
    `learner understanding ${interimLevel(row.learnerMastery)}`,
    `pressure ${interimLevel(row.learnerRisk)}`,
    `tutor fit ${interimLevel(row.tutorAlignment)}`,
    `momentum ${interimLevel(row.jointMomentum)}`,
    plainInterimBottleneck(row.bottleneck),
  ].join(' | ');
}

function compactInterimPanels(active) {
  const context = active.context || {};
  const panels = [
    { label: 'Tutor focus', tone: 'focus', text: compactPendingObjectiveSummary(active.state, context) },
    { label: 'Dialogue outlook', tone: 'progress', text: compactPendingFieldSummary(active.state, context) },
    { label: 'Reasoning change', tone: 'progress', text: compactPendingDagMovementSummary(active.state, context) },
    { label: 'Learner reasoning', tone: 'learner', text: compactLearnerRecordUpdateSummary(active.state, context) },
    { label: 'Evidence pacing', tone: 'evidence', text: compactEvidenceTimingSummary(active.state, context) },
    { label: 'Learner reading', tone: 'learner', text: compactPendingLearnerSummary(context) },
    { label: 'Reasoning state', tone: 'progress', text: compactPendingLearnerDagSummary(context) },
    { label: 'Tutor style', tone: 'focus', text: compactPendingRegisterSummary(context) },
    { label: 'Clue progress', tone: 'evidence', text: compactPendingTutorDagSummary(active.state, context) },
    { label: 'Dialogue so far', tone: 'progress', text: compactInterimFieldSummary(active.state) },
  ].filter((panel) => panel.text);
  return panels.length
    ? panels
    : [{ label: 'Active checks', tone: 'neutral', text: compactInterimStateSummary(active.state) }];
}

function interimToneColor(tone) {
  if (tone === 'progress') return C.green;
  if (tone === 'evidence') return C.yellow;
  if (tone === 'learner') return C.cyan;
  if (tone === 'focus') return C.magenta;
  return C.dim;
}

function renderInterimStatus(active) {
  active.tick += 1;
  const frame = INTERIM_FRAMES[active.tick % INTERIM_FRAMES.length];
  const elapsed = ((Date.now() - active.startedAt) / 1000).toFixed(1).padStart(4);
  const width = Math.max(60, Math.min(output.columns || 140, 180) - 1);
  const panels = compactInterimPanels(active);
  const panelIndex = Math.floor(active.tick / 4) % panels.length;
  const panel = panels[panelIndex];
  const phase = oneLine(active.basePhase || active.phase, { max: 28 });
  const prefix = `${frame} ${phase} · ${elapsed}s · view ${panelIndex + 1}/${panels.length} | ${panel.label}: `;
  const panelText = oneLine(panel.text, { max: Math.max(12, width - prefix.length) });
  return [
    C.cyan,
    frame,
    ' ',
    C.bold,
    phase,
    C.reset,
    C.dim,
    ` · ${elapsed}s · `,
    C.reset,
    C.yellow,
    `view ${panelIndex + 1}/${panels.length}`,
    C.reset,
    C.dim,
    ' | ',
    C.reset,
    interimToneColor(panel.tone),
    panel.label,
    C.reset,
    `: ${panelText}`,
  ].join('');
}

function startInterimAnimation(state, phase, context = null) {
  const interim = getInterimState(state);
  stopInterimAnimation(interim, { clear: true });
  if (!interimAnimationAvailable(interim)) return null;

  interim.lastContext = context || null;
  const active = {
    state,
    context: context || {},
    phase,
    basePhase: phase,
    startedAt: Date.now(),
    tick: -1,
    interval: null,
    paused: false,
    rendered: false,
  };
  active.render = () => {
    if (active.paused) return;
    clearStatusLine();
    process.stdout.write(`${renderInterimStatus(active)}${C.reset}\r`);
    active.rendered = true;
  };
  interim.active = active;
  active.render();
  active.interval = setInterval(active.render, 350);
  active.interval.unref?.();
  return active;
}

function stopInterimAnimation(holder, { clear = true } = {}) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active) return false;
  if (active.interval) clearInterval(active.interval);
  interim.active = null;
  if (clear && active.rendered) clearStatusLine();
  return true;
}

function buildTutorInterimContext({
  learnerText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
}) {
  const tutorTurn = state.turns.length + 1;
  return {
    learnerText,
    tutorTurn,
    classification,
    tutorLearnerDag,
    registerSelection,
    previousRegisterEfficacy,
    tutorDagSnapshot: buildTutorDagSnapshot(state, tutorTurn),
    humanDiscourseFrame: buildHumanDiscourseFrame({
      state,
      tutorTurn,
      tutorLearnerDag,
      classification,
      learnerText,
    }),
  };
}

function pauseInterimAnimation(holder) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || active.paused) return false;
  if (active.interval) clearInterval(active.interval);
  active.interval = null;
  active.paused = true;
  if (active.rendered) clearStatusLine();
  return true;
}

function resumeInterimAnimation(holder) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || !active.paused || !interimAnimationAvailable(interim)) return false;
  active.paused = false;
  active.render();
  active.interval = setInterval(active.render, 350);
  active.interval.unref?.();
  return true;
}

function createTraceState({ enabled, traceDir, metadata }) {
  if (!enabled) return { enabled: false };
  const dir = resolveWorkspacePath(traceDir);
  const runId = safeTimestampForFile();
  const filePath = path.join(dir, `${runId}.jsonl`);
  fs.mkdirSync(dir, { recursive: true });
  const trace = {
    enabled: true,
    dir,
    filePath,
    runId,
    seq: 0,
  };
  appendTraceEvent(trace, {
    type: 'run_start',
    metadata,
  });
  return trace;
}

function appendTraceEvent(trace, event) {
  if (!trace?.enabled) return;
  const entry = {
    ts: new Date().toISOString(),
    runId: trace.runId,
    seq: ++trace.seq,
    ...event,
  };
  if (!entry.turnId && entry.turn !== undefined && entry.turn !== null) {
    entry.turnId = formatTurnDebugId(trace.runId, entry.turn);
  } else if (!entry.turnId && entry.type === 'tutor_opening') {
    entry.turnId = openingDebugId(trace.runId);
  }
  fs.appendFileSync(trace.filePath, `${JSON.stringify(redactTraceSecrets(entry))}\n`);
}

function stateRunDebugId(state) {
  return state?.debugRunId || state?.trace?.runId || 'no-trace';
}

function turnDebugId(state, turn) {
  return formatTurnDebugId(stateRunDebugId(state), turn);
}

function printDebugIdLine(state, id, label = 'turn id') {
  if (!id) return null;
  if (!state.printedDebugIds) state.printedDebugIds = new Set();
  if (state.printedDebugIds.has(id)) return id;
  state.printedDebugIds.add(id);
  console.log(`${C.cyan}${label} >${C.reset} ${id}`);
  return id;
}

function printTurnDebugLine(state, turn) {
  return printDebugIdLine(state, turnDebugId(state, turn), 'turn id');
}

function printOpeningDebugLine(state) {
  return printDebugIdLine(state, openingDebugId(stateRunDebugId(state)), 'turn id');
}

function printCurrentDebugId(state, { duringTurn = false } = {}) {
  const last = state?.turns?.at(-1) || null;
  const completedId = last?.turnId || (state?.history?.length ? openingDebugId(stateRunDebugId(state)) : null);
  const activeId = duringTurn ? turnDebugId(state, (last?.turn || 0) + 1) : null;
  console.log(`${C.cyan}debug id >${C.reset} ${activeId || completedId || stateRunDebugId(state)}`);
  console.log(`${C.dim}  run id: ${stateRunDebugId(state)}${C.reset}`);
  if (last) console.log(`${C.dim}  last completed turn: ${last.turnId || turnDebugId(state, last.turn)}${C.reset}`);
  if (activeId) console.log(`${C.dim}  in-progress turn: ${activeId}${C.reset}`);
  console.log(
    `${C.dim}  trace: ${state?.trace?.filePath || 'disabled for this run; rerun without --no-trace for a local JSONL trace'}${C.reset}`,
  );
  console.log(`${C.dim}  paste the debug id into Codex to inspect this exact turn${C.reset}\n`);
  return { runId: stateRunDebugId(state), completedId, activeId, tracePath: state?.trace?.filePath || null };
}

function redactTraceSecrets(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return /^sk-[A-Za-z0-9_-]{12,}/u.test(value) ? '[redacted]' : value;
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactTraceSecrets(item, seen));
  const redacted = {};
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '');
    if (
      ['apikey', 'authorization', 'bearer', 'secret', 'password', 'accesstoken', 'refreshtoken'].includes(normalizedKey)
    ) {
      redacted[key] = '[redacted]';
    } else {
      redacted[key] = redactTraceSecrets(nested, seen);
    }
  }
  return redacted;
}

function traceDisplayPath(trace) {
  if (!trace?.enabled) return null;
  return path.relative(ROOT, trace.filePath);
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function readTraceEvents(filePath) {
  const events = [];
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed);
    } catch (_) {
      // Ignore damaged trace lines; the next valid event may still be useful.
    }
  }
  return events;
}

function dialogueTurnsFromTraceEvents(events) {
  const turns = [];
  for (const event of events) {
    if (event?.type === 'history_clear') {
      turns.length = 0;
      continue;
    }
    if (event?.type !== 'turn_complete' || !event.turnRecord) continue;
    turns.push(jsonClone(event.turnRecord));
  }
  return turns;
}

function latestDialogueTrace(traceDir) {
  const dir = resolveWorkspacePath(traceDir);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const { filePath } of files) {
    const events = readTraceEvents(filePath);
    const turns = dialogueTurnsFromTraceEvents(events);
    if (!turns.length) continue;
    const metadata = events.find((event) => event?.type === 'run_start')?.metadata || null;
    return { filePath, metadata, turns, events };
  }
  return null;
}

function restoreRegisterStateFromTurns(state, turns) {
  if (!state.register?.enabled) return { restored: 0 };
  const byTurn = new Map();
  for (const turn of turns) {
    if (!turn?.registerSelection) continue;
    const selection = jsonClone(turn.registerSelection);
    const key = Number(selection.turn || turn.turn);
    if (!Number.isFinite(key)) continue;
    byTurn.set(key, selection);
  }
  for (const turn of turns) {
    const efficacy = turn?.previousRegisterEfficacy;
    const key = Number(efficacy?.registerTurn);
    if (!Number.isFinite(key) || !byTurn.has(key)) continue;
    const selection = byTurn.get(key);
    if (!selection.efficacy) selection.efficacy = jsonClone(efficacy);
  }
  state.register.history = [...byTurn.values()].sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  state.register.current = state.register.history[state.register.history.length - 1] || null;
  return { restored: state.register.history.length };
}

function restoreComprehensionState(state, turns, events = []) {
  const eventSnapshot = [...events]
    .reverse()
    .find((event) => event?.comprehensionState || event?.state?.schema === 'machinespirits.tutor-stub.comprehension-side-state.v1');
  const turnSnapshot = [...turns]
    .reverse()
    .map((turn) => turn?.comprehension?.afterTutor || turn?.comprehension?.state || null)
    .find(Boolean);
  const snapshot = eventSnapshot?.comprehensionState || eventSnapshot?.state || turnSnapshot || null;
  state.comprehension = createTutorStubComprehensionState(snapshot);
  return {
    restored: Boolean(snapshot),
    terms: state.comprehension.terms.length,
  };
}

function replayLearnerDagFromTurns(state, turns) {
  if (!state.learnerDag?.enabled || !state.world) return { replayed: 0, skipped: 0 };
  let replayed = 0;
  let skipped = 0;
  for (const turn of turns) {
    const accepted = turn?.tutorLearnerDagUpdate?.accepted;
    if (accepted) {
      const result = applyLearnerRecordUpdate({
        update: {
          adopt: accepted.adopt || [],
          retract: accepted.retract || [],
          derive: accepted.derive || [],
          hypothesis: accepted.hypothesis || null,
          assert_answer: accepted.assertAnswer || null,
          human_discourse: accepted.humanDiscourse || null,
        },
        state,
        tutorTurn: Number(turn.turn) || replayed + 1,
        learnerText: turn.learner || '',
        dropoutReplay:
          turn?.dagFactDropout ||
          turn?.tutorLearnerDagUpdate?.dagFactDropout ||
          { legacyNoDropout: true },
      });
      state.learnerDag.lastModel = result.model;
      replayed += 1;
      continue;
    }
    if (turn?.tutorLearnerDagModel) {
      state.learnerDag.lastModel = jsonClone(turn.tutorLearnerDagModel);
      skipped += 1;
    }
  }
  return { replayed, skipped };
}

function restoreDialogueFromTrace(state, resume, { currentWorld }) {
  if (!resume?.turns?.length) return null;
  const turns = resume.turns.map((turn) => jsonClone(turn));
  state.turns = turns;
  state.history = [];
  for (const turn of turns) {
    if (turn.learner) state.history.push({ role: 'user', content: turn.learner });
    if (turn.tutor) state.history.push({ role: 'assistant', content: turn.tutor });
  }

  const register = restoreRegisterStateFromTurns(state, turns);
  const comprehension = restoreComprehensionState(state, turns, resume.events || []);
  const learnerDag = replayLearnerDagFromTurns(state, turns);
  const storedClosure = turns.at(-1)?.dialogueClosure?.lifecycle || null;
  if (storedClosure && state.dialogueClosure?.enabled) {
    state.dialogueClosure = {
      ...state.dialogueClosure,
      ...jsonClone(storedClosure),
      enabled: true,
      allowCheckIn: state.dialogueClosure.allowCheckIn,
      allowAuthoredDagClosure: state.dialogueClosure.allowAuthoredDagClosure,
    };
  } else if (state.dialogueClosure?.enabled && turns.length) {
    const last = turns.at(-1);
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: last?.tutorLearnerDagModel || null,
      tutorDagSnapshot: last?.tutorDag || null,
      answerTerm: answerTermForWorld(state.world),
    });
    const audit = auditTutorStubDialogueClosureResponse({ text: last?.tutor || '', frame });
    if (audit.ok && audit.closesDialogue) {
      state.dialogueClosure = advanceTutorStubDialogueClosure(state.dialogueClosure, {
        frame,
        audit,
        turn: last.turn,
      });
    } else if (audit.closesDialogue && state.dialogueClosure.allowCheckIn) {
      state.dialogueClosure = {
        ...state.dialogueClosure,
        phase: 'awaiting_checkin',
        reachedAtTurn: Number(last.turn) || null,
        basis: frame.basis || 'legacy_conversational_closure',
      };
    }
  }
  const warnings = [];
  const resumedWorld = resume.metadata?.world?.id || null;
  if (resumedWorld && currentWorld?.id && resumedWorld !== currentWorld.id) {
    warnings.push(`trace world ${resumedWorld} differs from current world ${currentWorld.id}`);
  }
  return {
    source: resume.filePath,
    turns: turns.length,
    register,
    comprehension,
    learnerDag,
    dialogueClosure: state.dialogueClosure,
    metadata: resume.metadata || null,
    warnings,
  };
}

function providerSupportsStreaming(resolved) {
  return Boolean(resolved?.provider && !isCliProvider(resolved.provider));
}

function providerSupportsEventStreaming(resolved) {
  return resolved?.provider === 'codex';
}

function streamLabel(role) {
  if (role === 'tutor_stub_tutor') return `${C.magenta}tutor >${C.reset} `;
  if (role === 'tutor_stub_learner_analysis') return `${C.cyan}learner analysis stream >${C.reset} `;
  if (role === 'tutor_stub_learner_record') return `${C.cyan}learner DAG stream >${C.reset} `;
  if (role === 'tutor_stub_learner_classifier') return `${C.cyan}learner classifier stream >${C.reset} `;
  return `${C.cyan}${role} >${C.reset} `;
}

function createConsoleTokenSink(role, interim = null) {
  let started = false;
  return {
    write(token) {
      if (!started) {
        stopInterimAnimation(interim);
        clearStatusLine();
        process.stdout.write(streamLabel(role));
        started = true;
      }
      process.stdout.write(token);
    },
    finish() {
      if (started) process.stdout.write('\n');
      return started;
    },
  };
}

function replayTextAsConsoleStream(role, text, stream = null) {
  const sink = createConsoleTokenSink(role, stream?.interim || stream);
  const tokens = String(text || '').match(/\S+\s*/g) || [];
  for (const token of tokens) sink.write(token);
  return sink.finish();
}

function printTutorResponse(response, stream = null) {
  if (response.guardedStreamReplay) {
    response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text, stream);
    return;
  }
  if (!response.streamed) {
    console.log(`${C.magenta}tutor >${C.reset} ${response.text.trim()}`);
  }
}

async function classifyForTurn(learnerText, state) {
  if (!state.classifier.enabled) return null;
  startInterimAnimation(state, 'classifying learner');
  const classification = await classifyLearnerInput({ learnerText, state });
  stopInterimAnimation(state);
  printClassification(classification);
  return classification;
}

function releaseLedgerForTurn(world, turn) {
  if (!world) return [];
  return world.releaseSchedule
    .filter((entry) => entry.turn <= turn)
    .map((entry) => ({ turn: entry.turn, premiseId: entry.premise, via: entry.via }));
}

function factFromQuestionAnswer(world, answer) {
  const cleaned = String(answer || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .toLowerCase();
  if (!world || !cleaned) return null;
  return world.questionPattern.map((part) => (typeof part === 'string' && part.startsWith('?') ? cleaned : part));
}

function factSurface(world, fact) {
  if (!world || !Array.isArray(fact)) return factText(fact);
  const key = factKey(fact);
  for (const premise of world.premises || []) {
    if (factKey(premise.fact) === key) return String(premise.surface || factText(fact)).trim();
  }
  return factText(fact);
}

function stagedEvidenceRows(world, turn) {
  return releaseLedgerForTurn(world, turn).map((entry) => {
    const premise = world.premiseById.get(entry.premiseId);
    return {
      premise: entry.premiseId,
      turn: entry.turn,
      via: entry.via,
      surface: String(premise?.surface || '').trim(),
      fact: premise?.fact || null,
    };
  });
}

function activeDramaturgyAct(world, tutorTurn) {
  const acts = world?.dramaturgy?.acts;
  if (!Array.isArray(acts)) return null;
  const turn = Number(tutorTurn);
  if (!Number.isFinite(turn)) return null;
  const act = acts.find((entry) => {
    const [start, end] = Array.isArray(entry?.turns) ? entry.turns.map(Number) : [];
    return Number.isFinite(start) && Number.isFinite(end) && turn >= start && turn <= end;
  });
  if (!act) return null;
  return {
    act: act.act || null,
    title: String(act.title || '').trim() || null,
    intent: String(act.intent || '').trim() || null,
    turns: Array.isArray(act.turns) ? act.turns : null,
  };
}

function branchTemplateForEvidence(row = {}) {
  const id = String(row.premise || '').trim();
  const fact = Array.isArray(row.fact) ? factText(row.fact) : '';
  const text = `${id} ${fact} ${row.surface || ''}`.toLowerCase();
  if (/^m_/u.test(id) || /verrell|mirror|town|watch|caught|mintcrucible|broadgraver/u.test(text)) {
    return {
      id: 'mirror_pressure',
      label: 'town case pressure',
      localQuestion: 'What exactly does the town case prove, and what does it only make tempting?',
      warrantFrame:
        'Separate a tempting public fact from the stricter coin-evidence rule it would need to license a verdict.',
      joinReminder: 'Do not let the town case stand in for the coin marks; keep it as pressure to be tested.',
    };
  }
  if (/alloy|meltedat|crucible|blankfrom|solecasterat|castblank|dross|cupel|metal|blank/u.test(text)) {
    return {
      id: 'blank_chain',
      label: 'blank and metal provenance',
      localQuestion: 'What does the metal evidence license about where the blank came from?',
      warrantFrame:
        'Ask for a claim shaped as evidence plus rule plus limited conclusion about the blank, not yet the final hand.',
      joinReminder: 'This can close the blank branch, but it is only half the proof until the die branch also closes.',
    };
  }
  if (/die|flaw|graver|burin|holder|cutdie|notch|serif|tool/u.test(text)) {
    return {
      id: 'die_chain',
      label: 'die and tool provenance',
      localQuestion: 'What does the mark on the coin license about the tool that cut the die?',
      warrantFrame: 'Ask for a claim shaped as mark plus rule plus limited conclusion about the die or tool.',
      joinReminder:
        'This can close the die branch, but the final verdict still needs the blank and die to meet in one hand.',
    };
  }
  if (/struckby|secret|join|same hand|both/u.test(text)) {
    return {
      id: 'join',
      label: 'blank-die join',
      localQuestion: 'Do the cast blank and the cut die now meet in one hand?',
      warrantFrame:
        'Ask the learner to join the two public supports: the blank branch and the die branch must point to the same hand.',
      joinReminder: 'Only now may the final verdict be named, and only as the result of those two public supports.',
    };
  }
  return {
    id: 'open_scaffold',
    label: 'open evidence scaffold',
    localQuestion: 'What public evidence is live, and what limited claim does it license?',
    warrantFrame: 'Keep the learner on one public evidence claim and one warrant at a time.',
    joinReminder: 'Treat any broader conclusion as provisional until the public proof catches up.',
  };
}

function scaffoldBranchForTurn({ world, tutorTurn, tutorLearnerDag }) {
  if (!world) return branchTemplateForEvidence();
  const dueNow = currentReleaseRows({ world }, tutorTurn);
  if (dueNow.length) return branchTemplateForEvidence(dueNow[0]);
  const latestReleased = stagedEvidenceRows(world, tutorTurn).at(-1);
  const nextRelease = world.releaseSchedule.find((entry) => entry.turn > tutorTurn) || null;
  const assessment = tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || {};
  if (assessment.finalSecretEntailed || assessment.bottleneck === 'assertion_gap') {
    return branchTemplateForEvidence({ premise: 'join', surface: 'blank and die meet in one hand' });
  }
  if (latestReleased) return branchTemplateForEvidence(latestReleased);
  if (nextRelease) {
    const premise = world.premiseById.get(nextRelease.premise);
    return branchTemplateForEvidence({ ...nextRelease, surface: premise?.surface || '', fact: premise?.fact || null });
  }
  return branchTemplateForEvidence();
}

function compactReleaseRow(row = {}) {
  return {
    premise: row.premise || null,
    turn: row.turn ?? null,
    via: row.via || null,
    surface: oneLine(row.surface || '', { max: 220 }) || null,
  };
}

function buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag }) {
  const enabled = dagMode !== 'strict_dag';
  const world = state?.world || null;
  const dueNow = currentReleaseRows({ world }, tutorTurn);
  const released = world ? stagedEvidenceRows(world, tutorTurn) : [];
  const next = world?.releaseSchedule?.find((entry) => entry.turn > tutorTurn) || null;
  const nextPremise = next ? world.premiseById.get(next.premise) : null;
  const branch = scaffoldBranchForTurn({ world, tutorTurn, tutorLearnerDag });
  const modeNote =
    dagMode === 'defeasible_human_scaffold'
      ? 'Learner may make compressed local leaps; tutor carries obvious public bridges internally and surfaces proof debt only when it matters.'
      : dagMode === 'human_scaffold'
        ? 'Tutor frames one local warrant and permits ordinary-language reasoning while strict proof remains the audit.'
        : 'Strict audit mode; no scaffold adaptation.';
  return {
    schema: SCAFFOLD_STATE_SCHEMA,
    mode: dagMode,
    enabled,
    source: enabled ? 'dramaturgy_release_projection' : 'strict_dag_disabled',
    turn: tutorTurn,
    activeAct: activeDramaturgyAct(world, tutorTurn),
    branch,
    localQuestion: enabled ? branch.localQuestion : null,
    warrantFrame: enabled ? branch.warrantFrame : null,
    joinReminder: enabled ? branch.joinReminder : null,
    releaseState: {
      releasedCount: released.length,
      dueNow: dueNow.map(compactReleaseRow),
      latestReleased: released.at(-1) ? compactReleaseRow(released.at(-1)) : null,
      nextRelease: next
        ? compactReleaseRow({ ...next, surface: nextPremise?.surface || '', fact: nextPremise?.fact || null })
        : null,
    },
    returnTarget: enabled
      ? {
          kind: dueNow.length ? 'current_release' : branch.id === 'join' ? 'join_warrant' : 'local_branch_warrant',
          prompt: branch.localQuestion,
          afterSideArc: `Return to: ${branch.localQuestion}`,
        }
      : null,
    modeNote,
    status: enabled ? 'projected_from_dramaturgy' : 'not_enabled_strict_dag',
  };
}

function buildSideArcState({
  dagMode,
  classification = null,
  learnerText = '',
  scaffoldState = null,
  generousInference = null,
}) {
  if (generousInference?.applied) {
    return {
      schema: SIDE_ARC_SCHEMA,
      mode: dagMode,
      detected: false,
      type: null,
      status: 'contextual_answer_resolved',
      returnTarget: null,
      learnerNeed: 'Acknowledge the resolved local inference and advance.',
      reason: 'A high-confidence adjacent elliptical answer completed the current local move.',
    };
  }
  const turn = classification?.turn || {};
  const labels = [turn.request_type, turn.discourse_move, turn.epistemic_stance, turn.affect]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const text = String(learnerText || '').toLowerCase();
  let type = null;
  let reason = 'no side arc detected';
  if (/plain|simpl|clarif|what do you mean|old language|confus|translate|wording/u.test(`${labels} ${text}`)) {
    type = 'clarification_or_plain_language';
    reason = 'learner is asking for clarification, translation, or simpler wording';
  } else if (/challenge|authority_refusal|low_trust|why|how do we know|prove|smuggling/u.test(`${labels} ${text}`)) {
    type = 'warrant_challenge';
    reason = 'learner is challenging the warrant or the tutor authority behind it';
  } else if (/resistant|affective|frustrat|pressure|defensive|too much|lost/u.test(`${labels} ${text}`)) {
    type = 'affective_repair';
    reason = 'learner is signalling affective resistance, pressure, or loss of agency';
  } else if (/off_task|unrelated/u.test(labels)) {
    type = 'off_task_or_contextual';
    reason = 'learner moved away from the proof path';
  }
  return {
    schema: SIDE_ARC_SCHEMA,
    mode: dagMode,
    detected: Boolean(type),
    type,
    status: type ? 'active_return_required' : 'none',
    returnTarget: type ? scaffoldState?.returnTarget || null : null,
    learnerNeed: type ? turn.pedagogical_need || classification?.overall?.next_best_tutor_move || null : null,
    reason,
  };
}

function buildProofDebtState({ dagMode, warrantPremiseAudit }) {
  const enabled = dagMode !== 'strict_dag';
  const audit = warrantPremiseAudit || {};
  const open = [
    ...(audit.proofDebtCandidates || []),
    ...(audit.warrants?.missing || []),
    ...(audit.warrants?.implied || []),
    ...(audit.premises?.impliedPublic || []),
    ...(audit.premises?.commonSenseBridges || []),
  ];
  const harmful = [...(audit.premises?.suppressedOrPrivate || []), ...(audit.premises?.illicitHidden || [])];
  const discharged = audit.strictProofAdoptions || [];
  const repaired = [];
  const buckets = { open, repaired, discharged, harmful };
  const status = !enabled
    ? 'not_enabled_strict_dag'
    : harmful.length
      ? 'harmful_hidden_premise_risk'
      : open.length
        ? 'open_proof_debt'
        : 'none_open';
  return {
    schema: PROOF_DEBT_SCHEMA,
    mode: dagMode,
    enabled,
    status,
    ...buckets,
    counts: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
  };
}

function buildStrictDagAuditState(tutorLearnerDag) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const assessment = model?.assessment || {};
  const metrics = model?.metrics || {};
  return {
    enabled: Boolean(model),
    coverage: assessment.bestPathCoverage ?? null,
    bottleneck: assessment.bottleneck || null,
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
  };
}

function publicStocktakeRows(rows = [], source = 'learner_record') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      surface: String(row?.surface || row?.text || '').trim(),
      turn: Number.isFinite(Number(row?.turn)) ? Number(row.turn) : null,
      source,
    }))
    .filter((row) => row.surface);
}

function normalizeDiscourseRows(rows = [], source = 'learner_record') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (typeof row === 'string') return { surface: row.trim(), source };
      return {
        surface: String(row?.surface || row?.text || row?.claim || row?.premise || '').trim(),
        warrantNeeded: String(row?.warrant_needed || row?.warrantNeeded || row?.missing_warrant || '').trim() || null,
        reason: String(row?.reason || row?.note || '').trim() || null,
        severity: String(row?.severity || '').trim() || null,
        source: String(row?.source || source).trim() || source,
      };
    })
    .filter((row) => row.surface || row.reason || row.warrantNeeded);
}

function normalizeHumanDiscourseExtraction(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sideArc = source.side_arc || source.sideArc || {};
  return {
    proofStatus: String(source.proof_status || source.proofStatus || 'unclear').trim() || 'unclear',
    provisionalClaims: normalizeDiscourseRows(
      source.provisional_claims || source.provisionalClaims,
      'extractor_provisional_claim',
    ),
    impliedWarrants: normalizeDiscourseRows(
      source.implied_warrants || source.impliedWarrants,
      'extractor_implied_warrant',
    ),
    missingWarrants: normalizeDiscourseRows(
      source.missing_warrants || source.missingWarrants,
      'extractor_missing_warrant',
    ),
    impliedPremises: normalizeDiscourseRows(
      source.implied_public_premises || source.impliedPremises,
      'extractor_implied_premise',
    ),
    suppressedPremises: normalizeDiscourseRows(
      source.suppressed_or_private_premises || source.suppressedPremises,
      'extractor_suppressed_premise',
    ),
    commonSenseBridges: normalizeDiscourseRows(
      source.common_sense_bridges || source.commonSenseBridges,
      'extractor_common_sense',
    ),
    illicitHiddenPremises: normalizeDiscourseRows(
      source.illicit_hidden_premises || source.illicitHiddenPremises,
      'extractor_hidden_premise',
    ),
    proofDebtCandidates: normalizeDiscourseRows(
      source.proof_debt_candidates || source.proofDebtCandidates,
      'extractor_proof_debt',
    ),
    sideArc: {
      detected: sideArc.detected === true,
      type: String(sideArc.type || '').trim() || null,
      reason: String(sideArc.reason || '').trim() || null,
      returnTarget: String(sideArc.return_target || sideArc.returnTarget || '').trim() || null,
    },
  };
}

function buildWarrantPremiseAudit({ dagMode, tutorLearnerDag, classification = null, learnerText = '', world = null }) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const record = model?.learnerRecord || {};
  const explicitWarrants = publicStocktakeRows(record.voicedDerived, 'voiced_derived_public_claim');
  const explicitPublicPremises = publicStocktakeRows(record.grounded, 'grounded_public_record');
  const extraction = normalizeHumanDiscourseExtraction(
    tutorLearnerDag?.accepted?.humanDiscourse || tutorLearnerDag?.extractor?.humanDiscourse,
  );
  const turn = classification?.turn || {};
  const overleap = /omits_warrant|overleaps_evidence|distorts_public_evidence|overconfident|answer_seeking/iu.test(
    [turn.evidence_use, turn.epistemic_stance, turn.discourse_move].filter(Boolean).join(' '),
  );
  const heuristicMissingWarrants =
    overleap && explicitWarrants.length === 0
      ? [
          {
            surface: oneLine(learnerText, { max: 180 }),
            reason: 'classifier marked overreach or answer-seeking before an explicit public warrant was stored',
            source: 'heuristic_overleap',
          },
        ].filter((row) => row.surface)
      : [];
  const rejectedDebt = normalizeDiscourseRows(
    (tutorLearnerDag?.rejected || [])
      .filter((row) => row?.type === 'derive' || row?.type === 'assert' || row?.reason === 'not staged')
      .map((row) => ({
        surface: Array.isArray(row.value) ? factSurface(world, row.value) : String(row.value || ''),
        reason: row.reason || 'rejected by strict learner-DAG update',
      })),
    'strict_dag_rejection',
  );
  const proofDebtCandidates = [
    ...extraction.proofDebtCandidates,
    ...extraction.provisionalClaims
      .filter((row) => row.warrantNeeded)
      .map((row) => ({ ...row, reason: row.reason || row.warrantNeeded })),
    ...heuristicMissingWarrants,
    ...rejectedDebt,
  ];
  const strictProofAdoptions = [
    ...(tutorLearnerDag?.accepted?.adopt || []).map((premise) => ({
      surface: premise,
      source: 'strict_adopted_premise',
    })),
    ...(tutorLearnerDag?.accepted?.derive || []).map((fact) => ({
      surface: factSurface(world, fact),
      source: 'strict_derived_public_claim',
    })),
  ].filter((row) => row.surface);
  const proofStatus =
    model?.assessment?.finalSecretEntailed && model?.assessment?.assertedSecret
      ? 'strict_grounded_closure'
      : extraction.proofStatus !== 'unclear'
        ? extraction.proofStatus
        : proofDebtCandidates.length
          ? 'provisional_or_debt_open'
          : 'strict_or_open';
  return {
    schema: WARRANT_PREMISE_AUDIT_SCHEMA,
    mode: dagMode,
    phase: HUMAN_DISCOURSE_PHASE,
    proofStatus,
    status:
      dagMode === 'strict_dag'
        ? 'strict_audit_only'
        : extraction.illicitHiddenPremises.length || extraction.suppressedPremises.length
          ? 'hidden_or_suppressed_premise_risk'
          : proofDebtCandidates.length
            ? 'proof_debt_open'
            : 'current_turn_clean',
    warrants: {
      explicit: explicitWarrants,
      implied: extraction.impliedWarrants,
      missing: [...extraction.missingWarrants, ...heuristicMissingWarrants],
    },
    premises: {
      explicitPublic: explicitPublicPremises,
      impliedPublic: extraction.impliedPremises,
      suppressedOrPrivate: extraction.suppressedPremises,
      commonSenseBridges: extraction.commonSenseBridges,
      illicitHidden: extraction.illicitHiddenPremises,
    },
    provisionalClaims: extraction.provisionalClaims,
    proofDebtCandidates,
    strictProofAdoptions,
    extractionSideArc: extraction.sideArc,
    counts: {
      explicitWarrants: explicitWarrants.length,
      impliedWarrants: extraction.impliedWarrants.length,
      missingWarrants: extraction.missingWarrants.length + heuristicMissingWarrants.length,
      explicitPublicPremises: explicitPublicPremises.length,
      impliedPremises: extraction.impliedPremises.length,
      suppressedPremises: extraction.suppressedPremises.length,
      commonSenseBridges: extraction.commonSenseBridges.length,
      illicitHiddenPremises: extraction.illicitHiddenPremises.length,
      provisionalClaims: extraction.provisionalClaims.length,
      proofDebtCandidates: proofDebtCandidates.length,
      strictProofAdoptions: strictProofAdoptions.length,
    },
  };
}

function buildHumanDiscourseFrame({ state, tutorTurn, tutorLearnerDag, classification = null, learnerText = '' }) {
  const dagMode = state?.dagMode || 'strict_dag';
  const scaffoldState = buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag });
  const generousInference = resolveTutorStubGenerousInference({
    mode: dagMode,
    learnerText,
    previousTutorText: latestTutorMessage(state),
    branchId: scaffoldState.branch?.id || null,
    classification,
  });
  const sideArc = buildSideArcState({
    dagMode,
    classification,
    learnerText,
    scaffoldState,
    generousInference,
  });
  const warrantPremiseAudit = buildWarrantPremiseAudit({
    dagMode,
    tutorLearnerDag,
    classification,
    learnerText,
    world: state?.world || null,
  });
  const proofDebt = buildProofDebtState({ dagMode, warrantPremiseAudit });
  return {
    schema: HUMAN_DISCOURSE_FRAME_SCHEMA,
    mode: dagMode,
    phase: HUMAN_DISCOURSE_PHASE,
    scaffoldActive: dagMode !== 'strict_dag',
    stepCompression: state?.humanDiscourse?.stepCompression || null,
    turn: tutorTurn,
    strictDag: buildStrictDagAuditState(tutorLearnerDag),
    scaffoldState,
    sideArc,
    proofDebt,
    warrantPremiseAudit,
    generousInference,
  };
}

function buildLearnerRecordPrompt({ learnerText, state, tutorTurn }) {
  const staged = stagedEvidenceRows(state.world, tutorTurn);
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn });
  return [
    '# Task',
    '',
    'Extract a conservative public learner-record update from the current learner turn.',
    "This update feeds a tutor-side model of the learner DAG. It is not the learner's private state.",
    comprehensionContext || null,
    '',
    '# Public question',
    state.world.question,
    '',
    '# Public rules',
    ...state.world.rules.map(ruleText),
    '',
    '# Staged public evidence available at or before this turn',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    learnerText,
    '',
    '# Extraction rules',
    '',
    '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
    '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
    '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
    '- Single-step trial-book rule: if the learner states a warranted conclusion from staged evidence, include both the supporting staged premise ids in adopt and the conclusion fact in derive. Do not require a separate "add it to the book" utterance.',
    '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply such as "the same" unambiguously answers a single-referent local question, treat the resolved content as learner-voiced; do not require the learner to repeat the noun or name.',
    '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
    '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
    '- human_discourse.proof_status: strict_proof, provisional_scaffold, side_arc, hidden_premise_risk, or unclear.',
    '- human_discourse.provisional_claims: claims the learner is allowed to hold provisionally before the strict proof is complete.',
    '- human_discourse.implied_warrants: inference rules the learner is using in ordinary language without spelling them out.',
    '- human_discourse.missing_warrants: warrants the learner needs before the claim counts as strict proof.',
    '- human_discourse.implied_public_premises: public assumptions suggested by the transcript but not yet stored as strict grounded premises.',
    '- human_discourse.suppressed_or_private_premises: premises the learner seems to rely on that are not public in the staged evidence.',
    '- human_discourse.common_sense_bridges: harmless everyday bridges that can be allowed provisionally but may need repair.',
    '- human_discourse.illicit_hidden_premises: any apparent use of hidden or unstaged story facts.',
    '- human_discourse.proof_debt_candidates: provisional leaps or missing warrants the tutor should keep visible for later repair.',
    '- human_discourse.side_arc: clarification, vocabulary, affective, trust, or off-path requests that should be answered briefly before returning to the proof path.',
    '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: record it as a side arc, but do not adopt premises, derive facts, or assert an answer from the request itself.',
    '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        adopt: ['premise_id'],
        retract: ['premise_id'],
        derive: [['predicate', 'arg1', 'arg2']],
        hypothesis: 'short hypothesis or null',
        assert_answer: 'candidate name or null',
        human_discourse: humanDiscourseExtractionSchema(),
        notes: 'brief reason for the extraction',
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function learnerClassificationSchema() {
  return {
    turn: {
      summary: 'one short sentence',
      request_type: 'controlled label',
      discourse_move: 'controlled label',
      evidence_use: 'controlled label',
      epistemic_stance: 'controlled label',
      affect: 'short label',
      agency: 'controlled label',
      scores: {
        conceptual_engagement: { score: 1, reason: 'short phrase' },
        epistemic_readiness: { score: 1, reason: 'short phrase' },
      },
      pedagogical_need: 'one short phrase',
    },
    overall: {
      summary: 'one short sentence',
      trajectory: 'short phrase',
      recurring_pattern: 'short phrase or none',
      current_state: 'short phrase',
      next_best_tutor_move: 'one short sentence',
    },
  };
}

function learnerRecordSchema() {
  return {
    human_discourse: humanDiscourseExtractionSchema(),
    notes: 'one short sentence only when useful',
  };
}

function humanDiscourseExtractionSchema() {
  return {
    proof_status: 'strict_proof|provisional_scaffold|side_arc|hidden_premise_risk|unclear',
  };
}

function engagementStanceSelectionSchema() {
  return {
    engagement_stance: 'one available tutor engagement stance name',
    reviewer_signal: 'brief up-front reviewer judgment that motivates this stance choice',
    request_type: 'logical request type from the classifier; this is not the engagement stance',
    engagement_stance_reason: 'why the up-front reviewer chose this stance for the next tutor response',
    evidence_span: 'short quote or public-state cue supporting the choice',
    risk_flags: ['guardrail flags, or empty array'],
    expected_dag_move: 'what learner-DAG progress this register is meant to produce next',
    expected_field_move: 'what learner-field movement this register is meant to produce next',
    expected_progress_marker: 'what the next learner turn should show if this register worked',
    confidence: 0.75,
  };
}

function buildCombinedLearnerAnalysisPrompt({ learnerText, state, tutorTurn }) {
  const staged = stagedEvidenceRows(state.world, tutorTurn);
  const includeRegisterSelection = Boolean(
    state.register?.enabled &&
    ![
      'field',
      'trajectory',
      'dynamical_system',
      'empirical_dynamical_system',
      'continuous_dynamical_system',
      'continuous_empirical_dynamical_system',
      'state',
      'random',
      'bland',
      'negative',
    ].includes(state.register.policy) &&
    state.register.palette?.length,
  );
  const localFieldPolicy = Boolean(state.register?.enabled && state.register.policy === 'field');
  const localTrajectoryPolicy = Boolean(state.register?.enabled && state.register.policy === 'trajectory');
  const localDynamicalSystemPolicy = Boolean(state.register?.enabled && state.register.policy === 'dynamical_system');
  const localEmpiricalDynamicalSystemPolicy = Boolean(
    state.register?.enabled && state.register.policy === 'empirical_dynamical_system',
  );
  const localContinuousDynamicalSystemPolicy = Boolean(
    state.register?.enabled && state.register.policy === 'continuous_dynamical_system',
  );
  const localContinuousEmpiricalDynamicalSystemPolicy = Boolean(
    state.register?.enabled && state.register.policy === 'continuous_empirical_dynamical_system',
  );
  const localStatePolicy = Boolean(state.register?.enabled && state.register.policy === 'state');
  const fixedBlandPolicy = Boolean(state.register?.enabled && state.register.policy === 'bland');
  const negativeFloorPolicy = Boolean(state.register?.enabled && state.register.policy === 'negative');
  const schema = {
    classification: learnerClassificationSchema(),
    learner_record: learnerRecordSchema(),
  };
  if (includeRegisterSelection) schema.register_selection = engagementStanceSelectionSchema();
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn });
  return [
    '# Task',
    '',
    'Analyze the learner input once before the tutor responds.',
    'Be terse. Keep every summary or reason to one short sentence or phrase.',
    comprehensionContext || null,
    'Return sparse JSON: omit empty arrays, null optional learner_record fields, and absent human_discourse fields. Do not restate the same issue across arrays.',
    'Return both:',
    '1. A pedagogical discourse classification.',
    '2. A conservative public learner-record update for the tutor-side learner-DAG model.',
    includeRegisterSelection
      ? '3. A tutor engagement-stance selection made by the up-front reviewer using the classification plus the tutor-side learner-DAG state.'
      : null,
    localFieldPolicy
      ? 'Policy is field: do not choose an engagement stance. The runtime will map the classification plus learner-DAG update into a local engagement-stance distribution.'
      : null,
    localTrajectoryPolicy
      ? 'Policy is trajectory: do not choose an engagement stance. The runtime will map classification, learner-DAG state, and recent trajectory into a local engagement-stance distribution.'
      : null,
    localDynamicalSystemPolicy
      ? 'Policy is dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, and prior stance efficacy into a local distribution.'
      : null,
    localEmpiricalDynamicalSystemPolicy
      ? 'Policy is empirical_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, local stance efficacy, and cross-run priors into a local distribution.'
      : null,
    localContinuousDynamicalSystemPolicy
      ? 'Policy is continuous_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, and prior efficacy into a weighted engagement-stance blend.'
      : null,
    localContinuousEmpiricalDynamicalSystemPolicy
      ? 'Policy is continuous_empirical_dynamical_system: do not choose an engagement stance. The runtime will map classification, learner-DAG state, derivatives, stance priors, local efficacy, and cross-run priors into a weighted engagement-stance blend.'
      : null,
    localStatePolicy
      ? 'Policy is state: do not choose an engagement stance. The runtime will map current classification and learner-DAG assessment into a local engagement-stance distribution.'
      : null,
    fixedBlandPolicy
      ? 'Policy is bland: do not choose an engagement stance. The runtime will use a fixed plain non-adaptive baseline stance.'
      : null,
    negativeFloorPolicy
      ? 'Policy is negative: do not choose an engagement stance. The runtime will sample only ironic, sarcastic, and face_threat as an explicit negative-floor stance control.'
      : null,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Public question',
    '',
    state.world.question,
    '',
    '# Public rules',
    '',
    ...state.world.rules.map(ruleText),
    '',
    '# Staged public evidence available at or before this turn',
    '',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Scores (1-5): conceptual_engagement = parroting, surface, partial concept, substantive reasoning, constructing/testing/revising; epistemic_readiness = reception, minimal awareness, generic awareness, evidence-aware monitoring, active bias/uncertainty monitoring.',
    'Use controlled labels:',
    '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
    '- evidence precedence: distorted/misattributed public clue => distorts_public_evidence; correct clue plus conclusion but no bridge => omits_warrant; conclusion beyond available evidence => overleaps_evidence; explicit bridge => links_evidence_to_rule.',
    '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before assigning these labels. A reply such as "it will be the same" can fully answer a local single-referent question without repeating the noun.',
    '- Do not call a contextually complete short answer confused, passive, or evidence-free merely because the preceding question supplies its referent. Record any genuinely omitted warrant separately for strict audit.',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    includeRegisterSelection ? '# Request type registry' : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection
      ? 'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the engagement stance.'
      : null,
    includeRegisterSelection ? requestTypePromptRows() : null,
    includeRegisterSelection ? '' : null,
    '# Learner-record extraction rules',
    '',
    '- adopt/retract: only staged premise ids the learner explicitly accepts/uses or rejects/withdraws.',
    '- derive: only learner-voiced conclusions supported by adopted or staged evidence plus public rules. For a warranted one-step conclusion, include its supporting premise ids in adopt and its fact in derive.',
    '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply unambiguously answers that local question, the resolved content counts as learner-voiced; do not demand repeated nouns or names.',
    '- hypothesis: one learner conjecture or uncertainty, else null. assert_answer: direct answer candidate, else null.',
    '- human_discourse: record only concrete current-turn material. proof_status uses the schema enum. provisional_claims are allowable but not strict; implied_warrants are unstated bridges; missing_warrants are still owed; implied_public_premises are public but ungrounded; suppressed_or_private_premises and illicit_hidden_premises are not public enough; common_sense_bridges are safe provisional steps; proof_debt_candidates need later repair; side_arc covers clarification, vocabulary, affect, trust, or off-path requests.',
    '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: classify and record the side arc, but do not adopt premises, derive facts, or assert an answer from that request itself.',
    '- Be conservative: staged evidence is not adopted merely because it exists.',
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Tutor engagement-stance selection' : null,
    includeRegisterSelection
      ? 'As the up-front reviewer, select one engagement stance for the upcoming tutor response. The learner does not choose or license the stance.'
      : null,
    includeRegisterSelection
      ? 'Keep request_type separate from engagement_stance: request_type is the logical/DAG armature; engagement_stance is the reviewer-chosen tone and posture.'
      : null,
    includeRegisterSelection
      ? 'Do not select action_family here. The runtime selects it independently from the learner state after this analysis.'
      : null,
    includeRegisterSelection
      ? 'The selected engagement stance should be appropriate to the classification, learner-DAG state, field movement, and recent stance efficacy, but it does not determine the action family, audience register, lexical accessibility, or scene immersion.'
      : null,
    includeRegisterSelection
      ? 'Use expected_field_move for the discourse/agency/posture movement you want, and expected_dag_move for the proof-state movement you want.'
      : null,
    includeRegisterSelection
      ? 'Never choose a stance outside the available palette. Negative/liminal stances appear only when explicitly included in that palette.'
      : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Engagement-stance selection policy' : null,
    includeRegisterSelection ? engagementStanceSelectionPolicyPrompt(state) : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Available tutor engagement-stance palette' : null,
    includeRegisterSelection ? engagementStancePalettePromptRows(state.register.palette) : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior redacted tutor-side learner-DAG model' : null,
    includeRegisterSelection ? learnerDagPromptSummary(state.learnerDag.lastModel) : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior tutor engagement stances and observed efficacy' : null,
    includeRegisterSelection ? registerHistoryPromptSummary(state) : null,
    '',
    '# JSON schema',
    '',
    JSON.stringify(schema, null, 2),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function extractLearnerRecordUpdate({ learnerText, state, tutorTurn }) {
  const prompt = buildLearnerRecordPrompt({ learnerText, state, tutorTurn });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_RECORD_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_record',
    maxTokens: 700,
    trace: state.trace,
    stream: state.stream,
    cliEffort: state.cliEffort,
    turn: tutorTurn,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    ...parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

async function extractCombinedLearnerAnalysis({
  learnerText,
  state,
  tutorTurn,
  role = 'tutor_stub_learner_analysis',
  stream = state.stream,
  signal = null,
}) {
  const prompt = buildCombinedLearnerAnalysisPrompt({ learnerText, state, tutorTurn });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_ANALYSIS_SYSTEM_PROMPT,
    role,
    maxTokens: Math.max(2500, state.maxTokens || 0),
    trace: state.trace,
    stream,
    cliEffort: state.cliEffort,
    turn: tutorTurn,
    signal,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

function classificationFromCombinedAnalysis(raw, state) {
  const parsed = raw?.parsed || {};
  const source =
    parsed.classification ||
    parsed.learner_classification ||
    parsed.classifier ||
    (parsed.turn && parsed.overall ? parsed : null);

  if (!source) {
    return failedClassification({
      message: 'Combined learner analysis did not include a classification object.',
      resolved: state.learnerDag.resolved,
      latencyMs: raw?.latencyMs || 0,
      usage: raw?.usage,
    });
  }

  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function learnerRecordFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  const source = parsed.learner_record || parsed.learnerRecord || parsed.public_record || parsed.record || {};
  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function registerSelectionFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  return parsed.register_selection || parsed.registerSelection || parsed.tutor_register || parsed.register || null;
}

function dagProgressFeatures(model) {
  const metrics = model?.metrics || {};
  const assessment = model?.assessment || {};
  return {
    bestPathCoverage: Number(assessment.bestPathCoverage || 0),
    groundedCount: Number(metrics.groundedCount || 0),
    voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
    candidateConclusionCount: Number(metrics.candidateConclusionCount || 0),
    answerCandidateCount: Number(metrics.answerCandidateCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
  };
}

function meanFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function rankLearnerFieldLabel(axis, value) {
  if (value === undefined || value === null) return null;
  return LEARNER_FIELD_RANKS[axis]?.[String(value).trim()] ?? null;
}

function normalizedClassifierScore(score) {
  const numeric = Number(scoreValue(score));
  return Number.isFinite(numeric) ? clampField01((numeric - 1) / 4) : null;
}

function learnerSurfaceFieldPoint(classification) {
  const turn = classification?.turn || {};
  const scores = turn.scores || {};
  const dimensions = {
    conceptual: normalizedClassifierScore(scores.conceptual_engagement),
    epistemic: normalizedClassifierScore(scores.epistemic_readiness),
    evidence: rankLearnerFieldLabel('evidence_use', turn.evidence_use),
    agency: rankLearnerFieldLabel('agency', turn.agency),
    stance: rankLearnerFieldLabel('epistemic_stance', turn.epistemic_stance),
    discourse: rankLearnerFieldLabel('discourse_move', turn.discourse_move),
  };
  return {
    score: meanFinite(Object.values(dimensions)),
    dimensions,
    labels: {
      discourse_move: turn.discourse_move || null,
      evidence_use: turn.evidence_use || null,
      epistemic_stance: turn.epistemic_stance || null,
      agency: turn.agency || null,
    },
    summary: turn.summary || null,
  };
}

function previousLearnerSurfaceFieldPoint(state) {
  const previousTurn = [...(state.turns || [])].reverse().find((turn) => turn.classification);
  return previousTurn ? learnerSurfaceFieldPoint(previousTurn.classification) : null;
}

function fieldProgressFromClassification({ state, classification }) {
  const before = previousLearnerSurfaceFieldPoint(state);
  const after = learnerSurfaceFieldPoint(classification);
  const delta =
    before?.score === null || before?.score === undefined || after?.score === null || after?.score === undefined
      ? null
      : Number((after.score - before.score).toFixed(3));
  return {
    threshold: FIELD_PROGRESS_THRESHOLD,
    beforeScore: before?.score ?? null,
    afterScore: after?.score ?? null,
    delta,
    progress: delta !== null && delta >= FIELD_PROGRESS_THRESHOLD,
    before: before || null,
    after,
  };
}

function classifyFieldStateRelation({ fieldProgress, dagProgress }) {
  if (fieldProgress && !dagProgress) return 'field_without_dag';
  if (dagProgress && !fieldProgress) return 'dag_without_field';
  if (fieldProgress && dagProgress) return 'both_progress';
  return 'neither_progress';
}

function summarizeDagDeltas(delta) {
  const parts = [];
  if (delta.bestPathCoverage) parts.push(`coverage ${delta.bestPathCoverage > 0 ? '+' : ''}${delta.bestPathCoverage}`);
  if (delta.groundedCount) parts.push(`grounded ${delta.groundedCount > 0 ? '+' : ''}${delta.groundedCount}`);
  if (delta.voicedDerivedCount)
    parts.push(`voiced ${delta.voicedDerivedCount > 0 ? '+' : ''}${delta.voicedDerivedCount}`);
  if (delta.answerCandidateCount)
    parts.push(`answers ${delta.answerCandidateCount > 0 ? '+' : ''}${delta.answerCandidateCount}`);
  if (delta.missingPremiseCount)
    parts.push(`missing ${delta.missingPremiseCount > 0 ? '+' : ''}${delta.missingPremiseCount}`);
  if (delta.unsupportedAssertionCount) {
    parts.push(`unsupported ${delta.unsupportedAssertionCount > 0 ? '+' : ''}${delta.unsupportedAssertionCount}`);
  }
  return parts.join(', ') || 'no learner-DAG movement';
}

function registerEfficacyFromDagProgress({ selection, currentModel, accepted, state, classification }) {
  const before = dagProgressFeatures(selection?.selectedAtDag);
  const after = dagProgressFeatures(currentModel);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    delta.missingPremiseCount -
    Math.max(0, delta.unsupportedAssertionCount);
  const label =
    progressScore > 0 ? 'positive_progress' : progressScore < 0 ? 'regression_or_overreach' : 'no_clear_progress';
  const dagProgress = progressScore > 0;
  const field = fieldProgressFromClassification({ state, classification });
  const mismatch = classifyFieldStateRelation({ fieldProgress: field.progress, dagProgress });
  return {
    schema: 'machinespirits.tutor-stub.register-efficacy.v1',
    evaluatedAtTurn: currentModel?.turn ?? null,
    registerTurn: selection?.turn ?? null,
    selected_register: selection?.selected_register || null,
    label,
    progressScore,
    dagProgress,
    field,
    mismatch,
    delta,
    acceptedUpdate: accepted
      ? {
          adopted: accepted.adopt?.length || 0,
          derived: accepted.derive?.length || 0,
          hypothesis: Boolean(accepted.hypothesis),
          assertedAnswer: accepted.assertAnswer || null,
        }
      : null,
    summary: summarizeDagDeltas(delta),
    caveat:
      'Heuristic local association only: the next learner turn is compared with the DAG and learner-field state when the register was selected.',
  };
}

function evaluatePendingRegisterEfficacy(state, currentDagResult, classification = null) {
  if (!state.register?.enabled || !currentDagResult?.model) return null;
  const pending = [...state.register.history]
    .reverse()
    .find((entry) => !entry.efficacy && entry.turn < currentDagResult.model.turn);
  if (!pending) return null;
  pending.efficacy = registerEfficacyFromDagProgress({
    selection: pending,
    currentModel: currentDagResult.model,
    accepted: currentDagResult.accepted,
    state,
    classification,
  });
  return pending.efficacy;
}

function firstAvailableRegister(palette, names, fallback = 'precise') {
  for (const name of names) {
    if (palette.has(name)) return name;
  }
  return palette.has(fallback) ? fallback : [...palette][0] || fallback;
}

function preferredLegacyRegister({ register, requestType, actionFamily }) {
  if (register === 'ironic') return 'ironic_challenge';
  if (register === 'sarcastic') return 'sarcastic_challenge';
  if (register === 'face_threat') return 'face_threat_challenge';
  if (register === 'witnessing') return 'witnessing_restraint';
  if (register === 'charismatic') return 'charismatic_challenge';
  if (actionFamily === 'stage_next_step') return 'scaffolding';
  if (actionFamily === 'answer_accountably') return 'accountable_bid_authority';
  if (actionFamily === 'compress_sayback') return 'plain_compression';
  if (actionFamily === 'reanchor_lived_stake') return 'lived_stakes_reentry';
  if (actionFamily === 'ground_in_material') return 'transfer_grounding';
  if (requestType === 'conceptual_clarity_request') return 'clarity';
  return null;
}

function registerSignalText(classification) {
  const turn = classification?.turn || {};
  return [
    turn.summary,
    turn.request_type,
    turn.discourse_move,
    turn.evidence_use,
    turn.epistemic_stance,
    turn.affect,
    turn.agency,
    turn.pedagogical_need,
    classification?.overall?.current_state,
    classification?.overall?.next_best_tutor_move,
  ]
    .filter(Boolean)
    .join(' ');
}

function hasExplicitStepwiseSignal(classification) {
  return /step|stepwise|next|how do i|how should i|start|begin|walk|break|stuck|confus|which evidence|what evidence|what line|clue|hint|show me|what should i do/iu.test(
    registerSignalText(classification),
  );
}

function briskRepeatPenalty(state) {
  const latest = latestRegisterSelection(state);
  const latestBad =
    latest?.selected_register === 'brisk' &&
    /no_clear_progress|regression_or_overreach/.test(latest.efficacy?.label || '');
  return Boolean(latestBad || recentRegisterCount(state, 'brisk') >= 2);
}

function shouldUseDynamicBrisk({ state, classification, assessment }) {
  const bottleneck = assessment.bottleneck || '';
  const hasDagGap = /release_or_pacing_gap|inference_gap/.test(bottleneck);
  const explicitStepwise = hasExplicitStepwiseSignal(classification);
  const latestMismatch = latestFieldStateMismatch(state);
  if (/field_without_dag|dag_without_field/.test(latestMismatch || '') && !explicitStepwise) return false;
  if (!hasDagGap || !explicitStepwise) return false;
  if (briskRepeatPenalty(state) && !explicitStepwise) return false;
  return true;
}

function fallbackRegisterSelection({ state, classification, tutorLearnerDag }) {
  const palette = new Set(state.register?.palette || []);
  const policy = state.register?.policy || 'dynamic';
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const requestType = classification?.turn?.request_type || 'unknown_request';
  const move = classification?.turn?.discourse_move || 'unknown';
  const stance = classification?.turn?.epistemic_stance || 'unknown';
  const evidenceUse = classification?.turn?.evidence_use || 'unknown';
  const agency = classification?.turn?.agency || 'unknown';
  const latestMismatch = latestFieldStateMismatch(state);
  let selected = 'precise';
  let actionFamily = 'clarify_distinction';
  let reason = '';
  let expectedFieldMove = '';

  if (palette.has('witnessing') && /vulnerable|affective/.test(`${move} ${stance}`)) {
    selected = 'witnessing';
    actionFamily = 'receive_vulnerability';
    reason = 'The reviewer sees affective exposure as the strongest current public cue.';
    expectedFieldMove = 'Lower learner risk enough for a concrete public-evidence move to become possible.';
  } else if (
    palette.has('precise') &&
    /challenge|omits_warrant|overleaps_evidence|distorts_public_evidence/.test(`${move} ${evidenceUse}`)
  ) {
    selected = 'precise';
    actionFamily = 'answer_accountably';
    reason =
      'The learner is challenging or overleaping the public evidence, so the tutor should hold the bid accountable.';
    expectedFieldMove = 'Shift from unsupported assertion toward a publicly warranted claim.';
  } else if (policy === 'dynamic' && latestMismatch === 'field_without_dag') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'charismatic']);
    actionFamily = requestType === 'transfer_demand_or_named_material' ? 'ground_in_material' : 'compress_sayback';
    reason =
      'The previous register improved the learner field without proof-DAG movement; convert that preparatory movement into one public evidence claim.';
    expectedFieldMove = 'Turn improved orientation or agency into a learner-owned trial-book statement.';
  } else if (policy === 'dynamic' && latestMismatch === 'dag_without_field') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'witnessing']);
    actionFamily = 'compress_sayback';
    reason =
      'The proof-DAG advanced while learner field movement flattened; ask the learner to own the reason for the step before pushing another premise.';
    expectedFieldMove = 'Recover agency and explanatory ownership around the evidence just adopted.';
  } else if (
    palette.has('charismatic') &&
    /resistant|overconfident|answer_seeking|complying|passive/.test(`${stance} ${evidenceUse} ${agency}`)
  ) {
    selected = 'charismatic';
    actionFamily = 'challenge_resistance';
    reason =
      'Low-agency, answer-seeking, or overconfident posture warrants a compact challenge rather than another stepwise hint.';
    expectedFieldMove = 'Increase learner agency or evidence-seeking without supplying the concealed answer.';
  } else if (
    policy === 'dynamic' &&
    palette.has('brisk') &&
    shouldUseDynamicBrisk({ state, classification, assessment })
  ) {
    selected = 'brisk';
    actionFamily = 'stage_next_step';
    reason = 'The learner is explicitly asking for stepwise help on the immediate evidence move.';
    expectedFieldMove = 'Make the next learner-owned inference easier without turning it into a menu or answer.';
  } else if (!palette.has(selected)) {
    selected = firstAvailableRegister(palette, ['precise', 'charismatic', 'plain', 'warm', 'witnessing', 'brisk']);
  }

  if (!reason) {
    reason =
      policy === 'dynamic' && selected !== 'brisk'
        ? 'Dynamic fallback selected after missing or invalid model register output; brisk pacing is non-default.'
        : 'Fallback register selected after missing or invalid model register output.';
  }
  if (!expectedFieldMove) {
    expectedFieldMove = 'Improve the learner field enough that the next public evidence move becomes more likely.';
  }

  return {
    selected_register: selected,
    request_type: requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    reviewer_signal: `${requestType}; ${move}`,
    register_reason: reason,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMove,
    expected_progress_marker:
      'Next learner turn adopts staged evidence, voices a derivable inference, or corrects an overreach.',
    confidence: 0.25,
    warning: 'fallback_register_selection',
    source: 'local_fallback_register_selection',
  };
}

function fixedBlandEngagementStanceSelection({ state, classification }) {
  const palette = new Set(state.register?.palette || []);
  const selected = firstAvailableRegister(palette, ['plain', 'precise', 'brisk']);
  const requestType = classification?.turn?.request_type || 'bland_baseline';
  return {
    selected_register: selected,
    request_type: requestType,
    action_family: 'baseline_plain_response',
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType,
      actionFamily: 'baseline_plain_response',
    }),
    reviewer_signal: 'fixed_bland_policy',
    register_reason:
      selected === 'plain'
        ? 'Bland policy fixes a plain non-adaptive baseline register.'
        : 'Bland policy requested plain, but the active palette did not include it; selected the nearest available baseline register.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'No adaptive register-specific DAG move is predicted for the bland baseline.',
    expected_field_move:
      'Use the fixed plain stance as a control condition for comparison with adaptive register policies.',
    expected_progress_marker: 'Observe learner-DAG and field movement without adaptive register selection.',
    confidence: null,
    source: 'fixed_bland_register_policy',
  };
}

function randomEngagementStanceSelection({ state, classification }) {
  const palette = state.register?.palette || [];
  const randomValue = Math.random();
  const index = Math.min(palette.length - 1, Math.floor(randomValue * palette.length));
  const selected = palette[index] || firstAvailableRegister(new Set(palette), ['precise', 'plain', 'brisk']);
  return {
    selected_register: selected,
    request_type: classification?.turn?.request_type || 'random_policy',
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: classification?.turn?.request_type || 'random_policy',
      actionFamily: null,
    }),
    reviewer_signal: 'random_policy',
    register_reason:
      'Random register policy sampled uniformly from the active palette; this choice is not a classifier- or learner-DAG-based recommendation.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      'No register-specific DAG move is predicted; preserve evidence safety while following the sampled register stance.',
    expected_field_move:
      'Observe whether the sampled stance changes learner agency, evidence use, stance, or conceptual engagement.',
    expected_progress_marker:
      'Use the next learner turn to observe whether this random register coincides with learner-DAG progress.',
    confidence: null,
    source: 'random_register_policy',
    random: {
      method: 'Math.random',
      value: Number(randomValue.toFixed(6)),
      index,
      population: palette.length,
    },
  };
}

function negativeEngagementStanceSelection({ state, classification }) {
  const active = new Set(state.register?.palette || []);
  const palette = NEGATIVE_FLOOR_REGISTERS.filter((register) => active.has(register));
  const population = palette.length ? palette : NEGATIVE_FLOOR_REGISTERS;
  const randomValue = Math.random();
  const index = Math.min(population.length - 1, Math.floor(randomValue * population.length));
  const selected = population[index] || 'ironic';
  return {
    selected_register: selected,
    request_type: classification?.turn?.request_type || 'negative_floor_policy',
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: classification?.turn?.request_type || 'negative_floor_policy',
      actionFamily: null,
    }),
    reviewer_signal: 'negative_floor_policy',
    register_reason:
      'Negative register floor sampled uniformly from ironic, sarcastic, and face_threat; this is a deliberate floor/control, not a recommended adaptive stance.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: ['negative_floor'],
    expected_dag_move:
      'No beneficial register-specific DAG move is predicted; preserve evidence safety while measuring whether negative stance harms uptake or agency.',
    expected_field_move:
      'Measure recognition cost, learner agency narrowing, disengagement, or coerced progress under a negative-only register floor.',
    expected_progress_marker:
      'Compare learner-DAG progress against field movement and recognition-cost signals after the negative stance.',
    confidence: null,
    source: 'negative_register_policy',
    random: {
      method: 'Math.random',
      value: Number(randomValue.toFixed(6)),
      index,
      population: population.length,
      floor: NEGATIVE_FLOOR_REGISTERS,
    },
  };
}

const FIELD_REGISTER_BASE_WEIGHTS = {
  plain: 1,
  precise: 1,
  brisk: 0.7,
  warm: 0.8,
  witnessing: 0.55,
  charismatic: 0.75,
  ironic: 0.35,
  sarcastic: 0.2,
  face_threat: 0.08,
};

function hasScoreRegister(scores, register) {
  return Object.prototype.hasOwnProperty.call(scores, register);
}

function addRegisterScore(scores, register, amount, drivers, reason) {
  if (!hasScoreRegister(scores, register) || !Number.isFinite(Number(amount))) return;
  scores[register] += Number(amount);
  if (amount > 0 && reason) drivers.push(`${register}+${Number(amount).toFixed(2)} ${reason}`);
}

function multiplyRegisterScore(scores, register, factor, drivers, reason) {
  if (!hasScoreRegister(scores, register) || !Number.isFinite(Number(factor))) return;
  scores[register] *= Number(factor);
  if (reason) drivers.push(`${register}x${Number(factor).toFixed(2)} ${reason}`);
}

function learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag }) {
  const previous = state.turns?.at(-1)?.tutorLearnerDagModel || null;
  const current = tutorLearnerDag?.model || null;
  const before = dagProgressFeatures(previous);
  const after = dagProgressFeatures(current);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    Math.max(0, delta.unsupportedAssertionCount);
  return {
    before,
    after,
    delta,
    progressScore: Number(progressScore.toFixed(3)),
    progress: progressScore > 0,
  };
}

function fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag }) {
  const turn = classification?.turn || {};
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const metrics = tutorLearnerDag?.model?.metrics || {};
  const field = fieldProgressFromClassification({ state, classification });
  const dag = learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag });
  const turnNumber = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  const fieldRelation =
    field.delta === null
      ? 'initial'
      : classifyFieldStateRelation({
          fieldProgress: field.progress,
          dagProgress: dag.progress,
        });
  return {
    turn: turnNumber,
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    evidenceUse: turn.evidence_use || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    agency: turn.agency || 'unknown',
    affect: turn.affect || 'unknown',
    field: {
      relation: fieldRelation,
      beforeScore: field.beforeScore,
      afterScore: field.afterScore,
      delta: field.delta,
      progress: field.progress,
      dimensions: field.after?.dimensions || {},
      labels: field.after?.labels || {},
    },
    dag: {
      progress: dag.progress,
      progressScore: dag.progressScore,
      delta: dag.delta,
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
    },
    explicitStepwise: hasExplicitStepwiseSignal(classification),
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: turnNumber }),
    recentRegisters: (state.register?.history || [])
      .slice(-4)
      .map((entry) => normalizeStoredRegisterSelection(entry)?.selected_register),
    latestEfficacy: latestRegisterEfficacy(state),
  };
}

function expectedFieldMoveForRegister(selected, features) {
  const relation = features.field?.relation || 'unknown';
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Repair the wording gap with one immediate plain-language gloss before advancing the proof.';
  }
  if (relation === 'field_without_dag') {
    return 'Convert the learner field movement into one public evidence claim or warrant.';
  }
  if (relation === 'dag_without_field') {
    return 'Recover learner agency and ownership around the proof step that just moved.';
  }
  if (relation === 'neither_progress') {
    return 'Change the interaction posture enough to make either learner agency or evidence use move next.';
  }
  if (selected === 'witnessing') return 'Lower affective risk while preserving one concrete check.';
  if (selected === 'charismatic') return 'Interrupt low-agency compliance and create a learner-owned public move.';
  if (selected === 'ironic') return 'Let the learner notice the mismatch without turning the learner into the target.';
  if (selected === 'sarcastic') return 'Test whether a dry edge disrupts rote performance while leaving a repair path.';
  if (selected === 'face_threat')
    return 'Measure whether local face threat changes uptake while preserving a minimal repair path.';
  if (selected === 'brisk') return 'Increase pace without turning the next inference into an answer dump.';
  if (selected === 'plain') return "Make the next move sayable in the learner's own words.";
  return 'Sharpen the learner field toward one accountable public statement.';
}

function buildFieldRegisterScores({ state, classification, tutorLearnerDag }) {
  const palette = state.register?.palette || [];
  const scores = Object.fromEntries(
    palette.map((register) => [register, FIELD_REGISTER_BASE_WEIGHTS[register] ?? 0.45]),
  );
  const drivers = [];
  const features = fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const signal = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ]
    .filter(Boolean)
    .join(' ');
  const comprehensionPressure = Number(features.comprehension?.pressure || 0);

  if (comprehensionPressure > 0) {
    addRegisterScore(scores, 'plain', 3.0 * comprehensionPressure, drivers, 'for comprehension-side-state gloss');
    addRegisterScore(scores, 'warm', 1.5 * comprehensionPressure, drivers, 'for low-pressure vocabulary repair');
    addRegisterScore(scores, 'precise', 0.5 * comprehensionPressure, drivers, 'for one exact definition');
    multiplyRegisterScore(
      scores,
      'charismatic',
      Math.max(0.15, 1 - 0.8 * comprehensionPressure),
      drivers,
      'comprehension pressure suppresses challenge',
    );
    multiplyRegisterScore(scores, 'ironic', 0.25, drivers, 'comprehension pressure suppresses irony');
    multiplyRegisterScore(scores, 'sarcastic', 0.1, drivers, 'comprehension pressure suppresses sarcasm');
    multiplyRegisterScore(scores, 'face_threat', 0.05, drivers, 'comprehension pressure suppresses face threat');
  }

  if (
    /conceptual_clarity_request|challenge|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported/iu.test(
      signal,
    )
  ) {
    addRegisterScore(scores, 'precise', 2.2, drivers, 'for distinction, warrant, or overreach');
    addRegisterScore(scores, 'ironic', 0.7, drivers, 'for visible mismatch');
  }
  if (/plain_language_request|plain_simplification_followup/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 2.4, drivers, 'for plain-language compression');
    addRegisterScore(scores, 'warm', 0.7, drivers, 'for low-friction re-entry');
  }
  if (/transfer_demand_or_named_material/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 1.2, drivers, 'for material grounding');
    addRegisterScore(scores, 'warm', 0.9, drivers, 'for lived continuity');
  }
  if (/vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu.test(signal)) {
    addRegisterScore(scores, 'witnessing', 3.0, drivers, 'for affective exposure');
    addRegisterScore(scores, 'warm', 1.3, drivers, 'for non-sentimental invitation');
  }
  if (/resistance_or_low_agency|resistant|answer_seeking|overconfident|passive|complying/iu.test(signal)) {
    addRegisterScore(scores, 'charismatic', 2.6, drivers, 'for low-agency or resistant posture');
    addRegisterScore(scores, 'ironic', 1.0, drivers, 'for rote-performance mismatch');
    addRegisterScore(scores, 'sarcastic', 0.55, drivers, 'for negative-register probe');
    addRegisterScore(scores, 'face_threat', 0.25, drivers, 'for simulated stress-test availability');
  }
  if (/off_task_or_mixed|off_task/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 1.0, drivers, 'for reset');
    addRegisterScore(scores, 'charismatic', 0.9, drivers, 'for sharper re-entry');
  }
  if (features.explicitStepwise || /release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck)) {
    addRegisterScore(scores, 'precise', 0.8, drivers, 'for immediate proof-state focus');
    if (features.explicitStepwise) {
      addRegisterScore(scores, 'brisk', 2.1, drivers, 'for explicit stepwise request');
    } else {
      addRegisterScore(scores, 'brisk', 0.35, drivers, 'for proof gap without explicit stepwise request');
    }
  }

  if (features.field.relation === 'field_without_dag') {
    addRegisterScore(scores, 'plain', 1.7, drivers, 'to convert field movement into a claim');
    addRegisterScore(scores, 'precise', 1.5, drivers, 'to make the warrant checkable');
  } else if (features.field.relation === 'dag_without_field') {
    addRegisterScore(scores, 'warm', 1.2, drivers, 'to recover learner ownership');
    addRegisterScore(scores, 'witnessing', 0.9, drivers, 'to lower agency risk');
    addRegisterScore(scores, 'plain', 1.0, drivers, 'to ask for say-back');
  } else if (features.field.relation === 'both_progress') {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'to consolidate dual progress');
    addRegisterScore(scores, 'brisk', 0.8, drivers, 'to preserve momentum');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'to keep the move portable');
  } else if (features.field.relation === 'neither_progress') {
    addRegisterScore(scores, 'charismatic', 1.4, drivers, 'to change a flat field');
    addRegisterScore(scores, 'ironic', 0.8, drivers, 'to expose a stuck mismatch');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'to reset without decoration');
  } else {
    addRegisterScore(scores, 'warm', 0.6, drivers, 'for first-turn invitation');
    addRegisterScore(scores, 'precise', 0.6, drivers, 'for first-turn warranting');
  }

  if (Number(features.field.delta) < -FIELD_PROGRESS_THRESHOLD) {
    addRegisterScore(scores, 'warm', 1.0, drivers, 'for negative field movement');
    addRegisterScore(scores, 'witnessing', 0.8, drivers, 'for increased learner risk');
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    addRegisterScore(scores, 'plain', 1.3, drivers, 'for closure');
    addRegisterScore(scores, 'precise', 1.0, drivers, 'for accountable closeout');
    multiplyRegisterScore(scores, 'sarcastic', 0.4, drivers, 'near closure');
    multiplyRegisterScore(scores, 'face_threat', 0.25, drivers, 'near closure');
  }

  const latest = latestRegisterSelection(state);
  if (latest?.selected_register) {
    const latestLabel = latest.efficacy?.label || features.latestEfficacy?.label || '';
    const factor = /regression_or_overreach/iu.test(latestLabel)
      ? 0.35
      : /no_clear_progress/iu.test(latestLabel)
        ? 0.55
        : 0.82;
    multiplyRegisterScore(scores, latest.selected_register, factor, drivers, 'recent repetition penalty');
  }
  for (const register of new Set(features.recentRegisters.filter(Boolean))) {
    if (recentRegisterCount(state, register) >= 2) {
      multiplyRegisterScore(scores, register, 0.5, drivers, 'last-four repetition penalty');
    }
  }
  if (!features.explicitStepwise) {
    multiplyRegisterScore(scores, 'brisk', 0.65, drivers, 'brisk remains non-default without explicit stepwise need');
  }

  return { features, scores, drivers };
}

function normalizeEngagementStanceDistribution(scores, { temperature = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE } = {}) {
  const sourceScores = Object.fromEntries(
    Object.entries(scores || {}).map(([register, weight]) => [register, Math.max(0.02, Number(weight) || 0)]),
  );
  const temperedScores = temperTutorStubEngagementStanceScores(sourceScores, { temperature });
  const weighted = Object.entries(temperedScores)
    .map(([register, weight]) => ({
      register,
      sourceWeight: sourceScores[register],
      weight,
    }))
    .sort((a, b) => b.weight - a.weight || a.register.localeCompare(b.register));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return weighted.map((entry) => ({
    register: entry.register,
    weight: roundField(entry.weight),
    sourceWeight: roundField(entry.sourceWeight),
    probability: Number((entry.weight / total).toFixed(4)),
  }));
}

function sampleEngagementStanceDistribution(distribution) {
  const total = distribution.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const randomValue = Math.random();
  const threshold = randomValue * total;
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.weight;
    if (threshold <= cumulative) {
      return {
        entry,
        random: {
          method: 'Math.random',
          value: Number(randomValue.toFixed(6)),
          threshold: Number(threshold.toFixed(6)),
        },
      };
    }
  }
  return {
    entry: distribution[distribution.length - 1],
    random: {
      method: 'Math.random',
      value: Number(randomValue.toFixed(6)),
      threshold: Number(threshold.toFixed(6)),
    },
  };
}

function formatEngagementStanceDistribution(distribution, { limit = 5 } = {}) {
  const entries = Array.isArray(distribution) ? distribution : [];
  if (!entries.length) return '';
  return entries
    .slice(0, limit)
    .map((entry) => `${entry.register}:${Math.round(Number(entry.probability || 0) * 100)}%`)
    .join(', ');
}

function fieldEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
  const { features, scores, drivers } = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = sampleEngagementStanceDistribution(distribution);
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base field-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `Field policy sampled from local engagement-stance distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : features.field.relation === 'field_without_dag'
        ? 'Elicit one public evidence claim that converts learner-field movement into proof-state movement.'
        : 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should show movement in agency, evidence use, epistemic stance, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'field_register_policy',
    distribution,
    selected_probability: selectedProbability,
    field_policy: {
      schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function finiteNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundOptionalField(value) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? null : roundField(numeric);
}

function numberOr(value, fallback = 0) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? fallback : numeric;
}

function dagProgressScalar(features) {
  const score =
    numberOr(features.bestPathCoverage) * 4 +
    numberOr(features.groundedCount) +
    numberOr(features.voicedDerivedCount) * 2 +
    numberOr(features.candidateConclusionCount) +
    numberOr(features.answerCandidateCount) * 3 -
    numberOr(features.missingPremiseCount) * 0.15 -
    numberOr(features.unsupportedAssertionCount) * 0.8;
  return roundField(score);
}

function dagRiskScalar(features) {
  const prematureAnswerRisk = features.assertedSecret && !features.finalSecretEntailed ? 2 : 0;
  return roundField(
    numberOr(features.missingPremiseCount) * 0.25 +
      numberOr(features.unsupportedAssertionCount) * 1.25 +
      prematureAnswerRisk,
  );
}

function trajectoryPointFromTurn(turn, index) {
  const fieldPoint = turn?.classification ? learnerSurfaceFieldPoint(turn.classification) : null;
  const dag = dagProgressFeatures(turn?.tutorLearnerDagModel || null);
  return {
    turn: Number.isFinite(Number(turn?.turn)) ? Number(turn.turn) : index + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dagProgressScalar(dag),
    riskScore: dagRiskScalar(dag),
    bottleneck: turn?.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
  };
}

function trajectoryPointFromCurrent({ state, classification, tutorLearnerDag }) {
  const fieldPoint = learnerSurfaceFieldPoint(classification);
  const dag = dagProgressFeatures(tutorLearnerDag?.model || null);
  return {
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dagProgressScalar(dag),
    riskScore: dagRiskScalar(dag),
    bottleneck: tutorLearnerDag?.model?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
  };
}

function finitePointValues(points, key) {
  return points
    .map((point, index) => ({
      x: index,
      y: finiteNumberOrNull(point?.[key]),
    }))
    .filter((point) => point.y !== null);
}

function linearTrajectorySlope(points, key) {
  const values = finitePointValues(points, key);
  if (values.length < 2) return null;
  const meanX = values.reduce((sum, point) => sum + point.x, 0) / values.length;
  const meanY = values.reduce((sum, point) => sum + point.y, 0) / values.length;
  const denominator = values.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const numerator = values.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  return numerator / denominator;
}

function latestTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 2) return null;
  return values.at(-1) - values.at(-2);
}

function previousTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 3) return null;
  return values.at(-2) - values.at(-3);
}

function trajectoryMetric(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  const velocity = latestTrajectoryDelta(points, key);
  const previousVelocity = previousTrajectoryDelta(points, key);
  const acceleration = velocity !== null && previousVelocity !== null ? velocity - previousVelocity : null;
  return {
    current: roundOptionalField(values.at(-1)),
    previous: roundOptionalField(values.length >= 2 ? values.at(-2) : null),
    velocity: roundOptionalField(velocity),
    previousVelocity: roundOptionalField(previousVelocity),
    acceleration: roundOptionalField(acceleration),
    slope: roundOptionalField(linearTrajectorySlope(points, key)),
  };
}

function buildTrajectoryWindow({ state, classification, tutorLearnerDag, window = 4 }) {
  const historical = (state.turns || [])
    .filter((turn) => turn?.classification || turn?.tutorLearnerDagModel)
    .slice(-window)
    .map((turn, index) => trajectoryPointFromTurn(turn, index));
  const points = [...historical, trajectoryPointFromCurrent({ state, classification, tutorLearnerDag })];
  const field = trajectoryMetric(points, 'fieldScore');
  const dag = trajectoryMetric(points, 'dagScore');
  const risk = trajectoryMetric(points, 'riskScore');
  const currentDag = points.at(-1)?.dag || {};
  const fieldSlope = numberOr(field.slope);
  const dagSlope = numberOr(dag.slope);
  const riskSlope = numberOr(risk.slope);
  const fieldVelocity = numberOr(field.velocity);
  const dagVelocity = numberOr(dag.velocity);
  const riskVelocity = numberOr(risk.velocity);
  const flags = {
    plateau: points.length >= 3 && Math.abs(fieldSlope) < 0.025 && Math.abs(dagSlope) < 0.25 && riskSlope >= -0.15,
    fieldRegression: points.length >= 2 && (fieldVelocity < -0.04 || fieldSlope < -0.025),
    riskRising: points.length >= 2 && (riskVelocity > 0.35 || riskSlope > 0.18),
    fieldOnlyDrift: points.length >= 3 && fieldSlope > 0.025 && dagSlope <= 0.2,
    dagOnlyDrift: points.length >= 3 && dagSlope > 0.25 && fieldSlope < 0.015,
    stableConvergence: points.length >= 3 && dagSlope > 0.2 && fieldSlope >= -0.015 && riskSlope <= 0.1,
    coerciveProgress:
      points.length >= 2 &&
      (dagVelocity > 0.9 || dagSlope > 0.45) &&
      (fieldVelocity < -0.02 || fieldSlope < -0.02 || riskVelocity > 0.4 || riskSlope > 0.18),
    noisyAcceleration:
      points.length >= 3 &&
      (Math.abs(numberOr(field.acceleration)) > 0.08 ||
        Math.abs(numberOr(dag.acceleration)) > 1.25 ||
        Math.abs(numberOr(risk.acceleration)) > 0.75),
    nearClosure:
      currentDag.finalSecretEntailed === true ||
      currentDag.assertedSecret === true ||
      numberOr(currentDag.bestPathCoverage) >= 0.8,
  };
  return {
    schema: 'machinespirits.tutor-stub.register-trajectory.v1',
    window,
    pointCount: points.length,
    points: points.map((point) => ({
      turn: point.turn,
      fieldScore: roundOptionalField(point.fieldScore),
      dagScore: roundOptionalField(point.dagScore),
      riskScore: roundOptionalField(point.riskScore),
      bottleneck: point.bottleneck,
    })),
    field,
    dag,
    risk,
    flags,
  };
}

function trajectoryRiskFlags(trajectory) {
  return Object.entries(trajectory.flags || {})
    .filter(([, value]) => value)
    .map(([key]) => `trajectory_${key}`);
}

function expectedTrajectoryDagMove(features, trajectory) {
  const flags = trajectory.flags || {};
  if (flags.coerciveProgress) {
    return 'Hold proof-state progress until the learner can own the warrant without rising recognition risk.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Convert improving learner posture into one public evidence adoption or warranted claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Ask the learner to explain the proof step already moving in the learner-DAG.';
  }
  if (flags.plateau) {
    return 'Change the local posture enough to create either learner-field movement or proof-state movement.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Close the proof path by having the learner state the public warrant for the answer.';
  }
  return 'Elicit one public, checkable learner move that changes the recent learner-field or learner-DAG trajectory.';
}

function expectedTrajectoryMoveForRegister(selected, features, trajectory) {
  const flags = trajectory.flags || {};
  if (flags.coerciveProgress) {
    return 'Trade speed for learner ownership: reduce risk while keeping one accountable public check.';
  }
  if (flags.riskRising) {
    return 'Lower rising field risk before asking for another proof-state advance.';
  }
  if (flags.plateau) {
    return 'Break a flat recent trajectory with a different learner-owned commitment.';
  }
  if (flags.fieldRegression) {
    return 'Recover agency, evidence use, or epistemic stance after negative field movement.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Turn improved orientation into a sayable public claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Make the learner own the proof movement already appearing in the DAG.';
  }
  if (flags.stableConvergence) {
    return 'Preserve convergent field and DAG momentum without overprompting.';
  }
  return expectedFieldMoveForRegister(selected, features);
}

function buildTrajectoryRegisterScores({ state, classification, tutorLearnerDag }) {
  const base = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
  const scores = { ...base.scores };
  const drivers = [...base.drivers];
  const trajectory = buildTrajectoryWindow({ state, classification, tutorLearnerDag });
  const flags = trajectory.flags || {};

  if (trajectory.pointCount < 3) {
    drivers.push('trajectory baseline: fewer than three points, mostly field policy');
  }
  if (flags.plateau) {
    addRegisterScore(scores, 'charismatic', 1.4, drivers, 'for flat recent trajectory');
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for plateau warrant focus');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'for plateau reset');
    addRegisterScore(scores, 'ironic', 0.35, drivers, 'for visible stuckness');
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'plateau is not a pacing problem');
  }
  if (flags.coerciveProgress) {
    addRegisterScore(scores, 'warm', 1.4, drivers, 'for coercive progress risk');
    addRegisterScore(scores, 'witnessing', 1.1, drivers, 'for proof movement without ownership');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for learner-owned say-back');
    addRegisterScore(scores, 'precise', 0.4, drivers, 'for accountable warrant');
    multiplyRegisterScore(scores, 'brisk', 0.4, drivers, 'coercive trajectory dampens speed');
    multiplyRegisterScore(scores, 'charismatic', 0.65, drivers, 'coercive trajectory dampens pressure');
    multiplyRegisterScore(scores, 'sarcastic', 0.25, drivers, 'coercive trajectory dampens negative register');
    multiplyRegisterScore(scores, 'face_threat', 0.15, drivers, 'coercive trajectory dampens negative register');
  } else if (flags.dagOnlyDrift) {
    addRegisterScore(scores, 'warm', 1.0, drivers, 'for DAG movement without field movement');
    addRegisterScore(scores, 'witnessing', 0.7, drivers, 'for ownership recovery');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for proof say-back');
  }
  if (flags.fieldOnlyDrift) {
    addRegisterScore(scores, 'plain', 1.2, drivers, 'for field movement awaiting proof-state conversion');
    addRegisterScore(scores, 'precise', 1.1, drivers, 'for trajectory warrant conversion');
    addRegisterScore(scores, 'brisk', 0.3, drivers, 'for convergent field-to-DAG handoff');
  }
  if (flags.stableConvergence && !flags.coerciveProgress) {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for stable field/DAG convergence');
    addRegisterScore(scores, 'plain', 0.7, drivers, 'for portable consolidation');
    addRegisterScore(scores, 'brisk', 0.45, drivers, 'for controlled convergent momentum');
  }
  if (flags.riskRising) {
    addRegisterScore(scores, 'warm', 1.2, drivers, 'for rising trajectory risk');
    addRegisterScore(scores, 'witnessing', 1.0, drivers, 'for rising affective or warrant risk');
    addRegisterScore(scores, 'precise', 0.8, drivers, 'for risk-bounded warrant check');
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'risk rising dampens speed');
    multiplyRegisterScore(scores, 'sarcastic', 0.35, drivers, 'risk rising dampens negative register');
    multiplyRegisterScore(scores, 'face_threat', 0.2, drivers, 'risk rising dampens negative register');
  }
  if (flags.fieldRegression) {
    addRegisterScore(scores, 'warm', 0.8, drivers, 'for learner-field regression');
    addRegisterScore(scores, 'witnessing', 0.7, drivers, 'for learner-field regression');
    addRegisterScore(scores, 'plain', 0.5, drivers, 'for regression reset');
  }
  if (flags.noisyAcceleration) {
    addRegisterScore(scores, 'plain', 0.6, drivers, 'for unstable trajectory');
    addRegisterScore(scores, 'warm', 0.5, drivers, 'for unstable trajectory');
    multiplyRegisterScore(scores, 'brisk', 0.7, drivers, 'unstable trajectory dampens speed');
    multiplyRegisterScore(scores, 'face_threat', 0.4, drivers, 'unstable trajectory dampens stress');
  }
  if (flags.nearClosure && !flags.riskRising) {
    addRegisterScore(scores, 'plain', 1.1, drivers, 'for near-closure trajectory');
    addRegisterScore(scores, 'precise', 1.0, drivers, 'for near-closure warrant');
    multiplyRegisterScore(scores, 'sarcastic', 0.35, drivers, 'near-closure trajectory');
    multiplyRegisterScore(scores, 'face_threat', 0.2, drivers, 'near-closure trajectory');
  }

  return {
    features: base.features,
    trajectory,
    scores,
    drivers,
    baseScores: base.scores,
    baseDrivers: base.drivers,
  };
}

function trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
  const { features, trajectory, scores, drivers, baseScores, baseDrivers } = buildTrajectoryRegisterScores({
    state,
    classification,
    tutorLearnerDag,
  });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = sampleEngagementStanceDistribution(distribution);
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 6).join('; ') || 'trajectory policy used field baseline only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; fieldSlope=${trajectory.field.slope ?? 'n/a'}; dagSlope=${
      trajectory.dag.slope ?? 'n/a'
    }; riskSlope=${trajectory.risk.slope ?? 'n/a'}`,
    register_reason: `Trajectory policy sampled from field baseline plus recent finite-difference dynamics. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: trajectoryRiskFlags(trajectory),
    expected_dag_move: expectedTrajectoryDagMove(features, trajectory),
    expected_field_move: expectedTrajectoryMoveForRegister(selected, features, trajectory),
    expected_progress_marker:
      'Next learner turn should improve the recent trajectory: field score, proof coverage, ownership, or risk trend.',
    confidence: selectedProbability,
    source: 'trajectory_register_policy',
    distribution,
    selected_probability: selectedProbability,
    trajectory_policy: {
      schema: 'machinespirits.tutor-stub.trajectory-register-policy.v1',
      base_field_schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      trajectory,
      base_scores: Object.fromEntries(
        Object.entries(baseScores).map(([register, score]) => [register, roundField(score)]),
      ),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      base_drivers: baseDrivers,
      drivers,
      random: sampled.random,
    },
  };
}

const DYNAMICAL_SYSTEM_TEMPERATURE = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
const DYNAMICAL_SYSTEM_BASE_WEIGHTS = {
  plain: 1.05,
  precise: 1.1,
  brisk: 0.55,
  warm: 0.9,
  witnessing: 0.5,
  charismatic: 0.75,
  ironic: 0.2,
  sarcastic: 0.05,
  face_threat: 0.02,
};

const DYNAMICAL_SYSTEM_REGISTER_AFFINITY = {
  plain: {
    evidence_gap: 0.45,
    agency_deficit: 0.45,
    integration_need: 1.35,
    compression_need: 1.4,
    language_opacity: 1.8,
    closure_pressure: 0.75,
    empirical_uncertainty: 0.25,
  },
  precise: {
    evidence_gap: 1.0,
    warrant_gap: 1.65,
    integration_need: 0.45,
    language_opacity: 0.4,
    momentum: 0.4,
    closure_pressure: 1.0,
    empirical_uncertainty: 0.15,
  },
  brisk: {
    evidence_gap: 0.4,
    momentum: 1.35,
    tempo_affordance: 1.9,
    closure_pressure: 0.35,
    affective_risk: -1.15,
    coercion_risk: -1.35,
    empirical_uncertainty: -0.45,
    language_opacity: -0.8,
  },
  warm: {
    evidence_gap: 0.2,
    agency_deficit: 0.95,
    affective_risk: 1.55,
    recognition_pressure: 0.65,
    coercion_risk: 1.25,
    field_regression: 0.85,
    language_opacity: 1.2,
  },
  witnessing: {
    agency_deficit: 0.5,
    affective_risk: 1.9,
    recognition_pressure: 0.75,
    coercion_risk: 1.65,
    field_regression: 0.7,
    momentum: -0.55,
    closure_pressure: -0.25,
    language_opacity: 0.2,
  },
  charismatic: {
    agency_deficit: 1.35,
    recognition_pressure: 0.85,
    stagnation: 1.2,
    disruption_need: 1.15,
    integration_need: 0.25,
    affective_risk: -0.45,
    coercion_risk: -0.65,
    language_opacity: -2.0,
  },
  ironic: {
    warrant_gap: 0.7,
    stagnation: 0.75,
    disruption_need: 0.9,
    recognition_pressure: 0.25,
    affective_risk: -0.9,
    coercion_risk: -0.85,
    empirical_uncertainty: -0.25,
    language_opacity: -1.5,
  },
  sarcastic: {
    warrant_gap: 0.2,
    stagnation: 0.35,
    disruption_need: 0.35,
    affective_risk: -1.5,
    coercion_risk: -1.5,
    closure_pressure: -0.55,
    empirical_uncertainty: -0.7,
    language_opacity: -2.0,
  },
  face_threat: {
    agency_deficit: 0.15,
    disruption_need: 0.2,
    affective_risk: -2.0,
    coercion_risk: -2.0,
    closure_pressure: -0.8,
    empirical_uncertainty: -1.0,
    language_opacity: -2.5,
  },
};

function axisValue(value, fallback = 0.5) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? fallback : clampField01(numeric);
}

function signalMatches(pattern, values) {
  return pattern.test(values.filter(Boolean).join(' '));
}

function positivePart(value, scale = 1) {
  const numeric = finiteNumberOrNull(value);
  if (numeric === null) return 0;
  return Math.max(0, numeric * scale);
}

function topNumericEntries(object, { limit = 5, abs = false } = {}) {
  return Object.entries(object || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => {
      const av = abs ? Math.abs(Number(a[1])) : Number(a[1]);
      const bv = abs ? Math.abs(Number(b[1])) : Number(b[1]);
      return bv - av || a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([key, value]) => `${key}=${roundField(value)}`);
}

function buildDynamicalSystemState({ state, classification, tutorLearnerDag }) {
  const features = fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const trajectory = buildTrajectoryWindow({ state, classification, tutorLearnerDag });
  const dims = features.field?.dimensions || {};
  const conceptual = axisValue(dims.conceptual);
  const epistemic = axisValue(dims.epistemic);
  const evidence = axisValue(dims.evidence);
  const agency = axisValue(dims.agency);
  const bestPathCoverage = axisValue(features.dag.bestPathCoverage, 0);
  const missingNeed = clampField01(numberOr(features.dag.missingPremiseCount) / 6);
  const unsupportedNeed = clampField01(numberOr(features.dag.unsupportedAssertionCount) / 3);
  const signalValues = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ];
  const requestSignal = signalValues.join(' ');
  const flags = trajectory.flags || {};
  const explicitAffective = signalMatches(
    /vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu,
    signalValues,
  );
  const answerSeeking = signalMatches(/answer_seeking|overconfident|passive|complying/iu, signalValues);
  const resistance = signalMatches(/resistance_or_low_agency|resistant|challenge|authority_refusal/iu, signalValues);
  const plainNeed = signalMatches(
    /plain_language_request|plain_simplification_followup|transfer_demand_or_named_material/iu,
    signalValues,
  );
  const languageOpacity = clampField01(Number(features.comprehension?.languageOpacity || 0));
  const overreach = signalMatches(
    /omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported|premature_assertion/iu,
    signalValues,
  );
  const learnerIntegrationGap = features.dag.bottleneck === 'learner_integration_gap';
  const assertionGap = features.dag.bottleneck === 'assertion_gap';
  const releaseGap = /release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck);
  const surface = meanFinite([conceptual, epistemic, evidence, agency]) ?? 0.5;
  const lowSurface = clampField01(1 - surface);

  const affectiveRisk = clampField01(
    (explicitAffective ? 0.5 : 0) +
      (flags.riskRising ? 0.25 : 0) +
      (flags.fieldRegression ? 0.2 : 0) +
      clampField01(numberOr(trajectory.risk?.current) / 3) * 0.2,
  );
  const coercionRisk = clampField01(
    (flags.coerciveProgress ? 0.55 : 0) +
      (flags.dagOnlyDrift ? 0.2 : 0) +
      (answerSeeking ? 0.15 : 0) +
      affectiveRisk * 0.2,
  );
  const agencyDeficit = clampField01(1 - agency + (answerSeeking ? 0.25 : 0) + (resistance ? 0.15 : 0));
  const evidenceGap = clampField01(
    (1 - bestPathCoverage) * 0.45 + missingNeed * 0.35 + (1 - evidence) * 0.15 + (releaseGap ? 0.15 : 0),
  );
  const warrantGap = clampField01(
    unsupportedNeed * 0.35 +
      (overreach ? 0.3 : 0) +
      (features.dag.assertedSecret && !features.dag.finalSecretEntailed ? 0.3 : 0) +
      (assertionGap ? 0.25 : 0) +
      (1 - epistemic) * 0.1,
  );
  const recognitionPressure = clampField01(
    agencyDeficit * 0.35 +
      (resistance ? 0.25 : 0) +
      (answerSeeking ? 0.25 : 0) +
      coercionRisk * 0.25 +
      affectiveRisk * 0.15,
  );
  const integrationNeed = clampField01(
    lowSurface * 0.35 +
      (flags.fieldOnlyDrift ? 0.25 : 0) +
      (learnerIntegrationGap ? 0.25 : 0) +
      (plainNeed ? 0.2 : 0) +
      languageOpacity * 0.25,
  );
  const compressionNeed = clampField01(
    (plainNeed ? 0.5 : 0) +
      languageOpacity * 0.35 +
      lowSurface * 0.35 +
      (features.dag.finalSecretEntailed ? 0.15 : 0),
  );
  const momentum = clampField01(
    positivePart(trajectory.field?.slope, 4) * 0.2 +
      positivePart(trajectory.dag?.slope, 0.5) * 0.25 +
      (flags.stableConvergence ? 0.35 : 0) +
      (features.explicitStepwise ? 0.2 : 0) -
      affectiveRisk * 0.25 -
      coercionRisk * 0.25,
  );
  const stagnation = clampField01(
    (flags.plateau ? 0.5 : 0) +
      (features.field.relation === 'neither_progress' ? 0.25 : 0) +
      (latestRegisterEfficacy(state)?.label === 'no_clear_progress' ? 0.2 : 0) +
      (Math.abs(numberOr(trajectory.field?.velocity)) < 0.02 && Math.abs(numberOr(trajectory.dag?.velocity)) < 0.2
        ? 0.15
        : 0),
  );
  const closurePressure = clampField01(
    (flags.nearClosure ? 0.45 : 0) +
      bestPathCoverage * 0.35 +
      (assertionGap ? 0.2 : 0) +
      (features.dag.finalSecretEntailed ? 0.25 : 0),
  );
  const disruptionNeed = clampField01(
    stagnation * 0.5 + (resistance ? 0.25 : 0) + agencyDeficit * 0.2 - affectiveRisk * 0.35 - coercionRisk * 0.35,
  );
  const tempoAffordance = clampField01(
    momentum * (1 - affectiveRisk) * (1 - coercionRisk) + (features.explicitStepwise ? 0.25 : 0),
  );
  const fieldRegression = clampField01(
    (flags.fieldRegression ? 0.6 : 0) + Math.max(0, -numberOr(trajectory.field?.velocity)) * 3,
  );
  const empiricalEvidenceCount = (state.register?.history || []).filter((entry) => entry.efficacy).length;
  const empiricalUncertainty = clampField01(1 - Math.min(1, empiricalEvidenceCount / 4));

  const stateVector = {
    evidence_gap: evidenceGap,
    warrant_gap: warrantGap,
    agency_deficit: agencyDeficit,
    affective_risk: affectiveRisk,
    recognition_pressure: recognitionPressure,
    coercion_risk: coercionRisk,
    integration_need: integrationNeed,
    compression_need: compressionNeed,
    language_opacity: languageOpacity,
    momentum,
    stagnation,
    disruption_need: disruptionNeed,
    tempo_affordance: tempoAffordance,
    closure_pressure: closurePressure,
    field_regression: fieldRegression,
    empirical_uncertainty: empiricalUncertainty,
  };
  const derivativeVector = {
    field_velocity: trajectory.field.velocity,
    field_slope: trajectory.field.slope,
    field_acceleration: trajectory.field.acceleration,
    dag_velocity: trajectory.dag.velocity,
    dag_slope: trajectory.dag.slope,
    dag_acceleration: trajectory.dag.acceleration,
    risk_velocity: trajectory.risk.velocity,
    risk_slope: trajectory.risk.slope,
    risk_acceleration: trajectory.risk.acceleration,
  };
  const attractors = {
    recognition_safety: roundField(Math.max(affectiveRisk, coercionRisk)),
    learner_ownership: roundField(Math.max(agencyDeficit, flags.dagOnlyDrift ? 0.7 : 0)),
    evidence_grounding: roundField(Math.max(evidenceGap, warrantGap)),
    accountable_closure: closurePressure,
    productive_disruption: disruptionNeed,
    controlled_pace: tempoAffordance,
  };
  return {
    schema: 'machinespirits.tutor-stub.dynamical-system-state.v1',
    features,
    trajectory,
    raw_signal: requestSignal,
    state_vector: Object.fromEntries(Object.entries(stateVector).map(([key, value]) => [key, roundField(value)])),
    derivative_vector: derivativeVector,
    attractors,
  };
}

function empiricalRegisterCorrections(state, palette) {
  const corrections = Object.fromEntries((palette || []).map((register) => [register, 0]));
  const evidence = [];
  const entries = (state.register?.history || [])
    .map((entry) => normalizeStoredRegisterSelection(entry))
    .filter((entry) => entry?.selected_register && entry.efficacy && corrections[entry.selected_register] !== undefined)
    .slice(-8);
  entries.forEach((entry, index) => {
    const efficacy = normalizeStoredRegisterEfficacy(entry.efficacy);
    const recency = (index + 1) / entries.length;
    const progress = Math.max(-1, Math.min(1, numberOr(efficacy.progressScore) / 4));
    const fieldDelta = Math.max(-1, Math.min(1, numberOr(efficacy.field?.delta) * 4));
    const labelAdjustment =
      efficacy.label === 'positive_progress' ? 0.15 : efficacy.label === 'regression_or_overreach' ? -0.35 : -0.08;
    const update = recency * (0.45 * progress + 0.25 * fieldDelta + labelAdjustment);
    corrections[entry.selected_register] += update;
    evidence.push({
      turn: entry.turn,
      register: entry.selected_register,
      label: efficacy.label,
      progressScore: efficacy.progressScore,
      fieldDelta: efficacy.field?.delta ?? null,
      correction: roundField(update),
    });
  });
  return {
    schema: 'machinespirits.tutor-stub.register-empirical-corrections.v1',
    source: 'within_dialogue_next_turn_efficacy',
    corrections: Object.fromEntries(
      Object.entries(corrections).map(([register, value]) => [register, roundField(value)]),
    ),
    evidence,
  };
}

function emptyCorpusRegisterCorrections(palette, reason = 'not_enabled') {
  return {
    schema: 'machinespirits.tutor-stub.corpus-register-corrections.v1',
    enabled: false,
    reason,
    corrections: Object.fromEntries((palette || []).map((register) => [register, 0])),
    evidence: [],
  };
}

function corpusContextKeys(features) {
  return [
    features.requestType ? `request_type:${features.requestType}` : null,
    features.discourseMove ? `discourse_move:${features.discourseMove}` : null,
    features.evidenceUse ? `evidence_use:${features.evidenceUse}` : null,
    features.epistemicStance ? `epistemic_stance:${features.epistemicStance}` : null,
    features.agency ? `agency:${features.agency}` : null,
    features.dag?.bottleneck ? `bottleneck:${features.dag.bottleneck}` : null,
  ].filter(Boolean);
}

function corpusPriorRowAdjustment(row) {
  return numberOr(row?.logitAdjustment);
}

function corpusEmpiricalRegisterCorrections({ state, palette, system, features, enabled }) {
  if (!enabled) return emptyCorpusRegisterCorrections(palette);
  const prior = state.register?.empiricalPrior || null;
  if (!prior) return emptyCorpusRegisterCorrections(palette, 'missing_prior');
  const corrections = Object.fromEntries((palette || []).map((register) => [register, 0]));
  const evidence = [];
  const contextKeys = corpusContextKeys(features);
  const highAxes = Object.entries(system.state_vector || {}).filter(([, value]) => Number(value) >= 0.55);

  for (const register of palette || []) {
    const overall = prior.registerPriors?.[register] || null;
    if (overall) {
      const adjustment = corpusPriorRowAdjustment(overall);
      corrections[register] += adjustment;
      evidence.push({
        type: 'overall',
        register,
        n: overall.n,
        meanOutcome: overall.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
    for (const [axis, value] of highAxes) {
      const row = prior.axisPriors?.[axis]?.[register] || null;
      if (!row) continue;
      const adjustment = Number(value) * corpusPriorRowAdjustment(row);
      corrections[register] += adjustment;
      evidence.push({
        type: 'axis',
        axis,
        register,
        value: roundField(value),
        n: row.n,
        meanOutcome: row.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
    for (const key of contextKeys) {
      const row = prior.contextPriors?.[key]?.[register] || null;
      if (!row) continue;
      const adjustment = corpusPriorRowAdjustment(row);
      corrections[register] += adjustment;
      evidence.push({
        type: 'context',
        key,
        register,
        n: row.n,
        meanOutcome: row.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
  }

  return {
    schema: 'machinespirits.tutor-stub.corpus-register-corrections.v1',
    enabled: true,
    priorSchema: prior.schema || null,
    generatedAt: prior.generatedAt || null,
    source: prior.source || null,
    contextKeys,
    highAxes: highAxes.map(([axis, value]) => ({ axis, value: roundField(value) })),
    corrections: Object.fromEntries(
      Object.entries(corrections).map(([register, value]) => [register, roundField(value)]),
    ),
    evidence: evidence.sort((a, b) => Math.abs(numberOr(b.adjustment)) - Math.abs(numberOr(a.adjustment))).slice(0, 30),
  };
}

function registerAffinityContributions(register, stateVector) {
  const affinity = DYNAMICAL_SYSTEM_REGISTER_AFFINITY[register] || {};
  return Object.entries(affinity)
    .map(([axis, weight]) => ({
      axis,
      weight,
      value: numberOr(stateVector[axis]),
      contribution: numberOr(stateVector[axis]) * Number(weight),
    }))
    .filter((row) => row.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.axis.localeCompare(b.axis));
}

function dynamicalGuardAdjustment(register, system, features, drivers) {
  const vector = system.state_vector || {};
  let adjustment = 0;
  const comprehensionPressure = numberOr(features.comprehension?.pressure);
  if (comprehensionPressure > 0 && register === 'charismatic') {
    adjustment -= 1.5 * comprehensionPressure;
    drivers.push(`charismatic-${roundField(1.5 * comprehensionPressure)} comprehension-pressure guard`);
  }
  if (comprehensionPressure > 0 && ['ironic', 'sarcastic', 'face_threat'].includes(register)) {
    adjustment -= 1.8 * comprehensionPressure;
    drivers.push(`${register}-${roundField(1.8 * comprehensionPressure)} comprehension-pressure guard`);
  }
  if (register === 'brisk' && !features.explicitStepwise) {
    adjustment -= 0.45;
    drivers.push('brisk-0.45 no explicit stepwise request');
  }
  if (register === 'brisk' && (numberOr(vector.affective_risk) > 0.55 || numberOr(vector.coercion_risk) > 0.45)) {
    adjustment -= 0.7;
    drivers.push('brisk-0.70 high safety/coercion risk');
  }
  if (['ironic', 'sarcastic', 'face_threat'].includes(register) && numberOr(vector.affective_risk) > 0.45) {
    adjustment -= register === 'ironic' ? 0.55 : 1.05;
    drivers.push(`${register}-${register === 'ironic' ? '0.55' : '1.05'} affective risk guard`);
  }
  if (['sarcastic', 'face_threat'].includes(register) && numberOr(vector.coercion_risk) > 0.35) {
    adjustment -= 1.1;
    drivers.push(`${register}-1.10 coercion risk guard`);
  }
  if (['sarcastic', 'face_threat'].includes(register) && numberOr(vector.empirical_uncertainty) > 0.5) {
    adjustment -= 0.45;
    drivers.push(`${register}-0.45 empirical uncertainty guard`);
  }
  if (features.dag.finalSecretEntailed && ['sarcastic', 'face_threat'].includes(register)) {
    adjustment -= 0.7;
    drivers.push(`${register}-0.70 closure guard`);
  }
  return adjustment;
}

function logitsToRegisterScores(logits, { temperature = DYNAMICAL_SYSTEM_TEMPERATURE } = {}) {
  const entries = Object.entries(logits);
  const maxLogit = entries.reduce((max, [, value]) => Math.max(max, Number(value)), Number.NEGATIVE_INFINITY);
  return Object.fromEntries(
    entries.map(([register, logit]) => [register, Math.exp((Number(logit) - maxLogit) / temperature) * 10]),
  );
}

function buildDynamicalSystemRegisterScores({ state, classification, tutorLearnerDag, useCorpusPrior = false }) {
  const system = buildDynamicalSystemState({ state, classification, tutorLearnerDag });
  const features = system.features;
  const trajectory = system.trajectory;
  const palette = state.register?.palette || [];
  const empirical = empiricalRegisterCorrections(state, palette);
  const corpusEmpirical = corpusEmpiricalRegisterCorrections({
    state,
    palette,
    system,
    features,
    enabled: useCorpusPrior,
  });
  const logits = {};
  const drivers = [
    `state: ${topNumericEntries(system.state_vector, { limit: 5 }).join(', ') || 'none'}`,
    `derivatives: fieldSlope=${trajectory.field.slope ?? 'n/a'}, dagSlope=${trajectory.dag.slope ?? 'n/a'}, riskSlope=${
      trajectory.risk.slope ?? 'n/a'
    }`,
  ];

  for (const register of palette) {
    const base = Math.max(0.01, DYNAMICAL_SYSTEM_BASE_WEIGHTS[register] ?? 0.25);
    const affinity = DYNAMICAL_SYSTEM_REGISTER_AFFINITY[register] || {};
    let logit = Math.log(base);
    for (const [axis, value] of Object.entries(system.state_vector)) {
      logit += numberOr(value) * numberOr(affinity[axis]);
    }
    logit += numberOr(empirical.corrections[register]);
    logit += numberOr(corpusEmpirical.corrections[register]);
    logit += dynamicalGuardAdjustment(register, system, features, drivers);
    const recentCount = recentRegisterCount(state, register, { limit: 4 });
    if (recentCount >= 2) {
      logit -= 0.45;
      drivers.push(`${register}-0.45 repeated in recent window`);
    } else if (latestRegisterSelection(state)?.selected_register === register) {
      logit -= 0.25;
      drivers.push(`${register}-0.25 immediate repetition`);
    }
    logits[register] = logit;
  }

  return {
    features,
    trajectory,
    system,
    empirical,
    corpusEmpirical,
    logits,
    scores: logitsToRegisterScores(logits, { temperature: state.register?.temperature }),
    drivers,
  };
}

function dynamicalSystemRiskFlags(system) {
  return Object.entries(system.state_vector || {})
    .filter(([key, value]) => Number(value) >= 0.7 && /risk|coercion|stagnation|regression|gap|deficit/iu.test(key))
    .map(([key]) => `dynamical_${key}`);
}

function expectedDynamicalDagMove(features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Hold proof-state advancement while the tutor repairs the learner-visible wording gap.';
  }
  if (numberOr(vector.coercion_risk) > 0.55) {
    return 'Stabilize learner ownership before taking more proof-state progress.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Elicit one public warrant that makes the current claim accountable.';
  }
  if (numberOr(vector.evidence_gap) > 0.6) {
    return 'Move one missing public premise into the learner-owned record.';
  }
  if (numberOr(vector.closure_pressure) > 0.65) {
    return 'Close by having the learner state the public evidence chain for the answer.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Convert near-closure into a public, warranted final statement.';
  }
  return 'Move the system toward evidence grounding, learner ownership, or accountable closure.';
}

function expectedDynamicalMoveForRegister(selected, features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Gloss the unresolved or recently queried term before applying further proof pressure.';
  }
  if (numberOr(vector.affective_risk) > 0.6 || numberOr(vector.coercion_risk) > 0.55) {
    return 'Reduce safety or coercion pressure while preserving one checkable public move.';
  }
  if (numberOr(vector.agency_deficit) > 0.65) {
    return 'Increase learner-owned commitment instead of supplying the next inference.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Turn the current claim into a warranted public statement.';
  }
  if (numberOr(vector.stagnation) > 0.6) {
    return 'Perturb a stuck trajectory without sacrificing recognition safety.';
  }
  if (numberOr(vector.momentum) > 0.55 && selected === 'brisk') {
    return 'Use the available pace to carry one learner-owned proof step.';
  }
  return expectedTrajectoryMoveForRegister(selected, features, system.trajectory || {});
}

function dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag, useCorpusPrior = false }) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: 1 });
  const sampled = sampleEngagementStanceDistribution(distribution);
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const driverText =
    [
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `attractors=${topNumericEntries(system.attractors, { limit: 3 }).join(', ')}; vector=${topNumericEntries(
      system.state_vector,
      { limit: 3 },
    ).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Empirical dynamical-system' : 'Dynamical-system'
    } policy sampled from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should move the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior ? 'empirical_dynamical_system_register_policy' : 'dynamical_system_register_policy',
    distribution,
    selected_probability: selectedProbability,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      random: sampled.random,
    },
  };
}

function continuousDynamicalSystemEngagementStanceSelection({
  state,
  classification,
  tutorLearnerDag,
  useCorpusPrior = false,
}) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const definitions = getEngagementStanceDefinitions();
  const blend = buildContinuousEngagementStanceVector({
    scores,
    palette: state.register?.palette || [],
    definitions,
    allowUnsafe: state.register?.continuousUnsafe === true,
  });
  const selected =
    blend.selectedRegister || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = blend.selectedProbability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const blendInstruction = continuousEngagementStanceInstruction(blend, definitions);
  const continuousPolicy = buildContinuousRegisterPolicyMetadata({
    blend,
    temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
    useCorpusPrior,
    empirical,
    corpusEmpirical,
    styleInstruction: blendInstruction,
  });
  const driverText =
    [
      `blend ${blend.dominantBlend || selected}`,
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'continuous dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `continuous blend=${blend.dominantBlend}; attractors=${topNumericEntries(system.attractors, {
      limit: 3,
    }).join(', ')}; vector=${topNumericEntries(system.state_vector, { limit: 3 }).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Continuous empirical dynamical-system' : 'Continuous dynamical-system'
    } policy blended register anchors from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should show the continuous stance blend moving the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior
      ? 'continuous_empirical_dynamical_system_register_policy'
      : 'continuous_dynamical_system_register_policy',
    distribution: blend.rows,
    selected_probability: selectedProbability,
    register_vector: blend.vector,
    register_vector_entropy_bits: blend.entropyBits,
    continuous_register_policy: continuousPolicy,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      continuous_register_policy: {
        register_vector: continuousPolicy.register_vector,
        entropy_bits: continuousPolicy.entropy_bits,
        dominant_blend: continuousPolicy.dominant_blend,
      },
    },
  };
}

const STATE_REGISTER_BASE_WEIGHTS = {
  plain: 1.15,
  precise: 1.2,
  brisk: 0.55,
  warm: 0.9,
  witnessing: 0.55,
  charismatic: 0.8,
  ironic: 0.22,
  sarcastic: 0.08,
  face_threat: 0.03,
};

function stateRegisterPolicyFeatures({ state, classification, tutorLearnerDag }) {
  const turn = classification?.turn || {};
  const scores = turn.scores || {};
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const metrics = tutorLearnerDag?.model?.metrics || {};
  const conceptual = normalizedClassifierScore(scores.conceptual_engagement);
  const readiness = normalizedClassifierScore(scores.epistemic_readiness);
  const turnNumber = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  return {
    turn: turnNumber,
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    evidenceUse: turn.evidence_use || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    agency: turn.agency || 'unknown',
    affect: turn.affect || 'unknown',
    scores: {
      conceptual,
      epistemicReadiness: readiness,
      learnerSurface: meanFinite([conceptual, readiness]),
    },
    dag: {
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: Number(assessment.bestPathCoverage || 0),
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      groundedCount: Number(metrics.groundedCount || 0),
      voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      assertedMirror: assessment.assertedMirror === true,
    },
    explicitStepwise: hasExplicitStepwiseSignal(classification),
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: turnNumber }),
    recentRegisters: (state.register?.history || [])
      .slice(-4)
      .map((entry) => normalizeStoredRegisterSelection(entry)?.selected_register),
  };
}

function expectedStateMoveForRegister(selected, features) {
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Resolve the current vocabulary or wording gap before asking for another proof move.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Move the current learner state toward accountable closure without adding new evidence.';
  }
  if (features.dag.bottleneck === 'premature_assertion') {
    return 'Move the learner from naming a verdict to naming the public support that licenses it.';
  }
  if (features.dag.bottleneck === 'assertion_gap') {
    return 'Move the learner from held evidence to a warranted final assertion.';
  }
  if (
    /answer_seeking|passive|complying/iu.test(`${features.epistemicStance} ${features.agency} ${features.evidenceUse}`)
  ) {
    return 'Move the learner from dependent answer-seeking to one small public commitment.';
  }
  if (selected === 'witnessing') return 'Lower current affective risk while keeping one concrete public test.';
  if (selected === 'warm') return 'Restore current learner readiness enough for the next evidence claim.';
  if (selected === 'charismatic') return 'Interrupt current low-agency posture and demand one owned move.';
  if (selected === 'precise') return 'Sharpen the current claim, distinction, or warrant into a checkable line.';
  if (selected === 'brisk') return 'Advance the current proof bottleneck with one learner-owned next step.';
  return 'Move the current learner state toward one public, checkable evidence statement.';
}

function buildStateRegisterScores({ state, classification, tutorLearnerDag }) {
  const palette = state.register?.palette || [];
  const scores = Object.fromEntries(
    palette.map((register) => [register, STATE_REGISTER_BASE_WEIGHTS[register] ?? 0.35]),
  );
  const drivers = [];
  const features = stateRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const signal = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ]
    .filter(Boolean)
    .join(' ');
  const comprehensionPressure = Number(features.comprehension?.pressure || 0);

  if (comprehensionPressure > 0) {
    addRegisterScore(scores, 'plain', 2.8 * comprehensionPressure, drivers, 'for current comprehension gap');
    addRegisterScore(scores, 'warm', 1.4 * comprehensionPressure, drivers, 'for current vocabulary re-entry');
    addRegisterScore(scores, 'precise', 0.45 * comprehensionPressure, drivers, 'for one exact gloss');
    multiplyRegisterScore(
      scores,
      'charismatic',
      Math.max(0.15, 1 - 0.8 * comprehensionPressure),
      drivers,
      'comprehension gap suppresses challenge',
    );
    multiplyRegisterScore(scores, 'ironic', 0.25, drivers, 'comprehension gap suppresses irony');
    multiplyRegisterScore(scores, 'sarcastic', 0.1, drivers, 'comprehension gap suppresses sarcasm');
    multiplyRegisterScore(scores, 'face_threat', 0.05, drivers, 'comprehension gap suppresses face threat');
  }

  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    addRegisterScore(scores, 'plain', 2.0, drivers, 'for current closure state');
    addRegisterScore(scores, 'precise', 1.8, drivers, 'for accountable closeout');
    multiplyRegisterScore(scores, 'ironic', 0.5, drivers, 'closure dampening');
    multiplyRegisterScore(scores, 'sarcastic', 0.25, drivers, 'closure dampening');
    multiplyRegisterScore(scores, 'face_threat', 0.1, drivers, 'closure dampening');
  }
  if (/release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck)) {
    addRegisterScore(scores, 'precise', 1.4, drivers, 'for current proof bottleneck');
    addRegisterScore(scores, 'plain', 0.9, drivers, 'for portable evidence wording');
    if (features.explicitStepwise) {
      addRegisterScore(scores, 'brisk', 1.5, drivers, 'for explicit stepwise request');
    } else {
      addRegisterScore(scores, 'brisk', 0.25, drivers, 'for proof bottleneck without explicit pacing request');
    }
  }
  if (features.dag.bottleneck === 'learner_integration_gap') {
    addRegisterScore(scores, 'plain', 1.7, drivers, 'for learner integration');
    addRegisterScore(scores, 'precise', 1.1, drivers, 'for warrant integration');
    addRegisterScore(scores, 'warm', 0.8, drivers, 'for ownership recovery');
  }
  if (features.dag.bottleneck === 'assertion_gap') {
    addRegisterScore(scores, 'plain', 1.6, drivers, 'for final say-back');
    addRegisterScore(scores, 'precise', 1.2, drivers, 'for licensed assertion');
    addRegisterScore(scores, 'charismatic', 0.6, drivers, 'for final commitment pressure');
  }
  if (features.dag.bottleneck === 'premature_assertion') {
    addRegisterScore(scores, 'precise', 2.0, drivers, 'for premature assertion');
    addRegisterScore(scores, 'charismatic', 1.0, drivers, 'to interrupt answer-first closure');
    addRegisterScore(scores, 'ironic', 0.45, drivers, 'for visible warrant gap');
  }
  if (
    /conceptual_clarity_request|challenge|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported/iu.test(
      signal,
    )
  ) {
    addRegisterScore(scores, 'precise', 1.8, drivers, 'for current distinction or warrant issue');
    addRegisterScore(scores, 'ironic', 0.35, drivers, 'for current mismatch');
  }
  if (/plain_language_request|plain_simplification_followup|transfer_demand_or_named_material/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 2.0, drivers, 'for current plain-language need');
    addRegisterScore(scores, 'warm', 0.65, drivers, 'for current re-entry need');
  }
  if (/vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu.test(signal)) {
    addRegisterScore(scores, 'witnessing', 2.8, drivers, 'for current affective exposure');
    addRegisterScore(scores, 'warm', 1.2, drivers, 'for current affective risk');
  }
  if (/resistance_or_low_agency|resistant|answer_seeking|overconfident|passive|complying/iu.test(signal)) {
    addRegisterScore(scores, 'charismatic', 2.0, drivers, 'for current low-agency state');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for small public commitment');
    addRegisterScore(scores, 'precise', 0.7, drivers, 'for accountable warrant');
    addRegisterScore(scores, 'ironic', 0.25, drivers, 'for current rote-performance gap');
  }
  if (Number(features.scores.conceptual) <= 0.25 || Number(features.scores.epistemicReadiness) <= 0.25) {
    addRegisterScore(scores, 'plain', 0.9, drivers, 'for low current surface engagement');
    addRegisterScore(scores, 'warm', 0.55, drivers, 'for low current readiness');
  }
  if (/links_evidence_to_rule|revises_from_evidence|grounded|self_correcting/iu.test(signal)) {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for current grounded evidence use');
    addRegisterScore(scores, 'brisk', 0.55, drivers, 'for current momentum');
  }

  const latest = latestRegisterSelection(state);
  if (latest?.selected_register) {
    multiplyRegisterScore(scores, latest.selected_register, 0.72, drivers, 'state-policy repetition penalty');
  }
  for (const register of new Set(features.recentRegisters.filter(Boolean))) {
    if (recentRegisterCount(state, register) >= 2) {
      multiplyRegisterScore(scores, register, 0.58, drivers, 'last-four repetition penalty');
    }
  }
  if (!features.explicitStepwise) {
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'brisk non-default without explicit stepwise need');
  }
  if (!features.dag.finalSecretEntailed) {
    multiplyRegisterScore(scores, 'sarcastic', 0.55, drivers, 'negative-register dampening under state policy');
    multiplyRegisterScore(scores, 'face_threat', 0.3, drivers, 'negative-register dampening under state policy');
  }

  return { features, scores, drivers };
}

function stateEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
  const { features, scores, drivers } = buildStateRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = sampleEngagementStanceDistribution(distribution);
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base state-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.dag.bottleneck}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `State policy sampled from current classifier/DAG distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : 'Elicit one public, checkable learner move that addresses the current learner-DAG bottleneck.',
    expected_field_move: expectedStateMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should improve the current state: public evidence use, agency, assertion quality, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'state_register_policy',
    distribution,
    selected_probability: selectedProbability,
    state_policy: {
      schema: 'machinespirits.tutor-stub.state-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function normalizeResponseConfigurationSelection(rawSelection, { state, classification, tutorLearnerDag, raw, learnerText = '' }) {
  if (!state.register?.enabled) return null;
  const palette = new Set(state.register.palette || []);
  const policy = state.register?.policy || 'dynamic';
  if (policy === 'random') {
    rawSelection = randomEngagementStanceSelection({ state, classification });
  } else if (policy === 'negative') {
    rawSelection = negativeEngagementStanceSelection({ state, classification });
  } else if (policy === 'field') {
    rawSelection = fieldEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'trajectory') {
    rawSelection = trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'empirical_dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'continuous_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'continuous_empirical_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'state') {
    rawSelection = stateEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'bland') {
    rawSelection = fixedBlandEngagementStanceSelection({ state, classification });
  }
  const normalizedRawSelection =
    typeof rawSelection === 'string' ? { engagement_stance: rawSelection } : rawSelection || {};
  const requested = String(
    normalizedRawSelection.engagement_stance ||
      normalizedRawSelection.selected_register ||
      normalizedRawSelection.register ||
      '',
  ).trim();
  const requestedResolution = resolveEngagementStance(requested);
  const requestedRegister = requestedResolution?.register || requested;
  const requestedIsKnown = Boolean(requestedRegister && palette.has(requestedRegister));
  const dynamicBriskBlocked = Boolean(
    requestedIsKnown &&
    policy === 'dynamic' &&
    requestedRegister === 'brisk' &&
    !shouldUseDynamicBrisk({ state, classification, assessment: tutorLearnerDag?.model?.assessment || {} }),
  );
  let source =
    policy === 'random'
      ? normalizedRawSelection
      : requestedIsKnown && !dynamicBriskBlocked
        ? normalizedRawSelection
        : fallbackRegisterSelection({ state, classification, tutorLearnerDag });
  const comprehensionPressure = Number(
    tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }).pressure || 0,
  );
  if (
    policy === 'dynamic' &&
    comprehensionPressure > 0 &&
    !['plain', 'warm', 'precise'].includes(
      String(source.engagement_stance || source.selected_register || source.register || ''),
    )
  ) {
    source = {
      ...source,
      engagement_stance: 'plain',
      selected_register: 'plain',
      register_reason: `Comprehension side-state overrode challenge pressure at ${comprehensionPressure}; use one immediate plain-language gloss.`,
      expected_dag_move: 'Hold learner-DAG advancement while the wording gap is repaired.',
      expected_field_move: 'Resolve the vocabulary or wording gap before asking for another proof move.',
      source: 'dynamic_comprehension_guard',
    };
  }
  const selectedRaw = String(source.engagement_stance || source.selected_register || source.register || '').trim();
  const selectedResolution = resolveEngagementStance(selectedRaw, { fallback: 'precise' });
  const selected = selectedResolution?.register || selectedRaw;
  const definition = getEngagementStanceDefinition(selected) || {};
  const requestType = String(
    source.request_type ||
      selectedResolution?.request_type ||
      classification?.turn?.request_type ||
      classification?.turn?.discourse_move ||
      'unknown',
  );
  const proposedActionFamily = String(source.action_family || selectedResolution?.action_family || '');
  const responseConfiguration = buildTutorStubResponseConfiguration({
    engagementStance: selected,
    legacySelectedRegister: source.legacy_selected_register || selectedResolution?.legacy_selected_register || null,
    stanceDistribution: source.engagement_stance_distribution || source.distribution || null,
    stanceVector: source.engagement_stance_vector || source.register_vector || null,
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    policy,
    learnerText,
    classification,
    tutorLearnerDag,
    comprehension: tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }),
    world: state.world,
    proposedActionFamily: proposedActionFamily || null,
  });
  const actionFamily = responseConfiguration.action_family;
  const reviewerSignal = String(
    source.reviewer_signal ||
      source.register_signal ||
      source.learner_signal ||
      source.learnerSignal ||
      classification?.turn?.pedagogical_need ||
      requestType,
  );
  const selection = {
    schema: 'machinespirits.tutor-stub.response-configuration-selection.v3',
    register_ontology_version: getRegisterOntologyVersion(),
    policy,
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    engagement_stance: selected,
    selected_register: selected,
    selected_mode: selected,
    legacy_selected_register:
      source.legacy_selected_register ||
      selectedResolution?.legacy_selected_register ||
      preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    action_family: actionFamily || null,
    audience_register: responseConfiguration.audience_register,
    lexical_accessibility: responseConfiguration.lexical_accessibility,
    scene_immersion: responseConfiguration.scene_immersion,
    unresolved_terms: responseConfiguration.unresolved_terms,
    valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    request_type: requestType,
    reviewer_signal: reviewerSignal,
    learner_signal: requestType,
    engagement_stance_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    register_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    evidence_span: String(source.evidence_span || source.evidence || ''),
    risk_flags: Array.isArray(source.risk_flags) ? source.risk_flags.map(String) : [],
    expected_dag_move: String(source.expected_dag_move || ''),
    expected_field_move: String(source.expected_field_move || source.expected_learner_field_move || ''),
    expected_progress_marker: String(source.expected_progress_marker || ''),
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    engagement_stance_temperature:
      state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    temperature_scope: 'engagement_stance_only',
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
    selected_probability: Number.isFinite(Number(source.selected_probability))
      ? Number(source.selected_probability)
      : null,
    distribution: Array.isArray(source.distribution) ? source.distribution : null,
    engagement_stance_distribution: Array.isArray(source.engagement_stance_distribution)
      ? source.engagement_stance_distribution
      : Array.isArray(source.distribution)
        ? source.distribution
        : null,
    register_vector:
      source.register_vector && typeof source.register_vector === 'object' ? source.register_vector : null,
    engagement_stance_vector:
      source.engagement_stance_vector && typeof source.engagement_stance_vector === 'object'
        ? source.engagement_stance_vector
        : source.register_vector && typeof source.register_vector === 'object'
          ? source.register_vector
          : null,
    register_vector_entropy_bits: Number.isFinite(Number(source.register_vector_entropy_bits))
      ? Number(source.register_vector_entropy_bits)
      : null,
    field_policy: source.field_policy || null,
    trajectory_policy: source.trajectory_policy || null,
    dynamical_system_policy: source.dynamical_system_policy || null,
    continuous_register_policy: source.continuous_register_policy || null,
    response_configuration: responseConfiguration,
    state_policy: source.state_policy || null,
    source: source.source || 'combined_learner_analysis',
    random: source.random || null,
    model: raw ? { provider: raw.provider, model: raw.model, latencyMs: raw.latencyMs, usage: raw.usage } : null,
    selectedAtDag: tutorLearnerDag?.model || null,
    efficacy: null,
  };
  if (source.warning) {
    selection.warning = source.warning;
  } else if (!requestedIsKnown && selection.source === 'combined_learner_analysis') {
    selection.warning = source.warning || `invalid_register_selection:${requested || 'missing'}`;
  } else if (dynamicBriskBlocked) {
    selection.warning = 'dynamic_policy_brisk_demoted';
    selection.original_register = requested;
  }
  selection.response_configuration.compatibility.legacy_selected_register = selection.legacy_selected_register;
  state.register.history.push(selection);
  state.register.current = selection;
  return selection;
}

function validFactArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string');
}

function proofBaseKeys(closed, key, seen = new Set()) {
  if (seen.has(key)) return [];
  seen.add(key);
  const proof = closed.proofs.get(key);
  if (!proof) return [key];
  return proof.premises.flatMap((premiseKey) => proofBaseKeys(closed, premiseKey, seen));
}

function applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText, dropoutReplay = null }) {
  const record = state.learnerDag.record;
  const world = state.world;
  const released = new Map(stagedEvidenceRows(world, tutorTurn).map((row) => [row.premise, row]));
  const releasedByFactKey = new Map(
    [...released.values()].filter((row) => row.fact).map((row) => [factKey(row.fact), row]),
  );
  const accepted = {
    adopt: [],
    retract: [],
    derive: [],
    hypothesis: null,
    assertAnswer: null,
    humanDiscourse: normalizeHumanDiscourseExtraction(update?.human_discourse || update?.humanDiscourse),
  };
  const rejected = [];
  const retracted = new Set();

  const adoptReleasedRow = (row) => {
    if (!row?.fact || retracted.has(row.premise)) return false;
    record.board.set(factKey(row.fact), row.fact);
    if (!accepted.adopt.includes(row.premise)) accepted.adopt.push(row.premise);
    return true;
  };

  for (const premiseId of Array.isArray(update?.retract) ? update.retract : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'retract', value: premiseId, reason: 'not staged' });
      continue;
    }
    record.board.delete(factKey(row.fact));
    accepted.retract.push(premiseId);
    retracted.add(premiseId);
  }

  for (const premiseId of Array.isArray(update?.adopt) ? update.adopt : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'adopt', value: premiseId, reason: 'not staged' });
      continue;
    }
    adoptReleasedRow(row);
  }

  for (const fact of Array.isArray(update?.derive) ? update.derive : []) {
    if (!validFactArray(fact)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not a fact array' });
      continue;
    }
    const key = factKey(fact);
    const answersPublicQuestion = Boolean(matchPattern(world.questionPattern, fact));
    let closed = closure([...record.board.values()], world.rules);
    let canonical = closed.facts.get(key);
    if ((!canonical || !closed.proofs.get(key)) && !answersPublicQuestion) {
      const stagedFacts = [...released.values()]
        .filter((row) => row.fact && !retracted.has(row.premise))
        .map((row) => row.fact);
      const stagedClosed = closure([...record.board.values(), ...stagedFacts], world.rules);
      const stagedCanonical = stagedClosed.facts.get(key);
      const stagedProof = stagedClosed.proofs.get(key);
      if (stagedCanonical && stagedProof) {
        for (const baseKey of proofBaseKeys(stagedClosed, key)) {
          adoptReleasedRow(releasedByFactKey.get(baseKey));
        }
        closed = closure([...record.board.values()], world.rules);
        canonical = closed.facts.get(key);
      }
    }
    if (!canonical || !closed.proofs.get(key)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not derivable from accepted public record' });
      continue;
    }
    if (!record.voicedKeys.has(key)) {
      record.voicedKeys.add(key);
      record.voiced.push({ turn: tutorTurn, fact: canonical });
    }
    accepted.derive.push(canonical);
  }

  if (typeof update?.hypothesis === 'string' && update.hypothesis.trim()) {
    const hypothesis = update.hypothesis.trim();
    record.hypotheses.push({ turn: tutorTurn, text: hypothesis });
    accepted.hypothesis = hypothesis;
  }

  let assertion = null;
  if (typeof update?.assert_answer === 'string' && update.assert_answer.trim()) {
    assertion = factFromQuestionAnswer(world, update.assert_answer);
    accepted.assertAnswer = update.assert_answer.trim();
  } else if (validFactArray(update?.asserts)) {
    assertion = update.asserts;
  }
  if (assertion && !matchPattern(world.questionPattern, assertion)) {
    rejected.push({ type: 'assert', value: assertion, reason: 'does not match public question pattern' });
    assertion = null;
    accepted.assertAnswer = null;
  }

  const dagFactDropout = applyTutorStubDagFactDropout({
    dropout: state.learnerDag.dropout,
    board: record.board,
    world,
    turn: tutorTurn,
    adoptedPremiseIds: accepted.adopt,
    retractedPremiseIds: accepted.retract,
    replay: dropoutReplay,
  });

  const ledger = releaseLedgerForTurn(world, tutorTurn);
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    assertion,
    learnerText,
    ledger,
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
  model.memoryReliability = dagFactDropout
    ? {
        schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
        configuredRate: dagFactDropout.configuredRate,
        activeDroppedCount: dagFactDropout.activeDropped.length,
        droppedThisTurn: dagFactDropout.droppedNow.length,
        repairedThisTurn: dagFactDropout.repairedNow.length,
        visibility: 'conduct',
      }
    : null;

  return {
    model,
    dagFactDropout,
    accepted,
    rejected,
    extractor: {
      provider: update?.provider || null,
      model: update?.model || null,
      latencyMs: update?.latencyMs || 0,
      usage: update?.usage || null,
      parseError: update?.parseError || null,
      humanDiscourse: accepted.humanDiscourse,
      notes: typeof update?.notes === 'string' ? update.notes : null,
    },
  };
}

function emptyTutorLearnerDagModel(state, tutorTurn) {
  const record = state.learnerDag.record;
  const world = state.world;
  const dagFactDropout = applyTutorStubDagFactDropout({
    dropout: state.learnerDag.dropout,
    board: record.board,
    world,
    turn: tutorTurn,
  });
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    ledger: releaseLedgerForTurn(world, tutorTurn),
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
  model.memoryReliability = dagFactDropout
    ? {
        schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
        configuredRate: dagFactDropout.configuredRate,
        activeDroppedCount: dagFactDropout.activeDropped.length,
        droppedThisTurn: dagFactDropout.droppedNow.length,
        repairedThisTurn: dagFactDropout.repairedNow.length,
        visibility: 'conduct',
      }
    : null;
  return { model, dagFactDropout };
}

async function buildTutorLearnerDagForTurn(learnerText, state) {
  if (!state.learnerDag.enabled || !state.world) return null;
  const tutorTurn = state.turns.length + 1;
  startInterimAnimation(state, 'modeling learner DAG', { learnerText, tutorTurn });
  try {
    const update = await extractLearnerRecordUpdate({ learnerText, state, tutorTurn });
    const result = applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText });
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printTutorLearnerDagModel(result);
    return result;
  } catch (err) {
    const empty = emptyTutorLearnerDagModel(state, tutorTurn);
    const model = empty.model;
    const result = {
      model,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printTutorLearnerDagModel(result);
    return result;
  }
}

function updateComprehensionForLearnerTurn({
  learnerText,
  state,
  classification,
  tutorTurn,
  recordTrace = true,
}) {
  const request = detectTutorStubComprehensionRequest({
    text: learnerText,
    classification,
    source: 'learner_turn',
    turn: tutorTurn,
  });
  const previous = state.comprehension?.lastRequest || null;
  const duplicate = Boolean(
    request.detected &&
      previous &&
      Number(previous.turn) === Number(request.turn) &&
      previous.source === request.source &&
      previous.text === request.text,
  );
  if (request.detected) {
    if (duplicate) {
      if (request.requestType) previous.requestType = request.requestType;
    } else {
      applyTutorStubComprehensionRequest(state.comprehension, request);
    }
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'comprehension_request',
        turn: tutorTurn,
        source: request.source,
        requestType: request.requestType,
        terms: request.terms,
        generic: request.generic,
        text: request.text,
        deduplicated: duplicate,
        advancesLearnerDag: false,
        state: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
      });
    }
  }
  return {
    request,
    snapshot: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
  };
}

async function analyzeLearnerTurnCombined(learnerText, state, { precomputedRaw = null } = {}) {
  const tutorTurn = state.turns.length + 1;
  const startedAt = Date.now();
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn,
    recordTrace: false,
  });
  startInterimAnimation(state, 'analyzing learner', { learnerText, tutorTurn });

  try {
    const raw = precomputedRaw || (await extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn }));
    const classification = classificationFromCombinedAnalysis(raw, state);
    const update = learnerRecordFromCombinedAnalysis(raw);
    const tutorLearnerDag = applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText });
    state.learnerDag.lastModel = tutorLearnerDag.model;
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(state, tutorLearnerDag, classification);
    const registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
      state,
      classification,
      tutorLearnerDag,
      raw,
      learnerText,
    });
    stopInterimAnimation(state);
    printClassification(classification);
    printTutorLearnerDagModel(tutorLearnerDag);
    printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  } catch (err) {
    const classification = failedClassification({
      message: err.message,
      resolved: state.learnerDag.resolved,
      latencyMs: Date.now() - startedAt,
    });
    const empty = emptyTutorLearnerDagModel(state, tutorTurn);
    const model = empty.model;
    const tutorLearnerDag = {
      model,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = tutorLearnerDag.model;
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(state, tutorLearnerDag, classification);
    const registerSelection = normalizeResponseConfigurationSelection(null, {
      state,
      classification,
      tutorLearnerDag,
      raw: null,
      learnerText,
    });
    stopInterimAnimation(state);
    printClassification(classification);
    printTutorLearnerDagModel(tutorLearnerDag);
    printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  }
}

async function analyzeLearnerTurn(learnerText, state, { precomputedRaw = null } = {}) {
  printTurnDebugLine(state, state.turns.length + 1);
  if (state.classifier.enabled && state.learnerDag.enabled && state.world) {
    return await analyzeLearnerTurnCombined(learnerText, state, { precomputedRaw });
  }

  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn: state.turns.length + 1,
    recordTrace: false,
  });
  const classification = await classifyForTurn(learnerText, state);
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification,
    tutorTurn: state.turns.length + 1,
  });
  const tutorLearnerDag = await buildTutorLearnerDagForTurn(learnerText, state);
  const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(state, tutorLearnerDag, classification);
  const registerSelection = normalizeResponseConfigurationSelection(null, {
    state,
    classification,
    tutorLearnerDag,
    raw: null,
    learnerText,
  });
  printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
  return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
}

function printTutorLearnerDagModel(result) {
  if (!result?.model) return;
  const model = result.model;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const buckets = Object.entries(assessment.missingPremiseBuckets || {})
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(', ');
  const warning = result.extractor?.error || result.extractor?.parseError;
  console.log(
    `${C.cyan}tutor learner-DAG model >${C.reset} coverage ${assessment.bestPathCoverage ?? 'n/a'}; bottleneck ${
      assessment.bottleneck || 'unknown'
    }`,
  );
  const dropout = result.dagFactDropout || null;
  if (dropout?.droppedNow?.length || dropout?.repairedNow?.length || dropout?.activeDropped?.length) {
    const parts = [
      dropout.droppedNow?.length ? `${dropout.droppedNow.length} slipped now` : null,
      dropout.repairedNow?.length ? `${dropout.repairedNow.length} re-adopted` : null,
      `${dropout.activeDropped?.length || 0} currently dropped`,
    ].filter(Boolean);
    console.log(`${C.dim}  accumulated evidence memory: ${parts.join('; ')}${C.reset}`);
  }
  console.log(
    `${C.dim}  grounded ${metrics.groundedCount || 0}, voiced ${metrics.voicedDerivedCount || 0}, hypotheses ${
      metrics.hypothesisCount || 0
    }, answer candidates ${metrics.answerCandidateCount || 0}${buckets ? `; missing ${buckets}` : ''}${C.reset}`,
  );
  if (result.accepted?.adopt?.length || result.accepted?.derive?.length || result.accepted?.hypothesis) {
    console.log(
      `${C.dim}  update: adopted ${result.accepted.adopt.length}, derived ${result.accepted.derive.length}${
        result.accepted.hypothesis ? ', hypothesis noted' : ''
      }${C.reset}`,
    );
  }
  if (warning) console.log(`${C.red} learner-DAG model warning${C.reset}${C.dim}: ${warning}${C.reset}`);
}

function printResponseConfigurationSelection(selection, previousEfficacy = null) {
  if (previousEfficacy) {
    const fieldDelta = formatSignedInterimNumber(previousEfficacy.field?.delta, { decimals: 3 }) || '0';
    const mismatch = previousEfficacy.mismatch ? `; ${previousEfficacy.mismatch}; field ${fieldDelta}` : '';
    console.log(
      `${C.cyan}stance efficacy >${C.reset} ${
        previousEfficacy.engagement_stance || previousEfficacy.selected_register
      } ${previousEfficacy.label}${mismatch} (${previousEfficacy.summary})`,
    );
  }
  if (!selection) return;
  const warning = selection.warning ? ` ${C.red}${selection.warning}${C.reset}` : '';
  const confidence = selection.confidence !== null ? `; confidence ${selection.confidence}` : '';
  const source =
    selection.source && selection.source !== 'combined_learner_analysis' ? `; source ${selection.source}` : '';
  console.log(
    `${C.cyan}engagement stance >${C.reset} ${
      selection.engagement_stance || selection.selected_register
    }${confidence}${source}${warning}`,
  );
  if (Number.isFinite(Number(selection.temperature))) {
    console.log(
      `${C.dim}  stance temperature: ${selection.temperature} (engagement blend only; lower sharper, higher broader)${C.reset}`,
    );
  }
  const distribution = formatEngagementStanceDistribution(selection.distribution);
  if (distribution) console.log(`${C.dim}  distribution: ${distribution}${C.reset}`);
  if (selection.continuous_register_policy?.dominant_blend) {
    console.log(
      `${C.dim}  continuous blend: ${selection.continuous_register_policy.dominant_blend}; entropy ${
        selection.continuous_register_policy.entropy_bits ?? 'n/a'
      } bits${C.reset}`,
    );
  }
  if (selection.request_type || selection.reviewer_signal) {
    console.log(
      `${C.dim}  request: ${selection.request_type || 'unknown'}; action: ${
        selection.action_family || 'none'
      }; reviewer signal: ${selection.reviewer_signal || 'unknown'}${C.reset}`,
    );
  }
  console.log(
    `${C.dim}  audience: ${selection.audience_register || 'unknown'}; lexical: ${
      selection.lexical_accessibility || 'unknown'
    }; scene: ${selection.scene_immersion || 'unknown'}${C.reset}`,
  );
  if (selection.register_reason) console.log(`${C.dim}  reason: ${selection.register_reason}${C.reset}`);
  if (selection.expected_dag_move) console.log(`${C.dim}  expected DAG move: ${selection.expected_dag_move}${C.reset}`);
  if (selection.expected_field_move) {
    const expectedMoveLabel =
      selection.policy === 'state'
        ? 'expected state move'
        : selection.policy === 'trajectory'
          ? 'expected trajectory move'
          : selection.policy === 'dynamical_system' ||
              selection.policy === 'empirical_dynamical_system' ||
              selection.policy === 'continuous_dynamical_system' ||
              selection.policy === 'continuous_empirical_dynamical_system'
            ? 'expected dynamical move'
            : 'expected field move';
    console.log(`${C.dim}  ${expectedMoveLabel}: ${selection.expected_field_move}${C.reset}`);
  }
}

function responseConfigurationContext(
  selection,
  { multipleChoice = false, humanDiscourseFrame = null, dialogueClosureFrame = null } = {},
) {
  if (!selection) return '';
  const generousInference = humanDiscourseFrame?.generousInference || null;
  const engagementStance = selection.engagement_stance || selection.selected_register;
  const definition = getEngagementStanceDefinition(engagementStance) || {};
  const expectedMoveLabel =
    selection.policy === 'state'
      ? 'Expected learner-state move'
      : selection.policy === 'trajectory'
        ? 'Expected learner-trajectory move'
        : selection.policy === 'dynamical_system' ||
            selection.policy === 'empirical_dynamical_system' ||
            selection.policy === 'continuous_dynamical_system' ||
            selection.policy === 'continuous_empirical_dynamical_system'
          ? 'Expected learner-dynamical move'
          : 'Expected learner-field move';
  const continuousStyleInstruction = String(selection.continuous_register_policy?.style_instruction || '').trim();
  const vectorSummary =
    selection.continuous_register_policy?.dominant_blend ||
    (selection.register_vector
      ? Object.entries(selection.register_vector)
          .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
          .map(([register, weight]) => `${register} ${Math.round(Number(weight || 0) * 100)}%`)
          .join(', ')
      : '');
  const guardrails = [
    ...(Array.isArray(definition.forbidden_phrases) && definition.forbidden_phrases.length
      ? [`Forbidden phrase families: ${definition.forbidden_phrases.join(', ')}`]
      : []),
    definition.recognition_guardrail ? `Recognition guardrail: ${definition.recognition_guardrail}` : null,
    selection.simulated_only
      ? 'This is a simulated-only register; do not use it unless the operator explicitly enabled it.'
      : null,
  ].filter(Boolean);
  const responseConfiguration =
    selection.response_configuration || {
      engagement_stance: engagementStance,
      action_family: selection.action_family,
      audience_register: selection.audience_register,
      lexical_accessibility: selection.lexical_accessibility,
      scene_immersion: selection.scene_immersion,
      unresolved_terms: selection.unresolved_terms || [],
    };
  return [
    tutorStubResponseConfigurationPrompt(responseConfiguration),
    '[Tutor-only response-policy evidence]',
    `Selected engagement stance: ${engagementStance}`,
    selection.legacy_selected_register ? `Legacy register alias: ${selection.legacy_selected_register}` : null,
    `Valence: ${selection.valence || 'unknown'}`,
    `Logical request type: ${selection.request_type || selection.learner_signal || 'unknown'}`,
    `Action family: ${selection.action_family || 'none'}`,
    `Reviewer signal: ${selection.reviewer_signal || 'unknown'}`,
    `Reason: ${selection.register_reason || 'No reason supplied.'}`,
    Number.isFinite(Number(selection.temperature))
      ? `Engagement-stance temperature: ${selection.temperature} (applies only to the stance distribution; lower means sharper and higher means broader).`
      : null,
    vectorSummary ? `Continuous register vector: ${vectorSummary}` : null,
    continuousStyleInstruction || null,
    `Expected learner-DAG move: ${selection.expected_dag_move || 'No expected move supplied.'}`,
    `${expectedMoveLabel}: ${selection.expected_field_move || 'No expected state/field move supplied.'}`,
    guardrails.length ? 'Guardrails:' : null,
    ...guardrails,
    'Write the next tutor message so the engagement stance, independent action family, audience register, lexical accessibility, and scene immersion are all visible without naming the configuration, classifier, or learner-DAG machinery.',
    multipleChoice
      ? 'Keep the turn compact. In story mode, if you use multiple choice, offer 2-4 short public evidence options and invite the learner to choose or write their own trial-book line.'
      : "Keep the turn compact. In story mode, give one live issue and one light prompt for the learner's next thought; do not require a full warranted claim unless the learner is making an unsafe or case-closing leap.",
    generousInference?.applied
      ? 'Human-scaffold override: the learner has already answered the immediately preceding local question by unambiguous context. This overrides any expected DAG/state/field move that would ask for a restatement, name, premise, warrant, or trial-book version of the same answer. Acknowledge it and advance to a genuinely new pressure.'
      : null,
    dialogueClosureFrame?.mandatory
      ? 'Dialogue-closure override: the proof is complete for this dialogue. Closure now overrides every expected DAG/state/field move. Do not solicit another proof step.'
      : dialogueClosureFrame?.available
        ? 'Dialogue-closure override: the authored public proof is complete. If this response states the final verdict, it must close the inquiry rather than reopening another proof step.'
        : null,
    '[End tutor-only response-policy evidence]',
  ]
    .filter(Boolean)
    .join('\n');
}

function tutorLearnerDagModelContext(result) {
  const model = result?.model || result;
  if (!model) return '';
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const record = model.learnerRecord || {};
  const memoryReliability = model.memoryReliability || null;
  const grounded = (record.grounded || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  const hypotheses = (record.hypotheses || []).map((row) => `- ${row.text}`).join('\n') || '- none';
  const candidates = (record.answerCandidates || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  return [
    '[Tutor-only redacted learner-DAG model]',
    `Best-path coverage: ${assessment.bestPathCoverage ?? 'unavailable'}`,
    `Bottleneck: ${assessment.bottleneck || 'unavailable'}`,
    `Counts: grounded=${metrics.groundedCount || 0}, voiced=${metrics.voicedDerivedCount || 0}, hypotheses=${
      metrics.hypothesisCount || 0
    }, answerCandidates=${metrics.answerCandidateCount || 0}, missing=${metrics.missingPremiseCount || 0}`,
    memoryReliability?.activeDroppedCount
      ? `Memory reliability: ${memoryReliability.activeDroppedCount} previously accumulated public evidence item(s) are no longer active in the redacted record. Re-anchor gently from public evidence; do not announce forgetting, dropout, or an internal memory test.`
      : null,
    'Grounded public record:',
    grounded,
    'Learner hypotheses:',
    hypotheses,
    'Answer candidates derivable from the tutor model of the learner record:',
    candidates,
    'Use this as advisory context only. Do not mention DAGs, coverage, missing counts, hidden paths, or internal state.',
    '[End tutor-only redacted learner-DAG model]',
  ].join('\n');
}

function compactAuditRows(rows = [], limit = 3) {
  const visible = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (typeof row === 'string') return row.trim();
      const bits = [row?.surface, row?.warrantNeeded, row?.reason]
        .filter(Boolean)
        .map((value) => oneLine(value, { max: 120 }));
      return bits.join(' — ');
    })
    .filter(Boolean)
    .slice(0, limit);
  return visible.length ? visible.map((row) => `- ${row}`).join('\n') : '- none';
}

function humanDiscourseTutorContext(frame) {
  if (!frame || frame.mode === 'strict_dag') return '';
  const scaffold = frame.scaffoldState || {};
  const branch = scaffold.branch || {};
  const sideArc = frame.sideArc || {};
  const proofDebt = frame.proofDebt || {};
  const audit = frame.warrantPremiseAudit || {};
  const compression = frame.stepCompression || {};
  const generousInference = frame.generousInference || null;
  const due = scaffold.releaseState?.dueNow || [];
  const latest = scaffold.releaseState?.latestReleased || null;
  const next = scaffold.releaseState?.nextRelease || null;
  const promptRule =
    frame.mode === 'defeasible_human_scaffold'
      ? 'Treat plausible learner leaps as compressed human reasoning. Keep obvious omitted bridges as internal proof debt, and surface a warrant gap only when the leap is unsafe, conflicting, or would close the case.'
      : 'Frame one local warrant in ordinary language while preserving the strict proof audit; do not expand the whole proof chain or license the final answer early.';
  return [
    '[Tutor-only human discourse scaffold]',
    `Mode: ${frame.mode}; strict DAG remains the audit, but the learner-facing scaffold is active.`,
    compression.enabled
      ? `Step compression: on; ${compression.policy || 'accept obvious public bridges as implied'}; max explicit demands per turn ${compression.maxExplicitDemandsPerTurn ?? 1}.`
      : null,
    `Act: ${scaffold.activeAct?.act || 'unknown'}${scaffold.activeAct?.title ? ` — ${scaffold.activeAct.title}` : ''}.`,
    scaffold.activeAct?.intent ? `Act intent: ${oneLine(scaffold.activeAct.intent, { max: 260 })}` : null,
    `Current branch: ${branch.label || branch.id || 'open scaffold'}.`,
    scaffold.localQuestion ? `Local question: ${scaffold.localQuestion}` : null,
    scaffold.warrantFrame ? `Warrant frame: ${scaffold.warrantFrame}` : null,
    scaffold.joinReminder ? `Join reminder: ${scaffold.joinReminder}` : null,
    due.length
      ? `Evidence due now: ${due.map((row) => `${row.premise}/${row.via}: ${oneLine(row.surface, { max: 120 })}`).join(' | ')}`
      : latest
        ? `Latest released evidence: ${latest.premise}/${latest.via}: ${oneLine(latest.surface, { max: 140 })}`
        : null,
    next ? `Next scheduled evidence: ${next.premise} at turn ${next.turn} via ${next.via}` : null,
    generousInference.applied ? 'Contextual answer resolution: APPLIED with high confidence.' : null,
    generousInference.applied ? `Resolved learner move: ${generousInference.resolvedMeaning}` : null,
    generousInference.applied ? `Authoritative next-turn rule: ${generousInference.tutorInstruction}` : null,
    sideArc.detected
      ? `Side arc: ${sideArc.type}. Answer the learner's clarification/trust/affect need briefly, then ${sideArc.returnTarget?.afterSideArc || 'return to the local evidence question'}.`
      : 'Side arc: none detected; stay on the local warrant.',
    `Proof debt status: ${proofDebt.status || 'unknown'}; open=${proofDebt.counts?.open ?? 0}; harmful=${proofDebt.counts?.harmful ?? 0}.`,
    proofDebt.open?.length ? `Open proof debt:\n${compactAuditRows(proofDebt.open)}` : null,
    audit.warrants?.missing?.length ? `Missing warrants:\n${compactAuditRows(audit.warrants.missing)}` : null,
    audit.premises?.suppressedOrPrivate?.length || audit.premises?.illicitHidden?.length
      ? `Hidden/private premise risk:\n${compactAuditRows([
          ...(audit.premises?.suppressedOrPrivate || []),
          ...(audit.premises?.illicitHidden || []),
        ])}`
      : null,
    promptRule,
    "Learner-facing behavior: use plain public evidence language, answer side clarifications briefly, and usually move with the learner's compressed inference rather than forcing them to spell out every link.",
    'When the learner skips an obvious public bridge, do not quiz them on it. Carry the bridge internally as implied proof debt and continue to the next useful pressure.',
    generousInference.applied
      ? 'The immediately preceding local question is closed for learner-facing purposes. Do not paraphrase it into another question, ask for a name, ask what it licenses, or request a trial-book restatement. The strict learner-DAG may remain incomplete as an audit; that incompleteness must not control this spoken turn.'
      : null,
    'Ask for an explicit warrant only if the learner is about to name/confirm a suspect, contradicts public evidence, relies on unstaged evidence, or reaches a conclusion that would be false without the missing bridge.',
    'Default response shape: one short acknowledgement, one sentence naming the live evidence pressure, one light question. Avoid lists of routes, ledgers, or multiple required subclaims.',
    'Never mention scaffold state, proof debt, side arcs, DAGs, premise ids, rule ids, hidden facts, or release schedules.',
    '[End tutor-only human discourse scaffold]',
  ]
    .filter(Boolean)
    .join('\n');
}

function dialogueClosureTutorContext(frame) {
  if (!frame?.enabled || (!frame.mandatory && !frame.available)) return '';
  if (frame.phase === 'final_checkin_response') {
    return [
      '[Tutor-only dialogue closure]',
      'Phase: one final learner check-in after the case reached closure.',
      'Answer only the learner’s check-in from the public transcript. Do not introduce new evidence or restart the proof sequence.',
      'End with an explicit statement that the case, book, or inquiry is closed and complete.',
      'Do not ask any further question. This is the terminal tutor turn.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  if (frame.mandatory) {
    return [
      '[Tutor-only dialogue closure]',
      `Closure basis: ${frame.basis}. The final conclusion is grounded and asserted; the dialogue must now wind down.`,
      'Briefly acknowledge the learner’s result and name the decisive public chain in ordinary language.',
      'Explicitly say that the case, book, or inquiry is closed. Do not ask another proof question.',
      frame.allowCheckIn
        ? 'You may end with one optional check-in about whether the learner wants one link revisited. If you ask it, it must be the only question.'
        : 'Do not ask a follow-up question; end the dialogue now.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  return [
    '[Tutor-only dialogue closure]',
    'The authored proof DAG is now fully public, so conversational closure is available even if the strict learner-record audit remains incomplete.',
    'Do not announce the final verdict unless the learner’s current public move genuinely settles the public question.',
    'If you do state or confirm the final verdict, explicitly close the case instead of returning to another proof prompt.',
    frame.allowCheckIn
      ? 'After closing, you may ask one optional final check-in about a link to revisit; it must be the only question.'
      : 'If you close, do not ask a follow-up question.',
    'If the learner has not settled the public question, continue normally without pretending the dialogue is closed.',
    '[End tutor-only dialogue closure]',
  ].join('\n');
}

function createLearnerDagState({ enabled, resolved, world, dropout = null }) {
  const board = new Map();
  if (world) {
    for (const fact of world.background || []) board.set(factKey(fact), fact);
  }
  return {
    enabled,
    resolved,
    dropout: createTutorStubDagFactDropoutState(dropout || {}),
    record: {
      board,
      voiced: [],
      voicedKeys: new Set(),
      hypotheses: [],
      snapshots: [],
    },
  };
}

function trimHistory(messages, turns) {
  const safeTurns = Math.max(0, Number(turns) || 0);
  return messages.slice(-(safeTurns * 2));
}

function rawPublicTurnTranscript(turns, limit) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  const recent = safeLimit > 0 ? turns.slice(-safeLimit) : [];
  if (recent.length === 0) return 'No previous turns in the raw recent window.';
  return recent
    .map((turn, index) => {
      const absoluteTurn = turns.length - recent.length + index + 1;
      return [`Turn ${absoluteTurn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`].join('\n');
    })
    .join('\n\n');
}

function signedMemoryValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  return `${Number(value) >= 0 ? '+' : ''}${value}`;
}

function publicDialogueMemorySummary(state, { includeAnalysis = true } = {}) {
  const turns = state?.turns || [];
  if (turns.length === 0) return 'No previous public dialogue to summarize.';

  const rawWindow = Math.max(0, Number(state?.historyTurns ?? STUB.historyTurns) || 0);
  const older = rawWindow > 0 ? turns.slice(0, Math.max(0, turns.length - rawWindow)) : turns;
  const latest = turns.at(-1);
  const latestClassification = latest?.classification || {};
  const lines = [
    '[Compact public dialogue memory]',
    `Completed public turns: ${turns.length}; raw recent window: ${Math.min(rawWindow, turns.length)} turn(s).`,
    older.length ? `Older turns compressed: 1-${older.length}.` : 'Older turns compressed: none yet.',
  ];

  if (older.length) {
    lines.push('Older public milestones:');
    for (const turn of older.slice(-6)) {
      lines.push(
        `- T${turn.turn}: learner ${oneLine(turn.learner, { max: 120 })}; tutor ${oneLine(turn.tutor, {
          max: 150,
        })}`,
      );
    }
  }

  if (includeAnalysis && latest) {
    lines.push('Latest public learner analysis:');
    lines.push(`- This turn: ${latestClassification.turn?.summary || oneLine(latest.learner, { max: 160 })}`);
    lines.push(`- Overall: ${latestClassification.overall?.summary || 'No public overall summary yet.'}`);
    lines.push(
      `- Trajectory: ${
        latestClassification.overall?.trajectory ||
        latestClassification.overall?.current_state ||
        'No public trajectory summary yet.'
      }`,
    );
    lines.push(
      `- Next likely need: ${
        latestClassification.turn?.pedagogical_need ||
        latestClassification.overall?.next_best_tutor_move ||
        'Ask one concrete evidence-generating question.'
      }`,
    );
  }

  lines.push('[End compact public dialogue memory]');
  return lines.join('\n');
}

function compactPublicTranscriptForPrompt(state, limit, { includeAnalysis = true } = {}) {
  const turns = state?.turns || [];
  const rawTranscript = rawPublicTurnTranscript(turns, limit);
  if (!state?.memory?.enabled || turns.length === 0) return rawTranscript;
  return [
    publicDialogueMemorySummary(state, { includeAnalysis }),
    '[Raw recent public transcript]',
    rawTranscript,
    '[End raw recent public transcript]',
  ].join('\n\n');
}

function tutorDialogueMemorySummary(state, { currentTutorTurn, historyTurns } = {}) {
  const turns = state?.turns || [];
  if (!state?.memory?.enabled || turns.length === 0) return '';

  const latest = turns.at(-1);
  const classification = latest?.classification || {};
  const model = state.learnerDag?.lastModel || latest?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const field = buildLightweightDialogueField(turns);
  const final = field.summary.final || {};
  const delta = field.summary.fieldDelta || {};
  const latestRow = field.rows.at(-1) || null;
  const previousRow = field.rows.at(-2) || null;
  const registerCounts = compactCounts(
    countBy(
      state.register?.history || [],
      (entry) => normalizeStoredRegisterSelection(entry)?.selected_register || 'unknown',
    ),
    { limit: 6 },
  );
  const latestRegister = latestRegisterSelection(state);
  const comprehension = tutorStubComprehensionFeatures(state.comprehension, {
    turn: currentTutorTurn || turns.length + 1,
  });

  return [
    '[Tutor-only compact dialogue memory]',
    `Current tutor turn: ${currentTutorTurn || turns.length + 1}; completed prior turns: ${turns.length}; raw recent window: ${Math.min(
      Number(historyTurns ?? state.historyTurns ?? STUB.historyTurns) || 0,
      turns.length,
    )} turn(s).`,
    `Case status: ${dialogueCaseStatus(latest)}`,
    `Latest learner move: ${classification.turn?.summary || oneLine(latest?.learner, { max: 160 })}`,
    `Overall learner trajectory: ${
      classification.overall?.trajectory || classification.overall?.summary || 'No trajectory summary yet.'
    }`,
    `Learner-DAG assessment: coverage ${assessment.bestPathCoverage ?? 'unknown'}, grounded ${
      metrics.groundedCount ?? 0
    }, missing ${metrics.missingPremiseCount ?? 0}, bottleneck ${assessment.bottleneck || 'unknown'}.`,
    `Field final: mastery ${final.learnerMastery ?? 'n/a'}, risk ${final.learnerRisk ?? 'n/a'}, alignment ${
      final.tutorAlignment ?? 'n/a'
    }, momentum ${final.jointMomentum ?? 'n/a'}, coverage ${final.coverage ?? 'n/a'}.`,
    `Field movement: mastery ${signedMemoryValue(delta.learnerMastery)}, risk ${signedMemoryValue(
      delta.learnerRisk,
    )}, alignment ${signedMemoryValue(delta.tutorAlignment)}, momentum ${signedMemoryValue(delta.jointMomentum)}; ${
      latestRow ? describeFieldShift(latestRow, previousRow, field.summary) : 'no field row yet'
    }`,
    `Engagement-stance history: ${registerCounts}; latest ${
      latestRegister?.engagement_stance || latestRegister?.selected_register || 'none yet'
    }.`,
    `Latest independent response axes: action ${latestRegister?.action_family || 'none'}; audience ${
      latestRegister?.audience_register || 'unknown'
    }; lexical ${latestRegister?.lexical_accessibility || 'unknown'}; scene ${
      latestRegister?.scene_immersion || 'unknown'
    }.`,
    `Comprehension side-state: unresolved ${
      comprehension.unresolvedTerms.length ? comprehension.unresolvedTerms.join(', ') : 'none'
    }; explained ${comprehension.explainedTerms.length ? comprehension.explainedTerms.join(', ') : 'none'}; language opacity ${
      comprehension.languageOpacity
    }. This state does not advance the learner DAG.`,
    'Use this as compressed continuity. The raw recent transcript below controls exact wording and immediate turn-taking.',
    'Do not mention memory summaries, fields, DAGs, coverage, hidden paths, or internal state to the learner.',
    '[End tutor-only compact dialogue memory]',
  ].join('\n');
}

function classifierTutorContext(classification) {
  if (!classification) return '';
  return [
    '[Tutor-only learner classifier]',
    `This turn: ${classification.turn?.summary || 'No turn summary.'}`,
    `Overall: ${classification.overall?.summary || 'No overall summary.'}`,
    `Discourse move: ${classification.turn?.discourse_move || 'unknown'}`,
    `Evidence use: ${classification.turn?.evidence_use || 'unknown'}`,
    `Epistemic stance: ${classification.turn?.epistemic_stance || 'unknown'}`,
    `Immediate pedagogical need: ${
      classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || 'unknown'
    }`,
    'Use this as advisory context. Do not mention classifier labels, scores, rubrics, or hidden analysis to the learner.',
    '[End tutor-only learner classifier]',
  ].join('\n');
}

function dagNodeFact(node) {
  const content = node?.statement?.content || {};
  if (content.rel === 'holds_L') return content.fact;
  if (content.rel === 'grounded_L') return content.of;
  return node?.fact || null;
}

function dagNodeLabel(node) {
  if (!node) return 'unknown';
  const fact = dagNodeFact(node);
  const renderedFact = fact ? factText(fact) : node.id;
  if (node.leaf) return `hold:${node.premiseId || renderedFact}`;
  return `ground:${renderedFact}`;
}

function buildTutorDagSnapshot(state, tutorTurn) {
  if (!state.dag || !state.world || !state.tutorDag) return null;
  const world = state.world;
  const dag = state.tutorDag;
  const nodesById = new Map((dag.nodes || []).map((node) => [node.id, node]));
  const releaseByPremise = new Map(world.releaseSchedule.map((entry) => [entry.premise, entry]));
  const releasedPremises = new Set(
    world.releaseSchedule.filter((entry) => entry.turn <= tutorTurn).map((entry) => entry.premise),
  );
  const leaves = (dag.leaves || []).map((premiseId) => {
    const premise = world.premiseById.get(premiseId);
    const release = releaseByPremise.get(premiseId);
    return {
      premise: premiseId,
      fact: premise ? factText(premise.fact) : premiseId,
      released: releasedPremises.has(premiseId),
      scheduledTurn: release?.turn ?? null,
      via: release?.via || null,
    };
  });
  const nextRelease = world.releaseSchedule.find((entry) => entry.turn > tutorTurn) || null;
  const nodes = (dag.nodes || []).map((node) => ({
    id: node.id,
    label: dagNodeLabel(node),
    origin: node.origin,
    rule: node.rule || null,
    leaf: Boolean(node.leaf),
    premise: node.premiseId || null,
    fact: dagNodeFact(node) ? factText(dagNodeFact(node)) : null,
  }));
  const edges = (dag.edges || []).map((edge) => ({
    from: edge.from,
    to: edge.to,
    fromLabel: dagNodeLabel(nodesById.get(edge.from)),
    toLabel: dagNodeLabel(nodesById.get(edge.to)),
    rule: edge.rule || null,
  }));

  return {
    schema: dag.schema,
    turn: tutorTurn,
    derivable: Boolean(dag.derivable),
    root: dag.root,
    rootLabel: dagNodeLabel(nodesById.get(dag.root)),
    leavesReleased: leaves.filter((leaf) => leaf.released).length,
    leavesTotal: leaves.length,
    nextRelease: nextRelease
      ? {
          premise: nextRelease.premise,
          turn: nextRelease.turn,
          via: nextRelease.via,
        }
      : null,
    leaves,
    nodes,
    edges,
  };
}

function printTutorDagSnapshot(snapshot) {
  if (!snapshot) return;
  console.log(
    `${C.cyan}tutor DAG >${C.reset} turn ${snapshot.turn}: ${snapshot.leavesReleased}/${snapshot.leavesTotal} proof leaves released`,
  );
  if (!snapshot.derivable) {
    console.log(`${C.dim}  not derivable from this world's authored proof data${C.reset}\n`);
    return;
  }
  console.log(`${C.dim}  root: ${snapshot.rootLabel}${C.reset}`);
  if (snapshot.nextRelease) {
    console.log(
      `${C.dim}  next release: ${snapshot.nextRelease.premise} at turn ${snapshot.nextRelease.turn} via ${snapshot.nextRelease.via}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}  next release: none${C.reset}`);
  }

  console.log(`${C.dim}  edges:${C.reset}`);
  for (const edge of snapshot.edges) {
    console.log(`${C.dim}    ${edge.fromLabel} -> ${edge.toLabel}${edge.rule ? ` (${edge.rule})` : ''}${C.reset}`);
  }

  console.log(`${C.dim}  leaves:${C.reset}`);
  for (const leaf of snapshot.leaves) {
    const status = leaf.released ? 'x' : ' ';
    const schedule = leaf.scheduledTurn ? `t${leaf.scheduledTurn}/${leaf.via}` : 'unscheduled';
    console.log(`${C.dim}    [${status}] ${leaf.premise} ${schedule}: ${leaf.fact}${C.reset}`);
  }
  console.log();
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactFactRow(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  if (row.surface) return row.surface;
  if (row.text) return row.text;
  if (row.fact) return factText(row.fact);
  if (row.premise) return row.premise;
  return JSON.stringify(row);
}

function printAnalysisLine(label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  console.log(`${C.dim}  ${label}: ${text}${C.reset}`);
}

function printAnalysisList(label, rows, { limit = 5 } = {}) {
  const visible = Array.isArray(rows) ? rows.map(compactFactRow).filter(Boolean).slice(-limit) : [];
  if (!visible.length) return;
  console.log(`${C.dim}  ${label}:${C.reset}`);
  for (const row of visible) {
    console.log(`${C.dim}    - ${oneLine(row)}${C.reset}`);
  }
}

function printInteractiveHelp() {
  console.log(
    `${C.cyan}slash commands >${C.reset} /analysis [technical], /a [technical], /field, /f, /viz, /v, /clarify [phrase], /explain [phrase], /report, /r, /settings [temp n|dropout n], /id, /profile [list|example|id|default|custom text], /clue, /hint, /suggest, /use, /regen, /clear, /help, /quit`,
  );
  console.log(
    `${C.dim}  /settings temp 0.4 sharpens only the dominant engagement stance. /settings dropout 0.15 enables seeded loss of accumulated DAG facts; 0 turns it off. Tab names the profile; /suggest shows its profile expression; /use repeats the profile expression before sending.${C.reset}\n`,
  );
}

function registerTemperatureApplies(policy) {
  return REGISTER_TEMPERATURE_POLICIES.has(String(policy || ''));
}

function plainPolicyLabel(policy) {
  const labels = {
    continuous_dynamical_system: 'continuous adaptive blend',
    continuous_empirical_dynamical_system: 'continuous adaptive blend with cross-run evidence',
    dynamical_system: 'adaptive weighted choice',
    empirical_dynamical_system: 'adaptive weighted choice with cross-run evidence',
    trajectory: 'trajectory-aware choice',
    field: 'current interaction-state choice',
    state: 'classifier and reasoning-state choice',
    dynamic: 'model-reviewed adaptive choice',
    bland: 'fixed plain baseline',
    random: 'random control',
    negative: 'negative-register control',
  };
  return labels[policy] || String(policy || 'unknown policy').replaceAll('_', ' ');
}

function plainPolicySignal(axis) {
  const labels = {
    evidence_gap: 'the learner still needs public evidence',
    warrant_gap: 'a reasoning link is missing',
    agency_deficit: 'the learner needs more ownership of the next move',
    affective_risk: 'the learner may feel exposed or pressured',
    recognition_pressure: 'the response should acknowledge the learner’s independence',
    coercion_risk: 'the tutor should avoid forcing agreement',
    integration_need: 'the learner needs help connecting the pieces',
    compression_need: 'the next move should be simpler and shorter',
    language_opacity: 'the learner has encountered unclear or unfamiliar wording',
    momentum: 'the dialogue has useful forward movement',
    stagnation: 'the dialogue risks stalling',
    disruption_need: 'the current pattern needs a gentle interruption',
    tempo_affordance: 'the learner appears ready to move faster',
    closure_pressure: 'the dialogue is nearing a conclusion',
    field_regression: 'the learner’s engagement has slipped',
    empirical_uncertainty: 'there is little evidence yet about which style works best here',
  };
  return labels[axis] || String(axis || '').replaceAll('_', ' ');
}

function dominantPlainPolicySignals(registerSelection, { limit = 3 } = {}) {
  const vector = registerSelection?.dynamical_system_policy?.state_vector || {};
  return Object.entries(vector)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0.15)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([axis]) => plainPolicySignal(axis));
}

function plainStrategyText(value) {
  return String(value || '')
    .replace(/learner-DAG/giu, 'learner’s reasoning')
    .replace(/DAG/gu, 'reasoning map')
    .replace(/proof-state/giu, 'reasoning')
    .replace(/public premise/giu, 'piece of public evidence')
    .replace(/learner-owned record/giu, 'learner’s stated reasoning')
    .replace(/low-agency compliance/giu, 'passive agreement')
    .replace(/learner-owned public move/giu, 'response in the learner’s own words')
    .replace(/coercion pressure/giu, 'pressure to agree')
    .replace(/final secret/giu, 'final conclusion');
}

function printCurrentTurnAnalysis(state, { technical = false } = {}) {
  if (technical) return printCurrentTurnTechnicalAnalysis(state);
  const turn = state.turns[state.turns.length - 1] || null;
  if (!turn) {
    console.log(`${C.cyan}analysis >${C.reset} no completed turns yet`);
    console.log(
      `${C.dim}  enter a learner turn first, then use /analysis; add "technical" for debugging evidence${C.reset}\n`,
    );
    return;
  }

  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const registerSelection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const previousEfficacy = normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null);
  const policy = registerSelection?.policy || state.register?.policy || 'off';
  const distribution = formatEngagementStanceDistribution(registerSelection?.distribution, { limit: 4 });
  const signals = dominantPlainPolicySignals(registerSelection);
  const generousInference = turn.generousInference || turn.humanDiscourseFrame?.generousInference || null;
  const dialogueClosure = turn.dialogueClosure || null;
  const comprehension = turn.comprehension?.beforeTutor?.features || null;
  const dagFactDropout = turn.dagFactDropout || null;

  console.log(`${C.cyan}analysis >${C.reset} turn ${turn.turn}`);
  printAnalysisLine('learner said', turn.learner);
  printAnalysisLine(
    'plain reading',
    turnAnalysis.summary || overall.summary || 'No plain-language reading is available.',
  );
  if (generousInference?.applied) {
    printAnalysisLine('generous inference', 'accepted the short answer in context; the local question counts as answered');
    printAnalysisLine('what was carried forward', generousInference.resolvedMeaning);
  }
  if (dialogueClosure?.lifecycle?.phase && dialogueClosure.lifecycle.phase !== 'open') {
    printAnalysisLine(
      'dialogue ending',
      dialogueClosure.lifecycle.phase === 'awaiting_checkin'
        ? 'the public verdict has closed the proof sequence; one optional check-in remains'
        : 'the tutor has explicitly closed the inquiry',
    );
  }
  if (Number(comprehension?.pressure || 0) > 0) {
    printAnalysisLine(
      'wording gap',
      comprehension.unresolvedTerms?.length
        ? `the learner asked about ${comprehension.unresolvedTerms.join(', ')}`
        : 'the learner recently asked for plainer wording',
    );
  }
  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.activeDropped?.length) {
    printAnalysisLine(
      'memory pressure',
      dagFactDropout.droppedNow?.length
        ? `${dagFactDropout.droppedNow.length} previously accumulated evidence item(s) slipped on this turn; the tutor should re-anchor without turning it into a memory test`
        : `${dagFactDropout.activeDropped.length} accumulated evidence item(s) remain out of the learner’s active reasoning record`,
    );
  } else if (dagFactDropout?.repairedNow?.length) {
    printAnalysisLine('memory recovery', `${dagFactDropout.repairedNow.length} dropped evidence item(s) were re-adopted`);
  }
  printAnalysisLine('policy', `${plainPolicyLabel(policy)}${policy === 'off' ? '' : ` (${policy})`}`);
  if (registerSelection) {
    printAnalysisLine(
      'engagement stance',
      distribution || registerSelection.engagement_stance || registerSelection.selected_register || 'No stance was stored.',
    );
    printAnalysisLine('response action', registerSelection.action_family || 'No action family was stored.');
    printAnalysisLine(
      'audience and language',
      `${registerSelection.audience_register || 'unknown audience'}; ${
        registerSelection.lexical_accessibility || 'unknown lexical accessibility'
      }`,
    );
    printAnalysisLine('scene', registerSelection.scene_immersion || 'unknown scene immersion');
    if (turn.responseConfigurationAudit) {
      printAnalysisLine(
        'visible configuration',
        `${turn.responseConfigurationAudit.visible_axis_count}/${turn.responseConfigurationAudit.axis_count} axes visible in the tutor wording`,
      );
    }
    if (signals.length) {
      console.log(`${C.dim}  why this policy leaned that way:${C.reset}`);
      for (const signal of signals) console.log(`${C.dim}    - ${signal}${C.reset}`);
    } else {
      printAnalysisLine('why', registerSelection.reviewer_signal || turnAnalysis.pedagogical_need);
    }
    printAnalysisLine(
      'tutor’s immediate aim',
      plainStrategyText(
        registerSelection.expected_field_move || overall.next_best_tutor_move || turnAnalysis.pedagogical_need,
      ),
    );
    printAnalysisLine('reasoning aim', plainStrategyText(registerSelection.expected_dag_move));
  } else {
    printAnalysisLine(
      'tutor’s immediate aim',
      plainStrategyText(overall.next_best_tutor_move || turnAnalysis.pedagogical_need),
    );
  }
  if (previousEfficacy) {
    const result =
      previousEfficacy.label === 'positive_progress'
        ? 'helped the learner move forward'
        : previousEfficacy.label === 'regression_or_overreach'
          ? 'was followed by regression or overreach'
          : 'did not yet produce clear reasoning progress';
    printAnalysisLine('last strategy result', `${previousEfficacy.selected_register}: ${result}`);
  }
  if (turn.tutorLeakAudit && !turn.tutorLeakAudit.ok) {
    printAnalysisLine('safety check', 'the first tutor draft revealed too much and was repaired or replaced');
  }
  if (turn.tutorResponseRepaired && generousInference?.applied) {
    printAnalysisLine('response guard', 'an initial tutor draft failed a safety or scaffold check and was replaced before display');
  }
  console.log(`${C.dim}  more evidence: /analysis technical (or /a technical)${C.reset}\n`);
}

function printCurrentTurnTechnicalAnalysis(state) {
  const turn = state.turns[state.turns.length - 1] || null;
  if (!turn) {
    console.log(`${C.cyan}analysis >${C.reset} no completed turns yet`);
    console.log(
      `${C.dim}  enter a learner turn first, then use /analysis to inspect the stored classifier, learner-DAG, register, and tutor-DAG data${C.reset}\n`,
    );
    return;
  }

  const classification = turn.classification || null;
  const turnAnalysis = classification?.turn || {};
  const overall = classification?.overall || {};
  const conceptual = scoreValue(turnAnalysis.scores?.conceptual_engagement);
  const readiness = scoreValue(turnAnalysis.scores?.epistemic_readiness);
  const learnerDagModel = turn.tutorLearnerDagModel || null;
  const metrics = learnerDagModel?.metrics || {};
  const assessment = learnerDagModel?.assessment || {};
  const learnerRecord = learnerDagModel?.learnerRecord || {};
  const update = turn.tutorLearnerDagUpdate || null;
  const accepted = update?.accepted || {};
  const rejected = update?.rejected || [];
  const extractor = update?.extractor || {};
  const registerSelection = normalizeStoredRegisterSelection(turn.registerSelection || null);
  const selectedEfficacy = registerSelection?.efficacy || null;
  const previousEfficacy = normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null);
  const tracePath = traceDisplayPath(state.trace);
  const comprehension = turn.comprehension?.beforeTutor || null;
  const dagFactDropout = turn.dagFactDropout || null;
  const field = buildLightweightDialogueField(state.turns);
  const fieldRow = field.rows.at(-1) || null;
  const previousFieldRow = field.rows.at(-2) || null;
  const firstFieldRow = field.rows[0] || null;

  console.log(
    `${C.cyan}analysis technical >${C.reset} current completed turn ${turn.turn}; id ${turn.turnId || turnDebugId(state, turn.turn)}`,
  );
  printAnalysisLine('learner', turn.learner);
  if (comprehension?.features) {
    printAnalysisLine(
      'comprehension side-state',
      `pressure=${comprehension.features.pressure}; unresolved=${
        comprehension.features.unresolvedTerms?.join(',') || 'none'
      }; explained=${comprehension.features.explainedTerms?.join(',') || 'none'}; advancesDAG=false`,
    );
  }
  if (dagFactDropout) {
    printAnalysisLine(
      'DAG fact dropout',
      `rate=${dagFactDropout.configuredRate}; seed=${dagFactDropout.seed}; eligible=${dagFactDropout.eligibleCount}; droppedNow=${
        dagFactDropout.droppedNow?.map((row) => row.premiseId).join(',') || 'none'
      }; repairedNow=${dagFactDropout.repairedNow?.map((row) => row.premiseId).join(',') || 'none'}; active=${
        dagFactDropout.activeDropped?.map((row) => row.premiseId).join(',') || 'none'
      }; visibility=conduct`,
    );
  }

  if (classification) {
    printAnalysisLine('did this turn', turnAnalysis.summary || 'No turn summary.');
    printAnalysisLine('did overall', overall.summary || 'No overall summary.');
    printAnalysisLine('logical request type', turnAnalysis.request_type || 'unknown_request');
    printAnalysisLine(
      'rubric',
      `move=${turnAnalysis.discourse_move || 'unknown'}; stance=${turnAnalysis.epistemic_stance || 'unknown'}; evidence=${
        turnAnalysis.evidence_use || 'unknown'
      }; agency=${turnAnalysis.agency || 'unknown'}; conceptual=${conceptual}/5; readiness=${readiness}/5`,
    );
    printAnalysisLine('trajectory', overall.trajectory);
    printAnalysisLine('current state', overall.current_state);
    printAnalysisLine('next tutor move', overall.next_best_tutor_move || turnAnalysis.pedagogical_need);
    if (classification.error || classification.parseError) {
      printAnalysisLine('classifier warning', classification.error || classification.parseError);
    }
  } else {
    printAnalysisLine('classifier', state.classifier?.enabled ? 'no classifier output stored for this turn' : 'off');
  }

  if (learnerDagModel) {
    printAnalysisLine(
      'learner-DAG',
      `coverage=${assessment.bestPathCoverage ?? 'n/a'}; bottleneck=${assessment.bottleneck || 'unknown'}; grounded=${
        metrics.groundedCount || 0
      }; voiced=${metrics.voicedDerivedCount || 0}; hypotheses=${metrics.hypothesisCount || 0}; missing=${
        metrics.missingPremiseCount || 0
      }`,
    );
    if (update) {
      printAnalysisLine(
        'learner-record update',
        `adopted=${accepted.adopt?.length || 0}; derived=${accepted.derive?.length || 0}; retracted=${
          accepted.retract?.length || 0
        }; hypothesis=${accepted.hypothesis ? 'yes' : 'no'}; assertedAnswer=${accepted.assertAnswer || 'none'}`,
      );
      if (rejected.length)
        printAnalysisLine('learner-record rejected', `${rejected.length} extractor item(s) rejected`);
      if (extractor.error || extractor.parseError)
        printAnalysisLine('learner-record warning', extractor.error || extractor.parseError);
    }
    printAnalysisList('grounded public record', learnerRecord.grounded);
    printAnalysisList('learner hypotheses', learnerRecord.hypotheses);
    printAnalysisList('answer candidates', learnerRecord.answerCandidates);
  } else {
    printAnalysisLine('learner-DAG', state.learnerDag?.enabled ? 'no learner-DAG model stored for this turn' : 'off');
  }

  if (registerSelection) {
    const confidence =
      registerSelection.confidence === null || registerSelection.confidence === undefined
        ? ''
        : `; confidence=${registerSelection.confidence}`;
    printAnalysisLine(
      'engagement stance',
      `${registerSelection.engagement_stance || registerSelection.selected_register}${confidence}`,
    );
    printAnalysisLine(
      'stance temperature',
      `${registerSelection.temperature ?? state.register?.temperature ?? 'n/a'} (engagement stance only; lower sharper, higher broader)`,
    );
    printAnalysisLine(
      'logical request type',
      registerSelection.request_type || registerSelection.learner_signal || 'unknown',
    );
    printAnalysisLine('action family', registerSelection.action_family || 'none');
    printAnalysisLine('audience register', registerSelection.audience_register || 'unknown');
    printAnalysisLine('lexical accessibility', registerSelection.lexical_accessibility || 'unknown');
    printAnalysisLine('scene immersion', registerSelection.scene_immersion || 'unknown');
    if (registerSelection.legacy_selected_register) {
      printAnalysisLine('legacy register alias', registerSelection.legacy_selected_register);
    }
    printAnalysisLine('reviewer signal', registerSelection.reviewer_signal || 'unknown');
    printAnalysisLine('register reason', registerSelection.register_reason);
    printAnalysisLine('expected DAG move', registerSelection.expected_dag_move);
    printAnalysisLine(
      registerSelection.policy === 'state' ? 'expected state move' : 'expected field move',
      registerSelection.expected_field_move,
    );
    printAnalysisLine('expected progress marker', registerSelection.expected_progress_marker);
    const distribution = formatEngagementStanceDistribution(registerSelection.distribution, { limit: 7 });
    if (distribution) printAnalysisLine('engagement-stance distribution', distribution);
    if (registerSelection.field_policy?.features) {
      const features = registerSelection.field_policy.features;
      printAnalysisLine(
        'field policy',
        `relation=${features.field?.relation || 'unknown'}; fieldDelta=${
          features.field?.delta ?? 'n/a'
        }; dagScore=${features.dag?.progressScore ?? 'n/a'}; bottleneck=${features.dag?.bottleneck || 'unknown'}`,
      );
    }
    if (registerSelection.trajectory_policy?.trajectory) {
      const trajectory = registerSelection.trajectory_policy.trajectory;
      const flags = Object.entries(trajectory.flags || {})
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(',');
      printAnalysisLine(
        'trajectory policy',
        `fieldSlope=${trajectory.field?.slope ?? 'n/a'}; dagSlope=${
          trajectory.dag?.slope ?? 'n/a'
        }; riskSlope=${trajectory.risk?.slope ?? 'n/a'}; flags=${flags || 'none'}`,
      );
    }
    if (registerSelection.dynamical_system_policy?.state_vector) {
      const policy = registerSelection.dynamical_system_policy;
      const vector = topNumericEntries(policy.state_vector, { limit: 4 }).join(', ');
      const attractors = topNumericEntries(policy.attractors, { limit: 3 }).join(', ');
      printAnalysisLine('dynamical policy', `vector=${vector || 'none'}; attractors=${attractors || 'none'}`);
      if (policy.corpus_empirical?.enabled) {
        const corrections = topNumericEntries(policy.corpus_empirical.corrections, { limit: 4, abs: true }).join(', ');
        printAnalysisLine('corpus prior', `corrections=${corrections || 'none'}`);
      } else if (policy.corpus_empirical?.reason) {
        printAnalysisLine('corpus prior', policy.corpus_empirical.reason);
      }
    }
    if (registerSelection.state_policy?.features) {
      const features = registerSelection.state_policy.features;
      printAnalysisLine(
        'state policy',
        `bottleneck=${features.dag?.bottleneck || 'unknown'}; coverage=${
          features.dag?.bestPathCoverage ?? 'n/a'
        }; missing=${features.dag?.missingPremiseCount ?? 'n/a'}; surface=${features.scores?.learnerSurface ?? 'n/a'}`,
      );
    }
    if (selectedEfficacy) {
      printAnalysisLine(
        'selected register efficacy',
        `${selectedEfficacy.label}; score=${selectedEfficacy.progressScore}; ${
          selectedEfficacy.mismatch || 'field-state unknown'
        }; fieldDelta=${selectedEfficacy.field?.delta ?? 'n/a'}; ${selectedEfficacy.summary}`,
      );
    } else {
      printAnalysisLine('selected register efficacy', 'pending the next learner turn');
    }
  } else {
    printAnalysisLine('selected register', state.register?.enabled ? 'none stored for this turn' : 'off');
  }
  if (turn.responseConfigurationAudit) {
    const audit = turn.responseConfigurationAudit;
    printAnalysisLine(
      'configuration realization',
      `${audit.visible_axis_count}/${audit.axis_count}; rate=${audit.realization_rate}; transcriptVisible=${audit.transcript_visible}`,
    );
    printAnalysisLine(
      'visible axes',
      Object.entries(audit.axes || {})
        .map(([axis, value]) => `${axis}=${value.visible ? 'yes' : 'no'}`)
        .join('; '),
    );
  }
  if (previousEfficacy) {
    printAnalysisLine(
      'previous register efficacy',
      `${previousEfficacy.selected_register}: ${previousEfficacy.label}; score=${previousEfficacy.progressScore}; ${
        previousEfficacy.mismatch || 'field-state unknown'
      }; fieldDelta=${previousEfficacy.field?.delta ?? 'n/a'}; ${previousEfficacy.summary}`,
    );
  }

  if (fieldRow) {
    printAnalysisLine(
      'field state',
      `mastery=${fieldRow.learnerMastery}; risk=${fieldRow.learnerRisk}; alignment=${fieldRow.tutorAlignment}; momentum=${fieldRow.jointMomentum}; speed=${fieldRow.speed}`,
    );
    printAnalysisLine('field shift', summarizeFieldShift(fieldRow, previousFieldRow, firstFieldRow));
    printAnalysisLine('field reading', describeFieldShift(fieldRow, previousFieldRow, field.summary));
  }

  if (turn.tutorLeakAudit) {
    const leaks = turn.tutorLeakAudit.leaks || [];
    printAnalysisLine('leak guard', turn.tutorLeakAudit.ok ? 'ok' : `${leaks.length} leak(s) found after repair/audit`);
    for (const leak of leaks.slice(0, 3)) {
      printAnalysisLine(`leak ${leak.type || 'unknown'}`, leak.reason);
    }
  }

  if (turn.tutorDag) {
    printTutorDagSnapshot(turn.tutorDag);
  } else {
    printAnalysisLine('tutor DAG', state.dag ? 'no snapshot stored for this turn' : 'off');
  }

  if (turn.humanDiscourseFrame) {
    const frame = turn.humanDiscourseFrame;
    const scaffold = frame.scaffoldState || {};
    const proofDebt = frame.proofDebt || {};
    const audit = frame.warrantPremiseAudit || {};
    const generousInference = frame.generousInference || {};
    printAnalysisLine(
      'human scaffold',
      `${frame.mode}; branch=${scaffold.branch?.label || scaffold.branch?.id || 'none'}; sideArc=${
        frame.sideArc?.detected ? frame.sideArc.type : 'none'
      }; proofDebt=${proofDebt.status || 'unknown'}`,
    );
    printAnalysisLine('local question', scaffold.localQuestion);
    printAnalysisLine(
      'generous inference',
      generousInference.applied
        ? `applied; kind=${generousInference.kind}; confidence=${generousInference.confidence}; ${generousInference.reason}`
        : `not applied; ${generousInference.reason || 'no contextual resolution recorded'}`,
    );
    if (generousInference.applied) {
      printAnalysisLine('resolved meaning', generousInference.resolvedMeaning);
      printAnalysisLine('spoken-turn override', generousInference.tutorInstruction);
    }
    if (turn.tutorHumanScaffoldAudit) {
      printAnalysisLine(
        'human-scaffold response guard',
        turn.tutorHumanScaffoldAudit.ok
          ? `ok; semantic re-question similarity=${turn.tutorHumanScaffoldAudit.similarity ?? 0}`
          : `${turn.tutorHumanScaffoldAudit.issues?.length || 0} issue(s) remained`,
      );
    }
    if (audit.counts) {
      printAnalysisLine(
        'warrant stocktake',
        `explicit=${audit.counts.explicitWarrants || 0}; implied=${audit.counts.impliedWarrants || 0}; missing=${
          audit.counts.missingWarrants || 0
        }; suppressed=${audit.counts.suppressedPremises || 0}; commonsense=${audit.counts.commonSenseBridges || 0}`,
      );
    }
  }

  if (turn.dialogueClosure) {
    const closure = turn.dialogueClosure;
    printAnalysisLine(
      'dialogue closure',
      `frame=${closure.frame?.phase || 'open'}; basis=${closure.frame?.basis || closure.lifecycle?.basis || 'none'}; lifecycle=${
        closure.lifecycle?.phase || 'open'
      }; strictGrounded=${closure.frame?.strictGrounded === true}; authoredDagSatisfied=${
        closure.frame?.authoredDagSatisfied === true
      }`,
    );
    if (closure.audit) {
      printAnalysisLine(
        'closure response guard',
        `ok=${closure.audit.ok}; closes=${closure.audit.closesDialogue}; checkIn=${closure.audit.invitesCheckIn}; issues=${
          closure.audit.issues?.length || 0
        }`,
      );
    }
  }

  printAnalysisLine('trace', tracePath);
  console.log();
}

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function fieldScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? clampField01(numeric / 5) : 0;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

function fieldBar(value, { width = 12 } = {}) {
  const filled = Math.round(clampField01(value) * width);
  return `${'#'.repeat(filled)}${'.'.repeat(Math.max(0, width - filled))}`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function wordsInText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function lightweightFieldTurn(turn, previous = null) {
  const classification = turn?.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const register = turn?.registerSelection || {};
  const priorEfficacy = turn?.previousRegisterEfficacy || null;
  const leakOk = !turn?.tutorLeakAudit || turn.tutorLeakAudit.ok === true;
  const conceptual = fieldScore(scores.conceptual_engagement);
  const readiness = fieldScore(scores.epistemic_readiness);
  const coverage = clampField01(Number(assessment.bestPathCoverage || 0));
  const grounded = clampField01(Number(metrics.groundedCount || 0) / 8);
  const missing = clampField01(Number(metrics.missingPremiseCount || 0) / 8);
  const overreach =
    /overconfident|answer_seeking|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported|resistant/iu.test(
      [turnAnalysis.epistemic_stance, turnAnalysis.evidence_use, assessment.bottleneck, priorEfficacy?.label]
        .filter(Boolean)
        .join(' '),
    )
      ? 0.25
      : 0;
  const responseWords = wordsInText(turn?.tutor);
  const brevity = clampField01(1 - Math.max(0, responseWords - 95) / 130);
  const registerConfidence = Number.isFinite(Number(register.confidence))
    ? clampField01(Number(register.confidence))
    : 0.5;
  const efficacyScore = priorEfficacy ? clampField01((Number(priorEfficacy.progressScore || 0) + 4) / 8) : 0.5;

  const learnerMastery = roundField(0.34 * conceptual + 0.26 * readiness + 0.3 * coverage + 0.1 * grounded);
  const learnerRisk = roundField(clampField01(0.45 * missing + 0.25 * (1 - readiness) + overreach));
  const tutorAlignment = roundField(
    clampField01(0.3 * registerConfidence + 0.24 * efficacyScore + 0.22 * brevity + 0.24 * (leakOk ? 1 : 0)),
  );
  const jointMomentum = roundField(
    clampField01(
      0.42 * Math.max(0, fieldDelta(learnerMastery, previous?.learnerMastery)) +
        0.28 * Math.max(0, fieldDelta(coverage, previous?.coverage)) +
        0.18 * efficacyScore +
        (0.12 * (turn?.tutorDag?.leavesReleased || 0)) / Math.max(1, turn?.tutorDag?.leavesTotal || 1),
    ),
  );

  return {
    turn: turn.turn,
    learnerMastery,
    learnerRisk,
    tutorAlignment,
    jointMomentum,
    coverage,
    groundedCount: Number(metrics.groundedCount || 0),
    missingCount: Number(metrics.missingPremiseCount || 0),
    conceptual,
    readiness,
    register: register.selected_register || null,
    bottleneck: assessment.bottleneck || 'unknown',
    learnerMove: turnAnalysis.discourse_move || 'unknown',
    speed: previous
      ? roundField(
          Math.sqrt(
            fieldDelta(learnerMastery, previous.learnerMastery) ** 2 +
              fieldDelta(learnerRisk, previous.learnerRisk) ** 2 +
              fieldDelta(tutorAlignment, previous.tutorAlignment) ** 2 +
              fieldDelta(jointMomentum, previous.jointMomentum) ** 2,
          ),
        )
      : 0,
  };
}

function buildLightweightDialogueField(turns = []) {
  const rows = [];
  for (const turn of turns) {
    rows.push(lightweightFieldTurn(turn, rows.at(-1) || null));
  }
  const first = rows[0] || {};
  const final = rows.at(-1) || {};
  return {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: rows.length,
    rows,
    summary: {
      finalTurn: final.turn || null,
      meanSpeed: roundField(rows.reduce((sum, row) => sum + row.speed, 0) / Math.max(1, rows.length)),
      fieldDelta: {
        learnerMastery: fieldDelta(final.learnerMastery, first.learnerMastery),
        learnerRisk: fieldDelta(final.learnerRisk, first.learnerRisk),
        tutorAlignment: fieldDelta(final.tutorAlignment, first.tutorAlignment),
        jointMomentum: fieldDelta(final.jointMomentum, first.jointMomentum),
      },
      final: {
        learnerMastery: final.learnerMastery ?? null,
        learnerRisk: final.learnerRisk ?? null,
        tutorAlignment: final.tutorAlignment ?? null,
        jointMomentum: final.jointMomentum ?? null,
        coverage: final.coverage ?? null,
        bottleneck: final.bottleneck || null,
      },
    },
  };
}

function signedFieldDelta(current, previous) {
  if (!previous) return 'baseline';
  const delta = fieldDelta(current, previous);
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

function summarizeFieldShift(row, previous = null, first = null) {
  const previousBits = previous
    ? [
        `prev M ${signedFieldDelta(row.learnerMastery, previous.learnerMastery)}`,
        `R ${signedFieldDelta(row.learnerRisk, previous.learnerRisk)}`,
        `A ${signedFieldDelta(row.tutorAlignment, previous.tutorAlignment)}`,
        `P ${signedFieldDelta(row.jointMomentum, previous.jointMomentum)}`,
      ]
    : ['prev baseline'];
  const totalBits =
    first && first !== row
      ? [
          `total M ${signedFieldDelta(row.learnerMastery, first.learnerMastery)}`,
          `R ${signedFieldDelta(row.learnerRisk, first.learnerRisk)}`,
          `A ${signedFieldDelta(row.tutorAlignment, first.tutorAlignment)}`,
          `P ${signedFieldDelta(row.jointMomentum, first.jointMomentum)}`,
        ]
      : ['total baseline'];
  return `${previousBits.join(', ')}; ${totalBits.join(', ')}`;
}

function describeFieldShift(row, previous = null, summary = {}) {
  if (!previous) {
    return `baseline field frame; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
  }
  const masteryDelta = fieldDelta(row.learnerMastery, previous.learnerMastery);
  const riskDelta = fieldDelta(row.learnerRisk, previous.learnerRisk);
  const alignmentDelta = fieldDelta(row.tutorAlignment, previous.tutorAlignment);
  const momentumDelta = fieldDelta(row.jointMomentum, previous.jointMomentum);
  const tags = [];
  if (masteryDelta >= 0.05) tags.push('learner mastery rising');
  if (riskDelta <= -0.05) tags.push('risk easing');
  if (riskDelta >= 0.05) tags.push('risk increasing');
  if (alignmentDelta >= 0.05) tags.push('tutor alignment improving');
  if (alignmentDelta <= -0.05) tags.push('tutor alignment weakening');
  if (momentumDelta >= 0.05) tags.push('joint momentum gaining');
  if (momentumDelta <= -0.05) tags.push('joint momentum slowing');
  if (!tags.length) tags.push('field mostly flat');
  const direction =
    masteryDelta > 0 && riskDelta <= 0
      ? 'productive'
      : masteryDelta > 0 && riskDelta > 0
        ? 'productive but strained'
        : masteryDelta <= 0 && riskDelta > 0
          ? 'stalled or risk-heavy'
          : 'stabilizing';
  return `${direction}: ${tags.join('; ')}; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
}

function printLightweightDialogueField(state) {
  if (!state.turns.length) {
    console.log(`${C.cyan}field >${C.reset} no completed turns yet`);
    console.log(`${C.dim}  enter a learner turn first, or run with --resume-last and then use /field${C.reset}\n`);
    return null;
  }

  const field = buildLightweightDialogueField(state.turns);
  const delta = field.summary.fieldDelta;
  const final = field.summary.final;
  console.log(`${C.cyan}field >${C.reset} ${field.turnCount} turn lightweight interaction field`);
  console.log(
    `${C.dim}  final: mastery ${final.learnerMastery}, risk ${final.learnerRisk}, alignment ${final.tutorAlignment}, momentum ${final.jointMomentum}, coverage ${final.coverage}${C.reset}`,
  );
  console.log(
    `${C.dim}  delta: mastery ${delta.learnerMastery >= 0 ? '+' : ''}${delta.learnerMastery}, risk ${
      delta.learnerRisk >= 0 ? '+' : ''
    }${delta.learnerRisk}, alignment ${delta.tutorAlignment >= 0 ? '+' : ''}${delta.tutorAlignment}, momentum ${
      delta.jointMomentum >= 0 ? '+' : ''
    }${delta.jointMomentum}; mean speed ${field.summary.meanSpeed}${C.reset}`,
  );
  console.log(`${C.dim}  bottleneck: ${final.bottleneck || 'unknown'}${C.reset}`);
  console.log(
    `${C.dim}  turn | mastery        | risk           | align          | momentum       | move / register / bottleneck${C.reset}`,
  );
  for (const row of field.rows) {
    const label = [row.learnerMove, row.register || 'no-register', row.bottleneck].filter(Boolean).join(' / ');
    console.log(
      `${C.dim}  ${String(row.turn).padStart(4)} | ${fieldBar(row.learnerMastery)} ${row.learnerMastery.toFixed(2)} | ${fieldBar(row.learnerRisk)} ${row.learnerRisk.toFixed(2)} | ${fieldBar(row.tutorAlignment)} ${row.tutorAlignment.toFixed(2)} | ${fieldBar(row.jointMomentum)} ${row.jointMomentum.toFixed(2)} | ${oneLine(label, { max: 96 })}${C.reset}`,
    );
  }
  console.log();
  return field;
}

function fieldVizBasePath(state) {
  const viz = state.fieldViz || {};
  const dir = viz.dir || resolveWorkspacePath(STUB.traceDir);
  const runId = viz.runId || state.trace?.runId || safeTimestampForFile();
  viz.dir = dir;
  viz.runId = runId;
  state.fieldViz = viz;
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${runId}-field`);
}

function fieldPolyline(rows, key, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const y = padding.top + (1 - clampField01(row[key])) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function fieldTurnMarkers(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const label = escapeXml(`${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${row.bottleneck}`);
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 18).toFixed(
        1,
      )}" r="2.8" fill="#475569"><title>${label}</title></circle>`;
    })
    .join('\n');
}

function renderLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 78, right: 42, bottom: 78, left: 74 };
  const chartWidth = 780;
  const chartHeight = 280;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#2563eb'],
    ['learnerRisk', 'risk', '#dc2626'],
    ['tutorAlignment', 'alignment', '#059669'],
    ['jointMomentum', 'momentum', '#7c3aed'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`,
        `<text x="${padding.left - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#64748b">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color]) =>
        `<polyline points="${fieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 152}, ${svgHeight - 28})"><rect width="12" height="12" rx="2" fill="${color}" /><text x="18" y="11" font-size="12" fill="#334155">${label}: ${escapeXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const deltaText = `delta M ${delta.learnerMastery >= 0 ? '+' : ''}${delta.learnerMastery ?? 'n/a'} | R ${
    delta.learnerRisk >= 0 ? '+' : ''
  }${delta.learnerRisk ?? 'n/a'} | A ${delta.tutorAlignment >= 0 ? '+' : ''}${
    delta.tutorAlignment ?? 'n/a'
  } | P ${delta.jointMomentum >= 0 ? '+' : ''}${delta.jointMomentum ?? 'n/a'}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${padding.left}" y="32" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  <text x="${padding.left}" y="55" font-size="13" fill="#475569">turns ${field.turnCount}; mean speed ${escapeXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${escapeXml(deltaText)}; bottleneck ${escapeXml(final.bottleneck || 'unknown')}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#cbd5e1" />
  ${gridLines}
  ${lines}
  ${fieldTurnMarkers(rows, { width: chartWidth, height: chartHeight, padding })}
  <text x="${padding.left}" y="${svgHeight - 47}" font-size="11" fill="#64748b">Each marker title lists turn / learner move / register / bottleneck.</text>
  ${legend}
</svg>
`;
}

function writeFieldVisualization(state, { reason = 'field_viz', force = false } = {}) {
  if (!force && !state.fieldViz?.enabled) return null;
  if (!state.turns.length) return null;
  const field = buildLightweightDialogueField(state.turns);
  const basePath = fieldVizBasePath(state);
  const svgPath = `${basePath}.svg`;
  const jsonPath = `${basePath}.json`;
  fs.writeFileSync(svgPath, renderLightweightFieldSvg(field, { title: 'Tutor Stub Interaction Field' }));
  fs.writeFileSync(jsonPath, `${JSON.stringify(field, null, 2)}\n`);
  const result = {
    field,
    svgPath,
    jsonPath,
    svgDisplayPath: path.relative(ROOT, svgPath),
    jsonDisplayPath: path.relative(ROOT, jsonPath),
  };
  state.fieldViz.lastWrite = {
    svg: result.svgDisplayPath,
    json: result.jsonDisplayPath,
    turnCount: field.turnCount,
  };
  appendTraceEvent(state.trace, {
    type: 'field_visualization_write',
    reason,
    svg: result.svgDisplayPath,
    json: result.jsonDisplayPath,
    turnCount: field.turnCount,
    summary: field.summary,
  });
  return result;
}

function printFieldVisualization(state, { reason = 'viz' } = {}) {
  if (!state.turns.length) {
    console.log(`${C.cyan}viz >${C.reset} no completed turns yet`);
    console.log(`${C.dim}  enter a learner turn first, or run with --resume-last and then use /viz${C.reset}\n`);
    return null;
  }
  const result = writeFieldVisualization(state, { reason, force: true });
  if (!result) return null;
  console.log(`${C.cyan}viz >${C.reset} ${result.svgDisplayPath}`);
  console.log(`${C.dim}  data: ${result.jsonDisplayPath}${C.reset}\n`);
  return result;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function compactCounts(items, { limit = 5 } = {}) {
  if (!items.length) return 'none';
  return items
    .slice(0, limit)
    .map(([key, count]) => `${key} ${count}`)
    .join(', ');
}

function dialogueCaseStatus(turn) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const closure = turn?.dialogueClosure?.lifecycle || null;
  const missing = Number(
    turn?.tutorLearnerDagModel?.metrics?.missingPremiseCount ?? assessment.missingPremiseCount ?? 0,
  );
  if (assessment.finalSecretEntailed && assessment.assertedSecret) {
    return 'case closed: verdict is grounded and the learner has asserted it';
  }
  if (closure?.phase === 'closed') {
    return `dialogue closed conversationally on ${closure.basis || 'public proof'}; strict learner-record audit remains ${
      assessment.bottleneck || 'open'
    }`;
  }
  if (closure?.phase === 'awaiting_checkin') {
    return `closing: verdict stated on ${closure.basis || 'public proof'}; one optional learner check-in remains`;
  }
  if (assessment.finalSecretEntailed) {
    return 'ready for verdict: evidence entails the answer, but the learner has not fully stated it';
  }
  if (missing > 0) {
    return `open: ${missing} premise(s) still missing; bottleneck ${assessment.bottleneck || 'unknown'}`;
  }
  return `open: bottleneck ${assessment.bottleneck || 'unknown'}`;
}

function printDialogueCloseout(state, { reason = 'report', trace = state.trace } = {}) {
  const tracePath = traceDisplayPath(trace);
  if (!state.turns.length) {
    console.log(`${C.cyan}closeout >${C.reset} ${reason}; no completed tutor turns`);
    if (tracePath) console.log(`${C.dim}  trace: ${tracePath}${C.reset}`);
    console.log(
      `${C.dim}  start with the tutor opening prompt, then enter one learner turn to build a report${C.reset}\n`,
    );
    return null;
  }

  const field = buildLightweightDialogueField(state.turns);
  const delta = field.summary.fieldDelta;
  const final = field.summary.final;
  const last = state.turns[state.turns.length - 1] || {};
  const assessment = last.tutorLearnerDagModel?.assessment || {};
  const metrics = last.tutorLearnerDagModel?.metrics || {};
  const registerCounts = compactCounts(
    countBy(
      state.turns,
      (turn) => normalizeStoredRegisterSelection(turn.registerSelection)?.selected_register || 'none',
    ),
  );
  const bottleneckCounts = compactCounts(
    countBy(state.turns, (turn) => turn.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown'),
  );
  const responseConfigurationVisibility = summarizeTutorStubResponseConfigurationAudits(
    state.turns.map((turn) => turn.responseConfigurationAudit),
  );
  const payload = {
    schema: 'machinespirits.tutor-stub.closeout-report.v1',
    reason,
    turnCount: state.turns.length,
    trace: tracePath,
    finalStatus: dialogueCaseStatus(last),
    finalAssessment: {
      bottleneck: assessment.bottleneck || null,
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    },
    humanDiscourse: {
      config: state.humanDiscourse || null,
      finalFrame: last.humanDiscourseFrame || null,
      finalStatus: last.humanDiscourseFrame?.warrantPremiseAudit?.proofStatus || null,
      proofDebtStatus: last.humanDiscourseFrame?.proofDebt?.status || null,
      sideArcCount: state.turns.filter((turn) => turn.humanDiscourseFrame?.sideArc?.detected).length,
      openProofDebtCount: state.turns.reduce(
        (sum, turn) => sum + Number(turn.humanDiscourseFrame?.proofDebt?.counts?.open || 0),
        0,
      ),
    },
    comprehension: tutorStubComprehensionSnapshot(state.comprehension, {
      turn: state.turns.length + 1,
    }),
    responseConfigurationVisibility,
    dialogueClosure: last.dialogueClosure?.lifecycle || state.dialogueClosure || null,
    field: field.summary,
    finalTurn: {
      turnId: last.turnId || turnDebugId(state, last.turn),
      learner: last.learner || '',
      tutor: last.tutor || '',
      engagementStance:
        normalizeStoredRegisterSelection(last.registerSelection)?.engagement_stance ||
        normalizeStoredRegisterSelection(last.registerSelection)?.selected_register ||
        null,
      register: normalizeStoredRegisterSelection(last.registerSelection)?.selected_register || null,
      responseConfiguration: last.responseConfiguration || null,
      responseConfigurationAudit: last.responseConfigurationAudit || null,
      leakOk: last.tutorLeakAudit?.ok ?? null,
      closure: last.dialogueClosure || null,
    },
  };

  console.log(`${C.cyan}closeout >${C.reset} ${reason}; ${state.turns.length} completed turn(s)`);
  if (tracePath) console.log(`${C.dim}  trace: ${tracePath}${C.reset}`);
  console.log(`${C.dim}  status: ${payload.finalStatus}${C.reset}`);
  console.log(
    `${C.dim}  final: coverage ${payload.finalAssessment.bestPathCoverage ?? 'n/a'}, missing ${
      payload.finalAssessment.missingPremiseCount
    }, bottleneck ${payload.finalAssessment.bottleneck || 'unknown'}, leak ${
      payload.finalTurn.leakOk === null ? 'n/a' : payload.finalTurn.leakOk ? 'ok' : 'blocked'
    }${C.reset}`,
  );
  console.log(
    `${C.dim}  field: mastery ${final.learnerMastery}, risk ${final.learnerRisk}, alignment ${final.tutorAlignment}, momentum ${final.jointMomentum}; delta M ${
      delta.learnerMastery >= 0 ? '+' : ''
    }${delta.learnerMastery}, R ${delta.learnerRisk >= 0 ? '+' : ''}${delta.learnerRisk}${C.reset}`,
  );
  console.log(`${C.dim}  engagement stances: ${registerCounts}${C.reset}`);
  if (responseConfigurationVisibility.turns) {
    console.log(
      `${C.dim}  response configuration: realization ${Math.round(
        responseConfigurationVisibility.mean_realization_rate * 100,
      )}%; pairwise visible difference ${
        responseConfigurationVisibility.pairwise_visible_difference_rate === null
          ? 'n/a'
          : `${Math.round(responseConfigurationVisibility.pairwise_visible_difference_rate * 100)}%`
      } across ${responseConfigurationVisibility.distinct_configuration_count} configuration(s)${C.reset}`,
    );
  }
  console.log(`${C.dim}  bottlenecks: ${bottleneckCounts}${C.reset}`);
  if (payload.humanDiscourse.config?.scaffoldActive) {
    console.log(
      `${C.dim}  human scaffold: ${payload.humanDiscourse.finalStatus || 'unknown'}; proof debt ${
        payload.humanDiscourse.proofDebtStatus || 'unknown'
      }; side arcs ${payload.humanDiscourse.sideArcCount}; open debt rows ${payload.humanDiscourse.openProofDebtCount}${C.reset}`,
    );
  }
  if (payload.comprehension.features.unresolvedTerms.length || payload.comprehension.features.explainedTerms.length) {
    console.log(
      `${C.dim}  comprehension: unresolved ${
        payload.comprehension.features.unresolvedTerms.join(', ') || 'none'
      }; explained ${payload.comprehension.features.explainedTerms.join(', ') || 'none'}; language opacity ${
        payload.comprehension.features.languageOpacity
      }${C.reset}`,
    );
  }
  console.log(`${C.dim}  last turn id: ${payload.finalTurn.turnId}${C.reset}`);
  console.log(`${C.dim}  last learner: ${oneLine(last.learner, { max: 180 })}${C.reset}`);
  console.log(`${C.dim}  last tutor: ${oneLine(last.tutor, { max: 220 })}${C.reset}\n`);
  return payload;
}

function dagTurnContext(world, tutorTurn) {
  if (!world) return '';
  const released = world.releaseSchedule.filter((entry) => entry.turn <= tutorTurn);
  const next = world.releaseSchedule.find((entry) => entry.turn > tutorTurn);
  const releasedLines = released.length
    ? released
        .map((entry) => {
          const premise = world.premiseById.get(entry.premise);
          return `- ${entry.premise} (${entry.via}, scheduled turn ${entry.turn}): ${String(premise?.surface || '').trim()}`;
        })
        .join('\n')
    : '- none yet';
  return [
    '[Tutor-only DAG turn context]',
    `Current tutor turn in this lightweight stub: ${tutorTurn}`,
    'Evidence scheduled at or before this turn:',
    releasedLines,
    next
      ? `Next scheduled evidence: ${next.premise} at turn ${next.turn} via ${next.via}`
      : 'Next scheduled evidence: none',
    'Use this as pacing guidance; never state the concealed answer by authority.',
    '[End tutor-only DAG turn context]',
  ].join('\n');
}

async function callTutor({
  learnerText,
  history,
  state = null,
  systemPrompt,
  resolved,
  temperature,
  maxTokens,
  historyTurns,
  world,
  dag,
  classification,
  tutorLearnerDagModel,
  registerSelection,
  humanDiscourseFrame = null,
  dialogueClosureFrame = null,
  trace = null,
  stream = null,
  cliEffort = null,
  multipleChoice = false,
  roleBase = 'tutor_stub_tutor',
  signal = null,
}) {
  const context = trimHistory(history, historyTurns);
  const tutorTurn = Math.floor(history.length / 2) + 1;
  const tutorMemory = tutorDialogueMemorySummary(state, { currentTutorTurn: tutorTurn, historyTurns });
  const advisory = classifierTutorContext(classification);
  const learnerDagAdvisory = tutorLearnerDagModelContext(tutorLearnerDagModel);
  const humanDiscourseAdvisory = humanDiscourseTutorContext(humanDiscourseFrame);
  const dialogueClosureAdvisory = dialogueClosureTutorContext(dialogueClosureFrame);
  const comprehensionAdvisory = tutorStubComprehensionPrompt(state?.comprehension, { turn: tutorTurn });
  const responseConfigurationAdvisory = responseConfigurationContext(registerSelection, {
    multipleChoice,
    humanDiscourseFrame,
    dialogueClosureFrame,
  });
  const effectiveSystemPrompt = responseConfigurationAdvisory
    ? `${systemPrompt}\n\n${responseConfigurationAdvisory}`
    : systemPrompt;
  const learnerPrompt = `Learner says:\n${learnerText}`;
  const promptParts = [
    tutorMemory,
    dag && world ? dagTurnContext(world, tutorTurn) : null,
    advisory,
    learnerDagAdvisory,
    humanDiscourseAdvisory,
    dialogueClosureAdvisory,
    comprehensionAdvisory,
    learnerPrompt,
  ].filter(Boolean);
  const userPrompt = promptParts.join('\n\n');
  const leakGuardEnabled = Boolean(dag && world);
  const scaffoldGuardEnabled = Boolean(humanDiscourseFrame?.generousInference?.applied);
  const closureGuardEnabled = Boolean(
    dialogueClosureFrame?.enabled && (dialogueClosureFrame.mandatory || dialogueClosureFrame.available),
  );
  const responseGuardEnabled = leakGuardEnabled || scaffoldGuardEnabled || closureGuardEnabled;
  const canStreamTutor = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  const tutorStreamMode = canStreamTutor ? (responseGuardEnabled ? 'buffered' : 'live') : 'none';

  async function invokeTutorAttempt({ attemptUserPrompt, role, streamMode = 'none', repairAttempt = 0 }) {
    const startedAt = new Date().toISOString();
    const request = {
      systemPrompt: effectiveSystemPrompt,
      messages: [...context, { role: 'user', content: attemptUserPrompt }],
      config: {
        temperature,
        maxTokens,
        historyTurns,
        leakGuard: leakGuardEnabled,
        scaffoldGuard: scaffoldGuardEnabled,
        closureGuard: closureGuardEnabled,
        repairAttempt,
      },
    };
    if (cliEffort) request.config.cliEffort = cliEffort;
    const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
    let response;
    if (isCliProvider(resolved.provider)) {
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        effectiveSystemPrompt,
        attemptUserPrompt,
        role,
        { messageHistory: context, effort: cliEffort, signal },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
      };
    } else if (useStreamingApi) {
      const sink = streamMode === 'live' ? createConsoleTokenSink(role, stream?.interim) : null;
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: effectiveSystemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          if (sink) sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink ? sink.finish() : false;
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
        generatedWithStreaming: true,
        bufferedStream: streamMode === 'buffered',
      };
    } else {
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: effectiveSystemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn: tutorTurn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request,
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
      },
    });
    return response;
  }

  function auditTutorDraft(response, { role, attempt }) {
    const leakAudit = leakGuardEnabled
      ? auditTutorResponseLeak({ text: response.text, world, tutorTurn, learnerText })
      : { ok: true, leaks: [] };
    const scaffoldAudit = scaffoldGuardEnabled
      ? auditTutorStubGenerousInferenceResponse({
          text: response.text,
          resolution: humanDiscourseFrame.generousInference,
        })
      : { ok: true, issues: [], similarity: 0 };
    const closureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: response.text, frame: dialogueClosureFrame })
      : { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
    if (leakGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_response_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: leakAudit.ok,
        leaks: leakAudit.leaks,
      });
    }
    if (scaffoldGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_human_scaffold_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: scaffoldAudit.ok,
        issues: scaffoldAudit.issues,
        similarity: scaffoldAudit.similarity,
        generousInference: humanDiscourseFrame.generousInference,
      });
    }
    if (closureGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_dialogue_closure_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: closureAudit.ok,
        closesDialogue: closureAudit.closesDialogue,
        invitesCheckIn: closureAudit.invitesCheckIn,
        issues: closureAudit.issues,
        frame: dialogueClosureFrame,
      });
    }
    return {
      ok: leakAudit.ok && scaffoldAudit.ok && closureAudit.ok,
      leakAudit,
      scaffoldAudit,
      closureAudit,
    };
  }

  try {
    let response = await invokeTutorAttempt({
      attemptUserPrompt: userPrompt,
      role: roleBase,
      streamMode: tutorStreamMode,
      repairAttempt: 0,
    });

    if (!responseGuardEnabled) return response;

    let audits = auditTutorDraft(response, { role: roleBase, attempt: 0 });
    if (audits.ok) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.closureAudit = audits.closureAudit;
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return response;
    }

    response = await invokeTutorAttempt({
      attemptUserPrompt: tutorResponseRepairPrompt({
        originalUserPrompt: userPrompt,
        unsafeDraft: response.text,
        leakAudit: audits.leakAudit,
        scaffoldAudit: audits.scaffoldAudit,
        closureAudit: audits.closureAudit,
        dialogueClosureFrame,
      }),
      role: `${roleBase}_repair`,
      streamMode: canStreamTutor ? 'buffered' : 'none',
      repairAttempt: 1,
    });
    audits = auditTutorDraft(response, { role: `${roleBase}_repair`, attempt: 1 });
    if (audits.ok) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.closureAudit = audits.closureAudit;
      response.repaired = true;
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return response;
    }

    const closureFallbackSelected = Boolean(
      closureGuardEnabled && (dialogueClosureFrame.mandatory || audits.closureAudit.closesDialogue),
    );
    const fallbackText = closureFallbackSelected
      ? deterministicTutorStubClosureResponse(dialogueClosureFrame)
      : scaffoldGuardEnabled
        ? deterministicGenerousInferenceFallback()
        : deterministicLeakFallback({ learnerText });
    const fallbackClosureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: fallbackText, frame: dialogueClosureFrame })
      : audits.closureAudit;
    const fallback = {
      text: fallbackText,
      provider: resolved.provider,
      model: resolved.model,
      latencyMs: response.latencyMs || 0,
      usage: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      leakAudit: audits.leakAudit,
      scaffoldAudit: audits.scaffoldAudit,
      closureAudit: fallbackClosureAudit,
      repaired: true,
      deterministicFallback: true,
      deterministicClosure: closureFallbackSelected,
    };
    if (canStreamTutor) {
      fallback.guardedStreamReplay = true;
    }
    appendTraceEvent(trace, {
      type: 'tutor_response_fallback',
      role: roleBase,
      turn: tutorTurn,
      leaks: audits.leakAudit.leaks,
      scaffoldIssues: audits.scaffoldAudit.issues,
      closureIssues: audits.closureAudit.issues,
      text: fallbackText,
    });
    return fallback;
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role: roleBase,
      turn: tutorTurn,
      provider: resolved.provider,
      model: resolved.model,
      error: err.message,
    });
    throw err;
  }
}

function saveTranscript(filePath, transcript) {
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
}

function publicWorldSummary(world) {
  if (!world) return 'No detective-story world is active; respond to the tutor topic directly.';
  return [
    `World: ${world.id} - ${world.title}`,
    `Discipline: ${world.discipline || 'investigation'}`,
    `Public question: ${world.publicQuestion || 'unknown'}`,
    'Opening situation:',
    String(world.opening || world.openingSituation || '').trim() || '(none supplied)',
    world.learnerVoice ? `Learner voice: ${world.learnerVoice}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function publicTranscriptForAutomatedLearner(state) {
  const messages = state.memory?.enabled ? trimHistory(state.history || [], state.historyTurns) : state.history || [];
  const rows = messages.map((message) => {
    const role = message.role === 'assistant' ? 'Tutor' : 'Learner';
    return `${role}: ${message.content || ''}`;
  });
  const recentTranscript = rows.join('\n\n') || '(No prior public transcript.)';
  if (!state.memory?.enabled || !(state.turns || []).length) return recentTranscript;
  return [
    publicDialogueMemorySummary(state, { includeAnalysis: false }),
    '[Raw recent public transcript]',
    recentTranscript,
    '[End raw recent public transcript]',
  ].join('\n\n');
}

function latestTutorMessage(state) {
  return [...(state?.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
}

function buildTutorClarificationPrompt({ state, term = '' }) {
  const latestTutor = latestTutorMessage(state);
  const requestedTerm = String(term || '').trim();
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length,
  });
  return [
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns, { includeAnalysis: false }),
    '',
    '# Latest line to clarify',
    '',
    latestTutor || '(No tutor message is available yet.)',
    '',
    '# Learner clarification request',
    '',
    requestedTerm
      ? `Explain this term or phrase from the line above: "${requestedTerm}".`
      : 'No term was supplied. Pick up to three likely confusing words or phrases from the latest tutor message and explain them.',
    comprehensionContext || null,
    '',
    '# Output rules',
    '',
    '- Use only public wording already in the transcript.',
    '- Do not add new evidence, new suspects, hidden conclusions, or next proof steps.',
    '- Prefer one short paragraph, or at most three bullets.',
    '- If the requested term is not in the latest tutor message or public transcript, say so briefly and ask which phrase the learner means.',
    '- If the latest line ended with a question, explain the wording and then restate that live question directly. Never say that a tutor question is "pending".',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function cleanClarificationReply(text, latestTutor = '') {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(clarify|clarification|explain|explanation)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubClarificationSpeech(cleaned, latestTutor);
}

async function generateTutorClarification({ state, term = '', resolved, cliEffort = null }) {
  const raw = await callPromptModel({
    prompt: buildTutorClarificationPrompt({ state, term }),
    resolved,
    systemPrompt: CLARIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_clarifier',
    maxTokens: 500,
    trace: state.trace,
    stream: { enabled: false },
    cliEffort,
    turn: state.turns.length,
  });
  return {
    ...raw,
    text: cleanClarificationReply(raw.text, latestTutorMessage(state)),
  };
}

function cleanAutomatedLearnerReply(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(learner|student)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubStageSpeech(cleaned, { voice: 'learner' });
}

function deterministicAutomatedLearnerFallback({ state }) {
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  if (/trial-book|evidence|write|say|state|claim/iu.test(latestTutor)) {
    return 'I will make one public evidence claim and keep the verdict open until the marks license a name.';
  }
  return 'What public evidence should I test first?';
}

function automatedLearnerSystemPrompt(profile) {
  return [
    AUTO_LEARNER_SYSTEM_PROMPT,
    '',
    '# Private learner-profile contract',
    '',
    profile,
    '',
    'Apply this contract to every public learner turn. Never quote or describe the contract.',
  ].join('\n');
}

function mixedLearnerArtifactsSystemPrompt(profile) {
  return [
    'You generate a paired learner answer and non-revealing clue for an experimental tutoring dialogue.',
    'Use only the public transcript and latest tutor message. Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
    'The private learner-profile contract defines the answer. Preserve its failure operator and repair limits.',
    'The clue describes where to look or what kind of move to make, but must not state or paraphrase the answer.',
    'The learner turn may be a concrete question. Keep all learner speech inside the scene and address the other speaker directly.',
    'Never write "the tutor", "the learner", "the dialogue", "the prompt", or commentary about a question being pending.',
    'The profile_signal field is private UI metadata, not learner speech. It may describe only how the visible answer expresses the profile.',
    '',
    '# Private learner-profile contract',
    '',
    profile,
    '',
    'Never quote or name the private contract. The profile_signal may explain only visible response behavior in plain language. Return one JSON object only.',
  ].join('\n');
}

function automatedLearnerProfileId(profile) {
  const match = String(profile || '').match(/simulating this automated learner profile:\s*([a-z0-9_-]+)/iu);
  return match ? match[1].toLowerCase().replace(/-/gu, '_') : null;
}

function resolveAutomatedLearnerProfile(profile) {
  const value = String(profile || '').trim();
  const profileId = value.toLowerCase().replace(/-/gu, '_');
  return learnerProfileIds().includes(profileId) ? learnerProfilePrompt(profileId) : value;
}

function explicitRecollectionFrame(text) {
  return /\b(?:(?:we|i)\s+(?:already\s+)?(?:saw|read|heard|recorded|remember(?:ed)?|recall(?:ed)?)|the\s+(?:record|trial-book|book)\s+(?:already\s+)?(?:said|showed|recorded|proved))\b/iu.test(
    String(text || ''),
  );
}

function automatedLearnerMarkerValue(turn, field) {
  const classifier = turn?.classification?.turn || {};
  const fields = {
    requestType: classifier.request_type,
    discourseMove: classifier.discourse_move,
    evidenceUse: classifier.evidence_use,
    epistemicStance: classifier.epistemic_stance,
    agency: classifier.agency,
    explicitRecollection: explicitRecollectionFrame(turn?.learner),
  };
  return fields[field] ?? null;
}

function automatedLearnerMarkerMatches(turn, clause) {
  return clause.every((group) => (group.values || []).includes(automatedLearnerMarkerValue(turn, group.field)));
}

function publicTutorPressure(text) {
  return /\b(miraculously|marvelous|wonderful|conveniently|apparently|nice trick|escape route|safe performance|hiding behind|not doing the work|lets you avoid|pressing|do not stall|don['’]t stall|fog and vibes|answer vending machine|mob|jab|jabs)\b/iu.test(
    String(text || ''),
  );
}

function negativeRegisterPressure(selection) {
  return NEGATIVE_FLOOR_REGISTERS.includes(selection?.selected_register);
}

function automatedLearnerProfileRuntimeState({ state, profile, turnNumber }) {
  const profileId = automatedLearnerProfileId(profile);
  const contract = learnerProfileContract(profileId);
  const observability = contract?.observabilityContract;
  if (!contract || !observability) return null;
  const policy = state.register?.policy || 'unknown';
  const eligiblePolicies = observability.eligiblePolicies || ['*'];
  const policyEligible = eligiblePolicies.includes('*') || eligiblePolicies.includes(policy);
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  const currentStimulusEligible =
    observability.eligibility === 'public_tutor_pressure'
      ? publicTutorPressure(latestTutor) || negativeRegisterPressure(state.turns?.at(-1)?.registerSelection)
      : true;
  const eligible = policyEligible && currentStimulusEligible;
  const clauses = observability.markerClauses || [];
  const completedTurns = state.turns || [];
  const openingTutor = state.history?.[0]?.role === 'assistant' ? state.history[0].content : '';
  const priorTurns = policyEligible
    ? completedTurns.filter((turn, index) => {
        if (observability.eligibility !== 'public_tutor_pressure') return true;
        const stimulus = index === 0 ? openingTutor : completedTurns[index - 1]?.tutor;
        const stimulusSelection = index === 0 ? null : completedTurns[index - 1]?.registerSelection;
        return publicTutorPressure(stimulus) || negativeRegisterPressure(stimulusSelection);
      })
    : [];
  const observed = priorTurns.filter((turn) =>
    clauses.some((clause) => clause.length && automatedLearnerMarkerMatches(turn, clause)),
  ).length;
  const mustShowByTurn = Number(observability.mustShowByTurn || 0);
  const targetRate = Number(observability.minEligibleRate || 0);
  const eligibleOpportunities = priorTurns.length + (eligible ? 1 : 0);
  const targetCount =
    eligible && (!mustShowByTurn || turnNumber >= mustShowByTurn) ? Math.ceil(eligibleOpportunities * targetRate) : 0;
  const deadlineDue = eligible && mustShowByTurn > 0 && turnNumber >= mustShowByTurn && observed === 0;
  const requiredNow = Boolean(eligible && (deadlineDue || observed < targetCount));
  return {
    profileId,
    contract,
    observability,
    eligible,
    priorEligibleTurns: priorTurns.length,
    observed,
    targetCount,
    mustShowByTurn,
    requiredNow,
  };
}

function automatedLearnerProfileRuntime({ state, profile, turnNumber }) {
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  if (!runtime) return '';
  return [
    '# Private profile recurrence state',
    '',
    `Profile: ${runtime.profileId}. The current public tutor message is an eligible trigger: ${runtime.eligible ? 'yes' : 'no'}.`,
    `Completed eligible learner turns: ${runtime.priorEligibleTurns}. Visible failure markers so far: ${runtime.observed}.`,
    `Minimum markers expected through turn ${turnNumber}: ${runtime.targetCount}. Must first appear by turn: ${runtime.mustShowByTurn || 'not forced'}.`,
    runtime.requiredNow
      ? `This turn MUST visibly perform the primary failure operator: ${runtime.contract.intent.failureOperator}. Do not combine it with a fully repaired or fully warranted answer in the same turn.`
      : 'This turn may repair or progress if the contract permits, but the profile remains active on later eligible turns.',
    'This state is private. Never mention counts, policies, profiles, markers, or experimental conditions publicly.',
  ].join('\n');
}

function buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback = '' }) {
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  return [
    automatedLearnerProfileRuntime({ state, profile, turnNumber }),
    '',
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Public transcript',
    '',
    publicTranscriptForAutomatedLearner(state),
    '',
    '# Latest tutor message',
    '',
    latestTutor || '(The tutor has not spoken yet. Start by asking or stating what you would investigate first.)',
    '',
    '# Task',
    '',
    adherenceFeedback || null,
    adherenceFeedback ? '' : null,
    `Write learner turn ${turnNumber}. Use only public evidence and the public transcript.`,
    'First preserve the private learner-profile condition. A required distortion, omitted warrant, refusal, resistance, or withheld evidence step takes priority over generic progress.',
    'Only when the profile permits progress: if the tutor asks for a trial-book line, write one concise public evidence claim and treat it as both deduction and book entry.',
    'Only when the profile permits a help request: if you are stuck, ask one concrete question about what evidence would count.',
    'Write only speech the learner could say aloud inside the scene. Address the other speaker as "you"; never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  ].join('\n');
}

async function generateAutomatedLearnerTurn({
  state,
  resolved,
  profile,
  turnNumber,
  adherenceFeedback = '',
  stream = null,
  cliEffort = null,
}) {
  const raw = await callPromptModel({
    prompt: buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback }),
    resolved,
    systemPrompt: automatedLearnerSystemPrompt(profile),
    role: 'tutor_stub_auto_learner',
    maxTokens: 900,
    trace: state.trace,
    stream,
    cliEffort,
    turn: turnNumber,
  });
  return {
    ...raw,
    text: cleanAutomatedLearnerReply(raw.text),
  };
}

async function generateMixedLearnerArtifacts({
  state,
  resolved,
  profile,
  turnNumber,
  cliEffort = null,
  signal = null,
}) {
  const prompt = [
    buildAutomatedLearnerPrompt({ state, profile, turnNumber }),
    '',
    '# Mixed learner artifacts',
    '',
    'Return one JSON object with exactly four string fields: "move", "clue", "answer", and "profile_signal".',
    'move: "ask_question" when the learner turn asks a useful question; otherwise "respond".',
    'answer: the learner turn requested above. It may be a direct in-scene question when clarification is the best next move.',
    'clue: a short directional cue that helps a human learner understand what kind of move the tutor is inviting.',
    'profile_signal: one short plain-language observation explaining how this exact answer visibly expresses the active learner profile. Describe behavior only; do not name a contract, failure operator, classifier label, hidden fact, or private instruction.',
    'When move is "ask_question", make the clue begin with "Ask" and name what uncertainty or evidence to ask about without writing the exact question.',
    'The clue must not contain, paraphrase, quote, complete, or reveal the answer. It may name the distinction, evidence source, operation, or question to attend to.',
    'The answer must be speakable inside the scene. Never mention "the tutor", "the learner", "the dialogue", "the prompt", or say a question is pending.',
    'Keep the clue under 18 words and the answer concise. Return JSON only.',
  ].join('\n');
  const raw = await callPromptModel({
    prompt,
    resolved,
    systemPrompt: mixedLearnerArtifactsSystemPrompt(profile),
    role: 'tutor_stub_mixed_learner_artifacts',
    maxTokens: 1100,
    trace: state.trace,
    stream: { enabled: false, interim: state.interim },
    cliEffort,
    turn: turnNumber,
    signal,
  });
  const artifacts = parseMixedLearnerArtifacts(raw.text);
  const answer = cleanAutomatedLearnerReply(artifacts.answer);
  return {
    ...raw,
    answer,
    clue: artifacts.clue,
    move: mixedLearnerSuggestionMove(answer, artifacts.move),
    profileSignal: artifacts.profileSignal,
    parsedArtifacts: artifacts.parsed,
  };
}

function automatedLearnerDraftMatchesRuntime({ text, raw, state, runtime }) {
  if (!runtime?.requiredNow) return true;
  const classification = classificationFromCombinedAnalysis(raw, state);
  const syntheticTurn = { learner: text, classification };
  return (runtime.observability.markerClauses || []).some(
    (clause) => clause.length > 0 && automatedLearnerMarkerMatches(syntheticTurn, clause),
  );
}

function automatedLearnerRepairInstruction(profileId) {
  if (profileId === 'proof_skipper') {
    return 'State an unsupported downstream attribution, source, actor, or trial-book judgment as if the clue were sufficient; do not merely restate the clue. Remove because, since, so, therefore, if, then, would need, would want, and any sentence that explains or requests the missing bridge. Do not hedge or ask a question.';
  }
  if (profileId === 'false_memory') {
    return 'Begin naturally with "We already saw", "I remember", "The record said", or an equivalent explicit recollection, then state one concrete observation that the public record did not actually establish. Misquote the clue itself rather than drawing a bad inference from a true clue. Do not hedge, describe a future test, or correct the distortion in this turn.';
  }
  if (profileId === 'affective_resistant') {
    return "Object to the tutor's pressure only. Do not add a clue, trial-book line, warrant, inference, or useful evidence step in the same turn.";
  }
  return 'Make the required failure public and unmistakable without repairing it in the same turn.';
}

async function enforceAutomatedLearnerProfile({ state, resolved, profile, turnNumber, generated, cliEffort = null }) {
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  const canPreclassify = Boolean(state.classifier.enabled && state.learnerDag.enabled && state.world);
  if (!runtime?.requiredNow || !canPreclassify || !generated.text) {
    return { generated, precomputedRaw: null, repaired: false, passed: null };
  }

  const maxRepairs = 2;
  let candidate = generated;
  let raw = null;
  let passed = false;
  let repairs = 0;
  while (repairs <= maxRepairs) {
    raw = await extractCombinedLearnerAnalysis({ learnerText: candidate.text, state, tutorTurn: turnNumber });
    passed = automatedLearnerDraftMatchesRuntime({ text: candidate.text, raw, state, runtime });
    if (passed || repairs === maxRepairs) break;
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_repair_requested',
      turn: turnNumber,
      profile: runtime.profileId,
      attempt: repairs + 1,
      failureOperator: runtime.contract.intent.failureOperator,
      draft: candidate.text,
    });
    const repaired = await generateAutomatedLearnerTurn({
      state,
      resolved,
      profile,
      turnNumber,
      adherenceFeedback: `Your previous draft was too normalized and did not visibly perform the required failure operator (${runtime.contract.intent.failureOperator}). Rewrite the learner turn. ${automatedLearnerRepairInstruction(runtime.profileId)} Keep it natural and concise.`,
      stream: { enabled: false, interim: state.interim },
      cliEffort,
    });
    if (repaired.text) candidate = repaired;
    repairs += 1;
  }
  appendTraceEvent(state.trace, {
    type: 'auto_learner_profile_adherence',
    turn: turnNumber,
    profile: runtime.profileId,
    required: true,
    passed,
    repaired: repairs > 0,
    repairAttempts: repairs,
  });
  return { generated: candidate, precomputedRaw: raw, repaired: repairs > 0, passed };
}

function tutorDialogueClosureFrameForTurn({ state, tutorTurn, tutorLearnerDag }) {
  const tutorDagSnapshot = buildTutorDagSnapshot(state, tutorTurn);
  return {
    tutorDagSnapshot,
    frame: buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: tutorLearnerDag?.model || tutorLearnerDag || null,
      tutorDagSnapshot,
      answerTerm: answerTermForWorld(state.world),
    }),
  };
}

async function runOneTurn(
  inputText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
  precomputedResponse = null,
) {
  const learnerText = String(inputText || '').trim();
  if (!learnerText) {
    appendTraceEvent(state.trace, {
      type: 'empty_learner_turn_rejected',
      turn: state.turns.length + 1,
    });
    throw new Error('empty learner turn: no tutor response can be generated without learner text');
  }
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const humanDiscourseFrame = buildHumanDiscourseFrame({
    state,
    tutorTurn,
    tutorLearnerDag,
    classification,
    learnerText,
  });
  const { tutorDagSnapshot: dagSnapshot, frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
    state,
    tutorTurn,
    tutorLearnerDag,
  });
  const comprehensionBeforeTutor = tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn });
  const dagFactDropout = tutorLearnerDag?.dagFactDropout || null;

  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.repairedNow?.length) {
    appendTraceEvent(state.trace, {
      type: 'dag_fact_dropout_update',
      turn: tutorTurn,
      turnId,
      dropout: dagFactDropout,
    });
  }

  const response =
    precomputedResponse ||
    (await callTutor({
      learnerText,
      history: state.history,
      state,
      systemPrompt: state.systemPrompt,
      resolved: state.resolved,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      historyTurns: state.historyTurns,
      world: state.world,
      dag: state.dag,
      classification,
      tutorLearnerDagModel: tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      multipleChoice: state.multipleChoice,
    }));
  const priorDialogueClosure = state.dialogueClosure;
  state.dialogueClosure = advanceTutorStubDialogueClosure(priorDialogueClosure, {
    frame: dialogueClosureFrame,
    audit: response.closureAudit,
    turn: tutorTurn,
  });
  if (state.dialogueClosure?.phase !== priorDialogueClosure?.phase) {
    appendTraceEvent(state.trace, {
      type: 'dialogue_closure_transition',
      turn: tutorTurn,
      from: priorDialogueClosure?.phase || 'open',
      to: state.dialogueClosure.phase,
      basis: state.dialogueClosure.basis,
      audit: response.closureAudit || null,
    });
  }

  const responseConfigurationAudit = auditTutorStubResponseConfiguration({
    text: response.text,
    configuration: registerSelection?.response_configuration || registerSelection,
    world: state.world,
  });
  if (responseConfigurationAudit) {
    appendTraceEvent(state.trace, {
      type: 'response_configuration_audit',
      turn: tutorTurn,
      turnId,
      configuration: registerSelection?.response_configuration || null,
      audit: responseConfigurationAudit,
    });
  }

  const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
    text: response.text,
    turn: tutorTurn,
    source: 'tutor_turn',
  });
  const comprehensionAfterTutor = comprehensionResponse.snapshot;
  if (
    comprehensionResponse.explainedTerms.length ||
    comprehensionBeforeTutor.lastRequest?.turn === tutorTurn
  ) {
    appendTraceEvent(state.trace, {
      type: 'comprehension_response',
      turn: tutorTurn,
      explainedTerms: comprehensionResponse.explainedTerms,
      unresolvedTerms: comprehensionAfterTutor?.features?.unresolvedTerms || [],
      comprehensionState: comprehensionAfterTutor,
    });
  }

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    learner: learnerText,
    classification,
    tutorLearnerDagModel: tutorLearnerDag?.model || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
          dagFactDropout,
        }
      : null,
    dagFactDropout,
    humanDiscourseFrame,
    scaffoldState: humanDiscourseFrame.scaffoldState,
    sideArc: humanDiscourseFrame.sideArc,
    proofDebt: humanDiscourseFrame.proofDebt,
    warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
    generousInference: humanDiscourseFrame.generousInference,
    comprehension: {
      beforeTutor: comprehensionBeforeTutor,
      afterTutor: comprehensionAfterTutor,
    },
    dialogueClosure: {
      frame: dialogueClosureFrame,
      audit: response.closureAudit || null,
      lifecycle: state.dialogueClosure,
    },
    closureCheckIn: dialogueClosureFrame.phase === 'final_checkin_response',
    registerSelection,
    responseConfiguration: registerSelection?.response_configuration || null,
    responseConfigurationAudit,
    previousRegisterEfficacy,
    tutor: response.text,
    tutorDag: dagSnapshot,
    tutorLeakAudit: response.leakAudit || null,
    tutorHumanScaffoldAudit: response.scaffoldAudit || null,
    tutorDialogueClosureAudit: response.closureAudit || null,
    tutorResponseRepaired: Boolean(response.repaired),
    tutorDeterministicFallback: Boolean(response.deterministicFallback),
    tutorDeterministicClosure: Boolean(response.deterministicClosure),
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
  };
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turnId,
    turn: tutorTurn,
    turnRecord,
  });
  return { ...response, dagSnapshot };
}

async function runAnalyzedTutorTurn(learnerText, state, { precomputedRaw = null } = {}) {
  const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
    learnerText,
    state,
    { precomputedRaw },
  );
  startInterimAnimation(
    state,
    'calling tutor',
    buildTutorInterimContext({
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
    }),
  );
  let response;
  try {
    response = await runOneTurn(
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
    );
  } finally {
    stopInterimAnimation(state);
  }
  printTutorDagSnapshot(response.dagSnapshot);
  printTutorResponse(response, state.stream);
  console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
  writeFieldVisualization(state, { reason: 'turn_complete' });
  return response;
}

function emitTutorOpeningToState(state, { enabled = true, reason = 'start' } = {}) {
  if (!enabled || state.history.length) return null;
  const opening = buildTutorOpening(state);
  state.history.push({ role: 'assistant', content: opening });
  const turnId = openingDebugId(stateRunDebugId(state));
  appendTraceEvent(state.trace, { type: 'tutor_opening', turnId, reason, text: opening });
  printOpeningDebugLine(state);
  console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
  return opening;
}

function learnerDagReachedGroundedClosure(state) {
  const model = state.turns.at(-1)?.tutorLearnerDagModel || null;
  return tutorStubLearnerDagGrounded(model);
}

async function runAutomatedLearnerDialogue({
  state,
  firstMessage = '',
  openingEnabled = true,
  autoLearnerResolved,
  autoLearnerProfile,
  autoTurns,
  autoSafetyTurns,
  autoStopOnGrounded,
  cliEffort = null,
}) {
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_start',
    model: autoLearnerResolved,
    profile: autoLearnerProfile,
    maxTurns: autoTurns,
    untilGrounded: autoTurns === null,
    safetyTurns: autoSafetyTurns,
    stopOnGrounded: autoStopOnGrounded,
  });
  if (!firstMessage) {
    emitTutorOpeningToState(state, { enabled: openingEnabled, reason: 'auto_start' });
  }

  let nextLearnerText = firstMessage.trim();
  let reason = 'auto_turn_cap';
  for (let i = 0; autoTurns === null || i < autoTurns; i += 1) {
    if (autoTurns === null && i >= autoSafetyTurns) {
      reason = 'auto_safety_turn_cap';
      break;
    }
    const turnNumber = state.turns.length + 1;
    let precomputedRaw = null;
    if (!nextLearnerText) {
      startInterimAnimation(state, 'calling auto learner', { tutorTurn: turnNumber });
      let generated;
      try {
        generated = await generateAutomatedLearnerTurn({
          state,
          resolved: autoLearnerResolved,
          profile: autoLearnerProfile,
          turnNumber,
          stream: { enabled: false, interim: state.interim },
          cliEffort,
        });
      } finally {
        stopInterimAnimation(state);
      }
      const enforced = await enforceAutomatedLearnerProfile({
        state,
        resolved: autoLearnerResolved,
        profile: autoLearnerProfile,
        turnNumber,
        generated,
        cliEffort,
      });
      generated = enforced.generated;
      precomputedRaw = enforced.precomputedRaw;
      nextLearnerText = generated.text;
      if (!nextLearnerText) {
        nextLearnerText = deterministicAutomatedLearnerFallback({ state });
        appendTraceEvent(state.trace, {
          type: 'auto_learner_empty_fallback',
          turn: turnNumber,
          text: nextLearnerText,
          provider: generated.provider,
          model: generated.model,
        });
      }
      appendTraceEvent(state.trace, {
        type: 'auto_learner_turn',
        turn: turnNumber,
        text: nextLearnerText,
        provider: generated.provider,
        model: generated.model,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        profileRepaired: enforced.repaired,
        profileAdherencePassed: enforced.passed,
      });
      printTurnDebugLine(state, turnNumber);
      console.log(`${C.bold}learner(auto) >${C.reset} ${nextLearnerText}\n`);
    } else {
      printTurnDebugLine(state, turnNumber);
      console.log(`${C.bold}learner(auto) >${C.reset} ${nextLearnerText}\n`);
    }

    await runAnalyzedTutorTurn(nextLearnerText, state, { precomputedRaw });
    nextLearnerText = '';

    if (autoStopOnGrounded && learnerDagReachedGroundedClosure(state)) {
      reason = 'auto_grounded_closure';
      break;
    }
  }
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_end',
    reason,
    turns: state.turns.length,
  });
  return { reason, turns: state.turns.length };
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-worlds']) {
    printWorlds();
    return;
  }

  args['auto-learner-profile'] = resolveAutomatedLearnerProfile(args['auto-learner-profile']);

  const temperature = parseNumber(args.temperature, '--temperature', { min: 0, max: 2 });
  const registerTemperature = normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
    label: '--register-temperature',
  });
  const dagFactDropoutRate = normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
    label: '--dag-fact-dropout',
  });
  const dagFactDropoutSeed = normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
    label: '--dag-fact-dropout-seed',
  });
  const dagFactDropoutConfig = {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    rate: dagFactDropoutRate,
    seed: dagFactDropoutSeed,
    enabled: dagFactDropoutRate > 0,
    graceTurns: 2,
    maxConcurrent: 2,
    eligibleFacts: 'adopted_public_premises_only',
    backgroundFactsImmune: true,
    visibility: 'conduct',
  };
  const maxTokens = parsePositiveInt(args['max-tokens'], '--max-tokens');
  const historyTurns = parsePositiveInt(args['history-turns'], '--history-turns');
  const memorySummaryEnabled = Boolean(STUB.memorySummary && !args['no-memory-summary']);
  const autoLearnerEnabled = Boolean(args['auto-learner']);
  const mixedLearnerRequested = Boolean(args['mixed-learner'] || args['mixed-mode']);
  const mixedLearnerEnabled = Boolean(mixedLearnerRequested && !autoLearnerEnabled);
  const learnerSuggestionEnabled = Boolean(autoLearnerEnabled || mixedLearnerEnabled);
  const autoTurns = parseAutoTurns(args['auto-turns']);
  const autoSafetyTurns = parsePositiveInt(args['auto-safety-turns'], '--auto-safety-turns');
  const autoStopOnGrounded = !args['no-auto-stop-on-grounded'];
  if (autoLearnerEnabled && autoTurns === null && !autoStopOnGrounded) {
    throw new Error(
      '--auto-turns until-grounded requires grounded-closure stopping; remove --no-auto-stop-on-grounded',
    );
  }
  const worldBundle = resolveWorldRef(args.world);
  const directorContext = buildDirectorInitialContext(worldBundle?.world || null);
  const effectiveTopic = worldBundle && args.topic === STUB.topic ? worldBundle.world.title : args.topic;
  const dagMode = normalizeDagMode(args['dag-mode']);
  const multipleChoiceEnabled = Boolean(args['multiple-choice']);
  assertSupportedModelRefs({
    '--model': args.model,
    '--classifier-model': args['classifier-model'],
    '--learner-record-model': args['learner-record-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });
  const systemPrompt = loadSystemPrompt({
    worldBundle,
    dag: args.dag,
    topic: effectiveTopic,
    multipleChoice: multipleChoiceEnabled,
  });
  const tutorDag = args.dag && worldBundle ? buildTutorDesireDag(worldBundle.world) : null;
  const resolved = resolveModel(args.model);
  const providerConfig = getProviderConfig(resolved.provider);
  const autoLearnerResolved = learnerSuggestionEnabled ? resolveModel(args['auto-learner-model']) : null;
  const autoLearnerProviderConfig = autoLearnerResolved ? getProviderConfig(autoLearnerResolved.provider) : null;
  const classifierEnabled = !args['no-classifier'];
  const tutorLearnerDagEnabled = Boolean(args['tutor-learner-dag'] && worldBundle);
  const humanDiscourseConfig = buildHumanDiscourseRunConfig({
    dagMode,
    dagEnabled: args.dag,
    tutorLearnerDagEnabled,
  });
  const humanDiscoursePreviewFrame = buildHumanDiscourseFrame({
    state: {
      world: worldBundle?.world || null,
      dag: args.dag,
      dagMode,
      humanDiscourse: humanDiscourseConfig,
      turns: [],
    },
    tutorTurn: 1,
    tutorLearnerDag: null,
    classification: null,
    learnerText: '',
  });
  const combinedLearnerAnalysisEnabled = Boolean(classifierEnabled && tutorLearnerDagEnabled);
  const registerPolicy = normalizeRegisterPolicy(args['register-policy']);
  const registerEmpiricalPrior = loadRegisterEmpiricalPrior(args['register-empirical-prior'], {
    policy: registerPolicy,
  });
  const registerPaletteMode =
    registerPolicy === 'negative' ? 'negative' : args['safe-registers'] ? 'safe' : args['register-palette'];
  const registerPalette = buildRegisterPalette(registerPaletteMode);
  const randomRegisterSelectionEnabled = registerPolicy === 'random';
  const negativeRegisterSelectionEnabled = registerPolicy === 'negative';
  const fieldRegisterSelectionEnabled = registerPolicy === 'field';
  const trajectoryRegisterSelectionEnabled = registerPolicy === 'trajectory';
  const dynamicalSystemRegisterSelectionEnabled = registerPolicy === 'dynamical_system';
  const empiricalDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'empirical_dynamical_system';
  const continuousDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'continuous_dynamical_system';
  const continuousEmpiricalDynamicalSystemRegisterSelectionEnabled =
    registerPolicy === 'continuous_empirical_dynamical_system';
  const continuousRegisterSelectionEnabled = Boolean(
    continuousDynamicalSystemRegisterSelectionEnabled || continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
  );
  const continuousUnsafeRegisterAnchorsEnabled = Boolean(
    continuousRegisterSelectionEnabled &&
    !args['safe-registers'] &&
    /(^|,)(all|simulated|negative|negative-floor|ironic|sarcastic|face_threat)(,|$)/iu.test(
      String(args['register-palette'] || ''),
    ),
  );
  const stateRegisterSelectionEnabled = registerPolicy === 'state';
  const registerSelectionEnabled = Boolean(
    !args['no-register-selection'] &&
    registerPalette.length &&
    (combinedLearnerAnalysisEnabled || randomRegisterSelectionEnabled || negativeRegisterSelectionEnabled),
  );
  const classifierResolved =
    classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  const classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  const learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  const learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  const visibleModel = visibleResolvedModel(resolved, providerConfig);
  const visibleAutoLearnerModel = autoLearnerResolved
    ? visibleResolvedModel(autoLearnerResolved, autoLearnerProviderConfig)
    : null;
  const visibleClassifierModel = classifierResolved
    ? visibleResolvedModel(classifierResolved, classifierProviderConfig)
    : null;
  const visibleLearnerRecordModel = learnerRecordResolved
    ? visibleResolvedModel(learnerRecordResolved, learnerRecordProviderConfig)
    : null;
  const visibleClassifierConfig = classifierEnabled
    ? combinedLearnerAnalysisEnabled
      ? {
          combined: true,
          classifierModelRef: args['classifier-model'],
          modelRef: args['learner-record-model'],
          resolved: visibleLearnerRecordModel,
        }
      : {
          modelRef: args['classifier-model'],
          resolved: visibleClassifierModel,
        }
    : { enabled: false };
  const effectiveTemperature = effectiveTemperatureForModel(resolved, temperature);
  const traceEnabled = !args['no-trace'];
  const traceDir = resolveWorkspacePath(args['trace-dir']);
  const streamEnabled = Boolean(STUB.stream && !args['no-stream']);
  const interimAnimationEnabled = Boolean(STUB.interimAnimation && !args['no-interim-animation']);
  const fieldVisualizationEnabled = Boolean(args['field-viz']);
  const openingEnabled = Boolean(STUB.opening && !args['no-opening']);
  const closeoutReportEnabled = Boolean(STUB.closeoutReport && !args['no-closeout-report']);
  const dialogueClosureConfig = createTutorStubDialogueClosureLifecycle({
    enabled: Boolean(
      args.dag &&
        worldBundle &&
        (!autoLearnerEnabled || (tutorLearnerDagEnabled && autoStopOnGrounded)),
    ),
    allowCheckIn: Boolean(!autoLearnerEnabled && !firstMessage),
    allowAuthoredDagClosure: Boolean(!autoLearnerEnabled),
  });
  const cliEffort = normalizeCliEffort(args['cli-effort']);
  const tutorStreamState = !streamEnabled
    ? 'off'
    : providerSupportsEventStreaming(resolved)
      ? 'cli_events'
      : !providerSupportsStreaming(resolved)
        ? 'unavailable_cli_buffered'
        : args.dag && worldBundle
          ? 'guarded_after_audit'
          : 'live';
  const resumeCandidate = args['resume-last'] ? latestDialogueTrace(args['trace-dir']) : null;

  if (args['show-prompt']) {
    console.log(`${C.dim}--- system prompt ---${C.reset}`);
    console.log(systemPrompt);
    console.log(`${C.dim}--- end system prompt ---${C.reset}\n`);
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          modelRef: args.model,
          resolved: visibleModel,
          topic: effectiveTopic,
          world: worldBundle
            ? {
                id: worldBundle.world.id,
                title: worldBundle.world.title,
                file: path.relative(ROOT, worldBundle.filePath),
                dag: args.dag,
              }
            : null,
          humanDiscourse: humanDiscourseConfig,
          humanDiscoursePreviewFrame,
          comprehensionSideState: {
            enabled: true,
            schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
            sources: ['learner_turn', 'slash_explain'],
            advancesLearnerDag: false,
          },
          dagFactDropout: dagFactDropoutConfig,
          responseConfiguration: {
            schema: 'machinespirits.tutor-stub.response-configuration.v1',
            primaryStanceField: 'engagement_stance',
            independentAxes: [
              'engagement_stance',
              'action_family',
              'audience_register',
              'lexical_accessibility',
              'scene_immersion',
            ],
            temperatureScope: 'engagement_stance_only',
            transcriptVisibilityAudit: true,
          },
          directorContext,
          temperature: effectiveTemperature,
          requestedTemperature: temperature,
          classifier: visibleClassifierConfig,
          tutorLearnerDag: tutorLearnerDagEnabled
            ? {
                modelRef: args['learner-record-model'],
                resolved: visibleLearnerRecordModel,
                combinedClassifier: combinedLearnerAnalysisEnabled,
              }
            : { enabled: false, requested: Boolean(args['tutor-learner-dag']) },
          autoLearner: autoLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                maxTurns: autoTurns ?? 'until-grounded',
                untilGrounded: autoTurns === null,
                safetyTurns: autoTurns === null ? autoSafetyTurns : null,
                stopOnGrounded: autoStopOnGrounded,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
              }
            : { enabled: false },
          mixedLearner: mixedLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
                clue: '/clue or /hint',
                accept: 'Tab on an empty learner prompt, /use, or /accept',
                inspect: '/suggest',
                regenerate: '/regen',
                profilePresentation: {
                  promptLabel: true,
                  intendedPattern: true,
                  visibleExpression: 'profile_signal',
                  readyAnnouncement: 'once_per_profile',
                },
              }
            : { enabled: false, requested: mixedLearnerRequested },
          registerSelection: registerSelectionEnabled
            ? {
                enabled: true,
                palette: registerPalette,
                policy: registerPolicy,
                temperature: registerTemperature,
                engagementStanceTemperature: registerTemperature,
                temperatureScope: 'engagement_stance_only',
                combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
                localFieldPolicy: fieldRegisterSelectionEnabled,
                localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
                localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
                localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
                localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
                localContinuousEmpiricalDynamicalSystemPolicy:
                  continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
                continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
                localStatePolicy: stateRegisterSelectionEnabled,
                random: randomRegisterSelectionEnabled,
                negative: negativeRegisterSelectionEnabled,
                empiricalPrior: {
                  status: registerEmpiricalPrior.status,
                  path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
                  observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
                },
              }
            : { enabled: false },
          maxTokens,
          historyTurns,
          memorySummary: {
            enabled: memorySummaryEnabled,
            rawRecentTurns: historyTurns,
            publicSummary: memorySummaryEnabled,
            tutorStateFieldSummary: memorySummaryEnabled,
          },
          cliEffort: cliEffort || null,
          trace: traceEnabled
            ? {
                enabled: true,
                dir: path.relative(ROOT, traceDir),
              }
            : { enabled: false },
          stream: {
            enabled: streamEnabled,
            tutor: tutorStreamState,
            tutorLive: tutorStreamState === 'live',
            tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
            classifier:
              streamEnabled && classifierResolved
                ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
                : false,
            learnerAnalysis:
              streamEnabled && learnerRecordResolved
                ? providerSupportsStreaming(learnerRecordResolved) ||
                  providerSupportsEventStreaming(learnerRecordResolved)
                : false,
          },
          opening: { enabled: openingEnabled, printedByDefault: Boolean(openingEnabled && !firstMessage) },
          closeoutReport: { enabled: closeoutReportEnabled },
          dialogueClosure: dialogueClosureConfig,
          multipleChoice: { enabled: multipleChoiceEnabled },
          interimAnimation: {
            enabled: interimAnimationEnabled,
            activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY),
          },
          fieldVisualization: {
            enabled: fieldVisualizationEnabled,
            dir: path.relative(ROOT, traceDir),
            automaticAfterTurns: fieldVisualizationEnabled,
            slashCommand: '/viz',
          },
          resumeLast: args['resume-last']
            ? resumeCandidate
              ? {
                  source: path.relative(ROOT, resumeCandidate.filePath),
                  turns: resumeCandidate.turns.length,
                  world: resumeCandidate.metadata?.world || null,
                }
              : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
            : { requested: false },
          systemPrompt,
          firstMessage: firstMessage || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!resolved.isConfigured && !isCliProvider(resolved.provider)) {
    const envName = providerConfig.api_key_env || 'provider API key';
    throw new Error(`${args.model} is not configured. Set ${envName} or choose a CLI-backed model.`);
  }
  if (
    classifierEnabled &&
    !combinedLearnerAnalysisEnabled &&
    !classifierResolved.isConfigured &&
    !isCliProvider(classifierResolved.provider)
  ) {
    const envName = classifierProviderConfig.api_key_env || 'provider API key';
    throw new Error(`${args['classifier-model']} is not configured. Set ${envName} or choose a CLI-backed classifier.`);
  }
  if (tutorLearnerDagEnabled && !learnerRecordResolved.isConfigured && !isCliProvider(learnerRecordResolved.provider)) {
    const envName = learnerRecordProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['learner-record-model']} is not configured. Set ${envName} or choose a CLI-backed learner-record model.`,
    );
  }
  if (learnerSuggestionEnabled && !autoLearnerResolved.isConfigured && !isCliProvider(autoLearnerResolved.provider)) {
    const envName = autoLearnerProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['auto-learner-model']} is not configured. Set ${envName} or choose a CLI-backed automated learner model.`,
    );
  }

  const trace = createTraceState({
    enabled: traceEnabled,
    traceDir: args['trace-dir'],
    metadata: {
      modelRef: args.model,
      resolved: visibleModel,
      humanDiscourse: humanDiscourseConfig,
      comprehensionSideState: {
        enabled: true,
        schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
        sources: ['learner_turn', 'slash_explain'],
        advancesLearnerDag: false,
      },
      dagFactDropout: dagFactDropoutConfig,
      responseConfiguration: {
        schema: 'machinespirits.tutor-stub.response-configuration.v1',
        primaryStanceField: 'engagement_stance',
        independentAxes: [
          'engagement_stance',
          'action_family',
          'audience_register',
          'lexical_accessibility',
          'scene_immersion',
        ],
        temperatureScope: 'engagement_stance_only',
        transcriptVisibilityAudit: true,
      },
      classifier: visibleClassifierConfig,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      autoLearner: autoLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            maxTurns: autoTurns ?? 'until-grounded',
            untilGrounded: autoTurns === null,
            safetyTurns: autoTurns === null ? autoSafetyTurns : null,
            stopOnGrounded: autoStopOnGrounded,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
          }
        : { enabled: false },
      mixedLearner: mixedLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
            clue: '/clue or /hint',
            accept: 'Tab on an empty learner prompt, /use, or /accept',
            inspect: '/suggest',
            regenerate: '/regen',
            profilePresentation: {
              promptLabel: true,
              intendedPattern: true,
              visibleExpression: 'profile_signal',
              readyAnnouncement: 'once_per_profile',
            },
          }
        : { enabled: false, requested: mixedLearnerRequested },
      registerSelection: registerSelectionEnabled
        ? {
            enabled: true,
            palette: registerPalette,
            policy: registerPolicy,
            temperature: registerTemperature,
            engagementStanceTemperature: registerTemperature,
            temperatureScope: 'engagement_stance_only',
            combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
            localFieldPolicy: fieldRegisterSelectionEnabled,
            localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
            localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
            localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
            localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
            localContinuousEmpiricalDynamicalSystemPolicy: continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
            continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
            localStatePolicy: stateRegisterSelectionEnabled,
            random: randomRegisterSelectionEnabled,
            negative: negativeRegisterSelectionEnabled,
            empiricalPrior: {
              status: registerEmpiricalPrior.status,
              path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
              observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
            },
          }
        : { enabled: false },
      cliEffort: cliEffort || null,
      stream: {
        enabled: streamEnabled,
        tutor: tutorStreamState,
        tutorLive: tutorStreamState === 'live',
        tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
        classifier:
          streamEnabled && classifierResolved
            ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
            : false,
        learnerAnalysis:
          streamEnabled && learnerRecordResolved
            ? providerSupportsStreaming(learnerRecordResolved) || providerSupportsEventStreaming(learnerRecordResolved)
            : false,
      },
      memorySummary: {
        enabled: memorySummaryEnabled,
        rawRecentTurns: historyTurns,
        publicSummary: memorySummaryEnabled,
        tutorStateFieldSummary: memorySummaryEnabled,
      },
      opening: { enabled: openingEnabled, printedByDefault: Boolean(openingEnabled && !firstMessage) },
      closeoutReport: { enabled: closeoutReportEnabled },
      dialogueClosure: dialogueClosureConfig,
      multipleChoice: { enabled: multipleChoiceEnabled },
      interimAnimation: {
        enabled: interimAnimationEnabled,
        activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY),
      },
      fieldVisualization: {
        enabled: fieldVisualizationEnabled,
        dir: path.relative(ROOT, traceDir),
        automaticAfterTurns: fieldVisualizationEnabled,
        slashCommand: '/viz',
      },
      resumeLast: args['resume-last']
        ? resumeCandidate
          ? {
              source: path.relative(ROOT, resumeCandidate.filePath),
              turns: resumeCandidate.turns.length,
              world: resumeCandidate.metadata?.world || null,
            }
          : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
        : { requested: false },
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      firstMessage: firstMessage || null,
    },
  });
  const interim = createInterimState({ enabled: interimAnimationEnabled });

  const state = {
    topic: effectiveTopic,
    systemPrompt,
    resolved,
    temperature: effectiveTemperature,
    maxTokens,
    historyTurns,
    memory: {
      enabled: memorySummaryEnabled,
    },
    world: worldBundle?.world || null,
    directorContext,
    dag: args.dag,
    dagMode,
    humanDiscourse: humanDiscourseConfig,
    dialogueClosure: { ...dialogueClosureConfig },
    tutorDag,
    classifier: {
      enabled: classifierEnabled,
      resolved: classifierResolved,
      combined: combinedLearnerAnalysisEnabled,
    },
    learnerDag: createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: dagFactDropoutRate,
        seed: dagFactDropoutSeed,
      },
    }),
    comprehension: createTutorStubComprehensionState(),
    register: {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      temperature: registerTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    },
    trace,
    debugRunId: trace.runId || safeTimestampForFile(),
    printedDebugIds: new Set(),
    interim,
    stream: {
      enabled: streamEnabled,
      interim,
    },
    fieldViz: {
      enabled: fieldVisualizationEnabled,
      dir: traceDir,
      runId: trace.runId || safeTimestampForFile(),
    },
    cliEffort,
    multipleChoice: multipleChoiceEnabled,
    history: [],
    turns: [],
  };

  const resumedDialogue = args['resume-last']
    ? restoreDialogueFromTrace(state, resumeCandidate, { currentWorld: worldBundle?.world || null })
    : null;
  if (resumedDialogue) {
    appendTraceEvent(state.trace, {
      type: 'resume_loaded',
      source: path.relative(ROOT, resumedDialogue.source),
      turns: resumedDialogue.turns,
      register: resumedDialogue.register,
      learnerDag: resumedDialogue.learnerDag,
      dialogueClosure: resumedDialogue.dialogueClosure,
      warnings: resumedDialogue.warnings,
    });
  } else if (args['resume-last']) {
    appendTraceEvent(state.trace, {
      type: 'resume_empty',
      traceDir: path.relative(ROOT, traceDir),
    });
  }

  console.log(
    `\n${C.cyan}tutor-stub${C.reset} ${C.dim}${args.model} -> ${visibleModel.provider}/${visibleModel.model}${C.reset}`,
  );
  if (classifierEnabled && combinedLearnerAnalysisEnabled) {
    console.log(
      `${C.dim}classifier: combined into learner-DAG analysis via ${args['learner-record-model']} -> ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (classifierEnabled) {
    console.log(
      `${C.dim}classifier: ${args['classifier-model']} -> ${visibleClassifierModel.provider}/${visibleClassifierModel.model}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}classifier: off${C.reset}`);
  }
  if (tutorLearnerDagEnabled) {
    console.log(
      `${C.dim}tutor learner-DAG: on via ${args['learner-record-model']} -> ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (args['tutor-learner-dag'] && !worldBundle) {
    console.log(`${C.dim}tutor learner-DAG: requested, but off because no detective world is active${C.reset}`);
  } else {
    console.log(`${C.dim}tutor learner-DAG: off${C.reset}`);
  }
  console.log(
    `${C.dim}DAG discourse mode: ${dagMode} (${humanDiscourseConfig.phase}; ${
      humanDiscourseConfig.behaviorChange ? 'human scaffold prompt active' : 'strict audit only'
    })${C.reset}`,
  );
  if (autoLearnerEnabled) {
    const autoTurnSummary = autoTurns === null ? `until grounded; safety ${autoSafetyTurns}` : `${autoTurns}`;
    console.log(
      `${C.dim}auto learner: on via ${args['auto-learner-model']} -> ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; turns ${autoTurnSummary}; stopOnGrounded ${autoStopOnGrounded}${C.reset}`,
    );
  } else if (mixedLearnerEnabled) {
    console.log(
      `${C.dim}mixed learner: on via ${args['auto-learner-model']} -> ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; /clue, Tab autocomplete, /suggest, /use, /regen${C.reset}`,
    );
  } else if (mixedLearnerRequested) {
    console.log(`${C.dim}mixed learner: requested, but off because --auto-learner is running unattended${C.reset}`);
  } else {
    console.log(`${C.dim}auto learner: off${C.reset}`);
  }
  if (registerSelectionEnabled) {
    console.log(
      `${C.dim}register selection: on [${registerPalette.join(', ')}] | policy ${registerPolicy} | temp ${state.register.temperature}${C.reset}`,
    );
    if (
      empiricalDynamicalSystemRegisterSelectionEnabled ||
      continuousEmpiricalDynamicalSystemRegisterSelectionEnabled ||
      registerEmpiricalPrior.status === 'loaded'
    ) {
      const priorPath = registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : 'none';
      console.log(
        `${C.dim}register empirical prior: ${registerEmpiricalPrior.status}${
          priorPath ? ` | ${priorPath}` : ''
        }${C.reset}`,
      );
    }
    if (continuousRegisterSelectionEnabled) {
      console.log(
        `${C.dim}continuous register anchors: ${
          continuousUnsafeRegisterAnchorsEnabled ? 'active palette' : 'safe router-selectable only'
        }${C.reset}`,
      );
    }
  } else {
    console.log(`${C.dim}register selection: off${C.reset}`);
  }
  if (trace.enabled) {
    console.log(`${C.dim}trace: ${traceDisplayPath(trace)}${C.reset}`);
  } else {
    console.log(`${C.dim}trace: off${C.reset}`);
  }
  if (streamEnabled) {
    const streamBits = [
      tutorStreamState === 'live' ? 'tutor live' : null,
      tutorStreamState === 'guarded_after_audit' ? 'tutor guarded-after-audit' : null,
      tutorStreamState === 'cli_events' ? 'tutor CLI events' : null,
      classifierResolved && providerSupportsStreaming(classifierResolved) ? 'classifier' : null,
      learnerRecordResolved && providerSupportsStreaming(learnerRecordResolved) ? 'learner-DAG/analysis' : null,
      classifierResolved && providerSupportsEventStreaming(classifierResolved) ? 'classifier CLI events' : null,
      learnerRecordResolved && providerSupportsEventStreaming(learnerRecordResolved)
        ? 'learner-DAG/analysis CLI events'
        : null,
    ].filter(Boolean);
    const streamSummary = streamBits.length
      ? `on for ${streamBits.join(', ')}`
      : tutorStreamState === 'unavailable_cli_buffered'
        ? 'requested, but tutor provider is CLI-buffered'
        : 'requested, but selected providers are CLI-buffered';
    console.log(`${C.dim}stream: ${streamSummary}${C.reset}`);
  } else {
    console.log(`${C.dim}stream: off${C.reset}`);
  }
  console.log(
    `${C.dim}interim animation: ${interimAnimationEnabled ? (output.isTTY ? 'on' : 'off (non-TTY)') : 'off'}${C.reset}`,
  );
  console.log(
    `${C.dim}field visualization: ${
      fieldVisualizationEnabled ? `on -> ${path.relative(ROOT, traceDir)}` : 'off (/viz writes on demand)'
    }${C.reset}`,
  );
  console.log(`${C.dim}opening prompt: ${openingEnabled && !firstMessage ? 'on' : 'off'}${C.reset}`);
  console.log(`${C.dim}closeout report: ${closeoutReportEnabled ? 'on' : 'off'}${C.reset}`);
  console.log(
    `${C.dim}dialogue closure: ${dialogueClosureConfig.enabled ? `on; ${dialogueClosureConfig.allowCheckIn ? 'one optional final check-in' : 'terminal close without check-in'}` : 'off'}${C.reset}`,
  );
  if (cliEffort) {
    console.log(`${C.dim}cli effort: ${cliEffort}${C.reset}`);
  }
  if (resumedDialogue) {
    console.log(
      `${C.dim}resume: loaded ${resumedDialogue.turns} turn(s) from ${path.relative(ROOT, resumedDialogue.source)}${C.reset}`,
    );
    if (resumedDialogue.learnerDag.skipped) {
      console.log(
        `${C.dim}resume: learner-DAG replayed ${resumedDialogue.learnerDag.replayed}, reused ${resumedDialogue.learnerDag.skipped} stored model snapshot(s)${C.reset}`,
      );
    }
    for (const warning of resumedDialogue.warnings) {
      console.log(`${C.red}resume warning${C.reset}${C.dim}: ${warning}${C.reset}`);
    }
    if (state.dialogueClosure?.phase === 'awaiting_checkin') {
      console.log(
        `${C.cyan}resume closure >${C.reset} the saved dialogue had already stated its verdict; one final learner check-in remains`,
      );
    } else if (state.dialogueClosure?.phase === 'closed') {
      console.log(`${C.cyan}resume closure >${C.reset} the saved dialogue is already closed`);
    }
  } else if (args['resume-last']) {
    console.log(`${C.dim}resume: no completed dialogue found in ${path.relative(ROOT, traceDir)}${C.reset}`);
  }
  if (temperature !== effectiveTemperature) {
    console.log(
      `${C.dim}temperature: requested ${temperature}; using ${effectiveTemperature} because ${visibleModel.model} only supports the default${C.reset}`,
    );
  }
  if (worldBundle) {
    console.log(
      `${C.dim}world: ${worldBundle.world.id} — ${worldBundle.world.title}${args.dag ? ' | DAG on' : ' | DAG off'}${C.reset}`,
    );
  }
  printDirectorInitialContext(directorContext);
  console.log(
    `${C.dim}topic: ${effectiveTopic} | /analysis, /settings, /field, /viz, or /clarify for help | slash commands work while thinking | /quit to exit${C.reset}\n`,
  );

  if (autoLearnerEnabled) {
    const result = await runAutomatedLearnerDialogue({
      state,
      firstMessage,
      openingEnabled,
      autoLearnerResolved,
      autoLearnerProfile: args['auto-learner-profile'],
      autoTurns,
      autoSafetyTurns,
      autoStopOnGrounded,
      cliEffort,
    });
    appendTraceEvent(state.trace, { type: 'run_end', reason: result.reason, turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        autoLearner: {
          enabled: true,
          modelRef: args['auto-learner-model'],
          resolved: visibleAutoLearnerModel,
          maxTurns: autoTurns ?? 'until-grounded',
          untilGrounded: autoTurns === null,
          safetyTurns: autoTurns === null ? autoSafetyTurns : null,
          stopOnGrounded: autoStopOnGrounded,
          profile: args['auto-learner-profile'],
        },
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: registerPolicy,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: result.reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: result.reason, report });
    }
    return;
  }

  if (firstMessage) {
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
      firstMessage,
      state,
    );
    startInterimAnimation(
      state,
      'calling tutor',
      buildTutorInterimContext({
        learnerText: firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
      }),
    );
    let response;
    try {
      response = await runOneTurn(
        firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
      );
    } finally {
      stopInterimAnimation(state);
    }
    printTutorDagSnapshot(response.dagSnapshot);
    printTutorResponse(response, state.stream);
    console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
    writeFieldVisualization(state, { reason: 'once' });
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: registerPolicy,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: 'once', trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: 'once', report });
    }
    return;
  }

  const mixedLearner = {
    enabled: mixedLearnerEnabled,
    resolved: autoLearnerResolved,
    profile: args['auto-learner-profile'],
    defaultProfile: args['auto-learner-profile'],
    profileId: automatedLearnerProfileId(args['auto-learner-profile']),
    seq: 0,
    pending: null,
    suggestion: null,
    error: null,
    artifactAbortController: null,
    analysisCache: null,
    readyAnnouncementProfileKey: null,
    cacheStats: {
      analysisStarted: 0,
      analysisHits: 0,
      analysisMisses: 0,
      tutorStarted: 0,
      tutorHits: 0,
      tutorMisses: 0,
      discarded: 0,
      errors: 0,
    },
  };

  function mixedLearnerProfilePresentation(suggestion = null) {
    const profileId = suggestion?.profileId || mixedLearner.profileId || null;
    const contract = profileId ? learnerProfileContract(profileId) : null;
    return {
      id: profileId || 'custom',
      name: contract?.intent?.shortName || 'Custom learner',
      pattern:
        contract?.intent?.failureOperator || oneLine(suggestion?.profile || mixedLearner.profile, { max: 180 }),
      signal:
        oneLine(suggestion?.profileSignal, { max: 220 }) ||
        'This draft was generated under the active profile; no separate visible-behavior note was returned.',
    };
  }

  function mixedLearnerPromptText() {
    if (!mixedLearner.enabled) return `${C.bold}learner >${C.reset} `;
    return `${C.bold}learner[${mixedLearnerProfilePresentation().id}] >${C.reset} `;
  }

  function printMixedLearnerProfilePresentation(suggestion, { verb = 'drafted as' } = {}) {
    const presentation = mixedLearnerProfilePresentation(suggestion);
    console.log(`${C.magenta}profile >${C.reset} ${presentation.id} — ${presentation.name}`);
    console.log(`${C.dim}  pattern: ${presentation.pattern}${C.reset}`);
    console.log(`${C.dim}  ${verb}: ${presentation.signal}${C.reset}`);
  }

  const rl = readline.createInterface({
    input,
    output,
    prompt: mixedLearnerPromptText(),
    completer(line) {
      const mixedCompletion = mixedLearnerCompletionForLine(line);
      if (mixedCompletion) return [[mixedCompletion], line];
      const trimmed = line.trimStart();
      if (!trimmed.startsWith('/')) return [[], line];
      const matches = SLASH_COMMANDS.filter((command) => command.startsWith(trimmed));
      return [matches.length ? matches : SLASH_COMMANDS, trimmed];
    },
  });
  let processingTurn = false;
  let clarificationInFlight = false;
  let exiting = false;
  let finalized = false;
  const pendingLearnerLines = [];
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  function mixedLearnerCompletionForLine(line) {
    if (!mixedLearner.enabled || processingTurn) return null;
    const suggestion = mixedLearner.suggestion;
    const text = String(suggestion?.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('/')) return null;
    if (!trimmed) return text;
    return text.toLowerCase().startsWith(raw.trim().toLowerCase()) ? text : null;
  }

  function resetMixedLearnerSuggestion(reason, { preserveAnalysisCache = false } = {}) {
    if (!mixedLearner.enabled) return;
    const cachedAnalysis = mixedLearner.analysisCache;
    const cachedAnalysisSnapshot = cachedAnalysis
      ? {
          key: cachedAnalysis.key,
          status: cachedAnalysis.status,
          tutorStatus: cachedAnalysis.tutorStatus,
          turn: cachedAnalysis.turn,
          turnId: cachedAnalysis.turnId,
        }
      : null;
    const invalidated = invalidateMixedLearnerCache(mixedLearner, { preserveAnalysisCache });
    if (invalidated.discardedAnalysis) {
      mixedLearner.cacheStats.discarded += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_discarded',
        reason,
        turn: cachedAnalysisSnapshot.turn,
        turnId: cachedAnalysisSnapshot.turnId,
        status: cachedAnalysisSnapshot.status,
        tutorStatus: cachedAnalysisSnapshot.tutorStatus,
        tutorResponseDiscarded: invalidated.discardedTutorResponse,
        key: cachedAnalysisSnapshot.key,
      });
    }
    if (invalidated.hadState) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_cleared',
        reason,
        turns: state.turns.length,
      });
    }
    return invalidated;
  }

  function currentMixedLearnerAnalysisKey(answer, turnNumber = state.turns.length + 1) {
    return mixedLearnerAnalysisCacheKey({
      answer: String(answer || '').trim(),
      turn: turnNumber,
      history: state.history,
      world: state.world?.id || null,
      learnerDag: state.learnerDag?.lastModel
        ? {
            turn: state.learnerDag.lastModel.turn || null,
            metrics: state.learnerDag.lastModel.metrics || null,
            assessment: state.learnerDag.lastModel.assessment || null,
          }
        : null,
      registerPolicy: state.register?.policy || null,
      registerTemperature: state.register?.temperature ?? null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout),
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: turnNumber }),
      registerHistory: (state.register?.history || []).map((entry) => ({
        turn: entry.turn || null,
        selectedRegister: entry.selected_register || null,
        source: entry.source || null,
      })),
      analysisModel: state.learnerDag?.resolved || state.classifier?.resolved || null,
      learnerProfile: mixedLearner.profile,
      dagMode: state.dagMode,
      systemPrompt: state.systemPrompt,
      schema: 'mixed-learner-analysis-cache.v1',
    });
  }

  function cloneStateForMixedLearnerSpeculation() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      register: structuredClone(state.register),
      dialogueClosure: structuredClone(state.dialogueClosure),
      stream: { enabled: false, interim: state.interim },
    };
  }

  function mixedLearnerTutorContextKey({
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    humanDiscourseFrame,
    dialogueClosureFrame,
    comprehensionState = state.comprehension,
  }) {
    return mixedLearnerAnalysisCacheKey({
      learnerText,
      history: state.history,
      classifier: classifierTutorContext(classification),
      learnerDag: tutorLearnerDagModelContext(tutorLearnerDag?.model || tutorLearnerDag),
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout),
      register: responseConfigurationContext(registerSelection, {
        multipleChoice: state.multipleChoice,
        humanDiscourseFrame,
        dialogueClosureFrame,
      }),
      humanDiscourse: humanDiscourseTutorContext(humanDiscourseFrame),
      dialogueClosure: dialogueClosureTutorContext(dialogueClosureFrame),
      comprehension: tutorStubComprehensionPrompt(comprehensionState, {
        turn: state.turns.length + 1,
      }),
      dagTurn: state.dag && state.world ? dagTurnContext(state.world, state.turns.length + 1) : null,
      systemPrompt: state.systemPrompt,
      tutorModel: state.resolved,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      historyTurns: state.historyTurns,
      schema: 'mixed-learner-tutor-cache.v1',
    });
  }

  async function startMixedLearnerTutorPrefetch(entry, raw) {
    if (mixedLearner.analysisCache !== entry || exiting) return null;
    entry.tutorStatus = 'pending';
    entry.tutorStartedAt = Date.now();
    mixedLearner.cacheStats.tutorStarted += 1;
    try {
      const speculativeState = cloneStateForMixedLearnerSpeculation();
      const classification = classificationFromCombinedAnalysis(raw, speculativeState);
      const update = learnerRecordFromCombinedAnalysis(raw);
      const tutorLearnerDag = applyLearnerRecordUpdate({
        update,
        state: speculativeState,
        tutorTurn: entry.turn,
        learnerText: entry.answer,
      });
      speculativeState.learnerDag.lastModel = tutorLearnerDag.model;
      updateComprehensionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      evaluatePendingRegisterEfficacy(speculativeState, tutorLearnerDag, classification);
      const registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
        state: speculativeState,
        classification,
        tutorLearnerDag,
        raw,
        learnerText: entry.answer,
      });
      const humanDiscourseFrame = buildHumanDiscourseFrame({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
        classification,
        learnerText: entry.answer,
      });
      const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
      });
      entry.tutorContextKey = mixedLearnerTutorContextKey({
        learnerText: entry.answer,
        classification,
        tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        comprehensionState: speculativeState.comprehension,
      });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_start',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        analysisKey: entry.key,
        tutorContextKey: entry.tutorContextKey,
      });
      entry.tutorPromise = callTutor({
        learnerText: entry.answer,
        history: speculativeState.history,
        state: speculativeState,
        systemPrompt: speculativeState.systemPrompt,
        resolved: speculativeState.resolved,
        temperature: speculativeState.temperature,
        maxTokens: speculativeState.maxTokens,
        historyTurns: speculativeState.historyTurns,
        world: speculativeState.world,
        dag: speculativeState.dag,
        classification,
        tutorLearnerDagModel: tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: speculativeState.cliEffort,
        multipleChoice: speculativeState.multipleChoice,
        roleBase: 'tutor_stub_tutor_prefetch',
        signal: entry.abortController.signal,
      });
      const response = await entry.tutorPromise;
      if (mixedLearner.analysisCache !== entry || exiting) return null;
      entry.tutorStatus = 'ready';
      entry.tutorResponse = response;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_ready',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        tutorContextKey: entry.tutorContextKey,
        latencyMs: Date.now() - entry.tutorStartedAt,
      });
      return response;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      if (mixedLearner.analysisCache === entry) {
        entry.tutorStatus = 'error';
        entry.tutorError = err.message;
      }
      mixedLearner.cacheStats.errors += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_error',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        error: err.message,
      });
      return null;
    }
  }

  async function takeMixedLearnerTutorPrefetch(
    entry,
    { learnerText, classification, tutorLearnerDag, registerSelection, humanDiscourseFrame, dialogueClosureFrame },
  ) {
    if (!entry || mixedLearner.analysisCache !== entry) return null;
    const liveContextKey = mixedLearnerTutorContextKey({
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
    });
    if (!entry.tutorContextKey || entry.tutorContextKey !== liveContextKey) {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: !entry.tutorContextKey ? 'not_prefetched' : 'context_changed',
        cachedKey: entry.tutorContextKey || null,
        liveKey: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const waited = entry.tutorStatus === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched tutor response', {
        learnerText,
        tutorTurn: entry.turn,
        classification,
        tutorLearnerDag,
        registerSelection,
      });
      await entry.tutorPromise;
      stopInterimAnimation(state);
    }
    if (!entry.tutorResponse || entry.tutorStatus !== 'ready') {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.tutorError ? 'prefetch_error' : 'prefetch_unavailable',
        key: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const response = { ...entry.tutorResponse, speculativeCacheHit: true };
    mixedLearner.analysisCache = null;
    mixedLearner.cacheStats.tutorHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: liveContextKey,
      waited,
      ageMs: Date.now() - entry.tutorStartedAt,
    });
    return response;
  }

  function startMixedLearnerAnalysisPrefetch({ answer, turnNumber, turnId, requestId }) {
    if (!state.classifier.enabled || !state.learnerDag.enabled || !state.world || !answer) return false;
    const key = currentMixedLearnerAnalysisKey(answer, turnNumber);
    const analysisState = cloneStateForMixedLearnerSpeculation();
    updateComprehensionForLearnerTurn({
      learnerText: answer,
      state: analysisState,
      classification: null,
      tutorTurn: turnNumber,
      recordTrace: false,
    });
    const entry = {
      key,
      answer,
      turn: turnNumber,
      turnId,
      requestId,
      status: 'pending',
      startedAt: Date.now(),
      raw: null,
      error: null,
      promise: null,
      tutorStatus: 'idle',
      tutorContextKey: null,
      tutorPromise: null,
      tutorResponse: null,
      tutorError: null,
      abortController: new AbortController(),
    };
    mixedLearner.analysisCache = entry;
    mixedLearner.cacheStats.analysisStarted += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      key,
    });
    entry.promise = extractCombinedLearnerAnalysis({
      learnerText: answer,
      state: analysisState,
      tutorTurn: turnNumber,
      role: 'tutor_stub_learner_analysis_prefetch',
      stream: { enabled: false, interim: state.interim },
      signal: entry.abortController.signal,
    })
      .then((raw) => {
        if (mixedLearner.analysisCache !== entry) return null;
        entry.status = 'ready';
        entry.raw = raw;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_ready',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          latencyMs: Date.now() - entry.startedAt,
        });
        void startMixedLearnerTutorPrefetch(entry, raw);
        return raw;
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return null;
        if (mixedLearner.analysisCache === entry) {
          entry.status = 'error';
          entry.error = err.message;
        }
        mixedLearner.cacheStats.errors += 1;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          error: err.message,
        });
        return null;
      });
    return true;
  }

  async function takeMixedLearnerAnalysisPrefetch(learnerText) {
    if (!mixedLearner.enabled) return null;
    const entry = mixedLearner.analysisCache;
    const answer = String(learnerText || '').trim();
    const expectedKey = currentMixedLearnerAnalysisKey(answer);
    if (!entry || entry.answer !== answer || entry.key !== expectedKey) {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: state.turns.length + 1,
        reason: !entry ? 'not_prefetched' : entry.answer !== answer ? 'answer_changed' : 'state_changed',
        cachedKey: entry?.key || null,
        submittedKey: expectedKey,
      });
      return null;
    }
    const waited = entry.status === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched learner analysis', {
        learnerText: answer,
        tutorTurn: state.turns.length + 1,
      });
      await entry.promise;
      stopInterimAnimation(state);
    }
    if (!entry.raw || entry.status !== 'ready') {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.error ? 'prefetch_error' : 'prefetch_unavailable',
        key: entry.key,
      });
      return null;
    }
    mixedLearner.cacheStats.analysisHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: entry.key,
      waited,
      ageMs: Date.now() - entry.startedAt,
    });
    return { raw: entry.raw, entry };
  }

  function startMixedLearnerPrefetch(reason = 'turn_complete', { force = false } = {}) {
    if (!mixedLearner.enabled || exiting || state.dialogueClosure?.phase === 'closed') return false;
    const turnNumber = state.turns.length + 1;
    const turnId = turnDebugId(state, turnNumber);
    if (!force && (mixedLearner.pending?.turn === turnNumber || mixedLearner.suggestion?.turn === turnNumber)) {
      return false;
    }
    if (force) resetMixedLearnerSuggestion(reason);
    const requestId = mixedLearner.seq + 1;
    mixedLearner.seq = requestId;
    mixedLearner.pending = { requestId, turn: turnNumber, turnId };
    mixedLearner.suggestion = null;
    mixedLearner.error = null;
    const artifactAbortController = new AbortController();
    mixedLearner.artifactAbortController = artifactAbortController;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      reason,
      model: mixedLearner.resolved,
    });
    void generateMixedLearnerArtifacts({
      state,
      resolved: mixedLearner.resolved,
      profile: mixedLearner.profile,
      turnNumber,
      cliEffort,
      signal: artifactAbortController.signal,
    })
      .then((generated) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        const text = String(generated.answer || '').trim();
        const clue = String(generated.clue || '').trim();
        const move = mixedLearnerSuggestionMove(text, generated.move);
        const profileSignal = String(generated.profileSignal || '').trim() || null;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId || exiting) {
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_prefetch_discarded',
            turn: turnNumber,
            turnId,
            requestId,
            reason: exiting ? 'exiting' : 'stale',
          });
          return;
        }
        mixedLearner.pending = null;
        mixedLearner.suggestion = {
          requestId,
          turn: turnNumber,
          turnId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profile: mixedLearner.profile,
          profileSignal,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_suggestion_ready',
          turn: turnNumber,
          turnId,
          requestId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profileSignal,
          parsedArtifacts: generated.parsedArtifacts,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        });
        const analysisWarming = startMixedLearnerAnalysisPrefetch({
          answer: text,
          turnNumber,
          turnId,
          requestId,
        });
        if (!processingTurn && !exiting) {
          clearStatusLine();
          if (consumeMixedLearnerReadyAnnouncement(mixedLearner)) {
            console.log(
              `${C.dim}mixed learner answer + clue ready for ${turnId}; suggested move: ${move === 'ask_question' ? 'ask a question' : 'respond'}${analysisWarming ? '; analysis warming in background' : ''}; Tab inserts this ${mixedLearner.profileId || 'custom'} draft; /suggest inspects it; /use sends it${C.reset}`,
            );
            printMixedLearnerProfilePresentation(mixedLearner.suggestion);
            appendTraceEvent(state.trace, {
              type: 'mixed_learner_ready_announcement',
              turn: turnNumber,
              turnId,
              profileId: mixedLearner.profileId,
              move,
            });
          }
          refreshMixedLearnerPrompt(rl);
        }
      })
      .catch((err) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        if (err?.name === 'AbortError') return;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId) return;
        mixedLearner.pending = null;
        mixedLearner.error = { turn: turnNumber, turnId, message: err.message };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          error: err.message,
        });
        if (!processingTurn && !exiting) {
          clearStatusLine();
          console.log(`${C.red}mixed learner error:${C.reset} ${err.message}${C.dim} (/regen to retry)${C.reset}`);
          refreshMixedLearnerPrompt(rl);
        }
      });
    return true;
  }

  function showMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(
        `${C.dim}mixed learner is off; run with --mixed-learner to enable autocomplete suggestions${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.cyan}learner suggestion >${C.reset} ${mixedLearner.suggestion.turnId} · ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      printMixedLearnerProfilePresentation(mixedLearner.suggestion);
      console.log(`${mixedLearner.suggestion.text}\n`);
      return;
    }
    if (mixedLearner.pending) {
      console.log(
        `${C.dim}mixed learner is drafting ${mixedLearner.pending.turnId}; use /suggest again when ready${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}mixed learner error:${C.reset} ${mixedLearner.error.message}${C.dim} (${mixedLearner.error.turnId}; /regen to retry)${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(
        `${C.dim}tutor is still thinking; mixed learner drafting starts after the tutor responds${C.reset}\n`,
      );
      return;
    }
    console.log(`${C.dim}no mixed learner suggestion is ready; starting one now${C.reset}\n`);
    startMixedLearnerPrefetch('suggest');
  }

  function showMixedLearnerClue({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}mixed learner is off; run with --mixed-learner to enable /clue${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.clue) {
      console.log(
        `${C.cyan}learner clue >${C.reset} ${mixedLearner.suggestion.turnId} · ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      console.log(`${mixedLearner.suggestion.clue}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.dim}the answer is ready, but no safe non-revealing clue was returned; /regen retries the pair${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.pending) {
      console.log(
        `${C.dim}mixed learner is drafting the clue and answer for ${mixedLearner.pending.turnId}${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}mixed learner error:${C.reset} ${mixedLearner.error.message}${C.dim} (/regen to retry)${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}tutor is still thinking; clue generation starts after the tutor responds${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no mixed learner clue is ready; starting the clue-answer pair now${C.reset}\n`);
    startMixedLearnerPrefetch('clue');
  }

  function handleMixedLearnerProfileCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}mixed learner is off; run with --mixed-learner to use /profile${C.reset}\n`);
      return;
    }
    const requested = String(argument || '').trim();
    if (!requested) {
      const label = mixedLearner.profileId
        ? `${mixedLearner.profileId}: ${learnerProfileDescription(mixedLearner.profileId)}`
        : `custom: ${oneLine(mixedLearner.profile, { max: 180 })}`;
      console.log(`${C.cyan}learner profile >${C.reset} ${label}`);
      console.log(
        `${C.dim}  use /profile list, /profile example, /profile <id>, /profile default, or /profile custom <description>${C.reset}\n`,
      );
      return;
    }
    if (requested === 'list') {
      console.log(`${C.cyan}learner profiles >${C.reset}`);
      console.log(`${learnerProfileListText()}\n`);
      return;
    }
    if (requested === 'example') {
      console.log(`${C.cyan}custom learner profile example >${C.reset}`);
      console.log(`/profile custom ${CUSTOM_LEARNER_PROFILE_EXAMPLE}`);
      console.log(
        `${C.dim}  describe an observable pattern, its trigger, and the tutor support that permits progress; do not add hidden case facts${C.reset}\n`,
      );
      return;
    }

    let nextProfile;
    let nextProfileId = null;
    if (requested === 'default') {
      nextProfile = mixedLearner.defaultProfile;
      nextProfileId = automatedLearnerProfileId(nextProfile);
    } else if (requested.startsWith('custom ')) {
      nextProfile = requested.slice('custom '.length).trim();
      if (!nextProfile) {
        console.log(`${C.red}profile error:${C.reset} custom profile text is empty\n`);
        return;
      }
    } else {
      nextProfileId = requested.toLowerCase().replace(/-/gu, '_');
      if (!learnerProfileIds().includes(nextProfileId)) {
        console.log(`${C.red}unknown learner profile:${C.reset} ${requested}`);
        console.log(`${C.dim}  use /profile list to see valid ids${C.reset}\n`);
        return;
      }
      nextProfile = learnerProfilePrompt(nextProfileId);
    }

    const previousProfileId = mixedLearner.profileId;
    const invalidated = resetMixedLearnerSuggestion('profile_changed');
    mixedLearner.profile = nextProfile;
    mixedLearner.profileId = nextProfileId;
    rl.setPrompt(mixedLearnerPromptText());
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_profile_changed',
      previousProfileId,
      profileId: nextProfileId,
      custom: !nextProfileId,
      duringTurn,
      turn: state.turns.length + 1,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
    });
    const label = nextProfileId ? `${nextProfileId}: ${learnerProfileDescription(nextProfileId)}` : 'custom profile';
    console.log(`${C.cyan}learner profile >${C.reset} switched to ${label}`);
    if (duringTurn) {
      console.log(`${C.dim}  applies when the current tutor response completes${C.reset}\n`);
    } else if (latestTutorMessage(state)) {
      startMixedLearnerPrefetch('profile_changed');
      console.log(
        `${C.dim}  cleared the prior clue, answer, analysis, and tutor-response cache; regenerating for the current turn; Tab activates when the ready message appears${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  applies after the next tutor message${C.reset}\n`);
    }
  }

  function acceptMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}mixed learner is off; run with --mixed-learner to enable /use${C.reset}\n`);
      return;
    }
    if (duringTurn) {
      console.log(
        `${C.dim}tutor is still thinking; /use is available once the current tutor response completes${C.reset}\n`,
      );
      return;
    }
    const suggestion = mixedLearner.suggestion;
    if (!suggestion?.text) {
      showMixedLearnerSuggestion({ duringTurn });
      return;
    }
    mixedLearner.suggestion = null;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_suggestion_accepted',
      turn: suggestion.turn,
      turnId: suggestion.turnId,
      requestId: suggestion.requestId,
      text: suggestion.text,
      move: suggestion.move,
      profileId: suggestion.profileId,
      profileSignal: suggestion.profileSignal,
      duringTurn,
    });
    printMixedLearnerProfilePresentation(suggestion, { verb: 'visible in response' });
    console.log(`${C.bold}learner(mixed) >${C.reset} ${suggestion.text}\n`);
    if (processingTurn || duringTurn) {
      pendingLearnerLines.push(suggestion.text);
      console.log(`${C.dim}queued mixed learner turn (${pendingLearnerLines.length} queued)${C.reset}`);
      return;
    }
    void processLearnerLine(suggestion.text);
  }

  function transcriptPayload() {
    return {
      ...visibleModel,
      classifier: classifierEnabled ? visibleClassifierConfig : null,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
      registerSelection: registerSelectionEnabled
        ? {
            enabled: true,
            palette: registerPalette,
            policy: registerPolicy,
            temperature: state.register.temperature,
            history: state.register.history,
          }
        : null,
      dialogueClosure: state.dialogueClosure,
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
      directorContext,
      trace: traceDisplayPath(state.trace),
      fieldVisualization: state.fieldViz?.lastWrite || null,
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      turns: state.turns,
    };
  }

  function finalizeInteractive(reason) {
    if (finalized) return;
    finalized = true;
    appendTraceEvent(state.trace, {
      type: 'run_end',
      reason,
      turns: state.turns.length,
      mixedLearnerCache: { ...mixedLearner.cacheStats },
    });
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason, report });
    }
    if (args.save) {
      saveTranscript(args.save, transcriptPayload());
    }
  }

  function requestExit(reason) {
    exiting = true;
    stopInterimAnimation(state);
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    resolveInteractive();
  }

  function promptIfIdle() {
    if (!exiting && !processingTurn) rl.prompt();
  }

  async function runClarificationCommand(term = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const latestTutor = latestTutorMessage(state);
    if (!latestTutor) {
      console.log(`${C.cyan}clarify >${C.reset} no tutor message is available yet`);
      console.log(
        `${C.dim}  start the dialogue first, then use /clarify [phrase] after tutor wording that needs explanation${C.reset}\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'clarification_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
      });
      return;
    }
    if (clarificationInFlight) {
      console.log(`${C.dim}clarification is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'clarification_skipped',
        reason: 'already_in_flight',
        duringTurn,
      });
      return;
    }

    clarificationInFlight = true;
    const requestedTerm = String(term || '').trim();
    const comprehensionRequest = detectTutorStubComprehensionRequest({
      explicitTerm: requestedTerm,
      text: requestedTerm || 'Explain the latest tutor wording.',
      source: 'slash_explain',
      turn: state.turns.length,
    });
    applyTutorStubComprehensionRequest(state.comprehension, comprehensionRequest);
    resetMixedLearnerSuggestion('comprehension_request');
    appendTraceEvent(state.trace, {
      type: 'comprehension_request',
      source: 'slash_explain',
      turn: state.turns.length,
      terms: comprehensionRequest.terms,
      generic: comprehensionRequest.generic,
      text: comprehensionRequest.text,
      advancesLearnerDag: false,
      comprehensionState: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length }),
    });
    appendTraceEvent(state.trace, {
      type: 'clarification_start',
      term: requestedTerm || null,
      duringTurn,
      turn: state.turns.length,
    });
    try {
      console.log(
        `${C.dim}clarifying${requestedTerm ? ` "${oneLine(requestedTerm, { max: 80 })}"` : ' latest tutor wording'}...${C.reset}`,
      );
      const response = await generateTutorClarification({
        state,
        term: requestedTerm,
        resolved: state.resolved,
        cliEffort: state.cliEffort,
      });
      clearStatusLine();
      console.log(`${C.cyan}clarify >${C.reset} ${response.text}\n`);
      const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
        text: response.text,
        turn: state.turns.length,
        source: 'slash_explain',
        force: true,
        terms: comprehensionRequest.terms,
      });
      appendTraceEvent(state.trace, {
        type: 'comprehension_response',
        source: 'slash_explain',
        turn: state.turns.length,
        explainedTerms: comprehensionResponse.explainedTerms,
        advancesLearnerDag: false,
        comprehensionState: comprehensionResponse.snapshot,
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_complete',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        text: response.text,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
      });
      if (duringTurn)
        console.log(
          `${C.dim}tutor is still thinking; clarification used the latest completed tutor message${C.reset}\n`,
        );
    } catch (err) {
      clearStatusLine();
      console.log(`${C.red}clarify error:${C.reset} ${err.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'clarification_error',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        error: err.message,
      });
    } finally {
      clarificationInFlight = false;
      if (!duringTurn) startMixedLearnerPrefetch('comprehension_state_changed');
    }
  }

  function emitOpeningPrompt(reason = 'start') {
    if (!openingEnabled || state.history.length) return null;
    const opening = buildTutorOpening(state);
    state.history.push({ role: 'assistant', content: opening });
    const turnId = openingDebugId(stateRunDebugId(state));
    appendTraceEvent(state.trace, { type: 'tutor_opening', turnId, reason, text: opening });
    printOpeningDebugLine(state);
    console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
    return opening;
  }

  function resetInteractiveState() {
    const currentRegisterTemperature =
      state.register?.temperature ?? registerTemperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
    const currentDagFactDropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    state.history = [];
    state.turns = [];
    state.printedDebugIds = new Set();
    state.dialogueClosure = { ...dialogueClosureConfig };
    state.learnerDag = createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: currentDagFactDropout.rate,
        seed: currentDagFactDropout.seed,
        graceTurns: currentDagFactDropout.graceTurns,
        maxConcurrent: currentDagFactDropout.maxConcurrent,
      },
    });
    state.comprehension = createTutorStubComprehensionState();
    state.register = {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      temperature: currentRegisterTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    };
  }

  function printDialogueSettings() {
    const active = registerTemperatureApplies(state.register?.policy);
    console.log(`${C.cyan}settings >${C.reset}`);
    console.log(
      `${C.dim}  stance temp: ${state.register?.temperature ?? registerTemperature} — lower sharpens the dominant engagement stance; higher broadens only that blend${C.reset}`,
    );
    console.log(
      `${C.dim}  policy: ${state.register?.policy || 'off'}; temperature ${active ? 'active for engagement stance only' : 'stored but not used by this policy'}${C.reset}`,
    );
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    console.log(
      `${C.dim}  DAG fact dropout: ${dropout.rate} (${dropout.rate > 0 ? 'on' : 'off'}); seed ${dropout.seed}; active dropped ${dropout.activeCount}; adopted facts tracked ${dropout.adoptedCount}${C.reset}`,
    );
    console.log(
      `${C.dim}  use /settings temp 1.0 or /settings dropout 0.15; dropout range 0-1 and 0 stops new losses${C.reset}\n`,
    );
  }

  function handleDialogueSettings(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '').trim().split(/\s+/u).filter(Boolean);
    const temperatureNames = ['temp', 'temperature', 'stance-temp'];
    const dropoutNames = ['dropout', 'dag-dropout', 'dag-fact-dropout'];
    if (!parts.length || (parts.length === 1 && [...temperatureNames, ...dropoutNames].includes(parts[0].toLowerCase()))) {
      printDialogueSettings();
      return;
    }
    const setting = parts[0].toLowerCase();
    if (![...temperatureNames, ...dropoutNames].includes(setting) || parts.length !== 2) {
      console.log(`${C.red}settings error:${C.reset} use /settings, /settings stance-temp <n>, or /settings dropout <0-1>`);
      console.log(`${C.dim}  examples: /settings temp 0.4 | /settings dropout 0.15${C.reset}\n`);
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}dialogue settings are unchanged while a tutor turn is in progress${C.reset}`);
      console.log(`${C.dim}  set it after the tutor response so the effective turn is deterministic${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'dialogue_setting_change_rejected',
        setting,
        reason: 'turn_in_progress',
        requested: parts[1],
        turn: state.turns.length + 1,
      });
      return;
    }

    if (dropoutNames.includes(setting)) {
      let nextRate;
      try {
        nextRate = normalizeTutorStubDagFactDropoutRate(parts[1], { label: 'DAG fact dropout' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousRate = state.learnerDag.dropout.rate;
      if (nextRate === previousRate) {
        console.log(`${C.cyan}settings >${C.reset} DAG fact dropout already ${nextRate}\n`);
        return;
      }
      state.learnerDag.dropout.rate = nextRate;
      const invalidated = resetMixedLearnerSuggestion('dag_fact_dropout_changed');
      appendTraceEvent(state.trace, {
        type: 'dag_fact_dropout_changed',
        schema: 'machinespirits.tutor-stub.dag-fact-dropout-change.v1',
        previous: previousRate,
        rate: nextRate,
        seed: state.learnerDag.dropout.seed,
        effectiveTurn: state.turns.length + 1,
        activeDroppedCount: Object.keys(state.learnerDag.dropout.activeDropped || {}).length,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} DAG fact dropout ${previousRate} → ${nextRate}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  ${nextRate === 0 ? 'new losses are off; already dropped facts still need re-adoption or /clear' : 'each eligible accumulated premise now has this seeded per-turn loss probability'}${C.reset}`,
      );
      if (!state.learnerDag.enabled) {
        console.log(`${C.dim}  stored but inactive because the tutor-side learner DAG is off${C.reset}`);
      }
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('dag_fact_dropout_changed');
        console.log(`${C.dim}  refreshed the mixed suggestion, analysis, and prefetched tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    let nextTemperature;
    try {
      nextTemperature = normalizeTutorStubEngagementStanceTemperature(parts[1], {
        label: 'engagement-stance temperature',
      });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
      return;
    }
    const previousTemperature = state.register?.temperature ?? registerTemperature;
    if (nextTemperature === previousTemperature) {
      console.log(`${C.cyan}settings >${C.reset} stance temp already ${nextTemperature}\n`);
      return;
    }

    state.register.temperature = nextTemperature;
    const invalidated = resetMixedLearnerSuggestion('register_temperature_changed');
    appendTraceEvent(state.trace, {
      type: 'register_temperature_changed',
      schema: 'machinespirits.tutor-stub.engagement-stance-temperature-change.v1',
      previous: previousTemperature,
      temperature: nextTemperature,
      policy: state.register.policy,
      active: registerTemperatureApplies(state.register.policy),
      scope: 'engagement_stance_only',
      effectiveTurn: state.turns.length + 1,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
    });
    console.log(
      `${C.cyan}settings >${C.reset} stance temp ${previousTemperature} → ${nextTemperature}; applies from turn ${state.turns.length + 1}`,
    );
    console.log(
      `${C.dim}  ${nextTemperature < previousTemperature ? 'the next distribution will be sharper' : 'the next distribution will be broader'}${C.reset}`,
    );
    if (!registerTemperatureApplies(state.register.policy)) {
      console.log(`${C.dim}  current policy ${state.register.policy} does not use local stance temperature${C.reset}`);
    }
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('register_temperature_changed');
      console.log(`${C.dim}  refreshed the mixed suggestion, analysis, and prefetched tutor response${C.reset}`);
    }
    console.log();
  }

  function handleSlashCommand(trimmed, { duringTurn = false } = {}) {
    if (!trimmed.startsWith('/')) return false;
    const command = trimmed.split(/\s+/u)[0];
    const commandArg = trimmed.slice(command.length).trim();
    if (trimmed === '/quit' || trimmed === '/exit') {
      if (duringTurn) {
        stopInterimAnimation(state);
        clearStatusLine();
        console.log(`${C.dim}exit requested; stopping this stub now${C.reset}`);
        resetMixedLearnerSuggestion('exit_requested_during_turn');
        finalizeInteractive('exit_requested_during_turn');
        process.exit(0);
      }
      requestExit('exit');
      return true;
    }
    const pausedInterim = duringTurn ? pauseInterimAnimation(state) : false;
    const finishSlashCommand = () => {
      if (pausedInterim) resumeInterimAnimation(state);
    };
    if (trimmed === '/help') {
      clearStatusLine();
      printInteractiveHelp();
      appendTraceEvent(state.trace, { type: 'interactive_help', turns: state.turns.length, duringTurn });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; slash commands remain available${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/settings') {
      handleDialogueSettings(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/analysis' || command === '/a') {
      clearStatusLine();
      const analysisMode = commandArg.toLowerCase();
      const technical = ['technical', 'tech', 'evidence', 'debug'].includes(analysisMode);
      if (analysisMode && !technical) {
        console.log(`${C.red}unknown analysis mode:${C.reset} ${commandArg}`);
        console.log(`${C.dim}  use /analysis or /analysis technical${C.reset}\n`);
      } else {
        printCurrentTurnAnalysis(state, { technical });
      }
      appendTraceEvent(state.trace, {
        type: 'analysis_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        mode: technical ? 'technical' : 'plain',
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; showing the latest completed turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/field' || trimmed === '/f') {
      clearStatusLine();
      const field = printLightweightDialogueField(state);
      appendTraceEvent(state.trace, {
        type: 'field_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        field,
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; field excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/viz' || trimmed === '/v' || trimmed === '/visualization') {
      clearStatusLine();
      const viz = printFieldVisualization(state, { reason: duringTurn ? 'viz_during_turn' : 'viz' });
      appendTraceEvent(state.trace, {
        type: 'field_visualization_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        viz: viz
          ? {
              svg: viz.svgDisplayPath,
              json: viz.jsonDisplayPath,
              turnCount: viz.field.turnCount,
            }
          : null,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; visualization excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/clarify' || command === '/explain' || command === '/c') {
      return runClarificationCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
    }
    if (trimmed === '/report' || trimmed === '/r') {
      clearStatusLine();
      const report = printDialogueCloseout(state, {
        reason: duringTurn ? 'report_during_turn' : 'report',
        trace: state.trace,
      });
      appendTraceEvent(state.trace, {
        type: 'closeout_report_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        report,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; closeout excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/id' || trimmed === '/turn-id' || trimmed === '/debug-id') {
      clearStatusLine();
      const debug = printCurrentDebugId(state, { duringTurn });
      appendTraceEvent(state.trace, {
        type: 'debug_id_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        debug,
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; the in-progress trace may still be incomplete${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/suggest') {
      showMixedLearnerSuggestion({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.text),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/profile') {
      handleMixedLearnerProfileCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/clue' || trimmed === '/hint') {
      showMixedLearnerClue({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_clue_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.clue),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/use' || trimmed === '/accept') {
      acceptMixedLearnerSuggestion({ duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/regen') {
      clearStatusLine();
      if (!mixedLearner.enabled) {
        console.log(`${C.dim}mixed learner is off; run with --mixed-learner to enable /regen${C.reset}\n`);
      } else if (duringTurn) {
        console.log(`${C.dim}tutor is still thinking; /regen is available after the tutor responds${C.reset}\n`);
      } else {
        startMixedLearnerPrefetch('regen', { force: true });
        console.log(`${C.dim}regenerating mixed learner clue-answer pair${C.reset}\n`);
      }
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/clear') {
      if (duringTurn) {
        clearStatusLine();
        console.log(`${C.dim}/clear is disabled while a tutor turn is in progress${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'slash_command_deferred',
          command: '/clear',
          reason: 'turn_in_progress',
        });
        finishSlashCommand();
        return true;
      }
      resetMixedLearnerSuggestion('history_clear');
      resetInteractiveState();
      pendingLearnerLines.length = 0;
      appendTraceEvent(state.trace, { type: 'history_clear' });
      console.log(`${C.dim}history cleared${C.reset}\n`);
      const opening = emitOpeningPrompt('clear');
      if (opening) startMixedLearnerPrefetch('clear_opening');
      finishSlashCommand();
      return true;
    }
    clearStatusLine();
    console.log(`${C.red}unknown command:${C.reset} ${trimmed} ${C.dim}(try /help)${C.reset}\n`);
    appendTraceEvent(state.trace, { type: 'unknown_slash_command', command: trimmed, duringTurn });
    finishSlashCommand();
    return true;
  }

  async function processLearnerLine(trimmed) {
    if (exiting) return;
    if (state.dialogueClosure?.phase === 'closed') {
      console.log(`${C.cyan}dialogue closed >${C.reset} this inquiry has already ended`);
      console.log(`${C.dim}  use /report to inspect it, /clear to begin again, or /quit to leave${C.reset}\n`);
      return;
    }
    processingTurn = true;
    let completedTurn = false;
    const closureAcknowledgement = Boolean(
      state.dialogueClosure?.phase === 'awaiting_checkin' && tutorStubClosureAcknowledgement(trimmed),
    );
    const prefetchedAnalysis = closureAcknowledgement ? null : await takeMixedLearnerAnalysisPrefetch(trimmed);
    resetMixedLearnerSuggestion('learner_turn_started', {
      preserveAnalysisCache: Boolean(prefetchedAnalysis?.entry),
    });
    try {
      if (closureAcknowledgement) {
        const tutorTurn = state.turns.length + 1;
        const inheritedModel = state.turns.at(-1)?.tutorLearnerDagModel || null;
        const tutorLearnerDag = { model: inheritedModel };
        const { frame } = tutorDialogueClosureFrameForTurn({ state, tutorTurn, tutorLearnerDag });
        const text = deterministicTutorStubClosureResponse(frame, { acknowledgement: true });
        const closureAudit = auditTutorStubDialogueClosureResponse({ text, frame });
        printTurnDebugLine(state, tutorTurn);
        const response = await runOneTurn(
          trimmed,
          state,
          {
            turn: {
              summary: 'Learner declines the optional final check-in.',
              request_type: 'off_task_or_mixed',
              discourse_move: 'claim',
              evidence_use: 'none',
              epistemic_stance: 'grounded',
              affect: 'settled',
              agency: 'steering',
              scores: {},
              pedagogical_need: 'Close the inquiry without another question.',
            },
            overall: {
              summary: 'The learner accepts dialogue closure.',
              trajectory: 'terminal closure',
              current_state: 'settled',
              next_best_tutor_move: 'Close the inquiry.',
            },
          },
          tutorLearnerDag,
          null,
          null,
          {
            text,
            provider: state.resolved.provider,
            model: state.resolved.model,
            latencyMs: 0,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
            leakAudit: { ok: true, leaks: [] },
            scaffoldAudit: { ok: true, issues: [], similarity: 0 },
            closureAudit,
            deterministicClosure: true,
          },
        );
        printTutorDagSnapshot(response.dagSnapshot);
        printTutorResponse(response, state.stream);
        console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
        writeFieldVisualization(state, { reason: 'dialogue_closure_acknowledgement' });
        completedTurn = true;
        return;
      }
      const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
        trimmed,
        state,
        { precomputedRaw: prefetchedAnalysis?.raw || null },
      );
      if (exiting) return;
      const humanDiscourseFrame = buildHumanDiscourseFrame({
        state,
        tutorTurn: state.turns.length + 1,
        tutorLearnerDag,
        classification,
        learnerText: trimmed,
      });
      const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
        state,
        tutorTurn: state.turns.length + 1,
        tutorLearnerDag,
      });
      const prefetchedResponse = await takeMixedLearnerTutorPrefetch(prefetchedAnalysis?.entry, {
        learnerText: trimmed,
        classification,
        tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
      });
      if (!prefetchedResponse) {
        startInterimAnimation(
          state,
          'calling tutor',
          buildTutorInterimContext({
            learnerText: trimmed,
            state,
            classification,
            tutorLearnerDag,
            registerSelection,
            previousRegisterEfficacy,
          }),
        );
      }
      let response;
      try {
        response = await runOneTurn(
          trimmed,
          state,
          classification,
          tutorLearnerDag,
          registerSelection,
          previousRegisterEfficacy,
          prefetchedResponse,
        );
      } finally {
        stopInterimAnimation(state);
      }
      if (exiting) return;
      printTutorDagSnapshot(response.dagSnapshot);
      printTutorResponse(response, state.stream);
      console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
      if (state.dialogueClosure?.phase === 'awaiting_checkin') {
        console.log(
          `${C.cyan}dialogue closing >${C.reset} the verdict has reached closure; one optional learner check-in remains`,
        );
        console.log(`${C.dim}  reply once to revisit a link, or say “no thanks” to close immediately${C.reset}\n`);
      }
      writeFieldVisualization(state, { reason: 'turn_complete' });
      completedTurn = true;
    } catch (err) {
      stopInterimAnimation(state);
      clearStatusLine();
      console.error(`${C.red}error:${C.reset} ${err.message}\n`);
    } finally {
      processingTurn = false;
      if (!exiting) {
        if (state.dialogueClosure?.phase === 'closed') {
          pendingLearnerLines.length = 0;
          requestExit('dialogue_grounded_closure');
        } else {
          const next = pendingLearnerLines.shift();
          if (next) {
            console.log(`${C.dim}running queued learner turn (${pendingLearnerLines.length} still queued)${C.reset}`);
            void processLearnerLine(next);
          } else {
            if (completedTurn) startMixedLearnerPrefetch('turn_complete');
            promptIfIdle();
          }
        }
      }
    }
  }

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      promptIfIdle();
      return;
    }
    const slashResult = handleSlashCommand(trimmed, { duringTurn: processingTurn });
    if (slashResult) {
      if (typeof slashResult.then === 'function') {
        void slashResult.finally(() => {
          promptIfIdle();
        });
      } else {
        promptIfIdle();
      }
      return;
    }
    if (processingTurn) {
      const pausedInterim = pauseInterimAnimation(state);
      pendingLearnerLines.push(trimmed);
      console.log(
        `${C.dim}queued learner turn (${pendingLearnerLines.length} queued); use /analysis, /field, /viz, or /clarify while waiting${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'learner_turn_queued',
        queued: pendingLearnerLines.length,
      });
      if (pausedInterim) resumeInterimAnimation(state);
      return;
    }
    void processLearnerLine(trimmed);
  });

  rl.on('SIGINT', () => {
    stopInterimAnimation(state);
    console.log();
    requestExit('sigint');
  });

  rl.on('close', () => {
    exiting = true;
    stopInterimAnimation(state);
    if (!finalized) finalizeInteractive('exit');
    resolveInteractive();
  });

  const opening = emitOpeningPrompt('start');
  if (opening) startMixedLearnerPrefetch('opening');

  promptIfIdle();
  await interactiveDone;
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
