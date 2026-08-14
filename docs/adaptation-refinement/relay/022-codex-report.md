# 022 — Codex report: prompt-parity and analysis-seat probes fail the relaunch gate

**Date:** 12 August 2026  
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`  
**Direction:** `021-reviewer-direction-prompt-parity.md`

## Boundary reached

**STOP for human review.** Both predeclared diagnostic probes exceeded the
strict `discard_rate <= 0.10` relaunch threshold. Seed 506 was not launched.
No representative-matrix, reader, decision-reader, or outcome-study calls were
made.

This is a live semantic-event extraction failure under the settled contract,
not a reader disagreement, contract ambiguity, provider transport failure, or
binary decision-layer result. The 48 preserved seed-505 turns and both probe
outputs remain diagnostic-only, permanently excluded from scoring, pooling,
and claims.

## Prospective amendments

1. `96bada6e11a0557b17d6a5cee38983a575ac3618` — `Port V3 handbook rules into live analysis`
   - registered and selected `handbook_v1`;
   - copied the frozen handbook's authorized multiplicity, target, empty-set,
     executor, tie, catalog-ID, and literal/unique/non-overlap span rules into
     the existing per-turn learner-analysis prompt;
   - preserved `compact_v1`;
   - added a 48-turn live-seat diagnostic probe and prompt/handbook digest
     parity to the zero-call preflight.
2. `39757d4e68520e042551d4429eb102bb257575fa` — `Upgrade V3 learner-analysis seat to Sonnet`
   - froze learner analysis at `claude-code.claude-sonnet-5`;
   - retained `codex.gpt-5.6-luna` for tutor and automated learner;
   - recorded the mixed-model seam in the study plan;
   - bound the upgraded-seat acceptance ping to the exact source commit and
     semantic preflight.

Final prospective child-policy SHA-256:
`780b89ac38f335efd185a4b67648f2db11e134f79d3b8e9173fb92fd7168f087`.

The ported handbook block digest was identical at the frozen handbook and live
prompt boundaries:
`0fa551278fa1f3a2324aa31e255f421d7182ca975178b0cdd1fec2eed668207f`.

## Validation and size boundary

- Handbook implementation checkpoint: 168 focused tests passed, zero failed;
  `git diff --check` clean for the scoped changes.
- Analysis-seat amendment checkpoint: 59 focused tests passed, zero failed;
  `git diff --check` clean for the scoped changes.
- Exact-commit preflight at `39757d4e`: 37/37 checks passed,
  `instrument_ready`.
  - artifact: `/private/tmp/adaptive-warrant-v3-preflight-39757d4e.json`
  - SHA-256: `145e9faf7fa7feab36b6c937617e2cf2df73cceee2228992273a391d9d22b11a`
- The audited 48 prompts remained inside the frozen 42,000-character and
  10,500-approximate-token envelope: maximum 41,847 characters and 10,462
  approximate tokens.

No diagnostic corpus freeze was created, so the full-suite-at-freeze rule was
not reached.

## Probe 1 — Luna with handbook parity

- model: `codex.gpt-5.6-luna`
- commit: `96bada6e11a0557b17d6a5cee38983a575ac3618`
- source: six preserved seed-505 traces, 48 learner turns
- source commit: `a4529e798012b2fb0366fea30fc2a0798b3a69ab`
- source closure SHA-256:
  `60124bc8910b54bbebde7db2a17a9d458edfaf220622d0791a01707236046ffc`
- calls: 48 attempted, 48 completed, zero retries
- survives: 43
- discarded: 5
- discard rate: **5/48 = 10.4167%**
- gate: **FAIL** (`10.4167% > 10%`)
- artifact:
  `/private/tmp/adaptive-warrant-v3-handbook-probe-96bada6e-luna/diagnostic-probe.json`
- artifact SHA-256:
  `cedd48f131ce97c58b53aeee7448a8aa7e53c7bfd59256964dfab7fe42e8b1c2`

Residual issues across the five discarded calls:

| Residual issue | Count |
|---|---:|
| event 0 non-request carried forbidden value/component sets | 1 |
| event 1 non-request carried forbidden value/component sets | 2 |
| event 0 evidence span was not literal | 1 |
| event 1 required `target_id` was absent | 1 |

The strict threshold therefore activated the pre-authorized analysis-seat
upgrade; it did not permit a seed-506 launch.

## Upgraded-seat acceptance ping

- model: `claude-code.claude-sonnet-5`
- calls: 1 attempted, 1 completed
- result: passed
- structured output: true
- prohibited tool events: zero
- permanently excluded synthetic transport case: true
- source commit and preflight digest: matched
- artifact:
  `/private/tmp/adaptive-warrant-v3-sonnet-ping-39757d4e/acceptance-ping.json`
- artifact SHA-256:
  `5f6a4db8c8f4814bb253faea9ccb3506f4735ae1cbb1c4888f1287db81c912d0`

The ping rules out provider/schema rejection at the transport boundary; it does
not attest semantic extraction quality.

## Probe 2 — Sonnet analysis seat

- model: `claude-code.claude-sonnet-5`
- commit: `39757d4e68520e042551d4429eb102bb257575fa`
- same 48 preserved turns and same source closure as probe 1
- calls: 48 attempted, 48 completed, zero retries
- survives: 23
- discarded: 25
- discard rate: **25/48 = 52.0833%**
- gate: **FAIL** (`52.0833% > 10%`)
- artifact:
  `/private/tmp/adaptive-warrant-v3-handbook-probe-39757d4e-sonnet/diagnostic-probe.json`
- artifact SHA-256:
  `a4400a167244db95469fe34689aac83b73c7d4a4c09de8486cefb191a414b42a`

Residual issues across the 25 discarded calls (30 issues total):

| Residual issue | Count |
|---|---:|
| event 0 non-request carried forbidden value/component sets | 10 |
| event 1 non-request carried forbidden value/component sets | 9 |
| event 0 evidence span was not literal | 8 |
| event 1 evidence span was not literal | 3 |

The stronger analysis seat was materially worse on the fixed diagnostic: its
discard rate rose from 10.4167% to 52.0833%. The failures remain concentrated
in the two handbook rules already exposed to the live seat—empty value fields
on non-request acts and literal evidence spans. Because the acceptance ping
passed and the preflight proves prompt/handbook parity, this result is
classified as failure of the live generative extraction seat to reliably
realize the settled typed output contract on these turns. It is not evidence
about downstream warrant decisions, which were never run.

## Budget and disposition

- probe calls: 96/96
- upgraded-seat ping calls: 1/1
- total model calls: **97**
- matrix calls: zero

Direction 021's budget is exhausted and its second-probe hard stop is active.
Awaiting reviewer sign-off; seed 506 and reserve seeds 507–510 remain unused.
