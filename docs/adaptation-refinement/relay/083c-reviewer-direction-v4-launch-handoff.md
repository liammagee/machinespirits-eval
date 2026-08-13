# 083c — Reviewer direction: v4 launch handoff to the driver

**Date:** 13 August 2026. Authority: GO note 083a (as amended at this
commit), registration 079, note 083b (fingerprint re-pin,
`148621f3`), and the human instruction of 13 August 2026: "Go,
approve if needed. Do everything unattended, only report back
completion or failure."

The driver now owns the launch, the watch, and the run report. The
reviewer returns only to read results.

## Tasks

1. **Preconditions.** Confirm the working tree is clean and GO note
   083a is byte-identical to its committed version at HEAD. If not,
   stop and write a report — do not launch.

2. **Launch.** Run the verbatim command from GO note 083a from the
   worktree root:

   ```
   node scripts/run-adaptive-warrant-outcome-pilot.js \
     --go-note docs/adaptation-refinement/relay/083a-reviewer-go-note-outcome-pilot-v4.md \
     --accept-charges \
     --out .tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13 \
     --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
   ```

   If any launch guard refuses: stop, write report 084 with the exact
   refusal text, commit, end. Amend nothing. Zero-call refusals are
   not failures under ruling 052a — they are stops.

3. **Watch.** While the run is live, append a timestamped line to
   `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13/progress.md`
   after each dialogue seals (order number, condition, world, seed,
   attempt count so far from the checkpoint). Do not patch a live
   run. If the process dies or a technical stop fires, follow ruling
   052a: quarantine the output directory as-is, disclose in the
   report, do not re-take without a new reviewer GO.

4. **Report 084** (`docs/adaptation-refinement/relay/084-codex-report.md`),
   after the run ends either way. It must carry:
   - final status from the checkpoint (complete / quarantine stop /
     guard refusal), with the exact guard outputs;
   - the counter maths: reserved-call events consumed, counter before
     (4,198) and after, against the 19,337 ceiling;
   - the 144-case fingerprint guard and coverage guard results;
   - prediction checks P1 (gated never-breaker dialogues arm at
     t6/t3/t5/t5 pattern per registration 079) and P2 (self-breakers
     never arm) — report observed values only, no interpretation;
   - back-to-back challenge turns if any (expected under R1,
     report-only);
   - the recorded limitation from note 083b (presence readers under
     extraction schema v3.2, instrument confirmed under prior bytes).

5. **Commit** report 084 and the progress file with the standard
   recipe (`git -c core.hooksPath=/dev/null commit --no-verify
   --trailer "Workplan-item: N/A"`, Co-Authored-By trailer). NEVER
   push the branch. Never run `git push` in any form — the push hook
   launches model-backed evaluation.

6. **Interpretation is reserved to the reviewer.** Report facts and
   numbers only.

The 72-dialogue main block stays UNAUTHORIZED regardless of the pilot
outcome; it needs its own GO note after the pilot ruling.
