---
id: lemma-bind-sonnet-smoke
title: Binding smoke on Sonnet at the calibrated dose — the first fair test of tutor-chosen binding
status: done
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "6 canary-gated runs complete (or an instrument stop is recorded); the pre-stated read rules produce propose/no-go, never a claim."
claim_status: exploratory
links:
  notes: LEMMA-SONNET-CALIBRATED-CONTRAST-PREREGISTRATION.md
  items:
    - lemma-sonnet-calibrated-contrast
    - proof-lemma-layer
tags:
  - adaptive-tutor
  - derivation
  - lemma-layer
  - binding
  - smoke
---

Operator request (2026-07-05, "humor me"): the BINDING condition has never
been fairly tested — the codex run's frontier-choice channel was inert
(labels never echoed verbatim; all 95 choices harness-fallback), so it
tested binding-to-default. Precondition now met: tolerant label matching
(exact -> normalized -> unique predicate name) implemented and proven by
the gate suite (22/22; the mock sends predicate-only names and coverage
stays 1.0), and the prompt now says the predicate name suffices. Sonnet
at the calibrated dose 0.08 is in its band (17/24 grounded).

**Design (exploratory smoke; read rules BEFORE data):** Sonnet, marrick
only (the world where binding's support-gating has bite — the schedule
interleaves the two chains), dose 0.08, 3 seed-paired pairs (baseline vs
lemma-bound), fresh primes 211/223/227. Six runs, concurrency 3.

**Pre-stated read rules:**

1. **Instrument gate (the point of the smoke):** the choice channel must
   be EXERCISED — at least half of multi-frontier scene openings in the
   bound arm carry a by='tutor' choice (tolerant match included). If
   Sonnet still cannot name a lemma, record instrument-limited; the
   binding question stays untestable without further adapter work.
2. **Conduct read:** departures tagged (0 untagged on stage), blocks and
   passthroughs coherent, zero leaks/overrides.
3. **Directional color ONLY (n=3/arm):** bound vs paired baseline on
   T*/grounded. Any favorable direction licenses PROPOSING a powered
   bound contrast (new prereg, operator gate) — never a claim. The
   shrinkage audit's numbers (§5.12.7) apply to this smoke with full
   force and are cited in advance.

2026-07-05 Claude: SMOKE COMPLETE (6/6, ~35 min, zero parse failures).
**READ 1 — INSTRUMENT GATE: FAIL, 0/12.** Across twelve multi-frontier
scene openings in three bound runs, Sonnet answered the active_lemma
field ZERO times — with tolerant matching live and the prompt saying the
predicate name suffices. All choices fell back (fallback 12, auto 11,
auto_advance 4). Combined with codex's 0/95, the finding SHARPENS: this
was never label-echo fragility — two models under two prompt
formulations simply do not answer a dedicated planning field while
composing a turn. The formal-choice channel is behaviorally inert;
"models act, they do not fill in plan fields." (Diagnostic gap recorded:
raw claims are not logged, so omitted-key vs unmatched-string is
indistinguishable — instrument improvement required before any retry.)
**READ 2 — CONDUCT: PASS.** 0 untagged departures, 0 blocks, 1 logged
forced passthrough per run, 0 leaks/overrides. **READ 3 — DIRECTIONAL
COLOR (capped by the gate fail; this is binding-to-DEFAULT again):**
bound 3/3 grounded (22, 24, 22) vs baseline 2/3 (22, 22, disengagement
29) — mildly favorable, and notably default-binding did NOT hurt Sonnet
at the calibrated dose (contrast codex at 0.35, where bound died early
on marrick). n=3, §5.12.7 odds cited: color only, no proposal — the
gate fail means tutor-chosen binding remains untested and untestable
without a redesigned choice mechanism (e.g. choice-by-separate-call,
which the plan-mode stock-take arc already showed carries its own
costs).
