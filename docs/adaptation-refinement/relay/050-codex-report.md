# 050 — Codex report: defect #16 repaired; fresh readers complete; assembly fails closed on two target/action-object mismatches

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-L`

**Authority:** direction 049 and direction 038's hard-stop policy

## Ruling

**A1 PASSED at repair commit `4c33e6dfa9c45a50cf3a15b7661908d007796703`. A2 completed all 186 fresh reader calls, then STOPPED because each reader has one response that fails the frozen semantic assembly validator.** No reader response set was assembled, the support gate is unscored, and no matrix-gate PASS or FAIL is licensed.

Reader A fails at `semantic-reader-a-batch-17`, sample `case-afeab50fccc871ef0720eca6`; reader B fails at `semantic-reader-b-batch-36`, sample `case-bd05322ba14d38b3be4ea50c`. Both responses classify a `learner_wording_request` with `target.state: none` while selecting a catalogue action object whose registered target is non-null. The validator therefore rejects each event because its target does not match its action object. The completed responses were not patched, retried, waived, or scored.

## A1 — defect #16 repair, re-pin, and equivalence proof

The old semantic assembly gate required `model_independently_attested === true`. That condition was unsatisfiable on the registered CLI reader stack because `services/cliProviderBridge.js` returns `modelIndependentlyAttested: false` for CLI calls. The replacement retains independently-attested responses and additionally admits only the exact registered bridge-echo tuple: basis `explicit_cli_model_argument_accepted_bridge_echo`, returned provider/model equal to the collection's registered `codex` / `gpt-5.6-luna` identity, and `model_independently_attested === false`. `cli_default_not_independently_attested`, provider/model drift, prohibited tool events, response-path drift, and response-SHA drift remain inadmissible.

The gate repair changed the preparer source SHA-256 from `af2a9182e2103e6dfd422e7f1ebab8d2f2df33b908b911f52af7c065b3bb5508` to the zero-call projection `9b545f368da469d0271613751d6da6f11bb4ae1fc57fa63d39a66733ce83177c`. Because the reader-instrument digest includes the preparer source, direction 049 prospectively re-pinned it from `7b084d936e7600a5023d133eba6660f18fffa378d9b5aed1d8a3a7b4a881e1c9` to the projected and recomputed `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`.

The directed equivalence proof passed every letter:

| Letter | Required proof | Result |
|---|---|---|
| a | Preparer diff exactly the gate lines | PASS: only the attestation clause at the existing verified-run gate changed |
| b | Recomputed reader digest equals projection | PASS: `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f` |
| c | Extraction schema digest unchanged | PASS: `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d` |
| d | Provider response schema byte-identical | PASS: `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1` |
| e | One-case response schema unchanged | PASS: `f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0`, 10,930 bytes |
| f | One-case packet unchanged | PASS: `237c0784f637cb74ea124a5ec2c00912e3bc39eddf6359573c276fa823c3e06b`, 32,369 bytes |
| g | Transport caps unchanged | PASS: response 14,000 bytes; packet 42,000 bytes |

The six directed guards passed: independently-attested true and exact registered bridge-echo false both pass; CLI-default basis, provider/model mismatch, nonzero prohibited-tool events, and response-SHA mismatch each fail closed. Focused suites passed **71/71**, focused ESLint and `git diff --check` passed. The clean repair-commit preflight passed **42/42**, verdict `instrument_ready`, zero-call:

- preflight: `/private/tmp/adaptive-warrant-v3-preflight-4c33e6df-r49-s514.json`;
- SHA-256: `d5d071440de5d74c5c4d2cd8eb6c387bb2c34f04775c09754ec75134f3bee71b`.

`DEFECT-LEDGER.md` entry #16 records the contradiction, repair, quarantine, re-pin, guards, and the deferred latent defect in `scripts/prepare-adaptive-warrant-annotation-batches.js`. That decision-preparer was not edited.

## Quarantine of the direction-047 responses

Before the fresh run, the complete r47 reader-run directory and all four response files were moved intact to `/private/tmp/adaptive-warrant-r47-quarantine-defect16`. Nothing was deleted, admitted, or pooled. The run artifact remains `2c0063ddaad298e34acd6b3433ca5ee22b1c4fca022103d9ec56c62247e0beb6`; its five reserved attempts remain counted. The preserved response hashes are:

| Batch | Preserved SHA-256 |
|---|---|
| `semantic-reader-a-batch-01` | `e1a137c0ac952fbbaaaaa5fb98f889bb3bf9dfd662e67ba789c9214b6989e3c5` |
| `semantic-reader-a-batch-02` | `40ff5e08a71583a8e58678839c2df3363529d8a396b4f4a403209ead82f709a7` |
| `semantic-reader-a-batch-03` | `1dcec8ef50a35314ab231d754243a6a7a20f814fb40b89f7f98f4d616556f1c9` |
| `semantic-reader-a-batch-04` | `a4d1cd2ed2d4cc980a50e896a436cb984a9a70f608496d2a9b91da4e3f00827a` |

## Provenance history: directions 045 and 047

Direction 045 ruled defect #15 a transport defect: the frozen one-case reader response schema was 10,930 bytes against a 10,500-byte cap, so it authorized raising the response cap to 14,000 while leaving the 42,000-byte packet cap and every semantic surface unchanged. Report 046 then showed that editing the preparer necessarily moved the source-inclusive reader digest, so direction 047 prospectively re-pinned `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d` to `7b084d936e7600a5023d133eba6660f18fffa378d9b5aed1d8a3a7b4a881e1c9` at commit `62e4fd0a8aae57c667318dfb99920042b8776893`, with byte identity proved for the extraction schema, provider response schema, one-case response schema, and one-case packet. Direction 049 used the same prospective re-pin discipline for the gate-only defect-#16 repair at `4c33e6df`.

## A2 — fresh collection and reader results

The fresh collection was prepared from the unchanged frozen 93-case corpus at the one-case partition and bound to repair commit `4c33e6dfa9c45a50cf3a15b7661908d007796703`. Before any call, its authorization manifest recorded exactly **93 cases × 2 readers = 186 planned calls**.

- collection: `/private/tmp/adaptive-warrant-r49-equivalence-onecase/semantic-annotation-collection-manifest.json`;
- collection SHA-256: `7fa70e3ea4d2c8fa0e24d2199470674cc41853b770a117b648dfe41d37647861`;
- authorization request SHA-256: `4a00babb56a787f4c719dd10c126ded025bf75ae0d6c903e26a4933e7d37437c`;
- corpus: 93 cases, SHA-256 `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184`;
- readers: 2; batches: 93 each; batch size: 1;
- largest packet: 37,977 / 42,000 bytes;
- response-schema cap: 14,000 bytes.

Both readers ran from scratch. The completed run is `/private/tmp/adaptive-warrant-r49-semantic-readers/semantic-reader-run.json`, SHA-256 `fb181a9cfa377fa3fcb546b13b5a4a986c3d3525dacb74b1e716cbfa80e82d12`.

| Reader result | Reader A | Reader B | Total |
|---|---:|---:|---:|
| Planned batches | 93 | 93 | 186 |
| Attempts reserved | 93 | 93 | 186 |
| Responses completed | 93 | 93 | 186 |
| Runner failures | 0 | 0 | 0 |
| Prohibited tool events | 0 | 0 | 0 |

All 186 completed batches report `codex` / `gpt-5.6-luna`, basis `explicit_cli_model_argument_accepted_bridge_echo`, and `model_independently_attested: false`, exactly matching the newly admissible registered tuple.

Assembly then failed independently on these responses:

| Reader | Batch / sample | Response SHA-256 | Fail-closed finding |
|---|---|---|---|
| A | `semantic-reader-a-batch-17` / `case-afeab50fccc871ef0720eca6` | `ee6c5411bc04d444a365255a99be1425d269c7e0fb745d208fbf7e4a04074ae5` | `learner_wording_request` used `target.state: none` with action object `natural-act-93fda12c3400bd2a`, whose registered target is `moth_service_panel_access` |
| B | `semantic-reader-b-batch-36` / `case-bd05322ba14d38b3be4ea50c` | `7fbb10d66fdc9510a9e05be6556d87e7651526cb323892fc47df7ae024d5482c` | `learner_wording_request` used `target.state: none` with action object `natural-act-61a04a808b669b07`, whose registered target is `jukebox` |

## Support-gate arithmetic

**Unscored / N/A.** The denominator cannot be formed because neither 93-case reader response set passes assembly. There are zero assembled reader sets, zero assembled two-reader consensus cases, and no eligible support-gate arithmetic. The validator failures occurred before consensus or prediction scoring; they were not waived post hoc.

## Frozen corpus and drop-and-log disclosure carried forward

The seed-514 freeze remains **93 retained cases / 2 dropped candidates / 3 logged match relationships**. The two dropped cases stay excluded forever. The refrigerator candidate matches one excluded corpus; the jukebox candidate matches two excluded corpora.

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

Every `model_call_budget_reserved` attempt counts under the report-031 convention. The r47 five-attempt stop was already included in the direction-049 starting total.

| Stage | Attempts in direction 049 |
|---|---:|
| A1 repair, proof, suites, preflight, quarantine, and collection preparation | 0 |
| Fresh semantic reader A | 93 |
| Fresh semantic reader B | 93 |
| Assembly and support attempt | 0 |
| **Total added** | **186** |

Starting from **3,151/8,000**, the running total is **3,337/8,000 attempts**; **4,663** remain. Seed 515 remains unspent.

## Required coverage quotation

- **Registered checkpoint:** **139/144 analyzed = 96.53% coverage**; **5/144 unanalyzed = 3.47%**.
- **Final descriptive:** **187/192 analyzed = 97.40% coverage**; **5/192 unanalyzed = 2.60%**.

There was no new matrix coverage loss. No live run was patched, no failed gate was waived, no dropped case was restored, no reserve seed was spent, and nothing was pushed.

## Required next authority

Direction 049 requires stop-and-report on any failed check. The reviewer must rule on the two reader target/action-object assembly failures. The existing 186 completed responses cannot be patched, selectively retried, or scored under this direction.
