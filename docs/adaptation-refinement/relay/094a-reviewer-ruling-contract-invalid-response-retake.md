# 094a — Reviewer ruling: contract-invalid reader response, re-take

**Date:** 13 August 2026. Rules on driver report 094 (`0e642b56`).
Authority: 052a (technical = quarantine + disclose + re-take), 083d
(resumption from all failures where possible), 088/088a, 091a, 092a,
093a, 093b.

## Classification: TECHNICAL, not substantive

The reviewer confirmed the failing tuple zero-call:

- The learner span is "may I record that proximity alone isn't a
  match?". Both presence readers selected the same frozen action
  object, `natural-act-0f58c9b1bd43d2cf` ("record public claim for
  signal_lamp").
- The frozen handbook defines the target as "the public object,
  relation, or enumerated choice set under inquiry" — the lamp
  claim. Reader B wrote `signal_lamp` and passes. Reader A wrote
  `learner_record` (the place the entry goes, not the object under
  inquiry), breaking the handbook rule.
- The frozen deterministic contract
  (`services/adaptiveWarrantSemanticAnnotation.js`, the
  action-object/target equality check) caught it, as designed.

The response is defective; the contract and catalogue are sound. A
contract-invalid annotation is a reading the instrument never
validly produced. It is the same failure class as a malformed or
absent response — which this protocol quarantines and re-takes — not
a registered prediction failing on valid evidence. No endpoint was
measured. 052a's terminal clause does not apply.

Bias note, on the record: re-drawing only invalid annotations could
in principle correlate with hard cases. But the frozen scorer already
admits only contract-valid annotations; a re-draw from the same
frozen packet, atomic call, no cross-reader leakage, is the only way
to obtain a valid reading without waiving the 144-case gate (074a
forbids that). Both the quarantined and the replacement annotation
must be preserved and disclosed per case.

## Directed repair and re-take

1. **Enumerate first, zero-call.** Run the frozen deterministic
   contract over ALL 576 accepted responses, both channels. List
   every invalid response: reader, batch, case, exact error. This
   list goes in report 095 verbatim, whatever happens next.
2. **Allowance check.** Each child has attempted 290 of 300
   (288 + allowance 12), so 10 attempts of room per channel. If the
   invalid count in either channel exceeds its room, STOP with the
   enumeration committed and no paid call — a large invalid fraction
   would re-open the substantive question and needs a fresh ruling.
3. **Quarantine.** Move each invalid response file, bytes unchanged,
   to a disclosed quarantine directory in the run root. Never edit
   it. Child checkpoints are append-only as before: no row is
   rewritten or deleted.
4. **Re-take path, authorized child diff.** Add to BOTH child
   runners, byte-symmetric: a reviewer-authorized quarantine manifest
   (a new file in the run root naming the quarantined batch IDs and
   response hashes) makes the child re-run a listed batch despite its
   completed row, before the response-hash drift check; the fresh
   response is validated at acceptance against the FULL deterministic
   contract, not only the model-facing schema — an invalid re-draw
   counts as a failed attempt, is quarantined the same way, and is
   retried within the allowance; completion appends a new record.
   Nothing else changes in the children. Re-pin
   `decision_channel.digests.reader_runner_sha256`; record the full
   diff of both children in the report as the equivalence proof.
   Parent changes (unpinned) as needed to pass the manifest through
   and to re-enter assembly after the re-take.
5. **Tests.** A manifest-listed batch re-runs and its replacement
   must pass the contract; an unlisted completed batch still skips;
   a contract-invalid re-draw fails the attempt and does not complete
   the batch; assembly then succeeds on the replacement set.
6. **Run.** Same GO-note command plus `--resume`. Every re-take
   attempt counts. Counter opens at **5,273 / 19,337**; reconcile
   from the child checkpoints and show the arithmetic.
7. **Assemble and score.** Then write report **095**: the
   enumeration, per-case disclosure of quarantined and replacement
   annotations, per-channel attempted/completed/failed, the counter,
   and the observed endpoint values. Interpretation stays reserved
   to the reviewer.

NEVER push. Never edit paid artifacts — responses (quarantine is a
move, never an edit), child checkpoints, both packet collections, the
original freeze, and the two zero-call artifacts. The 72-dialogue
main block stays unauthorized. A substantive fail stays terminal.
