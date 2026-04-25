#!/usr/bin/env node
/**
 * preview-pilot-sessions — render a Markdown report of completed pilot sessions
 *
 * Reads pilot_sessions / pilot_turns / pilot_test_items / pilot_exit_survey
 * directly from the DB and emits the same Markdown shape as the simulator's
 * --report mode. Use to refresh the report after partial / interrupted
 * simulator runs, or to review real pilot data once recruitment starts.
 *
 * Usage:
 *   node scripts/preview-pilot-sessions.js                          # all completed in default DB
 *   node scripts/preview-pilot-sessions.js --db <path>              # custom DB
 *   node scripts/preview-pilot-sessions.js --session <id>           # one specific session
 *   node scripts/preview-pilot-sessions.js --out exports/report.md  # write to file
 *   node scripts/preview-pilot-sessions.js --status all             # include abandoned / timed_out
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';
import { renderReport } from './simulate-pilot-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {
    db: path.join(ROOT_DIR, 'data', 'pilot-simulation.db'),
    sessionId: null,
    out: null,
    status: 'completed',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--session') out.sessionId = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--status') out.status = argv[++i];
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(__filename, 'utf-8').slice(0, 1200)); process.exit(0); }
  }
  return out;
}

function reconstructSessionData(db, sessionId) {
  const session = db.prepare('SELECT * FROM pilot_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  if (typeof session.intake_data === 'string') {
    try { session.intake_data = JSON.parse(session.intake_data); } catch { /* leave */ }
  }
  const turns = db.prepare('SELECT * FROM pilot_turns WHERE session_id = ? ORDER BY turn_index').all(sessionId);
  const tests = db.prepare('SELECT * FROM pilot_test_items WHERE session_id = ? ORDER BY phase, item_position').all(sessionId);
  const survey = db.prepare('SELECT * FROM pilot_exit_survey WHERE session_id = ?').get(sessionId);
  const exitPayload = survey ? {
    nasa_tlx: survey.nasa_tlx ? JSON.parse(survey.nasa_tlx) : {},
    engagement_likert: survey.engagement_likert ? JSON.parse(survey.engagement_likert) : {},
    open_ended: survey.open_ended ? JSON.parse(survey.open_ended) : { tutor_got_right: '', felt_misunderstood: '' },
  } : { nasa_tlx: {}, engagement_likert: {}, open_ended: { tutor_got_right: '', felt_misunderstood: '' } };
  return {
    session,
    turns,
    tests,
    persona: '(unknown)',           // not stored in DB; reconstructed reports won't have this
    exitPayload,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.db)) {
    console.error(`DB not found: ${args.db}`);
    process.exit(1);
  }
  const db = new Database(args.db, { readonly: true });

  let sessionIds;
  if (args.sessionId) {
    sessionIds = [args.sessionId];
  } else {
    const rows = args.status === 'all'
      ? db.prepare('SELECT id FROM pilot_sessions ORDER BY enrolled_at').all()
      : db.prepare('SELECT id FROM pilot_sessions WHERE status = ? ORDER BY enrolled_at').all(args.status);
    sessionIds = rows.map((r) => r.id);
  }

  if (sessionIds.length === 0) {
    console.error('No matching sessions.');
    process.exit(0);
  }

  const reports = [];
  for (const sid of sessionIds) {
    const data = reconstructSessionData(db, sid);
    if (!data) {
      console.error(`session not found: ${sid}`);
      continue;
    }
    reports.push(renderReport(data));
  }

  const md = [
    `# Pilot Sessions Report — ${reports.length} session(s)`,
    '',
    `_Generated ${new Date().toISOString()} from \`${path.relative(ROOT_DIR, args.db)}\`_`,
    '',
    ...reports,
  ].join('\n');

  if (args.out) {
    fs.writeFileSync(args.out, md);
    console.error(`Report written to ${args.out}`);
  } else {
    console.log(md);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[preview-pilot-sessions] error:', err);
    process.exit(1);
  });
}
