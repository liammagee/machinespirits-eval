# A18.26 Fresh Post-V2 Family Local Result

Date: 2026-06-06

Status: mixed local result; no panel candidate.

## Family

Config:

`config/recursive-tutor-learning/a18.25-fresh-family-v2.yaml`

Family:

`diagonal_socket_priority`

Chain:

`exports/recursive-tutor-learning/a18.25-fresh-family-local`

## Attempt 1

The first Codex attempt failed before generation because the nested Codex CLI
hit its local usage limit. The run was retried with Claude as generator and
`agy` as checker.

Attempt-1 replay command:

```bash
node scripts/replay-discursive-transcript.js \
  --transcript exports/recursive-tutor-learning/a18.25-fresh-family-local/diagonal_socket_priority/training-seed.full.md \
  --generator claude \
  --checker agy \
  --recursive-tutor-learning-gate \
  --out-dir exports/recursive-tutor-learning/a18.25-fresh-family-local/diagonal_socket_priority/attempt1-replay \
  --timeout-ms 900000 \
  --force
```

Result:

- `survivor: 1`

Policy fill:

- `filled: 1`

## Held-Out Local Screens

| Sibling | S0 | S1 | Raw local verdict | Effective local verdict | Policy contrast | Distinctiveness | Policy correctness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `socket_holdout_red_upper` | survivor | survivor | `no_local_headroom` | `no_local_survivor` | `not_policy_distinct` | `0.111` | `no_correct_policy_application` |
| `socket_holdout_blue_lower` | `revise_again` | survivor | `policy_memory_local_advantage` | `policy_memory_local_advantage` | `policy_distinct` | `0.166` | `policy_memory_correctness_advantage` |

No panel was run because the family produced only one local candidate.

## Failure Diagnosis

The red sibling shows a target-rule ambiguity. Both arms survived locally but
failed selected-policy correctness:

- S0 chose the wrong target (`right reku`) while naming an `opposite corner`
  relation.
- S1 named the correct target alias only incidentally and still steered the
  learner to the wrong target (`right reku`), without selected-repair markers.
- The pair missed the policy distinctiveness threshold (`0.111 < 0.12`).

The public/policy phrasing let the model replace the intended "opposite/completing
position" relation with a simpler "matching tick position" relation. That makes
the selected repair unstable: the family has a valid local candidate on the blue
sibling, but not a reliable family-level transfer pattern.

## Interpretation

A18.26 is a local negative for `diagonal_socket_priority`. It does not challenge
the v2 panel rule because the family never reached the panel gate. The useful
lesson is fixture-level: if the selected relation is an inverse/completion
relation, the policy memory must make the old same-position check visibly fail
before the held-out public continuation can be expected to use the inverse
relation.

## Next Move

Do not panel this family. The next zero-API move is to diagnose whether a repair
should tighten the family around "same position duplicates; opposite position
completes" or abandon this family and author a different post-v2 relation.
