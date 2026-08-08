#!/usr/bin/env node

/**
 * Ask a reader whether the manner is in each stored negative-register turn.
 *
 * The stance gate's surface part says whether the tutor used a cue phrase the
 * registry handed it. That is compliance, not manner (§6.7). This pass supplies
 * the other axis: for every stored row in an edged arm, a pinned Sonnet-class
 * reader — a different model family from the `codex.gpt-5.5` writer — is asked
 * the merged presence question and its answer is cached. The effect-grid report
 * then reads the cache and stops failing closed on unread rows.
 *
 * Scope. Ironic, sarcastic and sarcastic-determinate rows only. Face threat has
 * no validated presence question: on the hand-marked set the reader called it on
 * eleven turns where the hand marks called it on five, and once on a control, so
 * those rows stay unread on purpose and their faithful count stays a count of
 * cue compliance.
 *
 * Cost. One short call per unread turn, and nothing at all for a turn already
 * read — the cache key is the prompt version, the reader and both turns' text.
 * So this is safe to re-run, and `--limit` makes it safe to run in pieces: read
 * three, look at them, read the rest.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { analyzeCharismaDesireRuns } from './report-charisma-desire-breakthrough-matrix.js';
import { mannerPresenceApplies, MANNER_PRESENCE_PROMPT_VERSION } from '../services/registerMannerPresence.js';
import {
  lookupMannerPresence,
  presenceCacheDir,
  presenceReaderLabel,
  readMannerPresence,
} from '../services/registerMannerPresenceReader.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

/** The rows this pass covers: an edged register and a turn to read. */
export function selectPresenceTargets(analyses) {
  return analyses
    .filter((row) => mannerPresenceApplies(row.tutorRegister))
    .filter((row) => String(row.tutorMessage || '').trim())
    .map((row) => ({
      rowId: row.rowId,
      runId: row.runId,
      scenarioId: row.scenarioId,
      arm: row.arm,
      registerName: row.tutorRegister,
      resistanceTurn: row.resistanceTurn,
      learnerMessage: row.preLearner,
      tutorMessage: row.tutorMessage,
    }));
}

function summarize(readings) {
  const counts = { present: 0, absent: 0, unread: 0 };
  const unreadReasons = {};
  const byArm = new Map();
  for (const entry of readings) {
    const status = entry.reading.status;
    counts[status] = (counts[status] || 0) + 1;
    if (status === 'unread') {
      const reason = entry.reading.reason || 'unknown';
      unreadReasons[reason] = (unreadReasons[reason] || 0) + 1;
    }
    if (!byArm.has(entry.arm)) byArm.set(entry.arm, { arm: entry.arm, rows: 0, present: 0, absent: 0, unread: 0 });
    const bucket = byArm.get(entry.arm);
    bucket.rows += 1;
    bucket[status] = (bucket[status] || 0) + 1;
  }
  return { counts, unreadReasons, byArm: [...byArm.values()] };
}

async function main() {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string', default: '' },
      limit: { type: 'string', default: '' },
      // A turn that ran out of time is not a turn the reader could not answer,
      // so a retry pass can raise the ceiling without changing the question.
      // The cache key covers the prompt version, the reader and the two turns —
      // not this — so raising it leaves every stored answer valid.
      'timeout-ms': { type: 'string', default: '' },
      'dry-run': { type: 'boolean', default: false },
      'output-dir': { type: 'string', default: 'exports/negative-register-manner-presence' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/read-negative-register-manner-presence.js --runs <id,id> [--limit N] [--timeout-ms N] [--dry-run] [--output-dir <dir>]',
    );
    return;
  }
  const runIds = values.runs
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!runIds.length) throw new Error('--runs is required; name the run ids to read');

  const targets = selectPresenceTargets(analyzeCharismaDesireRuns(runIds));
  const limit = values.limit ? Number(values.limit) : targets.length;
  if (!Number.isFinite(limit) || limit < 1) throw new Error('--limit must be a positive number');
  const selected = targets.slice(0, limit);
  const timeoutMs = values['timeout-ms'] ? Number(values['timeout-ms']) : undefined;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 1)) {
    throw new Error('--timeout-ms must be a positive number');
  }

  const reader = presenceReaderLabel();
  const cached = selected.filter((target) => lookupMannerPresence(target)).length;
  console.log(`[manner-presence] runs ${runIds.join(',')}`);
  console.log(`[manner-presence] reader ${reader}, prompt ${MANNER_PRESENCE_PROMPT_VERSION}`);
  console.log(`[manner-presence] cache ${path.relative(ROOT, presenceCacheDir())}`);
  console.log(
    `[manner-presence] ${targets.length} edged rows; reading ${selected.length}; ${cached} already read; ${selected.length - cached} calls`,
  );
  if (values['dry-run']) {
    console.log('[manner-presence] dry run; no calls made');
    return;
  }

  const readings = [];
  for (const [index, target] of selected.entries()) {
    process.stdout.write(`[${index + 1}/${selected.length}] ${target.arm} ${target.scenarioId} ... `);
    const { reading, fromCache } = await readMannerPresence({ ...target, ...(timeoutMs ? { timeoutMs } : {}) });
    readings.push({ ...target, reading, fromCache });
    const note = reading.status === 'unread' ? ` (${reading.reason})` : '';
    console.log(`${reading.status}${note}${fromCache ? ' [cached]' : ''}`);
  }

  const summary = summarize(readings);
  const artifact = {
    schema: 'machinespirits.negative-register-manner-presence.v1',
    generatedAt: new Date().toISOString(),
    runIds,
    reader,
    promptVersion: MANNER_PRESENCE_PROMPT_VERSION,
    timeoutMs: timeoutMs || null,
    edgedRows: targets.length,
    readRows: readings.length,
    ...summary,
    readings: readings.map((entry) => ({
      rowId: entry.rowId,
      runId: entry.runId,
      scenarioId: entry.scenarioId,
      arm: entry.arm,
      registerName: entry.registerName,
      resistanceTurn: entry.resistanceTurn,
      status: entry.reading.status,
      reason: entry.reading.reason,
      evidence: entry.reading.evidence,
      evidenceFoundInTurn: entry.reading.evidenceFoundInTurn,
      cacheKey: entry.reading.cacheKey,
      fromCache: entry.fromCache,
    })),
  };
  const outputDir = path.resolve(ROOT, values['output-dir']);
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, `${runIds.join('_')}.json`);
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(
    `[manner-presence] present ${summary.counts.present}, absent ${summary.counts.absent}, unread ${summary.counts.unread}`,
  );
  for (const bucket of summary.byArm) {
    console.log(`[manner-presence] ${bucket.arm}: ${bucket.present}/${bucket.rows} present, ${bucket.unread} unread`);
  }
  // Gaps are reported, never retried in a loop: a reader that failed once on a
  // turn may fail on it again, and a silent retry would spend quota hiding it.
  for (const [reason, count] of Object.entries(summary.unreadReasons)) {
    console.log(`[manner-presence] unread ${count} ${reason}`);
  }
  console.log(`[manner-presence] ${path.relative(ROOT, artifactPath)}`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[manner-presence] ${error.message}`);
    process.exit(1);
  }
}
