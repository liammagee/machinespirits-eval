#!/usr/bin/env node
/**
 * Persist a human-review queue over poetics sidecar items.
 *
 * This is intentionally separate from the computed browser queue. A critic
 * disagreement is evidence that an item may need human review, but the review
 * flag is the durable editorial decision that the browser can serve blindly.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore, upsertPoeticsReviewFlag } from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runIds: [],
    queue: 'disagreements',
    flagger: 'codex',
    flagType: 'human_review',
    priority: 'normal',
    reason: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runIds = [argv[++i]];
    else if (token === '--run-ids') args.runIds = splitCsv(argv[++i]);
    else if (token === '--queue') args.queue = argv[++i];
    else if (token === '--flagger') args.flagger = normalizeId(argv[++i]);
    else if (token === '--flag-type') args.flagType = normalizeId(argv[++i]);
    else if (token === '--priority') args.priority = argv[++i];
    else if (token === '--reason') args.reason = argv[++i];
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/flag-poetics-review-cases.js --run-id RUN
  node scripts/flag-poetics-review-cases.js --run-ids RUN1,RUN2 [--queue disagreements]

Options:
  --queue disagreements   Flag cases where critics assign different form labels
  --flagger codex         Durable flag author shown in non-blind metadata
  --priority normal       low|normal|high
  --reason TEXT           Override generated reason
  --dry-run               Print cases without writing flags`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.runIds.length) throw new Error('--run-id or --run-ids is required');
  if (args.queue !== 'disagreements') throw new Error('--queue currently supports only disagreements');
  if (!args.flagger) throw new Error('--flagger is empty after normalization');
  if (!args.flagType) args.flagType = 'human_review';
  if (!['low', 'normal', 'high'].includes(args.priority)) throw new Error('--priority must be low|normal|high');
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w-]/g, '');
}

function parseForms(value) {
  return String(value || '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=');
      return { critic: entry.slice(0, eq), form: entry.slice(eq + 1) };
    });
}

function disagreementRows(db, runIds) {
  const params = {};
  const placeholders = runIds.map((runId, idx) => {
    const key = `runId${idx}`;
    params[key] = runId;
    return `@${key}`;
  });
  return db
    .prepare(
      `
      SELECT
        i.id,
        i.run_id AS runId,
        i.unit_id AS unitId,
        i.arm,
        i.tid,
        i.drama_id AS dramaId,
        i.discipline,
        i.control_role AS controlRole,
        GROUP_CONCAT(DISTINCT s.critic_model || '=' || COALESCE(s.form_class, '')) AS criticForms
      FROM poetics_items i
      JOIN poetics_scores s ON s.item_id = i.id
      WHERE i.run_id IN (${placeholders.join(', ')})
      GROUP BY i.id
      ORDER BY i.run_id, i.repeat, i.unit_id, i.arm, i.tid
    `,
    )
    .all(params)
    .filter(
      (row) =>
        new Set(
          parseForms(row.criticForms)
            .map((entry) => entry.form)
            .filter(Boolean),
        ).size > 1,
    );
}

function reasonFor(row, override = null) {
  if (override) return override;
  const forms = parseForms(row.criticForms)
    .map((entry) => `${entry.critic}: ${entry.form}`)
    .join('; ');
  return `Critic form disagreement; queue for human perspective. ${forms}`;
}

function flagRows(db, rows, args) {
  for (const row of rows) {
    if (!args.dryRun) {
      upsertPoeticsReviewFlag(db, {
        itemId: row.id,
        flaggerId: args.flagger,
        flagType: args.flagType,
        priority: args.priority,
        reason: reasonFor(row, args.reason),
        metadata: {
          queue: args.queue,
          runId: row.runId,
          unitId: row.unitId,
          arm: row.arm,
          tid: row.tid,
          dramaId: row.dramaId,
          criticForms: parseForms(row.criticForms),
        },
      });
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const rows = disagreementRows(db, args.runIds);
    flagRows(db, rows, args);
    const action = args.dryRun ? 'would flag' : 'flagged';
    console.log(`${action} ${rows.length} poetics item(s) for ${args.queue} review`);
    for (const row of rows) {
      console.log(`  ${row.runId} ${row.tid} ${row.dramaId || ''} ${row.arm || ''} :: ${row.criticForms}`);
    }
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export { disagreementRows, flagRows, parseArgs, reasonFor };
