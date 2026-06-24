# A17 D5 matched branches and fresh redraw

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

The user approved both next D5 rescue paths:

1. Add a small helper that can generate missing D5 `socratic`/`reveal`
   branches from an already-admissible redacted `none` prefix.
2. Run a fresh D5 redraw under the same cheap-screen rule: generate `none`
   first, spend QA only if the local no-cue screen passes, then add matching
   `socratic`/`reveal` branches from that new prefix.

No D4 generation, original graded scoring, learner replay, replay scoring, or
paper update was run in this step.

## Tooling Added

- `scripts/generate-pedagogical-dramas.js` now accepts:
  - `--paired-prefix-trace FILE`
  - `--paired-prefix-source-branch NAME`
- `scripts/run-a17-matched-d5-branches.js` wraps that mode for A17. It:
  - verifies the source `none` root is `withhold_secret` and not quality-gated;
  - generates only `socratic,reveal` from the saved prefix;
  - verifies matching shared-prefix hashes, branch policies, and quality status;
  - runs QA only for the generated positive branches.
- Package alias:
  `npm run poetics:a17-matched-d5-branches -- ...`

No-cost validation before paid use:

```bash
node --check scripts/generate-pedagogical-dramas.js
node --check scripts/run-a17-matched-d5-branches.js
npm run poetics:a17-matched-d5-branches -- --dry-run --source-root exports/a17-one-side-replay-replication/d5-redacted-control-run5
```

Mock smoke generated a temporary redacted `none` source and then matched
`socratic,reveal` from it; mock QA passed `socratic` T2 and `reveal` T3.

## Run5 Matched Branches

Source root:

- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/`

Command:

```bash
A17_PAID_BRANCH_APPROVED=YES npm run poetics:a17-matched-d5-branches -- --approve-paid --source-root exports/a17-one-side-replay-replication/d5-redacted-control-run5
```

Source `none` status:

- prefix hash: `593d1653b453b399`
- `quality_status: ok`
- `quality_warning_count: 0`
- `quality_blocking_warning_count: 0`
- T1 QA: `withheld_ok`, tutor withheld `3/4`

Generated branches:

- `sample/socratic/T01.txt`
- `sample/reveal/T01.txt`
- `director-socratic.json`
- `director-reveal.json`
- `key-socratic.yaml`
- `key-reveal.yaml`
- `qa-oedipus-arms-socratic-reveal.json`

Branch verification:

- `socratic`: `tutor_adaptation_policy: socratic_discovery`,
  `quality_status: ok`, prefix hash `593d1653b453b399`
- `reveal`: `tutor_adaptation_policy: reveal_secret`,
  `quality_status: ok`, prefix hash `593d1653b453b399`

Branch QA:

- `socratic` T2: `metered_ok`, tutor metered `3/4`
- `reveal` T3: `stated_ok`, tutor stated `4/4`

Result: run5 is now a complete admissible D5 three-arm root.

Generation usage recorded in saved traces:

- `none`: 107028 input tokens, 10294 output tokens, 637813 ms summed per-call
  latency
- `socratic`: 114794 input tokens, 9743 output tokens, 633465 ms summed
  per-call latency
- `reveal`: 118326 input tokens, 10725 output tokens, 677983 ms summed
  per-call latency

No dollar total or QA judge-call usage total was persisted.

## Run6 Fresh Redraw

Fresh root:

- `exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/`

First, generated only `none` under the cheap-screen gate:

```bash
A17_PAID_GATE_APPROVED=YES npm run poetics:a17-redacted-control-gate -- --approve-paid --root exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6 --variation-key a17-d5-redacted-full-redraw-run6
```

Run6 `none` passed:

- prefix hash: `94dfdce7443db570`
- `quality_status: ok`
- `quality_warning_count: 0`
- `quality_blocking_warning_count: 0`
- T1 QA: `withheld_ok`, tutor withheld `4/4`

Then generated matching positive branches from the run6 prefix:

```bash
A17_PAID_BRANCH_APPROVED=YES npm run poetics:a17-matched-d5-branches -- --approve-paid --source-root exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6
```

Branch verification:

- `socratic`: `tutor_adaptation_policy: socratic_discovery`,
  `quality_status: ok`, prefix hash `94dfdce7443db570`
- `reveal`: `tutor_adaptation_policy: reveal_secret`,
  `quality_status: ok`, prefix hash `94dfdce7443db570`

Branch QA:

- `socratic` T2: `metered_ok`, tutor metered `4/4`
- `reveal` T3: `stated_ok`, tutor stated `4/4`

Result: run6 is a second complete admissible D5 three-arm root, independently
redrawn under the cheap-screen guard.

Generation usage recorded in saved traces:

- `none`: 107956 input tokens, 9402 output tokens, 603597 ms summed per-call
  latency
- `socratic`: 126518 input tokens, 11465 output tokens, 673397 ms summed
  per-call latency
- `reveal`: 127742 input tokens, 12086 output tokens, 709667 ms summed
  per-call latency

No dollar total or QA judge-call usage total was persisted.

## Stop Decision

D5 is no longer the blocker for A17. There are now two complete admissible D5
three-arm roots:

- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/`
- `exports/a17-one-side-replay-replication/d5-redacted-full-redraw-run6/`

The next A17 blocker is the remaining cross-scene pipeline: generate an
admissible D4 root, then run original graded scoring, learner-side replay, and
replay scoring for the selected D5 root plus D4 before any §7.9 paper update.
