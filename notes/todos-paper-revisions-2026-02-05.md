# Paper Revision TODOs — 2026-02-05

Based on ChatGPT critical review of PAPER-FULL-2026-02-04.md.
Text fixes applied directly to the paper are marked [DONE].
Remaining items require further work.

---

## Missing Bibliography Entries (29 citations) — DONE

All 29 entries added to `paper-draft/references.bib` on 2026-02-05.
Bib file copied to `docs/research/references.bib` (where both papers expect it).
Duplicate entries removed. `pandoc --citeproc` resolves all 29 citations with zero warnings.

- [x] All 29 citation keys present and resolving
- [x] Key aliases added for near-matches (`honneth1995`, `freud1925`, `magee2024drama`)
- [x] Short paper bibliography path fixed (`../references.bib` → `references.bib`)

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
- [x] Judge naming — standardized to "Claude Code" with "(using Claude Opus as the underlying model)" noted at first mention
- [x] Dialectical synthesis rate — N=455 added
- [x] Extended scenario table — small-sample caveat added
- [x] Latency — measurement conditions noted
- [x] Sample summary — N updated to 442

---

## Paper Review Fixes (v0.5) — DONE

14 issues identified in thorough review and fixed in commit 476ce63:

- [x] Appendix C.3 header percentages (10% → 8.3%) for mutual_recognition, dialectical_responsiveness, transformative_potential
- [x] Section 10 broken reference to "Appendix E" → Appendix B and D
- [x] Limitations inter-judge r-range corrected (0.38–0.86 → 0.33–0.66)
- [x] A×B interaction N mismatch reconciled (N=24 → N=17, matching Table 2)
- [x] Table numbering: 1/1a/1b → sequential Tables 1–13
- [x] Appendix D deduplication (now references Section 10)
- [x] Drama Machine citation added (`@magee2024drama`)
- [x] Abstract N-count: leads with N=435 primary, notes N=2,700+ total
- [x] Section 2.4 (Sycophancy) expanded from 1 to 3 paragraphs
- [x] Section 4.4 (Dialectical Negotiation) expanded with concrete details and cross-refs
- [x] Section 6.2→6.3 ANOVA bridging sentence added
- [x] Section 7.5 Factor C analysis added (new section)
- [x] Discussion renumbered 7.5–7.8

## Bilateral Transformation Backport to Short Paper — DONE

Backported in commit 32e8f1a (v2.1):

- [x] Abstract: bilateral transformation sentence added
- [x] Contributions: item #7 (bilateral transformation metrics)
- [x] Section 5.1: tutor_adaptation (5%) and learner_growth (5%) added; recognition weights corrected to 8.3%; standard weights corrected to 75%
- [x] Section 6.7 (new): Bilateral Transformation Metrics with table
- [x] Section 7.6 (new): Discussion of bilateral transformation as empirical evidence
- [x] Section 7.7: AI Alignment discussion updated with bilateral metrics reference
- [x] Section 9 (Conclusion): finding #3 added
- [x] Section 8 (Limitations): item #8 (N=20 sample size)

## Minor Remaining Paper Issues

- [ ] **Scenario naming inconsistency** — Section 5.2 uses `recognition_seeking_learner`,
      `returning_with_breakthrough`, `resistant_learner` but Section 6.9 uses
      `sustained_dialogue`, `breakdown_recovery`, `productive_struggle`,
      `mutual_transformation`. These are different scenario sets; add a note clarifying
      that 6.9 uses extended multi-turn scenarios distinct from the core set in 5.2.

- [ ] **Box-drawing characters in PDF** — ASCII art diagrams (Figures 1-5) use Unicode
      box-drawing characters (┌─│└▼►) that don't render in LaTeX monospace font.
      Options: (a) use `--pdf-engine=lualatex` with a Unicode monospace font,
      (b) replace ASCII art with proper figure images, or (c) replace box-drawing
      with plain ASCII characters (+, -, |).

- [x] **references.bib location** — FIXED. Bib file copied to `docs/research/references.bib`.
      Short paper path corrected. Duplicates removed. All 29 citations resolve with
      `pandoc --citeproc`.
