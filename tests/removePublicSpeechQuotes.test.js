import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { removePublicSpeechQuotes } from '../scripts/remove-public-speech-quotes.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts/remove-public-speech-quotes.js');

describe('remove-public-speech-quotes', () => {
  it('removes wrapping double quotes after a role label and action aside', () => {
    const input = 'Learner: [Rubs her eyes]\n\n"Oh I get it..."\n';
    assert.equal(removePublicSpeechQuotes(input), 'Learner: [Rubs her eyes]\n\nOh I get it...\n');
  });

  it('can also strip terminal ellipses when requested', () => {
    const input = 'Learner: [Rubs her eyes]\n\n"Oh I get it..."\n';
    assert.equal(
      removePublicSpeechQuotes(input, { stripEllipsis: true }),
      'Learner: [Rubs her eyes]\n\nOh I get it\n',
    );
  });

  it('removes same-line wrapping quotes without touching interior quoted terms', () => {
    const input = [
      'TUTOR: "Use the field name, not the row value."',
      '',
      'LEARNER: The word "field" is the column label.',
      '',
    ].join('\n');
    assert.equal(
      removePublicSpeechQuotes(input),
      ['TUTOR: Use the field name, not the row value.', '', 'LEARNER: The word "field" is the column label.', ''].join(
        '\n',
      ),
    );
  });

  it('writes cleaned files in place', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speech-quotes-'));
    const filePath = path.join(dir, 'sample.txt');
    fs.writeFileSync(filePath, 'Learner: "The label names the variable."\n', 'utf8');
    execFileSync('node', [SCRIPT, '--write', filePath], { cwd: ROOT });
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'Learner: The label names the variable.\n');
  });
});
