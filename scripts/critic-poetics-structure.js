#!/usr/bin/env node
/**
 * Fast pre-evaluation structural critic for poetics/drama transcripts.
 *
 * This is a quasi unit test, not a formal eval. It can use the same local CLI
 * model that generated a batch (codex or claude-code) to check whether public
 * transcripts comply with the broad dramatic contract before external critics
 * spend tokens on form scoring.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callModel, parseJsonResponse, runWithConcurrency } from './score-poetics-calibration.js';
import { analyzePeripeteia } from './analyze-poetics-tutor-adaptation.js';
import { createProgressReporter } from './progress.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    critic: 'rules',
    sampleDir: null,
    keyPath: null,
    out: null,
    concurrency: 1,
    batchSize: 4,
    mock: false,
    failOnViolation: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--critic') args.critic = argv[++i];
    else if (token === '--sample-dir') args.sampleDir = path.resolve(argv[++i]);
    else if (token === '--key') args.keyPath = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (token === '--batch-size') args.batchSize = parseInt(argv[++i], 10);
    else if (token === '--mock') args.mock = true;
    else if (token === '--fail-on-violation') args.failOnViolation = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/critic-poetics-structure.js --sample-dir DIR --key KEY.yaml
      [--critic rules|codex|claude|claude-code] [--out FILE]
      [--concurrency N] [--batch-size N] [--fail-on-violation] [--mock]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.sampleDir) throw new Error('--sample-dir is required');
  if (!args.keyPath) throw new Error('--key is required');
  if (!fs.existsSync(args.sampleDir)) throw new Error(`--sample-dir not found: ${args.sampleDir}`);
  if (!fs.existsSync(args.keyPath)) throw new Error(`--key not found: ${args.keyPath}`);
  if (!['rules', 'codex', 'claude', 'claude-code'].includes(args.critic)) {
    throw new Error('--critic must be rules|codex|claude|claude-code');
  }
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1) throw new Error('--concurrency must be positive');
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1) throw new Error('--batch-size must be positive');
  args.critic = args.critic === 'claude' ? 'claude-code' : args.critic;
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function readKey(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8')) || {};
}

function parseTurns(raw) {
  const blocks = String(raw || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const counts = { STAGE: 0, TUTOR: 0, LEARNER: 0 };
  const turns = [];
  for (const block of blocks) {
    const match = block.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (!match) {
      if (turns.length) turns[turns.length - 1].text += `\n\n${block}`;
      else turns.push({ role: 'UNKNOWN', phase: 'unknown', turnNumber: 1, text: block });
      continue;
    }
    const role = match[1];
    counts[role] += 1;
    turns.push({ role, phase: role.toLowerCase(), turnNumber: counts[role], text: match[2].trim() });
  }
  return turns;
}

const THEORY_LEAK =
  /\b(?:Aristotle|Sophocles|Shakespeare|Brecht|Miller|peripeteia|anagnorisis|ego|superego|director|scene card|hidden state|internal review)\b/i;
const ARCHAIC_PASTICHE = /\b(?:thou|thee|thy|hath|doth|wherefore|anon|prithee|methinks)\b/i;
const ACTION_PAREN =
  /\((?:[^)]*\b(?:points?|checks?|draws?|holds?|looks?|marks?|nods?|pauses?|reads?|slides?|taps?|turns?|writes?)\b[^)]*)\)/i;
const STAGE_INTRUSION = /\b(?:the (?:tutor|learner) must|director|scene card|hidden|ego|superego)\b/i;
const INTERNAL_LEAK = /\b(?:PRIVATE_DECISION|FEEDBACK:|KEEP_OR_CHANGE|UPTAKE_CHECK|PERIPETEIA_CHECK|REGISTER_CHECK|<think>)\b/i;
const PERIPETEIA_PRESSURE_FRAME =
  /\b(?:the pressure|the misfit|the old check|the earlier check|the old rule|the prior check|what changed|the loose pressure|I was treating|I was using|I was letting|I was reading|I had been treating)\b/i;
const PERIPETEIA_REPLACEMENT_FRAME =
  /\b(?:now the check|now the test|now the replacement check|the new check|the new test|the new rule|the replacement check|the replacement test|the replacement rule|the check is now|the test is now|instead the check|instead the test)\b/i;

function speechWithoutLeadingAsides(text) {
  let rest = String(text || '').trim();
  while (/^\[[^\]\n]+\]/.test(rest)) {
    rest = rest.replace(/^\[[^\]\n]+\]\s*/, '').trim();
  }
  return rest;
}

function isDirectQuotedSpeech(text) {
  const speech = speechWithoutLeadingAsides(text);
  if (!speech) return true;
  return /^(?:"|'|\u201c|\u2018)/.test(speech) && /(?:"|'|\u201d|\u2019)$/.test(speech);
}

function lineEvidence(turns, predicate) {
  return turns
    .filter(predicate)
    .slice(0, 3)
    .map((turn) => `${turn.role}${turn.turnNumber}: ${turn.text.slice(0, 180)}`);
}

function learnerTurnsAfterPeripeteiaTutor(turns, peripeteia) {
  const tutorPostTurn = peripeteia?.tutor_post_turn;
  const tutorIndex =
    tutorPostTurn == null
      ? -1
      : turns.findIndex((turn) => turn.role === 'TUTOR' && Number(turn.turnNumber) === Number(tutorPostTurn));
  const candidates = tutorIndex >= 0 ? turns.slice(tutorIndex + 1) : turns;
  const learners = candidates.filter((turn) => turn.role === 'LEARNER');
  return learners.length ? learners : turns.filter((turn) => turn.role === 'LEARNER').slice(-1);
}

function hasPeripeteiaReorientation(turns, peripeteia) {
  const text = learnerTurnsAfterPeripeteiaTutor(turns, peripeteia)
    .map((turn) => turn.text)
    .join('\n');
  return PERIPETEIA_PRESSURE_FRAME.test(text) && PERIPETEIA_REPLACEMENT_FRAME.test(text);
}

function deterministicChecks({ id, item, raw }) {
  const turns = parseTurns(raw);
  const tutorTurns = turns.filter((turn) => turn.role === 'TUTOR');
  const learnerTurns = turns.filter((turn) => turn.role === 'LEARNER');
  const stageTurns = turns.filter((turn) => turn.role === 'STAGE');
  const publicTurns = turns.filter((turn) => turn.role === 'TUTOR' || turn.role === 'LEARNER');
  const unknownBlocks = turns.filter((turn) => turn.role === 'UNKNOWN');
  const peripeteia = analyzePeripeteia(turns.filter((turn) => turn.phase !== 'unknown'));
  const requiresPeripeteia = String(item?.tutor_adaptation_policy || '').includes('peripeteia');

  const violations = [];
  const warnings = [];
  if (!tutorTurns.length) violations.push('missing_tutor_turn');
  if (!learnerTurns.length) violations.push('missing_learner_turn');
  if (unknownBlocks.length) violations.push('unlabelled_public_block');
  if (INTERNAL_LEAK.test(raw)) violations.push('internal_deliberation_leak');
  if (lineEvidence(publicTurns, (turn) => THEORY_LEAK.test(turn.text)).length) violations.push('public_theory_or_process_leak');
  if (lineEvidence(publicTurns, (turn) => ARCHAIC_PASTICHE.test(turn.text)).length) violations.push('archaic_pastiche');
  if (lineEvidence(publicTurns, (turn) => ACTION_PAREN.test(turn.text)).length) violations.push('unbracketed_action_aside');
  if (lineEvidence(publicTurns, (turn) => !isDirectQuotedSpeech(turn.text)).length)
    violations.push('public_speech_not_direct_quote');
  if (lineEvidence(stageTurns, (turn) => STAGE_INTRUSION.test(turn.text)).length) violations.push('intrusive_stage_direction');
  if (!item?.dramatic_shape) warnings.push('missing_dramatic_shape_in_key');
  if (!item?.dialogue_approach) warnings.push('missing_dialogue_approach_in_key');
  if (requiresPeripeteia && !peripeteia.learner_reversal_pressure) warnings.push('peripeteia_arm_without_detected_pressure');
  if (requiresPeripeteia && !peripeteia.tutor_adaptive_mechanism) warnings.push('peripeteia_arm_without_detected_tutor_mechanism');
  if (requiresPeripeteia && !hasPeripeteiaReorientation(turns, peripeteia)) {
    violations.push('peripeteia_arm_without_earned_reorientation');
  }

  return {
    pass: violations.length === 0,
    violations,
    warnings,
    counts: {
      tutor: tutorTurns.length,
      learner: learnerTurns.length,
      stage: stageTurns.length,
    },
    peripeteia,
    evidence: {
      theory_or_process_leak: lineEvidence(publicTurns, (turn) => THEORY_LEAK.test(turn.text)),
      archaic_pastiche: lineEvidence(publicTurns, (turn) => ARCHAIC_PASTICHE.test(turn.text)),
      action_parentheses: lineEvidence(publicTurns, (turn) => ACTION_PAREN.test(turn.text)),
      unquoted_public_speech: lineEvidence(publicTurns, (turn) => !isDirectQuotedSpeech(turn.text)),
      intrusive_stage: lineEvidence(stageTurns, (turn) => STAGE_INTRUSION.test(turn.text)),
      missing_peripeteia_reorientation: requiresPeripeteia
        ? learnerTurnsAfterPeripeteiaTutor(turns, peripeteia).map(
            (turn) => `${turn.role}${turn.turnNumber}: ${turn.text.slice(0, 180)}`,
          )
        : [],
    },
  };
}

function loadItems(args) {
  const key = readKey(args.keyPath);
  return Object.entries(key.items || {})
    .map(([id, item]) => {
      const filePath = path.join(args.sampleDir, `${id}.txt`);
      return {
        id,
        item,
        filePath,
        raw: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '',
      };
    })
    .filter((entry) => entry.raw);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function buildCriticPrompt(items) {
  const payload = items.map(({ id, item, raw, rule }) => ({
    id,
    design_context: {
      drama_id: item.drama_id,
      discipline: item.discipline,
      pedagogical_approach: item.pedagogical_approach,
      dialogue_approach: item.dialogue_approach,
      dramatic_shape: item.dramatic_shape,
      tutor_adaptation_policy: item.tutor_adaptation_policy,
    },
    deterministic_rule_findings: {
      pass: rule.pass,
      violations: rule.violations,
      warnings: rule.warnings,
      peripeteia: {
        learner_reversal_pressure: rule.peripeteia.learner_reversal_pressure,
        tutor_adaptive_mechanism: rule.peripeteia.tutor_adaptive_mechanism,
        score: rule.peripeteia.tutor_peripeteia_score,
      },
    },
    transcript: raw,
  }));
  return `You are a fast structural compliance critic for generated teaching dramas.

This is NOT a formal recognition/trap/flat evaluation. Do not score learning outcome.
Check only whether the transcript is formally fit for later external evaluation.

Rules:
- Public TUTOR and LEARNER turns must be direct quoted speech only. Any action aside must be in square brackets.
- Hidden process must not leak: no ego/superego/internal review/director instruction/process talk in public speech.
- Classic dramatic theory is used structurally, not as costume: no fake archaic diction or named theory exposition.
- Modern standard English idiom is expected unless the design context explicitly says otherwise.
- Look for a dramatic pressure/turn: resistance, breakdown, false closure, role turn, object turn, interruption, public consequence, or re-reading.
- For peripeteia arms, look for tutor habit-breaking: the tutor stops repeating a failed move and makes a new adaptive mechanism visible. Register shift counts only if it supports learning pressure.

Return ONLY JSON:
{
  "items": [
    {
      "id": "Txx",
      "public_clean": true|false,
      "modern_idiom": true|false,
      "classical_structure": "clear|partial|absent",
      "tutor_habit_break": "clear|partial|absent|not_applicable",
      "pass": true|false,
      "notes": "one concise sentence"
    }
  ]
}

TRANSCRIPTS:
${JSON.stringify(payload, null, 2)}`;
}

function mockModelResult(items) {
  return {
    items: items.map(({ id, rule }) => ({
      id,
      public_clean: rule.pass,
      modern_idiom: true,
      classical_structure: rule.peripeteia.learner_reversal_pressure ? 'clear' : 'partial',
      tutor_habit_break: rule.peripeteia.tutor_adaptive_mechanism ? 'clear' : 'partial',
      pass: rule.pass,
      notes: 'mock structural critic result',
    })),
  };
}

async function modelCritique(items, args) {
  if (args.critic === 'rules') return new Map();
  if (args.mock) return new Map(mockModelResult(items).items.map((item) => [item.id, item]));
  const batches = chunk(items, args.batchSize);
  const progress = createProgressReporter({
    label: 'structure model critic',
    total: batches.length,
    enabled: true,
  });
  progress.start(`${batches.length} batch(es)`);
  const results = await runWithConcurrency(
    batches.map((batch, index) => async () => {
      progress.note(`batch ${index + 1} starting`);
      const parsed = parseJsonResponse(await callModel(buildCriticPrompt(batch), args.critic));
      progress.step(`batch ${index + 1} complete`);
      return Array.isArray(parsed.items) ? parsed.items : [];
    }),
    args.concurrency,
  );
  progress.finish('model critic complete');
  return new Map(results.flat().map((item) => [item.id, item]));
}

async function run(args) {
  const loaded = loadItems(args).map((entry) => ({
    ...entry,
    rule: deterministicChecks(entry),
  }));
  const modelById = await modelCritique(loaded, args);
  const items = loaded.map((entry) => {
    const model = modelById.get(entry.id) || null;
    const modelPass = model ? Boolean(model.pass) : null;
    return {
      id: entry.id,
      dramaId: entry.item.drama_id,
      sampleFile: rel(entry.filePath),
      dialogueApproach: entry.item.dialogue_approach || null,
      tutorAdaptationPolicy: entry.item.tutor_adaptation_policy || null,
      rule: entry.rule,
      model,
      pass: entry.rule.pass && (modelPass == null || modelPass),
    };
  });
  const summary = {
    total: items.length,
    rulePass: items.filter((item) => item.rule.pass).length,
    modelPass: items.some((item) => item.model) ? items.filter((item) => item.model?.pass).length : null,
    overallPass: items.filter((item) => item.pass).length,
    failed: items.filter((item) => !item.pass).map((item) => item.id),
  };
  const artifact = {
    generated: new Date().toISOString(),
    critic: args.mock ? `${args.critic}-mock` : args.critic,
    sampleDir: rel(args.sampleDir),
    keyPath: rel(args.keyPath),
    summary,
    items,
  };
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  }
  console.log(
    `structural critic ${args.critic}: ${summary.overallPass}/${summary.total} pass` +
      (summary.failed.length ? `; failed ${summary.failed.join(', ')}` : ''),
  );
  if (args.failOnViolation && summary.failed.length) process.exitCode = 1;
  return artifact;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { buildCriticPrompt, deterministicChecks, isDirectQuotedSpeech, parseArgs, parseTurns, run };
