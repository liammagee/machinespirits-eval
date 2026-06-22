# A20 Conduct-Policy Replayable Fixtures

Date: 2026-06-16

## Scope

This increment makes the first two A20 conduct-policy fixtures reproducible in
two ways:

1. a pure fixture gate over `selectConductMove`;
2. a zero-cost mock episode panel with prefix-integrity checks.

No paid LLM calls were launched.

## New Commands

```bash
npm run derivation:a20-fixtures
npm run derivation:a20-replay-panel
```

The first command reads
`exports/dramatic-derivation/a20-conduct-policy/first-policy-fixtures.json`,
runs each trigger through `selectConductMove`, audits non-leak, and emits:

- `exports/dramatic-derivation/a20-conduct-policy/fixture-gate-report.json`
- `exports/dramatic-derivation/a20-conduct-policy/fixture-gate-report.md`

The second command runs the two first fixtures as mock episode replays and
emits:

- `exports/dramatic-derivation/a20-conduct-policy/replay-panel-report.json`
- `exports/dramatic-derivation/a20-conduct-policy/replay-panel-report.md`

## Fixture Gate

| fixture | world | turn | expected | selected | reason | non-leak | pass |
|---|---|---:|---|---|---|---|---|
| `a20-fixture-001-dependency-repair-reference` | `world_004_withercombe` | 14 | `repair_dependency` | `repair_dependency` | `dependency_repair_needed` | pass | pass |
| `a20-fixture-002-hidden-hurts-candidate` | `world_006_hethel` | 4 | `ask_diagnostic` | `ask_diagnostic` | `valid_alternative_candidate` | pass | pass |

## Replay Panel

| fixture | source | episode | turn | expected | selected | compliance | prefix | release | verdict |
|---|---|---|---:|---|---|---|---|---|---|
| `a20-fixture-001-dependency-repair-reference` | `withercombe-selector-v4-isolation-debt-hidden-r1` | `a20-panel-dependency-repair-reference` | 14 | `repair_dependency` | `repair_dependency` | pass | pass | none | `cap_reached` |
| `a20-fixture-002-hidden-hurts-candidate` | `hethel-selector-v1-hidden-r2` | `a20-panel-hidden-hurts-candidate` | 4 | `ask_diagnostic` | `ask_diagnostic` | pass | pass | none | `cap_reached` |

The Hethel fixture is now replayable without creating selector-v5: the replay
uses the actual hidden-failure source (`hethel-selector-v1-hidden-r2`) and
injects the predeclared fixture trigger only for turn 4 via the episode CLI's
`--conduct-trigger` path. The local policy selects `ask_diagnostic`, realizes a
`test` move targeting `p_point`, and releases no evidence on that trigger turn.

## Implementation Notes

- `run-derivation-episode.js` now accepts `--conduct-trigger` and
  `--conduct-trigger-file`, both episode-only.
- `runDrama` carries `conductTriggerOverride` into the tutor view only when
  conduct policy is active.
- The tutor conduct-policy bridge merges the override with ordinary public
  evidence and, if present, proofDebt tutor view. The existing policy priority
  then decides the move.
- The full derivation loop remains unchanged: there is no automatic live
  detector and no selector-v5 route.

## Validation

```bash
npm run derivation:a20-fixtures
npm run derivation:a20-replay-panel
node --test tests/derivationA20TriggerCorpus.test.js tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
npm test
```

Results:

- fixture gate: 2/2 pass
- replay panel: 2/2 pass
- focused tests: 30/30 pass
- full `npm test`: pass, 3709 passed, 1 skipped, 0 failed

## Caveats

- These are local replay artifacts, not held-out paid evidence.
- The Hethel hidden-hurts case is still manually bound to a frozen trigger from
  selector-comparison evidence. That is intentional: it tests the conduct-policy
  interface without silently reclassifying selector-v4 or creating selector-v5.
- The next gate is a paid first-pass mini-run only if we decide this local
  policy behavior is worth testing outside replay.
