// Guards the hardened calibration scenario set for the edged-register
// outcome study (notes/2026-08-16-edged-register-calibration-draft.md §2.2)
// and the `resistance_hold_turns` endpoint offset in the breakthrough-matrix
// classifier. The twelve cells are calibration-only: they must never widen
// the matrix report's controlled-scenario row filter (that ratchet lives in
// tests/charismaDesireBreakthroughMatrix.test.js and stays at 7).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { analyzeCharismaDesireRows } from '../scripts/report-charisma-desire-breakthrough-matrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENARIO_PATH = path.resolve(__dirname, '..', 'config', 'charisma-recognition-desire-scenarios.yaml');

// merge:true resolves `<<:` the way the runtime's extends-resolution also
// effectively does (evalConfigLoader deep-merges the extends chain and
// deletes the literal `<<` key; deepMerge replaces arrays wholesale).
const SOURCE = fs.readFileSync(SCENARIO_PATH, 'utf8');
const MERGED = yaml.parse(SOURCE, { merge: true }).scenarios;
const RAW = yaml.parse(SOURCE).scenarios;

const HELD_IDS = [
  'charisma_desire_resistance_breakthrough_boredom_sustained',
  'charisma_desire_resistance_breakthrough_frustration_sustained',
  'charisma_desire_resistance_breakthrough_irrelevance_sustained',
  'charisma_desire_resistance_breakthrough_question_flood_sustained',
  'charisma_desire_resistance_breakthrough_rote_parroting_sustained',
  'charisma_desire_resistance_breakthrough_boredom_claimheld',
  'charisma_desire_resistance_breakthrough_frustration_claimheld',
  'charisma_desire_resistance_breakthrough_irrelevance_claimheld',
];
const GUARDED_IDS = [
  'charisma_desire_resistance_breakthrough_boredom_guarded',
  'charisma_desire_resistance_breakthrough_frustration_guarded',
  'charisma_desire_resistance_breakthrough_irrelevance_guarded',
  'charisma_desire_resistance_breakthrough_rote_parroting_guarded',
];
const CALIBRATION_IDS = [...HELD_IDS, ...GUARDED_IDS];
// Dropped at authoring review (recorded in the YAML comment + draft note).
const DROPPED_IDS = [
  'charisma_desire_resistance_breakthrough_question_flood_claimheld',
  'charisma_desire_resistance_breakthrough_rote_parroting_claimheld',
  'charisma_desire_resistance_breakthrough_question_flood_guarded',
];

function signalOf(id) {
  return id.match(/breakthrough_(.+)_(?:sustained|claimheld|guarded)$/)[1];
}

describe('edged-register calibration scenarios', () => {
  it('registers exactly the twelve trimmed calibration cells (ratchet)', () => {
    const flagged = Object.entries(MERGED)
      .filter(([, v]) => v?.edged_register_calibration === true)
      .map(([k]) => k)
      .sort();
    assert.deepEqual(flagged, [...CALIBRATION_IDS].sort());
    for (const id of DROPPED_IDS) {
      assert.equal(MERGED[id], undefined, `dropped cell ${id} must not exist`);
    }
  });

  it('held cells declare the hold and the three-turn shape', () => {
    for (const id of HELD_IDS) {
      const cell = MERGED[id];
      assert.equal(cell.resistance_hold_turns, 2, `${id} hold`);
      assert.equal(cell.turns.length, 3, `${id} turns`);
      assert.equal(cell.turns[0].learner_action, 'resistant_followup', `${id} turn 1`);
      assert.equal(cell.turns[1].learner_action, 'resistant_followup', `${id} turn 2`);
      assert.equal(cell.turns[2].learner_action, 'uptake_probe', `${id} turn 3`);
      assert.equal(cell.turns[2].id, 'turn_3_breakthrough_probe', `${id} probe id`);
      if (id.endsWith('_claimheld')) {
        assert.equal(cell.claim_bearing_resistance, true, `${id} claim flag`);
      }
    }
  });

  it('guarded cells keep the two-turn base shape and stay off the protected-affect lexicon', () => {
    const protectedAffect = /vulnerab|shame|ashamed|anxious|afraid|humiliat|panick|overwhelm/i;
    for (const id of GUARDED_IDS) {
      const cell = MERGED[id];
      assert.equal(cell.resistance_hold_turns, undefined, `${id} must not hold`);
      assert.equal(cell.turns.length, 2, `${id} turns`);
      assert.equal(cell.turns[1].learner_action, 'uptake_probe', `${id} turn 2`);
      assert.match(cell.learner_context, /never use the words/i, `${id} guard line`);
      // The guard line itself names the banned words; everything else in the
      // context must stay off them, or M-C1 fails the cell by construction.
      const outsideGuardLine = cell.learner_context
        .split('\n')
        .filter((line) => !/Guard on wording/i.test(line))
        .join('\n');
      assert.doesNotMatch(outsideGuardLine, protectedAffect, `${id} protected-affect leak`);
    }
  });

  it('reuses the controlled per-signal personas and keeps the diagnostic gate', () => {
    for (const id of CALIBRATION_IDS) {
      const signal = signalOf(id);
      const cell = MERGED[id];
      assert.equal(cell.learner_persona, `resistant_${signal}_probe`, `${id} persona`);
      assert.equal(cell.resistance_signal_target, signal, `${id} target`);
      assert.equal(cell.resistance_breakthrough_diagnostic, true, `${id} diagnostic flag`);
      assert.ok(JSON.stringify(cell.resistance_signal_gate || '').includes(signal), `${id} gate covers ${signal}`);
    }
  });

  it('keeps the rote lexicon out of non-rote hardening text', () => {
    for (const id of CALIBRATION_IDS) {
      if (signalOf(id) === 'rote_parroting') continue;
      assert.doesNotMatch(MERGED[id].learner_context, /formula|repeat|parrot|memoriz/i, `${id} smuggles rote lexicon`);
    }
  });

  it('reads the conversion outcome at the first uptake-permitted turn', () => {
    const sustainedId = 'charisma_desire_resistance_breakthrough_boredom_sustained';
    const fakeLog = {
      learnerArchitecture: 'ego_superego',
      turnResults: [
        { turnIndex: 1, learnerMessage: 'This is boring and dead, honestly.', learnerMessageGenerated: true },
        { turnIndex: 2, learnerMessage: 'Still boring. It has not come alive.', learnerMessageGenerated: true },
        {
          turnIndex: 3,
          learnerMessage: 'Okay, that gives me a way in: I will test the master and servant case now.',
          learnerMessageGenerated: true,
        },
      ],
    };
    const row = { id: 'row-1', run_id: 'run-1', scenario_id: sustainedId, profile_name: 'test_profile' };

    // RAW mirrors the reporter's own parse (no merge:true): hold field and
    // turns aliases are explicit keys, so the classifier sees them either way.
    for (const scenarios of [MERGED, RAW]) {
      const [held] = analyzeCharismaDesireRows([row], scenarios, { loadLog: () => fakeLog });
      assert.equal(held.resistanceTurn, 1);
      assert.equal(held.postTurn, 3, 'hold=2 must move the read to turn 3');
      assert.match(held.postLearner, /way in/);

      const noHold = { ...scenarios, [sustainedId]: { ...scenarios[sustainedId] } };
      delete noHold[sustainedId].resistance_hold_turns;
      const [control] = analyzeCharismaDesireRows([row], noHold, { loadLog: () => fakeLog });
      assert.equal(control.postTurn, 2, 'without the field the read stays at the next turn');
      assert.match(control.postLearner, /not come alive/);
    }
  });
});
