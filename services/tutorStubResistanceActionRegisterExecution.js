import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildTutorStubResistanceActionRegisterPlan,
  createTutorStubResistanceActionRegisterStudyRuntime,
  loadTutorStubResistanceActionRegisterRegistration,
  TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
} from './tutorStubResistanceActionRegisterStudy.js';
import { parseTutorStubPublicLearnerAnalysisInteractive } from './tutorStubPublicLearnerAnalysis.js';

export const TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_BUNDLE_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-public-prefix-bundle.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashValue(value) {
  return sha256(JSON.stringify(canonicalJson(value)));
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function assertSha(value, label) {
  if (!/^[a-f0-9]{64}$/u.test(String(value || ''))) throw new Error(`${label} must be a SHA-256 digest`);
}

function prefixProjection(prefix) {
  return {
    world: prefix.world,
    profile: prefix.profile,
    priorTurns: [],
    triggerTurn: prefix.trigger_turn,
    triggerLearnerText: prefix.trigger_learner_text,
  };
}

export function validateTutorStubResistanceActionRegisterPrefixBundle({
  bundle,
  registration,
  registrationSha256,
} = {}) {
  if (bundle?.schema !== TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_BUNDLE_SCHEMA || bundle.version !== 1) {
    throw new Error('resistance action/register prefix bundle schema or version is unsupported');
  }
  if (
    bundle.registration?.path !== 'config/tutor-stub-resistance-action-register-crossed-registration.v2.json' ||
    bundle.registration?.sha256 !== registrationSha256
  ) {
    throw new Error('prefix bundle registration binding does not match the selected V2 registration');
  }
  if (
    bundle.provenance?.v4_request_sha256 !== '0c14c51ae8625e6f5db301c9328b8f3182a8dbcd0b6b5a9dd610db85064ee0ab' ||
    bundle.provenance?.v4_report_sha256 !== '771076330d58ec8818182a1924e3ea8dd2c8e54bdc1c9f32a822e491f405b431' ||
    bundle.provenance?.private_archive_commit !== 'e5eb71f22f0c36f6e286272caf5b041e71d8e2ba'
  ) {
    throw new Error('prefix bundle must bind the frozen V4 request, report, and private archive provenance');
  }
  if (
    bundle.boundary?.public_only !== true ||
    bundle.boundary?.hidden_answer_included !== false ||
    bundle.boundary?.future_treatment_outcomes_included !== false
  ) {
    throw new Error('prefix bundle must remain a public-only pre-treatment input');
  }
  const rows = bundle.prefixes;
  const bindings = registration?.design?.trigger?.frozenPrefixSource?.prefixes;
  if (!Array.isArray(rows) || rows.length !== 3 || !Array.isArray(bindings) || bindings.length !== 3) {
    throw new Error('prefix bundle must contain the three registered V4 target prefixes');
  }
  if (new Set(rows.map((row) => row.id)).size !== 3) throw new Error('prefix bundle IDs must be unique');
  for (const prefix of rows) {
    const binding = bindings.find((candidate) => candidate.id === prefix.id);
    if (
      !binding ||
      prefix.schema !== TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA ||
      prefix.profile !== 'frame_refuser' ||
      prefix.world !== registration.design.world ||
      prefix.trigger_turn !== 1 ||
      prefix.observation_semantics !== registration.design.trigger.observationSemantics ||
      prefix.source_trace_sha256 !== binding.sourceTraceSha256 ||
      prefix.public_prefix_sha256 !== binding.publicPrefixSha256
    ) {
      throw new Error(`prefix bundle entry ${prefix?.id || '(missing id)'} drifted from the V2 registration`);
    }
    assertSha(prefix.source_trace_sha256, `${prefix.id} source trace`);
    assertSha(prefix.public_prefix_sha256, `${prefix.id} public prefix`);
    if (hashValue(prefixProjection(prefix)) !== prefix.public_prefix_sha256) {
      throw new Error(`prefix bundle entry ${prefix.id} public bytes do not reproduce its registered digest`);
    }
    if (
      !String(prefix.opening_text || '').trim() ||
      !String(prefix.trigger_learner_text || '').trim() ||
      prefix.frozen_analysis?.provider !== 'codex' ||
      prefix.frozen_analysis?.model !== 'gpt-5.6-luna' ||
      !Number.isFinite(prefix.frozen_analysis?.latency_ms) ||
      prefix.frozen_analysis?.preflight?.computedBeforeModelCall !== true ||
      prefix.frozen_analysis?.preflight?.publicOnly !== true ||
      prefix.frozen_analysis?.preflight?.turn !== 1 ||
      !/^[a-f0-9]{64}$/u.test(String(prefix.frozen_analysis?.preflight?.contentSha256 || '')) ||
      !String(prefix.frozen_analysis?.response_text || '').trim()
    ) {
      throw new Error(`prefix bundle entry ${prefix.id} lacks its public opening, trigger, or frozen T1 analysis`);
    }
    const parsed = parseTutorStubPublicLearnerAnalysisInteractive(prefix.frozen_analysis.response_text);
    if (parsed.parseError || !parsed.parsed?.classification || !parsed.parsed?.learner_record) {
      throw new Error(`prefix bundle entry ${prefix.id} has an invalid frozen T1 analysis envelope`);
    }
  }
  return bundle;
}

export function loadTutorStubResistanceActionRegisterPrefixBundle({ bundlePath, registrationPath } = {}) {
  const registration = loadTutorStubResistanceActionRegisterRegistration(registrationPath);
  const absolute = path.resolve(bundlePath);
  const source = fs.readFileSync(absolute, 'utf8');
  const bundle = validateTutorStubResistanceActionRegisterPrefixBundle({
    bundle: JSON.parse(source),
    registration: registration.registration,
    registrationSha256: registration.sha256,
  });
  return { path: absolute, source, sha256: sha256(source), bundle, registration };
}

function planPrefixes(bundle) {
  return bundle.prefixes.map((prefix) => ({
    schema: prefix.schema,
    id: prefix.id,
    profile: prefix.profile,
    world: prefix.world,
    trigger_turn: prefix.trigger_turn,
    trigger_turn_id: `${prefix.id}:trigger`,
    trigger_learner_text: prefix.trigger_learner_text,
    trigger_classification: clone(prefix.trigger_classification),
    trigger_observation: clone(prefix.trigger_observation),
    observation_semantics: prefix.observation_semantics,
    source_trace: `sha256:${prefix.source_trace_sha256}`,
    source_trace_sha256: prefix.source_trace_sha256,
    prefix_trace_sha256: prefix.public_prefix_sha256,
    public_prefix_sha256: prefix.public_prefix_sha256,
    prior_turn_count: 0,
  }));
}

export function resolveTutorStubResistanceActionRegisterExecutionJob({ loaded, jobId } = {}) {
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration: loaded.registration.registration,
    prefixes: planPrefixes(loaded.bundle),
    stage: 'baseline',
  });
  const job = plan.jobs.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`resistance action/register job ${JSON.stringify(jobId)} is not registered`);
  const prefix = loaded.bundle.prefixes.find((candidate) => candidate.id === job.prefix_id);
  return { plan, job, prefix };
}

export function configureTutorStubResistanceActionRegisterExecution({
  state,
  loaded,
  jobId,
  appendTraceEvent,
  acknowledgeTutorStubOpeningRelease,
} = {}) {
  if (!state || state.turns?.length || state.history?.length) {
    throw new Error('resistance action/register exact-prefix execution requires a fresh empty session state');
  }
  const { job, prefix } = resolveTutorStubResistanceActionRegisterExecutionJob({ loaded, jobId });
  const parsed = parseTutorStubPublicLearnerAnalysisInteractive(prefix.frozen_analysis.response_text);
  state.history.push({ role: 'assistant', content: prefix.opening_text });
  state.openingRealization = {
    text: prefix.opening_text,
    provider: 'frozen_public_prefix',
    model: 'frame-refuser-opportunity-v4',
    latencyMs: 0,
    usage: null,
    source: 'registered_public_prefix_bundle',
  };
  acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
  state.resistanceActionRegisterStudy = {
    ...createTutorStubResistanceActionRegisterStudyRuntime({
      registration: loaded.registration.registration,
      registrationPath: path.relative(process.cwd(), loaded.registration.path),
      registrationSha256: loaded.registration.sha256,
      profile: job.treatment.profile,
      actionFit: job.treatment.action_fit,
      realization: job.treatment.realization,
      repeat: job.treatment.repeat,
    }),
    job_id: job.id,
    batch_id: job.treatment.batch_id,
    prefix_id: prefix.id,
    public_prefix_sha256: prefix.public_prefix_sha256,
    prefix_bundle_path: path.relative(process.cwd(), loaded.path),
    prefix_bundle_sha256: loaded.sha256,
    trigger_learner_text: prefix.trigger_learner_text,
    trigger_precomputed_raw: {
      ...parsed,
      provider: prefix.frozen_analysis.provider,
      model: prefix.frozen_analysis.model,
      latencyMs: prefix.frozen_analysis.latency_ms,
      usage: clone(prefix.frozen_analysis.usage),
      dagPreflight: clone(prefix.frozen_analysis.preflight),
    },
    outcome_horizon_learner_turns: 2,
    final_learner_without_tutor_reply: true,
  };
  appendTraceEvent(state.trace, {
    type: 'resistance_action_register_execution_start',
    jobId: job.id,
    batchId: job.treatment.batch_id,
    prefixId: prefix.id,
    publicPrefixSha256: prefix.public_prefix_sha256,
    prefixBundleSha256: loaded.sha256,
    registrationSha256: loaded.registration.sha256,
    treatment: clone(job.treatment),
    outcomeHorizonLearnerTurns: 2,
    publicTranscriptChanged: false,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_opening',
    text: prefix.opening_text,
    source: 'registered_public_prefix_bundle',
    publicPrefixSha256: prefix.public_prefix_sha256,
  });
  return { job, prefix };
}

export default {
  configureTutorStubResistanceActionRegisterExecution,
  loadTutorStubResistanceActionRegisterPrefixBundle,
  resolveTutorStubResistanceActionRegisterExecutionJob,
  validateTutorStubResistanceActionRegisterPrefixBundle,
};
