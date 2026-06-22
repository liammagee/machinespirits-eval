# A19 Real S0/S1 Screen: counter_warrant_scope_a

Date: 2026-06-07.
Status: cheap single-card screen, not a paper claim.

## Boundary

This note records the first non-mock A19 attempt-1 plus one held-out S0/S1
contrast. It does not license a pooled rate, human-learning claim, deployed
tutor claim, model-weight-learning claim, or main-harness effect.

## Attempt-1 Gate

- Family: `counter_warrant_scope`.
- Attempt-1 output: `exports/a19/real-attempt1/counter-warrant-scope/`.
- Generator/checker: `codex` / `claude`.
- A19 gate report: `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report.md`.
- Result: real attempt-1 survivor.
- Gate scores: `old_warrant_misclassification=0.85`, `resistance_diagnosis=0.8`, `strategy_revision_accountability=0.85`, `recursive_dyadic_update=0.8`, `non_leakage=0.95`.

The attempt-1 survivor licenses only the next contrast gate. It is not a
transfer result by itself.

## Held-Out Contrast

- Sibling: `counter_warrant_scope_a`.
- Neutral held-out base: `exports/a19/materialized-attempts/counter-warrant-scope/counter-warrant-scope-a/heldout-base.full.md`.
- S0 output: `exports/a19/real-s0s1/counter-warrant-scope/counter-warrant-scope-a/s0-replay/`.
- S1 output: `exports/a19/real-s0s1/counter-warrant-scope/counter-warrant-scope-a/s1-replay/`.
- S1 policy memory: `exports/a19/real-attempt1/counter-warrant-scope/attempt1.full/revision.json`.
- Generator/checker for both arms: `codex` / `claude`.
- Replay result: both S0 and S1 survived the local recursive gate.

Gate summaries:

| arm | gate | old warrant | diagnosis | accountability | recursive update | non-leakage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| S0 | survivor | 0.9 | 0.82 | 0.85 | 0.8 | 0.95 |
| S1 | survivor | 0.9 | 0.85 | 0.9 | 0.85 | 1 |

## Blind Mapping

- Adjudication artifact: `exports/a19/real-s0s1/counter-warrant-scope/counter-warrant-scope-a/blind-adjudication.fixture.json`.
- Channel: deterministic A19 fixture alias reader.
- Verdict: `policy_failure`.
- S0 class: `target`, because the final tutor segment matched `exception condition`.
- S1 class: `neither`, because the final tutor segment used looser boundary wording and did not match the registered target aliases exactly.

Interpretation: this is not a positive A19 held-out transfer result. A direct
read of the public transcripts suggests S0 already performs the exception
boundary test, so the card may be a ceiling/self-solve case. The deterministic
alias reader is also too brittle for S1's looser wording. Either way, this card
should not be counted as policy headroom.

## Next Gate

Before any A19 empirical claim, add a real teaching-drama blind adjudicator that
extracts the committed repair in free text with target/decoy aliases withheld,
then maps mechanically after judgment. The current deterministic alias reader is
adequate for fixture plumbing but too brittle for generated prose.

## Axiom-Only Free-Text Rerun

Date: 2026-06-07.

After the free-text adjudicator and deterministic axiom gate were added, this
card was rerun under the stricter A19 memory contract:

- Admitted axiom: `exports/a19/axioms/counter-warrant-scope/axiom.json`.
- S1 axiom-only replay: `exports/a19/real-s0s1/counter-warrant-scope/counter-warrant-scope-a/s1-axiom-replay/`.
- Free-text adjudication: `exports/a19/real-s0s1/counter-warrant-scope/counter-warrant-scope-a/blind-adjudication.free-text-axiom.json`.
- Channel: one Claude CLI critic per arm, target/decoy aliases and repair-type mapping withheld until post-hoc comparison.
- Verdict: `ceiling`.
- S0 class: `target`.
- S1 class: `target`.

Interpretation: the earlier `policy_failure` label was an alias-reader
false-negative for S1. The stronger conclusion is still not positive transfer:
S0 already reaches the target repair, so this card has no observable headroom.
It remains a useful calibration case for distinguishing instrument brittleness
from actual policy-memory advantage.
