# Tutor instrumentation A/B

The instrumentation A/B runs one recorded dialogue past a bare tutor and an
instrumented tutor, grades every arm with the same deterministic rubric, and
renders the arms as a swimlane diff. It answers a narrow question: on this
turn, with this learner, what does each piece of the tutor's private planner
context buy?

It is a visual and regression instrument. It says nothing about human learning.

## What is held frozen

Every arm replays the same recorded turns. Frozen across arms:

- the public dialogue prefix (every prior tutor and learner utterance),
- the automated learner's utterance for the current turn,
- the world, the evidence state, and the committed/due boundary,
- the session system prompt,
- the guard set the rubric runs.

The only thing that varies is the private planner context delivered to the
speaking tutor.

## How an arm is built

The tutor stub already delivers its augmentation as discrete labelled blocks in
the final user message of the frozen first-draft request:

```
[Tutor-only public evidence window]
…
[End Tutor-only public evidence window]

[Tutor-only host plan]
…
[End Tutor-only host plan]

Learner says:
…
```

An arm is a subset of those blocks. Dropping a feature removes its block from
the request and changes nothing else, so instrumentation becomes an addressable
projection over a frozen request rather than something that can only be varied
by rerunning the whole dialogue. Strip every block and what is left is exactly
the learner's utterance — which is the baseline arm.

The registry is in `services/tutorStubAbArms.js`:

```bash
npm run tutor:stub:ab -- --list-features
```

| Feature | Block | What it carries |
| --- | --- | --- |
| `context_continuity` | `Tutor context continuity` | The full public prefix was replayed in order |
| `evidence_window` | `Tutor-only public evidence window` | Committed/due boundary: what may and may not be said |
| `learner_classifier` | `Tutor-only learner classifier` | Discourse move, evidence use, stance, immediate need |
| `learner_dag` | `Tutor-only redacted learner-DAG model` | Redacted proof-DAG: coverage, bottleneck, grounded facts |
| `human_scaffold` | `Tutor-only human discourse scaffold` | Branch, local question, warrant frame, proof debt |
| `first_draft_contract` | `Tutor-only host plan` **or** `Tutor-only first-draft performance contract` | Part, action, composition slots, progression, sources |

The contract feature owns two headers because the emitter renders the same slot
under either name. Registering them separately would let an arm report that it
dropped the contract while the contract was still in the request under its other
name; the test suite asserts that no header is claimed by two features.

## The rubric

The rubric is `auditTutorStubFrozenCandidate` — the same deterministic frozen-turn
audit the PR benchmark uses. It is model-free: leakage, dramatic release,
response composition, actorial realization, turn progression, source alignment.

**Guards are pinned to the recorded run.** Every arm is audited with the guard
set the recording had enabled, not with its own. Without pinning, a bare arm
would be graded with all guards off and would pass trivially; with pinning,
dropping the evidence window makes the leak guard *harder* to satisfy rather
than switching it off. Pinning is an exact identity on the fixtures' recorded
guards, so it cannot itself move a verdict — a test asserts this.

### Read cluster counts, not pass rate

The audit verdict is all-or-nothing per turn, and one check can fail
universally, which collapses pass rate to a constant across arms. The headline
metric is therefore the failure-cluster tally per arm and its delta against the
baseline; the per-cluster delta table sums to that headline so the top-line
number is always auditable against the rows.

At time of writing every recorded fixture turn fails
`liveTurnProgressionAudit:learner_uptake_not_realized` on both arms, so pass
rate reads 0/N everywhere. This is not an artifact of the A/B — it is the
known *live-parity reclassification* the frozen-replay corpus already tracks.
`auditTutorStubFrozenCandidate` skips the live turn-progression and
source-alignment audits only when handed a valid `jointPerformanceComposition`,
and a text-only replay never has one, so those audits re-derive the composition
from raw text and hold it to a stricter standard than the recording met.

The effect is directly observable in the corpus. Re-auditing the *recorded*
text of nocturne t007, t009, and t010 — all three of which carry
`recordedAuditOk: true` and no recorded clusters — yields `ok: false` today,
failing only on `live_turn_progression_v1:` / `live_source_action_alignment_v1:`
clusters. `tests/tutorStubFrozenReplay.test.js` asserts exactly this pattern
and fails loudly if a reclassification ever lands outside those two families,
so the strictness is deliberate and bounded rather than drift.

What this does *not* establish: whether `tutor:stub:pr-benchmark` now gates
harder than it used to. That benchmark grades freshly generated text through
the same text-only path with `require_audit_ok: true`, and a fresh candidate
may well realize its uptake in a way the recorded ones do not. Nothing here has
been run against it.

For the A/B itself the consequence is only that pass rate is uninformative.
The cluster deltas still separate the arms, and they are what the reports lead
with.

Cluster names come in two conventions on the same audit: `failureClusters` uses
`liveTurnProgressionAudit:…`, `hardFailureClusters` uses
`live_turn_progression_v1:…`. They are the same checks.

### Within the cluster count, read the open column

The tally above is not a ruler the arms start level on. The bench computes a
per-turn performance contract for every turn and grades every arm against it,
but shows it to one of them. Some rules ask *did you play the part your plan
named*, and an arm holding no plan cannot win those at all.

`services/tutorStubAbRuleKeying.js` grades each rule by one question:

> Could a tutor handed nothing but the public transcript and the learner's turn
> have satisfied this rule?

A prohibition — do not repeat yourself, do not state the answer early, do not
claim two exhibits match before that is public — passes. Every arm satisfies it
by not doing the thing, and the bare tutor's ignorance costs it nothing. Graded
**open**. A rule that demands a particular thing be said, or said a particular
way, where the particular is fixed by the plan's own named slots or by a release
schedule in the world file that only the plan relays, fails. Graded **told**.

The test is *not* "does this rule read private data" — it is whether an untold
speaker could have come out the other side clean.

Every arm reports `openClusters`, `toldClusters`, and the matching deltas, and
the report tables lead with open. The told total stays visible on purpose: the
gap between the two is the size of the bench's own bias, measured rather than
asserted. Pooled over the recorded corpus the contract's headline −3.08 broken
rules per turn is −2.61 told and −0.47 open, so about 85% of it sits on rules
the bare tutor was never in a position to win.

Rules are keyed by issue type alone, not `guardFamily:issueType` — the live and
V2 turn-progression audits raise the same names, and a recovery pass re-raises
names it did not author, but the answer to "could an untold tutor have avoided
this" does not change with the family that noticed it.

A rule nobody has classified is counted in a third bucket and printed, never
folded into either total, so the two halves need not add to the headline count.
Summarising never throws on an unknown rule — that would lose a paid run at the
last step — so drift is caught by a checked-in table in
`tests/tutorStubAbHarness.test.js` listing every rule the corpus has raised with
the class it was given.

Recorded runs can be re-split with no model calls:

```bash
node scripts/rescore-tutor-stub-ab-open-rules.js --pooled
```

It reads `report.json` files and re-derives everything from `failureClusters`,
never from the stored summary, so runs recorded before the split existed score
identically to runs recorded after. It reports rates per turn rather than raw
counts, because arms do not all appear in every run — the baseline has been
replayed on far more turns than any single variant, so a raw difference between
two totals would compare two different amounts of work.

## Running it

Inspect the zero-call plan first:

```bash
npm run tutor:stub:ab -- --print-plan
```

Run the default two-arm comparison over three frozen turns (six calls):

```bash
npm run tutor:stub:ab
```

Presets: `smoke` and `default` (6 calls, tallow), `strong` (14 calls, the
seven-turn nocturne arc), `ablation` (12 calls, baseline + two single-feature
drops + full), `cross_model` (12 calls, codex and Claude Code side by side).

Ad-hoc feature sets, without editing the config:

```bash
npm run tutor:stub:ab -- --features evidence_window,first_draft_contract
```

```bash
npm run tutor:stub:ab -- --drop learner_dag,human_scaffold
```

Both overrides apply to non-baseline arms only. The baseline is the reference
the other lanes are diffed against, and an override that quietly gave it
advisories would make every delta meaningless. If an override collapses two
selected arms onto the same feature set, the plan fails rather than reporting a
comparison against a duplicate.

Re-render Markdown and HTML from a saved report, with zero calls:

```bash
npm run tutor:stub:ab -- --render-report exports/tutor-stub-ab/<run>/report.json
```

Exit codes: `0` complete, `1` at least one arm failed the rubric, `2` blocked or
budget exhausted. A single infrastructure error blocks that model for the rest
of the run instead of burning the budget on repeats; there are no retries and
concurrency is 1.

## Artifacts

Each run writes to `exports/tutor-stub-ab/ab-<stamp>/` (honouring
`EVAL_EXPORTS_DIR`):

- `swimlane-diff.html` — the reading surface,
- `report.md` — arm table, cluster deltas, pass flips,
- `report.json` — projections, guard sets, full audits, generated text.

`report.json` retains generated candidate text. Do not paste rejected candidates
into a public PR without reviewing them for leakage.

## Reading the swimlane diff

The learner takes the spine, because the learner is shared: every arm answers
the same utterance. The arms run as parallel lanes beneath it, so a turn reads
top-to-bottom as one learner move and N tutor replies to it.

Two toggles:

- **Diff** highlights words present in an arm's reply but not in the baseline's,
  by longest-common-subsequence over case- and punctuation-folded tokens.
- **Clusters** shows each turn's failure clusters inline on the lane.

### The counterfactual caveat

Turns after the first are counterfactual for every arm except the one that
produced the recording. The frozen learner utterances were written in response
to the recorded tutor, not to this arm's replies. Read each row as an
independent same-context comparison — N tutors answering one fixed prompt — not
as two conversations running side by side. The renderer carries this caveat on
the page.

## Configuration

`config/tutor-stub-ab.yaml` defines models, arms, scenarios, presets, the rubric
binding, budgets, and the frozen-replay invariants. The invariants
(`regenerate_prior_dialogue`, `generate_learner`, `classify_learner`,
`update_learner_dag`, `continue_dialogue`) must all be `false`; turning any of
them on would mean the arms no longer share a public prefix and the comparison
would stop being one. Config validation rejects a run otherwise, and also
rejects a baseline arm with any features, more than one baseline, concurrency
above 1, and any retry budget.

## Relation to the free-running showcase

`tutor:stub:showcase` (`docs/tutor-instrumentation-showcase.md`) runs the same
two architectures as two *free-running* dialogues, each with its own automated
learner, each allowed to close. It produces the transcripts a reader can follow
end to end, plus per-arm cost and guard-coverage numbers.

It cannot carry a causal claim: with two learners the transcripts diverge after
the first exchange. The division of labour is the point — the showcase shows
what the system does, the A/B says what caused a difference. Read them together
and the showcase's numbers stay descriptive.

## Relation to the PR benchmark

`tutor:stub:pr-benchmark` asks whether *this commit* regressed the tutor, on one
architecture, across two model CLIs. `tutor:stub:ab` asks whether *this
instrumentation* earns its place, on one commit, holding the dialogue fixed.
They share fixtures, the frozen-replay machinery, and the rubric.
