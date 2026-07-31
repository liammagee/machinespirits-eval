/**
 * One-line-per-run summary of tutor-stub trace directories. Read-only.
 *
 * Consolidates the inline analysis rewritten dozens of times across the
 * 2026-07/08 stance and stress-bench arcs: turn count, closure, delivery
 * outcomes (model vs template), plants landed, manner-switch activity, and
 * refusal/agreement manner counts — all from the trace, no model calls.
 *
 * Usage:
 *   node scripts/summarize-tutor-stub-run.js <traceDirOrParent> [more...]
 *   node scripts/summarize-tutor-stub-run.js exports/tutor-stub-outcome/stage5v3-switch
 *
 * A directory argument is walked recursively; every *.jsonl trace found
 * (excluding learning summaries) is summarized on one line.
 */

import fs from 'node:fs';
import path from 'node:path';

const REFUSAL =
  /(?:^|[.?!]\s+|—\s*)No\b\s*[—,.:]|\bI (?:won't|will not|refuse to)\b|\bthat'?s how i talk\b|(?:^|[.?!]\s+)My case is\b|\byou(?:'ll| will)? have to\b|\byou must\b/i;
const AGREE = /^(yes|exactly|fair|precisely|right|true|good|correct|that (is|was|keeps|makes))/i;

function findTraces(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.jsonl') && !entry.name.includes('summary')) out.push(full);
    }
  }
  return out.sort();
}

function summarize(tracePath) {
  const ev = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const turns = ev.filter((e) => e.type === 'turn_complete').map((e) => e.turnRecord || {});
  const outcomes = {};
  for (const e of ev.filter((x) => x.type === 'tutor_response_guard_accounting')) {
    const o = e.accounting?.outcome || '?';
    outcomes[o] = (outcomes[o] || 0) + 1;
  }
  const template = Object.entries(outcomes)
    .filter(([k]) => /deterministic_fallback/.test(k))
    .reduce((sum, [, v]) => sum + v, 0);
  const plants = ev.filter((e) => e.type === 'learner_stress_plant').length;
  const switchEvents = ev.filter((e) => e.type === 'tutor_manner_switch');
  const cardTurns = switchEvents.filter((e) => e.cardActive).length;
  const triggerVersion = switchEvents.find((e) => e.triggerVersion)?.triggerVersion || null;
  const closed = ev.some((e) => e.type === 'dialogue_closure_transition');
  const end = ev.find((e) => e.type === 'run_end');
  const refusals = turns.filter((t) => REFUSAL.test(t.tutor || '')).length;
  const agrees = turns.filter((t) => AGREE.test(String(t.tutor || '').trim())).length;
  return [
    `turns=${turns.length}`,
    `closed=${closed}`,
    `end=${String(end?.reason || (end ? 'ok' : 'NO_RUN_END'))}`,
    `template=${template}/${turns.length}`,
    plants ? `plants=${plants}` : null,
    switchEvents.length ? `switch[${triggerVersion || 'v1'}] card-turns=${cardTurns}` : null,
    `refusal-turns=${refusals}`,
    `agree-openers=${agrees}`,
  ]
    .filter(Boolean)
    .join(' ');
}

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error('usage: node scripts/summarize-tutor-stub-run.js <traceDirOrParent> [more...]');
  process.exit(1);
}
for (const root of roots) {
  for (const tracePath of findTraces(path.resolve(root))) {
    console.log(`${path.relative(process.cwd(), path.dirname(tracePath))}\n  ${summarize(tracePath)}`);
  }
}
