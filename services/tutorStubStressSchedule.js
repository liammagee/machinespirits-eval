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
      alsoRight: plant.also_right ? String(plant.also_right) : null,
      alsoAcceptable: plant.also_acceptable ? String(plant.also_acceptable) : null,
      wrongButTempting: String(plant.wrong_but_tempting || '').trim(),
    })),
  };
}

export function tutorStubStressPlantForTurn(schedule, turnNumber) {
  if (!schedule?.plants) return null;
  return schedule.plants.find((plant) => plant.turn === Number(turnNumber)) || null;
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
  return [
    '# This turn only — private direction (outranks the standing brief for this single turn)',
    '',
    plant.realize,
    '',
    'Realize this direction as the learner, in her own voice, inside the scene. Return to the standing brief next turn.',
  ].join('\n');
}
