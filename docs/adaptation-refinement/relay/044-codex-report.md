# 044 — Codex report: 93-case freeze completed; semantic readers stop pre-exposure on an impossible frozen response-schema cap

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-I`

**Authority:** direction 043, the human's drop-and-log ruling, and direction
038's continuation and hard-stop policy

## Ruling

**A1 and A2 are complete. A3 STOPPED before reader authorization or any model
call. No semantic reader saw any case. The support gate and matrix gate are not
scored.**

The 95-case quarantined seed-514 input refroze successfully to **93 retained
cases / 2 dropped candidates / 3 logged match relationships**, identity-exact
to report 042. The freeze manifest is written and its adjusted coverage is
exact at 93/93.

Reader preparation then failed closed on a new deterministic transport defect.
The full representative semantic catalogue makes the response schema too large
even at the minimum legal one-case batch: **10,930 bytes against the frozen
10,500-byte cap**. Increasing the cap, changing catalogue projection, or
changing the preparer would alter the frozen reader instrument and its mandated
`51107d43…` digest. Directions 038 and 043 reserve that instrument amendment to
the human and require a stop on any reader-schema drift. `DEFECT-LEDGER.md`
records this as defect 15.

## A1 — defect 14 repair

Commit `a925fb7aa152b04f90eedb28f11aac05b84b5924` repairs both stale exactness
assumptions:

- dialogue parity retains the full eight-turn denominator when a registered
  analysis-error turn emits its deterministic fallback decision;
- frozen annotation coverage is evaluated as the registered analyzable design
  minus exactly the unique sample ids disclosed in `dropped_overlap_cases`.

Any unlogged missing decision still fails before a manifest is written. The
three directed guards passed on the real manifest-writing path, and the focused
suite passed **70/70** across
`adaptiveWarrantBaselineStudy.test.js`,
`adaptiveWarrantAnnotationCollection.test.js`, and
`adaptiveWarrantSemanticAnnotation.test.js`. Focused ESLint and
`git diff --check` also passed. All were zero-call.

## A2 — amended seed-514 freeze

Immutable input:

`/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/quarantine-r39-repaired-reducer-overlap/`

The three input digests remained byte-identical to report 042:

| Input artifact | SHA-256 |
|---|---|
| 95-case blinded corpus | `7a9c1c4f502d195f40475e9dedc7372db920f8a0169e760d4d4d162b3e423422` |
| 95-case private key | `7c110bfda2170fe0e48c9cf9064a022ea03884b44976eaf7e34dfcb31070379b` |
| 95-case private predictions | `681a1d3e363018d0316cc65e9f6381f144e22002ce85aba899684f55d0f00319` |

Final frozen artifacts:

| Artifact | SHA-256 |
|---|---|
| 93-case blinded corpus | `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184` |
| 93-case private key | `5c54de8f54b5ef25331cdf053140de9ce4d55a915ec9915c152320ee86f0a883` |
| 93-case private predictions | `3654a89b1099455327d595d644931904b57be326fccab1e0ab69c1eefae69758` |
| Freeze manifest | `668511bb2600e0c7998cf50b5ac5ea591b5ce7d81e080ab6f2b60820b8106813` |
| Study results JSON | `6a33e732b915d82e0ae6719af03c827157d7a8d03a2d7f34f0156d12b66d1915` |
| Study results Markdown | `548176284180a2d55bf617bb5a0a46abb0843e134ebd2ae477f3b868bb086afd` |
| Annotation handbook | `5673c14b8f2a2b17c599e947c87f6d03c10df6dcdbeadcb257d882f008902003` |
| Semantic handbook | `0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b` |
| Rebound study plan | `be7f40bd7cf1873d8e3675c0fffe0f4f132fc0cb4986f1653911442323c2fa5a` |

The repair-commit preflight passed **42/42**, verdict `instrument_ready`, at
`58ed1283c3c5dc580a0166e8fb94b20f6be13d79a770d5c976bf988aa4e34c90`.
The zero-call provider-schema carryover is
`f66ac3ef426179afefd193c4cf4dc4ed8922b01d46d775778f90fccb2f51b682`;
the provider response schema stayed byte-identical at
`44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`.
The required instrument digests did not drift:

- reader schema:
  `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d`;
- extraction schema:
  `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`.

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

This is the disclosed drop-and-log amendment: the refrigerator row is one
candidate-to-corpus match; the two jukebox rows are two corpus matches for the
same candidate. Both sample ids and fingerprints are absent from every retained
packet-side artifact.

## A3 — pre-exposure reader stop

No collection manifest or authorization request was written. Preparation
failed before the reader runner and before any `model_call_budget_reserved`
event:

| Legal batch size | Packet bytes | Packet cap | Response-schema bytes | Response-schema cap | Result |
|---:|---:|---:|---:|---:|---|
| 8 | 58,837 | 42,000 | 11,546 | 10,500 | packet fail |
| 4 | 47,398 | 42,000 | 11,194 | 10,500 | packet fail |
| 1 | 32,369 | 42,000 | 10,930 | 10,500 | schema fail |

The one-case partition is the minimum legal partition, so no permitted batch
size satisfies both frozen caps. The preserved one-case evidence digests are:

- packet: `237c0784f637cb74ea124a5ec2c00912e3bc39eddf6359573c276fa823c3e06b`;
- response schema:
  `f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0`.

Reader results: **N/A — zero calls, zero exposed cases**. Support-gate
arithmetic: **N/A — no independent reader outputs exist**. No matrix-gate
PASS/FAIL is licensed from this report.

## Call budget

| Stage | Attempts in direction 043 |
|---|---:|
| A1 repair, guards, and focused suites | 0 |
| A2 freeze, preflight, and schema carryover | 0 |
| Reader preparation trials | 0 |
| Semantic readers | 0 |
| **Total added** | **0** |

The running total remains **3,146/8,000 attempts**; **4,854** remain. Seed 515
remains unspent.

## Required coverage quotation

- **Registered checkpoint:** **139/144 analyzed = 96.53% coverage**;
  **5/144 unanalyzed = 3.47%**.
- **Final descriptive:** **187/192 analyzed = 97.40% coverage**;
  **5/192 unanalyzed = 2.60%**.

There was no matrix coverage halt. This stop is solely the reader preparer's
representative-catalogue size-closure defect. No live run was patched, no failed
gate was waived, no instrument or schema was changed, and nothing was pushed.

## Required next authority

The human/reviewer must prospectively authorize a reader-transport repair. The
smallest mechanical option is raising the 10,500-byte response-schema cap above
10,930 bytes, with a representative maximum-catalogue preflight guard; catalogue
projection or schema compression are broader alternatives. Every option changes
the currently frozen reader-instrument fingerprint, so the driver cannot select
one under direction 043.
