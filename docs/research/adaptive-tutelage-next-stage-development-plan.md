# Follow-up Plan for Next Stages of Development

**Project:** *Geist in the Machine* / adaptive tutelage mechanisms  
**Purpose:** Turn the literature review and mechanism audit into a staged research-and-development roadmap.  
**Guiding claim:** Adaptive LLM tutoring should be developed as **auditable conduct governance over a stateful pedagogical task**, not as unsupported inference about the learner's inner state.

---

## 0. Current evidence boundary

The next stage should preserve the existing claim structure:

- **Supported:** recognition-oriented / intersubjective prompts improve judged tutor output quality in the studied apparatus; calibration and error correction are supported mechanisms; formal pacing guards move specific dramatic-derivation failure classes.
- **Not supported:** recognition-modulated adaptive responsiveness as a general trajectory mechanism.
- **Bounded:** visible/page-only pacing matched hidden proof-state pacing only in the lantern world, where visible uptake tracked latent proof distance.
- **Not established:** human learning, long-term transfer, generality across proof shapes and domains, or any claim that the tutor reads the learner's mind.

The development plan below is organized to convert these boundaries into experiments rather than rhetoric.

---

## 1. Priority map

| Priority | Workstream | Why it comes next | Main output |
|---:|---|---|---|
| P0 | Finish Marrick/world-005 fan | Tests whether visible pacing still works when visible uptake and proof distance decouple | Detector-split report across baseline / hidden / visible arms |
| P1 | Guard-isolation matrix | Separates pacing, proof-debt, visible proxy, hidden proof-state, and placebo attention | Cross-world failure-mode table |
| P2 | Human validation of process taxonomy | Validates or revises LLM-generated superego critique categories | Coder agreement report and revised codebook |
| P3 | Critic-source ladder | Places superego in self-correction literature by varying feedback source | Error-correction externality study |
| P4 | Stance-vs-surface experiment | Tests whether question-asking is a channel or a mechanism | Causal prompt-family and surface-feature ablation |
| P5 | Judge and simulated-learner validation | Reduces measurement risk before human claims | Multi-judge + human expert + simulation-validity report |
| P6 | Human learner pilot | Tests whether mechanism improvements translate to learning | Pre/post/delayed human study |
| P7 | Testbed release | Makes the apparatus externally usable | Minimal reproducible benchmark package |

---

## 2. P0: Finish Marrick/world-005 generalization

### Research question

Does visible/page-state pacing still match hidden proof-state pacing when the proof world decouples visible uptake from latent proof distance?

### Rationale

Lantern/world-002 is a linear chain where visible uptake is a good proxy for latent proof progress. Marrick/world-005 is a branching AND-join world designed to break that coupling. This is the most important immediate generalization test because either outcome is informative:

- If visible pacing still matches hidden pacing, the page-state proxy is more robust than expected.
- If visible pacing fails while hidden pacing succeeds, the paper obtains a clean boundary condition: visible uptake is sufficient only when it tracks latent proof distance.

### Required arms

Run the registered k=5 fans:

| Arm | Labels | Purpose |
|---|---|---|
| Baseline | `marrick-real-r1` ... `r5` | Natural LLM conduct prior |
| Hidden proof-state pacing | `marrick-guard-r1` ... `r5` | Mechanically proof-aware release discipline |
| Visible/page-state pacing | `marrick-visible-r1` ... `r5` | Conduct-derived proxy discipline |

### Primary outcome

Failure-mode distribution, not just success rate:

- grounded;
- early-pull death;
- wrong-branch overfocus;
- premature AND-join;
- decay-starvation;
- visible-uptake false positive;
- learner disengagement unrelated to proof state.

### Decision rules

| Result pattern | Interpretation |
|---|---|
| Hidden and visible both remove early-pull deaths | Visible proxy generalizes beyond lantern. |
| Hidden succeeds, visible fails by branch/join errors | Visible proxy is locally sufficient in lantern but not when uptake and proof distance decouple. |
| Both hidden and visible fail | Current guard logic is underspecified for branching DAGs. Redesign guard state before broad claims. |
| Baseline succeeds at high rate | Marrick may be too easy or the branch structure does not actually stress the proxy. Increase distractors or branch ambiguity. |

### Deliverable

`exports/dramatic-derivation/boundary-marrick/detector-split-report.md`, with a short manuscript-ready paragraph that explicitly states whether the lantern visible-guard result generalized or hit its boundary.

---

## 3. P1: Guard-isolation matrix across formal worlds

### Research question

Which guard does what, and which failure class does each guard leave behind?

### Why this matters

The current proof-debt result is stacked: proof-debt repair was added on top of pacing. The next phase should isolate each mechanism rather than treating the stack as one effect.

### Experimental matrix

Run the following across at least three world shapes:

1. **Linear chain**: lantern-style, visible uptake aligned with latent proof distance.
2. **Branching AND-join**: Marrick-style, visible uptake can mislead.
3. **Distractor-heavy graph**: same-surface or near-surface decoys, requiring guard discrimination.

| Arm | Description | Mechanism isolated |
|---|---|---|
| Baseline | No guard | Natural conduct prior |
| Hidden pacing only | Proof-state release pacing | Scheduling discipline with oracle state |
| Visible pacing only | Page-state release pacing | Scheduling discipline using public proxy |
| Proof-debt only | Restore released critical premises without pacing | Memory/common-ground repair |
| Hidden pacing + proof-debt | Current stronger stack | Scheduling plus repair |
| Visible pacing + proof-debt | Public-proxy stack | Deployable-ish guard stack |
| Placebo guard | Extra “attention” / reminder with no proof-state content | Tests whether added friction alone explains gains |
| Random-delay guard | Holds releases randomly within legal window | Tests whether “slower” alone explains gains |

### Primary analysis

Use a detector-split table by world and arm:

| World | Arm | grounded | early-pull | decay-starved | wrong-branch | premature-join | false-restore | other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|

### Success criterion

Do not require large-N success-rate certainty at first. The first target is mechanism specificity: each guard should have a predictable failure-mode signature.

### Manuscript payoff

This converts “guards help” into “this guard removes this failure class and exposes this residual class.” That is the core methodological contribution.

---

## 4. P2: Human validation of superego critique taxonomy

### Research question

Do human expert coders agree with the LLM-generated taxonomy of superego critiques and revision types?

### Current risk

The paper's factorial-level results are cross-judge validated, but the process-level taxonomy remains a recursive LLM-on-LLM judgment. This is the highest-value validation step before making strong process-tracing claims.

### Procedure

1. Use the existing deterministic sampling script to create a stratified sample of 40-60 ego/superego exchanges across critique categories, conditions, models, and outcome types.
2. Recruit at least two expert coders with background in learning sciences, ITS, or tutoring dialogue analysis.
3. Blind coders to condition and LLM labels.
4. Have coders label:
   - critique category;
   - revision type: substantive, partial, cosmetic, harmful;
   - whether the final output actually addresses the critique;
   - whether the critique is pedagogically valid.
5. Compute Cohen's kappa, Fleiss' kappa where possible, per-category F1, and confusion matrices.
6. Compare human-human agreement to human-LLM and LLM-LLM baselines.

### Acceptance criteria

| Result | Action |
|---|---|
| Human-human kappa >= 0.60 and human-LLM close to LLM-LLM baseline | Keep taxonomy with caveats. |
| Human-human kappa >= 0.60 but human-LLM low | Revise automated classifier; human taxonomy becomes anchor. |
| Human-human kappa < 0.60 | Taxonomy is not stable; collapse categories or rewrite codebook. |
| Category-specific F1 failures | Retire or merge unstable categories. |

### Deliverable

`exports/human-validation/superego-taxonomy-validation.md`, including codebook changes and a list of which process-level claims remain licensed.

---

## 5. P3: Critic-source ladder for error correction

### Research question

Is the superego genuinely adding external error correction, or is it mostly structured self-critique?

### Design

Hold the tutor ego, learner, scenarios, and scoring fixed. Vary only the critic source.

| Arm | Critic source | What it tests |
|---|---|---|
| No critic | Single-agent baseline | No architecture-level correction |
| Same-prompt self-critique | Ego reviews its own draft | Intrinsic self-correction |
| Same-model separate superego | Current architecture | Structured separate-context critique |
| Different-model critic | Model-family externality | Whether independent model priors help |
| Mechanical/domain oracle critic | Checker / answer-key / proof-state feedback | Reliable external feedback |
| Human/expert critic sample | Human validation ceiling | Gold-standard pedagogical critique |
| Random/plausible critique placebo | Critique-shaped friction | Whether revision effort alone helps |

### Outcomes

- Initial output quality;
- final output quality;
- revision delta;
- critique validity;
- harmful revision rate;
- failure classes caught and missed;
- token/cost per point of quality lift.

### Expected payoff

This directly connects the project to the self-correction literature. If only oracle/human critics improve reliability, the superego should be framed as structured critique rather than external feedback. If separate-model or separate-context critics reliably help, the architecture claim becomes stronger.

---

## 6. P4: Stance versus surface-feature ablation

### Research question

Is the intersubjective effect caused by the underlying pedagogical stance, by visible surface behaviors such as question-asking, or by their interaction?

### Why this matters

The paper shows question-asking mediates a large share of the recognition effect, but later response-level analysis suggests surface markers alone can be negative or misleading. This needs direct causal testing.

### Prompt cells

| Cell | Stance | Question instruction | Surface markers | Purpose |
|---|---|---|---|---|
| A | Intersubjective | No mandatory question | Natural stance effect |
| B | Intersubjective | Mandatory turn-ending question | Stance + forced elicitation |
| C | Transmission/behaviorist | Mandatory turn-ending question | Question without stance |
| D | Surface empathy only | Acknowledgement / paraphrase markers | Surface without stance |
| E | Generic strong tutor | Matched length and specificity | Prompt-density control |
| F | Behaviorist/transmission | No question | Orthogonal family control |

### Measures

- tutor quality;
- elicitation quality;
- productive difficulty;
- question quality, not just question count;
- surface acknowledgement count;
- learner response depth;
- whether questions cede initiative or merely perform interactivity.

### Decision logic

| Pattern | Interpretation |
|---|---|
| A > C and D | Stance is load-bearing. |
| B > A and C | Questions add value only when embedded in stance. |
| C ~= A | Question behavior may be more causal than theory predicts. |
| D underperforms | Surface empathy is not a substitute for pedagogical orientation. |

### Manuscript payoff

This turns the current mediation/correlation evidence into a causal mechanism test.

---

## 7. P5: Evaluation stack hardening

### Research question

Which claims survive when LLM judges, human judges, mechanical checkers, and simulated learners disagree?

### Recommended evaluation stack

| Evidence type | Use | Limitation |
|---|---|---|
| Mechanical checker | Formal grounding, proof state, release legality | Only available in formal worlds |
| LLM judges | Scalable quality comparisons | Biases, calibration drift, recursive evaluation |
| Human expert judges | Pedagogical quality and process validity | Expensive, slower, lower N |
| Human learners | Actual learning and transfer | Requires IRB/design overhead |
| Simulated learners | Controlled probe of interaction | Authenticity limits |

### Immediate tasks

1. Freeze a small “gold transcript” set of 50-100 tutor turns across conditions and quality bands.
2. Get human expert ratings on the same rubric used by LLM judges.
3. Estimate LLM-human agreement by dimension, not just overall.
4. Use pairwise randomized order to detect position bias.
5. Run length-normalized and verbosity-controlled scoring.
6. Report absolute calibration separately from within-judge condition effects.

### Deliverable

`exports/evaluation-validity/judge-human-calibration.md`, with a short decision table specifying which paper claims can rely on LLM judges alone and which require human or mechanical validation.

---

## 8. P6: Simulated learner validity screen

### Research question

Are the synthetic learners good enough to support mechanism testing, and where do they distort the tutor's behavior?

### Design

Create a small human-transcript anchor set in one domain, then compare simulated learners to human learners on:

- response length;
- linguistic complexity;
- confusion and error patterns;
- emotional variability;
- resistance/disengagement;
- question asking;
- consistency of misconception;
- uptake and forgetting across turns.

### Benchmark arms

| Simulator | Purpose |
|---|---|
| Current prompted learner | Existing baseline |
| Prompted learner with profile noise | Tests variability and imperfection |
| Retrieval-conditioned learner | Anchored to human transcript examples |
| Fine-tuned / preference-optimized learner if feasible | Higher-fidelity simulator |
| Human learner transcripts | Anchor |

### Decision rule

Synthetic learners remain acceptable for mechanism stress tests if they reproduce the *failure pressures* needed by the tutor, not if they perfectly imitate humans. For human-learning claims, they are insufficient regardless of fidelity.

---

## 9. P7: Human learner pilot

### Research question

Do the mechanisms that improve tutor conduct and formal derivation outcomes improve human learning, retention, or transfer?

### Domain choice

Use a domain where task state is inspectable but learning is real:

- propositional logic proofs;
- algebra transformations;
- causal graph reasoning;
- introductory programming debugging;
- conceptual physics with misconception inventories.

Logic/proof tutoring is the cleanest bridge because it connects the formal derivation apparatus to existing proof-tutor literature.

### Recommended arms

| Arm | Description | Why include it |
|---|---|---|
| A | Standard single-agent LLM tutor | Baseline chatbot tutor |
| B | Intersubjective prompt only | Calibration mechanism |
| C | Intersubjective prompt + superego | Calibration + error correction |
| D | Intersubjective prompt + guard stack | Conduct governance |
| E | Expert-authored ITS/scaffold if feasible | Non-LLM instructional benchmark |
| F | Practice-only / reading control | Minimum instructional control |

### Measures

- pretest;
- immediate posttest;
- delayed posttest;
- near transfer;
- far transfer;
- time on task;
- hint dependence;
- productive-struggle transcript markers;
- learner affect and perceived autonomy;
- whether students can explain the derivation, not just produce an answer.

### Primary outcome

Use learning gain and delayed transfer as primary outcomes. Treat satisfaction, engagement, and tutor quality as secondary.

### Stop/go criteria

| Pilot result | Next action |
|---|---|
| Tutor-quality gains but no learning gain | Reframe as tutor conduct, not learning; inspect over-helping and struggle preservation. |
| Learning gain only in guard stack | Prioritize stateful conduct governance over prompt-only work. |
| Prompt-only matches guard stack | Use cheaper calibration-first deployment; reserve guards for high-risk domains. |
| High variance by learner prior knowledge | Add learner-stratified adaptation or mastery gating. |

---

## 10. P8: Minimal reproducible testbed release

### Goal

Make the apparatus publishable as a reusable benchmark rather than a one-off internal harness.

### Minimal package

- one linear proof world;
- one branching proof world;
- release-calendar format;
- checker script;
- baseline transcripts;
- guarded transcripts;
- detector-split script;
- scoring rubric;
- claim-ledger example;
- reproduction command for the lantern table;
- documentation of formal-vs-human-learning limits.

### Required documentation

1. **Quickstart:** reproduce a baseline vs guard detector split.
2. **World schema:** how to author a new proof DAG.
3. **Guard schema:** hidden proof-state, visible page-state, proof-debt repair.
4. **Failure taxonomy:** definitions and examples.
5. **Non-claims:** no human learning, no mind reading, no cross-world generality unless tested.

### External-facing name

Use a name like **LLM Tutor Conduct Testbed** or **Dramatic Derivation Harness**. Avoid names that imply solved adaptivity.

---

## 11. Manuscript revision actions

### Immediate edits

1. Move classic ITS to the beginning of the related work.
2. Translate “proof-debt guard” into model-state repair / common-ground repair / constraint repair language.
3. Translate “pacing guard” into formalized scaffolding / feedback timing language.
4. Rename or qualify “process tracing” as engineered trace analysis inspired by process tracing.
5. Add simulated-learner validity literature and explicitly state that synthetic learners are controlled probes.
6. Add proof-tutor and theorem-prover tutoring literature.
7. Replace “recognition theory descendants” with “intersubjective / constructivist / dialogic pedagogical orientation” where genealogy is not essential.
8. Keep Hegel as theoretical articulation, not empirical uniqueness.

### Suggested revised contribution list

The paper contributes:

1. a mechanism-evaluation harness for LLM tutoring;
2. evidence that intersubjective prompts primarily act through calibration;
3. evidence that critic architecture provides overlapping, model-dependent error correction;
4. a clean null for recognition-modulated adaptive responsiveness;
5. a formal derivation testbed showing how pacing and repair guards move failure modes;
6. an engineered trace and claim-ledger methodology for auditing LLM tutor mechanisms.

### Claims to retire or soften

| Current risk | Safer replacement |
|---|---|
| “Adaptive tutelage” as broad theory | “Adaptive tutelage as a guardable conduct-control problem” |
| “The tutor recognizes the learner” | “The prompt instructs the tutor to respond to the learner as an autonomous contributor” |
| “Visible pacing is enough” | “Visible pacing is enough in lantern, where page uptake tracks proof distance” |
| “Proof-debt repair works” | “A stacked proof-debt repair arm converted one decay-starved failure” |
| “Process tracing proves mechanism” | “Engineered trace analysis supplies within-case evidence for mechanism hypotheses” |

---

## 12. Decision tree for the next paper version

```text
Start
 |
 |-- Finish Marrick fan
 |     |
 |     |-- Visible matches hidden --> claim visible proxy has cross-world support, still bounded
 |     |-- Hidden beats visible --> claim lantern proxy boundary identified
 |     |-- Both fail --> redesign branching guard
 |
 |-- Human-code superego taxonomy
 |     |
 |     |-- Reliable --> keep mechanism trace claims
 |     |-- Unreliable --> collapse taxonomy and re-run process analysis
 |
 |-- Run critic-source ladder
 |     |
 |     |-- Oracle/different-model critic wins --> strengthen external-feedback account
 |     |-- Same-model superego equals self-critique --> reframe as structured self-critique
 |
 |-- Run stance/surface ablation
 |     |
 |     |-- Stance wins --> keep intersubjective-orientation theory
 |     |-- Questions alone win --> rewrite mechanism around elicitation behavior
 |
 |-- Human learner pilot
       |
       |-- Learning gain + transfer --> cautiously extend to human learning
       |-- Tutor quality only --> keep output-quality framing
```

---

## 13. Near-term checklist

1. Regenerate a current `references.bib` diff with the added ITS, proof-tutor, simulated-learner, and LLM-tutor references.
2. Produce the Marrick detector-split report.
3. Freeze a guard-isolation matrix preregistration before additional formal-world runs.
4. Send the human validation packet to two coders.
5. Build the critic-source ladder with at least no-critic / same-model superego / oracle critic.
6. Build the stance-surface prompt family.
7. Create a gold transcript set for judge calibration.
8. Draft the human learner pilot protocol.
9. Extract a minimal public testbed from the dramatic-derivation harness.
10. Revise Section 2 and the conclusion to align novelty with the literature.

---

## 14. Strongest next-stage claim if all P0-P4 succeed

> We show that adaptive LLM tutoring can be decomposed into prompt-level calibration, critic-mediated error correction, and guard-level conduct control. Classic ITS supplies the underlying instructional commitments; our contribution is a reproducible mechanism harness that makes those commitments testable in open-ended LLM dialogue. Across formal proof worlds, guards do not merely improve aggregate success; they move specific failure classes. Human learning remains a separate validation target.

