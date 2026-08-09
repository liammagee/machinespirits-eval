---
id: register-mock-praise-probe
title: Does asking for the mock-compliment directly raise the manner reading?
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: The plan is frozen and its SHA printed by --dry-run before the
  first paid call. The report is zero-call and fails closed on the registered
  measures, one of which reads the tutor stack off the dialogue traces rather
  than off the model columns. The manipulation check is answered before any
  verdict, and the plan states before the run that the primary cannot separate
  at this size.
claim_status: exploratory
depends_on:
  - register-strong-stack-replication
links:
  notes:
    - notes/2026-08-09-register-mock-praise-preregistration.md
  services:
    - services/registerMockPraiseProbe.js
  scripts:
    - scripts/run-register-mock-praise-probe.js
  tests:
    - tests/registerMockPraiseProbe.test.js
tags:
  - register
  - manner
  - id-director
  - provenance
---

The strong-writer run ([[register-strong-stack-replication]],
`eval-2026-08-08-6021754f`, paper v3.0.281) went 15/15 on the cue and 11/15 on
the reading. Read afterwards, the four flat turns share one shape: they used
one of the register's two non-praise cues and taught straight, while ten of
the eleven edged turns grant the learner's move a compliment and take it back
in the same breath (p ≈ 0.033, post hoc). This run asks for that device
outright and measures whether the reading moves — and what it costs.

## The manipulation

A new register, `sarcastic_mock_praise`: the contract asks for praise granted
and then withdrawn, names diagnosis-without-merit as noncompliance, and drops
the two escape-hatch cues from the cue family. No new delivery code — the
manner block composes from the registry, so the treatment cell
(`cell_203_..._sarcastic_mock_praise_...`) is cell 197's block with one factor
changed. Contract and cue list move together, deliberately as a package; a
positive result belongs to the package.

## The design

Two arms in ONE batch on one stack, so no run boundary sits inside the
contrast. Control = cell 197 (plain `sarcastic`). Treatment = cell 203. The
same five resistance targets, 3 repeats each: 30 rows, 15 per arm.
`codex.gpt-5.5` on ego and id, same judges, same pinned reader on the
unchanged question `manner-presence/1.0` — no version bump, so readings pool
across arms and against the stored run.

## Registered measures

The report is zero-call and fails closed on all of them.

1. **Provenance** — every tutor seat call went to `codex.gpt-5.5`, read off
   the traces.
2. **Manipulation check** — praise-in-words per arm, one pinned 14-token
   detector for both arms. If the treatment does not deliver more praise, the
   primary is void whatever it shows; `manipulationHeld` is reported first.
3. **Primary** — read-as-edged, treatment vs control, within batch. The
   verdict keys to this and only this.
4. **Secondary** — treatment vs the stored 11/15, cross-run, labelled as such.
5. **Device test** — praise-present vs read-as-edged pooled over both arms:
   the post-hoc 2×2, now prospective, with real variance on the no-praise side
   because the control is not asked.
6. **Tutor cost** — v2.2 means per arm and their delta.

Cue-pass counts are NOT comparable across arms — the treatment gate's cue
family differs by design — so the report never differences them.

## What it can and cannot show

Stated before the run: against a rate fixed at 11/15, a 15-row arm cannot
separate at p < 0.05 **even at a perfect 15/15** (two-sided Fisher p =
0.0996). The primary is a screen whose likely honest answer is
`NO_SEPARATION_AT_THIS_SIZE`; the run's value rests on the manipulation check
and the device test, which can move decisively at this size.

And the reader's own gloss names the device — its first example of an edged
reply is one that "praises what it is faulting". A treatment rise therefore
shows the reader can be satisfied on request, locating the 11/15 shortfall in
the ask rather than the writer's capacity. It is not evidence the turns teach
better; the tutor score is carried alongside for exactly that reason.

## Outcome

Run `eval-2026-08-09-bb402d97`, 2026-08-09, operator-authorized on clean
commit `6e79d4e5`. 30/30 rows, 30/30 tutor scores, 50/50 register slices,
30/30 read with none unread; 270/270 tutor-seat calls on `codex/gpt-5.5`.
Report COMPLETE. Paper v3.0.282.

| measure | plain (control) | asks (treatment) |
|---|---|---|
| cue compliance (own gate; not comparable across arms) | 15/15 | 15/15 |
| mock-praise in the adopting turn | 14/15 | 15/15 |
| read as edged | 14/15 | 15/15 |
| tutor v2.2 mean | 66.7 | 66.3 |

**The question dissolved: the control moved.** The plain arm, re-drawn one
day after the stored run, reads 14/15 edged and grants praise 14/15
unprompted — against its own 11/15 and 11/15 the day before. So the stored
shortfall was between-draw noise, not a floor. Within-batch primary 15/15 vs
14/15 (p = 1.0): registered verdict **no separation at this size**. Cross-run
secondary 15/15 vs 11/15: p = 0.0996, exactly as computed before the run. The
manipulation check "held" (15 > 14) with no headroom to mean anything.

**The device test is the measure that moved.** Pooled over both arms, 29/29
turns granting praise in words read edged; the single bare turn read flat
(p = 0.033) — reproducing the stored table prospectively, but on one bare
turn where the design hoped the unasked control would supply several. Across
both strong-stack batches: 39/40 with the device read edged, 1/5 without.

**No cost**: tutor v2.2 delta −0.4 on a ~67 mean.

## Limits

One writer, one reader, and the reader's gloss names the device, so no causal
claim — the compliment and the edge travel together; which drives which is
not measurable here. The plain register delivers the device near ceiling
unprompted on this writer, so the asking register is redundant on this stack.
This closes the generation line for negative registers on the strong stack.
