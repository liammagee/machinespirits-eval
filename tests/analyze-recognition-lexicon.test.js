import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOGNITION_LEXICON,
  CONCEPTS,
  extractText,
  wordCount,
  countConcept,
  computeConceptDensities,
  summarizeByConcept,
  summarizeOverall,
  pearson,
  buildReport,
  processRows,
} from '../scripts/analyze-recognition-lexicon.js';

test('lexicon covers the ten target concepts', () => {
  assert.deepEqual(
    CONCEPTS.sort(),
    ['autonomy', 'dialectic', 'genuine', 'hegel', 'intersubject', 'mutuality', 'recognition', 'repair', 'struggle', 'transformation'].sort(),
  );
});

test('extractText parses suggestions JSON and concatenates title/message/reasoning', () => {
  const json = JSON.stringify([
    { title: 'Recognize learner autonomy', message: 'Engage dialectically', reasoning: 'Build mutual understanding' },
  ]);
  const text = extractText(json);
  assert.match(text, /Recognize/);
  assert.match(text, /dialectically/);
  assert.match(text, /mutual/);
});

test('extractText returns empty string on invalid / empty input', () => {
  assert.equal(extractText(null), '');
  assert.equal(extractText(''), '');
  assert.equal(extractText('not json'), '');
  assert.equal(extractText('{}'), '');
});

test('countConcept respects word boundaries and counts all patterns', () => {
  const text = 'Recognition and recognizing autonomy. Also autonomous. And recognisable.';
  // recognition matches: Recognition, recognizing, recognisable (the last via the UK spelling branch? no — recognisable is adj, pattern is recogn(?:ition|ize|...|ise|ised|ising), so NOT matched)
  const recog = countConcept(text, RECOGNITION_LEXICON.recognition);
  assert.equal(recog, 2, 'expected 2 matches (Recognition, recognizing)');

  const auto = countConcept(text, RECOGNITION_LEXICON.autonomy);
  assert.equal(auto, 2, 'expected 2 matches (autonomy, autonomous)');
});

test('countConcept handles intersubjective variants', () => {
  const text = 'intersubjective framing and inter-subjective reflection and intersubjectively';
  const n = countConcept(text, RECOGNITION_LEXICON.intersubject);
  assert.equal(n, 3);
});

test('countConcept handles hegel + master-slave', () => {
  const text = 'Hegelian dialectic about the master-slave relation and master slave dynamic';
  const n = countConcept(text, RECOGNITION_LEXICON.hegel);
  assert.equal(n, 3); // Hegelian, master-slave, master slave
});

test('wordCount counts non-empty tokens', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('one two three'), 3);
  assert.equal(wordCount('  padded  tokens  '), 2);
});

test('computeConceptDensities sums per-concept counts and returns totalDensity', () => {
  const text = 'Recognition matters. Mutual engagement is dialectical. Autonomy.';
  const r = computeConceptDensities(text);
  assert.ok(r.wordCount >= 6, `wordCount ${r.wordCount} too low`);
  assert.equal(r.perConcept.recognition.count, 1);
  assert.equal(r.perConcept.mutuality.count, 1);
  assert.equal(r.perConcept.dialectic.count, 1);
  assert.equal(r.perConcept.autonomy.count, 1);
  assert.equal(r.totalCount, 4);
  assert.ok(r.totalDensity > 0 && r.totalDensity < 1);
});

test('processRows skips short outputs and empty suggestions', () => {
  const raw = [
    {
      profile_name: 'cell_1_base_single_unified',
      suggestions: JSON.stringify([{ message: 'too short' }]),
      primary_score: 75,
    },
    {
      profile_name: 'cell_5_recog_single_unified',
      suggestions: JSON.stringify([{
        message: 'Recognition of the learner as an autonomous subject requires mutual dialectical engagement and transformation of tutor and learner alike. Honor the struggle.',
      }]),
      primary_score: 85,
    },
    {
      profile_name: 'cell_5_recog_single_unified',
      suggestions: '',
      primary_score: 90,
    },
  ];
  const rows = processRows(raw);
  assert.equal(rows.length, 1, 'only the substantive row survives the filter');
  assert.equal(rows[0].condition, 'recog');
  assert.ok(rows[0].totalCount >= 4);
});

test('summarizeByConcept ranks concepts by absolute Cohen\'s d', () => {
  const rows = [
    {
      profile: 'cell_1_base_single_unified', condition: 'base', wordCount: 50, totalCount: 0, totalDensity: 0, score: 70,
      perConcept: CONCEPTS.reduce((acc, c) => ({ ...acc, [c]: { count: 0, density: 0 } }), {}),
    },
    {
      profile: 'cell_1_base_single_unified', condition: 'base', wordCount: 50, totalCount: 0, totalDensity: 0, score: 72,
      perConcept: CONCEPTS.reduce((acc, c) => ({ ...acc, [c]: { count: 0, density: 0 } }), {}),
    },
    {
      profile: 'cell_5_recog_single_unified', condition: 'recog', wordCount: 50, totalCount: 4, totalDensity: 0.08, score: 85,
      perConcept: {
        recognition: { count: 2, density: 0.04 },
        mutuality: { count: 2, density: 0.04 },
        autonomy: { count: 0, density: 0 },
        dialectic: { count: 0, density: 0 },
        transformation: { count: 0, density: 0 },
        intersubject: { count: 0, density: 0 },
        struggle: { count: 0, density: 0 },
        repair: { count: 0, density: 0 },
        hegel: { count: 0, density: 0 },
        genuine: { count: 0, density: 0 },
      },
    },
    {
      profile: 'cell_5_recog_single_unified', condition: 'recog', wordCount: 50, totalCount: 5, totalDensity: 0.10, score: 88,
      perConcept: {
        recognition: { count: 3, density: 0.06 },
        mutuality: { count: 2, density: 0.04 },
        autonomy: { count: 0, density: 0 },
        dialectic: { count: 0, density: 0 },
        transformation: { count: 0, density: 0 },
        intersubject: { count: 0, density: 0 },
        struggle: { count: 0, density: 0 },
        repair: { count: 0, density: 0 },
        hegel: { count: 0, density: 0 },
        genuine: { count: 0, density: 0 },
      },
    },
  ];

  const byConcept = summarizeByConcept(rows);
  const recognition = byConcept.find((c) => c.concept === 'recognition');
  const autonomy = byConcept.find((c) => c.concept === 'autonomy');

  // recog cells have non-zero density, base cells zero → strong positive d for recognition.
  assert.ok(recognition.dCondition > 0, `recognition d should be positive, got ${recognition.dCondition}`);
  // autonomy is zero across both → d must be zero (or NaN-safe zero).
  assert.equal(autonomy.dCondition, 0);

  // Ordering: |d| descending, recognition first or tied with mutuality.
  assert.ok(Math.abs(byConcept[0].dCondition) >= Math.abs(byConcept[byConcept.length - 1].dCondition));
});

test('summarizeOverall gives aggregate density difference and correlation with score', () => {
  const rows = [
    { condition: 'base', totalDensity: 0.01, score: 70, perConcept: {} },
    { condition: 'base', totalDensity: 0.02, score: 72, perConcept: {} },
    { condition: 'recog', totalDensity: 0.08, score: 85, perConcept: {} },
    { condition: 'recog', totalDensity: 0.10, score: 88, perConcept: {} },
  ];
  const s = summarizeOverall(rows);
  assert.equal(s.baseN, 2);
  assert.equal(s.recogN, 2);
  assert.ok(s.recogMeanDensity > s.baseMeanDensity);
  assert.ok(s.dCondition > 0);
  // Score positively tracks density across rows → r > 0.
  assert.ok(s.rWithScore > 0);
});

test('pearson returns 0 for constant series and matches sign for monotonic', () => {
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), 0);
  const r = pearson([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]);
  assert.ok(Math.abs(r - 1) < 1e-9);
  const rNeg = pearson([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]);
  assert.ok(Math.abs(rNeg + 1) < 1e-9);
});

test('buildReport renders overall + per-concept and hides under-sampled concepts', () => {
  const overall = { baseN: 40, recogN: 40, baseMeanDensity: 0.005, recogMeanDensity: 0.025, dCondition: 0.9, rWithScore: 0.22, rN: 80 };
  const byConcept = [
    { concept: 'recognition', baseN: 40, recogN: 40, baseMeanDensity: 0.001, recogMeanDensity: 0.015, dCondition: 1.2, rWithScore: 0.3 },
    { concept: 'mutuality', baseN: 2, recogN: 1, baseMeanDensity: 0, recogMeanDensity: 0, dCondition: 0, rWithScore: 0 },
  ];
  const report = buildReport({ runIds: [], overall, byConcept, rowCount: 80, minRows: 10 });
  assert.match(report, /Overall recognition density/);
  assert.match(report, /recognition \|/);
  assert.match(report, /concepts hidden/);
  assert.doesNotMatch(report, /mutuality \| 0/);
});
