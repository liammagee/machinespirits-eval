---
id: evidence-use-bridge-rubric-v2
title: Version the evidence_use rubric so the bridge definition can change without mixing instruments
status: review
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-07-25
updated: 2026-07-26
verification: The default classifier prompt and all 60 default Program 2 plan
  commands are byte-identical to the pre-change checkout; opting in to
  v2_bridge_voiced changes only the rubric clauses and adds only the rubric
  flag; each plan validator fails closed when its header stamp disagrees with
  its jobs.
claim_status: exploratory
depends_on: []
links:
  code:
    - services/tutorStubPublicLearnerAnalysis.js
    - scripts/run-program2-live-pilot.js
    - scripts/tutor-stub.js
    - tests/program2LivePilotEvidenceUseRubric.test.js
  items:
    - program-2-phase5d-second-transfer-world
tags:
  - tutor-stub
  - classifier
  - program-2
  - instrument
---

`evidence_use` is the classifier seat's only routed output: it is the sole input
to `warrant_skip`, which decides whether the tutor intervenes at all. Its
`omits_warrant` label was measured at 26.2% cross-family self-reproducibility —
close to a coin flip — and a one-clause repair ("the bridge must be voiced in
this turn") lifted it to 78.6%, weighted κ 0.583. The repair is worth having,
but applying it in place would silently swap the instrument underneath in-flight
Program 2 pilots.

The reason is a denominator, not a rubric quarrel. Program 2's headline numbers
are compliance *fractions* whose denominator is "turns where `warrant_skip`
fired". Measured on the 1,281 graded `warrant_skip` turns in the Phase 5b/5c
archive: turns whose learner line is a bare conclusion (n=1,086) score 27.3%,
turns that limit their own inference (n=195) score 34.4%, pooled 28.4%. The
repaired rubric quiets the second family, so the denominator loses 15.2% of its
turns — the easiest ones — and identical tutor behaviour reads 27.3% instead of
28.4%. That is a ~1 point shift owed to the instrument.

What that does and does not threaten:

- Between-arm gaps (+0.236 Phase 5b, +0.202 Phase 5c) survive, because both arms
  lose the same turns.
- The deterministic compliance battery survives; no model sits in its path.
- Absolute compliance levels are not comparable across versions.
- The archived classifier calls cannot be pooled with new ones — two constructs
  under one name.
- The archived turns are stale as distillation labels.

So the rubric is versioned rather than edited. `V1` stays the default, which is
what makes the change safe to land while arcs are in flight: a run that does not
opt in is bit-for-bit the run it was before. `V2_BRIDGE_VOICED` is a deliberate
per-run act (`--learner-analysis-evidence-use-rubric`), and every Program 2 plan
stamps the version it used beside `detectorVersion`, so a later analysis can
refuse to pool across versions instead of averaging two instruments.

The stamp is checked, not merely written. The pre-existing `DETECTOR_VERSION`
stamps the compliance *grader*, so before this change a classifier-prompt swap
would have passed every guard silently; each plan validator now fails closed
when its header disagrees with its jobs.

The `distorts_public_evidence` and `overleaps_evidence` clauses are
byte-identical across versions and test-enforced to stay that way, which bounds
the edit to the clause it claims to touch. Only `distorts_public_evidence` is a
*control*, though: `warrant_skip` fires on two labels, `omits_warrant` and
`overleaps_evidence`, so the latter sits inside the causal path under study, and
redefining the `omits_warrant` boundary can move mass across it. Byte-identity is
a textual guarantee, not a behavioural one.

Open and deliberately not done here (see
[[evidence-use-v2-default-and-archive-relabel]]):

- Flipping the default to `V2_BRIDGE_VOICED`. That is a decision about which
  construct Program 2 measures going forward, and it forfeits comparability with
  the Phase 5/5b/5c absolute levels.
- Relabelling the archive's 2,363 stored classifier calls so they can serve as
  distillation labels under the repaired construct.
- Distilling the local model against a two-family consensus target. The archive
  is single-family, so this needs a second judge pass first.
