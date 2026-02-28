---
name: deep-dive
description: Deep multi-layer analysis of evaluation runs — scores, trajectories, transcripts, and qualitative assessment
argument-hint: "<run-id> [<run-id> ...] [--level quick|standard|full]"
allowed-tools: Bash, Read, Grep, Glob
---

Deep analysis of evaluation run(s) `$ARGUMENTS`.

This skill orchestrates multiple analysis tools in sequence, from cheap DB queries up to API-powered qualitative assessment. The user can specify a depth level to control cost.

## Parse Arguments

- Positional args matching `eval-20*` or 8+ hex chars are **run IDs** (support shorthand — use LIKE suffix)
- Positional args matching a **cell name** (e.g. `cell_82`, `cell_83_messages_base_multi_psycho`) or **model alias** (e.g. `haiku`, `gemini-flash`, `nemotron`) are used to **auto-discover run IDs** (see below)
- `--level quick|standard|full` controls depth (default: `standard`)
- `--condition base|recog` filters to one experimental condition (see below)
- `--profile <name>` filters to specific cell(s) — substring match (see below)
- `--scenario <id>` filters to specific scenario(s) (see below)
- `--epoch <name>` overrides epoch filter (default: `2.0`, which means `tutor_rubric_version = '2.2'`)
- `--all-epochs` disables epoch filtering (searches all data)
- Any other free text is a **question** — use it to focus the analysis narrative

### Auto-Discovery from Cell or Model Name

When the user provides a cell name or model alias instead of a run ID, auto-discover matching runs:

**By cell name** (substring match on `profile_name`):
```sql
SELECT DISTINCT r.id, r.description, r.created_at, COUNT(*) as rows
FROM evaluation_results e
JOIN evaluation_runs r ON e.run_id = r.id
WHERE e.profile_name LIKE '%<cell>%'
  AND e.tutor_rubric_version = '2.2'    -- epoch 2.0 filter (default)
  AND e.tutor_first_turn_score IS NOT NULL
GROUP BY r.id ORDER BY r.created_at DESC
```

**By model alias** (substring match on `ego_model`). Map the alias to the OpenRouter model ID first using `config/providers.yaml`, then query:
```sql
SELECT DISTINCT r.id, r.description, r.created_at, COUNT(*) as rows
FROM evaluation_results e
JOIN evaluation_runs r ON e.run_id = r.id
WHERE e.ego_model LIKE '%<model_id>%'
  AND e.tutor_rubric_version = '2.2'    -- epoch 2.0 filter (default)
  AND e.tutor_first_turn_score IS NOT NULL
GROUP BY r.id ORDER BY r.created_at DESC
```

Common model alias → ID mappings (from `config/providers.yaml`):
| Alias | Matches `ego_model LIKE` |
|-------|-------------------------|
| `haiku` | `%claude-haiku%` |
| `sonnet` | `%claude-sonnet%` |
| `opus` | `%claude-opus%` |
| `nemotron` | `%nemotron%` |
| `gemini-flash` | `%gemini-3-flash%` |
| `gemini-pro` | `%gemini-3-pro%` |
| `gpt` | `%gpt-5.2%` |
| `kimi` | `%kimi%` |
| `deepseek` | `%deepseek%` |

After discovery, list the matching runs with row counts and ask the user to confirm which to analyze (or proceed with all if the set is small and unambiguous).

**Examples**:
```
/deep-dive cell_82                    # find all epoch 2.0 runs containing cell_82
/deep-dive haiku                      # find all epoch 2.0 runs using Haiku ego
/deep-dive gemini-flash --condition recog   # Gemini Flash runs, recog cells only
/deep-dive cell_83 cell_87 --level full     # discover runs for both cells
```

### Filter Reference

**Condition** (`--condition`): The experimental manipulation factor A (recognition theory).
Applied as `profile_name LIKE '%<value>%'`:
- `base` — baseline cells (no recognition theory in prompts)
- `recog` — recognition cells (Hegelian recognition theory in prompts)

**Profile** (`--profile`): The cell name from `config/tutor-agents.yaml`.
Applied as `profile_name LIKE '%<value>%'` (substring match). Examples:
- `cell_82` — matches `cell_82_messages_base_multi_unified`
- `multi_psycho` — matches all ego_superego learner multi-agent cells
- `messages_base` — matches all base messages-mode cells
- Full names like `cell_87_messages_recog_multi_psycho` also work

Cell name anatomy: `cell_{N}_{mode}_{condition}_{tutor}_{learner}[_{variant}]`
- mode: absent (single-prompt) or `messages` (multi-turn)
- condition: `base`, `recog`, `enhanced`, `placebo`, `dialectical_*`, `naive`
- tutor: `single` (no superego) or `multi` (has superego)
- learner: `unified` (single-agent) or `psycho` (ego_superego deliberation)

**Scenario** (`--scenario`): The interaction scenario ID from `config/suggestion-scenarios.yaml`.
Applied as `scenario_id = '<value>'` or `scenario_name LIKE '%<value>%'`.

Multi-turn scenarios (used in Paper 2.0):
| ID | Name | Turns |
|----|------|-------|
| `mood_frustration_to_breakthrough` | Mood: Frustration to Breakthrough | 4 |
| `misconception_correction_flow` | Misconception Correction | 4 |
| `mutual_transformation_journey` | Recognition: Mutual Transformation | 5 |
| `epistemic_resistance_impasse` | Epistemic Resistance Impasse | 5 |
| `affective_shutdown_impasse` | Affective Shutdown Impasse | 5 |
| `productive_deadlock_impasse` | Productive Deadlock Impasse | 5 |

Single-turn scenarios: `479_lecture_3`, `479_assignment_1`, `200_lecture_1`, etc. (see `--cluster core` or `--cluster single-turn` in eval-cli).

### How Filters Apply

In SQL queries, combine filters with AND:
```sql
WHERE run_id LIKE '<runId>%'
  AND profile_name LIKE '%<profile>%'    -- if --profile given
  AND profile_name LIKE '%<condition>%'  -- if --condition given
  AND scenario_id = '<scenario>'         -- if --scenario given
```

For analysis scripts (trajectory, within-test, etc.), filters are applied by piping the run ID and letting the script's own epoch/run filtering handle it. If the user wants to narrow further, mention they can add `--condition` or check the script's own flags.

## Depth Levels

| Level | What it does | Cost |
|-------|-------------|------|
| `quick` | DB scores + comparison tables only | Free |
| `standard` | + trajectory curves + within-test change + browse-transcripts link | Free |
| `full` | + assess-transcripts (AI narrative) + impasse coding | API calls (~$0.50-2/run) |

## Steps

### Layer 1: Score Overview (all levels)

1. **Run metadata and row counts**:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT id, description, total_tests, status FROM evaluation_runs WHERE id LIKE '<runId>%'"
   ```

2. **All metrics by cell** (use ALL score columns):
   ```bash
   sqlite3 -header -separator '|' data/evaluations.db "
   SELECT profile_name,
     ROUND(AVG(tutor_first_turn_score),1) as t1,
     ROUND(AVG(tutor_last_turn_score),1) as tN,
     ROUND(AVG(tutor_development_score),1) as dev,
     ROUND(AVG(tutor_holistic_overall_score),1) as hol,
     ROUND(AVG(tutor_deliberation_score),1) as t_del,
     ROUND(AVG(learner_overall_score),1) as lrn,
     ROUND(AVG(learner_holistic_overall_score),1) as lrn_hol,
     ROUND(AVG(learner_deliberation_score),1) as lrn_del,
     ROUND(AVG(dialogue_quality_score),1) as dq,
     ROUND(AVG(dialogue_quality_internal_score),1) as dq_int,
     COUNT(*) as n
   FROM evaluation_results
   WHERE run_id LIKE '<runId>%' AND tutor_first_turn_score IS NOT NULL
   GROUP BY profile_name ORDER BY profile_name"
   ```

3. **Per-scenario breakdown**:
   ```bash
   sqlite3 -header -separator '|' data/evaluations.db "
   SELECT profile_name, scenario_name,
     tutor_first_turn_score as t1, tutor_last_turn_score as tN,
     tutor_development_score as dev, tutor_holistic_overall_score as hol,
     tutor_deliberation_score as t_del, learner_overall_score as lrn,
     learner_deliberation_score as lrn_del, dialogue_quality_score as dq
   FROM evaluation_results
   WHERE run_id LIKE '<runId>%'
   ORDER BY profile_name, scenario_name"
   ```

4. **Base vs Recog comparison** (if both present):
   ```bash
   sqlite3 -separator '|' data/evaluations.db "
   SELECT
     CASE WHEN profile_name LIKE '%recog%' THEN 'recog' ELSE 'base' END as cond,
     ROUND(AVG(tutor_first_turn_score),1), ROUND(AVG(tutor_last_turn_score),1),
     ROUND(AVG(tutor_development_score),1), ROUND(AVG(tutor_holistic_overall_score),1),
     ROUND(AVG(tutor_deliberation_score),1), ROUND(AVG(learner_overall_score),1),
     ROUND(AVG(learner_holistic_overall_score),1), ROUND(AVG(learner_deliberation_score),1),
     ROUND(AVG(dialogue_quality_score),1), ROUND(AVG(dialogue_quality_internal_score),1)
   FROM evaluation_results WHERE run_id LIKE '<runId>%'
   GROUP BY 1"
   ```

5. **Model and architecture info**:
   ```bash
   sqlite3 -header data/evaluations.db "
   SELECT DISTINCT ego_model, superego_model, learner_architecture, judge_model, tutor_rubric_version
   FROM evaluation_results WHERE run_id LIKE '<runId>%'"
   ```

6. **Flag issues**: mixed judges, NULL scores, missing last-turn scores, low N.

Present results as markdown tables with Insights.

For multiple run IDs: show side-by-side comparison tables with deltas.

### Layer 1.5: Transcript Excerpts (all levels)

Read dialogue logs to show what the tutor and learner actually said. This is free (pure file reads).

**Mapping**: DB `dialogue_id` → `logs/tutor-dialogues/{dialogue_id}.json`. Coverage is ~100%.

7. **Get dialogue IDs** for the target rows:
   ```bash
   sqlite3 -separator '|' data/evaluations.db "
   SELECT dialogue_id, profile_name, scenario_name, tutor_development_score
   FROM evaluation_results
   WHERE run_id LIKE '<runId>%'
     AND dialogue_id IS NOT NULL AND dialogue_id <> ''
   ORDER BY tutor_development_score DESC"
   ```

8. **Read dialogue logs** and extract public-facing messages. For each dialogue log file:
   ```bash
   # Use node one-liner to extract public messages from a dialogue log
   node -e "
   const d = require('./logs/tutor-dialogues/<dialogue_id>.json');
   const trace = d.trace || [];
   const turns = [];
   for (const e of trace) {
     if ((e.agent === 'learner' || e.agent === 'user') && (e.action === 'final_output' || e.action === 'turn_action')) {
       const text = (e.detail || e.contextSummary || '').substring(0, 300);
       if (text) turns.push({ turn: e.turnIndex, role: 'Learner', text });
     }
     if (e.agent === 'ego' && (e.action === 'revise' || e.action === 'generate_final' || e.action === 'generate')) {
       const msg = (e.suggestions || []).map(s => s.message || s.title || '').join(' ').substring(0, 300);
       if (msg) turns.push({ turn: e.turnIndex, role: 'Tutor', text: msg });
     }
   }
   // Deduplicate: keep last entry per (turn, role) — revision overwrites draft
   const seen = new Map();
   for (const t of turns) seen.set(t.turn + '-' + t.role, t);
   const deduped = [...seen.values()].sort((a,b) => a.turn - b.turn);
   // Show first and last tutor turn for quick comparison
   const tutorTurns = deduped.filter(t => t.role === 'Tutor');
   if (tutorTurns.length >= 2) {
     console.log('FIRST TUTOR (T' + tutorTurns[0].turn + '):', tutorTurns[0].text.substring(0, 200));
     console.log('---');
     console.log('LAST TUTOR (T' + tutorTurns[tutorTurns.length-1].turn + '):', tutorTurns[tutorTurns.length-1].text.substring(0, 200));
   }
   "
   ```

9. **Selection strategy**: Don't read every log. Pick representative dialogues:
   - The **highest development score** dialogue (best adaptation example)
   - The **lowest development score** dialogue (worst/regression example)
   - If comparing conditions: one **base** and one **recog** example
   - Maximum 3-4 excerpts to keep output manageable

10. **Present excerpts** as quoted blocks showing first vs last tutor turn, with brief commentary on what changed (or didn't). Look for:
    - Strategy shifts (e.g., lecture → Socratic questioning)
    - Tone modulation (e.g., formal → empathetic)
    - Specificity changes (e.g., generic advice → targeted scaffolding)
    - Recognition markers (e.g., acknowledging learner's perspective)
    - Stagnation (tutor repeating same approach across turns)

### Layer 2: Trajectory & Change Analysis (standard, full)

7. **Trajectory curves** (per-dimension turn-by-turn slopes):
   ```bash
   node scripts/analyze-trajectory-curves.js <runId> [<runId> ...]
   ```
   Key outputs: tutor/learner trajectories per turn, dimension slope comparison (recog vs base), H1/H2 tests.

8. **Within-test change** (symmetric first-to-last delta):
   ```bash
   node scripts/analyze-within-test-change.js <runId> [<runId> ...]
   ```
   Key outputs: rubric delta + text-proxy delta, tutor vs learner change symmetry.

9. **Learning stagnation check**:
   ```bash
   node scripts/analyze-learning-stagnation.js <runId> [<runId> ...]
   ```

10. **Transcript browser** — provide the command for the user to run interactively:
    ```bash
    node scripts/browse-transcripts.js --run <runId>
    ```
    Note: this starts a web server. Don't run it — just print the command.

Summarize trajectory findings: which dimensions show growth? Is tutor or learner changing more? Any stagnation patterns?

### Layer 3: Qualitative Assessment (full only)

**WARN THE USER**: These steps make API calls and cost money (~$0.50-2 per run).

11. **AI narrative assessment** of transcripts:
    ```bash
    node scripts/assess-transcripts.js <runId> --model claude-code --parallelism 2
    ```
    For blinded assessment (judge doesn't see condition labels):
    ```bash
    node scripts/assess-transcripts.js <runId> --blinded --model claude-code
    ```

12. **Impasse strategy coding** (if multi-turn dialogues):
    ```bash
    node scripts/code-impasse-strategies.js --run-id <runId> --model claude-code
    ```

13. **Dialectical modulation coding** (if superego traces exist):
    ```bash
    node scripts/code-dialectical-modulation.js --run-id <runId> --model claude-code
    ```

For `full` level: ask user to confirm before running API-calling steps. Show estimated cost.

## Narrative Structure

After gathering data, synthesize findings into a narrative:

1. **Overview**: What was tested, what models, how many rows
2. **Output quality**: Which condition/model produces better tutor and learner output
3. **Learning evidence**: Is there turn-over-turn improvement? For tutor? For learner? Both?
4. **Deliberation quality**: How does internal ego-superego process relate to output quality?
5. **Interaction effects**: Does recognition × model or recognition × architecture interact?
6. **Anomalies**: Any negative development, stagnation, zeros, or ceiling effects?
7. **Recommendations**: What to run next, what needs more reps, what findings are robust

## Important Notes

- **Always filter by `judge_model`** when comparing across runs with different judges
- Use run ID shorthand (8+ hex chars) with LIKE suffix for queries
- If the user provides a general question instead of run IDs, query recent runs and identify relevant ones
- Provider model aliases are in `config/providers.yaml` — see `provider-models.md` in memory
- `tutor_first_turn_score` is the primary tutor column (NOT `overall_score`)
