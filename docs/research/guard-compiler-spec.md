# Dynamic Guard Compiler Spec, P1a Replay Slice

**Status:** implemented as a static replay-first slice, not a live runtime compiler.  
**Entry point:** `npm run derivation:guard-compiler`  
**Generated artifacts:** `exports/dramatic-derivation/guard-compiler/`

## Scope

This slice tests whether the dramatic-derivation guard work can be represented as inspectable specifications before building a larger compiler.

It does:

- normalize existing worlds into `WorldIR`;
- compile static `GuardSpec` JSON for hidden pacing, proof-debt repair, and visible projection;
- replay archived lantern and Marrick arms through the existing detector-split and release-solvency readers;
- emit per-world reports that distinguish topology, guard specification, failure-mode movement, and played-release safety.

It does not:

- author guard logic with an LLM;
- change live runtime behavior;
- schedule new evaluation arms;
- certify visible guards globally;
- make human-learning claims.

## Pipeline

```text
WorldSpec
  -> WorldIR
  -> GuardSpec
  -> Archived-arm replay report
```

The implementation is deliberately conservative. `WorldIR` and `GuardSpec` are deterministic products of the committed world file plus the existing symbolic derivation utilities. Runtime execution remains unchanged.

## WorldIR

`WorldIR` records:

- world identity, question, secret, mirror, and turn cap;
- entities and background facts;
- public Horn-style rules;
- premises with proof-path role, scheduled turn, and release authority;
- authored proof paths;
- the realized proof tree for the secret;
- top-level secret branches and whether they are independent;
- release calendar and slope constraints.

The top-level branch analysis is the first useful topology check:

- Lantern has two top-level secret branches that overlap on the burning-lamp fact, so it is replay-gated rather than automatically rejected.
- Marrick has two disjoint top-level branches (`castBlankFor` and `cutDieFor`), so unchanged visible projection is marked as topology-risky before any new run.

## GuardSpec

`GuardSpec` currently emits three guard blocks.

### Hidden Pacing

Hidden pacing is compiled as a static reference over each tutor-controlled release:

- objective: avoid tempo starvation;
- inputs: proof distance, release ledger, release calendar, aporia window;
- forbidden tutor view: proof distance, proof path, secret, D arithmetic;
- output: reference safe/unsafe release turns for each tutor-controlled exhibit.

The static safe-turn table is not a replacement for live `pacingGuardDecision`. It is a replay reference used to inspect the same policy family.

### Proof Debt

Proof debt is compiled as a tutor-view contract:

- trigger: released, proof-critical, absent/corrupted, restoration lowers D;
- tutor-visible fields: `premiseId`, `surface`, `sinceTurn`;
- forbidden fields: raw board, corruption ledger, proof path, secret, D arithmetic.

This mirrors the existing non-leak boundary: the harness may calculate hidden arithmetic, but the tutor only receives a narrow restore request.

### Visible Projection

Visible projection is treated as a candidate, not a certified guard:

- inputs: release ledger, transcript surface, prior exhibit surface;
- forbidden inputs: proof distance, proof path, secret, raw board, corruption ledger;
- features: turns since release, exhibit echo, hedging/gap markers, content-length trend, branch-coverage surface markers.

Certification is replay-based. A visible projection must agree with the hidden reference on the target world distribution and must not produce catastrophic false releases. The current P1a artifacts therefore mark:

- `world_002_lantern`: `candidate_requires_replay`;
- `world_005_marrick`: `uncertified_topology_risk`.

## Replay Output

The report writes:

- `world-ir-world-002-lantern.json`;
- `guard-spec-world-002-lantern.json`;
- `guard-compiler-report-world-002-lantern.md`;
- `world-ir-world-005-marrick.json`;
- `guard-spec-world-005-marrick.json`;
- `guard-compiler-report-world-005-marrick.md`;
- `guard-compiler-index.{md,json}`.

The key reproduced contrasts are:

- Lantern: unguarded `4 grounded / 6 early-pull`, hidden pacing `4 grounded / 1 decay-seating`, visible `5 grounded`.
- Marrick: unguarded `0 grounded / 2 early-pull / 3 decay-seating`, hidden pacing `5 grounded`, visible `0 grounded / 5 early-pull`.

The played-release safety replay adds a stricter hidden-reference view: visible pacing can ground on lantern while still disagreeing with hidden solvency on some placements; on Marrick that disagreement becomes fatal. This is why visible projection remains certification-gated rather than globally accepted.

## Boundary With P2/P5

This slice is P1-only infrastructure. It should not conflict with:

- P2 work that registers or runs a cross-world guard-isolation matrix;
- P5 work that builds human/LLM/mechanical judge calibration.

Potential conflict surfaces are limited to shared dramatic-derivation files if another agent edits:

- `package.json`;
- `scripts/derivation-guard-compiler.js`;
- `services/dramaticDerivation/guardCompiler.js`.
