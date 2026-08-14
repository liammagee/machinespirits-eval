# 083 — Codex report: v4 re-registration build complete; counter pin deferred

**Date:** 13 August 2026. **Direction:** 082, continuing direction 080 after
the resolved comment conflict. **Driver:** Codex.

## Outcome

Tasks 1–3 and 5 are complete. Task 4 remains correctly deferred because the
third Sol diagnostic re-take exists but is still running and has no seal. No
pilot, dialogue, reader, or other paid-model work was launched by this driver.

## Implementation

- `services/adaptiveWarrantGateCore.js:32-39,186-187,221-252` updates the old
  deference comment under re-registration 079, makes `deferenceSustained` its
  own revision warrant, and places exact basis
  `sustained_deference:3_turns` after register escalation and before
  accumulated trouble. The existing producer in `tutorStubWarrantGate.js`
  was not changed. The basis is returned through the existing warrant record,
  decision record, and trace path.
- `scripts/score-adaptive-warrant-outcome-study.js:32-66` changes bare and
  standing-permission from gate mode `off` to `observe`; gated remains
  `active`. All three conditions therefore compute and persist the same
  decision-time learner-signal block, while only gated can act on a warrant.
- `scripts/run-adaptive-warrant-outcome-pilot.js:176-189`,
  `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json:204-216`,
  and `tests/adaptiveWarrantOutcomePilot.test.js:72-83` re-pin the live ceiling
  and its exact guards from 11,337 to 19,337.
- `tests/adaptiveWarrantGate.test.js:1856-1889,2153-2163,2224-2248` covers the
  exact three-turn threshold, two-turn non-arming, interruption reset, exact
  basis, engaged-analytic coexistence, and precedence over accumulated
  trouble. Existing expectations affected by the registered precedence were
  updated.
- `tests/adaptiveWarrantOutcomeStudy.test.js:90-164` covers decision-time
  signal parity across observe/active/observe and performs a zero-call
  structured replay of the quarantined v3 gated decision inputs.

The v3 replay reproduces registration 079 predictions exactly at the first
sustained-deference warrant:

| Gated dialogue | First arming turn |
|---|---:|
| 02 | never |
| 04 | 6 |
| 09 | 3 |
| 11 | never |
| 13 | 5 |
| 18 | 5 |

## Verification

- Full `tests/adaptiveWarrant*.test.js` suite plus
  `tests/tutorStubAutoEvalEvidence.test.js`: **211/211 passed**.
- `services/__tests__/adaptiveWarrantDivergence.test.js`: **5/5 passed**.
- ESLint on all six modified JavaScript/test files: **passed**.
- `git diff --check`: **passed**.
- Real frozen prompt preflight within the suite: all three conditions over both
  frozen worlds passed without model calls.

An earlier focused run exposed two old expectations that encoded accumulated
trouble ahead of sustained deference; both were updated to the registered
precedence, and the final full run is green.

## `11337` sweep

`rg -n --hidden --glob '!.git/**' '11337' .` finds no live ceiling literal.
The remaining matches are historical or directional relay prose in notes 078,
079, 080, and 081, this report's sweep description, plus the unrelated SHA-256
substring in report 029. The three live occurrences now read `19337` in the
manifest, launcher guard, and guard test.

## Counter status: DEFERRED

The seal gate was re-checked after tasks 1–3 and 5:

- `sol-smoke-01-bare-s515-2026-08-13`: sealed `complete`;
- `sol-smoke-02-gated-s515-2026-08-13`: sealed `complete`;
- `sol-smoke-03-standing-s515-2026-08-13`: directory exists, run state is
  `running`, process 83224 remains live, and no `run-seal.json` exists.

Per direction 080 task 4 and direction 082, no per-directory reservation count
was treated as settled and no counter-derived literal was changed. The
existing `counter_before`, `counter_after_if_completed`, and
`remaining_after_if_completed` values remain untouched for a later sealed
re-pin.

## Safety and frozen-surface confirmation

- Paid model calls made or launched by this driver: **0**.
- v1–v3 artifacts changed: **none**; the v3 corpus was read only for replay.
- Frozen instrument, standing-permission menu, and world files changed:
  **none**.
- Strict analyzer parser, prompt, and schema changed: **none**.
- Branch pushed: **no**.
