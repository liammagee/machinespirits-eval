# Feature-to-Finding Loop

Status: process note. This describes the recurring research-engineering pattern
we have been using across new tutor features, cell families, scenario grids, and
paper-facing claims. It is not an empirical claim and does not license any new
paper result by itself.

## Abstract Pattern

The loop is:

1. Notice a feature, failure, anomaly, or theoretical extension.
2. Isolate it in a worktree or branch.
3. Write a bounded plan with claim scope, stop rules, and artifacts.
4. Build the smallest foundations needed to make the feature evaluable.
5. Run no-paid validation and smoke tests.
6. Run a narrow paid or high-powered pilot only after the dry gates pass.
7. Analyze the pilot from the database and transcripts.
8. Scale to a wider but still bounded scenario/profile/model matrix.
9. Add judge, model, curriculum, and human-facing robustness gates.
10. Promote only the claim that the evidence actually supports.
11. Fold accepted claims into the paper/workplan/atlas; archive or kill the rest.

This is deliberately incremental. The first win is not "the idea works." The
first win is "the idea can be evaluated without obvious confounds."

## Stage Contract

| Stage | Purpose | Primary artifacts | Usual gate |
|---|---|---|---|
| 0. Observation | Turn an intuition into a testable design question. | Short note, issue/workplan capture, candidate feature name. | The question names a behavior, comparator, and failure mode. |
| 1. Isolation | Prevent unrelated repo state from contaminating the experiment. | Git worktree, `codex/<topic>` or equivalent branch. | `git status` understood; branch ancestry and dirty state known. |
| 2. Plan / Preregistration | Freeze what will count before optimizing. | Dated note under `notes/`; workplan item if live future work. | Scope boundary, primary scenarios, comparators, thresholds, and stop rules are explicit. |
| 3. Foundations | Make the idea runnable. | Cell/profile YAML, scenario file, prompt/rubric/script changes, validators. | Config resolves; no silent default-profile fallback; no missing content refs. |
| 4. No-Paid Gates | Catch cheap failures before model spend. | `validate-config`, smoke tests, hermetic tests, matrix sanity report. | All dry checks pass; generated report states the planned matrix size. |
| 5. Narrow Pilot | Learn whether the design survives first contact. | Small run IDs, progress logs, transcripts. | Required/forbidden validation and basic score columns are populated. |
| 6. Pilot Analysis | Decide whether this is a design issue, scenario issue, judge issue, or real negative. | DB tables, exported report, transcript excerpts. | Result is reproducible from SQL/scripts, not memory. |
| 7. Bounded Scale-Up | Test across a deliberately wider but still interpretable grid. | Scenario x profile x repeat matrix; comparator set; model overrides. | No tuning inside the matrix; failures are recorded as failures. |
| 8. Generalizability | Determine how far the claim travels. | Judge robustness, model robustness, curriculum transfer, human-coded subset. | Claim survives at least one independent robustness axis. |
| 9. Paper Fold-In | Promote only licensed claims. | `docs/research/paper-full-2.0.md`, exports, provable-discourse/atlas entries. | Paper claim validates against data and states its scope boundary. |
| 10. Closeout | Preserve provenance and make the next step clear. | Commit, push, workplan status, next target note. | Clean or intentionally dirty worktree; next design target named. |

## Skill Routing

Use the repo skills as the operating checklist. The current mirrors can be
checked with:

```bash
npm run skills:list
npm run skills:check
```

Important paths:

- `.agents/skills/` is the shared agent-facing skill root.
- `.claude/skills/` mirrors most project skills for Claude Code.
- `.codex/skills/` currently contains a smaller set; `ms-workplan` is mirrored
  there, and Codex in this app also sees `.agents/skills`.

Relevant skills by stage:

| Stage | Skills / references | Use |
|---|---|---|
| Planning and live tracking | `.agents/skills/ms-workplan/SKILL.md`, `workplan/README.md`, `workplan/playbook/quality.md` | Capture the item, set status/owner/branch, link notes/runs/exports, require a verification line. |
| Cell inspection | `.agents/skills/ms-cell-info/SKILL.md` | Never infer architecture from a cell number or name; read `config/tutor-agents.yaml`. |
| New cell creation | `.agents/skills/ms-add-cell/SKILL.md` | Allocate an ID, write YAML, register in `EVAL_ONLY_PROFILES`, run profile/naming smoke tests. |
| Model preflight | `.agents/skills/ms-check-models/SKILL.md` | Probe model availability/rate limits before paid OpenRouter runs. For Codex/Claude CLI model stacks, also check local CLI availability. |
| Eval execution | `.agents/skills/ms-run-eval/SKILL.md` | Use dot-notation model refs, `--runs`, explicit profiles/scenarios, `--skip-rubric` then `evaluate --follow` unless using an inline CLI judge. |
| Run recovery | `.agents/skills/ms-resume-run/SKILL.md` | Diagnose missing rows, preserve stored model overrides, clean exact empty rows only after confirmation, then resume/evaluate. |
| Run cleanup | `.agents/skills/ms-clean-runs/SKILL.md` | Identify stalled/artifact runs; never DELETE with `LIKE` or wildcard patterns. |
| DB questions | `.agents/skills/ms-query-db/SKILL.md` | Query `data/evaluations.db`; always filter by `judge_model`; use `tutor_first_turn_score` as the primary turn-0 score. |
| Run analysis | `.agents/skills/ms-analyze-run/SKILL.md` | Summarize scored rows, judge labels, multi-turn fields, incomplete rows, and low-N warnings. |
| Deep analysis | `.agents/skills/ms-deep-dive/SKILL.md` | Use for cross-run coverage, transcript review, model/cell discovery, and multi-layer interpretation. |
| Paper integration | `.agents/skills/ms-author-paper2/SKILL.md`, `.agents/skills/ms-build-paper/SKILL.md` | Add only traceable claims, annotate evidence state, build/validate the canonical Paper 2.0 artifact. |
| Theory-facing presentation | `.claude/skills/ms-theory-synthesis/SKILL.md` | Refresh the `/theory` synthesis only from already-papered claims; do not introduce new empirical claims there. |

## Command Patterns

### Worktree and Branch

```bash
git worktree add ../machinespirits-eval-<topic> -b codex/<topic>
git status --short --branch
git rev-parse --short HEAD
```

Use an isolated worktree when the experiment may touch configs, DB-adjacent
scripts, generated board files, or paper text while another thread is active.

### Config and Matrix Dry Gates

```bash
node scripts/eval-cli.js validate-config

EVAL_SCENARIOS_FILE=config/<scenario-file>.yaml \
  node scripts/eval-cli.js validate-config

node scripts/<matrix-sanity-script>.js --check
node --test tests/<focused-test>.test.js
npm run test:hermetic
npm run wp:check
```

Prefer a cheap matrix sanity script when the grid has many moving parts. It
should verify scenario IDs, profile names, profile registration, content
references, required/forbidden phrase lists, and the exact planned row count.

### Paid Pilot

```bash
EVAL_SCENARIOS_FILE=config/<scenario-file>.yaml \
  node scripts/eval-cli.js run \
  --profiles <profile_a>,<profile_b> \
  --scenario <scenario_a>,<scenario_b> \
  --runs 3 \
  --ego-model <provider.alias> \
  --superego-model <provider.alias> \
  --skip-rubric \
  --description "<bounded pilot>"

node scripts/eval-cli.js evaluate <runId> --follow
```

If using a CLI judge inline:

```bash
node scripts/eval-cli.js run \
  --profiles <profiles> \
  --scenario <scenarios> \
  --runs 1 \
  --judge-cli codex
```

Do not use `evaluate --force` unless the explicit intent is to overwrite
existing scores. For cross-judge reliability, rejudge the same response rows and
match on response content rather than comparing different generated responses.

### Analysis

```bash
sqlite3 -header -column data/evaluations.db "
SELECT profile_name, judge_model, COUNT(*) n,
       ROUND(AVG(tutor_first_turn_score),1) t0_mean
FROM evaluation_results
WHERE run_id = '<runId>'
  AND tutor_first_turn_score IS NOT NULL
GROUP BY profile_name, judge_model
ORDER BY profile_name, judge_model;"
```

For multi-turn cases, include `tutor_last_turn_score`,
`tutor_development_score`, learner scores, and dialogue-quality scores. Always
state which judge generated each row.

## Codex CLI Practices

Relevant local help comes from `codex --help`.

- Use `codex exec` for non-interactive, bounded tasks that should produce a
  patch or answer without opening the TUI.
- Use `codex review` for a code-review pass over a branch or diff.
- Use `codex resume --last` or `codex fork` when continuity matters more than a
  fresh session.
- Use `codex doctor` when local auth/config/runtime behavior is suspect.
- Use `codex --cd <dir>` to pin the working root.
- Use sandbox and approval flags deliberately. `--ask-for-approval never` and
  `--dangerously-bypass-approvals-and-sandbox` are automation/sandbox choices,
  not defaults for shared repo work.
- Use `--search` only when up-to-date external information is required; prefer
  local repo sources for run state, skills, and paper claims.

Codex best practice in this repo:

- Read actual files before inferring architecture or run state.
- Use `rg`/`rg --files` first.
- Use `apply_patch` for manual edits.
- Stage only the relevant slice.
- Commit before paid runs when run metadata should point at a real revision.
- Keep final claims bounded to the completed evidence gate.

## Claude Code CLI Practices

Relevant local help comes from `claude --help`.

- Use `claude -p` / `claude --print` for non-interactive output in scripts or
  one-shot reviews.
- Use `--output-format json` or `--output-format stream-json` when downstream
  parsing matters.
- Use `--max-budget-usd` on print-mode paid tasks that could expand.
- Use `--permission-mode plan` for design-only passes; use stricter tool
  allowlists for read-only reviews.
- Use `--allowedTools` / `--disallowedTools` to bound whether Claude may run
  Bash, Read, Edit, etc.
- Use `--worktree` / `--tmux` for isolated longer tasks when Claude Code should
  own the branch/worktree.
- Use `claude agents` / `--background` for managed background agents only when
  the thread is meant to coordinate them; avoid background agents in side
  conversations or when the main thread owns the active run.
- Use `claude doctor` for local setup issues.

Claude best practice in this repo:

- Invoke the matching `/ms-*` skill explicitly for repeatable workflows.
- Keep skill roots synchronized with `npm run skills:list`,
  `npm run skills:check`, and `npm run skills:sync` after mirror changes.
- For paper-facing prose, follow `ms-author-paper2`: every empirical claim must
  trace to a run, export, code path, or provable-discourse entry.

## Generalizability Ladder

Use these claim labels consistently:

| Evidence level | Licensed claim |
|---|---|
| Local smoke pass | "The implementation runs and validates on a minimal case." |
| Clean local design pass | "This design passes the specified local scenario(s)." |
| Repeated pilot | "This design is competitive across the tested pilot matrix." |
| Judge robustness | "The finding is not an artifact of one judge." |
| Model robustness | "The finding is not specific to one ego/id/model stack." |
| Curriculum robustness | "The finding transfers across the tested content domains." |
| Human-facing validation | "Human coders or learners did not classify the behavior as manipulative/coercive and found the authority defeasible/useful." |
| Paper claim | The narrowest sentence that all completed gates support. |

Never jump from a clean local pass to a general claim. The intermediate gates
are the method.

## Stop Rules

Stop and write down the failure rather than tuning through it when:

- A primary scenario fails required/forbidden validation.
- A result depends on a confounded scenario that was explicitly excluded from
  the decision rule.
- A comparator set changes after seeing results.
- A judge/model robustness check reverses the finding.
- A run has mixed judges and the analysis does not filter by `judge_model`.
- A new cell was not registered in `EVAL_ONLY_PROFILES`.
- A scenario references missing content or an unavailable course.
- The only available evidence is an LLM-written interpretation without DB or
  transcript provenance.

## Reusable Mini-Template

```markdown
# <Feature> Plan

## Boundary
Licensed claim:
Unlicensed claims:

## Design Target
Feature:
Comparator(s):
Primary failure mode:

## Scenario Grid
Primary:
Robustness:
Excluded/confounded:

## No-Paid Gates
- Config validation:
- Matrix sanity:
- Focused tests:
- Workplan validation:

## Pilot
Profiles:
Scenarios:
Runs per profile-scenario:
Model stack:
Judge stack:

## Promotion Criteria
- Required/forbidden validation:
- Score competitiveness:
- Judge robustness:
- Model robustness:
- Human-facing validation:

## Stop Rules

## Evidence Log
Runs:
Exports:
Paper sections:
```
