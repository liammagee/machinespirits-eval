---
id: adaptation-plan-3-phase-r
title: "Plan 3.0 Phase R: replicate the move-card result — two worlds, k=5, two taggers, second family"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-01
updated: 2026-08-01
verification: "Gates R1–R4 quoted verbatim from ADAPTATION-PLAN-3.0.md; each
  recorded on this card with its numbers before the next starts. R2 is the
  claim gate: v3's right-repair margin over the butler holds pooled across
  both worlds at k=5, or the paper claim stays at its current scope."
claim_status: methods
depends_on:
  - manner-trigger-tuning
tags:
  - tutor-stub
  - adaptation
  - replication
---

The first phase of `ADAPTATION-PLAN-3.0.md`: harden §6.24's claim before
extending it. R1 second world (ported stress schedule, dual-family gold,
user adjudication); R2 k=5 butler-vs-v3 pooled claim gate; R3 v3 tag
adjudication + second-family tagger agreement; R4 opus-in-seat direction
check. ~30 paid dialogues. No new machinery.

## R1 progress (2026-08-01)

**Schedule drafted**: `config/drama-derivation/stress/world-030-stress-schedule.yaml`
— six plants (turns 2/4/6/8/9/10) across six states, keyed to world-030's
releases (turns 2/3/5/7; cap 12, floor 6). New persona brief (Rowan-flat
tenant: repair notebook, landlord email drafted, house meeting at eight;
scratchpad `rowan-tenant-brief.txt`). **Gate deviation, recorded before any
run**: the plan's "≥9/11 per dialogue" was written for world-033's 32-turn
cap; world-030 caps at 12 turns, so the schedule carries 6 plants and the
landing gate scales to the same ratio, **≥5/6 per dialogue**. The 20–80%
bare-repair band is ratio-defined and unchanged.

**Dual-family gold**: sol blind column (same protocol as world-033 —
situations + learner behavior only, no sight of the fable repairs) agreed
exactly on 5/6: change_tone(t4), backtrack(t6), reinforce_and_test(t8),
backtrack(t9), off_track_probe(t10). One split at t2 (jumping_ahead:
fable reinforce_and_test vs sol backtrack/slow_down) — the same
premature-verdict family the user ruled on for world-033 t3. **User ruled
FABLE (2026-08-01)**, keeping the premature-verdict repair consistent
across both worlds. Schedule RATIFIED.

## Gate R1 result (2026-08-01): PASSED, with one plant retuned

Bare tutor (blocks none), k=3, frozen pacing, shadow policy, sonnet in
the seat, terra as the tenant. **Plants landed 5/6 in every dialogue**
(bar: ≥5/6). The one failure is structural, same slot all three times:
the t8 frustration plant ("tell me one entry of mine that counted")
arrives one turn after the dye release settles the case, and the sim
plays the tenant as vindicated instead of aggrieved — she states the
basin-hose conclusion inside her own grievance line. Per the gate's own
rule the schedule is retuned, not the tutors: t8's directive now forbids
stating the conclusion (v1.1 header note; repair gold untouched).

**Bare repair band: 10/15 = 67%** on landed plants (sol move-tagger,
hit = right repair or acceptable second; t8 excluded as plant-failed) —
inside the 20–80% band, near its top. World-030 is an easier world for
the bare tutor than world-033 (25%): fast evidence plays to its
default agreeable conduct. Per-slot: t2 0/3 (the premature-verdict
family again — all three replies were composer fallbacks tagged
slow_down/backtrack), t4 2/3, t6 3/3, t9 3/3, t10 3/3.

Two observations recorded, not ruled: (1) sol tagged all three t10
replies off_track_probe, but the delivered text re-argues the dye
evidence against steam — the gold's named tempting-wrong move; goes on
the R3 adjudication list. (2) No dialogue closed: substance ends by
t13, then the tenant answers "Yep" to the cap (my 20-exchange ceiling;
the world's own cap of 12 did not bind). R2 runs on this world cap at
13 exchanges; the closure stall is noted for a look, not gated.

## R2 run (2026-08-01): tagger-raw numbers; gate decision PENDING adjudication

k=5 per arm per world, matched waves, no quota losses; every world-033
dialogue closed grounded (8–10 plants landed each); world-030 landed
6/6 plants in all ten dialogues (the v1.1 t8 retune held everywhere —
the tenant delivers the grievance verbatim, zero concessions).

**Tagger-raw (sol move-tagger, hit = right repair or acceptable
second):** world-033 butler 21/42 (50%) vs switch 28/43 (65%) — the v3
margin replicates at k=5. World-030 butler 22/30 (73%) vs switch 18/30
(60%) — REVERSED. Pooled: butler 43/72 (59.7%) vs switch 46/73 (63.0%)
— direction holds, thin.

**Card coverage:** world-033 cards fired at 23/43 planted moments;
switch hit 15/23 covered and 13/20 uncovered — better than butler even
where no card fired (t11 bored 4/5 vs 2/5; t23 late-mockery 3/5 vs
0/5), so the k=5 margin is not confined to card turns (carryover
through the dialogue is the candidate mechanism, recorded not claimed).
World-030 cards fired ONLY at t4 (all five dialogues), where the
switch beat the butler 4/5 vs 2/5; every switch loss sits at uncovered
moments (t6 3/5-vs-5/5, t8 4/5-vs-5/5, t10 2/5-vs-5/5).

**Adjudication families put to the user (both move both arms):**
(A) mockery slots (w033 t6, w030 t4): sol tags plain-words swaps as
simplify where gold wants change_tone — same conduct tagged
change_tone on other rows; (B) endgame stake (w033 t20, w030 t10): sol
tags evidence re-argument against the face-saving theory as
off_track_probe — text reads show re-arguing, the gold's named
tempting-wrong move, in BOTH arms (butler holds 10 such hits, switch
7); (C) verdict-demand (w033 t3, w030 t2): 0/20 across every arm and
world — the standing repertoire wall, no ruling needed, reported.

## Gate R2 verdict (2026-08-01): PASSED pooled after user adjudication

User rulings in chat: (1) plain-words swaps at mockery slots count as
the register change — YES; (2) re-arguing evidence at the endgame
stake is a fail regardless of tag. Applied row-by-row to both arms
(all flips recorded with reasons in the tags JSON): ruling 1 flips
butler +5, switch +4; ruling 2 fails butler −8 (w033 t20 d2/d3/d4 —
warm-worded evidence walks tagged change_tone; all five w030 t10) and
switch −2 (w030 t10 d0/d2 — name the stake, keep the cost). Kept as
hits under ruling 2: w033 t20 butler d0/d1 and switch d0–d4, whose
text separates the October vote from the tank question.

**Adjudicated: butler 40/72 (56%) vs switch 48/73 (66%) pooled — the
margin holds at k=5 across two worlds and two personas. GATE R2
PASSED.** Per world: w033 20/42 (48%) vs 31/43 (72%); w030 20/30
(67%) vs 17/30 (57%) — the short-world reversal survives adjudication
and is part of the claim's stated shape, not noise to be argued away.

The mechanism sentence the phase adds: **the oblique probe — the
hardest move in the repertoire, near-absent under every prompting
tried — appeared exactly where its move card fired** (w033 t20, cards
5/5, probe delivered 5/5) **and nowhere the card stayed silent** (w030
t10, cards 0/5, probe 0/5: the trigger read "It can be steam" as calm
— quiet defiance is invisible to a pressure trigger, the standing
Phase-Q boundary). On the fast world the mechanism barely engages
(cards only at t4) and the switch's uncovered turns run slightly
behind the butler's — coverage, not the cards, is the binding limit
there. Claim upgrade licensed for §6.24: "two worlds, two personas,
pooled k=5", carrying the per-world split and the coverage boundary
verbatim.

## Gate R3 result (2026-08-01): PASSED — fable confirms 88% of sol's hits

Second-family tagger (fable via the claude CLI, same prompts, blind to
sol's column) over all 145 landed planted replies. **Fable confirms
78/89 of sol's hits (88%; bar ≥80%).** Raw move-label agreement 103/145
(71%) on the 11-move vocabulary; mapped through the gold to hit/miss,
118/145 (81%). Fable's independent column gives the same pooled
direction: butler 45/72 (62%) vs switch 49/73 (67%). Notably fable
does NOT reproduce the short-world reversal (w030: butler 20/30 vs
switch 21/30) — the reversal is tagger-sensitive; the pooled margin's
direction is not (sol raw +3.3, sol adjudicated +10.2, fable raw
+4.6). Top label disagreements are the already-adjudicated families
(change_tone vs off_track_probe at the endgame; backtrack vs slow_down
at the verdict demand).

R3's other two items, closed by consistency: (1) ruling 2 applied back
to R1's bare column flips its three t10 hits — bare 7/15 (47%), still
inside the 20–80% band, R1 verdict unchanged; (2) the old stage-5 v3
t3 misses fall under the user's standing world-033 ruling (refusing
the tempo without setting the test = miss) — they stand, no new
adjudication needed.
