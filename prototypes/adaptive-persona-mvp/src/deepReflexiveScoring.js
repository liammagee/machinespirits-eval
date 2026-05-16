import { judgePsychodynamicAdaptation } from './psychodynamicRubric.js';
import { judgeReflexiveDeliberation } from './reflexiveAnalysis.js';
import { isReflexiveCondition } from './reflexiveVariants.js';

export async function annotateReflexiveBranches(report, {
  model = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompts = false,
} = {}) {
  for (const scenario of report.results || []) {
    for (const [conditionName, condition] of Object.entries(scenario.conditions || {})) {
      if (!isReflexiveCondition(conditionName)) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const branch = condition[branchName];
        if (!branch) continue;
        branch.reflexiveDeliberationJudge = await judgeReflexiveDeliberation({
          scenario,
          branch,
          model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        });
        branch.psychodynamicAdaptationJudge = await judgePsychodynamicAdaptation({
          scenario,
          branch,
          model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        });
      }
    }
  }
  return report;
}
