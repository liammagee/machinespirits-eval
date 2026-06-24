# D2-D6 Completion Audit

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: updated completion audit for the D2-D6 follow-up arc after D4 execution and D2 scaffold creation.

## Outcome

The D2-D6 arc is complete as Paper 2.0 cleanup, but D2 has now been reopened as
a future empirical implementation. D5 and D6 remain completed local
research-design decisions. D3 remains gated for future empirical work. D4 moved
from gated to executed after user approval: the architecture-matched SEL
replication is now a scope-bound empirical result. D2 now has a role-native
sidecar scaffold, but no empirical run has been executed.

This closes the current objective by converting each item from a loose future
idea into a completed local decision, an explicit external gate, or in D4's
case a completed replication result folded into Paper 2.0.

## Status table

| Item | Current local disposition | Evidence |
|---|---|---|
| D5 | Complete locally | `notes/d5-measurement-gate-for-d2-d6.md` freezes v2.2 as the comparable scoring epoch and parks v3.0 as separate future methods work. |
| D6 | Complete locally | `notes/d6-orientation-family-matrix.md` freezes the family matrix and forbids treating architecture variants as pedagogical families. |
| D2 | Scaffold created; empirical run pending paid-launch approval | `notes/d2-role-transfer-scaffold.md`, `config/d2-role-transfer.yaml`, `config/evaluation-rubric-d2-role-transfer.yaml`, `prompts/d2/*.md`, and `scripts/run-d2-role-transfer.js` define the role-native sidecar. `.env` is now present locally and loaded via dotenv; real generation and three-judge scoring have not been launched. |
| D4 | Completed empirical replication; scope-bound | `notes/d4-sel-disposition-gradient-gate.md` and `exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md` record run `eval-2026-06-24-250c6251`: 144/144 successful rows and Sonnet-scored first turns. Recognition improves all three SEL disposition families, but the monotone gradient does not replicate. |
| D3 | Fully gated for future empirical implementation | `notes/d3-heavy-bridge-followup-gate.md` records that Bridge 3b/4/5 require an endpoint independent of the optimized metric before any paid escalation. |

## Blockers and unblocks

### D2

Previously blocked by missing implementation assets; now scaffolded and locally
credentialed, but still pending paid empirical execution:

- original `notes/design-d2-path2-cross-application.md` is absent in this checkout;
- role-native prompts now exist for peer support listener, customer service,
  and code reviewer in `prompts/d2/`;
- role-fit scoring is frozen in
  `config/evaluation-rubric-d2-role-transfer.yaml`;
- TODO's cell range 98-105 is stale and already occupied;
- therapy is excluded unless a separate IRB/safety path is opened.
- empirical run has not been launched because it is a paid
  generation-plus-three-judge sequence.

Unblock: explicitly approve the paid run and execute the generation plus
three-judge scoring commands in `notes/d2-role-transfer-scaffold.md`.

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
