#!/usr/bin/env node
/**
 * Mine run-level signals behind weak learner improvement in multi-turn dialogues.
 *
 * Focus:
 * - Compare learner/tutor score levels by recognition factor.
 * - Compare first->last learner rubric change (delta/slope) by recognition.
 * - Mine transcript-level markers linked to stagnation vs improvement.
 *
 * Usage:
 *   node scripts/analyze-learning-stagnation.js <runId> [<runId> ...]
 *   node scripts/analyze-learning-stagnation.js --db data/evaluations.db <runId>
 *   node scripts/analyze-learning-stagnation.js <runId> --json exports/stagnation.json
 *   node scripts/analyze-learning-stagnation.js <runId> --strict
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const KNOWN_VALUE_OPTIONS = new Set([
  'db',
  'logs',
  'metric-version',
  'json',
  'strict-min-rows',
  'strict-min-recognition-n',
  'strict-max-missing-logs-rate',
  'strict-min-rubric-coverage-rate',
  'strict-min-learner-delta-mean',
  'strict-max-nonpos-rate',
  'strict-max-learner-tutor-effect-gap',
  'strict-min-recognition-learner-turn-diff',
  'strict-min-recognition-learner-holistic-diff',
]);
const KNOWN_FLAG_OPTIONS = new Set(['strict', 'color', 'no-color']);

function parseCli(rawArgs) {
  const options = {};
  const flags = {};
  const positionals = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const token = rawArgs[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eq = token.indexOf('=');
    const hasEq = eq >= 0;
    const key = token.slice(2, hasEq ? eq : undefined);
    const inlineValue = hasEq ? token.slice(eq + 1) : null;

    if (KNOWN_FLAG_OPTIONS.has(key)) {
      flags[key] = inlineValue == null ? true : !['0', 'false', 'no'].includes(String(inlineValue).toLowerCase());
      continue;
    }

    if (KNOWN_VALUE_OPTIONS.has(key)) {
      if (inlineValue != null) {
        options[key] = inlineValue;
        continue;
      }
      const next = rawArgs[i + 1];
      if (next != null && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = null;
      }
      continue;
    }

    // Unknown options are ignored for forward compatibility.
    if (!hasEq) {
      const next = rawArgs[i + 1];
      if (next != null && !next.startsWith('--')) i++;
    }
  }
  return { options, flags, positionals };
}

const cli = parseCli(process.argv.slice(2));
const runIdsFromArgs = cli.positionals;

function getOption(name, defaultValue = null) {
  const v = cli.options[name];
  return v == null ? defaultValue : v;
}

function getNumberOption(name, defaultValue) {
  const raw = getOption(name, null);
  if (raw == null || raw === '') return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function getFlag(name, defaultValue = false) {
  if (name in cli.flags) return Boolean(cli.flags[name]);
  return defaultValue;
}

const dbPath = getOption('db', process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db'));
const logsDir = getOption('logs', path.join(ROOT_DIR, 'logs', 'tutor-dialogues'));
const metricVersion = getOption('metric-version', 'within-test-v2-aligned-proxy');
const jsonOutPath = getOption('json');
const strictMode = getFlag('strict', false);

const strictCfg = {
  minRows: getNumberOption('strict-min-rows', 20),
  minRecognitionN: getNumberOption('strict-min-recognition-n', 8),
  maxMissingLogsRate: getNumberOption('strict-max-missing-logs-rate', 0.05),
  minRubricCoverageRate: getNumberOption('strict-min-rubric-coverage-rate', 0.95),
  minLearnerDeltaMean: getNumberOption('strict-min-learner-delta-mean', 0.0),
  maxNonPosRate: getNumberOption('strict-max-nonpos-rate', 0.6),
  maxLearnerTutorEffectGap: getNumberOption('strict-max-learner-tutor-effect-gap', 18.0),
  minRecognitionLearnerTurnDiff: getNumberOption('strict-min-recognition-learner-turn-diff', -2.5),
  minRecognitionLearnerHolisticDiff: getNumberOption('strict-min-recognition-learner-holistic-diff', -5.0),
};

const enableColor = getFlag('no-color', false)
  ? false
  : getFlag('color', false)
    ? true
    : Boolean(process.stdout?.isTTY);

const COLOR = {
  reset: enableColor ? '\x1b[0m' : '',
  red: enableColor ? '\x1b[31m' : '',
  green: enableColor ? '\x1b[32m' : '',
  yellow: enableColor ? '\x1b[33m' : '',
  cyan: enableColor ? '\x1b[36m' : '',
};

function colorize(text, c) {
  return `${COLOR[c] || ''}${text}${COLOR.reset}`;
}

const db = new Database(dbPath, { readonly: true });

function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function safeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function numFmt(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v.toFixed(digits);
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

function resolveRunIds() {
  if (runIdsFromArgs.length > 0) return runIdsFromArgs;
  const latest = db
    .prepare(
      `
      SELECT run_id, MAX(created_at) AS latest_at
      FROM evaluation_results
      WHERE success = 1 AND dialogue_id IS NOT NULL
      GROUP BY run_id
      ORDER BY latest_at DESC
      LIMIT 1
    `,
    )
    .get();
  if (!latest?.run_id) return [];
  return [latest.run_id];
}

function computeSlopePerTurn(seq) {
  if (!Array.isArray(seq) || seq.length < 2) return null;
  const n = seq.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(seq);
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    cov += dx * (seq[i] - meanY);
    varX += dx * dx;
  }
  if (varX === 0) return null;
  return cov / varX;
}

function computeLearnerRubricTrajectoryFromScores(learnerScoresJson) {
  const parsed = parseJson(learnerScoresJson, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const turns = Object.values(parsed)
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const overall = safeNumber(x.overallScore);
      if (overall == null) return null;
      return { turnIndex: safeNumber(x.turnIndex), score: overall };
    })
    .filter(Boolean);
  if (turns.length < 2) return null;
  turns.sort((a, b) => {
    if (a.turnIndex == null && b.turnIndex == null) return 0;
    if (a.turnIndex == null) return 1;
    if (b.turnIndex == null) return -1;
    return a.turnIndex - b.turnIndex;
  });
  const seq = turns.map((x) => x.score).filter((x) => x != null);
  return seq.length >= 2 ? seq : null;
}

function computeTrajectoryMetrics(seq) {
  if (!Array.isArray(seq) || seq.length < 2) return null;
  const values = seq.map((x) => safeNumber(x)).filter((x) => x != null);
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const slope = computeSlopePerTurn(values);
  return { turnCount: values.length, first, last, delta, slope };
}

function getLearnerRubricMetricsByDialogue(runIds) {
  const placeholders = runIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `
      SELECT run_id, dialogue_id, first_score, last_score, delta_pts, slope_per_turn
      FROM within_test_change_metrics
      WHERE metric_version = ?
        AND method = 'rubric'
        AND side = 'learner'
        AND run_id IN (${placeholders})
    `,
    )
    .all(metricVersion, ...runIds);

  const map = new Map();
  for (const row of rows) {
    map.set(`${row.run_id}::${row.dialogue_id}`, {
      first: safeNumber(row.first_score),
      last: safeNumber(row.last_score),
      delta: safeNumber(row.delta_pts),
      slope: safeNumber(row.slope_per_turn),
    });
  }
  return map;
}

function tokenize(text) {
  const stop = new Set([
    'the',
    'and',
    'for',
    'that',
    'this',
    'with',
    'from',
    'have',
    'what',
    'your',
    'you',
    'are',
    'was',
    'but',
    'not',
    'can',
    'all',
    'our',
    'out',
    'just',
    'into',
    'its',
    'now',
    'then',
    'when',
    'how',
    'why',
    'about',
    'too',
    'did',
    'does',
    'had',
    'has',
    'his',
    'her',
    'she',
    'him',
    'who',
    'whom',
    'their',
    'there',
    'they',
    'them',
    'would',
    'could',
    'should',
    'been',
    'being',
    'were',
    'because',
    'while',
    'where',
    'than',
    'also',
    'will',
    'shall',
    'very',
    'more',
    'some',
    'such',
    'each',
    'any',
  ]);
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !stop.has(w));
}

function jaccard(tokensA, tokensB) {
  const a = new Set(tokensA || []);
  const b = new Set(tokensB || []);
  if (a.size === 0 && b.size === 0) return null;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : null;
}

function extractLearnerTurnMaps(log) {
  const trace = Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [];
  const byIdxSynth = new Map();
  const byIdxUserCtx = new Map();
  const byIdxUserDetail = new Map();

  for (const e of trace) {
    if (e?.agent === 'learner_synthesis' && e?.action === 'response' && Number.isFinite(e?.turnIndex)) {
      const txt = String(e?.detail || e?.contextSummary || e?.message || '').trim();
      byIdxSynth.set(e.turnIndex, txt);
    }
  }
  for (const e of trace) {
    if (e?.agent === 'user' && e?.action === 'turn_action' && Number.isFinite(e?.turnIndex)) {
      const ctx = String(e?.contextSummary || e?.message || '').trim();
      const detail = String(e?.detail || '').trim();
      byIdxUserCtx.set(e.turnIndex, ctx);
      byIdxUserDetail.set(e.turnIndex, detail);
    }
  }
  return { byIdxSynth, byIdxUserCtx, byIdxUserDetail };
}

function extractTutorByTurn(log) {
  const byTurn = new Map();
  const turnResults = Array.isArray(log?.turnResults) ? log.turnResults : [];
  for (let i = 0; i < turnResults.length; i++) {
    const tr = turnResults[i];
    const idx = Number.isFinite(tr?.turnIndex) ? tr.turnIndex : i;
    const s = tr?.suggestions?.[0];
    const text = String(typeof s === 'string' ? s : s?.message || s?.text || s?.detail || '').trim();
    if (text) byTurn.set(idx, text);
  }
  return byTurn;
}

const REGEX = {
  help: [/\brecap\b/i, /\bexample\b/i, /\bexplain\b/i, /\bstuck\b/i, /\bconfus/i, /\bcan you\b/i, /\bhelp\b/i, /\btell me\b/i],
  reflect: [/\bi see\b/i, /\bi realize\b/i, /\bi was\b/i, /\bactually\b/i, /\bwait\b/i, /\bon second thought\b/i, /\bmaybe\b/i],
  commit: [/\bi will\b/i, /\bi'll\b/i, /\bnext i\b/i, /\btherefore\b/i, /\bi can now\b/i, /\bi understand\b/i, /\bso i should\b/i],
  gratitude: [/\bthank/i, /\bglad/i, /\bappreciate/i, /\bgrateful/i, /\bfeel seen/i],
  tutorAbstract: [/\bdialectic/i, /\bparadox/i, /\brecognition/i, /\bnegation/i, /\bcontradiction/i, /\bmediation/i, /\buniversal/i, /\bparticular/i, /\bsynthesis/i],
  tutorConcrete: [/\bfor example\b/i, /\bexample\b/i, /\bstep\b/i, /\bnext\b/i, /\btry this\b/i, /\bspecific\b/i, /\bdo this\b/i, /\bone sentence\b/i],
};

function countRegexHits(text, list) {
  return list.reduce((s, re) => s + (re.test(text) ? 1 : 0), 0);
}

function extractTranscriptFeatures(log) {
  const learnerMaps = extractLearnerTurnMaps(log);
  const tutorByTurn = extractTutorByTurn(log);

  const turnIndices = [...new Set([...learnerMaps.byIdxSynth.keys(), ...learnerMaps.byIdxUserCtx.keys()])].sort((a, b) => a - b);
  const learnerTurns = turnIndices.map((idx) => {
    const synth = learnerMaps.byIdxSynth.get(idx);
    const ctx = learnerMaps.byIdxUserCtx.get(idx);
    return {
      turnIndex: idx,
      text: synth && synth.length > 0 ? synth : ctx || '',
      synthText: synth || '',
      userDetail: learnerMaps.byIdxUserDetail.get(idx) || '',
      source: synth && synth.length > 0 ? 'synth' : 'user',
    };
  });

  const learnerTexts = learnerTurns.map((t) => t.text).filter((t) => t && t.length > 0);
  const learnerTokenTurns = learnerTexts.map((t) => tokenize(t));
  const tutorTextsAligned = turnIndices.map((idx) => tutorByTurn.get(idx) || '').filter((t) => t.length > 0);

  const learnerWordCounts = learnerTokenTurns.map((x) => x.length);
  const learnerQuestions = learnerTexts.map((t) => (t.match(/\?/g) || []).length);
  const tutorQuestions = tutorTextsAligned.map((t) => (t.match(/\?/g) || []).length);

  const overlaps = turnIndices
    .map((idx) => {
      const tutorText = tutorByTurn.get(idx);
      const learnerTurn = learnerTurns.find((x) => x.turnIndex === idx);
      if (!tutorText || !learnerTurn?.text) return null;
      return jaccard(tokenize(tutorText), tokenize(learnerTurn.text));
    })
    .filter((x) => x != null);

  const adjacentSims = [];
  for (let i = 1; i < learnerTokenTurns.length; i++) {
    const sim = jaccard(learnerTokenTurns[i - 1], learnerTokenTurns[i]);
    if (sim != null) adjacentSims.push(sim);
  }

  const learnerConcat = learnerTexts.join('\n');
  const tutorConcat = [...tutorByTurn.values()].join('\n');
  const learnerAllTokens = tokenize(learnerConcat);
  const learnerUnique = new Set(learnerAllTokens).size;

  const lastTurn = learnerTurns.length > 0 ? learnerTurns[learnerTurns.length - 1] : null;
  const lastSynthBlank = lastTurn ? lastTurn.synthText.trim().length === 0 : false;
  const lastUserPlaceholder = lastTurn ? /^Learner:\s*[a-z_]+$/i.test(lastTurn.userDetail) : false;

  return {
    hasTranscript: learnerTurns.length > 0 || tutorByTurn.size > 0,
    turnCount: learnerTurns.length,
    learnerWordsPerTurn: learnerWordCounts.length > 0 ? mean(learnerWordCounts) : null,
    tutorWordsPerTurn: tutorTextsAligned.length > 0 ? mean(tutorTextsAligned.map((t) => tokenize(t).length)) : null,
    learnerQuestionsPerTurn: learnerQuestions.length > 0 ? mean(learnerQuestions) : null,
    tutorQuestionsPerTurn: tutorQuestions.length > 0 ? mean(tutorQuestions) : null,
    tutorLearnerOverlap: overlaps.length > 0 ? mean(overlaps) : null,
    learnerAdjacentSimilarity: adjacentSims.length > 0 ? mean(adjacentSims) : null,
    learnerFirstLastSimilarity:
      learnerTokenTurns.length >= 2 ? jaccard(learnerTokenTurns[0], learnerTokenTurns[learnerTokenTurns.length - 1]) : null,
    learnerTypeTokenRatio: learnerAllTokens.length > 0 ? learnerUnique / learnerAllTokens.length : null,
    learnerTotalTokens: learnerAllTokens.length,
    learnerUniqueTokens: learnerUnique,
    helpMarkers: countRegexHits(learnerConcat, REGEX.help),
    reflectMarkers: countRegexHits(learnerConcat, REGEX.reflect),
    commitMarkers: countRegexHits(learnerConcat, REGEX.commit),
    gratitudeMarkers: countRegexHits(learnerConcat, REGEX.gratitude),
    tutorAbstractMarkers: countRegexHits(tutorConcat, REGEX.tutorAbstract),
    tutorConcreteMarkers: countRegexHits(tutorConcat, REGEX.tutorConcrete),
    lastSynthBlankAndUserPlaceholder: lastSynthBlank && lastUserPlaceholder,
  };
}

function welchT(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = std(a) ** 2;
  const vb = std(b) ** 2;
  const se2 = va / a.length + vb / b.length;
  if (se2 <= 0) return null;
  const t = (ma - mb) / Math.sqrt(se2);
  const dfNumer = se2 ** 2;
  const dfDenom = (va ** 2) / (a.length ** 2 * (a.length - 1)) + (vb ** 2) / (b.length ** 2 * (b.length - 1));
  const df = dfDenom > 0 ? dfNumer / dfDenom : null;
  return { ma, mb, diff: ma - mb, t, df };
}

function cohenD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = std(a) ** 2;
  const vb = std(b) ** 2;
  const pooledNumer = (a.length - 1) * va + (b.length - 1) * vb;
  const pooledDenom = a.length + b.length - 2;
  if (pooledDenom <= 0) return null;
  const sp = Math.sqrt(pooledNumer / pooledDenom);
  if (sp === 0) return 0;
  return (ma - mb) / sp;
}

function corr(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    const ux = x - mx;
    const vy = y - my;
    num += ux * vy;
    dx += ux * ux;
    dy += vy * vy;
  }
  if (dx === 0 || dy === 0) return null;
  return { n: pairs.length, r: num / Math.sqrt(dx * dy) };
}

function summarize(records, metricKeys) {
  const out = { n: records.length };
  for (const key of metricKeys) {
    const vals = records.map((r) => r[key]).filter((x) => Number.isFinite(x));
    out[key] = vals.length > 0 ? mean(vals) : null;
  }
  return out;
}

function printSummaryTable(title, rows, cols) {
  console.log(title);
  const header = ['group', 'n', ...cols];
  console.log(`  ${header.join(' | ')}`);
  for (const row of rows) {
    const parts = [row.group, String(row.n)];
    for (const c of cols) {
      const v = row[c];
      if (c.endsWith('Rate')) parts.push(pctFmt(v));
      else parts.push(numFmt(v, 2));
    }
    console.log(`  ${parts.join(' | ')}`);
  }
  console.log('');
}

const runIds = resolveRunIds();
if (runIds.length === 0) {
  console.error('No multi-turn runs found.');
  process.exit(1);
}

const placeholders = runIds.map(() => '?').join(', ');
const sourceRows = db
  .prepare(
    `
      SELECT
        id,
        run_id,
        scenario_id,
        profile_name,
        model,
        dialogue_id,
        factor_recognition,
        learner_scores,
        learner_overall_score,
        learner_holistic_overall_score,
        tutor_first_turn_score
      FROM evaluation_results
      WHERE success = 1
        AND dialogue_id IS NOT NULL
        AND run_id IN (${placeholders})
      ORDER BY created_at
    `,
  )
  .all(...runIds);

if (sourceRows.length === 0) {
  console.error(`No multi-turn rows found for run(s): ${runIds.join(', ')}`);
  process.exit(1);
}

const storedMetrics = getLearnerRubricMetricsByDialogue(runIds);
const records = [];
let missingLogs = 0;
let metricFromStore = 0;
let metricFromFallback = 0;

for (const row of sourceRows) {
  const key = `${row.run_id}::${row.dialogue_id}`;
  let rubricMetrics = storedMetrics.get(key) || null;
  if (rubricMetrics) {
    metricFromStore++;
  } else {
    const fallbackSeq = computeLearnerRubricTrajectoryFromScores(row.learner_scores);
    const fallbackMetrics = computeTrajectoryMetrics(fallbackSeq);
    if (fallbackMetrics) {
      rubricMetrics = {
        first: fallbackMetrics.first,
        last: fallbackMetrics.last,
        delta: fallbackMetrics.delta,
        slope: fallbackMetrics.slope,
      };
      metricFromFallback++;
    }
  }

  const logPath = path.join(logsDir, `${row.dialogue_id}.json`);
  let transcript = { hasTranscript: false };
  if (!fs.existsSync(logPath)) {
    missingLogs++;
  } else {
    try {
      const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      transcript = extractTranscriptFeatures(log);
    } catch {
      missingLogs++;
    }
  }

  records.push({
    runId: row.run_id,
    scenarioId: row.scenario_id,
    profileName: row.profile_name,
    dialogueId: row.dialogue_id,
    model: row.model,
    recognition: row.factor_recognition == null ? null : Number(row.factor_recognition),
    learnerTurnScore: safeNumber(row.learner_overall_score),
    learnerHolisticScore: safeNumber(row.learner_holistic_overall_score),
    tutorScore: safeNumber(row.tutor_first_turn_score),
    learnerRubricFirst: rubricMetrics?.first ?? null,
    learnerRubricLast: rubricMetrics?.last ?? null,
    learnerRubricDelta: rubricMetrics?.delta ?? null,
    learnerRubricSlope: rubricMetrics?.slope ?? null,
    ...transcript,
  });
}

const rec0 = records.filter((r) => r.recognition === 0);
const rec1 = records.filter((r) => r.recognition === 1);
const deltaPos = records.filter((r) => Number.isFinite(r.learnerRubricDelta) && r.learnerRubricDelta > 0);
const deltaNonPos = records.filter((r) => Number.isFinite(r.learnerRubricDelta) && r.learnerRubricDelta <= 0);

const runSummaries = [];
for (const runId of runIds) {
  const rr = records.filter((r) => r.runId === runId);
  const r0 = rr.filter((r) => r.recognition === 0);
  const r1 = rr.filter((r) => r.recognition === 1);
  const r0Delta = r0.map((r) => r.learnerRubricDelta).filter((x) => Number.isFinite(x));
  const r1Delta = r1.map((r) => r.learnerRubricDelta).filter((x) => Number.isFinite(x));
  runSummaries.push({
    runId,
    n: rr.length,
    model: rr.find((x) => x.model)?.model || null,
    learnerTurnBase: mean(r0.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x))),
    learnerTurnRecog: mean(r1.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x))),
    learnerHolBase: mean(r0.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x))),
    learnerHolRecog: mean(r1.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x))),
    tutorBase: mean(r0.map((r) => r.tutorScore).filter((x) => Number.isFinite(x))),
    tutorRecog: mean(r1.map((r) => r.tutorScore).filter((x) => Number.isFinite(x))),
    deltaBase: mean(r0Delta),
    deltaRecog: mean(r1Delta),
    nonPosRateBase: r0Delta.length > 0 ? r0Delta.filter((x) => x <= 0).length / r0Delta.length : null,
    nonPosRateRecog: r1Delta.length > 0 ? r1Delta.filter((x) => x <= 0).length / r1Delta.length : null,
  });
}

const learnerTurnWelch = welchT(
  rec1.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x)),
  rec0.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x)),
);
const learnerHolWelch = welchT(
  rec1.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x)),
  rec0.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x)),
);
const tutorWelch = welchT(
  rec1.map((r) => r.tutorScore).filter((x) => Number.isFinite(x)),
  rec0.map((r) => r.tutorScore).filter((x) => Number.isFinite(x)),
);

const featureKeys = [
  'turnCount',
  'learnerWordsPerTurn',
  'learnerQuestionsPerTurn',
  'tutorQuestionsPerTurn',
  'tutorLearnerOverlap',
  'learnerAdjacentSimilarity',
  'learnerFirstLastSimilarity',
  'learnerTypeTokenRatio',
  'helpMarkers',
  'reflectMarkers',
  'commitMarkers',
  'gratitudeMarkers',
  'tutorAbstractMarkers',
  'tutorConcreteMarkers',
];

const stagnationByDelta = [
  { group: 'delta>0', ...summarize(deltaPos, featureKeys) },
  { group: 'delta<=0', ...summarize(deltaNonPos, featureKeys) },
];
const stagnationByRecognition = [
  { group: 'recog=0', ...summarize(rec0, featureKeys) },
  { group: 'recog=1', ...summarize(rec1, featureKeys) },
];

const deltaValues = records.map((r) => r.learnerRubricDelta);
const corrs = featureKeys
  .map((key) => ({ feature: key, ...corr(records.map((r) => r[key]), deltaValues) }))
  .filter((x) => Number.isFinite(x?.r))
  .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

const tailFailureStats = (() => {
  const flagged = records.filter((r) => r.lastSynthBlankAndUserPlaceholder);
  const unflagged = records.filter((r) => !r.lastSynthBlankAndUserPlaceholder);
  const summarizeFlag = (arr) => {
    const deltas = arr.map((x) => x.learnerRubricDelta).filter((x) => Number.isFinite(x));
    return {
      n: arr.length,
      deltaMean: mean(deltas),
      nonPosRate: deltas.length > 0 ? deltas.filter((x) => x <= 0).length / deltas.length : null,
      holMean: mean(arr.map((x) => x.learnerHolisticScore).filter((x) => Number.isFinite(x))),
    };
  };
  return { flagged: summarizeFlag(flagged), unflagged: summarizeFlag(unflagged) };
})();

const worst = [...records]
  .filter((r) => Number.isFinite(r.learnerRubricDelta))
  .sort((a, b) => a.learnerRubricDelta - b.learnerRubricDelta)
  .slice(0, 8)
  .map((r) => ({
    runId: r.runId,
    scenarioId: r.scenarioId,
    profileName: r.profileName,
    delta: r.learnerRubricDelta,
    learnerTurn: r.learnerTurnScore,
    learnerHol: r.learnerHolisticScore,
    tutor: r.tutorScore,
    gratitude: r.gratitudeMarkers,
    overlap: r.tutorLearnerOverlap,
  }));

const best = [...records]
  .filter((r) => Number.isFinite(r.learnerRubricDelta))
  .sort((a, b) => b.learnerRubricDelta - a.learnerRubricDelta)
  .slice(0, 8)
  .map((r) => ({
    runId: r.runId,
    scenarioId: r.scenarioId,
    profileName: r.profileName,
    delta: r.learnerRubricDelta,
    learnerTurn: r.learnerTurnScore,
    learnerHol: r.learnerHolisticScore,
    tutor: r.tutorScore,
    gratitude: r.gratitudeMarkers,
    overlap: r.tutorLearnerOverlap,
  }));

console.log('='.repeat(92));
console.log('Learning Stagnation Analysis');
console.log('='.repeat(92));
console.log(`Runs: ${runIds.join(', ')}`);
console.log(`Rows: ${records.length}`);
console.log(`Metric version: ${metricVersion}`);
console.log(`Logs dir: ${logsDir}`);
console.log(`Missing logs: ${missingLogs}`);
console.log(`Learner rubric metrics: stored=${metricFromStore}, fallback=${metricFromFallback}`);
console.log('');

console.log('Per-run headline');
console.log('  run_id | n | model | learner_turn(base->recog) | learner_hol(base->recog) | tutor(base->recog) | delta(base->recog) | nonpos(base->recog)');
for (const s of runSummaries) {
  console.log(
    `  ${s.runId} | ${s.n} | ${s.model || 'n/a'} | ${numFmt(s.learnerTurnBase, 1)} -> ${numFmt(s.learnerTurnRecog, 1)} | ${numFmt(s.learnerHolBase, 1)} -> ${numFmt(s.learnerHolRecog, 1)} | ${numFmt(s.tutorBase, 1)} -> ${numFmt(s.tutorRecog, 1)} | ${numFmt(s.deltaBase, 1)} -> ${numFmt(s.deltaRecog, 1)} | ${pctFmt(s.nonPosRateBase)} -> ${pctFmt(s.nonPosRateRecog)}`,
  );
}
console.log('');

console.log('Recognition effects (recog - base)');
const effectRows = [
  {
    label: 'Learner turn score',
    welch: learnerTurnWelch,
    d: cohenD(
      rec1.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x)),
      rec0.map((r) => r.learnerTurnScore).filter((x) => Number.isFinite(x)),
    ),
  },
  {
    label: 'Learner holistic score',
    welch: learnerHolWelch,
    d: cohenD(
      rec1.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x)),
      rec0.map((r) => r.learnerHolisticScore).filter((x) => Number.isFinite(x)),
    ),
  },
  {
    label: 'Tutor score',
    welch: tutorWelch,
    d: cohenD(
      rec1.map((r) => r.tutorScore).filter((x) => Number.isFinite(x)),
      rec0.map((r) => r.tutorScore).filter((x) => Number.isFinite(x)),
    ),
  },
];

const learnerDeltaValsAll = records.map((r) => r.learnerRubricDelta).filter((x) => Number.isFinite(x));
const learnerDeltaMean = mean(learnerDeltaValsAll);
const learnerNonPosRate =
  learnerDeltaValsAll.length > 0 ? learnerDeltaValsAll.filter((x) => x <= 0).length / learnerDeltaValsAll.length : null;
const missingLogsRate = records.length > 0 ? missingLogs / records.length : 1;
const rubricCoverageRate = records.length > 0 ? (metricFromStore + metricFromFallback) / records.length : 0;
const learnerTurnRecognitionDiff = learnerTurnWelch?.diff ?? null;
const learnerHolRecognitionDiff = learnerHolWelch?.diff ?? null;
const tutorRecognitionDiff = tutorWelch?.diff ?? null;
const learnerRecognitionSignalCandidates = [learnerTurnRecognitionDiff, learnerHolRecognitionDiff].filter((x) =>
  Number.isFinite(x),
);
const learnerRecognitionSignal =
  learnerRecognitionSignalCandidates.length > 0 ? Math.max(...learnerRecognitionSignalCandidates) : null;
const learnerTutorEffectGap =
  Number.isFinite(tutorRecognitionDiff) && Number.isFinite(learnerRecognitionSignal)
    ? tutorRecognitionDiff - learnerRecognitionSignal
    : null;

function buildStrictChecks() {
  return [
    {
      id: 'rows',
      label: 'Minimum evaluated rows',
      pass: records.length >= strictCfg.minRows,
      observed: records.length,
      expected: `>= ${strictCfg.minRows}`,
      fix: 'Include more scored multi-turn dialogues before using this analysis to update claims.',
    },
    {
      id: 'recognition-split',
      label: 'Recognition split sample size',
      pass: rec0.length >= strictCfg.minRecognitionN && rec1.length >= strictCfg.minRecognitionN,
      observed: `base=${rec0.length}, recog=${rec1.length}`,
      expected: `each >= ${strictCfg.minRecognitionN}`,
      fix: 'Re-run missing recognition/base cells or filter to a balanced subset before comparison.',
    },
    {
      id: 'missing-logs',
      label: 'Transcript log coverage',
      pass: missingLogsRate <= strictCfg.maxMissingLogsRate,
      observed: pctFmt(missingLogsRate),
      expected: `<= ${pctFmt(strictCfg.maxMissingLogsRate)}`,
      fix: 'Regenerate missing dialogue logs so transcript-derived diagnostics are complete.',
    },
    {
      id: 'rubric-coverage',
      label: 'Learner rubric trajectory coverage',
      pass: rubricCoverageRate >= strictCfg.minRubricCoverageRate,
      observed: pctFmt(rubricCoverageRate),
      expected: `>= ${pctFmt(strictCfg.minRubricCoverageRate)}`,
      fix: 'Backfill learner scoring and within-test metrics, then re-run this analysis.',
    },
    {
      id: 'learner-delta-mean',
      label: 'Mean learner first-to-last delta',
      pass: Number.isFinite(learnerDeltaMean) && learnerDeltaMean >= strictCfg.minLearnerDeltaMean,
      observed: numFmt(learnerDeltaMean, 2),
      expected: `>= ${numFmt(strictCfg.minLearnerDeltaMean, 2)}`,
      fix: 'Inspect prompts/transcripts with worst deltas and tighten learner guidance to force revision signals.',
    },
    {
      id: 'learner-nonpos-rate',
      label: 'Non-positive learner delta rate',
      pass: Number.isFinite(learnerNonPosRate) && learnerNonPosRate <= strictCfg.maxNonPosRate,
      observed: pctFmt(learnerNonPosRate),
      expected: `<= ${pctFmt(strictCfg.maxNonPosRate)}`,
      fix: 'Audit high-stagnation scenarios and add targeted interventions for late-turn learner adaptation.',
    },
    {
      id: 'learner-turn-effect',
      label: 'Recognition effect (learner turn score)',
      pass:
        Number.isFinite(learnerTurnRecognitionDiff) &&
        learnerTurnRecognitionDiff >= strictCfg.minRecognitionLearnerTurnDiff,
      observed: numFmt(learnerTurnRecognitionDiff, 2),
      expected: `>= ${numFmt(strictCfg.minRecognitionLearnerTurnDiff, 2)}`,
      fix: 'Re-check learner rubric prompt drift and evaluate whether recognition prompts are overfitting tutor quality.',
    },
    {
      id: 'learner-holistic-effect',
      label: 'Recognition effect (learner holistic score)',
      pass:
        Number.isFinite(learnerHolRecognitionDiff) &&
        learnerHolRecognitionDiff >= strictCfg.minRecognitionLearnerHolisticDiff,
      observed: numFmt(learnerHolRecognitionDiff, 2),
      expected: `>= ${numFmt(strictCfg.minRecognitionLearnerHolisticDiff, 2)}`,
      fix: 'Re-run holistic judging prompts and compare rater drift against prior stable runs.',
    },
    {
      id: 'learner-vs-tutor-gap',
      label: 'Tutor-vs-learner recognition effect gap',
      pass:
        Number.isFinite(learnerTutorEffectGap) && learnerTutorEffectGap <= strictCfg.maxLearnerTutorEffectGap,
      observed: numFmt(learnerTutorEffectGap, 2),
      expected: `<= ${numFmt(strictCfg.maxLearnerTutorEffectGap, 2)}`,
      fix: 'Treat tutor-side gains as separate from learner gains; revisit mechanisms that improve tutor polish without learner change.',
    },
  ];
}

const strictChecks = buildStrictChecks();
const strictFailures = strictChecks.filter((c) => !c.pass);
for (const e of effectRows) {
  if (!e.welch) {
    console.log(`  ${e.label}: insufficient data`);
    continue;
  }
  console.log(
    `  ${e.label}: diff=${numFmt(e.welch.diff, 2)} (recog=${numFmt(e.welch.ma, 2)}, base=${numFmt(e.welch.mb, 2)}), t=${numFmt(e.welch.t, 2)}, df=${numFmt(e.welch.df, 1)}, d=${numFmt(e.d, 2)}`,
  );
}
console.log('');

if (strictMode) {
  console.log(colorize('Strict regression gate', 'cyan'));
  for (const c of strictChecks) {
    const tag = c.pass ? colorize('PASS', 'green') : colorize('FAIL', 'red');
    console.log(`  [${tag}] ${c.label}: observed=${c.observed} expected=${c.expected}`);
  }
  if (strictFailures.length > 0) {
    console.log(colorize('  Failure remediation:', 'yellow'));
    for (const f of strictFailures) {
      console.log(`  - ${f.id}: ${f.fix}`);
    }
  }
  console.log('');
}

printSummaryTable('Transcript feature means by learner delta sign', stagnationByDelta, featureKeys);
printSummaryTable('Transcript feature means by recognition factor', stagnationByRecognition, featureKeys);

console.log('Correlations with learner rubric delta (top by |r|)');
for (const c of corrs.slice(0, 10)) {
  console.log(`  ${c.feature}: r=${numFmt(c.r, 3)} (n=${c.n})`);
}
console.log('');

console.log('Tail failure marker (last synth blank + user placeholder)');
console.log(
  `  flagged: n=${tailFailureStats.flagged.n}, delta=${numFmt(tailFailureStats.flagged.deltaMean, 2)}, nonpos=${pctFmt(tailFailureStats.flagged.nonPosRate)}, hol=${numFmt(tailFailureStats.flagged.holMean, 1)}`,
);
console.log(
  `  other:   n=${tailFailureStats.unflagged.n}, delta=${numFmt(tailFailureStats.unflagged.deltaMean, 2)}, nonpos=${pctFmt(tailFailureStats.unflagged.nonPosRate)}, hol=${numFmt(tailFailureStats.unflagged.holMean, 1)}`,
);
console.log('');

console.log('Worst learner deltas');
for (const w of worst) {
  console.log(
    `  ${w.runId} | ${w.scenarioId} | ${w.profileName} | delta=${numFmt(w.delta, 1)} | learner(turn=${numFmt(w.learnerTurn, 1)}, hol=${numFmt(w.learnerHol, 1)}) | tutor=${numFmt(w.tutor, 1)} | gratitude=${w.gratitude} | overlap=${numFmt(w.overlap, 3)}`,
  );
}
console.log('');

console.log('Best learner deltas');
for (const b of best) {
  console.log(
    `  ${b.runId} | ${b.scenarioId} | ${b.profileName} | delta=${numFmt(b.delta, 1)} | learner(turn=${numFmt(b.learnerTurn, 1)}, hol=${numFmt(b.learnerHol, 1)}) | tutor=${numFmt(b.tutor, 1)} | gratitude=${b.gratitude} | overlap=${numFmt(b.overlap, 3)}`,
  );
}
console.log('');

if (jsonOutPath) {
  const payload = {
    generatedAt: new Date().toISOString(),
    runs: runIds,
    metricVersion,
    coverage: {
      rows: records.length,
      missingLogs,
      metricFromStore,
      metricFromFallback,
    },
    runSummaries,
    recognitionEffects: effectRows.map((e) => ({
      label: e.label,
      diff: e.welch?.diff ?? null,
      t: e.welch?.t ?? null,
      df: e.welch?.df ?? null,
      cohenD: e.d,
    })),
    strictGate: {
      enabled: strictMode,
      config: strictCfg,
      checks: strictChecks,
      failedCheckIds: strictFailures.map((x) => x.id),
      passed: strictFailures.length === 0,
    },
    featureMeansByDelta: stagnationByDelta,
    featureMeansByRecognition: stagnationByRecognition,
    correlations: corrs,
    tailFailureStats,
    worst,
    best,
  };
  fs.writeFileSync(jsonOutPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote JSON output: ${jsonOutPath}`);
}

if (strictMode && strictFailures.length > 0) {
  process.exit(2);
}
