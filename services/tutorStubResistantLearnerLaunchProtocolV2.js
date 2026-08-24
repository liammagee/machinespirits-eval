import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { createTutorStubPromptTransport } from './tutorStubPromptTransport.js';
import {
  buildTutorStubResistantLearnerCalibrationPlan,
  runTutorStubResistantLearnerCompilationPreflight,
} from './tutorStubResistantLearnerCalibration.js';
import { mintTutorStubRivalLearnerDag } from './tutorStubRivalLearnerDag.js';

export const TUTOR_STUB_RESISTANT_LEARNER_APPROVAL_SCHEMA =
  'machinespirits.tutor-stub.resistant-learner-typed-approval.v2';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function studyCode(design) {
  return design.studyId.includes('-b1-') ? 'B1' : 'R1';
}

function routeRow({ study, role, transportRole, route }) {
  return {
    study,
    role,
    transportRole,
    modelRef: route.modelRef,
    provider: route.provider,
    model: route.model,
    effort: route.effort,
  };
}

function coreRoute(design, key) {
  const modelRef = design.models[key];
  if (modelRef !== 'codex.gpt-5.6-luna') throw new Error(`unsupported protocol-v2 ${key} route ${modelRef}`);
  return { modelRef, provider: 'codex', model: 'gpt-5.6-luna', effort: design.models.cliEffort };
}

export function tutorStubResistantLearnerProtocolV2RouteTable(entries) {
  return entries.flatMap(({ loaded }) => {
    const design = loaded.design;
    const study = studyCode(design);
    const rows = [
      routeRow({ study, role: 'tutor', transportRole: 'tutor_stub_tutor', route: coreRoute(design, 'tutor') }),
      routeRow({
        study,
        role: 'analysis',
        transportRole: 'tutor_stub_learner_analysis',
        route: coreRoute(design, 'analysis'),
      }),
      routeRow({
        study,
        role: 'learner',
        transportRole: 'tutor_stub_auto_learner',
        route: coreRoute(design, 'learner'),
      }),
    ];
    for (const judge of design.models.triggerObservation.judges) {
      rows.push(
        routeRow({
          study,
          role: `trigger.${judge.id}`,
          transportRole:
            study === 'B1' && design.schema === 'machinespirits.tutor-stub.resistant-learner-study-design.v3'
              ? 'tutor_stub_resistant_learner_rival_attention_judge'
              : study === 'B1'
                ? `tutor_stub_boredom_semantic_${judge.id}`
                : `tutor_stub_resistance_semantic_${judge.id}`,
          route: judge,
        }),
      );
    }
    for (const judge of design.models.finalSemanticReaders) {
      for (const instrument of ['primary', 'fidelity']) {
        rows.push(
          routeRow({
            study,
            role: `final.${instrument}.${judge.id}`,
            transportRole: `tutor_stub_resistant_learner_${study}_${instrument}_${judge.id}`,
            route: judge,
          }),
        );
      }
    }
    return rows;
  });
}

export function probeTutorStubResistantLearnerCliRoute(route, { spawn = spawnSync } = {}) {
  const binary = route.provider === 'claude-code' ? 'claude' : route.provider === 'codex' ? 'codex' : null;
  if (!binary) return { ...route, status: 'failed', issue: 'unsupported_provider', model_calls: 0 };
  const result = spawn(binary, ['--version'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 256 * 1024,
  });
  const version = String(result?.stdout || result?.stderr || '').trim() || null;
  return {
    ...route,
    binary,
    status: !result?.error && result?.status === 0 ? 'passed_zero_call' : 'failed',
    version,
    issue: result?.error?.message || (result?.status === 0 ? null : `exit_${result?.status ?? 'unknown'}`),
    model_calls: 0,
  };
}

function stubTransport({ bridge, trace }) {
  return createTutorStubPromptTransport({
    C: {},
    appendTraceEvent(_target, event) {
      trace.push(event);
    },
    auditTutorStubPrompt() {
      return { ok: true, violations: [], duplicateInstructionLines: [] };
    },
    callAI() {
      throw new Error('protocol-v2 smoke attempted a non-CLI route');
    },
    callAIWithCliBridge: bridge,
    clearStatusLine() {},
    compactTutorStubPublicMessagesForBudget(messages) {
      return { applied: false, messages };
    },
    createTutorStubConsoleTokenSink() {},
    effectiveTemperatureForModel() {
      return 0;
    },
    getInterimState() {
      return null;
    },
    isCliProvider() {
      return true;
    },
    providerSupportsStreaming() {
      return false;
    },
    recoverTutorStubDuplicateInstructionLines({ texts }) {
      return { applied: false, texts, removedLines: [] };
    },
    renderTutorStubStreamLabel() {
      return '';
    },
    replayTutorStubTextAsConsoleStream() {},
    reserveProgram2ProviderBudget() {},
    reserveTutorStubMeteredModelCall() {},
    stopInterimAnimation() {},
    streamAI() {},
    tutorStubCliPolicyRetryDecision() {
      return { retry: false };
    },
    tutorStubPromptSurfaceForRole(role) {
      return role;
    },
    waitTutorStubCliPolicyRetryDelay() {},
    write() {},
  });
}

export async function smokeTutorStubResistantLearnerProtocolV2Role(route) {
  let bridgeCalls = 0;
  const trace = [];
  const semantic =
    route.transportRole.startsWith('tutor_stub_resistance_semantic_') ||
    route.transportRole.startsWith('tutor_stub_resistant_learner_');
  const outputSchema = semantic ? { type: 'object', additionalProperties: false, properties: {} } : null;
  const transport = stubTransport({
    trace,
    async bridge(resolved, _systemPrompt, _prompt, role, options) {
      bridgeCalls += 1;
      if (role !== route.transportRole || resolved.provider !== route.provider || resolved.model !== route.model) {
        throw new Error('protocol-v2 stub role route drift');
      }
      if (semantic && options.outputSchema !== outputSchema) {
        throw new Error('protocol-v2 stub output schema drift');
      }
      return {
        text: '{}',
        provider: route.provider,
        model: route.model,
        effort: route.effort,
        structuredOutput: semantic,
        prohibitedToolEventCount: 0,
        modelAttestationBasis: 'protocol_v2_local_stub',
        modelIndependentlyAttested: false,
      };
    },
  });
  const result = await transport.callPromptModel({
    prompt: 'protocol-v2 local stub smoke',
    messageHistory: [],
    resolved: { provider: route.provider, model: route.model },
    systemPrompt: 'Local transport smoke. No provider call.',
    role: route.transportRole,
    maxTokens: 1,
    trace,
    effort: route.effort,
    cliEffort: route.effort,
    outputSchema,
    turn: 0,
  });
  const passed =
    bridgeCalls === 1 &&
    result.provider === route.provider &&
    result.model === route.model &&
    (!semantic ||
      (result.structuredOutput === true &&
        result.prohibitedToolEventCountObserved === true &&
        result.prohibitedToolEventCount === 0));
  return {
    study: route.study,
    role: route.role,
    transport_role: route.transportRole,
    model_ref: route.modelRef,
    status: passed ? 'passed_zero_call_stub' : 'failed',
    stub_bridge_calls: bridgeCalls,
    provider_model_calls: 0,
    structured_output_checked: semantic,
  };
}

export async function runTutorStubResistantLearnerProtocolV2Preflight({
  entries,
  root,
  destination,
  destinationExists,
  probeRoute = probeTutorStubResistantLearnerCliRoute,
  smokeRole = smokeTutorStubResistantLearnerProtocolV2Role,
} = {}) {
  const routeTable = tutorStubResistantLearnerProtocolV2RouteTable(entries);
  const uniqueRoutes = [...new Map(routeTable.map((route) => [`${route.modelRef}:${route.effort}`, route])).values()];
  const routeProbes = uniqueRoutes.map((route) => probeRoute(route));
  const roleSmokes = [];
  for (const route of routeTable) roleSmokes.push(await smokeRole(route));
  const studies = entries.map(({ loaded, plan }) => {
    const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded, root });
    const rivalDags = plan.jobs.map((job) => mintTutorStubRivalLearnerDag({ design: loaded.design, job, root }));
    return {
      study: studyCode(loaded.design),
      study_id: loaded.design.studyId,
      design_path: loaded.relativePath,
      design_sha256: loaded.sha256,
      jobs: plan.jobs.length,
      planned_role_calls: plan.jobs.length * loaded.design.attemptCeilings.plannedCallsPerDialogue,
      hard_attempt_ceiling: loaded.design.attemptCeilings.calibrationMaximumReservations,
      assignment_sha256: plan.assignment_sha256,
      compilation,
      rival_dag_count: rivalDags.length,
      rival_dag_set_sha256: sha256(rivalDags.map((dag) => dag.sha256).join('\n')),
    };
  });
  const plannedRoleCalls = studies.reduce((sum, study) => sum + study.planned_role_calls, 0);
  const hardAttemptCeiling = studies.reduce((sum, study) => sum + study.hard_attempt_ceiling, 0);
  const checks = {
    designs_are_v2_or_v3: entries.every(({ loaded }) =>
      [
        'machinespirits.tutor-stub.resistant-learner-study-design.v2',
        'machinespirits.tutor-stub.resistant-learner-study-design.v3',
      ].includes(loaded.design.schema),
    ),
    compilation_passed: studies.every((study) => study.compilation.status === 'passed_zero_call'),
    route_probes_passed: routeProbes.every((probe) => probe.status === 'passed_zero_call'),
    role_smokes_passed: roleSmokes.every((smoke) => smoke.status === 'passed_zero_call_stub'),
    destination_absent: destinationExists(destination) === false,
    planned_calls_within_ceiling: plannedRoleCalls <= hardAttemptCeiling,
  };
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-launch-preflight.v2',
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    destination,
    studies,
    route_table: routeTable,
    route_probes: routeProbes,
    role_smokes: roleSmokes,
    jobs: studies.reduce((sum, study) => sum + study.jobs, 0),
    planned_role_calls: plannedRoleCalls,
    hard_attempt_ceiling: hardAttemptCeiling,
    checks,
    model_calls_executed: 0,
    production_writes: 0,
  };
}

export function buildTutorStubResistantLearnerTypedApproval({
  signedBy,
  approvalPhrase,
  sourceCommit,
  sourceTree,
  dirty,
  preflight,
  approvedAt = new Date().toISOString(),
} = {}) {
  const expectedPhrase = `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  if (!String(signedBy || '').trim()) throw new Error('typed approval requires the operator name');
  if (approvalPhrase !== expectedPhrase) throw new Error(`typed approval must be exactly: ${expectedPhrase}`);
  return {
    schema: TUTOR_STUB_RESISTANT_LEARNER_APPROVAL_SCHEMA,
    approved_by: String(signedBy).trim(),
    approved_at: approvedAt,
    typed_phrase: approvalPhrase,
    scope: 'combined B1 and R1 resistant-learner calibration only',
    source: { commit: sourceCommit, tree: sourceTree, dirty: Boolean(dirty), enforcement: 'recorded_not_pinned' },
    designs: preflight.studies.map((study) => ({
      study_id: study.study_id,
      path: study.design_path,
      sha256: study.design_sha256,
    })),
    routes: preflight.route_table.map(({ study, role, modelRef, provider, model, effort }) => ({
      study,
      role,
      modelRef,
      provider,
      model,
      effort,
    })),
    destination: preflight.destination,
    jobs: preflight.jobs,
    planned_role_calls: preflight.planned_role_calls,
    hard_attempt_ceiling: preflight.hard_attempt_ceiling,
    create_once: true,
    attended: true,
    calibration_only: true,
    powered_run_authorized: false,
  };
}

export function buildTutorStubResistantLearnerProtocolV2Entries(loadedEntries) {
  return loadedEntries.map((loaded) => ({
    loaded,
    plan: buildTutorStubResistantLearnerCalibrationPlan(loaded.design),
  }));
}

export default {
  buildTutorStubResistantLearnerTypedApproval,
  runTutorStubResistantLearnerProtocolV2Preflight,
  tutorStubResistantLearnerProtocolV2RouteTable,
};
