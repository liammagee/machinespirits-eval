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
 * Any two recorded versions can be paired with --versions, so the same channel
 * grades the contract against the bare tutor and the plan control against
 * either of them. The second name is the one the reported win rate is for.
 *
 * Both recorded versions were written by the same speaking model, so the judge
 * runs on a different one (claude CLI by default) and cannot be scoring its own
 * prose.
 *
 * --show-due answers one objection to the blind reading. On the first pass the
 * judge gave turns to the bare tutor for, in its words, inventing an entirely
 * new evidentiary thread and writing the case for the learner. The thread was
 * not invented: it is the clue the world file schedules for that turn, and the
 * blind judge has no way to tell a scheduled release from a fabrication. The
 * flag adds the clue text as a fact of the scene, alike for both candidates and
 * with a rule against preferring a reply merely for naming it. The clue list
 * comes from the world file, so it is the same for every version at a turn and
 * cannot smuggle in one version's plan. Records land in their own file, because
 * a verdict made with the list and one made without are not the same reading.
 *
 * Results append to a JSONL as they land, and a rerun skips pairs already in
 * it, so a run interrupted by a quota window resumes rather than restarts.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { abTurnObligations } from '../services/tutorStubAbPrBenchmarkScoring.js';
import { loadTutorStubAbConfig, buildTutorStubAbPlan, prepareTutorStubAbJob } from '../services/tutorStubAbHarness.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CLI_TIMEOUT_MS = 240_000;
const CLI_ATTEMPTS = 3;
/**
 * A pair's id is its position in the run-sorted list of replies for that turn,
 * so letting a new run into the pool renumbers positions and makes an id mean a
 * different pair than the verdict already recorded under it. The default pool
 * is therefore frozen at the runs the standing corpus was judged on; a later
 * run is judged by naming it with --runs and writing to its own file.
 */
const DEFAULT_RUN_PATTERN = /^(sweep|len|contract-leak-fix|leakfix-verified)/;
const DEFAULT_VERSIONS = ['baseline', 'contract_only'];

function usage() {
  return `Usage:
  node scripts/judge-tutor-stub-ab-pairs.js [--out PATH.jsonl] [--limit N]
                                            [--model MODEL] [--judge-provider claude-code|codex]
                                            [--scenarios a,b]
                                            [--versions left,right] [--show-due]
                                            [--runs REGEX] [--mock]

Pairs each recorded reply of one arm with a reply of another for the same turn,
shows both to a blind judge, and records which it prefers. The win rate is
reported for the second --versions name. --show-due tells the judge which clue
the world file schedules for that turn, so a scheduled release does not read as
invented plot; it writes to its own file. --mock exercises the whole path with
no model calls. Rerunning with the same --out resumes.`;
}

function parseArgs(argv) {
  const args = {
    out: null,
    limit: Infinity,
    model: undefined,
    judgeProvider: 'claude-code',
    scenarios: null,
    runs: null,
    mock: false,
    showDue: false,
    versions: DEFAULT_VERSIONS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--judge-provider') args.judgeProvider = argv[++i];
    else if (a === '--scenarios') args.scenarios = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--versions') args.versions = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--runs') args.runs = new RegExp(argv[++i]);
    else if (a === '--show-due') args.showDue = true;
    else if (a === '--mock') args.mock = true;
    else throw new Error(`unknown flag ${a}`);
  }
  if (args.versions.length !== 2 || args.versions[0] === args.versions[1]) {
    throw new Error('--versions needs exactly two different arm ids');
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
 * The clue lines the world file opens up at this turn.
 *
 * Read through the whitelist the PR benchmark already uses, so the closure
 * frame's answer term, the private premise ids and the learner's proof-DAG
 * model stay out of anything a judge can see. Only the licensed surface
 * sentence is kept: the judge is being told what belongs to the scene, not
 * given the answer to the case.
 */
function dueFactsFor(bundle) {
  const release = abTurnObligations(bundle).release;
  if (!release.active) return [];
  return release.entries.map((entry) => entry.surface).filter(Boolean);
}

/**
 * Collect every recorded reply for the two versions, keyed by turn, and carry
 * the frozen public prefix alongside so the judge can be shown the same scene
 * the tutor was answering.
 *
 * One turn is prepared once, from whichever job for it is read first. The three
 * things kept off that bundle — the public prefix, the learner's line and the
 * clue schedule — are all authored in the world file and refreshed from it, so
 * none of them varies with the version whose job supplied them.
 */
function collectReplies({ runPattern, scenarios, versions }) {
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
      if (!versions.includes(r.armId)) continue;
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
          dueFacts: dueFactsFor(prepared.bundle),
          replies: Object.fromEntries(versions.map((v) => [v, []])),
        });
      }
      bySlot.get(slot).replies[r.armId].push({ run, text: r.auditedText, chars: r.auditedText.length });
    }
  }
  return bySlot;
}

/**
 * One pair per repeat within a turn, so the pairs sample the spread of replies
 * each version produced rather than a single chosen exemplar. Ordering inside a
 * turn is by run name, which is stable across reruns.
 */
function buildPairs(bySlot, versions) {
  const [left, right] = versions;
  const pairs = [];
  for (const entry of [...bySlot.values()].sort((a, b) => a.slot.localeCompare(b.slot))) {
    const leftReplies = [...entry.replies[left]].sort((a, b) => a.run.localeCompare(b.run));
    const rightReplies = [...entry.replies[right]].sort((a, b) => a.run.localeCompare(b.run));
    const n = Math.min(leftReplies.length, rightReplies.length);
    for (let i = 0; i < n; i += 1) {
      const id = `${entry.slot}#${i}`;
      // Even hash puts the left version first. Fixed by id, so the same pair
      // always gets the same layout and no version is systematically first.
      const leftFirst = hash(id) % 2 === 0;
      pairs.push({
        id,
        slot: entry.slot,
        index: i,
        priorTurns: entry.priorTurns,
        learnerText: entry.learnerText,
        dueFacts: entry.dueFacts,
        replies: { [left]: leftReplies[i], [right]: rightReplies[i] },
        // The version shown as candidate A. Everything downstream reads this
        // rather than assuming a fixed side.
        first: leftFirst ? left : right,
        second: leftFirst ? right : left,
      });
    }
  }
  return pairs;
}

const JUDGE_TASK = [
  'You judge single turns of tutoring.',
  '',
  'You will read a short transcript, the learner’s latest message, and two candidate replies the tutor might send next, labelled A and B.',
  'Pick the one that is the better next thing to say to this learner.',
  '',
  'Judge only on how well the turn serves the learner: whether it is clear, whether it gives them something they can work with, whether anything it asks for is something they could actually answer from what they have, and whether it moves the inquiry on rather than restating where they already are.',
  'Length is not a virtue. A longer reply is not better for being longer, and a short reply that does the job is better than a long one that does the same job.',
];

const JUDGE_REPLY_FORMAT = [
  '',
  'Reply with JSON only, no other text:',
  '{"better": "A" | "B" | "same", "reason": "<one sentence>"}',
];

const SYSTEM_PROMPT_BLIND = [
  ...JUDGE_TASK,
  'You are not checking facts about the case and not scoring writing style.',
  ...JUDGE_REPLY_FORMAT,
].join('\n');

/**
 * The same task with the scene's own clue schedule declared.
 *
 * Two guards, and both matter. The first says a listed line belongs to the
 * case, which is what stops a scheduled release reading as invented plot. The
 * second forbids preferring a reply for naming a listed line, which is what
 * stops the fix turning into a second scoring-against-the-plan channel. Without
 * the second guard this would just be the deterministic rules again, wearing a
 * judge's clothes.
 */
const SYSTEM_PROMPT_WITH_DUE = [
  ...JUDGE_TASK,
  '',
  'Each turn lists the findings of the case that are open to the tutor at that point. A reply that brings a listed finding into the conversation is using the case, not making it up. A reply that introduces evidence when the list is empty, or evidence the list does not carry, is making it up.',
  'Do not prefer a reply for naming a listed finding. Whether to bring it in now, and how, is part of what you are judging, and a turn that holds one back can be the better turn.',
  'Beyond that you are not checking facts about the case, and you are not scoring writing style.',
  ...JUDGE_REPLY_FORMAT,
].join('\n');

function buildUserPrompt(pair, showDue) {
  const scene = pair.priorTurns.map((t) => `Learner: ${t.learner}\nTutor: ${t.tutor}`).join('\n\n');
  const lines = [
    'TRANSCRIPT SO FAR',
    scene || '(this is the first turn)',
    '',
    'LEARNER’S LATEST MESSAGE',
    pair.learnerText,
  ];
  if (showDue) {
    const facts = pair.dueFacts || [];
    lines.push(
      '',
      'FINDINGS OF THE CASE OPEN TO THE TUTOR AT THIS POINT',
      facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(none — nothing new opens up at this point)',
    );
  }
  lines.push(
    '',
    'CANDIDATE A',
    pair.replies[pair.first].text,
    '',
    'CANDIDATE B',
    pair.replies[pair.second].text,
    '',
    'Which is the better next thing for the tutor to say? JSON only.',
  );
  return lines.join('\n');
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

async function judge({ pair, model, mock, showDue, judgeProvider = 'claude-code' }) {
  if (mock) {
    // Plumbing only: prefers whichever candidate ends in a question mark, then
    // falls back to the A label. Never a stand-in for a real verdict.
    const aText = pair.replies[pair.first].text;
    return { better: /\?\s*$/u.test(aText.trim()) ? 'A' : 'B', reason: 'mock' };
  }
  const systemPrompt = showDue ? SYSTEM_PROMPT_WITH_DUE : SYSTEM_PROMPT_BLIND;
  const userPrompt = buildUserPrompt(pair, showDue);
  let lastErr;
  for (let attempt = 1; attempt <= CLI_ATTEMPTS; attempt += 1) {
    lastCliStdout = '';
    try {
      const result = await callAIWithCliBridge(
        { provider: judgeProvider, model },
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

/**
 * Records written before this script took a --versions flag name the two sides
 * bare and contract. They are still the largest body of verdicts we have, so
 * they are read rather than discarded.
 */
function normalise(record, versions) {
  if (record.chars) return record;
  return { ...record, chars: { baseline: record.bareChars, contract_only: record.contractChars }, versions };
}

function summarise(records, versions) {
  const [left, right] = versions;
  const refused = records.filter((r) => r.winner === 'refused').length;
  const judged = records.filter((r) => r.winner !== 'refused');
  const decided = judged.filter((r) => r.winner !== 'same');
  const rightWins = decided.filter((r) => r.winner === right).length;
  const leftWins = decided.filter((r) => r.winner === left).length;
  const ties = judged.length - decided.length;
  const rate = decided.length ? rightWins / decided.length : 0;
  // Two-sided binomial spread on the decided pairs, normal approximation.
  const se = decided.length ? Math.sqrt((rate * (1 - rate)) / decided.length) : 0;
  return { n: judged.length, refused, decided: decided.length, rightWins, leftWins, ties, rate, se };
}

/**
 * Judges are known to reward length, and the instrumented replies are the
 * longer ones, so a win rate on its own cannot tell a better turn from a longer
 * turn. This splits the decided pairs by how much longer the second version's
 * reply was and reports the rate in each band. If the preference is really
 * about length it should fall away as the two replies come closer in size.
 */
function lengthBands(records, versions) {
  const [left, right] = versions;
  const decided = records.filter((r) => r.winner === left || r.winner === right);
  const withGap = decided.map((r) => ({ ...r, gap: r.chars[right] - r.chars[left] })).sort((a, b) => a.gap - b.gap);
  const size = Math.ceil(withGap.length / 4) || 1;
  const bands = [];
  for (let i = 0; i < withGap.length; i += size) {
    const chunk = withGap.slice(i, i + size);
    if (!chunk.length) continue;
    bands.push({
      from: chunk[0].gap,
      to: chunk[chunk.length - 1].gap,
      n: chunk.length,
      rate: chunk.filter((r) => r.winner === right).length / chunk.length,
    });
  }
  return bands;
}

/**
 * With the clue schedule declared, the turns that carry a clue and the turns
 * that carry none are two different readings, and pooling them hides which one
 * moved. The first pass had a clue due on three of its nine turns.
 */
function releaseSplit(records, versions, dueBySlot) {
  const [left, right] = versions;
  const decided = records.filter((r) => r.winner === left || r.winner === right);
  const rows = [];
  for (const [label, wanted] of [
    ['turns with a clue due', true],
    ['turns with none due', false],
  ]) {
    const chunk = decided.filter((r) => Boolean(dueBySlot.get(r.slot)?.length) === wanted);
    if (!chunk.length) continue;
    rows.push({ label, n: chunk.length, rightWins: chunk.filter((r) => r.winner === right).length });
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [left, right] = args.versions;
  const suffix = args.showDue ? '-due' : '';
  const outPath =
    args.out || path.join(ROOT, `exports/tutor-stub-ab/pairwise-judging-${left}-vs-${right}${suffix}.jsonl`);
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

  const bySlot = collectReplies({
    runPattern: args.runs || DEFAULT_RUN_PATTERN,
    scenarios: args.scenarios,
    versions: args.versions,
  });
  const pairs = buildPairs(bySlot, args.versions);
  const dueBySlot = new Map([...bySlot.values()].map((e) => [e.slot, e.dueFacts]));
  const todo = pairs.filter((p) => !done.has(p.id)).slice(0, args.limit);
  const withDue = [...dueBySlot.values()].filter((f) => f.length).length;
  process.stderr.write(
    `${pairs.length} pairs across ${bySlot.size} turns (${withDue} with a clue due); ${done.size} already judged; running ${todo.length}\n`,
  );
  if (args.showDue) process.stderr.write('the judge is being shown the clue schedule for each turn\n');

  for (const [i, pair] of todo.entries()) {
    const startedAt = Date.now();
    const verdict = await judge({
      pair,
      model: args.model,
      mock: args.mock,
      showDue: args.showDue,
      judgeProvider: args.judgeProvider,
    });
    let winner;
    if (verdict.better === 'refused') winner = 'refused';
    else if (verdict.better === 'same') winner = 'same';
    else winner = verdict.better === 'A' ? pair.first : pair.second;
    const record = {
      id: pair.id,
      slot: pair.slot,
      index: pair.index,
      versions: args.versions,
      shownFirst: pair.first,
      // Whether the judge was told what the turn had open to it. A verdict made
      // with the schedule and one made without are different readings and must
      // never be pooled.
      showDue: args.showDue === true,
      // Which model family read the pair. The default judge is claude-family,
      // deliberately not the speakers' family; a codex-family pass over the
      // same pairs probes whether a verdict is one family's taste.
      judgeProvider: args.judgeProvider,
      dueCount: (pair.dueFacts || []).length,
      winner,
      reason: verdict.reason,
      chars: { [left]: pair.replies[left].chars, [right]: pair.replies[right].chars },
      // Which run each side was taken from, so a recorded verdict can still be
      // traced to its two replies once the pool has grown.
      runs: { [left]: pair.replies[left].run, [right]: pair.replies[right].run },
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
    .map((l) => normalise(JSON.parse(l), args.versions));
  const s = summarise(all, args.versions);
  const lines = [
    '',
    `${left} vs ${right}${args.showDue ? ' (judge shown the clue schedule)' : ' (judge blind to the clue schedule)'}`,
    `${s.n} pairs judged (${s.ties} called level)`,
    `${right} preferred on ${s.rightWins} of ${s.decided} decided pairs — ${(s.rate * 100).toFixed(0)}% (se ${(s.se * 100).toFixed(0)}%)`,
    `${left} preferred on ${s.leftWins}`,
  ];
  if (s.refused) lines.push(`${s.refused} pairs turned away by the judge's content filter and left unjudged`);
  lines.push('', `by how much longer the ${right} reply was:`);
  for (const band of lengthBands(all, args.versions)) {
    lines.push(
      `  ${`${band.from > 0 ? '+' : ''}${band.from} to ${band.to > 0 ? '+' : ''}${band.to} chars`.padEnd(26)} ${right} preferred on ${(band.rate * 100).toFixed(0)}% of ${band.n}`,
    );
  }
  const split = releaseSplit(all, args.versions, dueBySlot);
  if (split.length > 1) {
    lines.push('', 'by whether the world file opened a clue at that turn:');
    for (const row of split) {
      lines.push(`  ${row.label.padEnd(26)} ${right} preferred on ${row.rightWins} of ${row.n}`);
    }
  }
  lines.push('', `written to ${outPath}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
