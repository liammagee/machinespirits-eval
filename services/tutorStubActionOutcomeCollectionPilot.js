import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadWorld } from './dramaticDerivation/world.js';
import {
  requiredTutorStubArtifactArchiveArgs,
  resolveTutorStubArtifactArchiveDirectory,
} from './tutorStubArtifactArchive.js';
import {
  probeTutorStubResistantLearnerCliRoute,
  smokeTutorStubResistantLearnerProtocolV2Role,
} from './tutorStubResistantLearnerLaunchProtocolV2.js';
import { TUTOR_STUB_MOVE_FAMILIES } from './adaptiveTutor/tutorStubActionAdapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LUNA = 'codex.gpt-5.6-luna';

export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_DESIGN_PATH =
  'config/tutor-stub-action-outcome-collection-pilot-design.v1.json';
export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_STUDY_ID = 'tutor-stub-action-outcome-collection-pilot-v1';
export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_PLAN_SCHEMA =
  'machinespirits.tutor-stub.action-outcome-collection-plan.v1';
export const TUTOR_STUB_ACTION_OUTCOME_COLLECTION_PREFLIGHT_SCHEMA =
  'machinespirits.tutor-stub.action-outcome-collection-preflight.v1';

function repositoryRelative(root, value) {
  if (!value || path.isAbsolute(value)) throw new Error('design path must be repository-relative');
  const absolutePath = path.resolve(root, value);
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('design path must stay inside the repository');
  }
  return { absolutePath, relativePath: relativePath.split(path.sep).join('/') };
}

function argumentTokens(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('--')) throw new Error(`invalid registered launch argument: ${JSON.stringify(value)}`);
  return text.split(/\s+/u);
}

function optionValues(args, option) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === option) values.push(args[index + 1] ?? true);
  }
  return values;
}

function oneOption(args, option) {
  const values = optionValues(args, option);
  if (values.length !== 1) throw new Error(`compiled command requires exactly one ${option}`);
  return values[0];
}

function worldCatalog(root) {
  const directory = path.join(root, 'config', 'drama-derivation');
  return new Map(
    fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => {
        const source = path.join(directory, name);
        const world = loadWorld(source);
        return [world.id, { source, world }];
      }),
  );
}

function expectedTaskId(design, worldId) {
  return design.taskContract.taskIdRule.replace('<world-id>', worldId);
}

function designIssues(design, { root }) {
  const issues = [];
  const jobs = design?.randomization?.jobs || [];
  const collectionWorlds = design?.population?.collectionWorlds || [];
  const evaluationWorlds = design?.population?.laterEvaluationWorldsExcludedFromCollectionAndMemory || [];
  const commonArguments = design?.launchConfiguration?.requiredCommonArguments || [];
  const commonTokens = commonArguments.flatMap(argumentTokens);
  if (design?.documentType !== 'prospective_paid_study_design') issues.push('document type');
  if (design?.revision !== 1 || design?.studyId !== TUTOR_STUB_ACTION_OUTCOME_COLLECTION_STUDY_ID) {
    issues.push('design identity');
  }
  if (design?.status !== 'prospective_design_only_no_call_authority') issues.push('design status');
  if (design?.callAuthority?.grantsModelCalls !== false || design?.callAuthority?.grantsLaunch !== false) {
    issues.push('call authority');
  }
  if (design?.design?.dialogues !== 24 || design?.design?.turnHorizon !== 8 || design?.design?.fixedHorizon !== true) {
    issues.push('fixed dialogue plan');
  }
  if (collectionWorlds.length !== 4 || evaluationWorlds.length !== 2) issues.push('world split');
  if (collectionWorlds.some((worldId) => evaluationWorlds.includes(worldId))) issues.push('world overlap');
  const catalog = worldCatalog(root);
  for (const worldId of [...collectionWorlds, ...evaluationWorlds]) {
    if (!catalog.has(worldId)) issues.push(`missing world ${worldId}`);
  }
  if (jobs.length !== 24 || new Set(jobs.map((job) => job.jobId)).size !== jobs.length) issues.push('job identities');
  for (const worldId of collectionWorlds) {
    const rows = jobs.filter((job) => job.worldId === worldId);
    if (rows.length !== 6 || rows.some((job, index) => job.repeat !== index + 1)) {
      issues.push(`world allocation ${worldId}`);
    }
  }
  if (jobs.some((job) => !collectionWorlds.includes(job.worldId))) issues.push('job world scope');
  if (design?.randomization?.masterSeed !== 2026090101) issues.push('master seed');
  if (design?.population?.learnerProfile !== 'bored') issues.push('learner profile');
  if (design?.typedActionAssignment?.mode !== 'uniform_family_eligible') issues.push('assignment mode');
  if (JSON.stringify(design?.typedActionAssignment?.moveFamilies) !== JSON.stringify(TUTOR_STUB_MOVE_FAMILIES)) {
    issues.push('move-family registry');
  }
  if (
    design?.typedActionAssignment?.fixedSupportLevel !== 1 ||
    design?.typedActionAssignment?.registerPolicy !== 'bland' ||
    design?.typedActionAssignment?.lightAdaptation !== false ||
    design?.typedActionAssignment?.memoryControllerEnabled !== false
  ) {
    issues.push('held treatment axes');
  }
  if (
    design?.models?.tutor !== LUNA ||
    design?.models?.automatedLearner !== LUNA ||
    design?.models?.learnerClassifier !== LUNA ||
    design?.models?.learnerRecordAndDag !== LUNA ||
    design?.models?.cliEffort !== 'low'
  ) {
    issues.push('model routes');
  }
  const requiredFlags = [
    '--auto-learner',
    '--no-auto-stop-on-grounded',
    '--dag',
    '--tutor-learner-dag',
    '--typed-actions',
    '--safe-registers',
    '--no-light-adaptation',
    '--no-training-reuse',
    '--acknowledge-research-use',
  ];
  for (const flag of requiredFlags) if (!commonTokens.includes(flag)) issues.push(`missing flag ${flag}`);
  const requiredValues = {
    '--all-models': LUNA,
    '--cli-effort': 'low',
    '--auto-learner-profile': 'bored',
    '--auto-turns': '8',
    '--dag-mode': 'strict_dag',
    '--typed-action-assignment': 'uniform_family_eligible',
    '--typed-action-support-level': '1',
    '--register-policy': 'bland',
    '--loop-mode': 'strict',
    '--model-call-budget': '81',
    '--run-seed': '2026090101',
  };
  for (const [option, expected] of Object.entries(requiredValues)) {
    try {
      if (String(oneOption(commonTokens, option)) !== expected) issues.push(`option ${option}`);
    } catch {
      issues.push(`option ${option}`);
    }
  }
  const attempts = design?.attemptCeiling || {};
  const plannedCalls = jobs.length * attempts.normalPlannedCallsPerDialogue;
  const hardMaximum =
    jobs.length *
    (attempts.normalPlannedCallsPerDialogue * attempts.maximumReservationsPerPlannedCall +
      attempts.perDialogueTechnicalHeadroomReservations);
  if (
    attempts.normalPlannedCallsPerDialogue !== 25 ||
    attempts.maximumReservationsPerDialogue !== 81 ||
    attempts.plannedCalls !== plannedCalls ||
    attempts.hardMaximumReservations !== hardMaximum ||
    hardMaximum !== 1944
  ) {
    issues.push('attempt ceiling arithmetic');
  }
  if (design?.destinations?.createOnce !== true) issues.push('create-once destinations');
  for (const key of ['liveRoot', 'packetRoot', 'comparisonRoot', 'readinessRoot']) {
    const value = design?.destinations?.[key];
    if (!value || path.isAbsolute(value) || path.relative(root, path.resolve(root, value)).startsWith('..')) {
      issues.push(`destination ${key}`);
    }
  }
  return [...new Set(issues)];
}

export function loadTutorStubActionOutcomeCollectionDesign({
  root = ROOT,
  designPath = TUTOR_STUB_ACTION_OUTCOME_COLLECTION_DESIGN_PATH,
} = {}) {
  const resolved = repositoryRelative(root, designPath);
  const design = JSON.parse(fs.readFileSync(resolved.absolutePath, 'utf8'));
  const issues = designIssues(design, { root });
  if (issues.length) throw new Error(`invalid action-outcome collection design: ${issues.join(', ')}`);
  return { root: path.resolve(root), path: resolved.absolutePath, relativePath: resolved.relativePath, design };
}

export function tutorStubActionOutcomeCollectionRouteTable(design) {
  const route = (role, transportRole) => ({
    study: TUTOR_STUB_ACTION_OUTCOME_COLLECTION_STUDY_ID,
    role,
    transportRole,
    modelRef: LUNA,
    provider: 'codex',
    model: 'gpt-5.6-luna',
    effort: design.models.cliEffort,
  });
  return [
    route('tutor', 'tutor_stub_tutor'),
    route('learner_analysis', 'tutor_stub_learner_analysis'),
    route('automated_learner', 'tutor_stub_auto_learner'),
  ];
}

function commonArgs(design) {
  return design.launchConfiguration.requiredCommonArguments.flatMap(argumentTokens);
}

export function compileTutorStubActionOutcomeCollectionJob({ loaded, job, destination }) {
  const { design, root } = loaded;
  if (!path.isAbsolute(destination)) throw new Error('collection destination must be absolute');
  const registeredDestination = path.resolve(root, design.destinations.liveRoot);
  if (path.resolve(destination) !== registeredDestination) {
    throw new Error(`collection destination must equal registered live root ${registeredDestination}`);
  }
  const jobRoot = path.join(registeredDestination, 'jobs', job.jobId);
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  const relativeTrace = path.relative(root, traceDir);
  const relativeTranscript = path.relative(root, transcript);
  if ([relativeTrace, relativeTranscript].some((value) => value.startsWith('..') || path.isAbsolute(value))) {
    throw new Error('collection job outputs must stay inside the repository');
  }
  const taskId = expectedTaskId(design, job.worldId);
  const args = [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    ...requiredTutorStubArtifactArchiveArgs(),
    ...commonArgs(design),
    '--world',
    job.worldId,
    '--typed-action-task-id',
    taskId,
    '--eval-repeat',
    String(job.repeat),
    '--eval-job-id',
    job.jobId,
    '--trace-dir',
    relativeTrace.split(path.sep).join('/'),
    '--save',
    relativeTranscript.split(path.sep).join('/'),
  ];
  return {
    id: job.jobId,
    world_id: job.worldId,
    repeat: job.repeat,
    run_seed: design.randomization.masterSeed,
    task_id: taskId,
    job_root: jobRoot,
    trace_dir: traceDir,
    transcript,
    planned_model_calls: design.attemptCeiling.normalPlannedCallsPerDialogue,
    model_attempt_ceiling: design.attemptCeiling.maximumReservationsPerDialogue,
    args,
  };
}

export function buildTutorStubActionOutcomeCollectionPlan({ loaded, destination } = {}) {
  const jobs = loaded.design.randomization.jobs.map((job) =>
    compileTutorStubActionOutcomeCollectionJob({ loaded, job, destination }),
  );
  return {
    schema: TUTOR_STUB_ACTION_OUTCOME_COLLECTION_PLAN_SCHEMA,
    study_id: loaded.design.studyId,
    design_path: loaded.relativePath,
    destination: path.resolve(destination),
    jobs,
    planned_dialogues: jobs.length,
    planned_turns: jobs.length * loaded.design.design.turnHorizon,
    planned_model_calls: jobs.reduce((sum, job) => sum + job.planned_model_calls, 0),
    model_attempt_ceiling: jobs.reduce((sum, job) => sum + job.model_attempt_ceiling, 0),
    held_out_worlds: [...loaded.design.population.laterEvaluationWorldsExcludedFromCollectionAndMemory],
    memory_controller_enabled: false,
  };
}

export async function runTutorStubActionOutcomeCollectionPreflight({
  loaded,
  destination = path.resolve(loaded.root, loaded.design.destinations.liveRoot),
  destinationExists = fs.existsSync,
  resolveArchive = resolveTutorStubArtifactArchiveDirectory,
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
} = {}) {
  const plan = buildTutorStubActionOutcomeCollectionPlan({ loaded, destination });
  const routeTable = tutorStubActionOutcomeCollectionRouteTable(loaded.design);
  const uniqueProbeRoutes = [
    ...new Map(routeTable.map((route) => [`${route.provider}:${route.model}:${route.effort}`, route])).values(),
  ];
  const routeProbes = uniqueProbeRoutes.map((route) => probeRoute(route));
  const roleSmokes = [];
  for (const route of routeTable) roleSmokes.push(await smokeRole(route));
  const destinations = Object.fromEntries(
    ['liveRoot', 'packetRoot', 'comparisonRoot', 'readinessRoot'].map((key) => [
      key,
      path.resolve(loaded.root, loaded.design.destinations[key]),
    ]),
  );
  const destinationAvailability = Object.fromEntries(
    Object.entries(destinations).map(([key, value]) => [key, !destinationExists(value)]),
  );
  const archiveDirectory = resolveArchive(null, { cwd: loaded.root, repoRoot: loaded.root });
  const checks = {
    design_loaded: loaded.design.studyId === TUTOR_STUB_ACTION_OUTCOME_COLLECTION_STUDY_ID,
    full_plan_job_count: plan.jobs.length === loaded.design.design.dialogues,
    worlds_balanced: loaded.design.population.collectionWorlds.every(
      (worldId) => plan.jobs.filter((job) => job.world_id === worldId).length === 6,
    ),
    job_ids_unique: new Set(plan.jobs.map((job) => job.id)).size === plan.jobs.length,
    commands_compile: plan.jobs.every(
      (job) =>
        oneOption(job.args, '--world') === job.world_id &&
        oneOption(job.args, '--eval-job-id') === job.id &&
        oneOption(job.args, '--model-call-budget') === '81' &&
        oneOption(job.args, '--typed-action-assignment') === 'uniform_family_eligible',
    ),
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    private_archive_available: Boolean(archiveDirectory),
    all_registered_destinations_absent: Object.values(destinationAvailability).every(Boolean),
    planned_calls_match_design: plan.planned_model_calls === loaded.design.attemptCeiling.plannedCalls,
    attempt_ceiling_matches_design: plan.model_attempt_ceiling === loaded.design.attemptCeiling.hardMaximumReservations,
    memory_controller_disabled:
      plan.memory_controller_enabled === false && loaded.design.typedActionAssignment.memoryControllerEnabled === false,
    held_out_worlds_excluded: plan.jobs.every(
      (job) => !loaded.design.population.laterEvaluationWorldsExcludedFromCollectionAndMemory.includes(job.world_id),
    ),
    grants_no_model_calls:
      loaded.design.callAuthority.grantsModelCalls === false && loaded.design.callAuthority.grantsLaunch === false,
  };
  return {
    schema: TUTOR_STUB_ACTION_OUTCOME_COLLECTION_PREFLIGHT_SCHEMA,
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    design_path: loaded.relativePath,
    destination: path.resolve(destination),
    registered_destinations: destinations,
    destination_availability: destinationAvailability,
    private_archive_directory: archiveDirectory,
    route_table: routeTable,
    route_probes: routeProbes,
    role_smokes: roleSmokes,
    plan,
    checks,
    model_calls_executed: 0,
    production_writes: 0,
  };
}
