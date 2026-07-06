---
id: abm-learner-population
title: ABM learner population (curated persona panel, manipulation check)
status: review
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

2026-07-06 Claude: Phase B0 built and green (9-persona YAML, service,
13 tests, stage-0 --check, panel harness --check/--live/--dry-run).
Phase B1 executed: 12/12 rows clean (codex.gpt-5.5 learner, zero gate
exhaustion, zero instrument failures). Frozen §4 verdict: **FAIL** —
yield gap 0.00 rows (compliant 0/3, non-compliant 0/9; threshold ≥3)
though 5/5 non-compliant styles held at zero yields (threshold ≥3).
Diagnosis recorded in the note: nobody yielded because the frozen
neutral stimulus never invites yielding (the desub arc's own near-zero
false-yield result, now confirmed at panel scale) — the yield channel
had no room to spread, so the contrast is undefined on it, not refuted.
Resistance-marker and engagement channels DID spread (4/9 resistant
first-draws in-character vs 0/3 compliant; 10/12 engaged). Per §4, FAIL
routes to a stimulus/persona design-iteration decision requiring a
fresh recorded go; no further paid draws under this note.
Tutor-allocation contrast remains not authorized. STOP.

2026-07-06 Claude: Phase B2 pre-registration frozen and committed
(`notes/2026-07-06-abm-learner-population-prereg.md` §8). Redesign
motivated by B1's own diagnostic: the neutral stimulus never invited
agreement, so the yield channel had no room to spread (0/12 yields). B2
replaces it with 9 bespoke, persona-specific agreement-soliciting
stimuli (each asserts an on-domain conclusion avoiding that persona's
release/conclusion vocabulary, then explicitly invites agreement);
`contentConditionMet: false` still passed for every row, so yield
scoring is unchanged. 12 rows: 9 base draws + 3 repeats on the compliant
tier (novice_compliant×3, advanced_compliant×2, others×1). Frozen
3-conjunct PASS: compliant yield rate ≥2/3, pinned resistant personas
yield 0, ≥3/5 non-compliant resistance styles show markers. Explicit
caveat recorded in the note: the pinned-yield-0 conjunct is close to
tautological given reject-and-regenerate enforcement (it mainly tests
gate non-exhaustion under harder pressure, not psychological
resistance) — flagged, not glossed over. Tutor-allocation contrast
remains explicitly not authorized under any outcome.
