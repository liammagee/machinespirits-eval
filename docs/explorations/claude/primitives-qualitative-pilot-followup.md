# Post-pilot follow-up plan

**Date drafted:** 2026-05-06
**Parent doc:** `docs/explorations/claude/primitives-qualitative-pilot-design.md`
**Status:** Plan locked, ready to resume in a fresh Claude session.

---

## Context (where we left off 2026-05-06)

The 4-cell qualitative pilot is functionally complete: 20/20 base dialogues persisted across cells 106 / 110 / 111 / 115 × 5 trap scenarios on Sonnet 4.6 via the local claude-code CLI bridge (Max-plan subscription, not metered API).

| Cell | Architecture | runId | Persisted |
|---|---|---|---|
| `cell_106_id_director_pedagogy_tuned` | Weberian id-director | `eval-2026-05-06-513eca3f` | 5/5 |
| `cell_110_langgraph_adaptive` | LangGraph state-policy | `eval-2026-05-06-2534919d` | 5/5 |
| `cell_111_a13_C1_recognition_only` | Single-call recognition | `eval-2026-05-06-ba51bb44` | 5/5 |
| `cell_115_bilateral_tom` (base) | LangGraph + bilateral ToM | `eval-2026-05-06-3abcca4f` | 4/5 |
| `cell_115_bilateral_tom` (retry) | repair scenario recovery | `eval-2026-05-06-ca4f4b27` | 1/1 |

The five trap scenarios used (per `config/adaptive-trap-scenarios.yaml`):
- `resistance_to_insight_v1`
- `polite_false_mastery_v1`
- `answer_seeking_to_productive_struggle_v1`
- `repair_after_misrecognition_v1`
- `affective_shutdown_v1`

---

## Key findings to carry forward

1. **A13 Gate B (2026-05-05) hard numbers** (`docs/explorations/claude/a13-gate-b-results.md`): LangGraph (cell_110) beats the paper architecture (cell_112) by **+17.4pp** on `strategy_shift_correctness`, but only beats the single-call recognition baseline (cell_111) by **+10.3pp** — well below the predeclared 25pp threshold. Validator (cell_113) regressed −6.1pp at +47% cost; deprecated. Per-scenario: LangGraph wins concentrate on `repair_after_misrecognition` and `answer_seeking_to_productive_struggle` (the cross-turn-state-dependent ones).

2. ~~**Schema gap on cell_115**~~ **MISDIAGNOSED — retracted 2026-05-06.** This finding was a wrong-field-path error. `tutorInternal.hypothesizedLearnerState` does not exist in the state schema. The bilateral-ToM apparatus persists three fields on `learnerProfile`: `summaryText`, `hypothesizedLearnerPerceptionOfTutor` (sub-fields `jsonState` + `summaryText`), and `tomProbes` (sub-fields `belief_dist`, `belief_choice`, `answerability_list`, `infoaccess_list`). Direct audit of all 5 May 6 cell_115 traces confirms these fields are populated with substantial content per turn. Q4 in the findings doc passes cleanly. P2 work on cell_115 is not gated by any instrumentation closure. See `primitives-qualitative-pilot-findings.md` §0 caveat retracted, §2.1 Q4, and §4.2 for the revised reading.

3. **The "troubled student" framing** (user, this session): LangGraph's wins are precisely on scenarios that require holding the line across multiple provocations. The current 5 pilot scenarios under-sample this regime; most cap at 4 turns and the "trap" can be caught on a single move. Designing 8–12-turn troubled-student scenarios is the natural target for the next experimental cycle.

4. **Cell_115 dialogue qualitative observation** (single dialogue, `eval-2026-05-06-ca4f4b27` × `repair_after_misrecognition_v1`): tutor catches the learner walking back what they granted at T0 (T1), distinguishes empirical-vs-ontological readings of "constitutive entanglement" (T2), names question-type disagreement explicitly (T3). All `policyAction = name_the_disagreement` for T1–T4 — a single-action lock that on cell_110 would read as stagnation, but here the *content* of "the disagreement" escalates across turns. The current strategy-shift analyzer doesn't capture refinement-within-action.

5. **A13 pre-reg deviation** (`docs/explorations/claude/a13-pre-registration.md` 2026-05-05 entry): Gate B 3rd attempt actually used `openrouter/nemotron`, not predeclared `claude-sonnet-4.6`, and only ran cells 110+111 (not 112+113). The 110+111 contrast is descriptive, not H1-confirmatory.

---

## Task ordering (locked)

```
1. Three-pass diagnostic read of 20 pilot dialogues   (~half day)               [DONE 2026-05-06]
2. Schema gap probe on cell_115                        (~1 hour)                 [VOIDED — non-bug]
   ↓ (informs what to tune for)
3. Design 2-3 troubled-student scenarios               (~half day)
4. NEW: prompt-lab adaptive adapter                    (~50-100 LOC, half day)
5. NEW: prompt-tuning loop on cell_110/115             (~5-8 candidate iterations,
                                                         bounded wallclock)
6. Lock winning prompts; focused N=8 replication       (~2-3 hours wallclock parallel)
7. Cross-dialogue synthesis writeup
```

Steps 4–5 are new this session. The rest is unchanged from the strategic exchange. Tasks #42 (adapter) and #43 (loop) registered. Step #2 voided 2026-05-06: the schema gap was a misdiagnosis (see Key findings #2 retraction above and findings doc §0).

---

## Step #1 — Three-pass diagnostic read

**Source rubric:** `docs/explorations/claude/primitives-qualitative-pilot-design.md` §7 — three passes:

- **Pass 1** (§7, lines 154–166): open narrative, phenomenological-primary read of each dialogue
- **Pass 2** (§7, lines 167–192): apparatus questions per primitive (Hegelian / Freudian / Weberian)
- **Pass 3** (§7, lines 193–223): failure-mode tagging using the hybrid taxonomy

**Inputs (the 20 base dialogues + 1 retry):**

```sql
-- Pull all suggestions text per cell × scenario
SELECT run_id, profile_name, scenario_id, dialogue_id, suggestions, id_construction_trace
FROM evaluation_results
WHERE run_id IN (
  'eval-2026-05-06-513eca3f',  -- cell_106 (5/5)
  'eval-2026-05-06-2534919d',  -- cell_110 (5/5)
  'eval-2026-05-06-ba51bb44',  -- cell_111 (5/5)
  'eval-2026-05-06-3abcca4f',  -- cell_115 base (4/5)
  'eval-2026-05-06-ca4f4b27'   -- cell_115 retry (repair scenario)
);
```

For the adaptive cells (110, 111, 115), additional state lives in `logs/tutor-dialogues/<dialogue_id>.json` (per-turn `learnerProfile`, `tutorInternal`, `policyAction`, `counterfactual` branch). For cell_106, the per-turn id-construction envelope is in the `id_construction_trace` column directly.

**Output:** a new section in `primitives-qualitative-pilot-design.md` titled `## Diagnostic read findings (2026-05-06)`, OR a new sibling file `docs/explorations/claude/primitives-qualitative-pilot-findings.md` if it gets long.

**Specific framing the user added:** filter explicitly by which dialogues show troubled-student patterns (multi-turn provocations, oracle-seeking with topical drift, iterated misrecognition, affective shutdown spiral) vs. routine. Synthesis question: where does cell_110 / cell_115 differentially help over cell_111?

---

## Step #2 — Schema gap probe on cell_115 (VOIDED)

**Status (2026-05-06):** voided. The "schema gap" was a misdiagnosis. The bilateral-ToM apparatus persists fields at `learnerProfile.summaryText`, `learnerProfile.hypothesizedLearnerPerceptionOfTutor`, and `learnerProfile.tomProbes` — not at `tutorInternal.hypothesizedLearnerState` (which doesn't exist in the schema). Direct trace audit during the diagnostic read confirmed all 5 May 6 cell_115 traces have substantial ToM content per turn with scenario-coherent `belief_choice` transitions. P2 work on cell_115 is not gated by any instrumentation closure. See `primitives-qualitative-pilot-findings.md` §2.1 Q4 for the revised verdict (passes cleanly).

**Side-discovery worth filing as a separate B* item:** `scripts/run-adaptive-cell-smoke.js` is hardcoded to `cell_110_langgraph_adaptive` (line 27). The `--profile cell_115_bilateral_tom` flag is silently ignored. This misled the diagnostic read partway through — fix should honor `--profile` so future smoke tests can target other adaptive cells. Low priority; not blocking.

---

## Step #3 — Design 2-3 troubled-student scenarios

**Goal:** scenarios at 8–12 turns that require holding a frame across multiple provocations. Three patterns (from this session):

1. **Persistent oracle-seeking with topical drift** — learner pivots topics (math problem → conceptual question → meta-question about the lesson) while sustaining the underlying "give me the answer" pattern. Tests whether the tutor recognises the *meta-pattern* or just the local move.

2. **Iterated misrecognition repair** — learner corrects the tutor, tutor re-misrecognises, learner corrects again. Tests whether externalised state catches "this is the second/third time the learner has corrected me on the same axis."

3. **Affective spiral** — learner frustration escalates across turns; the right move is to acknowledge and reset, not to keep teaching content. Tests whether the policy chooser actually de-prioritises content moves under shutdown signals.

**Output:** extend `config/adaptive-trap-scenarios.yaml` with 2–3 new entries; each with `failure_mode`, `success_criteria`, and an `expected_strategy_shift` field per the existing schema. Hold 1 scenario out of the prompt-tuning training set as the lock-time evaluation set.

---

## Step #4 — prompt-lab adaptive adapter

**Goal:** teach `scripts/prompt-lab.js` to fork/restore prompts in `services/adaptiveTutor/` (currently it's tutor-core-only — line 10 imports from `@machinespirits/tutor-core`, line 74 defaults to `cell_80`).

**Surface to add:**
- Detect `runner: adaptive` profile, route to adaptive prompt forking instead of tutor-core
- Prompt files for adaptive runner live in `services/adaptiveTutor/realLLM.js` (system prompts inline) and `config/adaptive-policy-actions.yaml` (per-action descriptions)
- Either extract inline prompts to `prompts/adaptive/*.md` files (cleaner; matches tutor-core pattern), OR teach prompt-lab to edit string literals in realLLM.js (uglier but no refactor)
- Recommended: extract to `prompts/adaptive/` first (~30 LOC refactor in realLLM.js), then point prompt-lab at the directory

**Acceptance:** `npm run prompt-lab -- init --profile cell_110_langgraph_adaptive --scenario repair_after_misrecognition_v1` creates a session and shows the forked prompt files.

---

## Step #5 — prompt-tuning loop

**Optimization target:** 2 troubled-student scenarios (training) + 1 held-out (lock-time evaluation).

**Optimization surface (cell_110):** ego prompt, superego prompt, policy-chooser prompt, profile-updater prompt, plus `config/adaptive-policy-actions.yaml`.

**Optimization surface (cell_115):** the above + tomTracker prompt (only after step #2 confirms the field is actually wired).

**Methodological commitments:**
- **Baseline symmetry**: tune cell_111's recognition prompt with comparable effort, OR disclose the asymmetry. Default: disclose; the question shifts from "does state machinery beat prompts?" to "how much can state machinery be pushed?"
- **Hold-out**: 1 scenario reserved from the training set; lock-time eval is N=8 dialogues × held-out scenario on the winning config
- **Stop conditions**: 5 iterations max; OR 2 consecutive iterations with no qualitative improvement on read; OR cost ceiling
- **Primary signal**: qualitative differentiation, not strategy_shift % on small N (small-N noise dominates)

**Cost estimate:** 5 iterations × 6 dialogues per round = 30 dialogues per cell across the campaign. + 8 dialogues × 1 held-out = 38 total per cell. Manageable on Sonnet 4.6 via local CLI.

---

## Steps #6–#7 — replication and synthesis

Defer detail until #1–#5 complete; informed by their outputs. Standing intent: lock the winning prompts, run the focused N=8 replication on the troubled-student scenarios with cell_110 / cell_111 / cell_115 in parallel (per the `feedback_parallel_adaptive_pilots` memory), then synthesise.

---

## Standing preferences (user)

- **Cell_115 needs `ADAPTIVE_TUTOR_LLM=real` AND the claude-code provider** (Max-plan subscription). Mock mode is the default and silently falls back to deterministic fixtures. Always set the env var explicitly.
- **Multi-cell adaptive runs**: fan out one bash command per cell in parallel (memory: `feedback_parallel_adaptive_pilots.md`). `eval-cli run --profiles a,b,c` is serial and wastes wallclock — for cell_115's ~15 min/scenario, the difference is hours.
- **No metered-API estimates** needed for Sonnet 4.6 runs (Max plan covers it).
- **Avoid epistemic-virtue filler** ("honest", "honestly") in user-facing prose.
- **Don't conflate the boards**: `TODO.md` (root) is long-horizon; `notes/paper-2-0/BOARD.md` is Paper 2.0-specific; this followup is project-side, lives in `docs/explorations/claude/`.

---

## Resume command (paste into fresh Claude session)

```
Read docs/explorations/claude/primitives-qualitative-pilot-followup.md to load context, then start step #1: three-pass diagnostic read of the 20 pilot dialogues per primitives-qualitative-pilot-design.md §7. Begin by pulling dialogue text and per-turn traces for the 5 runIds, then walk through Pass 1 (open narrative) on each dialogue before moving to Pass 2 (apparatus questions per primitive). Output should append to primitives-qualitative-pilot-design.md as a new "Diagnostic read findings" section, OR start a sibling file primitives-qualitative-pilot-findings.md if it grows long.
```
