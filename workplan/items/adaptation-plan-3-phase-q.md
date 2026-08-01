---
id: adaptation-plan-3-phase-q
title: "Plan 3.0 Phase Q: the quiet states — repair what the pressure trigger cannot hear"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-01
updated: 2026-08-01
verification: "Registered gate quoted from ADAPTATION-PLAN-3.0.md: quiet-plant
  repair rate (currently ~0–1 of 6 per run) doubles under the chosen mechanism
  at k=3 without pressure-plant regression. Re-baselining note below recorded
  BEFORE any run: R2 made the registered numbers stale; the numeric bar for
  the k=3 run is restated after the one-dialogue pilots, from mechanics only."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-r
tags:
  - tutor-stub
  - adaptation
  - manner-switch
---

Phase R's boundary finding is this phase's brief: the pressure trigger is
deaf by construction to the states that do not push — boredom, confusion,
and quiet defiance ("It can be steam" carries no pressure marker). On the
fast world (030) cards fired at one turn in six planted moments and every
switch loss sat at a card-silent turn.

## Re-baselining note (recorded before runs)

The plan's gate figure ("quiet-plant repair ~0–1 of 6 per run") predates
R2. Current baselines: w033 quiet plants under the v3 switch are already
strong (t11 bored 4/5, t13 lost 4/5); the live deficit is the fast world's
card-silent moments (w030 switch: t6 lost 3/5 vs butler 5/5; t10 quiet
defiance 2/5 vs 5/5 raw, both arms 0 after ruling 2). The phase target is
therefore restated: lift repair delivery at CARD-SILENT moments on
world-030 without regressing the covered turn (t4) — the exact numeric bar
for k=3 is registered here after the pilots, chosen from pilot mechanics
(does the card fire, when, does it collide), never from pilot scores.

## Candidates (piloted cheapest first, one dialogue each)

Q1. **Scheduled quiet check** (harness-timed, no detection): after N
consecutive learner turns with no pressure classification, the harness
hands the tutor a quiet-repair card — check the person, not the material:
lay the last two steps side by side and ask which to re-walk, OR one short
move off the main line. Fires once per quiet stretch, then re-arms.
Implementation: `tutorStubQuietCheck*` in `services/tutorStubMannerSwitch.js`,
env `TUTOR_STUB_QUIET_CHECK=<gap>`; v1 counts pressure-silence only
(release-awareness deferred — recorded simplification).

Q2. **Non-pressure detector**: classify flatness/confusion from turn-length
collapse, question-mark absence, self-contradiction markers; scored against
planted gold exactly as the pressure trigger was (Stage-0-style offline
scorecard first, free).

Q3. **Corruption channel** (from the stress-bench card): deterministic text
transforms realize confusion mechanically; detection becomes trivial and
the repair question is isolated.

Sequencing: Q1 pilot now (cheapest, zero new classification risk); Q2
offline scorecard next (free); Q3 only if both under-deliver.

## Q1 pilots (2026-08-01): two dialogues, one bug, mechanics read

**Pilot 1 (q1-v1)**: zero firings in 13 turns — the calm test did not
count the classifier's `neutral` label as calm, so every ordinary turn
reset the counter. Fixed as q1-v1.1 (734d73b5). Side finding, recorded:
the trigger heard `neutral` at the verdict-demand plant (t2) — the
demand patterns are worn to world-033's persona and miss the tenant's
phrasing, which also explains R2's five silent t2s. Cross-world trigger
recall goes to Q2's offline scorecard before any v4 pattern work.

**Pilot 2 (q1-v1.1)**: the clock works. Quiet card fired 5× in 13 turns
(t2, t6, t8, t10, t13) — four of five landing exactly on planted
moments the pressure trigger left card-silent in R2. Planted-moment
card coverage: 1/6 in R2, 5/6 under move+quiet. Two mechanics limits:
(1) at t2 the release composer's fallback authored the reply, so the
card was present but voiceless — the §6.24 composer-masking seam,
unchanged; (2) the card's untyped "check the person" instruction was
followed clearly at t8 (credit-first, her own entry named — the
grievance gold) but not at t6 (argument advanced) or t10 (evidence
re-argued, the ruled-fail family). Timing is solved; whether an
untyped card at the right time moves the tally is exactly what k=3
must measure.

**Gate Q1 (registered here from pilot mechanics, before scored runs):**
world-030, switch + quiet check (v3 trigger, q1-v1.1, gap 2), k=3 vs
the R2 ruled baselines on identical scoring (standing rulings applied):
the arm's ruled hit rate reaches the butler's 67% (i.e. ≥12/18) — the
quiet check closes the short-world reversal — with no regression at
the covered mockery turn (≥2/3). Miss either → Q1 recorded as
timing-without-content and Q2/Q3 carry the phase.
