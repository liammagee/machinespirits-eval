# Superego automated quality assessment: completed through Codex CLI

All 48 existing public responses now have an independent GPT-5.6 Sol quality
and accuracy rating, collected through the ChatGPT-authenticated Codex CLI.
No new tutor response, semantic label or human rating was generated. The next
scientific step is comparing these ratings with the two independent human files.
Keep the model scores and this operator handoff separate from the readers' form.

## Verified collection and accounting

| Measure | Observed |
| --- | --- |
| Source corpus | Same 12 draft units in six contexts; four arms, 48 public outputs |
| Accepted model ratings | 48 / 48 |
| Invalid or indeterminate model ratings | 0 |
| CLI process attempts | 49 / 52 |
| Successful model turns | 48 |
| Preserved pre-turn configuration failures | 1 |
| Unused reserve attempts | 3 |
| Direct API calls / spend | 0 / $0 |
| Subscription dollar cost | Not independently exposed; existing account allowance consumed |
| CLI model / effort / version | codex.gpt-5.6-sol / low / 0.153.0 |
| Prohibited tool events | 0 |
| Usage observed | All 48 successful turns |
| Input / output tokens | 469,483 / 11,790 |
| Cached input / reasoning output tokens | 104,448 / 3,700; subsets of the respective totals |
| Successful scoring segment | 2026-09-05 23:42:12–23:56:22 UTC |
| Human ratings collected | 0 |

The first admission was rejected before destination creation because the shared
note parser did not accept the ordinary sentence '$0.'. A tested code fix accepted
sentence punctuation without changing the approval or scientific inputs.
The first admitted CLI process then failed during configuration loading: this CLI
version prohibits overriding built-in provider IDs. Empty stdout and its exact
configuration error are preserved. The bridge now uses a named configuration with
OpenAI authentication and the same ChatGPT-selected endpoint, with request and
stream retries disabled. A read-only login-status command checked that correction.

The existing shared response-free parameter-rejection recovery path verified the
saved failure and allowed only its missing work to continue. Neither local nor
shared historical seals were rewritten. The failed process remains charged to the
52-attempt ceiling. There were no additional model-backed canaries, benchmark
calls, rating replacements, alternate models or outcome-driven resampling.

Successful scoring launched from clean commit
`a07dd064180a206126d0a2321f57ad2599897439`, tree
`3e871ea2db486be4eee446889513d6322f9d28dd`. A subsequent report-metadata correction
changed future offline reporting only; the active scoring process was uninterrupted.
The [design](superego-contemporary-pilot-design.md) and
[authorization record](2026-09-05-superego-automated-quality-go.md) were committed
before scoring, under the user's instruction to proceed without another PR/GO cycle.

## Preserved artifacts and comparison handoff

Worktree: `/private/tmp/superego-automated-quality`.

- `exports/superego-automated-quality-2026-09-05/`: original pre-turn failure.
- `exports/superego-automated-quality-recovery-2026-09-05/`: 48 successful raw
  CLI responses, exact requests, settings, plan, model-ratings.json and the
  model-only report.json/report.md.
- `exports/superego-automated-quality-accounting-2026-09-05/`: verified accounting
  and byte-identical cumulative study-ledger snapshot.

All **115 files / 1,834,172 bytes** were verified byte-for-byte in the private
archive and pushed as commit `f033002f737f315b07c4ac9d442d34bc7d6527b6` on
`codex/superego-automated-quality-archive` in
`liammagee/machinespirits-eval-private`. The original human packet, its delivery ZIP,
generation outputs, previous failures and prior research results remain unchanged.

Each human still independently completes the original 48-item review form without
seeing model scores. When both files arrive, run the existing offline report with
`--model-ratings` pointing at this assessment's model-ratings.json. The output
reports human A–human B, model–human A and model–human B on identical response IDs,
separately for quality and accuracy. It preserves each reader's treatment contrasts,
all rationales, missingness and disagreement; the model cannot decide human consensus.

Individual scores and treatment contrasts remain in the private model-only report
to protect reader independence. This collection supplies a fallible model benchmark,
not human validation. The CLI records the configured model argument but does not
independently attest the backend model. CLI default instructions remain part of its
measurement route. The 48 ratings are repeated measurements of 12 draft units in
six contexts. Directive fulfillment, material strategy change, learner response and
transfer remain unmeasured. No efficacy or theory claim is licensed by this report.

## Verification and disposition

98 focused runner, shared-contract and CLI tests pass, plus the later focused
human/model report-metadata regression. Full lint, manifest, launcher inventory,
52 structural ratchets and workplan source checks pass. Hosted CI passed on the
implementation and report-correction commits; the completion-note update receives
normal hosted checks through PR #1068.

The automated assessment and private archival are complete. The overall comparison
remains HANDOFF_PENDING for two genuine independent human rating files. No additional
provider work is running or required for that comparison.
