# D2-D6 Completion Audit

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: updated completion audit for the D2-D6 follow-up arc after D4 execution.

## Outcome

The D2-D6 arc is complete for this branch. D5 and D6 are completed as local
research-design decisions. D2 and D3 remain fully gated for future empirical
work: the repo records exactly what would unblock them and why no current branch
work should spend on them. D4 moved from gated to executed after user approval:
the architecture-matched SEL replication is now a scope-bound empirical result.

This closes the current objective by converting each item from a loose future
idea into a completed local decision, an explicit external gate, or in D4's
case a completed replication result folded into Paper 2.0.

## Status table

| Item | Current local disposition | Evidence |
|---|---|---|
| D5 | Complete locally | `notes/d5-measurement-gate-for-d2-d6.md` freezes v2.2 as the comparable scoring epoch and parks v3.0 as separate future methods work. |
| D6 | Complete locally | `notes/d6-orientation-family-matrix.md` freezes the family matrix and forbids treating architecture variants as pedagogical families. |
| D2 | Fully gated for future empirical implementation | `notes/d2-cross-application-role-reframed-gate.md` records the missing original Path 2 note, excludes therapy by default, separates role from orientation, requires fresh cell IDs, and freezes the pass threshold. |
| D4 | Completed empirical replication; scope-bound | `notes/d4-sel-disposition-gradient-gate.md` and `exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md` record run `eval-2026-06-24-250c6251`: 144/144 successful rows and Sonnet-scored first turns. Recognition improves all three SEL disposition families, but the monotone gradient does not replicate. |
| D3 | Fully gated for future empirical implementation | `notes/d3-heavy-bridge-followup-gate.md` records that Bridge 3b/4/5 require an endpoint independent of the optimized metric before any paid escalation. |

## Blockers and unblocks

### D2

Blocked for empirical execution by missing implementation assets and scope gates:

- original `notes/design-d2-path2-cross-application.md` is absent in this checkout;
- role-native prompts do not exist for peer support listener, customer service,
  and code reviewer;
- role-fit scoring is not frozen;
- TODO's cell range 98-105 is stale and already occupied;
- therapy is excluded unless a separate IRB/safety path is opened.

Unblock: open a new implementation item that authors the three role-native
prompt pairs, role-native content packages, rubric/scoring plan, fresh cell IDs,
budget, and optional therapy safety/IRB decision.

### D4

Executed after approval:

- production DB run `eval-2026-06-24-250c6251` covers cells 40-45 on the exact
  eight SEL scenarios in `content-test-sel/scenarios-sel.yaml`;
- 144/144 generations succeeded and 144/144 first turns are scored under
  `claude-code/sonnet`;
- verdict is scope-bound: suspicious +17.1 ($d = 1.03$), adversary +7.3
  ($d = 0.52$), advocate +15.4 ($d = 0.92$).

Closeout: report and paper update are complete. No further D4 paid run is
needed for this branch unless a later cross-judge sensitivity pass is explicitly
opened as a new item.

### D3

Blocked for empirical escalation by Goodhart risk and missing independent
endpoint:

- Bridges 0-2 are already null/lightweight-resistant;
- Bridge 3 at K=3 is suggestive but not bridgeable;
- a K sweep selected and judged only by coupling cosine would mainly test search
  over the scoring surface.

Unblock: open a new item with a frozen independent endpoint, no-cost/mock
fixture where applicable, budget, and stop rule.

## Verification performed

Commands run on this branch:

```bash
node scripts/workplan.js render
npm run wp:check
npm run wp:test
git diff --check
```

Original production DB inventory for D4 used:

```bash
sqlite3 /Users/lmagee/.machinespirits-data/evaluations.db \
  "SELECT profile_name, COUNT(*) AS n
   FROM evaluation_results
   WHERE profile_name IN (
     'cell_40_base_dialectical_suspicious_unified_superego',
     'cell_41_recog_dialectical_suspicious_unified_superego',
     'cell_42_base_dialectical_adversary_unified_superego',
     'cell_43_recog_dialectical_adversary_unified_superego',
     'cell_44_base_dialectical_advocate_unified_superego',
     'cell_45_recog_dialectical_advocate_unified_superego'
   )
   AND scenario_id IN (
     'new_sel_student_first_visit',
     'returning_sel_student_mid_course',
     'struggling_sel_student',
     'feelings_confusion',
     'interpersonal_conflict',
     'sel_frustration_to_breakthrough',
     'sel_misconception_correction',
     'sel_productive_deadlock'
   )
   GROUP BY profile_name;"
```

The query returned no rows before the paid run. The completed run now supplies
the missing cells 40-45 x SEL evidence; see
`exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md`.
