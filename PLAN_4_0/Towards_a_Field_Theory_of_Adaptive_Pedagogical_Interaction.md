# Towards a Field Theory of Adaptive Pedagogical Interaction

## Abstract

Artificial intelligence tutoring systems have traditionally
conceptualized adaptation as a property of the tutor: the tutor
estimates the learner's state and selects pedagogical actions intended
to maximize learning. Large language model (LLM) tutors have largely
retained this architecture, differing primarily in the sophistication of
their language generation.

This paper argues that such architectures are fundamentally asymmetric.
Teaching is not the optimization of one agent acting upon another. It is
the continuous co-construction of a shared pedagogical process.

We introduce a **Field Theory of Adaptive Pedagogical Interaction
(FTAPI)**, a computational framework in which learner, tutor, and
pedagogical discourse are represented as coupled dynamic fields evolving
over a graph-structured conceptual topology. Adaptation is redefined as
the control of this joint interaction field rather than the optimization
of a learner model alone.

Within this framework, the language model functions as a semantic
reasoning engine embedded within a larger dynamical architecture.
Pedagogical intelligence emerges from the interaction between explicit
field estimation, trajectory prediction, discourse evolution, and
pedagogical planning.

------------------------------------------------------------------------

# 1. Introduction

The central proposition is simple:

> Learning does not happen inside the learner.
>
> Teaching does not happen inside the tutor.
>
> Learning happens **between** them.

The primary object of adaptive tutoring is therefore neither the learner
nor the tutor, but the evolving pedagogical interaction.

------------------------------------------------------------------------

# 2. The Problem with Current Architectures

Most tutoring architectures follow:

``` text
Learner
↓
Estimate learner state
↓
Tutor chooses action
↓
Learner responds
```

This assumes the learner changes while the tutor remains effectively
static.

However, expert teachers continuously revise hypotheses, invent
analogies, alter pacing, discover misconceptions, and refine
instructional strategies through interaction.

The interaction itself develops its own momentum.

Current architectures have no explicit representation of this
phenomenon.

------------------------------------------------------------------------

# 3. Three Coupled Fields

## Learner Field

Distributed over the knowledge DAG.

Examples:

-   Mastery
-   Confidence
-   Misconceptions
-   Curiosity
-   Cognitive load
-   Retention

## Tutor Field

Represents the tutor's evolving pedagogical state.

Examples:

-   Confidence in diagnosis
-   Pedagogical uncertainty
-   Preferred strategies
-   Analogy repertoire
-   Rapport
-   Active hypotheses
-   Instructional momentum

The tutor therefore also learns.

## Discourse Field

The central novelty.

Neither learner nor tutor owns it.

Instead it represents the shared pedagogical process.

Examples:

-   Concepts introduced
-   Shared vocabulary
-   Dialogue acts
-   Explanatory structures
-   Open questions
-   Commitments
-   Emotional tone
-   Interaction rhythm

This field evolves independently through interaction.

------------------------------------------------------------------------

# 4. Mathematical Formulation

The system consists of coupled dynamical systems:

``` text
L(t+1) = f(Lt, Tt, Dt, At, Ot)
```

Learner evolution.

``` text
T(t+1) = g(Tt, Lt, Dt, Ot)
```

Tutor evolution.

``` text
D(t+1) = h(Dt, Lt, Tt)
```

Discourse evolution.

These continually influence one another.

------------------------------------------------------------------------

# 5. Pedagogical Scripts

A pedagogical script is not a lesson plan.

It is a trajectory through discourse space.

Example:

``` text
Prediction
↓
Failure
↓
Repair
↓
Generalisation
↓
Transfer
```

Different learners instantiate the same script differently.

Different tutors realise it differently.

The planner therefore reasons over scripts rather than isolated dialogue
turns.

------------------------------------------------------------------------

# 6. Knowledge Topology

The knowledge DAG constrains:

-   prerequisite relations
-   propagation of understanding
-   misconception spread
-   transfer

The discourse field is not constrained to follow the DAG exactly. Good
teaching frequently jumps, revisits, reframes, and anticipates concepts.

------------------------------------------------------------------------

# 7. Trajectory Prediction

Instead of predicting only the next response:

``` text
Current learner
↓
Next response
```

the planner predicts:

``` text
Learner trajectory
Tutor trajectory
Discourse trajectory
↓
Joint future
```

Pedagogical interventions are selected according to their influence on
the coupled system.

------------------------------------------------------------------------

# 8. Role of the LLM

The LLM serves as a semantic engine.

It performs:

-   Interpretation
-   Simulation
-   Generation
-   Reflection
-   Critique

It realises pedagogy rather than determining pedagogy.

------------------------------------------------------------------------

# 9. Visualisation

Three synchronized visualisations evolve continuously:

-   Learner field
-   Discourse field
-   Tutor field

Predicted futures branch from the current interaction.

The planner selects among these futures.

------------------------------------------------------------------------

# 10. Learning the Tutor

Because the tutor field evolves, the tutor can explicitly:

-   discover better analogies
-   refine pedagogical hypotheses
-   learn successful scripts
-   improve instructional style

------------------------------------------------------------------------

# 11. Towards Collective Pedagogy

The framework naturally extends to:

-   multiple learners
-   multiple tutors
-   shared discourse fields
-   collaborative learning

------------------------------------------------------------------------

# 12. Discussion

The contribution is not another tutoring algorithm.

It is a change in ontology.

Current systems optimise agents.

This framework models relationships.

Current systems estimate states.

This framework estimates fields.

Current systems react.

This framework predicts trajectories.

Current systems generate responses.

This framework cultivates evolving pedagogical interactions.

------------------------------------------------------------------------

# A Further Step: Scripts as Computational Objects

Pedagogical scripts become first-class computational objects.

The hierarchy becomes:

1.  Knowledge DAG --- what can be learned.
2.  Coupled fields --- the evolving condition of learner, tutor, and
    discourse.
3.  Pedagogical scripts --- structured trajectories through interaction
    space.
4.  Planner --- selects and adapts scripts.
5.  LLM --- realises scripts through natural language.

This reframes adaptive tutoring as the control of a coupled pedagogical
system rather than optimisation of an isolated learner model.
