#!/usr/bin/env node
/**
 * Post-hoc analysis of modulation (Drama Machine) and synthetic learning outcomes.
 *
 * Track 1 analysis — uses existing data only, no new evaluations.
 *
 * (a) MODULATION METRICS (N=350 factorial):
 *     - Response length variability (CV) by condition
 *     - Vocabulary richness (type-token ratio) by condition
 *     - Dimension score variance (within-cell) — proxy for behavioral range
 *     - Ego-Superego negotiation rounds (multi-agent only)
 *
 * (b) SYNTHETIC LEARNING OUTCOME INDEX (N=118 bilateral):
 *     - Composite from existing learner rubric: revision_signals × 0.35
 *       + question_quality × 0.30 + conceptual_engagement × 0.35
 *     - Learning arc trajectory (turn 1 → turn N score progression)
 *     - Per-condition breakdown (recognition × architecture 2×2)
 *
 * Usage:
 *   node scripts/analyze-modulation-learning.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseEpochArg, getEpochFilter, printEpochBanner } from '../services/epochFilter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');
const db = new Database(DB_PATH, { readonly: true });

const epoch = parseEpochArg(process.argv);
const epochFilter = getEpochFilter(epoch);
printEpochBanner(epoch);

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function cv(arr) {
  const m = mean(arr);
  return m > 0 ? std(arr) / m : 0;
}

function ttr(text) {
  // Type-token ratio: unique words / total words
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!words.length) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

function cohensD(group1, group2) {
  const m1 = mean(group1),
    m2 = mean(group2);
  const s1 = std(group1),
    s2 = std(group2);
  const pooled = Math.sqrt(
    ((group1.length - 1) * s1 ** 2 + (group2.length - 1) * s2 ** 2) / (group1.length + group2.length - 2),
  );
  return pooled > 0 ? (m1 - m2) / pooled : 0;
}

function fTest2x2(data) {
  // Simple 2×2 ANOVA — returns F for main effects and interaction
  // data: { a0b0: [], a0b1: [], a1b0: [], a1b1: [] }
  const grandMean = mean([...data.a0b0, ...data.a0b1, ...data.a1b0, ...data.a1b1]);
  const n = data.a0b0.length + data.a0b1.length + data.a1b0.length + data.a1b1.length;

  const cellMeans = {
    a0b0: mean(data.a0b0),
    a0b1: mean(data.a0b1),
    a1b0: mean(data.a1b0),
    a1b1: mean(data.a1b1),
  };

  const margA0 = mean([...data.a0b0, ...data.a0b1]);
  const margA1 = mean([...data.a1b0, ...data.a1b1]);
  const margB0 = mean([...data.a0b0, ...data.a1b0]);
  const margB1 = mean([...data.a0b1, ...data.a1b1]);

  // SS for main effects
  const nA0 = data.a0b0.length + data.a0b1.length;
  const nA1 = data.a1b0.length + data.a1b1.length;
  const ssA = nA0 * (margA0 - grandMean) ** 2 + nA1 * (margA1 - grandMean) ** 2;

  const nB0 = data.a0b0.length + data.a1b0.length;
  const nB1 = data.a0b1.length + data.a1b1.length;
  const ssB = nB0 * (margB0 - grandMean) ** 2 + nB1 * (margB1 - grandMean) ** 2;

  // SS interaction
  const interaction = cellMeans.a1b1 - cellMeans.a1b0 - (cellMeans.a0b1 - cellMeans.a0b0);

  // SS within (error)
  let ssW = 0;
  for (const [key, arr] of Object.entries(data)) {
    const m = cellMeans[key];
    ssW += arr.reduce((s, x) => s + (x - m) ** 2, 0);
  }
  const dfW = n - 4;
  const msW = ssW / dfW;

  return {
    mainA: { F: ssA / 1 / msW, marginals: [margA0, margA1], delta: margA1 - margA0 },
    mainB: { F: ssB / 1 / msW, marginals: [margB0, margB1], delta: margB1 - margB0 },
    interaction: interaction,
    cellMeans,
    msW,
    dfW,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) MODULATION METRICS — N=350 factorial
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════');
console.log('  MODULATION ANALYSIS (Drama Machine Evidence)');
console.log('  N=350 factorial, Kimi K2.5 ego, Opus judge');
console.log('═══════════════════════════════════════════════════════════════\n');

const factorialRows = db
  .prepare(
    `
  SELECT profile_name, suggestions, dialogue_rounds,
         score_relevance, score_specificity, score_pedagogical,
         score_personalization, score_actionability, score_tone,
         tutor_first_turn_score, scores_with_reasoning, scenario_name
  FROM evaluation_results
  WHERE run_id IN ('eval-2026-02-03-f5d4dd93', 'eval-2026-02-06-a933d745')
    AND tutor_first_turn_score IS NOT NULL
    AND judge_model LIKE '%claude%'
    ${epochFilter.and}
`,
  )
  .all();

console.log(`Factorial rows: ${factorialRows.length}\n`);

// Classify into 4 conditions
const conditions = {
  base_single: [],
  base_multi: [],
  recog_single: [],
  recog_multi: [],
};

for (const row of factorialRows) {
  const isRecog = row.profile_name.includes('recog');
  const isMulti = row.profile_name.includes('multi');
  const key = `${isRecog ? 'recog' : 'base'}_${isMulti ? 'multi' : 'single'}`;

  // Extract message text from JSON suggestions
  let messageText = '';
  try {
    const suggestions = JSON.parse(row.suggestions);
    messageText = suggestions.map((s) => [s.message, s.title, s.reason].filter(Boolean).join(' ')).join(' ');
  } catch {
    messageText = row.suggestions || '';
  }

  // Dimension scores as array (for variance computation)
  const dimScores = [
    row.score_relevance,
    row.score_specificity,
    row.score_pedagogical,
    row.score_personalization,
    row.score_actionability,
    row.score_tone,
  ].filter((x) => x != null);

  // Extended dimensions from JSON if available
  const extDimScores = [...dimScores];
  if (row.scores_with_reasoning) {
    try {
      const parsed = JSON.parse(row.scores_with_reasoning);
      for (const key of [
        'mutual_recognition',
        'dialectical_responsiveness',
        'memory_integration',
        'transformative_potential',
        'tutor_adaptation',
        'learner_growth',
        'productive_struggle',
        'epistemic_honesty',
      ]) {
        if (parsed[key]?.score != null) extDimScores.push(parsed[key].score);
      }
    } catch {
      /* no-op */
    }
  }

  conditions[key].push({
    responseLength: messageText.length,
    wordCount: messageText.split(/\s+/).filter((w) => w.length > 0).length,
    ttr: ttr(messageText),
    dialogueRounds: row.dialogue_rounds || 0,
    tutorFirstTurnScore: row.tutor_first_turn_score,
    dimScoreVariance: std(dimScores),
    extDimScoreVariance: std(extDimScores),
    scenario: row.scenario_name,
  });
}

// ── Report: Response Length ──────────────────────────────────────────────

console.log('─── Response Length (chars) ─────────────────────────────────');
console.log('Condition          |   N  |   Mean  |    SD   |    CV');
console.log('───────────────────|──────|─────────|─────────|────────');
for (const [key, items] of Object.entries(conditions)) {
  const lens = items.map((i) => i.responseLength);
  console.log(
    `${key.padEnd(19)}| ${items.length.toString().padStart(4)} | ${mean(lens).toFixed(1).padStart(7)} | ${std(lens).toFixed(1).padStart(7)} | ${cv(lens).toFixed(3).padStart(6)}`,
  );
}

// Cross-condition comparisons
const allSingle = [...conditions.base_single, ...conditions.recog_single];
const allMulti = [...conditions.base_multi, ...conditions.recog_multi];
const allBase = [...conditions.base_single, ...conditions.base_multi];
const allRecog = [...conditions.recog_single, ...conditions.recog_multi];

console.log('\nLength CV by factor:');
console.log(`  Single-agent: ${cv(allSingle.map((i) => i.responseLength)).toFixed(3)}`);
console.log(`  Multi-agent:  ${cv(allMulti.map((i) => i.responseLength)).toFixed(3)}`);
console.log(`  Base:         ${cv(allBase.map((i) => i.responseLength)).toFixed(3)}`);
console.log(`  Recognition:  ${cv(allRecog.map((i) => i.responseLength)).toFixed(3)}`);

// ── Report: Vocabulary Richness (Type-Token Ratio) ───────────────────────

console.log('\n─── Vocabulary Richness (Type-Token Ratio) ─────────────────');
console.log('Condition          |   N  |  Mean TTR |    SD');
console.log('───────────────────|──────|──────────|────────');
for (const [key, items] of Object.entries(conditions)) {
  const ttrs = items.map((i) => i.ttr);
  console.log(
    `${key.padEnd(19)}| ${items.length.toString().padStart(4)} | ${mean(ttrs).toFixed(4).padStart(8)} | ${std(ttrs).toFixed(4).padStart(6)}`,
  );
}

// ── Report: Dimension Score Variance (Behavioral Range) ──────────────────

console.log('\n─── Dimension Score Variance (Behavioral Range Proxy) ──────');
console.log('Higher variance = more differentiated scoring across dimensions');
console.log('= tutor modulates behavior across pedagogical dimensions\n');
console.log('Condition          |   N  | Mean σ(6-dim) | Mean σ(14-dim)');
console.log('───────────────────|──────|───────────────|───────────────');
for (const [key, items] of Object.entries(conditions)) {
  const dim6 = items.map((i) => i.dimScoreVariance);
  const dim14 = items.map((i) => i.extDimScoreVariance);
  console.log(
    `${key.padEnd(19)}| ${items.length.toString().padStart(4)} | ${mean(dim6).toFixed(3).padStart(13)} | ${mean(dim14).toFixed(3).padStart(13)}`,
  );
}

// ── Report: Within-Scenario Response Diversity ───────────────────────────

console.log('\n─── Within-Scenario Response Diversity ─────────────────────');
console.log('CV of tutor_first_turn_score within each (condition × scenario) cell');
console.log('Higher CV = more varied quality across attempts = modulation\n');

const scenarioMap = {};
for (const [key, items] of Object.entries(conditions)) {
  for (const item of items) {
    const cellKey = `${key}|${item.scenario}`;
    if (!scenarioMap[cellKey]) scenarioMap[cellKey] = [];
    scenarioMap[cellKey].push(item.tutorFirstTurnScore);
  }
}

// Aggregate: mean CV per condition
const conditionCVs = {};
for (const [cellKey, scores] of Object.entries(scenarioMap)) {
  const cond = cellKey.split('|')[0];
  if (!conditionCVs[cond]) conditionCVs[cond] = [];
  if (scores.length >= 3) conditionCVs[cond].push(cv(scores));
}

console.log('Condition          | Mean CV(score) | N cells');
console.log('───────────────────|────────────────|────────');
for (const [key, cvArr] of Object.entries(conditionCVs)) {
  console.log(`${key.padEnd(19)}| ${mean(cvArr).toFixed(4).padStart(14)} | ${cvArr.length.toString().padStart(6)}`);
}

// ── Report: Ego-Superego Negotiation Rounds ──────────────────────────────

console.log('\n─── Ego-Superego Negotiation Rounds (Multi-Agent Only) ─────');
const multiRounds = {};
for (const key of ['base_multi', 'recog_multi']) {
  const rounds = conditions[key].map((i) => i.dialogueRounds);
  multiRounds[key] = rounds;
  console.log(
    `${key.padEnd(19)}: mean=${mean(rounds).toFixed(2)}, sd=${std(rounds).toFixed(2)}, range=[${Math.min(...rounds)}, ${Math.max(...rounds)}]`,
  );
}

// ── Summary Statistics ───────────────────────────────────────────────────

console.log('\n─── MODULATION SUMMARY (2×2: Recognition × Architecture) ───');

// Response length 2×2
const lenData = {
  a0b0: conditions.base_single.map((i) => i.responseLength),
  a0b1: conditions.base_multi.map((i) => i.responseLength),
  a1b0: conditions.recog_single.map((i) => i.responseLength),
  a1b1: conditions.recog_multi.map((i) => i.responseLength),
};
const lenAnova = fTest2x2(lenData);
console.log(`\nResponse Length:`);
console.log(
  `  Recognition effect: ${lenAnova.mainA.delta > 0 ? '+' : ''}${lenAnova.mainA.delta.toFixed(1)} chars, F=${lenAnova.mainA.F.toFixed(2)}`,
);
console.log(
  `  Architecture effect: ${lenAnova.mainB.delta > 0 ? '+' : ''}${lenAnova.mainB.delta.toFixed(1)} chars, F=${lenAnova.mainB.F.toFixed(2)}`,
);
console.log(`  Interaction: ${lenAnova.interaction > 0 ? '+' : ''}${lenAnova.interaction.toFixed(1)} chars`);

// Dimension variance 2×2
const varData = {
  a0b0: conditions.base_single.map((i) => i.extDimScoreVariance),
  a0b1: conditions.base_multi.map((i) => i.extDimScoreVariance),
  a1b0: conditions.recog_single.map((i) => i.extDimScoreVariance),
  a1b1: conditions.recog_multi.map((i) => i.extDimScoreVariance),
};
const varAnova = fTest2x2(varData);
console.log(`\nDimension Score Variance (14-dim):`);
console.log(
  `  Recognition effect: ${varAnova.mainA.delta > 0 ? '+' : ''}${varAnova.mainA.delta.toFixed(3)}, F=${varAnova.mainA.F.toFixed(2)}`,
);
console.log(
  `  Architecture effect: ${varAnova.mainB.delta > 0 ? '+' : ''}${varAnova.mainB.delta.toFixed(3)}, F=${varAnova.mainB.F.toFixed(2)}`,
);
console.log(`  Interaction: ${varAnova.interaction > 0 ? '+' : ''}${varAnova.interaction.toFixed(3)}`);

// TTR 2×2
const ttrData = {
  a0b0: conditions.base_single.map((i) => i.ttr),
  a0b1: conditions.base_multi.map((i) => i.ttr),
  a1b0: conditions.recog_single.map((i) => i.ttr),
  a1b1: conditions.recog_multi.map((i) => i.ttr),
};
const ttrAnova = fTest2x2(ttrData);
console.log(`\nVocabulary Richness (TTR):`);
console.log(
  `  Recognition effect: ${ttrAnova.mainA.delta > 0 ? '+' : ''}${ttrAnova.mainA.delta.toFixed(4)}, F=${ttrAnova.mainA.F.toFixed(2)}`,
);
console.log(
  `  Architecture effect: ${ttrAnova.mainB.delta > 0 ? '+' : ''}${ttrAnova.mainB.delta.toFixed(4)}, F=${ttrAnova.mainB.F.toFixed(2)}`,
);
console.log(`  Interaction: ${ttrAnova.interaction > 0 ? '+' : ''}${ttrAnova.interaction.toFixed(4)}`);

// Cohen's d for key comparisons
console.log("\n─── Effect Sizes (Cohen's d) ────────────────────────────────");
console.log(
  `Response length:  recognition d=${cohensD(
    allRecog.map((i) => i.responseLength),
    allBase.map((i) => i.responseLength),
  ).toFixed(2)}`,
);
console.log(
  `                  architecture d=${cohensD(
    allMulti.map((i) => i.responseLength),
    allSingle.map((i) => i.responseLength),
  ).toFixed(2)}`,
);
console.log(
  `TTR:              recognition d=${cohensD(
    allRecog.map((i) => i.ttr),
    allBase.map((i) => i.ttr),
  ).toFixed(2)}`,
);
console.log(
  `                  architecture d=${cohensD(
    allMulti.map((i) => i.ttr),
    allSingle.map((i) => i.ttr),
  ).toFixed(2)}`,
);
console.log(
  `Dim variance:     recognition d=${cohensD(
    allRecog.map((i) => i.extDimScoreVariance),
    allBase.map((i) => i.extDimScoreVariance),
  ).toFixed(2)}`,
);
console.log(
  `                  architecture d=${cohensD(
    allMulti.map((i) => i.extDimScoreVariance),
    allSingle.map((i) => i.extDimScoreVariance),
  ).toFixed(2)}`,
);

// ═══════════════════════════════════════════════════════════════════════════
// (b) SYNTHETIC LEARNING OUTCOME INDEX — N=118 bilateral
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  SYNTHETIC LEARNING OUTCOME ANALYSIS');
console.log('  N=118 bilateral run, 3 multi-turn scenarios, Opus judge');
console.log('═══════════════════════════════════════════════════════════════\n');

const bilateralRows = db
  .prepare(
    `
  SELECT profile_name, learner_scores, learner_overall_score, scenario_name
  FROM evaluation_results
  WHERE run_id = 'eval-2026-02-07-b6d75e87'
    AND tutor_first_turn_score IS NOT NULL
    AND learner_scores IS NOT NULL
    ${epochFilter.and}
`,
  )
  .all();

console.log(`Bilateral rows with learner scores: ${bilateralRows.length}\n`);

// Parse learner scores and compute composite learning outcome
const learnerConditions = {
  base_single: [],
  base_multi: [],
  recog_single: [],
  recog_multi: [],
};

for (const row of bilateralRows) {
  const isRecog = row.profile_name.includes('recog');
  const isMulti = row.profile_name.includes('multi');
  const key = `${isRecog ? 'recog' : 'base'}_${isMulti ? 'multi' : 'single'}`;

  let learnerData;
  try {
    learnerData = JSON.parse(row.learner_scores);
  } catch {
    continue;
  }

  // Extract per-turn scores for learning outcome dimensions
  const turnScores = [];
  for (const turnKey of Object.keys(learnerData).sort()) {
    const turn = learnerData[turnKey];
    if (!turn?.scores) continue;
    const s = turn.scores;

    const revisionScore = s.revision_signals?.score || 0;
    const questionScore = s.question_quality?.score || 0;
    const conceptualScore = s.conceptual_engagement?.score || 0;

    // Composite: weighted average of learning-relevant dimensions
    // Maps 1-5 → 0-100 for comparability
    const composite = ((revisionScore * 0.35 + questionScore * 0.3 + conceptualScore * 0.35 - 1) / 4) * 100;

    turnScores.push({
      turnIndex: turn.turnIndex || parseInt(turnKey),
      revision: revisionScore,
      question: questionScore,
      conceptual: conceptualScore,
      composite,
      overallLearner: turn.overallScore || 0,
    });
  }

  if (turnScores.length === 0) continue;

  // Learning arc: last turn composite minus first turn composite
  const learningArc = turnScores.length > 1 ? turnScores[turnScores.length - 1].composite - turnScores[0].composite : 0;

  // Average composite across turns
  const avgComposite = mean(turnScores.map((t) => t.composite));

  // Final turn composite (strongest signal of learning outcome)
  const finalComposite = turnScores[turnScores.length - 1].composite;

  // Revision signal progression: does revision_signals increase?
  const revisionProgression =
    turnScores.length > 1 ? turnScores[turnScores.length - 1].revision - turnScores[0].revision : 0;

  learnerConditions[key].push({
    avgComposite,
    finalComposite,
    learningArc,
    revisionProgression,
    overallLearner: row.learner_overall_score,
    turnCount: turnScores.length,
    turnScores,
    scenario: row.scenario_name,
  });
}

// ── Report: Composite Learning Outcome ───────────────────────────────────

console.log('─── Synthetic Learning Outcome (Composite Index, 0–100) ────');
console.log('Weights: revision_signals (35%) + question_quality (30%) + conceptual_engagement (35%)\n');
console.log('Condition          |   N  | Avg Composite | Final Turn | Learning Arc');
console.log('───────────────────|──────|───────────────|────────────|─────────────');
for (const [key, items] of Object.entries(learnerConditions)) {
  const avgC = items.map((i) => i.avgComposite);
  const finalC = items.map((i) => i.finalComposite);
  const arc = items.map((i) => i.learningArc);
  console.log(
    `${key.padEnd(19)}| ${items.length.toString().padStart(4)} | ${mean(avgC).toFixed(1).padStart(13)} | ${mean(finalC).toFixed(1).padStart(10)} | ${mean(arc).toFixed(1).padStart(11)}`,
  );
}

// ── 2×2 ANOVA on Composite Learning Outcome ─────────────────────────────

console.log('\n─── 2×2 ANOVA: Synthetic Learning Outcome ──────────────────');
const sloData = {
  a0b0: learnerConditions.base_single.map((i) => i.avgComposite),
  a0b1: learnerConditions.base_multi.map((i) => i.avgComposite),
  a1b0: learnerConditions.recog_single.map((i) => i.avgComposite),
  a1b1: learnerConditions.recog_multi.map((i) => i.avgComposite),
};
const sloAnova = fTest2x2(sloData);
console.log(
  `Recognition (A): delta=${sloAnova.mainA.delta > 0 ? '+' : ''}${sloAnova.mainA.delta.toFixed(1)}, F=${sloAnova.mainA.F.toFixed(2)}, marginals=[${sloAnova.mainA.marginals.map((m) => m.toFixed(1)).join(', ')}]`,
);
console.log(
  `Architecture (B): delta=${sloAnova.mainB.delta > 0 ? '+' : ''}${sloAnova.mainB.delta.toFixed(1)}, F=${sloAnova.mainB.F.toFixed(2)}, marginals=[${sloAnova.mainB.marginals.map((m) => m.toFixed(1)).join(', ')}]`,
);
console.log(`A×B Interaction: ${sloAnova.interaction > 0 ? '+' : ''}${sloAnova.interaction.toFixed(1)}`);
console.log(
  `Cell means: base_single=${sloAnova.cellMeans.a0b0.toFixed(1)}, base_multi=${sloAnova.cellMeans.a0b1.toFixed(1)}, recog_single=${sloAnova.cellMeans.a1b0.toFixed(1)}, recog_multi=${sloAnova.cellMeans.a1b1.toFixed(1)}`,
);

// ── Learning Arc 2×2 ────────────────────────────────────────────────────

console.log('\n─── 2×2 ANOVA: Learning Arc (Final − First Turn) ─────────');
const arcData = {
  a0b0: learnerConditions.base_single.map((i) => i.learningArc),
  a0b1: learnerConditions.base_multi.map((i) => i.learningArc),
  a1b0: learnerConditions.recog_single.map((i) => i.learningArc),
  a1b1: learnerConditions.recog_multi.map((i) => i.learningArc),
};
const arcAnova = fTest2x2(arcData);
console.log(
  `Recognition (A): delta=${arcAnova.mainA.delta > 0 ? '+' : ''}${arcAnova.mainA.delta.toFixed(1)}, F=${arcAnova.mainA.F.toFixed(2)}`,
);
console.log(
  `Architecture (B): delta=${arcAnova.mainB.delta > 0 ? '+' : ''}${arcAnova.mainB.delta.toFixed(1)}, F=${arcAnova.mainB.F.toFixed(2)}`,
);
console.log(`A×B Interaction: ${arcAnova.interaction > 0 ? '+' : ''}${arcAnova.interaction.toFixed(1)}`);
console.log(
  `Cell means: base_single=${arcAnova.cellMeans.a0b0.toFixed(1)}, base_multi=${arcAnova.cellMeans.a0b1.toFixed(1)}, recog_single=${arcAnova.cellMeans.a1b0.toFixed(1)}, recog_multi=${arcAnova.cellMeans.a1b1.toFixed(1)}`,
);

// ── Revision Signal Progression ──────────────────────────────────────────

console.log('\n─── Revision Signal Progression (Turn N − Turn 1) ─────────');
for (const [key, items] of Object.entries(learnerConditions)) {
  const prog = items.map((i) => i.revisionProgression);
  console.log(
    `${key.padEnd(19)}: mean=${mean(prog).toFixed(2)}, sd=${std(prog).toFixed(2)}, d=${cohensD(
      prog,
      learnerConditions.base_single.map((i) => i.revisionProgression),
    ).toFixed(2)} vs base_single`,
  );
}

// ── Effect Sizes ─────────────────────────────────────────────────────────

const allBaseLearner = [...learnerConditions.base_single, ...learnerConditions.base_multi];
const allRecogLearner = [...learnerConditions.recog_single, ...learnerConditions.recog_multi];
const allSingleLearner = [...learnerConditions.base_single, ...learnerConditions.recog_single];
const allMultiLearner = [...learnerConditions.base_multi, ...learnerConditions.recog_multi];

console.log("\n─── Effect Sizes (Cohen's d) ────────────────────────────────");
console.log(
  `Avg Composite:  recognition d=${cohensD(
    allRecogLearner.map((i) => i.avgComposite),
    allBaseLearner.map((i) => i.avgComposite),
  ).toFixed(2)}`,
);
console.log(
  `                architecture d=${cohensD(
    allMultiLearner.map((i) => i.avgComposite),
    allSingleLearner.map((i) => i.avgComposite),
  ).toFixed(2)}`,
);
console.log(
  `Learning Arc:   recognition d=${cohensD(
    allRecogLearner.map((i) => i.learningArc),
    allBaseLearner.map((i) => i.learningArc),
  ).toFixed(2)}`,
);
console.log(
  `                architecture d=${cohensD(
    allMultiLearner.map((i) => i.learningArc),
    allSingleLearner.map((i) => i.learningArc),
  ).toFixed(2)}`,
);
console.log(
  `Final Turn:     recognition d=${cohensD(
    allRecogLearner.map((i) => i.finalComposite),
    allBaseLearner.map((i) => i.finalComposite),
  ).toFixed(2)}`,
);
console.log(
  `                architecture d=${cohensD(
    allMultiLearner.map((i) => i.finalComposite),
    allSingleLearner.map((i) => i.finalComposite),
  ).toFixed(2)}`,
);

// ═══════════════════════════════════════════════════════════════════════════
// (c) COMBINED INTERPRETATION
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('  COMBINED INTERPRETATION');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('MODULATION (Does internal ego-superego tension produce more varied behavior?):');
console.log('  Metrics: response length CV, vocabulary richness (TTR), dimension score variance,');
console.log('           within-scenario score variability');
console.log('  Key comparison: multi-agent vs single-agent (Factor B)');
console.log('  Secondary: recognition vs base (Factor A) — recognition may induce more');
console.log('  context-sensitive modulation even without multi-agent architecture\n');

console.log('SYNTHETIC LEARNING OUTCOMES (Does the learner show evidence of conceptual growth?):');
console.log('  Composite index from: revision_signals (35%), question_quality (30%),');
console.log('                        conceptual_engagement (35%)');
console.log('  Key metric: Learning Arc (final turn − first turn composite)');
console.log('  Operationalizes Drama Machine "transformation" claim empirically\n');

db.close();
console.log('Done.');
