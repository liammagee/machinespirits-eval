# Poetics evidence lifecycle

`services/poeticsEvidenceLifecycle.js` is the single classification and
closeout authority for claim-bearing Poetics evidence. It inventories all six
sidecar tables, every referenced raw-artifact kind, the item-gate stream,
semantic inputs, reports, loop summaries, and both Poetics runners. The same
inventory explicitly exempts SQLite transport state, operator console output,
and generated workplan views.

The prospective semantic-v5 family is not projected into a new or reconstructed
table. Its four tri-state measurements and semantic-adjudication provenance are
preserved exactly where the merged scorer writes them:
`poetics_tutor_adaptations.metadata.peripeteia` and
`metadata.semantic_adjudication_provenance`. Historical v4 absence remains
absence; the lifecycle never manufactures rows or reinterprets compatibility
booleans.

## Closeout contract

At each non-dry adaptation-loop terminal write, the runner creates one bundle
under the stable private archive's `artifacts/poetics-runs/` directory. The
destination comes from `--evidence-archive`, `EVAL_ARCHIVE_DIR`, or the existing
private-archive resolver. Mock fixtures use a private directory beside their
temporary report.

Each bundle contains:

- complete run-scoped JSONL exports of every inventoried table;
- every database-referenced spec, key, sample, transcript, critic file, label,
  and tutor trace;
- the raw batch trees, including partial outputs;
- the target spec and semantic-v5 packet when applicable;
- adaptation reports, sidecar reports, loop JSON/Markdown, and item-gate rows;
- a manifest with per-file SHA-256 hashes and an aggregate inventory hash.

The bundle is staged in a sibling temporary directory, verified, and atomically
renamed into its final create-once destination. Existing destinations are never
updated. A passed closeout fails if a run row, item-gate stream, referenced
artifact, or classified report is missing. Failed or interrupted attempts use
their own attempt-specific bundle name and retain all rows and files that exist,
plus an explicit missing-artifact list. Resume can therefore add genuinely
missing prospective units in a later attempt without replacing or selecting
among earlier outcomes.

Public release remains separate and explicit through
`scripts/publish-poetics-run-archive.js`; automatic closeout writes only to the
private archive. The explicit package/publish commands require `--item-gates`
so a manual archive cannot silently omit that claim-bearing stream.

## Ratchet

`tests/poeticsEvidenceLifecycle.test.js` compares the inventory against the
tables declared by `services/poeticsStore.js`, live `poetics_*` tables, and all
`scripts/run-poetics*.js` runners. A new table or runner fails until it is
classified. Unknown sidecar kinds and missing claim evidence also fail closed.
All lifecycle tests use synthetic local fixtures and make no model or provider
calls.
