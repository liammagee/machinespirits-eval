#!/usr/bin/env node
/**
 * Analyze tutor adaptation in poetics sidecar artifacts.
 *
 * This is deliberately separate from the main evaluation harness. It asks a
 * narrow question the 3-way poetics form score does not answer: after a learner
 * visibly re-frames an earlier utterance, does the next tutor turn take up that
 * revised framing, or is the recognitive work only in the learner line?
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore, upsertPoeticsTutorAdaptation } from '../services/poeticsStore.js';
import { reframeMatchStats } from './generate-pedagogical-dramas.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ANALYZER_VERSION = 'tutor-adaptation-v1';

const STOPWORDS = new Set(
  [
    'about',
    'after',
    'again',
    'also',
    'and',
    'are',
    'because',
    'been',
    'before',
    'being',
    'but',
    'can',
    'could',
    'does',
    'for',
    'from',
    'had',
    'has',
    'have',
    'here',
    'how',
    'into',
    'its',
    'just',
    'like',
    'more',
    'must',
    'not',
    'now',
    'one',
    'only',
    'out',
    'same',
    'should',
    'that',
    'the',
    'then',
    'there',
    'this',
    'too',
    'was',
    'what',
    'when',
    'where',
    'which',
    'while',
    'with',
    'would',
    'you',
    'your',
  ].map((term) => term.toLowerCase()),
);

const STRATEGY_PATTERNS = [
  {
    id: 'evidence_check',
    patterns: [/\b(?:check|test|measure|evidence|data|source|show|prove|compare|look at|find)\b/i],
  },
  {
    id: 'mechanism_explanation',
    patterns: [/\b(?:because|mechanism|means|works?|causes?|explains?|why|therefore|so the)\b/i],
  },
  {
    id: 'application_task',
    patterns: [/\b(?:write|choose|circle|mark|label|say|sentence|line|version|answer)\b/i],
  },
  {
    id: 'boundary_correction',
    patterns: [/\b(?:not|instead|rather|separate|distinguish|wrong|shortcut|category|frame)\b/i],
  },
  {
    id: 'validation_closure',
    patterns: [/\b(?:good|right|yes|exactly|that is it|correct)\b/i],
  },
];

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: null,
    out: null,
    csv: null,
    dryRun: false,
    targetOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--csv') args.csv = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--target-only') args.targetOnly = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/analyze-poetics-tutor-adaptation.js [--run-id ID] [--db FILE]
      [--out summary.json] [--csv rows.csv] [--target-only] [--dry-run]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(relPath) {
  return relPath ? path.resolve(ROOT, relPath) : null;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function round(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) return null;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tracePathForItem(item) {
  if (!item.full_transcript_path) return null;
  const traceRel = item.full_transcript_path.replace('/transcripts/', '/deliberation/').replace(/\.full\.md$/, '.json');
  const traceAbs = absFromRoot(traceRel);
  return traceAbs && fs.existsSync(traceAbs) ? traceAbs : null;
}

function loadItems(db, { runId = null, targetOnly = false } = {}) {
  const where = [];
  const params = {};
  if (runId) {
    where.push('i.run_id = @runId');
    params.runId = runId;
  }
  if (targetOnly) where.push("i.unit_id LIKE 'target-%'");
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `
      SELECT
        i.id,
        i.run_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.discipline,
        i.control_role,
        i.sample_path,
        i.full_transcript_path,
        i.metadata
      FROM poetics_items i
      ${whereSql}
      ORDER BY i.run_id, i.repeat, i.unit_id, i.arm, i.tid
    `,
    )
    .all(params)
    .map((item) => ({ ...item, metadata: decodeJson(item.metadata, {}) }));
}

function publicTurns(trace) {
  return (trace?.turns || [])
    .filter(
      (turn) => ['director', 'tutor', 'learner'].includes(turn.phase) && String(turn.externalMessage || '').trim(),
    )
    .map((turn, index) => ({ ...turn, ordinal: index + 1, text: String(turn.externalMessage || '').trim() }));
}

function extractAnchor(text) {
  return (
    String(text || '').match(
      /(?:A prior learner line is played back|An earlier learner line returns to the table):\s*"([\s\S]*?)"\s*(?:The learner must|The pause holds|The next response|The learner has to)/i,
    )?.[1] || ''
  );
}

function terms(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .match(/[a-z]+(?:[0-9]+)?|[0-9]+(?:\.[0-9]+)?/g)
        ?.filter((term) => (term.length > 2 || /\d/.test(term)) && !STOPWORDS.has(term)) || [],
    ),
  ];
}

function termSet(text) {
  return new Set(terms(text));
}

function subtractSet(a, b) {
  return new Set([...a].filter((term) => !b.has(term)));
}

function sharedTerms(a, b) {
  const bs = b instanceof Set ? b : new Set(b);
  return [...a].filter((term) => bs.has(term));
}

function overlapRatio(sourceTerms, targetText) {
  const source = sourceTerms instanceof Set ? sourceTerms : new Set(sourceTerms);
  if (!source.size) return 0;
  const target = termSet(targetText);
  return sharedTerms(source, target).length / source.size;
}

function strategyFor(text) {
  const hits = STRATEGY_PATTERNS.map((strategy) => ({
    id: strategy.id,
    count: strategy.patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0),
  })).filter((strategy) => strategy.count > 0);
  if (!hits.length) return 'open_scaffolding';
  hits.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return hits[0].id;
}

function markerReframeScore(learnerText) {
  const text = String(learnerText || '');
  const problem =
    /\b(?:framing problem|old frame|earlier mistake|mistake was|problem was|problem is|I was treating|I was letting|I assumed|I thought)\b/i.test(
      text,
    );
  const replacement =
    /\b(?:new frame|new line|new version|read it as|instead|rather|should say|should read|now the question|replacement|better)\b/i.test(
      text,
    );
  const earlier = /\b(?:earlier|old|first|I thought|I assumed|I was)\b/i.test(text);
  return (problem ? 0.4 : 0) + (replacement ? 0.4 : 0) + (earlier ? 0.2 : 0);
}

function softCueReframeStats(anchor, learnerText) {
  const learnerStats = anchor ? reframeMatchStats(anchor, learnerText) : null;
  const text = String(learnerText || '');
  const revoice = Boolean(learnerStats?.revoice_compliant);
  const softProblem =
    /\b(?:still stands|needs? narrowing|narrower|cannot carry|not the whole|nothing more|not proof|not the proof|not alone|only testing|not just)\b/i.test(
      text,
    ) && /\b(?:but|while|instead|rather|because|not)\b/i.test(text);
  const softReplacement =
    /\b(?:needs? narrowing|narrower|better|should|would say|want to say|question|test|read|line|label|claim|frame|evidence)\b/i.test(
      text,
    ) && /\b(?:but|while|instead|rather|so|then|now)\b/i.test(text);
  const problemNamed = Boolean(learnerStats?.problem_named || softProblem);
  const replacementNamed = Boolean(learnerStats?.replacement_named || softReplacement);
  const structuredScore = (revoice ? 0.34 : 0) + (problemNamed ? 0.33 : 0) + (replacementNamed ? 0.33 : 0);
  const score = round(Math.max(structuredScore, markerReframeScore(text)));
  return {
    learnerStats,
    learnerReframeScore: score,
    learnerSelfReframe: Boolean(
      learnerStats?.compliant || (revoice && problemNamed && replacementNamed) || score >= 0.8,
    ),
  };
}

function findCue(turns) {
  return turns.find(
    (turn) =>
      turn.phase === 'director' &&
      (turn.directorCue?.cueKind === 'learner_revisit_earlier_wording' ||
        /(?:A prior learner line is played back|An earlier learner line returns to the table):/i.test(turn.text)),
  );
}

function findOrganicPivot(turns) {
  const learnerTurns = turns.filter((turn) => turn.phase === 'learner');
  for (let i = 1; i < learnerTurns.length; i++) {
    const learner = learnerTurns[i];
    const earlier = learnerTurns.slice(0, i);
    if (markerReframeScore(learner.text) < 0.7) continue;
    const matchedAnchor = earlier.find((candidate) => reframeMatchStats(candidate.text, learner.text).compliant);
    return {
      pivot: learner,
      anchor: matchedAnchor?.text || earlier[0]?.text || '',
      learnerReframeScore: round(markerReframeScore(learner.text)),
      learnerSelfReframe: Boolean(matchedAnchor) || markerReframeScore(learner.text) >= 0.8,
    };
  }
  return null;
}

function findCuePivot(turns, cue, anchor) {
  const analyzed = turns
    .slice(turns.indexOf(cue) + 1)
    .filter((turn) => turn.phase === 'learner')
    .map((turn) => ({ turn, analysis: softCueReframeStats(anchor, turn.text) }));
  return analyzed.find((entry) => entry.analysis.learnerSelfReframe) || analyzed[0] || null;
}

function findTutorBefore(turns, pivot) {
  const pivotIndex = turns.indexOf(pivot);
  return [...turns.slice(0, pivotIndex)].reverse().find((turn) => turn.phase === 'tutor') || null;
}

function findTutorAfter(turns, pivot) {
  const pivotIndex = turns.indexOf(pivot);
  return turns.slice(pivotIndex + 1).find((turn) => turn.phase === 'tutor') || null;
}

function analyzeTraceForTutorAdaptation({ itemId, trace, sourceTracePath }) {
  const turns = publicTurns(trace);
  const cue = findCue(turns);
  const anchor = cue ? extractAnchor(cue.text) : '';
  const cuePivot = cue ? findCuePivot(turns, cue, anchor) : null;
  const organic = cuePivot ? null : findOrganicPivot(turns);
  const pivotLearner = cuePivot?.turn || organic?.pivot || null;
  const resolvedAnchor = anchor || organic?.anchor || '';
  const cueAnalysis = cuePivot?.analysis || null;
  const learnerReframeScore = cueAnalysis?.learnerReframeScore ?? organic?.learnerReframeScore ?? 0;
  const learnerSelfReframe = Boolean(cueAnalysis?.learnerSelfReframe || organic?.learnerSelfReframe);

  const preTutor = pivotLearner ? findTutorBefore(turns, pivotLearner) : null;
  const postTutor = pivotLearner ? findTutorAfter(turns, pivotLearner) : null;
  const anchorTerms = termSet(resolvedAnchor);
  const pivotTerms = pivotLearner ? subtractSet(termSet(pivotLearner.text), anchorTerms) : new Set();
  const preOverlap = preTutor ? overlapRatio(pivotTerms, preTutor.text) : 0;
  const postOverlap = postTutor ? overlapRatio(pivotTerms, postTutor.text) : 0;
  const uptakeDelta = postOverlap - preOverlap;
  const sharedWithPost = postTutor ? sharedTerms(pivotTerms, termSet(postTutor.text)) : [];
  const sharedWithPre = preTutor ? new Set(sharedTerms(pivotTerms, termSet(preTutor.text))) : new Set();
  const novelShared = sharedWithPost.filter((term) => !sharedWithPre.has(term)).slice(0, 12);
  const beforeStrategy = preTutor ? strategyFor(preTutor.text) : null;
  const afterStrategy = postTutor ? strategyFor(postTutor.text) : null;
  const strategyShift = Boolean(beforeStrategy && afterStrategy && beforeStrategy !== afterStrategy);
  const explicitUptake = postTutor
    ? /\b(?:that line|your line|you just|you said|the frame|that wording|the question you are asking|the number has to earn)\b/i.test(
        postTutor.text,
      )
    : false;
  const tutorContingentAdaptation = Boolean(
    learnerSelfReframe &&
    postTutor &&
    ((postOverlap >= 0.16 && uptakeDelta >= 0.03 && novelShared.length >= 2) || explicitUptake),
  );
  const rawTutorAdaptationScore = Math.min(
    100,
    20 +
      Math.min(35, postOverlap * 100) +
      Math.min(25, Math.max(0, uptakeDelta) * 125) +
      Math.min(10, novelShared.length * 2) +
      (strategyShift ? 10 : 0),
  );
  const tutorAdaptationScore = learnerSelfReframe ? round(rawTutorAdaptationScore, 1) : 0;

  return {
    itemId,
    analyzerVersion: ANALYZER_VERSION,
    sourceTracePath: sourceTracePath ? rel(sourceTracePath) : null,
    cuePolicy: cue?.directorCue?.revisitPolicy || (cue ? 'anchor' : null),
    cueTurnNumber: cue?.turnNumber ?? null,
    pivotLearnerTurn: pivotLearner?.turnNumber ?? null,
    learnerSelfReframe,
    learnerReframeScore,
    tutorPreTurn: preTutor?.turnNumber ?? null,
    tutorPostTurn: postTutor?.turnNumber ?? null,
    tutorStrategyBefore: beforeStrategy,
    tutorStrategyAfter: afterStrategy,
    tutorStrategyShift: strategyShift,
    preTutorPivotOverlap: round(preOverlap),
    postTutorPivotOverlap: round(postOverlap),
    uptakeDelta: round(uptakeDelta),
    sharedSalientTerms: novelShared,
    tutorContingentAdaptation,
    tutorAdaptationScore,
    evidence: [
      pivotLearner ? `learner: ${pivotLearner.text.slice(0, 180)}` : null,
      postTutor ? `post tutor: ${postTutor.text.slice(0, 180)}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      anchor: resolvedAnchor || null,
      pivotTerms: [...pivotTerms].slice(0, 40),
      sharedWithPost,
      explicitUptake,
    },
  };
}

function analyzeItem(item) {
  const tracePath = tracePathForItem(item);
  if (!tracePath) {
    return {
      itemId: item.id,
      analyzerVersion: ANALYZER_VERSION,
      sourceTracePath: null,
      learnerSelfReframe: false,
      tutorStrategyShift: false,
      tutorContingentAdaptation: false,
      tutorAdaptationScore: 0,
      metadata: { error: 'missing_trace' },
    };
  }
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  return analyzeTraceForTutorAdaptation({ itemId: item.id, trace, sourceTracePath: tracePath });
}

function summarizeRows(rows) {
  const groups = {};
  for (const row of rows) {
    const key = `${row.runId || 'unknown'}:${row.arm || 'default'}`;
    groups[key] ||= {
      runId: row.runId,
      arm: row.arm || 'default',
      total: 0,
      learnerSelfReframes: 0,
      tutorAdaptations: 0,
      scoreSum: 0,
      uptakeDeltaSum: 0,
    };
    groups[key].total += 1;
    if (row.learnerSelfReframe) groups[key].learnerSelfReframes += 1;
    if (row.tutorContingentAdaptation) groups[key].tutorAdaptations += 1;
    groups[key].scoreSum += row.tutorAdaptationScore || 0;
    groups[key].uptakeDeltaSum += row.uptakeDelta || 0;
  }
  return Object.values(groups)
    .sort((a, b) => `${a.runId}:${a.arm}`.localeCompare(`${b.runId}:${b.arm}`))
    .map((group) => ({
      ...group,
      meanTutorAdaptationScore: round(group.scoreSum / group.total, 1),
      meanUptakeDelta: round(group.uptakeDeltaSum / group.total),
    }));
}

function renderCsv(rows) {
  const header = [
    'run_id',
    'item_id',
    'unit_id',
    'arm',
    'tid',
    'drama_id',
    'learner_self_reframe',
    'tutor_contingent_adaptation',
    'tutor_adaptation_score',
    'uptake_delta',
    'tutor_strategy_before',
    'tutor_strategy_after',
    'shared_salient_terms',
    'source_trace_path',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.runId,
        row.itemId,
        row.unitId,
        row.arm,
        row.tid,
        row.dramaId,
        row.learnerSelfReframe ? 1 : 0,
        row.tutorContingentAdaptation ? 1 : 0,
        row.tutorAdaptationScore,
        row.uptakeDelta,
        row.tutorStrategyBefore,
        row.tutorStrategyAfter,
        row.sharedSalientTerms.join(' '),
        row.sourceTracePath,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function buildAnalysis(db, args) {
  const items = loadItems(db, { runId: args.runId, targetOnly: args.targetOnly });
  const rows = items.map((item) => ({
    runId: item.run_id,
    unitId: item.unit_id,
    arm: item.arm,
    tid: item.tid,
    dramaId: item.drama_id,
    ...analyzeItem(item),
  }));
  return {
    generatedAt: new Date().toISOString(),
    analyzerVersion: ANALYZER_VERSION,
    runFilter: args.runId || null,
    targetOnly: args.targetOnly,
    summary: summarizeRows(rows),
    rows,
  };
}

function persistAnalysis(db, rows) {
  const tx = db.transaction(() => {
    for (const row of rows) upsertPoeticsTutorAdaptation(db, row);
  });
  tx();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const analysis = buildAnalysis(db, args);
    if (!args.dryRun) persistAnalysis(db, analysis.rows);
    if (args.out) writeFile(args.out, `${JSON.stringify(analysis, null, 2)}\n`);
    if (args.csv) writeFile(args.csv, renderCsv(analysis.rows));
    const total = analysis.rows.length;
    const adapted = analysis.rows.filter((row) => row.tutorContingentAdaptation).length;
    const learner = analysis.rows.filter((row) => row.learnerSelfReframe).length;
    console.log(
      `${args.dryRun ? 'would analyze' : 'analyzed'} tutor adaptation: ` +
        `${total} item(s), ${learner} learner self-reframe(s), ${adapted} tutor contingent adaptation(s)`,
    );
    for (const group of analysis.summary) {
      console.log(
        `  ${group.runId} ${group.arm}: learner ${group.learnerSelfReframes}/${group.total}, ` +
          `tutor ${group.tutorAdaptations}/${group.total}, mean score ${group.meanTutorAdaptationScore}`,
      );
    }
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export {
  ANALYZER_VERSION,
  analyzeTraceForTutorAdaptation,
  buildAnalysis,
  markerReframeScore,
  renderCsv,
  strategyFor,
  terms,
};
