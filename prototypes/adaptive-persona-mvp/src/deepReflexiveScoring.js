import { judgePsychodynamicAdaptation } from './psychodynamicRubric.js';
import { judgeReflexiveDeliberation } from './reflexiveAnalysis.js';
import { isReflexiveCondition } from './reflexiveVariants.js';
import { withProgress } from './progressMonitor.js';

export async function annotateReflexiveBranches(report, {
  model = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompts = false,
  onProgress = null,
} = {}) {
  for (const scenario of report.results || []) {
    for (const [conditionName, condition] of Object.entries(scenario.conditions || {})) {
      if (!isReflexiveCondition(conditionName)) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const branch = condition[branchName];
        if (!branch) continue;
        branch.reflexiveDeliberationJudge = await withProgress(onProgress, {
          phase: 'deep-reflexive',
          scenarioId: scenario.scenarioId,
          condition: conditionName,
          branchName,
          step: 'deliberation judge',
        }, async () => judgeReflexiveDeliberation({
          scenario,
          branch,
          model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        }));
        branch.psychodynamicAdaptationJudge = await withProgress(onProgress, {
          phase: 'deep-reflexive',
          scenarioId: scenario.scenarioId,
          condition: conditionName,
          branchName,
          step: 'psychodynamic judge',
        }, async () => judgePsychodynamicAdaptation({
          scenario,
          branch,
          model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        }));
      }
    }
  }
  return report;
}

export function estimateDeepReflexiveProgressUnits({ scenarioCount = 0, conditions = [] } = {}) {
  const reflexiveConditionCount = conditions.filter((condition) => isReflexiveCondition(condition)).length;
  return scenarioCount * reflexiveConditionCount * 2 * 2;
}
