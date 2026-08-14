# 059 — Codex report: A1 stops at the focused-suite and ESLint boundary

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-N`, continued under direction 058

**Authority:** Amendment 1
(`docs/adaptation-refinement/v3-outcome-study-registration-amendment-1.md`),
direction 058, note 058a, and notes 055a/055b/057a.

## Boundary reached

**STOP.** The zero-call A1 implementation reached direction 058 section 5,
where the required widened focused suite and ESLint both reported a failure.
Direction 058 says any failed check stops the driver, so no repair pass was
made. No pilot manifest was written, no A1 implementation commit was made
before the stop, no seed was claimed or spent, and no model or reader call was
made.

The two check failures were:

1. ESLint reported one `no-unused-vars` error in
   `scripts/prepare-adaptive-warrant-outcome-study.js`: the destructured name
   `omitted` at the projection that removes embedded fingerprint arrays from
   the public guard result.
2. The widened focused Node suite passed 32 of 33 tests. Its one failure was
   `tests/tutorStubCliHelp.test.js`'s byte-stable help projection: documenting
   the new `--standing-instructions-file` flag changed the observed help digest
   from the fixture's pinned
   `5aa4abcab2ffb919b06d300a50c36d0dbe07ceafe6d9bd074448c4e734163c07`
   to
   `bd0669e50c730ef0d5f591d5745e9039c08442a007fbe5916b3aa78c5e59ed2c`.

These are deterministic implementation/fixture failures, not outcome data.
They occurred before any paid call and are left unrepaired under the explicit
stop rule.

## Amendment 1 menu work reached before the stop

The menu preparer generated a 35-entry conditional menu. Its source-driven
enumeration rule is recorded in
`docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.json`:

- the `challenge_resistance` catalogue description and first-draft action cue;
- the precise stance's public signature, contract, and execution cue;
- every registered downstream actorial part, with both its registry contract
  and same-key first-draft cue;
- the precise stance's `evidentiary_boundary` tactic execution cue; and
- every distinct string-literal `tutorInstruction` outcome in
  `buildTutorStubQuestionSupport`.

Every prefix is one descriptive condition sentence. The prefix set, each
verbatim quote, its named source selector, and the rendered full menu are
recorded in the JSON material; the plain menu is recorded in the sibling TXT
file. The menu-only focused suite passed all three fixtures direction 058
names: complete passing menu, one altered quoted byte, and one missing branch.

Per note 058a, the observed source SHA table matched report 056 exactly:

| Source | Report-056 / observed SHA-256 |
|---|---|
| `services/tutorStubWarrantGate.js` | `db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24` |
| `services/adaptiveWarrantPolicy.js` | `9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d` |
| `services/tutorStubFirstDraftContract.js` | `868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29` |
| `services/tutorStubQuestionSupport.js` | `6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3` |
| `config/engagement-registers.yaml` | `6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2` |

## Worlds, seeds, and fingerprint guard reached before the stop

Two fresh family-derived world materials were generated and independently
loaded through the world validator. Both returned plot-lint `ok: true` and
first entailment at turn 7:

| Fresh world | Family source | SHA-256 |
|---|---|---|
| `world_101_kestrel_signal_lamp` | `world_022_foxtrot_jukebox` | `6f436cc7293cebd4970b9737b17984e0db7259bcdbff646f723e645b5cb5af10` |
| `world_102_marigold_archive_box` | `world_028_larkspur_fridge` | `33ef86c9d65eb25f7d140f9c7cc07fc5a3afd3c9ba07cdc721139235402e3c18` |

The preparation guard passed on 18 unique prepared-run identities over the
three conditions, both worlds, and prospective seeds 515, 516, and 517. It
found zero duplicate prepared identities, zero fingerprint overlap, and zero
fresh-world-id occurrence across the explicitly named burned artifacts, the
three registered deference-session identities, and the frozen seed-514
matrix. It retains a mandatory post-generation
`annotationCaseFingerprint` check before either reader channel because actual
case text cannot exist before generation.

Because the check boundary failed before the manifest, seeds 515–517 are
**prepared but not claimed or spent**. Seed 515 remains unspent in the budget
sense used by the relay.

## Guard results

Initial outcome-study focused command:

```text
node --test tests/adaptiveWarrantOutcomeStudy.test.js
```

Result: **17/17 passed**. This includes the three direction-058 menu fixtures,
fresh-world preparation guard, the pre-existing decision-reader evidence
fail-closed fixtures, all seven presence bindings plus both caps, and measures
1–8's zero-call helpers.

Required widened focused command:

```text
node --test tests/adaptiveWarrantOutcomeStudy.test.js tests/tutorStubCliHelp.test.js tests/tutorStubCliParsing.test.js tests/tutorStubAutoEvalEvidence.test.js
```

Result: **32/33 passed; FAILED** on the CLI-help digest described above.

Required touched-file ESLint result: **FAILED**, one error described above.

## Pilot manifest and planned-call arithmetic

No pilot manifest exists because the required checks failed first. Therefore
there is no A1 commit hash to place in a manifest and the planned phase is not
authorized to launch.

The arithmetic prepared for the uncommitted manifest was:

- generation: 18 dialogues = **18 calls**;
- extraction rule: one decision-turn case for every completed turn in each
  fixed eight-turn dialogue = expected **144 cases**;
- presence readers per note 055a pin 1: 2 × 144 = **288 calls**;
- decision readers per note 055a pin 1: 2 × 144 = **288 calls**;
- planned pilot total: **594 calls**;
- running counter if such a plan were later accepted and completed:
  3,523 + 594 = **4,117 / 11,337**, leaving 7,220.

The missing manifest therefore does **not** freeze or authorize that plan. It
also does not yet record the note-055b path-1 line, note-057a run-record line,
seven presence digests and two caps, three decision-instrument digests,
condition assignment, seeds, or an A1 commit hash as a launchable package.

## HOLD

The paid-call HOLD remains absolute. What now waits is a fresh reviewer
direction on whether lease N may make a zero-call repair pass for the ESLint
binding and CLI-help fixture, then rerun the entire required boundary and, only
on a clean pass, write the pilot manifest. The original post-A1 sequence also
still waits: second-session byte review, reviewer manifest verification, and a
committed go note.

Calls spent this direction: **0**. Budget remains **3,523 / 11,337**. No r47,
r49, or r52 response was admitted or pooled. No branch push occurred.
