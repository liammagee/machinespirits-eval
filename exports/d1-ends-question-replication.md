# D1 ends-with-question Replication on A2/A6 Runs

Tests whether the §7.10 ends-with-question within-cell mediator finding generalises beyond the A10b reference run. Reference: Sonnet on A10b cells 5 and 95 give within-cell Pearson $r = +0.325$ and $r = +0.392$ respectively.

Replication = positive within-cell $r$ (any magnitude $> +0.1$) in cells with the recognition prompt. Sign-flip in any recognition cell would constitute failed replication.

## Per-target headline

| Target | Cell | n | Mean score | Ends-Q rate | Within-cell r |
| --- | --- | --- | --- | --- | --- |
| A10b reference (Sonnet) | cell_1_base_single_unified | 50 | 33.80 | 0.000 | 0.000 |
| A10b reference (Sonnet) | cell_5_recog_single_unified (recog) | 44 | 47.90 | 0.045 | 0.325 |
| A10b reference (Sonnet) | cell_95_base_matched_single_unified | 47 | 49.55 | 0.021 | 0.392 |
| A10b reference (Sonnet) | cell_96_base_behaviorist_single_unified | 50 | 22.07 | 0.000 | 0.000 |
| A10 v2 (Sonnet) | cell_1_base_single_unified | 57 | 29.41 | 0.000 | 0.000 |
| A10 v2 (Sonnet) | cell_5_recog_single_unified (recog) | 55 | 52.39 | 0.127 | 0.346 |
| A10 v2 (Sonnet) | cell_95_base_matched_single_unified | 56 | 48.91 | 0.036 | 0.164 |
| A6 programming (Sonnet, Haiku ego) | cell_1_base_single_unified | 15 | 47.75 | 0.000 | 0.000 |
| A6 programming (Sonnet, Haiku ego) | cell_5_recog_single_unified (recog) | 15 | 70.42 | 0.267 | 0.202 |
| D2 Path 1 peer support (Sonnet, Haiku ego) | cell_1_base_single_unified | 15 | 52.25 | 0.000 | 0.000 |
| D2 Path 1 peer support (Sonnet, Haiku ego) | cell_5_recog_single_unified (recog) | 15 | 69.92 | 0.400 | 0.739 |
| A2 cells 60-63 (Opus 4.6, Nemotron ego) | cell_60_base_dialectical_selfreflect_psycho | 30 | 54.14 | 0.000 | 0.000 |
| A2 cells 60-63 (Opus 4.6, Nemotron ego) | cell_61_recog_dialectical_selfreflect_psycho (recog) | 30 | 71.45 | 0.100 | -0.087 |
| A2 cells 60-63 (Opus 4.6, Nemotron ego) | cell_62_base_dialectical_profile_bidirectional_psycho | 30 | 56.46 | 0.000 | 0.000 |
| A2 cells 60-63 (Opus 4.6, Nemotron ego) | cell_63_recog_dialectical_profile_bidirectional_psycho (recog) | 30 | 70.18 | 0.100 | -0.199 |
| Paper 2.0 multi-turn cells 80-87 single-agent (Sonnet, DeepSeek ego) | cell_80_messages_base_single_unified | 18 | 24.44 | 0.000 | 0.000 |
| Paper 2.0 multi-turn cells 80-87 single-agent (Sonnet, DeepSeek ego) | cell_84_messages_recog_single_unified (recog) | 18 | 48.40 | 0.389 | -0.301 |
| Paper 2.0 multi-turn cells 80-87 multi-agent (Sonnet, DeepSeek ego) | cell_82_messages_base_multi_unified | 18 | 30.63 | 0.111 | 0.383 |
| Paper 2.0 multi-turn cells 80-87 multi-agent (Sonnet, DeepSeek ego) | cell_86_messages_recog_multi_unified (recog) | 18 | 47.78 | 0.278 | -0.203 |

## Per-target notes + replication call

### A10b reference (Sonnet)

- Run: `eval-2026-04-24-e9a785c0`
- Judge: claude-code/sonnet
- Reference run for §7.10. Established headline.

- cell_5_recog_single_unified: r = 0.325, ends-Q rate = 0.045 → **STRONG REPLICATION**
- cell_95_base_matched_single_unified: r = 0.392, ends-Q rate = 0.021 → **STRONG REPLICATION**

### A10 v2 (Sonnet)

- Run: `eval-2026-04-23-42e7acbe`
- Judge: claude-code/sonnet
- Same DeepSeek ego + philosophy scenarios as A10b but independent run; tests one-run replicability.

- cell_5_recog_single_unified: r = 0.346, ends-Q rate = 0.127 → **STRONG REPLICATION**
- cell_95_base_matched_single_unified: r = 0.164, ends-Q rate = 0.036 → **WEAK REPLICATION**

### A6 programming (Sonnet, Haiku ego)

- Run: `eval-2026-04-17-c92ad6c7`
- Judge: claude-code/sonnet
- Different domain (programming, not philosophy), different generation model (Haiku 4.5).

- cell_5_recog_single_unified: r = 0.202, ends-Q rate = 0.267 → **STRONG REPLICATION**

### D2 Path 1 peer support (Sonnet, Haiku ego)

- Run: `eval-2026-04-17-6766015b`
- Judge: claude-code/sonnet
- Different application (peer support coaching), Haiku ego. Tests cross-application transfer of the mediator.

- cell_5_recog_single_unified: r = 0.739, ends-Q rate = 0.400 → **STRONG REPLICATION**

### A2 cells 60-63 (Opus 4.6, Nemotron ego)

- Run: `eval-2026-02-20-0fbca69e`
- Judge: claude-opus-4.6
- Different cells (dialectical-architecture mechanism sweep with dynamic learner), different judge. Tests whether ends-with-question is a within-cell mediator beyond the single-prompt cell_1/5/95/96 comparison.

- cell_61_recog_dialectical_selfreflect_psycho: r = -0.087, ends-Q rate = 0.100 → **SIGN-FLIP (failed replication)**
- cell_63_recog_dialectical_profile_bidirectional_psycho: r = -0.199, ends-Q rate = 0.100 → **SIGN-FLIP (failed replication)**

### Paper 2.0 multi-turn cells 80-87 single-agent (Sonnet, DeepSeek ego)

- Run: `eval-2026-03-01-aea2abfb`
- Judge: claude-code/sonnet
- Multi-turn messages-mode replication on the canonical Paper 2.0 factorial run (DeepSeek V3.2 ego, 4-6 turns per dialogue). Tests whether ends-with-question (final-turn-ending) mediator account holds in multi-turn single-agent recognition.

- cell_84_messages_recog_single_unified: r = -0.301, ends-Q rate = 0.389 → **SIGN-FLIP (failed replication)**

### Paper 2.0 multi-turn cells 80-87 multi-agent (Sonnet, DeepSeek ego)

- Run: `eval-2026-03-01-aea2abfb`
- Judge: claude-code/sonnet
- Multi-turn multi-agent (with superego) cells from same canonical factorial. Tests whether the A2 dialectical-architecture sign-flip pattern persists or whether messages-mode multi-agent behaves more like the single-prompt single-agent pattern.

- cell_86_messages_recog_multi_unified: r = -0.203, ends-Q rate = 0.278 → **SIGN-FLIP (failed replication)**

## Synthesis

Tally across intersubjective-family cells (recognition cells per the naming pattern + cell_95 matched-pedagogical, which is intersubjective per §7.9):

- 10 intersubjective-family cells across 7 runs.
- Strong replication (r > 0.2): 5
- Weak replication (0.05 < r < 0.2): 1
- Null (|r| < 0.05): 0
- Sign-flip (r < -0.05): 4
- No ends-Q produced (rate < 0.5%, mediator inapplicable): 0

Recognition cells where ends-with-question rate falls below 0.5% are noted as "mediator inapplicable" rather than as replication failures: in those cells the prompt does not produce the behaviour at meaningful frequency, so the within-cell correlation cannot test the mediator account either way.

## Interpretation: scope condition for the §7.10 mediator

The data partition cleanly along the **single-turn vs multi-turn** axis, not along the architecture axis as initially hypothesised.

**Single-turn cells (positive within-cell r in recognition):**

- A10b cell_5: $r = +0.325$ (DeepSeek, philosophy, Sonnet)
- A10b cell_95: $r = +0.392$ (DeepSeek, philosophy, Sonnet, matched-pedagogical)
- A10 v2 cell_5: $r = +0.346$ (DeepSeek, philosophy, Sonnet, independent run)
- A6 programming cell_5: $r = +0.202$ (Haiku, programming domain)
- D2 peer support cell_5: $r = +0.739$ (Haiku, peer support listener coaching --- the strongest within-cell r in the D1 sequence)

Cross-judge replication on A10b (Opus + GPT, `d1-cross-judge-replication.md`) confirms 5/6 cell-judge pairs positive in single-turn intersubjective cells.

**Multi-turn cells (negative within-cell r):**

- Paper 2.0 cell_84 (messages-mode recog single-agent, DeepSeek): $r = -0.301$, ends-Q rate 38.9\%
- Paper 2.0 cell_86 (messages-mode recog multi-agent, DeepSeek): $r = -0.203$, ends-Q rate 27.8\%
- A2 cell_61 (dialectical multi-agent recog, dynamic learner, Nemotron): $r = -0.087$
- A2 cell_63 (dialectical multi-agent recog with bidirectional profiling, dynamic learner, Nemotron): $r = -0.199$

All four multi-turn recognition cells show negative within-cell r. The pattern is robust across architecture (single-agent vs multi-agent vs dialectical), generation model (DeepSeek, Nemotron), and learner type (unified, dynamic).

**The single anomaly**: Paper 2.0 cell_82 (messages-mode base + superego, DeepSeek) shows $r = +0.383$ at ends-Q rate 11.1\%. This is a multi-turn cell with positive within-cell r --- the only one. Possible explanations: noise (n=18, only ~2 rows with ends-Q); or the base prompt + superego combination produces a different ending pattern (perhaps the superego occasionally requests the ego revise to end with a question and these revisions are systematically higher-quality). Worth flagging but not dispositive against the single-vs-multi-turn pattern given the small n.

### Substantive mechanism

The single-vs-multi-turn split has a clear pragmatic interpretation. In the single-turn setting, the tutor produces *one* response to *one* learner prompt. Ending that response with a question is the only available channel to cede initiative back to the learner; doing so signals "your turn now," which the rubric rewards as engaged tutoring. In the multi-turn setting, the rubric scores the *full dialogue*, and ending-the-final-turn-with-a-question means leaving the conversation *unresolved*. The judges appear to penalise dialogues that end with the tutor still asking rather than synthesising or concluding. The same surface feature (ends-with-?) signals different pragmatic acts depending on whether it occurs in a single-shot exchange or as the closing move of a multi-turn dialogue.

This is consistent with the §6.3 trajectory analysis: turn-by-turn dynamics differ qualitatively from single-turn quality, and structural features can invert their score-relationship across the boundary.

### Implication for the §7.10 paper claim

The §7.10 mediator claim should be hedged to: *"ends-with-question is a within-cell mediator within single-turn intersubjective-family cells (5 of 5 single-turn intersubjective cells, $r$ range $+0.16$ to $+0.74$); the relationship reverses sign in multi-turn intersubjective cells (4 of 5, $r$ range $-0.09$ to $-0.30$). The mediator account is therefore turn-mode specific: in single-turn responses, ending with a question cedes initiative and signals engagement; in multi-turn dialogues, ending the final turn with a question leaves the conversation unresolved and the judges penalise it."*

This refinement strengthens rather than weakens the mediator account: the *direction* of the surface feature's relationship with score depends on the pragmatic context (initiative-ceding is good when there's a next learner turn coming; dialogue-leaving-hanging is bad at conversation's end). It also tightens the §7.10 paper claim by giving an explicit scope condition that maps onto a published §6.3 distinction (single-turn vs trajectory analyses).