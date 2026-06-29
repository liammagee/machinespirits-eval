#!/usr/bin/env node
// Synthetic Character-DAG drama framework benchmark.
//
// This runner extends the adaptive DAG/resistance character-state harness with
// fixture-driven dramatic phases, peripeteia checks, shuffled-state controls,
// and trace artifacts. It remains synthetic-only: no human-learning claim and
// no real interior-state claim.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import yaml from 'yaml';
import { runScenario } from '../services/adaptiveTutor/runner.js';
import {
  CHARACTER_AXES,
  characterMaturityScore,
  characterStateForTutorContext,
  initialCharacterState,
  shouldUseMatureFirstResponse,
  updateCharacterStateFromEvidence,
} from '../services/adaptiveTutor/characterState.js';
import { analyzePeripeteia } from './analyze-poetics-tutor-adaptation.js';
import { setActiveCellConfig, clearActiveCellConfig } from '../services/adaptiveTutor/realLLM.js';

export const DEFAULT_FIXTURE_PATH = 'config/character-dag-drama-framework.yaml';
export const DEFAULT_OUT_DIR = 'exports/character-dag-drama-framework';
export const LEARNER_MODES = Object.freeze(['scripted', 'llm']);
export const LLM_MODES = Object.freeze(['mock', 'real']);
export const DEFAULT_ARM_ORDER = Object.freeze([
  'policy_only',
  'drama_only',
  'character_only',
  'full_character_dag_drama',
  'shuffled_character_state',
  'scripted_oracle',
]);

const PUBLIC_LEAK_PATTERNS = Object.freeze([
  /\bperipeteia\b/i,
  /\banagnorisis\b/i,
  /\bsuperego\b/i,
  /\bhidden state\b/i,
  /\bevidence labels?\b/i,
  /\brubric\b/i,
  /\bsimulation\b/i,
  /\bscripted response\b/i,
  /\bcharacter state\b/i,
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round3(value) {
  return Number(Number(value || 0).toFixed(3));
}

export function parseSeedCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--seeds must be a positive integer (got ${value})`);
  return n;
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  return value;
}

function normalizeEvidenceContract(scene) {
  const proof = scene.proof_contract || {};
  const core = requireArray(
    proof.core_evidence || ['learner-authored rationale'],
    `${scene.id}.proof_contract.core_evidence`,
  );
  const resistance = proof.resistance_core || {};
  const labels = requireArray(resistance.labels || [], `${scene.id}.proof_contract.resistance_core.labels`);
  return {
    core_evidence: core.map(String),
    resistance_core: {
      labels: labels.map(String),
      min: Math.max(1, Number(resistance.min || 1)),
    },
  };
}

function normalizeScene(scene, index) {
  if (!scene?.id) throw new Error(`scene ${index} missing id`);
  if (!scene.phase) throw new Error(`scene ${scene.id} missing phase`);
  if (!scene.opening) throw new Error(`scene ${scene.id} missing opening`);
  if (!scene.resistance_signal) throw new Error(`scene ${scene.id} missing resistance_signal`);
  const dramatic = scene.dramatic_contract || {};
  return {
    ...clone(scene),
    proof_contract: normalizeEvidenceContract(scene),
    dramatic_contract: {
      requires_peripeteia: dramatic.requires_peripeteia === true,
      public_pressure: String(dramatic.public_pressure || ''),
      old_check: dramatic.old_check ? String(dramatic.old_check) : '',
      new_check: dramatic.new_check ? String(dramatic.new_check) : '',
    },
    character_axis_targets: Array.isArray(scene.character_axis_targets)
      ? scene.character_axis_targets.filter((axis) => CHARACTER_AXES.includes(axis))
      : [],
    transfer: scene.transfer === true,
  };
}

function normalizeArms(rawArms = {}) {
  const out = {};
  for (const arm of DEFAULT_ARM_ORDER) {
    const raw = rawArms[arm];
    if (!raw) throw new Error(`fixture missing required arm ${arm}`);
    out[arm] = {
      label: raw.label || arm.replace(/_/g, ' '),
      proof_policy: raw.proof_policy === true,
      resistance_policy: raw.resistance_policy === true,
      staged_policy: raw.staged_policy === true,
      drama_routing: raw.drama_routing === true,
      character_routing: raw.character_routing === true,
      shuffled_state: raw.shuffled_state === true,
      oracle: raw.oracle === true,
    };
  }
  return out;
}

export function loadFrameworkFixture(fixturePath = DEFAULT_FIXTURE_PATH) {
  const abs = path.resolve(fixturePath);
  const parsed = yaml.parse(fs.readFileSync(abs, 'utf8')) || {};
  if (parsed.kind !== 'character_dag_drama_framework_fixture') {
    throw new Error(`fixture kind must be character_dag_drama_framework_fixture (got ${parsed.kind})`);
  }
  if (!parsed.world_spec?.id || !parsed.world_spec?.spec_hash) {
    throw new Error('fixture.world_spec must include id and spec_hash');
  }
  const phases = requireArray(parsed.arc?.phases || [], 'fixture.arc.phases').map(String);
  const scenes = requireArray(parsed.scenes || [], 'fixture.scenes').map(normalizeScene);
  const scenePhases = new Set(scenes.map((scene) => scene.phase));
  for (const phase of scenePhases) {
    if (!phases.includes(phase)) throw new Error(`scene phase ${phase} is not listed in arc.phases`);
  }
  return {
    path: abs,
    kind: parsed.kind,
    version: String(parsed.version || '1.0'),
    world_spec: clone(parsed.world_spec),
    arc: {
      phases,
      peripeteia_phase: parsed.arc?.peripeteia_phase || 'peripeteia',
    },
    arms: normalizeArms(parsed.arms || {}),
    scenes,
    raw: parsed,
  };
}

export function parseArmList(value, fixture) {
  if (Array.isArray(value)) return value;
  const arms = String(value || '')
    .split(',')
    .map((arm) => arm.trim())
    .filter(Boolean);
  const selected = arms.length ? arms : DEFAULT_ARM_ORDER;
  for (const arm of selected) {
    if (!fixture.arms[arm]) throw new Error(`unknown arm: ${arm}`);
  }
  return [...new Set(selected)];
}

function executionBoundaryFor({ learnerMode, llm }) {
  return {
    synthetic_only: true,
    learner_mode: learnerMode,
    scripted_learner_responses: learnerMode === 'scripted',
    generative_synthetic_learner_responses: learnerMode === 'llm',
    oracle_scripted_control_available: true,
    programmatic_closed_loop_policy: true,
    target_evidence_labels_visible_to_learner: false,
    llm_mode_is_not_human_learner_claim: true,
    real_llm_backend_used_for_learner: learnerMode === 'llm' && llm === 'real',
  };
}

export function collectTargetEvidenceLabels(fixture) {
  const labels = new Set();
  for (const scene of fixture.scenes) {
    for (const label of scene.proof_contract.core_evidence) labels.add(label);
    for (const label of scene.proof_contract.resistance_core.labels) labels.add(label);
  }
  return [...labels].sort();
}

function resistancePolicy(scene) {
  return {
    resistance_signal_policy: true,
    resistance_signal_target: scene.resistance_signal,
    resistance_signal_gate: scene.proof_contract.resistance_core.labels.map((label) => ({ label, required: true })),
  };
}

function v2PolicyForArm(armConfig) {
  if (!armConfig.staged_policy) return {};
  return {
    staged_combined_closure: true,
    typed_evidence_contracts: true,
    typed_staged_followup: true,
    semantic_outcome_observer: true,
  };
}

function graphOptionsForArm({ fixture, armConfig, scene }) {
  const adaptivePolicy = {
    mode: 'closed_loop',
    ...(armConfig.proof_policy ? { world_adaptation_spec: fixture.world_spec } : {}),
    ...(armConfig.resistance_policy ? resistancePolicy(scene) : {}),
    ...v2PolicyForArm(armConfig),
    state_scramble: armConfig.shuffled_state === true,
  };
  return {
    architecture: 'state_policy_closed_loop',
    adaptationPolicyMode: 'closed_loop',
    adaptivePolicy,
  };
}

function publicPriorSceneSummaries(characterState = {}, { shuffled = false } = {}) {
  if (shuffled) {
    return [
      {
        scene_id: 'mismatched_prior_question_flood',
        outcome: 'success',
        staged_followup: false,
        axis_deltas: { question_consolidation: 0.2 },
        maturity_after: 0.08,
      },
    ];
  }
  return (characterState.scene_summaries || []).map((summary) => ({
    scene_id: summary.scene_id,
    outcome: summary.outcome,
    staged_followup: Boolean(summary.staged_followup),
    axis_deltas: summary.axis_deltas,
    maturity_after: summary.maturity_after,
  }));
}

function mismatchedCharacterStateFor(scene) {
  const axes = Object.fromEntries(CHARACTER_AXES.map((axis) => [axis, 0]));
  const avoid = new Set(scene.character_axis_targets || []);
  const fallback = CHARACTER_AXES.find((axis) => !avoid.has(axis)) || 'question_consolidation';
  axes[fallback] = 0.2;
  return {
    version: 'adaptive-character-state.v0.1',
    maturity: round3(Object.values(axes).reduce((sum, value) => sum + value, 0) / CHARACTER_AXES.length),
    axes,
    dominant_axes: `${fallback}=0.20`,
    scene_count: 1,
  };
}

function learnerResponseMode({ armConfig, characterState, scene }) {
  if (armConfig.oracle) return 'oracle';
  if (armConfig.drama_routing && scene.dramatic_contract.requires_peripeteia) return 'drama';
  if (!armConfig.character_routing || armConfig.shuffled_state) return 'partial';
  return shouldUseMatureFirstResponse(characterState, {
    signal: scene.resistance_signal,
    transfer: scene.transfer,
  })
    ? 'mature'
    : 'partial';
}

function publicLearnerContext({ fixture, arm, armConfig, learnerMode, scene, sceneIndex, seedIndex, characterState }) {
  const shuffled = armConfig.shuffled_state === true;
  const routed = armConfig.character_routing === true && !shuffled;
  const dramatic = armConfig.drama_routing === true;
  return {
    learnerMode,
    arm,
    stateQuality: shuffled ? 'mismatched_prior' : routed ? 'matched_prior' : 'none',
    memoryEnabled: routed,
    proofPolicyEnabled: armConfig.proof_policy,
    resistancePolicyEnabled: armConfig.resistance_policy,
    dramaEnabled: dramatic,
    phase: scene.phase,
    resistanceSignal: scene.resistance_signal,
    sceneIndex,
    seedIndex,
    transfer: Boolean(scene.transfer),
    openingStance: scene.opening,
    actualSophistication: 'intermediate',
    characterState: routed
      ? characterStateForTutorContext(characterState)
      : shuffled
        ? mismatchedCharacterStateFor(scene)
        : null,
    priorSceneSummaries: armConfig.character_routing ? publicPriorSceneSummaries(characterState, { shuffled }) : [],
    dramaticContext: dramatic
      ? {
          phase: scene.phase,
          requiresPeripeteia: scene.dramatic_contract.requires_peripeteia,
          pressure: scene.dramatic_contract.public_pressure,
        }
      : null,
    arc: {
      phases: fixture.arc.phases,
      peripeteiaPhase: fixture.arc.peripeteia_phase,
    },
    guidance:
      'Respond as the learner from public context only. Do not mention rubrics, hidden state, evidence labels, policy machinery, or simulation machinery.',
  };
}

function partialResponse(scene) {
  return 'Because the relation I named supports the next step.';
}

function matureResponse(scene, { includeDrama = false } = {}) {
  if (includeDrama && scene.dramatic_contract.requires_peripeteia) {
    return [
      'I was using the old check that repeated terms settle the problem;',
      'now the check is whether this proof move decides if the method is valid for the actual task,',
      'because that is the evidence that matters here.',
    ].join(' ');
  }
  if (scene.resistance_signal === 'boredom') {
    return 'Because the relation I named supports the next step, I will test one concrete case and say what it shows.';
  }
  if (scene.resistance_signal === 'frustration') {
    return 'Because the relation I named supports the next step, I will make one small try and see exactly where it sticks.';
  }
  if (scene.resistance_signal === 'irrelevance') {
    if (scene.transfer) {
      return 'In this new case, this step matters for the actual problem because it tests whether the method is valid for the case; I will use that as my next check.';
    }
    return 'Because the relation I named supports the next step, this step matters for the actual task: it decides whether the method is valid for this case.';
  }
  if (scene.resistance_signal === 'question_flood') {
    return 'Because the relation I named supports the next step, my one main question is what changes when the relation changes.';
  }
  if (scene.resistance_signal === 'rote_parroting') {
    return 'I predict the formula breaks when the case changes, because I need to explain the relation in my own words rather than repeat labels.';
  }
  return 'Because the relation I named supports the next step, I can test the case in my own words.';
}

function stagedResponse(scene, armConfig) {
  return matureResponse(scene, { includeDrama: armConfig.drama_routing });
}

function oracleResponse(scene) {
  const base = matureResponse(scene, { includeDrama: true });
  if (scene.dramatic_contract.requires_peripeteia) {
    return `${base} I can also name my own shift: I was treating repetition as proof, and now I am using the task consequence as the proof check.`;
  }
  return base;
}

function scriptedResponsesForMode({ armConfig, scene, mode, learnerMode }) {
  if (learnerMode === 'llm' && !armConfig.oracle) return undefined;
  const first = armConfig.oracle
    ? oracleResponse(scene)
    : mode === 'mature' || mode === 'drama'
      ? matureResponse(scene, { includeDrama: armConfig.drama_routing })
      : partialResponse(scene);
  return {
    request_evidence: first,
    staged_followup: stagedResponse(scene, armConfig),
    default: first,
  };
}

export function buildFrameworkSceneScenario({
  fixture,
  arm,
  scene,
  sceneIndex,
  characterState,
  learnerMode = 'scripted',
  seedIndex = 0,
}) {
  const armConfig = fixture.arms[arm];
  if (!armConfig) throw new Error(`unknown arm: ${arm}`);
  const mode = learnerResponseMode({ armConfig, characterState, scene });
  const responseMode =
    learnerMode === 'llm' && !armConfig.oracle
      ? armConfig.shuffled_state
        ? 'llm_mismatched_state'
        : armConfig.character_routing
          ? 'llm_state_conditioned'
          : armConfig.drama_routing
            ? 'llm_drama_conditioned'
            : 'llm_unconditioned'
      : mode;
  const publicContext = publicLearnerContext({
    fixture,
    arm,
    armConfig,
    learnerMode,
    scene,
    sceneIndex,
    seedIndex,
    characterState,
  });
  const hidden = {
    actualMisconception: `character-DAG drama signal: ${scene.resistance_signal}`,
    actualSophistication: 'intermediate',
    triggerTurn: -1,
    triggerSignal: scene.opening,
    characterState: characterStateForTutorContext(characterState),
    publicLearnerContext: publicContext,
    responseMode,
    learnerMode,
    seedIndex,
  };
  const scriptedResponses = scriptedResponsesForMode({ armConfig, scene, mode, learnerMode });
  if (scriptedResponses) hidden.scriptedResponses = scriptedResponses;
  return {
    id: `character_dag_${arm}_seed${seedIndex}_${scene.id}`,
    hidden,
    openingTurns: [{ role: 'learner', content: scene.opening }],
    maxTurns: armConfig.staged_policy ? 3 : 2,
    sceneIndex,
    seedIndex,
    learnerMode,
    responseMode,
    meta: {
      arm,
      phase: scene.phase,
      drama_routing: armConfig.drama_routing,
      character_routing: armConfig.character_routing,
      shuffled_state: armConfig.shuffled_state,
      oracle: armConfig.oracle,
    },
  };
}

function firstClosedRecord(result) {
  return result.final.interventionLedger?.find((record) => record?.status === 'closed') || null;
}

function evidenceLabels(record) {
  const labels = new Set();
  for (const entry of record?.evidence || []) {
    for (const [label, value] of Object.entries(entry?.categories || {})) {
      if (value === true) labels.add(label);
    }
  }
  return [...labels].sort();
}

function sceneEvidenceSatisfied(scene, labels = []) {
  const observed = new Set(labels);
  const coreOk = scene.proof_contract.core_evidence.every((label) => observed.has(label));
  const resistanceLabels = scene.proof_contract.resistance_core.labels || [];
  const resistanceMin = Math.max(1, Number(scene.proof_contract.resistance_core.min || 1));
  const resistanceOk = resistanceLabels.filter((label) => observed.has(label)).length >= resistanceMin;
  return coreOk && resistanceOk;
}

function tutorTexts(result) {
  return (result.final.dialogue || []).filter((message) => message.role === 'tutor').map((message) => message.content);
}

function learnerTexts(result) {
  return (result.final.dialogue || [])
    .filter((message) => message.role === 'learner')
    .map((message) => message.content);
}

function dialogueToPoeticsTurns(dialogue = []) {
  const counts = { tutor: 0, learner: 0 };
  return dialogue
    .filter((message) => message.role === 'tutor' || message.role === 'learner')
    .map((message) => {
      counts[message.role] += 1;
      return {
        role: message.role.toUpperCase(),
        phase: message.role,
        turnNumber: counts[message.role],
        text: message.content || '',
      };
    });
}

function publicPeripeteiaSignature(text = '') {
  const lower = String(text || '').toLowerCase();
  const oldCheck = /\bold check\b|\bearlier check\b|\bi was (?:using|treating|reading)\b/.test(lower);
  const newCheck = /\bnow the check\b|\bnew check\b|\breplacement check\b|\binstead\b/.test(lower);
  const taskTurn = /\bactual task\b|\bactual problem\b|\bvalid for (?:the )?(?:case|task|problem)\b/.test(lower);
  return oldCheck && newCheck && taskTurn;
}

function analyzeScenePeripeteia({ scene, armConfig, result }) {
  const turns = dialogueToPoeticsTurns(result.final.dialogue || []);
  const analyzer = analyzePeripeteia(turns, [], {
    tutorAdaptationPolicy: armConfig.drama_routing ? 'peripeteia' : 'none',
  });
  const publicText = [...tutorTexts(result), ...learnerTexts(result)].join('\n');
  const publicSignature = publicPeripeteiaSignature(publicText);
  return {
    required: scene.dramatic_contract.requires_peripeteia === true && armConfig.drama_routing === true,
    observed: publicSignature || analyzer.tutor_adaptive_mechanism === true,
    public_signature: publicSignature,
    analyzer,
  };
}

function targetLabelLeaks(publicContext, targetLabels = []) {
  const text = JSON.stringify(publicContext || {});
  return targetLabels.filter((label) => text.includes(label));
}

function publicLeakViolations(texts = []) {
  const joined = texts.join('\n');
  return PUBLIC_LEAK_PATTERNS.filter((pattern) => pattern.test(joined)).map((pattern) => String(pattern));
}

function averageAxes(states = []) {
  if (!states.length) return Object.fromEntries(CHARACTER_AXES.map((axis) => [axis, 0]));
  return Object.fromEntries(
    CHARACTER_AXES.map((axis) => [
      axis,
      round3(states.reduce((sum, state) => sum + Number(state.axes?.[axis] || 0), 0) / states.length),
    ]),
  );
}

function evidenceQuoteForCharacter(rows = []) {
  const candidates = rows
    .flatMap((row) => row.learner_texts || [])
    .filter((text) => /old check|now the check|i will|i predict|actual task|new case|own words/i.test(text));
  return candidates[0] || '';
}

function characterDevelopmentProxy(armResult, aggregate) {
  const sceneCount = Math.max(1, aggregate.scenes);
  const transferCount = Math.max(1, aggregate.transfer_scene_n || 0);
  const firstRate = aggregate.first_response_success_n / sceneCount;
  const noStagedRate = (sceneCount - aggregate.staged_followup_n) / sceneCount;
  const transferRate = aggregate.transfer_first_response_success_n / transferCount;
  const requiredPeripeteia = aggregate.peripeteia_required_n || 0;
  const peripeteiaRate = requiredPeripeteia > 0 ? aggregate.peripeteia_observed_required_n / requiredPeripeteia : 0;
  const score = Math.round((firstRate * 0.4 + noStagedRate * 0.2 + transferRate * 0.25 + peripeteiaRate * 0.15) * 100);
  const quote = evidenceQuoteForCharacter(armResult.scenes);
  const flags = [];
  if (score >= 50 && !quote) flags.push('score_without_transcript_evidence');
  if (score >= 50 && aggregate.success_n === 0) flags.push('score_without_successful_public_work');
  if (aggregate.peripeteia_observed_unrequired_n > 0) flags.push('peripeteia_observed_where_not_required');
  return {
    rubric_reference: 'config/evaluation-rubric-character-development.yaml',
    mode: 'structural_proxy_not_llm_judge',
    score,
    learner_character_score: score,
    tutor_character_score: null,
    evidence_quote: quote,
    gullibility_flags: flags,
  };
}

function aggregateArm(armResult) {
  const scenes = armResult.scenes;
  const transferScenes = scenes.filter((scene) => scene.transfer);
  const peripeteiaRequired = scenes.filter((scene) => scene.peripeteia.required);
  const peripeteiaUnrequired = scenes.filter((scene) => !scene.peripeteia.required);
  const aggregate = {
    label: armResult.label,
    proof_policy: armResult.arm_config.proof_policy,
    drama_routing: armResult.arm_config.drama_routing,
    character_state_routed: armResult.arm_config.character_routing && !armResult.arm_config.shuffled_state,
    shuffled_state: armResult.arm_config.shuffled_state,
    oracle: armResult.arm_config.oracle,
    scenes: scenes.length,
    success_n: scenes.filter((scene) => scene.outcome === 'success').length,
    first_response_success_n: scenes.filter((scene) => scene.first_response_success).length,
    staged_followup_n: scenes.filter((scene) => scene.staged_followup).length,
    state_conditioned_response_n: scenes.filter((scene) =>
      ['mature', 'oracle', 'llm_state_conditioned'].includes(scene.response_mode),
    ).length,
    transfer_scene_n: transferScenes.length,
    transfer_success_n: transferScenes.filter((scene) => scene.outcome === 'success').length,
    transfer_first_response_success_n: transferScenes.filter((scene) => scene.first_response_success).length,
    peripeteia_required_n: peripeteiaRequired.length,
    peripeteia_observed_required_n: peripeteiaRequired.filter((scene) => scene.peripeteia.observed).length,
    peripeteia_observed_unrequired_n: peripeteiaUnrequired.filter((scene) => scene.peripeteia.observed).length,
    target_label_leak_n: scenes.filter((scene) => scene.target_label_leaks.length > 0).length,
    public_leak_n: scenes.filter((scene) => scene.public_leak_violations.length > 0).length,
    final_maturity: round3(
      armResult.final_character_states.reduce((sum, state) => sum + characterMaturityScore(state), 0) /
        Math.max(1, armResult.final_character_states.length),
    ),
    final_axes: averageAxes(armResult.final_character_states),
  };
  aggregate.unresolved_scene_n = aggregate.scenes - aggregate.success_n;
  aggregate.followup_or_unresolved_burden_n = aggregate.staged_followup_n + aggregate.unresolved_scene_n;
  return {
    ...aggregate,
    character_development: characterDevelopmentProxy(armResult, aggregate),
  };
}

function evaluateAcceptanceGates(aggregates = {}) {
  const full = aggregates.full_character_dag_drama;
  const policy = aggregates.policy_only;
  const shuffled = aggregates.shuffled_character_state;
  const rows = Object.values(aggregates);
  const flatScore = Math.max(
    policy?.character_development?.score || 0,
    aggregates.drama_only?.character_development?.score || 0,
  );
  const highCharacterScoresBounded = rows
    .filter((row) => (row.character_development?.score || 0) > flatScore)
    .every(
      (row) =>
        row.character_development?.evidence_quote && (row.character_development?.gullibility_flags || []).length === 0,
    );
  return {
    no_target_evidence_label_leak: rows.every((row) => row.target_label_leak_n === 0),
    no_public_theory_or_process_leak: rows.every((row) => row.public_leak_n === 0),
    full_beats_policy_on_first_response: full?.first_response_success_n > policy?.first_response_success_n,
    full_reduces_policy_followup_or_unresolved_burden:
      full?.followup_or_unresolved_burden_n < policy?.followup_or_unresolved_burden_n,
    full_beats_shuffled_on_first_response: full?.first_response_success_n > shuffled?.first_response_success_n,
    full_reduces_shuffled_followup_or_unresolved_burden:
      full?.followup_or_unresolved_burden_n < shuffled?.followup_or_unresolved_burden_n,
    full_transfer_stronger_than_policy:
      (full?.transfer_first_response_success_n || 0) > (policy?.transfer_first_response_success_n || 0),
    peripeteia_only_where_required: rows.every(
      (row) =>
        row.peripeteia_observed_unrequired_n === 0 && row.peripeteia_observed_required_n === row.peripeteia_required_n,
    ),
    character_development_scores_evidence_bound: highCharacterScoresBounded,
  };
}

function aggregateReport(armResults) {
  const byArm = Object.fromEntries(armResults.map((armResult) => [armResult.arm, aggregateArm(armResult)]));
  const gates = evaluateAcceptanceGates(byArm);
  return {
    byArm,
    acceptance_gates: gates,
    acceptance_passed: Object.values(gates).every(Boolean),
  };
}

async function runArm({ fixture, arm, llm, learnerMode, seedCount, targetLabels, traceEvents, verbose }) {
  const armConfig = fixture.arms[arm];
  const sceneRows = [];
  const seedResults = [];
  for (let seedIndex = 0; seedIndex < seedCount; seedIndex++) {
    let characterState = initialCharacterState({ learnerId: `character-dag-${arm}-seed-${seedIndex}`, arm });
    const seedScenes = [];
    for (let sceneIndex = 0; sceneIndex < fixture.scenes.length; sceneIndex++) {
      const scene = fixture.scenes[sceneIndex];
      const before = characterState;
      const scenario = buildFrameworkSceneScenario({
        fixture,
        arm,
        scene,
        sceneIndex,
        characterState: before,
        learnerMode,
        seedIndex,
      });
      traceEvents.push({
        type: 'drama_director_card',
        arm,
        seed_index: seedIndex,
        scene_id: scene.id,
        phase: scene.phase,
        transfer: scene.transfer,
        requires_peripeteia: scene.dramatic_contract.requires_peripeteia,
      });
      const result = await runScenario(scenario, graphOptionsForArm({ fixture, armConfig, scene }));
      const closed = firstClosedRecord(result);
      const stagedFollowup = (closed?.evidence || []).length > 1;
      const labels = evidenceLabels(closed);
      const frameworkSuccess = closed?.outcome === 'success' && sceneEvidenceSatisfied(scene, labels);
      const firstResponseSuccess = frameworkSuccess && !stagedFollowup;
      const peripeteia = analyzeScenePeripeteia({ scene, armConfig, result });
      characterState = updateCharacterStateFromEvidence(before, {
        evidence: closed?.evidence || [],
        sceneId: scene.id,
        outcome: closed?.outcome || null,
        stagedFollowup,
      });
      const row = {
        arm,
        label: armConfig.label,
        seed_index: seedIndex,
        scene_id: scene.id,
        scene_index: sceneIndex,
        phase: scene.phase,
        signal: scene.resistance_signal,
        transfer: Boolean(scene.transfer),
        learner_mode: learnerMode,
        response_mode: scenario.responseMode,
        outcome: frameworkSuccess ? 'success' : closed?.outcome === 'failure' ? 'failure' : 'inconclusive',
        graph_outcome: closed?.outcome || null,
        framework_contract_satisfied: frameworkSuccess,
        first_response_success: firstResponseSuccess,
        staged_followup: stagedFollowup,
        evidence_labels: labels,
        peripeteia,
        target_label_leaks: targetLabelLeaks(scenario.hidden.publicLearnerContext, targetLabels),
        public_leak_violations: publicLeakViolations([...tutorTexts(result), ...learnerTexts(result)]),
        tutor_turns: tutorTexts(result).length,
        maturity_before: characterMaturityScore(before),
        maturity_after: characterMaturityScore(characterState),
        character_axes_after: characterState.axes,
        public_learner_context: scenario.hidden.publicLearnerContext,
        tutor_texts: tutorTexts(result),
        learner_texts: learnerTexts(result),
        adaptation_trace: result.final.adaptationTrace || [],
      };
      sceneRows.push(row);
      seedScenes.push(row);
      traceEvents.push({
        type: 'observer_result',
        arm,
        seed_index: seedIndex,
        scene_id: scene.id,
        outcome: row.outcome,
        first_response_success: row.first_response_success,
        staged_followup: row.staged_followup,
        evidence_labels: row.evidence_labels,
        peripeteia_required: row.peripeteia.required,
        peripeteia_observed: row.peripeteia.observed,
      });
      traceEvents.push({
        type: 'archivist_update',
        arm,
        seed_index: seedIndex,
        scene_id: scene.id,
        maturity_before: row.maturity_before,
        maturity_after: row.maturity_after,
        axes_after: row.character_axes_after,
      });
      if (verbose) {
        console.log(
          `[character-dag] ${arm} seed=${seedIndex} ${scene.id}: outcome=${row.outcome} first=${row.first_response_success} staged=${row.staged_followup} peripeteia=${row.peripeteia.observed} maturity=${row.maturity_after}`,
        );
      }
    }
    seedResults.push({ seed_index: seedIndex, final_character_state: characterState, scenes: seedScenes });
  }
  return {
    arm,
    label: armConfig.label,
    arm_config: armConfig,
    learner_mode: learnerMode,
    seed_count: seedCount,
    final_character_states: seedResults.map((seed) => seed.final_character_state),
    seed_results: seedResults,
    scenes: sceneRows,
  };
}

function markdownReport(report) {
  const lines = [];
  lines.push('# Synthetic Character-DAG Drama Framework');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`Fixture: \`${report.fixture_path}\``);
  lines.push(`LLM mode: \`${report.llm_mode}\``);
  lines.push(`Learner mode: \`${report.learner_mode}\``);
  lines.push(`Scenes per arm: ${report.scene_order.length}`);
  lines.push(`Seeds per arm: ${report.seed_count}`);
  lines.push('');
  lines.push('## Claim Boundary');
  lines.push('');
  lines.push(
    'This is a synthetic-only framework benchmark. It tests whether proof-DAG policy, resistance routing, dramatic peripeteia pressure, and evidence-derived character state can coordinate inside the harness. It is not a human learning result and not a claim about real interior states.',
  );
  lines.push('');
  lines.push('## Aggregate Result');
  lines.push('');
  lines.push(
    '| arm | proof | drama | state | shuffled | success | first-response | staged | unresolved | burden | transfer first | peripeteia | character proxy |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const arm of report.arm_order) {
    const a = report.aggregates.byArm[arm];
    lines.push(
      `| ${a.label} | ${a.proof_policy ? 'yes' : 'no'} | ${a.drama_routing ? 'yes' : 'no'} | ${a.character_state_routed ? 'yes' : 'no'} | ${a.shuffled_state ? 'yes' : 'no'} | ${a.success_n}/${a.scenes} | ${a.first_response_success_n}/${a.scenes} | ${a.staged_followup_n}/${a.scenes} | ${a.unresolved_scene_n}/${a.scenes} | ${a.followup_or_unresolved_burden_n} | ${a.transfer_first_response_success_n}/${a.transfer_scene_n} | ${a.peripeteia_observed_required_n}/${a.peripeteia_required_n} | ${a.character_development.score} |`,
    );
  }
  lines.push('');
  lines.push('## Acceptance Gates');
  lines.push('');
  for (const [gate, passed] of Object.entries(report.aggregates.acceptance_gates)) {
    lines.push(`- ${gate}: ${passed ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push(`Overall gate status: ${report.aggregates.acceptance_passed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push('- `policy_only` is the local repair baseline: it can close scenes, but should need staged follow-up.');
  lines.push(
    '- `full_character_dag_drama` is the target mechanism: local repair plus dramatic pressure and longitudinal state.',
  );
  lines.push(
    '- `shuffled_character_state` is the negative control for state routing that does not match the current learner.',
  );
  lines.push(
    '- `burden` is staged follow-ups plus unresolved scenes, so an arm is not rewarded for failing before a repair prompt can close the scene.',
  );
  lines.push('- Character-development proxy scores are structural diagnostics, not LLM-judge rubric scores.');
  return `${lines.join('\n')}\n`;
}

function writeArtifacts({ outDir, fixture, report, traceEvents }) {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'summary.json');
  const reportPath = path.join(outDir, 'report.md');
  const fixturePath = path.join(outDir, 'scenario-fixture.yaml');
  const tracePath = path.join(outDir, 'trace.ndjson');
  fs.writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(reportPath, markdownReport(report));
  fs.writeFileSync(fixturePath, yaml.stringify(fixture.raw));
  fs.writeFileSync(tracePath, `${traceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`);
  return { summaryPath, reportPath, fixturePath, tracePath };
}

export async function runCharacterDagDramaFramework({
  fixturePath = DEFAULT_FIXTURE_PATH,
  outDir = DEFAULT_OUT_DIR,
  llm = 'mock',
  provider = null,
  model = null,
  arms = null,
  learnerMode = 'scripted',
  seeds = 1,
  verbose = false,
} = {}) {
  const fixture = loadFrameworkFixture(fixturePath);
  const llmMode = String(llm || 'mock').toLowerCase();
  const normalizedLearnerMode = String(learnerMode || 'scripted').toLowerCase();
  if (!LLM_MODES.includes(llmMode)) throw new Error(`llm must be mock or real (got ${llm})`);
  if (!LEARNER_MODES.includes(normalizedLearnerMode)) {
    throw new Error(`learnerMode must be scripted or llm (got ${learnerMode})`);
  }
  const seedCount = parseSeedCount(seeds);
  const armOrder = parseArmList(Array.isArray(arms) ? arms.join(',') : arms, fixture);
  const targetLabels = collectTargetEvidenceLabels(fixture);
  const traceEvents = [];
  process.env.ADAPTIVE_TUTOR_LLM = llmMode;
  process.env.ADAPTIVE_POLICY_MODE = 'closed_loop';
  if (llmMode === 'real') setActiveCellConfig({ provider, modelAlias: model });
  try {
    const armResults = [];
    for (const arm of armOrder) {
      armResults.push(
        await runArm({
          fixture,
          arm,
          llm: llmMode,
          learnerMode: normalizedLearnerMode,
          seedCount,
          targetLabels,
          traceEvents,
          verbose,
        }),
      );
    }
    const report = {
      generated_at: new Date().toISOString(),
      kind: 'character_dag_drama_framework',
      fixture_path: fixture.path,
      llm_mode: llmMode,
      learner_mode: normalizedLearnerMode,
      seed_count: seedCount,
      execution_boundary: executionBoundaryFor({ learnerMode: normalizedLearnerMode, llm: llmMode }),
      provider: provider || null,
      model: model || null,
      target_evidence_labels: targetLabels,
      arm_order: armOrder,
      scene_order: fixture.scenes.map((scene) => ({
        id: scene.id,
        phase: scene.phase,
        signal: scene.resistance_signal,
        transfer: scene.transfer,
        requires_peripeteia: scene.dramatic_contract.requires_peripeteia,
      })),
      arms: armResults,
      aggregates: aggregateReport(armResults),
    };
    const artifacts = writeArtifacts({ outDir, fixture, report, traceEvents });
    return { fixture, report, artifacts };
  } finally {
    if (llmMode === 'real') clearActiveCellConfig();
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    fixturePath: DEFAULT_FIXTURE_PATH,
    outDir: DEFAULT_OUT_DIR,
    llm: 'mock',
    provider: null,
    model: null,
    arms: null,
    learnerMode: 'scripted',
    seeds: 1,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fixture') opts.fixturePath = argv[++i];
    else if (arg.startsWith('--fixture=')) opts.fixturePath = arg.slice('--fixture='.length);
    else if (arg === '--out-dir') opts.outDir = argv[++i];
    else if (arg.startsWith('--out-dir=')) opts.outDir = arg.slice('--out-dir='.length);
    else if (arg === '--llm') opts.llm = argv[++i];
    else if (arg.startsWith('--llm=')) opts.llm = arg.slice('--llm='.length);
    else if (arg === '--provider') opts.provider = argv[++i];
    else if (arg.startsWith('--provider=')) opts.provider = arg.slice('--provider='.length);
    else if (arg === '--model') opts.model = argv[++i];
    else if (arg.startsWith('--model=')) opts.model = arg.slice('--model='.length);
    else if (arg === '--arms') opts.arms = argv[++i];
    else if (arg.startsWith('--arms=')) opts.arms = arg.slice('--arms='.length);
    else if (arg === '--learner-mode') opts.learnerMode = argv[++i];
    else if (arg.startsWith('--learner-mode=')) opts.learnerMode = arg.slice('--learner-mode='.length);
    else if (arg === '--seeds') opts.seeds = argv[++i];
    else if (arg.startsWith('--seeds=')) opts.seeds = arg.slice('--seeds='.length);
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function usage() {
  return [
    'Usage: node scripts/run-character-dag-drama-framework.js [options]',
    '',
    'Runs the synthetic Character-DAG drama framework benchmark.',
    '',
    'Options:',
    '  --fixture FILE          Default: config/character-dag-drama-framework.yaml',
    '  --llm mock|real         Default: mock',
    '  --provider NAME         Real backend provider override',
    '  --model ALIAS_OR_ID     Real backend model override',
    '  --learner-mode MODE     scripted or llm. Default: scripted',
    '  --seeds N              Repeat the linked sequence N times per arm. Default: 1',
    '  --arms A,B,C           Optional comma-separated arm subset',
    '  --out-dir DIR          Default: exports/character-dag-drama-framework',
    '  --verbose              Print scene-level progress',
  ].join('\n');
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    console.log(usage());
    return;
  }
  const { report, artifacts } = await runCharacterDagDramaFramework(opts);
  console.log('Synthetic Character-DAG drama framework completed');
  console.log(`llm=${report.llm_mode}`);
  console.log(`learner_mode=${report.learner_mode}`);
  console.log(`seeds=${report.seed_count}`);
  console.log(`arms=${report.arm_order.join(',')}`);
  console.log(`scenes=${report.scene_order.length}`);
  for (const [arm, aggregate] of Object.entries(report.aggregates.byArm)) {
    console.log(
      `${arm}: success=${aggregate.success_n}/${aggregate.scenes} first=${aggregate.first_response_success_n}/${aggregate.scenes} staged=${aggregate.staged_followup_n}/${aggregate.scenes} transfer_first=${aggregate.transfer_first_response_success_n}/${aggregate.transfer_scene_n} character=${aggregate.character_development.score}`,
    );
  }
  console.log(`acceptance=${report.aggregates.acceptance_passed ? 'PASS' : 'FAIL'}`);
  console.log(`report=${artifacts.reportPath}`);
  console.log(`summary=${artifacts.summaryPath}`);
  console.log(`trace=${artifacts.tracePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
