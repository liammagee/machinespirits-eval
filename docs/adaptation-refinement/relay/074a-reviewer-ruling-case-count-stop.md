# 074a — Reviewer ruling: v3 case-count stop is TECHNICAL; corpus quarantined

**Date:** 13 August 2026. Rules on driver report 074 (`5eea75f9`).
Authority: rulings 052a (technical-vs-substantive), 052b (ceiling
11,337), 054 (presence-grain instrument), GO note 073a.

## Ruling

1. **Report 074 is ACCEPTED.** The driver ran the GO-note command
   verbatim once, stopped at the frozen case-count guard (143/144),
   amended nothing, and reported with full accounting. No misconduct.
2. **The stop is TECHNICAL under 052a.** The cause is an
   analysis-pipeline gap, not a semantic result: at dialogue 11
   (world 102, seed 516, gated), turn 5, the strict public learner
   analysis was dispatched and the model reply failed semantic-event
   validation (`events[0].target:
   unspecified_cannot_name_public_identifiers`). The strict parser
   threw fail-closed (`services/tutorStubPublicLearnerAnalysis.js`,
   code `invalid_semantic_events`); the runtime recorded a
   `learner_analysis_unanalyzed` trace event
   (`services/tutorStubLearnerAnalysisRuntime.js:805`) and continued;
   the child sealed **complete** with learner-analysis coverage 7/8.
   The harness has no analyzer retry (`dispatchCount: 1`) and no
   coverage check before sealing complete. The frozen corpus builder
   correctly excluded the unanalyzed turn; the guard correctly
   refused. Nothing waived: **the 144-case gate stands as frozen.**
3. **Log-vs-seal discrepancy resolved.** The child log's completion
   line `coverage 1` reports DAG best-path coverage, a different
   metric that reached 1.0 by turn 8. Learner-analysis coverage lives
   only in the seal metadata. Two metrics share one word; no artifact
   disagrees with any other.
4. **v3 dialogues 1–18 are QUARANTINED from outcome admission.**
   All seals are preserved unchanged. A 143-case partial corpus
   supports no ruling (v2 precedent). No reader may run on it.
5. **GO note 073a is CONSUMED.** The plan literals
   (counter_before 3,613) no longer match reality and must be
   re-pinned before any fresh take.
6. **Counter:** 3,613 + 454 = **4,067 / 11,337**. Remaining 7,270.
   Unspent portion of the authorized block: 662. Per 052a's re-take
   authority ("as many takes as we need" for technical failures) and
   the in-session human approval of the 1,116-call plan, a fresh v4
   take is authorized once the repair passes review and a fresh GO
   note is committed.

## Morning-review flags (carried + new)

- All prior flags from rulings 069a/070a/071a stand.
- New: the generation phase is now proven twice-stable (18/18 sealed,
  454 calls, zero quarantines) — the residual risk is concentrated in
  per-turn analyzer robustness, which direction 075 addresses.

Direction 075 follows. Report file: 076.
