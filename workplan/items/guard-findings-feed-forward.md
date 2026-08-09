---
id: guard-findings-feed-forward
title: Feed guard findings into the next turn's request instead of redrafting this one
status: dropped
type: research
priority: P3
owner: codex
source: manual
created: 2026-08-06
updated: 2026-08-10
verification: "Tested but not adopted: the sealed 12-dialogue paired A1 screen
  completed without technical failure, but feed-forward recurrence was 40.4%
  against 39.4% for control and the quality guardrails did not improve. Keep the
  mechanism opt-in and off by default; do not rerun without a new prospective
  hypothesis."
claim_status: killed
links:
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubFirstDraftContract.js
  exports:
    - exports/tutor-stub-guard-feed-forward/pilot-a1/report.md
  items:
    - guard-policy-default-flip
    - guard-validity-study
tags:
  - tutor-stub
  - guards
branch: codex/guard-findings-feed-forward
---

## The idea

The retry analysis on Phase B says the model acts on what it is told: the
rewrite cleared 70% of the findings named to it. It still failed 80% of the
time because fixing the named faults tripped unnamed checks — a same-turn
conjunction it cannot see whole. So move the signal to where the model uses
signal well: ship the turn, and put last turn's findings into the next turn's
request, one plain line each ("your last turn did not take up the learner's
words"; "you have repeated the notebook line three turns running").

This is the project's own strongest adaptivity lever — in-context signal beats
architectural correction — applied to the harness's feedback instead of the
learner's.

## Why it might fail, stated up front

Findings are about a turn that is now past; the next moment may not afford the
fix, and stale instructions could read as noise or bend the tutor toward
compliance prose. The control run exists to catch exactly that. The cost is
one instrumented pair; no new machinery beyond assembling lines the traces
already carry.

## Log

- 2026-08-10 — A1 completed at source
  `d1bd21913112c224eec5f3ee82d095475b45e525`: 12/12 dialogues sealed, all
  420 model calls used `codex.gpt-5.6-luna` through Codex, no other provider or
  committee ran, and all 12 required private-archive manifests sealed with
  source-line parity. The additive hypothesis failed its descriptive
  feasibility screen. Same-key recurrence was 40.4% with feed-forward versus
  39.4% for control (a +1.0 percentage-point difference, where negative would
  favor treatment). Feed-forward also produced more new findings per turn
  (1.39 versus 1.27), shipped fewer original candidates (92.9% versus 94.0%),
  used one deterministic fallback (1.4% versus 0%), grounded fewer dialogues
  (1/6 versus 2/6), and took slightly more turns on average (11.67 versus
  11.17). The profile split was unstable: recurrence improved for
  `false_memory` but worsened for `low_agency`, with three of six seed-pairs
  better and three worse. This small cohort does not establish a treatment
  effect, but it is enough to reject the mechanism as a general default. The
  implementation remains available only as an explicit research opt-in; the
  card closes tested-not-adopted with no rerun planned.

- 2026-08-09 — implementation and prospective pilot frozen on
  `codex/guard-findings-feed-forward`. The opt-in treatment now projects only
  the previous delivered turn's *effective advisory* findings into short,
  public-safe behavioral lines on the next tutor request. Hard findings,
  report-only findings, raw audit reasons, premise ids, and hidden evidence are
  excluded. The prompt says explicitly that current public evidence and the
  current turn contract outrank stale observations; the same-turn contract
  repair ladder is unchanged. Every turn records whether the treatment was
  enabled, applied, and which normalized findings it carried.

  The bounded A1 feasibility screen is frozen before spend: Rowan Flat only;
  `false_memory` and `low_agency`; feed-forward against an explicit off
  control; three seed-paired repeats per profile/arm (12 dialogues); 12 turns
  and one attempt per job; `codex.gpt-5.6-luna` for every model-backed role;
  Qwen committee and light adaptation off; `shadow_advisory` guard policy.
  Primary readout is same-key finding recurrence on the immediately following
  delivered tutor turn. New findings, findings per turn, original-draft and
  deterministic-fallback shares, grounded closure, and mean turns are
  guardrails. This is descriptive feasibility evidence, not a treatment-effect
  claim or a default flip. The hard ceiling is 720 model calls (12 jobs × the
  per-job 60-call admission budget), with no reruns. A clean-source certificate
  and four-cell zero-model delivery check must pass before launch, and the paid
  external payload boundary still requires explicit user authorization.

- 2026-08-06 — filed from the retry analysis. Waits for the default flip; no
  code changed.
- 2026-08-07 — gate cleared and card demoted to P3 on the user's call. The flip
  did the subtractive half by itself: quality findings no longer veto, so they
  no longer trigger a same-turn rewrite, and the rewrite rung now fires on 404
  drafts per Phase-B-sized run instead of 1,041. What remains is the untested
  guess — that last turn's complaints, carried into the next request, help
  rather than read as stale noise. Smaller card than when filed, and it queues
  behind `phase-b-rerun-under-flipped-policy` for the same codex quota.
