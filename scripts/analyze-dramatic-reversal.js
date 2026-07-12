#!/usr/bin/env node
/**
 * Dramatic-reversal / recognition probe (the "Hollywood confound" detector).
 *
 * Context
 * -------
 * The drama-machine reframing asks: do synthetic teaching dialogues exhibit
 * Aristotelian *peripeteia* (reversal) and *anagnorisis* (recognition)? On a
 * synthetic learner this question is confounded at the source. The drama-machine
 * paper (Magee et al., 2024, arXiv:2408.01725v2) already reports the cautionary
 * result: without a superego, an LLM produces a "superficially salutary ...
 * Hollywood ending incapable of producing the cathartic effect Aristotle
 * identifies as proper to tragedy." A transcript "recognition" from a synthetic
 * learner is the learner-model's *trained disposition to perform insight* — not
 * evidence of representational change — and it is indistinguishable from real
 * change on any LLM-judged channel.
 *
 * What this probe does
 * --------------------
 * Pure descriptive process measure (no new empirical claim; converges with
 * paper-full-2.0.md §7.9's slope-proxy / frozen-external-standard argument and
 * the drama machine's Hollywood caution). For each multi-turn dialogue it:
 *   1. extracts the ordered learner *external* messages from dialogueTrace,
 *   2. rule-scores each turn for recognition (anagnorisis lexicon) and detects
 *      structural reversal (peripeteia proxy: a later turn supersedes an
 *      earlier stance with a back-reference),
 *   3. derives Hollywood indicators (recognition rate, end-clustering of first
 *      recognition, valence uniformity, gratitude co-occurrence, resolved
 *      ending), and
 *   4. computes the decisive **dissociation** signal: verbal recognition that
 *      does NOT track the independent learner-rubric first->last delta (the
 *      channel the learner-model does not author).
 * It then contrasts superego-present vs superego-absent dialogues — the drama
 * machine's key comparison — using ground-truth (superego,review) trace entries.
 *
 * The LLM reversal/recognition pass is gated OFF by default on purpose: scoring
 * the architecture's own transcript with another LLM re-imports the closed-loop
 * confound the probe exists to expose (the drama paper's own Table 2 caveat).
 *
 * Usage:
 *   node scripts/analyze-dramatic-reversal.js <runId> [<runId> ...]
 *   node scripts/analyze-dramatic-reversal.js --db data/evaluations.db <runId>
 *   node scripts/analyze-dramatic-reversal.js <runId> --json exports/dramatic-reversal-probe.json
 *   node scripts/analyze-dramatic-reversal.js <runId> --limit 50 --dry-run
 *   node scripts/analyze-dramatic-reversal.js <runId> --llm-pass   # disabled stub; prints why
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateLearnerOverallScore } from '../services/learnerRubricEvaluator.js';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const rawArgs = process.argv.slice(2);

function parseCliArgs(argv) {
  const valueOptions = new Set(['db', 'logs', 'json', 'limit']);
  const options = {};
  const flags = new Set();
  const runIds = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      runIds.push(token);
      continue;
    }
    const key = token.slice(2);
    if (valueOptions.has(key)) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = null;
      }
      continue;
    }
    flags.add(key);
  }
  return { options, flags, runIds };
}

const cli = parseCliArgs(rawArgs);

function getOption(name, defaultValue = null) {
  const value = cli.options[name];
  return value == null ? defaultValue : value;
}
function hasFlag(name) {
  return cli.flags.has(name);
}

const dbOverride = getOption('db');
const logsDir = getOption('logs', path.join(ROOT_DIR, 'logs', 'tutor-dialogues'));
const jsonOutPath = getOption('json');
const dryRunMode = hasFlag('dry-run');
const llmPassRequested = hasFlag('llm-pass');

const limitRaw = getOption('limit', null);
const parsedLimit = limitRaw == null ? null : Number.parseInt(limitRaw, 10);
const rowLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

// ---------------------------------------------------------------------------
// Small numeric helpers (mirror analyze-within-test-change.js conventions)
// ---------------------------------------------------------------------------
function mean(arr) {
  const xs = (arr || []).filter((x) => Number.isFinite(x));
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function std(arr) {
  const xs = (arr || []).filter((x) => Number.isFinite(x));
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
function pearson(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;
  const ax = pairs.map((p) => p[0]);
  const ay = pairs.map((p) => p[1]);
  const mx = mean(ax);
  const my = mean(ay);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (const [a, b] of pairs) {
    cov += (a - mx) * (b - my);
    vx += (a - mx) ** 2;
    vy += (b - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}
function numFmt(v, d = 2) {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v.toFixed(d);
}
function pctFmt(v) {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return `${(v * 100).toFixed(1)}%`;
}
function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function cleanText(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------
// Anagnorisis lexicon: first-person epistemic-shift / insight markers a learner
// emits when (or when *performing*) ignorance -> knowledge.
const RECOGNITION_MARKERS = [
  'i see',
  'i see it',
  'now i understand',
  'now i get it',
  'i get it',
  'i understand now',
  'that makes sense',
  'that helps',
  'that changes',
  'i was wrong',
  "i hadn't thought",
  'i had not thought',
  'i never realized',
  'i never thought',
  'i never considered',
  'i hadn’t considered',
  'i see what you mean',
  'i think i see',
  'so it is not',
  'so it’s not',
  'it clicks',
  'it clicked',
  'that clarifies',
  'aha',
  'oh!',
  'ohh',
  'right,',
  'okay, yes',
  'okay yes',
  'yes—',
  'yes -',
  'that reframes',
  'reframes it',
  'makes it feel',
  'feel more',
];
// Gratitude / affective-closure markers (the "salutary" register).
const GRATITUDE_MARKERS = ['thank you', 'thanks', 'i appreciate', 'grateful', 'this is helpful', 'really helpful'];
// Residual-confusion markers — their ABSENCE on a recognition turn is what
// makes the ending "Hollywood" (uniformly positive resolution).
const RESIDUAL_CONFUSION_MARKERS = [
  'still confused',
  'still lost',
  'still stuck',
  "i don't get",
  'i do not get',
  "i'm not sure",
  'i am not sure',
  'i still',
  'but i don’t understand',
  'but i dont understand',
  "but i don't understand",
  'unclear',
  'no idea',
  "doesn't make sense",
  'does not make sense',
  'i’m lost',
  "i'm lost",
];
// Peripeteia proxy: stance-shift token co-occurring with a back-reference to an
// earlier stance == a later turn superseding an earlier one.
const STANCE_SHIFT_TOKENS = [
  'but ',
  'however',
  'actually',
  'instead',
  'on the other hand',
  'i changed my mind',
  'the opposite',
  'not what i',
  'rather than',
  'wait',
];
const BACKREF_TOKENS = [
  'you said',
  'you mentioned',
  'earlier',
  'before',
  'i thought',
  'i was',
  'last time',
  'previously',
  'i assumed',
  'i used to',
  'at first',
];

function containsAny(lower, markers) {
  for (const m of markers) {
    if (lower.includes(m)) return true;
  }
  return false;
}
function countAny(lower, markers) {
  let n = 0;
  for (const m of markers) {
    if (lower.includes(m)) n++;
  }
  return n;
}

function scoreTurn(text) {
  const lower = String(text || '').toLowerCase();
  const recognition = containsAny(lower, RECOGNITION_MARKERS);
  const gratitude = containsAny(lower, GRATITUDE_MARKERS);
  const residualConfusion = containsAny(lower, RESIDUAL_CONFUSION_MARKERS);
  const stanceShift = containsAny(lower, STANCE_SHIFT_TOKENS);
  const backref = containsAny(lower, BACKREF_TOKENS);
  return {
    recognition,
    gratitude,
    residualConfusion,
    // A turn "reverses" when it both shifts stance and references the prior one.
    reversal: stanceShift && backref,
    recognitionStrength: countAny(lower, RECOGNITION_MARKERS),
  };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------
function loadDialogueLog(dialogueId, cache) {
  if (!dialogueId) return null;
  if (cache.has(dialogueId)) return cache.get(dialogueId);
  const logPath = path.join(logsDir, `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) {
    cache.set(dialogueId, null);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    cache.set(dialogueId, parsed);
    return parsed;
  } catch {
    cache.set(dialogueId, null);
    return null;
  }
}

// Ordered learner external messages. Backward-compatible with old ('user')
// agent labels per the tutor-learner symmetry contract.
function extractLearnerMessages(log) {
  const trace = Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [];
  const byTurn = new Map();
  for (const e of trace) {
    if (e?.action !== 'final_output') continue;
    if (e?.agent !== 'learner' && e?.agent !== 'user') continue;
    const idx = Number.isFinite(e?.turnIndex) ? e.turnIndex : null;
    if (idx == null) continue;
    const text = cleanText(e?.detail || e?.message || e?.contextSummary);
    if (text && !byTurn.has(idx)) byTurn.set(idx, text);
  }
  return [...byTurn.entries()].sort((a, b) => a[0] - b[0]).map(([, text]) => text);
}

// Ground-truth superego presence: an active superego leaves (superego,review)
// entries in the trace. Fall back to the config's superego-present cell set.
const SUPEREGO_PRESENT_CELLS = new Set([
  3, 4, 7, 8, 11, 12, 17, 18, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 82, 83, 86, 87, 88, 89,
]);
function cellNumberFromProfile(profileName) {
  const m = String(profileName || '').match(/cell[_-](\d+)/i);
  return m ? Number.parseInt(m[1], 10) : null;
}
function detectSuperego(log, profileName) {
  const trace = Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [];
  const hasReview = trace.some((e) => e?.agent === 'superego' && e?.action === 'review');
  if (hasReview) return { present: true, source: 'trace' };
  if (trace.length > 0) {
    // Trace exists and shows no superego review -> genuinely absent.
    const cell = cellNumberFromProfile(profileName);
    if (cell != null && SUPEREGO_PRESENT_CELLS.has(cell)) {
      // Config says present but trace shows none (e.g. superego never fired):
      // trust the trace for this dialogue.
      return { present: false, source: 'trace-empty-despite-config' };
    }
    return { present: false, source: 'trace' };
  }
  const cell = cellNumberFromProfile(profileName);
  if (cell == null) return { present: null, source: 'unknown' };
  return { present: SUPEREGO_PRESENT_CELLS.has(cell), source: 'config' };
}

// Independent rubric channel: learner first->last overall delta from the DB
// learner_scores JSON (the channel the learner-model does not author).
function isMultiAgentLearner(row, log) {
  const arch = String(row.learner_architecture || log?.learnerArchitecture || '').toLowerCase();
  return arch.includes('ego_superego') || arch.includes('psycho') || arch === 'multi_agent';
}
function learnerRubricDelta(row, log) {
  const parsed = parseJson(row.learner_scores, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const multiAgent = isMultiAgentLearner(row, log);
  const turns = Object.values(parsed)
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const overall = Number.isFinite(x.overallScore) ? x.overallScore : null;
      if (overall != null) return { turnIndex: x.turnIndex ?? null, score: overall };
      if (x.scores && typeof x.scores === 'object') {
        const c = calculateLearnerOverallScore(x.scores, multiAgent);
        if (Number.isFinite(c)) return { turnIndex: x.turnIndex ?? null, score: c };
      }
      return null;
    })
    .filter(Boolean);
  if (turns.length < 2) return null;
  turns.sort((a, b) => {
    if (a.turnIndex == null && b.turnIndex == null) return 0;
    if (a.turnIndex == null) return 1;
    if (b.turnIndex == null) return -1;
    return a.turnIndex - b.turnIndex;
  });
  return {
    first: turns[0].score,
    last: turns[turns.length - 1].score,
    delta: turns[turns.length - 1].score - turns[0].score,
  };
}

// ---------------------------------------------------------------------------
// Per-dialogue analysis
// ---------------------------------------------------------------------------
const DISSOCIATION_RECOGNITION_MIN = 0.34; // >= 1/3 of turns perform recognition
const DISSOCIATION_DELTA_MAX = 5; // independent rubric moved < 5 pts (0-100)

function analyzeDialogue(messages, rubric) {
  const turns = messages.map(scoreTurn);
  const n = turns.length;
  const recogTurns = turns.filter((t) => t.recognition).length;
  const recognitionRate = n > 0 ? recogTurns / n : 0;

  let firstRecogIdx = -1;
  for (let i = 0; i < n; i++) {
    if (turns[i].recognition) {
      firstRecogIdx = i;
      break;
    }
  }
  // Normalised position of first recognition (0 = opening turn, 1 = final turn).
  const firstRecognitionPos = firstRecogIdx < 0 ? null : n > 1 ? firstRecogIdx / (n - 1) : 0;

  const recogIdxs = turns.map((t, i) => (t.recognition ? i : -1)).filter((i) => i >= 0);
  const positiveRecog = recogIdxs.filter((i) => !turns[i].residualConfusion).length;
  const valenceUniformity = recogIdxs.length > 0 ? positiveRecog / recogIdxs.length : null;
  const gratitudeCooccurrence =
    recogIdxs.length > 0 ? recogIdxs.filter((i) => turns[i].gratitude).length / recogIdxs.length : null;

  const last = turns[n - 1];
  const endsResolved = Boolean(last && last.recognition && !last.residualConfusion);

  const anyReversal = turns.some((t) => t.reversal);
  let firstReversalPos = null;
  for (let i = 0; i < n; i++) {
    if (turns[i].reversal) {
      firstReversalPos = n > 1 ? i / (n - 1) : 0;
      break;
    }
  }

  // The decisive Hollywood-confound signal: the learner verbally performs
  // recognition while the independent rubric channel barely moves.
  let dissociation = null;
  if (rubric && Number.isFinite(rubric.delta)) {
    dissociation = recognitionRate >= DISSOCIATION_RECOGNITION_MIN && Math.abs(rubric.delta) < DISSOCIATION_DELTA_MAX;
  }

  return {
    turnCount: n,
    recognitionRate,
    firstRecognitionPos,
    valenceUniformity,
    gratitudeCooccurrence,
    endsResolved,
    anyReversal,
    firstReversalPos,
    rubricFirst: rubric?.first ?? null,
    rubricLast: rubric?.last ?? null,
    rubricDelta: rubric?.delta ?? null,
    dissociation,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------
function summarizeGroup(records) {
  if (!records || records.length === 0) return null;
  const pick = (k) => records.map((r) => r[k]).filter((x) => Number.isFinite(x));
  const bools = (k) => records.map((r) => r[k]).filter((x) => typeof x === 'boolean');
  const boolRate = (k) => {
    const b = bools(k);
    return b.length > 0 ? b.filter(Boolean).length / b.length : null;
  };
  const recognitionRates = pick('recognitionRate');
  const rubricDeltas = pick('rubricDelta');
  return {
    n: records.length,
    meanTurns: mean(pick('turnCount')),
    recognitionRate: mean(recognitionRates),
    recognitionRateSd: std(recognitionRates),
    firstRecognitionPos: mean(pick('firstRecognitionPos')),
    valenceUniformity: mean(pick('valenceUniformity')),
    gratitudeCooccurrence: mean(pick('gratitudeCooccurrence')),
    endsResolvedRate: boolRate('endsResolved'),
    reversalRate: boolRate('anyReversal'),
    firstReversalPos: mean(pick('firstReversalPos')),
    rubricDeltaMean: mean(rubricDeltas),
    rubricDeltaSd: std(rubricDeltas),
    dissociationRate: boolRate('dissociation'),
    // If recognition is real, it should track the independent channel; a
    // near-zero correlation is the Hollywood signature.
    recogVsRubricR: pearson(
      records.map((r) => r.recognitionRate),
      records.map((r) => r.rubricDelta),
    ),
  };
}

function printGroup(label, s) {
  if (!s) {
    console.log(`  ${label.padEnd(22)} n=0`);
    return;
  }
  console.log(`  ${label}`);
  console.log(
    `    n=${s.n}  turns=${numFmt(s.meanTurns, 2)}  recogRate=${pctFmt(s.recognitionRate)} (sd=${numFmt(
      s.recognitionRateSd,
      2,
    )})  firstRecogPos=${numFmt(s.firstRecognitionPos, 2)}`,
  );
  console.log(
    `    valenceUniformity=${pctFmt(s.valenceUniformity)}  gratitudeCo=${pctFmt(
      s.gratitudeCooccurrence,
    )}  endsResolved=${pctFmt(s.endsResolvedRate)}  reversalRate=${pctFmt(s.reversalRate)}`,
  );
  console.log(
    `    independent rubric delta (0-100)=${numFmt(s.rubricDeltaMean, 2)} (sd=${numFmt(
      s.rubricDeltaSd,
      2,
    )})  dissociationRate=${pctFmt(s.dissociationRate)}  r(recog,rubricDelta)=${numFmt(s.recogVsRubricR, 3)}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (llmPassRequested) {
  console.log(
    [
      '',
      '--llm-pass is intentionally a disabled stub.',
      "Scoring the architecture's own transcript with another LLM re-imports the",
      "closed-loop confound this probe exists to expose: a synthetic learner's",
      '"recognition" is a trained disposition to perform insight, and an LLM judge',
      'shares that disposition. The drama-machine paper flags its own Table 2 as',
      'exploratory, not evaluative, for exactly this reason. The rule-based',
      'detectors below are deliberately transparent and architecture-independent.',
      '',
    ].join('\n'),
  );
}

const runIds = cli.runIds;
if (runIds.length === 0) {
  console.log('Usage: node scripts/analyze-dramatic-reversal.js <runId> [<runId> ...] [--json out.json] [--limit N]');
  process.exit(0);
}

const { db, dbPath, reason } = openEvaluationDbReadonly(ROOT_DIR, { explicitPath: dbOverride });
if (!db) {
  console.log(describeMissingEvaluationDb(dbPath, reason));
  process.exit(0);
}
const placeholders = runIds.map(() => '?').join(', ');
const fetched = db
  .prepare(
    `
      SELECT id, run_id, scenario_id, profile_name, dialogue_id,
             learner_scores, learner_architecture, conversation_mode
      FROM evaluation_results
      WHERE success = 1
        AND dialogue_id IS NOT NULL
        AND run_id IN (${placeholders})
      ORDER BY created_at
    `,
  )
  .all(...runIds);

const rows = rowLimit != null ? fetched.slice(0, rowLimit) : fetched;
if (rows.length === 0) {
  console.log(`No multi-turn rows found for run(s): ${runIds.join(', ')}`);
  process.exit(0);
}

const logCache = new Map();
let missingLogs = 0;
let tooShort = 0;
let analyzed = 0;

const groups = { superego_present: [], superego_absent: [], superego_unknown: [] };
const perDialogue = [];

for (const row of rows) {
  const log = loadDialogueLog(row.dialogue_id, logCache);
  if (!log) {
    missingLogs++;
    continue;
  }
  const messages = extractLearnerMessages(log);
  if (messages.length < 2) {
    tooShort++;
    continue;
  }
  const rubric = learnerRubricDelta(row, log);
  const sup = detectSuperego(log, row.profile_name);
  const a = analyzeDialogue(messages, rubric);
  analyzed++;

  const rec = {
    runId: row.run_id,
    dialogueId: row.dialogue_id,
    profileName: row.profile_name,
    scenarioId: row.scenario_id,
    superego: sup.present,
    superegoSource: sup.source,
    ...a,
  };
  perDialogue.push(rec);
  if (sup.present === true) groups.superego_present.push(rec);
  else if (sup.present === false) groups.superego_absent.push(rec);
  else groups.superego_unknown.push(rec);
}

const overall = summarizeGroup(perDialogue);
const sPresent = summarizeGroup(groups.superego_present);
const sAbsent = summarizeGroup(groups.superego_absent);
const sUnknown = summarizeGroup(groups.superego_unknown);

console.log('='.repeat(88));
console.log('Dramatic-Reversal / Recognition Probe  (Hollywood-confound detector)');
console.log('='.repeat(88));
console.log(`Runs: ${runIds.join(', ')}`);
console.log(`Mode: ${dryRunMode ? 'dry-run' : 'analysis-only'} (read-only; no DB writes; no LLM calls)`);
if (rowLimit != null) console.log(`Row limit: ${rowLimit} (of ${fetched.length} candidate rows)`);
console.log(
  `Rows: ${rows.length} fetched | analyzed=${analyzed} | missing-logs=${missingLogs} | <2 learner turns=${tooShort}`,
);
console.log(`Logs directory: ${logsDir}`);
console.log(
  `Dissociation rule: recognitionRate >= ${DISSOCIATION_RECOGNITION_MIN} AND |independent rubric delta| < ${DISSOCIATION_DELTA_MAX} pts`,
);
console.log('');
console.log('-'.repeat(88));
console.log('Overall (all analyzed dialogues)');
console.log('-'.repeat(88));
printGroup('overall', overall);
console.log('');
console.log('-'.repeat(88));
console.log('Drama-machine contrast: superego presence (ground-truth from dialogueTrace)');
console.log('-'.repeat(88));
printGroup('superego PRESENT', sPresent);
console.log('');
printGroup('superego ABSENT', sAbsent);
if (sUnknown) {
  console.log('');
  printGroup('superego UNKNOWN', sUnknown);
}
console.log('');
console.log('-'.repeat(88));
console.log('Reading');
console.log('-'.repeat(88));
console.log(
  [
    '  The Hollywood confound shows up as: high recognitionRate + end-clustered',
    '  firstRecognitionPos (-> 1.0) + high valenceUniformity + high endsResolved,',
    '  while the INDEPENDENT rubric delta stays near zero and r(recog,rubricDelta)',
    '  ~ 0. That pattern means the learner-model is performing anagnorisis as a',
    '  trained disposition, decoupled from any measured representational change.',
    '  This is a descriptive process measure converging with paper-full-2.0.md',
    '  §7.9 (slope-proxy / frozen-external-standard) and the drama-machine',
    '  Hollywood-ending caution. It introduces no new empirical claim.',
  ].join('\n'),
);
console.log('');

if (jsonOutPath && !dryRunMode) {
  const payload = {
    runs: runIds,
    generatedAt: new Date().toISOString(),
    probe: 'dramatic-reversal-recognition',
    note: 'Descriptive process measure. No new empirical claim. Converges with paper-full-2.0.md §7.9 and the drama-machine Hollywood-ending caution. LLM pass deliberately disabled (closed-loop tell).',
    dissociationRule: {
      recognitionRateMin: DISSOCIATION_RECOGNITION_MIN,
      rubricDeltaAbsMax: DISSOCIATION_DELTA_MAX,
    },
    counts: { fetched: rows.length, analyzed, missingLogs, tooShort },
    summaries: {
      overall,
      superego_present: sPresent,
      superego_absent: sAbsent,
      superego_unknown: sUnknown,
    },
    perDialogue,
  };
  fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  fs.writeFileSync(jsonOutPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote JSON output: ${jsonOutPath}`);
} else if (jsonOutPath && dryRunMode) {
  console.log(`(dry-run: skipped writing ${jsonOutPath})`);
}
