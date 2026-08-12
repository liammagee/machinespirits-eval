# 053 — Codex report: presence-grain confirmation gate passes

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-M`

**Authority:** direction 052 and the registration at
`docs/adaptation-refinement/v3-semantic-reader-presence-gate-registration.md`

## Ruling

**The one registered presence-grain confirmation attempt PASSED every floor.**
Both fresh readers completed 93/93 one-case calls with zero failures. The A1
scorer read presence and the ambiguity flag straight from the validated
response files; it did not run the assembly materializer. No r47 or r49
response was admitted or pooled. The result licenses presence-level semantics
only; it does not rehabilitate the previously failed fine-grain encoding.

## Registration and pilot disclosure

The authoritative registration is
`docs/adaptation-refinement/v3-semantic-reader-presence-gate-registration.md`.
The r49 responses were used only as a design pilot to set the six floors. The
floors were fixed and committed before any confirmation call. The r49 responses
were never scored as confirmation evidence and were never pooled with r52.

Registration §4 was amended prospectively, before the scorer was written and
before any confirmation call, to pin two distinct reported-not-gating
target-object-set extractions. The event-target-slot extraction excludes
non-catalog targets; the catalogue-binding extraction follows catalog-state
action IDs to registered target IDs, excludes null targets, and emits
`__UNKNOWN_ACTION__` for unknown IDs. This corrected the preliminary unpinned
pilot figures from **63/93 to 75/93** and **75/93 to 76/93**, respectively.

## A1 — zero-call scorer, guards, and preflight

A1 was committed before collection at
`ed19be428abdaa07055ccaa8f957d22cb8f86920`. The scorer is
`scripts/score-semantic-reader-presence-gate.js`; its directed guard suite is
`tests/semanticReaderPresenceGate.test.js`.

All seven directed guards passed: agreement on flags and both presences;
non-consensus on either presence disagreement; missing and schema-invalid
responses fail closed without crashing; catalogue-binding failures remain
presence-scoreable; 71/93 fails while 72/93 passes with other floors met; and a
fixture whose two pinned object-set extractions differ reports different sets.
The focused scorer suite passed **7/7**; the wider focused semantic suites passed
**32/32**; focused ESLint and `git diff --check` passed.

The source-bound semantic brittleness preflight passed **42/42**, verdict
`instrument_ready`, at A1 commit `ed19be42`; the transport-only schema result
was carried forward with zero new calls and validated against that commit. The
presence-gate digest preflight then matched all seven registered identities and
both caps:

| Registered identity | Confirmation preflight |
|---|---|
| Corpus | `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184` |
| Extraction schema | `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d` |
| Provider response schema | `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1` |
| One-case response schema | `f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0`; 10,930 bytes |
| One-case packet | `237c0784f637cb74ea124a5ec2c00912e3bc39eddf6359573c276fa823c3e06b` |
| Preparer source | `9b545f368da469d0271613751d6da6f11bb4ae1fc57fa63d39a66733ce83177c` |
| Reader digest | `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f` |
| Response / packet caps | 14,000 / 42,000 bytes |

As a post-run zero-call audit of the reported-only definitions, the A1 scorer
reproduced every registered r49 pilot value exactly: the six floor values,
strict identity 24/93, event-target-slot set agreement 75/93, and
catalogue-binding set agreement 76/93.

## A2 — fresh confirmation collection and gate result

The confirmation collection was prepared from the unchanged frozen 93-case
corpus at the one-case partition and bound to A1 commit `ed19be42`. Before any
call, its manifest recorded exactly **93 cases × 2 readers = 186 planned calls**
and a maximum of 186 calls.

| Collection fact | Value |
|---|---:|
| Readers | 2 |
| Cases per reader | 93 |
| Batch size | 1 |
| Planned / maximum calls recorded before launch | 186 / 186 |
| Calls reserved / completed | 186 / 186 |
| Reader failures | 0 |
| Inadmissible response files | 0 |
| Largest packet | 37,977 / 42,000 bytes |
| Response cap | 14,000 bytes |

Every completed batch reports the registered `codex` / `gpt-5.6-luna` identity,
the exact `explicit_cli_model_argument_accepted_bridge_echo` attestation basis,
and zero prohibited tool events.

### Registered floor table

| Gate check | Floor | Pilot r49, design only | Confirmation r52 | Result |
|---|---:|---:|---:|---:|
| Result-request presence agreement | ≥ 0.80 | 85/93 = 0.914 | **86/93 = 0.925** | PASS |
| Proposed-test presence agreement | ≥ 0.80 | 91/93 = 0.978 | **89/93 = 0.957** | PASS |
| Ambiguity-flag agreement | ≥ 0.90 | 93/93 = 1.000 | **93/93 = 1.000** | PASS |
| Presence-grain consensus cases | ≥ 72/93 | 83/93 = 0.892 | **83/93 = 0.892** | PASS |
| Consensus non-ambiguous result-request cases | ≥ 4 | 18 | **17** | PASS |
| Consensus non-ambiguous proposed-test cases | ≥ 4 | 8 | **7** | PASS |

The scorer's overall verdict is **PASS**. No floor moved, no failed gate was
waived, and no second attempt occurred.

### Reported, not gating

| Metric | Confirmation r52 |
|---|---:|
| Strict canonical event identity | 26/93 = 0.280 |
| Strict diff profile — target differences | 61 cases |
| Strict diff profile — action differences | 35 cases |
| Strict diff profile — speech-act differences | 36 cases |
| Strict diff profile — event-count differences | 15 cases |
| **Event-target-slot set agreement** | **70/93 = 0.753** |
| **Catalogue-binding set agreement** | **79/93 = 0.849** |
| Catalogue-binding failures — reader A | 3 cases / 3 events |
| Catalogue-binding failures — reader B | 2 cases / 2 events |

These figures carry no floor. In particular, the fine-grain failure remains a
failure; the confirmation establishes convergence only at the registered
presence grain.

## Frozen corpus and drop-and-log disclosure carried forward

The seed-514 freeze remains **93 retained cases / 2 dropped candidates / 3
logged match relationships**. The two dropped cases stay excluded forever. The
refrigerator candidate matches one excluded corpus; the jukebox candidate
matches two excluded corpora.

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

## Budget

Every reserved attempt counts under the report-031 convention.

| Stage | Attempts |
|---|---:|
| Starting total | 3,337 |
| A1 scorer, guards, preflight, collection preparation, and scoring | 0 |
| Fresh semantic reader A | 93 |
| Fresh semantic reader B | 93 |
| **Confirmation added** | **186** |
| **Planned and actual end state** | **3,523/8,000** |

The run fit under the original directly authorized 8,000-call ceiling with
4,477 attempts to spare; the later renewed ceiling was not needed. Seed 515
remains unspent.

## Required coverage quotation

- **Registered checkpoint:** **139/144 analyzed = 96.53% coverage**;
  **5/144 unanalyzed = 3.47%**.
- **Final descriptive:** **187/192 analyzed = 97.40% coverage**;
  **5/192 unanalyzed = 2.60%**.

There was no new matrix coverage loss. No live run was patched, no prior
response was imported, no dropped case was restored, and nothing was pushed.

## Provenance

- A1/source run commit: `ed19be428abdaa07055ccaa8f957d22cb8f86920`.
- Collection manifest:
  `/private/tmp/adaptive-warrant-r52-presence-confirmation-collection/semantic-annotation-collection-manifest.json`;
  SHA-256 `68bb7959b800d0f4e9a44033588b776a0bbdc3683b7dfd01c761c2068539a370`.
- Authorization request SHA-256:
  `4affc06b62291cfe0613bc4043e3fd2f00be5cc5d4f2f9e1da3acd7097352a6e`.
- Reader run:
  `/private/tmp/adaptive-warrant-r52-presence-confirmation-readers/semantic-reader-run.json`;
  SHA-256 `1db1aad4c3d85ecdc952b39016275636a9f853686dd23fbdbbe18cb1d2b91696`.
- Presence-gate score:
  `/private/tmp/adaptive-warrant-r52-presence-confirmation-readers/presence-gate-score.json`;
  SHA-256 `c299a38208125e164bc4fb383ed09eeeccfdd40e84213f2e00eb3c57d0c45d50`.

Per direction 052, the reviewer rules on this PASS from report 053.
