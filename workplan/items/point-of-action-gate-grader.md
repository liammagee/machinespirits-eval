---
id: point-of-action-gate-grader
title: Grade the point-of-action gate's decisions, not just the tutor's wording
status: done
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-07-26
updated: 2026-07-27
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
screens candidates rather than settling them. The bar is 85.1% at a comparable
fire rate, not 82.4% at double it.

## Follow-up (2026-07-26): the discrimination is in the position flag, and the cheaper policy is not going to a live run

Splitting the live conjunction into its halves on the 2,339 window-eligible
observational moments puts the discrimination entirely on the deterministic side:
position layer alone 86.6% at a 74% fire rate, model vote alone 80.9% at 50%, the
live conjunction 85.1% at 36%, always-fire 82.4%. `near_closure` as a
whole-population state feature is +16.3 points (z 8.03), replicated per archive.
The paid call has no positive incremental value in any stratum.

The obvious follow-up — delete the per-turn model call, keep the position flag — is
recorded as **not licensed**, so it is not re-proposed:

1. **No cost saving.** `evidence_use` rides inside `extractCombinedLearnerAnalysis`,
   one call that also produces the DAG state and the register analysis, and
   `nearClosure` derives from that same call's `currentDag.bestPathCoverage`.
   Dropping the label from the gate saves zero calls and zero latency.
2. **No margin over the incumbent**: position minus live rule is +1.6, SE 1.5,
   z 1.06.
3. **The fire rate moves 36% → 74%** — a different intervention regime, not a
   drop-in swap, and not rate-matchable without a cooldown knob that oscillates
   81.1–92.3% over ≤376 fired moments.

What survives is a robustness argument, not a cost one: the flag is deterministic
and judge-invariant where the label reaches 78.6% cross-family agreement
(κ 0.583) and ~60% self-reproduction. Worth preferring if the gate is rebuilt for
other reasons; not worth quota to prove. The flag also reads *position on the path*
rather than an interior — `grounded` moves −18.9 on the rows it selects.

Wired in so the gap cannot reopen: `npm run program2:gate-grade` /
`program2:gate-grade:check` (structural failures only — unknown arm, arm mismatch,
missing archive, suppression block not recorded, no scorable decisions; never a
failure on a number), and `scripts/run-program2-live-pilot.js` runs the same loader
in-process after each launch pass, recording the verdict into `launch-state.json`
without throwing. Folded into the paper as the §6.22 addendum (v3.0.230).

Not in scope: re-running the live phases under the relabelled gate. The reason is
in the parent item — turns silent under v1 that fire under v2 are a
counterfactual population whose recorded replies were produced without the
side-coach block, so their historical compliance is not a like-for-like baseline.
