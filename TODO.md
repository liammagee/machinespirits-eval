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

- **Pilot runbook**: `notes/design-a1-human-learner-pilot.md` — **revised 2026-05-18**: phased N≈90 pilot, **3 arms** (base / recognition / behaviorist-matched `cell_96` — the §7.9 between-family $d=1.38$ axis, resolving the old "pending A10" arm deferral) × ~30 participants, narrow-domain fractions, outcome battery = pre/post MCQ **+ immediate transfer + independently-coded free-text explanation (the §7.9 learner-unauthored channel) + 1-week delayed retention**, IRB protocol (now linked two-wave), recruitment, instruments, analysis plan. Sharpened by the dramatic-reversal probe (`exports/dramatic-reversal-probe.md`) + the GPT-5.5 critique exchange.
- **Why pilot before RCT**: A small pilot validates content, UI, measurement, and recruitment pipeline before committing to an N=200 RCT at \$20K-50K. If the pilot shows a measurable tutor-quality → learning-gains path, expand to an RCT; if flat, interrogate rubric-vs-learning divergence.

**Engineering — DONE** (commits `4cb8e5b` chat UI, `8e513ae` pilot infrastructure):
- Persistence: `services/pilotStore.js` — 4 tables in `data/evaluations.db` (`pilot_sessions`, `pilot_turns`, `pilot_test_items`, `pilot_exit_survey`), state-machine guard, block-randomized condition picker, per-turn `config_hash` + cumulative `dialogue_content_hash`, blinded-view helper.
- Routes: `routes/pilotRoutes.js` — 13 endpoints (enroll → consent → intake → pretest → tutoring → posttest → exit, plus token-gated admin); `routes/chatRoutes.js POST /turn` accepts optional `sessionId` and overrides `cellName`/`history`/`substrate` from server-side session record (blinding + tamper-resistance).
- Item bank: `services/pilotItemBank.js` + `config/pilot/fractions-items.yaml` — form-counterbalanced (UUID parity), server-side answer-key scoring; items YAML carries placeholder content flagged for IRB replacement.
- Participant UI: `public/pilot/index.html` — single-file Alpine.js, 8 phase sections, 15-min countdown, resume via `?session=<uuid>` or localStorage, calm minimalist aesthetic distinct from `/chat` specimen viewer.
- Ingestion: `scripts/ingest-pilot-sessions.js` — completed pilot sessions → `evaluation_results` rows + dialogue log files in eval-runner format; idempotent. After ingestion `eval-cli.js evaluate <runId>` scores transcripts under v2.2 rubric, enabling §4.3 mediator analysis without code surgery.
- Tests: 15 pass across 3 suites (`tests/pilot.test.js`); end-to-end live-LLM smoke confirmed for both cell_1 (terse-instructional) and cell_5 (empathy-first) on 2026-04-25.

**Engineering deltas for the 2026-05-18 revised design** (runbook §3.2, ~3–4 eng-days, not a rebuild):
- Wire `cell_96_base_behaviorist_single_unified` as the 3rd arm + balanced 3-way randomisation
- Form C + 3×3 Latin square (replace 2-form UUID parity in `pilotItemBank.js`)
- `explanation` free-text item type + blind shuffled coding export (bank is currently MCQ-only)
- Session-2 retention re-contact flow (token linkage, 2nd-consent touch, day-7 gate)

**Still gating recruitment** (content/legal track, not engineering):
- IRB approval at host institution — now **linked two-wave** minimal-risk (name re-contact, linkage token, destruction schedule)
- Real consent text (placeholder flagged in `public/pilot/index.html` consent block) — must cover re-contact + Session-1↔2 linkage
- NAEP-derived 10×**3** fractions items + 3 parallel free-text explanation prompts (placeholder flagged in `config/pilot/fractions-items.yaml` preamble)
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
- **H3 (exploratory) directionally supported (Jaccard), inconclusive under refinement (novel-token)**: original Jaccard measurement (`scripts/analyze-a7-h3-overlap.js`) shows per-arc Spearman ρ recog 0.39 vs base 0.16, mean overlap recog 0.030 vs base 0.022 (+36%), 3/5 each side meet pre-reg thresholds, Welch t = 0.71 (not significant at n=5+5). Refinement (`scripts/analyze-a7-h3-novel-tokens.js`) tracks tokens unique to the pad's accumulated traces vs the arc's session-1 baseline, separating *tutor draws on pad* from *tutor stays on topic*; result: per-arc Spearman ρ recog 0.24 vs base 0.14 (Welch t on ρ = 0.26, not significant), mean recurrence recog 64.4% vs base 68.3% (Welch t on per-observation recurrence = -1.00, p ≈ 0.32 normal-approx). The refinement does **not** strengthen the original Jaccard finding — both conditions show similar high recurrence of pad-novel vocabulary. **H3 cannot be load-bearing on the recognition-as-pre-alignment claim.**
- **H4 (exploratory) inconclusive after augmentation**: original n=10 sample (1 dialogue per arc, permissive coding) showed Base 1/5 = 20% vs Recog 2/5 = 40% (+20pp recog lift, Fisher p = 1.00). Augmented n=40 sample (4 dialogues per arc, conservative coding by a fresh sub-agent that treated metadata-shaped facts as plausibly available from in-session structured_context_summary) **reverses the direction**: Base 8/20 = 40% vs Recog 5/20 = 25% (-15pp, Fisher p = 0.50, Welch t on per-arc rates t = -1.18 not significant). The original signal was a small-sample / permissive-coding artefact. At adequate n with strict coding, cross-session-reference rate does not cleanly separate the two conditions. **H4 cannot be load-bearing on the recognition-as-pre-alignment claim** — substantive support now rests on H1 + H2 + the 9-point recog score advantage; H3 weakly supportive; H4 too noisy at this design's sample size. Scripts: `scripts/analyze-a7-h4-sample.js` (now supports `--n-per-arc <N>` for power augmentation).

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

### A14. Evidence-Bound Adaptive Controller (HIGH — design 2026-05-13; Stages 1-5 DONE; arc closed 2026-05-17, paper v3.0.82 §6.9.7)

**Origin**: `docs/next-steps/next-steps-report.md` (May 2026 review of paper-full-2.0.md v3.0.74). The report's thesis is that genuine adaptation is not memory but *accountable action selection* — minimal typed learner state, quoted-evidence requirement, finite policy vocabulary, grounding validator, learner contestability. Substantial reuse from `services/adaptiveTutor/` (already has typed state, 14 policy actions, trap suite, counterfactual replay). Net-new mechanism: evidence ledger + hypothesis TTL + grounding validator.

**Scope discipline**: the report sketches 7 experiments / 10 paper revisions / 5 implementation phases. This entry implements the **MVP only** — the genuinely-novel mechanism, on the existing trap suite, with two new cells. Everything else is deferred (knowledge tracing, action-plan best-of-N, human tutor co-pilot, etc.) until the MVP either lands or doesn't.

**Adaptation problem assessment** (which the MVP attacks and which it doesn't):
- Multi-turn slope under recognition (null in §6.X): **MVP does not address.** Mechanism has no causal path to "response at turn 5 better than at turn 1."
- Triggered strategy shift on trap suite (partially positive, cells 110-113): **MVP attacks marginally.** Evidence-gated policy selection could tighten strict_shift.
- False personalization / unsupported claims (not yet measured): **MVP attacks strongly.** Quoted-evidence requirement + TTL + grounding validator is exactly the right machinery.
- Learner-grounded adaptation (§4.8 of report): **deferred to A1 pilot.** Requires real humans correcting the model; simulated learners can't generate the signal.

Net: the MVP would likely produce a publishable §6.X with two real findings (reduced unsupported-claim rate, possibly improved strict_shift). It would not close the multi-turn-slope gap. The strongest move is making the unsupported-claim rate a first-class metric the paper reports across cells.

**Branch**: `experiment/evidence-bound-adaptive`. Schema migrations and multi-week scope justify isolation (matches the pattern of the just-deleted `experiment/langgraph-adaptive`). Stage-by-stage PRs back to main rather than one monster merge.

**Staggered plan** — each stage is a stop-and-publish checkpoint:

- [x] **Stage 1 — Schema + smoke** (~3-5 days) **DONE** (commit `e5425e8`, 2026-05-13). `evidenceLog` and `hypotheses` reducers added to `stateSchema.js`; `state_policy_evidence_bound` architecture and `cell_126` skeleton registered; mock smoke passes; existing cells 110-113 unaffected. Reported in §6.9.1.

- [x] **Stage 2 — Extractor + hypothesisUpdater** (~5-7 days) **DONE** (commits `6f79f1e`, `b34aae4`, `1e02510`; smoke `217fdc4`, `5ed25b7`; 2026-05-13). `evidenceExtractor` with substring-match quote-validation gate; `hypothesisUpdater` with node-owned id derivation, TTL preservation, evidence-ref filtering. Real-LLM smoke (`claude-code/sonnet`, $N = 3$ trap scenarios) clears both internal gates: **Stage 2a verifiable-quote rate 128/128 = 100%** (target ≥95%), **Stage 2b grounded-hypothesis rate 53/53 = 100%** (target ≥70%). Reported in §6.9.2.

- [x] **Stage 3 — Grounding validator + paired ablation** (~5-7 days) **DONE** (commits `9055780`, `485cbc5`, `d849c96`; 2026-05-13). `groundingValidator` node downstream of `hypothesisUpdater` with verdict-only Zod contract (LLM owns status transitions only; graph node preserves hypothesis content). Promotes on ≥3 supporting `obs_id`s + no contradiction; retires on ≥1 contradicting `obs_id` + confidence <0.4; SILENCE otherwise. `cell_127_state_policy_evidence_bound_validated` registered as the paired ablation against cell_126. Real-LLM smoke on $N = 3$ scenarios: 13 validated / 9 contradicted / 4 tentative (85% non-silent verdicts). Matched paired ablation at $N = 2$ scenarios: cell_126 emits 0 validated / 5 contradicted / 14 tentative; cell_127 emits 5 validated / 7 contradicted / 2 tentative. **Asymmetric attribution finding**: validator wholly owns `validated` promotion (0 → 5), partly shares `contradicted` retirement (5 → 7). Validator ~5× cheaper per call than the upstream `hypothesisUpdater` it audits. Reported in §6.9.5–§6.9.6. **Zod schema fix landed in same window** (commit `d849c96`, `services/adaptiveTutor/realLLM.js:478`): `quote: z.string().min(1)` → `quote: z.string().nullable()` to accept null quotes for `tutor_inference` entries (graph node at `graph.js:371` already coerces to '' and the substring-match gate marks `validated=false` — desired behaviour).

- [x] **Stage 4 — Paper §6.9** (collapsed into Stages 1-3 commits, 2026-05-13). The original plan envisioned `scripts/analyze-evidence-grounding.js` reporting four metrics across cells 110-113, 126, 127. The actual delivery routes the same questions through the existing smoke-script reporting (`scripts/run-adaptive-cell-real-smoke.js`) and §6.9.1–§6.9.6 of `paper-full-2.0.md`: `quoted_support_rate` (= Stage 2a verifiable-quote rate, 100%); `unsupported_claim_rate` (≈ 1 − grounded-hypothesis rate, 0%); `contradiction_rate` (covered by terminal status distribution); `expired_state_reuse_rate` (not measured — N=3 didn't produce TTL hits). Cells 110-113 are not scored on these metrics because they lack the `evidenceLog`/`hypotheses` schema fields. **No standalone analyzer script written**; the §6.9 paper section is the deliverable. Paper bumped v3.0.74 → v3.0.79 over Stages 1-4. The adaptivity-taxonomy table (§7.1 of the original report) was not added — judged to be over-scope for this arc.

- [x] **Stage 5 — Pedagogical-outcome scoring against §6.8 instruments** **DONE** (2026-05-17, paper v3.0.82 §6.9.7). Ran all three evidence-bound cells on the v1 trap suite at pooled $N \approx 33$ (`cell_126` 33, `cell_127` 33, `cell_128` 34; 100 dialogues, 0 grader errors) on both §6.8 instruments (binary `strict_shift` `claude-code/sonnet`; 4-dim graded GPT-5/codex v1.0). **Binary:** 42.4% / 54.5% / 58.8%; family-match 90.9 / 93.9 / 100%; within-action refinement 100% all (50/44/60). **Graded overall (T/E/Q/C):** 3.84 (3.76/3.39/4.18/4.03) / 3.85 (3.76/3.52/4.12/4.00) / 4.13 (4.09/3.91/4.32/4.21). **Result = the §6.9.7 negative-result exit.** Reading (b): the validator's +12.1-pp binary gain over updater-only `cell_126` does *not* survive the graded channel ($3.84 \to 3.85$, $+0.01$ null) — the `cell_123` §6.8.6 binary/graded-divergence pattern; only `cell_128` moves both channels. Reading (a): `cell_126` is *below* `cell_110`'s 47.8%/4.03 on both channels; no cell reaches `cell_124` 62.5% or `cell_118` 68.8%/4.34; `cell_128` (= `cell_118`'s minimal profile + the A14 audit chain) is net-negative on both ($-10$ pp binary, $-0.21$ graded) vs the unaudited `cell_118`. Trust-vs-load → **load** on the load-bearing graded channel: mechanism-positive (§6.9.5 asymmetric attribution holds), pedagogically inert-to-negative — the §6.8.8 "apparatus is the contribution; the elaboration does not pay" motif. §6.9.6 retitled/repointed; §6.9 intro de-staled; revision-history entry added. Single-judge per channel, no Stage-5 second-judge calibration (§5.12.4 covered cells 110/118/119 only); binary treated wide-CI per §6.8.6 template.

- [ ] **Stage 6 — DEFERRED to A1**. Learner-facing correction (§4.8 of report) requires pilot UI changes + real humans correcting the model. Belongs to the IRB-gated pilot, not this arc.

**Explicitly out of scope for A14**:
- Knowledge tracing over dialogue turns (§5.3 of report) — separate research project, drop or fold to single-column extension
- Action-plan best-of-N (§5.5 of report) — interesting but doesn't load-bear on core claim
- Human tutor co-pilot (Exp 6) — deployment concern, not science
- Cross-session learner continuity (A6 in report's adaptivity taxonomy) — not attacked by this mechanism
- Paper renames ("intersubjective orientation" §7.2 of report) — stylistic, can land independently
- Revision-history relocation (§7.7 of report) — stylistic

**Stop-and-publish checkpoints**:
- After Stage 1: schema lands cleanly or doesn't. If the TTL semantics resist clean Zod modeling, stop with a 3-5 day investment and a notes/ writeup of why.
- After Stage 2: if extractor's verifiable-quote rate falls below ~70% in real-LLM testing, the mechanism's foundational assumption is broken — stop with a negative-result writeup and reconsider before building the validator.
- After Stage 3: if cells 126/127 don't beat cell 113 on strict_shift OR don't substantially reduce unsupported-claim rate, the validator isn't earning its complexity — stop with a §6.X-as-negative-result writeup (still publishable).
- After Stage 4: paper section drafted. If draft doesn't survive internal review, stop without merging the branch.

**Paper integration** — single-paper discipline (`CLAUDE.md` §Paper Authoring Discipline): all empirical claims land in `paper-full-2.0.md` first. No spin-off paper. The report's framing as "the next paper" is rejected; this is a §6.X extension and a §7.X taxonomy table.

### A15. Cross-Dialogue Retrieval-Augmented Adaptation (DESIGN SKETCH — recorded 2026-05-13, gated on A14)

**Origin**: 2026-05-13 conversation on "lightweight training on learner responses, no weight updates." Sits adjacent to A14 but attacks a different time-scale: cross-dialogue memory rather than per-turn evidence binding. The architectural motivation: A14 explicitly does **not** address the multi-turn slope gap (§A14 adaptation-problem assessment) — within-dialogue evidence has no causal path to "response at turn 5 better than at turn 1." A persistent cache of (learner_state_pattern → policy_action → outcome) tuples across dialogues *does* have that causal path: a tutor entering its 5th turn with a new learner can retrieve 4-turn priors from prior learners with similar profiles. Complement to A14, not substitute.

**Compose-with-A14**: cache keys would be derived from A14's typed apparatus — `(learner_state_summary, top_validated_evidence_entries, agencySignal+confidence)`. Without A14 in place, the keys would be ad-hoc text features (brittle) or raw dialogue embeddings (unstructured); with A14, they're typed and validated. This is why A15 is gated on A14 landing — the cleanest version of the experiment reuses Stage 2's extractor outputs rather than re-deriving its own key features.

**Why "lightweight"**: no model-weight updates. Embedding + nearest-neighbor lookup + in-context augmentation of the policy-selection prompt. Same provider-agnostic posture as the rest of the project. "Training signal" is whether `strict_shift` fired on the retrieved analogue — no labels beyond what the existing trap-suite scoring produces. The two heavier readings of "lightweight training" (LoRA adapters, online RLHF) are explicitly out of scope: the maintenance burden of a fine-tuned artifact dominates the research-substrate's editability needs.

**Adaptation-problem assessment** (which the MVP attacks):
- Multi-turn slope under recognition (null in §6.X): **MVP attacks strongly.** Memory across dialogues makes turn-5 ≠ turn-1.
- Triggered strategy shift on trap suite: **MVP attacks marginally.** Retrieved analogues may stabilise policy selection on ambiguous traps.
- False personalization / unsupported claims: **MVP does not address.** A14's grounding validator is the right machinery for this.
- Learner-grounded adaptation (§4.8 of A14 report): **deferred to A1 pilot.** Same human-loop constraint as A14.

Net: a complement to A14. If both land, the paper has evidence-binding + cross-dialogue memory as two separable mechanisms with separable metrics. If A14 lands negatively (Stage 2 extractor < 70% verifiable-quote), A15 needs to re-derive its keys from raw dialogue features — falls back to a less-clean experiment but is still runnable.

**Branch**: `experiment/retrieval-adaptation` (new branch, started off `main` after A14 merges back). Cache store is a schema migration that justifies isolation in the same way A14's was.

**Staggered plan** — each stage is a stop-and-publish checkpoint:

- [ ] **Stage 1 — Cache schema + key extraction** (~3-5 days). New `services/adaptiveTutor/memoryBank.js`: SQLite store for (cache_key, learner_state_snapshot, policy_action, outcome, source_dialogue_id, source_turn) tuples with an embedding column indexed via a cheap embedding model (voyage-3, text-embedding-3-small, or local sentence-transformers — pick on cost grounds at implementation time). Cache keys derived from A14's evidence-bound state at end-of-turn: `{learner_state_summary, top-N validated evidence quotes, agencySignal, confidence_bucket}`. Population script that walks existing cell_126 trace files and seeds the cache without disturbing the runner. **Exit**: cache populates from existing cell_126 traces; ~100-500 entries from the 8-scenario × 3-run sweep; key-collision rate < 50% (most dialogues hash to distinguishable neighborhoods).

- [ ] **Stage 2 — Retrieval at policy selection** (~5-7 days). New `evidenceMemoryRetriever` node before `tutorEgoInitial`: embed the current learner-state snapshot, retrieve top-k similar past tuples, format as in-context examples in the policy-selection prompt. Add `cell_128_state_policy_evidence_bound_retrieval` cell (architecture: `state_policy_evidence_bound_retrieval`, falls through to evidence-bound topology with retriever inserted). **Exit**: cell_128 produces DB-tractable runs; ablation against cell_126 shows retrieval changes policy selection on ≥30% of turns (lower bound — if retrieval is being ignored entirely by the policy LLM, the mechanism is broken).

- [ ] **Stage 3 — Analyzer + paper §6.Y** (~5-7 days). New `scripts/analyze-multi-turn-slope.js` reporting per-dimension turn-by-turn trajectory deltas across cells 110, 126, 128. Paper §6.Y in `paper-full-2.0.md` reporting retrieval-augmented vs evidence-only vs baseline on (strict_shift, multi-turn slope, retrieved-analogue diversity, retrieval-influenced-policy rate). Single-paper discipline: lands as §6.Y, not a spin-off. **Exit**: paper §6.Y drafted; claims trace to DB run IDs; validate-bug-claims passes.

**Stop-and-publish checkpoints**:
- After Stage 1: if cache keys hash to one neighborhood (>50% collision), the key derivation is informationless — stop with a notes/ writeup on key design, before building the retriever. Likely fix: add more discriminating fields, or move from `learner_state_summary` text to a structured tuple.
- After Stage 2: if retrieval doesn't change policy selection on a measurable fraction of turns (<10%), the in-context augmentation is being ignored. Stop with a prompt-engineering writeup; consider stronger augmentation forms (explicit "in case X, do Y" injection rather than examples-as-context) before re-running.
- After Stage 3: if cell_128's multi-turn slope doesn't beat cell_126/110, the cross-dialogue memory hypothesis is wrong on this scenario family. Negative result still publishable as §6.Y.

**Explicitly out of scope for A15**:
- LoRA / weight-update training of any kind (the heavier "lightweight training" reading)
- Online RLHF using human-graded learner responses (A1 pilot territory)
- Per-learner adaptation (requires real humans across sessions — A1 pilot territory)
- Retrieval of whole prompts (only retrieve action-selection context, not the system prompt)
- Cross-experiment knowledge transfer (e.g. using cell_110 cache for cell_126 runs — would confound the architectural comparison)
- Embedding-model fine-tuning (use off-the-shelf throughout)

**Paper integration**: §6.Y within paper-full-2.0.md, after A14's §6.X lands. Pre-registration as paired comparison cells 126 vs 128 on the existing trap suite, with secondary comparison vs cell_110. Same single-paper discipline as A14.

**Decision gate**: do not start A15 until A14 Stage 4 has merged back to main AND the team has reviewed A14's empirical results. If A14 produces a strong positive (reduced unsupported-claim rate + measurable strict_shift improvement), A15 is the natural follow-up. If A14 produces a strong negative (extractor < 70%), A15 needs its key-derivation re-design before kickoff and the cost calculus shifts.

---

### A16. Cumulative-Rewrite Superego — Does Rewrite-Policy Statefulness Produce a Rate Effect? (CLOSED 2026-05-17 — pre-registered informative NULL; folded into paper §6.3.10 v3.0.83)

**Result (CLOSED 2026-05-17 — pre-registered informative null).** All three stages ran. P2 (code, mock + hermetic) landed 2026-05-16; P3 (paid run, n=48/arm, all four arms on `claude-code/sonnet` over `config/adaptive-trap-scenarios.yaml`) executed and resolved 2026-05-17. **Primary S1−S0 $d = -0.167$** (Welch $t = -0.82$, $p \approx 0.41$) — below the pre-registered $|d| \geq 0.27$ bar, point estimate marginally *reversed* (S1 < S0): the §6.3 slope-null **extends to cumulative lightweight prompt rewrite**. The only contrast clearing the bar is **S0−A $d = 0.286$** — i.e. the *stateless* arm the pre-registration predicted inert, opposite the hypothesis direction. Arms realised as F = `cell_132_a16_F_recognition_only`, S0 = `cell_129_superego_revise_stateless`, S1 = `cell_130_superego_revise_cumulative`, A = `cell_131_a16_A_egosuperego` (F and A are §5.12.6 *named* deviations: new model-aligned cells that hold the paper-cited nemotron `cell_111`/`cell_112` frozen, so the result stays confirmatory). Folded into `paper-full-2.0.md` §6.3.10 (v3.0.83) + Appendix E; primary endpoint computed by `scripts/analyze-a16-rewrite-slope.js`; independently audited (paper-claim-auditor PASS). **Do not relitigate or re-run** — the null is the closing result. The staged pre-registration below is retained as the design-provenance record.

**Origin**: 2026-05-16 promotion of the disposable `prototypes/adversarial-superego-mvp/` arc. The prototype established (mechanism triage, *not* a paper claim) that an adversarial superego with system-prompt edit rights produces a robust, replicated *level/reliability* effect over additive advice, but could not separate "rate" from "reliable endpoint convergence" on a 4-turn binary classifier. User supplied the generative theory (psychoanalytic: the superego revises the ego *continuously* under discursive frustration — each revision integrates accumulated friction) and the sharpening: **rate is a property of the rewrite *policy's* statefulness, not of edit rights per se** — and explicitly *not* an id-director clone (its statelessness is the property the theory says kills the slope). Pre-registered in `paper-full-2.0.md` §6.3.10 (v3.0.80); design source `prototypes/adversarial-superego-mvp/PROMOTION-PATH.md` §12.

**The decisive design** (4 arms, each adjacent pair = one variable; all reuse the §6.8.2 adaptive runner + trap-suite scenarios):
- **F** floor — `recognition_only` (exists, = cell_111). Predicts no shift.
- **A** advisory — `ego_superego` (exists, = cell_112 / A13 C2). Feedback → optional ego revision, *no prompt rewrite*. Predicts level, no rate (reproduces the §6.3 null).
- **S0** stateless rewrite — NEW. Rewrites the ego system prompt from the *current turn only* (≈ id-director). Predicts level, no rate.
- **S1** cumulative rewrite — NEW. Rewrites the ego system prompt conditioned on an *append-only revision ledger*. Predicts rate (positive `policyAction` slope) — the only §6.3-escaping outcome.

Decisive contrast = **S1 vs S0** (byte-identical edit-rights channel; sole difference = ledger-statefulness). Validity invariant: the manipulation lives *only* in the superego's rewrite input, never the ego's transcript view (S0/S1 egos are byte-identical nodes seeing identical dialogue). Primary endpoint: per-dialogue OLS slope of the externalised binary in-family `policyAction` indicator over the uncapped trajectory (the §6.8.2 instrument removes the prototype's free-text-classifier confound), scored with `scripts/analyze-trajectory-curves.js` parameterized onto the in-family indicator. Frozen 4-criterion decision grid (S1−S0 $d \geq 0.27$ at the §6.3.2 detectability bar; A & S0 slope $\approx 0$; cross-judge $\Delta d \leq 0.5$; counterfactual-branch brittleness guard). A null on S1−S0 is pre-declared informative (extends the §6.3 slope-null to even cumulative lightweight rewrite).

**Staged plan** — blast-radius gated, each stage a stop-and-checkpoint:

- [x] **P1 — docs/design only** (DONE 2026-05-16). Paper §6.3.10 pre-registration folded (v3.0.80 + Appendix E entry); this TODO entry. Zero code, zero spend, zero DB/paper-number changes.

- [x] **P2 — code, mock + hermetic only** (DONE 2026-05-16; $0). New `superegoRevise` graph node in `services/adaptiveTutor/graph.js` structurally modelled on the id-director persona constructor but writing a dedicated `tutorInternal.superegoAuthoredPrompt` (not `idAuthoredPrompt` — keep architectures non-colliding) consumed via the existing system-prompt-override path (no ego-node change). S1 appends one ledger entry/turn through an append-only reduced state channel cloned in pattern from A14's `evidenceLog` (`stateSchema.js` `evidenceLogReducer`). Two new `SUPPORTED_ARCHITECTURES` entries (`superego_revise_stateless`, `superego_revise_cumulative`) + graph branches + 2 cell defs in `config/tutor-agents.yaml` (the `cell_128`/A14 diff is the literal template) + `EVAL_ONLY_PROFILES` registration. Concrete `cell_*` IDs allocated here against a fresh `tutor-agents.yaml` grep (CLAUDE.md cell-ID-allocation discipline; §5.12.1 source-of-truth). Port the prototype's proven `buildCrossSuiteSuperegoPrompt` frustration→rewrite logic (incl. the validity choice: superego never sees the scenario answer key). **Exit**: `ADAPTIVE_TUTOR_LLM=mock` smoke shows `superegoRevise` in the visited-node set and `superegoAuthoredPrompt` flowing to the ego; S0 leaves `revisionLedger` unwritten, S1 accumulates it; `npm run test:hermetic` green; zero DB/paper writes.

- [x] **P3 — cost-gated paid run + slope analysis** (DONE 2026-05-17; n=48/arm; generation ≈$0 metered; result = the pre-registered null above). Real LLM, cross-suite trap scenarios, repeats; per-arm N and judges fixed at the §6.3.2 bar before unblinding. Cost estimate (sequential-call budget, `--max-cost` does NOT see account credit — `budget_tracker_gap`) presented and confirmed *before* spend. Score via the frozen §6.3.10 grid; fold result + numbers into §6.3.10 with a version bump + Appendix E entry (single-paper discipline).

**Stop-and-publish checkpoints**:
- After P2: if mock smoke shows the rewrite never reaches the ego or S0/S1 are not byte-identical on the ego side, the validity control is broken — stop and fix before any spend.
- After P3: if S1−S0 is null but A/S0 localisation holds, that *is* the pre-registered result (the §6.3 slope-null extends to cumulative lightweight rewrite) — publish as such, not as a failed run.

**Explicitly out of scope**: model-weight updates of any kind; cloning the id-director (statelessness is the S0 *control*, not the proposed mechanism); message-array mutation (the prototype showed the system-prompt-rewrite channel is load-bearing and array mutation unnecessary — `adversarial_superego_v3_result`); any parent-cell registration or DB/paper writes before P2/P3 respectively.

**Paper integration**: §6.3.10 within `paper-full-2.0.md` (pre-registration DONE at P1; result lands in the same subsection at P3). Single-paper discipline: no spin-off; the prototype asserts no paper claim and its figures are named non-findings in §6.3.10.

**Decision gate**: P2 may proceed now (docs-only P1 complete, user-authorized). P3 requires P2 green under mock+hermetic AND a fresh explicit per-stage go-ahead with a presented cost estimate — never launch the paid sweep unprompted.

---

### A17. One-Side Replay Replication Across Scenes (FOLLOW-UP — recorded 2026-06-02; §7.9 v3.0.117)

**Origin**: §7.9 v3.0.117. The one-side replay (`scripts/replay-one-side.js`) freezes a run's tutor + scene (`directorPlan`) and regenerates only the learner K times, isolating learner-variance from scene-variance. The first and only run so far (D\_OED5 run3 socratic, K=8) found the near-miss was a **learner draw, not a structural cap**: graded mean 3.38 vs the original 2.5 (3/8 full species, 5/8 grade ≥3.5) — the evidence-rich scene supports species-level discovery and run3's original learner merely under-committed (`exports/replay-d5-run3-socratic/`).

**Bound (why replication is needed)**: this is **one scene**. D\_OED5 run1's and run2's scenes were lost to a volatile-directory overwrite *before* the per-run `directorPlan` persistence fix landed, so they cannot be replayed. The structural-vs-draw verdict may differ for an *evidence-poor* scene (e.g. D\_OED5 run1, where the learner found "just the name, no identifier") — which the single run3 result cannot test.

**The follow-up**: now that generation persists `director-<arm>.json` per run, replicate across scenes. Generate fresh D\_OED5 (and D\_OED4) runs with persistence on; replay each scene's learner K≈8× and graded-score (`scripts/score-replays.js`); read the per-scene grade distribution (tight low cluster = structural cap; wide/high = learner draw). Hypothesis: the verdict tracks scene evidence-richness, confirming §7.9's two-layer model — *whether a scene carries a decisive artifact* is a scene property; *given* one that does, *whether a particular learner reaches the species* is partly a draw.

**Cost / gate**: paid generation + replay + scoring; exploratory (not pre-registered); gated on explicit go-ahead with a cost estimate. Result lands in §7.9 with a version bump if run.

---

### A18. Recursive Tutor-Learning Adaptation Benchmark (HIGH - recorded 2026-06-05; teacher-as-learner design)

**Origin**: 2026-06-05 decision checkpoint after the timing-pair pilot. The timing-pair result is a controlled negative: the pooled public-timing attribution effect dissolved under the coherence gate, while the coherence-clean subset had no headroom. Combined with §6.10's failed hidden-interior separability gate and the poetics replay/control failures, this shifts the next serious move away from polishing single transcripts and toward testing whether the tutor can revise its own strategy policy across resistant learner episodes.

**Reframe**: the tutor is the learner. The simulated learner is the environment that teaches the tutor which teaching strategies survive resistance. Adaptation is therefore not "this transcript looks responsive" but "after a failed attempt, the tutor records a bounded strategy lesson and uses it to improve on a held-out sibling case."

**Claim discipline**:
- This does **not** claim human learning, deployed tutoring, hidden-interior measurement, or causal learning from a single transcript.
- It asks whether a fixed-weight tutor pipeline can externalize policy revision in a reproducible apparatus: resistance -> diagnosis -> strategy revision -> held-out transfer.
- The decisive evidence unit is a contrastive before/after family, not a single polished replay.
- Any positive result is a claim about **observable tutor policy revision under simulated learner resistance**, not about real student learning.

**Five-step experimental spine**:

- [ ] **Step 1 - Build 3-5 resistant scenario families.** Each family has an artificial/local obstruction that is not a standard curricular misconception already solved by generic pedagogy. Each family needs at least one training seed and one held-out sibling with the same obstruction grammar but different surface content.
  - [ ] Define the scenario-family schema: `family_id`, `obstruction_type`, `local_rule`, `training_seed`, `heldout_siblings`, `success_criterion`, `forbidden_shortcuts`.
  - [ ] Prefer invented/local relations over familiar school distinctions so "organic curriculum drift" is less available as an explanation.
  - [ ] Add cheap static validators for leakage: no explicit final reframe in the setup; no tutor cue that simply states the rule; no held-out sibling sharing verbatim answer phrases.

- [ ] **Step 2 - Run attempt 1 and score the failure mode.** The initial tutor attempt should be judged for what kind of resistance it failed to overcome, not merely whether the transcript was fluent.
  - [ ] Reuse existing replay/local-critic machinery where possible before adding new scorers.
  - [ ] Capture a structured failure record: `missed_obstruction`, `wrong_strategy_family`, `overhelped`, `underconstrained`, `learner_polish_without_uptake`, `coherence_artifact`, or `success`.
  - [ ] Store public transcript, held-out tutor/learner deliberation, and scorer rationale separately with explicit provenance.

- [ ] **Step 3 - Produce a bounded tutor strategy revision.** The tutor writes a reusable lesson from the failure, constrained to a finite policy vocabulary.
  - [ ] Strategy revision must cite the failed learner evidence and name the old strategy, the repair strategy, and the transfer condition.
  - [ ] Revision may update a policy ledger or director plan; it may not rewrite the held-out scenario answer or smuggle the target reframe.
  - [ ] Candidate policy fields: `diagnostic_trigger`, `avoid_move`, `preferred_move`, `material_constraint`, `uptake_test`, `transfer_warning`, `expiry_condition`.

- [ ] **Step 4 - Test attempt 2 on a held-out sibling.** The revised policy is applied to a new sibling case, not the same transcript.
  - [ ] Compare revised tutor vs unrevised baseline on the same held-out sibling.
  - [ ] Keep the learner generation path fixed or paired where possible so the contrast is policy revision, not learner-draw luck.
  - [ ] Require public uptake tied to the revised strategy, not just higher coherence or recognitive wording.

- [ ] **Step 5 - Evaluate transfer with a gated panel only after local survival.** Panel spending waits until a family passes cheap structural and local-critic gates.
  - [ ] Local survival gate: baseline fails or remains weak; revised policy improves on held-out sibling; no leakage warnings; no coherence-confound warning.
  - [ ] Panel question: "Did the revised tutor strategy address the learner resistance in a way the baseline did not?"
  - [ ] Report family-level pass/fail plus failure taxonomy. Do not pool across families until at least two families survive the local gate.

**Implementation plan**:

- [x] **A18.0 - Design note** (zero API). Create `notes/poetics/recursive-tutor-learning-benchmark.md` with the above claim boundary, scenario-family schema, stop rules, and success criteria. DONE 2026-06-05.
- [x] **A18.1 - Scenario-family fixture** (zero API). Add a small config under `config/poetics-calibration/` or `config/recursive-tutor-learning/` with 3 pilot families and held-out siblings. DONE 2026-06-05: `config/recursive-tutor-learning/pilot-families.yaml`.
- [x] **A18.2 - Replay harness extension** (zero/low API). Extend existing replay scripts to support `attempt1 -> failure_record -> policy_revision -> attempt2_heldout`, preserving separate public transcript and held-out deliberation artifacts. DONE 2026-06-05: `scripts/run-recursive-tutor-learning-benchmark.js` materializes attempt-chain fixtures and replay commands against the existing recursive tutor-learning gate.
- [x] **A18.3 - Local gate** (cheap local critics first). Add a local scoring/report script that emits per-family status: `clean_survivor`, `revise_again`, `coherence_confound`, `leakage`, `organic_drift`, `no_headroom`. DONE 2026-06-05: `scripts/report-recursive-tutor-learning-local-gate.js`, exposed as `npm run poetics:recursive-tutor-gate`.
- [x] **A18.4 - Minimal run** (attended). Run 3 families x 1 attempt chain with local critics only. DONE 2026-06-05: attempt-1 produced 2 local survivors (`glyph_tail_owner`, `window_scope_claim`) and 1 revise-again (`peg_lane_modifier`); policy fill promoted only the 2 survivors; checker-only held-out baselines rejected; policy-guided held-out replays survived; final local family gate reports `clean_survivor: 2`, `revise_again: 1`.
- [x] **A18.5 - Panel only on survivors** (paid, explicit go-ahead). If at least one family is a clean survivor, run a small adversarial panel on only those families. DONE 2026-06-05: default 5-critic panel on the two clean survivors yielded one panel pass (`window_scope_claim`: 4/5 recognition, 4/5 peripeteia-origin) and one origin failure (`glyph_tail_owner`: 5/5 recognition, 2/5 peripeteia-origin). `peg_lane_modifier` stayed held back. Durable result note: `notes/poetics/2026-06-05-a18-recursive-tutor-panel-result.md`.
- [x] **A18.6 - Policy-memory ablation on the positive family** (paid, explicit go-ahead). Compare S0 no-policy held-out rewrite vs S1 policy-memory held-out rewrite for `window_scope_claim`. DONE 2026-06-05: S0 also passed locally and on the blind panel (`5/5` recognition, `3/5` peripeteia-origin), while S1 passed at `4/5` recognition and `4/5` peripeteia-origin. Verdict: `no_local_headroom` and `no_panel_headroom`; current replay channel is too permissive to claim explicit policy-memory causality. Durable result note: `notes/poetics/2026-06-05-a18-policy-memory-ablation-result.md`.
- [x] **A18.7 - Restricted-information policy-memory ablation** (paid local only; panel gated on local headroom). Generate S0 and S1 fresh on the same held-out sibling with `inner_max_chars=0`, preserving policy memory only for S1. DONE 2026-06-05: prompt audit confirmed both arms had no held-out inner context and S1 alone had the filled policy object, but both arms survived locally with near-identical scores. Verdict: `no_local_headroom`; blind panel correctly skipped by `panel_policy=headroom`. Durable result note: `notes/poetics/2026-06-05-a18-restricted-policy-ablation-result.md`.
- [x] **A18.8 - S0-hard bounded-transfer redesign** (zero/low API until local contrast exists). Stop paneling `window_scope_claim` variants unless S0 first fails locally. DONE 2026-06-06: added bounded continuation mode and a policy-contrast gate, then ran `window_scope_claim` locally with no held-out inner context. S0 and S1 both survived; S0 scored slightly higher locally and independently hit the learned `scope_test` strategy. Verdict: `no_local_headroom` plus `s0_recreates_policy_strategy`; no panel candidate. Durable result note: `notes/poetics/2026-06-06-a18-s0-hard-bounded-transfer-result.md`.
- [x] **A18.9 - Under-determined transfer-family redesign** (zero/low API first). Stop treating `window_scope_claim` as a policy-memory transfer candidate. Build new held-out siblings where the public setup admits multiple plausible tutor repairs and the attempt-1 policy selects among them under a transfer condition that is not obvious from the held-out stage alone. DONE 2026-06-06: added `selector_rail_priority`, preserving four plausible public repairs while selecting `selector_tab_test` as the learned policy. With bounded continuation, no held-out inner metadata, and the policy-contrast gate, both held-out siblings showed local S1-over-S0 headroom (`selector_holdout_blue_lower`: S0 `reject`, S1 `survivor`, `policy_distinct`; `selector_holdout_gold_middle`: S0 `revise_again`, S1 `survivor`, `policy_distinct`). No panel run yet. Durable result note: `notes/poetics/2026-06-06-a18-underdetermined-transfer-result.md`.
- [x] **A18.10 - Contrastive blind panel for A18.9** (paid, gated). Package only the clean `selector_rail_priority` S0/S1 bounded-transfer pairs and ask whether the policy-memory tutor uses the learned selector policy to address learner resistance in a way the no-policy tutor does not. DONE 2026-06-06: added `poetics:recursive-tutor-contrast-panel` and ran the five-critic contrastive panel over both clean A18.9 siblings. Result: overall `contrast_panel_pass`; `selector_holdout_blue_lower` passed at `3/5` transfer votes with `2/5` high ordinary-inference cautions, and `selector_holdout_gold_middle` passed at `5/5`. No critic preferred S0 or treated the arms as equivalent. Durable result note: `notes/poetics/2026-06-06-a18-contrastive-policy-panel-result.md`.
- [x] **A18.11 - Second under-determined transfer family** (zero/low API first). Do not tune the selector family further. Build a different artificial local relation with multiple plausible public repairs, run the A18.9 S0-hard bounded-transfer screen, and only panel if the family shows the same local S1-over-S0 policy-distinct headroom. DONE 2026-06-06: added `notch_rotation_priority` with selected repair `rotation_fit_test`. Attempt 1 survived and policy fill worked. Held-out `notch_holdout_green_top` showed local S1-over-S0 headroom (`S0=revise_again`, `S1=survivor`, `policy_distinct`), but `notch_holdout_red_middle` failed the family gate because S0 also survived (`no_local_headroom`) via a different public notch-relation repair. No panel run. Durable result note: `notes/poetics/2026-06-06-a18-second-family-result.md`.
- [x] **A18.12 - Repair the second-family design** (zero/low API first). Redesign the non-selector family so the selected repair is less publicly self-solving: S0 should be able to choose a plausible non-policy repair, but that repair should not itself satisfy the local recursive tutor-learning gate. Prefer separating the selected repair from the same visible object vocabulary that makes S0's alternative repair survive. DONE 2026-06-06: added `bead_predecessor_priority` with selected repair `predecessor_alias_test`. The first training attempt failed because the bead strip read as scene furniture; after tightening the hidden device constraint, training survived and policy fill worked. Held-out `bead_holdout_blue_upper` showed local S1-over-S0 headroom (`S0=revise_again`, `S1=survivor`, `policy_distinct`), but `bead_holdout_gold_middle` failed the family gate because S0 also survived via a different exact repeated badge-mark repair. No panel run. Durable result note: `notes/poetics/2026-06-06-a18-second-family-repair-result.md`.
- [x] **A18.13 - Policy-correctness gate for underdetermined transfer** (zero/low API first). Extend the local gate or ablation report so local survivor status for underdetermined families requires the continuation to apply the registered selected repair to the registered target, not merely any coherent public repair that resolves learner resistance. This should distinguish "adaptive but wrong policy" from genuine policy-memory transfer before another contrastive panel. DONE 2026-06-06: added sibling-level `policy_correctness` metadata, future-report `policy_correctness_gate` / `effective_local_verdict`, and a zero-cost `poetics:recursive-tutor-policy-correctness` reporter. Re-scoring A18.12 changed `bead_holdout_gold_middle` from raw `no_local_headroom` to effective `policy_memory_local_advantage` because S0's raw survivor used the wrong target/repair while S1 applied `predecessor_alias_test` to `middle_naro`. Both A18.12 bead siblings are now corrected panel candidates. Durable result note: `notes/poetics/2026-06-06-a18-policy-correctness-gate-result.md`.
- [x] **A18.14 - Correctness-gated contrastive panel for the bead family** (paid, gated). Run the contrastive blind panel over the two A18.13-corrected `bead_predecessor_priority` pairs using the A18.13 overlay. Decisive read: do blind critics attribute S1's selected-policy use to policy transfer rather than ordinary public inference? DONE 2026-06-06: five-critic contrastive panel passed both corrected bead pairs. `bead_holdout_blue_upper` received `5/5` transfer votes with all low ordinary-inference risk; `bead_holdout_gold_middle` received `5/5` transfer votes with three low and two medium ordinary-inference risk ratings. No equivalence votes, S0-preferred votes, or critic errors. Durable result note: `notes/poetics/2026-06-06-a18-correctness-gated-bead-panel-result.md`.
- [x] **A18.15 - Cross-family synthesis and claim boundary** (zero API). Synthesize A18.10 selector-family and A18.14 bead-family results into an explicit claim boundary for reliable peripeteia-induced adaptation. DONE 2026-06-06: A18 now supports a bounded counterfactual-replay claim across two artificial local-relation families: saved attempt-1 policy memory can transfer to held-out siblings in ways blind contrastive critics distinguish from no-policy continuations. Selector results passed at `3/5` and `5/5`; bead results passed at `5/5` and `5/5` under the A18.13 correctness overlay. Claim remains short of "reliable peripeteia-induced adaptation" because the bead family depends on a post-hoc correctness gate and all evidence is simulated offline replay, not human learning, deployed tutoring, model-weight learning, or a main-harness rate effect. Durable result note: `notes/poetics/2026-06-06-a18-cross-family-claim-boundary.md`.
- [x] **A18.16 - Pre-register correctness-gated fresh-family replication** (zero API before generation). Freeze the A18.13 policy-correctness gate, selected-policy target schema, S0-hard bounded-transfer local gate, contrastive-panel vote rule, ordinary-public-inference caveat handling, and stop rules before generating another family. DONE 2026-06-06: added frozen protocol `config/recursive-tutor-learning/a18-correctness-gated-protocol.yaml`, zero-API validator `scripts/validate-recursive-tutor-protocol.js`, npm wrapper `poetics:recursive-tutor-protocol`, and durable note `notes/poetics/2026-06-06-a18-correctness-gated-preregistration.md`. Decisive next claim test: can a third artificial local-relation family pass the frozen protocol without post-hoc gate repair?
- [x] **A18.17 - Fresh third-family local screen under frozen protocol** (zero/low API, no panel). Author or generate a third artificial local-relation family after the A18.16 freeze, validate it with `poetics:recursive-tutor-protocol`, then run only the S0-hard bounded-transfer local screen. DONE 2026-06-06: authored post-freeze `hinge_shadow_priority` (`config/recursive-tutor-learning/a18.17-fresh-family.yaml`), validated it under protocol v1, materialized the chain, ran attempt-1 Codex/Claude replay (`survivor: 1`), filled policy memory, then ran the first held-out S0/S1 bounded local screen. S1 was a survivor and policy-correct while S0 was `revise_again`, but the frozen policy-contrast gate blocked the pair as `not_policy_distinct` (S0 overlap `0.545`, S1 overlap `0.545`, distinctiveness `0`). No panel was run; second sibling skipped because the family could no longer reach two local candidates. Durable result note: `notes/poetics/2026-06-06-a18-fresh-family-local-screen-result.md`.
- [x] **A18.18 - Policy-distinctiveness diagnosis before another family** (zero API). Decide whether to keep A18.16 protocol v1 and author a less lexicalized selected repair, or pre-register a protocol v2 for policy-signature measurement before any future generation. DONE 2026-06-06: zero-API diagnosis concludes the A18.17 failure is family-side, not a reason to relax protocol v1. S0 improvised a hinge-contact repair close enough to S1's hinge-smudge policy route that signature distinctiveness was exactly `0`; the frozen gate correctly blocked it. Keep protocol v1; next family should reduce public lexical self-solving. Durable result note: `notes/poetics/2026-06-06-a18-policy-distinctiveness-diagnosis.md`.
- [x] **A18.19 - Fresh protocol-v1 family with lexical-risk review** (zero API before generation). Author another post-freeze artificial local-relation family whose selected repair depends on a relation not named as ordinary public vocabulary in the setup. DONE 2026-06-06: added `sidepair_bracket_priority` in `config/recursive-tutor-learning/a18.19-fresh-family-low-lexical.yaml`. The family passes the frozen A18.16 protocol validator and the benchmark static validator. Manual public-field search found zero hits for selected-policy vocabulary (`bracket complement`, `missing mate`, `side-pair`, `partner side`, `complementary fleck`, `missing-partner`, `bracket`, `complement`). No replay generation was run. Durable review note: `notes/poetics/2026-06-06-a18-fresh-family-lexical-risk-review.md`.
- [x] **A18.20 - Local-only run for A18.19 family** (low API, no panel). Materialize the `sidepair_bracket_priority` attempt chain, run attempt-1 replay, fill policy only if attempt 1 survives, then run S0/S1 bounded local screens. DONE 2026-06-06: attempt-1 survived and policy fill completed. Both held-out siblings became local candidates under the frozen gate: `sidepair_holdout_green_left` was raw `no_local_headroom` but effective `policy_memory_local_advantage` because S0 used the wrong target while S1 applied the registered selected repair (`policy_distinct`, distinctiveness `0.180`); `sidepair_holdout_blue_lower` was raw/effective `policy_memory_local_advantage` (`policy_distinct`, distinctiveness `0.282`). Durable result note: `notes/poetics/2026-06-06-a18-sidepair-local-and-panel-result.md`.
- [x] **A18.21 - Contrastive panel for the A18.20 local candidates** (paid, gated). Package only the two `sidepair_bracket_priority` local candidates and run the five-critic blind contrastive panel. DONE 2026-06-06: strict panel failed both pairs at `2/5` transfer votes, below the required `3/5`, with no S0-preferred votes and all critics selecting S1 as winner on both pairs. Sensitivity read: dropping only the `learner_resistance_addressed_side` vote-blocking field would make both pairs `3/5`, and allowing differential policy use >= 3 would make both `4/5`; this remains post-hoc and does not convert the strict result into a pass. Durable result note: `notes/poetics/2026-06-06-a18-sidepair-local-and-panel-result.md`.
- [x] **A18.22 - Panel vote-rule diagnosis and next protocol choice** (zero API before any further scoring). Decide whether to keep the strict A18.16 panel rule and design for stronger public learner-resistance uptake, or pre-register a new protocol version where `learner_resistance_addressed_side` is diagnostic rather than vote-blocking. DONE 2026-06-06: A18.21 remains a strict `strict_v1` panel failure. Added future-facing `policy_core_v2` support to the contrast-panel script and froze `config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml`, where policy-side attribution, S1 winner, policy-transfer-like origin, differential policy use >= 4, and non-high ordinary-public-inference risk remain vote-blocking while `learner_resistance_addressed_side` becomes a diagnostic caveat. Durable diagnosis note: `notes/poetics/2026-06-06-a18-panel-vote-rule-diagnosis.md`.
- [x] **A18.23 - Validate v2 protocol and no-score panel packaging smoke** (zero API). Validate `a18-panel-vote-rule-v2.yaml` against existing underdetermined-transfer fixtures, run the contrast-panel package smoke with `--vote-rule policy_core_v2 --skip-score`, and verify report provenance records the active vote rule. DONE 2026-06-06: v2 protocol validation passed over three existing underdetermined-transfer fixtures (`errors: 0`, `warnings: 0`), targeted contrast-panel and validator tests passed (`10/10`, `3/3`), and the no-score package smoke over the A18.21 sidepair candidate bundle wrote `vote_rule: policy_core_v2` into both manifest and report. Durable smoke note: `notes/poetics/2026-06-06-a18-v2-validation-smoke.md`.
- [x] **A18.24 - Zero-API A18.21 v2 sensitivity recomposition** (diagnostic only). Re-summarize the saved A18.21 critic rows under `policy_core_v2` without changing the stored strict-v1 report. DONE 2026-06-06: saved A18.21 rows remain strict-v1 failures at `2/5` and `2/5`, but recomposition under future `policy_core_v2` would pass both pairs at exact-majority `3/5`. Each pair carries one learner-resistance diagnostic warning; Claude remains blocked by differential policy use `3`, while DeepSeek blocks on equivalence/high ordinary-public-inference risk. This motivates v2 but does not relabel A18.21 because v2 was frozen after those scores. Durable note: `notes/poetics/2026-06-06-a18-policy-core-v2-sensitivity.md`.
- [x] **A18.25 - Fresh post-v2 family authoring and validation** (zero API). Author a fresh artificial local-relation family after the A18.22 freeze, reference `a18-panel-vote-rule-v2.yaml`, run the protocol validator, and do a lexical-risk review before any generation. DONE 2026-06-06: added `diagonal_socket_priority` in `config/recursive-tutor-learning/a18.25-fresh-family-v2.yaml`, validated it under `a18-panel-vote-rule-v2.yaml` (`errors: 0`, `warnings: 0`), passed benchmark dry-run (`ready_for_attempt1: 1`), and found zero public-field hits for selected-policy vocabulary across 12 checked fields. Durable review note: `notes/poetics/2026-06-06-a18-fresh-v2-family-lexical-risk-review.md`.
- [x] **A18.26 - Local-only run for A18.25 family under v2** (low API, no panel). Materialize `diagonal_socket_priority`, run attempt-1 replay, fill policy only if attempt 1 survives, then run S0/S1 bounded local screens on both held-out siblings with `--fresh-s1 --inner-max-chars 0 --rewrite-mode bounded_continuation --policy-contrast-gate --panel-policy headroom --skip-panel`. DONE 2026-06-06: Codex attempt-1 hit local usage limits, so the replay was retried with Claude generator + `agy` checker. Attempt 1 survived and policy fill completed. Held-out `socket_holdout_blue_lower` became a local candidate (`S0=revise_again`, `S1=survivor`, `policy_distinct`, correctness advantage), but `socket_holdout_red_upper` failed (`S0=survivor`, `S1=survivor`, `not_policy_distinct`, no correct policy application). No panel: only one of two siblings cleared the local gate. Durable result note: `notes/poetics/2026-06-06-a18-fresh-v2-local-result.md`.
- [x] **A18.27 - Diagonal-socket local failure diagnosis** (zero API). Decide whether the A18.26 failure is repairable by tightening the same-position-vs-opposite-position public counterexample, or whether to abandon `diagonal_socket_priority` and author a different post-v2 relation. DONE 2026-06-06: failure diagnosed as family-design ambiguity. The intended inverse/completion rule ("same position duplicates; opposite position completes") was too easy to replace with the ordinary public same-position rule, especially on the red sibling where same-position aligned with color and nearness. Do not panel or patch it as a fresh replication. Durable diagnosis note: `notes/poetics/2026-06-06-a18-diagonal-socket-failure-diagnosis.md`.
- [x] **A18.28 - New post-v2 non-inverse family authoring** (zero API). Author a different post-v2 artificial local-relation family whose selected repair is not simply the inverse/opposite of an obvious public match relation. DONE 2026-06-06: added `thread_source_priority` in `config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml`. It validates under `a18-panel-vote-rule-v2.yaml` (`errors: 0`, `warnings: 0`), passes benchmark dry-run (`ready_for_attempt1: 1`), and has zero public-field hits for selected-policy vocabulary across 12 fields. Durable review note: `notes/poetics/2026-06-06-a18-non-inverse-family-lexical-risk-review.md`.
- [x] **A18.29 - Local-only run for A18.28 non-inverse family** (low API, no panel). Materialize `thread_source_priority`, run attempt-1 replay with non-Codex backends while Codex quota is exhausted, fill policy only if attempt 1 survives, then run S0/S1 bounded local screens on both held-out siblings. DONE 2026-06-06: attempt 1 survived and policy fill completed, but both held-out siblings failed the local family gate. S0 and S1 both survived on both siblings; policy contrast was distinct, but policy correctness remained `no_correct_policy_application`. Detailed read: broadening selected-repair markers would not rescue the family because S0 also solved the targets via the visible round-nub/contact-shape cue. No panel. Durable result note: `notes/poetics/2026-06-06-a18-non-inverse-local-result.md`.
- [x] **A18.30 - Stop-rule synthesis for post-v2 family construction** (zero API). Synthesize A18.26 and A18.29 into a family-design constraint before authoring or scoring another fixture: avoid both inverse-rule instability and public self-solving. DONE 2026-06-06: A18.26 classified as `inverse_rule_instability`; A18.29 classified as `public_self_solving`. The manual family loop has reached diminishing returns unless fixture construction becomes structured around cue maps, target salience, counterexamples, and marker-width checks. Durable synthesis note: `notes/poetics/2026-06-06-a18-post-v2-family-stop-rule-synthesis.md`.
- [x] **A18.31 - Structured cue-map preflight for future families** (zero API). Extend candidate family fixtures or add sidecars with cue maps, then implement a static reporter that flags `inverse_rule_instability_risk`, `public_self_solving_risk`, `target_salience_overload`, `marker_too_narrow`, `marker_too_broad`, and `counterexample_missing` before local replay spending. DONE 2026-06-06: added `scripts/report-recursive-tutor-cue-map-risk.js`, npm wrapper `poetics:recursive-tutor-cue-risk`, cue-map sidecar `config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml`, and tests. The reporter reproduces the A18.26/A18.29 failure classes without model calls. Durable note: `notes/poetics/2026-06-06-a18-cue-map-risk-reporter.md`.
- [x] **A18.32 - Gate the next family on cue-map preflight** (zero API before replay). Author or revise the next candidate family only with an explicit cue map, require the cue-risk reporter to pass or produce only accepted warnings, and do not run attempt-1 replay until the preflight is clean. DONE 2026-06-06: added `fold_anchor_priority` in `config/recursive-tutor-learning/a18.32-fresh-family-cue-pass.yaml`, added its cue-map entry, and calibrated cue-risk tests with prior selector/bead positives plus post-v2 negatives. The new candidate passes protocol validation, benchmark dry-run, cue-risk preflight, and public-field lexical screen with zero issues. Durable preflight note: `notes/poetics/2026-06-06-a18-fold-anchor-cue-preflight.md`.
- [x] **A18.33 - Local-only run for A18.32 cue-pass family** (low API, no panel). Materialize `fold_anchor_priority`, run attempt-1 replay with non-Codex backends while Codex quota is exhausted, fill policy only if attempt 1 survives, then run S0/S1 bounded local screens on both held-out siblings. DONE 2026-06-06: attempt 1 survived and policy fill completed, but both held-out siblings failed the local family gate. S0 and S1 both survived on both siblings; `fold_holdout_blue_upper` was `not_policy_distinct`, and both siblings had `no_correct_policy_application`. Detailed read: S1 often made the intended eligibility/governance move in natural language, but S0 also solved via the public folded-nub pointer relation, so broadening markers would not create headroom. No panel. Durable result note: `notes/poetics/2026-06-06-a18-fold-anchor-local-result.md`.
- [x] **A18.34 - Harden cue-map preflight against selector-like self-solving** (zero API). Extend the cue-risk reporter with a `selector_like_public_governance_self_solving` class so fresh visible marker-adjacent authority cues fail preflight unless they require a constructed public device, a non-adjacent cue relation, or are explicitly marked as prior empirical positive controls. DONE 2026-06-06: reporter now reads cue geometry, empirical status, and constructed-device requirements. It still passes prior empirical positives (`selector_rail_priority`, `bead_predecessor_priority`) while newly failing `fold_anchor_priority` with `selector_like_public_governance_self_solving`, converting the A18.33 local false negative into a reusable preflight gate. Durable note: `notes/poetics/2026-06-06-a18-cue-risk-selector-self-solving-hardening.md`. Documentation audit for A18.33/A18.34: `notes/poetics/2026-06-06-a18-33-34-documentation-audit.md`.
- [x] **A18.35 - Constructed-device cue-map candidate** (zero API before replay). Author the next fresh candidate only if it uses a constructed public device or non-adjacent selected relation, passes the hardened cue-risk reporter, and avoids the three known post-v2 failure classes: inverse instability, direct public self-solving, and selector-like adjacent-marker self-solving. DONE 2026-06-06: scaled from one candidate to a **12-family fanout** (`config/recursive-tutor-learning/a18.35-*.yaml` + paired `.cue-map.yaml`); 10 require a constructed device, 2 (`relational_betweenness`, `distal_correspondence`) use a non-adjacent relation. All 12 clear the A18.34 hardened preflight (12/12 pass, zero issues). Durable note: `notes/poetics/2026-06-06-a18-35-constructed-device-fanout.md`.
- [x] **A18.36 - Fix lexical correctness false-negative + first fresh-family convergence** (zero API). The strict contiguous-substring correctness overlay false-negatived natural S1 phrasing ("slot six has a neri" vs registered "neri in slot six"), masking genuine headroom. DONE 2026-06-06: added an additive order-insensitive, proximity-bounded relaxed matcher in `run-recursive-tutor-policy-ablation.js` (strict verdict unchanged), 11 anti-closed-loop tests in `tests/recursiveTutorPolicyCorrectness.test.js` (wrong-slot S0 arms still rejected, proven on verbatim continuations), and the zero-API `scripts/rescore-recursive-tutor-correctness-relaxed.js`. `relational_betweenness` shows architecture-independent local headroom on BOTH held-out siblings via 3 channels; relaxed rescore: `family_local_headroom_relaxed: true`, `corrected_false_negatives: 2`. Durable note: `notes/poetics/2026-06-06-a18-36-lexical-false-negative-fix-and-convergence.md`.
- [x] **A18.37 - Fresh-family replication of the recursive teacher-as-learner transfer** (low API, sequential, no panel — **canonical result shipped in §7.9 / paper v3.0.123**). The question: does the saved attempt-1 lesson transfer across *fresh* reasoning-trap families, or is it confined to the one prior family (`relational_betweenness`)? Adjudicated by the blind three-critic arbiter (`scripts/blind-option-adjudication.js`), which reads only the held-out continuation with target/decoy aliases held out and matched mechanically downstream: **policy memory shows a blind-detectable held-out advantage on 5 of 8 held-out scenarios across four fresh families** (`relational_betweenness`, `distal_correspondence`, `second_in_constructed_order_priority`, `constructed_midpoint_priority`). Every elicited family converges on at least one of its two held-out scenarios, and three of the four split across their two scenarios — so the counting unit is the individual held-out scenario, not the family. A real but thin and conditional multi-family signal: not a single-family result, not unconditional transfer.
  - **Superseded reading (do not cite):** the earlier strict-gate local-screen pipeline reported "0 of 5 fresh survivors converge." Wrong instrument — a lexical correctness gate that misreads natural phrasing in both directions (false-negative *and* false-positive), the channel §7.9 deliberately retired in favour of the blind arbiter. The four floating rates this one question produced, and why only §7.9's 5-of-8 is canonical, are recorded in memory `project_a18_37_canonical_adjudication`.
  - **Independent cross-check (confirmation, not the rate of record):** `scripts/readjudicate-a18-transfer.js` reads the same continuations by a committed-answer hand criterion and agrees with the blind arbiter on every shared held-out scenario. It self-reports two limits: a glob that skips `distal_correspondence`'s deeper layout, and a 0.12 numeric distinctiveness gate that is a stricter proxy than the arbiter's function-level reasoning-basis guard.
  - **Bounded open tail (optional extension, ~24-call attended paid run):** the blind arbiter has not been run on the two resolved-but-uncovered families (`overlay_registration`, `pointer_chain_two_hop`); covering them would take the adjudicated count from 8 to 12 held-out scenarios under one instrument. Also unsettled: whether headroom needs the function-level reasoning-basis guard or mere option-advantage (it decides `pointer_chain`). The remaining families (`legend_decode`, `tally_parity`) stay unmaterialized.
  - **Why it matters beyond A18:** this is the empirical gate on the teacher-as-learner → ML/fine-tuning ladder (see A18.38). A thin, conditional signal readable only through a blind semantic channel is the worst case for Goodhart — it argues for staying weight-free, not for distilling into weights.

- [ ] **A18.38 - Teacher-as-learner → ML/fine-tuning ladder (DESIGN POINTER, gated on A18.37; NOT greenlit).** Design note: `notes/poetics/2026-06-06-teacher-as-learner-reframe-ml-ladder.md`. The reframe ("the tutor learns by overcoming learner resistance") structurally contributes the one thing the surface-responsiveness frame never had — a labeled train/test split (`training seed → held-out sibling + transfer criterion`). That unlocks a ladder: in-context/retrieval (A18 replay + A15 cache, already built) → rejection-sampling SFT on transfer-winning policies (= D3 Bridge-3 best-of-N promoted to a training loop) → DPO on the contrastive-panel S1>S0 pairs → RL with the learner as environment (A15 scopes out). **Binding constraint:** signal trustworthiness (A18.5–.37 fragility + Goodhart amplification), what the model already knows (A3/A10/A14/A16), and the provider-agnostic substrate posture (A15/A16 scope weight updates out; a swappable LoRA adapter is the least-bad form). **Decision rule (now evaluable — A18.37 closed in §7.9):** the gate yielded a thin, conditional multi-family rate (5 of 8 held-out scenarios) readable only through a blind semantic channel — the worst case for Goodhart. Per the design note the verdict is **stay weight-free for now**: the justified next rung is in-context/retrieval (A15 attacking the slope gap), not weights. Rejection-sampling SFT on transfer-winning policies (swappable LoRA adapter) becomes defensible only if a stable rate survives widening the *trusted* channel (the blind arbiter on the two uncovered families, §7.9 tail), never a surface proxy. Single-paper discipline: lands as a §6.X if ever run, no spin-off.

**Stop rules**:
- Stop before panel if fewer than one family survives the local gate.
- Stop and redesign scenario families if failures are dominated by `no_headroom` or `organic_drift`.
- Stop and redesign the policy ledger if revisions are mostly generic slogans rather than evidence-bound strategy changes.
- Stop and record a negative if revised and unrevised tutors converge on the same held-out move despite distinct ledgers.

**Relation to prior arcs**:
- A14 tested evidence-bound action selection inside a trap-suite controller and found apparatus-positive but graded-outcome weak results.
- A15 sketches cross-dialogue retrieval from prior policy/outcome tuples.
- A16 asked whether cumulative rewrite statefulness can produce a rate effect — closed null (S1−S0 $d=-0.167$; §6.3.10).
- A18 is narrower than all three: a small recursive teacher-as-learner benchmark where the tutor must demonstrate bounded policy revision across a training/held-out pair.

**Decision gate**: start with A18.0-A18.2 only. No paid panel and no paper claim until a local-gated held-out survivor exists.

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

### B7. Split structural-critic peripeteia rule into earned vs named reorientation (DROPPED — surgery 20260528 confirmed co-occurrence)
The peripeteia rule check `peripeteia_arm_without_earned_reorientation` in `scripts/critic-poetics-structure.js` conflates two separable things into a single violation:
- **(a) earned**: the learner enacts a semantic shift in action (mechanism-level reorientation present in the post-peripeteia turn)
- **(b) named**: the learner names the shift with literal `PERIPETEIA_PRESSURE_FRAME` + `PERIPETEIA_REPLACEMENT_FRAME` tokens (`the pressure was`, `the old check was`, `now the check is`, `the new check is`, etc.)

The rule passes only when both co-occur. This was generator-style-sensitive in `phase2-adaptation-recognition-loop-20260527T232739Z`: codex lifted the stems verbatim and passed consistently; Opus paraphrased into image-driven physical reorientation and failed the literal-token regex even when (a) was plainly present ("Band, not the digit" is mechanism-level reorientation that the rule cannot see; iter-1 failed 0/3 peripeteia-only items).

**Why dropped**: the prompt-side surgery in `phase2-adaptation-recognition-loop-20260528T022408Z` (mandate at least one literal stem from each list with a worked exemplar) demonstrated that (a) and (b) co-occur reliably when the mandate is in the director prompt: the structural critic now passes peripeteia-only items 4/4 against the prior 0/3, and Sonnet 4.6 reads them as `peripeteia_induced` 3/3. The rule split would have been load-bearing only if the surgery had failed; it did not. Filed and dropped — keep the entry for traceability but do not implement.

See B8 for the remaining load-bearing surgery (scorer-side classifier CUT) revealed by the same rerun.

### B8. Lower `recognitionOrigin.js` `tutorAdaptiveMechanism` CUT or recalibrate critic panel (MEDIUM — gated arc terminal blocker)
The `phase2-adaptation-recognition-loop-20260528T022408Z` rerun reached terminal saturation on `organic_or_ambiguous_recognition` (3 consecutive iterations), but post-hoc subagent diagnosis located the failure at the scoring pipeline, not the generator. Two coupled problems:

- **`recognitionOrigin.js` hard CUT of 75 on `tutorAdaptiveMechanism`**: Qwen and DeepSeek consistently score the same mechanism evidence at 50, with prose that explicitly credits the device (Qwen on T18-peripeteia-only: "*The tutor explicitly contrasts the old representation (floating tiles) with the new one (the fixed diagram) and introduces a new physical action (drawing with a marker) to resolve the learner's specific block*"). The classifier returns `class: 'organic'` with `basis: 'recognition_without_tutor_mechanism_chain'` even though the prose describes the mechanism in full. Sonnet 4.6 scores the same evidence at 75 and reaches `peripeteia_induced`.
- **Critic panel skew**: Qwen and DeepSeek are the systematic low-bar critics for tutor mechanism scoring. They also produce the `control_leak` votes on Opus's intrinsic soft-reframe register in routine/none arms (where Sonnet and Gemini correctly mark controls flat).

**CUT sweep (2026-05-28, done)**: `scripts/analyze-recognition-origin-cut-sweep.js` re-applies the classifier at CUT ∈ {50, 55, 60, 65, 70, 75} over the existing 528T022408Z score JSONs and rebuilds per-item gate verdicts; report at `exports/recognition-origin-cut-sweep.md`. Three findings collapse the original two-option choice:

1. **CUT=50 is the only useful value**. Iteration 1 lifts from 0/2 peripeteia passes to 2/2; iteration 3's T18 item rescues to a clean PASS (4/4 recognition, 3/4 action, 3/4 peripeteia_induced). CUTs 55/60/65/70 are byte-identical to CUT=75 across all 9 items in all three iterations — the raw 1–5 critic scores are bimodal between Sonnet's 4 (→75) and Qwen/DeepSeek's 3 (→50), so any CUT in [55, 75] is operationally the same.
2. **At CUT=50 two new bottlenecks become load-bearing**, both from the same two critics: `action_gap` (4/9 items where Qwen and DeepSeek score `actionalBreakthrough` at 50 against a 75 vote threshold) and `control_leak` on Opus's intrinsic soft-reframe register (4 control items where 2–3 critics return `formClass=recognition`).
3. **`control_leak` is CUT-invariant** (formClass-driven, not classifier-driven). All three failure classes — `organic_or_ambiguous_recognition`, `action_gap`, `control_leak` — trace to the same two systematically-lower-threshold critics.

**Refined recommendation**: critic-panel recalibration (drop or rebalance Qwen and DeepSeek) is more load-bearing than CUT alone. CUT=50 unlocks iteration 1 but still leaves the gate failing on action and control thresholds whose root cause is the same panel skew. Option (1) is a partial measure; option (2) is the architecturally cleaner move. Either way, no paid API calls needed until the next gated-arc rerun.

**Panel-composition sweep (2026-05-28, done)**: `scripts/analyze-recognition-origin-panel-recompose.js` re-applies the gate under five critic-subset panels; report at `exports/recognition-origin-panel-recompose.md`. The Sonnet+Gemini 2-of-2 high-bar panel also fails 0/3 (Gemini is conservative on `peripeteia_induced`). Three other configurations satisfy the 2-of-3 termination rule: (i) drop DeepSeek + CUT=50; (ii) Sonnet-alone at CUT=75; (iii) Sonnet-alone at CUT=50. DeepSeek's noise contribution is larger than Qwen's. The architectural claim survives multiple recalibrations; the pre-registered gate does not. No further analytical work without a rerun. Documented in §7.9 (v3.0.110).

**Status: ANALYTICAL WORK COMPLETE.** Future gated-arc reruns (if any) should use a pre-registered panel decided in advance of generation; the cleanest single-judge configuration is Sonnet-alone at CUT=75, but multi-judge robustness is the standard rationale for keeping a panel and the trade-off is real.

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

### C7. Paper-1.0 Audit Infrastructure Residue (PARTIAL — 2026-05-13)
`npm run paper:bug-audit` (`scripts/validate-bug-claims.js`) and `scripts/generate-paper-tables.js`
validate the frozen Paper 1.0 (`docs/research/paper-full.md` v2.3.21 + `config/paper-manifest.json`
v1.8.0). Neither touches Paper 2.0 (`paper-full-2.0.md`); Paper 2.0's gate (`validate-paper-manifest.js`)
is green. Two unambiguous tooling bugs fixed in `4724297` (tables-script epoch default; n-backtrack
cross-run sums; 67 → 10 / 3 → 1 internal fails). Remaining items are Paper-1.0 prose/data
reconciliation in a superseded paper; kept here as optional cleanup, prioritised cheap-first.

- [x] **C7.1 — `notes/major-bugs.md` Bug-4 over-claim (CHEAPEST).** DONE 2026-05-13 (private-repo
  commit `97939426`). Rewrote Bug-4's Impact paragraph: code-fix-in-place going forward; ~64 of
  ~1,898 in-scope rows rescored as validation sample (~3 %); ~1,834 not planned for backfill due
  to v2.2 cross-contamination risk on pre-2026-02-28 rows; Paper 2.0 supersedes Paper 1.0 on clean
  v2.2 data. Also corrected the column reference (original `holistic_overall_score` was renamed to
  `tutor_last_turn_score` for symmetry with `tutor_first_turn_score`; the old name remains a dead
  read-only alias).

- [x] **C7.2 — `paper:bug-audit` Bug-4 cluster reframe.** DONE 2026-05-13. Demoted
  `multiturn-holistic-coverage` and `multiturn-turn0-risk` from `fail` to advisory `warn` in
  `scripts/validate-bug-claims.js`, with rewritten recommendation text pointing at disclosure
  rather than backfill. Dropped both from `bug-reports-major`'s Bug 4 coverage map (kept
  `multiturn-selection-source` + `paper-disclosure-bug4`). Net audit: 5 fails → 2 fails;
  `bug-reports-major` now passes; the two `warn`s remain so the underlying row counts stay visible
  for anyone querying historical state without gating bug resolution. Remaining 2 failures are
  C7.3 territory (§5.6 N=655 cross-reference) and its umbrella `paper-claims-suite`.

- [x] **C7.3 — §5.6 N=655 forward cross-reference.** DONE 2026-05-13. Diagnosis: `figures.figure4`
  in `paper-manifest.json` already encodes 655's composition (179 Kimi cells 1/3/5/7 + 119
  Nemotron + 120 DeepSeek + 117 GLM + 120 Haiku = 655 ✓), but `evaluateNClaimsBacktracking` only
  consulted `key_evaluations`. Fix: added `findCrossReferencedFigureNs` helper that scans the
  claim's local context for `Section X.Y` / `§X.Y` mentions and surfaces matching `figures.*`
  totals as additional target counts; wired into both the `nearbyRunIds` branch and the
  fall-through branch. `paper-claims-n-backtrack` went `fail` → `warn` (1 internal fail → 0,
  pass count 81 → 88). The line-511 claim plus the three fall-through 655 cases (lines 10, 46,
  495) all now resolve via `manifest_figure_figure4_total_n`. Audit overall: 0 fails.

- [x] **C7.4 — `paper-full.md` prose-vs-manifest drift (LARGEST).** Done in the lighter
  direction (update validator + manifest to match what the frozen paper actually says, since
  Paper 1.0 has shipped). Three categories addressed: (1) `nPattern` regex tightened from
  `(?:primary\s+)?scored` to mandatory `\s+primary\s+scored`, so §6.12.1's legitimately
  out-of-scope `N=8,725 scored responses` no longer trips the validator; (2) manifest's seven
  stale `prose_n_references` updated from `N=4,144` → `N=4,312` with corrected line refs;
  (3) `numToWord` expanded to cover 51–60 (so `numToWord(52)` returns `'fifty-two'` not `'52'`),
  and the count regex loosened to `${countWord}\\s+(?:key\\s+)?evaluations` to match both
  "fifty-two evaluations" and "fifty-two key evaluations" phrasings used in the paper.
  `generate-paper-tables.js` now: 10 issues → 0. `paper:bug-audit` still 0 fails.

None of C7.* affects Paper 2.0 or any active research workstream. Skipping the section entirely is
a defensible choice: leave the bug-audit failing as the truthful record of Paper 1.0's disclosed
limitations, and Paper 2.0 carries the field forward.

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
- ~~**Bridge 1 — Two-pass reflection-as-input**~~ — **CLOSED 2026-04-26, verdict STRUCTURAL.** Cell 98 (`cell_98_base_dialectical_suspicious_unified_two_pass`) clones cell 40 with a `two_pass_reflection: true` flag. A separate Phase-1 ego call produces a plain-text reflection (`prompts/tutor-ego-reflectonly.md`) which is prepended to the next turn's user-message context — reflection fed back as content the model reads rather than instructed via system prompt. Run `eval-2026-04-26-a1e75b9a`, full 9 multi-turn philosophy scenarios × 3 runs (with mid-run resume after Insufficient-credits stall), $N = 52$ dialogues / 302 reflection-action pairs. Coupling cosine: cell 40 = **0.616**, cell 98 = **0.609**, $\Delta = -0.007$. Per-cell-mean Cohen's $d \approx -0.05$ — well below all pre-registered thresholds. EoQ% lifts only +2 pp (14% → 16%, vs A7 recog-01's recognition-driven +30 pp), confirming Bridge 1 doesn't shift the pragmatic-act channel either. The architectural fix is no more effective than cell 97's prompt-rider directive at bridging the gap. Full report: `exports/insight-action-gap-eval-2026-04-26-a1e75b9a.md`. Eval-repo commit `ac64f24`.
- ~~**Bridge 2 — Coupling-targeted superego**~~ — **CLOSED 2026-04-26, verdict STRUCTURAL.** Cell 99 (`cell_99_base_dialectical_coupling_unified_superego`) cloned cell 40 with the superego prompt swapped to `tutor-superego-coupling.md` (coupling auditor retargeting the Mechanism-2 critique loop specifically at reflection-action coupling). Run `eval-2026-04-26-02e662b4`, full 9 multi-turn philosophy scenarios × 3 runs (with mid-run resume after Insufficient-credits stall), $N = 51$ dialogues / 301 reflection-action pairs. Coupling cosine: cell 40 = **0.623**, cell 99 = **0.615**, $\Delta = -0.008$. Per-cell-mean Cohen's $d \approx -0.07$ — well below all pre-registered thresholds. EoQ% lifts +4 pp (17% → 21%, slightly more than Bridges 0/1's +0 to +2 pp but still well below recognition's +33 pp), suggesting the coupling-targeted critique nudges the ego toward question-ending revisions without tightening the underlying semantic relationship. **Goodhart-flavoured pattern**: pragmatic-act surface markers shift modestly while semantic coupling stays flat. Full report: `exports/insight-action-gap-eval-2026-04-26-02e662b4.md`. Eval-repo commits `075219a` (cell), `ab033db` (Bridge-1-closure docs).
- ~~**Bridge 3 — Best-of-N selector**~~ — **CLOSED 2026-04-29, verdict SUGGESTIVE (NOT BRIDGEABLE).** Cell 100 (`cell_100_base_dialectical_suspicious_unified_best_of_n`) clones cell 40 with `best_of_n: 3` — runner generates K=3 dialectical-loop candidates per turn and selects the candidate with highest reflection-action coupling (bag-of-words cosine, mirroring the analyzer's verdict criterion). Run `eval-2026-04-27-327d8816`, full 9 multi-turn philosophy scenarios × 3 runs × 2 cells = 54 planned (53 successful; one cell_40 epistemic_resistance dialogue errored on a terminated network connection mid-loop), $N = 53$ dialogues / 313 reflection-action pairs. Per-dialogue mean coupling: cell 40 = **0.614**, cell 100 = **0.635**, $\Delta = +0.021$. Per-cell Cohen's $d$ = **+0.41** — above the pre-registered $d \geq 0.3$ "suggestive" threshold but below the $d \geq 0.5$ "bridgeable" threshold. EoQ% identical (16% / 16%, $\Delta = 0$ pp), confirming the orthogonal pragmatic-act channel is unaffected by best-of-N search. **Best-of-N is the only bridge with detectable directional movement** — it's the only one of four that even *partially* engages the semantic-coupling channel. But matching selection criterion to verdict criterion (eliminating Goodhart's escape) still produces only $d = 0.41$ — not enough to count as bridgeable. The gap is partially mitigable by brute-force generation-space search, but at high cost (~6× ego budget) and still insufficient. Full report: `exports/insight-action-gap-eval-2026-04-27-327d8816.md`. Eval-repo commit `956b9cb` (cell + runner orchestration).
- **H-capacity hypothesis LOCKED 2026-04-29 with four-bridge synthesis**. Lightweight interventions (Bridges 0–2) all null at $|d| < 0.30$; expensive search-based intervention (Bridge 3) suggestive at $d = +0.41$, below "bridgeable" but above "suggestive" threshold. Final synthesis table (per-dialogue Cohen's $d$, properly computed):

| Bridge | Cell | $\Delta$ coupling | EoQ% Δ | $d$ | Verdict |
|---|---|---|---|---|---|
| 0 (prompt directive) | 97 | +0.003 | +0 pp | +0.07 | structural |
| 1 (two-pass reflection-as-input) | 98 | −0.009 | +2 pp | −0.21 | structural |
| 2 (coupling-targeted superego) | 99 | −0.010 | +4 pp | −0.22 | structural |
| 3 (best-of-N selector, K=3) | 100 | +0.021 | +0 pp | +0.41 | suggestive |

  *(Note: $d$ values for Bridges 1 and 2 in earlier TODO entries (cited as −0.05 / −0.07) were rough hand-estimates; the table above uses per-dialogue mean coupling distributions, which is the standard reproducible computation. All three lightweight-intervention bridges remain below the "suggestive" threshold under either method.)*

  The pattern is interesting: only the most expensive intervention shows directional movement. Bridges 0–2 are roughly noise-level; Bridge 3, which matches the verdict criterion in its candidate-selection step, lifts coupling by ~3% and crosses the suggestive threshold without bridging. Read as **partial supportable for H-capacity**: lightweight prompt + architectural fixes don't engage the semantic-coupling channel at all; brute-force search through generation space does engage it, but only weakly. The fix exists in principle (search over more candidates) but is expensive enough and limited enough that it does not constitute a practical bridge. Finding 11 reframes from "structural property" to "**lightweight-intervention-resistant; partially mitigable only by expensive search**".
- **Bridges 4-5** (now optional, future work): reflector/actor split, outcome-conditioned generation. Both test heavier hypotheses (genuinely separated cognitive pipelines, RL-style outcome conditioning) that go beyond "lightweight intervention". Bridge 3's $d = 0.41$ at K=3 suggests a Bridge 3b sweep (K=5, K=10, K=20) might yield a stronger search-based bridge — log-linear scaling in K would predict $d \approx 0.5$ at K=5 and $d \approx 0.7$ at K=10. Full design: `notes/design-d3-architectural-bridges.md`.
- Paper ref: Finding 11. **§6.3.9 update authored 2026-04-26** with three-bridge synthesis; **§6.3.9 update authored 2026-04-29 (v3.0.60)** to incorporate Bridge 3 suggestive-but-not-bridgeable closure and the four-bridge cost-vs-effect curve. Architectural-bridges design note (`notes/design-d3-architectural-bridges.md`) is the §6.3.9 supporting narrative; the H-capacity reading reframes Finding 11 from "tunable design parameter" to "lightweight-intervention-resistant property partially mitigable only by expensive search".

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

## G. Paper Claim Integrity / Provenance (from 2026-06-06 claim-verification audit)

Surfaced by the adversarial claim-verifier re-run against the canonical Paper 2.0 (Workflow `wf_3f184740-b00`, 198 major unresolved/untraceable/fail claims, 137 supported / 45 unsupported / 16 low-confidence). Zero fabrications found; the items below are the genuine short-list — provenance, specificity, and one naming slip. Full per-claim evidence + triage: `exports/claim-verify-findings.md` (Run 2 section). These touch paper claims, so each resolution needs a `paper-full-2.0.md` version bump + revision-history entry.

**Status after investigation (2026-06-06): ALL FIVE RESOLVED.** G3 closed (verifier false-positive). G5 closed (one wrong p-value; fix applied v3.0.124; reproduction script committed). G2 closed (reproducible once column/judge/run stated; provenance added v3.0.124). **G1 closed** — both correlations traced AND reproduced by a committed script (`analyze-rubric-pca.js`); the §5.2.1 PCA numbers are the 8-dim v2.2 figures that had been mislabeled "14-dim", and `r=0.907` is a v2.1 N=32 snapshot; **paper edit (fix variant (a)) applied v3.0.125**. **G4 closed** — §6.2.3/§6.2.5 reproduce *exactly* from the committed `analyze-superego-taxonomy.js` (§9–10) on the 500-record/56-dialogue corpus; the apparent gap was a wrong-corpus + wrong-script mix-up; source corpus (previously untracked) archived to the private repo, reproduction committed (`exports/superego-transition-reproduction.md`). None was a demonstrated *error*. **Net across all five:** no fabricated or contradicted claims; exactly one wrong figure (G5's p-value) + two G1 mis-attributions (all traced to reproducible sources); the rest was reproducibility-provenance, now repaired. **The optional §6.2.3 data-provenance pointer is now applied (v3.0.126, no number change) — G-arc fully closed.**

### ~~G1. §5.2.1 rubric-redesign correlations~~ (RESOLVED 2026-06-06 — both numbers traced + reproduced; paper edit (a) applied v3.0.125)
The §5.2.1 paragraph cites two correlations. The prior framing ("the v1.0 N=1,584 matrix is gone, numbers unreproducible") was **wrong**. Both values are real, traceable, and now reproduced by a committed script — but each is mis-attributed in the paper text.

1. **PCA figures (L476).** The printed N=1,584 / PC1=80.7% / KMO=0.938 / mean inter-dim r=0.776 / range 0.589–0.921 / single Kaiser eigenvalue are the **8-dimension v2.2** PCA — they reproduce **to the printed precision** from the *current* DB (runs `aea2abfb`+`45163390`, judge `claude-code/sonnet`; base 80.1%/recog 75.5%; DeepSeek 77.2%/Haiku 67.9%; content_accuracy isolates on Factor 2 at 0.916, the 7 pedagogical dims 0.69–0.85 on Factor 1). They are exactly the §8.6 numbers. §5.2.1's label **"across the 14 dimensions" is the error** — identical PCA stats cannot describe both an 8- and 14-variable analysis. The genuine v1.0 **14-dim** PCA (pre-v2.2 backup, opus-4.6 judge, N=4,844) is PC1=68.9%, KMO=0.944, mean r=0.651, range 0.259–0.903, **2** factors — different from the printed numbers but it *does* corroborate the redundancy claim (14 dims → ~2 factors).
2. **`r=0.907` per-turn↔holistic (L484).** Traced to `notes/paper-2-0/rubric/ideal-measures.md` ("Tutor per-turn → holistic | +0.907 | 32") — a **v2.1, N=32** snapshot (`rubric-v2.2-scoring-semantics.md` confirms "v2.1 holistic had r=0.907"). Reproduces nowhere on current data (v2.2 0.872@288; v1.0 0.826@536) because it's a tiny superseded slice; the *direction* (~0.83–0.91 across all versions) is robust, so the 6→3 simplification rationale stands.

**Reproduction committed:** `scripts/analyze-rubric-pca.js` (default = 8-dim from live DB; `--db <backup> --score-source scores_with_reasoning --judge claude-opus-4.6 --runs ""` = 14-dim v1.0). Reports `exports/rubric-pca-{8,14}dim.md`.

**Paper edit (pending sign-off) — recommended (synthesis, both numbers reproducible):** in §5.2.1 finding 2 (L476), fix "across the 14 dimensions" by citing the genuine v1.0 14-dim redundancy as the *motivation* (PC1≈69%, KMO 0.944, mean r 0.651, ~2 factors, N=4,844) **and** noting the redundancy persists in the consolidated 8-dim rubric (PC1=80.7%, mean r 0.776, N=1,584; §8.6). For L484, keep `r=0.907` but state it was the v2.1 (N=32) redesign analysis, or report the robust current figure (≈0.87, N=288) alongside. *Minimal alternative:* leave the numbers, just relabel L476 "14"→"8 consolidated (§8.6)" and add an N to the 0.907. Both change published-claim framing → sign-off.
- Paper ref: §5.2.1 (L476, L484), cross-ref §8.6; related D5 (PCA-informed consolidation).

### G2. §6.4 recognition effect sizes — reproducible once the column/judge/run are stated (DIAGNOSED 2026-06-06 — paper edit pending sign-off)
The verifier's lower values came from pooling all runs and using the wrong score column. The §6.4 table (lines ~1737–1752) is **run-bound**, **Sonnet-judged**, and computed on **`tutor_overall_score`** (the per-turn aggregate) — NOT the canonical `tutor_first_turn_score` (that was the ~7-point offset). With the right column + judge + run:
- **Gemini Flash 3.0** (run `eval-2026-03-02-18027efc`): d=**1.87**, N=144 — **exact** match (the paper already cites this run).
- **DeepSeek** (run `eval-2026-03-01-aea2abfb`): base **26.4**±12.7, recog **50.0**±12.7, d=**1.85**, N=144 — base/recog means exact (paper 26.4/50.1); d 1.85 vs paper 1.88.
- **Haiku** (run `eval-2026-03-02-45163390`): base 61.3, recog 80.4, d=1.92 (paper 60.7/79.8, d=1.84); N=144 vs paper N=163.
The substantive claim (very large recognition effect, d ≈ 1.85–1.92 on the tutor aggregate under Sonnet) is **sound and reproducible**. N's drifted a few rows from the paper-writing snapshot (DeepSeek 142–144 vs 146; Haiku 144 vs 163).
- **Paper edit (pending sign-off):** in §6.4 state column = `tutor_overall_score`, judge = Sonnet 4.6, and cite the DeepSeek/Haiku run_ids (matching how the Gemini row already cites `18027efc`); optionally refresh DeepSeek d 1.88→1.85 and reconcile the N's. Note: §6.6.2's cross-judge ranges (DeepSeek 1.34–1.57 on Gemini/GPT) are a separate, already-judge-labelled table — no change needed there.
- Optional follow-up: a committed `analyze-messages-recognition-d.js` (mirroring the G5 script) would make the table fully reproducible rather than via ad-hoc query.
- Paper ref: §6.4 (lines ~1737–1752); abstract line 36 already states "Sonnet-judge d ≈ 1.88".

### ~~G3. §6.9.5–.6 names a scenario absent from the canonical run~~ (RESOLVED 2026-06-06 — verifier false-positive, paper correct)
The N=3 adaptive smoke is described as using `sophistication_upgrade_v1`; the verifier flagged that the production-DB `cell_126` run (`eval-2026-05-16-65dc376a`) used `polite_false_mastery_v1` instead. **Resolved: the paper is correct.** The smoke (`scripts/run-adaptive-cell-real-smoke.js`) writes to a temp DB (`mkdtempSync`) so its output never reaches the production DB; its committed `DEFAULT_FILTER` (line 41) is exactly `false_confusion_v1,resistance_to_insight_v1,sophistication_upgrade_v1` — matching the paper. The production run `65dc376a` is a *different* persisted invocation that happened to use `polite_false_mastery_v1`; it is not the smoke the paper describes. Scenario naming matches the committed tooling — no paper change. (Residual: the smoke's hypothesis counts (128/128, 53, 26) are temp-DB and not independently DB-verifiable, but the flagged item — scenario naming — is correct.)
- Paper ref: §6.9.2, §6.9.5 (lines ~2303, 2312, 2322).

### ~~G4. §6.2.3 Round1→Round2 transition table doesn't reproduce~~ (RESOLVED 2026-06-06 — reproduces exactly; the "gap" was a wrong-corpus/wrong-script mix-up + an untracked source file)
The prior "CONFIRMED GAP" was an **investigation error**, not a paper error. Two corrections:
- **Source script (committed).** §6.2.3 + §6.2.5 are produced by `scripts/analyze-superego-taxonomy.js` §9 ("Transition Analysis (Round 1 → Round 2)") + §10 ("Revision Analysis") — *not* `analyze-superego-transitions.js` (which is an unrelated turn-N→N+1 matrix).
- **Source corpus (was untracked).** The real input is a **500-record / 56-dialogue** classified corpus (profiles `budget`+`recognition`; Gemini 199 / DeepSeek 153 / Haiku 148; sha256 `f9ba2d92…`) that lived untracked at `machinespirits-eval/data/superego-critiques-classified.jsonl`. The dramatic fork's identically-named default file is a *different* run (300 rec / 195 dialogues; only 15-dialogue overlap), so a from-the-fork run analyzes the wrong data → 53 pairs / 195 dialogues. Now archived (byte-identical) to `machinespirits-eval-private/data/superego-critiques-classified-paper-6.2-n500.jsonl`.

Run `node scripts/analyze-superego-taxonomy.js --input <the 500-record corpus>` and **every figure reproduces**: §6.2.3 232 pairs / 56 dialogues, base (N=57) 35/4/16/2, recog (N=175) 13/63/33/66, all category resolution % (PEDAGOGICAL_MISJUDGMENT 83.3%, VAGUENESS 83.3%, CONTEXT_BLINDNESS 66.7%, RECOGNITION_FAILURE 52.9%, REDIRECTION 42.9%); §6.2.5 N=216, Jaccards 0.132/0.157/0.192/0.613, base 78.0% / recog 57.3%. No empirical claim changes.
- **Caveat (documented, reproducible):** `turnIndex` is null on every record, so §9's pairing always uses the dialogue's first round-2 verdict — the contingency is "each round-1 verdict vs the dialogue's first round-2 verdict," not strictly same-turn.
- **Done (v3.0.126):** §6.2.3 data-provenance pointer applied — inline sentence naming the script + archived corpus + pairing semantics (no number change). Reproduction report: `exports/superego-transition-reproduction.md`.
- Paper ref: §6.2.3, §6.2.5 (lines ~1226, 1269).

### G5. § H2 per-session slope p=0.032 is a wrong p-value (DIAGNOSED 2026-06-06 — fix in hand, paper edit pending sign-off)
**Root cause of the verifier flag: it used the wrong unit (40+40 sessions instead of per-arc slopes).** Reproduced the correct per-ARC test in a new committed script `scripts/analyze-a7-h2-slope.js` (report: `exports/a7-phase2-h2-slope-1777173286.md`). Every structural quantity reproduces **exactly**: recog mean slope **+1.31**, base **−1.08**, Welch **t=1.99**, **df=7.88**, 9-point gap (9.09), Cohen's **d=0.70** (per-session, n=40+40), and the in-sequence sensitivity (base n=4 **−1.10**, recog n=3 **+0.72** — exclusions: base-02 resumed s5, recog-01/05 resumed s7). **Only the p-value is wrong:** for t=1.99/df=7.88 the correct one-sided p is **0.041** and two-sided **0.083** (confirmed against scipy AND the in-repo `regularizedBeta`); the paper's **0.032 matches neither**. The directional "supported" verdict survives the one-sided pre-registration (0.041 < 0.05) but is weaker than 0.032 implied; two-sided is non-significant.
- **Paper edit (pending sign-off):** change `p = 0.032` → `p = 0.041 (one-sided; two-sided 0.083)` at line ~2012, and update the cited reproduction path from the stub `analyze-a7-longitudinal.js` to `analyze-a7-h2-slope.js`. Version bump + revision-history entry.
- Side change (already made): exported `lnGamma`/`regularizedBeta` from `services/anovaStats.js` (additive; all 21 anova tests pass) so the Welch p-value reuses the same beta numerics as the ANOVA F-test.
- Paper ref: §6.6.11 H2 (line ~2012).

---

## Status Legend

- **CRITICAL** — Blocks publication-quality claims
- **HIGH** — Would significantly strengthen findings
- **MEDIUM** — Valuable improvement, not blocking
- **LOW** — Nice-to-have, opportunistic
