# Major Bugs: Discovery, Impact, and Resolution

Four critical bugs were discovered during the evaluation campaign (Jan 30 – Feb 23, 2026). Each produced systematic scoring distortions that were initially interpreted as empirical findings. The general lesson: **when your experimental apparatus is also your codebase, every bug is a potential false finding.**

---

## Bug 1: Judge Version Drift (Feb 16–17)

**Discovery**: A×C interaction (architecture × recognition) was significant at F=21.85, p<.001, suggesting architecture moderates recognition effects.

**Root cause**: Early runs (Jan 30 – Feb 5) were scored by Opus 4.5; later runs by Opus 4.6 (released Feb 5). The judge model version shifted mid-campaign, introducing systematic bias across cells that happened to be evaluated at different times.

**Fix**: All early runs rejudged under Opus 4.6 (v2.3.6 + v2.3.9). `normalizeJudgeLabel()` added to strip routing prefixes for consistent model tracking.

**Impact**: The most consequential fix. A×C interaction vanished entirely (F=0.97, p=.325). Recognition effect size rose from d=0.80 to d=1.11. Finding #2 simplified from "architecture moderates recognition" to pure additivity — the moderation story was entirely a judge-version artefact.

**Residual nuance**: Qualitative analysis (§6.11) still shows architecture moderating recognition *qualitatively* — ego_superego without recognition creates circular self-criticism, with recognition creates generative deliberation. The quantitative null and qualitative interaction are both real; they measure different things (endpoint score vs deliberation trajectory).

---

## Bug 2: Leaky Learner Prompt (Feb 20)

**Discovery**: Dynamic learner (ego_superego architecture) cells scored 42–45, far below single-agent learner cells. Interpreted as "learner superego paradox" (Finding #9, d=1.43 — the largest effect in the study).

**Root cause**: The ego revision step in `learnerTutorInteractionEngine.js` used explicit "SUPEREGO:" labels in the prompt. The learner LLM echoed these in external messages (e.g., "I hear the Superego suggesting..."), contaminating the tutor's input with meta-architectural information that shouldn't have been visible.

**Fix**: Neutral labels ("Perspective A", "Perspective B") + explicit anti-leakage instruction telling the learner not to reference internal deliberation. Implemented in `learnerTutorInteractionEngine.js`.

**Impact**: Clean re-runs scored 69–83 vs pre-fix 42–45. Finding #9 reduced in magnitude but direction held. Combined with Bug 3 below, all dynamic learner runs before Feb 20 had compromised data.

---

## Bug 3: Broken Conversation History (Feb 20)

**Discovery**: Found same day as Bug 2. Dynamic learner multi-turn dialogues appeared realistic on surface inspection.

**Root cause**: `evaluationRunner.js` used `.map()` where `.flatMap()` was needed when constructing the learner's conversation history. Tutor messages were dropped — the learner conducted a monologue, seeing only its own prior messages without the tutor's responses between them.

**Fix**: Extracted `flattenConversationHistory()` helper using `.flatMap()`. Prophylactic tests added to prevent regression.

**Impact**: Compounded with Bug 2. The learner wasn't just leaking architecture labels — it couldn't even see what the tutor was saying. All dynamic learner runs before Feb 20 had a broken feedback loop. The combination of Bug 2 + Bug 3 explains the extreme underperformance (42–45) of ego_superego cells: the learner was talking to itself with leaked internal labels.

---

## Bug 4: Multi-Turn Scoring Misalignment (Feb 23)

**Discovery**: Multi-turn dialogue results scored ~59 on average, suspiciously close to single-turn scores (~57). High-evolution scenarios (mood_frustration_to_breakthrough, misconception_correction_flow) showed no score advantage despite clear learner evolution in transcripts.

**Root cause**: The `suggestions` array in the DB stores one entry per turn: `[Turn0, Turn1, Turn2, Turn3]`. The `evaluate` and `rejudge` code paths both scored `suggestions[0]` (Turn 0's generic initial response) against the full dialogue transcript. The judge saw a learner evolving from confusion to sophisticated questioning across 4 turns but evaluated the bland opening response, scoring it as non-responsive to the learner's evolved state.

**Fix**: Three code paths updated in `evaluationRunner.js` (rejudgeRun) and `scripts/eval-cli.js` (evaluate command + display excerpt) to use the last suggestion for multi-turn dialogues (`result.suggestions[result.suggestions.length - 1]` when `dialogueId` is present). A new column on `evaluation_results` persists the last-turn score (originally `holistic_overall_score`; later renamed to `tutor_last_turn_score` for symmetry with `tutor_first_turn_score` — the old name is retained as a dead read-only alias). `--multiturn-only` flag added to avoid re-scoring unaffected single-turn rows.

**Impact** (code fix in place going forward; historical backfill partial and not planned):

Figures below describe the rescoring sample (~64 rows that were re-judged after the fix as a validation pass), not a complete remediation of the 8,631 affected rows.
- Average lift across rescored rows: **+19.9 pts** (67.0 → 87.1)
- High-evolution scenarios: +28–32 pts (mood_frustration, misconception_correction, mutual_transformation)
- Low-evolution scenarios: +2–5 pts (struggling_learner, new_user_first_visit)
- Strong models (Haiku): last-turn responses score 90+ — both base and recognition converge near ceiling
- Weak models (DeepSeek V3.2, Nano): last-turn responses score **lower** than Turn 0 (-12 to -24 pts), confirming multi-turn degradation. Transcript analysis shows repetition loops, reasoning token explosion, and message quality collapse
- Recognition main effect in multi-turn likely narrows as base condition gains disproportionately

**Backfill status**: 8,631 multi-turn rows across 81 runs were affected; ~64 of 1,898 in-scope rows have a `tutor_last_turn_score` value (~3 %). The remaining ~1,834 were never re-judged and the backfill is **not planned**, for two compounding reasons: (a) every affected run predates the v2.2-rubric cutover (2026-02-28), so re-judging them under the current rubric would cross-contaminate v1.0/v2.0/v2.1 cells with v2.2 scoring — a violation of the anti-contamination rule in `CLAUDE.md`; (b) Paper 1.0 (`docs/research/paper-full.md`, v2.3.21) discloses the gap directly in its limitations, and Paper 2.0 (`docs/research/paper-full-2.0.md`) carries the field forward on clean v2.2-rubric data without depending on the backfill. The code defect is fixed going forward; the historical artefact is documented rather than retconned.

---

## Cumulative Impact

| Bug | False Finding Created | True Finding After Fix |
|-----|----------------------|----------------------|
| Judge drift | Architecture moderates recognition (F=21.85) | Pure additivity (F=0.97, n.s.) |
| Leaky prompt | Learner superego paradox (d=1.43) | Bug artefact; gap narrows dramatically |
| Broken history | (compounded with leaky prompt) | Dynamic learner works when it can see the tutor |
| Multi-turn scoring | Multi-turn ≈ single-turn scores | Strong models improve +20–30 pts; weak models degrade -12–24 pts |

**Pattern**: Three of four bugs (leaky prompt, broken history, multi-turn scoring) were engineering errors first interpreted as empirical findings. The judge drift bug created a false interaction effect that shaped theoretical interpretation for two weeks. Each fix changed the findings, but the core recognition effect (d=1.11 in single-turn, unaffected by any bug) has remained stable throughout.
