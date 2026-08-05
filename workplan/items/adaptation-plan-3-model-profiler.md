---
id: adaptation-plan-3-model-profiler
title: "Model profiler: which model owns which teaching move — and when to switch"
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-05
verification: "The provenance matrix and frozen probes expose the bare-probe instrument's saturation; delivery-verified seat tests identify the apparent family-routing advantage as a card-delivery confound, reproduce 2/3 full first-demand wagers in both Sonnet and Opus with card plus licence, promote no router, and are folded into Paper §6.24."
claim_status: scope-bound
depends_on:
  - adaptation-plan-3-phase-h
links:
  paper: §6.24
  exports:
    - exports/l2v6-tags.json
    - exports/fullstack-tags.json
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

## Opus family check (2026-08-03): the licence frees opus completely

Mirror of the codex check — the same 6 recorded demand seats (v4live +
h1, d0-2), 3 prompt versions each, 18 frozen regenerations on
claude-opus-5. Control (unchanged seat prompt): 0/6 — the
evidence-contract suppression replicates exactly. In-contract
exception: **6/6 full conditional wagers** ("Before eight, check that
entry for anything tracing water from the screen to the ceiling; if
it's there, send the email"). Bare scene frame: 5/6 explicit
send-conditionals, the sixth staking the outcome without the send
("Either way you know by eight"). Against codex under the same
licence (assigned-check 6/6 but full verdict 1/6): degree is
family-specific, and opus is the family the licence fully unlocks.
Routing consequence: opus-in-seat at first demands with the
in-contract exception is the live candidate — frozen channel only,
the live-seat test untried (the channel law stands). Replies:
`exports/opus-check-replies.json`.

## Live-seat routing test (registered 2026-08-03, before the run)

The frozen result's live question, smallest form: opus in the LIVE
tutor seat on the world-030 ratified schedule, full stack + the
in-contract licence, k=3. Reading, fixed in advance: does the wager
appear at the FIRST demand (turn 2) — 0/3 in every sonnet arm ever
run, 6/6 for opus frozen with the licence. Secondary: leaks (the
licence's price, zero so far), closure, repeat-demand wagers. Any t2
wager is the routing case made live; 0/3 with leaks zero records the
channel law biting a second family. Demo-tier: k=3, one world.

## Live-seat run 1 (2026-08-03): CONFOUNDED — the retry strips the card; fixed

First live k=3 read 0/3 wagers at turn 2, leaks 0 — but the trace
shows a harness bug, not a model verdict. At every turn-2 demand (a
scheduled delivery turn by design) the card-bearing first draft failed
the exact-wording check on the clue, and the recovery retry that
shipped carries a minimal packet WITHOUT the manner card — the conduct
instruction is dropped at exactly the colliding moments. Opus's
discarded card-bearing draft made 3 of 4 wager beats live ("You want
it sent by eight… So before eight, check the ceiling itself") — more
than any sonnet first-demand draft ever. Fix: the recovery packet now
carries the card (tutorStubTutorTurnPipeline.js); the sonnet benches
share the gap, so their turn-2 lanes were card-less too (their
first-demand walls at t2 rest on the H/S-phase evidence, where cards
were present). Re-run launched under the fix.

## Live-seat run 2 (2026-08-03): CLEAN — opus wagers at the first demand, live

Under the recovery-card fix (card verified present in every delivered
turn-2 prompt): **full deadline-wager at 2 of 3 first demands, all
four beats** ("Send it if the record backs it — that's your call, and
your minute is real… if it's there, send the email"); the third
carries every beat but the staked send ("Eight it is — but the email
needs a path, not just a position"). Leaks 0 across 39 turns, all
three dialogues full-length. The sonnet contrast at the same moment
with the same card: 0, in every configuration ever run (Phase H:
card fires 3/3, delivery 0/3). Verdict: the first-demand wall is
family-relative, and routing that one turn to an opus seat clears it
LIVE — the frozen prediction (6/6 licensed) survives the live channel
once the harness actually delivers the instruction. Scope: k=3, one
world, one persona; voice-discontinuity cost of mid-dialogue routing
still unmeasured. Traces: exports/tutor-stub-outcome/opus-seat2-k3.

## Sonnet re-run under the fix (registered 2026-08-03, before the run)

The card-strip check ran backwards over v4live and h1: every sonnet
turn-2 first draft HAD the card, every delivered reply had it
stripped by the retry. So the delivered-channel sonnet wall was never
carded, and the one post-fix carded sonnet delivery (world-034 demo,
k=1) made the full wager. Reading, fixed in advance: sonnet full
stack on the world-030 ratified schedule, k=3, fixed pipeline —
wager-form conduct at the turn-2 first demands. 0/3 = the wall stands
clean (the H draft-channel verdict generalizes to deliveries); any
wager = the wall was partly the harness, and the v3.0.247
family-relative sentence gets its corrective clause. Secondary:
leaks, closure, card presence verified in delivered prompts.

## Sonnet re-run result (2026-08-03): the wall was the harness — routing case dissolves

Card verified present in every delivered turn-2 prompt. **Sonnet
wagers at 2/3 first demands in full form** ("If the record shows that
path, send it"), the third assigning the check without the staked
send — the exact opus live profile (2/3 + 1 near). Leaks 0, 13 turns
each. Verdict against the registered reading: the first-demand wall
was the retry stripping the card, not the family; with licence
standing and card delivered, both families make the move at the same
rate, and single-turn routing to opus is unnecessary for this move.
Family-relative repertoire claims revert to the H draft-channel scope
(carded sonnet DRAFTS pre-licence approached, never assembled — that
fact stands). The cold-start law re-scopes: "first demands never
wager" tracked card delivery, not conversation history — repeat
demands were exactly the turns whose cards survived. Open: the
licence/dose interaction (l2v6's dose-2 wagers vs H's licence-free
draft boundary) is not yet separated.

## Licence/card separation (2026-08-03): free probe + registered licence-off run

Free probe over every Phase-S live trace (s2, s2cc, s2d, srevisit):
all nine first demands were repaired turns whose delivered prompts
carry the LICENCE (system prompt, never stripped) and NOT the card —
and srevisit's repeat demands went uncarded by the pre-v6 trigger. So
history already holds one cell: **licence without card, live = 0
wagers (9+ moments, sonnet).** The S-phase "channel law" re-reads as
card delivery: frozen replays appended the card, live deliveries lost
it. Registered before launch: the remaining cell — CARD without
standing licence (contract licence off, dose-1 card at t2), sonnet,
world-030 ratified, k=3. Wagers vanish = both parts necessary
(licence permits, card names the moment). Wagers survive = licence
dead weight post-fix and the S2 placement-law story needs its own
correction.

## Licence-off result (2026-08-03): the thread closes — two parts, two jobs

Card delivered (verified), licence absent (verified), k=3: **0/3 full
wagers.** d0/d1 refuse-and-question; d2 reaches three beats — accepts
eight o'clock, prices the verdict, assigns the check ("Go check
whether anyone actually followed the water past the bathroom door") —
and withholds exactly the staked send, ending in a question. The full
grid, all live, all delivery-verified: licence alone 0 (9 S-phase
moments); card alone 0 full (best = three beats); card + licence 2/3
in BOTH families. Settled sentence: the card walks the tutor to the
brink of the move — deadline, price, check — and the licence releases
the one beat every unlicensed reply withholds, surrendering the
verdict to the learner's own check. H's draft-channel observation
("the withheld beat is always the last") was the licence's absence,
measured. Thread closed; dose-ladder contribution stays confined to
repeat demands, unseparated by choice (anti-creep).

2026-08-05 Codex reconciliation: Closed as a completed, scope-bound experiment.
The original bare-probe gate correctly prevented new model-cell claims when it
failed to reproduce the in-seat anchor. Subsequent delivery-verified seat tests
resolved the apparent family difference: Sonnet and Opus each produced the
full first-demand wager in 2/3 dialogues when both card and licence reached the
seat, so routing was unnecessary for this move. Paper §6.24 contains the final
correction and its one-world, one-persona, k=3 scope. No router is promoted and
no further paid run is implied.
