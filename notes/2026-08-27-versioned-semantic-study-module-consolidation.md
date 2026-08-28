# Versioned semantic study module consolidation evidence

Date: 2026-08-27
Workplan item: `consolidate-versioned-semantic-study-modules`
Baseline commit: `ee2f3db3e763616052c32ee8b83a3b2d1a6c4a77`
Baseline tree: `a471a5c5e8d38fd6f62823e59072f751ff2c4d49`

This is an observational before/after ledger, not a new source-code pin,
launch gate, or authorization mechanism. Existing registrations, GO records,
and `.prettierignore` determine the hard-protected set. Git retains every
pre-consolidation blob.

## Disposition

The broad inventory contains 40 modules:

- 20 directly SHA-pinned service modules, unchanged byte-for-byte;
- 2 service modules protected by `.prettierignore`, unchanged byte-for-byte;
- 14 historical modules without a direct current-source pin, deliberately
  preserved byte-for-byte: 12 carry retired digest/source-bound validation
  machinery and two are distinct adjudicators outside the near-copy set; and
- 4 demonstrably source-unpinned pure heldout builders, migrated through one
  parameterized builder and deeply frozen V5-V8 descriptors.

The original 34-file near-copy estimate is therefore 18 hard-protected modules,
12 policy-preserved historical governance carriers, and 4 migrated pure
builders. The broader inventory adds four unversioned directly pinned modules
and the distinct unversioned/V9 recovery adjudicators.

No protected historical file was replaced. No frozen corpus, sealed report,
registration, GO record, adjudication instrument, or protected test changed.
The legacy builder paths remain as side-effect-free compatibility wrappers and
still run as their original command-line entrypoints.

## Directly SHA-pinned modules: before equals after

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `services/tutorStubBoredomSemanticAdjudication.js` | `09ff66e44aa4219cdda56fae62a543e985f50b9ef32c487d5af3e85bc45168ea` | `09ff66e44aa4219cdda56fae62a543e985f50b9ef32c487d5af3e85bc45168ea` |
| `services/tutorStubBoredomSemanticAdjudicationV2.js` | `93904fd4ca73a876f086aa945521fe4d45138bc6a9d1733993463fc256b1527f` | `93904fd4ca73a876f086aa945521fe4d45138bc6a9d1733993463fc256b1527f` |
| `services/tutorStubBoredomSemanticAdjudicationV3.js` | `001eba55ebda1e08238b79ea220490fb7c7af3cbda30808964b9a2b4778fbf5e` | `001eba55ebda1e08238b79ea220490fb7c7af3cbda30808964b9a2b4778fbf5e` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV2.js` | `7cbf8e021c8558a14e209ee45e21ebf04e65ecda7018324251657db59d1538e7` | `7cbf8e021c8558a14e209ee45e21ebf04e65ecda7018324251657db59d1538e7` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV3.js` | `c2de323838668450aaeea36e7b981f792ecdef724e98dd34257250829df0f15a` | `c2de323838668450aaeea36e7b981f792ecdef724e98dd34257250829df0f15a` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV4.js` | `b27cc3f230e84a22022e79b5fdda8a0d332c9af9a56c44851b1b6d3d9ef41a5b` | `b27cc3f230e84a22022e79b5fdda8a0d332c9af9a56c44851b1b6d3d9ef41a5b` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV5.js` | `53f62204236ff142a47ff17bf801624ccd558d52dcc86325fa904a1058110890` | `53f62204236ff142a47ff17bf801624ccd558d52dcc86325fa904a1058110890` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV6.js` | `e0fbb51a9c6c0aee8b2f52ba4e10c3542a822d45eb5b613b5d9b7eab64265047` | `e0fbb51a9c6c0aee8b2f52ba4e10c3542a822d45eb5b613b5d9b7eab64265047` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV7.js` | `ae4a3495dfba829317d6ae3d08ae5a5b637aaef05417b8e0cd97edcb7307ce7f` | `ae4a3495dfba829317d6ae3d08ae5a5b637aaef05417b8e0cd97edcb7307ce7f` |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV8.js` | `7f1ed663f61becaecec4595f20660e3e6ae9a997998710d0440b36577bbdfbbe` | `7f1ed663f61becaecec4595f20660e3e6ae9a997998710d0440b36577bbdfbbe` |
| `services/tutorStubResistanceRecoverySemanticValidation.js` | `9e51bfb2e43374e10990f5f5037c87cf0330475711a5e18ffac4afd19d0a60b5` | `9e51bfb2e43374e10990f5f5037c87cf0330475711a5e18ffac4afd19d0a60b5` |
| `services/tutorStubResistanceRecoverySemanticValidationV3.js` | `253a2ae444bb61d53d6a7fb6057e03b2b2fcfc0933c123e3a322b1183f87f4e1` | `253a2ae444bb61d53d6a7fb6057e03b2b2fcfc0933c123e3a322b1183f87f4e1` |
| `services/tutorStubResistanceSemanticAdjudication.js` | `4c1123b7272e33bdfc63205c85058d9b02753b7c89d3c05af2137b0f72783456` | `4c1123b7272e33bdfc63205c85058d9b02753b7c89d3c05af2137b0f72783456` |
| `services/tutorStubResistanceSemanticAdjudicationV2.js` | `2b9faa679fedf1e98c25e6e5f3569da6c2ef83f3654642c08dc3c00e6fc15bfd` | `2b9faa679fedf1e98c25e6e5f3569da6c2ef83f3654642c08dc3c00e6fc15bfd` |
| `services/tutorStubResistanceSemanticAdjudicationV3.js` | `a66a16c4ea80a831065234507be8308d8e3ac3cf9d6de4a0e49395c8164fa7ff` | `a66a16c4ea80a831065234507be8308d8e3ac3cf9d6de4a0e49395c8164fa7ff` |
| `services/tutorStubResistanceSemanticAdjudicationV4.js` | `40394d54ff569b388b5772d66ee9d4a806ecf9aade63710f4a2dc01c2faf634b` | `40394d54ff569b388b5772d66ee9d4a806ecf9aade63710f4a2dc01c2faf634b` |
| `services/tutorStubResistanceSemanticValidation.js` | `dd88d91e49209610fc736a1aa53dd66258cc13346be8c69c859bdeab999be5d3` | `dd88d91e49209610fc736a1aa53dd66258cc13346be8c69c859bdeab999be5d3` |
| `services/tutorStubResistanceSemanticValidationV2.js` | `689070a3100681a2d4f2c4ec5cf9f8222c54d61799b0944514933e30ae6ba975` | `689070a3100681a2d4f2c4ec5cf9f8222c54d61799b0944514933e30ae6ba975` |
| `services/tutorStubResistanceSemanticValidationV3.js` | `e31cea02321e235c474f7adb9509037e288f64281883e79245c4536a7bcfb394` | `e31cea02321e235c474f7adb9509037e288f64281883e79245c4536a7bcfb394` |
| `services/tutorStubResistanceSemanticValidationV4.js` | `af75307087d6c03cdc0667580d3f459c093327c6c71579b4067f4e56deafc4aa` | `af75307087d6c03cdc0667580d3f459c093327c6c71579b4067f4e56deafc4aa` |

The tracked registrations and historical GO records contain each before hash
above. Those source blobs remain hard-protected historical evidence.

## `.prettierignore` modules: before equals after

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `services/tutorStubResistanceSemanticAdjudicationV5.js` | `98112717ba3a51aa67ca40129bba66a064d917eaaba10328ad2b4e7aef9e9da9` | `98112717ba3a51aa67ca40129bba66a064d917eaaba10328ad2b4e7aef9e9da9` |
| `services/tutorStubResistanceSemanticAdjudicationV6.js` | `db449a1887edde9361d36bf99c28c240576570fb2c395553b3398407cd9b923b` | `db449a1887edde9361d36bf99c28c240576570fb2c395553b3398407cd9b923b` |

Two adjacent historical tests are also protected by `.prettierignore` and
remain unchanged:

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `tests/tutorStubResistanceSemanticAdjudicationV5.test.js` | `ca0215e64e4a9610c17ed3c0f3ba78e1174c94cfcb67c8317fb5e2e4e881406c` | `ca0215e64e4a9610c17ed3c0f3ba78e1174c94cfcb67c8317fb5e2e4e881406c` |
| `tests/tutorStubResistanceSemanticAdjudicationV6.test.js` | `7f46b330ee1adc76620b2cf797e35019741c6e3e210efcea9449c79b3cda3f51` | `7f46b330ee1adc76620b2cf797e35019741c6e3e210efcea9449c79b3cda3f51` |

## Historical, source-unpinned modules deliberately preserved

These modules have no direct current-source SHA pin, but consolidation does not
rewrite them. The 12 versioned carriers participate in retired exact-source and
digest-bound validation machinery; generalizing that machinery would violate
the standing forward-only authorization policy. The two adjudicators are
distinct implementations rather than near-copies.

| Path | Before and after SHA-256 | Disposition |
| --- | --- | --- |
| `scripts/analyze-tutor-stub-resistance-measurement-validation-v5.js` | `4c23663f97753d842ba4cd195299cc02618f40e00b30764f411a5f26e581e7a5` | legacy governance carrier preserved |
| `scripts/analyze-tutor-stub-resistance-measurement-validation-v6.js` | `83540c1ee5e84c268277e49430b073a28c93a36b37dc4c88895329953af278c2` | legacy governance carrier preserved |
| `scripts/analyze-tutor-stub-resistance-measurement-validation-v7.js` | `1f1c6f39e0d68f38e3acbab9293ad6a4d43e256b10d6d0bdbbc46e98e93c1f3a` | legacy governance carrier preserved |
| `scripts/analyze-tutor-stub-resistance-measurement-validation-v8.js` | `f91f8d91fe1eac230e1073f399f23c174a08661b53b1cf3644744d4a397a258c` | legacy governance carrier preserved |
| `services/tutorStubResistanceMeasurementValidationV5Runtime.js` | `f7e7bd52eb9505466bd129a97a5a856bb056d56b6648b255a6bcc52caa020bcf` | legacy governance carrier preserved |
| `services/tutorStubResistanceMeasurementValidationV6Runtime.js` | `6e545a5ac1ac595b66de90e92d48117c443ae8e3494ca0d27a8fafde116cf301` | legacy governance carrier preserved |
| `services/tutorStubResistanceMeasurementValidationV7Runtime.js` | `0c80cd1c76d5df0d4f6be85aaae29e6f93983c5926dc924551dad47efe17b307` | legacy governance carrier preserved |
| `services/tutorStubResistanceMeasurementValidationV8Runtime.js` | `8e17fd07548100be385374c1c55c651d2f2c3992e16d00d5c919ba4d90a0eb48` | legacy governance carrier preserved |
| `services/tutorStubResistanceRecoverySemanticValidationV5.js` | `e8d1ac33b20d8cb75ae17dd505031c57c5982c5499563636847d546cff6e0260` | legacy governance carrier preserved |
| `services/tutorStubResistanceRecoverySemanticValidationV6.js` | `d2ad6f4b3460896f4a982a12b9a736e38d8f2b1bb822008e46ee685d212b8f9c` | legacy governance carrier preserved |
| `services/tutorStubResistanceRecoverySemanticValidationV7.js` | `d384235aff3a3627c09f28157767df2154baa017020ee35d73d0f11ac830efa1` | legacy governance carrier preserved |
| `services/tutorStubResistanceRecoverySemanticValidationV8.js` | `f376c8fe6f60ed9de74cd43275a1cf2efe61351dd0d67640ef4a04491ee6d47e` | legacy governance carrier preserved |
| `services/tutorStubResistanceRecoverySemanticAdjudication.js` | `956e56264f1a50ef00c2b7633ca73f98fc4ba53ec54215d4b8265645a55a4d73` | distinct implementation preserved |
| `services/tutorStubResistanceRecoverySemanticAdjudicationV9.js` | `87aeae12793fa7b6034c03783b33516c2395dda34789deb6eee9743301d5018f` | distinct implementation preserved |

## Demonstrably source-unpinned pure builders migrated

At the baseline commit, each before hash below had zero exact references in
tracked text and none of these paths appeared in `.prettierignore`. These
historical builders are pure deterministic corpus constructors. Their legacy
paths now delegate to the shared builder through a version-matched frozen
descriptor.

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `scripts/build-tutor-stub-resistance-measurement-heldout-v5.js` | `871587a25ccb7cf4c7e115e7ded91e74814b7918260658c48ce9fd07e94a8c0e` | `9d7d82c8c7e418633a72e2efdbbec4ed1e9043a46e209e4769a1f464a1eb7157` |
| `scripts/build-tutor-stub-resistance-measurement-heldout-v6.js` | `38ef377f8b26f4c75fe440e261153658b67c5ee4f2181dddcc8e67033fd56f14` | `371f0852f8ecfec24c5c8b798389489e93a8735481d9aad0f312321632b6dff3` |
| `scripts/build-tutor-stub-resistance-measurement-heldout-v7.js` | `0548aa9d00340c2eec0508deac1845cdb6729020140623233093e10fee6dd28b` | `a3021fcedb697e98e0734aea61d860cfb1825802f6b8ce85b5dfec5a31a12977` |
| `scripts/build-tutor-stub-resistance-measurement-heldout-v8.js` | `926084a40833bb925e22ad352bfcf3c1a6af349a77ac431a81b3325f89ecd2a5` | `c1adcdb80ba282f02c5c7091d9bd3c4e83278310c73934217954640d003b07fd` |

## Sealed corpus equivalence

The shared pure builder renders in memory; tests compare those bytes directly
with the existing create-once corpus files. No corpus is deleted, regenerated,
or overwritten.

| Version | Bytes | Existing and rendered SHA-256 |
| --- | ---: | --- |
| V5 | 251334 | `e69a6672d1e9311ea55319d63a78fe46713af6d021848c3fe6cb15de04b00630` |
| V6 | 260700 | `3aa4c5a5dc276f38f31e3067ea7c29b9399e12d9b7204ff22a875c64bc7a1c9a` |
| V7 | 258765 | `60e8b32af3a1ed6990808c82f93560f8d5a681fd6e355b8fa25cf619116d7b5f` |
| V8 | 259824 | `5e2dd09c861ccc22c110ea1ad75bfebc61d5eaa1962bd422e36d753115228201` |

## Verification method

- Baseline classifications were made at `ee2f3db3`, before this ledger
  contained the hashes.
- Direct `git diff --exit-code origin/main -- <preserved paths>` checks and
  SHA-256 recomputation establish that all hard-protected and deliberately
  preserved modules and tests remain byte-identical.
- The V5-V8 equivalence matrix imports every compatibility wrapper, verifies it
  binds the matching deeply frozen descriptor without executing the CLI, and
  reproduces each sealed corpus byte-for-byte.
- No shared code reads Git state, GO requests, source commits, or authorization
  records. No model-backed or paid study was launched.
