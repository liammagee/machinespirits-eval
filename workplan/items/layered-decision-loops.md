---
id: layered-decision-loops
title: Strategy Ledger v1 — per-agent commit/audit loops at block/scene/act scope
status: active
type: research
priority: P1
owner: human
source: manual
created: 2026-07-02
updated: 2026-07-02
verification: "Phases 0-2 implemented: npm run derivation:ledger-gates 22/22 zero-paid checks (proof fingerprints byte-identical on/off, both casts; row-schema symmetry); tests/dramaticDerivationStrategyLedger.test.js 13/13 (off-state invariance pinned); full npm test 4653/0. Phase 3 contrasts pre-registered before any paid run."
claim_status: scope-bound
links:
  notes: LAYERED-DECISION-LOOPS-PLAN.md
  items:
    - layered-task-session-adaptation
    - layered-taskloop-heldout-gate
tags:
  - adaptive-tutor
  - derivation
  - outer-loop
  - strategy-ledger
  - symmetry
---

Review finding (2026-07-02, full detail in `LAYERED-DECISION-LOOPS-PLAN.md`): the
four adaptation scopes (turn/dialogue_block/scene/act) exist as vocabulary,
offline-gated library functions, and advisory prompt lines — but the live drama
loop makes strategy decisions (register, information-release posture, didactic
mode) only per turn, except the acts-mode plot/throughline stack. dialogue_block
has no live implementation; scope fields are labels on last-utterance regex
classifiers; exit conditions are never checked; the learner owns no strategy at
any scope.

Proposal: generalize the proven commit-at-opening / audit-at-close pattern (C1
plot + throughline) down to scene and block scope and across to the learner —
one strategy-ledger row shape for both agents, conduct-binding at scene scope,
proof-advisory always (A20/A21 discipline).

Phases:

1. Phase 0 — wiring debts: check exit conditions (deterministic markers),
   maintain opportunity-cost counters live, segment blocks from exchange
   episodes, hold didactic mode stable within a block.
2. Phase 1 — tutor boundary decisions: scene-opening commitment fields in the
   existing ego call (register from palette, didactic default, release posture,
   recognition budget) held by the harness for the scene; scene-close audit;
   block-failure escalation.
3. Phase 2 — learner symmetry: learner scene commitments + act carry-forward
   verdicts (the structural mirror-verdict lever); learner superego audits at
   boundaries, not per turn.
4. Phase 3 — pre-registered contrasts E1 (persistence), E2 (register as
   decision), E3 (learner ledger), with proof-fingerprint and negative-transfer
   guardrails. Results fold into paper-full-2.0.md §6.13.x/§6.16.

Non-goals: proof-authority changes, task/session sequencing (stays archived),
handoff activation, ToM layers, new rubrics.

2026-07-02 Claude: Phases 0-2 implemented in worktree `strategy-ledger`
(branch worktree-strategy-ledger). New `services/dramaticDerivation/strategyLedger.js`
(blocks, deterministic exit-condition clearance, escalation table, commitment
shape gates, boundary audits, mirrored row shape); engine wiring (opt-in
`strategyLedger`/`learnerLedger` options, block state beside sceneState,
scene-register apply/hold/revert, live opportunity counters with on_scene_exit
resets, ledger rows + events, sealed-scene summaries); llmRoles wiring (tutor
scene commitments demanded at openings + standing lines + deterministic
scene-close audits that bind the next opening + didactic hold/escalation;
learner scene intents + act carries, private to the learner); mock-client
echoes for zero-paid runs; runner dials + gate script
`scripts/derivation-ledger-gates.js` (npm run derivation:ledger-gates,
22/22) + regression tests (13/13). Conduct-only discipline held: gate L3
pins proof-control fingerprints byte-identical ledger-on vs ledger-off.
Phase 3 (E1 persistence / E2 register-as-decision / E3 learner ledger)
awaits a go decision — nothing empirical claimed.

2026-07-03 Claude: Phase 3 executed as pre-registered
(STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md): 4-arm single-delta ladder,
bitterwell+ravensmark, 3 interleaved repeats, gemini-flash, ~$1.97 total.
NULL on E1/E2/E3 with 15/15 guardrails passing (0 leaks, release parity,
coverage 1.00). Levers measurably unexercised: 0/24 register switches,
blocks 1-3/arm, all runs grounded at the forcing turn (ceiling). Report:
exports/dramatic-derivation/strategy-ledger/phase3-contrasts-report.{json,md}.
Pilot null stands; any binding-conditions follow-up is a new pre-registration.

2026-07-03 Claude: Strategy Ledger v2 (mechanism trialling) designed after the
operator's re-articulation: strategy = choice among adaptive mechanisms made by
reviewing history (effectiveness review, not conformance audit), guiding but
not determining turns (licensed departures, justified_deviation vocabulary),
layered adjudication over one instrument (scene release INTENT under
release-authority with guards binding). Spec: LAYERED-DECISION-LOOPS-PLAN.md
Part 6. Blocked on integration: register-taxonomy (cells 196-198) and
blueprint-composition (cells 199-200) worktrees must merge first; then refresh
from main, re-run v1 gates, finalize the v2 pre-registration against the
merged register registry. Binding-conditions precondition gate: T* variance
must exist before any matrix spends.

2026-07-03 Claude: Register-taxonomy arc landed on main (merge 4f919c23) and
was merged into this branch (07c91091); v1 gates re-run 22/22, registry +
stance-fidelity tests green. Part 6 revised: register dependency RESOLVED
(menu binds to engagementRegisterRegistry; surface-style vs interpersonal-
stance axes kept distinct); two-gate adjudication imported as a structural
requirement (treatment-fidelity gate before effectiveness review — the
warm-in-costume lesson, 10/15 pre-repair vs 15/15 post-repair faithful);
negative registers palette-only, face_threat simulated-only;
blueprint-composition downgraded from blocking to watch. v2 pre-registration
now unblocked.

2026-07-03 Claude: v2 IMPLEMENTED (same branch): trialling/stancePalette/
releaseIntent config keys on the existing --strategy-ledger JSON; stance +
release-intent commitment fields; mechanism-history table + persist/adjust/
switch review at openings; licensed departures (justified_deviation, stance
exempt); engine-side two-gate close via the landed evaluateRegisterStanceFidelity
(negative registers only — positive stances pass as not_applicable; faithful
needs the full cue+target+move+repair+resistance battery). Gates 30/30 incl.
guards-untouched fingerprint; tests 19/19; full suite 4714/0; lint+format
clean. Remaining: v2 pre-registration + headroom precondition probe before
any paid contrast.
