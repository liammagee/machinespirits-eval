---
title: "Extending and Deepening Plan 2.0 Adaptation"
date: 2026-06-19
status: "Research synthesis and experimental roadmap"
suggested_repository_path: "PLAN_2_0/adaptation-extension-deep-research.md"
internal_baseline:
  - "PLAN_2_0/branch-progress-since-inception.md"
  - "PLAN_2_0/plan2-general-adaptation-closeout.md"
---

# Extending and Deepening Plan 2.0 Adaptation

## Executive conclusion

Plan 2.0 has established **policy fidelity**: when its state machinery identifies a relevant boundary condition, the repaired closed-loop policy reliably produces the intended strategy shift on the current trap-derived held-out suites. The next research frontier is **adaptation validity**:

1. Is the inferred learner state calibrated and revisable?
2. Is the selected action best under the remaining uncertainty?
3. Does the generated utterance faithfully realize that action without leaking or overspecifying?
4. Does the learner's next behavior provide evidence that the intervention worked?
5. Does the policy improve transfer, retention, and learner agency rather than merely judge-rated response quality?

The literature does **not** support simply enlarging the prompt or adding unconstrained agents. In a 75-scenario benchmark, the strongest tested LLM only marginally reproduced the adaptivity of an explicit intelligent tutoring system [[S1]](#s1). MWPTutor's finite-state hybrid architecture outperformed free-form GPT-4 tutoring [[S2]](#s2). TutorGym found that contemporary LLMs did no better than chance at identifying incorrect learner actions and were only about 52–70% accurate on valid next actions [[S3]](#s3). MetaCLASS found a strong compulsive-intervention bias: non-intervention was appropriate in 41.7% of its annotated cases, but evaluated models selected it only 4.2% of the time [[S4]](#s4).

The recommended evolution is therefore:

> **Move from a dominant-state repair policy to a calibrated belief-state controller that selects explicit pedagogical acts using expected learning value and information value, realizes those acts through grounded contracts, and updates itself from action-specific learner outcomes.**

This preserves Plan 2.0's strongest contribution—explicit, inspectable state-action control—while turning it into a stronger adaptive-learning architecture.

---

## 1. Scope and evidence discipline

This document extends the internal branch record in:

- `PLAN_2_0/branch-progress-since-inception.md` [[I1]](#i1)
- `PLAN_2_0/plan2-general-adaptation-closeout.md` [[I2]](#i2)

The internal records remain the source of truth for branch-specific cells, run IDs, strict-shift results, quality deltas, and claim limits. This document is a research synthesis and proposed program, not a new empirical result.

### Evidence hierarchy used here

The recommendations draw on four kinds of evidence:

1. **Human or deployed outcome studies**, such as adaptive scaffolding, large-scale bandit deployment, and Tutor CoPilot [[S7]](#s7) [[S12]](#s12) [[S20]](#s20).
2. **Mechanism benchmarks**, such as TutorGym, MetaCLASS, and step-level logic feedback benchmarks [[S3]](#s3) [[S4]](#s4) [[S8]](#s8) [[S10]](#s10).
3. **Learner-modeling and policy methods**, such as Dynamic LENS, DAS3H, doubly robust evaluation, and conservative offline reinforcement learning [[S5]](#s5) [[S13]](#s13) [[S14]](#s14) [[S15]](#s15).
4. **Recent architectural proposals**, such as SLOW and the Epistemic State Specification framework [[S6]](#s6) [[S19]](#s19).

Many 2025–2026 papers cited below are arXiv preprints as of June 19, 2026. They are useful design evidence, but they should not be treated as equivalent to replicated human-learning results. Proposed Plan 2.x claims should continue to distinguish simulated mechanism evidence, judge-rated transcript quality, and measured human learning.

---

## 2. What the present Plan 2.0 result establishes

| Present result | What it establishes | What remains open |
|---|---|---|
| 6/6 and 8/8 strict shifts | Fidelity of the state-to-action control path | Whether the inferred learner state is correct |
| Exact pair specificity | Discrimination among the predeclared trap cases | Calibration on ambiguous, mixed, and naturalistic states |
| Zero false-positive divergence in the paired suite | Conservative behavior within that suite | Robustness to noisy dialogue and unseen causal geometries |
| Sonnet quality improvements | Better judge-rated tutor responses | Actual learning, transfer, retention, and agency |
| 100% structural outcome closure | The loop records an outcome slot | Whether interventions cause observable state transitions |
| Mostly inconclusive closures | Honest non-overclaiming | A usable policy-learning signal |
| Mock-mode final generation | Deterministic mechanism validation | Real-generation and human robustness |

The decisive conceptual shift is from measuring only:

```text
state signal -> strategy shift
```

to measuring the complete causal chain:

```text
evidence
  -> calibrated belief
  -> candidate actions
  -> selected pedagogical act
  -> grounded realization
  -> learner response
  -> action-specific outcome
  -> updated belief and delayed learning evidence
```

---

## 3. Research synthesis

### 3.1 Explicit control remains necessary

Recent benchmarks consistently show a gap between fluent educational language and valid adaptive tutoring. The 75-scenario adaptivity study found that even the best tested model only marginally mimicked the behavior of an explicit ITS [[S1]](#s1). TutorGym showed weak step-level diagnostic and next-action performance [[S3]](#s3). A 2026 propositional-logic benchmark found that models could confirm optimal steps but systematically over-rejected valid-but-suboptimal reasoning and over-validated incorrect reasoning [[S8]](#s8).

The strongest implication is architectural: keep learner-state inference, pedagogical decision-making, domain correctness, and language realization as separable, inspectable stages. MWPTutor provides direct evidence that an LLM constrained inside a predefined pedagogical state machine can outperform free-form tutoring [[S2]](#s2). LeanTutor similarly separates proof checking, next-step generation, and natural-language feedback [[S9]](#s9).

### 3.2 Uncertainty should be represented, not hidden

Dynamic LENS demonstrates a modern learner-modeling approach that preserves epistemic uncertainty while integrating observations over time [[S5]](#s5). Classic Bayesian Knowledge Tracing likewise treats mastery as latent and updates it from observed performance rather than equating one response with a stable trait [[S22]](#s22).

For Plan 2.x, this supports replacing a single dominant learner-state label with a distribution over plausible states. The goal is not necessarily a full POMDP solver on day one. The immediate value is to make uncertainty explicit, preserve competing hypotheses, and permit reversal when contradictory evidence appears.

### 3.3 Adaptation should include selective non-intervention

MetaCLASS operationalizes tutoring as selection among interpretable metacognitive moves and reveals that LLMs strongly over-intervene [[S4]](#s4). This is particularly relevant to Plan 2.0's ownership and conduct-policy history: a tutor can harm learner agency by interrupting productive struggle, over-diagnosing, or replacing learner-authored work.

`observe_no_intervention` should therefore be a first-class action, not an absence of logging. It should have explicit preconditions, predicted observations, and safety overrides.

### 3.4 Scaffolding must vary by learner state and prior knowledge

The assistance dilemma asks how much help to provide and when; too little help leaves learners stuck, while too much help suppresses productive construction [[S24]](#s24). The ICAP framework distinguishes passive, active, constructive, and interactive engagement modes [[S23]](#s23).

A 2026 human study with 113 students compared adaptive selection of guided and buggy worked examples using Bayesian Knowledge Tracing and deep reinforcement learning. Both adaptive policies improved test performance over a non-adaptive policy, but the best treatment varied by prior knowledge: BKT produced the largest gains for lower-prior-knowledge students, while the RL policy was stronger among higher-prior-knowledge students [[S7]](#s7). This directly argues against a universal minimal-hint action.

Metacognitive adaptation also matters. Work on help-seeking tutors shows that help use itself can be modeled and coached rather than reduced to a content deficit [[S25]](#s25). MetaCLASS further formalizes planning, monitoring, debugging, evaluation, and selective silence as distinct coaching moves [[S4]](#s4).

### 3.5 Verification is valuable only when routed by risk

Domain grounding is essential, but adding a verifier indiscriminately can be counterproductive. LeanTutor shows the value of separating formal checking from feedback realization [[S9]](#s9). A 2026 study of logic-proof tutoring found an asymmetric verifier effect: verification improved outcomes when upstream feedback accuracy was below 70%, but reduced performance by four to six percentage points through overspecification when upstream accuracy exceeded 85% [[S10]](#s10).

This supports a **risk-routed verifier**, activated by estimated difficulty, uncertainty, and harm potential rather than on every turn.
A tutoring-specific safety benchmark also argues that correctness, answer over-disclosure, misconception reinforcement, and scaffolding failure must be evaluated jointly over multi-turn interactions rather than as isolated single-turn safety checks [[S26]](#s26).

### 3.6 Policy learning should begin conservatively

A 2025 tutoring-RL study exposed a Pareto frontier between pedagogical support and student solving accuracy [[S11]](#s11). That is the right framing: tutoring has multiple objectives that cannot safely be compressed into one judge score.

Large-scale deployment evidence also counsels restraint. A tutoring platform evaluated approximately 43,000 assistance actions using data from one million students and tested resulting policies across 166,000 practice sessions [[S12]](#s12). Population-level multi-armed bandit policies improved outcomes, but contextual personalization did not always beat a strong population policy because actionable treatment-effect heterogeneity was often small [[S12]](#s12).

Plan 2.x should therefore progress from safe micro-randomization to population policies, test whether stable heterogeneity exists, and only then personalize. Logged action propensities are essential. Doubly robust policy evaluation can combine reward and behavior-policy models [[S13]](#s13), while Conservative Q-Learning addresses overestimation of actions poorly supported in offline data [[S14]](#s14).

### 3.7 Adaptation must operate across multiple timescales

Turn-level affect, episode-level strategy, and longitudinal mastery should not occupy one undifferentiated memory. DAS3H models skill-specific learning and forgetting over time and outperformed comparison models on three real educational datasets [[S15]](#s15). This supports separate stores for volatile interaction state, derivation-episode state, and longitudinal skill mastery.

### 3.8 Learners should be able to inspect and correct the model

Bayesian Theory-of-Mind teaching work shows the potential value of selecting demonstrations based on a model of the learner, while also showing that performance depends on alignment between the teacher's model and the learner's actual state [[S16]](#s16). Open Learner Modeling research argues for exposing learner models so they can support interpretation, reflection, and correction rather than remaining opaque [[S17]](#s17).

For Plan 2.x, the safe version is not speculative psychologizing. It is lightweight, correctable state disclosure—for example, “I may be reading this as answer-seeking, but you may instead be asking for a worked setup. Which is closer?”

### 3.9 Simulated learners require epistemic constraints

A 2025 study placed eleven LLMs and real student populations on a shared item-response scale and found that no model-prompt pair reliably represented the average student across subjects and grades [[S18]](#s18). A 2026 methodological framework names the underlying issue the “competence paradox”: a broadly capable LLM is asked to emulate a partially knowledgeable learner, yielding inconsistent errors and learning dynamics. It proposes an explicit Epistemic State Specification defining accessible knowledge, error processes, and state transitions [[S19]](#s19).

Mock and simulated learners remain useful for deterministic mechanism tests, but stronger general-adaptation claims require epistemically constrained simulators, untouched causal geometries, and ultimately humans.

### 3.10 Human-copilot evaluation can localize failures

Tutor CoPilot's preregistered randomized trial involved 900 tutors and 1,800 K–12 students. Access to AI guidance increased topic mastery by four percentage points overall and nine points among students of lower-rated tutors; tutors also used more guiding questions and gave away answers less often, though they reported inappropriate suggestions in some cases [[S20]](#s20).

A human-copilot branch can reveal whether Plan 2.x is better at diagnosis, action selection, or realization. This is scientifically useful even if autonomous tutoring remains the long-term goal.

---

## 4. Proposed target architecture

```text
Learner message + derivation trace + prior history
                         |
                         v
          Evidence parser and domain checker
                         |
                         v
          Calibrated learner belief state b_t
  P(cognitive, affective, interactional, metacognitive,
       mastery, and tutor-learner alignment states)
                         |
                         v
      Generate safe pedagogical-act candidates
          with explicit action contracts
                         |
                         v
   Expected-learning / value-of-information selector
        subject to correctness, conduct, agency,
             leakage, and burden constraints
                         |
                         v
       Domain-grounded linguistic realization
            + conditional verification
                         |
                         v
                    Learner reply
                         |
                         v
       Action-specific outcome adjudication
                         |
                         v
     Belief update, delayed outcome tracking,
       policy evaluation, and future learning
```

The architecture should operate at three timescales:

- **Step loop:** What should happen in the next tutor turn?
- **Episode loop:** Is the current derivation strategy working?
- **Session loop:** What has the learner mastered, transferred, or forgotten?

---

## 5. Extension 1: calibrated belief-state learner modeling

### Rationale

A learner utterance rarely establishes one state conclusively. “Walk me through it” may indicate answer seeking, overload, unfamiliarity with the task, low confidence, or a legitimate request for modeling. A hard label forces an early commitment and may make later interpretation self-confirming.

### Proposed schema

```yaml
learner_belief:
  cognitive:
    prerequisite_gap: 0.41
    misconception: 0.28
    procedural_slip: 0.18
    task_misread: 0.13

  interactional:
    answer_seeking: 0.52
    overload: 0.24
    substantive_objection: 0.16
    disengagement: 0.08

  affective:
    frustration: 0.31
    anxiety: 0.17

  metacognitive:
    low_calibration: 0.38
    unproductive_help_seeking: 0.27

  evidence:
    - span: "walk me through the answer"
      supports: answer_seeking
      strength: 0.72
      source: learner_text
      expires_after_turns: 2

  uncertainty:
    entropy: 1.36
    top_two_margin: 0.11
```

The values above are illustrative. The required properties are:

- Preserve multiple hypotheses until evidence distinguishes them.
- Attach provenance to each update.
- Decay temporary states unless reconfirmed.
- Allow contradictory evidence to reverse an inference.
- Keep mastery, affect, conduct, and interactional intent separate.
- Avoid permanent trait inference from a single episode.

### Minimal viable implementation

1. Convert existing evidence rules from booleans into likelihood increments.
2. Ask any LLM assessor for evidence spans and relative support, not a final action.
3. Update normalized log-odds or a small Bayesian network.
4. Add explicit transition and decay rules.
5. Feed either the maximum-a-posteriori state or the full belief into the existing selector.

### Initial ablation

- `categorical_state`
- `belief_state_top1_only`
- `full_belief_policy`

This separates the value of probabilistic representation from the value of belief-aware action selection.

### Evaluation

- Brier score and expected calibration error.
- Top-two and top-three state coverage.
- Controlled hidden-state recovery.
- Correct reversal after contradictory evidence.
- Stability under paraphrase.
- Sensitivity to minimal cue changes.
- Unsupported state-persistence rate.
- Calibration by state family.

---

## 6. Extension 2: value-of-information diagnosis

Plan 2.0's repair rule—stop repeating an inconclusive diagnostic and switch to a compatible non-diagnostic action—should become an explicit diagnostic-budget policy.

For each candidate action `a`, estimate:

\[
J(a \mid b_t) =
\mathbb{E}[\Delta \text{learning}]
+ \lambda I(S;O \mid a)
+ \mu \text{agency}
- \alpha \text{leakage}
- \beta \text{burden}
- \gamma \text{risk}
\]

subject to hard correctness and conduct constraints.

Here, `I(S;O | a)` is the expected information that the learner's response would provide about the hidden state.

### Resulting policy behaviors

**Discriminative probes.** A diagnostic question should distinguish the top competing hypotheses. “What are you thinking?” is often weak. A probe that asks the learner to state the current goal and perform one prerequisite operation can distinguish task misread from prerequisite gap.

**Robust action without diagnosis.** If the same safe action is appropriate across all high-probability states, act immediately rather than interrogating the learner.

**Explicit stopping rule.** Stop diagnosis when:

- expected information gain is lower than learner burden;
- the next action would not change after further diagnosis;
- a diagnostic move already failed under the same live condition;
- the learner declines or overload rises;
- a cheap, reversible action is available.

### First experiment

Compare the current generic first diagnostic with a **top-two discriminative probe**, while holding downstream policy and realization fixed.

Primary outcomes:

- posterior entropy reduction;
- subsequent action accuracy;
- redundant-probe rate;
- diagnostic turns per episode;
- learner burden;
- ownership retention.

---

## 7. Extension 3: hierarchical action ontology and contracts

Separate three levels:

1. **Macro strategy:** assess, remediate, challenge, stabilize, restore agency, close, or hand off.
2. **Pedagogical act:** discriminative probe, minimal hint, contrast case, buggy example, worked example, self-explanation request, retrieval check, and so on.
3. **Language realization:** the actual utterance.

A practical initial action ontology:

```text
observe_no_intervention
discriminative_probe
task_reframe
minimal_hint
partial_completion
contrast_case
buggy_example
worked_example
self_explanation
retrieval_or_transfer_check
affect_stabilization
ownership_restoration
human_or_tool_handoff
```

Each action should have an executable contract:

```yaml
minimal_hint:
  preconditions:
    - learner_has_attempted
    - valid_local_next_step_exists

  purpose:
    - unblock_one_step
    - preserve_learner_construction

  forbidden:
    - complete_next_derivation
    - disclose_final_answer
    - provide_multiple_unrequested_steps

  expected_observation:
    - independent_next_step
    - targeted_question
    - evidence_of_deeper_gap

  success_closure:
    - learner_produces_valid_next_step_without_echo

  fallback:
    - discriminative_probe
    - partial_completion
```

This prevents the realization model from silently changing the pedagogical action.

---

## 8. Extension 4: adaptive scaffold ladder

Replace the universal minimal hint with a reversible ladder:

| Level | Intervention |
|---:|---|
| 0 | Observe or minimally acknowledge |
| 1 | Prompt retrieval or ask for a prediction |
| 2 | Give a targeted conceptual cue |
| 3 | Constrain the choice or expose part of the structure |
| 4 | Supply a partial completion |
| 5 | Present a worked or buggy example |
| 6 | Give a direct explanation, followed by reconstruction |

The tutor should move both upward and downward. Once progress appears, it should fade support rather than continue at the same intensity.

State-conditioned examples:

- **Prerequisite gap:** guided example or partial completion may beat a cryptic hint.
- **Misconception:** contrast case or buggy example may be most diagnostic.
- **Procedural slip:** a minimal local cue may be sufficient.
- **Task misread:** task reframe should precede content help.
- **Overload:** reduce branching and externalize structure.
- **Answer seeking with adequate mastery:** return responsibility through a prediction or commitment.
- **Substantive objection:** engage the objection rather than classifying it as avoidance.

Core ablation:

> Fixed minimal hint versus state-conditioned scaffold level, with identical domain content and correctness constraints.

---

## 9. Extension 5: action-specific, evidence-bearing outcome closure

This is the most urgent bottleneck. Structural closure without observed learner evidence does not support policy learning.

A closure should answer:

> What learner behavior would make this particular action count as success or failure?

| Tutor act | Evidence-bearing success | Not sufficient |
|---|---|---|
| Discriminative probe | Response changes relative support for competing hypotheses | Any substantive reply |
| Minimal hint | Learner independently produces the valid next step | Repeating the hint |
| Partial completion | Learner completes the remaining structure and explains the connection | Filling a copied token |
| Worked or buggy example | Self-explanation plus success on an isomorphic item | “That makes sense” |
| Task reframe | Learner restates the goal and initiates a valid step | “Okay, I understand” |
| Affect stabilization | Re-engagement followed by task progress | Positive sentiment alone |
| Ownership restoration | Learner chooses a plan, predicts, or authors the next move | Polite agreement |
| Retrieval check | Correct unaided retrieval after an appropriate delay | Immediate echo |

Proposed status values:

```text
observed_success
observed_failure
inconclusive
not_yet_observable
invalidated_by_confounded_followup
```

Persist:

- closure latency;
- evidence spans;
- independent versus echoed evidence;
- causal confidence;
- intervening tutor actions;
- immediate, near-transfer, far-transfer, and retention horizons.

A pending outcome should survive across turns. A worked example, for instance, should not close on acknowledgment; it closes when the learner attempts a related item.

---

## 10. Extension 6: grounded realization and risk-routed verification

Action correctness and utterance correctness are distinct. Each realization should be conditioned on a structured `PedagogicalAct` object containing:

- permitted derivation facts;
- valid next steps;
- facts already established by the learner;
- information that must not be disclosed;
- maximum scaffold level;
- required specificity;
- expected learner work;
- closure criterion.

Recommended pipeline:

1. Construct the act specification.
2. Query the domain model for valid next steps or misconception structure.
3. Generate one or more candidate utterances.
4. Check mathematical or logical correctness.
5. Check fidelity to the requested action.
6. Check leakage and overspecification.
7. Select the least intrusive valid candidate.
8. Fall back to a deterministic template if no candidate passes.

Test three conditions:

- no verifier;
- always-on verifier;
- risk-routed verifier.

Measure correctness, action fidelity, leakage, overspecification, next-step validity, latency, token cost, and independent learner progress.

---

## 11. Extension 7: constrained multi-objective control

A single scalar reward invites shortcuts. Immediate correctness rewards answer-giving; positive sentiment rewards reassurance; short dialogues reward premature completion.

Use a reward vector:

\[
R = (
\text{independent progress},
\text{near transfer},
\text{far transfer},
\text{retention},
\text{agency},
\text{affect},
-\text{burden},
-\text{cost}
)
\]

with hard constraints:

- no invalid mathematical feedback;
- no prohibited answer leakage;
- no conduct-policy violation;
- no unsupported learner-state assertion;
- honor learner correction or opt-out;
- preserve learner-authored work.

Use a lexicographic or Pareto policy:

1. Remove invalid and unsafe actions.
2. Enforce minimum agency and non-leakage requirements.
3. Optimize expected learning and information value.
4. Break close ties using burden and cost.

Given the branch's earlier experience with conduct enforcement suppressing legitimate action, correctness, conduct, and ownership constraints should remain outside any learned reward that could trade them away.

---

## 12. Extension 8: conservative policy learning after observability

Do not begin unrestricted reinforcement learning while outcomes are mostly inconclusive.

### Stage 1: safe micro-randomization

Randomize only among actions already judged acceptable for the current belief state. Log:

```text
belief_snapshot
candidate_action_set
chosen_action
selection_propensity
policy_version
action_contract
realization
constraint_checks
immediate_outcome
delayed_outcomes
reward_vector
```

Micro-randomized trials provide a principled design for estimating the proximal effects of repeatedly delivered adaptive interventions [[S21]](#s21).

### Stage 2: population-level bandits

Start with a population policy. Test for treatment-effect heterogeneity before adding contextual personalization. The million-student deployment shows that personalization may not add value when heterogeneity is weak [[S12]](#s12).

### Stage 3: offline evaluation and conservative improvement

Use doubly robust evaluation [[S13]](#s13). Reject policies with poor support in historical data. If sequential offline RL is attempted, use conservative methods such as CQL [[S14]](#s14).

Promotion should require:

- positive lower confidence bound versus the frozen policy;
- no regression in correctness or leakage;
- no regression in agency or ownership;
- adequate action-support coverage;
- robustness across judges and simulator families;
- no benefit driven by one scenario family.

---

## 13. Extension 9: multi-timescale memory and forgetting

### Volatile turn state

Examples: overload, frustration, answer seeking, current task misread. These should have short time-to-live values.

### Episode state

Examples: current derivation plan, unresolved proof debt, attempted scaffold, pending outcome closure. These survive the derivation but normally expire afterward.

### Longitudinal knowledge state

Examples: mastery by knowledge component, retrieval strength, transfer history, and forgetting. These support problem selection and spaced retrieval.

Core principle:

> Store evidence and updateable estimates, not permanent personality descriptions.

A single episode should never permanently label a learner as disengaged, dependent, anxious, or weak.

---

## 14. Extension 10: bilateral and open adaptation

Add lightweight interactional hypotheses:

- learner believes the tutor ignored an objection;
- tutor interprets a format request as answer seeking;
- learner believes their contribution was overwritten;
- learner no longer expects attempts to be useful.

Do not infer rich hidden motives. Expose correctable hypotheses:

> “I may be reading this as a request for the completed derivation, but you may instead be asking to see how the setup works. Which is closer?”

This simultaneously:

- exposes the tutor's current model;
- allows learner correction;
- produces discriminative evidence;
- limits paternalistic conduct enforcement;
- restores learner participation in adaptation.

Metrics:

- learner correction rate;
- tutor acceptance of corrections;
- belief revision after correction;
- ownership transfer;
- false-positive conduct classification;
- unsolicited-intervention rate.

---

## 15. Extension 11: epistemically constrained learner simulation

Each simulated learner should have an explicit hidden state:

```yaml
hidden_epistemic_state:
  mastered_kcs: []
  partial_kcs: []
  unavailable_kcs: []
  misconceptions: []
  allowed_inference_depth: 0
  error_process: {}
  help_response_model: {}
  learning_transition_model: {}
  affect_transition_model: {}
  agency_policy: {}
```

The simulator must be prevented from using unavailable knowledge even when the base LLM possesses it.

Use multiple simulator families:

- deterministic rule-based learner;
- LLM constrained by an Epistemic State Specification;
- noisy observation learner;
- adversarial learner designed to expose policy shortcuts;
- learner whose state changes independently of surface wording;
- replay or calibrated models from human traces when available.

Hold out complete mechanisms and causal geometries, not merely paraphrases. New wording over familiar hidden structures is weak evidence of general adaptation.

---

## 16. Extension 12: human-copilot and autonomous branches

A future human study could compare:

1. current tutoring baseline;
2. autonomous Plan 2.x tutor;
3. human tutor with state and action recommendations;
4. human tutor with state information but no action recommendation.

This localizes failures:

- state inference;
- action selection;
- realization;
- timing;
- trust and social interpretation.

It also provides a safer route from simulated evidence to real learning outcomes.

---

## 17. Recommended experimental sequence

### Phase 0 — Freeze and validate the current positive

- Independent-judge robustness without tuning against that judge.
- State-scramble ablation.
- Outcome-closure-off ablation.
- Context-realization-off ablation.
- Frozen-policy real-LLM generation.
- Recheck both cross-suite and paired held-out suites.
- Preserve all traces, configurations, and policy versions.

### Phase 1 — Belief state without action expansion

Conditions:

- `B0`: existing categorical state;
- `B1`: probabilistic state collapsed to top-one before selection;
- `B2`: full belief supplied to the existing selector.

Promotion gate:

- strict shift and pair specificity do not regress;
- state calibration improves;
- counterfactual cue sensitivity improves;
- unsupported state persistence decreases;
- false-positive conduct classification does not increase.

### Phase 2 — Discriminative diagnosis and no-intervention

Conditions:

- existing first diagnostic;
- top-two discriminative diagnostic;
- value-of-information selector;
- value-of-information selector with explicit no-intervention.

Primary outcomes:

- entropy reduction per diagnostic turn;
- redundant diagnostic rate;
- time to appropriate non-diagnostic action;
- no-intervention precision and recall;
- learner override and ownership measures.

### Phase 3 — Evidence-bearing closure

Replace generic closure with action-specific contracts and delayed outcomes.

Primary outcomes:

- fraction of eligible actions ending in observed success or failure;
- closure latency;
- independent next-step success;
- near-transfer performance;
- false success from echoing or polite acknowledgment;
- agreement between mechanical and expert adjudication.

### Phase 4 — Adaptive scaffold and routed verification

Run sequential tests rather than an immediate full factorial:

1. fixed minimal hint versus adaptive scaffold ladder;
2. no verifier versus always-on verifier versus risk-routed verifier.

Primary outcomes:

- mathematical correctness;
- action fidelity;
- leakage and overspecification;
- independent progress;
- near and far transfer;
- turn count and cost;
- effects by prior knowledge and state family.

### Phase 5 — Safe policy optimization

- Micro-randomize only within prevalidated safe action sets.
- Log propensities and candidate sets.
- Optimize a population-level bandit first.
- Test heterogeneity before contextualization.
- Use doubly robust offline evaluation.
- Require conservative confidence bounds.
- Preserve conduct, correctness, and ownership as hard constraints.

### Phase 6 — Longitudinal and human validation

- Add knowledge-component mastery and forgetting.
- Add delayed retrieval and transfer items.
- Test untouched domains and causal geometries.
- Compare autonomous and human-copilot conditions.
- Preregister learning, retention, and agency outcomes.

---

## 18. Measurement framework

| Layer | Core measures |
|---|---|
| State validity | Brier score, calibration error, top-k coverage, hidden-state recovery, counterfactual sensitivity |
| Policy fidelity | Strict shift, family match, pair specificity, state-scramble effect, counterfactual action sensitivity |
| Diagnostic efficiency | Entropy reduction, redundant-probe rate, diagnostic turns, learner burden |
| Realization | Correctness, action fidelity, leakage, specificity, cognitive load, verifier-routing accuracy |
| Outcome closure | Observed success/failure rate, closure latency, independent progress, false-success rate |
| Learning | Immediate progress, near transfer, far transfer, delayed retention |
| Agency | No-intervention precision, override acceptance, ownership transfer, answer-giving rate |
| Generalization | Untouched suites, new causal geometries, unseen knowledge components, paraphrase robustness |
| Operations | Tokens, latency, verifier use, handoff rate, failure recovery |

Reporting must keep these layers separate:

- a strategy shift is not learning;
- a judge-rated response is not transfer;
- positive sentiment is not successful affect regulation;
- a closed record is not an observed learner transition.

---

## 19. Repository-level implementation map

Based on the current adaptive-tutor module structure described in the branch record:

| Existing area | Proposed extension |
|---|---|
| `services/adaptiveTutor/stateSchema.js` | Belief distributions, evidence provenance, state TTLs, longitudinal mastery |
| `services/adaptiveTutor/policyActions.js` | Hierarchical acts, no-intervention, scaffold levels, action contracts |
| `services/adaptiveTutor/graph.js` | Value-of-information selection, pending outcomes, belief update loop |
| `services/adaptiveTutor/persistence.js` | Candidate sets, propensities, belief snapshots, delayed outcomes |
| Realization layer | Contract-conditioned generation and risk-routed verification |
| Scenario schemas | Hidden epistemic state and controlled transition dynamics |
| Analysis scripts | Calibration, diagnostic information gain, closure validity, policy regret |
| Evaluation store | Reward vectors, action support, causal provenance |

Version the schema. Do not retrofit historical categorical-state rows with retrospective probabilities.

---

## 20. Key risks and anti-patterns

1. **Prompt enlargement without explicit contracts.** This makes the policy less inspectable and harder to ablate.
2. **Adding agents by default.** Verification and critique can overspecify or suppress useful action [[S10]](#s10).
3. **Optimizing one judge score.** This risks reward hacking and does not establish learning.
4. **Learning from inconclusive closures.** The policy will optimize annotation artifacts rather than learner transitions.
5. **Permanent personality labels.** These conflate temporary interaction state with stable learner traits.
6. **Personalization before heterogeneity.** A contextual policy may add variance without benefit [[S12]](#s12).
7. **Simulator surface realism without epistemic fidelity.** Fluent simulated learners may be scientifically invalid [[S18]](#s18) [[S19]](#s19).
8. **Always intervening.** Productive struggle and learner ownership require an explicit no-intervention option [[S4]](#s4).
9. **Retrospective taxonomy growth.** New state categories created after failures can turn held-out evaluation into tuning.
10. **Cross-version rescoring.** Preserve the repository's current rubric-version and provenance discipline.

---

## 21. Highest-value next program

### Plan 2.1 — Belief-State and Evidence-Bearing Adaptation

Central hypothesis:

> A calibrated multi-hypothesis learner state, combined with discriminative diagnosis and action-specific outcome closure, will produce more observed learner-state transitions without reducing Plan 2.0's strict-shift fidelity, pair specificity, or learner ownership.

Recommended order:

1. Build evidence-bearing closure.
2. Represent state uncertainty explicitly, with provenance and decay.
3. Replace generic first diagnostics with top-two discriminative probes.
4. Add explicit no-intervention and a state-conditioned scaffold ladder.
5. Ground realization in the derivation model and route verification by risk.
6. Delay contextual bandits or RL until the first five steps produce credible outcome data.

This sequence keeps the current state-action positive frozen while improving the weakest links in the adaptation chain.

---

# Sources

## Internal repository sources

<a id="i1"></a>
**[I1]** `PLAN_2_0/branch-progress-since-inception.md`. Branch-level progress record prepared June 19, 2026. Source for the current Plan 2.0 evidence state, branch history, and bounded claim.

<a id="i2"></a>
**[I2]** `PLAN_2_0/plan2-general-adaptation-closeout.md`. Current internal closeout identified by [I1] as the source of truth for the repaired general-adaptation result.

## External sources

<a id="s1"></a>
**[S1] Borchers, C., & Shou, T. (2025). _Can Large Language Models Match Tutoring System Adaptivity? A Benchmarking Study._** Benchmark across 75 real ITS scenarios and 1,350 generated instructional moves. Used here to support the distinction between fluent generation and explicit adaptivity.  
https://arxiv.org/abs/2504.05570

<a id="s2"></a>
**[S2] Pal Chowdhury, S., Zouhar, V., & Sachan, M. (2024). _AutoTutor meets Large Language Models: A Language Model Tutor with Rich Pedagogy and Guardrails._** Introduces MWPTutor, which uses LLMs inside a predefined finite-state transducer and reports better human-evaluated tutoring quality than free-form GPT-4.  
https://arxiv.org/abs/2402.09216

<a id="s3"></a>
**[S3] Weitekamp, D., Siddiqui, M. N., & MacLellan, C. J. (2025). _TutorGym: A Testbed for Evaluating AI Agents as Tutors and Students._** Interactive ITS benchmark; initial evaluation reports chance-level identification of incorrect actions and roughly 52–70% next-action accuracy.  
https://arxiv.org/abs/2505.01563

<a id="s4"></a>
**[S4] Liu, N., Baraniuk, R., & Sonkar, S. (2026). _MetaCLASS: Metacognitive Coaching for Learning with Adaptive Self-regulation Support._** Eleven-action metacognitive move framework; reports 41.7% of cases requiring no intervention but models choosing no intervention only 4.2% of the time. Preprint.  
https://arxiv.org/abs/2602.02457

<a id="s5"></a>
**[S5] Christie, S. T., Cook, C., & Rafferty, A. N. (2024). _Uncertainty-preserving deep knowledge tracing with state-space models._** Introduces Dynamic LENS, preserving epistemic uncertainty while integrating learner observations across time.  
https://arxiv.org/abs/2407.17427

<a id="s6"></a>
**[S6] Wei, Y., Li, R., & Jiang, B. (2026). _SLOW: Strategic Logical-inference Open Workspace for Cognitive Adaptation in AI Tutoring._** Separates learner-state inference from action selection and combines fuzzy diagnosis, counterfactual stability analysis, and affect prediction. Recent preprint; used as architectural rather than outcome evidence.  
https://arxiv.org/abs/2603.28062

<a id="s7"></a>
**[S7] Tithi, S. D., Alam, N., Yasir, T., Shi, Y., Tian, X., Chi, M., & Barnes, T. (2026). _Adaptive Scaffolding for Cognitive Engagement in an Intelligent Tutoring System._** Human experiment with 113 students comparing BKT, DRL, and non-adaptive selection of guided versus buggy examples. Preprint.  
https://arxiv.org/abs/2602.07308

<a id="s8"></a>
**[S8] Yasir, T., Li, W., Gilson, S., Dey Tithi, S., Tian, X., & Barnes, T. (2026). _Confirming Correct, Missing the Rest: LLM Tutoring Agents Struggle Where Feedback Matters Most._** Logic benchmark showing over-rejection of valid-but-suboptimal reasoning and over-validation of incorrect reasoning. Recent preprint.  
https://arxiv.org/abs/2605.16207

<a id="s9"></a>
**[S9] Patel, M., Bhattacharyya, R., Lu, T., Mehta, A., Voss, N., Norouzi, N., & Ranade, G. (2025). _LeanTutor: A Formally-Verified AI Tutor for Mathematical Proofs._** Modular architecture separating formal proof checking, valid next-step generation, and natural-language feedback.  
https://arxiv.org/abs/2506.08321

<a id="s10"></a>
**[S10] Yasir, T., et al. (2026). _When Verification Hurts: Asymmetric Effects of Multi-Agent Feedback in Logic Proof Tutoring._** Reports that verification helps when upstream accuracy is below 70% but can reduce performance by four to six points through overspecification when upstream accuracy exceeds 85%. Preprint.  
https://arxiv.org/abs/2603.27076

<a id="s11"></a>
**[S11] Dinucu-Jianu, D., Macina, J., Daheim, N., Hakimi, I., Gurevych, I., & Sachan, M. (2025). _From Problem-Solving to Teaching Problem-Solving: Aligning LLMs with Pedagogy using Reinforcement Learning._** Uses controllable reward weighting to expose a Pareto frontier between pedagogical support and student solving accuracy. Simulation-based.  
https://arxiv.org/abs/2505.15607

<a id="s12"></a>
**[S12] Schmucker, R., Pachapurkar, N., Bala, S., Shah, M., & Mitchell, T. (2025). _Learning to Optimize Feedback for One Million Students: Insights from Multi-Armed and Contextual Bandits in Large-Scale Online Tutoring._** Evaluates about 43,000 assistance actions and tests learned policies in 166,000 practice sessions; reports limited incremental value from contextualization where treatment heterogeneity is small.  
https://arxiv.org/abs/2508.00270

<a id="s13"></a>
**[S13] Dudík, M., Langford, J., & Li, L. (2011). _Doubly Robust Policy Evaluation and Learning._** Foundational method combining reward and behavior-policy models for off-policy evaluation.  
https://arxiv.org/abs/1103.4601

<a id="s14"></a>
**[S14] Kumar, A., Zhou, A., Tucker, G., & Levine, S. (2020). _Conservative Q-Learning for Offline Reinforcement Learning._** Addresses overestimation under offline distribution shift by learning conservative value estimates.  
https://arxiv.org/abs/2006.04779

<a id="s15"></a>
**[S15] Choffin, B., Popineau, F., Bourda, Y., & Vie, J.-J. (2019). _DAS3H: Modeling Student Learning and Forgetting for Optimally Scheduling Distributed Practice of Skills._** Models skill-specific learning and forgetting over multiple tagged skills and reports gains on three educational datasets.  
https://arxiv.org/abs/1905.06873

<a id="s16"></a>
**[S16] Grislain, C., Caselles-Dupré, H., Sigaud, O., & Chetouani, M. (2023). _Utility-based Adaptive Teaching Strategies using Bayesian Theory of Mind._** Simulated evidence that teaching improves when demonstrations are selected using a learner model aligned with the learner's actual state.  
https://arxiv.org/abs/2309.17275

<a id="s17"></a>
**[S17] Conati, C., Porayska-Pomsta, K., & Mavrikis, M. (2018). _AI in Education needs interpretable machine learning: Lessons from Open Learner Modelling._** Connects interpretable AI with the long-running Open Learner Modeling tradition.  
https://arxiv.org/abs/1807.00154

<a id="s18"></a>
**[S18] Srivatsa, K. V. A., Maurya, K. K., & Kochmar, E. (2025). _Can LLMs Reliably Simulate Real Students' Abilities in Mathematics and Reading Comprehension?_** Places eleven LLMs and real students on a shared IRT scale; no tested model-prompt pair consistently matches average students across subjects and grades.  
https://arxiv.org/abs/2507.08232

<a id="s19"></a>
**[S19] Yuan, Z., Xiao, Y., Li, M., Xuan, W., Tong, R., Diab, M., & Mitchell, T. (2026). _Towards Valid Student Simulation with Large Language Models._** Defines the competence paradox and proposes an Epistemic State Specification for constrained learner simulation. Methodological preprint.  
https://arxiv.org/abs/2601.05473

<a id="s20"></a>
**[S20] Wang, R. E., Ribeiro, A. T., Robinson, C. D., Loeb, S., & Demszky, D. (2024). _Tutor CoPilot: A Human-AI Approach for Scaling Real-Time Expertise._** Preregistered RCT with 900 tutors and 1,800 K–12 students; reports a four-percentage-point overall mastery gain and a nine-point gain for students of lower-rated tutors.  
https://arxiv.org/abs/2410.03017

<a id="s21"></a>
**[S21] Qian, T., et al. (2021). _The Micro-Randomized Trial for Developing Digital Interventions: Experimental Design and Data Analysis Considerations._** Describes repeated randomization and causal excursion effects for optimizing just-in-time adaptive interventions.  
https://arxiv.org/abs/2107.03544

<a id="s22"></a>
**[S22] Corbett, A. T., & Anderson, J. R. (1995). _Knowledge tracing: Modeling the acquisition of procedural knowledge._ User Modeling and User-Adapted Interaction, 4, 253–278.** Foundational Bayesian Knowledge Tracing model.  
https://doi.org/10.1007/BF01099821

<a id="s23"></a>
**[S23] Chi, M. T. H., & Wylie, R. (2014). _The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes._ Educational Psychologist, 49(4), 219–243.** Framework distinguishing passive, active, constructive, and interactive engagement.  
https://doi.org/10.1080/00461520.2014.965823

<a id="s24"></a>
**[S24] Koedinger, K. R., & Aleven, V. (2007). _Exploring the Assistance Dilemma in Experiments with Cognitive Tutors._ Educational Psychology Review, 19, 239–264.** Foundational treatment of the tradeoff between instructional help and productive learner work.  
https://doi.org/10.1007/s10648-007-9049-0

<a id="s25"></a>
**[S25] Roll, I., Aleven, V., McLaren, B. M., & Koedinger, K. R. (2011). _Improving students' help-seeking skills using metacognitive feedback in an intelligent tutoring system._ Learning and Instruction, 21(2), 267–280.** Evidence and design principles for adapting to help-seeking behavior as a metacognitive process.  
https://doi.org/10.1016/j.learninstruc.2010.07.004

<a id="s26"></a>
**[S26] Hazra, R., et al. (2026). _SafeTutors: Benchmarking Pedagogical Safety in AI Tutoring Systems._** Proposes a tutoring-specific safety taxonomy including answer over-disclosure, misconception reinforcement, and scaffolding failure; reports worsening failure rates over multi-turn interaction. Recent preprint.  
https://arxiv.org/abs/2603.17373

---

## Source-use note

The most load-bearing recommendations in this roadmap do not depend on one recent paper. They are triangulated across explicit ITS architectures [S2, S3, S9], uncertainty-preserving learner modeling [S5, S15, S22], human or deployed adaptive interventions [S7, S12, S20], metacognitive and ownership-oriented control [S4, S17, S25], and conservative causal policy evaluation [S13, S14, S21]. Recent 2026 preprints primarily motivate hypotheses and architecture; they should not independently justify strong claims about human learning.
