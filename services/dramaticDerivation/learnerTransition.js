import { closure, entails, factKey } from './chainer.js';
import { summarizeFieldPlannerOutcome } from './fieldPlanner.js';
import { buildLearnerDagSnapshot } from './learnerDag.js';
import { deriveLearnerTransformationState } from './learnerTransformation.js';
import { nextOpportunityCostBudget } from './opportunityCost.js';
import { classifyLearnerExchange, detectPhaticRecognition } from './rhetoricalMovePolicy.js';
import { derivationDistance } from './slope.js';
import { blockTypeForExchange, ledgerRow, openBlock, updateBlockLedger } from './strategyLedger.js';

function recordMirrorRefusal(runState, learnerOut, turn) {
  if (!learnerOut.mirrorRefusal || runState.mirrorRefusalState.fired) return;
  runState.mirrorRefusalState.fired = true;
  runState.mirrorRefusalState.record = { ...learnerOut.mirrorRefusal };
  runState.events.push({ turn, type: 'mirror_refusal', detail: learnerOut.mirrorRefusal.outcome });
}

function applyRetractions(runState, learnerOut, turn, premiseIdForKey, renderFact) {
  for (const fact of learnerOut.retract || []) {
    const key = factKey(fact);
    const entry = runState.grounded.get(key);
    if (runState.corruption && entry?.mutatedFalse) {
      const premiseId = premiseIdForKey(entry.mutationOf);
      runState.corruption.ledger.push({ turn, type: 'retract_false', premiseId, falseForm: entry.fact });
      runState.events.push({
        turn,
        type: 'retract_false',
        detail: `${premiseId || renderFact(entry.fact)} misremembering "${renderFact(entry.fact)}" retracted`,
      });
    }
    runState.grounded.delete(key);
  }
}

function applyAdoptions(runState, learnerOut, turn, premiseIdForKey, renderFact) {
  for (const fact of learnerOut.adopt || []) {
    const key = factKey(fact);
    const existing = runState.grounded.get(key);
    if (existing) {
      if (runState.corruption && existing.decayed) {
        existing.decayed = false;
        existing.regroundedTurn = turn;
        const premiseId = premiseIdForKey(key);
        runState.corruption.ledger.push({ turn, type: 'repair', premiseId, via: 'readoption' });
        runState.events.push({
          turn,
          type: 'repair',
          detail: `${premiseId || renderFact(fact)} restored by re-adoption`,
        });
      }
      continue;
    }
    const valid = runState.releasedKeys.has(key) || runState.backgroundKeys.has(key);
    runState.grounded.set(key, { fact, turn, valid });
    if (!valid) runState.events.push({ turn, type: 'fabricated_fact', detail: renderFact(fact) });
  }
}

function applyHypothesis(runState, learnerOut, turn) {
  if (learnerOut.hypothesis) runState.hypotheses.push({ turn, text: learnerOut.hypothesis });
}

function applyDerivations({
  runState,
  world,
  learnerOut,
  turn,
  validGroundedFacts,
  normKey,
  isPatternFact,
  renderFact,
}) {
  const outcomes = [];
  if (!Array.isArray(learnerOut.derive) || !learnerOut.derive.length) return outcomes;
  const closed = closure(validGroundedFacts(), world.rules);
  const byNorm = new Map();
  for (const [key, fact] of closed.facts) byNorm.set(normKey(fact), { key, fact });
  for (const claim of learnerOut.derive) {
    if (!Array.isArray(claim) || !claim.length) continue;
    const hit = byNorm.get(normKey(claim));
    if (!hit) {
      runState.overreaches.push({ turn, fact: claim });
      runState.events.push({ turn, type: 'overreach', detail: renderFact(claim) });
      outcomes.push({ fact: claim, status: 'overreach' });
      continue;
    }
    if (runState.voicedKeys.has(hit.key)) {
      outcomes.push({ fact: hit.fact, status: 'repeat' });
      continue;
    }
    if (!closed.proofs.get(hit.key)) {
      runState.mischanneled.push({ turn, fact: hit.fact, kind: 'base' });
      outcomes.push({ fact: hit.fact, status: 'base' });
      continue;
    }
    if (isPatternFact(hit.fact)) {
      runState.mischanneled.push({ turn, fact: hit.fact, kind: 'pattern' });
      outcomes.push({ fact: hit.fact, status: 'pattern' });
      continue;
    }
    runState.voicedKeys.add(hit.key);
    runState.voicedLedger.push({ fact: hit.fact, turn });
    outcomes.push({ fact: hit.fact, status: 'voiced' });
  }
  return outcomes;
}

function appendLearnerTranscript({ runState, learnerOut, deriveOutcomes, turn, sceneMeta, publicRegister }) {
  runState.transcript.push({
    turn,
    role: 'learner',
    text: learnerOut.dialogue || '',
    meta: {
      adopt: learnerOut.adopt || [],
      retract: learnerOut.retract || [],
      derive: learnerOut.derive || [],
      deriveOutcomes,
      hypothesis: learnerOut.hypothesis || null,
      ...(learnerOut.retractionFilter ? { retractionFilter: learnerOut.retractionFilter } : {}),
      ...(learnerOut.learnerDrift ? { learnerDrift: learnerOut.learnerDrift } : {}),
      asserts: learnerOut.asserts || null,
      ...(learnerOut.assertionGate ? { assertionGate: learnerOut.assertionGate } : {}),
      exchangeType: learnerOut.exchangeType || null,
      ...(sceneMeta ? { scene: sceneMeta } : {}),
      publicRegister,
    },
  });
}

function recordPostLearnerTransformation({
  runState,
  world,
  tutorOut,
  learnerOut,
  turn,
  forced,
  learnerTransformationRow,
}) {
  if (!tutorOut.learnerTransformation || !world.ownershipTarget) return null;
  const transformation = deriveLearnerTransformationState({
    target: world.ownershipTarget,
    transcript: runState.transcript,
    learnerText: learnerOut.dialogue || null,
    turn,
    enabled: true,
    finalAssertionAvailable: forced,
  });
  if (transformation) {
    runState.learnerTransformationPostRows.push(
      learnerTransformationRow(transformation, turn, runState.actState?.index, 'post_learner', {
        forced,
        asserted: Boolean(learnerOut.asserts),
      }),
    );
  }
  return transformation;
}

function recordFirstForced(runState, turn, forced, firstForcedTurn) {
  if (!forced || firstForcedTurn !== null) return firstForcedTurn;
  runState.events.push({ turn, type: 'forced', detail: 'learner facts now force S' });
  return turn;
}

function updatePlannerOutcome({
  fieldPlannerRow,
  learnerOut,
  deriveOutcomes,
  forced,
  distanceBefore,
  distanceAfter,
  groundedBefore,
  groundedAfter,
}) {
  if (!fieldPlannerRow) return;
  fieldPlannerRow.outcome = summarizeFieldPlannerOutcome(fieldPlannerRow, {
    distanceBefore,
    distanceAfter,
    groundedBefore,
    groundedAfter,
    adoptedCount: (learnerOut.adopt || []).length,
    retractedCount: (learnerOut.retract || []).length,
    derivedCount: deriveOutcomes.filter((outcome) => outcome.status === 'voiced').length,
    overreachCount: deriveOutcomes.filter((outcome) => outcome.status === 'overreach').length,
    asserted: Boolean(learnerOut.asserts),
    forced,
  });
}

function recordLearnerDag({ runState, world, turn, learnerOut, valid, learnerBoardFacts }) {
  runState.learnerDagSnapshots.push(
    buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: valid,
      voiced: runState.voicedLedger,
      hypotheses: runState.hypotheses,
      assertion: learnerOut.asserts || null,
      learnerText: learnerOut.dialogue || null,
      ledger: runState.ledger,
      source: 'engine_board',
    }),
  );
}

function recordTrajectory(runState, turn, distance, forced, valid, theoryFidelity) {
  const fidelity = runState.corruption ? theoryFidelity() : null;
  runState.trajectory.push({
    turn,
    D: distance,
    forced,
    groundedCount: valid.length,
    ...(runState.corruption ? { F: fidelity } : {}),
  });
  return fidelity;
}

function classifySceneExchange({
  runState,
  learnerOut,
  deriveOutcomes,
  sceneState,
  sceneTempo,
  distanceBefore,
  distanceAfter,
  groundedBefore,
  groundedAfter,
}) {
  if (!runState.sceneConfig || !sceneState) return null;
  const exchange = classifyLearnerExchange({
    dialogue: learnerOut.dialogue || '',
    adopt: learnerOut.adopt || [],
    retract: learnerOut.retract || [],
    deriveOutcomes,
    hypothesis: learnerOut.hypothesis || null,
    asserts: learnerOut.asserts || null,
    dBefore: distanceBefore,
    dAfter: distanceAfter,
    groundedBefore,
    groundedAfter,
  });
  if (sceneTempo) exchange.tempo = sceneTempo.beat;
  const phaticRecognition = detectPhaticRecognition(learnerOut.dialogue || '', {
    role: 'learner',
    exchangeType: exchange.type,
    tempo: sceneTempo,
    cognitiveTempo: exchange.cognitiveTempo,
  });
  if (phaticRecognition.length) {
    exchange.phaticRecognition = phaticRecognition;
    runState.transcript[runState.transcript.length - 1].meta.phaticRecognition = phaticRecognition;
  }
  runState.transcript[runState.transcript.length - 1].meta.exchange = exchange;
  return exchange;
}

function recordLearnerLedgers(runState, learnerOut, turn, sceneState) {
  if (!runState.learnerLedgerActive) return;
  if (learnerOut.sceneIntent && sceneState) {
    runState.learnerLedgerRows.push(
      ledgerRow({
        agent: 'learner',
        scope: 'scene',
        commitment: learnerOut.sceneIntent,
        committedTurn: turn,
        expires: `scene_${sceneState.index}_close`,
      }),
    );
    runState.events.push({
      turn,
      type: 'learner_intent',
      detail: `scene ${sceneState.index}: ${learnerOut.sceneIntent.want || learnerOut.sceneIntent.ifLost || 'committed'}`,
    });
  }
  if (learnerOut.actCarry && runState.actState) {
    runState.learnerLedgerRows.push(
      ledgerRow({
        agent: 'learner',
        scope: 'act',
        commitment: learnerOut.actCarry,
        committedTurn: turn,
        expires: `act_${runState.actState.index}_close`,
      }),
    );
    runState.events.push({
      turn,
      type: 'learner_carry',
      detail: `act ${runState.actState.index}: ${learnerOut.actCarry.carryForward || 'carry committed'}`,
    });
  }
  if (learnerOut.sceneIntentAudit) {
    const audit = learnerOut.sceneIntentAudit;
    const row = [...runState.learnerLedgerRows]
      .reverse()
      .find(
        (candidate) =>
          candidate.agent === 'learner' &&
          candidate.scope === 'scene' &&
          candidate.expires === `scene_${audit.sceneIndex}_close` &&
          !candidate.audit,
      );
    if (row) row.audit = { clauses: audit.clauses, summary: audit.summary };
    runState.events.push({
      turn,
      type: 'learner_intent_audit',
      detail: `scene ${audit.sceneIndex} intent audited: ${audit.summary}`,
    });
  }
}

function updateStrategyBlock(runState, learnerOut, turn, sceneState, sceneExchange) {
  const ledgerState = runState.ledgerState;
  if (!ledgerState || !sceneExchange) return;
  if (ledgerState.block) {
    const updated = updateBlockLedger(ledgerState.block, {
      turn,
      learnerText: learnerOut.dialogue || '',
      exchangeType: sceneExchange.type,
      maxBlockTurns: ledgerState.config.maxBlockTurns,
    });
    ledgerState.block = updated.block;
    if (updated.closed) {
      ledgerState.blockRows.push(updated.closed);
      runState.events.push({
        turn,
        type: 'block_close',
        detail: `block ${updated.closed.index} (${updated.closed.type}) ${updated.closed.status}: ${updated.closed.closeReason}`,
      });
      if (updated.closed.status === 'failed' && updated.closed.heldMode) {
        ledgerState.blockedModes = [updated.closed.heldMode];
      } else if (updated.closed.status === 'cleared') {
        ledgerState.blockedModes = [];
      }
    }
  }
  if (ledgerState.block) return;
  const blockType = blockTypeForExchange(sceneExchange.type);
  if (!blockType) return;
  ledgerState.blockIndex += 1;
  ledgerState.block = openBlock({
    index: ledgerState.blockIndex,
    turn,
    type: blockType,
    scene: sceneState?.index ?? null,
  });
  runState.events.push({
    turn,
    type: 'block_open',
    detail: `block ${ledgerState.blockIndex} (${blockType}) opened`,
  });
}

function updateOpportunityBudget(runState, learnerOut, deriveOutcomes, tutorRelease, turn) {
  const ledgerState = runState.ledgerState;
  if (!ledgerState) return;
  const repairedThisTurn = runState.events.some((event) => event.turn === turn && event.type === 'repair');
  const tutorProofAction = Boolean(tutorRelease) || repairedThisTurn;
  const learnerProofAction =
    Boolean(learnerOut.asserts) ||
    (learnerOut.adopt || []).length > 0 ||
    deriveOutcomes.some((outcome) => outcome.status === 'voiced');
  if (tutorProofAction || learnerProofAction) {
    ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, { proofActionTaken: true });
    return;
  }
  ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, {
    actor: 'tutor',
    conduct: 'advisory',
    proofNeutral: true,
  });
  ledgerState.budget = nextOpportunityCostBudget(ledgerState.budget, { actor: 'learner', proofNeutral: true });
}

function recordInconsistency(runState, world, valid, turn, renderFact) {
  const closed = closure(valid, world.rules).facts;
  for (const [left, right] of world.incompatible) {
    if (!closed.has(factKey(left)) || !closed.has(factKey(right))) continue;
    if (!runState.events.some((event) => event.type === 'inconsistency')) {
      runState.events.push({ turn, type: 'inconsistency', detail: `${renderFact(left)} vs ${renderFact(right)}` });
    }
  }
}

function applyAssertion(runState, world, learnerOut, turn, forced, assertedGroundedTurn, endedBy, renderFact) {
  if (!learnerOut.asserts) return { assertedGroundedTurn, endedBy };
  const assertedKey = factKey(learnerOut.asserts);
  if (assertedKey === factKey(world.secret.fact)) {
    if (forced) {
      runState.events.push({ turn, type: 'grounded_anagnorisis', detail: world.secret.surface });
      return { assertedGroundedTurn: turn, endedBy: 'grounded_anagnorisis' };
    }
    runState.events.push({ turn, type: 'lucky_leap', detail: 'asserted S unforced' });
    return { assertedGroundedTurn, endedBy };
  }
  if (world.mirror && assertedKey === factKey(world.mirror.fact)) {
    runState.events.push({ turn, type: 'mirror', detail: renderFact(world.mirror.fact) });
  } else {
    runState.events.push({ turn, type: 'wrong_assertion', detail: renderFact(learnerOut.asserts) });
  }
  return { assertedGroundedTurn, endedBy };
}

function recordUnstagedRecognition(runState, turn, firstForcedTurn, assertedGroundedTurn) {
  if (firstForcedTurn === null || assertedGroundedTurn !== null) return;
  if (turn - firstForcedTurn < runState.opts.recognitionGrace) return;
  if (runState.events.some((event) => event.type === 'unstaged_recognition')) return;
  runState.events.push({ turn, type: 'unstaged_recognition', detail: 'forced, not asserted' });
}

/** Invoke the learner and apply learner-owned formal effects for one turn. */
export async function runLearnerTransition({
  runState,
  world,
  turn,
  role,
  buildView,
  releasedThisTurn,
  sceneState,
  sceneMeta,
  sceneTempo,
  publicRegister,
  tutorOut,
  tutorRelease,
  fieldPlannerRow,
  firstForcedTurn,
  assertedGroundedTurn,
  endedBy,
  validGroundedFacts,
  learnerBoardFacts,
  recordAvailability,
  theoryFidelity,
  premiseIdForKey,
  normKey,
  isPatternFact,
  renderFact,
  learnerTransformationRow,
}) {
  const distanceBefore = derivationDistance(world, validGroundedFacts());
  const groundedBefore = validGroundedFacts().length;
  const learnerOut = (await role(buildView(turn, releasedThisTurn))) || {};
  recordMirrorRefusal(runState, learnerOut, turn);
  applyRetractions(runState, learnerOut, turn, premiseIdForKey, renderFact);
  applyAdoptions(runState, learnerOut, turn, premiseIdForKey, renderFact);
  applyHypothesis(runState, learnerOut, turn);
  const deriveOutcomes = applyDerivations({
    runState,
    world,
    learnerOut,
    turn,
    validGroundedFacts,
    normKey,
    isPatternFact,
    renderFact,
  });
  appendLearnerTranscript({ runState, learnerOut, deriveOutcomes, turn, sceneMeta, publicRegister });
  const valid = validGroundedFacts();
  recordAvailability(turn);
  const forced = entails(valid, world.rules, world.secret.fact);
  const postLearnerTransformation = recordPostLearnerTransformation({
    runState,
    world,
    tutorOut,
    learnerOut,
    turn,
    forced,
    learnerTransformationRow,
  });
  const nextFirstForcedTurn = recordFirstForced(runState, turn, forced, firstForcedTurn);
  const distance = derivationDistance(world, valid);
  updatePlannerOutcome({
    fieldPlannerRow,
    learnerOut,
    deriveOutcomes,
    forced,
    distanceBefore,
    distanceAfter: distance,
    groundedBefore,
    groundedAfter: valid.length,
  });
  recordLearnerDag({ runState, world, turn, learnerOut, valid, learnerBoardFacts });
  const fidelity = recordTrajectory(runState, turn, distance, forced, valid, theoryFidelity);
  const sceneExchange = classifySceneExchange({
    runState,
    learnerOut,
    deriveOutcomes,
    sceneState,
    sceneTempo,
    distanceBefore,
    distanceAfter: distance,
    groundedBefore,
    groundedAfter: valid.length,
  });
  recordLearnerLedgers(runState, learnerOut, turn, sceneState);
  updateStrategyBlock(runState, learnerOut, turn, sceneState, sceneExchange);
  updateOpportunityBudget(runState, learnerOut, deriveOutcomes, tutorRelease, turn);
  recordInconsistency(runState, world, valid, turn, renderFact);
  const assertion = applyAssertion(
    runState,
    world,
    learnerOut,
    turn,
    forced,
    assertedGroundedTurn,
    endedBy,
    renderFact,
  );
  recordUnstagedRecognition(runState, turn, nextFirstForcedTurn, assertion.assertedGroundedTurn);
  return {
    learnerOut,
    deriveOutcomes,
    postLearnerTransformation,
    forced,
    D: distance,
    F: fidelity,
    sceneExchange,
    firstForcedTurn: nextFirstForcedTurn,
    assertedGroundedTurn: assertion.assertedGroundedTurn,
    endedBy: assertion.endedBy,
  };
}
