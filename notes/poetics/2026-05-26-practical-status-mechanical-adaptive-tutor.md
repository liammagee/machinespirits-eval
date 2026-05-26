# Practical Status: From Poetics Sidecar To Mechanical Adaptive Tutor

Date: 2026-05-26

Status: working note, no new experiment. This note records where the dramatic
recognition/adaptation branch stands in practice and what would make the work
durable beyond repeated generation and scoring cycles.

## The Core Question

The practical question is not only "what did the latest run show?" It is:

> What are we producing, and how does it become a mechanical adaptive tutor rather
> than a growing archive of generated dialogues?

The answer should be: we are producing a mechanism specification and a set of
instrumented traces that can become an adaptive tutor control loop. The
generations are evidence and calibration material. They are not the final output.

## Current Practical Position

The branch is now well beyond a one-off script generator. It has a real poetics
sidecar:

- paired tutor/learner drama generation;
- preserved full tutor and learner ego/superego traces;
- blind scoring with multiple external critics;
- browser review surfaces;
- disagreement queues and review flags;
- branch-validity and tutor-adaptation diagnostics;
- scenario-role annotations for clean anchors, boundary cases, and peripeteia
  targets.

This means the project has a working laboratory apparatus for discovering and
testing adaptive mechanisms.

It does not yet mean the project has a stabilized mechanical adaptive tutor.

## What Is Strong

The strongest current result is still the public recognitive-reframe mechanism.
When the learner is explicitly made to revisit and reframe earlier wording, the
public transcript reliably takes recognitive form under the four-critic rule.

This supports a bounded claim:

> Explicit public learner-reframe cues can induce recognitive form when bracketed
> by flat prefix/routine controls.

The low-organic control work has also materially improved. D42 and D45 are now
the best clean anchors. D35 and D37 have been correctly moved away from clean
negative-control status:

- D35 is an organic-reversal boundary case.
- D36 is a pseudo-catharsis peripeteia target.
- D37 is a quality/leakage boundary item until revised.
- D42 and D45 are current clean low-organic anchors.
- D47-D49 are fresh low-organic candidates being screened.

This is real progress because the scenario set is no longer pretending that every
interesting dramatic scene is also a clean negative control.

## What Is Not Yet Strong

Tutor-private peripeteia is structurally real but not robust.

The architecture can now pass a learner pressure or pseudo-catharsis event into
the tutor side. The tutor inner exchange can sometimes change route, and
diagnostics can detect private route changes, public habit-breaks, tutor uptake,
and actional breakthrough.

But the public mechanism does not reliably appear without the learner-reframe
cue. In the clean D42/D45 local smoke, `peripeteia-only` remained negative under
the four-critic consensus rule, even when branch-local learner pressure was
present. The sidecar also found zero public habit-breaks in that smoke.

The correct current reading is:

> The tutor-private peripeteia route is a design target and diagnostic construct,
> not yet a settled empirical effect.

This is not failure. It tells us where the mechanical tutor must be strengthened:
not merely detecting pressure, but converting pressure into a visible new
teaching device.

## What The Output Should Be

The durable output should have three layers.

### 1. Mechanism Specification

A compact architecture-level specification should define:

- learner object-relation;
- aporia type;
- false-closure or pseudo-catharsis signal;
- current tutor route;
- failed route;
- candidate adaptive move;
- expected public learner work;
- expected tutor answerability;
- outcome labels: flat, trap, recognition, actional breakthrough, public
  habit-break.

This is the positive sense of "mechanical": the tutor has explicit moving parts
that can be inspected, revised, tested, and reused.

### 2. State-Action-Outcome Dataset

The generated traces should be distilled into structured records:

```text
context + learner state + detected pressure
-> selected tutor move
-> tutor public response
-> learner public response
-> critic/human labels
-> mechanism diagnostics
-> failure notes
```

Raw transcripts are evidence. Curated state-action-outcome rows are the durable
substrate.

### 3. Adaptive Tutor Control Loop

The mechanism should then be promoted from sidecar into the tutor architecture:

1. detect learner pressure or false closure;
2. classify the type of aporia;
3. decide whether to continue, diagnose, reframe, reverse, repair, challenge, or
   change the task;
4. generate a tutor response constrained by the selected move;
5. critique whether the response actually changed route;
6. observe whether the learner response is flat, trapped, recognitive, or
   actionally transformed.

Until that loop exists, the work remains a laboratory apparatus rather than a
mechanical adaptive tutor.

## Where Machine Learning Begins

At present, most of the system is prompted inference plus evaluation. It becomes
machine learning when accumulated labeled traces are used to train, tune, rank,
or select future behavior.

The most plausible sequence is:

1. **Prompted architecture.** Encode the theory and mechanism by prompt and
   explicit state.
2. **Classifier-assisted tutor.** Train or prompt a smaller component to classify
   aporia type, false closure, pseudo-catharsis, or actional breakthrough.
3. **Move selector.** Use structured examples to predict the next tutor move from
   state.
4. **Supervised fine-tune.** Fine-tune narrow components on curated
   state-action-response examples.
5. **Preference/ranking model.** Rank candidate tutor moves by dialogical
   answerability and public mechanism visibility.
6. **Policy learning.** Learn which moves improve later learner state, not merely
   immediate critic score.

Fine-tuning the whole tutor too early would likely bake in noise from the current
calibration loop. The better first targets are narrow:

- pressure detector;
- aporia classifier;
- tutor move selector;
- actional-breakthrough detector;
- dialogical-answerability judge.

## How Far Down The Path We Are

Approximate practical status:

| Destination | Current status |
|---|---|
| Dramatic-generation sidecar | Mature enough for continued diagnostic use |
| Bounded public-reframe claim | Near reportable, with four-critic consensus and clean anchors |
| Clean low-organic control set | Partly stabilized: D42/D45 strong, D47-D49 under screen |
| Tutor-private peripeteia mechanism | Real in traces, not reliable in public form |
| Mechanical adaptive tutor | Designed in outline, not yet implemented as the main control loop |
| Machine-learning-ready corpus | Early: raw and semi-labelled traces exist, curation still needed |

The current body of work is close to a natural end as a research-calibration arc.
It is not close to an end as an adaptive tutor engineering project.

## Recommended Transition Point

Stop broad generation once the current fresh low-organic prefix/routine screen is
resolved. Then move from generation to distillation.

The next phase should be:

1. freeze D42/D45 as current calibration anchors;
2. accept or reject D47-D49 using cheap prefix/routine criteria;
3. run one small adaptation smoke only on candidates that stay flat;
4. create a mechanism-spec document;
5. export a curated state-action-outcome table;
6. implement the control loop in the main adaptive tutor path;
7. only then consider fine-tuning or learned move selection.

## Termination Rule For The Current Arc

This phase should end when we can say:

> The sidecar has established clean floors, a robust public-reframe manipulation,
> and a clear failure boundary for tutor-private peripeteia. The next work is no
> longer more broad generation; it is mechanism distillation into tutor state,
> policy, and curated training/evaluation data.

That is a productive endpoint. Continuing to generate without that transition
risks turning the apparatus into a search loop for ever-cleaner examples rather
than a path toward the mechanical adaptive tutor.
