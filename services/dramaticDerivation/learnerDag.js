import { closure, entails, factKey } from './chainer.js';

export const LEARNER_DAG_SCHEMA = 'machinespirits.derivation.learner-dag.v1';

function formatFact(fact) {
  if (!Array.isArray(fact)) return String(fact ?? '');
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}(${args.join(', ')})` : String(predicate ?? '');
}

function asFacts(values = []) {
  return values.filter((fact) => Array.isArray(fact) && fact.length);
}

function keySet(facts = []) {
  return new Set(asFacts(facts).map(factKey));
}

function releaseMapForTurn(world, ledger = [], turn = Infinity) {
  const map = new Map();
  for (const row of ledger || []) {
    if (!row?.premiseId || row.turn > turn) continue;
    const premise = world.premiseById.get(row.premiseId);
    if (!premise) continue;
    map.set(factKey(premise.fact), { premiseId: row.premiseId, turn: row.turn, via: row.via || null });
  }
  return map;
}

function backgroundKeySet(world) {
  return new Set((world.background || []).map(factKey));
}

function premiseSurface(world, premiseId, fact) {
  const premise = premiseId ? world.premiseById.get(premiseId) : null;
  return premise?.surface || formatFact(fact);
}

function sourceForFact(world, fact, releases, backgrounds) {
  const key = factKey(fact);
  if (backgrounds.has(key)) {
    return { source: 'background', label: 'background', surface: formatFact(fact) };
  }
  const release = releases.get(key);
  if (release) {
    return {
      source: 'released_premise',
      label: release.premiseId,
      premiseId: release.premiseId,
      releaseTurn: release.turn,
      releaseVia: release.via,
      surface: premiseSurface(world, release.premiseId, fact),
    };
  }
  return { source: 'learner_only', label: 'learner-only', surface: formatFact(fact) };
}

function addUnique(array, value, keyFn) {
  const key = keyFn(value);
  if (array.some((existing) => keyFn(existing) === key)) return;
  array.push(value);
}

function normalizeVoiced(voiced = []) {
  return voiced
    .map((entry) => ({
      fact: entry.fact,
      turn: entry.turn ?? null,
    }))
    .filter((entry) => Array.isArray(entry.fact));
}

export function buildLearnerDagSnapshot(
  world,
  {
    turn,
    boardFacts = [],
    validFacts = boardFacts,
    voiced = [],
    hypotheses = [],
    assertion = null,
    learnerText = null,
    ledger = [],
    source = 'engine_board',
  } = {},
) {
  const valid = asFacts(validFacts);
  const board = asFacts(boardFacts);
  const cl = closure(valid, world.rules);
  const validKeys = keySet(valid);
  const boardKeys = keySet(board);
  const voicedRows = normalizeVoiced(voiced);
  const voicedKeys = new Set(voicedRows.map((entry) => factKey(entry.fact)));
  const assertionKey = Array.isArray(assertion) ? factKey(assertion) : null;
  const releases = releaseMapForTurn(world, ledger, turn);
  const backgrounds = backgroundKeySet(world);
  const nodes = [];
  const edges = [];

  const upsertNode = (fact, status, extra = {}) => {
    const key = factKey(fact);
    const sourceInfo = sourceForFact(world, fact, releases, backgrounds);
    const current = nodes.find((node) => node.key === key);
    const statusSet = new Set([...(current?.statuses || []), status].filter(Boolean));
    const next = {
      id: `fact:${key}`,
      key,
      kind: 'fact',
      fact,
      factText: formatFact(fact),
      statuses: [...statusSet].sort(),
      ...sourceInfo,
      ...extra,
    };
    if (current) Object.assign(current, next);
    else nodes.push(next);
  };

  const includeFact = (key, status = 'supporting_derived') => {
    const fact = cl.facts.get(key);
    if (!fact) return;
    const effectiveStatus = validKeys.has(key)
      ? 'grounded'
      : boardKeys.has(key)
        ? 'belief_only'
        : voicedKeys.has(key)
          ? 'voiced_derived'
          : assertionKey === key
            ? 'asserted'
            : status;
    upsertNode(fact, effectiveStatus, { proofAvailable: Boolean(cl.proofs.get(key)) });
    const proof = cl.proofs.get(key);
    if (!proof) return;
    for (const premiseKey of proof.premises) includeFact(premiseKey, 'supporting');
    addUnique(
      edges,
      {
        id: `edge:${proof.rule}:${proof.premises.join('+')}=>${key}`,
        from: [...proof.premises],
        to: key,
        rule: proof.rule,
        kind: 'inference',
      },
      (edge) => edge.id,
    );
  };

  for (const fact of valid) upsertNode(fact, 'grounded', { proofAvailable: Boolean(cl.proofs.get(factKey(fact))) });
  for (const fact of board) {
    if (!validKeys.has(factKey(fact))) upsertNode(fact, 'belief_only', { proofAvailable: false });
  }
  for (const entry of voicedRows) {
    const key = factKey(entry.fact);
    if (cl.facts.has(key)) includeFact(key, 'voiced_derived');
    else upsertNode(entry.fact, 'overreach', { proofAvailable: false, voicedTurn: entry.turn });
  }
  if (assertionKey) {
    if (cl.facts.has(assertionKey)) includeFact(assertionKey, 'asserted');
    else upsertNode(assertion, 'unsupported_assertion', { proofAvailable: false });
  }

  const scopedHypotheses = (hypotheses || []).filter((hypothesis) => hypothesis.turn <= turn && hypothesis.text);
  for (const hypothesis of scopedHypotheses) {
    nodes.push({
      id: `hypothesis:${hypothesis.turn}:${nodes.length}`,
      kind: 'hypothesis',
      text: hypothesis.text,
      turn: hypothesis.turn,
      statuses: ['hypothesis'],
      source: 'learner_hypothesis',
      label: `hypothesis t${hypothesis.turn}`,
    });
  }

  const heldPremiseIds = [...new Set(nodes.map((node) => node.premiseId).filter(Boolean))].sort();
  const secretEntailed = entails(valid, world.rules, world.secret.fact);
  return {
    schema: `${LEARNER_DAG_SCHEMA}.snapshot`,
    source,
    turn,
    learnerText,
    nodes: nodes.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    heldPremiseIds,
    secretEntailed,
    asserted: assertion || null,
    metrics: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      groundedFactCount: valid.length,
      beliefFactCount: board.length,
      voicedDerivedCount: nodes.filter((node) => node.statuses?.includes('voiced_derived')).length,
      hypothesisCount: scopedHypotheses.length,
      unsupportedAssertionCount: nodes.filter((node) => node.statuses?.includes('unsupported_assertion')).length,
    },
  };
}

export function assessLearnerDag(world, learnerDag = {}) {
  const turns = learnerDag.turns || [];
  const final = learnerDag.final || turns.at(-1) || null;
  if (!world || !final) {
    return {
      schema: 'machinespirits.derivation.learner-dag-assessment.v1',
      status: 'unavailable',
      reason: 'missing world or learner DAG',
    };
  }
  const pathCoverage = (world.proofPaths || []).map((path, index) => {
    const premiseIds = path.premises || [];
    const held = premiseIds.filter((id) => final.heldPremiseIds.includes(id));
    return {
      id: path.id || path.name || path.label || `path_${index + 1}`,
      premiseIds,
      heldPremiseIds: held,
      missingPremiseIds: premiseIds.filter((id) => !final.heldPremiseIds.includes(id)),
      coverage: premiseIds.length ? Number((held.length / premiseIds.length).toFixed(3)) : 0,
      complete: premiseIds.length > 0 && held.length === premiseIds.length,
    };
  });
  const bestPath = [...pathCoverage].sort(
    (a, b) =>
      b.coverage - a.coverage || a.missingPremiseIds.length - b.missingPremiseIds.length || a.id.localeCompare(b.id),
  )[0] || { id: null, coverage: 0, complete: false, missingPremiseIds: [] };
  const firstCompletePathTurn =
    turns.find((snapshot) =>
      (world.proofPaths || []).some((path) =>
        (path.premises || []).every((id) => snapshot.heldPremiseIds.includes(id)),
      ),
    )?.turn ?? null;
  const firstSecretEntailedTurn = turns.find((snapshot) => snapshot.secretEntailed)?.turn ?? null;
  const secretKey = factKey(world.secret.fact);
  const mirrorKey = world.mirror ? factKey(world.mirror.fact) : null;
  const assertedKey = final.asserted ? factKey(final.asserted) : null;
  return {
    schema: 'machinespirits.derivation.learner-dag-assessment.v1',
    status: 'available',
    source: learnerDag.source || final.source || 'unknown',
    finalTurn: final.turn,
    pathCoverage,
    bestPathId: bestPath.id,
    bestPathCoverage: bestPath.coverage,
    completePathIds: pathCoverage.filter((row) => row.complete).map((row) => row.id),
    missingOnBestPath: bestPath.missingPremiseIds,
    firstCompletePathTurn,
    firstSecretEntailedTurn,
    finalSecretEntailed: Boolean(final.secretEntailed),
    assertedSecret: assertedKey === secretKey,
    assertedMirror: Boolean(mirrorKey && assertedKey === mirrorKey),
    unsupportedAssertionCount: final.metrics?.unsupportedAssertionCount || 0,
    voicedDerivedCount: final.metrics?.voicedDerivedCount || 0,
    hypothesisCount: final.metrics?.hypothesisCount || 0,
    interpretation:
      'The learner DAG is reconstructed from learner-visible board actions and voiced derivations. It is assessed after the run against the authored DAG; it does not grant the learner access to proof_paths.',
  };
}

export function buildLearnerDag(timeline, world) {
  const turns = timeline || [];
  const dag = {
    schema: LEARNER_DAG_SCHEMA,
    source: turns[0]?.source || 'engine_board',
    turns,
    final: turns.at(-1) || null,
  };
  return { ...dag, assessment: assessLearnerDag(world, dag) };
}

export function buildLearnerDagFromResult(world, result = {}) {
  if (!world || !Array.isArray(result.transcript)) return null;
  const board = new Map();
  const hypotheses = [];
  const voiced = [];
  const snapshots = [];
  for (const line of result.transcript.filter((entry) => entry.role === 'learner').sort((a, b) => a.turn - b.turn)) {
    for (const fact of asFacts(line.meta?.retract || [])) board.delete(factKey(fact));
    for (const fact of asFacts(line.meta?.adopt || [])) board.set(factKey(fact), fact);
    if (line.meta?.hypothesis) hypotheses.push({ turn: line.turn, text: line.meta.hypothesis });
    const deriveFacts = asFacts(line.meta?.derive || []);
    const outcomes = Array.isArray(line.meta?.deriveOutcomes) ? line.meta.deriveOutcomes : [];
    deriveFacts.forEach((fact, index) => {
      const outcome = outcomes[index];
      if (!outcome || outcome.status === 'voiced') voiced.push({ fact, turn: line.turn });
    });
    snapshots.push(
      buildLearnerDagSnapshot(world, {
        turn: line.turn,
        boardFacts: [...board.values()],
        validFacts: [...board.values()],
        voiced,
        hypotheses,
        assertion: line.meta?.asserts || null,
        learnerText: line.text || null,
        ledger: result.ledger || [],
        source: 'transcript_reconstruction',
      }),
    );
  }
  return buildLearnerDag(snapshots, world);
}
