# 104 — Codex report: steering/challenge decomposition run complete

**Date:** 15 August 2026. **Authority:** registration 101
(`14fe96c9`), build report 102 (`f553b7d1`), and reviewer GO note
103 (`1dec824c`). This report contains mechanical run results only.

## 1. Execution and seal

The charge-bearing command from note 103 was run from the worktree
root without modification:

```bash
node scripts/run-adaptive-warrant-steering-decomposition.js \
  --go-note docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/adaptive-warrant-steering-decomposition-live-2026-08-14 \
  --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

After the technical quarantine described below, the same command was
run with only the authorized `--resume` suffix. Final parent checkpoint
status is `complete`.

| Seal item | Observed |
|---|---:|
| Registered dialogues | 48 |
| Sealed dialogues | 48 |
| Gated / steering_only | 24 / 24 |
| Turns per dialogue | 8 |
| Completed dialogue turns | 384 |
| Frozen decision cases | 384 |
| Presence channel | Not fielded |

The post-generation fingerprint guard passed: 384 expected cases, 384
observed cases, and 384 observed identities. The annotation freeze was
written from source commit `8153622aeb81cb536510aa7a88b337a95e34f81e`.

### Technical quarantine and authorized re-take

The first generation take sealed 45 of 48 dialogues. Three child runs
stopped technically and were retained intact under
`quarantine/generation-take-1/` before re-take:

| Dialogue | Condition | First-take calls | Technical stop | Re-take calls | Final seal |
|---|---|---:|---|---:|---|
| `outcome-main-19-world_102_marigold_archive_box-s540-steering_only` | steering_only | 21 | Four turns completed; turn-5 response recovery exhausted three rejected candidates and the deterministic fallback failed `public_obligation_unresolved` | 25 | complete, 8 turns |
| `outcome-main-22-world_101_kestrel_signal_lamp-s542-gated` | gated | 30 | Seven turns completed; child call budget exhausted before the final tutor response | 27 | complete, 8 turns |
| `outcome-main-30-world_101_kestrel_signal_lamp-s544-gated` | gated | 29 | Eight turns completed; seal status `learner_analysis_incomplete` after three turn-7 `invalid_semantic_events` analyzer failures | 25 | complete, 8 turns |

The first resume attempt made zero model calls. Its seed-freshness check
found this run's own required automatic private-archive mirror and
treated the mirror as prior seed use. The parent launcher was repaired
to exclude only the current local run root and its exact automatic
private mirror during resume. The focused regression suite passed 7/7,
targeted ESLint passed, and the repair was committed as
`8153622aeb81cb536510aa7a88b337a95e34f81e`. No child run artifact,
frozen reader child, instrument, world, or response was patched.

## 2. Guards, assembly, and reader acceptance

The deterministic zero-challenge validity guard passed. It observed all
24 `steering_only` dialogues, found zero delivered challenges, and
recorded an empty violations list.

The assembly gate passed against the 384-case freeze: 384 frozen cases,
768 accepted responses, child status complete, and accepted responses
within the registered allowance. Reader model:
`codex.gpt-5.6-luna`.

| Channel and unit | Attempted | Completed/accepted | Failed |
|---|---:|---:|---:|
| Generation, dialogue takes | 51 | 48 sealed | 3 technical quarantines |
| Decision reader A, responses | 384 | 384 | 0 |
| Decision reader B, responses | 384 | 384 | 0 |
| Decision readers total, responses | 768 | 768 | 0 |

The reader failed-attempt allowance was unused. The full-contract
acceptance audit passed all 768 responses: 384 from reader A and 384 from
reader B. All 768 rows have `full_deterministic_contract: "passed"`.
The byte-pinned reader runner check passed at
`c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad`.

## 3. Call accounting

| Calls | Count |
|---|---:|
| Accepted generation takes | 1,256 |
| Quarantined generation takes | 80 |
| All generation attempts | 1,336 |
| Decision readers | 768 |
| Authoritative run total | 2,104 |

The parent checkpoint records 1,256 generation calls plus 768 reader
calls, total 2,024. Its three invalid first-take child rows have no
accepted trace path and are booked as zero there. The retained child
checkpoints record 21 + 30 + 29 = 80 additional calls, producing the
authoritative total of 2,104. The zero-call resume freshness stop adds
no calls.

The registered absolute cap was 2,240 calls; margin was 136 calls. The
reader ceiling was 800 attempts; margin was 32 attempts. The standing
counter moved from **8,355 / 19,337** to **10,459 / 19,337**, leaving
8,878 calls.

## 4. Mechanical score

### M1 — decision correctness

| Condition | Frozen cases | Consensus | Non-consensus | Correct | Consensus correctness |
|---|---:|---:|---:|---:|---:|
| gated | 192 | 179 | 13 | 150 | 83.7989% |
| steering_only | 192 | 174 | 18 | 125 | 71.8391% |
| Overall | 384 | 353 | 31 | 275 | 77.9037% |

### M2–M6

Arming, challenge, M3, M5, and M6 are report-only under registration
101.

| Measure | gated | steering_only |
|---|---:|---:|
| M2 challenge turns / decision turns | 45 / 192 (23.4375%) | 0 / 192 (0%) |
| M2 warranted challenge turns | 45 | 0 |
| M3 maximum-deference-streak mean / median / range | 3.8333 / 3.5 / 1–8 | 4.7083 / 4 / 1–8 |
| M4 dialogues with a deference break | 16 / 24 | 13 / 24 |
| M4 breaks persisting to end | 0 | 1 |
| M5 record growth after break | 15 true, 1 false | 13 true, 0 false |
| M6 legitimate closure | 24 / 24 | 24 / 24 |
| M6 illegitimate closure | 0 | 0 |

M3 maximum-streak values were:

- gated: `1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 8, 8, 8`
- steering_only: `1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8`

M4 first-break turn counts were:

- gated: turn 3 = 1; turn 4 = 8; turn 5 = 2; turn 6 = 3; turn 7 = 2
- steering_only: turn 2 = 1; turn 3 = 2; turn 4 = 3; turn 5 = 3; turn 6 = 2; turn 7 = 2

### Report-only arming and challenge counts

From sealed `tutor_warrant_gate_decision` events:

| Condition | Decision turns | Sensor-armed turns | Dialogues with an armed turn | `challenge_resistance` policy turns | Dialogues with a challenge policy turn |
|---|---:|---:|---:|---:|---:|
| gated | 192 | 48 | 16 | 45 | 17 |
| steering_only | 192 | 70 | 19 | 0 | 0 |

### M7–M8 — not reader-validated

These report-only values are labeled **not reader-validated** and come
from stored generation-time semantic events.

| Measure | Overall | gated | steering_only |
|---|---:|---:|---:|
| M7 result requests | 14 / 384 (3.6458%) | 11 / 192 (5.7292%) | 3 / 192 (1.5625%) |
| M8 proposed tests | 22 / 384 (5.7292%) | 10 / 192 (5.2083%) | 12 / 192 (6.2500%) |

## 5. Artifact hashes and private archive

| Artifact | SHA-256 |
|---|---|
| r52 instrument freeze supplied at launch | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |
| `annotation-freeze-manifest.json` | `987da72aae6a56d219faa381ae44ba1433042b141a435ddbd0b81d01e95f98e1` |
| `decision-readers/decision-reader-run.json` | `562415cac976b3e30b98b56e09f60ccd1031dae31f04cfe1df53ee34a5b730c6` |
| `decision-response-acceptance-audit.json` | `3ede69e8370f0f95ba23402775300179711ec770329cdc25bccbd7a516af4074` |
| `steering-decomposition-score.json` | `bdc74921fbecdc95c072258d7ebb6de5ce0a269898d0feca116f7e25d46bed43` |
| `steering-decomposition-checkpoint.json` | `b0d69bab31aaf1e7bb2aca380e228b33bc84e6d94405cc6ae06cee7e840d9ece` |

The sealed run directory was archived as
`tutor-stub-auto-eval/adaptive-warrant-steering-decomposition-live-2026-08-14.tgz`
in the private repository. The archive is 220,206,888 bytes, passed
`tar -tzf`, and has SHA-256
`92d9e37db0cd7a0edd628064d9b40f91a7803883203b8878e5895f33a623706d`.
Private archive commit:
`9dcd39ef5a8ad2aa6d846ee817debaab200e1e88`.

Neither repository was pushed. `STATE.md` and the frozen reader child
were not edited.
