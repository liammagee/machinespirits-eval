#!/usr/bin/env node
/**
 * Family-agnostic blind factual-extraction adjudicator for the A18.35 fanout.
 *
 * Generalizes scripts/blind-slot-adjudication.js (which is hard-coded to the
 * relational-betweenness card: seven numbered slots, token "neri", a
 * span-between-anchors reasoning enum). Different A18.35 families commit to
 * different option spaces — numbered slots, named lanes (upper/lower,
 * left/middle/right), pointer-chain slots — so this version:
 *
 *   - lets the critic report the committed option as FREE TEXT in the card's
 *     own words (it reads the STAGE line carried in the bounded continuation);
 *   - matches that free text MECHANICALLY against the family's registered
 *     target_aliases / incorrect_target_aliases (taken verbatim from the YAML),
 *     held out from the critic;
 *   - uses a GENERIC reasoning_basis enum that captures the surface-vs-relation
 *     contrast common to every family (surface_colour | proximity | clean_path |
 *     named_relation | other | unclear).
 *
 * Closed-loop discipline (unchanged from the slot version):
 *   - The critic sees ONLY the dialogue. It never sees the registered target,
 *     never which arm (S0/S1) it is reading, never the other arm, never the
 *     answer key. It performs pure reading comprehension.
 *   - This script then compares the extracted option to the held-out target/decoy
 *     alias sets. The SAME matcher decides target-hit and decoy-hit, so it is
 *     symmetric and cannot lean toward "advantage".
 *   - Reading (critic, independent) is separated from judging (mechanical, here).
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
const CLI_TIMEOUT_MS = 240_000;
const CLI_ATTEMPTS = 3;

const REASONING_ENUM = ['surface_colour', 'proximity', 'clean_path', 'named_relation', 'other', 'unclear'];
const SURFACE_BASES = new Set(['surface_colour', 'proximity', 'clean_path']);

function usage() {
  return `Usage:
  node scripts/blind-option-adjudication.js \\
    --s0 PATH/revised-public.txt --s1 PATH/revised-public.txt \\
    --target-aliases "upper neri|upper lane|rust-headed lane" \\
    --decoy-aliases "lower neri|lower lane" \\
    [--option-space "upper lane | lower lane"] \\
    [--token "neri"] [--answer-noun "lane that can support the final tag"] \\
    [--critics 3] [--model anthropic/claude-sonnet-4.6] \\
    [--out PATH.json] [--run-id ID] [--mock]

The critic sees ONLY the transcript. --target-aliases / --decoy-aliases are held
out from the critic and used only for the mechanical post-hoc comparison.
--option-space is a NEUTRAL list of the positions on the card (it does not reveal
which is correct) and is shown to the critic to make extraction matchable.`;
}

function splitAliases(value) {
  return String(value || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = { critics: 3, model: null, mock: false, targetAliases: [], decoyAliases: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') args.help = true;
    else if (t === '--s0') args.s0 = path.resolve(argv[++i]);
    else if (t === '--s1') args.s1 = path.resolve(argv[++i]);
    else if (t === '--target-aliases') args.targetAliases = splitAliases(argv[++i]);
    else if (t === '--decoy-aliases') args.decoyAliases = splitAliases(argv[++i]);
    else if (t === '--option-space') args.optionSpace = argv[++i];
    else if (t === '--token') args.token = argv[++i];
    else if (t === '--answer-noun') args.answerNoun = argv[++i];
    else if (t === '--critics') args.critics = Number(argv[++i]);
    else if (t === '--model') args.model = argv[++i];
    else if (t === '--out') args.out = path.resolve(argv[++i]);
    else if (t === '--run-id') args.runId = argv[++i];
    else if (t === '--mock') args.mock = true;
    else throw new Error(`unknown arg: ${t}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.s0 || !args.s1) throw new Error(`--s0 and --s1 are required\n\n${usage()}`);
  if (!args.targetAliases.length) throw new Error('--target-aliases is required (pipe-separated)');
  if (!args.decoyAliases.length) throw new Error('--decoy-aliases is required (pipe-separated)');
  if (!fs.existsSync(args.s0)) throw new Error(`S0 transcript not found: ${args.s0}`);
  if (!fs.existsSync(args.s1)) throw new Error(`S1 transcript not found: ${args.s1}`);
  args.runId = args.runId || `blind-option-${args.targetAliases[0].replace(/\s+/g, '-')}`;
  return args;
}

const SYSTEM_PROMPT = [
  'You are a careful reading-comprehension extractor.',
  'You are given a short tutoring dialogue about a spatial puzzle on an invented picture-card.',
  'The dialogue opens with a STAGE description of the card, then the learner and tutor talk.',
  'Read it and report ONLY what the dialogue itself FINALLY commits to as its answer.',
  'Do NOT evaluate whether the conclusion is correct or wrong — you do not know the answer key, and you must not guess one.',
  'Report the chosen option in the card’s own words (e.g. the lane name, the slot number, the token position).',
  'Respond with a single JSON object and nothing else.',
].join(' ');

function userPromptFor(transcript, args) {
  const lines = ['DIALOGUE (includes the STAGE description of the card):', '"""', transcript.trim(), '"""', ''];
  if (args.optionSpace) {
    lines.push(
      `The candidate positions on this card are: ${args.optionSpace}. (This list is neutral; it does NOT tell you which one is correct.)`,
      '',
    );
  }
  lines.push(
    'Report exactly this JSON (no prose, no code fence):',
    '{',
    '  "committed_option": "<the position the dialogue FINALLY settles on, in the card’s own words; null if none>",',
    '  "committing_quote": "<the exact sentence from the dialogue that commits to that option>",',
    `  "reasoning_basis": "<ONE of: ${REASONING_ENUM.join(' | ')}>",`,
    '  "reasoning_quote": "<the exact sentence stating the reason for the final choice>"',
    '}',
    '',
    'reasoning_basis guide: surface_colour = chosen because its colour/wash matches a tag/badge;',
    'proximity = chosen because it is nearest the tag/badge; clean_path = chosen because it sits on the',
    'cleanest/clearest lane or track; named_relation = chosen by a named structural relation the tutor',
    'introduced (e.g. a far-corner correspondence, a span between two anchors, a midpoint, a bracket, a',
    'pointer/legend lookup); other = some other stated reason; unclear = no clear reason given.',
    'Output only the JSON object.',
  );
  return lines.join('\n');
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

// Normalize a free-text option/alias to a token set for matching: lowercase,
// strip punctuation, drop generic stopwords, collapse "sixth"->"six" ordinals.
const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'that', 'this', 'one', 'with', 'of', 'on', 'in', 'it', 'its']);
const ORDINAL_NORM = {
  first: '1',
  second: '2',
  third: '3',
  fourth: '4',
  fifth: '5',
  sixth: '6',
  seventh: '7',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
};
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((w) => ORDINAL_NORM[w] || w)
    .filter((w) => w && !STOPWORDS.has(w));
}

// An alias matches the committed option when every significant token of the
// alias appears in the committed option's token set. Driven by the YAML alias
// lists, not a tuned lexicon; identical test for target and decoy.
function aliasMatches(committedOption, alias) {
  const optTokens = new Set(tokenize(committedOption));
  const aliasTokens = tokenize(alias);
  if (!aliasTokens.length || !optTokens.size) return false;
  return aliasTokens.every((tok) => optTokens.has(tok));
}

function matchesAny(committedOption, aliases) {
  return aliases.some((a) => aliasMatches(committedOption, a));
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

// Operational resilience only — NOT a verdict-logic change. The Max-plan CLI
// endpoint shows variable per-call latency (some calls return in <60s, others
// hang to the timeout); a single hung critic must not abort a whole sequential
// batch. Retry on transient failure (timeout / non-zero close), but fail fast on
// a genuine session/usage limit so the caller can reschedule after reset rather
// than hammer a dead quota.
async function callClaudeCliWithRetry(systemPrompt, userPrompt, model, attempts = CLI_ATTEMPTS) {
  let lastErr;
  for (let a = 1; a <= attempts; a += 1) {
    try {
      return await callClaudeCli(systemPrompt, userPrompt, model);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (/session limit|usage limit|rate limit|quota/i.test(msg)) throw e;
      process.stderr.write(`  [retry] attempt ${a}/${attempts} failed: ${msg.slice(0, 140)}\n`);
      if (a < attempts) await new Promise((r) => setTimeout(r, 5000 * a));
    }
  }
  throw lastErr;
}

// Deterministic mock for the zero-cost plumbing self-test (parse -> vote -> match
// -> verdict -> write). NOT a real extractor: it anchors the committed option to
// the position word qualifying the LAST mention of the answer token in the final
// learner turn, so the STAGE description (top of card) and concessive clauses
// ("...even though the lower one looked closer") cannot bleed into the pick. The
// real fanout path always uses the claude CLI; this only exercises the plumbing.
const MOCK_POSITIONS = ['upper', 'lower', 'middle', 'left', 'right', 'top', 'bottom'];
function mockExtract(transcript, token) {
  const lower = String(transcript || '').toLowerCase();
  const lastLearner = lower.lastIndexOf('learner:');
  const resolution = lastLearner >= 0 ? lower.slice(lastLearner) : lower.slice(-600);
  const tok = String(token || '').toLowerCase();
  let opt = null;
  const tokIdx = tok ? resolution.lastIndexOf(tok) : -1;
  if (tokIdx >= 0) {
    // The committed option is the position word immediately qualifying the chosen
    // token (e.g. "the upper neri carries the tag" -> "upper neri").
    const before = resolution.slice(Math.max(0, tokIdx - 48), tokIdx);
    for (const pos of MOCK_POSITIONS) if (before.includes(pos)) opt = `${pos} ${tok}`;
  }
  if (!opt) {
    // No token (or not found): fall back to the last position word in the resolution.
    let bestIdx = -1;
    let bestPos = null;
    for (const pos of MOCK_POSITIONS) {
      const idx = resolution.lastIndexOf(pos);
      if (idx > bestIdx) {
        bestIdx = idx;
        bestPos = pos;
      }
    }
    opt = bestPos ? `${bestPos} lane` : null;
  }
  const RELATION =
    /far corner|opposite[ -]corner|corner (?:tile|square|marker|key)|head band|corner colour|names the lane|matches the [a-z ]*corner|corner[a-z ]*matches|midpoint|bracket|span|between/;
  const SURFACE = /blue|coral|gold|amber|colour like|like the (?:tag|badge)|closest|nearest|cleanest/;
  if (RELATION.test(resolution)) {
    return {
      committed_option: opt,
      committing_quote: `mock: commits to ${opt}`,
      reasoning_basis: 'named_relation',
      reasoning_quote: 'mock: named structural relation',
    };
  }
  if (SURFACE.test(resolution)) {
    return {
      committed_option: opt,
      committing_quote: `mock: commits to ${opt}`,
      reasoning_basis: 'surface_colour',
      reasoning_quote: 'mock: surface cue',
    };
  }
  return { committed_option: opt, committing_quote: '', reasoning_basis: 'unclear', reasoning_quote: '' };
}

function majority(values) {
  const counts = new Map();
  for (const v of values) {
    const k = v === null || v === undefined || v === '' ? 'null' : String(v).toLowerCase().trim();
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

async function adjudicateArm(label, transcriptPath, args) {
  const { critics, model, mock } = args;
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const userPrompt = userPromptFor(transcript, args);
  const extractions = [];
  for (let i = 0; i < critics; i++) {
    let raw;
    let parsed;
    if (mock) {
      parsed = mockExtract(transcript, args.token);
      raw = JSON.stringify(parsed);
    } else {
      raw = await callClaudeCliWithRetry(SYSTEM_PROMPT, userPrompt, model);
      parsed = parseJsonLoose(raw);
    }
    const option = parsed && parsed.committed_option ? String(parsed.committed_option) : null;
    const basis = parsed && REASONING_ENUM.includes(parsed.reasoning_basis) ? parsed.reasoning_basis : 'unclear';
    extractions.push({
      critic_index: i,
      committed_option: option,
      reasoning_basis: basis,
      committing_quote: parsed?.committing_quote ?? '',
      reasoning_quote: parsed?.reasoning_quote ?? '',
      hits_target: option ? matchesAny(option, args.targetAliases) : false,
      hits_decoy: option ? matchesAny(option, args.decoyAliases) : false,
      parse_ok: Boolean(parsed),
      raw: mock ? undefined : raw,
    });
    process.stderr.write(`  [${label}] critic ${i + 1}/${critics}: option=${option} basis=${basis}\n`);
  }
  // Majority on the matched CLASS (target/decoy/other), which is what the verdict
  // needs — robust to phrasing differences across critics that still classify the same.
  const classOf = (e) => (e.hits_target ? 'target' : e.hits_decoy ? 'decoy' : 'other');
  return {
    label,
    transcript_path: path.relative(ROOT, transcriptPath),
    committed_option: majority(extractions.map((e) => e.committed_option)),
    matched_class: majority(extractions.map(classOf)),
    reasoning_basis: majority(extractions.map((e) => e.reasoning_basis)),
    extractions,
  };
}

function verdict(s0Class, s1Class) {
  const s1Target = s1Class === 'target';
  const s0Target = s0Class === 'target';
  if (s1Target && !s0Target) return 'policy_memory_option_advantage';
  if (s1Target && s0Target) return 'no_option_headroom';
  if (!s1Target && s0Target) return 'control_option_advantage';
  return 'neither_correct';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  process.stderr.write(
    `[blind-option-adjudication] run=${args.runId} critics=${args.critics} model=${args.model || 'default'} mock=${args.mock}\n` +
      `  target_aliases=${JSON.stringify(args.targetAliases)} decoy_aliases=${JSON.stringify(args.decoyAliases)} (HELD OUT from critic)\n`,
  );

  // Sequential, attended (quota discipline): S0 then S1.
  const s0 = await adjudicateArm('S0_no_policy', args.s0, args);
  const s1 = await adjudicateArm('S1_policy_memory', args.s1, args);

  const s0Class = s0.matched_class.value || 'other';
  const s1Class = s1.matched_class.value || 'other';
  const v = verdict(s0Class, s1Class);

  const report = {
    schema_version: 'blind-option-adjudication-v1',
    run_id: args.runId,
    created_at: new Date().toISOString(),
    channel: 'architecture_independent_blind_factual_extraction',
    critic_backend: args.mock ? 'mock' : 'claude_cli',
    critic_model: args.model || 'claude_cli_default',
    critics_per_arm: args.critics,
    held_out_from_critic: { target_aliases: args.targetAliases, decoy_aliases: args.decoyAliases },
    arms: { S0_no_policy: s0, S1_policy_memory: s1 },
    mechanical_comparison: {
      s0_committed_option: s0.committed_option.value,
      s1_committed_option: s1.committed_option.value,
      s0_matched_class: s0Class,
      s1_matched_class: s1Class,
      s0_basis: s0.reasoning_basis.value,
      s1_basis: s1.reasoning_basis.value,
      reasoning_diverges: s0.reasoning_basis.value !== s1.reasoning_basis.value,
      s1_uses_named_relation: s1.reasoning_basis.value === 'named_relation',
      s0_uses_surface_cue: SURFACE_BASES.has(s0.reasoning_basis.value),
    },
    verdict: v,
  };

  const outPath = args.out || path.join(ROOT, 'exports', 'recursive-tutor-learning', `${args.runId}-blind-option.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stderr.write('\n========== BLIND OPTION ADJUDICATION ==========\n');
  process.stderr.write(
    `S0 (no policy)     -> "${s0.committed_option.value}" class=${s0Class} [${s0.reasoning_basis.value}] votes ${s0.matched_class.votes}/${s0.matched_class.total}\n`,
  );
  process.stderr.write(
    `S1 (policy memory) -> "${s1.committed_option.value}" class=${s1Class} [${s1.reasoning_basis.value}] votes ${s1.matched_class.votes}/${s1.matched_class.total}\n`,
  );
  process.stderr.write(`VERDICT: ${v}\n`);
  process.stderr.write(`report: ${path.relative(ROOT, outPath)}\n`);
}

export { aliasMatches, matchesAny, tokenize, verdict, mockExtract, parseArgs };

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exitCode = 1;
  });
}
