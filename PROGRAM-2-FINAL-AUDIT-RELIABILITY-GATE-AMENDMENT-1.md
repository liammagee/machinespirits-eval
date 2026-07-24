# Program 2 common final-audit reliability gate — Amendment 1

Status: **FROZEN 2026-07-24; REPAIR LICENSE ONLY.** This amendment is separate
from the weights × interface factorial and its excluded paid smoke. It licenses
one common downstream reliability repair and one fresh excluded four-cell smoke
only. It does not license the 48-dialogue cohort or semantic judging.

Parent artifacts:

- `PROGRAM-2-WEIGHTS-INTERFACE-FACTORIAL-PREREGISTRATION.md`
- `notes/program-2/2026-07-24-weights-interface-paid-smoke-hold.md`
- `exports/program2-weights-interface-factorial-paid-smoke/launch-plan.json`
- `exports/program2-weights-interface-factorial-paid-smoke/launch-state.json`

## 1. Fixed replay corpus

The zero-model diagnosis and regression fixtures are limited to the four
counted deterministic final-audit failures below. Their trace hashes freeze the
inputs before runtime code changes.

| Failure | Archived trace | SHA-256 | Recorded final-audit findings |
|---|---|---|---|
| R1 | `p2wi-smoke-01-proof_skipper-untuned_v1-r1/2026-07-24T09-37-11-989Z.jsonl` | `0f0a91879a69df7f88a377c5abd4259572f3041c91db2f1c497490b797242906` | `private_final_conclusion`; `axis_not_visible` |
| R2 | `p2wi-smoke-03-proof_skipper-trained_v2-r1/2026-07-24T10-09-49-794Z.jsonl` | `1310270bd0aa2a938a9e83109a7be1378156cb09797df046852f3dbaf511cfd2` | `generic_learner_uptake`; `learner_uptake_not_realized` |
| R3 | `p2wi-smoke-03-proof_skipper-trained_v2-r1/2026-07-24T10-22-21-315Z.jsonl` | `89f9ca7ab42112cd7186ecf13bf2e5fbd40c2711b9201965907ea12bcf52d7da` | `private_final_conclusion`; `axis_not_visible` |
| R4 | `p2wi-smoke-04-proof_skipper-trained_v1-r1/2026-07-24T10-33-37-479Z.jsonl` | `c03912e228690c83b53795deb9c35b79e1d7aa43748b3298690cc5fe577f6227` | `duplicate_clue_delivery`; `axis_not_visible` twice |

The archived launch plan hash is
`d6f380ef623767357c55636efc82fff066a27d8d78cd045afc4d0357eabd71f9`.
The archived launch-state hash at freezing is
`a436e17487c137971a5a96966925cdbebcbc3dd8f0e50029379e0c96b91a17d7`.

Each failure must first reproduce without provider or mini-model calls. The
replay report must classify it as exactly one of:

1. `true_unsafe_draft`: the final candidate is correctly rejected and the
   public state cannot support a deterministic replacement under the frozen
   response contract;
2. `fallback_construction_defect`: the audits are correct and the same public
   state supports a deterministic, contract-satisfying response, but the
   common fallback failed to construct it; or
3. `audit_input_mismatch`: the audit was given a stale or wrong public-state,
   release, configuration, or progression input.

## 2. Permitted repair

The repair may change only shared downstream deterministic response
construction or the wiring of already-frozen public inputs into that
construction. It may add a zero-model replay/classification tool and regression
fixtures.

The repair may not:

- weaken, bypass, relabel, or special-case any final audit;
- inspect a registered semantic outcome or the six-word cue to choose a turn;
- change the committee detector, mini prompts, trained/untuned weights, v1/v2
  extraction, cue-blind composer, fallback policy, learner profiles, world,
  models, seeds, retries, or judge instrument;
- resample a mini response or add a provider call; or
- tune against cell identity or the desired factorial result.

A fallback may use only the same public learner message, committed public
evidence, due release, response-composition contract, response configuration,
and live-turn progression state already available to every treatment cell.

## 3. Ordered gates

1. Verify the frozen hashes and reproduce all four failures with zero model
   calls.
2. Record the four classifications and the common causal mechanism.
3. Implement the narrow common repair and prove all four fixtures pass the
   unchanged final audits.
4. Run focused regression tests, the full test suite, lint, workplan checks,
   `npm run derivation:quality`, and the prompt/world audit tests. Any unrelated
   pre-existing failure must be reported and must not be concealed.
5. Commit and push the repair under a clean 40-character SHA.
6. Generate a fresh `weights-interface-smoke` plan and prove its four treatment
   commands, fixed flags, seeds, and ordering match the archived smoke except
   for output-root and implementation-SHA provenance.
7. Run the same excluded four-cell paid smoke from a fresh output root using
   the user's existing Sonnet/Terra data-sharing and paid-run authorization.
8. Run the 11-check provenance audit and verify zero mini resamples.

## 4. Decision rule

The reliability gate passes only if the fresh smoke seals **4/4**, has no
finalized attrition, uses at most one recovered retry across the four jobs,
passes **11/11** provenance checks, records **zero** mini resamples, and leaves
the treatment commands unchanged. A pass authorizes a new explicit decision
about the 48-dialogue cohort; it does not launch it automatically.

Any fresh smoke failure, audit weakening, treatment-command drift, cue-aware
decision, mini resample, or more than one recovered retry leaves the factorial
on hold. There are no replacement smoke jobs and no post-outcome threshold
changes.
