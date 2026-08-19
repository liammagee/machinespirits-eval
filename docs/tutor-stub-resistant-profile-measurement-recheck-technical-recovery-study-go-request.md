# Resistant Learner Profile Measurement Recheck — Technical Recovery GO Request

**Prepared:** 19 August 2026.
**Status:** **HOLD — awaiting explicit human approval of the exact request and
model-call ceiling.**
**Workplan item:** `resistance-action-register-integration`.

The non-executable request is
`config/tutor-stub-resistant-profile-measurement-recheck-technical-recovery-study-go-request.v1.json`.
Its frozen SHA-256 is
`34e78c0753c1da34fd9fbc8865bb69a437adf383ad2867c24c2458ab869fdbab`.
It records no human approval and authorizes neither model calls nor a live run.
Its existing zero-call validator is:

```bash
node scripts/check-tutor-stub-resistant-profile-study-go-request.js \
  --request config/tutor-stub-resistant-profile-measurement-recheck-technical-recovery-study-go-request.v1.json \
  --json
```

## Recovery basis

The approved request at SHA-256
`c2176e17c403824c0566ccb86d167fad21c56be405291025f09f233c3a8ea26d`
was invoked once and failed during module loading because the detached
worktree lacked the installed `yaml` dependency. It made zero model calls,
created no requested destination, and produced no study dialogue.

The detached checkout now reuses an installed dependency tree whose
`package.json` and `package-lock.json` exactly match the pinned launch source.
A safe import of `yaml` and `services/evalConfigLoader.js` passes with zero
model calls. The package files are now part of the request's source closure.

During preparation, importing the executable QA runner mistakenly started its
default matrix. It was terminated after 29 completed Luna calls and six
interrupted reservations, with zero completed trials. Those artifacts remain
preserved under
`.tutor-stub-auto-eval/qa-matrix-2026-08-19T04-49-59-981Z`, are outside the
registered design, and are explicitly ineligible for reuse, resume, analysis,
or study assembly.

## Why a fresh cohort is required

The registered Phase 2 result remains a failure. Its canonical local report is
unchanged at SHA-256
`06d7bbc49df46e2f20ebeb3eb0141dba975825ce10bf33eef0e0dc15540ec32c`.
The later zero-call audit corrected the prospective boredom observer, included
both resistant-profile markers in the behavior vector, and made
nearest-neighbor evaluation fail closed when an anchor misses the unchanged
`0.40` signature floor. Replaying the exact old traces then failed at anchor
viability, because the historical `low_agency`, `skeptical`, and
`low_trust_skeptic` anchors did not clear that floor.

The recheck therefore generates all six profiles afresh. It does not reuse old
traces, change a threshold, pool cohorts, or rewrite the negative result.

## Frozen execution

- Source: clean detached checkout at
  `0f7ff1b3d0e1ca0146a519f06914f3d6e1cdcd4d`, current `origin/main` when
  prepared and containing measurement-audit merge `4a01ea0d5f58eacd33349405536ec130792e58eb`.
- Design: `diligent`, `low_agency`, `bored`, `skeptical`,
  `low_trust_skeptic`, and `frame_defiant`; one `field` policy; three runs per
  profile; eight turns per dialogue; 18 dialogues total.
- Models: `codex.gpt-5.6-luna` for tutor, analysis, and learner, at low effort.
- Destination:
  `.tutor-stub-auto-eval/resistant-profile-discrimination-v3-measurement-recheck-technical-recovery-live-2026-08-19`,
  create-once and currently absent.
- Ceiling: 48 attempts per dialogue, 864 planned model attempts total, with
  parallelism three.
- Retry/resume authority: bounded technical recovery only. It may recover only
  missing or failed units without changing source, route, design, data scope,
  seed, configuration, rubric, or the unchanged 864-attempt ceiling; valid
  outputs may never be rerun or selected among.

The post-run command enumerates only files matching
`*/traces/*/*.jsonl`; it does not recursively admit `run-events.jsonl`.
The analyzer still requires exactly 18 traces, the exact six-profile set,
three runs per profile, eight turns, the `field` policy, and all three model
pins before reporting a result.

The existing endpoint contract and one-call Luna route canary are reused. The
zero-call endpoint preflight retains its certified digest. Its completeness
check now correctly accepts either boolean value of
`nearestNeighborEvaluable`; only a missing/non-boolean measurement makes the
endpoint incomplete. This does not alter any empirical threshold or make the
synthetic fixture count as a passing study outcome.

## Approval boundary

After this request is committed and merged, its validator will print the exact
SHA-bound approval sentence. Approval authorizes one execution of the frozen
live command followed by the zero-call analyzer. The standing recovery policy
permits only bounded technical recovery inside that authorization; it does not
authorize an alternate model or design, threshold change, register experiment,
rejudging, or modification of the protected `low_agency` and `overconfident`
evidence.

No paid call occurs merely because this request is merged or approved in chat.
A separate one-shot execution authorization must consume the exact approval.
