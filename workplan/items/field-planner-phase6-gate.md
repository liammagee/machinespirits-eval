---
id: field-planner-phase6-gate
title: "Phase 6 field-planner evidence gate — four-arm real-mode run"
status: triaged
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-10
updated: 2026-07-10
verification: "A real-mode gate run (baseline, field_report_only, field_planner_advisory, field_planner_enforce; k>=5 seeds; frozen manifest with git SHA written before model calls) exists under exports/dramatic-derivation/phase6-gate; the decision rules of PHASE_6_EVIDENCE_GATE_PLAN.md are applied as written and the verdict (promote / negative control / ceiling) is recorded."
claim_status: planned
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
  runner's smoke profile currently omits world-019 — add it or record the
  deviation.
- **Seeds.** k=5 per arm per world for the directional read (k=10 for a
  promotable claim). Real-mode seeds are labels (decay pairing only) — report
  per-arm distributions, not seed-paired deltas.

Launch command shape (attended, sequential in real mode, checkpointable):

```bash
node scripts/run-derivation-phase6-gate.js \
  --label phase6-gate-real-k5 \
  --profile smoke \
  --arms baseline,field_report_only,field_planner_advisory,field_planner_enforce \
  --seeds 1,2,3,4,5 \
  --decay-rate 0.08 \
  --mode real
```

Decision rules are already frozen in PHASE_6_EVIDENCE_GATE_PLAN.md, including:
enforce wins that harm release adherence = negative control, not success;
report-only matching planner arms = instrumentation effect, not planner
control. Run from a committed SHA only.
