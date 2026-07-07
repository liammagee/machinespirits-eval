import { buildLearnerDagFromResult } from './learnerDag.js';

export const LEARNER_FIELD_SCHEMA = 'machinespirits.derivation.learner-field.v1';

export const LEARNER_FIELD_DIMENSIONS = Object.freeze([
  'mastery',
  'confidence',
  'cognitiveLoad',
  'engagement',
  'productiveConfusion',
  'retentionStrength',
  'misconceptionRisk',
  'evidenceGrounding',
  'uncertainty',
]);

function clamp01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

function round3(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function formatFact(fact) {
  if (!Array.isArray(fact) || !fact.length) return '';
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}(${args.join(', ')})` : String(predicate ?? '');
}

function releaseByPremise(world) {
  const releases = new Map();
  for (const row of world?.releaseSchedule || []) {
    releases.set(row.premise, row);
  }
  return releases;
}

function pathRows(world) {
  return (world?.proofPaths || []).map((path, index) => ({
    id: path.id || path.name || path.label || `path_${index + 1}`,
    premiseIds: path.premises || [],
  }));
}

export function buildLearnerFieldTopology(world) {
  const releases = releaseByPremise(world);
  const paths = pathRows(world);
  const pathMembership = new Map();
  for (const path of paths) {
    for (const premiseId of path.premiseIds) {
      const memberships = pathMembership.get(premiseId) || [];
      memberships.push(path.id);
      pathMembership.set(premiseId, memberships);
    }
  }

  const nodes = (world?.premises || []).map((premise) => {
    const release = releases.get(premise.id) || {};
    return {
      id: `premise:${premise.id}`,
      kind: 'premise',
      premiseId: premise.id,
      factText: formatFact(premise.fact),
      pathIds: pathMembership.get(premise.id) || [],
      releaseTurn: Number.isFinite(Number(release.turn)) ? Number(release.turn) : null,
      releaseVia: release.via || null,
    };
  });

  const edges = [];
  for (const path of paths) {
    for (let i = 1; i < path.premiseIds.length; i += 1) {
      const from = `premise:${path.premiseIds[i - 1]}`;
      const to = `premise:${path.premiseIds[i]}`;
      edges.push({
        id: `field-edge:${path.id}:${path.premiseIds[i - 1]}->${path.premiseIds[i]}`,
        from,
        to,
        pathId: path.id,
        relation: 'authored_path_precedes',
      });
    }
  }

  return {
    schema: `${LEARNER_FIELD_SCHEMA}.topology`,
    worldId: world?.id || null,
    nodes,
    edges,
  };
}

function snapshotNodeByPremise(snapshot = {}) {
  const map = new Map();
  for (const node of snapshot.nodes || []) {
    if (!node?.premiseId) continue;
    map.set(node.premiseId, node);
  }
  return map;
}

function zeroVector() {
  return Object.fromEntries(LEARNER_FIELD_DIMENSIONS.map((dimension) => [dimension, 0]));
}

function vectorDelta(a = {}, b = {}) {
  return Object.fromEntries(
    LEARNER_FIELD_DIMENSIONS.map((dimension) => [dimension, round3((a[dimension] || 0) - (b[dimension] || 0))]),
  );
}

function vectorMagnitude(vector = {}) {
  const total = LEARNER_FIELD_DIMENSIONS.reduce((sum, dimension) => sum + (Number(vector[dimension]) || 0) ** 2, 0);
  return round3(Math.sqrt(total));
}

function classifyAttractor({ dimensions, released, held, speed }) {
  if (!released) return 'latent_unreleased';
  if (dimensions.misconceptionRisk >= 0.65 && dimensions.confidence >= 0.5) return 'misconception_attractor';
  if (dimensions.mastery >= 0.85 && dimensions.retentionStrength >= 0.6) return 'stable_mastery';
  if (dimensions.productiveConfusion >= 0.45 && dimensions.misconceptionRisk < 0.6) return 'productive_confusion';
  if (speed < 0.03 && dimensions.mastery < 0.65 && !held) return 'plateau';
  return 'open_learning';
}

function classifyPhase({ dimensions, velocity, attractor }) {
  if (attractor === 'misconception_attractor') return 'misconception_lock';
  if (velocity.mastery > 0.3 || velocity.evidenceGrounding > 0.3) return 'breakthrough';
  if (attractor === 'stable_mastery') return 'consolidation';
  if (attractor === 'plateau') return 'stalled';
  if (attractor === 'productive_confusion') return 'productive_confusion';
  if (dimensions.uncertainty >= 0.75) return 'unresolved';
  return 'developing';
}

function dimensionsForNode({ topologyNode, snapshot, snapshotPremiseNode, previousNode }) {
  const statuses = new Set(snapshotPremiseNode?.statuses || []);
  const held = Boolean((snapshot.heldPremiseIds || []).includes(topologyNode.premiseId));
  const released = topologyNode.releaseTurn === null || topologyNode.releaseTurn <= snapshot.turn;
  const voiced = Number(snapshot.metrics?.voicedDerivedCount || 0);
  const hypotheses = Number(snapshot.metrics?.hypothesisCount || 0);
  const grounded = Number(snapshot.metrics?.groundedFactCount || 0);
  const previousRetention = Number(previousNode?.dimensions?.retentionStrength || 0);
  const beliefOnly = statuses.has('belief_only') || statuses.has('overreach');

  const mastery = held ? 1 : statuses.has('grounded') ? 0.85 : released ? 0.25 : 0.05;
  const evidenceGrounding = held ? 1 : released ? 0.2 : 0;
  const confidence = held ? 0.75 : beliefOnly ? 0.58 : released ? 0.35 : 0.15;
  const cognitiveLoad = clamp01((released && !held ? 0.68 : held ? 0.22 : 0.28) + (beliefOnly ? 0.12 : 0));
  const engagement = clamp01(0.25 + grounded * 0.08 + voiced * 0.1 + hypotheses * 0.08);
  const productiveConfusion = held ? 0.1 : released ? (beliefOnly ? 0.25 : 0.6) : 0.15;
  const retentionStrength = held ? Math.max(previousRetention * 0.92, 0.65) : previousRetention * 0.82;
  const misconceptionRisk = clamp01(beliefOnly ? 0.72 : released && !held ? 0.28 : 0.12);
  const uncertainty = held ? 0.25 : released ? 0.62 : 0.85;

  return {
    mastery: round3(clamp01(mastery)),
    confidence: round3(clamp01(confidence)),
    cognitiveLoad: round3(cognitiveLoad),
    engagement: round3(engagement),
    productiveConfusion: round3(clamp01(productiveConfusion)),
    retentionStrength: round3(clamp01(retentionStrength)),
    misconceptionRisk: round3(misconceptionRisk),
    evidenceGrounding: round3(clamp01(evidenceGrounding)),
    uncertainty: round3(clamp01(uncertainty)),
  };
}

function buildFieldNode({ topologyNode, snapshot, snapshotPremiseNode, previousNode }) {
  const dimensions = dimensionsForNode({ topologyNode, snapshot, snapshotPremiseNode, previousNode });
  const velocity = previousNode ? vectorDelta(dimensions, previousNode.dimensions) : zeroVector();
  const previousVelocity = previousNode?.dynamics?.velocity || zeroVector();
  const acceleration = previousNode ? vectorDelta(velocity, previousVelocity) : zeroVector();
  const speed = vectorMagnitude(velocity);
  const accelerationMagnitude = vectorMagnitude(acceleration);
  const held = Boolean((snapshot.heldPremiseIds || []).includes(topologyNode.premiseId));
  const released = topologyNode.releaseTurn === null || topologyNode.releaseTurn <= snapshot.turn;
  const attractor = classifyAttractor({ dimensions, released, held, speed });
  const phase = classifyPhase({ dimensions, velocity, attractor });
  return {
    ...topologyNode,
    held,
    released,
    statuses: snapshotPremiseNode?.statuses || [],
    dimensions,
    dynamics: {
      velocity,
      acceleration,
      speed,
      accelerationMagnitude,
      curvature: speed > 0 ? round3(accelerationMagnitude / Math.max(speed, 0.001)) : 0,
    },
    attractor,
    phase,
  };
}

function hasAnyStatus(node = {}, statuses = []) {
  const nodeStatuses = new Set(node.statuses || []);
  return statuses.some((status) => nodeStatuses.has(status));
}

function evidenceAttractorForNode(node) {
  if (hasAnyStatus(node, ['unsupported_assertion', 'overreach', 'belief_only'])) return 'misconception_attractor';
  if (hasAnyStatus(node, ['hypothesis'])) return 'productive_confusion';
  return 'open_learning';
}

function dimensionsForEvidenceNode({ sourceNode, previousNode }) {
  const previousRetention = Number(previousNode?.dimensions?.retentionStrength || 0);
  const misconceptionLike = hasAnyStatus(sourceNode, ['unsupported_assertion', 'overreach', 'belief_only']);
  const hypothesis = hasAnyStatus(sourceNode, ['hypothesis']);
  return {
    mastery: misconceptionLike ? 0 : 0.12,
    confidence: misconceptionLike ? 0.64 : hypothesis ? 0.38 : 0.3,
    cognitiveLoad: misconceptionLike ? 0.6 : 0.48,
    engagement: hypothesis ? 0.6 : 0.42,
    productiveConfusion: misconceptionLike ? 0.2 : hypothesis ? 0.66 : 0.38,
    retentionStrength: round3(clamp01(previousRetention * 0.82)),
    misconceptionRisk: misconceptionLike ? 0.84 : 0.24,
    evidenceGrounding: misconceptionLike ? 0 : 0.1,
    uncertainty: misconceptionLike ? 0.56 : 0.78,
  };
}

function buildEvidenceFieldNode({ sourceNode, snapshot, previousNode }) {
  const dimensions = dimensionsForEvidenceNode({ sourceNode, previousNode });
  const velocity = previousNode ? vectorDelta(dimensions, previousNode.dimensions) : zeroVector();
  const previousVelocity = previousNode?.dynamics?.velocity || zeroVector();
  const acceleration = previousNode ? vectorDelta(velocity, previousVelocity) : zeroVector();
  const speed = vectorMagnitude(velocity);
  const accelerationMagnitude = vectorMagnitude(acceleration);
  const attractor = evidenceAttractorForNode(sourceNode);
  const phase = classifyPhase({ dimensions, velocity, attractor });
  return {
    id: `learner-signal:${sourceNode.id}`,
    kind: 'learner_signal',
    sourceNodeId: sourceNode.id,
    sourceKind: sourceNode.kind || null,
    source: sourceNode.source || null,
    turn: sourceNode.turn ?? snapshot.turn ?? null,
    factText: sourceNode.factText || sourceNode.text || sourceNode.label || '',
    statuses: sourceNode.statuses || [],
    held: false,
    released: true,
    pathIds: [],
    dimensions,
    dynamics: {
      velocity,
      acceleration,
      speed,
      accelerationMagnitude,
      curvature: speed > 0 ? round3(accelerationMagnitude / Math.max(speed, 0.001)) : 0,
    },
    attractor,
    phase,
  };
}

function evidenceSourceNodes(snapshot = {}) {
  return (snapshot.nodes || []).filter((node) => {
    if (node.premiseId) return false;
    return hasAnyStatus(node, ['unsupported_assertion', 'overreach', 'belief_only', 'hypothesis']);
  });
}

function allFieldNodes(snapshot = {}) {
  return [...(snapshot?.nodes || []), ...(snapshot?.evidenceNodes || [])];
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function summarizeLearnerFieldSnapshot(snapshot) {
  const nodes = allFieldNodes(snapshot);
  const dimensions = Object.fromEntries(
    LEARNER_FIELD_DIMENSIONS.map((dimension) => [
      dimension,
      round3(average(nodes.map((node) => node.dimensions?.[dimension]))),
    ]),
  );
  return {
    nodeCount: nodes.length,
    topologyNodeCount: (snapshot?.nodes || []).length,
    evidenceNodeCount: (snapshot?.evidenceNodes || []).length,
    heldCount: (snapshot?.nodes || []).filter((node) => node.held).length,
    releasedCount: (snapshot?.nodes || []).filter((node) => node.released).length,
    meanSpeed: round3(average(nodes.map((node) => node.dynamics?.speed))),
    dimensions,
    attractorCounts: countBy(nodes.map((node) => node.attractor)),
    phaseCounts: countBy(nodes.map((node) => node.phase)),
  };
}

export function recommendLearnerFieldActions(snapshot) {
  const counts = snapshot?.summary?.attractorCounts || {};
  const actions = [];
  if (counts.misconception_attractor) {
    actions.push({
      action: 'destabilize_misconception',
      reason: 'high-confidence unsupported structure is acting as an attractor',
    });
  }
  if (counts.productive_confusion) {
    actions.push({
      action: 'scaffold_next_observation',
      reason: 'learner appears productively unsettled around released but unheld material',
    });
  }
  if (counts.plateau) {
    actions.push({
      action: 'change_representation_or_retrieve',
      reason: 'field velocity is low while mastery remains incomplete',
    });
  }
  if (counts.latent_unreleased) {
    actions.push({
      action: 'hold_or_prepare_release',
      reason: 'some topology nodes remain unreleased or latent',
    });
  }
  if (!actions.length)
    actions.push({ action: 'continue_current_policy', reason: 'no strong adverse attractor detected' });
  return actions;
}

export function buildLearnerFieldSnapshot(world, learnerDagSnapshot, previousFieldSnapshot = null) {
  const topology = buildLearnerFieldTopology(world);
  const prior = new Map(allFieldNodes(previousFieldSnapshot).map((node) => [node.id, node]));
  const snapshotNodes = snapshotNodeByPremise(learnerDagSnapshot);
  const nodes = topology.nodes.map((topologyNode) =>
    buildFieldNode({
      topologyNode,
      snapshot: learnerDagSnapshot,
      snapshotPremiseNode: snapshotNodes.get(topologyNode.premiseId) || null,
      previousNode: prior.get(topologyNode.id) || null,
    }),
  );
  const evidenceNodes = evidenceSourceNodes(learnerDagSnapshot).map((sourceNode) =>
    buildEvidenceFieldNode({
      sourceNode,
      snapshot: learnerDagSnapshot,
      previousNode: prior.get(`learner-signal:${sourceNode.id}`) || null,
    }),
  );
  const field = {
    schema: `${LEARNER_FIELD_SCHEMA}.snapshot`,
    worldId: world?.id || null,
    source: learnerDagSnapshot?.source || 'unknown',
    turn: learnerDagSnapshot?.turn ?? null,
    topology: {
      nodeCount: topology.nodes.length,
      edgeCount: topology.edges.length,
    },
    nodes,
    evidenceNodes,
    edges: topology.edges,
  };
  field.summary = summarizeLearnerFieldSnapshot(field);
  field.recommendedActions = recommendLearnerFieldActions(field);
  return field;
}

export function summarizeLearnerFieldTrajectory(field = {}) {
  const turns = field.turns || [];
  const first = turns[0]?.summary?.dimensions || {};
  const final = turns.at(-1)?.summary?.dimensions || {};
  return {
    turnCount: turns.length,
    finalTurn: turns.at(-1)?.turn ?? null,
    fieldDelta: Object.fromEntries(
      LEARNER_FIELD_DIMENSIONS.map((dimension) => [
        dimension,
        round3((final[dimension] || 0) - (first[dimension] || 0)),
      ]),
    ),
    meanSpeed: round3(average(turns.map((turn) => turn.summary?.meanSpeed))),
    finalAttractorCounts: turns.at(-1)?.summary?.attractorCounts || {},
    finalRecommendedActions: turns.at(-1)?.recommendedActions || [],
  };
}

export function buildDynamicLearnerField(world, learnerDag = {}) {
  let previous = null;
  const turns = (learnerDag.turns || []).map((snapshot) => {
    const fieldSnapshot = buildLearnerFieldSnapshot(world, snapshot, previous);
    previous = fieldSnapshot;
    return fieldSnapshot;
  });
  const field = {
    schema: LEARNER_FIELD_SCHEMA,
    worldId: world?.id || null,
    source: learnerDag.source || 'unknown',
    topology: buildLearnerFieldTopology(world),
    turns,
    final: turns.at(-1) || null,
  };
  field.trajectory = summarizeLearnerFieldTrajectory(field);
  return field;
}

export function buildDynamicLearnerFieldFromResult(world, result = {}) {
  const learnerDag = buildLearnerDagFromResult(world, result);
  return learnerDag ? buildDynamicLearnerField(world, learnerDag) : null;
}
