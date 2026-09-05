# Calibration continuation: GPT-5.4 parameter rejection

The separately authorized continuation stopped before receiving a new model
answer. The original Sonnet answer remains a retained invalid response and was
not requested again. OpenRouter rejected the next fixed GPT-5.4 job with HTTP
404 at its parameter-routing filter. **Zero valid judgments are available.**

## Launch and preserved evidence

The user instructed "Merged; continue" after approving the response-handling
amendment. PR #1046 was verified merged at
`9b1a64d23351ad7179e804c6f4dc487d0c502fd0`; all its selected checks had passed.
The launch used clean commit `a1f7f3c268cb0e10caf92191e0503673b85e00a0`, tree
`e0590cffd9fb36982472f4c3daccf803351aad3b`, with the design matching main.
The applicable GO is
`notes/2026-09-05-superego-critique-calibration-response-handling-go.md`.
Preflight reproduced all 319 sealed traces, 48 identities and the unchanged
192-job plan. Provenance is recorded, not an authorization binding.

The recovery segment admitted at 2026-09-05T16:00:30.361Z and sealed at
2026-09-05T16:00:30.990Z. It retained the first response under its original job
ID, then dispatched only `scr-427920e660c7/historical_revision/semantic_a`
(presentation `s002`). The endpoint returned no model answer, model identity,
provider identity or usage/cost record. The provider-routing error said:

> No endpoints found that can handle the requested parameters.

Its routing metadata identifies `Filter by Parameters` as the failed step,
after one endpoint survived the allowed-provider filter. The request used
`openai/gpt-5.4`, provider `openai`, `temperature: 0`, `top_p: 1`, 2,048 maximum
output tokens, reasoning disabled, JSON-object response mode and no fallback.
The seal is `technical_failure`, `recovery_permitted: false`; the process exited
1. Provider activity is inactive. No retry or parameter change followed.

| Quantity | Disposition |
| --- | --- |
| Study-wide physical attempts | 2 / 204 |
| New attempts in this segment | 1 routing rejection |
| Retained invalid model answers | 1, from the original segment |
| Valid judgments | 0 |
| Failed request needing a design/recovery decision | 1 |
| Never-dispatched jobs | 190 |
| Registered jobs still missing answers | 191 |
| Earlier provider-reported cost | $0.018594 |
| New rejection's actual cost | Unreported; not asserted to be zero |
| Reservations retained | $0.090463 + $0.052743 = $0.143206 |
| Study ceilings | 204 attempts and US $15, unchanged |

The ledger's two completed attempts mean two HTTP responses were durably
recorded, not two accepted judgments. No unexplained reservation remains. There
is no semantic agreement, quality result, human-reference validity or causal
finding to report.

## Diagnosis and focused repair

The public [GPT-5.4 endpoint registry](https://openrouter.ai/api/v1/models/openai/gpt-5.4/endpoints)
was inspected without credentials or inference on 2026-09-05. Its OpenAI
endpoints advertise reasoning, maximum tokens and structured response controls,
but omit `temperature` and `top_p`. OpenRouter's
[provider-routing documentation](https://openrouter.ai/docs/guides/routing/provider-selection)
states that `require_parameters: true` filters out providers lacking requested
parameters. This explains the observed routing filter; the error alone did not
identify the individual parameters. The preflight should have checked this
public metadata before the attempted continuation.

The maintained launcher now reads public route metadata before paid admission.
It verifies that a pinned provider endpoint advertises all registered request
controls, without sending credentials, study text or inference requests. Missing
metadata or unsupported controls stops before destination creation, reservation
or model dispatch. It never drops parameters, changes a model, or enables a
fallback. Metadata is a compatibility check, not a certificate or guarantee of
availability, valid parameter values, pricing, schema adherence or scientific
measurement quality. No source/design digest or new authorization machinery is
introduced.

The unchanged real request fails this new check with `temperature, top_p`.
Focused replay tests pass 33/33, including mocked CLI rejection before any paid
admission, separate endpoint support and unavailable metadata. Targeted lint and
format checks pass. Historical records and the approved study settings remain
unchanged.

## Remaining scientific decision

The smallest candidate amendment would retain both judge models and routes but
omit `temperature` and `top_p` only for GPT-5.4, explicitly registering its
provider-native sampling behavior. Sonnet would keep its current settings;
reasoning, token limits, prompts, ordering, sample, endpoints and caps would stay
fixed. This must not be described as verified temperature-zero or deterministic
GPT-5.4 decoding. Alternatively, retaining a temperature-zero requirement needs
a compatible independently chosen judge route/model and a broader amendment.
Neither option has been approved or implemented here.

Any future recovery must preserve both segments and their reservations, retain
the invalid Sonnet answer without replacement, and allow at most the registered
technical replacement for the response-free GPT request. Completing the 190
never-dispatched jobs plus that one missing answer would require 191 new
attempts, reaching 193 overall if no further technical failure occurs and
leaving 11 attempts inside the original reserve. This is an accounting scenario,
not launch authority. A change to decoding or the HTTP-404 recovery disposition
requires an in-place design amendment and approval under
`docs/paid-study-authorization-policy.md`. The four-arm replay stays paused.

## Archive

Local segment:
`/private/tmp/superego-calibration-retained-recovery/exports/superego-critique-measurement-calibration-recovery-20260905`.
Its adjacent console log is preserved. Free metadata snapshots are in the
sibling `superego-critique-calibration-route-diagnostic-20260905` directory.
The canonical study ledger was snapshotted without rewriting it or either seal.

All 11 artifacts (561,938 bytes) verified byte-for-byte against the private
archive; the maintained archive check reports zero missing. They are committed
and remotely verified at `1d6a266ddfe48357059901454c3f36e87d048ec9` on
`codex/superego-critique-calibration-archive`, preserving the earlier archive
commit and original human coding inputs.
