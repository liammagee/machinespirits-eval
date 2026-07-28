# Phase 5e zero-model validation

Date: 2026-07-26

The Phase 5e analyzer was pointed at the sealed Phase 5c archive to verify that
the inherited extraction paths remain unchanged:

```bash
node scripts/analyze-program2-live-pilot-5e.mjs \
  /Users/lmagee/.machinespirits-data/program-2/phase5c-live \
  --transfer-world config/drama-derivation/world-027-gazette-recall.yaml \
  --json /private/tmp/program2-phase5e-analyzer-on-phase5c.json
```

It reproduced the sealed counts and component rates:

- committee: 31/61 (`0.508`)
- fresh control: 15/49 (`0.306`)
- exactly-one-question: committee `1.000`, control `0.857`
- warrant cue: committee `0.754`, control `0.653`
- no-new-premise: committee `0.623`, control `0.571`
- guards: `1.000` in both arms
- costume leak: committee 0/61 units; control 4 occurrences/49 turns

The Phase 5e bootstrap seed intentionally changes the displayed E1 interval
from the sealed Phase 5c interval: `[0.069, 0.342]` under seed 20260726 versus
Phase 5c's `[0.072, 0.338]` under seed 20260721. That difference is expected;
the underlying extracted counts are identical.

The new descriptive native frozen-six endpoint also ran over those old control
turns: 42 occurrences in 5,459 words (7.7/1k), with 35/49 turns containing at
least one cue (`record` accounted for 30). This is an extraction validation,
not a new Phase 5c result or a Phase 5e outcome.

## Runner dry-run

The prospective 5e runner passed its zero-model gate:

```bash
node scripts/run-program2-live-pilot.js --dry-run --plan 5e \
  --output-dir /private/tmp/program2-live-pilot-5e-dry-run
```

The artifact reported `modelCallsBeforeArtifact: 0`,
`launchAuthorized: false`, and plan SHA-256
`4eef45dff8cd6344c19c21fe3bf83a0a1ab5963d25c1a000c458980d4aad8034`.
It contains 18 jobs: 10 committee-v2 and 8 fresh controls; every command pins
`world_026_skyway_bakery` and seed 20260726, all 10 committee jobs carry
fallback policy v2, and no control job carries a fallback policy.

Regression fixtures also freeze canonical plan hashes for Phase 5, 5b, and 5c
at their pre-change values. No paid or local-model call was made.
