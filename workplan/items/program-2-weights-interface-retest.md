---
id: program-2-weights-interface-retest
title: "Price the fine-tune with a weights by interface retest"
status: dropped
type: experiment
priority: P2
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "The source-bound Amendment 1 pilot sealed 2/8 rows and then correctly stopped: both rows had one scheduled opportunity and passed safety/cue-blind checks, but trained-v1 coverage at turn 23 was 0.667 and both scheduled turns were publicly noncompliant; six jobs and the cohort never ran, and no treatment estimate is claimed."
claim_status: killed
links:
  paper: §6.21
  notes:
    - PROGRAM-2-WEIGHTS-INTERFACE-RETEST-PREREGISTRATION.md
    - notes/program-2/2026-08-05-weights-interface-retest-pilot-stop.md
    - notes/program-2/2026-08-05-weights-interface-retest-amendment1.md
    - notes/program-2/2026-08-05-weights-interface-retest-amendment1-pilot-stop.md
  exports:
    - exports/program2-weights-interface-retest-pilot-a1/partial-analysis.json
  items:
    - program-2-committee-floor-ablation
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - committee
  - ablation
  - interface
milestone: adaptive-tutor-evidence-v1
branch: codex/program2-weights-interface-retest
---

Correct the historical identification failures without reusing their rows:
keep Marrick's public-release horizon at turn 22, measure learner uptake at turn
23, guarantee one handoff-admissible scheduled warrant exposure per row, cross
trained versus untuned local weights with deterministic v1 versus v2 span
extraction, and make all downstream enforcement cue-blind. The excluded pilot
contains one complete four-cell block per learner profile. It licenses apparatus
and completion only, never a treatment-effect reading.

2026-08-05 — Implementation, zero-model 8/48 plans, static reachability,
certificate construction, four-surface local Ollama smoke, runtime-level
cue-blind enforcement tests, and the full hermetic suite passed. The user
explicitly authorized the named Anthropic and OpenAI destinations and private
payload scope for the excluded eight-dialogue pilot. The confirmatory cohort
remains unauthorized pending the sealed pilot bundle and its frozen gates.

2026-08-05 — The authorized excluded pilot ran and the frozen futility gate
stopped it after 2/8 sealed jobs. One row fell below the turn-22 learner-coverage
floor because the last public premise was released on that same tutor turn and
was integrated at turn 23. More importantly, both rows recorded zero eligible
committee opportunities and zero committee moments: co-fired warrant candidates
lost detector priority, while later assigned warrant triggers failed the active
handoff eligibility contract. The result is incomplete and under-informative;
there is no primary estimate and no treatment-effect reading. A replacement is
blocked on a preregistered Amendment 1 with separate release/uptake horizons,
handoff-compatible treatment exposure, a non-vacuous opportunity gate, new
bindings, and fresh external-run authorization.

2026-08-05 — Amendment 1 implemented prospectively without external calls.
The plan now separates public release at turn 22 from learner uptake at turn
23, schedules exactly one first handoff-admissible no-release warrant exposure
in turns 15–21, records its provenance through the runtime and committee
ledger, and fails each sealed row unless that exposure actually occurred. The
old pilot remains immutable; replacement schemas and roots are v2/A1. Focused
tests and zero-model plan validation pass. Once committed, this source must pass
a fresh clean-source smoke/certificate; external launch remains blocked on
explicit replacement-pilot authorization, and the cohort remains unauthorized.

2026-08-05 — The authorized Amendment 1 excluded pilot sealed two rows and
then stopped under its frozen live futility rule. The Amendment successfully
scheduled one committee opportunity per row, but neither became a compliant
public treatment. `untuned_v1` reached coverage 1.000 at turn 23;
`trained_v1` remained at 0.667 because the last premise was released on tutor
turn 23 and integrated on learner turn 24. Both rows stayed leak-free and
eventually grounded at turn 25, but post-horizon closure cannot rescue the
registered gate. Six jobs and the cohort never ran. The card is dropped with a
killed endpoint, no treatment estimate, and no Amendment 2 implied.
