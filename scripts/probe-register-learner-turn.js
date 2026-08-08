#!/usr/bin/env node
/**
 * Does the learner's own message pull the tutor out of the register?
 *
 * The first probe sent each flat turn's shipped prompt to the writer alone and
 * got 23 of 35 back edged. That ruled the prompt out for most rows and left
 * three suspects: the reviewer pass, the earlier turns, and the learner's
 * message itself. Two of the three are already dead, and neither needed a call:
 *
 *   The reviewer. Of the 23 rows that came back edged alone, the stored trace
 *   shows the reviewer passed 20 of them untouched. It cannot have flattened a
 *   turn it never rewrote.
 *
 *   The earlier turns. These cells run in single-prompt mode, and on that path
 *   `extractLearnerInputs` returns an empty message history with the comment
 *   "ego call should NOT receive a messageHistory in this path". The tutor
 *   never saw the earlier turns.
 *
 * What is left is the one input the first probe dropped: in the run the shipped
 * prompt sits in the system slot and the learner's message arrives as the user
 * turn. The probe sent the prompt alone, with no learner in the room.
 *
 * Pre-registered before any call:
 *
 * SET. Rows the first probe read as edged when sent alone, whose reviewer left
 * the text alone, and whose stored writer is the writer used here. Any row
 * failing one of those is dropped and counted, not quietly patched.
 *
 * TREATMENT. The run's own ego call, rebuilt: system prompt = that turn's
 * shipped prompt, unedited; user message = that turn's learner message; no
 * message history, matching the run. Same writer, same bridge, same role.
 *
 * MEASURE. The same pinned reader and the same versioned question as both
 * earlier readings, over the same learner turn.
 *
 * READS AS. Replies go flat -> the learner's message is what sands the manner
 * off, and a prompt that survives on its own does not survive a learner asking
 * for something else. Replies stay edged -> the ego call reproduces the edge
 * from the run's own inputs, the loss is somewhere not yet named, and this
 * probe has not found it.
 *
 * LIMIT. The prompts here are the ones that shipped before the manner block was
 * appended, so this measures the old pipeline. It says nothing about whether
 * the appended block holds up against a learner; that needs a fresh run.
 *
 * Replies are cached under a hash of both prompts and the writer, so a re-run
 * costs nothing.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';
import { MANNER_PRESENCE_PROMPT_VERSION } from '../services/registerMannerPresence.js';
import { presenceReaderLabel, readMannerPresence } from '../services/registerMannerPresenceReader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PROBE_VERSION = 'register-learner-turn/1.0';
export const WRITER = Object.freeze({ provider: 'codex', model: 'gpt-5.5' });
export const WRITER_LABEL = `${WRITER.provider}.${WRITER.model}`;

export function learnerTurnCacheDir(env = process.env) {
  if (env.REGISTER_LEARNER_TURN_CACHE_DIR) return path.resolve(env.REGISTER_LEARNER_TURN_CACHE_DIR);
  if (env.EVAL_EXPORTS_DIR) return path.resolve(env.EVAL_EXPORTS_DIR, 'register-learner-turn');
  return path.join(ROOT, 'exports', 'register-learner-turn');
}

export function learnerTurnCacheKey({ systemPrompt, userPrompt }) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        probeVersion: PROBE_VERSION,
        writer: WRITER_LABEL,
        systemPrompt: String(systemPrompt || '').trim(),
        userPrompt: String(userPrompt || '').trim(),
      }),
    )
    .digest('hex');
}

/** Did the reviewer leave this turn's text as the tutor wrote it? */
export function reviewerLeftTextAlone(entry) {
  const verification = entry?.agencyReturnVerification;
  if (!verification) return true;
  if (verification.passes === true) return true;
  return entry?.agencyReturnRepaired !== true;
}

/**
 * The set, fixed before any call.
 *
 * `isolationRows` are the first probe's results; `learnerByRow` carries the
 * learner turn each row was read against, so all three readings ask about the
 * same learner move.
 */
export function selectLearnerTurnTargets({ isolationRows, learnerByRow, db }) {
  const targets = [];
  const dropped = { flatAlone: 0, reviewerRewrote: 0, noTrace: 0, otherWriter: 0, noLearnerTurn: 0 };
  for (const row of isolationRows || []) {
    if (row?.reading?.status !== 'present') {
      dropped.flatAlone += 1;
      continue;
    }
    const stored = db
      .prepare('SELECT ego_model, id_construction_trace FROM evaluation_results WHERE id = ?')
      .get(row.rowId);
    if (String(stored?.ego_model || '') !== WRITER_LABEL) {
      dropped.otherWriter += 1;
      continue;
    }
    let trace = null;
    try {
      trace = stored?.id_construction_trace ? JSON.parse(stored.id_construction_trace) : null;
    } catch {
      trace = null;
    }
    const entry = Array.isArray(trace) ? trace.find((e) => Number(e?.turn) === Number(row.resistanceTurn)) : null;
    const systemPrompt = entry?.construction?.generated_prompt;
    if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
      dropped.noTrace += 1;
      continue;
    }
    if (!reviewerLeftTextAlone(entry)) {
      dropped.reviewerRewrote += 1;
      continue;
    }
    const learnerMessage = String(learnerByRow.get(row.rowId) || '');
    if (!learnerMessage.trim()) {
      dropped.noLearnerTurn += 1;
      continue;
    }
    targets.push({
      rowId: row.rowId,
      runId: row.runId,
      scenarioId: row.scenarioId,
      registerName: row.registerName,
      resistanceTurn: row.resistanceTurn,
      aloneStatus: row.reading.status,
      systemPrompt,
      learnerMessage,
    });
  }
  return { targets, dropped };
}

export function planSignature(targets) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        targets.map((t) => [
          t.rowId,
          learnerTurnCacheKey({ systemPrompt: t.systemPrompt, userPrompt: t.learnerMessage }),
        ]),
      ),
    )
    .digest('hex');
}

async function writeReplyWithLearner({ systemPrompt, userPrompt, cacheDir, timeoutMs }) {
  const key = learnerTurnCacheKey({ systemPrompt, userPrompt });
  const file = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(file)) {
    return { ...JSON.parse(fs.readFileSync(file, 'utf8')), fromCache: true };
  }
  // Same shape as the run's ego call: system prompt, learner turn, no history.
  const response = await callAIWithCliBridge(
    { provider: WRITER.provider, model: WRITER.model },
    systemPrompt,
    userPrompt,
    'tutor_ego',
    { timeoutMs },
  );
  const record = {
    schema: 'machinespirits.register-learner-turn-reply.v1',
    probeVersion: PROBE_VERSION,
    writer: WRITER_LABEL,
    cacheKey: key,
    reply: String(response?.text || '').trim(),
  };
  // A failed call throws before here, so only real replies land in the cache.
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return { ...record, fromCache: false };
}

function summarize(rows) {
  const counts = { present: 0, absent: 0, unread: 0 };
  const byRegister = new Map();
  for (const row of rows) {
    const status = row.reading.status;
    counts[status] = (counts[status] || 0) + 1;
    if (!byRegister.has(row.registerName)) {
      byRegister.set(row.registerName, { register: row.registerName, present: 0, absent: 0, unread: 0 });
    }
    byRegister.get(row.registerName)[status] += 1;
  }
  return { counts, byRegister: [...byRegister.values()] };
}

export async function runLearnerTurnProbe({
  isolationPath,
  limit = null,
  dryRun = false,
  timeoutMs = 600_000,
  readerTimeoutMs = 600_000,
  log = console.log,
} = {}) {
  const opened = openEvaluationDbReadonly();
  if (!opened.db) throw new Error(describeMissingEvaluationDb(opened));
  const { db } = opened;

  const isolation = JSON.parse(fs.readFileSync(isolationPath, 'utf8'));
  const learnerByRow = new Map((isolation.targets || []).map((t) => [t.rowId, t.learnerMessage]));
  const { targets, dropped } = selectLearnerTurnTargets({
    isolationRows: isolation.rows || [],
    learnerByRow,
    db,
  });
  const signature = planSignature(targets);

  log(`probe        ${PROBE_VERSION}`);
  log(`writer       ${WRITER_LABEL}  (the model that wrote the stored turns)`);
  log(`reader       ${presenceReaderLabel()}  question ${MANNER_PRESENCE_PROMPT_VERSION}`);
  log(`set          ${targets.length} turns that were edged alone and untouched by the reviewer`);
  log(
    `dropped      ${dropped.flatAlone} flat when sent alone, ${dropped.reviewerRewrote} reviewer rewrote the turn, ` +
      `${dropped.noTrace} no shipped prompt, ${dropped.otherWriter} a different writer, ${dropped.noLearnerTurn} no learner turn`,
  );
  log(`plan sha256  ${signature}`);

  if (dryRun) {
    log('\ndry run — no calls made');
    return { signature, targets, dropped, rows: [], dryRun: true };
  }

  const cacheDir = learnerTurnCacheDir();
  const slice = Number.isInteger(limit) && limit > 0 ? targets.slice(0, limit) : targets;
  const rows = [];
  let index = 0;
  for (const target of slice) {
    index += 1;
    const written = await writeReplyWithLearner({
      systemPrompt: target.systemPrompt,
      userPrompt: target.learnerMessage,
      cacheDir,
      timeoutMs,
    });
    const { reading } = await readMannerPresence({
      registerName: target.registerName,
      learnerMessage: target.learnerMessage,
      tutorMessage: written.reply,
      timeoutMs: readerTimeoutMs,
    });
    rows.push({
      rowId: target.rowId,
      runId: target.runId,
      scenarioId: target.scenarioId,
      registerName: target.registerName,
      resistanceTurn: target.resistanceTurn,
      aloneStatus: target.aloneStatus,
      reply: written.reply,
      fromCache: written.fromCache,
      reading,
    });
    log(
      `[${index}/${slice.length}] row ${target.rowId} ${target.registerName.padEnd(22)} ` +
        `alone:${target.aloneStatus} with learner:${reading.status}${written.fromCache ? '  (reply cached)' : ''}`,
    );
  }

  const summary = summarize(rows);
  log(
    `\nwith the learner in the room: ${summary.counts.present} edged, ${summary.counts.absent} flat, ` +
      `${summary.counts.unread} unread  (all ${rows.length} were edged when sent alone)`,
  );
  for (const bucket of summary.byRegister) {
    log(`  ${bucket.register.padEnd(22)} ${bucket.present} edged / ${bucket.present + bucket.absent + bucket.unread}`);
  }
  return { signature, targets, dropped, rows, summary, dryRun: false };
}

async function main() {
  const { values } = parseArgs({
    options: {
      isolation: { type: 'string' },
      limit: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      out: { type: 'string' },
      'timeout-ms': { type: 'string' },
    },
  });
  if (!values.isolation) {
    console.error(
      'usage: node scripts/probe-register-learner-turn.js --isolation <prompt-isolation json> [--dry-run] [--limit N] [--out file]',
    );
    process.exit(2);
  }
  const result = await runLearnerTurnProbe({
    isolationPath: path.resolve(values.isolation),
    limit: values.limit ? Number.parseInt(values.limit, 10) : null,
    dryRun: values['dry-run'],
    timeoutMs: values['timeout-ms'] ? Number.parseInt(values['timeout-ms'], 10) : undefined,
  });
  if (values.out && !result.dryRun) {
    const outPath = path.resolve(values.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`\nwrote ${outPath}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
