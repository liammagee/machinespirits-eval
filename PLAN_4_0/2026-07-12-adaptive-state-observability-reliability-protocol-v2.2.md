# Adaptive-state observability reliability protocol v2.2

**Date frozen:** 2026-07-12

**Status:** prospectively specified before any v2.2 model call

**Parent evidence:** sealed v2.1 fourth preflight at 23/24

**Claim status:** technical and claim-ineligible

## Decision

Replace the brittle single-draw 24/24 *future* gate with a versioned repeated-
draw reliability gate. Do not reinterpret the stopped v2.1 result: it remains a
failure under its frozen rule. The v2.2 run uses only fresh calls and retains
every draw.

## Critical path

Keep the same three worlds, four intended public event families, two language-
model realizers, public inputs, realizer contract, public-turn analyzer, and
strict evidence-span/leakage checks. Repeat each of the 24 base cells exactly
three times:

```text
24 base cells × 3 fixed draws = 72 learner turns
72 realizer calls + 72 analyzer calls = 144 serial CLI dispatches
```

Three draws are deliberately modest. They distinguish an isolated stochastic
wording miss from a cell that fails repeatedly, while staying below the
339-dispatch full S1 technical pilot. This is an engineering reliability screen,
not a precision estimate or population-level confidence claim.

## Frozen pass rule

All of these must pass:

1. 72/72 cases and 144/144 dispatches complete successfully.
2. At least 70/72 intended event families are recovered exactly.
3. Every complete draw block passes at least 23/24.
4. Every base world × family × realizer cell passes at least 2/3.
5. Every world passes at least 23/24.
6. Every event family passes at least 17/18.
7. Each language realizer passes at least 35/36.
8. Every evidence span is a non-empty exact learner-text substring.
9. No learner text contains a harness event identifier and no analyzer input
   contains a hidden structural target.
10. There are no retries, semantic rerolls, repairs, fallbacks, exclusions, or
    reused rows.

The count gates mean that no more than two misses can pass, and two misses must
be distributed across different draw blocks, base cells, worlds, families, and
realizers. A repeated failure in the same condition therefore stops the gate.

## Execution and lineage

- Run three complete balanced blocks in the fixed order `draw_01`, `draw_02`,
  `draw_03`.
- Use one fresh realizer call and one fresh analyzer call per case.
- Continue after semantic mismatches so the frozen denominator remains 72.
- Stop immediately on a technical failure; never resume the same label and
  never reuse a completed prefix.
- Bind the run to the sealed replacement S0, the sealed fourth stopped v2.1
  preflight, current S1-relevant source/config hashes, CLI fingerprints, clean
  Git SHA, immutable plan, event ledger, and seal inventory.
- A passing paid report may authorize only a separately invoked full S1. The
  reliability runner must never launch S1 automatically.

## Interpretation

A pass says only that the combined language-realizer → public-analyzer channel
was sufficiently reliable under these fixed synthetic cases to permit the full
S1 technical pilot. It does not validate the DAG/field/trajectory sensor.

A stop says the observation channel is not reliable enough for S1 under this
protocol. It does not invalidate the sensor, but it blocks using the channel to
judge the sensor. After a stop, do not tune and rerun the same gate. Reconsider
the role of free-form realization in the instrument.

No v2.2 result licenses policy optimization, Phase 6B, efficacy, human-learning,
or deployment claims. Only a later S2 can issue a learner-state validity verdict.

## Execution outcome

The protocol was implemented, validated, committed, and pushed at clean SHA
`4133d7ff` before any v2.2 model call. The full repository suite passed 5,289
tests with one expected skip; the adaptive-state subset passed 125/125; tracked
source lint and workplan validation passed. A no-write dry run validated the
replacement S0, stopped-v2.1 parent, 72-case plan, 144-dispatch ceiling, CLI
fingerprints, and current S1 hashes.

Paid run `adaptive-state-v2-observability-reliability-4133d7ff-v22` completed
72/72 cases and 144/144 serial dispatches with zero technical failures. It
sealed **stop** at 70/72 exact family matches:

- draw blocks: 23/24, 23/24, 24/24;
- Marrick and Hethel: 24/24 each; Ravensmark: 22/24;
- Claude: 36/36; Codex: 34/36;
- none, adopt, retract: 18/18 each; derive: 16/18;
- Ravensmark × derive × Codex: 1/3.

Both counted failures occurred in that same base cell. Draws 1 and 2 repeated
the public holder premise—“The dusk-seal on the pass was held by Elian.”—while
claiming `derive:inference_03`; the analyzer correctly returned `none`. Draw 3
was nominally scored `derive`, but “The older dusk-seal on the pass was Elian’s
seal” still did not state `pressedSealFor(gatePass,elian)`. It was a family-level
analyzer false positive, not substantive recovery of the intended action.

The repeated-draw protocol therefore answered its question: this is a repeated,
condition-specific realizer failure, not a single unlucky wording draw, and the
family analyzer can also over-credit an incomplete paraphrase. The frozen
decision is `stop_observability_channel_no_s1`; `s1_retry_eligible` is false.
Report SHA-256 is
`987497dab7df085829c530432fe1ca3b38e8cfbf8d80ee91192272ba52a29f8f`.

Do not rerun v2.2 or tune prompts against this cell. The next permitted work is
zero-call instrument redesign that separates fact-preserving transition
realization from optional LLM naturalness. S1 and S2 remain blocked.
