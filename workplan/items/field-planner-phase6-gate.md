---
id: field-planner-phase6-gate
title: "Phase 6 field-planner evidence gate — four-arm real-mode run"
status: blocked
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-10
updated: 2026-07-11
verification: "Before any real call, reconcile baseline_hidden_proofdebt with explicit pacing/proof-debt/repair/confront+decay flags and freeze a numerical aggregate verdict contract/evaluator. Then a clean-SHA four-arm run with k>=5 exists under exports/dramatic-derivation/phase6-gate and records a provisional promote/instrumentation/negative-control/ceiling/null verdict; k>=10 is required for a promotable local claim."
claim_status: planned
blocked_by: "The frozen plan names baseline_hidden_proofdebt, but the runner's current baseline supplies only hidden pacing; numerical meanings for improvement, material safety change, placebo matching, and ceiling are also not frozen. Real mode now refuses to launch until both the treatment and deterministic verdict evaluator are ratified."
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md
    - PLAN_4_0/FIELD_THEORY_IMPLEMENTATION_PLAN.md
    - PLAN_4_0/2026-07-10-preconscious-adaptation-review.md
tags:
  - dramatic-derivation
  - field-planner
  - phase6-gate
  - adaptation
  - pre-registration
milestone: adaptive-tutor-evidence-v1
---

Run the pre-registered four-arm field-planner gate in real mode. As of
2026-07-10 only plumbing exists: mock smokes (all arms at ceiling; decay smoke
separation = release-forcing) and one real n=1 enforce-only row with no
baseline. The placebo arm is now genuinely flag-distinct
(`--field-report-context` injects the coupled-field summary with no conduct
authority), so decision rule 2 can bind.

Freeze BEFORE launch (in the manifest, not after results):

- **Failure mode.** Baseline already grounds marrick/hethel at ~20-23 turns
  without decay, so a no-decay gate returns "ceiling result" by its own
  decision rules. Default: decay 0.08 / mutate-share 0.25 (matching the mock
  decay smoke). Alternative: the resistant worlds (world-010, world-019).
- **World set.** Smoke trio marrick + hethel + world-019 per the plan; the
  runner profile is now regression-tested against exactly this set.
- **Seeds.** k=5 per arm per world for the directional read (k=10 for a
  promotable claim). Real-mode seeds are labels (decay pairing only) — report
  per-arm distributions, not seed-paired deltas.

Historical launch shape (now intentionally rejected until the blockers below
are resolved; attended and sequential once ratified):

```bash
node scripts/run-derivation-phase6-gate.js \
  --label phase6-gate-real-k5 \
  --profile smoke \
  --arms baseline,field_report_only,field_planner_advisory,field_planner_enforce \
  --seeds 1,2,3,4,5 \
  --decay-rate 0.08 \
  --mode real
```

Qualitative decision rules are preregistered in
PHASE_6_EVIDENCE_GATE_PLAN.md, including: enforce wins that harm release
adherence = negative control, not success; report-only matching planner arms =
instrumentation effect, not planner control. Their numerical semantics still
need ratification before outcomes exist. Run from a committed SHA only.

2026-07-11 Codex: Migrated the runner to the immutable evidence transaction,
strict role-model provenance, and sealed reports without changing arm or
planner code. The smoke world reconciliation is complete. No paid gate rows
were launched; the subsequent audit below found that those preserved commands
do not yet match the named control treatment.

2026-07-11 Codex audit: Blocked real mode before calls after finding that the
preregistered `baseline_hidden_proofdebt` treatment is not the runner's current
`baseline_hidden_pacing` command. The proof-debt guard also requires a frozen
repair/confront/decay configuration. The prose decision rules leave numerical
comparison and safety margins underspecified, so a deterministic aggregate
verdict cannot yet be implemented without post-outcome discretion. The runner
now also refuses dirty/SHA-drifted real runs, requires the complete audit packet,
separates execution from safety failures, and leaves incomplete transactions
unsealed for same-plan resume. Mock plumbing remains available.
