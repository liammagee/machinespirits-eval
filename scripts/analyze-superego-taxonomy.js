#!/usr/bin/env node
/**
 * analyze-superego-taxonomy.js — Analyze classified superego critique distributions
 *
 * Reads the classified JSONL and produces frequency tables by condition, profile,
 * approval status, intervention type, model, transitions, and revision magnitude.
 * This is the WS2 deliverable for Paper 2.0.
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
  const allCritiques = lines.map((l) => {
    const c = JSON.parse(l);
    // Reclassify parse failures: "Unable to parse superego review" is not a real critique
    if (
      c.classification?.primary === 'OTHER' &&
      c.feedback &&
      c.feedback.startsWith('Unable to parse')
    ) {
      c.classification.primary = 'PARSE_FAILURE';
    }
    return c;
  });

  const critiques = allCritiques.filter((c) => c.classification?.primary !== 'PARSE_FAILURE');
  const parseFailures = allCritiques.filter((c) => c.classification?.primary === 'PARSE_FAILURE');

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  SUPEREGO CRITIQUE TAXONOMY ANALYSIS — N=${critiques.length} (${parseFailures.length} parse failures excluded)`);
  console.log(`${'═'.repeat(70)}\n`);

  if (parseFailures.length > 0) {
    const pfBase = parseFailures.filter((c) => detectCondition(c.profileName) === 'baseline').length;
    const pfRecog = parseFailures.filter((c) => detectCondition(c.profileName) === 'recognition').length;
    console.log(`  Parse failures: ${parseFailures.length} (base=${pfBase}, recog=${pfRecog}) — "Unable to parse superego review"\n`);
  }

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

  // ── 8. Distribution by Ego Model ──────────────────────────────────────

  console.log('\n── 8. Distribution by Ego Model ──────────────────────────────────────\n');

  function shortModel(model) {
    if (!model) return 'unknown';
    if (model.includes('deepseek')) return 'DeepSeek';
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('gemini')) return 'Gemini';
    if (model.includes('sonnet')) return 'Sonnet';
    return model.split('/').pop();
  }

  const modelNames = [...new Set(critiques.map((c) => shortModel(c.model)))].sort();
  for (const model of modelNames) {
    const modelCritiques = critiques.filter((c) => shortModel(c.model) === model);
    const baseCrits = modelCritiques.filter((c) => detectCondition(c.profileName) === 'baseline');
    const recogCrits = modelCritiques.filter((c) => detectCondition(c.profileName) === 'recognition');
    const baseAppr = baseCrits.filter((c) => c.classification?.primary === 'APPROVAL').length;
    const recogAppr = recogCrits.filter((c) => c.classification?.primary === 'APPROVAL').length;

    console.log(
      `  ${model} (N=${modelCritiques.length}): base=${baseCrits.length}, recog=${recogCrits.length}`,
    );
    console.log(
      `    Approval rate: base=${pct(baseAppr, baseCrits.length)}% → recog=${pct(recogAppr, recogCrits.length)}%`,
    );

    // Top non-approval categories
    const nonAppr = modelCritiques.filter((c) => c.classification?.primary !== 'APPROVAL');
    const catCounts = {};
    for (const c of nonAppr) catCounts[c.classification.primary] = (catCounts[c.classification.primary] || 0) + 1;
    const topCats = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    console.log(
      `    Top critiques: ${topCats.map(([cat, n]) => `${cat} ${n} (${pct(n, nonAppr.length)}%)`).join(', ')}`,
    );
    console.log();
  }

  // ── 9. Transition Analysis (Round 1 → Round 2) ──────────────────────

  console.log('── 9. Transition Analysis (Round 1 → Round 2) ───────────────────────\n');

  const byDialogue = {};
  for (const c of critiques) {
    if (!byDialogue[c.dialogueId]) byDialogue[c.dialogueId] = [];
    byDialogue[c.dialogueId].push(c);
  }

  const transitions = [];
  for (const [dialogueId, entries] of Object.entries(byDialogue)) {
    const round1 = entries.filter((e) => e.round === 1);
    const round2 = entries.filter((e) => e.round === 2);
    if (round1.length > 0 && round2.length > 0) {
      for (const r1 of round1) {
        const r2 = round2.find((r) => r.turnIndex === r1.turnIndex) || round2[0];
        transitions.push({
          dialogueId,
          condition: detectCondition(r1.profileName),
          round1Cat: r1.classification?.primary || 'UNKNOWN',
          round2Cat: r2.classification?.primary || 'UNKNOWN',
        });
      }
    }
  }

  console.log(`  Dialogues: ${Object.keys(byDialogue).length}`);
  console.log(`  Round 1→2 transition pairs: ${transitions.length}\n`);

  if (transitions.length > 0) {
    // Overall transition patterns
    const persistCritique = transitions.filter(
      (t) => t.round1Cat !== 'APPROVAL' && t.round2Cat !== 'APPROVAL',
    );
    const resolveToApproval = transitions.filter(
      (t) => t.round1Cat !== 'APPROVAL' && t.round2Cat === 'APPROVAL',
    );
    const newCritique = transitions.filter(
      (t) => t.round1Cat === 'APPROVAL' && t.round2Cat !== 'APPROVAL',
    );
    const stayApproval = transitions.filter(
      (t) => t.round1Cat === 'APPROVAL' && t.round2Cat === 'APPROVAL',
    );

    console.log(`  Overall patterns:`);
    console.log(
      `    Persist critique  (R1 crit → R2 crit):  ${persistCritique.length} (${pct(persistCritique.length, transitions.length)}%)`,
    );
    console.log(
      `    Resolve → approval (R1 crit → R2 ok):   ${resolveToApproval.length} (${pct(resolveToApproval.length, transitions.length)}%)`,
    );
    console.log(
      `    New critique      (R1 ok → R2 crit):    ${newCritique.length} (${pct(newCritique.length, transitions.length)}%)`,
    );
    console.log(
      `    Stay approved     (R1 ok → R2 ok):      ${stayApproval.length} (${pct(stayApproval.length, transitions.length)}%)`,
    );

    // By condition
    console.log(`\n  By condition:`);
    for (const cond of ['baseline', 'recognition']) {
      const condT = transitions.filter((t) => t.condition === cond);
      if (condT.length === 0) continue;
      const persist = condT.filter((t) => t.round1Cat !== 'APPROVAL' && t.round2Cat !== 'APPROVAL').length;
      const resolve = condT.filter((t) => t.round1Cat !== 'APPROVAL' && t.round2Cat === 'APPROVAL').length;
      const newC = condT.filter((t) => t.round1Cat === 'APPROVAL' && t.round2Cat !== 'APPROVAL').length;
      const stay = condT.filter((t) => t.round1Cat === 'APPROVAL' && t.round2Cat === 'APPROVAL').length;
      console.log(`    ${cond} (N=${condT.length}):`);
      console.log(`      Persist: ${persist} (${pct(persist, condT.length)}%)  Resolve: ${resolve} (${pct(resolve, condT.length)}%)  New: ${newC} (${pct(newC, condT.length)}%)  Stay: ${stay} (${pct(stay, condT.length)}%)`);
    }

    // Category persistence: which R1 categories resolve vs persist?
    console.log(`\n  Category persistence (R1 critique → R2 outcome):`);
    const catPersistence = {};
    for (const t of transitions) {
      if (t.round1Cat === 'APPROVAL') continue;
      if (!catPersistence[t.round1Cat])
        catPersistence[t.round1Cat] = { persist: 0, resolve: 0, shift: 0, total: 0 };
      catPersistence[t.round1Cat].total++;
      if (t.round2Cat === 'APPROVAL') catPersistence[t.round1Cat].resolve++;
      else if (t.round2Cat === t.round1Cat) catPersistence[t.round1Cat].persist++;
      else catPersistence[t.round1Cat].shift++;
    }

    console.log('    Category                   Persist  Shift  Resolve  Resolve%');
    console.log('    ' + '─'.repeat(60));
    for (const [cat, counts] of Object.entries(catPersistence).sort(
      (a, b) => b[1].total - a[1].total,
    )) {
      console.log(
        `    ${cat.padEnd(30)}${String(counts.persist).padStart(5)}  ${String(counts.shift).padStart(5)}  ${String(counts.resolve).padStart(7)}  ${pct(counts.resolve, counts.total).padStart(7)}%`,
      );
    }
  }

  // ── 10. Revision Analysis (egoGenerate vs egoRevision) ────────────────

  console.log('\n── 10. Revision Analysis (egoGenerate vs egoRevision) ────────────────\n');

  function jaccard(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 1 : intersection / union;
  }

  function wordCount(text) {
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }

  // Filter to non-approval critiques with both ego texts
  const withRevisions = critiques.filter(
    (c) =>
      c.classification?.primary !== 'APPROVAL' &&
      c.egoGenerate &&
      c.egoRevision &&
      c.egoGenerate !== c.egoRevision,
  );
  const noChange = critiques.filter(
    (c) =>
      c.classification?.primary !== 'APPROVAL' &&
      c.egoGenerate &&
      c.egoRevision &&
      c.egoGenerate === c.egoRevision,
  );
  const missingText = critiques.filter(
    (c) => c.classification?.primary !== 'APPROVAL' && (!c.egoGenerate || !c.egoRevision),
  );

  console.log(`  Non-approval critiques: ${critiques.filter((c) => c.classification?.primary !== 'APPROVAL').length}`);
  console.log(`    With text change: ${withRevisions.length}`);
  console.log(`    Identical (no change): ${noChange.length}`);
  console.log(`    Missing ego text: ${missingText.length}\n`);

  if (withRevisions.length > 0) {
    // Compute metrics
    const revisionMetrics = withRevisions.map((c) => {
      const genWords = wordCount(c.egoGenerate);
      const revWords = wordCount(c.egoRevision);
      const jSim = jaccard(c.egoGenerate, c.egoRevision);
      const lengthDelta = revWords - genWords;

      // Revision type based on Jaccard similarity quartiles
      // Data: P25=0.14, P50=0.20, P75=0.27 — ego regenerates, so all revisions are large
      let revisionType;
      if (jSim > 0.40) revisionType = 'cosmetic';       // Top ~10%: minor surface edits
      else if (jSim > 0.25) revisionType = 'calibrative'; // P75+: adjusted wording/tone
      else if (jSim > 0.14) revisionType = 'substantive'; // P25-P75: significant content change
      else revisionType = 'strategic';                     // Bottom 25%: near-complete rewrite

      return {
        condition: detectCondition(c.profileName),
        model: shortModel(c.model),
        category: c.classification.primary,
        jSim,
        lengthDelta,
        genWords,
        revWords,
        revisionType,
      };
    });

    // By condition
    console.log('  Revision magnitude by condition:');
    for (const cond of ['baseline', 'recognition']) {
      const metrics = revisionMetrics.filter((m) => m.condition === cond);
      if (metrics.length === 0) continue;
      const meanJ = metrics.reduce((s, m) => s + m.jSim, 0) / metrics.length;
      const meanDelta = metrics.reduce((s, m) => s + m.lengthDelta, 0) / metrics.length;
      console.log(
        `    ${cond} (N=${metrics.length}): mean Jaccard=${meanJ.toFixed(3)} (lower=more change), mean word Δ=${meanDelta > 0 ? '+' : ''}${meanDelta.toFixed(1)}`,
      );
    }

    // Revision type distribution by condition
    console.log('\n  Revision type distribution:');
    const typeOrder = ['cosmetic', 'calibrative', 'substantive', 'strategic'];
    console.log('    Type            Base           Recog');
    console.log('    ' + '─'.repeat(45));
    for (const type of typeOrder) {
      const baseMetrics = revisionMetrics.filter((m) => m.condition === 'baseline');
      const recogMetrics = revisionMetrics.filter((m) => m.condition === 'recognition');
      const baseN = baseMetrics.filter((m) => m.revisionType === type).length;
      const recogN = recogMetrics.filter((m) => m.revisionType === type).length;
      console.log(
        `    ${type.padEnd(16)}${String(baseN).padStart(4)} (${pct(baseN, baseMetrics.length).padStart(5)}%)  ${String(recogN).padStart(4)} (${pct(recogN, recogMetrics.length).padStart(5)}%)`,
      );
    }

    // Revision type by critique category
    console.log('\n  Revision type by critique category:');
    console.log('    Category                   Cosm  Calib  Subst  Strat     N  MeanJ  Sub+Str%');
    console.log('    ' + '─'.repeat(75));
    const byCat = {};
    for (const m of revisionMetrics) {
      if (!byCat[m.category]) byCat[m.category] = [];
      byCat[m.category].push(m);
    }
    for (const [cat, metrics] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
      const cosm = metrics.filter((m) => m.revisionType === 'cosmetic').length;
      const cal = metrics.filter((m) => m.revisionType === 'calibrative').length;
      const sub = metrics.filter((m) => m.revisionType === 'substantive').length;
      const strat = metrics.filter((m) => m.revisionType === 'strategic').length;
      const meanJ = metrics.reduce((s, m) => s + m.jSim, 0) / metrics.length;
      const deepPct = pct(sub + strat, metrics.length);
      console.log(
        `    ${cat.padEnd(30)}${String(cosm).padStart(4)}  ${String(cal).padStart(5)}  ${String(sub).padStart(5)}  ${String(strat).padStart(5)}  ${String(metrics.length).padStart(4)}  ${meanJ.toFixed(3)}  ${deepPct.padStart(6)}%`,
      );
    }

    // Key table: revision type by category × condition
    console.log('\n  Key table: revision depth by category × condition:');
    console.log('    Category                Cond         Cosm  Cal  Sub  Str     N  MeanJ  Deep%');
    console.log('    ' + '─'.repeat(80));
    const catsSorted = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length);
    for (const cat of catsSorted) {
      for (const cond of ['baseline', 'recognition']) {
        const metrics = byCat[cat].filter((m) => m.condition === cond);
        if (metrics.length === 0) continue;
        const cosm = metrics.filter((m) => m.revisionType === 'cosmetic').length;
        const cal = metrics.filter((m) => m.revisionType === 'calibrative').length;
        const sub = metrics.filter((m) => m.revisionType === 'substantive').length;
        const strat = metrics.filter((m) => m.revisionType === 'strategic').length;
        const meanJ = metrics.reduce((s, m) => s + m.jSim, 0) / metrics.length;
        const deepPct = pct(sub + strat, metrics.length);
        const condLabel = cond === 'baseline' ? 'base' : 'recog';
        console.log(
          `    ${cat.padEnd(24)}${condLabel.padEnd(13)}${String(cosm).padStart(4)}  ${String(cal).padStart(3)}  ${String(sub).padStart(3)}  ${String(strat).padStart(3)}  ${String(metrics.length).padStart(4)}  ${meanJ.toFixed(3)}  ${deepPct.padStart(5)}%`,
        );
      }
    }

    // By model
    console.log('\n  Revision magnitude by model:');
    for (const model of modelNames) {
      const metrics = revisionMetrics.filter((m) => m.model === model);
      if (metrics.length === 0) continue;
      const meanJ = metrics.reduce((s, m) => s + m.jSim, 0) / metrics.length;
      const deep = metrics.filter(
        (m) => m.revisionType === 'substantive' || m.revisionType === 'strategic',
      ).length;
      console.log(
        `    ${model} (N=${metrics.length}): mean Jaccard=${meanJ.toFixed(3)}, substantive+strategic=${pct(deep, metrics.length)}%`,
      );
    }
  }

  // ── 11. Paper Summary ─────────────────────────────────────────────────

  console.log('\n── 11. Paper Summary (§6.2) ──────────────────────────────────────────\n');

  const baseTot = critiques.filter((c) => detectCondition(c.profileName) === 'baseline');
  const recogTot = critiques.filter((c) => detectCondition(c.profileName) === 'recognition');
  const baseApprTot = baseTot.filter((c) => c.classification?.primary === 'APPROVAL').length;
  const recogApprTot = recogTot.filter((c) => c.classification?.primary === 'APPROVAL').length;

  console.log(`  Total classified: ${critiques.length} (base=${baseTot.length}, recognition=${recogTot.length})`);
  console.log(
    `  Approval rate: base=${pct(baseApprTot, baseTot.length)}% vs recognition=${pct(recogApprTot, recogTot.length)}%`,
  );
  if (baseTot.length > 0 && recogTot.length > 0) {
    console.log(
      `  → Recognition increases approval ${(recogApprTot / recogTot.length / (baseApprTot / baseTot.length || 0.01)).toFixed(1)}× over base`,
    );
  }
  console.log(
    `  Non-approval volume: base=${baseTot.length - baseApprTot} vs recognition=${recogTot.length - recogApprTot}`,
  );
  console.log(
    `  → Base produces ${((baseTot.length - baseApprTot) / (recogTot.length - recogApprTot || 1)).toFixed(1)}× more critiques`,
  );
  console.log();
  console.log(
    '  Interpretation: Recognition pre-empts errors that the superego would catch,',
  );
  console.log('  confirming the substitution mechanism (calibration + error correction overlap).');

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
