# Misfire ledger — launches and registrations that stopped before spend

**Scope.** `DEFECT-LEDGER.md` records systematic harness defects and
their regression guards. This file records the other class: process
misfires — a registration, GO note, or pin that was wrong when cut,
caught by a fail-closed gate before (or between) paid calls. The
harness worked; the input to it was bad. Each entry names the cause
and the rule now in force so the same slip does not repeat.

**Why keep it.** The fail-closed pattern only pays off if the causes
of the stops are read back. Three of the four entries below are
reviewer errors; the gates turned each into a zero-cost correction
instead of a contaminated or wasted run.

## Entries

### M1 — Registration 096 claimed seeds 518–529 were fresh; they were not

- **When:** 13 Aug 2026, first main-block build pass (report 098 §1,
  `46847df9`).
- **What fired:** the driver's mandatory seed-freshness gate found
  seeds 518 and 519 burned by design smokes A and B — smokes cited in
  registration 079 itself, world 102, eight turns, the same
  permission-seeking persona.
- **Cause:** the reviewer wrote "fresh" into a registration without
  running a search. A factual claim was registered on memory alone.
- **Cost:** zero calls, zero changes. The driver stopped and reported.
- **Fix:** amendment 096a (`30227122`) — seeds re-registered as
  524–535 after the reviewer enumerated every in-use seed number
  500–699 across the repo, run directories, and the private archive.
- **Rule now in force:** a registration may not assert a freshness or
  uniqueness fact without the reviewer's own search run before
  commit, and the search terms belong in the registration text. The
  driver's independent re-check stays mandatory.

### M2 — GO note 097a named an incomplete launch command

- **When:** 13 Aug 2026, first main-block launch attempt (report 099
  §1, `71a9cd9f`).
- **What fired:** the launcher refused
  (`--go-note must be docs/adaptation-refinement/relay/097a-…`);
  it requires four flags (`--go-note`, `--accept-charges`, `--out`,
  `--instrument-freeze`) and the note gave one.
- **Cause:** the reviewer wrote the command from memory instead of
  copying the launcher's printed usage line — which the reviewer had
  read that same day — or the prior GO note of the same family
  (083a), which shows the full four-flag form.
- **Cost:** zero calls. No directory, checkpoint, or artifact was
  created. The driver correctly declined to invent the missing
  output path and stopped.
- **Fix:** 097a corrected in place (`58402361`) with the complete
  verbatim command: fresh output directory
  `.tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13`
  and the unchanged r52 instrument freeze (digest re-checked
  `6a64b31f…`). Second launch succeeded.
- **Rule now in force:** a GO note's command is copied, never
  composed. Source: the launcher's own usage output, cross-checked
  against the most recent GO note for the same launcher family. If
  the launcher takes an output path, the note names it and the
  reviewer confirms no directory of that name exists.

### M3 — Pilot v4 second launch refused on a stale fingerprint pin

- **When:** 13 Aug 2026, pilot v4 (note 083b).
- **What fired:** the launch guard computed the extraction-schema
  fingerprint from current source bytes; the manifest pin still held
  the pre-change digest.
- **Cause:** a registered sensor change (`46bfbdd9`) edited the
  fingerprinted file, and the pin was not re-computed before launch.
  Bookkeeping lag, not a wrong registration.
- **Cost:** zero calls.
- **Fix:** re-pin recorded in 083b; relaunch succeeded.
- **Rule now in force:** after any registered change to a
  fingerprinted source file, re-compute every dependent pin before
  cutting the GO note, and list the moved digests in the note.

### M4 — Duplicate-content guard assumed distinct cases never share bytes

- **When:** 13 Aug 2026, pilot v4 between channels (ruling 086, on
  report 085).
- **What fired:** the case-uniqueness guard stopped the run at 144
  built cases / 139 unique fingerprints, before any reader call.
- **Cause:** the guard's assumption was false in a legitimate corner:
  scripted turn-1 openings plus a deterministic tutor first reply
  are byte-identical across seeds within a condition. A guard
  assumption about data shape was treated as fact. Reviewer-verified
  at the source transcripts: nothing was lost or flattened.
- **Cost:** zero reader calls; generation spend retained and the run
  resumed under ruling 086 (technical class).
- **Rule now in force:** guards that encode assumptions about data
  shape state them, and a trip is adjudicated against the sources
  before any re-take — a tripped guard is a question, not a verdict.

## Reading

Common thread in M1–M3: the fail-closed gates are doing exactly
their job, and every stop so far has been input error, not harness
error. The cheap defense is at authoring time: copy, don't compose;
search, don't recall; re-pin after every registered edit.
