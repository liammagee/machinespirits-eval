# 039 — Codex report: seed 514 complete, reducer repaired, exclusion overlap hard-stop

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-G`

**Authority:** direction 038, unattended note 023, and the human's 19:52
8,000-call ruling

## Ruling

**HARD STOP for the human on a verified contamination/provenance anomaly. Do
not launch seed 515 and do not start the outcome study.**

Defect #11 was repaired exactly as directed and committed at
`489f242931231994b3e780e72c98155989fdafaf`. The pre-existing writable-entry
test passed unmodified. Fallback-pass closure v2 covered the retained corpus
plus every ledger target kind, requested value type, and required label shape;
there were no unsupported generator shapes. The complete zero-call chain
passed, and seed 514 launched from that exact clean detached commit.

All 24/24 dialogues completed eight turns. The live run made 606 calls, stayed
inside the registered analysis-coverage line, and produced exact live/offline
parity: 192/192 structured comparisons with zero mismatches and 192/192
delivery-application checks with zero mismatches.

The live commit's final reducer nevertheless wrote `invalid_parity`. Zero-call
diagnosis found deterministic defect #12: the status checker subtracted
analysis-error turns from its parity and delivery denominators even though the
registered fallback emits and audits a decision on those turns. The repair was
ledgered, guarded, and committed prospectively at
`3eca7086707239dd229bb76861b250417b66cff9`; the next disclosed master-seed
lock is 515. A clean zero-call replay at that commit resolves seed 514 to
`complete` with the exact full-horizon denominators above.

That replay then reached the annotation freeze and failed closed:

> annotation freeze overlaps 3 excluded cases

The overlap audit confirmed three real matches across two unique content
fingerprints, not a hash/path bookkeeping error:

- Larkspur fridge, turn 1, “Could you choose what I should check first?”
  overlaps an explicitly excluded prior mechanism corpus at fingerprint
  `5f1763f3d7c86001df7d62d2012b8df9c7088a43a9e91b314ce4db04057e9f10`.
- Foxtrot jukebox, turn 1, “Could you choose what I should examine first?”
  overlaps two explicitly excluded corpora, including seed 504, at fingerprint
  `134e8551443cfda8f14902acf44a8ba392345e50db27489901e233cc73320212`.

Direction 038 reserves contamination or provenance anomalies as human hard
stops. Therefore seed 514 is burned and unpooled; seed 515 was minted in source
but not dry-run or launched; no reader packet was licensed; no readers were
called; and the outcome study was not started. Changing the all-observe-decision
freeze or its exclusion rule would amend the registered instrument and also
requires human authority.

## Required coverage quotation

- **Last registered pre-final checkpoint coverage rate:** **139/144 analyzed =
  96.53% coverage; 5/144 unanalyzed = 3.47%**. This was below the frozen 15%
  self-halt line after the ten-analysis-turn floor.
- **Final descriptive coverage rate:** **187/192 analyzed = 97.40% coverage;
  5/192 unanalyzed = 2.60%**. By arm: intervening/active 92/96 analyzed
  (4/96 unanalyzed), instrumented/observe 95/96 analyzed (1/96 unanalyzed).

There was no coverage halt. The halt is exclusively the post-run exclusion
overlap. The earlier sealed checkpoints were 47/48 analyzed (97.92%) and 95/96
analyzed (98.96%).

## Defect #11 repair and closure v2

The label composer now tokenizes target and kind words and removes redundant
kind terms. The composite writable-entry fallback begins:

> The log entry is not public yet

It never renders `The first-log-entry-log entry…`. The exact existing test
`active obligation ownership survives a simultaneous writable-entry recovery
path` passed without modification.

Closure v2 retained the six corpus-reachable obligations and added 19 synthetic
targets. All 25 compiled directives plus deterministic fallbacks passed the
complete final-response check with zero calls. Synthetic coverage was:

- target kinds: `comparison_result`, `mark_or_tool_result`,
  `material_or_assay_result`, `other`, `public_exhibit_result`, `record_entry`,
  `weight_or_ring_result`;
- label shapes: composite terms, hyphenated compound, writable entry, generic
  sentinel, kind-only, and every requested-value-type form;
- requested value types: `date`, `match_status`, `material`, `name`, `other`,
  `record_text`, `sound`, `time`, `weight`;
- unsupported generator shapes: **none** (`[]`).

The closure digest was
`9273e6802ead00907c7f4aee4eabb865bb84580057cf9efd150804459c064ef1`.
Retained input digests remained:

- seed-511 sealed:
  `0c29cea3c9c9637d631d43f76fab521535ccaaeb934c8641b12167fc2f4bb494`;
- seed-511 failed draws:
  `11fd96dffffea95459242d7378081b7b00231d32bd9bbec1fa616bf82c56485b`;
- seed-512 dead children:
  `91b44e1d6ade4e956ada731af313febdbc7f5e38517703d2e78ee61210ab5161`.

## Seed-514 zero-call licensing chain

1. Focused suites and guards passed **264/264** across six suites. The exact
   launcher suite passed **201/201**, including **16/16** in
   `tutorStubGuardAccounting.test.js`.
2. Closure v2 passed 25/25 complete final-response checks with zero calls.
3. The seed-510 replay was identical: **5/185 discarded = 2.70%**, 180
   survivors, zero calls. Its 24 traces retained combined digest
   `bf140754c83f96fa6c9f40741b9b308330eb9c16d89cbe4a9ca958e760b1c7b0`.
4. Preflight passed **42/42**, verdict `instrument_ready`, zero calls.
   Probe/live prompt bytes were identical at
   `e6e35c267d837cc18435d784eb6835074dbc6ea7e56788b40ebc29179caebe84`.
   Extraction schema was
   `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`;
   reader schema was
   `51107d43429bae0f22888530412f8282289f3f6460c19c5d9cfe8a00ea87941d`.
5. Provider-schema acceptance carried over with zero new calls because the
   response schema remained byte-identical at
   `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`.
6. The dry matrix sealed **24/24** jobs with seed 514, 24 dialogues, eight turns,
   64 calls per dialogue, and the 1,536-call matrix cap. Approval digest was
   `93f10c7e6cb1de11aae2926b24be1bf2177b4dfb069c4add6038d1b1f9a8ec9b`;
   source provenance was
   `05d50422ce80829bb845f41655a94b8b52b2fe7c92e0a38cb9d949f19f602447`;
   child policy was
   `b36d88a4d997d68fbcfe3daa98a20adf7e136c91b3b08e98d8be58a2c4fe9950`;
   plan execution was
   `95693403e07048c5a2e47c405924c954c81faa2a698bf872d7704482c4517d50`.
7. The live launcher accepted the exact authorization and completed 24/24.
   The sealed 24-row execution digest is
   `28d494e5a5e54cee1d9e76e26768ed42e90305ad5efc31380db9eccd20d08514`.

## Defect #12 prospective guard and zero-call replay

The final reducer now requires the full horizon for structured parity and
delivery application, including any registered deterministic fallback turn.
The new test supplies one analysis-error turn with a fallback decision and
requires `complete`; existing zero-denominator and true-mismatch cases still
fail closed. `DEFECT-LEDGER.md` contains entry #12.

At clean commit `3eca7086`, the launcher suite again passed 201/201, accounting
passed 16/16, the closure test passed 2/2, closure v2 remained 25/25, the
seed-510 replay remained 5/185 = 2.70%, preflight remained 42/42
`instrument_ready`, and schema carryover remained byte-identical. The repaired
seed-514 reducer replay was `complete`, 192/192 parity, zero mismatches,
192/192 delivery application, zero mismatches. It then failed at the registered
exclusion-overlap check. The chain stopped there under the explicit human
hard-stop rule; no seed-515 dry or live artifact exists.

## Exact call recount

Per the report-031 convention, every `model_call_budget_reserved` event counts
as an attempt. Seed 514 had no transport errors or calls left in flight:

| Role | Reserved/attempted | Completed | Errors | In flight |
|---|---:|---:|---:|---:|
| Automated learner | 192 | 192 | 0 | 0 |
| Learner analysis | 192 | 192 | 0 | 0 |
| Speaking tutor | 192 | 192 | 0 | 0 |
| Opening | 12 | 12 | 0 | 0 |
| Tutor recovery | 18 | 18 | 0 | 0 |
| **Seed 514 total** | **606** | **606** | **0** | **0** |

The unattended running total is therefore **3,146/8,000 attempts**: 2,540
through report 036 plus 606 in seed 514. Seed 515 added zero. Remaining ceiling:
**4,854**.

Requested training reuse was `on`; effective reuse on the automated-only Codex
route was `off` / `not_applicable` for every child.

## Artifact digests

### Seed-514 licensing and live run (`489f2429`)

| Artifact | SHA-256 |
|---|---|
| Focused suites and guards TAP | `4c9957b2c842c64da9f02ccc8d7145fea8377b9e25ed6bbf09bea16d3bb3f345` |
| Accounting 16/16 TAP | `d1afaa631568ec761efc5004d86151656b8eab04e7b9bf4b1302e7d4f5bfeb19` |
| Launcher 201/201 TAP | `41e463c55b872007b504eb1a3235675aef724deb311a0eb5cecb48e0c9428689` |
| Fallback-pass closure v2 JSON | `4e471a00578ebe58a4cc339edd2ed2a367304c1adfa606bd7a12af59fd98638b` |
| Seed-510 replay JSON | `4235f58ebbb6a905c355b6541339174f38edc61504a4aa57fa12f608473a013e` |
| Semantic preflight JSON | `b534e2257875d91cf097f2fb84a70f4f874e70eba48bd0a9d331f964183ef50b` |
| Schema-acceptance carryover JSON | `9b68b99b8d740afe6683ef3943b28ec177c6bdeebc73564642c245439cd877e2` |
| Dry study plan | `fa69fbe16846dec83b2b557efe9bbd3b9d0f8b4788962170c3a0409b8c62960d` |
| Dry study results | `401116f17ac04de86d2b9e0ff0569952b09b39afa14d473d07837fde6b6557c9` |
| Dry launch request | `05bc617eec355a0b437ea72c23d66d6d80539b4e594672913ed2819f0f786103` |
| Approved authorization | `89c6c2b456c95b8e583ff5d35b02d89044d273f72811bb903208fe179070095b` |
| Live study plan | `98e95724b8fc4717f2782395b2e580e2f5f967a0c2a25f9e532d942b51f83719` |
| Live launch request | `5718a284b933ac01f2ef01238884130cf3cb10c86d3c4b864ca9e7a51e19bd72` |
| Live accepted authorization | `20f39e96b87a522f408d202d13dbe89e6b025acef8c43f9062e2b9b7c0803edb` |
| Canonical live results JSON (`invalid_parity`, restored with clean live source) | `8047291dee1f89a665d1e0620646a68a090345a62c6c3c26d57432ed9754ebc5` |
| Canonical live results Markdown | `146600344ae08946d0e0d77c91b31e83f521aebd5dd4746bc807973fbce32ab8` |

### Prospective reducer repair and hard-stop evidence (`3eca7086`)

| Artifact | SHA-256 |
|---|---|
| Launcher 201/201 TAP | `2d6630265375c3ac48b2c1e14e1a0961c653b6b7aa69c056a13f4b5267dd7833` |
| Accounting 16/16 TAP | `dfe8047219fa613d7fb8017807aec6b53790d77412b930db3e32d9321efef234` |
| Closure test 2/2 TAP | `56f5353051c26f8a4f2ac090dfa91fa9d3ddf32e17211aa49c2781f8b4d1ebcd` |
| Fallback-pass closure v2 JSON | `4e471a00578ebe58a4cc339edd2ed2a367304c1adfa606bd7a12af59fd98638b` |
| Seed-510 replay JSON | `d8164766a448211b1149e5c06099b0c06b40f2fdedff2fc5b6972cc9546f6233` |
| Semantic preflight JSON | `b83353c037760204e562bb677689861b060b81299b1e229726a5540179ded4fa` |
| Schema-acceptance carryover JSON | `eca92a55557bf32ba336398f06bce5c47c80bfaac8805e797699ba6e609bf164` |
| Repaired reducer replay results JSON (`complete` before freeze) | `817899cffcecad88e1af93a8f2822b9ab872e766f06e3096db20987cac36e24c` |
| Repaired reducer replay results Markdown | `548176284180a2d55bf617bb5a0a46abb0843e134ebd2ae477f3b868bb086afd` |
| Repaired reducer replay stderr/stdout | `cf9626edef81b6dcd491ea73ca08b3eef2038a236484c637567be4d5edeeeebd` |
| Exclusion-overlap audit JSON | `87e35bab4d0beda3791aa0dc126262f76b160cd037fa0dee644b6e32cfa92d0d` |

The live root is
`/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514`. The clean
prospective reducer replay is
`/private/tmp/adaptive-warrant-v3-matrix-reducer-replay-3eca7086-r39-s514`.
The overlap-triggering 95-case candidate corpus, private key, and semantic
predictions were quarantined under the live root at
`quarantine-r39-repaired-reducer-overlap/`; they are unlicensed and must not be
sent to readers. Their respective digests are
`7a9c1c4f502d195f40475e9dedc7372db920f8a0169e760d4d4d162b3e423422`,
`7c110bfda2170fe0e48c9cf9064a022ea03884b44976eaf7e34dfcb31070379b`,
and `681a1d3e363018d0316cc65e9f6381f144e22002ce85aba899684f55d0f00319`.

## Required next authority

The human must decide whether and how to amend the annotation freeze/exclusion
design for deterministic turn-one recurrence. Until then: no seed 515, no
reader calls, no outcome-study preregistration freeze, and no outcome launch.
