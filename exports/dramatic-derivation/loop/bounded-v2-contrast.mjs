// Cross-arm contrast for the bounded-v2 paid pair (§5 of
// notes/poetics/2026-06-11-act-bounded-learner-design.md).
// Reads only harness-ledgered artifacts: result.json per arm.
// Usage: node exports/dramatic-derivation/loop/bounded-v2-contrast.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const ARMS = ['bounded-v2-probe-on', 'bounded-v2-probe-off'];
const K = 3; // coupling window (turns), fixed in §5

const world = yaml.load(
  fs.readFileSync(path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml'), 'utf8'),
);

const factKey = (fact) => JSON.stringify(fact);

// Premise ids whose fact appears as a base leaf of the secret's proof tree.
function proofPathIds(proof) {
  const baseKeys = new Set();
  (function walk(node) {
    if (!node) return;
    if (node.base) baseKeys.add(factKey(node.fact));
    for (const p of node.premises || []) walk(p);
  })(proof);
  return new Set(world.premises.filter((p) => baseKeys.has(factKey(p.fact))).map((p) => p.id));
}

function actOf(acts, turn) {
  const a = acts.find((x) => turn >= x.turns[0] && turn <= x.turns[1]);
  return a ? a.act : null;
}

// Walk the corruption ledger into slip episodes: each decay opens an episode
// for its premise; the next repair of that premise closes it.
function slipEpisodes(ledger, acts) {
  const open = new Map();
  const episodes = [];
  for (const e of ledger) {
    if (e.type === 'decay') {
      const ep = {
        premiseId: e.premiseId,
        mode: e.mode || 'delete',
        slipTurn: e.turn,
        slipAct: actOf(acts, e.turn),
        repairTurn: null,
        repairAct: null,
        via: null,
      };
      open.set(e.premiseId, ep);
      episodes.push(ep);
    } else if (e.type === 'repair') {
      const ep = open.get(e.premiseId);
      if (ep) {
        ep.repairTurn = e.turn;
        ep.repairAct = actOf(acts, e.turn);
        ep.via = e.via;
        open.delete(e.premiseId);
      }
    }
  }
  return episodes;
}

function loadArm(label) {
  const dir = path.join(ROOT, 'exports/dramatic-derivation/loop', label);
  return JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

for (const label of ARMS) {
  const r = loadArm(label);
  const proofIds = proofPathIds(r.proof);
  const acts = r.acts;
  const episodes = slipEpisodes(r.corruption.ledger, acts);
  const tutorMoves = new Map(
    r.transcript.filter((e) => e.role === 'tutor').map((e) => [e.turn, e.meta]),
  );
  const releases = r.ledger; // staged releases: {turn, premiseId, via}

  console.log(`\n======== ${label} ========`);
  console.log(`verdict ${r.verdict} | turns ${r.turnsPlayed} | acts ${acts.length}`);
  console.log(
    'act spans:',
    acts.map((a) => `A${a.act}[${a.turns[0]}-${a.turns[1]}]`).join(' '),
  );

  // --- slip episodes + same-act/cross-act split ---
  console.log('\nslip episodes (premise slipTurn->repairTurn via, latency, act-split):');
  let same = 0;
  let cross = 0;
  let never = 0;
  for (const ep of episodes) {
    if (ep.repairTurn === null) {
      never += 1;
      console.log(
        `  ${ep.premiseId} t${ep.slipTurn}(A${ep.slipAct}) -> NEVER  [${ep.mode}]`,
      );
      continue;
    }
    const split = ep.slipAct === ep.repairAct ? 'same-act' : 'cross-act';
    if (split === 'same-act') same += 1;
    else cross += 1;
    console.log(
      `  ${ep.premiseId} t${ep.slipTurn}(A${ep.slipAct}) -> t${ep.repairTurn}(A${ep.repairAct}) via ${ep.via}, lat ${ep.repairTurn - ep.slipTurn}, ${split} [${ep.mode}]`,
    );
  }
  console.log(`  split: same-act ${same}, cross-act ${cross}, never ${never}`);

  // --- repair selection signature (tutor-channel repairs only) ---
  console.log('\nrepair selection signature (tutor repairs):');
  for (const ep of episodes.filter((e) => e.via === 'tutor')) {
    const meta = tutorMoves.get(ep.repairTurn) || {};
    const move = meta.move || {};
    const lastRel = releases.filter((x) => x.turn < ep.repairTurn).at(-1);
    const restaged = releases.some(
      (x) => x.turn === ep.repairTurn && x.premiseId === ep.premiseId,
    );
    console.log(
      `  t${ep.repairTurn} ${ep.premiseId}: target=${move.targetPremise} intent=${move.intent} figure=${move.figure}` +
        ` | lastReleaseBefore=${lastRel ? lastRel.premiseId : '-'}` +
        ` ${move.targetPremise === (lastRel && lastRel.premiseId) ? '(== last release)' : '(reach-back)'}` +
        ` | proofPath=${proofIds.has(ep.premiseId)}${restaged ? ' | re-staged same turn' : ''}`,
    );
  }

  // --- reconstruction diagnostics (ON arm only) ---
  const recon = Array.isArray(r.reconstruction) ? r.reconstruction : null;
  if (!recon || recon.length === 0) {
    console.log('\nreconstruction: absent (adapt-OFF arm)');
    continue;
  }

  let gapInstances = 0;
  const caught = []; // {premiseId, turn}
  let jSum = 0;
  const jByAct = new Map();
  for (const row of recon) {
    const missTruth = row.truth.missing || [];
    const missBelief = row.believed.believed_missing || [];
    gapInstances += missTruth.length;
    for (const p of missTruth) if (missBelief.includes(p)) caught.push({ premiseId: p, turn: row.turn });
    const j = jaccard(missBelief, missTruth);
    jSum += j;
    const act = actOf(acts, row.turn);
    if (!jByAct.has(act)) jByAct.set(act, []);
    jByAct.get(act).push(j);
  }
  console.log(
    `\nreconstruction: gap instances ${gapInstances}, caught ${caught.length} (${((caught.length / gapInstances) * 100).toFixed(1)}%), mean Jaccard(missing) ${(jSum / recon.length).toFixed(3)}`,
  );
  console.log(
    '  Jaccard by act:',
    [...jByAct.entries()]
      .map(([a, js]) => `A${a}=${(js.reduce((s, x) => s + x, 0) / js.length).toFixed(2)}`)
      .join(' '),
  );

  // Direction A: for each repair, was the premise named believed_missing in
  // any theory commit within the K turns before the repair?
  console.log(`\ntheory->repair coupling (k=${K}):`);
  for (const ep of episodes.filter((e) => e.repairTurn !== null)) {
    const preceded = recon.some(
      (row) =>
        row.turn >= ep.repairTurn - K &&
        row.turn < ep.repairTurn &&
        (row.believed.believed_missing || []).includes(ep.premiseId),
    );
    console.log(
      `  repair ${ep.premiseId}@t${ep.repairTurn}: named missing in t[${ep.repairTurn - K},${ep.repairTurn - 1}]? ${preceded ? 'YES' : 'no'}`,
    );
  }

  // Direction B (converse): of the caught gap instances, how many were
  // followed by a repair of that premise within K turns?
  const repairsByPremise = new Map();
  for (const ep of episodes.filter((e) => e.repairTurn !== null)) {
    if (!repairsByPremise.has(ep.premiseId)) repairsByPremise.set(ep.premiseId, []);
    repairsByPremise.get(ep.premiseId).push(ep.repairTurn);
  }
  let actedOn = 0;
  for (const c of caught) {
    const hit = (repairsByPremise.get(c.premiseId) || []).some(
      (t) => t > c.turn && t <= c.turn + K,
    );
    if (hit) actedOn += 1;
    console.log(
      `  caught ${c.premiseId}@t${c.turn}: repaired within ${K}? ${hit ? 'YES' : 'no'}`,
    );
  }
  console.log(
    `  converse: ${actedOn}/${caught.length} caught instances repaired within ${K} turns`,
  );
}
