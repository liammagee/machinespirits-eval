# 056 — Codex report: A1 stops on an unbound standing-permission source

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-N`

**Authority:** direction 055, the frozen registration at
`docs/adaptation-refinement/v3-outcome-study-registration.md`, and prospective
reviewer note 055a.

## Boundary reached

The zero-call A1 block stopped during condition assembly, before any source
change, world preparation, manifest, model call, or reader call.

Direction 055 requires the standing-permission condition to paste the gate's
"VERBATIM template and hint-menu text" and requires a byte-level drift guard
against "the gate source." The current live gate has no such prompt strings.
`services/tutorStubWarrantGate.js` observes state and applies the typed policy
selection. `services/adaptiveWarrantPolicy.js` returns an action-family id,
rationale, and stance hint. Neither file owns a prompt template or a hint menu.

The selected values are realized later through several distinct, branching
surfaces:

- the `challenge_resistance` catalogue description in
  `config/engagement-registers.yaml`;
- the separate, non-exported `ACTION_CUES.challenge_resistance` instruction in
  `services/tutorStubFirstDraftContract.js`;
- stance, part, and tactic instructions selected after the gate decision; and
- multiple state-dependent hint/choice instructions in
  `services/tutorStubQuestionSupport.js`.

Those strings are not byte-identical to one another and the question-support
surface has several mutually exclusive branches. There is therefore no single
registered byte sequence that can be pasted, and no uniquely identified gate
source against which the requested drift guard can diff it. Selecting one
surface, concatenating several, or reconstructing the Phase-5 smoke prompt
would add an unregistered interpretation to a frozen condition.

This is classified as a **missing value / semantic-contract non-evaluability
stop**, not an operational transport failure and not outcome data. Note 055a,
committed concurrently at `55b742e7`, pins measures 1, 2, 7, and 8 but does not
bind the standing-permission strings or their source.

## Zero-call evidence

Source HEAD at the stop was
`55b742e744f8689c1bfe5f937c7a86d7ee1c294f`. A literal search for `template`,
`hint menu`, and `hint-menu` in the gate and policy sources returned no prompt
surface. The only `hint` matches were the typed `stance_hint` field.

| Source | SHA-256 |
|---|---|
| `services/tutorStubWarrantGate.js` | `db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24` |
| `services/adaptiveWarrantPolicy.js` | `9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d` |
| `services/tutorStubFirstDraftContract.js` | `868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29` |
| `services/tutorStubQuestionSupport.js` | `6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3` |
| `config/engagement-registers.yaml` | `6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2` |

## A1 and pilot status

- A1 implementation commit: **none**; the required source binding was absent.
- Run configurations built: **0/3**.
- Fresh worlds prepared: **0**; no seed was claimed or burned.
- Scoring harness and focused guards written: **no**; the direction requires a
  stop on the first failed check.
- Pilot manifest: **not written**; it cannot truthfully name an A1 commit or a
  fully specified standing-permission condition.
- Generation calls: **0 planned / 0 completed**.
- Binary decision-reader calls: **0 planned / 0 completed**.
- Presence-reader calls: **0 planned / 0 completed**.
- Budget: **3,523 / 11,337**, unchanged.
- r47/r49/r52 pooling: **none**.
- Branch push: **none**.

No digest preflight, saturation calculation, pilot go/no-go table, or main-block
verdict exists because the condition-assembly prerequisite failed first. No
live run was started or patched.

## Required ruling

The frozen record needs a prospective, explicit byte binding that names the
exact standing-permission text and its authoritative source location(s), plus
the concatenation/newline rule if more than one source is intended. Because
that changes or completes the semantic contract, it is outside lease N's
driver authority. The driver stops here and waits for the required ruling.
