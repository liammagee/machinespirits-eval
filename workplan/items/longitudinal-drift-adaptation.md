---
id: longitudinal-drift-adaptation
title: Longitudinal drift adaptation (cross-session memory as new signal)
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-06
updated: 2026-07-06
verification: Stage A0 no-paid gate (drift-schedule scenarios, deterministic marker checker reusing learnerInteriorGate's word-bounded matching, unit tests, stage-0 --check) passes; Stage A1 small paid pilot (~10 rows — cap-vs-uncapped check plus 3-session pad-on/pad-off arc) meets the frozen instrument-validity gate in the prereg note §3 before any interpretation. Scope frozen at Stage A1 — no confirmatory matrix without a fresh pre-registration.
claim_status: exploratory
links:
  notes:
    - notes/2026-07-06-longitudinal-drift-adaptation-prereg.md
tags:
  - tutor-side
  - writing-pad
  - cross-session
  - longitudinal
  - evaluation
branch: worktree-longitudinal-abm
---

Test whether cross-session drift — a learner's hidden state (current
interest, active misconception) changing between sessions on a
harness-owned schedule the tutor never sees directly — is a source of
signal the model lacks in-context, per
`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md` (frozen
pre-registration). Motivated by §6.6.11's cross-session ego pre-alignment
result (+1.31/session, the one positive trajectory finding in a paper
otherwise dominated by null/substituted within-dialogue adaptation) and by
the DAG-pinned-learner arc's closed confirmatory result (H-Dc/H-Oc both
DISSOLVED — substitution survives even a criterially resistant learner).
The instrument: the existing byte-identical §6.6.9 Writing Pad ablation
pair (`cell_40` pad-ON vs `cell_93` pad-OFF, no new tutor-agents.yaml
cells), three new drift-schedule scenarios carrying invented
harness-owned misconception tokens, and a deterministic marker checker
(`services/longitudinalDriftChecker.js`) scoring the tutor's session-N
output for current-session-reference vs stale-session-(N-1)-reference,
reusing `wordBounded`/`containsAny` exported from
`services/learnerInteriorGate.js`. A frozen cap-vs-uncapped quality check
(v2.2 first-turn score) decides the tutor ego's `max_tokens` cap before it
is used in the main rows.

Acceptance:

- Drift schedule and marker checker are machine-checkable (word-bounded
  matching only, no judge in the primary-outcome decision path).
- The cap-vs-uncapped quality check runs and is decided **before** the cap
  is used in the main drift-tracking rows (prereg §2.4's frozen one-shot
  procedure).
- Stage A1's instrument-validity gate (current-reference ≥ 2/3 in at least
  one arm) is checked before any stale-reference reading is interpreted;
  a nonzero pad-OFF stale-reference rate is treated as a red flag, not a
  finding (prereg §3).
- Stale-reference is reported as directional-only at n=3 sessions/arm —
  this note and its companion do not license a real/dissolved verdict at
  this n; a confirmatory design is a distinct, separately pre-registered
  future decision.
- No paid row beyond the ~10-row Stage A1 design runs without a fresh
  pre-registration and recorded go (no-scaling discipline, prereg §5).

2026-07-06 Claude: Pre-registration frozen and committed
(`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md`). Design:
reuses `cell_40`/`cell_93` unchanged (no new cells) with `codex.gpt-5.5`
ego/superego CLI overrides; three `longitudinal_drift_session_{1,2,3}`
scenarios appended to `config/suggestion-scenarios.yaml` carrying invented
`LDS-M{1,2,3}` misconception tokens on a fractions→ratios→linear-equations
schedule; primary outcome is word-bounded current/stale marker matching on
the tutor's session-N output, architecture-independent and judge-free.
Frozen thresholds: instrument-validity gate (current-reference ≥2/3 in at
least one arm) must pass before any stale-reference interpretation;
stale-reference itself is directional-only at this n; row-level generation
or schedule-validation failures are excluded as instrument failures, not
scored. Stage A0 build follows in the same commit boundary as the
pre-registration.
