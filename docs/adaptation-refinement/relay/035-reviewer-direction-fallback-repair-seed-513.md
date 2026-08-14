# 035 — Direction: reviewer killed seed 512 live; defects #9 and #10; fallback-pass closure; seed 513 licensed

**Date:** 12 August 2026
**Authority:** unattended note 023 plus the human's standing grants
(proceed as far as warranted; do not stop on slender margins without a
written ruling; be pragmatic as well as disciplined). This direction
records a reviewer live-kill and licenses the next seed.
**Driver lease:** `DRIVER-LEASE-2026-08-12-F` (lease E retired; its
driver was killed with the run and never wrote a report — the next
codex report is `036-codex-report.md`).

## What happened (reviewer record; the driver was dead before reporting)

Direction 034's chain executed cleanly: repairs R1/R2 committed at
`1555a9bd`, guards green, both preserved failed-draw directives
compiled complete, the seed-511 partial packet froze, the seed-510
replay returned the identical 5/185 = 2.70%, preflight passed, and the
seed-512 matrix launched at 18:55 from the clean commit.

At the 19:07 watch tick, two children in the gate-active condition had
died on a NEW deterministic fatal, one layer downstream of defect #7:
the turn-progression contract now COMPILES (the #7 repair worked), the
tutor drafts, but the final response check rejects every candidate
with `public_obligation_unresolved`, and after three drafts the
deterministic fallback ALSO fails — so the child exits. Dead children:
goalpost_shifter/jukebox (turn 3) and answer_seeking/fridge. Different
learners than seed 511, same family: the gate's generic obligations
cannot be discharged.

With two children dead, the 24-dialogue matrix could not complete —
seed 512 was already burned. Every further call would have been spent
on a burned matrix, so the reviewer killed the driver, the study
runner, and all seed-512 children at ~19:10. Stopping a live run is
not patching it; no artifact was altered. The partial run dir is
retained at `/private/tmp/adaptive-warrant-v3-matrix-live-1555a9bd-r34-s512`
(14 of 24 children started; 8 rows sealed at kill time).

## The findings (reviewer-verified from the retained traces, zero calls)

**Defect #9 — the deterministic fallback is target-blind.** The
checker accepts two outcomes: answer the public request, or defer with
a named limit and a concrete next condition. The deferral test demands
the unavailability claim in a clause that NAMES the target. The
fallback's fixed template — "The public result is not public yet; once
a matching public record is available, I can answer it." — names no
target terms: trace shows `target_coverage: {matched: [], count: 0}`.
It also repeats its own sentence (repetition guard fired at similarity
1) and trips the generic-uptake and tactic-visibility checks. The
harness's guaranteed last resort can never pass the harness's own
final check. Any intervening child whose three drafts fail dies.

**Defect #10 — the component matcher wants the type identifier as
prose.** A request typed `other` or `record_text` builds a required
component whose match term is the literal token. The matcher has real
branches for time, date, name, weight, and match status only; all
other types fall to a regex demanding the raw identifier
(`\bother\b`) in the tutor's sentence. An answer can never score
`satisfied` for such requests. The dead answer_seeking child carried
`requested_value_types: ["other"]`.

Classification: both are harness plumbing downstream of the registered
instrument, defect-ledger class (entries #9 and #10). The amendment
chain does NOT grow — still v3.0 → v3.1 → v3.2.

## Pre-declared repairs

**R1 (defect #9).** The terminal fallback composes its deferral FROM
the obligation target: the unavailability clause names the target's
subject/progression terms; a concrete next condition follows; no
question mark; no repeated sentence. The terminal fallback must pass
the exact final response check by construction. Precedence decision
(pre-declared so the driver does not stall): on the TERMINAL fallback
only, style-class issues (generic uptake, tactic visibility) are
advisory, not blocking — leak, provenance, source-alignment,
progression, and repetition checks remain blocking, and the repetition
issue is fixed in the template, not waived.

**R2 (defect #10).** Non-special value types (`other`, `record_text`,
and any future unlisted type) are scored by the target-scoped
answer-bearing relation, not by the literal identifier token. The five
typed branches (time, date, name, weight, match status) are unchanged.

## The new guard class: fallback-pass closure

This is the third matrix killed by one obligation layer failing after
the layer above it was repaired. The guard that closes the whole
class: **for every obligation target reachable from the retained
corpora, the compiled directive PLUS the deterministic fallback must
pass the complete final response check** — compile, resolution, and
all blocking guards, end to end, zero calls. Corpora: all learner
turns in the 22 sealed seed-511 dialogues, both preserved seed-511
failed draws, and the seed-512 dead children's turns. If the fallback
always passes, no child can die of guard exhaustion, whatever the
model does.

## Licensing chain for seed 513 (zero-call, in order)

1. Focused suites plus the #9/#10 guards: green.
2. Fallback-pass closure over the retained corpora above: green.
3. Seed-510 replay at the repair commit: identical 5/185 = 2.70%
   (semantic validator untouched).
4. Preflight `instrument_ready`, byte parity, schema carryover if the
   digest is unchanged.
5. Launch the seed-513 matrix: same frozen design, 24 dialogues,
   1,536-call ceiling, 15% coverage self-halt with the 10-turn floor,
   checkpoint semantics unchanged.

## Seeds and the reserve boundary

Seed 512 is burned (retained, unscored, never pooled). **Seed 513 is
the fresh primary. Seed 514 is the LAST reserve and is NOT spendable
by the reviewer:** if seed 513 fails for ANY new reason — coverage,
child death, packet, anything — report and hard-stop for the human.
Quote the checkpoint rate AND the final descriptive rate in every halt
report, and mark killed or incomplete children explicitly.

## Budget

Reviewer count at kill time: 293 completed model calls in the seed-512
job dirs. The driver must recount exactly from the run events
(reservations and errors included, per the report-031 convention) and
state the running total; the reviewer's arithmetic is 2,242 + ~293 ≈
2,535/4,000, with ~600 for the seed-513 matrix, projecting ≈
3,135/4,000.

## Report

Write `relay/036-codex-report.md`. Commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention. Do not
push.
