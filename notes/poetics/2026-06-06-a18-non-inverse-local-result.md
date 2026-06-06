# A18.29 Non-Inverse Fresh Family Local Result

Date: 2026-06-06

Status: local negative; no panel candidate.

## Family

Config:

`config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml`

Family:

`thread_source_priority`

Chain:

`exports/recursive-tutor-learning/a18.28-fresh-family-local`

## Attempt 1

Attempt-1 replay used Claude as generator and `agy` as checker because nested
Codex quota was exhausted.

Result:

- `survivor: 1`

Policy fill:

- `filled: 1`

## Held-Out Local Screens

| Sibling | S0 | S1 | Raw local verdict | Effective local verdict | Policy contrast | Distinctiveness | Policy correctness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `thread_holdout_red_left` | survivor | survivor | `no_local_headroom` | `no_local_survivor` | `policy_distinct` | `0.222` | `no_correct_policy_application` |
| `thread_holdout_blue_lower` | survivor | survivor | `no_local_headroom` | `no_local_survivor` | `policy_distinct` | `0.278` | `no_correct_policy_application` |

No panel was run.

## Diagnosis

The family failed for a different reason than `diagonal_socket_priority`.

`diagonal_socket_priority` failed because the intended inverse/completion
relation was unstable and the model drifted to same-position matching.

`thread_source_priority` failed because the selected relation was too publicly
inferable. The visible "little round nub touches the correct token" cue let S0
reach the correct target without policy memory.

The policy-correctness reporter marks both S1 continuations as missing selected
repair markers because the generated language used terms such as `source`,
`origin`, `round nub`, and `round end`, while the registered markers were
phrases such as `source end`, `source dot`, and `origin nub`. But broadening the
marker set would not rescue the family: S0 also reaches the correct targets via
the visible nub/contact-shape cue, so the decisive failure is no local headroom,
not just marker mismatch.

## Representative Evidence

`thread_holdout_red_left`, S1:

> "The round nub marks where the thread begins--its source."

`thread_holdout_blue_lower`, S1:

> "It marks where the thread starts. Color and nearness just looked decisive--they don't say which word is the source."

Those are policy-like, but S0 also gets the target:

`thread_holdout_red_left`, S0:

> "The left one has the nub touching and the point facing away... Left vemi."

`thread_holdout_blue_lower`, S0:

> "The nub sits on lower sato--so lower carries the tag."

## Interpretation

This is a local negative for `thread_source_priority`. It shows the other side
of the family-design problem:

- make the relation too inverse or abstract, and S1 may not stably apply it;
- make the relation too visible and non-inverse, and S0 solves it without
  policy memory.

The post-v2 protocol is executable, but the remaining bottleneck is scenario
family construction: the selected repair must be publicly usable after tutor
policy transfer while still not being the obvious public repair for S0.

## Next Move

Stop generating fresh families until A18.30 synthesizes the current local
failure taxonomy and states a stricter design constraint. Otherwise the loop is
likely to alternate between "too hidden/unstable" and "too public/self-solving."
