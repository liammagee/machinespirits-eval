# Superego human comparison: complete generation

The fixed generation cohort completed all 60 jobs and produced all 48 public
outputs for the four-arm comparison. There were no rejected outputs, transport
failures, missing dependencies, replacements or extra provider probes. The next
step is two independent human quality ratings; no teaching-quality effect has
yet been estimated.

## Observed results

| Measure | Observed |
| --- | --- |
| Draft units / contexts | 12 / 6 |
| Drafts / critiques / revisions accepted | 12 / 12 / 36 |
| Public outputs available | 48 / 48; 12 per arm |
| Failed or missing generation jobs | 0 / 0 |
| Provider attempts / replacements | 60 / 0 |
| Attempt ceiling / unused recovery reserve | 66 / 6 |
| Usage-derived cost | $0.623430 |
| Durable dollar reservations / ceiling | $4.224000 / $4.646400 |
| Input / output tokens | 95,520 / 43,239 |
| Cache creation / cache read tokens | 0 / 0 |
| Automated judgments / human ratings | 0 / 0 |
| Start / finish | 2026-09-05 22:46:52 / 22:55:30 UTC |

All responses report the registered direct Anthropic `claude-sonnet-5` model and
passed the registered output validation. Usage-derived cost uses saved provider
usage and the registered $2/input-million and $10/output-million rates, verified
against [Anthropic's pricing](https://platform.claude.com/docs/en/models/overview)
before dispatch. It is an estimate from usage, not a billing invoice.

This establishes that this fixed cohort was executable with full public-output
availability. It does not establish why the earlier cohort emitted repeated
whitespace, that plain-text generation cured the underlying provider issue, or
that relevant critique improves teaching. The earlier and current cohorts differ
in seed and public-output instructions; they are not a randomized comparison of
output formats. Earlier replay, calibration and generation data remain unchanged.

## Provenance and preserved data

The [merged design](superego-contemporary-pilot-design.md) ran from clean commit
`4b6a00c56ef64dc0d4879ce48f3dc029a4238ff9`, tree
`0a5bb772695d01bcd3c75d893744426d223d7f7b`, on
`codex/superego-human-live`. The
[approval record](2026-09-05-superego-human-comparison-go.md) quotes the user's
instruction to continue without a repeated PR/GO cycle. No new approval or merge
was required between that record and generation.

The launch worktree is `/private/tmp/superego-human-generation`:

- `exports/superego-human-generation-2026-09-05/` contains the exact requests,
  responses, plan, settings, ledger, progress records and blinded quality packet.
- `exports/superego-human-generation-accounting-2026-09-05/` contains an exact
  snapshot of the cumulative study ledger and per-response usage accounting.
- All **132 files / 1,703,685 bytes** were verified byte-for-byte in the private
  archive. Commit `d1920279a` is on `codex/superego-human-generation-archive` in
  `liammagee/machinespirits-eval-private`.

The shared ledger remains at
`/Users/lmagee/.machinespirits-data/paid-studies/superego-contemporary-human-comparison/study-ledger.jsonl`.
No accounting was reset or redirected, and the six reserve attempts remain unused.

## Infrastructure correction

The completed run exposed a reporting defect: its final ledger status says
`paused_recoverable` with `recovery_permitted: true`, inherited from the older
two-stage generation-plus-model-judging runner. The same seal records 60 terminal
jobs and zero missing jobs; the current design permits no automated judging.
There is therefore no remaining paid work for this cohort.

The sealed record is retained exactly. A focused correction makes future
generation-only completions seal as `local_package_ready`, without paid recovery
permission. Read-only reconstruction and human reporting continue to work;
actual technical interruptions and the historical two-stage mode retain their
existing recovery behavior. All 20 relevant historical/prospective runner tests
pass, including a regression rejecting an empty paid recovery after completion.

The broader [infrastructure review](../workplan/items/paid-study-infrastructure-review.md)
also records the avoidable coordination problem: insisting on a literal token
after an explicit instruction to proceed delayed work without strengthening the
registered scientific or spending limits. The user's later instruction resolved
that issue; no new authorization framework was added.

## Scientific handoff

Give each of two independent human readers only the
`human-quality-review/` folder from the generation artifact, or the identical
two-file delivery ZIP at `/private/tmp/superego-human-review-2026-09-05.zip`.
Each reader opens `review.html`, uses their own reader ID, assesses all 48 public
outputs, and downloads their completed ratings. Keep their ratings separate
until both finish. Do not disclose the treatment plan or internal critiques.

Once both files exist, the existing `--human-report` command combines them
offline. It reports each reader's paired contrasts, exact-consensus disagreement,
accuracy separately, and full-unit uncertainty bounds. Its primary contrast is
actual critique minus generic revision, with a one-point planning target.

Current workflow disposition is `HANDOFF_PENDING` for human quality ratings.
Directive fulfillment, material action/strategy change, lexical uptake, learner
responses and transfer are not measured by this cohort. No model is substituted
for either human reader, and no quality, efficacy or theory claim is licensed by
successful generation alone.
