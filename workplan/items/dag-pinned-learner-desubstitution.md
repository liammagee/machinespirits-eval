---
id: dag-pinned-learner-desubstitution
title: DAG-pinned resistant learner and the de-substitution test
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-03
updated: 2026-07-03
verification: Stage 0 no-paid gate (interior schema, drift gate extending resistanceSignalGate, deterministic yield checker, tests, hermetic dry-run) passes; Stage 1 instrument-validation probe meets frozen thresholds (selectivity ≥0.8, false-yield ≤0.1) before Stage 2; the 3-arm × 5-subtype matrix runs only after both gates with recorded go decisions; H-D/H-O verdicts applied exactly as frozen in the plan note §4.
claim_status: planned
links:
  notes:
    - notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md
tags:
  - learner-side
  - belief-desire-dag
  - drift-gate
  - de-substitution
  - composition
  - evaluation
branch: worktree-blueprint-composition
---

Test whether §7.11's substitution reading is conditioned on a
non-discriminating learner, per
`notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md` (frozen
pre-registration). The instrument: a learner pinned to a formal interior
(micro belief-DAG with one blocking element + declared desire set) whose
resistance is criterial — it may yield only when the tutor actually
addresses the blocking element (deterministic DAG check, the DAG-SFS
precedent) — held in character by a criterial learner-superego drift gate
(rejection + corrective regeneration; extends resistanceSignalGate). The
matrix: fixed-strategy floor (cell 186 variant) vs multi-strategy backbone
(cell 193 variant) vs kernel (cell 199 variant) across the five resistance
subtypes; primary outcome is deterministic grounding rate
(architecture-independent, no judge in the decision path); the existing
§6.14 corpus is the legacy-learner control at zero new spend.

Acceptance:

- Learner interior and yield rule are machine-checkable; the drift gate is
  criterial (reject + regenerate), turn-indexed, with exhaustion recorded
  as instrument failure, never tutor evidence.
- The embedded sycophancy probe (targeted vs mismatched vs generic
  scripted tutor turns) passes its frozen thresholds before any
  de-substitution interpretation (H-V precondition).
- H-D and H-O verdicts follow the frozen thresholds (real ≥5/20 gap,
  dissolved ≤2/20, 3-4 unresolved-STOP) with the interpretation map in the
  note §4 — either direction is a §7.11 result.
- Circularity of the engagement filters is bounded and disclosed as
  written in note §6; no paid stage runs without its own recorded go.

2026-07-03 Claude: Pre-registration frozen and committed. Nothing built;
Stage 0 awaits a go decision.

2026-07-03 Claude: Stage 0 COMPLETE (user go; full log in note §7). Built:
five `desub_resistance_*` scenarios with formal interiors (17 unique DSB-*
tokens), `services/learnerInteriorGate.js` (content condition, drift-gate
verdicts, correction injection, deterministic grounding checker, frozen
Stage-1 classifier prompt), runner wiring (character sheet + cumulative
content condition + drift-gate retry loop + grounding trace; exhaustion =
instrument_failure, message never replaced),
`scripts/run-desubstitution-probe.js` (--check green: targeted 5/5,
mismatched 0/5, generic 0/5, cross 0/20; --live hard-gated on Stage 1 go),
`scripts/report-desubstitution-stage0.js` (--check PASSED). Verification:
64/64 focused tests, validate-config 0 errors, lint/prettier clean.
Recorded §3.1 deviation: no new cells — arms reuse 186/193/199; pinning is
scenario+gate-driven, keeping config hashes clean against the legacy §6.14
control corpus. Stage 1 (paid instrument validation) awaits go.
