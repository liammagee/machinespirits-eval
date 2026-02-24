#!/usr/bin/env node
/**
 * Standalone learner evaluator — avoids importing evaluationRunner.js / tutor-core.
 * Equivalent to `eval-cli.js evaluate-learner` but with minimal dependencies.
 *
 * Usage: node scripts/evaluate-learner-standalone.js <runId> [--force] [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import store from '../services/evaluationStore.js';
import {
  buildLearnerEvaluationPrompt,
  calculateLearnerOverallScore,
} from '../services/learnerRubricEvaluator.js';

const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const verbose = args.includes('--verbose');

if (!runId) {
  console.error('Usage: node scripts/evaluate-learner-standalone.js <runId> [--force] [--verbose]');
  process.exit(1);
}

const LOGS_DIR = path.resolve('logs/tutor-dialogues');

// Load results
const allResults = store.getResults(runId);
const dialogueResults = allResults.filter((r) => r.dialogueId && r.success);

if (dialogueResults.length === 0) {
  console.error(`No dialogue results found for run: ${runId}`);
  process.exit(1);
}

// Filter to those needing scoring
const toEvaluate = force
  ? dialogueResults
  : dialogueResults.filter((r) => r.learnerOverallScore == null);

console.log(`\nEvaluating learner turns for ${toEvaluate.length} dialogue(s) from run: ${runId}\n`);

let succeeded = 0;
let failed = 0;
const allScores = [];

for (let i = 0; i < toEvaluate.length; i++) {
  const result = toEvaluate[i];
  const profileName = result.profileName || 'unknown';
  const tag = `[${i + 1}/${toEvaluate.length}]`;

  // Load dialogue log
  const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
  let dialogueLog;
  try {
    if (!fs.existsSync(logPath)) {
      if (verbose) console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (log not found)`);
      failed++;
      continue;
    }
    dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  } catch (e) {
    if (verbose) console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (${e.message})`);
    failed++;
    continue;
  }

  if (!dialogueLog.isMultiTurn) {
    if (verbose) console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (not multi-turn)`);
    failed++;
    continue;
  }

  const trace = dialogueLog.dialogueTrace || [];
  const learnerArch = dialogueLog.learnerArchitecture || 'unified';
  const isMultiAgent =
    learnerArch.includes('ego_superego') ||
    learnerArch === 'multi_agent' ||
    learnerArch.includes('psychodynamic');

  // Extract learner turns
  const learnerTurns = [];
  const turnActionEntries = trace.filter((t) => t.agent === 'user' && t.action === 'turn_action');

  for (const ta of turnActionEntries) {
    const turnData = {
      turnIndex: ta.turnIndex,
      externalMessage: ta.contextSummary || '',
      internalDeliberation: [],
    };

    if (isMultiAgent) {
      const taIdx = trace.indexOf(ta);
      for (let j = taIdx - 1; j >= 0; j--) {
        const entry = trace[j];
        if (entry.agent === 'learner_ego_initial' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_initial', content: entry.contextSummary || '' });
          break;
        } else if (entry.agent === 'learner_superego' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'superego', content: entry.contextSummary || '' });
        } else if (entry.agent === 'learner_ego_revision' && entry.action === 'deliberation') {
          turnData.internalDeliberation.unshift({ role: 'ego_revision', content: entry.contextSummary || '' });
        } else if (entry.agent === 'ego' || entry.agent === 'system') {
          break;
        }
      }
    }

    learnerTurns.push(turnData);
  }

  if (learnerTurns.length === 0) {
    if (verbose) console.log(`${tag} ${result.scenarioId} / ${profileName} ... SKIP (no learner turns)`);
    failed++;
    continue;
  }

  // Build reconstructed turn array
  const reconstructedTurns = [];
  const turnResults = dialogueLog.turnResults || [];

  if (turnResults.length > 0) {
    const sug = turnResults[0].suggestions?.[0];
    reconstructedTurns.push({
      turnNumber: 0,
      phase: 'tutor',
      externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
    });
  }

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

  const personaDescription = dialogueLog.learnerContext || 'No persona description available';
  const turnScores = {};
  let turnSucceeded = 0;

  // Score each learner turn
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    const targetIdx = reconstructedTurns.findIndex(
      (t, idx) => t.phase === 'learner' && t.externalMessage === learnerTurns[lt].externalMessage && idx > 0,
    );
    if (targetIdx === -1) continue;

    const turnTag = `${tag} ${result.scenarioId} / ${profileName} turn-${lt + 1}`;

    try {
      const prompt = buildLearnerEvaluationPrompt({
        turns: reconstructedTurns,
        targetTurnIndex: targetIdx,
        personaId: profileName,
        personaDescription,
        learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
        scenarioName: result.scenarioId,
        topic: result.scenarioId,
      });

      const claudeArgs = ['-p', '-', '--output-format', 'text'];

      if (verbose) console.log(`${turnTag} ... calling claude`);

      const stdout = await new Promise((resolve, reject) => {
        const env = { ...process.env };
        delete env.ANTHROPIC_API_KEY;
        delete env.CLAUDECODE;
        const child = spawn('claude', claudeArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
        });
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { err += d; });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
          else resolve(out);
        });
        child.stdin.write(prompt);
        child.stdin.end();
      });

      // Parse JSON response
      let jsonStr = stdout.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      const parsed = JSON.parse(jsonStr);
      const turnOverall = calculateLearnerOverallScore(parsed.scores || {}, isMultiAgent);

      turnScores[lt] = {
        turnIndex: lt + 1,
        scores: parsed.scores,
        overallScore: turnOverall,
        summary: parsed.summary,
      };

      const dimScores = Object.entries(parsed.scores || {})
        .map(([k, v]) => `${k}=${typeof v === 'object' ? v.score : v}`)
        .join(' ');
      console.log(`${turnTag} ... ${turnOverall.toFixed(1)}  (${dimScores})`);

      turnSucceeded++;
    } catch (err) {
      const msg = err.message?.slice(0, 200) || 'unknown error';
      console.log(`${turnTag} ... FAIL: ${msg}`);
      if (verbose) console.error(err);
    }
  }

  if (turnSucceeded > 0) {
    const turnOveralls = Object.values(turnScores).map((ts) => ts.overallScore);
    const dialogueLearnerScore = turnOveralls.reduce((a, b) => a + b, 0) / turnOveralls.length;

    store.updateResultLearnerScores(result.id, {
      scores: turnScores,
      overallScore: dialogueLearnerScore,
      judgeModel: 'claude-opus-4.6',
    });

    allScores.push(dialogueLearnerScore);
    succeeded++;

    console.log(`  → Dialogue learner score: ${dialogueLearnerScore.toFixed(1)} (${turnSucceeded} turns)\n`);
  } else {
    failed++;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('  EVALUATE-LEARNER SUMMARY');
console.log('='.repeat(50));
console.log(`  Total dialogues:  ${toEvaluate.length}`);
console.log(`  Succeeded: ${succeeded}`);
console.log(`  Failed:    ${failed}`);
if (allScores.length > 0) {
  const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const sd =
    allScores.length > 1
      ? Math.sqrt(allScores.reduce((acc, s) => acc + (s - avg) ** 2, 0) / (allScores.length - 1))
      : 0;
  console.log(`  Avg learner score: ${avg.toFixed(1)} (SD=${sd.toFixed(1)})`);
}
console.log('');
