#!/usr/bin/env node

/**
 * Qualitative Analysis of Evaluation Transcripts
 *
 * Extracts and analyzes suggestion text from the evaluation database:
 * 1. High-contrast transcript pairs (base vs recognition, same scenario)
 * 2. Word frequency analysis (unigrams + bigrams, differential)
 * 3. Lexical diversity metrics (TTR, word/sentence length, vocabulary)
 * 4. Thematic coding with chi-square significance tests
 *
 * Outputs:
 *   exports/qualitative-analysis.json  — structured data
 *   exports/qualitative-analysis.md    — paper-ready summary
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Stopwords ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  "aren't",
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  "can't",
  'cannot',
  'could',
  "couldn't",
  'did',
  "didn't",
  'do',
  'does',
  "doesn't",
  'doing',
  "don't",
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'get',
  'got',
  'had',
  "hadn't",
  'has',
  "hasn't",
  'have',
  "haven't",
  'having',
  'he',
  "he'd",
  "he'll",
  "he's",
  'her',
  'here',
  "here's",
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  "how's",
  'i',
  "i'd",
  "i'll",
  "i'm",
  "i've",
  'if',
  'in',
  'into',
  'is',
  "isn't",
  'it',
  "it's",
  'its',
  'itself',
  'just',
  'let',
  "let's",
  'like',
  'make',
  'me',
  'might',
  'more',
  'most',
  "mustn't",
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'really',
  'right',
  'same',
  "shan't",
  'she',
  "she'd",
  "she'll",
  "she's",
  'should',
  "shouldn't",
  'so',
  'some',
  'such',
  'take',
  'than',
  'that',
  "that's",
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  "there's",
  'these',
  'they',
  "they'd",
  "they'll",
  "they're",
  "they've",
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'us',
  'very',
  'was',
  "wasn't",
  'we',
  "we'd",
  "we'll",
  "we're",
  "we've",
  'well',
  'were',
  "weren't",
  'what',
  "what's",
  'when',
  "when's",
  'where',
  "where's",
  'which',
  'while',
  'who',
  "who's",
  'whom',
  'why',
  "why's",
  'will',
  'with',
  "won't",
  'would',
  "wouldn't",
  'you',
  "you'd",
  "you'll",
  "you're",
  "you've",
  'your',
  'yours',
  'yourself',
  'yourselves',
  'also',
  'been',
  'being',
  'come',
  'even',
  'first',
  'going',
  'good',
  'know',
  'look',
  'much',
  'need',
  'new',
  'now',
  'one',
  'people',
  'really',
  'see',
  'think',
  'thing',
  'time',
  'two',
  'use',
  'want',
  'way',
  'work',
  'would',
  'year',
  'back',
  'long',
  'say',
  'still',
  'tell',
  'try',
  'give',
  'go',
  'help',
  'keep',
  'many',
  'may',
  'put',
  'seem',
  'show',
  'start',
  'turn',
  'big',
  'end',
  'set',
  'll',
  've',
  're',
  's',
  't',
  'd',
  'don',
  'isn',
  'doesn',
  'didn',
  'won',
  'can',
  'couldn',
  'shouldn',
  'wasn',
  'weren',
  'hasn',
  'haven',
  'hadn',
  'aren',
  'mustn',
  'shan',
  'ain',
]);

// ── Thematic coding categories ───────────────────────────────────────────
// Based on patterns from dialogueTraceAnalyzer.js and turnComparisonAnalyzer.js

const THEMATIC_CATEGORIES = {
  engagement: {
    label: 'Engagement markers',
    description: 'Second-person engagement with learner contributions',
    patterns: [
      /your insight/gi,
      /building on your/gi,
      /your question/gi,
      /your point/gi,
      /your observation/gi,
      /your analysis/gi,
      /your argument/gi,
      /your critique/gi,
      /you've (raised|identified|highlighted|noticed|pointed out)/gi,
      /you're (asking|raising|pushing|exploring|getting at)/gi,
    ],
  },
  transformation: {
    label: 'Transformation language',
    description: 'Markers of mutual change or perspective shift',
    patterns: [
      /reconsidering/gi,
      /that changes (how I|my)/gi,
      /I hadn't (thought|considered)/gi,
      /revising (my|the)/gi,
      /let me (revise|adjust|rethink)/gi,
      /you've (helped|pushed|made) me/gi,
      /your .{1,20} (complicates|enriches|changes)/gi,
      /shifts? (my|the|our) (understanding|framing|approach)/gi,
    ],
  },
  struggle_honoring: {
    label: 'Struggle-honoring',
    description: 'Acknowledging productive confusion or difficulty',
    patterns: [
      /wrestling with/gi,
      /productive confusion/gi,
      /working through/gi,
      /grappling with/gi,
      /sitting with (the|this)/gi,
      /tension (between|here|you)/gi,
      /difficulty (is|here)/gi,
      /struggle (with|is|here)/gi,
      /not (easy|simple|straightforward)/gi,
    ],
  },
  learner_as_subject: {
    label: 'Learner-as-subject framing',
    description: 'Treating learner as autonomous intellectual agent',
    patterns: [
      /your interpretation/gi,
      /your analysis/gi,
      /your understanding/gi,
      /you're grappling with/gi,
      /your perspective/gi,
      /your framework/gi,
      /your reading/gi,
      /what you're (doing|building|developing|constructing)/gi,
      /your (intellectual|philosophical|analytical)/gi,
    ],
  },
  directive: {
    label: 'Directive framing',
    description: 'Expert-to-novice instructional markers',
    patterns: [
      /you should/gi,
      /you need to/gi,
      /you must/gi,
      /the correct (answer|approach|way)/gi,
      /the answer is/gi,
      /let me explain/gi,
      /here's what/gi,
      /make sure (to|you)/gi,
      /first,? you/gi,
    ],
  },
  generic: {
    label: 'Generic/placeholder',
    description: 'Vague pedagogical language without specificity',
    patterns: [
      /foundational/gi,
      /key concepts/gi,
      /learning objectives/gi,
      /knowledge base/gi,
      /solid foundation/gi,
      /core concepts/gi,
      /build (a|your) (solid|strong)/gi,
      /comprehensive (understanding|overview|review)/gi,
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function tokenizeFiltered(text) {
  return tokenize(text).filter((w) => !STOPWORDS.has(w));
}

function countSentences(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

function getBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function countFrequencies(items) {
  const freq = {};
  for (const item of items) {
    freq[item] = (freq[item] || 0) + 1;
  }
  return freq;
}

function topN(freqObj, n) {
  return Object.entries(freqObj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/**
 * Chi-square test for 2×2 contingency table.
 * Cells: [condition1_present, condition1_absent, condition2_present, condition2_absent]
 */
function chiSquare2x2(a, b, c, d) {
  const n = a + b + c + d;
  if (n === 0) return { chi2: 0, p: 1 };
  const expected = [((a + b) * (a + c)) / n, ((a + b) * (b + d)) / n, ((c + d) * (a + c)) / n, ((c + d) * (b + d)) / n];
  // Yates correction for small samples
  const chi2 = [a, b, c, d].reduce((sum, obs, i) => {
    const exp = expected[i];
    if (exp === 0) return sum;
    return sum + (Math.abs(obs - exp) - 0.5) ** 2 / exp;
  }, 0);

  // Approximate p-value from chi-square with df=1
  let p;
  if (chi2 > 10.83) p = 0.001;
  else if (chi2 > 6.63) p = 0.01;
  else if (chi2 > 3.84) p = 0.05;
  else if (chi2 > 2.71) p = 0.1;
  else p = 0.25;

  return { chi2, p, sig: p < 0.05 };
}

function extractSuggestionTexts(suggestionsJson) {
  try {
    const parsed = JSON.parse(suggestionsJson);
    if (!Array.isArray(parsed)) return { messages: [], reasonings: [] };
    const messages = parsed.map((s) => s.message || '').filter(Boolean);
    const reasonings = parsed.map((s) => s.reasoning || '').filter(Boolean);
    return { messages, reasonings };
  } catch {
    return { messages: [], reasonings: [] };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('QUALITATIVE ANALYSIS OF EVALUATION TRANSCRIPTS');
  console.log('='.repeat(70));
  console.log('');

  const dbPath = path.join(process.cwd(), 'data', 'evaluations.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Ensure exports directory exists
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // ── 1. Transcript Pair Selection ────────────────────────────────────

  console.log('1. TRANSCRIPT PAIR SELECTION');
  console.log('-'.repeat(70));

  const baseCells = [
    'cell_1_base_single_unified',
    'cell_2_base_single_psycho',
    'cell_3_base_multi_unified',
    'cell_4_base_multi_psycho',
  ];
  const recogCells = [
    'cell_5_recog_single_unified',
    'cell_6_recog_single_psycho',
    'cell_7_recog_multi_unified',
    'cell_8_recog_multi_psycho',
  ];

  // Scenarios to find pairs for (high contrast)
  const pairScenarios = ['struggling_learner', 'recognition_seeking_learner', 'adversarial_tester'];

  const pairs = [];

  for (const scenario of pairScenarios) {
    // Highest-scoring recognition result
    const bestRecog = db
      .prepare(
        `
      SELECT id, scenario_id, profile_name, overall_score, suggestions
      FROM evaluation_results
      WHERE success = 1 AND overall_score IS NOT NULL
        AND scenario_id = ?
        AND profile_name IN (${recogCells.map(() => '?').join(',')})
        AND suggestions IS NOT NULL
      ORDER BY overall_score DESC
      LIMIT 1
    `,
      )
      .get(scenario, ...recogCells);

    // Lowest-scoring base result (exclude score=0 which are error cases)
    const worstBase = db
      .prepare(
        `
      SELECT id, scenario_id, profile_name, overall_score, suggestions
      FROM evaluation_results
      WHERE success = 1 AND overall_score IS NOT NULL AND overall_score > 0
        AND scenario_id = ?
        AND profile_name IN (${baseCells.map(() => '?').join(',')})
        AND suggestions IS NOT NULL
      ORDER BY overall_score ASC
      LIMIT 1
    `,
      )
      .get(scenario, ...baseCells);

    if (bestRecog && worstBase) {
      const recTexts = extractSuggestionTexts(bestRecog.suggestions);
      const baseTexts = extractSuggestionTexts(worstBase.suggestions);

      const pair = {
        scenario,
        recognition: {
          id: bestRecog.id,
          profile: bestRecog.profile_name,
          score: bestRecog.overall_score,
          message: recTexts.messages.join('\n\n'),
          reasoning: recTexts.reasonings.join('\n\n'),
        },
        base: {
          id: worstBase.id,
          profile: worstBase.profile_name,
          score: worstBase.overall_score,
          message: baseTexts.messages.join('\n\n'),
          reasoning: baseTexts.reasonings.join('\n\n'),
        },
        scoreDiff: bestRecog.overall_score - worstBase.overall_score,
      };
      pairs.push(pair);

      console.log(`\n  ${scenario}:`);
      console.log(
        `    Recognition: id=${pair.recognition.id}, profile=${pair.recognition.profile}, score=${pair.recognition.score.toFixed(1)}`,
      );
      console.log(
        `    Base:        id=${pair.base.id}, profile=${pair.base.profile}, score=${pair.base.score.toFixed(1)}`,
      );
      console.log(`    Score gap:   ${pair.scoreDiff.toFixed(1)} points`);
    }
  }

  // ── 2. Corpus Construction ──────────────────────────────────────────

  console.log('\n\n2. CORPUS CONSTRUCTION');
  console.log('-'.repeat(70));

  // Gather all suggestion text for base and recognition conditions
  const allRows = db
    .prepare(
      `
    SELECT profile_name, suggestions
    FROM evaluation_results
    WHERE success = 1
      AND suggestions IS NOT NULL
      AND profile_name IN (${[...baseCells, ...recogCells].map(() => '?').join(',')})
  `,
    )
    .all(...baseCells, ...recogCells);

  const corpus = {
    base: { messages: [], reasonings: [] },
    recognition: { messages: [], reasonings: [] },
  };

  for (const row of allRows) {
    const condition = baseCells.includes(row.profile_name) ? 'base' : 'recognition';
    const texts = extractSuggestionTexts(row.suggestions);
    corpus[condition].messages.push(...texts.messages);
    corpus[condition].reasonings.push(...texts.reasonings);
  }

  console.log(`  Base:        ${corpus.base.messages.length} messages, ${corpus.base.reasonings.length} reasonings`);
  console.log(
    `  Recognition: ${corpus.recognition.messages.length} messages, ${corpus.recognition.reasonings.length} reasonings`,
  );

  // ── 3. Word Frequency Analysis ──────────────────────────────────────

  console.log('\n\n3. WORD FREQUENCY ANALYSIS');
  console.log('-'.repeat(70));

  const baseMessageText = corpus.base.messages.join(' ');
  const recogMessageText = corpus.recognition.messages.join(' ');

  const baseTokens = tokenizeFiltered(baseMessageText);
  const recogTokens = tokenizeFiltered(recogMessageText);

  const baseUnigrams = countFrequencies(baseTokens);
  const recogUnigrams = countFrequencies(recogTokens);

  const baseBigrams = countFrequencies(getBigrams(tokenizeFiltered(baseMessageText)));
  const recogBigrams = countFrequencies(getBigrams(tokenizeFiltered(recogMessageText)));

  console.log('\n  Top 30 Base Unigrams:');
  const baseTop30 = topN(baseUnigrams, 30);
  baseTop30.forEach(([w, c], i) => console.log(`    ${(i + 1).toString().padStart(2)}. ${w.padEnd(20)} ${c}`));

  console.log('\n  Top 30 Recognition Unigrams:');
  const recogTop30 = topN(recogUnigrams, 30);
  recogTop30.forEach(([w, c], i) => console.log(`    ${(i + 1).toString().padStart(2)}. ${w.padEnd(20)} ${c}`));

  // Differential: words disproportionately more frequent in one condition
  // Normalize by corpus size
  const baseTotal = baseTokens.length;
  const recogTotal = recogTokens.length;

  // Get all words that appear at least 5 times in either corpus
  const allWords = new Set([...Object.keys(baseUnigrams), ...Object.keys(recogUnigrams)]);
  const differential = [];
  for (const word of allWords) {
    const baseCount = baseUnigrams[word] || 0;
    const recogCount = recogUnigrams[word] || 0;
    if (baseCount + recogCount < 10) continue; // minimum frequency
    const baseRate = baseCount / baseTotal;
    const recogRate = recogCount / recogTotal;
    if (baseRate === 0 && recogRate === 0) continue;
    const ratio = recogRate > 0 && baseRate > 0 ? recogRate / baseRate : recogRate > 0 ? Infinity : 0;
    differential.push({ word, baseCount, recogCount, baseRate, recogRate, ratio });
  }

  // Sort by ratio descending for recognition-skewed
  // Require both counts > 0 for finite ratios, and minimum 10 in dominant condition
  const recogSkewed = differential
    .filter((d) => d.ratio !== Infinity && d.ratio > 1 && d.recogCount >= 10)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 15);

  const baseSkewed = differential
    .filter((d) => d.ratio > 0 && d.ratio < 1 && d.baseCount >= 10)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 15);

  console.log('\n  Top 15 Recognition-Skewed Words:');
  recogSkewed.forEach((d) => {
    console.log(
      `    ${d.word.padEnd(20)} base=${d.baseCount}, recog=${d.recogCount}, ratio=${d.ratio === Infinity ? '∞' : d.ratio.toFixed(2)}×`,
    );
  });

  console.log('\n  Top 15 Base-Skewed Words:');
  baseSkewed.forEach((d) => {
    console.log(`    ${d.word.padEnd(20)} base=${d.baseCount}, recog=${d.recogCount}, ratio=${d.ratio.toFixed(2)}×`);
  });

  // Top bigrams differential
  const allBigrams = new Set([...Object.keys(baseBigrams), ...Object.keys(recogBigrams)]);
  const bigramDiff = [];
  for (const bg of allBigrams) {
    const bc = baseBigrams[bg] || 0;
    const rc = recogBigrams[bg] || 0;
    if (bc + rc < 5) continue;
    const br = bc / baseTotal;
    const rr = rc / recogTotal;
    const ratio = rr > 0 && br > 0 ? rr / br : rr > 0 ? Infinity : 0;
    bigramDiff.push({ bigram: bg, baseCount: bc, recogCount: rc, ratio });
  }

  const recogBigramSkewed = bigramDiff
    .filter((d) => d.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);
  const baseBigramSkewed = bigramDiff
    .filter((d) => d.ratio < 1 && d.ratio > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 10);

  console.log('\n  Top 10 Recognition-Skewed Bigrams:');
  recogBigramSkewed.forEach((d) => {
    console.log(
      `    ${d.bigram.padEnd(30)} base=${d.baseCount}, recog=${d.recogCount}, ratio=${d.ratio === Infinity ? '∞' : d.ratio.toFixed(2)}×`,
    );
  });

  // ── 4. Lexical Diversity ────────────────────────────────────────────

  console.log('\n\n4. LEXICAL DIVERSITY METRICS');
  console.log('-'.repeat(70));

  function computeLexicalMetrics(text, label) {
    const allTokens = tokenize(text);
    const types = new Set(allTokens);
    const sentences = countSentences(text);
    const ttr = allTokens.length > 0 ? types.size / allTokens.length : 0;
    const meanWordLen = allTokens.length > 0 ? allTokens.reduce((sum, w) => sum + w.length, 0) / allTokens.length : 0;
    const meanSentLen = sentences > 0 ? allTokens.length / sentences : 0;

    return {
      label,
      tokens: allTokens.length,
      types: types.size,
      ttr: ttr,
      meanWordLength: meanWordLen,
      meanSentenceLength: meanSentLen,
      vocabularySize: types.size,
    };
  }

  const lexical = {
    base_message: computeLexicalMetrics(baseMessageText, 'Base (message)'),
    recog_message: computeLexicalMetrics(recogMessageText, 'Recognition (message)'),
    base_reasoning: computeLexicalMetrics(corpus.base.reasonings.join(' '), 'Base (reasoning)'),
    recog_reasoning: computeLexicalMetrics(corpus.recognition.reasonings.join(' '), 'Recognition (reasoning)'),
  };

  for (const [_key, m] of Object.entries(lexical)) {
    console.log(`\n  ${m.label}:`);
    console.log(`    Tokens:              ${m.tokens.toLocaleString()}`);
    console.log(`    Type-Token Ratio:    ${m.ttr.toFixed(4)}`);
    console.log(`    Vocabulary size:     ${m.types.toLocaleString()}`);
    console.log(`    Mean word length:    ${m.meanWordLength.toFixed(2)} chars`);
    console.log(`    Mean sentence length: ${m.meanSentenceLength.toFixed(1)} words`);
  }

  // ── 5. Thematic Coding ─────────────────────────────────────────────

  console.log('\n\n5. THEMATIC CODING');
  console.log('-'.repeat(70));

  function countThematicMatches(text, patterns) {
    let total = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) total += matches.length;
    }
    return total;
  }

  // Count per 1000 words
  const baseWordCount = tokenize(baseMessageText).length;
  const recogWordCount = tokenize(recogMessageText).length;

  // Also track presence/absence for chi-square (per response)
  function countResponsePresence(messages, patterns) {
    let present = 0;
    for (const msg of messages) {
      let found = false;
      for (const pattern of patterns) {
        if (pattern.test(msg)) {
          found = true;
          break;
        }
      }
      if (found) present++;
    }
    return present;
  }

  const thematicResults = {};

  for (const [category, config] of Object.entries(THEMATIC_CATEGORIES)) {
    const baseRawCount = countThematicMatches(baseMessageText, config.patterns);
    const recogRawCount = countThematicMatches(recogMessageText, config.patterns);

    const basePer1000 = baseWordCount > 0 ? (baseRawCount / baseWordCount) * 1000 : 0;
    const recogPer1000 = recogWordCount > 0 ? (recogRawCount / recogWordCount) * 1000 : 0;

    const ratio = basePer1000 > 0 ? recogPer1000 / basePer1000 : recogPer1000 > 0 ? Infinity : 1;

    // Chi-square: response-level presence/absence
    const basePresent = countResponsePresence(corpus.base.messages, config.patterns);
    const baseAbsent = corpus.base.messages.length - basePresent;
    const recogPresent = countResponsePresence(corpus.recognition.messages, config.patterns);
    const recogAbsent = corpus.recognition.messages.length - recogPresent;

    const chi = chiSquare2x2(basePresent, baseAbsent, recogPresent, recogAbsent);

    thematicResults[category] = {
      label: config.label,
      description: config.description,
      baseRawCount,
      recogRawCount,
      basePer1000,
      recogPer1000,
      ratio,
      basePresent,
      baseTotal: corpus.base.messages.length,
      recogPresent,
      recogTotal: corpus.recognition.messages.length,
      chi2: chi.chi2,
      p: chi.p,
      sig: chi.sig,
    };

    console.log(`\n  ${config.label}:`);
    console.log(
      `    Base:        ${baseRawCount} occurrences (${basePer1000.toFixed(1)}/1000 words), ${basePresent}/${corpus.base.messages.length} responses`,
    );
    console.log(
      `    Recognition: ${recogRawCount} occurrences (${recogPer1000.toFixed(1)}/1000 words), ${recogPresent}/${corpus.recognition.messages.length} responses`,
    );
    console.log(`    Ratio:       ${ratio === Infinity ? '∞' : ratio.toFixed(2)}×`);
    console.log(
      `    χ²(1) = ${chi.chi2.toFixed(2)}, p ${chi.p < 0.05 ? '< .05 *' : chi.p < 0.1 ? '< .10 †' : `≈ ${chi.p.toFixed(2)}`}`,
    );
  }

  // ── 6. Build Output ────────────────────────────────────────────────

  console.log('\n\n6. GENERATING OUTPUT');
  console.log('-'.repeat(70));

  // JSON output
  const jsonOutput = {
    generated: new Date().toISOString(),
    transcriptPairs: pairs,
    wordFrequency: {
      baseCorpusSize: baseTotal,
      recogCorpusSize: recogTotal,
      baseTop30Unigrams: baseTop30.map(([w, c]) => ({ word: w, count: c })),
      recogTop30Unigrams: recogTop30.map(([w, c]) => ({ word: w, count: c })),
      recogSkewedUnigrams: recogSkewed,
      baseSkewedUnigrams: baseSkewed,
      recogSkewedBigrams: recogBigramSkewed,
      baseSkewedBigrams: baseBigramSkewed,
    },
    lexicalDiversity: lexical,
    thematicCoding: thematicResults,
  };

  const jsonPath = path.join(exportsDir, 'qualitative-analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`  JSON: ${jsonPath}`);

  // ── Markdown output ────────────────────────────────────────────────

  let md = `# Qualitative Analysis of Evaluation Transcripts

**Generated:** ${new Date().toISOString()}

## 1. Transcript Pairs (High-Contrast Base vs Recognition)

`;

  const scenarioLabels = {
    struggling_learner: 'Struggling Learner',
    recognition_seeking_learner: 'Recognition-Seeking Learner',
    adversarial_tester: 'Adversarial Tester',
  };

  for (const pair of pairs) {
    md += `### ${scenarioLabels[pair.scenario] || pair.scenario}\n\n`;
    md += `**Score gap:** ${pair.scoreDiff.toFixed(1)} points (base ${pair.base.score.toFixed(1)} → recognition ${pair.recognition.score.toFixed(1)})\n\n`;

    md += `**Base response** (${pair.base.profile}, score ${pair.base.score.toFixed(1)}):\n\n`;
    md += `> ${pair.base.message.replace(/\n/g, '\n> ')}\n\n`;

    md += `**Recognition response** (${pair.recognition.profile}, score ${pair.recognition.score.toFixed(1)}):\n\n`;
    md += `> ${pair.recognition.message.replace(/\n/g, '\n> ')}\n\n`;
    md += `---\n\n`;
  }

  md += `## 2. Lexical Diversity Metrics

| Metric | Base (message) | Recognition (message) | Base (reasoning) | Recognition (reasoning) |
|--------|----------------|----------------------|------------------|------------------------|
| Tokens | ${lexical.base_message.tokens.toLocaleString()} | ${lexical.recog_message.tokens.toLocaleString()} | ${lexical.base_reasoning.tokens.toLocaleString()} | ${lexical.recog_reasoning.tokens.toLocaleString()} |
| Type-Token Ratio | ${lexical.base_message.ttr.toFixed(4)} | ${lexical.recog_message.ttr.toFixed(4)} | ${lexical.base_reasoning.ttr.toFixed(4)} | ${lexical.recog_reasoning.ttr.toFixed(4)} |
| Vocabulary Size | ${lexical.base_message.types.toLocaleString()} | ${lexical.recog_message.types.toLocaleString()} | ${lexical.base_reasoning.types.toLocaleString()} | ${lexical.recog_reasoning.types.toLocaleString()} |
| Mean Word Length | ${lexical.base_message.meanWordLength.toFixed(2)} | ${lexical.recog_message.meanWordLength.toFixed(2)} | ${lexical.base_reasoning.meanWordLength.toFixed(2)} | ${lexical.recog_reasoning.meanWordLength.toFixed(2)} |
| Mean Sentence Length | ${lexical.base_message.meanSentenceLength.toFixed(1)} | ${lexical.recog_message.meanSentenceLength.toFixed(1)} | ${lexical.base_reasoning.meanSentenceLength.toFixed(1)} | ${lexical.recog_reasoning.meanSentenceLength.toFixed(1)} |

`;

  md += `## 3. Differential Word Frequency

### Recognition-Skewed Terms

| Word | Base Count | Recognition Count | Rate Ratio |
|------|-----------|-------------------|------------|
`;
  for (const d of recogSkewed) {
    md += `| ${d.word} | ${d.baseCount} | ${d.recogCount} | ${d.ratio === Infinity ? '∞' : d.ratio.toFixed(2)}× |\n`;
  }

  md += `\n### Base-Skewed Terms

| Word | Base Count | Recognition Count | Rate Ratio |
|------|-----------|-------------------|------------|
`;
  for (const d of baseSkewed) {
    md += `| ${d.word} | ${d.baseCount} | ${d.recogCount} | ${d.ratio.toFixed(2)}× |\n`;
  }

  md += `\n### Recognition-Skewed Bigrams

| Bigram | Base Count | Recognition Count | Rate Ratio |
|--------|-----------|-------------------|------------|
`;
  for (const d of recogBigramSkewed) {
    md += `| ${d.bigram} | ${d.baseCount} | ${d.recogCount} | ${d.ratio === Infinity ? '∞' : d.ratio.toFixed(2)}× |\n`;
  }

  md += `\n## 4. Thematic Code Frequency

| Category | Base (per 1000 words) | Recognition (per 1000 words) | Ratio | χ²(1) | Sig |
|----------|----------------------|------------------------------|-------|-------|-----|
`;
  for (const [_cat, r] of Object.entries(thematicResults)) {
    md += `| ${r.label} | ${r.basePer1000.toFixed(1)} | ${r.recogPer1000.toFixed(1)} | ${r.ratio === Infinity ? '∞' : r.ratio.toFixed(2)}× | ${r.chi2.toFixed(2)} | ${r.sig ? '*' : r.p < 0.1 ? '†' : ''} |\n`;
  }

  md += `\n*\\* p < .05, † p < .10. Chi-square tests on response-level presence/absence (base N=${corpus.base.messages.length}, recognition N=${corpus.recognition.messages.length}).*\n`;

  const mdPath = path.join(exportsDir, 'qualitative-analysis.md');
  fs.writeFileSync(mdPath, md);
  console.log(`  Markdown: ${mdPath}`);

  console.log('\n' + '='.repeat(70));
  console.log('Done.');

  db.close();
}

main().catch(console.error);
