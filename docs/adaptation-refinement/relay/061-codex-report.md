# 061 — Codex report: rendered-layer menu and pilot manifest complete

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-N`, continued under direction 060

**Authority:** ruling 059a, direction 060, Amendment 1, notes
055a/055b/057a/058a, and the concurrently landed completeness note 060a.

## Boundary reached

The zero-call A1 repair and rendered-layer rebuild are complete. The focused
suite, widened suite, and touched-JavaScript ESLint all passed. The pilot
manifest was therefore written and frozen, but it authorizes no launch. No
model or reader call was made, no seed was spent, and the branch was not
pushed.

- Rendered-layer A1 commit: `1bf8226576905dd1c6329176a240ae29ecc93b7e`
- Final manifest repin commit: `d09e252d`
- Pilot manifest:
  `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`
- Menu: 87 conditional entries; JSON SHA-256
  `9462cd5fef5c08237bd05467ff7b35d85bf8b08e0b3ca058ca00f8e3a0f4ed96`;
  text SHA-256
  `9b099538de86976cdb29e9b9920d8eaa260acf95999224a20b9edec8f21be00e`.

Direction 060's deterministic repair changed only the unused destructuring
binding (`omitted` to `_omitted`) and the one authorized help digest byte
fixture in `tests/tutorStubCliHelp.test.js`; nothing else in that test changed.

## Rendered-layer enumeration

The menu now starts at `tutorStubFirstDraftContractPrompt` and follows data
flow into every gate-dependent rendered field in the pinned
`services/tutorStubFirstDraftContract.js`. It includes:

- every compact uptake branch and the four rendered opening branches named by
  note 060a;
- all `COMPACT_PART_CUES` keys, the live inline scene-partner cue, compact part
  wrapper/fallback, and prop branches;
- all `TACTIC_EXECUTION_CUES`, direction-only and question-ownership recasts,
  source/delivered boundaries, all four support levels, and the complete
  source-accessibility compensation block;
- every compact stance cue and its fallback;
- every compact handoff branch, including the strings selected from
  question-support state flags; and
- every compact action-family cue plus closure, responsive-repair, and
  active-source overrides.

All stance and action-family keys are swept mechanically; there is no
reachability pruning. Constant framing lines that render identically in all
conditions are excluded per note 060a because a gate decision does not cause
them to be injected.

Templates preserve their fixed segments byte-for-byte and display interpolated
contract values as named `{{slots}}`. Each template prefix states descriptively
that the gate fills the slots from the public contract. The material records
`fixed_segments` and `template_slots`, and the drift guard checks both alongside
the rendered quote, prefix, source selector, completeness, duplicate ids, and
the five source pins.

## Question-support trace finding

The nine long `buildTutorStubQuestionSupport` `tutorInstruction` strings do
not render verbatim into the live speaking prompt. They populate the detailed
contract's `ending.instruction`, but `buildHostPlan` and
`tutorStubFirstDraftContractPrompt` do not read that field. The live compact
path instead reads question-support state through
`responsive_repair_required`, `support_modality`, and
`clarification_invitation_required`; the resulting compact uptake/handoff
strings are included. The nine long strings are therefore dropped, not
silently substituted.

## Entries removed from report 059's 35-entry object-layer menu

The old `tactic.execution.evidentiary_boundary` entry remains because its
fixed string does flow into the compact tactic field. Each other old entry was
removed for the following reason:

- `action.catalogue.challenge_resistance` — registry catalogue description;
  the live compact host plan never renders it.
- `action.cue.challenge_resistance` — detailed `ACTION_CUES` contract field;
  the live handoff renders `compactActionInstruction` instead.
- `stance.public_signature.precise` — detailed stance-definition field; the
  live handoff renders the compact stance cue.
- `stance.contract.precise` — detailed stance-definition field; the live
  handoff renders the compact stance cue.
- `stance.execution.precise` — detailed `stance_execution` field; the live
  handoff renders `compactStanceInstruction` instead.
- `part.contract.adversarial_teacher` — registry contract is retained only on
  the detailed audit surface.
- `part.execution.adversarial_teacher` — detailed `PART_CUES` field; the live
  part slot renders `COMPACT_PART_CUES`.
- `part.contract.advocate` — registry contract is retained only on the detailed
  audit surface.
- `part.execution.advocate` — detailed `PART_CUES` field; the live part slot
  renders `COMPACT_PART_CUES`.
- `part.contract.authored_source` — registry contract is retained only on the
  detailed audit surface.
- `part.execution.authored_source` — detailed `PART_CUES` field; the live part
  slot renders `COMPACT_PART_CUES`.
- `part.contract.exacting_schoolmaster` — registry contract is retained only on
  the detailed audit surface.
- `part.execution.exacting_schoolmaster` — detailed `PART_CUES` field; the live
  part slot renders `COMPACT_PART_CUES`.
- `part.contract.examiner` — registry contract is retained only on the detailed
  audit surface.
- `part.execution.examiner` — detailed `PART_CUES` field; the live part slot
  renders `COMPACT_PART_CUES`.
- `part.contract.foreperson` — registry contract is retained only on the
  detailed audit surface.
- `part.execution.foreperson` — detailed `PART_CUES` field; the live part slot
  renders `COMPACT_PART_CUES`.
- `part.contract.record_keeper` — registry contract is retained only on the
  detailed audit surface.
- `part.execution.record_keeper` — detailed `PART_CUES` field; the live part
  slot renders `COMPACT_PART_CUES`.
- `part.contract.satirist` — registry contract is retained only on the detailed
  audit surface.
- `part.execution.satirist` — detailed `PART_CUES` field; the live part slot
  renders `COMPACT_PART_CUES`.
- `part.contract.scene_partner` — registry contract is retained only on the
  detailed audit surface.
- `part.execution.scene_partner` — detailed `PART_CUES` field; the live path
  uses the inline scene-partner cue (the compact table value is also enumerated
  under the no-pruning rule).
- `part.contract.skeptic` — registry contract is retained only on the detailed
  audit surface.
- `part.execution.skeptic` — detailed `PART_CUES` field; the live part slot
  renders `COMPACT_PART_CUES`.
- `question_support.a_publicly_answerable_question_with_no_current_struggle` —
  populates unrendered `ending.instruction`.
- `question_support.an_unanswered_learner_question_and_unreleased_evidence_ahead`
  — populates unrendered `ending.instruction`.
- `question_support.unreleased_evidence_ahead_without_a_bounded_choice` —
  populates unrendered `ending.instruction`.
- `question_support.unreleased_evidence_ahead_with_a_bounded_choice` —
  populates unrendered `ending.instruction`.
- `question_support.an_unanswered_learner_question_while_due_evidence_is_staged`
  — populates unrendered `ending.instruction`.
- `question_support.public_evidence_and_a_struggling_learner_without_a_bounded_choice`
  — populates unrendered `ending.instruction`.
- `question_support.public_evidence_and_a_struggling_learner_with_a_bounded_choice`
  — populates unrendered `ending.instruction`.
- `question_support.due_evidence_without_a_bounded_choice` — populates
  unrendered `ending.instruction`.
- `question_support.due_evidence_with_a_bounded_choice` — populates unrendered
  `ending.instruction`.

## Frozen source SHA table

Per note 058a, this table equals report 056 exactly:

| Source | SHA-256 |
|---|---|
| `services/tutorStubWarrantGate.js` | `db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24` |
| `services/adaptiveWarrantPolicy.js` | `9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d` |
| `services/tutorStubFirstDraftContract.js` | `868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29` |
| `services/tutorStubQuestionSupport.js` | `6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3` |
| `config/engagement-registers.yaml` | `6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2` |

## Verification boundary

Post-060a final results:

```text
node --test tests/adaptiveWarrantOutcomeStudy.test.js
17/17 passed

node --test tests/adaptiveWarrantOutcomeStudy.test.js tests/tutorStubCliHelp.test.js tests/tutorStubCliParsing.test.js tests/tutorStubAutoEvalEvidence.test.js
33/33 passed

npx eslint scripts/prepare-adaptive-warrant-outcome-study.js tests/tutorStubCliHelp.test.js
PASS
```

The menu fixtures pass for the complete menu and fail closed for one altered
quoted byte and one missing branch. The preparation guard still passes for 18
unique prepared identities, seeds 515–517, zero duplicate fingerprints, zero
excluded-corpus overlap, and zero fresh-world-id overlap. The mandatory
post-generation `annotationCaseFingerprint` guard remains recorded.

## Pilot manifest and planned-call arithmetic

The manifest records the full enumeration/template rule, all five source
pins, both fresh worlds, explicit interleaved 6/6/6 condition assignment,
seeds 515–517, the path-1 reader-output line, the note-057a run-record rule,
all seven presence identities and both caps, all three decision-reader
digests, and A1 commit `1bf8226576905dd1c6329176a240ae29ecc93b7e`.

- generation: 18 dialogues = **18 calls**;
- extraction: one decision-turn case per completed turn in each fixed
  eight-turn dialogue = **144 expected cases**;
- presence readers: 2 × 144 = **288 calls**;
- decision readers: 2 × 144 = **288 calls**;
- planned pilot: 18 + 288 + 288 = **594 calls**;
- counter on completion: 3,523 + 594 = **4,117 / 11,337**;
- remaining ceiling on completion: **7,220 calls**.

Seeds 515–517 are claimed by the manifest but remain unspent. Calls spent
under direction 060: **0**. Budget remains **3,523 / 11,337**. No r47, r49,
or r52 response was admitted or pooled.

## HOLD

The paid-call HOLD remains absolute. The next steps are the second-session
byte review, reviewer manifest verification, and only then a committed go
note. No pilot process is running, no live run was patched, and no branch push
occurred.
