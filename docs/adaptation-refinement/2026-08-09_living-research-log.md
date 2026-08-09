# Living Research Log

**Date:** 9 August 2026  
**Session:** Adaptation as Normative Revision  
**Status:** Working research record

## Summary

Today's discussion marked an important shift in emphasis.

Rather than asking *how can we make the tutor adapt?*, the project increasingly asks:

> **How can adaptation itself become an explicit computational object that can be inspected, evaluated, and improved?**

This appears to be the next stage of the project.

## Observation 1 — Refinement, not reinvention

The project already contains extensive work on adaptive triggering, evaluation, learner-state modelling, policy/governance, pedagogical ontologies, adaptive moods, negative registers, and evaluation rubrics.

Future work therefore needs to begin by distinguishing itself from prior approaches rather than rediscovering them.

**Working principle:** novelty now comes from careful refinement, instrumentation, and synthesis rather than simply adding another adaptation mechanism.

## Observation 2 — Negative registers as stress tests

Negative registers such as sarcasm, irony, and challenge are not the research object in themselves.

They are useful because they are conspicuous interventions: they make a shift in tutor stance easy for a human evaluator or another model to detect.

The deeper research object is the adaptive process that licenses such an intervention.

**Hypothesis:** negative registers are best understood as stress tests for whether the tutor can identify a conversational problem, determine that ordinary repair is failing, and make a warranted shift in pedagogical stance.

## Observation 3 — Normative and descriptive trajectories

A central distinction emerged between:

- **Normative dialogue:** the trajectory the lesson expects or licenses.
- **Descriptive dialogue:** the trajectory that actually occurs.

Adaptation may be better understood as responding to divergence between these trajectories rather than reacting directly to surface learner behaviour.

The learner repeating themselves, giving one-word answers, resisting an explanation, or failing to show uptake are not merely behavioural labels. They can be treated as evidence that the actual interaction is diverging from an expected conversational trajectory.

## Observation 4 — Existing Lesson DAG as normative spine

The existing Lesson DAG already provides a normative conceptual structure: conceptual progression, clue ordering, dependencies, and expected lesson movement.

The immediate architectural question is whether this DAG can be given richer semantics rather than replaced.

### Required audit

Before new implementation:

- identify what the DAG currently represents;
- identify the semantics carried by nodes and edges;
- distinguish explicitly represented semantics from semantics left to the frontier model;
- determine whether the new proposal is an extension, reinterpretation, or genuinely separate computational object.

## Observation 5 — Pedagogical figures and registers

Pedagogical figures appear to sit at a more abstract level than linguistic register.

A tentative hierarchy is:

```text
Pedagogical problem
        ↓
Pedagogical figure
        ↓
Register / linguistic device
        ↓
Utterance
```

A pedagogical figure captures an interactional orientation or organized sequence of moves used to solve a pedagogical problem.

Register is one way in which that figure becomes linguistically visible.

Possible registers or devices include humour, irony, sarcasm, directness, metaphor, analogy, challenge, and reassurance.

This distinction should be checked against the ontology and terminology introduced in recent PRs, especially PR 617.

## Observation 6 — Commitments, warrants, and entitlements

Robert Brandom's vocabulary of **commitments**, **warrants**, and **entitlements** may provide useful formal language for the layer that is currently missing.

The problem is not simply to classify learner state.

It is to represent what conversational moves are currently licensed, what prior commitments support them, and what new evidence would warrant revision.

This makes the proposed layer normative rather than merely descriptive.

## Observation 7 — Model revision rather than hidden state

Prior attempts at explicit learner-state modelling have often failed to outperform strong frontier-model behaviour.

A potentially sharper object of instrumentation is therefore not hidden learner state but **commitment revision**.

Important questions become:

- What is the tutor committed to doing now?
- What evidence supports that commitment?
- What conversational developments undermine it?
- What alternative move becomes licensed?
- When does a register or figure change become warranted?

## Observation 8 — A shadow interpretation of dialogue

The conversation suggested maintaining an explicit computational interpretation that shadows the natural-language dialogue.

This should not become a duplicate conversation or an elaborate simulated mental state.

Instead, it would selectively represent information needed for adaptation:

```text
Dialogue
   ↓
Interpretation
   ├── commitments
   ├── warrants / entitlements
   ├── expected trajectory
   ├── observed trajectory
   ├── divergence
   └── current pedagogical figure
```

This representation should be inspectable, revisable, and evaluable.

It may ultimately be implemented by enriching existing graph semantics rather than creating a wholly separate graph.

## Observation 9 — Divergence is multidimensional

Divergence should probably not be reduced to a single scalar.

It should be both:

- **quantified:** how substantial or persistent is the divergence?
- **qualified:** what kind of divergence is occurring?

Candidate axes include:

- conceptual progression;
- evidence of learner uptake;
- interactional rhythm;
- engagement;
- persistence/repetition;
- pacing;
- epistemic confidence;
- lesson-plan alignment.

These categories should be mapped against existing rubrics and ontologies before new categories are introduced.

## Observation 10 — Adaptation as repair

Pedagogical figures may be better understood as **repair policies** than as tone choices.

A tentative loop is:

```text
Expected trajectory
        ↓
Observed trajectory
        ↓
Divergence diagnosis
        ↓
Is revision warranted?
        ↓
Pedagogical figure / repair policy
        ↓
Register / realization
        ↓
Learner response
        ↓
Updated trajectory
```

The important intervention point is therefore not "the learner is difficult → use sarcasm."

It is closer to:

> "The current pedagogical commitment is failing to produce the expected interactional movement; sufficient evidence now warrants a revision of stance."

## Observation 11 — Frontier-model baseline remains the central challenge

Frontier models already perform substantial implicit adaptation.

They track conversational history, infer intentions, vary explanations, and anticipate likely future turns without explicit instrumentation.

The project therefore needs to show what explicit machinery adds.

Possible contributions include making adaptation:

- inspectable;
- controllable;
- reproducible;
- falsifiable;
- attributable to explicit evidence;
- comparable across models;
- evaluable at decision points rather than only at whole-dialogue level.

The claim need not initially be "explicit adaptation always outperforms the frontier model."

A more defensible claim may be that explicit instrumentation creates experimentally tractable adaptive behaviour whose triggering, warrants, and effects can be measured.

## Observation 12 — Debug at the level of the theory

Prompt-level debugging is insufficient for this phase of the project.

A useful debugging view should expose parallel tracks through a dialogue:

```text
Turn
Expected lesson state
Observed dialogue event
Commitments
Divergence
Current pedagogical figure
Revision event
Register
Outcome
```

The debugger should answer:

> **Why did the tutor believe a change was warranted here?**

If the instrumentation cannot answer that question, too much of the adaptation remains implicit.

## Open Questions

1. How much of this proposal is already represented in the current DAG and recent ontology work?
2. Can divergence be classified reliably rather than merely scored?
3. Which dimensions of normative conversational flow can be specified without making the dialogue mechanically rigid?
4. Can pedagogical figures function as repair policies?
5. How should commitments, warrants, and entitlements be represented computationally?
6. Should the interpretation structure be a second graph, an extension of the existing DAG, or a smaller event/trace structure?
7. Can explicit instrumentation produce measurable differences from base frontier-model behaviour?
8. Which evaluation tasks should target the diagnosis, warrant, policy choice, realization, and downstream effect separately?
9. How should productive divergence be distinguished from divergence that should trigger repair?
10. What does PR 617 already solve in relation to this proposal?

## Immediate Next Step

Conduct a **semantic audit of the existing DAG implementation and recent adaptive ontology work before writing new mechanisms**.

The audit should determine:

1. current node and edge semantics;
2. existing representations of expected progression;
3. existing representations of observed progression;
4. current trigger/evaluation instrumentation;
5. where pedagogical figures and registers enter the pipeline;
6. what PR 617 adds;
7. which parts of the proposed normative/descriptive framework are genuinely absent.

## Session Anchor

> **Do not ask only what the tutor should say next. Ask what the conversation should be becoming next, what evidence shows that it is or is not becoming that, and what revision is warranted when the trajectories diverge.**

## Progress Update — 10 August 2026

The immediate semantic-audit step is complete. The existing world/DAG remains
the normative conceptual spine; the learner board and turn audits supply the
descriptive trace; `action_family` is the operational commitment/figure level;
and `engagement_stance` remains the downstream register level. The missing
layer was not another learner model but an explicit, evidence-bearing warrant
decision between those existing objects.

That layer now exists in shadow and live forms. Shared rules classify
decision-time divergence, a repair-policy map recommends family and stance, and
the live gate can be disabled, observed without behaviour change, or activated.
Completed-turn outcomes are carried forward to the next decision so the trace
can answer why a change was or was not warranted without using future evidence.

The Phase-5 n=5 paired pilot has completed valid execution and downstream
analysis. It establishes that explicit instrumentation can execute, record its
evidence, and produce attributable override events. It does not yet isolate a
downstream quality or learning effect: the behaviourally inert observe arm also
moved against baseline, exposing residual frontier-model draw variance despite
paired session seeds. The fresh blinded decision corpus awaits two independent
annotations, false-positive behaviour needs review, and the pilot's downstream
signals are not yet a basis for n=10 scale-up or human-learning inference.

Still open from the original log are richer authored expected-uptake semantics,
independent evaluation of figure choice and linguistic realization, a theory-
level replay UI, and validation beyond automated learner profiles.

## Progress Update — 10 August 2026, annotation and stop decision

The 18-case decision sample now has two independent blind reads. Fifteen hard-
consensus cases yielded precision 0, recall 0, and accuracy 0.600 for the live
gate's decision rule. Four false positives treated defensible evidence staging
as accumulated failure; two false negatives let the engaged-analytic mask hide
a strategy that had exhausted its usefulness.

A small rule repair fit all 15 hard primary cases, but that corpus was already
burned. A corrected zero-overlap 18-case holdout was therefore frozen and read
by two replacement annotators. On 16 hard-consensus cases the candidate again
had precision 0 and recall 0 (accuracy 0.813). Its changes were reverted. The
failed generalization matters more than the retrospective fit.

The holdout changes the architectural diagnosis. The missing object is not
only a warrant threshold; it is an action-family contract that says what uptake
the move expects and when the family has succeeded, failed, or expired. A
challenge can succeed without immediate DAG growth and should then terminate.
Conversely, a learner can remain analytically competent while a specific
request for missing evidence goes unanswered and should then force repair.

The n=10 comparison was not launched. Paired observe-minus-off learner-record
growth (+0.6 low-agency, +0.4 diligent, +0.8 affective-resistant) was as large
as or larger than active-minus-off (0.0, -0.2, +0.2), so the present paired-
seed design does not isolate an intervention effect from model-draw variance.
The next empirical loop must validate typed uptake/termination contracts first,
then use frozen-prefix counterfactual replay or explicit replicated draws.

The evidence boundary remains strict: this is internal automated-learner
calibration, not a validated repair policy, a paper result, or evidence of
human learning.
