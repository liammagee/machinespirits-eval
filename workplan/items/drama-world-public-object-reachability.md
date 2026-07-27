---
id: drama-world-public-object-reachability
title: Make each drama world's declared public object reachable in its own
  deterministic text
status: triaged
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Every world's deterministic fallback names that world's own public
  object rather than the generic 'public record', unprompted wording is pinned by
  test for all 32 worlds, and the change to the 17 affected worlds is enumerated
  rather than incidental; targeted and hermetic suites pass without model calls.
branch: claude/world-public-objects-reachable
links:
  code:
    - services/tutorStubResponseComposition.js
    - services/tutorStubSceneDiction.js
    - config/drama-derivation/
  tests:
    - tests/tutorStubResponseComposition.test.js
    - tests/tutorStubSceneDiction.test.js
  items:
    - tutor-stub-fallback-register-and-uptake-guard
---

Falls out of PR #293, which stopped `configuredFallbackObject` handing the tutor
a public object the scene does not contain. Closing that leak exposed what the
leak had been covering for: 17 of the 32 authored worlds now say "the public
record" at every host part, because they have no reachable object of their own.

The shape of the gap is not the one #293's own notes describe, and those notes
are wrong on this point. They say 18 of 32 worlds "declare no public object at
all". Every one of the 32 declares a `presentation.ledger_term`. The real
condition is that 18 worlds declare a ledger term their own prose never names —
world-000-smoke declares "succession roll", world-002-lantern declares "inquiry
log", all six hethel variants declare "assize book" — and the fallback reaches a
declared prop only by finding it in text. So the declaration is inert.

    scene names an exhibit noun          -> that noun
    declared prop *appears in the text*  -> the world's full wording
    scene names a record noun            -> that noun
    otherwise                            -> "public record"

Seventeen worlds fall to the last line at all eleven host parts: 000-smoke,
001-nocturne, 002-lantern, 003-bitterwell, 004-withercombe, 006-hethel,
007-fengate, 010-hethel-resistant, 011-hethel-resistant-dogmatic,
012-hethel-complex-resistant, 013-hethel-civic-entrenchment,
014-hethel-patronage-bind, 015-hethel-public-reversal, 017-saintcloud,
018-edmund, 022-foxtrot-jukebox, 023-greyfen-lab.

world-025-tallow-street is the eighteenth world whose ledger term is unnamed in
prose, and it escapes only because #293 added `minute-book` to the record
whitelist and its prose happens to say that. That is an accident, not a design.

Two ways to close it, and they are not equivalent.

The code route: treat `presentation.ledger_term` and
`presentation.public_objects` as sufficient on their own. An author writing
`ledger_term: assize book` has already said what this world's evidence record is
called, and requiring the prose to repeat it is a second gate with no purpose.
`tutorStubDeclaredSceneObject` is the right operation when deciding what a
learner referred to and the wrong one when picking the world's default object;
the two uses want separating.

The content route: name each world's prop in its own opening prose. Costlier,
touches every world file, and it fixes the symptom in the fallback while leaving
the same inert declaration for any future reader of `presentation`.

Lean is the code route, with the content route unused. The care needed is that
this moves frozen deterministic wording in 17 worlds, which is exactly the
property #293 went to some trouble to preserve — so the change wants the same
treatment: enumerate the affected cases up front, pin all 32 worlds' unprompted
wording by test, and let no world move that is not on the list.

Watch the marrick worlds. They are period assay scenes, already reach
"trial-book", and nothing here should touch them; the pinned-costume directive
on marrick still holds.

## Log

- 2026-07-27 — Card opened off the tail of PR #293. Gap measured across all 32
  worlds x 11 host parts with the learner's line blanked: 17 worlds generic at
  every part, 15 worlds reaching a world-specific object at every part, none
  mixed. The all-or-nothing split is itself informative — a world either has a
  reachable object or it does not, so this is a per-world authoring fact rather
  than a per-part accident.
