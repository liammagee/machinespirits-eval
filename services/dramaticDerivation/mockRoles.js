/**
 * Deterministic mock roles for the staging-loop plumbing (phase 1 step 1 of
 * notes/dramatic-derivation-plan.md §3). No model calls anywhere.
 *
 * Director and tutor legitimately close over the world (they hold the plot
 * and the secret). The LEARNER factory takes no world argument at all — it
 * acts only on its view, which is how the single-concealment invariant
 * stays testable. The lucky-leap / mirror simulators receive their guess
 * fact explicitly via policy (the operator simulating a guesser), never by
 * peeking at the world.
 */

import { closure, factKey, matchPattern } from './chainer.js';

const FIGURES = ['erotema', 'analogia', 'exemplum', 'anaphora'];

/**
 * @param {object} policy
 *   endActAt   array of turns at which the mock returns {act:'end'} with a
 *              strategic direction (stage v2 acts-mode choreography for the
 *              boundary-guard tests; default none, so the no-policy director
 *              is byte-stable with its old self)
 */
export function makeMockDirector(world, policy = {}) {
  const endActAt = new Set(policy.endActAt || []);
  const director = async (view) => {
    const act = endActAt.has(view.turn) ? 'end' : 'continue';
    const entry = world.releaseSchedule.find((e) => e.turn === view.turn && e.via === 'director');
    if (entry) {
      const fact = world.premiseById.get(entry.premise).fact;
      return {
        direction: `[The scene turns: it comes to light that ${fact.join(' ')}.]`,
        release: entry.premise,
        ...(endActAt.size ? { act } : {}),
      };
    }
    if (act === 'end') {
      return {
        direction: `[The act closes on turn ${view.turn}; press the chain one link further.]`,
        release: null,
        act,
      };
    }
    return {
      direction: `[Turn ${view.turn}. The question hangs in the air: ${world.question}]`,
      release: null,
      ...(endActAt.size ? { act } : {}),
    };
  };
  director.prologue = async () => ({
    stageNotes: `[Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}]`,
    tutorCharacter: 'The tutor enters as a patient dramaturg of evidence, careful not to outrun the learner.',
    learnerCharacter: 'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
    registerNote: 'Any period color should be adjusted to these public characters, never to hidden proof structure.',
  });
  return director;
}

/**
 * @param {object} policy
 *   repairDecayed   when the decay condition is on and the view shows slipped
 *                   premises, target the oldest one (the deterministic repair
 *                   choreography for the corruption tests; default false so
 *                   the no-policy tutor is byte-stable with its old self)
 *   reconstruct     emit a credulous per-turn `theory` (everything staged is
 *                   believed held) — plumbing-grade reconstruction for the
 *                   stage-v2 recording tests; sharper theories belong to
 *                   inline test roles
 */
export function makeMockTutor(world, policy = {}) {
  return async (view) => {
    const figure = FIGURES[(view.turn - 1) % FIGURES.length];
    const theory = policy.reconstruct
      ? {
          believed_held: view.ledger.map((e) => e.premiseId),
          believed_missing: [],
          believed_mistaken: [],
        }
      : null;
    const withTheory = (out) => (theory ? { ...out, theory } : out);
    const entry = world.releaseSchedule.find((e) => e.turn === view.turn && e.via === 'tutor');
    if (entry) {
      const fact = world.premiseById.get(entry.premise).fact;
      return withTheory({
        dialogue: `Consider what the record shows: ${fact.join(' ')}.`,
        move: { figure, targetPremise: entry.premise, intent: 'release' },
        release: entry.premise,
      });
    }
    // Releases stay on cue (the frozen channel) — repair fills the turns
    // between them.
    if (policy.repairDecayed && view.corruption?.decayed?.length) {
      const target = view.corruption.decayed[0];
      return withTheory({
        dialogue: `Hold again what slipped from you: ${target.fact.join(' ')}. Place it back on the table.`,
        move: { figure, targetPremise: target.premiseId, intent: 'repair' },
      });
    }
    const lastRelease = view.ledger[view.ledger.length - 1] || null;
    if (lastRelease) {
      const fact = world.premiseById.get(lastRelease.premiseId).fact;
      return withTheory({
        dialogue: `Hold "${fact.join(' ')}" against what you already know. What follows?`,
        move: { figure, targetPremise: lastRelease.premiseId, intent: 'consolidate' },
      });
    }
    return withTheory({
      dialogue: `Begin with the question itself: ${world.question}`,
      move: { figure, targetPremise: null, intent: 'orient' },
    });
  };
}

/**
 * @param {object} policy
 *   adoptLag        turns between hearing a fact and adopting it (default 0)
 *   stallAfter      stop adopting after this turn (aporia/disengagement sim)
 *   luckyLeapAt     turn to assert `leapFact` regardless of grounds
 *   leapFact        the fact the lucky guesser blurts out
 *   assertMirrorAt  turn to assert `mirrorFact` (the near-miss sim)
 *   mirrorFact      the near-miss fact
 *   readoptForgotten  re-adopt a fact this learner once held that has gone
 *                   missing from its visible board (the learner-side repair
 *                   channel under the decay condition) — view-only, no world
 *                   peeking: it diffs its own memory of what it adopted
 *                   against what the view still shows
 */
export function makeMockLearner(policy = {}) {
  const {
    adoptLag = 0,
    stallAfter = null,
    luckyLeapAt = null,
    leapFact = null,
    assertMirrorAt = null,
    mirrorFact = null,
    readoptForgotten = false,
  } = policy;
  const heard = [];
  return async (view) => {
    const stalled = stallAfter !== null && view.turn > stallAfter;
    heard.push(...view.releasedThisTurn.map((fact) => ({ fact, at: view.turn, adopted: false })));

    if (readoptForgotten) {
      const visible = new Set(view.abox.grounded.map(factKey));
      for (const item of heard) {
        if (item.adopted && !visible.has(factKey(item.fact))) item.adopted = false; // hear it again below
      }
    }

    const adopt = [];
    if (!stalled) {
      for (const item of heard) {
        if (!item.adopted && view.turn - item.at >= adoptLag) {
          item.adopted = true;
          adopt.push(item.fact);
        }
      }
    }

    let asserts = null;
    let dialogue = 'I am listening.';
    let hypothesis = null;

    if (luckyLeapAt !== null && view.turn === luckyLeapAt && leapFact) {
      asserts = leapFact;
      dialogue = `It must be that ${leapFact.join(' ')} — I feel it, though I cannot show it.`;
    } else if (assertMirrorAt !== null && view.turn === assertMirrorAt && mirrorFact) {
      asserts = mirrorFact;
      dialogue = `Then surely ${mirrorFact.join(' ')}.`;
    } else {
      // Ideal-reasoner scan: the public question pattern is the learner's
      // target shape; assert the first closure fact that matches it.
      const facts = [...view.abox.grounded, ...adopt];
      const cl = closure(facts, view.rules).facts;
      for (const fact of cl.values()) {
        if (matchPattern(view.questionPattern, fact)) {
          asserts = fact;
          dialogue = `I see it now: ${fact.join(' ')}.`;
          break;
        }
      }
    }

    if (!asserts && adopt.length > 0) {
      hypothesis = `weighing: ${adopt.map((f) => f.join(' ')).join('; ')}`;
      dialogue = `So ${adopt[0].join(' ')}. Let me place that beside the rest.`;
    }

    return { dialogue, adopt, hypothesis, asserts };
  };
}
