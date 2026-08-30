import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { buildLearnerDag, buildLearnerDagSnapshot } from './dramaticDerivation/learnerDag.js';
import { loadWorld } from './dramaticDerivation/world.js';

export const TUTOR_STUB_RIVAL_LEARNER_DAG_SCHEMA = 'machinespirits.tutor-stub.rival-learner-dag.v1';
const WORLD_CATALOG_CACHE = new Map();

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function worldCatalog(root) {
  if (WORLD_CATALOG_CACHE.has(root)) return WORLD_CATALOG_CACHE.get(root);
  const directory = path.join(root, 'config', 'drama-derivation');
  const catalog = new Map(
    fs
      .readdirSync(directory)
      .filter((name) => /^world-.*\.yaml$/u.test(name))
      .map((name) => path.join(directory, name))
      .map((filePath) => {
        const world = loadWorld(filePath);
        return [world.id, { filePath, world }];
      }),
  );
  WORLD_CATALOG_CACHE.set(root, catalog);
  return catalog;
}

function catalogWorld(root, worldId) {
  const match = worldCatalog(root).get(worldId);
  if (!match) throw new Error(`rival learner DAG world ${worldId} is absent from the catalog`);
  return match;
}

function ranked(values, seed) {
  return [...values]
    .map((value) => ({ value, rank: sha256(`${seed}:${value}`) }))
    .sort((left, right) => left.rank.localeCompare(right.rank));
}

function pathId(pathSpec, index) {
  return pathSpec.id || pathSpec.name || pathSpec.label || `path_${index + 1}`;
}

function derivePath(world, seed) {
  const choices = ranked(
    world.proofPaths.map((_pathSpec, index) => String(index)),
    `${seed}:proof-path`,
  );
  const chosenIndex = Number(choices[0]?.value);
  const chosen = Number.isInteger(chosenIndex) ? { pathSpec: world.proofPaths[chosenIndex], index: chosenIndex } : null;
  if (!chosen) throw new Error(`world ${world.id} has no authored proof path`);
  const premiseFacts = chosen.pathSpec.premises.map((premiseId) => world.premiseById.get(premiseId)?.fact);
  if (premiseFacts.some((fact) => !fact)) throw new Error(`world ${world.id} proof path has an unknown premise`);
  const initialSnapshot = buildLearnerDagSnapshot(world, {
    turn: 0,
    boardFacts: world.background,
    validFacts: world.background,
    source: 'rival_dag_mint_initial_state',
  });
  const initialDag = buildLearnerDag([initialSnapshot], world);
  const closureSnapshot = buildLearnerDagSnapshot(world, {
    turn: 0,
    boardFacts: [...world.background, ...premiseFacts],
    validFacts: [...world.background, ...premiseFacts],
    voiced: [{ fact: world.secret.fact, turn: 0 }],
    source: 'rival_dag_mint_authored_path_closure',
  });
  const ruleIds = [
    ...new Set(
      closureSnapshot.nodes
        .filter((node) => node.kind === 'rule_application')
        .map((node) => node.rule)
        .filter(Boolean),
    ),
  ];
  return {
    id: pathId(chosen.pathSpec, chosen.index),
    premiseIds: [...chosen.pathSpec.premises],
    ruleIds,
    initialAssessment: initialDag.assessment,
  };
}

function b1RivalWorldId({ design, tutorWorldId, jobId }) {
  const pool = design?.rivalDagPersona?.mint?.worldPool;
  if (!Array.isArray(pool) || pool.length < 2 || !pool.includes(tutorWorldId)) {
    throw new Error('B1 rival DAG world pool must contain the tutor world and at least one alternative');
  }
  return ranked(
    pool.filter((worldId) => worldId !== tutorWorldId),
    `${design.randomization.masterSeed}:${jobId}:rival-world`,
  )[0].value;
}

function premiseOpenNodes(world, derivedPath) {
  return derivedPath.premiseIds.map((premiseId, index) => {
    const premise = world.premiseById.get(premiseId);
    return {
      id: `open_${index + 1}_${premiseId}`,
      sourcePremiseId: premiseId,
      task: String(premise.surface || '').trim(),
      status: 'open',
    };
  });
}

function warrantOpenNodes(world, derivedPath) {
  const byId = new Map(world.rules.map((rule) => [rule.id, rule]));
  return derivedPath.ruleIds.map((ruleId, index) => {
    const rule = byId.get(ruleId);
    return {
      id: `open_${index + 1}_${ruleId}`,
      sourceRuleId: ruleId,
      task: String(rule?.gloss || ruleId).trim(),
      status: 'open',
    };
  });
}

/**
 * R2 exhibit mint (frame-refuser with a satisfiable condition,
 * config/tutor-stub-frame-refuser-satisfiable-design.v1.json). The open nodes
 * are the authored proof path's PREMISES in release order — exhibits the world
 * can show and the tutor can enter into the record — where the R1 mint uses
 * rule glosses, whose satisfaction is a derived consequent no premise
 * witnesses. That difference is the whole point of the R2 study: the demand
 * becomes dischargeable. B1 and R1 minting is untouched.
 */
function exhibitOpenNodes(world, derivedPath) {
  const releaseTurnByPremise = new Map(world.releaseSchedule.map((entry) => [entry.premise, entry.turn]));
  const ordered = [...derivedPath.premiseIds].sort(
    (left, right) => releaseTurnByPremise.get(left) - releaseTurnByPremise.get(right),
  );
  return ordered.map((premiseId, index) => {
    const releaseTurn = releaseTurnByPremise.get(premiseId);
    if (!Number.isInteger(releaseTurn)) {
      // A premise with no scheduled release can never be discharged by the
      // record, which is the predecessor's defect all over again. Refuse.
      throw new Error(`exhibit mint: authored-path premise ${premiseId} has no release turn in ${world.id}`);
    }
    const premise = world.premiseById.get(premiseId);
    return {
      id: `open_${index + 1}_${premiseId}`,
      openNodeKind: 'exhibit',
      sourcePremiseId: premiseId,
      releaseTurn,
      task: String(premise.surface || '').trim(),
      status: 'open',
    };
  });
}

export const TUTOR_STUB_DEMANDED_EXHIBIT_RULE = 'earliest_unreleased_authored_path_premise_within_horizon';

/**
 * The registered demand selection rule for R2: the learner's standing demand
 * names the earliest authored-path premise that is (a) not yet public at the
 * trigger turn and (b) scheduled for release within the outcome horizon.
 * Fails closed: a world with no qualifying premise is refused at plan build,
 * so a run never starts with an undischargeable demand.
 */
export function selectTutorStubDemandedExhibit({ dag, triggerTurn, outcomeHorizonPostTriggerLearnerTurns } = {}) {
  if (dag?.study !== 'R2') throw new Error('demanded-exhibit selection requires an R2 exhibit-minted rival DAG');
  if (!Number.isInteger(triggerTurn) || triggerTurn < 1) {
    throw new Error('demanded-exhibit selection needs an integer trigger turn >= 1');
  }
  const horizon = outcomeHorizonPostTriggerLearnerTurns;
  if (!Number.isInteger(horizon) || horizon < 1) {
    throw new Error('demanded-exhibit selection needs an integer outcome horizon >= 1');
  }
  const horizonTurn = triggerTurn + horizon;
  const demanded =
    dag.openNodes
      .filter(
        (node) => node.openNodeKind === 'exhibit' && node.releaseTurn > triggerTurn && node.releaseTurn <= horizonTurn,
      )
      .sort((left, right) => left.releaseTurn - right.releaseTurn)[0] || null;
  if (!demanded) {
    throw new Error(
      `no authored-path premise in ${dag.rivalWorldId} is both unreleased at turn ${triggerTurn} and ` +
        `scheduled by turn ${horizonTurn}; refuse this world (rule ${TUTOR_STUB_DEMANDED_EXHIBIT_RULE})`,
    );
  }
  return {
    schema: 'machinespirits.tutor-stub.demanded-exhibit.v1',
    rule: TUTOR_STUB_DEMANDED_EXHIBIT_RULE,
    triggerTurn,
    horizonTurn,
    demandedNodeId: demanded.id,
    demandedPremiseId: demanded.sourcePremiseId,
    releaseTurn: demanded.releaseTurn,
    task: demanded.task,
  };
}

function authoredBridges({ tutorWorld, tutorPath, openNodes }) {
  const ruleById = new Map(tutorWorld.rules.map((rule) => [rule.id, rule]));
  const rules = tutorPath.ruleIds.map((ruleId) => ruleById.get(ruleId)).filter(Boolean);
  if (!rules.length) throw new Error(`tutor world ${tutorWorld.id} has no authored rule path for a bridge`);
  return openNodes.map((node, index) => {
    const rule = rules[index % rules.length];
    return {
      id: `bridge_${index + 1}_${node.id}_${rule.id}`,
      rivalNodeId: node.id,
      tutorRuleId: rule.id,
      publicCriterion: `Connect the solicited rival item to this tutor-world warrant without asserting unstaged evidence: ${rule.gloss}`,
    };
  });
}

/**
 * Mint a private rival learner DAG from a validated authored world and the
 * existing learner-DAG closure/assessment pipeline. The returned object is a
 * learner-only behavior input. It must never be added to tutor or reader
 * packets.
 */
export function mintTutorStubRivalLearnerDag({ design, job, root = process.cwd() } = {}) {
  const study = job?.study;
  if (!['B1', 'R1', 'R2'].includes(study)) throw new Error('rival learner DAG requires a B1, R1, or R2 job');
  if (study === 'R2' && design?.rivalDagPersona?.mint?.openNodeKind !== 'exhibit') {
    // Fail closed both ways: an R2 job on a design that does not register the
    // exhibit mint would silently reproduce the predecessor's warrant demands.
    throw new Error('an R2 job needs a design whose rivalDagPersona.mint.openNodeKind is "exhibit"');
  }
  const tutorWorldId = job.world;
  const rivalWorldId = study === 'B1' ? b1RivalWorldId({ design, tutorWorldId, jobId: job.id }) : tutorWorldId;
  const { filePath: rivalWorldPath, world: rivalWorld } = catalogWorld(root, rivalWorldId);
  const derivedPath = derivePath(rivalWorld, `${design.randomization.masterSeed}:${job.id}`);
  const openNodes =
    study === 'B1'
      ? premiseOpenNodes(rivalWorld, derivedPath)
      : study === 'R2'
        ? exhibitOpenNodes(rivalWorld, derivedPath)
        : warrantOpenNodes(rivalWorld, derivedPath);
  if (!openNodes.length || openNodes.some((node) => !node.task)) {
    throw new Error(`rival learner DAG for ${job.id} has no usable open nodes`);
  }
  const concession = design?.rivalDagPersona?.concessionCondition;
  if (concession?.kind !== 'public_tutor_move_bears_on_open_rival_node') {
    throw new Error('rival learner DAG concession condition is not registered');
  }
  const tutorWorld = study === 'B1' ? catalogWorld(root, tutorWorldId).world : rivalWorld;
  const tutorPath =
    study === 'B1' ? derivePath(tutorWorld, `${design.randomization.masterSeed}:${job.id}:tutor`) : null;
  const bridges = study === 'B1' ? authoredBridges({ tutorWorld, tutorPath, openNodes }) : [];
  const result = {
    schema: TUTOR_STUB_RIVAL_LEARNER_DAG_SCHEMA,
    study,
    jobId: job.id,
    tutorWorldId,
    rivalWorldId,
    relation:
      study === 'B1' ? 'content_rivalry' : study === 'R2' ? 'standing_rivalry_over_exhibits' : 'standing_rivalry',
    objective:
      study === 'B1'
        ? rivalWorld.question
        : study === 'R2'
          ? `Determine which public exhibit in ${rivalWorld.title} must be entered in the record before the tutor's answer frame has standing.`
          : `Determine which public warrant in ${rivalWorld.title} must be satisfied before the tutor's answer frame has standing.`,
    authoredPathId: derivedPath.id,
    authoredRuleIds: derivedPath.ruleIds,
    openNodes,
    authoredBridges: bridges,
    concessionCondition: structuredClone(concession),
    concealment: {
      tutorVisible: false,
      readerVisible: false,
      publicLearnerSpeechOnly: true,
    },
    provenance: {
      worldCatalogPath: path.relative(root, rivalWorldPath),
      mintPipeline: [
        'dramaticDerivation.world.loadWorld',
        'dramaticDerivation.learnerDag.buildLearnerDagSnapshot',
        'dramaticDerivation.learnerDag.buildLearnerDag',
      ],
      initialBestPathId: derivedPath.initialAssessment.bestPathId,
      initialMissingPremiseIds: derivedPath.initialAssessment.missingOnBestPath,
    },
  };
  return { ...result, sha256: sha256(JSON.stringify(canonical(result))) };
}

function lines(title, values) {
  return [title, ...values.map((value) => `- ${value}`), ''];
}

const TOKEN_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'could',
  'every',
  'first',
  'from',
  'have',
  'into',
  'must',
  'only',
  'public',
  'should',
  'still',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'what',
  'when',
  'which',
  'with',
  'would',
]);

function contentTokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z0-9]+/gu)
      ?.filter((token) => token.length >= 4 && !TOKEN_STOPWORDS.has(token)) || [],
  );
}

function overlap(left, right) {
  const rightSet = contentTokens(right);
  return [...contentTokens(left)].filter((token) => rightSet.has(token));
}

function historyText(history, role) {
  return (history || [])
    .filter((message) => message?.role === role)
    .map((message) => String(message.content || ''))
    .filter(Boolean);
}

export function evaluateTutorStubRivalDagConcession({ dag, history = [] } = {}) {
  const algorithm = dag?.concessionCondition?.matchingAlgorithm;
  if (algorithm?.id !== 'normalized_public_token_overlap_v1') {
    throw new Error('rival DAG concession evaluator requires normalized_public_token_overlap_v1');
  }
  const learnerTurns = historyText(history, 'user');
  const tutorTurns = historyText(history, 'assistant');
  const latestTutor = tutorTurns.at(-1) || '';
  const minimum = Number(algorithm.minimumSharedContentTokens);
  const markers = algorithm.tutorOperationMarkers || [];
  const normalizedTutor = latestTutor.toLowerCase();
  const hasOperationMarker = markers.some((marker) => normalizedTutor.includes(String(marker).toLowerCase()));
  const nodes = dag.openNodes.map((node) => {
    const learnerMatches = learnerTurns.map((text) => overlap(node.task, text));
    const tutorMatches = overlap(node.task, latestTutor);
    const solicited = learnerMatches.some((matches) => matches.length >= minimum);
    const worked = solicited;
    const bears =
      (!algorithm.requiresPriorLearnerSolicitation || solicited) &&
      (!algorithm.requiresTutorOperationMarker || hasOperationMarker) &&
      tutorMatches.length >= minimum;
    return {
      id: node.id,
      worked,
      solicited,
      tutorSharedTokens: tutorMatches,
      bears,
    };
  });
  const qualifying = nodes.find((node) => node.bears) || null;
  const nextOpen = nodes.find((node) => !node.worked) || nodes[0] || null;
  return {
    schema: 'machinespirits.tutor-stub.rival-learner-dag-concession.v1',
    algorithm: algorithm.id,
    eligible: Boolean(qualifying),
    qualifyingNodeId: qualifying?.id || null,
    nextOpenNodeId: nextOpen?.id || null,
    hasTutorOperationMarker: hasOperationMarker,
    nodes,
  };
}

export function buildTutorStubRivalLearnerDagTurnRecord({ dag, history = [], learnerText = '', turn = null } = {}) {
  const concession = evaluateTutorStubRivalDagConcession({ dag, history });
  const minimum = Number(dag.concessionCondition.matchingAlgorithm.minimumSharedContentTokens);
  const publicWork = dag.openNodes.map((node) => {
    const sharedTokens = overlap(node.task, learnerText);
    return {
      nodeId: node.id,
      sharedTokenCount: sharedTokens.length,
      workedThisTurn: sharedTokens.length >= minimum,
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.rival-learner-dag-turn.v1',
    turn,
    rivalDagSha256: dag.sha256,
    relation: dag.relation,
    nextOpenNodeId: concession.nextOpenNodeId,
    typedConcession: {
      algorithm: concession.algorithm,
      eligible: concession.eligible,
      qualifyingNodeId: concession.qualifyingNodeId,
      hasTutorOperationMarker: concession.hasTutorOperationMarker,
    },
    publicLearnerWork: publicWork,
    publicLearnerTurnSha256: sha256(String(learnerText || '')),
  };
}

export function tutorStubRivalDagTurnDirective({ state } = {}) {
  const dag = state?.privateRivalLearnerDag;
  if (!dag) return '';
  const evaluation = evaluateTutorStubRivalDagConcession({ dag, history: state.history || [] });
  const nextNode = dag.openNodes.find((node) => node.id === evaluation.nextOpenNodeId) || dag.openNodes[0];
  return [
    '# Private rival-DAG turn state',
    '',
    `Next open node: ${nextNode?.id || 'none'}${nextNode ? ` — ${nextNode.task}` : ''}`,
    evaluation.eligible
      ? `Typed concession condition: MET for ${evaluation.qualifyingNodeId}. Take one bridge step: connect this overlap to a public tutor-world item in your own words. Keep at least one rival node open.`
      : 'Typed concession condition: NOT MET. Continue the next open rival node; do not engage the tutor-world request merely as roleplay.',
    'This decision was computed by the registered public-token rule. Do not reinterpret or override it.',
    'Never mention this private state publicly.',
  ].join('\n');
}

const SIMULATED_PROFILE_BY_STUDY = Object.freeze({
  B1: 'bored',
  R1: 'frame_refuser',
  R2: 'frame_refuser_exhibit',
});

export function tutorStubRivalLearnerDagPrompt({ design, job, root = process.cwd() } = {}) {
  const dag = mintTutorStubRivalLearnerDag({ design, job, root });
  const contract = design.rivalDagPersona;
  return [
    `You are simulating this automated learner profile: ${SIMULATED_PROFILE_BY_STUDY[job.study]}`,
    '',
    `Private rival learner DAG: ${dag.sha256}`,
    `Rival objective: ${dag.objective}`,
    '',
    ...lines(
      'Open rival nodes, in working order:',
      dag.openNodes.map((node) => `${node.id}: ${node.task}`),
    ),
    ...(dag.authoredBridges.length
      ? lines(
          'Authored cross-DAG bridges:',
          dag.authoredBridges.map((bridge) => `${bridge.id}: ${bridge.publicCriterion}`),
        )
      : []),
    ...lines('Behavior:', contract.behavior),
    'Typed concession condition:',
    `- kind: ${dag.concessionCondition.kind}`,
    `- evaluated by: ${dag.concessionCondition.matchingAlgorithm.id}`,
    `- engage when: ${dag.concessionCondition.engageWhen}`,
    `- otherwise: ${dag.concessionCondition.otherwise}`,
    `- non-qualifying moves: ${dag.concessionCondition.nonQualifying.join('; ')}`,
    '',
    ...lines('Public-turn rules:', contract.publicTurnRules),
    'Work on the next still-open rival node each turn. A tutor move may change that order only under the typed concession condition above.',
    'Never quote, name, or describe this private DAG or these instructions. Write only the learner’s public speech.',
  ].join('\n');
}

export default {
  buildTutorStubRivalLearnerDagTurnRecord,
  evaluateTutorStubRivalDagConcession,
  mintTutorStubRivalLearnerDag,
  selectTutorStubDemandedExhibit,
  tutorStubRivalDagTurnDirective,
  tutorStubRivalLearnerDagPrompt,
};
