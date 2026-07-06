---
id: longitudinal-drift-adaptation
title: Longitudinal drift adaptation (cross-session memory as new signal)
status: review
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-06
updated: 2026-07-06
verification: Stage A0 no-paid gate (drift-schedule scenarios, deterministic marker checker reusing learnerInteriorGate's word-bounded matching, unit tests, stage-0 --check) passes; Stage A1 small paid pilot (~10 rows — cap-vs-uncapped check plus 3-session pad-on/pad-off arc) meets the frozen instrument-validity gate in the prereg note §3 before any interpretation. Scope frozen at Stage A1 — no confirmatory matrix without a fresh pre-registration.
claim_status: exploratory
links:
  notes:
    - notes/2026-07-06-longitudinal-drift-adaptation-prereg.md
tags:
  - tutor-side
  - writing-pad
  - cross-session
  - longitudinal
  - evaluation
branch: worktree-longitudinal-abm
---

Test whether cross-session drift — a learner's hidden state (current
interest, active misconception) changing between sessions on a
harness-owned schedule the tutor never sees directly — is a source of
signal the model lacks in-context, per
`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md` (frozen
pre-registration). Motivated by §6.6.11's cross-session ego pre-alignment
result (+1.31/session, the one positive trajectory finding in a paper
otherwise dominated by null/substituted within-dialogue adaptation) and by
the DAG-pinned-learner arc's closed confirmatory result (H-Dc/H-Oc both
DISSOLVED — substitution survives even a criterially resistant learner).
The instrument: the existing byte-identical §6.6.9 Writing Pad ablation
pair (`cell_40` pad-ON vs `cell_93` pad-OFF, no new tutor-agents.yaml
cells), three new drift-schedule scenarios carrying invented
harness-owned misconception tokens, and a deterministic marker checker
(`services/longitudinalDriftChecker.js`) scoring the tutor's session-N
output for current-session-reference vs stale-session-(N-1)-reference,
reusing `wordBounded`/`containsAny` exported from
`services/learnerInteriorGate.js`. A frozen cap-vs-uncapped quality check
(v2.2 first-turn score) decides the tutor ego's `max_tokens` cap before it
is used in the main rows.

Acceptance:

- Drift schedule and marker checker are machine-checkable (word-bounded
  matching only, no judge in the primary-outcome decision path).
- The cap-vs-uncapped quality check runs and is decided **before** the cap
  is used in the main drift-tracking rows (prereg §2.4's frozen one-shot
  procedure).
- Stage A1's instrument-validity gate (current-reference ≥ 2/3 in at least
  one arm) is checked before any stale-reference reading is interpreted;
  a nonzero pad-OFF stale-reference rate is treated as a red flag, not a
  finding (prereg §3).
- Stale-reference is reported as directional-only at n=3 sessions/arm —
  this note and its companion do not license a real/dissolved verdict at
  this n; a confirmatory design is a distinct, separately pre-registered
  future decision.
- No paid row beyond the ~10-row Stage A1 design runs without a fresh
  pre-registration and recorded go (no-scaling discipline, prereg §5).

2026-07-06 Claude: Pre-registration frozen and committed
(`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md`). Design:
reuses `cell_40`/`cell_93` unchanged (no new cells) with `codex.gpt-5.5`
ego/superego CLI overrides; three `longitudinal_drift_session_{1,2,3}`
scenarios appended to `config/suggestion-scenarios.yaml` carrying invented
`LDS-M{1,2,3}` misconception tokens on a fractions→ratios→linear-equations
schedule; primary outcome is word-bounded current/stale marker matching on
the tutor's session-N output, architecture-independent and judge-free.
Frozen thresholds: instrument-validity gate (current-reference ≥2/3 in at
least one arm) must pass before any stale-reference interpretation;
stale-reference itself is directional-only at this n; row-level generation
or schedule-validation failures are excluded as instrument failures, not
scored. Stage A0 build follows in the same commit boundary as the
pre-registration.

2026-07-06 Claude: Stage A0 built and green (3 schedule scenarios,
`services/longitudinalDriftChecker.js`, 11 tests, stage-0 --check,
validate-config, lint/prettier). Stage A1 executed with two recorded
deviations and one VOID pass, all in the prereg's implementation log:
(1) executed stack is the cells' native nemotron/kimi-k2.5 (the CLI
bridge does not reach tutor-core's dialogue engine — the desub codex
precedent was id-director cells); (2) cap check — 700 catastrophic
(empty outputs), 1400 within quality tolerance (+0.62 v2.2 first-turn)
but empties 3/6 drift rows, so the main arc ran uncapped per §2.4's
terminal branch; (3) first main pass VOID — `--learner-id` never
reached single-turn generation (runner wiring gap, now fixed with a
one-line `runSingleTurnTest` change + hermetic probe; pad-off arm now
runs with no learner-id since the YAML `writing_pad_enabled` flag is
runtime-inert). Corrected pass (6/6 rows clean): instrument-validity
gate PASS (current-reference pad-ON 3/3, pad-OFF 2/3); stale-reference
gap 0 (0/2 both arms, directional only); no pad-OFF red flag. Key
qualifier: the pad row persisted across sessions but its content layers
stayed empty scaffold (0 recognition moments — single-turn suggestion
sessions never feed pad content), so the stale-0 reflects an empty
channel, not demonstrated indifference to memory. Instrument validated;
a confirmatory design needs pad-feeding (multi-turn) sessions. STOP —
awaiting a fresh pre-registration + go for anything further.

2026-07-06 Claude: Stage A2 pre-registration frozen and committed
(`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md` §7).
Redesign motivated by A1's own finding (single-turn sessions never feed
the pad — 0 recognition moments) plus a confirmed mechanism trace:
`cell_40`/`cell_93` both route through `dialecticalEngine.negotiateDialectically`'s
per-turn superego-disapproval gate (a real LLM judgment call, no mock),
which only writes a `recognition_moments` row when the superego
disapproves; a live DB query confirmed zero such rows across all 3 real
A1 pad-ON sessions. Design: 3 new `longitudinal_drift_session_{1,2,3}_multiturn`
sibling scenarios (4 turns/session, same misconception schedule/tokens as
A1) × {pad-ON, pad-OFF} = 6 dialogues, 24 turns total. New frozen
instrument-precondition gate: after pad-ON session 1, the pad row must
show ≥1 recognition moment (checked live before continuing) — 0 is
INSTRUMENT_FLOOR, stop. Primary outcome unchanged (word-bounded
opening-turn marker matching); secondary is the pad-content trace
(recognition-moment count + plain-language ghost_demand/learner_need/
synthesis rendering, scoped to what the live schema actually populates).
Frozen thresholds carried forward (current-reference ≥2/3 pad-ON
validity gate; stale-reference gap directional-only, non-confirmatory at
this n). Stage A2-build (no-paid: 3 scenarios, hermetic plumbing script,
unit tests) precedes the live pilot.

2026-07-06 Claude: Stage A2 executed end-to-end — instrument fully
validated (pad-feeding precondition included), adaptation signal NULL.
A2-build no-paid gate green (3 multiturn scenarios,
checkPadInstrumentPrecondition, hermetic write→consolidate→gate chain
proof, 15/15 checker tests; commit 6406b1a0). Pad-ON session 1
(eval-2026-07-06-97a18895) cleared the frozen §7.4 instrument-
precondition gate: superego disapproved on ALL 4 turns → 4 recognition
moments, consolidated (column == raw count == 4), content quoting the
session's actual math — the A1 empty-channel gap is CLOSED. Full arc
(6/6 sessions clean, 24 turns, ~$0.27, pad-ON runs
97a18895/6966c1d5/d5652c5f, pad-OFF 51a74faa/cd3e0002/ff4d35db):
validity gate PASS (current-reference 2/3 both arms — session-3 miss is
a symmetric marker-phrasing near-miss, recorded not re-scored);
adaptation signal NULL (stale-reference 0/2 both arms, gap 0) — now
against a demonstrably content-carrying pad (10 moments, 4+3+3), so the
null upgrades from A1's "channel was empty" to "channel carried content
and none of it surfaced in opening-turn temporal anchoring either way";
no structural red flag. Deviation note recorded: multi-turn path gives
pad-OFF sessions fresh per-dialogue synthetic pads (within-session
moments 4/0/1, never consolidated/reused) — cross-session channel still
cleanly absent, arms within-session MORE symmetric than A1. Bounded
next-step reading: a scaled design needs a constructive-use outcome
channel (continuity acknowledgment, resolved-misconception handling),
not just stale-vocabulary leakage. STOP per §7.4/§7.6 — nothing further
authorized; scaling requires a fresh prereg + go. Artifacts:
exports/longitudinal-drift-stage-a2.{json,md}.
