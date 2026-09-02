/**
 * Stress schedule loader — planted learner states with authored repairs.
 *
 * The release schedule's sibling for breakdowns (card:
 * workplan/items/adaptation-planted-stress-bench.md; ratified gold:
 * config/drama-derivation/stress/world-033-stress-schedule.yaml). Each plant
 * names a turn, a typed learner state, the directive the learner-sim gets
 * VERBATIM on that turn, and the adjudicated right repair(s). One authored
 * entry drives the sim, defines the scoring gold, and marks the moment the
 * manner switch should notice.
 *
 * Opt-in hold (2026-09-02): a plant may carry `hold: { turns, release_when }`.
 * The learner-sim then keeps the planted state on the next `turns` turns
 * unless the other speaker's last reply meets `release_when`, stated in
 * plain words about the reply (what it asks, offers, or puts back on the
 * table) — never a move-card name. The sim judges the release itself from
 * the transcript; no classifier and no word list sit between them. Held
 * turns are recorded as `learner_stress_hold` events, never as new plants,
 * so every consumer keyed on `learner_stress_plant` is unchanged.
 *
 * Pure service: no env, no fs at call time beyond the explicit load, no
 * console. The CLI owns the flag (TUTOR_STUB_STRESS_SCHEDULE=<path>) and
 * threads the loaded schedule through state; the learner prompt builder asks
 * for the directive per turn.
 */

import fs from 'node:fs';

import YAML from 'yaml';

export const TUTOR_STUB_STRESS_SCHEDULE_SCHEMA = 'machinespirits.tutor-stub.stress-schedule.v1';

const KNOWN_STATES = new Set([
  'on_track',
  'bored',
  'lost',
  'confused',
  'irritated',
  'frustrated',
  'opposed',
  'jumping_ahead',
  'forgetting',
]);

export function loadTutorStubStressSchedule(schedulePath) {
  const raw = YAML.parse(fs.readFileSync(schedulePath, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new Error(`stress schedule ${schedulePath}: not a mapping`);
  if (!raw.schedule_id) throw new Error(`stress schedule ${schedulePath}: missing schedule_id`);
  if (!Array.isArray(raw.plants) || !raw.plants.length) {
    throw new Error(`stress schedule ${schedulePath}: missing plants`);
  }
  const seen = new Set();
  for (const plant of raw.plants) {
    const turn = Number(plant?.turn);
    if (!Number.isInteger(turn) || turn < 1) throw new Error(`stress schedule: bad turn ${plant?.turn}`);
    if (seen.has(turn)) throw new Error(`stress schedule: duplicate plant at turn ${turn}`);
    seen.add(turn);
    if (!KNOWN_STATES.has(String(plant?.state))) {
      throw new Error(`stress schedule: unknown state "${plant?.state}" at turn ${turn}`);
    }
    if (!String(plant?.realize || '').trim()) throw new Error(`stress schedule: empty realize at turn ${turn}`);
    if (!String(plant?.right_repair || '').trim()) {
      throw new Error(`stress schedule: missing right_repair at turn ${turn}`);
    }
    validateHold(plant, turn);
  }
  const plantTurns = new Set(raw.plants.map((plant) => Number(plant.turn)));
  for (const plant of raw.plants) {
    const hold = normalizeHold(plant);
    if (!hold) continue;
    for (let k = 1; k <= hold.turns; k += 1) {
      const t = Number(plant.turn) + k;
      if (plantTurns.has(t)) {
        throw new Error(`stress schedule: hold from turn ${plant.turn} overlaps the plant at turn ${t}`);
      }
    }
  }
  return {
    schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
    scheduleId: String(raw.schedule_id),
    world: raw.world ? String(raw.world) : null,
    plants: raw.plants.map((plant) => ({
      turn: Number(plant.turn),
      state: String(plant.state),
      cause: String(plant.cause || '').trim(),
      realize: String(plant.realize).trim(),
      rightRepair: String(plant.right_repair),
      repairGloss: String(plant.repair_gloss || '').trim(),
      alsoRight: plant.also_right ? String(plant.also_right) : null,
      alsoAcceptable: plant.also_acceptable ? String(plant.also_acceptable) : null,
      wrongButTempting: String(plant.wrong_but_tempting || '').trim(),
      hold: normalizeHold(plant),
    })),
  };
}

export const TUTOR_STUB_STRESS_HOLD_MAX_TURNS = 6;

/**
 * The trace event for a governed learner turn. A planted turn writes
 * `learner_stress_plant` (the gold consumers key on it). A held continuation
 * writes `learner_stress_hold` instead, so the plant set the judge, review and
 * trainers see is unchanged by a hold.
 */
export function tutorStubStressTraceEvent(schedule, plant, turnNumber) {
  const base = { schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA, scheduleId: schedule.scheduleId, turn: turnNumber };
  if (plant.held > 0) {
    return {
      type: 'learner_stress_hold',
      ...base,
      plantTurn: plant.turn,
      state: plant.state,
      held: plant.held,
      holdTurns: plant.hold.turns,
    };
  }
  return {
    type: 'learner_stress_plant',
    ...base,
    state: plant.state,
    rightRepair: plant.rightRepair,
    alsoRight: plant.alsoRight,
    hold: plant.hold ? { turns: plant.hold.turns } : null,
  };
}

function validateHold(plant, turn) {
  if (plant?.hold === undefined || plant?.hold === null) return;
  const hold = plant.hold;
  if (typeof hold !== 'object') throw new Error(`stress schedule: hold at turn ${turn} is not a mapping`);
  const turns = Number(hold.turns);
  if (!Number.isInteger(turns) || turns < 1 || turns > TUTOR_STUB_STRESS_HOLD_MAX_TURNS) {
    throw new Error(
      `stress schedule: hold.turns at turn ${turn} must be an integer 1..${TUTOR_STUB_STRESS_HOLD_MAX_TURNS}`,
    );
  }
  if (!String(hold.release_when || '').trim()) {
    throw new Error(`stress schedule: hold at turn ${turn} needs release_when in plain words`);
  }
}

function normalizeHold(plant) {
  if (plant?.hold === undefined || plant?.hold === null) return null;
  return { turns: Number(plant.hold.turns), releaseWhen: String(plant.hold.release_when).trim() };
}

/**
 * The plant that governs a learner turn. An exact plant comes back with
 * `held: 0`. A turn inside an opt-in hold window comes back as the same plant
 * with `held: k` (k turns after the planted turn) and `heldTurn` set; the
 * plant's own `turn` is unchanged so gold lookups keep working.
 */
export function tutorStubStressPlantForTurn(schedule, turnNumber) {
  if (!schedule?.plants) return null;
  const turn = Number(turnNumber);
  const exact = schedule.plants.find((plant) => plant.turn === turn);
  if (exact) return { ...exact, held: 0, heldTurn: null };
  const holding = schedule.plants.find(
    (plant) => plant.hold && turn > plant.turn && turn <= plant.turn + plant.hold.turns,
  );
  if (!holding) return null;
  return { ...holding, held: turn - holding.turn, heldTurn: turn };
}

/**
 * The learner-sim directive for a planted turn. Composition rules from the
 * ratified schedule header: exactly one directive per planted turn, the
 * realize text verbatim, and it outranks the standing persona brief for this
 * turn only. Never names the state to the learner (the state is bench
 * metadata; the learner just IS it).
 */
export function tutorStubStressDirective(plant) {
  if (!plant) return null;
  if (plant.held > 0) return heldDirective(plant);
  if (!plant.hold) {
    return [
      '# This turn only — private direction (outranks the standing brief for this single turn)',
      '',
      plant.realize,
      '',
      'Realize this direction as the learner, in her own voice, inside the scene. Return to the standing brief next turn.',
    ].join('\n');
  }
  return [
    '# Private direction (outranks the standing brief from this turn on, until released)',
    '',
    plant.realize,
    '',
    'Realize this direction as the learner, in her own voice, inside the scene.',
    `Keep this state on the next ${plant.hold.turns === 1 ? 'turn' : `${plant.hold.turns} turns`} too, unless the other speaker's reply releases it: ${plant.hold.releaseWhen}`,
    'Do not soften on your own before that.',
  ].join('\n');
}

function heldDirective(plant) {
  const left = plant.hold.turns - plant.held;
  return [
    `# Private direction, held (turn ${plant.held} of ${plant.hold.turns} after the planted turn)`,
    '',
    `On an earlier turn you were given this direction: ${plant.realize}`,
    '',
    `Read the other speaker's last reply. It releases you only if it did this: ${plant.hold.releaseWhen}`,
    'If it did, drop the state now, return to the standing brief, and let the change show in what you say.',
    left > 0
      ? 'If it did not, stay in the state, in your own voice, without softening on your own.'
      : 'If it did not, stay in the state this one last time; the standing brief returns next turn regardless.',
  ].join('\n');
}
