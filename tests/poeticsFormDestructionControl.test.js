import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildControls,
  parseTurnBlocks,
  renderBlocks,
  shuffleBlocks,
} from '../scripts/build-poetics-form-destruction-controls.js';

describe('build-poetics-form-destruction-controls', () => {
  it('parses line-oriented and block-oriented transcript turns', () => {
    const blocks = parseTurnBlocks(`A: First line
continued
B: Reply

STAGE: A light changes.

LEARNER: I see it now.`);

    assert.deepEqual(
      blocks.map((block) => block.role),
      ['A', 'B', 'STAGE', 'LEARNER'],
    );
    assert.match(renderBlocks(blocks), /A: First line\ncontinued/);
  });

  it('preserves stage context while destroying dialogue order', () => {
    const blocks = parseTurnBlocks(`STAGE: The desk is bare.

TUTOR: First.

LEARNER: Second.

TUTOR: Third.`);

    const shuffled = shuffleBlocks(blocks, 1);
    assert.equal(shuffled[0].role, 'STAGE');
    assert.notDeepEqual(
      shuffled.filter((block) => block.role !== 'STAGE').map((block) => block.lines[0]),
      blocks.filter((block) => block.role !== 'STAGE').map((block) => block.lines[0]),
    );
  });

  it('writes shuffled samples and a provenance manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-destroy-'));
    const sampleDir = path.join(root, 'sample');
    const outDir = path.join(root, 'destroyed');
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(
      path.join(sampleDir, 'T01.txt'),
      `TUTOR: Ask.

LEARNER: Answer.

TUTOR: Complicate.

LEARNER: Reframe.
`,
    );

    const manifest = buildControls({ sampleDir, outDir, seed: 7, suffix: '', force: false, dryRun: false });

    assert.equal(manifest.files.length, 1);
    assert.equal(manifest.files[0].dialogueCount, 4);
    assert.ok(fs.existsSync(path.join(outDir, 'T01.txt')));
    assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
    assert.notEqual(
      fs.readFileSync(path.join(outDir, 'T01.txt'), 'utf8'),
      fs.readFileSync(path.join(sampleDir, 'T01.txt'), 'utf8'),
    );
  });
});
