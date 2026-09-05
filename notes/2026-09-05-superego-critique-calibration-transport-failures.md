# Calibration collection paused after two transport failures

The user separately authorized continuation with **"merged; GO"** after PR
#1050 merged at `b89f064ceb126ec3f0740bf623dce59cead2f499`. Both new segments
ran from the clean, audited commit `f048e0eadde891db4aa6d095b5bad9b195485b94`,
whose design and runner matched main. The existing approval is
`notes/2026-09-05-superego-critique-calibration-native-sampling-go.md`; the
design remains `notes/superego-critique-causal-replay-design.md`.

Preflight reproduced all 319 sealed traces, 48 identities and the exact
192-job plan. The free route check passed. The original invalid Sonnet answer
was retained, and the response-free GPT routing rejection received its one
registered replacement. GPT now returned an answer under the approved native
sampling policy. No prompts, sources, routes, measurement rules or ceilings
changed during collection or recovery.

## What ran and why it stopped

| Segment (under the launch worktree's `exports/`) | New attempts | New durable model answers | Disposition |
| --- | ---: | ---: | --- |
| `superego-critique-measurement-calibration-native-20260905` | 26 | 25 | Transport failure after 60.517 seconds |
| `superego-critique-measurement-calibration-native-transport-recovery-20260905` | 10 | 9 | Transport failure after 22.069 seconds |

The first segment ran from 18:10:53 to 18:15:41 UTC on 2026-09-05. Its failed
job was `scr-c4900d911c58/historical_revision/semantic_a`. Standing technical
recovery resumed only missing work at 18:16:58 UTC. That job returned an answer
on its one replacement; no retained valid or invalid answer was called again.

The recovery stopped at 18:18:04 UTC on the first attempt for
`scr-e1a3515e6482/historical_revision/semantic_a`. Both failures recorded
`Transport failed without a durable response: TypeError`. Neither has a saved
response or usage record. Both durations are below the registered 180-second
application timeout. The dispatcher preserved the error class but not its
underlying network cause; the precise cause cannot be established retrospectively.
Do not infer a refusal, a JSON-format rejection, or zero provider charges.

Automatic approval review rejected the proposed next recovery because the same
transport failure had occurred twice while its underlying cause was unknown.
That rejected command never started. No third segment or additional model
attempt was created, and provider activity is inactive. The runner's latest
sealed `recovery_permitted: true` does not override this operational stop.

## Cumulative accounting and evidence boundary

| Measure | Retained value |
| --- | ---: |
| Registered items / planned judgments | 48 / 192 |
| Total attempts, including both earlier failures | 38 / 204 |
| Durable responses / transport failures without a response | 36 / 2 |
| Model answers / response-free routing error envelopes | 35 / 1 |
| Judgments accepted by the registered parser / retained invalid answers | 13 / 22 |
| Missing answers | 157: 156 never-dispatched jobs and one failed job |
| Semantic / quality / generation attempts | 38 / 0 / 0 |
| Cumulative dollar reservations | $2.508541 / $15 |
| Known provider-reported cost | $0.4725385 across 35 answers |
| Attempts with unreported cost | 3: one routing rejection and two transport failures |

The 22 invalid answers comprise the historical invalid answer and 21 new
invalid answers (19 evidence failures and two structured-output failures).
They retain their fixed jobs without replacement. Parser acceptance does not
establish semantic correctness. No independent human ratings exist, no quality
judging has begun, and no complete calibration agreement or validity conclusion
is reported. Directive fulfillment, material change, public quality and later
learner evidence remain separate. The four-arm replay stays paused.

## Preservation and next step

Launch worktree: `/private/tmp/superego-calibration-native-sampling`.
Both sealed segments and console logs are preserved. A separate operational
snapshot, `exports/superego-critique-calibration-native-accounting-20260905`,
contains the cumulative accounting and a byte-identical copy of the study
ledger. All 84 new files (2,069,390 bytes) verified byte-for-byte against the
private archive; its maintained archive check reports zero missing. Earlier
archive commits, raw inputs, responses, GO notes and failed seals remain intact.
Private archive commit: `efc77e3fa789a8aa9ff0507da95edab7d4a10b38` on
`codex/superego-critique-calibration-archive`.

Further paid recovery requires explicit user approval after the repeated
transport failures. If approved, the existing runner would give the latest
failed job its one replacement and continue the same fixed missing jobs in a
fresh destination. No study amendment, new GO package, increased ceiling or
rerating is proposed. Completing the 157 missing answers without another
failure would reach 195 total attempts, leaving nine within the original cap;
another failure of the same replacement stops that job. Repeated transport
failures could consume the remaining recovery reserve without completing
collection. The underlying network cause remains unresolved.
