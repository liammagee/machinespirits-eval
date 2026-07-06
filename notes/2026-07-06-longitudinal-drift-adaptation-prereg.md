# Longitudinal Drift Adaptation — Pre-Registration (Line A)

Status: frozen pre-registration, 2026-07-06 (user-sanctioned). Scope of this
go: **Stage A0 (no-paid build) and Stage A1 (small paid pilot, ~8-10 rows)
are BOTH authorized by the recorded go this note implements.** Anything
larger — a confirmatory matrix, additional learner-ids or sessions, more
arms, a different model stack — requires a fresh pre-registration and its
own recorded go, per the standing "no third bite" discipline this arc
inherits from the DAG-pinned-learner precedent. Companions:
`notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md` +
`notes/2026-07-04-desubstitution-confirmatory-prereg.md` (house style and
frozen-threshold discipline copied from these), `services/learnerInteriorGate.js`
(word-bounded matching primitive reused directly), `docs/research/paper-full-2.0.md`
§6.6.11 (cross-session ego pre-alignment, +1.31/session — the one positive
longitudinal finding this line probes further) and §7.11/§6.14 (the
substitution reading this line is designed to test at a different signal
source).

## 1. Motivation: the only positive trajectory effect is cross-session

The paper's substitution family (§6.4, §6.8.6, §7.9, §6.14, §7.11) reads
within-dialogue tutor adaptation as null or substituted almost everywhere:
instructions converge on the model's existing competence, and multiple
tutor mechanisms produce statistically indistinguishable outcomes against
a single-session learner. The one standing exception is §6.6.11's
cross-session ego pre-alignment result (+1.31/session) — a positive
trajectory effect that only appears when state persists *between* sessions
via the Writing Pad, not within one. Read together with the DAG-pinned
learner arc's now-closed finding (confirmatory C-series, both H-Dc/H-Oc
DISSOLVED — architecturally distinct tutors ground a criterially resistant
learner at an identical rate), the working hypothesis this note freezes is:

**adaptation gains require signal the model lacks in-context; cross-session
drift is a candidate source of exactly that signal**, because the tutor
cannot infer session-N's state from session-N's own prompt alone — it can
only get it from (a) what the session's own context states directly, or
(b) what persisted memory carries over from session N−1. Line A isolates
signal source (b) specifically, and asks a narrow, deterministic question:
when a learner's state drifts between sessions on a schedule the tutor
never sees directly, does persisted memory (Writing Pad ON) cause the
tutor's next-session opening turn to track the *current* state, the *stale*
prior state, or neither? This is not a claim about learning outcomes — it
is a claim about whether a memory channel causes measurable temporal
anchoring at all, positive or negative.

## 2. Design

### 2.1 Arms — reusing the existing §6.6.9 Writing Pad ablation pair unchanged

No new tutor-agents.yaml cells. Line A reuses the existing byte-identical
ablation pair from `config/tutor-agents.yaml` directly, exactly as the
DAG-pinned-learner arc reused cells 186/193/199 rather than cloning new
variants (Stage 0 implementation log, §7 deviation note):

| Arm | Cell | `writing_pad_enabled` | Everything else |
|---|---|---|---|
| Pad ON | `cell_40_base_dialectical_suspicious_unified_superego` | `true` | identical |
| Pad OFF | `cell_93_base_dialectical_suspicious_unified_superego_nopad` | `false` | identical |

Both cells: `factors.prompt_type: dialectical_suspicious`,
`multi_agent_tutor: true`, `superego_type: suspicious`,
`learner_architecture: unified` (scripted/prose-context learner — no
learner-side model is invoked at all, so no learner-side confound enters
this design), `dialogue: {enabled: true, max_rounds: 1}`. Model stack:
**`codex.gpt-5.5` for both ego and superego**, via
`--ego-model codex.gpt-5.5 --superego-model codex.gpt-5.5` CLI overrides at
run time (the cells' own YAML keeps its default OpenRouter models
unchanged; overriding at the CLI layer is the same pattern the DAG-pinned
arc used to avoid duplicating cell configs). This is the established
Codex-subscription-quota stack used throughout the adjacent desub/C-series
work.

Two distinct `--learner-id` values are used — one per arm — even though
`cell_93` (pad OFF) should never touch the `writing_pads` table at all: this
removes any possibility of cross-arm interaction through the pad store as a
design decision, not a discovered necessity.

### 2.2 Harness-owned drift schedule (the tutor never sees this file)

Three new scenarios — `longitudinal_drift_session_1`, `_session_2`,
`_session_3` — appended to `config/suggestion-scenarios.yaml` (the default
scenario file; no `EVAL_SCENARIOS_FILE` override needed, unlike the
desub arc's dedicated file, because these coexist with the standard
suggestion scenarios rather than replacing them). Each scenario carries the
ordinary `learner_context` prose (stating that session's topic and a
"recent difficulty" pattern in natural language) **and** a
`longitudinal_drift` metadata block read directly by the new checker
service, mirroring exactly how `formal_interior` rides on
desub-scenario objects for `loadFormalInterior`:

```yaml
longitudinal_drift:
  schedule_id: drift_schedule_v1
  session_index: 1            # 1, 2, or 3
  current_interest: "fractions"
  interest_markers: ["fraction", "fractions", "numerator", "denominator"]
  active_misconception:
    token: "LDS-M1"            # invented, harness-owned, globally unique
    label: "common-denominator-by-multiplying"
    markers: ["LDS-M1", "common denominator", "multiply the denominators"]
  resolved_last_session: null  # session 1 has no prior session
```

Session 2 names `current_interest: "ratios"` /
`active_misconception.token: "LDS-M2"` and sets
`resolved_last_session: true` (its `learner_context` prose states plainly
that last session's fractions difficulty was resolved). Session 3 names
`current_interest: "linear equations"` / `token: "LDS-M3"`, also
`resolved_last_session: true`. All nine marker phrases plus three tokens
are globally unique strings, chosen so no session's vocabulary overlaps
another's (this is what makes stale-vs-current attribution unambiguous).

The schedule is **harness-owned**: the tutor is shown only the current
session's own `learner_context` prose (as ordinary tutoring content, not
labelled as "the schedule"); it has no visibility into session N+1 or into
the schedule file itself. Any cross-session tracking the tutor exhibits can
only come from what persisted in the Writing Pad from a prior invocation
with the same `--learner-id`.

### 2.3 Primary outcome (deterministic, judge-free, architecture-independent)

For each session-N generation, the tutor's output text (the `suggestions`
field) is scored by `services/longitudinalDriftChecker.js` against the
schedule using **word-bounded matching only** — `wordBounded` /
`containsAny` imported directly from `services/learnerInteriorGate.js`
(now exported for reuse; no reimplementation, no drift from the
cue-repair Goodhart lesson that primitive already encodes):

- **current-reference**: does the output contain any of session N's
  `interest_markers` or `active_misconception.markers`/`token`?
- **stale-reference**: does the output contain any of session (N−1)'s
  markers/token, computed as a **set difference** against session N's own
  markers (defensive de-duplication; by construction here the two
  sessions' vocabularies are already disjoint)? Undefined (excluded, not
  scored `false`) for session 1, which has no predecessor.

No judge model participates in this decision path at any point. This
satisfies the architecture-independent scoring requirement standing across
this whole research programme: neither arm's own machinery (the Writing
Pad, the dialectical superego, anything model-generated) is used to score
itself.

### 2.4 Token-cap check (frozen procedure, decided before the cap is used in Line A's main rows)

Constraint: cap the tutor ego's `max_tokens` where it does not harm
quality — verified in a pilot, not assumed. Procedure (run **before** the
6 main drift rows, on a separate `--learner-id` so it never touches the
drift arc's pad state):

1. Two generic, already-existing scenarios (`new_user_first_visit`,
   `returning_user_mid_course`) × 2 conditions (`--max-tokens 700` vs
   uncapped/default `8000`) × 1 repeat, on the pad-ON cell
   (`cell_40_base_dialectical_suspicious_unified_superego`,
   `codex.gpt-5.5` ego/superego) = 4 rows.
2. Judge with `eval-cli.js evaluate` (v2.2 rubric, Sonnet default judge);
   compare mean `tutor_first_turn_score` capped vs uncapped.
3. **Frozen decision rule** (one-shot, no iteration beyond the stated
   fallback): accept **700** as the frozen cap if the capped mean is
   within **5 points** of the uncapped mean. If it drops by more than 5
   points, try **1400** once (no fresh generation needed beyond a second
   capped pair at the same 2 scenarios = 2 more rows, 6 total for the cap
   check) and accept 1400 under the same 5-point tolerance. If 1400 also
   fails the tolerance, the main 6-row drift arc runs **uncapped**, and
   token cost is recorded as an open limitation rather than iterated
   further — this check does not get a third bite.

### 2.5 Stage A1 pilot design (frozen, ~8-10 rows total)

- **Cap check**: 4 rows (or 6 if the 1400 fallback is exercised) as in §2.4.
- **Main drift-tracking rows**: 3 sessions × 2 arms = **6 rows**, run under
  whatever cap §2.4 freezes, each arm using its own dedicated
  `--learner-id`, sessions run strictly in order 1→2→3 per arm (order
  matters — this is the whole point).
- Total: **10 rows** if the cap check needs only its first 4-row pass
  (expected case), consistent with the "~8-10 short dialogues total"
  authorization.

## 3. Frozen decision thresholds and stop rules

Stage A1 runs a single learner-id trajectory per arm (n=3 sessions/arm).
This is explicitly **an instrument-validation pilot, not a powered
confirmatory test** — the frozen bars below gate whether the *instrument*
works (can the checker detect current/stale reference at all; is there a
degenerate floor problem), not whether pad-on truly beats pad-off in the
population sense. A confirmatory design at meaningful n is a distinct
future decision, explicitly **not** authorized by this note.

- **Instrument validity gate (must pass before any interpretation)**:
  current-reference hit rate ≥ 2/3 in **at least one** arm. This proves
  the tutor can pick up session-local content and the checker can detect
  it when present. If current-reference is 0/3 in **both** arms, the
  result is **INSTRUMENT_FLOOR** — recorded as a checker/vocabulary defect,
  not a pad-on/pad-off finding, and no further paid rows run without a
  fresh design iteration and go.
- **Stale-reference reading (directional only, not adjudicated real/dissolved
  at this n)**: pad-on stale-reference rate minus pad-off stale-reference
  rate is reported as a raw gap out of 2 comparable sessions per arm
  (session 1 has no predecessor and is excluded from this comparison).
  Any gap is recorded descriptively; this note explicitly does **not**
  license a real/dissolved verdict at n=2 comparable sessions per arm.
- **Structural red flag**: a nonzero pad-OFF stale-reference rate is
  flagged for investigation (possible prompt leakage, cross-scenario
  contamination, or the model's own prior/general knowledge bleeding in),
  **not** treated as a positive finding — pad-off has no persistence
  mechanism, so nothing should structurally produce a stale hit there.
- **Cap-check gate**: per §2.4's one-shot procedure; if both 700 and 1400
  fail the 5-point tolerance, the pilot runs uncapped and this is recorded
  as a limitation, not re-iterated.
- **Row-level instrument failure**: a row with a generation error, an
  empty/malformed tutor output, or a schedule/scenario validation error
  (missing required `longitudinal_drift` fields) is excluded from both
  reference-rate denominators and reported separately — mirroring the
  desub arc's exhaustion-as-instrument-failure semantics exactly. If more
  than 1 of the 6 main rows (>~17%, the closest single-row-sensitive analog
  to the desub arc's >20% freeze guard at this much smaller n) is an
  instrument failure, the pilot's result is reported as
  instrument-failure-affected rather than adjudicated.
- **Stop rule**: if Stage A0's no-paid gate does not pass clean, Stage A1
  does not run. If Stage A1 hits INSTRUMENT_FLOOR, STOP — no additional
  paid rows without a fresh pre-registration. Under any outcome, this note
  authorizes no rows beyond the ~10 specified in §2.5; scaling to a
  confirmatory design is a distinct, separately pre-registered decision.

## 4. Circularity, scope, and limits

- **Current-reference is expected to be high in both arms almost by
  construction** — the session's own `learner_context` states its topic in
  plain language, and a reasonable tutor mentions what is actually in
  front of it regardless of any memory mechanism. This is reported as a
  floor/sanity check on the instrument, **not** the interesting contrast.
- **Stale-reference is the actual test.** Only the pad-ON arm has any
  structural channel by which session N−1's vocabulary could appear in
  session N's output (persisted Writing Pad content); pad-OFF has no such
  channel, so pad-OFF's stale-reference rate is a control, not an outcome
  — see the "structural red flag" bar in §3.
- **Two marker classes, different confound risk**: the invented
  misconception tokens (`LDS-M1/M2/M3`) are harness-owned nonsense-strings
  that cannot appear for any reason other than genuine cross-session
  tracking (or copy-paste of the instructor material). The natural-language
  `interest_markers` (e.g. "fractions", "ratios") are ordinary curriculum
  words a tutor might produce for reasons having nothing to do with memory
  (general topical relevance, the model's own curriculum instincts). Both
  are reported, but the token-level marker is the load-bearing,
  lower-confound signal; the natural-language marker is a noisier
  secondary read.
- **Learner-side scope**: `learner_architecture: unified` means there is no
  dynamic learner turn anywhere in this design — Line A tests only whether
  the *tutor's* generation is conditioned by persisted memory across
  scripted, harness-authored session contexts. No claim about learner-side
  adaptation, real human learners, or bilateral transformation follows from
  any outcome here.
- **Single learner-id trajectory per arm**: n=3 sessions is not a
  population sample; it cannot support a claim generalizing beyond this
  specific schedule and this specific model stack.
- **Architecture-independent scoring**: satisfied — pure word-bounded
  regex matching, the same primitive the DAG-pinned-learner instrument
  uses, with no judge and no arm-specific machinery anywhere in the
  decision path.
- **Exhaustion-as-instrument-failure semantics**: inherited directly from
  the DAG-pinned-learner precedent (§3, row-level instrument failure) —
  failure of the *instrument* (generation error, malformed schedule
  fields) is never scored as a substantive result for either arm.
- **Not licensed under any outcome**: human-learning claims; claims about
  registers, charisma, or any rubric outside this checker; any paper
  edit (this note's outcome, whatever it is, is recorded here and in the
  companion workplan card only — folding it into
  `docs/research/paper-full-2.0.md` is a separate future decision, not
  authorized now); scaling to more learner-ids, more sessions, more arms,
  or a different model stack without a fresh pre-registration.

## 5. Stages and gates

- **Stage A0 (no-paid, this go)**: three drift-schedule scenarios in
  `config/suggestion-scenarios.yaml`; `services/longitudinalDriftChecker.js`
  (schedule/session-window loading, `scoreOpeningTurn`, aggregate
  reporting) reusing `wordBounded`/`containsAny` from
  `learnerInteriorGate.js`; unit tests; `scripts/report-longitudinal-drift-stage0.js
  --check` (validates the three scenarios resolve with well-formed
  `longitudinal_drift` blocks, and exercises the checker against synthetic
  fixture messages covering all four current×stale combinations, entirely
  without any paid call). Gate: tests green, stage-0 `--check` green,
  lint/prettier clean on touched files.
- **Stage A1 (small paid pilot, authorized by this go)**: the ~10-row
  design in §2.4-2.5. Gate: per §3's frozen thresholds.
- **Anything beyond Stage A1**: requires a fresh pre-registration and its
  own recorded go, per §3's stop rule and the standing no-scaling
  discipline for this arc.

## 6. Implementation log

**2026-07-06: Pre-registration frozen and committed.** Nothing built yet;
Stage A0 build follows in the same commit boundary as this note (per the
task's execution order, Stage A0/B0 land alongside both preregs and the
workplan cards, ahead of the no-paid gate and the pilots).

**2026-07-06: Stage A0 complete; no-paid gate green.** Three schedule
scenarios (`category: longitudinal_drift`, so they never leak into
category-filtered standard suites), `services/longitudinalDriftChecker.js`,
11 unit tests, `report-longitudinal-drift-stage0.js --check` green,
`validate-config` 0 errors, full suite 4989/4990 (1 pre-existing skip),
lint/prettier clean. Committed at the Stage A0/B0 boundary.

**2026-07-06: DEVIATION (recorded before any paid row): executed model
stack is the cells' native OpenRouter stack, not `codex.gpt-5.5`.**
§2.1 froze `codex.gpt-5.5` for ego+superego via CLI overrides, on the
belief the desub arc had already driven tutor-core's dialogue engine
through the CLI-provider bridge. Verified false at execution time: the
desub cells (186/193/199) are **id-director** cells, whose engine
(`services/idDirectorEngine.js`) imports `callAIWithCliBridge`; the
standard-runner path used by cells 40/93
(`tutorApi.generateSuggestions` → `tutorDialogueEngine._fetchProvider`)
supports only HTTP providers (anthropic/openai/openrouter/gemini/local/
lmstudio) and has no injection hook. This is the long-standing
"bridge doesn't reach tutor-core dialogue engine" boundary, re-confirmed
by direct read. Resolution: both arms run on the cells' own, unmodified
YAML stack — **nemotron ego + kimi-k2.5 superego (OpenRouter)** — which
remains byte-identical across arms, so the pad-on/pad-off contrast is
untouched; the codex choice was quota economics, never part of the
contrast. `--max-tokens` IS honored on the OpenRouter path
(`_fetchProvider` request body), so the §2.4 cap check stays meaningful.
Wiring the CLI bridge into tutor-core would break the one-way
tutor-core seam and is out of scope for this go. Cap-check judging uses
`--judge-cli claude` (Sonnet-class, subscription-quota) per the
established claude-code judge routing.

**2026-07-06: Stage A1 executed. Cap-check verdict, a VOID first main
pass (two instrument defects found and fixed), a corrected main pass,
and the frozen-gate verdicts.** Full sequence, in order:

1. **Cap check (§2.4)** — runs `eval-2026-07-06-ee9bde25` (700),
   `eval-2026-07-06-7b1eef19` (uncapped), `eval-2026-07-06-888bd193`
   (1400 fallback), 2 scenarios each, judged `--judge-cli claude`
   (claude-code/sonnet, v2.2): **700 = catastrophic failure** (both rows
   empty `[]` — the cap starves nemotron's reasoning before any final
   output; not even scoreable, trivially outside the 5-point tolerance).
   **1400 passed the frozen quality tolerance** (capped mean 23.75 vs
   uncapped 23.13 first-turn, +0.62, well within 5 points).
2. **First main pass (6 rows, cap 1400) = VOID, two instrument
   defects.** (a) 3/6 rows empty — the 1400 cap that was
   quality-tolerant on the generic cap-check scenarios is operationally
   broken on the longer drift scenarios (>1/6 rows, i.e.
   instrument-failure-affected per §3 on its own). (b) Far more
   important: **the Writing Pad was never engaged at all** — zero
   `writing_pads` rows for any learner-id. Root cause: `--learner-id`
   reached only the DB result row on *single-turn* scenarios
   (`runSingleTurnTest` did not forward `learnerId` into
   `generateAndEvaluateTurn`; its own comment said "passes through to
   result row only"). The multi-turn path (which the A7 arc used) does
   forward it — these drift scenarios are single-turn, so the
   manipulated variable (pad) never existed in the first pass. Both
   defects are instrument failures in §3's sense; the pass is VOID, not
   data. Rows kept in the DB for provenance
   (`eval-2026-07-06-{c3958bda,2b59cc81,1f6f3349,f9c8af5e,5dfd12f9,f02ebb17}`).
3. **Fixes.** One-line runner change forwarding `learnerId` in
   `runSingleTurnTest` (mirrors `runMultiTurnTest` exactly); verified
   end-to-end with a hermetic one-row probe (temp `EVAL_DB_PATH` +
   `AUTH_DB_PATH`; pad row created, real output; `--dry-run` cannot
   exercise this path since it short-circuits before `runDialogue`).
   Discovered along the way: the YAML `writing_pad_enabled` flag is
   read by **no runtime code** (only an analysis script) — pad-on/off
   is operationalized entirely by supplying `--learner-id` or not.
   **Second deviation from §2.1 recorded**: the pad-OFF arm runs with
   NO `--learner-id` (rather than its own id), which achieves §2.1's
   stated intent ("cell_93 should never touch the writing_pads table")
   exactly, whereas an id on the fixed wiring would have created a pad
   for the pad-OFF arm too. Cap decision for the corrected pass: per
   §2.4's terminal branch, the main arc runs **uncapped** (700
   catastrophic; 1400 passed tolerance on generic scenarios but empties
   half the drift rows; the check does not get a third bite) — token
   cost recorded as an open limitation.
4. **Corrected main pass (6 rows, uncapped, wiring fixed)**: pad-ON =
   cell_40 + `--learner-id a1-drift-padon-v2-2026-07-06`
   (`eval-2026-07-06-{5673b4bb,191b2ac3,93f5d964}`), pad-OFF = cell_93,
   no learner-id (`eval-2026-07-06-{163dfdb8,eeb8e9ab,8a151532}`),
   sessions strictly 1→2→3 per arm. **0/6 instrument failures.**
   Exactly one `writing_pads` row existed after the pad-ON arc (created
   session 1, reused sessions 2-3, `updated_at > created_at`) and none
   for pad-OFF — the A7 plumbing criteria.
5. **Results against the frozen §3 gates** (checker =
   `longitudinalDriftChecker.scoreOpeningTurn` on the stored
   `suggestions` field, the frozen literal reading; the learner-visible
   title+message-only sub-reading is reported secondarily and changes
   no verdict):
   - **Instrument validity gate: PASS.** Current-reference pad-ON 3/3,
     pad-OFF 2/3 (literal reading; 2/3 and 2/3 on the learner-visible
     reading) — ≥2/3 in at least one arm, comfortably; not
     INSTRUMENT_FLOOR.
   - **Stale-reference (directional, not adjudicated at this n)**:
     pad-ON 0/2, pad-OFF 0/2 — **gap 0**. No temporal anchoring signal
     in either direction.
   - **Structural red flag: none** (pad-OFF stale-reference 0, as it
     structurally must be).
   - **Row-level instrument failures in the adjudicated pass: 0/6.**
6. **The load-bearing qualifier on the stale-0 result**: the pad-ON
   pad row persisted and was updated across sessions, but its content
   layers stayed empty scaffold (conscious `workingThoughts: []`,
   preconscious `recentPatterns: []`, `total_recognition_moments: 0`).
   Recognition moments are content-driven and none fire in short
   single-turn suggestion sessions — so the persistence *channel*
   existed but carried no session-specific *content*, and no stale
   vocabulary could have surfaced through it. The corrected pilot
   therefore validates the instrument (schedule, checker, gates, arm
   wiring) and surfaces a mechanism precondition: **a confirmatory
   design needs sessions that actually feed the pad's content layers**
   (multi-turn sessions, or an explicit pad-content injection check)
   before pad-on-vs-pad-off stale-tracking is a live contrast. This is
   an instrument finding, not an adaptation finding.

**STOP per §3/§5: Stage A1 is complete and this note authorizes nothing
further.** Rows consumed: 6 cap-check + 6 void + 1 hermetic wiring probe
+ 6 corrected = 19 tutor generations plus 4 judged rows, all on the
cheap OpenRouter stack (nemotron/kimi-k2.5) — the void pass and probe
are instrument-failure/plumbing overhead documented above, not design
scaling. Anything beyond (a powered confirmatory design, multi-turn
pad-feeding sessions, more learner-ids/arms/model stacks) requires a
fresh pre-registration and recorded go.

## 7. Stage A2 — pad-feeding drift arc (fresh pre-registration, frozen before spend)

This section is itself the fresh pre-registration Stage A1's STOP line
required. It addresses the one precondition A1 surfaced — the pad
persisted but stayed content-empty — and authorizes **only** the rows
enumerated in §7.2/§7.6, nothing further. Everything in §1, §2.1-2.2
(arms, cell pairing, harness-owned schedule content) and the general
house discipline in §3-§5 carries forward unchanged except where this
section explicitly says otherwise.

### 7.1 Rationale: closing the precondition gap, precisely

Stage A1's own implementation log (§6, point 6) already named the gap:
"Recognition moments are content-driven and none fire in short
single-turn suggestion sessions — so the persistence channel existed but
carried no session-specific content." This go re-verified the mechanism
behind that finding directly against `config/tutor-agents.yaml` and
`tutor-core/services/{tutorDialogueEngine,dialecticalEngine,
writingPadService,memoryDynamicsService,dbService}.js` (confirmed
byte-identical to the copies used for A0/A1) plus the live A1 database
(`tutor-core/data/lms.sqlite`), rather than re-assuming the A1-era
summary of it:

- Both `cell_40`/`cell_93` set `dialectical_negotiation: true`
  (`config/tutor-agents.yaml`), which routes ego generation through
  `tutorDialogueEngine.js`'s "Phase 2" branch
  (`egoGenerateSuggestions`, `if (dialecticalNegotiation)`) into
  `dialecticalEngine.negotiateDialectically(...)` — **not** the older
  in-memory "Phase 0/1" `recordRecognitionMoment` path elsewhere in the
  same file, which only runs for cells that leave `dialectical_negotiation`
  unset/false. This is the exact path both A1 arms already ran; nothing
  about it changes for A2.
- `negotiateDialectically` calls a real `generateSuperegoCritique` LLM
  call **once per turn**. If the superego does not disapprove of that
  turn's ego suggestion, the function returns immediately with
  `recognitionMoment: null` — **no row is written to `recognition_moments`
  at all for that turn.** Only when the superego disapproves does the
  function proceed to negotiation rounds and, at its final step (gated on
  `learnerId && writingPad`), call
  `writingPadService.createRecognitionMoment({...})` — which inserts
  exactly one `recognition_moments` row.
- Writing that row does **not** by itself update
  `writing_pads.total_recognition_moments`. That column is only
  incremented later, by `settleToUnconscious`, invoked from
  `memoryDynamicsService.autoConsolidateToUnconscious`, invoked from
  `runBackgroundMaintenance`. `services/evaluationRunner.js` already
  calls `runBackgroundMaintenance(learnerId, {consolidation: {minAge: 0,
  requireTransformative: false}})` unconditionally whenever `learnerId`
  is set, once per `runSingleTest` call (i.e. once per session, after all
  of that session's turns complete) — the in-repo comment at that call
  site (`services/evaluationRunner.js`, ~L2830) states its purpose
  directly: "makes the pad's permanent_traces / total_recognition_moments
  counter visible to the *next* session under the same learner_id." No
  new code is needed for A2 to benefit from this — it is already what A1
  ran, and it is why a plumbing check can be hermetic (§7.6) even though
  the live behavioral question (does the superego actually disapprove
  often enough to produce a nonzero count) cannot be.
- Querying the live A1 database directly confirms the A1 finding at the
  most literal level: `recognition_moments` has **zero rows total**
  (not merely a zero `total_recognition_moments` column) — across all
  3 pad-ON single-turn sessions, the superego never disapproved even
  once. This is a real empirical fact about this model stack's behavior
  on single-turn sessions, not a structural impossibility — disapproval
  comes from a genuine LLM judgment call (`generateSuperegoCritique`),
  not a scripted or random gate. Multi-turn sessions give this call
  several independent per-turn chances instead of one, which is the
  entire mechanism A2 leans on — but it is not guaranteed, which is
  exactly why §7.4's live, checked-before-continuing gate exists rather
  than treating "more turns" as a foregone conclusion.
- `conscious_state`/`preconscious_state` remain structurally unreachable
  regardless of session length, confirmed again this go:
  `pad.conscious.workingThoughts` is written only by a function
  (`updateConscious`) with no caller anywhere on the cell_40/93 request
  path. The task's original gate wording ("recognition moments ≥1 OR
  conscious_state populated") therefore reduces, for this architecture,
  to the recognition-moments count alone — stated explicitly here so it
  is never re-derived or misremembered later.
- What the resulting trace can and cannot show (schema-verified against
  `tutor-core/migrations/008_writing_pad_schema.sql` and the live DB):
  `createRecognitionMoment`'s actual write only ever populates
  `thesis_agent` (hardcoded `'superego'`), `thesis_position`
  (= the superego's critique voice), `antithesis_agent` (hardcoded
  `'learner'`), `antithesis_position` (an inferred learner-need label,
  not verbatim ego text), `synthesis_resolution`/`synthesis_strategy`
  (a coarse strategy tag), and `transformative` (boolean). Columns such
  as `thesis_reasoning`, `ego_transformation`, `superego_transformation`,
  `learner_insight`, `mutual_acknowledgment`, `recognition_type`,
  `struggle_depth`, `dialogue_trace`, and `learner_context` are accepted
  by the caller's object literal but silently dropped by the current
  `createRecognitionMoment` implementation (confirmed by direct read of
  both the call site and the function body) — no current code path
  populates them. The §7.3 secondary trace is reported at exactly this
  resolution: a critique voice, an inferred need label, a strategy tag,
  and a boolean — not a full ego-superego dialogue transcript.

### 7.2 Design

Unchanged from §2.1-2.2 except as stated:

- **Arms**: identical cell pairing (`cell_40_base_dialectical_suspicious_unified_superego`
  pad-ON / `cell_93_base_dialectical_suspicious_unified_superego_nopad`
  pad-OFF), identical model stack (nemotron ego / kimi-k2.5 superego,
  OpenRouter — the native stack A1's deviation log already established;
  the task's original `ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS` env var is
  inapplicable here and is not set — cell_40/93 are not id-director
  cells and never reach the CLI bridge, exactly as A1 recorded).
  New, distinct `--learner-id` values (not reused from A1): pad-ON
  `a2-drift-padon-v1-2026-07-06`, pad-OFF arm runs with **no**
  `--learner-id` (mirrors A1's corrected convention exactly).
- **Schedule content**: identical `longitudinal_drift` metadata and
  `learner_context` prose to the existing `longitudinal_drift_session_{1,2,3}`
  scenarios — same `schedule_id: drift_schedule_v1`, same three tokens
  (`LDS-M1`/`M2`/`M3`), same `interest_markers`/`active_misconception`
  blocks, same `resolved_last_session` flags. No new schedule vocabulary
  is introduced, so the existing checker's marker sets stay valid
  unchanged.
- **NEW — multi-turn wrapping**: three new sibling scenarios,
  `longitudinal_drift_session_{1,2,3}_multiturn` (new IDs; the original
  three single-turn scenarios are untouched and remain available for
  reuse), each carrying the same `longitudinal_drift` block as its
  single-turn sibling plus a `turns:` array of **3 scripted follow-up
  turns** (giving 4 turns per session total: 1 opening + 3 follow-ups —
  the upper end of the pre-authorized 3-4-turn / ~12-24-turn envelope,
  chosen deliberately to maximize the number of independent per-turn
  superego-disapproval draws per session, since that draw count is the
  entire mechanism this arc depends on per §7.1). Each follow-up turn
  stays on that session's own topic and misconception (no new tokens),
  giving the ego/superego repeated, on-topic opportunities across the
  session:
  - Session 1 (fractions / `LDS-M1`, common-denominator-by-multiplying):
    turn 1 reports trying 1/4 + 1/6 by multiplying denominators to 24;
    turn 2 reports trying 1/3 + 1/5 the same way (denominator 15); turn 3
    tries 1/2 + 1/4 (multiplying gives 8) and asks why the answer "looks
    bigger than it needs to be" — the most direct probe of the pattern.
  - Session 2 (ratios / `LDS-M2`, scaling-ratios-additively): turn 1
    reports scaling 2:3 by adding 2 to each side (4:5); turn 2 compares
    that to 4:6 (from doubling) and asks why they don't match; turn 3
    asks for "the rule" for scaling a ratio up in general.
  - Session 3 (linear equations / `LDS-M3`, flip-sign-forgetting): turn 1
    reports solving `-2x > 6` as `x > -3`; turn 2 checks by substituting
    `x = 0` and finds it doesn't satisfy that answer; turn 3 asks
    generally "when do you flip the sign."
  Each turn entry uses permissive rubric fields matching the parent
  scenarios' own convention (`required_elements: []`,
  `forbidden_elements: []`, `min_acceptable_score: 0`) so no unrelated
  v2.2 rubric dimension can gate this run — A2's only frozen outcome is
  the deterministic checker in §7.3.
- **Row count**: 3 sessions × 2 arms = **6 sessions**, each 4 turns = **24
  tutor generations total** (the top of the pre-authorized envelope,
  chosen for the reason above). Uncapped `max_tokens`, carried forward
  unchanged from A1's §2.4 terminal branch (not re-litigated here).
- **Execution order and checkpoint (frozen)**: pad-ON session 1 runs
  **alone, first**. Immediately after it completes, the §7.4
  instrument-precondition gate is checked against the live DB before
  anything else runs. Only on a PASS do pad-ON sessions 2-3 and the full
  pad-OFF arm (all 3 sessions) proceed, sessions strictly in order
  1→2→3 per arm exactly as A1 required.
- **Resumability**: each session is one `eval-cli.js run` invocation
  (one `runSingleTest` call handles that session's whole turn loop
  internally in-process). If a process is killed mid-session, the same
  scenario/`--learner-id` combination is simply re-run — a session either
  completed (row + pad state exist) or it didn't; there is no partial-turn
  resumption to manage.

### 7.3 Primary and secondary outcome

- **Primary (unchanged)**: `services/longitudinalDriftChecker.js`'s
  `scoreOpeningTurn`/`summarizeDriftRun`, applied to each session's
  **opening** turn only (`JSON.parse(suggestions)[0].message` for a
  multi-turn row — the same extraction A1 already used) — no code
  changes to the checker itself; it is a pure function over a message
  string and is fully reusable as-is.
- **Secondary (new) — pad-content trace**: after each pad-ON session,
  record from the live DB: `writing_pads.total_recognition_moments` for
  that learner-id, the raw `recognition_moments` row count for that pad
  (cross-checked against each other — a mismatch after the session's
  `runBackgroundMaintenance` call would itself flag a consolidation
  failure, since `evaluationRunner.js` logs but does not raise on that
  error), and, for any moments present, a plain-language rendering of
  `ghost_demand.voice` / `learner_need.need` / `synthesis_strategy` /
  `transformative`. Reported at exactly the resolution described in
  §7.1's last bullet — not a full dialogue transcript.

### 7.4 Frozen thresholds and stop rules

- **NEW instrument-precondition gate (checked live, after pad-ON session
  1 only, before anything else runs)**: the pad-ON learner-id's
  `writing_pads.total_recognition_moments` must be **≥ 1** (equivalently,
  its raw `recognition_moments` row count ≥ 1 — both are already
  settled by the time this check runs, since `runBackgroundMaintenance`
  fires at the end of every `runSingleTest` call before the CLI process
  returns). This operationalizes the task's original "recognition
  moments ≥1 OR conscious_state populated" gate; per §7.1,
  `conscious_state` is structurally unreachable on this architecture
  regardless of session length, so the gate reduces to the
  recognition-moments count alone. **If 0: verdict = INSTRUMENT_FLOOR.
  STOP — no session 2-3, no pad-OFF arm, no further rows under this
  section without a fresh design iteration and go.**
- **Primary-outcome validity gate (same spirit as §3, restated for the
  multi-turn opening turn)**: current-reference hit rate on session
  openings ≥ 2/3 in the pad-ON arm.
- **Adaptation signal (directional-report-only at this n — this pilot
  cannot confirm or refute, only license a scaled, separately
  pre-registered prereg)**: pad-ON stale-reference rate < pad-OFF
  stale-reference rate, with a gap ≥ 2/3 rows, is the pattern that would
  be *consistent with* a genuine cross-session adaptation signal. Stated
  explicitly: this note does not authorize treating any outcome at n=3
  sessions/arm as a real/dissolved verdict, exactly as §3 already
  established for A1 and this section does not relax.
- **Structural red flag**: carried forward unchanged from §3 — nonzero
  pad-OFF stale-reference rate is flagged, not treated as a finding.
- **Row/session-level instrument failure**: generation error, empty or
  malformed output, or schedule/scenario validation failure — excluded
  from denominators, reported separately, mirroring §3 exactly.
- **Stop rule**: if the Stage A2-build no-paid gate (§7.6) does not pass
  clean, A2 does not run live. If the session-1 instrument-precondition
  gate fails, STOP immediately. Under any outcome, this section
  authorizes no rows beyond the 6 sessions / 24 turns specified in §7.2;
  scaling to a confirmatory design remains a distinct, separately
  pre-registered future decision.

### 7.5 Scope and limits specific to A2

All of §4's limits carry forward unchanged (single learner-id trajectory
per arm; no learner-side dynamic model — `learner_architecture: unified`
throughout, including the new scripted follow-up turns; architecture-
independent, judge-free primary scoring; exhaustion-as-instrument-failure
semantics). In addition:

- **"Multi-turn" here means more scripted, harness-authored turns per
  session, not a richer or more realistic learner.** The follow-up turns
  are scripted exactly like the existing multi-turn suggestion scenarios
  elsewhere in `config/suggestion-scenarios.yaml` — they give the tutor's
  own per-turn dialectical mechanism more chances to fire, nothing more.
  This does not change or relax A1's learner-side scope limits.
- **A pass on §7.4's gate licenses this schedule/scenario wording and
  this model stack specifically, not "multi-turn sessions feed the pad"
  in general.** A different scenario design or model pairing could behave
  differently; no general claim follows from a pass.
- **A pass or fail on the session-1 gate is itself a substantive (if
  narrow) empirical result about this model stack's behavior**, worth
  recording regardless of what it licenses next — since superego
  disapproval is a genuine per-turn LLM judgment call (confirmed via
  direct code and config read, not a scripted or random gate), the gate
  is not a foregone conclusion either way.

### 7.6 Stages and gates

- **Stage A2-build (no-paid, this go)**: the three
  `longitudinal_drift_session_{1,2,3}_multiturn` scenarios in
  `config/suggestion-scenarios.yaml`; a hermetic plumbing-verification
  script (`scripts/report-longitudinal-drift-stage-a2.js`) that, against
  a temp `AUTH_DB_PATH` (so the real DB is never touched), directly
  exercises `writingPadService.createRecognitionMoment` with a synthetic
  ghost/need/synthesis/parameters payload, confirms
  `getRecognitionMoments`/`getRecognitionStats` see it, runs
  `memoryDynamicsService.runBackgroundMaintenance` with the same options
  `evaluationRunner.js` uses, and confirms
  `getWritingPad(...).metrics.totalRecognitionMoments` then reads ≥1 —
  proving the write→consolidate→column-update chain end-to-end, plumbing
  only, explicitly not a claim about real-model behavior; the script also
  validates the three new scenarios resolve, carry well-formed
  `longitudinal_drift` blocks identical to their single-turn siblings,
  and that `evalConfigLoader.isMultiTurnScenario` returns true for each.
  Unit tests for any new checker logic. Gate: tests green, `--check`
  green, lint/prettier clean on touched files.
- **Stage A2-pilot (small paid pilot, authorized by this section only)**:
  pad-ON session 1 alone → live §7.4 gate check → on PASS, pad-ON
  sessions 2-3 and the full 3-session pad-OFF arm → score with the
  unchanged checker → record verdicts per §7.4.
- **Anything beyond Stage A2**: requires a fresh pre-registration and its
  own recorded go, per §7.4's stop rule.

### 7.7 Implementation log

**2026-07-06: Stage A2-build complete; no-paid gate green.** Three
`longitudinal_drift_session_{1,2,3}_multiturn` scenarios (identical
`longitudinal_drift` metadata to their single-turn parents + 3 scripted
follow-up turns each, per §7.2), `checkPadInstrumentPrecondition` in
`services/longitudinalDriftChecker.js`, 4 new unit tests (suite 15/15),
hermetic `scripts/report-longitudinal-drift-stage-a2.js --check` green —
proved the full synthetic-write → two-step consolidation gap →
`runBackgroundMaintenance` → gate-now-passes chain against a temp
`AUTH_DB_PATH`. Also confirmed live before spend: the checker resolves
all three multiturn scenarios' metadata (disjoint LDS-M1/M2/M3
vocabularies), and a synthetic session-2 opening containing session-1
vocabulary registers `stale.hit=true` / `current.hit=false`. Committed
at `6406b1a0`.

**2026-07-06: pad-ON session 1 executed; §7.4 instrument-precondition
gate: PASS (4 recognition moments).** Run `eval-2026-07-06-97a18895`
(cell_40, `--learner-id a2-drift-padon-v1-2026-07-06`, uncapped,
nemotron/kimi-k2.5): 1/1 success, 4 turns, 12 API calls, 22.6 min,
$0.0447. **The superego disapproved on all 4 turns** — every turn
produced a recognition moment (vs 0 across all of A1's 3 single-turn
pad-ON sessions), confirming §7.1's mechanism read: more on-topic turns
= more independent per-turn disapproval draws. Live gate check
(`report-longitudinal-drift-stage-a2-live.js --gate`):
`writing_pads.total_recognition_moments = 4`, raw `recognition_moments`
row count = 4 (cross-check consistent — the eager consolidation ran; no
consolidation mismatch). All 4 moments settled to the `unconscious`
layer, all `transformative`, and their content carries **session-1
specific vocabulary** (the superego's critique voice quotes the actual
fractions: "1/4 + 1/6", "24 vs. 12", "LCD"; principles: socratic_rigor
×3, intellectual_autonomy ×1; the inferred `need` label is uniformly
"welcome_and_invitation", at exactly the coarse resolution §7.1's last
bullet predicted). The persistence channel now carries session-specific
content — the precondition A1 surfaced is closed. Per §7.2, pad-ON
sessions 2-3 and the pad-OFF arm proceed.

**2026-07-06: full A2 arc executed — 6/6 sessions clean; frozen §7.4
verdicts: validity PASS, adaptation signal NULL (directional), no red
flag.** Pad-ON runs `eval-2026-07-06-{97a18895,6966c1d5,d5652c5f}`
(sessions 1→2→3, shared learner-id), pad-OFF runs
`eval-2026-07-06-{51a74faa,cd3e0002,ff4d35db}` (sessions 1→2→3, no
`--learner-id`), all uncapped nemotron/kimi-k2.5, 24 turns total,
~$0.27, **0 row-level instrument failures**. Scored with the frozen
checker (`report-longitudinal-drift-stage-a2-live.js --score`; artifacts
`exports/longitudinal-drift-stage-a2.{json,md}`):

- **Primary-outcome validity gate: PASS.** Pad-ON current-reference 2/3
  (= the frozen 2/3 threshold exactly); pad-OFF also 2/3. Per-session:
  both arms hit sessions 1-2 (`denominator`; `ratio`/`ratios`), both
  missed session 3. Descriptive note: both session-3 openings DO
  reference the current topic in natural language ("forgetting to flip
  the inequality sign" pad-ON; "slips flipping signs" pad-OFF) but miss
  the frozen word-bounded phrases ("forgets to flip the sign", "sign
  flip") — a marker-phrasing near-miss, symmetric across arms,
  scenario-linked not arm-linked. Recorded, not re-scored: the frozen
  reading is the frozen reading.
- **Adaptation signal (directional-report-only): NULL.** Stale-reference
  pad-ON 0/2, pad-OFF 0/2 — gap 0.00 (needs ≥ 2/3 rows). Same surface
  outcome as A1, but **materially more informative**: this time the
  pad-ON pad demonstrably carried 10 session-specific,
  consolidated-to-unconscious recognition moments (4+3+3 per session;
  the critique voices quote each session's actual math), and later-
  session openings STILL surfaced zero prior-session vocabulary in
  either arm. A1's null said "nothing could have surfaced — the channel
  was empty"; A2's null says "the channel carried content and none of it
  surfaced in opening-turn temporal anchoring, in either direction."
- **Structural red flag: none** (pad-OFF stale 0, as it structurally
  must be).
- **Mechanism observation recorded for precision (deviation-note, arms
  remain clean)**: on the multi-turn path, `runMultiTurnTest` generates
  a per-dialogue synthetic learner-id when none is supplied, so each
  pad-OFF session ran with a FRESH synthetic pad (raw within-session
  moments 4/0/1, never consolidated, id never reused) rather than "no
  pad at all" as on A1's single-turn path. The §2.1 intent — no
  cross-session channel for pad-OFF — holds exactly (a fresh id each
  session can carry nothing over); within-session, the arms are actually
  MORE symmetric than A1's (both arms have a live pad during a session),
  isolating cross-session persistence as the sole manipulated variable.
  Also notable: per-turn superego disapproval is genuinely stochastic —
  pad-ON drew 4/3/3 moments per session, pad-OFF drew 4/0/1.

**Bounded interpretation.** A2 completes what it was authorized to do:
the instrument is now valid end-to-end INCLUDING the pad-feeding
precondition A1 could not meet (multi-turn sessions reliably produce
content-carrying, consolidated pads on this stack), and on that valid
instrument the pilot reports a directional null: pad persistence did not
alter opening-turn temporal anchoring at n=3 sessions/arm. Per §7.4 this
confirms/refutes nothing at this n. What it sharpens: the stale-
reference channel measures *leakage* of prior-session vocabulary, and
zero leakage with a full pad means any scaled design should add an
outcome channel for *constructive* pad use (e.g. continuity
acknowledgment on `resolved_last_session: true`, or resolved-
misconception handling), not just stale-vocabulary contamination. That
is a fresh-prereg question, explicitly not authorized here.

**STOP per §7.4/§7.6: Stage A2 is complete and this section authorizes
nothing further.** Rows consumed: exactly the 6 sessions / 24 turns
specified in §7.2 (plus the no-paid hermetic checks). Scaling to a
confirmatory design (more sessions/arms, constructive-use outcome
channels, other model stacks) requires a fresh pre-registration and its
own recorded go.

## 8. Stage A3 — constructive pad-content injection (fresh pre-registration, frozen before spend)

This section is the fresh pre-registration §7.7's STOP line required. It
does two things in order: (a) settles, by direct code read against the
live A2 database rather than by re-assuming §7's summary of it, whether
the Writing Pad's content ever actually reaches a tutor prompt on the
cell_40/93 path at all — the precondition the task authorizing this go
named explicitly; and (b) on that settled basis, either reinterprets A2's
null or authorizes a small constructive-use pilot. Everything in §1-§5
and §7.1's write/consolidate mechanism carry forward unchanged; this
section only adds the read-side finding and the new pilot.

### 8.1 Precondition finding: three read-side channels, three distinct breakages

§7.1 verified the *write* side exhaustively (superego disapproval →
`createRecognitionMoment` → `settleToUnconscious` →
`total_recognition_moments`) and confirmed it empirically (A2's 10
consolidated, transformative moments quoting real session content). It
did not verify the *read* side — whether anything downstream of that
write ever reaches a subsequent tutor prompt. This go traced every
consumer of pad content on the cell_40/93 request path
(`tutor-core/services/{tutorDialogueEngine,dialecticalEngine,
memoryDynamicsService,writingPadService,learnerIntegrationService,
recognitionOrchestrator}.js`, direct read + exhaustive grep for callers,
not assumption). There are exactly three attempted read-back channels,
and all three are broken, each for a different, specific reason:

1. **`unconscious.permanentTraces` (the field A2's 10 moments actually
   populated) — retrieved, then discarded.** `runDialogue`'s end-of-turn
   "Phase 4" block calls `memoryDynamicsService.runMemoryCycle(learnerId,
   { retrieveContext: true, ... })` (`tutorDialogueEngine.js:3172`,
   comment: "Retrieve context at end for next session"), which does call
   `retrieveUnconsciousContext` → `writingPadService.queryUnconscious`
   → an `insights` array built from real `permanentTraces` content
   (`memoryDynamicsService.js:243-279`). But the caller only reads
   `finalMemoryCycle.operations.promotion` /
   `.consciousCleared` off the returned object for its trace push
   (`tutorDialogueEngine.js:3186-3189`) — `operations.contextRetrieval`
   is computed and never read, returned, or persisted anywhere. The one
   call site that retrieves real content throws the result away before
   it could reach anything, in the same dialogue or a later one.
2. **`preconscious.recentPatterns` — wired in, permanently starved at
   its source.** The *other* Phase-4 call,
   `runMemoryCycle(learnerId, { retrieveContext: false })`, fires after
   *every* turn (`tutorDialogueEngine.js:2816`) and does run
   `autoPromotePatterns` → `detectPatternsFromConscious` →
   `writingPadService.promoteToPreconscious` when patterns are found.
   This chain is genuinely live. But `detectPatternsFromConscious` reads
   `pad.conscious.workingThoughts` / notes, and the only writer of the
   conscious layer, `writingPadService.updateConscious`, is called
   exclusively from `recognitionOrchestrator.js` — confirmed by
   exhaustive grep to have **zero callers** in
   `tutorDialogueEngine.js`, `dialecticalEngine.js`, or
   `evaluationRunner.js`. `conscious.workingThoughts` is therefore always
   `[]`, `detectPatternsFromConscious` always returns `[]`, and
   `autoPromotePatterns` always short-circuits at "0 patterns" before
   ever calling `promoteToPreconscious`. The pipeline runs every turn and
   always finds nothing to promote.
3. **`unconscious.learnerArchetype` (the field the superego's own prompt
   reads as `unconsciousContext`, `dialecticalEngine.js:131`) — evolves
   in form, never in substance.** `negotiateDialectically`'s own Step 3
   *does* call `learnerIntegrationService.evolveLearnerArchetype(learnerId)`
   directly (`dialecticalEngine.js:653`) whenever a moment is
   transformative — exactly the condition A2's 10 moments all met — and
   that function does persist an update via
   `writingPadService.updateUnconscious` (confirmed,
   `learnerIntegrationService.js:568`). So this channel is live at the
   plumbing level, unlike #2. But `evolveLearnerArchetype` derives its
   content from `analyzeLearnerPatterns(learnerId)`, which reads
   `getLearnerEvents(learnerId, ...)` — and the only writer of that
   event log, `recordLearnerEvent`, is — again — called exclusively from
   `recognitionOrchestrator.js` (exhaustive grep, zero other callers).
   Every evolution call therefore computes over zero events and persists
   the same content-empty defaults (`preferredLearningStyle: null`,
   empty struggle/breakthrough arrays) turn after turn: a real DB write,
   with nothing in it a prompt could use.

All three breakages converge on one root cause: `recognitionOrchestrator.js`
— which writes the conscious layer and the learner-event log the other
two channels depend on — is never invoked anywhere on the request path
actually exercised by `evaluationRunner.js` (confirmed by grep across
`tutorDialogueEngine.js`, `dialecticalEngine.js`, and
`evaluationRunner.js`: zero matches). It reads as an earlier or
alternative integration point that the leaner `dialecticalEngine.js`
path superseded without its two downstream consumers being repointed at
`dialecticalEngine.js`'s own actual outputs.

**Verdict: injection is BROKEN, not absent.** There is no missing code
path in the sense of "nobody ever tried" — three separate attempts exist,
each fails for a distinct, now-precisely-located reason, and the one
attempt that touches the field with real content in it (`permanentTraces`,
via `retrieveUnconsciousContext`) computes the right answer and discards
it one line later.

### 8.2 A2 reinterpretation

A2's §7.7 bounded interpretation already hedged carefully: "the channel
carried content and none of it surfaced in opening-turn temporal
anchoring, in either direction" — deliberately short of claiming the
model saw the content and chose not to leak it. §8.1 confirms that
hedge was necessary and sharpens it past hedging into a specific
finding: **the model could not have surfaced prior-session pad content
in A2, under any behavior, because no existing code path put that
content in front of it.** A2's stale-reference null is therefore an
instrument-gap finding, not a tutor-behavior finding — exactly the
disjunction the task authorizing this go asked this section to resolve,
resolved on the "instrument gap" branch. This does not overturn A2's
validity-gate PASS (current-reference matching measures something real
and present-session, unaffected by this finding) or discard A2's
10-moment write-side result (still the correct, and only, empirical
count of consolidated moments produced). It narrows what the stale-0
result licenses: nothing about whether cross-session pad content would
change tutor behavior if it reached the model, because in A2 it never
did.

### 8.3 Design: minimal external injection, not internal repair

Patching any of §8.1's three internal channels in place would mean
changing `tutor-core`'s core dialogue/memory-dynamics code — either
wiring `recognitionOrchestrator.js` into the live request path (a
structural change with unknown blast radius across whatever else reads
`conscious`/`learner_events`) or rewiring `runMemoryCycle`'s discarded
`contextRetrieval` result to persist and cross the session boundary
(still wouldn't reach the model without a further explicit injection
point). Both are larger than "minimal" and cut against the in-housing
seam discipline (`tutor-core/**` stays import-clean, re-extractable).
The task's own instruction is to mirror the proven approach-A mechanism
instead: an *external* narrative built from already-reliably-written
pad content, fed through the channel that is *already* proven end-to-end
— `externalEgoExtension` (eval layer) /
`systemPromptExtension` (tutor-core), confirmed live by direct read:

- `services/evaluationRunner.js:3743-3748` (`runMultiTurnTest`):
  `if (externalEgoExtension) { fullEgoExtension = externalEgoExtension +
  ... }`, folded into the per-turn ego extension the multi-turn runner
  already builds.
- `tutor-core/services/tutorDialogueEngine.js:1761-1762`
  (`egoGenerateSuggestions`): `effectiveSystemPrompt =
  systemPromptExtension ? \`${systemPromptExtension}\n\n${egoConfig.prompt}\`
  : egoConfig.prompt` — prepended directly onto the ego's own first-pass
  generation prompt, the earliest and most impactful point in the
  pipeline.
- `scripts/eval-cli.js`'s `--external-ego-extension-file <path>` flag is
  a pure pass-through (reads the file, sets `externalEgoExtension`) —
  already exercised for real, non-hypothetically, by the *separate*,
  already-null "rich-memory" cross-session experiment
  (`scripts/run-rich-memory-arc-experiment.js`, `services/memory/
  learnerMemoryService.js` — see project memory
  `project_memory_architecture.md`: "#3 cross-session rich-memory = first
  powered screen NULL"). That experiment is a different store with a
  different (already negative) result; A3 reuses only its proven
  *plumbing*, not its store or its finding, and does not revisit or
  reference its content result.

**New module: `services/writingPadNarrativeBuilder.js`.**
`buildWritingPadNarrative(learnerId, options)` reads
`tutor-core/services/writingPadService.js`'s
`getWritingPad(learnerId)?.unconscious?.permanentTraces` directly (the
one field §8.1 confirmed carries real content) and renders a short,
bounded narrative of each trace's `synthesis` (falling back to a
constructed line from `transformations`/`recognitionType` when
`synthesis` is empty), returning `null` when there are zero traces
(nothing to inject — the pad-OFF arm and any never-consolidated pad get
`null`, which the CLI flag path already treats as "no extension file
written"). This is new eval-layer code only; zero changes inside
`tutor-core/**`.

### 8.4 Primary outcome: constructive continuity (new)

Two independent, deterministic, word-bounded checkers (new functions in
`services/longitudinalDriftChecker.js`, reusing `containsAny` exactly as
the existing checker does — no judge model), each applied to a session's
**opening** turn, for sessions 2 and 3 only (session 1 has no
predecessor to be constructive about):

- **(a) Continuity-acknowledgment**: does the opening reference the
  *previous* session's own topic/resolution — using the previous
  session's `interest_markers` plus a small fixed set of resolution-
  register phrases ("last time", "you got", "we figured out", "we solved",
  "resolved", "you worked out", "picking up from") — WITHOUT necessarily
  invoking the previous misconception's own marker tokens (those are
  scored separately by (b), and conflating them would double-count the
  same evidence under two labels).
- **(b) Resolved-misconception handling**: does the opening avoid
  re-teaching the *previous* session's `active_misconception.token` /
  markers as though it were new/unaddressed content — operationalized as
  a fixed, small `RETEACHING_AS_NEW_MARKERS` list of introductory-framing
  phrases ("let's learn", "today we'll cover", "here's a new concept",
  "let me introduce", "so today", "let's start with") landing within the
  same sentence window as a previous-session misconception marker. This
  only applies when `resolved_last_session: true` (sessions 2 and 3, per
  the existing schedule) — checked but not scored on session 1.

**Explicit "4-slot" operationalization (frozen here, not left implicit):**
4 = 2 sessions (2, 3) × 2 checkers (continuity-acknowledgment,
misconception-not-retaught). Each slot scores a binary hit/no-hit per
arm, summed to a 0-4 scale per arm. This is a design decision made at
this pre-registration, not a re-derivation of ambiguous prior wording —
recorded explicitly so it is never re-interpreted differently later.

**Secondary (unchanged in spirit from §7.3):** the same pad-content
trace report (total_recognition_moments, raw recognition_moments count,
plain-language rendering of each moment) continues to be recorded for
the pad-ON arm after every session.

### 8.5 Frozen thresholds and stop rules

- **NEW precondition gate (this section's own, distinct from §7.4's
  moment-count gate, which stays required and unchanged): the injection
  fix must be hermetically verified before any paid session** — (i)
  `buildWritingPadNarrative` returns a string containing a seeded marker
  token when given a synthetic pad with a `permanentTraces` entry
  carrying that marker in `synthesis`, and returns `null` for an empty
  pad; (ii) with `globalThis.fetch` stubbed (mirroring
  `tutor-core/services/__tests__/emptyContentRetry.test.js`'s pattern),
  calling `runEvaluation()` in-process with `externalEgoExtension` set to
  a narrative containing that marker results in the marker appearing in
  the captured outgoing ego request body. **If either half fails: STOP,
  fix, re-gate — no paid session runs on a broken injection path.**
  (Both halves passed before any spend — logged in §8.7.)
- **Constructive-signal gate (same directional-only spirit as §7.4):**
  pad-ON constructive score ≥ 2/4 across the session-2/3 openings AND
  pad-OFF constructive score = 0/4. This pilot cannot confirm or refute a
  general claim at n=3 sessions/arm — stated explicitly, as §3/§7.4
  already establish and this section does not relax. Scaling needs a
  fresh pre-registration.
- **Red flag:** any pad-OFF constructive hit (either checker, either
  session) is flagged for investigation as possible leakage (e.g. a
  generic tutoring phrase coincidentally matching a resolution-register
  marker) — reported, not folded into a positive finding for pad-OFF.
- **Row/session-level instrument failure:** generation error, empty or
  malformed output, or a schedule/injection-file write failure — excluded
  from denominators, reported separately, mirroring §3/§7.4 exactly.
- **§7.4's own gate stays in force unchanged**: pad-ON session 1 must
  still clear `total_recognition_moments >= 1` before sessions 2-3
  proceed (it is also the source of session-2's own injected narrative,
  so a fail here blocks the pilot for two independent reasons now).
- **Stop rule**: if Stage A3-build's no-paid gates (§8.6) do not pass
  clean, A3 does not run live. If the session-1 §7.4 gate fails, STOP.
  This section authorizes exactly 6 sessions / 24 turns (same envelope
  as §7.2) plus the between-session narrative-injection files — nothing
  beyond that without a fresh pre-registration and go.

### 8.6 Scope and limits specific to A3

All of §4's and §7.5's limits carry forward unchanged (single
learner-id trajectory per arm; `learner_architecture: unified`
throughout; architecture-independent judge-free scoring;
exhaustion-as-instrument-failure semantics). In addition:

- **A PASS here licenses "an externally-injected pad narrative, fed
  through `externalEgoExtension`, can produce constructive continuity
  behavior on this schedule/model stack" — not "the tutor's own
  unmodified memory architecture does this."** The fix is eval-layer
  scaffolding around a confirmed-broken internal read side, not a claim
  that `tutor-core`'s Writing Pad works end-to-end unmodified. Any future
  work aiming to fix the internal channels themselves (wiring
  `recognitionOrchestrator.js` in, or persisting `runMemoryCycle`'s
  discarded retrieval) is a distinct, larger, separately-scoped
  engineering task this section does not authorize.
- **This is best described as "reusing the proven approach-A injection
  channel with new pad-sourced content," not "an exact replica of
  whatever produced §6.6.11's original number."** §6.6.11's precise
  original construction was not re-derived line-by-line in this go
  (out of scope for a fresh-prereg pilot); this design satisfies the
  task's own framing of the mirror ("pad narrative summary into the
  tutor's session context") without claiming textual identity with a
  paper section written under different circumstances.
- A pass or fail on either §8.5 gate is itself a substantive, narrow
  result about this specific fix on this specific stack, worth recording
  regardless of what it licenses next.

### 8.7 Stages and gates

- **Stage A3-build (no-paid, this go):** `services/
  writingPadNarrativeBuilder.js`; two new checker functions plus a fixed
  marker-phrase list in `services/longitudinalDriftChecker.js`
  (version bumped to reflect the addition); unit tests for both; a
  hermetic two-half gate script
  (`scripts/report-longitudinal-drift-stage-a3.js --check`) proving
  §8.5's precondition gate against a temp `AUTH_DB_PATH` and a stubbed
  `globalThis.fetch` — no paid calls, real DB untouched. Gate: tests
  green, `--check` green, lint/prettier clean on touched files.
- **Stage A3-pilot (small paid pilot, authorized by this section only):**
  pad-ON session 1 (reused/rerun as needed) → §7.4 live gate → on PASS,
  build session-2's narrative from session-1's pad, run pad-ON session 2
  with `--external-ego-extension-file`, rebuild the narrative from the
  now-2-session pad, run pad-ON session 3 the same way; pad-OFF arm runs
  unchanged from A2 (no learner-id, no injection file, all 3 sessions) →
  score both arms with the new checkers → record verdicts per §8.5.
- **Anything beyond Stage A3:** requires a fresh pre-registration and its
  own recorded go, per §8.5's stop rule.

### 8.8 Implementation log

*(filled in as Stage A3-build and Stage A3-pilot complete)*
