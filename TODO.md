# Future Development TODO

> **NOTE:** For Paper 2.0 related tasks and current active work, see the project board at [`notes/paper-2-0/BOARD.md`](notes/paper-2-0/BOARD.md). This TODO file contains older general experimental extensions and repository sweep items.
>
> **Task tracking (2026-04-16):** Open items from this file have been migrated into the in-session task list (TaskList) — see tasks #1-#12. Use `TaskList` / `TaskGet <id>` to view current status. This document remains the canonical design reference; the task list is the working board.

Generated 2026-02-19 from comprehensive repository sweep.
Organized by theme, roughly priority-ordered within each section.

---

## A. Experimental Extensions

### A1. Human Learner Validation (CRITICAL — engineering layer complete 2026-04-25)
All evaluations use simulated learners. The critical open question is whether recognition-enhanced tutoring produces genuine learning gains with real humans. Standing as the single highest-value next step identified in the 2026-04-22 paper critique — everything else is downstream polish.

- **Pilot runbook**: `notes/design-a1-human-learner-pilot.md` — phased N≈60 pilot (2 conditions × ~30 participants), narrow-domain content (course 101 fractions *or* course 201 intro programming, both already authored), pre/post learning + engagement + qualitative interviews, IRB protocol, recruitment, measurement instruments, analysis plan.
- **Why pilot before RCT**: A small pilot validates content, UI, measurement, and recruitment pipeline before committing to an N=200 RCT at \$20K-50K. If the pilot shows a measurable tutor-quality → learning-gains path, expand to an RCT; if flat, interrogate rubric-vs-learning divergence.

**Engineering — DONE** (commits `4cb8e5b` chat UI, `8e513ae` pilot infrastructure):
- Persistence: `services/pilotStore.js` — 4 tables in `data/evaluations.db` (`pilot_sessions`, `pilot_turns`, `pilot_test_items`, `pilot_exit_survey`), state-machine guard, block-randomized condition picker, per-turn `config_hash` + cumulative `dialogue_content_hash`, blinded-view helper.
- Routes: `routes/pilotRoutes.js` — 13 endpoints (enroll → consent → intake → pretest → tutoring → posttest → exit, plus token-gated admin); `routes/chatRoutes.js POST /turn` accepts optional `sessionId` and overrides `cellName`/`history`/`substrate` from server-side session record (blinding + tamper-resistance).
- Item bank: `services/pilotItemBank.js` + `config/pilot/fractions-items.yaml` — form-counterbalanced (UUID parity), server-side answer-key scoring; items YAML carries placeholder content flagged for IRB replacement.
- Participant UI: `public/pilot/index.html` — single-file Alpine.js, 8 phase sections, 15-min countdown, resume via `?session=<uuid>` or localStorage, calm minimalist aesthetic distinct from `/chat` specimen viewer.
- Ingestion: `scripts/ingest-pilot-sessions.js` — completed pilot sessions → `evaluation_results` rows + dialogue log files in eval-runner format; idempotent. After ingestion `eval-cli.js evaluate <runId>` scores transcripts under v2.2 rubric, enabling §4.3 mediator analysis without code surgery.
- Tests: 15 pass across 3 suites (`tests/pilot.test.js`); end-to-end live-LLM smoke confirmed for both cell_1 (terse-instructional) and cell_5 (empathy-first) on 2026-04-25.

**Still gating recruitment** (content/legal track, not engineering):
- IRB approval at host institution
- Real consent text (placeholder flagged in `public/pilot/index.html` consent block)
- NAEP-derived 10×2 fractions items (placeholder flagged in `config/pilot/fractions-items.yaml` preamble)
- NASA-TLX validated wording (current labels in HTML are paraphrases; real wording is public domain but specific)
- OSF pre-registration of §4.1 thresholds before any data collection
- Internal dogfood N=5 (runbook §7) — feasibility check before opening Prolific
- Prolific recruitment + payment plumbing

**Out-of-scope of pilot, kept for RCT phase**:
- RCT with real learners (n≥60/condition) after pilot signal
- Longitudinal multi-session (split as §A7)
- Three-arm matched-specificity comparison (split as §A10b density-resolved 2026-04-24)
- Paper ref: Section 8.1, Section 9 "What comes next" #4

### A2. Dynamic Learner Mechanism Sweep (COMPLETE)
Full 2×7 matrix (recognition × 7 mechanisms) with dynamic learner. All 7 mechanisms show positive recognition deltas (+4.8 to +17.5 pts). Dynamic learner amplifies mechanism differentiation 1.6–2.8× vs scripted.
- Cells 60-63: self-reflect, bidirectional (eval-2026-02-20-0fbca69e)
- Cells 64-65, 69-70: intersubjective, combined (eval-2026-02-20-117710c0)
- Cells 72-77: quantitative, erosion, tutor-profiling (eval-2026-02-19-03dd8434)
- Haiku supplements: eval-2026-02-20-57ba525c, eval-2026-02-20-90703a6a
- Paper ref: Section 6.10, 6.16.1, 8.2

### A3. Capability Threshold Mapping ~~(MEDIUM — design ready, not yet run)~~ [RESOLVED 2026-04-20 — hypothesis not supported]
**Closed 2026-04-20.** Ran cell 66 (recognition × bidirectional-profiling prosthesis, descriptive) across six ego models vs cell 5 (recognition, single-agent) baselines; kimi-k2.5 superego throughout. Run IDs: eval-2026-04-20-{0bbdb49a (Qwen), ad22a157 (DeepSeek), 3a2ea3cc (Kimi), f30da006 (Haiku)} plus existing GLM-4.7 and Nemotron data. $N_{\text{total}} = 947$ rows. Capability-threshold hypothesis **not supported**: Qwen 3.5 (lowest baseline) shows null effect while Nemotron (second-lowest) shows substantial harm — same tier, opposite outcomes. 5/6 models have 95% CI on Δ entirely below zero; none above zero.

| Model | Baseline | Prosthesis | Δ | d | Judge |
|---|---|---|---|---|---|
| Qwen 3.5 | 65.65 (n=63) | 66.33 (n=59) | +0.68 | 0.05 | Sonnet (matched) |
| Nemotron | 66.38 (n=84) | 48.28 (n=30) | -18.11 | -1.29 | Opus 4.6 (matched) |
| GLM-4.7 | 83.96 (n=30) | 58.91 (n=63) | -25.05 | -2.01 | cross-judge |
| DeepSeek V3.2 | 84.20 (n=30) | 53.92 (n=43) | -30.27 | -2.23 | cross-judge |
| Kimi K2.5 | 89.93 (n=219) | 64.55 (n=44) | -25.38 | -2.59 | cross-judge |
| Haiku 4.5 | 91.25 (n=107) | 69.14 (n=48) | -22.10 | -2.30 | cross-judge |

Regression Δ ~ baseline: slope = -0.71, r = -0.74, R² = 0.55. OpenRouter credits exhausted mid-run three times; effective n below 63 for some prosthesis cells. Full analysis: `exports/a3-capability-threshold.md`. Script: `scripts/analyze-a3-capability-threshold.js`. Paper §6.6.10.

### A4. Learner Superego Redesign (COMPLETE — null result)
Authenticity-focused superego scored *worse* on every dimension including authenticity itself (3.7 vs 4.1 standard). The recognition inversion is structural, not a prompt calibration issue.
- Cells 78-79: eval-2026-02-19-dbcd6543 (Nemotron, N=35), eval-2026-02-20-058c7a0e (Haiku, N=12)
- Standard control: cells 60-61 from eval-2026-02-20-0fbca69e (N=64)
- Paper ref: Section 6.16.1, 7.5, 8.2

### A5. Writing Pad Controlled Ablation ~~(MEDIUM — design ready, not yet run)~~ [RESOLVED v3.0.40]
**Closed 2026-04-19.** Run eval-2026-04-17-f1e851c3 (N=252, 4 cells × 3 runs × 21 scenarios, nemotron × kimi-k2.5, Sonnet judge). 2×2 ANOVA: recognition F=27.10, p<.001, η²=.097 (large); Writing Pad F=3.96, p=.048, η²=.014 (marginal, opposite direction — pad OFF scores 3.2 pts higher); interaction F=0.82, p=.366 (null). Recognition holds without pad (d=0.74 vs 0.56 with pad). **Writing Pad is not load-bearing for the recognition effect.** Full analysis in `exports/a5-writing-pad.md`; paper §6.6.9.

Writing Pad activation coincides with quality improvement, but no controlled ablation exists.

**Current state:**
- Writing Pad is a Freudian three-layer memory system (conscious/preconscious/unconscious) in tutor-core
- Enabled via `writing_pad_enabled: true` in YAML profiles — no CLI toggle
- All cells 22+ have it enabled; cells 1-20 do not
- Persists per-learner within a multi-turn dialogue (synthetic learnerId per dialogue)

**Experimental design:**
- **Approach**: Create paired cells that differ ONLY in `writing_pad_enabled`. Best candidates are cells 40/41 (self-reflective base/recog) since they use all advanced features including Writing Pad.
- **New cells needed** (renumbered — 80-92 already taken by Paper 2.0 messages-mode cells):
  - Cell 93: Clone of cell 40 (base_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
  - Cell 94: Clone of cell 41 (recog_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
- **Scenarios**: Multi-turn only (mutual_transformation_journey, epistemic_resistance_impasse, affective_shutdown_impasse, productive_deadlock_impasse, misconception_correction_flow, mood_frustration_to_breakthrough) — Writing Pad effects only manifest across turns
- **Runs**: 3 per cell (N = 4 cells × 3 runs × 6 scenarios = 72 rows)
- **Controls**: Cells 40/41 (with Writing Pad) serve as within-experiment controls

**Prerequisites:**
- [ ] Define cells 93-94 in `tutor-agents.yaml` (clone 40/41, set `writing_pad_enabled: false`, suffix names with `_nopad`)
- [ ] Register cells 93-94 in `EVAL_ONLY_PROFILES` array in `evaluationRunner.js`
- [ ] Confirm next-free cell ID by re-checking `tutor-agents.yaml` at run time (the highest cell number in use can change)

**Commands:**
```bash
# Run ablation (all 4 cells together for matched conditions)
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified,cell_41_recog_dialectical_selfreflect_unified,cell_93_base_dialectical_selfreflect_unified_nopad,cell_94_recog_dialectical_selfreflect_unified_nopad --runs 3 --description "A5 Writing Pad ablation"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- 2×2 ANOVA: recognition (base/recog) × Writing Pad (on/off)
- Key metrics: state retention across turns, prompt coherence, cumulative learning progression
- Per-turn trajectory analysis: does Writing Pad improve later turns more than early ones?
- Check interaction: does Writing Pad benefit recognition more than base?
- Paper ref: Section 8.1 Limitation #10

### A6. Domain Expansion ~~(MEDIUM — All authoring phases complete; eval runs ~~pending API budget~~ **done**)~~ [RESOLVED v3.0.37]
**Closed 2026-04-17.** All five domains ran and judged; §6.6.6 expanded to 5-row table. Direction replicates in all five: programming d=2.33, math d=1.45, creative d=1.96, SEL d=1.82, philosophy anchor d=2.71 — all "very large" under Cohen's conventions. Domain-only magnitude test remains confounded with conversation mode; matched-mode follow-up deferred. Final report at `exports/a6-domain-generalization.md`.

Tests whether recognition transfers across domains. Originally only 2 domains tested (philosophy via 479, elementary math via 101). Now 5 authored across analytical, symbolic, procedural, aesthetic, and meta-skill domains.

**Current infrastructure:**
- Content switching via env vars: `EVAL_CONTENT_PATH` and `EVAL_SCENARIOS_FILE`
- Course 479 (EPOL philosophy, 8 lectures) — primary evaluation domain
- Course 101 (elementary fractions, 2 lectures) — math test domain, 11 scenarios (5 single-turn, 6 multi-turn)
- Course 201 (introductory programming, 4 lectures) — programming test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16
- Course 301 (creative writing, 4 lectures) — subjective/aesthetic test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16
- Course 401 (college success / social-emotional skills, 4 lectures) — meta-skill/interpersonal test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16

**Experimental design:**
- ~~**Phase 1 — Expand existing math domain**~~ (authoring complete): 11 scenarios in `content-test-elementary/scenarios-elementary.yaml`, exceeds the 4-6 spec. Run cells 1 vs 5 × 3 runs × ~6 scenarios = 36 rows — ~~pending API budget~~ **done**.
- ~~**Phase 2 — New STEM domain (programming)**~~ (authoring complete): `content-test-programming/courses/201/` (4 lectures: Variables, If/Else, Loops, Debugging) + `scenarios-programming.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate against `eval-cli.js validate-config` and all 3 multi-turn dry-run pass. Python is the example language. Recognition-relevant multi-turn scenarios: `code_frustration_to_breakthrough` (infinite loops), `code_misconception_correction` (= vs ==), `code_productive_deadlock` (range half-open convention). Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.
- **Phase 3 — Non-analytical domains** (all authoring complete):
  - ~~**Phase 3a — Creative writing**~~ (authoring complete): `content-test-creative/courses/301/` (4 lectures: Showing vs Telling, Voice and POV, Revision as Re-Vision, Giving and Receiving Feedback) + `scenarios-creative.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate and all 3 multi-turn dry-run pass (scores 73-78 from nemotron on cell_1). Tests recognition transfer to a subjective/aesthetic domain where "right answers" don't exist. Multi-turn scenarios: `writing_frustration_to_breakthrough` (blocked on opening line), `writing_misconception_correction` ("good writing = follows rules"), `writing_productive_deadlock` (refusing to cut a darling scene). Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.
  - ~~**Phase 3b — Social-emotional learning**~~ (authoring complete): `content-test-sel/courses/401/` (4 lectures: Self-Awareness, Self-Management, Social Awareness, Relationship Skills, loosely modelled on CASEL-5) + `scenarios-sel.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate and all 3 multi-turn dry-run pass (scores 63.7-67.9 from nemotron on cell_1 — SEL is the harder domain because rapport IS the content). Tests recognition in a meta-skill domain where the tutor-learner relationship itself is the subject matter. Multi-turn scenarios: `sel_frustration_to_breakthrough` ("I can't name what I feel"), `sel_misconception_correction` ("emotions are obstacles to reason"), `sel_productive_deadlock` ("I'm not a person who asks for help" — identity-level refusal to file financial aid appeal). Prediction: recognition-vs-base delta will be maximally separated in SEL because rapport authenticity IS the scoring target. Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.

**Prerequisites (Phase 1):** ~~done~~ — 11 scenarios authored, validated, dry-runs pass.

**Prerequisites (Phase 2):** ~~done~~ — course 201 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Prerequisites (Phase 3a):** ~~done~~ — course 301 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Prerequisites (Phase 3b):** ~~done~~ — course 401 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Commands:**
```bash
# Run math domain evaluation (Phase 1)
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: elementary math"

# Run programming domain evaluation (Phase 2)
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: intro programming"

# Run creative writing domain evaluation (Phase 3a)
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: creative writing"

# Run social-emotional learning domain evaluation (Phase 3b)
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: social-emotional learning"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- Compare recognition delta across domains: is the effect size domain-dependent?
- Per-scenario breakdown: which scenario types transfer recognition benefit?
- Develop deployment rubric: recognition ROI by domain characteristics
- Paper ref: Section 8.2 Future Direction #3

### A7. Longitudinal Multi-Session Evaluation (Phase 1 DONE 2026-04-24, Phase 2 RUN 2026-04-26 — H1 rejected reversed, H2 supported)
Single-session evaluation cannot capture accumulated understanding.

**Phase 2 result (2026-04-26):** Full study of 80 dialogues (10 arcs × 8 sessions) under timestamp `1777173286` complete; final cost \$3.67 generation + \$1-2 judging, both well under the \$120 cost gate.

- **H1 (primary, pre-registered) rejected, reversed direction**: base mean 25.0 moments/arc vs recog mean 19.2 (Cohen's $d = 2.07$ in *base* favour, Welch's $t(4.84) = 3.27$, $p = 0.017$). Pre-reg called for $d \geq 0.8$ in recog favour; observed $d$ has opposite sign with large magnitude.
- **H2 (exploratory, pre-registered) supported**: recog arcs gain $+1.31$ points/session across the 8-session arc; base arcs lose $-1.08$ points/session. Slope difference is $+2.39$ points/session in recog favour, Welch $t(7.88) = 1.99$, $p = 0.032$. Across all sessions, recog mean score 43.81 vs base 34.72 — Cohen's $d = 0.70$ medium effect in recog favour.

**Combined interpretation (H1 + H2):** the recognition mechanism is *ego pre-alignment with superego principles*. Recognition arcs produce **fewer** dialectical events (H1 reversed) because the ego makes first-pass proposals the superego has less reason to object to, but produce **higher and improving** scores (H2 supported) because that pre-alignment yields better outputs that compound across sessions. The pre-registration's H1 used moment-count as a proxy for "recognition work," which turned out to measure *ego↔superego disagreement* rather than recognition quality. The H2 measurement caught what H1 missed.

**Methodological notes:**
- Surfaced two tutor-core bugs mid-experiment: missing `recognitionOrchestrator` integration in `tutorDialogueEngine`, and a UTC-parsing bug in `shouldConsolidateToUnconscious` (`age` went negative on non-UTC hosts, silently skipping consolidation forever). Both fixed: tutor-core `7174e28`, eval `ef80af9`. 3-session smoke verified end-to-end pad consolidation works post-fix; full study ran against the fixed pipeline.
- Mid-run OpenRouter `402` exhausted credits caught the heaviest scenarios late — bash script's "Don't bail on per-session failure" policy reported "Failed arcs: 0/10" while only 68/80 dialogues persisted. Resume script (`9974bf0`) re-ran the 12 missing sessions after credits replenished. Resumed sessions ran out of original sequence; for H2 trajectory analysis, sensitivity check on in-sequence arcs only (n=4 base, n=3 recog) preserves the directional finding (base mean slope $-1.10$, recog mean slope $+0.72$).
- **H3 (exploratory) directionally supported, threshold not strictly met**: per-arc Spearman ρ between session-index and pad↔message Jaccard overlap; recog mean ρ = 0.39 vs base mean ρ = 0.16; recog mean overlap 0.030 vs base 0.022 (+36%); 3/5 recog arcs meet ρ > 0.5 threshold; 3/5 base arcs meet ρ ≤ 0.3 threshold; Welch t on per-arc ρ not significant (t = 0.71, p ≈ 0.50) at n=5+5. Direction matches H2 narrative (recog draws on accumulated pad state more than base) but the strict pre-reg thresholds were set too aggressively for n=5 with a noisy 7-point Jaccard series. Measurement refinement (TF-IDF or novel-token analysis) flagged as optional follow-up. Script: `scripts/analyze-a7-h3-overlap.js`.
- **H4 (blinded cross-session-reference hand-coding) deferred** — manual, ~1–2h. Sample 10 late-session dialogues for verbatim/paraphrase references to prior sessions; pre-reg target ≥60% recog vs ≤30% base.

Full report: `exports/a7-phase2-longitudinal-1777173286.md`.

**Implementation spec**: `notes/design-a7-longitudinal-implementation-2026-04-16.md` — refines the high-level design after reading tutor-core migration 008.

**Current infrastructure gaps (post-discovery 2026-04-16):**
- Writing Pad schema **already supports cross-session persistence**: `writing_pads.learner_id` is UNIQUE and `initializeWritingPad()` is idempotent (tutor-core migration 008 + `writingPadService.js:28-33`).
- ~~`evaluationRunner.runGeneration()` **already accepts** `learnerId` as an option (`services/evaluationRunner.js:1579`); the gap is only that `services/evaluationRunner.js:2611-2613` synthesises a fresh ID every dialogue.~~ [CLOSED 2026-04-24]
- ~~No CLI `--learner-id` flag on `eval-cli.js run`.~~ [CLOSED 2026-04-24]
- ~~No `learner_id` column on `evaluation_results` for per-row session-index derivation.~~ [CLOSED 2026-04-24]

**Experimental design:**

- **Phase 1 — Infrastructure** [DONE 2026-04-24]:
  - [x] ~~Add `learner_id TEXT` column to `evaluation_results` (local eval-repo migration; not tutor-core).~~ — `services/evaluationStore.js:312-316`. Indexed on `learner_id` for fast longitudinal queries.
  - [x] ~~Plumb `learnerId` through `runScenarioConfiguration` → `runMultiTurnScenario` options.~~ — Threaded `runEvaluation` (option `learnerId`) → `runSingleTest` → both `runMultiTurnTest` and `runSingleTurnTest`. Returned in result objects so `storeResult` persists it.
  - [x] ~~At `services/evaluationRunner.js:2611-2613`, prefer `options.learnerId` over the synthetic ID when supplied.~~ — Precedence: checkpoint > explicit > synthetic. Distinct log line on cross-session reuse.
  - [x] ~~Add `--learner-id <id>` flag to eval-cli `run` command option parser.~~ — `scripts/eval-cli.js`. Help comment updated.
  - [x] ~~3-session smoke test verifying `writing_pads.total_recognition_moments` grows monotonically across invocations.~~ — `scripts/smoke-a7-longitudinal.sh`. **Live smoke run 2026-04-24 PASSED** all four v2 criteria on cell 41 × `smoke-learner-a7-1777077255` × scenarios `new_user_first_visit` → `returning_user_mid_course` → `misconception_correction_flow` (3 sessions, ~30 min wall-clock, ~\$0.50): exactly one `writing_pads` row reused across sessions; `updated_at` (01:02:13) > `created_at` (00:39:15) by 23 minutes; **4 `recognition_moments` accumulated** under the single pad (4 dialectical-conflict events across the 3 dialogues); evolved learner archetype to "autonomous"; all 3 `evaluation_results` rows carry `learner_id`. **Architectural correction surfaced during the run**: the original A7 design pointed at `node_modules/.../tutor-core/data/writing-pads.db` but tutor-core's `writingPadService` actually writes to `lms.sqlite` (default path, override via `AUTH_DB_PATH`); `total_recognition_moments` counter is not auto-incremented on `recognition_moments` insert (use `COUNT(*) FROM recognition_moments` for the true count). Smoke script v2 fixed; v1 reported FAIL only because of the path bug. Full discussion: `notes/design-a7-longitudinal-implementation-2026-04-16.md` "Implementation outcomes" section.
  - ~~Implement persistent session table in tutor-core DB~~ — **NOT NEEDED**; Writing Pad already is the cross-session state.
  - ~~`--session-id` flag~~ — **NOT NEEDED**; session identity = `(learner_id, created_at)` tuple inferable from DB.

- **Phase 2 — Evaluation design**:
  - **Cells**: 40 vs 41 (base vs recog, self-reflective, Writing Pad enabled) — maximizes memory accumulation potential
  - **Session structure**: 8 sequential scenarios per "learner", ordered by difficulty:
    1. new_user_first_visit (intro)
    2. returning_user_mid_course (warmup)
    3. concept_confusion (early challenge)
    4. misconception_correction_flow (structured difficulty)
    5. epistemic_resistance_impasse (conflict)
    6. mood_frustration_to_breakthrough (emotional)
    7. mutual_transformation_journey (deep engagement)
    8. productive_deadlock_impasse (culmination)
  - **Runs**: 5 simulated "learners" per condition (N = 2 cells × 5 learners × 8 sessions = 80 dialogues)
  - **Learner**: ego_superego (dynamic) — must use LLM learner for authentic session-over-session evolution

- **Phase 3 — Analysis**:
  - Track Writing Pad growth: unconscious layer accumulation, recognition moment density
  - Learning trajectory: does score improve session-over-session? Does recognition accelerate learning curves?
  - Memory quality: does the tutor reference earlier sessions? Does accumulated context improve responses?
  - Repair quality: are later repairs faster/deeper due to accumulated learner model?

**Commands** (after infrastructure):
```bash
# Run session 1 for base condition
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified --runs 5 --scenario new_user_first_visit --learner-id learner-base-01 --description "A7 longitudinal: base session 1"

# Resume session 2 with same learner
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified --runs 5 --scenario returning_user_mid_course --learner-id learner-base-01 --session-id <session-from-step-1> --description "A7 longitudinal: base session 2"

# ... repeat for sessions 3-8, then repeat all for recog condition
```

**Notes:**
- This is the most infrastructure-heavy experiment — Phase 1 alone is significant engineering
- Consider starting with a manual 3-session pilot to validate the concept before full implementation
- Paper ref: Section 8.2 Future Direction #2

#### A7 Phase 2 (pre-registration, locked 2026-04-25 before launch)

Phase 2 will accumulate Writing Pad state across 80 dialogues (2 cells × 5 simulated learners × 8 ordered sessions) and ask whether recognition (cell 41) accelerates accumulation relative to base (cell 40). Pre-registering thresholds before the run so the analysis cannot be steered by the data.

**Primary hypothesis (H1, pad accumulation rate)**: by session 8, recognition arcs accumulate ≥2× as many `recognition_moments` per learner as base arcs, with Welch's $t$ on per-learner totals reaching $d \geq 0.8$ (large) and $p < 0.05$ across the 5-vs-5 design. **Null**: ratio < 1.5× *or* $d < 0.5$ *or* $p \geq 0.10$ — interpret as "the pad fills at the same rate regardless of orientation," i.e. recognition's edge is single-session, not durable.

**Secondary hypotheses (H2–H4, exploratory; null on any does not invalidate H1 conclusion)**:
- **H2 (score trajectory)**: per-session tutor score curve has positive slope for recognition arcs, with the slope at least 1.5× steeper than the base curve. Tested via mixed-effects regression of score on session-index, with random intercept per learner.
- **H3 (memory use)**: token-overlap between session $N$'s `conscious_state.permanentTraces` and the tutor's final message in session $N$ grows monotonically across $N \in [2, 8]$ for recognition arcs, but not (or less reliably) for base arcs. Operationalised as: Spearman $\rho > 0.5$ between session-index and overlap on recognition; $\rho \leq 0.3$ on base.
- **H4 (cross-session reference, qualitative)**: blinded hand-coding of 10 dialogues (5 base, 5 recog) for whether session-$N$ tutor messages reference specific session-$<N$ events (verbatim quote, paraphrase, named breakthrough). Binary code per dialogue. Recognition arcs should produce explicit cross-session references in $\geq 60\%$ of late-session dialogues; base $\leq 30\%$.

**Bail-out gates (decided before looking at scores)**:
- **Empty-pad gate**: if a single-arc dry run completes with $0$ recognition_moments accumulated *and* the conscious-state byte size does not grow across sessions, abort the full study and revisit the moment-firing patterns in `tutorDialogueEngine` and the scenario sequence.
- **Bloat gate**: if `unconscious_state` JSON exceeds 200KB on any single arc by session 8, abort and add truncation logic to tutor-core's pad service before retrying.
- **Cost gate**: if dry-run cost extrapolates to >$120 for the full study (4× the design estimate), pause and re-cost rather than letting the run finish.

**What this pre-registration explicitly does *not* commit to**:
- Specific judge model for scoring — chosen at evaluate-time; cross-judge sensitivity not part of H1.
- Statistical adjustment for the 4 hypothesis tests — H1 is the primary; H2–H4 are exploratory; no Bonferroni or BH correction is pre-committed since H1 is the only confirmatory test.
- Choice of base archetype evolution timestamps as evidence — flagged as a useful descriptive measurement in the analysis script but not load-bearing for any hypothesis.

**If H1 is supported**: Phase 2 becomes the empirical anchor for §8.2 Future Direction #2 — recognition's session-spanning compounding is real and measurable, not just a theoretical prediction. **If H1 is null**: the recognition effect is single-session-only on this architecture, which substantially reweights the paper's framing of recognition as a *durable* mechanism. Either result is publishable; the pre-registration removes the temptation to retrofit.

### A8. Active Control Rerun on Kimi K2.5 (COMPLETE)
Active control used Nemotron while factorial used Kimi. Model confound now resolved.
- **Wrong cells run first**: eval-2026-02-19-e000a987 used cells 9-12 (enhanced), not 15-18 (placebo). N=64 scored, 77% hallucination rate. Enhanced prompt causes catastrophic context loss on Kimi — confirms "prompt elaboration hurts strong models" but doesn't address A8.
- **Correct run**: eval-2026-02-19-f2263b04 — cells 15-18 (placebo) on Kimi K2.5. N=216 scored, 46% hallucination. GPT-5.2 rejudge in progress.
- **Reproduction runs**: eval-2026-02-19-13d34bef (Kimi base, grounded mean 71.6) and eval-2026-02-19-411414e4 (Nemotron base, grounded mean 57.4) confirm factorial baselines are stable — no model drift.
- **Three-way comparison** (grounded, matched scenarios, Kimi ego, Opus-judged):
  - Factorial base: N=285, M=64.2
  - Placebo: N=73, M=56.0
  - Factorial recognition: N=549, M=86.8
- **Key finding**: Placebo scores **below base** (−8.2 pts), not between base and recognition. Prompt elaboration without recognition theory is counterproductive on capable models. The gap concentrates in complex multi-turn scenarios (misconception_correction −34.9, mutual_transformation −25.1, frustration_to_breakthrough −17.5); simple scenarios roughly match base.
- **Model confound resolution**: Original Nemotron placebo (66.5) vs Kimi base (68.5) gap was ~2 pts. The real confound was that placebo prompt structure *hurts* Kimi more than Nemotron, so the original comparison actually **understated** recognition's advantage.
- Hallucination pattern: 6 hardcoded example IDs in placebo prompt let Kimi bypass curriculum context; base prompt uses 11 placeholders forcing context lookup (near-zero hallucination historically).
- Paper ref: Section 8.1 Limitation #4

### ~~A9. Cells 34-39 Full Run~~ (WON'T FIX — superseded)
Full-feature dialectical cells (cross-turn memory + prompt rewriting + learner signals). Early N=20 results showed recognition delta only +1.0, below cells 28-33's +4.5.
- Superseded by cells 40-65: cells 34-39 lack `superego_disposition_rewriting` and use generic `strategy: llm` rewriting; cells 40-45 add both improvements
- YAML definitions kept as historical documentation with DEPRECATED header (see C4)
- Decision: not running. The `superego_disposition_rewriting` effect is already captured by the cells 28-33 vs 40-45 comparison; isolating it on cells 34-39 would not add new evidence.

### A10. Matched-Specificity Prompt-Density Control under v2.2 ~~(HIGH)~~ [RESOLVED v3.0.48 — within-Hegelian density-sufficient]
**Closed 2026-04-24** (superseded by A10b orientation-family follow-up).

Three-judge triangulation at full $n$ on cells 1 (base) vs 5 (recognition) vs 95 (matched-pedagogical grounded in Piaget/Vygotsky/Kapur/Chi/VanLehn/Graesser) under DeepSeek V3.2 ego, v2.2 rubric. Run `eval-2026-04-23-42e7acbe` (A10 v2; v1 run `eval-2026-04-22-04497df0` invalidated by bug_007 — see below). Recognition vs matched-pedagogical pooled $d = 0.185$ (Sonnet 0.227, Opus 0.271, GPT 0.057); below the pre-registered $|d| < 0.2$ density-sufficient threshold. **Within the Hegelian-descendant intersubjective-pedagogy family, density is substitutable for recognition content.**

**Design caveat surfaced during this work**: all five theorists cited in `tutor-ego-matched-pedagogical.md` (Piaget, Vygotsky, Kapur, Chi, VanLehn, Graesser) are Hegelian-descendant — Dewey was explicit about Hegel, Vygotsky's dialectical psychology is Hegel through Marx, Piaget's assimilation/accommodation is the dialectic reframed for cognition. A10 therefore tested within-family density-substitutability, not orientation-orthogonal density-sufficiency. A10b (below) closed that gap.

**bug_007 (resolved during A10 cycle)**: `resolveEvalProfile` in `services/evaluationRunner.js` lacked a dispatch branch for `prompt_type: matched_pedagogical`; cell_95 silently routed to `'budget'` profile and ran the base prompt in v1. Discovery: `/ultrareview` on v3.0.46 branch. Fix: added explicit branch in dispatch chain; registered `matched_pedagogical` profile in tutor-core; added to factorial-design test whitelists. Same fix pattern then applied for `matched_behaviorist` in A10b.

**Artefacts**:
- Exports: `exports/a10-prompt-density-control.md` (three-judge final, DB-verified)
- Analysis: `scripts/analyze-a10-prompt-density-control.js`
- Prompt: `prompts/tutor-ego-matched-pedagogical.md` (2,835 words, blocklist-clean, synced to tutor-core)
- Cell: `cell_95_base_matched_single_unified` in `config/tutor-agents.yaml`
- Pedagogical taxonomy: `docs/pedagogical-taxonomy.md`
- Paper: v3.0.48 §7.9

**Regression test for bug_007 (DONE 2026-04-24)**: `tests/regression-bug-007.test.js` asserts that for each `EVAL_ONLY_PROFILES` cell with `factors.prompt_type ≠ 'base'`, `resolveEvalProfile(cell).resolvedProfileName !== 'budget'`. Plus a stronger second assertion that no non-base `prompt_type` resolves to 'budget' across all cells using it. Verified to catch the bug (manually disabled the matched_pedagogical dispatch branch → test fails with the exact diagnostic). 2/2 pass on the current configuration.

**Original design retained below for provenance:**
#### A10 (pre-registration)
Opened from the 2026-04-22 paper critique (§7.9 loophole). The Paper 1.0 placebo (cells 15-18, `tutor-ego-placebo.md`) argues that recognition ≠ prompt length, but the placebo was scored under v1.0 rubric and may not have been equally *specific* in pedagogical guidance. Under v2.2 rubric, we have no matched-specificity control.

**Design note**: `notes/design-a10-prompt-density-v22-control.md`

**Hypothesis**: recognition's effect survives a stricter placebo that matches both length *and* instruction specificity. If it does, §7.9's "prompt density" loophole is closed; if not, the whole programme needs rethinking.

**Cells needed**:
- Cell 95 `cell_95_base_matched_single_unified` — new single-agent tutor with new `tutor-ego-matched-pedagogical.md` prompt (~5,100 tokens, rich pedagogical detail, no recognition/Hegelian content, same scenario-specific specificity as recognition prompt)
- Paired baseline cell 1 and recognition cell 5 already exist.

**Authoring**: `prompts/tutor-ego-matched-pedagogical.md` — mirror recognition prompt's structure (Agent Identity, Context, Decision Heuristics, Worked Examples) but substitute recognition framing with elaborate constructivist/Bloom/VanLehn pedagogical detail.

**Run plan** (estimate \$100-150, ~2-4 hours): cells 1 vs 5 vs 95 × 3 runs × philosophy scenarios (9 scenarios from course 479). N ≈ 81 rows. DeepSeek V3.2 ego; Sonnet 4.6 + GPT-5.4 judges for 2-judge cross-validation.

**Analysis**: Expected contrast — recog > matched-ped > base if recognition operates through content not density. If matched-ped ≈ recog, we need to retract the content-over-density claim.

- Paper ref: §7.9 "Prompt density as alternative explanation"

### A11. M2-Alone Isolation on Gemini Flash 3.0 ~~(HIGH — design 2026-04-22)~~ [RESOLVED v3.0.46 — residual confirmed]
**Closed 2026-04-22.** Direct isolation on Gemini Flash 3.0 (cells 82/83 with Kimi K2.5 superego) vs matched baseline (cells 80/81 from 18027efc, base single-agent). Run `eval-2026-04-22-b56be6c7`, $N = 125$ (including gap-fill). Sonnet judge ($n = 80$ partial, daily cap hit): **$\Delta = +19.2$ pts, $d = 1.76$, Welch's $t(83.3) = 9.54$** — directly measured M2-alone substantially exceeds the factorial-inferred +12.3 residual from §6.4.1. Effect trended upward as more rows were judged ($n = 28 \to d = 1.68$; $n = 80 \to d = 1.76$). Monotonic pattern across models: DeepSeek M2-alone $d = 1.13$ → Gemini Flash M2-alone $d = 1.76$ (weaker model → larger residual). §6.4.2 extended with "Direct isolation of the Gemini Flash residual" paragraph; §7.3 citation updated from inferred to direct. Full exports: `exports/a11-m2-isolation-gemini-flash.md`.

**Original design retained below for provenance:**
#### A11 (pre-registration)
Opened from the 2026-04-22 paper critique. The +12.3-point residual architecture benefit on Gemini Flash 3.0 (§6.4) is the load-bearing evidence for "universal substitution with model-dependent residual," but it is inferred from the factorial interaction on cells 80-87. A direct isolation (base + superego, no recognition) would confirm whether the superego does real work on weak models.

**Design note**: `notes/design-a11-m2-gemini-flash-isolation.md`

**Run plan** (estimate \$40-60, ~1-2 hours):
```bash
node scripts/eval-cli.js run --profiles cell_82_messages_base_multi_unified,cell_83_messages_base_multi_psycho \
  --runs 3 --ego-model openrouter.gemini-flash --description "A11 M2-alone isolation on Gemini Flash 3.0"
```
Scenarios: all 9 messages-mode scenarios (match cells 80-87). Expected N ≈ 54 per cell, 108 total.

**Judging**: Sonnet 4.6 + Gemini 3.1 Pro + GPT-5.4 (same 3-judge panel as Paper 2.0 core). Cost \$15-40 for judging.

**Analysis**: compare cell_82/83 mean on Gemini Flash vs cell_80/81 (base, single-agent, Gemini Flash, already in DB). Expected Δ ≥ +9 pts (matching DeepSeek M2-alone d=1.13) if the Gemini Flash +12.3 residual is genuine superego work. If Δ ≈ 0, the inferred residual was statistical noise from the factorial interaction and §6.4.1 needs re-writing.

- Paper ref: §6.4 "Mechanism Interaction" / §6.4.1 "Factorial Interaction"

### A12. M3 Disengagement Replication ~~(HIGH — design 2026-04-22)~~ [RESOLVED v3.0.45 — failed to replicate]
**Closed 2026-04-22.** Pre-registered replication across Haiku 4.5 and Gemini Flash 3.0 under Sonnet 4.6 and GPT-5.4 judges ($N = 32$, runs eval-2026-04-22-d4547979 and eval-2026-04-22-f4fb03f1) disconfirms the original DeepSeek/Sonnet $d = 1.63$ finding. Matrix: Haiku/Sonnet $d = -0.18$, Haiku/GPT $d = +1.85$ (cross-judge $\Delta d = 2.03$, disqualifying under §4.3 sensitivity rule); Gemini Flash/Sonnet $d = -0.93$, Gemini Flash/GPT $d = -0.11$. Three of four cells below $d = 0.5$ fails threshold; one "replicates" cell (Haiku/GPT) contradicted by secondary judge on identical rows. Paper §6.3.2 rewritten; disengagement hedging retired from abstract, §1, §3.2, §6.4.3, §6.4.5, §7, §7.8.2, §9. Full exports: `exports/a12-disengagement-replication.md`. Analysis script: `scripts/analyze-a12-disengagement-replication.js`. Cost: ~\$7 OpenRouter.

**Original design retained below for provenance:**
Opened from the 2026-04-22 paper critique. The disengagement-scenario M3 exploratory effect (d=1.63, p≈.0006, n=12/condition) rests on one model (DeepSeek V3.2), one judge (Sonnet 4.6), and one scenario. It carries significant narrative weight in the paper; replication will either validate or retire the claim.

**Design note**: `notes/design-a12-m3-disengagement-replication.md`

**Run plan** (estimate \$60-80, ~2-3 hours):
```bash
node scripts/eval-cli.js run \
  --profiles cell_84_messages_recog_single_unified,cell_80_messages_base_single_unified \
  --runs 4 --scenarios trajectory_disengagement_to_ownership \
  --ego-model openrouter.haiku \
  --description "A12 M3 disengagement replication on Haiku 4.5"
```
Then re-run with `--ego-model openrouter.gemini-flash`. N = 2 models × 2 cells × 4 runs × 1 scenario = 16 per model, 32 total.

**Judging**: score with GPT-5.4 (not Sonnet) to break both the model and judge confound simultaneously.

**Analysis**: compute slope recognition vs base. Pre-register: d ≥ 1.0 on slope in at least one of the two replication models counts as replication. d < 0.5 in both = retire from abstract/intro, keep as §6.3.2 descriptive note only. d in (0.5, 1.0) = report as partial with extended caveats.

- Paper ref: §6.3.2 "Trajectory Curves" / §9 closing paragraph

### A13. Orientation-Family Four-Way Comparison ~~(Emerged from A10 cycle)~~ [RESOLVED v3.0.48]
**Closed 2026-04-24.** Pre-registered follow-up to A10 after recognising the matched-pedagogical prompt was Hegelian-descendant (all five cited theorists — Piaget, Vygotsky, Kapur, Chi, VanLehn, Graesser — sit in the broader intersubjective-pedagogy family that recognition belongs to). A10b added a fourth cell grounded in behaviorism (Skinner, Gagné, Keller, Thorndike, Rosenshine) with an expanded blocklist that excluded both recognition-theoretic and Hegelian-descendant constructivist vocabulary. Tests whether orientation *family* or prompt *density* drives recognition's effect.

**Run**: `eval-2026-04-24-e9a785c0`, 4 cells × 3 runs × 21 scenarios, DeepSeek V3.2 ego.

**Three-judge pooled contrasts at full $n$** (Sonnet ~51/cell, GPT ~62/cell, Opus ~50/cell):
- **Within Hegelian family** (recog vs matched-pedagogical): pooled $d = 0.136$ — density-sufficient, replicates A10 v2 pooled $d = 0.185$
- **Within transmission family** (base vs matched-behaviorist): pooled $d = 0.890$ — behaviorist substantially *below* base
- **Between families** (Hegelian mean vs transmission mean): pooled $d = 1.385$ — dominant effect

**The finding**: the active ingredient in recognition's effect is **intersubjective-pedagogy orientation** (Hegelian-descendant family membership), not density, not theoretical rigour in the abstract, not matched specificity, not the Hegelian vocabulary specifically. Density within the intersubjective family pays off; density within the wrong family backfires. Recognition is one effective operationalisation of the intersubjective family; it is not uniquely necessary.

**Judge divergence at full $n$**: on the within-Hegelian contrast, the per-judge $d$'s are Sonnet $-0.024$, GPT $0.172$, Opus $0.259$. Sonnet and Opus now disagree on direction. The earlier "Anthropic-vs-OpenAI judge-family split" framing (from partial data) gave way to a more fragmented picture at full $n$. Pooled verdict remains stable and below the density-sufficient threshold. Methodological implication: at small within-family effect sizes, judge surface-feature preferences dominate over content differences (§7.9 structural-features caveat, `docs/pedagogical-taxonomy.md` "Methodological caveat" section).

**Artefacts**:
- Exports: `exports/a10b-orientation-family.md`
- Analysis: `scripts/analyze-a10b-orientation-family.js`
- Behaviorist prompt: `prompts/tutor-ego-matched-behaviorist.md` (2,957 words, expanded-blocklist-clean, synced to tutor-core)
- Cell: `cell_96_base_behaviorist_single_unified` in `config/tutor-agents.yaml`
- Paper: v3.0.48 §7.9 reframed around orientation-family finding

**Paper-framing implication**: Paper 2.0 may benefit from reframing its central claim from "recognition works" to "intersubjective pedagogy works; recognition is our implementation." Currently §7.9 carries the reframe; §1/§3/§9 still read as "recognition specifically." Open question for a future pass.

---

## B. Code Quality & Infrastructure

### ~~B1. Test Coverage Gaps~~ (DONE)
Tests added for `processUtils.js` (100%), `streamingReporter.js` (100%), `progressLogger.js` (100%), `learnerConfigLoader.js` (91%), `apiMessageFormatter.js` (100%), `apiPayloadCapture.js` (94%), `liveApiReporter.js` (98%), `provableDiscourse.js` (60%), `promptRewriter.js` (55%), `codexSessionService.js` (91%), and `promptRecommendationService.js` (14% → 87% line, 100% function — 2026-04-16). `mockProvider.js` already tested in `dryRun.test.js` (100%).
Overall project line coverage is at ~45% (partially due to CLI scripts being inherently untestable). All meaningful service-layer untested gaps are now closed; the residual `promptRecommendationService.js` uncovered lines are the optional Anthropic SDK path (peer dep, intentionally skipped) and a couple of fallback config paths.


### ~~B2. Silent Error Handling~~ (FIXED)
- ~~`learnerTutorInteractionEngine.js` JSON parse failures~~ — Now logs warning with status code on parse failure
- ~~`evaluationStore.js` empty migration catches~~ — Replaced 20+ bare catches with `migrateAddColumn()` helper that only ignores "duplicate column name"/"already exists", throws on real errors
- ~~`promptRewriter.js` synthesis failures~~ — Consolidated 8 ad-hoc `console.error` sites behind a single `logSynthesisError(operation, error)` helper. Format unchanged for humans; provides one seam for future telemetry counters. Null-return contract preserved (callers depend on it for template fallback).

### ~~B3. Hardcoded Constants~~ (FIXED)
- ~~HTTP timeout 60000ms in `rubricEvaluator.js`~~ — Extracted to `API_CALL_TIMEOUT_MS` constant (6 occurrences)
- ~~Inconsistent inline `30 * 60 * 1000` in `evalRoutes.js:1055`~~ — Now uses `TIMEOUT_WARNING_MS` constant
- ~~`learnerTutorInteractionEngine.js` `LEARNER_RETRY_DELAYS`~~ — No longer present; learner retries now delegated to tutor-core `callAI()` (single retry policy)
- ~~`contentResolver.js:17-19`~~ — Already configurable via `configure()`, removed from list

### ~~B4. Configuration Validation CLI~~ (DONE)
~~No runtime validation of cell definitions.~~
Implemented: `node scripts/eval-cli.js validate-config [--verbose] [--profile <name>]`
Validates: EVAL_ONLY_PROFILES coverage, provider/model resolution, dialogue consistency, learner architectures, scenario course_ids, hyperparameter ranges, prompt file existence. Also serves as regression prevention for E3 (context scoping).

### ~~B5. Centralized Error Reporting~~ (WON'T FIX — by design)
~~Error reporting scattered across 4+ destinations (progressLogger, reporter, console, DB).~~
The 4-way dispatch in evaluationRunner (progressLogger → JSONL files, streamingReporter → user terminal, DB → persistence, monitoringService → metrics) is intentional redundancy for different consumers. The ~106 console.error calls in services/scripts are mostly CLI user-facing output (stderr) with graceful upstream handling (null fallbacks, template defaults). Centralizing would add abstraction without fixing a real problem.

### ~~B6. Judge Model Metrics~~ (DONE)
~~No tracking of judge response times.~~
Added `judge_latency_ms` column to `evaluation_results`. Stored by `evaluate` (CLI judge) and `rejudge` (API judge) commands. Parse error rates and success rates not yet tracked (low priority) — would require adding counters to `callJudgeModel()`.

---

## C. Cleanup & Maintenance

### ~~C1. Stale Files~~ (DONE)
- [x] `data/eval-results.db` — 0 bytes, orphaned; deleted
- [x] `scripts/generate-paper-figures.py` — superseded by `.js` version; git rm'd
- [ ] `data/evaluations.db.bak-*` — 4 backups totaling ~208 MB; .gitignored (local only), keep for safety

### ~~C2. Deprecated Notation~~ (FIXED)
~~`scripts/analyze-judge-reliability.js` — deprecated `openrouter/` slash notation in example commands~~
Fixed: updated 5 occurrences to dot notation (`openrouter.sonnet`, `openrouter.kimi`).

### ~~C3. Legacy Cell Names in DB~~ (DOCUMENTED)
~~`cell_1` (shorthand) coexists with `cell_1_base_single_unified` (canonical) in DB~~
Documented in CLAUDE.md: use `LIKE 'cell_1%'` when querying across runs.

### C4. Cells 34-39 YAML Definitions (KEEPING)
Kept with DEPRECATED header. Superseded by cells 40-65 but preserved as historical documentation.
See comparison: cells 34-39 lack `superego_disposition_rewriting` and use `strategy: llm` (generic)
vs cells 40-45 which add superego rewriting and use `strategy: self_reflection`.

### ~~C5. Short Paper Staleness~~ (RESOLVED)
~~`docs/research/paper-short.md` at v2.3.14-short.~~ Updated to v2.3.17-short with N=4,144 across forty-eight evaluations. Added A2 mechanism sweep, recognition inversion, updated Table 1 totals. Slides (beamer + pptx) also updated to v2.3.17. All assets rebuilt.

### ~~C6. Test Directory Convention~~ (DOCUMENTED)
~~Tests split between `tests/` and `services/__tests__/`.~~
Documented in CLAUDE.md: `tests/` for integration tests, `services/__tests__/` for co-located unit tests.

---

## D. Theoretical / Mechanistic Research

### D1. Mechanistic Understanding (PARTIALLY ADDRESSED — lexical closed, ends-with-question is sole within-cell mediator after 5 passes, embedding discriminates families but Simpson's-paradox at row level, 2026-04-26)
Why does recognition-oriented prompting change model behavior?
- ~~First-pass lexicon decomposition~~ — `scripts/analyze-recognition-lexicon.js` (2026-04-16). Complements `analyze-text-behaviors.js` §2 (data-driven JSD) with a theory-driven 10-concept Hegelian lexicon. Each tutor response gets per-concept density; Cohen's d (recog − base) and Pearson r (density × rubric score) flag which concepts are both distinctive AND quality-correlated. First pass on all scored rows (N=10,304): overall d=0.22, r=0.27. Top mechanism markers: `genuine` (d=+0.45, r=0.19) and `transformation` (d=+0.42, r=0.17). `recognition` (d=+0.20, r=0.15) and `struggle` (d=+0.19, r=0.17) moderate. Counterintuitive finding: `hegel`/`master-slave` has NEGATIVE d (−0.30) — base cells name the theory more than recog cells, which suggests enactment replaces explicit naming. `dialectic` is widespread and quality-correlated but not condition-distinctive (generic quality marker).
- ~~Second-pass orientation-family lexicon decomposition~~ — `scripts/analyze-d1-orientation-lexicon.js` (2026-04-25). Adds an INTERSUBJECTIVE lexicon (Vygotskian/constructivist/dialogic terms — scaffolding/ZPD/sense-making/productive struggle/etc.) and runs both lexicons over A10b's 4-cell matched-specificity set (`eval-2026-04-24-e9a785c0`, Sonnet judge, n≈51/cell). **Finding: both lexicons are markers, not mediators.** Cell_5 (recognition) uses Hegelian vocab moderately (d=+1.01 vs cell_95) but only trace intersubjective vocab. Cell_95 (matched-pedagogical) is hyper-dense in intersubjective vocab (~13× cell_5) and *suppresses* Hegelian vocab below cell_1 baseline (d=-0.52). Yet cells 5 and 95 score equivalently (~49) — A10b's score equivalence reproduces. The two intersubjective-family cells use almost entirely non-overlapping vocabularies and produce equivalent rubric scores; neither lexicon is the load-bearing channel. Pooled intersubjective r=0.37 outperforms Hegelian r=0.17 but within-cell r's are inconsistent (cell_1 r=-0.29 vs cell_96 r=+0.23 on the same lexicon, opposite signs). **Implication**: the orientation-family mechanism lives at a structural/pragmatic level (turn-taking, question-asking, learner-acknowledgement) that bag-of-concepts cannot reach. The lexical channel is now closed as a candidate mediator. Report: `exports/d1-orientation-lexicon.md`.
- ~~Third-pass structural / pragmatic feature decomposition~~ — `scripts/analyze-d1-structural-features.js` (2026-04-25). Five regex-based syntactic/pragmatic features over the same A10b 4-cell set, message-only extraction (suggestion.message, NOT title/reasoning) so pragmatics aren't diluted: question-mark rate, second-person density, ends-with-question (boolean per response), acknowledgement markers, epistemic hedges. **Finding: ends-with-question is the first structural mediator candidate to satisfy all three criteria** — family d (intersub vs trans) categorical (4.5% / 2.1% in cells 5/95 vs 0% in cells 1/96), within-intersubjective d small (both intersubjective cells produce the behaviour, cell_5 only 1.3× cell_95), AND within-cell Pearson r positive: **r=0.325 in cell_5 and r=0.392 in cell_95** — when the same prompt produces a response that ends with a question, that response scores higher. Mechanism account: ending a tutor turn with a question cedes initiative back to the learner; transmission-family prompts (base, behaviorist) produce closed assertions, intersubjective-family prompts produce open questions some of the time, and *some of the time* is what within-cell r captures (pedagogical situations where ceding initiative is appropriate, not just stylistic preference). Secondary findings: second-person density has the highest pooled r (0.327) but isn't cleanly family-aligned (cell_1 has 0.050 ≈ cell_5's 0.060 — best read as a correlate, not mechanism); question-mark rate is a recognition-prompt marker (cell_5 3.2× cell_95) but not a family marker; acknowledgement markers and epistemic hedges are degenerate (regex sets did not capture meaningful variation). Report: `exports/d1-structural-features.md`.
- ~~Fourth-pass refined structural features~~ — `scripts/analyze-d1-structural-features-v2.js` (2026-04-25). Six refined regex features targeting pass-3 gaps: indirect questions (without `?`), scaffolding-move imperatives, inclusive framing (let's/we/us), modal invitations, broad acknowledgement (quoted spans + paraphrase markers + "your X" possessives), broad epistemic hedges. **Two new findings:** (1) Scaffolding-move imperatives ("Try ...", "Notice ...", "Consider ...") are the *cleanest family marker* in the D1 sequence so far — family d=0.591, within-intersubjective d=0.121 (both cells 5 and 95 produce them; cells 1 and 96 do not), within-cell r modest (0.186 in cell_5, 0.048 in cell_95). Confirms intersubjective stance manifests through scaffolding pragmatics as well as ending-shape. (2) Broad acknowledgement (quoted text + "your X" possessives + paraphrase phrases) is *negatively* correlated with score in 3/4 cells (cell_5 r=-0.181, cell_95 r=-0.307, cell_1 r=-0.380). The rubric appears to penalise verbose surface-level echoing of learner content; it rewards synthetic engagement that does not need to quote. **No pass-4 feature beats ends-with-question's within-cell r** — that remains the single strongest individual mediator. Indirect questions, modal invitations, and broad hedges were degenerate (~0 across cells; either LLMs don't use the phrases or regex too tight). Report: `exports/d1-structural-features-v2.md`.
- ~~Fifth-pass embedding-based semantic features~~ — `scripts/analyze-d1-structural-features-v3.js` (2026-04-26). OpenAI text-embedding-3-small over A10b 4-cell × Sonnet judge × 191 rows. Two hand-authored canonicals (intersubjective scaffolding ~120 words, transmission explanation ~120 words). Three derived features: sim_intersub, sim_transmission, intersub_advantage (= sim_intersub − sim_transmission). Includes embedding cache (`exports/d1-embeddings-cache.json`, 193 entries) so re-runs are zero-API. Total spend: ~$0.003. **Headline finding: Simpson's-paradox at the embedding level.** intersub_advantage shows family d = 0.81 (intersub vs trans, large) — clear family marker. But within-cell r is **negative** in cell_5 (-0.282) AND cell_95 (-0.242); pooled r is +0.259 only because the cell_96 outlier (advantage = -0.043, score = 22) anchors the positive end. Substantive read: responses that pattern-match the generic intersubjective canonical too closely sound formulaic; the canonical captures family-level pragmatic *form* (turn-taking, scaffolding, inclusive framing) but not response-level *substance* (specific engagement with scenario content). The rubric rewards substance; surface mimicry is a weak proxy that tracks lower-quality responses. **ends-with-question (pass 3) survives as the sole within-cell mediator across the D1 sequence** — it's a discrete pragmatic act that varies meaningfully even within fixed prompt, while embedding similarity has a within-prompt ceiling effect. Cross-feature §5b: pairwise r between intersub_advantage and the regex features is uniformly small (largest |r| = 0.31 with second-person density) — embeddings sample a different aspect of style than the regex features, but that aspect is a family marker not a within-cell mediator. Methodological lesson: mediator-criteria checks must use within-cell r, not pooled r, to avoid Simpson's-paradox false positives. Report: `exports/d1-structural-features-v3.md`.
- Pass 6 (open): multi-feature OLS regression with all regex + embedding features as predictors of score; partial correlations; per-feature coefficients with t-values. Would test whether the multi-channel account holds when controlling for shared variance, and whether ends-with-question retains its within-cell mediator status when other features are partialled out. Pure JS implementation needed (no stats lib in repo).
- Pass 7 (open): replicate the 5-pass sequence on a multi-turn run (e.g. messages-mode A10b equivalent or A2 dynamic-learner sweep) where dialogue-trace features (turn-by-turn coupling, learner-message echo, ack-of-prior-turn) become available. Single-prompt scenarios (A10b) cannot test paraphrase-of-learner-input.
- **Paper integration mapping** — `notes/d1-paper-integration.md` (2026-04-26). Documents how the 5-pass D1 sequence maps onto Paper 2.0 sections (§7.9 corroboration via independent embedding channel; §6 form-vs-substance distinction; §6 negative-acknowledgement guardrail; §8.2 mechanism specification for white-box work; §8.6 Simpson's-paradox methods note alongside PCA finding). Includes the explicit three-way distinction between "Hegelian content" (not load-bearing), "intersubjective stance" (substantially load-bearing), and "ends-with-question" (one observable channel of the stance, not a substitute) — clarifies what "the recognition injection does" in a way the paper currently lets readers conflate. Outstanding before integration: cross-judge pass-5 replication, pass 6 OLS, pass 7 multi-turn replication.
- Activation analysis, attention patterns, gradient analysis (still open — requires white-box access; needs running open-weights model locally with interpretability tooling like TransformerLens/nnsight)
- Paper ref: Section 8.2 Future Direction #4

### D2. Cross-Application Transfer (Path 1 RESOLVED v3.0.38, Path 2 DEFERRED)
Test recognition-oriented design beyond tutoring.

**Path 1 (RESOLVED v3.0.38)** — single-application adjacency test:
- Content package `content-test-support/` (course 501: Peer Support Listener Training) — 4 lectures (Listening as Skill, Reflective Statements, Sitting With Distress, Discomfort as Data), 4 core + 1 mood scenarios (`scenarios-support.yaml`)
- Run: eval-2026-04-17-6766015b, cells 1 (base) vs 5 (recog), single-prompt mode, Haiku 4.5 × Sonnet 4.6, n=15 per cell
- **Result**: base 52.25 (SD 9.63), recog 69.92 (SD 12.73), Δ = 17.67, **d = 1.57** ("very large"). Closest A6 adjacency (SEL) d = 1.82 — Δd = −0.25, inside A6 range (d = 1.45–2.71)
- Integrated as §6.6.7 "Cross-Application Adjacency Pilot" in paper-full-2.0.md; analysis script `scripts/analyze-d2-support-pilot.js` + report `exports/d2-support-pilot.md`
- Directional claim (recognition improves tutor quality) survives a shift into a domain where the skill being coached runs counter to traditional pedagogy

**Path 2 (deferred — separate-paper scope; design ready 2026-04-25)** — true cross-application with role-reframed prompts:
- **Design note**: `notes/design-d2-path2-cross-application.md` (2026-04-25) — full prompt-authoring spec, cell-registration plan (cells 98-103 core, 104-105 conditional), content-package authoring (`content-test-cs/`, `content-test-review/`, `content-test-therapy/` conditional), run plan, three-judge scoring, mediator analysis cross-link to D1, analysis pre-registration ($d \geq 1.0$ on 2/3 *core* applications threshold), effort estimate (core: 5-7 engineer-days + ~$45-75 API; therapy add-on: +5-8 days + ~$15-25 + 6-10 weeks IRB lead)
- Three core applications spanning role-relationship spectrum: peer support listener (symmetric, high reciprocity), customer service (service-asymmetric, transactional), code reviewer (expert-asymmetric, collaborative critique).
- One **conditional** application (decided at run prep): therapeutic listener (care-asymmetric, high reciprocity) — theoretically the strongest test case for recognition (Honneth care-relation territory) but gated on six safety scaffolding requirements in design-note §2.1 (framing constraints in prompt, refusal-and-refer pathway, deployment-isolation flag enforced by test, separate IRB pathway, participant-pool isolation, pre-registered halt criteria). If included, IRB lead time dominates the schedule; if excluded, §2.1 + cells 104-105 + therapy content package strike from the brief.
- Six core cells (98-103) + two conditional cells (104-105), two prompts per application, two-to-three new content packages
- Open decisions captured in design note §9: rubric strategy (v2.2 unchanged vs role-neutral subset), generation model (Haiku for D2 continuity vs DeepSeek for Paper 2.0 alignment), application set substitutions, **therapy include/exclude** (the schedule-defining decision)
- Deferred because: (a) requires tutor-core prompt authoring, (b) marked as separate-paper scope in v4 roadmap, (c) would extend the paper's length beyond target
- Paper ref: Section 8.2 Future Direction #5

### D3. Insight-Action Gap (Prompt-only test CLOSED 2026-04-25 — structural; architectural follow-up in flight)
Self-reflection produces awareness without behavioral change; profiling produces adaptation.

**Closed sub-items**:
- ~~Measure gap quantitatively (semantic similarity of reflections vs behavior)~~ — `scripts/analyze-insight-action-gap.js` (2026-04-16). Computes per-cell coupling (cosine of `ego_self_reflection` text vs same-turn final tutor message), gap = `1 − coupling`, turn drift baseline, and cell-level base-vs-recog Cohen's d. First pass on 14 reflection-mechanism cells (eval-2026-02-13-8d40e086 + eval-2026-02-14-49b33fdd + eval-2026-02-14-e0e3a622): mean gap 0.42, recog gap > base gap (d ≈ -1.05, n=7 per group), gap > turn drift across all cells.
- ~~Test whether explicit directive bridges gap~~ — **D3-prompt CLOSED 2026-04-25, verdict STRUCTURAL.** Cell 97 (`tutor-ego-dialectical-directive.md` = cell 40 + an explicit "Acting On What You Noticed" rider with 4 numbered directives that couple reflection→action) ran against cell 40 control on full 9 multi-turn philosophy scenarios × 3 runs (run `eval-2026-04-25-4fb605db`, $N = 54$, 317 reflection-action pairs). Coupling cosine: cell 40 = **0.601**, cell 97 = **0.608**, $\Delta = +0.007$. Per-cell-mean Cohen's $d \approx 0.07$ — ~7× below the pre-registered $d \geq 0.5$ "bridgeable" threshold and ~4× below the $d \geq 0.3$ "suggestive" threshold. The Gap−Drift diagnostic (reflection-traceable advantage over generic turn drift) is *identical* in both conditions (0.107 vs 0.108), meaning the directive does not produce more reflection-coupled behaviour than the control. Trend held across the late impasse scenarios (epistemic_resistance, affective_shutdown, productive_deadlock — where the prior baseline had the largest gap), so the null is not a statistical-power artifact. **The insight-action gap is not bridgeable by explicit prompt-level directive.** Length confound (directive prompt +12.4% words) does not save the directive — if anything it should help. Full report: `exports/insight-action-gap-eval-2026-04-25-4fb605db.md`. Design note: `notes/design-d3-explicit-directive-bridge.md`. Cell 97 lives in `config/tutor-agents.yaml`; eval-repo commit `54223e7`.

**Open sub-items (architectural follow-ups)**:
- **Bridge 1 — Two-pass reflection-as-input** (in flight as of 2026-04-25): cell 98 (`cell_98_base_dialectical_suspicious_unified_two_pass`) clones cell 40 with a `two_pass_reflection: true` flag. A separate Phase-1 ego call produces a plain-text reflection (`prompts/tutor-ego-reflectonly.md`) which is prepended to the next turn's user-message context — i.e., reflection is fed back as *content the model reads* rather than as a system-prompt directive. Tests whether the gap closes by architecture when prompt rider failed. Smoke confirmed end-to-end (Phase-1 reflection in API logs is high-quality, specific, first-person; correctly prepended to contextStr; Phase-2 ego receives it). Eval-repo commit `ac64f24`. Plan: live smoke (1 scenario × 2 cells) → if Phase-1 qualitatively shifts coupling, run full $N=54$ contrast. Pre-registered thresholds same as cell 97.
- **Bridges 2-5** (deferred — sequenced after Bridge 1 result): coupling-targeted superego, best-of-N selector, reflector/actor split, outcome-conditioned generation. Full design: `notes/design-d3-architectural-bridges.md`. Pre-registered stopping rule: if Bridges 1, 2, 3 all return $d < 0.3$, declare H-capacity (the gap is a property of LLM cognition, not of orchestration) provisionally confirmed and Finding 11 strengthens to a structural limit on current-generation LLMs.
- Paper ref: Finding 11. Update needed once Bridge 1 lands: §6.3 / §8.1 to qualify Finding 11 from "structural property" to either "structural under prompt design only, bridged by architecture X" (if Bridge 1 succeeds) or "structural under prompt design and lightweight architectural intervention" (if Bridge 1 fails).

### D4. Disposition Gradient Replication — RESOLVED v3.0.39 (architecture-scope-limit)
Finding: the suspicious > adversary > advocate gradient is **dialectical-ego-architecture-specific** (cells 40-45), not a universal property of the recognition mechanism (§6.6.8).
- Dialectical ego × philosophy (cells 40-45, Haiku × Opus, n=17-18): susp d=0.85, adv d=0.62, advocate d=0.51 — monotone, reproduces.
- Standard ego × philosophy (cells 22-27, Haiku × Opus, n=5-10): REVERSED (advocate d=1.70, adv d=0.97, susp d=-0.01).
- Standard ego × SEL (cells 22-27, eval-2026-04-17-4a9b765a, Haiku × Sonnet, n=22-24 per cell, 141/144 judged): non-monotonic (susp d=1.25, adv d=0.53, advocate d=1.09).
- Cells 40-45 × SEL (clean architecture-matched domain test): deferred on cost grounds.
- Learner-side disposition variants: out of scope for v4; requires new cells.
- Artifacts: `scripts/analyze-d4-disposition-gradient.js`, `exports/d4-disposition-gradient.md`.

### D5. Rubric v3.0 PCA-Informed Consolidation (MEDIUM — design 2026-04-22)
Opened from the 2026-04-22 paper critique. §8.6 reports PC1 = 80.7%, KMO = 0.938, mean inter-dim r = 0.776 on 1,584 per-turn rows. The 8 v2.2 dimensions collapse to essentially one factor (plus `content_accuracy` on forced 2-factor rotation). This means: (a) claims like "recognition narrows the dimension profile" are in tension with "dimensions measure one construct," and (b) dimension-targeted autotuning (§7.8) is shifting the single underlying factor, not independent skills.

**Two paths forward** (not mutually exclusive):

1. **Empirical consolidation**: v3.0 rubric with 2 scored factors — `overall_pedagogical_quality` and `content_accuracy` — computed directly rather than derived from 8 component dimensions. Faster to score (1-2 LLM dimensions vs 8), fewer degrees of freedom for judge hallucination.
2. **Discriminant-validity demonstration**: Design scenarios where the 8 dimensions should predictably diverge (e.g., a scenario where `conceptual_progression` should rise while `affective_resonance` should fall). If no such scenarios exist or none produce the predicted divergence, the 8-dim structure is truly over-specified and path 1 is warranted.

**Design note**: `notes/design-d5-rubric-v3-pca-consolidation.md` (authored 2026-04-22, 147 lines). Covers: motivation from §8.6 PCA, what breaks (4 items), v3.0 sketch (single-factor empirical consolidation + optional discriminant-validity pre-test), Framing A (quiet infrastructure for Paper 3.0) vs Framing B (standalone methods paper), effort estimate (5-8 engineer-days, no new generation runs), four open decisions captured in §5 ("What to decide before starting"). Status: **decisions pending** rather than design pending.

**Timeline**: Not blocking for current paper — cross-version-contamination rules (CLAUDE.md) prohibit retroactive rescoring under v3.0 anyway. This is Paper 3.0 infrastructure or a future methods paper.

- Paper ref: §8.6 "Rubric Evolution"

### D6. Orientation-Family Pedagogy Taxonomy (EMERGENT from A10/A10b) — PARTIALLY DOCUMENTED
A10/A10b established that the active ingredient in recognition's effect is **intersubjective-pedagogy family membership**, not recognition content specifically. Pooled three-judge $d = 1.38$ between intersubjective family (recognition + matched-pedagogical) and transmission family (base + matched-behaviorist); within intersubjective family, density-substitutable pooled $d = 0.136$; within transmission family, rigorously-grounded behaviorist scores pooled $d = 0.89$ *below* generic base.

**What's documented**: `docs/pedagogical-taxonomy.md` — canonical reference for five tutor-orientation variants (base, placebo, recognition, matched-pedagogical, matched-behaviorist) with theoretical lineage, view of learner, role of tutor, vocabulary, and evaluation findings. Methodological-caveat section on structural-features confound. Prompts + cells registered in `config/tutor-agents.yaml` + tutor-core profile registry.

**What's open**:
- **Paper framing decision** (carried as F6 below): does Paper 2.0 reframe from "recognition specifically works" to "intersubjective pedagogy works, recognition is our implementation"? §7.9 already has the reframe; §1/§3/§9 still read as recognition-specific.
- **Chat UI consumption** — backend plumbing DONE 2026-04-24, frontend rendering deferred to in-flight chat-UI work (see untracked `public/chat/index.html` from sibling session):
  - **YAML metadata**: `config/tutor-agents.yaml` carries a top-level `pedagogical_orientations:` map keyed by `prompt_type` (16 entries covering every cell prompt_type). Schema documented at `docs/pedagogical-taxonomy.md`.
  - **API surface**: `routes/chatRoutes.js` `summarizeCell()` resolves orientation metadata per cell — including `effectiveFamily` derivation for architectural-variant types (`dialectical_*`, `divergent_*`) where the family depends on the paired ego (recognition_mode true → `intersubjective`; false → `transmission`). `/cells` and `/resolve` endpoints surface both per-cell orientation and the top-level map.
  - **Regression test**: `tests/pedagogical-orientation-coverage.test.js` asserts every cell prompt_type has an entry and every entry has the required schema fields. Mirrors the bug_007 dispatch-coverage pattern.
  - **Frontend rendering — DONE 2026-04-25**: all four "Suggested UX moves" from `docs/pedagogical-taxonomy.md` landed. (1) Compare-orientations panel (`public/chat/index.html` `.compare` block) — collapsible, default natural-opposite (transmission ↔ intersubjective; matched-pedagogical ↔ matched-behaviorist), user-overridable picker, learner/tutor/mechanism contrast rows plus a vocabulary diff (only-left / only-right / shared). (2) Family-grouped picker — compare-cell `<select>` renders one `<optgroup>` per orientation family in canonical order (intersubjective → transmission → neutral → architectural-variant). (3) Multi-line orientation tooltips on cell rows and the lineage family chip (shortLabel + lineage + view/role/mechanism + effect-size line). (4) Effect-size chips on cell rows + lineage panel (Cohen-bin opacity ramp; sign-coloured). Also closed pre-existing pre-mount null-orientation console errors (lineage block migrated from `x-show` to `<template x-if>` + inline optional chaining throughout). Helpers extracted to `public/chat/orientation-helpers.js` ES module (single source of truth; chat HTML loads via `window.OH`). Tests: `tests/chat-orientation-helpers.test.js` (38 unit assertions on bin boundaries, family ordering, default matchups, vocab diff, tooltip format) and `tests/chat-cells-api.test.js` (7 contract assertions on the `/api/chat/cells` response shape) — all 45 pass on a clean tree.
- **Taxonomy extensions** (deferred): A10c tests of cognitivist-only (Sweller/Atkinson-Shiffrin) and pure Socratic, to further pin down where the orientation boundary sits. Also: where do radical constructivism (von Glasersfeld), culturally-responsive pedagogy (Ladson-Billings), Freire's critical pedagogy sit in the family landscape? Not urgent; future methods contribution.

**Potential standalone publication**: "Pedagogical orientation family dominates density and theoretical rigour in LLM tutor prompts" as a methods/short paper. Would use the A10/A10b data as empirical ground and argue for orientation-family as the correct unit of analysis for LLM-tutor evaluation. Separate scope from Paper 2.0.

---

## E. Known Bugs & Workarounds

### ~~E1. Superego JSON Parse Failures~~ (FIXED in tutor-core)
~~Kimi K2.5 returns malformed JSON 16-45% of turns, causing silent auto-approve.~~
Fixed: `jsonrepair` library added to `parseJsonWithFallback()` in tutor-core's `tutorDialogueEngine.js`. Now tries `jsonrepair()` between initial `JSON.parse()` failure and model-retry fallback. Handles trailing commas, unescaped quotes, control characters, and other common LLM JSON malformations. Adversary prompt has lowest failure rate (11.5%) — prompt structure still affects reliability.
- Paper ref: Section 8.2 Future Direction #10

### ~~E2. GPT Rejudge Duplicate Rows~~ (FIXED)
~~`rejudge` without `--overwrite` can create 2x rows per response.~~
Fixed: `rejudgeRun()` now resolves the target judge label and skips responses already
judged by that judge in prior calls. Within-call dedup by suggestion content also preserved.

### ~~E3. Context Scoping Bug~~ (FIXED — robust)
~~When scenarios lack `current_content`, content resolution can leak cross-domain.~~
Fixed comprehensively:
1. Dangerous `listAvailableCourses()` fallback removed from `contentResolver.js`
2. All scenarios have `course_ids` defined
3. Prompt contamination fixed (hardcoded lecture IDs replaced with placeholders)
4. Test coverage validates scenario-content alignment
- Regression prevention: `validate-config` CLI command (B4) now provides automated validation

---

## Operational lessons from the A10/A11/A12/A10b cycle (2026-04-22 through 2026-04-24)

Three recurring patterns worth documenting for future experiment cycles:

**1. EVAL_ONLY_PROFILES registration is necessary but not sufficient for new cells.** Adding a cell to `config/tutor-agents.yaml` + `EVAL_ONLY_PROFILES` is 2 of 3 steps — the third is adding a dispatch branch in `resolveEvalProfile` (`services/evaluationRunner.js:~220-248`) for the new `prompt_type`. Without it, cells silently fall back to `'budget'` and run the base prompt. Caught A10 v1 only after generation completed and `/ultrareview` traced the raw outputs (bug_007). Regression test added in `tests/regression-bug-007.test.js` (commit `8578683`): for each `EVAL_ONLY_PROFILES` cell with a non-base `prompt_type`, asserts `resolveEvalProfile(cell).resolvedProfileName !== 'budget'`, plus a stronger second assertion that no non-base `prompt_type` resolves to `'budget'` across all cells using it. Verified to catch the bug by manually disabling the dispatch branch.

**2. Subscription-judge fill passes hit backoff walls that OpenRouter doesn't.** A10b Sonnet and Opus both plateaued at ~80% coverage after 2-3 fill passes; OpenRouter-paid GPT-5.2 hit 100% coverage in one shot on the same dialogues. The failures are subscription-side retry-give-up behaviour, not data-structural issues (the logs are readable — GPT proved it). Future fill strategy: for comprehensive coverage on subscription judges, plan for 3+ passes with adequate wall-clock gaps; for one-shot coverage, use OpenRouter. Relatedly: trying to push subscription judges past their natural backoff wall is token-expensive for little marginal data gain — lock verdicts at ~80% coverage rather than grinding for the last 20%.

**3. Partial-$n$ per-judge direction can flip at full $n$ on small within-family contrasts.** A10b Sonnet within-Hegelian $d$ flipped from $+0.173$ (at $n = 40$) to $-0.024$ (at $n = 51$). At small effect sizes, the newly-arriving rows can meaningfully shift the point estimate. Rule of thumb: trust pooled three-judge estimates over any single-judge trajectory, and expect within-family contrasts smaller than $|d| < 0.3$ to move around until $n \geq 50$/cell.

## Carry-over for next session (24h+) — now resolved

**Sonnet judging resume (2026-04-23)**: ~~Today's run on A10 + A11 hit Claude Code subscription rate-limit with partial Sonnet data.~~ Resolved 2026-04-23 through 2026-04-24 via multi-pass fill. All primary analyses locked at sufficient coverage (A10 v2: Sonnet 183/183, GPT 183/183, Opus 180/183; A10b: Sonnet 205/248, GPT 248/248, Opus 198/248). Paper v3.0.48 §7.9 reports full-$n$ locked numbers.

## F. Paper Revisions (Post-Critical Review)

Opened from the 2026-04-22 paper critique. Purely editorial — no new data required. Goal: raise the apparent rigor-to-claim ratio before any further experimental work.

### ~~F1. Collapse M3-Disengagement Exposure~~ (DONE v3.0.43)
The disengagement exploratory finding (d=1.63, 1 model, 1 judge, 1 scenario, n=12/condition) currently appears in 13 places across the paper (abstract, §1 intro, §1 three-mechanism list, §1 contributions, §3 preface, §3.2 note-on-evidence, §6.3.2, §6.3.8, §6.4.3 table, §6.4.5, §7 intro, §7.8.2, §9 conclusion, §9 broader implication, §9 Hegelian closer). Carrying too much narrative weight for a "pending replication" finding.

- [x] Keep the full canonical treatment at §6.3.2 (prose, table, figure)
- [x] Condense abstract, §1 three-mechanism list, §1 contributions to single-sentence pointers
- [x] Delete verbose M3 hedging from §9 broader implication and §9 Hegelian closer
- [x] Shorten §3.2 note-on-evidence and §7.8.2 mentions
- Paper ref: v3.0.43

### ~~F2. Rewrite §6.1 Calibration Lead for PCA Consistency~~ (DONE v3.0.43)
§6.1 repeatedly claims recognition "narrows the dimension profile" while §8.6 reports PC1 = 80.7% (one underlying factor). The within-response SD metric is legitimate (it's the within-response scatter across 8 dimensions), but the "narrowing 8 independent dimensions" framing overstates independence.

- [x] §6.1 section intro: clarify that the 8 dimensions load on a single factor plus content_accuracy (§8.6)
- [x] Reframe "narrows the dimension profile" → "compresses the within-response floor-ceiling range" (same measurement, honest interpretation)
- [x] Tweak figure caption (`figure-calibration-variance.png`) — same measure, less strong language
- Paper ref: v3.0.43

### ~~F3. Report Judge-Pooled d as Headline~~ (DONE v3.0.43)
§8.3 reports Sonnet d = 1.88, Gemini-3.1-Pro d = 1.44, GPT-5.4 d = 1.56, pooled d ≈ 1.63. Most headline d's in §1 and §6 (including "d = 1.85 floor-lifting improvement" in abstract/§1) are Sonnet-only. Reviewers who read §8.3 will catch the slippage.

- [x] Abstract: add pooled d ≈ 1.63 with Sonnet-only d = 1.88 as upper bound
- [x] §1 intro paragraph (the "d = 1.85" claim) — label as Sonnet-judge; cite pooled
- [x] §1 contributions list: cross-reference §8.3
- [x] §6.1 cross-model summary: clarify Sonnet-judge where used
- Paper ref: v3.0.43

### ~~F4. Trim Redundant Hedging~~ (DONE v3.0.51)
Universal-substitution restatements compressed from 22 to 15 occurrences with single canonical numerical homes (§6.4.2/§6.4.2.1 mechanistic account; §6.4.6 cross-judge; §7.3 §7-level interpretation; §8.3 cross-judge magnitudes; abstract headline). Other mentions compressed to bare cross-references. Pattern-2 hedging ("pending boundary-condition") was already retired in v3.0.43 (F1) + v3.0.45 (A12 closure); surviving occurrences are deliberately framed as historical references. Net change: ~480 words trimmed across ~18 paragraphs; line count unchanged (mid-paragraph compression). Original 300-line target was over-ambitious — the restatements are within paragraphs, not whole lines, so trimming preserves all canonical statements while removing duplicated numbers. Closes F-series editorial cycle (F1-F6 all resolved).

### ~~F5. Apparatus-as-Method Section Tightening~~ (DONE v3.0.44)
§7.4 trimmed from ~51 lines to 33 lines (~35% cut). §7.4.1 three-correction paragraph consolidated to a single sentence; §7.4.2 dropped the redundant worked-example block (already in §5.9) and the "practical lesson" restatement, kept the dependency-graph cascade example; §7.4.3 removed the bulleted rubric history (cross-reference to §5.2.6) and added §8.6 PCA forward-reference; §7.4.4 compressed to a single tight paragraph. No content claims changed.

### ~~F6. Paper-Framing Reframe~~ (DONE v3.0.49 Framing A → v3.0.50 Framing B+ "primacy + descent")
A10/A10b established that matched-pedagogical (Vygotsky/Piaget/Kapur/Chi/VanLehn/Graesser, no recognition vocabulary) reproduces recognition within the density-sufficient threshold. A10b additionally established that the *family* is the dominant effect (pooled $d = 1.38$ between-family vs $d = 0.14$ within-Hegelian-family). §7.9 (v3.0.48) already frames this honestly. But §1 (abstract), §3 (theoretical framing), and §9 (broader implications) still read as "recognition specifically is the thing."

**Two defensible framings**:
- **Framing A (conservative)**: keep recognition as topic. A10/A10b become §7.9 methodological defence: recognition's effect is the intersubjective-family effect operationalized one particular way. Recognition's Hegelian content is motivationally central; empirical claims are family-scoped.
- **Framing B (bolder)**: reframe central claim from "recognition works" to "intersubjective pedagogy works, recognition is our implementation." More defensible empirically, less theoretically distinctive, changes abstract + §1 substantively.

**Impact estimate**: ~1-2 hours careful editorial rewriting, no new data required, 20-30 passages touched (abstract, §1 operational paragraph, §1 contributions list, §3.1 theoretical framework, §3.2 predictions, §9 conclusion language). Free of API burn — pure editorial work.

**Done v3.0.49** with calibrated Framing A: added family-level acknowledgement to abstract, §1, and §9 broader-implication; kept §3 theoretical framework unchanged as the paper's scholarly entry point.

**Refined v3.0.50** with Framing B+ "primacy + descent": empirical generalisability is real (matched-pedagogical reproduces recognition within $|d| < 0.2$), but recognition theory remains the most explicit philosophical articulation of an intersubjective-pedagogy orientation its constructivist descendants inherit, often without direct attribution. §1 added a careful three-circle genealogical account distinguishing direct Hegelian descendants (Dewey, Vygotsky, Honneth, *Bildung*) from structurally-Hegelian descendants (Piaget, Kapur) from cognate-but-not-descended pedagogically-adjacent traditions (Chi, VanLehn, Graesser). §3 added a level-of-analysis framing note positioning the three mechanisms as recognition theory's specific articulation of commitments the broader family carries tacitly. §9 extended the family-level passage with explicit "empirical generalisability does not displace recognition theory" reasoning. Paper now ships at the Framing B+ level — empirically generous, theoretically careful.

- Paper ref: abstract, §1 intro, §9 broader implication (all done v3.0.49 Framing A → v3.0.50 Framing B+); §3 theoretical framework (level-of-analysis framing note added v3.0.50); §7.9 (done v3.0.48)

---

## Status Legend

- **CRITICAL** — Blocks publication-quality claims
- **HIGH** — Would significantly strengthen findings
- **MEDIUM** — Valuable improvement, not blocking
- **LOW** — Nice-to-have, opportunistic
