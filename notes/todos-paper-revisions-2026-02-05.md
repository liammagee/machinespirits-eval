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

## Consistency Fixes Applied (v0.6 follow-up)

Based on second-pass review. Quick fixes applied directly:

- [x] **Model-selection table N=360** — Line 496: Changed to "N=342 scored of 402" to match
      Section 6.2 (Table 5) and Section 5.5 item 2.
- [x] **Domain Generalizability bullet N=40** — Line 518: Updated to "N=47 Nemotron + N=60
      Kimi replication" to match Table 2.
- [x] **Sample-size narrative "four key runs"** — Lines 544/546: Updated to "six key runs"
      and N=562 to match Table 2 which lists six runs totaling 562 scored.
- [x] **Duplicate Table 8** — Lines 759/792: Renumbered second Table 8 (Superego Rejection
      Patterns) to Table 9. All subsequent tables bumped: 9→10, 10→11, 11→12, 12→13, 13→14.

## Introduction / Contributions Rewrite Needed

- [x] **Intro paragraph (lines 39-43) out of sync with replication results** — The intro
      still presents findings as settled that the body now qualifies:
      - Line 39: Says "N=435 primary evaluations" — should be N=562
      - Line 41: Presents multi-agent synergy (+9.2 pts) as a firm discovery ("we discover
        that the multi-agent synergy effect is *specific to recognition prompts*") — but §6.3
        now documents non-replication (Kimi factorial F=0.04, Kimi A×B replication +1.35 pts).
        Needs hedging: present as exploratory/model-specific.
      - Line 43: Presents domain factor inversion as clean finding — but §6.4 now shows the
        architecture dominance on elementary is partly model-dependent (Kimi shows recognition
        dominance). Needs qualification.
      - Line 53: Contributions list includes "Evidence that multi-agent synergy requires
        recognition framing" — should be downgraded to "Exploratory evidence..." or removed
        and folded into architecture contribution.
      **DONE**: Updated intro to six-run evidence (N=562). Synergy hedged as exploratory/
      model-specific. Domain inversion qualified with Kimi replication. Contributions list
      updated: synergy bullet reframed as error correction + model-dependent interaction;
      domain bullet expanded to include scenario difficulty.

## Short Paper Consistency Update (v2.2) — DONE

Synced PAPER-SHORT-2026-02-04.md with PAPER-FULL-2026-02-04.md:

- [x] Abstract: N=3,000+ → N=562 primary / N=2,700+ total; synergy hedged; domain inversion qualified; memory confound noted
- [x] Contributions: N=3,000+ → N=562; A×B contribution reframed as exploratory/model-specific; domain gen. notes cross-model replication
- [x] Section 5.5: Judge "Kimi K2.5" → "Claude Code (Claude Opus)"
- [x] Section 5.6: N=360→342; N=40→47+60; added replication runs; total 3,000+→562 primary
- [x] Section 6.2: Cell means and main effects updated to match long paper Table 5 (+13.9/η²=.208 → +10.4/η²=.109)
- [x] Section 6.3: Added non-replication data (Kimi factorial + dedicated replication); "Key Finding"→"Exploratory Finding"
- [x] Section 6.6: Added Kimi replication table (+9.9 pts, d≈0.61); noted model-dependence of factor inversion; removed profile performance table (Nemotron-specific)
- [x] Section 7.2: Updated with Kimi replication data; noted scenario-dependency
- [x] Section 7.4: Rewritten as "Model-Dependent Interaction" with non-replication evidence
- [x] Section 8: Added memory confound (item 6); expanded model dependence (item 2); renumbered items
- [x] Section 9: Conclusion rewritten to match long paper findings (synergy not confirmed, domain gen confirmed, memory confound noted)
- [x] Section 10: Added replication run IDs
- [x] Version bumped v2.1 → v2.2

## Long Paper Appendix D Fix — DONE

- [x] "four key runs" → "six key runs" in Appendix D (line 1443)

## Residual Risks (documented, no action needed)

- **Memory confound**: Recognition profiles bundle memory integration; causal isolation
  requires a memory factor. Disclosed in §5.3 and §8.1. Tracked under "Memory Confound
  Isolation" in Medium Priority above.
- **A×B synergy underpowered and model-specific**: Nemotron N=17 finding did not replicate
  on Kimi (N=342 factorial, N=60 dedicated). Documented in §6.3, §7.2. No further action
  unless new model data becomes available.

## Minor Remaining Paper Issues

- [x] **Scenario naming inconsistency** — FIXED. Section 5.2 updated to use actual scenario
      IDs from config/suggestion-scenarios.yaml and database. Section 6.9 replaced fabricated
      scenario data (`sustained_dialogue`, `breakdown_recovery`, `productive_struggle`) with
      real multi-turn results from database: `misconception_correction_flow` (d=0.85),
      `mood_frustration_to_breakthrough` (d=0.59), `mutual_transformation_journey` (d=0.78).
      Cohen's d corrected from implausible 2.23–3.60 to actual 0.59–0.85.

- [x] **Box-drawing characters in PDF** — FIXED. All 5 ASCII art diagrams (Figures 1-5)
      replaced with proper PNG images in `docs/research/figures/`. Markdown references
      updated to `![Figure N](figures/figureN.png)`. No remaining Unicode box-drawing
      characters in the paper.

- [x] **references.bib location** — FIXED. Bib file copied to `docs/research/references.bib`.
      Short paper path corrected. Duplicates removed. All 29 citations resolve with
      `pandoc --citeproc`.

## Qualitative Analysis Added (v0.7)

- [x] Created `scripts/qualitative-analysis.js` — extracts transcript pairs, word frequency,
      lexical diversity, and thematic coding from evaluation database
- [x] Section 6.11: "Qualitative Analysis: What Recognition Looks Like" — transcript excerpts
      (3 paired base/recognition responses with row IDs), lexical diversity table, differential
      word frequency table, thematic coding with chi-square significance
- [x] Section 7.9: "What the Transcripts Reveal" — interpretive discussion connecting
      qualitative findings to Hegelian concepts (productive negativity, recognition of other,
      learner-as-subject framing), with limitations noted
- [x] Tables 14–16 added (lexical diversity, differential word frequency, thematic coding);
      former Table 14 (Cost-Benefit) renumbered to Table 17
- [x] Version bumped v0.6 → v0.7
- [x] Script outputs: `exports/qualitative-analysis.json`, `exports/qualitative-analysis.md`

## Vocabulary Contamination Check & Cleanup — DONE

Investigated whether base-skewed terms ("agents," "run," "reinforcement") in Section 6.11.2
represented evaluation framework leakage into tutor transcripts. Verified from database
transcripts that all three are course-domain language:
- "agents" = simulation agents in courseware activities
- "run" = imperative to launch simulations
- "reinforcement" = pedagogical concept review

- [x] Section 6.11.2: clarifying note added with in-context examples from transcripts
- [x] PowerPoint slide 12: grey annotation noting course-domain provenance
- [x] Both PDFs regenerated (long paper + short paper)
- [x] Stale `PAPER-FULL-2026-02-05.pdf` removed

## Database & Run Cleanup — DONE

- [x] 11 stale evaluation runs marked as failed/completed (dead processes, mostly 0 results)
- [x] 5 empty database stub files removed (`evaluation.db`, `evaluation-results.db`,
      `evaluation_results.db`, `eval-results.db`, `eval.sqlite`)
- [x] 2 live runs (PIDs 71463, 74183) left untouched — memory confound isolation experiment

## Production Quality Fixes (2026-02-06) — DONE

Critical review identified 6 issues; 5 fixed, 1 residual.

- [x] **[CRITICAL] Title page metadata broken** — FIXED. Author field changed from structured
      YAML (`name:` / `affiliation:`) to flat string with em dash separator. Removed stale
      `draft: v0.7` key. Both papers now render proper title/author/date on page 1.

- [x] **[CRITICAL] Freud citation incorrect** — FIXED. `@freud1925` pointed to *Die Verneinung*
      (Negation, 1925), not the Mystic Writing Pad. Added new `@freud1925` entry for *A Note
      upon the "Mystic Writing-Pad"* (SE XIX, pp. 227–232). Old entry renamed to
      `@freud1925negation`. The `@freud1925` key in the paper text now correctly resolves.

- [x] **[HIGH] Figure captions duplicated** — FIXED. Removed "Figure N:" prefix from all 5
      markdown image alt texts (pandoc auto-numbers figures, so `![Figure 1: X]` produced
      "Figure 1: Figure 1: X"). Now `![Ego/Superego Architecture]` etc.

- [x] **[HIGH] Unicode glyph rendering** — FIXED. Replaced all ≈, η², α, χ², ≥ with LaTeX
      math equivalents ($\approx$, $\eta^2$, $\alpha$, $\chi^2$, $\geq$) in both papers.
      Warnings dropped from 10 to 2 (residual ≥ from CSL/template pipeline — see below).

- [x] **[MEDIUM] N-count inconsistency (3,800+ vs 3,900+)** — FIXED. Verified actual DB totals:
      3,871 attempts, 3,842 scored, 68 runs. Standardized all references to "3,800+" and "68 runs"
      throughout both papers.

- [x] **[MEDIUM] Table 16 numeric inconsistency (0.0 / 0.0 / 2.16×)** — FIXED. Values were
      rounded to 0.0 but had nonzero sub-decimal rates. Changed to 0.04 and 0.09 (per 1000 words),
      making the 2.16× ratio visually consistent.

### Residual: 2 xelatex ≥ warnings

Two `Missing character: ≥` warnings remain in the full paper PDF build. These do NOT come from
the markdown source (verified: zero ≥ characters in .md). Likely generated by the CSL processor
or pandoc template during bibliography/table rendering. Options to resolve:
- [ ] Add `\usepackage{textcomp}` or switch to a Unicode-complete font in a custom pandoc template
- [ ] Or accept as cosmetic (the ≥ renders correctly in most PDF viewers via fallback fonts)
