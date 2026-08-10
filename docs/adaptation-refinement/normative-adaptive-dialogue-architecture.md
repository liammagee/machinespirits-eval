# Normative Adaptive Dialogue Architecture

**Status:** Draft design specification with live/offline implementation through
typed public obligations, inquiry completion, and six-axis divergence;
instrument-confound-free mechanism validation pending
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

### Implementation status — updated 11 August 2026

| Phase | Current state | Boundary |
|---|---|---|
| 0 — semantic audit | complete | The existing world/DAG, learner board, action-family, stance, and audit surfaces have a grounded reuse/extend/new map. |
| 1 — trace-only prototype | complete; six-axis validation open | One shared live/offline projection emits explicit aligned or divergent conceptual, interactional, engagement, pacing, epistemic, and strategy-exhaustion rows with magnitude, persistence, interpretation, evidence, and repair-warrant state. |
| 2 — warrant evaluation | three calibration gates complete; V4 successor mechanism gate ready | Typed contracts were tested on a newly generated zero-overlap 18-case corpus. Fourteen hard consensuses yielded precision 0.500, recall 0.286, accuracy 0.500, below the frozen gate. A later context audit invalidated its two `close_inquiry` rows as terminal gold; a context-complete all-turn V4 protocol now adds independent per-dimension divergence judgments and gates to the opaque blind mechanism protocol. |
| 3 — figure policy | typed contracts, persistent public obligations, and terminal transitions implemented; validation open | All 13 families declare expected uptake and lifecycle transitions. A separate cross-family public-obligation ledger, typed speech acts, target-specific answer directive, and inquiry-completion object now feed the shared policy. Launch, child-seal, replay, payload, and finite-budget integrity are implemented, but this is still not a validated policy. |
| 4 — register realization | runtime bridge complete; separate evaluation open | Active mode can override family and stance while the frontier model realizes the turn. Figure appropriateness and realization fidelity have not yet been independently scored in this study. |
| 5 — baseline experiments | n=5 pilot complete; six mechanism packets burned; seventh validation next | The sixth 24-dialogue run reached 22/24 valid children and 176/176 structured parity. Two false learner-record obligations and five bounded realization-audit false negatives require a prospective clean packet before independent V4 annotation; no downstream outcome comparison is licensed. |

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

The initial audit also appeared to say that the action catalogue needed an
authored inquiry-completion predicate. A later check of the source traces
qualified that diagnosis: the two readers who selected `close_inquiry` had not
been shown that a clue was due or imminent and that most of the authored
schedule remained. Those labels are not valid terminal-closure gold. The
architectural need is narrower: expose the existing closure semantics as a
typed adaptive-trace object and give future annotators the public-safe
availability context required to judge it. Completion remains a normative
state transition, never a late-turn heuristic.

The next decision-level validation must test these two objects on newly
generated cases. The current corpus is burned, and its post-hoc error analysis
cannot count as confirmation.

### Implemented public-obligation and completion layer

The successor layer now has four explicit boundaries.

#### Public speech act and obligation debt

A deterministic, precision-first public-surface classifier distinguishes a
learner asking the tutor to supply a concrete public result from a learner
proposing to perform a test. Criterion questions and requests that the tutor
choose the next step are separate again. Only a tutor-directed result request
creates tutor-owned debt.

The debt is stored in a ledger independent of the active action-family
instance. Each row has a public target signature, creation and reminder turns,
response deadline, lifecycle status, delivery audit, satisfaction turn, and
event history. It persists through family changes. A matching public answer
satisfies it; a target-naming unavailability statement with a concrete next
public condition may defer it; otherwise it becomes overdue or reactivates.
Withdrawal or transfer can close one matching obligation. Controlled
classifier labels may corroborate the act but cannot invent the debt.

When active mode carries a blocking obligation, the target-specific directive
is compiled through response configuration into the first-draft and turn-
progression contracts. It owns the uptake before any unrelated due source,
turns the handoff declarative, and rejects a response that substitutes another
question. Structured-composition and live-text audits share the same target-
coverage and delivery check; the deterministic recovery remains inside the
public evidence boundary. Target identity is preserved without aliasing from
the ledger directive into the first-draft contract: kind, signature, subject
terms, and every required result component survive compilation. A composite
request such as a balance reading plus a ring result is satisfied only when
both components carry an answer-bearing relation; merely naming the second
component does not discharge it. A target-specific unavailable claim with a
concrete public next condition remains the separate accountable-deferral path.

#### Whole-inquiry terminal state

The completion projection reuses the learner DAG, dialogue closure, and
authored release schedule. For an ordinary production world, closure requires
strict grounded-and-asserted learner-DAG closure plus a known, exhausted
authored release scope. An optional explicit authored
bounded scope can license a bounded proof-limit conclusion only when that
scope's releases are exhausted, its terminal outcome is asserted, released
evidence is integrated, and the proof limit is preserved.

This optional branch is wired as an explicit decision-time planner input and
is frozen in live, resume, and offline decision state. It is not inferred from
turn cap, `dueNow=[]`, conclusion readiness, or release exhaustion. The current
dramatic-world and world-scaffold schemas author no bounded terminal contract,
so current production worlds project `null` here and remain on strict answer
closure. A future world-level scope schema must validate its premise set and
terminal fact and derive the four completion checks deterministically before
any world may activate this branch.

The object also records public-safe release counts and blockers. Any actionable
open, overdue, or reactivated obligation, unsupported assertion, active dropped
fact, or unintegrated public evidence blocks closure. An accountable deferral
remains recorded but is nonblocking until its named public condition occurs or
the obligation is reminded or released. `dueNow=[]`, the final sampled turn, a safety cap,
release exhaustion by itself, or local conversational completion does not
license it. A successful completion emits
`decision_kind=terminal_transition` and recommends `close_inquiry`; it is not
classified as a repair-family failure.

Active mode makes this object authoritative over the older DAG-only closure
surface. A `close_inquiry` candidate while typed completion is open becomes a
`candidate_safety_override`: use `compress_sayback` if the exhausted proof is
entailed but not asserted, re-anchor already-public evidence when integration
or memory is the blocker, otherwise continue with `stage_next_step`. The
legacy closure frame is simultaneously constrained from mandatory/available
back to open so a downstream closure contract cannot undo the veto. Observe
mode records the counterfactual decision but changes neither selection nor
lifecycle.

#### Commitment transition versus candidate override

The decision record separates the prior delivered commitment from the current
candidate:

```text
recommended family != prior delivered family
    -> commitment_transition_warranted

recommended family != current pre-gate candidate
    -> current_candidate_override_required
```

Active mode intervenes only on the second comparison. This lets the base
selector satisfy a norm without being falsely counted as overridden, and lets
an already-active `answer_accountably` family receive a concrete obligation
directive without inventing a family switch. `revision_warranted` remains a
compatibility summary for decision scoring, not the sole intervention field.

#### One reducer history live, resumed, and offline

The live decision is made after learner turn N and before tutor turn N is
generated. A release delivered on N is therefore still due at that decision.
Completed turns persist the actual delivered configuration, tutor text,
released evidence, public obligation, inquiry completion, and final outcome.
Resume reconstructs state by replaying those committed public turns. The
offline shadow shares the speech-act, ledger, completion, action-contract, and
warrant reducers and consumes delivered rather than merely proposed families.

Each current decision freezes the canonical pre-gate input as
`warrant-decision-input.v2` plus a SHA-256 digest. This makes the evidence
boundary itself inspectable and gives resume, replay, and a future frozen-prefix
branch a stable input rather than forcing reconstruction from post-delivery
state.

Active final authority applies to the complete response-configuration bundle.
The gate-selected bundle is frozen before optional point-of-action,
typed-action, and conversational-completion policies. If one of those policies
displaces it, the frozen actorial part, performance, support, task, and
selection metadata are restored together; any displaced typed action is
cancelled before delivery and its lifecycle rollback is replayable on resume.
A displaced point-of-action intervention is likewise marked
`cancelled_before_tutor_output`; prompt, release, handoff, committee, and
compliance consumers ignore it while retaining its original assignment as
provenance. Benchmark export reports the configuration actually delivered and
keeps each cancellation only as counterfactual metadata.

Study execution verifies this boundary separately from reducer parity. The
selector persists raw pre/post source snapshots and their hashes, concrete gate
inputs, and the frozen configuration digest. Live selection and verification
share one pure gate-patch function: observe and active-hold must replay to exact
inertia, while an active post-source must equal that function's complete output
with no extra field changes. Final authority persists the pre-final and frozen
pre-optional selection snapshots; the study recomputes every displaced field,
the restoration digest, compatibility markers, and enforcement provenance
instead of trusting a restoration boolean.

Final guard accounting explicitly binds the audited configuration and exact
public text delivered. The selected bundle first passes through the shared,
deterministic speaking-configuration transform when a requested performance
tactic is inapplicable. It is then either delivered exactly or transformed by
the shared simplified-recovery constructor used by the enumerated recovery
ladder; nested role, evidence, budget, or performance mutations therefore fail
equality rather than hiding inside a top-level allowlist. Speaking transitions
and guard recoveries are reported separately. Family, obligation directive,
and final-authority provenance remain fixed. An obligation is counted as
applied only when its unmutated target compiles into the first-draft progression
contract and the final live public-text audit proves either every required
answer component or a target-specific accountable deferral.

Speculative or failed turns never commit the reducer, and reset, diagnostic
rollback, or a public tutor-response rewrite invalidates the stale gate state.

For current V5 traces, parity compares the typed structure—speech act,
obligations, completion checks, lifecycle transition, decision kind, basis,
policy, prior family, current candidate, and both transition booleans—not only
the legacy warrant bit. It also compares all six divergence rows and the
decision-time pacing signal frozen in input V2.

### Fresh all-turn mechanism validation

The next experiment is predeclared as a mechanism study:

- two transfer worlds: `world_022_foxtrot_jukebox` and
  `world_028_larkspur_fridge`;
- six learner profiles: `diligent`, `low_agency`, `answer_seeking`,
  `counterexample_hunter`, `goalpost_shifter`, `fast_learner`;
- observe and active conditions only, one fresh seed per cell from master seed
  401, fixed at eight turns;
- 24 dialogues total;
- all 96 decisions from the 12 observe dialogues independently annotated;
  active decisions reserved for matched execution and exact structured parity.

The packet freezes the public opening text, situation/question, opening
evidence, and requirements in every case, then exposes public-safe release
counts so annotators can distinguish “nothing due now” from “nothing else
licensed.” It never exposes the secret or future evidence identity/content. It
contains every observe turn, not a prediction-balanced sample. Its freeze binds
protocol, source and handbook hashes, thresholds, and zero overlap with prior
corpora; any post-freeze change burns it. Paired corpus/key rows are globally
hash-shuffled and receive opaque identifiers. Reader responses have exact V4
field/type allowlists before either response can be compared with the private
key. Each response supplies interpretation, magnitude, persistence, and an
evidence note for every declared divergence dimension; predictions remain
private until both responses validate.

The execution packet is likewise evidence, not a directory convention. A
digest-bound authorization fixes the clean Git commit, recursive source and
child-policy closures, exact job commands/order, three Codex CLI roles, declared
payload scope, and maximum 64 calls per dialogue. The sanitized child
environment pins an empty committed dotenv source and removes alternate API,
Node-injection, and tutor-seam routes. A no-model probe binds both the Codex
wrapper and delegated native binary to ChatGPT-account login. Rows and resumes
are accepted only from verified child plans, event chains, seals, and artifact
hashes; the freeze binds that execution-evidence manifest.

Passage requires the original agreement/precision/recall/accuracy/successor and
diligent-control gates plus typed support and accuracy for request versus
proposal, commitment transition, current-candidate override, primary warrant
basis, obligation persistence/resolution, inquiry completion, zero unsafe
closures, and exact structured parity with non-zero observe and active
denominators. Each of the three typed decision accuracies must reach 0.75.
Each divergence dimension additionally requires 0.75 reader consensus, at
least two non-aligned hard-consensus cases, 0.70 interpretation macro-F1, 0.70
magnitude and persistence accuracy, and 0.65 joint accuracy. Insufficient
support fails inconclusively. Even a full pass would
validate only the automated mechanism and would merely license a separately
frozen variance-controlled outcome study.

### Two-surface semantic validation after the first V4 result

The first fully valid execution showed that the six-axis projection cannot be
validated from one naturally sampled corpus alone. Natural dialogue turns are
the correct denominator for descriptive prevalence, false positives, and
ordinary interaction. They do not guarantee persistence, resolution,
completion, or non-aligned support on each rare DAG layer. A prediction-
balanced sample would supply support only by contaminating prevalence.

The validation architecture therefore has two non-interchangeable surfaces:

| Surface | Construction | Licensed inference |
|---|---|---|
| `natural_prevalence` | every observe decision from a fresh matched dialogue matrix | natural state prevalence, false-positive behavior, and supported accuracy cells |
| `targeted_challenge` | separately authored public decision-time cases with a private hash-bound support plan | classification, lifecycle, completion, and per-axis accuracy at the predeclared rare-state minima |

The two corpora must be independently frozen, share one calibrated handbook,
have no public-case overlap, and be scored separately. Challenge enrichment is
never pooled into natural rates. Passage is conjunctive at the gate level, not
by concatenating rows.

Reader collection is part of the architecture rather than an informal outer
loop. Prepared batches use exact opaque sample IDs as object keys. Assembly
rejects missing or extra keys and notes shorter than the declared evidence
minimum. It may canonicalize only `none/hold` and `uncertain/uncertain` family
pairs and writes every edit to an audit. It cannot manufacture a missing note,
positive basis, or successor family. This removes annotation plumbing as a
latent seventh source of divergence.

The first V4 result also narrows two normative definitions. Conceptual
alignment permits explicit analytic testing while the record is flat; a public
stall or low-agency deferral is required for conceptual failure. Interactional
failure requires persistent, overdue, or reactivated public debt; an
obligation first opened by the current learner turn is current demand, not
already failed uptake. These boundaries now apply identically in live and
offline projection and must be tested on fresh cases.

## 19. First Coding Task (completed historical instruction)

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

The table is grounded in `semantic-audit-and-shadow-notes.md`; the runtime and
replay implementation above followed that audit. This section is retained to
preserve the design sequence.

## 20. Design Anchor

> **Do not ask only what the tutor should say next. Ask what the conversation should be becoming next, what evidence shows that it is or is not becoming that, and what revision is warranted when the trajectories diverge.**
