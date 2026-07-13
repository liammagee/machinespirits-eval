---
id: tutor-stub-multiworld-policy-replication
title: "Register confirmatory: fixed-horizon policy x profile interaction at n=5 (final-stretch Step 2)"
status: done
type: experiment
priority: P1
owner: unassigned
source: review
created: 2026-07-11
updated: 2026-07-14
verification: "A frozen pre-registration runs {bland, field, negative} x {diligent, affective_resistant, false_memory, proof_skipper} v3 contracts x n=5 per cell on both model families (codex.gpt-5.6-terra and claude-code sonnet-5), deterministically interleaved, turn-6 pressure probe in every arm, binding safety-turns 40, outcome-only scoring, in-run profile-discrimination gates on the run's own control cells. Primary endpoint: coverage at learner turn 16, estimated as policy x profile interaction contrasts. Secondary: coverage/mastery/risk AUC turns 1-16, until-grounded endpoint, post-probe recovery (window 4). Pre-committed interpretation: bland leading diligent is part of the predicted signature; the claim under test is the crossing; a null is no interaction at n=5 on either family."
claim_status: scope-bound
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

Test and close the arc's exploratory policy x profile rank-crossing signal at
claimable n on the two original whole-stack model families. The final strict
result is negative: no family confirmation and no two-family claim.

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

2026-07-13 Claude: LAUNCH GO received; version note corrected per user
(terra = incremental update over 5.5, not preview; general rule = run
capability studies on latest versions to avoid rear-view-mirror claims).
Prereg FROZEN with the pinned block-A command (run seed 20260713, terra at
all four seams, trace dir register-confirmatory-terra-n5-live-2026-07-13).
Block A launching from the freeze commit; progress polled ~every 25 min
with per-model call counts, payload-based token estimates, and ETA
(subscription CLIs expose no token meters — call counts + wall clock are
the quota-actionable metrics).

2026-07-13 Claude: Block B (Sonnet 5, all four seams) LAUNCHED on user go,
concurrent with block A — independent quota pools (codex vs Claude), so the
sequential-when-quota-shared rule does not bind across blocks. Same design,
same seed 20260713, trace dir register-confirmatory-sonnet5-n5-live-2026-07-13.
Execution record appended to the prereg Results section. Interim block-A
note (diligent column complete, monitoring only): negative leads diligent
at t16 (0.667 vs bland 0.500) unlike the probe-free exploratory ordering,
but with 2/5 hard-safety failures and 9 leaks in the negative cell; endpoint
pattern (all ground, bland fastest) reproduces. Decisive stress cells in
flight.

2026-07-14 Claude: BOTH FAMILIES COMPLETE (n=5), Step 2 CLOSED. Verdict
under the frozen rules: the two-family general claim is NOT licensed. The
profile-contingent register interaction replicates in STRUCTURE (rank
crossings on both families) but not in GEOMETRY — no policy/direction
generalizes across families (negative leads diligent on terra +0.167*,
comes last on Sonnet -0.201; only terra's negative sign-flip and its
affective collapse reach bootstrap significance; Sonnet is a floor-dominated
null at n=5 with every CI crossing zero). The adaptive selector (field)
confirms nothing on either family; its only edge is secondary
(robustness/speed). Continuous with §6.3 adaptation null + §7.11 substitution
law. Full result + two-family assessment: REGISTER-CONFIRMATORY-PREREGISTRATION.md
Results. Block A archived (terra 129M), Block B archived (sonnet 225M, all
legs incl. 5 quarantined window-death dirs + unsealed merged top-up).
Execution: 5 Sonnet window deaths, all re-run per the frozen technical-failure
rule; affective assembled from 3 sealed legs (4 top-up rows died post-t16 —
included for the cov@t16 primary endpoint, verdict invariant to exclusion).
Two harness fixes surfaced: qa-matrix root verification (landed by a
concurrent session, e159a827) and a --resume-from draw-contract exemption
(implemented + regression-tested; the concurrent session implemented the same
fix in-tree). Next: Step 4 side-coaching gate (the contraindication-guardrail
design this result argues for); Step 6 capstone drops the register SELECTOR,
keeps the palette + a per-model contraindication guard.

2026-07-14 Codex correction: The exact final 60 traces per family were selected
from the hash-verified archives and analyzed through the tracked zero-call path
`scripts/analyze-register-confirmatory-step2.js`. Terra's frozen profile gate
fails (average cosine 0.812; max to diligent 0.912), so its off-direction
negative x affective-resistant interaction is instrument-invalid for a family
claim. Sonnet's frozen gate passes (0.645/0.694) but every interaction interval
crosses zero. The strict verdict is no family confirmation, no two-family
claim, and no field-selector effect. Compact canonical outputs:
`exports/register-confirmatory-evidence/final/`; Sonnet's four post-t16 top-up
rows remain primary-valid, secondary-unavailable, and the exclusion sensitivity
is still null.
