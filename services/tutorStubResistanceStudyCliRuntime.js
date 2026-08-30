import path from 'node:path';

import { configureTutorStubBoredomProofDagFromCli } from './tutorStubBoredomActionRegisterProofDagStudy.js';
import { configureTutorStubResistantLearnerCalibrationFromCli } from './tutorStubResistantLearnerCalibration.js';
import { configureTutorStubResistanceActionRegisterConfirmationFromCli } from './tutorStubResistanceActionRegisterConfirmation.js';
import {
  configureTutorStubResistanceActionRegisterExecution,
  loadTutorStubResistanceActionRegisterPrefixBundle,
} from './tutorStubResistanceActionRegisterExecution.js';
import { configureTutorStubResistanceManipulationValidationFromCli } from './tutorStubResistanceActionRegisterManipulationValidation.js';
import { configureTutorStubResistanceWarmNonwarmFromCli } from './tutorStubResistanceWarmNonwarmConfirmation.js';
import { configureTutorStubDefiantWarrantFromCli } from './tutorStubDefiantWarrantOutcomeStudy.js';

function complete(values) {
  return values.every(Boolean);
}

function partial(values) {
  return values.some(Boolean) && !complete(values);
}

export function configureTutorStubResistanceStudiesFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoLearnerProfileId,
  autoTurns,
  appendTraceEvent,
  acknowledgeTutorStubOpeningRelease,
  firstMessage,
  observationSemantics,
} = {}) {
  const baseline = [
    args['resistance-action-register-registration'],
    args['resistance-action-register-prefix-bundle'],
    args['resistance-action-register-job'],
  ];
  const confirmation = [
    args['resistance-action-register-confirmation-registration'],
    args['resistance-action-register-confirmation-job'],
  ];
  const manipulation = [
    args['resistance-action-register-manipulation-validation-design'],
    args['resistance-action-register-manipulation-validation-job'],
  ];
  const warmNonwarm = [
    args['resistance-warm-nonwarm-confirmation-design'],
    args['resistance-warm-nonwarm-confirmation-job'],
  ];
  const boredom = [args['boredom-proof-dag-registration'], args['boredom-proof-dag-job']];
  const resistantLearner = [args['resistant-learner-calibration-design'], args['resistant-learner-calibration-job']];
  const defiantWarrant = [args['defiant-warrant-outcome-design'], args['defiant-warrant-outcome-job']];
  const modes = [baseline, confirmation, manipulation, warmNonwarm, boredom, resistantLearner, defiantWarrant];
  if (modes.filter((mode) => mode.some(Boolean)).length > 1) {
    throw new Error(
      'baseline replay, frame confirmation, manipulation validation, warm/nonwarm confirmation, boredom proof-DAG, resistant-learner calibration, and defiant-warrant pilot modes are mutually exclusive',
    );
  }
  if (partial(baseline)) {
    throw new Error('resistance action/register execution requires registration, prefix bundle, and job together');
  }
  if (complete(baseline)) {
    const budget = Number(args['model-call-budget']);
    if (
      !autoLearnerEnabled ||
      Number(autoTurns) !== 3 ||
      !Number.isInteger(budget) ||
      budget < 1 ||
      budget > 39 ||
      args.model !== 'codex.gpt-5.6-luna' ||
      args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
      args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
      args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
      args['cli-effort'] !== 'low' ||
      Number(args['run-seed']) !== 20260820 ||
      args['acknowledge-research-use'] !== true ||
      observationSemantics !== 'prospective_v4'
    ) {
      throw new Error('resistance action/register execution launch pins or remaining 39-attempt ceiling drifted');
    }
    const loaded = loadTutorStubResistanceActionRegisterPrefixBundle({
      registrationPath: path.resolve(root, args['resistance-action-register-registration']),
      bundlePath: path.resolve(root, args['resistance-action-register-prefix-bundle']),
    });
    const configured = configureTutorStubResistanceActionRegisterExecution({
      state,
      loaded,
      jobId: args['resistance-action-register-job'],
      appendTraceEvent,
      acknowledgeTutorStubOpeningRelease,
    });
    if (String(firstMessage || '').trim() !== configured.prefix.trigger_learner_text) {
      throw new Error('resistance action/register first message must exactly equal the registered frozen trigger');
    }
  }
  if (partial(confirmation))
    throw new Error('fresh action/register confirmation requires registration and job together');
  if (complete(confirmation)) {
    configureTutorStubResistanceActionRegisterConfirmationFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoTurns,
      appendTraceEvent,
      observationSemantics,
    });
  }
  if (partial(manipulation)) throw new Error('manipulation validation requires design and job together');
  if (complete(manipulation)) {
    configureTutorStubResistanceManipulationValidationFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoTurns,
      appendTraceEvent,
      observationSemantics,
    });
  }
  if (partial(warmNonwarm)) throw new Error('warm/nonwarm confirmation requires design and job together');
  if (complete(warmNonwarm)) {
    configureTutorStubResistanceWarmNonwarmFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoTurns,
      appendTraceEvent,
      observationSemantics,
    });
  }
  if (partial(boredom)) throw new Error('boredom proof-DAG execution requires registration and job together');
  if (complete(boredom)) {
    configureTutorStubBoredomProofDagFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoLearnerProfileId,
      autoTurns,
      appendTraceEvent,
      observationSemantics,
    });
  }
  if (partial(defiantWarrant)) throw new Error('defiant-warrant pilot requires design and job together');
  if (complete(defiantWarrant)) {
    configureTutorStubDefiantWarrantFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoLearnerProfileId,
      autoTurns,
      appendTraceEvent,
    });
  }
  if (partial(resistantLearner)) throw new Error('resistant-learner calibration requires design and job together');
  if (complete(resistantLearner)) {
    configureTutorStubResistantLearnerCalibrationFromCli({
      args,
      state,
      root,
      autoLearnerEnabled,
      autoLearnerProfileId,
      autoTurns,
      appendTraceEvent,
      observationSemantics,
    });
  }
}

export default { configureTutorStubResistanceStudiesFromCli };
