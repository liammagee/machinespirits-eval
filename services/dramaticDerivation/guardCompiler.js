import { closure, factKey, proofTree } from './chainer.js';
import { releaseSolvency } from './pacing.js';
import { VISIBLE_GUARD_DEFAULTS } from './visiblePacing.js';

export const GUARD_COMPILER_SCHEMA = 'dramatic-derivation.guard-compiler.v0';
export const DEFAULT_RELEASE_LATITUDE = 2;

export const REPRESENTATION_SELECTOR_SCHEMA = 'dramatic-derivation.representation-selector.v0';
export const REPRESENTATION_SELECTOR_V1_SCHEMA = 'dramatic-derivation.representation-selector.v1';

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
