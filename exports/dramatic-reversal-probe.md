# Dramatic-reversal / recognition probe — report

**Script:** `scripts/analyze-dramatic-reversal.js`
**Data:** `exports/dramatic-reversal-probe.json`
**Runs:** `eval-2026-03-01-aea2abfb`, `eval-2026-03-02-18027efc`, `eval-2026-03-02-45163390` (messages-mode, cells 80–87; n=1296 multi-turn dialogues, 0 missing logs)
**Status:** descriptive process measure. **No new empirical claim.** Converges with `paper-full-2.0.md` §7.9 (slope-proxy / frozen-external-standard) and the drama-machine Hollywood-ending caution (Magee et al. 2024, arXiv:2408.01725v2). LLM scoring pass deliberately disabled (closed-loop tell).

## What was measured

Per dialogue: ordered learner *external* messages from `dialogueTrace`, rule-scored for recognition (anagnorisis lexicon), structural reversal (peripeteia proxy: stance-shift + back-reference), valence (residual-confusion absence), gratitude, and ending resolution. Independent anchor: learner-rubric first→last delta (`learner_scores`, the channel the learner-model does not author). Contrast: superego presence, ground-truthed from `(superego,review)` trace entries.

## Headline

| group | n | recog rate | valence uniformity | ends resolved | reversal rate | indep. rubric Δ | r(recog, rubric Δ) |
|---|--:|--:|--:|--:|--:|--:|--:|
| overall | 1296 | 22.7% | **93.2%** | 19.7% | 43.3% | +13.6 (sd 30) | **−0.063** |
| superego present | 648 | 21.5% | 94.5% | 21.3% | 46.3% | +15.2 | **−0.183** |
| superego absent | 648 | 24.0% | 92.0% | 18.1% | 40.3% | +12.1 | +0.034 |

Per cell (`valence uniformity` / `r(recog, rubric Δ)`): 80 `87.0% / −0.048`, 81 `95.3% / +0.058`, 82 `98.9% / −0.280`, 83 `95.8% / −0.086`, 84 `89.5% / −0.161`, 85 `98.7% / +0.192`, 86 `97.4% / −0.337`, 87 `84.0% / −0.053`.

## Reading (defensible vs not)

**Defensible:**

1. **The structural confound is present and architecture-invariant.** When the synthetic learner performs recognition it is positively-valenced **84–99% of the time in every cell** — residual confusion almost never co-occurs with a recognition marker. This is the Hollywood "salutary resolution" register, and it does not depend on recognition theory, superego, or learner architecture.
2. **Performed recognition is decoupled from the independent channel.** r(recognition rate, independent rubric Δ) is ≈0 or negative in 6/8 cells (pooled −0.06). Verbal anagnorisis does not predict measured rubric gain.
3. **The superego does not dissolve the confound — it polishes it.** Where the tutor has a superego (82, 86) valence uniformity is near-ceiling (98.9%, 97.4%) while the recognition→gain coupling is *most negative* (−0.280, −0.337). More performed recognition there goes with *less* independent gain. This is the drama-machine caution made quantitative: the superego improves the theatrical resolution, not the learning.

**Not established (stated honestly, not overclaimed):**

- The strict per-dialogue `dissociationRate` (3.4%) is the weak statistic, not the load-bearing one: the rubric Δ has sd ≈ 30 pts, so the conjunctive `recog≥0.34 ∧ |Δ|<5` rule is brittle. The **near-zero correlation** is the robust read; the flag is reported only for completeness.
- The rubric Δ itself is an LLM-judged channel scoring the same learner text — "independent" only in that the learner-model does not author the score. Its high variance and non-relation to recognition is itself the §7.9 point; it is not a strong real-change anchor.
- This probe says nothing about whether *recognition occurred* — only that, on synthetic learners, performed recognition is a near-uniformly-positive trained disposition uncorrelated with the only channel the learner-model does not write. Underdetermination is symmetric (§7.9).

## Consequence

A synthetic dramatic-reversal pilot would re-measure this performance, not pierce it — the drama machine already *is* that pilot, with this cautionary result. The genuinely-new, non-confounded path is human pre/post conceptual change on a channel the learner-model cannot author (§8.1 / the IRB-gated Human Learner Pilot). The probe sharpens an existing limitation; it opens no new synthetic arc.
