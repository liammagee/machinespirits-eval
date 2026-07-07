// Cross-arm contrast for the lantern revise probe (§6 of
// notes/poetics/2026-06-11-act-bounded-learner-design.md).
// Extends bounded-v2-contrast.mjs with the mutation/false-belief quantities.
// Usage: node exports/dramatic-derivation/loop/lantern-revise-contrast.mjs [onLabel offLabel]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const ARMS = process.argv.length > 3 ? process.argv.slice(2, 4) : ['lantern-revise-on', 'lantern-revise-off'];
const K = 3; // coupling window (turns), fixed in §5/§6

const world = yaml.load(
  fs.readFileSync(path.join(ROOT, 'config/drama-derivation/world-002-lantern.yaml'), 'utf8'),
);

const factKey = (fact) => JSON.stringify(fact);

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

// Walk the corruption ledger into episodes. A decay opens an episode for its
// premise (delete: one debt; mutate: deletion debt + false-belief debt). The
// next `repair` of that premise closes the deletion debt; the next
// `retract_false` matching the false form closes the false-belief debt.
function slipEpisodes(ledger, acts) {
  const openDeletion = new Map(); // premiseId -> episode
  const openFalse = []; // [{episode}] in order, matched by falseForm
  const episodes = [];
  for (const e of ledger) {
    if (e.type === 'decay') {
      const ep = {
        premiseId: e.premiseId,
        mode: e.mode || 'delete',
        falseForm: e.falseForm || null,
        slipTurn: e.turn,
        slipAct: actOf(acts, e.turn),
        repairTurn: null,
        repairAct: null,
        via: null,
        retractTurn: null,
      };
      openDeletion.set(e.premiseId, ep);
      if (ep.mode === 'mutate') openFalse.push(ep);
      episodes.push(ep);
    } else if (e.type === 'repair') {
      const ep = openDeletion.get(e.premiseId);
      if (ep) {
        ep.repairTurn = e.turn;
        ep.repairAct = actOf(acts, e.turn);
        ep.via = e.via;
        openDeletion.delete(e.premiseId);
      }
    } else if (e.type === 'retract_false') {
      const idx = openFalse.findIndex(
        (ep) => ep.retractTurn === null && factKey(ep.falseForm) === factKey(e.falseForm),
      );
      if (idx >= 0) openFalse[idx].retractTurn = e.turn;
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
  const learnerMeta = new Map(
    r.transcript.filter((e) => e.role === 'learner').map((e) => [e.turn, e.meta]),
  );
  const releases = r.ledger;

  console.log(`\n======== ${label} ========`);
  console.log(`verdict ${r.verdict} | turns ${r.turnsPlayed} | acts ${acts.length}`);
  console.log(
    'act spans:',
    acts.map((a) => `A${a.act}[${a.turns[0]}-${a.turns[1]}]`).join(' '),
  );

  // --- slip-mode mix ---
  const mutations = episodes.filter((e) => e.mode === 'mutate');
  const deletes = episodes.filter((e) => e.mode !== 'mutate');
  console.log(`\nslip mix: ${mutations.length} mutate, ${deletes.length} delete`);

  // --- episodes with both debts ---
  console.log('\nslip episodes:');
  let same = 0;
  let cross = 0;
  let never = 0;
  for (const ep of episodes) {
    const repair =
      ep.repairTurn === null
        ? 'deletion debt OPEN'
        : `repaired t${ep.repairTurn}(A${ep.repairAct}) via ${ep.via}, lat ${ep.repairTurn - ep.slipTurn}, ${ep.slipAct === ep.repairAct ? 'same-act' : 'cross-act'}`;
    if (ep.repairTurn === null) never += 1;
    else if (ep.slipAct === ep.repairAct) same += 1;
    else cross += 1;
    const falseDebt =
      ep.mode !== 'mutate'
        ? ''
        : ep.retractTurn === null
          ? ' | false form STANDS at end'
          : ` | false form retracted t${ep.retractTurn}, lat ${ep.retractTurn - ep.slipTurn}`;
    console.log(
      `  ${ep.premiseId} t${ep.slipTurn}(A${ep.slipAct}) [${ep.mode}]${ep.falseForm ? ` false=${JSON.stringify(ep.falseForm)}` : ''}: ${repair}${falseDebt}`,
    );
  }
  console.log(`  deletion-debt split: same-act ${same}, cross-act ${cross}, never ${never}`);
  const retracted = mutations.filter((e) => e.retractTurn !== null);
  console.log(
    `  false-belief debts: ${mutations.length} opened, ${retracted.length} retracted, ${mutations.length - retracted.length} standing at end`,
  );

  // --- prompted vs spontaneous retraction ---
  if (retracted.length) {
    console.log('\nretraction context (what preceded each retract_false):');
    for (const ep of retracted) {
      const window = [ep.retractTurn - 1, ep.retractTurn];
      const restage = releases.some((x) => window.includes(x.turn) && x.premiseId === ep.premiseId);
      const repairedJustBefore = ep.repairTurn !== null && window.includes(ep.repairTurn);
      const moveTargeted = window.some((t) => {
        const m = tutorMoves.get(t);
        return m && m.move && m.move.targetPremise === ep.premiseId;
      });
      const cls = restage || repairedJustBefore ? 'restage-prompted' : moveTargeted ? 'move-prompted' : 'spontaneous';
      console.log(
        `  ${ep.premiseId} retract@t${ep.retractTurn}: restage=${restage || repairedJustBefore} moveTarget=${moveTargeted} -> ${cls}`,
      );
    }
  }

  // --- false-form consequence candidates (descriptive; for manual read) ---
  const falseKeys = new Set(mutations.map((e) => factKey(e.falseForm)));
  const consequences = [];
  for (const [turn, meta] of learnerMeta) {
    for (const f of meta?.derive || []) if (falseKeys.has(factKey(f))) consequences.push(`derive ${factKey(f)} @t${turn}`);
    for (const f of meta?.adopt || []) if (falseKeys.has(factKey(f))) consequences.push(`adopt ${factKey(f)} @t${turn}`);
  }
  for (const v of [...(r.inference?.voiced || []), ...(r.inference?.overreaches || [])]) {
    if (falseKeys.has(factKey(v.fact))) consequences.push(`voiced/overreach ${factKey(v.fact)} @t${v.turn}`);
  }
  console.log(
    `\nfalse-form consequence candidates (ledger-visible only): ${consequences.length ? consequences.join('; ') : 'none'}`,
  );

  // --- repair selection signature (tutor repairs) ---
  console.log('\nrepair selection signature (tutor repairs):');
  for (const ep of episodes.filter((e) => e.via === 'tutor')) {
    const meta = tutorMoves.get(ep.repairTurn) || {};
    const move = meta.move || {};
    const lastRel = releases.filter((x) => x.turn < ep.repairTurn).at(-1);
    console.log(
      `  t${ep.repairTurn} ${ep.premiseId}: target=${move.targetPremise} intent=${move.intent}` +
        ` ${move.targetPremise === (lastRel && lastRel.premiseId) ? '(== last release)' : '(reach-back)'}` +
        ` | proofPath=${proofIds.has(ep.premiseId)}`,
    );
  }

  // --- reconstruction diagnostics (ON arm only) ---
  const recon = Array.isArray(r.reconstruction) ? r.reconstruction : null;
  if (!recon || recon.length === 0) {
    console.log('\nreconstruction: absent (adapt-OFF arm)');
    continue;
  }

  let gapInstances = 0;
  let gapCaught = 0;
  let mistakenInstances = 0;
  const mistakenCaught = []; // {premiseId, turn}
  let jSum = 0;
  for (const row of recon) {
    const missTruth = row.truth.missing || [];
    const missBelief = row.believed.believed_missing || [];
    gapInstances += missTruth.length;
    gapCaught += missTruth.filter((p) => missBelief.includes(p)).length;
    const misTruth = row.truth.mistaken || [];
    const misBelief = row.believed.believed_mistaken || [];
    mistakenInstances += misTruth.length;
    for (const p of misTruth) if (misBelief.includes(p)) mistakenCaught.push({ premiseId: p, turn: row.turn });
    jSum += jaccard(missBelief, missTruth);
  }
  console.log(
    `\nreconstruction: missing-detection ${gapCaught}/${gapInstances}` +
      `${gapInstances ? ` (${((gapCaught / gapInstances) * 100).toFixed(1)}%)` : ''}` +
      ` | mistaken-detection ${mistakenCaught.length}/${mistakenInstances}` +
      `${mistakenInstances ? ` (${((mistakenCaught.length / mistakenInstances) * 100).toFixed(1)}%)` : ''}` +
      ` | mean Jaccard(missing) ${(jSum / recon.length).toFixed(3)}`,
  );

  // theory->retraction coupling (k=K), both directions
  console.log(`\ntheory->retraction coupling (k=${K}):`);
  for (const ep of mutations.filter((e) => e.retractTurn !== null)) {
    const preceded = recon.some(
      (row) =>
        row.turn >= ep.retractTurn - K &&
        row.turn < ep.retractTurn &&
        (row.believed.believed_mistaken || []).includes(ep.premiseId),
    );
    console.log(
      `  retraction ${ep.premiseId}@t${ep.retractTurn}: named mistaken in t[${ep.retractTurn - K},${ep.retractTurn - 1}]? ${preceded ? 'YES' : 'no'}`,
    );
  }
  const retractTurnsByPremise = new Map();
  for (const ep of mutations.filter((e) => e.retractTurn !== null)) {
    if (!retractTurnsByPremise.has(ep.premiseId)) retractTurnsByPremise.set(ep.premiseId, []);
    retractTurnsByPremise.get(ep.premiseId).push(ep.retractTurn);
  }
  let actedOn = 0;
  for (const c of mistakenCaught) {
    const hit = (retractTurnsByPremise.get(c.premiseId) || []).some((t) => t > c.turn && t <= c.turn + K);
    if (hit) actedOn += 1;
  }
  console.log(
    `  converse: ${actedOn}/${mistakenCaught.length} caught mistaken-instances retracted within ${K} turns`,
  );
}
