# Dynamic Learner Fields: A Geometric Architecture for Adaptive LLM Tutoring

## Abstract

Most adaptive tutoring systems model the learner as a sequence of
discrete states from which pedagogical actions are selected. Large
language model (LLM) tutors have largely inherited this paradigm,
relying on prompt engineering or dialogue history to approximate
adaptation. We argue that this formulation is fundamentally limited.
Adaptation is not principally a problem of selecting responses from the
current learner state, but of predicting and shaping the learner's
developmental trajectory.

We propose a **Dynamic Learner Field Architecture (DLFA)**, in which
learner knowledge is represented as a temporally evolving field defined
over a graph-structured knowledge topology. Rather than maintaining a
single learner state, the system estimates a dynamic field describing
epistemic, affective, metacognitive, and interactional properties
distributed across a prerequisite knowledge graph. Pedagogical planning
becomes a trajectory optimization problem: selecting interventions that
steer the learner field toward desirable regions while avoiding
undesirable attractors such as disengagement, brittle learning, or
persistent misconceptions.

Within this architecture, the LLM is not itself the adaptive controller.
Instead, it functions as a semantic reasoning engine that interprets
learner dialogue, predicts likely consequences of interventions, and
realizes pedagogical plans as natural language. Adaptation emerges from
the interaction between explicit learner modelling, predictive
trajectory estimation, pedagogical planning, and language realization.

------------------------------------------------------------------------

# 1. Motivation

Most current LLM tutors implement adaptation through prompt
modifications, retrieval of prior dialogue, or reinforcement learning
over dialogue policies. These approaches treat adaptation as a property
of the language model.

Our hypothesis is that adaptation should instead emerge from the
interaction of four explicit components:

-   Learner modelling
-   Trajectory prediction
-   Pedagogical planning
-   Language realization

------------------------------------------------------------------------

# 2. From Learner State to Learner Field

Traditional ITS maintain a learner state `s_t`.

Instead define a learner field over a knowledge DAG:

    X_t(v)

where each node contains latent estimates such as:

-   Mastery
-   Confidence
-   Cognitive load
-   Engagement
-   Productive confusion
-   Retention strength
-   Misconceptions

The learner therefore becomes a multidimensional field over the
curriculum graph.

------------------------------------------------------------------------

# 3. Temporal Geometry

The important object is not the current learner state but its evolution.

Useful geometric concepts include:

-   Position
-   Velocity
-   Acceleration
-   Curvature
-   Attractors
-   Phase transitions
-   Uncertainty

Examples:

-   Productive confusion = temporary movement away from mastery before
    convergence.
-   Plateau = velocity approaches zero.
-   Breakthrough = high curvature followed by acceleration.
-   Persistent misconception = stable attractor.

------------------------------------------------------------------------

# 4. Dynamic Field Estimation

The learner field evolves according to

    X_{t+1} = F(X_t, G, a_t, o_t) + ε

where:

-   `G` = knowledge DAG
-   `a_t` = pedagogical action
-   `o_t` = learner evidence
-   `ε` = uncertainty

The architecture estimates both the field and its local dynamics.

------------------------------------------------------------------------

# 5. Pedagogical Planning

Planning asks:

> Which intervention produces the most desirable future trajectory?

Candidate actions include:

-   Explanation
-   Socratic questioning
-   Analogy
-   Retrieval practice
-   Worked example
-   Challenge
-   Reflection

------------------------------------------------------------------------

# 6. Multi-scale Objectives

The planner simultaneously optimises:

-   Micro (conversation)
-   Meso (concept learning)
-   Macro (expertise development)

Rewards include:

-   Mastery
-   Retention
-   Transfer
-   Curiosity
-   Self-regulation
-   Calibrated confidence

------------------------------------------------------------------------

# 7. Role of the LLM

The LLM becomes a semantic engine rather than the pedagogical
controller.

It serves as:

1.  Interpreter
2.  Simulator
3.  Generator
4.  Critic
5.  Reflector

Policy remains external.

------------------------------------------------------------------------

# 8. Architecture

    Learner
    ↓
    Evidence acquisition
    ↓
    Dynamic learner field
    ↓
    Trajectory prediction
    ↓
    Pedagogical planner
    ↓
    Dialogue strategy
    ↓
    LLM realization
    ↓
    Tutor response

------------------------------------------------------------------------

# 9. Visual Analytics

Potential visualisations include:

-   Living knowledge DAG
-   Dynamic learner field
-   Learner trajectories
-   Vector fields
-   Phase portraits
-   Predicted futures
-   Multi-field overlays

------------------------------------------------------------------------

# 10. Relationship to Prior Work

Relevant traditions include:

-   Intelligent Tutoring Systems
-   Bayesian Knowledge Tracing
-   Graph Knowledge Tracing
-   Reinforcement Learning
-   POMDPs
-   Model Predictive Control
-   Dynamic Systems Theory
-   Neural ODEs and continuous latent dynamics

The contribution is the synthesis of these ideas into a graph-structured
dynamic learner field with explicit trajectory estimation and
pedagogical control.

------------------------------------------------------------------------

# 11. Research Questions

1.  Can learner state be represented more effectively as a dynamic
    field?
2.  Does trajectory-conditioned planning outperform state-conditioned
    planning?
3.  Can LLMs function effectively as interpreters and simulators without
    serving as the policy?
4.  Can learner-field visualisations improve interpretability?
5.  Can graph-structured dynamic fields improve long-horizon adaptation?

------------------------------------------------------------------------

# Central Insight

The key shift is from reasoning over learner **states** to reasoning
over the **geometry of learning trajectories**.

The adaptive intelligence lies not inside the LLM itself, but in
modelling, predicting, and shaping the learner's evolving field across
the knowledge graph.
