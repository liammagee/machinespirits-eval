import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeReviewer, learnerTurnsFromLog } from '../scripts/dump-turn-prompts.js';

function utterance(turnIndex, speaker, content) {
  return { kind: 'utterance', turnIndex, speaker, content };
}

describe('learnerTurnsFromLog', () => {
  it('takes the final output when the learner deliberated in the open', () => {
    const turns = learnerTurnsFromLog({
      transcripts: {
        fullEvents: [
          utterance(1, 'Learner Ego', 'first draft'),
          utterance(1, 'Learner Superego', 'critique of the draft'),
          utterance(1, 'Learner Ego', '(revised) second draft'),
          utterance(1, 'Learner', '(final output) what was actually sent'),
          utterance(1, 'Tutor Ego', '(generated_prompt: 900 chars)'),
        ],
      },
    });
    assert.equal(turns.get(1), 'what was actually sent');
  });

  it('takes the only line when the turn has no deliberation', () => {
    const turns = learnerTurnsFromLog({
      transcripts: { fullEvents: [utterance(0, 'Learner Ego', 'the opening message')] },
    });
    assert.equal(turns.get(0), 'the opening message');
  });

  it('keeps the turns apart and ignores the tutor', () => {
    const turns = learnerTurnsFromLog({
      transcripts: {
        fullEvents: [
          utterance(0, 'Learner Ego', 'turn zero'),
          utterance(0, 'Tutor Ego', 'not a learner line'),
          utterance(1, 'Learner', '(final output) turn one'),
        ],
      },
    });
    assert.deepEqual(
      [...turns.entries()],
      [
        [0, 'turn zero'],
        [1, 'turn one'],
      ],
    );
  });

  it('returns nothing rather than throwing when the log has no transcript', () => {
    assert.equal(learnerTurnsFromLog(null).size, 0);
    assert.equal(learnerTurnsFromLog({ transcripts: {} }).size, 0);
  });
});

describe('describeReviewer', () => {
  it('says so when no reviewer ran', () => {
    assert.match(describeReviewer(null, false).verdict, /no reviewer/);
  });

  it('reports a pass as the tutor keeping its own words', () => {
    const { verdict, lines } = describeReviewer({ passes: true, reason: 'hands agency back' }, false);
    assert.match(verdict, /passed/);
    assert.deepEqual(lines, ['reason: hands agency back']);
  });

  it('warns that a replaced turn is the reviewer speaking and the tutor is lost', () => {
    const { verdict, lines } = describeReviewer(
      { passes: false, reason: 'too cold', repaired_response: 'warmer text' },
      true,
    );
    assert.match(verdict, /REPLACED/);
    assert.ok(lines.some((line) => /reviewer's text, word for word/.test(line)));
    assert.ok(lines.some((line) => /stored nowhere/.test(line)));
  });

  it('names an append as an append', () => {
    const { verdict, lines } = describeReviewer(
      { passes: false, reason: 'no return move', agency_return_append: 'Now check paragraph 196.' },
      true,
    );
    assert.match(verdict, /appended/);
    assert.ok(lines.includes('Now check paragraph 196.'));
  });

  it('distinguishes a failed check that changed nothing', () => {
    const { verdict } = describeReviewer({ passes: false, reason: 'no return move' }, false);
    assert.match(verdict, /left alone/);
  });
});
