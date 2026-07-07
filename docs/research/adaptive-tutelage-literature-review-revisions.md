# Revisions to the Existing Literature Review

**Project:** *Geist in the Machine* / adaptive tutelage mechanisms  
**Purpose:** Provide a literature-review revision packet that integrates the newly surfaced references and positions the paper's novelty conservatively.  
**Use:** Treat this as a replacement-and-insertion draft for Section 2 of `paper-full-2.0.md`, plus a citation audit for `references.bib`.

---

## 0. Revision thesis

The existing related-work section should be sharpened around one central distinction:

> The project does **not** invent stateful tutoring, learner modeling, step-level scaffolding, proof checking, self-critique, or adaptive instruction. Those are established in intelligent tutoring systems, learning sciences, formal proof tutors, and LLM-agent work. The contribution is the **LLM-specific mechanism-evaluation apparatus**: prompt-level calibration, critic-mediated error correction, and guard-level conduct controls are made inspectable through logged traces, formal worlds, ablations, and failure-mode classifications.

The safest revised framing is therefore:

> We reimplement classic ITS commitments inside an open-ended LLM-agent tutor, then add guard-level ablations and engineered trace analysis to test which controls move which failure modes.

That language preserves the paper's empirical core: calibration and error correction are supported; recognition-modulated adaptive responsiveness is not; formal derivation results are formal outcomes, not human learning outcomes.

---

## 1. Recommended structural change to Section 2

The present Section 2 already covers AI tutoring, multiagent design, LLM-as-judge evaluation, recognition theory, process tracing, and mechanism-oriented AI research. I recommend reorganizing it into the following sequence:

1. **Classic ITS and adaptive instructional systems**: model tracing, knowledge tracing, constraint-based modeling, step-level feedback, mastery gating.
2. **Dialogue, scaffolding, and productive struggle**: AutoTutor, ICAP, productive failure, feedback timing.
3. **LLM tutoring and LLM-agent education systems**: GenMentor, Ruffle&Riley, TutorGym, preference-optimized tutorbots, field experiments on guardrailed vs unguardrailed AI tutoring.
4. **Simulated learners and evaluation validity**: limits of LLM-simulated students, teacher evaluations of simulated learners, BEA pedagogical-evaluation work.
5. **Multiagent critique and self-correction**: Reflexion, Constitutional AI, Kamoi et al.'s self-correction survey, and the distinction between internal self-critique and reliable external feedback.
6. **LLM-as-judge and measurement risk**: MT-Bench/Chatbot Arena, position/verbosity/self-enhancement bias, scoring-bias work, and the need for human expert validation.
7. **Formal proof tutors and theorem-prover feedback**: Deep Thought, Logax, LeanTutor, and LLM + formal checker designs.
8. **Process tracing and engineered traces**: Bennett & Checkel, Beach & Pedersen, causal-process language, and why “engineered trace analysis” may be the more defensible label.
9. **Recognition, relational pedagogy, and intersubjective orientation**: Hegel/Honneth/Freire/Buber/Noddings/constructivism as theoretical frame, not as an unsupported claim of machine mutual recognition.
10. **Positioning statement**: novelty, non-novelty, and non-claims.

This order puts the closest technical antecedents first. That will make the novelty claim more credible because the paper will be seen to know what it is *not* claiming.

---

## 2. Drop-in replacement draft for Section 2

### 2.1 Classic ITS and adaptive instructional systems

Intelligent Tutoring Systems (ITS) have long treated instruction as a stateful control problem. Early cognitive tutors were built around computational models capable of solving the same tasks as students and using those models to provide immediate, step-level feedback. Anderson, Corbett, Koedinger, and Pelletier's account of Cognitive Tutors describes tutor construction around ACT production-system models of student problem solving, with empirical work showing achievement gains and emphasizing short, directed feedback at the point of error [@anderson1995cognitive]. Corbett and Anderson's Bayesian knowledge tracing similarly models the changing probability that a learner has mastered each rule and uses those estimates to select individualized practice [@corbett1995knowledge]. Constraint-based modeling provides a related alternative: rather than tracing a full ideal solution path, it detects violations of domain constraints and uses those violations to guide feedback [@mitrovic2012constraint].

This lineage matters because several mechanisms studied here have clear ITS ancestors. Release pacing resembles step-level scaffolding and feedback timing; proof-debt repair resembles model-state repair, common-ground repair, or constraint repair; and the proof checker resembles the domain model against which student work is evaluated. Meta-analytic work also gives the broader context: ITS can improve learning relative to many non-ITS controls, but effectiveness depends on implementation quality, outcome alignment, and control condition [@ma2014its; @kulik2016its]. VanLehn's review complicates simple claims about tutoring granularity, showing that the relative advantage of human tutoring, ITS, and other tutoring systems is smaller and more context-dependent than the classic “2 sigma” narrative suggests [@vanlehn2011relative; @bloom1984two].

**Positioning implication.** The paper should not claim that state, scaffolding, model tracing, or mastery gating are new. The defensible claim is that the project ports these commitments into open-ended LLM tutoring and makes them ablatable at the level of tutor conduct: what was once embedded in authored ITS logic becomes a guardable, logged, failure-mode-sensitive control loop over generative dialogue.

### 2.2 Dialogue, scaffolding, and productive struggle

The project's strongest pedagogical commitments also have learning-sciences antecedents. ICAP predicts that learning increases as engagement moves from passive to active, constructive, and interactive modes [@chi2014icap]. Productive failure argues that learners may benefit from attempting complex problems before receiving canonical instruction, because struggle can prepare later learning [@kapur2008productive]. AutoTutor and Affective AutoTutor show a long history of natural-language tutoring systems that respond to learner confusion, emotion, and engagement through dialogue [@dmello2012autotutor].

The dramatic-derivation results should be read against this background. The pacing guard is not merely a technical scheduler; it is a formalized version of an old pedagogical question: when should the tutor withhold, wait, repair, or advance? The added value of the project is not the discovery that timing matters. It is the formal apparatus that turns timing into an auditable release calendar over a proof DAG, with specific failure classes such as early-pull death, decay-starvation, and grounded recognition.

**Suggested sentence to add.** “Our pacing guard should therefore be understood as a formalized, testable instance of well-timed scaffolding rather than as a novel pedagogical principle; its novelty lies in making the release decision mechanically inspectable in an LLM tutor.”

### 2.3 LLM tutoring and LLM-agent educational systems

Recent LLM tutoring systems increasingly combine generative dialogue with explicit learner modeling, agent specialization, or external optimization. GenMentor decomposes goal-oriented tutoring into a multi-agent framework for goal-to-skill mapping, learner profiling, path scheduling, and content tailoring [@wang2025genmentor]. Ruffle&Riley uses two LLM-based agents in a learning-by-teaching conversational tutoring format, showing positive engagement and perceived support while finding limited short-term learning gains over reading controls [@schmucker2024ruffle]. Scarlatos et al. train LLM tutor utterances with direct preference optimization using predicted student correctness and a pedagogical rubric, showing that tutor outputs can be optimized for student-response correctness while maintaining pedagogical quality [@scarlatos2025training]. TutorGym places AI tutor and student agents inside existing ITS environments and tests whether agents can supply examples, hints, correctness feedback, or learner actions in step-based tutoring contexts [@weitekamp2025tutorgym].

These systems show that the field is moving from generic chatbot tutoring toward structured tutoring agents, but they leave a gap that this paper can occupy. GenMentor and Ruffle&Riley are primarily system designs; preference-optimized tutorbots are primarily outcome-optimization designs; TutorGym is a benchmarking environment. The present paper's niche is mechanism cartography: prompt calibration, critic loops, and conduct guards are treated as separable interventions whose effects can be traced through revisions, scores, and failure-mode shifts.

The literature on real student outcomes also urges caution. Bastani et al.'s high-school math field experiment shows that access to generative AI can improve assisted performance, but unguardrailed use can harm later unassisted learning, while pedagogical guardrails mitigate that risk [@bastani2025guardrails]. This directly supports the paper's design intuition: the important question is not whether AI gives better answers during use, but whether the interaction preserves the learner's work.

**Suggested sentence to add.** “Relative to recent LLM tutoring systems, our contribution is not another multi-agent tutor architecture alone, but a mechanism-evaluation harness that asks which architectural controls move which failure modes.”

### 2.4 Simulated learners and evaluation validity

Because the current experiments use synthetic learners and LLM judges, the literature review should foreground the validity risks. Recent work on simulated students warns that simple LLM prompting often produces weak simulations of human learners. Scarlatos et al.'s 2026 study formally evaluates simulated students across linguistic, behavioral, and cognitive metrics and finds that prompting strategies perform poorly, while supervised fine-tuning and preference optimization improve but remain limited [@scarlatos2026simulated]. Martynova et al.'s BEA 2025 teacher study identifies authenticity problems in LLM-simulated students, including high language complexity, lack of emotion, unnatural attentiveness, and logical inconsistency [@martynova2025simulate].

This is central to the paper's claim boundary. The present results show effects on tutor output quality and formal derivation outcomes. They do not establish that human learners learn more. Synthetic learners can be useful for controlled mechanism tests, but they are not substitutes for human pretest/posttest/transfer evidence.

**Suggested sentence to add.** “We therefore treat synthetic learners as controlled interaction probes, not as evidence of human learning. Human learning remains a separate validation target.”

### 2.5 Multiagent critique, self-correction, and external feedback

The ego/superego architecture belongs in the broader literature on self-correction, verbal reflection, and AI critique. Reflexion shows that language agents can improve across trials by storing verbal feedback in an episodic memory buffer [@shinn2023reflexion]. Constitutional AI demonstrates critique-and-revision under explicit principles and AI feedback [@bai2022constitutional]. But the self-correction literature has become skeptical of ungrounded intrinsic critique: Kamoi et al.'s TACL survey concludes that prompted self-correction generally lacks evidence of success without reliable external feedback, except in special tasks or fine-tuning settings [@kamoi2024selfcorrection].

This sharpens the interpretation of the superego. The paper should avoid saying the superego is automatically “external feedback” in the strong sense. It is a separate prompt context with different evaluative criteria; it is structurally external to the ego's immediate generation, but not necessarily externally grounded in the way a theorem prover, answer key, human expert, or simulator would be. The most valuable next ablation is therefore a critic-source ladder: no critic, same-model self-critique, same-model separate superego, different-model critic, mechanical/domain oracle critic, and human/expert critic.

**Suggested sentence to add.** “The superego is best described as structured critic feedback, with externality varying by critic source; whether it functions like reliable external feedback remains an empirical question.”

### 2.6 LLM-as-judge and measurement risk

The use of LLMs as judges is now common but requires careful calibration. Zheng et al.'s MT-Bench and Chatbot Arena work found that strong LLM judges can approximate human preferences while also documenting position, verbosity, self-enhancement, and reasoning limitations [@zheng2023llmjudge]. Later work continues to document position and scoring biases in LLM judges [@shi2025positionbias].

The paper already mitigates this risk through multiple judges and within-judge comparisons. The literature review should make that mitigation more explicit while retaining the limitation: cross-judge agreement on factorial-level effects does not validate LLM-generated process taxonomies. Superego critique categories, revision-substance labels, and process-level interpretations need human expert validation.

**Suggested sentence to add.** “Multi-judge replication supports the direction of the main factorial effects, but process-level categories remain LLM-assessed claims about LLM behavior until validated against human expert coding.”

### 2.7 Formal proof tutors, theorem proving, and proof-state feedback

The formal derivation arc should be placed beside proof tutors and theorem-prover-assisted tutoring. Deep Thought is an intelligent tutor for deductive logic proof practice, and subsequent work uses data-driven methods to generate hints and proof problems [@barnes2008hintfactory; @mostafavi2016deepthought]. Logax provides hints and feedback for Hilbert-style propositional logic proofs by generating and comparing proofs [@lodder2020logax]. LeanTutor combines LLM interaction with Lean verification, including autoformalization, proof checking, next-step generation, and natural-language feedback [@patel2025leantutor].

These are close antecedents to any claim about proof-state tutoring. The paper's distinction is that its dramatic-derivation world is not primarily a deployed proof tutor. It is a conduct-governance testbed: the secret proof path, release calendar, decay/corruption channels, visible/page-state proxy, and hidden proof-state guard are designed to ask whether LLM tutor behavior can be constrained without leaking the target derivation.

**Suggested sentence to add.** “Compared with proof tutors that check student proofs and generate next-step hints, our formal worlds are designed less as instructional interfaces and more as mechanism laboratories for LLM tutor conduct.”

### 2.8 Process tracing and engineered trace analysis

The paper currently says it adapts process tracing from comparative politics. That is plausible but should be narrowed. Bennett and Checkel define process tracing as a method for developing and assessing theories about causal mechanisms within cases [@bennett2015process]. Beach and Pedersen similarly frame it as the study of causal mechanisms linking causes with outcomes [@beach2019process]. The analogy works because the architecture logs prompt context, ego drafts, superego critiques, ego revisions, delivered outputs, and scores.

The risk is that LLM deliberation text is not a human decision record and not a neural mechanism. It is an engineered artifact produced by the same generative system under study. I recommend adopting the phrase **engineered trace analysis** in the literature review, with process tracing as the methodological inspiration.

**Suggested replacement sentence.** “We use process tracing as a methodological inspiration, but our evidence is better described as engineered trace analysis: the system is built to emit intermediate artifacts whose relationship to final behavior can be coded, ablated, and cross-checked.”

### 2.9 Recognition, relational pedagogy, and intersubjective orientation

The paper's recognition-theory framing is intellectually distinctive, but the literature review should not imply that Hegelian vocabulary is the unique active ingredient. The A10/A10b results already push toward a family-level interpretation: intersubjective or constructivist pedagogical orientation reproduces the recognition effect, while behaviorist/transmission prompts do not. The review should therefore connect recognition to relational pedagogy and constructivist traditions without making a genealogical claim stronger than the evidence can bear.

The strongest vocabulary is **intersubjective pedagogical orientation**: the tutor treats the learner's contribution as an active object of response, not as noise on the way to content delivery. Recognition theory is useful because it makes that stance philosophically explicit. The empirical claim, however, concerns observable tutor behavior: more calibrated output, fewer floor failures, more elicitation, and better critique/revision patterns.

**Suggested sentence to add.** “Recognition theory functions here as the clearest philosophical articulation of an intersubjective pedagogical orientation; the empirical claim is that prompts operationalizing that orientation change tutor production, not that the model literally achieves mutual recognition.”

### 2.10 Final positioning paragraph

Add this paragraph at the end of Section 2:

> Across these literatures, the control principles we study have strong antecedents: ITS provides model tracing, knowledge tracing, constraint repair, step-level scaffolding, and mastery gating; learning sciences provide productive struggle, dialogic engagement, and feedback-timing theory; proof tutors provide formal checking and hint generation; LLM-agent work provides critique/revision and multi-agent specialization. Our contribution is therefore not that these principles are pedagogically new. It is that we make them **experimentally isolable inside an LLM tutor**. The apparatus records how prompts, critics, guards, and proof-state proxies change generated tutor conduct and which failure classes remain. This lets us replace broad claims that a tutor is “adaptive” with narrower claims about which control mechanism moved which failure mode under which domain, model, judge, and world assumptions.

---

## 3. Citation audit: references to add or strengthen

| Area | Add / strengthen | Why it matters |
|---|---|---|
| Cognitive tutors | Anderson et al. 1995 | Closest precedent for model-based tutoring and immediate step-level feedback. |
| Knowledge tracing | Corbett & Anderson 1995 | Closest precedent for mastery estimates and stateful learner modeling. |
| Constraint repair | Mitrovic 2012 / Ohlsson 1994 if available | Closest vocabulary for proof-debt repair as missing/violated constraint repair. |
| ITS effectiveness | Ma et al. 2014; Kulik & Fletcher 2016 | Prevents inflated novelty and situates learning-outcome claims. |
| Tutoring granularity | VanLehn 2011 | Provides step/substep granularity framing for pacing and feedback timing. |
| Productive struggle | Kapur 2008; Chi & Wylie 2014 | Anchors recognition prompts in established learning-sciences mechanisms. |
| AutoTutor | D'Mello & Graesser 2012 | Closest natural-language dialogic tutoring antecedent. |
| LLM tutoring systems | GenMentor; Ruffle&Riley; Scarlatos et al.; TutorGym | Shows current LLM-tutor landscape and differentiates mechanism cartography. |
| Field outcomes | Bastani et al. 2025 | Supports guardrails-over-answering rationale with human field evidence. |
| Simulated learners | Scarlatos et al. 2026; Martynova et al. 2025 | Forces explicit synthetic-learner validity boundary. |
| Self-correction | Kamoi et al. 2024; Shinn et al. 2023; Bai et al. 2022 | Clarifies what the superego is and is not. |
| LLM judging | Zheng et al. 2023; Shi et al. 2025 | Supports multi-judge design and human-validation caveats. |
| Proof tutors | LeanTutor; Deep Thought; Logax | Positions formal derivation against proof-tutor antecedents. |
| Process tracing | Bennett & Checkel 2015; Beach & Pedersen 2019 | Supports but narrows the process-tracing analogy. |

---

## 4. Suggested BibTeX additions

These are draft entries. Normalize keys and metadata against the existing `references.bib` before committing.

```bibtex
@article{anderson1995cognitive,
  title={Cognitive Tutors: Lessons Learned},
  author={Anderson, John R. and Corbett, Albert T. and Koedinger, Kenneth R. and Pelletier, Ray},
  journal={The Journal of the Learning Sciences},
  volume={4},
  number={2},
  pages={167--207},
  year={1995},
  doi={10.1207/s15327809jls0402_2},
  url={https://www.jstor.org/stable/1466690}
}

@article{corbett1995knowledge,
  title={Knowledge Tracing: Modeling the Acquisition of Procedural Knowledge},
  author={Corbett, Albert T. and Anderson, John R.},
  journal={User Modeling and User-Adapted Interaction},
  volume={4},
  pages={253--278},
  year={1995},
  doi={10.1007/BF01099821},
  url={https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/893CorbettAnderson1995.pdf}
}

@article{vanlehn2011relative,
  title={The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems},
  author={VanLehn, Kurt},
  journal={Educational Psychologist},
  volume={46},
  number={4},
  pages={197--221},
  year={2011},
  doi={10.1080/00461520.2011.611369},
  url={https://eric.ed.gov/?id=EJ946764}
}

@article{ma2014its,
  title={Intelligent Tutoring Systems and Learning Outcomes: A Meta-Analysis},
  author={Ma, Wenting and Adesope, Olusola O. and Nesbit, John C. and Liu, Qing},
  journal={Journal of Educational Psychology},
  volume={106},
  number={4},
  pages={901--918},
  year={2014},
  doi={10.1037/a0037123},
  url={https://www.apa.org/pubs/journals/features/edu-a0037123.pdf}
}

@article{kulik2016its,
  title={Effectiveness of Intelligent Tutoring Systems: A Meta-Analytic Review},
  author={Kulik, James A. and Fletcher, J. D.},
  journal={Review of Educational Research},
  volume={86},
  number={1},
  pages={42--78},
  year={2016},
  doi={10.3102/0034654315581420},
  url={https://www.ida.org/research-and-publications/publications/all/e/ef/effectiveness-of-intelligent-tutoring-systems-a-meta-analytic-review}
}

@article{chi2014icap,
  title={The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes},
  author={Chi, Michelene T. H. and Wylie, Ruth},
  journal={Educational Psychologist},
  volume={49},
  number={4},
  pages={219--243},
  year={2014},
  doi={10.1080/00461520.2014.965823},
  url={https://files.eric.ed.gov/fulltext/EJ1044018.pdf}
}

@article{kapur2008productive,
  title={Productive Failure},
  author={Kapur, Manu},
  journal={Cognition and Instruction},
  volume={26},
  number={3},
  pages={379--424},
  year={2008},
  doi={10.1080/07370000802212669},
  url={https://eric.ed.gov/?id=EJ800999}
}

@article{dmello2012autotutor,
  title={AutoTutor and Affective AutoTutor: Learning by Talking with Cognitively and Emotionally Intelligent Computers that Talk Back},
  author={D'Mello, Sidney and Graesser, Art},
  journal={ACM Transactions on Interactive Intelligent Systems},
  volume={2},
  number={4},
  year={2012},
  doi={10.1145/2395123.2395128},
  url={https://dl.acm.org/doi/10.1145/2395123.2395128}
}

@misc{wang2025genmentor,
  title={LLM-powered Multi-agent Framework for Goal-oriented Learning in Intelligent Tutoring System},
  author={Wang, Tianfu and Zhan, Yi and Lian, Jianxun and Hu, Zhengyu and Yuan, Nicholas Jing and Zhang, Qi and Xie, Xing and Xiong, Hui},
  year={2025},
  eprint={2501.15749},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2501.15749}
}

@misc{schmucker2024ruffle,
  title={Ruffle\&Riley: Insights from Designing and Evaluating a Large Language Model-Based Conversational Tutoring System},
  author={Schmucker, Robin and Xia, Meng and Azaria, Amos and Mitchell, Tom},
  year={2024},
  eprint={2404.17460},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2404.17460}
}

@misc{scarlatos2025training,
  title={Training LLM-based Tutors to Improve Student Learning Outcomes in Dialogues},
  author={Scarlatos, Alexander and Liu, Naiming and Lee, Jaewook and Baraniuk, Richard and Lan, Andrew},
  year={2025},
  eprint={2503.06424},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2503.06424}
}

@misc{weitekamp2025tutorgym,
  title={TutorGym: A Testbed for Evaluating AI Agents as Tutors and Students},
  author={Weitekamp, Daniel and Siddiqui, Momin N. and MacLellan, Christopher J.},
  year={2025},
  eprint={2505.01563},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2505.01563}
}

@article{bastani2025guardrails,
  title={Generative AI without Guardrails Can Harm Learning: Evidence from High School Mathematics},
  author={Bastani, Hamsa and Bastani, Osbert and Sungu, Alp and Ge, Haosen and Kabakci, Ozge and Mariman, Rei},
  journal={Proceedings of the National Academy of Sciences},
  year={2025},
  doi={10.1073/pnas.2422633122},
  url={https://www.pnas.org/doi/10.1073/pnas.2422633122}
}

@misc{scarlatos2026simulated,
  title={Simulated Students in Tutoring Dialogues: Substance or Illusion?},
  author={Scarlatos, Alexander and Lee, Jaewook and Woodhead, Simon and Lan, Andrew S.},
  year={2026},
  eprint={2601.04025},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2601.04025}
}

@inproceedings{martynova2025simulate,
  title={Can LLMs Effectively Simulate Human Learners? Teachers' Insights from Tutoring LLM Students},
  author={Martynova, Daria and Macina, Jakub and Daheim, Nico and Yalcin, Nilay and Zhang, Xiaoyu and Sachan, Mrinmaya},
  booktitle={Proceedings of the 20th Workshop on Innovative Use of NLP for Building Educational Applications},
  year={2025},
  url={https://aclanthology.org/2025.bea-1.8/}
}

@article{kamoi2024selfcorrection,
  title={When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey of Self-Correction of LLMs},
  author={Kamoi, Ryo and Zhang, Yusen and Zhang, Nan and Han, Jiawei and Zhang, Rui},
  journal={Transactions of the Association for Computational Linguistics},
  volume={12},
  year={2024},
  doi={10.1162/tacl_a_00713},
  url={https://aclanthology.org/2024.tacl-1.78/}
}

@misc{shinn2023reflexion,
  title={Reflexion: Language Agents with Verbal Reinforcement Learning},
  author={Shinn, Noah and Cassano, Federico and Berman, Edward and Gopinath, Ashwin and Narasimhan, Karthik and Yao, Shunyu},
  year={2023},
  eprint={2303.11366},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2303.11366}
}

@misc{bai2022constitutional,
  title={Constitutional AI: Harmlessness from AI Feedback},
  author={Bai, Yuntao and others},
  year={2022},
  eprint={2212.08073},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2212.08073}
}

@inproceedings{zheng2023llmjudge,
  title={Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena},
  author={Zheng, Lianmin and Chiang, Wei-Lin and Sheng, Ying and others},
  booktitle={Advances in Neural Information Processing Systems},
  year={2023},
  url={https://arxiv.org/abs/2306.05685}
}

@inproceedings{shi2025positionbias,
  title={Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge},
  author={Shi, Lin and Ma, Chiyu and Liang, Wenhua and Diao, Xingjian and Ma, Weicheng and Vosoughi, Soroush},
  booktitle={Proceedings of IJCNLP-AACL},
  year={2025},
  url={https://aclanthology.org/2025.ijcnlp-long.18/}
}

@misc{patel2025leantutor,
  title={LeanTutor: A Formally-Verified AI Tutor for Mathematical Proofs},
  author={Patel, Manooshree and Bhattacharyya, Rayna and Lu, Thomas and Mehta, Arnav and Voss, Niels and Norouzi, Narges and Ranade, Gireeja},
  year={2025},
  eprint={2506.08321},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2506.08321}
}

@article{lodder2020logax,
  title={Generation and Use of Hints and Feedback in a Hilbert-Style Axiomatic Proof Tutor},
  author={Lodder, Josje and Heeren, Bastiaan and Jeuring, Johan},
  journal={International Journal of Artificial Intelligence in Education},
  year={2020},
  doi={10.1007/s40593-020-00222-2},
  url={https://link.springer.com/article/10.1007/s40593-020-00222-2}
}

@book{bennett2015process,
  title={Process Tracing: From Metaphor to Analytic Tool},
  editor={Bennett, Andrew and Checkel, Jeffrey T.},
  publisher={Cambridge University Press},
  year={2015},
  doi={10.1017/CBO9781139858472},
  url={https://www.cambridge.org/core/books/process-tracing/5BBC24CBF2E89114817741D0476C07A9}
}

@book{beach2019process,
  title={Process-Tracing Methods: Foundations and Guidelines},
  author={Beach, Derek and Pedersen, Rasmus Brun},
  publisher={University of Michigan Press},
  edition={2},
  year={2019},
  url={https://pure.au.dk/portal/en/publications/process-tracing-methods-foundations-and-guidelines-2/}
}
```

---

## 5. Claims and wording to avoid

Avoid:

- “We introduce adaptive tutoring.”
- “The system models the learner's mind.”
- “Visible pacing proves hidden learner state is unnecessary.”
- “Proof-debt repair is established as an isolated mechanism.”
- “LLM judge quality scores demonstrate learning.”
- “Recognition theory is uniquely responsible for the effect.”

Prefer:

- “We study adaptive tutoring as conduct governance over a stateful task representation.”
- “The system tracks released, seated, lost, and corrupted task material.”
- “Visible pacing matched hidden proof-state pacing on the lantern world, where visible uptake tracked latent proof distance.”
- “Proof-debt repair is demonstrated as a stacked-arm repair, not yet isolated.”
- “Current evidence concerns tutor output quality, synthetic interaction, and formal derivation outcomes.”
- “Recognition theory articulates an intersubjective pedagogical orientation whose operationalization is shared with cognate constructivist/dialogic traditions.”

---

## 6. One-paragraph replacement for the novelty claim

> This paper contributes a mechanism-evaluation apparatus for LLM tutoring. Classic ITS already supplies stateful domain models, learner modeling, step-level scaffolding, knowledge tracing, constraint repair, and mastery gating; learning sciences already supply productive struggle, interactivity, and feedback-timing theories; proof tutors already pair formal checking with hints and feedback; and LLM-agent work already explores critic/revision loops. Our contribution is to make these commitments ablatable inside an open-ended LLM tutor. Prompt calibration, critic-mediated error correction, and guard-level conduct controls are logged as engineered traces and evaluated by their effect on specific failure modes. The resulting claim is deliberately narrow: adaptive tutelage can be studied as a guardable control problem over a stateful pedagogical task representation, while human learning, cross-domain generality, and long-term transfer remain open empirical questions.
