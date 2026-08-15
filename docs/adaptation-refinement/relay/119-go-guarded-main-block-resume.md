# 119 — resume the guarded main block after the quarantine stop

Date: 2026-08-16
Workplan item: guarded-learner-outcome-study
Follows: relay 118 (the launch note), relay 114 (the pilot's resume, used as
the model), and incident I1 in `INCIDENTS.md` (the same stop on the passive
block)
Status: **HELD.** Section 1 is empty and two of the four launcher tokens are
withheld (§10). The note reads complete to a person and fails closed to the
machine, so it can be read before it can be run.

## 1. The approval

_Empty until the human approves. The reply goes here verbatim and complete._

Relay 118 approved the main block and stopped there. That approval does not
reach a resume. This note carries its own.

## 2. What happened

Generation ran the whole frozen job list: all 72 dialogues, none skipped.
69 sealed. Three did not. The driver then stopped itself at its designed
boundary for this case, wrote `generation_quarantine_stop`, and exited with
code 0 at 20:45 on 15 August. **No reader call was made.** Both reader
channels stand at zero.

Per condition: bare 24 sealed and none set aside; gated 22 sealed and 2 set
aside; standing permission 23 sealed and 1 set aside.

This is the second time this stop has fired on a 72-dialogue block. The
first was incident I1 on the passive-learner block, 14 August: same status,
same count of three, and ruling 100 found all four of its in-run failures
technical and the run valid.

## 3. The three, diagnosed from artifacts only

No call was made to diagnose. Everything below comes from the parent
checkpoint and the children's own traces.

**Dialogue 2** — `outcome-pilot-02-world_101_kestrel_signal_lamp-s654-gated`,
gated, seed 654, world 101. Turn 6: three tutor drafts were rejected, then
the deterministic fallback failed its final response check with a
private-conclusion leak flag (`leak:private_final_conclusion`), on the fact
`wipedCore(signal lamp, kite)`. The child stopped at 5 of 8 turns and sealed
`incomplete`. 22 calls.

This is the same fault as dialogue 25 of the passive block. Ruling 100 saw
it once in 75 child takes and called it a watch item, not a defect. It has
now happened once more, in 75 further takes. The rate has not moved.

**Dialogue 34** — `outcome-pilot-34-world_102_marigold_archive_box-s659-standing_permission`,
standing permission, seed 659, world 102. All 8 turns ran and the child
sealed with integrity checked. Turn 8's reading failed three times, each
with the same code (`invalid_semantic_events`). Turns 1 to 7 read on the
first attempt. 27 calls.

**Dialogue 54** — `outcome-pilot-54-world_102_marigold_archive_box-s662-gated`,
gated, seed 662, world 102. Same fault at turn 4: three failures, same code,
every other turn read first time. 27 calls.

Dialogues 34 and 54 repeat the pilot's one quarantine exactly. Relay 114 §2
described it: the reader quotes a span that is not a literal piece of the
transcript, so the strict check refuses it. It is a reader failure. No
defensive act is involved, and the v3.3 contract is not at fault.

**All three are technical class on this evidence.** The reviewer rules after
the fact, not this note.

**One pattern for the reviewer's eye.** Both reader failures sit in world
102, the marigold archive box, but in different conditions. That points at
the world, not at the gate. Dialogue 2 is a different fault in the other
world. Nothing here is a condition effect.

## 4. Real spend, recovered from the children

The checkpoint books 1,794 generation calls. That is short, because a
quarantined dialogue records zero reserved calls at the parent while its
child still spent them. Incident I1 met the same gap and recovered the
number from each child's own reserved-call events. Done again here:

| source | calls |
|---|---:|
| booked by the parent, 69 dialogues | 1,794 |
| dialogue 2, unbooked | 22 |
| dialogue 34, unbooked | 27 |
| dialogue 54, unbooked | 27 |
| **real generation spend** | **1,870** |

The recovery method was checked before it was trusted: on three sealed
dialogues the parent's booked count and the child's own count agree exactly
(26 and 26, 27 and 27, 28 and 28).

## 5. Scope, and why this needs no new money

The registered budget is the plan relay 117 §5 registered and relay 118 §5
carried — two thousand one hundred and sixty generation calls, one thousand
one hundred and fifty-two on each reader channel, four thousand four hundred
and sixty-four in all. This note spends inside that envelope. It does not
raise it. The driver refuses any call past the plan total, so the ceiling
holds itself.

| item | calls |
|---|---:|
| booked so far | 1,794 |
| three re-takes, at the 30-per-dialogue cap | up to 90 |
| presence readers | 1,152 |
| decision readers | 1,152 |
| **booked total after the resume** | **up to 4,188** |

Generation came in under its own cap — about 26 calls a dialogue against 30
— so the room for the re-takes was already there. 2,670 calls remain unspent
under the plan, and the resume needs about 2,384 of them.

## 6. Zero-call preparation, to be done before the command

Not yet done. It must happen before the resume runs, and it costs nothing.

The child runner writes into a fresh sub-directory when its trace directory
is not empty, and the parent's evidence collector reads only the top level
of the dialogue directory. Left in place, each re-take would write one level
down, the collector would re-read the old failed seal, and about 80 calls
would buy a second quarantine. Relay 114 §4 hit this on the pilot; incident
I1 moved the children for the same reason.

So each failed attempt gets moved aside, inside the run directory, and
nothing is deleted or edited:

    was: dialogues/<id>
    now: quarantine/<id>-attempt-1

for the three ids named in §3. The whole run directory is already archived
to the private repo and committed (`21dab05a`), so the first attempts
survive off this branch whatever happens next.

The checkpoint keeps the quarantined rows. On a successful re-take it will
hold two rows for each of the three — one quarantined, one complete — and
the reader phases read the complete ones. The record of the loss is not
overwritten.

**A second preparation, found at zero calls and not yet done.** The launch
simulation was run against this note while held, to prove the driver refuses
it. The driver did refuse — but on a different sentence than expected:

    required excluded artifact is missing:
    /private/tmp/adaptive-warrant-mechanism-live-5ddf1d28/annotation-sample.blinded.json

The prepared-identity guard reads 22 already-annotated corpora and refuses
any run whose prepared identities overlap them. Sixteen of the 22 live only
in `/private/tmp`, and macOS emptied that directory at midnight on 16
August. Three are gone; the directory skeletons remain. The guard runs at
every launch and at every resume, so **the command in §7 cannot run today**,
for a reason with no relation to this study.

The 19 survivors are now copied to the private repo and committed
(`a83b5e06`), each hashing exactly as the checkpoint recorded it when the
guard read it at launch. The three lost files survive only as their sha256
and embedded fingerprints inside the run checkpoint.

This is defect ledger entry 21 and incident I2. It needs a repair before the
resume: on a restart the guard should take the exclusion record the
checkpoint already carries, rather than re-read files a housekeeping job can
delete. That is bookkeeping, not content — the same principle the driver
already states for run size, that the checkpoint is the authority on a
restarted run. Incident I1 repaired three resume-path defects of this class
before its own relaunch, each with a focused test, each committed first.

**The repair is not written yet and is not authorised by this note.** It is
a zero-call change and it must land, with its test, before the command runs.

## 7. The command

Copied from relay 118 §4, with the one flag the driver's own usage output
names for a restart (`[--resume]`), and with the note moved to this one:

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/119-go-guarded-main-block-resume.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json \
  --shape main-block \
  --learner-profile overconfident \
  --resume
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`, which must be clean and committed. The driver
re-checks every pin at launch, so if anything has moved since relay 118 the
run refuses to start.

On resume the driver skips the 69 sealed dialogues, re-runs the three, and
only then builds the case corpus and spends the reader calls. Seeds 654 to
665 stay as they were; the manifest is unchanged.

## 8. The cost of a re-take, stated before it is paid

This is a second draw at three cells. The other 69 cells had one draw each.
Seed, world, condition and version of the tutor are fixed, so each scenario
reproduces; the tutor and learner replies are a fresh sample.

**This must be named in the gate reading.** If any of the three sits at the
edge of its group, the reading says so and says it was a re-take. Relay 118
§8 allows one retry per failed call and one re-take per quarantined reading.
A second failure at any of these three cells is reported, not re-run.

## 9. Stop rules

Carried from relay 118 §8, unchanged, plus one:

- The **primary endpoint is measured, never gated.** A null is a finding.
- A defensive turn read as a low-agency deferral is **terminal**. Stop and
  report.
- Persona collapse — the guarded learner stops over-claiming — stops the run.
- A technical failure quarantines and gets reported. **Never patch a live
  run.** `--resume` is for a clean restart, not for a fix.
- One retry per failed call. One re-take per quarantined reading.
- The budget is not raised mid-run.
- A substantive fail stays terminal.
- **New: one re-take only.** If any of the three quarantines again, stop and
  report. Do not spend a third attempt, and do not lower the driver's count
  of 72 to read the gate on 69 or 71.

## 10. What arms this note

The launcher reads four things out of these bytes: that the file names the
executable entry point (§7 does); a bare go word; the plan total in digits;
and the first and last seed, 654 and 665 (§7 has both).

Two are here. Two are withheld on purpose while this note is held — the go
word and the plan total in digits. Filling section 1 puts them in, and that
edit changes nothing else: not the design, not the command, not the seeds,
not the budget, not the stop rules.

The check on these bytes is the only machine lock left after
`--accept-charges`. The sealed manifest's `launch_authorized` field is still
prose the driver never reads — defect ledger entry 20, fix still open,
and it does not land while this run is live.

## 11. Counter

- before the run: **11,559 / 19,337** (relay 118 §5)
- generation, counted from the children rather than the checkpoint:
  **1,870** → **13,429 / 19,337**
- this note: up to **2,670** → at most **16,099 / 19,337**, leaving
  **3,238**

Relay 118 projected 16,023 on a full spend. The real ceiling is a little
higher because the three quarantined children spent 76 calls the parent
never booked.

## 12. After the run

Archive first: `npm run archive:runs` with the run directory named, then
commit in the private repo. The artifacts as they stand are already
committed at `21dab05a`; the resume adds to them.

Then, in the order relay 118 §10 sets: assembly, the acceptance audit over
every reader response, the assembly gate of relay 117 §6, the two scorers at
`--shape main-block`, then the decision-correctness split per relay 117 OD3.
Interpretation stays with the reviewer.

The whole failure history — the three of 15 August and anything the resume
adds — is disclosed in the run report. The reviewer rules on the class.

NEVER push this branch.
