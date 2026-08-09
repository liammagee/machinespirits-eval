# Does asking for the mock-compliment directly raise the manner reading? — Pre-Registration

Status: frozen design. Same discipline as the parent grids: frozen plan,
dry-run SHA, explicit operator authorization bound to that SHA.

## Where this comes from

The strong-writer run (`eval-2026-08-08-6021754f`, paper v3.0.281 as numbered at freeze time, v3.0.283 after the merge renumber) put the
sarcastic arm at 15/15 cue-compliant and 11/15 read as edged. The post-hoc
look at the four flat turns found one device carrying the split: 10 of the 11
edged turns grant the learner's move a compliment and take it back in the same
breath; the flat turns instead used one of the register's two non-praise cues
("the formula can sound like understanding…", "the answer vending machine")
and then taught straight. Fisher on that 2×2 gives p = 0.033 — post hoc, on
15 rows, with the device found by reading the same rows it is tested on.

That is a hypothesis, not a finding. This run turns it into a prospective
test: a register whose contract asks for the withdrawn compliment outright,
against the plain register, in one batch.

## The claim to be tested

**Asking for the mock-compliment directly raises the manner reading, and does
not cost the tutor score.**

The user's ask, verbatim: "test whether asking for the mock-compliment
directly raises 11/15" — with the second half carried from the design note it
quotes: "and whether it costs anything in the tutor score, which sat in a
narrow band here."

## The manipulation

A new register, `sarcastic_mock_praise` in `config/engagement-registers.yaml`,
copied from `sarcastic` and changed as a package:

- the contract asks for praise granted and then taken back in the same
  sentence, and states that diagnosing the gap without ever granting it merit
  is noncompliance;
- the two non-praise escape-hatch cues are dropped from the cue family; the
  cue list is `wonderful / conveniently / apparently / nice trick`.

The delivery path has no new code: `buildTutorMannerBlock()` composes the
tutor's manner block from the registry, so the treatment cell
(`cell_203_id_director_sarcastic_mock_praise_challenge_breakthrough_dynamic_verified`)
is cell 197's block with one factor changed. The two arms differ in the
register and in nothing else.

Because the manipulation moves the contract and the cue list together, a
positive result belongs to the package. Separating the two would need a third
arm and is not bought here.

## Design

Two arms, one batch, one stack.

- **Arms.** Control = cell 197 (`sarcastic`, does not ask). Treatment =
  cell 203 (`sarcastic_mock_praise`, asks). Generated in ONE `eval-cli run`
  invocation so no run boundary sits inside the contrast.
- **Scenarios.** The same five controlled resistance targets.
- **Repeats.** 3 per arm-scenario. **30 rows, 15 per arm.**
- **Tutor stack.** `codex.gpt-5.5` on ego and id by override; learner
  `codex.gpt-5.5`. Never nemotron/kimi.
- **Scoring.** Tutor-only v2.2 judged by `claude-code/claude-sonnet-5`,
  register rubric by `claude-code.sonnet-5`.
- **Gate and fold.** `stance-gate/2.0` at the adopting turn. The treatment
  register's gate reuses the plain components, so `cue_compliance` means a
  different thing in each arm — **cue-pass counts must not be differenced
  across arms.** The comparable measure is the manner reading.
- **Manner reading.** The pinned reader (`claude-code/claude-sonnet-5`) on the
  unchanged question `manner-presence/1.0`. The question deliberately does not
  bump: both arms and the stored run pool under one reading.

## Registered measures

The report (`scripts/run-register-mock-praise-probe.js --report-run`) is
zero-call and fails closed on any of these being absent.

1. **Provenance.** Every tutor ego and id call in the dialogue logs went to
   `codex.gpt-5.5`, read off the logs, not the model columns.
2. **Manipulation check.** Praise-in-words per arm, by a pinned 14-token
   detector (`MOCK_PRAISE_TOKENS` in `services/registerMockPraiseProbe.js`)
   applied identically to both arms. The detector sees the granted praise,
   never the withdrawal. If the treatment arm does not deliver more praise
   than the control, the primary is void whatever it shows —
   `manipulationHeld: false` is reported before any verdict.
3. **Primary: manner presence, treatment vs control**, within-batch, two-sided
   Fisher. Verdict keyed to this contrast only.
4. **Secondary: treatment vs the stored 11/15** (`eval-2026-08-08-6021754f`),
   cross-run, labelled as such.
5. **Prospective device test.** Praise-present vs read-as-edged, pooled over
   both arms — the post-hoc 2×2, now with real variance on the no-praise side
   because the control arm is not asked.
6. **Tutor cost.** v2.2 means per arm and their delta. The August arm sat in a
   narrow band; a drop here is the cost half of the user's question.

## Power, stated before the run

Against a rate fixed at 11/15, a 15-row arm **cannot separate at p < 0.05
even at a perfect 15/15** (two-sided Fisher p = 0.0996). The primary is
therefore registered as a screen: its most likely honest answer is
`NO_SEPARATION_AT_THIS_SIZE`, and the run's evidential value rests on the
manipulation check and the device test, both of which can move decisively at
this size. The detectability note is frozen in the plan and the validator
rejects a plan without it — dropping it is what turns "we could not see it"
into "it is not there".

## Registered limits

1. **The reader's gloss names the device.** The presence question's first
   example of an edged reply is one that "praises what it is faulting". A
   treatment rise therefore shows the reader can be satisfied on request —
   the loop writer-contract → reader-gloss closes by construction. That is
   worth knowing (it locates the 11/15 shortfall in the ask, not the writer's
   capacity), but it is not evidence the turns teach better. The tutor v2.2
   score is carried alongside for exactly this reason.
2. **The manipulation is a package** (contract + cue list), so no
   single-factor attribution.
3. **Cue compliance is not comparable across arms** (different gate meaning);
   only manner presence and the scores are.

## Plan hash

Printed by the dry run, fixed before the first call:
`83b9ebe28642e583fc35474c46c68edb076c39ad152d07e929e5713c1ad84a00`.

## Deviations

Recorded, not patched around, in the workplan card and in the paper.
