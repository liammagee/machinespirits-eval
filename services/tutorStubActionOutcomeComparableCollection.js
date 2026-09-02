import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalActionOutcomeEligibleSet } from './adaptiveTutor/actionOutcomeComparability.js';
import { TUTOR_STUB_MOVE_FAMILIES } from './adaptiveTutor/tutorStubActionAdapter.js';
import { loadWorld } from './dramaticDerivation/world.js';
import {
  requiredTutorStubArtifactArchiveArgs,
  resolveTutorStubArtifactArchiveDirectory,
} from './tutorStubArtifactArchive.js';
import {
  probeTutorStubResistantLearnerCliRoute,
  smokeTutorStubResistantLearnerProtocolV2Role,
} from './tutorStubResistantLearnerLaunchProtocolV2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LUNA = 'codex.gpt-5.6-luna';
const COLLECTION_WORLDS = Object.freeze([
  'world_022_foxtrot_jukebox',
  'world_026_skyway_bakery',
  'world_028_larkspur_fridge',
  'world_029_riverside_clinic',
]);
const HELD_OUT_WORLDS = Object.freeze(['world_030_rowan_flat', 'world_031_tideway_makerspace']);
const COMPARABLE_FAMILIES = Object.freeze(['explain_model', 'minimal_support', 'request_self_explanation']);

export const TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH =
  'config/tutor-stub-action-outcome-comparable-collection-design.v2.json';
export const TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_STUDY_ID =
  'tutor-stub-action-outcome-comparable-collection-v2';
export const TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_PREFLIGHT_SCHEMA =
  'machinespirits.tutor-stub.action-outcome-comparable-collection-preflight.v2';

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
  return new Set(
    fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => loadWorld(path.join(directory, name)).id),
  );
}

function expectedJobs() {
  return COLLECTION_WORLDS.flatMap((worldId) => {
    const short = worldId.replace(/^world_\d+_/u, '');
    return Array.from({ length: 15 }, (_, index) => ({
      jobId: `aocv2_${short}_r${String(index + 1).padStart(2, '0')}`,
      worldId,
      repeat: index + 1,
    }));
  });
}

function designIssues(design, { root }) {
  const issues = [];
  const commonArguments = design?.launchConfiguration?.requiredCommonArguments || [];
  const commonTokens = commonArguments.flatMap(argumentTokens);
  const expectedEligibleSet = canonicalActionOutcomeEligibleSet(COMPARABLE_FAMILIES);
  const expectedDestinations = {
    liveRoot: '.tutor-stub-auto-eval/action-outcome-comparable-collection-v2-2026-09-02',
    packetRoot: '.tutor-stub-auto-eval/action-outcome-comparable-collection-v2-2026-09-02-human-packet',
    comparisonRoot: '.tutor-stub-auto-eval/action-outcome-comparable-collection-v2-2026-09-02-human-comparison',
    readinessRoot: '.tutor-stub-auto-eval/action-outcome-comparable-collection-v2-2026-09-02-readiness',
  };
  if (design?.documentType !== 'prospective_paid_study_design') issues.push('document type');
  if (design?.revision !== 2 || design?.studyId !== TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_STUDY_ID) {
    issues.push('design identity');
  }
  if (design?.status !== 'prospective_design_only_no_call_authority') issues.push('design status');
  if (design?.callAuthority?.grantsModelCalls !== false || design?.callAuthority?.grantsLaunch !== false) {
    issues.push('call authority');
  }
  if (design?.design?.dialogues !== 60 || design?.design?.turnHorizon !== 8 || design?.design?.fixedHorizon !== true) {
    issues.push('fixed dialogue plan');
  }
  if (JSON.stringify(design?.population?.collectionWorlds) !== JSON.stringify(COLLECTION_WORLDS)) {
    issues.push('collection worlds');
  }
  if (
    JSON.stringify(design?.population?.laterEvaluationWorldsExcludedFromCollectionAndMemory) !==
    JSON.stringify(HELD_OUT_WORLDS)
  ) {
    issues.push('held-out worlds');
  }
  const catalog = worldCatalog(root);
  if ([...COLLECTION_WORLDS, ...HELD_OUT_WORLDS].some((worldId) => !catalog.has(worldId))) {
    issues.push('world catalog');
  }
  if (JSON.stringify(design?.randomization?.jobs) !== JSON.stringify(expectedJobs())) issues.push('job schedule');
  if (design?.randomization?.masterSeed !== 2026090201) issues.push('master seed');
  if (design?.population?.learnerProfile !== 'bored') issues.push('learner profile');
  if (design?.typedActionAssignment?.mode !== 'uniform_family_eligible') issues.push('assignment mode');
  if (JSON.stringify(design?.typedActionAssignment?.moveFamilies) !== JSON.stringify(TUTOR_STUB_MOVE_FAMILIES)) {
    issues.push('move-family registry');
  }
  if (
    design?.comparability?.minimumFamilies !== 2 ||
    design?.comparability?.eligibleSetId !== expectedEligibleSet.id ||
    JSON.stringify(design?.comparability?.moveFamilies) !== JSON.stringify(COMPARABLE_FAMILIES) ||
    JSON.stringify(design?.comparability?.auditOnlyMoveFamilies) !==
      JSON.stringify(['diagnose_elicit', 'fade_transfer'])
  ) {
    issues.push('comparability contract');
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
    design?.models?.cliEffort !== 'low' ||
    design?.humanReview?.measurementPolicy !== 'human_consensus_auxiliary_veto_v2'
  ) {
    issues.push('model or measurement routes');
  }
  for (const flag of [
    '--auto-learner',
    '--no-auto-stop-on-grounded',
    '--dag',
    '--tutor-learner-dag',
    '--typed-actions',
    '--safe-registers',
    '--no-light-adaptation',
    '--no-training-reuse',
    '--acknowledge-research-use',
  ]) {
    if (!commonTokens.includes(flag)) issues.push(`missing flag ${flag}`);
  }
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
    '--run-seed': '2026090201',
  };
  for (const [option, expected] of Object.entries(requiredValues)) {
    try {
      if (String(oneOption(commonTokens, option)) !== expected) issues.push(`option ${option}`);
    } catch {
      issues.push(`option ${option}`);
    }
  }
  if (
    design?.attemptCeiling?.normalPlannedCallsPerDialogue !== 25 ||
    design?.attemptCeiling?.plannedCalls !== 1500 ||
    design?.attemptCeiling?.maximumReservationsPerPlannedCall !== 3 ||
    design?.attemptCeiling?.perDialogueTechnicalHeadroomReservations !== 6 ||
    design?.attemptCeiling?.maximumReservationsPerDialogue !== 81 ||
    design?.attemptCeiling?.hardMaximumReservations !== 4860
  ) {
    issues.push('attempt ceiling arithmetic');
  }
  if (design?.destinations?.createOnce !== true) issues.push('create-once destinations');
  for (const [key, expected] of Object.entries(expectedDestinations)) {
    if (design?.destinations?.[key] !== expected) issues.push(`destination ${key}`);
  }
  return [...new Set(issues)];
}

export function loadTutorStubActionOutcomeComparableCollectionDesign({
  root = ROOT,
  designPath = TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH,
} = {}) {
  if (designPath !== TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH) {
    throw new Error('comparable collection design path is not registered');
  }
  const resolved = repositoryRelative(root, designPath);
  const design = JSON.parse(fs.readFileSync(resolved.absolutePath, 'utf8'));
  const issues = designIssues(design, { root });
  if (issues.length) throw new Error(`invalid comparable action-outcome collection design: ${issues.join(', ')}`);
  return { root: path.resolve(root), path: resolved.absolutePath, relativePath: resolved.relativePath, design };
}

export function tutorStubActionOutcomeComparableCollectionRouteTable(design) {
  const route = (role, transportRole) => ({
    study: TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_STUDY_ID,
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

export async function runTutorStubActionOutcomeComparableCollectionPreflight({
  loaded,
  destination = path.resolve(loaded.root, loaded.design.destinations.liveRoot),
  recovery = false,
  destinationExists = fs.existsSync,
  resolveArchive = resolveTutorStubArtifactArchiveDirectory,
  archiveIsWritable = (directory) => {
    if (!directory) return false;
    try {
      fs.accessSync(directory, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
  buildPlan,
} = {}) {
  if (typeof buildPlan !== 'function')
    throw new Error('comparable collection preflight requires the shared plan builder');
  const plan = buildPlan({ loaded, destination, recovery });
  const routeTable = tutorStubActionOutcomeComparableCollectionRouteTable(loaded.design);
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
  const registeredDestinationsMatchLaunchKind = recovery
    ? destinationAvailability.liveRoot === false &&
      ['packetRoot', 'comparisonRoot', 'readinessRoot'].every((key) => destinationAvailability[key])
    : Object.values(destinationAvailability).every(Boolean);
  const archiveDirectory = resolveArchive(null, { cwd: loaded.root, repoRoot: loaded.root });
  const archiveWritable = archiveIsWritable(archiveDirectory);
  const checks = {
    design_loaded: loaded.design.studyId === TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_STUDY_ID,
    full_plan_job_count: plan.jobs.length === 60,
    worlds_balanced: COLLECTION_WORLDS.every(
      (worldId) => plan.jobs.filter((job) => job.world_id === worldId).length === 15,
    ),
    job_ids_unique: new Set(plan.jobs.map((job) => job.id)).size === 60,
    commands_compile: plan.jobs.every(
      (job) =>
        oneOption(job.args, '--world') === job.world_id &&
        oneOption(job.args, '--eval-job-id') === job.id &&
        oneOption(job.args, '--model-call-budget') === '81' &&
        oneOption(job.args, '--typed-action-assignment') === 'uniform_family_eligible',
    ),
    comparable_set_fixed:
      loaded.design.comparability.eligibleSetId === canonicalActionOutcomeEligibleSet(COMPARABLE_FAMILIES).id,
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    private_archive_available: Boolean(archiveDirectory),
    private_archive_writable: archiveWritable,
    registered_destinations_match_launch_kind: registeredDestinationsMatchLaunchKind,
    selected_destination_absent: !destinationExists(path.resolve(destination)),
    planned_calls_match_design: plan.planned_model_calls === 1500,
    attempt_ceiling_matches_design: plan.model_attempt_ceiling === 4860,
    memory_controller_disabled: plan.memory_controller_enabled === false,
    held_out_worlds_excluded: plan.jobs.every((job) => !HELD_OUT_WORLDS.includes(job.world_id)),
    grants_no_model_calls:
      loaded.design.callAuthority.grantsModelCalls === false && loaded.design.callAuthority.grantsLaunch === false,
  };
  return {
    schema: TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_PREFLIGHT_SCHEMA,
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    design_path: loaded.relativePath,
    destination: path.resolve(destination),
    registered_destinations: destinations,
    destination_availability: destinationAvailability,
    private_archive_directory: archiveDirectory,
    archive_args: requiredTutorStubArtifactArchiveArgs(),
    route_table: routeTable,
    route_probes: routeProbes,
    role_smokes: roleSmokes,
    plan,
    checks,
    model_calls_executed: 0,
    production_writes: 0,
  };
}
