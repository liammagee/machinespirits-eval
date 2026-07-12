---
id: tutor-stub-multiworld-policy-replication
title: "Register confirmatory: fixed-horizon policy x profile interaction at n=5 (final-stretch Step 2)"
status: triaged
type: experiment
priority: P1
owner: unassigned
source: review
created: 2026-07-11
updated: 2026-07-13
verification: "A frozen pre-registration runs {bland, field, negative} x {diligent, affective_resistant, false_memory, proof_skipper} v3 contracts x n=5 per cell on both model families (codex.gpt-5.6-terra and claude-code sonnet-5), deterministically interleaved, turn-6 pressure probe in every arm, binding safety-turns 40, outcome-only scoring, in-run profile-discrimination gates on the run's own control cells. Primary endpoint: coverage at learner turn 16, estimated as policy x profile interaction contrasts. Secondary: coverage/mastery/risk AUC turns 1-16, until-grounded endpoint, post-probe recovery (window 4). Pre-committed interpretation: bland leading diligent is part of the predicted signature; the claim under test is the crossing; a null is no interaction at n=5 on either family."
claim_status: planned
depends_on:
  - adaptive-eval-immutable-provenance
  - tutor-stub-typed-pedagogical-actions
links:
  notes:
    - REGISTER-CONFIRMATORY-PREREGISTRATION.md
    - PRECONSCIOUS-FINAL-STRETCH-PLAN.md
    - PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md
    - PLAN_4_0/2026-07-10-headroom-fixed-horizon-interactions.md
    - PLAN_4_0/2026-07-10-adaptive-policy-discrimination-and-learner-diversity.md
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
tags:
  - adaptive-tutor
  - tutor-stub
  - multi-world
  - confirmatory
  - controls
milestone: adaptive-tutor-evidence-v1
---

Confirm (or close) the arc's one replicated exploratory positive: policy x
profile rank crossings at fixed horizons, found at n=3 on gpt-5.6-terra and
replicated in structure on Sonnet 5. This is the single highest-value paid run
in the final-stretch plan and runs before any other paid step.

2026-07-11 Codex: Blocked before paid policy calls. The first bounded formal
benchmark did not clear its gates, but later audit showed it tested partial
proxies rather than the canonical policy-invariant sensor. Reopen only after the corrected,
independently crossed v2 sensor dataset passes the upstream card; do not tune a
policy on either the failed v1 fixture or the v2 pilot.

2026-07-13 Claude: Re-scoped as final-stretch Step 2 per
PRECONSCIOUS-FINAL-STRETCH-PLAN.md and unblocked from the learner-state sensor
gate. Rationale: the confirmatory tests the ACTUATOR-side interaction (register
variation x learner profile) on mechanical fixed-horizon endpoints; it makes no
sensor-validity claim, consumes no state representation, and its pre-declared
signature was already observed exploratorily on both families
(PLAN_4_0/2026-07-10-headroom-fixed-horizon-interactions.md). The sensor null
(do_not_run_canonical_s2) therefore does not gate it. `dynamic` is excluded
from claim-bearing arms — its non-transfer is a two-model result (terra's best
stress arm, Sonnet's worst; endpoint closure 0.083 vs bland 0.667); at most one
diagnostic cell on one stack, reported descriptively. Launch requires: Step 0
provenance gate (done 2026-07-13 — seeded draws, stamped run headers, archived
evidence), a frozen dated pre-registration doc carrying the verification block
above verbatim, and an explicit go (attended, ~120 dialogues, checkpointed).
Cost ~2 attended quota days.

2026-07-13 Claude: Pre-registration DRAFTED at
REGISTER-CONFIRMATORY-PREREGISTRATION.md (status DRAFT; freezes at launch go).
Model decision per user direction: codex first — family block A =
codex.gpt-5.5 at all four seams (tutor, auto-learner, classifier,
learner-record), family block B = claude-code Sonnet 5 at all four seams in a
later window. Not gpt-5.6-terra: terra was only ever reached via the
since-fixed flag-forwarding bug; the in-run discrimination gate supplies the
profile validation gpt-5.5 never had, and run_start provenance (Step 0.2) now
verifies identity mechanically. Per-block monoculture is deliberate (matches
the exploratory instrument being confirmed; the cross-family block is the
check). No judge seam exists — outcomes are harness-computed. Launch = flip
the prereg Status to FROZEN, commit, run block A (60 dialogues, ~1 attended
day), block B in a later window.

2026-07-13 Claude: Model decision AMENDED after review (user challenge:
why not terra?). Block A = codex.gpt-5.6-terra at all four seams, not
gpt-5.5. A confirmation holds the instrument fixed: the exploratory
crossings were measured on terra, the arc's headline finding is that policy
effects are model-dependent (so a 5.5 null would be stack-ambiguous), and
the v3 profiles are gate-validated on terra but never on 5.5. Terra is
listed live in providers.yaml (CLI-probed 2026-07-12, codex 0.144.1);
identity verified from run_start provenance. gpt-5.5 is recorded in the
prereg as the rejected alternative, available as an optional post-confirmation
generalization block (Step 2b, own go). Prereg draft amended in place
(still DRAFT; freezes at launch go).
