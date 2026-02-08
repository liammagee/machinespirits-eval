# Novelty Assessment & Literature Deep Dive

**Goal**: Determine exactly where our contribution sits in the literature, what we're building on, and what is genuinely novel. Update references.bib and Related Work accordingly.

---

## 1. Novelty Map: What's Ours vs. What Exists

### 1.1 Genuinely Novel (No Direct Precedent Found)

**A. Empirical operationalization of Honneth's recognition theory in AI tutoring.**
No paper was found that applies recognition theory to AI tutoring systems with empirical measurement. Recognition theory has been applied to education theoretically (Bingham 2004, Huttunen 2007, Stojanov 2018, Fleming on transformative learning, Hanhela) but never operationalized as prompt design heuristics for LLM tutors with controlled evaluation. This is the paper's strongest novelty claim.

**B. "Intersubjective prompts" as a prompting paradigm.**
Existing prompt engineering focuses on persona/behavioral specifications (what the agent does). Our prompts specify agent-other relations (who the learner is, what the interaction produces). No precedent found for this relational framing of prompt design. Constitutional AI (Bai et al. 2022) is the closest — principles that constrain behavior — but those are self-referential, not intersubjective.

**C. Connecting sycophancy to recognition theory.**
Sycophancy research is booming (Shapira et al. 2026, Vennemeyer et al. 2025, ELEPHANT 2025, SycEval 2025) but treats it as an alignment/training problem. We uniquely frame sycophancy as a recognition failure — hollow validation that mirrors Hegel's master-slave dynamic. The SIAI memo (2025) comes closest, framing sycophancy as a "teaching risk," but doesn't connect to recognition theory.

**D. Memory isolation experiment design.**
The 2x2 (Recognition x Memory) orthogonal manipulation isolating prompt content from system architecture is methodologically novel in LLM tutoring evaluation.

### 1.2 Independently Convergent (Others Arrived Nearby)

**E. Ego/Superego architecture for LLM agents.**
Kim et al. (2025, *Cognitive Systems Research*) directly maps Freud's ego/id/superego onto LLM consciousness modules with MBTI personality. Constitutional AI (Bai et al. 2022) implements an "inner critic" without the psychoanalytic framing. The DiriGent framework (Chen et al. 2025, ETH) uses role-based ideal worlds encoding values. Madaan et al. (2023) Self-Refine is the engineering precedent.

*Our distinction*: We use ego/superego specifically for **relational quality control** (does this achieve recognition?), not task accuracy or safety. Others use internal critique for factual correctness, harmlessness, or planning quality.

**F. Hegelian dialectic applied to LLM reasoning.**
Abdali et al. (2025, Microsoft Research) apply thesis-antithesis-synthesis to LLM self-reflection for scientific reasoning and math. SocraSynth (Chang 2024, Stanford) uses Socratic debate with adjustable contentiousness.

*Our distinction*: We apply Hegel's *recognition theory* (intersubjective, relational), not his *dialectical method* (logical, propositional). These are different aspects of Hegel's work. Abdali uses dialectic as a reasoning procedure; we use recognition as a pedagogical stance.

**G. Multi-agent tutoring architectures.**
GenMentor (Wang et al. 2025, WWW), Ruffle&Riley (Schmucker et al. 2024, AIED), A-HMAD (2025) all use multiple agents for tutoring. LLM Agents for Education survey (Chu et al. 2025, EMNLP Findings) covers the field comprehensively.

*Our distinction*: Other multi-agent tutoring systems decompose tasks (gap identification, profiling, feedback). Our architecture implements **internal dialogue** — the Superego evaluates the Ego's relational quality before it reaches the learner. This is a critique loop, not a task pipeline.

**H. Psychoanalytic readings of LLMs.**
Active field: Black & Johanssen (2025) on Lacan and ChatGPT, Heimann & Hubener (2025) on Heidegger/Lacan, Possati (2021, 2023) on the algorithmic unconscious, Millar (2021) on AI jouissance, Zupancic (2025) on language of the unconscious.

*Our distinction*: Most psychoanalytic-AI work is **interpretive** (what does AI mean philosophically?). We are **constructive** (we built a system using psychoanalytic architecture and measured the results). The gap between interpretation and engineering is our contribution.

### 1.3 Well-Established (We Build Upon)

- Productive failure / productive struggle (Kapur 2008, Warshauer 2015)
- Constructivist pedagogy (Piaget, Vygotsky ZPD)
- ITS foundations (SCHOLAR, SOPHIE, knowledge tracing)
- Prompt engineering (chain-of-thought, few-shot, persona)
- LLM sycophancy (Anthropic alignment papers)
- Multi-agent debate for accuracy (Irving 2018)

---

## 2. Literature Gaps to Fill

### 2.1 HIGH PRIORITY — Directly Impacts Core Claims

| Gap | What to Add | Why It Matters |
|-----|-------------|----------------|
| **Relational pedagogy** | hooks (Teaching to Transgress), Freire (Pedagogy of the Oppressed, Pedagogy of Freedom), Buber (I and Thou), Noddings (Caring: A Relational Approach to Ethics) | Paper claims "relational dimension has received less systematic attention" — needs the actual relational pedagogy literature to show what exists and what we extend |
| **Recognition theory in education** | Bingham (2004, "Teaching and the Dialectic of Recognition"), Fleming (Honneth + transformative learning), Hanhela (educational perspectives on recognition), Shaping Inclusive Approaches (2025, Honneth in classroom) | Only 2 refs currently (Huttunen, Stojanov). Bingham 2004 is foundational and directly relevant |
| **Psychoanalytic-AI convergence** | Kim et al. 2025 (ego/superego LLM consciousness), Black & Johanssen 2025 (Lacan + ChatGPT), Possati 2021/2023 (algorithmic unconscious), Millar 2021 (psychoanalysis of AI) | Magee et al. "Structured" is cited but the broader field needs mapping. Kim et al. is an independent convergence that validates the approach |
| **Hegelian dialectic in AI** | Abdali et al. 2025 (Microsoft, dialectical self-reflection), Hui 2020 (Philosophy in Light of AI: Hegel or Leibniz) | Must distinguish our use of recognition (intersubjective) from their use of dialectic (logical method) |
| **Sycophancy in education** | SIAI memo 2025 ("AI Sycophancy Is a Teaching Risk"), Shapira et al. 2026 (RLHF amplifies sycophancy), Vennemeyer et al. 2025 (causal separation of sycophantic behaviors) | Paper claims sycophancy is "particularly pernicious" in education but currently cites only general alignment papers |
| **Multi-agent tutoring SOTA** | GenMentor (WWW 2025), Ruffle&Riley (AIED 2024), LLM Agents for Education survey (EMNLP Findings 2025) | Related Work cites wu2023 (AutoGen) and irving2018 only. The field has advanced significantly |

### 2.2 MEDIUM PRIORITY — Adds Depth

| Gap | What to Add | Why |
|-----|-------------|-----|
| **Bildung + AI** | "Generative AI in Education: Are We Thinking?" (2025, Learning Media & Technology) | Connects German educational philosophy to GenAI; validates our Bildung framing |
| **Self-critique architectures** | Constitutional AI (Bai et al. 2022), "Lighthouse of Language" (2025), "Intrinsic Self-Critique" (2025) | Engineering precedents for our Superego; currently only cite Madaan 2023 |
| **Psychology + LLMs survey** | "The Mind in the Machine" (2025, Columbia, 175 papers reviewed) | Comprehensive survey positioning psychoanalytic approaches within broader psychology-LLM landscape |
| **Learner autonomy** | Knowles (andragogy), Garrison & Anderson (self-regulated learning) | Theoretical basis for why recognition should improve learner outcomes |
| **Dialogue tutoring** | Chi & Menekse (tutee learning from explanation), Mills et al. | Why multi-turn matters for recognition |

### 2.3 LOW PRIORITY — Completeness

| Gap | What to Add | Why |
|-----|-------------|-----|
| **Lacan + LLMs specifically** | Heimann & Hubener 2025 (Heidegger/Lacan + LLMs), "Digital Unconscious in Age of ChatGPT" (2025) | Distinguishes our Freudian framing from Lacanian approaches |
| **AI in therapeutic settings** | "AI and Psychoanalysis: Psychoanalyst.AI?" (Frontiers 2025) | Parallel application domain (therapy vs education) |
| **Intersubjectivity in HCI** | Borghoff et al. 2025 (system-theoretical approach) | Broader HCI context for our relational design |
| **Sycophancy measurement** | ELEPHANT (2025), SycEval (AIES 2025), "Challenging the Evaluator" (EMNLP Findings 2025) | Sycophancy benchmarks we could compare against |

---

## 3. Contribution Statement (Refined)

Based on the literature scan, the paper's contributions can be sharpened:

### What we claim now (and what literature says):

1. **"A theoretical framework connecting Hegelian recognition to AI pedagogy"**
   - *Literature check*: Bingham (2004) connects Hegel to pedagogy. Abdali et al. (2025) connect Hegel to AI. No one connects all three. **Valid claim, but must cite Bingham and Abdali to show we're bridging two existing literatures.**

2. **"A multi-agent architecture for implementing recognition in tutoring systems"**
   - *Literature check*: Multi-agent tutoring exists (GenMentor, Ruffle&Riley). Ego/superego AI exists (Kim et al. 2025). Internal critique exists (Constitutional AI, Self-Refine). No one uses multi-agent internal critique for *recognition quality*. **Valid but needs sharper positioning against GenMentor and Constitutional AI.**

3. **"Empirical evidence that recognition-oriented design improves tutoring outcomes"**
   - *Literature check*: No empirical precedent found. This is the strongest claim. **Unique.**

4. **"Intersubjective prompts — prompts that specify agent-other relations"**
   - *Literature check*: No precedent. Persona prompts specify agent identity. Constitutional prompts specify constraints. We specify the relational field. **Novel framing, should be highlighted more.**

### Suggested refined positioning:

> We contribute the first empirical operationalization of recognition theory in AI tutoring. While psychoanalytic readings of LLMs have proliferated (Black & Johanssen 2025; Possati 2021; Kim et al. 2025), these are primarily interpretive — analyzing what AI means philosophically. We take a constructive approach: building a system using psychoanalytic architecture and measuring its effects. While Hegelian dialectic has been applied to LLM reasoning (Abdali et al. 2025), and recognition theory has been applied to education (Bingham 2004; Fleming; Hanhela), no prior work bridges these to AI tutoring with empirical evaluation. Our "intersubjective prompts" extend the prompting paradigm from behavioral specification (what the agent does) to relational specification (who the learner is in the interaction).

---

## 4. Action Items

### 4.1 New .bib Entries Needed (~25 references)

**High priority (directly cited in revised Related Work):**
```
# Recognition theory in education
@article{bingham2004teaching,
  author = {Bingham, Charles},
  title = {Teaching and the Dialectic of Recognition},
  journal = {Pedagogy, Culture \& Society},
  volume = {12}, number = {2}, year = {2004}
}

@article{fleming_honneth_transformative,
  author = {Fleming, Ted},
  title = {Axel Honneth and the Struggle for Recognition: Implications for Transformative Learning}
}

# Psychoanalytic-AI convergence
@article{kim2025humanoid,
  author = {Kim, Sang Hun and Lee, Jongmin and Park, Dongkyu and Lee, So Young and Chong, Yosep},
  title = {Humanoid Artificial Consciousness Designed with Large Language Model Based on Psychoanalysis and Personality Theory},
  journal = {Cognitive Systems Research},
  volume = {94}, year = {2025}
}

@article{black2025subject,
  author = {Black, Jack and Johanssen, Jacob},
  title = {The Subject of AI: A Psychoanalytic Intervention},
  journal = {Theory, Culture \& Society},
  year = {2025}
}

@book{possati2021algorithmic,
  author = {Possati, Luca},
  title = {The Algorithmic Unconscious: How Psychoanalysis Helps in Understanding AI},
  publisher = {Routledge}, year = {2021}
}

@book{millar2021psychoanalysis,
  author = {Millar, Isabel},
  title = {The Psychoanalysis of Artificial Intelligence},
  publisher = {Palgrave Macmillan}, year = {2021}
}

# Hegel + AI
@article{abdali2025selfreflecting,
  author = {Abdali, Sara and Goksen, Can and Solodko, Michael and Amizadeh, Saeed and Maybee, Julie E. and Koishida, Kazuhito},
  title = {Self-reflecting Large Language Models: A Hegelian Dialectical Approach},
  journal = {arXiv preprint arXiv:2501.14917},
  year = {2025}
}

# Multi-agent tutoring SOTA
@inproceedings{wang2025genmentor,
  author = {Wang, ...},
  title = {GenMentor: LLM-powered Multi-agent Framework for Goal-oriented Learning in Intelligent Tutoring System},
  booktitle = {WWW 2025 (Industry Track)},
  year = {2025}
}

@inproceedings{schmucker2024ruffle,
  author = {Schmucker, Robin and others},
  title = {Ruffle\&Riley: Insights from Designing and Evaluating a Large Language Model-Based Conversational Tutoring System},
  booktitle = {AIED 2024}, year = {2024}
}

@inproceedings{chu2025llmagents,
  author = {Chu, Zhendong and Wang, Shen and others},
  title = {LLM Agents for Education: Advances and Applications},
  booktitle = {Findings of EMNLP 2025}, year = {2025}
}

# Sycophancy
@article{shapira2026rlhf,
  author = {Shapira, Itai and Benade, Gerdus and Procaccia, Ariel D.},
  title = {How RLHF Amplifies Sycophancy},
  journal = {arXiv preprint arXiv:2602.01002},
  year = {2026}
}

@misc{siai2025sycophancy,
  author = {{Swiss Institute of Artificial Intelligence}},
  title = {AI Sycophancy Is a Teaching Risk, Not a Feature},
  year = {2025},
  howpublished = {SIAI Memo}
}

# Self-critique architectures
@article{bai2022constitutional,
  author = {Bai, Yuntao and Kadavath, Saurav and others},
  title = {Constitutional AI: Harmlessness from AI Feedback},
  journal = {arXiv preprint arXiv:2212.08073},
  year = {2022}
}

# Bildung + AI
@article{gulz2025generativeai,
  title = {Generative Artificial Intelligence in Education: (What) Are We Thinking?},
  journal = {Learning, Media and Technology},
  year = {2025}
}

# Psychology + LLMs survey
@article{mind_in_machine_2025,
  title = {The Mind in the Machine: A Survey of Incorporating Psychological Theories in LLMs},
  journal = {arXiv preprint arXiv:2505.00003},
  year = {2025}
}

# Relational pedagogy
@book{buber1958,
  author = {Buber, Martin},
  title = {I and Thou},
  publisher = {Charles Scribner's Sons},
  year = {1958}
}

@book{noddings1984,
  author = {Noddings, Nel},
  title = {Caring: A Relational Approach to Ethics and Moral Education},
  publisher = {University of California Press},
  year = {1984}
}

@book{freire1970,
  author = {Freire, Paulo},
  title = {Pedagogy of the Oppressed},
  publisher = {Continuum},
  year = {1970}
}
```

### 4.2 Related Work Revisions

**Section 2.1 (AI Tutoring):**
- Add GenMentor, Ruffle&Riley, LLM Agents for Education survey as SOTA multi-agent tutoring
- Distinguish our internal-critique architecture from their task-pipeline architectures
- Add "Mind in the Machine" survey for broader context

**Section 2.2 (Prompt Engineering):**
- Add Constitutional AI as the closest precedent for "principled self-critique"
- Introduce "intersubjective prompts" as a new category (vs. persona, chain-of-thought, constitutional)

**Section 2.4 (Sycophancy):**
- Add Shapira et al. 2026 (causal mechanism), SIAI memo (educational framing)
- Connect sycophancy to recognition: sycophancy = failed recognition = master-slave dynamics

**Section 2.5 (AI Personality):**
- Add Kim et al. 2025 (independent convergence on ego/superego LLM architecture)
- Add Black & Johanssen 2025, Possati, Millar for psychoanalytic-AI landscape
- Note our constructive (engineering) vs their interpretive (philosophical) approach

**Section 2.7 (Recognition in Social Theory):**
- Add Bingham 2004 (recognition in pedagogy — foundational, currently missing!)
- Add Fleming (Honneth + transformative learning)
- Add Bildung + AI paper (2025) for contemporary connection

**New subsection or expanded 2.3 (Drama Machine):**
- Add Abdali et al. 2025 to distinguish dialectical method from recognition theory
- Note that Hegelian dialectic as logical procedure (Abdali) is distinct from Hegelian recognition as relational stance (us)

### 4.3 Positioning Paragraph (for Introduction or end of Related Work)

Draft a paragraph that explicitly maps the contribution space:

> Three literatures converge on this work without previously intersecting: (1) psychoanalytic readings of LLMs, which interpret AI through Freudian/Lacanian frameworks but do not build systems (Black & Johanssen 2025; Possati 2021; Millar 2021; Kim et al. 2025); (2) recognition theory in education, which applies Honneth to pedagogy but not to AI (Bingham 2004; Fleming; Huttunen 2007; Stojanov 2018); and (3) multi-agent tutoring architectures, which decompose tasks but do not evaluate relational quality (GenMentor 2025; Ruffle&Riley 2024; LLM Agents for Education 2025). We sit at the intersection: a constructive, empirically evaluated system that operationalizes recognition theory through psychoanalytically-inspired architecture.

### 4.4 Verification Steps

- [ ] Search Google Scholar directly for citation counts of "Structured like a Language Model" and "Drama Machine" papers
- [ ] Verify all new references have correct publication details (venue, DOI, page numbers)
- [ ] Check whether Bingham 2004 cites Honneth specifically (confirm the connection)
- [ ] Check whether Kim et al. 2025 cites Magee et al. 2023
- [ ] Read Abdali et al. 2025 abstract closely to confirm dialectic-vs-recognition distinction
- [ ] Confirm SIAI memo is citable (institutional publication vs blog post)
- [ ] Check if any of the sycophancy papers mention education/tutoring specifically

---

## 5. Summary: Where We Sit

```
                    INTERPRETIVE ←——————→ CONSTRUCTIVE
                         |                      |
  Psychoanalytic    Possati, Millar,       Kim et al. 2025
  AI readings       Black & Johanssen      (ego/superego LLM)
                         |                      |
                         |              ★ THIS PAPER ★
                         |              (recognition +
  Hegelian          Abdali et al.        architecture +
  AI applications   (dialectic as         empirical eval)
                     reasoning)                |
                         |                      |
  Recognition in    Bingham, Fleming,     [no precedent]
  education         Huttunen, Stojanov
                         |
  Multi-agent       GenMentor,            Constitutional AI
  tutoring          Ruffle&Riley          (self-critique)
```

The paper's unique position: **constructive + recognition + empirical** at the intersection of three literatures that have not previously met.
