#!/usr/bin/env node
/**
 * Dialogue Judgement Soft-Check Utility
 *
 * Read-only diagnostic that reconstructs transcripts from dialogue logs and
 * validates structural / semantic properties of dialogue quality judgements.
 * No DB writes, no API calls.
 *
 * Usage:
 *   node scripts/check-dialogue-judgements.js <runId>
 *   node scripts/check-dialogue-judgements.js <runId> --profile cell_89
 *   node scripts/check-dialogue-judgements.js <runId> --verbose
 *   node scripts/check-dialogue-judgements.js <runId> --failures-only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import * as store from '../services/evaluationStore.js';
import { buildDialoguePublicTranscript, buildDialogueFullTranscript } from '../services/rubricEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCENARIOS_PATH = path.join(ROOT, 'config', 'suggestion-scenarios.yaml');

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const runId = positional[0];

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getOption(name, defaultValue = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

const profileFilter = getOption('profile');
const verbose = getFlag('verbose');
const failuresOnly = getFlag('failures-only');

if (!runId) {
  console.error(
    'Usage: node scripts/check-dialogue-judgements.js <runId> [--profile <name>] [--verbose] [--failures-only]',
  );
  process.exit(1);
}

// ─── Load YAML cue phrases for E.4 ────────────────────────────────────────────

function loadYamlCuePhrases() {
  try {
    const raw = fs.readFileSync(SCENARIOS_PATH, 'utf-8');
    const parsed = YAML.parse(raw);
    const phrases = new Map(); // phrase → scenario id
    for (const [id, scenario] of Object.entries(parsed.scenarios || {})) {
      if (scenario.category !== 'multi_turn' || !scenario.turns) continue;
      for (const turn of scenario.turns) {
        const msg = turn.action_details?.message;
        if (msg && typeof msg === 'string') {
          // Store full message and also notable sub-phrases (first 40 chars)
          phrases.set(msg.trim(), id);
        }
      }
    }
    return phrases;
  } catch {
    return new Map();
  }
}

const yamlCuePhrases = loadYamlCuePhrases();

// ─── Forbidden labels for public transcript ────────────────────────────────────

const INTERNAL_LABELS = [
  '[Tutor Superego]',
  '[Tutor Self-Reflection]',
  '[Tutor Superego Reflection]',
  '[Tutor Intersubjective]',
  '[Tutor Strategy]',
  '[Tutor Other-Ego]',
  '[Learner Superego]',
  '[Learner Other-Ego]',
  '[Behavioral Overrides]',
  '[Rejection Budget]',
];

// ─── Check runner ──────────────────────────────────────────────────────────────

const PASS = '✓';
const WARN = '⚠';
const FAIL = '✗';

function countTurnMarkers(transcript) {
  return (transcript.match(/--- Turn \d+ ---/g) || []).length;
}

function checkRow(row) {
  const checks = { A: [], B: [], C: [], D: [], E: [] };
  let publicTranscript = null;
  let fullTranscript = null;

  // Use DB learner_architecture as ground truth (trace-based detection has false
  // positives for messages-mode unified learners that emit learner/final_output).
  const dbIsEgoSuperego = row.learnerArchitecture?.includes('ego_superego') ?? false;

  // ─── A. Log File Integrity ─────────────────────────────────────────────

  const dialogueId = row.dialogueId;
  if (!dialogueId) {
    checks.A.push({ status: FAIL, msg: 'no dialogue_id on row' });
    return { checks, publicTranscript, fullTranscript };
  }

  const log = store.loadDialogueLog(dialogueId);
  if (!log) {
    checks.A.push({ status: FAIL, msg: `log file missing or unparseable: ${dialogueId}` });
    return { checks, publicTranscript, fullTranscript };
  }

  const trace = log.dialogueTrace;
  if (!Array.isArray(trace) || trace.length === 0) {
    checks.A.push({ status: FAIL, msg: 'dialogueTrace empty or missing' });
    return { checks, publicTranscript, fullTranscript };
  }

  const turns = log.turnResults || [];
  const suggestions = row.suggestions || [];
  if (turns.length !== suggestions.length) {
    checks.A.push({ status: WARN, msg: `turnResults(${turns.length}) ≠ suggestions(${suggestions.length})` });
  }

  const logArch = log.learnerArchitecture || null;
  const dbArch = row.learnerArchitecture || null;
  if (logArch && dbArch && logArch !== dbArch) {
    checks.A.push({ status: WARN, msg: `learnerArchitecture mismatch: log="${logArch}" db="${dbArch}"` });
  }

  if (checks.A.length === 0) {
    checks.A.push({ status: PASS, msg: `${turns.length} turns, ${trace.length} trace entries` });
  }

  // ─── B. Public Transcript Structural Checks ────────────────────────────

  const learnerContext = log.learnerContext || '';
  publicTranscript = buildDialoguePublicTranscript(turns, trace, learnerContext);

  if (publicTranscript === '(no transcript available)') {
    checks.B.push({ status: FAIL, msg: 'public transcript empty' });
  } else {
    // B.1 No internal labels
    const leakedLabels = INTERNAL_LABELS.filter((l) => publicTranscript.includes(l));
    if (leakedLabels.length > 0) {
      checks.B.push({ status: FAIL, msg: `internal labels leaked: ${leakedLabels.join(', ')}` });
    }

    // B.2+B.3 Learner + tutor present each turn
    const publicTurnCount = countTurnMarkers(publicTranscript);
    const turnBlocks = publicTranscript.split(/--- Turn \d+ ---/).slice(1);
    let missingLearner = 0;
    let missingTutor = 0;
    let emptyMessages = 0;
    for (let i = 0; i < turnBlocks.length; i++) {
      const block = turnBlocks[i];
      const hasLearner = /\[Learner(?:\s+Ego)?\]/.test(block);
      const hasTutor = /\[Tutor Ego\]/.test(block);
      if (!hasLearner) missingLearner++;
      if (!hasTutor) missingTutor++;
      // B.4 Empty messages
      const labelMatches = block.matchAll(/\[(Learner(?:\s+Ego)?|Tutor Ego)\]\s*/g);
      for (const m of labelMatches) {
        const afterLabel = block.slice(m.index + m[0].length);
        const nextLine = afterLabel.split('\n')[0];
        if (!nextLine || nextLine.trim().length === 0) emptyMessages++;
      }
    }
    if (missingLearner > 0) checks.B.push({ status: FAIL, msg: `learner missing in ${missingLearner} turn(s)` });
    if (missingTutor > 0) checks.B.push({ status: FAIL, msg: `tutor missing in ${missingTutor} turn(s)` });
    if (emptyMessages > 0) checks.B.push({ status: WARN, msg: `${emptyMessages} empty message(s)` });

    // B.5 Turn count matches
    if (publicTurnCount !== turns.length) {
      checks.B.push({ status: WARN, msg: `turn markers(${publicTurnCount}) ≠ expected(${turns.length})` });
    }

    if (checks.B.length === 0) {
      checks.B.push({ status: PASS, msg: `${publicTurnCount} turns, no internal labels` });
    }
  }

  // ─── C. Full Transcript Structural Checks ──────────────────────────────

  fullTranscript = buildDialogueFullTranscript(turns, trace, learnerContext);

  if (fullTranscript === '(no transcript available)') {
    checks.C.push({ status: FAIL, msg: 'full transcript empty' });
  } else {
    const hasMultiAgentTutor = trace.some(
      (e) => (e.agent === 'superego' || e.agent === 'tutor_superego') && e.action === 'review',
    );
    const isMultiAgent = dbIsEgoSuperego || hasMultiAgentTutor;

    // C.1 Has internal deliberation (for multi-agent cells)
    if (isMultiAgent) {
      const hasInternal = INTERNAL_LABELS.some((l) => fullTranscript.includes(l));
      if (!hasInternal) {
        checks.C.push({ status: WARN, msg: 'multi-agent cell but no internal deliberation in full transcript' });
      }
    }

    // C.2 Strictly more content than public
    if (publicTranscript && fullTranscript.length <= publicTranscript.length) {
      // For single-agent cells this can be expected — downgrade to warn
      const status = isMultiAgent ? FAIL : WARN;
      checks.C.push({
        status,
        msg: `full(${fullTranscript.length}) ≤ public(${publicTranscript.length})`,
      });
    }

    // C.3 Same turn count
    const fullTurnCount = countTurnMarkers(fullTranscript);
    const publicTurnCount = countTurnMarkers(publicTranscript || '');
    if (fullTurnCount !== publicTurnCount) {
      checks.C.push({ status: WARN, msg: `full turns(${fullTurnCount}) ≠ public turns(${publicTurnCount})` });
    }

    // C.4 Tutor ego present each turn
    const fullTurnBlocks = fullTranscript.split(/--- Turn \d+ ---/).slice(1);
    let missingTutorFull = 0;
    for (const block of fullTurnBlocks) {
      if (!/\[Tutor Ego\]/.test(block)) missingTutorFull++;
    }
    if (missingTutorFull > 0) {
      checks.C.push({ status: FAIL, msg: `tutor ego missing in ${missingTutorFull} full-transcript turn(s)` });
    }

    if (checks.C.length === 0) {
      const ratio = publicTranscript ? (fullTranscript.length / publicTranscript.length).toFixed(1) : '?';
      const extras = [];
      if (hasMultiAgentTutor) extras.push('tutor superego');
      if (dbIsEgoSuperego) extras.push('learner ego/superego');
      const label = extras.length > 0 ? `has ${extras.join(' + ')}` : 'single-agent';
      checks.C.push({ status: PASS, msg: `${label}, ${ratio}x public` });
    }
  }

  // ─── D. Score Existence & Range ────────────────────────────────────────

  const pubScore = row.dialogueQualityScore;
  const intScore = row.dialogueQualityInternalScore;

  if (pubScore == null) {
    checks.D.push({ status: WARN, msg: 'dialogue_quality_score is NULL' });
  } else if (pubScore < 0 || pubScore > 100) {
    checks.D.push({ status: FAIL, msg: `public score out of range: ${pubScore}` });
  }

  if (intScore == null) {
    checks.D.push({ status: WARN, msg: 'dialogue_quality_internal_score is NULL' });
  } else if (intScore < 0 || intScore > 100) {
    checks.D.push({ status: FAIL, msg: `internal score out of range: ${intScore}` });
  }

  // D.4 Summary non-empty when score non-NULL
  if (pubScore != null && !row.dialogueQualitySummary?.trim()) {
    checks.D.push({ status: WARN, msg: 'public score set but summary empty' });
  }
  if (intScore != null && !row.dialogueQualityInternalSummary?.trim()) {
    checks.D.push({ status: WARN, msg: 'internal score set but summary empty' });
  }

  if (checks.D.length === 0) {
    checks.D.push({ status: PASS, msg: `public=${pubScore}, internal=${intScore}` });
  }

  // ─── E. Semantic Checks (soft, advisory) ───────────────────────────────

  // E.1 Public vs internal delta
  if (pubScore != null && intScore != null) {
    const delta = Math.abs(pubScore - intScore);
    if (delta > 30) {
      checks.E.push({ status: WARN, msg: `large public/internal delta: ${delta.toFixed(1)}` });
    }
  }

  // E.2 Score vs turn count
  if (turns.length >= 4 && pubScore != null && pubScore < 20) {
    checks.E.push({ status: WARN, msg: `4+ turn dialogue but public score only ${pubScore}` });
  }

  // E.3 Learner message variety (for LLM learners)
  const learnerMessages = extractLearnerMessages(trace, turns);
  if (learnerMessages.length >= 2) {
    const unique = new Set(learnerMessages.map((m) => m.trim().toLowerCase()));
    if (unique.size === 1) {
      checks.E.push({ status: WARN, msg: 'all learner messages identical across turns' });
    }
  }

  // E.4 YAML phrase detection
  if (yamlCuePhrases.size > 0) {
    for (const msg of learnerMessages) {
      for (const [phrase, scenarioId] of yamlCuePhrases) {
        if (msg.includes(phrase)) {
          const excerpt = phrase.length > 50 ? phrase.substring(0, 50) + '...' : phrase;
          checks.E.push({ status: WARN, msg: `YAML phrase: "${excerpt}" (from ${scenarioId})` });
          break; // one warning per learner message is enough
        }
      }
    }
  }

  if (checks.E.length === 0) {
    checks.E.push({ status: PASS, msg: 'OK' });
  }

  return { checks, publicTranscript, fullTranscript };
}

/**
 * Extract learner messages from trace (turn 1+, not the initial message).
 */
function extractLearnerMessages(trace, turns) {
  const messages = [];
  for (const entry of trace) {
    // Unified learner: turn_action contextSummary
    if ((entry.agent === 'learner' || entry.agent === 'user') && entry.action === 'turn_action') {
      const msg = entry.contextSummary || entry.detail || '';
      if (msg.trim()) messages.push(msg);
    }
    // Ego-superego learner: synthesis response
    if (entry.agent === 'learner_synthesis' && entry.action === 'response') {
      const msg = entry.detail || entry.contextSummary || '';
      if (msg.trim()) messages.push(msg);
    }
  }
  // Fallback: turnResults learnerMessage
  if (messages.length === 0) {
    for (const turn of turns) {
      if (turn.learnerMessage?.trim()) messages.push(turn.learnerMessage);
    }
  }
  return messages;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const allResults = store.getResults(runId);
if (allResults.length === 0) {
  console.error(`No results found for run ${runId}`);
  process.exit(1);
}

// Filter to multi-turn rows (suggestions is a parsed array with length > 1)
let rows = allResults.filter((r) => {
  const suggs = r.suggestions;
  return Array.isArray(suggs) && suggs.length > 1;
});

if (profileFilter) {
  rows = rows.filter((r) => r.profileName?.includes(profileFilter));
}

if (rows.length === 0) {
  console.error(`No multi-turn rows found for run ${runId}${profileFilter ? ` (profile: ${profileFilter})` : ''}`);
  console.error(`  Total rows in run: ${allResults.length}`);
  process.exit(1);
}

console.log(`Checking run ${runId} (${rows.length} multi-turn rows)...\n`);

// Track aggregates
const categoryCounts = {
  A: { pass: 0, warn: 0, fail: 0 },
  B: { pass: 0, warn: 0, fail: 0 },
  C: { pass: 0, warn: 0, fail: 0 },
  D: { pass: 0, warn: 0, fail: 0 },
  E: { pass: 0, warn: 0, fail: 0 },
};
let totalPass = 0;
let totalWarn = 0;
let totalFail = 0;

// D.5 Judge model consistency
const judgeModels = new Set();

for (const row of rows) {
  const { checks, publicTranscript, fullTranscript } = checkRow(row);

  if (row.dialogueQualityJudgeModel) judgeModels.add(row.dialogueQualityJudgeModel);

  // Determine overall row status
  const allChecks = [...checks.A, ...checks.B, ...checks.C, ...checks.D, ...checks.E];
  const hasFail = allChecks.some((c) => c.status === FAIL);
  const hasWarn = allChecks.some((c) => c.status === WARN);
  if (hasFail) totalFail++;
  else if (hasWarn) totalWarn++;
  else totalPass++;

  // Per-category aggregation
  for (const cat of ['A', 'B', 'C', 'D', 'E']) {
    const worst = checks[cat].reduce((w, c) => {
      if (c.status === FAIL) return FAIL;
      if (c.status === WARN && w !== FAIL) return WARN;
      return w;
    }, PASS);
    if (worst === FAIL) categoryCounts[cat].fail++;
    else if (worst === WARN) categoryCounts[cat].warn++;
    else categoryCounts[cat].pass++;
  }

  // Skip passing rows in failures-only mode
  if (failuresOnly && !hasFail && !hasWarn) continue;

  // Print row
  const shortId = String(row.id).substring(0, 8);
  const profile = row.profileName || '?';
  const scenario = row.scenarioId || '?';
  console.log(`  ${shortId} | ${profile} | ${scenario}`);

  const categoryLabels = {
    A: 'Log integrity',
    B: 'Public transcript',
    C: 'Full transcript',
    D: 'Scores',
    E: 'Semantic',
  };

  for (const cat of ['A', 'B', 'C', 'D', 'E']) {
    const worst = checks[cat].reduce((w, c) => {
      if (c.status === FAIL) return FAIL;
      if (c.status === WARN && w !== FAIL) return WARN;
      return w;
    }, PASS);
    const msgs = checks[cat].map((c) => c.msg).join('; ');
    const pad = categoryLabels[cat].padEnd(20);
    console.log(`    ${cat}. ${pad} ${worst} ${msgs}`);
  }

  if (verbose && publicTranscript) {
    console.log('\n    ── Public Transcript ──');
    for (const line of publicTranscript.split('\n')) {
      console.log(`    ${line}`);
    }
  }
  if (verbose && fullTranscript) {
    console.log('\n    ── Full Transcript ──');
    for (const line of fullTranscript.split('\n')) {
      console.log(`    ${line}`);
    }
  }

  console.log('');
}

// D.5 Judge model consistency warning
if (judgeModels.size > 1) {
  console.log(`  ${WARN} Mixed judge models: ${[...judgeModels].join(', ')}\n`);
}

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log(`Summary: ${rows.length} rows | ${totalPass} pass | ${totalWarn} warn | ${totalFail} fail`);

const categoryLabels = { A: 'Log integrity', B: 'Public transcript', C: 'Full transcript', D: 'Scores', E: 'Semantic' };
for (const cat of ['A', 'B', 'C', 'D', 'E']) {
  const c = categoryCounts[cat];
  const extras = [];
  if (c.fail > 0) extras.push(`${c.fail} fail`);
  if (c.warn > 0) extras.push(`${c.warn} warn`);
  const suffix = extras.length > 0 ? ` (${extras.join(', ')})` : '';
  console.log(`  ${cat}. ${categoryLabels[cat].padEnd(20)} ${c.pass}/${rows.length}${suffix}`);
}
