# 118 — Launch note: guarded-learner main block

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 113 (the pilot's launch note, used as the model), 116 (act
list), 117 (registration), and the driver build at `80fdd69e`
Status: **HELD. This is not yet a launch authority.** Section 1 is empty
and the note is written so the launcher refuses it. Zero calls have been
made and none is authorized.

## 1. The approval — missing

No one has approved this spend. The standing rule is that a paid call
needs two things: a committed launch note, and explicit human approval of
that spend. Nothing carries forward — the pilot's approval reached the
pilot and stopped there, and relay 117 said so when it sealed the
registration.

Relay 113 §1 quoted the human's words in full before the pilot ran. This
section stays empty until the same happens here.

**The edit that unblocks it.** One edit, made after the words arrive, and
nothing else:

1. paste the approving words here, verbatim and complete;
2. change the status line above to a plain go;
3. write the plan total of §5 in digits, which is the one token this note
   withholds (see §6).

Then commit, re-run the simulation in §7, and only then launch.

## 2. Why the note exists before the approval

Relay 117 §9 ordered the scoring build to land **before** the launch note,
so the run is read by frozen code rather than by a hand count. That build
is in: both scorers now carry a main-block shape — 72 dialogues, 24 gated,
576 cases — behind `--shape main-block`, with a test on each shape and no
change to any counting rule. The driver build followed at `80fdd69e`: the
run size is now a value the manifest states, not a number welded into the
driver.

With that done, the whole launch fits on one page. Writing it now costs
nothing and lets the spend be approved or refused in one reading.

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

The plan total is the sum of those three. It is written in digits nowhere
in this note, and §6 says why.

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

## 6. What arms this note, and what is withheld

The launcher reads four things out of these bytes:

1. that the file names the executable entry point — §4 does;
2. a bare go word — absent, on purpose;
3. the plan total in digits, with or without a thousands comma — absent,
   on purpose;
4. the first and last seed, 654 and 665 — §3 has both.

Two of the four are missing, so the launcher refuses the file. That is the
whole safety of the held form: the note reads complete to a person and
fails closed to the machine. The §1 edit adds both at once, with the
approving words, in one commit.

This matters because the launcher's check on these bytes is the **only**
machine lock left after `--accept-charges`. See §11.

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
| this note, supplied as the launch note | refused — see §6 |

The artifact is
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
driver reads neither field. Both are prose today.

So the note bytes are the only machine lock after `--accept-charges`, and
that is why this note withholds two tokens instead of relying on the
manifest to hold the line. Recorded as entry 20 in
`docs/adaptation-refinement/relay/DEFECT-LEDGER.md`. The fix is small —
refuse a manifest whose `launch_authorized` is not true — but it lands as
its own change with its own test, not inside a launch note.

NEVER push this branch.
