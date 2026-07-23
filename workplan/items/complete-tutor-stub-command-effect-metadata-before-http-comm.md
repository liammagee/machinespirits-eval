---
id: complete-tutor-stub-command-effect-metadata-before-http-comm
title: Complete tutor-stub command effect metadata before HTTP command exposure
status: triaged
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-07-23
updated: 2026-07-23
verification: Every command declares model-call, file-write,
  persistent-mutation, session-clear, and process-exit effects; registry
  invariants and negative transport tests fail closed for any undeclared or
  disallowed effect.
---

Context. Link out for detail; do not copy.
