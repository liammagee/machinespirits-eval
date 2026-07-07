# Analysis of A20/A21 Closeout in Light of the Adaptive Tutor Plans

According to documents from 2026-06-16, I think the closeout analysis is **basically right**, but it is still one level too operational. It says “stop promoting controllers over hidden+proofDebt.” I would sharpen that to: **you have already found the proof-control object; the missing object is learner ownership under fixed proof control.**

You are not chasing the wrong problem. You were chasing it at the wrong layer.

## The core diagnosis

A20 and A21 show that **hidden+proofDebt is not merely a baseline**. It is already a compact proof-state adaptation layer. It releases the next safe public evidence, repairs decayed dependencies, blocks premature assertion, and refuses to treat fluent public talk as proof ownership. The closeout analysis says this directly: A20/A21 converge on hidden+proofDebt acting as a proof-continuity controller, while overlays mostly match it, explain it, or harm it.

That means the old question—

> Can we build an adaptive controller that beats hidden+proofDebt?

—has become a bad default question. The current evidence says no, unless you first find a real hidden+proofDebt failure case. Phase 9 is especially important: A21 identified “release `p_point`” as the high-value action, but hidden+proofDebt already did exactly that, so A21 explained the baseline rather than beating it.

So the right move is **not** another selector, not another conduct taxonomy, not another diagnostic budget. Your own active plan now says the next arc should ask where hidden+proofDebt actually fails, what kind of failure it is, whether a public signal predicts a better choice, and whether that signal improves outcomes without negative transfer.

That is right for proof-control research. But it is not enough for pedagogy.

## What you are missing

You are missing a **learning object** distinct from the proof object.

Right now the harness knows whether the derivation grounded. It knows whether D reached 0, whether releases were on time, whether the learner overreached, whether aporia or disengagement happened, and whether hidden+proofDebt was harmed. The closeout analysis notices that this saturates the evaluation surface: if hidden+proofDebt already solves the proof, overlays can only “win” by shaving turns or avoiding rare failures, while potentially missing didactic clarity, learner ownership, readability, recognition handling, and dramatic form.

That is exactly the point where the target has to change from:

> Did the tutor control the proof?

to:

> Did the learner come to own the object being taught?

Those are not the same. A learner can reach a formally grounded final assertion while still being carried by the tutor’s release machinery. Conversely, a transcript can be pedagogically better without changing final D.

This distinction is well-aligned with the intelligent-tutoring-systems tradition: classic ITS architectures separate the **domain model**, **student model**, **tutoring model**, and **interface model**, while knowledge-tracing work estimates learner mastery rather than merely checking that the task finished. Dialogue-oriented systems such as AutoTutor also treat cognitive and affective dialogue state as a separate adaptation target, not just a correctness controller. The ICAP framework similarly makes learner engagement mode—passive, active, constructive, interactive—a learning-relevant object in its own right.

Your current derivation harness has a strong domain/proof model. It has a partial public conduct model. It does **not yet have a strong learner-ownership model**.

## Are you chasing the right object?

Yes, **if the object is renamed**.

No, if the object remains “adaptive proof-control policy.”

The clean layered object should now be:

```text
hidden+proofDebt handles proof continuity.
discursive/didactic adaptation handles the learner’s public relation to the proof object.
```

Your active plan already says this almost exactly: proof-state control decides what the inquiry can safely do next—release, restore, hold, assert—while the discursive layer should decide how the tutor conducts that same proof step when public dialogue state changes.

The Didactic Mode Plan is the right kind of next object in principle. It asks whether the learner is failing to learn the current object and whether the next scene or act should teach the same object differently, without overriding hidden+proofDebt. Its mode families—`teach_back`, `concrete_example`, `analogy_bridge`, `contrast_case`, `slow_recap`, `purpose_bridge`, `decompose_subtask`, `repair_vocabulary`—are not another H/V selector; they are compact teaching regimes with exit conditions.

But the didactic layer is still missing the decisive evaluation object. The plan has implemented the classifier/state object, rhetorical integration, runtime flag, and act-level metadata path; the local mock gate showed that S1 changed explanatory/rhetorical regime while preserving prefix integrity, release timing, and D curve, but it did **not** improve the mock formal outcome, and the plan correctly says a paid mini-run is not warranted yet.

So didactic mode is directionally right, but currently it proves only:

> We can change explanatory conduct without breaking proof control.

It does **not** yet prove:

> The learner learned the object better.

That is the missing object.

## The next object should be “durable public ownership”

I would define a new evaluation target, not necessarily a new runtime policy, something like:

```text
ObjectOwnershipState
```

It should ask whether the learner can do the following with the currently taught object:

1. **Restate it** in their own words.
2. **Use it** in the current proof path without prompting.
3. **Discriminate it** from a nearby wrong route.
4. **Transfer it** to a near-isomorphic case.
5. **Recover it** after a distractor or short context break.
6. **Explain why it matters** to the current question.

This differs from proofDebt. ProofDebt asks whether the proof needs a dependency restored. Ownership asks whether the learner can actively operate the dependency.

That would turn “the final assertion feels earned” from a literary judgement into a set of inspectable probes. The closeout analysis lists “whether the learner’s final assertion feels earned rather than merely formally grounded” as a needed broader criterion; I think that should become an explicit ownership instrument.

## The biggest risk in the Didactic Mode Plan

The didactic plan correctly says proof control remains dominant and didactic mode cannot choose a different proof action; it can only alter how the same obligation is taught.

But there is still a hidden danger: **didactic mode can starve progress even without formally overriding proof control.**

A20 failed because locally plausible diagnostics consumed turns, delayed release, and starved proof progress. Didactic moves like `slow_recap`, `decompose_subtask`, and `teach_back` can do the same thing if they create extra proof-neutral exchanges without a hard budget. The plan says scenes are a natural scope and can hold across several exchanges without forcing proof advancement every turn. That is pedagogically plausible, but in this harness it is also exactly where decay headroom and aporia clocks bite.

So the missing guard for didactic mode is not another proof controller. It is an **opportunity-cost budget**.

Every didactic intervention should declare:

```text
mode
object
proof obligation preserved
maximum proof-neutral turns
exit condition
failure action
```

For example:

```text
mode: teach_back
object: p_point
budget: one proof-neutral learner turn
exit: learner gives usable own-words account
on_fail: proceed with hidden+proofDebt obligation, mark ownership_unproven
```

That would prevent the quality overlay from becoming another progress-starving overlay.

## The second missing piece: a failure atlas for hidden+proofDebt

For proof-control research, the next task is not to search randomly for another adaptive policy. It is to build a **failure atlas** of hidden+proofDebt.

The active plan already gives the four right questions: where hidden+proofDebt fails, what kind of failure it is, whether a public signal predicts a better action, and whether using that signal improves final grounding or turn count without negative transfer.

I would turn that into a hard gate:

> No new proof-control policy is allowed unless it starts from a predeclared hidden+proofDebt failure.

A21 should remain the diagnostic lens for those failures. It should not become a production controller. When a failure exists, A21 asks which concrete action has the best downstream value. When no failure exists, A21 should simply explain why hidden+proofDebt worked.

That is not a disappointing result. It is an excellent closeout: A21 found the right diagnostic frame, and that frame falsified the need for the patch.

## The third missing piece: human or at least non-synthetic learner evidence

The current plans still lean heavily on synthetic learners and transcript-internal probes. That is fine for local gates, but not for claims about learning.

Recent work warns that LLMs are unreliable as proxy students: one study placed LLMs and real students on the same IRT scale and found that no evaluated model-prompt pair reliably fit average grade-level student behavior across subjects and grades. Another study comparing AI-simulated and human tutoring dialogues found that human dialogues were more cognitively guided and diverse, while simulated dialogues converged toward simpler explanation-response loops.

This matters because didactic mode is specifically about “the learner is not learning this thing.” That cannot be validated solely by a synthetic learner that may be too compliant, too fluent, too brittle, or too shaped by prompt artifacts.

A recent LLM proof-tutoring study is also instructive: access to an LLM-based proof tutor improved homework performance but did not significantly improve exam performance or time-on-task, and interviews raised over-reliance concerns. That is almost exactly the distinction your harness risks missing: grounded assisted performance is not the same as durable learning.

So the evaluation ladder should be:

1. **Mechanical proof gate**: final D, release timing, overreach, non-leak.
2. **Public ownership probes**: own-words, contrast, transfer, recovery.
3. **Blinded transcript-pair ratings**: dialogue quality, learner ownership, didactic clarity.
4. **Human-reader panel**: does the assertion feel earned?
5. **Human learner mini-study**: near/far transfer after interaction.

Do not jump straight to paid full runs before the ownership probes exist.

## The plan inconsistency to clean up

There is a governance issue in the current files.

The Didactic Mode Plan says its activation gate is: do not begin implementation until the current discursive calibration arm concludes and its final evidence is summarized. But the same plan records that Phase 1 through Phase 4 have already been implemented and locally gated.

That may be fine in practice—you may have intentionally moved ahead locally—but as a research ledger it creates ambiguity. Either:

- mark the activation gate as superseded by a local-only implementation exception; or
- state that the discursive arm has concluded; or
- split “design/implementation scaffold” from “experimental activation.”

This matters because the paper discipline elsewhere is very strict: no promotion, no paid run, no claim without gates. The plan should apply the same discipline to its own activation language.

There is also a residual textual collision in the active plan: after the new reframing says to retain hidden+proofDebt and test an orthogonal discursive layer, the document still retains older Phase 6/progress-policy language about conduct-progress policy and Hethel replay gates. That should be archived or explicitly marked “closed/legacy” so the next implementer does not accidentally continue the wrong arc.

## Direct answers to the closeout questions

**1. Is the closeout too conservative?**

No. It is the right stopping point for proof-control policy promotion. A20 produced infrastructure, A21 produced diagnosis, and hidden+proofDebt remains the production proof-control arm.

**2. Does Phase 9 count as A21 success?**

Yes, but as **explanation**, not as **promotion**. A21 succeeded by showing why the failed A20 overlay was wrong and why hidden+proofDebt was already right. It did not justify a runtime patch.

**3. Should you search for a trigger where hidden+proofDebt does not pick the top action?**

Only for proof-control research, and only through a predeclared failure atlas. Do not hunt until you get a favorable anecdote. First catalog hidden+proofDebt failures; then run A21-style action-value analysis on those triggers.

**4. What is the next evaluation frame?**

A two-track frame:

- **Reliability track**: hidden+proofDebt no-harm gate.
- **Learning-quality track**: ownership probes + transcript-pair scoring.

The closeout analysis is right that the derivation harness should remain a safety gate but not the sole evaluator for discursive, rhetorical, didactic, or persona layers.

**5. Which rubric first?**

Revive the **learner rubric first**, but modify it for derivation ownership. Then use dialogue quality as a paired transcript measure. Tutor holistic and poetics can follow, but they should not be primary until learner ownership is measurable. Poetics is valuable, but it is too easy to win aesthetically while doing nothing educationally.

**6. Must future policies beat hidden+proofDebt on formal proof metrics before aesthetic/pedagogical evaluation?**

For proof-control policies: yes.

For didactic/discursive/rhetorical overlays: no. They should instead satisfy:

```text
proof-control no harm
+
measurable ownership or transcript-quality gain
```

That is the bifurcation your plans are pointing toward.

## My recommended next move

Do **not** run a paid didactic mini-run yet. The Didactic Mode Plan itself says the local S0/S1 mock pair changed explanatory regime but did not improve uptake, engagement, turn count, impasse risk, or final grounding enough to warrant paid validation.

Run one more **zero-paid evaluator-building arc** first:

1. Freeze hidden+proofDebt as the proof-control substrate.
2. Choose 6–10 proof objects that recur across Hethel/Withercombe/Ravensmark.
3. For each object, build public ownership probes:
   - own-words;
   - contrast case;
   - purpose bridge;
   - near-transfer;
   - recovery after distractor.
4. Score S0/S1 transcript pairs where proof outcome is held fixed.
5. Only then decide whether didactic mode earns a paid mini-run.

The object you want is not “adaptive controller.” It is:

> A proof-safe tutor that changes explanatory regime when public evidence shows the learner does not yet own the current object.

That is the right object. But the next missing artifact is **not another policy**. It is the **ownership evaluator** that can tell whether the new policy matters.
