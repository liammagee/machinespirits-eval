import path from 'node:path';

import { loadWorld } from '../dramaticDerivation/world.js';
import { canonicalJson, hashCanonicalJson, sha256 } from '../experimentRunArtifacts.js';
import {
  adaptiveStateAnalyzerCallMetadata,
  validateAdaptiveStateCallMetadata,
} from './stateBenchmarkStage1Executor.js';
import {
  adaptiveStateTransitionAtomicSurface,
  isolateAdaptiveStatePublicRealizerInput,
} from './stateBenchmarkPublicSurface.js';
import { loadAdaptiveStateWorldAdapters } from './learnerKernels/index.js';

export const ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_PLAN_SCHEMA =
  'machinespirits.adaptive-state-observability-preflight-plan.v2.1';
export const ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_RESULT_SCHEMA =
  'machinespirits.adaptive-state-observability-preflight-result.v2.1';
export const ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_REPORT_SCHEMA =
  'machinespirits.adaptive-state-observability-preflight-report.v2.1';
export const ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_CALL_SCHEMA =
  'machinespirits.adaptive-state-observability-preflight-call.v2.1';

const VERSION = '2.1';
const FAMILIES = Object.freeze(['none', 'adopt', 'derive', 'retract']);
const FORBIDDEN_ANALYZER_KEY =
  /(?:^|_)(?:future|target|oracle|hidden|private|answer_key|event_family|event_ids|required_realizer_output|proof_transition)(?:_|$)/iu;
const ANALYZER_INPUT_KEYS = Object.freeze([
  'currentTutorText',
  'learnerText',
  'priorPublicLearnerState',
  'promptContext',
  'publicReleaseLedger',
  'publicStagedEvidence',
  'publicTranscript',
  'topic',
  'tutorTurn',
  'turn',
  'world',
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function withoutContentSha256(value) {
  const copy = clone(value);
  delete copy.content_sha256;
  return copy;
}

export function adaptiveStateObservabilityPreflightPlanContentSha256(plan) {
  return hashCanonicalJson(withoutContentSha256(plan));
}

export function adaptiveStateObservabilityPreflightResultContentSha256(result) {
  return hashCanonicalJson(withoutContentSha256(result));
}

export function adaptiveStateObservabilityPreflightReportContentSha256(report) {
  return hashCanonicalJson(withoutContentSha256(report));
}

function matrixJobs(config) {
  const worlds = config?.critical_path?.worlds || [];
  const realizers = config?.critical_path?.language_realizers || [];
  if (worlds.length !== 3 || realizers.length !== 2) {
    throw new Error('stateObservabilityPreflight: requires exactly three worlds and two language realizers');
  }
  const jobs = [];
  for (const [familyIndex, eventFamily] of FAMILIES.entries()) {
    for (const [worldIndex, world] of worlds.entries()) {
      const orderedRealizers = (familyIndex + worldIndex) % 2 === 0 ? realizers : [...realizers].reverse();
      for (const realizer of orderedRealizers) {
        jobs.push({
          id: `preflight__${world.id}__${eventFamily}__${realizer.id}`,
          world: clone(world),
          event_family: eventFamily,
          language_realizer: clone(realizer),
          claim_eligible: false,
          expected_realizer_dispatches: 1,
          expected_analyzer_dispatches: 1,
        });
      }
    }
  }
  return jobs;
}

export function buildAdaptiveStateObservabilityPreflightPlan(
  config,
  { label = 'adaptive-state-v2-observability-preflight-v21' } = {},
) {
  const worlds = config?.critical_path?.worlds || [];
  const realizers = config?.critical_path?.language_realizers || [];
  const jobs = matrixJobs(config);
  const plan = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_PLAN_SCHEMA,
    version: VERSION,
    label: String(label),
    stage: 's1_observability_preflight',
    paid: true,
    claim_eligible: false,
    confirmation_eligible: false,
    s2_validity_verdict: null,
    axes: {
      worlds: worlds.map((row) => row.id),
      event_families: [...FAMILIES],
      language_realizers: realizers.map((row) => row.id),
    },
    counts: {
      cases: 24,
      learner_realizer_cli_dispatches: 24,
      public_turn_analyzer_cli_dispatches: 24,
      total_cli_dispatches: 48,
      backend_request_count: 'unknown',
    },
    execution: {
      order: 'serial_fixed_balanced_matrix',
      retries: 0,
      semantic_rerolls: 0,
      repairs: 0,
      fallbacks: 0,
      exclusions: 0,
      partial_reuse: false,
    },
    pass_contract: {
      required_complete_cases: 24,
      required_exact_family_matches: 24,
      exact_nonempty_learner_text_evidence_span: true,
      exact_event_id_in_learner_text_forbidden: true,
      analyzer_structural_target_leak_forbidden: true,
      exact_one_dispatch_per_role_per_case: true,
    },
    jobs,
  };
  plan.content_sha256 = adaptiveStateObservabilityPreflightPlanContentSha256(plan);
  validateAdaptiveStateObservabilityPreflightPlan(plan, config);
  return plan;
}

export function validateAdaptiveStateObservabilityPreflightPlan(plan, config = null) {
  if (
    plan?.schema !== ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_PLAN_SCHEMA ||
    String(plan?.version) !== VERSION ||
    plan?.stage !== 's1_observability_preflight' ||
    plan?.paid !== true ||
    plan?.claim_eligible !== false ||
    plan?.confirmation_eligible !== false ||
    plan?.s2_validity_verdict !== null ||
    plan?.content_sha256 !== adaptiveStateObservabilityPreflightPlanContentSha256(plan)
  ) {
    throw new Error('stateObservabilityPreflight: invalid frozen plan envelope');
  }
  if (
    Number(plan.counts?.cases) !== 24 ||
    Number(plan.counts?.learner_realizer_cli_dispatches) !== 24 ||
    Number(plan.counts?.public_turn_analyzer_cli_dispatches) !== 24 ||
    Number(plan.counts?.total_cli_dispatches) !== 48 ||
    plan.counts?.backend_request_count !== 'unknown' ||
    !Array.isArray(plan.jobs) ||
    plan.jobs.length !== 24
  ) {
    throw new Error('stateObservabilityPreflight: plan must freeze exactly 24 cases and 48 CLI dispatches');
  }
  if (
    plan.execution?.order !== 'serial_fixed_balanced_matrix' ||
    Number(plan.execution?.retries) !== 0 ||
    Number(plan.execution?.semantic_rerolls) !== 0 ||
    Number(plan.execution?.repairs) !== 0 ||
    Number(plan.execution?.fallbacks) !== 0 ||
    Number(plan.execution?.exclusions) !== 0 ||
    plan.execution?.partial_reuse !== false
  ) {
    throw new Error('stateObservabilityPreflight: plan permits retries, repair, exclusion, or partial reuse');
  }
  const expectedPassContract = {
    required_complete_cases: 24,
    required_exact_family_matches: 24,
    exact_nonempty_learner_text_evidence_span: true,
    exact_event_id_in_learner_text_forbidden: true,
    analyzer_structural_target_leak_forbidden: true,
    exact_one_dispatch_per_role_per_case: true,
  };
  if (hashCanonicalJson(plan.pass_contract) !== hashCanonicalJson(expectedPassContract)) {
    throw new Error('stateObservabilityPreflight: pass contract drifted from the 24-of-24 gate');
  }
  const worlds = plan.axes?.worlds || [];
  const realizers = plan.axes?.language_realizers || [];
  if (
    worlds.length !== 3 ||
    new Set(worlds).size !== 3 ||
    realizers.length !== 2 ||
    new Set(realizers).size !== 2 ||
    hashCanonicalJson(plan.axes?.event_families) !== hashCanonicalJson(FAMILIES)
  ) {
    throw new Error('stateObservabilityPreflight: invalid crossed axes');
  }
  const expected = new Set(
    worlds.flatMap((world) =>
      FAMILIES.flatMap((family) => realizers.map((realizer) => `${world}|${family}|${realizer}`)),
    ),
  );
  const observed = new Set();
  for (const job of plan.jobs) {
    const key = `${job?.world?.id}|${job?.event_family}|${job?.language_realizer?.id}`;
    const expectedId = `preflight__${job?.world?.id}__${job?.event_family}__${job?.language_realizer?.id}`;
    if (
      !expected.has(key) ||
      observed.has(key) ||
      job.id !== expectedId ||
      job.claim_eligible !== false ||
      Number(job.expected_realizer_dispatches) !== 1 ||
      Number(job.expected_analyzer_dispatches) !== 1 ||
      !job.world?.source ||
      !job.world?.geometry ||
      !job.language_realizer?.model_ref ||
      !job.language_realizer?.model_family
    ) {
      throw new Error(`stateObservabilityPreflight: duplicate or unknown matrix cell ${key}`);
    }
    observed.add(key);
  }
  if (observed.size !== expected.size) throw new Error('stateObservabilityPreflight: incomplete crossed matrix');
  if (config) {
    const expectedJobs = matrixJobs(config);
    if (
      hashCanonicalJson(plan.axes.worlds) !== hashCanonicalJson(config.critical_path.worlds.map((row) => row.id)) ||
      hashCanonicalJson(plan.axes.language_realizers) !==
        hashCanonicalJson(config.critical_path.language_realizers.map((row) => row.id)) ||
      hashCanonicalJson(plan.jobs) !== hashCanonicalJson(expectedJobs)
    ) {
      throw new Error('stateObservabilityPreflight: plan differs from the current frozen config matrix');
    }
  }
  return true;
}

function publicWorld(world) {
  return {
    id: world.id,
    title: world.title,
    question: world.question,
    setting: world.setting,
    discipline: world.discipline,
    rules: clone(world.rules || []),
    background: clone(world.background || []),
  };
}

function advanceToDerivableProof(adapter, proof) {
  let current = clone(proof);
  for (let index = 0; index < 32 && !adapter.nextDerivableFact(current); index += 1) {
    const premiseId = adapter.nextChallengePremiseId(current);
    if (!premiseId) break;
    current = adapter.applyEvent(current, adapter.adoptEvent(premiseId));
  }
  if (!adapter.nextDerivableFact(current)) {
    throw new Error(`stateObservabilityPreflight: world ${adapter.id} cannot construct a public derive fixture`);
  }
  return current;
}

function advanceToSettledProof(adapter, proof) {
  let current = clone(proof);
  const priorDerivedFacts = [];
  for (let index = 0; index < 32; index += 1) {
    const fact = adapter.nextDerivableFact(current);
    if (!fact) return { proof: current, priorDerivedFacts };
    priorDerivedFacts.push(clone(fact));
    current = adapter.applyEvent(current, adapter.deriveEvent(fact));
  }
  throw new Error(`stateObservabilityPreflight: world ${adapter.id} none fixture did not settle`);
}

function publicPriorConclusion(fact) {
  return `I have already recorded the supported conclusion ${String(fact[0])}(${fact
    .slice(1)
    .map((value) => String(value))
    .join(', ')}).`;
}

function fixtureFor(job, adapter, world) {
  let beforeProof = adapter.initialHiddenProofState();
  let priorDerivedFacts = [];
  let event;
  if (job.event_family === 'adopt') {
    const premiseId = adapter.nextChallengePremiseId(beforeProof);
    if (!premiseId) throw new Error(`stateObservabilityPreflight: world ${adapter.id} lacks an adopt fixture`);
    event = adapter.adoptEvent(premiseId);
  } else if (job.event_family === 'derive') {
    beforeProof = advanceToDerivableProof(adapter, beforeProof);
    event = adapter.deriveEvent(adapter.nextDerivableFact(beforeProof));
  } else if (job.event_family === 'retract') {
    if (!beforeProof.heldPremiseIds.length) {
      const premiseId = adapter.nextChallengePremiseId(beforeProof);
      if (!premiseId) throw new Error(`stateObservabilityPreflight: world ${adapter.id} lacks a retract fixture`);
      beforeProof = adapter.applyEvent(beforeProof, adapter.adoptEvent(premiseId));
    }
    event = adapter.retractPremiseEvent(beforeProof.heldPremiseIds[0]);
  } else {
    const settled = advanceToSettledProof(adapter, beforeProof);
    beforeProof = settled.proof;
    priorDerivedFacts = settled.priorDerivedFacts;
    if (adapter.nextDerivableFact(beforeProof)) {
      throw new Error(`stateObservabilityPreflight: world ${adapter.id} none fixture has an unvoiced derivation`);
    }
    event = adapter.noneEvent({ semanticRole: 'no_public_dag_move' });
  }
  const afterProof = adapter.applyEvent(beforeProof, event);
  const turn = 2;
  const tutorText = 'State where the public evidence leaves you now, using only the public record.';
  const envelope = adapter.publicEnvelope({
    kernelId: 'observability_preflight_fixture',
    actionType: 'request_evidence',
    turn,
    afterState: { proof: afterProof, public_cues: {} },
    event,
  });
  const releasedEvidence = afterProof.releasedPremiseIds.map((premiseId) => {
    const premise = world.premiseById.get(premiseId);
    if (!premise) throw new Error(`stateObservabilityPreflight: unknown released premise ${premiseId}`);
    return {
      premise: premise.id,
      turn: 1,
      via: 'preflight_public_fixture',
      fact: clone(premise.fact),
      surface: adaptiveStateTransitionAtomicSurface({
        question: world.question,
        surface: premise.surface,
      }),
    };
  });
  const priorSurfaces = beforeProof.releasedPremiseIds
    .map((premiseId) =>
      adaptiveStateTransitionAtomicSurface({
        question: world.question,
        surface: world.premiseById.get(premiseId)?.surface,
      }),
    )
    .filter(Boolean);
  const priorRecordParts = [
    ...(priorSurfaces.length ? [`My existing public record contains: ${priorSurfaces.join(' | ')}`] : []),
    ...priorDerivedFacts.map(publicPriorConclusion),
  ];
  const priorLearnerText = priorRecordParts.length
    ? priorRecordParts.join(' ')
    : 'I have not yet added a public proof move.';
  const priorPublicLearnerState = {
    adopted_premise_ids: [...beforeProof.heldPremiseIds].sort(),
    voiced_derived_facts: clone(priorDerivedFacts),
    prior_hypotheses: [],
    asserted_answers: [],
  };
  return {
    target_family: job.event_family,
    expected_event_ids: [...envelope.required_realizer_output.realized_public_event_ids],
    realizer_input: isolateAdaptiveStatePublicRealizerInput({
      currentPublicActEnvelope: { ...clone(envelope.current_public_act_envelope), turn },
      priorPublicTranscript: [
        { turn: 1, role: 'learner', text: priorLearnerText },
        { turn: 1, role: 'tutor', text: tutorText },
      ],
      currentAction: { action_type: 'request_evidence', tutor_text: tutorText },
      publicWorldVocabulary: clone(envelope.public_world_vocabulary),
    }),
    analyzer_context: {
      turn,
      topic: world.question,
      world: publicWorld(world),
      publicStagedEvidence: clone(releasedEvidence),
      publicReleaseLedger: clone(releasedEvidence),
      tutorTurn: turn,
      currentTutorText: tutorText,
      publicTranscript: [{ turn: 1, learner: priorLearnerText, tutor: tutorText }],
      priorPublicLearnerState,
      promptContext: {
        benchmark: 'adaptive_state_observability_preflight_v2.1',
        world_id: world.id,
        claim_eligible: false,
      },
    },
  };
}

function assertNoForbiddenAnalyzerKey(value, location = 'analyzer_input') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_ANALYZER_KEY.test(key)) {
      throw new Error(`stateObservabilityPreflight: forbidden analyzer input ${location}.${key}`);
    }
    assertNoForbiddenAnalyzerKey(child, `${location}.${key}`);
  }
}

function validateAnalyzerInput(input, expectedEventIds) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    hashCanonicalJson(Object.keys(input).sort()) !== hashCanonicalJson([...ANALYZER_INPUT_KEYS].sort())
  ) {
    throw new Error('stateObservabilityPreflight: analyzer input key set differs from the frozen public contract');
  }
  const exactKeys = (value, keys) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    hashCanonicalJson(Object.keys(value).sort()) === hashCanonicalJson([...keys].sort());
  if (
    !exactKeys(input.world, ['id', 'title', 'question', 'setting', 'discipline', 'rules', 'background']) ||
    !Array.isArray(input.world.rules) ||
    !Array.isArray(input.world.background) ||
    !Array.isArray(input.publicStagedEvidence) ||
    !Array.isArray(input.publicReleaseLedger) ||
    !Array.isArray(input.publicTranscript) ||
    !exactKeys(input.priorPublicLearnerState, [
      'adopted_premise_ids',
      'voiced_derived_facts',
      'prior_hypotheses',
      'asserted_answers',
    ]) ||
    Object.values(input.priorPublicLearnerState).some((value) => !Array.isArray(value)) ||
    !exactKeys(input.promptContext, ['benchmark', 'world_id', 'claim_eligible']) ||
    input.promptContext.benchmark !== 'adaptive_state_observability_preflight_v2.1' ||
    input.promptContext.world_id !== input.world.id ||
    input.promptContext.claim_eligible !== false ||
    input.publicTranscript.some(
      (row) =>
        !exactKeys(row, ['turn', 'learner', 'tutor']) ||
        !Number.isInteger(row.turn) ||
        typeof row.learner !== 'string' ||
        typeof row.tutor !== 'string',
    ) ||
    input.publicStagedEvidence.some(
      (row) =>
        !exactKeys(row, ['premise', 'turn', 'via', 'fact', 'surface']) ||
        !row.premise ||
        !Number.isInteger(row.turn) ||
        row.via !== 'preflight_public_fixture' ||
        !Array.isArray(row.fact) ||
        typeof row.surface !== 'string' ||
        !row.surface,
    ) ||
    hashCanonicalJson(input.publicReleaseLedger) !== hashCanonicalJson(input.publicStagedEvidence)
  ) {
    throw new Error(
      'stateObservabilityPreflight: analyzer input nested public schema differs from the frozen contract',
    );
  }
  assertNoForbiddenAnalyzerKey(input);
  const serialized = canonicalJson(input);
  if (expectedEventIds.some((eventId) => eventId && serialized.includes(eventId))) {
    throw new Error('stateObservabilityPreflight: analyzer input contains a harness-owned event id');
  }
  return true;
}

function realizerRuntime(config, realizer) {
  const runtime = config.paid_execution_contract?.realizer_runtime?.[realizer.id];
  if (!runtime) throw new Error(`stateObservabilityPreflight: missing runtime for ${realizer.id}`);
  return { model_ref: realizer.model_ref, ...clone(runtime) };
}

function analyzerRuntime(config) {
  return clone(config.paid_execution_contract.public_turn_analyzer);
}

function callAccounting(calls) {
  const roleNames = ['codex_realizer', 'claude_realizer', 'public_turn_analyzer'];
  const byRole = Object.fromEntries(
    roleNames.map((role) => [
      role,
      {
        planned: role === 'public_turn_analyzer' ? 24 : 12,
        reached: 0,
        dispatched: 0,
        completed: 0,
        failed: 0,
      },
    ]),
  );
  for (const call of calls) {
    const row = byRole[call.role];
    if (!row) throw new Error(`stateObservabilityPreflight: unknown call role ${call.role}`);
    row.reached += 1;
    row.dispatched += Number(call.provenance?.dispatch_count || 0);
    row.completed += call.status === 'success' ? 1 : 0;
    row.failed += call.status === 'technical_failure' ? 1 : 0;
  }
  return {
    planned: 48,
    reached: calls.length,
    dispatched: calls.reduce((sum, call) => sum + Number(call.provenance?.dispatch_count || 0), 0),
    completed: calls.filter((call) => call.status === 'success').length,
    failed: calls.filter((call) => call.status === 'technical_failure').length,
    by_role: byRole,
  };
}

function failureProvenance(error) {
  const metadata = error?.callMetadata || {};
  return {
    requested_model_ref: metadata.requested_model_ref || null,
    resolved_model_ref: metadata.resolved_model_ref || null,
    observed_model_ref: metadata.observed_model_ref || null,
    dispatch_count: Number(metadata.dispatch_count || 0),
    attempts: Number(metadata.attempts || metadata.dispatch_count || 0),
    semantic_rerolls: Number(metadata.semantic_rerolls || 0),
    backend_request_count: 'unknown',
  };
}

async function notify(onCall, record) {
  if (typeof onCall === 'function') await onCall(clone(record));
}

function realizerCallRecord({ index, job, role, result, provenance }) {
  const artifacts = {
    public_input: clone(result.input),
    system_prompt: result.call_artifacts.system_prompt,
    user_prompt: result.call_artifacts.user_prompt,
    raw_output: result.raw_output,
    parsed_output: clone(result.output),
  };
  const artifactHashes = {
    public_input_sha256: hashCanonicalJson(artifacts.public_input),
    system_prompt_sha256: sha256(artifacts.system_prompt),
    user_prompt_sha256: sha256(artifacts.user_prompt),
    raw_output_sha256: sha256(artifacts.raw_output),
    parsed_output_sha256: hashCanonicalJson(artifacts.parsed_output),
  };
  if (
    artifactHashes.public_input_sha256 !== result.call_metadata?.input_sha256 ||
    artifactHashes.system_prompt_sha256 !== result.call_metadata?.system_prompt_sha256 ||
    artifactHashes.user_prompt_sha256 !== result.call_metadata?.user_prompt_sha256 ||
    artifactHashes.raw_output_sha256 !== result.call_metadata?.raw_output_sha256 ||
    artifactHashes.parsed_output_sha256 !== result.call_metadata?.output_sha256
  ) {
    throw Object.assign(
      new Error('stateObservabilityPreflight: realizer artifact hashes differ from call provenance'),
      {
        callMetadata: result.call_metadata,
      },
    );
  }
  return {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_CALL_SCHEMA,
    version: VERSION,
    id: `preflight-call-${String(index).padStart(3, '0')}`,
    role,
    status: 'success',
    claim_eligible: false,
    job_id: job.id,
    provenance,
    call_metadata: clone(result.call_metadata),
    artifacts,
    artifact_hashes: artifactHashes,
  };
}

function analyzerCallRecord({ index, job, result, publicModelInput, provenance }) {
  const raw = result.rawAnalysis || {};
  const artifacts = {
    public_input: clone(publicModelInput),
    system_prompt: raw.systemPrompt || null,
    prompt: raw.prompt || null,
    output_schema: clone(raw.outputSchema),
    raw_output: raw.rawText ?? null,
    parsed_output: clone(raw.parsed),
  };
  if (
    typeof artifacts.system_prompt !== 'string' ||
    typeof artifacts.prompt !== 'string' ||
    typeof artifacts.raw_output !== 'string' ||
    !artifacts.output_schema ||
    !artifacts.parsed_output
  ) {
    throw Object.assign(new Error('stateObservabilityPreflight: analyzer omitted reconstructible artifacts'), {
      callMetadata: adaptiveStateAnalyzerCallMetadata(result),
    });
  }
  const artifactHashes = {
    public_input_sha256: hashCanonicalJson(artifacts.public_input),
    system_prompt_sha256: sha256(artifacts.system_prompt),
    prompt_sha256: sha256(artifacts.prompt),
    output_schema_sha256: hashCanonicalJson(artifacts.output_schema),
    raw_output_sha256: sha256(artifacts.raw_output),
    parsed_output_sha256: hashCanonicalJson(artifacts.parsed_output),
    model_input_envelope_sha256: hashCanonicalJson({
      systemPrompt: artifacts.system_prompt,
      prompt: artifacts.prompt,
      outputSchema: artifacts.output_schema,
    }),
  };
  const metadata = adaptiveStateAnalyzerCallMetadata(result);
  if (
    artifactHashes.system_prompt_sha256 !== metadata?.system_prompt_sha256 ||
    artifactHashes.prompt_sha256 !== metadata?.prompt_sha256 ||
    artifactHashes.output_schema_sha256 !== metadata?.output_schema_sha256 ||
    artifactHashes.raw_output_sha256 !== metadata?.raw_output_sha256 ||
    artifactHashes.parsed_output_sha256 !== metadata?.parsed_output_sha256 ||
    artifactHashes.model_input_envelope_sha256 !== metadata?.input_sha256
  ) {
    throw Object.assign(
      new Error('stateObservabilityPreflight: analyzer artifact hashes differ from call provenance'),
      {
        callMetadata: metadata,
      },
    );
  }
  return {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_CALL_SCHEMA,
    version: VERSION,
    id: `preflight-call-${String(index).padStart(3, '0')}`,
    role: 'public_turn_analyzer',
    status: 'success',
    claim_eligible: false,
    job_id: job.id,
    provenance,
    call_metadata: clone(metadata),
    artifacts,
    artifact_hashes: artifactHashes,
  };
}

function failedCallRecord({ index, job, role, error }) {
  return {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_CALL_SCHEMA,
    version: VERSION,
    id: `preflight-call-${String(index).padStart(3, '0')}`,
    role,
    status: 'technical_failure',
    claim_eligible: false,
    job_id: job.id,
    provenance: failureProvenance(error),
    call_metadata: clone(error?.callMetadata || {}),
    error: String(error?.message || error || 'technical failure'),
  };
}

/** Execute the 24 isolated cases through injected one-call production-compatible seams. */
export async function executeAdaptiveStateObservabilityPreflight({
  plan,
  config,
  realizeTurn,
  analyzePublicText,
  onCall = null,
  repoRoot = path.resolve('.'),
} = {}) {
  validateAdaptiveStateObservabilityPreflightPlan(plan, config);
  if (typeof realizeTurn !== 'function' || typeof analyzePublicText !== 'function') {
    throw new Error('stateObservabilityPreflight: realizer and public analyzer seams are required');
  }
  const adapters = new Map(
    loadAdaptiveStateWorldAdapters(config.critical_path.worlds, { repoRoot }).map((adapter) => [adapter.id, adapter]),
  );
  const worlds = new Map(
    config.critical_path.worlds.map((row) => [row.id, loadWorld(path.resolve(repoRoot, row.source))]),
  );
  const calls = [];
  const cases = [];
  const analyzer = analyzerRuntime(config);
  const stop = (error) => {
    error.message = `stateObservabilityPreflight: paid preflight stopped: ${error.message}`;
    error.preflightPartial = {
      call_accounting: callAccounting(calls),
      calls: clone(calls),
      completed_cases: clone(cases),
      disposition: 'stopped_never_resume_same_label_no_partial_reuse',
    };
    throw error;
  };
  for (const job of plan.jobs) {
    const adapter = adapters.get(job.world.id);
    const world = worlds.get(job.world.id);
    if (!adapter || !world) stop(new Error(`missing world fixture ${job.world.id}`));
    const fixture = fixtureFor(job, adapter, world);
    const runtime = realizerRuntime(config, job.language_realizer);
    const role = job.language_realizer.id === 'codex_terra' ? 'codex_realizer' : 'claude_realizer';
    let realized;
    try {
      const result = await realizeTurn({
        modelRef: job.language_realizer.model_ref,
        input: clone(fixture.realizer_input),
        expectedEventIds: [...fixture.expected_event_ids],
        effort: runtime.effort,
        timeoutMs: Number(runtime.timeout_ms),
        role,
        context: {
          call_id: `preflight-call-${String(calls.length + 1).padStart(3, '0')}`,
          call_index: calls.length + 1,
          job_id: job.id,
          world_id: job.world.id,
          claim_eligible: false,
        },
      });
      const provenance = validateAdaptiveStateCallMetadata(result.call_metadata, runtime, role);
      const record = realizerCallRecord({
        index: calls.length + 1,
        job,
        role,
        result: { ...result, input: clone(fixture.realizer_input) },
        provenance,
      });
      if (fixture.expected_event_ids.some((eventId) => result.output.learner_text.includes(eventId))) {
        throw Object.assign(new Error('learner text contains a harness-owned public event id'), {
          callMetadata: result.call_metadata,
        });
      }
      calls.push(record);
      await notify(onCall, record);
      realized = result.output;
    } catch (error) {
      if (!calls.some((call) => call.job_id === job.id && call.role === role)) {
        const failed = failedCallRecord({ index: calls.length + 1, job, role, error });
        calls.push(failed);
        await notify(onCall, failed);
      }
      stop(error);
    }

    const publicModelInput = {
      learnerText: realized.learner_text,
      ...clone(fixture.analyzer_context),
    };
    try {
      validateAnalyzerInput(publicModelInput, fixture.expected_event_ids);
    } catch (error) {
      stop(error);
    }
    let analyzed;
    let analyzerCall;
    try {
      const result = await analyzePublicText({
        publicModelInput: clone(publicModelInput),
        modelRef: analyzer.model_ref,
        effort: analyzer.effort,
        timeoutMs: Number(analyzer.timeout_ms),
        parseMode: analyzer.parse_mode,
        context: {
          call_id: `preflight-call-${String(calls.length + 1).padStart(3, '0')}`,
          call_index: calls.length + 1,
          job_id: job.id,
          world_id: job.world.id,
          claim_eligible: false,
        },
      });
      const metadata = adaptiveStateAnalyzerCallMetadata(result);
      const provenance = validateAdaptiveStateCallMetadata(metadata, analyzer, 'public_turn_analyzer');
      analyzerCall = analyzerCallRecord({
        index: calls.length + 1,
        job,
        result,
        publicModelInput,
        provenance,
      });
      calls.push(analyzerCall);
      await notify(onCall, analyzerCall);
      analyzed = result;
    } catch (error) {
      if (!calls.some((call) => call.job_id === job.id && call.role === 'public_turn_analyzer')) {
        const failed = failedCallRecord({
          index: calls.length + 1,
          job,
          role: 'public_turn_analyzer',
          error,
        });
        calls.push(failed);
        await notify(onCall, failed);
      }
      stop(error);
    }
    const observedFamily = String(analyzed.benchmarkTransitionEvent?.family || '');
    const evidenceSpan = String(analyzed.benchmarkTransitionEvent?.evidence_span || '');
    const parsedTransition = analyzerCall.artifacts.parsed_output?.benchmark_transition;
    if (
      String(parsedTransition?.family || '') !== observedFamily ||
      String(parsedTransition?.evidence_span || '') !== evidenceSpan
    ) {
      stop(new Error('analyzer return differs from its immutable parsed benchmark transition'));
    }
    const exactSpan = Boolean(evidenceSpan && realized.learner_text.includes(evidenceSpan));
    const eventIdLeak = fixture.expected_event_ids.some((eventId) => realized.learner_text.includes(eventId));
    if (!exactSpan || eventIdLeak) {
      stop(new Error('strict observability evidence-span or event-id leakage gate failed'));
    }
    cases.push({
      schema: 'machinespirits.adaptive-state-observability-preflight-case.v2.1',
      version: VERSION,
      id: job.id,
      claim_eligible: false,
      world_id: job.world.id,
      event_family: job.event_family,
      realizer_id: job.language_realizer.id,
      learner_text: realized.learner_text,
      realized_public_event_ids: [...realized.realized_public_event_ids],
      analyzer_observed_family: observedFamily,
      analyzer_evidence_span: evidenceSpan,
      exact_learner_text_evidence_span: exactSpan,
      harness_event_id_in_learner_text: eventIdLeak,
      analyzer_input_sha256: analyzerCall.artifact_hashes.public_input_sha256,
      realizer_call_id: calls.at(-2).id,
      analyzer_call_id: calls.at(-1).id,
      passed: observedFamily === job.event_family && exactSpan && !eventIdLeak,
    });
  }
  const accounting = callAccounting(calls);
  const result = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_RESULT_SCHEMA,
    version: VERSION,
    stage: 's1_observability_preflight',
    claim_eligible: false,
    confirmation_eligible: false,
    s2_validity_verdict: null,
    plan_content_sha256: plan.content_sha256,
    execution_order: 'serial_fixed_balanced_matrix',
    semantic_rerolls: 0,
    repairs: 0,
    fallbacks: 0,
    exclusions: 0,
    partial_reuse: false,
    backend_request_count: 'unknown',
    execution_mode: 'unsealed_injected_execution',
    execution_transaction: null,
    call_accounting: accounting,
    calls,
    cases,
    exact_family_matches: cases.filter((row) => row.passed).length,
    all_cases_passed: cases.every((row) => row.passed),
  };
  result.content_sha256 = adaptiveStateObservabilityPreflightResultContentSha256(result);
  validateAdaptiveStateObservabilityPreflightResult(result, plan, config);
  return result;
}

function recomputeCallArtifactHashes(call) {
  const artifacts = call?.artifacts || {};
  if (call.role === 'public_turn_analyzer') {
    return {
      public_input_sha256: hashCanonicalJson(artifacts.public_input),
      system_prompt_sha256: sha256(artifacts.system_prompt),
      prompt_sha256: sha256(artifacts.prompt),
      output_schema_sha256: hashCanonicalJson(artifacts.output_schema),
      raw_output_sha256: sha256(artifacts.raw_output),
      parsed_output_sha256: hashCanonicalJson(artifacts.parsed_output),
      model_input_envelope_sha256: hashCanonicalJson({
        systemPrompt: artifacts.system_prompt,
        prompt: artifacts.prompt,
        outputSchema: artifacts.output_schema,
      }),
    };
  }
  return {
    public_input_sha256: hashCanonicalJson(artifacts.public_input),
    system_prompt_sha256: sha256(artifacts.system_prompt),
    user_prompt_sha256: sha256(artifacts.user_prompt),
    raw_output_sha256: sha256(artifacts.raw_output),
    parsed_output_sha256: hashCanonicalJson(artifacts.parsed_output),
  };
}

export function validateAdaptiveStateObservabilityPreflightResult(result, plan = null, config = null) {
  if (
    result?.schema !== ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_RESULT_SCHEMA ||
    String(result?.version) !== VERSION ||
    result?.stage !== 's1_observability_preflight' ||
    result?.claim_eligible !== false ||
    result?.confirmation_eligible !== false ||
    result?.s2_validity_verdict !== null ||
    result?.content_sha256 !== adaptiveStateObservabilityPreflightResultContentSha256(result)
  ) {
    throw new Error('stateObservabilityPreflight: invalid result envelope or content hash');
  }
  if (
    result.execution_order !== 'serial_fixed_balanced_matrix' ||
    Number(result.semantic_rerolls) !== 0 ||
    Number(result.repairs) !== 0 ||
    Number(result.fallbacks) !== 0 ||
    Number(result.exclusions) !== 0 ||
    result.partial_reuse !== false ||
    result.backend_request_count !== 'unknown'
  ) {
    throw new Error('stateObservabilityPreflight: result permits repair, exclusion, reuse, or non-serial execution');
  }
  const paidExecution = result.execution_mode === 'paid_cli';
  if (
    (!paidExecution &&
      (result.execution_mode !== 'unsealed_injected_execution' || result.execution_transaction !== null)) ||
    (paidExecution &&
      (!result.execution_transaction?.run_id ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.run_plan_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.preflight_hashes_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.s1_relevant_hashes_sha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(result.execution_transaction?.cli_fingerprints_sha256 || ''))))
  ) {
    throw new Error('stateObservabilityPreflight: result lacks a valid injected or paid execution binding');
  }
  if (
    !Array.isArray(result.calls) ||
    result.calls.length !== 48 ||
    !Array.isArray(result.cases) ||
    result.cases.length !== 24
  ) {
    throw new Error('stateObservabilityPreflight: complete result requires exactly 48 calls and 24 cases');
  }
  const accounting = callAccounting(result.calls);
  if (
    hashCanonicalJson(accounting) !== hashCanonicalJson(result.call_accounting) ||
    accounting.dispatched !== 48 ||
    accounting.completed !== 48 ||
    accounting.failed !== 0 ||
    result.calls.some(
      (call) =>
        call.status !== 'success' ||
        call.claim_eligible !== false ||
        Number(call.provenance?.dispatch_count) !== 1 ||
        Number(call.provenance?.semantic_rerolls) !== 0,
    )
  ) {
    throw new Error('stateObservabilityPreflight: call accounting or provenance differs from the 48-call contract');
  }
  const roleCounts = Object.fromEntries(
    ['codex_realizer', 'claude_realizer', 'public_turn_analyzer'].map((role) => [
      role,
      result.calls.filter((call) => call.role === role).length,
    ]),
  );
  if (
    roleCounts.codex_realizer !== 12 ||
    roleCounts.claude_realizer !== 12 ||
    roleCounts.public_turn_analyzer !== 24 ||
    new Set(result.calls.map((call) => call.id)).size !== 48
  ) {
    throw new Error('stateObservabilityPreflight: result lacks the exact 12/12/24 role matrix');
  }
  if (plan) {
    validateAdaptiveStateObservabilityPreflightPlan(plan, config);
    if (
      result.plan_content_sha256 !== plan.content_sha256 ||
      hashCanonicalJson(result.cases.map((row) => row.id)) !== hashCanonicalJson(plan.jobs.map((job) => job.id))
    ) {
      throw new Error('stateObservabilityPreflight: result cases are not bound to the frozen plan/order');
    }
  }
  const cells = new Set();
  for (const [index, row] of result.cases.entries()) {
    const job = plan?.jobs?.[index] || null;
    const key = `${row.world_id}|${row.event_family}|${row.realizer_id}`;
    if (
      cells.has(key) ||
      !FAMILIES.includes(row.event_family) ||
      row.schema !== 'machinespirits.adaptive-state-observability-preflight-case.v2.1' ||
      String(row.version) !== VERSION ||
      row.claim_eligible !== false ||
      (job &&
        (row.id !== job.id ||
          row.world_id !== job.world.id ||
          row.event_family !== job.event_family ||
          row.realizer_id !== job.language_realizer.id))
    ) {
      throw new Error(`stateObservabilityPreflight: duplicate or invalid result cell ${key}`);
    }
    cells.add(key);
    const realizerCall = result.calls[index * 2];
    const analyzerCall = result.calls[index * 2 + 1];
    const expectedRealizerRole = row.realizer_id === 'codex_terra' ? 'codex_realizer' : 'claude_realizer';
    if (
      realizerCall?.id !== `preflight-call-${String(index * 2 + 1).padStart(3, '0')}` ||
      analyzerCall?.id !== `preflight-call-${String(index * 2 + 2).padStart(3, '0')}` ||
      realizerCall?.id !== row.realizer_call_id ||
      analyzerCall?.id !== row.analyzer_call_id ||
      realizerCall?.job_id !== row.id ||
      analyzerCall?.job_id !== row.id ||
      realizerCall?.role !== expectedRealizerRole ||
      analyzerCall?.role !== 'public_turn_analyzer'
    ) {
      throw new Error(`stateObservabilityPreflight: calls are not one ordered realizer/analyzer pair for ${row.id}`);
    }
    for (const call of [realizerCall, analyzerCall]) {
      const recomputedHashes = recomputeCallArtifactHashes(call);
      if (hashCanonicalJson(recomputedHashes) !== hashCanonicalJson(call.artifact_hashes)) {
        throw new Error(`stateObservabilityPreflight: call artifact hash drift for ${call.id}`);
      }
    }
    if (
      realizerCall.call_metadata?.input_sha256 !== realizerCall.artifact_hashes.public_input_sha256 ||
      realizerCall.call_metadata?.system_prompt_sha256 !== realizerCall.artifact_hashes.system_prompt_sha256 ||
      realizerCall.call_metadata?.user_prompt_sha256 !== realizerCall.artifact_hashes.user_prompt_sha256 ||
      realizerCall.call_metadata?.raw_output_sha256 !== realizerCall.artifact_hashes.raw_output_sha256 ||
      realizerCall.call_metadata?.output_sha256 !== realizerCall.artifact_hashes.parsed_output_sha256 ||
      analyzerCall.call_metadata?.input_sha256 !== analyzerCall.artifact_hashes.model_input_envelope_sha256 ||
      analyzerCall.call_metadata?.system_prompt_sha256 !== analyzerCall.artifact_hashes.system_prompt_sha256 ||
      analyzerCall.call_metadata?.prompt_sha256 !== analyzerCall.artifact_hashes.prompt_sha256 ||
      analyzerCall.call_metadata?.output_schema_sha256 !== analyzerCall.artifact_hashes.output_schema_sha256 ||
      analyzerCall.call_metadata?.raw_output_sha256 !== analyzerCall.artifact_hashes.raw_output_sha256 ||
      analyzerCall.call_metadata?.parsed_output_sha256 !== analyzerCall.artifact_hashes.parsed_output_sha256
    ) {
      throw new Error(`stateObservabilityPreflight: call metadata hashes differ from artifacts for ${row.id}`);
    }
    if (config && job) {
      const frozen =
        analyzerCall.role === 'public_turn_analyzer'
          ? analyzerRuntime(config)
          : realizerRuntime(config, job.language_realizer);
      const normalizedRealizerProvenance = validateAdaptiveStateCallMetadata(
        realizerCall.call_metadata,
        realizerRuntime(config, job.language_realizer),
        expectedRealizerRole,
      );
      const normalizedAnalyzerProvenance = validateAdaptiveStateCallMetadata(
        analyzerCall.call_metadata,
        frozen,
        'public_turn_analyzer',
      );
      if (
        hashCanonicalJson(normalizedRealizerProvenance) !== hashCanonicalJson(realizerCall.provenance) ||
        hashCanonicalJson(normalizedAnalyzerProvenance) !== hashCanonicalJson(analyzerCall.provenance)
      ) {
        throw new Error(`stateObservabilityPreflight: call provenance is not recomputable for ${row.id}`);
      }
    }
    const realized = realizerCall.artifacts.parsed_output;
    const parsedTransition = analyzerCall.artifacts.parsed_output?.benchmark_transition;
    const envelopeEventIds = realizerCall.artifacts.public_input?.currentPublicActEnvelope?.event_ids || [];
    const envelopeEvents = realizerCall.artifacts.public_input?.currentPublicActEnvelope?.events || [];
    if (
      realizerCall.artifacts.public_input?.currentPublicActEnvelope?.event_family !== row.event_family ||
      hashCanonicalJson(envelopeEventIds) !== hashCanonicalJson(row.realized_public_event_ids) ||
      hashCanonicalJson(envelopeEvents.map((event) => event.event_id)) !==
        hashCanonicalJson(row.realized_public_event_ids) ||
      hashCanonicalJson(realized?.realized_public_event_ids) !== hashCanonicalJson(row.realized_public_event_ids) ||
      String(realized?.learner_text || '') !== row.learner_text ||
      analyzerCall.artifacts.public_input?.learnerText !== row.learner_text ||
      String(parsedTransition?.family || '') !== row.analyzer_observed_family ||
      String(parsedTransition?.evidence_span || '') !== row.analyzer_evidence_span
    ) {
      throw new Error(
        `stateObservabilityPreflight: case differs from its realizer/analyzer parsed artifacts for ${row.id}`,
      );
    }
    const expectedPass =
      row.analyzer_observed_family === row.event_family &&
      row.exact_learner_text_evidence_span === true &&
      row.harness_event_id_in_learner_text === false &&
      typeof row.analyzer_evidence_span === 'string' &&
      row.analyzer_evidence_span.length > 0 &&
      row.learner_text.includes(row.analyzer_evidence_span) &&
      !row.realized_public_event_ids.some((eventId) => eventId && row.learner_text.includes(eventId));
    if (row.passed !== expectedPass) {
      throw new Error(`stateObservabilityPreflight: case pass flag is not recomputable for ${row.id}`);
    }
    validateAnalyzerInput(analyzerCall.artifacts.public_input, row.realized_public_event_ids);
    if (analyzerCall.artifact_hashes.public_input_sha256 !== row.analyzer_input_sha256) {
      throw new Error(`stateObservabilityPreflight: analyzer input hash drift for ${row.id}`);
    }
  }
  const exact = result.cases.filter((row) => row.passed).length;
  if (Number(result.exact_family_matches) !== exact || result.all_cases_passed !== (exact === 24)) {
    throw new Error('stateObservabilityPreflight: aggregate family recovery is not recomputable');
  }
  return true;
}

function groupedRecovery(cases, key) {
  return Object.fromEntries(
    [...new Set(cases.map((row) => row[key]))].sort().map((value) => {
      const rows = cases.filter((row) => row[key] === value);
      return [value, { passed: rows.filter((row) => row.passed).length, total: rows.length }];
    }),
  );
}

export function buildAdaptiveStateObservabilityPreflightReport({ plan, result, config = null } = {}) {
  validateAdaptiveStateObservabilityPreflightPlan(plan, config);
  validateAdaptiveStateObservabilityPreflightResult(result, plan, config);
  if (result.plan_content_sha256 !== plan.content_sha256) {
    throw new Error('stateObservabilityPreflight: result is not bound to the supplied frozen plan');
  }
  const passed = result.all_cases_passed === true && result.exact_family_matches === 24;
  const paidExecutionBound = passed && result.execution_mode === 'paid_cli' && result.execution_transaction !== null;
  const report = {
    schema: ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_REPORT_SCHEMA,
    version: VERSION,
    stage: 's1_observability_preflight',
    status: passed ? 'pass' : 'stop',
    decision: passed
      ? paidExecutionBound
        ? 'authorize_full_s1_retry'
        : 'injected_preflight_pass_non_authorizing'
      : 'stop_and_repair_observability_preflight',
    claim_eligible: false,
    confirmation_eligible: false,
    s1_retry_eligible: paidExecutionBound,
    execution_mode: result.execution_mode,
    paid_execution_bound: paidExecutionBound,
    s2_validity_verdict: null,
    plan_content_sha256: plan.content_sha256,
    result_content_sha256: result.content_sha256,
    coverage: {
      completed_cases: result.cases.length,
      required_cases: 24,
      exact_family_matches: result.exact_family_matches,
      exact_family_recovery: result.exact_family_matches / 24,
      cli_dispatches: result.call_accounting.dispatched,
      backend_request_count: 'unknown',
    },
    recovery: {
      by_world: groupedRecovery(result.cases, 'world_id'),
      by_event_family: groupedRecovery(result.cases, 'event_family'),
      by_realizer: groupedRecovery(result.cases, 'realizer_id'),
    },
    failures: result.cases
      .filter((row) => !row.passed)
      .map((row) => ({
        id: row.id,
        intended_family: row.event_family,
        observed_family: row.analyzer_observed_family,
      })),
    claim_boundary:
      'This preflight tests public observability and parser integrity only. It is not a learner-state sensor, policy, efficacy, human-learning, or deployment result.',
  };
  report.content_sha256 = adaptiveStateObservabilityPreflightReportContentSha256(report);
  validateAdaptiveStateObservabilityPreflightReport(report);
  return report;
}

export function validateAdaptiveStateObservabilityPreflightReport(report) {
  if (
    report?.schema !== ADAPTIVE_STATE_OBSERVABILITY_PREFLIGHT_REPORT_SCHEMA ||
    String(report?.version) !== VERSION ||
    report?.stage !== 's1_observability_preflight' ||
    report?.claim_eligible !== false ||
    report?.confirmation_eligible !== false ||
    report?.s2_validity_verdict !== null ||
    report?.content_sha256 !== adaptiveStateObservabilityPreflightReportContentSha256(report)
  ) {
    throw new Error('stateObservabilityPreflight: invalid report envelope or content hash');
  }
  const pass =
    Number(report.coverage?.completed_cases) === 24 &&
    Number(report.coverage?.required_cases) === 24 &&
    Number(report.coverage?.exact_family_matches) === 24 &&
    Number(report.coverage?.cli_dispatches) === 48 &&
    Array.isArray(report.failures) &&
    report.failures.length === 0;
  const paidExecutionBound = pass && report.execution_mode === 'paid_cli' && report.paid_execution_bound === true;
  const expectedDecision = pass
    ? paidExecutionBound
      ? 'authorize_full_s1_retry'
      : 'injected_preflight_pass_non_authorizing'
    : 'stop_and_repair_observability_preflight';
  if (
    report.status !== (pass ? 'pass' : 'stop') ||
    report.decision !== expectedDecision ||
    report.s1_retry_eligible !== paidExecutionBound ||
    report.paid_execution_bound !== paidExecutionBound
  ) {
    throw new Error('stateObservabilityPreflight: report decision is not recomputable');
  }
  return true;
}
