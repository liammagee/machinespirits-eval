---
id: point-of-action-gate-grader
title: Grade the point-of-action gate's decisions, not just the tutor's wording
status: done
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: Discrimination is computed only on arms whose fired turns carry no
  injection, derived per run from the traces rather than from a hardcoded arm
  list, so a new arm or a changed injection path reports
  armClassificationMismatch instead of silently entering the baseline; the
  outcome comes from validated proof-DAG advancement that the gate has no channel
  to author; components the warrant_skip constraint mechanically suppresses are
  labelled tutorGated and kept out of the headline; turns are excluded on the
  delivered-text leak audit only, with the first-draft audit reported as a
  covariate; the treatment contrast phase-matches its baseline so passing two
  archives cannot pool them; zero API calls.
claim_status: exploratory
depends_on:
  - evidence-use-v2-default-and-archive-relabel
links:
  code:
    - services/pointOfActionGateGrader.js
    - scripts/grade-point-of-action-gate.js
    - services/tutorStubPointOfActionCoaching.js
  items:
    - evidence-use-v2-default-and-archive-relabel
    - evidence-use-bridge-rubric-v2
    - program-2-context-vs-weights-finetune
  notes:
    - notes/program-2/2026-07-26-gate-grader-result.md
    - notes/program-2/2026-07-26-relabel-sample-result.md
tags:
  - tutor-stub
  - classifier
  - program-2
  - instrument
  - fine-tune
---

Two seats decide the tutor's behaviour at a point of action, and only one of them
was graded. The **writer** seat decides what to say once the tutor speaks, and
`auditTutorStubPointOfActionCompliance` scores it on exactly-one-question, warrant
cue, no-new-premise and guards-passed. The **classifier** seat decides *whether*
the tutor speaks — one frontier call per learner turn emitting `evidence_use`,
whose value is the sole input to `warrant_skip` — and nothing scored it. A tutor
can post a perfect 4/4 on a turn where intervening was pointless and the audit
will not notice.

That is what left the local-classifier question unanswerable rather than merely
unanswered. The parent item ends by saying both seat options "need the full
sweep's numbers before either can be pre-registered." The numbers were necessary
but never sufficient: even a perfect label corpus cannot rank a local classifier
against the frontier one without a channel that says whether a gate decision was
right. This item builds the channel.

## How it identifies the gate

The outcome is proof-DAG advancement, read off `stateObservation.dag` — claims
extracted from the learner's message and validated against the world's rule
closure, so a learner is credited only for a fact that actually follows. The gate
has no path to inflate it. The window is state(N+1) − state(N), which is the
correct one: state at turn N analyses the learner's turn-N message and the tutor's
turn-N reply comes after it, so the learner's response to that reply lands at N+1.

Identification is already in the arm design. `standing_book`, `silent_control` and
`committee` compute and log the gate's assignment and then inject nothing at
trigger time. On those arms the decision has no causal effect, so
flagged-versus-passed-over is a property of the gate with no treatment in the way.
The grader checks this per run instead of trusting the constant, because the whole
result rests on it.

## Result

183 dialogues, 4,372 scorable gate decisions, 2,718 of them on treatment-free
observational moments.

- Warrant-aligned discrimination (`voiced_derived`): **+0.4 points, SE 1.5,
  z 0.30**. Null, and null again on each arm separately — `standing_book` +3.0,
  `silent_control` +0.9, `committee` −0.9, across two archives and two scenario
  suites.
- Off-policy stall precision: the live rule scores **85.1%** against **84.8%** for
  firing on every turn. The gate is 0.3 points better than having no gate. The one
  apparent signal does not replicate: `overleaps_evidence` as a solo rule scores
  91.4% against an 85.2% always-fire base rate on step4 (n=93 fired moments) and
  83.8% against 84.7% on program-2 — slightly worse than firing on everything. A
  single-archive read would have recommended narrowing the gate to one label.
- On the tutor-gated components the sign is wrong and separable from zero:
  `grounded` −6.9 (z −3.50), `coverage` −8.5 (z −4.76). The gate fires on moments
  where the learner goes on to advance *more* often.

That last row is the mechanism. `omits_warrant` and `overleaps_evidence` both
describe a learner asserting conclusions, and an asserting learner is moving; a
stuck learner asks questions or repeats itself. The gate is a "running ahead"
detector being read as a "stuck" detector, and the two are mildly
anti-correlated.

Acting on the flagged moments did not pay either. Against a phase-matched
observational baseline: `side_coach` −2.1, `triggered_placebo` −3.6,
`compiled_constraint` −8.9. The one separable from zero is the confounded one
(below).

## Three measurement traps, all live in the archives

- **`compiled_constraint` is not readable as a gate result.** It falls on all
  three components because it enforces `suppress_new_premise` programmatically
  rather than asking for it in text. `side_coach` asks for the same restraint and
  shows no collapse, which is the control that identifies enforcement rather than
  instruction as the cause.
- **Excluding on the first-draft leak audit is wrong.**
  `originalCandidate.audits.leakAudit.ok === false` is the guard *working*, is
  redundant with `accounting.outcome` (it fires only on repair and fallback, never
  on accept), and excluding on it discards ~390 clean turns. Only
  `finalDelivery.audits.leakAudit` describes what the learner read: 79 turns
  across both archives.
- **`accounting.guards.leak: true` means the guard was enabled**, not that
  anything leaked.

## What this closes and what it leaves open

Closed: the classifier seat, on both sides. The parent item measured that the v2
rubric edit barely moves which turns the gate selects (44.5% → 41.2%, 1.35 SE from
zero on a 400-record unbiased sample). This item measures that what it selects
does not predict the trouble the intervention exists to fix. Training a local
model to reproduce that label more cheaply would reproduce a signal carrying
nothing — a construct argument, independent of the instrument argument.

Open, and unchanged: the **writer** seat. Nothing here touches the +0.236 Phase 5b
and +0.202 Phase 5c gaps, which are compliance-scored on turns where the tutor
spoke. Those remain the live case for the fine-tune.

Also open: whether a better gate exists. The off-policy channel ranks any
candidate rule against recorded dialogue at zero cost — a different label set, a
threshold, a local model's stored predictions. It cannot say what a rule would
*cause*, since the recorded outcomes followed the gate that actually ran, so it
screens candidates rather than settling them. A rule beating 84.8% by a real
margin would justify a live run. Nothing tested here does.

Not in scope: re-running the live phases under the relabelled gate. The reason is
in the parent item — turns silent under v1 that fire under v2 are a
counterfactual population whose recorded replies were produced without the
side-coach block, so their historical compliance is not a like-for-like baseline.
