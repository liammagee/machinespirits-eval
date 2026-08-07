#!/usr/bin/env node
/**
 * Census: how much of a run's tutor speech was the model's, and how much was
 * the fixed template?
 *
 * Reads a run's traces and reports, per condition and overall:
 *
 *   turns             tutor turns that reached delivery
 *   template rate     share delivered as the deterministic fallback template
 *   model as written  share where the model's first draft passed unchanged
 *
 * It also reports the guard regime the run was decided under — the boundary
 * policy and disposition catalog version read off the traces. Report that with
 * the rate always. Runs on this machine span both policies, and the same
 * drafts pass or fail depending on which findings count as vetoes: two runs
 * whose rates differ by a factor of ten differ by policy, not by tutor.
 *
 * Two trace formats exist and the script says which one it read, because the
 * two count slightly different things and the numbers must not be pooled
 * without that stamp:
 *
 *   accounting  runs carrying `tutor_response_guard_accounting` (from
 *               2026-07-2x). One record per turn holding every ladder attempt
 *               with its verdict, so pass rate by candidate kind is exact.
 *   legacy      older runs. Template turns counted from
 *               `tutor_response_fallback` events against `turn_complete`;
 *               first-draft passes from `tutor_response_audit` at attempt 0.
 *               No per-candidate ladder is recoverable.
 *
 * No model is called and nothing is written back.
 *
 * Usage:
 *   node scripts/census-guard-template-rate.js <runDir> [--json out.json]
 *   node scripts/census-guard-template-rate.js <runDir> --quiet   # totals only
 */
import fs from 'node:fs';
import path from 'node:path';

import { tutorStubGuardIssueRows } from '../services/tutorStubGuardDisposition.js';

function traceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) traceFiles(p, out);
    else if (entry.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function readLines(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* a truncated tail line on a killed run is not a reason to fail */
    }
  }
  return rows;
}

// The condition is the path between the run root and the `traces/` directory —
// `low_agency--rowan/contract` for Phase B, empty for a flat single-cell run.
function conditionOf(file, runDir) {
  const rel = path.relative(runDir, file);
  const cut = rel.split(path.sep).indexOf('traces');
  return cut > 0 ? rel.split(path.sep).slice(0, cut).join('/') : '(run)';
}

function emptyTally() {
  return {
    turns: 0,
    template: 0,
    modelAsWritten: 0,
    byKind: new Map(),
    byFamily: new Map(),
    format: null,
    // The guard regime the run was decided under. A rate is meaningless
    // without it: the same drafts pass or fail depending on which findings
    // count as vetoes, and runs on this machine differ.
    policies: new Set(),
    catalogVersions: new Set(),
  };
}

function bump(map, key, passed) {
  const cur = map.get(key) || { n: 0, passes: 0 };
  cur.n += 1;
  if (passed) cur.passes += 1;
  map.set(key, cur);
}

function tallyAccounting(rows, tally) {
  for (const row of rows) {
    if (row.type !== 'tutor_response_guard_accounting') continue;
    const acc = row.accounting;
    if (!acc) continue;
    tally.turns += 1;
    if (acc.finalDelivery?.deterministicFallback === true) tally.template += 1;
    const first = (acc.attempts || [])[0];
    if (first?.kind === 'original_candidate' && first.auditOk === true) tally.modelAsWritten += 1;
    for (const attempt of acc.attempts || []) {
      bump(tally.byKind, attempt.kind, attempt.auditOk === true);
      const decision = attempt.audits?.deliveryDecision;
      if (decision?.boundaryPolicy) tally.policies.add(decision.boundaryPolicy);
      if (decision?.catalogVersion) tally.catalogVersions.add(decision.catalogVersion);
    }
    // Which checks did the vetoing, counted against the model's own first
    // draft. Use the project's issue extractor rather than walking the audits
    // object: its shape varies by guard, and counting its keys measures the
    // shape instead of the findings.
    if (first?.kind === 'original_candidate') {
      for (const issue of tutorStubGuardIssueRows(first.audits || {})) {
        const family = issue.guard || 'unknown';
        tally.byFamily.set(family, (tally.byFamily.get(family) || 0) + 1);
      }
    }
  }
}

function tallyLegacy(rows, tally) {
  // One `turn_complete` per delivered tutor turn; one `tutor_response_fallback`
  // per turn the template spoke. Attempt-0 audits give the first-draft verdict.
  const firstDraftOk = new Map();
  for (const row of rows) {
    if (row.type === 'turn_complete') tally.turns += 1;
    else if (row.type === 'tutor_response_fallback') tally.template += 1;
    else if (row.type === 'tutor_response_audit' && row.attempt === 0) {
      const key = `${row.runId}:${row.turn}`;
      if (!firstDraftOk.has(key)) firstDraftOk.set(key, row.ok === true);
    }
  }
  for (const ok of firstDraftOk.values()) {
    bump(tally.byKind, 'first draft (legacy audit)', ok);
    if (ok) tally.modelAsWritten += 1;
  }
  // These runs pre-date the disposition catalog, so there is no policy to
  // read. Say so rather than leaving the field blank, which would read as
  // "not checked".
  if (tally.turns) tally.policies.add('pre-catalog');
}

export function censusRun(runDir) {
  const files = traceFiles(runDir);
  const byCondition = new Map();
  for (const file of files) {
    const rows = readLines(file);
    const hasAccounting = rows.some((r) => r.type === 'tutor_response_guard_accounting');
    const key = conditionOf(file, runDir);
    if (!byCondition.has(key)) byCondition.set(key, emptyTally());
    const tally = byCondition.get(key);
    if (hasAccounting) {
      tally.format = tally.format === 'legacy' ? 'mixed' : 'accounting';
      tallyAccounting(rows, tally);
    } else if (rows.some((r) => r.type === 'turn_complete')) {
      tally.format = tally.format === 'accounting' ? 'mixed' : 'legacy';
      tallyLegacy(rows, tally);
    }
  }
  // Trace files can sit at the run root (plans, summaries) with no tutor turns
  // in them. They are read and found empty; they are not a condition.
  for (const [key, tally] of byCondition) if (!tally.turns) byCondition.delete(key);
  return { runDir, files: files.length, byCondition };
}

function pct(part, whole) {
  return whole ? `${Math.round((part / whole) * 100)}%` : '—';
}

function main() {
  const args = process.argv.slice(2);
  const runDir = args.find((a) => !a.startsWith('--'));
  if (!runDir) {
    console.error('usage: node scripts/census-guard-template-rate.js <runDir> [--json out.json] [--quiet]');
    process.exit(1);
  }
  if (!fs.existsSync(runDir)) {
    console.error(`no such directory: ${runDir}`);
    process.exit(1);
  }
  const quiet = args.includes('--quiet');
  const jsonAt = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

  const { files, byCondition } = censusRun(runDir);
  if (!byCondition.size) {
    console.log(`${runDir}: ${files} trace files, none carrying tutor turns — nothing to count.`);
    return;
  }

  const total = emptyTally();
  const formats = new Set();
  for (const [, t] of byCondition) {
    total.turns += t.turns;
    total.template += t.template;
    total.modelAsWritten += t.modelAsWritten;
    formats.add(t.format);
    for (const p of t.policies) total.policies.add(p);
    for (const v of t.catalogVersions) total.catalogVersions.add(v);
    for (const [kind, v] of t.byKind) {
      const cur = total.byKind.get(kind) || { n: 0, passes: 0 };
      cur.n += v.n;
      cur.passes += v.passes;
      total.byKind.set(kind, cur);
    }
    for (const [family, n] of t.byFamily) total.byFamily.set(family, (total.byFamily.get(family) || 0) + n);
  }

  const regime = [...total.policies].sort().join(' + ') || 'unknown';
  const catalog = [...total.catalogVersions].sort().join(',');
  const mixedRegime = total.policies.size > 1;

  console.log(`${runDir}`);
  console.log(`counter: ${[...formats].join(' + ')} format, ${files} trace files`);
  console.log(`regime:  guard policy ${regime}${catalog ? `, catalog v${catalog}` : ''}\n`);

  if (!quiet && byCondition.size > 1) {
    // Only carry a policy column when the run is not of one piece. A mixed
    // run cannot be pooled and the column is how you see that.
    const head = mixedRegime
      ? '| condition | policy | turns | template | model as written |'
      : '| condition | turns | template | model as written |';
    console.log(head);
    console.log(`|${'---|'.repeat(mixedRegime ? 5 : 4)}`);
    for (const [name, t] of [...byCondition].sort()) {
      const cells = [name];
      if (mixedRegime) cells.push([...t.policies].sort().join('+') || '—');
      cells.push(t.turns, pct(t.template, t.turns), pct(t.modelAsWritten, t.turns));
      console.log(`| ${cells.join(' | ')} |`);
    }
    const tail = mixedRegime ? ` | **${regime}**` : '';
    console.log(
      `| **all**${tail} | **${total.turns}** | **${pct(total.template, total.turns)}** | **${pct(total.modelAsWritten, total.turns)}** |\n`,
    );
  } else {
    console.log(
      `turns ${total.turns} | template ${pct(total.template, total.turns)} | model as written ${pct(total.modelAsWritten, total.turns)}\n`,
    );
  }

  if (!quiet) {
    console.log('| candidate | n | passes |');
    console.log('|---|---|---|');
    for (const [kind, v] of total.byKind) {
      console.log(`| ${kind} | ${v.n} | ${pct(v.passes, v.n)} |`);
    }
    if (total.byFamily.size) {
      console.log('\n| findings against the first draft | family |');
      console.log('|---|---|');
      for (const [family, n] of [...total.byFamily].sort((a, b) => b[1] - a[1])) {
        console.log(`| ${n} | ${family} |`);
      }
    }
  }

  if (jsonAt) {
    const out = {
      runDir,
      traceFiles: files,
      counter: [...formats].join('+'),
      guardPolicy: regime,
      catalogVersion: catalog || null,
      total: {
        turns: total.turns,
        template: total.template,
        templateRate: total.turns ? total.template / total.turns : null,
        modelAsWritten: total.modelAsWritten,
        modelAsWrittenRate: total.turns ? total.modelAsWritten / total.turns : null,
      },
      byCondition: Object.fromEntries(
        [...byCondition].map(([k, t]) => [
          k,
          {
            format: t.format,
            guardPolicy: [...t.policies].sort().join('+') || null,
            turns: t.turns,
            templateRate: t.turns ? t.template / t.turns : null,
            modelAsWrittenRate: t.turns ? t.modelAsWritten / t.turns : null,
          },
        ]),
      ),
      byCandidateKind: Object.fromEntries(
        [...total.byKind].map(([k, v]) => [k, { n: v.n, passRate: v.n ? v.passes / v.n : null }]),
      ),
      firstDraftFindingsByFamily: Object.fromEntries([...total.byFamily].sort((a, b) => b[1] - a[1])),
    };
    fs.mkdirSync(path.dirname(jsonAt), { recursive: true });
    fs.writeFileSync(jsonAt, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`\njson: ${jsonAt}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
