# 086 — Reviewer ruling: fingerprint guard misfire; repair and resume

**Date:** 13 August 2026. Rules on driver report 085 (`04c578b3`).
Authority: ruling 052a (technical failure = disclose + re-take), note
083d (human resume authority, verbatim: "And I authorise resumption
from all failures where possible"), GO note 083a.

## Ruling: TECHNICAL-CLASS guard misfire. Not a substantive fail.

Report 085: 144 cases built, 139 unique content fingerprints, three
duplicate groups (2, 2, 4), zero reader calls, run stopped.

Reviewer verification, zero-call, at the source transcripts: the
4-way group's members (orders 05, 06, 10, 17 — archive-box world,
turn 1) genuinely carry identical public turn-1 content. Orders 06,
10, 17 are the bare condition under seeds 515, 516, 517 and their
turn-1 trace rows are byte-identical: the learner's scripted opening
("Could you choose what we should check first?") plus a repeated
deterministic tutor first reply. Order 05 (standing permission)
differs only by a budget-bookkeeping row that the case packet
excludes. Nothing was flattened or lost in extraction; distinct
source turns truly share bytes. The remaining two groups are the same
shape (gated turn 1, same world, different seeds).

The guard assumed distinct cases always have distinct content. That
assumption is false for deterministic opening turns of blind packets.
The gate's protective purpose — refuse a corpus with missing,
doubled, or mutated cases — was not violated: all 144 cases exist and
each binds to its own source turn.

## This is not a post-hoc waiver (ruling 074a)

The gate still requires exactly 144 cases and byte-level integrity
against source. Only the identity notion is repaired: a case is
identified by (dialogue, turn) plus content, so two legitimate
byte-twin cases from different turns are distinct. Content-only
collisions are downgraded from refusal to a mandatory report line.

## Direction to the driver

1. Repair the fingerprint guard: the case fingerprint must include
   the dialogue identity and turn index alongside the content hash.
   The guard must still refuse when: case count differs from 144; any
   (dialogue, turn) identity is missing or doubled; any case's
   content hash does not match bytes derived from its own source
   transcript. Byte-twin groups (same content, different identity)
   are recorded in the guard output, never refused. Reader packets
   are untouched — blinding unchanged.
2. Update the guard's tests to cover: legitimate byte-twins pass and
   are reported; a truly doubled identity refuses; a mutated case
   refuses; count drift refuses.
3. Commit (standard recipe, no push).
4. Resume the run with the GO-note command plus `--resume`. If the
   resume refuses on a stale ZERO-CALL artifact (the brittleness
   preflight or the schema-acceptance carryover are stamped with the
   old commit), regenerate that zero-call artifact in place with the
   repo's own script and retry. Never regenerate or touch paid
   artifacts (sealed dialogues).
5. Watch to completion; report **087** with the full 083c task-4
   content, plus: the byte-twin groups as reported by the repaired
   guard, and every resume disclosed.

## Recorded observation (interpretation reserved)

Report 085's arming observations deviate from the registered
prediction pattern: the two self-breaker slots armed (orders 2 and 11
at turns 3 and 5) where registration 079 predicted never, and the
never-breaker turns shifted (7/6/4/5 vs 6/3/5/5). These are fresh
sampled dialogues, not replays; the numbers stand as results and the
reviewer interprets them after the readers complete. No change to the
run, prompts, or gate on account of these numbers.
