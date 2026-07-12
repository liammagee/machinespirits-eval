import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closure, factKey } from '../../dramaticDerivation/chainer.js';
import { derivationDistance } from '../../dramaticDerivation/slope.js';
import { loadWorld, plotLint } from '../../dramaticDerivation/world.js';
import { cloneKernelValue } from './contract.js';

export const ADAPTIVE_STATE_WORLD_ADAPTER_SCHEMA = 'machinespirits.adaptive-state-world-proof-adapter.v2';
export const ADAPTIVE_STATE_PUBLIC_ACT_ENVELOPE_SCHEMA = 'machinespirits.adaptive-state-public-act-envelope.v2';
export const ADAPTIVE_STATE_PUBLIC_SEMANTIC_EVENT_SCHEMA =
  'machinespirits.adaptive-state-public-semantic-event.v2.3';
export const ADAPTIVE_STATE_PROOF_TRANSITION_V2_SCHEMA = 'machinespirits.adaptive-state-proof-transition.v2';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const DEFAULT_ADAPTIVE_STATE_WORLD_CONFIGS = Object.freeze([
  Object.freeze({
    id: 'marrick',
    source: 'config/drama-derivation/world-005-marrick.yaml',
    geometry: 'and_join',
  }),
  Object.freeze({
    id: 'hethel',
    source: 'config/drama-derivation/world-006-hethel.yaml',
    geometry: 'linear_with_distractor',
  }),
  Object.freeze({
    id: 'ravensmark',
    source: 'config/drama-derivation/world-009-ravensmark.yaml',
    geometry: 'unary_dead_predicate_probe',
  }),
]);

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function unique(values) {
  return [...new Set(values)];
}

function releaseOrder(world) {
  const order = new Map();
  for (const [index, row] of (world.releaseSchedule || []).entries()) {
    order.set(row.premise, { turn: Number(row.turn), index });
  }
  return order;
}

function sortedByRelease(ids, order) {
  return [...ids].sort((left, right) => {
    const a = order.get(left) || { turn: Number.MAX_SAFE_INTEGER, index: Number.MAX_SAFE_INTEGER };
    const b = order.get(right) || { turn: Number.MAX_SAFE_INTEGER, index: Number.MAX_SAFE_INTEGER };
    return a.turn - b.turn || a.index - b.index || left.localeCompare(right);
  });
}

function challengePremiseIds(world, criticalPremiseIds, fullClosure) {
  const criticalByKey = new Map(
    criticalPremiseIds.map((premiseId) => [factKey(world.premiseById.get(premiseId).fact), premiseId]),
  );
  const collectSources = (key, visiting = new Set()) => {
    if (criticalByKey.has(key)) return [criticalByKey.get(key)];
    if (visiting.has(key)) return [];
    const proof = fullClosure.proofs.get(key);
    if (!proof) return [];
    const nextVisiting = new Set(visiting).add(key);
    return unique(proof.premises.flatMap((premiseKey) => collectSources(premiseKey, nextVisiting)));
  };
  const secretProof = fullClosure.proofs.get(factKey(world.secret.fact));
  const order = releaseOrder(world);
  const rootGroups = (secretProof?.premises || [])
    .map((key) => sortedByRelease(collectSources(key), order))
    .filter((ids) => ids.length);
  const selected = [];
  if (rootGroups.length >= 2) {
    for (const group of rootGroups) {
      const candidate = group.at(-1);
      if (candidate && !selected.includes(candidate)) selected.push(candidate);
      if (selected.length === 2) break;
    }
  } else if (rootGroups.length === 1) {
    selected.push(...rootGroups[0].slice(-2));
  }
  for (const candidate of sortedByRelease(criticalPremiseIds, order).reverse()) {
    if (!selected.includes(candidate)) selected.push(candidate);
    if (selected.length === Math.min(2, criticalPremiseIds.length)) break;
  }
  return sortedByRelease(selected, order);
}

function classifierForEvent(event, proofSnapshot) {
  const kind = event.kind;
  if (kind === 'adopt') {
    return {
      request_type: 'evidence_to_claim',
      discourse_move: 'evidence_adoption',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'exploratory',
      agency: 'attempting',
      affect: 'engaged',
      conceptual: 3,
      readiness: 3,
    };
  }
  if (kind === 'derive') {
    return {
      request_type: 'proof_check',
      discourse_move: 'inference',
      evidence_use: 'links_evidence_to_rule',
      epistemic_stance: proofSnapshot.raw_distance === 0 ? 'grounded' : 'reflective',
      agency: 'self_correcting',
      affect: 'engaged',
      conceptual: 4,
      readiness: 4,
    };
  }
  if (kind === 'retract') {
    if (event.semantic_role === 'public_evidence_loss') {
      return {
        request_type: 'repair_request',
        discourse_move: 'repair_request',
        evidence_use: 'repeats_setup',
        epistemic_stance: 'confused',
        agency: 'attempting',
        affect: 'strained',
        conceptual: 2,
        readiness: 2,
      };
    }
    return {
      request_type: 'repair_request',
      discourse_move: 'repair_request',
      evidence_use: 'revises_from_evidence',
      epistemic_stance: 'reflective',
      agency: 'self_correcting',
      affect: 'strained',
      conceptual: 3,
      readiness: 3,
    };
  }
  return {
    request_type: 'evidence_to_claim',
    discourse_move: 'question',
    evidence_use: 'none',
    epistemic_stance: 'confused',
    agency: 'passive',
    affect: 'strained',
    conceptual: 2,
    readiness: 2,
  };
}

function cloneProofState(proof) {
  return {
    heldPremiseIds: [...proof.heldPremiseIds],
    releasedPremiseIds: [...proof.releasedPremiseIds],
    voicedDerivedFactKeys: [...proof.voicedDerivedFactKeys],
    harmfulProofDebt: Number(proof.harmfulProofDebt || 0),
  };
}

export function createWorldNormalizedProofAdapter({
  id,
  source,
  geometry,
  world,
  worldSha256,
  structuralSupportRuleIds = [],
}) {
  if (!id || !source || !geometry || !world || !worldSha256) {
    throw new Error('learnerKernel.worldAdapter: id, source, geometry, world, and worldSha256 are required');
  }
  const lint = plotLint(world);
  if (!lint.ok) throw new Error(`learnerKernel.worldAdapter: invalid world ${world.id}: ${lint.errors.join('; ')}`);
  const selectedPath = [...(world.proofPaths || [])].sort(
    (left, right) => left.premises.length - right.premises.length,
  )[0];
  const criticalPremiseIds = [...selectedPath.premises];
  const criticalSet = new Set(criticalPremiseIds);
  const allFacts = [...world.background, ...world.premises.map((premise) => premise.fact)];
  const fullClosure = closure(allFacts, world.rules);
  if (
    !Array.isArray(structuralSupportRuleIds) ||
    structuralSupportRuleIds.some((ruleId) => typeof ruleId !== 'string' || !ruleId.trim())
  ) {
    throw new Error(`learnerKernel.worldAdapter: ${id} structural support rule ids must be a string array`);
  }
  const structuralRuleIds = new Set(structuralSupportRuleIds);
  if (structuralRuleIds.size !== structuralSupportRuleIds.length) {
    throw new Error(`learnerKernel.worldAdapter: ${id} structural support rule ids must be unique`);
  }
  for (const ruleId of structuralRuleIds) {
    const rule = world.rules.find((candidate) => candidate.id === ruleId);
    const outputPredicate = rule?.then?.[0]?.[0];
    const feedsLaterRule = world.rules.some(
      (candidate) =>
        candidate.id !== ruleId &&
        candidate.if.some((pattern) => String(pattern?.[0] || '') === String(outputPredicate || '')),
    );
    if (
      !rule ||
      rule.if.length !== 1 ||
      rule.then.length !== 1 ||
      !outputPredicate ||
      outputPredicate === world.questionPattern[0] ||
      !feedsLaterRule
    ) {
      throw new Error(
        `learnerKernel.worldAdapter: ${id} structural support rule ${ruleId} must be a unary non-answer rule that feeds a later rule`,
      );
    }
  }
  const challengeIds = challengePremiseIds(world, criticalPremiseIds, fullClosure);
  const initialHeldIds = criticalPremiseIds.filter((premiseId) => !challengeIds.includes(premiseId));
  const initialFacts = [
    ...world.background,
    ...initialHeldIds.map((premiseId) => world.premiseById.get(premiseId).fact),
  ];
  const normalizationDenominator = derivationDistance(world, initialFacts);
  if (!(normalizationDenominator > 0)) {
    throw new Error(`learnerKernel.worldAdapter: ${world.id} benchmark slice starts at zero proof distance`);
  }

  const premiseSlot = new Map(criticalPremiseIds.map((premiseId, index) => [premiseId, index + 1]));
  const baseKeys = new Set(allFacts.map(factKey));
  const derivedKeys = [...fullClosure.facts.keys()].filter((key) => !baseKeys.has(key)).sort();
  const structuralDerivedKeys = new Set(
    derivedKeys.filter((key) => structuralRuleIds.has(String(fullClosure.proofs.get(key)?.rule || ''))),
  );
  const observableDerivedKeys = derivedKeys.filter((key) => !structuralDerivedKeys.has(key));
  // Preserve stable event slots across ontology refinements. A structural fact
  // keeps its reserved slot even though no public learner event may emit it.
  const derivedSlot = new Map(derivedKeys.map((key, index) => [key, index + 1]));
  const secretKey = factKey(world.secret.fact);

  const factsForProof = (proof) => [
    ...world.background,
    ...proof.heldPremiseIds.map((premiseId) => world.premiseById.get(premiseId).fact),
  ];

  const validateHiddenProofState = (proof) => {
    if (!proof || typeof proof !== 'object')
      throw new Error('learnerKernel.worldAdapter: hidden proof state is required');
    for (const key of ['heldPremiseIds', 'releasedPremiseIds', 'voicedDerivedFactKeys']) {
      if (!Array.isArray(proof[key])) throw new Error(`learnerKernel.worldAdapter: proof.${key} must be an array`);
    }
    for (const premiseId of [...proof.heldPremiseIds, ...proof.releasedPremiseIds]) {
      if (!criticalSet.has(premiseId)) {
        throw new Error(`learnerKernel.worldAdapter: unknown internal critical premise ${premiseId}`);
      }
    }
    if (!Number.isFinite(Number(proof.harmfulProofDebt)) || Number(proof.harmfulProofDebt) < 0) {
      throw new Error('learnerKernel.worldAdapter: harmful proof debt must be non-negative');
    }
    return true;
  };

  const proofSnapshot = (proof) => {
    validateHiddenProofState(proof);
    const facts = factsForProof(proof);
    const closed = closure(facts, world.rules);
    const rawDistance = derivationDistance(world, facts);
    return {
      raw_distance: rawDistance,
      normalized_distance: Number((rawDistance / normalizationDenominator).toFixed(6)),
      normalization_denominator: normalizationDenominator,
      harmful_proof_debt: Number(proof.harmfulProofDebt || 0),
      held_critical_count: proof.heldPremiseIds.length,
      released_critical_count: proof.releasedPremiseIds.length,
      voiced_derived_count: proof.voicedDerivedFactKeys.length,
      best_path_coverage: Number((proof.heldPremiseIds.length / criticalPremiseIds.length).toFixed(3)),
      final_secret_entailed: closed.facts.has(secretKey),
    };
  };

  const initialHiddenProofState = () => ({
    heldPremiseIds: [...initialHeldIds],
    releasedPremiseIds: [...initialHeldIds],
    voicedDerivedFactKeys: [],
    harmfulProofDebt: 0,
  });

  const nextChallengePremiseId = (proof) =>
    challengeIds.find((premiseId) => !proof.releasedPremiseIds.includes(premiseId)) || null;

  const nextReleasedUnheldPremiseId = (proof) =>
    challengeIds.find(
      (premiseId) => proof.releasedPremiseIds.includes(premiseId) && !proof.heldPremiseIds.includes(premiseId),
    ) || null;

  const nextDerivableFact = (proof) => {
    const closed = closure(factsForProof(proof), world.rules);
    for (const key of observableDerivedKeys) {
      if (!closed.facts.has(key) || proof.voicedDerivedFactKeys.includes(key)) continue;
      return closed.facts.get(key);
    }
    return null;
  };

  const evidenceEvent = (kind, premiseId, { releasePremiseId = null, harmfulDebtDelta = 0 } = {}) => {
    const premise = world.premiseById.get(premiseId);
    if (!premise || !criticalSet.has(premiseId)) {
      throw new Error(`learnerKernel.worldAdapter: event references unknown critical premise ${premiseId}`);
    }
    return {
      kind,
      event_id: `${kind}:evidence_${String(premiseSlot.get(premiseId)).padStart(2, '0')}`,
      semantic_role: kind === 'retract' ? 'public_evidence_loss' : 'public_evidence_uptake',
      public_surface: String(premise.surface || '').trim(),
      harmful_debt_delta: Number(harmfulDebtDelta),
      _internal_premise_id: premiseId,
      _internal_release_premise_id: releasePremiseId,
    };
  };

  const deriveEvent = (fact, { harmfulDebtDelta = 0 } = {}) => {
    const key = factKey(fact);
    const slot = derivedSlot.get(key);
    if (!slot || structuralDerivedKeys.has(key)) {
      throw new Error('learnerKernel.worldAdapter: derive event must be an observable fact licensed by the world closure');
    }
    return {
      kind: 'derive',
      event_id: `derive:inference_${String(slot).padStart(2, '0')}`,
      semantic_role: key === secretKey ? 'supported_final_inference' : 'supported_intermediate_inference',
      public_surface:
        key === secretKey
          ? 'The public evidence now supports the answer to the inquiry.'
          : 'The public evidence now supports a further intermediate inference.',
      harmful_debt_delta: Number(harmfulDebtDelta),
      _internal_fact: cloneKernelValue(fact),
      _internal_fact_key: key,
    };
  };

  const retractHypothesisEvent = ({ harmfulDebtDelta = -1 } = {}) => ({
    kind: 'retract',
    event_id: 'retract:unsupported_hypothesis',
    semantic_role: 'unsupported_hypothesis_repair',
    public_surface: 'The learner withdraws an earlier unsupported conclusion.',
    harmful_debt_delta: Number(harmfulDebtDelta),
    _internal_hypothesis: true,
  });

  const noneEvent = ({ releasePremiseId = null, harmfulDebtDelta = 0, semanticRole = 'no_public_dag_move' } = {}) => ({
    kind: 'none',
    event_id: null,
    semantic_role: semanticRole,
    public_surface: '',
    harmful_debt_delta: Number(harmfulDebtDelta),
    _internal_release_premise_id: releasePremiseId,
  });

  const applyEvent = (proof, event) => {
    validateHiddenProofState(proof);
    const next = cloneProofState(proof);
    if (event._internal_release_premise_id) {
      next.releasedPremiseIds = unique([...next.releasedPremiseIds, event._internal_release_premise_id]);
    }
    if (event.kind === 'adopt' && event._internal_premise_id) {
      next.releasedPremiseIds = unique([...next.releasedPremiseIds, event._internal_premise_id]);
      next.heldPremiseIds = unique([...next.heldPremiseIds, event._internal_premise_id]);
    }
    if (event.kind === 'retract' && event._internal_premise_id) {
      next.heldPremiseIds = next.heldPremiseIds.filter((premiseId) => premiseId !== event._internal_premise_id);
    }
    if (event.kind === 'derive' && event._internal_fact_key) {
      next.voicedDerivedFactKeys = unique([...next.voicedDerivedFactKeys, event._internal_fact_key]);
    }
    next.harmfulProofDebt = Math.max(0, next.harmfulProofDebt + Number(event.harmful_debt_delta || 0));
    validateHiddenProofState(next);
    return next;
  };

  const targets = ({ beforeProof, afterProof, event }) => {
    const before = proofSnapshot(beforeProof);
    const after = proofSnapshot(afterProof);
    const nextProofTrajectory =
      after.raw_distance > before.raw_distance || after.harmful_proof_debt > before.harmful_proof_debt
        ? 'regress'
        : after.raw_distance < before.raw_distance
          ? 'advance'
          : 'stall';
    return {
      next_dag_event_family: ['adopt', 'derive', 'retract'].includes(event?.kind) ? event.kind : 'none',
      next_proof_trajectory: nextProofTrajectory,
    };
  };

  const proofTransition = ({ beforeProof, afterProof, currentTurn }) => {
    const before = proofSnapshot(beforeProof);
    const after = proofSnapshot(afterProof);
    return {
      schema: ADAPTIVE_STATE_PROOF_TRANSITION_V2_SCHEMA,
      normalization_denominator: normalizationDenominator,
      current: {
        turn: Number(currentTurn),
        raw_distance: before.raw_distance,
        harmful_proof_debt: before.harmful_proof_debt,
      },
      next: {
        turn: Number(currentTurn) + 1,
        raw_distance: after.raw_distance,
        harmful_proof_debt: after.harmful_proof_debt,
      },
      provenance: {
        world_id: id,
        source_world_id: world.id,
        world_sha256: worldSha256,
        adapter_version: 'world-normalized-proof-v2.1',
        geometry,
        structural_support_rule_ids: [...structuralRuleIds].sort(),
      },
    };
  };

  const publicEnvelope = ({ kernelId, actionType, turn, afterState, event }) => {
    const proof = afterState.proof;
    const releasedSurfaces = proof.releasedPremiseIds.map((premiseId) =>
      String(world.premiseById.get(premiseId).surface || '').trim(),
    );
    const releasedEvidence = proof.releasedPremiseIds.map((premiseId) => ({
      surface: String(world.premiseById.get(premiseId).surface || '').trim(),
      fact: cloneKernelValue(world.premiseById.get(premiseId).fact),
    }));
    const publicFact = event._internal_fact
      ? cloneKernelValue(event._internal_fact)
      : event._internal_premise_id
        ? cloneKernelValue(world.premiseById.get(event._internal_premise_id)?.fact || null)
        : null;
    const publicEvent = event.event_id
      ? {
          event_id: event.event_id,
          kind: event.kind,
          semantic_role: event.semantic_role,
          semantic_payload: {
            schema: ADAPTIVE_STATE_PUBLIC_SEMANTIC_EVENT_SCHEMA,
            operation: event.kind,
            fact: publicFact,
            canonical_atom: publicFact ? JSON.stringify(publicFact) : null,
            object_level_claim: publicFact !== null,
          },
          ...(event.public_surface ? { evidence_surface: event.public_surface } : {}),
        }
      : null;
    return {
      schema: ADAPTIVE_STATE_PUBLIC_ACT_ENVELOPE_SCHEMA,
      turn,
      generator_id: kernelId,
      world: { id, title: world.title, geometry, question: world.question },
      current_action: { action_type: actionType },
      current_public_act_envelope: {
        event_family: event.kind,
        event_ids: publicEvent ? [publicEvent.event_id] : [],
        events: publicEvent ? [publicEvent] : [],
        semantic_role: event.semantic_role,
        state_cues: cloneKernelValue(afterState.public_cues || {}),
      },
      public_world_vocabulary: {
        question: world.question,
        rule_glosses: world.rules.map((rule) => String(rule.gloss || '').trim()).filter(Boolean),
        released_evidence_surfaces: releasedSurfaces,
        released_evidence: releasedEvidence,
      },
      required_realizer_output: {
        learner_text: 'non-empty string',
        realized_public_event_ids: publicEvent ? [publicEvent.event_id] : [],
      },
    };
  };

  const initialPublicEnvelope = ({ kernelId, state, turn = 1 }) =>
    publicEnvelope({
      kernelId,
      actionType: 'initial_public_observation',
      turn,
      afterState: state,
      event: noneEvent({ semanticRole: 'initial_public_learner_state' }),
    });

  const turnRecord = ({ turn, learnerText, state, event }) => {
    const snapshot = proofSnapshot(state.proof);
    const classifier = classifierForEvent(event, snapshot);
    const accepted = { adopt: [], retract: [], derive: [] };
    if (event.kind === 'adopt' && event._internal_premise_id) accepted.adopt.push(event._internal_premise_id);
    if (event.kind === 'retract') {
      accepted.retract.push(event._internal_premise_id || event.event_id);
    }
    if (event.kind === 'derive' && event._internal_fact) accepted.derive.push(cloneKernelValue(event._internal_fact));
    const bottleneck =
      snapshot.raw_distance === 0
        ? 'assertion_gap'
        : nextReleasedUnheldPremiseId(state.proof)
          ? 'learner_integration_gap'
          : 'release_or_pacing_gap';
    return {
      turn,
      learner: String(learnerText || '').trim(),
      classification: {
        turn: {
          request_type: classifier.request_type,
          discourse_move: classifier.discourse_move,
          evidence_use: classifier.evidence_use,
          epistemic_stance: classifier.epistemic_stance,
          agency: classifier.agency,
          affect: classifier.affect,
          scores: {
            conceptual_engagement: { score: classifier.conceptual },
            epistemic_readiness: { score: classifier.readiness },
          },
        },
      },
      tutorLearnerDagModel: {
        turn,
        assessment: {
          status: 'available',
          bottleneck,
          bestPathCoverage: snapshot.best_path_coverage,
          missingPremiseCount: snapshot.raw_distance,
          unsupportedAssertionCount: snapshot.harmful_proof_debt,
          finalSecretEntailed: snapshot.final_secret_entailed,
          assertedSecret: false,
          assertedMirror: false,
        },
        metrics: {
          missingPremiseCount: snapshot.raw_distance,
          groundedCount: snapshot.held_critical_count,
          voicedDerivedCount: snapshot.voiced_derived_count,
          candidateConclusionCount: snapshot.final_secret_entailed ? 1 : 0,
          answerCandidateCount: snapshot.final_secret_entailed ? 1 : 0,
        },
      },
      tutorLearnerDagUpdate: { accepted },
      humanDiscourseFrame: {
        proofDebt: {
          status: snapshot.harmful_proof_debt ? 'harmful_open' : 'none_open',
          counts: { open: snapshot.harmful_proof_debt, harmful: snapshot.harmful_proof_debt },
        },
        scaffoldState: { status: 'formal_kernel' },
        warrantPremiseAudit: { proofStatus: snapshot.harmful_proof_debt ? 'unsupported' : 'supported' },
      },
    };
  };

  const internalDropoutContext = (proof) => {
    validateHiddenProofState(proof);
    const board = new Map(factsForProof(proof).map((fact) => [factKey(fact), cloneKernelValue(fact)]));
    return {
      world,
      board,
      heldPremiseIds: [...proof.heldPremiseIds],
      premiseFact(premiseId) {
        return cloneKernelValue(world.premiseById.get(premiseId)?.fact || null);
      },
    };
  };

  return Object.freeze({
    schema: ADAPTIVE_STATE_WORLD_ADAPTER_SCHEMA,
    version: '2.1',
    id,
    source_world_id: world.id,
    source,
    world_sha256: worldSha256,
    geometry,
    normalization_denominator: normalizationDenominator,
    critical_premise_count: criticalPremiseIds.length,
    challenge_premise_count: challengeIds.length,
    structural_support_rule_ids: Object.freeze([...structuralRuleIds].sort()),
    observable_derived_fact_count: observableDerivedKeys.length,
    validateHiddenProofState,
    initialHiddenProofState,
    proofSnapshot,
    nextChallengePremiseId,
    nextReleasedUnheldPremiseId,
    nextDerivableFact,
    adoptEvent(premiseId, options = {}) {
      return evidenceEvent('adopt', premiseId, options);
    },
    retractPremiseEvent(premiseId, options = {}) {
      return evidenceEvent('retract', premiseId, options);
    },
    deriveEvent,
    retractHypothesisEvent,
    noneEvent,
    applyEvent,
    targets,
    proofTransition,
    publicEnvelope,
    initialPublicEnvelope,
    turnRecord,
    internalDropoutContext,
  });
}

export function loadAdaptiveStateWorldAdapters(
  worldConfigs = DEFAULT_ADAPTIVE_STATE_WORLD_CONFIGS,
  { repoRoot = ROOT } = {},
) {
  if (!Array.isArray(worldConfigs) || !worldConfigs.length) {
    throw new Error('learnerKernel.worldAdapter: at least one world config is required');
  }
  return worldConfigs.map((config) => {
    const sourceFile = path.resolve(repoRoot, config.source);
    const world = loadWorld(sourceFile);
    return createWorldNormalizedProofAdapter({
      id: config.id,
      source: config.source,
      geometry: config.geometry,
      world,
      worldSha256: sha256File(sourceFile),
      structuralSupportRuleIds: config.structural_support_rule_ids || [],
    });
  });
}
