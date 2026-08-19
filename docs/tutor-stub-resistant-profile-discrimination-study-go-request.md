# Resistant Learner Profile Discrimination — Study GO Request

**Prepared:** 19 August 2026.
**Status:** **HOLD — awaiting explicit human approval of the exact request and
model-call ceiling.**
**Workplan item:** `resistance-action-register-integration`.

The machine-readable request is
`config/tutor-stub-resistant-profile-discrimination-study-go-request.v1.json`.
It is deliberately non-executable: both authorization booleans remain false,
and the validator below makes zero model calls and zero production writes.

```bash
node scripts/check-tutor-stub-resistant-profile-study-go-request.js --json
```

## Exact study requested

- Launch source: clean detached checkout at
  `ae940515978030c7f9db1ea72c4c42a647034272`, selected from `origin/main`
  after PR #667 merged the resistant-marker runtime correction.
- Design: six learner profiles, one `field` policy, three runs per profile,
  eight turns per dialogue, giving 18 automated dialogues.
- Models: `codex.gpt-5.6-luna` for tutor, analysis, and learner, at low effort.
- Concurrency: three dialogues.
- Destination:
  `.tutor-stub-auto-eval/resistant-profile-discrimination-v1-live-2026-08-19`,
  create-once and absent inside the new detached launch worktree when this
  request was prepared. The stopped worktree's distinct absolute artifact root
  is preserved and is not copied or resumed.
- Ceiling: 48 attempts per dialogue, 864 model attempts total.
- Retry/resume authority: none. A technical failure stops the study and
  requires review, a new sealed destination, and new approval.
- Payload: repository-authored automated material only; no human-subject or
  private-archive data. Training reuse is not applicable.

## Replacement basis

The first authorization, bound to request SHA-256
`8fe73f401ccea68f73a2b9ad0087eda9b5c89913a2602d61e22cb5c7ebe51b3a`,
was consumed and then stopped on technical failure with no retry or resume.
The adherence matcher did not expose the two derived public resistant-profile
markers, so valid bored drafts were repeatedly sent through repair until one
dialogue exhausted its 48-call ceiling. PR #667 connected the already-existing
deterministic markers to the runtime and added a focused regression for both
`bored` and `frame_defiant`; all GitHub CI checks passed before merge.

This request binds the repaired runtime file into the executable source closure
for the first time. It authorizes neither reuse of the six completed control
dialogues nor continuation of any partial bored dialogue.

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
