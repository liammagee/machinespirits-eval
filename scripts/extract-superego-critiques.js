#!/usr/bin/env node
/**
 * extract-superego-critiques.js — Extract superego critique data from dialogue logs
 *
 * Scans all dialogue log files for tutor superego review entries and
 * learner superego deliberation entries. Outputs a JSONL file suitable
 * for classification.
 *
 * Usage:
 *   node scripts/extract-superego-critiques.js [--output data/superego-critiques.jsonl]
 *   node scripts/extract-superego-critiques.js --stats   # Summary statistics only
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseEpochArg, dialogueMatchesEpoch, printEpochBanner } from '../services/epochFilter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGS_DIR = join(ROOT, 'logs', 'tutor-dialogues');

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const statsOnly = args.includes('--stats');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : join(ROOT, 'data', 'superego-critiques.jsonl');
const epoch = parseEpochArg(args);

// ── Extraction ──────────────────────────────────────────────────────────────

function extractFromLog(filePath, fileName) {
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return []; // Skip unparseable files
  }

  const results = [];
  const dialogueTrace = data.dialogueTrace || [];
  const profileName = data.profileName || null;
  const model = data.model || null;
  const provider = data.provider || null;
  const dialogueId = data.dialogueId || fileName.replace('.json', '');
  const isMultiTurn = data.isMultiTurn || false;
  const totalTurns = data.totalTurns || null;
  const learnerArchitecture = data.learnerArchitecture || null;
  const learnerContext = data.learnerContext || null;
  const conversationMode = data.conversationMode || null;

  for (let i = 0; i < dialogueTrace.length; i++) {
    const entry = dialogueTrace[i];
    const agent = entry.agent || '';
    const action = entry.action || '';

    // --- Tutor superego review ---
    if (agent === 'superego' && action === 'review') {
      const verdict = entry.verdict || {};
      const feedback = verdict.feedback || '';
      const approved = entry.approved ?? verdict.approved ?? null;
      const confidence = entry.confidence ?? null;
      const interventionType = entry.interventionType || null;
      const suggestedChanges = entry.suggestedChanges || null;
      const round = entry.round ?? null;
      const turnIndex = entry.turnIndex ?? null;

      // Find the preceding ego generate and following ego revision for context
      let egoGenerate = null;
      let egoRevision = null;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const entry = dialogueTrace[j];
        if (entry.agent === 'ego' && entry.action === 'generate') {
          egoGenerate = entry.detail || entry.contextSummary || entry.suggestions?.[0]?.message || null;
          break;
        }
      }
      for (let j = i + 1; j < Math.min(dialogueTrace.length, i + 5); j++) {
        const entry = dialogueTrace[j];
        if (
          entry.agent === 'ego' &&
          (entry.action === 'revise' || entry.action === 'generate')
        ) {
          egoRevision = entry.detail || entry.contextSummary || entry.suggestions?.[0]?.message || null;
          break;
        }
      }

      if (feedback.length > 0 || !approved) {
        results.push({
          type: 'tutor_superego',
          dialogueId,
          profileName,
          model,
          provider,
          isMultiTurn,
          totalTurns,
          learnerArchitecture,
          conversationMode,
          turnIndex,
          round,
          approved,
          confidence,
          interventionType,
          feedback,
          suggestedChanges: suggestedChanges ? JSON.stringify(suggestedChanges) : null,
          egoGenerate,
          egoRevision,
          learnerContext: typeof learnerContext === 'string' ? learnerContext : JSON.stringify(learnerContext),
        });
      }
    }

    // --- Learner superego deliberation ---
    if (agent === 'learner_superego' && action === 'deliberation') {
      const detail = entry.detail || '';
      const turnIndex = entry.turnIndex ?? null;
      const metrics = entry.metrics || {};

      if (detail.length > 0) {
        results.push({
          type: 'learner_superego',
          dialogueId,
          profileName,
          model: metrics.model || model,
          provider: metrics.provider || provider,
          isMultiTurn,
          totalTurns,
          learnerArchitecture,
          conversationMode,
          turnIndex,
          round: null,
          approved: null,
          confidence: null,
          interventionType: null,
          feedback: detail,
          suggestedChanges: null,
          egoGenerate: null,
          egoRevision: null,
          learnerContext: typeof learnerContext === 'string' ? learnerContext : JSON.stringify(learnerContext),
        });
      }
    }
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(LOGS_DIR)) {
    console.error(`Logs directory not found: ${LOGS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(LOGS_DIR).filter((f) => f.endsWith('.json') && dialogueMatchesEpoch(f, epoch));
  printEpochBanner(epoch);
  console.log(`Scanning ${files.length} dialogue log files (epoch: ${epoch})...`);

  const allCritiques = [];
  let filesWithSuperego = 0;
  let filesScanned = 0;

  for (const file of files) {
    filesScanned++;
    const critiques = extractFromLog(join(LOGS_DIR, file), file);
    if (critiques.length > 0) {
      filesWithSuperego++;
      allCritiques.push(...critiques);
    }
    if (filesScanned % 2000 === 0) {
      process.stdout.write(
        `  ${filesScanned}/${files.length} files scanned, ${allCritiques.length} critiques found...\r`,
      );
    }
  }

  console.log(`\nExtraction complete.`);
  console.log(`  Files scanned: ${filesScanned}`);
  console.log(`  Files with superego traces: ${filesWithSuperego}`);
  console.log(`  Total critiques extracted: ${allCritiques.length}`);

  // --- Stats breakdown ---
  const tutorCritiques = allCritiques.filter((c) => c.type === 'tutor_superego');
  const learnerCritiques = allCritiques.filter((c) => c.type === 'learner_superego');

  console.log(`\n  Tutor superego critiques: ${tutorCritiques.length}`);
  console.log(`  Learner superego critiques: ${learnerCritiques.length}`);

  // Approval stats for tutor superego
  if (tutorCritiques.length > 0) {
    const approved = tutorCritiques.filter((c) => c.approved === true).length;
    const rejected = tutorCritiques.filter((c) => c.approved === false).length;
    const unknown = tutorCritiques.length - approved - rejected;
    console.log(`\n  Tutor superego verdicts:`);
    console.log(`    Approved: ${approved} (${((approved / tutorCritiques.length) * 100).toFixed(1)}%)`);
    console.log(`    Rejected: ${rejected} (${((rejected / tutorCritiques.length) * 100).toFixed(1)}%)`);
    if (unknown > 0) console.log(`    Unknown: ${unknown}`);

    // Intervention type distribution
    const interventionTypes = {};
    for (const c of tutorCritiques) {
      const t = c.interventionType || 'none';
      interventionTypes[t] = (interventionTypes[t] || 0) + 1;
    }
    console.log(`\n  Intervention types:`);
    for (const [type, count] of Object.entries(interventionTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }
  }

  // Profile distribution
  const profileCounts = {};
  for (const c of allCritiques) {
    const p = c.profileName || 'unknown';
    profileCounts[p] = (profileCounts[p] || 0) + 1;
  }
  console.log(`\n  Critiques by profile:`);
  for (const [profile, count] of Object.entries(profileCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${profile}: ${count}`);
  }

  // Feedback length stats
  const feedbackLengths = allCritiques.map((c) => c.feedback.length);
  const avgLen = feedbackLengths.reduce((a, b) => a + b, 0) / feedbackLengths.length;
  const maxLen = Math.max(...feedbackLengths);
  const minLen = Math.min(...feedbackLengths);
  console.log(`\n  Feedback length: avg=${avgLen.toFixed(0)} min=${minLen} max=${maxLen}`);

  if (statsOnly) {
    return;
  }

  // --- Write JSONL output ---
  const lines = allCritiques.map((c) => JSON.stringify(c));
  writeFileSync(outputPath, lines.join('\n') + '\n');
  console.log(`\nWrote ${allCritiques.length} critiques to: ${outputPath}`);
}

main();
