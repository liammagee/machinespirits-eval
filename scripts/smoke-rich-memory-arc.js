#!/usr/bin/env node
/**
 * smoke-rich-memory-arc.js — hermetic, zero-cost validation of the cross-session
 * RICH-store loop (#3, step 1). No LLM calls, no production DB.
 *
 * Drives an N-session arc for one synthetic learner through the revived rich store
 * (services/memory/learnerMemoryService.js). Each session:
 *   1. READ + INJECT — buildContextInjection() produces the narrative the tutor WOULD
 *      be fed (the accumulated learner model so far).
 *   2. MOCK OUTCOME — a deterministic stand-in for a tutored session: advance one
 *      concept, log an episode + an open thread + a session summary.
 *   3. WRITE BACK — persist that outcome so the next session sees more.
 * Then it asserts the store accumulates and the injected narrative GROWS across
 * sessions — i.e. the loop the cross-session experiment depends on actually works.
 *
 * What this is NOT: it does not run a real tutor or score quality. That is step 2
 * (paid), which must also choose how the narrative is injected into the live tutor —
 * runEvaluation() has no external systemPromptExtension hook today (the ego extension
 * is assembled internally), so step 2 needs a small runner option. See
 * MEMORY-ARCHITECTURE.md.
 *
 * Hermetic by construction: forces EVAL_WRITING_PAD_DIR to a fresh temp dir BEFORE
 * importing the store, so writes land in <tmp>/learner-memory.db, never repo data/.
 *
 * Usage:  node scripts/smoke-rich-memory-arc.js [--sessions N] [--keep]
 * Exit:   0 = every plumbing assertion passed · 1 = a plumbing assertion failed
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getOption(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const SESSIONS = Math.max(2, Number.parseInt(getOption('--sessions', '5'), 10) || 5);
const KEEP = process.argv.includes('--keep');

// Force a hermetic store location before the module resolves its DB path at load.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rich-arc-'));
process.env.EVAL_WRITING_PAD_DIR = TMP;
delete process.env.EVAL_WRITING_PAD_DISABLED;

const mem = await import('../services/memory/learnerMemoryService.js');

const CONCEPTS = ['fractions', 'ratios', 'decimals', 'proportions', 'percentages'];
const LEVELS = ['exposed', 'developing', 'proficient', 'mastered'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const learnerId = 'rich-arc-smoke';
mem.getOrCreateLearnerMemory(learnerId);

const rows = [];
for (let s = 1; s <= SESSIONS; s++) {
  // 1. READ + INJECT: the narrative a tutor would receive at the start of session s.
  const ctx = mem.buildContextInjection(learnerId);

  // 2. MOCK OUTCOME: a deterministic stand-in for what a tutored session produced.
  const concept = CONCEPTS[(s - 1) % CONCEPTS.length];
  mem.upsertConceptState(learnerId, concept, {
    label: cap(concept),
    level: LEVELS[Math.min(s - 1, LEVELS.length - 1)],
  });
  mem.createEpisode({
    learnerId,
    sessionId: `s${s}`,
    type: s % 2 ? 'breakthrough' : 'struggle',
    content: `session ${s}: worked through ${concept}`,
    importance: Math.min(0.95, 0.5 + s * 0.05),
    concepts: [concept],
  });
  mem.createThread({ learnerId, topic: concept, question: `open question from session ${s} on ${concept}` });
  mem.createSessionSummary({
    learnerId,
    sessionId: `s${s}`,
    narrativeSummary: `session ${s}: ${concept}`,
    conceptsTouched: [concept],
    unresolvedQuestions: [`why does ${concept} behave that way? (s${s})`],
  });

  // 3. SNAPSHOT what accumulated.
  rows.push({
    session: s,
    injectedTokens: ctx.tokenCount,
    episodes: mem.getRecentEpisodes(learnerId, 9999).length,
    concepts: mem.getAllConceptStates(learnerId).length,
    activeThreads: mem.getActiveThreads(learnerId).length,
  });
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(`\nRich-store cross-session arc — ${SESSIONS} sessions, learner "${learnerId}"`);
console.log(`store: ${path.join(TMP, 'learner-memory.db')}\n`);
console.log('  session  injectedTokens  episodes  concepts  activeThreads');
for (const r of rows) {
  console.log(
    `     ${String(r.session).padStart(2)}  ${String(r.injectedTokens).padStart(13)}  ${String(r.episodes).padStart(8)}  ${String(r.concepts).padStart(8)}  ${String(r.activeThreads).padStart(13)}`,
  );
}

// ── Assertions (the plumbing the experiment depends on) ─────────────────────
const failures = [];
const first = rows[0];
const last = rows[rows.length - 1];
const monotonic = (key) => rows.every((r, i) => i === 0 || r[key] >= rows[i - 1][key]);

if (last.episodes !== SESSIONS) failures.push(`episodes should equal sessions (${SESSIONS}), got ${last.episodes}`);
if (!monotonic('episodes')) failures.push('episode count must be monotonic non-decreasing');
if (!monotonic('injectedTokens')) failures.push('injected narrative must be monotonic non-decreasing');
if (!(last.injectedTokens > first.injectedTokens))
  failures.push(
    `injected narrative must GROW across the arc (first ${first.injectedTokens} -> last ${last.injectedTokens})`,
  );
if (last.concepts < Math.min(SESSIONS, CONCEPTS.length))
  failures.push(`expected >= ${Math.min(SESSIONS, CONCEPTS.length)} distinct concepts, got ${last.concepts}`);

// The rich store's distinguishing signal: spaced-repetition surfaces prior concepts
// for review in the injected narrative — confirm at least one later session does so.
const lateCtx = mem.buildContextInjection(learnerId);
if (!/due for review/i.test(lateCtx.narrativeSummary || ''))
  failures.push('expected spaced-repetition ("due for review") to surface in the injected narrative');

if (!KEEP) fs.rmSync(TMP, { recursive: true, force: true });

if (failures.length) {
  console.error(`\nFAIL (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nOK — rich store accumulates and the injected narrative grows across the arc.');
console.log('(plumbing only; no tutor, no scoring — step 2 wires this into a live tutor and judges quality)');
