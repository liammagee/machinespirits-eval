---
id: guard-findings-feed-forward
title: Feed guard findings into the next turn's request instead of redrafting this one
status: active
type: research
priority: P3
owner: codex
source: manual
created: 2026-08-06
updated: 2026-08-09
verification: "UNGATED but demoted — the flip landed and already delivered the
  subtractive half, so only the additive half is left to test. Run when there is
  spare quota and no better claim in the queue: an instrumented run where each
  tutor request carries the previous turn's findings as one line each, against a
  control without the lines. Readout: finding recurrence turn over turn, and the
  quality instruments per condition. The retry ladder stays for contract
  findings only."
claim_status: planned
links:
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubFirstDraftContract.js
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
