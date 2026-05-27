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

  it('rejects peripeteia arms where learner performs the device without earned reorientation', () => {
    const result = deterministicChecks({
      id: 'T03',
      item: {
        dramatic_shape: 'tile labels -> blind check -> earned reorientation',
        dialogue_approach: 'workshop_clinic',
        tutor_adaptation_policy: 'peripeteia',
      },
      raw: [
        'LEARNER: "Atomic number on 6, symbol on C, name on carbon, atomic mass on 12.01."',
        '',
        'TUTOR: "Keep using the overlay: place each label card in its visible window and read the tile."',
        '',
        'LEARNER: "But this still does not make sense; the two middle windows are not settled by another visible placement."',
        '',
        'TUTOR: "The overlay is not working for the middle pair. Switch to a blind check: point to C and name its label, then point to carbon and name its label before flipping each card."',
        '',
        'LEARNER: "C is symbol. Carbon is name. Both match; the middle pair is checked."',
      ].join('\n'),
    });

    assert.equal(result.pass, false);
    assert.ok(result.violations.includes('peripeteia_arm_without_earned_reorientation'));
  });

  it('accepts peripeteia arms when the learner performs and names the changed pressure', () => {
    const result = deterministicChecks({
      id: 'T04',
      item: {
        dramatic_shape: 'notation boxes -> loose pressure -> outside label',
        dialogue_approach: 'workshop_clinic',
        tutor_adaptation_policy: 'peripeteia',
      },
      raw: [
        'LEARNER: "Three quarter-note beats in one bar. The line fits the 3 tile and the quarter-note card, but the speed card at the edge still feels unresolved."',
        '',
        'TUTOR: "The row settled the count, but it did not settle the loose speed label. New gate: inside this border only if a card names one bar or one beat unit. Test the speed card against those questions."',
        '',
        'LEARNER: "It fails both entries for the border, so it stays outside 3/4. The old check was counting tiles inside the bar. The pressure was the loose speed label. Now the replacement check is: inside the border only if the card names one bar or one beat unit."',
      ].join('\n'),
    });

    assert.equal(result.pass, true);
    assert.ok(!result.violations.includes('peripeteia_arm_without_earned_reorientation'));
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
        '',
        'LEARNER: "The pressure was treating the ticks as the decision; now the check is whether the cracked bracket can carry the release."',
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
