# V51 ordinary Codex diagnostic: fluent-realization failure

Date: 2026-07-17  
Status: failed non-held-out ordinary-Codex original-only diagnostic  
Campaign: `first-draft-diagnostic-screens-v31`  
Frozen HEAD: `6adf26ce`

V51 tested the V50 speaking contract through ordinary Codex CLI transport,
without `model_instructions_file`. It failed at 0/1 originals with no safety
failure. Strict working confirmation therefore did not start.

The raw model output was:

> Write: “The depot chargers did not cause the Tallow Street brownout.” I set
> the stocktake chargers-dark note against blaming depot chargers for the Tallow
> Street brownout. The depot chargers did not cause the Tallow Street brownout;
> actual cause remains open. Next, compare the chargers being dark during the
> stocktake with the 18:40 pen chart.

The exact deterministic miss was `pressure_target_visible`: the operation used
the gerund `blaming`, while the typed pressure-target ontology recognizes public
judgment nouns such as accusation, charge, claim, conclusion, and verdict. This
is semantically close, and two independent blinded reviewers passed all four
causal-fidelity criteria. Nevertheless, the phrase `stocktake chargers-dark
note` is genuinely awkward. V51 must not be reclassified by merely adding
`blaming` to the recognizer: doing so would turn an unintentional first-draft
surface into a pass and repeat the brittle audit widening the workflow is meant
to avoid.

## Accounting

- Original acceptance: 0/1.
- Configuration realization: 0.667.
- Safety failures: 0.
- Mechanical repairs, model rewrites, deterministic fallbacks, semantic
  corrections, adjudicator calls, and transport normalizations: 0.
- Original latency: 8,976 ms.
- Authored input estimate: 2,293 tokens.
- Provider input: 14,145 = 9,984 cached + 4,161 uncached.
- Inferred runtime residual: 11,852 tokens.
- Output: 94 tokens; reasoning output: 0.
- Dominant cluster: typed advocate pressure target and therefore composite
  advocate/charismatic realization absent.

The ordinary runtime added 1,423 observed input tokens and 2,746 ms relative to
the V50 override mean. This is consistent with the guarded override being a
useful development accelerator but not an acceptance-equivalent transport.

## Next correction

Keep the recognizer and all delivery gates unchanged. Compile a concise,
world-derived complete PERFORMANCE ENTRY sentence for the typed operation,
rather than asking the ordinary CLI agent to invent a compressed noun phrase
inside a tight slot. The model should still author the other slots, but the
typed advocate operation should be a clear public sentence from its first word.
Test this across unrelated subjects and outcomes before spending another fresh
ordinary-Codex development seed.

## Provenance

- Config SHA-256: `76959cbcf5896563048d1a26611728efd4e918884ae052589d94ee28af6b84c1`
- Campaign validation SHA-256: `2d8e81d740599e4c6a9f9026a02731b370c27c0e5f22e0915d086ce50c0ad423`
- Preflight execution SHA-256: `1000c242c7f0a903d4a7a887ab4230310444af3de3980e6538de709af944a325`
- Preflight certificate key: `f59524c1d98f1066d6543d683a85fd63efd7c5b43c2746d8e2c7ce7de44654e9`
- Preflight certificate SHA-256: `7c97746cfb9cd46286ff3bd0a695d8a8eb55338e1bb220ebf9f62b3bb23836f5`
- Turn report SHA-256: `46bb74b707be04306b6cd8b382c6a47262cfa3d5c8267a92295e75c9990f71a5`
- Working result SHA-256: `814d55dcbe03f2299847ecc711fa7181361b9ce622c87c8f00ab5a3234fff793`
- Qualitative review SHA-256: `f75fb18b7ccad78f5daf93a413ecb3687b6c8c21e27859a210c899fe375a51f6`

Seed `20264100` is consumed and retired as non-held-out development evidence.
