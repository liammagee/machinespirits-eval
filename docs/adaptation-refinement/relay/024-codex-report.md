# 024 — Codex report: Direction 022 schema-acceptance guard stop

**Date:** 12 August 2026
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`
**Direction:** `022-reviewer-direction-luna-coverage-note.md`
**Unattended envelope:** `023-reviewer-note-unattended-mode.md`

## Boundary reached

**STOP at the schema-acceptance guard.** The exact frozen Luna call returned a
schema-valid response that passed strict parsing, but the parsed value was not
byte-equivalent to the supplied synthetic response template. The runner raised:

`schema-acceptance live response template mismatch`

No representative-matrix dialogue, annotation reader, decision reader, or
outcome-study call was launched. Seed 506 remains unused rather than burned:
the failure occurred in the permanently excluded synthetic transport ping,
before any matrix artifact existed.

This is classified as a schema-acceptance/template-realization failure, not a
semantic-contract disagreement and not evidence about the matrix. The ping
runner currently writes a fail-closed summary but does not retain the model's
raw or parsed response on a template mismatch. Consequently the exact differing
field is unavailable without an unauthorized second call. The result artifact's
generic status says `provider_rejected_or_failed_before_accepted_response` and
`response_received: false`; control flow proves more narrowly that a response
was returned and strictly parsed before the equality check failed. That
reporting limitation is recorded here and no inference is made beyond it.

## Prospective implementation commits

1. `3c3911cc57816b7b850c5bdddc5e2e5190a39504` — `Amend V3 analysis coverage and quote matching`
   - restored the learner-analysis seat to `codex.gpt-5.6-luna` with
     `handbook_v1`;
   - added the shared U+2018/U+2019 and U+201C/U+201D quote-punctuation
     normalization to both live and reader span derivation;
   - preserved original text and UTF-16 offsets and failed closed on normalized
     duplicates;
   - moved the registered running coverage halt to `>= 0.15` after ten turns,
     while retaining the first-call hard stop;
   - excluded unanalyzed turns from tutor projection, parity, delivery,
     annotation, and scoring denominators and added overall/per-dialogue
     coverage reporting and a quoted gate ruling;
   - froze seed 506 and added seed 505 plus both Direction 021 probes to the
     required exclusion set.
2. `6e4ecab3a6c93e2881fda1f11d2ed06003563f94` — `Refresh learner-analysis help snapshot`
   - corrected the pre-existing byte-stable CLI-help snapshot after Direction
     021 added `handbook_v1`;
   - added an explicit handbook-profile help assertion.

The user-owned deleted bytecode file and untracked `.agents/skills` directories
were not staged or altered.

## Validation

- Direction 022 focused slice: 134/134 tests passed.
- Stale help-snapshot repair: 2/2 targeted tests passed.
- Exact-commit full suite at `6e4ecab3`:
  - root: 8,509/8,509 passed;
  - in-housed tutor-core: 137/137 passed.
- An earlier sandboxed suite was non-evidential because loopback listeners were
  denied with `listen EPERM 127.0.0.1`; the valid full suite above ran with the
  required loopback capability.
- Exact-commit zero-call preflight: 38/38 checks passed,
  `instrument_ready`, zero model calls.
  - path: `/private/tmp/adaptive-warrant-v3-preflight-6e4ecab3-s506.json`
  - SHA-256: `c2e7b594d18bfd968d0475529712f4651e8a1164a71513fc05a4d745d375ddd1`
  - source commit: `6e4ecab3a6c93e2881fda1f11d2ed06003563f94`
  - extraction schema digest:
    `41785a0efd628535541e45473697d2d9ebbc25b8f06d49dae3b0fe08523b6919`
  - reader schema digest:
    `501ccd45e9fccfecafc5ac8cc83ade98a07f40b7f9298b634a1995408449d254`

## Schema-acceptance ping

- destination: OpenAI Codex CLI, ChatGPT-account route
- model: `codex.gpt-5.6-luna`
- effort: `medium`
- authorization approval digest:
  `bfbcb879bb8c4a4b580ad73e05f32f0049c999a6e437ec573ac92875730f8320`
- calls: 1 attempted, 0 accepted by the ping harness, maximum 1
- prohibited tool events: zero reported
- synthetic case: permanently excluded from research evidence
- result: **FAIL — template mismatch**

Frozen packet artifacts:

| Artifact | SHA-256 |
|---|---|
| `schema-acceptance-freeze.json` | `20094a1617cc138272ac196140b0bf763de88da672115f1aa5feddce649ff8e2` |
| `schema-acceptance-authorization-request.json` | `fc6e3939b0ef4d014c20506c5fa55443fc51b42fa34b4ea7700540cb2cffc8fe` |
| `synthetic-schema-acceptance-corpus.json` | `4101cd49bc83623a6c793281ae13b77cf04ed5d11906fefdcac9ef64a6804ad6` |
| `schema-acceptance.packet.json` | `136b4b289b4911d6c08ea925927ede77b397c13c37c08b3a4cdb42dba041f2cb` |
| `response.schema.json` | `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1` |

Fail-closed result:

- path:
  `/private/tmp/adaptive-warrant-v3-schema-ping-live-6e4ecab3-s506/schema-acceptance-result.json`
- SHA-256:
  `03b1c96ab7e30a839574cfcad12d0343df21707b07d3e6cbae97e15a2e847bd3`

## Budget and disposition

- Direction 022 / unattended-note-023 calls spent: **1**
- representative-matrix calls: **0**
- reader calls: **0**
- outcome calls: **0**

The current direction's acceptance guard has ruled, so the driver is stopped
with all evidence preserved. The next safe step requires reviewer direction on
whether to make the ping diagnostic retain the returned parsed/raw response and
whether exact template identity is the intended transport criterion. No
semantic contract, rubric, certified instrument, threshold, or matrix datum was
changed after the guard fired.
