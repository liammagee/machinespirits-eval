---
id: continuous-register-policy
title: "Continuous register policies for tutor-stub adaptation"
status: done
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-07-09
updated: 2026-07-09
verification: "Tutor-stub accepts continuous_dynamical_system and continuous_empirical_dynamical_system; focused QA remains seven policies; adaptive/full suites include both continuous policies; targeted tests and dry-run pass."
claim_status: exploratory
links:
  notes:
    - notes/2026-07-09-continuous-register-ml-dag-bridge.md
  items:
    - classifier-dag-register
    - register-router-contrast
    - tutor-stub-transition-reward-model
tags:
  - tutor-stub
  - registers
  - continuous-registers
  - qa-matrix
---

Adds continuous register policies to the tutor-stub QA environment. The policy
keeps the nearest discrete `selected_register` for compatibility, but also emits
a weighted `register_vector` so the tutor can blend stance anchors such as
precise, warm, plain, and brisk rather than jumping between mutually exclusive
labels.

Acceptance:

- `continuous_dynamical_system` and `continuous_empirical_dynamical_system` are
  valid register policies, including hyphen aliases.
- Each continuous selection includes a non-empty `register_vector`,
  `continuous_register_policy.mapping.type`, entropy, and dominant blend.
- The tutor-only prompt sees both the nearest discrete register contract and the
  continuous blend instruction.
- The focused QA suite remains the seven-policy comparison; adaptive and full
  suites include both continuous policies.
- Reports preserve existing register-frequency metrics while carrying the
  continuous vector metadata for replay and drilldown views.

This is an exploratory adaptation arm, not a claim that continuous register
blends improve learning. The first implementation uses the existing
dynamical-system scores as blend weights; learned transition/Jacobian response
models remain future work.
