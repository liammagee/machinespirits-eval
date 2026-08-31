# Guarded main-block case-only quote fixtures

These 12 semantic-event envelopes and learner turns were extracted on
2026-08-31 from the retained run
`guarded-learner-main-block-2026-08-15`, under
`ms-guarded-learner/.tutor-stub-auto-eval/`. The originals were read only.
Every source trace hash was checked against its unchanged `run-seal.json`.
Each fixture records the trace-relative path, one-based model-call line,
trace SHA-256, and SHA-256 of the complete original reader response.

The learner text and semantic-event values are copied without corrections.
The unrelated classification/learner-record fields are omitted.
`public_identifiers_in_reader_prompt` is a deterministic projection: it lists
only identifiers referenced by these events that occur literally in the
original reader prompt. Tests join this list as `publicText`; this preserves
the validator's identifier-membership check without copying whole prompts.

All 12 quoted spans differ from the learner's text only in case and the
already-allowed curly/straight quote punctuation. Eleven attempts have no
remaining validation issue after case matching. Dialogue 28, turn 8, also
cites the non-public identifier `nadia_labelled_archive_box`; that attempt
must remain rejected. Thus the older card/ruling's description of 12 wholly
case-only refused attempts is too broad. The historical ruling is not edited.

These are prospective regression inputs, not replacement readings. No
historical attempt, score, case count, registration, or seal is changed.
