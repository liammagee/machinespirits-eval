# 118 — GO: guarded-learner main block

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 113 (the pilot's launch note, used as the model), 116 (act
list), 117 (registration), and the driver build at `80fdd69e`
Status: **GO.** Committed before any call is made. This note was first
sealed held, with §1 empty and two of the launcher's four tokens
withheld; §1 was filled on the same day and the tokens went in with it.

## 1. The approval

The human's reply, verbatim and complete:

> I approve the spend, fill in section 1

"The spend" is the spend §5 sets out and relay 117 §5 registered: the
72-dialogue guarded main block, 4,464 planned calls, absolute cap 4,800.
Nothing else is approved by these words. The pilot's approval reached the
pilot and stopped there; this one reaches this block and stops here.

**What the filling edit changed**, and nothing else:

1. the words above, pasted verbatim;
2. the status line, from held to go;
3. the plan total written in digits in §5, and the go word in this title
   — the two tokens the held form withheld (§6).

The design, the command, the seeds, the budget and the stop rules are
byte-for-byte as they were when the note was held and read.

## 2. What was built before this note

Relay 117 §9 ordered the scoring build to land **before** the launch note,
so the run is read by frozen code rather than by a hand count. That build
is in: both scorers now carry a main-block shape — 72 dialogues, 24 gated,
576 cases — behind `--shape main-block`, with a test on each shape and no
change to any counting rule. The driver build followed at `80fdd69e`: the
run size is now a value the manifest states, not a number welded into the
driver.

With that done, the whole launch fits on one page, and the spend was
approved or refused in one reading.

## 3. What would run

Read off the sealed manifest
(`docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json`)
by machine, not composed here.

- **72 dialogues**: 3 conditions (bare / gated / standing permission) x 2
  worlds (101 kestrel signal lamp, 102 marigold archive box) x 12 seeds,
  8 turns each.
- **Seeds 654–665**, registered by relay 117 §11. Re-checked today at zero
  calls with the seed ledger, output copied:

      654-665 is free — 12 seeds, searched repo only.
      12 of them are already claimed by "guarded-learner main block", which is its own claim.

- **Guarded persona** (`overconfident`), unchanged from the pilot.
  Contract v3.3, unchanged.
- **Both reader channels**, two readers each, 576 cases per reader. The
  presence readers carry the primary endpoint, so they cannot be dropped
  the way the passive block dropped them.
- Condition order interleaves by a running world-visit count, the pilot's
  rule. The 72 rows cover every (world, seed, condition) cell once, 24 per
  condition. Checked in test, not by eye.

## 4. The command

Copied from the driver's own usage output at `80fdd69e`, with the sealed
paths filled in:

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/118-go-guarded-main-block.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json \
  --shape main-block \
  --learner-profile overconfident
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`, which must be clean and committed.

`--shape main-block` is optional. The manifest is the authority on size;
the flag only lets the caller say out loud which run they think they are
starting, and the driver refuses when the two disagree.

The instrument freeze is the pilot's. It holds at any size: it pins the
reader instrument, the handbooks, the schema acceptance and the corpus,
and carries no dialogue count and no seed.

**This command does not run today.** It stops at the note, by design.

## 5. Scope and budget

| phase | plan | note |
|---|---:|---|
| generation | 2,160 | 30 per dialogue, a cap not an estimate |
| presence readers | 1,152 | 2 readers x 576 cases |
| decision readers | 1,152 | 2 readers x 576 cases |
| **total** | **4,464** | the number the driver enforces |

**The cap absorbs the retries.** The driver refuses any call past the plan
total, so there is no separate allowance sitting outside it. The room
comes from generation: the pilot planned 540 and spent 470, about 26 calls
per dialogue against a 30 cap. At the same rate 72 dialogues cost about
1,900, which leaves roughly 260 calls of slack for retries and for the
re-take allowance of ten per channel that relay 094a set. That is how the
pilot paid for 289 reader attempts on each channel against a plan of 288.

Relay 117 §5 registered an absolute cap of 4,800. The driver enforces the
tighter number, and the tighter number governs.

**Counter**, re-read today, not inherited:

- last recorded: **11,559 / 19,337** (relay 115 §10, unchanged by relay
  116 and by the build commits)
- after this run, if it completes: **16,023 / 19,337**, leaving **3,314**

The manifest's ledger fields were written from that same reading at seal
time and are marked not stale, so the arithmetic in the manifest and the
arithmetic here are one calculation, checked in §7.

## 6. What arms this note

The launcher reads four things out of these bytes:

1. that the file names the executable entry point — §4 does;
2. a bare go word — the title has it;
3. the plan total in digits, with or without a thousands comma — §5 has
   4,464;
4. the first and last seed, 654 and 665 — §3 has both.

All four are here, so the launcher takes the file. While the note was
held, two were missing on purpose: it read complete to a person and failed
closed to the machine, so it could be reviewed before it could be run.

The check on these bytes is the **only** machine lock left after
`--accept-charges`. See §11. The note is now open, so from here the lock
is the human's, not the harness's.

## 7. What was checked at zero calls

`scripts/simulate-guarded-main-block-launch.js` runs the launcher's guard
chain on the sealed manifest and stops before the first call. It hands
over no dialogue runner and no reader process, so it cannot spend. Eight
checks, all held:

| check | result |
|---|---|
| the manifest binds to the main-block size | 72 dialogues, 576 cases |
| the prepared-run identity guard passes | 72 prepared runs, no duplicate, no overlap with any burned corpus |
| the counter arithmetic closes | 11,559 + the plan = 16,023, 3,314 left under 19,337 |
| the pilot's launch note cannot launch this block | refused |
| `--shape pilot` cannot launch this manifest | refused |
| a pilot checkpoint cannot be resumed into this run | refused |
| the budget opens with nothing spent | plan loaded, actual 0 |
| this note, handed over as the launch note | accepted for this size |

The last row is the one that changed when §1 was filled. The simulation is
told which answer it must get, so the check cannot pass both ways:
`--go-note` says the note must launch and fails if the launcher refuses
it; `--held-go-note` says the opposite, and is what the held form was
checked with. The command that wrote the artifact:

```bash
node scripts/simulate-guarded-main-block-launch.js \
  --go-note docs/adaptation-refinement/relay/118-go-guarded-main-block.md \
  --out docs/adaptation-refinement/guarded-main-block/main-block-launch-simulation.json
```

The artifact it writes is
`docs/adaptation-refinement/guarded-main-block/main-block-launch-simulation.json`.

The launcher re-runs every one of these at launch. If any pin has moved
since this note, the run refuses to start.

## 8. Stop rules

Carried from relay 117 §8 and relay 113 §7, unchanged:

- The **primary endpoint is measured, never gated.** A null is a finding.
- A defensive turn read as a low-agency deferral is **terminal**. Stop and
  report.
- Persona collapse — the guarded learner stops over-claiming — stops the
  run.
- A technical failure quarantines and gets reported. **Never patch a live
  run.** `--resume` is for a clean restart, not for a fix.
- One retry per failed call. One re-take per quarantined reading, per
  relay 094a.
- The budget is not raised mid-run.
- A substantive fail stays terminal.

## 9. Pooling

The 18 pilot dialogues never pool into any confirmatory table. They may
stand beside one, labelled as pilot description. Smoke C never joins
either. No threshold is invented after unblinding.

## 10. After the run

Archive first: `npm run archive:runs` with the run directory named, then
commit in the private repo. `exports/` and `.tutor-stub-auto-eval/` are
not in git, and a run has already been lost this way.

Then, in order: assembly, the acceptance audit over every reader response,
the assembly gate of relay 117 §6, then the two scorers at `--shape
main-block`, then the decision-correctness split per relay 117 OD3.
Interpretation stays with the reviewer.

## 11. A lock that does not work

The sealed manifest carries `launch_authorized: false` and a `hold`
sentence saying no call may run until an approved note is committed. The
driver reads neither field. Both are prose.

So the note bytes are the only machine lock after `--accept-charges`. That
is why the held form withheld two of them instead of leaning on the
manifest. Recorded as entry 20 in
`docs/adaptation-refinement/relay/DEFECT-LEDGER.md`. The fix is small —
refuse a manifest whose `launch_authorized` is not true — but it lands as
its own change with its own test, and not while this run is live, because
a live run is never patched.

NEVER push this branch.
