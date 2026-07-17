import { createHash } from 'node:crypto';

import { factKey } from '../dramaticDerivation/chainer.js';
import { defaultHethelActionSet } from '../dramaticDerivation/a21/actionSet.js';
import { runA21Microbench } from '../dramaticDerivation/a21/trialRunner.js';
import {
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  tutorStubDagFactDropoutSnapshot,
} from '../tutorStubDagFactDropout.js';
import { getActionDefinition } from './actionPolicy.js';
import { adaptPedagogicalActionToTutorStub } from './tutorStubActionAdapter.js';
import {
  ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA,
  ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
  buildAdaptiveStateBenchmarkRow,
  buildTutorStubStateObservation,
  validateCommonLeanBaselineRepresentations,
} from './tutorStubStateAdapter.js';

export const FORMAL_STATE_BENCHMARK_DATASET_SCHEMA = 'machinespirits.adaptive-state-formal-instrument-dataset.v1';
export const A21_LATENT_GENERATOR_FAMILY = 'a21_durable_state_transition_kernel';
export const DAG_DROPOUT_LATENT_GENERATOR_FAMILY = 'dag_fact_dropout_memory_instrument';

export const FORMAL_STATE_BENCHMARK_LIMITATIONS = Object.freeze([
  'These rows are deterministic formal instruments, not observations of human learners.',
  'The A21 family is a hand-authored finite-state transition kernel with a separate deterministic text renderer.',
  'The DAG dropout family holds one readoption prompt fixed while an enumerated latent transition determines explicit readoption; it is not a general cognitive model.',
  'The oracle representation is an upper bound only and must never be supplied to a tutor policy.',
  'No causal learning-effect, psychological-validity, or deployment-efficacy claim follows from this dataset.',
]);

const FORMAL_ACTION_TYPE_BY_A21_MOVE = Object.freeze({
  ask_diagnostic: 'diagnose_with_discriminating_question',
  release_next_evidence: 'minimal_hint',
  repair_dependency: 'request_evidence',
  consolidate_subproof: 'request_evidence',
});

const EXPECTED_EVIDENCE_BY_A21_MOVE = Object.freeze({
  ask_diagnostic: Object.freeze(['state-disambiguating response']),
  release_next_evidence: Object.freeze(['state-disambiguating response']),
  repair_dependency: Object.freeze(['learner-authored rationale']),
  consolidate_subproof: Object.freeze(['learner-authored next step']),
});

const FORBIDDEN_NON_ORACLE_KEYS =
  /^(active_?dropped|dependency_?echoed_?only|dependency_?owned|dropout_?state_?before|evidence_?seen|latent.*|learner_?state_?(?:after|before)|misconception|proof_?progress|transition_?flags)$/iu;

const DEFAULT_A21_WORLDS = Object.freeze([
  Object.freeze({
    id: 'formal_a21_hethel_unreleased',
    scenarioFamily: 'a21_release_starvation',
    publicLearnerText:
      'The bond names the builder, but I still lack the next public point that would carry the proof forward.',
    itemDifficulty: 0.68,
    publicState: Object.freeze({
      misconception: 'mirror_dead_predicate',
      frustration: 'medium',
      engagement: 'engaged',
      confidence: 'low',
      evidenceSeen: Object.freeze({ p_surface: true, p_point: false }),
      dependencyOwned: Object.freeze({ p_surface: true, p_point: false }),
      dependencyEchoedOnly: Object.freeze({ p_point: true }),
      alternativeRouteCandidate: false,
      diagnosticHistory: Object.freeze({
        count: 2,
        lastDiagnosticTurn: 3,
        answeredSubstantively: 1,
        repeatedWithoutNewEvidence: 1,
      }),
      proofProgress: Object.freeze({
        D: 4,
        lastDDelta: 0,
        turnsSinceDDecrease: 2,
        releasesOnSchedule: Object.freeze([]),
        delayedReleases: Object.freeze([]),
        earlyReleases: Object.freeze([]),
      }),
      transitionFlags: Object.freeze({
        targetDependencyRepaired: false,
        learnerCanUsePPoint: false,
        learnerCanUsePSurface: true,
        learnerReadyForFinalAssertion: false,
      }),
    }),
  }),
  Object.freeze({
    id: 'formal_a21_hethel_echoed',
    scenarioFamily: 'a21_dependency_echo',
    publicLearnerText:
      'I have heard the public point, but I can only repeat it; I have not yet made the dependency my own.',
    itemDifficulty: 0.56,
    publicState: Object.freeze({
      misconception: 'missing_dependency',
      frustration: 'low',
      engagement: 'engaged',
      confidence: 'medium',
      evidenceSeen: Object.freeze({ p_surface: true, p_point: true }),
      dependencyOwned: Object.freeze({ p_surface: true, p_point: false }),
      dependencyEchoedOnly: Object.freeze({ p_point: true }),
      alternativeRouteCandidate: false,
      diagnosticHistory: Object.freeze({
        count: 1,
        lastDiagnosticTurn: 2,
        answeredSubstantively: 1,
        repeatedWithoutNewEvidence: 0,
      }),
      proofProgress: Object.freeze({
        D: 3,
        lastDDelta: 0,
        turnsSinceDDecrease: 1,
        releasesOnSchedule: Object.freeze(['p_point']),
        delayedReleases: Object.freeze([]),
        earlyReleases: Object.freeze([]),
      }),
      transitionFlags: Object.freeze({
        targetDependencyRepaired: false,
        learnerCanUsePPoint: true,
        learnerCanUsePSurface: true,
        learnerReadyForFinalAssertion: false,
      }),
    }),
  }),
]);

const DEFAULT_DROPOUT_WORLDS = Object.freeze([
  Object.freeze({
    id: 'formal_dropout_assay',
    premiseId: 'p_assay',
    premiseFact: Object.freeze(['supports', 'assay', 'claim']),
    premiseSurface: 'The assay supports the claim.',
    itemDifficulty: 0.42,
  }),
  Object.freeze({
    id: 'formal_dropout_ledger',
    premiseId: 'p_ledger',
    premiseFact: Object.freeze(['supports', 'ledger', 'claim']),
    premiseSurface: 'The ledger supports the claim.',
    itemDifficulty: 0.47,
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function taskForWorld(world, knowledgeComponent) {
  return {
    taskId: `${world.id}-task`,
    knowledgeComponent,
    prerequisitePath: ['identify public evidence', 'connect evidence to the current proof obligation'],
    itemDifficulty: world.itemDifficulty,
    itemDiscrimination: 1,
  };
}

function sourcePedagogicalAction(actionType, id) {
  const definition = getActionDefinition(actionType);
  return {
    version: '1.0',
    id,
    action_type: actionType,
    description: definition.description,
    target_axes: [...definition.target_axes],
    rationale: definition.description,
    preconditions: [],
    expected_transition: { ...definition.expected_transition },
    success_signal: clone(definition.success_signal),
    control_cost: definition.default_control_cost,
    information_gain: definition.default_information_gain,
    forbidden_moves: [...definition.forbidden_moves],
    registry_version: 'formal-instrument-action-map.v1',
  };
}

function formalAction({
  actionType,
  actionId,
  kernelMoveFamily,
  task,
  targetPremiseId = null,
  expectedEvidence = [],
  supportLevel = 1,
  selectionProbability = null,
}) {
  const action = adaptPedagogicalActionToTutorStub({
    action: sourcePedagogicalAction(actionType, actionId),
    task,
    register: 'formal_instrument',
    supportLevel,
    expectedEvidence: { success: expectedEvidence, failure: [] },
  });
  return {
    ...action,
    formal_action_id: actionId,
    kernel_move_family: kernelMoveFamily,
    target_premise_id: targetPremiseId,
    selection_probability: selectionProbability,
  };
}

function turnRecord({
  turn,
  learnerText,
  coverage,
  bottleneck,
  missingPremiseCount,
  groundedCount,
  agency,
  affect,
  evidenceUse,
  accepted = {},
  finalSecretEntailed = false,
  assertedSecret = false,
}) {
  return {
    turn,
    learner: learnerText,
    classification: {
      turn: {
        request_type: 'evidence_to_claim',
        discourse_move: accepted.adopt?.length || accepted.derive?.length ? 'evidence_move' : 'state_report',
        evidence_use: evidenceUse,
        epistemic_stance: finalSecretEntailed ? 'grounded' : 'tentative',
        affect,
        agency,
        scores: {
          conceptual_engagement: { score: Math.max(1, Math.round(clamp01(coverage) * 5)) },
          epistemic_readiness: { score: finalSecretEntailed ? 5 : 3 },
        },
      },
    },
    tutorLearnerDagModel: {
      assessment: {
        bestPathCoverage: clamp01(coverage),
        bottleneck,
        finalSecretEntailed,
        assertedSecret,
      },
      metrics: {
        missingPremiseCount,
        groundedCount,
        voicedDerivedCount: accepted.derive?.length || 0,
      },
    },
    tutorLearnerDagUpdate: { accepted },
    humanDiscourseFrame: {
      proofDebt: { status: 'none_open', counts: { open: 0, harmful: 0 } },
      scaffoldState: { status: 'formal_instrument' },
      warrantPremiseAudit: { proofStatus: 'supported' },
    },
  };
}

function scanForbiddenKeys(value, path = 'representations') {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_NON_ORACLE_KEYS.test(key)) found.push(`${path}.${key}`);
    found.push(...scanForbiddenKeys(child, `${path}.${key}`));
  }
  return found;
}

export function assertFormalStateBenchmarkRow(row) {
  if (row?.schema !== ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA) {
    throw new Error(`formalStateBenchmark: unsupported row schema ${JSON.stringify(row?.schema)}`);
  }
  if (
    ![A21_LATENT_GENERATOR_FAMILY, DAG_DROPOUT_LATENT_GENERATOR_FAMILY].includes(row.groups?.latent_generator_family)
  ) {
    throw new Error('formalStateBenchmark: row needs a known groups.latent_generator_family');
  }
  if (!row.groups?.dialogue_id || !row.groups?.world) {
    throw new Error('formalStateBenchmark: row needs independent dialogue and world groups');
  }
  if (!row.action?.schema || !row.action?.move_family || !row.action?.task_id) {
    throw new Error('formalStateBenchmark: row needs the common typed action input');
  }
  if (
    row.target_horizon?.schema !== ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA ||
    row.target_horizon?.kind !== 'immediate_next_observation' ||
    row.target_horizon?.source_policy !== 'exact_next_observation'
  ) {
    throw new Error('formalStateBenchmark: formal targets must name their exact immediate-next observation horizon');
  }
  validateCommonLeanBaselineRepresentations(row.representations);
  if (!row.representations?.oracle?.additional_state?.upper_bound_only) {
    throw new Error('formalStateBenchmark: oracle must be present and marked upper-bound only');
  }
  const nonOracle = Object.fromEntries(Object.entries(row.representations || {}).filter(([name]) => name !== 'oracle'));
  const leaks = scanForbiddenKeys(nonOracle);
  if (leaks.length) throw new Error(`formalStateBenchmark: latent field leaked outside oracle: ${leaks.join(', ')}`);
  if (row.feature_provenance?.hidden_state_used !== true) {
    throw new Error('formalStateBenchmark: oracle presence must be disclosed as hidden_state_used');
  }
  if (row.feature_provenance?.non_oracle_hidden_state_used !== false) {
    throw new Error('formalStateBenchmark: non-oracle hidden-state use must be false');
  }
  if (row.feature_provenance?.policy_invariant !== true) {
    throw new Error('formalStateBenchmark: public representations must be policy-invariant');
  }
  return row;
}

function formalGroups({ family, dialogueId, world, scenarioFamily, counterfactualBranch }) {
  return {
    dialogue_id: dialogueId,
    world,
    scenario_family: scenarioFamily,
    learner_source: `formal_latent:${family}`,
    model_family: `deterministic:${family}`,
    latent_generator_family: family,
    counterfactual_branch: counterfactualBranch,
  };
}

function featureProvenance({ family, transitionKernel, languageRenderer, targetSource }) {
  return {
    non_oracle_hidden_state_used: false,
    oracle_upper_bound_only: true,
    latent_generator_family: family,
    transition_kernel: transitionKernel,
    language_renderer: languageRenderer,
    target_source: targetSource,
    limitations: [...FORMAL_STATE_BENCHMARK_LIMITATIONS],
  };
}

function a21Fixture(world) {
  return {
    fixtureId: `${world.id}-fixture`,
    fixtureHash: stableHash(world),
    worldId: world.id,
    trigger: { turn: 4 },
    releaseContext: {
      targetPremise: 'p_point',
      hiddenObserved: { safeTurns: [4] },
    },
    publicProofSummary: { D: world.publicState.proofProgress.D },
    publicLearnerState: clone(world.publicState),
  };
}

function a21Bottleneck(trial) {
  const after = trial.simulation.learnerStateAfter;
  const transition = trial.simulation.transition;
  if (['aporia', 'disengaged'].includes(after.engagement)) return 'learner_integration_gap';
  if (after.proofProgress.D === 0) return 'assertion_gap';
  if (transition.dependencyOwned.length) return 'inference_gap';
  if (transition.evidenceGained.length) return 'learner_integration_gap';
  return 'release_or_pacing_gap';
}

function a21AcceptedEvents(trial) {
  return {
    adopt: [...trial.simulation.transition.evidenceGained],
    derive: trial.simulation.transition.dependencyOwned.map((premiseId) => ['owns_dependency', premiseId]),
  };
}

export function buildA21FormalStateBenchmarkRows({ seed = 20260711, worlds = DEFAULT_A21_WORLDS } = {}) {
  const rows = [];
  for (const [worldIndex, sourceWorld] of [...worlds].entries()) {
    const world = clone(sourceWorld);
    const fixture = a21Fixture(world);
    const task = taskForWorld(world, 'public-evidence release and dependency ownership');
    const run = runA21Microbench({
      fixture,
      actionSet: defaultHethelActionSet({ fixtureId: fixture.fixtureId }),
      mode: 'deterministic',
      k: 1,
      seed: Number(seed) + worldIndex,
    });
    for (const trial of [...run.trials].sort((left, right) =>
      left.action.actionId.localeCompare(right.action.actionId),
    )) {
      const before = trial.simulation.learnerStateBefore;
      const after = trial.simulation.learnerStateAfter;
      const beforeCoverage = clamp01(1 - before.proofProgress.D / 5);
      const afterCoverage = clamp01(1 - after.proofProgress.D / 5);
      const currentObservation = buildTutorStubStateObservation({
        turnRecord: turnRecord({
          turn: 3,
          learnerText: world.publicLearnerText,
          coverage: beforeCoverage,
          bottleneck: world.scenarioFamily === 'a21_release_starvation' ? 'release_or_pacing_gap' : 'inference_gap',
          missingPremiseCount: before.proofProgress.D,
          groundedCount: 5 - before.proofProgress.D,
          agency: 'questioning',
          affect: 'engaged',
          evidenceUse: 'states_gap',
        }),
        provenance: { source: 'formal_a21_public_projection' },
      });
      const accepted = a21AcceptedEvents(trial);
      const nextObservation = buildTutorStubStateObservation({
        turnRecord: turnRecord({
          turn: 4,
          learnerText: trial.transitionOutcome.learnerText,
          coverage: afterCoverage,
          bottleneck: a21Bottleneck(trial),
          missingPremiseCount: after.proofProgress.D,
          groundedCount: 5 - after.proofProgress.D,
          agency: accepted.adopt.length || accepted.derive.length ? 'steering' : 'questioning',
          affect: after.engagement,
          evidenceUse: accepted.adopt.length || accepted.derive.length ? 'links_evidence_to_rule' : 'states_gap',
          accepted,
        }),
        previousObservation: currentObservation,
        provenance: { source: 'formal_a21_deterministic_renderer' },
      });
      const mappedActionType = FORMAL_ACTION_TYPE_BY_A21_MOVE[trial.action.moveFamily];
      const action = formalAction({
        actionType: mappedActionType,
        actionId: trial.action.actionId,
        kernelMoveFamily: trial.action.moveFamily,
        task,
        targetPremiseId: 'p_point',
        expectedEvidence: EXPECTED_EVIDENCE_BY_A21_MOVE[trial.action.moveFamily],
        supportLevel: trial.action.moveFamily === 'release_next_evidence' ? 1 : 0,
        selectionProbability: trial.assignmentProbability,
      });
      const dialogueId = `${world.id}:counterfactual-set`;
      const row = buildAdaptiveStateBenchmarkRow({
        id: `${dialogueId}:${trial.action.actionId}:t3`,
        groups: formalGroups({
          family: A21_LATENT_GENERATOR_FAMILY,
          dialogueId,
          world: world.id,
          scenarioFamily: world.scenarioFamily,
          counterfactualBranch: trial.action.actionId,
        }),
        observation: currentObservation,
        task,
        nextObservation,
        horizonObservation: nextObservation,
        targetHorizon: { kind: 'immediate_next_observation' },
        scrambleSeed: Number(seed) + worldIndex * 100,
        oracleState: {
          schema: 'machinespirits.adaptive-state-formal-oracle.v1',
          upper_bound_only: true,
          latent_generator_family: A21_LATENT_GENERATOR_FAMILY,
          learner_state_before: clone(before),
        },
        action,
        featureProvenance: featureProvenance({
          family: A21_LATENT_GENERATOR_FAMILY,
          transitionKernel: 'services/dramaticDerivation/a21/learnerSimulator.js',
          languageRenderer: 'services/dramaticDerivation/a21/trialRunner.js#renderDeterministicLearnerText',
          targetSource: 'a21_transition_flags_plus_public_dag_projection',
        }),
      });
      rows.push(assertFormalStateBenchmarkRow(row));
    }
  }
  return rows;
}

function dropoutWorld(sourceWorld) {
  const world = clone(sourceWorld);
  const premise = {
    id: world.premiseId,
    fact: world.premiseFact,
    surface: world.premiseSurface,
  };
  return {
    ...world,
    background: [['formal_context', world.id]],
    premises: [premise],
    premise,
    premiseById: new Map([[premise.id, premise]]),
  };
}

function buildDropoutConditionRow({ sourceWorld, latentReadoption, seed, worldIndex }) {
  const world = dropoutWorld(sourceWorld);
  const task = taskForWorld(world, 'retention and explicit readoption of public evidence');
  const board = new Map([[factKey(world.premise.fact), world.premise.fact]]);
  const dropout = createTutorStubDagFactDropoutState({
    rate: 1,
    seed: Number(seed) + worldIndex,
    graceTurns: 0,
    maxConcurrent: 1,
  });
  const dropped = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 1,
    adoptedPremiseIds: [world.premise.id],
  });
  if (!dropped?.droppedNow?.some((event) => event.premiseId === world.premise.id)) {
    throw new Error(`formalStateBenchmark: deterministic dropout did not drop ${world.premise.id}`);
  }
  dropout.graceTurns = 2;
  const dropoutBefore = tutorStubDagFactDropoutSnapshot(dropout);
  const boardFactKeysBefore = [...board.keys()].sort();
  const currentObservation = buildTutorStubStateObservation({
    turnRecord: turnRecord({
      turn: 1,
      learnerText: `The ${world.premise.id} premise is missing from my current public evidence board.`,
      coverage: 0.25,
      bottleneck: 'inference_gap',
      missingPremiseCount: 1,
      groundedCount: 0,
      agency: 'questioning',
      affect: 'engaged',
      evidenceUse: 'states_gap',
    }),
    provenance: { source: 'formal_dropout_public_board_projection' },
  });

  if (latentReadoption) board.set(factKey(world.premise.fact), world.premise.fact);
  const outcome = applyTutorStubDagFactDropout({
    dropout,
    board,
    world,
    turn: 2,
    adoptedPremiseIds: latentReadoption ? [world.premise.id] : [],
  });
  const repairedPremiseIds = (outcome.repairedNow || []).map((event) => event.premiseId);
  const nextObservation = buildTutorStubStateObservation({
    turnRecord: turnRecord({
      turn: 2,
      learnerText: latentReadoption
        ? `I will re-adopt the ${world.premise.id} premise because it supports the next evidence link.`
        : `I cannot use the ${world.premise.id} premise yet; it is still missing from my public record.`,
      coverage: latentReadoption ? 0.5 : 0.25,
      bottleneck: latentReadoption ? 'assertion_gap' : 'inference_gap',
      missingPremiseCount: latentReadoption ? 0 : 1,
      groundedCount: latentReadoption ? 1 : 0,
      agency: latentReadoption ? 'steering' : 'questioning',
      affect: 'engaged',
      evidenceUse: latentReadoption ? 'links_evidence_to_rule' : 'states_gap',
      accepted: latentReadoption ? { adopt: [world.premise.id] } : {},
    }),
    previousObservation: currentObservation,
    provenance: { source: 'formal_dropout_readoption_projection' },
  });
  const action = formalAction({
    actionType: 'request_evidence',
    actionId: 'PROMPT_READOPTION',
    kernelMoveFamily: 'repair_dependency',
    task,
    targetPremiseId: world.premise.id,
    expectedEvidence: ['learner-authored rationale'],
    supportLevel: 1,
    selectionProbability: 1,
  });
  const condition = latentReadoption ? 'latent_transition_a' : 'latent_transition_b';
  const dialogueId = `${world.id}:counterfactual-set`;
  const row = buildAdaptiveStateBenchmarkRow({
    id: `${dialogueId}:${condition}:t1`,
    groups: formalGroups({
      family: DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
      dialogueId,
      world: world.id,
      scenarioFamily: 'dag_fact_dropout_readoption_opportunity',
      counterfactualBranch: condition,
    }),
    observation: currentObservation,
    task,
    nextObservation,
    horizonObservation: nextObservation,
    targetHorizon: { kind: 'immediate_next_observation' },
    scrambleSeed: Number(seed) + 1000 + worldIndex * 10,
    oracleState: {
      schema: 'machinespirits.adaptive-state-formal-oracle.v1',
      upper_bound_only: true,
      latent_generator_family: DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
      dropout_state_before: clone(dropoutBefore),
      board_fact_keys_before: boardFactKeysBefore,
    },
    action,
    dropoutRepair: {
      activePremiseIds: Object.values(dropoutBefore.activeDropped).map((event) => event.premiseId),
      repairedPremiseIds,
    },
    featureProvenance: featureProvenance({
      family: DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
      transitionKernel: 'services/tutorStubDagFactDropout.js',
      languageRenderer: 'deterministic_public_readoption_projection_v2',
      targetSource: 'tutor_stub_dag_fact_dropout_repairedNow_ledger',
    }),
  });
  row.feature_provenance.action_invariant_across_outcome_branches = true;
  return assertFormalStateBenchmarkRow(row);
}

export function buildDagDropoutFormalStateBenchmarkRows({ seed = 20260711, worlds = DEFAULT_DROPOUT_WORLDS } = {}) {
  const rows = [...worlds].flatMap((world, worldIndex) => [
    buildDropoutConditionRow({ sourceWorld: world, latentReadoption: true, seed, worldIndex }),
    buildDropoutConditionRow({ sourceWorld: world, latentReadoption: false, seed, worldIndex }),
  ]);
  for (const world of worlds) {
    const actions = rows.filter((row) => row.groups.world === world.id).map((row) => stableHash(row.action));
    if (new Set(actions).size !== 1) {
      throw new Error(`formalStateBenchmark: dropout outcome branches changed tutor action for ${world.id}`);
    }
  }
  return rows;
}

export function buildFormalStateBenchmarkRows(options = {}) {
  return [...buildA21FormalStateBenchmarkRows(options), ...buildDagDropoutFormalStateBenchmarkRows(options)];
}

export function buildFormalStateBenchmarkDataset(options = {}) {
  const seed = Number(options.seed ?? 20260711);
  const rows = buildFormalStateBenchmarkRows({ ...options, seed });
  return {
    schema: FORMAL_STATE_BENCHMARK_DATASET_SCHEMA,
    seed,
    bounded: true,
    rowCount: rows.length,
    latentGeneratorFamilies: [A21_LATENT_GENERATOR_FAMILY, DAG_DROPOUT_LATENT_GENERATOR_FAMILY],
    limitations: [...FORMAL_STATE_BENCHMARK_LIMITATIONS],
    rows,
  };
}
