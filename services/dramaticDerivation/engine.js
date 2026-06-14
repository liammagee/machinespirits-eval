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

import { closure, entails, factKey, matchPattern, proofTree } from './chainer.js';
import { normalizeDecayConfig, mulberry32 } from './corruption.js';
import { proofDebtReport, tutorProofDebtView } from './proofDebt.js';
import { createRuntimeMonitor } from './runtimeMonitor.js';
import { derivationDistance, detectStall } from './slope.js';

function renderFact(fact) {
  return fact.join(' ');
}

const ACTS_DEFAULTS = Object.freeze({
  minActTurns: 3,
  maxActTurns: 8,
});

/**
 * Validate and default an acts config (stage v2). Accepts an object or a
 * JSON string (the CLI's `--acts '<json>'`). Unknown keys are rejected — a
 * typo'd guard must fail loudly, not silently run at its default.
 */
export function normalizeActsConfig(raw) {
  let cfg = raw;
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`acts config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('acts config must be a JSON object, e.g. {"minActTurns":3,"maxActTurns":8}');
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in ACTS_DEFAULTS)) {
      throw new Error(`acts config: unknown key "${key}" (known: ${Object.keys(ACTS_DEFAULTS).join(', ')})`);
    }
  }
  const out = { ...ACTS_DEFAULTS, ...cfg };
  for (const name of ['minActTurns', 'maxActTurns']) {
    if (!Number.isInteger(out[name]) || out[name] < 1) {
      throw new Error(`acts config: ${name} must be an integer >= 1 (got ${JSON.stringify(out[name])})`);
    }
  }
  if (out.minActTurns > out.maxActTurns) {
    throw new Error(`acts config: minActTurns (${out.minActTurns}) must not exceed maxActTurns (${out.maxActTurns})`);
  }
  return out;
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
  // Stage v2 (header): acts mode is opt-in and, like decay, absent means
  // absent — no act state, no view bounding, no redaction, no new fields.
  const acts = options.acts ? normalizeActsConfig(options.acts) : null;
  const runtimeMonitor = options.guardSpec ? createRuntimeMonitor(world, options.guardSpec) : null;
  const proofDebtGuardActive = Boolean(options.proofDebtGuard);
  const actState = acts ? { index: 1, startTurn: 1, brief: '', history: [] } : null;
  const reconstructionRows = []; // {turn, believed, truth} — reconstructing-tutor dial (roles-layer)
  const plotRows = []; // {act, turn, holdByEnd, withhold, friction, fallback} — C1 act-plot dial (roles-layer)
  const plotAuditRows = []; // {turn, [final,] act, clauses, summary[, arc][, throughlineAudit]} — C1 act-close audits
  const throughlineRows = []; // {act, turn, trigger[, reason], arc, holdToEnd, risk, salvage} — two-layer planning
  const proofDebtRows = []; // guard audit rows — proof-critical decayed exhibits offered to the tutor
  const ledger = []; // {turn, premiseId, via}
  const releasedKeys = new Set();
  const releasedFacts = [];
  const releasedAtByKey = new Map(); // factKey -> release turn (act-bounding needs WHEN, not just whether)
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
  const voicedLedger = []; // {fact, turn} — canonical closure facts the learner voiced via derive
  const voicedKeys = new Set();
  const firstAvailable = new Map(); // key -> {fact, turn} — first turn the fact was derivable from the valid board
  const overreaches = []; // {turn, fact} — derive claims NOT in the closure (false inferences)
  const mischanneled = []; // {turn, fact, kind: 'base'|'pattern'} — adopt/assert material sent down derive
  const premiseIdByKey = new Map([...world.premiseById.values()].map((p) => [factKey(p.fact), p.id]));
  // Twin-fact premises stage the SAME fact under different ids (alternative
  // evidentiary routes — lantern's p_residue/p_glimpse; only one twin is ever
  // scheduled). premiseIdByKey is last-writer-wins over that many-to-one map,
  // so it can name the twin that was never staged. Reported identity must be
  // the id whose release actually put the fact on the board: repairs BY id
  // are immune (they collapse to the fact key), but id-COMPARING consumers
  // (corruptionReport pairing, repair guards) silently mismatch otherwise.
  const releasedIdByKey = new Map(); // factKey -> premise id whose release staged it
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
  const mutationPoolByPredPos = new Map(); // "pred|pos|epoch" -> sorted constants
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

  const currentProofDebt = (turn) =>
    proofDebtGuardActive && corruption
      ? proofDebtReport(world, { grounded, releasedIdByKey, turn })
      : { turn, active: false, dNow: derivationDistance(world, validGroundedFacts()), debts: [] };

  // Stage v2 bounding (header): in acts mode the learner's context is (a) its
  // own theory store and (b) the current act only — prior acts' prose,
  // releases, and voiced theorems drop from view; the theory is the only
  // thing that crosses an act boundary. Hypotheses stay unbounded by design
  // (the learner's own conjectural thread, not staged evidence). The board
  // shown is the BELIEF board: mutation-born false axioms are visible (the
  // learner believes them); fabrications stay invisible, as in v1.
  const learnerView = (turn, releasedThisTurn) => ({
    turn,
    question: world.question,
    questionPattern: world.questionPattern,
    rules: world.rules,
    background: world.background,
    releasedFacts: visibleToLearner(
      actState
        ? releasedFacts.filter((fact) => (releasedAtByKey.get(factKey(fact)) ?? 0) >= actState.startTurn)
        : [...releasedFacts],
    ),
    releasedThisTurn: visibleToLearner(releasedThisTurn),
    transcript: transcript
      .filter((entry) => !actState || entry.turn >= actState.startTurn)
      .map(({ turn: t, role, text }) => ({ turn: t, role, text })),
    abox: {
      grounded: learnerBoardFacts(),
      hypotheses: [...hypotheses],
    },
    voiced: voicedLedger
      .filter((entry) => !actState || entry.turn >= actState.startTurn)
      .map((entry) => ({ ...entry })),
    ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn, brief: actState.brief } } : {}),
  });

  const actsView = (turn) => ({
    index: actState.index,
    startTurn: actState.startTurn,
    brief: actState.brief,
    turnsThisAct: turn - actState.startTurn,
    minActTurns: acts.minActTurns,
    maxActTurns: acts.maxActTurns,
    closed: actState.history.map((a) => ({ ...a })),
  });

  const omniscientView = (turn, roleName) => {
    const proofDebt = roleName === 'tutor' && proofDebtGuardActive ? currentProofDebt(turn) : null;
    const base = {
      turn,
      role: roleName,
      world,
      ledger: [...ledger],
      releasedFacts: [...releasedFacts],
      transcript: [...transcript],
      staging: { phase: staging.phase },
      ...(actState ? { acts: actsView(turn) } : {}),
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
  const turnLimit = Math.min(world.turnCap, Number.isFinite(opts.maxTurns) ? opts.maxTurns : Infinity);
  let turn = 0;
  while (turn < turnLimit && !endedBy) {
    turn += 1;
    const releasedThisTurn = [];

    // --- director ---
    const directorOut = (await roles.director(omniscientView(turn, 'director'))) || {};
    const directorRelease = applyRelease(turn, directorOut.release, 'director');
    if (directorRelease) releasedThisTurn.push(directorRelease);
    if (actState) {
      // The act verdict (stage v2, header). Turn 1's direction is Act 1's
      // brief; afterwards {act:'end', direction} closes the act at turn-1 and
      // opens the next with the direction as its strategic brief. Guards: an
      // end below minActTurns is overridden (act_min_blocked); an act at
      // maxActTurns is force-closed (harness_max). The synthesized `Act N`
      // phase keeps every phase-reading instrument working unchanged;
      // directorOut.phase is ignored in acts mode.
      const turnsThisAct = turn - actState.startTurn;
      if (turn === 1) {
        actState.brief = (directorOut.direction || '').trim();
        staging.phase = { name: 'Act 1', intent: actState.brief, turn };
      } else {
        const wantsEnd = directorOut.act === 'end';
        const mustEnd = turnsThisAct >= acts.maxActTurns;
        if (wantsEnd && turnsThisAct < acts.minActTurns) {
          events.push({
            turn,
            type: 'act_min_blocked',
            detail: `director end of act ${actState.index} overridden at ${turnsThisAct} turns (min ${acts.minActTurns})`,
          });
        } else if (wantsEnd || mustEnd) {
          const direction = (directorOut.direction || '').trim() || '[The act turns.]';
          const endedByAct = wantsEnd ? 'director' : 'harness_max';
          actState.history.push({
            act: actState.index,
            turns: [actState.startTurn, turn - 1],
            endedBy: endedByAct,
            brief: actState.brief,
          });
          events.push({
            turn,
            type: 'act_end',
            detail: `act ${actState.index} closed (${endedByAct}) after ${turnsThisAct} turns`,
          });
          actState.index += 1;
          actState.startTurn = turn;
          actState.brief = direction;
          staging.phase = { name: `Act ${actState.index}`, intent: direction, turn };
        }
      }
    } else if (directorOut.phase && typeof directorOut.phase.name === 'string' && directorOut.phase.name.trim()) {
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
        ...(actState ? { act: directorOut.act || null } : {}),
      },
    });

    // --- tutor ---
    const tutorView = omniscientView(turn, 'tutor');
    const debtAudit = proofDebtGuardActive ? currentProofDebt(turn) : null;
    if (debtAudit?.active) {
      proofDebtRows.push({
        turn,
        dNow: debtAudit.dNow,
        debts: debtAudit.debts.map(({ premiseId, sinceTurn, dIfRestored, deltaD, closesProof }) => ({
          premiseId,
          sinceTurn,
          dIfRestored,
          deltaD,
          closesProof,
        })),
      });
    }
    const tutorOut = (await roles.tutor(tutorView)) || {};
    const tutorRelease = applyRelease(
      turn,
      tutorOut.release,
      'tutor',
      tutorOut.releaseDecision
        ? { reason: tutorOut.releaseReason || null, offset: tutorOut.releaseDecision.offset ?? null }
        : null,
    );
    if (tutorRelease) releasedThisTurn.push(tutorRelease);
    transcript.push({
      turn,
      role: 'tutor',
      text: tutorOut.dialogue || '',
      meta: {
        move: tutorOut.move || null,
        release: tutorOut.release || null,
        deliberation: tutorOut.deliberation || null,
        ...(tutorOut.releaseDecision ? { releaseDecision: tutorOut.releaseDecision } : {}),
        ...(tutorOut.releaseReason ? { releaseReason: tutorOut.releaseReason } : {}),
        ...(tutorOut.theory ? { theory: tutorOut.theory } : {}),
        ...(tutorOut.plot ? { plot: tutorOut.plot } : {}),
        ...(tutorOut.plotAudit ? { plotAudit: tutorOut.plotAudit } : {}),
        ...(tutorOut.throughline ? { throughline: tutorOut.throughline } : {}),
        ...(tutorOut.proofDebt ? { proofDebt: tutorOut.proofDebt } : {}),
      },
    });

    // Reconstructing-tutor recording (stage v2, header): when the roles layer
    // emits a per-turn `theory` — the tutor's model of the learner's store —
    // pair it with a harness-truth snapshot taken at the same moment: which
    // released premises the learner actually holds, which are absent (decayed
    // or never adopted), and which stand misremembered (a mutation-born false
    // form on the board). Arm-internal color; cross-arm endpoints never read it.
    if (tutorOut.theory) {
      const held = [];
      const missing = [];
      for (const [key, premiseId] of releasedIdByKey) {
        const entry = grounded.get(key);
        if (entry && entry.valid && !entry.decayed) held.push(premiseId);
        else missing.push(premiseId);
      }
      const mistaken = [];
      for (const entry of grounded.values()) {
        if (!entry.mutatedFalse) continue;
        const id = premiseIdForKey(entry.mutationOf);
        if (id && !mistaken.includes(id)) mistaken.push(id);
      }
      reconstructionRows.push({ turn, believed: tutorOut.theory, truth: { held, missing, mistaken } });
    }

    // C1 plot recording (roles-layer dial, zero engine config — the theory
    // pattern): when the tutor bridge emits a per-act `plot` (act-opening
    // turns) or a `plotAudit` (the previous act, audited on the same boundary
    // turn), store them and mark the events; instruments read the rows later.
    if (tutorOut.plot) {
      plotRows.push({ ...tutorOut.plot });
      events.push({ turn, type: 'plot', detail: `act ${tutorOut.plot.act} plot committed` });
    }
    if (tutorOut.plotAudit) {
      plotAuditRows.push({ turn, ...tutorOut.plotAudit });
      events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(tutorOut.plotAudit) });
    }
    // Two-layer planning: the whole-play throughline, committed at the first
    // turn and revised at act openings (trigger says which demand produced it).
    if (tutorOut.throughline) {
      throughlineRows.push({ ...tutorOut.throughline });
      events.push({
        turn,
        type: 'throughline',
        detail: `throughline ${tutorOut.throughline.trigger === 'voluntary' || tutorOut.throughline.trigger === 'audit_bound' ? 'revised' : 'committed'} (${tutorOut.throughline.trigger})`,
      });
    }

    // Tutor-side repair: a move that TARGETS a decayed premise restores it —
    // the tutor re-staged the evidence, so it is back in the learner's hands
    // before the learner speaks this turn. Repair is declared move metadata,
    // never inferred from prose. A confront move (C5) is the one exception:
    // it demands the learner produce the exhibit and restates nothing, so it
    // cannot put the words back in the learner's hands — if the read-back
    // fails, the licensed re-entry that follows is what repairs. Repairing on
    // the confrontation itself would make the read-back test nothing.
    const tutorIntent = String(tutorOut.move?.intent || '')
      .toLowerCase()
      .trim();
    if (corruption && tutorOut.move?.targetPremise && tutorIntent !== 'confront') {
      const premise = world.premiseById.get(tutorOut.move.targetPremise);
      const entry = premise ? grounded.get(factKey(premise.fact)) : null;
      if (entry?.decayed) {
        entry.decayed = false;
        entry.regroundedTurn = turn;
        // Ledger identity is the staged id, not the raw target: a move may
        // name a twin alias and still repair (key collapse), but the decay
        // entry it answers names the released id — pairing must agree. The
        // raw target survives in the transcript's move metadata.
        const repairedId = premiseIdForKey(factKey(premise.fact));
        corruption.ledger.push({ turn, type: 'repair', premiseId: repairedId, via: 'tutor' });
        events.push({ turn, type: 'repair', detail: `${repairedId} restored by the tutor` });
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
      const key = factKey(fact);
      // Retracting a mutation-born false belief is half of a REVISION (the
      // other half is the true premise coming back via repair/re-adoption);
      // the ledger row lets the scorer pair the two without inference.
      const entry = grounded.get(key);
      if (corruption && entry?.mutatedFalse) {
        const premiseId = premiseIdForKey(entry.mutationOf);
        corruption.ledger.push({ turn, type: 'retract_false', premiseId, falseForm: entry.fact });
        events.push({
          turn,
          type: 'retract_false',
          detail: `${premiseId || 'unknown'}: false form "${renderFact(entry.fact)}" retracted`,
        });
      }
      grounded.delete(key);
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
          const premiseId = premiseIdForKey(key);
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
    // F(t) is decay-conditional and additive: trajectory rows in corruption
    // runs gain a fidelity field (design note §2's documented relaxation of
    // strict v1 byte-identity); decay-off rows are untouched.
    const F = corruption ? theoryFidelity() : null;
    trajectory.push({ turn, D, forced, groundedCount: valid.length, ...(corruption ? { F } : {}) });

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
            F,
          }
        : {}),
      ...(actState ? { act: { index: actState.index, startTurn: actState.startTurn } } : {}),
      endedBy,
    });
  }

  // Close the final open act at the last turn played (stage v2).
  if (actState) {
    actState.history.push({
      act: actState.index,
      turns: [actState.startTurn, turn],
      endedBy: 'run_end',
      brief: actState.brief,
    });
  }

  // C1: the run-end act close has no following opening turn, so the final
  // act's plot is audited here — the engine hands the tutor bridge the sealed
  // record and stores the verdict like any boundary audit. Plot-off arms
  // (and non-plot tutors) have no finalAudit and skip this entirely.
  if (actState && typeof roles.tutor.finalAudit === 'function') {
    const fin = await roles.tutor.finalAudit({
      transcript: [...transcript],
      ledger: [...ledger],
      acts: actState.history.map((a) => ({ ...a })),
    });
    if (fin) {
      plotAuditRows.push({ turn, final: true, ...fin });
      events.push({ turn, type: 'plot_audit', detail: plotAuditDetail(fin, ' at run end') });
    }
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
    ...(actState ? { acts: actState.history } : {}),
    ...(reconstructionRows.length ? { reconstruction: reconstructionRows } : {}),
    ...(plotRows.length || plotAuditRows.length || throughlineRows.length
      ? {
          plot: {
            plots: plotRows,
            audits: plotAuditRows,
            ...(throughlineRows.length ? { throughlines: throughlineRows } : {}),
          },
        }
      : {}),
    ...(proofDebtRows.length ? { proofDebt: proofDebtRows } : {}),
    ...(corruption
      ? {
          corruption: {
            config: corruption.config,
            ledger: corruption.ledger,
            decayedAtEnd: [...grounded.entries()]
              .filter(([, entry]) => entry.decayed)
              .map(([key, entry]) => ({
                premiseId: premiseIdForKey(key),
                fact: entry.fact,
                sinceTurn: entry.decayTurn,
              })),
          },
        }
      : {}),
  };
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
