---
id: longitudinal-drift-adaptation
title: Longitudinal drift adaptation (cross-session memory as new signal)
status: review
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-06
updated: 2026-07-07
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

2026-07-07 Claude: Stage A3 pre-registration frozen and committed
(`notes/2026-07-06-longitudinal-drift-adaptation-prereg.md` §8), per a
user go covering both this line and Line B's B3. CRITICAL PRECONDITION
resolved first, at code level: Writing Pad content never reaches the
cell_40/93 tutor prompt, via three distinct, independently-diagnosed
breakages, all rooted in one orphaned module
(`tutor-core/services/recognitionOrchestrator.js`, confirmed zero
callers from the real request path): (1) `unconscious.permanentTraces`
(A2's 10 real moments) — `runMemoryCycle`'s end-of-dialogue
`retrieveUnconsciousContext` call (`tutorDialogueEngine.js:3172`) IS
made, but the result (`operations.contextRetrieval`) is computed and
then never read or persisted one line later — a genuine
retrieve-then-discard; (2) `preconscious.recentPatterns` — the
promotion pipeline runs every turn but its input,
`detectPatternsFromConscious`, reads `conscious.workingThoughts`, whose
sole writer (`writingPadService.updateConscious`) is called only from
the orphaned module, so it always sees zero patterns; (3)
`unconscious.learnerArchetype` (read directly into the superego prompt)
— `dialecticalEngine.negotiateDialectically` does call
`evolveLearnerArchetype` on the real path and does persist a DB write,
but its input (`getLearnerEvents`) is fed only by the orphaned module's
`recordLearnerEvent`, so every evolution computes over zero events and
persists the same empty defaults. Verdict: injection is BROKEN, not
absent — three genuine attempts exist, each fails for a specific,
now-precisely-located reason. A2's stale-reference null is reinterpreted
as an instrument-gap finding, not a tutor-behavior finding (A2's own
§7.7 hedging is now sharpened, not overturned — the model could not have
surfaced prior-session content under any behavior, since no code path
ever placed it in the prompt). Design: rather than patch tutor-core's
internal channels, A3 reuses the already-proven EXTERNAL injection
channel (`--external-ego-extension-file` → `systemPromptExtension`,
prepended to the ego prompt in `egoGenerateSuggestions`), sourcing new
content from a new `services/writingPadNarrativeBuilder.js` module that
reads `unconscious.permanentTraces` directly (bypassing all three broken
internal channels) — explicitly reusing only the plumbing of the
separate, already-null rich-memory experiment, not its store or its
finding. New primary outcome ("constructive continuity"): two new
deterministic checkers land in `services/longitudinalDriftChecker.js`
— continuity-acknowledgment (resolution-register phrases matched
against session-2/3 openings) and resolved-misconception-not-retaught
(fixed re-teaching-as-new marker list not landing near a resolved
misconception token) — scored as a 4-slot count (2 sessions × 2
checkers). Frozen gates: hermetic injection-precondition check must PASS
before any paid session; constructive signal = pad-ON ≥2/4 AND pad-OFF
0/4 (directional-only at this n); any pad-OFF hit is a red flag. Stage
A3-build (no-paid: narrative builder, checker extensions, hermetic
injection-path proof, unit tests) precedes the live pilot.

2026-07-07 Claude: Stage A3-build complete and green, with a fourth
breakage found and fixed along the way (logged in full in the prereg
note's §8.8). Building `services/writingPadNarrativeBuilder.js` surfaced
that `unconscious.permanentTraces` — the one field §8.1 confirmed A2's
10 moments actually populated — also never carried usable content on the
real path: `tutor-core/services/writingPadService.js`'s
`getRecognitionMoment`/`getRecognitionMoments` both drop the
`synthesis_resolution` column from their returned objects, so
`settleToUnconscious`'s `synthesis: recognitionMoment.synthesis_resolution`
read always saw `undefined`. Confirmed on real production data (the A2
pad, `a2-drift-padon-v1-2026-07-06`): all 10 real `permanentTraces`
entries have no `synthesis` key. Fix: an additive, read-only raw-SQL
lookup by the trace's own `.id` (which does survive intact) directly
against `recognition_moments.synthesis_resolution`, added to
`writingPadNarrativeBuilder.js` only — zero changes inside
`tutor-core/**`, consistent with §8.3's injection-not-internal-repair
design. Re-run against the real A2 pad post-fix: a real 1819-character
narrative, not null. Gate results: 38/38 unit tests green
(`writingPadNarrativeBuilder.test.js` new, `longitudinalDriftChecker.test.js`
+13 cases for the two new checkers/aggregator), hermetic
`scripts/report-longitudinal-drift-stage-a3.js --check` PASSED both
halves (narrative surfaces a real consolidated moment's text; a real
`runEvaluation()` call with `externalEgoExtension` set puts the seeded
marker in the captured outgoing ego request body — the injection chain
is live end-to-end on `cell_40`/the real drift scenario, not just
plausible from a code read), lint/prettier clean. Stage A3-pilot (6
sessions, ~$0.30) follows next; still no scaling beyond that without a
fresh pre-registration.

2026-07-07 Claude: Stage A3-pilot executed and scored — 6/6 sessions
clean ($0.293 total). Precondition CONFIRMED live (not just
hermetically): pad-ON session 2's dialogue log has 8/12 `apiPayload`
entries carrying the literal injected session-1 fraction "1/4 + 1/6",
from the first ego-generate call onward; cumulative cross-session
markers ("1/4 + 1/6": 16/16 pad-ON s2/s3 vs 0/0 pad-OFF; session-2
vocabulary in session-3, where session 3's own topic is unrelated:
2/8 pad-ON vs 0/0 pad-OFF) confirm the fix holds through both injected
sessions. Frozen §8.5 "4-slot" aggregate: pad-ON 2/4, pad-OFF 2/4 —
**constructive-signal gate FAIL** (pad-OFF must be 0/4). Red flag
(pad-OFF non-zero) investigated, not glossed: the misconception-
not-retaught checker structurally defaults to HIT when none of its six
fixed "reteach as new" phrases appear, which is true of all 4 scored
opening texts in both arms (verified by reading them directly) — a
checker-ceiling artifact, not leakage. A coarse "2:3" grep hit in
pad-OFF's session-3 log was checked and is a timestamp-substring
coincidence, not ratio content; no genuine cross-session marker was
found anywhere in pad-OFF. Continuity-acknowledgment is a clean 0/2 null
in both arms — not ceiling-biased like the other checker — and is the
pilot's one real behavioral finding: even with prior-session content
demonstrably reaching the model's context, the tutor's delivered opening
line never carries an explicit "last time we..." callback. Sharpens §8.2:
A2's stale-reference null stays an instrument-gap finding (unaffected),
but A3's continuity null is the first in this lineage read as being
about tutor behavior rather than broken plumbing. Bounded: directional
only at n=3 sessions/arm; fixing the internal Writing Pad channels or a
confirmatory continuity design are both separately-scoped, not
authorized here. STOP per §8.5/§8.7 — nothing further without a fresh
pre-registration.
