import fs from 'node:fs';
import path from 'node:path';

import {
  completeLongRunningWorkflowPhase,
  createLongRunningWorkflowStatus,
  loadLongRunningWorkflowStatus,
  recordLongRunningWorkflowRecovery,
  startLongRunningWorkflowPhase,
  writeLongRunningWorkflowStatusAtomic,
} from './longRunningWorkflowStatus.js';

export const ACTION_OUTCOME_COLLECTION_PHASE_PLAN = Object.freeze([
  'PREFLIGHT',
  'GENERATING',
  'EXTRACTING',
  'AUDITING',
  'PACKAGING',
  'WORKFLOW_COMPLETE',
]);

function safeWorkflowId(value) {
  const workflowId = String(value || '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(workflowId)) {
    throw new Error('workflow id must be a safe lowercase artifact name');
  }
  return workflowId;
}

export function actionOutcomeCollectionWorkflowStatusPath({ generationRoot, workflowId }) {
  const root = path.resolve(generationRoot);
  return path.join(path.dirname(root), '.workflow-status', `${safeWorkflowId(workflowId)}.json`);
}

export function createActionOutcomeCollectionWorkflowStatus({ workflowId, at, units, calls, recovering = false } = {}) {
  let status = createLongRunningWorkflowStatus({
    workflowId: safeWorkflowId(workflowId),
    phasePlan: ACTION_OUTCOME_COLLECTION_PHASE_PLAN,
    at,
    units,
    calls,
    modelActivity: {
      state: 'inactive',
      explanation: 'Preflight is local validation and does not call a model provider.',
    },
    nextAction: {
      description: recovering ? 'Start the bounded registered recovery.' : 'Start the registered generation block.',
      stopping_condition: 'Stop before dispatch if preflight or paid-study admission fails.',
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PREFLIGHT',
    nextPhase: 'GENERATING',
    at,
    startNextImmediately: true,
    units,
    calls,
    modelActivity: {
      state: 'inactive',
      explanation: 'No child process has been dispatched yet.',
    },
    nextAction: {
      description: recovering
        ? 'Run only registered missing recovery units.'
        : 'Run the next registered generation unit.',
      stopping_condition: 'Stop on a failed unit, configuration drift, or the hard call ceiling.',
    },
  });
  if (recovering) {
    status = startLongRunningWorkflowPhase(status, {
      phase: 'RECOVERING',
      at,
      modelActivity: {
        state: 'inactive',
        explanation: 'Recovery is admitted, but no recovery child is active yet.',
      },
      nextAction: {
        description: 'Run only never-attempted registered units under the unchanged ceiling.',
        stopping_condition: 'Stop on the first failed recovery unit or when no eligible missing unit remains.',
      },
    });
    status = recordLongRunningWorkflowRecovery(status, {
      at,
      operation: 'Run the bounded action-outcome missing-only recovery.',
      reason: 'A sealed predecessor left registered units missing after a technical failure.',
      scope: 'Preserve completed and failed units; run only never-attempted units under the unchanged ceiling.',
      modelActivity: status.model_activity,
    });
  }
  return status;
}

export function loadOrCreateActionOutcomeCollectionWorkflowStatus({
  filePath,
  workflowId,
  at,
  units,
  calls,
  recovering = false,
} = {}) {
  if (fs.existsSync(filePath) || fs.existsSync(`${filePath}.previous`)) {
    const loaded = loadLongRunningWorkflowStatus(filePath);
    let status = loaded.status;
    if (recovering) {
      status = startLongRunningWorkflowPhase(status, {
        phase: 'RECOVERING',
        at,
        units,
        calls,
        modelActivity: {
          state: 'inactive',
          explanation: 'Recovery is admitted, but no recovery child is active yet.',
        },
        nextAction: {
          description: 'Run only never-attempted registered units under the unchanged ceiling.',
          stopping_condition: 'Stop on the first failed recovery unit or when no eligible missing unit remains.',
        },
      });
      status = recordLongRunningWorkflowRecovery(status, {
        at,
        operation: 'Run the bounded action-outcome missing-only recovery.',
        reason: 'A sealed predecessor left registered units missing after a technical failure.',
        scope: 'Preserve completed and failed units; run only never-attempted units under the unchanged ceiling.',
        modelActivity: status.model_activity,
      });
    }
    return { status, recoveredFrom: loaded.recovered_from, warnings: loaded.warnings };
  }
  return {
    status: createActionOutcomeCollectionWorkflowStatus({ workflowId, at, units, calls, recovering }),
    recoveredFrom: null,
    warnings: [],
  };
}

export function ensureActionOutcomeGenerationHandoff({ filePath, generationReport, at = new Date() }) {
  if (fs.existsSync(filePath) || fs.existsSync(`${filePath}.previous`)) {
    return loadLongRunningWorkflowStatus(filePath).status;
  }
  const execution = generationReport.execution || {};
  const modelAttempts = execution.model_attempts || {};
  let status = createActionOutcomeCollectionWorkflowStatus({
    workflowId: generationReport.study_id,
    at,
    units: {
      complete: execution.complete_units || 0,
      active: 0,
      failed:
        (execution.technical_failure_units || 0) +
        (execution.ceiling_failure_units || 0) +
        (execution.unclassified_failure_units || 0),
      missing: execution.missing_units || 0,
    },
    calls: {
      completed: modelAttempts.completed || 0,
      failed: modelAttempts.failed || 0,
      reserved: modelAttempts.reserved_by_shared_study_ledger || 0,
      hard_ceiling: modelAttempts.hard_ceiling || 0,
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'GENERATING',
    nextPhase: 'EXTRACTING',
    at,
    handoffExplanation:
      'Generation is sealed. The authorized zero-call extraction phase has not started in this process.',
    modelActivity: {
      state: 'inactive',
      explanation: 'The generation report is sealed; the remaining registered phases are zero-call.',
    },
    nextAction: {
      description: 'Start zero-call extraction from the sealed generation report and source traces.',
      stopping_condition: 'Stop if a source, schema, or registered-condition check fails.',
    },
  });
  writeLongRunningWorkflowStatusAtomic(filePath, status);
  return status;
}
