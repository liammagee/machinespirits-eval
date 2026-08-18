# Resistant Learner Profile Discrimination — Study GO Request

**Prepared:** 18 August 2026.
**Status:** **HOLD — awaiting explicit human approval of the exact request and
model-call ceiling.**
**Workplan item:** `resistance-action-register-integration`.

The machine-readable request is
`config/tutor-stub-resistant-profile-discrimination-study-go-request.v1.json`.
It is deliberately non-executable: both authorization booleans remain false,
and the validator below makes zero model calls and zero production writes.

```bash
npm run tutor:stub:resistant-profile-study-go -- --json
```

## Exact study requested

- Launch source: clean detached checkout at
  `f95e245c8ef9dab1b9b3da374508f6efd6e90006`, selected from `origin/main`.
- Design: six learner profiles, one `field` policy, three runs per profile,
  eight turns per dialogue, giving 18 automated dialogues.
- Models: `codex.gpt-5.6-luna` for tutor, analysis, and learner, at low effort.
- Concurrency: three dialogues.
- Destination:
  `.tutor-stub-auto-eval/resistant-profile-discrimination-v1-live-2026-08-19`,
  create-once and absent when this request was prepared.
- Ceiling: 48 attempts per dialogue, 864 model attempts total.
- Retry/resume authority: none. A technical failure stops the study and
  requires review, a new sealed destination, and new approval.
- Payload: repository-authored automated material only; no human-subject or
  private-archive data. Training reuse is not applicable.

The closest preserved operational analogue—18 Luna dialogues of eight turns—
used 464 calls and 119.4 serial minutes. At the registered parallelism of
three, generation is expected to take about 45–60 minutes; reserve 75 attended
minutes. The registered analysis should take another 1–3 minutes. This timing
is operational planning, not an endpoint or outcome claim.

## What approval would authorize

Approval must name the exact SHA-256 printed by the committed request validator
and the 864-attempt ceiling. It authorizes one execution of the pinned live
command from the pinned clean source, followed by the already registered
zero-model profile-discrimination analysis.

The approval will be recorded in a separate one-shot execution authorization;
this request remains non-executable. No model call occurs merely because the
request is merged or approved in chat.

It does not authorize a retry, resume, enlarged matrix, alternate model,
alternate destination, negative-register experiment, rejudging, pooling, or
modification of the existing `low_agency` and `overconfident` evidence.

Until that exact approval is received and recorded, do not execute the live
command. This document itself is not approval.
