import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import yaml from 'yaml';
import { deterministicChecks, parseTurns, run } from '../scripts/critic-poetics-structure.js';

describe('critic-poetics-structure', () => {
  it('parses public transcript turns for structural checks', () => {
    const turns = parseTurns('STAGE: [A chart is turned.]\n\nLEARNER: I still do not buy it.\n\nTUTOR: Hold on. Test this smaller case.');
    assert.deepEqual(
      turns.map((turn) => `${turn.role}${turn.turnNumber}`),
      ['STAGE1', 'LEARNER1', 'TUTOR1'],
    );
  });

  it('flags process leakage and archaic pastiche as formal violations', () => {
    const result = deterministicChecks({
      id: 'T01',
      item: { dramatic_shape: 'x -> y', dialogue_approach: 'aristotelian_reversal' },
      raw: [
        'LEARNER: "I still do not buy it."',
        '',
        'TUTOR: "As the superego noted, thou must inspect the square."',
      ].join('\n'),
    });
    assert.equal(result.pass, false);
    assert.ok(result.violations.includes('public_theory_or_process_leak'));
    assert.ok(result.violations.includes('archaic_pastiche'));
  });

  it('flags public tutor and learner turns that are not direct quoted speech', () => {
    const result = deterministicChecks({
      id: 'T02',
      item: { dramatic_shape: 'x -> y', dialogue_approach: 'aristotelian_reversal' },
      raw: [
        'LEARNER: I still do not buy it.',
        '',
        'TUTOR: [points at the square]',
        '',
        '"Try this smaller case first."',
      ].join('\n'),
    });
    assert.equal(result.pass, false);
    assert.ok(result.violations.includes('public_speech_not_direct_quote'));
  });

  it('runs a mock same-model structural critic over a sample directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-structure-'));
    const sampleDir = path.join(dir, 'sample');
    fs.mkdirSync(sampleDir);
    fs.writeFileSync(
      path.join(sampleDir, 'T01.txt'),
      [
        'LEARNER: "I still do not buy why the checklist is not enough."',
        '',
        'TUTOR: "Hold on. Put the sheet beside the cracked bracket and test the decision, not the ticks."',
      ].join('\n'),
      'utf8',
    );
    const keyPath = path.join(dir, 'key.yaml');
    fs.writeFileSync(
      keyPath,
      yaml.stringify({
        items: {
          T01: {
            drama_id: 'D38',
            discipline: 'engineering',
            dialogue_approach: 'miller_social_reckoning',
            dramatic_shape: 'checklist -> social consequence -> judgment',
            tutor_adaptation_policy: 'peripeteia',
          },
        },
      }),
      'utf8',
    );
    const out = path.join(dir, 'structure.json');
    const artifact = await run({
      critic: 'codex',
      sampleDir,
      keyPath,
      out,
      concurrency: 1,
      batchSize: 4,
      mock: true,
      failOnViolation: false,
    });
    assert.equal(artifact.summary.total, 1);
    assert.equal(artifact.summary.overallPass, 1);
    assert.ok(fs.existsSync(out));
  });
});
