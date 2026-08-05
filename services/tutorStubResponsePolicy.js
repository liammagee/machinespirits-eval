import { createTutorStubAdaptiveResponsePolicyRuntime } from './tutorStubAdaptiveResponsePolicyRuntime.js';
import { createTutorStubResponseConfigurationSelectionRuntime } from './tutorStubResponseConfigurationSelectionRuntime.js';
import { createTutorStubResponsePolicySelectionRuntime } from './tutorStubResponsePolicySelectionRuntime.js';

export function createTutorStubResponsePolicy(dependencies = {}) {
  const selectionRuntime = createTutorStubResponsePolicySelectionRuntime(dependencies);
  const adaptiveRuntime = createTutorStubAdaptiveResponsePolicyRuntime(dependencies, selectionRuntime);
  const configurationRuntime = createTutorStubResponseConfigurationSelectionRuntime(
    dependencies,
    selectionRuntime,
    adaptiveRuntime,
  );

  return Object.freeze({
    registerSelectionFromCombinedAnalysis: selectionRuntime.registerSelectionFromCombinedAnalysis,
    evaluatePendingRegisterEfficacy: selectionRuntime.evaluatePendingRegisterEfficacy,
    policySamplingContext: selectionRuntime.policySamplingContext,
    explicitPerformanceDirectiveValue: selectionRuntime.explicitPerformanceDirectiveValue,
    resolveTutorStubCharacterChoice: selectionRuntime.resolveTutorStubCharacterChoice,
    explicitPerformanceActorialPartSelection: selectionRuntime.explicitPerformanceActorialPartSelection,
    performanceTemperatureScope: selectionRuntime.performanceTemperatureScope,
    randomPerformanceActorialPartSelection: selectionRuntime.randomPerformanceActorialPartSelection,
    formatEngagementStanceDistribution: adaptiveRuntime.formatEngagementStanceDistribution,
    normalizeResponseConfigurationSelection: configurationRuntime.normalizeResponseConfigurationSelection,
  });
}
