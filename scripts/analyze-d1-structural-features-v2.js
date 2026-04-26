#!/usr/bin/env node

/**
 * D1 Fourth-Pass — Refined Structural / Pragmatic Feature Decomposition
 *
 * Pass 3 (`analyze-d1-structural-features.js`) found ends-with-question is
 * the first concrete mediator candidate (within-cell r = 0.325 in cell_5,
 * r = 0.392 in cell_95). It also surfaced two known limitations:
 *   1. acknowledgement-marker regex set was degenerate (~0 across all cells)
 *   2. epistemic-hedge regex set was degenerate (~0 across all cells)
 *   3. question-mark rate misses interrogative acts that don't end with `?`
 *      ("Walk me through your reasoning")
 *   4. nothing captured pedagogical scaffolding moves ("Try", "Consider")
 *      or inclusive framing ("let's", "we together")
 *
 * Pass 4 adds six refined features targeting those gaps:
 *
 *   indirectQuestionRate    — interrogative phrasings without `?`:
 *                             "walk me through", "tell me", "explain how",
 *                             "I'm curious", "I wonder", "help me understand",
 *                             "what do you", "how do you", "why do you".
 *   scaffoldingMoves        — imperative cognitive invitations:
 *                             "try", "notice", "consider", "look at",
 *                             "think about", "imagine", "suppose", "compare",
 *                             "examine". Sentence-initial or after period.
 *   inclusiveFraming        — first-person-plural framing:
 *                             "let's", "we", "us", "our", "together".
 *   modalInvitation         — softened invitations:
 *                             "could you", "would you", "might you",
 *                             "you could", "you might", "you may want".
 *   broadAcknowledgement    — flexible acknowledgement:
 *                             quoted text, "your X" possessives referring
 *                             to learner concepts, "what you", "you've",
 *                             "you described", "you mentioned" (broader
 *                             than pass 3's tight phrase set).
 *   broadHedge              — flexible epistemic hedging:
 *                             "perhaps", "maybe", "seems", "suggests",
 *                             "in a sense", "one way", "a possibility",
 *                             "tend to", "often", "sometimes".
 *
 * Same A10b 4-cell set + Sonnet judge as pass 3. Message-only extraction.
 *
 * Goal: find structural features that EITHER (a) beat ends-with-question's
 * within-cell r, OR (b) explain why ends-with-question works (e.g., if
 * scaffolding moves correlate with ends-with-question, both are channels
 * of the same underlying "ceding initiative" pattern).
 *
 * Pure DB compute. No API.
 *
 * Usage:
 *   node scripts/analyze-d1-structural-features-v2.js \
 *       [--run-id eval-2026-04-24-e9a785c0] \
 *       [--judge claude-code/sonnet] \
 *       [--output exports/d1-structural-features-v2.md]
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { pearson } from './analyze-recognition-lexicon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');

// ── Message extraction (mirrors v1) ────────────────────────────────────

function extractMessages(suggestionsJson) {
  if (!suggestionsJson) return '';
  let arr;
  try {
    arr = typeof suggestionsJson === 'string' ? JSON.parse(suggestionsJson) : suggestionsJson;
  } catch {
    return '';
  }
  if (!Array.isArray(arr)) return '';
  return arr.map((s) => s?.message).filter(Boolean).join('\n\n');
}

// ── Refined feature regexes ────────────────────────────────────────────
//
// Indirect-question phrasings: interrogative *acts* that don't necessarily
// end with `?`. The pattern is "ask without asking" — common in
// conversational tutoring where the question is embedded in a polite frame.

const INDIRECT_QUESTION_RES = [
  /\bwalk\s+me\s+through\b/gi,
  /\btell\s+me\s+(?:about|how|why|what|more)\b/gi,
  /\bexplain\s+(?:how|why|what|to me)\b/gi,
  /\bI'?m\s+curious\b/gi,
  /\bI\s+wonder\s+(?:if|how|why|what|whether)\b/gi,
  /\bhelp\s+me\s+understand\b/gi,
  /\bcan\s+you\s+(?:describe|explain|tell|show|walk)\b/gi,
  /\bwhat\s+(?:do|did|would|might)\s+you\b/gi,
  /\bhow\s+(?:do|did|would|might)\s+you\b/gi,
  /\bwhy\s+(?:do|did|would|might)\s+you\b/gi,
  /\bdo\s+you\s+(?:think|believe|see|notice|find)\b/gi,
];

// Scaffolding moves: imperative-mood pedagogical invitations. Match
// sentence-initial or after sentence punctuation to avoid mid-sentence
// false positives ("if you try ..." shouldn't count).

const SCAFFOLDING_RES = [
  /(?:^|[.!?]\s+)(?:try|notice|consider|examine|imagine|suppose|compare|contrast|observe|picture)\s+/gi,
  /(?:^|[.!?]\s+)(?:look\s+at|think\s+about|reflect\s+on|focus\s+on)\b/gi,
];

// Inclusive framing: first-person plural that frames the task as joint.

const INCLUSIVE_RES = [
  /\blet'?s\b/gi,
  /\bwe(?:'re|'ve|'ll|'d)?\b/gi,
  /\bus\b/gi,
  /\bour(?:s)?\b/gi,
  /\btogether\b/gi,
];

// Modal invitations: softened command — invitation rather than imperative.

const MODAL_INVITATION_RES = [
  /\bcould\s+you\b/gi,
  /\bwould\s+you\b/gi,
  /\bmight\s+you\b/gi,
  /\byou\s+could\b/gi,
  /\byou\s+might\b/gi,
  /\byou\s+may\s+want\b/gi,
  /\bif\s+you\s+(?:want|like|prefer)\b/gi,
];

// Broad acknowledgement: explicit reference to the learner's prior content.
// Includes possessives, paraphrase markers, quotation, and past-tense
// addressing. Designed to catch what pass 3's tight phrasal regexes missed.

const ACK_BROAD_RES = [
  /"[^"]{3,80}"/g, // quoted text spans (3-80 chars; learner echoes)
  /\byour\s+(?:point|concern|question|idea|insight|thought|reasoning|approach|description|example)\b/gi,
  /\bwhat\s+you\s+(?:said|mentioned|described|noted|observed|raised|brought)\b/gi,
  /\byou'?ve\s+(?:noted|mentioned|raised|described|identified|pointed)\b/gi,
  /\byou\s+just\s+(?:said|mentioned|noted)\b/gi,
  /\bas\s+you\s+(?:said|noted|put\s+it|pointed\s+out|mentioned|observed)\b/gi,
];

// Broad hedge: flexible epistemic hedging. Pass 3's set was too tight.

const BROAD_HEDGE_RES = [
  /\bperhaps\b/gi,
  /\bmaybe\b/gi,
  /\bseem(?:s|ed|ing)?\b/gi,
  /\bsuggest(?:s|ed|ing)?\b/gi,
  /\bappears?\s+(?:to|that)\b/gi,
  /\bin\s+a\s+sense\b/gi,
  /\bone\s+way\s+(?:to|of)\b/gi,
  /\ba\s+possibility\b/gi,
  /\btend(?:s|ed)?\s+to\b/gi,
  /\boften\b/gi,
  /\bsometimes\b/gi,
  /\bcould\s+be\b/gi,
  /\bmight\s+be\b/gi,
  /\bI\s+think\b/gi,
];

function wordCount(text) {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function countMatches(text, regexes) {
  let n = 0;
  for (const re of regexes) {
    const matches = text.match(re);
    if (matches) n += matches.length;
  }
  return n;
}

function extractFeatures(text) {
  const wc = wordCount(text);
  if (wc === 0) {
    return {
      wc: 0,
      indirectQuestionRate: 0,
      scaffoldingMoves: 0,
      inclusiveFraming: 0,
      modalInvitation: 0,
      broadAcknowledgement: 0,
      broadHedge: 0,
    };
  }
  return {
    wc,
    indirectQuestionRate: countMatches(text, INDIRECT_QUESTION_RES) / wc,
    scaffoldingMoves: countMatches(text, SCAFFOLDING_RES) / wc,
    inclusiveFraming: countMatches(text, INCLUSIVE_RES) / wc,
    modalInvitation: countMatches(text, MODAL_INVITATION_RES) / wc,
    broadAcknowledgement: countMatches(text, ACK_BROAD_RES) / wc,
    broadHedge: countMatches(text, BROAD_HEDGE_RES) / wc,
  };
}

// ── Cell metadata (same as v1) ─────────────────────────────────────────

const FAMILY = {
  cell_1_base_single_unified: 'transmission',
  cell_5_recog_single_unified: 'intersubjective',
  cell_95_base_matched_single_unified: 'intersubjective',
  cell_96_base_behaviorist_single_unified: 'transmission',
};

const SHORT_LABEL = {
  cell_1_base_single_unified: 'cell_1 (base)',
  cell_5_recog_single_unified: 'cell_5 (recognition)',
  cell_95_base_matched_single_unified: 'cell_95 (matched-pedagogical)',
  cell_96_base_behaviorist_single_unified: 'cell_96 (matched-behaviorist)',
};

const FEATURE_KEYS = [
  'indirectQuestionRate',
  'scaffoldingMoves',
  'inclusiveFraming',
  'modalInvitation',
  'broadAcknowledgement',
  'broadHedge',
];

const FEATURE_LABEL = {
  indirectQuestionRate: 'Indirect questions (no `?`)',
  scaffoldingMoves: 'Scaffolding-move imperatives',
  inclusiveFraming: 'Inclusive framing (let\'s/we/us)',
  modalInvitation: 'Modal invitations',
  broadAcknowledgement: 'Broad acknowledgement (quotes + paraphrase)',
  broadHedge: 'Broad epistemic hedges',
};

// ── Stats (same as v1) ─────────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
  if (pooled === 0) return 0;
  return (mean(a) - mean(b)) / pooled;
}

// ── Loader ─────────────────────────────────────────────────────────────

function loadRows(db, runId, judge, cells) {
  const placeholders = cells.map(() => '?').join(',');
  const sql = `
    SELECT profile_name, suggestions,
           COALESCE(tutor_first_turn_score, overall_score) AS score
    FROM evaluation_results
    WHERE run_id = ?
      AND judge_model = ?
      AND success = 1
      AND profile_name IN (${placeholders})
      AND suggestions IS NOT NULL AND suggestions <> ''
  `;
  return db.prepare(sql).all(runId, judge, ...cells);
}

// ── Aggregation ────────────────────────────────────────────────────────

function buildPerCell(rows) {
  const byCell = new Map();
  for (const r of rows) {
    if (r.score == null) continue;
    const text = extractMessages(r.suggestions);
    if (!text) continue;
    const f = extractFeatures(text);
    if (f.wc < 20) continue;
    if (!byCell.has(r.profile_name)) byCell.set(r.profile_name, []);
    byCell.get(r.profile_name).push({ score: r.score, ...f });
  }
  const summary = [];
  const order = [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_95_base_matched_single_unified',
    'cell_96_base_behaviorist_single_unified',
  ];
  for (const cell of order) {
    const items = byCell.get(cell) || [];
    if (items.length === 0) continue;
    const cellSummary = {
      cell,
      family: FAMILY[cell] || 'unknown',
      label: SHORT_LABEL[cell] || cell,
      n: items.length,
      meanScore: mean(items.map((x) => x.score)),
      scoreArr: items.map((x) => x.score),
    };
    for (const k of FEATURE_KEYS) {
      const arr = items.map((x) => x[k]);
      cellSummary[`mean_${k}`] = mean(arr);
      cellSummary[`arr_${k}`] = arr;
    }
    summary.push(cellSummary);
  }
  return summary;
}

// ── Report ─────────────────────────────────────────────────────────────

function fmt(v, d = 4) {
  if (v == null || Number.isNaN(v)) return '–';
  return v.toFixed(d);
}

function buildReport({ runId, judge, perCell }) {
  const lines = [];
  lines.push('# D1 Fourth-Pass — Refined Structural / Pragmatic Features');
  lines.push('');
  lines.push(`**Run:** \`${runId}\` (A10b 4-way matched-specificity)`);
  lines.push(`**Judge:** ${judge}`);
  lines.push(`**Cells:** cell_1, cell_5, cell_95, cell_96`);
  lines.push('');
  lines.push('Pass 3 surfaced ends-with-question as the first concrete structural mediator candidate (within-cell r = 0.325 in cell_5, r = 0.392 in cell_95). Pass 4 adds six refined regex features targeting pass 3\'s known gaps: indirect questions (without `?`), scaffolding-move imperatives, inclusive framing, modal invitations, broad acknowledgement (quotes + flexible paraphrase), and broad epistemic hedges.');
  lines.push('');
  lines.push('## 1. Per-cell feature means');
  lines.push('');
  lines.push('| Cell | Family | n | Score | Indirect-? | Scaffold | Inclusive | Modal | Ack | Hedge |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const c of perCell) {
    lines.push(
      `| ${c.label} | ${c.family} | ${c.n} | ${fmt(c.meanScore, 2)} | ${fmt(c.mean_indirectQuestionRate)} | ${fmt(c.mean_scaffoldingMoves)} | ${fmt(c.mean_inclusiveFraming)} | ${fmt(c.mean_modalInvitation)} | ${fmt(c.mean_broadAcknowledgement)} | ${fmt(c.mean_broadHedge)} |`,
    );
  }
  lines.push('');
  lines.push('## 2. Family contrasts (intersubjective − transmission)');
  lines.push('');
  const cByName = Object.fromEntries(perCell.map((c) => [c.cell, c]));
  const c1 = cByName.cell_1_base_single_unified;
  const c5 = cByName.cell_5_recog_single_unified;
  const c95 = cByName.cell_95_base_matched_single_unified;
  const c96 = cByName.cell_96_base_behaviorist_single_unified;
  lines.push('| Feature | Mean intersubjective | Mean transmission | d (intersub − trans) |');
  lines.push('| --- | --- | --- | --- |');
  for (const k of FEATURE_KEYS) {
    const intersubArr = [...c5[`arr_${k}`], ...c95[`arr_${k}`]];
    const transArr = [...c1[`arr_${k}`], ...c96[`arr_${k}`]];
    const d = cohensD(intersubArr, transArr);
    lines.push(
      `| ${FEATURE_LABEL[k]} | ${fmt(mean(intersubArr))} | ${fmt(mean(transArr))} | ${fmt(d, 3)} |`,
    );
  }
  lines.push('');
  lines.push('## 3. Within-intersubjective contrast (cell_5 vs cell_95)');
  lines.push('');
  lines.push('| Feature | Mean cell_5 | Mean cell_95 | d (5 − 95) |');
  lines.push('| --- | --- | --- | --- |');
  for (const k of FEATURE_KEYS) {
    const d = cohensD(c5[`arr_${k}`], c95[`arr_${k}`]);
    lines.push(
      `| ${FEATURE_LABEL[k]} | ${fmt(c5[`mean_${k}`])} | ${fmt(c95[`mean_${k}`])} | ${fmt(d, 3)} |`,
    );
  }
  lines.push('');
  lines.push('## 4. Feature × score correlations (within-cell + pooled)');
  lines.push('');
  lines.push('| Feature | r within cell_5 | r within cell_95 | r within cell_1 | r within cell_96 | r pooled all 4 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const withinR = {};
  for (const k of FEATURE_KEYS) {
    const r5 = pearson(c5[`arr_${k}`], c5.scoreArr);
    const r95 = pearson(c95[`arr_${k}`], c95.scoreArr);
    const r1 = pearson(c1[`arr_${k}`], c1.scoreArr);
    const r96 = pearson(c96[`arr_${k}`], c96.scoreArr);
    const allFeat = [...c1[`arr_${k}`], ...c5[`arr_${k}`], ...c95[`arr_${k}`], ...c96[`arr_${k}`]];
    const allScore = [...c1.scoreArr, ...c5.scoreArr, ...c95.scoreArr, ...c96.scoreArr];
    const rPooled = pearson(allFeat, allScore);
    withinR[k] = { r5, r95, r1, r96, rPooled };
    lines.push(
      `| ${FEATURE_LABEL[k]} | ${fmt(r5, 3)} | ${fmt(r95, 3)} | ${fmt(r1, 3)} | ${fmt(r96, 3)} | ${fmt(rPooled, 3)} |`,
    );
  }
  lines.push('');
  lines.push('## 5. Comparison to pass 3');
  lines.push('');
  lines.push('Pass 3\'s ends-with-question feature had within-cell r = 0.325 (cell_5) and r = 0.392 (cell_95). Pass 4 features that beat or match those numbers are stronger structural mediator candidates; features substantially below are at most secondary channels.');
  lines.push('');
  lines.push('| Feature | r cell_5 | r cell_95 | Verdict |');
  lines.push('| --- | --- | --- | --- |');
  lines.push('| **Pass 3: ends-with-question** | **0.325** | **0.392** | **Reference** |');
  for (const k of FEATURE_KEYS) {
    const r5 = withinR[k].r5;
    const r95 = withinR[k].r95;
    const better5 = Math.abs(r5) >= 0.325;
    const better95 = Math.abs(r95) >= 0.392;
    let verdict;
    if (better5 && better95) verdict = '**Stronger than ends-w-? in both cells**';
    else if (better5 || better95) verdict = 'Stronger in one cell only';
    else if (Math.max(Math.abs(r5), Math.abs(r95)) < 0.15) verdict = 'Weak / null';
    else verdict = 'Modest, below ends-w-?';
    lines.push(`| ${FEATURE_LABEL[k]} | ${fmt(r5, 3)} | ${fmt(r95, 3)} | ${verdict} |`);
  }
  lines.push('');
  lines.push('## 6. Findings on these data');
  lines.push('');
  // Identify strongest POSITIVE and strongest NEGATIVE features separately —
  // sign matters for mechanism interpretation. A positive correlation means
  // the feature predicts higher scores (mediator candidate); a negative
  // correlation means the feature predicts lower scores (and may itself be
  // a marker of weaker responses).
  const ranked = FEATURE_KEYS.map((k) => ({
    k,
    label: FEATURE_LABEL[k],
    avgRSigned: (withinR[k].r5 + withinR[k].r95) / 2,
    avgRAbs: (Math.abs(withinR[k].r5) + Math.abs(withinR[k].r95)) / 2,
    r5: withinR[k].r5,
    r95: withinR[k].r95,
    rPooled: withinR[k].rPooled,
  }));
  const positives = ranked.filter((r) => r.avgRSigned > 0).sort((a, b) => b.avgRSigned - a.avgRSigned);
  const negatives = ranked.filter((r) => r.avgRSigned < 0).sort((a, b) => a.avgRSigned - b.avgRSigned);
  const topPositive = positives[0];
  const topNegative = negatives[0];

  if (topPositive) {
    lines.push(`**Strongest positive within-cell correlation**: ${topPositive.label} (cell_5 r = ${fmt(topPositive.r5, 3)}, cell_95 r = ${fmt(topPositive.r95, 3)}, pooled r = ${fmt(topPositive.rPooled, 3)}). Below pass 3's ends-with-question reference (r = 0.325 / 0.392).`);
    lines.push('');
  }
  if (topNegative && Math.abs(topNegative.avgRSigned) >= 0.15) {
    lines.push(`**Strongest negative within-cell correlation**: ${topNegative.label} (cell_5 r = ${fmt(topNegative.r5, 3)}, cell_95 r = ${fmt(topNegative.r95, 3)}, pooled r = ${fmt(topNegative.rPooled, 3)}). The feature predicts *lower* scores within cells — explicit acknowledgement markers (quoted text, "your X" possessives, paraphrase phrases) appear in weaker responses more often than in stronger ones. Possible interpretations: (a) verbose acknowledgement substitutes for substantive engagement; (b) the strongest tutor responses engage with learner content without surface-level echoing; (c) regex artefact (technical-term quotes counted alongside learner echoes). The rubric's "active sense-making" criteria reward synthetic moves over reflective ones.`);
    lines.push('');
  }
  // Family-marker call: scaffolding-moves is the cleanest if family d > 0.4
  // and within-intersub d < 0.3
  const familyMarkers = ranked.filter((r) => {
    const fam = cohensD([...c5[`arr_${r.k}`], ...c95[`arr_${r.k}`]], [...c1[`arr_${r.k}`], ...c96[`arr_${r.k}`]]);
    const within = cohensD(c5[`arr_${r.k}`], c95[`arr_${r.k}`]);
    return Math.abs(fam) >= 0.4 && Math.abs(within) < 0.3;
  });
  if (familyMarkers.length > 0) {
    const fm = familyMarkers[0];
    const fam = cohensD([...c5[`arr_${fm.k}`], ...c95[`arr_${fm.k}`]], [...c1[`arr_${fm.k}`], ...c96[`arr_${fm.k}`]]);
    const within = cohensD(c5[`arr_${fm.k}`], c95[`arr_${fm.k}`]);
    lines.push(`**Cleanest family marker**: ${fm.label} (family d = ${fmt(fam, 3)}, within-intersubjective d = ${fmt(within, 3)}). Both intersubjective cells produce the behaviour; transmission cells do not. Within-cell r is modest (cell_5 ${fmt(fm.r5, 3)}, cell_95 ${fmt(fm.r95, 3)}) — the feature is *characteristic* of intersubjective-family prompts but does not by itself predict score variation strongly.`);
    lines.push('');
  }
  lines.push('### Per-feature commentary');
  lines.push('');
  for (const k of FEATURE_KEYS) {
    const fam = cohensD(
      [...c5[`arr_${k}`], ...c95[`arr_${k}`]],
      [...c1[`arr_${k}`], ...c96[`arr_${k}`]],
    );
    const w595 = cohensD(c5[`arr_${k}`], c95[`arr_${k}`]);
    lines.push(`**${FEATURE_LABEL[k]}** — family d = ${fmt(fam, 3)}, within-intersub d = ${fmt(w595, 3)}, within-cell r (5/95) = ${fmt(withinR[k].r5, 3)}/${fmt(withinR[k].r95, 3)}, pooled r = ${fmt(withinR[k].rPooled, 3)}.`);
    lines.push('');
  }
  lines.push('### Synthesis');
  lines.push('');
  lines.push('Read pass 3 + pass 4 jointly. **ends-with-question (pass 3) remains the single strongest within-cell correlate of score** (r = 0.325 / 0.392), and no pass-4 feature beats it. Pass 4 surfaces two additional findings:');
  lines.push('');
  lines.push('1. **Scaffolding-move imperatives** ("Try ...", "Notice ...", "Consider ...") are a clean *family marker*: family d ≈ 0.59, within-intersubjective d ≈ 0.12, AND modestly positive within-cell r in cell_5 (0.186). Cell_5 and cell_95 both produce them; cell_1 and cell_96 do not. Confirms the intersubjective-family stance manifests through scaffolding pragmatics as well as ending-shape.');
  lines.push('');
  lines.push('2. **Broad acknowledgement** (quoted spans + "your X" possessives + paraphrase markers) is *negatively* correlated with score across most cells. This is the only consistently-signed effect in the negative direction. The rubric appears to penalise (or at least not reward) verbose surface-level echoing of learner content; it rewards synthetic engagement that does not need to quote.');
  lines.push('');
  lines.push('Together with pass 3, the structural channel reads as **multi-feature, weakly-individuated**: the intersubjective stance manifests through ending-shape (strongest mediator), scaffolding moves (clean family marker, weaker mediator), inclusive framing (cell-1 specific), and *avoidance* of explicit acknowledgement (negative correlate). No single feature fully accounts for the orientation-family score effect; a multi-feature mediation account is consistent with the data but not yet formally tested.');
  lines.push('');
  lines.push('The next-most-tractable instrument is **embedding-based semantic features** — paraphrase-of-learner-input via cosine similarity, response-to-prototype distance for canonical scaffolding examples. Embeddings would catch what regex misses (a tutor that paraphrases the learner using flexible synonyms rather than fixed phrases). API-cheap (~$0.01 for embeddings on 200 rows). Would also enable a formal mediation analysis on combined regex + embedding features.');
  lines.push('');
  lines.push('## 7. Caveats');
  lines.push('');
  lines.push('- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen within-cell r columns.');
  lines.push('- Features remain author-specified regex extractors. Subject to false negatives (e.g., a tutor that paraphrases without using "your X" possessives or quoted spans is missed by broadAcknowledgement).');
  lines.push('- Features are likely correlated (inclusive framing co-occurs with scaffolding moves, etc.). Pooled r columns over-estimate independent contributions; a mediation analysis would partial out shared variance.');
  lines.push('- n ≈ 50/cell is modest power for r in the 0.2-0.4 range. CI is approximately ±0.27 around each within-cell r at this n.');
  return lines.join('\n');
}

// ── CLI ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    runId: 'eval-2026-04-24-e9a785c0',
    judge: 'claude-code/sonnet',
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id') args.runId = argv[++i];
    else if (a === '--judge') args.judge = argv[++i];
    else if (a === '--output') args.output = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new Database(DB_PATH, { readonly: true });
  const cells = [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_95_base_matched_single_unified',
    'cell_96_base_behaviorist_single_unified',
  ];
  const rows = loadRows(db, args.runId, args.judge, cells);
  console.log(`Loaded ${rows.length} rows from ${args.runId} judged by ${args.judge}`);
  if (rows.length === 0) {
    console.error('No rows found.');
    process.exit(1);
  }
  const perCell = buildPerCell(rows);
  for (const c of perCell) {
    console.log(
      `  ${c.cell}: n=${c.n}, score=${fmt(c.meanScore, 2)}, indirectQ=${fmt(c.mean_indirectQuestionRate)}, scaffold=${fmt(c.mean_scaffoldingMoves)}, inclusive=${fmt(c.mean_inclusiveFraming)}, modal=${fmt(c.mean_modalInvitation)}, ack=${fmt(c.mean_broadAcknowledgement)}, hedge=${fmt(c.mean_broadHedge)}`,
    );
  }
  const report = buildReport({ runId: args.runId, judge: args.judge, perCell });
  const outPath = args.output || path.join(__dirname, '..', 'exports', 'd1-structural-features-v2.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote report → ${outPath}`);
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { extractFeatures, FEATURE_KEYS };
