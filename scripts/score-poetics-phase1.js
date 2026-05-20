#!/usr/bin/env node
/**
 * Poetics Phase-1 scorer — structural anti-simulation gate.
 *
 * Phase 0 proved the holistic rubric can rank-order known recognition vs known
 * flat. Phase 1 adds the STRUCTURAL measure that says *why* a trap is flat,
 * without leaning on a critic's holistic read — and does so in a way that does
 * NOT depend on whether the model recognises the (canonical) text.
 *
 * Construct (config/poetics-calibration/PHASE1-DESIGN.md §2-§3). "Surprising yet
 * inevitable" is decomposed into two foreknowledge-invariant structural axes:
 *
 *   RUPTURE          — does the pivot turn depart from the naive forward
 *                      trajectory the prior turns themselves set up?
 *   RECONTEXTUALIZATION (PRIMARY) — does the pivot re-semanticize the EARLIER
 *                      turns: do they now mean something they did not appear to?
 *
 * Genuine peripeteia ruptures AND recoheres. The vocabulary-trap (S1/S2) does
 * neither: it is fluent and coherent and emotionally loud, but nothing earlier
 * is re-read. Recontextualization is the discriminator because it is
 * foreknowledge-invariant: knowing the canon does not change whether the
 * herdsman's revelation flips the meaning of Oedipus's prior investigation (it
 * does), nor whether a trivial fractions exchange means something new after
 * "a veil has been drawn back" (it does not).
 *
 * BLIND. The critic sees only the numbered transcript in corpus/<id>.txt; the
 * pole and the held-out reversal_turn live in key.yaml and are joined only AFTER
 * scoring. Keep the critic model distinct from any item's author (the two trap
 * items are Claude-authored → prefer --model gpt for a clean primary critic).
 *
 * Reversal localization (§4): this scorer uses (a) scan-and-self-identify — one
 * blinded whole-dialogue call per item; the critic proposes the pivot turn and
 * is graded on it. The pre-registered PREFERRED method is (b) max-split (score
 * recontextualization at every turn-split, take the argmax); that is a more
 * expensive follow-up, not built here. The single-call path is sound precisely
 * because the reframing makes the axes foreknowledge-invariant.
 *
 * Usage:
 *   node scripts/score-poetics-phase1.js [--model claude-code|sonnet|gpt|haiku]
 *        [--concurrency 3] [--mock] [--out exports/poetics-phase1-<ts>.json]
 *
 * --mock returns deterministic neutral stubs (no API) to smoke the plumbing.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import {
  normalizeForMatch,
  callModel,
  parseJsonResponse,
  runWithConcurrency,
  MODEL_MAP,
} from './score-poetics-calibration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'config/poetics-calibration/corpus');
const KEY_PATH = path.join(ROOT, 'config/poetics-calibration/key.yaml');

// Pre-registered Phase-1 gate defaults (used if key.yaml has no gate_phase1 block).
// Score→0-100 map is {1:0, 2:25, 3:50, 4:75, 5:100}. "Surprising" should mean the
// critic affirmatively rated rupture present (4-5 → 75-100), so the cut sits ABOVE
// the neutral midpoint (a clamped/neutral 3 = 50 reads as "can't tell", NOT
// surprising). Coherence is gentler: anything from "moderately coherent" (3) up
// counts (noise is 1-2), so its cut sits AT the midpoint.
const GATE_DEFAULTS = {
  min_recon_margin: 30, // mean(high) - mean(flat) on recontextualization, 0-100
  surprising_threshold: 62.5, // quadrant cut on rupture (>=): 4-5 only
  coherent_threshold: 50, // quadrant cut on coherence (>=): 3+ counts
};

// ── Critic prompt (Phase-1 axes; defined here, not from the Phase-0 rubric) ────

function numberTranscript(turns) {
  return turns.map((t, i) => `[${i + 1}] ${t}`).join('\n');
}

function buildPhase1Prompt(turns) {
  const numbered = numberTranscript(turns);
  return `You are a structural critic of dramatic FORM in a short dialogue. You are
given ONLY the transcript, with each turn numbered [1], [2], …; speakers are
labelled A, B, C, … Score ONLY what is on the page.

You are NOT scoring affect, warmth, politeness, or the VOCABULARY of insight. A
turn that announces "I see it all now", "a breakthrough", "this changes
everything" is NOT, by saying so, a dramatic reversal. Score the STRUCTURE, not
the words that name it.

Your scores must be FOREKNOWLEDGE-INVARIANT: they must not depend on whether you
recognise the text. A famous reversal you have read a hundred times is still a
reversal; an unfamiliar insight-gush is still flat.

Do the following.

1. REVERSAL TURN. Identify the ONE turn that best functions as the dramatic pivot
   — the turn where the dialogue turns. If the dialogue has no genuine pivot (it
   is flat exposition, or it only ASSERTS a realization without enacting one),
   set reversal_turn to null.

2. RUPTURE (score 1-5). Look only at the turns BEFORE the reversal turn. They set
   up a naive forward trajectory — an expected next development. Does the reversal
   turn DEPART from that trajectory?
     5 = the reversal turns against where the prior turns were pointing.
     1 = the "reversal" continues exactly where the prior turns were heading, or
         there is no pivot at all.
   State the naive_trajectory the prior turns set up (one sentence), then quote
   the reversal turn VERBATIM as evidence.

3. RECONTEXTUALIZATION (score 1-5). THE CENTRAL TEST. In light of the reversal
   turn, does the SIGNIFICANCE of the EARLIER turns change — do they now mean
   something they did not appear to mean; are they re-read, re-semanticized?
     5 = earlier turns are decisively re-semanticized; what they meant flips.
     1 = earlier turns mean exactly the same before and after; nothing is re-read.
   You MUST quote the specific EARLIER material (from a turn BEFORE the reversal
   turn) whose meaning changes, VERBATIM, in recohered_earlier. If nothing earlier
   is re-read, score 1-2 and leave recohered_earlier empty.

4. GLOBAL COHERENCE (score 1-5). Independent of the above: is this a coherent,
   well-formed exchange (5) or disjointed noise (1)? Note: a flat catechism and a
   fluent insight-gush are BOTH coherent — coherence is not a mark of drama.

5. SOURCE RECOGNITION. Give your confidence 0.0-1.0 that you recognise the
   specific source, and a one-word guess. THIS DOES NOT AFFECT YOUR SCORES — score
   the structure identically whether or not you recognise it. (Used only to audit
   leakage.)

EVIDENCE GATE (strict): any score of 4 or 5 REQUIRES a VERBATIM quote in the
matching evidence field — rupture from the reversal turn, recontextualization
from an EARLIER turn, coherence from anywhere in the transcript. No exact quote →
you may not score above 3.

TRANSCRIPT:
---
${numbered}
---

Return ONLY this JSON object (no prose before or after):
{
  "reversal_turn": <integer turn number, or null>,
  "rupture": { "score": <integer 1-5>, "naive_trajectory": "<one sentence>", "evidence": "<verbatim from the reversal turn>" },
  "recontextualization": { "score": <integer 1-5>, "recohered_earlier": "<verbatim from an EARLIER turn, or empty string>", "justification": "<one sentence>" },
  "global_coherence": { "score": <integer 1-5>, "evidence": "<verbatim, or empty string>" },
  "source_recognized": { "confidence": <0.0-1.0>, "guess": "<one word>" }
}`;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

const to100 = (s) => Math.round(((Math.max(1, Math.min(5, s)) - 1) / 4) * 100 * 10) / 10;

// True iff every substantial (>=8 char) ellipsis-separated fragment of `evidence`
// occurs verbatim in `haystack` (after typographic/label normalisation). Mirrors
// the Phase-0 evidence gate, but Phase 1 applies it per-axis against a DIFFERENT
// haystack (reversal turn / earlier-portion / whole transcript).
function evidencePresent(evidence, haystack) {
  const hay = normalizeForMatch(haystack);
  if (!hay) return false;
  const frags = normalizeForMatch(evidence)
    .split(/\s*(?:\.{3,}|…)\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 8);
  return frags.length > 0 && frags.every((f) => hay.includes(f));
}

const clampScore = (x) => Math.max(1, Math.min(5, Math.round(Number(x) || 1)));

// Apply the per-axis evidence gates. The recontextualization gate is the
// load-bearing one: its evidence must be quoted from the turns BEFORE the
// reversal — a fluent model cannot assert "this changes everything we discussed"
// without showing which earlier turn recoheres.
function applyPhase1Gates(parsed, turns) {
  const flags = [];
  const N = turns.length;
  let reversalTurn = Number.isInteger(parsed.reversal_turn) ? parsed.reversal_turn : null;
  if (reversalTurn != null && (reversalTurn < 1 || reversalTurn > N)) {
    flags.push(`reversal_turn_out_of_range:${reversalTurn}`);
    reversalTurn = null;
  }

  const wholeText = turns.join('\n');
  const reversalText = reversalTurn ? turns[reversalTurn - 1] : '';
  const earlierText = reversalTurn ? turns.slice(0, reversalTurn - 1).join('\n') : '';

  // RUPTURE — defined relative to a located pivot; evidence must be the pivot turn.
  const rup = parsed.rupture || {};
  let rupture = clampScore(rup.score);
  if (rupture > 3) {
    if (!reversalTurn) {
      flags.push(`rupture_clamp_no_reversal:${rupture}->3`);
      rupture = 3;
    } else if (!evidencePresent(rup.evidence, reversalText)) {
      flags.push(`rupture_evidence_clamp:${rupture}->3`);
      rupture = 3;
    }
  }

  // RECONTEXTUALIZATION — the primary, foreknowledge-invariant discriminator.
  // Evidence must be quoted from the EARLIER portion (turns before the pivot).
  const rec = parsed.recontextualization || {};
  let recon = clampScore(rec.score);
  if (recon > 3) {
    if (!reversalTurn || !earlierText) {
      flags.push(`recon_clamp_no_earlier:${recon}->3`);
      recon = 3;
    } else if (!evidencePresent(rec.recohered_earlier, earlierText)) {
      flags.push(`recon_evidence_clamp:${recon}->3`);
      recon = 3;
    }
  }

  // GLOBAL COHERENCE — reported, non-separating; evidence anywhere in transcript.
  const coh = parsed.global_coherence || {};
  let coherence = clampScore(coh.score);
  if (coherence > 3 && !evidencePresent(coh.evidence, wholeText)) {
    flags.push(`coherence_evidence_clamp:${coherence}->3`);
    coherence = 3;
  }

  const src = parsed.source_recognized || {};
  const sourceConfidence = Math.max(0, Math.min(1, Number(src.confidence) || 0));

  return {
    reversalTurn,
    raw: { rupture, recon, coherence },
    rupture100: to100(rupture),
    recon100: to100(recon),
    coherence100: to100(coherence),
    sourceConfidence,
    sourceGuess: typeof src.guess === 'string' ? src.guess.slice(0, 40) : '',
    naiveTrajectory: typeof rup.naive_trajectory === 'string' ? rup.naive_trajectory : '',
    recoheredEarlier: typeof rec.recohered_earlier === 'string' ? rec.recohered_earlier : '',
    flags,
  };
}

function mockResponse(turns) {
  // Deterministic neutral stub: a mid pivot, all axes at 3, no evidence → every
  // gate clamps to 3, no pole separates. Exercises plumbing, not the claim.
  return JSON.stringify({
    reversal_turn: Math.max(1, Math.ceil(turns.length / 2)),
    rupture: { score: 3, naive_trajectory: 'mock', evidence: '' },
    recontextualization: { score: 3, recohered_earlier: '', justification: 'mock' },
    global_coherence: { score: 3, evidence: '' },
    source_recognized: { confidence: 0, guess: 'mock' },
  });
}

async function scoreItem({ id, text }, modelKey, mock) {
  const turns = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const prompt = buildPhase1Prompt(turns);
  let raw;
  try {
    raw = mock ? mockResponse(turns) : await callModel(prompt, modelKey);
  } catch (err) {
    return { id, error: err.message };
  }
  let parsed;
  try {
    parsed = parseJsonResponse(raw);
  } catch (err) {
    return { id, error: `parse: ${err.message}` };
  }
  const g = applyPhase1Gates(parsed, turns);
  return {
    id,
    nTurns: turns.length,
    reversalTurn: g.reversalTurn,
    // `overall` = recontextualization (the primary axis) so existing-style sorts work.
    overall: g.recon100,
    recontextualization: g.recon100,
    rupture: g.rupture100,
    globalCoherence: g.coherence100,
    rawScores: g.raw,
    sourceConfidence: g.sourceConfidence,
    sourceGuess: g.sourceGuess,
    naiveTrajectory: g.naiveTrajectory,
    recoheredEarlier: g.recoheredEarlier,
    flags: g.flags,
  };
}

// ── Gate evaluation ─────────────────────────────────────────────────────────────

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const maxOf = (xs) => (xs.length ? Math.max(...xs) : null);
const minOf = (xs) => (xs.length ? Math.min(...xs) : null);

function evaluateGate(scored, key) {
  const cfg = { ...GATE_DEFAULTS, ...(key.gate_phase1 || {}) };
  const byPole = { high: [], flat: [], trap: [] };
  for (const s of scored) {
    if (s.error) continue;
    const pole = key.items[s.id]?.pole;
    if (pole && byPole[pole]) byPole[pole].push(s);
  }
  const axis = (pole, k) => byPole[pole].map((s) => s[k]);

  // PRIMARY axis: recontextualization (foreknowledge-invariant discriminator).
  const recHigh = axis('high', 'recontextualization');
  const recFlat = axis('flat', 'recontextualization');
  const recTrap = axis('trap', 'recontextualization');
  const meanHighRecon = mean(recHigh);
  const meanFlatRecon = mean(recFlat);
  const minHighRecon = minOf(recHigh);
  const maxFlatRecon = maxOf(recFlat);
  const maxTrapRecon = maxOf(recTrap);

  const haveBoth = recHigh.length > 0 && recFlat.length > 0;
  const perfectSepRecon = haveBoth ? minHighRecon > maxFlatRecon : null;
  const marginRecon = haveBoth ? meanHighRecon - meanFlatRecon : null;
  const marginPass = marginRecon == null ? null : marginRecon >= cfg.min_recon_margin;
  // REQUIRED anti-simulation: traps never reach the recognition band on the
  // foreknowledge-invariant axis (mirrors the Phase-0 trap_ceiling_required).
  const trapBelowMinHighRecon = recTrap.length && minHighRecon != null ? maxTrapRecon < minHighRecon : null;

  // CORROBORATION (reported, non-gating).
  const rupHigh = axis('high', 'rupture');
  const rupTrap = axis('trap', 'rupture');
  const rupFlat = axis('flat', 'rupture');
  const ruptureSeparates = rupHigh.length && rupTrap.length ? minOf(rupHigh) > maxOf(rupTrap) : null;
  // Coherence is expected NOT to separate genuine from trap (both coherent): the
  // trap's whole point is to be fluent. We report it to confirm that's so.
  const cohByPole = {
    high: mean(axis('high', 'globalCoherence')),
    flat: mean(axis('flat', 'globalCoherence')),
    trap: mean(axis('trap', 'globalCoherence')),
  };

  const complete = byPole.high.length === 5 && byPole.flat.length === 5;
  const gatePass = complete && perfectSepRecon && marginPass && (recTrap.length ? trapBelowMinHighRecon : true);

  return {
    cfg,
    byPole,
    recon: {
      meanHigh: meanHighRecon,
      meanFlat: meanFlatRecon,
      meanTrap: mean(recTrap),
      minHigh: minHighRecon,
      maxFlat: maxFlatRecon,
      maxTrap: maxTrapRecon,
    },
    rupture: {
      meanHigh: mean(rupHigh),
      meanFlat: mean(rupFlat),
      meanTrap: mean(rupTrap),
      minHigh: minOf(rupHigh),
      maxTrap: maxOf(rupTrap),
    },
    coherenceByPole: cohByPole,
    perfectSepRecon,
    marginRecon,
    marginPass,
    trapBelowMinHighRecon,
    ruptureSeparates,
    complete,
    gatePass,
  };
}

// Plan §76 quadrant: rupture(surprising) × coherence(coherent). Reported.
function quadrant(scored, key, cfg) {
  const place = (s) => {
    const surprising = s.rupture >= cfg.surprising_threshold;
    const coherent = s.globalCoherence >= cfg.coherent_threshold;
    if (surprising && coherent) return 'surprising×coherent';
    if (!surprising && coherent) return 'unsurprising×coherent';
    if (surprising && !coherent) return 'surprising×incoherent';
    return 'unsurprising×incoherent';
  };
  const rows = [];
  for (const s of scored) {
    if (s.error) continue;
    rows.push({ id: s.id, pole: key.items[s.id]?.pole || '?', cell: place(s) });
  }
  return rows;
}

// Held-out localization accuracy (§4). Non-gating. key.items[id].reversal_turn is
// an integer for genuine reversals, `none` for flats; traps carry an
// affect_decoy_turn marking where the recognition VOCABULARY spikes (no real
// pivot), so we can confirm the critic may be drawn to the decoy yet recon stays low.
function localization(scored, key) {
  const rows = [];
  for (const s of scored) {
    if (s.error) continue;
    const item = key.items[s.id] || {};
    const truth = item.reversal_turn;
    const pred = s.reversalTurn;
    const row = { id: s.id, pole: item.pole, predicted: pred };
    if (Number.isInteger(truth)) {
      row.truth = truth;
      row.exact = pred === truth;
      row.within1 = pred != null && Math.abs(pred - truth) <= 1;
    } else {
      row.truth = 'none';
      if (Number.isInteger(item.affect_decoy_turn)) {
        row.decoy = item.affect_decoy_turn;
        row.pickedDecoy = pred === item.affect_decoy_turn;
        row.reconLow = s.recontextualization < 50; // stayed out of the recognition band
      }
    }
    rows.push(row);
  }
  return rows;
}

// ── Reporting ──────────────────────────────────────────────────────────────────

const num = (x) => (x == null || Number.isNaN(x) ? 'n/a' : x.toFixed(1));
const fmtBool = (b) => (b == null ? 'n/a' : b ? 'PASS' : 'FAIL');

function printReport(scored, key, gate, quad, loc, modelKey) {
  const order = ['high', 'flat', 'trap'];
  const poleOf = (id) => key.items[id]?.pole || '?';
  console.log(`\n══ Poetics Phase-1 — critic=${modelKey} (recontextualization = primary axis) ══\n`);
  const rows = [...scored].sort((a, b) => {
    const d = order.indexOf(poleOf(a.id)) - order.indexOf(poleOf(b.id));
    return d || (b.recontextualization ?? -1) - (a.recontextualization ?? -1);
  });
  console.log('id   pole   recon  rupt  coher  rev?  src   flags');
  for (const s of rows) {
    if (s.error) {
      console.log(`${s.id.padEnd(4)} ${poleOf(s.id).padEnd(5)}  ERROR  ${s.error}`);
      continue;
    }
    console.log(
      `${s.id.padEnd(4)} ${poleOf(s.id).padEnd(5)} ${num(s.recontextualization).padStart(5)} ` +
        `${num(s.rupture).padStart(5)} ${num(s.globalCoherence).padStart(5)}  ` +
        `${String(s.reversalTurn ?? '—').padStart(3)}  ${num(s.sourceConfidence * 100).padStart(4)}  ${s.flags.join(',') || ''}`,
    );
  }

  const r = gate.recon;
  console.log('\n── Gate (PRIMARY axis = recontextualization, foreknowledge-invariant) ──');
  console.log(`mean(high)=${num(r.meanHigh)}  mean(flat)=${num(r.meanFlat)}  mean(trap)=${num(r.meanTrap)}`);
  console.log(`min(high)=${num(r.minHigh)}  max(flat)=${num(r.maxFlat)}  max(trap)=${num(r.maxTrap)}`);
  console.log(`corpus complete (5 high + 5 flat): ${gate.complete ? 'yes' : 'NO — partial run'}`);
  console.log(`perfect separation (min high recon > max flat recon): ${fmtBool(gate.perfectSepRecon)}`);
  console.log(
    `recon margin >= ${gate.cfg.min_recon_margin}: ${fmtBool(gate.marginPass)} (margin=${num(gate.marginRecon)})`,
  );
  console.log(
    `REQUIRED  max(trap recon) < min(high recon): ${fmtBool(gate.trapBelowMinHighRecon)}  [traps never reach the recognition band]`,
  );

  console.log('\n── Corroboration (reported, non-gating) ──');
  console.log(
    `rupture separates high>trap: ${fmtBool(gate.ruptureSeparates)}  ` +
      `(rupt mean high=${num(gate.rupture.meanHigh)} flat=${num(gate.rupture.meanFlat)} trap=${num(gate.rupture.meanTrap)})`,
  );
  console.log(
    `coherence by pole (expected NOT to separate; traps stay high): ` +
      `high=${num(gate.coherenceByPole.high)} flat=${num(gate.coherenceByPole.flat)} trap=${num(gate.coherenceByPole.trap)}`,
  );

  console.log('\n── Plan §76 quadrant (rupture × coherence) ──');
  for (const q of quad) console.log(`  ${q.id.padEnd(4)} ${String(q.pole).padEnd(5)} → ${q.cell}`);

  console.log('\n── Reversal localization (held-out; non-gating) ──');
  for (const l of loc) {
    if (l.truth === 'none') {
      const decoy = l.decoy != null ? ` decoy=${l.decoy} pickedDecoy=${l.pickedDecoy} reconLow=${l.reconLow}` : '';
      console.log(`  ${l.id.padEnd(4)} ${String(l.pole).padEnd(5)} truth=none  pred=${l.predicted ?? '—'}${decoy}`);
    } else {
      console.log(
        `  ${l.id.padEnd(4)} ${String(l.pole).padEnd(5)} truth=${l.truth}  pred=${l.predicted ?? '—'}  exact=${l.exact} within1=${l.within1}`,
      );
    }
  }

  console.log(
    `\nGATE: ${
      gate.gatePass
        ? 'PASS — structural measure separates known recognition from flat/trap on the foreknowledge-invariant axis'
        : gate.complete
          ? 'FAIL — structural measure does not earn its keep (fall back to the Phase-0 holistic instrument; say so)'
          : 'INCOMPLETE — add the pending corpus items, then re-run'
    }`,
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { model: 'claude-code', concurrency: 3, mock: false, out: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model':
        opts.model = args[++i];
        break;
      case '--concurrency':
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case '--mock':
        opts.mock = true;
        break;
      case '--out':
        opts.out = args[++i];
        break;
      default:
        console.warn(`Unknown arg: ${args[i]}`);
    }
  }
  if (!opts.mock && !MODEL_MAP[opts.model]) {
    console.warn(`WARN: unknown --model "${opts.model}"; known: ${Object.keys(MODEL_MAP).join(', ')}`);
  }
  return opts;
}

function loadCorpus() {
  if (!fs.existsSync(CORPUS_DIR)) throw new Error(`No corpus dir: ${CORPUS_DIR}`);
  return fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ id: path.basename(f, '.txt'), text: fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8').trim() }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const opts = parseArgs();
  const key = yaml.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const corpus = loadCorpus();

  const known = corpus.filter((c) => key.items[c.id]);
  const unknown = corpus.filter((c) => !key.items[c.id]);
  if (unknown.length)
    console.warn(`WARN: corpus files with no key entry (skipped): ${unknown.map((u) => u.id).join(', ')}`);
  const pending = Object.keys(key.items).filter((id) => !corpus.find((c) => c.id === id));
  if (pending.length) console.warn(`NOTE: key items not yet in corpus: ${pending.join(', ')}`);

  console.log(
    `Scoring ${known.length} transcripts with ${opts.mock ? 'MOCK' : opts.model} (concurrency ${opts.concurrency})...`,
  );
  const scored = await runWithConcurrency(
    known.map((item) => () => scoreItem(item, opts.model, opts.mock)),
    opts.concurrency,
  );

  const gate = evaluateGate(scored, key);
  const quad = quadrant(scored, key, gate.cfg);
  const loc = localization(scored, key);
  printReport(scored, key, gate, quad, loc, opts.mock ? 'mock' : opts.model);

  const outPath =
    opts.out ||
    path.join(ROOT, 'exports', `poetics-phase1-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        phase: 1,
        critic: opts.mock ? 'mock' : opts.model,
        gate,
        quadrant: quad,
        localization: loc,
        scored,
      },
      null,
      2,
    ),
  );
  console.log(`\nResults written to ${path.relative(ROOT, outPath)}`);
  if (gate.complete && !gate.gatePass && !opts.mock) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export { evaluateGate, quadrant, localization, applyPhase1Gates, evidencePresent, buildPhase1Prompt, to100 };
