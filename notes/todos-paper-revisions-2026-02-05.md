# Paper Revision TODOs — 2026-02-05

Based on ChatGPT critical review of PAPER-FULL-2026-02-04.md.
Text fixes applied directly to the paper are marked [DONE].
Remaining items require further work.

---

## Missing Bibliography Entries (29 citations)

The following citation keys appear in PAPER-FULL-2026-02-04.md but are NOT in
`paper-draft/references.bib`. These need bib entries added:

### Education / Pedagogy
- [ ] `brown1975` — Brown & Burton (1975) SOPHIE
- [ ] `carbonell1970` — Carbonell (1970) early ITS
- [ ] `corbett1995` — Corbett & Anderson (1995) knowledge tracing
- [ ] `kapur2008` — Kapur (2008) productive failure
- [ ] `piaget1954` — Piaget (1954) construction of reality
- [ ] `vygotsky1978` — Vygotsky (1978) mind in society / ZPD
- [ ] `warshauer2015` — Warshauer (2015) productive struggle in math

### AI / LLM
- [ ] `anthropic2024` — Anthropic (2024) — unclear which paper; likely Claude 3 system card or similar
- [ ] `brown2020` — Brown et al. (2020) GPT-3 / language models are few-shot learners
- [ ] `irving2018` — Irving et al. (2018) AI safety via debate
- [ ] `kasneci2023` — Kasneci et al. (2023) ChatGPT for good? On opportunities and challenges of LLMs for education
- [ ] `kojima2022` — Kojima et al. (2022) LLMs are zero-shot reasoners
- [ ] `madaan2023` — Madaan et al. (2023) self-refine
- [ ] `perez2022` — Perez et al. (2022) red teaming language models
- [ ] `sharma2023` — Sharma et al. (2023) — likely AI tutoring related
- [ ] `wei2022` — Wei et al. (2022) chain-of-thought prompting
- [ ] `wu2023` — Wu et al. (2023) — likely multi-agent or auto-gen related
- [ ] `zhou2020` — Zhou et al. (2020) — context unclear

### Philosophy / Recognition Theory
- [ ] `honneth1995` — Honneth (1995) Struggle for Recognition (NOTE: bib has `Honneth1996StruggleRecognition` — may just need key alias or paper key updated)
- [ ] `taylor1994` — Taylor (1994) politics of recognition
- [ ] `stojanov2018` — Stojanov (2018) education and recognition
- [ ] `huttunen2007` — Huttunen (2007) Hegel's recognition theory in education
- [ ] `freud1925` — Freud (1925) negation (NOTE: bib has `freud2022negation` — may need key alias)

### HCI / Social Presence
- [ ] `biocca2003` — Biocca et al. (2003) social presence
- [ ] `dmello2012` — D'Mello (2012) affect in tutoring
- [ ] `fraser2003` — Fraser (2003) — likely recognition/redistribution
- [ ] `volkel2021` — Völkel et al. (2021) personality in conversational agents
- [ ] `zhao2014` — Zhao et al. (2014) rapport in human-agent interaction

### Drama Machine
- [ ] `magee2024drama` — Magee (2024) Drama Machine (NOTE: bib has `MageeAroraGollingsLamSaw2024DramaMachine` — key mismatch)

### Near-matches already in bib (fix citation key in paper OR add alias)
- `honneth1995` → `Honneth1996StruggleRecognition` (in bib)
- `freud1925` → `freud2022negation` (in bib, different edition)
- `magee2024drama` → `MageeAroraGollingsLamSaw2024DramaMachine` (in bib)

---

## Experimental Changes Needed

### HIGH PRIORITY

- [ ] **A×B Interaction Replication** — The multi-agent synergy finding (+9.2 pts, N=17,
      Nemotron) was not replicated in the Kimi factorial (N=342). Run with Kimi + larger N:
      ```bash
      node scripts/eval-cli.js run \
        --profiles cell_5_recog_single_unified,cell_7_recog_multi_unified,cell_9_enhanced_single_unified,cell_11_enhanced_multi_unified \
        --scenarios struggling_learner,concept_confusion,mood_frustrated_explicit \
        --ego-model openrouter.kimi-k2.5 \
        --runs 5
      ```
      **Why it matters**: This is the paper's most provocative claim. Either confirms or
      forces further downgrade. Currently framed as "exploratory" in the text.

### MEDIUM PRIORITY

- [ ] **Memory Confound Isolation** — Memory is bundled with recognition. Add memory-only
      profiles (base prompts + memory, no recognition) and recognition-without-memory profiles.
      Would need new cells in tutor-agents.yaml + 2×2×2×2 factorial.
      **Why it matters**: Cleanly separates memory contribution from recognition theory.
      Currently acknowledged as limitation in Sections 5.3 and 8.1.

- [ ] **Domain Generalizability Model Confound** — Elementary uses Nemotron, philosophy uses
      Kimi. Re-run elementary with Kimi for consistent comparison:
      ```bash
      EVAL_CONTENT_PATH=./content-test-elementary \
      EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
      node scripts/eval-cli.js run \
        --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
        --ego-model openrouter.kimi-k2.5 \
        --runs 3
      ```

### LOW PRIORITY

- [ ] **Hardwired Rules Larger Sample** — Currently N=9 per condition (Haiku). Already
      framed as exploratory. Only needed if hardwired rules become a production feature.

- [ ] **Bilateral Transformation Larger Sample** — Currently N=20, single scenario. More
      scenarios + reps would narrow CIs but direction is clear.

---

## Text Fixes Applied [DONE]

- [x] Abstract — added sample sizes (N=36, N=17), noted memory confound, A×B as exploratory
- [x] Section 5.3 — memory confound acknowledgment added
- [x] Section 5.5/5.6 — N=360→342, df corrected, aggregation clarified
- [x] Section 5.1/6.8 — rubric weight normalization explained (114.9%→100%, non-standard=34.7%)
- [x] Section 5.4 — model consistency claim qualified (main effect consistent, interaction model-dependent)
- [x] Section 6.2 — table header N=342
- [x] Section 6.3 — "Critical Finding"→"Exploratory Finding", non-replication caveat
- [x] Section 6.4 — data source note, N corrected
- [x] Section 6.8 — Table 10 normalization explained
- [x] Section 6.10 — Transformation Quality structural bias noted
- [x] Section 7.2 — A×B reframed as hypothesis-generating
- [x] Section 8.1 — memory confound + model-dependent interaction in limitations
- [x] Section 9 — conclusion claims qualified
- [x] Appendix B.3 — command fixed to include recognition profiles
- [x] Appendix B.4 — command fixed to match actual run
- [x] Judge naming — corrected to "Claude Code" (not "Claude Sonnet 4.5")
- [x] Dialectical synthesis rate — N=455 added
- [x] Extended scenario table — small-sample caveat added
- [x] Latency — measurement conditions noted
- [x] Sample summary — N updated to 442

---

## Minor Remaining Paper Issues

- [ ] **Scenario naming inconsistency** — Section 5.2 uses `recognition_seeking_learner`,
      `returning_with_breakthrough`, `resistant_learner` but Section 6.9 uses
      `sustained_dialogue`, `breakdown_recovery`, `productive_struggle`,
      `mutual_transformation`. These are different scenario sets; add a note clarifying
      that 6.9 uses extended multi-turn scenarios distinct from the core set in 5.2.

- [ ] **Box-drawing characters in PDF** — ASCII art diagrams (Figures 3-5) use box-drawing
      characters that don't render in the monospace font. Consider replacing with simpler
      ASCII or converting to actual figures.

- [ ] **references.bib location** — The bib file is in `paper-draft/` but PAPER-FULL says
      `bibliography: references.bib`. Pandoc needs `--bibliography paper-draft/references.bib`
      or the bib should be copied/symlinked to the same directory.
