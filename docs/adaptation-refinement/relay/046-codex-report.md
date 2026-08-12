# 046 — Codex report: direction 045 stopped zero-call on unavoidable reader-instrument digest drift

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-J`

**Authority:** direction 045 and direction 038's hard-stop policy

## Ruling

**STOPPED before the cap edit, before reader collection preparation, and before
any model call.** No semantic reader saw any case. The support gate and matrix
gate are not scored.

Direction 045 requires both of the following at the repair commit:

1. change `MAXIMUM_READER_RESPONSE_BYTES` from 10,500 to 14,000 in
   `scripts/prepare-adaptive-warrant-semantic-annotations.js`; and
2. re-assert the reader schema digest unchanged at
   `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d`,
   stopping on any drift.

Those requirements conflict in the current committed fingerprint
implementation. `adaptiveWarrantSemanticInstrumentBindings()` includes the
SHA-256 of the complete preparer file as
`source_files.preparation_and_assembly.sha256`, and that value is an input to
`reader_schema_digest`. A zero-call, in-memory projection of exactly the
directed preparer edit produced:

| Binding | Current / required | Projected after cap edit |
|---|---|---|
| Preparer source SHA-256 | `e78d73c151787d11870a32cff0dd0f24e2366fa0e0cc5d3dac73cece6f8be9e6` | `af2a9182e2103e6dfd422e7f1ebab8d2f2df33b908b911f52af7c065b3bb5508` |
| Reader schema digest | `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d` | `7b084d936e7600a5023d133eba6660f18fffa378d9b5aed1d8a3a7b4a881e1c9` |
| Extraction schema digest | `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d` | `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d` |

The projected reader digest is therefore not the required digest. This is not
a change to the provider response schema bytes; it is a change to the frozen
reader-instrument source fingerprint caused by the transport constant living
inside a whole-file fingerprint. Making the digest ignore or normalize the cap
would require an additional fingerprint-definition change not ordered by
direction 045. The driver did not improvise that change.

## A1 — cap raise and defect 15

The cap remains **10,500 bytes**; it was not raised to 14,000. The packet cap
remains **42,000 bytes** and was not touched. No guard or focused suite was run
against a modified preparer because the mandatory unchanged-digest assertion is
already deterministically false for the exact directed edit.

`DEFECT-LEDGER.md` entry 15 remains open at its report-044 stop state. It was
not marked fixed and no fix commit was recorded because no conforming repair
commit exists.

The known real one-case evidence remains **10,930 response-schema bytes** with
schema digest
`f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0`.
It remains blocked by the unchanged 10,500-byte transport cap. No synthetic
over-14,000 guard was committed because the prerequisite cap repair could not
be made without tripping the explicit digest hard stop.

## A2 — reader collection and support gate

No collection manifest or authorization request was created. Consequently no
planned call count was recorded in a collection manifest and no reader was
called. Had the repair gate passed, the directed plan would have been **93
cases × 2 registered readers = 186 planned calls**, at the one-case partition.
That plan was not authorized for dispatch after the digest failure.

Reader results: **N/A — zero calls, zero exposed cases**.

Support-gate arithmetic: **N/A — no independent reader outputs exist**.

No matrix-gate PASS or FAIL is licensed from this report.

## Frozen corpus and drop-and-log disclosure carried forward

The seed-514 freeze remains **93 retained cases / 2 dropped candidates / 3
logged match relationships**. The two dropped cases stay excluded forever.
The three relationships are one refrigerator candidate matched to one excluded
corpus and one jukebox candidate matched to two excluded corpora.

### Full drop log

```json
[
  {
    "sample_id": "case-c4119d73cc8d49ee86d86cf9",
    "fingerprint": "5f1763f3d7c86001df7d62d2012b8df9c7088a43a9e91b314ce4db04057e9f10",
    "matched_corpus_id": "adaptive-warrant-mechanism-live-5ddf1d28",
    "matched_corpus_path": "/private/tmp/adaptive-warrant-mechanism-live-5ddf1d28/annotation-sample.blinded.json",
    "world": "world_028_larkspur_fridge",
    "learner_profile": "low_agency",
    "condition": "instrumented",
    "decision_turn": 1
  },
  {
    "sample_id": "case-d4bcf08b8b956c869c4e7556",
    "fingerprint": "134e8551443cfda8f14902acf44a8ba392345e50db27489901e233cc73320212",
    "matched_corpus_id": "adaptive-warrant-v3-matrix-live-36d2e63f",
    "matched_corpus_path": "/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f/annotation-sample.blinded.json",
    "world": "world_022_foxtrot_jukebox",
    "learner_profile": "low_agency",
    "condition": "instrumented",
    "decision_turn": 1
  },
  {
    "sample_id": "case-d4bcf08b8b956c869c4e7556",
    "fingerprint": "134e8551443cfda8f14902acf44a8ba392345e50db27489901e233cc73320212",
    "matched_corpus_id": "adaptive-warrant-v3-matrix-live-d72931bf-s504",
    "matched_corpus_path": "/private/tmp/adaptive-warrant-v3-matrix-live-d72931bf-s504/annotation-sample.blinded.json",
    "world": "world_022_foxtrot_jukebox",
    "learner_profile": "low_agency",
    "condition": "instrumented",
    "decision_turn": 1
  }
]
```

## Call budget

Every `model_call_budget_reserved` event counts as one attempt under the
report-031 convention.

| Stage | Attempts in direction 045 |
|---|---:|
| Digest projection and stop diagnosis | 0 |
| Cap repair, guards, and focused suites | 0 |
| Reader collection preparation | 0 |
| Semantic readers | 0 |
| **Total added** | **0** |

The running total remains **3,146/8,000 attempts**; **4,854** remain. Seed 515
remains unspent.

## Required coverage quotation

- **Registered checkpoint:** **139/144 analyzed = 96.53% coverage**;
  **5/144 unanalyzed = 3.47%**.
- **Final descriptive:** **187/192 analyzed = 97.40% coverage**;
  **5/192 unanalyzed = 2.60%**.

There was no coverage loss in direction 045. No live run was patched, no failed
gate was waived, no instrument amendment was made, and nothing was pushed.

## Required next authority

The reviewer/human must reconcile the cap repair with the current whole-file
reader-instrument fingerprint. Conforming options require explicit authority,
for example either accepting the mechanically changed reader digest while
showing provider-schema bytes unchanged, or prospectively redefining the
fingerprint so transport constants are not part of the semantic digest. The
driver does not choose between them.
