---
id: tutor-stub-latency-routing-optimization
title: "Optimize tutor-stub foreground latency with attributable routing experiments"
status: active
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-07-24
updated: 2026-07-24
verification: "A frozen object/meta/mixed transcript matrix reports first-draft acceptance, recovery/fallback rate, foreground p50/p95 latency, model-call latency, token use, and tutor-quality/safety outcomes for isolated effort, role-routing, prompt-compaction, and prefetch-policy contrasts; no candidate becomes a default without preserving the instructional-meta regression and public-safety gates."
branch: codex/tutor-stub-latency-routing
claim_status: exploratory
links:
  notes:
    - notes/2026-07-24-tutor-stub-latency-and-discourse-plane.md
  items:
    - tutor-stub-dialogue-first-terminal-presentation
tags:
  - tutor-stub
  - latency
  - model-routing
  - discourse-plane
  - mixed-mode
---

Run the remaining optimization candidates from the linked diagnostic as
separate, attributable contrasts. The instructional-metalanguage behavior fix
is already on `main`; this item treats it as an invariant and does not reopen it
as a prompt-only rewrite.

Acceptance criteria:

- Freeze representative object-language, instructional-meta, and genuinely
  mixed turns, including the source simplification turn and its saved drafts.
- Establish the current `medium`-effort, Terra-speaking/Sol-interpretation,
  compact-memory, always-prefetch baseline using the live turn-timing schema.
- Compare lower CLI reasoning effort with routing otherwise unchanged.
- Compare the combined learner-analysis role on calibrated candidate models
  while keeping the speaking tutor fixed.
- Remove only demonstrably duplicated or irrelevant prompt material; parser
  fields, public-only privilege, DAG preflight, and response checks must remain
  unchanged.
- Compare always-on tutor prefetch with delayed or acceptance-conditioned
  prefetch, reporting both foreground wait and discarded background work.
- Change one factor at a time. Promote a runtime/default change only when it
  improves latency or wasted compute without increasing classification errors,
  recovery/fallback use, safety failures, or tutor-quality loss.

2026-07-24 Codex: Promoted the remaining work from the linked diagnostic after
verifying that commit `1aeb564f` already landed the first-class discourse-plane
contract and commit `994fcfad` added the live foreground timing breakdown.

2026-07-24 Codex: Added the frozen `object` / `instructional_meta` / `mixed`
one-turn matrix, one-factor benchmark runner, trace summary metrics, opt-in
`compact_v1` learner-analysis prompt profile, and opt-in `analysis_only` mixed
tutor-prefetch policy. Defaults remain `baseline` and `always`. The compact
profile removes only the repeated public-question section and JSON indentation;
the public rules, staged evidence, DAG preflight, extraction rules, schema, and
deterministic postprocessor boundary remain present. The prefetch policy keeps
the learner suggestion and combined analysis warming but defers tutor speech to
the foreground.

Model-free validation passed the new harness tests plus the existing discourse
plane, public learner-analysis, prompt-audit, guard-accounting, mixed-mode, and
turn-timing suites. The saved 2026-07-24 source trace contains 14 speculative
tutor/recovery calls totaling 165,571ms and 177,305 tokens with no tutor-cache
hit; this supports testing `analysis_only` but is not enough to change the
default.

2026-07-24 Codex: Completed the user-approved 12-job live matrix against
`gpt-5.6-sol` and `gpt-5.6-terra` (one draw for each object,
instructional-meta, and mixed case). Public-safety delivery passed 12/12. All
four variants classified object and instructional-meta correctly but classified
the mixed case as object, for 2/3 plane accuracy; the visible tutor responses
nonetheless both explained “baseline” and addressed the interview proposal.
That distinction is retained as a classifier-contract failure rather than
reported as a safety or visible-response failure.

Against the `medium` Sol-analysis baseline (foreground p50 28,414ms; p95
39,457ms), low effort measured 20,658ms / 28,837ms, Terra analysis measured
18,385ms / 36,171ms, and `compact_v1` measured 44,205ms / 45,593ms. Low effort
raised recovery use from 2/3 to 3/3 and token use by 7.9%. Terra analysis matched
the baseline's 2/3 recovery and 1/3 fallback rates and reduced aggregate tokens
by 5.8%, but its mixed case slowed to 36,171ms and fell back. Compact prompt
characters fell 5.3%, but recovery rose to 3/3, tokens rose 9.0%, and foreground
p50 rose 55.6%. No runtime default was promoted: the sample is only one draw per
case, every route still misses the mixed-plane contract, and each apparent speed
candidate has either higher recovery or a mixed-case regression. The next
promotion gate is repeated draws after repairing or explicitly rescoring the
mixed-plane classifier contract; `analysis_only`, low effort, Terra analysis,
and `compact_v1` remain opt-in experiment controls.

During analysis, the benchmark's safety summary was found to expect the legacy
`finalDelivery.kind` field while current traces use `finalDelivery.source` plus
`auditOk`. The parser now accepts both trace shapes, the regression fixture uses
the current shape, and the saved report was reparsed locally without another
external-model call.
