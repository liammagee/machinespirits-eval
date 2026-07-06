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
