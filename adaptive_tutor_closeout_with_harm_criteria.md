# A20/A21 + Ownership Benchmark Closeout: Harm, Utility, and Final Scope

**Date:** 2026-06-16  
**Decision:** Close the A20/A21/ownership/didactic *promotion* arc for the current artifact pool. Keep the instrumentation.

## Short Answer

Close the arc **as a runtime-policy promotion attempt**, but do **not** throw away A20/A21.

A20/A21 do not justify promoting a new proof-control policy over `hidden + proofDebt`. The ownership benchmark now closes the remaining objection: after calibrated proof-matched controls passed, mined artifacts still showed no qualifying proof-safe learner-ownership gain. No paid run or runtime promotion is warranted from this artifact pool.

But A20/A21 are not useless, and they do not all “harm” in the same way. The right distinction is:

```text
Do not promote as production proof-control.
Keep as instrumentation, diagnostics, benchmark controls, and possible quality-layer scaffolds.
```

## Does A20/A21 Harm Anything?

### Yes, when promoted overlays interfere with proof control

The main demonstrated harm is **progress starvation**. A20 showed that locally plausible diagnostics and maintenance moves can pass their own local compliance checks while still delaying proof-critical releases and causing a worse final outcome.

The key example is the Hethel failure: the promoted selector/conduct overlay kept diagnosing visible/hidden conflict, delayed `p_point`, delayed `p_surface`, and failed even though the conduct checks passed. That is the critical lesson:

> Local pedagogical plausibility is not enough. A locally compliant tutor can still starve proof progress.

So A20-style overlays harm when they are allowed to spend turns on diagnostics, consolidation, teach-back, or readback without a hard opportunity-cost budget.

### No, when A20/A21 are kept as opt-in instrumentation

A20’s safer assets are mostly infrastructure:

- trigger corpora;
- typed move families;
- replayable prefixes;
- non-leak audits;
- generator-compliance checks;
- failure labels;
- policy-level diagnostics.

Those do not harm production behavior unless they are wired into runtime policy or used to justify a promotion. They make failures easier to classify.

A21 is even safer because it was deliberately isolated. It evaluated action value from a fixed trigger state and did not alter selector defaults, hidden+proofDebt behavior, conduct enforcement, or paid/replay gates. Its Phase 9 patch replay was neutral: S1 matched hidden+proofDebt but did not beat it.

### Potential harm if A21 becomes a default policy

The A21 patch itself did not show harm in its replay. But defaulting it would still be premature because it duplicates hidden+proofDebt on the decisive Hethel turn rather than improving over it. Promoting a redundant patch creates complexity risk, future interaction risk, and maintenance burden without demonstrated gain.

So the status is:

```text
A21 microbench: keep.
A21 patch as default: do not promote.
```

## What Other Criteria Might A20/A21 Help With?

A20/A21 may still help with criteria that are **not** proof-control metrics.

### 1. Auditability

A20 improves auditability by making tutor conduct inspectable: selected move, blocked actions, non-leak status, generator compliance, and policy failure labels. Even if the policy does not improve outcomes, the instrumentation improves the scientific apparatus.

### 2. Failure diagnosis

A21 improves failure diagnosis. It changed the question from:

```text
Did the tutor select the locally sanctioned move?
```

to:

```text
Which concrete action had the best downstream value from this trigger state?
```

That is a better diagnostic lens. In Hethel, it showed that release beat repeated diagnostic, and then showed that hidden+proofDebt already selected the release action.

### 3. Regression testing

The ownership benchmark is now useful as a regression suite. Its controls passed:

- positive controls detect ownership gain with proof fixed;
- negative controls reject warmer prose-only changes;
- disqualification controls reject proof/release-confounded gains.

That means it can protect future work from overclaiming ownership improvements.

### 4. Transcript-quality evaluation

A20/A21 may still assist with:

- dialogue quality;
- learner ownership;
- didactic clarity;
- resistance or recognition handling;
- dramatic form;
- human-reader preference;
- whether the learner’s final assertion feels earned.

The closeout should therefore not say “these layers are worthless.” It should say they are **not proof-control improvements** and have **not yet shown proof-safe ownership gains** in this artifact pool.

### 5. Future proof-control failures

If hidden+proofDebt fails in a future predeclared case, A21 is the right tool to analyze the trigger. It can ask whether a public signal existed before the action and whether a different action would have improved outcome without negative transfer.

That is a future-failure diagnostic role, not a standing runtime role.

## How External Tutoring Evidence Frames This

The broader LLM tutoring literature supports the same distinction between task completion, tutoring quality, and durable learning.

Recent math-tutoring work found that LLMs can solve many problems correctly as problem solvers, but interactive tutoring dialogues still contain substantial correctness issues; in one benchmark, models solved 85.5% of algebra problems correctly as problem solvers, while only 56.6% of interactive tutoring dialogues were entirely correct.

A proof-tutoring study similarly found that an LLM-based proof tutor improved homework performance but did not significantly improve exam performance or time-on-task, and interviews raised over-reliance concerns.

A recent adaptive-scaffolding ITS study also points toward the right positive target: adaptivity matters when it is tied to learner state, cognitive engagement, and posttest outcomes—not merely when it improves assisted completion.

These external results reinforce the local lesson: proof completion is a necessary reliability gate, but it is not the same as learner ownership or durable learning.

## Updated Closeout Decision

### Close as proof-control promotion

Close these as **not promoted**:

- A20 conduct-policy promotion over hidden+proofDebt;
- selector-v4 conduct enforcement;
- progress-policy enforcement;
- A21 Hethel patch as default;
- didactic mode as a proof-control improvement;
- further mined-artifact rescoring from the same artifact pool.

### Keep as assets

Keep these as **research and evaluation assets**:

- `hidden + proofDebt` as the production derivation policy;
- A20 conduct objects as instrumentation;
- A21 action-value microbench as future-trigger diagnostics;
- ownership benchmark as a regression/evaluator suite;
- didactic mode as a dormant quality-layer scaffold;
- replay harness as no-cost debugging infrastructure.

## What Would Reopen This?

Only one of two things should reopen the arc.

### Reopen proof-control work only if hidden+proofDebt fails first

Do not search for a favorable anecdote. Start from a predeclared hidden+proofDebt failure, then ask:

1. What kind of failure is it: action choice, learner uptake, discourse texture, decay/repair continuity, world instability, or over-constrained runtime policy?
2. Was a public signal available before the action?
3. Would a different action improve final grounding or turns without negative transfer?
4. Does the result replicate on held-out worlds?

### Reopen ownership/didactic work only with proof-matched designs

Do not use the current mined artifact pool for promotion evidence. Use deliberately controlled proof-matched pairs where proof path, release schedule, and final D are held fixed, then test whether one transcript produces better learner ownership.

## Final Status Language

Use this in the plan:

> **Closed as valid negative for this artifact pool.** A20/A21/ownership/didactic overlays did not produce a qualifying improvement over hidden+proofDebt. The ownership benchmark controls passed 12/12, establishing that the evaluator distinguishes proof-safe ownership gain, prose-only improvement, and proof/release confounds. Post-benchmark artifact scoring remained negative. Therefore no paid run, selector revival, runtime policy promotion, or didactic-mode promotion is warranted from this artifact pool.
>
> **Retained as instrumentation.** A20 conduct objects, A21 action-value microbenching, replay gates, non-leak audits, ownership benchmark controls, and didactic-mode scaffolds remain useful as research/evaluation tools. Their value is diagnostic and evaluative, not promotive.

## Bottom Line

Yes, close now—but close the right thing.

```text
Close: promotion from the current artifact pool.
Do not close: instrumentation, diagnostics, future failure analysis, quality-layer research.
```

The result is not “A20/A21 harmed everything.” It is:

> A20 showed that adaptive overlays can harm proof progress when promoted too early. A21 showed why the baseline was already making the correct proof-control move. The ownership benchmark showed no proof-safe learner-ownership gain in the artifact pool. Therefore the production arm remains hidden+proofDebt, while A20/A21 remain useful as diagnostic and evaluation infrastructure.
