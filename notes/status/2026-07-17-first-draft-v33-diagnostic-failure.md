# V33 causal-fidelity diagnostic: hard-cell failure and architectural stop

Date: 2026-07-17  
Status: failed non-held-out staged diagnostic; automatic version advancement stopped  
Campaign: `first-draft-diagnostic-screens-v13`  
Frozen HEAD: `45cb13a7f397cbbaecaa0e6ffa609fe764237a9e`

V33 did not pass. The first, hardest Tallow/answer-seeking draw produced one
safe original candidate, but the strict joint-performance audit rejected it.
Because the mandatory hard cell failed, diagnostic 2 was not started. The
result is 0/1 accepted originals, configuration realization 1.0, and zero
safety failures. No repair, model rewrite, deterministic fallback, semantic
adjudication, recognition correction, or transport normalization ran.

This is a model-backed tutor-generation result, unlike V29 and V30. V29 was a
zero-call model-free fixture/preflight failure. V30 was a zero-call transient
focused-test/orchestration failure. V31 was the first model-backed result in
that sequence and isolated a character/action realization failure while
preserving safety. V32 then measurably improved the automatic realization
metrics, but retained the causal-role wording debt described below. These
versions must not be reported as equivalent tutor failures.

## Exact result

| Cell | Seed | Result | Originals | Configuration | Safety | Latency | Tokens |
|---|---:|---|---:|---:|---:|---:|---:|
| `tallow_answer_seeking_diagnostic_1` | 20262300 | fail | 0/1 | 1.0 | 0 | 13,451 ms | 16,763 |
| `tallow_answer_seeking_diagnostic_2` | 20262301 | unstarted | 0/0 | — | — | — | — |

The model was `codex.gpt-5.6-terra` at `low` effort. The completed draw used
16,246 input tokens and 517 output tokens. It produced one valid joint-
performance envelope and one source-accessibility pass, but zero strict joint-
ownership passes. The sole automatic failure cluster was:

- `jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance` — 1 occurrence.

The candidate's selected configuration was visible at the whole-response
level, but the strict joint contract did not find the required actorial
performance in its owned PERFORMANCE span set. The automatic configuration
realization score of 1.0 therefore does not override the failed ownership gate.

## Blinded causal-fidelity review

The predeclared qualitative review failed independently and unanimously. Both
reviewers saw only the learner request, the public evidence window, and this
minutes-entry sentence:

> “The dark chargers did not prevent Tallow Street browning out at 18:40.”

Both reviewers marked it `FAIL`. The public evidence weakens the claim that the
chargers caused the brownout: the street browned out while the chargers were
dark. Saying that the chargers “did not prevent” the brownout changes the
causal relation and misdirects the evidence's force. The qualitative report
records 0/2 passing ratings and does not authorize advancement.

V32's “did not stop” and V33's “did not prevent” are two consecutive
model-backed versions with no measurable improvement on the same
causal-role-inversion cluster. The automatic loop therefore stops here under
the declared two-version rule. The next correction must redesign the speaking
contract so that a writable learner sentence preserves the public causal role;
it must not continue prompt churn, widen an audit, or add phrase-specific
recognition.

## Deterministic preflight and provenance

The deterministic preflight passed once without retry before the model call.
Nine commands ran sequentially in 48,405 ms and made zero model calls. The four
focused suites passed 438/438, 24/24, 4/4, and 52/52 tests, and all four
model-free fixtures passed.

- Frozen config:
  `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v13.yaml`
  - SHA-256: `e7d76b1707e6514b30ef8d5c3bc0fec9797df1eba673de2159bf3223d70cd440`
- Clean worktree porcelain SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Iteration-bound campaign validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v13/iteration-1/campaign-validation.json`
  - SHA-256: `71bca35b6824c13666ffde5f8240acd4e46a98e7994b194af292bcd4dff43402`
- Preflight execution ledger:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v13/iteration-1/preflight-execution.json`
  - SHA-256: `98049ad5bdd5fd06c0b07b989118928c5903f1ff084a4658b69ef8cff1a9eb08`
- Preflight certificate:
  `.tutor-stub-auto-eval/preflight-certificates/f0ba6472cf8ee2c9ea685a72a54118b9b8a7d6c318b6d04bafe657045113aea0.json`
  - key: `f0ba6472cf8ee2c9ea685a72a54118b9b8a7d6c318b6d04bafe657045113aea0`
  - certificate SHA-256: `e0a61a18d302a791dc690cd7b5dec42cd7185b464b8d0637c4a043c1a0d97588`
- Hard-cell turn:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v13/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json`
  - SHA-256: `32ce9c0180eb3f6af63bd1711b6e8c5934a9054028f57ac4b6497fd39cbece55`
- Working-screen result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v13/iteration-1/working-screen-result.json`
  - SHA-256: `e74a28d04a582a18a3fc8eddcdb2bb1db8bbc0a0f85d44a9a392972fbc093c9e`
- Blinded qualitative report:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v13/iteration-1/qualitative-causal-fidelity-review.json`
  - SHA-256: `589f945f17be184973532a011c11a70771e844c51abc4406f70921ae6bee3787`

## Seed and next-step boundary

- `20262300` — consumed by the failed development hard cell and retired.
- `20262301` — never consumed because the hard cell failed; retired as
  unstarted rather than described as a model result.

V33 is terminal failed development evidence. V34 remains unpredeclared and no
V34 development, held-out, or reserve seed exists. A later V34 may be
predeclared only after a materially redesigned speaking contract has focused
tests and model-free fixtures; no automatic version advancement or model call
is authorized by this result record.
