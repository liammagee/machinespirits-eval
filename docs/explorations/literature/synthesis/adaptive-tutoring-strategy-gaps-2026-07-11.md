# Literature review: adaptive tutoring strategy gaps

**Date:** 2026-07-11<br>
**Depth:** deep, architecture-aimed<br>
**Corpus read:** the local corpus currently contains one substantive PDF, *The Drama Machine* (`2408.01725v2.pdf`), plus index/manifests; the expected topic directories are absent. Current primary literature (2024–2026) was therefore reviewed on the web.<br>
**Cross-referenced:** `PLAN_4_0/`, the dated May architecture notes, `docs/research/paper-full-2.0.md`, relevant workplan cards, recent tutor-stub artifacts, and `AGENTS.md`.

## What the literature supports

The project is right to separate explicit state, policy selection, controlled action, and LLM realization. Dialogue knowledge tracing, language-bottleneck models, and model-tracing tutors all support keeping an externally inspectable state around the language model. The qualification is decisive: a state representation earns control authority through calibrated prediction of held-out observations, not through conceptual richness. PLAN_4_0's geometric fields should therefore be treated as engineered features until they beat a lean, difficulty-aware belief state on next-error, next-evidence, or task-outcome prediction.

The recent fixed-horizon policy-by-profile crossings are theoretically plausible. A real-student adaptive-scaffolding study found that different selectors favored different prior-knowledge groups, while Tutor CoPilot showed that guarded recommendations can change tutor practice and improve mastery. This supports heterogeneous policies and an eventual human-tutor co-pilot path. It does not validate synthetic profile fidelity or any particular field representation.

Guardrails, formal evidence ownership, and independent outcomes are the strongest current choices. Human experiments with unrestricted versus guarded generative tutors show why assisted success is insufficient: support can improve performance while harming later unassisted work. The evaluation target must include uptake, fading, immediate independent work, delayed retention, and transfer.

## Where PLAN_4_0 is too narrow or too strong

Register is only one policy coordinate. Contemporary tutor-move and scaffolding work distinguishes diagnosis, elicitation, hinting, explanation, worked and buggy examples, self-explanation, retrieval, fading, confrontation, and transfer. A properly adaptive action should factor instructional move, support level, knowledge component, task difficulty, register, expected evidence, and fade condition. The next ablation must hold move constant while varying register, then hold register constant while varying move.

The controller should sometimes choose a diagnostic question for its value of information. Replace definitive profile prose with weighted hypotheses containing supporting and contradicting evidence plus the next discriminating observation. Jointly model learner ability and item difficulty; otherwise a hard item can masquerade as learner regression.

The geometric vocabulary—velocity, curvature, attractors, and coupled fields—is metaphor ahead of measurement until it shows test–retest reliability, cross-model invariance, uncertainty calibration, incremental predictive value, and intervention sensitivity. Richer state is not better by default; the project's own rich-state reversal is an unusually strong warning.

Prompt-only learner simulators are useful for regression, stress, and safety testing but poor evidence for human learning or latent-state validity. Recent simulation studies find surface-role fluency without reliable cognitive fidelity. Generation contracts and validators must be separated: embedding target label distributions in the learner contract and then scoring those labels mainly tests instruction following.

## Concrete recommendations

- In `scripts/tutor-stub.js` and `scripts/tutor-stub-policy-suites.js`, factor actions into `{move_family, support_level, task, difficulty, register, expected_evidence, fade_condition}`. Add move-only, register-only, state-blind, action-frequency-yoked, random, oracle, and strong-fixed controls.
- In the field modules, attach uncertainty, evidence IDs, recency, update rule/version, validity conditions, and a predicted next observable to every dimension. Compare full fields with lean mastery/confidence/difficulty baselines using calibration, Brier score, log loss, and held-out likelihood.
- In `services/dramaticDerivation/fieldPlanner.js`, retain the hand-coded table as a baseline. Log the full candidate set, scores, propensities, vetoes, predicted transition, observed transition, and version. Fit simple ridge/logistic/boosted transition and reward baselines before a more elaborate learned controller.
- In `pedagogicalScripts.js`, make every script closed-loop: entry evidence, support level, expected uptake, fade condition, transfer of responsibility, independent-work test, and recovery path.
- In `scripts/tutor-stub-learner-profile-contracts.js`, remove discriminator target bands from generator-facing prompts where possible and validate against held-out human error/recovery distributions.
- Add a minimal typed learner memory with provenance, confidence, validity interval, supersession, contradictions, retrieval reason, and abstention. Test stale and conflicting memories before using it for policy control.
- Retain frozen-prefix replay, but use multiple independent resumed learners and label it diagnostic unless the transition function is harness-owned or externally validated.

## Evaluation ladder

1. **Deterministic correctness:** schemas, evidence provenance, guard behavior, exact formal outcomes, stale-memory and conflict tests.
2. **Predictive state validity:** held-out worlds, profiles, and models; state scrambling and feature ablation; lean-state comparison.
3. **Synthetic closed loop:** preregistered policy × profile × model tests with fixed horizons, independent success, assistance dependence, and simulator sensitivity.
4. **Authentic logs and co-pilot shadowing:** human judgments of state and action separately, acceptance/override, observed transition calibration.
5. **Learner study:** pretest, supported performance, immediate unassisted posttest, delayed retention, near/far transfer, agency, safety, and subgroup effects.

## Priority conclusion

Keep the explicit-state, guarded-policy, formal-evidence architecture. Resist richer ontology as a proxy for a better learner model, simulated fluency as learner validity, and register choice as the whole of adaptive pedagogy. The shortest credible path is: estimate a compact uncertain state, select a pedagogically meaningful or diagnostic action, predict its observable consequence, test it out of sample, fade support, and measure independent performance.

## Primary references

Key current sources include [ScaffoldLM](https://aclanthology.org/2026.acl-long.325/), [LongTutor](https://aclanthology.org/2026.acl-long.1371/), [Simulated Students: Substance or Illusion?](https://aclanthology.org/2026.acl-long.1960/), [Difficulty-aware dialogue knowledge tracing](https://aclanthology.org/2026.bea-1.43/), [TutorGym](https://arxiv.org/abs/2505.01563), [pedagogical steering with productive failure](https://aclanthology.org/2025.findings-acl.1348/), [stepwise verification](https://aclanthology.org/2024.emnlp-main.478/), [Tutor CoPilot](https://arxiv.org/abs/2410.03017), [adaptive scaffolding for cognitive engagement](https://arxiv.org/abs/2602.07308), [counterfactual evaluation of logged ITS policies](https://arxiv.org/abs/2606.23015), [Theory-of-Mind benchmark validity](https://arxiv.org/abs/2412.19726), and the [Harvard generative-AI tutor RCT](https://www.nature.com/articles/s41598-025-97652-6).
