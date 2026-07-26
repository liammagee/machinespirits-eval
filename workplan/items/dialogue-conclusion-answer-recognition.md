---
id: dialogue-conclusion-answer-recognition
title: 'Dialogues never conclude: the answer matcher cannot see natural English'
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: 'Every orthography of an authored answer constant that appears in the sealed phase-5e traces resolves to assertedSecret, closure fires through tutorStubLearnerDagGrounded, no phantom unsupported assertion is minted from a sentence-shaped claim, and a corpus lint prevents any new world shipping an answer its own prose cannot state.'
claim_status: planned
links:
  notes:
    - DRAMATIC-RECOGNITION-PLAN.md
tags:
  - drama-derivation
  - instrument
  - tutor-stub
milestone: adaptive-tutor-evidence-v1
branch: claude/dialogue-conclusion-recognition
---

All 16 sealed dialogues in the Program-2 phase-5e pilot ran to the 40-turn
safety cap without formally concluding. 15 of 16 had complete evidence and
entailed the correct answer, most by around turn 10, and learners said so in
plain words — "Piper's Gullet ... is the case's answer" — while tutors replied
"the case stands fully proved". Every one nevertheless recorded
`assertedSecret: false`.

Root cause, single and mechanical. `services/tutorStubPublicLearnerAnalysis.js`
normalised the authored constant `pipersGullet` to "pipers gullet" but treated
an apostrophe as a word boundary, so "Piper's Gullet" became "piper s gullet"
and never matched. Across the 18 sealed dialogues there were 0 matchable answer
mentions against 191 apostrophe-blocked ones — in world-026 the answer was
literally unstatable. The learner's most common phrasing, "Piper's Gullet's
bolted shutter causes the cold loaves", carries a double genitive, so eliding
apostrophes alone still leaves "pipers gullets" against "pipers gullet".

The failure is silent in the worst way. Closure hangs entirely off
`assertedSecret`: it gates `tutorStubLearnerDagGrounded`, which gates
`strictGrounded`, which is the only thing that makes the closure frame
`mandatory`. Without it the tutor has no terminal instruction and repeats
"carry this forward" to the cap. And `assertedSecret: false` reads identically
whether the learner never concluded or we failed to see that they did — so an
instrument failure is indistinguishable from a learner failure in every
artifact the run produces.

Second harm, same cause. When nothing matched, the postprocessor minted a
constant from whatever string it had. A correct answer therefore logged twice
as a failure: once as a missing assertion, once as an *unsupported* assertion.
Minting from sentence-shaped claims ("The loaves cool after launch, not in
Tibbin's baking") fabricated facts no rule could support, which is how p5e-04
reached a `premature_assertion` verdict that may not be a real one.

Fix. New `services/dramaticDerivation/answerSurface.js` owns the text-to-
constant bridge: apostrophes elided before tokenising, diacritics folded,
camelCase split, trailing inflectional `s` folded off both sides (which is what
makes the genitive tractable — `pipersGullet` keeps the possessive s on one
word and drops it on the other), small number words folded onto digits, and
whole-word sequence matching so a name is not found inside a longer word.
Minting is restricted to name-shaped phrases; an unresolvable claim is recorded
as an explicit rejection instead of a fabricated fact.

Corpus lint. `services/__tests__/dramaWorldAnswerReachability.test.js` asserts
every world's answer constant is recoverable from that world's own
`secret.surface`. The invariant: if the matcher cannot find the answer in the
world's own description of the answer, no learner will ever state it. 30 of 32
worlds pass; world-021 and world-030 are listed as known-unreachable authoring
defects (each interposes a word inside the name) and need an author decision,
not a normaliser change.

Remaining. Re-score the 18 sealed phase-5e traces with the fixed matcher to
count how many would have concluded — the traces are not on disk in any
reachable worktree, so this needs whoever ran the pilot. Until that is done the
phase-5e committee-vs-control closure comparison stays uninterpretable, since
both arms carry the same defect.
