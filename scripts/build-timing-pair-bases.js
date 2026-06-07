#!/usr/bin/env node
/**
 * build-timing-pair-bases.js — step 2 of the contrastive timing-pair design (zero-API).
 *
 * Adapts the held-out replay SURVIVORS (real bridged transcripts that passed the local
 * public-causal-bridge gate) into tagged base transcripts, then emits the 2x2 timing arms via
 * services/ontology/timingPairGenerator.js. No paid calls — pure parse + reorder. The output
 * JSON is what the step-3 blind-panel pilot consumes.
 *
 * Tagging: the transcript is ROLE: [action] "speech" blocks; revision.json's move_ledger gives
 * learner-side anchors (evidence_quote) for the reframe. We locate:
 *   reframe       = the last learner turn (matched to the final move_ledger evidence_quote),
 *   pivotalMove   = the last TUTOR turn before the reframe (the mechanism-change),
 *   obstruction   = the last STAGE turn before the move (the public obstruction event).
 * Each base self-validates by round-tripping through generateTimingArms (throws on bad tags).
 *
 *   node scripts/build-timing-pair-bases.js [i01-replay-dir] [out.json]
 *
 * The neutral move is a TEMPLATED PLACEHOLDER flagged for review: a register-matched,
 * mechanism-free neutral must be authored (hand or LLM) before the paid run — same
 * matched-control discipline as prompts/tutor-ego-placebo.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateTimingArms } from '../services/ontology/timingPairGenerator.js';

const DEFAULT_REPLAY =
  'exports/discursive-replay-loops/discursive-replay-loop-heldout-stratified-fixed-20260605/i01-replay';
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const replayDir = positional[0] || DEFAULT_REPLAY;
const decFlag = (flags.find((f) => f.startsWith('--decoupling')) || '').split('=')[1] || 'displacement';
const decoupling = ['displacement', 'postemption'].includes(decFlag) ? decFlag : 'displacement';
const outPath =
  positional[1] ||
  `exports/timing-pair-bases-heldout-20260605${decoupling === 'postemption' ? '-postemption' : ''}.json`;

// Authored matched neutrals (the C/D arms). Fall back to a flagged placeholder where absent.
let authoredNeutrals = {};
try {
  authoredNeutrals = JSON.parse(fs.readFileSync('config/timing-pair-neutrals.json', 'utf8')).neutrals || {};
} catch {
  authoredNeutrals = {};
}

// Parse "ROLE: [action] \"speech\"" blocks (separated by blank lines) into role-tagged turns.
function parseTranscript(txt) {
  const blocks = String(txt)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const turns = [];
  for (const b of blocks) {
    const m = b.match(/^(STAGE|LEARNER|TUTOR):\s*([\s\S]*)$/);
    if (!m) continue;
    turns.push({ role: m[1].toLowerCase(), text: m[2].replace(/\s+/g, ' ').trim() });
  }
  return turns;
}

const normq = (s) =>
  String(s || '')
    .replace(/[“”"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Locate obstruction < pivotalMove(tutor) < reframe(learner). Returns null if no clean bridge.
function tagTurns(turns, ledger) {
  const learnerIdx = turns.map((t, i) => (t.role === 'learner' ? i : -1)).filter((i) => i >= 0);
  if (!learnerIdx.length) return null;
  let reframe = learnerIdx[learnerIdx.length - 1];
  const lastQuote = Array.isArray(ledger) && ledger.length ? normq(ledger[ledger.length - 1].evidence_quote) : '';
  if (lastQuote.length >= 12) {
    const probe = lastQuote.slice(0, 30);
    const hit = learnerIdx.find((i) => normq(turns[i].text).includes(probe));
    if (hit != null) reframe = hit;
  }
  const before = (pred, lt) => [...turns.keys()].filter((i) => i < lt && pred(turns[i])).pop();
  const pivotalMove = before((t) => t.role === 'tutor', reframe);
  if (pivotalMove == null) return null;
  let obstruction = before((t) => t.role === 'stage', pivotalMove);
  if (obstruction == null) obstruction = before((t) => t.role !== 'tutor', pivotalMove);
  if (obstruction == null) obstruction = 0;
  if (!(obstruction < pivotalMove && pivotalMove < reframe)) return null;
  return { obstruction, pivotalMove, reframe };
}

// Templated, mechanism-free placeholder. FLAGGED: a register-matched neutral must be authored
// before the paid run (a smoother reminder that does no test/device change — the C/D arms).
function neutralPlaceholder() {
  return '[the tutor keeps the materials as they are.] "Good — you have worked through that carefully. Look over what you have set out once more and tell me what you notice before we go on."';
}

function domainOf(id) {
  if (/T15/.test(id)) return 'element-tile';
  if (/T18/.test(id)) return 'arrow-direction';
  if (/T24/.test(id)) return 'music-meter';
  return 'unknown';
}

function armOf(id) {
  const m = id.match(/-(none|peripeteia-only|routine)-T\d+$/);
  return m ? m[1] : 'unknown';
}

if (!fs.existsSync(replayDir)) {
  console.error(`replay dir not found: ${replayDir}`);
  process.exit(1);
}
const candidates = fs
  .readdirSync(replayDir)
  .filter((d) => /^phase2-/.test(d) && fs.statSync(path.join(replayDir, d)).isDirectory());

const bases = [];
const skipped = [];
for (const id of candidates) {
  const dir = path.join(replayDir, id);
  const txtPath = path.join(dir, 'revised-public.txt');
  const revPath = path.join(dir, 'revision.json');
  if (!fs.existsSync(txtPath)) {
    skipped.push({ id, reason: 'no revised-public.txt' });
    continue;
  }
  const turns = parseTranscript(fs.readFileSync(txtPath, 'utf8'));
  let ledger = null;
  try {
    ledger = JSON.parse(fs.readFileSync(revPath, 'utf8')).move_ledger;
  } catch {
    ledger = null;
  }
  const tags = turns.length >= 3 ? tagTurns(turns, ledger) : null;
  if (!tags) {
    skipped.push({ id, reason: `no clean bridge (turns=${turns.length})` });
    continue;
  }
  const authored = authoredNeutrals[id];
  const neutralMove = authored || neutralPlaceholder();
  let built;
  try {
    built = generateTimingArms({ turns, tags, neutralMove, decoupling }); // self-validates (throws on bad tags)
  } catch (e) {
    skipped.push({ id, reason: `generator rejected: ${e.message}` });
    continue;
  }
  if (!built.invariants.onlyBridgedIsInduced || !built.invariants.pivotalTimingPreservesContent) {
    skipped.push({ id, reason: 'invariant violation' });
    continue;
  }
  bases.push({
    sourceId: id,
    domain: domainOf(id),
    sourceArm: armOf(id),
    nTurns: turns.length,
    tags,
    pivotalMoveText: turns[tags.pivotalMove].text,
    pivotalMoveChars: turns[tags.pivotalMove].text.length,
    neutralMove,
    neutralProvenance: authored ? 'authored-matched' : 'templated-placeholder-REVIEW-BEFORE-PAID',
    arms: built.arms,
    invariants: built.invariants,
  });
}

const out = {
  generatedFrom: replayDir,
  design: 'notes/poetics/2026-06-05-contrastive-timing-pair-design.md',
  decoupling,
  note:
    'zero-API step 2. neutralMove is a placeholder; author a register-matched neutral before the paid panel. ' +
    `Decoupling=${decoupling}: ` +
    (decoupling === 'displacement'
      ? 'move upstream of the obstruction — coherent, breaks device-necessitation (preferred).'
      : 'move after the reframe — robustness arm; risks incoherence (effect before cause).'),
  nBases: bases.length,
  bases,
  skipped,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

// Report
const pad = (s, n) => String(s).padEnd(n);
console.log(`Tagged ${bases.length}/${candidates.length} survivors from ${replayDir}\n`);
console.log(
  pad('domain', 16) + '| ' + pad('arm', 16) + '| ' + pad('turns', 6) + '| ' + pad('tags o/p/r', 12) + '| inv | source',
);
console.log('-'.repeat(100));
for (const b of bases) {
  console.log(
    pad(b.domain, 16) +
      '| ' +
      pad(b.sourceArm, 16) +
      '| ' +
      pad(b.nTurns, 6) +
      '| ' +
      pad(`${b.tags.obstruction}/${b.tags.pivotalMove}/${b.tags.reframe}`, 12) +
      '| ' +
      (b.invariants.onlyBridgedIsInduced && b.invariants.moveTypeDiffersByOneTurn ? ' ok ' : 'FAIL') +
      '| ' +
      b.sourceId.replace(/^phase2-adaptation-recognition-loop-/, ''),
  );
}
if (skipped.length) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s.reason}: ${s.id.replace(/^phase2-adaptation-recognition-loop-/, '')}`);
}
const byDomain = bases.reduce((m, b) => ((m[b.domain] = (m[b.domain] || 0) + 1), m), {});
console.log(`\nBy domain: ${JSON.stringify(byDomain)}`);
console.log(`Wrote ${outPath}`);
