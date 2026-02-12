#!/usr/bin/env node

/**
 * Dialectical Modulation Coding Script
 *
 * Extracts structural and LLM-coded modulation metrics from multi-turn
 * dialectical superego dialogues. Compares across conditions (base vs
 * recognition) × persona type (suspicious, adversary, advocate).
 *
 * Tier 1 (structural): Parsed directly from dialogueTrace JSON — no LLM calls.
 * Tier 2 (LLM-coded): 4 semantic prompts per dialogue for stance reversal,
 *   cross-turn memory, hallucination correction, phase transition detection.
 *
 * Usage:
 *   node scripts/code-dialectical-modulation.js [options]
 *
 * Options:
 *   --run-id <id>       Run ID (default: eval-2026-02-11-a54235ea)
 *   --model <model>     Model for LLM coding (default: claude-code)
 *   --structural-only   Skip LLM coding, emit only structural metrics
 *   --help              Show help
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_RUN_ID = 'eval-2026-02-11-a54235ea';

const MODEL_MAP = {
  'claude-code': 'claude-code',
  haiku: 'anthropic/claude-haiku-4.5',
  sonnet: 'anthropic/claude-sonnet-4.5',
  gpt: 'openai/gpt-5.2',
};

// ── Statistical Helpers ──────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function cohensD(group1, group2) {
  if (!group1.length || !group2.length) return 0;
  const m1 = mean(group1), m2 = mean(group2);
  const s1 = std(group1), s2 = std(group2);
  const pooled = Math.sqrt(
    ((group1.length - 1) * s1 ** 2 + (group2.length - 1) * s2 ** 2)
    / (group1.length + group2.length - 2)
  );
  return pooled > 0 ? (m1 - m2) / pooled : 0;
}

function welchTTest(group1, group2) {
  if (group1.length < 2 || group2.length < 2) return { t: 0, df: 0, p: 1 };
  const m1 = mean(group1), m2 = mean(group2);
  const v1 = std(group1) ** 2, v2 = std(group2) ** 2;
  const n1 = group1.length, n2 = group2.length;
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) return { t: 0, df: n1 + n2 - 2, p: 1 };
  const t = (m1 - m2) / se;
  const num = (v1 / n1 + v2 / n2) ** 2;
  const den = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = den > 0 ? num / den : n1 + n2 - 2;
  const p = tTestPValue(Math.abs(t), df);
  return { t, df, p };
}

function tTestPValue(t, df) {
  // Approximate two-tailed p-value using normal approximation for large df
  if (df <= 0) return 1;
  if (df > 30) {
    return 2 * (1 - normalCDF(Math.abs(t)));
  }
  // For small df, use a rough beta-function based approximation
  const x = df / (df + t * t);
  return regularizedBeta(x, df / 2, 0.5);
}

function regularizedBeta(x, a, b) {
  // Simple continued-fraction approximation for the regularized incomplete beta
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);
  // Lentz's continued fraction
  let f = 1, c = 1, d = 1 - (a + 1) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;
  for (let m = 1; m <= 200; m++) {
    let numerator;
    if (m % 2 === 0) {
      const k = m / 2;
      numerator = k * (b - k) * x / ((a + 2 * k - 1) * (a + 2 * k));
    } else {
      const k = (m - 1) / 2;
      numerator = -(a + k) * (a + b + k) * x / ((a + 2 * k) * (a + 2 * k + 1));
    }
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < 1e-8) break;
  }
  return front * f / a;
}

function lnGamma(z) {
  // Stirling's approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

function chiSquareTest(observed) {
  const nRows = observed.length;
  const nCols = observed[0].length;
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = [];
  for (let j = 0; j < nCols; j++) {
    colTotals.push(observed.reduce((sum, row) => sum + row[j], 0));
  }
  const grand = rowTotals.reduce((a, b) => a + b, 0);
  if (grand === 0) return { chi2: 0, df: 0, p: 1, cramersV: 0 };

  let chi2 = 0;
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grand;
      if (expected > 0) {
        chi2 += (observed[i][j] - expected) ** 2 / expected;
      }
    }
  }
  const df = (nRows - 1) * (nCols - 1);
  const k = Math.min(nRows, nCols);
  const cramersV = grand > 0 && k > 1 ? Math.sqrt(chi2 / (grand * (k - 1))) : 0;
  const p = chi2PValue(chi2, df);
  return { chi2, df, p, cramersV };
}

function chi2PValue(x, df) {
  if (df <= 0 || x <= 0) return 1;
  if (df > 2) {
    const cube = 1 - 2 / (9 * df);
    const stdNorm = (Math.pow(x / df, 1 / 3) - cube) / Math.sqrt(2 / (9 * df));
    return 1 - normalCDF(stdNorm);
  }
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(x)));
  if (df === 2) return Math.exp(-x / 2);
  return 1;
}

function pearsonR(xs, ys) {
  if (xs.length < 3) return { r: 0, p: 1 };
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return { r: 0, p: 1 };
  const r = num / denom;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const p = tTestPValue(Math.abs(t), n - 2);
  return { r, p };
}

// ── Model Calls ──────────────────────────────────────────────────────────

async function callModel(prompt, modelKey) {
  if (modelKey === 'claude-code') return callClaudeCode(prompt);
  return callOpenRouter(prompt, modelKey);
}

async function callClaudeCode(prompt) {
  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn('claude', ['-p', '-', '--output-format', 'text'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => reject(new Error(`Failed to spawn claude: ${e.message}`)));
    child.on('close', code => {
      if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
  return stdout.trim();
}

async function callOpenRouter(prompt, modelKey) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const model = MODEL_MAP[modelKey];
  if (!model) throw new Error(`Unknown model: ${modelKey}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        include_reasoning: false,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in response');
    return content;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    throw new Error(`Failed to parse JSON: ${content.slice(0, 300)}`);
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────

function loadRows(db, runId) {
  return db.prepare(`
    SELECT id, dialogue_id, scenario_id, profile_name, overall_score,
           dialogue_rounds, suggestions
    FROM evaluation_results
    WHERE run_id = ? AND success = 1 AND dialogue_id IS NOT NULL
    ORDER BY profile_name, id
  `).all(runId);
}

function parseCondition(profileName) {
  const isRecognition = profileName.includes('recog');
  let persona = 'unknown';
  if (profileName.includes('suspicious')) persona = 'suspicious';
  else if (profileName.includes('adversary')) persona = 'adversary';
  else if (profileName.includes('advocate')) persona = 'advocate';
  return {
    condition: isRecognition ? 'recognition' : 'base',
    persona,
  };
}

function loadDialogueLog(dialogueId) {
  const logPath = path.join(process.cwd(), 'logs', 'tutor-dialogues', `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) return null;
  return JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

// ── Tier 1: Structural Metrics ───────────────────────────────────────────

/**
 * Segments dialogueTrace into external turns, delimited by final_output entries.
 * Each turn contains the ego-superego negotiation entries plus the learner action.
 */
function segmentTraceByTurn(dialogueTrace) {
  const turns = [];
  let currentEntries = [];

  for (const entry of dialogueTrace) {
    if (entry.action === 'final_output') {
      turns.push({
        turnIndex: entry.turnIndex != null ? entry.turnIndex : turns.length,
        entries: currentEntries,
        finalOutput: entry,
      });
      currentEntries = [];
    } else {
      currentEntries.push(entry);
    }
  }

  // If no final_output markers found, treat the entire trace as a single turn
  if (turns.length === 0 && currentEntries.length > 0) {
    turns.push({
      turnIndex: 0,
      entries: currentEntries,
      finalOutput: null,
    });
  }

  // Enrich each turn with parsed sub-components
  return turns.map(turn => {
    const superegoEntries = turn.entries.filter(e => e.agent === 'superego');
    const egoEntries = turn.entries.filter(e => e.agent === 'ego');
    const learnerAction = turn.entries.find(e => e.action === 'turn_action');
    const contextInput = turn.entries.find(e => e.action === 'context_input');

    return {
      turnIndex: turn.turnIndex,
      superegoEntries,
      egoEntries,
      learnerAction,
      contextInput,
      allEntries: turn.entries,
      finalOutput: turn.finalOutput,
    };
  });
}

function extractStructuralMetrics(dialogueLog, turns) {
  const metrics = {
    totalTurns: turns.length,
    perTurn: [],
    aggregate: {},
  };

  // Per-turn metrics
  for (const turn of turns) {
    const rejections = turn.superegoEntries.filter(e => e.approved === false);
    const approvals = turn.superegoEntries.filter(e => e.approved === true);
    const confidences = turn.superegoEntries
      .map(e => e.confidence)
      .filter(c => c != null);

    // Intervention type distribution for this turn
    const interventionTypes = {};
    for (const se of turn.superegoEntries) {
      const it = se.interventionType || 'unknown';
      interventionTypes[it] = (interventionTypes[it] || 0) + 1;
    }

    // Rounds to convergence: number of ego-superego exchanges before final_output
    const roundsToConverge = turn.superegoEntries.length;

    // Ego suggestion changes: track actionType/actionTarget shifts across revisions
    const egoSuggestionTypes = turn.egoEntries
      .filter(e => e.suggestions && e.suggestions[0])
      .map(e => ({
        actionType: e.suggestions[0].actionType,
        actionTarget: e.suggestions[0].actionTarget,
        type: e.suggestions[0].type,
      }));

    const typeShifts = countShifts(egoSuggestionTypes.map(s => `${s.actionType}:${s.actionTarget}`));

    // Learner action for this turn
    const learnerDetail = turn.learnerAction?.detail || null;

    metrics.perTurn.push({
      turnIndex: turn.turnIndex,
      negationDepth: rejections.length,
      approvalCount: approvals.length,
      roundsToConverge,
      confidences,
      meanConfidence: confidences.length > 0 ? mean(confidences) : null,
      interventionTypes,
      suggestionTypeShifts: typeShifts,
      learnerAction: learnerDetail,
      superegoFeedbackLengths: turn.superegoEntries
        .map(e => (e.feedback || '').length)
        .filter(l => l > 0),
    });
  }

  // Aggregate metrics across all turns
  const allNegationDepths = metrics.perTurn.map(t => t.negationDepth);
  const allRoundsToConverge = metrics.perTurn.map(t => t.roundsToConverge);
  const allConfidences = metrics.perTurn.flatMap(t => t.confidences);
  const allFeedbackLengths = metrics.perTurn.flatMap(t => t.superegoFeedbackLengths);

  // Confidence trajectory: first turn vs last turn
  const firstTurnConf = metrics.perTurn[0]?.meanConfidence;
  const lastTurnConf = metrics.perTurn.length > 1
    ? metrics.perTurn[metrics.perTurn.length - 1]?.meanConfidence
    : null;

  // Intervention type distribution across all turns
  const totalInterventions = {};
  for (const pt of metrics.perTurn) {
    for (const [type, count] of Object.entries(pt.interventionTypes)) {
      totalInterventions[type] = (totalInterventions[type] || 0) + count;
    }
  }

  // Learner action trajectory
  const learnerActions = metrics.perTurn
    .map(t => t.learnerAction)
    .filter(Boolean);

  // Convergence speed trajectory (does negotiation get faster?)
  const convergenceTrajectory = allRoundsToConverge.length > 1
    ? allRoundsToConverge[allRoundsToConverge.length - 1] - allRoundsToConverge[0]
    : 0;

  metrics.aggregate = {
    meanNegationDepth: mean(allNegationDepths),
    totalNegations: allNegationDepths.reduce((a, b) => a + b, 0),
    meanRoundsToConverge: mean(allRoundsToConverge),
    sdRoundsToConverge: std(allRoundsToConverge),
    convergenceTrajectory,
    meanConfidence: allConfidences.length > 0 ? mean(allConfidences) : null,
    confidenceTrajectory: firstTurnConf != null && lastTurnConf != null
      ? lastTurnConf - firstTurnConf
      : null,
    totalInterventions,
    meanFeedbackLength: allFeedbackLengths.length > 0 ? mean(allFeedbackLengths) : 0,
    learnerActionSequence: learnerActions,
  };

  // Incorporation rate from transformationAnalysis if available
  const ta = dialogueLog.transformationAnalysis;
  if (ta?.markerAnalysis) {
    metrics.aggregate.incorporationRate = ta.markerAnalysis;
  }

  return metrics;
}

function countShifts(sequence) {
  let shifts = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i - 1]) shifts++;
  }
  return shifts;
}

// ── Tier 2: LLM-Coded Metrics ───────────────────────────────────────────

function buildStanceReversalPrompt(turns) {
  // Compare consecutive pairs of superego feedback
  const pairs = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const feedbackA = turns[i].superegoEntries
      .map(e => e.feedback)
      .filter(Boolean)
      .join('\n');
    const feedbackB = turns[i + 1].superegoEntries
      .map(e => e.feedback)
      .filter(Boolean)
      .join('\n');
    if (feedbackA && feedbackB) {
      pairs.push({
        turnA: turns[i].turnIndex,
        turnB: turns[i + 1].turnIndex,
        feedbackA: feedbackA.slice(0, 600),
        feedbackB: feedbackB.slice(0, 600),
      });
    }
  }

  if (pairs.length === 0) return null;

  const pairsText = pairs.map((p, i) =>
    `### Pair ${i + 1} (Turn ${p.turnA} → Turn ${p.turnB})\n**Turn ${p.turnA} superego feedback:**\n${p.feedbackA}\n\n**Turn ${p.turnB} superego feedback:**\n${p.feedbackB}`
  ).join('\n\n');

  return `You are analyzing ego-superego dialogue traces from an AI tutoring system. The superego reviews and critiques the ego's suggestions across multiple turns of a tutoring conversation.

## Task: Detect Stance Reversals

For each consecutive pair of superego feedback, determine whether the superego's evaluative stance REVERSED between turns — that is, whether it contradicted or substantially changed its position on what matters in the tutor's response.

A stance reversal is NOT just giving different feedback about different content. It means the superego's priorities, values, or evaluative criteria shifted (e.g., first prioritizing emotional validation, then deprioritizing it; first rejecting a pedagogical approach, then endorsing a similar one).

${pairsText}

## Output Format

Return a JSON object:
{
  "pairs": [
    {
      "turnA": <number>,
      "turnB": <number>,
      "reversed": true|false,
      "directionA": "brief description of superego's stance in turn A (max 15 words)",
      "directionB": "brief description of superego's stance in turn B (max 15 words)",
      "reversal_type": "priority_shift|criteria_change|contradiction|none"
    }
  ],
  "total_reversals": <number>
}

Return ONLY the JSON object.`;
}

function buildCrossTurnMemoryPrompt(turns) {
  const turnData = [];
  for (let i = 0; i < turns.length; i++) {
    const feedback = turns[i].superegoEntries
      .map(e => e.feedback)
      .filter(Boolean)
      .join('\n');
    const priorTurnSummaries = turns.slice(0, i)
      .map(t => {
        const fb = t.superegoEntries
          .map(e => e.feedback)
          .filter(Boolean)
          .join('; ')
          .slice(0, 200);
        return `Turn ${t.turnIndex}: ${fb || '(no feedback)'}`;
      });

    if (feedback && priorTurnSummaries.length > 0) {
      turnData.push({
        turnIndex: turns[i].turnIndex,
        feedback: feedback.slice(0, 600),
        priorSummaries: priorTurnSummaries,
      });
    }
  }

  if (turnData.length === 0) return null;

  const turnText = turnData.map(t =>
    `### Turn ${t.turnIndex}\n**Prior turns:**\n${t.priorSummaries.join('\n')}\n\n**Current superego feedback:**\n${t.feedback}`
  ).join('\n\n');

  return `You are analyzing ego-superego dialogue traces from an AI tutoring system. The superego reviews the ego's suggestions across multiple external turns.

## Task: Detect Cross-Turn Memory References

For each turn's superego feedback, determine whether it explicitly or implicitly references feedback, decisions, or content from prior turns. This measures whether the superego maintains coherent memory across the dialogue.

Types of references:
- **explicit_reference**: Directly mentions a prior turn's decision or content
- **implicit_callback**: Uses phrasing or criteria that echo prior feedback
- **escalation**: Builds on prior criticism (e.g., "still not addressing...")
- **reversal_acknowledgment**: Notes a change from prior approach

${turnText}

## Output Format

Return a JSON object:
{
  "turns": [
    {
      "turnIndex": <number>,
      "references_prior": true|false,
      "reference_types": ["explicit_reference"|"implicit_callback"|"escalation"|"reversal_acknowledgment"],
      "evidence": "brief quote or description (max 20 words)"
    }
  ],
  "total_references": <number>,
  "memory_rate": <0-1 fraction of turns with cross-turn references>
}

Return ONLY the JSON object.`;
}

function buildHallucinationCorrectionPrompt(turns) {
  const rejections = [];
  for (const turn of turns) {
    const ctx = turn.contextInput?.rawContext?.slice(0, 400) || '(no context)';
    for (const se of turn.superegoEntries) {
      if (se.approved === false && se.feedback) {
        // Get the ego suggestion that was rejected
        const egoIdx = turn.allEntries.indexOf(se) - 1;
        const egoEntry = egoIdx >= 0 ? turn.allEntries[egoIdx] : null;
        const egoMessage = egoEntry?.suggestions?.[0]?.message?.slice(0, 400) || '(no suggestion)';

        rejections.push({
          turnIndex: turn.turnIndex,
          round: se.round,
          egoSuggestion: egoMessage,
          superegoFeedback: se.feedback.slice(0, 400),
          context: ctx,
        });
      }
    }
  }

  if (rejections.length === 0) return null;

  // Limit to first 6 rejections to keep prompt manageable
  const subset = rejections.slice(0, 6);

  const rejectText = subset.map((r, i) =>
    `### Rejection ${i + 1} (Turn ${r.turnIndex}, Round ${r.round})\n**Context:** ${r.context}\n**Ego suggestion:** ${r.egoSuggestion}\n**Superego rejection:** ${r.superegoFeedback}`
  ).join('\n\n');

  return `You are analyzing ego-superego dialogue traces from an AI tutoring system. The superego sometimes rejects the ego's suggestions.

## Task: Detect Hallucination Corrections

For each rejection, determine whether the superego is correcting a "hallucination" — a case where the ego fabricated, misrepresented, or ignored factual information from the learner context. Types of hallucination:
- **context_fabrication**: Ego claims learner said/did something not in the context
- **context_omission**: Ego ignores explicit learner signals present in context
- **metric_misuse**: Ego references metrics (struggle signals, sessions) inaccurately
- **repetition_blindness**: Ego repeats a suggestion that already failed in a prior turn

Not all rejections are hallucination corrections — the superego may reject for tone, pedagogy, or framing reasons without detecting hallucination. Code only genuine factual corrections.

${rejectText}

## Output Format

Return a JSON object:
{
  "rejections": [
    {
      "turnIndex": <number>,
      "round": <number>,
      "hallucination_detected": true|false,
      "types": ["context_fabrication"|"context_omission"|"metric_misuse"|"repetition_blindness"],
      "description": "brief description (max 20 words)"
    }
  ],
  "total_hallucinations": <number>,
  "hallucination_rate": <0-1 fraction of rejections containing hallucination>
}

Return ONLY the JSON object.`;
}

function buildPhaseTransitionPrompt(turns) {
  // Build the learner message sequence + superego response characterization
  const sequence = [];
  for (const turn of turns) {
    const learnerMsg = turn.learnerAction?.contextSummary
      || turn.contextInput?.rawContext?.slice(0, 200)
      || '(initial turn)';
    const superegoStance = turn.superegoEntries
      .filter(e => e.feedback)
      .map(e => e.feedback.slice(0, 200))
      .join(' | ');
    const learnerDetail = turn.learnerAction?.detail || 'initial';

    sequence.push({
      turnIndex: turn.turnIndex,
      learnerMessage: typeof learnerMsg === 'string' ? learnerMsg.slice(0, 300) : '(no message)',
      learnerAction: learnerDetail,
      superegoStance: superegoStance.slice(0, 400) || '(no superego feedback)',
    });
  }

  if (sequence.length < 2) return null;

  const seqText = sequence.map(s =>
    `### Turn ${s.turnIndex}\n**Learner** [${s.learnerAction}]: ${s.learnerMessage}\n**Superego stance:** ${s.superegoStance}`
  ).join('\n\n');

  return `You are analyzing multi-turn ego-superego tutoring dialogues. The learner interacts with a tutor over multiple turns, and the superego reviews each of the tutor's responses.

## Task: Detect Phase Transitions

A phase transition occurs when the dialogue qualitatively shifts — the learner's engagement mode changes, the superego's evaluative priorities pivot, or the ego-superego dynamic fundamentally reorganizes. Types:
- **learner_mode_shift**: Learner moves from confusion to engagement, resistance to curiosity, etc.
- **superego_priority_pivot**: Superego shifts primary concern (e.g., from tone to content accuracy)
- **negotiation_pattern_change**: Ego-superego dynamic changes (e.g., from adversarial to cooperative)
- **pedagogical_escalation**: Tutor approach fundamentally changes strategy (review → practice, explain → scaffold)

## Dialogue Sequence

${seqText}

## Output Format

Return a JSON object:
{
  "transitions": [
    {
      "between_turns": [<turnA>, <turnB>],
      "shift_type": "learner_mode_shift|superego_priority_pivot|negotiation_pattern_change|pedagogical_escalation",
      "description": "brief description (max 20 words)",
      "superego_adapts": true|false
    }
  ],
  "total_transitions": <number>,
  "transition_density": <transitions per inter-turn gap>
}

Return ONLY the JSON object.`;
}

async function extractLLMCodedMetrics(turns, modelKey) {
  const llmMetrics = {
    stanceReversal: null,
    crossTurnMemory: null,
    hallucinationCorrection: null,
    phaseTransition: null,
    errors: [],
  };

  const prompts = [
    { key: 'stanceReversal', builder: buildStanceReversalPrompt },
    { key: 'crossTurnMemory', builder: buildCrossTurnMemoryPrompt },
    { key: 'hallucinationCorrection', builder: buildHallucinationCorrectionPrompt },
    { key: 'phaseTransition', builder: buildPhaseTransitionPrompt },
  ];

  for (const { key, builder } of prompts) {
    const prompt = builder(turns);
    if (!prompt) {
      llmMetrics[key] = { skipped: true, reason: 'insufficient data' };
      continue;
    }

    try {
      const content = await callModel(prompt, modelKey);
      llmMetrics[key] = parseJsonResponse(content);
    } catch (err) {
      llmMetrics.errors.push({ metric: key, error: err.message });
      llmMetrics[key] = { error: err.message };
    }
  }

  return llmMetrics;
}

// ── Profile Assembly ─────────────────────────────────────────────────────

function buildModulationProfile(row, dialogueLog, structural, llmCoded) {
  const { condition, persona } = parseCondition(row.profile_name);
  return {
    id: row.id,
    dialogueId: row.dialogue_id,
    scenarioId: row.scenario_id,
    profileName: row.profile_name,
    condition,
    persona,
    overallScore: row.overall_score,
    dialogueRounds: row.dialogue_rounds,
    structural,
    llmCoded: llmCoded || null,
  };
}

// ── Aggregate Analysis ───────────────────────────────────────────────────

function analyzeAggregateResults(profiles) {
  const analysis = {
    n: profiles.length,
    byCondition: { base: [], recognition: [] },
    byPersona: {},
    byCell: {},
    structural: {},
    llmCoded: {},
    correlations: {},
  };

  // Group profiles
  for (const p of profiles) {
    analysis.byCondition[p.condition].push(p);
    if (!analysis.byPersona[p.persona]) analysis.byPersona[p.persona] = [];
    analysis.byPersona[p.persona].push(p);
    const cellKey = `${p.condition}_${p.persona}`;
    if (!analysis.byCell[cellKey]) analysis.byCell[cellKey] = [];
    analysis.byCell[cellKey].push(p);
  }

  // ── Structural Metric Comparisons ──────────────────────────────────

  const structuralMetrics = [
    { key: 'meanNegationDepth', label: 'Mean Negation Depth', extract: p => p.structural.aggregate.meanNegationDepth },
    { key: 'totalNegations', label: 'Total Negations', extract: p => p.structural.aggregate.totalNegations },
    { key: 'meanRoundsToConverge', label: 'Mean Rounds to Converge', extract: p => p.structural.aggregate.meanRoundsToConverge },
    { key: 'convergenceTrajectory', label: 'Convergence Trajectory', extract: p => p.structural.aggregate.convergenceTrajectory },
    { key: 'meanConfidence', label: 'Mean Superego Confidence', extract: p => p.structural.aggregate.meanConfidence },
    { key: 'confidenceTrajectory', label: 'Confidence Trajectory', extract: p => p.structural.aggregate.confidenceTrajectory },
    { key: 'meanFeedbackLength', label: 'Mean Feedback Length', extract: p => p.structural.aggregate.meanFeedbackLength },
  ];

  for (const metric of structuralMetrics) {
    const baseVals = analysis.byCondition.base.map(metric.extract).filter(v => v != null);
    const recogVals = analysis.byCondition.recognition.map(metric.extract).filter(v => v != null);

    analysis.structural[metric.key] = {
      label: metric.label,
      base: { n: baseVals.length, mean: mean(baseVals), sd: std(baseVals) },
      recognition: { n: recogVals.length, mean: mean(recogVals), sd: std(recogVals) },
      d: cohensD(recogVals, baseVals),
      welch: welchTTest(recogVals, baseVals),
    };

    // Per-persona breakdown
    const byPersona = {};
    for (const [persona, pProfiles] of Object.entries(analysis.byPersona)) {
      const baseP = pProfiles.filter(p => p.condition === 'base').map(metric.extract).filter(v => v != null);
      const recogP = pProfiles.filter(p => p.condition === 'recognition').map(metric.extract).filter(v => v != null);
      byPersona[persona] = {
        base: { n: baseP.length, mean: mean(baseP), sd: std(baseP) },
        recognition: { n: recogP.length, mean: mean(recogP), sd: std(recogP) },
        d: cohensD(recogP, baseP),
      };
    }
    analysis.structural[metric.key].byPersona = byPersona;
  }

  // ── Intervention Type Distribution (Categorical) ────────────────────

  const interventionCounts = { base: {}, recognition: {} };
  for (const p of profiles) {
    const itd = p.structural.aggregate.totalInterventions;
    for (const [type, count] of Object.entries(itd)) {
      interventionCounts[p.condition][type] = (interventionCounts[p.condition][type] || 0) + count;
    }
  }
  analysis.structural.interventionDistribution = interventionCounts;

  // Chi-square on intervention types
  const allIntTypes = [...new Set([
    ...Object.keys(interventionCounts.base),
    ...Object.keys(interventionCounts.recognition),
  ])];
  if (allIntTypes.length > 1) {
    const observed = allIntTypes.map(t => [
      interventionCounts.base[t] || 0,
      interventionCounts.recognition[t] || 0,
    ]);
    analysis.structural.interventionChiSquare = {
      ...chiSquareTest(observed),
      types: allIntTypes,
    };
  }

  // ── Learner Action Trajectory (Categorical) ─────────────────────────

  const learnerActionCounts = { base: {}, recognition: {} };
  for (const p of profiles) {
    for (const action of p.structural.aggregate.learnerActionSequence) {
      const normalized = action.replace(/^Learner:\s*/, '');
      learnerActionCounts[p.condition][normalized] =
        (learnerActionCounts[p.condition][normalized] || 0) + 1;
    }
  }
  analysis.structural.learnerActionDistribution = learnerActionCounts;

  // ── LLM-Coded Metric Aggregations ──────────────────────────────────

  if (profiles[0]?.llmCoded && !profiles[0].llmCoded.stanceReversal?.skipped) {
    // Stance reversals
    const baseReversals = analysis.byCondition.base
      .map(p => p.llmCoded?.stanceReversal?.total_reversals)
      .filter(v => v != null);
    const recogReversals = analysis.byCondition.recognition
      .map(p => p.llmCoded?.stanceReversal?.total_reversals)
      .filter(v => v != null);
    analysis.llmCoded.stanceReversal = {
      base: { n: baseReversals.length, mean: mean(baseReversals), sd: std(baseReversals) },
      recognition: { n: recogReversals.length, mean: mean(recogReversals), sd: std(recogReversals) },
      d: cohensD(recogReversals, baseReversals),
      welch: welchTTest(recogReversals, baseReversals),
    };

    // Cross-turn memory
    const baseMemory = analysis.byCondition.base
      .map(p => p.llmCoded?.crossTurnMemory?.memory_rate)
      .filter(v => v != null);
    const recogMemory = analysis.byCondition.recognition
      .map(p => p.llmCoded?.crossTurnMemory?.memory_rate)
      .filter(v => v != null);
    analysis.llmCoded.crossTurnMemory = {
      base: { n: baseMemory.length, mean: mean(baseMemory), sd: std(baseMemory) },
      recognition: { n: recogMemory.length, mean: mean(recogMemory), sd: std(recogMemory) },
      d: cohensD(recogMemory, baseMemory),
      welch: welchTTest(recogMemory, baseMemory),
    };

    // Hallucination rate
    const baseHalluc = analysis.byCondition.base
      .map(p => p.llmCoded?.hallucinationCorrection?.hallucination_rate)
      .filter(v => v != null);
    const recogHalluc = analysis.byCondition.recognition
      .map(p => p.llmCoded?.hallucinationCorrection?.hallucination_rate)
      .filter(v => v != null);
    analysis.llmCoded.hallucinationCorrection = {
      base: { n: baseHalluc.length, mean: mean(baseHalluc), sd: std(baseHalluc) },
      recognition: { n: recogHalluc.length, mean: mean(recogHalluc), sd: std(recogHalluc) },
      d: cohensD(recogHalluc, baseHalluc),
      welch: welchTTest(recogHalluc, baseHalluc),
    };

    // Phase transitions
    const basePhase = analysis.byCondition.base
      .map(p => p.llmCoded?.phaseTransition?.transition_density)
      .filter(v => v != null);
    const recogPhase = analysis.byCondition.recognition
      .map(p => p.llmCoded?.phaseTransition?.transition_density)
      .filter(v => v != null);
    analysis.llmCoded.phaseTransition = {
      base: { n: basePhase.length, mean: mean(basePhase), sd: std(basePhase) },
      recognition: { n: recogPhase.length, mean: mean(recogPhase), sd: std(recogPhase) },
      d: cohensD(recogPhase, basePhase),
      welch: welchTTest(recogPhase, basePhase),
    };
  }

  // ── Correlations: modulation metrics vs overall_score ──────────────

  const scores = profiles.map(p => p.overallScore).filter(v => v != null);
  const negDepths = profiles.map(p => p.structural.aggregate.meanNegationDepth);
  const convergeSpeeds = profiles.map(p => p.structural.aggregate.meanRoundsToConverge);
  const feedbackLens = profiles.map(p => p.structural.aggregate.meanFeedbackLength);

  if (scores.length >= 5) {
    analysis.correlations.negationDepth_score = pearsonR(
      profiles.filter(p => p.overallScore != null).map(p => p.structural.aggregate.meanNegationDepth),
      profiles.filter(p => p.overallScore != null).map(p => p.overallScore)
    );
    analysis.correlations.convergenceSpeed_score = pearsonR(
      profiles.filter(p => p.overallScore != null).map(p => p.structural.aggregate.meanRoundsToConverge),
      profiles.filter(p => p.overallScore != null).map(p => p.overallScore)
    );
    analysis.correlations.feedbackLength_score = pearsonR(
      profiles.filter(p => p.overallScore != null).map(p => p.structural.aggregate.meanFeedbackLength),
      profiles.filter(p => p.overallScore != null).map(p => p.overallScore)
    );
  }

  return analysis;
}

// ── Report Generation ────────────────────────────────────────────────────

function generateReport(profiles, analysis, opts) {
  const timestamp = new Date().toISOString();
  const baseN = analysis.byCondition.base.length;
  const recogN = analysis.byCondition.recognition.length;

  let md = `# Dialectical Modulation Coding Analysis

**Generated:** ${timestamp}
**Run ID:** ${opts.runId}
**N:** ${analysis.n} dialogues (base=${baseN}, recognition=${recogN})
**Personas:** ${Object.keys(analysis.byPersona).join(', ')}
**Scenarios:** ${[...new Set(profiles.map(p => p.scenarioId))].join(', ')}
**Model:** ${opts.model}
**Mode:** ${opts.structuralOnly ? 'structural only' : 'full (structural + LLM-coded)'}

## 1. Structural Metrics (Tier 1)

### 1.1 Condition Comparison: Base vs Recognition

| Metric | Base (N=${baseN}) | Recog (N=${recogN}) | Cohen's d | Welch t | p |
|--------|-----------|-------------|-----------|---------|---|
`;

  for (const [key, data] of Object.entries(analysis.structural)) {
    if (key === 'interventionDistribution' || key === 'interventionChiSquare' || key === 'learnerActionDistribution') continue;
    const bStr = `${data.base.mean.toFixed(2)} (${data.base.sd.toFixed(2)})`;
    const rStr = `${data.recognition.mean.toFixed(2)} (${data.recognition.sd.toFixed(2)})`;
    const pStr = data.welch.p < 0.001 ? '<.001' : data.welch.p.toFixed(3);
    md += `| ${data.label} | ${bStr} | ${rStr} | ${data.d.toFixed(2)} | ${data.welch.t.toFixed(2)} | ${pStr} |\n`;
  }

  // Per-persona breakdown
  md += `\n### 1.2 Per-Persona Breakdown\n`;
  for (const [persona, pProfiles] of Object.entries(analysis.byPersona)) {
    const pBase = pProfiles.filter(p => p.condition === 'base').length;
    const pRecog = pProfiles.filter(p => p.condition === 'recognition').length;
    md += `\n#### ${persona} (base=${pBase}, recog=${pRecog})\n\n`;
    md += `| Metric | Base | Recog | d |\n|--------|------|-------|---|\n`;

    for (const [key, data] of Object.entries(analysis.structural)) {
      if (!data.byPersona || !data.byPersona[persona]) continue;
      const bp = data.byPersona[persona];
      md += `| ${data.label} | ${bp.base.mean.toFixed(2)} | ${bp.recognition.mean.toFixed(2)} | ${bp.d.toFixed(2)} |\n`;
    }
  }

  // Intervention distribution
  md += `\n### 1.3 Intervention Type Distribution\n\n`;
  md += `| Type | Base | Recognition |\n|------|------|-------------|\n`;
  const allTypes = [...new Set([
    ...Object.keys(analysis.structural.interventionDistribution?.base || {}),
    ...Object.keys(analysis.structural.interventionDistribution?.recognition || {}),
  ])];
  for (const type of allTypes) {
    const b = analysis.structural.interventionDistribution?.base?.[type] || 0;
    const r = analysis.structural.interventionDistribution?.recognition?.[type] || 0;
    md += `| ${type} | ${b} | ${r} |\n`;
  }
  if (analysis.structural.interventionChiSquare) {
    const cs = analysis.structural.interventionChiSquare;
    const pStr = cs.p < 0.001 ? 'p < .001' : `p = ${cs.p.toFixed(3)}`;
    md += `\n**Chi-square:** χ²(${cs.df}) = ${cs.chi2.toFixed(2)}, ${pStr}, V = ${cs.cramersV.toFixed(3)}\n`;
  }

  // Learner action distribution
  md += `\n### 1.4 Learner Action Distribution\n\n`;
  md += `| Action | Base | Recognition |\n|--------|------|-------------|\n`;
  const allActions = [...new Set([
    ...Object.keys(analysis.structural.learnerActionDistribution?.base || {}),
    ...Object.keys(analysis.structural.learnerActionDistribution?.recognition || {}),
  ])];
  for (const action of allActions) {
    const b = analysis.structural.learnerActionDistribution?.base?.[action] || 0;
    const r = analysis.structural.learnerActionDistribution?.recognition?.[action] || 0;
    md += `| ${action} | ${b} | ${r} |\n`;
  }

  // Correlations
  md += `\n### 1.5 Correlations with Overall Score\n\n`;
  md += `| Modulation Metric | r | p |\n|-------------------|---|---|\n`;
  for (const [key, corr] of Object.entries(analysis.correlations)) {
    const pStr = corr.p < 0.001 ? '<.001' : corr.p.toFixed(3);
    md += `| ${key.replace(/_/g, ' ')} | ${corr.r.toFixed(3)} | ${pStr} |\n`;
  }

  // LLM-coded metrics
  if (!opts.structuralOnly && Object.keys(analysis.llmCoded).length > 0) {
    md += `\n## 2. LLM-Coded Metrics (Tier 2)\n\n`;
    md += `| Metric | Base | Recog | Cohen's d | Welch t | p |\n`;
    md += `|--------|------|-------|-----------|---------|---|\n`;

    const llmLabels = {
      stanceReversal: 'Stance Reversals (count)',
      crossTurnMemory: 'Cross-Turn Memory Rate',
      hallucinationCorrection: 'Hallucination Rate',
      phaseTransition: 'Phase Transition Density',
    };

    for (const [key, data] of Object.entries(analysis.llmCoded)) {
      if (!data.base) continue;
      const bStr = `${data.base.mean.toFixed(3)} (${data.base.sd.toFixed(3)})`;
      const rStr = `${data.recognition.mean.toFixed(3)} (${data.recognition.sd.toFixed(3)})`;
      const pStr = data.welch.p < 0.001 ? '<.001' : data.welch.p.toFixed(3);
      md += `| ${llmLabels[key] || key} | ${bStr} | ${rStr} | ${data.d.toFixed(2)} | ${data.welch.t.toFixed(2)} | ${pStr} |\n`;
    }
  }

  // Per-cell summary table
  md += `\n## 3. Per-Cell Summary\n\n`;
  md += `| Cell | N | Mean Score | Mean Neg Depth | Mean Rounds | Mean Confidence |\n`;
  md += `|------|---|------------|----------------|-------------|------------------|\n`;
  for (const [cellKey, cellProfiles] of Object.entries(analysis.byCell)) {
    const scores = cellProfiles.map(p => p.overallScore).filter(v => v != null);
    const negDepths = cellProfiles.map(p => p.structural.aggregate.meanNegationDepth);
    const rounds = cellProfiles.map(p => p.structural.aggregate.meanRoundsToConverge);
    const confs = cellProfiles.map(p => p.structural.aggregate.meanConfidence).filter(v => v != null);
    md += `| ${cellKey} | ${cellProfiles.length} | ${mean(scores).toFixed(1)} | ${mean(negDepths).toFixed(2)} | ${mean(rounds).toFixed(2)} | ${confs.length > 0 ? mean(confs).toFixed(3) : 'N/A'} |\n`;
  }

  // Exemplar dialogues
  md += `\n## 4. Exemplar Dialogues\n\n`;
  // Highest and lowest negation depth
  const sorted = [...profiles].sort((a, b) =>
    b.structural.aggregate.totalNegations - a.structural.aggregate.totalNegations
  );
  if (sorted.length > 0) {
    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    md += `**Highest negation depth** (${high.structural.aggregate.totalNegations} total negations):\n`;
    md += `- ID: ${high.id}, ${high.condition}/${high.persona}, score=${high.overallScore?.toFixed(1)}\n`;
    md += `- Turns: ${high.structural.totalTurns}, convergence trajectory: ${high.structural.aggregate.convergenceTrajectory}\n\n`;
    md += `**Lowest negation depth** (${low.structural.aggregate.totalNegations} total negations):\n`;
    md += `- ID: ${low.id}, ${low.condition}/${low.persona}, score=${low.overallScore?.toFixed(1)}\n`;
    md += `- Turns: ${low.structural.totalTurns}, convergence trajectory: ${low.structural.aggregate.convergenceTrajectory}\n`;
  }

  return md;
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    model: 'claude-code',
    runId: DEFAULT_RUN_ID,
    structuralOnly: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model': opts.model = args[++i]; break;
      case '--run-id': opts.runId = args[++i]; break;
      case '--structural-only': opts.structuralOnly = true; break;
      case '--help':
        console.log(`Usage: node scripts/code-dialectical-modulation.js [options]

Options:
  --model <model>      Model for LLM coding (default: claude-code)
                         claude-code — Claude Code CLI (subscription, free)
                         haiku       — OpenRouter Haiku
                         sonnet      — OpenRouter Sonnet
  --run-id <id>        Run ID (default: ${DEFAULT_RUN_ID})
  --structural-only    Skip LLM coding, emit only structural metrics
  --help               Show this help`);
        process.exit(0);
    }
  }
  return opts;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const dbPath = path.join(process.cwd(), 'data', 'evaluations.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  console.log('='.repeat(70));
  console.log('DIALECTICAL MODULATION CODING');
  console.log('='.repeat(70));
  console.log(`Model: ${opts.model} | Run ID: ${opts.runId} | Mode: ${opts.structuralOnly ? 'structural only' : 'full'}`);

  // Load rows
  const rows = loadRows(db, opts.runId);
  console.log(`\nLoaded ${rows.length} rows with dialogue IDs`);

  if (rows.length === 0) {
    console.error('No rows found.');
    db.close();
    return;
  }

  // Summary
  const condCounts = { base: 0, recognition: 0 };
  const personaCounts = {};
  for (const row of rows) {
    const { condition, persona } = parseCondition(row.profile_name);
    condCounts[condition]++;
    personaCounts[persona] = (personaCounts[persona] || 0) + 1;
  }
  console.log(`  Base: ${condCounts.base}, Recognition: ${condCounts.recognition}`);
  console.log(`  Personas: ${Object.entries(personaCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Ensure exports directory
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Process each dialogue
  const profiles = [];
  let loadErrors = 0;
  let llmErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const progress = `[${i + 1}/${rows.length}]`;

    // Load dialogue log
    const dialogueLog = loadDialogueLog(row.dialogue_id);
    if (!dialogueLog || !dialogueLog.dialogueTrace) {
      process.stdout.write(`  ${progress} SKIP ${row.dialogue_id}: no dialogue log\n`);
      loadErrors++;
      continue;
    }

    // Segment trace by turn
    const turns = segmentTraceByTurn(dialogueLog.dialogueTrace);
    if (turns.length === 0) {
      process.stdout.write(`  ${progress} SKIP ${row.dialogue_id}: no turns found\n`);
      loadErrors++;
      continue;
    }

    // Extract structural metrics
    const structural = extractStructuralMetrics(dialogueLog, turns);

    // Extract LLM-coded metrics (if not structural-only)
    let llmCoded = null;
    if (!opts.structuralOnly) {
      process.stdout.write(`  ${progress} ${row.dialogue_id} (${turns.length} turns) — LLM coding...`);
      llmCoded = await extractLLMCodedMetrics(turns, opts.model);
      if (llmCoded.errors.length > 0) {
        llmErrors += llmCoded.errors.length;
        console.log(` ${llmCoded.errors.length} errors`);
      } else {
        console.log(' done');
      }
    } else {
      process.stdout.write(`  ${progress} ${row.dialogue_id} (${turns.length} turns) — structural\n`);
    }

    const profile = buildModulationProfile(row, dialogueLog, structural, llmCoded);
    profiles.push(profile);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nProcessing complete: ${profiles.length} profiles, ${loadErrors} load errors, ${llmErrors} LLM errors, ${elapsed}s`);

  if (profiles.length === 0) {
    console.error('No profiles generated.');
    db.close();
    return;
  }

  // Analyze
  const analysis = analyzeAggregateResults(profiles);

  // Write outputs
  const jsonPath = path.join(exportsDir, `dialectical-modulation-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    generated: new Date().toISOString(),
    model: opts.model,
    runId: opts.runId,
    mode: opts.structuralOnly ? 'structural' : 'full',
    n: profiles.length,
    loadErrors,
    llmErrors,
    profiles,
    analysis,
  }, null, 2));
  console.log(`\nJSON: ${jsonPath}`);

  const mdReport = generateReport(profiles, analysis, opts);
  const mdPath = path.join(exportsDir, `dialectical-modulation-${timestamp}.md`);
  fs.writeFileSync(mdPath, mdReport);
  console.log(`Markdown: ${mdPath}`);

  // Print summary
  console.log('\n' + '─'.repeat(70));
  console.log('STRUCTURAL METRICS SUMMARY: Base vs Recognition');
  console.log('─'.repeat(70));
  console.log(`${'Metric'.padEnd(30)} ${'Base'.padEnd(14)} ${'Recog'.padEnd(14)} ${'d'.padEnd(8)} p`);
  console.log('─'.repeat(70));

  for (const [key, data] of Object.entries(analysis.structural)) {
    if (key === 'interventionDistribution' || key === 'interventionChiSquare' || key === 'learnerActionDistribution') continue;
    const bStr = data.base.mean.toFixed(2);
    const rStr = data.recognition.mean.toFixed(2);
    const pStr = data.welch.p < 0.001 ? '<.001' : data.welch.p.toFixed(3);
    console.log(`  ${data.label.padEnd(28)} ${bStr.padEnd(14)} ${rStr.padEnd(14)} ${data.d.toFixed(2).padEnd(8)} ${pStr}`);
  }

  // Correlations
  if (Object.keys(analysis.correlations).length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('CORRELATIONS WITH OVERALL SCORE');
    console.log('─'.repeat(70));
    for (const [key, corr] of Object.entries(analysis.correlations)) {
      const pStr = corr.p < 0.001 ? '<.001' : corr.p.toFixed(3);
      console.log(`  ${key.replace(/_/g, ' ').padEnd(35)} r = ${corr.r.toFixed(3).padEnd(8)} p = ${pStr}`);
    }
  }

  // LLM summary
  if (!opts.structuralOnly && Object.keys(analysis.llmCoded).length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('LLM-CODED METRICS SUMMARY: Base vs Recognition');
    console.log('─'.repeat(70));

    const llmLabels = {
      stanceReversal: 'Stance Reversals',
      crossTurnMemory: 'Cross-Turn Memory',
      hallucinationCorrection: 'Hallucination Rate',
      phaseTransition: 'Phase Transitions',
    };

    for (const [key, data] of Object.entries(analysis.llmCoded)) {
      if (!data.base) continue;
      const pStr = data.welch.p < 0.001 ? '<.001' : data.welch.p.toFixed(3);
      console.log(`  ${(llmLabels[key] || key).padEnd(28)} base=${data.base.mean.toFixed(3).padEnd(8)} recog=${data.recognition.mean.toFixed(3).padEnd(8)} d=${data.d.toFixed(2).padEnd(8)} p=${pStr}`);
    }
  }

  db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
