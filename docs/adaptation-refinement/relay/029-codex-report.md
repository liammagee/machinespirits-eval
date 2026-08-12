# 029 — Codex report: schema pass, reserve matrices 506–509, human hard stop

**Date:** 12 August 2026  
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`  
**Authority:** directions 027 and 028 plus unattended note 023

## Ruling

**HARD STOP for the human under note 023. Do not launch seed 510.**

Direction 027 passed: the provider-schema template repair was committed, its
closure tests and preflight passed, and the single authorized Luna retry ping
passed strict parse, validator, canonical-value, structured-output, and
no-tools checks. The representative matrix was therefore launched.

Seeds 506–509 were burned prospectively. Seed 509 is the decisive boundary:

- 17 children were admitted; 16 sealed valid eight-turn dialogues and one
  sealed `evidence_invalid` child after model work;
- completed-turn analysis coverage was **103/128 = 80.47%**;
- **25/128 = 19.53%** were unanalyzed, above the registered 15% ceiling;
- prompt-audit overflow was **0/128** after the Direction 028 cap repair;
- all 25 completed-turn losses were model/strict-validator residuals;
- zero-call replay found 25/131 returned analyses discarded = **19.08%**;
- three disjoint, exhaustive diagnostic blocks over those 131 burned returned
  analyses found 8/48, 12/48, and 7/35 discarded. No block met the ≤15%
  relaunch criterion; pooled diagnostic discard was **27/131 = 20.61%**.

Seed 510 remains unburned but is not authorized. Note 023 authorizes a reserve
relaunch only when a replay or probe predicts discard ≤15%. Further repair
would have to change the semantic contract/certified instrument, or a new
authority would have to relax/replace the written condition. Both are explicit
023 human hard stops.

## Work completed

### Direction 027 schema acceptance

- `fe2d7a2f` — provider-schema projection for the synthetic ping template;
  nested schema-fit validation in focused tests and zero-call preflight.
- Exact preflight: 40/40 passed.
- One authorized retry ping passed. Result:
  `/private/tmp/adaptive-warrant-v3-schema-ping-live-fe2d7a2f-s506-retry2-result/schema-acceptance-result.json`
  (`83555270c882b2e81ae4ef57be4015b6b5254bb19620d5b7f3763c936a2a7fc8`).

### Seed 506

- Seven sealed dialogues, 56 completed turns.
- Coverage: 41/56 = 73.21%; 15/56 unreadable.
- Cause split: 10 local prompt-audit overflows, 5 returned semantic-validator
  residuals.
- Zero-call replay: 5/46 returned analyses discarded = 10.87%, inside note
  023's reserve criterion.
- `ec85a49b` mechanically minified prompt metadata without changing prompt
  words, values, schema, validator, rubric, or the 42,000/10,500 envelope.
- `bc707cd0` burned seed 506, excluded its corpus, and froze seed 507.

### Seed 507

- Seven sealed dialogues, 56 completed turns.
- Coverage: 51/56 = 91.07%; 5/56 unreadable.
- Cause split: 2 turn-8 prompt-audit overflows, 3 returned semantic-validator
  residuals.
- Zero-call replay: 3/54 returned analyses discarded = 5.56%, inside note
  023's reserve criterion.
- The run exposed a parent transport defect: running aggregation attempted to
  validate an intentionally partial reader catalog.
- `0897d030` deferred reader-corpus construction until completion, burned seed
  507, excluded its partial corpus, and froze seed 508. No semantic surface
  changed.

### Seed 508

- Six sealed dialogues, 48 completed turns.
- Coverage: 37/48 = 77.08%; 11/48 unreadable.
- Cause split: 1 prompt-audit overflow, 10 returned semantic-validator
  residuals.
- Zero-call replay: 10/47 discarded = 21.28%, fail.
- One exhaustive 47-call burned-turn Luna probe: 13/47 discarded = 27.66%,
  fail.
- `2e90d863` made the probe respect the note-023 capped range (1–48 preserved
  calls) and current 15% threshold.

### Direction 028 contingency and seed 509

Direction 028 applied because seed 507 had two systematic turn-8 audit
overflows. Under frozen-constant rule 4b its predeclared replacement moved to
the next still-prospective seed after seed 508 burned:

- learner-analysis audit cap only: 42,000/10,500 → 56,000/14,000;
- the audit remained active and a >56,000 prompt still fails closed;
- zero-call preflight proves the diagnostic rewrite and live handbook prompt
  are byte-identical;
- `bb6404a9` committed the contingency, burned/excluded seed 508 and its probe,
  and froze seed 509;
- exact zero-call preflight: 42/42, `instrument_ready`;
- focused set: 92/92; exact live mechanism/integrity preflight: 192/192;
- `6cbbb8c3` and `e34fb6de` only bounded deterministic diagnostic selection
  over the seed-509 burned returned calls; they changed no study instrument.

Seed-509 failure classes were written-rule violations by model outputs:
missing catalogue targets/actions, forbidden value/component sets on
non-request acts, non-public identifiers, non-literal spans, and occasional
non-atomic overlaps. These are **reader/model errors under the written
contract**, not contract ambiguity. No both-defensible disagreement or
contamination finding was observed.

## Calls spent

Unattended running total from note 023: **1,085 / 4,000 provider calls**.

| Component | Calls |
|---|---:|
| Ping attempts through Direction 027 | 3 |
| Seed 506 matrix | 164 |
| Seed 507 matrix | 173 |
| Seed 508 matrix | 150 |
| Seed 508 burned-turn probe | 47 |
| Seed 509 matrix | 417 |
| Seed 509 disjoint probes | 48 + 48 + 35 = 131 |
| **Total** | **1,085** |

The matrix counts are authoritative `model_call` trace events, including
opening and recovery calls. Zero-call preflights, dry runs, and counterfactual
replays are not included.

## Principal artifacts

| Artifact | SHA-256 |
|---|---|
| Seed-508 preflight | `bd3c296824b85451908e1afd2bb12152255708fa87f155f661ddb70e9e8bed3f` |
| Seed-508 study results | `5d8da3e92b235246c924c887b64e37469be66a9c4fd512dc5280d92ccda3740b` |
| Seed-508 counterfactual | `64301e44560c3ac9aac10bfe979e86ba0b1ef7f737f2fbab785b79576ee9fac6` |
| Seed-508 47-call probe | `010a09ec15494264af06a338d722f098553eb730b9cca2fae6a984bd6c0d0f6d` |
| Seed-509 preflight | `b3cea52771c94c48ecb88d6e44870f22b2c3ff3b8519ff7e3ef040ba0187beff` |
| Seed-509 study results | `cdf3f151e3b4f935ee7ee0f0536f9a465732487608f7c8a15c4a2bb91ad3718b` |
| Seed-509 counterfactual | `c0d58fc910d33fc0389b86b8b83c2176fe134cbd4be14f1f8bb21cd2fb67504c` |
| Seed-509 probe block 1 | `fba36f07c1072212980ff9651dc0dd1e58b5cf848710d0bd842d7a05f3cb5a2b` |
| Seed-509 probe block 2 | `c789cab113376633c40028ce80514356de4de42c554ec3a23bd8ed63a08a51ab` |
| Seed-509 probe block 3 | `4211a2b3195366ab4971183d5c7d96794c09a77436361ea542d3b85b110ef29b` |

## Required next authority

Hold seed 510. A human must choose whether to:

1. retain the certified instrument and redesign/cut the live semantic typing
   layer prospectively;
2. authorize a different analysis seat or a new relaunch criterion; or
3. stop the representative-matrix programme at this boundary.

No matrix gate ruling is possible because no complete 24-dialogue reader
corpus passed the registered coverage gate. Ruling 010's binary fallback is
therefore not yet reached.
