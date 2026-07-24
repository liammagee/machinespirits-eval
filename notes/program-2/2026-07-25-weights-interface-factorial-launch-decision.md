# Program 2 weights x interface cohort launch decision

Date: 2026-07-25
Decision: **GO**
Authority: prior user authorization for the paid cohort plus the explicit
request to execute the preregistered next move after the common final-audit
reliability gate passed.

## Frozen launch

- Cohort: the preregistered 48-dialogue trained/untuned x v1/v2 factorial.
- Output root: `exports/program2-weights-interface-factorial`.
- Ordering seed: `20260725`.
- Bootstrap seed: `20260726`.
- Retry limit: two logical attempts per job; no replacement jobs.
- Launch SHA: the exact clean 40-character post-decision `HEAD` written to
  `launch-plan.json` before the first cohort child process starts.
- Runtime: the treatment implementation and common final-audit repair already
  validated by the fresh excluded four-cell smoke. This decision changes no
  source, treatment, prompt, weight, interface, audit, or retry seam.

The launcher must stop before paid calls unless the fresh 48-job zero-model
plan, read-only provenance audit, prompt/world quality gate, configured local
mini-model preflight, clean checkout, and exact-SHA check all pass.

## Provider-call ceiling

The conservative hard ceiling includes both logical attempts for every job and
the maximum bounded profile-adherence and tutor-recovery calls on every one of
40 turns:

- Terra learner/support roles: at most 6 calls per turn x 40 turns x 48 jobs x
  2 attempts = **23,040**;
- Sonnet speaking/composer role: at most 2 calls per turn x 40 turns x 48 jobs x
  2 attempts = **7,680**;
- total configured-provider generation ceiling: **30,720 calls**.

This is a fail-safe bound, not an expected-use estimate: most turns need one
learner generation, one combined learner analysis, and one tutor call, and most
jobs should need one logical attempt. The later frozen semantic instrument can
add at most 96 judge packet calls (48 packets x two judges) and is not part of
the generation ceiling.

## Decision boundary

The cohort may start only from a fresh root. Smoke and prior traces remain
excluded. After generation, run the post-cohort 11-check provenance audit and
frozen completion/missingness gates before any semantic claim. Semantic judging
and the preregistered analyzer follow only if those gates license them.
