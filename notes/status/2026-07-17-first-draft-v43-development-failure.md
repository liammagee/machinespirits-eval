# V43 causal-performance development result

Date: 2026-07-17

Status: failed non-held-out development diagnostic

V43 stopped after the first frozen-prefix draw failed the unchanged automatic
original-only gate. The second draw did not start. This is failed development
evidence, not strict confirmation or held-out acceptance.

## Frozen boundary

- Campaign: `first-draft-diagnostic-screens-v23`
- Configuration: `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v23.yaml`
- Configuration SHA-256: `d41df0b24e286f4108a54fbeb363e7306bb88f26c0ed5bfdc7c417721935e8bf`
- Frozen implementation commit: `8a859b5e28db4729ec8c531a437e7761059f04c5`
- Automatic result SHA-256: `f6f79547f28cade5735a139547e6fd4c2a1868c1b758b36ab7c0887d27e6ab05`
- Hard-prefix replay SHA-256: `46290386cd2914e965f1a23aaf197fd62959c5698e3e53f1d82d5ba6f77be248`
- Qualitative review SHA-256: `aab3bb4cab801e0f95ca35e59e11b8e13ac43aa79149eec8b185e4fb348694ae`
- Transport: ordinary Codex CLI, `gpt-5.6-terra`, low effort
- Base-instructions override: disabled
- Direct-provider screening: not used

V43 revision 1 made zero model calls after unrelated timing-sensitive CLI
tests timed out. Revision 2 retained the untouched seeds and narrowed the
preflight to the speaker dependency closure. Derivation quality, the focused
speaker and campaign tests, and all four saved-candidate corpora passed before
the live call. No safety regression was observed.

## Automatic result

- Originals accepted: 0/1
- Safety failures: 0
- Mechanical repairs: 0
- Model rewrites: 0
- Deterministic fallbacks: 0
- Semantic adjudicator calls: 0
- Transcript-specific uptake failures: 0
- Compact-prompt failures: 0
- Dominant automatic cluster: `jointPerformanceGenerationAudit:slot_exceeds_word_target`

The raw structured output was never composed or exposed:

```json
{"uptake":"Write: “The depot chargers did not cause the Tallow Street brownout.”","performance":{"entry":"My case is that the depot chargers caused the Tallow Street brownout.","response":"The stocktake defeats my case: dark chargers support The depot chargers did not cause the Tallow Street brownout, but the actual cause remains open."},"handoff":"Next, compare the chargers being dark during the stocktake with the 18:40 pen chart."}
```

The immediate parser failure was `performance.response:24>17`. Raising that
ceiling would not make the draft acceptable. The PERFORMANCE entry states the
opposite of the supported public causal relation, while the response then
corrects it. The prompt's advocate allocation therefore induced an internally
contradictory two-step beat. This is a speaking-contract failure as well as a
length failure.

## Independent causal-fidelity review

Two reviewers independently received the public evidence and raw model output
without the automated verdict. Both passed the UPTAKE and PERFORMANCE response,
failed PERFORMANCE entry for causal-polarity reversal, and failed the draft
overall. Their agreement confirms that this is not an audit-recognition edge
case and must not be repaired by widening a recognizer.

The next correction should make the whole PERFORMANCE beat semantically
monotonic: it may test or limit a live case, but no slot may temporarily assert
a public claim that the evidence rules out. The prompt should express the
selected advocate action as testing the claim against the stocktake, not as
voicing the discredited causal assertion and retracting it one slot later.

## Cost and latency

| Measure | V33 | V43 |
|---|---:|---:|
| Original latency | 13,451 ms | 27,166 ms |
| Observed input tokens | 16,246 | 16,124 |
| Cached input tokens | unavailable | 9,984 |
| Uncached input tokens | unavailable | 6,140 |
| Output tokens | 517 | 348 |
| Reasoning output tokens | unavailable | 245 |
| Total tokens | 16,763 | 16,472 |
| Authored prompt estimate | approximately 4,000 | 2,499 |
| Inferred runtime/transport residual | approximately 12,246 | 13,625 |

The authored request is 37.5% below the V33 estimate and remains under the
2,500-token target. Observed input is only 0.8% lower, because the ordinary
Codex runtime residual remains dominant. Latency was 102% higher in this single
draw. The separate guarded `model_instructions_file` probe is promising for
cheap development screening, but it was disabled here and cannot be counted as
ordinary-Codex verification.

## Seed and stopping boundary

- `20263300`: consumed and retired.
- `20263301`: unconsumed because the hard first draw failed.

V42 and V43 failed for different dominant clusters. V43 supplies new evidence
that the multi-slot advocate contract itself can manufacture causal
contradiction. A later development revision requires an architectural contract
correction and a fresh predeclared first seed. The unconsumed second seed stays
unconsumed rather than being silently repurposed after the contract changes.
