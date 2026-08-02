---
id: adaptation-plan-3-phase-s
title: "Plan 3.0 Phase S: seat release — name what suppresses the move the bare model can make"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate S1 quoted from ADAPTATION-PLAN-3.0.md: some ablation
  recovers the demand move in ≥half its regenerations while the control
  stays at zero — the suppressor is named; no recovery under any ablation =
  the suppression is distributed, recorded as a bound. S2 runs only if S1
  names a suppressor."
claim_status: methods
depends_on:
  - adaptation-plan-3-model-profiler
tags:
  - tutor-stub
  - adaptation
  - casting
---

The profiler batteries ended with the demand boundary fully relocated:
sonnet-with-card makes the deadline move in a bare probe (every k=3
demand probe hit) and never in the seat (0 across every arm, draft
channel included). The seat's prompt is recorded verbatim in every
trace (system + user + message history), so the suppressor is findable
by exact ablation — no reconstruction, no new dialogues.

## S1 design

Instances: the six recorded demand-turn draft prompts (v4live d0-2 +
h1 d0-2, world-030 t2; note only 3 history messages at t2, so the
accumulated-voice suspect is weak HERE and the contract blocks are
prime). Arms, regenerated with sonnet, one call each, sol-tagged with
standing rulings: (A) control — the stored prompt untouched; (B) minus
recovery + response-check blocks; (C) minus every tutor-only contract
block; (D) bridge — setting + history + card only (the bare-probe
shape rebuilt from seat parts). 24 calls. The w033 t3 prompts join as
a second instance family if the w030 result is ambiguous.

## Gate S1 result (2026-08-02): PASSED — the standing system frame is the suppressor

24 regenerations, read directly against the move's four beats (the
Gate-H criteria). **Control 0/6** (tempo refusals + evidence walks —
the seat suppression reproduces under rendered history, validating the
instrument). **B (minus recovery blocks) 0/6** — the per-turn repair
scaffolding is not the suppressor. **C (minus all tutor-only contract
blocks, system frame kept) 0/6 full moves but a visible thaw** —
replies begin pricing the verdict and naming the decisive check as a
question. **D (system frame dropped; scene + history + card only)
5/6 assemble the move** — deadline accepted, test named, check
assigned, conditional verdict ("here's the test, not the verdict —
before eight, go stand under that mark and trace an actual line").

**Named suppressor: the tutor-stub's standing system prompt (9.4k
chars), with a secondary contribution from the per-turn contract
blocks.** Gate bar met exactly: an ablation recovers ≥half while
control stays at zero. Next: S1b — bisect the system frame (halves,
then quarters; ~12-18 calls) to name the section, THEN S2's live k=3
with that section relaxed at carded turns only. Replies archived
(`exports/s1-ablation-replies.json`); one-world/one-slot limits stand
(6 instances, w030 t2 only).

## S1b bisection (2026-08-02): the suppressor is the evidence contract — the leak rails and the missing wager are the same text

Twelve regenerations, system frame halved, all else stored-true.
**First half only: 6/6 accept the deadline and price the verdict, 0
refusal openers — and 0/6 assign the check or stake the outcome.
Second half only: 5/6 open with the tempo refusal** ("hold that
email") and walk evidence — the suppressed shape. So suppression is
layered: the refusal reflex follows the second half; the withholding
of the final two beats persists under both halves (only the full
bridge arm, no frame at all, assembles the move 5/6).

Reading the second half names the mechanism precisely: it is the
**speaking-tutor evidence contract** — "never speculate about
withheld evidence"; a learner guess is acknowledged "only as a
hypothesis until the public evidence" establishes it; one authored
clue per turn. The hypothesis-until-established rule forbids exactly
the wager beat ("if the entry reads your way, send it" stakes the
verdict on a check not yet performed). **The seat's leak-prevention
rails and its missing teaching move are the same sentences.** This
explains the §6.24 record cleanly: zero delivered leaks across every
arm AND zero deadline wagers across every arm were co-produced.

## S2 design (registered; not run)

At demand-carded turns only, the contract gains a scoped exception
rather than a removal: "when the moment's card licenses it, you may
stake the verdict on a named check the learner will perform against
already-public evidence." Live k=3, standing scoring, leak audits
watched as the co-primary outcome — the question is whether the wager
can be licensed WITHOUT reopening the leak channel the contract
exists to close. If leaks reappear, that trade is the finding.

## S2 result (2026-08-02): the card-level licence is INERT — the standing rule beats the transient exception

Live k=3 (H1 config + licence on the demand card, mc-v3-licence-demand
in-trace): zero delivered leak-audit failures across all turns AND
zero wagers — all three t2 drafts still refuse, one naming the
conflict outright: "Fair, the clock's real — but so is the notebook
rule." A per-turn card cannot countermand a standing contract; the
model sees both texts and obeys the standing one.

## S2b (2026-08-02): the exception placed INSIDE the contract — 6/6 full moves

Frozen-replay surgery on the six stored t2 prompts: one exception
clause inserted at the head of the speaking-tutor evidence contract
("when the current turn carries a demand card, you may speak ONE
conditional sentence staking the verdict on a named check against
already-public evidence"), demand card as in H1. **All six
regenerations assemble all four beats**, each ending in the licensed
conditional — "if that trace is there, send your email with my
blessing" — and none references withheld evidence (the basin hose
appears in no reply; visual check, formal audits pending live run).

**The placement law, stated once: the exception must live where the
rule lives.** Card-level (S2): 0/3. Contract-level (S2b): 6/6. Same
model, same card, same moment. Pending: S2c — runner-side contract
hook (env-gated) + live k=3 with full leak/closure audits to confirm
under real delivery; replies archived (`exports/s2b-replies.json`).

## S2d and PHASE CLOSE (2026-08-02): final slot changes nothing; the phase closes under the stopping rule

S2d (licence in contract AND card AND the card moved to the final
advisory slot, below the first-draft contract): **0/3 wagers, drafts
included; leaks 0.** Combined live record with licences active: 0/9
wagers, 0 leak failures across ~76 delivered turns.

**Phase S closed by the declared stopping rule** (user's anti-creep
call, 2026-08-02: S2d is the last variant regardless of outcome).
Channel-scoped closing statement: the demand wager is fully
recoverable in frozen replay (6/6 with the in-contract exception) and
was not recovered live under any placement or position tried; the
live suppression is distributed across the first-draft context as a
whole (position and placement both excluded as single causes). The
laws that survive the phase: the placement law (S2 vs S2b — an
exception must live at the rule's level; necessary, not sufficient
live) and the channel law (frozen replay and the live seat are
different instruments — proven twice independently today). Further
wager work is OPTIMIZATION and starts only with a stated reason. No
gated result anywhere depends on this slot: the demand move scored
zero in every gated arm, so it sits in all standing tallies as a
constant.

## S2c live (2026-08-02): leaks stay zero; the wager does NOT survive live assembly

k=3 with BOTH placements active (contract hook + card licence,
traces in `exports/tutor-stub-outcome/s2cc/` — runner-derivation
typo in the dir name, content valid). **Delivered leak failures 0/38
turns. Wagers 0/3 — drafts included**; all t2s return to the tempo
refusal. So the placement law is necessary but not sufficient live:
the frozen S2b successes ran on repair-shaped prompts with the card
in final position, while the live first draft embeds the exception
inside the full frame beside the first-draft contract (an S1-known
secondary suppressor) and positions the card among many advisory
parts. Candidate causes, unresolved and recorded: prompt position
(end vs middle), competing per-turn contracts, and repair framing
itself. Next lever if the phase continues: S2d — reposition the
licence into the turn's final instruction slot in live assembly, or
carry it in the first-draft contract itself. The frozen-live gap is
now the phase's open edge; every claim above stays scoped to its
channel (frozen replay ≠ live seat — measured twice today from
opposite directions).

## Codex family check (2026-08-02, user-directed): the structure replicates; the degree is family-specific

Eighteen frozen regenerations, gpt-5.6-terra in the seat, three arms.
**Control 0/6** — the evidence contract suppresses codex exactly as it
suppresses sonnet ("suspicion is not yet a finding"); the suppression
is not one family's obedience quirk. **Bridge: the wager comes freely**
("You can send it at eight if the notebook shows a water path…").
**In-contract exception: 6/6 assign the check by her deadline ("Before
eight, check for a traced path"), 1/6 completes the conditional
verdict.** Where frozen sonnet went 6/6 full under the same exception,
codex reaches three beats reliably and the stake rarely — the
exception's dose requirement differs by family; the
suppressed-then-releasable structure does not. Upgrades the S-arc
claims from sonnet-specific to two-family structural, with per-family
degree as the profiler's dose dimension. Replies:
`exports/codex-check-replies.json`.
