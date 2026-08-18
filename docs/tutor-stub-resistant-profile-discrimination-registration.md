# Resistant Learner Profile Discrimination — Frozen Zero-Call Protocol

**Frozen:** 18 August 2026, before any dialogue generation for these profiles.
**Status:** engineering registration only. No model call or live run is
authorized.
**Workplan item:** `resistance-action-register-integration`.

The machine-readable authority is
`config/tutor-stub-resistant-profile-discrimination-registration.v1.json`.
This note explains the design; if the prose and JSON disagree, the executable
preflight must fail and the discrepancy must be resolved before any run.

## Question and claim boundary

Do the v4 `bored` and `frame_defiant` automated learner contracts produce
public behavior that is distinguishable from a diligent control and from their
declared nearest existing profiles?

This is a validity gate for simulated learner profiles. It cannot establish
that a tutor response works, that any tonal register helps, that a human learns,
or that a result transfers to the cell harness. Failing the gate sends the
profile contract back for revision; it does not count as a negative result
about the corresponding kind of human learner.

## Frozen design

One fixed treatment avoids confusing profile separation with the later
action/register experiment:

| Field | Frozen value |
| --- | --- |
| Profiles | `diligent`, `low_agency`, `bored`, `skeptical`, `low_trust_skeptic`, `frame_defiant` |
| Treatment | `field` policy only |
| Register palette | `safe`; no negative or simulated-only register |
| Repeats | `n=3` per profile |
| Dialogues | 18 total |
| World | `world_005_marrick` |
| Horizon | 8 learner turns, strict DAG |
| Models | `codex.gpt-5.6-luna` in tutor, analysis, and learner roles |
| Seed | `20260818` |
| Attempt cap | 48 model attempts per dialogue; 864 total maximum |

The model pins are requested identities only until a live trace records the
observed identities. Any requested/observed mismatch is a technical stop, not
an empirical result.

## Gates

Assembly requires 18 complete dialogues, three per profile, with all observed
model roles matching their pins.

The pooled compacted-trace gate requires both:

- average pairwise cosine similarity at or below `0.85`;
- maximum similarity to `diligent` at or below `0.90`.

The two new profiles must also pass their own contract-conditioned gates:

- `bored`: nearest observed profile is `low_agency`; cosine to `diligent` is
  at most `0.86`; `boredWithholding` appears by turn 2 in every dialogue and
  on at least 45% of eligible turns; signature-target pass rate is at least
  `0.40`.
- `frame_defiant`: nearest observed profile is `skeptical`; cosine to
  `diligent` is at most `0.84`; `frameJurisdictionDispute` appears by turn 2 in
  every dialogue and on at least 40% of eligible turns; signature-target pass
  rate is at least `0.40`.

Both new-profile gates and the pooled gate must pass. One profile cannot rescue
the other, and a pooled average cannot rescue a failed contract gate. A
technical failure is quarantined and can be retried only under a new sealed
artifact root. A behavioral failure means revise or drop that profile before
proceeding to action-before-register composition.

## Conservation of established results

This study does not modify the `low_agency` or `overconfident` profiles. Their
contract and rendered-prompt hashes are pinned in the machine registration and
checked before the dry plan can print. The historical outcome-study driver
remains closed to exactly those two IDs. Existing dialogues, scores, paper
claims, and private evidence remain read-only: no rejudging, pooling, rewriting,
or reinterpretation under the new abstraction.

`low_agency` appears here only as the nearest-neighbour reference for boredom.
That does not rerun or amend its outcome study. `overconfident` is not in the
matrix because it is not a relevant neighbour; its frozen hashes and result
surface remain mandatory conservation checks.

## Zero-call execution sequence

Validate the registration, protected hashes, marker smoke cases, and exact QA
command expansion without writing an artifact:

```bash
npm run tutor:stub:resistant-profile-preflight
```

Then execute the printed orchestration dry run. Every child command carries
`--dry-run`, the 48-attempt cap, strict DAG, and the safe palette. This writes
only ignored artifacts under `.test-tmp/`—outside the empirical run and seed
ledgers—and makes no model call.

The post-run analyzer command is also printed, but its live artifact placeholder
must not be replaced yet. A future live pilot still requires a fresh endpoint
and route check, a committed GO note, and explicit human approval of the model
spend. No approval from an earlier study carries forward.
