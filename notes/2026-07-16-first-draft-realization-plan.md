# Tutor-stub first-draft realization plan

## Outcome

Make the speaking tutor satisfy the existing response checks on its original
candidate more often. The visible result should be fewer `response revised`
and `safe fallback used` notices, lower end-to-end tutor latency, and replies
that acknowledge the learner and inhabit the selected part from their opening
words.

This is an upstream generation-quality project. It must not improve its headline
numbers by weakening, bypassing, or reclassifying any delivery check.

## Current evidence

Character-generalization V17 passed every strict delivery gate across four
fresh scenario/profile pairings. Across its 36 delivered turns it still found
candidate-level realization failures before delivery:

- selected performance tactic not visible enough: 13 occurrences;
- selected actorial part not visible enough: 9;
- learner contribution not acknowledged before development: 7;
- missing clarification invitation: 6;
- exhibit not visibly handled: 3;
- newly released clue stated too abstractly: 2.

Foxtrot and AI syllabus needed no deterministic fallback. Sealhouse and Hethel
needed one each. These are rejected or repaired candidate counts, not unsafe
messages shown to learners.

## Working hypothesis

The speaking model receives the right information, but the turn contract is
distributed across several overlapping instruction blocks: response policy,
configuration axes, uptake/development composition, dramatic release, learner
analysis, learner-DAG state, question support, closure, and evidence safety.
This makes the original candidate solve instruction reconciliation as well as
the pedagogical scene.

Compile those inputs into one short, public-safe, internally compatible turn
contract before the speaking call. Keep the detailed state in traces and keep
the existing checks after generation.

## Change set

1. **Instrument the baseline.** Report original-candidate acceptance,
   mechanical repair, model rewrite, deterministic fallback, per-attempt model
   latency, total tutor-generation latency, and first-candidate failure
   clusters separately.
2. **Validate configuration compatibility.** Resolve conflicts between the
   action family, actorial host part, performance tactic, clue presentation,
   scene immersion, question support, and closure before generation.
3. **Compile one first-draft turn contract.** State the learner contribution to
   answer, the concrete action to perform, the host part and performance cue,
   the exact currently public clue or exhibit, the language constraints, and
   the supported ending. Prefer executable verbs and scene objects over policy
   labels and explanatory rationale.
4. **Reduce duplicated speaking instructions.** Use the compact contract for
   the original speaking attempt. Retain detailed prompts only where another
   subsystem or audited recovery genuinely requires them.
5. **Preserve strict recovery.** Mechanical repair, model recovery, safe
   fallback, transactional clue rollback, quarantine, and all delivery audits
   remain fail-closed.
6. **Add regression tests.** Cover prompt privacy, clue boundaries,
   uptake-before-development, direct character realization, exhibit handling,
   clarification, closure, compatibility resolution, accounting, and latency
   aggregation.

## Loop

Each working iteration observes the latest first-candidate clusters, selects
the largest actionable cluster, makes one coordinated reversible change, runs
the focused tests and the same working verification, and records whether
original acceptance, repair/fallback use, latency, and transcript realization
improved. Only improvements that retain every strict gate survive.

Known working trajectories may guide changes. Acceptance uses a newly
predeclared scenario/profile/seed matrix that is not inspected or tuned between
cells. If code changes after an acceptance trajectory is inspected, its seed is
retired.

## Acceptance

The loop succeeds when all of the following hold:

- every existing strict V17 gate still passes;
- original-candidate acceptance improves over the recorded working baseline;
- model-rewrite and deterministic-fallback dependence both decrease rather
  than being hidden under a renamed repair path;
- total tutor-generation latency decreases on the fixed working comparison;
- first-candidate missing-uptake, missing-host-part, missing-performance-tactic,
  opaque-release, missing-exhibit-action, and missing-clarification clusters
  decrease;
- the fresh held-out matrix confirms the improvement without tuning between
  cells;
- sampled accepted replies begin with transcript-specific uptake or direct
  in-scene action, not stock transition language or meta-performance.

If a full iteration produces no measurable improvement, record the loop as
`stagnated` rather than loosening a gate or claiming success. Infrastructure
failures and irrecoverable state corruption remain separate blocked outcomes.

## Claim boundary

Passing this loop demonstrates more reliable first-draft realization and lower
repair overhead for the tested simulated scenario/profile/model combinations.
It does not by itself establish human learning effectiveness, population-wide
generalization, or that every stylistically acceptable response will be judged
helpful by a human learner.

## Implementation and verification record

Implemented on 2026-07-16:

- a compact, ordered first-draft contract for learner uptake, public action,
  host part, performance tactic, clue presentation, ending, and language;
- original-attempt use of that compact contract while retaining detailed
  planner surfaces for traces and audited recovery;
- separate accounting for original acceptance, mechanical repair, model
  rewrite, deterministic fallback, and whole tutor-generation latency;
- source-reporting cues that keep first person on the reporting act while
  preserving named actors, ownership, possession, and family relations;
- hard guards for source-perspective drift, narrator-labelled source casting,
  and substantial sentence duplication inside one reply;
- a fused-opening repair that no longer inserts the learner uptake twice; and
- focused regression coverage for the new contract, accounting, recovery,
  source semantics, host/source separation, and repetition behavior.

Measured runs, all with the same Marrick world, affectively resistant learner,
seed `20260714`, Terra speaking/learner, Sol interpretation, low effort, and
unchanged safety gates:

| Run | Original drafts | Mechanical | Model rewrites | Fallbacks | Mean tutor generation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline i27 | 3/10 | 2 | 5 | 0 | 11,728 ms |
| Working i31 | 8/10 | 0 | 2 | 0 | 10,782 ms |
| Strict i33 | 7/10 | 2 | 1 | 0 | 8,914 ms |
| Strict i34 | 5/10 | 1 | 5 | 0 | 14,842 ms |

The working and i33 strict results demonstrate the intended reduction in
repair dependence and latency. Qualitative inspection of i33 nevertheless
found a duplicate fused opening, and i34 found narrator-led source casting;
both defects are now covered by deterministic hard checks and tests. The i34
latency also shows material external/model variance, so latency should be
reported over multiple cells rather than inferred from one trajectory.

Strict i35 was stopped after three preserved turns when the user requested a
handoff. Its partial trace is at
`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-realization/strict-working-i35`.
It is diagnostic evidence, not an acceptance run.

Strict i36 subsequently passed the complete working prerequisite with 6/10
original candidates accepted, four model rewrites, no fallback, no delivery
failure, and every existing strict gate intact.

Fresh held-out V18 then completed under the frozen configuration recorded in
`config/tutor-stub-campaigns/first-draft-generalization-v18.yaml`. It failed
acceptance: two of four cells passed, aggregate original-candidate acceptance
was 18/32 (56.25%) against the 70% gate, and the Skyway answer-seeking cell
accepted only 2/7 originals before terminal recovery failure. The aggregate
model-rewrite rate (9/32) and total fallback count (2) remained within their
matrix ceilings, but all-four-cell strict completion did not.

The full result and failure clusters are recorded in
`notes/status/2026-07-16-first-draft-generalization-v18.md`. V18 is preserved as
failed acceptance evidence. Any implementation change retires its four seeds;
the next acceptance matrix must be predeclared afresh.
