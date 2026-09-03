# Opus-Sol action-outcome shadow judgment

**Verdict: the exploratory model pair failed its registered diagnostic.** The
original human gates remain pending, and the memory-controller study is not
licensed.

The study gave the same 35 frozen public cases independently to
`codex.gpt-5.6-sol` and `claude-code.opus-5`, both at low effort. All 70 planned
calls completed, with no failed or missing calls and no retries. The run used
exactly 70 of its 70 allowed attempt reservations. The private report is sealed
at SHA-256
`bd4753132840e2c3dea36343e149a413555647b0ce2de6818c2226263692128b`.

## Result

| Measure | Observed | Registered requirement | Result |
|---|---:|---:|:---:|
| Protocol-valid rate, Sol | 35/35 (100%) | at least 90% per seat | pass |
| Protocol-valid rate, Opus | 33/35 (94.3%) | at least 90% per seat | pass |
| Delivery exact agreement | 30/33 (90.9%), κ = 0.791 | descriptive | — |
| Outcome exact agreement | 17/33 (51.5%), κ = 0.361 | descriptive | — |
| Joint exact agreement | 17/33 (51.5%) | at least 80% | fail |
| Paired measurement indeterminacy | 27/35 (77.1%) | at most 20% | fail |
| Exact-consensus binary records | 5/35 | at least 24 | fail |

The five jointly usable binary records comprise two `explain_model`, two
`minimal_support`, and one `request_self_explanation` case. All five were judged
failures; neither judge pair produced an exact-consensus success. No family
reached the required six records. The frozen pattern observer was inconclusive
on all five, so it supplied no confirming binary overlap.

## Interpretation

The two frontier model families can reproducibly identify whether the assigned
tutoring move was delivered. They do not reproducibly decide whether the next
learner turn shows success, partial uptake, failure, or unresolved evidence.
The low outcome agreement and low binary yield therefore reproduce the
measurement problem with semantic judges rather than solving it.

This narrows the role for eventual human work: humans need to anchor the learner
outcome construct, while delivery detection may be largely automatable. It does
not support substituting a model panel for the registered human coders. If human
review stays deferred, this lane stops here with no action-family comparison and
no controller launch.

The result is exploratory measurement evidence over simulated learners. It does
not establish learning or transfer, compare action-family effectiveness,
validate the construct, satisfy the source study's human gates, or license the
memory controller.
