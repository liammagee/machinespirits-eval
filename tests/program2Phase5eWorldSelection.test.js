import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  countProgram2Phase5eFrozenSixUnits,
  measureProgram2Phase5eWorld,
  selectProgram2Phase5eWorld,
} from '../services/program2Phase5eWorldSelection.js';

function writeWorld(dir, name, { id, text, rules }) {
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    `id: ${id}\ntitle: ${id}\nsetting: ${JSON.stringify(text)}\npremises:\n  - { id: p1, fact: [seen, x], surface: clue }\nrules:\n${Array.from({ length: rules }, (_, index) => `  - { id: r${index}, if: [[seen, x]], then: [[known, x]] }`).join('\n')}\nproof_paths:\n  - { premises: [p1] }\n`,
  );
  return file;
}

describe('Program-2 Phase 5e world selection', () => {
  it('counts frozen-six words with word boundaries and suffixes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-phase5e-world-'));
    try {
      const file = writeWorld(dir, 'a.yaml', {
        id: 'world_a',
        text: "record records record's prerecord factual fact tests testing",
        rules: 5,
      });
      const result = measureProgram2Phase5eWorld(file);
      assert.equal(result.cueCounts.record, 3);
      assert.equal(result.cueCounts.fact, 1);
      assert.equal(result.cueCounts.test, 1);
      assert.equal(result.structureFloorPassed, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('selects the lowest-density candidate that meets the structure floor', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-phase5e-selection-'));
    try {
      writeWorld(dir, 'thin.yaml', { id: 'world_thin', text: 'plain language only', rules: 2 });
      writeWorld(dir, 'deep.yaml', { id: 'world_deep', text: 'one record appears', rules: 5 });
      const result = selectProgram2Phase5eWorld({ worldDir: dir, candidateFiles: ['thin.yaml', 'deep.yaml'] });
      assert.equal(result.nativeWinner, 'world_thin');
      assert.equal(result.selectedWorld, 'world_deep');
      assert.match(result.selectionReason, /raw letter-hostility winner/u);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reuses the frozen selector regex for delivered-turn density', () => {
    const result = countProgram2Phase5eFrozenSixUnits([
      { text: "The record's facts support this." },
      { text: 'Which evidence item tests the claim?' },
      { text: 'No cue vocabulary here.' },
    ]);
    assert.equal(result.totalOccurrences, 5);
    assert.equal(result.unitsWithCue, 2);
    assert.deepEqual(result.perCue, { evidence: 1, item: 1, test: 1, record: 1, fact: 1, rule: 0 });
  });
});
