---
id: abm-learner-population
title: ABM learner population (curated persona panel, manipulation check)
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-06
updated: 2026-07-06
verification: Phase B0 no-paid gate (9-persona panel with minimal formal_interior per persona validating under loadFormalInterior, deterministic yield/resistance/engagement metrics, unit tests, stage-0 --check) passes; Phase B1 small paid pilot (~12 rows, one fixed scripted tutor stimulus against all 9 personas) meets the frozen spread threshold in the prereg note §4 (panel manipulation check only). The tutor-allocation contrast is explicitly NOT authorized by this card or its note under any B1 outcome.
claim_status: exploratory
links:
  notes:
    - notes/2026-07-06-abm-learner-population-prereg.md
tags:
  - learner-side
  - belief-desire-dag
  - persona-population
  - manipulation-check
  - evaluation
branch: worktree-longitudinal-abm
---

Build and validate a small curated panel of parameterized learner
personas (capability tier × resistance style × sycophancy setting × a
per-persona DSB-style yield key), per
`notes/2026-07-06-abm-learner-population-prereg.md` (frozen
pre-registration), as the precondition for a future tutor-allocation
contrast (uniform vs adaptive policy across a genuinely diverse learner
population) — a distinct question this card and note explicitly do
**not** yet authorize. Reuses `services/learnerInteriorGate.js` (minimal
formal interior per persona, the drift-gate reject/regenerate loop toggled
on for `pinned` personas only) and `services/learnerConfigLoader.js`
(capability-tier framing conventions). Phase B1 is a manipulation check
only: one fixed scripted tutor stimulus against all 9 personas, scored by
deterministic yield/resistance/undeclared-desire/engagement metrics —
outcome is whether the personas are behaviorally distinguishable at all,
not whether any tutoring policy works.

Acceptance:

- Each persona's `formal_interior` is machine-checkable under the existing
  `loadFormalInterior` validation, with globally unique tokens across the
  9-persona panel.
- `pinned` vs `unpinned` is implemented as one instrument with enforcement
  toggled (reject-and-regenerate vs record-only), not a forked mechanism.
- Phase B1's frozen spread threshold (prereg §4: compliant-vs-resistant
  yield gap ≥3/12 rows, and ≥3 of 5 non-compliant styles show zero yields)
  is applied exactly as written; FAIL routes to a persona-design decision,
  not to abandoning the arc and not to further paid draws without a fresh
  go.
- The tutor-allocation contrast is explicitly out of scope under every
  outcome of this card; it requires its own separate pre-registration.
- All B1 metrics are deterministic (word-bounded/stemmed lexical checks or
  the existing drift-gate classification) — no judge model anywhere in
  the decision path.

2026-07-06 Claude: Pre-registration frozen and committed
(`notes/2026-07-06-abm-learner-population-prereg.md`). Design: 9 curated
personas (not a 36-cell factorial) spanning novice/intermediate/advanced ×
{boredom, frustration, irrelevance, question_flood, rote_parroting,
compliant} × {pinned, unpinned}, each with a minimal formal_interior
(`ABM-P1`..`ABM-P9` tokens) reusing `loadFormalInterior`/
`evaluateLearnerDraft`/`buildDriftCorrectionContext` unchanged. B1 = one
frozen generic scripted tutor stimulus × 9 personas + 3 repeated draws = 12
rows via direct `generateLearnerResponse` calls (codex.gpt-5.5),
bypassing full tutor generation entirely (no tutor, no adaptivity, no
memory in this phase). Frozen spread threshold and the tutor-allocation
boundary stated in note §4. Phase B0 build follows in the same commit
boundary as the pre-registration.
