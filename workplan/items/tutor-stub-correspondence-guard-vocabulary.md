---
id: tutor-stub-correspondence-guard-vocabulary
title: "Evidence-correspondence guard can never clear in a plain-language world"
status: triaged
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: "A unit test that takes world-030's own p_dye surface as the
  permitted text and asserts the matching tutor sentence is allowed. It must
  fail on the current code and pass after the fix."
claim_status: methods
tags:
  - tutor-stub
  - guards
  - worlds
---

**What is wrong.** The guard that blocks a tutor from saying two pieces of
public evidence link up (`unsupported_evidence_correspondence`, in
`services/tutorStubEvidenceAssertion.js`) clears a claim only when some
already-public sentence *itself* matches a hardcoded list of linking verbs —
`matches`, `traces … to`, `ties … to`, `corresponds to`, `answers to`,
`identical to`, or `same` followed by one of a fixed noun list (alloy, flaw,
mark, metal, residue, strain, streak). A second hardcoded list
(`EVIDENCE_OBJECT_PATTERN`) restricts which nouns count as evidence at all:
alloys, assays, coins, crucibles, dies, entries, flaws, leavings, logs, marks,
metals, records, residues, samples, shillings, strains, streaks, tools,
traces.

Both lists are drawn from the assay and coining worlds. A world written in
ordinary language releases a clue whose text uses none of them, so nothing
public ever counts as establishing a link, and every correct closing sentence
the tutor composes is blocked for the rest of the dialogue.

**Worked case.** World-030 (Rowan Flat) releases `p_dye` on turn 7. Its public
text reads: *"Blue tracing dye placed at the hose split follows the basin pipe
chase and appears at the leading edge of the kitchen water mark."* Its fact is
literally `[tracedPathTo, basinFeedHose, kitchenCeiling]` — the link is the
premise. The words `follows` and `appears at` are on neither list, so from
turn 7 to the cap the guard blocks sentences like *"The dye traces a path from
the hose split to the ceiling mark."* Changing one word of the clue text to
`traces … to` clears the block, with no other change.

This is not incidental to that world. Its own header says the proof is shallow
and the test is "whether the tutor can inhabit ordinary household language
without importing courtroom or assay diction". The guard requires the assay
diction the world was written to avoid.

World-023 (Greyfen Lab) is unaffected: its clue text says "the same strain",
which is on the list, so claims sharing the token `strain` clear normally. Its
rate of this failure in the endgame is 0 per 100 tutor turns against 91 for
Rowan bare and 59 for Rowan contract.

**Scale.** Small in the run where it was found — 6 blocked turns out of 59
endgame turns in the worst cell — so it does not explain that run's outcome
and no result needs restating. It will bite any future world written in plain
speech, which is a stated design direction for the world set.

**Fix direction (not yet chosen).** Options, cheapest first:

1. Derive the permitted link text from the premise's *fact* rather than its
   prose. `p_dye`'s fact already names the relation `tracedPathTo`; a released
   premise whose fact is a two-place relation between evidence objects should
   licence claims about that relation whatever words its surface uses.
2. Keep the prose check but widen the verb list and drop the closed noun list,
   taking evidence objects from the world's own fact arguments instead.
3. Leave the guard and add the required diction to plain-language worlds —
   rejected on its face, since it undoes what those worlds test.

Option 1 is preferred: it removes the coupling between a guard and a costume.

**Log**

- 2026-08-06 — found while working out why the fallible-learner contrast
  moved in opposite directions on two worlds
  (`tutor-fallible-learner-closure-prereg`). Confirmed by feeding the guard
  world-030's own clue text and watching the correct closing sentence blocked,
  then cleared by a one-word change to the clue. Filed; no fix attempted.
