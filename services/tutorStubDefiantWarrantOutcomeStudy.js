import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TUTOR_STUB_DEFIANT_WARRANT_DESIGN_SCHEMA =
  'machinespirits.tutor-stub.defiant-warrant-outcome-pilot-design.v1';
export const TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS = Object.freeze(['warrant_serving', 'warrant_withholding']);
export const TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN = 'config/tutor-stub-defiant-warrant-outcome-pilot.v1.json';

const LUNA = 'codex.gpt-5.6-luna';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return sha256(JSON.stringify(canonical(value)));
}

export function validateTutorStubDefiantWarrantDesign(design) {
  const issues = [];
  if (design?.schema !== TUTOR_STUB_DEFIANT_WARRANT_DESIGN_SCHEMA) issues.push('design schema drifted');
  for (const arm of TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS) {
    if (!String(design?.arms?.[arm]?.conductInstruction || '').trim()) {
      issues.push(`arm ${arm} has no conduct instruction`);
    }
  }
  if (design?.arms?.warrant_serving?.conductInstruction === design?.arms?.warrant_withholding?.conductInstruction) {
    issues.push('the two arms carry identical conduct instructions');
  }
  const randomization = design?.randomization || {};
  const sample = design?.sampleSize || {};
  if (
    !Number.isInteger(randomization.masterSeed) ||
    randomization.blocks !== 9 ||
    randomization.dialoguesPerBlock !== 2 ||
    randomization.assignmentsPerArmPerBlock !== 1 ||
    sample.allocatedTotal !== 18 ||
    sample.allocatedPerArm !== 9
  ) {
    issues.push('randomization or sample allocation drifted from the registered 2x9 pilot');
  }
  const execution = design?.execution || {};
  if (
    execution.autoLearnerProfile !== 'frame_defiant' ||
    execution.world !== 'world_005_marrick' ||
    execution.dagMode !== 'strict_dag' ||
    execution.autoTurns !== 8 ||
    execution.registerPolicy !== 'field' ||
    execution.registerPalette !== 'safe' ||
    execution.maximumReservationsPerDialogue !== 48
  ) {
    issues.push('execution pins drifted from the registered instrument-gate pins');
  }
  const spend = design?.spendCeiling || {};
  if (spend.pilotMaximumModelAttemptReservations !== execution.maximumReservationsPerDialogue * sample.allocatedTotal) {
    issues.push('pilot ceiling is not per-dialogue cap times allocated dialogues');
  }
  const models = design?.models || {};
  if (models.tutor !== LUNA || models.learner !== LUNA || models.analysis !== LUNA || models.cliEffort !== 'low') {
    issues.push('model routes drifted from the registered luna/low pins');
  }
  return { valid: issues.length === 0, issues };
}

export function loadTutorStubDefiantWarrantDesign({
  designPath = TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  root = process.cwd(),
} = {}) {
  const absolute = path.resolve(root, designPath);
  const source = fs.readFileSync(absolute);
  const design = JSON.parse(source.toString('utf8'));
  const validation = validateTutorStubDefiantWarrantDesign(design);
  if (!validation.valid) {
    throw new Error(`defiant-warrant design invalid: ${validation.issues.join('; ')}`);
  }
  return { path: absolute, relativePath: path.relative(root, absolute), sha256: sha256(source), design };
}

function randomizedBlockOrder(design, blockId) {
  const seed = design.randomization.masterSeed;
  const algorithm = design.randomization.algorithm;
  return TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS.map((arm) => ({
    assigned_arm: arm,
    score_sha256: sha256(`${algorithm}:${seed}:${blockId}:${arm}`),
  }))
    .sort((left, right) => left.score_sha256.localeCompare(right.score_sha256))
    .map((entry, index) => ({ ...entry, permutation_rank: index + 1 }));
}

export function buildTutorStubDefiantWarrantPlan(design) {
  const validation = validateTutorStubDefiantWarrantDesign(design);
  if (!validation.valid) throw new Error(`defiant-warrant design invalid: ${validation.issues.join('; ')}`);
  const jobs = [];
  let assignmentIndex = 0;
  for (let block = 1; block <= design.randomization.blocks; block += 1) {
    const blockId = `dwo_block_${String(block).padStart(2, '0')}`;
    for (const entry of randomizedBlockOrder(design, blockId)) {
      jobs.push({
        id: `dwo_b${String(block).padStart(2, '0')}_s${entry.permutation_rank}_${entry.assigned_arm}`,
        block_id: blockId,
        slot: entry.permutation_rank,
        assignment_index: assignmentIndex,
        run_seed: design.randomization.masterSeed * 100 + assignmentIndex,
        assigned_arm: entry.assigned_arm,
        randomization: {
          master_seed: design.randomization.masterSeed,
          algorithm: design.randomization.algorithm,
          score_sha256: entry.score_sha256,
          permutation_rank: entry.permutation_rank,
        },
      });
      assignmentIndex += 1;
    }
  }
  if (jobs.length !== design.sampleSize.allocatedTotal) throw new Error('plan job count drifted');
  for (const arm of TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS) {
    if (jobs.filter((job) => job.assigned_arm === arm).length !== design.sampleSize.allocatedPerArm) {
      throw new Error(`plan arm ${arm} is unbalanced`);
    }
  }
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) throw new Error('plan job ids collide');
  if (new Set(jobs.map((job) => job.run_seed)).size !== jobs.length) throw new Error('plan run seeds collide');
  const assignmentProjection = jobs.map((job) => ({
    id: job.id,
    assigned_arm: job.assigned_arm,
    run_seed: job.run_seed,
  }));
  return {
    schema: 'machinespirits.tutor-stub.defiant-warrant-outcome-pilot-plan.v1',
    study_id: design.studyId,
    jobs,
    assignment_sha256: canonicalSha256(assignmentProjection),
  };
}

export function tutorStubDefiantWarrantConductCard(design, armId) {
  const instruction = String(design?.arms?.[armId]?.conductInstruction || '').trim();
  if (!instruction) throw new Error(`unknown defiant-warrant arm ${armId}`);
  return ['[Registered warrant-conduct directive]', instruction, '[End registered warrant-conduct directive]'].join(
    '\n',
  );
}

export function configureTutorStubDefiantWarrantFromCli({
  args,
  state,
  root = process.cwd(),
  autoLearnerEnabled,
  autoTurns,
  appendTraceEvent,
} = {}) {
  const designArg = args['defiant-warrant-outcome-design'];
  const jobArg = args['defiant-warrant-outcome-job'];
  if (!designArg && !jobArg) return { enabled: false };
  if (!designArg || !jobArg) throw new Error('defiant-warrant pilot requires design and job together');
  const loaded = loadTutorStubDefiantWarrantDesign({ designPath: designArg, root });
  const design = loaded.design;
  const plan = buildTutorStubDefiantWarrantPlan(design);
  const job = plan.jobs.find((row) => row.id === jobArg);
  if (!job) throw new Error(`defiant-warrant job ${jobArg} is not in the registered plan`);
  const drift = [];
  if (!autoLearnerEnabled) drift.push('auto learner disabled');
  if (Number(autoTurns) !== design.execution.autoTurns) drift.push('auto turns');
  if (args['auto-learner-profile'] !== design.execution.autoLearnerProfile) drift.push('learner profile');
  if (args.world !== design.execution.world) drift.push('world');
  if (args['dag-mode'] !== design.execution.dagMode) drift.push('dag mode');
  if (args['register-policy'] !== design.execution.registerPolicy) drift.push('register policy');
  if (args['register-palette'] !== design.execution.registerPalette) drift.push('register palette');
  if (Number(args['model-call-budget']) !== design.execution.maximumReservationsPerDialogue) {
    drift.push('per-dialogue budget');
  }
  for (const key of ['model', 'classifier-model', 'learner-record-model', 'auto-learner-model']) {
    if (args[key] !== LUNA) drift.push(key);
  }
  if (args['cli-effort'] !== design.models.cliEffort) drift.push('cli effort');
  if (Number(args['run-seed']) !== job.run_seed) drift.push('run seed');
  if (args['acknowledge-research-use'] !== true) drift.push('research-use acknowledgement');
  if (drift.length) {
    throw new Error(`defiant-warrant launch pins drifted from the registered design: ${drift.join(', ')}`);
  }
  const conductCard = tutorStubDefiantWarrantConductCard(design, job.assigned_arm);
  state.defiantWarrantOutcomeStudy = {
    enabled: true,
    study_id: design.studyId,
    job_id: job.id,
    block_id: job.block_id,
    assigned_arm: job.assigned_arm,
    conduct_card: conductCard,
    design_path: loaded.relativePath,
    design_sha256: loaded.sha256,
    assignment_sha256: plan.assignment_sha256,
  };
  if (typeof appendTraceEvent === 'function') {
    appendTraceEvent(state.trace, {
      type: 'defiant_warrant_outcome_execution_start',
      study_id: design.studyId,
      job_id: job.id,
      block_id: job.block_id,
      assigned_arm: job.assigned_arm,
      run_seed: job.run_seed,
      design_path: loaded.relativePath,
      design_sha256: loaded.sha256,
      assignment_sha256: plan.assignment_sha256,
      conduct_card_sha256: sha256(conductCard),
      publicTranscriptChanged: false,
    });
  }
  return { enabled: true, job, design: loaded };
}

export default {
  TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS,
  TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  TUTOR_STUB_DEFIANT_WARRANT_DESIGN_SCHEMA,
  buildTutorStubDefiantWarrantPlan,
  configureTutorStubDefiantWarrantFromCli,
  loadTutorStubDefiantWarrantDesign,
  tutorStubDefiantWarrantConductCard,
  validateTutorStubDefiantWarrantDesign,
};
