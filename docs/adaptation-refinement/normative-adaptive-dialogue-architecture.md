# Normative Adaptive Dialogue Architecture

**Status:** Draft design specification  
**Origin:** Research discussion, 9 August 2026  
**Scope:** Proposed refinement of the Machine Spirits Eval adaptive tutoring architecture

## 1. Purpose

This document describes a proposed refinement to the adaptive tutoring architecture.

The purpose is not to replace the frontier model's implicit conversational intelligence. Instead, it is to make selected aspects of adaptive reasoning explicit enough to inspect, evaluate, modify, and compare.

The core design question is:

> **How can the tutor recognize meaningful divergence between the conversation it expects and the conversation that is actually occurring, and use that divergence to warrant a change in pedagogical stance?**

## 2. Core Principle

The system should not optimize only for the next response.

It should represent and manage the **trajectory of the conversation**.

A useful distinction is:

- **Normative trajectory:** what the lesson expects or licenses.
- **Descriptive trajectory:** what the interaction has actually produced.

Adaptation is then understood partly as management of divergence between those trajectories.

## 3. Non-goals

This proposal should not:

- build another elaborate hidden-state model of the learner;
- duplicate the natural-language dialogue in symbolic form;
- replace the frontier model as the primary language generator;
- turn the lesson plan into a rigid turn-by-turn script;
- assume that every divergence is a failure;
- equate pedagogical figure with surface register;
- introduce new ontology where existing repository objects already provide equivalent semantics.

## 4. Architectural Constraint: Audit Before Extension

The current Lesson DAG and recent adaptive ontology work must be treated as canonical starting points.

Before implementing the architecture below, perform a semantic audit of:

- the DAG abstraction;
- clue/lesson progression;
- adaptive trigger machinery;
- evaluation rubrics;
- pedagogical figure / adaptive mood ontology;
- negative-register work, particularly PR 617.

The default engineering preference should be:

> **Extend or reinterpret existing objects before introducing new ones.**

## 5. Existing Normative Spine: Lesson DAG

The Lesson DAG currently appears to provide the main normative structure for lesson progression.

At minimum it represents some combination of:

- conceptual dependencies;
- clue ordering;
- progression through a lesson;
- conditions for advancing or revisiting material.

The audit must establish its exact implemented semantics.

The proposed architecture assumes that this DAG remains the conceptual normative spine unless the audit demonstrates that a separate representation is necessary.

## 6. Descriptive Dialogue Trace

The natural-language dialogue remains the authoritative record of what actually happened.

A descriptive trace should extract only information required for adaptive comparison.

Candidate events include:

- clue delivered;
- concept introduced;
- evidence of uptake;
- failed uptake;
- repetition;
- learner resistance;
- one-word / low-information response;
- explicit confusion;
- successful repair;
- strategy repetition;
- pedagogical figure change;
- register change.

The trace should be lightweight and derived from the dialogue rather than treated as a hidden psychological model.

## 7. Commitment Layer

A commitment layer may represent selected normative facts about the interaction.

Candidate fields include:

- current lesson commitments;
- tutor pedagogical commitments;
- learner commitments evidenced in dialogue;
- warrants supporting those commitments;
- entitlements / licensed next moves;
- conditions that would defeat or revise a commitment.

The terminology should be tested against Brandomian commitments, entitlements, and inferential warrants without importing philosophical machinery that is not computationally useful.

### Example

```yaml
commitment:
  actor: tutor
  proposition: persist_with_current_explanatory_strategy
  warrant:
    - learner_has_not_yet_seen_second_example
    - prior_response_contains_partial_uptake
  defeaters:
    - repeated_failure_after_multiple_repairs
    - interactional_disengagement
```

This example is schematic, not a final schema.

## 8. Normative Expectation

The normative trajectory should be richer than a fixed number of turns per clue.

Possible expectation types include:

### 8.1 Conceptual expectations

- concept B normally follows evidence of understanding of concept A;
- clue C should not be introduced before prerequisite P;
- repeated failure may license revisiting an earlier node.

### 8.2 Interactional expectations

- an explanation normally produces some evidence of uptake, objection, or clarification;
- repeated identical learner responses reduce confidence that the current pedagogical strategy is working;
- sustained low-information turns may indicate stalled interaction.

### 8.3 Pacing expectations

- prolonged residence around one lesson node may become significant;
- unusually rapid progression may lack evidence of uptake;
- repeated retries without new information may warrant revision.

### 8.4 Epistemic expectations

- learner confidence should be distinguished from demonstrated understanding;
- tutor claims of successful progression should be supported by dialogue evidence.

These expectations should be probabilistic or defeasible where possible, not rigid rules.

## 9. Divergence Engine

The divergence engine compares normative expectations with descriptive events.

It should produce a structured diagnosis rather than only a scalar score.

### 9.1 Quantitative component

Possible metrics:

- persistence;
- magnitude;
- number of failed repair attempts;
- turns since expected uptake;
- lesson-node distance;
- repeated-strategy count.

### 9.2 Qualitative component

Candidate divergence classes:

- conceptual;
- interactional;
- engagement;
- pacing;
- epistemic;
- strategy exhaustion.

These categories must be reconciled with existing rubrics and ontology before implementation.

### 9.3 Productive divergence

The engine must not assume all divergence requires repair.

A learner may depart from the lesson plan in a way that is pedagogically productive.

Therefore the output should distinguish, for example:

```yaml
divergence:
  dimension: conceptual
  magnitude: moderate
  persistence: 2
  interpretation: productive
  repair_warranted: false
```

from:

```yaml
divergence:
  dimension: interactional
  magnitude: high
  persistence: 5
  interpretation: stalled
  repair_warranted: true
```

## 10. Warrant / Revision Decision

A key architectural boundary should separate:

1. detecting divergence; and
2. deciding that adaptation is warranted.

The tutor should not shift register simply because a negative learner signal is detected.

Instead:

```text
signal
  ↓
divergence
  ↓
evidence accumulation
  ↓
warrant threshold
  ↓
revision of pedagogical commitment
```

This makes adaptation testable at the decision point.

Evaluation can ask:

- Was the diagnosis correct?
- Was sufficient evidence present?
- Was the revision premature?
- Was it delayed?
- Was no revision the better decision?

## 11. Pedagogical Figure as Repair Policy

A pedagogical figure should be treated as an abstract repair policy or interactional stance rather than a surface tone.

Tentative examples might include:

- guide;
- challenger;
- supporter;
- provocateur;
- diagnostician.

The canonical names should come from the existing ontology rather than this draft.

The figure answers:

> **What kind of pedagogical relationship should govern the next stretch of interaction?**

It may persist across several turns.

## 12. Register and Linguistic Realization

Register is downstream of the pedagogical figure.

Possible devices include:

- directness;
- humour;
- irony;
- sarcasm;
- analogy;
- metaphor;
- reassurance;
- challenge.

A single pedagogical figure may admit multiple linguistic realizations.

This separation is important for evaluation:

- Was the figure appropriate?
- Was the chosen register appropriate for the figure?
- Did the generated utterance faithfully realize the register?

## 13. Adaptive Loop

A conceptual pipeline is:

```text
Lesson DAG / normative expectations
              ↓
        Dialogue event
              ↓
      Descriptive update
              ↓
      Commitment update
              ↓
      Divergence analysis
              ↓
     Warrant / entitlement
              ↓
 Pedagogical figure revision?
              ↓
       Register selection
              ↓
  Frontier-model realization
              ↓
        Learner response
              ↺
```

This should be treated as a conceptual decomposition, not a requirement that every stage become a separate model call.

## 14. Adaptive Trace

Every meaningful adaptive decision should emit a structured trace.

Suggested fields:

```yaml
turn: 18

expected:
  lesson_node: clue_4
  evidence: learner_demonstrates_partial_uptake

observed:
  event: repeated_nonresponsive_answer

divergence:
  dimension: interactional
  magnitude: high
  persistence: 4

current_commitment:
  figure: explanatory_support
  strategy: alternate_metaphor

warrant:
  status: satisfied
  evidence:
    - three_failed_repairs
    - no_new_learner_information
    - lesson_progress_stalled

revision:
  from: explanatory_support
  to: challenge
  register_candidate: dry_humour

realization:
  text: "..."

outcome:
  pending: true
```

The final schema should reuse existing repository types wherever possible.

## 15. Evaluation Architecture

Current dialogue-level evaluation should remain, but a second family of tests should evaluate the adaptive process itself.

### 15.1 Diagnosis evaluation

Was the divergence classified correctly?

### 15.2 Warrant evaluation

Was adaptation warranted at this point?

### 15.3 Timing evaluation

Was the intervention premature, timely, or late?

### 15.4 Figure evaluation

Was the selected pedagogical figure appropriate?

### 15.5 Realization evaluation

Did the utterance faithfully express the selected figure/register?

### 15.6 Effect evaluation

Did the intervention improve the relevant divergence measure in subsequent turns?

### 15.7 Baseline comparison

Did explicit instrumentation produce behaviour materially different from the uninstrumented frontier model?

This comparison is critical.

## 16. Debugging and Visualization

Debugging should operate at the same abstraction level as the theory.

A replay UI should show synchronized tracks for each turn:

```text
Dialogue
Lesson / DAG expectation
Descriptive events
Commitments
Divergence
Warrant
Pedagogical figure
Register
Revision
Outcome
```

Selecting an adaptation event should answer:

> **Why was this change warranted here?**

Desirable capabilities include:

- inspect evidence for a divergence diagnosis;
- inspect current and prior commitments;
- see when a threshold was crossed;
- compare expected vs observed trajectory;
- replay without a figure/register change;
- compare instrumented and frontier-model baseline runs.

## 17. Initial Experimental Corpus

Do not begin with broad benchmarks.

Start with a small set of carefully annotated dialogues:

1. **Smooth progression** — adaptation should rarely fire.
2. **Clearly difficult learner** — multiple failed repairs and an obvious candidate shift.
3. **Borderline case** — reasonable evaluators may disagree about whether revision is warranted.
4. **Productive divergence** — deviation from the lesson plan that should not trigger repair.

For each dialogue, annotate a small number of explicit decision points.

This corpus becomes a gold-standard test bench for the instrumentation.

## 18. Implementation Plan

### Phase 0 — Semantic audit

- inspect DAG implementation;
- inspect recent adaptive PRs;
- map existing objects against this design;
- produce a "reuse / extend / new" table.

### Phase 1 — Trace-only prototype

Without changing tutor behaviour:

- derive expected trajectory;
- derive descriptive events;
- log candidate divergence;
- produce visual/debug trace.

This tests whether the proposed representation explains existing conversations.

### Phase 2 — Warrant evaluation

Add explicit adaptation-decision annotations:

- revision warranted;
- revision not warranted;
- uncertain.

Compare automated decisions with gold annotations.

### Phase 3 — Figure policy

Connect warranted divergence states to existing pedagogical figures.

Still separate policy selection from linguistic realization.

### Phase 4 — Register realization

Use recent negative-register work, including PR 617, as a conspicuous test case.

### Phase 5 — Baseline experiments

Compare:

- base frontier model;
- existing adaptive mechanisms;
- normative/divergence instrumentation.

Evaluate decision quality and downstream dialogue effects separately.

### Implementation status — 10 August 2026

| Phase | Current state | Boundary |
|---|---|---|
| 0 — semantic audit | complete | The existing world/DAG, learner board, action-family, stance, and audit surfaces have a grounded reuse/extend/new map. |
| 1 — trace-only prototype | complete | The offline replayer emits commitments, typed divergence, warrant evidence, hold/revise verdicts, policy recommendations, realization, and available outcomes from existing traces. |
| 2 — warrant evaluation | third fresh gate complete; failed | Typed contracts were tested on a newly generated zero-overlap 18-case corpus. Fourteen hard consensuses yielded precision 0.500, recall 0.286, accuracy 0.500, below the frozen gate. |
| 3 — figure policy | typed contracts implemented; successor choice invalid | All 13 families now declare expected uptake and lifecycle transitions, but exact successor accuracy was 0/4. Public obligations and inquiry completion are still absent. It is not a validated policy. |
| 4 — register realization | runtime bridge complete; separate evaluation open | Active mode can override family and stance while the frontier model realizes the turn. Figure appropriateness and realization fidelity have not yet been independently scored in this study. |
| 5 — baseline experiments | n=5 complete; contract validation failed; downstream stopped | Off/observe/active execution is valid, but both decision and successor quality failed. Frozen-prefix or replicated-draw comparison remains unlicensed. |

The architecture is therefore implemented far enough to test the design's
central separation—diagnosis, warrant, repair policy, realization, and outcome—
but not far enough to claim that the provisional policy improves learning.
Authored expected-uptake events, a synchronized theory-level replay UI, and
human-learner validation remain prospective.

### Phase-5 stop result

The annotation study sharpens the next architectural boundary. A commitment
cannot be represented only as an action family plus accumulated failure
evidence. It also needs an expected learner response and an exit condition.
The fresh holdout contained both directions of error: a successful
`challenge_resistance` move should have released the tutor from that family,
while repeated requests for a specific missing comparison should have defeated
an otherwise analytic-looking hold. Generic no-growth, uptake, and repetition
counters cannot distinguish those cases.

The next normative object is therefore an action-family contract of the form
`commitment -> expected uptake within k turns -> success/defeat/expiry ->
licensed successor families`. This is the concrete form of the earlier
expected-uptake proposal, not a new prompt heuristic. Only after that object
passes new decision-level annotation should Phase 5 resume with a variance-
controlled downstream design.

### Typed-contract gate result

That action-family contract now exists and was evaluated on a third fresh
18-case corpus. Execution validity held, but the predeclared decision gate did
not: precision 0.500, recall 0.286, accuracy 0.500, transition accuracy 0/4,
and live/offline agreement 41/42. The design therefore stops before Phase 5.

The failed cases refine the object boundary again. An action-family-local
contract cannot by itself represent a public obligation created when the
learner asks the tutor to supply a named result. That obligation must persist
across family changes until it is answered, explicitly deferred, defeated, or
made unavailable. Conversely, a learner proposing to perform a public test is
not creating the same debt. The state therefore needs a speech-act-typed public
obligation ledger separate from both the learner DAG and the active family.

The action catalogue also needs an authored inquiry-completion predicate.
When the learner has integrated the available evidence, preserved the proof
limit, and no licensed exhibit remains, continuing `stage_next_step` is not a
neutral hold; `close_inquiry` becomes the warranted successor. Completion is a
normative state transition, not merely a late-turn heuristic.

The next decision-level validation must test these two objects on newly
generated cases. The current corpus is burned, and its post-hoc error analysis
cannot count as confirmation.

## 19. First Coding Task

Before adding new runtime logic, create a semantic audit document answering:

| Question | Existing implementation | Gap | Action |
|---|---|---|---|
| How is normative lesson progression represented? | TBD | TBD | audit |
| What descriptive dialogue state is stored? | TBD | TBD | audit |
| How are failed repairs detected? | TBD | TBD | audit |
| How are pedagogical figures represented? | TBD | TBD | audit |
| How are registers represented? | TBD | TBD | audit |
| What does PR 617 add? | TBD | TBD | audit |
| Which decisions are already logged? | TBD | TBD | audit |

Only after this table is grounded in the codebase should the architecture be revised into an implementation spec.

## 20. Design Anchor

> **Do not ask only what the tutor should say next. Ask what the conversation should be becoming next, what evidence shows that it is or is not becoming that, and what revision is warranted when the trajectories diverge.**
