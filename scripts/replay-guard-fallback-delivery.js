#!/usr/bin/env node
/**
 * Replay: what would have shipped on the turns that ended in the fixed
 * template?
 *
 * Reads guard accounting out of a run's traces. For every turn whose recorded
 * outcome was the deterministic fallback, it takes the model-derived drafts the
 * ladder actually produced and re-decides delivery under two rules, using the
 * project's own disposition catalog rather than a new score:
 *
 *   relaxed   — the shadow-advisory column of the catalog. Costume and most
 *               conversation-integrity findings stop vetoing; evidence safety,
 *               clue bookkeeping and closure stay hard.
 *   closest   — relaxed first; if no draft clears even then, ship the draft
 *               with the fewest hard findings among those carrying no
 *               safety-family finding at all. Findings ride along recorded.
 *
 * No model is called and nothing is written back. The point is to see the text
 * the learner would have read before deciding whether to change the live rule.
 *
 * Usage:
 *   node scripts/replay-guard-fallback-delivery.js <runDir> [--samples N] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  tutorStubGuardIssueRows,
  decideTutorStubGuardDelivery,
  TUTOR_STUB_GUARD_BOUNDARY_POLICIES,
} from '../services/tutorStubGuardDisposition.js';

// The three contract families, named by the catalog's own `category` rather
// than by guard. Guard name is the wrong handle: `dramatic_release` carries
// duplicate delivery and source drift (contracts) alongside costume checks
// (judgments), so a guard-level filter lets clue bookkeeping through.
// `unknown` joins them because an unrecognized finding fails closed.
const SAFETY_CATEGORIES = new Set([
  'public_evidence_integrity',
  'clue_transaction_integrity',
  'semantic_closure_integrity',
  'unknown',
]);

function safetyFindings(decision) {
  return decision.dispositions.filter((d) => SAFETY_CATEGORIES.has(d.category) && d.effectiveDisposition === 'hard');
}

const LADDER = [
  'original_candidate',
  'plain_recovery_candidate',
  'self_correction_candidate',
  'composition_repair_candidate',
  'actorial_part_repair_candidate',
  'source_voice_repair_candidate',
];

function traceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) traceFiles(p, out);
    else if (p.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function candidateText(attempt) {
  const c = attempt?.candidate;
  if (!c) return '';
  return typeof c === 'string' ? c : c.text || '';
}

function decide(rows, policy) {
  return decideTutorStubGuardDelivery(rows, { boundaryPolicy: policy });
}

function summarize(issues) {
  const counts = new Map();
  for (const i of issues) {
    const k = `${i.guard}.${i.type}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

function merge(target, source) {
  for (const [k, v] of source) target.set(k, (target.get(k) || 0) + v);
}

function main() {
  const args = process.argv.slice(2);
  const runDir = args.find((a) => !a.startsWith('--'));
  if (!runDir) {
    console.error('usage: replay-guard-fallback-delivery.js <runDir> [--samples N] [--json out.json]');
    process.exit(2);
  }
  if (!fs.existsSync(runDir)) {
    console.error(`no such run directory: ${runDir}`);
    process.exit(2);
  }
  const sampleTarget = Number(args[args.indexOf('--samples') + 1]) || 6;
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

  const stats = {
    turnsSeen: 0,
    fallbackTurns: 0,
    rebuildAgrees: 0,
    rebuildDisagrees: 0,
    relaxedShips: 0,
    closestShips: 0,
    stillTemplate: 0,
    shippedBy: new Map(),
    ridersRelaxed: new Map(),
    ridersClosest: new Map(),
    safetyBreaches: 0,
    byCell: new Map(),
  };
  const samples = [];

  const cells = fs
    .readdirSync(runDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  for (const cell of cells) {
    for (const version of fs
      .readdirSync(path.join(runDir, cell), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)) {
      const dir = path.join(runDir, cell, version, 'traces');
      if (!fs.existsSync(dir)) continue;
      const key = `${cell}/${version}`;
      if (!stats.byCell.has(key)) stats.byCell.set(key, { fallback: 0, relaxed: 0, closest: 0, template: 0 });
      const cellStats = stats.byCell.get(key);

      for (const file of traceFiles(dir)) {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type !== 'tutor_response_guard_accounting') continue;
          const accounting = event.accounting || {};
          stats.turnsSeen++;
          if (accounting.outcome !== 'guarded_deterministic_fallback') continue;
          stats.fallbackTurns++;
          cellStats.fallback++;

          const drafts = (accounting.attempts || [])
            .filter((a) => a.kind !== 'deterministic_fallback')
            .sort((a, b) => LADDER.indexOf(a.kind) - LADDER.indexOf(b.kind));

          let chosen = null;
          let rule = null;
          for (const draft of drafts) {
            const rows = tutorStubGuardIssueRows(draft.audits);
            const strict = decide(rows, TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict);
            // Sanity: our rebuild of the strict verdict should match what the
            // run recorded. A mismatch means the replay is not reading the same
            // findings the live ladder saw, and its numbers cannot be trusted.
            if (strict.ok === (draft.auditOk === true)) stats.rebuildAgrees++;
            else stats.rebuildDisagrees++;

            const relaxed = decide(rows, TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory);
            if (relaxed.ok) {
              chosen = { draft, rows, decision: relaxed, strict };
              rule = 'relaxed';
              break;
            }
          }
          if (!chosen) {
            let best = null;
            for (const draft of drafts) {
              const rows = tutorStubGuardIssueRows(draft.audits);
              const relaxed = decide(rows, TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory);
              if (safetyFindings(relaxed).length) continue;
              const strict = decide(rows, TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict);
              const score = [relaxed.hardIssues.length, strict.hardIssues.length];
              if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) {
                best = { draft, rows, decision: relaxed, strict, score };
              }
            }
            if (best) {
              chosen = best;
              rule = 'closest';
            }
          }

          if (!chosen) {
            stats.stillTemplate++;
            cellStats.template++;
            continue;
          }
          if (safetyFindings(chosen.decision).length) stats.safetyBreaches++;
          if (rule === 'relaxed') {
            stats.relaxedShips++;
            cellStats.relaxed++;
            merge(
              stats.ridersRelaxed,
              summarize([...chosen.decision.advisoryIssues, ...chosen.decision.reportOnlyIssues]),
            );
          } else {
            stats.closestShips++;
            cellStats.closest++;
            merge(stats.ridersClosest, summarize(chosen.decision.hardIssues));
          }
          stats.shippedBy.set(chosen.draft.kind, (stats.shippedBy.get(chosen.draft.kind) || 0) + 1);

          if (samples.length < sampleTarget && stats.fallbackTurns % 37 === 0) {
            const template = (accounting.attempts || []).find((a) => a.kind === 'deterministic_fallback');
            samples.push({
              cell: key,
              turn: accounting.turn,
              rule,
              kind: chosen.draft.kind,
              wouldShip: candidateText(chosen.draft),
              didShip: candidateText(template),
              riders: [...summarize([...chosen.decision.hardIssues, ...chosen.decision.advisoryIssues]).keys()],
            });
          }
        }
      }
    }
  }

  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');
  console.log(`turns read: ${stats.turnsSeen}, of which ended in the template: ${stats.fallbackTurns}`);
  console.log(
    `rebuild of the recorded strict verdict: ${stats.rebuildAgrees} agree, ${stats.rebuildDisagrees} disagree`,
  );
  console.log('');
  console.log('what would have shipped on those turns');
  console.log(
    `  a draft clearing the relaxed catalog : ${stats.relaxedShips} (${pct(stats.relaxedShips, stats.fallbackTurns)})`,
  );
  console.log(
    `  closest draft, findings recorded     : ${stats.closestShips} (${pct(stats.closestShips, stats.fallbackTurns)})`,
  );
  console.log(
    `  still the template                   : ${stats.stillTemplate} (${pct(stats.stillTemplate, stats.fallbackTurns)})`,
  );
  console.log(`  safety findings on anything shipped  : ${stats.safetyBreaches}`);
  console.log('');
  console.log('which rung supplied the text');
  for (const [kind, n] of [...stats.shippedBy].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${kind}`);
  }
  console.log('');
  console.log('findings riding along on the closest-draft turns');
  for (const [k, n] of [...stats.ridersClosest].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }
  console.log('');
  console.log('per condition: template turns, then how each rule resolves them');
  for (const [key, s] of stats.byCell) {
    console.log(
      `  ${key.padEnd(31)} template=${String(s.fallback).padStart(4)}  relaxed=${String(s.relaxed).padStart(4)}  closest=${String(s.closest).padStart(4)}  unchanged=${String(s.template).padStart(3)}`,
    );
  }
  if (samples.length) {
    console.log('');
    console.log('samples');
    for (const s of samples) {
      console.log(`\n[${s.cell} turn ${s.turn}] rule=${s.rule} from=${s.kind}`);
      console.log(`  would ship: ${s.wouldShip.replace(/\s+/g, ' ').slice(0, 400)}`);
      console.log(`  did ship  : ${s.didShip.replace(/\s+/g, ' ').slice(0, 400)}`);
      console.log(`  riders    : ${s.riders.join(', ') || 'none'}`);
    }
  }
  if (jsonOut) {
    fs.writeFileSync(
      jsonOut,
      JSON.stringify(
        {
          ...stats,
          shippedBy: Object.fromEntries(stats.shippedBy),
          ridersRelaxed: Object.fromEntries(stats.ridersRelaxed),
          ridersClosest: Object.fromEntries(stats.ridersClosest),
          byCell: Object.fromEntries(stats.byCell),
          samples,
        },
        null,
        2,
      ),
    );
    console.log(`\nwrote ${jsonOut}`);
  }
}

main();
