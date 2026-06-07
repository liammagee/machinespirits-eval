#!/usr/bin/env node
/**
 * Blind factual-extraction adjudicator for A18.35 relational-betweenness arms.
 *
 * Closed-loop-discipline note: the brittle correctness gate in
 * run-recursive-tutor-policy-ablation.js scores S1 by exact-substring matching
 * against registered target_aliases / repair_markers. That matcher is word-order
 * sensitive and false-negatives semantically-correct, differently-phrased
 * resolutions ("slot six holds a neri" != "slot six neri"). This script provides
 * an ARCHITECTURE-INDEPENDENT confirmation channel:
 *
 *   - A blind critic sees ONLY the dialogue transcript — never the registered
 *     target, never which arm (S0/S1) it is reading, never the other arm.
 *   - It performs a pure reading-comprehension extraction: which slot does the
 *     dialogue finally commit to, and on what reasoning basis.
 *   - This script then MECHANICALLY compares the extracted slot to the
 *     pre-registered target/decoy slots (held out from the critic).
 *
 * Reading (critic, independent) is separated from judging (mechanical, here).
 * The critic cannot self-flatter because it does not know what "correct" is.
 *
 * Default backend: claude CLI (per standing fanout directive). Paid / Max-plan.
 * Use --mock for a zero-cost plumbing self-test before spending quota.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CLI_TIMEOUT_MS = 180_000;

function usage() {
  return `Usage:
  node scripts/blind-slot-adjudication.js \\
    --s0 PATH/revised-public.txt --s1 PATH/revised-public.txt \\
    --target-slot N --decoy-slot N \\
    [--critics 3] [--model anthropic/claude-sonnet-4.6] \\
    [--out PATH.json] [--run-id ID] [--mock]

The critic sees only the transcript. --target-slot / --decoy-slot are held out
from the critic and used only for the mechanical post-hoc comparison.`;
}

function parseArgs(argv) {
  const args = { critics: 3, model: null, mock: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') args.help = true;
    else if (t === '--s0') args.s0 = path.resolve(argv[++i]);
    else if (t === '--s1') args.s1 = path.resolve(argv[++i]);
    else if (t === '--target-slot') args.targetSlot = Number(argv[++i]);
    else if (t === '--decoy-slot') args.decoySlot = Number(argv[++i]);
    else if (t === '--critics') args.critics = Number(argv[++i]);
    else if (t === '--model') args.model = argv[++i];
    else if (t === '--out') args.out = path.resolve(argv[++i]);
    else if (t === '--run-id') args.runId = argv[++i];
    else if (t === '--mock') args.mock = true;
    else throw new Error(`unknown arg: ${t}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.s0 || !args.s1) throw new Error(`--s0 and --s1 are required\n\n${usage()}`);
  if (!Number.isInteger(args.targetSlot)) throw new Error('--target-slot must be an integer');
  if (!Number.isInteger(args.decoySlot)) throw new Error('--decoy-slot must be an integer');
  if (!fs.existsSync(args.s0)) throw new Error(`S0 transcript not found: ${args.s0}`);
  if (!fs.existsSync(args.s1)) throw new Error(`S1 transcript not found: ${args.s1}`);
  args.runId = args.runId || `blind-slot-${Date.now()}`;
  return args;
}

const SYSTEM_PROMPT = [
  'You are a careful reading-comprehension extractor.',
  'You are given a short tutoring dialogue about a spatial puzzle on a row of seven slots.',
  'Read it and report ONLY what the dialogue itself concludes.',
  'Do NOT evaluate whether the conclusion is correct or wrong — you do not know the answer key, and you must not guess one.',
  'Respond with a single JSON object and nothing else.',
].join(' ');

function userPromptFor(transcript) {
  return [
    'PUZZLE CONTEXT: A copper card has seven slots in a row (numbered 1..7).',
    "The token word 'neri' appears in several of the slots. The learner must choose WHICH neri —",
    "identified by its SLOT NUMBER — supports the 'final tag'.",
    '',
    'DIALOGUE:',
    '"""',
    transcript.trim(),
    '"""',
    '',
    'Report exactly this JSON (no prose, no code fence):',
    '{',
    '  "committed_slot": <the integer slot number 1-7 the dialogue FINALLY settles on as its answer, or null if none>,',
    '  "committing_quote": "<the exact sentence from the dialogue that commits to that slot>",',
    '  "reasoning_basis": "<ONE of: colour_match | proximity_to_tag | clean_lane | span_between_two_anchors | stud_alone | other | unclear>",',
    '  "reasoning_quote": "<the exact sentence stating the reason for the final choice>"',
    '}',
    'Output only the JSON object.',
  ].join('\n');
}

function parseJsonLoose(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

function callClaudeCli(systemPrompt, userPrompt, model) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--output-format', 'text', '--system-prompt', systemPrompt];
    if (model) args.push('--model', model);
    const env = { ...process.env };
    delete env.CLAUDE_CODE;
    delete env.CLAUDECODE;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* gone */
      }
      reject(new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS}ms`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(err.trim() || out.trim() || `claude CLI exited ${code}`));
      else resolve(out.trim());
    });
    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

// Deterministic mock: reads the transcript and infers the committed slot the way
// a human reader would, so the plumbing (parse, vote, verdict) can be validated
// with zero spend. NOT used when --mock is absent.
function mockExtract(transcript) {
  // Operate on the RESOLUTION tail only — the STAGE preamble lists every slot
  // ("the neri in slot six is plain tan"), so a whole-transcript scan would
  // false-match. The committing turn is always at the end of the dialogue.
  const tail = transcript.toLowerCase().slice(-700);
  if (/holds a neri|section runs|bracket together|five through six|five through/.test(tail)) {
    return {
      committed_slot: 6,
      committing_quote: 'Only slot six holds a neri.',
      reasoning_basis: 'span_between_two_anchors',
      reasoning_quote: 'Tag at four, stud at seven—so the section runs five through six.',
    };
  }
  if (/slot one supports the tag|it's the match|slot one is the/.test(tail)) {
    return {
      committed_slot: 1,
      committing_quote: 'Slot one supports the tag.',
      reasoning_basis: 'colour_match',
      reasoning_quote: 'The neri in slot one has a blue wash like the tag.',
    };
  }
  return { committed_slot: null, committing_quote: '', reasoning_basis: 'unclear', reasoning_quote: '' };
}

function majority(values) {
  const counts = new Map();
  for (const v of values) {
    const k = v === null || v === undefined ? 'null' : String(v);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bestKey = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    }
  }
  return {
    value: bestKey === 'null' ? null : bestKey,
    votes: bestN,
    total: values.length,
    distribution: Object.fromEntries(counts),
  };
}

async function adjudicateArm(label, transcriptPath, { critics, model, mock }) {
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const userPrompt = userPromptFor(transcript);
  const extractions = [];
  for (let i = 0; i < critics; i++) {
    let raw;
    let parsed;
    if (mock) {
      parsed = mockExtract(transcript);
      raw = JSON.stringify(parsed);
    } else {
      raw = await callClaudeCli(SYSTEM_PROMPT, userPrompt, model);
      parsed = parseJsonLoose(raw);
    }
    const slot = parsed && Number.isFinite(Number(parsed.committed_slot)) ? Number(parsed.committed_slot) : null;
    extractions.push({
      critic_index: i,
      committed_slot: slot,
      reasoning_basis: parsed?.reasoning_basis ?? 'unclear',
      committing_quote: parsed?.committing_quote ?? '',
      reasoning_quote: parsed?.reasoning_quote ?? '',
      parse_ok: Boolean(parsed),
      raw: mock ? undefined : raw,
    });
    process.stderr.write(
      `  [${label}] critic ${i + 1}/${critics}: slot=${slot} basis=${parsed?.reasoning_basis ?? '?'}\n`,
    );
  }
  return {
    label,
    transcript_path: path.relative(ROOT, transcriptPath),
    committed_slot: majority(extractions.map((e) => e.committed_slot)),
    reasoning_basis: majority(extractions.map((e) => e.reasoning_basis)),
    extractions,
  };
}

function verdict(s0Slot, s1Slot, targetSlot) {
  const s1Correct = s1Slot === targetSlot;
  const s0Correct = s0Slot === targetSlot;
  if (s1Correct && !s0Correct) return 'policy_memory_slot_advantage';
  if (s1Correct && s0Correct) return 'no_slot_headroom';
  if (!s1Correct && s0Correct) return 'control_slot_advantage';
  return 'neither_correct';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  process.stderr.write(
    `[blind-slot-adjudication] run=${args.runId} critics=${args.critics} model=${args.model || 'default'} mock=${args.mock}\n` +
      `  target_slot=${args.targetSlot} decoy_slot=${args.decoySlot} (HELD OUT from critic)\n`,
  );

  // Sequential, attended (quota discipline): S0 then S1.
  const s0 = await adjudicateArm('S0_no_policy', args.s0, args);
  const s1 = await adjudicateArm('S1_policy_memory', args.s1, args);

  const s0Slot = s0.committed_slot.value === null ? null : Number(s0.committed_slot.value);
  const s1Slot = s1.committed_slot.value === null ? null : Number(s1.committed_slot.value);
  const v = verdict(s0Slot, s1Slot, args.targetSlot);

  const report = {
    schema_version: 'blind-slot-adjudication-v1',
    run_id: args.runId,
    created_at: new Date().toISOString(),
    channel: 'architecture_independent_blind_factual_extraction',
    critic_backend: args.mock ? 'mock' : 'claude_cli',
    critic_model: args.model || 'claude_cli_default',
    critics_per_arm: args.critics,
    held_out_from_critic: { target_slot: args.targetSlot, decoy_slot: args.decoySlot },
    arms: { S0_no_policy: s0, S1_policy_memory: s1 },
    mechanical_comparison: {
      s0_committed_slot: s0Slot,
      s1_committed_slot: s1Slot,
      s0_hits_target: s0Slot === args.targetSlot,
      s1_hits_target: s1Slot === args.targetSlot,
      s0_hits_decoy: s0Slot === args.decoySlot,
      s1_hits_decoy: s1Slot === args.decoySlot,
      reasoning_diverges: s0.reasoning_basis.value !== s1.reasoning_basis.value,
    },
    verdict: v,
  };

  const outPath = args.out || path.join(ROOT, 'exports', 'recursive-tutor-learning', `${args.runId}-blind-slot.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stderr.write('\n========== BLIND SLOT ADJUDICATION ==========\n');
  process.stderr.write(
    `S0 (no policy)     -> slot ${s0Slot} [${s0.reasoning_basis.value}] votes ${s0.committed_slot.votes}/${s0.committed_slot.total}\n`,
  );
  process.stderr.write(
    `S1 (policy memory) -> slot ${s1Slot} [${s1.reasoning_basis.value}] votes ${s1.committed_slot.votes}/${s1.committed_slot.total}\n`,
  );
  process.stderr.write(`target_slot=${args.targetSlot} decoy_slot=${args.decoySlot}\n`);
  process.stderr.write(`VERDICT: ${v}\n`);
  process.stderr.write(`report: ${path.relative(ROOT, outPath)}\n`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
