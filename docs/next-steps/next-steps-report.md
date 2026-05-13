# Next Steps for Evidence-Bound Adaptivity in the AI Tutor

_Source paper: `paper-2.0-v3.0.74.pdf`, reviewed May 13, 2026._

## Executive conclusion

The current paper is strongest when read as a mechanism-discovery paper rather than as a completed adaptive-tutor paper. It shows that recognition / intersubjective pedagogy reliably improves tutor output through two tutor-production mechanisms:

1. **Calibration:** recognition-oriented prompting narrows the tutor's response distribution, lifts weak rubric dimensions, and improves first-pass output.
2. **Error correction:** the superego critic helps most under weak baseline prompting, but its marginal benefit shrinks under recognition because recognition already prevents many of the same failures.

The third proposed mechanism, **adaptive responsiveness**, is not supported in the main well-powered multi-turn analysis. The paper's own later structured-memory and adaptive-runner arcs are therefore best interpreted as exploratory attempts to solve the missing mechanism, not as confirmation that long-horizon adaptivity has already been achieved.

The design lesson is direct:

> Genuine adaptation should not be implemented as richer hidden memory, self-reflection, or system-prompt rewriting. It should be implemented as evidence-bound learner state used to select accountable pedagogical actions.

The next architecture should keep the recognition prompt stable and add an external adaptive controller that maintains a small, typed, auditable learner-state ledger; updates it only from quoted evidence; chooses among a finite set of pedagogical policies; and asks the learner to correct the model when evidence is weak.

---

## 1. What the paper already establishes

### 1.1 Recognition / intersubjective orientation works

The paper finds that prompts instructing the tutor to engage the learner as an active interpretive subject produce large improvements in tutor-output quality. The strongest result is not a philosophical claim that the model literally recognizes the learner, but an operational finding: intersubjective prompt orientation changes the response distribution. It lifts weak dimensions, lowers variance, and improves tutor behavior across generation models and judges.

### 1.2 The superego helps, but mostly as a substitute for prompt calibration

The ego-superego architecture improves weak baseline output by catching obvious pedagogical failures, content leakage, over-answering, and loss of productive struggle. But under recognition prompting, the critic adds less because the base tutor already avoids many of those errors. This supports a substitution account rather than a simple additive account.

### 1.3 Adaptive responsiveness remains unsolved

The multi-turn results show that tutors adapt descriptively across dialogue, but recognition and architecture do not materially improve the slope of adaptation. The earlier 10-turn exploratory disengagement effect fails replication. This means the paper should not claim that recognition produces reliable condition-modulated adaptive responsiveness.

Better framing:

> Recognition improves the quality level at which the tutor operates; it does not reliably alter the tutor's turn-by-turn learning trajectory under the tested conditions.

### 1.4 Structured memory was not load-bearing

The Writing Pad ablation and later memory arcs are important negative evidence. Rich structured memory is not the same thing as adaptivity. In the paper, recognition survives without the Writing Pad, and richer learner state does not straightforwardly improve strategy selection. This should be promoted from a failed detour to a central design insight.

### 1.5 Minimal state may beat rich state

The adaptive-runner results point toward a surprising but useful possibility: a minimal learner profile can outperform richer state. This is consistent with the practical risk that rich profiles invite over-inference, latent-trait hallucination, and irrelevant biographical reuse.

---

## 2. The core problem to solve

The project is trying to build a tutor that does not merely sound responsive, but actually changes what it does based on evidence about the learner. The failure mode is false personalization:

- The tutor infers a durable learner trait from one utterance.
- The tutor stores that inference as memory.
- The tutor later retrieves it as if it were fact.
- The tutor adapts to a hallucinated learner rather than the real learner.

This is especially dangerous in education because the false state can shape the learner's opportunities. For example, if the tutor silently decides that a learner has low agency, math anxiety, weak abstraction ability, or resistance to challenge, it may reduce rigor, over-scaffold, or misread productive struggle.

The system therefore needs a distinction between:

- **observations:** what the learner actually said or did;
- **hypotheses:** tentative interpretations of those observations;
- **policies:** pedagogical moves selected under uncertainty;
- **claims:** stable statements the system is allowed to use later.

Most learner-state entries should be hypotheses, not claims.

---

## 3. Design principle

### Adaptivity is not memory. Adaptivity is accountable action selection.

A tutor is adaptive only if learner evidence changes the selected pedagogical action. The memory layer is only useful insofar as it supports that decision.

Bad adaptive pattern:

```text
Learner says something ambiguous
  -> model infers a broad learner profile
  -> profile is saved in hidden memory
  -> future prompts are rewritten around that profile
  -> tutor acts confidently on unsupported assumptions
```

Preferred adaptive pattern:

```text
Learner says something ambiguous
  -> extractor records quoted evidence
  -> state layer creates a tentative, expiring hypothesis
  -> policy selector chooses diagnostic probe rather than personalization
  -> tutor asks the learner to confirm or disconfirm the hypothesis
  -> state is updated only from new evidence
```

The invariant rule:

> No adaptive action should depend on learner-state information that lacks quoted evidence, confidence, and an expiry rule.

---

## 4. Proposed architecture: Evidence-Bound Adaptive Tutor

The next system should be a bounded controller wrapped around the existing recognition tutor.

```text
learner utterance
  -> evidence extractor
  -> learner-state updater
  -> contradiction and confidence checker
  -> pedagogical policy selector
  -> response generator
  -> grounding validator
  -> learner-facing correction opportunity
```

### 4.1 Immutable pedagogical charter

The system prompt should remain stable. It should contain:

- recognition / intersubjective pedagogy orientation;
- safety and epistemic humility constraints;
- the finite policy vocabulary;
- rules for evidence-bound state use.

It should not be rewritten every turn. Mutable learner state should be passed in as a structured input block, not baked into the system prompt.

### 4.2 Event-sourced learner evidence

Every observation is appended. It is never silently overwritten.

```json
{
  "obs_id": "obs_014",
  "turn": 7,
  "quote": "I can follow your example, but I can't make one myself.",
  "type": "learner_self_report",
  "kc_candidates": ["generate_example", "transfer"],
  "created_by": "extractor_v2",
  "validated": true
}
```

This lets the system distinguish what was observed from what was inferred.

### 4.3 Typed state hypotheses

State entries should be tentative, scoped, and expiring.

```json
{
  "hypothesis_id": "h_006",
  "claim": "Learner may need faded-example support for independent generation.",
  "confidence": 0.66,
  "supporting_evidence": ["obs_014"],
  "contradicting_evidence": [],
  "status": "tentative",
  "expires_after_turns": 2,
  "next_validation_action": "ask learner to generate a partial example"
}
```

Forbidden pattern:

```json
{
  "claim": "Learner lacks confidence and resists abstraction.",
  "evidence": [],
  "status": "durable"
}
```

### 4.4 Minimal learner state

Start with the smallest state needed to choose the next move.

```json
{
  "current_objective": {
    "kc_id": "generate_example",
    "source": "course_map"
  },
  "last_evidence": {
    "quote": "I get the example but I don't know what to write next.",
    "turn": 4,
    "evidence_type": "learner_self_report"
  },
  "working_hypothesis": {
    "claim": "Learner can recognize examples but has not yet shown independent generation.",
    "confidence": 0.62,
    "expires_after_turns": 2
  },
  "mastery_estimate": {
    "kc_id": "generate_example",
    "p_mastery": 0.41,
    "method": "dialogue_tag_or_rule_update",
    "last_assessed_by": "teach_back"
  },
  "next_action_constraint": {
    "allowed_actions": ["diagnostic_probe", "worked_example_fade", "teach_back"],
    "forbidden_actions": ["declare_mastery", "advance_topic"],
    "reason": "no independent production evidence yet"
  }
}
```

### 4.5 Policy selector

Adaptation should happen at the policy level before final prose generation. Suggested policy vocabulary:

```text
diagnostic_probe
conceptual_contrast
worked_example
faded_example
productive_struggle_hold
affective_repair
metacognitive_reflection
teach_back
transfer_challenge
summarize_and_check
```

The selector should produce a compact decision object:

```json
{
  "selected_policy": "faded_example",
  "reason": "Learner recognizes examples but has not shown independent production.",
  "evidence": ["obs_014"],
  "risk": "May over-scaffold; include a learner choice point."
}
```

### 4.6 Response generator

The LLM should generate the final tutor message after the policy is selected. This keeps the LLM in the role where it is strongest: warm, contextual language generation.

### 4.7 Grounding validator

Before sending the response, a validator checks:

```text
Does the response implement the selected policy?
Does it use only supported learner-state claims?
Does it avoid declaring unsupported mastery, motives, or traits?
Does it preserve learner agency?
Does it ask for confirmation when confidence is low?
```

### 4.8 Learner correction

When the state is uncertain, the tutor should surface the model:

> "My read is that the example makes sense, but making your own example is the hard part. Is that right?"

This makes recognition operational. The learner is not merely represented; the learner can contest the representation.

---

## 5. Mechanisms not yet explored enough

### 5.1 Minimal sufficient state

Test whether a minimal evidence-bound state object beats rich profiles. The paper's own state-richness reversal makes this a priority.

Hypothesis:

> Adaptivity improves when the learner state is just rich enough to select the next pedagogical move, and degrades when it invites latent-trait inference.

### 5.2 Diagnosis-before-adaptation

The tutor should not adapt to a suspected misconception until it has evidence. When evidence is weak, the adaptive move is diagnostic probing.

```text
if misconception_confidence < 0.70:
    choose diagnostic_probe
elif mastery < threshold:
    choose targeted_scaffold
else:
    choose fading_or_transfer_task
```

### 5.3 Knowledge tracing over dialogue turns

Maintain mastery estimates for knowledge components. Use LLMs to tag dialogue turns for knowledge component, correctness, and evidence type, then feed those tags into a simple knowledge-tracing model.

Separate:

```text
epistemic memory: what the learner has shown evidence of knowing
interaction memory: what the learner has asked, preferred, or corrected
```

Epistemic memory should update from performance evidence. Interaction memory can update from self-report, but should remain contestable.

### 5.4 Policy-first adaptation

Evaluate whether the tutor selects the right move at the right trigger. This is more precise than asking whether holistic tutor quality improves.

The trap suite should become central. It already tests the construct that matters: strategy selection under learner signals.

### 5.5 Candidate action search

Replace expensive full-response best-of-N with action-plan best-of-N.

```text
Generate 5 candidate policy objects.
Score each for:
  - evidence support
  - expected learning value
  - over-inference risk
  - alignment with current objective
Select one.
Generate one final response.
```

This preserves search benefits while reducing cost and instability.

### 5.6 Retrieval-grounded adaptation

Retrieval should be targeted:

```text
retrieve course facts needed for this turn
retrieve learner observations relevant to this exact knowledge component
ignore unrelated learner history
```

Avoid retrieving a full biography of the learner.

### 5.7 Contradiction checks

Before acting on learner state, ask:

```text
Is this claim directly supported by quoted learner evidence?
Is there contradictory evidence?
Is the claim too broad for the evidence?
Should it be downgraded to a question?
```

### 5.8 Outcome-driven optimization

Eventually, optimize selected policies against predicted student learning, not only judge-rated tutor prose.

```text
candidate policy
  -> predicted next-turn student correctness
  -> predicted affect/engagement risk
  -> pedagogical-quality constraint
  -> choose highest constrained expected learning value
```

### 5.9 Human-in-the-loop adaptivity

A strong near-term deployment path is a tutor co-pilot. Let human tutors approve or correct the learner state and policy choice. Use those corrections as preference data.

---

## 6. Proposed experiments

### Experiment 1: Minimal evidence-bound state

Conditions:

```text
A. recognition-only
B. recognition + rich learnerProfile
C. recognition + minimal evidence-bound state
D. recognition + minimal state + policy selector
```

Primary outcomes:

- strict strategy-shift correctness;
- family-match correctness;
- unsupported learner-state rate;
- pedagogical coherence;
- response usefulness under ambiguous learner signals.

### Experiment 2: Diagnosis-before-adaptation

Create ambiguous learner scenarios and compare:

```text
infer-and-adapt
ask-diagnostic-then-adapt
evidence-gated-policy
```

Primary outcome:

- false personalization rate.

### Experiment 3: Dialogue knowledge tracing

Use LLM tagging plus a simple mastery model. Compare recognition-only generation against mastery-driven next-move selection.

Primary outcomes:

- next-problem appropriateness;
- delayed transfer;
- unsupported mastery claims;
- number of turns to independent production.

### Experiment 4: Action-plan best-of-N

Compare:

```text
single policy selection
full-response best-of-N
action-plan best-of-N
```

Primary outcomes:

- cost-adjusted strategy accuracy;
- validator rejection rate;
- final tutor quality;
- policy trace interpretability.

### Experiment 5: Scrutable learner model

Conditions:

```text
hidden state
state occasionally surfaced for learner confirmation
state surfaced only when confidence is low
```

Primary outcomes:

- learner correction rate;
- trust;
- hallucinated-state reduction;
- downstream policy accuracy.

### Experiment 6: Human tutor co-pilot

Human tutors see:

```text
extracted evidence
candidate state hypotheses
recommended policy
risk note
```

They approve, edit, or reject. This creates high-value supervision data.

### Experiment 7: Human learning pilot

Conditions:

```text
recognition-only AI tutor
evidence-bound adaptive AI tutor
human/tutor-as-usual or static AI baseline
```

Outcomes:

- immediate quiz;
- delayed retention;
- transfer task;
- learner correction of system model;
- perceived autonomy support;
- time to mastery.

---

## 7. Paper revisions to make now

### 7.1 Add an adaptivity taxonomy

Use a table like this early in the paper:

| Level | Construct | Current evidence |
|---|---|---|
| A0 | First-turn calibration | Strongly supported |
| A1 | Within-turn error correction | Supported, model-dependent |
| A2 | Multi-turn slope acceleration | Null |
| A3 | Triggered strategy shift | Partially positive under explicit state-policy architectures |
| A4 | Cross-session learner continuity | Preliminary and mixed |
| A5 | Human learning adaptation | Not yet tested |

This prevents readers from treating every adaptive result as the same construct.

### 7.2 Rename the operational factor

Use **intersubjective orientation** as the empirical factor name. Reserve **recognition theory** for the theoretical interpretation.

Suggested wording:

> The operational intervention is an intersubjective-pedagogy orientation. Recognition theory supplies the clearest philosophical grammar for that orientation, but the effect is not dependent on Hegelian vocabulary.

### 7.3 Reframe adaptive responsiveness

Suggested wording:

> Condition-modulated multi-turn slope adaptation failed. Triggered strategy-shift adaptation remains partially positive under explicit state-policy architectures and should be treated as a separate mechanism.

### 7.4 Turn structured-memory failure into a finding

Suggested wording:

> Rich structured memory is not equivalent to adaptivity. The strongest evidence points toward minimal, evidence-bound state plus policy selection.

### 7.5 Make A13 implementation drift visible at the start of the section

Suggested wording:

> Because the pre-registered standard-runner contrast was not implemented as intended, all A13 comparisons are reported as within-LangGraph ablations; cross-runner conclusions rely only on post-hoc exploratory baselines.

### 7.6 Soften "provable discourse"

Suggested wording:

> Provable here means machine-checkable against the evaluation database, not epistemically proven true.

### 7.7 Move revision history to supplement

Keep a compact major-corrections table in the main paper. Move the long provenance log to an appendix or repository.

### 7.8 Propagate the PCA implication

If the v2.2 rubric is mostly one factor, dimension-level claims should be framed as facets of overall tutor quality rather than independent constructs.

### 7.9 Add a deployment recommendation box

Suggested box:

```text
Capable model: recognition / intersubjective prompt only.
Weaker model: recognition + bounded validator / policy scaffold.
Research setting: multi-agent traces for observability.
Do not deploy: free-form self-rewriting memory.
```

### 7.10 Add memory-hallucination literature

The structured-memory/adaptivity discussion should cite recent work on long-term memory hallucination, memory benchmarks, RAG conflict detection, and learner-memory systems.

---

## 8. Implementation roadmap

### Phase 0: Spec lock

Deliverables:

- finite policy vocabulary;
- evidence schema;
- hypothesis schema;
- validator rules;
- forbidden state claims list;
- trap-suite mapping from learner signal to expected policy.

Exit criteria:

- every adaptive claim type has an evidence requirement;
- every policy has clear triggers and anti-triggers;
- every durable learner-state field has a correction path.

### Phase 1: Offline replay harness

Use existing dialogues. Add extractor, state updater, policy selector, and validator without changing tutor output yet.

Exit criteria:

- extractor produces quoted evidence for at least 95% of state updates;
- unsupported-state detector catches broad claims;
- policy selector output is inspectable and stable under replay.

### Phase 2: Shadow-mode adaptive controller

Run the controller beside the existing tutor. It proposes policies, but the tutor still responds normally.

Exit criteria:

- policy choices match expert labels on trap-suite scenarios;
- hallucinated-state rate below threshold;
- confidence calibration curve is acceptable.

### Phase 3: Controlled response generation

Let the selected policy condition the final response.

Exit criteria:

- response implements selected policy;
- validator rejection rate declines over iterations;
- final outputs beat recognition-only on strategy-shift tasks.

### Phase 4: Learner-facing correction

Expose uncertain state to the learner.

Exit criteria:

- learners can correct system assumptions;
- corrections update future policy choices;
- surfaced state increases trust or at least does not reduce it.

### Phase 5: Human pilot

Run small human learning study.

Exit criteria:

- evidence-bound adaptive tutor beats recognition-only on at least one learning outcome or strategy-appropriateness outcome;
- no increase in false personalization;
- learners report acceptable autonomy support.

---

## 9. Acceptance metrics

### Adaptivity metrics

- strategy-shift correctness;
- trigger sensitivity;
- policy-family match;
- next-problem appropriateness;
- time to independent production;
- delayed transfer.

### Safety / epistemic metrics

- unsupported learner-state rate;
- broad-trait hallucination rate;
- contradiction rate;
- expired-state reuse rate;
- learner correction incorporation rate.

### Cost metrics

- tokens per turn;
- validator rejection cost;
- policy search cost;
- replay reproducibility.

### Paper-quality metrics

- claims separated by adaptivity level;
- all exploratory arcs labeled as exploratory;
- implementation drift surfaced before result interpretation;
- human-learning limitation repeated in abstract, conclusion, and limitations.

---

## 10. Bottom line

The next paper should not claim that structured memory solved adaptivity. It should claim something stronger and more defensible:

> Recognition / intersubjective orientation reliably improves tutor production through calibration and error correction. Free-form multi-turn adaptivity does not reliably emerge from that orientation, and rich memory can fail or harm. Genuine adaptation appears to require a separate evidence-bound control layer: minimal learner state, explicit diagnosis, finite policy selection, grounding validation, and learner contestability.

That turns the failed structured-memory arc into the main design insight:

> Adaptivity is not more memory. Adaptivity is accountable state used to choose accountable pedagogical action.

---

## Saved artifacts

- Report: `adaptive-tutor-next-steps-report.md`
- Interactive lay explainer: `geist-interactive-lay-explainer.html`
