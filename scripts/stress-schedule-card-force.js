/**
 * Print the forced-card arm of a stress schedule (card:
 * state-detection-without-word-lists, step 3).
 *
 * Every plant in the schedule becomes `turn=card` from the plant map
 * (services/tutorStubMannerSwitch.js), spelled the way TUTOR_STUB_CARD_FORCE
 * reads it. The tutor is then told the right move at the planted turn with
 * no detector in the loop, which is the arm the crossed experiment used for
 * its claims about the moves. Adding a scenario needs a schedule and its gold,
 * not a word list.
 *
 * Usage:
 *   node scripts/stress-schedule-card-force.js <schedule.yaml> [--json]
 *
 *   TUTOR_STUB_CARD_FORCE="$(node scripts/stress-schedule-card-force.js \
 *     config/drama-derivation/stress/world-030-stress-schedule.yaml)"
 *
 * Read-only. No model calls.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cardForStressState, cardForceScheduleFromStressPlants } from '../services/tutorStubCardForce.js';
import { loadTutorStubStressSchedule } from '../services/tutorStubStressSchedule.js';

export function stressScheduleCardForce(schedulePath) {
  const schedule = loadTutorStubStressSchedule(path.resolve(schedulePath));
  return {
    scheduleId: schedule.scheduleId,
    world: schedule.world,
    cardForce: cardForceScheduleFromStressPlants(schedule.plants),
    plants: schedule.plants.map((plant) => ({
      turn: plant.turn,
      state: plant.state,
      card: cardForStressState(plant.state),
      rightRepair: plant.rightRepair,
    })),
  };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const schedulePath = args.find((a) => !a.startsWith('--'));
  if (!schedulePath) {
    console.error('usage: node scripts/stress-schedule-card-force.js <schedule.yaml> [--json]');
    process.exit(1);
  }
  const out = stressScheduleCardForce(schedulePath);
  console.log(json ? JSON.stringify(out, null, 2) : out.cardForce);
}
