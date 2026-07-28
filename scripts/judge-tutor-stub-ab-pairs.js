#!/usr/bin/env node
/**
 * Blind pairwise judging for the tutor instrumentation A/B bench.
 *
 * Why this exists: the bench's own headline number is the count of broken rules
 * a turn, and most of those rules ask whether the tutor did what its host plan
 * told it to do. The version carrying the plan therefore wins them close to by
 * construction. This script scores the same recorded replies through a channel
 * that shares nothing with the plan.
 *
 * The judge sees the frozen public transcript, the learner's turn, and two
 * candidate next tutor turns labelled A and B. It never sees which version
 * wrote which, never sees the host plan, never sees the private notes, and
 * never sees the deterministic rules. Which candidate takes the A label is
 * fixed by a hash of the pair id, so the layout is reproducible and roughly
 * balanced rather than always putting one version first.
 *
 * Both recorded versions were written by the same speaking model, so the judge
 * runs on a different one (claude CLI by default) and cannot be scoring its own
 * prose.
 *
 * Results append to a JSONL as they land, and a rerun skips pairs already in
 * it, so a run interrupted by a quota window resumes rather than restarts.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { loadTutorStubAbConfig, buildTutorStubAbPlan, prepareTutorStubAbJob } from '../services/tutorStubAbHarness.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CLI_TIMEOUT_MS = 240_000;
const CLI_ATTEMPTS = 3;
const DEFAULT_RUN_PATTERN = /^(sweep|len|contract-leak-fix|leakfix-verified)/;
const VERSIONS = ['baseline', 'contract_only'];

function usage() {
  return `Usage:
  node scripts/judge-tutor-stub-ab-pairs.js [--out PATH.jsonl] [--limit N]
                                            [--model MODEL] [--scenarios a,b]
                                            [--runs REGEX] [--mock]

Pairs each recorded bare-tutor reply with a contract reply for the same turn,
shows both to a blind judge, and records which it prefers. --mock exercises the
whole path with no model calls. Rerunning with the same --out resumes.`;
}

function parseArgs(argv) {
  const args = { out: null, limit: Infinity, model: undefined, scenarios: null, runs: null, mock: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--scenarios') args.scenarios = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--runs') args.runs = new RegExp(argv[++i]);
    else if (a === '--mock') args.mock = true;
    else throw new Error(`unknown flag ${a}`);
  }
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

/**
 * Collect every recorded reply for the two versions, keyed by turn, and carry
 * the frozen public prefix alongside so the judge can be shown the same scene
 * the tutor was answering.
 */
function collectReplies({ runPattern, scenarios }) {
  const { config } = loadTutorStubAbConfig(path.join(ROOT, 'config/tutor-stub-ab.yaml'));
  const dir = path.join(ROOT, 'exports/tutor-stub-ab');
  const runs = fs.readdirSync(dir).filter((d) => runPattern.test(d));
  const planCache = new Map();
  const bySlot = new Map();

  for (const run of runs) {
    const file = path.join(dir, run, 'report.json');
    if (!fs.existsSync(file)) continue;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const preset = doc.plan?.preset;
    const arms = (doc.plan?.arms || []).map((a) => a.id || a);
    const scenarioIds = (doc.plan?.scenarios || []).map((s) => s.id || s);
    const key = `${preset}|${arms.join(',')}|${scenarioIds.join(',')}`;
    if (!planCache.has(key)) {
      const plan = buildTutorStubAbPlan({ config, root: ROOT, preset, arms, scenarios: scenarioIds, maxCalls: 5000 });
      planCache.set(key, new Map(plan.jobs.map((j) => [`${j.scenarioId}:${j.turn}:${j.armId}`, j])));
    }
    const byId = planCache.get(key);

    for (const r of doc.results || []) {
      if (!VERSIONS.includes(r.armId)) continue;
      if (scenarios && !scenarios.includes(r.scenarioId)) continue;
      if (!r.auditedText) continue;
      const job = byId.get(`${r.scenarioId}:${r.turn}:${r.armId}`);
      if (!job) continue;
      const slot = `${r.scenarioId}:t${r.turn}`;
      if (!bySlot.has(slot)) {
        const prepared = prepareTutorStubAbJob(job, { root: ROOT });
        bySlot.set(slot, {
          slot,
          priorTurns: prepared.bundle.priorTurns || [],
          learnerText: prepared.bundle.learnerText,
          baseline: [],
          contract_only: [],
        });
      }
      bySlot.get(slot)[r.armId].push({ run, text: r.auditedText, chars: r.auditedText.length });
    }
  }
  return bySlot;
}

/**
 * One pair per repeat within a turn, so the pairs sample the spread of replies
 * each version produced rather than a single chosen exemplar. Ordering inside a
 * turn is by run name, which is stable across reruns.
 */
function buildPairs(bySlot) {
  const pairs = [];
  for (const entry of [...bySlot.values()].sort((a, b) => a.slot.localeCompare(b.slot))) {
    const bare = [...entry.baseline].sort((a, b) => a.run.localeCompare(b.run));
    const contract = [...entry.contract_only].sort((a, b) => a.run.localeCompare(b.run));
    const n = Math.min(bare.length, contract.length);
    for (let i = 0; i < n; i += 1) {
      const id = `${entry.slot}#${i}`;
      // Even hash puts the bare reply first. Fixed by id, so the same pair
      // always gets the same layout and no version is systematically first.
      const bareFirst = hash(id) % 2 === 0;
      pairs.push({
        id,
        slot: entry.slot,
        index: i,
        priorTurns: entry.priorTurns,
        learnerText: entry.learnerText,
        bare: bare[i],
        contract: contract[i],
        bareLabel: bareFirst ? 'A' : 'B',
        contractLabel: bareFirst ? 'B' : 'A',
      });
    }
  }
  return pairs;
}

const SYSTEM_PROMPT = [
  'You judge single turns of tutoring.',
  '',
  'You will read a short transcript, the learner’s latest message, and two candidate replies the tutor might send next, labelled A and B.',
  'Pick the one that is the better next thing to say to this learner.',
  '',
  'Judge only on how well the turn serves the learner: whether it is clear, whether it gives them something they can work with, whether anything it asks for is something they could actually answer from what they have, and whether it moves the inquiry on rather than restating where they already are.',
  'Length is not a virtue. A longer reply is not better for being longer, and a short reply that does the job is better than a long one that does the same job.',
  'You are not checking facts about the case and not scoring writing style.',
  '',
  'Reply with JSON only, no other text:',
  '{"better": "A" | "B" | "same", "reason": "<one sentence>"}',
].join('\n');

function buildUserPrompt(pair) {
  const scene = pair.priorTurns.map((t) => `Learner: ${t.learner}\nTutor: ${t.tutor}`).join('\n\n');
  const first = pair.bareLabel === 'A' ? pair.bare.text : pair.contract.text;
  const second = pair.bareLabel === 'A' ? pair.contract.text : pair.bare.text;
  return [
    'TRANSCRIPT SO FAR',
    scene || '(this is the first turn)',
    '',
    'LEARNER’S LATEST MESSAGE',
    pair.learnerText,
    '',
    'CANDIDATE A',
    first,
    '',
    'CANDIDATE B',
    second,
    '',
    'Which is the better next thing for the tutor to say? JSON only.',
  ].join('\n');
}

function parseVerdict(text) {
  const raw = String(text || '');
  const match = raw.match(/\{[\s\S]*\}/u);
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
  return { better: better === 'SAME' ? 'same' : better, reason: String(parsed.reason || '').slice(0, 400) };
}

/**
 * The scenes are invented sabotage inquiries, and the judge's own usage-policy
 * filter turns a few of these transcripts away. It writes that notice to stdout
 * and exits non-zero, and the bridge reports only the exit code, so the wrapper
 * below keeps the last stdout for the caller to read. Judging is one call at a
 * time, so the single slot cannot be raced.
 */
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
    // Plumbing only: prefers whichever candidate ends in a question mark, then
    // falls back to the A label. Never a stand-in for a real verdict.
    const aText = pair.bareLabel === 'A' ? pair.bare.text : pair.contract.text;
    return { better: /\?\s*$/u.test(aText.trim()) ? 'A' : 'B', reason: 'mock' };
  }
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(pair);
  let lastErr;
  for (let attempt = 1; attempt <= CLI_ATTEMPTS; attempt += 1) {
    lastCliStdout = '';
    try {
      const result = await callAIWithCliBridge(
        { provider: 'claude-code', model },
        systemPrompt,
        userPrompt,
        'judge-tutor-stub-ab-pairs',
        {
          timeoutMs: CLI_TIMEOUT_MS,
          spawnImpl: capturingSpawn,
        },
      );
      const verdict = parseVerdict(result.text);
      if (verdict) return verdict;
      lastErr = new Error(`unparseable verdict: ${String(result.text).slice(0, 160)}`);
    } catch (e) {
      lastErr = e;
      // A dead quota is not worth hammering; hand it back so the caller can
      // resume after the window resets.
      if (/session limit|usage limit|rate limit|quota/i.test(String(e?.message || e))) throw e;
      // The filter does not fire on every wording of the same scene, so a
      // refusal is worth a second try. Once it has held twice the pair is
      // recorded as turned away rather than dropped, so the judged count is
      // never quietly smaller than the pair count.
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

function summarise(records) {
  const refused = records.filter((r) => r.winner === 'refused').length;
  const judged = records.filter((r) => r.winner !== 'refused');
  const decided = judged.filter((r) => r.winner !== 'same');
  const contractWins = decided.filter((r) => r.winner === 'contract_only').length;
  const bareWins = decided.filter((r) => r.winner === 'baseline').length;
  const ties = judged.length - decided.length;
  const rate = decided.length ? contractWins / decided.length : 0;
  // Two-sided binomial spread on the decided pairs, normal approximation.
  const se = decided.length ? Math.sqrt((rate * (1 - rate)) / decided.length) : 0;
  return { n: judged.length, refused, decided: decided.length, contractWins, bareWins, ties, rate, se };
}

/**
 * Judges are known to reward length, and the contract replies are the longer
 * ones, so a win rate on its own cannot tell a better turn from a longer turn.
 * This splits the decided pairs by how much longer the contract reply was and
 * reports the rate in each band. If the preference is really about length it
 * should fall away as the two replies come closer in size.
 */
function lengthBands(records) {
  const decided = records.filter((r) => r.winner === 'baseline' || r.winner === 'contract_only');
  const withGap = decided.map((r) => ({ ...r, gap: r.contractChars - r.bareChars })).sort((a, b) => a.gap - b.gap);
  const size = Math.ceil(withGap.length / 4) || 1;
  const bands = [];
  for (let i = 0; i < withGap.length; i += size) {
    const chunk = withGap.slice(i, i + size);
    if (!chunk.length) continue;
    bands.push({
      from: chunk[0].gap,
      to: chunk[chunk.length - 1].gap,
      n: chunk.length,
      rate: chunk.filter((r) => r.winner === 'contract_only').length / chunk.length,
    });
  }
  return bands;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out || path.join(ROOT, 'exports/tutor-stub-ab/pairwise-judging.jsonl');
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

  const bySlot = collectReplies({ runPattern: args.runs || DEFAULT_RUN_PATTERN, scenarios: args.scenarios });
  const pairs = buildPairs(bySlot);
  const todo = pairs.filter((p) => !done.has(p.id)).slice(0, args.limit);
  process.stderr.write(
    `${pairs.length} pairs across ${bySlot.size} turns; ${done.size} already judged; running ${todo.length}\n`,
  );

  for (const [i, pair] of todo.entries()) {
    const startedAt = Date.now();
    const verdict = await judge({ pair, model: args.model, mock: args.mock });
    let winner;
    if (verdict.better === 'refused') winner = 'refused';
    else if (verdict.better === 'same') winner = 'same';
    else winner = verdict.better === pair.bareLabel ? 'baseline' : 'contract_only';
    const record = {
      id: pair.id,
      slot: pair.slot,
      index: pair.index,
      bareLabel: pair.bareLabel,
      winner,
      reason: verdict.reason,
      bareChars: pair.bare.chars,
      contractChars: pair.contract.chars,
      latencyMs: Date.now() - startedAt,
      mock: args.mock === true,
    };
    fs.appendFileSync(outPath, `${JSON.stringify(record)}\n`);
    process.stderr.write(`  ${String(i + 1).padStart(3)}/${todo.length} ${pair.id.padEnd(22)} ${winner}\n`);
  }

  const all = fs
    .readFileSync(outPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  const s = summarise(all);
  const lines = [
    '',
    `${s.n} pairs judged (${s.ties} called level)`,
    `contract preferred on ${s.contractWins} of ${s.decided} decided pairs — ${(s.rate * 100).toFixed(0)}% (se ${(s.se * 100).toFixed(0)}%)`,
    `bare preferred on ${s.bareWins}`,
  ];
  if (s.refused) lines.push(`${s.refused} pairs turned away by the judge's content filter and left unjudged`);
  lines.push('', 'by how much longer the contract reply was:');
  for (const band of lengthBands(all)) {
    lines.push(
      `  ${`${band.from > 0 ? '+' : ''}${band.from} to ${band.to > 0 ? '+' : ''}${band.to} chars`.padEnd(26)} contract preferred on ${(band.rate * 100).toFixed(0)}% of ${band.n}`,
    );
  }
  lines.push('', `written to ${outPath}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
