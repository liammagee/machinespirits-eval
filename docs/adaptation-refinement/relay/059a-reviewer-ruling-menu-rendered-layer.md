# 059a — Reviewer ruling: the menu quotes the rendered layer

**Date:** 13 August 2026. On report 059 (commit `11d5c543`) and the
second session's byte review. Zero calls; the HOLD stands.

## What the byte review found

The 35-entry menu is byte-faithful to its stated rule (verdict PASS,
verified programmatically by the second session; source SHA table
equals report 056 exactly). But it enumerates the contract-OBJECT
strings — the fields of the compiled performance contract — while
the live speaking prompt renders a different, COMPACT string set
from the same pinned file.

I checked the chain myself:

1. The live speaking prompt is built in
   `services/tutorStubTutorTurnPreparation.js` (lines 249–293). It
   carries the advisories, ONE compiled first-draft contract, and
   the learner's line. The comment at lines 233–236 says the
   detailed configuration surfaces are kept for audited recovery.
2. The long configuration prompt
   (`tutorStubResponseConfigurationPrompt`) reaches a live session
   only as a cache key (`tutorStubInteractiveLearnerRuntime.js:297`
   feeds `mixedLearnerAnalysisCacheKey`). Its prompt uses are
   offline bench paths.
3. The strings the tutor model reads downstream of a gate decision
   are the compact builders in
   `services/tutorStubFirstDraftContract.js`: the uptake branch
   strings, the compact part cues plus the inline scene-partner
   string, the tactic strings with the support levels, the stance
   cues, and the handoff strings embedding the action cues.

## Ruling

**"Injected" in Amendment 1 §1 means rendered into the live
speaking prompt.** The registration's purpose clause — holding the
words fixed isolates per-turn hint selection and timing — settles
this: a menu of words the tutor never reads cannot hold "the words"
fixed, and it hands the standing-permission tutor different words
from what the gated tutor's prompt carries, in both directions.
This is an interpretation of the amendment's own word by the same
method as ruling 057, not a new design choice. The five-source
scope is unchanged: every compact string lives in the pinned
first-draft contract file. Flagged in STATE for the human's morning
review; the human can override.

Consequences:

1. **Enumerate the compact layer.** Every compact string reachable
   downstream of a gate decision, mechanically from the tables and
   branch literals: all uptake branches, all part cues plus the
   inline scene-partner string, all tactic and support strings, all
   stance cues, all handoff and action branch strings. All stances
   and action families sweep in — "can cause to be injected" covers
   the gate's whole decision space, so no reachability pruning.
2. **Drop what a live prompt never carries.** Amendment 1 §1 ends
   "Nothing else." The contract-object entries that only populate
   offline audit surfaces leave the menu. The report must list each
   removed entry and why, so the change is auditable.
3. **Templates.** Some compact strings interpolate contract values
   (for example the "Write:" sentence with named subject and
   outcome). For these the menu quotes the fixed template text
   byte-for-byte with the placeholders shown as named slots, and
   the prefix sentence says the gate fills those slots from the
   public contract. The drift guard checks the fixed segments
   byte-for-byte. The enumeration rule in the manifest states this
   handling.
4. **Question support.** The driver must trace whether the
   question-support instruction strings render into the live
   speaking prompt verbatim, and state the finding in the report:
   include them if live, drop them with the stated reason if not.
5. Note 058a's two criteria still apply: SHA table frozen at report
   056; enumeration rule in the manifest.

## The stop in report 059

Both check failures reproduce on my machine and are deterministic:
the unused variable `omitted` at
`scripts/prepare-adaptive-warrant-outcome-study.js:448`, and the
help-digest fixture, which moved because the new
`--standing-instructions-file` flag documents itself (old digest
`5aa4abca…`, new `bd0669e5…`). The digest test exists to make help
changes explicit; this ruling makes it explicit. Lease N gets one
zero-call repair pass in direction 060.
