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
