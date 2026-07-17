# V49 morphology override diagnostic: word-budget generation failure

Date: 2026-07-17  
Status: failed non-held-out, non-equivalent staged development screen  
Campaign: `first-draft-diagnostic-screens-v29`  
Frozen HEAD: `56d74732`

V49 remains failed development evidence. The first fresh Tallow/answer-seeking
output was safe, causally faithful, and valid JSON, but PERFORMANCE ENTRY used
18 words against the unchanged 17-word hard limit. The hard cell therefore
failed at 0/1 originals and the second predeclared draw did not start.

The raw entry was:

> My case is this: I set the dark stocktake chargers against the accusation for the Tallow Street brownout.

The sole cluster was
`jointPerformanceGenerationAudit:slot_exceeds_word_target` with exact detail
`performance.entry:18>17`. This is a genuine generation failure, not an audit-
recognition issue. The prompt asked the model to draft at most 14 words, while
the parser retained the 17-word hard delivery boundary; the model exceeded
both. No word gate is loosened or reclassified.

Two independent blinded reviewers passed all four raw slots for causal
fidelity. The output preserved the depot chargers, negative production
relation, Tallow Street brownout, and the dark-during-stocktake/18:40 evidence.
That 2/2 qualitative pass does not override the structural generation failure.

## Cost and intervention accounting

- Original acceptance: 0/1.
- Safety failures: 0.
- Repairs, model rewrites, fallbacks, semantic corrections, adjudicator calls,
  and transport normalizations: 0.
- Original latency: 7,387 ms.
- Authored input estimate: 2,296 tokens.
- Provider input: 10,710 = 6,400 cached + 4,310 uncached.
- Inferred runtime residual: 8,414 tokens.
- Output: 97 tokens; reasoning output: 0.

The estimate uses `utf16-code-units-div-4-ceiling-v1`; residual is inferred by
subtraction. The guarded base-instruction replacement remains non-equivalent
and acceptance-ineligible.

## Architectural consequence

The typed operation's compulsory `My case is this:` prefix consumes four words
before the clue, pressure target, causal subject, and outcome can be named. V49
therefore motivates a speaking-contract simplification rather than a larger
word allowance: the typed first-person `I set … against …` act should itself
count as advocate initiation. Generic advocate paths may retain their existing
case form. This prospective change must be tested model-free and requires a
fresh version and unused seed before another call.

## Provenance

- Config SHA-256: `4feca49afc2c7cd9ac6dc932fee4e744dde30007bd7dd87c90fa7158012468e2`
- Campaign validation SHA-256: `0f60ab740ce380cbb1e2fd4269e73d3a292606e78abd87625f7f4146fe43ad38`
- Preflight execution SHA-256: `56df5b1263451f89cf88f49a7d4960c58640d4b26411a078e47311b92d7af9d1`
- Preflight certificate key: `9df3ddd8d673ff1a889e5b6c024751838aacceaa3539d2ee95460028de491f99`
- Preflight certificate SHA-256: `14fd977b6a20a711c7ce0ff1b83a562cc77e9259b4b34ca4670b70d29951e181`
- Turn report SHA-256: `1ef6ee894d376e0dbe38b73913770c061af43b50c0cb63dd279a15b9369a09da`
- Working result SHA-256: `344e344ac910e13156c2661a3477ad79983a42886fcacf4e0caaa36c1cb46ad0`

Seed `20263900` is consumed and retired. Seed `20263901` is preserved as
unconsumed but retired from reuse after the prospective speaking-contract
change.
