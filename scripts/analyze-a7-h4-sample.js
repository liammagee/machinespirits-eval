#!/usr/bin/env node
/**
 * A7 Phase 2 — H4 sampling for blinded hand-coding.
 *
 * Pre-registration:
 *   "Recognition arcs should produce explicit cross-session references
 *    in ≥60% of late-session dialogues; base ≤30%. Binary code per
 *    dialogue."
 *
 * Method:
 *   - Sample N "late-session" dialogues per arc (sessions 5-8); N
 *     defaults to 1 (the pre-registered design) and can be bumped to
 *     up to 4 for power augmentation. 10 arcs × N → 10·N dialogues
 *     balanced across conditions.
 *   - Shuffle by a deterministic seed (so the sample is reproducible).
 *   - For each dialogue, extract:
 *       (a) the tutor's last suggestion in the session, and
 *       (b) a summary of "what the pad knew" before the session started
 *           (synthesis_resolution + thesis/antithesis text from
 *           recognition_moments rows with created_at < session.created_at).
 *   - Write a markdown file with anonymized labels D1..D10. The
 *     condition mapping is written to a separate companion file
 *     (data/a7-h4-key-1777173286.json) so the coder can stay blind to
 *     condition while reading the dialogues.
 *
 * Usage:
 *   node scripts/analyze-a7-h4-sample.js --timestamp 1777173286
 *   node scripts/analyze-a7-h4-sample.js --timestamp 1777173286 --n-per-arc 4
 *
 * Outputs (filename includes n-per-arc when > 1):
 *   exports/a7-h4-blinded-1777173286.md           (n=1, default)
 *   exports/a7-h4-blinded-1777173286-n4.md        (n=4, augmented)
 *   data/a7-h4-key-1777173286[-n4].json           (matching key)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const tsIdx = args.indexOf('--timestamp');
const TIMESTAMP = tsIdx !== -1 ? args[tsIdx + 1] : '1777173286';
const nIdx = args.indexOf('--n-per-arc');
const N_PER_ARC = nIdx !== -1 ? parseInt(args[nIdx + 1], 10) : 1;
const SEED = 42;

const evalDb = new Database(path.join(REPO_ROOT, 'data', 'evaluations.db'), { readonly: true });
const tutorDb = new Database(
  path.join(REPO_ROOT, 'node_modules', '@machinespirits', 'tutor-core', 'data', 'lms.sqlite'),
  { readonly: true },
);

// Mulberry32 deterministic PRNG so the sample is reproducible.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const LATE_SESSIONS = new Set([
  'epistemic_resistance_impasse', // canonical 5
  'mood_frustration_to_breakthrough', // 6
  'mutual_transformation_journey', // 7
  'productive_deadlock_impasse', // 8
]);

// Pull all arcs and pick one late-session dialogue per arc.
const arcs = evalDb
  .prepare(
    `SELECT DISTINCT learner_id FROM evaluation_results
       WHERE learner_id LIKE ? ORDER BY learner_id`,
  )
  .all(`%-${TIMESTAMP}`)
  .map((r) => r.learner_id);

const samples = [];
for (const arc of arcs) {
  const candidates = evalDb
    .prepare(
      `SELECT scenario_id, suggestions, created_at, run_id
         FROM evaluation_results
         WHERE learner_id = ? AND scenario_id IN (${[...LATE_SESSIONS].map(() => '?').join(',')})
         ORDER BY created_at`,
    )
    .all(arc, ...LATE_SESSIONS);
  if (candidates.length === 0) continue;
  if (N_PER_ARC >= candidates.length) {
    // Use all of them
    for (const c of candidates) samples.push({ arc, ...c });
  } else {
    // Random sample without replacement
    const indices = candidates.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < N_PER_ARC; k++) samples.push({ arc, ...candidates[indices[k]] });
  }
}

// Shuffle samples for blinded ordering
for (let i = samples.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [samples[i], samples[j]] = [samples[j], samples[i]];
}

// Helper: extract last tutor message from suggestions JSON
function lastTutorMessage(suggestionsJson) {
  try {
    const arr = JSON.parse(suggestionsJson);
    if (!Array.isArray(arr) || arr.length === 0) return '';
    const last = arr[arr.length - 1];
    if (typeof last === 'string') return last;
    if (last && typeof last === 'object') {
      return [last.suggestion, last.message, last.text, last.content].filter(Boolean).join('\n');
    }
    return String(last);
  } catch {
    return suggestionsJson || '';
  }
}

// Helper: get accumulated moments (prior to the session) for an arc
function priorMoments(arc, beforeIso) {
  const padRow = tutorDb.prepare(`SELECT id FROM writing_pads WHERE learner_id = ?`).get(arc);
  if (!padRow) return [];
  return tutorDb
    .prepare(
      `SELECT created_at, synthesis_resolution, thesis_position, antithesis_position
         FROM recognition_moments
         WHERE writing_pad_id = ? AND created_at < ?
         ORDER BY created_at`,
    )
    .all(padRow.id, beforeIso);
}

// Build the blinded markdown
const blindedLines = [];
const key = {};

blindedLines.push('# A7 Phase 2 — H4 Blinded Coding');
blindedLines.push('');
blindedLines.push(`**Timestamp:** \`${TIMESTAMP}\``);
blindedLines.push(`**Seed:** ${SEED} (deterministic Mulberry32)`);
blindedLines.push('');
blindedLines.push('## Coding instructions');
blindedLines.push('');
blindedLines.push('For each dialogue D1..D10, code **0 or 1**:');
blindedLines.push('');
blindedLines.push('- **1** = tutor\'s message in this session contains an *explicit reference* to a specific prior-session event (verbatim quote, paraphrase, named breakthrough, "you said earlier...", "in our last session you mentioned X", explicit pointer to a prior synthesis or impasse).');
blindedLines.push('- **0** = no explicit cross-session reference. Topic continuity (e.g., "Hegel\'s master-slave dialectic") without referencing the *learner\'s prior engagement* with it counts as 0.');
blindedLines.push('');
blindedLines.push('Borderline rule: if the tutor\'s message could plausibly be the same regardless of whether prior sessions happened, code 0.');
blindedLines.push('');
blindedLines.push('Submit codes by editing the table at the end of this file.');
blindedLines.push('');
blindedLines.push('---');
blindedLines.push('');

for (let i = 0; i < samples.length; i++) {
  const s = samples[i];
  const id = `D${i + 1}`;
  key[id] = {
    arc: s.arc,
    condition: s.arc.includes('recog') ? 'recog' : 'base',
    scenario_id: s.scenario_id,
    run_id: s.run_id,
  };
  const prior = priorMoments(s.arc, s.created_at);
  const tutorMsg = lastTutorMessage(s.suggestions);

  blindedLines.push(`## ${id}`);
  blindedLines.push('');
  blindedLines.push(`**Scenario:** \`${s.scenario_id}\``);
  blindedLines.push('');
  blindedLines.push(`**Prior session events** (${prior.length} accumulated moments before this session):`);
  blindedLines.push('');
  if (prior.length === 0) {
    blindedLines.push('_(no prior moments)_');
  } else {
    for (let m = 0; m < prior.length; m++) {
      const moment = prior[m];
      const text = (moment.synthesis_resolution || moment.antithesis_position || moment.thesis_position || '').trim();
      blindedLines.push(`${m + 1}. ${text.slice(0, 250)}${text.length > 250 ? '…' : ''}`);
    }
  }
  blindedLines.push('');
  blindedLines.push('**Tutor\'s last message in this session:**');
  blindedLines.push('');
  blindedLines.push('```');
  blindedLines.push(tutorMsg);
  blindedLines.push('```');
  blindedLines.push('');
  blindedLines.push('---');
  blindedLines.push('');
}

blindedLines.push('## Codes');
blindedLines.push('');
blindedLines.push('| ID | Code (0/1) | Note (optional) |');
blindedLines.push('|---|---|---|');
for (let i = 0; i < samples.length; i++) {
  blindedLines.push(`| D${i + 1} |   |   |`);
}
blindedLines.push('');

const outDir = path.join(REPO_ROOT, 'exports');
const keyDir = path.join(REPO_ROOT, 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(keyDir, { recursive: true });

const suffix = N_PER_ARC > 1 ? `-n${N_PER_ARC}` : '';
const blindedPath = path.join(outDir, `a7-h4-blinded-${TIMESTAMP}${suffix}.md`);
const keyPath = path.join(keyDir, `a7-h4-key-${TIMESTAMP}${suffix}.json`);

fs.writeFileSync(blindedPath, blindedLines.join('\n'));
fs.writeFileSync(keyPath, JSON.stringify(key, null, 2));

console.log(`Sampled ${samples.length} dialogues from ${arcs.length} arcs.`);
console.log(`Late-session scenarios sampled:`);
const scenarioCounts = {};
for (const id in key) {
  const s = key[id].scenario_id;
  scenarioCounts[s] = (scenarioCounts[s] || 0) + 1;
}
for (const [s, n] of Object.entries(scenarioCounts).sort()) console.log(`  ${s}: ${n}`);
console.log(`Conditions (blinded order): ${Object.values(key).map((k) => k.condition[0]).join('')}`);
console.log('');
console.log(`Blinded coding file: ${blindedPath}`);
console.log(`Unblinding key:      ${keyPath}`);

evalDb.close();
tutorDb.close();
