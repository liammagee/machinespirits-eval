# 026 — Codex report: Direction 025 retry retained a canonical-value mismatch

**Date:** 12 August 2026
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`
**Direction:** `025-reviewer-direction-ping-criterion.md`
**Unattended envelope:** `023-reviewer-note-unattended-mode.md`

## Boundary reached

**STOP at Direction 025's retry-ping failure boundary.** The one authorized
retry returned a structured-output response with zero prohibited tool events.
Strict parsing and the live validator both accepted it. Canonical-value
comparison then found the first differing field at:

`$.semantic_events.extraction_status`

The returned parsed `semantic_events` value was `{"events":[]}`; the synthetic
template expected the additional `extraction_status: "accepted"` value (and its
other template fields). This is a genuine missing-value difference under
Direction 025's criterion, not key-order, serialization-byte, or punctuation
trivia. The harness status is truthfully
`parsed_response_canonical_value_mismatch`, with
`response_received: true`, `strict_parse_succeeded: true`,
`validator_accepted: true`, and `canonical_value_match: false`.

No seed-506 representative-matrix dialogue, semantic reader, decision reader,
or outcome-study call was launched. Seed 506 remains unused rather than burned:
the failure occurred in the permanently excluded synthetic transport ping.
There is no reader disagreement or contract-ambiguity classification because no
reader judgment occurred.

## Ping-harness repair

Commit `176e9adf034eedd37e77f58ff2700a0bc1715969` (`Repair schema acceptance
value comparison`) implements Direction 025's timebox-class repair:

- canonical recursive comparison ignores object key order and serialization
  bytes;
- strings use the validator's shared typographic-quote normalization;
- a true missing or changed value fails with its first field path;
- raw response text is retained before strict parsing;
- parsed response JSON is retained before canonical-value comparison;
- failure artifacts report the actual response, parse, validator, and
  comparison states;
- the zero-call preflight asserts response retention and truthful status.

Focused tests passed **70/70**, including canonical key-order and punctuation
equivalence, a true changed-value failure, retained raw/parsed mismatch
evidence, matrix coverage guards, source closure, and route integrity.

The branch checkout's pre-existing deleted bytecode and untracked
`.agents/skills` directories were not staged or altered. Exact-source execution
used the clean detached worktree
`/private/tmp/ms-adaptation-refinement-176e9adf.xrL5ng`.

## Exact-commit preflight

- status: `passed`, `instrument_ready`
- checks: 39/39 passed
- path: `/private/tmp/adaptive-warrant-v3-preflight-176e9adf-s506.json`
- SHA-256:
  `00074bf5ffe55029c551090c68c7b1ea385310494988eeb535c3b02d2ba1d480`
- source commit: `176e9adf034eedd37e77f58ff2700a0bc1715969`
- extraction schema digest:
  `41785a0efd628535541e45473697d2d9ebbc25b8f06d49dae3b0fe08523b6919`
- reader schema digest:
  `7c265df6592f9e84224340f35bb8d1948732eecc682bb1b31ef98f51d9f8ae4d`

## Retry ping

- destination: OpenAI Codex CLI, ChatGPT-account route
- executable: `codex-cli 0.147.0`
- model: `codex.gpt-5.6-luna`
- effort: `medium`
- authorization approval digest:
  `d7d9f6d59b5a6c64ade76bb83a3ecf889dc7cc5656671056eb00503083d0f0cc`
- calls: 1 attempted, response returned, 0 accepted by the ping harness,
  maximum 1
- prohibited tool events: zero
- synthetic case: permanently excluded from research evidence
- result: **FAIL — canonical value missing at
  `$.semantic_events.extraction_status`**

Frozen packet artifacts:

| Artifact | SHA-256 |
|---|---|
| `schema-acceptance-freeze.json` | `a3593cb3c004e7b1722ecec2ada829a68af8e4601fddf9a148de6cd1a82f8c5d` |
| `schema-acceptance-authorization-request.json` | `60d654abb49dcdab57f2bab0121986733f99a79ada4d519e53ee936fafa96ed6` |
| `synthetic-schema-acceptance-corpus.json` | `a6144a79e60cfcf0962aaef82c5abc718be9c1cef613613de6da01025b96e2a1` |
| `schema-acceptance.packet.json` | `93d77d24e467e647c12ccd21017191c5fbc95a6aeb3a214ad411b73cb1edae3a` |
| `response.schema.json` | `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1` |

Retained retry evidence:

| Artifact | SHA-256 |
|---|---|
| `schema-acceptance-result.json` | `78a80cc69d66a12fa6545d8e0ec0a85bdb8764bcc958e63995228211be7a7bf6` |
| `schema-acceptance.response.raw.txt` | `ffd3469c76d4d4f9cdcd8cb18aefa785ce4d56e735faccaa4da8796185a0f43f` |
| `schema-acceptance.response.json` | `44636afde47d4be7994a78dc4d2f06c0f70eaba0e0c29cfd190aef2cba425501` |

The retained evidence directory is
`/private/tmp/adaptive-warrant-v3-schema-ping-live-176e9adf-s506-retry/`.

## Budget and disposition

- Direction 025 retry calls: **1**
- unattended-note-023 running total: **2 of 4,000**
- representative-matrix calls: **0**
- reader calls: **0**
- outcome calls: **0**

Direction 025 explicitly orders a stop on retry failure. The driver is waiting
for the reviewer to rule on the retained missing-value evidence. No semantic
contract, rubric, certified instrument, matrix datum, or seed was changed after
the guard fired.
