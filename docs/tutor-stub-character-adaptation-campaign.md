# Tutor-stub character adaptation campaign

The reusable campaign definition is
`config/tutor-stub-campaigns/character-adaptation-v1.yaml`. It freezes the
working case, models, seeds, diagnostic recovery semantics, strict gates, seed
retirement rules, and cross-world acceptance case.

## Run order

1. Run diagnostic collection on Marrick with the affectively resistant learner
   and seed `20260714`. Collect all ten turns even after quarantines.
2. Cluster the complete report by root cause. Make one coordinated fix batch
   and add regression tests for the addressed clusters.
3. Run strict working verification with seed `20260714`. Return to diagnostics
   if any strict gate fails.
4. Only after the strict working run passes, use the active held-out seed
   `20260715` without tuning against it.
5. Finish with `world_023_greyfen_lab` and `false_memory`. Seeds `20260716`
   through `20260721` are retired. The next predeclared transfer seed is
   `20260722`; do not use it until the working and primary held-out gates pass
   for the code under test.

When the campaign-aware runner is available, the intended entry point is:

```bash
npm run tutor:stub:character-loop -- \
  --campaign config/tutor-stub-campaigns/character-adaptation-v1.yaml
```

Until that option is wired into the runner, treat the YAML as the source of
truth and pass its stage-specific values explicitly. Do not substitute another
seed silently.

## Acceptance discipline

Diagnostic evidence after the first quarantined turn is useful for finding
recurring guard failures, but it is trajectory-contaminated and cannot certify
the fix. Strict verification allows no quarantines and retains the existing
fail-fast gates.

If an acceptance run is inspected and any code, prompt, world, policy, or guard
is subsequently changed, record that seed as retired. Promote the next unseen
reserve from the manifest before attempting acceptance again. Any change made
after inspecting the held-out world invalidates that cross-world result and
requires a newly predeclared campaign version.

Each campaign artifact set must preserve the manifest snapshot, Git and config
hashes, complete candidate/audit envelopes, quarantine and contamination
boundaries, root-cause clusters, regression-test results, and terminal state.
