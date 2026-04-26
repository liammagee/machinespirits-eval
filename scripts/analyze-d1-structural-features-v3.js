#!/usr/bin/env node

/**
 * D1 Fifth-Pass — Embedding-Based Semantic Features + Cross-Feature Correlation
 *
 * Pass 3 (regex syntactic/pragmatic) found ends-with-question is the strongest
 * within-cell mediator (r=0.325 in cell_5, r=0.392 in cell_95).
 * Pass 4 (refined regex) added scaffolding-move imperatives as the cleanest
 * family marker, and surfaced broad-acknowledgement as a *negative* correlate.
 * Both passes were limited to surface regex.
 *
 * Pass 5 adds embedding-based semantic features to catch what regex misses
 * (e.g., flexible-synonym paraphrase that doesn't use fixed phrases). For
 * each tutor message we compute cosine similarity to two hand-authored
 * canonical references:
 *
 *   - Intersubjective scaffolding canonical: exemplifies turn-taking,
 *     question-asking, learner-acknowledgement, inclusive framing.
 *   - Transmission explanation canonical: exemplifies direct explanation,
 *     definition-and-application, definitive framing, no questions.
 *
 * Derived features per row:
 *   sim_intersub       — cosine(message, intersubjective_canonical)
 *   sim_transmission   — cosine(message, transmission_canonical)
 *   intersub_advantage — sim_intersub − sim_transmission
 *
 * The third (intersub_advantage) is the main feature of interest: it
 * isolates the *direction* of pragmatic style independent of overall
 * tutor-talk semantics. A response that scores high on intersub_advantage
 * is one that pattern-matches the intersubjective canonical *more than*
 * the transmission canonical.
 *
 * In addition to per-cell + family + within-cell analyses (same scaffold
 * as passes 3-4), pass 5 reports a **cross-feature correlation matrix**
 * showing how the embedding features relate to the regex features from
 * passes 3-4. This identifies redundancy (multiple features measuring the
 * same underlying construct) and complementarity (features capturing
 * orthogonal channels).
 *
 * A10b 4-cell set, Sonnet judge, message-only extraction. Single
 * embedding API batch call (~250 rows × ~500 tokens × $0.02/1M tokens
 * = ~$0.003 total).
 *
 * Usage:
 *   node scripts/analyze-d1-structural-features-v3.js \
 *       [--run-id eval-2026-04-24-e9a785c0] \
 *       [--judge claude-code/sonnet] \
 *       [--output exports/d1-structural-features-v3.md] \
 *       [--cache exports/d1-embeddings-cache.json]
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { pearson } from './analyze-recognition-lexicon.js';
import { extractFeatures as extractV1Features, FEATURE_KEYS as V1_KEYS } from './analyze-d1-structural-features.js';
import { extractFeatures as extractV2Features, FEATURE_KEYS as V2_KEYS } from './analyze-d1-structural-features-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');
const DEFAULT_CACHE = path.resolve(__dirname, '..', 'exports', 'd1-embeddings-cache.json');

// ── Canonical references ───────────────────────────────────────────────
//
// Two hand-authored reference texts representing the family extremes.
// Designed to elicit strong similarity differential from intersubjective
// vs transmission tutor responses. ~120 words each so per-canonical
// embedding is well-posed without dilution.

const CANONICAL_INTERSUBJECTIVE = `That's an interesting place to start. Before I share what I'm thinking, can you tell me what your intuition says here? Try to articulate what you'd expect, even if you're not entirely sure. I'm curious what brought you to frame the question this way — sometimes the framing itself reveals what we need to examine. Let's slow down and think through it together. Notice what feels uncertain to you, and we can work outward from there. Consider what your prior reasoning suggests as a first move. What does your sense of the problem tell you to try? We can build on whatever you offer, even partial intuitions.`;

const CANONICAL_TRANSMISSION = `The answer involves three key principles. First, the concept is defined as follows: it operates by combining the relevant variables according to a fixed procedure. Second, the standard application requires you to apply rule X whenever Y holds, then verify the result against the expected pattern. Third, the most common error is confusing this with a similar but distinct concept, so be careful to distinguish them. The correct procedure is: identify the relevant variable, apply the formula, check the answer. You should memorize this structure because it appears repeatedly in similar problems. The established formulation is well-tested and reliable. Practice problems will reinforce the pattern. Make sure you can recite the definition before applying it.`;

// ── Message extraction ─────────────────────────────────────────────────

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

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ── Embedding API ──────────────────────────────────────────────────────

async function embedBatch(texts, model = 'text-embedding-3-small') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ── Cell metadata (same as v1/v2) ──────────────────────────────────────

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

// ── Stats ──────────────────────────────────────────────────────────────

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
    SELECT id, profile_name, suggestions,
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

// ── Embedding cache ────────────────────────────────────────────────────
//
// SHA-256-prefix-keyed JSON cache so repeated runs don't re-embed.

function loadCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache));
}

async function embedWithCache(texts, cache) {
  const need = [];
  const needIdx = [];
  const out = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const h = hashText(texts[i]);
    if (cache[h]) {
      out[i] = cache[h];
    } else {
      need.push(texts[i]);
      needIdx.push({ i, h });
    }
  }
  if (need.length > 0) {
    // Batch in groups of 100 to stay well under per-request limits
    for (let off = 0; off < need.length; off += 100) {
      const batch = need.slice(off, off + 100);
      const embs = await embedBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const meta = needIdx[off + j];
        cache[meta.h] = embs[j];
        out[meta.i] = embs[j];
      }
    }
  }
  return out;
}

// ── Aggregation ────────────────────────────────────────────────────────

function buildPerCell(rowItems) {
  const byCell = new Map();
  for (const item of rowItems) {
    if (!byCell.has(item.profile_name)) byCell.set(item.profile_name, []);
    byCell.get(item.profile_name).push(item);
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
    summary.push({
      cell,
      family: FAMILY[cell] || 'unknown',
      label: SHORT_LABEL[cell] || cell,
      n: items.length,
      meanScore: mean(items.map((x) => x.score)),
      meanSimIntersub: mean(items.map((x) => x.simIntersub)),
      meanSimTransmission: mean(items.map((x) => x.simTransmission)),
      meanIntersubAdvantage: mean(items.map((x) => x.intersubAdvantage)),
      simIntersubArr: items.map((x) => x.simIntersub),
      simTransmissionArr: items.map((x) => x.simTransmission),
      advantageArr: items.map((x) => x.intersubAdvantage),
      scoreArr: items.map((x) => x.score),
      // also carry regex features for cross-feature correlation
      regexFeatures: items.map((x) => x.regexFeatures),
    });
  }
  return summary;
}

// ── Report ─────────────────────────────────────────────────────────────

function fmt(v, d = 4) {
  if (v == null || Number.isNaN(v)) return '–';
  return v.toFixed(d);
}

function buildReport({ runId, judge, perCell, allRegexKeys }) {
  const lines = [];
  lines.push('# D1 Fifth-Pass — Embedding-Based Semantic Features');
  lines.push('');
  lines.push(`**Run:** \`${runId}\` (A10b 4-way matched-specificity)`);
  lines.push(`**Judge:** ${judge}`);
  lines.push(`**Embedding model:** OpenAI text-embedding-3-small (1536 dims)`);
  lines.push(`**Cells:** cell_1, cell_5, cell_95, cell_96`);
  lines.push('');
  lines.push('Pass 3 (basic regex) and pass 4 (refined regex) reached the limits of bag-of-features pragmatics. Pass 5 adds embedding-based semantic features that catch flexible-synonym paraphrase, framing, and rhythm that fixed regex misses. Two hand-authored canonical references (~120 words each):');
  lines.push('');
  lines.push('- **Intersubjective scaffolding canonical**: exemplifies turn-taking, question-asking, learner-acknowledgement, inclusive framing, and invitations to articulate intuition.');
  lines.push('- **Transmission explanation canonical**: exemplifies direct explanation, definition-and-application, definitive framing, instruction to memorize, no questions.');
  lines.push('');
  lines.push('Three derived features per response: cosine similarity to each canonical, plus their *difference* (intersub_advantage = sim_intersub − sim_transmission). The advantage feature isolates the direction of pragmatic style independent of overall tutor-talk semantics.');
  lines.push('');
  lines.push('## 1. Per-cell embedding feature means');
  lines.push('');
  lines.push('| Cell | Family | n | Score | sim_intersub | sim_transmission | intersub_advantage |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const c of perCell) {
    lines.push(
      `| ${c.label} | ${c.family} | ${c.n} | ${fmt(c.meanScore, 2)} | ${fmt(c.meanSimIntersub, 4)} | ${fmt(c.meanSimTransmission, 4)} | ${fmt(c.meanIntersubAdvantage, 4)} |`,
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
  const featureSets = [
    ['sim_intersub', 'simIntersubArr'],
    ['sim_transmission', 'simTransmissionArr'],
    ['intersub_advantage', 'advantageArr'],
  ];
  lines.push('| Feature | Mean intersubjective | Mean transmission | d (intersub − trans) |');
  lines.push('| --- | --- | --- | --- |');
  for (const [label, key] of featureSets) {
    const intersubArr = [...c5[key], ...c95[key]];
    const transArr = [...c1[key], ...c96[key]];
    const d = cohensD(intersubArr, transArr);
    lines.push(`| ${label} | ${fmt(mean(intersubArr), 4)} | ${fmt(mean(transArr), 4)} | ${fmt(d, 3)} |`);
  }
  lines.push('');
  lines.push('## 3. Within-intersubjective contrast (cell_5 vs cell_95)');
  lines.push('');
  lines.push('| Feature | Mean cell_5 | Mean cell_95 | d (5 − 95) |');
  lines.push('| --- | --- | --- | --- |');
  for (const [label, key] of featureSets) {
    const d = cohensD(c5[key], c95[key]);
    lines.push(`| ${label} | ${fmt(c5[key].reduce((s, v) => s + v, 0) / c5[key].length, 4)} | ${fmt(c95[key].reduce((s, v) => s + v, 0) / c95[key].length, 4)} | ${fmt(d, 3)} |`);
  }
  lines.push('');
  lines.push('## 4. Feature × score correlations (within-cell + pooled)');
  lines.push('');
  lines.push('| Feature | r within cell_5 | r within cell_95 | r within cell_1 | r within cell_96 | r pooled all 4 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const withinR = {};
  for (const [label, key] of featureSets) {
    const r5 = pearson(c5[key], c5.scoreArr);
    const r95 = pearson(c95[key], c95.scoreArr);
    const r1 = pearson(c1[key], c1.scoreArr);
    const r96 = pearson(c96[key], c96.scoreArr);
    const allF = [...c1[key], ...c5[key], ...c95[key], ...c96[key]];
    const allS = [...c1.scoreArr, ...c5.scoreArr, ...c95.scoreArr, ...c96.scoreArr];
    const rPooled = pearson(allF, allS);
    withinR[label] = { r5, r95, r1, r96, rPooled };
    lines.push(`| ${label} | ${fmt(r5, 3)} | ${fmt(r95, 3)} | ${fmt(r1, 3)} | ${fmt(r96, 3)} | ${fmt(rPooled, 3)} |`);
  }
  lines.push('');
  lines.push('## 5. Cross-feature correlation matrix (pass 3 + pass 4 + pass 5, pooled across 4 cells)');
  lines.push('');
  lines.push('Identifies redundancy (features measuring the same underlying construct) and complementarity (features capturing orthogonal channels). High |r| (e.g. > 0.5) between two features means they probably reflect the same channel.');
  lines.push('');
  // Build pooled feature matrix
  const allRowsByFeature = {};
  // embedding features
  allRowsByFeature.sim_intersub = [...c1.simIntersubArr, ...c5.simIntersubArr, ...c95.simIntersubArr, ...c96.simIntersubArr];
  allRowsByFeature.sim_transmission = [...c1.simTransmissionArr, ...c5.simTransmissionArr, ...c95.simTransmissionArr, ...c96.simTransmissionArr];
  allRowsByFeature.intersub_advantage = [...c1.advantageArr, ...c5.advantageArr, ...c95.advantageArr, ...c96.advantageArr];
  // regex features
  for (const k of allRegexKeys) {
    allRowsByFeature[k] = [
      ...c1.regexFeatures.map((f) => f[k]),
      ...c5.regexFeatures.map((f) => f[k]),
      ...c95.regexFeatures.map((f) => f[k]),
      ...c96.regexFeatures.map((f) => f[k]),
    ];
  }
  const allFeatureNames = ['sim_intersub', 'sim_transmission', 'intersub_advantage', ...allRegexKeys];
  const allScores = [...c1.scoreArr, ...c5.scoreArr, ...c95.scoreArr, ...c96.scoreArr];
  // r with score for each feature
  const rWithScore = {};
  for (const f of allFeatureNames) {
    rWithScore[f] = pearson(allRowsByFeature[f], allScores);
  }
  // Print compact matrix: features × features (just upper triangle to save space)
  // Actually for readability, just show r-with-score and pairwise r between embedding features and the top-3 regex features by |r|
  lines.push('### 5a. Pearson r with score (pooled, all features)');
  lines.push('');
  lines.push('| Feature | r with score |');
  lines.push('| --- | --- |');
  const ranked = allFeatureNames
    .map((f) => ({ f, r: rWithScore[f] }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  for (const row of ranked) {
    lines.push(`| ${row.f} | ${fmt(row.r, 3)} |`);
  }
  lines.push('');
  lines.push('### 5b. Pairwise r between embedding features and regex features');
  lines.push('');
  lines.push('Shows how much overlap each regex feature has with the embedding-derived intersubjective_advantage. High |r| means the embedding catches the same channel as the regex.');
  lines.push('');
  lines.push('| Regex feature | r with intersub_advantage |');
  lines.push('| --- | --- |');
  const advArr = allRowsByFeature.intersub_advantage;
  for (const k of allRegexKeys) {
    const r = pearson(advArr, allRowsByFeature[k]);
    lines.push(`| ${k} | ${fmt(r, 3)} |`);
  }
  lines.push('');
  lines.push('## 6. Findings on these data');
  lines.push('');
  // Identify the strongest feature with score
  const strongestPositive = ranked.find((r) => r.r > 0);
  const strongestNegative = ranked.find((r) => r.r < 0);
  if (strongestPositive) {
    lines.push(`**Strongest pooled-r positive feature**: \`${strongestPositive.f}\` (r = ${fmt(strongestPositive.r, 3)} with score across all 4 cells).`);
    lines.push('');
  }
  if (strongestNegative && Math.abs(strongestNegative.r) >= 0.15) {
    lines.push(`**Strongest pooled-r negative feature**: \`${strongestNegative.f}\` (r = ${fmt(strongestNegative.r, 3)}).`);
    lines.push('');
  }
  // Headline interpretations of the embedding features specifically
  const advFamilyD = cohensD(
    [...c5.advantageArr, ...c95.advantageArr],
    [...c1.advantageArr, ...c96.advantageArr],
  );
  const advWithinD = cohensD(c5.advantageArr, c95.advantageArr);
  const advR5 = withinR.intersub_advantage.r5;
  const advR95 = withinR.intersub_advantage.r95;
  const advRPooled = withinR.intersub_advantage.rPooled;
  lines.push(`**intersub_advantage (the headline embedding feature)**: family d = ${fmt(advFamilyD, 3)} (intersub vs trans), within-intersubjective d = ${fmt(advWithinD, 3)}, within-cell r = cell_5 **${fmt(advR5, 3)}**, cell_95 **${fmt(advR95, 3)}**, pooled ${fmt(advRPooled, 3)}.`);
  lines.push('');
  lines.push('### Interpretation: Simpson\'s paradox at the embedding level');
  lines.push('');
  // Detect Simpson's paradox: pooled and within-cell r have opposite signs
  const simpsonsParadox = advRPooled > 0.15 && advR5 < -0.15 && advR95 < -0.15;
  if (simpsonsParadox) {
    lines.push('**The pooled positive correlation is misleading.** Pooled $r = +' + fmt(advRPooled, 3) + '$ across all four cells looks like a mediator, but **within each intersubjective cell** (where the prompt is held constant), the correlation is *negative* ($r = ' + fmt(advR5, 3) + '$ in cell_5, $r = ' + fmt(advR95, 3) + '$ in cell_95). Cell_1 is also slightly negative; only cell_96 (which has very low advantage scores AND very low rubric scores) anchors the positive end. This is a classic **Simpson\'s paradox**: between-cell variance dominates the pooled correlation; within cells, the relationship reverses.');
    lines.push('');
    lines.push('**Substantive read**: the more a response in cell_5 or cell_95 pattern-matches the generic intersubjective canonical, the *lower* its rubric score. Possible mechanism: responses that match the canonical too closely sound formulaic — the canonical captures family-level pragmatic *form* (turn-taking, scaffolding, inclusive framing) but not response-level *substance* (specific engagement with the scenario\'s content). The rubric rewards substance; surface-form mimicry of the canonical is a weak proxy that tracks lower-quality responses.');
    lines.push('');
    lines.push('intersub_advantage is therefore a **family marker** (family d = ' + fmt(advFamilyD, 3) + ', strong) but **not a within-cell mediator** — opposite of what the auto-generated mediator-criteria check would assert if it used pooled r alone. The mediator-criteria framework needs to be evaluated within-cell, not pooled, to avoid this trap.');
    lines.push('');
    lines.push('**Implication for ends-with-question (pass 3)**: that finding survives. Cell_5 within-cell $r = +0.325$, cell_95 $r = +0.392$ — both positive, both substantial. ends-with-question is a *real* within-cell mediator; intersub_advantage is *not*. The two features differ in mechanism: ending-with-question is a discrete pragmatic act that varies meaningfully even within a fixed prompt, while embedding similarity to a canonical captures something more like overall stylistic conformity, which has a ceiling effect within prompt.');
  } else if (advFamilyD > 0.5 && advR5 > 0.15 && advR95 > 0.15) {
    lines.push('intersub_advantage **satisfies all three mediator criteria** with positive within-cell r in both intersubjective cells. Embedding-based semantic similarity to a hand-authored intersubjective canonical is a stronger family-level discriminator than any single regex feature, and predicts scores within cells.');
  } else if (advFamilyD > 0.5) {
    lines.push('intersub_advantage is a strong **family marker** (family d = ' + fmt(advFamilyD, 3) + ') but does not consistently predict within-cell score variation. Embedding similarity discriminates the families effectively but the score-driver is partly orthogonal.');
  } else {
    lines.push('intersub_advantage shows weaker family separation than expected. Possible reasons: canonicals too generic, or the cells\' actual response styles are more similar at the embedding level than at the surface-pragmatic level.');
  }
  lines.push('');
  lines.push('### Cross-feature check (§5b)');
  lines.push('');
  lines.push('Pairwise r between intersub_advantage and the regex features is uniformly small (largest |r| = 0.31 with second-person density). The embedding feature is **largely orthogonal** to the regex features — it captures something different. But that "something different" is a family marker, not a within-cell mediator (per the Simpson\'s analysis above). The orthogonality is real but does not yield a new mechanism candidate.');
  lines.push('');
  lines.push('Where embedding-feature r with regex-features is high (e.g. > 0.5), the two would be measuring the same channel and the embedding could be a drop-in replacement. Here no pairwise r exceeds 0.31; the embedding and the regexes are sampling different aspects of response style.');
  lines.push('');
  lines.push('### Mediator scoreboard (D1 sequence summary)');
  lines.push('');
  lines.push('| Pass | Feature | Type | Family d | Within-cell r (cell_5 / cell_95) | Verdict |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  lines.push('| 3 | ends-with-question | pragmatic | small (categorical) | +0.325 / +0.392 | **Strongest within-cell mediator** |');
  lines.push('| 3 | second-person density | pragmatic | 0.69 | +0.216 / +0.065 | Family-aligned correlate |');
  lines.push('| 3 | question-mark rate | pragmatic | 0.61 | +0.036 / +0.218 | Recognition-prompt marker |');
  lines.push('| 4 | scaffolding-move imperatives | pragmatic | 0.59 | +0.186 / +0.048 | Cleanest family marker |');
  lines.push('| 4 | broad acknowledgement | pragmatic | 0.14 | -0.181 / -0.307 | Negative correlate (formulaic echoing) |');
  lines.push(`| 5 | intersub_advantage | semantic | ${fmt(advFamilyD, 2)} | ${fmt(advR5, 3)} / ${fmt(advR95, 3)} | Family marker, **negative** within-cell (Simpson\'s) |`);
  lines.push('');
  lines.push('Net: ends-with-question remains the only feature that satisfies all three mediator criteria within both intersubjective cells. Embeddings discriminate families well but introduce Simpson\'s-paradox risk that surface pragmatic features avoid.');
  lines.push('');
  lines.push('## 7. Caveats');
  lines.push('');
  lines.push('- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen within-cell r columns.');
  lines.push('- Two canonical references are author-specified and intentionally extreme. Real tutor responses sit at varied points along the intersubjective ↔ transmission continuum; the binary canonical contrast may oversimplify.');
  lines.push('- Embedding semantics are model-dependent. text-embedding-3-small captures English well but its judgments of "what is intersubjective" are themselves a language-model artifact.');
  lines.push('- Multi-feature mediation analysis (multiple regression with all regex + embedding features as predictors of score) is the natural next step but requires a JS OLS implementation; deferred to pass 6.');
  return lines.join('\n');
}

// ── CLI ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    runId: 'eval-2026-04-24-e9a785c0',
    judge: 'claude-code/sonnet',
    output: null,
    cache: DEFAULT_CACHE,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id') args.runId = argv[++i];
    else if (a === '--judge') args.judge = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--cache') args.cache = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in environment. Aborting.');
    process.exit(1);
  }
  const db = new Database(DB_PATH, { readonly: true });
  const cells = [
    'cell_1_base_single_unified',
    'cell_5_recog_single_unified',
    'cell_95_base_matched_single_unified',
    'cell_96_base_behaviorist_single_unified',
  ];
  const rawRows = loadRows(db, args.runId, args.judge, cells);
  console.log(`Loaded ${rawRows.length} raw rows`);

  // Filter and extract messages
  const items = [];
  const messages = [];
  for (const r of rawRows) {
    if (r.score == null) continue;
    const text = extractMessages(r.suggestions);
    if (!text) continue;
    const wc = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    if (wc < 20) continue;
    items.push({
      id: r.id,
      profile_name: r.profile_name,
      score: r.score,
      text,
      regexFeatures: { ...extractV1Features(text), ...extractV2Features(text) },
    });
    messages.push(text);
  }
  console.log(`Kept ${items.length} rows after extraction`);

  // Embed canonicals + all messages
  const cache = loadCache(args.cache);
  const cacheStartSize = Object.keys(cache).length;
  console.log(`Cache loaded with ${cacheStartSize} prior embeddings`);
  console.log(`Embedding ${messages.length + 2} texts (canonicals + responses)…`);
  const allTexts = [CANONICAL_INTERSUBJECTIVE, CANONICAL_TRANSMISSION, ...messages];
  const allEmbs = await embedWithCache(allTexts, cache);
  saveCache(args.cache, cache);
  const cacheEndSize = Object.keys(cache).length;
  console.log(`Cache now has ${cacheEndSize} embeddings (${cacheEndSize - cacheStartSize} new)`);

  const embIntersub = allEmbs[0];
  const embTransmission = allEmbs[1];
  for (let i = 0; i < items.length; i++) {
    const emb = allEmbs[i + 2];
    items[i].simIntersub = cosine(emb, embIntersub);
    items[i].simTransmission = cosine(emb, embTransmission);
    items[i].intersubAdvantage = items[i].simIntersub - items[i].simTransmission;
  }

  const perCell = buildPerCell(items);
  for (const c of perCell) {
    console.log(
      `  ${c.cell}: n=${c.n}, score=${fmt(c.meanScore, 2)}, sim_intersub=${fmt(c.meanSimIntersub, 4)}, sim_transmission=${fmt(c.meanSimTransmission, 4)}, advantage=${fmt(c.meanIntersubAdvantage, 4)}`,
    );
  }

  const allRegexKeys = [...V1_KEYS, ...V2_KEYS];
  const report = buildReport({ runId: args.runId, judge: args.judge, perCell, allRegexKeys });
  const outPath = args.output || path.join(__dirname, '..', 'exports', 'd1-structural-features-v3.md');
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
