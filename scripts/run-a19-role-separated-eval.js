#!/usr/bin/env node
/**
 * A19 role-separated S0/S1 evaluation harness.
 *
 * This addresses the counterfactual-transcript-reviser confound in
 * replay-discursive-transcript.js by keeping role generation separate:
 *   - S0 tutor emits only one next TUTOR move with no policy memory.
 *   - S1 tutor emits only one next TUTOR move with exactly one admitted axiom.
 *   - Learner emits only one LEARNER response from public transcript + tutor move.
 *   - Optional tutor stock-take emits one final TUTOR move after learner response.
 *   - Existing blind free-text adjudication runs over the assembled public arms.
 *
 * This is still local simulated teacher/learner evidence. It is not human
 * learning, deployment, model-weight learning, or a main-harness effect.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  callBackend,
  extractPublicTranscript,
  formatPolicyMemoryForPrompt,
  normalizeBackend,
  parseJsonResponse,
} from './replay-discursive-transcript.js';
import { cardSpecsFromConfig, dashId, summarizeCardResults } from './run-a19-stability-screen.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const DEFAULT_TIMEOUT_MS = 600_000;

function usage() {
  return `Usage:
  node scripts/run-a19-role-separated-eval.js \\
    --family-id claim_evidence_role_mismatch_staged \\
    --sibling-id claim_evidence_role_mismatch_staged_a --sibling-id claim_evidence_role_mismatch_staged_b \\
    --materialized-root exports/a19/materialized-attempts-v20-claim-evidence-role-mismatch-staged \\
    --axiom exports/a19/axioms/claim-evidence-role-mismatch-staged/axiom.json \\
    [--k 1] [--tutor-generator codex] [--learner-generator claude] \\
    [--stocktake-generator codex|none] [--blind-mode free-text|mock] [--critics 1] [--force]

Defaults are cost-safe: all generators and blind adjudication use mock.`;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function sha256Short(text) {
  return createHash('sha256')
    .update(String(text || ''))
    .digest('hex')
    .slice(0, 12);
}

function readText(filePath) {
  if (!filePath) return '';
  if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function loadYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function defaultArgs() {
  return {
    config: DEFAULT_CONFIG,
    familyId: null,
    siblingIds: [],
    materializedRoot: path.join(ROOT, 'exports', 'a19', 'materialized-attempts-v5'),
    axiom: null,
    outDir: null,
    k: 1,
    tutorGenerator: 'mock',
    learnerGenerator: 'mock',
    stocktakeGenerator: 'mock',
    blindMode: 'mock',
    blindModel: null,
    critics: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    codexEffort: process.env.CODEX_REASONING_EFFORT || 'xhigh',
    codexModel: process.env.CODEX_MODEL || null,
    claudeModel: process.env.CLAUDE_CODE_MODEL || null,
    claudeEffort: process.env.CLAUDE_CODE_EFFORT || null,
    agyBin: process.env.AGY_BIN || path.join(os.homedir(), '.local/bin/agy'),
    agyModelLabel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    force: false,
    dryRun: false,
    help: false,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = defaultArgs();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--mock') {
      args.tutorGenerator = 'mock';
      args.learnerGenerator = 'mock';
      args.stocktakeGenerator = 'mock';
      args.blindMode = 'mock';
    } else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--family-id') args.familyId = argv[++i];
    else if (token === '--sibling-id') args.siblingIds.push(...splitList(argv[++i]));
    else if (token === '--materialized-root') args.materializedRoot = path.resolve(argv[++i]);
    else if (token === '--axiom') args.axiom = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--k') args.k = Number(argv[++i]);
    else if (token === '--tutor-generator') args.tutorGenerator = normalizeBackend(argv[++i]);
    else if (token === '--learner-generator') args.learnerGenerator = normalizeBackend(argv[++i]);
    else if (token === '--stocktake-generator') {
      const value = argv[++i];
      args.stocktakeGenerator = value === 'none' ? 'none' : normalizeBackend(value);
    } else if (token === '--no-stocktake') args.stocktakeGenerator = 'none';
    else if (token === '--blind-mode') args.blindMode = argv[++i];
    else if (token === '--blind-model') args.blindModel = argv[++i];
    else if (token === '--critics') args.critics = Number(argv[++i]);
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--codex-effort') args.codexEffort = argv[++i];
    else if (token === '--codex-model') args.codexModel = argv[++i];
    else if (token === '--claude-model') args.claudeModel = argv[++i];
    else if (token === '--claude-effort') args.claudeEffort = argv[++i];
    else if (token === '--agy-bin') args.agyBin = path.resolve(argv[++i]);
    else if (token === '--agy-model-label') args.agyModelLabel = argv[++i];
    else if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return finalizeArgs(args);
}

function finalizeArgs(args) {
  if (args.help) return args;
  args.tutorGenerator = normalizeBackend(args.tutorGenerator);
  args.learnerGenerator = normalizeBackend(args.learnerGenerator);
  if (args.stocktakeGenerator !== 'none') args.stocktakeGenerator = normalizeBackend(args.stocktakeGenerator);
  if (!args.familyId) throw new Error(`--family-id is required\n\n${usage()}`);
  if (!args.siblingIds.length) throw new Error(`at least one --sibling-id is required\n\n${usage()}`);
  if (!Number.isInteger(args.k) || args.k < 1) throw new Error('--k must be a positive integer');
  if (!Number.isInteger(args.critics) || args.critics < 1) throw new Error('--critics must be a positive integer');
  if (!['free-text', 'mock'].includes(args.blindMode)) throw new Error('--blind-mode must be free-text|mock');
  if (['none', 'adversarial'].includes(args.tutorGenerator)) {
    throw new Error('--tutor-generator must be mock|codex|claude|agy|gemini');
  }
  if (['none', 'adversarial'].includes(args.learnerGenerator)) {
    throw new Error('--learner-generator must be mock|codex|claude|agy|gemini');
  }
  if (args.stocktakeGenerator !== 'none' && args.stocktakeGenerator === 'adversarial') {
    throw new Error('--stocktake-generator must be none|mock|codex|claude|agy|gemini');
  }
  args.outDir = args.outDir || path.join(ROOT, 'exports', 'a19', 'role-separated', dashId(args.familyId));
  args.axiom = args.axiom || path.join(ROOT, 'exports', 'a19', 'axioms', dashId(args.familyId), 'axiom.json');
  return args;
}

export function stripA19Metadata(publicTranscript) {
  const roleLines = [];
  for (const rawLine of String(publicTranscript || '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(STAGE|TUTOR|LEARNER):\s*(.*)$/iu);
    if (match) roleLines.push(`${match[1].toUpperCase()}: ${match[2].trim()}`);
  }
  return roleLines.length ? roleLines.join('\n') : String(publicTranscript || '').trim();
}

function rolePrefix(role) {
  if (role === 'tutor' || role === 'stocktake') return 'TUTOR';
  if (role === 'learner') return 'LEARNER';
  throw new Error(`unknown role: ${role}`);
}

export function normalizeRoleMove(value, role) {
  const prefix = rolePrefix(role);
  const text = String(value || '').trim();
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstRoleLine = lines.find((line) => new RegExp(`^${prefix}:`, 'iu').test(line));
  const raw = firstRoleLine || lines[0] || '';
  const withoutOtherRole = raw
    .replace(/^(TUTOR|LEARNER|STAGE):\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!withoutOtherRole) throw new Error(`${prefix} move is empty`);
  return `${prefix}: ${withoutOtherRole}`;
}

export function buildTutorMovePrompt({ publicTranscript, policyMemoryText = '', phase = 'next_move' }) {
  const systemPrompt = `You are the TUTOR in a role-separated A19 evaluation.

Emit exactly one next public TUTOR move as JSON. Do not write LEARNER lines. Do not write a full transcript. Do not reveal policy IDs, arm labels, hidden metadata, or provenance. Use only ordinary public domain language.

${policyMemoryText ? `Tutor-only policy memory:\n${policyMemoryText}` : 'No reusable policy memory is provided.'}`;

  const userPrompt = `Public transcript so far:
${publicTranscript}

Task:
Return JSON only:
{
  "tutor_move": "TUTOR: one next public tutor move",
  "private_rationale": "one sentence about why this tutor move follows from the public transcript"
}

Phase: ${phase}.`;
  return { systemPrompt, userPrompt };
}

export function buildLearnerMovePrompt({ publicTranscript, tutorMove }) {
  const systemPrompt = `You are the LEARNER in a role-separated A19 evaluation.

You see only the public transcript and the latest tutor move. You do not know target aliases, decoy aliases, arm labels, tutor-side private notes, or hidden metadata.

Emit exactly one public LEARNER response as JSON. Do not write TUTOR lines. Do not optimize for the research target; respond as the learner would to the public tutor move.`;

  const userPrompt = `Public transcript before the latest tutor move:
${publicTranscript}

Latest tutor move:
${tutorMove}

Return JSON only:
{
  "learner_move": "LEARNER: one public learner response",
  "uptake_or_contest": "uptake|contest|confusion|neutral",
  "public_basis": "short public reason for the learner response"
}`;
  return { systemPrompt, userPrompt };
}

export function buildTutorStocktakePrompt({ publicTranscript, policyMemoryText = '' }) {
  const systemPrompt = `You are the TUTOR in a role-separated A19 evaluation.

Emit exactly one final public TUTOR stock-take as JSON. Do not write LEARNER lines. Do not rewrite earlier turns. Do not reveal policy IDs, arm labels, hidden metadata, or provenance.

${policyMemoryText ? `Tutor-only policy memory:\n${policyMemoryText}` : 'No reusable policy memory is provided.'}`;

  const userPrompt = `Public transcript including the learner response:
${publicTranscript}

Return JSON only:
{
  "tutor_move": "TUTOR: one short stock-take or next commitment",
  "private_rationale": "one sentence about what the learner response changes or confirms"
}`;
  return { systemPrompt, userPrompt };
}

function mockTutorPayload({ policyMemoryText = '', phase = 'next_move' }) {
  const withMemory = Boolean(policyMemoryText);
  const noun = phase === 'stocktake' ? 'carry that forward' : 'change my next move';
  return {
    tutor_move: withMemory
      ? `TUTOR: I need to ${noun}: I am retracting the old shortcut and asking which public evidence role actually supports the claim before we continue.`
      : 'TUTOR: I will keep using the first vivid evidence as our main guide and make the draft smoother.',
    private_rationale: withMemory
      ? 'The policy memory applies to a public warrant mismatch.'
      : 'No policy memory was available, so the tutor follows the visible old route.',
  };
}

function mockLearnerPayload() {
  return {
    learner_move:
      'LEARNER: I can respond to that public move, but I am only using what you just said and what is already in the transcript.',
    uptake_or_contest: 'neutral',
    public_basis: 'The learner sees only the public tutor move.',
  };
}

async function callJsonRole({ backend, prompts, args, role, mockPayload }) {
  if (backend === 'mock') {
    return {
      parsed: mockPayload,
      raw: JSON.stringify(mockPayload, null, 2),
      provenance: {
        backend: 'mock',
        role,
        latencyMs: 0,
        promptHashes: {
          system: sha256Short(prompts.systemPrompt),
          user: sha256Short(prompts.userPrompt),
        },
      },
    };
  }
  const call = await callBackend(
    backend,
    prompts,
    {
      timeoutMs: args.timeoutMs,
      codexEffort: args.codexEffort,
      codexModel: args.codexModel,
      claudeModel: args.claudeModel,
      claudeEffort: args.claudeEffort,
      agyBin: args.agyBin,
      agyModelLabel: args.agyModelLabel,
    },
    role,
  );
  return {
    parsed: parseJsonResponse(call.content),
    raw: call.content,
    provenance: call.provenance,
  };
}

function policyMemoryForArm(card, arm) {
  if (arm !== 's1') return '';
  return formatPolicyMemoryForPrompt(readText(card.axiom), repoRel(card.axiom));
}

function assembledPath(seedDir, arm) {
  return path.join(seedDir, `${arm}-role`, 'assembled-public.txt');
}

async function runArm(card, seedDir, args, arm) {
  const armDir = path.join(seedDir, `${arm}-role`);
  const assembled = assembledPath(seedDir, arm);
  if (fs.existsSync(assembled) && !args.force) {
    return {
      arm,
      cached: true,
      assembledPublic: readText(assembled),
      path: assembled,
    };
  }

  fs.mkdirSync(armDir, { recursive: true });
  const rawPublic = extractPublicTranscript(readText(card.transcript));
  const publicPrefix = stripA19Metadata(rawPublic);
  const policyMemoryText = policyMemoryForArm(card, arm);
  fs.writeFileSync(path.join(armDir, 'public-prefix.txt'), `${publicPrefix}\n`);
  if (policyMemoryText) fs.writeFileSync(path.join(armDir, 'tutor-policy-memory.prompt.txt'), `${policyMemoryText}\n`);

  const tutorPrompt = buildTutorMovePrompt({ publicTranscript: publicPrefix, policyMemoryText });
  fs.writeFileSync(
    path.join(armDir, 'tutor.prompt.txt'),
    `${tutorPrompt.systemPrompt}\n\n---\n\n${tutorPrompt.userPrompt}`,
  );
  const tutor = await callJsonRole({
    backend: args.tutorGenerator,
    prompts: tutorPrompt,
    args,
    role: `${arm}_tutor`,
    mockPayload: mockTutorPayload({ policyMemoryText }),
  });
  fs.writeFileSync(path.join(armDir, 'tutor.raw.txt'), tutor.raw);
  fs.writeFileSync(path.join(armDir, 'tutor.json'), JSON.stringify(tutor, null, 2));
  const tutorMove = normalizeRoleMove(tutor.parsed.tutor_move, 'tutor');

  const learnerPrompt = buildLearnerMovePrompt({ publicTranscript: publicPrefix, tutorMove });
  fs.writeFileSync(
    path.join(armDir, 'learner.prompt.txt'),
    `${learnerPrompt.systemPrompt}\n\n---\n\n${learnerPrompt.userPrompt}`,
  );
  const learner = await callJsonRole({
    backend: args.learnerGenerator,
    prompts: learnerPrompt,
    args,
    role: `${arm}_learner`,
    mockPayload: mockLearnerPayload(),
  });
  fs.writeFileSync(path.join(armDir, 'learner.raw.txt'), learner.raw);
  fs.writeFileSync(path.join(armDir, 'learner.json'), JSON.stringify(learner, null, 2));
  const learnerMove = normalizeRoleMove(learner.parsed.learner_move, 'learner');

  let assembledPublic = [publicPrefix, tutorMove, learnerMove].join('\n');
  let stocktake = null;
  if (args.stocktakeGenerator !== 'none') {
    const stocktakePrompt = buildTutorStocktakePrompt({ publicTranscript: assembledPublic, policyMemoryText });
    fs.writeFileSync(
      path.join(armDir, 'stocktake.prompt.txt'),
      `${stocktakePrompt.systemPrompt}\n\n---\n\n${stocktakePrompt.userPrompt}`,
    );
    stocktake = await callJsonRole({
      backend: args.stocktakeGenerator,
      prompts: stocktakePrompt,
      args,
      role: `${arm}_stocktake`,
      mockPayload: mockTutorPayload({ policyMemoryText, phase: 'stocktake' }),
    });
    fs.writeFileSync(path.join(armDir, 'stocktake.raw.txt'), stocktake.raw);
    fs.writeFileSync(path.join(armDir, 'stocktake.json'), JSON.stringify(stocktake, null, 2));
    assembledPublic = `${assembledPublic}\n${normalizeRoleMove(stocktake.parsed.tutor_move, 'stocktake')}`;
  }

  fs.writeFileSync(assembled, `${assembledPublic}\n`);
  const manifest = {
    schema_version: 'a19-role-separated-arm-v0.1',
    arm,
    policy_memory: {
      provided_to_tutor: Boolean(policyMemoryText),
      provided_to_learner: false,
      sha256: policyMemoryText ? sha256Short(policyMemoryText) : null,
    },
    role_order: args.stocktakeGenerator === 'none' ? ['tutor', 'learner'] : ['tutor', 'learner', 'stocktake'],
    tutor: tutor.provenance,
    learner: learner.provenance,
    stocktake: stocktake?.provenance || null,
    assembled_public: repoRel(assembled),
  };
  fs.writeFileSync(path.join(armDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return {
    arm,
    cached: false,
    assembledPublic,
    path: assembled,
    manifest,
  };
}

function blindArgs(card, seedDir, args, seed) {
  const argv = [
    'scripts/blind-teaching-drama-axiom-adjudication.js',
    args.blindMode === 'mock' ? '--mock' : '--free-text',
    '--s0',
    assembledPath(seedDir, 's0'),
    '--s1',
    assembledPath(seedDir, 's1'),
    '--target-aliases',
    card.target_aliases.join('|'),
    '--decoy-aliases',
    card.decoy_aliases.join('|'),
    '--target-repair-type',
    card.target_repair_type,
    '--decoy-repair-types',
    card.decoy_repair_types,
    '--option-space',
    card.option_space,
    '--family-id',
    card.family_id,
    '--sibling-id',
    card.sibling_id,
    '--critics',
    String(args.critics),
    '--run-id',
    `a19-role-separated-${dashId(card.sibling_id)}-seed${seed}`,
    '--out',
    path.join(seedDir, 'blind-adjudication.free-text.json'),
  ];
  if (args.blindModel) argv.push('--model', args.blindModel);
  return argv;
}

function runBlind(card, seedDir, args, seed) {
  const out = path.join(seedDir, 'blind-adjudication.free-text.json');
  if (fs.existsSync(out) && !args.force) return { ok: true, cached: true, path: out };
  const commandText = `node ${blindArgs(card, seedDir, args, seed)
    .map((arg) => JSON.stringify(arg))
    .join(' ')}`;
  if (args.dryRun) return { ok: true, dryRun: true, commandText, path: out };
  try {
    execFileSync('node', blindArgs(card, seedDir, args, seed), {
      cwd: ROOT,
      timeout: args.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return { ok: true, cached: false, commandText, path: out };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      stdout: err.stdout ? String(err.stdout) : '',
      commandText,
      path: out,
    };
  }
}

function readBlindResult(outPath) {
  const json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  return {
    run_id: json.run_id,
    card_verdict: json.card_verdict,
    s0_class: json.arms?.s0?.committed_option_class || null,
    s0_repair_type: json.arms?.s0?.repair_type || null,
    s0_basis_label: json.arms?.s0?.basis_label || null,
    s1_class: json.arms?.s1?.committed_option_class || null,
    s1_repair_type: json.arms?.s1?.repair_type || null,
    s1_basis_label: json.arms?.s1?.basis_label || null,
    critics_per_arm: json.critics_per_arm,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '# A19 Role-Separated Evaluation',
    '',
    `Run ID: \`${summary.run_id}\`.`,
    `Created: ${summary.created_at}.`,
    '',
    '## Boundary',
    '',
    'Role-separated local simulated teacher/learner evaluation only. S1 policy memory is visible only to the tutor and optional tutor stock-take; the learner generator receives only public transcript plus tutor move. No human-learning, deployed-tutor, model-weight-learning, main-harness, Paper 2.0, atlas, or sidecar claim is licensed.',
    '',
    '## Cards',
    '',
  ];
  for (const card of summary.cards) {
    lines.push(
      `### \`${card.sibling_id}\``,
      '',
      `- Completed seeds: ${card.k_completed}.`,
      `- Policy-headroom seeds: ${card.policy_headroom_count}/${card.k_completed}.`,
      `- S0 target seeds: ${card.s0_target_count}/${card.k_completed}.`,
      `- S1 target seeds: ${card.s1_target_count}/${card.k_completed}.`,
      `- Interpretation: \`${card.interpretation}\`.`,
      '',
    );
    for (const seed of card.seeds) {
      lines.push(
        `- Seed ${seed.seed}: \`${seed.card_verdict || seed.status}\`; S0=\`${seed.s0_class || 'n/a'}\`/${seed.s0_repair_type || 'n/a'}; S1=\`${seed.s1_class || 'n/a'}\`/${seed.s1_repair_type || 'n/a'}; artifact \`${seed.out_dir}\`.`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function runCardSeed(card, args, seed) {
  const seedDir = path.join(args.outDir, dashId(card.sibling_id), `seed${seed}`);
  fs.mkdirSync(seedDir, { recursive: true });
  process.stdout.write(`\n[a19-role-separated] ${card.sibling_id} seed ${seed}/${args.k}: S0 tutor/learner\n`);
  const s0 = await runArm(card, seedDir, args, 's0');
  process.stdout.write(`[a19-role-separated] ${card.sibling_id} seed ${seed}/${args.k}: S1 tutor/learner\n`);
  const s1 = await runArm(card, seedDir, args, 's1');
  process.stdout.write(`[a19-role-separated] ${card.sibling_id} seed ${seed}/${args.k}: blind adjudication\n`);
  const blind = runBlind(card, seedDir, args, seed);
  if (!blind.ok || (!args.dryRun && !fs.existsSync(blind.path))) {
    return {
      seed,
      status: 'blind_failed',
      error: blind.error || 'missing blind output',
      out_dir: repoRel(seedDir),
    };
  }
  if (args.dryRun) return { seed, status: 'dry_run', out_dir: repoRel(seedDir) };
  return {
    seed,
    status: 'complete',
    ...readBlindResult(blind.path),
    role_paths: {
      s0: repoRel(s0.path),
      s1: repoRel(s1.path),
    },
    out_dir: repoRel(seedDir),
  };
}

export async function runRoleSeparatedEvaluation(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : finalizeArgs({ ...defaultArgs(), ...rawArgs });
  if (args.help) return { help: usage() };
  const config = loadYaml(args.config);
  const cards = cardSpecsFromConfig(config, {
    familyId: args.familyId,
    siblingIds: args.siblingIds,
    materializedRoot: args.materializedRoot,
    axiom: args.axiom,
  });
  fs.mkdirSync(args.outDir, { recursive: true });

  const cardSummaries = [];
  for (const card of cards) {
    if (!fs.existsSync(card.transcript)) throw new Error(`materialized transcript not found: ${card.transcript}`);
    if (!fs.existsSync(card.axiom)) throw new Error(`axiom memory not found: ${card.axiom}`);
    const seeds = [];
    for (let seed = 1; seed <= args.k; seed += 1) {
      try {
        seeds.push(await runCardSeed(card, args, seed));
      } catch (err) {
        seeds.push({
          seed,
          status: 'role_generation_failed',
          error: err.message,
          out_dir: repoRel(path.join(args.outDir, dashId(card.sibling_id), `seed${seed}`)),
        });
        break;
      }
    }
    cardSummaries.push(summarizeCardResults(card, seeds));
  }

  const summary = {
    schema_version: 'a19-role-separated-eval-v0.1',
    run_id: `a19-role-separated-${dashId(args.familyId)}-${new Date().toISOString().slice(0, 10)}`,
    created_at: new Date().toISOString(),
    family_id: args.familyId,
    k_requested: args.k,
    tutor_generator: args.tutorGenerator,
    learner_generator: args.learnerGenerator,
    stocktake_generator: args.stocktakeGenerator,
    blind_mode: args.blindMode,
    critics_per_arm: args.critics,
    materialized_root: repoRel(args.materializedRoot),
    axiom: repoRel(args.axiom),
    role_separation: {
      tutor_sees_policy_memory_in_s1: true,
      learner_sees_policy_memory: false,
      learner_sees_arm_label: false,
      transcript_rewriter_used: false,
      final_stocktake_enabled: args.stocktakeGenerator !== 'none',
    },
    claim_boundary: 'role_separated_simulated_teacher_learner_not_human_learning',
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paper_2_0_empirical_claim',
      'atlas_empirical_claim',
      'sidecar_empirical_claim',
    ],
    cards: cardSummaries,
  };

  const jsonOut = path.join(args.outDir, 'a19-role-separated-summary.json');
  const mdOut = path.join(args.outDir, 'a19-role-separated-summary.md');
  if (!args.dryRun) {
    fs.writeFileSync(jsonOut, `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(mdOut, renderMarkdown(summary));
  }
  return { summary, jsonOut, mdOut };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const { summary, jsonOut, mdOut } = await runRoleSeparatedEvaluation(args);
  process.stdout.write('\n========== A19 ROLE-SEPARATED ==========\n');
  for (const card of summary.cards) {
    process.stdout.write(
      `${card.sibling_id}: ${card.policy_headroom_count}/${card.k_completed} headroom, S0 target ${card.s0_target_count}/${card.k_completed}, S1 target ${card.s1_target_count}/${card.k_completed}, interpretation=${card.interpretation}\n`,
    );
  }
  if (!args.dryRun) {
    process.stdout.write(`summary: ${repoRel(jsonOut)}\n`);
    process.stdout.write(`markdown: ${repoRel(mdOut)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  });
}
