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

**Stage A3-build, correction to §8.1 (2026-07-07): a fourth read-side
breakage, found by the §8.5 hermetic gate itself, now fixed.** Building
`services/writingPadNarrativeBuilder.js` and its unit tests (the exact
work §8.5's own precondition gate calls for) surfaced a fourth breakage,
distinct from and additional to §8.1's three: `unconscious.permanentTraces`
(the one field §8.1 confirmed A2's 10 moments actually populated) turns
out to carry no usable content of its own on the real write path, even
though the count is genuine. Root cause, confirmed by direct code read
of `tutor-core/services/writingPadService.js`: `createRecognitionMoment`
persists real content into the `recognition_moments` table's
`synthesis_resolution` column (line ~397, `synthesis.synthesis || ''`),
but its own return value, and every subsequent read, goes through
`getRecognitionMoment`/`getRecognitionMoments` (lines 429-448, 450-482),
both of which reconstruct their return object from an explicit field
allowlist that keeps the content-identical `synthesis_strategy` column
but **omits `synthesis_resolution` entirely**. `settleToUnconscious`
(line ~257) builds each `permanentTraces` entry by reading exactly
`recognitionMoment.synthesis_resolution` — the dropped field — so every
real trace it persists has `synthesis: undefined`, which `JSON.stringify`
silently drops as a key. Verified twice: (a) a hermetic synthetic
reproduction of the real chain (`createRecognitionMoment` →
`getRecognitionMoments` → `settleToUnconscious`) against a temp DB; (b) a
direct read-only `sqlite3` query against the real A2 production pad
(`tutor-core/data/lms.sqlite`, learner `a2-drift-padon-v1-2026-07-06`,
`total_recognition_moments = 10`) — all 3 sampled real `permanentTraces`
entries have the shape `{id, timestamp, transformations: {}, struggleDepth: 0}`
with no `synthesis` key at all, on real paid-run data, not a test
artifact. (The same read confirms `ego_transformation`/
`superego_transformation`/`learner_insight`/`recognition_type` — the
other three content-bearing columns the schema defines — are always
NULL on the real write path too: `createRecognitionMoment`'s own
destructure never reads those fields from its caller, regardless of
what `dialecticalEngine.js`'s Step 3 call site passes for them. Only
`synthesis_resolution`/`synthesis_strategy` and the `ghost_demand`/
`learner_need`/`parameters`/`transformative` JSON blobs actually persist.)

This corrects §8.1's own characterization: A2's 10 moments are real and
correctly counted (the write side and the `total_recognition_moments`
column are unaffected by this bug), but their content was never actually
recoverable from `permanentTraces` as §8.1 stated — only from the raw
`recognition_moments.synthesis_resolution` column directly. §8.2's
reinterpretation stands regardless (the *tutor prompt* never saw any of
this content either way, for all four reasons now), and §8.3's design
choice — inject externally rather than patch tutor-core internals —
turns out to be exactly the right posture for this bug too, not just the
original three: since each trace's own `.id` correctly survives into
`permanentTraces` (`settleToUnconscious` copies it through intact) and is
a live foreign key back to its `recognition_moments` row,
`writingPadNarrativeBuilder.js`'s `renderTraceLine` was extended with a
small, read-only, additive lookup — `SELECT synthesis_resolution,
synthesis_strategy FROM recognition_moments WHERE id = ?`, called via
`tutor-core/services/dbService.js`'s own `getDb()` — that recovers the
real text by id before falling through to the existing transformations/
recognitionType/null chain. This is still zero changes inside
`tutor-core/**` (a raw, additive SELECT from eval-layer code against a
table already in tutor-core's own schema, not a patch to tutor-core's
functions), so §8.3's "minimal external injection, not internal repair"
framing is unchanged in spirit — it now also has to route around one
more internal accessor bug, not just the three orphaned-module gaps.
Re-run against the real A2 production pad after the fix:
`buildWritingPadNarrative('a2-drift-padon-v1-2026-07-06')` now returns a
1819-character narrative quoting all of A2's real fractions-session
tutoring content (LCD-finding, denominator-multiplication critique,
ratio-scaling cognitive-conflict prompts) — confirming the fix recovers
real production content, not just synthetic test content. Module version
bumped to 1.1 to reflect the fix; this correction is logged here (the
implementation log) rather than by rewriting §8.1's frozen prose, per
this note's own established convention (A1/A2 recorded their deviations
the same way).

**Stage A3-build, gate results:** both halves of §8.5's precondition gate
pass, via `scripts/report-longitudinal-drift-stage-a3.js --check`
(hermetic: temp `AUTH_DB_PATH` + temp `EVAL_DB_PATH`/`EVAL_LOGS_DIR`, a
fake non-secret `OPENROUTER_API_KEY` so provider resolution proceeds, and
`globalThis.fetch` stubbed to a canned non-empty response — zero network
calls, zero paid spend, real production DB/logs untouched). Half (i):
`buildWritingPadNarrative` returns `null` for a freshly initialized pad
and returns the seeded marker's text for a pad with one real,
consolidated recognition moment (the exact `createRecognitionMoment` →
`runBackgroundMaintenance` chain the live pilot depends on, not a
synthetic `updateUnconscious` shortcut). Half (ii): calling the real
`runEvaluation()` in-process against the real
`longitudinal_drift_session_1_multiturn` scenario and the real
`cell_40_base_dialectical_suspicious_unified_superego` cell, with
`externalEgoExtension` set to half (i)'s narrative, drove 4 stubbed
outgoing calls (matching the scenario's 4 turns) and the seeded marker
was present in the captured request body — confirming the
`externalEgoExtension` → `fullEgoExtension` → `systemPromptExtension` →
`egoGenerateSuggestions`'s `effectiveSystemPrompt` chain (§8.3's citation)
is live end-to-end on this exact scenario/cell pair, not just plausible
from a static code read. Full build-phase gate: 38/38 unit tests green
(`services/__tests__/writingPadNarrativeBuilder.test.js`,
`services/__tests__/longitudinalDriftChecker.test.js` — 2 new checker
functions plus the aggregator, 13 new cases), hermetic `--check` PASSED,
lint/prettier clean on all touched files. Stage A3-build is complete and
green; Stage A3-pilot (the 6-session live arc) follows next.

**2026-07-07: full A3 arc scored; frozen §8.5 verdicts: precondition
CONFIRMED, constructive-signal gate FAIL, red flag investigated and
attributed to instrument ceiling, not leakage.** All 6 rows present and
`success: true`: pad-ON `eval-2026-07-06-{1297acac,ba04f4ea,d169b15f}`
(sessions 1→2→3, `--learner-id a3-drift-padon-v1-2026-07-07`); pad-OFF
`eval-2026-07-06-4afdea05` (one run, 3 scenario rows for sessions 1-3, no
learner-id — a different batching choice than A2's 3 separate pad-OFF
run-ids, same no-pad/no-injection recipe). All 6:
`cell_40_base_dialectical_suspicious_unified_superego` /
`cell_93_..._nopad`, nemotron/kimi-k2.5, 4 turns and 11-14 API calls per
session, $0.293 total, wall-clock 2026-07-06 15:58-17:05. Dialogue logs
confirmed present for all 6 rows and cross-checked against each row's own
`dialogueId` (no mismatch).

*Precondition gate: CONFIRMED by direct primary-source inspection, not
inference.* Pad-ON session 2's dialogue log
(`dialogue-1783353681493-p0vo3n.json`) has 12 `dialogueTrace` entries
carrying an `apiPayload` field (the literal outgoing ego/superego
request); 8 of 12 contain the literal injected session-1 fraction text
"1/4 + 1/6", including the first entry (`agent: ego, action: generate,
round: 0`) — the injected narrative was present from the start of
session 2's dialogue. Cumulative cross-session confirmation, via two
independent markers chosen to be immune to a timestamp-substring false
positive found and ruled out below: (a) the unambiguous session-1
fraction "1/4 + 1/6" appears 16× in pad-ON's session-2 log and 16× in its
session-3 log, vs 0× in pad-OFF's session-2 and session-3 logs; (b)
session-2's own misconception vocabulary ("additive scaling", "scaling a
ratio") — necessarily cross-session content when found in session 3,
since session 3's own scripted topic is unrelated ("linear equations" /
`LDS-M3` "flip-sign-forgetting", confirmed against the scenario YAML) —
appears 2×/8× in pad-ON's session-3 log vs 0×/0× in pad-OFF's. The
precondition this stage exists to fix is verified working, cumulatively,
across both injected sessions, not merely hermetically plausible.

*Frozen "4-slot" constructive-continuity aggregate*
(`scripts/report-longitudinal-drift-stage-a3-live.js --score`, checker
v1.1; `exports/longitudinal-drift-stage-a3.{json,md}`):

| Arm | Continuity-ack s2 | Continuity-ack s3 | Misconception-not-retaught s2 | Misconception-not-retaught s3 | Slots hit |
|---|---|---|---|---|---|
| pad-ON | miss | miss | HIT | HIT | 2/4 |
| pad-OFF | miss | miss | HIT | HIT | 2/4 |

**Constructive-signal gate: FAIL** (needs pad-ON ≥2/4 AND pad-OFF =0/4;
pad-ON clears its own bar, pad-OFF does not clear 0/4). **Red flag:
RAISED** (pad-OFF is non-zero) — investigated per §8.5's own instruction
("flagged for investigation... reported, not folded into a positive
finding for pad-OFF"), not left as a bare number:

- The identical HIT/HIT pattern in both arms is a checker-ceiling
  artifact, not a leakage signal. Reading the four actual scored opening
  texts directly: none of the six `RETEACHING_AS_NEW_MARKERS` phrases
  ("let's learn", "today we'll cover", "here's a new concept", "let me
  introduce", "so today", "let's start with") appears in any of them
  (pad-ON s2: "You added the same number to both terms in the ratio
  practice; let's practice scaling ratios correctly..."; pad-ON s3:
  "Let's drill the sign-flip rule..."; pad-OFF s2: "Practice identifying
  and correcting additive versus multiplicative scaling..."; pad-OFF s3:
  "Rewrite each step of isolating x..."). §8.4's checker only registers a
  miss when one of those phrases co-occurs with a prior-session
  misconception marker in the same sentence; absent any of the six
  phrases, the checker defaults to HIT regardless of whether real
  cross-session memory access occurred. Both arms land on the same
  default for the same reason — the checker did not have anything to
  detect either way in this data, not "pad-OFF also achieved constructive
  continuity."
- A distinct false lead was checked and closed: an earlier coarse grep
  for "2:3" (a candidate leaked-ratio marker) found 3 hits in pad-OFF's
  session-3 log. Byte-offset inspection of all 3 shows each is a
  substring coincidence inside a timestamp (`"2026-07-06T16:02:38.480Z"`,
  matching "2:3" inside "16:02:38") or an HTTP `date` response header
  (`"Mon, 06 Jul 2026 16:02:39 GMT"`, matching inside "16:02:39") — not
  ratio content. No genuine occurrence of any clean, cross-session-
  specific marker ("1/4 + 1/6", "additive scaling", "scaling a ratio",
  "adds the same amount") was found anywhere in pad-OFF's session-2 or
  session-3 logs. The red flag is fully explained by the checker artifact
  above; there is no evidence of actual content leakage into the pad-OFF
  arm.

*Continuity-acknowledgment is a clean, non-artifactual null (0/2 both
arms) — the pilot's one real behavioral finding.* Unlike misconception-
handling, this checker scores presence of the desired behavior (hit=true
when continuity language is found), so it is not ceiling-biased the same
way; reading the four opening texts directly confirms the miss is real,
not a phrasing near-miss — none of the four openings contains any
resolution-register callback to a prior session, in either arm. This is
informative in a way A1's and A2's nulls were not, because the
precondition is demonstrably not broken here: pad-ON's own dialogue
negotiation visibly carries rich, extensive cross-session material
(confirmed above, in the model's actual outgoing request across most
negotiation rounds of session 2 and cumulatively session 3), and none of
it surfaces as an opening-turn continuity statement. The tutor's
delivered opening line stays inside the current session's own topic in
both arms; whatever cross-session synthesis happens during negotiation
(the `dialecticalEngine` critique/revision rounds) does not carry through
to a "last time we..." style opening, at least not in the phrasing this
checker's fixed marker list looks for, and not in substance either on
direct reading of the four texts.

*Sharpened A2 reinterpretation (ties §8.2 and the fourth §8.8 breakage to
this pilot's result).* §8.2 established that A2's stale-reference null
was an instrument-gap finding, not a tutor-behavior finding, because no
code path ever put prior-session content in the model's context. A3
closes that gap and re-runs the same kind of check on a genuinely working
channel — and the result is a real, if narrow, null: even with
prior-session content demonstrably present in the model's context, the
specific behavior both A2 and A3 look for (an explicit opening-turn
continuity callback) still does not appear. This does not resurrect A2's
original null as a tutor-behavior finding — A2 itself remains an
instrument-gap finding, unaffected, and its validity-gate PASS and
10-moment write-side result stand as before — but it does mean the next
null in this lineage (A3's continuity-acknowledgment result) is the first
one in this arc that can be read as being about tutor behavior rather
than about broken plumbing, at n=2 openings/arm.

**Bounded interpretation.** A3 completes exactly what it was authorized
to do: the injection precondition is fixed and confirmed live (not just
hermetically), and on that fixed instrument the constructive-signal gate
is a clean FAIL at n=3 sessions/arm — directional only, per §8.5, and not
a claim that pad-fed continuity behavior is absent in general. What it
licenses: (a) the four read-side breakages (§8.1 ×3, §8.8 ×1) are real
bugs worth fixing on their own terms if `tutor-core`'s internal Writing
Pad path is ever meant to work unmodified — separately scoped, not
authorized here; (b) a future confirmatory design on continuity-
acknowledgment specifically would need either a larger n or a more
targeted stimulus (e.g. a scenario that explicitly prompts the tutor to
open with a check-in, rather than relying on spontaneous surfacing) — a
fresh pre-registration's decision, not this one's.

**STOP per §8.5/§8.7: Stage A3 is complete and this section authorizes
nothing further.** Rows consumed: exactly the 6 sessions / 24 turns
specified in §8.7 (plus the no-paid hermetic build-phase checks). Scaling
to a confirmatory design, fixing the internal Writing Pad channels, or
redesigning the continuity-acknowledgment outcome requires a fresh
pre-registration and its own recorded go.

## 9. Stage A4 — structural check-in pilot (fresh pre-registration, frozen before spend)

§8.6 named fixing the internal Writing Pad read channels as a distinct,
larger, separately-scoped engineering task this note's A3 section did not
authorize. That task has since been done, as ordinary engineering, not
under a pre-registration (bug fixes to existing plumbing do not need one
— only new claims about tutor behavior do). This section does two things
in order: (a) records what was fixed and why that changes A4's design
relative to A3's; (b) pre-registers, before any spend, a small pilot that
gives the tutor a scripted, identical-in-both-arms opportunity to
demonstrate cross-session memory use, rather than relying on the
spontaneous surfacing A3 already found to be a clean null. Everything in
§1-§5, §7.1's write/consolidate mechanism, and §8.1-8.2's diagnosis carry
forward unchanged; this section only adds the repair and the new pilot.

### 9.1 Rationale: A3's own licensed next step, on a now-repaired instrument

A3's bounded interpretation (just above) licensed exactly one next step
for the continuity-acknowledgment null: "a future confirmatory design on
continuity-acknowledgment specifically would need either a larger n or a
more targeted stimulus (e.g. a scenario that explicitly prompts the tutor
to open with a check-in, rather than relying on spontaneous surfacing)."
A4 takes that stimulus, not the larger-n branch — n stays at 3
sessions/arm throughout this arc, per §3's own repeated stop rule.

Separately from that licensed next step, §8.1 had diagnosed three broken
internal read-side channels (`unconscious.permanentTraces` retrieved by
`runMemoryCycle` then discarded unpersisted; `preconscious.recentPatterns`
starved because `conscious.workingThoughts` is never written on the live
path; `unconscious.learnerArchetype` evolving in form but never in
substance for the same reason), all converging on one root cause:
`recognitionOrchestrator.js` — the module that writes the conscious layer
and the learner-event log the other two channels depend on — is never
invoked anywhere on the request path `evaluationRunner.js` actually
exercises. §8.8 then found and fixed a fourth, distinct breakage
(`getRecognitionMoment`/`getRecognitionMoments`' field allowlist silently
drops `synthesis_resolution`, the one column `settleToUnconscious` reads
for `permanentTraces`' own content) — but fixed it by working *around* it
externally, in `writingPadNarrativeBuilder.js`, deliberately not touching
`tutor-core/**` internals, per §8.3's "minimal external injection, not
internal repair" posture for that stage.

This go goes further and repairs all four at the source, inside
`tutor-core/**` itself, rather than working around any of them from the
eval layer:

1. **`recognitionOrchestrator.js` orphaned** (§8.1's shared root cause of
   findings #2 and #3) — rather than wiring the whole orphaned module
   into the live request path (§8.3's own rejected larger option, "unknown
   blast radius across whatever else reads `conscious`/`learner_events`"),
   the conscious-layer write it was responsible for is now mirrored
   inline, directly in `tutorDialogueEngine.js`'s own turn flow — a
   targeted fix with a known, small blast radius, not the structural
   rewire §8.3 declined.
2. **`runMemoryCycle`'s discarded `contextRetrieval` result** (§8.1
   finding #1) — the Phase-4 "retrieve context at end for next session"
   call already computed the right answer from real `permanentTraces`
   content; it simply never persisted anywhere past that call. Now
   persisted, in `memoryDynamicsService.js`, so it actually crosses the
   session boundary instead of being computed and thrown away.
3. **The pattern-promotion pipeline's empty input** (§8.1 finding #2,
   downstream of fix 1 above) — `detectPatternsFromConscious` reads
   `conscious.workingThoughts`, which fix 1 now actually populates on the
   live path, so `autoPromotePatterns` can find something to promote
   instead of always short-circuiting at "0 patterns."
4. **The `synthesis_resolution` field-allowlist drop** (§8.8's fourth
   breakage) — fixed at the source this time, inside
   `tutor-core/services/writingPadService.js`'s own
   `getRecognitionMoment`/`getRecognitionMoments` field allowlist, rather
   than by the additive external `SELECT` §8.8 added to
   `writingPadNarrativeBuilder.js`. That external workaround is
   superseded for A4's purposes but was NOT deleted — it remains the
   correct, citable instrument for A3's own already-frozen result, and
   its docblock now carries a status note to that effect (a "STATUS
   UPDATE (§8.8)" paragraph) rather than the file being rewritten or
   removed.

All four fixes are ordinary engineering on existing plumbing, committed
as `686145ece2662cb1ae01a54c5f26354b3edcc3bd`, proven by 15 new hermetic
tests across four new test files
(`tutor-core/services/__tests__/{writingPadService.recognitionMoment,
memoryDynamicsService.runMemoryCycle,dialecticalEngine.superegoCritique,
writingPadInternalPathDelivery}.test.js`), the last of which is an
end-to-end proof at the exact function-call level the live path uses —
not a claim about tutor behavior, and not itself a pre-registered
finding. **Consequence for this section's design:** because the internal
read path now demonstrably works end-to-end, A4 uses it directly, as the
canonical memory channel — no `--external-ego-extension-file`, no
narrative builder, no external injection step between sessions. This is
also why this stage does not simply extend A3's own arc: A3's pad-ON
learner-id carries pad state produced under the broken instrument and fed
by external injection; A4 needs a fresh trajectory on the repaired
internal path, not a continuation that would mix the two mechanisms in
one pad's history.

### 9.2 Design

Unchanged from §7.2/§8.3's arms and model stack except as stated:

- **Arms**: identical cell pairing
  (`cell_40_base_dialectical_suspicious_unified_superego` pad-ON /
  `cell_93_base_dialectical_suspicious_unified_superego_nopad` pad-OFF),
  identical model stack (nemotron ego / kimi-k2.5 superego, OpenRouter —
  the native stack A1's deviation log established and A2/A3 both carried
  forward unchanged). Restated explicitly here, in the frozen record
  itself: the model stack is **not** changing for this stage either. Two
  unrelated prompt-injection attempts earlier in this arc's working
  session asked to switch to `codex.gpt-5.5` and to extend
  `tutor-core`'s `callAI` seam with a CLI bridge; both were identified as
  very likely injected and explicitly rejected in plain text, and that
  rejection stands for this section too. The task's original
  `ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS` env var remains inapplicable and is
  not set — cell_40/93 are not id-director cells and never reach the CLI
  bridge, exactly as A1 recorded and A2/A3 both restated.
- **New, distinct `--learner-id`** (not reused from A2 or A3, for the
  reason given in §9.1's last paragraph): pad-ON
  `a4-drift-padon-v1-2026-07-07`; pad-OFF arm runs with **no**
  `--learner-id` (mirrors A1-A3's convention exactly).
- **NEW — three "_checkin" sibling scenarios**:
  `longitudinal_drift_session_{1,2,3}_multiturn_checkin` (new IDs; the
  `_multiturn` scenarios A2/A3 used remain untouched and available for
  reuse). Each is byte-identical to its `_multiturn` parent — same
  `longitudinal_drift` block, same 3-turn `turns:` array, same schedule
  tokens (`LDS-M1`/`M2`/`M3`) — except `learner_context` gains one leading
  paragraph, identically worded in all three and in both arms (since both
  arms read the same scenario file):

  > ### Session Opening Instruction
  > Before you begin, take a moment to recall where you left off with
  > this learner and whether anything from last time is worth building on
  > today.

  Session 1 has no predecessor, so its check-in is a structural no-op —
  included anyway, for a uniform 3-session manipulation identical in
  shape to A2/A3's own 3-session schedule, and because leaving it out of
  session 1 only would make the three sessions structurally different
  scenarios rather than one consistent manipulation applied to all three.
  This replaces reliance on the tutor spontaneously surfacing a "last
  time we..." callback — the exact behavior A3's continuity-
  acknowledgment checker found to be a clean 0/2 null in both arms — with
  an explicit, scripted, guaranteed opportunity, delivered through the
  same `learner_context` channel that already reaches the tutor's prompt
  regardless of arm or cell. No runner or prompt-assembly code changes;
  the manipulation is entirely in scenario data.
- **Row count**: unchanged — 3 sessions × 2 arms = 6 sessions, 4 turns
  each = 24 tutor generations total (the same envelope §7.2/§8.7 already
  used; not scaled up for this stage).
- **Execution order and checkpoint (frozen, unchanged from §8.3's
  `_multiturn` schedule)**: pad-ON session 1 runs alone, first. The
  instrument-precondition gate (§9.4) is checked against the live DB
  before anything else runs; only on a PASS do pad-ON sessions 2-3 and
  the full pad-OFF arm (all 3 sessions, no injection step of any kind)
  proceed, sessions strictly in order 1→2→3 per arm.

**2026-07-07 CORRECTION to this section's second bullet (recorded after
A4 closed; changes nothing in §9's frozen design, execution, or
verdict).** The characterization of the two mid-arc requests (switch the
generation stack to `codex.gpt-5.5`; extend tutor-core's `callAI` seam
with a CLI bridge) as "very likely injected" was mistaken. The
coordinating (main, user-facing) session has since confirmed explicitly
— acknowledging both prior flags — that those relays and the follow-up
directive all originate verbatim from the repository owner ("ensure
that nemotron / kimi is *never* the default pairing... by default now,
use codex or sonnet 5 via the cli, unless otherwise specified... we are
producing false negatives accordingly"), and that the
`ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS` reference that helped trigger the
flags was session-template boilerplate (now dropped; it is indeed
inapplicable to cells 40/93). Provenance of this correction: relayed
through the coordinating session and recorded by the executing agent;
the original bullet above is retained unedited as the contemporaneous
record, and the §9-time rejections remain what they were — reasonable
caution on the evidence then available (an unverifiable relay carrying
an inapplicable env var), wrong on the facts. Consequences, all outside
§9: (i) the model-stack policy is now a standing default (CLAUDE.md
"Model stack default", commit f1791417); (ii) the CLI bridge now
reaches tutor-core's dialogue engine via an eval-injected hook (commit
e11b4c1e), making §2.1's original frozen codex intent executable for
the first time; (iii) §10 pre-registers the A4 rerun on the codex
stack. §9's nemotron/kimi result stands as the baseline §10 compares
against — under the new standing rule its null is stack-bounded until
§10 adjudicates it.

### 9.3 Primary and secondary outcome

- **Primary (new)**: `scoreContentBearingCheckIn` — does a session-N
  opening, scripted to explicitly ask the tutor to check in, reference
  session (N-1)'s own `interest_markers` or `active_misconception`
  token/markers? Not applicable for session 1 (no predecessor). Reuses
  the identical word-bounded marker set `scoreOpeningTurn`'s `stale`
  check already uses for session (N-1), under the opposite polarity: in
  `scoreOpeningTurn`, a prior-session marker in an *unprompted* opening
  reads as leakage/confusion; here, inside a turn explicitly scripted to
  solicit exactly that recall, the same textual signature is the desired,
  content-bearing behavior — kept as its own separate, differently-
  interpreted checker function rather than a re-read of `stale`, so the
  two readings are never conflated.
- **Secondary (reused unmodified from §8.4)**: `scoreContinuityAcknowledgment`
  — does the opening carry even a generic continuity acknowledgment at
  all (the checker A3 already used, which found the clean 0/2-both-arms
  null)? Carried forward unchanged as a diagnostic companion to the new
  primary outcome, not re-scored under new assumptions.
- **Explicit "4-slot" operationalization (frozen here, same shape as
  §8.4, new threshold — see §9.4)**: 4 = 2 sessions (2, 3) × 2 checkers
  (content-bearing check-in, continuity-acknowledgment). Each slot scores
  a binary hit/no-hit per arm, summed to a 0-4 scale per arm.
- **Secondary (unchanged in spirit from §7.3/§8.4)**: the same pad-content
  trace report (`total_recognition_moments`, raw `recognition_moments`
  row count, plain-language rendering of each moment) continues to be
  recorded for the pad-ON arm after every session.

### 9.4 Frozen thresholds and stop rules

- **NEW precondition gate, live (this section's own, in addition to the
  unchanged gate below) — internal-path delivery must be verified live,
  not only hermetically**: after pad-ON session 2 completes, directly
  inspect its dialogue log's `apiPayload` entries for session 1's own
  `interest_markers`/`active_misconception` vocabulary — the same
  "direct primary-source inspection, not inference" standard §8.8 already
  applied to A3's external-injection channel. **If no `apiPayload` entry
  in session 2 contains any session-1 marker: STOP — the internal-path
  fix is not actually delivering live, no session 3, no pad-OFF scoring
  claims off this arm, investigate before any further spend.** (The new
  `scripts/report-longitudinal-drift-stage-a4-live.js --verify-live`
  mode performs exactly this check, mirroring §8.8's own dialogue-log
  inspection method.)
- **§7.4's own moment-count gate stays in force unchanged**: pad-ON
  session 1 must still clear `total_recognition_moments >= 1` before
  sessions 2-3 proceed.
- **Structural-signal gate (same directional-only spirit as §7.4/§8.5,
  stricter on the pad-ON side)**: pad-ON slots hit **≥ 3/4** AND pad-OFF
  slots hit **= 0/4**. The pad-ON bar is raised from §8.5's ≥2/4 because
  A4's check-in slot is scripted and guaranteed to occur in both arms,
  not spontaneous — a working memory channel, given an explicit,
  identical prompt to use it, should be expected to clear a stricter bar
  than a channel that had to surface unprompted. This pilot still cannot
  confirm or refute a general claim at n=3 sessions/arm — stated
  explicitly, as §3/§7.4/§8.5 already establish and this section does
  not relax. Scaling needs a fresh pre-registration.
- **Red flag**: any pad-OFF content-bearing hit (either session) is
  flagged for investigation as possible leakage — reported, not folded
  into a positive finding for pad-OFF, mirroring §8.5 exactly.
- **Row/session-level instrument failure**: generation error, empty or
  malformed output, or a schedule/scenario validation failure — excluded
  from denominators, reported separately, mirroring §3/§7.4/§8.5.
- **Stop rule**: if Stage A4-build's no-paid gates (§9.6) do not pass
  clean, A4 does not run live. If the session-1 §7.4 gate fails, or the
  live internal-path-delivery gate above fails, STOP. This section
  authorizes exactly 6 sessions / 24 turns (the same envelope as
  §7.2/§8.7) — nothing beyond that without a fresh pre-registration and
  go.

### 9.5 Scope and limits specific to A4

All of §4's, §7.5's, and §8.6's limits carry forward unchanged (single
learner-id trajectory per arm; `learner_architecture: unified` throughout;
architecture-independent judge-free scoring; exhaustion-as-instrument-
failure semantics). In addition:

- **A PASS here licenses "when the tutor is explicitly and identically
  instructed to check in, and the internal memory-read path is
  demonstrably delivering prior-session content into its context, the
  opening turn references that content specifically" — not "the tutor
  spontaneously surfaces memory unprompted."** A3's own clean
  continuity-acknowledgment null (§8.8) is unaffected by this stage's
  result either way; A4 asks a narrower, different question on a
  scripted stimulus, not a re-run of A3's question on better plumbing.
- **A PASS or FAIL here is still about this specific fix, on this
  specific stack, at this n** — not a general claim about `tutor-core`'s
  Writing Pad architecture, and not licensing removal of the exhaustion-
  as-instrument-failure or single-trajectory limits carried forward
  above.
- Cost/scope: ~6 sessions ≈ $0.30, the same envelope A2/A3 already used —
  not scaled up.
- **Known failure mode, carried into this stage**: sessions may stall at
  turn boundaries waiting on background runs — commit state before
  ending any turn.

### 9.6 Stages and gates

- **Stage A4-build (no-paid, this go):** two new checker functions
  (`scoreContentBearingCheckIn`, `summarizeContentBearingCheckIn`) plus a
  version bump in `services/longitudinalDriftChecker.js`; three new
  `_checkin` sibling scenarios in `config/suggestion-scenarios.yaml`; 9
  new unit tests in `services/__tests__/longitudinalDriftChecker.test.js`
  (38/38 green in that file); a hermetic `--check` gate script
  (`scripts/report-longitudinal-drift-stage-a4.js`) proving the new
  scenarios resolve correctly and the new checker pair behaves per this
  section's frozen gate on synthetic rows — zero paid calls, zero DB/
  network touches (deliberately narrower in scope than §8.6's gate: it
  does not re-prove the internal delivery mechanism itself, which Part
  1's own hermetic tests at the `tutor-core` function-call level already
  cover exhaustively). Gate: unit tests green, `--check` green, lint/
  prettier clean on touched files.
- **Stage A4-pilot (small paid pilot, authorized by this section only):**
  pad-ON session 1 → §7.4 live gate → on PASS, pad-ON session 2 →
  live internal-path-delivery gate (§9.4, via `--verify-live`) → on PASS,
  pad-ON session 3; pad-OFF arm runs all 3 sessions unchanged from A2/A3
  (no learner-id, no injection step) → score both arms with
  `scripts/report-longitudinal-drift-stage-a4-live.js --score` → record
  verdicts per §9.4.
- **Anything beyond Stage A4:** requires a fresh pre-registration and its
  own recorded go, per §9.4's stop rule.

### 9.7 Implementation log

**Part 1 (already committed, `686145ece2662cb1ae01a54c5f26354b3edcc3bd`,
2026-07-07): the four internal read-path fixes described in §9.1,
engineering-only, no pre-registration needed.** 15 new hermetic tests
across four new test files, all green; `services/
writingPadNarrativeBuilder.js` retained (not deleted), with a "STATUS
UPDATE (§8.8)" paragraph added to its docblock marking it as the
retained A3 instrument, no longer wired into A4's design.

**Stage A4-build (2026-07-07): complete and green.** Checker functions
added (`services/longitudinalDriftChecker.js` version bumped 1.1 → 1.2);
three `_checkin` scenarios added to `config/suggestion-scenarios.yaml`
and verified via `getScenario()` to resolve with `turns.length === 3`
each; 9 new tests added to `services/__tests__/longitudinalDriftChecker.test.js`
(one initially-mis-asserted test caught and corrected against this
section's own ≥3/4 threshold before landing — recorded here per this
note's convention of logging in-flight corrections rather than silently
fixing them; the file's own git history/diff carries the detail); full
file run: 38/38 pass. New hermetic gate script
`scripts/report-longitudinal-drift-stage-a4.js --check`: 14/14 checks
PASSED. New live-scoring script
`scripts/report-longitudinal-drift-stage-a4-live.js` written, mirroring
§8's `-a3-live.js` `--gate`/`--score` shape with a new `--verify-live`
mode for this section's live internal-path-delivery gate and no
`--build-injection` mode (not needed — §9.1's internal path is the
canonical channel this stage uses). Smoke-invoked read-only against the
real DB with placeholder/non-existent ids to confirm no crashes on
missing rows (`--gate` on an absent learner-id correctly reports
`INSTRUMENT_FLOOR`; `--verify-live` on an absent run correctly reports
"no dialogue log found"; `--score` on a bogus run-id correctly reports
an instrument-failure row and a FAIL verdict) — no real session data
scored yet, no paid calls made. Stage A4-build is complete and green;
Stage A4-pilot (the 6-session live arc) follows next.

**Stage A4-pilot, pad-ON sessions 1-2 + the live delivery gate
(2026-07-07): §7.4 gate PASS; §9.4 gate VOID-AS-INSTRUMENTED with
delivery itself CONFIRMED live by direct primary-source inspection.**
Recorded in full, per this note's convention of logging in-flight
instrument corrections rather than silently fixing them:

- **Pad-ON session 1** (`eval-2026-07-06-edecf6f8`, row 33950, scenario
  `longitudinal_drift_session_1_multiturn_checkin`, 4/4 turns clean,
  run metadata pins `gitCommit: 426a483b`): §7.4 instrument-precondition
  gate **PASS** — `total_recognition_moments = 4` (column == raw row
  count), the same all-4-turns-disapproved shape A2 saw, voices quoting
  the session's actual fractions content.
- **Pad-ON session 2** (`eval-2026-07-06-3075efb4`, row 33951, 4/4
  turns clean). Two defects were then found in the `--verify-live`
  instrument itself, before any gate verdict was accepted:
  1. **Script path/counting corrections** (in-flight, recorded): the
     mode as committed looked for `logs/<runId>.jsonl`, which does not
     exist — the real per-session dialogue log is
     `logs/tutor-dialogues/<dialogue_id>.json` resolved via the run's
     result row, exactly the file §8.8 used. It also over-counted
     matched entries (a `hitMarkers`-accumulation bug made every entry
     after the first match count as a hit). Both fixed in
     `scripts/report-longitudinal-drift-stage-a4-live.js` before
     scoring; the fix is instrument-repair, not a design change — §9.4
     froze the *method* (dialogue-log `apiPayload` inspection per §8.8),
     which the corrected script now actually implements.
  2. **The corrected scan then produced a false PASS**: 11/11
     `dialogueTrace` `apiPayload` entries matched session-1 vocabulary
     (`fractions`, `denominator`) — but every match traces to session
     2's OWN scenario `learner_context` ("Last session's fractions work
     is complete; the common-denominator-by-multiplying pattern is
     resolved…"), which §7.2's drift schedule plants by design in BOTH
     arms. Under §8.8's false-positive-immunity standard (which §9.4
     explicitly invokes), the scan was re-run on pad-only strings —
     literal session-1 recognition-moment text (superego-generated at
     session-1 runtime, impossible to originate in any scenario YAML:
     "1/2+1/4", "least common denominator", "breakthrough moment",
     "cognitive conflict", "LDS-M1"): **0 of 11 entries hit**.
- **Investigation (all read-only, no further spend until resolved)**:
  the zero is a *structural blind spot in the observable, not absent
  delivery*. On cell_40's live path the four §9.1 fixes feed the
  dialectical layer — `tutorDialogueEngine.egoGenerateSuggestions` →
  `dialecticalEngine.negotiateDialectically` →
  `generateSuperegoCritique` / `egoRespondsToSuperego`, whose prompts
  unconditionally embed `unconscious.permanentTraces.slice(-3)` (the
  §9.1-bug-1 `priorSessionMemory` section) and
  `preconscious.recentPatterns.slice(0, 3)` (the §9.1-bug-2 channel)
  whenever a learner pad exists. Those calls go through
  `aiService.generateText`, which is logged NOWHERE with prompt text:
  not in the dialogue log's `apiPayload` entries (those cover only the
  standard ego/superego loop via `callAI`) and not in
  `logs/tutor-api/*.jsonl` (same `callAI` universe — grep for the
  critique prompt's own unconditional headings, e.g. "Prior recognition
  moments", across the full day's log: 0). The §9.4 observable can
  therefore never witness this channel, in either direction.
- **Delivery confirmation, by the same direct primary-source standard
  §8.8/§9.4 demand, on artifacts rather than the unlogged prompt
  string**: (a) `negotiateDialectically` demonstrably ran per turn in
  session 2 — turns 1-3 each wrote a recognition moment (21:21:05,
  21:28:41, 21:36:17) whose LLM-generated ghost voices quote session
  2's live ratio content ("4:5 and 4:6", "2:3 scales to 4:6, not 4:5"),
  and turn 4's stored suggestion carries
  `metadata.dialecticalStrategy: "no_conflict"`; (b) at every one of
  those calls the freshly-fetched pad (fetched per turn at
  `tutorDialogueEngine.js` line ~1806) contained session-1 content —
  `permanentTraces` held session 1's 4 traces with real synthesis text
  from before session 2 began, and `preconscious.recentPatterns`
  acquired two cross-session `recalled_context` entries (signatures
  referencing session-1 trace timestamps 21:05:14 / 21:13:50, one
  carrying the literal session-1 synthesis "1/2+1/4 only requires a
  denominator of 4… least common denominator…") at 21:22:39, i.e. from
  turn 1's memory cycle onward, reinforced ×3 across turns 2-4 — the
  §9.1-bug-2 fix visibly persisting cross-session retrievals live;
  (c) the code embedding that pad state into those prompts is pinned to
  the run's own recorded commit (426a483b). Conclusion: **session-1 pad
  content reached session 2's dialectical prompts on every turn
  (`priorSessionMemory` from turn 1; `recentPatterns` from turn 2) —
  the internal read path delivers live.** Gate disposition, following
  §6's Stage-A1 precedent of recording instrument problems as VOID
  rather than re-reading them as outcomes: §9.4's live gate is **VOID
  as instrumented** (confounded markers + blind observable), delivery
  is **CONFIRMED** by the above triangulation, the stop rule's literal
  trigger ("no `apiPayload` entry contains any session-1 marker") is
  not met, and the pilot proceeds to session 3 and the pad-OFF arm.
- **Two bounded caveats recorded now, before scoring**: (i) the pad
  content demonstrably reaches the *dialectical critique/negotiation
  prompts*; its influence on the SCORED channel (the opening turn's
  final delivered message) is indirect — on session 2's turns 1-3 the
  negotiation wrote moments but left no `dialecticalStrategy` metadata
  on the stored suggestions, consistent with the negotiation's
  resolution not replacing the ego's message on those turns — so a
  check-in miss at scoring time is interpretable as
  "delivered-but-not-used", NOT "not delivered" (and conversely a hit
  is not automatically pad-attributable, see ii). (ii) The scenario's
  own `learner_context` plants prior-session vocabulary (`fractions`,
  `denominator`) in BOTH arms by §7.2 design, so the primary checker
  can hit off scenario echo alone in either arm; §9.4's red-flag clause
  (any pad-OFF hit → investigate as leakage, never a pad-OFF finding)
  already governs the pad-OFF side, and the pad-ON side's
  interpretation must carry the same echo caveat symmetrically. Neither
  caveat changes the frozen thresholds; both bind the §9.4-verdict
  *interpretation* recorded after scoring.

**Stage A4-pilot, completion and verdict (2026-07-07): 6/6 sessions
clean; structural-signal gate FAIL — pad-ON 0/4, pad-OFF 0/4; no red
flag; no instrument failures. A symmetric null: the scripted check-in
slot does not surface prior-session content in the delivered opening in
either arm.**

- **Runs** (all `--skip-rubric`, 4/4 turns each, `success = 1`):
  pad-ON `eval-2026-07-06-edecf6f8` / `-3075efb4` / `-c5bc6075` (rows
  33950-33952, learner `a4-drift-padon-v1-2026-07-07`); pad-OFF
  `eval-2026-07-06-38d45370` / `-14256553` / `-14a100bc` (rows
  33953-33955, no learner-id — the runner assigns per-dialogue synthetic
  ids, matching §7.7's recorded A2 behavior). Pad-ON session 3 ran
  concurrently with the pad-OFF chain (2 sessions max in flight; safe by
  design — pad-OFF has no cross-session state to contaminate).
- **Frozen §9.4 scoring** (checker `longitudinalDriftChecker@1.2`,
  artifacts `exports/longitudinal-drift-stage-a4.{json,md}`): every
  applicable slot is a miss — content-bearing check-in 0/2 and
  continuity-acknowledgment 0/2 in BOTH arms (session-1 rows n/a by
  design). Aggregate: pad-ON **0/4** (gate required ≥3/4), pad-OFF
  **0/4** (gate required exactly this) → **FAIL**. Red flag: none.
  Instrument failures: none.
- **The six openings, read directly** (all 94-270 chars): every one
  opens mid-topic on the CURRENT session's math ("You added the same
  number to both terms. Let's review how to scale ratios correctly…" —
  pad-ON s2; "Practice flipping the sign when you multiply or divide by
  a negative number…" — pad-ON s3; pad-OFF equivalents likewise) with
  zero retrospective content. Notably, neither arm even echoes the
  scenario-planted continuity vocabulary ("Last session's fractions
  work is complete…" sits verbatim in both arms' ego prompts) — §9.7's
  pre-scoring caveat (ii) (scenario-echo inflation) turned out moot in
  practice; the misses are genuine and symmetric, not
  checker-vocabulary artifacts.
- **Delivery context (caveat (i) active)**: the pad-ON memory channel
  was demonstrably compounding while the openings stayed
  memory-silent — after session 3 the pad holds 9 recognition moments,
  and `preconscious.recentPatterns` carries ALL 7 prior-session moments
  as cross-session `recalled_context` entries (session-1 content
  reinforced up to ×7, session-2 content ×4), i.e. session 3's
  dialectical prompts carried BOTH prior sessions' content. The A4 null
  is therefore read as **delivered-but-not-used at the scored channel**:
  prior-session content reaches the dialectical critique/negotiation
  prompts every turn, but the delivered opening suggestion — the ego's
  suggestion-JSON genre answering the current learner message — never
  carries it (consistent with the negotiation's resolution not
  replacing the ego's message: no `dialecticalStrategy` metadata on any
  scored opening).
- **Marker-grep (leakage check), with a recorded scoping lesson**: a
  coarse sweep of the pad-OFF dialogue logs for "pad-only" strings hit
  on '1/2+1/4' (s1), '4:6, not 4:5' (s2), 'missed flipping' (s3),
  'cognitive conflict'/'Master-Servant' (all) — ALL explained without
  leakage: each is same-session content (both arms share the scenario's
  math), shared-curriculum idiom (the EPOL 479 Hegel material), or
  shared superego-model idiom — the same author-confound/costume lesson
  the poetics arc recorded. Properly-scoped cross-session probes
  (session-1-specific strings in pad-OFF s2/s3; session-2-specific in
  s3, each first checked absent from the session's own scenario text):
  ALL absent, except a single '4:5' in pad-OFF s3 confirmed by direct
  inspection to be an HTTP `date` header substring ("23:14:53 GMT") —
  the exact §8.8 '2:3' precedent. **No genuine cross-session leakage;
  the pad-OFF arm is clean.**
- **Cost**: callAI-universe tokens measured from `logs/tutor-api/`
  over the pilot window: 82 calls, 444,205 in / 282,108 out
  (nemotron 340K/224K, kimi-k2.5 104K/59K) — a lower bound, since the
  dialectical-layer calls are unlogged (the observability gap recorded
  above); consistent with A2/A3's ~$0.27-0.30 for the identical
  6-session shape. Envelope respected.
- **Bounded interpretation (directional-only at n=3 sessions/arm, per
  §9.4/§9.5)**: A4 answers its §9.5 question in the negative on this
  stack — even when the check-in move is structurally guaranteed
  (identical explicit instruction in both arms' session-open prompts)
  AND the internal memory path is demonstrably delivering prior-session
  content into the model's deliberation prompts (this section's
  delivery confirmation), the delivered opening does not reference that
  content specifically. A3's spontaneous continuity null therefore
  EXTENDS to the scripted case. The lineage now locates the block one
  layer further out than A3 left it: A2 = channel broken (instrument
  gap); A3 = channel externally injected, unprompted continuity null;
  A4 = channel internally repaired + move scripted, continuity still
  null at the delivered-output layer — pointing at the output
  genre/policy (the ego's forward-looking suggestion format and/or the
  negotiation's non-rewriting resolutions), not at memory access. What
  would move next — an output-side lever (e.g. scoring a dedicated
  check-in sentence the format explicitly requests, or wiring the
  negotiation resolution into the delivered message) — is a fresh
  design decision, NOT licensed here.
- **STOP**: the §9.4 envelope (6 sessions / 24 turns) is exhausted and
  the stop rule holds — nothing further on this line without a fresh
  pre-registration and its own recorded go.

## 10. Stage A4-codex — stack-swap rerun of the structural check-in pilot (fresh pre-registration, frozen before spend)

Pre-registered 2026-07-07, before any paid session, under a direct user
directive relayed and confirmed by the coordinating session (see the
2026-07-07 correction in §9.2): "ensure that nemotron / kimi is *never*
the default pairing... by default now, use codex or sonnet 5 via the
cli, unless otherwise specified. Feels like this entire run is wasted,
and we are producing false negatives accordingly." The standing policy
half of that directive is implemented independently of this section
(CLAUDE.md "Model stack default"; `services/stackDefaultWarning.js`);
this section pre-registers the empirical half.

### 10.1 Purpose: a direct test of the stack-bounded-null hypothesis

§9 closed with a symmetric null (pad-ON 0/4, pad-OFF 0/4) on the
nemotron/kimi stack, read as delivered-but-not-used: prior-session pad
content demonstrably reached the dialectical deliberation prompts while
the delivered opening stayed memory-silent. Two candidate explanations
were left standing, and this stage is designed to adjudicate between
them:

- **(a) Output-threading defect (architecture-side).** The negotiation's
  resolution frequently fails to rewrite the delivered message. Located
  precisely during this stage's design review:
  `dialecticalEngine.negotiateDialectically` returns
  `resolution: synthesis?.resolution || finalResolution`, where
  `finalResolution` is the dialectical ego's last `revision` — so a
  falsy resolution (which skips the message rewrite and the
  `dialecticalStrategy` metadata in `tutorDialogueEngine`, the exact
  no-metadata shape §9.7 observed on moment-writing turns) requires the
  ego's `revision` field to come back as an EMPTY string. The
  ego-response CATCH path returns the original message (truthy), so
  empty revisions are a parsed-but-degenerate model output — a
  weak-model JSON failure shape, not a thrown error.
- **(b) Model capability (generation-side).** Even with recalled context
  sitting in its prompts, the weak ego never weaves it into the
  delivered suggestion-JSON opening — a stronger model might, within
  the unchanged format and policy.

These are not mutually exclusive. Interpretation map: §10.5. Per the
user directive, if codex surfaces pad content where nemotron didn't,
the A2-A4 nulls were (at least partly) capability artifacts; if the
null replicates on codex, the output-layer explanation strengthens.

### 10.2 Design — identical to §9.2 except the generation stack

Everything §9.2 froze carries forward unchanged (arms cell_40 pad-ON /
cell_93 pad-OFF; the three `_checkin` scenarios and their identical
scripted check-in slot; 3 sessions × 2 arms × 4 turns = 24 tutor
generations; execution order with the pad-ON-session-1 canary; the
§7.4 gate; pad-OFF runs with no learner-id), with ONE change, recorded
with the user-directive rationale above:

- **Generation stack = `codex.gpt-5.5` via the new external-provider
  hook** (Part 1, commit e11b4c1e): `--ego-model codex.gpt-5.5
  --superego-model codex.gpt-5.5` on every session, identically in both
  arms. Coverage on this path, verified hermetically before this
  freeze (tests/cliBridgeDialogueEngine.test.js — zero HTTP LLM calls
  escape): the standard callAI loop (ego / superego review / ego
  revise), the dialectical critique/negotiation layer
  (aiService.generateText → unified call), and the
  self-reflection/disposition-rewriting channel (the runner mirrors CLI
  overrides into the rewriter profile). The learner is `unified`
  (scripted YAML turns) exactly as in §7-§9 — there are NO learner LLM
  calls in this design, so nothing remains on the weak stack.
- **New, distinct pad-ON learner-id**: `a4c-drift-padon-v1-2026-07-07`
  (fresh trajectory; §9's pad carries nemotron-era history). Pad-OFF:
  no learner-id, unchanged.
- **No nemotron continuity arm.** §9's six sessions (run 2026-07-07,
  identical design, same frozen checker v1.2) ARE the weak-stack
  baseline; re-running it would double spend for a duplicate of a
  day-old result. Recorded as a scope decision, not a deviation.
- **Env**: `CLI_PROVIDER_CODEX_TIMEOUT_MS=600000` (long codex
  generations; the bridge's own env seam — the task template's
  ID_DIRECTOR_* var is inapplicable here and not set).
  `CODEX_REASONING_EFFORT` left at the bridge default.
- **Cost/observability accounting (pre-declared)**: CLI calls report 0
  tokens and appear nowhere in `logs/tutor-api/` — cost is Max-plan
  quota; wall-clock per session is recorded instead. The fetch-level
  apiPayload capture is structurally empty on this path, but Part 1's
  `cli_capture` channel (apiPayloadCapture.recordExternalApiCall,
  wired into the bridge hook) restores dialogue-log `apiPayload`
  entries for the callAI universe — §9.4's payload-grep delivery
  observable is therefore BACK in force there. The dialectical layer
  remains unlogged with prompt text (same §9.7 blind spot), so
  delivery verification there continues to triangulate via
  recognition-moment artifacts + pad state, exactly as §9.7 did.
- **Idempotent resume through kills**: each session is one
  `eval-cli run ... --runs 1 --skip-rubric` invocation; a killed
  session leaves a failed/incomplete row — re-run that session (or
  `eval-cli resume <runId> --skip-rubric`) before proceeding; a pad-ON
  session that dies mid-way has its pad inspected first — if the pad
  carries partial-session moments that would contaminate the schedule,
  the ARM restarts under a fresh learner-id (`...-v2`), recorded here.

### 10.3 Outcomes — §9.3's instruments unchanged, plus threading diagnostics

- **Primary and secondary**: identical to §9.3 —
  `scoreContentBearingCheckIn` and `scoreContinuityAcknowledgment`
  (checker `longitudinalDriftChecker@1.2`, byte-unchanged), the frozen
  4-slot aggregate, scored by
  `scripts/report-longitudinal-drift-stage-a4-live.js --score` over
  this stage's six run ids. The §9 pad-content secondary trace is
  likewise recorded per pad-ON session.
- **NEW diagnostic (no gate attached): resolution-threading rate.** Per
  turn, from artifacts already persisted (recognition_moments rows,
  stored suggestion metadata, dialogue logs): (i) was a moment written;
  (ii) does the stored suggestion carry `metadata.dialecticalStrategy`;
  (iii) when a moment exists, is its `synthesis_resolution` non-empty.
  Aggregated per arm. This maps outcomes to explanation (a): a high
  threading rate on codex (resolutions non-empty and delivered) with a
  persisting check-in null points AWAY from (a) and at genre/policy; a
  still-low threading rate on codex localizes (a) as stack-independent.
  Diagnostic only — it cannot flip the §10.4 gates.

### 10.4 Frozen thresholds and stop rules

Carried from §9.4 with the canary made explicit:

- **Codex-generation canary (= pad-ON session 1, not an extra
  session)**: 4/4 turns clean with non-empty delivered messages, AND
  the §7.4 gate (`total_recognition_moments >= 1`, live DB) — §7.4's
  gate is unchanged in force. Any generation failure, empty output, or
  bridge error: STOP, fix, re-run the canary via resume before any
  further spend. (This is the §9.6 "pad writes still occur" check on
  the new stack.)
- **Live delivery gate after pad-ON session 2**: `--verify-live`, under
  §9.7's recorded instrument corrections (pad-only marker scoping; the
  scenario-echo false-positive immunity standard). Pre-declared
  observable change: `apiPayload` entries on this stack come from the
  `cli_capture` channel.
- **Structural-signal gate**: pad-ON ≥ 3/4 AND pad-OFF = 0/4 —
  unchanged.
- **Red flag**: any pad-OFF content-bearing hit → investigated as
  leakage, never a pad-OFF finding — unchanged.
- **The two frozen §9.7 interpretation caveats carry over verbatim**:
  (i) a check-in miss is "delivered-but-not-used", NOT "not delivered"
  (the threading diagnostic now partially disambiguates, and delivery
  itself is re-verified per the gates above, but the caveat binds the
  verdict wording exactly as in §9); (ii) the scenario plants
  prior-session vocabulary in BOTH arms, so any hit carries the
  symmetric scenario-echo caveat.
- **Envelope**: exactly 6 sessions / 24 turns, canary included. Row- or
  session-level instrument failures are excluded from denominators and
  reported, per §3/§7.4/§8.5/§9.4. Nothing beyond this envelope —
  including any output-side lever implementation (§10.5) — without a
  fresh pre-registration and go.
- Directional-only at n = 3 sessions/arm, as everywhere in this arc.

### 10.5 Interpretation map (frozen before results)

- **Gate PASS on codex** (pad-ON ≥3/4, pad-OFF 0/4): §9's null was
  stack-bounded — a capability artifact, per the user's false-negative
  suspicion. Explanation (b) confirmed as sufficient at this n;
  (a) may still co-exist (read the threading diagnostic), but is not
  needed to explain §9. The A2/A3 nulls inherit a stack-bounded caveat.
- **Symmetric FAIL replicating §9's shape** (pad-ON 0/4, pad-OFF 0/4,
  no red flag), with a HIGH codex threading rate: the null survives a
  strong model AND working resolution-threading — the block localizes
  to output genre/policy (the §9.7 reading strengthens); the
  false-negative hypothesis is not supported for THIS design's scored
  channel. The nemotron/kimi deprecation stands regardless (it is
  policy, not contingent on this result).
- **Symmetric FAIL with a LOW codex threading rate**: (a) survives the
  stack swap — the threading defect is architectural; fixing it (e.g.
  wiring negotiation resolutions into delivery behind a flag) becomes
  the licensed next design question, separately pre-registered.
- **Mixed / partial** (pad-ON 1-2/4, or any pad-OFF hit): directional
  only; report slot-level results with both carried caveats; no verdict
  language beyond "not licensed at this n".
- In ALL branches: per the new standing rule, any future null generated
  on nemotron/kimi is stack-bounded until replicated strong; this
  section's result determines whether that caveat retroactively
  attaches to §7-§9's substantive readings ((a)/(b) adjudication), not
  whether the policy holds.

### 10.6 Implementation log

**2026-07-07: Section frozen and committed before any spend.** Bridge
(Part 1) and policy (Part 2) landed as commits e11b4c1e / f1791417 with
hermetic proofs; no paid session has run under this section yet.
Execution follows: canary (pad-ON session 1) → §7.4 + canary gates →
pad-ON 2 → delivery gate → pad-ON 3 → pad-OFF 1→2→3 → `--score` →
verdict + §9-comparison recorded here and on the workplan card.

**2026-07-07: In-flight instrument defect found by the canary itself,
fixed and committed before any successful spend (b901d152).** The first
two canary attempts died in ~233ms with "Provider codex not configured
(missing API key)" and were auto-classified transient (zero rows
persisted, pad untouched — verified). Root cause, established with
temporary instrumentation (a `handles()`/setter trace): the hook was
registered inside `evaluationRunner`'s lazy
`import('../tutor-core/index.js').then(...)` block, whose continuation
is serviced by loader macrotasks — and this run's entire path to the
first LLM call is synchronous/microtask-only (better-sqlite3 + config
reads), so the registration fired only at process teardown, AFTER the
failed call. This also explains why the hermetic test had passed: its
setup awaited a 25ms timer (a macrotask), unknowingly masking the race.
Fix: register synchronously at module load via the existing static
namespace import; new deterministic regression test (static import →
synchronous `handles('codex')` check in a child process, no event-loop
turn allowed). Instrument repair, not a design change; the two burned
attempts consumed no envelope rows (transient, unpersisted).

**2026-07-07: Canary (pad-ON session 1) + both live gates PASS; codex
stack confirmed live end-to-end.**

- **Pad-ON session 1** = `eval-2026-07-07-139daa20` (4/4 turns clean,
  `success=1`, non-empty suggestions, wall-clock 6.7 min): canary gate
  PASS. **§7.4 gate PASS** — `total_recognition_moments = 1` (column ==
  raw row count == 1; the codex dialectical superego disapproves far
  less often than nemotron/kimi's — §9's session 1 wrote 4 — but the
  gate is ≥1 and the moment is real, quoting the session's actual
  fractions content: "for 1/3 + 1/5, 15 is the least common
  denominator... compare that with 1/4 + 1/6...").
- **Pad-ON session 2** = `eval-2026-07-07-ffaac9d7` (4/4 turns clean).
  **Live delivery gate PASS, at BOTH scoping levels**: naive §9.4 scan
  12/12 `apiPayload` entries carry prior-session vocabulary from the
  first ego-generate call onward (markers: fractions, denominator,
  common denominator) — and, decisively, the §9.7-scoped PAD-ONLY
  probes pass too: "unnecessarily large denominator" (superego-generated
  at session-1 runtime, zero occurrences anywhere in
  config/suggestion-scenarios.yaml) appears 4x in session 2's dialogue
  log, and "1/3 + 1/5" (present only in the two session-1 scenario
  blocks, absent from session 2's own scenario text) appears 4x. Unlike
  §9 — where the pad-only scan hit 0/11 because the dialectical calls
  were unlogged — the new `cli_capture` channel witnesses these
  payloads directly: the §9 observability hole is closed in production,
  not just hermetically.
- Remaining sessions (pad-ON 3; pad-OFF 1→2→3, cell_93, no learner-id)
  launched sequentially on the same stack; scoring next.

**2026-07-07: Stage A4-codex completion and verdict — 6/6 sessions
clean; structural-signal gate FAIL (pad-ON 2/4, pad-OFF 2/4); red flag
raised and resolved as scenario echo; the §10.5 "mixed/partial" branch
binds: directional-only reporting, no strong verdict licensed at this
n. The informative content is in the two comparisons below.**

- **Runs** (all `--skip-rubric`, 4/4 turns each, `success = 1`, 0
  instrument failures): pad-ON `eval-2026-07-07-139daa20` / `-ffaac9d7`
  / `-44a48b61` (learner `a4c-drift-padon-v1-2026-07-07`); pad-OFF
  `eval-2026-07-07-433a19d2` / `-b7b30353` / `-49cbde02` (no
  learner-id). Wall-clock 5m49s-6m48s per session, ~37.5 min total
  (vs ~22 min/session on nemotron); cost = Max-plan codex quota, CLI
  calls report 0 tokens (pre-declared).
- **Frozen §9.4/§10.4 scoring** (checker `longitudinalDriftChecker@1.2`,
  artifacts `exports/longitudinal-drift-stage-a4-codex.{json,md}`):
  session-2 slots MISS in both arms; session-3 slots HIT in BOTH arms
  (content-bearing check-in + continuity-acknowledgment). Aggregate:
  pad-ON **2/4** (gate required ≥3/4), pad-OFF **2/4** (gate required
  0/4) → **FAIL**.
- **Red flag investigated, not glossed (frozen requirement)**: the
  pad-OFF session-3 hits are SCENARIO ECHO, the exact pre-registered
  caveat (ii) shape — session 3's `learner_context` plants "Last
  session's ratio work is complete; the additive-scaling pattern is
  resolved" in BOTH arms, and both arms' openings echo it ("Your ratio
  work is settled. Pause on linear equations..." pad-OFF; "Your ratios
  are resolved. Pause on linear equations..." pad-ON). Pad-only leakage
  probes: "unnecessarily large denominator" / "share no factors besides
  1" / "evades the exact rule" (session-1/3 pad-ON moment text,
  pre-checked absent from all scenario YAML) — 0 hits in all three
  pad-OFF logs; a single "x=0 self-check" hit in pad-OFF s3 is the
  tutor's own compression of session 3's OWN scripted learner turn
  ("if I substitute x = 0 into x > -3...", scenario YAML lines
  2341/2603) — same-session content + shared-model idiom, the §8.8
  '2:3' / §9.7 '4:5' precedent class. **No genuine cross-session
  leakage; the pad-OFF arm is clean.** By symmetry (caveat (ii)), the
  pad-ON session-3 hits are equally scenario-echo-attributable — NOT
  pad-attributable.
- **§7.4 pad trace**: codex writes far fewer recognition moments —
  2 total (sessions 1 and 3; session 2 wrote none) vs nemotron's 9
  (4+3+2): the codex dialectical superego disapproves much less often.
  Both moments are real, transformative-flagged, and quote live session
  math.
- **Threading diagnostic (§10.3) — explanation (a) CONFIRMED AT CODE
  LEVEL, stack-independent, and RELOCATED**: `dialecticalStrategy`
  metadata appears on **0/24 turns in both arms** (nemotron §9 showed
  the same shape). A hermetic probe (fake provider returning a
  guaranteed `disapproves: false` critique — perfect-model conditions)
  reproduces `metadata: null`, proving the loss is not a weak-model
  empty-revision artifact: on dialogue-enabled cells (cell_40/93 have
  `dialogue.enabled: true`), `negotiateDialectically` runs only inside
  the INITIAL `egoGenerateSuggestions`, and the outer dialogue loop's
  superego-review→ego-revise round then REPLACES the suggestions array
  wholesale — discarding the negotiated message and metadata every time
  a revision round runs. §9.7's turn-4 `no_conflict` metadata survived
  only because that turn converged without revision. The pad→
  negotiation→delivered-output chain is therefore structurally severed
  on these cells whenever the dialogue loop revises — the output-
  threading defect is ARCHITECTURAL (fix = separately pre-registered
  design decision, per the frozen §10.5 map; not implemented here).
- **Comparison to §9 (nemotron/kimi baseline, identical design/checker)**:
  - Surface behavior: nemotron 0/4 and 0/4 — even the scenario-planted
    continuity text went un-echoed in every opening; codex 2/4 and 2/4
    — the scripted check-in slot + planted context now sometimes
    produce a genuine continuity-acknowledging, prior-topic-referencing
    opening (session 3 both arms; session 2 neither arm). On the
    slot-level outcome the weak stack was suppressing real behavioral
    signal.
  - The pre-registered CONTRAST (pad-ON − pad-OFF): **0 on both stacks**
    (0/4−0/4 nemotron; 2/4−2/4 codex). The memory channel adds nothing
    to the delivered opening beyond what the scenario itself states, on
    either stack.
- **Answer to the §10.1 question (bounded, directional-only at n=3
  sessions/arm)**: the stack-bounded-null hypothesis splits. YES at the
  behavior-surface level — §9's all-zero slot pattern was partly a
  capability artifact (codex acts on the scripted check-in where
  nemotron never did), so nemotron/kimi WAS suppressing signal and the
  standing default-stack rule has empirical support from this arc's own
  data. NO at the contrast level — the pad-vs-no-pad null REPLICATES
  exactly on the strong stack, and the code-level threading finding
  supplies an architectural mechanism (the negotiation channel, where
  pad content demonstrably lands, cannot rewrite the delivered opening
  through the dialogue loop's revision). A2-A4's memory-contrast nulls
  are therefore NOT overturned as false negatives; §9's
  delivered-but-not-used reading strengthens, now with the block
  pinned to a specific, fixable code hop rather than a genre/policy
  conjecture alone.
- **STOP per §10.4**: the 6-session envelope is exhausted (plus two
  transient, unpersisted pre-fix canary attempts and one 233ms
  throwaway debug run, none consuming envelope rows). Output-side
  levers — wiring negotiation resolutions into delivery, or a
  check-in-sentence format change — remain fresh design decisions
  requiring a new pre-registration and go.

## 11. Stage A5 — negotiation threading + three-arm drift test (fresh pre-registration, frozen before spend)

Part 1 (this session, ordinary engineering — not itself a pre-registered
empirical claim), commit `289e6930`: adds `threadNegotiationResolution`
(default `false`) to `tutor-core/services/tutorDialogueEngine.js`'s
`runDialogue()`. When the outer superego-review → ego-revise loop
replaces `currentSuggestions` wholesale on a revision round, the flag
re-applies the negotiated resolution captured from the turn's own
initial `dialecticalNegotiation` call instead of letting it be silently
discarded — the exact mechanism §10.6 pinned architecturally (see
below). Threaded through `tutorApiService.js` (`threadNegotiationResolution`
param, passed into `runDialogue`'s options) and `services/evaluationRunner.js`
(CLI flag → run metadata → checkpoint-resume precedence → per-turn
generation), exposed as `--thread-negotiation-resolution` in
`scripts/eval-cli.js`. Off by default: byte-identical to every prior
stage's behaviour without it. Hermetic regression test
`tests/negotiationThreading.test.js` (6/6 passing) proves both arms on
a real multi-turn scenario/cell (`cell_40_base_dialectical_suspicious_unified_superego`,
`longitudinal_drift_session_1_multiturn_checkin`, fake CLI hook, zero
network): flag off reproduces the discard exactly (post-revision
suggestions and trace entries lack `dialecticalStrategy` metadata even
though negotiation demonstrably runs every turn); flag on threads both
the metadata and the negotiated message text through every post-revision
round into the delivered/stored suggestion. Full suite green (5075/5075,
1 pre-existing skip), lint and prettier clean.

### 11.1 Purpose and rationale

§10.6's hermetic perfect-model probe (a fake provider guaranteeing
`disapproves: false`) still reproduced `metadata: null` on every
post-revision turn — proving the §9/§10 checker null's most plausible
remaining architectural explanation, (a) output-threading defect, is
real and not a weak-model artifact: `dialecticalStrategy` metadata
appeared on 0/24 turns in BOTH arms of the real A4-codex paid run. §10's
own closing text named the fix — "wiring negotiation resolutions into
delivery" — as "a separately pre-registered design decision, not
implemented here." Part 1 is that decision, implemented and hermetically
proven. This section pre-registers the empirical question built on top
of it, before any paid spend: does actually threading the resolution
through change the structural-signal verdict that has been null or
mixed at every prior stage that reached this checker (§9: 0/4–0/4
nemotron/kimi; §10: 2/4–2/4 codex, "mixed/partial", no clean verdict
licensed)? And — the sharper, harder question — can the fix be trusted,
i.e. does it ever manufacture apparent cross-session continuity when
there is no real memory behind it to carry forward?

That second question is why this is a three-arm design rather than a
simple pad-ON-with-threading rerun. Threading only re-applies whatever a
turn's OWN initial `negotiateDialectically` call produced; it has no
special knowledge of whether that call had real pad content available.
If threading can make a check-in read as content-bearing even with the
pad absent, that would be a fabrication risk indistinguishable from
memory at the checker level — a strictly worse outcome than the null it
would be curing. Arm 3 exists to catch exactly that.

### 11.2 Design

Reused unchanged from §9–§10: cell pair `cell_40_base_dialectical_suspicious_unified_superego`
(pad-ON candidate) / `cell_93_base_dialectical_suspicious_unified_superego_nopad`
(pad-OFF candidate) — the only pairing used anywhere in the Line A arc;
the three `longitudinal_drift_session_{1,2,3}_multiturn_checkin`
scenarios and their scripted check-in slot; generation stack
`codex.gpt-5.5` for ego and superego via the CLI bridge
(`--ego-model codex.gpt-5.5 --superego-model codex.gpt-5.5`), per
CLAUDE.md's "Model stack default" rule; the frozen checker
`longitudinalDriftChecker@1.2` (`scoreContentBearingCheckIn` primary,
`scoreContinuityAcknowledgment` secondary), byte-unchanged.

**Three arms** (task-specified, each a full 3-session sequence on its
own fresh identity):

- **Arm 1 — pad-ON + threading ON.** Learner-id
  `a5-drift-padon-threadon-v1-2026-07-07`. `--thread-negotiation-resolution`
  set. The primary experimental condition: memory delivery (established
  working since §8/§9) combined with the now-fixed negotiation-to-delivery
  hop.
- **Arm 2 — pad-ON + threading OFF.** Learner-id
  `a5-drift-padon-threadoff-v1-2026-07-07`. Flag NOT set. This is the
  exact replication control of A4-codex §10: same cell, same scenarios,
  same stack, same pad-ON condition — a fresh, contemporaneous rerun
  rather than a re-citation of §10's own six rows, so the arm-1-vs-arm-2
  contrast is not confounded by anything that drifted between
  2026-07-07's two sessions (model version, prompt content, harness
  state). **§10 comparison line (frozen):** §10's pad-ON result on this
  identical design was **2/4**. Arm 2's result is reported directly
  alongside that number, unadjusted; a large deviation either direction
  (e.g. 0/4 or 4/4) is itself informative about run-to-run stochasticity
  at this n and must be flagged as such, not silently treated as
  confirming or overturning §10.
- **Arm 3 — pad-OFF + threading ON.** No learner-id (established
  pad-OFF convention — the runner assigns per-dialogue synthetic ids on
  the multi-turn path). `--thread-negotiation-resolution` set. The
  critical control: there is no persisted pad, so `negotiateDialectically`
  has no cross-session content available to any turn's negotiation in
  the first place. Any content-bearing check-in hit here cannot be
  explained by threading correctly carrying forward real memory — it
  would have to be scenario echo (the established `learner_context`
  confound, §10.6) or the fix itself fabricating apparent continuity.
  Threading is a same-turn, same-session mechanism (it re-applies a
  turn's own initial negotiation onto that turn's own post-revision
  suggestion); it is not itself a cross-session channel, so a structural
  0/4 is the mechanistically expected outcome — this arm exists to
  confirm that expectation empirically rather than assume it.

**Row count**: 3 arms × 3 sessions = 9 rows / 36 turns (each `_checkin`
session is 4 turns, matching §9/§10). Budget: ≈60 minutes of codex
quota, extrapolating A4-codex's observed ~6.25 min/session average
(range 5m49s–6m48s over 6 sessions).

**Execution order**: arm 1's session 1 runs alone first as the
threading-live canary (§11.4). After it clears, arm 1's sessions 2–3
run to completion, each gated, strictly sequentially — arm 1 and arm 2
are the direct pairwise contrast and share the same codex quota window,
so they run sequentially relative to each other rather than concurrently
(arm 2 begins only once arm 1's full 3-session sequence and its own
gates have cleared). Arm 3 has no cross-session state to protect
(mirroring §10.2's own reasoning for its pad-OFF concurrency allowance)
and may run interleaved with whichever pad-ON arm is not currently
blocked on a gate check, capped at 2 sessions in flight at any time —
the same cap §10 used.

**Env**: `CLI_PROVIDER_CODEX_TIMEOUT_MS=600000`. `CODEX_REASONING_EFFORT`
left at the bridge default. Not an adaptive-runner cell — `ADAPTIVE_TUTOR_LLM`
is not applicable.

**Idempotent resume through kills**: unchanged from §10.2 — each session
is one `eval-cli run ... --runs 1 --skip-rubric` invocation; a killed
session leaves a failed/incomplete row, re-run via resume before
proceeding; a pad-ON arm (1 or 2) that dies mid-session has its pad
inspected first, and if partial-session moments would contaminate the
schedule, that arm restarts under a fresh learner-id suffix (`...-v2`),
recorded in the implementation log.

### 11.3 Outcomes

- **Primary and secondary**: identical instruments to §9.3/§10.3 —
  `scoreContentBearingCheckIn` and `scoreContinuityAcknowledgment`,
  scored on each session's opening tutor turn
  (`suggestions[0].message`), aggregated per arm into the same frozen
  4-slot scale (2 sessions [2, 3] × 2 checkers, 0–4). The §9/§10 pad-content
  secondary trace is recorded per pad-ON arm (1 and 2).
- **New diagnostic (no gate attached, extends §10.3's threading
  diagnostic): per-turn threading-delivery rate.** For all 36 turns
  across all three arms, from artifacts already persisted: does the
  stored suggestion carry non-null `metadata.dialecticalStrategy`, and
  when it does, is the negotiated text detectably present in the
  delivered message (mirroring the hermetic test's own assertion
  shape). Expected shape if the fix is working as designed: arm 1 and
  arm 3 both show a materially higher rate than arm 2 (which should
  replicate §10's 0/24 finding, since the flag is off); arm 3's rate
  being nonzero is not itself informative about memory (see §11.2) —
  only a PAIRED content-bearing-checker hit in arm 3 is.
- **§10 comparison line**: restated from §11.2 — arm 2's fresh 2026-07-07
  pad-ON/threading-OFF result is reported directly against §10's own
  pad-ON 2/4, unadjusted, as the design's built-in same-day replication
  check.

### 11.4 Frozen thresholds and stop rules

1. **Threading-live canary (arm 1, session 1 only, not an extra row).**
   Normal generation hygiene (4/4 turns clean, non-empty delivered
   messages) AND at least 1 of the 4 turns' stored suggestion carries
   non-null `metadata.dialecticalStrategy`. This is the live-production
   counterpart to the hermetic test — proof the fix actually fires
   outside a fake-hook harness. FAIL → STOP, investigate, fix, re-canary
   via resume before any further spend.
2. **§7.4 precondition gate (arms 1 and 2, each after its own session
   1).** `total_recognition_moments >= 1`, live DB. Unchanged in force
   from A2 onward. FAIL on either arm → STOP that arm; a contaminated
   partial pad restarts under a fresh learner-id suffix, recorded in the
   implementation log.
3. **Delivery gate (arms 1 and 2, each after its own session 2).**
   §10's `--verify-live` method exactly: strict pad-only marker scoping
   — only markers that could originate from a prior session's own
   superego-generated recognition-moment text, never scenario-planted
   `learner_context` vocabulary — found in session-N's outgoing
   `apiPayload` (via the `cli_capture` channel on this stack). Checked
   identically on both pad-ON arms; structurally not applicable to arm 3
   (no pad). FAIL → triage per the established VOID-vs-genuine-absence
   pattern (§9.7/§10.6) before continuing that arm.
4. **Structural-signal gate (frozen, checked once all 9 sessions are
   scored)**: **arm 1 ≥ 3/4 AND arm 2 ≤ 1/4 AND arm 3 = 0/4**, all on
   the same 4-slot aggregate. This is the signal criterion for a clean
   read; see §11.5 for how partial patterns are interpreted.
5. **Red flag (arm 3 — the critical control).** ANY arm-3
   content-bearing-check-in or continuity-acknowledgment hit, at any
   session, is flagged and individually investigated (scenario-echo per
   §10.6's precedent vs. genuine fabrication) before it is folded into
   any interpretation. An arm-3 hit that survives scenario-echo triage
   is reported as a serious adverse finding about the fix — a threading
   mechanism that manufactures apparent continuity is not a fix — and
   overrides any positive arm-1 reading in the headline verdict.
6. **Envelope**: exactly 9 sessions / 36 turns total across all three
   arms (the canary is arm-1 session 1, already counted). Nothing beyond
   this — including any further output-side lever — runs without a
   fresh pre-registration and go. Directional-only at n = 3 sessions per
   arm, as everywhere in this arc.

### 11.5 Interpretation map (frozen before results)

- **Clean signal** (arm 1 ≥3/4, arm 2 ≤1/4, arm 3 = 0/4): threading
  does exactly what it was built to do — it recovers the
  memory-into-delivery path without fabricating content when there is
  nothing real to deliver. This would be the first positive
  structural-signal result anywhere in the Line A arc (§9 and §10 were
  null or mixed). Licenses, as a separate future pre-registration,
  turning the flag on more broadly — not licensed by this section
  alone.
- **Arm 1 clears its own bar but arm 2 lands near §10's own 2/4** (not
  ≤1/4), arm 3 = 0/4: the strict arm-2 ≤1/4 cutoff was calibrated before
  seeing that fresh reruns of the same design can land away from §10's
  point estimate at this n. Report both numbers plainly against the §10
  comparison line; let the SIZE of the arm-1-minus-arm-2 gap carry the
  interpretation rather than the pass/fail label on arm 2 alone. Still
  directional-only; do not upgrade to a clean-signal verdict.
- **Arm 1 low (<3/4) despite the threading-live canary passing**: the
  fix is threading *something* through, but not necessarily
  session-(N-1)-content-bearing something. Cross-check the threading-delivery
  diagnostic (§11.3) against the content-bearing checker specifically:
  high delivery-rate + low content-bearing-rate localizes the remaining
  gap upstream, to what the negotiation prompt itself draws on, not to
  the now-fixed delivery hop — a different, separately pre-registerable
  question. Do not conflate the two.
- **Arm 3 nonzero, cleanly attributable to scenario echo** (per §10.6's
  precedent: both arms' `learner_context` plants prior-session-adjacent
  vocabulary identically): note it, exclude it from the headline
  verdict, do not treat as a threading defect — but state explicitly
  that the echo confound is unresolved as a design limitation (see
  §11.6).
- **Arm 3 nonzero, NOT attributable to scenario echo**: reported as a
  genuine adverse finding regardless of arms 1–2's results — a fix that
  works by hallucinating memory is not a fix. This is the one branch
  that overrides an otherwise-clean signal on arms 1–2.
- **Symmetric-ish null** (arm 1 also low, ~0–1/4): the discard was
  fixed but the content still is not there to thread — §9/§10's
  "delivered-but-not-used" framing was incomplete. The deeper gap is
  upstream of delivery (what the negotiation prompt draws on), not the
  output hop Part 1 fixed. Read §10's 2/4–2/4 as closer to a ceiling
  than a floor for this cell/scenario/stack combination, not as
  something the threading bug was suppressing.
- In all branches: this section adjudicates the threading-defect
  question specifically; it does not re-open the nemotron/kimi
  stack-bounded caveat (§9/§10 territory) or license any run beyond the
  9-session envelope.

### 11.6 Scope and limits specific to A5

- n = 3 sessions/arm, 3 arms — directional-only, as every stage in this
  arc. No scaling without a fresh pre-registration.
- Single stack (`codex.gpt-5.5`) — does not re-adjudicate §9's
  nemotron/kimi result, which remains stack-bounded pending its own
  rerun; that is out of scope here.
- Single cell pair (`cell_40`/`cell_93`) — the only pairing used
  throughout Line A. A5 does not test whether threading matters for any
  other `dialectical_negotiation` cell.
- The dialectical layer's own sub-calls remain unlogged with prompt
  text — Part 1 changes what is DELIVERED, not what is logged, so the
  §9.7/§10.2 observability blind spot is unchanged. Delivery verification
  continues to triangulate via recognition-moment artifacts, pad state,
  and the new threading-delivery diagnostic, not `apiPayload` grep on
  the dialectical layer itself.
- The scenario-echo confound (§10.6) is a standing, unresolved
  instrument limitation, not something this stage's design fixes — it
  is the reason arm-3 hits require individual triage rather than a bare
  count.
- A5 tests whether the engineering fix changes the structural-signal
  verdict and whether it is safe (non-fabricating). It is not a claim
  about the tutor's understanding or intent — same framing discipline as
  every other stage: architecture-level behaviour, not mind-reading.

### 11.7 Stages and gates

- **Stage A5-build (no paid spend)**:
  - Threading tests green: `tests/negotiationThreading.test.js` (6/6 —
    already true, commit `289e6930`).
  - Full suite green, lint and prettier clean on all Part 1 files
    (already true, same commit).
  - New three-arm scorer: `scripts/report-longitudinal-drift-stage-a5-live.js`,
    modeled on `-a4-live.js`'s `--gate` / `--verify-live` / `--score`
    mode shape, generalized to three arm tokens (`padon-threadon`,
    `padon-threadoff`, `padoff-threadon`) and the three distinct gate
    thresholds in §11.4 point 4, plus a threading-delivery diagnostic
    mode reporting `metadata.dialecticalStrategy` presence per turn.
  - Gate: script written; a shape-only smoke of its `--score` path
    (e.g. reusing A4-codex's existing run ids to exercise the
    three-arm aggregation and threshold logic, clearly labeled as a
    smoke and not conflated with A5's own data) passes before any paid
    session runs.
- **Stage A5-pilot (paid, codex quota)**:
  - Session sequence: arm-1 session 1 (canary, hard gate) → arm-1
    sessions 2–3 (each gated) → arm-2 sessions 1–3 (each gated,
    sequential after arm 1 completes) — with arm-3's 3 sessions
    interleaved opportunistically throughout (capped at 2 sessions in
    flight), per §11.2's execution order.
  - Gate: §11.4's gates 1–3 clear live (or are triaged to a recorded,
    non-blocking resolution) before scoring; final verdict per §11.4
    gate 4 and gate 5, read through §11.5's interpretation map, recorded
    in the implementation log below.

### 11.8 Implementation log

- **2026-07-07 canary (arm-1 session 1, run `eval-2026-07-07-7dbccd2f`,
  learner `a5-drift-padon-threadon-v1-2026-07-07`, 6m02s, 12 API calls,
  4/4 turns clean)**. **Gate 1 (threading-live) PASS, stronger than the
  bar**: `metadata.dialecticalStrategy` present on **4/4** stored turns
  (bar was ≥1/4), verified both by the scorer and directly on the DB
  row's `suggestions` JSON (row 33980) — all four `no_conflict`. Against
  §10's 0/24 on the identical cell/scenario/stack, this is the first
  live-production (non-hermetic) proof that Part 1's threading survives
  the revision loop. **Gate 2 (§7.4 precondition) INSTRUMENT_FLOOR**:
  `total_recognition_moments = 0` (pad exists, raw rows 0). Investigated
  before any disposition: the four superego critiques' raw severities
  were 0.18 / 0.52 / 0.62 / 0.12 (two with raw `disapproves: true`), but
  `dialecticalEngine.js`'s pre-existing scaling (`severity × compliance
  (0.7 default) > rejection_threshold (0.5 default)`, i.e. an effective
  raw bar ≈ 0.714) re-derives `disapproves`, so all four turns resolved
  `no_conflict` and nothing was written to the pad. Part 1 is exonerated
  by construction: commit `289e6930` never touched `dialecticalEngine.js`
  (file list: eval-cli, evaluationRunner, the new test, tutorApiService,
  tutorDialogueEngine), and the scaling behaviour is byte-identical to
  what §10 ran under. This is §10's own recorded warning realized —
  "codex disapproves far less than nemotron (2 moments total vs 9); the
  §7.4 ≥1 gate is much closer to the floor" — A4-codex's session 1 drew
  one critique above the bar; this draw's maximum was 0.62.
- **2026-07-07 disposition (recorded before further spend)**: per
  §11.4pt2's own remediation clause ("…restarts under a fresh learner-id
  suffix, recorded in the implementation log"), arm 1 restarts **once**
  under `a5-drift-padon-threadon-v2-2026-07-07`. The floored v1 session
  is excluded as a precondition failure (not scored; its pad is empty so
  nothing carries over, and the v1 id is never reused) — the scored
  design remains 9 sessions / 36 turns. Bounds, frozen now: **one
  restart per pad-ON arm, maximum**; a second consecutive floor on the
  same arm is a hard stop for that arm and the pilot reports
  "instrument floor on this stack" as its finding rather than re-rolling
  further (a stochastic precondition may not be fished into passing).
  The restarted session 1 re-runs the full canary discipline (runs
  alone, gate 1 + gate 2) before arm 1 proceeds. Cell config is NOT
  touched — loosening `compliance`/`rejection_threshold` to make the
  gate easier would break §11.2's "reused unchanged from §9–§10" and is
  explicitly rejected.
