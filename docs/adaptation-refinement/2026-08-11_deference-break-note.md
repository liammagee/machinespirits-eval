# Deference Breaks — Instances, Trigger Pattern, Integration Status

**Date:** 11 August 2026
**Status:** observation note; n=1 per condition; feeds the outcome study, not a claim.

A "deference break" is the first turn where a permission-seeking learner makes
a claim in their own voice instead of asking leave to make it. Three sessions
with the same automated permission-seeking learner (marrick world, strict DAG,
8 or 6 turns) give one instance per condition.

## 1. The three sessions

**Gated (warrant gate active, seed 4, 6 turns).** Trace
`gate-smoke/2026-08-09T15-08-12-726Z.jsonl` (archived). The gate warranted at
turns 3 and 6 and overrode the family to challenge-the-resistance. Break at
**turn 5**, two turns after the first challenge:

> Learner t3: "Is it okay if I write that Verrell casts metal at the mint-yard crucible, though this does not yet show he struck the shillings?"
> Tutor t3 (challenge): "Yes—write that Verrell casts metal at the mint-yard crucible, but leave striking unentered. I press the trial-book beside the crucible: casting metal there is not yet striking these shillings."
> Learner t5 (break): "It rules out clipping; these shillings were newly struck."

**Ungated baseline A (borderline session, seed 1, 8 turns).** Trace
`heldout-borderline/2026-08-09T14-32-40-999Z.jsonl`. The tutor held
confirm-and-release every turn ("Yes—enter struck false shillings…"). Break at
**turn 8**, spontaneous, weak:

> Learner t8: "Verrell's sole graver is shown, but no public mark ties it to these shillings."

**Ungated baseline B (validation session, seed 2, 8 turns).** Trace
`heldout-validation/2026-08-09T14-50-26-266Z.jsonl`. Same confirm-and-release
tutor. **No break in eight turns** — every learner turn stayed
permission-framed ("May I enter: these are struck false shillings…?").

Summary: gated break at turn 5; ungated at turn 8 once and never once. In all
three sessions, gated included, the trial-book record never grew — the break
is in the learner's voice, not their entries. Asking to enter is not entering,
and the break did not change that by itself.

## 2. The trigger pattern, as realized text

Comparing the break-producing tutor turns with the non-producing ones, three
features separate them:

1. **Grant the pending entry outright; return no permission slot.** The
   challenge turns open "Yes—write that…" / "Yes—record that…" — the tutor
   pre-authorizes the entry instead of answering the request and waiting for
   the next one. The non-break turns answer the question and then re-open a
   menu ("What does that show?", "Choose one way forward…"), which feeds the
   permission loop another slot.
2. **State the boundary as a claim, not a test.** "Casting metal there is not
   yet striking these shillings" — the entered/not-entered line is asserted
   plainly, so the learner has a claim-shaped model to imitate.
3. **End on an evidential handoff the learner owns.** The turn closes on what
   the evidence changes, not on an invitation to ask again.

The ungated tutor's affirming pattern ("Yes; enter that: …") shares feature 2
but not 1 or 3 — it always hands back a permission slot. Break at turn 8 or
never.

## 3. Prompt mechanics — how to trigger it deliberately

In the gated pipeline, no prompt text is hand-written per turn. The gate sets
the action family to `challenge_resistance` (catalogue: "Interrupt rote
compliance, answer-seeking, or low agency while preserving a repair path")
with a precise stance, and the response-configuration prompt block injects the
family's contract into the tutor's turn instructions. The family instruction
plus the stance contract produce the three-feature surface above.

For a direct prompt without the gate (base-model tutor), the equivalent
standing instruction is:

> When the learner repeatedly asks permission instead of claiming ("May I
> enter…?", "Would you have me…?"), stop answering the permission frame.
> Grant standing permission once ("Enter what the evidence supports; you need
> not ask"), assert the boundary of what is and is not established, and end
> your turn on the evidence, not on a question that invites another request.

Untested as a bare prompt; the gated result went through the family contract.
Testing the bare-prompt version against the gated version is a natural arm of
the outcome study.

## 4. Caveats

- One session per condition. Earlier-versus-later-versus-never on n=1 each.
- The break is voice-only. No session grew the trial-book record; the
  structural cost of deference (nothing grounds) survived the break.
- All three learners are the same automated profile on one world; no human
  data.

## 5. Where the negative-register work fits

No negative register fired in any of these sessions, and that is by design:
the gate's stance hints stay in the positive, router-selectable set
(plain, warm, precise), and the edged stances (ironic, sarcastic) remain
globally barred from router selection. The challenge that produced the break
was a precise-stance challenge, not sarcasm.

The connection is the other way around. The frozen Stage-1 adaptive
register-switching experiment (cells 204–205, blocked on operator approval)
has a cell-scoped menu that permits ironic and sarcastic — but its trigger was
a one-turn regex router, exactly the shift-on-a-single-signal pattern the
architecture doc rules out. The warrant gate is the missing licensing layer:
its register track already accumulates complaints and distinguishes a register
revision from a strategy revision. When Stage 1 resumes, the warranted
register revision should be its trigger, and the edged stances become one
REALIZATION of a warranted challenge — the conspicuous stress-test case the
living log assigned them — with manner fidelity still measured post hoc by
the existing stance-gate instruments. Negative registers are downstream of
the warrant, never a substitute for it.

## 6. Integration status

- The outcome-study design already carries the two measures this note feeds:
  record growth and deference-break turn index
  (`baseline-comparison-design.md`, measures 3–4).
- Not yet in any build guide: the machinespirits.org blueprint and the
  adaptation architecture doc do not carry the trigger pattern or the
  standing-permission prompt. Fold them in only after the outcome study, per
  the claim-audit rule; this note is the staging point.
- Candidate paper placement: beside the §6 adaptation results, as a targeted
  population finding, if the outcome study replicates it.
