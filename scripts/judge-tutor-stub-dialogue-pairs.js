#!/usr/bin/env node
/**
 * Blind whole-dialogue judging for the contract outcome pre-registration
 * (workplan/items/tutor-contract-outcome-prereg.md).
 *
 * The dialogue-level sibling of judge-tutor-stub-ab-pairs.js. That script
 * asks which of two candidate turns is the better next thing to say; this one
 * asks which of two complete dialogues taught better. The judge sees two full
 * public transcripts of the same world, labelled A and B, and nothing else —
 * no plan, no advisory blocks, no closure verdicts, no deterministic rules.
 * Which dialogue takes the A label is fixed by a hash of the pair id.
 *
 * Pairing: dialogues from two outcome-run directories (results.jsonl written
 * by run-contract-outcome-pilot.js) are matched by world and repeat index, so
 * pair k compares the k-th dialogue each version produced on that world.
 * Both versions speak through the same model, so the judge runs on a
 * different family and cannot be scoring its own prose.
 *
 * Results append to a JSONL as they land; a rerun with the same --out skips
 * pairs already judged. --mock exercises the whole path with no model calls.
 *
 *   node scripts/judge-tutor-stub-dialogue-pairs.js \
 *     --left bare=exports/tutor-stub-outcome/run-a \
 *     --right contract=exports/tutor-stub-outcome/run-b [--mock]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_TIMEOUT_MS = 300_000;
const CLI_ATTEMPTS = 3;

function usage() {
  return `Usage:
  node scripts/judge-tutor-stub-dialogue-pairs.js
      --left NAME=RUN_DIR --right NAME=RUN_DIR
      [--out PATH.jsonl] [--limit N] [--model MODEL] [--worlds a,b] [--mock]

Pairs the k-th dialogue each run produced on the same world and asks a blind
judge which complete dialogue taught better. The win rate is reported for the
--right name. Rerunning with the same --out resumes.`;
}

function parseSide(value, flag) {
  const eq = String(value || '').indexOf('=');
  if (eq < 1) throw new Error(`${flag} needs NAME=RUN_DIR`);
  return { name: value.slice(0, eq), dir: path.resolve(ROOT, value.slice(eq + 1)) };
}

function parseArgs(argv) {
  const args = { left: null, right: null, out: null, limit: Infinity, model: undefined, worlds: null, mock: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else if (a === '--left') args.left = parseSide(argv[++i], '--left');
    else if (a === '--right') args.right = parseSide(argv[++i], '--right');
    else if (a === '--out') args.out = path.resolve(ROOT, argv[++i]);
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--worlds') args.worlds = argv[++i].split(',').map((w) => w.trim());
    else if (a === '--mock') args.mock = true;
    else throw new Error(`unknown flag ${a}`);
  }
  if (!args.left || !args.right) throw new Error(usage());
  if (args.left.name === args.right.name) throw new Error('--left and --right need different names');
  return args;
}

/** Stable small hash, so the A/B layout of a pair never depends on run order. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function loadDialogues(dir, worlds) {
  const resultsPath = path.join(dir, 'results.jsonl');
  if (!fs.existsSync(resultsPath)) throw new Error(`no results.jsonl in ${dir}`);
  const rows = fs
    .readFileSync(resultsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .filter((row) => row.status === 'ok')
    .filter((row) => !worlds || worlds.includes(row.world));
  const byWorld = new Map();
  for (const row of rows.sort((a, b) => a.world.localeCompare(b.world) || a.k - b.k)) {
    if (!byWorld.has(row.world)) byWorld.set(row.world, []);
    byWorld.get(row.world).push(row);
  }
  return byWorld;
}

/**
 * The public transcript alone: the opening and the spoken turns. Closure
 * verdicts, assessments, prompt stamps and trace paths all stay behind —
 * the judge reads what a bystander would have heard.
 */
function publicTranscript(row) {
  const lines = [];
  if (row.openingText) lines.push(`Tutor: ${row.openingText}`);
  for (const turn of row.turns || []) {
    if (turn.learner) lines.push(`Learner: ${turn.learner}`);
    if (turn.tutor) lines.push(`Tutor: ${turn.tutor}`);
  }
  return lines.join('\n\n');
}

function buildPairs({ leftByWorld, rightByWorld, left, right }) {
  const pairs = [];
  const worlds = [...leftByWorld.keys()].filter((world) => rightByWorld.has(world)).sort();
  for (const world of worlds) {
    const leftRows = leftByWorld.get(world);
    const rightRows = rightByWorld.get(world);
    const n = Math.min(leftRows.length, rightRows.length);
    for (let i = 0; i < n; i += 1) {
      const id = `${world}#${i}`;
      const leftFirst = hash(id) % 2 === 0;
      pairs.push({
        id,
        world,
        index: i,
        rows: { [left.name]: leftRows[i], [right.name]: rightRows[i] },
        first: leftFirst ? left.name : right.name,
        second: leftFirst ? right.name : left.name,
      });
    }
  }
  return pairs;
}

const SYSTEM_PROMPT = [
  'You judge complete tutoring dialogues.',
  '',
  'You will read two full transcripts, A and B. In both, a tutor guides a learner through the same inquiry. The dialogues are independent: the learners are different people and their words differ.',
  'Pick the dialogue that taught better.',
  '',
  'Judge by where the learner ends up and how they got there: whether the learner ends able to state the conclusion of the inquiry and support it from evidence they themselves examined; whether the tutor moved them there through their own reasoning rather than handing over conclusions; whether wrong turns were surfaced and corrected; whether the dialogue used its turns well rather than circling.',
  'Length is not a virtue, in turns or in words. A dialogue is not better for being longer, and reaching a sound stopping point sooner is a strength.',
  'You are not checking facts about the case and not scoring writing style.',
  '',
  'Reply with JSON only, no other text:',
  '{"better": "A" | "B" | "same", "reason": "<two sentences at most>"}',
].join('\n');

function buildUserPrompt(pair) {
  return [
    'DIALOGUE A',
    publicTranscript(pair.rows[pair.first]),
    '',
    'DIALOGUE B',
    publicTranscript(pair.rows[pair.second]),
    '',
    'Which dialogue taught better? JSON only.',
  ].join('\n');
}

function parseVerdict(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/u);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const better = String(parsed.better || '')
    .trim()
    .toUpperCase();
  if (!['A', 'B', 'SAME'].includes(better)) return null;
  return { better: better === 'SAME' ? 'same' : better, reason: String(parsed.reason || '').slice(0, 500) };
}

let lastCliStdout = '';
const REFUSAL_PATTERN = /usage policy|unable to respond to this request/iu;

function capturingSpawn(command, spawnArgs, options) {
  const child = spawn(command, spawnArgs, options);
  let seen = '';
  child.stdout?.on('data', (chunk) => {
    seen += chunk;
  });
  child.on('close', () => {
    lastCliStdout = seen;
  });
  return child;
}

async function judge({ pair, model, mock }) {
  if (mock) {
    // Plumbing only: prefers the transcript with fewer turns, then the A
    // label. Never a stand-in for a real verdict.
    const a = (pair.rows[pair.first].turns || []).length;
    const b = (pair.rows[pair.second].turns || []).length;
    return { better: a <= b ? 'A' : 'B', reason: 'mock' };
  }
  let lastErr;
  for (let attempt = 1; attempt <= CLI_ATTEMPTS; attempt += 1) {
    lastCliStdout = '';
    try {
      const result = await callAIWithCliBridge(
        { provider: 'claude-code', model },
        SYSTEM_PROMPT,
        buildUserPrompt(pair),
        'judge-tutor-stub-dialogue-pairs',
        { timeoutMs: CLI_TIMEOUT_MS, spawnImpl: capturingSpawn },
      );
      const verdict = parseVerdict(result.text);
      if (verdict) return verdict;
      lastErr = new Error(`unparseable verdict: ${String(result.text).slice(0, 160)}`);
    } catch (e) {
      lastErr = e;
      if (/session limit|usage limit|rate limit|quota/i.test(String(e?.message || e))) throw e;
      if (REFUSAL_PATTERN.test(lastCliStdout) && attempt >= 2) {
        return { better: 'refused', reason: 'the judge’s usage-policy filter turned this transcript away' };
      }
    }
    process.stderr.write(
      `  [retry] ${pair.id} attempt ${attempt}/${CLI_ATTEMPTS}: ${String(lastErr?.message || lastErr).slice(0, 120)}\n`,
    );
    if (attempt < CLI_ATTEMPTS) await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw lastErr;
}

function summarise(records, left, right) {
  const refused = records.filter((r) => r.winner === 'refused').length;
  const judged = records.filter((r) => r.winner !== 'refused');
  const decided = judged.filter((r) => r.winner !== 'same');
  const rightWins = decided.filter((r) => r.winner === right).length;
  const rate = decided.length ? rightWins / decided.length : 0;
  const se = decided.length ? Math.sqrt((rate * (1 - rate)) / decided.length) : 0;
  return {
    n: judged.length,
    refused,
    decided: decided.length,
    rightWins,
    leftWins: decided.length - rightWins,
    ties: judged.length - decided.length,
    rate,
    se,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { left, right } = args;
  const outPath =
    args.out || path.join(ROOT, `exports/tutor-stub-outcome/dialogue-judging-${left.name}-vs-${right.name}.jsonl`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        done.add(JSON.parse(line).id);
      } catch {
        /* a half-written last line just gets redone */
      }
    }
  }

  const pairs = buildPairs({
    leftByWorld: loadDialogues(left.dir, args.worlds),
    rightByWorld: loadDialogues(right.dir, args.worlds),
    left,
    right,
  });
  const todo = pairs.filter((pair) => !done.has(pair.id)).slice(0, args.limit);
  process.stderr.write(`${pairs.length} dialogue pairs; ${done.size} already judged; running ${todo.length}\n`);

  for (const [i, pair] of todo.entries()) {
    const startedAt = Date.now();
    const verdict = await judge({ pair, model: args.model, mock: args.mock });
    let winner;
    if (verdict.better === 'refused') winner = 'refused';
    else if (verdict.better === 'same') winner = 'same';
    else winner = verdict.better === 'A' ? pair.first : pair.second;
    const record = {
      id: pair.id,
      world: pair.world,
      index: pair.index,
      versions: [left.name, right.name],
      shownFirst: pair.first,
      winner,
      reason: verdict.reason,
      turns: {
        [left.name]: (pair.rows[left.name].turns || []).length,
        [right.name]: (pair.rows[right.name].turns || []).length,
      },
      runs: { [left.name]: path.relative(ROOT, left.dir), [right.name]: path.relative(ROOT, right.dir) },
      latencyMs: Date.now() - startedAt,
      mock: args.mock === true,
    };
    fs.appendFileSync(outPath, `${JSON.stringify(record)}\n`);
    process.stderr.write(`  ${String(i + 1).padStart(3)}/${todo.length} ${pair.id.padEnd(28)} ${winner}\n`);
  }

  const all = fs
    .readFileSync(outPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const s = summarise(all, left.name, right.name);
  process.stdout.write(
    `\n${left.name} vs ${right.name} — whole dialogues, blind\n` +
      `${s.n} pairs judged (${s.ties} called level)\n` +
      `${right.name} preferred on ${s.rightWins} of ${s.decided} decided — ${(s.rate * 100).toFixed(0)}% (se ${(s.se * 100).toFixed(0)}%)\n` +
      `${left.name} preferred on ${s.leftWins}\n` +
      (s.refused ? `${s.refused} pairs turned away by the judge's content filter\n` : '') +
      `written to ${outPath}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
