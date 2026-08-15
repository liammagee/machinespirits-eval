# 113 — GO: the guarded-learner outcome pilot

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 110 (registration), 111 (block), 112 (re-seal)
Status: **GO.** Committed before any call is made.

## 1. The approval

The user's reply, verbatim and complete:

> Do the go note. I approve the further spend. Can we also add a time
> stamped note about our protocol (smoke test, pilot etc) so this is
> reproducible.

"The further spend" is the spend relay 110 registered and relay 111
blocked: **the guarded pilot, 18 dialogues, 1,116 calls**. This note adds
one call to that, and says so plainly in §3 so the addition is approved on
sight rather than assumed.

It does not reach the main block. The main block needs the pilot gate to
pass, its own registration, its own note, and its own word.

## 2. Rung ladder

Three rungs, in order. Each one is cheap enough to lose.

| Rung | What | Calls | Blocks the next? |
|---|---|---|---|
| 0 | schema-acceptance ping at v3.3, then a zero-call re-seal | 1 | yes |
| 1 | the pilot | 1,116 | yes — the gate |
| 2 | the main block | not costed here | needs its own note |

Smoke C was the rung below rung 0 and is already done (relay 109): one
dialogue, 26 calls, passed.

## 3. Rung 0 — one call, and why it is worth spending

Relay 112 §4 has a correction attached to it, and this is the reason for
the extra call.

Eight launcher pins are re-computed before launch. All eight match. One of
them proves nothing. `provider_response_schema_sha256` is checked by
comparing the carried-over schema-acceptance artifact against the
carried-over manifest pin — two numbers copied out of the same stale seal.

The readers are never sent that schema. The preparer builds a response
schema per batch from the live act catalogue
(`scripts/prepare-adaptive-warrant-semantic-annotations.js:192`), and at
this commit the catalogue is v3.3 with all three defensive acts. So the
presence readers would answer under a **larger** schema than the provider
was ever tested against, and nothing in the launch would notice.

Spending 1 call proves the provider takes the schema the readers actually
get, and protects the 1,116 that follow. If the ping fails, rung 1 does not
start and almost nothing is lost.

Commands, copied from the scripts' own usage strings:

```bash
node scripts/run-adaptive-warrant-semantic-brittleness-preflight.js \
  --out /private/tmp/guarded-schema-ping-v33/preflight.json
```

```bash
node scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js prepare \
  --out /private/tmp/guarded-schema-ping-v33/prepare \
  --preflight /private/tmp/guarded-schema-ping-v33/preflight.json
```

```bash
node scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js run \
  --freeze /private/tmp/guarded-schema-ping-v33/prepare/schema-acceptance-freeze.json \
  --out /private/tmp/guarded-schema-ping-v33/run \
  --approved-by "relay 113 GO, user approval 2026-08-15"
```

Then the re-seal, zero calls:

```bash
node scripts/seal-guarded-warrant-outcome-manifest.js \
  --frozen-response-schema /private/tmp/adaptive-warrant-v3-schema-ping-62e4fd0a-r47-s514/response.schema.json \
  --schema-acceptance /private/tmp/guarded-schema-ping-v33/run/schema-acceptance-result.json
```

The first two commands are zero-call and the preflight needs a clean
committed worktree. The ping's own cap is 1 call and it is written into the
result as `calls.maximum: 1`.

**Rung 0 passes when** the re-seal prints
`provider_response_schema_pin: repinned` (or `repinned_unchanged`) and the
re-sealed manifest is committed. The seal refuses an artifact that did not
pass, one with no hash, and one whose commit is not an ancestor of the
commit being sealed.

*Amended 15 August.* This paragraph first said the artifact must be stamped
at HEAD exactly. That rule decays: it holds for one commit and then refuses
a good artifact, which pushes a later re-seal toward paying for a second
ping to satisfy a bookkeeping rule. The seal now asks two durable questions
instead — was the artifact made on this line of work (ancestry), and does
the schema it accepted name the acts the contract now carries (coverage).
An artifact from before v3.3 fails the second question on its own evidence.

**If rung 0 fails**, stop. Do not launch rung 1 on the inherited pin. Report
what the provider returned. That result is itself worth having: it would
mean the v3.3 schema is too large for the provider, which changes the
instrument, not the run.

### Rung 0 result — PASSED, 15 August, 1 call

The provider accepted the v3.3 schema. The result artifact records
`status: passed`, `calls: {attempted: 1, completed: 1, maximum: 1}`,
`prohibited_tool_event_count: 0`, and a response schema naming all three
defensive acts and hashing
`149171804550890f34d8d662f358762c9ae35e689343eab87df0142f30ff1a12`. Model:
codex `gpt-5.6-luna`. Archived to the private repo at
`artifacts/guarded-learner-v33/schema-acceptance-ping/`.

The re-pin then did what a working check should do: it broke. Manifest and
freeze had been two copies of one A1 seal, so the launcher's
provider-schema check had been comparing a number with itself. Moving one
half turned a vacuous pass into a real failure. The other half was moved
from the same paid evidence by
`scripts/seal-guarded-warrant-instrument-freeze.js`, zero calls, and the
fix was proved by running the launcher's own binding check without
launching. See §4 for the one flag this changed.

## 4. Rung 1 — the pilot

**Amended 15 August, after rung 0. One flag changed; the spend did not.**
Rung 0 passed and the re-seal re-pinned the manifest to the v3.3 schema.
That broke the freeze the command below first named: the A1 freeze points
at an acceptance artifact from before v3.3, so the launcher's
`provider_response_schema` check found the manifest and the freeze
disagreeing and would have refused to start. The zero-call re-seal wrote a
guarded freeze that names the v3.3 artifact, and `--instrument-freeze` now
points at it. Every other flag is unchanged. The old value is kept here so
the change is visible:

    was: /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
    now: docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json

The corrected command below is the one a zero-call launch simulation ran:
it carried the acceptance over from the new freeze and put it through
`verifyOutcomePilotReaderBindings`, which returned `passed` on all seven
checks. It is copied from that run, not composed.

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/113-go-guarded-pilot.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-pilot-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json \
  --learner-profile overconfident
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`.

`--manifest` and `--learner-profile` travel together. The launcher refuses
when they disagree, from either side.

Scope, read off the manifest by machine, not composed:

- 18 dialogues: 3 arms x 2 worlds x 3 seeds, guarded persona.
- Seeds **515, 516, 517**, frozen in code and asserted by the runner. The
  guarded arm therefore draws the same scenarios as the passive pilot, so
  the two poles read against each other with no draw difference between
  them.
- Plan: `(18 x 30 cap) + (2 x 144) + (2 x 144)` = generation 540 + presence
  288 + decision 288 = **1116**.

## 5. Counter, re-read at GO time

The four ledger fields inside `planned_calls` are inherited from the A1
seal, because the launcher asserts that object by value. They are flagged
`stale: true` in the manifest and are **not** the numbers to use. The
current reading:

- last recorded: **10,459 / 19,337** (relay 105, steering-decomposition run)
- smoke C: **26** calls, counted from its own session log
  (`model_call: 26` in
  `.tutor-stub-auto-eval/guarded-learner-smoke-C-s550-2026-08-15/2026-08-15T01-13-12-724Z.jsonl`)
- opens at: **10,485 / 19,337**
- rung 0: 1 call, **spent 15 August** → **10,486 / 19,337**
- rung 1: 1,116 calls → **11,602 / 19,337**, leaving **7,735**

## 6. Pins verified before this note

All eight launcher pins re-hash at the branch head. The manifest binding
guard returns `passed`, the menu drift guard `passed`, the freshness guard
`passed` with persona `overconfident`, 18 prepared runs, 756 exclusion
fingerprints, and no overlap with any burned corpus. The zero-call
brittleness preflight returns `instrument_ready`, 42 checks of 42.

The launcher re-runs all of this at launch. If any of it has moved since
this note, the run refuses to start, which is the point of the pins.

## 7. Stop rules

Carried from relay 110 §7, unchanged:

- The **primary endpoint is measured, never gated.** A null is a finding.
- The evidence-demand act stayed dark on smoke C. If it is dark again
  across the whole pilot, report it as an instrument gap. Not terminal.
- A deferral mislabel — a defensive turn read as `low_agency_deferral` — is
  **terminal**. Stop and report.
- Persona collapse: if the guarded learner stops over-claiming, stop.
- A technical failure quarantines and gets reported. **Never patch a live
  run.** `--resume` exists for a clean restart, not for a fix.
- The budget is 1,116 calls. It is not raised mid-run.

## 8. Pooling

The pilot is pooled with nothing. Smoke C is a build check and never joins
it. The gate reads the pilot alone, and the main block reads the gate.

## 9. After

Archive the run before anything else: `npm run archive:runs`, then commit
in the private repo. `exports/` and `.tutor-stub-auto-eval/` are not in
git, so an unarchived run lives on one laptop. A run has already been lost
this way.

Then the gate report, then a decision on the main block. Predictions for
the main block get written from pilot evidence only.

NEVER push this branch.
