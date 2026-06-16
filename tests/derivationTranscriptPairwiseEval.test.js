import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDerivationPairwisePacket,
  parsePairSpec,
  renderPublicTranscript,
} from '../scripts/build-derivation-transcript-pairwise-eval.js';

function writeLive(loopDir, label, tutorText, learnerText) {
  const dir = path.join(loopDir, label);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'live.json'),
    `${JSON.stringify(
      {
        label,
        verdict: 'grounded_anagnorisis',
        latest: { D: 0 },
        turns: [
          {
            turn: 1,
            D: 4,
            lines: [
              { role: 'stage', text: '[A quiet room. A sealed letter waits on the table.]' },
              { role: 'tutor', text: tutorText },
              { role: 'learner', text: learnerText },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

test('parsePairSpec requires one id and two distinct labels', () => {
  assert.deepEqual(parsePairSpec('sample=left-label,right-label'), {
    pairId: 'sample',
    labels: ['left-label', 'right-label'],
  });
  assert.throws(() => parsePairSpec('sample=only-one'), /exactly two labels/u);
  assert.throws(() => parsePairSpec('sample=same,same'), /must differ/u);
});

test('renderPublicTranscript strips run metadata and keeps public roles only', () => {
  const transcript = renderPublicTranscript({
    label: 'source-label',
    verdict: 'grounded_anagnorisis',
    turns: [
      {
        turn: 2,
        D: 3,
        lines: [
          { role: 'director', text: 'The letter is opened.' },
          { role: 'tutor', text: 'Look again at the signature.' },
          { role: 'learner', text: 'I see why that matters now.' },
          { role: 'superego', text: 'internal' },
        ],
      },
    ],
  });
  assert.match(transcript, /STAGE: The letter is opened/u);
  assert.match(transcript, /TUTOR: Look again/u);
  assert.match(transcript, /LEARNER: I see/u);
  assert.doesNotMatch(transcript, /source-label|grounded_anagnorisis|D:|internal/u);
});

test('buildDerivationPairwisePacket blinds packets and writes a private key', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-pairwise-'));
  const loopDir = path.join(tmp, 'loop');
  const outDir = path.join(tmp, 'out');
  const left = 'probe-s0-hidden-r1';
  const right = 'probe-s1-dialogue-r1';
  writeLive(loopDir, left, 'Let the seal sit beside the letter before you decide.', 'Yes, I follow that much.');
  writeLive(loopDir, right, 'Pause with the seal. What does the letter let you say?', 'I think the seal matters first.');

  const result = buildDerivationPairwisePacket({
    pairs: [{ pairId: 'probe', labels: [left, right] }],
    loopDir,
    outDir,
  });
  assert.equal(result.manifest.pair_count, 1);

  const manifestText = fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8');
  const packetText = fs.readFileSync(path.join(outDir, 'pairs/P01.md'), 'utf8');
  const keyText = fs.readFileSync(path.join(outDir, 'key.json'), 'utf8');

  assert.match(packetText, /## Transcript A/u);
  assert.match(packetText, /## Transcript B/u);
  assert.match(packetText, /TUTOR:/u);
  assert.doesNotMatch(packetText, /probe-s0-hidden-r1|probe-s1-dialogue-r1|grounded_anagnorisis|D:/u);
  assert.doesNotMatch(manifestText, /probe-s0-hidden-r1|probe-s1-dialogue-r1/u);
  assert.match(keyText, /probe-s0-hidden-r1/u);
  assert.match(keyText, /probe-s1-dialogue-r1/u);
});
