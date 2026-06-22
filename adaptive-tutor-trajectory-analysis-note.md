---
title: "Adaptive Tutor Trajectory Analysis: Why We Are Not Yet Adapting"
date: 2026-06-15
status: working note
source_context:
  - 2026-06-15-selector-trajectory-v0-v4.md
  - consolidated research atlas / Geist mechanism paper
---

# Adaptive Tutor Trajectory Analysis

## Core diagnosis

We are not failing to build a better tutor. We are failing to make tutor improvement depend **causally on the learner's unfolding state**.

Across the atlas and the selector arc, the reliable mechanisms are all level-setting, constraint, or regulation mechanisms:

- recognition / intersubjective-pedagogy orientation calibrates the tutor from the first turn;
- superego / error correction catches residual tutor-production failures within a turn;
- hidden + proofDebt preserves proof continuity under decay;
- A18-style saved policies transfer only in gated, headroom-positive sibling cases.

These are real wins. But they are not yet adaptive tutoring in the strong sense. They do not yet show that the tutor learns from the learner's resistance and changes its future speech policy **because of that resistance**.

The mechanism paper already says the central pattern: calibration and error correction are supported; adaptive responsiveness is not. The supported effects operate primarily on tutor production, levels, and variance, not on within-dialogue slopes.

The selector trajectory adds a second negative result: the H/V selector does not discover a stable adaptive representation policy. The useful mechanism is hidden proof-continuity discipline, especially proofDebt. The v4 confidence matrix makes that plain: hidden + proofDebt is strongest; visible and selector variants add brittleness and negative transfer.

So the concise diagnosis is:

> We have built strong regulation, not adaptation.

---

## What the selector arc reveals

The selector arc began with the hope that authored proof geometry could decide whether a tutor should use a hidden proof-continuity representation or a learner-visible representation. That hypothesis has mostly collapsed.

The important empirical pattern is:

> hidden + proofDebt works because it protects the tutor from visible fluency.

A learner can sound locally coherent while the proof chain is broken. Hidden proofDebt catches unrepaired dependencies, blocks premature assertion, forces repair before advance, and preserves proof solvency under act-bounded memory.

But the selector was trying to decide **which representation to use**. The evidence suggests that the real tutoring decision is not primarily:

```text
hidden or visible?
```

It is instead:

```text
repair or advance?
release or consolidate?
assert or withhold?
confront or restage?
close an act or re-certify a prior act?
treat learner uptake as entitlement or as surface fluency?
preserve proof continuity or follow public dramaturgical momentum?
```

That is a different object. H/V is an implementation substrate, not the pedagogical control variable.

Classic intelligent tutoring systems made a distinction between an inner loop over student steps and an outer loop over task selection. The selector arc has a strong domain/proof model, but it does not yet have a comparably explicit pedagogical decision model.

That is the missing layer.

---

## Why we are failing to adapt

### 1. We keep optimizing representations when the missing object is a policy

The H/V question asks:

> What state should the tutor see?

The adaptive tutor question asks:

> Given this state, what should the tutor do now, and how should it know whether that move worked?

Those are not the same.

Hidden proofDebt gives the tutor a better private board, but it does not by itself define a tutoring policy. It says, "something is still owed." It does not fully decide whether the next move should be diagnostic, reparative, confrontational, consolidating, withholding, analogical, or permissive.

That is why v2-v4 look like ablation creep. Each version tries to route better, but the route is not the action. The selector line is trying to solve a control problem by adding representational categories.

The replacement object should be:

```text
state evidence -> entitlement judgment -> pedagogical action -> predicted learner effect -> observed uptake -> policy update
```

not:

```text
world geometry -> hidden/visible route
```

### 2. Learner-visible signals are too weakly tied to proof entitlement

Visible state is useful, but not in the way the selector needs. Lexical uptake, hesitation, echoing, page-state, and local branch closure are symptoms. They are not proof of learner entitlement.

That is why visible routes repeatedly false-positive. The learner-facing board can look healthy while the dependency chain is insolvent. The selector trajectory names this clearly: visible state often looked good while proof continuity remained fragile.

Visible state is not yet a student model. It is a transcript feature set.

A student model needs evidence variables that update beliefs about mastery, misconception, affect, confidence, independence, and ownership.

### 3. The tutor has insight without a binding action channel

A recurring pattern in the atlas is the insight-action gap. The system can notice something in deliberation, but that notice does not reliably become a changed public move.

The superego, proofDebt, and reflection machinery often create awareness. They do not always create control authority. A tutor can privately know "the learner has not earned this" and still output the locally fluent next explanation unless the architecture has a hard gate binding the diagnosis to permitted moves.

The missing mechanism is not another critic. It is a move compiler:

```yaml
diagnosis:
  learner_lacks_entitlement_to: source_premise_P
therefore_allowed_moves:
  - restage P
  - ask learner to reconstruct P
  - contrast P with a false alternative
blocked_moves:
  - advance to theorem
  - accept final assertion
  - introduce new lemma
```

### 4. The synthetic learner is too cooperative to be an adaptive signal

A real adaptive tutor needs resistance that remains resistant until acted upon. But the synthetic learners often recohere on their own. That breaks the closed loop.

If the learner recovers without the tutor's fitted action, then the tutor cannot learn from the learner as an external standard. The learner becomes a drama generator, not an environment.

Agent-learning systems such as Reflexion and Voyager work better in part because the agent receives relatively external task feedback: an environment reward, compiler error, execution failure, or game-state consequence. Our tutor often lacks an equivalent external ground. The simulated learner is generated by the same broad linguistic competence as the tutor, so it supplies theatrical uptake more easily than causal resistance.

This is why A18 matters. A18 is closer to a true environment because it asks whether a saved policy changes behavior on held-out siblings where a no-policy tutor would take the decoy. But A18 is still narrow and gated.

### 5. We are measuring adaptation too globally

The slope metric asks whether scores improve across turns. That is too blunt.

The adaptive event is local:

```text
At turn t, learner gives resistance R.
Tutor must change from default policy A to fitted policy B at t+1.
We score whether B fired, whether it preserved proof entitlement,
and whether learner response at t+2 shows the targeted kind of uptake.
```

That is not a monotone trajectory. It is a triggered policy shift.

The architecture should be evaluated at the local trigger level, not only by global tutor quality or dialogue slope.

### 6. ProofDebt is doing constraint satisfaction, not learning

Hidden + proofDebt is best described as metacognitive regulation or proof-state control. It asks:

> What obligations remain live, decayed, corrupted, unsupported, or unrepaired?

That is powerful. But it is not yet learning, because the obligation ledger does not necessarily update its policy from experienced felicities and infelicities.

ProofDebt says:

```text
do not advance; premise P is unpaid.
```

Adaptive learning would say:

```text
when P is unpaid because the learner accepted a decoy analogy,
do not restate P abstractly;
ask the learner to test the analogy against countercase C,
because prior sibling cases show that this repairs this debt.
```

That second form is the missing learned axiom.

### 7. The selector lacks a predeclared theory of when hidden hurts

A real selector needs cases where the default winner fails. v5 is only genuine if it can predeclare a world where hidden + proofDebt reliably loses and visible or visible-consolidation reliably wins.

Right now, visible-positive is mostly a residue: Hethel, mirror-dead-predicate, local false structure, dead-predicate decoy. That is not yet a theory.

The cleanest candidate property is **authored-proof overconstraint**:

> hidden proofDebt becomes harmful when the learner constructs a valid alternative proof path or representation that is not in the authored hidden geometry, and the tutor falsely treats the authored dependency as mandatory.

That would be a genuine visible-positive / learner-positive class. The learner's public construction should override the tutor's hidden authored path because the learner has earned an alternative entitlement.

Other plausible hidden-hurts classes:

- the hidden board preserves formal solvency but misses relational rupture;
- the proof graph demands repair when the learner needs consolidation of ownership;
- the tutor's private proof path blocks a productive learner-generated representation;
- the hidden ledger treats all proof-critical dependencies as equal, ignoring affective or rhetorical timing;
- the tutor keeps teaching the proof rather than teaching the learner how to know they have a proof.

These are testable, but they must be predicted before running.

---

## What we are missing

### 1. A theory of learner entitlement

The core missing construct is **epistemic entitlement**.

The adaptive tutor should not ask only:

```text
Does the learner's text resemble the answer?
Is the proof chain complete?
```

It should ask:

> What is the learner now entitled to assert, given what they have publicly reconstructed, resisted, repaired, or transferred?

This bridges hidden and visible state. Hidden proofDebt tracks what the domain requires. Visible conduct tracks what the learner has actually earned. The tutor's action is chosen from the gap between the two.

A minimal entitlement state:

```yaml
claim: "C follows from A and B"
domain_status:
  entailed_by_hidden_graph: true
  live_dependencies: [A, B]
learner_status:
  A_publicly_reconstructed: true
  B_publicly_reconstructed: false
  B_echoed_but_not_owned: true
  alternative_path_offered: false
affect_status:
  confidence: high
  frustration: low
entitlement:
  may_assert_C: false
  next_action_family: re_certify_dependency
```

That is the controller we are reaching for.

### 2. A move ontology, not just a state ontology

The tutor needs typed moves with preconditions and blocked conditions.

Example:

```yaml
move: restage_dependency
use_when:
  - hidden_dependency_live
  - learner_has_not_reconstructed_dependency
avoid_when:
  - learner_has_valid_alternative_path
  - learner_is_in_affective_rupture
expected_effect:
  - learner can state dependency in own words

move: ask_scope_test
use_when:
  - learner_resistance_is_counter_warrant
  - tutor_risk_is_validation_without_engagement
avoid_when:
  - learner lacks prerequisite concept
expected_effect:
  - learner distinguishes where warrant applies
```

Drama/rhetoric ontology becomes operational only when it constrains the next move.

### 3. A causal learner signal

The learner has to become a real environment. We need at least one of:

- human learners;
- a synthetic learner with a persistent hidden state owned outside the tutor generator;
- a programmatic learner simulator whose misconception / knowledge state cannot spontaneously recohere;
- a held-out arbiter that scores whether the learner response demonstrates the exact targeted uptake;
- a knowledge-tracing layer that updates only from public evidence and cannot be overwritten by fluent self-resolution.

### 4. A memory of validated policy axioms

A18 is the seed. The system should not remember transcripts. It should remember scoped axioms:

```yaml
axiom:
  trigger: learner gives counter-warrant after tutor explanation
  failed_default: validate and redirect
  better_move: name warrant, ask scope test, then introduce counterexample
  applies_when:
    - learner has made a substantive claim
    - resistance is conceptual, not affective shutdown
  does_not_apply_when:
    - learner is asking procedural clarification
    - learner lacks prerequisite vocabulary
  evidence:
    source_failure: A18-like attempt
    held_out_siblings: 10/14 or similar
    no_policy_baseline: decoy
```

Memory should retrieve only the few axioms whose preconditions match the current drama / proof / entitlement state.

### 5. A local counterfactual evaluation harness

Global tutor scores are not enough. The new unit should be:

```text
triggered state -> expected policy family -> tutor move at t+1 -> learner uptake at t+2
```

The key comparison should be:

```text
S0: hidden + proofDebt baseline
S1: hidden + proofDebt + learned axiom / policy controller
```

Not selector vs always-H. Not visible vs hidden. The main baseline is now hidden + proofDebt, because that is the strongest non-adaptive reliability mechanism.

---

## Deepest reason adaptation is failing

We are trying to make the tutor adapt inside a language-model conversation, but the adaptation signal is not sufficiently external to the model.

The system can generate:

- recognition;
- resistance;
- repair;
- self-reframing;
- confidence;
- insight;
- critique;
- plausible causal stories about all of the above.

But unless one of those events is anchored in a state the tutor cannot simply narrate into existence, it is not a learning signal. It is drama.

This is why the project keeps finding theatrical wins and adaptive nulls. The model is good at producing the form of mutual recognition. It is much weaker at producing a stable causal relation where the learner's resistance teaches the tutor something that changes future policy.

Missing distinction:

```text
dramatic form:
  the dialogue reads as if learning happened

adaptive mechanism:
  a learner-state constraint forced a tutor-policy update,
  and the update transfers under predeclared applicability conditions
```

Our current machinery is excellent at the first and just beginning to touch the second.

---

## What to change immediately

Stop building v5 as an H/V selector.

Build **A20: Entitlement-and-Repair Controller**.

The controller should always use hidden + proofDebt as the reliability substrate, then add an explicit policy layer:

```text
1. Parse public learner move.
2. Update proofDebt.
3. Update learner entitlement state.
4. Classify local drama/rhetoric state.
5. Select one move family:
   - repair dependency
   - ask diagnostic
   - ask scope test
   - consolidate subproof
   - block assertion
   - release next evidence
   - repair recognition rupture
   - invite final assertion
6. Generate tutor utterance.
7. Score local uptake.
8. Save axiom only if S1 beats S0 on held-out siblings.
```

Research hypothesis:

> Adaptive tutoring is not representation selection. It is entitlement-regulated move selection over a consolidated proof board, with learner-visible conduct serving as evidence and proofDebt serving as constraint.

That hypothesis preserves the selector win while abandoning the wrong hinge.

---

## Next decisive experiments

### Experiment 1: Hidden-hurts world

Construct a world where the learner develops a valid alternative proof path not present in the authored hidden geometry.

Predeclare:

```text
hidden + proofDebt should over-repair or block valid learner ownership;
visible / entitlement controller should accept the alternative path after checking it.
```

This is the cleanest possible test of whether visible state can ever override hidden proof state.

### Experiment 2: Entitlement controller vs hidden + proofDebt

Use existing H-positive worlds plus new mixed worlds. Compare:

```text
H0: hidden + proofDebt
H1: hidden + proofDebt + entitlement controller
H2: visible + proofDebt
H3: old selector / v4
```

Primary outcome:

```text
correct local move at trigger+1,
not global tutor quality.
```

### Experiment 3: Persistent-resistant learner

Create a learner with a private misconception state that does not update unless the tutor performs the targeted move. The learner must not self-recohere. The state update should be programmatic or held outside the tutor-facing model.

### Experiment 4: Axiom transfer

Run A18-style transfer but with teaching dramas:

```text
attempt-1 infelicity -> learned axiom -> held-out sibling drama -> blind arbiter
```

Report only gated headroom cases:

```text
success = S1 target && S0 decoy
ceiling = S1 target && S0 target
failure = S1 decoy/neither
artifact = cue leak/self-solve/arbiter split
```

### Experiment 5: Human or semi-human validation

Eventually this cannot stay fully synthetic. Even a small human study would help answer whether learner resistance is a real causal teacher for the tutor or just a synthetic dramatic cue.

---

## Revised interpretation of the whole trajectory

The project has not shown:

> adaptive H/V representation selection works.

It has shown:

> recognition calibrates tutor production; superego critique catches residual errors; hidden proofDebt strongly regulates proof-continuity under decay; and narrow A18-style policy memories can transfer under gated headroom. But none of these yet establishes general adaptive tutoring because the learner's resistance is not yet a stable external signal that forces a durable policy update.

The path forward is not:

```text
better selector
```

It is:

```text
proofDebt + learner entitlement + typed drama moves + counterfactual policy memory
```

That is the missing adaptive mechanism.

---

## Implementation implication for Codex / A20

Codex should treat the next implementation as a controller layer, not a selector refinement.

Minimum artifacts:

```text
src/a20/entitlement_state.ts      # learner entitlement schema and updater
src/a20/proof_debt_bridge.ts      # maps proofDebt ledger to entitlement implications
src/a20/move_ontology.ts          # move families, preconditions, blocked moves
src/a20/drama_classifier.ts       # learner resistance / uptake / rupture classifier
src/a20/policy_controller.ts      # chooses move family from entitlement + drama + proofDebt
src/a20/axiom_memory.ts           # scoped policy axiom store and retrieval
src/a20/counterfactual_runner.ts  # S0/S1 harness against hidden+proofDebt baseline
tests/a20/*.test.ts               # unit and fixture tests
exports/a20/*.jsonl               # experiment traces
exports/a20/a20-report.md         # summarized result and failure taxonomy
```

Minimum acceptance criteria:

1. Hidden + proofDebt remains the baseline.
2. The controller must output a typed move family before generating public tutor text.
3. Every move family must have explicit preconditions and blocked conditions.
4. Entitlement state must distinguish echoing from owning, and local fluency from proof entitlement.
5. At least one hidden-hurts world must be predeclared before results are known.
6. Success must be measured by local triggered move correctness and held-out sibling transfer, not only global tutor score.
7. No learned axiom enters memory unless it beats the no-policy baseline under a gated counterfactual comparison.

---

## Bibliographic anchors to keep in view

- VanLehn on inner-loop / outer-loop tutoring and step-level scaffolding.
- Cognitive Tutor / Bayesian Knowledge Tracing on student modeling.
- Kamoi et al. on limits of intrinsic self-correction without external feedback.
- Reflexion and Voyager on verbal/environmental experience learning without weight updates.
- Memory-agent work on retrieval, test-time learning, long-range understanding, and selective forgetting.
- Dialogue-act, argumentation, and rhetorical-structure traditions for a public drama ontology.
- LLM-as-judge bias work and sycophancy work for evaluation controls.
