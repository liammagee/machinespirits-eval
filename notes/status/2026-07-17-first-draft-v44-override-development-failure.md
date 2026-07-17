# V44 guarded-override development result

Date: 2026-07-17

Status: failed non-equivalent development screen; causal correction passed

V44 used the checked-in `model_instructions_file` replacement for one cheap
frozen-prefix Codex screen. It stopped at 0/1 automatic originals and made no
ordinary-Codex verification call. This cannot count as strict or held-out
acceptance.

## Frozen boundary

- Campaign: `first-draft-diagnostic-screens-v24`
- Configuration SHA-256: `cf7927742ea93f2c4cc3321983361739eb259172d6bb101e3e4f14b9d09c0aee`
- Frozen implementation/config commit: `1b3280e0a9f49aaabe5596fd73d6aa5bbaeca438`
- Automatic result SHA-256: `6acfddb2b49f483d628c9d5151132078c6bad05ec568345798fe665c3af73c38`
- Frozen replay SHA-256: `e426d8fae72b6b20e06ca302f6a494210167597dfcd8129da2bbf193d586775d`
- Qualitative review SHA-256: `d310e750cca4349804f12d7cb941b1a317d9586a6c8b68b14870132899efd6aa`
- Model: `gpt-5.6-terra`, low effort
- Transport: `codex_cli_development_base_override_non_equivalent`
- Replacement instructions SHA-256: `09039c3eaaabc4557474252a341d99326913df62946c7bcbe0ebfb5929ed370b`

The deterministic preflight passed: 29 derivation worlds, 78 causal
speaker/replay tests, 58 campaign tests, and four saved-candidate corpora with
zero new regressions or safety failures.

## Result

- Automatic originals accepted: 0/1
- Safety failures: 0
- Repairs, rewrites, fallbacks: 0
- Semantic adjudicator calls: 0
- Dominant cluster: `jointPerformanceGenerationAudit:slot_exceeds_word_target`
- Exact failure: `performance.response:19>17`

The raw model output was:

```json
{"uptake":"Write: \"The depot chargers did not cause the Tallow Street brownout.\"","performance":{"entry":"My case is: the depot chargers did not cause the Tallow Street brownout.","response":"Stocktake darkness defeats the accusation: The depot chargers did not cause the Tallow Street brownout; actual cause remains open."},"handoff":"Next, compare the chargers being dark during the stocktake with the 18:40 brownout."}
```

This is materially better than V43. Every slot keeps the negative causal
direction; the discredited positive claim is gone. Two independent reviewers
both passed every slot and the draft overall for actor, relation, polarity, and
causal consistency. The unchanged delivery gate still correctly rejected the
response because the model added a five-word dramatic preface to the required
causal boundary and exceeded the hard sentence limit by two words.

The next correction should simplify ownership rather than raise the limit:
move charismatic challenge into PERFORMANCE entry and reserve PERFORMANCE
response for the single typed causal-boundary sentence. This removes competing
instructions from the length-critical slot while preserving the 17-word gate.

## Cost and latency

| Measure | V33 ordinary | V43 ordinary | V44 override |
|---|---:|---:|---:|
| Original latency | 13,451 ms | 27,166 ms | 18,359 ms |
| Observed input tokens | 16,246 | 16,124 | 12,883 |
| Cached input tokens | unavailable | 9,984 | 6,400 |
| Uncached input tokens | unavailable | 6,140 | 6,483 |
| Output tokens | 517 | 348 | 717 |
| Reasoning output tokens | unavailable | 245 | 617 |
| Total tokens | 16,763 | 16,472 | 13,600 |
| Authored prompt estimate | approximately 4,000 | 2,499 | 2,490 |
| Inferred runtime/transport residual | approximately 12,246 | 13,625 | 10,393 |

Against V43, the override reduced observed input by 20.1% and latency by 32.4%,
while uncached input rose 5.6%. Against V33, observed input fell 20.7%, but
latency remained 36.5% higher. The cache split and single draw preclude a broad
latency claim. The override is useful as a rejection screen, not evidence that
the ordinary transport improved.

Seed `20263400` is consumed and retired. No ordinary verification seed was
started. Because V43 and V44 share the word-limit cluster but V44 reduced the
overage from seven words to two and removed the causal contradiction, this is
measurable movement rather than a no-progress repetition. One bounded ownership
correction remains justified; another failure on the same cluster should stop
automatic advancement and trigger a broader response-shape redesign.
