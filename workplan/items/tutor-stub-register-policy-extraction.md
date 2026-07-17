---
id: tutor-stub-register-policy-extraction
title: "Extract tutor-stub register-policy pipeline into a testable service"
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-07-12
updated: 2026-07-12
verification: "node --test tests/tutorStubRegisterPolicy.test.js green; npm run test:hermetic green; tutor-stub --help and a fake-codex interactive turn unchanged; extractor asserts every moved declaration is byte-identical."
branch: claude/heuristic-panini-f2d1b9
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
  items:
    - tutor-stub-human-discourse-layer
    - continuous-register-policy
tags:
  - tutor-stub
  - register-policy
  - refactor
  - tests
---

scripts/tutor-stub.js grew to ~15.5k lines with zero exports, so none of the
deterministic assessment→register pipeline (field points, trajectory window,
dynamical-system state vector, register logits/scores, stance distribution)
was unit-testable. Move — not copy — the pure functions into
`services/tutorStubRegisterPolicy.js` and import them back into the script.
No behavior change: decisions must stay byte-identical.

Scope:

- Moved verbatim: LEARNER_FIELD_RANKS, the register-history readers
  (normalizeStoredRegisterSelection & co.), the field pipeline
  (learnerSurfaceFieldPoint, fieldProgressFromClassification,
  classifyFieldStateRelation, dagProgressFeatures,
  registerEfficacyFromDagProgress), field/state/trajectory/dynamical-system
  register scoring (buildFieldRegisterScores, buildStateRegisterScores,
  buildTrajectoryRegisterScores, buildDynamicalSystemState,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY, dynamicalGuardAdjustment,
  buildDynamicalSystemRegisterScores), distribution handling
  (normalizeEngagementStanceDistribution, sampleEngagementStanceDistribution),
  and shared numeric helpers (roundField, clampField01, scoreValue …).
- Stays in the script: LLM calls, CLI/args, rendering, selection orchestrators
  (fieldEngagementStanceSelection & co.), prose expected-move text.
- One-way dependency: the service never imports from scripts/.
- sampleEngagementStanceDistribution keeps Math.random() semantics — seeding
  is owned by P0.2 in PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md;
  tests cover only distribution normalization and the random-envelope shape.

Tests (tests/tutorStubRegisterPolicy.test.js):

- Golden decision traces: synthetic classification+DAG fixtures pin field-point
  dimensions, trajectory flags, state-vector axes, logits, and the sampled
  distribution at roundField (3dp) precision.
- Invariants: worsening evidence_use (links_evidence_to_rule →
  distorts_public_evidence) must not increase brisk or face_threat under the
  field and state policies; affective_risk > 0.45 strictly reduces
  sarcastic/face_threat logits (dynamicalGuardAdjustment); a riskRising
  trajectory must not increase face_threat under the trajectory policy.
- One-way dependency guard: service source contains no scripts/ import.
