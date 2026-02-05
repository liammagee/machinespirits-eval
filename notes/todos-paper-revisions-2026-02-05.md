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

### HIGH PRIORITY — DONE

- [x] **A×B Interaction Replication** — Run eval-2026-02-05-10b344fb (N=60, Kimi K2.5).
      Result: A×B interaction = +1.35 pts (vs Nemotron's +9.2). Non-replication confirmed.
      Recognition cells score ~90.6 regardless of architecture; enhanced cells ~80.6.
      Paper updated: Section 6.3 adds replication data, Section 7.2 updated, Section 9
      conclusion revised to "not confirmed". Finding remains hypothesis-generating only.

### MEDIUM PRIORITY

- [ ] **Memory Confound Isolation** — Memory is bundled with recognition. Add memory-only
      profiles (base prompts + memory, no recognition) and recognition-without-memory profiles.
      Would need new cells in tutor-agents.yaml + 2×2×2×2 factorial.
      **Why it matters**: Cleanly separates memory contribution from recognition theory.
      Currently acknowledged as limitation in Sections 5.3 and 8.1.

- [x] **Domain Generalizability Model Confound** — Run eval-2026-02-05-e87f452d (N=60,
      Kimi K2.5, elementary content). Result: recognition main effect +9.9 pts (d ≈ 0.61),
      replicating across model and domain. Effects scenario-dependent: +23.8 for frustrated
      learners, ~0 for neutral scenarios. Factor inversion partly model-dependent — Kimi
      shows recognition dominance on elementary (not architecture dominance as with Nemotron).
      Paper updated: Section 6.4 adds Table 8 with replication, Sections 7.3, 8.1, 9 updated.

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

## Replication Runs Incorporated (v0.6) — DONE

Two new evaluation runs incorporated into paper:

- [x] eval-2026-02-05-10b344fb: A×B replication (Kimi, N=60) — non-replication confirmed
- [x] eval-2026-02-05-e87f452d: Domain gen. replication (Kimi elementary, N=60) — recognition replicates
- [x] Abstract updated: N=562, replication results summarized
- [x] Table 1 (Model Config): two new runs added
- [x] Table 2 (Sample Summary): two new runs, totals updated to 623/562
- [x] Section 6.3: Kimi replication data added, non-replication strengthened
- [x] Section 6.4: Table 8 (Kimi elementary replication), model confound discussion
- [x] Section 7.2: A×B discussion updated with triple non-replication
- [x] Section 7.3: Domain limits revised with scenario-dependent finding
- [x] Section 8.1: Model dependence and domain sampling limitations updated
- [x] Section 9: Conclusion findings revised (finding #2 non-confirmed, #4 strengthened)
- [x] Section 10 + Appendix D: Run ID tables updated with 6 runs
- [x] Version bumped v0.5 → v0.6

## Minor Remaining Paper Issues

- [x] **Scenario naming inconsistency** — FIXED. Section 5.2 updated to use actual scenario
      IDs from config/suggestion-scenarios.yaml and database. Section 6.9 replaced fabricated
      scenario data (`sustained_dialogue`, `breakdown_recovery`, `productive_struggle`) with
      real multi-turn results from database: `misconception_correction_flow` (d=0.85),
      `mood_frustration_to_breakthrough` (d=0.59), `mutual_transformation_journey` (d=0.78).
      Cohen's d corrected from implausible 2.23–3.60 to actual 0.59–0.85.

- [ ] **Box-drawing characters in PDF** — ASCII art diagrams (Figures 1-5) use Unicode
      box-drawing characters (┌─│└▼►) that don't render in LaTeX monospace font.
      Options: (a) use `--pdf-engine=lualatex` with a Unicode monospace font,
      (b) replace ASCII art with proper figure images, or (c) replace box-drawing
      with plain ASCII characters (+, -, |).

- [x] **references.bib location** — FIXED. Bib file copied to `docs/research/references.bib`.
      Short paper path corrected. Duplicates removed. All 29 citations resolve with
      `pandoc --citeproc`.
