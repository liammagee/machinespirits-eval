/**
 * The drama engine: turn loop, role-scoped views, release ledger, slope
 * trajectory, failure taxonomy (notes/dramatic-derivation-plan.md §2–§3).
 *
 * Roles are injected async functions (mock now, LLM-backed later — same
 * seam as services/adaptiveTutor's mock/real split):
 *   director(view) -> { direction, release?: premiseId,
 *                       phase?: {name, intent} }  // declare/replace the current movement
 *   tutor(view)    -> { dialogue, move?: {figure,targetPremise,intent}, release?: premiseId,
 *                       deliberation?: {draftFigure, intervened, diagnosis, note} }
 *   learner(view)  -> { dialogue, adopt?: fact[], retract?: fact[],
 *                       hypothesis?: string, asserts?: fact }
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

import { closure, entails, factKey, proofTree } from './chainer.js';
import { derivationDistance, detectStall } from './slope.js';

function renderFact(fact) {
  return fact.join(' ');
}

export async function runDrama({ world, roles, options = {} }) {
  const opts = {
    stopOnStall: true,
    stopOnLeak: true,
    recognitionGrace: 3,
    ...options,
  };
  const ledger = []; // {turn, premiseId, via}
  const releasedKeys = new Set();
  const releasedFacts = [];
  const backgroundKeys = new Set(world.background.map(factKey));

  const grounded = new Map(); // key -> {fact, turn, valid}
  for (const fact of world.background) {
    grounded.set(factKey(fact), { fact, turn: 0, valid: true });
  }
  const hypotheses = []; // {turn, text}

  const transcript = [];
  const trajectory = []; // {turn, D, forced, groundedCount}
  const events = []; // {turn, type, detail}
  // Director-declared staging: the current movement persists until replaced.
  // The learner never sees it; since 2026-06-10 the tutor doesn't either —
  // movements are diagnostic dramaturgy, read only by the instruments.
  const staging = { phase: null };
  let firstForcedTurn = null;
  let assertedGroundedTurn = null;
  let endedBy = null;

  const validGroundedFacts = () => [...grounded.values()].filter((entry) => entry.valid).map((entry) => entry.fact);

  const applyRelease = (turn, premiseId, via) => {
    if (!premiseId) return null;
    const premise = world.premiseById.get(premiseId);
    if (!premise || releasedKeys.has(factKey(premise.fact))) return null;
    releasedKeys.add(factKey(premise.fact));
    releasedFacts.push(premise.fact);
    ledger.push({ turn, premiseId, via });
    return premise.fact;
  };

  const learnerView = (turn, releasedThisTurn) => ({
    turn,
    question: world.question,
    questionPattern: world.questionPattern,
    rules: world.rules,
    background: world.background,
    releasedFacts: [...releasedFacts],
    releasedThisTurn,
    transcript: transcript.map(({ turn: t, role, text }) => ({ turn: t, role, text })),
    abox: {
      grounded: validGroundedFacts(),
      hypotheses: [...hypotheses],
    },
  });

  const omniscientView = (turn, roleName) => ({
    turn,
    role: roleName,
    world,
    ledger: [...ledger],
    releasedFacts: [...releasedFacts],
    transcript: [...transcript],
    trajectory: [...trajectory],
    staging: { phase: staging.phase },
    learnerAbox: {
      grounded: validGroundedFacts(),
      hypotheses: [...hypotheses],
    },
  });

  let turn = 0;
  while (turn < world.turnCap && !endedBy) {
    turn += 1;
    const releasedThisTurn = [];

    // --- director ---
    const directorOut = (await roles.director(omniscientView(turn, 'director'))) || {};
    const directorRelease = applyRelease(turn, directorOut.release, 'director');
    if (directorRelease) releasedThisTurn.push(directorRelease);
    if (directorOut.phase && typeof directorOut.phase.name === 'string' && directorOut.phase.name.trim()) {
      staging.phase = {
        name: directorOut.phase.name.trim(),
        intent: typeof directorOut.phase.intent === 'string' ? directorOut.phase.intent.trim() : '',
        turn,
      };
    }
    transcript.push({
      turn,
      role: 'director',
      text: directorOut.direction || '',
      meta: {
        release: directorOut.release || null,
        phase: staging.phase && staging.phase.turn === turn ? { ...staging.phase } : null,
      },
    });

    // --- tutor ---
    const tutorOut = (await roles.tutor(omniscientView(turn, 'tutor'))) || {};
    const tutorRelease = applyRelease(turn, tutorOut.release, 'tutor');
    if (tutorRelease) releasedThisTurn.push(tutorRelease);
    transcript.push({
      turn,
      role: 'tutor',
      text: tutorOut.dialogue || '',
      meta: {
        move: tutorOut.move || null,
        release: tutorOut.release || null,
        deliberation: tutorOut.deliberation || null,
      },
    });

    // Runtime anti-reveal guard (plotLint should make this unreachable).
    if (turn < world.slope.t_min && entails([...world.background, ...releasedFacts], world.rules, world.secret.fact)) {
      events.push({ turn, type: 'leak', detail: 'released closure forces S before t_min' });
      if (opts.stopOnLeak) {
        endedBy = 'leak';
        break;
      }
    }

    // --- learner ---
    const learnerOut = (await roles.learner(learnerView(turn, releasedThisTurn))) || {};
    for (const fact of learnerOut.retract || []) {
      grounded.delete(factKey(fact));
    }
    for (const fact of learnerOut.adopt || []) {
      const key = factKey(fact);
      if (grounded.has(key)) continue;
      const valid = releasedKeys.has(key) || backgroundKeys.has(key);
      grounded.set(key, { fact, turn, valid });
      if (!valid) {
        events.push({ turn, type: 'fabricated_fact', detail: renderFact(fact) });
      }
    }
    if (learnerOut.hypothesis) {
      hypotheses.push({ turn, text: learnerOut.hypothesis });
    }
    transcript.push({
      turn,
      role: 'learner',
      text: learnerOut.dialogue || '',
      meta: {
        adopt: learnerOut.adopt || [],
        retract: learnerOut.retract || [],
        hypothesis: learnerOut.hypothesis || null,
        asserts: learnerOut.asserts || null,
      },
    });

    // --- instrumentation ---
    const valid = validGroundedFacts();
    const forced = entails(valid, world.rules, world.secret.fact);
    if (forced && firstForcedTurn === null) {
      firstForcedTurn = turn;
      events.push({ turn, type: 'forced', detail: 'learner facts now force S' });
    }
    const D = derivationDistance(world, valid);
    trajectory.push({ turn, D, forced, groundedCount: valid.length });

    for (const [a, b] of world.incompatible) {
      const cl = closure(valid, world.rules).facts;
      if (cl.has(factKey(a)) && cl.has(factKey(b))) {
        if (!events.some((e) => e.type === 'inconsistency')) {
          events.push({
            turn,
            type: 'inconsistency',
            detail: `${renderFact(a)} vs ${renderFact(b)}`,
          });
        }
      }
    }

    // --- assertion handling ---
    if (learnerOut.asserts) {
      const assertedKey = factKey(learnerOut.asserts);
      if (assertedKey === factKey(world.secret.fact)) {
        if (forced) {
          assertedGroundedTurn = turn;
          events.push({ turn, type: 'grounded_anagnorisis', detail: world.secret.surface });
          endedBy = 'grounded_anagnorisis';
        } else {
          events.push({ turn, type: 'lucky_leap', detail: 'asserted S unforced' });
        }
      } else if (world.mirror && assertedKey === factKey(world.mirror.fact)) {
        events.push({ turn, type: 'mirror', detail: renderFact(world.mirror.fact) });
      } else {
        events.push({ turn, type: 'wrong_assertion', detail: renderFact(learnerOut.asserts) });
      }
    }

    // --- unstaged recognition (forced but never asserted, past grace) ---
    if (
      firstForcedTurn !== null &&
      assertedGroundedTurn === null &&
      turn - firstForcedTurn >= opts.recognitionGrace &&
      !events.some((e) => e.type === 'unstaged_recognition')
    ) {
      events.push({ turn, type: 'unstaged_recognition', detail: 'forced, not asserted' });
    }

    // --- stall detection ---
    const firstReleaseTurn = ledger.length > 0 ? ledger[0].turn : Infinity;
    const stall = detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn);
    if (stall && !events.some((e) => e.type === stall)) {
      events.push({ turn, type: stall, detail: `no progress over ${world.slope.aporia_window} turns` });
      if (opts.stopOnStall) endedBy = stall;
    }

    // --- live status hook (the attended shell watches the drama through this) ---
    options.onTurn?.({
      turn,
      turnCap: world.turnCap,
      D,
      forced,
      released: [...releasedThisTurn],
      adopted: (learnerOut.adopt || []).length,
      retracted: (learnerOut.retract || []).length,
      hypothesis: Boolean(learnerOut.hypothesis),
      asserted: Boolean(learnerOut.asserts),
      intervened: Boolean(tutorOut.deliberation?.intervened),
      phase: staging.phase ? { ...staging.phase } : null,
      events: events.filter((e) => e.turn === turn).map(({ type, detail }) => ({ type, detail })),
      endedBy,
    });
  }

  const verdict = resolveVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn });
  const proof = assertedGroundedTurn !== null ? proofTree(validGroundedFacts(), world.rules, world.secret.fact) : null;

  return {
    worldId: world.id,
    verdict,
    events,
    trajectory,
    transcript,
    ledger,
    firstForcedTurn,
    assertedGroundedTurn,
    turnsPlayed: turn,
    proof,
  };
}

function resolveVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn }) {
  if (endedBy === 'grounded_anagnorisis') return 'grounded_anagnorisis';
  if (endedBy === 'leak') return 'leak';
  if (firstForcedTurn !== null && assertedGroundedTurn === null) return 'unstaged_recognition';
  if (events.some((e) => e.type === 'mirror')) return 'mirror';
  if (endedBy === 'aporia' || endedBy === 'disengagement') return endedBy;
  if (events.some((e) => e.type === 'aporia')) return 'aporia';
  if (events.some((e) => e.type === 'disengagement')) return 'disengagement';
  if (events.some((e) => e.type === 'lucky_leap')) return 'lucky_leap_only';
  return 'cap_reached';
}
