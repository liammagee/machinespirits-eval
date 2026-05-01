# Frontier Resource Set for LLM-Tutoring Follow-up Research

A months-long curriculum for follow-up work on a 2×2 factorial LLM tutoring study (recognition × multi-agent ego-superego architecture) where adaptive responsiveness was found null. Resources are organized by the topic taxonomy you specified, then mapped to the six follow-up strategies. Heavy 2024–2026 emphasis; foundational classics included only where essential.

---

## How to use this list

Strategy → primary topic clusters:
- **S1 Counterfactual perturbation** → §6 (Counterfactual eval), §7 (Judge), §1 (KT for trajectory state)
- **S2 Externalized learner model / "diagnostician"** → §1 (KT), §5 (Agents), §9 (ToM), §2 (ITS foundations)
- **S3 Move-level dialogue analysis** → §3 (Dialogue acts), §8 (Datasets)
- **S4 Hold-out optimal-continuation / pair ranking** → §7 (Judge), §3 (Move taxonomies), §8 (Datasets)
- **S5 Scaffolding contingency / ZPD** → §4 (Scaffolding), §11 (Educational philosophy), §2 (ITS)
- **S6 Multi-session persistent memory tutoring** → §10 (Long-term memory), §5 (Agents)

Resources tagged with strategy numbers in brackets (e.g., **[S2, S5]**) where relevance is non-obvious.

---

## §1. Knowledge Tracing & Student Modeling (primary: S2; secondary: S1, S5)

The "diagnostician" agent in your follow-up is essentially a knowledge-tracing module wrapped in an LLM agent shell. The frontier here has shifted decisively toward LLM-native KT in 2024–2026.

### Foundational (sparse, for grounding)
- **Corbett & Anderson (1995), "Knowledge tracing: Modeling the acquisition of procedural knowledge."** — Original BKT formulation. Read once for vocabulary; everything else derives from it.
- **Piech et al. (2015), "Deep Knowledge Tracing."** — https://arxiv.org/abs/1506.05908. The DKT paper that started the deep-learning lineage.

### Core 2024–2026 LLM-KT papers (heavy emphasis)
- **Scarlatos & Lan (2024), "Exploring Knowledge Tracing in Tutor-Student Dialogues using LLMs."** — https://arxiv.org/pdf/2409.16490. *The* most directly relevant paper to your S2 — performs KT on open-ended dialogue turns rather than item responses, exactly the diagnostician's job.
- **Scarlatos, Lee, Liu, Baraniuk, Lan (2025), "Training LLM-based Tutors to Improve Student Learning Outcomes in Dialogues."** — https://arxiv.org/abs/2503.06424. Uses an LLM-based student model to score candidate tutor utterances and DPO-trains against it. Highly relevant to **[S1, S4]** (the student model literally generates "what-if" predictions).
- **Cen et al. (2025), "LLM-driven Effective Knowledge Tracing by Integrating Dual-channel Difficulty."** — https://arxiv.org/pdf/2502.19915. Lin lab work on LLM-KT.
- **CIKT — Collaborative Iterative Knowledge Tracing (2025).** — https://arxiv.org/pdf/2505.17705. Two-LLM framework: an *Analyst* generates structured student profiles, a *Predictor* forecasts performance; trained via Kahneman–Tversky Optimization. Architecturally analogous to your ego/superego split.
- **Next Token Knowledge Tracing (NTKT, 2025).** — https://arxiv.org/pdf/2511.02599. Reframes KT as next-token prediction on natural-language interaction histories. Directly applicable if the diagnostician maintains a textual learner state.
- **Language Bottleneck Models for Qualitative Knowledge State Modeling (2025).** — https://arxiv.org/pdf/2506.16982. Forces the learner state through a natural-language "bottleneck" — interpretable belief-state tracking; arguably the cleanest realization of an externalized learner model.
- **L-HAKT — LLM-Empowered Knowledge Tracing via Hierarchical Behavior Alignment in Hyperbolic Space (2026).** — https://arxiv.org/pdf/2602.22879. Hyperbolic embedding of KC trees; useful if you go hierarchical.
- **HACHIMI: Scalable and Controllable Student Persona Generation via Orchestrated Agents (2026).** — https://arxiv.org/pdf/2603.04855. Theory-aligned student persona generation with population-level distribution control. **[S1]** for trajectory bifurcation.
- **Towards Valid Student Simulation with Large Language Models (2026).** — https://arxiv.org/html/2601.05473. Validation framework for LLM-simulated students. Critical for S1 since your bifurcations depend on a believable student-model.
- **"Simulating Students with Large Language Models: A Review of Architecture" (2025).** — https://arxiv.org/pdf/2511.06078. Survey of architectures for LLM-based simulated students.
- **Can LLMs Simulate Personas with Reversed Performance? (2025).** — https://arxiv.org/html/2504.06460. LLMs systematically struggle to simulate low-performing students; vital caveat for S1 trajectory generation.
- **LLM Generated Persona is a Promise with a Catch (NeurIPS 2025 Position Paper).** — https://openreview.net/forum?id=qh9eGtMG4H. Methodological warnings about persona-based simulation.

### Survey & community
- **Shen et al. (2024), "A Survey of Knowledge Tracing: Models, Variants, and Applications."** — https://arxiv.org/html/2105.15106v4. Maintained survey covering BKT → DKT → DKVMN → SAKT → SAINT/SAINT+ → AKT → LLM-KT.
- **"Deep Learning Based Knowledge Tracing: A Review" (BDIE 2025).** — https://dl.acm.org/doi/10.1145/3729605.3729620. Particularly good on the LLM-KT category.

### Transformer-era KT (skim for the architectural vocabulary)
- **AKT — Context-Aware Attentive Knowledge Tracing (Ghosh, Heffernan, Lan 2020).** — https://arxiv.org/pdf/2007.12324. Monotonic attention + Rasch embeddings. Still the most cited modern baseline.
- **SAINT+ (Shin et al. 2020).** — https://arxiv.org/pdf/2010.12042. Transformer encoder–decoder on EdNet; SOTA for years.
- **ELAKT (TOIS 2024).** — https://dl.acm.org/doi/10.1145/3652601. Locality-enhanced attentive KT, 2024 update.
- **Domain-Knowledge-Informed Attention KT (2025).** — https://arxiv.org/html/2501.05605v1. XES3G5M benchmark with auxiliary information.

### Libraries
- **pyBKT** — https://github.com/CAHLR/pyBKT. Pardos lab's Python BKT library with EM fitting, cross-validation, common BKT extensions. Paper: https://arxiv.org/abs/2105.00385. Tutorial: https://ialt.education.ufl.edu/2024/05/06/an-introduction-to-bayesian-knowledge-tracing-with-pybkt/
- **EduData** — https://edudata.readthedocs.io/. CLI/Python package for KT benchmark datasets.
- **pyKT** — https://github.com/pykt-team/pykt-toolkit. Standard DKT/AKT/SAKT/SAINT implementations and benchmarks.

### Datasets / benchmarks
- **ASSISTments** — https://sites.google.com/site/assistmentsdata/. Heffernan lab. Several vintages (2009, 2012, 2015, 2017); the longest-running KT benchmark.
- **EdNet (Choi et al. 2019).** — https://arxiv.org/abs/1912.03072 / https://github.com/riiid/ednet. 131M interactions from Santa; the largest KT dataset.
- **XES3G5M (Liu et al. 2024)** — https://github.com/ai4ed/XES3G5M. Comprehensive KT benchmark with auxiliary side info.
- **PSLC DataShop** — https://pslcdatashop.web.cmu.edu/. CMU's repository of tutoring logs across many ITS deployments.
- **ES-KT-24** — https://arxiv.org/pdf/2409.10244. Multimodal KT with educational-game video + LLM-synthesized text.

### Talks/podcasts
- Andrew Lan's group regularly presents at **NeurIPS**, **EDM**, **L@S**, and **AIED**. Search "Andrew Lan knowledge tracing" on YouTube; the EDM keynotes from 2023–2024 are publicly streamed.
- **NeurIPS 2024 Workshop on Large Foundation Models for Educational Assessment** — https://neurips2024edu.github.io/. Recordings available; several talks directly on LLM-based KT and student modeling.
- **GAIED workshop series (NeurIPS 2023 → IJCAI 2024 tutorial → ongoing).** Survey paper: https://arxiv.org/abs/2402.01580. Tutorial: https://gaied.org/ijcai2024/.

---

## §2. Intelligent Tutoring Systems Foundations (primary: S5; secondary: S2, S3) — light coverage

These are the canonical references the LLM-tutoring community cites without re-reading. Do not get sucked in; pick three and move on.

- **VanLehn (2006), "The Behavior of Tutoring Systems."** — https://cs.uky.edu/~sgware/reading/papers/vanlehn2006behavior.pdf. The two-loop architecture (outer = task selection, inner = step-level interaction). The "domain model / student model / tutor model / interface" framing your S2 implicitly recovers.
- **VanLehn (2011), "The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems."** Educational Psychologist 46(4). The famous result: step-based ITS (d ≈ 0.76) ≈ human tutoring (d ≈ 0.79); answer-based ITS only d ≈ 0.31. Directly germane to S5 because VanLehn argues *step granularity*, not "responsiveness" in your sense, is what does the work — this is consonant with your null finding.
- **Bloom (1984), "The 2 Sigma Problem."** — Just be aware of the original framing.
- **Graesser, Lu, Jackson, Mitchell, Ventura, Olney, Louwerse (2004), "AutoTutor: A tutor with dialogue in natural language."** — Expectation-misconception tailoring. The original LLM-tutoring lineage. Recent recap: Nye, Graesser, Hu (2014), "AutoTutor and family: A review of 17 years."
- **Anderson, Corbett, Koedinger, Pelletier (1995), "Cognitive Tutors: Lessons Learned."** — Model tracing + knowledge tracing in the same system; the Carnegie Learning lineage.
- **Chi & Wylie (2014), "The ICAP framework: Linking cognitive engagement to active learning outcomes."** — Passive < Active < Constructive < Interactive. A cleaner alternative to "engagement" hand-waving when categorizing tutor moves in S3.

### 2024–2026 ITS-meets-LLM bridges (worth reading)
- **The Path to Conversational AI Tutors (Vanacore, Closser, Baker, Roschelle, 2026).** — https://arxiv.org/pdf/2602.19303. Maps classical ITS pedagogical primitives onto LLM tutoring; the cleanest bridge document I've seen.
- **A Theory of Adaptive Scaffolding for LLM-Based Pedagogical Agents (2025).** — https://arxiv.org/pdf/2508.01503. Synthesizes KLI, ZPD, and ECD with LLM-agent design. **[S5]** anchor paper.
- **AI2T: Building Trustable AI Tutors by Interactively Teaching a Self-Aware Learning Agent (Weitekamp, Harpstead, Koedinger 2024).** — https://arxiv.org/pdf/2411.17924. CMU lineage; modern Cognitive Tutor.
- **HTN-based Tutors (2024).** — Hierarchical Task Network expert models, adaptive scaffolding granularity. Worth skimming for S5 operationalization ideas.
- **Stamper, Xiao, Hou (2024), "Enhancing LLM-based Feedback: Insights from Intelligent Tutoring Systems and the Learning Sciences."** — In AIED 2024 proceedings.

---

## §3. Dialogue Act Classification & Pedagogical Move Taxonomies (primary: S3; secondary: S4)

This is the densest section because it is where your strategy 3 lives.

### Taxonomies & frameworks
- **Sinclair & Coulthard (1975), IRF/IRE.** — Just be aware of the I–R–E pattern as the baseline classroom-discourse unit.
- **Mercer (1995, 2008), "exploratory talk" / "cumulative talk" / "disputational talk."** — Foundational; Mercer & Howe (2012) "Explaining the dialogic processes of teaching and learning" is the cleanest summary.
- **Accountable Talk (Resnick, Michaels, O'Connor).** — The talk-move taxonomy underlying most modern math-discourse work.
- **Tutor Move Taxonomy (Zhou, Vanacore, Thompson, St John, Kizilcec, 2026).** — https://arxiv.org/pdf/2603.05778. *Most directly useful for S3*: a hybrid deductive-inductive taxonomy from the National Tutoring Observatory (Cornell), with four top-level categories and learning-support moves on a spectrum from elicit→explain. This is essentially the codebook you should adopt or adapt.

### LLM dialogue-act labeling (2024–2026, heavy emphasis)
- **Classifying Tutor Discursive Moves at Scale in Mathematics Classrooms with LLMs (Suresh et al., L@S 2024).** — https://mlciv.com/papers/talkmove-llm-2024.pdf. Direct demonstration that LLMs can do TalkMoves classification at scale.
- **BIPED: Bilingual Pedagogically-informed Tutoring Dataset (2024).** — https://arxiv.org/pdf/2406.03486. 34 tutor acts × 9 student acts; "select-act-then-generate" CITS design pattern relevant to **[S3, S2]**.
- **He & Xu (2024), "Automated Classification of Tutors' Dialogue Acts Using Generative AI: A Case Study Using the CIMA Corpus."** — https://arxiv.org/pdf/2509.09125. GPT-3.5/GPT-4 vs. manual coding on CIMA.
- **Thomas, Borchers, Lin, et al. (2025), "Leveraging LLMs to Assess Tutor Moves in Real-Life Dialogues: A Feasibility Study."** — https://arxiv.org/pdf/2506.17410. CMU + LEVI; benchmarks LLM accuracy at tutor-move classification on real audio transcripts.
- **Enhancing Talk Moves Analysis in Mathematics Tutoring through Classroom Teaching Discourse (2024).** — https://arxiv.org/html/2412.13395v1. Cross-corpus transfer between TalkMoves and NCTE-annotated tutoring sessions.
- **Unifying AI Tutor Evaluation: An Evaluation Taxonomy for Pedagogical Ability Assessment of LLM-Powered AI Tutors (Maurya, Petukhova, Kochmar, 2024 → NAACL 2025).** — https://arxiv.org/html/2412.09416v1. Eight-dimension pedagogical-ability rubric (Mistake Identification, Mistake Location, Guidance, Actionability, Coherence, Tutor Tone, Humanlikeness, Encouragement).

### Tooling
- **TalkMoves dataset & application.** — https://github.com/SumnerLab/TalkMoves; paper https://arxiv.org/abs/2204.09652. 567 K-12 math lesson transcripts annotated for ten discursive moves + Switchboard-DA labels.
- **ConvoKit (CMU).** — https://convokit.cornell.edu/. Conversational analysis library; useful even outside Reddit/forum data.

---

## §4. Scaffolding Theory & Contingency Measurement (primary: S5; secondary: S3)

### Foundational
- **Wood, Bruner, Ross (1976), "The role of tutoring in problem solving."** — *The* scaffolding paper. Operationalizes "contingent shift": increase control on student failure, decrease on success, hold on partial. This is exactly the protocol you need to instantiate computationally for S5.
- **Vygotsky (1978), Mind in Society.** — The ZPD chapters. Read these in primary for the discipline of being precise about what ZPD does and does not claim.
- **Van de Pol, Volman, Beishuizen (2010), "Scaffolding in Teacher–Student Interaction: A Decade of Research."** *Educational Psychology Review* 22, 271–296. — https://link.springer.com/article/10.1007/s10648-010-9127-6. *The* operationalization paper: contingency + fading + transfer of responsibility as the three measurable axes. Mandatory.
- **Van de Pol, Volman, Oort, Beishuizen (2015), "The effects of scaffolding in the classroom: support contingency and student independent working time..."** *Instructional Science* 43, 615–641. — https://link.springer.com/article/10.1007/s11251-015-9351-z. Empirical; introduces the *contingency × independent-working-time* interaction (relevant boundary condition for your null result on responsiveness).
- **Van de Pol et al. (2019), "Scaffolding Student Understanding in Small-Group Work" (uptake mediation).** — https://www.tandfonline.com/doi/full/10.1080/10508406.2018.1522258. Shows that uptake, not contingency itself, mediates achievement — *this is the methodological template for S5*.

### 2024–2026 LLM-scaffolding operationalization
- **A Theory of Adaptive Scaffolding for LLM-Based Pedagogical Agents (2025).** — https://arxiv.org/html/2508.01503v1. Already listed in §2; this is the most explicit operationalization-of-Vygotsky-in-LLM paper currently on arXiv.
- **Figueiredo (2025), "Fuzzy, Symbolic, and Contextual: Enhancing LLM Instruction via Cognitive Scaffolding."** — https://arxiv.org/pdf/2508.21204. Three-layer prompt-level scaffold with short-term schema; explicitly Vygotskian.
- **"A Fuzzy Logic Prompting Framework for Large Language Models in Adaptive and Uncertain Tasks" (2025).** — https://arxiv.org/html/2508.06754. Boundary-prompt + control-schema design pattern.
- **"arXiv:2506.19484 — LLMs and Vygotsky" (2025).** — https://arxiv.org/pdf/2506.19484. Maps LLM behaviors onto Vygotskian theory point-by-point. Useful for the discussion section of your follow-up.
- **EducationQ (Shi, Liang, Xu 2025).** — Triadic teacher-student-evaluator framework simulating instruction within ZPD principles.

---

## §5. LLM Agent Architectures & Multi-Agent Systems (primary: S2; secondary: S6)

### Agent-architecture canon (2023, but central)
- **Yao et al. (2023), "ReAct: Synergizing Reasoning and Acting in Language Models."** — https://arxiv.org/abs/2210.03629. The canonical reason-act loop.
- **Shinn et al. (2023), "Reflexion: Language Agents with Verbal Reinforcement Learning."** — https://arxiv.org/abs/2303.11366. Verbal self-feedback; relevant to a critic/diagnostician role.
- **Wang et al. (2023), "Voyager: An Open-Ended Embodied Agent with LLMs."** — https://arxiv.org/abs/2305.16291. Skill-library + automatic curriculum; conceptually relevant for S6 (skills accumulating across sessions).
- **Park et al. (2023), "Generative Agents: Interactive Simulacra of Human Behavior."** — https://arxiv.org/abs/2304.03442 / https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763. Observation-reflection-planning memory architecture; the persistent-memory paradigm for S6.

### Multi-agent orchestration libraries (current state, 2024–2026)
- **LangGraph (LangChain)** — https://www.langchain.com/langgraph. The de facto graph-based orchestration framework with built-in checkpointing/state persistence; *the* tool for the multi-agent ego/superego/diagnostician architecture. Reached v1.0 in late 2024. Tutorial walkthrough: https://blog.futuresmart.ai/multi-agent-system-with-langgraph
- **LangChain blog, "How and when to build multi-agent systems"** — https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/. Required reading; sober treatment of context-engineering trade-offs (Anthropic vs. Cognition philosophies).
- **AutoGen (Microsoft, now AG2 v0.4).** — Conversational/GroupChat orchestration; better for offline quality-sensitive workflows than for low-latency tutoring. https://microsoft.github.io/autogen/
- **CrewAI** — https://www.crewai.com/. Role-based, lower-ceremony; good for prototyping the diagnostician/ego/superego split.
- **Comparison reads:** "Best Multi-Agent Frameworks in 2026" — https://gurusup.com/blog/best-multi-agent-frameworks-2026. DataCamp framework comparison: https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen
- **OpenAI Agents SDK (March 2025)** — handoff abstraction with context variables.
- **Anthropic Claude Agent SDK** — sub-agent + MCP tool-use chain; relevant given your Claude-heavy stack.

### Surveys & tutorials
- **"Agentic AI: Architectures, Taxonomies, and Evaluation of LLM Agents" (2026).** — https://arxiv.org/html/2601.12560v1.
- **"AI Agent Systems: Architectures, Applications, and Evaluation" (2026).** — https://arxiv.org/html/2601.01743v1.

### Educational multi-agent specifically
- **Lee et al. (2023), "Generative Agent for Teacher Training" (NeurIPS GAIED workshop).** Pre-service teacher simulations.
- **Markel et al. (2023), "GPTeach: Interactive TA Training with GPT-based Students" (L@S 2023).** Simulated students for tutor training.
- **Schmucker et al. (2023), "Ruffle&Riley: Towards the Automated Induction of Conversational Tutoring Systems."** Multi-agent ITS induction.

---

## §6. Counterfactual Evaluation of Dialogue Systems (primary: S1)

The thinnest-but-most-relevant section to S1. There is no off-the-shelf "branching simulation for tutoring" methodology; you will be on the frontier here.

### Causal/counterfactual reasoning in NLP
- **Feder et al. (2022), "Causal Inference in Natural Language Processing: Estimation, Prediction, Interpretation, and Beyond."** TACL. Best survey of the methodological space.
- **Jin et al. (2023), "CausalCoT" / "Cladder."** — Prompt-level CoT for causal queries; relevant when bifurcating learner trajectories.

### 2024–2026 LLM counterfactual reasoning
- **CounterBench (Tang et al. 2025).** — https://arxiv.org/pdf/2502.11008. Benchmark for counterfactual reasoning in LLMs; introduces the "CoIn" paradigm.
- **"Causal What-Ifs: Rethinking Counterfactuals with LLM Agents" (Springer 2025).** — https://link.springer.com/chapter/10.1007/978-981-95-4367-0_13. Two-stage prompt-optimization framework for plausible, causally-consistent CFs.
- **"Towards Unifying Evaluation of Counterfactual Explanations: Leveraging LLMs for Human-Centric Assessments" (2024).** — https://arxiv.org/pdf/2410.21131. LLM as benchmarker of CF explanations.
- **AXIS (2025), "Integrating Counterfactual Simulations with Language Models for Explaining Multi-Agent Behaviour."** — https://arxiv.org/html/2505.17801. Closest existing work to your bifurcation idea, in the multi-agent-RL setting.

### Branching simulation methodology (related rather than direct)
- **Backtracing (Wang, Wirawarn, Khattab, Goodman, Demszky, EACL Findings 2024).** — https://arxiv.org/abs/2403.03956. "Retrieve the cause of the query": given a student turn, find the antecedent tutor turn that produced the misconception. Methodologically adjacent to bifurcation.
- **Tutor CoPilot (Wang, Ribeiro, Robinson, Loeb, Demszky 2024).** — https://arxiv.org/abs/2410.03017. Real-time AI suggestions to live human tutors; the deployment study includes natural counterfactual variation.

### Pair-ranking (overlap with §7)
- See §7 for LLM-as-judge bias/reliability — pair ranking is the dominant operationalization of CF evaluation.

---

## §7. LLM-as-Judge & Pairwise Evaluation (primary: S4; secondary: S1)

### Foundational
- **Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena."** — https://arxiv.org/abs/2306.05685. Required reading; introduces pairwise vs. single-answer protocols and quantifies position/verbosity biases.
- **LMSYS Chatbot Arena (Chiang et al., 2024).** — https://arxiv.org/abs/2403.04132. Crowd-sourced pairwise preference ranking infrastructure.

### 2024–2026 bias and reliability work (heavy emphasis)
- **Shi et al. (2024–25), "Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge."** — https://arxiv.org/abs/2406.07791. Three metrics: repetition stability, position consistency, preference fairness; 150K eval instances. *Critical for S4 design.*
- **"The Comparative Trap: Pairwise Comparisons Amplifies Biased Preferences of LLM Evaluators" (2024).** — https://arxiv.org/pdf/2406.12319. Counterargument to default pairwise; pairwise *amplifies* known biases on adversarial examples.
- **"Aligning with Human Judgement: The Role of Pairwise Preference in LLM Evaluators" (2024).** — https://arxiv.org/pdf/2403.16950.
- **"Who can we trust? LLM-as-a-jury for Comparative Assessment" (2026).** — https://arxiv.org/pdf/2602.16610. Multi-judge jury with reliability weighting; recommended pattern for S4 if budget allows.
- **UDA — Unsupervised Debiasing Alignment for Pair-wise LLM-as-a-Judge (2025).** — https://arxiv.org/pdf/2508.09724. Dynamic recalibration via judge consensus; a usable methodology for your S4 robustness section.
- **"The Silent Judge: Unacknowledged Shortcut Bias in LLM-as-a-Judge" (NeurIPS 2025 workshop).** — https://arxiv.org/pdf/2509.26072. Recency and provenance bias (EXPERT > HUMAN > LLM > UNKNOWN). Vital — your hold-out optimal-continuation pairs in S4 must avoid these shortcut features.
- **FairJudge: An Adaptive, Debiased, and Consistent LLM-as-a-Judge (2026).** — https://arxiv.org/pdf/2602.06625. Pointwise–pairwise inconsistency analysis.

### Evaluation harnesses & benchmarks
- **AlpacaEval 2.0 (Length-Controlled).** — https://github.com/tatsu-lab/alpaca_eval. Length-debiased pairwise eval against a reference model.
- **Arena-Hard / Arena-Hard-Auto (LMSYS, 2024).** — https://www.lmsys.org/blog/2024-04-19-arena-hard/. Hard-prompt distillation pipeline; 87.4% separability vs. MT-Bench. Strong template for S4.
- **RewardBench.** — Standard pairwise reward-model eval.
- **BEA 2025 Shared Task on Pedagogical Ability Assessment of AI-powered Tutors.** — https://sig-edu.org/sharedtask/2025. Findings paper https://arxiv.org/html/2507.10579v1. *MRBench* benchmark dataset built on MathDial+Bridge; eight pedagogical dimensions. *The* domain-specific judge benchmark — required for S4.
- **MathTutorBench (Macina, Daheim, Hakimi, Kapur, Gurevych, Sachan 2025).** — https://arxiv.org/abs/2502.18940. Pairwise expert-vs.-novice teacher response judgment; reward-model-based scoring. https://eth-lre.github.io/mathtutorbench/. **This is essentially S4 already done at corpus scale; build on it.**
- **MMTutorBench (2025).** — https://arxiv.org/pdf/2510.23477. Multimodal extension; relevant only if you go visual.

### Inspect AI (UK AISI) — your evaluation harness of choice
- **Inspect AI** — https://inspect.aisi.org.uk/. Production-grade LLM eval framework; 200+ pre-built evals, multi-provider model layer, sandboxing, model-graded scoring. Tutorial: https://inspect.aisi.org.uk/tutorial.html. Multi-agent docs: https://inspect.aisi.org.uk/agents-multi.html.
- **Inspect Evals (community evals)** — https://ukgovernmentbeis.github.io/inspect_evals/.
- **PyPI install** — `pip install inspect-ai`. Walkthrough article: https://schmatz.github.io/deception-eval-with-inspect/. *Recommended primary harness given your stack.*

### Other evaluation frameworks
- **DeepEval** — https://github.com/confident-ai/deepeval. Pytest-style LLM unit testing; G-Eval, hallucination, RAG metrics.
- **Promptfoo** — https://www.promptfoo.dev/. YAML-driven; lighter, JS-ecosystem; use for prompt regression in CI.
- **Ragas** — https://github.com/explodinggradients/ragas. Reference-free RAG/dialogue eval if you go retrieval-augmented.
- **LangSmith** vs **Langfuse**: LangSmith for LangChain-native managed observability; Langfuse for open-source, framework-agnostic, OpenTelemetry-style tracing with self-hosting. Comparison: https://www.zenml.io/blog/langfuse-vs-langsmith. *Given your multi-provider stack and academic publication needs, Langfuse self-hosted is the recommended default for trace logging in this work.*

---

## §8. Educational Dialogue Datasets and Benchmarks (primary: S3, S4)

### Tutoring corpora
- **MathDial (Macina, Daheim, Chowdhury, Sinha, Kapur, Gurevych, Sachan, Findings of EMNLP 2023).** — https://github.com/eth-nlped/mathdial. 2.9K math tutoring conversations between human teachers and simulated students; the de facto S3/S4 benchmark for dialog tutoring. Data: https://huggingface.co/datasets/eth-nlped/mathdial.
- **Bridge (Wang, Zhang, Robinson, Loeb, Demszky, NAACL 2024).** — https://huggingface.co/datasets/rose-e-wang/bridge. 700 real online tutoring conversations annotated by experts with (error, strategy, intention) decisions. Code: https://github.com/rosewang2008/bridge.
- **MathDialBridge** (combined; introduced in MathTutorBench, 2025) — see §7.
- **CIMA (Stasaski, Kao, Hearst, BEA 2020).** — Conversational Instructional Math/Italian dataset; widely used for dialogue-act labeling.
- **TSCC — Teacher-Student Chatroom Corpus (Caines et al. 2020, 2022).** — http://www.cl.cam.ac.uk/~apc38/tscc.html. Authentic ESL one-on-one chat tutoring, dialogue-act-annotated.
- **NCTE Transcripts (Demszky & Hill 2023).** — Harvard CEPR's 1,660 elementary-math lesson recordings. Multi-persona, less suited for S3 but useful for §3 taxonomy validation.
- **TalkMoves dataset** — see §3.

### Frontier 2024–2026 educational datasets
- **MRBench (BEA 2025 Shared Task)** — see §7.
- **MathTutorBench corpus (Macina et al. 2025)** — see §7.
- **TutorChat (Chevalier et al., 2024).** — 80K synthetic teacher-student conversations grounded in textbooks.
- **SocraticLM training corpus (Liu et al., NeurIPS 2024).** — 35K math tutoring dialogues, multi-agent generated.
- **HACHIMI / Book2Dial** for synthetic learner dialog generation — see §1.
- **EduDial** and other 2025 corpora are surveyed in: https://arxiv.org/html/2507.22753v1 ("Opportunities and Challenges of LLMs in Education: An NLP Perspective").

### Surveys
- **Macina, Daheim, Wang, Sinha, Kapur, Gurevych, Sachan (2023), "Opportunities and Challenges in Neural Dialog Tutoring."** *EACL.* — https://aclanthology.org/2023.eacl-main.173/. The before-the-deluge survey; still the cleanest framing of where dialog tutoring is hard.
- **"Opportunities and Challenges of LLMs in Education: An NLP Perspective" (2025).** — https://arxiv.org/html/2507.22753v1.

---

## §9. Theory of Mind & Learner Modeling in LLMs (primary: S2; secondary: S5)

### Benchmarks (canonical → frontier)
- **ToMi (Le, Boureau, Nickel 2019).** — Original false-belief benchmark.
- **BigToM (Gandhi, Fränken, Gerstenberg, Goodman, NeurIPS 2023).** — https://arxiv.org/abs/2306.15448. Causal-template ToM benchmark.
- **FANToM (Kim et al., EMNLP 2023).** — https://hyunw.kim/fantom/ / https://arxiv.org/abs/2310.15421. Information-asymmetric conversational ToM. *Most relevant for S2 since tutoring is fundamentally information-asymmetric dialogue.*
- **OpenToM (Xu et al., 2024).** — https://arxiv.org/abs/2402.06044. Personality- and intention-grounded ToM with both physical and psychological mental states.
- **ToMBench (Chen et al., 2024).** — https://arxiv.org/abs/2402.15052. Holistic ToM eval addressing scope/subjectivity issues.
- **ExploreToM (Sclar et al., Meta 2024).** — https://arxiv.org/abs/2412.12175 / https://github.com/facebookresearch/exploretom. A* search over a domain-specific language to generate adversarial false-belief stories. SOTA LLMs at 0–9% on hard slice. *The single most informative ToM benchmark for diagnostician-agent design — directly stress-tests state tracking.*
- **HiToM (Wu et al., 2023).** — Higher-order false-belief reasoning.
- **Strachan et al. (2024), "Testing theory of mind in large language models and humans."** — *Nature Human Behaviour.*
- **Kosinski (2024), "Evaluating large language models in theory of mind tasks."** PNAS — https://www.pnas.org/doi/10.1073/pnas.2405460121. Forty bespoke false-belief tasks across eleven LLMs.
- **Ullman (2023), "Large language models fail on trivial alterations to theory-of-mind tasks."** — https://arxiv.org/abs/2302.08399. Mandatory caveat.

### 2025 LLM-ToM training/limitations
- **"Small LLMs Do Not Learn a Generalizable Theory of Mind via Reinforcement Learning" (2025).** — https://arxiv.org/html/2507.15788. RLVR on ToM data fails to generalize. Methodologically informative for S2 — your diagnostician should not rely on small fine-tuned ToM modules.

### Simulated learners
- See §1 (HACHIMI; "Towards Valid Student Simulation"; "Simulating Students with LLMs: A Review"; "Can LLMs Simulate Personas with Reversed Performance?").

---

## §10. Multi-session Conversational AI / Long-term Memory (primary: S6)

### Core architectures
- **MemGPT (Packer et al., Berkeley Sky Lab, 2023).** — https://arxiv.org/abs/2310.08560 / https://research.memgpt.ai/. OS-inspired hierarchical memory with self-managed paging; the foundation for Letta.
- **Letta (formerly MemGPT)** — https://letta.com/ / https://github.com/letta-ai/letta. Stateful-agent platform; programmatic context management, "Skill Learning," sleep-time compute. Recent Letta blog posts on "Agent Memory" (https://www.letta.com/blog/agent-memory) and "Benchmarking AI Agent Memory" (https://www.letta.com/blog/benchmarking-ai-agent-memory) are *required reading* for S6 — particularly the LoCoMo benchmark discussion and the "filesystem may be all you need" thesis.
- **Mem0** — https://mem0.ai/. User/session/agent hierarchy; vector + optional graph store; "memory in three lines of code" but with limitations Letta's authors highlight.
- **Zep / Graphiti** — https://www.getzep.com/. Temporal knowledge graph for agent memory.
- **Awesome-Memory-for-Agents** (curated paper list) — https://github.com/TsinghuaC3I/Awesome-Memory-for-Agents. Maintained survey of episodic/long-term memory papers.

### Spaced repetition (computational)
- **Tabibian et al. (2019), "Enhancing human learning via spaced repetition optimization."** *PNAS.* — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6410796/. Marked-temporal-point-process / SDE framework; principled CS computational treatment.
- **FSRS — Free Spaced Repetition Scheduler.** — https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler. DSR (difficulty/stability/retrievability) model; 20–30% fewer reviews than SM-2 at equal retention. Now bundled with Anki, RemNote, etc.
- **LECTOR (2025), "LLM-Enhanced Concept-based Test-Oriented Repetition for Adaptive Spaced Learning."** — https://arxiv.org/abs/2508.03275. LLM-powered semantic-similarity layer over FSRS/SSP-MMC.
- **Andy Matuschak's body of work.** https://andymatuschak.org/. Particularly "How to write good prompts" and his Quantum Country experiments. Relevant to S6 because he is one of the few people building serious memory-system infrastructure outside the academic loop. (Mentioned by Dwarkesh Patel, see Talks below.)

### Generative agents and persistent memory in education
- See Park et al. 2023 in §5 — observation/planning/reflection memory triad is the design template.

### 2025–2026 frontier
- **"Forgetful but Faithful: A Cognitive Memory Architecture for Privacy-Aware Generative Agents" (2025).** — https://arxiv.org/html/2512.12856v1.
- **"Memory in the Age of AI Agents" (Dec 2025 survey).** — A December 2025 large-scale taxonomic survey on three-axis (form/function/dynamics) memory categorization (referenced in https://arxiv.org/html/2603.04740v1).
- **Sleep-time Compute / Continual Learning in Token Space** (Letta research notes, 2025-26).
- **DeepLearning.AI × Letta course on agent memory** — Available via DeepLearning.AI; short, hands-on.

---

## §11. Educational Philosophy / Critical Theory (light)

Use these only to ground the "recognition" arm of your factorial in something defensible. Recognition is a precise term in this literature; do not let reviewers force you into hand-waving.

- **Honneth, A. (1995), *The Struggle for Recognition: The Moral Grammar of Social Conflicts.*** — The three spheres: love, respect, social esteem.
- **Hegel, *Phenomenology of Spirit*, master–slave dialectic.** — Original source for recognition; Robert Pippin's commentaries are the most useful secondary literature.
- **Stanford Encyclopedia of Philosophy, "Recognition."** — https://plato.stanford.edu/entries/recognition/. Best entry-point.
- **Stojanov (2018), "Education, self-consciousness and social action: Bildung as a neo-Hegelian concept."** Routledge — applies recognition to pedagogy.
- **Huttunen & Heikkinen (2004), "Teaching and the dialectic of recognition."** *Pedagogy, Culture & Society.* Direct application of Honneth to teacher–student relations.
- **Fleming (2011), "Recognition in the work of Axel Honneth: Implications for transformative learning theory."** — https://www.researchgate.net/publication/286459555. Transformative-learning-theory bridge.
- **Wilson & Spahn (2022), "The Struggle for AI's Recognition."** *Philosophy & Technology* — https://philarchive.org/archive/WIETSF. Honneth+Taylor applied to AI ethics specifically; the closest thing to a citation for what your recognition arm operationalizes.
- **Gertz (2018), "Hegel, the struggle for recognition, and robots."** — Niche but relevant.
- **Vygotsky in computational contexts:** Cole & Engeström-style cultural-historical activity theory; for an LLM-era treatment, see https://arxiv.org/pdf/2506.19484 (already in §4).

---

## §12. Practical Tooling for the Research Apparatus

### Multi-provider LLM access
- **LiteLLM** — https://github.com/BerriAI/litellm / https://docs.litellm.ai/. Unified OpenAI-format interface to 100+ providers (Anthropic, DeepSeek, Gemini, OpenRouter all native). *Recommended primary client* given your provider mix. Supports Anthropic prompt caching natively, including cache_control on system messages and 1-hour TTLs.
- **OpenRouter** — https://openrouter.ai/. Cloud aggregator; useful as a single billing endpoint and for accessing models you don't have direct API access to.
- **TrueFoundry / Helicone** — Enterprise gateways; probably overkill for a single research lab.

### Anthropic Claude best practices (Sonnet 4.6 / Haiku 4.5)
- **Prompt caching docs** — https://platform.claude.com/docs/en/build-with-claude/prompt-caching. Five-minute default TTL, 1-hour extended TTL; 5-min cache writes are 1.25× input price, 1-hour 2×; reads are 0.1× input price. *Cache the system prompt + tutoring rubric + persona description; with a 1h TTL this dominates your S4 cost.*
- **Batch processing** — https://platform.claude.com/docs/en/build-with-claude/batch-processing. 50% discount; stacks with prompt caching. Ideal for S1 (large counterfactual sweeps) and S4 (large pairwise comparisons) — the 1-hour cache + batch combination is the recommended pattern.
- Practical guides: https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models, https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/.

### Trace logging and observability
- **Langfuse** (recommended) — https://langfuse.com/. Open-source, self-hostable, OpenTelemetry-style tracing. Framework-agnostic; works equally with LiteLLM, raw HTTP, LangChain, CrewAI. Comparison: https://markaicode.com/vs/langfuse-vs-langsmith/. Tutorial: https://huggingface.co/blog/daya-shankar/langfuse-vs-langsmith-vs-langchain-comparison.
- **LangSmith** — https://smith.langchain.com/. Use only if going LangChain/LangGraph-native.

### Evaluation harnesses
- **Inspect AI (UK AISI)** — see §7. *Recommended primary.*
- **DeepEval, Promptfoo, Ragas** — see §7.

### Statistics for reliability / rater agreement
- **`krippendorff` (PyPI).** — Multiple implementations exist; the original Thomas Grill implementation (https://grrrr.org/2011/05/31/krippendorff_alpha-python/) is correct and widely validated; the NLTK implementation has known issues (https://github.com/raoulbia/nltk-krippendorff-validation). Aleph Alpha's modernized version: https://github.com/Aleph-Alpha/krippendorff-aleph-alpha. K-Alpha web calculator (for sanity-checking): https://www.k-alpha.org/. Methods paper: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11636850/.
- **`pingouin`** — https://pingouin-stats.org/. ICC (single-rater, average-rater, fixed/random), Cohen's/Fleiss's kappa, intra-class correlations. Drop-in replacement for SPSS reliability functions.
- **`statsmodels`** — for mixed-effects models if you go hierarchical (turn-within-conversation-within-condition).
- **`marginaleffects` (R, with Python via rpy2)** — best-in-class average-marginal-effect computation; use for the reporting tables.

### Pre-registration
- **OSF Registries** — https://osf.io/registries. The standard. Use the AsPredicted template for the simpler factorial designs; the OSF Standard or PRP-QUANT template for anything involving mediation/multi-level structure (S5, S3).
- **AsPredicted** — https://aspredicted.org/. Faster, lighter; fine for S1, S4.

### LLM eval / pre-registration in education specifically
- See BEA shared task series (§7) — the protocols there are de facto pre-registered.

---

## §13. Talks, podcasts, lecture series

Listed in priority order for this researcher.

### Education-AI specific
- **Stanford EduNLP Lab (Demszky)** — https://edunlp.stanford.edu/. Tutor CoPilot, Backtracing, M-Powering Teachers. Several recorded talks at Stanford GSE and HAI events on YouTube.
- **Dora Demszky GSE "School's In" podcast appearance** — https://ed.stanford.edu/news/chatting-about-chatbots-how-ai-tools-can-support-teachers. Specifically on AI-driven tutor/teacher feedback.
- **Stanford Accelerator for Learning panels** — https://acceleratelearning.stanford.edu/. The 2024 "AI will transform teaching and learning. Let's get it right." event recording features Demszky, Goodman, Khan, Liu in conversation.
- **ETH LRE Lab (Sachan, Macina)** — https://lre.inf.ethz.ch/. Talk recordings from EACL 2023 (neural dialog tutoring) and EMNLP 2025 (MathTutorBench) are on YouTube.
- **NeurIPS GAIED workshops (2023, 2024, 2025).** Recordings on the workshop site (https://gaied.org/) and NeurIPS virtual.
- **NeurIPS 2024 Workshop on Large Foundation Models for Educational Assessment** — https://neurips2024edu.github.io/.
- **L@S 2024, AIED 2024–25, EDM 2024–25** keynotes — most are on YouTube within a month of the conference.
- **BEA Shared Task workshops (2023, 2025)** — https://sig-edu.org/. Findings papers + recorded talks.

### General-AI podcasts with frontier substance
- **Latent Space (swyx & Alessio)** — https://www.latent.space/. The episodes with Karpathy, Anthropic researchers (Trenton Bricken, Sholto Douglas), and the recurring "AI Engineer" reading-list episodes are most relevant. Generally orthogonal to education but excellent for staying current on agent infrastructure.
- **Machine Learning Street Talk (Tim Scarfe et al.)** — https://www.youtube.com/c/MachineLearningStreetTalk. Long-form, theory-heavy; episodes on memory, agency, and theory-of-mind in LLMs are directly relevant to S2/S6.
- **Dwarkesh Podcast** — https://www.dwarkesh.com/podcast. Particularly: the Karpathy interview (October 2025) for grounding on capabilities, the Andy Matuschak appearance for spaced repetition / Socratic-tutoring-with-LLMs methodology (https://every.to/podcast/dwarkesh-patel-s-quest-to-learn-everything is the inversion — Dwarkesh as guest discussing his use of LLMs as Socratic tutors; *required listening* for S6 design intuitions). Also worthwhile: the Demis Hassabis / Sholto Douglas / Trenton Bricken episodes for capability context.

### University lecture series (skim, do not binge)
- **Stanford CS25 ("Transformers United")** — https://web.stanford.edu/class/cs25/. Particularly the agent-architecture lectures.
- **Berkeley CS294 / CS194 Agentic LLM courses (2024-25)** — Sergey Levine and others; recordings on YouTube.
- **CMU Andrew Lan / Carolyn Rosé seminars on educational dialogue** — periodically on the LTI YouTube channel.
- **Karpathy's "Building GPT-2 from scratch"** — Already foundational; not directly relevant unless you decide to fine-tune your own KT model.

---

## Suggested reading order (3-month curriculum)

**Month 1 — anchor the methodology and field:**
1. Macina et al. (2023) "Opportunities and Challenges in Neural Dialog Tutoring" (§8) — re-read.
2. VanLehn (2011) two-sigma paper (§2) — for the prior literature your null result lives inside.
3. Wood, Bruner, Ross (1976) + Van de Pol et al. (2010, 2015) (§4) — the contingency operationalization triad. Read the 2010 review with a pen.
4. Zheng et al. (2023) "Judging LLM-as-a-Judge" + Shi et al. "Judging the Judges" (§7) — judge-bias baseline.
5. Scarlatos & Lan (2024) "Exploring KT in Tutor-Student Dialogues" (§1) + Scarlatos et al. (2025) "Training LLM-based Tutors" (§1) — the directly adjacent prior work to S2/S1.
6. Wang et al. (2024) Bridge + Macina et al. (2023) MathDial + Macina et al. (2025) MathTutorBench (§7, §8) — get all three datasets locally and reproduce one baseline.

**Month 2 — strategy-specific deep dives:**
- **For S2/S1:** Park et al. Generative Agents; Letta agent-memory blogs; ExploreToM (§9); HACHIMI student simulation (§1); CIKT (§1) for the Analyst/Predictor pattern.
- **For S3:** Tutor Move Taxonomy (Zhou et al. 2026); BIPED; TalkMoves dataset; Maurya et al. Unifying AI Tutor Evaluation taxonomy.
- **For S5:** Adaptive Scaffolding Theory paper (Kim et al. 2025); Van de Pol et al. uptake-mediation paper; Tutor CoPilot evaluation (Wang et al. 2024).
- **For S4:** Arena-Hard pipeline; AlpacaEval LC; UDA debiasing; FairJudge.
- **For S6:** MemGPT paper; Letta blogs; Tabibian et al. PNAS spaced-repetition paper; the December 2025 "Memory in the Age of AI Agents" survey.

**Month 3 — implementation and writing:**
- Stand up the eval apparatus on Inspect AI + Langfuse + LiteLLM with prompt caching + batching.
- Pre-register on OSF.
- Run pilot of one strategy (recommend S4 first — lowest engineering load, biggest payoff).
- Watch one ML Street Talk and one Latent Space episode per week to keep current.

---

## Single-link distillation if you read only ten things

1. Macina et al. (2023), "Opportunities and Challenges in Neural Dialog Tutoring" — https://aclanthology.org/2023.eacl-main.173/
2. Macina et al. (2025), MathTutorBench — https://arxiv.org/abs/2502.18940
3. Scarlatos & Lan (2024), KT in Tutor-Student Dialogues — https://arxiv.org/pdf/2409.16490
4. Van de Pol, Volman, Beishuizen (2010), Scaffolding decade review — https://link.springer.com/article/10.1007/s10648-010-9127-6
5. Zhou et al. (2026), Tutor Move Taxonomy — https://arxiv.org/pdf/2603.05778
6. Sclar et al. (2024), ExploreToM — https://arxiv.org/abs/2412.12175
7. Shi et al. (2024), Judging the Judges — https://arxiv.org/abs/2406.07791
8. Park et al. (2023), Generative Agents — https://arxiv.org/abs/2304.03442
9. Letta blog, "Agent Memory" — https://www.letta.com/blog/agent-memory
10. Inspect AI documentation — https://inspect.aisi.org.uk/

---

## Caveats and things this list does not cover well

- **Recognition theory in AI** is genuinely thin. Wilson & Spahn (2022) is the only serious published treatment; you may need to do philosophical work yourself.
- **Counterfactual evaluation of dialogue tutors specifically** has no off-the-shelf framework. AXIS (2025) is the closest analog but is in multi-agent RL. Strategy 1 will require you to develop methodology.
- **"Operationalizing ZPD computationally"** — the 2025 papers I've cited (Adaptive Scaffolding Theory; Figueiredo's fuzzy-logic frameworks) are largely position papers without strong empirical validation. The empirical foundation is still Van de Pol's social-studies-classroom data.
- The LLM-tutoring literature has a strong recency bias and a reproducibility problem; many 2024–2025 arXiv preprints will not survive review. Treat anything not yet at a venue (BEA, EDM, EMNLP, NAACL, AIED, L@S, NeurIPS) with appropriate skepticism.
- **Anthropic Claude Sonnet 4.6 / Haiku 4.5 specifically** — model names on this list are in flux; verify on https://docs.claude.com/ at experiment time. The prompt-caching and batching APIs are stable; specific model snapshots are not.
- **Speculative content flagged:** several of the 2026-dated papers I've cited (e.g., the Tutor Move Taxonomy paper at arXiv:2603.05778; "Path to Conversational AI Tutors" at arXiv:2602.19303; HACHIMI at arXiv:2603.04855) are arXiv preprints with future-looking IDs; their venue acceptance status is unverified at time of writing.

This list will keep you grounded across all six strategies while pointing at the live frontier; come back to it in three months and prune ruthlessly.