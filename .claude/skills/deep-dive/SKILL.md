---
name: deep-dive
description: Deep multi-layer analysis of evaluation runs — scores, trajectories, transcripts, and qualitative assessment
argument-hint: "[run-id|cell-pattern|--coverage] [--level quick|standard|full]"
allowed-tools: Bash, Read, Grep, Glob
---

Deep analysis of evaluation run(s) `$ARGUMENTS`.

This skill orchestrates multiple analysis tools in sequence, from cheap DB queries up to API-powered qualitative assessment. The user can specify a depth level to control cost.

**If no arguments are provided**, enter **Browse Mode** — an epoch-wide overview that shows what's been run, highlights interesting patterns, and suggests specific cells/runs to drill into. See the Browse Mode section below.

## Parse Arguments

- Positional args matching `eval-20*` or 8+ hex chars are **run IDs** (support shorthand — use LIKE suffix)
- Positional args matching a **cell name** (e.g. `cell_82`, `cell_83_messages_base_multi_psycho`) or **model alias** (e.g. `haiku`, `gemini-flash`, `nemotron`) are used to **auto-discover run IDs** (see below)
- **Cell range patterns** like `cell_80..87` or `cells 80-87` — expand to individual cell prefixes and run **coverage analysis** (see Coverage Mode below)
- `--coverage` flag — forces coverage analysis mode even for single cells
- `--level quick|standard|full` controls depth (default: `standard`)
- `--condition base|recog` filters to one experimental condition (see below)
- `--profile <name>` filters to specific cell(s) — substring match (see below)
- `--scenario <id>` filters to specific scenario(s) (see below)
- `--epoch <name>` overrides epoch filter (default: `2.0`, which means `tutor_rubric_version = '2.2'`)
- `--all-epochs` disables epoch filtering (searches all data)
- `--compare` forces cross-run transcript comparison even for a single run with multiple cells
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
/deep-dive cell_80..87                # coverage audit of the 2×2×2 messages-mode factorial
/deep-dive cells 80-90 --all-epochs   # full messages-mode range, all epochs
/deep-dive cell_40..59 --coverage     # mechanism variant coverage
```

## Browse Mode (no arguments)

When `/deep-dive` is invoked with **no arguments**, present an epoch-wide overview of all scored data. This is a fast, free, read-only scan that helps the user navigate the evaluation landscape and choose what to drill into.

### Step 1: Epoch summary

```bash
sqlite3 -header -separator '|' data/evaluations.db "
SELECT tutor_rubric_version as epoch,
  COUNT(*) as rows,
  COUNT(DISTINCT run_id) as runs,
  COUNT(DISTINCT profile_name) as cells,
  COUNT(DISTINCT scenario_id) as scenarios,
  COUNT(DISTINCT ego_model) as models,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM evaluation_results
WHERE tutor_first_turn_score IS NOT NULL
GROUP BY tutor_rubric_version
ORDER BY tutor_rubric_version"
```

Present this as a compact table. Highlight the current epoch (2.2) row as the canonical data.

### Step 2: Cell leaderboard (epoch 2.0 only)

Rank all cells by mean tutor holistic score, showing key metrics:

```bash
sqlite3 -header -separator '|' data/evaluations.db "
SELECT profile_name as cell,
  ROUND(AVG(tutor_first_turn_score),1) as t1,
  ROUND(AVG(tutor_last_turn_score),1) as tN,
  ROUND(AVG(tutor_development_score),1) as dev,
  ROUND(AVG(tutor_holistic_overall_score),1) as hol,
  ROUND(AVG(learner_overall_score),1) as lrn,
  ROUND(AVG(dialogue_quality_score),1) as dq,
  COUNT(*) as n
FROM evaluation_results
WHERE tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
GROUP BY profile_name
HAVING n >= 3
ORDER BY hol DESC"
```

Present as a ranked table. Annotate with:
- **Top 5** cells (highest holistic score) — mark as "strong performers"
- **Bottom 5** cells — mark as "weak performers or interesting negatives"
- **Largest development** (top 3 by `dev`) — mark as "best adaptation"
- **Negative development** (dev < 0) — mark as "regression cases"

### Step 3: Scenario overview

```bash
sqlite3 -header -separator '|' data/evaluations.db "
SELECT scenario_id, scenario_name,
  COUNT(*) as n,
  COUNT(DISTINCT profile_name) as cells,
  ROUND(AVG(tutor_holistic_overall_score),1) as avg_hol,
  ROUND(MIN(tutor_holistic_overall_score),1) as min_hol,
  ROUND(MAX(tutor_holistic_overall_score),1) as max_hol,
  ROUND(AVG(tutor_development_score),1) as avg_dev
FROM evaluation_results
WHERE tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
GROUP BY scenario_id
ORDER BY avg_hol DESC"
```

Annotate which scenarios are **hardest** (lowest avg scores) and which have the **widest spread** (max − min) — these are the most interesting to compare across cells.

### Step 4: Model comparison (if multiple ego models)

```bash
sqlite3 -header -separator '|' data/evaluations.db "
SELECT ego_model,
  COUNT(*) as n,
  COUNT(DISTINCT profile_name) as cells,
  ROUND(AVG(tutor_holistic_overall_score),1) as hol,
  ROUND(AVG(tutor_development_score),1) as dev,
  ROUND(AVG(learner_overall_score),1) as lrn,
  ROUND(AVG(dialogue_quality_score),1) as dq
FROM evaluation_results
WHERE tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
GROUP BY ego_model
HAVING n >= 3
ORDER BY hol DESC"
```

### Step 5: Recognition effect quick check

```bash
sqlite3 -separator '|' data/evaluations.db "
SELECT
  CASE WHEN profile_name LIKE '%recog%' THEN 'recog' ELSE 'base' END as condition,
  COUNT(*) as n,
  ROUND(AVG(tutor_first_turn_score),1) as t1,
  ROUND(AVG(tutor_holistic_overall_score),1) as hol,
  ROUND(AVG(tutor_development_score),1) as dev,
  ROUND(AVG(learner_overall_score),1) as lrn,
  ROUND(AVG(dialogue_quality_score),1) as dq
FROM evaluation_results
WHERE tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
GROUP BY 1"
```

### Step 6: Suggest drill-downs

Based on the data, suggest 3-5 specific `/deep-dive` commands the user might want to run next. Tailor suggestions to what the data shows:

**Always suggest**:
- The **top-performing cell** vs its **matched control** (e.g., if cell_86 is top, suggest comparing cell_86 vs cell_82)
- A **coverage audit** for the most populated cell range

**Conditionally suggest** (based on what the data reveals):
- If there's a **regression case** (negative dev): `/deep-dive <cell> --level standard` to investigate
- If one **scenario is notably harder**: `/deep-dive <cell_range> --scenario <hard_scenario>` to see who handles it best
- If there's a **model effect**: `/deep-dive <model_alias>` to compare model-specific runs
- If **under-replicated cells** exist: coverage mode for the sparse range

**Format suggestions as a numbered menu**:
```
## What to explore next

1. `/deep-dive cell_86 cell_82` — Compare top recog cell vs base counterpart (hol: 72.3 vs 48.1)
2. `/deep-dive cell_80..87` — Coverage audit of messages-mode 2×2×2 factorial
3. `/deep-dive cell_71` — Investigate naive baseline regression (dev: -8.2)
4. `/deep-dive cell_80..87 --scenario epistemic_resistance_impasse` — Hardest scenario, widest spread
5. `/deep-dive nemotron --condition recog` — Nemotron recognition runs (strongest model effect)
```

Each suggestion should include a brief rationale in parentheses explaining *why* it's interesting.

## Coverage Mode

Activated by a **cell range pattern** (e.g. `cell_80..87`, `cells 80-90`, `80..87`) or the `--coverage` flag. Instead of analyzing a single run, coverage mode audits a group of cells to identify:

1. What has been run and scored
2. What's missing or under-replicated
3. What to run next to fill gaps

### Range Pattern Parsing

Convert the range to a list of cell number prefixes:
- `cell_80..87` → cells 80, 81, 82, 83, 84, 85, 86, 87
- `cells 80-90` → cells 80 through 90
- `80..87` → cells 80 through 87

Then match `profile_name LIKE 'cell_<N>%'` for each N.

### Coverage Queries

**Step 1: Full inventory** — what exists in the DB for these cells:

```sql
SELECT profile_name,
  tutor_rubric_version as rubric,
  judge_model,
  COUNT(*) as n,
  COUNT(DISTINCT run_id) as runs,
  COUNT(DISTINCT scenario_id) as scenarios,
  ROUND(AVG(tutor_first_turn_score),1) as t1,
  ROUND(AVG(tutor_last_turn_score),1) as tN,
  ROUND(AVG(tutor_development_score),1) as dev,
  ROUND(AVG(tutor_holistic_overall_score),1) as hol,
  ROUND(AVG(learner_overall_score),1) as lrn,
  ROUND(AVG(dialogue_quality_score),1) as dq
FROM evaluation_results
WHERE (profile_name LIKE 'cell_80%' OR profile_name LIKE 'cell_81%' OR ...)
  AND tutor_first_turn_score IS NOT NULL
GROUP BY profile_name, tutor_rubric_version, judge_model
ORDER BY profile_name, tutor_rubric_version
```

**Step 2: Epoch 2.0 replication matrix** — per-cell × per-scenario counts (the canonical data):

```sql
SELECT profile_name, scenario_id, COUNT(*) as reps
FROM evaluation_results
WHERE (profile_name LIKE 'cell_80%' OR ...)
  AND tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
  AND judge_model LIKE '%sonnet%'
GROUP BY profile_name, scenario_id
ORDER BY profile_name, scenario_id
```

**Step 3: Identify the factorial design** — read `config/tutor-agents.yaml` to understand the intended factorial structure. For cells 80-87 this is a 2×2×2 (condition × tutor_arch × learner_arch):

| | Single tutor | Multi tutor |
|--|-------------|-------------|
| **Base + Unified learner** | cell_80 | cell_82 |
| **Base + Multi learner** | cell_81 | cell_83 |
| **Recog + Unified learner** | cell_84 | cell_86 |
| **Recog + Multi learner** | cell_85 | cell_87 |

Read the YAML to confirm the actual factorial for whatever range was requested:
```bash
node -e "
const YAML = require('yaml');
const fs = require('fs');
const cfg = YAML.parse(fs.readFileSync('config/tutor-agents.yaml', 'utf8'));
const cells = [80,81,82,83,84,85,86,87]; // replace with actual range
for (const n of cells) {
  const key = Object.keys(cfg.profiles).find(k => k.startsWith('cell_' + n + '_'));
  if (!key) { console.log('cell_' + n + ': NOT FOUND'); continue; }
  const p = cfg.profiles[key];
  const f = p.factors || {};
  console.log(key + ':', 'recog=' + (f.recognition || false) + ', multi_tutor=' + (f.multi_agent_tutor || false) + ', learner=' + (p.learner_architecture || 'unified') + ', superego=' + (p.superego ? 'configured' : 'null') + ', mode=' + (p.conversation_mode || 'single-prompt'));
}
"
```

### Coverage Report Format

Present results as a structured report:

#### 1. Factorial Design Table
Show the intended design (from YAML) with cell numbers:
```
Condition × Tutor Arch × Learner Arch
─────────────────────────────────────────
                  Single tutor    Multi tutor (superego)
Base + Unified    cell_80         cell_82
Base + Multi      cell_81         cell_83
Recog + Unified   cell_84         cell_86
Recog + Multi     cell_85         cell_87
```

#### 2. Replication Matrix (epoch 2.0, Sonnet judge)
Show per-cell × per-scenario replication counts. Mark cells that are under-replicated:
```
Cell    | Misconception | Mood  | Mutual Trans | Epistemic | Total | Status
--------|---------------|-------|-------------|-----------|-------|--------
cell_80 | 3             | 2     | 3           | 1         | 9     | OK
cell_81 | 1             | 0     | 1           | 1         | 3     | SPARSE
cell_82 | 5             | 4     | 5           | 1         | 15    | OK
...
```

Target: **3 reps per scenario per cell** minimum for statistical power.
Flag cells with fewer than 3 reps on any scenario as **NEEDS RUNS**.
Flag cells with 0 reps on a scenario as **MISSING**.

#### 3. Score Summary (epoch 2.0)
Compact table of mean scores per cell (same columns as Layer 1).

#### 4. Gap Analysis & Recommendations
Synthesize the findings into actionable next steps:

- **Missing cells**: Cells in the factorial with 0 epoch-2.0 data
- **Under-replicated cells**: Cells with < 3 reps on some scenarios
- **Scenario gaps**: Scenarios that are missing for some cells but present for others
- **Balance issues**: Cells with much more data than others (imbalanced N)
- **Cross-epoch contamination**: Old rubric data that shouldn't be mixed with epoch 2.0

Generate the exact `eval-cli.js run` command(s) to fill gaps. Follow the safety rule: **generate commands, don't run them.**

Example output:
```
## What needs to be run

### Priority 1: Missing factorial cells
- cell_81 needs 3 more reps on mood_frustration_to_breakthrough (currently 0)
- cell_85 needs 2 more reps on misconception_correction_flow (currently 1)

### Priority 2: Under-replicated
- cell_80, cell_83, cell_84, cell_87 need 2 more reps on epistemic_resistance_impasse (currently 1 each)

### Suggested commands:
```bash
# Fill cell_81 + cell_85 gaps (sparse cells, 3 reps each)
node scripts/eval-cli.js run --profiles cell_81_messages_base_single_psycho,cell_85_messages_recog_single_psycho --runs 3 --cluster multi-turn --skip-rubric --description "Fill 2x2x2 factorial gaps: psycho learner cells"

# Fill epistemic_resistance_impasse gaps (all cells need more reps)
node scripts/eval-cli.js run --profiles cell_80_messages_base_single_unified,cell_83_messages_base_multi_psycho,cell_84_messages_recog_single_unified,cell_87_messages_recog_multi_psycho --runs 2 --scenario epistemic_resistance_impasse --skip-rubric --description "Fill epistemic resistance scenario gap"
```

### Variant cells (88-90+)
Note any variant cells found outside the core factorial and their status.

### Coverage Invocation Examples

```
/deep-dive cell_80..87                          # 2×2×2 factorial coverage audit
/deep-dive cells 80-90 --all-epochs             # full range including variants, all epochs
/deep-dive cell_80..87 --coverage               # explicit coverage mode
/deep-dive cell_40..59 --coverage               # mechanism variant coverage
/deep-dive cell_60..70 --coverage               # dynamic learner coverage
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
| `standard` | + transcript excerpts (1.5) + cross-run comparison (1.5b) + trajectory curves + within-test change | Free |
| `full` | + assess-transcripts (AI narrative) + impasse coding | API calls (~$0.50-2/run) |

Layer 1.5b (cross-run transcript comparison) activates automatically when 2+ runs are provided, in coverage mode with matched cells, or with `--compare`.

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

### Layer 1.5b: Cross-Run Transcript Comparison (all levels, 2+ runs)

Compare what tutor and learner actually said across different cells/runs on the **same scenario**. Activates automatically when:
- **2+ run IDs** are provided (explicit or auto-discovered from cell names)
- **Coverage mode** discovers matched cells across conditions
- **`--compare` flag** is given (even with a single run containing multiple cells)

This layer runs **after** Layer 1.5 (single-run excerpts) and **before** Layer 2 (trajectory analysis). It is free (pure DB + file reads).

#### Step 1: Match dialogues across runs/cells by scenario

Find paired dialogues that share a scenario but differ in cell/condition:

```bash
sqlite3 -separator '|' data/evaluations.db "
SELECT dialogue_id, run_id, profile_name, scenario_id, scenario_name,
  tutor_first_turn_score as t1, tutor_last_turn_score as tN,
  tutor_development_score as dev, tutor_holistic_overall_score as hol,
  learner_overall_score as lrn, dialogue_quality_score as dq
FROM evaluation_results
WHERE run_id IN ('<runA>', '<runB>')
  AND tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
  AND dialogue_id IS NOT NULL AND dialogue_id <> ''
ORDER BY scenario_id, profile_name, tutor_development_score DESC"
```

If comparing cells within a single run (e.g. `--compare` with a run containing cell_82 and cell_86), use:
```sql
WHERE run_id LIKE '<runId>%'
  AND profile_name IN ('<cellA>', '<cellB>')
```

#### Step 2: Select representative dialogue pairs

Group results by `scenario_id`. For each scenario with dialogues from 2+ cells:

1. **Pick one dialogue per cell** — choose the one with the **median** `tutor_development_score` (most representative, not extreme). If only 1-2 dialogues exist per cell, use the one with the higher development score.
2. **Prioritize by largest score delta** — compare scenarios first where the score difference between cells is greatest (most interesting to explain qualitatively).
3. **Maximum 2-3 scenario comparisons** per invocation to keep output manageable.

#### Step 3: Read paired dialogue logs and extract public turns

Use a node one-liner to read two dialogue files and extract public messages side-by-side:

```bash
node -e "
const ids = ['<dialogueA>', '<dialogueB>'];
const labels = ['A: <cellA> (<condA>/<archA>)', 'B: <cellB> (<condB>/<archB>)'];
function extract(id) {
  const d = require('./logs/tutor-dialogues/' + id + '.json');
  const trace = d.dialogueTrace || d.trace || [];
  const turns = [];
  for (const e of trace) {
    if ((e.agent === 'learner' || e.agent === 'user') && (e.action === 'final_output' || e.action === 'turn_action')) {
      const text = (e.detail || e.contextSummary || '').substring(0, 400);
      if (text) turns.push({ turn: e.turnIndex, role: 'Learner', text });
    }
    if (e.agent === 'ego' && (e.action === 'revise' || e.action === 'generate_final' || e.action === 'generate')) {
      const msg = (e.suggestions || []).map(s => s.message || s.title || '').join(' ').substring(0, 400);
      if (msg) turns.push({ turn: e.turnIndex, role: 'Tutor', text: msg });
    }
  }
  const seen = new Map();
  for (const t of turns) seen.set(t.turn + '-' + t.role, t);
  return [...seen.values()].sort((a,b) => a.turn - b.turn);
}
for (let i = 0; i < ids.length; i++) {
  const deduped = extract(ids[i]);
  const tutorTurns = deduped.filter(t => t.role === 'Tutor');
  const learnerTurns = deduped.filter(t => t.role === 'Learner');
  console.log('=== ' + labels[i] + ' ===');
  if (tutorTurns.length >= 1)
    console.log('FIRST TUTOR (T' + tutorTurns[0].turn + '):', tutorTurns[0].text.substring(0, 250));
  if (tutorTurns.length >= 2)
    console.log('LAST TUTOR (T' + tutorTurns[tutorTurns.length-1].turn + '):', tutorTurns[tutorTurns.length-1].text.substring(0, 250));
  if (learnerTurns.length >= 1)
    console.log('FIRST LEARNER (T' + learnerTurns[0].turn + '):', learnerTurns[0].text.substring(0, 200));
  if (learnerTurns.length >= 2)
    console.log('LAST LEARNER (T' + learnerTurns[learnerTurns.length-1].turn + '):', learnerTurns[learnerTurns.length-1].text.substring(0, 200));
  console.log('');
}
"
```

#### Step 4: Present comparison

Use sequential A-then-B blocks (true side-by-side is impractical in terminal):

```
### Cross-Run Comparison: <Scenario Name> (<N>-turn)

**A**: <cell_name> (<condition>/<tutor_arch>/<learner_arch>) — T1=XX.X, TN=XX.X, Dev=±X.X
**B**: <cell_name> (<condition>/<tutor_arch>/<learner_arch>) — T1=XX.X, TN=XX.X, Dev=±X.X

#### First Tutor Turn
> **A**: "<first 200 chars of A's first tutor response>..."
> **B**: "<first 200 chars of B's first tutor response>..."

#### Last Tutor Turn
> **A**: "<first 200 chars of A's last tutor response>..."
> **B**: "<first 200 chars of B's last tutor response>..."

#### First Learner Turn
> **A**: "<first 150 chars of A's first learner message>..."
> **B**: "<first 150 chars of B's first learner message>..."

#### Last Learner Turn
> **A**: "<first 150 chars of A's last learner message>..."
> **B**: "<first 150 chars of B's last learner message>..."

#### Observations
- **Strategy shift**: Did either tutor change approach between first and last turn?
- **Recognition markers**: Any explicit acknowledgment of learner's perspective, growth, or autonomy?
- **Learner engagement**: Did learner responses show increasing depth/complexity?
- **Score-behavior alignment**: Does the score delta match what the text shows?
```

#### Commentary Guidelines

After each comparison, provide 2-4 bullet points of qualitative commentary noting:
- **Strategy shifts**: Did the tutor's pedagogical approach evolve? (e.g., corrective → scaffolding, lecture → Socratic)
- **Recognition markers**: Does the tutor explicitly acknowledge the learner's perspective, growth, or autonomy? Which cell does this more?
- **Learner engagement**: Do learner responses show increasing depth, complexity, or metacognitive awareness?
- **Score-behavior alignment**: Does the quantitative score delta match what the text reveals? If scores diverge from text quality, note this as an anomaly worth investigating.

#### Selection Strategy for Coverage Mode

When in coverage mode (`cell_80..87` etc.), automatically select comparison pairs:

1. **Identify the most interesting contrasts** from the score summary (Layer 1 / Coverage Step 3):
   - Largest T1 delta between base vs recog matched cells (e.g. cell_82 vs cell_86)
   - Largest development score difference within the same condition
   - Any cell pair where one regresses and the other grows
2. **Pick 2-3 pairs** maximum. Prefer pairs that test different factors:
   - One pair contrasting **condition** (base vs recog, same architecture)
   - One pair contrasting **architecture** (single vs multi tutor, same condition) if available
3. **For each pair**, pick the scenario with the largest score delta between the two cells

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

### For browse mode (no arguments)

Present the epoch overview as an interactive menu:

1. **Epoch snapshot**: How much data exists, across how many runs/cells/scenarios/models
2. **Cell leaderboard**: Top and bottom performers, with annotations for adaptation/regression
3. **Scenario landscape**: Which scenarios are hardest, which have the most variance
4. **Recognition effect**: Quick base vs recog comparison
5. **Suggested drill-downs**: 3-5 specific `/deep-dive` commands with rationale, formatted as a numbered menu the user can pick from

Keep the tone inviting — this is a "what would you like to explore?" prompt, not a final report.

### For run analysis (default mode)

After gathering data, synthesize findings into a narrative:

1. **Overview**: What was tested, what models, how many rows
2. **Output quality**: Which condition/model produces better tutor and learner output
3. **Qualitative contrast** (if 2+ runs/cells): What do the transcript comparisons reveal? Do text-level differences align with score differences?
4. **Learning evidence**: Is there turn-over-turn improvement? For tutor? For learner? Both?
5. **Deliberation quality**: How does internal ego-superego process relate to output quality?
6. **Interaction effects**: Does recognition × model or recognition × architecture interact?
7. **Anomalies**: Any negative development, stagnation, zeros, or ceiling effects?
8. **Recommendations**: What to run next, what needs more reps, what findings are robust

### For coverage analysis mode

After gathering coverage data, synthesize into:

1. **Factorial Design**: Show the intended design table from YAML
2. **Replication Matrix**: Per-cell × per-scenario counts with status flags
3. **Score Summary**: Mean scores per cell (epoch 2.0 only)
4. **Transcript Comparison**: Cross-run comparison of the 2-3 most interesting cell pairs (auto-selected by largest score delta). Use Layer 1.5b.
5. **Gap Analysis**: Missing cells, under-replicated cells, scenario gaps, balance issues
6. **Recommendations**: Exact `eval-cli.js run` commands to fill gaps (generate, don't execute)
7. **Variant Notes**: Any cells outside the core factorial (model variants, etc.) and their status
8. **Browse command**: Suggest `browse-transcripts.js --compare` for qualitative comparison of matched cells

## Important Notes

- **Always filter by `judge_model`** when comparing across runs with different judges
- Use run ID shorthand (8+ hex chars) with LIKE suffix for queries
- If the user provides a general question instead of run IDs, query recent runs and identify relevant ones
- Provider model aliases are in `config/providers.yaml` — see `provider-models.md` in memory
- `tutor_first_turn_score` is the primary tutor column (NOT `overall_score`)
