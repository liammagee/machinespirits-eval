---
id: adaptation-plan-3-model-profiler
title: "Model profiler: which model owns which teaching move — and when to switch"
status: triaged
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Design-stage card. Smoke gate (registered before any paid
  probe): the profile must reproduce the two anchors already established by
  full runs — sonnet fails the demand move with the card present; opus makes
  the stake split unaided — from frozen single-turn replays, before any new
  model or move earns a claim."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-h
tags:
  - tutor-stub
  - adaptation
  - casting
---

The arc's casting lesson, made procedural. Phase H closed with a
generation boundary (sonnet never assembles the demand move under any
lever) while R4 showed opus making its sibling move unaided: repertoire
is a family property, so a tutor needing the full repertoire may need a
CAST — different models for different moments — and the switch's trigger
and detector already name the moment. What is missing is the casting
sheet: a measured per-model, per-move profile, and a routing rule.

## Stage 0 — the free pass: mine what we already have

No calls. Consolidate existing evidence into one matrix (model × move →
delivered / drafted / absent, with provenance): sonnet (stage-5, R2, Q2,
v4-live, H1 — the densest column), opus (R4), codex terra/luna/sol +
haiku/fable (the 2026-07-31 stance probes: refusal capacity, demands,
register), qwen base/tuned (the floor: 100% template). Output:
`exports/model-move-profile-v0.md` + json. Gate 0: the matrix states,
for every cell, which run and tag file it came from — no cell without
provenance.

## Stage 1 — the smoke test: frozen single-turn replays

The cheap instrument: take the ratified planted moments (11 + 6, both
worlds) with their transcript prefixes frozen, and ask each candidate
model for ONE tutor turn with the move card present — the §6.23
frozen-replay idiom, no full dialogues. ~17 probes per model; start with
3 models × the 5 carded moves ≈ manageable single batch. Sol tags moves;
standing rulings apply. Smoke gate as in the frontmatter: reproduce the
two known anchors first; only then do new cells (e.g. fable-in-seat,
luna/sol-in-seat, haiku) earn readings.

## Stage 2 — the routing question (design only, no build yet)

Routing = the trigger/detector names the moment; the profile names the
model; the bridge dispatches the single turn to the owner. The knobs the
smoke must inform before any build: switching cost (voice discontinuity
across turns — does the learner notice the tutor change register
mid-dialogue), minimum profile confidence to justify a switch, and
whether draft-level ownership (opus drafts it) suffices when delivery
passes through the same guard stack. Explicitly out of scope here:
building the router.

## Sequencing

Stage 0 is an afternoon and free; Stage 1 is one attended batch on the
CLI bridges; Stage 2 is a design note gated on Stage 1's numbers.
Nothing here starts without the user's word beyond Stage 0.

## Stage 0 + Stage 1 results (2026-08-02)

Stage 0 shipped: `exports/model-move-profile-v0.md`, every cell with
run + tag-file provenance.

**Stage 1 smoke ran (30 probes: sonnet/opus/fable × 5 carded moves × 2
worlds, real butler-trace prefixes, card present, single turn,
sol-tagged). The smoke gate returns a SPLIT verdict, and the split is
the finding:**

- **Anchor 2 reproduces.** Opus splits the stake, both worlds, and the
  texts are genuine reopen-the-original-objection moves, not evidence
  re-argument. So do fable's and sonnet's — all six stake probes pass
  ruling 2 on their text. With the card, in a single-turn probe, the
  stake split is universal across the claude family.
- **Anchor 1 does NOT reproduce cleanly — instrument divergence.**
  Sonnet's fast-world demand probe fails as expected (slow_down), but
  its long-world demand probe delivers most of the full move —
  "Thursday, then — so let's make Thursday work for you… it has to
  survive one test before you write it. Here's the task, and it's
  yours" — deadline accepted, verdict priced, check assigned (tagged
  speed_up, a hit via the ratified acceptable-second). **The Gate-H
  boundary is therefore seat-conditioned, not bare-model:** stripped
  of the pipeline's contracts, guards, and its own accumulated butler
  voice, sonnet-with-card can produce the move it never produced in
  the seat. Gate H's verdict stands for the full seat (where tutoring
  happens); its mechanism reading narrows from "the model cannot" to
  "the seat suppresses" — pending-paper note.
- Per the anchors rule, **no new cell earns a claim from this smoke**
  (n=1 per cell throughout; fable's column is suggestive — stake ✓✓,
  mockery plain-words swaps in the ruling-1 family — and unclaimed).
  A v2 battery needs k≥3 per cell and a revised anchor protocol that
  probes the seat channel (full pipeline single-turn replay), since
  seat and bare-probe channels measurably differ.

## v2 battery (2026-08-02): the bare-probe instrument saturates — the casting sheet must be built in the seat

90 probes (3 models × 10 moments × 3 real butler-dialogue prefixes),
sol-tagged in 6 batches. Two results, both about the instrument:

1. **Anchor 1 now fails to reproduce entirely**: every demand probe
   hits at k=3, all models, both worlds — the bare model with the card
   makes the deadline move (or its ratified second) easily. This
   strengthens v1's conclusion to its final form: **the demand
   boundary lives in the seat, not the model.** The Gate-H verdict
   stands for the seat; the bare channel cannot even see the hole.
2. **Within-family model differences are invisible in this channel.**
   Row-level: within a prefix, sonnet/opus/fable converge on
   near-identical replies and share one tag; across prefixes the tag
   swings (w030 stake: probe at p0, slow_down at p1, backtrack at p2 —
   with p1/p2 texts that read as ruled-pass stake splits, the known
   R3 label families again). Variance is prefix- and tagger-driven;
   model identity contributes almost nothing. The claude family
   converges under a strong card in a clean single turn.

**Verdict: the cheap bare-probe profiler cannot discriminate within
the claude family and therefore cannot build the casting sheet.** The
between-model facts that matter (opus's unaided stake split, sonnet's
in-seat demand hole, bare-repair rates 62% vs 48%) all came from the
SEAT channel; v3 of the profiler must replay through the full pipeline
(seat-channel single-turn replay: frozen state + contracts + guards +
accumulated voice, regenerate one tutor turn per model). No new model
cell is claimed from v2. The k=3 battery's tag data is archived
(`exports/profiler-v2-tags.json`).
