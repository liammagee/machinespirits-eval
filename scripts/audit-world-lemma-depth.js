#!/usr/bin/env node
/**
 * Gate-0 depth audit for the proof-structure lemma layer
 * (LEMMA-LAYER line, 2026-07-04): before any engine work, does the existing
 * world catalog contain proofs deep enough that a HIGHER-level proof
 * structure has real decisions to make?
 *
 * Lemma candidates = intermediate derived facts on the authored proof path
 * (the closure's non-base facts inside S's proof tree, S excluded). The
 * lemma layer only has content if their grounding ORDER is a genuine choice:
 * a totally ordered set of intermediates gives a frontier of width 1 and
 * nothing to decide.
 *
 * Per world (per authored proof_path, best path wins):
 *   intermediates  # derived facts strictly between premises and S
 *   depth          longest derived-fact chain ending at S (S included)
 *   width          max antichain of the intermediate partial order
 *   linExt         # of valid grounding orders (linear extensions)
 *   joins          # derived facts with >= 2 derived parents (AND-joins)
 *
 * Verdict tiers:
 *   RICH     intermediates >= 3 AND linExt >= 3  (multi-way frontier choice)
 *   MINIMAL  linExt == 2                         (a single binary interleave)
 *   NONE     linExt <= 1                         (total order or no lemmas)
 *
 * Pure computation — no API calls, no DB. Reuses the engine's own chainer so
 * "derivable" here is exactly the engine's notion.
 *
 * Usage: node scripts/audit-world-lemma-depth.js
 *          [--worlds config/drama-derivation] [--out exports/dramatic-derivation/lemma-layer]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { closure, factKey } from '../services/dramaticDerivation/chainer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    worlds: path.join(ROOT, 'config/drama-derivation'),
    out: path.join(ROOT, 'exports/dramatic-derivation/lemma-layer'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--worlds') opts.worlds = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--out') opts.out = path.resolve(ROOT, argv[++i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return opts;
}

/** Derived-fact DAG restricted to S's proof: nodes + derived->derived edges. */
function lemmaDag(world, premiseIds) {
  const byId = new Map(world.premises.map((p) => [p.id, p]));
  const baseFacts = premiseIds.map((id) => {
    const p = byId.get(id);
    if (!p) throw new Error(`proof path names unknown premise ${id}`);
    return p.fact;
  });
  const { proofs } = closure(baseFacts, world.rules);
  const goalKey = factKey(world.secret.fact);
  if (!proofs.has(goalKey)) return null;

  // walk S's proof as a graph (visited set — diamonds share subproofs)
  const nodes = new Set();
  const parents = new Map(); // derivedKey -> Set(derived parent keys)
  const stack = [goalKey];
  while (stack.length) {
    const key = stack.pop();
    const proof = proofs.get(key);
    if (!proof || nodes.has(key)) continue; // base fact or already expanded
    nodes.add(key);
    const derivedParents = new Set();
    for (const premKey of proof.premises) {
      if (proofs.get(premKey)) {
        derivedParents.add(premKey);
        stack.push(premKey);
      }
    }
    parents.set(key, derivedParents);
  }
  return { nodes, parents, goalKey };
}

function analyze(dag) {
  const { nodes, parents, goalKey } = dag;
  const order = [...nodes];
  const idx = new Map(order.map((k, i) => [k, i]));

  // ancestor closure over derived nodes (bitmask per node; n is tiny)
  const anc = order.map(() => 0n);
  const depthOf = new Map();
  const depth = (key) => {
    if (depthOf.has(key)) return depthOf.get(key);
    let d = 1;
    let mask = 0n;
    for (const p of parents.get(key)) {
      d = Math.max(d, depth(p) + 1);
      mask |= anc[idx.get(p)] | (1n << BigInt(idx.get(p)));
    }
    anc[idx.get(key)] = mask;
    depthOf.set(key, d);
    return d;
  };
  const dagDepth = depth(goalKey);

  const inter = order.filter((k) => k !== goalKey);
  const m = inter.length;
  const before = inter.map((k) => inter.map((j) => (anc[idx.get(k)] & (1n << BigInt(idx.get(j)))) !== 0n)); // before[i][j] = inter[j] is an ancestor of inter[i]

  // width: max antichain by brute force (m <= ~10 across the catalog)
  let width = 0;
  for (let s = 0; s < 1 << m; s += 1) {
    const members = [];
    for (let i = 0; i < m; i += 1) if (s & (1 << i)) members.push(i);
    if (members.length <= width) continue;
    const chainFree = members.every((a) => members.every((b) => a === b || (!before[a][b] && !before[b][a])));
    if (chainFree) width = members.length;
  }

  // linear extensions: bitmask DP over placement order
  const predMask = inter.map((_, i) => {
    let mask = 0;
    for (let j = 0; j < m; j += 1) if (before[i][j]) mask |= 1 << j;
    return mask;
  });
  const f = new Array(1 << m).fill(0);
  f[0] = 1;
  for (let s = 0; s < 1 << m; s += 1) {
    if (!f[s]) continue;
    for (let i = 0; i < m; i += 1) {
      if (s & (1 << i)) continue;
      if ((predMask[i] & s) === predMask[i]) f[s | (1 << i)] += f[s];
    }
  }
  const linExt = f[(1 << m) - 1];

  const joins = order.filter((k) => parents.get(k).size >= 2).length;
  return { intermediates: m, depth: dagDepth, width, linExt, joins };
}

function verdictOf(a) {
  if (a.intermediates >= 3 && a.linExt >= 3) return 'RICH';
  if (a.linExt === 2) return 'MINIMAL';
  return 'NONE';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = fs
    .readdirSync(opts.worlds)
    .filter((f) => /^world-.*\.yaml$/.test(f))
    .sort();
  const rows = [];
  for (const file of files) {
    const full = path.join(opts.worlds, file);
    let world;
    try {
      world = loadWorld(full);
    } catch (err) {
      rows.push({ file, error: String(err.message || err).slice(0, 100) });
      continue;
    }
    const paths = world.proofPaths || [];
    let best = null;
    const perPath = [];
    for (const p of paths) {
      const dag = lemmaDag(world, p.premises);
      if (!dag) {
        perPath.push({ premises: p.premises.length, entails: false });
        continue;
      }
      const a = analyze(dag);
      perPath.push({ premises: p.premises.length, entails: true, ...a });
      if (!best || a.linExt > best.linExt || (a.linExt === best.linExt && a.intermediates > best.intermediates))
        best = a;
    }
    rows.push({
      file,
      id: world.id,
      turnCap: world.turnCap ?? null,
      tMin: world.slope?.t_min ?? null,
      pathCount: paths.length,
      perPath,
      best,
      verdict: best ? verdictOf(best) : 'NO-PROOF',
    });
  }

  const pad = (s, w) => String(s ?? '—').padEnd(w);
  const lines = [];
  lines.push(
    pad('world', 42) +
      pad('inter', 7) +
      pad('depth', 7) +
      pad('width', 7) +
      pad('linExt', 8) +
      pad('joins', 7) +
      pad('cap', 6) +
      pad('paths', 7) +
      'verdict',
  );
  for (const r of rows) {
    if (r.error) {
      lines.push(pad(r.file, 42) + `LOAD ERROR: ${r.error}`);
      continue;
    }
    const b = r.best || {};
    lines.push(
      pad(r.id, 42) +
        pad(b.intermediates, 7) +
        pad(b.depth, 7) +
        pad(b.width, 7) +
        pad(b.linExt, 8) +
        pad(b.joins, 7) +
        pad(r.turnCap, 6) +
        pad(r.pathCount, 7) +
        r.verdict,
    );
  }
  const table = lines.join('\n');
  console.log(table);

  const tally = {};
  for (const r of rows) tally[r.verdict || 'ERROR'] = (tally[r.verdict || 'ERROR'] || 0) + 1;
  console.log(`\ntally: ${JSON.stringify(tally)}`);

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(
    path.join(opts.out, 'gate0-depth-audit.json'),
    JSON.stringify({ generatedBy: 'scripts/audit-world-lemma-depth.js', rows, tally }, null, 2),
  );
  fs.writeFileSync(
    path.join(opts.out, 'gate0-depth-audit.md'),
    `# Lemma-layer Gate 0 — world depth audit\n\n` +
      `Lemma candidates = intermediate derived facts on the authored proof path; a lemma layer only has content when their grounding order is a real choice (linExt >= 2).\n\n` +
      '```\n' +
      table +
      '\n```\n\n' +
      `Tally: ${JSON.stringify(tally)}\n`,
  );
  console.log(`\nreport at ${path.relative(ROOT, opts.out)}/gate0-depth-audit.{json,md}`);
}

main();
