---
title: "Adaptive AI Tutoring: A Digestible Literature Review for Plan 2.0"
date: 2026-06-19
status: "Literature review"
companion_document: "PLAN_2_0/adaptation-extension-deep-research.md"
scope: "The same 26 external sources used in the companion research synthesis"
---

# Adaptive AI Tutoring: A Digestible Literature Review for Plan 2.0

## Executive overview

The recent literature on adaptive AI tutoring tells a surprisingly consistent story: **producing a plausible tutoring response is much easier than adapting instruction well**. Large language models can explain, encourage, and ask questions fluently, but they remain unreliable at the harder parts of tutoring—diagnosing what a learner knows, deciding whether to intervene, selecting the right amount of help, distinguishing a valid but inefficient step from an incorrect one, and determining whether an intervention actually improved learning.

This conclusion is supported by several complementary results. A benchmark built from 75 real intelligent-tutoring scenarios found that even the strongest tested language model only marginally reproduced the adaptivity of an explicit tutoring system [[S1]](#s1). TutorGym found chance-level performance when models judged incorrect learner actions and only about 52–70% correctness when selecting next steps [[S3]](#s3). A large logic benchmark found that models handled optimal steps well but often rejected valid-but-suboptimal reasoning and accepted incorrect reasoning—the cases where adaptive feedback matters most [[S8]](#s8). SafeTutors further showed that failures can accumulate over dialogue: answer over-disclosure, misconception reinforcement, and scaffolding failure became markedly worse in multi-turn settings [[S26]](#s26).

The literature therefore favors **hybrid systems**. In these systems, explicit components estimate learner state, check domain correctness, choose among interpretable pedagogical actions, and enforce limits; language models are used chiefly for flexible dialogue and realization. MWPTutor, which embeds an LLM inside a finite-state pedagogical design, outperformed a free-form GPT-4 tutor in human evaluation [[S2]](#s2). LeanTutor similarly separates proof checking, valid next-step generation, and natural-language feedback [[S9]](#s9). Recent frameworks such as SLOW explicitly separate learner-state inference from action selection [[S6]](#s6).

A second major theme is that adaptation should operate under **uncertainty**, not a brittle single label. Knowledge tracing has long treated mastery as latent and probabilistic [[S22]](#s22). Newer work such as Dynamic LENS preserves uncertainty in richer learner representations [[S5]](#s5). This supports a shift from “the learner is answer-seeking” to “several explanations remain plausible, with different levels of support.” Such a representation makes diagnosis revisable and reduces the risk that one ambiguous utterance becomes a permanent characterization.

A third theme concerns the **assistance dilemma**: tutoring must decide when to help, how much to reveal, and when to remain silent [[S24]](#s24). MetaCLASS shows that current LLMs are strongly biased toward intervention; in its benchmark, silence was appropriate in 41.7% of cases, yet models selected no intervention only 4.2% of the time [[S4]](#s4). At the same time, too little support can leave learners stuck. A recent experiment with 113 students found that adaptive selection of guided and buggy examples improved performance, but different policies worked best for learners with different prior knowledge [[S7]](#s7). The literature does not endorse one universal “minimal hint.” It supports a ladder of scaffolds whose intensity and form vary with learner state, prior knowledge, and response to previous help.

Finally, policy improvement requires stronger outcome evidence than response ratings alone. Large-scale bandit work demonstrates that tutoring actions can be optimized from logged data, but also shows that personalization is not automatically beneficial: a strong population-level policy can outperform a contextual policy when treatment-effect differences are small [[S12]](#s12). Micro-randomized trials, doubly robust evaluation, and conservative offline reinforcement learning offer methods for learning cautiously from interaction data [[S21]](#s21), [[S13]](#s13), and [[S14]](#s14). These methods are useful only when outcomes are observable and actions are logged with sufficient causal provenance.

For Plan 2.0, the broad implication is:

> **Preserve explicit state-action control, but deepen it into a calibrated, evidence-bearing loop: uncertain learner state → bounded pedagogical action → grounded realization → action-specific learner outcome → revised state.**

The strongest near-term opportunity is not unconstrained reinforcement learning or a larger multi-agent prompt. It is improving learner-state calibration, intervention timing, scaffold selection, domain grounding, and outcome observability.

---

## 1. The field’s central distinction: fluent tutoring is not adaptive tutoring

The current generation of language models creates a deceptive impression of competence. A response can sound empathetic, instructional, and personalized while being only weakly contingent on the learner’s actual state.

Borchers and Shou’s adaptivity benchmark makes this problem explicit [[S1]](#s1). They varied what information an LLM received about a learner’s error, knowledge component, and context, then examined whether its instructional move changed appropriately. Across 75 scenarios and 1,350 generated moves, even the best model showed only limited sensitivity to the pedagogically relevant differences that an intelligent tutoring system represents explicitly. The important result is not that the responses were always poor. It is that their **surface quality exceeded their demonstrated adaptivity**.

TutorGym reaches a similar conclusion from a step-level perspective [[S3]](#s3). It places AI agents inside existing intelligent tutoring environments and asks them to act as tutors or students during problem solving. In its initial evaluation, language models failed at basic tutor functions: none exceeded chance in labeling incorrect learner actions, and proposed next actions were correct only about 52–70% of the time. This matters because a tutor that cannot reliably identify the learner’s present step cannot safely decide what support should follow.

The 2026 logic-tutoring benchmark sharpens the diagnosis [[S8]](#s8). Models were strong when confirming an optimal step, but weaker on two pedagogically important edge cases: valid but suboptimal reasoning and genuinely incorrect reasoning. They tended to over-reject the former and over-accept the latter. The authors also found that a correct diagnosis did not reliably lead to useful instructional feedback. Thus, **diagnostic accuracy and pedagogical action quality are separate problems**.

SafeTutors adds a longitudinal safety perspective [[S26]](#s26). It argues that tutoring safety is not exhausted by toxicity or generic harmlessness. A tutor can be polite and still undermine learning by revealing answers, reinforcing a misconception, abandoning scaffolding, or becoming less pedagogically sound over successive turns. Its reported multi-turn deterioration warns against evaluating tutors only with isolated prompt-response pairs.

### What this theme establishes

The literature strongly supports four distinctions:

1. Content fluency is not evidence of state sensitivity.
2. Correctness diagnosis is not the same as useful feedback.
3. A good single turn is not evidence of a good dialogue policy.
4. Judge-rated tutor quality is not evidence of learner improvement.

These distinctions provide the conceptual basis for keeping Plan 2.0’s state, action, realization, and outcome layers separate.

---

## 2. Why older intelligent-tutoring research still matters

Many apparent “new” problems in LLM tutoring are established questions in intelligent tutoring systems and the learning sciences. The recent literature is most productive when read as an extension of that tradition rather than a replacement for it.

### 2.1 Learner knowledge is latent and probabilistic

Knowledge tracing introduced the idea that a tutor should maintain a probability that each relevant skill has been learned, updating that probability as the learner acts [[S22]](#s22). This is a modest model by contemporary standards, but its core insight remains important: an observed answer is noisy evidence about an underlying state, not the state itself.

DAS3H extends this longitudinal view by modeling both learning and forgetting across multiple skills [[S15]](#s15). Its results on three educational datasets show the value of accounting for the temporal pattern of practice and allowing different skills to have different learning and decay curves. This argues against treating all memory as a single conversation history. Short-lived frustration, episode-level derivation strategy, and long-term mastery require different state representations and decay rules.

Dynamic LENS brings uncertainty preservation into modern deep knowledge tracing [[S5]](#s5). It combines flexible latent representations with Bayesian state-space updating and explicitly represents uncertainty rather than only producing a point prediction. Its predictive performance is comparable to competing models, but its conceptual value for adaptive tutoring is that it makes the system’s confidence part of the state.

### 2.2 Help must be balanced with productive learner work

Koedinger and Aleven call the central trade-off the **assistance dilemma**: how should a tutor balance giving information with withholding it so that learners receive enough support without losing opportunities to think and learn [[S24]](#s24)? The question cannot be answered by a universal rule such as “always give the smallest hint.” The right amount of help depends on expertise, task structure, prior attempts, affect, available time, and whether the learner can make productive progress unaided.

The ICAP framework provides a complementary lens [[S23]](#s23). It distinguishes passive, active, constructive, and interactive engagement, with the general prediction that more generative forms of engagement produce stronger learning when implemented well. For adaptive tutoring, ICAP suggests that an intervention should be evaluated partly by the kind of learner activity it elicits. A tutor explanation may be accurate but leave the learner passive; a carefully chosen prompt or buggy example may lead the learner to construct and articulate new understanding.

Roll and colleagues show that help seeking is itself a learnable metacognitive behavior [[S25]](#s25). Their work on a Help Tutor treats unproductive help use not merely as a content deficit but as a target for feedback. This distinction is directly relevant to requests such as “walk me through the answer.” The same phrase can reflect an actual prerequisite gap, inefficient help seeking, overload, uncertainty about the task, or an appropriate request for modeling. Good adaptation must discriminate among these possibilities rather than punish the surface form.

### 2.3 Learner models should be inspectable

Open Learner Modelling research argues that learner models should not remain opaque internal machinery [[S17]](#s17). Exposing aspects of the model can support learner reflection, teacher oversight, and correction of mistaken inferences. In an LLM tutor, this need is especially acute because inferred affect, motivation, or intent can easily exceed the evidence.

A safe design does not announce speculative personality judgments. It offers provisional, correctable interpretations: “I may be reading this as a request for the completed solution, but perhaps you want to see how the setup works. Which is closer?” This makes adaptation bilateral: the learner contributes evidence about how they should be modeled.

### What this older literature contributes

The established ITS tradition supplies the durable principles that recent LLM work often rediscovers:

- learner state is latent, uncertain, and time-varying;
- help intensity must be conditional rather than fixed;
- engagement and metacognition matter alongside correctness;
- memory should distinguish skills and timescales;
- learner models should be interpretable and correctable.

---

## 3. The emerging architectural consensus: combine explicit control with generative flexibility

The clearest architectural convergence across the literature is toward **modularity**.

MWPTutor constrains an LLM within a predefined finite-state transducer whose pedagogy is designed explicitly [[S2]](#s2). The language model supplies flexibility within states, while the system retains control over the tutoring sequence and guards against answer leakage. In human evaluation, this hybrid tutor received a better overall tutoring score than an instructed but free-form GPT-4 baseline.

LeanTutor uses a related division of labor in mathematical proof tutoring [[S9]](#s9). A proof checker determines validity, a next-step generator identifies allowable progress, and a language component communicates feedback. The system is only a proof of concept, but its decomposition is significant: the same generative component is not asked to infer correctness, search the proof space, choose pedagogy, and phrase the response simultaneously.

SLOW makes the separation of diagnosis and action selection explicit [[S6]](#s6). Its workspace includes evidence parsing, fuzzy cognitive diagnosis, counterfactual stability analysis, and prospective affective reasoning before action choice. Its evaluation is based on hybrid human-AI judgments rather than measured learning, so it should be treated as promising architectural evidence rather than a final efficacy result. Still, it illustrates the value of making deliberation inspectable.

The newer logic benchmarks reinforce this hybrid direction. Because LLM feedback agents struggle with verified distinctions among optimal, suboptimal, and incorrect steps, the authors of [[S8]](#s8) recommend grounding diagnosis in a knowledge graph while retaining LLMs for open-ended dialogue. This is closely aligned with the Plan 2.0 direction: explicit policy should determine what kind of move is allowed, while domain-grounded state constrains what the move may say.

### Verification is not universally beneficial

One of the most useful tensions in the recent literature concerns verification. It is tempting to assume that adding a critic, judge, or second agent must improve reliability. The 2026 study *When Verification Hurts* shows otherwise [[S10]](#s10). In logic-proof feedback, a verifier helped when the upstream tutor was unreliable, but reduced performance by four to six percentage points when upstream feedback was already strong. The mechanism was overspecification: the verifying pipeline introduced unnecessary detail or altered otherwise suitable feedback.

This finding argues for **conditional verification**. Verification should be activated when error risk, domain complexity, state uncertainty, or potential harm is high—not as a ritual applied to every turn. The relevant controller must estimate both the expected benefit and the pedagogical cost of verification.

### Architectural implication

A mature adaptive tutor should treat the generated utterance as the final realization of an explicit object, not as the policy itself. That object should specify:

- the learner-state evidence being acted upon;
- the pedagogical action selected;
- the facts and next steps that are permitted;
- the information that must remain withheld;
- the expected learner work;
- the observable condition for success or failure;
- whether verification is required.

This design makes errors localizable. A failure can be attributed to diagnosis, action selection, grounding, realization, or outcome assessment rather than being absorbed into one opaque generation step.

---

## 4. What should be adapted: not just content, but intervention type and timing

Much adaptive-tutoring work focuses on choosing the next problem or hint. The reviewed literature broadens the target to include scaffold intensity, cognitive engagement, metacognition, affect, silence, and ownership.

### 4.1 No intervention is a real pedagogical action

MetaCLASS represents metacognitive tutoring as selection among 11 interpretable moves related to planning, monitoring, debugging, and evaluation [[S4]](#s4). Its strongest result is the discovery of **compulsive intervention bias**. Although no intervention was appropriate in 41.7% of annotated turns, the evaluated models chose it only 4.2% of the time.

This result matters because over-intervention can create dependence, interrupt productive struggle, and communicate that the learner’s own reasoning is not trusted. An adaptive policy should therefore include an explicit `no_intervention` or `observe` action with preconditions and safety overrides. Silence is not a missing decision; it is a decision whose appropriateness can be evaluated.

### 4.2 Scaffolds should vary by prior knowledge and state

The 2026 adaptive-scaffolding study compared Bayesian Knowledge Tracing, deep reinforcement learning, and a non-adaptive policy for selecting guided versus buggy worked examples in a logic tutor [[S7]](#s7). Both adaptive policies improved performance, but their benefits differed by prior knowledge: BKT was strongest for lower-prior-knowledge learners, whereas the RL policy produced better outcomes among higher-prior-knowledge learners.

The study is relatively small and recent, so it should not be generalized too broadly. Its most important contribution is qualitative: **the best instructional form can reverse across learner groups**. A scaffold that helps a novice may constrain a more advanced learner; a constructive buggy example may benefit a learner who already has enough structure to diagnose it, while a guided example may be more effective for someone lacking prerequisite knowledge.

### 4.3 Tutoring objectives form a trade-off surface

The reinforcement-learning work of Dinucu-Jianu and colleagues explicitly balances pedagogical support against student solving accuracy [[S11]](#s11). By varying reward weights, it traces a Pareto frontier rather than treating tutoring quality as one scalar objective. This is a useful framing even though the training relies on simulated interaction. A tutor that maximizes immediate student correctness may simply give away more of the solution. A tutor that maximizes withholding may produce frustration and failure. Good tutoring lies on a constrained trade-off surface.

### Synthesis

The action space of an adaptive tutor should include more than different phrasings of “hint.” It should distinguish at least:

- observing without intervening;
- asking a discriminative diagnostic question;
- reframing the task;
- giving a conceptual cue;
- constraining the choice space;
- supplying a partial completion;
- presenting a worked or buggy example;
- requesting self-explanation;
- checking retrieval or transfer;
- stabilizing affect;
- restoring learner ownership;
- escalating to a human or tool.

The policy should choose among these actions under explicit correctness, burden, agency, and leakage constraints.

---

## 5. From personalization rhetoric to evidence-based policy learning

The literature supports learning better tutoring policies, but it also warns that “more personalized” does not automatically mean “more effective.”

### 5.1 Large-scale evidence favors a cautious progression

Schmucker and colleagues report one of the strongest deployment studies in the source set [[S12]](#s12). Using data from one million students, their system evaluated roughly 43,000 assistance actions and deployed learned multi-armed-bandit policies in 166,000 practice sessions. The policies improved student outcomes. However, contextual bandits did not consistently improve over well-optimized population-level policies because action-effect differences among students were often too small to exploit reliably.

This is an important corrective to adaptation research. Personalization adds estimation variance, complexity, and new ways to overfit. The proper sequence is:

1. establish a strong population policy;
2. test whether treatment effects differ meaningfully across learner states;
3. personalize only where heterogeneity is stable, large enough, and actionable.

### 5.2 Repeated randomization can identify when an action works

Micro-randomized trials repeatedly randomize intervention options at many decision points and estimate the immediate causal effect of each option under different conditions [[S21]](#s21). Although developed largely for just-in-time health interventions, the design maps naturally onto tutoring. At decision points where two or more actions are already considered safe, a tutor can randomize among them and learn which action works, for whom, and under what recent history.

The crucial difference from ordinary logging is that randomization supplies causal leverage. Merely observing that successful learners received a certain hint does not show that the hint caused success; tutors may have selected it precisely because those learners already appeared likely to succeed.

### 5.3 Offline evaluation requires propensities and conservatism

Doubly robust policy evaluation combines a model of rewards with a model of the behavior policy that generated the logged actions [[S13]](#s13). Its appeal is robustness: value estimates can remain accurate when either model is good, even if the other is imperfect. This makes it a natural candidate for comparing tutoring policies before deployment.

Conservative Q-Learning addresses a different risk [[S14]](#s14). Offline reinforcement-learning systems can assign unrealistically high values to actions rarely or never observed in the dataset. CQL deliberately learns lower, more conservative estimates for unsupported actions. In education, this matters because an apparently optimal but poorly supported tutoring action should not be deployed merely because a model extrapolated beyond its evidence.

### What must be logged

For causal policy learning, each adaptive decision should retain:

- the belief-state snapshot;
- the available safe action set;
- the chosen action;
- its selection probability;
- the policy version;
- the generated realization;
- correctness and conduct checks;
- immediate and delayed outcomes;
- intervening actions that may confound attribution.

Without candidate sets and propensities, later policy evaluation will be substantially weaker.

---

## 6. Outcome measurement is the neglected center of adaptation

Most current benchmarks measure whether the tutor chose a plausible move or produced a high-quality response. Those are useful mechanism measures, but they do not establish learning.

The assistance-dilemma and ICAP literatures imply that an intervention should be judged partly by what the learner subsequently does [[S24]](#s24) and [[S23]](#s23). A minimal hint succeeds when the learner independently produces the next step, not when they say “that makes sense.” A task reframe succeeds when the learner can restate the goal and begin appropriately. A worked example should remain an open intervention until the learner demonstrates understanding on an isomorphic or transfer problem.

This distinction is also necessary for policy learning. The bandit and reinforcement-learning methods in [[S12]](#s12), [[S13]](#s13), and [[S14]](#s14) require outcomes that reflect genuine educational value. If “success” is defined as a positive tutor-quality rating or polite learner acknowledgment, the policy will optimize superficial fluency.

A useful outcome vocabulary is:

- **observed success**: behavior satisfying the action-specific criterion;
- **observed failure**: behavior contradicting the intended transition;
- **inconclusive**: the response does not discriminate success from failure;
- **not yet observable**: the intervention requires a later test;
- **confounded**: another tutor action occurred before the outcome could be assessed.

Outcomes should also be separated by timescale:

- immediate independent progress;
- near transfer;
- far transfer;
- delayed retention;
- learner agency and self-regulation.

This is the area where the reviewed literature is least complete. Many recent papers offer stronger architectures or benchmarks but do not measure durable human learning. That gap should shape the claims Plan 2.x makes.

---

## 7. Simulated learners are useful instruments—but weak substitutes for people

Adaptive policies are often developed against LLM-based simulated students because simulation is cheap, controllable, and safe. The literature shows why this is useful and why it is dangerous.

Srivatsa and colleagues placed 11 LLMs and real students on a shared item-response scale using mathematics and reading items from the National Assessment of Educational Progress [[S18]](#s18). Strong general-purpose models consistently exceeded average students, while weaker models aligned only incidentally. Grade-level prompting changed behavior but did not produce a model-prompt combination that reliably matched average students across subjects and grades.

Yuan and colleagues describe the underlying problem as the **competence paradox** [[S19]](#s19). A broadly capable model is asked to behave like a partially knowledgeable learner, but its hidden competence remains available. The resulting errors may be stylistically plausible yet inconsistent with a coherent knowledge state or realistic learning trajectory. Their proposed Epistemic State Specification defines what the simulated learner may access, what errors it may make, and how its state changes.

Bayesian Theory-of-Mind teaching work supplies a related insight from simulated environments [[S16]](#s16). Teachers that model a learner’s internal state can choose more efficient demonstrations, especially when the teacher’s model aligns with the learner’s true state. The positive result and its condition are equally important: **a learner model helps only when it is sufficiently aligned**. A confidently wrong model can drive confidently wrong adaptation.

### Proper role of simulation

Simulated learners are well suited for:

- deterministic regression tests;
- known-state recovery experiments;
- adversarial failure injection;
- mechanism ablations;
- evaluation of counterfactual policy sensitivity;
- testing rare but important safety cases.

They are not sufficient for claims about:

- human learning gains;
- authentic help seeking;
- trust and perceived recognition;
- emotional response;
- long-term dependence or agency;
- real classroom robustness.

A stronger evaluation program should use multiple simulator families with explicit hidden states and reserve entire causal mechanisms—not merely paraphrases—as held-out tests.

---

## 8. Human-AI collaboration may be the strongest bridge to real-world evidence

Tutor CoPilot is the most consequential human-outcome study in this source set [[S20]](#s20). In a preregistered randomized trial involving 900 tutors and 1,800 K–12 students, tutors with access to AI guidance produced a four-percentage-point increase in student topic mastery overall and a nine-point increase for students taught by lower-rated tutors. Message analysis indicated more guiding questions and less answer giving, although tutors also reported failures such as grade-inappropriate suggestions.

The study does not show that autonomous LLM tutoring is effective. It shows that AI can improve outcomes when inserted into an existing human tutoring relationship and used to augment pedagogical decision-making. This distinction is valuable for Plan 2.x because a human-copilot condition can localize system strengths and weaknesses:

- If humans improve when shown the inferred learner state, diagnosis may be useful.
- If they improve only when shown the recommended action, policy selection may be the stronger component.
- If humans routinely rewrite recommendations, realization may be the bottleneck.
- If human oversight prevents harmful over-intervention, autonomy may be premature.

A copilot study is therefore not merely a deployment compromise. It is an experimental instrument for decomposing adaptive competence.

---

## 9. Five productive tensions in the literature

The literature does not present one settled recipe. Its disagreements are especially informative.

### Tension 1: More help versus more learner agency

The assistance dilemma [[S24]](#s24), ICAP [[S23]](#s23), MetaCLASS [[S4]](#s4), and the RL Pareto-frontier study [[S11]](#s11) all show that support and independence cannot be maximized simultaneously on every turn. The design problem is to preserve productive learner work while preventing unproductive struggle.

**Implication:** agency should be a hard design consideration and a measured outcome, not an informal style preference.

### Tension 2: Personalization versus statistical reliability

Learner-modeling and Theory-of-Mind work motivate personalization [[S5]](#s5), [[S16]](#s16), and [[S22]](#s22), but the million-student bandit study shows that contextual personalization may add little when treatment heterogeneity is weak [[S12]](#s12).

**Implication:** demonstrate stable heterogeneous effects before expanding the policy’s personal state dimensions.

### Tension 3: Verification versus overspecification

Formal checking and grounded diagnosis are clearly valuable [[S8]](#s8) and [[S9]](#s9), yet always-on verification can degrade already-good feedback [[S10]](#s10).

**Implication:** verify selectively based on difficulty, uncertainty, and harm, and measure action fidelity after verification.

### Tension 4: Realistic dialogue versus valid learner simulation

LLM students can sound convincingly human, and TutorGym even reports human-like learning curves under some conditions [[S3]](#s3). Yet shared-scale evaluation and the competence-paradox analysis show that surface realism does not guarantee coherent student ability [[S18]](#s18) and [[S19]](#s19).

**Implication:** simulator validity should be defined by epistemic constraints and transition behavior, not conversational naturalness.

### Tension 5: Better tutor responses versus better learning

Many architectural studies rely on human or model judgments of tutor quality [[S2]](#s2) and [[S6]](#s6). Human and deployment studies such as adaptive scaffolding, large-scale bandits, and Tutor CoPilot measure learning more directly [[S7]](#s7), [[S12]](#s12), and [[S20]](#s20).

**Implication:** response quality is a useful intermediate measure, but promotion decisions should eventually depend on independent progress, transfer, retention, and agency.

---

## 10. What the literature most strongly supports for Plan 2.0

### Strongly supported

1. **Keep the policy explicit and modular.** Multiple benchmarks expose weaknesses in free-form LLM adaptivity, diagnosis, and multi-turn safety [[S1]](#s1), [[S3]](#s3), [[S8]](#s8), and [[S26]](#s26). Hybrid systems provide a more defensible architecture [[S2]](#s2) and [[S9]](#s9).
2. **Represent learner state probabilistically and revisably.** This follows from knowledge tracing, uncertainty-preserving models, and the risk of learner-model misalignment [[S5]](#s5), [[S16]](#s16), and [[S22]](#s22).
3. **Make non-intervention a first-class action.** Current models strongly over-intervene [[S4]](#s4).
4. **Use a state-conditioned scaffold ladder rather than a universal hint.** The assistance dilemma and adaptive-scaffolding evidence both reject one fixed level of help [[S7]](#s7) and [[S24]](#s24).
5. **Ground correctness outside unrestricted language generation.** Step-level benchmarks and proof-tutoring architectures support formal or structured diagnosis [[S8]](#s8), [[S9]](#s9), and [[S10]](#s10).
6. **Measure action-specific learner outcomes.** Policy optimization is not trustworthy without observable educational effects [[S12]](#s12), [[S13]](#s13), [[S14]](#s14), and [[S21]](#s21).
7. **Use simulation for mechanism testing, not human-learning claims.** Current LLM student simulation lacks broad fidelity [[S18]](#s18) and [[S19]](#s19).

### Promising but less established

1. Value-of-information selection for diagnostic questions.
2. Counterfactual stability checks for learner-state inference [[S6]](#s6).
3. Theory-of-Mind-inspired demonstration selection [[S16]](#s16).
4. Contextual bandits or offline RL after sufficient causal logging [[S12]](#s12), [[S13]](#s13), and [[S14]](#s14).
5. Risk-routed verification [[S10]](#s10).

These are strong hypotheses for experimentation, but the evidence base is less mature or more simulation-dependent.

### Still unresolved

1. How to infer affect and intent without overreach.
2. Which learner-state dimensions produce actionable treatment heterogeneity.
3. How to measure ownership and recognition reliably.
4. Whether adaptive dialogue improves far transfer and delayed retention.
5. How to prevent policies from exploiting superficial outcome proxies.
6. How well the reported mechanisms generalize across subjects, age groups, and authentic classroom contexts.

---

## 11. A concise research agenda derived from the review

The literature suggests the following order of work:

1. **Calibrate the state layer.** Preserve competing hypotheses, evidence provenance, confidence, decay, and learner correction.
2. **Improve intervention timing.** Add explicit no-intervention and diagnostic stopping rules.
3. **Expand the pedagogical action ontology.** Distinguish probes, reframes, hints, examples, self-explanation, retrieval checks, affect regulation, and ownership restoration.
4. **Define action-specific outcomes.** Do not close an intervention on acknowledgment when independent learner behavior is required.
5. **Ground and selectively verify realization.** Route difficult or risky turns through formal checks without overspecifying routine turns.
6. **Collect causally useful data.** Log safe candidate sets and propensities; use micro-randomization where ethically and pedagogically appropriate.
7. **Optimize conservatively.** Establish a strong population policy before testing contextual personalization.
8. **Validate beyond simulators.** Use human-copilot and autonomous conditions with transfer, retention, and agency measures.

This sequence deepens adaptation without discarding the branch’s central strength: inspectable state-action control.

---

## 12. Evidence map and suggested reading order

| Reading goal | Start with | Then read |
|---|---|---|
| Understand why fluent LLM tutoring is not enough | [[S1]](#s1), [[S3]](#s3) | [[S8]](#s8), [[S26]](#s26) |
| Understand hybrid tutor architecture | [[S2]](#s2) | [[S9]](#s9), [[S6]](#s6), [[S10]](#s10) |
| Understand learner-state modeling | [[S22]](#s22) | [[S5]](#s5), [[S15]](#s15), [[S16]](#s16) |
| Understand help, engagement, and agency | [[S24]](#s24), [[S23]](#s23) | [[S25]](#s25), [[S4]](#s4), [[S17]](#s17) |
| Understand adaptive scaffold selection | [[S7]](#s7) | [[S11]](#s11) |
| Understand policy learning at scale | [[S12]](#s12) | [[S21]](#s21), [[S13]](#s13), [[S14]](#s14) |
| Understand simulator limitations | [[S18]](#s18) | [[S19]](#s19), [[S3]](#s3) |
| Understand real-world human augmentation | [[S20]](#s20) | [[S12]](#s12), [[S7]](#s7) |

---

# References

The labels match the companion document `adaptation-extension-deep-research.md`.

<a id="s1"></a>
**[S1] Borchers, C., & Shou, T. (2025). _Can Large Language Models Match Tutoring System Adaptivity? A Benchmarking Study._** AIED 2025. [arXiv:2504.05570](https://arxiv.org/abs/2504.05570)

<a id="s2"></a>
**[S2] Pal Chowdhury, S., Zouhar, V., & Sachan, M. (2024). _AutoTutor meets Large Language Models: A Language Model Tutor with Rich Pedagogy and Guardrails._** Learning@Scale 2024. [arXiv:2402.09216](https://arxiv.org/abs/2402.09216)

<a id="s3"></a>
**[S3] Weitekamp, D., Siddiqui, M. N., & MacLellan, C. J. (2025). _TutorGym: A Testbed for Evaluating AI Agents as Tutors and Students._** [arXiv:2505.01563](https://arxiv.org/abs/2505.01563)

<a id="s4"></a>
**[S4] Liu, N., Baraniuk, R., & Sonkar, S. (2026). _MetaCLASS: Metacognitive Coaching for Learning with Adaptive Self-regulation Support._** Recent preprint. [arXiv:2602.02457](https://arxiv.org/abs/2602.02457)

<a id="s5"></a>
**[S5] Christie, S. T., Cook, C., & Rafferty, A. N. (2024). _Uncertainty-preserving deep knowledge tracing with state-space models._** EDM 2024. [arXiv:2407.17427](https://arxiv.org/abs/2407.17427)

<a id="s6"></a>
**[S6] Wei, Y., Li, R., & Jiang, B. (2026). _SLOW: Strategic Logical-inference Open Workspace for Cognitive Adaptation in AI Tutoring._** Recent AIED paper/preprint. [arXiv:2603.28062](https://arxiv.org/abs/2603.28062)

<a id="s7"></a>
**[S7] Dey Tithi, S., Alam, N., Yasir, T., Shi, Y., Tian, X., Chi, M., & Barnes, T. (2026). _Adaptive Scaffolding for Cognitive Engagement in an Intelligent Tutoring System._** Human experiment; recent preprint. [arXiv:2602.07308](https://arxiv.org/abs/2602.07308)

<a id="s8"></a>
**[S8] Yasir, T., Li, W., Gilson, S., Dey Tithi, S., Tian, X., & Barnes, T. (2026). _Confirming Correct, Missing the Rest: LLM Tutoring Agents Struggle Where Feedback Matters Most._** Recent preprint. [arXiv:2605.16207](https://arxiv.org/abs/2605.16207)

<a id="s9"></a>
**[S9] Patel, M., Bhattacharyya, R., Lu, T., Mehta, A., Voss, N., Norouzi, N., & Ranade, G. (2025/2026). _LeanTutor: Towards a Verified AI Mathematical Proof Tutor._** Proof-of-concept system. [arXiv:2506.08321](https://arxiv.org/abs/2506.08321)

<a id="s10"></a>
**[S10] Yasir, T., et al. (2026). _When Verification Hurts: Asymmetric Effects of Multi-Agent Feedback in Logic Proof Tutoring._** Recent preprint. [arXiv:2603.27076](https://arxiv.org/abs/2603.27076)

<a id="s11"></a>
**[S11] Dinucu-Jianu, D., Macina, J., Daheim, N., Hakimi, I., Gurevych, I., & Sachan, M. (2025). _From Problem-Solving to Teaching Problem-Solving: Aligning LLMs with Pedagogy using Reinforcement Learning._** EMNLP 2025 oral. [arXiv:2505.15607](https://arxiv.org/abs/2505.15607)

<a id="s12"></a>
**[S12] Schmucker, R., Pachapurkar, N., Bala, S., Shah, M., & Mitchell, T. (2025). _Learning to Optimize Feedback for One Million Students: Insights from Multi-Armed and Contextual Bandits in Large-Scale Online Tutoring._** Large-scale deployed study. [arXiv:2508.00270](https://arxiv.org/abs/2508.00270)

<a id="s13"></a>
**[S13] Dudík, M., Langford, J., & Li, L. (2011). _Doubly Robust Policy Evaluation and Learning._** ICML 2011. [arXiv:1103.4601](https://arxiv.org/abs/1103.4601)

<a id="s14"></a>
**[S14] Kumar, A., Zhou, A., Tucker, G., & Levine, S. (2020). _Conservative Q-Learning for Offline Reinforcement Learning._** [arXiv:2006.04779](https://arxiv.org/abs/2006.04779)

<a id="s15"></a>
**[S15] Choffin, B., Popineau, F., Bourda, Y., & Vie, J.-J. (2019). _DAS3H: Modeling Student Learning and Forgetting for Optimally Scheduling Distributed Practice of Skills._** EDM 2019. [arXiv:1905.06873](https://arxiv.org/abs/1905.06873)

<a id="s16"></a>
**[S16] Grislain, C., Caselles-Dupré, H., Sigaud, O., & Chetouani, M. (2023). _Utility-based Adaptive Teaching Strategies using Bayesian Theory of Mind._** Simulated teaching experiments. [arXiv:2309.17275](https://arxiv.org/abs/2309.17275)

<a id="s17"></a>
**[S17] Conati, C., Porayska-Pomsta, K., & Mavrikis, M. (2018). _AI in Education needs interpretable machine learning: Lessons from Open Learner Modelling._** [arXiv:1807.00154](https://arxiv.org/abs/1807.00154)

<a id="s18"></a>
**[S18] Srivatsa, K. V. A., Maurya, K. K., & Kochmar, E. (2025). _Can LLMs Reliably Simulate Real Students' Abilities in Mathematics and Reading Comprehension?_** BEA/ACL 2025. [arXiv:2507.08232](https://arxiv.org/abs/2507.08232)

<a id="s19"></a>
**[S19] Yuan, Z., Xiao, Y., Li, M., Xuan, W., Tong, R., Diab, M., & Mitchell, T. (2026). _Towards Valid Student Simulation with Large Language Models._** Methodological preprint. [arXiv:2601.05473](https://arxiv.org/abs/2601.05473)

<a id="s20"></a>
**[S20] Wang, R. E., Ribeiro, A. T., Robinson, C. D., Loeb, S., & Demszky, D. (2024/2025). _Tutor CoPilot: A Human-AI Approach for Scaling Real-Time Expertise._** Preregistered randomized trial. [arXiv:2410.03017](https://arxiv.org/abs/2410.03017)

<a id="s21"></a>
**[S21] Qian, T., et al. (2021). _The Micro-Randomized Trial for Developing Digital Interventions: Experimental Design and Data Analysis Considerations._** [arXiv:2107.03544](https://arxiv.org/abs/2107.03544)

<a id="s22"></a>
**[S22] Corbett, A. T., & Anderson, J. R. (1994). _Knowledge tracing: Modeling the acquisition of procedural knowledge._ User Modeling and User-Adapted Interaction, 4, 253–278.** [DOI](https://doi.org/10.1007/BF01099821)

<a id="s23"></a>
**[S23] Chi, M. T. H., & Wylie, R. (2014). _The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes._ Educational Psychologist, 49(4), 219–243.** [DOI](https://doi.org/10.1080/00461520.2014.965823)

<a id="s24"></a>
**[S24] Koedinger, K. R., & Aleven, V. (2007). _Exploring the Assistance Dilemma in Experiments with Cognitive Tutors._ Educational Psychology Review, 19, 239–264.** [DOI](https://doi.org/10.1007/s10648-007-9049-0)

<a id="s25"></a>
**[S25] Roll, I., Aleven, V., McLaren, B. M., & Koedinger, K. R. (2011). _Improving students' help-seeking skills using metacognitive feedback in an intelligent tutoring system._ Learning and Instruction, 21(2), 267–280.** [DOI](https://doi.org/10.1016/j.learninstruc.2010.07.004)

<a id="s26"></a>
**[S26] Hazra, R., Ghuku, B., Marchenko, I., Tokarieva, Y., Layek, S., Banerjee, S., Stoyanovich, J., & Pechenizkiy, M. (2026). _SafeTutors: Benchmarking Pedagogical Safety in AI Tutoring Systems._** Recent preprint. [arXiv:2603.17373](https://arxiv.org/abs/2603.17373)

---

## Evidence-status note

The source set mixes foundational peer-reviewed work, recent conference papers, large-scale deployments, randomized human studies, simulation studies, benchmarks, and 2026 preprints. Their evidential roles differ:

- **Foundational design principles:** [S13–S17], [S21–S25]
- **Human or deployed outcome evidence:** [S7], [S12], [S20], with differing scales and contexts
- **Mechanism and failure benchmarks:** [S1], [S3], [S4], [S8], [S10], [S18], [S26]
- **Architectural demonstrations:** [S2], [S6], [S9], [S11], [S16], [S19]

Recent preprints are valuable for generating hypotheses and identifying failure modes, but they should not independently justify strong claims about durable human learning or deployment readiness.
