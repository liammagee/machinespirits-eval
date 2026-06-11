/**
 * The drama engine: turn loop, role-scoped views, release ledger, slope
 * trajectory, failure taxonomy (notes/dramatic-derivation-plan.md §2–§3).
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

import { closure, entails, factKey, matchPattern, proofTree } from './chainer.js';
import { normalizeDecayConfig, mulberry32 } from './corruption.js';
import { derivationDistance, detectStall } from './slope.js';

function renderFact(fact) {
  return fact.join(' ');
}

export async function runDrama({ world, roles, options = {} }) {
  const opts = {
    stopOnStall: true,
    stopOnLeak: true,
    recognitionGrace: 3,
    maxTurns: Infinity, // episode replay (replay.js) stops the loop early; world.turnCap still bounds it
    ...options,
  };
  // The unreliable-learner condition (corruption.js header): seeded decay of
  // the learner's grounded board, a RUN-LEVEL condition — worlds stay frozen.
  // null = condition absent, and absent means absent: no entry ever gains a
  // `decayed` flag, no new event types appear, and the result object is
  // field-for-field what the engine returned before the condition existed
  // (the decay-off invariance the tests pin).
  const decay = options.decay ? normalizeDecayConfig(options.decay) : null;
  const corruption = decay ? { config: decay, rng: mulberry32(decay.seed), ledger: [] } : null;
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

  const validGroundedFacts = () =>
    [...grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);

  // --- derive channel + inference frontier state (stall-watcher instrument) ---
  const voicedLedger = []; // {fact, turn} — canonical closure facts the learner voiced via derive
  const voicedKeys = new Set();
  const firstAvailable = new Map(); // key -> {fact, turn} — first turn the fact was derivable from the valid board
  const overreaches = []; // {turn, fact} — derive claims NOT in the closure (false inferences)
  const mischanneled = []; // {turn, fact, kind: 'base'|'pattern'} — adopt/assert material sent down derive
  const premiseIdByKey = new Map([...world.premiseById.values()].map((p) => [factKey(p.fact), p.id]));

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
        premiseId: premiseIdByKey.get(pk) || null,
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

  const applyRelease = (turn, premiseId, via) => {
    if (!premiseId) return null;
    const premise = world.premiseById.get(premiseId);
    if (!premise || releasedKeys.has(factKey(premise.fact))) return null;
    releasedKeys.add(factKey(premise.fact));
    releasedFacts.push(premise.fact);
    ledger.push({ turn, premiseId, via });
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

  const learnerView = (turn, releasedThisTurn) => ({
    turn,
    question: world.question,
    questionPattern: world.questionPattern,
    rules: world.rules,
    background: world.background,
    releasedFacts: visibleToLearner([...releasedFacts]),
    releasedThisTurn: visibleToLearner(releasedThisTurn),
    transcript: transcript.map(({ turn: t, role, text }) => ({ turn: t, role, text })),
    abox: {
      grounded: validGroundedFacts(),
      hypotheses: [...hypotheses],
    },
    voiced: voicedLedger.map((entry) => ({ ...entry })),
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
    inference: {
      frontier: computeFrontier(turn),
      voiced: voicedLedger.map((entry) => ({ ...entry })),
      overreachCount: overreaches.length,
    },
    // v1 visibility: world-side roles read the corruption ground truth (the
    // harness owns what was lost and when). The v2 manipulation — superego
    // must INFER decay from conduct — gates this block off; design-note
    // material, not built.
    ...(corruption
      ? {
          corruption: {
            decayed: [...grounded.entries()]
              .filter(([, entry]) => entry.decayed)
              .map(([key, entry]) => ({
                premiseId: premiseIdByKey.get(key) || null,
                fact: entry.fact,
                sinceTurn: entry.decayTurn,
              })),
            ledger: corruption.ledger.map((e) => ({ ...e })),
          },
        }
      : {}),
  });

  recordAvailability(0); // background-only board may already yield derivations
  const turnLimit = Math.min(world.turnCap, Number.isFinite(opts.maxTurns) ? opts.maxTurns : Infinity);
  let turn = 0;
  while (turn < turnLimit && !endedBy) {
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

    // Tutor-side repair: a move that TARGETS a decayed premise restores it —
    // the tutor re-staged the evidence, so it is back in the learner's hands
    // before the learner speaks this turn. Repair is declared move metadata,
    // never inferred from prose.
    if (corruption && tutorOut.move?.targetPremise) {
      const premise = world.premiseById.get(tutorOut.move.targetPremise);
      const entry = premise ? grounded.get(factKey(premise.fact)) : null;
      if (entry?.decayed) {
        entry.decayed = false;
        entry.regroundedTurn = turn;
        corruption.ledger.push({ turn, type: 'repair', premiseId: tutorOut.move.targetPremise, via: 'tutor' });
        events.push({ turn, type: 'repair', detail: `${tutorOut.move.targetPremise} restored by the tutor` });
      }
    }

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
      const existing = grounded.get(key);
      if (existing) {
        // Re-adoption heals decay: taking the fact up again restores it to
        // the board (the learner-side repair channel).
        if (corruption && existing.decayed) {
          existing.decayed = false;
          existing.regroundedTurn = turn;
          const premiseId = premiseIdByKey.get(key) || null;
          corruption.ledger.push({ turn, type: 'repair', premiseId, via: 'readoption' });
          events.push({ turn, type: 'repair', detail: `${premiseId || renderFact(fact)} restored by re-adoption` });
        }
        continue;
      }
      const valid = releasedKeys.has(key) || backgroundKeys.has(key);
      grounded.set(key, { fact, turn, valid });
      if (!valid) {
        events.push({ turn, type: 'fabricated_fact', detail: renderFact(fact) });
      }
    }
    if (learnerOut.hypothesis) {
      hypotheses.push({ turn, text: learnerOut.hypothesis });
    }

    // --- derive channel: validate learner-composed inference claims ---
    // Order matters: adopt/retract above first, so "I adopt X and can now
    // derive Y" validates against the board the learner just updated.
    const deriveOutcomes = []; // {fact, status: 'voiced'|'overreach'|'base'|'pattern'|'repeat'}
    if (Array.isArray(learnerOut.derive) && learnerOut.derive.length) {
      const cl = closure(validGroundedFacts(), world.rules);
      const byNorm = new Map();
      for (const [key, fact] of cl.facts) byNorm.set(normKey(fact), { key, fact });
      for (const claim of learnerOut.derive) {
        if (!Array.isArray(claim) || !claim.length) continue;
        const hit = byNorm.get(normKey(claim));
        if (!hit) {
          overreaches.push({ turn, fact: claim });
          events.push({ turn, type: 'overreach', detail: renderFact(claim) });
          deriveOutcomes.push({ fact: claim, status: 'overreach' });
          continue;
        }
        if (voicedKeys.has(hit.key)) {
          deriveOutcomes.push({ fact: hit.fact, status: 'repeat' });
          continue;
        }
        if (!cl.proofs.get(hit.key)) {
          mischanneled.push({ turn, fact: hit.fact, kind: 'base' });
          deriveOutcomes.push({ fact: hit.fact, status: 'base' });
          continue;
        }
        if (isPatternFact(hit.fact)) {
          mischanneled.push({ turn, fact: hit.fact, kind: 'pattern' });
          deriveOutcomes.push({ fact: hit.fact, status: 'pattern' });
          continue;
        }
        voicedKeys.add(hit.key);
        voicedLedger.push({ fact: hit.fact, turn });
        deriveOutcomes.push({ fact: hit.fact, status: 'voiced' });
      }
    }

    transcript.push({
      turn,
      role: 'learner',
      text: learnerOut.dialogue || '',
      meta: {
        adopt: learnerOut.adopt || [],
        retract: learnerOut.retract || [],
        derive: learnerOut.derive || [],
        deriveOutcomes,
        hypothesis: learnerOut.hypothesis || null,
        asserts: learnerOut.asserts || null,
      },
    });

    // --- instrumentation ---
    const valid = validGroundedFacts();
    recordAvailability(turn); // frontier availability reflects this turn's adoptions
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
        const premiseId = premiseIdByKey.get(key) || null;
        corruption.ledger.push({ turn, type: 'decay', premiseId, fact: entry.fact });
        events.push({
          turn,
          type: 'decay',
          detail: `${premiseId || renderFact(entry.fact)} slips from the learner's board`,
        });
        decayedNow.push(premiseId || renderFact(entry.fact));
      }
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
      derived: deriveOutcomes.filter((o) => o.status === 'voiced').length,
      overreached: deriveOutcomes.filter((o) => o.status === 'overreach').length,
      hypothesis: Boolean(learnerOut.hypothesis),
      asserted: Boolean(learnerOut.asserts),
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
          }
        : {}),
      endedBy,
    });
  }

  const verdict = resolveVerdict({ endedBy, events, firstForcedTurn, assertedGroundedTurn });
  const proof = assertedGroundedTurn !== null ? proofTree(validGroundedFacts(), world.rules, world.secret.fact) : null;

  const availability = [...firstAvailable.values()]
    .map(({ fact, turn: avail }) => {
      const voicedEntry = voicedLedger.find((entry) => factKey(entry.fact) === factKey(fact));
      return { fact, firstAvailable: avail, firstVoiced: voicedEntry ? voicedEntry.turn : null };
    })
    .sort((a, b) => a.firstAvailable - b.firstAvailable || factKey(a.fact).localeCompare(factKey(b.fact)));

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
    inference: {
      voiced: voicedLedger,
      overreaches,
      mischanneled,
      availability,
      frontierFinal: computeFrontier(turn),
    },
    ...(corruption
      ? {
          corruption: {
            config: corruption.config,
            ledger: corruption.ledger,
            decayedAtEnd: [...grounded.entries()]
              .filter(([, entry]) => entry.decayed)
              .map(([key, entry]) => ({
                premiseId: premiseIdByKey.get(key) || null,
                fact: entry.fact,
                sinceTurn: entry.decayTurn,
              })),
          },
        }
      : {}),
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
