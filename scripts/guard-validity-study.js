#!/usr/bin/env node
/**
 * Guard validity study (workplan: guard-validity-study).
 *
 * Question: on the turns where every model draft was vetoed and the fixed
 * template shipped, was the vetoed draft in fact the worse turn? The replay
 * (`scripts/replay-guard-fallback-delivery.js`) says what would have shipped;
 * this study asks whether it is better, using a judge from a different model
 * family than the author.
 *
 * Subcommands:
 *   extract [runDir]       Build the item file: for each template turn, the
 *                          draft the replay would ship, the template that did
 *                          ship, and the dialogue context. No model calls.
 *   probe [--n 20]         Blinding check. Single texts, half drafts and half
 *                          templates, judge asked "composed for this moment or
 *                          assembled from stock lines?". High accuracy on the
 *                          templates means a visible pairwise design is not
 *                          blind and the main pass must score candidates alone.
 *
 * Output lands in exports/guard-validity/.
 *
 * ---
 *
 * `--family <guard>` on judge and report (added 2026-08-07, after the flip).
 *
 * The first pass answered "are the guards as a whole right?" and stratified on
 * the one family that failed, because a draft rejected by three checks at once
 * cannot tell you which rejection was wrong. That left the checks which rarely
 * fail alone with almost no evidence: source alignment got 3 pairs out of 108.
 *
 * The flip changes what is answerable. Most quality checks now record and stop
 * vetoing, so a draft that failed source alignment AND repetition AND turn
 * progression is a draft that today only source alignment still stops. It is
 * attributable again. `--family` keeps exactly the items whose remaining hard
 * findings under the live policy all belong to one guard, whatever else failed
 * under strict.
 *
 * Two limits to declare when reporting a family run:
 *   - The corpus was generated under strict, so every dialogue leading up to
 *     these turns is full of template prose. "Would ship today" is a claim
 *     about this turn under today's rules, not a prediction about a run made
 *     under them.
 *   - A family restricted this way is not a random sample of that guard's
 *     vetoes; it is the subset where nothing else still blocks.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  tutorStubGuardIssueRows,
  decideTutorStubGuardDelivery,
  TUTOR_STUB_GUARD_BOUNDARY_POLICIES,
} from '../services/tutorStubGuardDisposition.js';
import { callModelCliText } from '../services/cliProviderBridge.js';

const OUT_DIR = path.resolve('exports/guard-validity');
const ITEMS_PATH = path.join(OUT_DIR, 'items.jsonl');
const DEFAULT_RUN_DIR = 'exports/tutor-stub-outcome/fallible-phaseB';
const SAFETY_CATEGORIES = new Set([
  'public_evidence_integrity',
  'clue_transaction_integrity',
  'semantic_closure_integrity',
  'unknown',
]);
const LADDER = [
  'original_candidate',
  'plain_recovery_candidate',
  'self_correction_candidate',
  'composition_repair_candidate',
  'actorial_part_repair_candidate',
  'source_voice_repair_candidate',
];

function traceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) traceFiles(p, out);
    else if (p.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

const text = (attempt) => (typeof attempt?.candidate === 'string' ? attempt.candidate : attempt?.candidate?.text || '');
const hardKeys = (decision) => decision.hardIssues.map((i) => `${i.guard}.${i.type}`);
const safetyCount = (decision) =>
  decision.dispositions.filter((d) => SAFETY_CATEGORIES.has(d.category) && d.effectiveDisposition === 'hard').length;

/** The same choice the replay makes: relaxed column first, then the closest safety-clean draft. */
function chooseDraft(attempts) {
  const drafts = attempts
    .filter((a) => a.kind !== 'deterministic_fallback')
    .sort((a, b) => LADDER.indexOf(a.kind) - LADDER.indexOf(b.kind));
  for (const draft of drafts) {
    const relaxed = decideTutorStubGuardDelivery(tutorStubGuardIssueRows(draft.audits), {
      boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
    });
    if (relaxed.ok) return { draft, rule: 'relaxed', decision: relaxed };
  }
  let best = null;
  for (const draft of drafts) {
    const relaxed = decideTutorStubGuardDelivery(tutorStubGuardIssueRows(draft.audits), {
      boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
    });
    if (safetyCount(relaxed)) continue;
    if (!best || relaxed.hardIssues.length < best.decision.hardIssues.length) {
      best = { draft, rule: 'closest', decision: relaxed };
    }
  }
  return best;
}

function extract(runDir) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = [];
  for (const cell of fs.readdirSync(runDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const version of fs
      .readdirSync(path.join(runDir, cell.name), { withFileTypes: true })
      .filter((e) => e.isDirectory())) {
      const dir = path.join(runDir, cell.name, version.name, 'traces');
      if (!fs.existsSync(dir)) continue;
      for (const file of traceFiles(dir)) {
        const learnerByTurn = new Map();
        const shippedByTurn = new Map();
        const fallbacks = [];
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === 'auto_learner_turn') learnerByTurn.set(event.turn, String(event.text || ''));
          if (event.type !== 'tutor_response_guard_accounting') continue;
          const accounting = event.accounting || {};
          shippedByTurn.set(accounting.turn, text(accounting.finalDelivery));
          if (accounting.outcome === 'guarded_deterministic_fallback') fallbacks.push(accounting);
        }
        for (const accounting of fallbacks) {
          const chosen = chooseDraft(accounting.attempts || []);
          if (!chosen) continue;
          const template = (accounting.attempts || []).find((a) => a.kind === 'deterministic_fallback');
          const turn = accounting.turn;
          const history = [];
          for (let t = Math.max(1, turn - 2); t < turn; t++) {
            if (learnerByTurn.has(t)) history.push(`Learner: ${learnerByTurn.get(t)}`);
            if (shippedByTurn.has(t)) history.push(`Tutor: ${shippedByTurn.get(t)}`);
          }
          items.push({
            id: `${cell.name}/${version.name}/${path.basename(path.dirname(file))}/t${turn}`,
            cell: cell.name,
            version: version.name,
            turn,
            history,
            learnerNow: learnerByTurn.get(turn) || '',
            template: text(template),
            draft: text(chosen.draft),
            draftKind: chosen.draft.kind,
            rule: chosen.rule,
            draftHardStrict: hardKeys(
              decideTutorStubGuardDelivery(tutorStubGuardIssueRows(chosen.draft.audits), {
                boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict,
              }),
            ),
            // What still stops this draft under the live policy. Empty means it
            // would ship today; one family means that family is the sole
            // remaining blocker and its veto is attributable.
            draftHardRelaxed: hardKeys(chosen.decision),
          });
        }
      }
    }
  }
  fs.writeFileSync(ITEMS_PATH, items.map((i) => JSON.stringify(i)).join('\n') + '\n');
  const byCell = new Map();
  for (const i of items) {
    const k = `${i.cell}/${i.version}`;
    byCell.set(k, (byCell.get(k) || 0) + 1);
  }
  console.log(`wrote ${items.length} items to ${ITEMS_PATH}`);
  for (const [k, n] of byCell) console.log(`  ${k}: ${n}`);
}

function loadItems() {
  return fs
    .readFileSync(ITEMS_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Deterministic stride sample: stable across runs, no RNG. */
function sample(items, n) {
  const step = Math.max(1, Math.floor(items.length / n));
  const out = [];
  for (let i = 0; i < items.length && out.length < n; i += step) out.push(items[i]);
  return out;
}

const PROBE_SYSTEM = [
  'You are reviewing one turn from a tutoring dialogue set in a fictional inquiry world.',
  'The learner spoke; two candidate tutor replies follow. One was composed fresh for this moment.',
  'The other was assembled by a harness from fixed stock sentences it reuses across many different',
  'conversations, wrapped around quoted evidence. Which is the assembled one? Reply with JSON only:',
  '{"assembled":"A"|"B","confidence":0.0-1.0,"tell":"<the single strongest clue, one sentence>"}',
].join('\n');

function parseVerdict(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed.assembled === 'A' || parsed.assembled === 'B' ? parsed : null;
  } catch {
    return null;
  }
}

/** Paced call with backoff: rapid back-to-back CLI calls draw exit-1 failures. */
async function judgeCall(prompt) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await callModelCliText({
        provider: 'claude-code',
        model: 'sonnet',
        prompt,
        role: 'guard-validity-probe',
        timeoutMs: 120000,
      });
    } catch (error) {
      console.error(`  call failed (${error.message}), attempt ${attempt + 1}/4`);
      await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
    }
  }
  return '';
}

async function probe(n) {
  const items = sample(loadItems(), n);
  const results = [];
  let correct = 0,
    parsed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const templateIsA = i % 2 === 0;
    const a = templateIsA ? item.template : item.draft;
    const b = templateIsA ? item.draft : item.template;
    const prompt = [
      PROBE_SYSTEM,
      '',
      `The learner just said: ${item.learnerNow}`,
      '',
      `Reply A:\n${a}`,
      '',
      `Reply B:\n${b}`,
    ].join('\n');
    const verdict = parseVerdict(await judgeCall(prompt));
    const truth = templateIsA ? 'A' : 'B';
    const hit = verdict?.assembled === truth;
    if (verdict) parsed++;
    if (hit) correct++;
    results.push({ id: item.id, truth, named: verdict?.assembled || 'unparsed', tell: verdict?.tell || '' });
    console.log(
      `${String(i + 1).padStart(2)}/${items.length} template=${truth} judge=${verdict?.assembled || 'unparsed'} ${hit ? 'HIT' : 'miss'}`,
    );
    await new Promise((r) => setTimeout(r, 8000));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'probe-results.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\ntemplate identified: ${correct}/${items.length} (parsed ${parsed}/${items.length})`);
  console.log('tells:');
  for (const r of results) console.log(`  [${r.named === r.truth ? 'hit' : 'miss'}] ${r.tell}`);
}

const SCORE_SYSTEM = [
  'You are scoring ONE tutor turn from a tutoring dialogue set in a fictional inquiry world.',
  'The tutor may only use public evidence, must stay in character, and hands the turn back to the learner.',
  'Score the reply on four anchored 1-5 scales:',
  '- uptake: engages the specific thing the learner just said (1 = ignores or merely re-quotes it, 3 = acknowledges it generically, 5 = answers its exact content)',
  '- advance: moves the inquiry a concrete step (1 = restates ground already held, 3 = organizes without adding, 5 = adds evidence, a distinction, or an applied test)',
  '- fit: the wording belongs to this exact moment (1 = could be pasted into any conversation, 3 = mixed, 5 = built from the particulars at hand)',
  '- overall: how good a next tutor turn this is (1 = useless or confusing, 3 = serviceable, 5 = excellent)',
  'Reply with JSON only: {"uptake":n,"advance":n,"fit":n,"overall":n}',
].join('\n');

function parseScores(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    for (const k of ['uptake', 'advance', 'fit', 'overall']) {
      const v = Number(parsed[k]);
      if (!Number.isFinite(v) || v < 1 || v > 5) return null;
      parsed[k] = v;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Family label for stratification: the one failing family, or "mixed". */
function familyOf(item) {
  const families = new Set((item.draftHardStrict || []).map((k) => k.split('.')[0]));
  if (!families.size) return 'none';
  return families.size === 1 ? [...families][0] : 'mixed';
}

/**
 * Which guards still stop this draft under the live policy. One name means that
 * guard alone is what the learner lost the turn to, and a judgement on the pair
 * is a judgement on that guard. Empty means the draft would ship today.
 */
function blockingFamilies(item) {
  return [...new Set((item.draftHardRelaxed || []).map((k) => k.split('.')[0]))].sort();
}

function soleBlocker(item) {
  const families = blockingFamilies(item);
  return families.length === 1 ? families[0] : null;
}

/**
 * Items where `family` is the only guard still blocking. Fails loudly on an item
 * file written before draftHardRelaxed existed, rather than silently returning
 * nothing — the fix is to re-run extract, which costs no model calls.
 */
function filterToFamily(items, family) {
  if (!items.some((i) => i.draftHardRelaxed)) {
    console.error('the item file predates --family: re-run `extract` first (no model calls, nothing is lost)');
    process.exit(1);
  }
  const kept = items.filter((i) => soleBlocker(i) === family);
  const anywhere = items.filter((i) => blockingFamilies(i).includes(family)).length;
  console.log(
    `${kept.length} items where ${family} is the only guard still blocking ` +
      `(${anywhere} still blocked by it at all, out of ${items.length})`,
  );
  if (!kept.length) {
    const tally = new Map();
    for (const i of items) {
      const k = soleBlocker(i) || (blockingFamilies(i).length ? 'several' : 'would ship today');
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    console.error(`nothing to judge. sole blocker across the file:`);
    for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(4)} ${k}`);
    process.exit(1);
  }
  return kept;
}

/** Round-robin across (family, cell) strata so no world or fault type dominates. */
function stratifiedSample(items, n) {
  const strata = new Map();
  for (const item of items) {
    const key = `${familyOf(item)}|${item.cell}/${item.version}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(item);
  }
  const pools = [...strata.values()];
  const out = [];
  for (let round = 0; out.length < n && pools.some((p) => p.length > round); round++) {
    for (const pool of pools) {
      if (out.length >= n) break;
      if (pool[round]) out.push(pool[round]);
    }
  }
  return out;
}

async function judge(n, family = null) {
  const resultsPath = path.join(OUT_DIR, 'judge-results.jsonl');
  const done = new Set();
  if (fs.existsSync(resultsPath)) {
    for (const line of fs.readFileSync(resultsPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        done.add(`${row.id}|${row.candidate}`);
      } catch {
        /* skip broken line */
      }
    }
  }
  const pool = family ? filterToFamily(loadItems(), family) : loadItems();
  // Round-robin still earns its keep inside one family: it spreads the draws
  // across worlds instead of taking them all from whichever ran first.
  const items = stratifiedSample(pool, n);
  const queue = [];
  for (const item of items) {
    for (const candidate of ['draft', 'template']) {
      if (!done.has(`${item.id}|${candidate}`)) queue.push({ item, candidate });
    }
  }
  console.log(`${items.length} items, ${queue.length} scores to collect (${done.size} already on disk)`);
  let failures = 0;
  while (queue.length) {
    const { item, candidate } = queue.shift();
    const prompt = [
      SCORE_SYSTEM,
      '',
      item.history.length ? `Recent dialogue:\n${item.history.join('\n')}\n` : '',
      `The learner just said: ${item.learnerNow}`,
      '',
      `Tutor reply to score:\n${candidate === 'draft' ? item.draft : item.template}`,
    ].join('\n');
    const scores = parseScores(await judgeCall(prompt));
    if (!scores) {
      failures++;
      queue.push({ item, candidate }); // requeue at the back; bursts pass
      if (failures > queue.length * 3 + 30) {
        console.error('too many failures; stopping — rerun to resume from disk');
        break;
      }
      await new Promise((r) => setTimeout(r, 30000));
      continue;
    }
    fs.appendFileSync(
      resultsPath,
      JSON.stringify({
        id: item.id,
        candidate,
        family: familyOf(item),
        blocking: soleBlocker(item),
        rule: item.rule,
        ...scores,
      }) + '\n',
    );
    console.log(
      `${String(queue.length).padStart(3)} left | ${candidate === 'draft' ? 'draft   ' : 'template'} overall=${scores.overall} ${item.id}`,
    );
    await new Promise((r) => setTimeout(r, 8000));
  }
  report(family);
}

function report(family = null) {
  const resultsPath = path.join(OUT_DIR, 'judge-results.jsonl');
  if (!fs.existsSync(resultsPath)) {
    console.log('no judge results yet');
    return;
  }
  const byPair = new Map();
  for (const line of fs.readFileSync(resultsPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (!byPair.has(row.id)) byPair.set(row.id, {});
    byPair.get(row.id)[row.candidate] = row;
  }
  let pairs = [...byPair.values()].filter((p) => p.draft && p.template);
  if (family) {
    const before = pairs.length;
    // Rows scored before --family existed carry no blocking field. They were
    // drawn under the whole-corpus rule, so they are not part of this question.
    pairs = pairs.filter((p) => p.draft.blocking === family);
    console.log(`\nonly the pairs where ${family} is the sole remaining blocker: ${pairs.length} of ${before} scored`);
    if (!pairs.length) return;
  }
  console.log(`\ncomplete pairs: ${pairs.length}`);
  const dims = ['overall', 'uptake', 'advance', 'fit'];
  for (const dim of dims) {
    const draftMean = pairs.reduce((s, p) => s + p.draft[dim], 0) / pairs.length;
    const templateMean = pairs.reduce((s, p) => s + p.template[dim], 0) / pairs.length;
    const wins = pairs.filter((p) => p.draft[dim] > p.template[dim]).length;
    const ties = pairs.filter((p) => p.draft[dim] === p.template[dim]).length;
    console.log(
      `${dim.padEnd(8)} draft ${draftMean.toFixed(2)} vs template ${templateMean.toFixed(2)} | draft wins ${wins}, ties ${ties}, template wins ${pairs.length - wins - ties}`,
    );
  }
  console.log('\nby family of the draft’s findings (overall: draft mean vs template mean, n):');
  const byFamily = new Map();
  for (const p of pairs) {
    const f = p.draft.family;
    if (!byFamily.has(f)) byFamily.set(f, []);
    byFamily.get(f).push(p);
  }
  for (const [f, rows] of [...byFamily].sort((a, b) => b[1].length - a[1].length)) {
    const d = rows.reduce((s, p) => s + p.draft.overall, 0) / rows.length;
    const t = rows.reduce((s, p) => s + p.template.overall, 0) / rows.length;
    console.log(`  ${f.padEnd(36)} ${d.toFixed(2)} vs ${t.toFixed(2)}  (n=${rows.length})`);
  }
}

/** Read `--name value` or `--name=value`; null when absent. */
function flag(argv, name) {
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const at = argv.indexOf(name);
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : null;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'extract') {
    extract(rest.find((a) => !a.startsWith('--')) || DEFAULT_RUN_DIR);
  } else if (cmd === 'probe') {
    const n = Number(rest[rest.indexOf('--n') + 1]) || 20;
    await probe(n);
  } else if (cmd === 'judge') {
    const n = Number(rest[rest.indexOf('--n') + 1]) || 150;
    await judge(n, flag(rest, '--family'));
  } else if (cmd === 'report') {
    report(flag(rest, '--family'));
  } else {
    console.error(
      'usage: guard-validity-study.js extract [runDir] | probe [--n 20] | ' +
        'judge [--n 150] [--family <guard>] | report [--family <guard>]',
    );
    process.exit(2);
  }
}

main();
