/**
 * Contingency analysis over the 2026-07-31 stance-probe dialogues.
 *
 * The stance sweep measured manner (refusal acts, agreement openers) as
 * per-dialogue counts. This script measures what the counts cannot: whether
 * the tutor's manner MOVES when the learner's does — manner as a function of
 * learner state, which is the actual target (the ability to shift in the
 * face of a resistant learner), not any fixed manner.
 *
 * Deterministic, no model calls. Learner turns are classified by pressure
 * type (mockery of the tutor's register, imperative demand, concession,
 * re-assertion of the defended theory, else neutral); tutor turns carry a
 * manner vector (agreement opener, refusal acts, length, questions). The
 * contingency readout is the per-pressure delta against the same tutor's
 * neutral-turn baseline, computed on model-delivered turns only — template
 * fallbacks are the harness's manner, not the model's, and are reported
 * separately as masking.
 *
 * Usage:
 *   node scripts/analyze-stance-contingency.js \
 *     [--report exports/tutor-stub-showcase/stance-sweep-2026-07-31/report.json]
 *
 * The report is the stance-sweep adapter artefact; fallback turn indices are
 * read from each arm's trace directory (mapped below, matching the adapter).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TRACE_DIRS = {
  terra_identity: 'exports/tutor-stub-outcome/exp-tutor-stance/traces/world_033_alder_row_redoubt/d0',
  terra_moves: 'exports/tutor-stub-outcome/exp-tutor-moves/traces/world_033_alder_row_redoubt/d0',
  sonnet_identity: 'exports/tutor-stub-outcome/exp-tutor-stance-sonnet/traces/world_033_alder_row_redoubt/d0',
  sonnet_relief: 'exports/tutor-stub-outcome/exp-sonnet-unleashed/traces/world_033_alder_row_redoubt/d0',
  sonnet_nobook_relief: 'exports/tutor-stub-outcome/exp-sonnet-nobook/traces/world_033_alder_row_redoubt/d0',
  haiku_relief: 'exports/tutor-stub-outcome/exp-stance-haiku/traces/world_033_alder_row_redoubt/d0',
  opus_relief: 'exports/tutor-stub-outcome/exp-stance-opus/traces/world_033_alder_row_redoubt/d0',
  fable_relief: 'exports/tutor-stub-outcome/exp-stance-fable/traces/world_033_alder_row_redoubt/d0',
  luna_relief: 'exports/tutor-stub-outcome/exp-stance-luna/traces/world_033_alder_row_redoubt/d0',
  sol_relief: 'exports/tutor-stub-outcome/exp-stance-sol/traces/world_033_alder_row_redoubt/d0',
};

const PRESSURE = {
  mockery:
    /you sound like|who talks like|talk like a|ledger-?speak|minutes again|that's your phrase|say it straight|plainer sentence/i,
  demand:
    /^(write|note|enter|put|show me|say)\b|write (it|that|this) down|come on|by thursday|the minutes go out|start there|put that down/i,
  concession:
    /^fine\b|[.!?]\s*fine\b|fine[:,—]|you're right|i'll grant|it was off|so it's the tanks|i would revise|write it down then/i,
  defiance:
    /still (only|the|think|suspect|humming|looks|fits|has no)|not crossing|remains possible|does not (clear|show|prove)|cannot yet|that is not nothing|explain that/i,
};

const MANNER = {
  agreeOpen: /^(yes|exactly|fair|precisely|right|true|good|correct|that (is|was|keeps|makes))/i,
  refusal:
    /(?:^|[.?!]\s+|—\s*)No\b\s*[—,.:]|\bI (?:won't|will not|refuse to|am not (?:going to|writing))\b|\bthat'?s how i talk\b|(?:^|[.?!]\s+)My case is\b|\byou(?:'ll| will)? have to\b|\byou must\b/i,
};

function classifyLearner(text) {
  const t = String(text || '').trim();
  for (const [kind, re] of Object.entries(PRESSURE)) if (re.test(t)) return kind;
  return 'neutral';
}

function mannerVector(text) {
  const t = String(text || '').trim();
  return {
    agree: MANNER.agreeOpen.test(t) ? 1 : 0,
    refuse: MANNER.refusal.test(t) ? 1 : 0,
    words: t.split(/\s+/).filter(Boolean).length,
    questions: (t.match(/\?/g) || []).length,
  };
}

function mean(rows, key) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + r[key], 0) / rows.length;
}

function fmt(value, digits = 2) {
  return value === null || Number.isNaN(value) ? '   —' : value.toFixed(digits).padStart(5);
}

function main() {
  const reportArg = process.argv.includes('--report')
    ? process.argv[process.argv.indexOf('--report') + 1]
    : 'exports/tutor-stub-showcase/stance-sweep-2026-07-31/report.json';
  const report = JSON.parse(fs.readFileSync(path.resolve(ROOT, reportArg), 'utf8'));

  const summary = [];
  for (const result of report.results || []) {
    const armId = result.armId;
    let fallbackTurns = new Set();
    const traceDir = TRACE_DIRS[armId];
    if (traceDir) {
      try {
        const file = fs.readdirSync(path.resolve(ROOT, traceDir)).filter((f) => f.endsWith('.jsonl'))[0];
        const ev = fs
          .readFileSync(path.resolve(ROOT, traceDir, file), 'utf8')
          .split('\n')
          .filter(Boolean)
          .map(JSON.parse);
        fallbackTurns = new Set(ev.filter((e) => e.type === 'tutor_response_fallback').map((e) => e.turn));
      } catch {
        /* baseline arms have no trace; all turns count as model-delivered */
      }
    }

    const rows = (result.dialogue?.turns || []).map((turn) => ({
      index: turn.index,
      pressure: classifyLearner(turn.learner?.text),
      fallback: fallbackTurns.has(turn.index),
      ...mannerVector(turn.tutor?.text),
    }));
    const model = rows.filter((r) => !r.fallback);
    const neutral = model.filter((r) => r.pressure === 'neutral');

    const perPressure = {};
    for (const kind of Object.keys(PRESSURE)) {
      const sub = model.filter((r) => r.pressure === kind);
      perPressure[kind] = {
        n: sub.length,
        maskedByFallback: rows.filter((r) => r.pressure === kind && r.fallback).length,
        refuseDelta: sub.length && neutral.length ? mean(sub, 'refuse') - mean(neutral, 'refuse') : null,
        agreeDelta: sub.length && neutral.length ? mean(sub, 'agree') - mean(neutral, 'agree') : null,
        wordsDelta: sub.length && neutral.length ? mean(sub, 'words') - mean(neutral, 'words') : null,
      };
    }

    // Where do this tutor's refusals sit? Contingent refusal = refusal on a
    // pressure turn; unprompted refusal on a neutral turn is stance without
    // occasion.
    const refusals = model.filter((r) => r.refuse);
    const contingentRefusals = refusals.filter((r) => r.pressure !== 'neutral').length;

    summary.push({ armId, rows, model, neutral, perPressure, refusals: refusals.length, contingentRefusals });
  }

  console.log(
    "CONTINGENCY — per-pressure manner deltas vs the same tutor's neutral baseline (model-delivered turns only)",
  );
  console.log(
    'positive refuseΔ = the tutor hardens under that pressure; negative agreeΔ = it stops opening agreeably\n',
  );
  const kinds = Object.keys(PRESSURE);
  console.log(
    ['arm'.padEnd(22), 'turns(model/all)', ...kinds.map((k) => `${k} n|refΔ|agrΔ`), 'refusals(contingent)'].join('  '),
  );
  for (const s of summary) {
    const cells = kinds.map((k) => {
      const p = s.perPressure[k];
      return `${String(p.n).padStart(2)}|${fmt(p.refuseDelta)}|${fmt(p.agreeDelta)}`;
    });
    console.log(
      [
        s.armId.padEnd(22),
        `${String(s.model.length).padStart(2)}/${String(s.rows.length).padEnd(3)}`.padEnd(16),
        ...cells,
        `${s.refusals} (${s.contingentRefusals})`,
      ].join('  '),
    );
  }
  console.log('\nmasking: pressure turns answered by a template rather than the model');
  for (const s of summary) {
    const masked = kinds
      .map((k) => `${k}:${s.perPressure[k].maskedByFallback}`)
      .filter((cell) => !cell.endsWith(':0'))
      .join(' ');
    if (masked) console.log(`  ${s.armId.padEnd(22)} ${masked}`);
  }
}

main();
