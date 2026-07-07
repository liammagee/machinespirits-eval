#!/usr/bin/env node
/**
 * Shrinkage probes — deterministic analysis (SHRINKAGE-PROBES-PREREGISTRATION.md).
 *
 * Limb B (replication): --replications <dir> ... (same 6 arm labels each) →
 * per-slot outcome table across replications + outcome-flip count.
 * Limb A (null scaling): --contrast <dir> --treat <labelPrefix> → pooled Δ,
 * one-sided U (treat-lower orientation), pair table, fire/leak tallies.
 *
 * Zero-paid; pure computation over result.json files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function args(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
      out.push(process.argv[i + 1]);
  }
  return out;
}

function loadDir(dir) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  const rows = new Map();
  for (const arm of fs.readdirSync(abs)) {
    const rj = path.join(abs, arm, 'result.json');
    if (!fs.existsSync(rj)) continue;
    const d = JSON.parse(fs.readFileSync(rj, 'utf8'));
    const rr = d.registerRouter || null;
    rows.set(arm, {
      arm,
      verdict: d.verdict,
      tStar: d.assertedGroundedTurn ?? 29,
      grounded: d.verdict === 'grounded_anagnorisis' ? 1 : 0,
      leaks: (d.events || []).filter((e) => e.type === 'leak').length,
      fires: rr ? rr.decisions.filter((x) => x.register !== 'didactic').map((x) => `${x.turn}:${x.register}`) : null,
      mirrorRefusal: d.mirrorRefusal ? d.mirrorRefusal.outcome : null,
    });
  }
  return rows;
}

function uStat(treat, control) {
  // one-sided U in the treat-lower orientation (smaller = treat faster)
  let u = 0;
  for (const t of treat) for (const c of control) u += t < c ? 1 : t === c ? 0.5 : 0;
  return u;
}

const replications = args('replications');
const contrast = args('contrast')[0];
const treatPrefix = args('treat')[0];
const out = [];

if (replications.length) {
  out.push(`## Limb B — within-seed replications (${replications.length} dirs)`);
  const tables = replications.map(loadDir);
  const labels = [...tables[0].keys()].sort();
  out.push(
    '',
    '| arm | ' + replications.map((d) => path.basename(d)).join(' | ') + ' |',
    `|---|${'---|'.repeat(replications.length)}`,
  );
  let flips = 0;
  for (const label of labels) {
    const cells = tables.map((t) => t.get(label));
    const groundedSet = new Set(cells.filter(Boolean).map((c) => c.grounded));
    if (groundedSet.size > 1) flips++;
    out.push(
      `| ${label} | ` +
        cells
          .map((c) => (c ? `${c.verdict.slice(0, 14)} T*${c.tStar}${c.fires ? ` f${c.fires.length}` : ''}` : '—'))
          .join(' | ') +
        ' |',
    );
  }
  out.push(
    '',
    `**Outcome-flip slots (grounded vs cap-death changed across replications): ${flips} of ${labels.length}**`,
  );
  const leaks = tables.flatMap((t) => [...t.values()]).reduce((s, r) => s + r.leaks, 0);
  out.push(`Leaks across all replications: ${leaks}`);
}

if (contrast && treatPrefix) {
  const rows = [...loadDir(contrast).values()];
  const treat = rows.filter((r) => r.arm.startsWith(treatPrefix));
  const control = rows.filter((r) => r.arm.startsWith('baseline'));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const tT = treat.map((r) => r.tStar);
  const tC = control.map((r) => r.tStar);
  const u = uStat(tT, tC);
  out.push('', `## Limb A — null scaling: ${path.basename(contrast)} (${treatPrefix} vs baseline)`);
  out.push(
    '',
    `- n = ${treat.length}/${control.length}; treat T* mean ${mean(tT).toFixed(2)} vs control ${mean(tC).toFixed(2)}; **Δ = ${(mean(tT) - mean(tC)).toFixed(2)}**; one-sided U (treat-lower) = ${u}/${tT.length * tC.length}`,
    `- grounded: treat ${treat.reduce((s, r) => s + r.grounded, 0)}/${treat.length} vs control ${control.reduce((s, r) => s + r.grounded, 0)}/${control.length}`,
    `- leaks: ${rows.reduce((s, r) => s + r.leaks, 0)}; treat fires: ${treat.reduce((s, r) => s + (r.fires ? r.fires.length : 0), 0)}; mirror-refusal firings: ${treat.filter((r) => r.mirrorRefusal).length}`,
  );
  out.push('', '| pair | control | treat |', '|---|---|---|');
  const idx = (a) => a.arm.match(/-r(\d+)$/)?.[1];
  for (const c of control.sort((a, b) => +idx(a) - +idx(b))) {
    const t = treat.find((r) => idx(r) === idx(c));
    out.push(
      `| r${idx(c)} | ${c.verdict.slice(0, 14)} T*${c.tStar} | ${t ? `${t.verdict.slice(0, 14)} T*${t.tStar}` : '—'} |`,
    );
  }
}

const outDir = args('out')[0] || path.join(ROOT, 'exports', 'classifier-dag', 'shrinkage-probes');
fs.mkdirSync(outDir, { recursive: true });
const name = args('name')[0] || 'probe-report';
fs.writeFileSync(path.join(outDir, `${name}.md`), out.join('\n') + '\n');
console.log(out.join('\n'));
console.log(`\nartifact ${path.relative(process.cwd(), outDir)}/${name}.md`);
