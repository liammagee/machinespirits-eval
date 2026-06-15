import { closure, factKey, proofTree } from './chainer.js';
import { releaseSolvency } from './pacing.js';
import { VISIBLE_GUARD_DEFAULTS } from './visiblePacing.js';

export const GUARD_COMPILER_SCHEMA = 'dramatic-derivation.guard-compiler.v0';
export const DEFAULT_RELEASE_LATITUDE = 2;

export const LOGIC_IR_SCHEMA = 'dramatic-derivation.logic-ir.v0';
export const REPRESENTATION_SELECTOR_SCHEMA = 'dramatic-derivation.representation-selector.v0';
export const REPRESENTATION_SELECTOR_V1_SCHEMA = 'dramatic-derivation.representation-selector.v1';
export const REPRESENTATION_SELECTOR_V2_SCHEMA = 'dramatic-derivation.representation-selector.v2';
export const REPRESENTATION_SELECTOR_V3_SCHEMA = 'dramatic-derivation.representation-selector.v3';

function predicateOf(fact) {
  return Array.isArray(fact) ? fact[0] : null;
}

function isVariableAtom(atom) {
  return typeof atom === 'string' && atom.startsWith('?');
}

function atomList(values) {
  return [...new Set(values.filter((v) => typeof v === 'string'))].sort();
}

function rulePatternKey(pattern) {
  return Array.isArray(pattern) ? `${pattern[0]}/${pattern.length}` : null;
}

function scheduleByPremise(world) {
  return new Map(world.releaseSchedule.map((entry) => [entry.premise, entry]));
}

function factToPremiseIds(world) {
  const out = new Map();
  for (const premise of world.premises) {
    const key = factKey(premise.fact);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(premise.id);
  }
  return out;
}

function collectBaseFactKeys(tree) {
  if (!tree) return [];
  if (tree.base) return [factKey(tree.fact)];
  return (tree.premises || []).flatMap(collectBaseFactKeys);
}

function factAtoms(fact) {
  return Array.isArray(fact)
    ? fact.slice(1).filter((atom) => typeof atom === 'string' && !isVariableAtom(atom))
    : [];
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value != null))].sort();
}

function collectEntities(world) {
  const atoms = [];
  const addFact = (fact) => {
    if (!Array.isArray(fact)) return;
    atoms.push(...fact.slice(1).filter((atom) => typeof atom === 'string' && !atom.startsWith('?')));
  };
  for (const premise of world.premises) addFact(premise.fact);
  for (const fact of world.background || []) addFact(fact);
  addFact(world.secret.fact);
  if (world.mirror?.fact) addFact(world.mirror.fact);
  return atomList(atoms);
}

function branchOverlap(branches) {
  const overlaps = [];
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const sharedFactKeys = branches[i].baseFactKeys.filter((key) => branches[j].baseFactKeys.includes(key));
      const sharedPremiseIds = branches[i].basePremiseIds.filter((id) => branches[j].basePremiseIds.includes(id));
      if (sharedFactKeys.length || sharedPremiseIds.length) {
        overlaps.push({
          branchIds: [branches[i].id, branches[j].id],
          sharedFactKeys,
          sharedPremiseIds,
        });
      }
    }
  }
  return overlaps;
}

function secretProofGraph(world) {
  const premiseIdsByFact = factToPremiseIds(world);
  const fullFacts = [...(world.background || []), ...world.premises.map((premise) => premise.fact)];
  const tree = proofTree(fullFacts, world.rules, world.secret.fact);
  const topBranches = tree?.base
    ? []
    : (tree?.premises || []).map((branch, index) => {
        const baseFactKeys = [...new Set(collectBaseFactKeys(branch))].sort();
        const basePremiseIds = [
          ...new Set(baseFactKeys.flatMap((key) => premiseIdsByFact.get(key) || [])),
        ].sort();
        return {
          id: `secret_branch_${index + 1}`,
          rootFact: branch.fact,
          rootPredicate: predicateOf(branch.fact),
          rootRule: branch.rule || null,
          baseFactKeys,
          basePremiseIds,
        };
      });
  const overlaps = branchOverlap(topBranches);
  return {
    rootRule: tree?.rule || null,
    secretFact: world.secret.fact,
    topBranches,
    branchOverlap: overlaps,
    independentTopLevelJoin: topBranches.length > 1 && overlaps.length === 0,
  };
}

function proofPathIndexes(world) {
  const byPremise = new Map();
  world.proofPaths.forEach((path, index) => {
    for (const id of path.premises || []) {
      if (!byPremise.has(id)) byPremise.set(id, []);
      byPremise.get(id).push(index);
    }
  });
  return byPremise;
}

function sourcePremiseIdsForFact(key, proofs, premiseIdsByFact, memo = new Map()) {
  if (memo.has(key)) return memo.get(key);
  const direct = premiseIdsByFact.get(key) || [];
  const proof = proofs.get(key);
  const fromProof = proof?.premises?.flatMap((premiseKey) =>
    sourcePremiseIdsForFact(premiseKey, proofs, premiseIdsByFact, memo),
  ) || [];
  const out = uniqueSorted([...direct, ...fromProof]);
  memo.set(key, out);
  return out;
}

function proofDepthForFact(key, proofs, memo = new Map()) {
  if (memo.has(key)) return memo.get(key);
  const proof = proofs.get(key);
  if (!proof) {
    memo.set(key, 0);
    return 0;
  }
  const out = 1 + Math.max(...proof.premises.map((premiseKey) => proofDepthForFact(premiseKey, proofs, memo)));
  memo.set(key, out);
  return out;
}

function factNodeRoles({ key, backgroundKeys, premiseIds, secretKey, mirrorKey, derived }) {
  const roles = [];
  if (backgroundKeys.has(key)) roles.push('background');
  if (premiseIds.length) roles.push('premise');
  if (derived) roles.push('derived');
  if (key === secretKey) roles.push('secret');
  if (key === mirrorKey) roles.push('mirror');
  return roles.length ? roles : ['derived'];
}

function factNodeFromClosure({
  key,
  fact,
  proofs,
  world,
  scheduled,
  pathIndexes,
  premiseIdsByFact,
  backgroundKeys,
  secretKey,
  mirrorKey,
  proofCriticalIds,
  sourceMemo,
  depthMemo,
}) {
  const proof = proofs.get(key) || null;
  const premiseIds = uniqueSorted(premiseIdsByFact.get(key) || []);
  const sourcePremiseIds = sourcePremiseIdsForFact(key, proofs, premiseIdsByFact, sourceMemo);
  const sourceProofPathIndexes = uniqueSorted(
    sourcePremiseIds.flatMap((id) => pathIndexes.get(id) || []).map((index) => `path_${index + 1}`),
  );
  const releaseEntries = premiseIds
    .map((id) => scheduled.get(id))
    .filter(Boolean)
    .map((entry) => ({ premise: entry.premise, turn: entry.turn, via: entry.via }));
  return {
    factKey: key,
    fact,
    predicate: predicateOf(fact),
    constants: factAtoms(fact),
    roles: factNodeRoles({
      key,
      backgroundKeys,
      premiseIds,
      secretKey,
      mirrorKey,
      derived: Boolean(proof),
    }),
    premiseIds,
    proofCritical: premiseIds.some((id) => proofCriticalIds.has(id)),
    proofPathIds: uniqueSorted(premiseIds.flatMap((id) => (pathIndexes.get(id) || []).map((index) => `path_${index + 1}`))),
    sourcePremiseIds,
    sourceProofPathIds: sourceProofPathIndexes,
    release: releaseEntries,
    proof: proof
      ? {
          rule: proof.rule,
          inputFactKeys: proof.premises,
          depth: proofDepthForFact(key, proofs, depthMemo),
        }
      : null,
    surface: premiseIds.map((id) => world.premiseById.get(id)?.surface).filter(Boolean),
  };
}

function ruleHyperedgesFromClosure({ facts, proofs, premiseIdsByFact, pathIndexes, proofCriticalIds }) {
  const sourceMemo = new Map();
  return [...proofs.entries()]
    .filter(([, proof]) => proof)
    .map(([outputFactKey, proof], index) => {
      const outputFact = facts.get(outputFactKey);
      const sourcePremiseIds = sourcePremiseIdsForFact(outputFactKey, proofs, premiseIdsByFact, sourceMemo);
      return {
        id: `edge_${String(index + 1).padStart(3, '0')}`,
        ruleId: proof.rule,
        inputFactKeys: proof.premises,
        outputFactKey,
        inputPredicates: proof.premises.map((key) => predicateOf(facts.get(key))).filter(Boolean),
        outputPredicate: predicateOf(outputFact),
        sourcePremiseIds,
        sourceProofPathIds: uniqueSorted(
          sourcePremiseIds.flatMap((id) => pathIndexes.get(id) || []).map((pathIndex) => `path_${pathIndex + 1}`),
        ),
        proofCritical: sourcePremiseIds.some((id) => proofCriticalIds.has(id)),
      };
    })
    .sort((a, b) => a.outputFactKey.localeCompare(b.outputFactKey));
}

export function buildLogicIR(world, { source = null } = {}) {
  const scheduled = scheduleByPremise(world);
  const pathIndexes = proofPathIndexes(world);
  const premiseIdsByFact = factToPremiseIds(world);
  const backgroundKeys = new Set((world.background || []).map(factKey));
  const secretKey = factKey(world.secret.fact);
  const mirrorKey = world.mirror?.fact ? factKey(world.mirror.fact) : null;
  const proofCriticalIds = new Set(world.proofPaths.flatMap((path) => path.premises || []));
  const fullBase = [...(world.background || []), ...world.premises.map((premise) => premise.fact)];
  const { facts, proofs } = closure(fullBase, world.rules);
  const sourceMemo = new Map();
  const depthMemo = new Map();
  const factNodes = [...facts.entries()]
    .map(([key, fact]) =>
      factNodeFromClosure({
        key,
        fact,
        proofs,
        world,
        scheduled,
        pathIndexes,
        premiseIdsByFact,
        backgroundKeys,
        secretKey,
        mirrorKey,
        proofCriticalIds,
        sourceMemo,
        depthMemo,
      }),
    )
    .sort((a, b) => a.factKey.localeCompare(b.factKey));
  const factKeysByPredicate = {};
  for (const node of factNodes) {
    if (!node.predicate) continue;
    if (!factKeysByPredicate[node.predicate]) factKeysByPredicate[node.predicate] = [];
    factKeysByPredicate[node.predicate].push(node.factKey);
  }
  const ruleHyperedges = ruleHyperedgesFromClosure({ facts, proofs, premiseIdsByFact, pathIndexes, proofCriticalIds });

  return {
    schema: LOGIC_IR_SCHEMA,
    worldId: world.id,
    source,
    factNodes,
    ruleHyperedges,
    ruleDefinitions: world.rules.map((rule) => ({
      id: rule.id,
      inputPatterns: rule.if,
      outputPatterns: rule.then,
      gloss: rule.gloss || null,
    })),
    indexes: {
      factKeysByPredicate,
      secretFactKey: secretKey,
      mirrorFactKey: mirrorKey,
      backgroundFactKeys: [...backgroundKeys].sort(),
      proofCriticalPremiseIds: [...proofCriticalIds].sort(),
    },
  };
}

function factEntriesFromInput(values) {
  return (values || [])
    .map((entry) => (Array.isArray(entry) ? entry : entry?.fact))
    .filter((fact) => Array.isArray(fact));
}

export function projectWorldIRLogic(
  worldIR,
  { groundedFacts = [], voicedFacts = [], releasedPremiseIds = [], decayedPremiseIds = [] } = {},
) {
  const logic = worldIR?.logic;
  if (!logic?.factNodes || !logic?.ruleDefinitions) {
    throw new Error('derivation.guardCompiler: projectWorldIRLogic requires WorldIR.logic');
  }

  const grounded = factEntriesFromInput(groundedFacts);
  const voiced = factEntriesFromInput(voicedFacts);
  const groundedKeys = new Set(grounded.map(factKey));
  const voicedKeys = new Set(voiced.map(factKey));
  const releasedIds = new Set(releasedPremiseIds);
  const decayedIds = new Set(decayedPremiseIds);
  const staticNodeByKey = new Map(logic.factNodes.map((node) => [node.factKey, node]));
  const { facts, proofs } = closure(
    grounded,
    logic.ruleDefinitions.map((rule) => ({ id: rule.id, if: rule.inputPatterns, then: rule.outputPatterns })),
  );

  const projectedFactNodes = [...facts.entries()]
    .map(([key, fact]) => {
      const staticNode = staticNodeByKey.get(key);
      const premiseIds = staticNode?.premiseIds || [];
      const sourcePremiseIds = staticNode?.sourcePremiseIds || [];
      const touchedPremiseIds = uniqueSorted([...premiseIds, ...sourcePremiseIds]);
      return {
        factKey: key,
        fact,
        predicate: predicateOf(fact),
        roles: staticNode?.roles || ['runtime_only'],
        grounded: groundedKeys.has(key),
        derived: Boolean(proofs.get(key)),
        voiced: voicedKeys.has(key),
        released: staticNode?.roles?.includes('background') || touchedPremiseIds.some((id) => releasedIds.has(id)),
        unreleased: touchedPremiseIds.length > 0 && !touchedPremiseIds.some((id) => releasedIds.has(id)),
        decayed: touchedPremiseIds.some((id) => decayedIds.has(id)),
        proofCritical: Boolean(staticNode?.proofCritical),
        premiseIds,
        sourcePremiseIds,
        proof: proofs.get(key)
          ? {
              rule: proofs.get(key).rule,
              inputFactKeys: proofs.get(key).premises,
            }
          : null,
      };
    })
    .sort((a, b) => a.factKey.localeCompare(b.factKey));

  const projectedRuleHyperedges = [...proofs.entries()]
    .filter(([, proof]) => proof)
    .map(([outputFactKey, proof], index) => ({
      id: `runtime_edge_${String(index + 1).padStart(3, '0')}`,
      ruleId: proof.rule,
      inputFactKeys: proof.premises,
      outputFactKey,
    }))
    .sort((a, b) => a.outputFactKey.localeCompare(b.outputFactKey));

  return {
    schema: `${LOGIC_IR_SCHEMA}.projection`,
    worldId: logic.worldId,
    logicSchema: logic.schema,
    projection: {
      mode: 'runtime_board_closure',
      exposesOnlyProvidedBoardClosure: true,
    },
    factNodes: projectedFactNodes,
    ruleHyperedges: projectedRuleHyperedges,
    counts: {
      grounded: projectedFactNodes.filter((node) => node.grounded).length,
      derived: projectedFactNodes.filter((node) => node.derived).length,
      voiced: projectedFactNodes.filter((node) => node.voiced).length,
      decayed: projectedFactNodes.filter((node) => node.decayed).length,
    },
  };
}

function premiseRole(premise, pathIndexes, scheduleEntry) {
  if (pathIndexes.length && scheduleEntry) return 'scheduled_proof_premise';
  if (pathIndexes.length) return 'unscheduled_alternative_proof_premise';
  if (premise.id.startsWith('m_')) return 'mirror_distractor';
  return 'non_path_premise';
}

export function buildWorldIR(world, { source = null } = {}) {
  const scheduled = scheduleByPremise(world);
  const pathIndexes = proofPathIndexes(world);
  const proofGraph = secretProofGraph(world);
  const proofCriticalIds = new Set(world.proofPaths.flatMap((path) => path.premises || []));
  const logic = buildLogicIR(world, { source });

  const premises = world.premises.map((premise) => {
    const scheduleEntry = scheduled.get(premise.id) || null;
    const indexes = pathIndexes.get(premise.id) || [];
    return {
      id: premise.id,
      fact: premise.fact,
      predicate: predicateOf(premise.fact),
      surface: premise.surface || null,
      role: premiseRole(premise, indexes, scheduleEntry),
      proofCritical: proofCriticalIds.has(premise.id),
      proofPathIndexes: indexes,
      scheduledTurn: scheduleEntry?.turn ?? null,
      scheduledVia: scheduleEntry?.via ?? null,
    };
  });

  return {
    schema: `${GUARD_COMPILER_SCHEMA}.world-ir`,
    world: {
      id: world.id,
      title: world.title,
      source,
      turnCap: world.turnCap,
      question: world.question,
      questionPattern: world.questionPattern,
    },
    entities: collectEntities(world),
    backgroundFacts: world.background || [],
    secret: world.secret,
    mirror: world.mirror || null,
    incompatible: (world.incompatible || []).map((pair) => ({
      facts: pair,
      factKeys: pair.map(factKey),
    })),
    rules: world.rules.map((rule) => ({
      id: rule.id,
      inputPatterns: rule.if,
      outputPatterns: rule.then,
      inputKeys: rule.if.map(rulePatternKey),
      outputKeys: rule.then.map(rulePatternKey),
      arity: rule.if.length,
      joinLike: rule.if.length > 1,
      gloss: rule.gloss || null,
    })),
    premises,
    logic,
    proofGraph: {
      proofPaths: world.proofPaths.map((path, index) => ({
        id: `path_${index + 1}`,
        premises: path.premises || [],
      })),
      secretProof: proofGraph,
      joins: world.rules
        .filter((rule) => rule.if.length > 1)
        .map((rule) => ({
          ruleId: rule.id,
          inputs: rule.if,
          outputs: rule.then,
          inputPredicates: rule.if.map(predicateOf),
          outputPredicates: rule.then.map(predicateOf),
          outputsSecretPredicate: rule.then.some((pattern) => predicateOf(pattern) === predicateOf(world.secret.fact)),
        })),
    },
    releaseCalendar: world.releaseSchedule.map((entry) => ({ ...entry })),
    slope: {
      tMin: world.slope.t_min,
      aporiaWindow: world.slope.aporia_window,
    },
  };
}

function rulesForClosure(worldIR) {
  return worldIR.rules.map((rule) => ({
    id: rule.id,
    if: rule.inputPatterns,
    then: rule.outputPatterns,
  }));
}

function questionConstants(worldIR) {
  return factAtoms(worldIR.world.questionPattern || []);
}

function mirrorFocusAtoms(worldIR) {
  const questionAtoms = new Set(questionConstants(worldIR));
  return factAtoms(worldIR.mirror?.fact || []).filter((atom) => !questionAtoms.has(atom));
}

function incompatibleWithMirror(worldIR, fact) {
  const mirrorKey = worldIR.mirror?.fact ? factKey(worldIR.mirror.fact) : null;
  const candidateKey = factKey(fact);
  if (!mirrorKey) return false;
  return (worldIR.incompatible || []).some((pair) => pair.factKeys.includes(mirrorKey) && pair.factKeys.includes(candidateKey));
}

function mirrorDeadPredicateDecoy(worldIR) {
  if (!worldIR.mirror?.fact) return { present: false, candidates: [] };
  const mirrorFacts = worldIR.premises
    .filter((premise) => premise.role === 'mirror_distractor')
    .map((premise) => premise.fact);
  if (!mirrorFacts.length) return { present: false, candidates: [] };

  const baseFacts = [...(worldIR.backgroundFacts || []), ...mirrorFacts];
  const baseKeys = new Set(baseFacts.map(factKey));
  const cl = closure(baseFacts, rulesForClosure(worldIR));
  const focusAtoms = new Set(mirrorFocusAtoms(worldIR));
  const sharedQuestionAtoms = new Set(questionConstants(worldIR));
  const secretPredicate = predicateOf(worldIR.secret?.fact);
  const mirrorPredicate = predicateOf(worldIR.mirror.fact);
  const candidates = [];

  for (const [key, fact] of cl.facts) {
    if (baseKeys.has(key)) continue;
    const predicate = predicateOf(fact);
    if (!predicate || predicate === secretPredicate || predicate === mirrorPredicate) continue;
    if (incompatibleWithMirror(worldIR, fact)) continue;

    const atoms = factAtoms(fact);
    const hasMirrorFocus = atoms.some((atom) => focusAtoms.has(atom));
    const hasQuestionAnchor = atoms.some((atom) => sharedQuestionAtoms.has(atom));
    if (!hasMirrorFocus || !hasQuestionAnchor) continue;

    const proof = cl.proofs.get(key);
    candidates.push({
      fact,
      factKey: key,
      predicate,
      proofRule: proof?.rule || null,
    });
  }

  candidates.sort((a, b) => a.factKey.localeCompare(b.factKey));
  return {
    present: candidates.length > 0,
    candidates,
  };
}

function releaseRange(world, entry, releaseLatitude) {
  const min = Math.max(1, entry.turn - releaseLatitude);
  const max = Math.min(world.turnCap, entry.turn + releaseLatitude);
  const out = [];
  for (let turn = min; turn <= max; turn += 1) out.push(turn);
  return out;
}

function prefixLedger(world, entry) {
  const rows = [];
  for (const row of world.releaseSchedule) {
    if (row.premise === entry.premise) break;
    rows.push({ turn: row.turn, premiseId: row.premise });
  }
  return rows;
}

function hiddenReleaseCorridors(world, releaseLatitude) {
  return world.releaseSchedule
    .filter((entry) => entry.via === 'tutor')
    .map((entry) => {
      const prefix = prefixLedger(world, entry);
      const placements = releaseRange(world, entry, releaseLatitude).map((turn) =>
        releaseSolvency(world, prefix, { premise: entry.premise, turn }),
      );
      return {
        premise: entry.premise,
        scheduledTurn: entry.turn,
        licensedTurns: placements.map((row) => row.turn),
        safeTurns: placements.filter((row) => row.safe).map((row) => row.turn),
        unsafeTurns: placements.filter((row) => !row.safe).map((row) => ({
          turn: row.turn,
          verdict: row.verdict,
          endTurn: row.endTurn,
        })),
        referenceLedger: prefix,
      };
    });
}

function visibleProjectionStatus(worldIR) {
  if (worldIR.proofGraph.secretProof.independentTopLevelJoin) {
    return {
      status: 'uncertified_topology_risk',
      reason: 'secret proof has disjoint top-level branches; local visible uptake can falsely imply global readiness',
    };
  }
  return {
    status: 'candidate_requires_replay',
    reason: 'no disjoint top-level secret join detected; replay agreement with hidden reference is still required',
  };
}

export function selectGuardRepresentation(worldIR) {
  const secretProof = worldIR?.proofGraph?.secretProof;
  if (!secretProof || typeof secretProof.independentTopLevelJoin !== 'boolean') {
    throw new Error('derivation.guardCompiler: selector requires WorldIR secretProof.independentTopLevelJoin');
  }
  const independentTopLevelJoin = secretProof.independentTopLevelJoin;
  return {
    schema: REPRESENTATION_SELECTOR_SCHEMA,
    input: {
      independentTopLevelJoin,
    },
    geometryFamily: independentTopLevelJoin ? 'forked_depth' : 'linear_coupled_or_distractor',
    selected: independentTopLevelJoin ? 'hidden' : 'visible',
    selectedFlag: independentTopLevelJoin ? '--pacing-guard' : '--pacing-guard-visible',
    rejected: independentTopLevelJoin ? 'visible' : 'hidden',
    reason: independentTopLevelJoin
      ? 'secret proof has disjoint top-level branches; local visible uptake can falsely project global readiness'
      : 'secret proof has no disjoint top-level branch split; use page/tempo guard unless a held-out failure proves selector regret',
  };
}

export function selectGuardRepresentationV1(worldIR, { decayEnabled = false } = {}) {
  const secretProof = worldIR?.proofGraph?.secretProof;
  if (!secretProof || typeof secretProof.independentTopLevelJoin !== 'boolean') {
    throw new Error('derivation.guardCompiler: selector v1 requires WorldIR secretProof.independentTopLevelJoin');
  }

  const independentTopLevelJoin = secretProof.independentTopLevelJoin;
  const deadPredicateDecoy = mirrorDeadPredicateDecoy(worldIR);
  let selected = 'visible';
  let reason = 'non-fork proof without active decay uses the page/tempo guard';
  let gate = 'no_decay_default_visible';

  if (independentTopLevelJoin) {
    selected = 'hidden';
    gate = 'independent_join_hidden';
    reason = 'secret proof has disjoint top-level branches; local visible uptake can falsely project global readiness';
  } else if (deadPredicateDecoy.present) {
    selected = 'visible';
    gate = 'mirror_dead_predicate_visible';
    reason = 'mirror premises derive a complete dead-predicate finding, so page-visible drift is the binding hazard';
  } else if (decayEnabled) {
    selected = 'hidden';
    gate = 'decay_fail_closed_hidden';
    reason = 'under decay, no independent-join absence is insufficient evidence for V; fail closed to proof continuity';
  }

  return {
    schema: REPRESENTATION_SELECTOR_V1_SCHEMA,
    input: {
      independentTopLevelJoin,
      decayEnabled: Boolean(decayEnabled),
      mirrorDeadPredicateDecoy: deadPredicateDecoy,
    },
    gate,
    selected,
    selectedFlag: selected === 'hidden' ? '--pacing-guard' : '--pacing-guard-visible',
    rejected: selected === 'hidden' ? 'visible' : 'hidden',
    reason,
  };
}

function sharedSecretSourcePremiseIds(secretProof) {
  return uniqueSorted((secretProof?.branchOverlap || []).flatMap((row) => row.sharedPremiseIds || []));
}

function secretSourcePremiseIds(secretProof) {
  return uniqueSorted((secretProof?.topBranches || []).flatMap((row) => row.basePremiseIds || []));
}

function consolidatedProofPressure(worldIR) {
  const secretProof = worldIR?.proofGraph?.secretProof;
  const sourceIds = secretSourcePremiseIds(secretProof);
  const sourceIdSet = new Set(sourceIds);
  const sharedIds = sharedSecretSourcePremiseIds(secretProof);
  const sharedIdSet = new Set(sharedIds);
  const sourcePremises = worldIR.premises.filter((premise) => sourceIdSet.has(premise.id));
  const sharedPremises = sourcePremises.filter((premise) => sharedIdSet.has(premise.id));
  const criticalSourcePremises = sourcePremises.filter((premise) => premise.proofCritical);
  const tutorCriticalSourcePremises = criticalSourcePremises.filter((premise) => premise.scheduledVia === 'tutor');
  const directorCriticalSourcePremises = criticalSourcePremises.filter((premise) => premise.scheduledVia === 'director');
  const sharedCriticalSourcePremises = sharedPremises.filter((premise) => premise.proofCritical);
  return {
    secretSourcePremiseIds: sourceIds,
    proofCriticalSourcePremiseIds: criticalSourcePremises.map((premise) => premise.id).sort(),
    tutorCriticalSourcePremiseIds: tutorCriticalSourcePremises.map((premise) => premise.id).sort(),
    directorCriticalSourcePremiseIds: directorCriticalSourcePremises.map((premise) => premise.id).sort(),
    sharedSourcePremiseIds: sharedIds,
    sharedCriticalSourcePremiseIds: sharedCriticalSourcePremises.map((premise) => premise.id).sort(),
    sourcePremiseCount: sourcePremises.length,
    proofCriticalSourcePremiseCount: criticalSourcePremises.length,
    tutorCriticalSourcePremiseCount: tutorCriticalSourcePremises.length,
    directorCriticalSourcePremiseCount: directorCriticalSourcePremises.length,
    sharedCriticalSourcePremiseCount: sharedCriticalSourcePremises.length,
  };
}

export function selectGuardRepresentationV2(worldIR, { decayEnabled = false } = {}) {
  const secretProof = worldIR?.proofGraph?.secretProof;
  if (!secretProof || typeof secretProof.independentTopLevelJoin !== 'boolean') {
    throw new Error('derivation.guardCompiler: selector v2 requires WorldIR secretProof.independentTopLevelJoin');
  }

  const independentTopLevelJoin = secretProof.independentTopLevelJoin;
  const deadPredicateDecoy = mirrorDeadPredicateDecoy(worldIR);
  const pressure = consolidatedProofPressure(worldIR);
  let selected = 'visible';
  let gate = 'no_decay_default_visible';
  let reason = 'non-fork proof without active decay uses the page/tempo guard';

  if (independentTopLevelJoin) {
    selected = 'hidden';
    gate = 'independent_join_hidden';
    reason = 'secret proof has disjoint top-level branches; local visible uptake can falsely project global readiness';
  } else if (decayEnabled && pressure.sharedCriticalSourcePremiseCount > 0) {
    selected = 'hidden';
    gate = 'decay_shared_source_hidden';
    reason =
      'under decay, shared proof-critical source premises can reopen multiple branches of the consolidated board, so proof continuity dominates visible drift';
  } else if (deadPredicateDecoy.present) {
    selected = 'visible';
    gate = 'mirror_dead_predicate_visible';
    reason = 'mirror premises derive a complete dead-predicate finding and no shared decaying source pressure overrides it';
  } else if (decayEnabled && pressure.proofCriticalSourcePremiseCount >= 4) {
    selected = 'hidden';
    gate = 'decay_multi_source_hidden';
    reason =
      'under decay, a wide proof-critical source set makes local visible uptake a weak proxy for board closure';
  }

  return {
    schema: REPRESENTATION_SELECTOR_V2_SCHEMA,
    input: {
      independentTopLevelJoin,
      decayEnabled: Boolean(decayEnabled),
      mirrorDeadPredicateDecoy: deadPredicateDecoy,
      consolidatedProofPressure: pressure,
    },
    gate,
    selected,
    selectedFlag: selected === 'hidden' ? '--pacing-guard' : '--pacing-guard-visible',
    rejected: selected === 'hidden' ? 'visible' : 'hidden',
    reason,
  };
}

export function selectGuardRepresentationV3(worldIR, { decayEnabled = false } = {}) {
  const secretProof = worldIR?.proofGraph?.secretProof;
  if (!secretProof || typeof secretProof.independentTopLevelJoin !== 'boolean') {
    throw new Error('derivation.guardCompiler: selector v3 requires WorldIR secretProof.independentTopLevelJoin');
  }

  const independentTopLevelJoin = secretProof.independentTopLevelJoin;
  const deadPredicateDecoy = mirrorDeadPredicateDecoy(worldIR);
  const pressure = consolidatedProofPressure(worldIR);

  return {
    schema: REPRESENTATION_SELECTOR_V3_SCHEMA,
    input: {
      independentTopLevelJoin,
      decayEnabled: Boolean(decayEnabled),
      mirrorDeadPredicateDecoy: deadPredicateDecoy,
      consolidatedProofPressure: pressure,
    },
    gate: 'hidden_default_visible_stall_probe',
    selected: 'hidden',
    selectedFlag: '--pacing-guard-selective-v3',
    baseFlag: '--pacing-guard',
    rejected: 'visible_default',
    runtimeVisibleProbe: {
      enabled: true,
      mode: 'shadow_release_boundary_probe',
      acceptOnly: {
        forcedSafe: true,
        forcedBy: 'visible_stall',
        requireHiddenSafeAtCurrentTurn: true,
      },
      reject: ['visible_block', 'prior_echo_absent', 'echo_only', 'non_stall_pass_through'],
    },
    reason:
      'default to hidden proof-continuity under decay/shared-source pressure; allow visible only as a hidden-safe stall-push at release boundaries',
  };
}

export function compileGuardSpec(world, worldIR = buildWorldIR(world), { releaseLatitude = DEFAULT_RELEASE_LATITUDE } = {}) {
  const visibleStatus = visibleProjectionStatus(worldIR);
  return {
    schema: `${GUARD_COMPILER_SCHEMA}.guard-spec`,
    compiler: {
      version: 'p1a-replay-slice',
      mode: 'static_replay_first',
      onlineLlmGuardAuthoring: false,
    },
    world: {
      id: world.id,
      title: world.title,
    },
    guards: {
      hidden_pacing: {
        objective: 'avoid_tempo_starvation',
        inputs: ['proof_distance', 'release_ledger', 'release_calendar', 'aporia_window'],
        forbiddenTutorView: ['proof_distance', 'proof_path', 'secret', 'D_arithmetic'],
        releaseLatitude,
        actions: ['hold_release', 'license_release'],
        releaseCorridors: hiddenReleaseCorridors(world, releaseLatitude),
      },
      proof_debt: {
        objective: 'repair_released_critical_premises_that_decay',
        trigger: {
          released: true,
          proofCritical: true,
          absentOrCorrupted: true,
          restoreLowersD: true,
        },
        exposeToTutor: ['premiseId', 'surface', 'sinceTurn'],
        forbid: ['raw_board', 'corruption_ledger', 'proof_path', 'secret', 'D_arithmetic'],
        actions: ['restore_before_new_work'],
      },
      visible_projection: {
        candidate: true,
        status: visibleStatus.status,
        statusReason: visibleStatus.reason,
        inputs: ['release_ledger', 'transcript_surface', 'prior_exhibit_surface'],
        forbiddenInputs: ['proof_distance', 'proof_path', 'secret', 'raw_board', 'corruption_ledger'],
        features: [
          'turns_since_release',
          'learner_echo_of_current_exhibit',
          'hedging_or_gap_markers',
          'content_length_trend',
          'branch_coverage_surface_markers',
        ],
        thresholds: VISIBLE_GUARD_DEFAULTS,
        validation: {
          compareToHiddenReference: true,
          failClosedToHidden: true,
          catastrophicFalseReleaseAllowed: false,
        },
      },
    },
    auditSuite: {
      nonLeak: [
        'no proof-distance arithmetic in tutor-visible text',
        'secret predicate never supplied to tutor',
        'raw learner board never supplied to tutor',
        'proof path never supplied to tutor',
        'corruption ledger never supplied to tutor',
        'proof-debt tutor view limited to premiseId/surface/sinceTurn',
        'positive control proves hidden harness ledger carries arithmetic absent from tutor view',
      ],
      replay: [
        'detector-split report over archived arms',
        'hidden-vs-visible agreement report where visible projection is proposed',
        'played-release solvency audit by guard state',
      ],
    },
  };
}

export function summarizeGuardSpec(spec) {
  const hidden = spec.guards.hidden_pacing.releaseCorridors;
  const unsafe = hidden.flatMap((row) => row.unsafeTurns.map((turn) => `${row.premise}@t${turn.turn}`));
  return {
    worldId: spec.world.id,
    hiddenPacingPremises: hidden.length,
    hiddenPacingUnsafeReferenceTurns: unsafe,
    visibleProjectionStatus: spec.guards.visible_projection.status,
    proofDebtTutorView: spec.guards.proof_debt.exposeToTutor,
  };
}
