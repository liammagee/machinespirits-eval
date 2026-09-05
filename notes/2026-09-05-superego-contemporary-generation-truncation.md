# Contemporary pilot generation: output-limit stop

The authorized generation stage stopped after five accepted drafts and one
truncated draft. No critiques, revisions, human ratings or model judgments were
produced. This is a generation-feasibility failure, not a causal result.

## Observed failure

The sixth fixed job, `cross_productive_deadlock/draft-2/draft`, returned HTTP
200 from the registered direct Anthropic route and model `claude-sonnet-5`.
Its response reports `stop_reason: max_tokens`, exactly 2,048 output tokens,
and zero thinking tokens. The returned text is incomplete JSON. The other five
responses report `end_turn` and pass the generation parser.

The runner's combined message is `Refusal or truncation; no replacement`.
The saved provider metadata identifies **truncation**, with no observed
transport error or refusal. The registered output-token ceiling was exhausted;
the metadata does not explain why this particular draw consumed more tokens.
No output was repaired, extended, rerun, rated or selected for quality.

## Authority, accounting and disposition

The user approved the [design](superego-contemporary-pilot-design.md) through
the [GO note](2026-09-05-superego-contemporary-pilot-go.md), then explicitly
instructed `Launch generation`. Launch was from merged commit
`36578ed6a2621adf3ec69d1929399677144b517c`, tree
`5ae10020daea75cd46b35b9e112a0d35ff152c7b`, on
`codex/superego-contemporary-generation`, with a clean tracked checkout.
Provenance is recorded, not an approval binding.

The run began at 20:22:50 UTC and sealed at 20:24:03 UTC on 2026-09-05.

| Measure | Observed |
| --- | --- |
| Generation jobs | 5 accepted, 1 truncated, 54 unattempted of 60 planned |
| Provider attempts | 6 HTTP-completed; 0 transport failures; 0 replacements |
| Judging | 0 of 96 planned calls attempted |
| Token usage | 5,253 input; 5,607 output; no cache creation/read tokens |
| Usage-derived cost | $0.066576; all six responses include usage |
| Durable reservations | $0.422400; retained in cumulative accounting |
| Generation ceiling | 66 attempts / $4.646400, including six replacements |
| Whole-study ceiling | 168 attempts / $20, including 12 replacements |
| Recovery disposition | `recovery_permitted: false`; truncated answer remains |

Cost uses the registered $2/input-million and $10/output-million rates,
rechecked against [Anthropic's model pricing](https://platform.claude.com/docs/en/models/overview)
before launch. It is a usage-derived estimate, not a billing invoice.
Transport completion in the shared ledger is distinct from an accepted study
output; the sixth completed HTTP attempt did not yield a valid draft.

The design explicitly stops on truncation without replacement. Unused budget
does not authorize resampling, a larger token limit, a substituted unit or
continuation from this rejected draft. No human packet was released because
the complete four-arm corpus does not exist. Any changed output-length policy
requires prospective design review before further paid work; it cannot repair
this observation or establish a treatment effect.

## Preservation

Launch worktree: `/private/tmp/superego-contemporary-pilot`.
The segment is `exports/superego-contemporary-generation-2026-09-05`.
Its maintained `workflow-status.json` is `BLOCKED`, with no model activity.
The separate `exports/superego-contemporary-generation-accounting-2026-09-05`
snapshot records every response's metadata and retains a byte-identical copy of
the shared cumulative study ledger. The original run seal and status are intact.

All 19 artifact files (173,221 bytes) verified byte-for-byte in the private
archive; the maintained archive check reports zero missing. Archive commit
`3da8f81b7` is on `codex/superego-contemporary-generation-archive` in
`liammagee/machinespirits-eval-private`. Historical replay/calibration data,
approvals, results and source files are unchanged.

Directive fulfillment, material action/strategy change, blind output quality,
accuracy, lexical uptake, learner response and transfer remain unmeasured.
No inference about critique efficacy or the underlying psychological theory
follows from this incomplete draft-generation stage.
