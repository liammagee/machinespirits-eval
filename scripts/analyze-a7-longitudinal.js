#!/usr/bin/env node
/**
 * A7 Longitudinal Analysis (Phase 2) — stub.
 *
 * Reads the per-arc evaluation_results and tutor-core writing_pads to
 * answer the Phase 2 questions:
 *
 *   1. Does the Writing Pad accumulate state across sessions?
 *      → recognition_moments count per learner, monotone non-decreasing
 *      → unconscious_state byte growth, monotone non-decreasing
 *      → conscious_state size oscillates (ephemeral) but bounded
 *
 *   2. Does recognition (cell 41) accumulate faster than base (cell 40)?
 *      → per-session recognition_moments delta, base vs recog
 *      → archetype evolution timestamp distribution
 *
 *   3. Do later-session tutor responses *use* the accumulated state?
 *      → token-overlap between conscious_state.permanentTraces and
 *        the tutor's final message in session N
 *      → does this overlap grow across sessions?
 *
 * Usage:
 *   node scripts/analyze-a7-longitudinal.js --timestamp <unix-ts>
 *   node scripts/analyze-a7-longitudinal.js --learners 'a7-phase2-base-01-...' 'a7-phase2-recog-01-...'
 *
 * Output:
 *   - exports/a7-phase2-longitudinal.md (human-readable report)
 *   - stdout: per-learner summary table
 *
 * Status: runs end-to-end and emits the per-learner / per-condition
 * summary needed to verify cross-session pad reuse. Deeper analyses
 * (per-session moment delta, archetype-evolution timing, conscious-trace
 * ↔ tutor-message overlap, cross-session insight transfer) are listed
 * as open items in the markdown report and will be implemented once
 * Phase 2 generation lands real arc data to inspect.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ─── DBs ─────────────────────────────────────────────────────────────────
const evalDbPath = process.env.EVAL_DB_PATH
  || path.join(REPO_ROOT, 'data', 'evaluations.db');
const tutorDbPath = process.env.AUTH_DB_PATH
  || path.join(REPO_ROOT, 'node_modules', '@machinespirits', 'tutor-core', 'data', 'lms.sqlite');

if (!fs.existsSync(evalDbPath)) {
  console.error(`eval DB not found: ${evalDbPath}`);
  process.exit(1);
}
if (!fs.existsSync(tutorDbPath)) {
  console.error(`tutor DB not found: ${tutorDbPath}`);
  process.exit(1);
}
const evalDb = new Database(evalDbPath, { readonly: true });
const tutorDb = new Database(tutorDbPath, { readonly: true });

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const tsIdx = args.indexOf('--timestamp');
const timestampSuffix = tsIdx !== -1 ? args[tsIdx + 1] : null;
const learnersIdx = args.indexOf('--learners');
const explicitLearners = learnersIdx !== -1
  ? args.slice(learnersIdx + 1).filter(s => !s.startsWith('--'))
  : null;

if (!timestampSuffix && !explicitLearners) {
  console.error('Usage: node analyze-a7-longitudinal.js --timestamp <ts>  | --learners <id1> <id2> ...');
  process.exit(1);
}

// ─── Resolve learners ────────────────────────────────────────────────────
let learners;
if (explicitLearners) {
  learners = explicitLearners;
} else {
  const rows = evalDb.prepare(
    `SELECT DISTINCT learner_id FROM evaluation_results
       WHERE learner_id LIKE ? ORDER BY learner_id`
  ).all(`%-${timestampSuffix}`);
  learners = rows.map(r => r.learner_id);
}
if (learners.length === 0) {
  console.error('No matching learner_ids found.');
  process.exit(1);
}
console.log(`Found ${learners.length} learner arcs:`);
for (const l of learners) console.log(`  ${l}`);

// ─── Per-learner summary ─────────────────────────────────────────────────
const summaries = [];
for (const learnerId of learners) {
  const sessions = evalDb.prepare(
    `SELECT scenario_id, profile_name, created_at, dialogue_id
       FROM evaluation_results
       WHERE learner_id = ?
       ORDER BY created_at`
  ).all(learnerId);

  const pad = tutorDb.prepare(
    `SELECT id, total_recognition_moments,
            length(conscious_state)    AS c_bytes,
            length(preconscious_state) AS p_bytes,
            length(unconscious_state)  AS u_bytes,
            created_at, updated_at
       FROM writing_pads WHERE learner_id = ?`
  ).get(learnerId);

  let recogMomentCount = 0;
  if (pad) {
    const m = tutorDb.prepare(
      `SELECT COUNT(*) AS n FROM recognition_moments WHERE writing_pad_id = ?`
    ).get(pad.id);
    recogMomentCount = m.n;
  }

  const isRecog = /^a7-phase2-recog-/.test(learnerId);
  summaries.push({
    learnerId,
    condition: isRecog ? 'recog' : 'base',
    sessions: sessions.length,
    pad,
    recogMomentCount,
  });
}

// ─── Stdout summary table ────────────────────────────────────────────────
console.log('\nLearner arc summary:');
console.log('  learner_id'.padEnd(48) + 'cond  sess  pad  unconscious  moments  updated_at');
console.log('  ' + '─'.repeat(95));
for (const s of summaries) {
  const padPresent = s.pad ? '✓' : '✗';
  const uBytes = s.pad?.u_bytes ?? 0;
  const updated = s.pad?.updated_at ?? '—';
  console.log(
    '  ' + s.learnerId.padEnd(46)
      + s.condition.padEnd(6)
      + String(s.sessions).padStart(4) + '  '
      + padPresent.padStart(3) + '  '
      + String(uBytes).padStart(10) + '  '
      + String(s.recogMomentCount).padStart(7) + '  '
      + updated
  );
}

// ─── Cross-condition aggregate ───────────────────────────────────────────
const baseArcs = summaries.filter(s => s.condition === 'base');
const recogArcs = summaries.filter(s => s.condition === 'recog');
const meanMoments = arcs => arcs.length === 0
  ? 0 : arcs.reduce((s, a) => s + a.recogMomentCount, 0) / arcs.length;
const meanU = arcs => arcs.length === 0
  ? 0 : arcs.reduce((s, a) => s + (a.pad?.u_bytes ?? 0), 0) / arcs.length;

console.log('\nCondition aggregates (mean across learner arcs):');
console.log(`  base  (n=${baseArcs.length}): moments=${meanMoments(baseArcs).toFixed(1)}, unconscious=${meanU(baseArcs).toFixed(0)} bytes`);
console.log(`  recog (n=${recogArcs.length}): moments=${meanMoments(recogArcs).toFixed(1)}, unconscious=${meanU(recogArcs).toFixed(0)} bytes`);

// ─── Markdown report ─────────────────────────────────────────────────────
const reportPath = path.join(REPO_ROOT, 'exports',
  `a7-phase2-longitudinal${timestampSuffix ? `-${timestampSuffix}` : ''}.md`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const lines = [];
lines.push('# A7 Longitudinal Phase 2 — Analysis');
lines.push('');
lines.push(`**Learner arcs analysed:** ${learners.length}`);
if (timestampSuffix) lines.push(`**Timestamp suffix:** \`${timestampSuffix}\``);
lines.push('');
lines.push('## What this measures');
lines.push('');
lines.push('- **Sessions per learner** — number of `evaluation_results` rows for the learner_id (target: 8 per arc, one per scenario).');
lines.push('- **Pad presence** — whether tutor-core\'s `writing_pads` row exists for the learner (target: ✓; row should be reused across all 8 sessions, not re-created).');
lines.push('- **Unconscious bytes** — size of `unconscious_state` JSON in the pad after the final session. Larger = more accumulated permanent traces / archetype evolution.');
lines.push('- **Recognition moments** — count of `recognition_moments` rows tied to this learner\'s pad. Content-driven; not every dialogue produces one.');
lines.push('');
lines.push('## Per-learner table');
lines.push('');
lines.push('| Learner | Condition | Sessions | Pad | Unconscious bytes | Moments | Last updated |');
lines.push('|---|---|---|---|---|---|---|');
for (const s of summaries) {
  lines.push(`| \`${s.learnerId}\` | ${s.condition} | ${s.sessions} | ${s.pad ? '✓' : '✗'} | ${s.pad?.u_bytes ?? 0} | ${s.recogMomentCount} | ${s.pad?.updated_at ?? '—'} |`);
}
lines.push('');
lines.push('## Condition aggregates (mean)');
lines.push('');
lines.push(`- base (n=${baseArcs.length}): moments=${meanMoments(baseArcs).toFixed(1)}, unconscious=${meanU(baseArcs).toFixed(0)} bytes`);
lines.push(`- recog (n=${recogArcs.length}): moments=${meanMoments(recogArcs).toFixed(1)}, unconscious=${meanU(recogArcs).toFixed(0)} bytes`);
lines.push('');
lines.push('## Open analysis (TODO when Phase 2 data lands)');
lines.push('');
lines.push('1. **Per-session moment delta.** Does recognition produce moments at a higher rate from session 1, or only after rapport accumulates? Plot moments vs session_idx for each arc.');
lines.push('2. **Archetype evolution timing.** When does the `evolved archetype: ...` log line first appear in each arc? Is recognition earlier than base?');
lines.push('3. **Conscious-trace ↔ tutor-message overlap.** For each session N > 1, compute token-overlap between (a) the pad\'s conscious/preconscious state at session N and (b) the tutor\'s final message in session N. If this overlap grows across sessions under recognition but not base, the pad is being *used*, not just *grown*.');
lines.push('4. **Cross-session insight transfer.** Do tutor messages in session N reference specific events from sessions 1..N-1 (verbatim quote, paraphrase, named breakthrough)? Hand-coding 5-10 dialogues per condition is the cheapest qualitative test.');
lines.push('5. **Per-session tutor score (if judged).** Is the per-session score curve flat, rising, or noisy? Recognition arcs should rise faster if accumulated state is doing pedagogical work.');
lines.push('');
lines.push('## Provenance');
lines.push('');
lines.push(`- eval DB: \`${evalDbPath}\``);
lines.push(`- tutor DB: \`${tutorDbPath}\``);
lines.push(`- generation script: \`scripts/run-a7-phase2-longitudinal.sh\``);
lines.push(`- design note: \`notes/design-a7-longitudinal-implementation-2026-04-16.md\``);
lines.push('');

fs.writeFileSync(reportPath, lines.join('\n'));
console.log(`\nReport: ${reportPath}`);

evalDb.close();
tutorDb.close();
