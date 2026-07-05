---
id: lemma-forced-choice-smoke
title: Forced-choice binding smoke — does the model have a chapter preference when non-answering costs a retry?
status: done
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "6 runs complete; the pre-stated reads (exercise, preference-vs-parrot diagnosis, conduct, capped color) recorded either way."
claim_status: exploratory
links:
  items:
    - lemma-bind-sonnet-smoke
    - proof-lemma-layer
tags:
  - adaptive-tutor
  - derivation
  - lemma-layer
  - binding
  - smoke
---

Operator direction (2026-07-05): the earlier field was an unconstrained
choice with a passive default — non-answering was free. Now FORCED: at
bind scene openings a missing/unmatched active_lemma bounces ONCE with a
pointed demand listing the options; even delegation must be said
("default"). Raw claims (and first-attempt raws on retries) are now
logged — the earlier diagnostic gap closed. Gates 22/22 (mock exercises
tutor, delegate, and bad-choice->retry->fallback paths).

**Design:** Sonnet, marrick, dose 0.08, 3 seed-paired pairs
(baseline vs lemma-bound), fresh primes 229/233/239, concurrency 3.

**Pre-stated read rules:**
1. **Exercise gate:** exercised choices (tutor | tutor_retry | delegate)
   >= 0.8 of multi-frontier openings in bound runs. Fail -> the field is
   ignored even under compulsion (record; the in-turn channel is dead at
   this tier, full stop).
2. **Preference-vs-parrot diagnosis (the point):** among exercised
   choices, does the model ever pick a NON-FIRST frontier chapter or vary
   its pick with the drama (preference), or does it always name the first
   option / always "default" (parrot/delegate)? Raws quoted in the record.
3. **Conduct:** 0 untagged on stage; retries <= 1 per opening; coherent.
4. **Directional color (n=3, §5.12.7 cited):** bound vs paired baseline
   T*/grounded — propose-only under any outcome.

2026-07-05 Claude: COMPLETE (6/6). READ 1 — EXERCISE: PASS 16/16 (1.00).
Zero volunteered (every choice arrived via the retry — 100% bounce rate),
100% compliance once demanded, all raws clean predicate names, zero
"default" delegations. READ 2 — PREFERENCE CONFIRMED, not parrot: in r3,
decay regressed BOTH alpha lemmas at t13; frontier became {blankFrom,
dieCutWith} with blankFrom frontier-first — the model picked dieCutWith
at t13/t14/t15, three consecutive NON-first picks: under adversity it
chose to press the new chain rather than repair the rotted one.
Elsewhere picks coherently tracked proof progression (blankFrom ->
castBlankFor -> dieCutWith -> cutDieFor). READ 3 — CONDUCT clean (0
departures/blocks/untagged). READ 4 — color (n=3, §5.12.7 capped):
bound 2/3 grounded (22,22,aporia) vs baseline 3/3 (22,22,24); the one
divergent pair is r3, where the model's elicited press-on strategy
coincided with aporia while baseline grounded — the explicit strategy
existed, was extracted, was bound, and was WORSE than the implicit one
(one run; color). LOAD-BEARING DATUM for the impasse discussion: the
strategy is in there and extractable under compulsion — the failure mode
is not absence of preference but (a) never volunteering it and (b) the
explicit plan not beating the implicit one.
