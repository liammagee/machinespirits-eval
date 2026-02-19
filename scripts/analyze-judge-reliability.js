#!/usr/bin/env node
/**
 * Inter-Judge Reliability Analysis
 *
 * Calculates agreement metrics between AI judges that scored the SAME responses.
 *
 * IMPORTANT: This requires paired data where identical responses were scored by
 * multiple judges. Generate this by rejudging an existing run:
 *
 *   node scripts/eval-cli.js rejudge <runId> --judge openrouter/anthropic/claude-sonnet-4.5
 *   node scripts/eval-cli.js rejudge <runId> --judge openrouter/moonshotai/kimi-k2.5
 *
 * The script matches responses by their `suggestions` content (MD5 hash) to find
 * cases where the exact same tutor output was scored by different judges.
 *
 * Reports:
 *   - Pearson correlation (linear agreement)
 *   - Spearman rank correlation (ordinal agreement)
 *   - Mean absolute difference (calibration)
 *   - Per-dimension agreement
 *
 * Usage:
 *   node scripts/analyze-judge-reliability.js                # All data
 *   node scripts/analyze-judge-reliability.js --run <runId>  # Specific run
 *   node scripts/analyze-judge-reliability.js --verbose      # Show disagreements
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

// Parse CLI args
const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const runIdFilter = getOption('run');
const verbose = hasFlag('verbose');

// Statistics helpers
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  const sx = std(x);
  const sy = std(y);
  if (sx === 0 || sy === 0) return null;

  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / ((x.length - 1) * sx * sy);
}

function spearmanCorrelation(x, y) {
  if (x.length !== y.length || x.length < 3) return null;

  // Convert to ranks
  const rankify = (arr) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let i = 0; i < sorted.length; i++) {
      ranks[sorted[i].i] = i + 1;
    }
    return ranks;
  };

  const rx = rankify(x);
  const ry = rankify(y);
  return pearsonCorrelation(rx, ry);
}

function meanAbsoluteDifference(x, y) {
  if (x.length !== y.length || x.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += Math.abs(x[i] - y[i]);
  }
  return sum / x.length;
}

function _cronbachAlpha(items) {
  // items: array of arrays, each inner array is scores from one rater
  // Returns alpha for internal consistency
  if (items.length < 2 || items[0].length < 2) return null;

  const k = items.length;
  const n = items[0].length;

  // Calculate variance of each item and total
  const itemVariances = items.map((item) => {
    const m = mean(item);
    return item.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
  });

  // Total scores per subject
  const totals = [];
  for (let i = 0; i < n; i++) {
    totals.push(items.reduce((s, item) => s + item[i], 0));
  }
  const totalVariance = (() => {
    const m = mean(totals);
    return totals.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
  })();

  const sumItemVariances = itemVariances.reduce((s, v) => s + v, 0);

  if (totalVariance === 0) return null;
  return (k / (k - 1)) * (1 - sumItemVariances / totalVariance);
}

// Simple hash for grouping identical responses
function simpleHash(str) {
  if (!str) return null;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Main analysis
function analyzeJudgeReliability() {
  const db = new Database(DB_PATH, { readonly: true });

  console.log('Inter-Judge Reliability Analysis');
  console.log('='.repeat(60));
  console.log('');

  // Find all judge models
  const judges = db
    .prepare(
      `
    SELECT DISTINCT judge_model
    FROM evaluation_results
    WHERE judge_model IS NOT NULL
  `,
    )
    .all()
    .map((r) => r.judge_model);

  console.log(`Judges found: ${judges.join(', ')}`);
  console.log('');

  // Find paired judgments - must be SAME response content judged by different models
  // Match on suggestions content (the actual tutor response), not just scenario/profile
  let whereClause = 'WHERE judge_model IS NOT NULL AND overall_score IS NOT NULL AND suggestions IS NOT NULL';
  if (runIdFilter) {
    whereClause += ` AND run_id = '${runIdFilter}'`;
  }

  const pairedQuery = `
    SELECT
      run_id,
      scenario_id,
      profile_name,
      judge_model,
      overall_score,
      score_relevance,
      score_specificity,
      score_pedagogical,
      score_personalization,
      score_actionability,
      score_tone,
      suggestions
    FROM evaluation_results
    ${whereClause}
    ORDER BY suggestions, judge_model
  `;

  const results = db.prepare(pairedQuery).all();

  // Group by RESPONSE CONTENT (suggestions hash) - not scenario/profile
  // This ensures we only compare when the exact same response was judged multiple times
  const responseGroups = new Map();

  for (const r of results) {
    // Use suggestions content hash as grouping key
    const contentHash = simpleHash(r.suggestions);
    if (!contentHash) continue;

    const key = contentHash;
    if (!responseGroups.has(key)) {
      responseGroups.set(key, []);
    }
    responseGroups.get(key).push(r);
  }

  // Count how many responses have multiple judgments
  let responsesWithMultipleJudges = 0;
  for (const [_key, group] of responseGroups) {
    const uniqueJudges = new Set(group.map((r) => r.judge_model));
    if (uniqueJudges.size > 1) {
      responsesWithMultipleJudges++;
    }
  }

  if (responsesWithMultipleJudges === 0) {
    console.log('⚠️  No paired judgments found!');
    console.log('');
    console.log('To analyze inter-judge reliability, you need the SAME response');
    console.log('scored by multiple judges. Generate this data by rejudging a run:');
    console.log('');
    console.log('  # First, pick a completed run:');
    console.log('  node scripts/eval-cli.js list');
    console.log('');
    console.log('  # Then rejudge with different models:');
    console.log('  node scripts/eval-cli.js rejudge <runId> --judge openrouter/anthropic/claude-sonnet-4.5');
    console.log('  node scripts/eval-cli.js rejudge <runId> --judge openrouter/moonshotai/kimi-k2.5');
    console.log('');
    console.log('  # Then run this analysis again');
    console.log('');
    db.close();
    return;
  }

  console.log(`Responses with multiple judges: ${responsesWithMultipleJudges}`);
  console.log('');

  // Find groups with multiple judges
  const _pairsData = [];
  const judgePairs = new Map(); // "judgeA|judgeB" -> [{score1, score2, ...}]

  for (const [_key, group] of responseGroups) {
    const judgeScores = new Map();
    for (const r of group) {
      if (!judgeScores.has(r.judge_model)) {
        judgeScores.set(r.judge_model, []);
      }
      judgeScores.set(r.judge_model, r);
    }

    // Only consider if multiple judges
    if (judgeScores.size > 1) {
      const judgeList = Array.from(judgeScores.keys()).sort();

      // Create pairs for each combination
      for (let i = 0; i < judgeList.length; i++) {
        for (let j = i + 1; j < judgeList.length; j++) {
          const pairKey = `${judgeList[i]}|${judgeList[j]}`;
          if (!judgePairs.has(pairKey)) {
            judgePairs.set(pairKey, []);
          }

          const s1 = judgeScores.get(judgeList[i]);
          const s2 = judgeScores.get(judgeList[j]);

          judgePairs.get(pairKey).push({
            judge1: judgeList[i],
            judge2: judgeList[j],
            score1: s1.overall_score,
            score2: s2.overall_score,
            diff: Math.abs(s1.overall_score - s2.overall_score),
            dimensions: {
              relevance: [s1.score_relevance, s2.score_relevance],
              specificity: [s1.score_specificity, s2.score_specificity],
              pedagogical: [s1.score_pedagogical, s2.score_pedagogical],
              personalization: [s1.score_personalization, s2.score_personalization],
              actionability: [s1.score_actionability, s2.score_actionability],
              tone: [s1.score_tone, s2.score_tone],
            },
            scenario: s1.scenario_id,
            profile: s1.profile_name,
          });
        }
      }
    }
  }

  if (judgePairs.size === 0) {
    console.log('No paired judgments found (same response scored by multiple judges).');
    console.log('');
    console.log('To generate paired data, use the rejudge command with a different model:');
    console.log('  node scripts/eval-cli.js rejudge <runId> --judge openrouter/anthropic/claude-sonnet-4.5');
    db.close();
    return;
  }

  console.log(`Found ${judgePairs.size} judge pair combinations`);
  console.log('');

  // Analyze each pair
  const overallScores1 = [];
  const overallScores2 = [];
  const allDisagreements = [];

  for (const [pairKey, pairs] of judgePairs) {
    const [judge1, judge2] = pairKey.split('|');
    const n = pairs.length;

    const scores1 = pairs.map((p) => p.score1);
    const scores2 = pairs.map((p) => p.score2);

    overallScores1.push(...scores1);
    overallScores2.push(...scores2);

    const pearson = pearsonCorrelation(scores1, scores2);
    const spearman = spearmanCorrelation(scores1, scores2);
    const mad = meanAbsoluteDifference(scores1, scores2);

    console.log(`\n${judge1.split('/').pop()} vs ${judge2.split('/').pop()}`);
    console.log('-'.repeat(50));
    console.log(`  Paired responses: ${n}`);
    console.log(`  Pearson r:        ${pearson !== null ? pearson.toFixed(3) : 'N/A'}`);
    console.log(`  Spearman ρ:       ${spearman !== null ? spearman.toFixed(3) : 'N/A'}`);
    console.log(`  Mean Abs Diff:    ${mad !== null ? mad.toFixed(2) : 'N/A'} pts`);
    console.log(`  Mean scores:      ${mean(scores1).toFixed(1)} vs ${mean(scores2).toFixed(1)}`);

    // Per-dimension analysis
    const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
    console.log('\n  Per-dimension correlations:');

    for (const dim of dimensions) {
      const d1 = pairs.map((p) => p.dimensions[dim][0]).filter((v) => v != null);
      const d2 = pairs.map((p) => p.dimensions[dim][1]).filter((v) => v != null);

      if (d1.length >= 3 && d2.length >= 3) {
        const r = pearsonCorrelation(d1, d2);
        console.log(`    ${dim.padEnd(16)} r = ${r !== null ? r.toFixed(3) : 'N/A'}`);
      }
    }

    // Identify major disagreements (diff > 20)
    const bigDisagreements = pairs.filter((p) => p.diff > 20);
    if (bigDisagreements.length > 0) {
      allDisagreements.push(...bigDisagreements);
      console.log(`\n  Major disagreements (diff > 20): ${bigDisagreements.length}`);

      if (verbose) {
        for (const d of bigDisagreements.slice(0, 5)) {
          console.log(`    ${d.scenario} / ${d.profile}: ${d.score1} vs ${d.score2} (Δ${d.diff.toFixed(0)})`);
        }
      }
    }
  }

  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('OVERALL RELIABILITY SUMMARY');
  console.log('='.repeat(60));

  const totalPairs = overallScores1.length;
  const overallPearson = pearsonCorrelation(overallScores1, overallScores2);
  const overallSpearman = spearmanCorrelation(overallScores1, overallScores2);
  const overallMAD = meanAbsoluteDifference(overallScores1, overallScores2);

  console.log(`\nTotal paired judgments: ${totalPairs}`);
  console.log(`Overall Pearson r:      ${overallPearson !== null ? overallPearson.toFixed(3) : 'N/A'}`);
  console.log(`Overall Spearman ρ:     ${overallSpearman !== null ? overallSpearman.toFixed(3) : 'N/A'}`);
  console.log(`Overall Mean Abs Diff:  ${overallMAD !== null ? overallMAD.toFixed(2) : 'N/A'} pts`);

  // Interpretation
  console.log('\nInterpretation:');
  if (overallPearson !== null) {
    if (overallPearson >= 0.8) {
      console.log('  ✓ Excellent agreement (r ≥ 0.8)');
    } else if (overallPearson >= 0.6) {
      console.log('  ○ Good agreement (0.6 ≤ r < 0.8)');
    } else if (overallPearson >= 0.4) {
      console.log('  △ Moderate agreement (0.4 ≤ r < 0.6)');
    } else {
      console.log('  ✗ Poor agreement (r < 0.4)');
    }
  }

  if (overallMAD !== null) {
    console.log(`  Average score difference: ${overallMAD.toFixed(1)} points on 100-point scale`);
  }

  if (allDisagreements.length > 0) {
    console.log(`  ${allDisagreements.length} major disagreements (>20 pts) found`);
  }

  console.log('');
  db.close();
}

// Run
try {
  analyzeJudgeReliability();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
