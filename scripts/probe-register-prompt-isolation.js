#!/usr/bin/env node
/**
 * Does the manner survive when the prompt is sent on its own?
 *
 * The stored runs write flat turns in registers that ask for an edge: of 62
 * stored turns in edged registers, a pinned reader found an edge in 24 and none
 * in 38. A hand-marked set showed the same writer can do it — asked cleanly,
 * with no cue phrases, ten of ten ironic and sarcastic prompts came back edged.
 * So the loss happens somewhere between the two settings, and this probe cuts
 * the candidates in half.
 *
 * Pre-registered before any call:
 *
 * SET. Every stored turn the presence reader called `absent` whose own shipped
 * prompt names the manner. Turns whose prompt never asked for an edge are
 * excluded, because a flat reply there proves nothing. The count is printed by
 * `--dry-run` and fixed before the first call.
 *
 * TREATMENT. That turn's exact shipped prompt, sent to the same writer that
 * produced the stored turn (`codex.gpt-5.5`), alone: no earlier turns, no
 * reviewer pass, no scenario wrapper. Nothing in the prompt is edited.
 *
 * MEASURE. The same pinned reader and the same versioned question that judged
 * the stored turn, over the same learner turn. One instrument on both sides, so
 * the two readings can be set against each other.
 *
 * READS AS. Replies come back edged -> the prompt was enough and something in
 * the harness sands the manner off. Replies stay flat -> the prompt itself is
 * the problem, and the manner line is drowned by everything else in it.
 *
 * LIMIT. Sending the prompt alone drops the earlier turns as well as the
 * reviewer, so an edged result does not separate those two. It does separate
 * both from the prompt.
 *
 * Writer replies are cached under a hash of the prompt and the model, so
 * re-running costs nothing. `--limit` runs the set in pieces.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { analyzeCharismaDesireRuns } from './report-charisma-desire-breakthrough-matrix.js';
import { callModelCliText } from '../services/cliProviderBridge.js';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';
import { MANNER_PRESENCE_PROMPT_VERSION } from '../services/registerMannerPresence.js';
import { presenceReaderLabel, readMannerPresence } from '../services/registerMannerPresenceReader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PROBE_VERSION = 'register-prompt-isolation/1.0';
export const WRITER = Object.freeze({ provider: 'codex', model: 'gpt-5.5' });

/** Words that mean the prompt asked for an edge. Kept wide on purpose: this
 * screens rows in, and a row wrongly screened in only makes the probe harder to
 * pass. */
const MANNER_NAMED = /iron(y|ic)|sarcas|deadpan|mock|understate|feign|edge|barb|withering|dry wit/i;

export function promptNamesManner(prompt) {
  return MANNER_NAMED.test(String(prompt || ''));
}

export function isolationCacheDir(env = process.env) {
  if (env.REGISTER_ISOLATION_CACHE_DIR) return path.resolve(env.REGISTER_ISOLATION_CACHE_DIR);
  if (env.EVAL_EXPORTS_DIR) return path.resolve(env.EVAL_EXPORTS_DIR, 'register-prompt-isolation');
  return path.join(ROOT, 'exports', 'register-prompt-isolation');
}

export function isolationCacheKey({ prompt, writer }) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        probeVersion: PROBE_VERSION,
        writer: `${writer.provider}.${writer.model}`,
        prompt: String(prompt || '').trim(),
      }),
    )
    .digest('hex');
}

/**
 * The stored turn's own shipped prompt, pulled from the id-director trace for
 * the turn the reader judged. Returns null when the trace has no entry for that
 * turn, which drops the row rather than guessing at a neighbour.
 */
export function shippedPromptFor(trace, turn) {
  const entries = Array.isArray(trace) ? trace : null;
  if (!entries) return null;
  const entry = entries.find((e) => Number(e?.turn) === Number(turn));
  const prompt = entry?.construction?.generated_prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt : null;
}

/**
 * The set, fixed before any call.
 *
 * `analyses` supplies the learner turn, so the reader is asked about the same
 * learner move on both sides; a row whose learner turn cannot be recovered is
 * dropped rather than read against an empty one.
 */
export function selectIsolationTargets({ readings, analyses, db }) {
  const learnerByRow = new Map((analyses || []).map((row) => [row.rowId, String(row.preLearner || '')]));
  const targets = [];
  const dropped = { notAbsent: 0, noTrace: 0, promptSilentOnManner: 0, noLearnerTurn: 0 };
  for (const reading of readings) {
    if (reading.status !== 'absent') {
      dropped.notAbsent += 1;
      continue;
    }
    const row = db.prepare('SELECT id_construction_trace FROM evaluation_results WHERE id = ?').get(reading.rowId);
    let trace = null;
    try {
      trace = row?.id_construction_trace ? JSON.parse(row.id_construction_trace) : null;
    } catch {
      trace = null;
    }
    const prompt = shippedPromptFor(trace, reading.resistanceTurn);
    if (!prompt) {
      dropped.noTrace += 1;
      continue;
    }
    if (!promptNamesManner(prompt)) {
      dropped.promptSilentOnManner += 1;
      continue;
    }
    const learnerMessage = learnerByRow.get(reading.rowId) || '';
    if (!learnerMessage.trim()) {
      dropped.noLearnerTurn += 1;
      continue;
    }
    targets.push({
      rowId: reading.rowId,
      runId: reading.runId,
      scenarioId: reading.scenarioId,
      registerName: reading.registerName,
      resistanceTurn: reading.resistanceTurn,
      learnerMessage,
      prompt,
    });
  }
  return { targets, dropped };
}

/** A stable hash over the whole plan, so a dry run and a live run can be shown
 * to have covered the same set. */
export function planSignature(targets) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(targets.map((t) => [t.rowId, isolationCacheKey({ prompt: t.prompt, writer: WRITER })])))
    .digest('hex');
}

async function writeIsolatedReply({ prompt, cacheDir, timeoutMs }) {
  const key = isolationCacheKey({ prompt, writer: WRITER });
  const file = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(file)) {
    return { ...JSON.parse(fs.readFileSync(file, 'utf8')), fromCache: true };
  }
  const text = await callModelCliText({
    provider: WRITER.provider,
    model: WRITER.model,
    prompt,
    role: 'register-prompt-isolation',
    timeoutMs,
  });
  const record = {
    schema: 'machinespirits.register-prompt-isolation-reply.v1',
    probeVersion: PROBE_VERSION,
    writer: `${WRITER.provider}.${WRITER.model}`,
    cacheKey: key,
    reply: String(text || '').trim(),
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
    const bucket = byRegister.get(row.registerName);
    bucket[status] += 1;
  }
  return { counts, byRegister: [...byRegister.values()] };
}

export async function runIsolationProbe({
  readingsPath,
  limit = null,
  dryRun = false,
  timeoutMs = 600_000,
  readerTimeoutMs = 600_000,
  log = console.log,
} = {}) {
  const opened = openEvaluationDbReadonly();
  if (!opened.db) throw new Error(describeMissingEvaluationDb(opened));
  const { db } = opened;

  const stored = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
  const { targets, dropped } = selectIsolationTargets({
    readings: stored.readings || [],
    analyses: analyzeCharismaDesireRuns(stored.runIds || []),
    db,
  });
  const signature = planSignature(targets);

  log(`probe        ${PROBE_VERSION}`);
  log(`writer       ${WRITER.provider}.${WRITER.model}  (same writer that produced the stored turns)`);
  log(`reader       ${presenceReaderLabel()}  question ${MANNER_PRESENCE_PROMPT_VERSION}`);
  log(`set          ${targets.length} flat turns whose own prompt names the manner`);
  log(
    `dropped      ${dropped.notAbsent} not flat, ${dropped.noTrace} no shipped prompt, ` +
      `${dropped.promptSilentOnManner} prompt never asked for an edge, ${dropped.noLearnerTurn} no learner turn`,
  );
  log(`plan sha256  ${signature}`);

  if (dryRun) {
    log('\ndry run — no calls made');
    return { signature, targets, dropped, rows: [], dryRun: true };
  }

  const cacheDir = isolationCacheDir();
  const slice = Number.isInteger(limit) && limit > 0 ? targets.slice(0, limit) : targets;
  const rows = [];
  let index = 0;
  for (const target of slice) {
    index += 1;
    const written = await writeIsolatedReply({ prompt: target.prompt, cacheDir, timeoutMs });
    const reading = await readMannerPresence({
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
      reply: written.reply,
      fromCache: written.fromCache,
      reading,
    });
    log(
      `[${index}/${slice.length}] row ${target.rowId} ${target.registerName.padEnd(22)} ${reading.status}` +
        `${written.fromCache ? '  (reply cached)' : ''}`,
    );
  }

  const summary = summarize(rows);
  log(
    `\nisolated replies: ${summary.counts.present} edged, ${summary.counts.absent} flat, ${summary.counts.unread} unread`,
  );
  for (const bucket of summary.byRegister) {
    log(`  ${bucket.register.padEnd(22)} ${bucket.present} edged / ${bucket.present + bucket.absent + bucket.unread}`);
  }
  return { signature, targets, dropped, rows, summary, dryRun: false };
}

async function main() {
  const { values } = parseArgs({
    options: {
      readings: { type: 'string' },
      limit: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      out: { type: 'string' },
      'timeout-ms': { type: 'string' },
    },
  });
  if (!values.readings) {
    console.error(
      'usage: node scripts/probe-register-prompt-isolation.js --readings <manner-presence json> [--dry-run] [--limit N] [--out file]',
    );
    process.exit(2);
  }
  const result = await runIsolationProbe({
    readingsPath: path.resolve(values.readings),
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
