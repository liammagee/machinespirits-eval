import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSetPlan,
  buildGenerationPrompt,
  blindOrder,
  CONDITIONS,
  LEARNER_TURNS,
} from '../services/registerEyeballSet.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the set is every learner turn crossed with every condition', () => {
  const cells = buildSetPlan();
  assert.equal(cells.length, LEARNER_TURNS.length * Object.keys(CONDITIONS).length);
  for (const condition of Object.keys(CONDITIONS)) {
    assert.equal(cells.filter((cell) => cell.condition === condition).length, LEARNER_TURNS.length);
  }
  assert.equal(new Set(cells.map((cell) => cell.id)).size, cells.length);
});

test('one condition names no manner, so a reading can be wrong in both directions', () => {
  assert.equal(CONDITIONS.plain.manner, null);
  const prompts = buildSetPlan()
    .filter((cell) => cell.condition === 'plain')
    .map((cell) => cell.prompt);
  assert.equal(prompts.length, LEARNER_TURNS.length);
  for (const prompt of prompts) {
    assert.ok(!/\bironic\b|\bsarcas/i.test(prompt), 'the control prompt must not name a manner');
  }
});

/**
 * The point of the whole set. The stance gate looks for the same phrases the
 * register config hands the tutor, so a prompt carrying any of them would test
 * phrase-pasting all over again instead of whether the manner arrives.
 */
test('no generation prompt carries a cue phrase from the register config', () => {
  const yamlText = fs.readFileSync(path.join(repoRoot, 'config/engagement-registers.yaml'), 'utf8');
  const cues = [];
  let inCues = false;
  for (const line of yamlText.split('\n')) {
    if (/^\s*stance_fidelity_cues:\s*$/.test(line)) {
      inCues = true;
      continue;
    }
    if (inCues) {
      const match = /^\s*-\s*"?([^"]+)"?\s*$/.exec(line);
      if (match) cues.push(match[1].trim().toLowerCase());
      else inCues = false;
    }
  }
  assert.ok(cues.length >= 5, `expected cue phrases to be found in the config, got ${cues.length}`);

  for (const cell of buildSetPlan()) {
    const prompt = cell.prompt.toLowerCase();
    for (const cue of cues) {
      assert.ok(!prompt.includes(cue), `prompt for ${cell.id} (${cell.condition}) leaks the cue phrase "${cue}"`);
    }
  }
});

test('only the manner line differs between conditions on the same learner turn', () => {
  const [learner] = LEARNER_TURNS;
  const plain = buildGenerationPrompt({ learnerText: learner.text, condition: 'plain' });
  for (const condition of ['ironic', 'sarcastic', 'face_threat']) {
    const withManner = buildGenerationPrompt({ learnerText: learner.text, condition });
    const removed = withManner.replace(`${CONDITIONS[condition].manner}\n\n`, '');
    assert.equal(removed, plain, `${condition} differs from the control by more than its manner line`);
  }
});

test('blind order is stable and does not group by condition', () => {
  const cells = buildSetPlan();
  const first = blindOrder(cells).map((cell) => cell.id);
  const second = blindOrder(cells).map((cell) => cell.id);
  assert.deepEqual(first, second);
  assert.notDeepEqual(
    first,
    cells.map((cell) => cell.id),
  );

  const ordered = blindOrder(cells);
  let runs = 1;
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].condition !== ordered[i - 1].condition) runs += 1;
  }
  assert.ok(runs > Object.keys(CONDITIONS).length, 'conditions must be interleaved, not blocked');
});
