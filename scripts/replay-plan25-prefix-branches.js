#!/usr/bin/env node
/**
 * Small Plan 2.5 AF6 prefix-branch replay harness.
 *
 * This intentionally does not mutate the main poetics generator. It takes a
 * frozen public prefix, appends predeclared tutor branch responses, emits
 * score-poetics-phase2-compatible transcript artifacts, and can run a free mock
 * scoring smoke. Mock continuations are useful for plumbing and negative-control
 * leakage checks; live learner continuations are the claim-bearing screen.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { generateLearnerResponse } from '../services/learnerTutorInteractionEngine.js';
import { callModel } from './score-poetics-calibration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function usage() {
  return `Usage:
  node scripts/replay-plan25-prefix-branches.js \\
    --design <branch-spec.yaml> \\
    --out-dir <dir> \\
    (--mock | --live-learner) [--score | --score-mock] [--force]

Options:
  --design FILE                 Branch design YAML with freeze + branches.
  --prefix-file FILE            Override freeze.frozen_prefix_file.
  --out-dir DIR                 Output directory.
  --branches a,b                Limit branch keys.
  --mock                        Use deterministic mock learner continuations.
  --live-learner                Generate learner continuations through learnerTutorInteractionEngine.
  --learner-model MODEL         Model override for live learner roles (default: claude-code.sonnet).
  --learner-profile NAME        Override source-key learner profile.
  --persona NAME                Override source-key learner persona.
  --source-key FILE             Source run key.yaml for learner profile/persona metadata.
  --topic TEXT                  Override inferred learner topic/context.
  --score                       Run score-poetics-phase2.js on output.
  --score-model MODEL[,MODEL]   Critic model(s) for --score (default: codex).
  --score-concurrency N         Critic concurrency for --score (default: 1).
  --score-mock                  Run score-poetics-phase2.js --mock on output.
  --force                       Replace an existing output directory.
  --allow-forbidden-suffix      Warn instead of failing on control suffix leaks.
  --help                        Show this help.
`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const o = {
    design: null,
    prefixFile: null,
    outDir: null,
    branches: null,
    mock: false,
    liveLearner: false,
    learnerModel: 'claude-code.sonnet',
    learnerProfile: null,
    persona: null,
    sourceKey: null,
    topic: null,
    score: false,
    scoreModel: 'codex',
    scoreConcurrency: 1,
    scoreMock: false,
    force: false,
    allowForbiddenSuffix: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--design':
        o.design = path.resolve(argv[++i]);
        break;
      case '--prefix-file':
        o.prefixFile = path.resolve(argv[++i]);
        break;
      case '--out-dir':
        o.outDir = path.resolve(argv[++i]);
        break;
      case '--branches':
        o.branches = String(argv[++i] || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        break;
      case '--mock':
        o.mock = true;
        break;
      case '--live-learner':
        o.liveLearner = true;
        break;
      case '--learner-model':
        o.learnerModel = argv[++i];
        break;
      case '--learner-profile':
        o.learnerProfile = argv[++i];
        break;
      case '--persona':
        o.persona = argv[++i];
        break;
      case '--source-key':
        o.sourceKey = path.resolve(argv[++i]);
        break;
      case '--topic':
        o.topic = argv[++i];
        break;
      case '--score':
        o.score = true;
        break;
      case '--score-model':
        o.scoreModel = argv[++i];
        break;
      case '--score-concurrency':
        o.scoreConcurrency = Number.parseInt(argv[++i], 10);
        break;
      case '--score-mock':
        o.scoreMock = true;
        break;
      case '--force':
        o.force = true;
        break;
      case '--allow-forbidden-suffix':
        o.allowForbiddenSuffix = true;
        break;
      case '--help':
      case '-h':
        o.help = true;
        break;
      default:
        throw new Error(`Unknown arg: ${arg}\n\n${usage()}`);
    }
  }
  return o;
}

function listOption(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function slug(value) {
  return String(value || 'unknown').replace(/[^\w-]/g, '_');
}

function modelFamily(modelRef) {
  const ref = String(modelRef || '').toLowerCase();
  if (ref.includes('codex') || ref.includes('openai') || ref.includes('gpt')) return 'openai';
  if (ref.includes('claude') || ref.includes('anthropic') || ref.includes('sonnet') || ref.includes('opus')) return 'anthropic';
  if (ref.includes('gemini') || ref.includes('google')) return 'google';
  if (ref.includes('deepseek')) return 'deepseek';
  return ref || 'unknown';
}

function requireFile(p, label) {
  if (!p) throw new Error(`Missing ${label}`);
  if (!fs.existsSync(p)) throw new Error(`${label} not found: ${p}`);
  return p;
}

function readYaml(p) {
  return yaml.parse(fs.readFileSync(p, 'utf8')) || {};
}

function resolveFrom(baseDir, maybeRelative) {
  if (!maybeRelative) return null;
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(baseDir, maybeRelative);
}

function parseTurns(raw) {
  const turns = [];
  const blocks = String(raw || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const match = block.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (match) {
      turns.push({ role: match[1], text: match[2].trim() });
    } else if (turns.length) {
      turns[turns.length - 1].text += `\n\n${block}`;
    } else {
      throw new Error(`Prefix starts with an untagged block:\n${block.slice(0, 160)}`);
    }
  }
  return turns;
}

function renderTurn(role, text) {
  return `${role}: ${String(text || '').trim()}`;
}

function renderTranscript(turns) {
  return turns.map((turn) => renderTurn(turn.role, turn.text)).join('\n\n').trim() + '\n';
}

function stripOuterQuote(text) {
  const s = String(text || '').trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function prefixConversationHistory(turns) {
  return turns
    .filter((turn) => turn.role === 'TUTOR' || turn.role === 'LEARNER')
    .map((turn) => ({
      role: turn.role === 'TUTOR' ? 'tutor' : 'learner',
      content: stripOuterQuote(turn.text),
    }));
}

function stageContext(turns) {
  return turns
    .filter((turn) => turn.role === 'STAGE')
    .map((turn) => stripOuterQuote(turn.text))
    .filter(Boolean)
    .join('\n');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function forbiddenMatches(text, terms) {
  const found = [];
  for (const rawTerm of terms || []) {
    const term = String(rawTerm || '').trim();
    if (!term) continue;
    const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(term)}([^A-Za-z0-9]|$)`, 'i');
    if (pattern.test(text)) found.push(term);
  }
  return found;
}

function inferControlBranchKeys(design) {
  const keys = new Set();
  const criteria = design?.success_criteria?.cheap_replay_screen || {};
  for (const [key, value] of Object.entries(criteria)) {
    if (value?.no_metric_repair_leak || value?.no_learner_actional_metric_repair) keys.add(key);
  }
  for (const [key, branch] of Object.entries(design.branches || {})) {
    if (/control|blocker|hold/i.test(key) || /non_repairable|external|hold/i.test(branch?.intended_tutor_move || '')) {
      keys.add(key);
    }
  }
  return keys;
}

function forbiddenAuditScope(branch = {}) {
  const scope = branch.forbidden_audit_scope || branch.forbiddenAuditScope || 'suffix';
  if (!['suffix', 'tutor', 'learner'].includes(scope)) {
    throw new Error(`Invalid forbidden_audit_scope "${scope}". Use suffix, tutor, or learner.`);
  }
  return scope;
}

function auditTextForScope(scope, suffixTurns) {
  if (scope === 'tutor') return renderTranscript(suffixTurns.filter((turn) => turn.role === 'TUTOR'));
  if (scope === 'learner') return renderTranscript(suffixTurns.filter((turn) => turn.role === 'LEARNER'));
  return renderTranscript(suffixTurns);
}

function mockLearnerContinuation(branchKey, branch, design = {}) {
  const key = String(branchKey || '').toLowerCase();
  const move = String(branch?.intended_tutor_move || '').toLowerCase();
  if (key.includes('adaptive') || move.includes('gate') || move.includes('route_change')) {
    const profile = design.numeric_profile || branch.numeric_profile || {};
    const gateA = profile.gate_a_answer || profile.gateA_answer || profile.gate_a_floor || profile.gateA_floor || 'the first gate';
    const gateB = profile.gate_b_answer || profile.gateB_answer || profile.gate_b_recall || profile.gateB_recall || 'the second gate';
    const replacement =
      profile.replacement_claim ||
      'this model is not deployable from the headline route alone; the replacement claim must report the visible failure mode.';
    return `"Gate A gives ${gateA}, so the old route is not enough by itself. Gate B gives ${gateB}, which shows whether the class that matters is actually being recovered. So my earlier claim should be rewritten: ${replacement}"`;
  }
  if (key.includes('control') || key.includes('blocker') || move.includes('hold')) {
    return `"Then I cannot fix the submission inside this hearing. If the only live issue is absent authorization, I leave the submitted figure unchanged and mark the packet as pending rather than treating this as proof."`;
  }
  return `"I can follow that branch. I will state only what the new constraint permits, without adding a repair that the scene has not earned."`;
}

function defaultSourceKeyPath(design) {
  const source = design.source || {};
  if (!source.battery || !source.seed) return null;
  return path.resolve(ROOT, source.battery, `seed-${source.seed}`, 'key.yaml');
}

function loadSourceItem(design, explicitSourceKey = null) {
  const keyPath = explicitSourceKey || defaultSourceKeyPath(design);
  if (!keyPath || !fs.existsSync(keyPath)) return { keyPath: null, item: null };
  const key = readYaml(keyPath);
  const tid = design.source?.source_tid;
  const item = tid ? key.items?.[tid] : null;
  return { keyPath, item: item || null };
}

function inferTopic(_design, sourceItem) {
  const constraints = sourceItem?.curriculum_binding?.rhetorical_public_constraints || {};
  const pieces = [
    sourceItem?.curriculum_binding?.module_title,
    constraints.artifact ? `artifact: ${constraints.artifact}` : null,
  ].filter(Boolean);
  if (pieces.length) return pieces.join('; ');
  return 'AI model evaluation: decide whether a headline accuracy claim is licensed by the visible audit evidence.';
}

function liveLearnerProfileContext({ prefixTurns, sourceItem }) {
  const constraints = sourceItem?.curriculum_binding?.rhetorical_public_constraints || {};
  const stage = stageContext(prefixTurns);
  const lines = [
    'You are resuming a frozen public tutoring scene. Respond only as the learner in the scene.',
    'Use only the visible public transcript and the tutor response just given. Do not mention hidden labels, answer keys, hashes, generator metadata, scoring categories, or experiment design.',
  ];
  if (stage) lines.push(`Visible stage context:\n${stage}`);
  if (constraints.scene) lines.push(`Scene frame:\n${constraints.scene}`);
  if (Array.isArray(constraints.forbidden_public_exposure) && constraints.forbidden_public_exposure.length) {
    lines.push(`Do not expose:\n- ${constraints.forbidden_public_exposure.join('\n- ')}`);
  }
  return lines.join('\n\n');
}

function learnerBridgeModel(modelRef) {
  const ref = String(modelRef || '');
  if (ref === 'codex' || ref.startsWith('codex.')) return 'codex';
  if (ref === 'claude-code' || ref.startsWith('claude-code.')) return 'claude-code';
  return null;
}

function learnerModelOverrideForEngine(modelRef) {
  return learnerBridgeModel(modelRef) ? null : modelRef;
}

function liveLearnerLlmCall(opts) {
  const modelKey = learnerBridgeModel(opts.learnerModel);
  if (!modelKey) return null;
  return async (_model, systemPrompt, messages, callOptions = {}) => {
    const userContent = (messages || [])
      .map((message) => `${String(message.role || 'user').toUpperCase()}:\n${message.content || ''}`)
      .join('\n\n');
    const prompt = [
      systemPrompt,
      userContent,
      'Return only the learner-facing response text requested by the prompt. Do not add analysis, JSON, markdown fences, or hidden reasoning.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const content = await callModel(prompt, modelKey);
    return {
      content,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: opts.learnerModel,
      provider: modelKey,
      latencyMs: null,
      generationId: null,
      apiPayload: {
        captureVersion: 1,
        source: 'plan25_prefix_branch_replay_cli_bridge',
        provider: modelKey,
        role: callOptions.agentRole || null,
      },
    };
  };
}

async function liveLearnerContinuation({ branch, design, opts, prefixTurns, sourceItem }) {
  const learnerProfile = opts.learnerProfile || sourceItem?.learner_profile || 'ego_superego_recognition_authentic';
  const personaId = opts.persona || sourceItem?.persona || 'adversarial_tester';
  const topic = opts.topic || inferTopic(design, sourceItem);
  const trace = { metrics: { learnerInputTokens: 0, learnerOutputTokens: 0 } };
  const learnerResponse = await generateLearnerResponse({
    tutorMessage: stripOuterQuote(branch.public_response),
    topic,
    conversationHistory: prefixConversationHistory(prefixTurns),
    learnerProfile,
    personaId,
    modelOverride: learnerModelOverrideForEngine(opts.learnerModel),
    llmCall: liveLearnerLlmCall(opts),
    profileContext: liveLearnerProfileContext({ prefixTurns, sourceItem }),
    trace,
    conversationMode: 'single-prompt',
    dramaFidelity: 'full',
    contextMode: 'full-public',
    recentTurns: 8,
  });
  return {
    text: learnerResponse.externalMessage || learnerResponse.message || '',
    trace: {
      learner_profile: learnerProfile,
      persona: personaId,
      model_override: opts.learnerModel,
      topic,
      token_usage: learnerResponse.tokenUsage || null,
      trace_metrics: trace.metrics || null,
      emotional_state: learnerResponse.emotionalState || null,
      understanding_level: learnerResponse.understandingLevel || null,
      suggests_ending: learnerResponse.suggestsEnding || false,
      internal_deliberation: learnerResponse.internalDeliberation || [],
    },
  };
}

function keyItemFor({ branchKey, branch, design, prefixFile, transcriptPath, mode, learnerGeneration }) {
  const source = design.source || {};
  return {
    drama_id: `${source.source_drama_id || 'D_PLAN25_REPLAY'}_${branchKey}`,
    source_tid: source.source_tid || null,
    source_score: source.source_score || null,
    condition: branchKey,
    intended_tutor_move: branch?.intended_tutor_move || null,
    tutor_response_source: branch?.tutor_response_source || null,
    expected_effect: branch?.expected_effect || null,
    generator: 'plan25-prefix-branch-replay',
    learner_continuation_mode: mode,
    learner_generation: learnerGeneration || { mode },
    provenance: {
      ...(design.provenance || {}),
      ...(branch.provenance || {}),
      learner_family: learnerGeneration?.learner_family || null,
    },
    quality_status: 'ok',
    quality_warnings: [],
    replay: {
      prefix_file: path.relative(ROOT, prefixFile),
      branch_first_live_role: design.freeze?.branch_first_live_role || 'tutor',
      freeze_through: design.freeze?.freeze_through || null,
      transcript: path.relative(ROOT, transcriptPath),
    },
  };
}

function buildManifest({
  designPath,
  design,
  prefixFile,
  outDir,
  mode,
  branchResults,
  scorePaths,
  sourceKeyPath,
  learnerGeneration,
  scoreModels,
}) {
  const firstScorePath = scorePaths ? Object.values(scorePaths)[0] : null;
  return {
    schema: 'plan25_af6_prefix_branch_replay_manifest_v0_1',
    generated_at: new Date().toISOString(),
    command: process.argv.join(' '),
    cwd: ROOT,
    mode,
    design: path.relative(ROOT, designPath),
    source_key: sourceKeyPath ? path.relative(ROOT, sourceKeyPath) : null,
    source: design.source || null,
    learner_generation: learnerGeneration || { mode },
    provenance: {
      ...(design.provenance || {}),
      learner_family: learnerGeneration?.learner_family || null,
      critic_families: Object.fromEntries((scoreModels || []).map((model) => [model, modelFamily(model)])),
    },
    freeze: {
      ...(design.freeze || {}),
      frozen_prefix_file: path.relative(ROOT, prefixFile),
    },
    outputs: {
      out_dir: path.relative(ROOT, outDir),
      sample_dir: path.relative(ROOT, path.join(outDir, 'sample')),
      key: path.relative(ROOT, path.join(outDir, 'key.yaml')),
      score: firstScorePath ? path.relative(ROOT, firstScorePath) : null,
      scores: scorePaths
        ? Object.fromEntries(Object.entries(scorePaths).map(([model, p]) => [model, path.relative(ROOT, p)]))
        : null,
    },
    branches: branchResults,
    claim_boundary:
      mode === 'live'
        ? 'Live learner continuations are a cheap prefix-controlled screen; treat as diagnostic until replicated in a fresh claim-bearing battery.'
        : 'Mock learner continuations validate harness plumbing and control leakage only; they are not independent evidence for the Plan 2.5 AF6 claim.',
  };
}

function prepareOutDir(outDir, force) {
  if (!outDir) throw new Error('Missing --out-dir');
  if (fs.existsSync(outDir)) {
    if (!force) throw new Error(`Output directory exists; pass --force to replace: ${outDir}`);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(outDir, 'sample'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'learner-traces'), { recursive: true });
}

function runScorer({ sampleDir, keyPath, outPath, mock = false, model = 'codex', concurrency = 1 }) {
  const argv = ['scripts/score-poetics-phase2.js', '--sample-dir', sampleDir, '--key', keyPath, '--out', outPath];
  if (mock) argv.splice(1, 0, '--mock');
  else argv.push('--model', model, '--concurrency', String(concurrency || 1));
  const result = spawnSync(process.execPath, argv, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`score-poetics-phase2.js ${mock ? '--mock' : model} failed with status ${result.status}`);
  }
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }
  if (opts.mock === opts.liveLearner) {
    throw new Error('Choose exactly one continuation mode: --mock or --live-learner.');
  }
  const designPath = requireFile(opts.design, '--design');
  const designDir = path.dirname(designPath);
  const design = readYaml(designPath);
  if (!design.branches || typeof design.branches !== 'object') throw new Error('Design has no branches map');

  const prefixFile = requireFile(
    opts.prefixFile || resolveFrom(designDir, design.freeze?.frozen_prefix_file),
    'frozen prefix file',
  );
  const prefixRaw = fs.readFileSync(prefixFile, 'utf8').trim();
  const prefixTurns = parseTurns(prefixRaw);
  if (!prefixTurns.length) throw new Error(`No turns parsed from prefix file: ${prefixFile}`);
  const { keyPath: sourceKeyPath, item: sourceItem } = loadSourceItem(design, opts.sourceKey);
  const mode = opts.mock ? 'mock' : 'live';
  const learnerGeneration = opts.mock
    ? { mode: 'mock', learner_family: 'mock' }
    : {
        mode: 'live',
        learner_model: opts.learnerModel,
        learner_family: modelFamily(opts.learnerModel),
        learner_profile: opts.learnerProfile || sourceItem?.learner_profile || 'ego_superego_recognition_authentic',
        persona: opts.persona || sourceItem?.persona || 'adversarial_tester',
      };

  const branchEntries = Object.entries(design.branches).filter(([key]) => !opts.branches || opts.branches.includes(key));
  if (!branchEntries.length) throw new Error('No selected branches to replay');

  prepareOutDir(opts.outDir, opts.force);

  const sampleDir = path.join(opts.outDir, 'sample');
  const keyPath = path.join(opts.outDir, 'key.yaml');
  const manifestPath = path.join(opts.outDir, 'manifest.json');
  const scoreModels = opts.score ? listOption(opts.scoreModel) : [];
  const scorePaths = opts.scoreMock
    ? { mock: path.join(opts.outDir, 'poetics-phase2-mock.json') }
    : opts.score
      ? Object.fromEntries(scoreModels.map((model) => [model, path.join(opts.outDir, `poetics-phase2-${slug(model)}.json`)]))
      : null;
  const controlBranchKeys = inferControlBranchKeys(design);
  const forbiddenTerms = design.forbidden_in_control_public_speech || [];
  const keyItems = {};
  const branchResults = {};

  for (const [branchKey, branch] of branchEntries) {
    const tutorResponse = branch?.public_response;
    if (!String(tutorResponse || '').trim()) throw new Error(`Branch ${branchKey} has no public_response`);
    const continuation = opts.mock
      ? { text: mockLearnerContinuation(branchKey, branch, design), trace: null }
      : await liveLearnerContinuation({ branch, design, opts, prefixTurns, sourceItem });
    const learnerResponse = continuation.text;
    if (!String(learnerResponse || '').trim()) throw new Error(`Branch ${branchKey} produced an empty learner response`);
    const suffixTurns = [
      { role: 'TUTOR', text: tutorResponse },
      { role: 'LEARNER', text: learnerResponse },
    ];
    const transcript = renderTranscript([...prefixTurns, ...suffixTurns]);
    const transcriptPath = path.join(sampleDir, `${branchKey}.txt`);
    fs.writeFileSync(transcriptPath, transcript, 'utf8');
    const learnerTracePath = path.join(opts.outDir, 'learner-traces', `${branchKey}.json`);
    if (continuation.trace) fs.writeFileSync(learnerTracePath, JSON.stringify(continuation.trace, null, 2), 'utf8');

    const auditScope = forbiddenAuditScope(branch);
    const suffixText = auditTextForScope(auditScope, suffixTurns);
    const forbidden = controlBranchKeys.has(branchKey) ? forbiddenMatches(suffixText, forbiddenTerms) : [];
    if (forbidden.length && !opts.allowForbiddenSuffix) {
      throw new Error(
        `Control suffix leak in ${branchKey}: ${forbidden.join(', ')}. ` +
          'Fix the branch text or pass --allow-forbidden-suffix for diagnostic output.',
      );
    }

    keyItems[branchKey] = keyItemFor({
      branchKey,
      branch,
      design,
      prefixFile,
      transcriptPath,
      mode,
      learnerGeneration,
    });
    branchResults[branchKey] = {
      transcript: path.relative(ROOT, transcriptPath),
      learner_trace: continuation.trace ? path.relative(ROOT, learnerTracePath) : null,
      provenance: {
        ...(design.provenance || {}),
        ...(branch.provenance || {}),
        learner_family: learnerGeneration.learner_family || null,
      },
      turn_counts: {
        prefix: prefixTurns.length,
        suffix: suffixTurns.length,
        total: prefixTurns.length + suffixTurns.length,
      },
      suffix_forbidden_audit: {
        applied: controlBranchKeys.has(branchKey),
        scope: auditScope,
        forbidden_terms: forbiddenTerms,
        violations: forbidden,
      },
    };
  }

  fs.writeFileSync(
    keyPath,
    yaml.stringify({
      schema: 'plan25_af6_prefix_branch_replay_key_v0_1',
      generated_at: new Date().toISOString(),
      mode,
      source_key: sourceKeyPath ? path.relative(ROOT, sourceKeyPath) : null,
      learner_generation: learnerGeneration,
      source: design.source || null,
      freeze: {
        ...(design.freeze || {}),
        frozen_prefix_file: path.relative(ROOT, prefixFile),
      },
      items: keyItems,
    }),
    'utf8',
  );

  if (opts.scoreMock) {
    runScorer({
      sampleDir,
      keyPath,
      outPath: scorePaths.mock,
      mock: true,
      model: 'mock',
      concurrency: opts.scoreConcurrency,
    });
  } else if (opts.score) {
    for (const [model, outPath] of Object.entries(scorePaths)) {
      runScorer({
        sampleDir,
        keyPath,
        outPath,
        mock: false,
        model,
        concurrency: opts.scoreConcurrency,
      });
    }
  }

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      buildManifest({
        designPath,
        design,
        prefixFile,
        outDir: opts.outDir,
        mode,
        branchResults,
        scorePaths,
        sourceKeyPath,
        learnerGeneration,
        scoreModels: opts.scoreMock ? ['mock'] : scoreModels,
      }),
      null,
      2,
    ),
    'utf8',
  );

  const lines = [
    `Plan 2.5 prefix-branch replay wrote ${branchEntries.length} branch(es) in ${mode} mode.`,
    `sample: ${path.relative(ROOT, sampleDir)}`,
    `key: ${path.relative(ROOT, keyPath)}`,
    `manifest: ${path.relative(ROOT, manifestPath)}`,
  ];
  if (scorePaths) {
    for (const [model, scorePath] of Object.entries(scorePaths)) {
      lines.push(`scores[${model}]: ${path.relative(ROOT, scorePath)}`);
    }
  }
  process.stdout.write(`${lines.join(os.EOL)}${os.EOL}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

export { parseArgs, parseTurns, forbiddenMatches, mockLearnerContinuation };
