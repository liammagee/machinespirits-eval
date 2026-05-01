# Research Literature Index

Comprehensive index of all resources from `docs/explorations/claude/research-resources.md`,
organized by section. Each entry shows the source bullet plus all its links, with a
local path for any arXiv paper that the download script will fetch.

## How this folder is organized

- `INDEX.md` — this file, every URL grouped by section.
- `download_pdfs.sh` — portable script. Run on a machine with internet access to arxiv.org
  (the cowork sandbox blocks it). Downloads ~68 PDFs into `pdfs/<section>/`. Re-run-safe.
- `arxiv_manifest.json` — machine-readable manifest of every arXiv paper found in the source.
- `download_plan.json` — full download plan with target filenames.
- `pdfs/` — populated by `download_pdfs.sh`.

## Quick start

```bash
cd docs/research/literature
bash download_pdfs.sh   # ~150 MB total, polite 0.5s between requests
```

**Caveat from the source file:** several papers dated 2026 (arXiv IDs 2601.\*, 2602.\*, 2603.\*)
were flagged as speculative future-looking IDs by the resource compiler. As of April 2026 they
may now exist; failures are logged by the script but do not abort it.

---

## §1. Knowledge Tracing & Student Modeling

PDFs in this section: `pdfs/01-knowledge-tracing/`

### Foundational (sparse, for grounding)

- **Piech et al. (2015), "Deep Knowledge Tracing."** — https://arxiv.org/abs/1506.05908. The DKT paper that started the deep-learning lineage.
  - [arXiv 1506.05908](https://arxiv.org/abs/1506.05908) → `pdfs/01-knowledge-tracing/1506.05908_deep-knowledge-tracing.pdf`

### Core 2024–2026 LLM-KT papers (heavy emphasis)

- **Scarlatos & Lan (2024), "Exploring Knowledge Tracing in Tutor-Student Dialogues using LLMs."** — https://arxiv.org/pdf/2409.16490. *The* most directly relevant paper to your S2 — performs KT on open-ended dialogue turns rather than item responses, exactly the diagnostician's job.
  - [arXiv 2409.16490](https://arxiv.org/pdf/2409.16490) → `pdfs/01-knowledge-tracing/2409.16490_exploring-knowledge-tracing-in-tutor-student-dialogues-using-llms.pdf`

- **Scarlatos, Lee, Liu, Baraniuk, Lan (2025), "Training LLM-based Tutors to Improve Student Learning Outcomes in Dialogues."** — https://arxiv.org/abs/2503.06424. Uses an LLM-based student model to score candidate tutor utterances and DPO-trains against it. Highly relevant to **[S1, S4]** (the student model literally generates "what-if" predictions).
  - [arXiv 2503.06424](https://arxiv.org/abs/2503.06424) → `pdfs/01-knowledge-tracing/2503.06424_training-llm-based-tutors-to-improve-student-learning-outcomes-in-dialogues.pdf`

- **Cen et al. (2025), "LLM-driven Effective Knowledge Tracing by Integrating Dual-channel Difficulty."** — https://arxiv.org/pdf/2502.19915. Lin lab work on LLM-KT. **⚠️ WITHDRAWN by authors (data correction in progress).** The download script tries the v1 PDF first, then falls back to saving the HTML render. If both fail, the paper isn't currently retrievable from arXiv; the [aimodels.fyi summary](https://www.aimodels.fyi/papers/arxiv/llm-driven-effective-knowledge-tracing-by-integrating) and [moonlight literature review](https://www.themoonlight.io/en/review/llm-driven-effective-knowledge-tracing-by-integrating-dual-channel-difficulty) preserve the abstract.
  - [arXiv 2502.19915 (abs page)](https://arxiv.org/abs/2502.19915) → `pdfs/01-knowledge-tracing/2502.19915_*.{pdf,html}` (fallback path)

- **CIKT — Collaborative Iterative Knowledge Tracing (2025).** — https://arxiv.org/pdf/2505.17705. Two-LLM framework: an *Analyst* generates structured student profiles, a *Predictor* forecasts performance; trained via Kahneman–Tversky Optimization. Architecturally analogous to your ego/superego split.
  - [arXiv 2505.17705](https://arxiv.org/pdf/2505.17705) → `pdfs/01-knowledge-tracing/2505.17705_cikt-collaborative-iterative-knowledge-tracing.pdf`

- **Next Token Knowledge Tracing (NTKT, 2025).** — https://arxiv.org/pdf/2511.02599. Reframes KT as next-token prediction on natural-language interaction histories. Directly applicable if the diagnostician maintains a textual learner state.
  - [arXiv 2511.02599](https://arxiv.org/pdf/2511.02599) → `pdfs/01-knowledge-tracing/2511.02599_next-token-knowledge-tracing-ntkt-2025.pdf`

- **Language Bottleneck Models for Qualitative Knowledge State Modeling (2025).** — https://arxiv.org/pdf/2506.16982. Forces the learner state through a natural-language "bottleneck" — interpretable belief-state tracking; arguably the cleanest realization of an externalized learner model.
  - [arXiv 2506.16982](https://arxiv.org/pdf/2506.16982) → `pdfs/01-knowledge-tracing/2506.16982_language-bottleneck-models-for-qualitative-knowledge-state-modeling.pdf`

- **L-HAKT — LLM-Empowered Knowledge Tracing via Hierarchical Behavior Alignment in Hyperbolic Space (2026).** — https://arxiv.org/pdf/2602.22879. Hyperbolic embedding of KC trees; useful if you go hierarchical.
  - [arXiv 2602.22879](https://arxiv.org/pdf/2602.22879) → `pdfs/01-knowledge-tracing/2602.22879_l-hakt-llm-empowered-knowledge-tracing-via-hierarchical-behavior-alignment-in-hy.pdf`

- **HACHIMI: Scalable and Controllable Student Persona Generation via Orchestrated Agents (2026).** — https://arxiv.org/pdf/2603.04855. Theory-aligned student persona generation with population-level distribution control. **[S1]** for trajectory bifurcation.
  - [arXiv 2603.04855](https://arxiv.org/pdf/2603.04855) → `pdfs/01-knowledge-tracing/2603.04855_hachimi-scalable-and-controllable-student-persona-generation-via-orchestrated-ag.pdf`

- **Towards Valid Student Simulation with Large Language Models (2026).** — https://arxiv.org/html/2601.05473. Validation framework for LLM-simulated students. Critical for S1 since your bifurcations depend on a believable student-model.
  - [arXiv 2601.05473](https://arxiv.org/html/2601.05473) → `pdfs/01-knowledge-tracing/2601.05473_towards-valid-student-simulation-with-large-language-models.pdf`

- **"Simulating Students with Large Language Models: A Review of Architecture" (2025).** — https://arxiv.org/pdf/2511.06078. Survey of architectures for LLM-based simulated students.
  - [arXiv 2511.06078](https://arxiv.org/pdf/2511.06078) → `pdfs/01-knowledge-tracing/2511.06078_simulating-students-with-large-language-models-a-review-of-architecture.pdf`

- **Can LLMs Simulate Personas with Reversed Performance? (2025).** — https://arxiv.org/html/2504.06460. LLMs systematically struggle to simulate low-performing students; vital caveat for S1 trajectory generation.
  - [arXiv 2504.06460](https://arxiv.org/html/2504.06460) → `pdfs/01-knowledge-tracing/2504.06460_can-llms-simulate-personas-with-reversed-performance.pdf`

- **LLM Generated Persona is a Promise with a Catch (NeurIPS 2025 Position Paper).** — https://openreview.net/forum?id=qh9eGtMG4H. Methodological warnings about persona-based simulation.
  - <https://openreview.net/forum?id=qh9eGtMG4H>

### Survey & community

- **Shen et al. (2024), "A Survey of Knowledge Tracing: Models, Variants, and Applications."** — https://arxiv.org/html/2105.15106v4. Maintained survey covering BKT → DKT → DKVMN → SAKT → SAINT/SAINT+ → AKT → LLM-KT.
  - [arXiv 2105.15106](https://arxiv.org/html/2105.15106v4) → `pdfs/01-knowledge-tracing/2105.15106_a-survey-of-knowledge-tracing-models-variants-and-applications.pdf`

- **"Deep Learning Based Knowledge Tracing: A Review" (BDIE 2025).** — https://dl.acm.org/doi/10.1145/3729605.3729620. Particularly good on the LLM-KT category.
  - <https://dl.acm.org/doi/10.1145/3729605.3729620>

### Transformer-era KT (skim for the architectural vocabulary)

- **AKT — Context-Aware Attentive Knowledge Tracing (Ghosh, Heffernan, Lan 2020).** — https://arxiv.org/pdf/2007.12324. Monotonic attention + Rasch embeddings. Still the most cited modern baseline.
  - [arXiv 2007.12324](https://arxiv.org/pdf/2007.12324) → `pdfs/01-knowledge-tracing/2007.12324_akt-context-aware-attentive-knowledge-tracing-ghosh-heffernan-lan-2020.pdf`

- **SAINT+ (Shin et al. 2020).** — https://arxiv.org/pdf/2010.12042. Transformer encoder–decoder on EdNet; SOTA for years.
  - [arXiv 2010.12042](https://arxiv.org/pdf/2010.12042) → `pdfs/01-knowledge-tracing/2010.12042_saint-shin-et-al-2020.pdf`

- **ELAKT (TOIS 2024).** — https://dl.acm.org/doi/10.1145/3652601. Locality-enhanced attentive KT, 2024 update.
  - <https://dl.acm.org/doi/10.1145/3652601>

- **Domain-Knowledge-Informed Attention KT (2025).** — https://arxiv.org/html/2501.05605v1. XES3G5M benchmark with auxiliary information.
  - [arXiv 2501.05605](https://arxiv.org/html/2501.05605v1) → `pdfs/01-knowledge-tracing/2501.05605_domain-knowledge-informed-attention-kt.pdf`

### Libraries

- **pyBKT** — https://github.com/CAHLR/pyBKT. Pardos lab's Python BKT library with EM fitting, cross-validation, common BKT extensions. Paper: https://arxiv.org/abs/2105.00385. Tutorial: https://ialt.education.ufl.edu/2024/05/06/an-introduction-to-bayesian-knowledge-tracing-with-pybkt/
  - <https://github.com/CAHLR/pyBKT>
  - [arXiv 2105.00385](https://arxiv.org/abs/2105.00385) → `pdfs/01-knowledge-tracing/2105.00385_pybkt.pdf`
  - <https://ialt.education.ufl.edu/2024/05/06/an-introduction-to-bayesian-knowledge-tracing-with-pybkt/>

- **EduData** — https://edudata.readthedocs.io/. CLI/Python package for KT benchmark datasets.
  - <https://edudata.readthedocs.io/>

- **pyKT** — https://github.com/pykt-team/pykt-toolkit. Standard DKT/AKT/SAKT/SAINT implementations and benchmarks.
  - <https://github.com/pykt-team/pykt-toolkit>

### Datasets / benchmarks

- **ASSISTments** — https://sites.google.com/site/assistmentsdata/. Heffernan lab. Several vintages (2009, 2012, 2015, 2017); the longest-running KT benchmark.
  - <https://sites.google.com/site/assistmentsdata/>

- **EdNet (Choi et al. 2019).** — https://arxiv.org/abs/1912.03072 / https://github.com/riiid/ednet. 131M interactions from Santa; the largest KT dataset.
  - [arXiv 1912.03072](https://arxiv.org/abs/1912.03072) → `pdfs/01-knowledge-tracing/1912.03072_ednet-choi-et-al-2019.pdf`
  - <https://github.com/riiid/ednet>

- **XES3G5M (Liu et al. 2024)** — https://github.com/ai4ed/XES3G5M. Comprehensive KT benchmark with auxiliary side info.
  - <https://github.com/ai4ed/XES3G5M>

- **PSLC DataShop** — https://pslcdatashop.web.cmu.edu/. CMU's repository of tutoring logs across many ITS deployments.
  - <https://pslcdatashop.web.cmu.edu/>

- **ES-KT-24** — https://arxiv.org/pdf/2409.10244. Multimodal KT with educational-game video + LLM-synthesized text.
  - [arXiv 2409.10244](https://arxiv.org/pdf/2409.10244) → `pdfs/01-knowledge-tracing/2409.10244_es-kt-24.pdf`

### Talks/podcasts

- **NeurIPS 2024 Workshop on Large Foundation Models for Educational Assessment** — https://neurips2024edu.github.io/. Recordings available; several talks directly on LLM-based KT and student modeling.
  - <https://neurips2024edu.github.io/>

- **GAIED workshop series (NeurIPS 2023 → IJCAI 2024 tutorial → ongoing).** Survey paper: https://arxiv.org/abs/2402.01580. Tutorial: https://gaied.org/ijcai2024/.
  - [arXiv 2402.01580](https://arxiv.org/abs/2402.01580) → `pdfs/01-knowledge-tracing/2402.01580_gaied-workshop-series-neurips-2023-ijcai-2024-tutorial-ongoing.pdf`
  - <https://gaied.org/ijcai2024/>

---

## §2. Intelligent Tutoring Systems Foundations (primary: S5; secondary: S2, S3) — light coverage

PDFs in this section: `pdfs/02-its-foundations/`

- **VanLehn (2006), "The Behavior of Tutoring Systems."** — https://cs.uky.edu/~sgware/reading/papers/vanlehn2006behavior.pdf. The two-loop architecture (outer = task selection, inner = step-level interaction). The "domain model / student model / tutor model / interface" framing your S2 implicitly recovers.
  - <https://cs.uky.edu/~sgware/reading/papers/vanlehn2006behavior.pdf>

### 2024–2026 ITS-meets-LLM bridges (worth reading)

- **The Path to Conversational AI Tutors (Vanacore, Closser, Baker, Roschelle, 2026).** — https://arxiv.org/pdf/2602.19303. Maps classical ITS pedagogical primitives onto LLM tutoring; the cleanest bridge document I've seen.
  - [arXiv 2602.19303](https://arxiv.org/pdf/2602.19303) → `pdfs/02-its-foundations/2602.19303_the-path-to-conversational-ai-tutors-vanacore-closser-baker-roschelle-2026.pdf`

- **A Theory of Adaptive Scaffolding for LLM-Based Pedagogical Agents (2025).** — https://arxiv.org/pdf/2508.01503. Synthesizes KLI, ZPD, and ECD with LLM-agent design. **[S5]** anchor paper.
  - [arXiv 2508.01503](https://arxiv.org/pdf/2508.01503) → `pdfs/02-its-foundations/2508.01503_a-theory-of-adaptive-scaffolding-for-llm-based-pedagogical-agents.pdf`

- **AI2T: Building Trustable AI Tutors by Interactively Teaching a Self-Aware Learning Agent (Weitekamp, Harpstead, Koedinger 2024).** — https://arxiv.org/pdf/2411.17924. CMU lineage; modern Cognitive Tutor.
  - [arXiv 2411.17924](https://arxiv.org/pdf/2411.17924) → `pdfs/02-its-foundations/2411.17924_ai2t-building-trustable-ai-tutors-by-interactively-teaching-a-self-aware-learnin.pdf`

---

## §3. Dialogue Act Classification & Pedagogical Move Taxonomies

PDFs in this section: `pdfs/03-dialogue-acts/`

### Taxonomies & frameworks

- **Tutor Move Taxonomy (Zhou, Vanacore, Thompson, St John, Kizilcec, 2026).** — https://arxiv.org/pdf/2603.05778. *Most directly useful for S3*: a hybrid deductive-inductive taxonomy from the National Tutoring Observatory (Cornell), with four top-level categories and learning-support moves on a spectrum from elicit→explain. This is essentially the codebook you should adopt or adapt.
  - [arXiv 2603.05778](https://arxiv.org/pdf/2603.05778) → `pdfs/03-dialogue-acts/2603.05778_tutor-move-taxonomy-zhou-vanacore-thompson-st-john-kizilcec-2026.pdf`

### LLM dialogue-act labeling (2024–2026, heavy emphasis)

- **Classifying Tutor Discursive Moves at Scale in Mathematics Classrooms with LLMs (Suresh et al., L@S 2024).** — https://mlciv.com/papers/talkmove-llm-2024.pdf. Direct demonstration that LLMs can do TalkMoves classification at scale.
  - <https://mlciv.com/papers/talkmove-llm-2024.pdf>

- **BIPED: Bilingual Pedagogically-informed Tutoring Dataset (2024).** — https://arxiv.org/pdf/2406.03486. 34 tutor acts × 9 student acts; "select-act-then-generate" CITS design pattern relevant to **[S3, S2]**.
  - [arXiv 2406.03486](https://arxiv.org/pdf/2406.03486) → `pdfs/03-dialogue-acts/2406.03486_biped-bilingual-pedagogically-informed-tutoring-dataset.pdf`

- **He & Xu (2024), "Automated Classification of Tutors' Dialogue Acts Using Generative AI: A Case Study Using the CIMA Corpus."** — https://arxiv.org/pdf/2509.09125. GPT-3.5/GPT-4 vs. manual coding on CIMA.
  - [arXiv 2509.09125](https://arxiv.org/pdf/2509.09125) → `pdfs/03-dialogue-acts/2509.09125_automated-classification-of-tutors-dialogue-acts-using-generative-ai-a-case-stud.pdf`

- **Thomas, Borchers, Lin, et al. (2025), "Leveraging LLMs to Assess Tutor Moves in Real-Life Dialogues: A Feasibility Study."** — https://arxiv.org/pdf/2506.17410. CMU + LEVI; benchmarks LLM accuracy at tutor-move classification on real audio transcripts.
  - [arXiv 2506.17410](https://arxiv.org/pdf/2506.17410) → `pdfs/03-dialogue-acts/2506.17410_leveraging-llms-to-assess-tutor-moves-in-real-life-dialogues-a-feasibility-study.pdf`

- **Enhancing Talk Moves Analysis in Mathematics Tutoring through Classroom Teaching Discourse (2024).** — https://arxiv.org/html/2412.13395v1. Cross-corpus transfer between TalkMoves and NCTE-annotated tutoring sessions.
  - [arXiv 2412.13395](https://arxiv.org/html/2412.13395v1) → `pdfs/03-dialogue-acts/2412.13395_enhancing-talk-moves-analysis-in-mathematics-tutoring-through-classroom-teaching.pdf`

- **Unifying AI Tutor Evaluation: An Evaluation Taxonomy for Pedagogical Ability Assessment of LLM-Powered AI Tutors (Maurya, Petukhova, Kochmar, 2024 → NAACL 2025).** — https://arxiv.org/html/2412.09416v1. Eight-dimension pedagogical-ability rubric (Mistake Identification, Mistake Location, Guidance, Actionability, Coherence, Tutor Tone, Humanlikeness, Encouragement).
  - [arXiv 2412.09416](https://arxiv.org/html/2412.09416v1) → `pdfs/03-dialogue-acts/2412.09416_unifying-ai-tutor-evaluation-an-evaluation-taxonomy-for-pedagogical-ability-asse.pdf`

### Tooling

- **TalkMoves dataset & application.** — https://github.com/SumnerLab/TalkMoves; paper https://arxiv.org/abs/2204.09652. 567 K-12 math lesson transcripts annotated for ten discursive moves + Switchboard-DA labels.
  - <https://github.com/SumnerLab/TalkMoves>
  - [arXiv 2204.09652](https://arxiv.org/abs/2204.09652) → `pdfs/03-dialogue-acts/2204.09652_talkmoves-dataset-application.pdf`

- **ConvoKit (CMU).** — https://convokit.cornell.edu/. Conversational analysis library; useful even outside Reddit/forum data.
  - <https://convokit.cornell.edu/>

---

## §4. Scaffolding Theory & Contingency Measurement

PDFs in this section: `pdfs/04-scaffolding/`

### Foundational

- **Van de Pol, Volman, Beishuizen (2010), "Scaffolding in Teacher–Student Interaction: A Decade of Research."** *Educational Psychology Review* 22, 271–296. — https://link.springer.com/article/10.1007/s10648-010-9127-6. *The* operationalization paper: contingency + fading + transfer of responsibility as the three measurable axes. Mandatory.
  - <https://link.springer.com/article/10.1007/s10648-010-9127-6>

- **Van de Pol, Volman, Oort, Beishuizen (2015), "The effects of scaffolding in the classroom: support contingency and student independent working time..."** *Instructional Science* 43, 615–641. — https://link.springer.com/article/10.1007/s11251-015-9351-z. Empirical; introduces the *contingency × independent-working-time* interaction (relevant boundary condition for your null result on responsiveness).
  - <https://link.springer.com/article/10.1007/s11251-015-9351-z>

- **Van de Pol et al. (2019), "Scaffolding Student Understanding in Small-Group Work" (uptake mediation).** — https://www.tandfonline.com/doi/full/10.1080/10508406.2018.1522258. Shows that uptake, not contingency itself, mediates achievement — *this is the methodological template for S5*.
  - <https://www.tandfonline.com/doi/full/10.1080/10508406.2018.1522258>

### 2024–2026 LLM-scaffolding operationalization

- **A Theory of Adaptive Scaffolding for LLM-Based Pedagogical Agents (2025).** — https://arxiv.org/html/2508.01503v1. Already listed in §2; this is the most explicit operationalization-of-Vygotsky-in-LLM paper currently on arXiv.
  - [arXiv 2508.01503](https://arxiv.org/html/2508.01503v1) → `pdfs/02-its-foundations/2508.01503_a-theory-of-adaptive-scaffolding-for-llm-based-pedagogical-agents.pdf`

- **Figueiredo (2025), "Fuzzy, Symbolic, and Contextual: Enhancing LLM Instruction via Cognitive Scaffolding."** — https://arxiv.org/pdf/2508.21204. Three-layer prompt-level scaffold with short-term schema; explicitly Vygotskian.
  - [arXiv 2508.21204](https://arxiv.org/pdf/2508.21204) → `pdfs/04-scaffolding/2508.21204_fuzzy-symbolic-and-contextual-enhancing-llm-instruction-via-cognitive-scaffoldin.pdf`

- **"A Fuzzy Logic Prompting Framework for Large Language Models in Adaptive and Uncertain Tasks" (2025).** — https://arxiv.org/html/2508.06754. Boundary-prompt + control-schema design pattern.
  - [arXiv 2508.06754](https://arxiv.org/html/2508.06754) → `pdfs/04-scaffolding/2508.06754_a-fuzzy-logic-prompting-framework-for-large-language-models-in-adaptive-and-unce.pdf`

- **"arXiv:2506.19484 — LLMs and Vygotsky" (2025).** — https://arxiv.org/pdf/2506.19484. Maps LLM behaviors onto Vygotskian theory point-by-point. Useful for the discussion section of your follow-up.
  - [arXiv 2506.19484](https://arxiv.org/pdf/2506.19484) → `pdfs/04-scaffolding/2506.19484_arxiv250619484-llms-and-vygotsky.pdf`

---

## §5. LLM Agent Architectures & Multi-Agent Systems

PDFs in this section: `pdfs/05-llm-agents/`

### Agent-architecture canon (2023, but central)

- **Yao et al. (2023), "ReAct: Synergizing Reasoning and Acting in Language Models."** — https://arxiv.org/abs/2210.03629. The canonical reason-act loop.
  - [arXiv 2210.03629](https://arxiv.org/abs/2210.03629) → `pdfs/05-llm-agents/2210.03629_react-synergizing-reasoning-and-acting-in-language-models.pdf`

- **Shinn et al. (2023), "Reflexion: Language Agents with Verbal Reinforcement Learning."** — https://arxiv.org/abs/2303.11366. Verbal self-feedback; relevant to a critic/diagnostician role.
  - [arXiv 2303.11366](https://arxiv.org/abs/2303.11366) → `pdfs/05-llm-agents/2303.11366_reflexion-language-agents-with-verbal-reinforcement-learning.pdf`

- **Wang et al. (2023), "Voyager: An Open-Ended Embodied Agent with LLMs."** — https://arxiv.org/abs/2305.16291. Skill-library + automatic curriculum; conceptually relevant for S6 (skills accumulating across sessions).
  - [arXiv 2305.16291](https://arxiv.org/abs/2305.16291) → `pdfs/05-llm-agents/2305.16291_voyager-an-open-ended-embodied-agent-with-llms.pdf`

- **Park et al. (2023), "Generative Agents: Interactive Simulacra of Human Behavior."** — https://arxiv.org/abs/2304.03442 / https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763. Observation-reflection-planning memory architecture; the persistent-memory paradigm for S6.
  - [arXiv 2304.03442](https://arxiv.org/abs/2304.03442) → `pdfs/05-llm-agents/2304.03442_generative-agents-interactive-simulacra-of-human-behavior.pdf`
  - <https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763>

### Multi-agent orchestration libraries (current state, 2024–2026)

- **LangGraph (LangChain)** — https://www.langchain.com/langgraph. The de facto graph-based orchestration framework with built-in checkpointing/state persistence; *the* tool for the multi-agent ego/superego/diagnostician architecture. Reached v1.0 in late 2024. Tutorial walkthrough: https://blog.futuresmart.ai/multi-agent-system-with-langgraph
  - <https://www.langchain.com/langgraph>
  - <https://blog.futuresmart.ai/multi-agent-system-with-langgraph>

- **LangChain blog, "How and when to build multi-agent systems"** — https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/. Required reading; sober treatment of context-engineering trade-offs (Anthropic vs. Cognition philosophies).
  - <https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/>

- **AutoGen (Microsoft, now AG2 v0.4).** — Conversational/GroupChat orchestration; better for offline quality-sensitive workflows than for low-latency tutoring. https://microsoft.github.io/autogen/
  - <https://microsoft.github.io/autogen/>

- **CrewAI** — https://www.crewai.com/. Role-based, lower-ceremony; good for prototyping the diagnostician/ego/superego split.
  - <https://www.crewai.com/>

- **Comparison reads:** "Best Multi-Agent Frameworks in 2026" — https://gurusup.com/blog/best-multi-agent-frameworks-2026. DataCamp framework comparison: https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen
  - <https://gurusup.com/blog/best-multi-agent-frameworks-2026>
  - <https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen>

### Surveys & tutorials

- **"Agentic AI: Architectures, Taxonomies, and Evaluation of LLM Agents" (2026).** — https://arxiv.org/html/2601.12560v1.
  - [arXiv 2601.12560](https://arxiv.org/html/2601.12560v1) → `pdfs/05-llm-agents/2601.12560_agentic-ai-architectures-taxonomies-and-evaluation-of-llm-agents.pdf`

- **"AI Agent Systems: Architectures, Applications, and Evaluation" (2026).** — https://arxiv.org/html/2601.01743v1.
  - [arXiv 2601.01743](https://arxiv.org/html/2601.01743v1) → `pdfs/05-llm-agents/2601.01743_ai-agent-systems-architectures-applications-and-evaluation.pdf`

### Educational multi-agent specifically

---

## §6. Counterfactual Evaluation of Dialogue Systems

PDFs in this section: `pdfs/06-counterfactual-eval/`

### Causal/counterfactual reasoning in NLP

### 2024–2026 LLM counterfactual reasoning

- **CounterBench (Tang et al. 2025).** — https://arxiv.org/pdf/2502.11008. Benchmark for counterfactual reasoning in LLMs; introduces the "CoIn" paradigm.
  - [arXiv 2502.11008](https://arxiv.org/pdf/2502.11008) → `pdfs/06-counterfactual-eval/2502.11008_counterbench-tang-et-al-2025.pdf`

- **"Causal What-Ifs: Rethinking Counterfactuals with LLM Agents" (Springer 2025).** — https://link.springer.com/chapter/10.1007/978-981-95-4367-0_13. Two-stage prompt-optimization framework for plausible, causally-consistent CFs.
  - <https://link.springer.com/chapter/10.1007/978-981-95-4367-0_13>

- **"Towards Unifying Evaluation of Counterfactual Explanations: Leveraging LLMs for Human-Centric Assessments" (2024).** — https://arxiv.org/pdf/2410.21131. LLM as benchmarker of CF explanations.
  - [arXiv 2410.21131](https://arxiv.org/pdf/2410.21131) → `pdfs/06-counterfactual-eval/2410.21131_towards-unifying-evaluation-of-counterfactual-explanations-leveraging-llms-for-h.pdf`

- **AXIS (2025), "Integrating Counterfactual Simulations with Language Models for Explaining Multi-Agent Behaviour."** — https://arxiv.org/html/2505.17801. Closest existing work to your bifurcation idea, in the multi-agent-RL setting.
  - [arXiv 2505.17801](https://arxiv.org/html/2505.17801) → `pdfs/06-counterfactual-eval/2505.17801_integrating-counterfactual-simulations-with-language-models-for-explaining-multi.pdf`

### Branching simulation methodology (related rather than direct)

- **Backtracing (Wang, Wirawarn, Khattab, Goodman, Demszky, EACL Findings 2024).** — https://arxiv.org/abs/2403.03956. "Retrieve the cause of the query": given a student turn, find the antecedent tutor turn that produced the misconception. Methodologically adjacent to bifurcation.
  - [arXiv 2403.03956](https://arxiv.org/abs/2403.03956) → `pdfs/06-counterfactual-eval/2403.03956_backtracing-wang-wirawarn-khattab-goodman-demszky-eacl-findings-2024.pdf`

- **Tutor CoPilot (Wang, Ribeiro, Robinson, Loeb, Demszky 2024).** — https://arxiv.org/abs/2410.03017. Real-time AI suggestions to live human tutors; the deployment study includes natural counterfactual variation.
  - [arXiv 2410.03017](https://arxiv.org/abs/2410.03017) → `pdfs/06-counterfactual-eval/2410.03017_tutor-copilot-wang-ribeiro-robinson-loeb-demszky-2024.pdf`

### Pair-ranking (overlap with §7)

---

## §7. LLM-as-Judge & Pairwise Evaluation

PDFs in this section: `pdfs/07-llm-as-judge/`

### Foundational

- **Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena."** — https://arxiv.org/abs/2306.05685. Required reading; introduces pairwise vs. single-answer protocols and quantifies position/verbosity biases.
  - [arXiv 2306.05685](https://arxiv.org/abs/2306.05685) → `pdfs/07-llm-as-judge/2306.05685_judging-llm-as-a-judge-with-mt-bench-and-chatbot-arena.pdf`

- **LMSYS Chatbot Arena (Chiang et al., 2024).** — https://arxiv.org/abs/2403.04132. Crowd-sourced pairwise preference ranking infrastructure.
  - [arXiv 2403.04132](https://arxiv.org/abs/2403.04132) → `pdfs/07-llm-as-judge/2403.04132_lmsys-chatbot-arena-chiang-et-al-2024.pdf`

### 2024–2026 bias and reliability work (heavy emphasis)

- **Shi et al. (2024–25), "Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge."** — https://arxiv.org/abs/2406.07791. Three metrics: repetition stability, position consistency, preference fairness; 150K eval instances. *Critical for S4 design.*
  - [arXiv 2406.07791](https://arxiv.org/abs/2406.07791) → `pdfs/07-llm-as-judge/2406.07791_judging-the-judges-a-systematic-study-of-position-bias-in-llm-as-a-judge.pdf`

- **"The Comparative Trap: Pairwise Comparisons Amplifies Biased Preferences of LLM Evaluators" (2024).** — https://arxiv.org/pdf/2406.12319. Counterargument to default pairwise; pairwise *amplifies* known biases on adversarial examples.
  - [arXiv 2406.12319](https://arxiv.org/pdf/2406.12319) → `pdfs/07-llm-as-judge/2406.12319_the-comparative-trap-pairwise-comparisons-amplifies-biased-preferences-of-llm-ev.pdf`

- **"Aligning with Human Judgement: The Role of Pairwise Preference in LLM Evaluators" (2024).** — https://arxiv.org/pdf/2403.16950.
  - [arXiv 2403.16950](https://arxiv.org/pdf/2403.16950) → `pdfs/07-llm-as-judge/2403.16950_aligning-with-human-judgement-the-role-of-pairwise-preference-in-llm-evaluators.pdf`

- **"Who can we trust? LLM-as-a-jury for Comparative Assessment" (2026).** — https://arxiv.org/pdf/2602.16610. Multi-judge jury with reliability weighting; recommended pattern for S4 if budget allows.
  - [arXiv 2602.16610](https://arxiv.org/pdf/2602.16610) → `pdfs/07-llm-as-judge/2602.16610_who-can-we-trust-llm-as-a-jury-for-comparative-assessment.pdf`

- **UDA — Unsupervised Debiasing Alignment for Pair-wise LLM-as-a-Judge (2025).** — https://arxiv.org/pdf/2508.09724. Dynamic recalibration via judge consensus; a usable methodology for your S4 robustness section.
  - [arXiv 2508.09724](https://arxiv.org/pdf/2508.09724) → `pdfs/07-llm-as-judge/2508.09724_uda-unsupervised-debiasing-alignment-for-pair-wise-llm-as-a-judge.pdf`

- **"The Silent Judge: Unacknowledged Shortcut Bias in LLM-as-a-Judge" (NeurIPS 2025 workshop).** — https://arxiv.org/pdf/2509.26072. Recency and provenance bias (EXPERT > HUMAN > LLM > UNKNOWN). Vital — your hold-out optimal-continuation pairs in S4 must avoid these shortcut features.
  - [arXiv 2509.26072](https://arxiv.org/pdf/2509.26072) → `pdfs/07-llm-as-judge/2509.26072_the-silent-judge-unacknowledged-shortcut-bias-in-llm-as-a-judge-neurips-2025-wor.pdf`

- **FairJudge: An Adaptive, Debiased, and Consistent LLM-as-a-Judge (2026).** — https://arxiv.org/pdf/2602.06625. Pointwise–pairwise inconsistency analysis.
  - [arXiv 2602.06625](https://arxiv.org/pdf/2602.06625) → `pdfs/07-llm-as-judge/2602.06625_fairjudge-an-adaptive-debiased-and-consistent-llm-as-a-judge.pdf`

### Evaluation harnesses & benchmarks

- **AlpacaEval 2.0 (Length-Controlled).** — https://github.com/tatsu-lab/alpaca_eval. Length-debiased pairwise eval against a reference model.
  - <https://github.com/tatsu-lab/alpaca_eval>

- **Arena-Hard / Arena-Hard-Auto (LMSYS, 2024).** — https://www.lmsys.org/blog/2024-04-19-arena-hard/. Hard-prompt distillation pipeline; 87.4% separability vs. MT-Bench. Strong template for S4.
  - <https://www.lmsys.org/blog/2024-04-19-arena-hard/>

- **BEA 2025 Shared Task on Pedagogical Ability Assessment of AI-powered Tutors.** — https://sig-edu.org/sharedtask/2025. Findings paper https://arxiv.org/html/2507.10579v1. *MRBench* benchmark dataset built on MathDial+Bridge; eight pedagogical dimensions. *The* domain-specific judge benchmark — required for S4.
  - <https://sig-edu.org/sharedtask/2025>
  - [arXiv 2507.10579](https://arxiv.org/html/2507.10579v1) → `pdfs/07-llm-as-judge/2507.10579_bea-2025-shared-task-on-pedagogical-ability-assessment-of-ai-powered-tutors.pdf`

- **MathTutorBench (Macina, Daheim, Hakimi, Kapur, Gurevych, Sachan 2025).** — https://arxiv.org/abs/2502.18940. Pairwise expert-vs.-novice teacher response judgment; reward-model-based scoring. https://eth-lre.github.io/mathtutorbench/. **This is essentially S4 already done at corpus scale; build on it.**
  - [arXiv 2502.18940](https://arxiv.org/abs/2502.18940) → `pdfs/07-llm-as-judge/2502.18940_mathtutorbench-macina-daheim-hakimi-kapur-gurevych-sachan-2025.pdf`
  - <https://eth-lre.github.io/mathtutorbench/>

- **MMTutorBench (2025).** — https://arxiv.org/pdf/2510.23477. Multimodal extension; relevant only if you go visual.
  - [arXiv 2510.23477](https://arxiv.org/pdf/2510.23477) → `pdfs/07-llm-as-judge/2510.23477_mmtutorbench.pdf`

### Inspect AI (UK AISI) — your evaluation harness of choice

- **Inspect AI** — https://inspect.aisi.org.uk/. Production-grade LLM eval framework; 200+ pre-built evals, multi-provider model layer, sandboxing, model-graded scoring. Tutorial: https://inspect.aisi.org.uk/tutorial.html. Multi-agent docs: https://inspect.aisi.org.uk/agents-multi.html.
  - <https://inspect.aisi.org.uk/>
  - <https://inspect.aisi.org.uk/tutorial.html>
  - <https://inspect.aisi.org.uk/agents-multi.html>

- **Inspect Evals (community evals)** — https://ukgovernmentbeis.github.io/inspect_evals/.
  - <https://ukgovernmentbeis.github.io/inspect_evals/>

- **PyPI install** — `pip install inspect-ai`. Walkthrough article: https://schmatz.github.io/deception-eval-with-inspect/. *Recommended primary harness given your stack.*
  - <https://schmatz.github.io/deception-eval-with-inspect/>

### Other evaluation frameworks

- **DeepEval** — https://github.com/confident-ai/deepeval. Pytest-style LLM unit testing; G-Eval, hallucination, RAG metrics.
  - <https://github.com/confident-ai/deepeval>

- **Promptfoo** — https://www.promptfoo.dev/. YAML-driven; lighter, JS-ecosystem; use for prompt regression in CI.
  - <https://www.promptfoo.dev/>

- **Ragas** — https://github.com/explodinggradients/ragas. Reference-free RAG/dialogue eval if you go retrieval-augmented.
  - <https://github.com/explodinggradients/ragas>

- **LangSmith** vs **Langfuse**: LangSmith for LangChain-native managed observability; Langfuse for open-source, framework-agnostic, OpenTelemetry-style tracing with self-hosting. Comparison: https://www.zenml.io/blog/langfuse-vs-langsmith. *Given your multi-provider stack and academic publication needs, Langfuse self-hosted is the recommended default for trace logging in this work.*
  - <https://www.zenml.io/blog/langfuse-vs-langsmith>

---

## §8. Educational Dialogue Datasets and Benchmarks

PDFs in this section: `pdfs/08-educational-datasets/`

### Tutoring corpora

- **MathDial (Macina, Daheim, Chowdhury, Sinha, Kapur, Gurevych, Sachan, Findings of EMNLP 2023).** — https://github.com/eth-nlped/mathdial. 2.9K math tutoring conversations between human teachers and simulated students; the de facto S3/S4 benchmark for dialog tutoring. Data: https://huggingface.co/datasets/eth-nlped/mathdial.
  - <https://github.com/eth-nlped/mathdial>
  - <https://huggingface.co/datasets/eth-nlped/mathdial>

- **Bridge (Wang, Zhang, Robinson, Loeb, Demszky, NAACL 2024).** — https://huggingface.co/datasets/rose-e-wang/bridge. 700 real online tutoring conversations annotated by experts with (error, strategy, intention) decisions. Code: https://github.com/rosewang2008/bridge.
  - <https://huggingface.co/datasets/rose-e-wang/bridge>
  - <https://github.com/rosewang2008/bridge>

- **TSCC — Teacher-Student Chatroom Corpus (Caines et al. 2020, 2022).** — http://www.cl.cam.ac.uk/~apc38/tscc.html. Authentic ESL one-on-one chat tutoring, dialogue-act-annotated.
  - <http://www.cl.cam.ac.uk/~apc38/tscc.html>

### Frontier 2024–2026 educational datasets

- **EduDial** and other 2025 corpora are surveyed in: https://arxiv.org/html/2507.22753v1 ("Opportunities and Challenges of LLMs in Education: An NLP Perspective").
  - [arXiv 2507.22753](https://arxiv.org/html/2507.22753v1) → `pdfs/08-educational-datasets/2507.22753_edudial.pdf`

### Surveys

- **Macina, Daheim, Wang, Sinha, Kapur, Gurevych, Sachan (2023), "Opportunities and Challenges in Neural Dialog Tutoring."** *EACL.* — https://aclanthology.org/2023.eacl-main.173/. The before-the-deluge survey; still the cleanest framing of where dialog tutoring is hard.
  - <https://aclanthology.org/2023.eacl-main.173/>

- **"Opportunities and Challenges of LLMs in Education: An NLP Perspective" (2025).** — https://arxiv.org/html/2507.22753v1.
  - [arXiv 2507.22753](https://arxiv.org/html/2507.22753v1) → `pdfs/08-educational-datasets/2507.22753_edudial.pdf`

---

## §9. Theory of Mind & Learner Modeling in LLMs

PDFs in this section: `pdfs/09-theory-of-mind/`

### Benchmarks (canonical → frontier)

- **BigToM (Gandhi, Fränken, Gerstenberg, Goodman, NeurIPS 2023).** — https://arxiv.org/abs/2306.15448. Causal-template ToM benchmark.
  - [arXiv 2306.15448](https://arxiv.org/abs/2306.15448) → `pdfs/09-theory-of-mind/2306.15448_bigtom-gandhi-fränken-gerstenberg-goodman-neurips-2023.pdf`

- **FANToM (Kim et al., EMNLP 2023).** — https://hyunw.kim/fantom/ / https://arxiv.org/abs/2310.15421. Information-asymmetric conversational ToM. *Most relevant for S2 since tutoring is fundamentally information-asymmetric dialogue.*
  - <https://hyunw.kim/fantom/>
  - [arXiv 2310.15421](https://arxiv.org/abs/2310.15421) → `pdfs/09-theory-of-mind/2310.15421_fantom-kim-et-al-emnlp-2023.pdf`

- **OpenToM (Xu et al., 2024).** — https://arxiv.org/abs/2402.06044. Personality- and intention-grounded ToM with both physical and psychological mental states.
  - [arXiv 2402.06044](https://arxiv.org/abs/2402.06044) → `pdfs/09-theory-of-mind/2402.06044_opentom-xu-et-al-2024.pdf`

- **ToMBench (Chen et al., 2024).** — https://arxiv.org/abs/2402.15052. Holistic ToM eval addressing scope/subjectivity issues.
  - [arXiv 2402.15052](https://arxiv.org/abs/2402.15052) → `pdfs/09-theory-of-mind/2402.15052_tombench-chen-et-al-2024.pdf`

- **ExploreToM (Sclar et al., Meta 2024).** — https://arxiv.org/abs/2412.12175 / https://github.com/facebookresearch/exploretom. A* search over a domain-specific language to generate adversarial false-belief stories. SOTA LLMs at 0–9% on hard slice. *The single most informative ToM benchmark for diagnostician-agent design — directly stress-tests state tracking.*
  - [arXiv 2412.12175](https://arxiv.org/abs/2412.12175) → `pdfs/09-theory-of-mind/2412.12175_exploretom-sclar-et-al-meta-2024.pdf`
  - <https://github.com/facebookresearch/exploretom>

- **Kosinski (2024), "Evaluating large language models in theory of mind tasks."** PNAS — https://www.pnas.org/doi/10.1073/pnas.2405460121. Forty bespoke false-belief tasks across eleven LLMs.
  - <https://www.pnas.org/doi/10.1073/pnas.2405460121>

- **Ullman (2023), "Large language models fail on trivial alterations to theory-of-mind tasks."** — https://arxiv.org/abs/2302.08399. Mandatory caveat.
  - [arXiv 2302.08399](https://arxiv.org/abs/2302.08399) → `pdfs/09-theory-of-mind/2302.08399_large-language-models-fail-on-trivial-alterations-to-theory-of-mind-tasks.pdf`

### 2025 LLM-ToM training/limitations

- **"Small LLMs Do Not Learn a Generalizable Theory of Mind via Reinforcement Learning" (2025).** — https://arxiv.org/html/2507.15788. RLVR on ToM data fails to generalize. Methodologically informative for S2 — your diagnostician should not rely on small fine-tuned ToM modules.
  - [arXiv 2507.15788](https://arxiv.org/html/2507.15788) → `pdfs/09-theory-of-mind/2507.15788_small-llms-do-not-learn-a-generalizable-theory-of-mind-via-reinforcement-learnin.pdf`

### Simulated learners

---

## §10. Multi-session Conversational AI / Long-term Memory

PDFs in this section: `pdfs/10-long-term-memory/`

### Core architectures

- **MemGPT (Packer et al., Berkeley Sky Lab, 2023).** — https://arxiv.org/abs/2310.08560 / https://research.memgpt.ai/. OS-inspired hierarchical memory with self-managed paging; the foundation for Letta.
  - [arXiv 2310.08560](https://arxiv.org/abs/2310.08560) → `pdfs/10-long-term-memory/2310.08560_memgpt-packer-et-al-berkeley-sky-lab-2023.pdf`
  - <https://research.memgpt.ai/>

- **Letta (formerly MemGPT)** — https://letta.com/ / https://github.com/letta-ai/letta. Stateful-agent platform; programmatic context management, "Skill Learning," sleep-time compute. Recent Letta blog posts on "Agent Memory" (https://www.letta.com/blog/agent-memory) and "Benchmarking AI Agent Memory" (https://www.letta.com/blog/benchmarking-ai-agent-memory) are *required reading* for S6 — particularly the LoCoMo benchmark discussion and the "filesystem may be all you need" thesis.
  - <https://letta.com/>
  - <https://github.com/letta-ai/letta>
  - <https://www.letta.com/blog/agent-memory>
  - <https://www.letta.com/blog/benchmarking-ai-agent-memory>

- **Mem0** — https://mem0.ai/. User/session/agent hierarchy; vector + optional graph store; "memory in three lines of code" but with limitations Letta's authors highlight.
  - <https://mem0.ai/>

- **Zep / Graphiti** — https://www.getzep.com/. Temporal knowledge graph for agent memory.
  - <https://www.getzep.com/>

- **Awesome-Memory-for-Agents** (curated paper list) — https://github.com/TsinghuaC3I/Awesome-Memory-for-Agents. Maintained survey of episodic/long-term memory papers.
  - <https://github.com/TsinghuaC3I/Awesome-Memory-for-Agents>

### Spaced repetition (computational)

- **Tabibian et al. (2019), "Enhancing human learning via spaced repetition optimization."** *PNAS.* — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6410796/. Marked-temporal-point-process / SDE framework; principled CS computational treatment.
  - <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6410796/>

- **FSRS — Free Spaced Repetition Scheduler.** — https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler. DSR (difficulty/stability/retrievability) model; 20–30% fewer reviews than SM-2 at equal retention. Now bundled with Anki, RemNote, etc.
  - <https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler>

- **LECTOR (2025), "LLM-Enhanced Concept-based Test-Oriented Repetition for Adaptive Spaced Learning."** — https://arxiv.org/abs/2508.03275. LLM-powered semantic-similarity layer over FSRS/SSP-MMC.
  - [arXiv 2508.03275](https://arxiv.org/abs/2508.03275) → `pdfs/10-long-term-memory/2508.03275_llm-enhanced-concept-based-test-oriented-repetition-for-adaptive-spaced-learning.pdf`

- **Andy Matuschak's body of work.** https://andymatuschak.org/. Particularly "How to write good prompts" and his Quantum Country experiments. Relevant to S6 because he is one of the few people building serious memory-system infrastructure outside the academic loop. (Mentioned by Dwarkesh Patel, see Talks below.)
  - <https://andymatuschak.org/>

### Generative agents and persistent memory in education

### 2025–2026 frontier

- **"Forgetful but Faithful: A Cognitive Memory Architecture for Privacy-Aware Generative Agents" (2025).** — https://arxiv.org/html/2512.12856v1.
  - [arXiv 2512.12856](https://arxiv.org/html/2512.12856v1) → `pdfs/10-long-term-memory/2512.12856_forgetful-but-faithful-a-cognitive-memory-architecture-for-privacy-aware-generat.pdf`

- **"Memory in the Age of AI Agents" (Dec 2025 survey).** — A December 2025 large-scale taxonomic survey on three-axis (form/function/dynamics) memory categorization (referenced in https://arxiv.org/html/2603.04740v1).
  - [arXiv 2603.04740](https://arxiv.org/html/2603.04740v1) → `pdfs/10-long-term-memory/2603.04740_memory-in-the-age-of-ai-agents-dec-2025-survey.pdf`

---

## §11. Educational Philosophy / Critical Theory

PDFs in this section: `pdfs/11-educational-philosophy/`

- **Stanford Encyclopedia of Philosophy, "Recognition."** — https://plato.stanford.edu/entries/recognition/. Best entry-point.
  - <https://plato.stanford.edu/entries/recognition/>

- **Fleming (2011), "Recognition in the work of Axel Honneth: Implications for transformative learning theory."** — https://www.researchgate.net/publication/286459555. Transformative-learning-theory bridge.
  - <https://www.researchgate.net/publication/286459555>

- **Wilson & Spahn (2022), "The Struggle for AI's Recognition."** *Philosophy & Technology* — https://philarchive.org/archive/WIETSF. Honneth+Taylor applied to AI ethics specifically; the closest thing to a citation for what your recognition arm operationalizes.
  - <https://philarchive.org/archive/WIETSF>

- **Vygotsky in computational contexts:** Cole & Engeström-style cultural-historical activity theory; for an LLM-era treatment, see https://arxiv.org/pdf/2506.19484 (already in §4).
  - [arXiv 2506.19484](https://arxiv.org/pdf/2506.19484) → `pdfs/04-scaffolding/2506.19484_arxiv250619484-llms-and-vygotsky.pdf`

---

## §12. Practical Tooling for the Research Apparatus

PDFs in this section: `pdfs/12-tooling/`

### Multi-provider LLM access

- **LiteLLM** — https://github.com/BerriAI/litellm / https://docs.litellm.ai/. Unified OpenAI-format interface to 100+ providers (Anthropic, DeepSeek, Gemini, OpenRouter all native). *Recommended primary client* given your provider mix. Supports Anthropic prompt caching natively, including cache_control on system messages and 1-hour TTLs.
  - <https://github.com/BerriAI/litellm>
  - <https://docs.litellm.ai/>

- **OpenRouter** — https://openrouter.ai/. Cloud aggregator; useful as a single billing endpoint and for accessing models you don't have direct API access to.
  - <https://openrouter.ai/>

### Anthropic Claude best practices (Sonnet 4.6 / Haiku 4.5)

- **Prompt caching docs** — https://platform.claude.com/docs/en/build-with-claude/prompt-caching. Five-minute default TTL, 1-hour extended TTL; 5-min cache writes are 1.25× input price, 1-hour 2×; reads are 0.1× input price. *Cache the system prompt + tutoring rubric + persona description; with a 1h TTL this dominates your S4 cost.*
  - <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>

- **Batch processing** — https://platform.claude.com/docs/en/build-with-claude/batch-processing. 50% discount; stacks with prompt caching. Ideal for S1 (large counterfactual sweeps) and S4 (large pairwise comparisons) — the 1-hour cache + batch combination is the recommended pattern.
  - <https://platform.claude.com/docs/en/build-with-claude/batch-processing>

- Practical guides: https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models, https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/.
  - <https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models>
  - <https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/>

### Trace logging and observability

- **Langfuse** (recommended) — https://langfuse.com/. Open-source, self-hostable, OpenTelemetry-style tracing. Framework-agnostic; works equally with LiteLLM, raw HTTP, LangChain, CrewAI. Comparison: https://markaicode.com/vs/langfuse-vs-langsmith/. Tutorial: https://huggingface.co/blog/daya-shankar/langfuse-vs-langsmith-vs-langchain-comparison.
  - <https://langfuse.com/>
  - <https://markaicode.com/vs/langfuse-vs-langsmith/>
  - <https://huggingface.co/blog/daya-shankar/langfuse-vs-langsmith-vs-langchain-comparison>

- **LangSmith** — https://smith.langchain.com/. Use only if going LangChain/LangGraph-native.
  - <https://smith.langchain.com/>

### Evaluation harnesses

### Statistics for reliability / rater agreement

- **`krippendorff` (PyPI).** — Multiple implementations exist; the original Thomas Grill implementation (https://grrrr.org/2011/05/31/krippendorff_alpha-python/) is correct and widely validated; the NLTK implementation has known issues (https://github.com/raoulbia/nltk-krippendorff-validation). Aleph Alpha's modernized version: https://github.com/Aleph-Alpha/krippendorff-aleph-alpha. K-Alpha web calculator (for sanity-checking): https://www.k-alpha.org/. Methods paper: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11636850/.
  - <https://grrrr.org/2011/05/31/krippendorff_alpha-python/>
  - <https://github.com/raoulbia/nltk-krippendorff-validation>
  - <https://github.com/Aleph-Alpha/krippendorff-aleph-alpha>
  - <https://www.k-alpha.org/>
  - <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11636850/>

- **`pingouin`** — https://pingouin-stats.org/. ICC (single-rater, average-rater, fixed/random), Cohen's/Fleiss's kappa, intra-class correlations. Drop-in replacement for SPSS reliability functions.
  - <https://pingouin-stats.org/>

### Pre-registration

- **OSF Registries** — https://osf.io/registries. The standard. Use the AsPredicted template for the simpler factorial designs; the OSF Standard or PRP-QUANT template for anything involving mediation/multi-level structure (S5, S3).
  - <https://osf.io/registries>

- **AsPredicted** — https://aspredicted.org/. Faster, lighter; fine for S1, S4.
  - <https://aspredicted.org/>

### LLM eval / pre-registration in education specifically

---

## §13. Talks, podcasts, lecture series

PDFs in this section: `pdfs/13-talks-podcasts/`

### Education-AI specific

- **Stanford EduNLP Lab (Demszky)** — https://edunlp.stanford.edu/. Tutor CoPilot, Backtracing, M-Powering Teachers. Several recorded talks at Stanford GSE and HAI events on YouTube.
  - <https://edunlp.stanford.edu/>

- **Dora Demszky GSE "School's In" podcast appearance** — https://ed.stanford.edu/news/chatting-about-chatbots-how-ai-tools-can-support-teachers. Specifically on AI-driven tutor/teacher feedback.
  - <https://ed.stanford.edu/news/chatting-about-chatbots-how-ai-tools-can-support-teachers>

- **Stanford Accelerator for Learning panels** — https://acceleratelearning.stanford.edu/. The 2024 "AI will transform teaching and learning. Let's get it right." event recording features Demszky, Goodman, Khan, Liu in conversation.
  - <https://acceleratelearning.stanford.edu/>

- **ETH LRE Lab (Sachan, Macina)** — https://lre.inf.ethz.ch/. Talk recordings from EACL 2023 (neural dialog tutoring) and EMNLP 2025 (MathTutorBench) are on YouTube.
  - <https://lre.inf.ethz.ch/>

- **NeurIPS GAIED workshops (2023, 2024, 2025).** Recordings on the workshop site (https://gaied.org/) and NeurIPS virtual.
  - <https://gaied.org/>

- **NeurIPS 2024 Workshop on Large Foundation Models for Educational Assessment** — https://neurips2024edu.github.io/.
  - <https://neurips2024edu.github.io/>

- **BEA Shared Task workshops (2023, 2025)** — https://sig-edu.org/. Findings papers + recorded talks.
  - <https://sig-edu.org/>

### General-AI podcasts with frontier substance

- **Latent Space (swyx & Alessio)** — https://www.latent.space/. The episodes with Karpathy, Anthropic researchers (Trenton Bricken, Sholto Douglas), and the recurring "AI Engineer" reading-list episodes are most relevant. Generally orthogonal to education but excellent for staying current on agent infrastructure.
  - <https://www.latent.space/>

- **Machine Learning Street Talk (Tim Scarfe et al.)** — https://www.youtube.com/c/MachineLearningStreetTalk. Long-form, theory-heavy; episodes on memory, agency, and theory-of-mind in LLMs are directly relevant to S2/S6.
  - <https://www.youtube.com/c/MachineLearningStreetTalk>

- **Dwarkesh Podcast** — https://www.dwarkesh.com/podcast. Particularly: the Karpathy interview (October 2025) for grounding on capabilities, the Andy Matuschak appearance for spaced repetition / Socratic-tutoring-with-LLMs methodology (https://every.to/podcast/dwarkesh-patel-s-quest-to-learn-everything is the inversion — Dwarkesh as guest discussing his use of LLMs as Socratic tutors; *required listening* for S6 design intuitions). Also worthwhile: the Demis Hassabis / Sholto Douglas / Trenton Bricken episodes for capability context.
  - <https://www.dwarkesh.com/podcast>
  - <https://every.to/podcast/dwarkesh-patel-s-quest-to-learn-everything>

### University lecture series (skim, do not binge)

- **Stanford CS25 ("Transformers United")** — https://web.stanford.edu/class/cs25/. Particularly the agent-architecture lectures.
  - <https://web.stanford.edu/class/cs25/>

- **Anthropic Claude Sonnet 4.6 / Haiku 4.5 specifically** — model names on this list are in flux; verify on https://docs.claude.com/ at experiment time. The prompt-caching and batching APIs are stable; specific model snapshots are not.
  - <https://docs.claude.com/>

---

## Summary

- Sections: 13
- Bullets with links: 139
- Total link references: 168
- Unique arXiv papers (download script): 68
