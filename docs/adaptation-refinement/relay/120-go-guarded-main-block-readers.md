# 120 — GO: reader phase for the guarded main block, decision channel only

Date: 2026-08-16
Workplan item: guarded-learner-outcome-study
Follows: relay 119 (the resume), relay 118 (the launch), relay 117 (the
registration), re-registration 096 amendment 2, and incident I2 in
`INCIDENTS.md`
Status: **ARMED.** Section 1 carries the approval and the two withheld
launcher tokens are in (§10). The note was read while held; the M7/M8
demotion was re-examined at the human's request and stands (the exchange is
summarized in §1).

## 1. The approval

Human reply, 16 August 2026, verbatim and complete:

> GO, I approve the 1,150 reader call

Before approving, the human asked whether demoting M7 and M8 had been
premature and asked for advice. The advice given: keep the demotion for this
run — the registered ceiling fired on registered evidence; the zero-call
description over all 575 cases shows condition gaps within noise (largest
about 1.3 standard errors); and reversing the instrument choice between
generation and the readers would condition it on data already seen. A small
registered reader audit of the positive-event cases was suggested as a
follow-up after the block closes. The human then approved this note as
written.

Relay 119 approved the resume. Generation is finished and that approval is
spent. **A reader phase is a paid run and needs its own note and its own
approval.** This note carries its own.

## 2. Where the run stands

Generation is complete. No reader call has been made on either channel.

| item | count |
|---|---:|
| dialogues in the frozen job list | 72 |
| sealed clean | 71 |
| admitted under the committed ruling | 1 |
| **admitted in all** | **72** |
| decision turns registered | 576 |
| dropped: turn 8 of dialogue 34, never read | 1 |
| **cases the readers will read** | **575** |

The one admission is dialogue 34,
`outcome-pilot-34-world_102_marigold_archive_box-s659-standing_permission`,
seed 659, world 102, standing permission. Its second attempt failed the
quote rule at turn 8, three times, on letter case alone. The human ruled
that a pass and set the case count at 575. The ruling is a committed
artifact, `guarded-main-block/reviewer-ruling-001-letter-case-quote.json`,
applied blind to every quarantined dialogue: it admits this one turn and no
other, and turn 3 of the same dialogue, which failed on a different rule, is
still refused. Commit `40eb78d3`.

Turn 8 stays unread and drops out. The tutor did take that turn with no
reading of the learner, so it is not a case. The manifest keeps its
registered 576; the driver computes 576 − 1 and records both numbers with
the reason, and refuses if the count of dropped turns is not the count the
ruling declares.

Seeds 654 to 665, both worlds, three conditions. Re-checked today against
`config/seed-ledger.yaml`: the range is claimed by this block and by nothing
else. The reader phase draws no new seed. It reads dialogues already on
disk.

## 3. What this note spends

**One channel, not two.** Re-registration 096 amendment 2 retires the
presence readers for the main block. They exist only to measure M7 and M8,
and the pilot demoted both to report-only. Re-fielding them would spend
about 1,150 paid calls on a demoted instrument.

| channel | calls |
|---|---:|
| decision readers, 575 cases × 2 fresh readers | 1,150 |
| presence readers | 0 |

The cap on the decision line is 1,152. The run asks for 1,150 and the
driver refuses any call past the line.

Relay 118 planned about 2,300 reader calls. This note spends half of that.
The presence line stays in the sealed plan as unspent head room, so the
manifest and the registered plan total need no change and none is made.

## 4. Two faults, found at zero calls, and the repairs

Both sat past the point every earlier check stopped at. One zero-call probe
over the real 575-case corpus found both. Repairs landed at `4996394e` with
their tests before this note was written. Nothing paid was touched.

**Fault one — the frozen tooling refuses at a moved head.** The reader
tooling is hash-frozen. Each pinned file asks its *own* checkout for the
commit, and the run's three-way agreement needs the freeze, the collection
manifest and that checkout to name one commit on a clean tree. The run
launched at `a0de1500`. Repairs since then moved the branch. The pinned
files cannot be edited to fix this, because editing them is what the freeze
forbids.

The repair is a second checkout, parked at the launch commit, that the
reader phase speaks from. The driver takes `--pinned-checkout`, checks that
it is a git checkout at exactly `a0de1500`, checks that it is clean, and
hashes its three pinned files against the sealed manifest before it uses
them. It then imports the preparers from there and runs the reader child
there. Reading pinned bytes out of a pinned checkout is not an edit, and the
hashes prove it.

The checkout is
`/Users/lmagee/Dev/machinespirits/ms-guarded-readers-pinned`. It was first
made under `/private/tmp`. Lesson 7 of incident I2 says a run must not
depend on a path a housekeeping job can empty, so it was moved to a durable
place and every check re-run there.

**Fault two — the registration and the driver disagreed.** Amendment 2 was
written, approved and committed, and the driver still built the presence
collection and still launched the presence child. A registration binds the
run only where the code reads it. The run shape now carries
`presence_readers_fielded`, false for the main block. With the channel not
fielded, the run prepares no presence collection, launches no presence
child, reserves nothing for it, and scores through the main-block scorer.

Defect ledger rows 25 and 26. Incident I2 gains both repairs and three
lessons.

## 5. Budget

Nothing here raises the registered plan. The plan total is **4,464 calls**,
the one relay 117 §5 registered and relay 118 §5 carried. This note spends
inside it and does not raise it; the driver refuses any call past the plan.

| item | calls |
|---|---:|
| generation, counted from the traces | 1,949 |
| decision readers, this note | 1,150 |
| presence readers, not fielded | 0 |
| **real spend for the whole block** | **3,099** |

**Generation spend, recovered from the traces rather than the checkpoint.**
The parent books 1,846. A quarantined child records zero reserved calls at
the parent while it still spends them, which relay 119 §4 met and incident
I1 met before that. Counted directly from every child's own
`model_call_budget_reserved` events:

| source | calls |
|---|---:|
| 72 live dialogue directories | 1,873 |
| 3 quarantined first attempts, set aside | 76 |
| **real generation spend** | **1,949** |

Of the 1,873, the parent booked 1,846; the 27 it did not book are dialogue
34's second attempt, which quarantined and is the one the ruling admits.

## 6. Zero-call proof, already done

Every claim in §2 to §5 was proved by running the changed driver's own
functions over the real corpus, with no model call, and re-run after the
pinned checkout was moved. What it proved:

- the launch commit read out of the run's own preflight — `a0de1500`
- the pinned checkout verified — at `a0de1500`, clean, all three pinned
  files matching the sealed manifest
- the frozen preparers loaded out of that checkout
- 72 dialogues admitted; 575 cases, as 576 − 1; the fingerprint guard passes
- 1,150 decision packets built, 575 for each reader
- the authorization request asks 1,150 against a cap of 1,152
- exactly one child launches; its script and its working directory are both
  inside the pinned checkout
- no presence collection is built, no presence child launches, and nothing
  is reserved for that line
- the score path refuses on missing reader evidence, not on a digest
  mismatch — the fail-closed rule working as designed

Relay 119 §6 learned that the launch simulation does not reach the reader
phase. This is the check that does.

## 7. The command

Copied from relay 119 §7, with the note moved to this one and the two flags
the driver's own usage output names:

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/120-go-guarded-main-block-readers.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json \
  --shape main-block \
  --learner-profile overconfident \
  --reviewer-ruling docs/adaptation-refinement/guarded-main-block/reviewer-ruling-001-letter-case-quote.json \
  --pinned-checkout /Users/lmagee/Dev/machinespirits/ms-guarded-readers-pinned \
  --resume
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`, which must be clean and committed. The pinned
checkout must stay clean and stay at `a0de1500`; the driver refuses if it
has moved.

On resume the driver skips all 72 sealed dialogues, applies the ruling,
builds the 575-case corpus, and spends the decision calls.

## 8. What measures 7 and 8 become

M7 and M8 are described from the generation-time events already stored, over
all 575 cases, at zero calls. They are marked **report only** and **not
reader-validated**. The numbers, computed today:

| measure | overall | bare | gated | standing permission |
|---|---:|---:|---:|---:|
| M7, result requests | 43/575 = 7.5% | 18/192 = 9.4% | 14/192 = 7.3% | 11/191 = 5.8% |
| M8, proposed tests | 49/575 = 8.5% | 17/192 = 8.9% | 17/192 = 8.9% | 15/191 = 7.9% |

These do not gate anything and no claim rests on them. The pilot's
presence-reader numbers stand as the validated base rate for both.

## 9. Stop rules

Carried from relay 119 §9, unchanged:

- The **primary endpoint is measured, never gated.** A null is a finding.
- A defensive turn read as a low-agency deferral is **terminal**. Stop and
  report.
- Persona collapse — the guarded learner stops over-claiming — stops the run.
- A technical failure quarantines and gets reported. **Never patch a live
  run.** `--resume` is for a clean restart, not for a fix.
- One retry per failed call. One re-take per quarantined reading.
- The budget is not raised mid-run.
- A substantive fail stays terminal.
- One re-take only. A second failure at the same place is reported, not
  re-run.

One more, for this phase: **every accepted response passes the full
deterministic contract at acceptance, not at assembly.** That is the 094a
rule and amendment 2 restates it.

## 10. What arms this note

The launcher reads four things out of these bytes: that the file names the
executable entry point (§7 does); a bare go word; the plan total in digits;
and the first and last seed, 654 and 665 (§2 and §7 have both).

All four are here now. Two were withheld while this note was held — the go
word and the plan total in digits — and arming put them in: the word in the
title, the total as 4,464 in §5. The other change made at arming is §1,
which records the approval verbatim and the M7/M8 exchange that preceded
it. Nothing else moved: not the command, not the seeds, not the budget, not
the stop rules.

The check on these bytes is the only machine lock left after
`--accept-charges`. The sealed manifest's `launch_authorized` field is still
prose the driver never reads — defect ledger entry 20, fix still open, and
it does not land while this run is live.

## 11. Counter

- last recorded: **11,559 / 19,337** (relay 118 §5, itself from relay 115
  §10)
- generation, counted from the traces rather than the checkpoint:
  **1,949** → **13,508 / 19,337**
- this note: **1,150** → **14,658 / 19,337**, leaving **4,679**

Relay 119 projected at most 16,099 on a full spend of both channels. Not
fielding the presence readers brings the block in about 1,440 under that.

## 12. After the run

Archive first: `npm run archive:runs` with the run directory named, then
commit in the private repo. The artifacts through the re-take are already
committed there at `0070ddfa`; the reader phase adds to them.

Then, in the order relay 118 §10 sets: assembly, the acceptance audit over
every reader response, the assembly gate of relay 117 §6, the two scorers at
`--shape main-block`, then the decision-correctness split per relay 117 OD3.
Interpretation stays with the reviewer.

The whole failure history is disclosed in the run report — the three
quarantines of 15 August, the one that failed twice, and anything this phase
adds.

NEVER push this branch.
