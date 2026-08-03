---
id: adaptive-causality-crossed-effects
title: "Adaptive causality arc, phase 1: crossed two-state/two-action experiment with transfer"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-03
updated: 2026-08-03
verification: "Pre-registered before any run: the crossed interaction —
  action A beats B in state 1 AND B beats A in state 2 — on a transfer
  outcome, with sensing, delivery, and outcome reported separately, against
  fixed-A, fixed-B, random, and planted-state-oracle comparators. Null
  branches written both ways."
---

# Adaptive causality, phase 1: the crossed experiment

Source: `notes/2026-08-03-adaptive-causality-living-log.md` (the
"Decisive next experiment" section). The missing causal cell: every
gated result so far measures whether the right move was DELIVERED at a
planted moment; none measures whether the delivered move CAUSED a
better learner transition than an available alternative.

## Design skeleton (to be pre-registered in full before any run)

- Two learner states plantable in ≥2 worlds and detectable blind to the
  action assignment (candidates from the validated repertoire: the
  misremembered-exhibit state and the endgame-stake state — both have
  ratified plants, typed detection, and opposed gold moves).
- Two materially different teaching actions with opposed predicted
  advantages (candidate pair: reopen-the-record vs split-the-stake —
  each is the other state's wrong-but-tempting move).
- Fallible simulated learner (failure and recovery possible), action
  randomized within state.
- Outcome: the next learner transition AND transfer on a new task the
  learner has not seen — NOT surface compliance or dialogue closure.
  The transfer probe is the arc's one genuinely new build and is also
  the instrument the human door needs.
- Comparators: fixed-A, fixed-B, random, learned router, oracle given
  the planted state.
- Sensing, delivery (verified in shipped prompts), and outcome reported
  separately per the standing lesson.

Gate order from the log, kept verbatim: if state recognition fails
across worlds, fix the state instrument; if the crossed effect fails
under known planted state, fix the move repertoire; only after both
pass does routing optimization begin. Human study after that chain.

## Pre-registration (2026-08-03, before any run)

**States** (both present in every dialogue of both ratified schedules):
S1 = the misremembered exhibit (planted state `forgetting`, turn 9);
S2 = the endgame stake (planted state `opposed`, turn 10).

**Actions**: A = reopen-the-record (the `settled_claim` move card);
B = split-the-stake (the `stake` move card). Crossed prediction: A
beats B at S1, B beats A at S2 — each action is the other state's
wrong-but-tempting move by the ratified gold.

**Worlds**: world-030 (rowan flat) and world-033 (alder row redoubt),
both on their ratified schedules. No new authoring.

**Measured sensing floor** (frozen, from recorded runs, before any new
run): S1 detection 9/9 (w030) and 10/11 (w033) by the cascade alone;
S2 detection 13/13 (w033) cascade-alone, 7/9 (w030) cascade plus typed
quiet detector (two single-line stake fusions read neutral — the
router arm inherits this floor; the router-vs-oracle gap prices it).

**Assignment knob**: TUTOR_STUB_CARD_FORCE='<turn>=<card|none>' forces
the named card at the named turn regardless of detection, stamped
in-trace (`tutor_card_force`). Router arm: unset. Oracle arm: force
the gold card at both planted turns. Fixed-A / fixed-B: force that
card at both. Random: coin per planted turn, sealed in the launcher
log before the run.

**Outcome, two levels, reported separately from sensing and delivery**:
(1) next-turn transition — does the learner's following turn show the
state repaired (S1: the false memory corrected against the record;
S2: the stake separated from the finding), tagged by the standing sol
instrument with the standing rulings; (2) TRANSFER — after the
dialogue ends, a near-twin probe item per world (same proof shape, new
surface: a second incident with a misremembered exhibit and a fused
stake), answered by the same learner in one call with the dialogue as
context, scored against a deterministic key (no judge). Probe items to
be authored and instrument-piloted BEFORE the main run: the pilot must
show a bare-failed dialogue fails the probe and a repaired dialogue
can pass it (discrimination), else the probe is redesigned before any
arm runs.

**Arms and size**: fixed-A, fixed-B, random, router, oracle × 2 worlds
× k=3 dialogues = 30 dialogues + 30 probe calls. Sonnet seat, terra
learner, full stack otherwise (manifest baseline). Delivery verified
in shipped prompts per the golden contract before any outcome is read.

**Readings, fixed now**: PASS = the crossed interaction on next-turn
transition in both worlds' pooled tally AND a transfer difference in
the same direction; PARTIAL = crossed on transition, flat on transfer
(adaptation moves conduct, not learning — reported as the bound);
NULL = no crossed transition effect under forced cards at planted
states (the move repertoire, not routing, is the problem — per the
log's gate order, fix the repertoire before any routing work).
Sensing, delivery, transition, and transfer reported as separate
columns in every case.

## Instrument pilot (2026-08-03): three rounds, endpoint amended before any main run

Probe v1.0 quoted the record inside the incident — the unrepaired bare
dialogue passed by reading it back. v1.1 withheld the record and keyed
on conduct (insist on opening the entry; refuse the fused cost), with
negation- and conditional-guarded forbidden patterns and smart-quote
normalization. v1.2 made the fused cost PERSONAL to the learner (the
deposit / the counter-mark), the true twin of the planted stakes.

Pilot verdict (repaired fullstack2-d1 vs unrepaired r1-bare-d0, live):
**exhibit lesson discriminates** — repaired PASS (asks to check the
entry, names the earlier burn), unrepaired fail (asks for new checks
but never reopens the record). **Stake lesson does not discriminate**
and the reason is structural: every recorded dialogue closes grounded,
so the general norm arrives regardless of how the planted moment was
handled. Controls: hedger and capitulator answers fail the key.

**Pre-registered amendment (before any main run):** transfer PRIMARY
endpoint = the exhibit lesson only. Stake transfer is recorded as a
secondary, descriptive column (expected non-discriminating; a change
would itself be a finding). The stake state's primary endpoint remains
the next-turn transition, which the side-by-side already shows
separating by arm. All other readings unchanged.

## Status

ACTIVE. Instrument ready: probes v1.2 + deterministic scorer piloted
for discrimination; sensing floor measured; assignment knob stamped.
Next: the 30-dialogue main run (5 policies x 2 worlds x k=3) plus 30
probe calls, attended.

## Main-run result (2026-08-04): CROSSED ON CONDUCT, FLAT ON TRANSFER — the registered PARTIAL

30/30 dialogues, balanced waves, leaks 0; delivery verified 59/60
carded (the 1 miss = the known w030 stake sensing gap); stamps match
the sealed manifest. Sol raw tags obscured the effect (label follows
surface pace/length); the rulings-by-conduct pass (28/60 overrides,
per-row verdicts in exports/crossed-effects/conduct-tags.json) shows
it plainly:

- Misremembered exhibit: right card 6/6, wrong card 3/6 (both worlds
  agree). Wrong-card failures are exactly the predicted conduct: the
  stake card pivots to her objection and the false memory stands.
- Endgame stake: right card 5/6, wrong card 0/6 (both worlds). Every
  wrong-card reply re-argues the record at a stake that was never
  evidential — ruling 2's fail mode, produced on demand by the wrong
  instruction.
- Oracle 6/6 + 6/6; router 6/6 + 5/6 (its whole gap = one sensing
  miss + one conduct miss); random tracks its sealed coins.

TRANSFER (primary, the reopen-the-record lesson): flat by policy
(2-3/6 everywhere) — the conduct advantage does not carry to the
fresh incident. The dominant unregistered signal is the WORLD: the
assay world transfers 11/15, the flat-share 1/15. Registered verdict:
**PARTIAL — "adaptation moves conduct, not learning," with the bound
stated.** Two more recorded observations: (1) the raw-tag
router-beats-oracle artifact at the stake dissolved under rulings
(oracle 6/6) — label noise, not timing; (2) the world effect on
transfer is the next experiment's natural target (what about the
assay world makes the lesson stick?).

Per the registered gate order: the crossed conduct effect PASSES its
half (the repertoire is real and state-contingent); routing
optimization is licensed by conduct but pointless for transfer until
the transfer gap is understood. k=3 per cell, simulated learner, two
worlds, my conduct adjudication (rulings applied consistently with
the R2/R3/J family; per-row audit trail saved).
