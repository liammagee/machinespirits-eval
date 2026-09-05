# Superego critique causal replay: launch stopped

The separately authorized launch stopped on its first request at
2026-09-05 04:43:53 UTC. DeepInfra rejected the requested JSON-object response
format. No generated output or semantic/quality judgment was produced, and no
scientific endpoint can be estimated from this run.

The study is registered in `notes/superego-critique-causal-replay-design.md`.
PR #1021 merged at `7857a7f49f2257a962793bffe7f1759bb7613af3`. The first user
GO was recorded in `notes/2026-09-04-superego-critique-causal-replay-go.md`;
the subsequent separate user message "Go" authorized this launch. Neither
approval was bound to a source digest. The runner recorded launch commit
`a43248c50a1222a37a654ba27d22791963210a68`, tree
`3a24b0839a79c847d18bd6a709b9f4a4e6eaa71b`, and a clean checkout.

Preflight verified all 319 sealed traces, reproduced the historical unscored
48-item packet and identity ledger, and reproduced the reviewed 194-unit,
3,686-job plan exactly. Historical data, the study design, models, prompts,
decoding policy and thresholds were unchanged.

## Observed failure and accounting

The first registered job was `u001/matched_wrong_critique/generator`, using
`nvidia/nemotron-3-nano-30b-a3b` through OpenRouter with DeepInfra as the only
allowed provider. HTTP status was 405. The retained provider error says:

> json_object response format is not supported for model: nvidia/Nemotron-3-Nano-30B-A3B

| Measure | Observed |
| --- | ---: |
| Requests dispatched and durably retained | 1 |
| Valid generation jobs | 0 / 582 |
| Semantic judging calls | 0 / 1,552 |
| Quality judging calls | 0 / 1,552 |
| Failed jobs / unattempted jobs | 1 / 3,685 |
| Unfinished scheduled jobs | 3,686 |
| Attempts reserved / hard ceiling | 1 / 3,876 |
| Worst-case dollars reserved / cap | $0.001408 / $300 |
| Provider-reported usage and actual cost | Unavailable |
| Technical replacements dispatched | 0 |

The attempt journal's `completed` disposition means an HTTP response was
durably received; it does not mean a successful generation. The run seal records
zero completed jobs and `recovery_permitted: false`. The single attempt remains
charged to the cumulative study ceiling. Missing reported cost is unknown,
not zero. The 190-attempt technical reserve does not authorize retrying this
registered nonrecoverable failure.

## Disposition and evidence

Workflow: **BLOCKED** in GENERATING after completed PREFLIGHT. Model activity:
inactive, confirmed by process exit and the sealed ledger. No retry, alternate
route, response-format substitution, semantic label, quality score or outcome
resampling occurred. The primary study is technically incomplete, not a null
causal result. Directive fulfillment, material strategy/action change, public
quality and later learner/transfer evidence remain unmeasured and separate.

The design explicitly stops on unsupported parameters and HTTP 4xx other than
429. The provider requires a different response-format request or a different
route to proceed. Either must be reviewed against the prospective design and
its stopping rules before any further paid work. A code fix does not void GO,
but it also does not license resampling this sealed failure contrary to those
rules. No amendment or new launch is made here.

Local evidence is under
`exports/superego-critique-causal-replay-20260905/`: frozen plan/settings, exact
request and error response, append-only run ledger, shared study-ledger
snapshot, driver log, and original plus clarified workflow status. The canonical
shared study ledger remains under
`~/.machinespirits-data/paid-studies/superego-critique-causal-replay/`.
The raw request and response are private artifacts; no transcript is published
in this note. All ten artifact files (1,513,445 bytes) match the private copy
byte-for-byte, and the maintained archive check reports zero missing. They are
committed and pushed in private archive commit
`9ee055463abb540b2e1eba6e8f391189b7add88b`, branch
`codex/superego-critique-causal-replay-archive`.

Workplan item: `superego-critique-causal-replay`.
