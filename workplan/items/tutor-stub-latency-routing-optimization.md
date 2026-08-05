---
id: tutor-stub-latency-routing-optimization
title: "Optimize tutor-stub foreground latency with attributable routing experiments"
status: done
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-07-24
updated: 2026-08-05
verification: "A frozen object/meta/mixed transcript matrix reports first-draft acceptance, recovery/fallback rate, foreground p50/p95 latency, model-call latency, token use, and tutor-quality/safety outcomes for isolated effort, role-routing, prompt-compaction, and prefetch-policy contrasts; no candidate becomes a default without preserving the instructional-meta regression and public-safety gates."
claim_status: exploratory
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/201
    - https://github.com/liammagee/machinespirits-eval/pull/496
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

2026-08-05 Codex: Reconciled after confirming PR #201 merged and its branch is
no longer active. The one-draw matrix did not justify a default change; repeated
draws remain contingent on repairing or explicitly rescoring the mixed-plane
classifier contract. Returned to triage rather than presenting dormant paid
follow-up work as active execution.

2026-08-05 Codex: Reactivated from current `origin/main` after closing the
merged superego-framing analysis and the saturated contract-outcome endpoint.
The first slice is model-free: make the mixed-plane benchmark contract
internally coherent and re-score the frozen matrix before any repeated paid
draws or default-routing proposal.

2026-08-05 Codex: Repaired the measurement prerequisite without model calls.
The v1 resolver did not recognize the frozen mixed turn's imperative “explain
baseline in plain English” form or its separate object-level proposal, so all
variants were structurally liable to read the case as object. Discourse-plane
v2 adds clause-aware, bounded surface recognition; benchmark config validation
now fails closed unless every declared plane resolves deterministically; dry
runs expose the contract; and report v2 separates the plane used at runtime
from current zero-model rescoring. The focused latency/discourse suite passes
21/21 and the wider tutor-stub human-discourse CLI suite passes 43/43. This
clears the measurement gate only. Repeated paid draws and any default change
remain outstanding and separately gated.

2026-08-05 Codex: Froze the next paid step without launching it:
`config/tutor-stub-latency-benchmark-v2-screen.yaml` is a 36-job screen (three
draws each for object, instructional-meta, and mixed turns across baseline,
low effort, Terra analysis, and analysis-only tutor prefetch). The regressive
`compact_v1` prompt is excluded rather than paid for again. This screen is not
a promotion run: it can reject candidates or nominate one for confirmation,
but cannot by itself change the default. External model calls remain
unauthorized in this branch.

2026-08-05 Codex: Completed the explicitly authorized 36-job v2 screen at
source `d0886eec5b71cdec37faaa63fa477a6ea4b3cbf0`. All 36 planned job IDs were
attempted exactly once; 34 delivered a guarded tutor turn and two mixed jobs
failed closed without public delivery. Across delivered jobs, every final
delivery passed the public-safety checks. The screen did not justify changing
any default:

- baseline medium/Sol: 8/9 delivered, foreground p50 38,136ms and p95
  49,687ms, 87.5% recovery and 12.5% deterministic fallback;
- low effort/Sol: 9/9 delivered, p50 34,036ms and p95 49,635ms, 77.8%
  recovery and 22.2% fallback;
- medium/Terra analysis: 9/9 delivered, p50 29,844ms and p95 46,270ms, 100%
  recovery and 55.6% fallback;
- analysis-only tutor prefetch: 8/9 delivered, p50 32,220ms and p95 57,676ms,
  75% recovery and 37.5% fallback.

Low effort remains at most a prospective confirmation candidate: its median
gain was modest, its p95 was unchanged, and fallback use increased. Terra
analysis and analysis-only prefetch are rejected by this screen. This remains
an exploratory engineering result, not a treatment effect or human-learning
claim. The frozen 36-job authorization is exhausted; no rerun is implied.

The two failures were contract failures rather than provider, quota, or safety
leak failures. A mixed plain-language repair plus unsupported object proposal
compiled a bounded-choice requirement alongside a declarative no-question
handoff. Recovery satisfied one side and violated the other; the terminal
fallback satisfied the declarative boundary but omitted the choice. The
model-free repair now compiles the choice as a declarative list, carries an
authored public glossary definition into the Campus FAQ fallback, and keeps the
unsupported proposal open. The benchmark runner now checkpoints after every
attempt, records failed jobs separately, continues through the frozen plan, and
still exits non-zero when any job failed. Focused compiler, fallback,
progression, response-composition, and benchmark tests pass without model
calls. Live confirmation remains separately gated and is not required to retain
the no-default verdict.

2026-08-05 Codex: Closed after PR #496 passed CI and merged. The bounded screen
and its contract repair satisfy the declared verification while retaining the
registered no-default verdict; the merged branch and worktree were removed.
