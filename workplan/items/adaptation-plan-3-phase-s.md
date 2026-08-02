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
