#!/usr/bin/env node
/**
 * ingest-pilot-sessions — A1 human-learner pilot transcript ingestion
 *
 * For each completed `pilot_sessions` row, materializes:
 *   1. A dialogue log file at `logs/tutor-dialogues/pilot-{sessionId}.json`
 *      whose `turns[]` and `dialogueTrace[]` mirror the format produced by
 *      the multi-turn eval runner. This is what `eval-cli.js evaluate` reads
 *      via `evaluationStore.loadDialogueLog`.
 *   2. A row in `evaluation_results` with `learner_architecture = 'human_pilot'`,
 *      score columns NULL, and `learner_id = pilot.sessionId` (used for
 *      idempotency on re-ingestion).
 *
 * After ingestion, `node scripts/eval-cli.js evaluate <runId>` will score
 * the human transcripts using the same v2.2 rubric apparatus the synthetic
 * runs use — enabling the §4.3 mediator analysis (per-participant LLM-judged
 * tutor quality vs per-participant pre/post learning gain).
 *
 * Usage:
 *   node scripts/ingest-pilot-sessions.js                  # ingest all completed
 *   node scripts/ingest-pilot-sessions.js --dry-run        # show what would happen
 *   node scripts/ingest-pilot-sessions.js --session <id>   # one specific session
 *   node scripts/ingest-pilot-sessions.js --run-id <runId> # append to an existing pilot run
 *
 * Idempotency: a session whose ID is already present as `learner_id` on any
 * row in `evaluation_results` is skipped. Re-ingestion is safe.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';

import * as pilotStore from '../services/pilotStore.js';
import * as evaluationStore from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_ROOT = process.env.EVAL_LOGS_DIR || path.join(ROOT_DIR, 'logs');
const DIALOGUE_LOGS_DIR = path.join(LOGS_ROOT, 'tutor-dialogues');

// ─── CLI parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { dryRun: false, sessionId: null, runId: null, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--force') out.force = true;
    else if (a === '--session') out.sessionId = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`
ingest-pilot-sessions — bring completed pilot sessions into evaluation_results

Usage:
  node scripts/ingest-pilot-sessions.js [options]

Options:
  --dry-run             Print what would be ingested, without writing
  --session <id>        Ingest only the specified pilot session
  --run-id <runId>      Append to an existing pilot evaluation run
                        (default: creates a new run dated today)
  --force               Re-ingest sessions even if already present
  -h, --help            Show this help

Output: a run ID. Then run:
  node scripts/eval-cli.js evaluate <runId>
`);
      process.exit(0);
    }
  }
  return out;
}

// ─── Idempotency ──────────────────────────────────────────────────────────

const dbPath = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');
const db = new Database(dbPath, { readonly: false });
db.pragma('journal_mode = WAL');

function findExistingIngestion(sessionId) {
  return db
    .prepare(
      `SELECT id, run_id, dialogue_id FROM evaluation_results
       WHERE learner_id = ? AND learner_architecture = 'human_pilot'
       LIMIT 1`,
    )
    .get(sessionId);
}

// ─── Pair turns (learner → tutor) ─────────────────────────────────────────

function pairTurns(turns) {
  // pilot_turns alternates learner, tutor, learner, tutor, ...
  // If the participant typed but the timer expired before the tutor replied,
  // there will be an orphan learner turn at the end — skip it.
  const pairs = [];
  let i = 0;
  while (i < turns.length - 1) {
    const a = turns[i];
    const b = turns[i + 1];
    if (a.role === 'learner' && b.role === 'tutor') {
      pairs.push({ learner: a, tutor: b });
      i += 2;
    } else {
      // Out of order — skip and try again
      i += 1;
    }
  }
  return pairs;
}

// ─── Build dialogue log file ──────────────────────────────────────────────

function parseDeliberation(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function buildDialogueLog(session, turns, profile) {
  const pairs = pairTurns(turns);
  const dialogueId = `pilot-${session.id}`;

  // turns[]: parallel structure consumed by buildDialoguePublicTranscript and
  // the per-turn tutor scorer.
  const turnsArr = pairs.map((p, idx) => {
    const tutorMessage = p.tutor.content || '';
    return {
      turnIndex: idx,
      learnerMessage: p.learner.content || '',
      suggestion: {
        type: 'response',
        title: `Pilot turn ${idx + 1}`,
        message: tutorMessage,
      },
      suggestions: [{
        type: 'response',
        title: `Pilot turn ${idx + 1}`,
        message: tutorMessage,
      }],
    };
  });

  const dialogueTrace = [];
  pairs.forEach((p, idx) => {
    const round = idx;
    const learnerText = p.learner.content || '';
    const tutorText = p.tutor.content || '';

    dialogueTrace.push({
      round,
      agent: 'learner',
      action: 'turn_action',
      turnIndex: idx,
      direction: 'input',
      contextSummary: learnerText,
      detail: 'response',
    });

    dialogueTrace.push({
      round,
      agent: 'tutor',
      action: 'context_input',
      turnIndex: idx,
      direction: 'input',
      from: 'system',
      to: 'ego',
      rawContext: [
        `A1 Pilot tutoring session for participant ${session.id}.`,
        `Domain: fractions (lecture ${session.scenario_lecture_ref}).`,
        `Learner said: "${learnerText}"`,
      ].join('\n'),
    });

    dialogueTrace.push({
      round,
      agent: 'ego',
      action: 'generate',
      turnIndex: idx,
      direction: 'request',
      from: 'ego',
      to: 'tutor',
      suggestions: [{ type: 'response', message: tutorText }],
      latencyMs: p.tutor.latency_ms || null,
      provider: profile.ego?.provider || null,
      metrics: {
        model: p.tutor.ego_model || profile.ego?.model || null,
        provider: profile.ego?.provider || null,
        latencyMs: p.tutor.latency_ms || null,
        inputTokens: p.tutor.input_tokens || 0,
        outputTokens: p.tutor.output_tokens || 0,
      },
    });

    // Superego review (if recorded in deliberation)
    const delib = parseDeliberation(p.tutor.deliberation);
    const superegoEntry = delib.find((d) => d.role === 'superego');
    if (superegoEntry) {
      dialogueTrace.push({
        round,
        agent: 'superego',
        action: 'review',
        turnIndex: idx,
        direction: 'response',
        from: 'superego',
        to: 'ego',
        content: superegoEntry.content || '',
        metrics: {
          model: p.tutor.superego_model || profile.superego?.model || null,
          provider: profile.superego?.provider || null,
          latencyMs: superegoEntry.latencyMs || null,
          inputTokens: superegoEntry.inputTokens || 0,
          outputTokens: superegoEntry.outputTokens || 0,
        },
      });
    }

    dialogueTrace.push({
      round,
      agent: 'tutor',
      action: 'final_output',
      turnIndex: idx,
      direction: 'output',
      from: 'tutor',
      to: 'learner',
      content: tutorText,
      wasRevised: !!p.tutor.was_revised,
    });
  });

  const totals = {
    totalLatencyMs: pairs.reduce((s, p) => s + (p.tutor.latency_ms || 0), 0),
    totalInputTokens: pairs.reduce((s, p) => s + (p.tutor.input_tokens || 0), 0),
    totalOutputTokens: pairs.reduce((s, p) => s + (p.tutor.output_tokens || 0), 0),
    apiCalls: pairs.length,
    totalCost: 0,
  };

  // Top-level `suggestions` mirrors the last tutor message — required by the
  // single-row scorer fallback and the legacy renderers.
  const lastSuggestions = turnsArr[turnsArr.length - 1]?.suggestions || [];

  return {
    dialogueId,
    scenarioId: session.scenario_lecture_ref,
    profileName: session.condition_cell,
    conversationMode: 'messages',
    rounds: pairs.length,
    turns: turnsArr,
    dialogueTrace,
    suggestions: lastSuggestions,
    converged: true,
    metrics: totals,
    pilot: {
      sessionId: session.id,
      conditionCell: session.condition_cell,
      participantPidHash: session.participant_pid_hash,
      tutoringStartedAt: session.tutoring_started_at,
      tutoringCompletedAt: session.tutoring_completed_at,
      totalTutoringMs: session.total_tutoring_ms,
      pretestForm: null,        // resolved separately if needed by joins
      posttestForm: null,
    },
  };
}

// ─── Build evaluation_results row payload ─────────────────────────────────

function buildResultPayload(session, turns, profile, dialogueLog) {
  const last = turns[turns.length - 1] || null;
  const totals = dialogueLog.metrics;
  const pairs = dialogueLog.rounds;

  return {
    scenarioId: session.scenario_lecture_ref,
    scenarioName: 'A1 fractions tutoring (human pilot)',
    scenarioType: 'multi-turn',
    provider: profile.ego?.provider || null,
    model: profile.ego?.model || null,
    profileName: session.condition_cell,
    hyperparameters: profile.ego?.hyperparameters || {},
    promptId: profile.ego?.prompt_file || null,
    egoModel: profile.ego?.model || null,
    superegoModel: profile.superego?.model || null,
    suggestions: dialogueLog.suggestions,
    rawResponse: null,
    latencyMs: totals.totalLatencyMs,
    inputTokens: totals.totalInputTokens,
    outputTokens: totals.totalOutputTokens,
    cost: totals.totalCost || 0,
    dialogueRounds: pairs,
    apiCalls: totals.apiCalls,
    dialogueId: dialogueLog.dialogueId,
    dialogueContentHash: last?.dialogue_content_hash || null,
    configHash: last?.config_hash || null,
    learnerId: session.id,
    learnerArchitecture: 'human_pilot',
    conversationMode: 'messages',
    factors: {
      recognition: !!profile.recognition_mode,
      multi_agent_tutor: !!profile.factors?.multi_agent_tutor,
      multi_agent_learner: false, // pilot is human
    },
    success: true,
    passesRequired: true,
    passesForbidden: true,
    requiredMissing: [],
    forbiddenFound: [],
  };
}

// ─── Main ingestion ───────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(DIALOGUE_LOGS_DIR)) {
    fs.mkdirSync(DIALOGUE_LOGS_DIR, { recursive: true });
  }

  const tutorAgents = evalConfigLoader.loadTutorAgents();
  const profiles = tutorAgents?.profiles || {};

  // Pull eligible sessions
  let sessions;
  if (args.sessionId) {
    const s = pilotStore.getSession(args.sessionId);
    sessions = s ? [s] : [];
    if (!sessions.length) {
      console.error(`Session ${args.sessionId} not found`);
      process.exit(1);
    }
  } else {
    sessions = pilotStore.listSessions({ status: 'completed', limit: 1000 });
  }

  if (sessions.length === 0) {
    console.log('No completed pilot sessions found.');
    process.exit(0);
  }

  // Filter for already-ingested sessions
  const eligible = [];
  const skipped = [];
  for (const s of sessions) {
    const existing = findExistingIngestion(s.id);
    if (existing && !args.force) {
      skipped.push({ session: s, existing });
      continue;
    }
    eligible.push(s);
  }

  if (eligible.length === 0 && !args.force) {
    console.log(`All ${sessions.length} session(s) already ingested.`);
    if (skipped.length) {
      const runIds = [...new Set(skipped.map((s) => s.existing.run_id))];
      console.log(`Existing run ID(s): ${runIds.join(', ')}`);
    }
    process.exit(0);
  }

  console.log(`Eligible sessions: ${eligible.length}${skipped.length ? ` (skipping ${skipped.length} already-ingested)` : ''}`);
  if (args.dryRun) {
    for (const s of eligible) {
      const turns = pilotStore.listTurns(s.id);
      const pairs = pairTurns(turns);
      console.log(`  ${s.id}  cell=${s.condition_cell}  pairs=${pairs.length}  total_ms=${s.total_tutoring_ms}`);
    }
    console.log('\n(dry run — no files written, no DB writes)');
    process.exit(0);
  }

  // Resolve or create run
  let runId = args.runId;
  if (!runId) {
    const date = new Date().toISOString().slice(0, 10);
    const conditionCounts = {};
    for (const s of eligible) {
      conditionCounts[s.condition_cell] = (conditionCounts[s.condition_cell] || 0) + 1;
    }
    const run = evaluationStore.createRun({
      description: `A1 human pilot ingestion ${date} (${eligible.length} sessions)`,
      totalScenarios: 1,
      totalConfigurations: Object.keys(conditionCounts).length,
      metadata: {
        kind: 'human_pilot',
        source: 'pilot_sessions',
        ingestedAt: new Date().toISOString(),
        conditionCounts,
        gitCommit: null,
      },
    });
    runId = run.id;
    console.log(`Created run: ${runId}`);
  } else {
    const existing = evaluationStore.getRun(runId);
    if (!existing) {
      console.error(`Run ${runId} not found`);
      process.exit(1);
    }
    console.log(`Appending to existing run: ${runId}`);
  }

  let inserted = 0;
  let logsWritten = 0;
  for (const session of eligible) {
    const turns = pilotStore.listTurns(session.id);
    if (turns.length < 2) {
      console.log(`  skip ${session.id}: only ${turns.length} turn(s)`);
      continue;
    }
    const profile = profiles[session.condition_cell];
    if (!profile) {
      console.warn(`  skip ${session.id}: cell ${session.condition_cell} not found in tutor-agents.yaml`);
      continue;
    }

    const dialogueLog = buildDialogueLog(session, turns, profile);
    if (dialogueLog.rounds === 0) {
      console.log(`  skip ${session.id}: no learner→tutor pairs`);
      continue;
    }

    const logPath = path.join(DIALOGUE_LOGS_DIR, `${dialogueLog.dialogueId}.json`);
    fs.writeFileSync(logPath, JSON.stringify(dialogueLog, null, 2));
    logsWritten++;

    const payload = buildResultPayload(session, turns, profile, dialogueLog);
    const rowId = evaluationStore.storeResult(runId, payload);
    inserted++;
    console.log(`  ✓ ${session.id}  cell=${session.condition_cell}  pairs=${dialogueLog.rounds}  → row ${rowId}`);
  }

  evaluationStore.updateRun(runId, {
    status: 'completed',
    totalTests: inserted,
    completedAt: new Date().toISOString(),
  });

  console.log(`\nIngested ${inserted} session(s); wrote ${logsWritten} dialogue log file(s).`);
  console.log(`\nNext: node scripts/eval-cli.js evaluate ${runId}`);
}

// Only run when invoked as a script, not when imported (e.g. by tests).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[ingest-pilot-sessions] error:', err);
    process.exit(1);
  });
}

export { pairTurns, buildDialogueLog, buildResultPayload };
