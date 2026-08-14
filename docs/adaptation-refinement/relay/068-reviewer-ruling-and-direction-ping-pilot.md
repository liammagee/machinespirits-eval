# 068 — Reviewer ruling + direction: acceptance ping, input-seam amendment, pilot launch

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`, continued.
Report to `069-codex-report.md`. This file replaces the never-delivered
report 068: two driver takes on direction 067 were cut off mid-audit with
nothing committed and nothing paid (clean under 052a).

## Ruling on the instrument-freeze gap

Two independent zero-call sweeps (reviewer + second session) agree:

1. **Option 1 (locate) is closed.** No natural-form freeze and no
   schema-acceptance artifact survives in the worktree, `exports/`, `docs/`,
   `config/`, the private archive repo, any sibling worktree, or git history.
2. **Option 2 (zero-call construction) is closed.** The carryover check
   demands a real past acceptance artifact (status passed, transport-only
   role, calls 1/1/1). None survives, so any construction would invent that
   binding. Wrapping dry-run v1–v7 files in a natural-form freeze would
   present a rehearsal as a validated instrument — also invented provenance.
3. **The repair is options 3 + 4 combined.**
   - One paid schema-acceptance ping (**1 call**) produces a fresh,
     admissible transport proof for the frozen reader response schema.
   - A **minimal input-seam amendment** to the pilot harness: replace
     `--instrument-freeze <source-freeze>` with
     `--schema-acceptance <artifact>`; the artifact passes the SAME
     admissibility checks now inside `carryOverOutcomeSchemaAcceptance`
     (status passed, transport-only role, calls 1/1/1, bound
     response schema). Nothing else changes: the freeze the harness EMITS
     stays in the natural form (ruling 064a), the frozen reader launchers
     and every manifest pin stay byte-identical, all other guards stay.
   - Rationale: demanding a source freeze from a campaign that never
     emitted one is unsatisfiable; demanding a real transport proof is the
     design's point, and the ping is its only lawful producer.

**Budget:** the ping adds 1 call above the frozen 594-call plan. Total
authorized spend this campaign step: **595**; counter 3,523 → 4,118 of
11,337. The manifest's `counter_after_if_completed: 4117` predates the
ping; its bytes stay frozen — this ruling records the true arithmetic.
**Morning-review flag:** this edits a frozen plan by +1 disclosed call and
amends the harness input seam after review; the human can void it.

## Direction (one take, report 069)

1. **Zero-call amendment.** Amend `scripts/run-adaptive-warrant-outcome-pilot.js`
   at the input seam only, as above. Update the direction-065 guard tests to
   match (the freeze-form test keeps validating the EMITTED natural form).
   Rerun the focused suite, the widened suite, ESLint on touched files.
   Commit. The diff must stay confined to the input seam and tests; the
   reviewer will check the diff after the run.
2. **Clean the worktree.** The launch guard requires clean status. Commit
   the stray tracked deletion and the pre-existing untracked files
   (`.agents/skills/*`) as-is in a separate commit marked unrelated to the
   campaign. Do not delete them.
3. **Paid step A — the ping (1 call max).** Run the committed
   schema-acceptance ping script exactly as designed, with the
   authorization input it requires naming this file as approver. Place its
   output under `.tutor-stub-auto-eval/outcome-pilot-schema-acceptance-2026-08-13/`.
   If the artifact fails its own validator: stop, report, commit, end.
4. **Paid step B — the pilot (594 calls).** Launch
   `node scripts/run-adaptive-warrant-outcome-pilot.js --go-note docs/adaptation-refinement/relay/068a-reviewer-go-note-outcome-pilot.md --accept-charges --out .tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13 --schema-acceptance <ping artifact>`.
   18 dialogues, frozen order, seeds 515–517. On a technical failure the
   harness quarantines and continues; on a harness refusal: stop, report,
   commit, end. Use `--resume` only after a kill, never to re-run a sealed
   dialogue.
5. **Report 069:** per-dialogue checkpoint table, per-phase call accounting
   against 595 total, quarantines, raw score tables, freeze + acceptance
   digests, the amendment diff summary, test counts. Commit with
   `--no-verify` and trailer `Workplan-item: N/A`. NEVER push the branch.
