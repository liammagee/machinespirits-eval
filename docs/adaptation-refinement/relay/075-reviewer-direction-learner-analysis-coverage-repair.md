# 075 — Reviewer direction: make unanalyzed turns impossible in a complete seal

**Date:** 13 August 2026. Authority: ruling 074a. **Zero paid model
calls.** Harness repair only: no run artifact may be touched, no
frozen instrument surface amended, no launch performed.

## The defect

A turn whose strict public learner analysis fails validation is
recorded as `learner_analysis_unanalyzed`
(`services/tutorStubLearnerAnalysisRuntime.js:805`) and the child
still seals **complete**. In v3 this produced dialogue 11 with
coverage 7/8; the frozen corpus builder then extracted 143/144 cases
and the launcher refused after the full 454-call generation spend.
One transient invalid model reply at turn 5
(`invalid_semantic_events`,
`events[0].target: unspecified_cannot_name_public_identifiers`) cost
the whole take. The failure must surface at the turn (cheap) or the
seal (bounded), never at the corpus builder (expensive).

## Required repair — four parts

1. **Bounded analyzer retry.** When the strict public learner
   analysis fails (`invalid_semantic_events`,
   `invalid_analysis_schema`, `empty_analysis_output`, or model-call
   error), re-dispatch the analysis as a **fresh model call** up to
   **2 retries per turn**, each reserving budget normally under the
   unchanged 30-call per-dialogue cap. Do NOT relax the strict
   parser: no fence extraction, no output repair, no schema change,
   no prompt change (`handbook_v1` stays byte-identical). A retry is
   a new sample, not a repair of the bad one. Trace every attempt
   (attempt index, failure code) so retries are auditable.
2. **Fail-closed child seal.** A child whose learner-analysis
   coverage over public turns is below 1.0 after retries must NOT
   seal `complete`. Seal with a distinct failed status naming the
   unanalyzed turns. Coverage must be computed from the same source
   the corpus builder reads.
3. **Launcher seal-time coverage guard.** In
   `scripts/run-adaptive-warrant-outcome-pilot.js`, verify at each
   dialogue seal that learner-analysis coverage is 1.0, from the
   sealed artifacts, before counting the dialogue complete. On a
   miss, quarantine that dialogue immediately with a named reason and
   follow the existing child-failure disposition. The frozen 144-case
   guard stays exactly as it is — it becomes a backstop, not the
   first detector.
4. **Regression tests on real artifacts.** Fixtures may copy (never
   move or edit) the v3 dialogue-11 trace lines, with provenance
   noted. Tests must cover: (a) an `invalid_semantic_events` failure
   triggers a retry and a valid second sample yields full coverage;
   (b) persistent failure after retries produces a non-complete seal
   naming turn 5; (c) the launcher quarantines a sealed dialogue with
   coverage below 1.0; (d) the retry consumes budget reservations and
   respects the 30-call cap.

## Counter re-pin

Update the frozen plan literals and their guard/tests from ruling
074a's counter: `counter_before: 4067`,
`counter_after_if_completed: 5183`, `remaining_after: 6154`, ceiling
11,337 unchanged. The 1,116-call plan shape (540 + 288 + 288, 30-call
cap) is unchanged.

## Boundaries

- Zero paid calls. Mock/pure-render paths only.
- Never touch `.tutor-stub-auto-eval/**` (v1–v3 artifacts are
  quarantine-preserved), the freeze manifest, the menu file, the
  world files, the readers, or the analysis prompt profile.
- ESLint + the adaptive-warrant suites must pass.
- Commit with the standard trailer discipline; **never push**.
- Report to `docs/adaptation-refinement/relay/076-codex-report.md`:
  what changed, retry semantics, seal semantics, test counts, commit
  SHA. Make no launch; the v4 relaunch needs a fresh GO note after
  both-session review.
