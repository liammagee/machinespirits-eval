/**
 * The drama engine: turn loop, role-scoped views, release ledger, slope
 * trajectory, failure taxonomy (notes/2026-06-09-dramatic-derivation-plan.md §2–§3).
 *
 * Roles are injected async functions (mock now, LLM-backed later — same
 * seam as services/adaptiveTutor's mock/real split):
 *   director(view) -> { direction, release?: premiseId,
 *                       phase?: {name, intent} }  // declare/replace the current movement
 *   tutor(view)    -> { dialogue, move?: {figure,targetPremise,intent}, release?: premiseId,
 *                       deliberation?: {draftFigure, intervened, diagnosis, note, stall?} }
 *   learner(view)  -> { dialogue, adopt?: fact[], retract?: fact[], derive?: fact[],
 *                       hypothesis?: string, asserts?: fact }
 *
 * THE DERIVE CHANNEL (2026-06-10, stall-watcher experiment): the learner may
 * VOICE intermediate conclusions — facts it claims follow from its board
 * under the public rules. The learner composes them itself (an enumerated
 * pick-list would measure list-picking, not inference). Validation is
 * mechanical: in the closure of the valid board → the voiced ledger; not in
 * the closure → `overreach` event; base or question-pattern facts →
 * mischanneled (adopt and assert are those channels). Voicing changes
 * NOTHING formal — a derivable fact is in the closure whether or not spoken;
 * D(t), forcing, and the verdict are untouched by construction. The engine
 * also tracks the INFERENCE FRONTIER (derivable, non-base, non-pattern,
 * unvoiced facts with first-available turns) and exposes it to the
 * tutor-side view — the raw material of the superego's stall jurisdiction.
 * Question-pattern facts are excluded BEFORE the frontier exists, so the
 * superego never sees even a derivable S.
 *
 * THE DRAMATURGY IS THE DIRECTOR'S (operator decision 2026-06-09, logged in
 * notes/poetics/): the world's authored acts are a SKETCH; the director may
 * declare movements as the drama needs. The per-turn tutor-note channel was
 * REMOVED 2026-06-10 (operator decision): manner-watching belongs to the
 * tutor's own superego (llmRoles.makeLlmTutor, surfaced here only as the
 * tutor line's `deliberation` meta). What stays frozen is the formal channel:
 * the release schedule, the checker, the slope constraints, the turn cap.
 * The learner never sees staging state or tutor deliberation.
 *
 * STAGE V2 — ACTS, THE BOUNDED LEARNER, THE RECONSTRUCTING TUTOR
 * (notes/poetics/2026-06-11-act-bounded-learner-design.md; opt-in via
 * options.acts, off-state invariant when absent). The act becomes a
 * first-class unit: the director is still consulted every turn but returns an
 * act verdict ({act:'continue'|'end', direction?}) instead of free movements;
 * the engine owns the boundaries (minActTurns/maxActTurns guards) and
 * synthesizes an `Act N` staging phase at each boundary so every
 * phase-reading instrument works unchanged. Turn 1's direction is Act 1's
 * brief. The LEARNER is bounded: its view carries (a) its own theory store
 * and (b) the current act's dialogue/releases/voicings only — the theory is
 * the only thing that crosses an act boundary. The TUTOR view is redacted to
 * dialogue + its own release ledger (no learnerAbox, no corruption ledger, no
 * frontier/trajectory — each is computed FROM the hidden store and would leak
 * decay as deltas): §6.13.7's conduct condition made total at the view layer,
 * in BOTH probe arms. The director keeps its evaluative instruments
 * (trajectory, frontier, grounded count) but loses the corruption ledger and
 * the store dump, so act briefs cannot smuggle slip identities to the tutor.
 * Decay gains a mutation mode (corruption.js `mutateShare`): a hit may
 * misremember instead of delete — the false form sits on the learner's
 * BELIEF board (visible to the learner, never valid for forcing) until the
 * learner retracts it (`retract_false` ledger row); the true premise comes
 * back only via tutor repair or re-adoption, exactly as v1. The swap
 * constant's pool is config-keyed (corruption.js `pool`): "world" samples
 * all premises — which can leak an unreleased premise's constant into a
 * false form, a hole in the concealment invariant below — while "staged"
 * (registration §13) samples only background + premises released so far. A reconstructing
 * tutor (roles-layer dial) may emit per-turn `theory` — its model of the
 * learner's store — which the engine records beside a harness-truth snapshot
 * (result.reconstruction); arm-internal color, never cross-arm scoring.
 *
 * THE SINGLE-CONCEALMENT INVARIANT: the learner's view contains the public
 * question (+ pattern), the world RULES (the learner knows the law, lacks
 * the facts), its own background, the public transcript, and facts already
 * released. Never: the secret, the mirror, unreleased premises, the
 * schedule, or the proof paths. Tested in tests/dramaticDerivation.test.js.
 *
 * Success is computed, never judged: grounded anagnorisis requires the
 * learner to ASSERT the secret while the closure of its VALID grounded
 * facts (grounded ∩ (released ∪ background)) forces it. Adopted facts that
 * were never released are logged as `fabricated_fact` and excluded from the
 * success channel.
 */

import { closure, entails, factKey, matchPattern } from './chainer.js';
import { DIDACTIC_ACT_FALLBACK_SCHEMA } from './didacticMode.js';
import { buildLearnerCharacterArcView } from './characterDesire.js';
import { projectWorldIRLogic } from './guardCompiler.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from './learnerDag.js';
import { buildDynamicLearnerField } from './learnerField.js';
import { proofDebtReport, tutorProofDebtView } from './proofDebt.js';
import { buildLearnerProxyDagMemory, buildTutorLearnerDagModel, deriveProxyDagPacingSignal } from './proxyDagMemory.js';
import { buildPedagogicalInteractionField } from './interactionField.js';
import { buildFieldReportContext, selectFieldPlannerMove } from './fieldPlanner.js';
import {
  applyRecognitionNeedPolicy,
  estimateRecognitionNeed,
  openScene,
  recommendSceneTempoBeat,
  sceneMeta,
  sceneView,
  updateScene,
} from './rhetoricalMovePolicy.js';
import { derivationDistance, detectStall } from './slope.js';
import { deriveOpportunityCostBudget, auditOpportunityCost } from './opportunityCost.js';
import { buildMechanismHistoryEntry, sceneStanceFidelity } from './strategyLedger.js';
import {
  computeLemmaState,
  renderLearnerLemmaLines,
  renderTutorLemmaLines,
  supportRemaining as lemmaSupportRemaining,
} from './lemmaLayer.js';
import { classifyMessage } from './messageClassifier.js';
import { decideRegister, REGISTER_BLOCKS } from './registerRouter.js';
import { createDramaRunState } from './runState.js';
import { createDramaStagePrologue, finalizeDramaRunLifecycle, resolveDramaTurnLimit } from './runLifecycle.js';
import { buildDramaRunResult } from './runResult.js';
import { runDirectorTransition } from './directorTransition.js';
import { runTutorTransition } from './tutorTransition.js';
import { runLearnerTransition } from './learnerTransition.js';

export { normalizeActsConfig, normalizeDirectorCadence } from './runState.js';

function renderFact(fact) {
  return fact.join(' ');
}

function learnerTransformationRow(state, turn, act, phase, extra = {}) {
  return {
    turn,
    ...(act ? { act } : {}),
    phase,
    schema: state.schema,
    publicOnly: state.publicOnly === true,
    mayOverrideProofControl: state.mayOverrideProofControl === true,
    status: state.status || null,
    complete: state.complete === true,
    target: state.target?.currentObject || null,
    ownershipLevel: state.ownership?.ownershipLevel || null,
    ownershipScore: state.ownership?.score ?? null,
    requiredFamilies: state.requiredFamilies || [],
    passedFamilies: state.passedFamilies || [],
    missingFamilies: state.missingFamilies || [],
    recommendedMode: state.recommendedMode || null,
    finalAssertionAvailable: state.finalAssertionAvailable === true,
    lateOwnershipCheck: state.lateOwnershipCheck === true,
    inputAuditOk: state.inputAudit?.ok === true,
    nonLeakAuditOk: state.nonLeakAudit?.ok === true,
    ...extra,
  };
}

export async function runDrama({ world, roles, options = {} }) {
  const runState = createDramaRunState({ world, options });
  const {
    opts,
    corruption,
    acts,
    sceneConfig,
    fieldPlannerActive,
    fieldReportContextActive,
    learnerLedgerActive,
    lemmaConfig,
    lemmaDag,
    learnerMirrorRefusalConfig,
    mirrorRefusalState,
    registerRouterConfig,
    registerRouterState,
    directorCadence,
    initialPublicRegisterForTurn,
    baseRegisterForRun,
    registerRows,
    stagePrologueEnabled,
    runtimeMonitor,
    conductPolicyActive,
    conductPolicyEnforceActive,
    conductTriggerOverrides,
    proofDebtViewActive,
    logicProjectionActive,
    worldIR,
    actState,
    ledgerState,
    logicSnapshots,
    sceneRows,
    didacticModeRows,
    proxyDagPacingRows,
    ledger,
    releasedKeys,
    releasedFacts,
    releasedAtByKey,
    backgroundKeys,
    grounded,
    hypotheses,
    transcript,
    trajectory,
    learnerDagSnapshots,
    events,
    staging,
    lemmaRun,
    voicedLedger,
    voicedKeys,
    firstAvailable,
    overreaches,
    premiseIdByKey,
    releasedIdByKey,
    mutationPoolByPredPos,
  } = runState;
  let sceneTempoThisTurn = null;
  let sceneRecognitionNeedThisTurn = null;
  let publicRegisterForTurn = initialPublicRegisterForTurn;
  let stagePrologue = null;
  let lastClosedSceneSummary = null;
  let sceneState = null;
  let firstForcedTurn = null;
  let assertedGroundedTurn = null;
  let endedBy = null;

  const validGroundedFacts = () =>
    [...grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);

  // The learner's BELIEF board — what it would assent to. Differs from the
  // forcing board in exactly one class: mutation-born false beliefs
  // (mutatedFalse) are visible to the learner, which believes them, while
  // staying invalid for forcing/D. Fabricated adoptions stay invisible in
  // both (v1 behavior). With mutateShare 0 this is validGroundedFacts(),
  // fact for fact, in the same insertion order.
  const learnerBoardFacts = () =>
    [...grounded.values()]
      .filter((entry) => !entry.decayed && (entry.valid || entry.mutatedFalse))
      .map((entry) => entry.fact);

  // F(t): Jaccard fidelity between the learner's belief board and the ideal
  // no-decay store (background ∪ everything released so far). 1 = the theory
  // is exactly what the play has staged; deletions and false beliefs both
  // drag it down. Recorded onto trajectory rows only when corruption is on
  // (the design note's documented additive relaxation of v1 byte-identity).
  const theoryFidelity = () => {
    const idealKeys = new Set([...backgroundKeys, ...releasedKeys]);
    const union = new Set(idealKeys);
    let inter = 0;
    for (const [key, entry] of grounded) {
      if (entry.decayed || !(entry.valid || entry.mutatedFalse)) continue;
      if (idealKeys.has(key)) inter += 1;
      union.add(key);
    }
    return union.size ? inter / union.size : 1;
  };

  // --- derive channel + inference frontier state (stall-watcher instrument) ---
  // Twin-fact premises stage the SAME fact under different ids (alternative
  // evidentiary routes — lantern's p_residue/p_glimpse; only one twin is ever
  // scheduled). premiseIdByKey is last-writer-wins over that many-to-one map,
  // so it can name the twin that was never staged. Reported identity must be
  // the id whose release actually put the fact on the board: repairs BY id
  // are immune (they collapse to the fact key), but id-COMPARING consumers
  // (corruptionReport pairing, repair guards) silently mismatch otherwise.
  const premiseIdForKey = (key) => releasedIdByKey.get(key) ?? premiseIdByKey.get(key) ?? null;

  // Token-normalized matching for learner-composed derive claims: case and
  // punctuation are forgiven, content is not (pre-registered in
  // notes/poetics/2026-06-10-stall-watcher-quasi-logical-tom.md §2).
  const normToken = (atom) =>
    String(atom)
      .toLowerCase()
      .replace(/[^a-z0-9?]/gu, '');
  const normKey = (fact) => JSON.stringify(fact.map(normToken));

  // Question-pattern facts (S, the mirror, any fact of their shape) are the
  // assert channel's property — excluded from the frontier BEFORE it exists,
  // so the tutor-side view never contains even a derivable S.
  const isPatternFact = (fact) => matchPattern(world.questionPattern, fact) !== null;

  // Mutation ("misremembering") support, stage v2: a decay hit may, at
  // mutateShare odds, swap one argument of the lost fact for a plausible
  // same-slot constant — a mistaken axiom the learner now believes. The
  // candidate pool is deterministic (sorted constants seen at the same
  // predicate+position); the pick is one seeded rng draw over the filtered
  // candidate list. Constraints keep the false form strictly false and
  // strictly novel: no collision with any premise (released or not),
  // background fact, current board entry, the secret, the mirror, or the
  // question pattern. An empty candidate list falls back to a plain delete.
  //
  // Stage v3 (`pool` key, registration §13): under pool "world" constants are
  // harvested from ALL premises plus background — including unreleased
  // premises, so a false form can whisper a name the learner has never met
  // (the lantern-p3 defect: corruption staged "senna" before any exhibit
  // did). Under pool "staged" the harvest is background plus premises
  // RELEASED SO FAR — a misremembering can only confuse entities already met
  // on stage. The pool then grows with the release ledger, so the cache is
  // keyed by released-count (monotone within a run).
  const mutationPool = (pred, pos) => {
    const staged = corruption?.config.pool === 'staged';
    const poolKey = `${pred}|${pos}|${staged ? releasedKeys.size : 'w'}`;
    if (mutationPoolByPredPos.has(poolKey)) return mutationPoolByPredPos.get(poolKey);
    const constants = new Set();
    const harvest = (fact) => {
      if (fact[0] === pred && fact.length > pos) constants.add(fact[pos]);
    };
    for (const premise of world.premiseById.values()) {
      if (staged && !releasedKeys.has(factKey(premise.fact))) continue;
      harvest(premise.fact);
    }
    for (const fact of world.background) harvest(fact);
    const sorted = [...constants].sort();
    mutationPoolByPredPos.set(poolKey, sorted);
    return sorted;
  };
  const mutationCandidates = (fact) => {
    const candidates = [];
    for (let pos = 1; pos < fact.length; pos += 1) {
      for (const constant of mutationPool(fact[0], pos)) {
        if (constant === fact[pos]) continue;
        const candidate = [...fact];
        candidate[pos] = constant;
        const key = factKey(candidate);
        if (grounded.has(key)) continue;
        if (premiseIdByKey.has(key)) continue;
        if (backgroundKeys.has(key)) continue;
        if (key === factKey(world.secret.fact)) continue;
        if (world.mirror && key === factKey(world.mirror.fact)) continue;
        if (isPatternFact(candidate)) continue;
        candidates.push(candidate);
      }
    }
    return candidates;
  };

  // Record first-availability for every derived, non-pattern fact in the
  // closure of the learner's valid board. Returns the closure for reuse.
  const recordAvailability = (turn) => {
    const cl = closure(validGroundedFacts(), world.rules);
    for (const [key, fact] of cl.facts) {
      if (!cl.proofs.get(key)) continue; // base fact
      if (isPatternFact(fact)) continue;
      if (!firstAvailable.has(key)) firstAvailable.set(key, { fact, turn });
    }
    return cl;
  };

  const lastTutorTargets = (n = 2) => {
    const targets = [];
    for (let i = transcript.length - 1; i >= 0 && targets.length < n; i -= 1) {
      if (transcript[i].role !== 'tutor') continue;
      targets.push(transcript[i].meta?.move?.targetPremise || null);
    }
    return targets.filter(Boolean);
  };

  // The inference frontier: derivable, non-base, non-pattern, not-yet-voiced
  // facts with ages and ground premise ids — the raw material of the
  // superego's stall jurisdiction. Computed fresh per view; availability
  // history lives in firstAvailable.
  const computeFrontier = (turn) => {
    const cl = closure(validGroundedFacts(), world.rules);
    const recentTargets = lastTutorTargets(2);
    const items = [];
    for (const [key, fact] of cl.facts) {
      const proof = cl.proofs.get(key);
      if (!proof) continue;
      if (isPatternFact(fact)) continue;
      if (voicedKeys.has(key)) continue;
      const grounds = proof.premises.map((pk) => ({
        fact: cl.facts.get(pk),
        premiseId: premiseIdForKey(pk),
      }));
      const groundPremiseIds = grounds.map((g) => g.premiseId).filter(Boolean);
      const since = firstAvailable.get(key)?.turn ?? turn;
      items.push({
        fact,
        rule: proof.rule,
        grounds,
        groundPremiseIds,
        firstAvailable: since,
        age: turn - since,
        targetedByLast2: groundPremiseIds.some((id) => recentTargets.includes(id)),
      });
    }
    items.sort((a, b) => a.firstAvailable - b.firstAvailable || factKey(a.fact).localeCompare(factKey(b.fact)));
    return items;
  };

  const applyRelease = (turn, premiseId, via, extra = null) => {
    if (!premiseId) return null;
    const premise = world.premiseById.get(premiseId);
    if (!premise || releasedKeys.has(factKey(premise.fact))) return null;
    releasedKeys.add(factKey(premise.fact));
    releasedIdByKey.set(factKey(premise.fact), premiseId);
    releasedAtByKey.set(factKey(premise.fact), turn);
    releasedFacts.push(premise.fact);
    // `extra` (C2 release authority): the tutor's declared reason and the
    // offset from the scheduled turn ride on the ledger row, so adherence
    // instruments read deviation-as-strategy without joining the transcript.
    // Hold turns (nothing played) never reach here — their decision records
    // live only in the tutor transcript meta.
    ledger.push({ turn, premiseId, via, ...(extra || {}) });
    return premise.fact;
  };

  // What the world has staged is not what the learner still holds: a decayed
  // fact vanishes from the learner's view of the released record too —
  // otherwise the learner would trivially re-adopt it from the list each turn
  // and the condition would be a no-op. The transcript prose still carries
  // the staging dialogue; re-deriving the fact from there is a legitimate
  // (and measured) recovery path.
  const visibleToLearner = (facts) =>
    corruption ? facts.filter((fact) => !grounded.get(factKey(fact))?.decayed) : facts;

  const naturalFact = (fact) =>
    Array.isArray(fact) && fact.length
      ? `${String(fact[0])
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .toLowerCase()}: ${fact
          .slice(1)
          .map((x) =>
            String(x)
              .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
              .replace(/[_-]+/g, ' ')
              .toLowerCase(),
          )
          .join(', ')}`
      : '';

  const learnerSurfaceForFact = (fact) => {
    const key = factKey(fact);
    const premiseId = releasedIdByKey.get(key) ?? premiseIdByKey.get(key);
    const premise = premiseId ? world.premiseById.get(premiseId) : null;
    return premise?.surface || naturalFact(fact);
  };

  const learnerFactSurfaces = (facts) =>
    Object.fromEntries(facts.map((fact) => [factKey(fact), learnerSurfaceForFact(fact)]));

  const publicStageLine = (entry) => entry.role !== 'director' || entry.meta?.release || entry.meta?.phase?.name;

  const currentProofDebt = (turn) =>
    proofDebtViewActive && corruption
      ? proofDebtReport(world, { grounded, releasedIdByKey, turn })
      : { turn, active: false, dNow: derivationDistance(world, validGroundedFacts()), debts: [] };

  const nextScheduledRelease = (turn) =>
    world.releaseSchedule
      .filter((entry) => !ledger.some((row) => row.premiseId === entry.premise) && entry.turn >= turn)
      .sort((a, b) => a.turn - b.turn)[0] || null;

  const currentProxyDagPacing = (turn, roleName) => {
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: validGroundedFacts(),
      voiced: voicedLedger,
      hypotheses,
      ledger,
      source: 'engine_proxy_pacing',
    });
    const learnerDag = buildLearnerDag([snapshot], world);
    const firstReleaseTurn = ledger.length > 0 ? ledger[0].turn : Infinity;
    return deriveProxyDagPacingSignal({
      turn,
      role: roleName,
      assessment: learnerDag.assessment,
      stallType: detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn),
      nextScheduledRelease: nextScheduledRelease(turn),
    });
  };

  const currentTutorLearnerDagModel = (turn, roleName) => {
    const grounded = learnerBoardFacts();
    const voiced = voicedLedger.map((entry) => ({ ...entry }));
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: grounded,
      validFacts: validGroundedFacts(),
      voiced,
      hypotheses,
      ledger,
      source: 'engine_tutor_learner_dag_model',
    });
    const learnerDag = buildLearnerDag([snapshot], world);
    const surfaceFacts = [
      ...world.background,
      ...visibleToLearner([...releasedFacts]),
      ...grounded,
      ...voiced.map((entry) => entry.fact),
    ];
    const factSurfaces = learnerFactSurfaces(surfaceFacts);
    const proxyDagMemory = buildLearnerProxyDagMemory({
      turn,
      questionPattern: world.questionPattern,
      rules: world.rules,
      groundedFacts: grounded,
      voiced,
      hypotheses,
      factSurface: (fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact),
    });
    return buildTutorLearnerDagModel({
      turn,
      role: roleName,
      proxyDagMemory,
      assessment: learnerDag.assessment,
    });
  };

  const currentFieldPlanner = (turn) => {
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: validGroundedFacts(),
      voiced: voicedLedger,
      hypotheses,
      ledger,
      source: 'engine_field_planner',
    });
    const snapshots = [...learnerDagSnapshots.filter((row) => Number(row.turn) < Number(turn)), snapshot];
    const learnerDag = buildLearnerDag(snapshots, world);
    const learnerField = buildDynamicLearnerField(world, learnerDag);
    const resultLike = {
      worldId: world.id,
      events: [...events],
      trajectory: [...trajectory],
      transcript: [...transcript],
      ledger: [...ledger],
      firstForcedTurn,
      assertedGroundedTurn,
      turnsPlayed: Math.max(0, turn - 1),
      learnerDag,
    };
    const interactionField = buildPedagogicalInteractionField(world, resultLike, { learnerField });
    return selectFieldPlannerMove({
      world,
      turn,
      interactionField,
      learnerField,
      nextScheduledRelease: nextScheduledRelease(turn),
      canAssertFinal: entails(validGroundedFacts(), world.rules, world.secret.fact),
      proofDebt: currentProofDebt(turn),
    });
  };

  // Report-only sibling of currentFieldPlanner: same snapshot and coupled
  // field, no candidate projection and no move selection. Feeds the tutor
  // context in the field_report_only placebo arm.
  const currentFieldReportContext = (turn) => {
    const snapshot = buildLearnerDagSnapshot(world, {
      turn,
      boardFacts: learnerBoardFacts(),
      validFacts: validGroundedFacts(),
      voiced: voicedLedger,
      hypotheses,
      ledger,
      source: 'engine_field_report_context',
    });
    const snapshots = [...learnerDagSnapshots.filter((row) => Number(row.turn) < Number(turn)), snapshot];
    const learnerDag = buildLearnerDag(snapshots, world);
    const learnerField = buildDynamicLearnerField(world, learnerDag);
    const resultLike = {
      worldId: world.id,
      events: [...events],
      trajectory: [...trajectory],
      transcript: [...transcript],
      ledger: [...ledger],
      firstForcedTurn,
      assertedGroundedTurn,
      turnsPlayed: Math.max(0, turn - 1),
      learnerDag,
    };
    const interactionField = buildPedagogicalInteractionField(world, resultLike, { learnerField });
    return buildFieldReportContext({ turn, interactionField, learnerField });
  };

  const openSceneForTurn = (turn, reason = 'opening') => {
    if (!sceneConfig || sceneState) return null;
    const dNow = derivationDistance(world, validGroundedFacts());
    const debt = currentProofDebt(turn).debts?.[0] || null;
    const frontier = computeFrontier(turn)[0] || null;
    const nextRelease = nextScheduledRelease(turn);
    const targetPremise = debt?.premiseId || frontier?.groundPremiseIds?.[0] || nextRelease?.premise || null;
    const targetFact = frontier?.fact || (targetPremise ? world.premiseById.get(targetPremise)?.fact || null : null);
    const goal = debt
      ? `Repair proof debt on ${debt.premiseId} before new work.`
      : frontier
        ? `Bring the learner to voice a waiting local conclusion from ${frontier.groundPremiseIds.join(', ') || 'the current board'}.`
        : nextRelease
          ? `Prepare or seat ${nextRelease.premise} without forcing the concealed answer.`
          : 'Keep the inquiry socially live while locating the next proof obligation.';
    sceneState = openScene({
      index: sceneRows.length + 1,
      turn,
      dNow,
      targetPremise,
      targetFact,
      goal,
      reason,
    });
    events.push({ turn, type: 'scene_open', detail: `scene ${sceneState.index}: ${sceneState.goal}` });
    return sceneState;
  };

  const unreleasedScheduledThisTurn = (turn) =>
    world.releaseSchedule.filter(
      (entry) => entry.turn === turn && !ledger.some((row) => row.premiseId === entry.premise),
    );

  const selectSceneTempoForTurn = (turn) => {
    if (!sceneState || !sceneConfig?.tempo) return null;
    return recommendSceneTempoBeat(
      world,
      sceneState,
      {
        turn,
        dNow: derivationDistance(world, validGroundedFacts()),
        releaseDue: unreleasedScheduledThisTurn(turn).length > 0,
        maxPhaticExchanges: sceneConfig.maxPhaticExchanges,
        recognitionNeed: sceneRecognitionNeedThisTurn,
      },
      sceneConfig.tempo,
    );
  };

  const selectSceneRecognitionNeedForTurn = () =>
    sceneConfig?.recognitionNeed !== false && sceneState
      ? applyRecognitionNeedPolicy(
          estimateRecognitionNeed(sceneState, {
            forced: entails(validGroundedFacts(), world.rules, world.secret.fact),
          }),
          sceneState,
          {
            policy: sceneConfig.recognitionNeed,
            forced: entails(validGroundedFacts(), world.rules, world.secret.fact),
          },
        )
      : null;

  const currentSceneView = () =>
    sceneState ? sceneView(sceneState, sceneTempoThisTurn, sceneRecognitionNeedThisTurn) : null;
  const currentSceneMeta = () =>
    sceneState ? sceneMeta(sceneState, sceneTempoThisTurn, sceneRecognitionNeedThisTurn) : null;
  const didacticFallbackForAct = (actIndex, startTurn, endTurn) => {
    const rows = didacticModeRows.filter((row) => row.act === actIndex && row.turn >= startTurn && row.turn <= endTurn);
    if (!rows.length) return null;
    const strainedSignals = new Set(['stalled', 'echo_only', 'misapplied', 'overloaded', 'purpose_gap']);
    let selected = null;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].scope === 'act' || rows[i].scope === 'next_act') {
        selected = rows[i];
        break;
      }
      if (!selected && strainedSignals.has(rows[i].learningSignal)) selected = rows[i];
    }
    if (!selected) return null;
    return {
      schema: DIDACTIC_ACT_FALLBACK_SCHEMA,
      publicOnly: true,
      mayOverrideProofControl: false,
      sourceAct: actIndex,
      sourceTurn: selected.turn,
      learningSignal: selected.learningSignal,
      recommendedMode: selected.recommendedMode,
      currentObject: selected.currentObject || null,
      exitCondition: selected.exitCondition || null,
      evidence: Array.isArray(selected.evidence) ? selected.evidence.slice(0, 3) : [],
    };
  };

  const shouldCallDirector = (turn, openedScene) => {
    if (acts) return true;
    if (directorCadence === 'turn') return true;
    const releaseDue = unreleasedScheduledThisTurn(turn).length > 0;
    if (directorCadence === 'release') return releaseDue;
    return Boolean(openedScene) || releaseDue;
  };

  const decayedPremiseIds = () =>
    [...grounded.entries()]
      .filter(([, entry]) => entry.decayed)
      .map(([key]) => premiseIdForKey(key))
      .filter(Boolean)
      .sort();

  const groundedPremiseIds = () =>
    validGroundedFacts()
      .map((fact) => premiseIdForKey(factKey(fact)))
      .filter(Boolean)
      .sort();

  const recordLogicSnapshot = (turn, { trajectoryD, forced }) => {
    if (!logicProjectionActive) return;
    const valid = validGroundedFacts();
    const releasedPremiseIds = ledger.map((entry) => entry.premiseId);
    const projection = projectWorldIRLogic(worldIR, {
      groundedFacts: valid,
      voicedFacts: voicedLedger.map((entry) => entry.fact),
      releasedPremiseIds,
      decayedPremiseIds: decayedPremiseIds(),
    });
    logicSnapshots.push({
      turn,
      trajectoryD,
      boardD: derivationDistance(world, valid),
      forced,
      groundedPremiseIds: groundedPremiseIds(),
      releasedPremiseIds,
      decayedPremiseIds: decayedPremiseIds(),
      projection,
    });
  };

  // Strategy-ledger projection for the tutor bridge: current block, blocked
  // modes, live opportunity counters, the applied commitment, and the sealed
  // record of the last closed scene (what the boundary audit reads). All
  // public-only — nothing here names hidden proof state.
  const strategyLedgerView = () => ({
    block: ledgerState.block
      ? {
          index: ledgerState.block.index,
          type: ledgerState.block.type,
          openedTurn: ledgerState.block.openedTurn,
          turns: ledgerState.block.turns,
          heldMode: ledgerState.block.heldMode,
          exitCondition: ledgerState.block.exitCondition,
        }
      : null,
    blockedModes: [...ledgerState.blockedModes],
    budget: {
      context: ledgerState.budget.context,
      currentProofNeutralTutorTurns: ledgerState.budget.currentProofNeutralTutorTurns,
      maxProofNeutralTutorTurns: ledgerState.budget.maxProofNeutralTutorTurns,
      currentProofNeutralLearnerTurns: ledgerState.budget.currentProofNeutralLearnerTurns,
      maxProofNeutralLearnerTurns: ledgerState.budget.maxProofNeutralLearnerTurns,
      exhausted: auditOpportunityCost(ledgerState.budget, { actor: 'tutor', conduct: 'advisory_probe' }).blocked,
    },
    lastClosedScene: lastClosedSceneSummary,
    commitment: ledgerState.appliedCommitment,
    config: {
      maxBlockTurns: ledgerState.config.maxBlockTurns,
      registerPalette: ledgerState.config.registerPalette,
      trialling: ledgerState.config.trialling,
      stancePalette: ledgerState.config.stancePalette,
      releaseIntent: ledgerState.config.releaseIntent,
      planMode: ledgerState.config.planMode,
    },
    // v2: the mechanism history table (public-only), most recent last,
    // capped so the prompt block stays bounded.
    ...(ledgerState.config.trialling
      ? {
          history: ledgerState.history.slice(-6).map((entry) => ({ ...entry })),
          departuresThisScene: ledgerState.departuresThisScene,
        }
      : {}),
  });

  // Stage v2 bounding (header): in acts mode the learner's context is (a) its
  // own theory store and (b) the current act only — prior acts' prose,
  // releases, and voiced theorems drop from view; the theory is the only
  // thing that crosses an act boundary. Hypotheses stay unbounded by design
  // (the learner's own conjectural thread, not staged evidence). The board
  // shown is the BELIEF board: mutation-born false axioms are visible (the
  // learner believes them); fabrications stay invisible, as in v1.
  const learnerView = (turn, releasedThisTurn) => {
    const background = world.background;
    const visibleReleasedFacts = visibleToLearner(
      actState
        ? releasedFacts.filter((fact) => (releasedAtByKey.get(factKey(fact)) ?? 0) >= actState.startTurn)
        : [...releasedFacts],
    );
    const releasedThisTurnVisible = visibleToLearner(releasedThisTurn);
    const grounded = learnerBoardFacts();
    const voiced = voicedLedger
      .filter((entry) => !actState || entry.turn >= actState.startTurn)
      .map((entry) => ({ ...entry }));
    const surfaceFacts = [
      ...background,
      ...visibleReleasedFacts,
      ...releasedThisTurnVisible,
      ...grounded,
      ...voiced.map((entry) => entry.fact),
    ];
    const factSurfaces = learnerFactSurfaces(surfaceFacts);
    // Mirror-refusal payload (concealment-safe by construction): present only
    // while unfired AND evidence incompatible with the mirror is derivable
    // from the learner's OWN grounded record. The cited grounds are the
    // proof-tree BASE facts of the incompatible partner — every one a fact
    // the learner has themselves grounded; the derived conclusion is never
    // named (the stall-watcher's charter-v3 discipline, learner-side).
    const mirrorRefusal = (() => {
      if (!learnerMirrorRefusalConfig || !world.mirror || mirrorRefusalState.fired) return null;
      const mirrorKey = factKey(world.mirror.fact);
      const cl = closure(grounded, world.rules);
      const partnerKeys = (world.incompatible || [])
        .filter((pair) => pair.some((f) => factKey(f) === mirrorKey))
        .map((pair) => pair.find((f) => factKey(f) !== mirrorKey))
        .filter((f) => f && cl.facts.has(factKey(f)))
        .map((f) => factKey(f));
      const groundKeys = new Set();
      for (const pk of partnerKeys) {
        const stack = [pk];
        while (stack.length) {
          const key = stack.pop();
          const proof = cl.proofs.get(key);
          if (!proof) {
            groundKeys.add(key);
            continue;
          }
          for (const prem of proof.premises) stack.push(prem);
        }
      }
      const grounds = grounded
        .filter((fact) => groundKeys.has(factKey(fact)))
        .map((fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact));
      // Real runs: the payload exists only while the window is live (the
      // refusal trigger guards on grounds). Mock runs: emit the mock fields
      // pre-window too — the mock learner voices the mirror instead of
      // insta-asserting the true answer, so a zero-paid run can REACH the
      // window at all (start-of-turn derivability has zero width under the
      // mock's same-turn assertion pace).
      if (!grounds.length && !learnerMirrorRefusalConfig.mock) return null;
      const varIndex = world.questionPattern.findIndex((tok) => typeof tok === 'string' && tok.startsWith('?'));
      return {
        mirrorKey,
        mirrorSurface: String(world.mirror.fact[varIndex] ?? world.mirror.fact[world.mirror.fact.length - 1]),
        grounds,
        ...(learnerMirrorRefusalConfig.mock
          ? {
              mock: learnerMirrorRefusalConfig.mock,
              mockAnswer: String(world.mirror.fact[varIndex] ?? ''),
            }
          : {}),
      };
    })();
    const proxyDagMemory = opts.learnerProxyDag
      ? buildLearnerProxyDagMemory({
          turn,
          questionPattern: world.questionPattern,
          rules: world.rules,
          groundedFacts: grounded,
          voiced,
          hypotheses,
          factSurface: (fact) => factSurfaces[factKey(fact)] || learnerSurfaceForFact(fact),
        })
      : null;
    // Live character arc (§8 open item): public-safe disposition stance for THIS
    // turn, computed engine-side from world.motivation + the learner's held
    // facts. Leak-safe — only levels + a mirror-named stance line cross over.
    const characterArc = opts.characterArc ? buildLearnerCharacterArcView(world, grounded) : null;
    return {
      turn,
      question: world.question,
      questionPattern: world.questionPattern,
      rules: world.rules,
      background,
      // Lemma mirror (symmetry): the learner's own map, computed from their
      // grounded assertions only — pre-rendered so concealment lives in one
      // place (renderLearnerLemmaLines).
      ...(lemmaRun ? { lemmaLayer: lemmaView('learner') } : {}),
      ...(mirrorRefusal ? { mirrorRefusal } : {}),
      releasedFacts: visibleReleasedFacts,
      releasedThisTurn: releasedThisTurnVisible,
      factSurfaces,
      transcript: transcript
        .filter((entry) => (!actState || entry.turn >= actState.startTurn) && publicStageLine(entry))
        .map(({ turn: t, role, text }) => ({ turn: t, role: role === 'director' ? 'stage' : role, text })),
      abox: {
        grounded,
        hypotheses: [...hypotheses],
      },
      voiced,
      ...(proxyDagMemory ? { proxyDagMemory } : {}),
      ...(characterArc ? { characterArc } : {}),
      ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn, brief: actState.brief } } : {}),
      ...(sceneState ? { scene: currentSceneView() } : {}),
      ...(stagePrologue ? { stagePrologue } : {}),
      // Learner-ledger boundary material: the sealed last scene (public-only,
      // and act-bounded — a scene sealed before this act's start stays gone,
      // like everything else across the boundary).
      ...(learnerLedgerActive &&
      lastClosedSceneSummary &&
      (!actState || lastClosedSceneSummary.endTurn >= actState.startTurn)
        ? { lastClosedScene: lastClosedSceneSummary }
        : {}),
      publicRegister: publicRegisterForTurn,
    };
  };

  const actsView = (turn) => ({
    index: actState.index,
    startTurn: actState.startTurn,
    brief: actState.brief,
    turnsThisAct: turn - actState.startTurn,
    minActTurns: acts.minActTurns,
    maxActTurns: acts.maxActTurns,
    closed: actState.history.map((a) => ({ ...a })),
  });

  // Lemma-layer per-turn clearance (criterial: the chainer over the valid
  // grounded board; under decay a lemma can UN-ground and the frontier moves
  // backward — recorded, never judged).
  const refreshLemmaState = (turn) => {
    if (!lemmaRun) return;
    const state = computeLemmaState(lemmaDag, validGroundedFacts(), world.rules);
    for (const node of lemmaDag.nodes) {
      const now = state.groundedKeys.has(node.key);
      const before = lemmaRun.grounded.has(node.key);
      if (now && !before) {
        if (!lemmaRun.clearedAt.has(node.label)) lemmaRun.clearedAt.set(node.label, turn);
        events.push({ turn, type: 'lemma_grounded', detail: node.label });
        if (lemmaRun.active?.key === node.key) {
          events.push({ turn, type: 'lemma_cleared', detail: `active lemma ${node.label} grounded` });
        }
      } else if (!now && before) {
        lemmaRun.regressions.push({ turn, label: node.label });
        events.push({ turn, type: 'lemma_regressed', detail: node.label });
      }
    }
    lemmaRun.grounded = state.groundedKeys;
    lemmaRun.frontier = state.frontier;
    // A grounded active lemma binds nothing sensible: advance to the sole
    // frontier element, or unbind until the next scene-opening choice.
    if (lemmaRun.active && lemmaRun.grounded.has(lemmaRun.active.key)) {
      const next = lemmaRun.frontier.length === 1 ? lemmaDag.byKey.get(lemmaRun.frontier[0]) : null;
      lemmaRun.active = next
        ? { key: next.key, label: next.label, by: 'auto_advance', sceneIndex: sceneState?.index ?? null, turn }
        : null;
      if (next) {
        lemmaRun.choices.push({ turn, label: next.label, by: 'auto_advance' });
        events.push({ turn, type: 'lemma_choice', detail: `${next.label} (auto_advance)` });
      }
    }
  };

  const lemmaStateShape = () => ({
    groundedKeys: lemmaRun.grounded,
    frontier: lemmaRun.frontier,
    goalGrounded: lemmaRun.grounded.has(lemmaDag.goalKey),
  });

  // Stall span since the active lemma was chosen: consecutive trailing
  // trajectory steps with no strict D decrease (the house clock's own
  // arithmetic, detectStall), counted only over turns at/after the pick.
  const lemmaStallSpanSinceActive = () => {
    if (!lemmaRun?.active) return 0;
    let span = 0;
    for (let i = trajectory.length - 1; i > 0; i--) {
      if (trajectory[i].turn < lemmaRun.active.turn) break;
      if (trajectory[i].D < trajectory[i - 1].D) break;
      span++;
    }
    return span;
  };

  const lemmaView = (roleName) => {
    if (!lemmaRun) return null;
    if (roleName === 'learner') {
      return { mirrorLines: renderLearnerLemmaLines(lemmaDag, lemmaStateShape()) };
    }
    if (roleName !== 'tutor') return null;
    const releasedIds = new Set(ledger.map((row) => row.premiseId));
    return {
      config: { ...lemmaConfig },
      tutorLines: renderTutorLemmaLines(lemmaDag, lemmaStateShape(), lemmaRun.active?.key || null, {
        bind: lemmaConfig.bind,
      }),
      proofPremiseIds: [...lemmaDag.proofPremiseIds],
      activeKey: lemmaRun.active?.key || null,
      activeLabel: lemmaRun.active?.label || null,
      stallWindow: world.slope.aporia_window,
      stallSpanSinceActive: lemmaStallSpanSinceActive(),
      regressionsSinceActive: lemmaRun.active
        ? lemmaRun.regressions
            .filter((r) => r.turn >= lemmaRun.active.turn)
            .map((r) => ({ turn: r.turn, label: r.label }))
        : [],
      activeSupportRemaining: lemmaRun.active ? lemmaSupportRemaining(lemmaDag, lemmaRun.active.key, releasedIds) : [],
      frontier: lemmaRun.frontier.map((key) => {
        const node = lemmaDag.byKey.get(key);
        return {
          key,
          label: node.label,
          support: [...node.support],
          supportRemaining: lemmaSupportRemaining(lemmaDag, key, releasedIds),
        };
      }),
    };
  };

  // Register-router decision, once per turn (cached): the Phase-A-audited
  // sensor over the learner's LAST message × criterial DAG state (grounded
  // lemma regression tracked here; mirror-partner derivability from the
  // learner's own record). Mock knobs force sensor/DAG inputs so zero-paid
  // gates exercise both fire paths; the pure rule is unit-tested directly.
  const registerRouterDecision = (turn) => {
    if (!registerRouterState) return null;
    const rr = registerRouterState;
    if (rr.cache.has(turn)) return rr.cache.get(turn);
    const grounded = validGroundedFacts();
    const state = computeLemmaState(rr.dag, grounded, world.rules);
    for (const key of state.groundedKeys) if (!rr.clearedAt.has(key)) rr.clearedAt.set(key, turn);
    const regressedChains = new Set();
    for (const [key] of rr.clearedAt) {
      if (!state.groundedKeys.has(key)) regressedChains.add(rr.chainOf.get(key) || key);
    }
    let partnerDerivable = false;
    if (world.mirror) {
      const mirrorKey = factKey(world.mirror.fact);
      const cl = closure(grounded, world.rules);
      partnerDerivable = (world.incompatible || []).some((pair) => {
        const partner = pair.some((f) => factKey(f) === mirrorKey) ? pair.find((f) => factKey(f) !== mirrorKey) : null;
        return partner ? cl.facts.has(factKey(partner)) : false;
      });
    }
    const lastLearner = [...transcript].reverse().find((e) => e.role === 'learner');
    const sensed = lastLearner
      ? classifyMessage(lastLearner.text, rr.lexicons, rr.mirrorTerm)
      : { label: 'neither', score: 0 };
    const label = registerRouterConfig.mockLabel || sensed.label;
    const dag = registerRouterConfig.mockDagState
      ? {
          partnerDerivable: true,
          regressedChains: new Set(rr.dag.nodes.filter((n) => !n.isGoal).map((n) => rr.chainOf.get(n.key))),
        }
      : { partnerDerivable, regressedChains };
    const register = decideRegister({
      label,
      partnerDerivable: dag.partnerDerivable,
      regressedChains: dag.regressedChains,
      chainOf: rr.chainOf,
    });
    const decision = {
      turn,
      label,
      sensedLabel: sensed.label,
      partnerDerivable: dag.partnerDerivable,
      regressedChains: [...dag.regressedChains],
      register,
      ...(REGISTER_BLOCKS[register] ? { block: REGISTER_BLOCKS[register] } : {}),
    };
    rr.decisions.push(decision);
    if (register !== 'didactic') events.push({ turn, type: 'register_shift', detail: `${register} (${label})` });
    rr.cache.set(turn, decision);
    return decision;
  };

  const omniscientView = (turn, roleName) => {
    const proofDebt = roleName === 'tutor' && proofDebtViewActive ? currentProofDebt(turn) : null;
    const proxyDagPacing =
      opts.proxyDagPacing && (roleName === 'director' || (roleName === 'tutor' && !actState))
        ? currentProxyDagPacing(turn, roleName)
        : null;
    const tutorLearnerDagModel =
      opts.tutorLearnerDag && roleName === 'tutor' && !actState ? currentTutorLearnerDagModel(turn, roleName) : null;
    const fieldPlanner =
      fieldPlannerActive && roleName === 'tutor' && !actState ? currentFieldPlanner(turn, roleName) : null;
    const fieldReportContext =
      fieldReportContextActive && roleName === 'tutor' && !actState ? currentFieldReportContext(turn) : null;
    const conductTriggerOverride =
      roleName === 'tutor' && (conductPolicyActive || conductPolicyEnforceActive)
        ? conductTriggerOverrides.find((trigger) => Number(trigger?.turn) === turn) || null
        : null;
    const conductEntitlement =
      roleName === 'tutor' && (conductPolicyActive || conductPolicyEnforceActive)
        ? { canAssertFinal: entails(validGroundedFacts(), world.rules, world.secret.fact) }
        : null;
    const base = {
      turn,
      role: roleName,
      world,
      ledger: [...ledger],
      releasedFacts: [...releasedFacts],
      transcript: [...transcript],
      staging: { phase: staging.phase },
      ...(actState ? { acts: actsView(turn) } : {}),
      ...(sceneState ? { scene: currentSceneView() } : {}),
      ...(stagePrologue ? { stagePrologue } : {}),
      publicRegister: publicRegisterForTurn,
      ...(proxyDagPacing ? { proxyDagPacing } : {}),
      ...(tutorLearnerDagModel ? { tutorLearnerDagModel } : {}),
      ...(fieldPlanner ? { fieldPlanner } : {}),
      ...(fieldReportContext ? { fieldReportContext } : {}),
      ...(conductEntitlement ? { conductEntitlement } : {}),
      ...(conductTriggerOverride ? { conductTriggerOverride } : {}),
      ...(ledgerState && roleName === 'tutor' ? { strategyLedger: strategyLedgerView() } : {}),
      ...(lemmaRun && roleName === 'tutor' ? { lemmaLayer: lemmaView('tutor') } : {}),
      ...(registerRouterState && roleName === 'tutor' ? { registerRouter: registerRouterDecision(turn) } : {}),
      ...(proofDebt
        ? { proofDebt: runtimeMonitor ? runtimeMonitor.proofDebtTutorView(proofDebt) : tutorProofDebtView(proofDebt) }
        : {}),
    };
    // Stage v2 redaction (header): in acts mode the TUTOR's blindness is
    // total and structural, in both probe arms — no learner store, no
    // corruption ledger, no frontier or trajectory (each is computed FROM
    // the hidden store and would leak decay as deltas). The tutor works from
    // the dialogue and its own release ledger; reconstruction is its job,
    // not its input.
    if (actState && roleName === 'tutor') return base;
    return {
      ...base,
      trajectory: [...trajectory],
      // The director keeps its evaluative instruments (it must judge an
      // act's work done — that IS board movement) but in acts mode loses the
      // store dump: its briefs open acts in front of the tutor, so they must
      // not be able to name what only the hidden board could tell it.
      learnerAbox:
        actState && roleName === 'director'
          ? { groundedCount: validGroundedFacts().length, hypotheses: [...hypotheses] }
          : {
              grounded: validGroundedFacts(),
              hypotheses: [...hypotheses],
            },
      inference: {
        frontier: computeFrontier(turn),
        voiced: voicedLedger.map((entry) => ({ ...entry })),
        overreachCount: overreaches.length,
      },
      // v1 visibility: world-side roles read the corruption ground truth (the
      // harness owns what was lost and when). Acts mode strips it from the
      // director too — slip identities must not reach the stage through a
      // brief. Outside acts mode this block is what the told arm reads.
      ...(corruption && !actState
        ? {
            corruption: {
              decayed: [...grounded.entries()]
                .filter(([, entry]) => entry.decayed)
                .map(([key, entry]) => ({
                  premiseId: premiseIdForKey(key),
                  fact: entry.fact,
                  sinceTurn: entry.decayTurn,
                })),
              ledger: corruption.ledger.map((e) => ({ ...e })),
            },
          }
        : {}),
    };
  };

  recordAvailability(0); // background-only board may already yield derivations
  const prologue = await createDramaStagePrologue({
    enabled: stagePrologueEnabled,
    director: roles.director,
    world,
    publicRegister: publicRegisterForTurn,
    groundedFacts: validGroundedFacts(),
    inferenceFrontier: computeFrontier(0),
  });
  if (prologue) {
    stagePrologue = prologue.prologue;
    transcript.push(prologue.transcriptLine);
  }
  const turnLimit = resolveDramaTurnLimit(world, opts);
  let turn = 0;
  while (turn < turnLimit && !endedBy) {
    turn += 1;
    const releasedThisTurn = [];
    const openedScene = openSceneForTurn(turn, turn === 1 ? 'opening' : 'continuation');
    refreshLemmaState(turn);
    if (lemmaRun && lemmaConfig.bind && openedScene) {
      lemmaRun.openings += 1;
      if (lemmaRun.frontier.length > 1) lemmaRun.multiFrontierOpenings += 1;
    }
    sceneRecognitionNeedThisTurn = selectSceneRecognitionNeedForTurn();
    sceneTempoThisTurn = selectSceneTempoForTurn(turn);
    const sceneMetaThisTurn = currentSceneMeta();

    // --- director ---
    const { directorView } = await runDirectorTransition({
      turn,
      openedScene,
      role: roles.director,
      shouldCallDirector,
      buildView: omniscientView,
      proxyDagPacingRows,
      applyRelease,
      releasedThisTurn,
      lemmaRun,
      lemmaConfig,
      lemmaDag,
      events,
      actState,
      acts,
      staging,
      didacticFallbackForAct,
      sceneMeta: sceneMetaThisTurn,
      publicRegister: publicRegisterForTurn,
      transcript,
    });

    // --- tutor ---
    const tutorTransition = await runTutorTransition({
      runState,
      world,
      turn,
      role: roles.tutor,
      buildView: omniscientView,
      currentProofDebt,
      applyRelease,
      releasedThisTurn,
      sceneState,
      sceneMeta: sceneMetaThisTurn,
      sceneTempo: sceneTempoThisTurn,
      publicRegister: publicRegisterForTurn,
      premiseIdForKey,
      plotAuditDetail,
      learnerTransformationRow,
    });
    const { tutorView, tutorOut, tutorRelease, fieldPlannerRow } = tutorTransition;
    publicRegisterForTurn = tutorTransition.publicRegister;

    // Runtime anti-reveal guard (plotLint should make this unreachable).
    if (turn < world.slope.t_min && entails([...world.background, ...releasedFacts], world.rules, world.secret.fact)) {
      events.push({ turn, type: 'leak', detail: 'released closure forces S before t_min' });
      if (opts.stopOnLeak) {
        endedBy = 'leak';
        break;
      }
    }

    // --- learner ---
    const learnerTransition = await runLearnerTransition({
      runState,
      world,
      turn,
      role: roles.learner,
      buildView: learnerView,
      releasedThisTurn,
      sceneState,
      sceneMeta: sceneMetaThisTurn,
      sceneTempo: sceneTempoThisTurn,
      publicRegister: publicRegisterForTurn,
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
    });
    const { learnerOut, deriveOutcomes, forced, D, F, sceneExchange, postLearnerTransformation } = learnerTransition;
    firstForcedTurn = learnerTransition.firstForcedTurn;
    assertedGroundedTurn = learnerTransition.assertedGroundedTurn;
    endedBy = learnerTransition.endedBy;

    let closedScene = null;
    if (sceneConfig && sceneState && sceneExchange) {
      const updated = updateScene(sceneState, sceneExchange, { turn, dNow: D, forced, endedBy, config: sceneConfig });
      sceneState = updated.scene;
      if (updated.closed) {
        closedScene = updated.closed;
        sceneRows.push(closedScene);
        events.push({
          turn,
          type: 'scene_close',
          detail: `scene ${closedScene.index} closed: ${closedScene.status} (${closedScene.closeReason})`,
        });
        // Seal the scene for the boundary audits (either ledger dial): a
        // public-only record — exchange types, counts, releases and schedule
        // entries within the span (both already tutor-known), last learner
        // line. The bridges audit against this at the next scene opening.
        if (ledgerState || learnerLedgerActive) {
          const span = (row) => row.turn >= closedScene.startTurn && row.turn <= closedScene.endTurn;
          const learnerLines = transcript.filter((entry) => entry.role === 'learner' && span(entry));
          lastClosedSceneSummary = {
            index: closedScene.index,
            startTurn: closedScene.startTurn,
            endTurn: closedScene.endTurn,
            status: closedScene.status,
            closeReason: closedScene.closeReason,
            counts: { ...closedScene.counts },
            exchanges: closedScene.exchanges.map((e) => ({
              turn: e.turn,
              type: e.type,
              formalActions: e.formalActions,
            })),
            lastLearnerText: learnerLines.length ? learnerLines[learnerLines.length - 1].text : '',
            lastExchangeType: closedScene.exchanges.length
              ? closedScene.exchanges[closedScene.exchanges.length - 1].type
              : null,
            releases: ledger.filter(span).map((entry) => ({ turn: entry.turn, premiseId: entry.premiseId })),
            scheduled: world.releaseSchedule
              .filter((entry) => entry.turn >= closedScene.startTurn && entry.turn <= closedScene.endTurn)
              .map((entry) => ({ turn: entry.turn, premise: entry.premise })),
            didacticModes: didacticModeRows.filter(span).map((row) => row.recommendedMode),
            registerHeld: true,
            ...(ledgerState?.config.trialling ? { departures: ledgerState.departuresThisScene } : {}),
          };
        }
        // v2 (trialling): the two-gate close. Gate one — was the assigned
        // stance actually instantiated (the landed registerStanceFidelity
        // gate, per tutor line in the span)? Then the public-only mechanism
        // history entry; the audit and review attach at the next opening.
        if (ledgerState?.config.trialling && ledgerState.appliedCommitment) {
          const span = (row) => row.turn >= closedScene.startTurn && row.turn <= closedScene.endTurn;
          const tutorLines = transcript
            .filter((entry) => entry.role === 'tutor' && span(entry))
            .map((entry) => entry.text || '');
          const learnerLinesInSpan = transcript
            .filter((entry) => entry.role === 'learner' && span(entry))
            .map((entry) => entry.text || '');
          const fidelity = ledgerState.appliedCommitment.stance
            ? sceneStanceFidelity({
                stance: ledgerState.appliedCommitment.stance,
                tutorLines,
                learnerLines: learnerLinesInSpan,
              })
            : null;
          if (fidelity) {
            lastClosedSceneSummary = { ...lastClosedSceneSummary, stanceFidelity: { label: fidelity.label } };
            events.push({
              turn,
              type: 'stance_fidelity',
              detail: `scene ${closedScene.index} stance ${ledgerState.appliedCommitment.stance}: ${fidelity.label}`,
            });
          }
          const historyEntry = buildMechanismHistoryEntry({
            sceneRecord: lastClosedSceneSummary,
            commitment: ledgerState.appliedCommitment,
            fidelity,
          });
          if (historyEntry) ledgerState.history.push(historyEntry);
        }
        // Scene exit under the strategy ledger: revert a scene-committed
        // register to the run baseline, clear the applied commitment, and
        // reset the opportunity counters (the documented on_scene_exit
        // policy).
        if (ledgerState) {
          if (ledgerState.appliedCommitment?.register && publicRegisterForTurn !== baseRegisterForRun) {
            publicRegisterForTurn = baseRegisterForRun;
            registerRows.push({ turn, register: baseRegisterForRun, scope: 'scene_end', scene: closedScene.index });
          }
          ledgerState.appliedCommitment = null;
          ledgerState.budget = deriveOpportunityCostBudget({ scope: 'dialogue_block' });
          ledgerState.departuresThisScene = 0;
        }
      }
    }

    // --- stall detection ---
    const firstReleaseTurn = ledger.length > 0 ? ledger[0].turn : Infinity;
    const stall = detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn);
    if (stall && !events.some((e) => e.type === stall)) {
      events.push({ turn, type: stall, detail: `no progress over ${world.slope.aporia_window} turns` });
      if (opts.stopOnStall) endedBy = stall;
    }

    // --- decay draw (end of turn, after the learner has acted) ---
    // One PRNG draw per eligible entry per turn, in board insertion order, so
    // the corruption schedule is a pure function of (seed, role outputs).
    // Decayed facts vanish from next turn's views and from D(t): the drama
    // can move BACKWARD, which is the point of the condition.
    const decayedNow = [];
    if (corruption && !endedBy && turn >= corruption.config.startTurn) {
      const active = [...grounded.values()].filter((entry) => entry.decayed).length;
      const eligible = [];
      for (const [key, entry] of grounded) {
        if (!entry.valid || entry.decayed) continue;
        if (!releasedKeys.has(key)) continue; // background is immune — released premises are the experimental material
        const since = entry.regroundedTurn ?? entry.turn;
        if (turn - since < corruption.config.graceTurns) continue;
        eligible.push([key, entry]);
      }
      // Every eligible entry gets its draw (the draw count never depends on
      // earlier hits); maxConcurrent then caps how many hits land.
      const hits = eligible.filter(() => corruption.rng() < corruption.config.rate);
      for (const [key, entry] of hits.slice(0, Math.max(0, corruption.config.maxConcurrent - active))) {
        entry.decayed = true;
        entry.decayTurn = turn;
        const premiseId = premiseIdForKey(key);
        // Mutation mode (stage v2): the extra mode/pick draws happen ONLY
        // when mutateShare > 0, so the default stream is byte-identical to
        // v1. A mutate hit is formally a deletion (the victim decays exactly
        // as above) PLUS a false belief: the misremembered form lands on the
        // board invalid-but-believed until the learner retracts it. Delete
        // ledger rows keep the exact v1 shape; mutate rows add mode/falseForm.
        let falseForm = null;
        if (corruption.config.mutateShare > 0 && corruption.rng() < corruption.config.mutateShare) {
          const candidates = mutationCandidates(entry.fact);
          if (candidates.length) {
            falseForm = candidates[Math.floor(corruption.rng() * candidates.length)];
          }
        }
        if (falseForm) {
          grounded.set(factKey(falseForm), {
            fact: falseForm,
            turn,
            valid: false,
            mutatedFalse: true,
            mutationOf: key,
          });
          corruption.ledger.push({ turn, type: 'decay', mode: 'mutate', premiseId, fact: entry.fact, falseForm });
          events.push({
            turn,
            type: 'decay',
            detail: `${premiseId || renderFact(entry.fact)} slips — misremembered as "${renderFact(falseForm)}"`,
          });
        } else {
          corruption.ledger.push({ turn, type: 'decay', premiseId, fact: entry.fact });
          events.push({
            turn,
            type: 'decay',
            detail: `${premiseId || renderFact(entry.fact)} slips from the learner's board`,
          });
        }
        decayedNow.push(premiseId || renderFact(entry.fact));
      }
    }

    recordLogicSnapshot(turn, { trajectoryD: D, forced });

    // --- live status hook (the attended shell watches the drama through this) ---
    options.onTurn?.({
      turn,
      turnCap: world.turnCap,
      D,
      forced,
      lines: transcript.filter((entry) => entry.turn === turn),
      released: [...releasedThisTurn],
      adopted: (learnerOut.adopt || []).length,
      retracted: (learnerOut.retract || []).length,
      derived: deriveOutcomes.filter((o) => o.status === 'voiced').length,
      overreached: deriveOutcomes.filter((o) => o.status === 'overreach').length,
      hypothesis: Boolean(learnerOut.hypothesis),
      asserted: Boolean(learnerOut.asserts),
      ...(learnerOut.learnerDrift
        ? {
            learnerDrift: {
              mode: learnerOut.learnerDrift.mode || null,
              pressure: learnerOut.learnerDrift.pressure || null,
              mayOverrideProofControl: learnerOut.learnerDrift.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(tutorOut.learnerTransformation
        ? {
            learnerTransformation: {
              status: tutorOut.learnerTransformation.status || null,
              complete: tutorOut.learnerTransformation.complete === true,
              ownershipLevel: tutorOut.learnerTransformation.ownership?.ownershipLevel || null,
              missingFamilies: tutorOut.learnerTransformation.missingFamilies || [],
              lateOwnershipCheck: tutorOut.learnerTransformation.lateOwnershipCheck === true,
              mayOverrideProofControl: tutorOut.learnerTransformation.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(postLearnerTransformation
        ? {
            learnerTransformationPost: {
              status: postLearnerTransformation.status || null,
              complete: postLearnerTransformation.complete === true,
              ownershipLevel: postLearnerTransformation.ownership?.ownershipLevel || null,
              missingFamilies: postLearnerTransformation.missingFamilies || [],
              lateOwnershipCheck: postLearnerTransformation.lateOwnershipCheck === true,
              mayOverrideProofControl: postLearnerTransformation.mayOverrideProofControl === true,
            },
          }
        : {}),
      ...(sceneConfig
        ? {
            exchange: sceneExchange,
            scene: sceneState ? currentSceneView() : null,
            closedScene: closedScene
              ? {
                  index: closedScene.index,
                  status: closedScene.status,
                  closeReason: closedScene.closeReason,
                  turns: [closedScene.startTurn, closedScene.endTurn],
                }
              : null,
          }
        : {}),
      intervened: Boolean(tutorOut.deliberation?.intervened),
      phase: staging.phase ? { ...staging.phase } : null,
      events: events.filter((e) => e.turn === turn).map(({ type, detail }) => ({ type, detail })),
      ...(corruption
        ? {
            decayedNow,
            repairedNow: corruption.ledger
              .filter((e) => e.type === 'repair' && e.turn === turn)
              .map((e) => e.premiseId),
            decayActive: [...grounded.values()].filter((entry) => entry.decayed).length,
            F,
          }
        : {}),
      ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn } } : {}),
      ...(ledgerState
        ? {
            strategyLedger: {
              block: ledgerState.block
                ? {
                    index: ledgerState.block.index,
                    type: ledgerState.block.type,
                    heldMode: ledgerState.block.heldMode,
                    turns: ledgerState.block.turns,
                  }
                : null,
              ...(tutorOut.sceneCommitment
                ? {
                    commitment: {
                      register: tutorOut.sceneCommitment.register || null,
                      didacticDefault: tutorOut.sceneCommitment.didacticDefault || null,
                      releasePosture: tutorOut.sceneCommitment.releasePosture || null,
                      recognitionBudget: tutorOut.sceneCommitment.recognitionBudget ?? null,
                    },
                  }
                : {}),
              ...(tutorOut.sceneCommitmentAudit
                ? {
                    audit: {
                      sceneIndex: tutorOut.sceneCommitmentAudit.sceneIndex,
                      summary: tutorOut.sceneCommitmentAudit.summary,
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(learnerLedgerActive && (learnerOut.sceneIntent || learnerOut.actCarry)
        ? {
            learnerLedger: {
              ...(learnerOut.sceneIntent ? { intent: learnerOut.sceneIntent } : {}),
              ...(learnerOut.actCarry ? { carry: learnerOut.actCarry } : {}),
            },
          }
        : {}),
      ...(tutorOut.didacticMode
        ? {
            didacticMode: {
              learningSignal: tutorOut.didacticMode.learningSignal || null,
              recommendedMode: tutorOut.didacticMode.recommendedMode || null,
              scope: tutorOut.didacticMode.scope || null,
              currentObject: tutorOut.didacticMode.currentObject || null,
            },
          }
        : {}),
      ...(fieldPlannerRow
        ? {
            fieldPlanner: {
              selectedMoveFamily: fieldPlannerRow.selectedMoveFamily,
              reasonCode: fieldPlannerRow.reasonCode,
              targetPremise: fieldPlannerRow.targetPremise,
              didacticMode: fieldPlannerRow.didacticMode?.recommendedMode || null,
              efficacy: fieldPlannerRow.outcome?.efficacy || null,
              projectionAlignment: fieldPlannerRow.outcome?.projectionAlignment || null,
              selectedScore: fieldPlannerRow.projection?.selected?.score ?? null,
            },
          }
        : {}),
      ...(tutorOut.castState
        ? {
            castState: {
              tutor: {
                role: tutorOut.castState.tutor?.stableRole || null,
                currentStance: tutorOut.castState.tutor?.currentStance || null,
              },
              learner: {
                role: tutorOut.castState.learner?.stableRole || null,
                posture: tutorOut.castState.learner?.currentPosture || null,
              },
              relation: {
                currentTrust: tutorOut.castState.relation?.currentTrust || null,
              },
            },
          }
        : {}),
      ...(tutorOut.tutorReinvention
        ? {
            tutorReinvention: {
              active: tutorOut.tutorReinvention.active === true,
              trigger: tutorOut.tutorReinvention.trigger || null,
              toStance: tutorOut.tutorReinvention.toStance || null,
              mayOverrideProofControl: tutorOut.tutorReinvention.mayOverrideProofControl === true,
            },
          }
        : {}),
      publicRegister: publicRegisterForTurn,
      tutorLearnerDagModel: tutorView.tutorLearnerDagModel || null,
      proxyDagPacing: tutorView.proxyDagPacing || directorView.proxyDagPacing || null,
      endedBy,
    });
  }

  await finalizeDramaRunLifecycle({
    runState,
    sceneState,
    turn,
    endedBy,
    tutor: roles.tutor,
    didacticFallbackForAct,
    plotAuditDetail,
  });

  // Final lemma refresh: clearances that land on the closing turn (the goal
  // itself, most of all) happen after that turn's start-of-turn refresh.
  if (lemmaRun) refreshLemmaState(turn);
  return buildDramaRunResult({
    runState,
    world,
    turn,
    endedBy,
    firstForcedTurn,
    assertedGroundedTurn,
    stagePrologue,
    validGroundedFacts: validGroundedFacts(),
    frontierFinal: computeFrontier(turn),
    premiseIdForKey,
  });
}

// One-line tally for plot_audit events: a verdict outside the contract
// counts as unscored rather than crashing the event log.
function plotAuditDetail(audit, suffix = '') {
  const mix = { kept: 0, justified_deviation: 0, drift: 0, unscored: 0 };
  for (const c of audit.clauses || []) {
    mix[Object.hasOwn(mix, c.verdict) ? c.verdict : 'unscored'] += 1;
  }
  return (
    `act ${audit.act} plot audited${suffix}: kept ${mix.kept}, justified ${mix.justified_deviation}, ` +
    `drift ${mix.drift}${mix.unscored ? `, unscored ${mix.unscored}` : ''}` +
    (audit.arc ? `; arc ${audit.arc.verdict}` : '') +
    (audit.throughlineAudit?.length ? `; throughline reckoned (${audit.throughlineAudit.length} clauses)` : '')
  );
}
