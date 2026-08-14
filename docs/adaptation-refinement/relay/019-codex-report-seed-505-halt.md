# 019 — Codex report: seed-505 semantic-contract coverage halt

**Date:** 12 August 2026
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`
**Boundary:** reserve-seed relaunch halted at the dialogue boundary; representative-matrix gate failed; waiting for reviewer direction

## Freeze and relaunch

The relay-017 transport repair froze at
`a4529e798012b2fb0366fea30fc2a0798b3a69ab`. The detached execution
worktree was clean and resolved to that exact commit. Validation at the freeze
was:

- focused architecture tests green;
- full root suite: 8,505/8,505 passed;
- tutor-core suite: 137/137 passed;
- semantic preflight: 35/35, `instrument_ready`;
- preflight SHA-256:
  `b0bff2446aca40d4dda522a19ce06de0ee8d4e174e1dc272d1d46eede57124cd`.

The provider schema was byte-identical to the schema accepted before seed 504,
so the relay-016 carry-over rule applied without a new model call. The carry-over
artifact SHA-256 is
`001a3944e30a86cebf90c23593d7f38f9d1465e771d4c1679a82370509bb5749`.

The seed-505 dry rehearsal produced authorization digest
`70b075c8cdd675c49a4cd1e7304cbba91185165d87d2a3dc0fe6c41ac626c8dd`.
The dry request SHA-256 is
`d7e3eb3c69e097ae7096d6977ab6d9f87d261faea851460220288f0313af31ba`;
the accepted-authorization SHA-256 is
`383dbe0aa183817befa6c03f17721fcb439e7a91d4ec3b46d01e1958b0aa5adf`.
The live root is
`/private/tmp/adaptive-warrant-v3-matrix-live-a4529e79-s505`.

## Halt result

The reserve run crossed relay 017's predeclared 10% no-signal threshold. The
first completed dialogue had five unanalyzed turns out of eight, including an
unanalyzed first learner-analysis call, so the typed guard closed admission.
Exactly the six already-running dialogues were allowed to finish and seal. No
seventh dialogue was admitted and no child was killed mid-dialogue.

The authoritative final boundary from the six sealed traces is:

- six sealed dialogues and 48 completed learner-analysis calls;
- 44 `learner_analysis_unanalyzed` markers: **44/48 = 91.7%**;
- all 44 failures have code `invalid_semantic_events`;
- 149 completed model calls: 48 learner, 48 learner analysis, 48 tutor, three
  opening, and two tutor-recovery calls;
- `study-plan.json` SHA-256:
  `78fbba9d4b1bd9f0f0327924903be066e31398209f148a24fe247ce3bcfae41e`;
- ordered run-seal-list SHA-256:
  `cd541f880c7ccb8ef2b4a89a48ff414b15fdba193c4e3da747f505b2bc8736d4`.

The partial seed-505 corpus is burned. It must not be scored, pooled, or reused,
and its root must be included in any later explicit exclusion set.

## Zero-call diagnosis

The seed-504 transport defect is repaired. All 48 learner-analysis responses
were parseable JSON in the provider-enforced schema, and no turn failed
`invalid_strict_call_provenance`. The strict provenance check at
`services/tutorStubPublicLearnerAnalysis.js:2378-2405` therefore admitted the
responses to semantic validation. The new failure is in the model-produced
semantic-event fields checked at
`services/adaptiveWarrantSemanticEvents.js:477-505`.

The dominant defect is evidence-span arithmetic. The provider schema asks the
model for `text`, `start`, and `end` at
`services/tutorStubPublicLearnerAnalysis.js:451-455`, and the prompt asks for
JavaScript UTF-16 offsets at line 1473. Across the 48 raw responses there are 83
event spans. Eighty-two span texts occur exactly once in the corresponding
learner turn, but only 20 have correct offsets; 62 uniquely matching texts have
incorrect model-supplied offsets and one text is not literal. For example, the
model copied the full 72-character learner turn exactly but returned
`start: 0, end: 66`. The validator correctly rejected the mismatched slice.

The failure is not offset-only. Of the 44 discarded analyses, non-exclusive
failure classes are:

- 38 contain `evidence_span:not_literal` or `evidence_span:invalid_offsets`;
- 21 contain `target:value_component_sets_forbidden_for_non_request`;
- 10 contain `overlapping_events:non_atomic_span`.

The first class exposes a live-seat non-evaluability boundary: the model is
being asked to perform deterministic character-index arithmetic. The reader
instrument already avoids this for the same reason: the design at
`v3-semantic-extraction-design.md:513-520` asks readers only for literal span
text and derives unique UTF-16 offsets mechanically. Applying that convention
to the live extractor is the narrowest prospective repair for the dominant
failure, but it would change the live semantic-event contract and is not made
in this report. The act-specific target/value and multiplicity failures also
need to be separated into provider-schema representability versus model
capability before another freeze.

## Halt-artifact caveat

The typed guard stopped admission correctly, but the coordinator began building
the partial annotation packet while five children were still sealing. Its
persisted `study-results.json` therefore contains an early three-row,
21/24 snapshot (`87.5%`) rather than the final 44/48 trace count. It then
reported `semantic reader catalog public_identifiers must be non-empty` while
the remaining children completed, and exited 1 after all six seals existed.

Consequently:

- the six sealed child traces and seals are the authoritative coverage evidence;
- `study-results.json` is a typed but stale halt snapshot (SHA-256
  `ce5f3bca0d8e90441845ffd71680403f1a550c5c2b0e5d757701b834857b4134`);
- the generated eight-case `annotation-sample.blinded.json` is incomplete and
  unusable (SHA-256
  `1a49405f3ea421876f8686ea35769aeb6e1def33221ee6cff691ca0106662761`);
- the halt-finalization path needs a zero-call repair so it waits for all
  in-flight seals and does not try to construct a reader packet for a burned
  coverage-halt corpus.

## Boundary

No semantic readers, decision readers, outcome runs, or representative-matrix
relaunches were started. No model calls were made during diagnosis. Under relay
014, this representative-matrix gate failure is a reviewer stop; seed 506 is
not launched without new direction.
