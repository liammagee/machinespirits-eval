# Memory mechanisms

A detailed, implementation-level reference for how learner and tutor *memory* is
captured, stored, decayed, and fed back into prompts in this repo. It is the companion
to [`MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md): that note records the *posture*
(why there is more than one store, the Shape A/B/C decision, the seam, the cross-session
experiment and its null result); this note records the *mechanics* (schemas, methods,
call sites, decay rules, injection builders). It originates no empirical claims.

All three stores model Freud's three-layer "Mystic Writing Pad" — **conscious**
(ephemeral working memory), **preconscious** (fading, provisional traces), **unconscious**
(permanent engravings). There are two live implementations on different run paths plus one
retained-but-unwired rich reserve.

| Store | Module | Run path | Backing store | Status |
|---|---|---|---|---|
| tutor-core Writing Pad | `tutor-core/services/writingPadService.js` (+ `memoryDynamicsService.js`) | standard factorial dialogue engine | `writing_pads` etc. in the main eval DB | **live** |
| eval-layer pads (bilateral) | `services/memory/learnerWritingPad.js` + `tutorWritingPad.js` | `learnerTutorInteractionEngine`, `idDirectorEngine`, drama generation | `learner-writing-pad.db`, `tutor-writing-pad.db` | **live** |
| rich reserve | `services/memory/learnerMemoryService.js` | none in production (only the #3 experiment + its tests) | `learner-memory.db` | **retained reserve** |

---

## 1. tutor-core Writing Pad (the standard-path pad)

The pad used by the in-housed dialogue engine on the normal factorial eval path.

**Schema** (`tutor-core/migrations/008_writing_pad_schema.sql`): one `writing_pads` row
per learner (`learner_id` unique), with the three layers stored as **JSON columns** —
`conscious_state`, `preconscious_state`, `unconscious_state` — alongside running metrics
(`total_recognition_moments`, `dialectical_depth`, `mutual_transformation_score`,
`pedagogical_attunement`). Two satellite tables record the dialectic: `recognition_moments`
(thesis/antithesis/synthesis, transformations, a `persistence_layer`, and a
`consolidated_at` timestamp for when a moment settled to unconscious) and
`learner_recognition_events` (`resistance` / `breakthrough` / `demand`).

**Layer transitions** (`writingPadService.js`) — the engine moves traces down the layers:
- `updateConscious(learnerId, updates)` — write ephemeral working memory; `clearConscious`
  wipes it after a suggestion is generated (the cellophane sheet lifted).
- `promoteToPreconscious(learnerId, pattern)` — a pattern seen repeatedly in conscious
  becomes a provisional rule in preconscious.
- `settleToUnconscious` / `updateUnconscious` — a recognition moment leaves a permanent
  trace in the wax substrate.

**Activation and consolidation** (`services/evaluationRunner.js`): the pad is dormant
unless a `learnerId` is threaded into the dialogue engine (`evaluationRunner.js:1963`
"activates Writing Pad three-layer memory"). After a run, `memoryDynamicsService
.runBackgroundMaintenance(learnerId)` consolidates recognition moments down to unconscious
(`evaluationRunner.js:~2751`). In multi-turn runs the `learnerId` is resolved once and
reused so the pad persists across turns (`evaluationRunner.js:~3133`); passing an
*explicit* `learnerId` shares one pad across separate runs — this is what the A7
longitudinal study uses to give a tutor cross-session memory.

**Storage**: the main eval DB (relocatable as a whole via `EVAL_DB_PATH`).

---

## 2. Eval-layer bilateral pads (the interaction-engine pads)

Used by `learnerTutorInteractionEngine` (and `idDirectorEngine`, drama generation). The
defining feature is **bilateral symmetry**: the learner has a pad *and the tutor has a
pad*, written and read in mirror each turn.

**Schema** — unlike the tutor-core pad's JSON columns, each Freudian layer is its own
table (`services/memory/learnerWritingPad.js`):
- `conscious_layer` — per `(learner, session)`: `current_topic`, `current_understanding`
  (`none` / `partial` / `solid` / `transforming`), `active_questions`, `emotional_state`.
- `preconscious_lessons` — per concept: `retention_score` that **decays over time**,
  `access_count`, `misunderstandings`, `connections`.
- `unconscious_breakthroughs` and `unconscious_traumas` — permanent moments with an
  `impact_score`; traumas carry a `resolved` flag (`resolveTrauma` works them through).
- `core_patterns` — `learning_style` / `struggle_pattern` / `strength` with a `confidence`
  that grows as observations accrue.
- `memory_snapshots` — full-state JSON snapshots keyed by `eval_run_id`.

`tutorWritingPad.js` mirrors this for the tutor's side (`updateConsciousState`,
`recordIntervention`, its own `buildNarrativeSummary`).

**Decay and reinforcement** — memory is not static:
- `applyMemoryDecay(learnerId, rate)` lowers every `retention_score` (floored at 0.1),
  called at session start to simulate forgetting.
- `recordLesson` raises retention by ~0.1 on re-access (a spaced-repetition-style boost)
  and increments `access_count`.
- `getLessonsAtRisk` surfaces concepts below a retention threshold (the "fading memories").

**Per-turn firing** (`services/learnerTutorInteractionEngine.js`):
1. **Snapshot before** — `learnerWritingPad.createSnapshot` + `tutorWritingPad.createSnapshot`
   (`:1436–1437`).
2. **Inject** — `learnerWritingPad.buildNarrativeSummary(learnerId, sessionId)` becomes the
   `memoryContext` fed to the learner prompt (`:1528`); `tutorWritingPad.buildNarrativeSummary`
   becomes the tutor's `tutorMemory` (`:2159`). `buildNarrativeSummary` renders the pad into
   prose: current focus, understanding level, active questions, emotional state, strong vs.
   fading concepts, past breakthroughs, unresolved difficulties, core patterns
   (`learnerWritingPad.js:530`).
3. **Write** — each turn calls `updateLearnerWritingPad` (`:1574` → `:2531`) and
   `updateTutorWritingPad` (`:1687` → `:2574`). The learner update sets the conscious layer,
   conditionally records a breakthrough or trauma, and records the topic as a lesson; the
   tutor update sets the tutor's conscious state and records its intervention.
4. **Snapshot after** — both pads snapshotted again (`:1791–1792`). The before/after diff
   (`calculateMemoryDelta`) is the raw material for the **bilateral transformation** metrics
   (`adaptation_index`, `learner_growth_index`, `bilateral_transformation_index`).

(For resumed/replayed traces, `replayWritingPadsFromTrace` (`:1129`) re-applies the writes so
a reconstructed dialogue ends with the same pad state.)

**Storage**: `learner-writing-pad.db` and `tutor-writing-pad.db`, in `EVAL_WRITING_PAD_DIR`
if set (else `data/`). Disable both with `EVAL_WRITING_PAD_DISABLED=1` (the modules no-op).

---

## 3. Rich reserve (`learnerMemoryService`)

The richest representation in the repo, and the likely base for a future "rich-canonical"
architecture (Shape A). It has **no production consumer** today — it is wired only into the
cross-session experiment (#3) and its own tests — but it is deliberately retained, not dead
code (see the header note in the file and `MEMORY-ARCHITECTURE.md` §4).

**Schema** — ten tables (`learnerMemoryService.js:65+`), the load-bearing ones being:
- `concept_states` — a **mastery ladder**: `level` in `unencountered` → `exposed` →
  `developing` → `proficient` → `mastered`, plus `confidence`, `calibration` (confidence vs.
  correctness), `decay_rate`, `engagement_count`, and JSON `struggles` / `breakthroughs`.
- `episodes` — **episodic memory** across eight types (`breakthrough`, `struggle`, `insight`,
  `question`, `connection`, `misconception`, `emotional`, `metacognitive`), each with an
  `importance` that decays (`decayEpisodeImportance`), a `retrieval_count`, and an optional
  `embedding` BLOB for similarity retrieval.
- `threads` — **unresolved questions** (`active` / `resolved` / `dormant`) with
  `student_interest` and `pedagogical_importance`.
- `tutor_session_summaries` — per-session digests (`session_id` is globally **unique** —
  scope synthetic ids per learner, a footgun the #3 orchestrator hit).
- plus `personal_definitions`, `connections`, `learner_preferences`, `learning_milestones`,
  `agent_cost_log`, and the `learner_memory` root record.

**Spaced repetition**: `getConceptsDueForReview` uses `decay_rate` and `last_engaged` to
surface concepts whose memory should be refreshed.

**Injection**: `buildContextInjection(learnerId)` (`:1241`) assembles a compact narrative —
last session's summary, its unresolved question, active threads, concepts due for review, and
a learning-style line derived from preferences — and returns it with a rough token count.

**Storage**: its own `learner-memory.db` in `EVAL_WRITING_PAD_DIR` (else `data/`). It is
self-contained and **seam-safe** — `services/memory/**` must not import `tutor-core/**`
(enforced by `tests/memoryArchitectureSeam.test.js`); the `users(id)` foreign keys in the
schema are decorative and disabled via `PRAGMA foreign_keys = OFF` (no users table in
standalone mode).

---

## 4. Cross-session injection hook (#3)

The mechanism that lets the rich reserve actually influence tutoring, added for the
cross-session experiment. It is the only path by which `learnerMemoryService` reaches a live
tutor today.

- `runEvaluation` takes an opt-in `externalEgoExtension` string (multi-turn only). It is
  threaded through `runSingleTest` into `runMultiTurnTest`, where it is prepended to
  `fullEgoExtension` and so onto the tutor's system prompt (`evaluationRunner.js:3596`). Null
  by default — no behaviour change when unused.
- The CLI surfaces it as `eval-cli run --external-ego-extension-file <path>`.
- The experiment loop (`scripts/run-rich-memory-arc-experiment.js`): after each session a
  **score-blind** extractor distils the transcript into `concept_states` / `episodes` /
  `threads`; before the next session `buildContextInjection` renders the accumulated store
  into a narrative handed across the hook. The extractor never sees the judge's score, so the
  injected memory reflects what the learner did, not how the tutor was rated.

**The seam**: the narrative is built in the eval layer and handed to `tutor-core` as a plain
string; `tutor-core` never imports eval-layer memory, preserving its re-extractability. This
is why injection is a parameter rather than a direct call.

Result of the first powered run: null (rich memory did not move tutoring quality), consistent
with the A5 ablation. Details and caveats in `MEMORY-ARCHITECTURE.md` §7.

---

## 5. Symmetry and longitudinal notes

- **Tutor–learner symmetry**: the bilateral pads, their per-turn write/snapshot cycle, and
  the trace labels are deliberately mirrored across the two sides. When changing one side,
  mirror the other (see the symmetry principle in `CLAUDE.md`).
- **Cross-session / longitudinal**: passing an explicit `learnerId` into a run reuses one
  tutor-core pad across runs — the basis of the A7 longitudinal study. The rich-reserve hook
  in §4 is the eval-layer analogue for carrying a richer state forward.

## 6. Environment switches

| Variable | Effect |
|---|---|
| `EVAL_WRITING_PAD_DIR` | Relocates the three eval-layer DBs (`learner-writing-pad.db`, `tutor-writing-pad.db`, `learner-memory.db`) — used for hermetic runs. |
| `EVAL_WRITING_PAD_DISABLED=1` | The two eval-layer pads no-op (DB handle is null). |
| `EVAL_DB_PATH` | Relocates the main eval DB, which holds the tutor-core pad's `writing_pads` table. |

## 7. Pointers

- Posture, decision, experiment result: [`MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md)
- Seam guard: `tests/memoryArchitectureSeam.test.js`
- Cross-session instrument: `scripts/run-rich-memory-arc-experiment.js`
- Canonical pad schema: `tutor-core/migrations/008_writing_pad_schema.sql`
