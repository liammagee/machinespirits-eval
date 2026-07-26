# The point-of-action gate has no measurable stall-detection power

2026-07-26. Instrument: `services/pointOfActionGateGrader.js`,
`scripts/grade-point-of-action-gate.js`. Zero API calls — everything here is read
off archived traces and can be re-run on any future archive.

## Why this was built

Two seats decide the tutor's behaviour at a point of action. The **writer** seat
decides what to say once the tutor speaks, and it is graded:
`auditTutorStubPointOfActionCompliance` scores exactly-one-question, warrant cue,
no-new-premise, guards-passed. The **classifier** seat decides *whether* the tutor
speaks — one frontier call per learner turn emitting `evidence_use`, whose value is
the sole input to `warrant_skip` — and nothing graded it at all. A tutor can score
a perfect 4/4 on a turn where intervening was pointless, and the audit would never
notice.

That gap is what made the local-classifier question unanswerable rather than
merely unanswered. Without a gate scorer, a local model for the *when* seat cannot
be compared against the frontier classifier even given a perfect label corpus,
because there is no channel to compare them on.

## The outcome channel

Proof-DAG advancement, from `turnRecord.stateObservation.dag`:
`best_path_coverage`, `grounded_count`, `voiced_derived_count`. These come from
validating extracted learner claims against the world's rule closure, so a learner
is credited only for a fact that actually follows. The gate has no channel to
inflate them. Window is state(N+1) − state(N), which is the right one: state at
turn N analyses the learner's turn-N message, the tutor's turn-N reply comes after
it, so the learner's response to that reply lands at N+1.

Identification comes free from the existing arm design. `standing_book`,
`silent_control` and `committee` compute and log the gate's assignment and then
inject nothing at trigger time (checked: 705 fired turns, `interruption.kind` null
on every one). On those arms the gate's decision has no causal effect, so
flagged-vs-passed-over is a property of the gate with no treatment in the way. The
grader derives this from the traces rather than trusting a hardcoded list, so a new
arm or a changed injection path surfaces as `armClassificationMismatch` instead of
quietly entering the baseline.

## Result

183 dialogues across both archives, 4,372 gate decisions with a scorable next turn,
2,718 of them on observational arms.

**Warrant-aligned outcome (`voiced_derived_count`), observational arms pooled:**

| | advanced | n | rate |
|---|---|---|---|
| gate fired | 126 | 844 | 14.9% |
| gate passed over | 288 | 1,874 | 15.4% |

Discrimination +0.4 points, SE 1.5, z 0.30. Nothing. And it replicates as nothing
on each arm independently: `standing_book` +3.0 (z 0.92), `silent_control` +0.9
(z 0.35), `committee` −0.9 (z −0.41) — two separate archives, three arms, two
scenario suites.

**The sharper version, from the off-policy table.** Firing on every single turn
gives a stall precision of 84.8%; the live rule gives 85.1%. The gate is 0.3 points
better than not having a gate. Neither single-label variant helps: `omits_warrant`
alone 83.1%, `overleaps_evidence` alone 85.0%.

The one apparent signal in the whole exercise fails to replicate. On step4 alone,
`overleaps_evidence` as a solo rule scores 91.4% against an 85.2% always-fire base
rate — a 6.2-point margin, and the only number here that would justify a live run.
On program-2 the same rule reads 83.8% against 84.7%, i.e. slightly *worse* than
firing on everything. Per-archive:

| policy | step4 | program-2 |
|---|---|---|
| live rule | 87.3% (n=158) | 84.5% (n=686) |
| `omits_warrant` only | 81.8% (n=137) | 83.5% (n=551) |
| `overleaps_evidence` only | **91.4%** (n=93) | 83.8% (n=507) |
| always fire | 85.2% (n=542) | 84.7% (n=2,176) |

The step4 cell is 93 fired moments. This is the reason to run both archives rather
than the training one: a single-archive read would have produced a plausible,
citable, wrong recommendation to narrow the gate to one label.

**On the tutor-gated components the sign is wrong, and separably so:**

| outcome | fired | passed over | discrimination |
|---|---|---|---|
| `voiced_derived` | 14.9% | 15.4% | +0.4 (z 0.30) |
| `grounded` (tutor-gated) | 36.3% | 29.4% | −6.9 (z −3.50) |
| `coverage` (tutor-gated) | 27.3% | 18.8% | −8.5 (z −4.76) |

The gate fires on moments where the learner goes on to take up premises *more*
often, not less. This is coherent with what the labels mean:`omits_warrant` and
`overleaps_evidence` both describe a learner who is asserting conclusions. An
asserting learner is moving. A stuck learner asks questions or repeats themselves.
The gate is a "learner is running ahead" detector being read as a "learner is
stuck" detector, and the two are mildly anti-correlated.

**Acting on the flagged moments did not help either.** Injecting arm vs
phase-matched observational baseline, flagged moments only, `voiced_derived`:
`side_coach` −2.1 (z −0.46), `triggered_placebo` −3.6 (z −0.83),
`compiled_constraint` −8.9 (z −2.55). All negative, only the confounded one
separable from zero — see below.

## The discrimination is in the position flag, not the model call

The live gate is a conjunction, not a single vote:

```
fired ≡ !outsideWindow && !nearClosure && !closeInquiry && (warrantSkip || stagnantRepeat)
```

`warrantSkip` is the model's `evidence_use` label. `nearClosure` and `closeInquiry`
are deterministic, computed from the same turn's DAG state. Splitting the
conjunction says which half is doing the work.

Denominator: `outsideWindow` (`turn >= 3 && turn <= 24`) is a harness constant every
candidate policy inherits, so it belongs in the denominator. `nearClosure` and
`closeInquiry` are the deterministic layer's *judgement* and belong in the policy
under test. On the 2,339 window-eligible observational moments:

| policy | fires | stall precision |
|---|---|---|
| live rule (model vote AND position layer) | 844 (36%) | 85.1% (718/844) |
| model vote alone (ignore position layer) | 1,162 (50%) | 80.9% (940/1,162) |
| **position layer alone (no model call)** | **1,736 (74%)** | **86.6% (1,504/1,736)** |
| `omits_warrant` only | 577 (25%) | 80.2% |
| `overleaps_evidence` only | 525 (22%) | 82.9% |
| always fire | 2,339 (100%) | 82.4% (1,928/2,339) |

`near_closure` read as a whole-population state feature is +16.3 points (z 8.03),
replicated per archive. The paid call has no positive incremental value in any
stratum. The position flag beats fire-on-everything by +4.2 (SE 1.1, z 3.71) — and
does **not** beat the incumbent: position minus live rule is +1.6 (SE 1.5, z 1.06).
The two agree on 1,447 of 2,339 eligible turns (61.9%).

What the flag reads is worth stating precisely, because it is not mind-reading.
`grounded` moves −18.9 on the very rows `near_closure` selects. It reads *position
on the path*, not a stalled learner. "Do not interrupt someone four-fifths of the
way through a derivation" is a sound operating rule about where the learner is, not
a claim about what they are thinking.

## Decision: no live A/B on the cheaper policy

The obvious follow-up — delete the per-turn model call, keep the position flag —
is recorded here as **not licensed**, so it is not re-proposed. Three reasons, and
the first was expected to point the other way:

1. **No cost saving.** `evidence_use` rides inside `extractCombinedLearnerAnalysis`
   (`scripts/tutor-stub.js`), one call that also produces the DAG state and the
   register analysis. `nearClosure` derives from *that same call's*
   `currentDag.bestPathCoverage`. Both gate signals are downstream of one
   unavoidable call. Dropping the label from the gate saves zero calls and zero
   latency.
2. **No margin over the incumbent** to detect: +1.6 points, z 1.06.
3. **The fire rate moves 36% → 74%.** That is a different intervention regime, not
   a drop-in swap, and it cannot be rate-matched without a tuning knob the record
   does not license — a cooldown sweep oscillates 81.1 → 89.3 → 85.7 → 92.3 → 85.4
   → 80.6% over ≤376 fired moments, which is fishing, not calibration.

What survives is a robustness argument, weaker than a cost one and worth having:
the position flag is deterministic and judge-invariant, whereas `evidence_use`
reaches 78.6% cross-family agreement (weighted κ 0.583) even after the v2 repair
and reproduces itself on ~60% of re-asks. Removing the label from the gate would
remove the standing caveat that the intervention rate is partly a property of the
chosen judge and the sampled draw. That is a reason to prefer the flag if the gate
is ever rebuilt for other reasons. It is not a reason to spend quota proving it.

## Two traps in the measurement, both live and both avoidable

**`compiled_constraint` cannot be read as a gate result.** Its fired-turn advance
rate collapses on all three components (grounded 8.5% fired vs 38.5% passed over).
That is the intervention's own instruction, not the gate's choice of moment: the
`warrant_skip` constraint sets `suppress_new_premise: true`, and this arm enforces
it programmatically rather than asking for it in text. No premise is released, so
`grounded` and `coverage` cannot rise, and `voiced_derived` falls too because a
derivation needs premises to work from. `side_coach` only *asks* for the same
restraint and shows no such collapse (grounded 42.7% fired vs 29.7%), which is the
control that identifies the mechanism as enforcement rather than instruction.

**Do not exclude a turn because the tutor's first draft leaked.** Crosstab of guard
outcome against the two leak audits:

| guard outcome | first draft leaked | delivered text leaked |
|---|---|---|
| `guarded_original_accepted` | 0 / 1,237 | 0 / 1,237 |
| `guarded_model_repair_accepted` | 129 / 300 | 0 / 300 |
| `guarded_deterministic_fallback` | 264 / 768 | 41 / 768 |

`originalCandidate.audits.leakAudit.ok === false` is the guard *working* — it caught
the leak and repaired or replaced the text. It is also redundant with
`accounting.outcome`, since a failing draft audit is *why* the guard intervened, so
excluding on it double-counts. Only `finalDelivery.audits.leakAudit` describes what
the learner read: 41 turns in step4, 79 across both archives. An earlier pass of
this grader excluded on the draft audit and threw away ~390 clean turns for nothing.
(`accounting.guards.leak` is a third trap: it reports that the guard was *enabled*,
not that anything leaked.)

## What this does and does not settle

Settles: **the `evidence_use` label carries no information about whether the
learner is about to stall.** Two archives, three observational arms, 2,718
treatment-free moments, replicated per arm, and the effect size is 0.3 points
against a fire-on-everything baseline. This is not an underpowered null.

Combined with the 400-record relabel result from earlier today — where the v2
rubric edit moved the gate 44.5% → 41.2%, 1.35 SE from zero — the classifier seat
is closed on both sides. The label is near-arbitrary in what it selects, and what
it selects does not predict the thing the intervention exists to fix. Training a
local model to reproduce that label more cheaply would be reproducing a signal that
carries nothing. That is the second independent reason not to spend the fine-tune on
the *when* seat, and unlike the first it is about the construct rather than the
instrument.

Does not settle: the **writer** seat. Nothing here touches the +0.236 Phase 5b and
+0.202 Phase 5c gaps, which are compliance-scored on turns where the tutor spoke.
Those remain the live case for the local model.

Does not settle: whether a *better* gate exists. The off-policy channel ranks how
well a rule predicts stalls in recorded dialogue and can score any candidate — a
different label set, a threshold, a local model's stored predictions — at zero cost.
It cannot say what a rule would *cause*, because the outcomes are the ones that
followed the gate that actually ran. One candidate does clear the fire-on-everything
baseline by a real margin — the deterministic position flag, +4.2 points — but it
does not clear the *incumbent*, and the three reasons above are why it is not going
to a live run. Any future candidate has to beat 85.1% at a comparable fire rate, not
82.4% at double it.

Does not settle: whether `voiced_derived` at a 15.2% base rate is the right target.
It is sparse but not degenerate, and the tutor-gated components — which are 2–3×
denser — show the same null with the opposite sign, so the finding does not hinge
on the choice.

## Reproduce

```bash
npm run program2:gate-grade -- --json exports/point-of-action-gate-grade.json
```

`--archive DIR` (repeatable) to scope it, `--per-persona` for the persona
breakdown, `--min-turns N` to raise the dialogue-length floor.

`npm run program2:gate-grade:check` is the structural integrity gate: it fails
(exit 1) on an unknown arm, an arm-classification mismatch, a missing archive, an
archive that stopped recording the suppression block, or no scorable decisions. It
never fails on a *number* — a small discrimination or a low advance rate is a
finding, and a check that failed on those would be a check demanding a particular
result. `scripts/run-program2-live-pilot.js` calls the same loader in-process after
every launch pass and records the verdict into `launch-state.json`, so the grading
gap this note was written to close cannot silently reopen on the next gate. That
step never throws: by the time it runs the jobs are sealed and the tokens are spent,
and failing there would break resume without saving anything.

Related:
[`2026-07-26-relabel-sample-result.md`](2026-07-26-relabel-sample-result.md) for the
label-side half of the same question.
