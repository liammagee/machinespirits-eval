#!/usr/bin/env node

/**
 * Inspect Judge Prompt
 *
 * Shows exactly what text the judge receives for a specific run/scenario/turn.
 * Useful for verifying rubric inputs and debugging scoring anomalies.
 *
 * Usage:
 *   node scripts/inspect-judge-prompt.js <runId> [options]
 *
 * Options:
 *   --scenario <id>     Scenario ID filter (required unless --row)
 *   --profile <name>    Profile name filter
 *   --row <id>          Direct DB row ID (skips scenario/profile lookup)
 *   --turn <n>          Turn index to inspect (default: 0)
 *   --channel <type>    Channel: tutor, learner, tutor-holistic, learner-holistic,
 *                       dialogue-public, dialogue-internal, tutor-delib, learner-delib, all
 *                       (default: tutor)
 *   --score             Actually call the judge and show scores
 *   --verbose           Show additional metadata (trace entries, DB row fields)
 *   --prompt-only       Print only the raw prompt text (for piping)
 *
 * Examples:
 *   # Show tutor judge prompt for Turn 0
 *   node scripts/inspect-judge-prompt.js eval-2026-02-14-49b33fdd --scenario misconception_correction_flow --turn 0
 *
 *   # Show what the learner judge sees at learner turn 1
 *   node scripts/inspect-judge-prompt.js eval-2026-02-14-49b33fdd --scenario misconception_correction_flow --turn 1 --channel learner
 *
 *   # Show all channels for turn 0
 *   node scripts/inspect-judge-prompt.js eval-2026-02-14-49b33fdd --scenario misconception_correction_flow --turn 0 --channel all
 *
 *   # Actually score and show results
 *   node scripts/inspect-judge-prompt.js eval-2026-02-14-49b33fdd --scenario misconception_correction_flow --turn 0 --score
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import * as evaluationStore from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import {
  buildEvaluationPrompt,
  buildPerTurnTutorEvaluationPrompt,
  buildTutorHolisticEvaluationPrompt,
  buildDialogueQualityPrompt,
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  hasTutorSuperego,
  buildTutorDeliberationPrompt,
  buildLearnerDeliberationPrompt,
  calculateOverallScore,
  calculateDialogueQualityScore,
  calculateTutorHolisticScore,
  calculateDeliberationScore,
} from '../services/rubricEvaluator.js';
import {
  buildLearnerEvaluationPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
} from '../services/learnerRubricEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const { getScenario } = evalConfigLoader;

// ── CLI arg parsing ──

const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith('--'));

function getOption(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
function getFlag(name) {
  return args.includes(`--${name}`);
}

const scenarioFilter = getOption('scenario');
const profileFilter = getOption('profile');
const rowId = getOption('row');
const turnIndex = parseInt(getOption('turn') || '0', 10);
const channel = getOption('channel') || 'tutor';
const doScore = getFlag('score');
const verbose = getFlag('verbose');
const promptOnly = getFlag('prompt-only');

if (!runId && !rowId) {
  console.error('Usage: inspect-judge-prompt.js <runId> --scenario <id> [--turn N] [--channel tutor|learner|all] [--score]');
  console.error('       inspect-judge-prompt.js --row <rowId> [--turn N] [--channel tutor|learner|all] [--score]');
  process.exit(1);
}

// ── Load the target row ──

let result;
if (rowId) {
  // Look up the row's run_id first, then use getResults for proper parsing
  const allResults = evaluationStore.getResults('%', {});  // won't work — need direct lookup
  // Fall back: use sqlite directly
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.resolve(__dirname, '..', 'data', 'evaluations.db');
  const rawDb = new Database(dbPath, { readonly: true });
  const rawRow = rawDb.prepare('SELECT run_id, scenario_id FROM evaluation_results WHERE id = ?').get(rowId);
  rawDb.close();
  if (!rawRow) { console.error(`Row ${rowId} not found`); process.exit(1); }
  const rowResults = evaluationStore.getResults(rawRow.run_id, { scenarioId: rawRow.scenario_id });
  result = rowResults.find((r) => String(r.id) === String(rowId));
  if (!result) { console.error(`Row ${rowId} found in DB but not returned by getResults`); process.exit(1); }
} else {
  const opts = {};
  if (scenarioFilter) opts.scenarioId = scenarioFilter;
  if (profileFilter) opts.profileName = profileFilter;
  const results = evaluationStore.getResults(runId, opts);
  if (results.length === 0) {
    console.error(`No rows found for run=${runId} scenario=${scenarioFilter || 'all'} profile=${profileFilter || 'all'}`);
    process.exit(1);
  }
  if (results.length > 1 && !promptOnly) {
    console.log(`Found ${results.length} rows — using first. Add --profile to narrow.`);
    for (const r of results.slice(0, 5)) {
      console.log(`  ${r.id}  ${r.scenarioId}  ${r.profileName}`);
    }
    console.log('');
  }
  result = results[0];
}

// Parse JSON fields if needed
if (typeof result.suggestions === 'string') {
  try { result.suggestions = JSON.parse(result.suggestions); } catch { /* keep as-is */ }
}

const scenarioId = result.scenarioId || result.scenario_id;
const profileName = result.profileName || result.profile_name;
const dialogueId = result.dialogueId || result.dialogue_id;

if (!promptOnly) {
  console.log('═'.repeat(70));
  console.log('  INSPECT JUDGE PROMPT');
  console.log('═'.repeat(70));
  console.log(`  Row:       ${result.id}`);
  console.log(`  Run:       ${runId || '(direct row)'}`);
  console.log(`  Scenario:  ${scenarioId}`);
  console.log(`  Profile:   ${profileName}`);
  console.log(`  Dialogue:  ${dialogueId || '(none — single-turn)'}`);
  console.log(`  Turn:      ${turnIndex}`);
  console.log(`  Channel:   ${channel}`);
  console.log('');
}

// ── Load dialogue log ──

let dialogueLog = null;
if (dialogueId) {
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (fs.existsSync(logPath)) {
    dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    if (!promptOnly) {
      console.log(`  Dialogue log: ${logPath}`);
      console.log(`  Total turns:  ${dialogueLog.totalTurns || dialogueLog.turnResults?.length || '?'}`);
      console.log(`  Multi-turn:   ${dialogueLog.isMultiTurn}`);
      console.log(`  Learner arch: ${dialogueLog.learnerArchitecture || 'unknown'}`);
      console.log(`  Trace entries:${dialogueLog.dialogueTrace?.length || 0}`);
      console.log('');
    }
  } else {
    console.error(`  WARNING: dialogue log not found at ${logPath}`);
  }
}

// ── Load scenario ──

const scenario = getScenario(scenarioId);
if (!scenario) {
  console.error(`Scenario ${scenarioId} not found in YAML config`);
  process.exit(1);
}

// ── Shared data prep ──

const turnResults = dialogueLog?.turnResults || [
  { turnId: 'single', suggestions: result.suggestions },
];
const dialogueTrace = dialogueLog?.dialogueTrace || [];
const totalTurns = turnResults.length;

const learnerArch = dialogueLog?.learnerArchitecture || result.learner_architecture || 'unified';
const isMultiAgent = learnerArch.includes('ego_superego') || learnerArch === 'multi_agent' || learnerArch.includes('psychodynamic');
const learnerCtx = dialogueLog?.learnerContext || scenario.learner_context || '';

const scenarioContext = {
  name: scenario.name,
  description: scenario.description,
  expectedBehavior: scenario.expected_behavior,
  learnerContext: scenario.learner_context,
  requiredElements: scenario.required_elements,
  forbiddenElements: scenario.forbidden_elements,
};

// Build transcript turns for holistic/dialogue prompts
const transcriptTurns = turnResults.map((t, i) => ({
  turnIndex: i,
  turnId: t.turnId,
  suggestion: t.suggestions?.[0],
  learnerAction: t.learnerAction,
  learnerMessage: t.learnerMessage,
}));

// ── Learner data (from extractLearnerTurnsFromTrace logic) ──

function extractLearnerTurnsFromTrace(trace, multi, convHist) {
  const turns = [];
  let markers = trace.filter(
    (t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action',
  );
  if (markers.length === 0) {
    markers = trace.filter(
      (t) => (t.agent === 'learner_synthesis' && t.action === 'response')
        || (t.agent === 'learner' && t.action === 'final_output'),
    );
  }
  const convHistByTurn = {};
  if (Array.isArray(convHist)) {
    convHist.forEach((ch, i) => { if (ch.learnerMessage) convHistByTurn[i] = ch.learnerMessage; });
  }
  for (const ta of markers) {
    let rawMsg = (ta.action === 'final_output')
      ? (ta.detail || ta.contextSummary || '')
      : (ta.contextSummary || '');
    const extMatch = rawMsg.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
    if (extMatch) rawMsg = extMatch[1].trim();
    const td = { turnIndex: ta.turnIndex, externalMessage: rawMsg, internalDeliberation: [] };
    if (!td.externalMessage && ta.turnIndex != null) {
      td.externalMessage = convHistByTurn[ta.turnIndex - 1] || '';
    }
    if (multi) {
      const taIdx = trace.indexOf(ta);
      for (let j = taIdx - 1; j >= 0; j--) {
        const e = trace[j];
        if (e.agent === 'learner_ego_initial' && e.action === 'deliberation') {
          td.internalDeliberation.unshift({ role: 'ego_initial', content: e.contextSummary || '' });
          break;
        } else if (e.agent === 'learner_superego' && e.action === 'deliberation') {
          td.internalDeliberation.unshift({ role: 'superego', content: e.contextSummary || '' });
        } else if (e.agent === 'learner_ego_revision' && e.action === 'deliberation') {
          td.internalDeliberation.unshift({ role: 'ego_revision', content: e.contextSummary || '' });
        } else if (e.agent === 'ego' || e.agent === 'system' || e.agent === 'superego') {
          break;
        }
      }
    }
    turns.push(td);
  }
  return turns;
}

const learnerTurns = extractLearnerTurnsFromTrace(dialogueTrace, isMultiAgent, dialogueLog?.conversationHistory);

// Build reconstructed turns for learner prompt builder
const reconstructedTurns = [];
for (let lt = 0; lt < learnerTurns.length; lt++) {
  reconstructedTurns.push({
    turnNumber: lt + 1,
    phase: 'learner',
    externalMessage: learnerTurns[lt].externalMessage,
    internalDeliberation: learnerTurns[lt].internalDeliberation,
  });
  const tutorTurn = turnResults[lt + 1];
  if (tutorTurn) {
    const sug = tutorTurn.suggestions?.[0];
    reconstructedTurns.push({
      turnNumber: lt + 1,
      phase: 'tutor',
      externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
    });
  }
}

// ── Prompt builders per channel ──

function buildPromptForChannel(ch) {
  switch (ch) {
    case 'tutor': {
      return buildPerTurnTutorEvaluationPrompt({
        turnResults,
        dialogueTrace,
        targetTurnIndex: turnIndex,
        scenario: scenarioContext,
        learnerContext: learnerCtx,
      });
    }

    case 'learner': {
      // Learner turns are offset: learner turn 0 maps to reconstructedTurns index
      const targetIdx = reconstructedTurns.findIndex(
        (t, idx) => t.phase === 'learner' && idx > 0
          && learnerTurns[turnIndex]
          && t.externalMessage === learnerTurns[turnIndex].externalMessage,
      );
      if (targetIdx === -1 && learnerTurns.length > 0) {
        // Fallback: use learner turn index directly in reconstructedTurns
        const fallbackIdx = reconstructedTurns.findIndex(
          (t) => t.phase === 'learner',
        );
        if (fallbackIdx === -1) return null;
        return buildLearnerEvaluationPrompt({
          turns: reconstructedTurns,
          targetTurnIndex: fallbackIdx + turnIndex * 2,
          personaId: profileName,
          personaDescription: learnerCtx,
          learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
          scenarioName: scenario.name,
          topic: scenarioId,
        });
      }
      return buildLearnerEvaluationPrompt({
        turns: reconstructedTurns,
        targetTurnIndex: targetIdx,
        personaId: profileName,
        personaDescription: learnerCtx,
        learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
        scenarioName: scenario.name,
        topic: scenarioId,
      });
    }

    case 'tutor-holistic': {
      return buildTutorHolisticEvaluationPrompt({
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        learnerContext: learnerCtx,
        hasRecognition: profileName.includes('recog'),
      });
    }

    case 'learner-holistic': {
      return buildLearnerHolisticEvaluationPrompt({
        turns: reconstructedTurns,
        personaId: profileName,
        personaDescription: learnerCtx,
        learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
        scenarioName: scenario.name,
        topic: scenarioId,
      });
    }

    case 'dialogue-public': {
      return buildDialogueQualityPrompt({
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        topic: scenario.topic || scenario.name,
        turnCount: totalTurns,
        learnerContext: learnerCtx,
        transcriptMode: 'public',
      });
    }

    case 'dialogue-internal': {
      return buildDialogueQualityPrompt({
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        topic: scenario.topic || scenario.name,
        turnCount: totalTurns,
        learnerContext: learnerCtx,
        transcriptMode: 'full',
      });
    }

    case 'tutor-delib': {
      if (!hasTutorSuperego(dialogueTrace)) return null;
      return buildTutorDeliberationPrompt({
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        learnerContext: learnerCtx,
      });
    }

    case 'learner-delib': {
      if (!isMultiAgent) return null;
      return buildLearnerDeliberationPrompt({
        turns: transcriptTurns,
        dialogueTrace,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        learnerContext: learnerCtx,
      });
    }

    default:
      return null;
  }
}

function scoreCalcForChannel(ch, parsed) {
  const scores = parsed.scores || {};
  switch (ch) {
    case 'tutor':
      return calculateOverallScore(scores);
    case 'learner':
      return calculateLearnerOverallScore(scores, isMultiAgent);
    case 'tutor-holistic':
      return calculateTutorHolisticScore(scores, profileName.includes('recog'));
    case 'learner-holistic':
      return calculateLearnerOverallScore(scores, isMultiAgent);
    case 'dialogue-public':
    case 'dialogue-internal':
      return calculateDialogueQualityScore(scores);
    case 'tutor-delib':
    case 'learner-delib':
      return calculateDeliberationScore(scores);
    default:
      return parsed.overall_score || 0;
  }
}

// ── Call judge (optional) ──

async function callJudge(prompt) {
  const claudeArgs = ['-p', '-', '--output-format', 'text'];
  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;
    const child = spawn('claude', claudeArgs, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `claude exited ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  let jsonStr = stdout.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first !== -1 && last > first) jsonStr = jsonStr.slice(first, last + 1);
  }
  return JSON.parse(jsonStr);
}

// ── Main ──

const channels = channel === 'all'
  ? ['tutor', 'learner', 'tutor-holistic', 'learner-holistic', 'dialogue-public', 'dialogue-internal', 'tutor-delib', 'learner-delib']
  : [channel];

for (const ch of channels) {
  const prompt = buildPromptForChannel(ch);
  if (!prompt) {
    if (!promptOnly) console.log(`[${ch}] — not applicable (no data or gating condition not met)\n`);
    continue;
  }

  if (promptOnly) {
    process.stdout.write(prompt);
    continue;
  }

  // ── Display prompt with structure ──

  console.log('─'.repeat(70));
  console.log(`  CHANNEL: ${ch.toUpperCase()}`);
  console.log('─'.repeat(70));

  // Break the prompt into sections for readability
  const sections = prompt.split(/(?=^## )/m);
  for (const section of sections) {
    const headerMatch = section.match(/^## (.+)/);
    if (headerMatch) {
      console.log(`\n  ┌─ ${headerMatch[1]} ${'─'.repeat(Math.max(0, 55 - headerMatch[1].length))}┐`);
    }
    // Show content with left margin
    const lines = section.split('\n');
    const startIdx = headerMatch ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      console.log(`  │ ${lines[i]}`);
    }
    if (headerMatch) console.log(`  └${'─'.repeat(58)}┘`);
  }

  // Stats
  const charCount = prompt.length;
  const wordCount = prompt.split(/\s+/).length;
  const lineCount = prompt.split('\n').length;
  console.log(`\n  📊 Prompt stats: ${charCount.toLocaleString()} chars, ~${wordCount.toLocaleString()} words, ${lineCount} lines`);

  // Verbose: show trace entries relevant to this turn
  if (verbose && dialogueTrace.length > 0) {
    console.log(`\n  Trace entries for turn ${turnIndex}:`);
    const turnEntries = dialogueTrace.filter((e) => e.turnIndex === turnIndex || e.turnIndex === undefined);
    for (const e of turnEntries.slice(0, 20)) {
      const text = (e.contextSummary || e.detail || e.feedback || '').slice(0, 80);
      console.log(`    [${e.agent}/${e.action}] turn=${e.turnIndex ?? '?'} ${text}`);
    }
  }

  // Score if requested
  if (doScore) {
    console.log(`\n  🔄 Calling judge for ${ch}...`);
    try {
      const startMs = Date.now();
      const parsed = await callJudge(prompt);
      const elapsed = Date.now() - startMs;
      const overall = scoreCalcForChannel(ch, parsed);

      console.log(`  ✓ Score: ${overall.toFixed(1)} (${(elapsed / 1000).toFixed(1)}s)`);
      console.log('  Per-dimension:');
      for (const [dim, val] of Object.entries(parsed.scores || {})) {
        const s = typeof val === 'object' ? val.score : val;
        const r = typeof val === 'object' ? val.reasoning : '';
        console.log(`    ${dim.padEnd(30)} ${s}/5  ${r}`);
      }
      if (parsed.summary) console.log(`  Summary: ${parsed.summary}`);
    } catch (err) {
      console.error(`  ✗ Judge call failed: ${err.message}`);
    }
  }

  console.log('');
}

// ── Also show the public transcript standalone for context ──

if (!promptOnly && channel !== 'all' && dialogueLog) {
  console.log('─'.repeat(70));
  console.log('  PUBLIC TRANSCRIPT (what output-quality judges see)');
  console.log('─'.repeat(70));
  const publicTranscript = buildDialoguePublicTranscript(transcriptTurns, dialogueTrace, learnerCtx);
  console.log(publicTranscript);
  console.log('');

  if (verbose) {
    console.log('─'.repeat(70));
    console.log('  FULL TRANSCRIPT (what deliberation judges see)');
    console.log('─'.repeat(70));
    const fullTranscript = buildDialogueFullTranscript(transcriptTurns, dialogueTrace, learnerCtx);
    console.log(fullTranscript);
    console.log('');
  }
}
