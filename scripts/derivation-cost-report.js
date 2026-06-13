#!/usr/bin/env node
/**
 * Derivation cost-accounting pass — surface the measured per-arm spend the
 * runner already persists to diagnosis.json (usage.calls, usage.byRole,
 * usage.{input,output}Tokens, costUSD, elapsedMs) so the boundary plan's
 * scale-budget exit criterion (ADAPTIVE-TUTOR-BOUNDARY-PLAN.md §5.4 #4) rests
 * on data rather than hand counts.
 *
 * Two backends, two cost realities (this is the point of the report):
 *   - Max-plan CLI (codex/claude bridges): reports ZERO tokens by design — no
 *     token count crosses the subprocess, and the API keys are dropped so the
 *     call bills the subscription window, not a meter (services/dramaticDerivation/
 *     llmClient.js callClaudeCli). For these arms calls + wall-clock are
 *     MEASURED; output tokens are ESTIMATED from visible transcript text (a
 *     floor — it omits the JSON envelope; input tokens are unrecoverable here).
 *   - Metered API (openrouter): carries real input/output tokens + costUSD.
 * Every row is labelled meterless|metered so the two are never silently pooled.
 *
 * Dry: reads committed artifacts only. No LLM calls. Changes no verdict.
 *
 * Usage: node scripts/derivation-cost-report.js [--loop-dir D] [--out D]
 *        [--include-mock]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const loopDir = flag('loop-dir', 'exports/dramatic-derivation/loop');
const outDir = flag('out', 'exports/dramatic-derivation/boundary');
const includeMock = has('include-mock');

// The boundary-plan ladder + paid E-phase fans — the scale-relevant subset.
// Highlighted separately and used for the scale projection.
const RECIPE_ARMS = new Set([
  'lantern-p2-plot-on',
  'lantern-p3-repair-on',
  'lantern-p4-hygiene-on',
  'lantern-p5-mutation-on',
  'lantern-e2-real-r1',
  'lantern-e2-real-r2',
  'lantern-e2-real-r3',
  'lantern-e2-real-r4',
  'lantern-e2-real-r5',
  'lantern-e3-real-r1',
  'lantern-e5-proof-debt-real-r1',
]);

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const estTokens = (chars) => Math.round(chars / 4); // ~4 chars/token heuristic
const minutes = (ms) => (ms == null ? null : +(ms / 60000).toFixed(1));

function visibleOutputChars(dir) {
  const rp = path.join(dir, 'result.json');
  if (!existsSync(rp)) return 0;
  try {
    const r = readJson(rp);
    let chars = 0;
    for (const t of r.transcript || []) chars += (t.text || '').length;
    return chars;
  } catch {
    return 0;
  }
}

function providersOf(diag) {
  const roles = diag.backend?.roles;
  if (!roles) return ['openrouter(default)'];
  const set = new Set();
  for (const r of Object.values(roles)) set.add(r.cli ? r.provider : r.provider || 'openrouter');
  return [...set].sort();
}

function collectArm(arm) {
  const dir = path.join(loopDir, arm);
  const dp = path.join(dir, 'diagnosis.json');
  if (!existsSync(dp)) return null;
  let diag;
  try {
    diag = readJson(dp);
  } catch {
    return null;
  }
  const mode = diag.backend?.mode || 'unknown';
  const u = diag.usage || {};
  const metered = (u.costUSD || 0) > 0 || (u.outputTokens || 0) > 0;
  const estOut = (u.outputTokens || 0) > 0 ? null : estTokens(visibleOutputChars(dir));
  return {
    arm,
    group: diag.group || null,
    mode,
    path: metered ? 'metered' : 'meterless',
    providers: providersOf(diag),
    verdict: diag.verdict || null,
    turnsPlayed: diag.turnsPlayed ?? null,
    calls: u.calls ?? null,
    callsByRole: Object.fromEntries(Object.entries(u.byRole || {}).map(([k, v]) => [k, v.calls])),
    inputTokens: u.inputTokens || 0,
    outputTokens: u.outputTokens || 0,
    estOutputTokens: estOut,
    costUSD: u.costUSD || 0,
    elapsedMs: diag.elapsedMs ?? null,
    minutes: minutes(diag.elapsedMs),
    recipe: RECIPE_ARMS.has(arm),
  };
}

function summarize(rows) {
  const calls = rows.map((r) => r.calls).filter((n) => n != null);
  const mins = rows.map((r) => r.minutes).filter((n) => n != null);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => (a.length ? +(sum(a) / a.length).toFixed(1) : null);
  return {
    arms: rows.length,
    totalCalls: sum(calls),
    meanCalls: mean(calls),
    minCalls: calls.length ? Math.min(...calls) : null,
    maxCalls: calls.length ? Math.max(...calls) : null,
    totalMinutes: +sum(mins).toFixed(1),
    meanMinutes: mean(mins),
    totalCostUSD: +sum(rows.map((r) => r.costUSD)).toFixed(4),
  };
}

const allArms = readdirSync(loopDir)
  .filter((d) => {
    try {
      return statSync(path.join(loopDir, d)).isDirectory();
    } catch {
      return false;
    }
  })
  .map(collectArm)
  .filter(Boolean)
  .filter((a) => a.mode === 'real' || (includeMock && a.mode === 'mock'))
  .sort((a, b) => Number(b.recipe) - Number(a.recipe) || a.arm.localeCompare(b.arm));

const meterless = allArms.filter((a) => a.path === 'meterless');
const metered = allArms.filter((a) => a.path === 'metered');
const recipe = allArms.filter((a) => a.recipe);
const recipeGrounded = recipe.filter((a) => /grounded/.test(a.verdict || ''));
const recipeDied = recipe.filter((a) => !/grounded/.test(a.verdict || ''));

// Scale projection: serialized k-fan of the frozen recipe, from the measured
// recipe-arm distribution. Calls are additive; wall-clock is additive because
// paid arms run serialized (orchestration law §3.2 #3).
const projBase = recipeGrounded.length ? recipeGrounded : recipe;
const projMeanCalls = summarize(projBase).meanCalls;
const projMeanMin = summarize(projBase).meanMinutes;
const projection = [3, 5, 8].map((k) => ({
  k,
  calls: projMeanCalls != null ? Math.round(projMeanCalls * k) : null,
  minutes: projMeanMin != null ? +(projMeanMin * k).toFixed(0) : null,
  hours: projMeanMin != null ? +((projMeanMin * k) / 60).toFixed(1) : null,
}));

// Reference metered ratio (what the same work would cost on the paid API),
// from the metered arms — purely illustrative of the saving the CLI path buys.
const meteredRef = (() => {
  const withTok = metered.filter((a) => a.calls && a.inputTokens);
  if (!withTok.length) return null;
  const totCalls = withTok.reduce((s, a) => s + a.calls, 0);
  const totIn = withTok.reduce((s, a) => s + a.inputTokens, 0);
  const totOut = withTok.reduce((s, a) => s + a.outputTokens, 0);
  const totCost = withTok.reduce((s, a) => s + a.costUSD, 0);
  return {
    arms: withTok.length,
    inPerCall: Math.round(totIn / totCalls),
    outPerCall: Math.round(totOut / totCalls),
    costPerCall: +(totCost / totCalls).toFixed(5),
    modelNote: 'openrouter default (gemini-flash); Claude/Opus rates are far higher',
  };
})();

function renderRow(r) {
  const tok = r.path === 'metered' ? `${r.inputTokens}+${r.outputTokens}` : `0 (~${r.estOutputTokens} out est)`;
  const cost = r.costUSD ? `$${r.costUSD.toFixed(4)}` : '$0';
  return `| \`${r.arm}\` | ${r.verdict ?? '?'} | ${r.turnsPlayed ?? '?'} | ${r.path} | ${r.providers.join('+')} | ${r.calls ?? '?'} | ${r.minutes ?? '?'} | ${tok} | ${cost} |`;
}

function renderMarkdown() {
  const L = [];
  L.push('# Derivation cost-accounting report');
  L.push('');
  L.push(
    'Measured per-arm spend from each arm’s `diagnosis.json` (`usage.calls`, `usage.byRole`, ' +
      '`elapsedMs`, and `usage.{input,output}Tokens`/`costUSD` where metered). Dry reader over ' +
      'committed artifacts — no LLM calls, no verdict changes.',
  );
  L.push('');
  L.push('**Two backends, never pooled:**');
  L.push('');
  L.push(
    '- `meterless` — Max-plan CLI (codex/claude). Calls + wall-clock are MEASURED; tokens read 0 ' +
      'by design. Output tokens shown are a char/4 ESTIMATE over visible transcript text (a floor; ' +
      'input tokens are unrecoverable on this path).',
  );
  L.push('- `metered` — openrouter API. Real input/output tokens + USD cost.');
  L.push('');

  L.push('## Path totals');
  L.push('');
  L.push('| path | arms | total calls | mean calls/arm | total wall-clock (min) | mean min/arm | total $ |');
  L.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const [name, rows] of [
    ['meterless', meterless],
    ['metered', metered],
  ]) {
    const s = summarize(rows);
    L.push(
      `| ${name} | ${s.arms} | ${s.totalCalls} | ${s.meanCalls ?? '–'} | ${s.totalMinutes} | ${s.meanMinutes ?? '–'} | $${s.totalCostUSD.toFixed(4)} |`,
    );
  }
  L.push('');

  L.push('## Boundary-plan recipe arms (scale-relevant subset)');
  L.push('');
  L.push('| arm | verdict | turns | path | providers | calls | min | tokens | $ |');
  L.push('|---|---|---:|---|---|---:|---:|---|---:|');
  for (const r of recipe) L.push(renderRow(r));
  L.push('');
  const sg = summarize(recipeGrounded);
  const sd = summarize(recipeDied);
  L.push(
    `- grounded arms (n=${sg.arms}): mean ${sg.meanCalls ?? '–'} calls, ${sg.meanMinutes ?? '–'} min ` +
      `(range ${sg.minCalls ?? '–'}–${sg.maxCalls ?? '–'} calls).`,
  );
  L.push(
    `- non-grounded arms (n=${sd.arms}): mean ${sd.meanCalls ?? '–'} calls, ${sd.meanMinutes ?? '–'} min ` +
      `— deaths are cheaper (fewer turns).`,
  );
  L.push('');

  L.push('## Scale projection — serialized k-fan of the frozen recipe');
  L.push('');
  L.push(
    `Per-arm basis: mean of the ${projBase === recipeGrounded ? 'grounded' : 'all'} recipe arms ` +
      `(${projMeanCalls ?? '–'} calls, ${projMeanMin ?? '–'} min). Paid arms run serialized ` +
      '(orchestration law §3.2 #3), so wall-clock is additive — plan for quota windows accordingly.',
  );
  L.push('');
  L.push('| k | est. calls | est. wall-clock (min) | (hours) |');
  L.push('|---:|---:|---:|---:|');
  for (const p of projection) L.push(`| ${p.k} | ${p.calls ?? '–'} | ${p.minutes ?? '–'} | ${p.hours ?? '–'} |`);
  L.push('');
  if (meteredRef) {
    L.push(
      `_Metered reference (the spend the Max-plan path avoids): the openrouter arms ran ` +
        `≈${meteredRef.inPerCall} input + ${meteredRef.outPerCall} output tokens/call at ` +
        `≈$${meteredRef.costPerCall}/call (${meteredRef.modelNote}). A meterless recipe arm of ` +
        `~${projMeanCalls ?? '?'} calls would be roughly ` +
        `$${projMeanCalls != null ? (projMeanCalls * meteredRef.costPerCall).toFixed(2) : '?'} on that API — ` +
        `more on Claude/Opus rates._`,
    );
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(
    '_Generated by `npm run derivation:cost-report` (scripts/derivation-cost-report.js). ' +
      'Meterless token columns are char/4 estimates; treat calls + wall-clock as the measured budget._',
  );
  L.push('');
  return L.join('\n');
}

mkdirSync(outDir, { recursive: true });
const payload = {
  generatedFrom: loopDir,
  pathTotals: { meterless: summarize(meterless), metered: summarize(metered) },
  recipe: { grounded: summarize(recipeGrounded), died: summarize(recipeDied), projection, meteredRef },
  arms: allArms,
};
writeFileSync(path.join(outDir, 'cost-report.json'), `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(path.join(outDir, 'cost-report.md'), renderMarkdown());

console.log(`cost report written: ${path.join(outDir, 'cost-report.md')}`);
console.log(
  `  meterless: ${meterless.length} arms, ${summarize(meterless).totalCalls} calls, ${summarize(meterless).totalMinutes} min, $0`,
);
console.log(
  `  metered:   ${metered.length} arms, ${summarize(metered).totalCalls} calls, ${summarize(metered).totalMinutes} min, $${summarize(metered).totalCostUSD.toFixed(2)}`,
);
console.log(
  `  recipe arm mean (${projBase === recipeGrounded ? 'grounded' : 'all'}): ${projMeanCalls ?? '–'} calls, ${projMeanMin ?? '–'} min → k=5 ≈ ${projection[1].calls ?? '–'} calls, ${projection[1].hours ?? '–'} h serialized`,
);
