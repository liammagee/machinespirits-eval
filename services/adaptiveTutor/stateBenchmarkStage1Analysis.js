import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import { canonicalJson, hashCanonicalJson, sha256 } from '../experimentRunArtifacts.js';
import {
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
  buildTutorStubPublicLearnerAnalysisPrompt,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
} from '../tutorStubPublicLearnerAnalysis.js';
import {
  adaptiveStateStateBlindBaselineContractSha256,
  adaptiveStateStage0PredictionMetrics,
  buildAdaptiveStateOutOfFoldStateBlindBaselines,
  fitAdaptiveStateStage0Head,
  predictAdaptiveStateStage0Head,
} from './stateBenchmarkStage0Analysis.js';
import { validateAdaptiveStateStage1DatasetContentSha256 } from './stateBenchmarkStage1Executor.js';
import {
  buildAdaptiveStateRepresentationsV2,
} from './stateBenchmarkV2.js';
import { buildAdaptiveStateCliRealizerSystemPrompt } from './stateBenchmarkCliRealizer.js';
import { adaptiveStateTransitionAtomicSurface } from './stateBenchmarkPublicSurface.js';

export const ADAPTIVE_STATE_STAGE1_REPORT_V21_SCHEMA =
  'machinespirits.adaptive-state-stage1-technical-report.v2.1';
export const ADAPTIVE_STATE_STAGE1_SPLIT_MANIFEST_V21_SCHEMA =
  'machinespirits.adaptive-state-stage1-split-manifest.v2.1';

const TARGET_LABELS = Object.freeze({
  next_dag_event_family: Object.freeze(['retract', 'derive', 'adopt', 'none']),
  next_proof_trajectory: Object.freeze(['advance', 'regress', 'stall']),
});
const EXPECTED_TARGET_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'next_dag_event_family',
    labels: TARGET_LABELS.next_dag_event_family,
    owner: 'transition_harness',
  }),
  Object.freeze({
    id: 'next_proof_trajectory',
    labels: TARGET_LABELS.next_proof_trajectory,
    owner: 'world_normalized_proof_distance_and_debt_harness',
  }),
]);
const PUBLIC_INPUT_KEYS = Object.freeze([
  'currentTutorText',
  'learnerText',
  'priorPublicLearnerState',
  'promptContext',
  'publicReleaseLedger',
  'publicStagedEvidence',
  'publicTranscript',
  'topic',
  'turn',
  'tutorTurn',
  'world',
]);
const PUBLIC_WORLD_KEYS = Object.freeze(['background', 'discipline', 'id', 'question', 'rules', 'setting', 'title']);
const FORBIDDEN_KEY = /(?:^|_)(?:future|target|oracle|hidden|private|answer_key|event_family|event_ids|required_realizer_output|proof_transition)(?:_|$)/iu;
const FORBIDDEN_NON_ORACLE_KEY = /(?:^|_)(?:future|target|oracle|hidden|private|answer_key)(?:_|$)/iu;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function scanForbiddenKeys(value, location = 'input', failures = []) {
  if (!value || typeof value !== 'object') return failures;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) failures.push(`${location}.${key}`);
    scanForbiddenKeys(child, `${location}.${key}`, failures);
  }
  return failures;
}

function laneAxis(laneId) {
  if (laneId === 'world_transfer') return 'world_id';
  if (laneId === 'generator_transfer') return 'generator_id';
  if (laneId === 'realizer_transfer') return 'realizer_id';
  throw new Error(`stateBenchmarkStage1: unsupported split lane ${laneId}`);
}

function manifestContent(manifest) {
  const content = { ...manifest };
  delete content.content_sha256;
  return content;
}

export function adaptiveStateStage1SplitManifestContentSha256(manifest) {
  return hashCanonicalJson(manifestContent(manifest));
}

export function validateAdaptiveStateStage1SplitManifestContentSha256(manifest) {
  if (manifest?.content_sha256 !== adaptiveStateStage1SplitManifestContentSha256(manifest)) {
    throw new Error('stateBenchmarkStage1: split-manifest content SHA-256 mismatch');
  }
  return true;
}

export function buildAdaptiveStateStage1SplitManifest(rows, config) {
  const lanes = config.analysis.split_lanes.map((lane) => {
    const axis = laneAxis(lane.id);
    const levels = stable(new Set(rows.map((row) => String(row.groups[axis]))));
    return {
      id: lane.id,
      method: lane.method,
      axis,
      grouping:
        lane.id === 'realizer_transfer'
          ? 'paired_surface_realizer_exception_with_shared_latent_target'
          : 'groups.latent_pair_id',
      folds: levels.map((level) => ({
        id: `${lane.id}=${level}`,
        level,
        train_ids: rows.filter((row) => String(row.groups[axis]) !== level).map((row) => row.id),
        test_ids: rows.filter((row) => String(row.groups[axis]) === level).map((row) => row.id),
      })),
    };
  });
  const manifest = {
    schema: ADAPTIVE_STATE_STAGE1_SPLIT_MANIFEST_V21_SCHEMA,
    version: '2.1',
    stage: 's1_technical_pilot',
    confirmation_eligible: false,
    atomic_unit: 'latent_pair_id_except_paired_realizer_transfer',
    cluster_key: 'groups.latent_pair_id',
    rows: rows.length,
    lanes,
  };
  manifest.content_sha256 = adaptiveStateStage1SplitManifestContentSha256(manifest);
  return manifest;
}

function validateStage1SplitCoverage(splitManifest, rows) {
  validateAdaptiveStateStage1SplitManifestContentSha256(splitManifest);
  if (
    splitManifest.schema !== ADAPTIVE_STATE_STAGE1_SPLIT_MANIFEST_V21_SCHEMA ||
    splitManifest.version !== '2.1' ||
    splitManifest.stage !== 's1_technical_pilot' ||
    Number(splitManifest.rows) !== rows.length
  ) {
    throw new Error('stateBenchmarkStage1: split manifest does not match the v2.1 S1 dataset');
  }
  const allIds = new Set(rows.map((row) => row.id));
  if (allIds.size !== rows.length) throw new Error('stateBenchmarkStage1: dataset row ids are not unique');
  const rowById = new Map(rows.map((row) => [row.id, row]));
  for (const lane of splitManifest.lanes) {
    const testCounts = new Map(rows.map((row) => [row.id, 0]));
    for (const fold of lane.folds) {
      const train = new Set(fold.train_ids);
      const test = new Set(fold.test_ids);
      if (
        train.size !== fold.train_ids.length ||
        test.size !== fold.test_ids.length ||
        [...train].some((id) => test.has(id)) ||
        [...train, ...test].some((id) => !allIds.has(id)) ||
        new Set([...train, ...test]).size !== allIds.size
      ) {
        throw new Error(`stateBenchmarkStage1: split fold ${fold.id} leaks, duplicates, or omits rows`);
      }
      for (const id of test) testCounts.set(id, testCounts.get(id) + 1);
      if (lane.id !== 'realizer_transfer') {
        const placement = new Map();
        for (const id of allIds) {
          const pair = rowById.get(id).groups.latent_pair_id;
          const side = test.has(id) ? 'test' : 'train';
          const observed = placement.get(pair) || side;
          if (observed !== side) {
            throw new Error(`stateBenchmarkStage1: ${fold.id} splits a latent pair across train and test`);
          }
          placement.set(pair, side);
        }
      }
    }
    if ([...testCounts.values()].some((count) => count !== 1)) {
      throw new Error(`stateBenchmarkStage1: lane ${lane.id} does not test every row exactly once`);
    }
    if (
      lane.id === 'realizer_transfer' &&
      lane.grouping !== 'paired_surface_realizer_exception_with_shared_latent_target'
    ) {
      throw new Error('stateBenchmarkStage1: realizer transfer must document its paired-realizer exception');
    }
  }
  return true;
}

function validateArtifactRecord(call) {
  const failures = [];
  try {
    if (call.role === 'public_turn_analyzer' && call.status === 'success') {
    const artifacts = call.analyzer_artifacts || {};
    const expected = {
      public_model_input_sha256: hashCanonicalJson(call.public_model_input),
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
      learner_record_update_sha256: hashCanonicalJson(artifacts.learner_record_update),
      deterministic_update_sha256: hashCanonicalJson(artifacts.deterministic_update),
    };
    if (hashCanonicalJson(expected) !== hashCanonicalJson(call.artifact_hashes)) failures.push('analyzer_artifact_hash');
    try {
      const input = call.public_model_input;
      const reconstructedPrompt = buildTutorStubPublicLearnerAnalysisPrompt({
        learnerText: input.learnerText,
        topic: input.topic,
        world: input.world,
        tutorTurn: input.tutorTurn,
        currentTutorText: input.currentTutorText,
        publicTranscript: input.publicTranscript,
        publicStagedEvidence: input.publicStagedEvidence,
        priorPublicLearnerState: input.priorPublicLearnerState,
        includeBenchmarkTransitionEvent: true,
        strictProviderEnvelope: true,
      });
      if (
        artifacts.system_prompt !== TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT ||
        artifacts.prompt !== reconstructedPrompt ||
        hashCanonicalJson(artifacts.output_schema) !==
          hashCanonicalJson(
            buildTutorStubPublicLearnerAnalysisProviderOutputSchema({
              includeBenchmarkTransitionEvent: true,
            }),
          ) ||
        hashCanonicalJson(call.provenance?.hashes || {}) !==
          hashCanonicalJson({
            input_sha256: expected.model_input_envelope_sha256,
            system_prompt_sha256: expected.system_prompt_sha256,
            prompt_sha256: expected.prompt_sha256,
            output_schema_sha256: expected.output_schema_sha256,
            raw_output_sha256: expected.raw_output_sha256,
            parsed_output_sha256: expected.parsed_output_sha256,
          })
      ) {
        failures.push('analyzer_artifact_reconstruction');
      }
    } catch {
      failures.push('analyzer_artifact_reconstruction');
    }
    }
    if (call.role !== 'public_turn_analyzer' && call.status === 'success') {
    const artifacts = call.realizer_artifacts || {};
    const expected = {
      public_input_sha256: hashCanonicalJson(artifacts.public_input),
      system_prompt_sha256: sha256(artifacts.system_prompt),
      user_prompt_sha256: sha256(artifacts.user_prompt),
      raw_output_sha256: sha256(artifacts.raw_output),
      parsed_output_sha256: hashCanonicalJson(artifacts.parsed_output),
    };
    if (hashCanonicalJson(expected) !== hashCanonicalJson(call.artifact_hashes)) failures.push('realizer_artifact_hash');
    if (
      artifacts.system_prompt !== buildAdaptiveStateCliRealizerSystemPrompt() ||
      artifacts.user_prompt !== canonicalJson(artifacts.public_input) ||
      hashCanonicalJson(call.provenance?.hashes || {}) !==
        hashCanonicalJson({
          input_sha256: expected.public_input_sha256,
          system_prompt_sha256: expected.system_prompt_sha256,
          user_prompt_sha256: expected.user_prompt_sha256,
          raw_output_sha256: expected.raw_output_sha256,
          parsed_output_sha256: expected.parsed_output_sha256,
        })
    ) {
      failures.push('realizer_artifact_reconstruction');
    }
    }
  } catch {
    failures.push(call.role === 'public_turn_analyzer' ? 'analyzer_artifact_hash' : 'realizer_artifact_hash');
  }
  return failures;
}

function worldPremiseSurfaces(config, repoRoot) {
  return new Map(
    config.critical_path.worlds.map((row) => {
      const world = yaml.parse(fs.readFileSync(path.resolve(repoRoot, row.source), 'utf8'));
      return [
        row.id,
        (world.premises || []).map((premise) => ({
          premise: premise.id,
          authored_surface: String(premise.surface || '').trim(),
          surface: adaptiveStateTransitionAtomicSurface({
            question: world.question,
            surface: premise.surface,
          }),
          fact: clone(premise.fact),
        })),
      ];
    }),
  );
}

function auditPublicAnalyzerCall(call, premisesByWorld) {
  const failures = [];
  const input = call.public_model_input;
  if (!input || hashCanonicalJson(Object.keys(input).sort()) !== hashCanonicalJson([...PUBLIC_INPUT_KEYS].sort())) {
    failures.push('public_input_schema');
    return failures;
  }
  if (hashCanonicalJson(Object.keys(input.world || {}).sort()) !== hashCanonicalJson([...PUBLIC_WORLD_KEYS].sort())) {
    failures.push('public_world_not_redacted');
  }
  if (scanForbiddenKeys(input).length) failures.push('forbidden_analyzer_input_key');
  const benchmarkTransition = call.analyzer_artifacts?.parsed_output?.benchmark_transition;
  if (
    !benchmarkTransition ||
    !['retract', 'derive', 'adopt', 'none'].includes(benchmarkTransition.family) ||
    typeof benchmarkTransition.evidence_span !== 'string' ||
    !benchmarkTransition.evidence_span.trim() ||
    !String(input.learnerText || '').includes(benchmarkTransition.evidence_span)
  ) {
    failures.push('analyzer_benchmark_transition_evidence_span');
  }
  const prior = input.priorPublicLearnerState;
  if (
    !prior ||
    hashCanonicalJson(Object.keys(prior).sort()) !==
      hashCanonicalJson(
        ['adopted_premise_ids', 'asserted_answers', 'prior_hypotheses', 'voiced_derived_facts'].sort(),
      ) ||
    !Array.isArray(prior.adopted_premise_ids) ||
    prior.adopted_premise_ids.some((value) => typeof value !== 'string') ||
    !Array.isArray(prior.voiced_derived_facts) ||
    prior.voiced_derived_facts.some(
      (fact) => !Array.isArray(fact) || !fact.length || fact.some((value) => typeof value !== 'string'),
    ) ||
    !Array.isArray(prior.prior_hypotheses) ||
    prior.prior_hypotheses.some((value) => typeof value !== 'string') ||
    !Array.isArray(prior.asserted_answers) ||
    prior.asserted_answers.some((value) => typeof value !== 'string')
  ) {
    failures.push('prior_public_learner_state_schema');
  }
  if (
    !Array.isArray(input.publicTranscript) ||
    input.publicTranscript.some(
      (row) =>
        hashCanonicalJson(Object.keys(row || {}).sort()) !== hashCanonicalJson(['learner', 'turn', 'tutor']) ||
        Number(row.turn) >= Number(input.turn),
    )
  ) {
    failures.push('transcript_not_prior_completed_exchanges');
  }
  if (input.publicTranscript.length !== Math.max(0, Number(input.turn) - 1)) {
    failures.push('transcript_history_length');
  }
  const staged = input.publicStagedEvidence;
  const stagedRows = Array.isArray(staged) ? staged : [];
  if (
    !Array.isArray(staged) ||
    staged.some(
      (row) =>
        hashCanonicalJson(Object.keys(row || {}).sort()) !==
          hashCanonicalJson(['fact', 'premise', 'surface', 'turn', 'via']) ||
        !row.premise ||
        !Array.isArray(row.fact) ||
        !row.surface ||
        !Number.isInteger(Number(row.turn)),
    ) ||
    hashCanonicalJson(input.publicReleaseLedger) !== hashCanonicalJson(staged)
  ) {
    failures.push('public_staged_evidence_schema');
  }
  const worldId = input.promptContext?.world_id;
  const premises = premisesByWorld.get(worldId) || [];
  const stagedIds = new Set(stagedRows.map((row) => row.premise));
  for (const row of stagedRows) {
    const source = premises.find((premise) => premise.premise === row.premise);
    if (!source || hashCanonicalJson(source.fact) !== hashCanonicalJson(row.fact) || source.surface !== row.surface) {
      failures.push('unknown_or_mutated_staged_premise');
    }
  }
  const prompt = String(call.analyzer_artifacts?.prompt || '');
  if (
    premises.some(
      (row) =>
        !stagedIds.has(row.premise) &&
        [row.surface, row.authored_surface].filter(Boolean).some((surface) => prompt.includes(surface)),
    )
  ) {
    failures.push('unreleased_premise_in_analyzer_prompt');
  }
  return failures;
}

function scanNonOracleRepresentation(value, localIds, location = 'representation', failures = []) {
  if (!value || typeof value !== 'object') return failures;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_NON_ORACLE_KEY.test(key)) failures.push(`${location}.${key}`);
    if (
      typeof child === 'string' &&
      [...localIds].some((localId) => child === localId || child.includes(localId))
    ) {
      failures.push(`${location}.${key}=world_local_id`);
    }
    scanNonOracleRepresentation(child, localIds, `${location}.${key}`, failures);
  }
  return failures;
}

function expectedMatrixCells(plan) {
  const expected = new Map();
  for (const job of plan.jobs) expected.set(job.cell_id, (expected.get(job.cell_id) || 0) + 1);
  return expected;
}

function auditMatrix(dialogues, rows, plan) {
  const failures = [];
  const expected = expectedMatrixCells(plan);
  const actual = new Map();
  for (const dialogue of dialogues) actual.set(dialogue.cell_id, (actual.get(dialogue.cell_id) || 0) + 1);
  if (
    expected.size !== Number(plan.counts.crossed_cells) ||
    actual.size !== expected.size ||
    [...expected].some(([cell, count]) => actual.get(cell) !== count) ||
    [...actual].some(([cell]) => !expected.has(cell))
  ) {
    failures.push('crossed_matrix_incomplete');
  }
  const rowsByDialogue = new Map();
  for (const row of rows) rowsByDialogue.set(row.groups.dialogue_id, (rowsByDialogue.get(row.groups.dialogue_id) || 0) + 1);
  if (
    dialogues.some(
      (dialogue) =>
        rowsByDialogue.get(dialogue.id) !== Number(dialogue.scored_transitions) ||
        Number(dialogue.learner_realizer_calls) !== 7 ||
        Number(dialogue.public_turn_analyzer_calls) !== 7 ||
        Number(dialogue.cli_process_dispatches) !== 14 ||
        dialogue.observation_source !== 'live_public_text_analyzer' ||
        dialogue.kernel_derived_classifier !== false,
    )
  ) {
    failures.push('dialogue_contract_incomplete');
  }
  return { failures, expected, actual };
}

function auditCallRoles(calls, plan) {
  const failures = [];
  const matrix = calls.filter((call) => call.matrix_scored_call === true);
  const canaries = calls.filter((call) => call.excluded_technical_canary === true);
  const count = (subset, role) => subset.filter((call) => call.role === role).length;
  const expectedRealizerByRole = Object.fromEntries(
    ['codex_terra', 'claude_sonnet'].map((realizerId) => [
      realizerId === 'codex_terra' ? 'codex_realizer' : 'claude_realizer',
      plan.jobs
        .filter((job) => job.language_realizer.id === realizerId)
        .reduce((sum, job) => sum + Number(job.expected_learner_realizer_calls), 0),
    ]),
  );
  const expected = {
    matrix: {
      codex_realizer: expectedRealizerByRole.codex_realizer,
      claude_realizer: expectedRealizerByRole.claude_realizer,
      public_turn_analyzer: Number(plan.counts.expected_public_turn_analyzer_calls),
    },
    canary: { codex_realizer: 1, claude_realizer: 1, public_turn_analyzer: 1 },
  };
  for (const [role, expectedCount] of Object.entries(expected.matrix)) {
    if (count(matrix, role) !== expectedCount) failures.push('matrix_call_role_count');
  }
  for (const [role, expectedCount] of Object.entries(expected.canary)) {
    if (count(canaries, role) !== expectedCount) failures.push('canary_call_role_count');
  }
  if (
    expected.matrix.codex_realizer !== 84 ||
    expected.matrix.claude_realizer !== 84 ||
    expected.matrix.public_turn_analyzer !== 168 ||
    calls.some(
      (call, index) =>
        call.id !== `s1-call-${String(index + 1).padStart(4, '0')}` ||
        call.matrix_scored_call === call.excluded_technical_canary,
    )
  ) {
    failures.push('frozen_call_partition_mismatch');
  }
  if (
    calls
      .filter((call) => call.role === 'public_turn_analyzer')
      .some((call) => call.postprocessor_status !== 'success')
  ) {
    failures.push('analyzer_postprocessor_incomplete');
  }
  return {
    failures,
    expected,
    observed: {
      matrix: Object.fromEntries(Object.keys(expected.matrix).map((role) => [role, count(matrix, role)])),
      canary: Object.fromEntries(Object.keys(expected.canary).map((role) => [role, count(canaries, role)])),
    },
  };
}

function hydratedObservation(observation) {
  return {
    ...clone(observation),
    accepted_events: (observation?.accepted_event_kinds || []).map((kind, index) => ({
      kind,
      audit_reconstruction_index: index,
    })),
  };
}

function taskFromCommon(common) {
  const task = common?.task || {};
  return {
    knowledge_component: task.knowledge_component,
    prerequisite_path: Array.from({ length: Number(task.prerequisite_count || 0) }, (_, index) => `p${index}`),
    item_difficulty: task.item_difficulty,
    item_discrimination: task.item_discrimination,
  };
}

function auditRepresentations(rows, dialogues, plan, localIds) {
  const failures = [];
  const expectedNames = new Set(plan.representations);
  const dialogueById = new Map(dialogues.map((dialogue) => [dialogue.id, dialogue]));
  let commonInputMismatchCount = 0;
  let reconstructionMismatchCount = 0;
  const leakagePaths = [];
  for (const row of rows) {
    const names = Object.keys(row.representations || {});
    if (names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
      failures.push('representation_set_incomplete');
      continue;
    }
    const common = canonicalJson(row.representations.no_state.common);
    for (const representation of Object.values(row.representations)) {
      if (canonicalJson(representation.common) !== common) commonInputMismatchCount += 1;
    }
    for (const [name, representation] of Object.entries(row.representations)) {
      if (name === 'oracle') continue;
      scanNonOracleRepresentation(representation, localIds, `${row.id}.${name}`, leakagePaths);
    }
    const dialogue = dialogueById.get(row.groups.dialogue_id);
    const donor = dialogueById.get(row.controls?.scramble_donor_dialogue_id);
    const currentObservation = hydratedObservation(dialogue?.observations?.[row.turn]);
    const previousObservation = hydratedObservation(dialogue?.observations?.[row.turn - 1]);
    const donorObservation = hydratedObservation(donor?.observations?.[row.turn]);
    try {
      const rebuilt = buildAdaptiveStateRepresentationsV2({
        observation: currentObservation,
        previousObservation,
        matchedDagDonorObservation: donorObservation,
        matchedFieldDonorObservation: donorObservation,
        task: taskFromCommon(row.representations.no_state.common),
      });
      for (const name of expectedNames) {
        if (name === 'oracle') continue;
        if (canonicalJson(rebuilt[name]) !== canonicalJson(row.representations[name])) {
          reconstructionMismatchCount += 1;
        }
      }
    } catch {
      reconstructionMismatchCount += 1;
    }
  }
  if (commonInputMismatchCount) failures.push('representation_common_input_mismatch');
  if (reconstructionMismatchCount) failures.push('representation_control_reconstruction_mismatch');
  if (leakagePaths.length) failures.push('non_oracle_leakage');
  return {
    failures,
    common_input_mismatch_count: commonInputMismatchCount,
    reconstruction_mismatch_count: reconstructionMismatchCount,
    leakage: { count: leakagePaths.length, paths: leakagePaths.slice(0, 20) },
  };
}

function targetDegeneracy(rows, plan) {
  const degeneracy = [];
  for (const [axis, levels] of [
    ['generator_id', plan.axes.latent_generators],
    ['realizer_id', plan.axes.realizers],
  ]) {
    for (const level of levels) {
      const subset = rows.filter((row) => row.groups[axis] === level);
      for (const target of plan.co_primary_targets) {
        const labels = stable(new Set(subset.map((row) => String(row.targets[target]))));
        if (labels.length < 2) degeneracy.push({ axis, level, target, labels });
      }
    }
  }
  return degeneracy;
}

function frozenTargetContracts(config) {
  const contracts = config.targets.co_primary.map((target) => ({
    id: target.id,
    labels: [...target.labels],
    owner: target.owner,
  }));
  if (hashCanonicalJson(contracts) !== hashCanonicalJson(EXPECTED_TARGET_CONTRACTS)) {
    throw new Error('stateBenchmarkStage1: target contracts differ from the frozen v2.1 vocabulary');
  }
  return contracts;
}

function pairedTargetDrift(rows, expectedRealizers) {
  const drift = [];
  const pairs = new Map();
  for (const row of rows) {
    const values = pairs.get(row.groups.latent_pair_id) || [];
    values.push(row);
    pairs.set(row.groups.latent_pair_id, values);
  }
  for (const [pairId, pairRows] of pairs) {
    const byRealizer = new Map();
    for (const row of pairRows) {
      const values = byRealizer.get(row.groups.realizer_id) || [];
      values.push(row);
      byRealizer.set(row.groups.realizer_id, values);
    }
    const signatures = new Set(
      [...byRealizer.values()].map((values) =>
        hashCanonicalJson(
          values
            .sort((left, right) => left.turn - right.turn)
            .map((row) => ({ turn: row.turn, targets: row.targets })),
        ),
      ),
    );
    if (byRealizer.size !== expectedRealizers || signatures.size !== 1) drift.push(pairId);
  }
  return drift;
}

function controlSensitivity(rows, generators, realizers) {
  const comparisons = [
    ['dag_trajectory', 'dag_scramble'],
    ['dag_trajectory', 'dag_stale'],
    ['field_trajectory', 'field_scramble'],
    ['field_trajectory', 'field_stale'],
  ];
  const byGenerator = {};
  const byRealizer = {};
  let passed = true;
  const checkAxis = (values, groupKey, destination) => {
    for (const value of values) {
      const subset = rows.filter((row) => row.groups[groupKey] === value);
      destination[value] = {};
      for (const [candidate, control] of comparisons) {
        const comparable = subset.filter(
          (row) =>
            row.representations?.[candidate]?.additional_state !== undefined &&
            row.representations?.[control]?.additional_state !== undefined,
        );
        const differing = comparable.filter(
          (row) =>
            hashCanonicalJson(row.representations[candidate].additional_state) !==
            hashCanonicalJson(row.representations[control].additional_state),
        ).length;
        const complete = comparable.length === subset.length;
        destination[value][`${candidate}_vs_${control}`] = {
          differing_rows: differing,
          comparable_rows: comparable.length,
          expected_rows: subset.length,
          passed: complete && differing > 0,
        };
        passed &&= complete && differing > 0;
      }
    }
  };
  checkAxis(generators, 'generator_id', byGenerator);
  checkAxis(realizers, 'realizer_id', byRealizer);
  return { passed, by_generator: byGenerator, by_realizer: byRealizer };
}

function analyzerEventFamilyRecovery(rows, config) {
  const floor = config.paid_execution_contract.public_turn_analyzer.recovery_floor;
  const agrees = (row) =>
    row.descriptive_analyzer_alignment?.analyzer_next_event_family ===
    row.targets?.next_dag_event_family;
  const rate = (subset) =>
    subset.length ? subset.filter(agrees).length / subset.length : 0;
  const overall = rate(rows);
  const byGenerator = Object.fromEntries(
    config.critical_path.latent_generators.map((generator) => [
      generator.id,
      rate(rows.filter((row) => row.groups.generator_id === generator.id)),
    ]),
  );
  const byRealizer = Object.fromEntries(
    config.critical_path.language_realizers.map((realizer) => [
      realizer.id,
      rate(rows.filter((row) => row.groups.realizer_id === realizer.id)),
    ]),
  );
  const passed =
    overall >= Number(floor.overall_minimum) &&
    Object.values(byGenerator).every((value) => value >= Number(floor.each_generator_minimum)) &&
    Object.values(byRealizer).every((value) => value >= Number(floor.each_realizer_minimum));
  return {
    metric: floor.metric,
    passed,
    overall,
    by_generator: byGenerator,
    by_realizer: byRealizer,
    floors: {
      overall: Number(floor.overall_minimum),
      each_generator: Number(floor.each_generator_minimum),
      each_realizer: Number(floor.each_realizer_minimum),
    },
    label_owner: 'frozen_transition_harness',
    disagreements_relabel_or_exclude_rows: false,
  };
}

function auditAnalyzerTransitionBindings(rows, dialogues, calls) {
  const failures = [];
  const dialogueById = new Map(dialogues.map((dialogue) => [dialogue.id, dialogue]));
  const analyzerCallByTurn = new Map(
    calls
      .filter((call) => call.matrix_scored_call && call.role === 'public_turn_analyzer')
      .map((call) => [`${call.job_id}:${call.turn}`, call]),
  );
  for (const row of rows) {
    const realizedTurn = Number(row.turn) + 1;
    const dialogue = dialogueById.get(row.groups?.dialogue_id);
    const observation = dialogue?.observations?.find(
      (candidate) => Number(candidate?.turn) === realizedTurn,
    );
    const analyzerCall = analyzerCallByTurn.get(`${row.groups?.dialogue_id}:${realizedTurn}`);
    const rowFamily = row.descriptive_analyzer_alignment?.analyzer_next_event_family;
    const observationFamily = observation?.benchmark_transition?.family;
    const parsedFamily = analyzerCall?.analyzer_artifacts?.parsed_output?.benchmark_transition?.family;
    const harnessFamily = row.targets?.next_dag_event_family;
    if (
      !['retract', 'derive', 'adopt', 'none'].includes(rowFamily) ||
      hashCanonicalJson(row.descriptive_analyzer_alignment?.analyzer_next_event_families) !==
        hashCanonicalJson([rowFamily]) ||
      rowFamily !== observationFamily ||
      rowFamily !== parsedFamily
    ) {
      failures.push('analyzer_transition_binding_mismatch');
    }
    if (row.descriptive_analyzer_alignment?.agrees !== (rowFamily === harnessFamily)) {
      failures.push('analyzer_alignment_flag_mismatch');
    }
  }
  return failures;
}

function emptyPriorPublicLearnerState() {
  return {
    adopted_premise_ids: [],
    voiced_derived_facts: [],
    prior_hypotheses: [],
    asserted_answers: [],
  };
}

function advancePriorPublicLearnerState(previous, deterministicUpdate) {
  const next = clone(previous || emptyPriorPublicLearnerState());
  const accepted = deterministicUpdate?.accepted || {};
  const adopted = new Set(next.adopted_premise_ids || []);
  for (const premiseId of accepted.retract || []) adopted.delete(String(premiseId));
  for (const premiseId of accepted.adopt || []) adopted.add(String(premiseId));
  next.adopted_premise_ids = [...adopted].sort();
  const derived = new Map(
    (next.voiced_derived_facts || []).map((fact) => [hashCanonicalJson(fact), clone(fact)]),
  );
  for (const fact of accepted.derive || []) derived.set(hashCanonicalJson(fact), clone(fact));
  next.voiced_derived_facts = [...derived.values()];
  if (typeof accepted.hypothesis === 'string' && accepted.hypothesis.trim()) {
    next.prior_hypotheses = [...new Set([...(next.prior_hypotheses || []), accepted.hypothesis.trim()])];
  }
  if (typeof accepted.assertAnswer === 'string' && accepted.assertAnswer.trim()) {
    next.asserted_answers = [...new Set([...(next.asserted_answers || []), accepted.assertAnswer.trim()])];
  }
  return next;
}

function auditPriorPublicLearnerStateSequence(calls) {
  const failures = [];
  const byDialogue = new Map();
  for (const call of calls.filter(
    (candidate) => candidate.matrix_scored_call && candidate.role === 'public_turn_analyzer',
  )) {
    const values = byDialogue.get(call.job_id) || [];
    values.push(call);
    byDialogue.set(call.job_id, values);
  }
  for (const values of byDialogue.values()) {
    let expected = emptyPriorPublicLearnerState();
    const ordered = values.sort((left, right) => Number(left.turn) - Number(right.turn));
    if (ordered.some((call, index) => Number(call.turn) !== index + 1)) {
      failures.push('prior_public_learner_state_sequence_mismatch');
    }
    for (const call of ordered) {
      if (hashCanonicalJson(call.public_model_input?.priorPublicLearnerState) !== hashCanonicalJson(expected)) {
        failures.push('prior_public_learner_state_sequence_mismatch');
      }
      expected = advancePriorPublicLearnerState(
        expected,
        call.analyzer_artifacts?.deterministic_update,
      );
    }
  }
  return failures;
}

export function auditAdaptiveStateStage1Dataset(dataset, plan, config, { repoRoot = path.resolve('.') } = {}) {
  const failures = [];
  const calls = dataset.calls || [];
  const dialogues = dataset.dialogues || [];
  const rows = dataset.rows || [];
  if (dialogues.length !== plan.counts.dialogue_jobs) failures.push('dialogue_count_mismatch');
  if (rows.length !== plan.counts.scored_transitions) failures.push('transition_count_mismatch');
  if (dataset.model_call_count !== 336) failures.push('scored_dispatch_count_mismatch');
  if (dataset.model_call_count_including_excluded_canaries !== 339) failures.push('total_dispatch_count_mismatch');
  if (calls.length !== 339) failures.push('ledger_length_mismatch');
  if (
    dataset.scored_cli_dispatch_count !== 336 ||
    dataset.total_cli_dispatch_count !== 339 ||
    dataset.model_call_count_semantics !== 'cli_process_dispatches_not_backend_requests' ||
    dataset.deprecated_model_call_count_alias_semantics !==
      'cli_process_dispatches_not_backend_requests' ||
    dataset.backend_request_count !== 'unknown'
  ) {
    failures.push('cli_dispatch_semantics_mismatch');
  }
  if (dataset.execution_mode === 'paid_cli' && !dataset.execution_transaction?.run_plan_sha256) {
    failures.push('paid_execution_transaction_missing');
  }
  if (
    calls.some(
      (call) =>
        call.claim_eligible !== false ||
        call.technical_pilot !== true ||
        call.status !== 'success' ||
        Number(call.provenance?.dispatch_count) !== 1 ||
        Number(call.provenance?.wrapper_attempts) !== 1 ||
        call.provenance?.backend_request_count !== 'unknown' ||
        Number(call.provenance?.prohibited_tool_event_count) !== 0 ||
        Number(call.provenance?.invalid_stream_lines) !== 0 ||
        !call.provenance?.structured_event_audit,
    )
  ) {
    failures.push('nonconfirmatory_call_contract');
  }
  const matrixCalls = calls.filter((call) => call.matrix_scored_call);
  const canaryCalls = calls.filter((call) => call.excluded_technical_canary);
  if (matrixCalls.length !== 336 || canaryCalls.length !== 3) failures.push('matrix_canary_partition');
  const callRoles = auditCallRoles(calls, plan);
  failures.push(...callRoles.failures);
  const accounting = dataset.call_accounting || {};
  if (
    accounting.planned !== 339 ||
    accounting.reached !== 339 ||
    accounting.dispatched !== 339 ||
    accounting.completed !== 339 ||
    accounting.failed !== 0
  ) {
    failures.push('call_accounting_mismatch');
  }
  const artifactFailures = calls.flatMap(validateArtifactRecord);
  if (artifactFailures.length) failures.push(...artifactFailures);
  const premisesByWorld = worldPremiseSurfaces(config, repoRoot);
  const analyzerInputFailures = calls
    .filter((call) => call.role === 'public_turn_analyzer')
    .flatMap((call) => auditPublicAnalyzerCall(call, premisesByWorld));
  if (analyzerInputFailures.length) failures.push(...analyzerInputFailures);
  const analyzerTransitionBindingFailures = auditAnalyzerTransitionBindings(rows, dialogues, calls);
  if (analyzerTransitionBindingFailures.length) failures.push(...analyzerTransitionBindingFailures);
  const priorPublicLearnerStateFailures = auditPriorPublicLearnerStateSequence(calls);
  if (priorPublicLearnerStateFailures.length) failures.push(...priorPublicLearnerStateFailures);

  const matrix = auditMatrix(dialogues, rows, plan);
  failures.push(...matrix.failures);
  const representations = auditRepresentations(
    rows,
    dialogues,
    plan,
    new Set(dataset.world_local_fact_ids || []),
  );
  failures.push(...representations.failures);
  const degeneracy = targetDegeneracy(rows, plan);
  if (degeneracy.length) failures.push('target_degenerate_within_axis');
  const targetContracts = frozenTargetContracts(config);
  if (
    hashCanonicalJson(targetContracts.map((target) => target.id)) !==
      hashCanonicalJson(plan.co_primary_targets) ||
    rows.some((row) =>
      targetContracts.some(
        (target) => !target.labels.includes(String(row.targets?.[target.id])),
      ),
    )
  ) {
    failures.push('target_contract_mismatch');
  }

  const targetDrift = pairedTargetDrift(rows, plan.axes.realizers.length);
  if (targetDrift.length) failures.push('realizer_changed_latent_target');
  const controls = controlSensitivity(rows, plan.axes.latent_generators, plan.axes.realizers);
  if (!controls.passed) failures.push('control_sensitivity_failure');
  const recovery = analyzerEventFamilyRecovery(rows, config);
  if (!recovery.passed) failures.push('public_analyzer_event_family_recovery_below_floor');
  const dialogueById = new Map(dialogues.map((row) => [row.id, row]));
  const donorUses = new Map();
  for (const row of rows) {
    const donor = dialogueById.get(row.controls?.scramble_donor_dialogue_id);
    if (
      !donor ||
      donor.id === row.groups.dialogue_id ||
      Number(donor.seed) === Number(row.groups.seed) ||
      donor.world_id !== row.groups.world_id ||
      donor.generator_id !== row.groups.generator_id ||
      donor.realizer_id !== row.groups.realizer_id ||
      donor.action_schedule?.[row.turn - 1] !== row.action?.id ||
      Number(row.controls?.scramble_donor_turn) !== Number(row.turn) ||
      Number(row.controls?.stale_observation_turn) !== Number(row.turn) - 1
    ) {
      failures.push('illegal_scramble_donor');
    }
    donorUses.set(donor?.id, (donorUses.get(donor?.id) || 0) + 1);
    const dialogue = dialogueById.get(row.groups.dialogue_id);
    const expected = dialogue?.target_sequence?.[row.turn - 1];
    if (hashCanonicalJson(expected) !== hashCanonicalJson(row.targets)) failures.push('non_harness_target');
  }
  if (
    donorUses.size !== dialogues.length ||
    [...donorUses.values()].some((count) => count !== Number(config.critical_path.dialogue.scored_transitions))
  ) {
    failures.push('cyclic_donor_imbalance');
  }
  return {
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    matrix: {
      crossed_cells: new Set(dialogues.map((row) => row.cell_id)).size,
      dialogues: dialogues.length,
      independent_latent_clusters: new Set(dialogues.map((row) => row.latent_pair_id)).size,
      transitions: rows.length,
      expected_cell_counts: Object.fromEntries(stable(matrix.expected.keys()).map((id) => [id, matrix.expected.get(id)])),
      observed_cell_counts: Object.fromEntries(stable(matrix.actual.keys()).map((id) => [id, matrix.actual.get(id)])),
    },
    calls: clone(accounting),
    call_roles: callRoles,
    public_input_failures: [...new Set(analyzerInputFailures)],
    representations,
    target_degeneracy: degeneracy,
    target_contracts: targetContracts,
    paired_realizer_target_drift: targetDrift,
    controls,
    public_analyzer_event_family_recovery: recovery,
    donor_use_counts: Object.fromEntries(stable(donorUses.keys()).map((id) => [id, donorUses.get(id)])),
    analyzer_harness_disagreements: rows.filter(
      (row) =>
        row.descriptive_analyzer_alignment?.analyzer_next_event_family !==
        row.targets?.next_dag_event_family,
    ).length,
  };
}

function outOfFoldNoStatePredictions(rows, splitManifest, target, config) {
  const lane = splitManifest.lanes.find((row) => row.id === 'world_transfer');
  const byId = new Map(rows.map((row) => [row.id, row]));
  const predictions = [];
  const models = [];
  for (const fold of lane.folds) {
    const training = fold.train_ids.map((id) => byId.get(id));
    const testing = fold.test_ids.map((id) => byId.get(id));
    const model = fitAdaptiveStateStage0Head(training, {
      representation: 'no_state',
      target,
      labels: TARGET_LABELS[target],
      lambda: config.analysis.fixed_head_contract.regularization.lambda,
      regularizationScaling: config.analysis.fixed_head_contract.regularization.scaling,
      learningRate: config.analysis.fixed_head_contract.solver.learning_rate,
      maximumIterations: config.analysis.fixed_head_contract.solver.maximum_iterations,
      convergenceTolerance: config.analysis.fixed_head_contract.solver.convergence_tolerance,
      convergenceCriterion: config.analysis.fixed_head_contract.solver.convergence_criterion,
      probabilityClip: config.analysis.fixed_head_contract.probability_clip,
    });
    models.push({ fold: fold.id, converged: model.converged, iterations: model.iterations });
    predictions.push(...predictAdaptiveStateStage0Head(model, testing));
  }
  return { predictions, models };
}

function oraclePredictions(rows, target) {
  return rows.map((row) => ({
    id: row.id,
    dialogue_id: row.groups.dialogue_id,
    truth: String(row.targets[target]),
    probabilities: clone(row.representations.oracle.additional_state.distributions[target]),
  }));
}

function reportContent(report) {
  const content = { ...report };
  delete content.content_sha256;
  return content;
}

export function adaptiveStateStage1ReportContentSha256(report) {
  return hashCanonicalJson(reportContent(report));
}

export function validateAdaptiveStateStage1ReportContentSha256(report) {
  if (report?.content_sha256 !== adaptiveStateStage1ReportContentSha256(report)) {
    throw new Error('stateBenchmarkStage1: report content SHA-256 mismatch');
  }
  if (
    report.schema !== ADAPTIVE_STATE_STAGE1_REPORT_V21_SCHEMA ||
    report.version !== '2.1' ||
    report.stage !== 's1_technical_pilot' ||
    report.confirmation_eligible !== false ||
    report.s2_validity_verdict !== null ||
    report.protocol?.gate_eligible !== false ||
    hashCanonicalJson(report.protocol?.target_contracts) !== hashCanonicalJson(EXPECTED_TARGET_CONTRACTS)
  ) {
    throw new Error('stateBenchmarkStage1: report contract differs from the frozen non-confirmatory v2.1 protocol');
  }
  return true;
}

export function buildAdaptiveStateStage1Report({ dataset, plan, config, splitManifest, repoRoot = path.resolve('.') }) {
  validateAdaptiveStateStage1DatasetContentSha256(dataset);
  if (
    dataset.version !== '2.1' ||
    dataset.stage !== 's1_technical_pilot' ||
    dataset.design_sha256 !== plan.design_sha256 ||
    dataset.config_sha256 !== plan.config_sha256 ||
    dataset.config_sha256 !== dataset.parent?.config_sha256 ||
    plan.config_sha256 !== hashCanonicalJson(config)
  ) {
    throw new Error('stateBenchmarkStage1: dataset, plan, config, and S0 parent are not the same frozen design');
  }
  validateStage1SplitCoverage(splitManifest, dataset.rows);
  const audit = auditAdaptiveStateStage1Dataset(dataset, plan, config, { repoRoot });
  const instrument = {};
  const baselineContract = config.analysis.state_blind_baseline_contract;
  const baselineContractSha256 = adaptiveStateStateBlindBaselineContractSha256(baselineContract);
  const baselineSanity = {
    passed: true,
    contract: clone(baselineContract),
    contract_sha256: baselineContractSha256,
    targets: {},
  };
  let oraclePass = true;
  let headsConverged = true;
  for (const target of plan.co_primary_targets) {
    const labels = TARGET_LABELS[target];
    const baseline = outOfFoldNoStatePredictions(dataset.rows, splitManifest, target, config);
    const stateBlind = buildAdaptiveStateOutOfFoldStateBlindBaselines(dataset.rows, splitManifest, {
      target,
      labels,
      contract: baselineContract,
    });
    const noState = adaptiveStateStage0PredictionMetrics(baseline.predictions, labels);
    const classPrior = adaptiveStateStage0PredictionMetrics(stateBlind.class_prior.predictions, labels);
    const uniform = adaptiveStateStage0PredictionMetrics(stateBlind.uniform.predictions, labels);
    const oracle = adaptiveStateStage0PredictionMetrics(oraclePredictions(dataset.rows, target), labels);
    const stateBlindMetrics = { no_state: noState, class_prior: classPrior, uniform };
    const beats = Object.fromEntries(
      Object.entries(stateBlindMetrics).map(([id, metrics]) => [
        id,
        oracle.log_loss < metrics.log_loss && oracle.brier_score < metrics.brier_score,
      ]),
    );
    const beatsAll = Object.values(beats).every(Boolean);
    headsConverged &&= baseline.models.every((row) => row.converged);
    oraclePass &&= beatsAll;
    const expectedUniform = 1 / labels.length;
    const sanityPassed =
      stateBlind.class_prior.folds.every(
        (fold) =>
          Object.values(fold.probabilities).every((probability) => Number(probability) > 0) &&
          Math.abs(Object.values(fold.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12,
      ) &&
      stateBlind.uniform.predictions.every((prediction) =>
        labels.every((label) => prediction.probabilities[label] === expectedUniform),
      );
    baselineSanity.passed &&= sanityPassed;
    baselineSanity.targets[target] = {
      passed: sanityPassed,
      class_prior_folds: clone(stateBlind.class_prior.folds),
      uniform_probability: expectedUniform,
      no_test_frequency_access: true,
    };
    instrument[target] = {
      oracle,
      no_state: noState,
      class_prior: classPrior,
      uniform,
      delta_state_blind_minus_oracle: Object.fromEntries(
        Object.entries(stateBlindMetrics).map(([id, metrics]) => [
          id,
          {
            log_loss: metrics.log_loss - oracle.log_loss,
            brier_score: metrics.brier_score - oracle.brier_score,
          },
        ]),
      ),
      oracle_beats_each_state_blind_baseline_on_both_metrics: beats,
      oracle_beats_all_state_blind_baselines_on_both_metrics: beatsAll,
      oracle_beats_no_state_on_both_metrics: beats.no_state,
      no_state_folds: baseline.models,
      class_prior_folds: clone(stateBlind.class_prior.folds),
    };
  }
  const stopReasons = [...audit.failures];
  if (!headsConverged) stopReasons.push('fixed_head_nonconvergence');
  if (!baselineSanity.passed) stopReasons.push('state_blind_baseline_sanity_failure');
  if (!oraclePass) stopReasons.push('oracle_fails_to_beat_all_state_blind_baselines_on_both_primary_targets');
  if (dataset.execution_mode !== 'paid_cli') stopReasons.push('non_paid_test_execution');
  const technicalPass = stopReasons.length === 0;
  const report = {
    schema: ADAPTIVE_STATE_STAGE1_REPORT_V21_SCHEMA,
    version: '2.1',
    stage: 's1_technical_pilot',
    status: technicalPass ? 'pass' : dataset.execution_mode === 'paid_cli' ? 'stop' : 'test_only',
    confirmation_eligible: false,
    s2_validity_verdict: null,
    decision: technicalPass
      ? 'authorize_fixed_eight_s2_prerequisite'
      : dataset.execution_mode === 'paid_cli'
        ? 'stop_and_repair_s1'
        : 'mock_verification_only_no_promotion',
    claim_boundary: config.claim_boundary,
    provenance: {
      design_sha256: plan.design_sha256,
      dataset_sha256: dataset.content_sha256,
      split_manifest_sha256: splitManifest.content_sha256,
      parent_s0: clone(dataset.parent),
    },
    coverage: {
      worlds: [...plan.axes.worlds],
      latent_generators: [...plan.axes.latent_generators],
      language_realizers: [...plan.axes.realizers],
      realized_dialogues: dataset.dialogues.length,
      independent_latent_clusters: new Set(dataset.dialogues.map((row) => row.latent_pair_id)).size,
      scored_transitions: dataset.rows.length,
      scored_cli_dispatches: dataset.scored_cli_dispatch_count,
      excluded_technical_canary_calls: dataset.excluded_technical_canary_call_count,
      total_cli_dispatches: dataset.total_cli_dispatch_count,
      backend_request_count: 'unknown',
    },
    protocol: {
      execution_order: dataset.execution_order,
      any_dialogue_failure_stops_stage: true,
      semantic_rerolls: dataset.semantic_rerolls,
      call_count_semantics: dataset.model_call_count_semantics,
      wrapper_attempts_per_turn: 1,
      backend_request_count: 'unknown',
      backend_retries_observed: false,
      s2_sample_size_rule: 'fixed_eight_seeds_per_crossed_cell_no_power_claim',
      public_turn_analyzer_every_realized_turn: true,
      kernel_derived_classifier_forbidden: true,
      sensor_profile: 'canonical_policy_invariant_no_memory_no_register',
      live_default_equivalence_claimed: false,
      deployment_claim_requires_integration_parity_bridge: true,
      model_attestation_basis: 'explicit_cli_argument_accepted',
      independently_attested_backend_identity: false,
      state_blind_baselines: {
        ids: ['no_state', 'class_prior', 'uniform'],
        contract: clone(baselineContract),
        contract_sha256: baselineContractSha256,
        no_test_time_baseline_selection: true,
      },
      target_contracts: frozenTargetContracts(config),
      primary_lane: 'world_transfer',
      gate_eligible: false,
      note:
        'S1 is a paid technical observation pilot for the canonical no-memory/no-register sensor only. It can never emit the S2 learner-state validity verdict or claim parity with the live default tutor sensor.',
    },
    structural_audit: audit,
    baseline_sanity: baselineSanity,
    instrument,
    stop_reasons: [...new Set(stopReasons)],
  };
  report.content_sha256 = adaptiveStateStage1ReportContentSha256(report);
  return report;
}
