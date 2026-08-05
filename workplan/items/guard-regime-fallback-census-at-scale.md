---
id: guard-regime-fallback-census-at-scale
title: At scale the guard regime ships canned text on most turns
status: active
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  A census script that reads guard accounting out of any run's traces and
  reports, per condition: turns, fallback rate, model-as-written rate, pass
  rate by candidate kind, and the failure count by guard family. Run it on
  fallible-phaseB and on the next instrumented run, and hold the numbers
  against the ones recorded here.
claim_status: methods
links:
  code:
    - services/tutorStubGuardDisposition.js
    - services/tutorStubFirstDraftOuterLoop.js
    - services/tutorStubTurnProgressionContract.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - guard-ladder-ships-canned-text-on-most-turns
    - tutor-fallible-learner-closure-prereg
    - tutor-stub-correspondence-guard-vocabulary
tags:
  - tutor-stub
  - guards
---

## What the run shows

`guard-ladder-ships-canned-text-on-most-turns` closed on 2026-08-05 with two
dialogues: Campus 3 fallbacks of 10 turns, Riverside 2 of 5. The
fallible-learner Phase-B run went out the same day on the same tree — every
guard fix in, including the fallback quality floor from 00:01Z, run started
02:03Z — across nine conditions and 1,156 tutor turns. It reads the other way.

| condition | turns | canned | model as written |
|---|---|---|---|
| false_memory × rowan, bare | 102 | 43% | 8% |
| false_memory × rowan, contract | 109 | 43% | 25% |
| false_memory × rowan, empty plan | 121 | 55% | 3% |
| low_agency × greyfen, bare | 124 | 69% | 1% |
| low_agency × greyfen, contract | 145 | 63% | 28% |
| low_agency × greyfen, empty plan | 156 | 66% | 1% |
| low_agency × rowan, bare | 127 | 74% | 0% |
| low_agency × rowan, contract | 143 | 66% | 21% |
| low_agency × rowan, empty plan | 129 | 71% | 2% |
| **all** | **1156** | **62%** | **10%** |

The two-dialogue closure was a small sample from the easy end. The bare tutor
in the shy-learner cells got 0 of 127 and 1 of 124 turns through as composed.

## Pass rate by candidate kind

Each turn runs a ladder: the model's draft, a plain rewrite, a repair, then the
canned template.

| candidate | n | passes |
|---|---|---|
| the model as first written | 1156 | 10% |
| plain rewrite | 997 | 20% |
| self-correction | 144 | 28% |
| composition repair | 130 | 28% |
| actorial part repair | 62 | 71% |
| source voice repair | 17 | 0% |
| canned template | 717 | 100% |

The template passes every time because it is built from the checks. Read the
100% as a definition, not a result — an early cut of this analysis counted it
as a passing candidate the harness discarded, which it is not.

## Which guards do the vetoing

Findings against the model's first draft, by family:

| findings | family | sole failing family on |
|---|---|---|
| 1264 | live turn progression | 130 drafts |
| 949 | actorial realization | 86 drafts |
| 516 | dramatic release | 14 drafts |
| 295 | live source action alignment | 7 drafts |
| 249 | repetition | 48 drafts |
| 123 | response composition | 5 drafts |
| 62 | closure | 7 drafts |

The single check: `repetition.tutor_turn_without_advance`, 978 firings across
all attempts, then `handoff_loses_turn_focus` at 917 and
`learner_uptake_not_realized` at 872. Two of the three are the families the
guard catalog already said should not veto.

Nothing here is one guard's fault. Only 297 of 1,041 rejected drafts failed a
single family; the rest failed two or more at once, so relaxing any one check
alone moves little.

## What ships instead

The template keeps the model's first sentence and replaces the rest with fixed
procedural prose. From `low_agency × rowan`, contract, dialogue 9, turn 5:

- The model wrote: *"That is the right limit: the split makes a basin-joint
  leak possible, not the ceiling mark's cause. I open the taped notebook beside
  the basin entry and mark cause still unproved. The paper strip shows the
  first bead at the joint. I leave the ceiling-mark line blank until its water
  travel is shown."*
- What shipped: *"That is right: the split shows a possible leak at the basin
  joint, not the ceiling's cause. We begin again from this public statement,
  leaving the previous wording behind. I write that difference down in the
  repair notebook. Keep only what the public evidence already shows. We will
  carry this point forward as stated: The hose split…"*

The model's version names the paper-strip evidence and holds the ceiling line
open. The shipped version drops both and repeats the standing instruction. This
is the case the catalog predicted: under load the checks fire, the draft dies,
and the dialogue goes liturgical.

## What this costs the research

Two things, and they pull in different directions.

The first is real but bounded: dialogues run long, burn turns on text that
advances nothing, and hit the cap. Phase B's 37 non-closures all had full
evidence coverage and all hit the cap.

The second is worse. On 62% of turns the learner is not reading the tutor
under test. Any comparison of tutor architectures is diluted by however much
of each arm is template — and the dilution is not equal across arms. The
contract arm shipped its own text 21–28% of the time against the bare arm's
0–1%. A contrast between those two arms is partly a contrast between a model
tutor and a fixed script. That confound was not in the pre-registration and
should be stated wherever Phase B is cited.

## The counterweight, which is already in the paper

§6.24 names the guards as one of four locks and prices them: the composer
authored 65% of turns under strict policy, disproportionately the pressure
turns, with a ladder of 65/48/36/35%. So the rate here is not new — it
replicates on a different world pair and a different tutor family, which
strengthens it as a harness constant rather than a Phase-B accident.

The same section carries the result that cuts hardest against alarm: on a qwen
tutor the floor is 100% template, and the dialogues close anyway. If a dialogue
made entirely of boilerplate still reaches its endpoint, the template is not
fatal to the outcome channel, and "the guards sank the run" is not available as
an explanation for a null. Phase B's 37 non-closures need their own account —
which they have: all had full evidence coverage, all hit the cap, all were
waiting on the learner to assert.

That bounds the claim on this card to two things, both of which stand: the
turns are expensive, and the arms are diluted unequally. It does not license
"the guards caused the null".

## Decision this card carries

The design rule in `docs/tutor-stub-guard-catalog.md` (2026-07-30) already
says: binary where it is a transaction, graded where it is a judgment. Evidence
safety, clue bookkeeping and closure stay hard; costume should score rather than
veto; the per-turn novelty check should be windowed. The knobs exist
(`TUTOR_STUB_STYLE_GUARDS_ADVISORY`, `TUTOR_STUB_ADVANCE_WINDOW`,
`TUTOR_STUB_GUARD_POLICY=shadow_advisory`) and all default off. This run is the
evidence for turning them on by default.

Turning them on changes trace comparability and needs a disposition catalog
version bump, so it is not a quiet edit. Sequence:

1. Record the census here and in the guard catalog. *(this card)*
2. Decide the delivery rule when everything fails —
   `guard-delivery-prefer-model-over-canned`.
3. Check the guards are right before relaxing them by fiat —
   `guard-validity-study`.
4. Flip defaults, bump the catalog version, note the incomparability.

Steps 2 and 3 are independent of each other and both feed step 4.

Step 2 ran on 2026-08-06 and reorders the rest. Replaying all 717 template
turns through the catalog's own relaxed column shows 91% of them had a model
draft that clears it, needing no new delivery rung at all; the closest-draft
rule the card proposes earns a further 6%; 19 turns of 1,156 stay template. So
step 4 is where nearly all the movement is, and step 2 shrinks to a tail case.
That makes step 3 the gate rather than a parallel track: flipping the default
ships 253 turns that do not take up what the learner said and 207 that do not
advance, and nothing yet says those beat the boilerplate they replace. Full
numbers on `guard-delivery-prefer-model-over-canned`; the replay is
`scripts/replay-guard-fallback-delivery.js` and costs nothing to re-run.

## Scope

One run, one model (codex gpt-5.6-terra), two worlds, two learner personas,
three prompt versions. The rates differ by a factor of nearly two between the
easiest and hardest cell, so treat the 62% as this run's number, not the
harness's constant. What generalises is the ordering: the model as first
written almost never passes, and the harder the dialogue the more the template
speaks.

## Log

- 2026-08-06 — census run over the Phase-B traces while working out why the
  first-draft contract moved outcomes in opposite directions on two worlds.
  Card filed; no code changed.
