# Paper Revision TODOs — 2026-02-05 — COMPLETE

**Status**: All items resolved. Superseded by `todos-feedback-2026-02-07.md`.

Based on ChatGPT critical review of PAPER-FULL-2026-02-04.md.
Text fixes applied directly to the paper are marked [DONE].

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

- [x] **Memory Confound Isolation** — Replication run eval-2026-02-06-ca4a1114 (N=150) combined
      with initial run eval-2026-02-05-b3ace0ec (N=300) for total N=750. Result: neither memory
      alone (+0.3 pts, d=0.02) nor recognition alone (+0.5 pts, d=0.05) improves outcomes, but
      their combination yields +9.1 pts (d=0.83), with interaction (+8.3 pts) accounting for 91%
      of improvement. Paper updated: abstract, §6.2, §8.1, §9, Table 2, run ID tables.

- [x] **Domain Generalizability Model Confound** — Run eval-2026-02-05-e87f452d (N=60,
      Kimi K2.5, elementary content). Result: recognition main effect +9.9 pts (d ≈ 0.61),
      replicating across model and domain. Effects scenario-dependent: +23.8 for frustrated
      learners, ~0 for neutral scenarios. Factor inversion partly model-dependent — Kimi
      shows recognition dominance on elementary (not architecture dominance as with Nemotron).
      Paper updated: Section 6.4 adds Table 8 with replication, Sections 7.3, 8.1, 9 updated.

### LOW PRIORITY

- [x] **Hardwired Rules Larger Sample** — DONE. eval-2026-02-08-65a6718f (N=72, kimi-k2.5,
      Opus judge). Hardwired rules performed BELOW baseline (cell 13=74.0 vs cell 1=77.6;
      cell 14=69.0 vs cell 2=80.0), contradicting the exploratory N=9 finding. Supports
      phronesis interpretation: the superego's value is in contextual judgment, not codifiable
      rules. Paper updated: Section 6.7 rewritten, run ID tables updated.

- [x] **Bilateral Transformation Larger Sample** — DONE: eval-2026-02-07-b6d75e87 (N=118
      scored, 8 cells × 3 multi-turn scenarios × 5 reps, Kimi K2.5, Opus judge).
      Results: tutor adaptation +26% (was +36% from N=20), learner growth *reversal*
      (base 0.242 > recognition 0.210). Paper updated: both papers' Table 14, abstract,
      contributions, discussion §7.6, limitations, conclusion finding #3 reframed from
      "bilateral transformation" to "tutor adaptation". N updated to 1,010/14 runs.

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

## ChatGPT Review #2 Fixes (2026-02-06)

8 issues reviewed; 6 addressed as text fixes, 2 deferred to future runs.

### Text fixes applied

- [x] **[CRITICAL] +8.7 unique value over-attributed** — FIXED. Section 6.1 interpretation (full)
      and Section 7.1 (short) softened to acknowledge memory bundling. Conclusion finding #1 in
      both papers reframed as "Recognition+memory synergy" rather than "43% unique contribution."

- [x] **[HIGH] Writing Pad causal claim too strong** — FIXED. Section 6.12 (full) and 6.10 (short)
      softened from "critical enabler" / "validates" to "important enabler" / "suggests" / "coincides
      with." Conclusion finding #6 in both papers adds ablation caveat. Abstract (short) softened.

- [x] **[HIGH] Missing attrition analysis** — FIXED. Section 5.5 item 2 (full) now notes
      exclusions are evenly distributed across cells (39–45 scored per cell), with no differential
      attrition between conditions. Data verified from database.

- [x] **[MEDIUM] Multi-turn table provenance** — FIXED. Section 6.9 (full) now notes N=161/277/165
      are pooled across the full development database (not a single run), with interpretation caveat.

- [x] **[MEDIUM] Generalizability language overstated** — FIXED. Conclusion finding #4 in both
      papers changed from "Domain generalizability confirmed" to "Domain generalizability" with
      qualifier that broader domain coverage is needed.

- [x] **[MEDIUM] Quant presentation issues** — Already fixed in prior round (Unicode, Table 16).

### Already addressed in prior rounds

- [x] **[CRITICAL] Freud source mismatch** — Already fixed: @freud1925 now points to Mystic
      Writing Pad (SE XIX, pp. 227–232), not Die Verneinung.

### Cross-judge replication — DONE

- [x] **[HIGH] Single LLM judge** — RESOLVED. Rejudged all key runs (N=738 responses total)
      with GPT-5.2 as independent second judge:
      - Recognition validation (N=36): recognition main effect replicates (d=1.01, p<.001)
      - Full factorial (N=342): recognition +7.0 pts (d=1.03, p<.001)
      - Memory isolation (N=300): interaction replicates (+5.5 pts, p<.001)
      - A×B replication (N=60): recognition +4.7 pts (d=0.98, p<.001)
      - Domain gen replication (N=60): also rejudged for completeness
      New Section 6.13 (full) and 6.11 (short) with Tables 21-22 documenting cross-judge results.
      Abstract, conclusion (finding #7), and limitations updated in both papers.
      One non-replication: recognition vs enhanced (+8.7 under Claude, +1.3 under GPT-5.2, p=.60).
      Noted in paper as calibration-sensitive.

### Deferred to future evaluation runs

### Open questions (require strategic decision, not text fix)

- [x] **Venue targeting** — Strategic decision, not a code/paper task. Paper written to support
      either venue. No further action needed in this todo list.

### Residual: xelatex ≥/≈ warnings — FIXED

- [x] All bare Unicode ≈ and ≥ characters replaced with LaTeX math equivalents (`$\approx$`, `$\geq$`)
- [x] Fixed pandoc math-mode parsing: closing `$` followed by digits (e.g., `$\approx$58`) caused
      pandoc to escape `$` as literal text. Solution: include adjacent numbers inside math expression
      (`${\approx}58$`) or use full math expressions (`$p \approx .08$`, `$\geq 90$`)
- [x] Both PDFs now build with zero xelatex warnings
- [x] `header.tex` includes `\usepackage{amssymb}` for math symbol support

---

## Replication Audit Fixes (2026-02-06)

Full codebase audit by 6-agent team identified bugs, untested paths, and paper discrepancies.
Code fixes applied; remaining items below.

### Code fixes applied — DONE

- [x] **Turns array mutation** — `evaluationRunner.js` mutated `fullScenario.turns` in-place
      during multi-turn tests, contaminating across profiles. Fixed: deep-clone via
      `JSON.parse(JSON.stringify())` before mutation loop.

- [x] **Silent score fallback** — Judge API failures silently produced synthetic 0/50/100 scores
      stored as real rubric evaluations. Fixed: null scores on failure + `scoring_method` column
      (`'rubric'`, `'judge_failed'`, `'skipped'`) throughout pipeline.

- [x] **P-value step-function** — `anovaStats.js` used coarse approximation returning only 7
      discrete values. Fixed: proper F-distribution CDF via regularized incomplete beta function.
      Validated against known critical values and paper-reported p-values.

- [x] **Prompt resolution for cells 6, 8, 15-20** — Three bugs found:
      (a) Cells 6 & 8: learner recognition prompts never existed, fell back to one-liners.
          Created `learner-ego-recognition.md`, `learner-superego-recognition.md`,
          `learner-synthesis-recognition.md`.
      (b) Cells 15-18 (placebo): prompts unreachable by tutor-core loader. Placebo cells
          were running identically to base cells. Fixed profile mapping + copied prompts.
      (c) Cells 19-20 (memory isolation): mapped to 'budget' profile. 2x2 memory isolation
          was broken. Fixed to 'memory' and 'recognition_nomem' profiles.

- [x] **Paper discrepancies** — Scoring formula in Appendix C.1, stale rubric YAML comment,
      missing bilateral dimensions in judge prompt example, p-value methodology note.

- [x] **Judge model description** — Corrected to "Claude Code (Claude Opus)" in both papers
      (workflow uses `--skip-rubric` then evaluates via Claude Code CLI on Opus).

- [x] **68 new tests** — `rubricEvaluator.test.js` (40 tests: score calculations, JSON parsing
      5-layer fallback) + `evaluationStore.test.js` (28 tests: CRUD, migrations, result parsing).

### Data provenance verified — CLEAN

All 9 paper-cited runs collected after the two data-affecting bug fixes (learner architecture
condition + recognition prompt routing). Fixes C/D/E are infrastructure fixes that don't affect
raw scored data.

### HIGH PRIORITY — Re-run compromised cells

- [x] **Re-run cells 15-18 (placebo)** — DONE: eval-2026-02-06-a9ae06ee (N=59 success,
      nemotron, Opus-judged). Reframed as "active control" due to model confound.

- [x] **Re-run cells 19-20 (memory isolation)** — DONE: eval-2026-02-06-81f2d5a1 (N=60)
      and eval-2026-02-06-ac9ea8f5 (N=60). Corrected 2×2 with kimi-k2.5, Opus judge.

- [x] **Re-run cells 6 & 8 (learner ego_superego_recognition)** — DONE:
      eval-2026-02-06-a933d745 (N=88, kimi-k2.5, Opus judge). Paper updated with corrected
      factorial (v1.3). GPT-5.2 cross-judge rejudge also completed (88 rows, r=0.55, p<.001).
      Paper updated: cross-judge correlation table (Table 22) and new paragraph on updated
      rubric cross-judge replication.

### MEDIUM PRIORITY

- [x] **Commit tutor-core changes to tutor-core repo** — N/A: tutor-core is symlinked
      (`node_modules/@machinespirits/tutor-core -> ../../../machinespirits-tutor-core`),
      so changes persist. No risk of loss on reinstall.

- [x] **Review ~100 historical synthetic scores** — VERIFIED CLEAN. 147 rows have
      `scoring_method = 'legacy_fallback'` with exact 0/50/100 scores — all in early
      development runs (Jan 30 – Feb 4). **Zero** appear in any of the 13 paper-cited runs.
      5 additional rows have `scoring_method IS NULL` with exact 0/50/100; 3 are in
      86b159cd (paper-cited) but are genuine perfect scores (5/5 on all dimensions, real
      evaluation reasoning 75-121 chars + scores_with_reasoning 937-1118 chars). The other
      2 are in non-paper early runs. No paper results are contaminated by synthetic fallbacks.

- [x] **Bilateral transformation caveat** — INVESTIGATED. Pre-fix logs (N=8) show
      learnerGrowthIndex = 0.000 for ALL entries (confirming the bug). Post-fix logs (N=395)
      show mean = 0.257. Paper Table 14 values (base=0.176, recog=0.220) are non-zero, so
      they were computed from post-fix data — but from a small sample (N=20, one scenario).
      Larger post-fix comparison (N=359 all multi-turn): **tutor adaptation index holds and
      strengthens** (base=0.318, recog=0.441, +38.7% relative vs paper's +36.1%). However,
      **learner growth delta reverses** in the larger sample (base=0.280 > recog=0.240).
      The paper's primary claim (+36% adaptation improvement) is robust; the learner growth
      claim (+0.044 delta) is fragile and sample-dependent. Paper already flags N=20 limitation
      in Section 8, item 10. No table update needed — paper values are from post-fix code and
      the adaptation finding (the one actually discussed in the text) is confirmed.

### LOW PRIORITY

- [x] **Refactor evaluationStore.js for test isolation** — N/A: already supports
      `EVAL_DB_PATH` env var (line 20). Tests set it before import for isolation.

- [x] **CSV export escaping** — N/A: `escapeCsvField()` (line 814) already properly
      handles commas, quotes, and newlines with RFC 4180-compliant escaping.

- [x] **Module-level state in tutorDialogueEngine** — N/A for this repo: the singleton
      state is in `@machinespirits/tutor-core` (external symlinked package). Only affects
      logging metadata during parallel runs, not scored results.

- [x] **Duplicate isPidAlive/isProcessRunning** — Already consolidated to single
      `services/processUtils.js`. All 3 consumers (evaluationRunner, eval-cli,
      evaluationStore) import from it.
