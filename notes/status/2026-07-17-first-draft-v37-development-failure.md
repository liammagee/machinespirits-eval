# V37 compact boundary development result

Date: 2026-07-17  
Campaign: `first-draft-diagnostic-screens-v17`  
Configuration SHA-256: `9d5471429d2e00820b6cc3b89b73bb1c25d6763ef3d27aa46626be4430876f30`  
Status: **failed development evidence; no strict-confirmation authorization**

## Result

The focused preflight passed: all 29 derivation worlds, 455/455 audit-contract
tests, 16/16 interactive tests, the adaptive and campaign suites, and all four
model-free corpora. V37 then generated one original on the frozen Tallow turn-5
prefix and stopped at the hard-cell gate.

- originals accepted: `0/1`;
- safety failures: `0`;
- mechanical repairs, model rewrites, fallbacks, semantic corrections,
  adjudicator calls, and transport normalizations: `0` each;
- configuration realization: `1.0`;
- original and total tutor latency: `13,682 ms`;
- authored prompt estimate: `2,358` tokens;
- provider input: `16,012` (`13,056` cached; `2,956` uncached);
- output: `414` (`311` reasoning); total: `16,426` tokens.

The candidate was:

> Write: “During the stocktake, the dark chargers did not prevent the 18:40
> brownout.” My case is stocktake's dark chargers rule out the depot, not
> identify another cause. The stocktake's dark chargers support ruling out the
> depot, but not identifying the brownout's cause. Next, compare the chargers
> being dark during the stocktake with the 18:40 brownout.

The selected advocate part, evidentiary-boundary tactic, action, stance, scene,
audience, lexical, ownership, and progression configuration were realized. The
strict failure surfaced as `responseCompositionAudit:verbatim_learner_echo`,
but the underlying requested-entry recognizer gives the precise cause: the
`Write:` sentence used a negative **prevention** relation. The public record
licenses an **inactive candidate with persisting outcome** relation: chargers
were inactive while the brownout still occurred, which rules charger causation
out. Saying they “did not prevent” the brownout assigns the chargers a different
causal role and is not licensed.

This is a genuine generation failure, not an audit-recognition correction. The
new directed evidence-limit recognizer and explicit advocate contract did their
jobs. Recovery and audit recognition were unchanged during the call.

## Seed accounting

- `20262700`: consumed by V37 diagnostic 1.
- `20262701`: unconsumed because the hard cell failed.

No held-out or strict-confirmation call was authorized.

## Artifacts

- validation: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v17/campaign-validation.json`
- preflight: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v17/iteration-1/preflight-execution.json`
- draw: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v17/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json`
- campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v17/iteration-1/working-screen-result.json`
