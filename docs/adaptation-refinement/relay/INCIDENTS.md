# Incident log — live-run stops: detection, diagnosis, recovery

**Scope.** `DEFECT-LEDGER.md` records systematic harness defects and
their guards; `MISFIRE-LEDGER.md` records bad inputs caught before
spend. This file records full incidents on paid runs: what stopped
the run, how it was detected, how it was diagnosed, how it was
recovered, and which invariants held. The aim is a repeatable
operations pattern, not just a fix history.

## I1 — Main-block generation stop and triple-defect resume (14 Aug 2026)

Run: `adaptive-warrant-outcome-main-block-live-2026-08-13` (72
dialogues, GO note 097a at `58402361`).

### Timeline

- **~21:20–04:42** — generation. Three children failed technically
  and were set aside as the run went: dialogues 25 and 27 (seed 528,
  world 101, child incomplete) and dialogue 72 (turn 5: three tutor
  drafts rejected, then the deterministic fallback failed the final
  response check with a private-conclusion leak flag
  (`leak:private_final_conclusion`); 4 of 8 turns, seal incomplete,
  19 calls spent).
- **04:42** — the parent finished the frozen job list and stopped at
  its designed boundary for this case
  (`generation_quarantine_stop`): 69 admissible dialogues, 3
  quarantined, no freeze written, no reader call made.
- **Detection:** the stop state is a first-class checkpoint status,
  and the driver's monitor loop read it within seconds. No silence,
  no hang.
- **Diagnosis:** from artifacts only — parent checkpoint, child
  run-states, child traces (the 19 unbooked calls of dialogue 72
  were recovered from the child's own reserved-call events).
- **Recovery:** the driver moved the three failed child directories
  intact to `quarantine/`, then relaunched the exact authorized
  command plus `--resume` for the re-takes (083d/052a path).
- **04:45–05:07** — the resume path itself refused three times, each
  a zero-call fail-closed stop at a parent guard, each a real defect
  in the resume logic (ledger entries 17–19): a pre-freeze resume
  compared the preflight launch stamp against a freeze stamp that
  cannot exist yet; a resumed freeze restamped itself with the new
  head commit instead of the launch commit; a reader-phase resume
  regenerated pre-reader artifacts it must reuse. Each was repaired
  with a focused test and committed (`bd5ed29d`, `a22257a2`,
  `e1fbf394`) before relaunch.
- **05:07 on** — resume succeeded: re-takes completed (72 admitted
  dialogues), freeze written at exactly 576 cases carrying the
  original launch stamp, readers running.

### Invariants that held (checked by the reviewer mid-run)

- The frozen reader child was never edited: digest
  `c0a20130…` unchanged.
- No completed dialogue, quarantined artifact, or frozen case was
  edited; repairs touched only parent resume bookkeeping and tests.
- Every stop was fail-closed and zero-call: money stopped moving the
  moment anything was wrong.
- The freeze binds to the authorized launch commit, not the repair
  commits.

### The repeatable pattern

1. **Detect** by designed stop states in a checkpoint file, watched
   by a monitor loop — never by noticing silence.
2. **Diagnose** from persisted artifacts (checkpoints, child
   run-states, traces). Every call a child spends must be
   recoverable from its own events even when the parent lost it.
3. **Recover** by quarantine-intact plus re-take under the exact
   original command with `--resume`. Repair only transport and
   bookkeeping, each repair with a test, committed before relaunch.
   Never edit content, pins, or frozen artifacts mid-run.
4. **Disclose** the whole history in the run report; the reviewer
   rules on the class (technical vs substantive) after the fact.

### Closure (ruling 100, 14 Aug 2026)

Both open items closed. The quarantined children's 76 trace-only
calls (19 + 30 + 27) are folded into the authoritative run total of
3,081 (report 099). The fallback leak stop
(`leak:private_final_conclusion`, dialogue 25) happened once in 75
child takes and is ruled a watch item, not a defect entry. All four
in-run failures ruled technical class; run valid.

## I2 — Guarded main-block generation stop, and a resume blocked by a temp-file cleaner (15–16 Aug 2026)

Run: `guarded-learner-main-block-2026-08-15` (72 dialogues, guarded
learner, contract v3.3, GO note 118 at `9754dcfa`). The same stop as
I1, on the other learner.

### Timeline

- **13:00–20:45, 15 Aug** — generation. All 72 dialogues ran; none
  was skipped. Three failed technically and were set aside as the run
  went: dialogue 2 (gated, seed 654, world 101 — turn 6, three tutor
  drafts rejected, then the deterministic fallback failed its final
  response check with `leak:private_final_conclusion`; 5 of 8 turns,
  seal `incomplete`, 22 calls) and dialogues 34 and 54 (seeds 659 and
  662, both world 102 — every turn ran and the child sealed, but one
  turn's reading failed three times with `invalid_semantic_events`;
  27 calls each).
- **20:45** — the parent finished the frozen job list and stopped at
  its designed boundary (`generation_quarantine_stop`): 69 admissible,
  3 quarantined, no freeze written, **no reader call made**.
- **Detection:** the same first-class checkpoint status as I1, read by
  the monitor loop within seconds.
- **Diagnosis:** from artifacts only, no call made. The 76 calls the
  three children spent were recovered from their own reserved-call
  events, because a quarantined dialogue books zero at the parent.
  Parent-booked 1,794 plus 76 unbooked is a real generation spend of
  1,870. The recovery method was checked first against three sealed
  dialogues, where parent and child agree exactly (26/26, 27/27,
  28/28).
- **Archive:** the whole 1.7 GB run directory copied to the private
  repo and committed (`21dab05a`) before any recovery step. The
  117 MB checkpoint is stored gzipped — over GitHub's 100 MB per-file
  limit — and the gzip round-trips to the same sha256.
- **Resume note written held** (relay 119, `fc51318a`): section 1
  empty, two of the four launcher tokens withheld, so it reads
  complete to a person and the driver refuses it.
- **16 Aug** — the zero-call launch simulation, run against the held
  note, refused for a reason that was not the note: `required excluded
  artifact is missing`. Of the 22 burned corpora the prepared-identity
  guard reads, 19 sit under `/private/tmp`, and 3 of those 19 had gone;
  the directory skeletons remained. macOS empties that directory on a
  schedule, by access time, and reading a file there does not refresh
  its clock — every surviving file's access time still equals its
  write time, so the guard's own read at launch protected nothing.
  Recorded as defect ledger entry 21. The 19 survivors were copied to
  the private repo (`a83b5e06`), all hashing exactly as the main-block
  checkpoint recorded them at launch; the 3 lost files survive only as
  hashes and embedded fingerprints in that checkpoint. The other 16
  temp-path corpora were still there the next morning at 3.4 to 4.3
  days old, which is close enough to the sweep to be no protection.
- **Repair, 16 Aug** (`25c1863e`) — a restart now takes the exclusion
  record the checkpoint wrote at launch, and only for artifacts that
  are no longer on disk. A file still present is still read and must
  hash to the recorded value. A first launch carries no record, so it
  still refuses on any missing file. Because the record keeps digests
  and not the fingerprints inside each corpus, the guard refuses the
  transfer unless the candidates match the launch exactly — status,
  shape, persona, seeds, and the same fingerprint list in the same
  order. Nothing paid was touched.
- **16 Aug** — the resume was armed (relay 119 at `c6ad6fb5`), the three
  failed children were moved to `quarantine/<id>-attempt-1` intact, and
  the command ran. It refused again at zero calls, at the next guard
  along: `semantic brittleness preflight is stale or
  fingerprint-mismatched`. The cause is defect ledger 22, and it is
  entry 17's defect on the other runner: a resume before the freeze has
  no record of the launch commit, so it compares the launch preflight
  against head, and head had moved five commits — the burned-corpus
  repair and four notes. Exactly one binding field differed,
  `source_commit`; all 15 fingerprinted instrument files still hashed as
  at launch, and git confirmed none of them changed in those five
  commits.
- **Repair, 16 Aug** (`b89f3e29`) — the resume now reads the launch stamp
  off the run's own preflight and asks git to corroborate it: the commit
  must be an ancestor of head, and no fingerprinted instrument file may
  have moved between there and head. A stale preflight is still refused.
  A first launch still writes its preflight at head.

### Invariants that held

- No completed dialogue, quarantined artifact, or frozen pin was
  edited. Nothing was deleted; the surviving corpora were **copied**,
  not moved.
- Every stop was zero-call: the quarantine stop spent nothing on
  readers, and the resume blocker was found before the resume ran.
- The held note failed closed to the machine on its own bytes, so no
  approval could be inferred from the note existing.

### What this incident adds to the I1 pattern

I1's four steps — detect, diagnose, recover, disclose — all held. Three
steps are added to them, each learned here:

5. **Count the unbooked calls before writing the resume note.** A
   quarantined dialogue books zero at the parent while its child still
   spends. The checkpoint under-reports, and every counter written
   from it is wrong. Recover the number from the children, and check
   the method against sealed dialogues first.
6. **Run the launch simulation against the held note, before the
   approval.** It re-runs the whole guard chain at zero calls, so a
   blocker that has nothing to do with the note surfaces while there is
   still time to fix it. Write the simulation to a fresh artifact
   path — never overwrite the launch's own.
7. **Preserve every external precondition a guard reads.** A guard
   that reads absolute paths in a system temp directory can be broken
   by housekeeping with no relation to the study. Copy those files
   somewhere durable as soon as a run depends on them, not after.
