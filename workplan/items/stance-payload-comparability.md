---
id: stance-payload-comparability
title: Say what each stance was asked to do, wherever two stances are differenced
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: Every report that puts two stances in one table prints their mandated moves and the rubric that scored each, read from the register registry rather than written in prose; an arm the registry cannot resolve fails the report closed; the scorer and the reports resolve a stance's instrument through one function, pinned by a source-level guard.
claim_status: exploratory
links:
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  items:
    - sarcasm-precondition-claim-bearing-mood
    - sarcasm-determinate-negation-grid
    - negative-register-effect-estimation-grid
    - register-axis-confound-audit
depends_on:
  - sarcasm-precondition-claim-bearing-mood
tags:
  - registers
  - stance-fidelity
  - provenance
---

Two corrections on this arc fixed the same class of error: a count differenced
across something the gate does not control. v3.0.269 found two gates and two
slice folds mixed into one difference; v3.0.270 found a treatment-specific gate
applied to the control. `assertComparable` throws on the first now.

The second has a residue that no gate check reaches. Two stances can agree on
gate, gate version and fold and still have been asked for different things:

- The four sharp stances each mandate their own moves — sarcasm a concrete next
  move, irony a learner-owned unmasking plus an answerable test, face threat a
  minimal repair path — and the six mild ones mandate none. So a difference
  between two fidelity counts is a difference between two demands, not one
  demand met to different degrees.
- `charismatic` names no rubric of its own. It falls back to
  `config/evaluation-rubric-charisma.yaml` while the sharp stances are scored by
  `config/rubrics/registers/irony-sarcasm.yaml`. A charismatic score beside a
  sarcastic score is two instruments in one column, with no shared scale.

Neither is a defect in any run, and neither is fixable by making the contracts
alike — the moves *are* the stances. The defect was that nothing said so.

`services/stancePayloadComparability.js` reads both facts off the register
registry and renders them as a table. Wired into the 45-row effect grid report,
its markdown renderer, and the sarcasm gate decomposition. Unlike
`assertComparable` it **reports rather than throws**: differing payloads are
legal, and the decomposition legitimately differences 197 against 202. The one
error case is a stance the registry cannot resolve, which goes into `errors` so
the report fails closed — a mistyped arm would otherwise drop out unnoticed.

One duplicated fact removed with it. `scripts/evaluate-register-rubric.js`
carried its own copy of the charismatic fallback, which is exactly how a report
ends up naming a rubric the judge never opened; it now resolves through the
shared function, pinned by a source-level guard test.

Ten tests in `tests/stancePayloadComparability.test.js`, including the pair that
was published wrong (the named target claim shows as required of
`sarcastic_determinate` alone, with the instrument reported comparable — same
rubric, so the payload was the only problem) and an integration test that an
unresolvable arm fails `summarizeNegativeRegisterEffects` closed.

No run, no re-judging, no rows rewritten, and no published figure moves. Paper
v3.0.271 adds one §6.7 paragraph stating both asymmetries.
