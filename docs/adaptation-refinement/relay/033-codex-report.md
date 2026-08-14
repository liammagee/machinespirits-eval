# 033 — Codex report: contract v3.2 licensed; seed 511 incomplete

**Date:** 12 August 2026  
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`  
**Authority:** direction 032, unattended note 023, and the human ruling recorded by 032

## Ruling

**STOP for the reviewer. Do not launch seeds 512–514.**

Contract v3.2 was implemented and committed at `3e758071`, passed its
zero-call licensing chain, and licensed seed 511. The matrix launched at that
exact clean commit. Twenty-two of 24 children sealed complete eight-turn
dialogues. Both fast-learner/intervening children deterministically stopped
after a tutor draft failed the existing `invalid_turn_progression_contract`;
an exact immutable retry reproduced both failures.

The completed-dialogue evidence is descriptively inside the registered
coverage ceiling, but the required 24-dialogue matrix is incomplete and no
matrix-gate ruling is possible. The parent also cannot freeze the reader packet:
the partial generic-event catalogue has no public identifiers and fails the
downstream non-empty-catalogue assertion. Direction 032 licenses reserve seeds
after a seed-511 **coverage halt** only under an already committed repair with
a <=15% replay. This is an incomplete operational state, not a coverage halt,
so seed 512 is not licensed by the written record.

The required rates are:

- **halfway checkpoint:** 1/96 unanalyzed = **1.04%**;
- **final descriptive rate:** 6/176 unanalyzed = **3.41%** (170/176 analyzed,
  96.59% coverage) across the 22 completed dialogues.

## Contract v3.2 and amendment disclosure

Commit `3e7580710eb5367eeb924498fab04f2ebd8057cd` implements direction 032
exactly:

- `unspecified` is valid slot-locally whenever that slot expects a catalogue
  ID, without request-list membership or paired-slot conditions;
- a sentinel in a none/forbidden slot is stripped, recorded as a normalization
  note, and never made fatal;
- empty IDs remain invalid, sentinel targets cannot name public identifiers,
  and literal-span, public-identifier, atomicity, and other strict rules remain;
- generated, live, and annotation prose share the exact declared sentence;
- the three guards cover taxonomy-wide encodability, exact prose agreement,
  and normalization/catalogue/empty-ID behavior.

This is the disclosed amendment chain: **v3.0 -> v3.1** (the two rules in
direction 030) **-> v3.2** (defect-ledger entry 6, direction 032).

## Zero-call licensing chain

1. Focused v3.2 tests: **179/179 passed** across six suites, including all
   three direction-032 guards.
2. Seed-510 replay under committed v3.2: **5/185 discarded = 2.70%**, passing
   the <=15% licensing boundary. Artifact:
   `/private/tmp/adaptive-warrant-v32-s510-replay-3e758071.json`.
3. Instrument preflight: **42/42 passed**, `instrument_ready`, with byte-exact
   probe/live parity. Artifact:
   `/private/tmp/adaptive-warrant-v3-preflight-3e758071-v32-s511.json`.
4. Provider-schema carryover validated locally with zero new calls. The exact
   schema digest remained
   `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`.
5. The exact live launcher preflights passed: 35-world quality, 22/22 prompt
   and world tests, and 196/196 mechanism/integrity tests.
6. The dry matrix closed 24/24 jobs and fixed seed 511, 24 dialogues, the
   1,536-call maximum, exact commit, exclusion set, and source hashes. Launch
   authorization digest:
   `e29eb55e4040b679c7ba5406a574d5a2c34131c42fc718f3c335f44352169ef5`.

## Seed-511 evidence

Study root:
`/private/tmp/adaptive-warrant-v3-matrix-live-3e758071-v32-s511`.

- 22 complete children, 2 incomplete children;
- 176 completed analysis turns: 170 analyzed, 6 unanalyzed;
- no prompt-audit overflow, transport loss, or v3.2 sentinel-encodability
  failure among completed turns;
- residual causes: four non-atomic overlaps, one non-public target identifier,
  and one sentinel target carrying forbidden public identifiers;
- both incomplete children failed the tutor progression guard, not the
  semantic-event validator;
- the first pass and immutable retries failed on the same two
  fast-learner/intervening cells;
- no semantic readers, decision readers, scoring, outcome run, or reserve seed
  was started.

The parent `study-results.json` remains deliberately typed `running`: it is a
descriptive 24-row snapshot, not an admitted complete study. Its SHA-256 is
`38e7a38ab0d39120830fa41a928dd5943f6b4f60897c6a6d4b6971274e9b8192`.
The two first-attempt failed draws were preserved at
`/private/tmp/adaptive-warrant-v3-matrix-live-3e758071-v32-s511-failed-draws`.

## Principal artifact digests

| Artifact | SHA-256 |
|---|---|
| v3.2 seed-510 replay | `601a3ccfd593eabcfe395aecb9d460babb6e11cddc49d9a3a74f2a10ccaf2e95` |
| seed-511 semantic preflight | `fb4d6f45153403eec730b6fdcbfe38ee22bc966a21ebcedccbb0e280da6b636b` |
| schema-acceptance carryover | `a3a056d9217ae3c014684745899e492b9468a5366215b871f0788b95aca4a5bb` |
| launch authorization | `52d2f23ee7e600d2a92c3d4469a427e5d1e366fb587fd4a1fa8811f857175d3a` |
| partial study results | `38e7a38ab0d39120830fa41a928dd5943f6b4f60897c6a6d4b6971274e9b8192` |

## Calls spent

Seed 511 and its two exact operational retries used **569 provider calls**:
555 in the current child directories and 14 in the preserved first-attempt
failed draws. The unattended running total is therefore **2,242 / 4,000**
calls (1,673 before direction 032 plus 569 here). Tests, preflights, dry runs,
schema carryover, replay, aggregation, and diagnosis were zero-call.

Requested training reuse was on; effective training reuse was off/not
applicable because this was the automated-only route.

## Required next ruling

The reviewer must choose whether to authorize a prospective, guarded repair of
the deterministic tutor progression failure and the partial generic reader
catalogue, and must explicitly state whether that licenses seed 512. No
semantic-contract or rubric relaxation is proposed here, and no reserve is
spent without that ruling.
