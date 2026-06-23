# D1 paper integration note

Date: 2026-06-23

Status: closed into Paper 2.0 Section 7.10.1 and revision-history entry v3.0.54.

## Source artifacts

- Pass 1: `scripts/analyze-recognition-lexicon.js`
- Pass 2: `scripts/analyze-d1-orientation-lexicon.js`
- Pass 3: `scripts/analyze-d1-structural-features.js`
- Pass 4: `scripts/analyze-d1-structural-features-v2.js`
- Pass 5: `scripts/analyze-d1-structural-features-v3.js`
- Cross-judge replication: `scripts/analyze-d1-cross-judge-replication.js` -> `exports/d1-cross-judge-replication.md`
- Pass 6 OLS: `scripts/analyze-d1-multifeature-ols.js` -> `exports/d1-multifeature-ols.md`
- Pass 7 multi-turn scope replication: `scripts/analyze-d1-ends-question-replication.js` -> `exports/d1-ends-question-replication.md`

The June 2026 rerun used the local `data/evaluations.db` symlink to `/Users/lmagee/.machinespirits-data/evaluations.db` and the warmed `exports/d1-embeddings-cache.json`; no API calls were made.

## Closure of the old outstanding list

1. Cross-judge replication is complete. Ends-with-question stays positive in 5 of 6 intersubjective cell/judge combinations; the one exception is GPT-5.2 on cell_95, where the correlation is approximately zero rather than a meaningful sign flip. The intersub_advantage Simpson's-paradox pattern holds in all 3 judges.

2. Pass 6 multifeature OLS is complete. In the two intersubjective cells, the ends-with-question partial coefficient remains positive after controlling for second-person density, scaffolding moves, broad acknowledgement, question-mark rate, and intersub_advantage: cell_5 beta = 26.34, p = 0.02; cell_95 beta = 38.52, p = 0.02. The transmission cells have zero ends-with-question variance, so the full per-cell OLS with that predictor is unidentified there; that is a design consequence, not evidence against the intersubjective-cell result.

3. Pass 7 multi-turn replication is complete as a scope-condition test. Single-turn intersubjective cells replicate positively across A10b, A10 v2, A6 programming, and D2 peer-support runs. Multi-turn intersubjective cells reverse sign: cell_84 r = -0.301, cell_86 r = -0.203, A2 cell_61 r = -0.087, and A2 cell_63 r = -0.199.

The older TODO wording also mentioned richer dialogue-trace features such as learner echo and acknowledgement of the prior turn. This checkout does not currently contain the dialogue log files needed for that richer trace analysis, and Section 7.10.1 does not claim it. The paper-integrated D1 result is narrower and explicit: final-turn ends-with-question is a single-turn mediator, and it reverses in multi-turn dialogues because the same surface feature means "cede initiative" in one-shot responses but "leave the dialogue unresolved" at closing turn.

## Paper claim boundary

The integrated claim is settled inside the current Paper 2.0 evidence base but scope-conditioned:

- It supports a pragmatic mechanism channel for single-turn intersubjective-family tutor responses.
- It does not establish causal mediation, human learning gains, or a complete mechanism model.
- It does not claim the Hegelian vocabulary is load-bearing; the orientation-family stance is the active level.
- It leaves white-box activation or attention analysis as future work requiring a separate open-weights interpretability setup.

Canonical paper locations:

- Section 7.10.1: replication, multivariate control, and single-turn-vs-multi-turn scope condition.
- Revision history v3.0.54: records the D1 follow-up scripts, reports, and integration boundary.
- Atlas module: `recognition-calibration` (status: settled).
