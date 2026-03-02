#!/usr/bin/env node
/**
 * analyze-superego-taxonomy.js — Analyze classified superego critique distributions
 *
 * Reads the classified JSONL and produces frequency tables by condition, profile,
 * approval status, and intervention type. This is the WS2 deliverable for Paper 2.0.
 *
 * Usage:
 *   node scripts/analyze-superego-taxonomy.js [--input data/superego-critiques-classified.jsonl]
 *   node scripts/analyze-superego-taxonomy.js --json    # Machine-readable output
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx !== -1 ? args[inputIdx + 1] : join(ROOT, 'data', 'superego-critiques-classified.jsonl');

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(n, total) {
  return total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
}

function chiSquare2x2(a, b, c, d) {
  // 2x2 chi-square: [[a,b],[c,d]]
  const n = a + b + c + d;
  if (n === 0) return { chi2: 0, p: 1 };
  const chi2 = (n * (a * d - b * c) ** 2) / ((a + b) * (c + d) * (a + c) * (b + d) || 1);
  // Approximate p-value from chi2 with df=1
  const p = chi2 > 10.83 ? 0.001 : chi2 > 6.63 ? 0.01 : chi2 > 3.84 ? 0.05 : chi2 > 2.71 ? 0.1 : 1;
  return { chi2: chi2.toFixed(2), p };
}

function detectCondition(profileName) {
  if (!profileName) return 'unknown';
  const p = profileName.toLowerCase();
  if (p.includes('recog') || p.includes('recognition')) return 'recognition';
  if (p.includes('base') || p.includes('baseline') || p.includes('placebo') || p.includes('budget')) return 'baseline';
  // Dialectical variants without recognition
  if (p.includes('dialectical') && !p.includes('recog')) return 'baseline';
  return 'unknown';
}

function detectSuperegoPose(profileName) {
  if (!profileName) return 'standard';
  const p = profileName.toLowerCase();
  if (p.includes('suspicious')) return 'suspicious';
  if (p.includes('adversary')) return 'adversary';
  if (p.includes('advocate')) return 'advocate';
  return 'standard';
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error('Run classify-superego-critiques.js first.');
    process.exit(1);
  }

  const lines = readFileSync(inputPath, 'utf-8').trim().split('\n');
  const critiques = lines.map((l) => JSON.parse(l));

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  SUPEREGO CRITIQUE TAXONOMY ANALYSIS — N=${critiques.length}`);
  console.log(`${'═'.repeat(70)}\n`);

  // ── 1. Overall Distribution ───────────────────────────────────────────

  const categories = {};
  for (const c of critiques) {
    const cat = c.classification?.primary || 'UNKNOWN';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  console.log('── 1. Overall Primary Category Distribution ──────────────────────────\n');
  const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  console.log('  Category                    Count    %');
  console.log('  ' + '─'.repeat(50));
  for (const [cat, count] of sortedCats) {
    console.log(`  ${cat.padEnd(30)}${String(count).padStart(5)}  ${pct(count, critiques.length).padStart(6)}%`);
  }

  // ── 2. By Condition (Recognition vs Baseline) ─────────────────────────

  console.log('\n── 2. Distribution by Condition ───────────────────────────────────────\n');

  const byCondition = { recognition: {}, baseline: {}, unknown: {} };
  const conditionCounts = { recognition: 0, baseline: 0, unknown: 0 };

  for (const c of critiques) {
    const cond = detectCondition(c.profileName);
    const cat = c.classification?.primary || 'UNKNOWN';
    byCondition[cond][cat] = (byCondition[cond][cat] || 0) + 1;
    conditionCounts[cond]++;
  }

  const allCats = [...new Set(critiques.map((c) => c.classification?.primary || 'UNKNOWN'))].sort();

  console.log(
    `  Category                    Base (N=${conditionCounts.baseline})    Recog (N=${conditionCounts.recognition})    χ²      sig`,
  );
  console.log('  ' + '─'.repeat(75));

  for (const cat of allCats) {
    const baseCount = byCondition.baseline[cat] || 0;
    const recogCount = byCondition.recognition[cat] || 0;
    const baseOther = conditionCounts.baseline - baseCount;
    const recogOther = conditionCounts.recognition - recogCount;
    const { chi2, p } = chiSquare2x2(baseCount, recogCount, baseOther, recogOther);
    const sig = p <= 0.001 ? '***' : p <= 0.01 ? '**' : p <= 0.05 ? '*' : p <= 0.1 ? '†' : '';

    const baseStr = `${baseCount} (${pct(baseCount, conditionCounts.baseline)}%)`;
    const recogStr = `${recogCount} (${pct(recogCount, conditionCounts.recognition)}%)`;
    console.log(
      `  ${cat.padEnd(30)}${baseStr.padStart(12)}    ${recogStr.padStart(12)}    ${chi2.padStart(6)}  ${sig}`,
    );
  }

  if (conditionCounts.unknown > 0) {
    console.log(`\n  (${conditionCounts.unknown} critiques from profiles with unclear condition — excluded from χ²)`);
  }

  // ── 3. By Superego Pose ───────────────────────────────────────────────

  console.log('\n── 3. Distribution by Superego Pose ──────────────────────────────────\n');

  const byPose = {};
  const poseCounts = {};

  for (const c of critiques) {
    const pose = detectSuperegoPose(c.profileName);
    const cat = c.classification?.primary || 'UNKNOWN';
    if (!byPose[pose]) byPose[pose] = {};
    byPose[pose][cat] = (byPose[pose][cat] || 0) + 1;
    poseCounts[pose] = (poseCounts[pose] || 0) + 1;
  }

  const poses = Object.keys(poseCounts).sort((a, b) => (poseCounts[b] || 0) - (poseCounts[a] || 0));
  const poseHeader = poses.map((p) => `${p} (${poseCounts[p]})`).join('    ');
  console.log(`  Category                    ${poseHeader}`);
  console.log('  ' + '─'.repeat(30 + poses.length * 20));

  for (const cat of allCats) {
    let line = `  ${cat.padEnd(30)}`;
    for (const pose of poses) {
      const count = byPose[pose]?.[cat] || 0;
      const str = `${count} (${pct(count, poseCounts[pose])}%)`;
      line += str.padStart(16) + '    ';
    }
    console.log(line);
  }

  // ── 4. Approval vs Rejection ──────────────────────────────────────────

  console.log('\n── 4. Category Distribution by Verdict ───────────────────────────────\n');

  const byVerdict = { approved: {}, rejected: {} };
  const verdictCounts = { approved: 0, rejected: 0 };

  for (const c of critiques) {
    const v = c.approved === true ? 'approved' : 'rejected';
    const cat = c.classification?.primary || 'UNKNOWN';
    byVerdict[v][cat] = (byVerdict[v][cat] || 0) + 1;
    verdictCounts[v]++;
  }

  console.log(
    `  Category                    Approved (${verdictCounts.approved})    Rejected (${verdictCounts.rejected})`,
  );
  console.log('  ' + '─'.repeat(65));
  for (const cat of allCats) {
    const appCount = byVerdict.approved[cat] || 0;
    const rejCount = byVerdict.rejected[cat] || 0;
    const appStr = `${appCount} (${pct(appCount, verdictCounts.approved)}%)`;
    const rejStr = `${rejCount} (${pct(rejCount, verdictCounts.rejected)}%)`;
    console.log(`  ${cat.padEnd(30)}${appStr.padStart(14)}    ${rejStr.padStart(14)}`);
  }

  // ── 5. Secondary Categories ───────────────────────────────────────────

  console.log('\n── 5. Secondary Category Co-occurrence ───────────────────────────────\n');

  const secondaryCounts = {};
  let withSecondary = 0;
  for (const c of critiques) {
    const secs = c.classification?.secondary || [];
    if (secs.length > 0) withSecondary++;
    for (const s of secs) {
      secondaryCounts[s] = (secondaryCounts[s] || 0) + 1;
    }
  }

  console.log(
    `  ${withSecondary}/${critiques.length} critiques have secondary categories (${pct(withSecondary, critiques.length)}%)\n`,
  );
  for (const [cat, count] of Object.entries(secondaryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(30)}${String(count).padStart(5)}`);
  }

  // ── 6. Confidence Distribution ────────────────────────────────────────

  console.log('\n── 6. Classification Confidence ──────────────────────────────────────\n');

  const confs = critiques.map((c) => c.classification?.confidence || 0).filter((c) => c > 0);
  if (confs.length > 0) {
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
    const min = Math.min(...confs);
    const max = Math.max(...confs);
    const sorted = [...confs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(
      `  Mean: ${avg.toFixed(2)}  Median: ${median.toFixed(2)}  Min: ${min.toFixed(2)}  Max: ${max.toFixed(2)}`,
    );
  }

  // ── 7. Key Finding: Recognition Effect on Critique Categories ─────────

  console.log('\n── 7. Key Finding: Recognition Effect ────────────────────────────────\n');

  const baseCritiques = critiques.filter(
    (c) => detectCondition(c.profileName) === 'baseline' && c.classification?.primary !== 'APPROVAL',
  );
  const recogCritiques = critiques.filter(
    (c) => detectCondition(c.profileName) === 'recognition' && c.classification?.primary !== 'APPROVAL',
  );

  if (baseCritiques.length > 0 && recogCritiques.length > 0) {
    // Top 3 categories under each condition
    const baseTopCats = {};
    for (const c of baseCritiques)
      baseTopCats[c.classification.primary] = (baseTopCats[c.classification.primary] || 0) + 1;
    const recogTopCats = {};
    for (const c of recogCritiques)
      recogTopCats[c.classification.primary] = (recogTopCats[c.classification.primary] || 0) + 1;

    console.log(`  Baseline (N=${baseCritiques.length} non-approval):`);
    for (const [cat, count] of Object.entries(baseTopCats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)) {
      console.log(`    ${cat}: ${count} (${pct(count, baseCritiques.length)}%)`);
    }
    console.log(`\n  Recognition (N=${recogCritiques.length} non-approval):`);
    for (const [cat, count] of Object.entries(recogTopCats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)) {
      console.log(`    ${cat}: ${count} (${pct(count, recogCritiques.length)}%)`);
    }

    // Key comparison: does recognition reduce CONTEXT_BLINDNESS or RECOGNITION_FAILURE?
    const baseCB = baseTopCats['CONTEXT_BLINDNESS'] || 0;
    const recogCB = recogTopCats['CONTEXT_BLINDNESS'] || 0;
    const baseRF = baseTopCats['RECOGNITION_FAILURE'] || 0;
    const recogRF = recogTopCats['RECOGNITION_FAILURE'] || 0;

    console.log(`\n  Key comparisons (excluding approvals):`);
    console.log(
      `    CONTEXT_BLINDNESS:   base=${pct(baseCB, baseCritiques.length)}%  recog=${pct(recogCB, recogCritiques.length)}%`,
    );
    console.log(
      `    RECOGNITION_FAILURE: base=${pct(baseRF, baseCritiques.length)}%  recog=${pct(recogRF, recogCritiques.length)}%`,
    );
  } else {
    console.log('  Insufficient data for condition comparison.');
  }

  console.log(`\n${'═'.repeat(70)}\n`);

  // ── JSON output ───────────────────────────────────────────────────────

  if (jsonMode) {
    const output = {
      n: critiques.length,
      overall: categories,
      byCondition: { counts: conditionCounts, distributions: byCondition },
      byPose: { counts: poseCounts, distributions: byPose },
      byVerdict: { counts: verdictCounts, distributions: byVerdict },
      secondary: secondaryCounts,
    };
    const jsonPath = inputPath.replace('.jsonl', '-analysis.json');
    writeFileSync(jsonPath, JSON.stringify(output, null, 2));
    console.log(`JSON output written to: ${jsonPath}`);
  }
}

main();
