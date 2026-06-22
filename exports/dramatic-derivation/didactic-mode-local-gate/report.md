# Didactic Mode Local Gate

Date: 2026-06-16

## Scope

This is a local/mock gate for the didactic-mode increment. It validates wiring and prefix-controlled replay behavior only. It is not paid validation and does not claim proof-control improvement or human-learning improvement.

Implemented surface:

- `deriveDidacticModeState(...)` remains a deterministic public-only state object.
- Rhetorical policy can consume non-unknown didactic pressure while preserving proof intent and target.
- `--didactic-mode` is available in loop and episode replay CLIs.
- Tutor turn metadata, `live.json`, `result.json`, and diagnosis reports carry compact didactic-mode rows.
- Acts mode can carry a public didactic fallback from a closed act into the next act.

## Local Gate

Source:

```bash
node scripts/run-derivation-loop.js --world config/drama-derivation/world-000-smoke.yaml --label didactic-mode-local-src --out exports/dramatic-derivation/didactic-mode-local-gate/loop --critic off --scene-mode on --rhetorical-policy --discursive-calibration --didactic-mode
```

Episode:

```bash
node scripts/run-derivation-episode.js --from exports/dramatic-derivation/didactic-mode-local-gate/loop/didactic-mode-local-src --turn 3 --window 3 --label didactic-mode-local-episode-t3 --out exports/dramatic-derivation/didactic-mode-local-gate/episodes
```

## Results

| Artifact | Verdict | Turns | Final D | Prefix |
| --- | --- | ---: | ---: | --- |
| `didactic-mode-local-src` | `grounded_anagnorisis` | 8/14 | 0 | n/a |
| `didactic-mode-local-episode-t3` | `cap_reached` | 5/14 | 1 | `ok: true`, 0 mismatches |

Source didactic report:

- rows: 8
- signals: `unknown` x6, `stalled` x2
- modes: `slow_recap` x8
- leak audit: clean
- act fallbacks: none in this scene-only mock source

Episode didactic report:

- rows: 3
- signals: `unknown` x3
- leak audit: clean
- inherited source conditions with no overrides
- window intentionally exhausted at turn 5

## Hethel Candidate Gate

The first candidate non-uptake prefix used the A21 Hethel trigger fixture:
`exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1`,
live from turn 4 after preserving the failed overlay prefix through turn 3.

S0:

```bash
node scripts/run-derivation-episode.js --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 --turn 4 --window 8 --pacing-guard on --pacing-guard-visible off --pacing-guard-selective off --pacing-guard-selective-v1 off --pacing-guard-selective-v2 off --pacing-guard-selective-v3 off --pacing-guard-selective-v4 off --proof-debt-guard on --conduct-policy off --conduct-progress-policy off --conduct-policy-enforce off --rhetorical-policy on --discursive-calibration on --didactic-mode off --critic off --label didactic-hethel-candidate-s0-discursive-from-t4 --out exports/dramatic-derivation/didactic-mode-candidate-gate/episodes
```

S1:

```bash
node scripts/run-derivation-episode.js --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 --turn 4 --window 8 --pacing-guard on --pacing-guard-visible off --pacing-guard-selective off --pacing-guard-selective-v1 off --pacing-guard-selective-v2 off --pacing-guard-selective-v3 off --pacing-guard-selective-v4 off --proof-debt-guard on --conduct-policy off --conduct-progress-policy off --conduct-policy-enforce off --rhetorical-policy on --discursive-calibration on --didactic-mode on --critic off --label didactic-hethel-candidate-s1-didactic-from-t4 --out exports/dramatic-derivation/didactic-mode-candidate-gate/episodes
```

| Arm | Verdict | Turns | End D | Prefix | Release ledger after prefix |
| --- | --- | ---: | ---: | --- | --- |
| S0 discursive only | `cap_reached` | 11/26 | 3 | `ok: true`, 0 mismatches | `p_point@t4`, `m_yard@t6`, `m_bond@t8`, `p_surface@t9` |
| S1 didactic overlay | `cap_reached` | 11/26 | 3 | `ok: true`, 0 mismatches | `p_point@t4`, `m_yard@t6`, `m_bond@t8`, `p_surface@t9` |

S1 didactic report:

- rows: 8
- signals: `stalled` x3, `overloaded` x5
- modes: `slow_recap` x3, `decompose_subtask` x5
- leak audit: clean
- act fallbacks: 3 public advisory fallbacks

This candidate gate changed the advisory/rhetorical regime while preserving the
proof-control channel. For example, the t9 release stayed `p_surface@t9`, but
S0 rendered it as recognitive recap while S1 rendered it as a decompose-subtask
question. In the mock window this did not improve the formal outcome: both arms
ended `cap_reached` at D=3 with the same release ledger. That is local debugging
evidence for safe wiring and discourse texture, not evidence of a proof-control
or learning improvement.

## Interpretation

The CLI/runtime plumbing works: the flag is persisted, episode replay inherits it, tutor lines carry public-only didactic state, and prefix integrity is preserved.

The local source is not evidence that didactic mode improves proof outcomes. Most mock turns have no didactic pressure, so `unknown` states are recorded for audit but no longer bias prompt/rhetorical policy. This avoids the earlier failure mode where no-pressure turns collapsed rhetoric into repeated `slow_recap`.

The act-level path is covered by a focused unit/runtime test rather than this smoke source: a public `next_act` didactic state on a closed act is carried forward as `didacticFallback`, with `mayOverrideProofControl: false`.

## Validation

Passed:

```bash
node --test tests/dramaticDerivationDidacticMode.test.js
node --test tests/dramaticDerivationReplay.test.js
npm test
```

Full `npm test` passed with 3774 passing tests, 1 skipped test, and 0 failures.

## Boundary

No paid run is warranted from these gates alone. The Hethel candidate shows that
S1 can alter explanatory regime without disrupting hidden + proofDebt, but it
does not yet show better uptake, engagement, turn count, impasse risk, or final
grounding. A paid mini-run should wait for a replay gate where S1 shows one of
those causal gains locally.
