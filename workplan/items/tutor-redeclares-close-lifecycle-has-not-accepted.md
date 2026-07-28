---
id: tutor-redeclares-close-lifecycle-has-not-accepted
title: The tutor re-declares a close the closure lifecycle has not accepted
status: active
type: infra
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  A response that declares the case closed while `dialogueClosure.lifecycle.phase`
  is still `open` raises an issue instead of passing unread, with the real
  Riverside turn-5 string pinned as the case and the other 35 showcase turns
  pinned as passing; a live run then shows the regenerated turn is not a second
  closing declaration; a turn taken after the lifecycle has closed is left alone.
links:
  code:
    - services/tutorStubDialogueClosure.js
    - services/tutorStubGuardDisposition.js
    - services/__tests__/tutorStubDialogueClosure.test.js
    - services/tutorStubResponseConfiguration.js
    - services/tutorStubReleasePacing.js
    - services/tutorStubPublicLearnerAnalysis.js
    - scripts/tutor-stub.js
  items:
    - tutor-instrumentation-showcase
    - showcase-turn-cap-untied-to-release-schedule
tags:
  - tutor-stub
  - closure
---

## Problem

In the 2026-07-26 showcase run, `riverside_clinic__instrumented` said "I mark
the case closed: DUP-SWEEP-04 cancelled Noor's appointment" at turn 5. The
closure lifecycle recorded `completedAtTurn: 7`. Turns 6 and 7 restate the same
close a second and third time:

- t5 — "I mark the case closed: DUP-SWEEP-04 cancelled Noor's appointment."
- t6 — "The evidence now gives a decisive answer: the duplicate sweep cancelled the appointment."
- t7 — "That is the supported finding … I close the record here; this inquiry is complete."

The v2.2 judge scored t7 at 17.5, and its stated reason is the redundancy, not
the closing: *"Repeats the same closure already stated in turns 5 and 6."*
Nothing in the stub notices that the composer and the lifecycle disagree, so the
composer keeps producing closes and the lifecycle keeps declining them.

## The two turns are lag, not work

Closure needs `assertedSecret` (via `tutorStubLearnerDagGrounded`), and the
assertion slot is filled from an LLM classifier call in
`services/tutorStubPublicLearnerAnalysis.js`, not from a rule. The three learner
turns that could have filled it are near-identical:

- t5 — "The ledger identifies DUP-SWEEP-04 as the service that cancelled Noor's appointment at 02:03, rather than Mara."
- t6 — "The action ledger shows DUP-SWEEP-04 cancelled Noor's appointment at 02:03; Mara's view did not cause it."
- t7 — "The 02:03 ledger entry under DUP-SWEEP-04 shows the duplicate sweep cancelled Noor's appointment; Mara only viewed the record."

Only the third was accepted. This is not the apostrophe defect
`services/dramaticDerivation/answerSurface.js` fixed — that commit (91b0d8e3)
was already in the run's tree (16dab103). All three turns report what the ledger
shows rather than claiming a conclusion in the first person, so a cautious
classifier is defensible; what is not defensible is the tutor speaking as though
the case were closed while the lifecycle still reads `open`.

## The routing was never wrong

The first version of this card said the fix was to route the turn to
`compress_sayback`. That was aimed at the wrong layer.
`selectTutorStubActionFamily` already carries the branch:

```js
} else if (assessment.finalSecretEntailed === true) {
    actionFamily = 'compress_sayback';
```

Riverside t5 was exactly that state — `finalSecretEntailed` true, `assertedSecret`
false — so `compress_sayback` was already selected. Nothing checked whether the
composer obeyed it.

## What changed

`auditTutorStubDialogueClosureResponse` returned `ok: true` on its first line
whenever closure was not yet earned, without reading the text. The guard could
only ever check *how* a licensed close was written, never *whether* an unlicensed
one was written. Three states were sharing one branch: the guard being off, the
lifecycle having already closed, and closure not yet being earned. Only the last
of those wants a text check.

The audit now splits them. With the guard off it still passes unread. With the
lifecycle closed it passes — a post-closure turn is a different question. With
closure unearned it reads the text and raises `premature_dialogue_close` on an
explicit closure declaration, carrying the matched phrase so the repair loop can
anchor a span on it rather than on the whole response.

Two supporting changes: `buildTutorStubDialogueClosureFrame` now reports
`phase: 'closed'` on a closed lifecycle instead of the misleading `'open'`, which
is what lets the audit tell the two cases apart; and
`detectTutorStubVerdictDeclaration` returns `closureMatch` alongside its existing
booleans.

The check is gated on `explicitClosure`, not on `declared`. `declared` also covers
`finalVerdict` — stating the answer — which fires on ordinary sayback text that
names the answer term near a word like "responsible". That is a different offence,
already owned by the leak and scaffold guards, and folding it in here would put
false fires on the very `compress_sayback` path this protects.

## Evidence

Replaying the patched audit over all four arms of the 2026-07-26 showcase:

| arm | turns | unearned-frame fires |
|---|---:|---|
| campus_faq bare | 10 | none |
| campus_faq instrumented | 10 | none |
| riverside bare | 8 | none |
| riverside instrumented | 7 | t5 (`"case closed"`) |

35 turns pass unread; the one premature close fires. Riverside t7 also fires
under a hypothetical unearned frame, but in the run its frame was `earned` —
`strictGrounded` had become true — and under that frame it passes. The
legitimate close is untouched.

Tests: four cases added to `services/__tests__/tutorStubDialogueClosure.test.js`,
pinning the real t5 string. 1674/1677 across the 167 tutor-stub test files; the
three failures (`tutorStubCodexRemoteBridge`, two `no-model terminal blocks`
cases) reproduce on a clean tree. Lint, prettier and `lint:cycles` clean.

`TUTOR_STUB_GUARD_DISPOSITION_CATALOG_VERSION` went 3 → 4, since a version-3
trace cannot carry the new row and its absence there means nothing.

## Remaining

The guard fires; what a regenerated turn actually looks like is unverified. That
needs a paid run — the deterministic half is done, the behavioural half is not.
Do not claim the redundant-close arc is fixed until a run shows it.

The classifier lag is untouched and was left that way deliberately. Making the
tutor robust to a late accept is the durable fix; tuning the classifier to accept
sooner would only move the boundary.

## A near-miss in the detector

t6 says *"I close the care log beside the 02:03 entry"* and is not detected.
`EXPLICIT_CLOSURE_PATTERN` allows `close the log` but has no room for a modifier
between the article and the noun. So t6 is a near-miss on the regex, not a
conceptual gap — it does declare closure.

Widening it was left alone on purpose: the same pattern drives
`missing_explicit_dialogue_close` on the earned path, so a wider pattern stops
that issue firing on texts it currently flags. Worth its own change with the
earned path re-checked, not a drive-by edit.

## Related

`showcase-turn-cap-untied-to-release-schedule` is why Riverside reaches a
post-evidence stretch at all. It is the weaker of the two, and second: with
campus at 3 turns of slack and riverside at 4, any allowance a validator could
declare separates them by a single turn. This card's fix holds whatever the cap
is.
