# 042 — Codex report: drop-and-log amendment committed; seed-514 re-freeze stops on 93/95 provenance mismatch

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-H`

**Authority:** direction 041, the human's direct ruling “drop the three
duplicate cases and proceed,” and direction 038's continuation policy

## Ruling

**STOP before reader packet preparation. No semantic reader was called and no
support gate or matrix gate was scored.**

The prospective, content-blind drop-and-log amendment is implemented and
committed. At freeze time, candidate fingerprints are compared with every
registered excluded corpus; matching candidates are removed from the blinded
corpus, private key, and private semantic predictions, while every
candidate-to-excluded-corpus match is disclosed in
`dropped_overlap_cases`. Non-overlap schema, catalogue, provenance, size, and
freeze checks remain fail-closed.

The quarantined seed-514 input contains 95 candidate cases. The amended reducer
found the expected **three match relationships**, but they identify only **two
distinct candidate cases**:

- one Larkspur-fridge candidate matches one earlier corpus;
- one Foxtrot-jukebox candidate matches two earlier corpora.

Content-blind removal therefore yields **93 retained cases, not the directed
92**. Deleting a third case would require selecting a non-overlapping candidate
or deleting the same Foxtrot candidate twice, neither of which is a coherent
case-level freeze operation. Direction 041 says any drop count or identity set
other than 92 frozen / three dropped is a provenance stop. The reader packet
was therefore not prepared or exposed.

The reducer wrote the 93-case corpus, 93-case private key, and 93-entry private
prediction map, then withheld the freeze manifest when a later legacy coverage
check rejected full-horizon fallback parity. That secondary deterministic
checker incompatibility was not repaired because the earlier 93/95 drop-set
boundary had already required this stop.

## A1 — prospective amendment and guards

The amendment landed in two zero-call commits:

- `31ad8ec909d2ef3914ca228c808cdff5b3036588` — drop and log overlaps in the
  freeze, filter all three packet-side artifacts, and add the four directed
  guards;
- `177881d610d591e29597e33b7e357d8cdf514aa2` — preserve the registered
  no-`cases` diagnostic exclusion bindings while still rejecting a present
  malformed `cases` field; recorded as defect-ledger entry 13.

The zero-call chain passed **70/70** across
`adaptiveWarrantBaselineStudy.test.js`,
`adaptiveWarrantAnnotationCollection.test.js`, and
`adaptiveWarrantSemanticAnnotation.test.js`. Focused ESLint and
`git diff --check` also passed. The guards prove:

1. one planted overlap freezes N−1 cases and logs the matched corpus id;
2. zero overlap freezes unchanged with an explicit empty drop log;
3. the dropped sample id and fingerprint occur in neither the blinded corpus
   nor generated reader packets;
4. a malformed exclusion `cases` schema fails before a freeze manifest is
   written.

The first A2 attempt also exposed defect 13 at zero cost: diagnostic-probe
exclusion bindings intentionally have no top-level `cases` field. The repair
restored the pre-amendment treatment of those bindings and added a guard while
retaining fail-closed behavior for malformed present fields.

## A2 — exact seed-514 drop audit

Input:

`/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/quarantine-r39-repaired-reducer-overlap/`

The quarantined corpus remained unchanged at 95 cases. Before the successful
filter attempt, the live-root corpus digest was verified byte-identical to the
quarantined input digest.

Arithmetic:

- candidate cases: **95**;
- excluded-corpus match relationships: **3**;
- distinct matched fingerprints: **2**;
- distinct matched candidate sample ids: **2**;
- retained cases after content-blind removal: **95 − 2 = 93**;
- directed expectation: **95 − 3 = 92**;
- result: **STOP — expectation not met**.

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

The two Foxtrot rows are two excluded-corpus matches for the same candidate;
their `sample_id`, fingerprint, world, profile, condition, and turn are
byte-identical.

## Reader-schema identity

The reader schema was recomputed directly from the current committed source
bindings at `177881d6`, without running the preflight or making a model call:

`51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d`

This is byte-identical to the registered `51107d43…` digest. The extraction
schema also remains
`e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`.

## A3 — readers, support gate, and call budget

Not launched because A2 failed its explicit drop-set condition.

| Stage | Attempts this direction | Result |
|---|---:|---|
| A1 amendment and tests | 0 | committed, zero-call chain green |
| A2 re-freeze | 0 | stopped at 93 retained cases |
| Semantic readers | 0 | not prepared or launched |
| **Total added** | **0** | no `model_call_budget_reserved` event |

The unattended running total remains **3,146/8,000 attempts**. Remaining
ceiling: **4,854**. Reader results are **N/A**; support-gate arithmetic is
**N/A**; no matrix-gate PASS/FAIL is licensed from this report.

## Required coverage quotation

These are unchanged execution-coverage facts from the clean seed-514 matrix;
they are quoted for the reviewer's ruling input but were not used to override
the A2 stop:

- **Registered checkpoint:** **139/144 analyzed = 96.53% coverage**;
  **5/144 unanalyzed = 3.47%**.
- **Final descriptive:** **187/192 analyzed = 97.40% coverage**;
  **5/192 unanalyzed = 2.60%**.

There was no coverage halt. The present stop is the discrepancy between three
match relationships and two distinct droppable candidates.

## Artifact digests

### Immutable quarantined 95-case input

| Artifact | SHA-256 |
|---|---|
| Blinded candidate corpus | `7a9c1c4f502d195f40475e9dedc7372db920f8a0169e760d4d4d162b3e423422` |
| Candidate private key | `7c110bfda2170fe0e48c9cf9064a022ea03884b44976eaf7e34dfcb31070379b` |
| Candidate semantic predictions | `681a1d3e363018d0316cc65e9f6381f144e22002ce85aba899684f55d0f00319` |

### Fail-closed 93-case reducer output; no freeze manifest

| Artifact | SHA-256 |
|---|---|
| Retained blinded corpus | `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184` |
| Retained private key | `5c54de8f54b5ef25331cdf053140de9ce4d55a915ec9915c152320ee86f0a883` |
| Retained semantic predictions | `3654a89b1099455327d595d644931904b57be326fccab1e0ab69c1eefae69758` |
| Final refreeze stdout/stderr | `5ff814340314af08c93605d00e2b832a75b7d4adcb904ad0e34a2edae067ecfd` |

The aborted first attempt's two reducer outputs were moved, recoverably, to
`quarantine-r41-incomplete-refreeze-attempt/` before the exact retry. The
original r39 quarantine was not modified. Seed 515 remains unspent. Nothing
was pushed.

## Required next authority

The reviewer/human must reconcile whether direction 041 intended three
**match relationships** or three **distinct candidate cases**. The current
content-blind rule can validly license a 93-case packet by dropping the two
distinct candidates, but it cannot produce 92 cases from this corpus without a
new selection rule or a newly identified third candidate. No reader call,
support score, matrix-gate ruling, seed 515 action, or outcome-study action is
authorized meanwhile.
