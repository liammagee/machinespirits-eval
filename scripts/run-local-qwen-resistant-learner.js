#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'yaml';

import {
  learnerProfileIds,
  learnerProfilePrompt,
} from './tutor-stub-learner-profile-contracts.js';

export const LOCAL_LEARNER_SPEC_SCHEMA = 'machinespirits.tutor-stub.local-learner-spec.v1';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SPEC = path.join(
  ROOT,
  'config',
  'tutor-stub-local-learners',
  'qwen-abliterated-frame-defiant.v1.yaml',
);

function nonEmpty(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} must be a non-empty string`);
  return text;
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !String(entry || '').trim())) {
    throw new Error(`${label} must be a non-empty string list`);
  }
  return value.map((entry) => String(entry).trim());
}

function positiveInt(value, label, { maximum = 100 } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${label} must be an integer from 1 to ${maximum}`);
  }
  return number;
}

function loopbackBaseUrl(value) {
  const url = new URL(nonEmpty(value, 'local_service.base_url'));
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('local_service.base_url must use a loopback host');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('local_service.base_url must use http or https');
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/u, '');
}

export function normalizeLocalLearnerSpec(value, { source = 'local learner spec' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${source} must be a YAML object`);
  }
  if (value.schema !== LOCAL_LEARNER_SPEC_SCHEMA) {
    throw new Error(`${source} uses unsupported schema ${value.schema || '(missing)'}`);
  }
  const profile = nonEmpty(value.profile, 'profile').replaceAll('-', '_').toLowerCase();
  if (!learnerProfileIds().includes(profile)) {
    throw new Error(`profile must name a built-in learner profile (got ${value.profile})`);
  }
  const turns = positiveInt(value.run?.turns, 'run.turns', { maximum: 12 });
  const modelCallBudget = positiveInt(value.run?.model_call_budget, 'run.model_call_budget', { maximum: 100 });
  if (modelCallBudget < turns * 2) {
    throw new Error(`run.model_call_budget must allow the planned ${turns * 2} tutor and learner calls`);
  }
  const maxSentences = positiveInt(value.tone?.max_sentences, 'tone.max_sentences', { maximum: 4 });
  return Object.freeze({
    schema: LOCAL_LEARNER_SPEC_SCHEMA,
    id: nonEmpty(value.id, 'id'),
    profile,
    character: Object.freeze({
      name: nonEmpty(value.character?.name, 'character.name'),
      role: nonEmpty(value.character?.role, 'character.role'),
      situation: nonEmpty(value.character?.situation, 'character.situation'),
      commitments: Object.freeze(stringList(value.character?.commitments, 'character.commitments')),
    }),
    tone: Object.freeze({
      description: nonEmpty(value.tone?.description, 'tone.description'),
      maxSentences,
      avoid: Object.freeze(stringList(value.tone?.avoid, 'tone.avoid')),
    }),
    scenario: Object.freeze({
      world: nonEmpty(value.scenario?.world, 'scenario.world'),
      tutor: nonEmpty(value.scenario?.tutor, 'scenario.tutor'),
    }),
    models: Object.freeze({
      tutor: nonEmpty(value.models?.tutor, 'models.tutor'),
      learner: nonEmpty(value.models?.learner, 'models.learner'),
      tutorEffort: nonEmpty(value.models?.tutor_effort || 'low', 'models.tutor_effort'),
    }),
    run: Object.freeze({
      turns,
      modelCallBudget,
      stopOnGrounded: value.run?.stop_on_grounded === true,
    }),
    localService: Object.freeze({
      baseUrl: loopbackBaseUrl(value.local_service?.base_url),
      profile: nonEmpty(value.local_service?.profile, 'local_service.profile'),
      modelIdContains: nonEmpty(value.local_service?.model_id_contains, 'local_service.model_id_contains'),
    }),
    claimBoundary: nonEmpty(value.claim_boundary, 'claim_boundary'),
  });
}

export function readLocalLearnerSpec(filePath = DEFAULT_SPEC) {
  const absolute = path.resolve(filePath);
  return Object.freeze({
    ...normalizeLocalLearnerSpec(yaml.parse(fs.readFileSync(absolute, 'utf8')), { source: absolute }),
    filePath: absolute,
  });
}

function bulletLines(values) {
  return values.map((value) => `- ${value}`).join('\n');
}

export function buildLocalLearnerBehaviorPrompt(spec) {
  return [
    `You are simulating this automated learner profile: ${spec.profile}`,
    '',
    learnerProfilePrompt(spec.profile),
    '',
    '# Character',
    '',
    `Name: ${spec.character.name}`,
    `Role: ${spec.character.role}`,
    `Situation: ${spec.character.situation}`,
    'Stable commitments:',
    bulletLines(spec.character.commitments),
    '',
    '# Tone',
    '',
    spec.tone.description,
    `Use at most ${spec.tone.maxSentences} sentence${spec.tone.maxSentences === 1 ? '' : 's'} per public turn.`,
    'Avoid:',
    bulletLines(spec.tone.avoid),
    '',
    'Character and tone shape the wording, but they never weaken the recurring behavior or license invented evidence.',
  ].join('\n');
}

export function buildTutorStubArgs(spec, { savePath, dryRun = false } = {}) {
  const args = [
    path.join(ROOT, 'scripts', 'tutor-stub.js'),
    '--lab',
    'learner_role_smoke',
    '--tutor',
    spec.scenario.tutor,
    '--world',
    spec.scenario.world,
    '--model',
    spec.models.tutor,
    '--auto-learner-model',
    spec.models.learner,
    '--auto-learner-profile',
    buildLocalLearnerBehaviorPrompt(spec),
    '--auto-turns',
    String(spec.run.turns),
    '--model-call-budget',
    String(spec.run.modelCallBudget),
    '--cli-effort',
    spec.models.tutorEffort,
    '--no-stream',
    '--no-remember-settings',
  ];
  if (!spec.run.stopOnGrounded) args.push('--no-auto-stop-on-grounded');
  if (savePath) args.push('--save', savePath);
  if (dryRun) args.push('--dry-run', '--no-trace');
  return args;
}

function openAiRoot(baseUrl) {
  return String(baseUrl)
    .replace(/\/+$/u, '')
    .replace(/\/chat\/completions$/u, '')
    .replace(/\/v1$/u, '');
}

export async function discoverLoadedModel(baseUrl, { modelIdContains, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${openAiRoot(baseUrl)}/v1/models`);
  if (!response.ok) throw new Error(`local model inventory failed with HTTP ${response.status}`);
  const payload = await response.json();
  const ids = (Array.isArray(payload?.data) ? payload.data : [])
    .map((entry) => String(entry?.id || '').trim())
    .filter(Boolean);
  const selector = nonEmpty(modelIdContains, 'modelIdContains');
  const matching = ids.filter((id) => id.includes(selector));
  if (matching.length !== 1) {
    throw new Error(
      `expected exactly one loaded local model matching ${selector}, found ${matching.length}; advertised: ${ids.join(', ') || '(none)'}`,
    );
  }
  return matching[0];
}

function runChild(command, args, { cwd, env = process.env, inherit = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (!inherit) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
  });
}

async function manageServer(mtpChatRoot, profile, action) {
  const runScript = path.join(mtpChatRoot, 'run.sh');
  if (!fs.existsSync(runScript)) throw new Error(`MTP chat runner not found: ${runScript}`);
  const args = action === 'start' ? ['--serve', '--profile', profile] : ['--server-stop'];
  const result = await runChild(runScript, args, { cwd: mtpChatRoot });
  if (result.code !== 0) throw new Error(`MTP chat server ${action} failed with exit ${result.code}`);
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/u, 'Z');
}

function usage() {
  return `Usage: node scripts/run-local-qwen-resistant-learner.js [options]\n\n` +
    `  --spec <yaml>           learner profile, character, tone, models, and bounds\n` +
    `  --mtp-chat-root <path>  checkout containing run.sh (or set MTP_CHAT_ROOT)\n` +
    `  --no-manage-server      use an already-running loopback service\n` +
    `  --save <json>           transcript destination\n` +
    `  --dry-run               resolve the full tutor-stub plan with zero model calls\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      spec: { type: 'string', default: DEFAULT_SPEC },
      'mtp-chat-root': { type: 'string', default: process.env.MTP_CHAT_ROOT || '' },
      'no-manage-server': { type: 'boolean', default: false },
      save: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(usage());
    return 0;
  }
  const spec = readLocalLearnerSpec(values.spec);
  const savePath = path.resolve(
    values.save || path.join(ROOT, '.tutor-stub-traces', `${spec.id}-${safeTimestamp()}.json`),
  );
  fs.mkdirSync(path.dirname(savePath), { recursive: true });

  if (values['dry-run']) {
    const result = await runChild(process.execPath, buildTutorStubArgs(spec, { savePath, dryRun: true }), {
      cwd: ROOT,
      inherit: false,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.code;
  }

  const manage = !values['no-manage-server'];
  const mtpChatRoot = values['mtp-chat-root'] ? path.resolve(values['mtp-chat-root']) : '';
  if (manage && !mtpChatRoot) throw new Error('--mtp-chat-root or MTP_CHAT_ROOT is required to manage the service');

  let serverStarted = false;
  try {
    if (manage) {
      await manageServer(mtpChatRoot, spec.localService.profile, 'start');
      serverStarted = true;
    }
    const modelId = await discoverLoadedModel(spec.localService.baseUrl, {
      modelIdContains: spec.localService.modelIdContains,
    });
    process.stdout.write(
      `${JSON.stringify({
        event: 'local_learner_ready',
        spec: spec.id,
        profile: spec.profile,
        character: spec.character.name,
        tone: spec.tone.description,
        localModel: modelId,
        tutorModel: spec.models.tutor,
        turns: spec.run.turns,
        callCeiling: spec.run.modelCallBudget,
        transcript: savePath,
        claimBoundary: spec.claimBoundary,
      })}\n`,
    );
    const result = await runChild(process.execPath, buildTutorStubArgs(spec, { savePath }), {
      cwd: ROOT,
      env: {
        ...process.env,
        MLX_LOCAL_AI_URL: spec.localService.baseUrl,
        MLX_LOCAL_AI_MODEL: modelId,
        TUTOR_STUB_TRANSCRIPT_OPEN: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    return result.code;
  } finally {
    if (serverStarted) await manageServer(mtpChatRoot, spec.localService.profile, 'stop');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    },
  );
}
