---
id: strategy-ledger-followups
title: Strategy Ledger follow-ups — confirm V2b, then compose; do not rebuild trialling
status: done
type: research
priority: P2
owner: unassigned
source: manual
created: 2026-07-03
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "Each step below runs only under its own pre-registration; the item closes when the V2b confirmatory decision is made (either tier promotion or a recorded failure-to-replicate) and the composition-module question is answered or explicitly dropped."
claim_status: future
links:
  notes:
    - LAYERED-DECISION-LOOPS-PLAN.md
    - STRATEGY-LEDGER-V2-PREREGISTRATION.md
  paper: docs/research/paper-full-2.0.md#the-strategy-ledger-scene-scoped-commitaudit-loops-help-repair-an-in-run-trialling-superstructure-costs
  items:
    - layered-decision-loops
    - negative-register-effect-estimation-grid
    - blueprint-composition
  prs: https://github.com/liammagee/machinespirits-eval/pull/80
tags:
  - adaptive-tutor
  - derivation
  - strategy-ledger
  - outer-loop
  - followups
---

Follow-up menu for the strategy-ledger arc (PR #80, paper §6.13.16, v3.0.200).
The arc closed with one positive pilot signal and one instructive negative;
these steps are ordered so nothing scales before its predecessor earns it.

**1. Confirmatory replication of V2b (the priority; everything else waits on
it).** The one positive: the v1 commit/audit ledger improves repair latency
under binding conditions (8.06 vs 11.23 turns, both worlds, U=8/36, n=6/arm,
pilot tier). Pre-register a two-arm confirmatory run (baseline vs ledger-v1
only — drop the trialling arm), same binding stack (hethel-resistant +
marrick, release authority + pacing guard + mutation decay), n≥12/arm, same
frozen endpoints, promotion bar = same-direction signal at the larger n with
guardrails clean. Codex CLI serialized (~4-5h attended) or funded API.

**2. If V2b confirms: register the v1 ledger as a composition module.** The
blueprint-composition framework (cells 199-200, §6.14) now exists on main;
a confirmed conduct mechanism belongs in its registry so the composition
question ("does it still help beside the other validated mechanisms, or
sub-add?") gets asked once, in that arc's format, instead of ad hoc.

**3. If V2b confirms: mechanism localization (single delta, two arms).**
Which component does the work — the held commitment, the checked exit
condition, or the audit-binds-next-opening loop? One ablation contrast per
pre-registration, not a matrix.

**4. D2 learner mirror — only on top of a confirmed positive base.** The
staged arm never ran (its permission gate requires a live tutor-side
improvement to extend). If step 1 confirms, D2 = ledger-v1 + learner-ledger
vs ledger-v1 under the same conditions. Rationale precedent: the
character-arc result that learner self-recognition unlocks structurally via
the learner's own committed verdicts.

**5. Provocation side-effect probe (small, coordinate with the register
arc).** Two of three faithful ironic-stance runs on marrick ended in
ungrounded assertions — n=2, but a real safety-relevant hypothesis: a
faithfully performed negative stance provokes premature closure in a
resistant learner. Fold into `negative-register-effect-estimation-grid`
rather than running separately; the drama engine offers a second instrument
(lucky-leap rate) that arc lacks.

**Recorded don't-dos (from the arc's own results):** no more in-run
deliberation layers on this stack (V2a: trialling erased the repair benefit
— opportunity cost at fixed turn budget); no re-runs on schedule-solvable
worlds with compliant learners (Phase 3: levers cannot bind); no
free-choice negative registers (palette-only, face-threat simulated-only);
no D2 before a confirmed positive base arm. If trialling is ever revisited,
the redesign must move deliberation OFF the dialogue's turn budget
(between-scene, not in-scene) — and only after step 1 establishes what the
budget is being spent on.

2026-07-03 Claude: Follow-up worktree opened (`worktree-strategy-ledger-followups`
from post-merge main; old arc worktree removed, all commits reachable via
2e54476a). Step 1 seeded: `STRATEGY-LEDGER-V2B-CONFIRMATORY-PREREGISTRATION.md`
drafted (two arms, n=12/arm, per-repeat shared decay seeds 11-29 as the one
design improvement, sole primary endpoint = repair latency, promotion bar =
both-worlds direction + one-sided MW-U p<0.05 + clean guardrails; no new
headroom gate — the pilot's variance stands). Confirmatory specs written and
zero-paid-validated end-to-end (24 mock runs, frozen analysis, 0 guardrail
failures after two pre-paid applicability fixes). AWAITING GO for the paid
matrix (~5h codex attended in two blocks); prereg freezes at the commit
preceding the first paid run.

2026-07-04 Claude: Step 1 executed to completion (24/24, two interruptions
resumed label-exactly). VERDICT: NOT CONFIRMED at the frozen promotion bar —
primary endpoint REPLICATES (repair latency 8.02 vs 9.24, both worlds,
U=37.5/144, one-sided p≈0.023) but bar 3 fails on negative transfer now
visible at n=12: grounded halves (0.25 vs 0.50), T* worsens (27.17 vs 25.58),
aporia rises (0.75 vs 0.50), two per-world guardrail breaches. Faster repairs,
worse dramas — §6.13.15's local-compliance-≠-promotable precedent one layer
up. Per the pre-registration's recorded consequences: steps 2-4 CLOSED
permanently (no composition registration, no localization, no D2); step 5
(provocation probe) already folded into negative-register-effect-estimation-grid.
Paper: §6.13.16 confirmatory paragraph + revised synthesis (v3.0.201). Item
closed — the strategy-ledger line ends as validated research instrumentation,
not a promotable overlay.
