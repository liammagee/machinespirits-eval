import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceActionRegisterPlan,
  scoreTutorStubResistanceRecovery,
  TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
} from './tutorStubResistanceActionRegisterStudy.js';
import { validateTutorStubResistanceActionRegisterPrefixBundle } from './tutorStubResistanceActionRegisterExecution.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const LEGACY_PROFILES = ['bored', 'frame_defiant'];

function registrationProfiles(registration) {
  const profiles = registration?.design?.profiles;
  return Array.isArray(profiles) && profiles.length ? profiles : LEGACY_PROFILES;
}

function hash(char) {
  return String(char).repeat(64);
}

function syntheticPrefixes(registration) {
  return registrationProfiles(registration).flatMap((profile, profileIndex) =>
    Array.from({ length: 3 }, (_, index) => {
      const binding = registration?.design?.trigger?.frozenPrefixSource?.prefixes?.[index] || null;
      const triggerTurn = binding?.triggerTurn || index + 2;
      return {
        schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
        id: binding?.id || `${profile}:prefix:${index + 1}`,
        profile,
        world: 'world_005_marrick',
        trigger_turn: triggerTurn,
        trigger_turn_id: `${profile}:t${triggerTurn}`,
        trigger_learner_text:
          profile === 'bored'
            ? 'Sure. Whatever.'
            : profile === 'frame_refuser'
              ? 'I reject your right to set this question, and I will not answer within it.'
              : 'I reject the premise of this exercise. You do not get to set the question that way.',
        trigger_observation: { synthetic: true, profile },
        ...(registration?.version === 2 ? { observation_semantics: 'prospective_v4' } : {}),
        source_trace: `synthetic-zero-call/${profile}/prefix-${index + 1}.jsonl`,
        source_trace_sha256: binding?.sourceTraceSha256 || hash(String(profileIndex + 1)),
        prefix_trace_sha256: hash(String(index + 3 + profileIndex)),
        public_prefix_sha256: binding?.publicPrefixSha256 || hash(String(index + 6 + profileIndex * 3)),
        prior_turn_count: Math.max(0, triggerTurn - 1),
      };
    }),
  );
}

function postLearnerTurns(profile, repeat) {
  if (profile === 'bored') {
    return [
      repeat === 'A'
        ? {
            learnerText:
              'The clipped edge on Marrick’s blank is the concrete difference, because it fits the die mark.',
            classification: {
              turn: {
                discourse_move: 'inference',
                evidence_use: 'links_evidence_to_rule',
                epistemic_stance: 'grounded',
              },
            },
          }
        : {
            learnerText: 'The clipped edge is the public mark I would compare next.',
            classification: {
              turn: {
                discourse_move: 'evidence_adoption',
                evidence_use: 'cites_public_evidence',
                epistemic_stance: 'exploratory',
              },
            },
          },
    ];
  }
  return [
    repeat === 'A'
      ? {
          learnerText: 'I will test the local claim: does the clipped edge actually match the public die mark?',
          classification: {
            turn: {
              discourse_move: 'question',
              evidence_use: 'cites_public_evidence',
              epistemic_stance: 'exploratory',
            },
          },
        }
      : {
          learnerText:
            'I still dispute your standing, but the precise issue is whether that one public mark licenses this test.',
          classification: {
            turn: {
              discourse_move: 'challenge',
              evidence_use: 'cites_public_evidence',
              epistemic_stance: 'reflective',
            },
          },
        },
    {
      learnerText: 'The local comparison can proceed without granting the wider frame.',
      classification: {
        turn: {
          discourse_move: 'metacognitive_reflection',
          evidence_use: 'links_evidence_to_rule',
          epistemic_stance: 'grounded',
        },
      },
    },
  ];
}

export function buildTutorStubResistanceActionRegisterSyntheticCorpus(registration) {
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration,
    prefixes: syntheticPrefixes(registration),
    stage: 'baseline',
  });
  return plan.jobs.map((job, index) => {
    const postTurns = postLearnerTurns(job.treatment.profile, job.treatment.repeat);
    const outcome = scoreTutorStubResistanceRecovery({
      profile: job.treatment.profile,
      triggerLearnerText: job.trigger_learner_text,
      postLearnerTurns: postTurns,
    });
    return {
      case_id: job.id,
      arm: job.treatment.repeat,
      ...(job.treatment.batch_id ? { batch_id: job.treatment.batch_id } : {}),
      prefix_id: job.prefix_id,
      public_prefix_sha256: job.public_prefix_sha256,
      profile: job.treatment.profile,
      action_fit: job.treatment.action_fit,
      realization: job.treatment.realization,
      pedagogical_move: job.treatment.pedagogical_move,
      assigned_register: job.treatment.register,
      trigger_learner_text: job.trigger_learner_text,
      post_learner_turns: postTurns,
      outcome: {
        ...outcome,
        proof_debt_delta: index % 2 === 0 ? -1 : 0,
        new_supported_public_premises: index % 3 === 0 ? 2 : 1,
        grounded_closure_by_turn_8: index % 4 !== 0,
        turns_to_grounded_closure: index % 4 !== 0 ? 6 + (index % 2) : null,
      },
      fidelity: {
        action_visible: true,
        register_visible: true,
        safety_override: false,
        protected_condition: false,
      },
      trigger: {
        single_axis: true,
        profile_identity_used: false,
      },
    };
  });
}

export function buildTutorStubResistanceActionRegisterPreflightPackets(cases) {
  const prefixIds = [...new Set(cases.map((row) => row.prefix_id))];
  return prefixIds.map((prefixId) => {
    const rows = cases.filter((row) => row.prefix_id === prefixId);
    return {
      schema: 'machinespirits.tutor-stub.resistance-action-register-preflight-packet.v1',
      packet_id: prefixId,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function assembleTutorStubResistanceActionRegisterPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const rows = cases.map((row) => ({
    ...row,
    outcome: {
      ...row.outcome,
      ...scoreTutorStubResistanceRecovery({
        profile: row.profile,
        triggerLearnerText: row.trigger_learner_text,
        postLearnerTurns: row.post_learner_turns,
      }),
    },
  }));
  const complete = (predicate) => rows.length === contract.registered_scale.cases && rows.every(predicate);
  const recoveryByRealizationAndRepeat = Object.fromEntries(
    [...new Set(rows.map((row) => row.realization))].map((realization) => [
      realization,
      Object.fromEntries(
        [...new Set(rows.map((row) => row.arm))].map((repeat) => {
          const selected = rows.filter((row) => row.realization === realization && row.arm === repeat);
          return [repeat, selected.filter((row) => row.outcome.recovered).length / selected.length];
        }),
      ),
    ]),
  );
  const hasRepeatStabilityEndpoint = contract.endpoints.some(
    (endpoint) => endpoint.id === 'same_treatment_repeat_stability',
  );
  const repeatStabilityComplete =
    rows.every((row) => typeof row.outcome.recovered === 'boolean') &&
    Object.values(recoveryByRealizationAndRepeat).every(
      (rates) => Number.isFinite(rates.A) && Number.isFinite(rates.B),
    );
  return {
    case_ids: rows.map((row) => row.case_id),
    endpoint_status: {
      profile_specific_resistance_recovery: complete((row) => typeof row.outcome.recovered === 'boolean')
        ? 'complete'
        : 'incomplete',
      ...(hasRepeatStabilityEndpoint
        ? { same_treatment_repeat_stability: repeatStabilityComplete ? 'complete' : 'incomplete' }
        : {}),
      proof_dag_debt_delta_at_two_learner_turns: complete((row) => Number.isFinite(row.outcome.proof_debt_delta))
        ? 'complete'
        : 'incomplete',
      new_supported_public_premises_at_two_learner_turns: complete((row) =>
        Number.isInteger(row.outcome.new_supported_public_premises),
      )
        ? 'complete'
        : 'incomplete',
      grounded_closure_by_turn_8: complete((row) => typeof row.outcome.grounded_closure_by_turn_8 === 'boolean')
        ? 'complete'
        : 'incomplete',
      turns_to_grounded_closure: complete(
        (row) =>
          row.outcome.turns_to_grounded_closure === null || Number.isInteger(row.outcome.turns_to_grounded_closure),
      )
        ? 'complete'
        : 'incomplete',
      action_register_fidelity_and_safety: complete(
        (row) =>
          typeof row.fidelity.action_visible === 'boolean' &&
          typeof row.fidelity.register_visible === 'boolean' &&
          typeof row.fidelity.safety_override === 'boolean' &&
          typeof row.fidelity.protected_condition === 'boolean',
      )
        ? 'complete'
        : 'incomplete',
      trigger_specificity_and_assembly: complete(
        (row) => row.trigger.single_axis === true && row.trigger.profile_identity_used === false,
      )
        ? 'complete'
        : 'incomplete',
    },
    report: {
      schema: 'machinespirits.tutor-stub.resistance-action-register-baseline-report.v1',
      status: 'synthetic_endpoint_complete',
      rows,
      recovery_rate: rows.filter((row) => row.outcome.recovered).length / rows.length,
      ...(hasRepeatStabilityEndpoint
        ? {
            recovery_by_realization_and_repeat: recoveryByRealizationAndRepeat,
            same_treatment_repeat_drift: Object.fromEntries(
              Object.entries(recoveryByRealizationAndRepeat).map(([realization, rates]) => [
                realization,
                Math.abs(rates.A - rates.B),
              ]),
            ),
          }
        : {}),
    },
  };
}

export function runTutorStubResistanceActionRegisterEndpointPreflight({ contract, registration }) {
  const preflight = runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubResistanceActionRegisterSyntheticCorpus(registration),
    buildPackets: buildTutorStubResistanceActionRegisterPreflightPackets,
    assemble: assembleTutorStubResistanceActionRegisterPreflight,
  });
  if (registration?.version !== 2) return preflight;
  const bundlePath = contract.runner?.public_prefix_bundle;
  const bundleSource = fs.readFileSync(path.resolve(ROOT, bundlePath), 'utf8');
  const bundle = validateTutorStubResistanceActionRegisterPrefixBundle({
    bundle: JSON.parse(bundleSource),
    registration,
    registrationSha256: contract.registration.registration_sha256,
  });
  const batch = contract.runner?.batch_contract;
  if (
    contract.runner?.public_prefix_bundle_sha256 !== sha256(bundleSource) ||
    contract.runner?.live_batch_executor !==
      'scripts/run-tutor-stub-resistance-action-register-crossed.js#runTutorStubResistanceActionRegisterBatch' ||
    contract.runner?.live_batch_recovery_executor !==
      'scripts/run-tutor-stub-resistance-action-register-crossed.js#recoverTutorStubResistanceActionRegisterBatch' ||
    contract.runner?.combined_analyzer !==
      'scripts/analyze-tutor-stub-resistance-action-register-baseline.js#analyzeTutorStubResistanceActionRegisterBaseline' ||
    JSON.stringify(batch?.required_batches) !== JSON.stringify(['batch_A', 'batch_B']) ||
    batch.dialogues_per_batch !== 6 ||
    batch.maximum_model_attempt_reservations_per_dialogue !== 39 ||
    batch.maximum_model_attempt_reservations_per_batch !== 234 ||
    batch.combined_maximum_model_attempt_reservations !== 468 ||
    batch.combined_analysis_only !== true ||
    batch.valid_unit_reruns !== false ||
    batch.outcome_selection !== false ||
    batch.bounded_technical_recovery !==
      'missing_or_failed_units_only_within_unchanged_39_per_dialogue_and_234_per_batch_caps'
  ) {
    throw new Error('v2 endpoint live executor, combined analyzer, or fixed batch budget contract drifted');
  }
  return {
    ...preflight,
    execution_readiness_audit: {
      status: 'passed_zero_call',
      public_prefix_bundle: { path: bundlePath, sha256: sha256(bundleSource), prefixes: bundle.prefixes.length },
      exact_prefix_continuation: true,
      prebound_batches: ['batch_A', 'batch_B'],
      dialogues_per_batch: 6,
      maximum_model_attempt_reservations_per_dialogue: 39,
      maximum_model_attempt_reservations_per_batch: 234,
      combined_maximum_model_attempt_reservations: 468,
      combined_analysis_required: true,
      bounded_technical_recovery: 'missing_or_failed_units_only_under_unchanged_caps',
      partial_or_interim_interpretation_permitted: false,
      model_calls: 0,
      production_writes: 0,
    },
  };
}

export default {
  assembleTutorStubResistanceActionRegisterPreflight,
  buildTutorStubResistanceActionRegisterPreflightPackets,
  buildTutorStubResistanceActionRegisterSyntheticCorpus,
  runTutorStubResistanceActionRegisterEndpointPreflight,
};
