# A20 Conduct-Policy Compiler: Steps 1-5

Date: 2026-06-16

## Scope

This increment executes the first A20 work packet without paid generation:
push current reports, mine existing artifacts, freeze the first two policy
fixtures, refine the conduct-policy object against those fixtures, and validate
with tests plus one mock episode replay.

## Step 1: Push

Pushed branch `claude/derivation-fast-iteration` through commit `5d8669ef`
(`Record Hethel promoted v4 fresh run`).

## Steps 2-3: Artifact-Only Corpus and Frozen Fixtures

Command:

```bash
node scripts/derivation-a20-trigger-corpus.js
```

Outputs:

- `exports/dramatic-derivation/a20-conduct-policy/trigger-corpus-summary.json`
- `exports/dramatic-derivation/a20-conduct-policy/first-policy-fixtures.json`
- `exports/dramatic-derivation/a20-conduct-policy/trigger-corpus-report.md`
- `exports/dramatic-derivation/a20-conduct-policy/trigger-corpus.jsonl`

Only the summary and first-fixture JSON are intended as compact tracked
evidence; the full JSONL corpus remains a generated artifact.

Corpus summary:

| field | value |
|---|---:|
| runs mined | 492 |
| triggers emitted | 1000 |
| skipped artifacts | 0 |

Trigger counts:

| trigger type | count |
|---|---:|
| `dependency_repair_needed` | 895 |
| `visible_hidden_conflict` | 72 |
| `unsupported_assertion_blocked` | 14 |
| `final_assertion_available_but_delayed` | 11 |
| `recognition_rupture_active` | 4 |
| `visible_route_negative_transfer` | 3 |
| `valid_alternative_route_candidate` | 1 |

Frozen first fixtures:

| fixture | role | world | source | turn | expected move |
|---|---|---|---|---:|---|
| `a20-fixture-001-dependency-repair-reference` | dependency repair positive control | `world_004_withercombe` | `withercombe-selector-v4-isolation-debt-hidden-r1` | 14 | `repair_dependency` |
| `a20-fixture-002-hidden-hurts-candidate` | hidden/proofDebt over-repair counterweight | `world_006_hethel` | `hethel-selector-v1-r2` selector comparison | 4 | `ask_diagnostic` |

## Step 4: Conduct-Policy Refinement

The policy object now treats a predeclared `valid_alternative_route_candidate`
as a diagnostic trigger before ordinary proofDebt repair. This is intentionally
narrow: it gives the hidden-hurts fixture a typed counterweight against
implicit always-H behavior, without adding a selector-v5 route or changing
selector-v4 runtime detection.

The priority boundary after this change is:

```text
unsupported assertion
recognition rupture
predeclared valid-alternative candidate
proofDebt/dependency repair
final assertion entitlement
visible-hidden conflict / release fallback
```

This preserves the existing final-turn edge rule: proofDebt repair still
outranks final assertion entitlement, and final assertion still outranks
ordinary visible-consolidation diagnostics.

## Step 5: Local Validation

Focused tests:

```bash
node --test tests/derivationA20TriggerCorpus.test.js tests/dramaticDerivationConductPolicy.test.js
```

Result: 19/19 passing.

Full suite:

```bash
npm test
```

Result: pass, 3707 passed, 1 skipped, 0 failed.

Mock episode replay:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/withercombe-selector-v4-isolation-debt-hidden-r1 \
  --turn 14 \
  --window 4 \
  --conduct-policy-enforce on \
  --label a20-fixture-withercombe-conduct-mock-from-t14 \
  --out exports/dramatic-derivation/episodes
```

Episode outcome:

| field | value |
|---|---|
| prefix integrity | `ok: true` |
| first live turn | 14 |
| window | 4 |
| backend | mock / zero-cost |
| verdict | `cap_reached` due window exhaustion |
| conduct active turns | 4 |
| conduct compliance | 4/4 pass |
| enforcement applied | 0/4; all four were already compliant |
| proofDebt repairs | `p_rill`, `p_lore`, `p_course` across live suffix |

The episode is a local harness check, not held-out evidence. It confirms the
dependency-repair positive-control fixture can be replayed prefix-identically
with conduct-policy enforcement enabled.

## Caveats

- No paid first-pass runs were launched.
- The hidden-hurts fixture is still a fixture-level policy input from selector
  comparison evidence, not a live selector-v5 detector.
- The full trigger corpus is broad and noisy by design; policy promotion should
  be judged by frozen fixtures and replay/fresh-run gates, not raw trigger count.
- This does not alter the paper claim boundary: do not claim adaptive H/V
  selection works from this increment.
