# 041 — Reviewer direction: human ruling "drop the three duplicate cases and proceed" — drop-and-log freeze amendment, re-freeze seed 514 at 92 cases, readers, support gate, matrix-gate ruling

**Date:** 12 August 2026, ~21:05
**Authority:** the human typed the ruling directly in the reviewer
session at ~21:04: **"drop the three duplicate cases and proceed."**
This resolves the freeze-overlap hard stop of note 040 and selects the
drop-and-log variant (option 2 as amended in the 040 addendum). The
same line was independently relayed by the second session; the direct
typing is the authority. Direction 038's continuation policy stays in
force for everything this direction does not change.

**Lease:** `DRIVER-LEASE-2026-08-12-H`. Report to
`042-codex-report.md`.

## What the ruling means (registered interpretation)

The exclusion rule is amended PROSPECTIVELY, content-blind, disclosed:

- At freeze time, any candidate case whose fingerprint matches an
  excluded corpus is DROPPED from the reader packet and LOGGED in the
  freeze manifest — fingerprint, matched corpus id(s), world, learner
  profile, condition, decision turn. Dropped cases are never sent to
  any reader and stay unlicensed forever.
- The freeze no longer fails closed on overlap. It still fails closed
  on everything else it failed closed on before (schema, catalogue,
  provenance, size).
- The amendment applies to the seed-514 re-freeze and to every later
  seed. It is an instrument amendment under human authority and is
  disclosed in every report and in the gate ruling.
- The human's ruling supersedes the provisional burn of the seed-514
  corpus FOR READER USE: the quarantined corpus is the freeze input.
  The three overlapping cases (1 Larkspur-fridge + 2 Foxtrot-jukebox,
  all low-agency turn-1) are the expected drops.

Why this is sound (from note 040's addendum, for the record): the
case fingerprint hashes only the pre-decision transcript, the current
learner turn, and the record state. At a turn-1 decision the
transcript is empty and the record is zero-start, so the hash reduces
to the persona's formulaic opener plus the world — collisions at
turn 1 are forced and carry no run-specific content. From turn 2 the
hash includes model-generated tutor text and diverges. Dropping the
collided cases loses three low-agency turn-1 cells and nothing else;
the loss is logged and quoted in the gate ruling.

## Ordered actions

### A1 — Amend the freeze (zero-call, committed before any reader call)

1. Change the annotation freeze so an overlap with an excluded corpus
   drops-and-logs instead of failing the freeze. The drop log lives in
   the freeze manifest under a named key (e.g. `dropped_overlap_cases`)
   with the fields above.
2. Guard tests (all zero-call, committed with the change):
   - a synthetic corpus with exactly one planted overlap freezes to
     N−1 cases with one logged drop carrying the matched corpus id;
   - a zero-overlap corpus freezes unchanged with an EMPTY drop log
     present in the manifest;
   - a dropped case's fingerprint appears nowhere in the blinded
     sample or the reader packet;
   - the freeze still fails closed on a schema/catalogue defect.
3. Run the focused suites and the standard zero-call chain pieces that
   touch the freeze path. Do NOT re-run the matrix, the replay, or the
   preflight beyond what the chain requires — the run data is
   untouched; only the freeze reducer changed.

### A2 — Re-freeze the seed-514 packet (zero-call)

4. Run the amended freeze on the quarantined seed-514 corpus
   (`quarantine-r39-repaired-reducer-overlap/` under the live root).
   Expected: 92 cases frozen, 3 dropped-and-logged (the fridge and
   both foxtrot low-agency turn-1 cases). If the drop count or the
   dropped identities differ from expectation, STOP and report — that
   is a provenance question, not a freeze mechanic.
5. Record digests: frozen packet, blinded sample, private key,
   manifest. The reader schema must remain byte-identical to the
   registered digest (`51107d43…`); any schema drift = stop.

### A3 — Readers, support gate, matrix-gate ruling (paid)

6. Run the semantic readers on the frozen 92-case packet under the
   registered reader protocol. Budget: the reader stage as previously
   projected; every `model_call_budget_reserved` event counts as one
   attempt (report-031 convention). Running total starts at
   **3,146/8,000**.
7. Score the support gate against the registered criterion.
8. Write report 042 with: the amendment disclosure, the drop log
   quoted in full, calls spent and the running total, reader results,
   the support-gate arithmetic, and the matrix-gate ruling input —
   quoting BOTH the checkpoint coverage rate (139/144 = 96.53%) AND
   the final descriptive rate (187/192 = 97.40%), per the standing
   rule.
9. The reviewer rules on the matrix gate from report 042. Gate PASS =
   proceed under note 023's chain (prereg freeze from
   `2026-08-12_outcome-study-design-draft.md`, then pilot + main
   block — the continue-until-done instruction covers proceeding).
   Gate FAIL = stop for review under the 004 options.

## Unchanged

- Never patch a live run; never waive a failed gate post hoc; burned
  seeds never pooled. The three dropped cases join the excluded set.
- Human hard stops per direction 038: further instrument amendments,
  contamination/provenance anomalies beyond the logged drops, the
  8,000-call ceiling, coverage losses not dominated by a nameable
  defect.
- Seed 515 stays minted and unspent; nothing here authorizes it.
- Commit `--no-verify` with the `Workplan-item: N/A` trailer and the
  Co-Authored-By convention. NEVER push.
