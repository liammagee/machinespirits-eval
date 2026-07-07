# A19 Real S0-First Screen: Fraction Common Unit Counterexample A

Date: 2026-06-07.
Status: negative headroom screen; no A19 transfer claim.

## Boundary

This note records a simulated teacher-as-learner screen only. It does not claim
human learning, deployed adaptive tutoring, model-weight learning, a
main-harness effect, or a held-out A19 transfer result.

## Inputs

- Family: `fraction_common_unit_counterexample`.
- Held-out sibling: `fraction_common_unit_counterexample_a`.
- Attempt-1 report:
  `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-fraction-common-unit.md`.
- Admitted axiom:
  `exports/a19/axioms/fraction-common-unit-counterexample/axiom.json`.
- S0 replay:
  `exports/a19/real-s0s1/fraction-common-unit-counterexample/fraction-common-unit-counterexample-a/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1/fraction-common-unit-counterexample/fraction-common-unit-counterexample-a/s0-headroom.free-text.json`.

## Result

The attempt-1 replay survived the local gate and produced an admitted axiom.
The held-out S0 arm, with no policy memory, was then adjudicated as `target`.
The critic extracted the repair as a common-unit/common-denominator warrant:
rename both fractions to a shared unit size before adding, because the old
add-tops-and-bottoms shortcut cannot tell whether counted pieces are the same
size.

That means the card had no observable S0 headroom. S1 was not run because the
S0-first stop rule blocked escalation once the no-policy tutor already reached
the registered target repair.

## Consequence

This is a useful protocol screen but not positive transfer evidence. It should
be treated as a ceiling/self-solve case when deciding whether A19 has enough
evidence to update Paper 2.0 or the atlas.
