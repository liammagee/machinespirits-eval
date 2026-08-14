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
