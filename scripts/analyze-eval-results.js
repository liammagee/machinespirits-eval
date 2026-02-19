#!/usr/bin/env node

/**
 * Statistical Analysis for Evaluation Results
 *
 * Computes effect sizes (Cohen's d), confidence intervals, and p-values
 * for comparing tutor profiles across evaluation scenarios.
 *
 * Usage:
 *   node scripts/analyze-eval-results.js --profiles baseline,recognition
 *   node scripts/analyze-eval-results.js --run-id eval-2026-01-11-xxx
 *   node scripts/analyze-eval-results.js --export results.csv
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Statistical functions
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1));
}

function pooledStandardDeviation(arr1, arr2) {
  const n1 = arr1.length;
  const n2 = arr2.length;
  if (n1 < 2 || n2 < 2) return 0;

  const var1 = Math.pow(standardDeviation(arr1), 2);
  const var2 = Math.pow(standardDeviation(arr2), 2);

  return Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
}

function cohensD(group1, group2) {
  const pooledSD = pooledStandardDeviation(group1, group2);
  if (pooledSD === 0) return 0;
  return (mean(group1) - mean(group2)) / pooledSD;
}

function standardError(arr) {
  if (arr.length < 2) return 0;
  return standardDeviation(arr) / Math.sqrt(arr.length);
}

function confidenceInterval(arr, confidence = 0.95) {
  const m = mean(arr);
  const se = standardError(arr);
  // Z-score for 95% CI is 1.96
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  return {
    mean: m,
    lower: m - z * se,
    upper: m + z * se,
    se: se,
  };
}

// Welch's t-test for unequal variances
function welchTTest(group1, group2) {
  const n1 = group1.length;
  const n2 = group2.length;

  if (n1 < 2 || n2 < 2) {
    return { t: 0, df: 0, p: 1 };
  }

  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = Math.pow(standardDeviation(group1), 2);
  const v2 = Math.pow(standardDeviation(group2), 2);

  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) return { t: 0, df: n1 + n2 - 2, p: 1 };

  const t = (m1 - m2) / se;

  // Welch-Satterthwaite degrees of freedom
  const num = Math.pow(v1 / n1 + v2 / n2, 2);
  const denom = Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1);
  const df = denom > 0 ? num / denom : n1 + n2 - 2;

  // Approximate p-value using t-distribution
  // This is a simplified approximation
  const p = 2 * (1 - tCDF(Math.abs(t), df));

  return { t, df, p };
}

// Approximation of t-distribution CDF
function tCDF(t, df) {
  // Using a simple approximation for the t-distribution
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
}

// Regularized incomplete beta function I_x(a, b) via continued fraction.
// Uses the standard DLMF 8.17.22 recurrence (Numerical Recipes §6.4).
function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation when x > (a+1)/(a+b+2) for faster convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(b, a, 1 - x);
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);

  // Evaluate continued fraction with modified Lentz's method
  const maxIter = 200;
  const eps = 3e-14;
  const fpmin = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;

    // Even step: d_{2m}
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;

    // Odd step: d_{2m+1}
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return (front * h) / a;
}

// Log-gamma function (avoids overflow for large arguments)
function lnGamma(z) {
  if (z <= 0) return Infinity;
  // Lanczos approximation (g=7, same coefficients as existing gamma function)
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function _gamma(n) {
  // Stirling's approximation for gamma function
  if (n < 0.5) return Math.PI / (Math.sin(Math.PI * n) * _gamma(1 - n));
  n -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (n + i);
  }
  const t = n + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
}

// Interpret effect size
function interpretEffectSize(d) {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'negligible';
  if (absD < 0.5) return 'small';
  if (absD < 0.8) return 'medium';
  return 'large';
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    profiles: [],
    runId: null,
    scenarios: [],
    dimensions: [
      'overall_score',
      'score_relevance',
      'score_specificity',
      'score_pedagogical',
      'score_personalization',
      'score_actionability',
      'score_tone',
    ],
    export: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--profiles' && args[i + 1]) {
      options.profiles = args[++i].split(',');
    } else if (arg === '--run-id' && args[i + 1]) {
      options.runId = args[++i];
    } else if (arg === '--scenarios' && args[i + 1]) {
      options.scenarios = args[++i].split(',');
    } else if (arg === '--dimensions' && args[i + 1]) {
      options.dimensions = args[++i].split(',');
    } else if (arg === '--export' && args[i + 1]) {
      options.export = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Statistical Analysis for Evaluation Results

Usage:
  node scripts/analyze-eval-results.js [options]

Options:
  --profiles <p1,p2,...>   Compare specific profiles (e.g., baseline,recognition)
  --run-id <id>            Analyze specific evaluation run
  --scenarios <s1,s2,...>  Filter to specific scenarios
  --dimensions <d1,d2,...> Specify dimensions to analyze
  --export <file>          Export results to CSV/JSON
  --verbose, -v            Show detailed output
  --help, -h               Show this help

Examples:
  node scripts/analyze-eval-results.js --profiles baseline,recognition
  node scripts/analyze-eval-results.js --profiles baseline,recognition --scenarios productive_struggle_arc
  node scripts/analyze-eval-results.js --export results.csv
      `);
      process.exit(0);
    }
  }

  return options;
}

// Main analysis function
async function analyzeResults(options) {
  const dbPath = path.join(DATA_DIR, 'evaluations.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`${c.red}Error: Database not found at ${dbPath}${c.reset}`);
    console.log('Run some evaluations first with: node scripts/eval-tutor.js run');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  // Build query
  let query = `
    SELECT
      profile_name,
      scenario_id,
      overall_score,
      score_relevance,
      score_specificity,
      score_pedagogical,
      score_personalization,
      score_actionability,
      score_tone,
      created_at
    FROM evaluation_results
    WHERE success = 1
      AND overall_score IS NOT NULL
  `;

  const params = [];

  if (options.runId) {
    query += ' AND run_id = ?';
    params.push(options.runId);
  }

  if (options.profiles.length > 0) {
    query += ` AND profile_name IN (${options.profiles.map(() => '?').join(',')})`;
    params.push(...options.profiles);
  }

  if (options.scenarios.length > 0) {
    query += ` AND scenario_id IN (${options.scenarios.map(() => '?').join(',')})`;
    params.push(...options.scenarios);
  }

  query += ' ORDER BY profile_name, scenario_id, created_at';

  const results = db.prepare(query).all(...params);

  if (results.length === 0) {
    console.log(`${c.yellow}No evaluation results found matching criteria${c.reset}`);
    return;
  }

  // Group by profile
  const byProfile = {};
  const byScenario = {};

  for (const r of results) {
    const profile = r.profile_name || 'unknown';
    const scenario = r.scenario_id;

    if (!byProfile[profile]) byProfile[profile] = [];
    byProfile[profile].push(r);

    if (!byScenario[scenario]) byScenario[scenario] = {};
    if (!byScenario[scenario][profile]) byScenario[scenario][profile] = [];
    byScenario[scenario][profile].push(r);
  }

  const profiles = Object.keys(byProfile).sort();

  console.log(
    `\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════════════════${c.reset}`,
  );
  console.log(`${c.bold}  STATISTICAL ANALYSIS OF EVALUATION RESULTS${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════════════${c.reset}\n`);

  console.log(`${c.dim}Total results: ${results.length}${c.reset}`);
  console.log(`${c.dim}Profiles: ${profiles.join(', ')}${c.reset}`);
  console.log(`${c.dim}Scenarios: ${Object.keys(byScenario).length}${c.reset}\n`);

  // Profile summary statistics
  console.log(`${c.bold}PROFILE SUMMARY${c.reset}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(
    `${'Profile'.padEnd(20)} ${'N'.padStart(6)} ${'Mean'.padStart(8)} ${'SD'.padStart(8)} ${'95% CI'.padStart(20)}`,
  );
  console.log(`${'─'.repeat(80)}`);

  const profileStats = {};
  for (const profile of profiles) {
    const scores = byProfile[profile].map((r) => r.overall_score);
    const ci = confidenceInterval(scores);
    profileStats[profile] = { scores, ci, n: scores.length };

    console.log(
      `${profile.padEnd(20)} ` +
        `${scores.length.toString().padStart(6)} ` +
        `${ci.mean.toFixed(2).padStart(8)} ` +
        `${standardDeviation(scores).toFixed(2).padStart(8)} ` +
        `[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`.padStart(20),
    );
  }
  console.log();

  // Pairwise comparisons
  if (profiles.length >= 2) {
    console.log(`${c.bold}PAIRWISE COMPARISONS (Overall Score)${c.reset}`);
    console.log(`${'─'.repeat(90)}`);
    console.log(
      `${'Comparison'.padEnd(30)} ` +
        `${'Δ Mean'.padStart(10)} ` +
        `${"Cohen's d".padStart(12)} ` +
        `${'Effect'.padStart(12)} ` +
        `${'t'.padStart(8)} ` +
        `${'p-value'.padStart(10)}`,
    );
    console.log(`${'─'.repeat(90)}`);

    const comparisons = [];
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const p1 = profiles[i];
        const p2 = profiles[j];
        const s1 = profileStats[p1].scores;
        const s2 = profileStats[p2].scores;

        const d = cohensD(s1, s2);
        const ttest = welchTTest(s1, s2);
        const diff = mean(s1) - mean(s2);

        const effectLabel = interpretEffectSize(d);
        const pStr = ttest.p < 0.001 ? '<0.001' : ttest.p.toFixed(3);
        const sigMarker = ttest.p < 0.05 ? (ttest.p < 0.01 ? '**' : '*') : '';

        console.log(
          `${`${p1} vs ${p2}`.padEnd(30)} ` +
            `${(diff >= 0 ? '+' : '') + diff.toFixed(2).padStart(9)} ` +
            `${d.toFixed(3).padStart(12)} ` +
            `${effectLabel.padStart(12)} ` +
            `${ttest.t.toFixed(2).padStart(8)} ` +
            `${pStr.padStart(8)}${sigMarker.padStart(2)}`,
        );

        comparisons.push({ p1, p2, diff, d, effectLabel, t: ttest.t, p: ttest.p });
      }
    }
    console.log(`\n${c.dim}* p < 0.05, ** p < 0.01${c.reset}\n`);

    // Dimension-level analysis
    console.log(`${c.bold}DIMENSION-LEVEL EFFECT SIZES${c.reset}`);
    console.log(`${'─'.repeat(100)}`);

    const dimensions = [
      { key: 'score_relevance', name: 'Relevance' },
      { key: 'score_specificity', name: 'Specificity' },
      { key: 'score_pedagogical', name: 'Pedagogical' },
      { key: 'score_personalization', name: 'Personalization' },
      { key: 'score_actionability', name: 'Actionability' },
      { key: 'score_tone', name: 'Tone' },
    ];

    // Header
    let header = 'Dimension'.padEnd(20);
    for (const profile of profiles) {
      header += profile.substring(0, 12).padStart(14);
    }
    if (profiles.length === 2) {
      header += "  Cohen's d".padStart(14) + '  Effect'.padStart(12);
    }
    console.log(header);
    console.log(`${'─'.repeat(100)}`);

    const dimensionResults = [];
    for (const dim of dimensions) {
      let row = dim.name.padEnd(20);

      const dimScores = {};
      for (const profile of profiles) {
        const scores = byProfile[profile].map((r) => r[dim.key]).filter((s) => s !== null && s !== undefined);
        dimScores[profile] = scores;
        row += mean(scores).toFixed(2).padStart(14);
      }

      if (profiles.length === 2) {
        const d = cohensD(dimScores[profiles[0]], dimScores[profiles[1]]);
        const effect = interpretEffectSize(d);
        row += d.toFixed(3).padStart(14) + effect.padStart(12);
        dimensionResults.push({ dimension: dim.name, d, effect });
      }

      console.log(row);
    }
    console.log();

    // Sort dimensions by effect size for visualization
    if (dimensionResults.length > 0) {
      dimensionResults.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));

      console.log(`${c.bold}EFFECT SIZE RANKING${c.reset}`);
      console.log(`${'─'.repeat(60)}`);

      for (const dr of dimensionResults) {
        const bar = '█'.repeat(Math.min(Math.round(Math.abs(dr.d) * 20), 40));
        const direction = dr.d >= 0 ? c.green : c.red;
        console.log(
          `${dr.dimension.padEnd(20)} ` +
            `${direction}${dr.d >= 0 ? '+' : ''}${dr.d.toFixed(3).padStart(7)}${c.reset} ` +
            `${direction}${bar}${c.reset} ` +
            `${dr.effect}`,
        );
      }
      console.log();
    }

    // Scenario-level breakdown
    console.log(`${c.bold}SCENARIO-LEVEL RESULTS${c.reset}`);
    console.log(`${'─'.repeat(90)}`);

    const scenarios = Object.keys(byScenario).sort();
    for (const scenario of scenarios) {
      const scenarioData = byScenario[scenario];
      const availableProfiles = Object.keys(scenarioData);

      if (availableProfiles.length < 2) continue;

      console.log(`\n${c.cyan}${scenario}${c.reset}`);

      for (let i = 0; i < availableProfiles.length; i++) {
        for (let j = i + 1; j < availableProfiles.length; j++) {
          const p1 = availableProfiles[i];
          const p2 = availableProfiles[j];
          const s1 = scenarioData[p1].map((r) => r.overall_score);
          const s2 = scenarioData[p2].map((r) => r.overall_score);

          const d = cohensD(s1, s2);
          const ttest = welchTTest(s1, s2);
          const diff = mean(s1) - mean(s2);
          const pctImprove = mean(s2) !== 0 ? ((mean(s1) - mean(s2)) / mean(s2)) * 100 : 0;

          console.log(
            `  ${p1}(n=${s1.length}, μ=${mean(s1).toFixed(1)}) vs ` +
              `${p2}(n=${s2.length}, μ=${mean(s2).toFixed(1)}): ` +
              `Δ=${diff >= 0 ? '+' : ''}${diff.toFixed(1)} (${pctImprove >= 0 ? '+' : ''}${pctImprove.toFixed(0)}%), ` +
              `d=${d.toFixed(2)}, p=${ttest.p < 0.001 ? '<0.001' : ttest.p.toFixed(3)}`,
          );
        }
      }
    }
    console.log();

    // Export if requested
    if (options.export) {
      const exportData = {
        generated_at: new Date().toISOString(),
        profiles: profileStats,
        comparisons,
        dimensions: dimensionResults,
        scenarios: byScenario,
      };

      if (options.export.endsWith('.json')) {
        fs.writeFileSync(options.export, JSON.stringify(exportData, null, 2));
      } else {
        // CSV export
        let csv = 'Comparison,Delta_Mean,Cohens_d,Effect_Size,t_statistic,p_value\n';
        for (const comp of comparisons) {
          csv += `"${comp.p1} vs ${comp.p2}",${comp.diff.toFixed(4)},${comp.d.toFixed(4)},${comp.effectLabel},${comp.t.toFixed(4)},${comp.p.toFixed(6)}\n`;
        }
        fs.writeFileSync(options.export, csv);
      }
      console.log(`${c.green}Results exported to ${options.export}${c.reset}`);
    }
  }

  db.close();
}

// Run
const options = parseArgs();
analyzeResults(options).catch((err) => {
  console.error(`${c.red}Error: ${err.message}${c.reset}`);
  process.exit(1);
});
