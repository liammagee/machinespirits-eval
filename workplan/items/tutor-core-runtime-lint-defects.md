---
id: tutor-core-runtime-lint-defects
title: "Repair tutor-core runtime faults exposed by lint"
status: review
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-08-27
updated: 2026-08-28
verification: Focused regression tests execute the writing-pad demand branch
  in negotiateDialectically and the exported quickGenerate option flow; both
  complete without an assignment or undefined-variable error, the relevant
  tutor-core tests pass, and tests/tutorCoreSeamGuard.test.js remains green.
links:
  notes:
    - tutor-core/services/dialecticalEngine.js
    - tutor-core/services/tutorDialogueEngine.js
    - tests/tutorCoreSeamGuard.test.js
  items:
    - tutor-core-lint-and-format
tags:
  - tutor-core
  - runtime
  - lint
  - regression
---

A read-only no-ignore ESLint audit exposed two probable runtime faults inside
the in-housed module:

- `negotiateDialectically()` destructures `learnerContext` as a constant and
  then reassigns it when a writing-pad demand event is present. That active
  branch can throw before generating the superego critique.
- the exported `quickGenerate()` passes an undeclared `hyperparameters`
  identifier into `egoGenerateSuggestions()` instead of reading the option.

Acceptance:

- Reproduce both branches with focused tests before changing them.
- Repair each fault narrowly and preserve the existing public option shape.
- Run the affected tutor-core tests and the re-extraction seam guard.
- Do not combine the fixes with the 27-file formatting sweep or unrelated
  cleanup surfaced by lint.

No affected run has been identified, so this is P2 rather than an incident P1.
The remaining lint and formatting adoption stays on
`tutor-core-lint-and-format` after these behavior-bearing fixes land.

- 2026-08-28 — Landed. Both faults were reproduced first, in
  `tutor-core/services/__tests__/runtimeDefects.test.js`: the demand branch
  threw `TypeError: Assignment to constant variable` at
  `dialecticalEngine.js:471`, and `quickGenerate()` threw
  `ReferenceError: hyperparameters is not defined` on every call.
  Repairs are narrow. The demand text now extends the caller context into its
  own binding, which the superego critique, the ego reply, and the recognition
  moment all read — the reassignment was meant to reach all four call sites, so
  all four follow it. `quickGenerate()` reads `hyperparameters` from its options
  with the same `null` default `egoGenerateSuggestions()` already uses, so the
  public option shape is unchanged. Core suite 142/142 and
  `tests/tutorCoreSeamGuard.test.js` green. No formatting sweep in this change.
