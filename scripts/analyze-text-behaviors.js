#!/usr/bin/env node

/**
 * Text-Level Behavioral Analysis for Paper 2.0
 *
 * Extracts behavioral markers from dialogue traces that complement rubric scores.
 * All analyses are free (pure computation on existing trace data, no API calls).
 *
 * Analyses:
 *   §1  Question frequency — questions/turn by condition, model, scenario, and turn index
 *   §2  Vocabulary divergence — Jensen-Shannon divergence between base/recog word distributions
 *   §3  Ceiling regression — development score ~ T1 score (ceiling compression test)
 *   §4  Gemini Flash scenario effects — completes cross-model scenario table
 *   §5  Turn-by-turn question trajectory — is question rate fixed or adaptive?
 *   §6  Mediation analysis — does question frequency mediate recognition → quality?
 *
 * Usage:
 *   node scripts/analyze-text-behaviors.js [--section N] [--json] [--verbose]
 *   node scripts/analyze-text-behaviors.js --section 1       # Question frequency only
 *   node scripts/analyze-text-behaviors.js                   # All sections
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');

const args = process.argv.slice(2);
const section = args.find((a, i) => args[i - 1] === '--section') || 'all';
const jsonOutput = args.includes('--json');
const verbose = args.includes('--verbose');

const RUN_IDS = [
  'eval-2026-03-01-aea2abfb',
  'eval-2026-03-02-45163390',
  'eval-2026-03-02-18027efc',
];
const MODEL_MAP = {
  'eval-2026-03-01-aea2abfb': 'DeepSeek V3.2',
  'eval-2026-03-02-45163390': 'Haiku 4.5',
  'eval-2026-03-02-18027efc': 'Gemini Flash',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

function getEpoch2Rows(db) {
  return db.prepare(`
    SELECT dialogue_id, profile_name, scenario_id, scenario_name, run_id,
           tutor_first_turn_score, tutor_last_turn_score, tutor_development_score,
           tutor_holistic_overall_score, learner_overall_score, dialogue_quality_score,
           ego_model
    FROM evaluation_results
    WHERE tutor_rubric_version = '2.2'
      AND tutor_first_turn_score IS NOT NULL
      AND dialogue_id IS NOT NULL AND dialogue_id <> ''
      AND judge_model LIKE '%sonnet%'
      AND run_id IN (${RUN_IDS.map(() => '?').join(',')})
  `).all(...RUN_IDS);
}

function loadTrace(dialogueId) {
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return d.dialogueTrace || d.trace || [];
  } catch { return null; }
}

function extractTutorTurns(trace) {
  // Ego entries often lack turnIndex. Assign sequential turn numbers based on
  // position: each ego generate/revise after a context_input is a new turn.
  const turns = [];
  let currentTurn = 0;
  for (const e of trace) {
    if (e.agent === 'tutor' && e.action === 'context_input') {
      currentTurn++;
    }
    if (e.agent === 'ego' && (e.action === 'revise' || e.action === 'generate_final' || e.action === 'generate')) {
      const msg = (e.suggestions || []).map(s => s.message || s.title || '').join(' ');
      if (msg) {
        const turnIdx = e.turnIndex ?? currentTurn;
        // Keep latest revision per turn (revise overwrites generate)
        const existing = turns.findIndex(t => t.turn === turnIdx);
        if (existing >= 0) {
          turns[existing] = { turn: turnIdx, text: msg };
        } else {
          turns.push({ turn: turnIdx, text: msg });
        }
      }
    }
  }
  return turns.sort((a, b) => a.turn - b.turn);
}

function countQuestions(text) {
  return (text.match(/\?/g) || []).length;
}

function isRecog(profileName) {
  return profileName.includes('recog');
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

function cohensD(a, b) {
  const pooledSD = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
  if (pooledSD === 0) return 0;
  return (mean(a) - mean(b)) / pooledSD;
}

function pearsonR(x, y) {
  if (x.length < 3) return 0;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function tTest(r, n) {
  if (n < 3) return { t: 0, p: 1 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Approximate p-value for two-tailed t-test using normal approximation
  const absT = Math.abs(t);
  const p = Math.exp(-0.717 * absT - 0.416 * absT * absT);
  return { t, p: Math.min(1, 2 * p) };
}

function jsd(freqA, freqB) {
  const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  const totalA = Object.values(freqA).reduce((a, b) => a + b, 0) || 1;
  const totalB = Object.values(freqB).reduce((a, b) => a + b, 0) || 1;

  let divergence = 0;
  for (const w of allWords) {
    const pA = (freqA[w] || 0) / totalA;
    const pB = (freqB[w] || 0) / totalB;
    const m = (pA + pB) / 2;
    if (pA > 0 && m > 0) divergence += pA * Math.log2(pA / m);
    if (pB > 0 && m > 0) divergence += pB * Math.log2(pB / m);
  }
  return divergence / 2; // JSD is symmetric average of KL divergences
}

// ── §1: Question Frequency ──────────────────────────────────────────────

function analyzeQuestionFrequency(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§1  QUESTION FREQUENCY BY CONDITION, MODEL, AND SCENARIO');
  console.log('═══════════════════════════════════════════════════════════\n');

  const data = {
    byCondition: { base: { q: 0, turns: 0 }, recog: { q: 0, turns: 0 } },
    byModel: {},
    byScenario: {},
    byConditionModel: {},
  };

  for (const row of rows) {
    const trace = loadTrace(row.dialogue_id);
    if (!trace) continue;
    const tutorTurns = extractTutorTurns(trace);
    const cond = isRecog(row.profile_name) ? 'recog' : 'base';
    const model = MODEL_MAP[row.run_id] || 'unknown';

    for (const t of tutorTurns) {
      const qCount = countQuestions(t.text);
      data.byCondition[cond].q += qCount;
      data.byCondition[cond].turns += 1;

      if (!data.byModel[model]) data.byModel[model] = { base: { q: 0, turns: 0 }, recog: { q: 0, turns: 0 } };
      data.byModel[model][cond].q += qCount;
      data.byModel[model][cond].turns += 1;

      const scenKey = row.scenario_id;
      if (!data.byScenario[scenKey]) data.byScenario[scenKey] = { name: row.scenario_name, base: { q: 0, turns: 0 }, recog: { q: 0, turns: 0 } };
      data.byScenario[scenKey][cond].q += qCount;
      data.byScenario[scenKey][cond].turns += 1;

      const cmKey = `${model}|${cond}`;
      if (!data.byConditionModel[cmKey]) data.byConditionModel[cmKey] = { q: 0, turns: 0 };
      data.byConditionModel[cmKey].q += qCount;
      data.byConditionModel[cmKey].turns += 1;
    }
  }

  // Overall
  const bRate = data.byCondition.base.q / data.byCondition.base.turns;
  const rRate = data.byCondition.recog.q / data.byCondition.recog.turns;
  console.log('### Overall');
  console.log(`Base:       ${bRate.toFixed(3)} questions/turn (${data.byCondition.base.q} questions / ${data.byCondition.base.turns} turns)`);
  console.log(`Recognition: ${rRate.toFixed(3)} questions/turn (${data.byCondition.recog.q} questions / ${data.byCondition.recog.turns} turns)`);
  console.log(`Ratio:       ${(rRate / bRate).toFixed(1)}×\n`);

  // By model
  console.log('### By Generation Model');
  console.log('| Model | Base q/turn | Recog q/turn | Ratio | Base N | Recog N |');
  console.log('|---|---|---|---|---|---|');
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const m = data.byModel[model];
    if (!m) continue;
    const br = m.base.q / m.base.turns;
    const rr = m.recog.q / m.recog.turns;
    console.log(`| ${model} | ${br.toFixed(3)} | ${rr.toFixed(3)} | **${(rr / br).toFixed(1)}×** | ${m.base.turns} | ${m.recog.turns} |`);
  }

  // By scenario
  console.log('\n### By Scenario');
  console.log('| Scenario | Base q/turn | Recog q/turn | Ratio |');
  console.log('|---|---|---|---|');
  const scenEntries = Object.entries(data.byScenario)
    .map(([id, s]) => ({
      name: s.name,
      bRate: s.base.turns > 0 ? s.base.q / s.base.turns : 0,
      rRate: s.recog.turns > 0 ? s.recog.q / s.recog.turns : 0,
    }))
    .sort((a, b) => (b.rRate / Math.max(b.bRate, 0.001)) - (a.rRate / Math.max(a.bRate, 0.001)));
  for (const s of scenEntries) {
    const ratio = s.bRate > 0 ? (s.rRate / s.bRate).toFixed(1) : '∞';
    console.log(`| ${s.name} | ${s.bRate.toFixed(3)} | ${s.rRate.toFixed(3)} | ${ratio}× |`);
  }

  return data;
}

// ── §2: Vocabulary Divergence ───────────────────────────────────────────

function analyzeVocabularyDivergence(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§2  VOCABULARY DIVERGENCE (JENSEN-SHANNON DIVERGENCE)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const freqs = {
    overall: { base: {}, recog: {} },
    byModel: {},
  };

  for (const row of rows) {
    const trace = loadTrace(row.dialogue_id);
    if (!trace) continue;
    const tutorTurns = extractTutorTurns(trace);
    const cond = isRecog(row.profile_name) ? 'recog' : 'base';
    const model = MODEL_MAP[row.run_id] || 'unknown';

    if (!freqs.byModel[model]) freqs.byModel[model] = { base: {}, recog: {} };

    for (const t of tutorTurns) {
      const words = t.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        freqs.overall[cond][w] = (freqs.overall[cond][w] || 0) + 1;
        freqs.byModel[model][cond][w] = (freqs.byModel[model][cond][w] || 0) + 1;
      }
    }
  }

  // Overall JSD
  const overallJSD = jsd(freqs.overall.base, freqs.overall.recog);
  console.log(`### Overall JSD (base vs recognition): ${overallJSD.toFixed(4)}`);
  console.log(`  (0 = identical distributions, 1 = maximally different)\n`);

  // By model
  console.log('### By Generation Model');
  console.log('| Model | JSD | Base vocab size | Recog vocab size |');
  console.log('|---|---|---|---|');
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const m = freqs.byModel[model];
    if (!m) continue;
    const d = jsd(m.base, m.recog);
    console.log(`| ${model} | ${d.toFixed(4)} | ${Object.keys(m.base).length} | ${Object.keys(m.recog).length} |`);
  }

  // Top divergent words (most different between conditions)
  console.log('\n### Most Recognition-Distinctive Words (top 20)');
  const totalBase = Object.values(freqs.overall.base).reduce((a, b) => a + b, 0);
  const totalRecog = Object.values(freqs.overall.recog).reduce((a, b) => a + b, 0);
  const allWords = new Set([...Object.keys(freqs.overall.base), ...Object.keys(freqs.overall.recog)]);
  const wordScores = [];
  for (const w of allWords) {
    const pBase = (freqs.overall.base[w] || 0) / totalBase;
    const pRecog = (freqs.overall.recog[w] || 0) / totalRecog;
    // Log-ratio favoring recognition
    if (pRecog > 0.0001 && pBase > 0) {
      wordScores.push({ word: w, ratio: pRecog / pBase, pRecog, pBase, count: (freqs.overall.recog[w] || 0) });
    }
  }
  wordScores.sort((a, b) => b.ratio - a.ratio);
  console.log('| Word | Recog freq | Base freq | Ratio |');
  console.log('|---|---|---|---|');
  for (const ws of wordScores.filter(w => w.count >= 10).slice(0, 20)) {
    console.log(`| ${ws.word} | ${ws.pRecog.toFixed(5)} | ${ws.pBase.toFixed(5)} | ${ws.ratio.toFixed(1)}× |`);
  }

  // Top base-distinctive words
  console.log('\n### Most Base-Distinctive Words (top 20)');
  const baseScores = [];
  for (const w of allWords) {
    const pBase = (freqs.overall.base[w] || 0) / totalBase;
    const pRecog = (freqs.overall.recog[w] || 0) / totalRecog;
    if (pBase > 0.0001 && pRecog > 0) {
      baseScores.push({ word: w, ratio: pBase / pRecog, pRecog, pBase, count: (freqs.overall.base[w] || 0) });
    }
  }
  baseScores.sort((a, b) => b.ratio - a.ratio);
  console.log('| Word | Base freq | Recog freq | Ratio |');
  console.log('|---|---|---|---|');
  for (const ws of baseScores.filter(w => w.count >= 10).slice(0, 20)) {
    console.log(`| ${ws.word} | ${ws.pBase.toFixed(5)} | ${ws.pRecog.toFixed(5)} | ${ws.ratio.toFixed(1)}× |`);
  }

  return { overallJSD, byModel: Object.fromEntries(Object.entries(freqs.byModel).map(([m, f]) => [m, jsd(f.base, f.recog)])) };
}

// ── §3: Ceiling Regression ──────────────────────────────────────────────

function analyzeCeilingRegression(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§3  CEILING REGRESSION (DEVELOPMENT ~ T1 SCORE)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Only rows with both T1 and development scores
  const validRows = rows.filter(r => r.tutor_first_turn_score != null && r.tutor_development_score != null);

  console.log(`Total rows with T1 + development: ${validRows.length}\n`);

  // Overall
  const t1All = validRows.map(r => r.tutor_first_turn_score);
  const devAll = validRows.map(r => r.tutor_development_score);
  const rAll = pearsonR(t1All, devAll);
  const tTestAll = tTest(rAll, t1All.length);
  console.log(`### Overall: r = ${rAll.toFixed(3)}, t(${t1All.length - 2}) = ${tTestAll.t.toFixed(2)}, p ${tTestAll.p < .001 ? '< .001' : '= ' + tTestAll.p.toFixed(3)}`);
  console.log(`  Interpretation: ${rAll < -0.3 ? 'STRONG ceiling compression' : rAll < -0.1 ? 'Moderate ceiling compression' : 'Weak or no ceiling effect'}\n`);

  // By condition
  console.log('### By Condition');
  console.log('| Condition | N | r(T1, dev) | t | p | Interpretation |');
  console.log('|---|---|---|---|---|---|');
  for (const cond of ['base', 'recog']) {
    const subset = validRows.filter(r => isRecog(r.profile_name) === (cond === 'recog'));
    const t1 = subset.map(r => r.tutor_first_turn_score);
    const dev = subset.map(r => r.tutor_development_score);
    const r = pearsonR(t1, dev);
    const tt = tTest(r, t1.length);
    const interp = r < -0.3 ? 'Strong ceiling' : r < -0.1 ? 'Moderate ceiling' : 'Weak/none';
    console.log(`| ${cond} | ${t1.length} | ${r.toFixed(3)} | ${tt.t.toFixed(2)} | ${tt.p < .001 ? '< .001' : tt.p.toFixed(3)} | ${interp} |`);
  }

  // By model
  console.log('\n### By Generation Model');
  console.log('| Model | N | r(T1, dev) | t | p |');
  console.log('|---|---|---|---|---|');
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const runId = Object.entries(MODEL_MAP).find(([, v]) => v === model)?.[0];
    const subset = validRows.filter(r => r.run_id === runId);
    const t1 = subset.map(r => r.tutor_first_turn_score);
    const dev = subset.map(r => r.tutor_development_score);
    const r = pearsonR(t1, dev);
    const tt = tTest(r, t1.length);
    console.log(`| ${model} | ${t1.length} | ${r.toFixed(3)} | ${tt.t.toFixed(2)} | ${tt.p < .001 ? '< .001' : tt.p.toFixed(3)} |`);
  }

  // By model × condition
  console.log('\n### By Model × Condition');
  console.log('| Model | Condition | N | r(T1, dev) | t | p |');
  console.log('|---|---|---|---|---|---|');
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const runId = Object.entries(MODEL_MAP).find(([, v]) => v === model)?.[0];
    for (const cond of ['base', 'recog']) {
      const subset = validRows.filter(r => r.run_id === runId && isRecog(r.profile_name) === (cond === 'recog'));
      if (subset.length < 5) continue;
      const t1 = subset.map(r => r.tutor_first_turn_score);
      const dev = subset.map(r => r.tutor_development_score);
      const r = pearsonR(t1, dev);
      const tt = tTest(r, t1.length);
      console.log(`| ${model} | ${cond} | ${t1.length} | ${r.toFixed(3)} | ${tt.t.toFixed(2)} | ${tt.p < .001 ? '< .001' : tt.p.toFixed(3)} |`);
    }
  }

  return { rAll, n: t1All.length };
}

// ── §4: Gemini Flash Scenario Effects ───────────────────────────────────

function analyzeGeminiFlashScenarios(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§4  GEMINI FLASH SCENARIO EFFECTS (CROSS-MODEL COMPARISON)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const geminiRows = rows.filter(r => r.run_id === 'eval-2026-03-02-18027efc');

  // By scenario × condition
  const scenarios = {};
  for (const row of geminiRows) {
    const scenKey = row.scenario_id;
    if (!scenarios[scenKey]) scenarios[scenKey] = { name: row.scenario_name, base: [], recog: [] };
    const cond = isRecog(row.profile_name) ? 'recog' : 'base';
    scenarios[scenKey][cond].push(row.tutor_first_turn_score);
  }

  console.log('### Gemini Flash: Recognition Delta by Scenario');
  console.log('| Scenario | Base Mean (N) | Recog Mean (N) | Delta | d |');
  console.log('|---|---|---|---|---|');
  const scenEntries = Object.entries(scenarios)
    .map(([id, s]) => {
      const bm = mean(s.base);
      const rm = mean(s.recog);
      return { name: s.name, baseMean: bm, recogMean: rm, delta: rm - bm, d: cohensD(s.recog, s.base), baseN: s.base.length, recogN: s.recog.length };
    })
    .sort((a, b) => b.delta - a.delta);
  for (const s of scenEntries) {
    console.log(`| ${s.name} | ${s.baseMean.toFixed(1)} (${s.baseN}) | ${s.recogMean.toFixed(1)} (${s.recogN}) | **+${s.delta.toFixed(1)}** | ${s.d.toFixed(2)} |`);
  }

  // Cross-model scenario rank comparison
  console.log('\n### Cross-Model Scenario Rank Comparison');
  console.log('(Rank = largest to smallest recognition delta)\n');

  const allModels = {};
  for (const row of rows) {
    const model = MODEL_MAP[row.run_id];
    const scenKey = row.scenario_id;
    if (!allModels[model]) allModels[model] = {};
    if (!allModels[model][scenKey]) allModels[model][scenKey] = { name: row.scenario_name, base: [], recog: [] };
    const cond = isRecog(row.profile_name) ? 'recog' : 'base';
    allModels[model][scenKey][cond].push(row.tutor_first_turn_score);
  }

  console.log('| Scenario | DeepSeek Δ (rank) | Haiku Δ (rank) | Gemini Δ (rank) |');
  console.log('|---|---|---|---|');

  // Get all scenario IDs across models
  const allScenIds = [...new Set(rows.map(r => r.scenario_id))];
  const modelDeltas = {};
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const deltas = [];
    for (const scenId of allScenIds) {
      const s = allModels[model]?.[scenId];
      if (!s || s.base.length === 0 || s.recog.length === 0) continue;
      deltas.push({ scenId, name: s.name, delta: mean(s.recog) - mean(s.base) });
    }
    deltas.sort((a, b) => b.delta - a.delta);
    modelDeltas[model] = deltas.map((d, i) => ({ ...d, rank: i + 1 }));
  }

  for (const scenId of allScenIds) {
    const ds = modelDeltas['DeepSeek V3.2']?.find(d => d.scenId === scenId);
    const hk = modelDeltas['Haiku 4.5']?.find(d => d.scenId === scenId);
    const gf = modelDeltas['Gemini Flash']?.find(d => d.scenId === scenId);
    if (!ds && !hk && !gf) continue;
    const name = ds?.name || hk?.name || gf?.name || scenId;
    const fmt = (m) => m ? `+${m.delta.toFixed(1)} (#${m.rank})` : '—';
    console.log(`| ${name} | ${fmt(ds)} | ${fmt(hk)} | ${fmt(gf)} |`);
  }

  return scenarios;
}

// ── §5: Turn-by-Turn Question Trajectory ────────────────────────────────

function analyzeQuestionTrajectory(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§5  TURN-BY-TURN QUESTION TRAJECTORY');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Collect questions per turn index
  const byTurn = {};  // turnIndex -> { base: [qCounts], recog: [qCounts] }
  const byTurnModel = {};  // model -> turnIndex -> { base: [qCounts], recog: [qCounts] }

  for (const row of rows) {
    const trace = loadTrace(row.dialogue_id);
    if (!trace) continue;
    const tutorTurns = extractTutorTurns(trace);
    const cond = isRecog(row.profile_name) ? 'recog' : 'base';
    const model = MODEL_MAP[row.run_id] || 'unknown';

    for (const t of tutorTurns) {
      const ti = t.turn ?? 0;
      if (ti > 6) continue; // Cap at 6 turns
      const qCount = countQuestions(t.text);

      if (!byTurn[ti]) byTurn[ti] = { base: [], recog: [] };
      byTurn[ti][cond].push(qCount);

      if (!byTurnModel[model]) byTurnModel[model] = {};
      if (!byTurnModel[model][ti]) byTurnModel[model][ti] = { base: [], recog: [] };
      byTurnModel[model][ti][cond].push(qCount);
    }
  }

  // Overall trajectory
  console.log('### Overall Question Rate by Turn Index');
  console.log('| Turn | Base q/turn (N) | Recog q/turn (N) | Ratio |');
  console.log('|---|---|---|---|');
  const turns = Object.keys(byTurn).map(Number).sort((a, b) => a - b);
  for (const ti of turns) {
    const b = byTurn[ti].base;
    const r = byTurn[ti].recog;
    const bRate = mean(b);
    const rRate = mean(r);
    const ratio = bRate > 0 ? (rRate / bRate).toFixed(1) : '∞';
    console.log(`| T${ti} | ${bRate.toFixed(3)} (${b.length}) | ${rRate.toFixed(3)} (${r.length}) | ${ratio}× |`);
  }

  // Slope analysis: is the question rate increasing over turns?
  console.log('\n### Question Rate Slope (OLS regression: q/turn ~ turnIndex)');
  for (const cond of ['base', 'recog']) {
    const x = [], y = [];
    for (const ti of turns) {
      const vals = byTurn[ti][cond];
      for (const v of vals) {
        x.push(ti);
        y.push(v);
      }
    }
    const r = pearsonR(x, y);
    const tt = tTest(r, x.length);
    // Compute actual slope via OLS
    const mx = mean(x), my = mean(y);
    let num = 0, denom = 0;
    for (let i = 0; i < x.length; i++) {
      num += (x[i] - mx) * (y[i] - my);
      denom += (x[i] - mx) ** 2;
    }
    const slope = denom > 0 ? num / denom : 0;
    console.log(`  ${cond}: slope = ${slope.toFixed(4)} q/turn per turn, r = ${r.toFixed(3)}, p ${tt.p < .001 ? '< .001' : '= ' + tt.p.toFixed(3)}`);
  }

  // By model
  console.log('\n### By Model');
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const mt = byTurnModel[model];
    if (!mt) continue;
    console.log(`\n**${model}**`);
    console.log('| Turn | Base q/turn | Recog q/turn |');
    console.log('|---|---|---|');
    const mTurns = Object.keys(mt).map(Number).sort((a, b) => a - b);
    for (const ti of mTurns) {
      const bRate = mean(mt[ti].base);
      const rRate = mean(mt[ti].recog);
      console.log(`| T${ti} | ${bRate.toFixed(3)} | ${rRate.toFixed(3)} |`);
    }
  }

  return byTurn;
}

// ── §6: Mediation Analysis (Baron-Kenny) ─────────────────────────────────

function ols2(y, x1, x2) {
  // OLS regression: y = b0 + b1*x1 + b2*x2
  // Returns { b0, b1, b2, r2, se_b1, se_b2, t_b1, t_b2, p_b1, p_b2 }
  const n = y.length;
  const my = mean(y), mx1 = mean(x1), mx2 = mean(x2);

  // Normal equations via cross-products
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = x1[i] - mx1, d2 = x2[i] - mx2, dy = y[i] - my;
    s11 += d1 * d1;
    s22 += d2 * d2;
    s12 += d1 * d2;
    sy1 += dy * d1;
    sy2 += dy * d2;
  }

  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-12) return null;

  const b1 = (s22 * sy1 - s12 * sy2) / det;
  const b2 = (s11 * sy2 - s12 * sy1) / det;
  const b0 = my - b1 * mx1 - b2 * mx2;

  // Residuals and R²
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = b0 + b1 * x1[i] + b2 * x2[i];
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Standard errors of coefficients
  const mse = ssRes / (n - 3);
  const se_b1 = Math.sqrt(mse * s22 / det);
  const se_b2 = Math.sqrt(mse * s11 / det);
  const t_b1 = se_b1 > 0 ? b1 / se_b1 : 0;
  const t_b2 = se_b2 > 0 ? b2 / se_b2 : 0;

  // Approximate p-values
  const pApprox = (t) => {
    const absT = Math.abs(t);
    return Math.min(1, 2 * Math.exp(-0.717 * absT - 0.416 * absT * absT));
  };

  return { b0, b1, b2, r2, se_b1, se_b2, t_b1, t_b2, p_b1: pApprox(t_b1), p_b2: pApprox(t_b2), n, mse };
}

function ols1(y, x) {
  // Simple OLS: y = b0 + b1*x
  const n = y.length;
  const mx = mean(x), my = mean(y);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    sxx += dx * dx;
    sxy += dx * (y[i] - my);
  }
  if (sxx === 0) return null;
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;

  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (y[i] - (b0 + b1 * x[i])) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const mse = ssRes / (n - 2);
  const se_b1 = Math.sqrt(mse / sxx);
  const t_b1 = se_b1 > 0 ? b1 / se_b1 : 0;

  const absT = Math.abs(t_b1);
  const p_b1 = Math.min(1, 2 * Math.exp(-0.717 * absT - 0.416 * absT * absT));

  return { b0, b1, r2, se_b1, t_b1, p_b1, n, mse };
}

function analyzeMediationAnalysis(rows) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('§6  MEDIATION ANALYSIS: QUESTION FREQUENCY → QUALITY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Baron-Kenny mediation test:');
  console.log('  X = recognition (0=base, 1=recog)');
  console.log('  M = mean questions per tutor turn (mediator)');
  console.log('  Y = tutor first-turn score (outcome)\n');

  // Build per-dialogue data: X (recognition), M (mean q/turn), Y (tutor score)
  const data = [];
  for (const row of rows) {
    const trace = loadTrace(row.dialogue_id);
    if (!trace) continue;
    const tutorTurns = extractTutorTurns(trace);
    if (tutorTurns.length === 0) continue;

    const qTotal = tutorTurns.reduce((sum, t) => sum + countQuestions(t.text), 0);
    const qRate = qTotal / tutorTurns.length;
    const x = isRecog(row.profile_name) ? 1 : 0;
    const y = row.tutor_first_turn_score;
    const model = MODEL_MAP[row.run_id] || 'unknown';

    data.push({ x, m: qRate, y, model, holistic: row.tutor_holistic_overall_score });
  }

  console.log(`Dialogues with trace data: ${data.length}\n`);

  function runMediation(subset, label) {
    const X = subset.map(d => d.x);
    const M = subset.map(d => d.m);
    const Y = subset.map(d => d.y);

    // Step 1 (Path c): Y = c0 + c*X
    const pathC = ols1(Y, X);
    if (!pathC) return;

    // Step 2 (Path a): M = a0 + a*X
    const pathA = ols1(M, X);
    if (!pathA) return;

    // Step 3 (Paths b + c'): Y = b0 + c'*X + b*M
    const pathBC = ols2(Y, X, M);
    if (!pathBC) return;

    const c = pathC.b1;        // total effect
    const cPrime = pathBC.b1;  // direct effect (controlling for M)
    const a = pathA.b1;        // X → M
    const b = pathBC.b2;       // M → Y (controlling for X)
    const indirect = a * b;    // indirect (mediated) effect
    const proportionMediated = c !== 0 ? indirect / c : 0;

    // Sobel test: z = a*b / sqrt(b²*se_a² + a²*se_b²)
    const sobelSE = Math.sqrt(b * b * pathA.se_b1 * pathA.se_b1 + a * a * pathBC.se_b2 * pathBC.se_b2);
    const sobelZ = sobelSE > 0 ? indirect / sobelSE : 0;
    const sobelP = Math.min(1, 2 * Math.exp(-0.717 * Math.abs(sobelZ) - 0.416 * sobelZ * sobelZ));

    console.log(`### ${label} (N=${subset.length})`);
    console.log('');
    console.log('| Path | Coefficient | SE | t | p | Interpretation |');
    console.log('|---|---|---|---|---|---|');
    console.log(`| c (total: X→Y) | ${c.toFixed(2)} | ${pathC.se_b1.toFixed(2)} | ${pathC.t_b1.toFixed(2)} | ${pathC.p_b1 < .001 ? '< .001' : pathC.p_b1.toFixed(3)} | Recognition → quality |`);
    console.log(`| a (X→M) | ${a.toFixed(3)} | ${pathA.se_b1.toFixed(3)} | ${pathA.t_b1.toFixed(2)} | ${pathA.p_b1 < .001 ? '< .001' : pathA.p_b1.toFixed(3)} | Recognition → questions |`);
    console.log(`| b (M→Y\\|X) | ${b.toFixed(2)} | ${pathBC.se_b2.toFixed(2)} | ${pathBC.t_b2.toFixed(2)} | ${pathBC.p_b2 < .001 ? '< .001' : pathBC.p_b2.toFixed(3)} | Questions → quality (controlling for X) |`);
    console.log(`| c' (X→Y\\|M) | ${cPrime.toFixed(2)} | ${pathBC.se_b1.toFixed(2)} | ${pathBC.t_b1.toFixed(2)} | ${pathBC.p_b1 < .001 ? '< .001' : pathBC.p_b1.toFixed(3)} | Direct effect (residual) |`);
    console.log('');
    console.log(`| Metric | Value |`);
    console.log(`|---|---|`);
    console.log(`| Total effect (c) | ${c.toFixed(2)} |`);
    console.log(`| Direct effect (c') | ${cPrime.toFixed(2)} |`);
    console.log(`| Indirect effect (a×b) | ${indirect.toFixed(2)} |`);
    console.log(`| Proportion mediated | ${(proportionMediated * 100).toFixed(1)}% |`);
    console.log(`| R² (total model) | ${pathC.r2.toFixed(3)} |`);
    console.log(`| R² (mediation model) | ${pathBC.r2.toFixed(3)} |`);
    console.log(`| R² increase | +${(pathBC.r2 - pathC.r2).toFixed(3)} |`);
    console.log(`| Sobel z | ${sobelZ.toFixed(2)} |`);
    console.log(`| Sobel p | ${sobelP < .001 ? '< .001' : sobelP.toFixed(3)} |`);
    console.log('');

    const medType = proportionMediated > 0.8 ? 'FULL mediation' :
                    proportionMediated > 0.2 ? 'PARTIAL mediation' : 'NO mediation';
    console.log(`  **${medType}**: Question frequency mediates ${(proportionMediated * 100).toFixed(1)}% of the recognition → quality effect.`);
    if (sobelP < .05) {
      console.log(`  Sobel test significant (z=${sobelZ.toFixed(2)}, p${sobelP < .001 ? '<.001' : '=' + sobelP.toFixed(3)}): indirect path is reliable.`);
    } else {
      console.log(`  Sobel test NOT significant (z=${sobelZ.toFixed(2)}, p=${sobelP.toFixed(3)}): indirect path not reliably different from zero.`);
    }
    console.log('');

    return { c, cPrime, a, b, indirect, proportionMediated, sobelZ, sobelP, n: subset.length };
  }

  // Overall
  const overall = runMediation(data, 'Pooled (all 3 models)');

  // By model
  const byModel = {};
  for (const model of ['DeepSeek V3.2', 'Haiku 4.5', 'Gemini Flash']) {
    const subset = data.filter(d => d.model === model);
    if (subset.length >= 20) {
      byModel[model] = runMediation(subset, model);
    }
  }

  // Also test with holistic score as outcome
  console.log('\n---\n### Robustness: Holistic Overall Score as Outcome\n');
  const dataH = data.filter(d => d.holistic != null);
  if (dataH.length > 20) {
    const XH = dataH.map(d => d.x);
    const MH = dataH.map(d => d.m);
    const YH = dataH.map(d => d.holistic);

    const pathC = ols1(YH, XH);
    const pathA = ols1(MH, XH);
    const pathBC = ols2(YH, XH, MH);

    if (pathC && pathA && pathBC) {
      const c = pathC.b1, cPrime = pathBC.b1, a = pathA.b1, b = pathBC.b2;
      const indirect = a * b;
      const propMed = c !== 0 ? indirect / c : 0;
      const sobelSE = Math.sqrt(b * b * pathA.se_b1 ** 2 + a * a * pathBC.se_b2 ** 2);
      const sobelZ = sobelSE > 0 ? indirect / sobelSE : 0;
      const sobelP = Math.min(1, 2 * Math.exp(-0.717 * Math.abs(sobelZ) - 0.416 * sobelZ * sobelZ));

      console.log(`Holistic score mediation (N=${dataH.length}):`);
      console.log(`  Total effect (c): ${c.toFixed(2)}, Direct (c'): ${cPrime.toFixed(2)}, Indirect (a×b): ${indirect.toFixed(2)}`);
      console.log(`  Proportion mediated: ${(propMed * 100).toFixed(1)}%`);
      console.log(`  Sobel: z=${sobelZ.toFixed(2)}, p${sobelP < .001 ? '<.001' : '=' + sobelP.toFixed(3)}`);
    }
  }

  return { overall, byModel };
}

// ── Main ────────────────────────────────────────────────────────────────

const db = getDb();
const rows = getEpoch2Rows(db);
console.log(`Loaded ${rows.length} epoch 2.0 rows (Sonnet judge, 3 runs)`);

const results = {};

if (section === 'all' || section === '1') {
  results.questionFrequency = analyzeQuestionFrequency(rows);
}
if (section === 'all' || section === '2') {
  results.vocabularyDivergence = analyzeVocabularyDivergence(rows);
}
if (section === 'all' || section === '3') {
  results.ceilingRegression = analyzeCeilingRegression(rows);
}
if (section === 'all' || section === '4') {
  results.geminiFlashScenarios = analyzeGeminiFlashScenarios(rows);
}
if (section === 'all' || section === '5') {
  results.questionTrajectory = analyzeQuestionTrajectory(rows);
}
if (section === 'all' || section === '6') {
  results.mediationAnalysis = analyzeMediationAnalysis(rows);
}

db.close();

if (jsonOutput) {
  const outPath = path.resolve(__dirname, '..', 'exports', 'text-behaviors.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nJSON output: ${outPath}`);
}
